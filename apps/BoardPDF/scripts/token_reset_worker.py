import logging
import os
from pathlib import Path
import signal
import sys
import threading
from typing import Dict, List, Optional, Tuple

import pymysql
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
logger = logging.getLogger('TokenResetWorker')

DB_HOST = os.getenv('DB_HOST', '127.0.0.1')
DB_PORT = int(os.getenv('DB_PORT', '3306'))
DB_USER = os.getenv('DB_USER', 'boardpdf_user')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'boardpdf_db')

REDIS_HOST = os.getenv('REDIS_HOST', '127.0.0.1')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', '') or None

INTERVAL_SECONDS = max(10, int(os.getenv('TOKEN_RESET_INTERVAL_SECONDS', '60')))
BATCH_SIZE = max(50, int(os.getenv('TOKEN_RESET_BATCH_SIZE', '1000')))
MAX_BATCHES_PER_TICK = max(1, int(os.getenv('TOKEN_RESET_MAX_BATCHES_PER_TICK', '20')))
REDIS_INVALIDATION_CHUNK = 500

DUE_USERS_QUERY = """
SELECT
  u.id,
  u.email,
  u.username,
  MAX(
    CASE
      WHEN p.name = 'subscription:feature:business' THEN 5000
      WHEN p.name = 'subscription:feature:pro' THEN 2000
      ELSE 100
    END
  ) AS next_balance
FROM users u
LEFT JOIN subscription_tier_permissions stp
  ON u.subscription_status = 'active' AND stp.tier = u.subscription_tier
LEFT JOIN permissions p
  ON p.id = stp.permission_id
WHERE u.ai_tokens_reset_at <= CURRENT_TIMESTAMP
GROUP BY u.id, u.email, u.username
ORDER BY u.id ASC
LIMIT %s
"""

RESET_TOKENS_UPDATE = """
UPDATE users
SET ai_tokens_balance = %s,
    ai_tokens_reset_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 MONTH)
WHERE id = %s AND ai_tokens_reset_at <= CURRENT_TIMESTAMP
"""

STOP_EVENT = threading.Event()


def handle_shutdown_signal(signum: int, _frame: object) -> None:
    logger.info('Shutdown signal (%d) received; stopping token reset worker...', signum)
    STOP_EVENT.set()


class TokenResetWorker:
    def __init__(self) -> None:
        self._db_conn: Optional[pymysql.connections.Connection] = None
        self._redis_client: Optional[redis.Redis] = None

    def _get_db_connection(self) -> Optional[pymysql.connections.Connection]:
        try:
            if self._db_conn is not None and self._db_conn.open:
                self._db_conn.ping(reconnect=True)
                return self._db_conn
        except Exception:
            self._close_db_connection()

        try:
            self._db_conn = pymysql.connect(
                host=DB_HOST,
                port=DB_PORT,
                user=DB_USER,
                password=DB_PASSWORD,
                database=DB_NAME,
                cursorclass=pymysql.cursors.DictCursor,
                connect_timeout=5,
                read_timeout=15,
                write_timeout=15,
                autocommit=False,
                charset='utf8mb4',
            )
            return self._db_conn
        except Exception as exc:
            logger.warning('MySQL unavailable for token reset cycle: %s', exc)
            self._db_conn = None
            return None

    def _close_db_connection(self) -> None:
        if self._db_conn is not None:
            try:
                self._db_conn.close()
            except Exception:
                pass
            self._db_conn = None

    def _get_redis_client(self) -> Optional[redis.Redis]:
        if self._redis_client is not None:
            try:
                self._redis_client.ping()
                return self._redis_client
            except Exception:
                self._close_redis_client()

        try:
            client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                password=REDIS_PASSWORD,
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=5,
            )
            client.ping()
            self._redis_client = client
            return client
        except Exception as exc:
            logger.warning('Redis unavailable for cache invalidation: %s', exc)
            self._redis_client = None
            return None

    def _close_redis_client(self) -> None:
        if self._redis_client is not None:
            try:
                self._redis_client.close()
            except Exception:
                pass
            self._redis_client = None

    def _invalidate_user_caches(self, reset_accounts: List[Tuple[int, str, str]]) -> None:
        if not reset_accounts:
            return

        client = self._get_redis_client()
        if client is None:
            return

        try:
            for start in range(0, len(reset_accounts), REDIS_INVALIDATION_CHUNK):
                chunk = reset_accounts[start:start + REDIS_INVALIDATION_CHUNK]
                keys_to_delete: List[str] = []
                for uid, email, username in chunk:
                    uid_str = str(uid)
                    keys_to_delete.extend([
                        f'cache:user:id:{uid_str}',
                        f'user:profile:{uid_str}',
                        f'user:cache:{uid_str}',
                        f'user:permissions:{uid_str}',
                        f'cache:user:perms:{uid_str}',
                        f'cache:user:billing:{uid_str}',
                    ])
                    if email:
                        keys_to_delete.append(f'cache:user:email:{email.lower().strip()}')
                    if username:
                        keys_to_delete.append(f'cache:user:username:{username.lower().strip()}')

                if keys_to_delete:
                    pipeline = client.pipeline(transaction=False)
                    pipeline.delete(*keys_to_delete)
                    pipeline.execute()
        except Exception as exc:
            logger.warning('Failed invalidating Redis cache keys after token reset: %s', exc)
            self._close_redis_client()

    def run_cycle(self) -> int:
        conn = self._get_db_connection()
        if conn is None:
            return 0

        total_reset = 0
        all_reset_accounts: List[Tuple[int, str, str]] = []

        try:
            for _ in range(MAX_BATCHES_PER_TICK):
                if STOP_EVENT.is_set():
                    break

                with conn.cursor() as cursor:
                    cursor.execute(DUE_USERS_QUERY, (BATCH_SIZE,))
                    rows: List[Dict[str, object]] = list(cursor.fetchall())

                    if not rows:
                        conn.commit()
                        break

                    updates = [
                        (int(row['next_balance']), int(row['id']))
                        for row in rows
                    ]
                    affected = cursor.executemany(RESET_TOKENS_UPDATE, updates)
                    conn.commit()

                for row in rows:
                    all_reset_accounts.append((
                        int(row['id']),
                        str(row.get('email') or ''),
                        str(row.get('username') or ''),
                    ))

                total_reset += affected if isinstance(affected, int) and affected > 0 else len(rows)

                if len(rows) < BATCH_SIZE:
                    break
        except Exception as exc:
            logger.error('Error during token reset batch transaction: %s', exc)
            try:
                conn.rollback()
            except Exception:
                pass
            self._close_db_connection()
            return total_reset

        if all_reset_accounts:
            self._invalidate_user_caches(all_reset_accounts)
            logger.info('Reset monthly AI token quotas for %d account(s).', len(all_reset_accounts))

        return len(all_reset_accounts)

    def close(self) -> None:
        self._close_db_connection()
        self._close_redis_client()


def main() -> None:
    signal.signal(signal.SIGINT, handle_shutdown_signal)
    signal.signal(signal.SIGTERM, handle_shutdown_signal)

    logger.info(
        'Starting AI token reset worker (interval=%ds, batch_size=%d)...',
        INTERVAL_SECONDS,
        BATCH_SIZE,
    )

    worker = TokenResetWorker()
    try:
        if '--once' in sys.argv:
            worker.run_cycle()
            return

        while not STOP_EVENT.is_set():
            try:
                worker.run_cycle()
            except Exception as exc:
                logger.error('Unhandled error in token reset cycle: %s', exc)
            STOP_EVENT.wait(timeout=INTERVAL_SECONDS)
    finally:
        worker.close()
        logger.info('AI token reset worker stopped.')


if __name__ == '__main__':
    main()
