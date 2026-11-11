import argparse
import logging
import os
from pathlib import Path
import signal
import sys
import threading
import time
from typing import List

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] [WorkerManager] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger('WorkerManager')

STOP_EVENT = threading.Event()


def handle_shutdown_signal(signum, frame):
    signame = signal.Signals(signum).name if hasattr(signal, 'Signals') else str(signum)
    logger.info('Received shutdown signal %s. Initiating graceful worker termination...', signame)
    STOP_EVENT.set()


def run_telemetry_worker():
    logger.info('Initializing Telemetry Worker thread...')
    try:
        from telemetry_worker import run_worker, stop_event as telem_stop_event

        # Propagate manager stop event
        def sync_stop():
            STOP_EVENT.wait()
            telem_stop_event.set()

        sync_thread = threading.Thread(target=sync_stop, daemon=True, name='TelemetryStopBridge')
        sync_thread.start()

        run_worker()
    except Exception as exc:
        logger.error('Telemetry worker encountered unexpected termination: %s', exc, exc_info=True)


def run_storage_cleaner_worker():
    interval_seconds = int(os.getenv('CLEANER_INTERVAL_SECONDS', '60'))
    logger.info('Initializing Storage Cleaner thread (interval=%ds)...', interval_seconds)
    try:
        from storage_cleaner import run_cleanup_cycle

        while not STOP_EVENT.is_set():
            try:
                run_cleanup_cycle()
            except Exception as exc:
                logger.error('Error during storage cleanup cycle: %s', exc)

            STOP_EVENT.wait(timeout=interval_seconds)
    except Exception as exc:
        logger.error('Storage cleaner worker encountered unexpected termination: %s', exc, exc_info=True)


def run_token_reset_worker():
    interval_seconds = int(os.getenv('TOKEN_RESET_INTERVAL_SECONDS', '60'))
    logger.info('Initializing Token Reset Worker thread (interval=%ds)...', interval_seconds)
    try:
        from token_reset_worker import TokenResetWorker, STOP_EVENT as TOKEN_STOP_EVENT

        worker = TokenResetWorker()
        try:
            while not STOP_EVENT.is_set():
                try:
                    worker.run_cycle()
                except Exception as exc:
                    logger.error('Error during token reset cycle: %s', exc)

                STOP_EVENT.wait(timeout=interval_seconds)
        finally:
            TOKEN_STOP_EVENT.set()
            worker.close()
    except Exception as exc:
        logger.error('Token reset worker encountered unexpected termination: %s', exc, exc_info=True)


def main():
    parser = argparse.ArgumentParser(description='BoardPDF Enterprise Background Worker Manager')
    parser.add_argument(
        '--worker',
        choices=['all', 'telemetry', 'storage-cleaner', 'token-reset'],
        default='all',
        help='Target worker to run (default: all)',
    )
    args = parser.parse_args()

    # Ensure scripts directory is on Python path
    scripts_dir = str(Path(__file__).resolve().parent)
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)

    signal.signal(signal.SIGINT, handle_shutdown_signal)
    signal.signal(signal.SIGTERM, handle_shutdown_signal)

    logger.info('Starting BoardPDF Enterprise Background Worker Manager...')

    enable_telemetry = os.getenv('ENABLE_TELEMETRY', 'true').lower() == 'true'
    enable_storage_cleaner = os.getenv('ENABLE_STORAGE_CLEANER', 'true').lower() == 'true'
    enable_token_reset = os.getenv('ENABLE_TOKEN_RESET', 'true').lower() == 'true'

    threads: List[threading.Thread] = []

    if args.worker in ('all', 'telemetry') and enable_telemetry:
        t = threading.Thread(target=run_telemetry_worker, name='TelemetryWorker', daemon=True)
        threads.append(t)
        t.start()
    else:
        logger.info('Telemetry worker disabled.')

    if args.worker in ('all', 'storage-cleaner') and enable_storage_cleaner:
        t = threading.Thread(target=run_storage_cleaner_worker, name='StorageCleanerWorker', daemon=True)
        threads.append(t)
        t.start()
    else:
        logger.info('Storage cleaner worker disabled.')

    if args.worker in ('all', 'token-reset') and enable_token_reset:
        t = threading.Thread(target=run_token_reset_worker, name='TokenResetWorker', daemon=True)
        threads.append(t)
        t.start()
    else:
        logger.info('Token reset worker disabled.')

    if not threads:
        logger.warning('No workers were enabled or launched. Exiting.')
        return

    logger.info('All %d active worker threads started successfully.', len(threads))

    # Keep main thread alive waiting for stop signal
    try:
        while not STOP_EVENT.is_set():
            STOP_EVENT.wait(timeout=1.0)
    except KeyboardInterrupt:
        STOP_EVENT.set()

    logger.info('Shutting down worker threads gracefully...')
    for t in threads:
        t.join(timeout=5.0)

    logger.info('BoardPDF Worker Manager stopped cleanly.')


if __name__ == '__main__':
    main()
