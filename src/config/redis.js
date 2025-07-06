import Redis from 'ioredis';
import { logger } from './logger.js';

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      if (this.isConnected) {
        logger.info('Redis already connected');
        return this.client;
      }

      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
      };

      // Use Redis URL if provided
      if (process.env.REDIS_URL) {
        this.client = new Redis(process.env.REDIS_URL, {
          ...redisConfig,
          retryDelayOnFailover: 100,
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
        });
      } else {
        this.client = new Redis(redisConfig);
      }

      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis client connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting');
      });

      this.client.on('end', () => {
        logger.warn('Redis client connection ended');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.client.connect();

      // Test the connection
      await this.client.ping();
      logger.info('Redis connection established successfully');

      return this.client;
    } catch (error) {
      logger.error('Redis connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        this.isConnected = false;
        logger.info('Redis disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  getClient() {
    return this.client;
  }

  isConnectionReady() {
    return this.isConnected && this.client && this.client.status === 'ready';
  }

  // Utility methods for common operations
  async set(key, value, ttl = null) {
    try {
      if (ttl) {
        return await this.client.setex(key, ttl, JSON.stringify(value));
      }
      return await this.client.set(key, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis SET error:', error);
      throw error;
    }
  }

  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET error:', error);
      throw error;
    }
  }

  async del(key) {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error('Redis DEL error:', error);
      throw error;
    }
  }

  async exists(key) {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      throw error;
    }
  }

  async expire(key, ttl) {
    try {
      return await this.client.expire(key, ttl);
    } catch (error) {
      logger.error('Redis EXPIRE error:', error);
      throw error;
    }
  }
}

export default new RedisClient();
