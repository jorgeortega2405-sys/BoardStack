import mysql, { Pool } from 'mysql2/promise';
import { logger } from '../services/logger.service.js';
import { config } from './env.config.js';

let dbPool: Pool | null = null;

export function getDbPool(): Pool {
  if (!dbPool) {
    dbPool = mysql.createPool({
      connectionLimit: 10,
      database: config.db.database,
      host: config.db.host,
      password: config.db.password,
      port: config.db.port,
      user: config.db.user,
      waitForConnections: true,
    });
  }
  return dbPool;
}

export async function checkDatabaseConnection(retries = 2, delayMs = 500): Promise<boolean> {
  const pool = getDbPool();
  for (let i = 1; i <= retries; i++) {
    try {
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      logger.db.info('Conexión establecida exitosamente con MySQL.');
      return true;
    } catch {
      if (i === retries) {
        logger.db.warn(`No se pudo conectar a MySQL en ${config.db.host}:${config.db.port}. Operando en modo resiliente.`);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}
