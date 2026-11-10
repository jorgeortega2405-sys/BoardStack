import argparse
from collections import defaultdict
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import re
import signal
import sys
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
import uuid

from cassandra import ConsistencyLevel, InvalidRequest
from cassandra.auth import PlainTextAuthProvider
from cassandra.cluster import Cluster, EXEC_PROFILE_DEFAULT, ExecutionProfile, Session
from cassandra.concurrent import execute_concurrent_with_args
from cassandra.policies import DCAwareRoundRobinPolicy
from cassandra.query import BatchStatement, BatchType, PreparedStatement
import redis


def load_dotenv_files() -> None:
    if Path('/.dockerenv').exists():
        return

    script_dir = Path(__file__).resolve()
    candidates = [
        Path.cwd() / '.env',
        Path.cwd() / 'apps' / 'BoardPDF' / '.env',
        script_dir.parents[1] / '.env',
        script_dir.parents[3] / '.env',
    ]

    seen = set()
    for env_path in candidates:
        resolved = env_path.resolve()
        if resolved in seen or not resolved.is_file():
            continue
        seen.add(resolved)
        try:
            with resolved.open('r', encoding='utf-8') as handle:
                for raw_line in handle:
                    line = raw_line.strip()
                    if not line or line.startswith('#') or '=' not in line:
                        continue
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                        value = value[1:-1]
                    if key:
                        os.environ.setdefault(key, value)
        except OSError:
            continue


load_dotenv_files()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger('TelemetryWorker')

REDIS_HOST = os.getenv('REDIS_HOST', '127.0.0.1')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', '') or None

TELEMETRY_STREAM_KEY = os.getenv('TELEMETRY_STREAM_KEY', 'telemetry:events:stream')
TELEMETRY_DLQ_STREAM_KEY = os.getenv('TELEMETRY_DLQ_STREAM_KEY', 'telemetry:events:dlq')
TELEMETRY_CONSUMER_GROUP = os.getenv('TELEMETRY_CONSUMER_GROUP', 'telemetry-cassandra-workers')
TELEMETRY_CONSUMER_NAME = os.getenv('TELEMETRY_CONSUMER_NAME', f"worker-{os.getpid()}")

CASSANDRA_HOSTS = [h.strip() for h in os.getenv('CASSANDRA_HOSTS', '127.0.0.1').split(',') if h.strip()]
CASSANDRA_PORT = int(os.getenv('CASSANDRA_PORT', '9042'))
CASSANDRA_KEYSPACE = os.getenv('CASSANDRA_KEYSPACE', 'boardpdf_telemetry').strip()
CASSANDRA_LOCAL_DC = os.getenv('CASSANDRA_LOCAL_DC', 'datacenter1').strip() or 'datacenter1'
CASSANDRA_USER = os.getenv('CASSANDRA_USER', '').strip()
CASSANDRA_PASSWORD = os.getenv('CASSANDRA_PASSWORD', '').strip()

if not re.fullmatch(r'[A-Za-z0-9_]+', CASSANDRA_KEYSPACE):
    raise ValueError('Invalid CASSANDRA_KEYSPACE identifier')

WORKER_BATCH_SIZE = max(10, int(os.getenv('TELEMETRY_WORKER_BATCH_SIZE', '250')))
WORKER_BLOCK_MS = max(100, int(os.getenv('TELEMETRY_WORKER_BLOCK_MS', '1000')))
CLAIM_IDLE_MS = max(5000, int(os.getenv('TELEMETRY_CLAIM_IDLE_MS', '30000')))
CASSANDRA_PARTITION_BATCH_LIMIT = max(1, int(os.getenv('CASSANDRA_PARTITION_BATCH_LIMIT', '50')))
MAX_EVENT_RETRIES = 3

stop_event = threading.Event()


def handle_signal(signum: int, _frame: Any) -> None:
    logger.info('Received shutdown signal (%s). Stopping telemetry worker cleanly...', signum)
    stop_event.set()


signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)


def parse_timestamp(raw_value: Any) -> datetime:
    if isinstance(raw_value, (int, float)):
        ts_val = float(raw_value)
        if ts_val > 1e12:
            ts_val /= 1000.0
        return datetime.fromtimestamp(ts_val, tz=timezone.utc).replace(tzinfo=None)
    if isinstance(raw_value, str) and raw_value.strip():
        cleaned = raw_value.strip()
        if cleaned.endswith('Z'):
            cleaned = cleaned[:-1] + '+00:00'
        try:
            dt = datetime.fromisoformat(cleaned)
            if dt.tzinfo is not None:
                return dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except ValueError:
            pass
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_uuid(raw_value: Any) -> uuid.UUID:
    if isinstance(raw_value, str) and raw_value.strip():
        try:
            return uuid.UUID(raw_value.strip())
        except ValueError:
            pass
    return uuid.uuid4()


def safe_str(raw_value: Any, default: str = '', max_len: int = 512) -> str:
    if raw_value is None:
        return default
    text = str(raw_value)
    if len(text) > max_len:
        return text[:max_len]
    return text


def safe_opt_int(raw_value: Any) -> Optional[int]:
    if raw_value is None or raw_value == '':
        return None
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return None


def safe_int(raw_value: Any, default: int = 0) -> int:
    val = safe_opt_int(raw_value)
    return val if val is not None else default


def safe_metadata_json(raw_value: Any) -> str:
    if raw_value is None:
        return '{}'
    if isinstance(raw_value, str):
        return raw_value[:8192] if raw_value.strip() else '{}'
    try:
        serialized = json.dumps(raw_value, separators=(',', ':'), ensure_ascii=True)
        return serialized[:8192]
    except (TypeError, ValueError):
        return '{}'


class PreparedTelemetryStatements:
    def __init__(self, session: Session) -> None:
        ks = CASSANDRA_KEYSPACE
        self.insert_http_request: PreparedStatement = session.prepare(
            f"""
            INSERT INTO {ks}.http_request_metrics_by_day (
              event_date, service_name, created_at, event_id, request_id,
              method, route_pattern, raw_path, status_code, status_class,
              latency_ms, duration_us, request_bytes, response_bytes, user_id,
              subscription_tier, ip_hash, user_agent, country_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
        )
        self.insert_pdf_processing: PreparedStatement = session.prepare(
            f"""
            INSERT INTO {ks}.pdf_processing_events_by_day (
              event_date, tool_name, created_at, event_id, operation_id,
              user_id, is_authenticated, status, error_code, file_count,
              input_bytes, output_bytes, page_count, processing_ms, storage_provider,
              client_type, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
        )
        self.insert_security_auth: PreparedStatement = session.prepare(
            f"""
            INSERT INTO {ks}.security_and_auth_events_by_day (
              event_date, event_type, created_at, event_id, severity,
              outcome, user_id, actor_hash, ip_hash, route_pattern,
              reason, user_agent, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
        )
        self.insert_ai_collab: PreparedStatement = session.prepare(
            f"""
            INSERT INTO {ks}.ai_and_collab_events_by_day (
              event_date, event_type, created_at, event_id, user_id,
              document_id, feature_name, tokens_consumed, tokens_remaining, latency_ms,
              status, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
        )
        self.insert_storage_lifecycle: PreparedStatement = session.prepare(
            f"""
            INSERT INTO {ks}.storage_and_lifecycle_events_by_day (
              event_date, event_type, created_at, event_id, user_id,
              object_key, file_id, bytes_delta, file_count, storage_tier,
              status, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
        )
        self.insert_app_error: PreparedStatement = session.prepare(
            f"""
            INSERT INTO {ks}.application_error_events_by_day (
              event_date, service_name, created_at, event_id, severity,
              error_name, error_code, message, route_pattern, method,
              user_id, request_id, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
        )
        self.update_tool_counter: PreparedStatement = session.prepare(
            f"""
            UPDATE {ks}.telemetry_tool_counters_by_day
            SET executions = executions + ?,
                success_count = success_count + ?,
                error_count = error_count + ?,
                total_files = total_files + ?,
                total_input_bytes = total_input_bytes + ?,
                total_output_bytes = total_output_bytes + ?,
                total_pages = total_pages + ?,
                total_processing_ms = total_processing_ms + ?
            WHERE event_date = ? AND tool_name = ?
            """
        )
        self.update_route_counter: PreparedStatement = session.prepare(
            f"""
            UPDATE {ks}.telemetry_route_counters_by_hour
            SET request_count = request_count + ?,
                error_4xx_count = error_4xx_count + ?,
                error_5xx_count = error_5xx_count + ?,
                total_latency_ms = total_latency_ms + ?,
                total_duration_us = total_duration_us + ?,
                total_request_bytes = total_request_bytes + ?,
                total_response_bytes = total_response_bytes + ?
            WHERE bucket_hour = ? AND route_pattern = ? AND method = ?
            """
        )


def create_redis_client() -> redis.Redis:
    return redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=10,
    )


def create_cassandra_session() -> Tuple[Cluster, Session]:
    auth_provider = None
    if CASSANDRA_USER and CASSANDRA_PASSWORD:
        auth_provider = PlainTextAuthProvider(username=CASSANDRA_USER, password=CASSANDRA_PASSWORD)

    profile = ExecutionProfile(
        load_balancing_policy=DCAwareRoundRobinPolicy(local_dc=CASSANDRA_LOCAL_DC),
        consistency_level=ConsistencyLevel.LOCAL_ONE,
        request_timeout=10.0,
    )
    cluster = Cluster(
        contact_points=CASSANDRA_HOSTS,
        port=CASSANDRA_PORT,
        auth_provider=auth_provider,
        protocol_version=5,
        execution_profiles={EXEC_PROFILE_DEFAULT: profile},
        connect_timeout=10,
    )
    session = cluster.connect()
    return cluster, session


def ensure_consumer_group(r: redis.Redis) -> None:
    try:
        r.xgroup_create(name=TELEMETRY_STREAM_KEY, groupname=TELEMETRY_CONSUMER_GROUP, id='0', mkstream=True)
        logger.info('Created Redis consumer group "%s" on stream "%s".', TELEMETRY_CONSUMER_GROUP, TELEMETRY_STREAM_KEY)
    except redis.ResponseError as exc:
        if 'BUSYGROUP' not in str(exc):
            raise


def send_to_dlq(r: redis.Redis, msg_id: str, fields: Dict[str, Any], error_reason: str) -> None:
    try:
        r.xadd(
            TELEMETRY_DLQ_STREAM_KEY,
            {
                'source_id': msg_id,
                'event_type': safe_str(fields.get('type'), 'unknown', 64),
                'payload': safe_str(fields.get('payload'), '{}', 8192),
                'error': safe_str(error_reason, 'unknown error', 512),
                'failed_at': datetime.now(timezone.utc).isoformat(),
            },
            maxlen=50000,
            approximate=True,
        )
    except redis.RedisError as exc:
        logger.error('Failed pushing message %s to DLQ: %s', msg_id, exc)


def build_write_operations(
    entries: List[Tuple[str, Dict[str, Any]]],
    stmts: PreparedTelemetryStatements,
    r: redis.Redis,
) -> Tuple[
    Dict[Tuple[str, Tuple[Any, ...]], List[Tuple[str, PreparedStatement, Tuple[Any, ...]]]],
    Dict[Tuple[Any, ...], List[int]],
    Dict[Tuple[Any, ...], List[int]],
    List[str],
]:
    partitioned_inserts: Dict[Tuple[str, Tuple[Any, ...]], List[Tuple[str, PreparedStatement, Tuple[Any, ...]]]] = defaultdict(list)
    tool_counters: Dict[Tuple[Any, ...], List[int]] = defaultdict(lambda: [0, 0, 0, 0, 0, 0, 0, 0])
    route_counters: Dict[Tuple[Any, ...], List[int]] = defaultdict(lambda: [0, 0, 0, 0, 0, 0, 0])
    poison_ack_ids: List[str] = []

    for msg_id, fields in entries:
        event_kind = safe_str(fields.get('type'), '').strip()
        raw_payload = fields.get('payload')
        if not event_kind or not isinstance(raw_payload, str):
            send_to_dlq(r, msg_id, fields, 'Missing type or payload string')
            poison_ack_ids.append(msg_id)
            continue

        try:
            payload = json.loads(raw_payload)
            if not isinstance(payload, dict):
                raise ValueError('Payload JSON must decode to an object')
        except (ValueError, TypeError) as exc:
            send_to_dlq(r, msg_id, fields, f'Invalid JSON payload: {exc}')
            poison_ack_ids.append(msg_id)
            continue

        created_at = parse_timestamp(payload.get('created_at'))
        event_date = created_at.date()
        event_id = parse_uuid(payload.get('event_id'))

        if event_kind == 'http_request':
            service_name = safe_str(payload.get('service_name'), 'boardpdf-api', 64)
            method = safe_str(payload.get('method'), 'GET', 16).upper()
            route_pattern = safe_str(payload.get('route_pattern'), '/', 256)
            raw_path = safe_str(payload.get('raw_path'), route_pattern, 512)
            status_code = safe_int(payload.get('status_code'), 200)
            status_class = max(0, min(9, status_code // 100))
            latency_ms = max(0, safe_int(payload.get('latency_ms'), 0))
            duration_us = max(0, safe_int(payload.get('duration_us'), latency_ms * 1000))
            req_bytes = max(0, safe_int(payload.get('request_bytes'), 0))
            res_bytes = max(0, safe_int(payload.get('response_bytes'), 0))

            params = (
                event_date,
                service_name,
                created_at,
                event_id,
                safe_str(payload.get('request_id'), str(event_id), 64),
                method,
                route_pattern,
                raw_path,
                status_code,
                status_class,
                latency_ms,
                duration_us,
                req_bytes,
                res_bytes,
                safe_opt_int(payload.get('user_id')),
                safe_str(payload.get('subscription_tier'), 'anonymous', 32),
                safe_str(payload.get('ip_hash'), '', 128),
                safe_str(payload.get('user_agent'), '', 512),
                safe_str(payload.get('country_code'), '', 16),
            )
            partitioned_inserts[('http_request', (event_date, service_name))].append(
                (msg_id, stmts.insert_http_request, params)
            )

            bucket_hour = created_at.replace(minute=0, second=0, microsecond=0)
            rc = route_counters[(bucket_hour, route_pattern, method)]
            rc[0] += 1
            if 400 <= status_code < 500:
                rc[1] += 1
            elif status_code >= 500:
                rc[2] += 1
            rc[3] += latency_ms
            rc[4] += duration_us
            rc[5] += req_bytes
            rc[6] += res_bytes

        elif event_kind == 'pdf_processing':
            tool_name = safe_str(payload.get('tool_name'), 'general', 64)
            status = safe_str(payload.get('status'), 'success', 32).lower()
            is_error = status in ('error', 'failed', 'failure')
            file_count = max(0, safe_int(payload.get('file_count'), 1))
            input_bytes = max(0, safe_int(payload.get('input_bytes'), 0))
            output_bytes = max(0, safe_int(payload.get('output_bytes'), 0))
            page_count = max(0, safe_int(payload.get('page_count'), 0))
            processing_ms = max(0, safe_int(payload.get('processing_ms'), 0))

            params = (
                event_date,
                tool_name,
                created_at,
                event_id,
                safe_str(payload.get('operation_id'), str(event_id), 64),
                safe_opt_int(payload.get('user_id')),
                bool(payload.get('is_authenticated', False)),
                status,
                safe_str(payload.get('error_code'), '', 64),
                file_count,
                input_bytes,
                output_bytes,
                page_count,
                processing_ms,
                safe_str(payload.get('storage_provider'), 's3', 32),
                safe_str(payload.get('client_type'), 'web', 32),
                safe_metadata_json(payload.get('metadata')),
            )
            partitioned_inserts[('pdf_processing', (event_date, tool_name))].append(
                (msg_id, stmts.insert_pdf_processing, params)
            )

            tc = tool_counters[(event_date, tool_name)]
            tc[0] += 1
            if is_error:
                tc[2] += 1
            else:
                tc[1] += 1
            tc[3] += file_count
            tc[4] += input_bytes
            tc[5] += output_bytes
            tc[6] += page_count
            tc[7] += processing_ms

        elif event_kind == 'security_auth':
            event_type = safe_str(payload.get('event_type'), 'security_event', 64)
            params = (
                event_date,
                event_type,
                created_at,
                event_id,
                safe_str(payload.get('severity'), 'info', 24),
                safe_str(payload.get('outcome'), 'unknown', 32),
                safe_opt_int(payload.get('user_id')),
                safe_str(payload.get('actor_hash'), '', 128),
                safe_str(payload.get('ip_hash'), '', 128),
                safe_str(payload.get('route_pattern'), '', 256),
                safe_str(payload.get('reason'), '', 256),
                safe_str(payload.get('user_agent'), '', 512),
                safe_metadata_json(payload.get('metadata')),
            )
            partitioned_inserts[('security_auth', (event_date, event_type))].append(
                (msg_id, stmts.insert_security_auth, params)
            )

        elif event_kind == 'ai_collab':
            event_type = safe_str(payload.get('event_type'), 'ai_event', 64)
            params = (
                event_date,
                event_type,
                created_at,
                event_id,
                safe_opt_int(payload.get('user_id')),
                safe_str(payload.get('document_id'), '', 64),
                safe_str(payload.get('feature_name'), 'general', 64),
                max(0, safe_int(payload.get('tokens_consumed'), 0)),
                max(0, safe_int(payload.get('tokens_remaining'), 0)),
                max(0, safe_int(payload.get('latency_ms'), 0)),
                safe_str(payload.get('status'), 'success', 32),
                safe_metadata_json(payload.get('metadata')),
            )
            partitioned_inserts[('ai_collab', (event_date, event_type))].append(
                (msg_id, stmts.insert_ai_collab, params)
            )

        elif event_kind == 'storage_lifecycle':
            event_type = safe_str(payload.get('event_type'), 'storage_event', 64)
            params = (
                event_date,
                event_type,
                created_at,
                event_id,
                safe_opt_int(payload.get('user_id')),
                safe_str(payload.get('object_key'), '', 512),
                safe_str(payload.get('file_id'), '', 128),
                safe_int(payload.get('bytes_delta'), 0),
                max(0, safe_int(payload.get('file_count'), 1)),
                safe_str(payload.get('storage_tier'), 's3_hot', 32),
                safe_str(payload.get('status'), 'completed', 32),
                safe_metadata_json(payload.get('metadata')),
            )
            partitioned_inserts[('storage_lifecycle', (event_date, event_type))].append(
                (msg_id, stmts.insert_storage_lifecycle, params)
            )

        elif event_kind == 'application_error':
            service_name = safe_str(payload.get('service_name'), 'boardpdf-api', 64)
            params = (
                event_date,
                service_name,
                created_at,
                event_id,
                safe_str(payload.get('severity'), 'error', 24),
                safe_str(payload.get('error_name'), 'Error', 128),
                safe_str(payload.get('error_code'), '', 64),
                safe_str(payload.get('message'), 'Unexpected error', 1024),
                safe_str(payload.get('route_pattern'), '', 256),
                safe_str(payload.get('method'), '', 16),
                safe_opt_int(payload.get('user_id')),
                safe_str(payload.get('request_id'), str(event_id), 64),
                safe_metadata_json(payload.get('metadata')),
            )
            partitioned_inserts[('application_error', (event_date, service_name))].append(
                (msg_id, stmts.insert_app_error, params)
            )

        else:
            send_to_dlq(r, msg_id, fields, f'Unknown event kind: {event_kind}')
            poison_ack_ids.append(msg_id)

    return partitioned_inserts, tool_counters, route_counters, poison_ack_ids


def flush_to_cassandra(
    session: Session,
    stmts: PreparedTelemetryStatements,
    r: redis.Redis,
    entries: List[Tuple[str, Dict[str, Any]]],
) -> Tuple[int, int]:
    if not entries:
        return 0, 0

    partitioned_inserts, tool_counters, route_counters, poison_ack_ids = build_write_operations(entries, stmts, r)
    ack_ids: List[str] = list(poison_ack_ids)
    written_rows = 0

    msg_lookup = dict(entries)

    for _group_key, ops in partitioned_inserts.items():
        for idx in range(0, len(ops), CASSANDRA_PARTITION_BATCH_LIMIT):
            chunk = ops[idx : idx + CASSANDRA_PARTITION_BATCH_LIMIT]
            if len(chunk) == 1:
                msg_id, prep_stmt, params = chunk[0]
                try:
                    session.execute(prep_stmt, params)
                    ack_ids.append(msg_id)
                    written_rows += 1
                except InvalidRequest as exc:
                    send_to_dlq(r, msg_id, msg_lookup.get(msg_id, {}), f'Cassandra InvalidRequest: {exc}')
                    ack_ids.append(msg_id)
            else:
                batch = BatchStatement(batch_type=BatchType.UNLOGGED, consistency_level=ConsistencyLevel.LOCAL_ONE)
                for _msg_id, prep_stmt, params in chunk:
                    batch.add(prep_stmt, params)
                try:
                    session.execute(batch)
                    for msg_id, _prep_stmt, _params in chunk:
                        ack_ids.append(msg_id)
                    written_rows += len(chunk)
                except InvalidRequest:
                    for msg_id, prep_stmt, params in chunk:
                        try:
                            session.execute(prep_stmt, params)
                            ack_ids.append(msg_id)
                            written_rows += 1
                        except InvalidRequest as item_exc:
                            send_to_dlq(r, msg_id, msg_lookup.get(msg_id, {}), f'Cassandra InvalidRequest: {item_exc}')
                            ack_ids.append(msg_id)

    if tool_counters:
        tool_args = [
            (
                counts[0],
                counts[1],
                counts[2],
                counts[3],
                counts[4],
                counts[5],
                counts[6],
                counts[7],
                event_date,
                tool_name,
            )
            for (event_date, tool_name), counts in tool_counters.items()
        ]
        execute_concurrent_with_args(session, stmts.update_tool_counter, tool_args, concurrency=16)

    if route_counters:
        route_args = [
            (
                counts[0],
                counts[1],
                counts[2],
                counts[3],
                counts[4],
                counts[5],
                counts[6],
                bucket_hour,
                route_pattern,
                method,
            )
            for (bucket_hour, route_pattern, method), counts in route_counters.items()
        ]
        execute_concurrent_with_args(session, stmts.update_route_counter, route_args, concurrency=16)

    if ack_ids:
        for idx in range(0, len(ack_ids), 500):
            r.xack(TELEMETRY_STREAM_KEY, TELEMETRY_CONSUMER_GROUP, *ack_ids[idx : idx + 500])

    return written_rows, len(poison_ack_ids)


def fetch_pending_batch(r: redis.Redis) -> List[Tuple[str, Dict[str, Any]]]:
    result = r.xautoclaim(
        name=TELEMETRY_STREAM_KEY,
        groupname=TELEMETRY_CONSUMER_GROUP,
        consumername=TELEMETRY_CONSUMER_NAME,
        min_idle_time=CLAIM_IDLE_MS,
        start_id='0-0',
        count=WORKER_BATCH_SIZE,
    )
    if isinstance(result, (list, tuple)) and len(result) >= 2:
        claimed = result[1]
        if isinstance(claimed, list):
            return [(msg_id, fields) for msg_id, fields in claimed if isinstance(fields, dict)]
    return []


def fetch_new_batch(r: redis.Redis, block_ms: int) -> List[Tuple[str, Dict[str, Any]]]:
    response = r.xreadgroup(
        groupname=TELEMETRY_CONSUMER_GROUP,
        consumername=TELEMETRY_CONSUMER_NAME,
        streams={TELEMETRY_STREAM_KEY: '>'},
        count=WORKER_BATCH_SIZE,
        block=block_ms if block_ms > 0 else None,
    )
    entries: List[Tuple[str, Dict[str, Any]]] = []
    if not response:
        return entries
    for _stream_name, messages in response:
        for msg_id, fields in messages:
            if isinstance(fields, dict):
                entries.append((msg_id, fields))
    return entries


def connect_with_retry() -> Tuple[redis.Redis, Cluster, Session, PreparedTelemetryStatements]:
    backoff = 2.0
    while not stop_event.is_set():
        r: Optional[redis.Redis] = None
        cluster: Optional[Cluster] = None
        try:
            r = create_redis_client()
            r.ping()
            ensure_consumer_group(r)
            cluster, session = create_cassandra_session()
            stmts = PreparedTelemetryStatements(session)
            logger.info(
                'Connected to Redis (%s:%s) and Cassandra (%s:%s/%s).',
                REDIS_HOST,
                REDIS_PORT,
                ','.join(CASSANDRA_HOSTS),
                CASSANDRA_PORT,
                CASSANDRA_KEYSPACE,
            )
            return r, cluster, session, stmts
        except Exception as exc:
            logger.warning('Waiting for Redis/Cassandra readiness (%s). Retrying in %.1fs...', exc, backoff)
            if cluster is not None:
                try:
                    cluster.shutdown()
                except Exception:
                    pass
            stop_event.wait(backoff)
            backoff = min(backoff * 1.5, 20.0)

    raise RuntimeError('Telemetry worker stopped before establishing connections')


def run_worker(run_once: bool = False) -> None:
    logger.info(
        'Starting BoardPDF Telemetry Worker (stream=%s, group=%s, consumer=%s, batch=%s)',
        TELEMETRY_STREAM_KEY,
        TELEMETRY_CONSUMER_GROUP,
        TELEMETRY_CONSUMER_NAME,
        WORKER_BATCH_SIZE,
    )

    r, cluster, session, stmts = connect_with_retry()
    try:
        while not stop_event.is_set():
            try:
                batch = fetch_pending_batch(r)
                if not batch:
                    batch = fetch_new_batch(r, 0 if run_once else WORKER_BLOCK_MS)

                if batch:
                    written, dlq_count = flush_to_cassandra(session, stmts, r, batch)
                    logger.info(
                        'Flushed batch to Cassandra: %d events persisted, %d sent to DLQ.',
                        written,
                        dlq_count,
                    )
                elif run_once:
                    break
            except (redis.RedisError, Exception) as exc:
                if stop_event.is_set():
                    break
                logger.error('Error processing telemetry batch: %s', exc)
                try:
                    cluster.shutdown()
                except Exception:
                    pass
                stop_event.wait(2.0)
                if not stop_event.is_set():
                    r, cluster, session, stmts = connect_with_retry()
    finally:
        try:
            cluster.shutdown()
        except Exception:
            pass
        logger.info('Telemetry worker shut down cleanly.')


def main() -> None:
    parser = argparse.ArgumentParser(description='BoardPDF Redis Streams to Cassandra batch telemetry worker.')
    parser.add_argument('--once', action='store_true', help='Drain available telemetry events once and exit.')
    args = parser.parse_args()
    try:
        run_worker(run_once=args.once)
    except RuntimeError as exc:
        logger.warning('%s', exc)
        sys.exit(0)


if __name__ == '__main__':
    main()
