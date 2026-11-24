import { config } from './env.config.js';
import { logger } from '../utils/logger.js';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  connectTimeout: 10000,
  connectionLimit: 50,
  database: config.db.name,
  dateStrings: true,
  enableKeepAlive: true,
  host: config.db.host,
  idleTimeout: 60000,
  keepAliveInitialDelay: 10000,
  maxIdle: 50,
  password: config.db.password,
  port: config.db.port,
  queueLimit: 0,
  user: config.db.user,
  waitForConnections: true,
});

const rawExecute = pool.execute.bind(pool);
const rawQuery = pool.query.bind(pool);

function formatSqlPreview(sql: any): string {
  if (typeof sql === 'string') {
    return sql.replace(/\s+/g, ' ').trim();
  }
  if (sql && typeof sql.sql === 'string') {
    return sql.sql.replace(/\s+/g, ' ').trim();
  }
  return String(sql);
}

(pool as any).execute = async function (sql: any, values?: any): Promise<any> {
  const start = Date.now();
  const sqlPreview = formatSqlPreview(sql);
  try {
    const result = await rawExecute(sql, values);
    const duration = Date.now() - start;
    if (duration > 300) {
      logger.database.warn(`[Slow Query] (${duration}ms) ${sqlPreview}`);
    } else {
      logger.database.debug(`Query Executed (${duration}ms) ${sqlPreview}`);
    }
    return result;
  } catch (err: any) {
    const duration = Date.now() - start;
    logger.database.error(`Query Failed (${duration}ms): ${sqlPreview}`, {
      code: err.code,
      errno: err.errno,
      error: err.message,
      sqlState: err.sqlState,
    });
    throw err;
  }
};

(pool as any).query = async function (sql: any, values?: any): Promise<any> {
  const start = Date.now();
  const sqlPreview = formatSqlPreview(sql);
  try {
    const result = await rawQuery(sql, values);
    const duration = Date.now() - start;
    if (duration > 300) {
      logger.database.warn(`[Slow Query] (${duration}ms) ${sqlPreview}`);
    } else {
      logger.database.debug(`Query Executed (${duration}ms) ${sqlPreview}`);
    }
    return result;
  } catch (err: any) {
    const duration = Date.now() - start;
    logger.database.error(`Query Failed (${duration}ms): ${sqlPreview}`, {
      code: err.code,
      errno: err.errno,
      error: err.message,
      sqlState: err.sqlState,
    });
    throw err;
  }
};

async function testDatabaseConnection(): Promise<boolean> {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    logger.database.info(`MySQL connection established successfully with database: ${config.db.name}`);
    return true;
  } catch (error) {
    logger.database.error('Failed to connect to MySQL database:', error);
    return false;
  }
}

export {
  pool,
  testDatabaseConnection
};
