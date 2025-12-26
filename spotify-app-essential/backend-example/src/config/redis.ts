/**
 * Redis Cache Configuration
 */

import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const connectRedis = async (): Promise<void> => {
  try {
    redisClient = createClient({
      url: REDIS_URL,
    });

    redisClient.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    await redisClient.connect();

  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    // Non-blocking: continue without cache
    console.warn('⚠️  Continuing without Redis cache');
  }
};

export const getRedisClient = (): RedisClientType | null => {
  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    console.log('✅ Redis disconnected');
  }
};

/**
 * Cache helpers
 */
export const cacheGet = async (key: string): Promise<string | null> => {
  if (!redisClient) return null;
  try {
    return await redisClient.get(key);
  } catch (error) {
    console.error('❌ Redis GET error:', error);
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: string,
  expirySeconds: number = 300
): Promise<void> => {
  if (!redisClient) return;
  try {
    await redisClient.setEx(key, expirySeconds, value);
  } catch (error) {
    console.error('❌ Redis SET error:', error);
  }
};

export const cacheDel = async (key: string): Promise<void> => {
  if (!redisClient) return;
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('❌ Redis DEL error:', error);
  }
};
