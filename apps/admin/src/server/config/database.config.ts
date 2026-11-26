import { config } from './env.config.js';
import { logger } from '../utils/logger.js';
import mysql, { type Pool } from 'mysql2/promise';

function formatSqlPreview(sql: any): string {
  if (typeof sql === 'string') {
    return sql.replace(/\s+/g, ' ').trim();
  }
  if (sql && typeof sql.sql === 'string') {
    return sql.sql.replace(/\s+/g, ' ').trim();
  }
  return String(sql);
}

function createInstrumentedPool(database: string, connectionLimit: number): Pool {
  const targetPool = mysql.createPool({
    connectTimeout: 10000,
    connectionLimit,
    database,
    dateStrings: true,
    enableKeepAlive: true,
    host: config.db.host,
    idleTimeout: 60000,
    keepAliveInitialDelay: 10000,
    maxIdle: connectionLimit,
    password: config.db.password,
    port: config.db.port,
    queueLimit: 0,
    user: config.db.user,
    waitForConnections: true,
  });

  const rawExecute = targetPool.execute.bind(targetPool);
  const rawQuery = targetPool.query.bind(targetPool);

  (targetPool as any).execute = async function (sql: any, values?: any): Promise<any> {
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

  (targetPool as any).query = async function (sql: any, values?: any): Promise<any> {
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

  return targetPool;
}

const appPool = createInstrumentedPool(config.db.appName, 20);
const corePool = createInstrumentedPool(config.db.coreName, 30);

async function testDatabaseConnection(): Promise<boolean> {
  let coreConn: any = null;
  let appConn: any = null;
  try {
    [coreConn, appConn] = await Promise.all([
      corePool.getConnection(),
      appPool.getConnection(),
    ]);
    await Promise.all([coreConn.ping(), appConn.ping()]);
    logger.database.info(`MySQL connection established successfully with databases: ${config.db.coreName}, ${config.db.appName}`);
    return true;
  } catch (error) {
    logger.database.error('Failed to connect to MySQL databases:', error);
    return false;
  } finally {
    coreConn?.release();
    appConn?.release();
  }
}

export {
  appPool,
  corePool,
  testDatabaseConnection
};
