import { config } from './env.config.js';
import { logger } from '../utils/logger.js';
import { Redis } from 'ioredis';

let redisInstance: Redis | null = null;
let isConnected = false;

function getRedisClient(): Redis {
  if (redisInstance) {
    return redisInstance;
  }

  const { host, password, port } = config.redis;

  redisInstance = new Redis({
    enableOfflineQueue: true,
    host,
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    password: password || undefined,
    port,
    retryStrategy(times) {
      return Math.min(times * 150, 3000);
    },
  });

  redisInstance.on('connect', () => {
    isConnected = true;
    logger.system.info(`Redis connected successfully at ${host}:${port}`);
  });

  redisInstance.on('ready', () => {
    isConnected = true;
    logger.system.info('Redis client is ready to accept commands');
  });

  redisInstance.on('error', (err) => {
    isConnected = false;
    logger.system.error(`Redis connection error (${host}:${port}): ${err.message}`, { error: err });
  });

  redisInstance.on('close', () => {
    isConnected = false;
    logger.system.warn(`Redis connection closed (${host}:${port})`);
  });

  return redisInstance;
}

function isRedisReady(): boolean {
  return isConnected && redisInstance !== null && redisInstance.status === 'ready';
}

async function testRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const pingResponse = await client.ping();
    if (pingResponse === 'PONG') {
      logger.system.info(`Redis PING test successful (${config.redis.host}:${config.redis.port})`);
      return true;
    }
    return false;
  } catch (err: any) {
    logger.system.warn(`Redis is not reachable at ${config.redis.host}:${config.redis.port} - falling back to memory store: ${err.message}`);
    return false;
  }
}

export {
  getRedisClient,
  isRedisReady,
  testRedisConnection
};
