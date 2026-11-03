import cluster from 'node:cluster';
import os from 'node:os';
import { logger } from './services/logger.service.js';

if (cluster.isPrimary) {
  const numCPUs = Math.min(os.cpus().length, 8);
  logger.app.info(`Clúster maestro iniciado. Desplegando ${numCPUs} procesos worker...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.app.warn(`Worker ${worker.process.pid} finalizado (código: ${code}, señal: ${signal}). Reemplazando...`);
    cluster.fork();
  });
} else {
  import('./index.js');
}
