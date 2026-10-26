import logging
import os
import sys
import time
from typing import List, Set

import boto3
from botocore.client import Config
import pymysql
import redis

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('StorageCleaner')

AWS_S3_ENDPOINT = os.getenv('AWS_S3_ENDPOINT')
AWS_S3_REGION = os.getenv('AWS_S3_REGION', 'us-east-1')
AWS_S3_ACCESS_KEY_ID = os.getenv('AWS_S3_ACCESS_KEY_ID', 'minioadmin')
AWS_S3_SECRET_ACCESS_KEY = os.getenv('AWS_S3_SECRET_ACCESS_KEY', 'minioadmin')
AWS_S3_BUCKET_NAME = os.getenv('AWS_S3_BUCKET_NAME', 'boardpdf-storage')
AWS_S3_FORCE_PATH_STYLE = os.getenv('AWS_S3_FORCE_PATH_STYLE', 'true').lower() == 'true'

DB_HOST = os.getenv('DB_HOST', '127.0.0.1')
DB_PORT = int(os.getenv('DB_PORT', '3306'))
DB_USER = os.getenv('DB_USER', 'boardpdf_user')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'boardpdf_secure_password_2026')
DB_NAME = os.getenv('DB_NAME', 'boardpdf_db')

REDIS_HOST = os.getenv('REDIS_HOST', '127.0.0.1')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', None)

CLEANER_INTERVAL_SECONDS = int(os.getenv('CLEANER_INTERVAL_SECONDS', '60'))
RETENTION_SECONDS = int(os.getenv('RETENTION_SECONDS', '3600'))

def get_s3_client():
    client_kwargs = {
        'service_name': 's3',
        'region_name': AWS_S3_REGION,
        'aws_access_key_id': AWS_S3_ACCESS_KEY_ID,
        'aws_secret_access_key': AWS_S3_SECRET_ACCESS_KEY,
        'config': Config(s3={'addressing_style': 'path'} if AWS_S3_FORCE_PATH_STYLE else {})
    }
    if AWS_S3_ENDPOINT and AWS_S3_ENDPOINT.strip():
        client_kwargs['endpoint_url'] = AWS_S3_ENDPOINT.strip()
    return boto3.client(**client_kwargs)

def get_redis_client():
    try:
        r = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            password=REDIS_PASSWORD if REDIS_PASSWORD else None,
            decode_responses=True,
            socket_connect_timeout=2
        )
        r.ping()
        return r
    except Exception as e:
        logger.warning('Redis no disponible para lectura de cola de expiración: %s', e)
        return None

def get_db_connection():
    try:
        return pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=3,
            autocommit=True
        )
    except Exception as e:
        logger.warning('MySQL no disponible para consulta de expiración: %s', e)
        return None

def run_cleanup_cycle() -> int:
    s3_client = get_s3_client()
    redis_client = get_redis_client()
    db_conn = get_db_connection()

    expired_tokens: Set[str] = set()
    now_epoch = int(time.time())

    if redis_client:
        try:
            tokens_from_redis = redis_client.zrangebyscore('s3:expiration_queue', 0, now_epoch)
            if tokens_from_redis:
                expired_tokens.update(tokens_from_redis)
        except Exception as e:
            logger.warning('Error al leer de Redis zset: %s', e)

    db_records = {}
    if db_conn:
        try:
            with db_conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT file_token, s3_key, s3_bucket
                    FROM file_operations
                    WHERE expires_at <= NOW() AND status = 'active'
                    LIMIT 1000
                    """
                )
                rows = cursor.fetchall()
                for row in rows:
                    tok = row['file_token']
                    expired_tokens.add(tok)
                    db_records[tok] = row
        except Exception as e:
            logger.warning('Error al consultar archivos expirados en MySQL: %s', e)

    if not expired_tokens:
        if db_conn:
            db_conn.close()
        return 0

    tokens_list: List[str] = list(expired_tokens)
    logger.info('Procesando eliminación de %d archivos expirados (retención 1h)...', len(tokens_list))

    keys_to_delete = []
    for tok in tokens_list:
        if tok in db_records:
            keys_to_delete.append(db_records[tok]['s3_key'])
        else:
            keys_to_delete.append(f'temp/{tok}')

    for i in range(0, len(keys_to_delete), 1000):
        batch = keys_to_delete[i:i + 1000]
        try:
            s3_client.delete_objects(
                Bucket=AWS_S3_BUCKET_NAME,
                Delete={
                    'Objects': [{'Key': k} for k in batch],
                    'Quiet': True
                }
            )
            logger.info('Eliminados %d objetos de AWS S3 / MinIO en lote.', len(batch))
        except Exception as e:
            logger.error('Error al eliminar lote de S3: %s', e)

    if db_conn:
        try:
            with db_conn.cursor() as cursor:
                format_strings = ','.join(['%s'] * len(tokens_list))
                sql = f"""
                    UPDATE file_operations
                    SET status = 'expired', deleted_at = NOW()
                    WHERE file_token IN ({format_strings}) AND status = 'active'
                """
                cursor.execute(sql, tuple(tokens_list))
        except Exception as e:
            logger.error('Error al actualizar estado en MySQL: %s', e)
        finally:
            db_conn.close()

    if redis_client:
        try:
            pipeline = redis_client.pipeline()
            for tok in tokens_list:
                pipeline.zrem('s3:expiration_queue', tok)
                pipeline.delete(f'tempfile:meta:{tok}')
            pipeline.execute()
        except Exception as e:
            logger.warning('Error al purgar llaves en Redis: %s', e)

    logger.info('Ciclo de limpieza finalizado. Total eliminados: %d', len(tokens_list))
    return len(tokens_list)

def main():
    logger.info('Iniciando servicio de limpieza de almacenamiento AWS S3 / MinIO...')
    logger.info('Bucket objetivo: %s | Retención: %ds | Intervalo: %ds', AWS_S3_BUCKET_NAME, RETENTION_SECONDS, CLEANER_INTERVAL_SECONDS)

    if '--once' in sys.argv:
        run_cleanup_cycle()
        sys.exit(0)

    while True:
        try:
            run_cleanup_cycle()
        except Exception as e:
            logger.error('Error no controlado en ciclo de limpieza: %s', e)
        time.sleep(CLEANER_INTERVAL_SECONDS)

if __name__ == '__main__':
    main()
