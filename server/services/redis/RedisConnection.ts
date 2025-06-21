// server/services/redis/RedisConnection.ts
import Redis from 'ioredis';
import { logger } from '../../utils/logger';

export class RedisConnection {
  private redis: Redis;
  private isConnected: boolean = false;
  private retries: number = 0;
  private readonly MAX_RETRIES = 5;

  constructor(redisUrl: string, redisToken: string) {
    this.redis = new Redis(redisUrl, {
      password: redisToken,
      tls: {},
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      keepAlive: 30000
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      this.isConnected = true;
      this.retries = 0;
      logger.info('✅ Redis connected successfully');
    });

    this.redis.on('error', (err) => {
      this.isConnected = false;
      this.retries++;
      logger.error('❌ Redis error:', err);
      
      if (this.retries >= this.MAX_RETRIES) {
        logger.error(`🚨 Redis failed after ${this.MAX_RETRIES} retries`);
      }
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      logger.info('🚀 Redis ready');
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      logger.warn('⚠️ Redis connection closed');
    });

    this.redis.on('reconnecting', (delay: number) => {
      logger.info(`🔄 Redis reconnecting in ${delay}ms`);
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const startTime = Date.now();
      const result = await this.redis.ping();
      const latency = Date.now() - startTime;
      
      if (result === 'PONG' && latency < 1000) {
        logger.debug(`✅ Redis ping successful (${latency}ms)`);
        return true;
      }
      
      logger.warn(`⚠️ Redis ping slow or failed (${latency}ms)`);
      return false;
    } catch (error) {
      logger.error('❌ Redis connection test failed:', error);
      return false;
    }
  }

  isRedisConnected(): boolean {
    return this.isConnected;
  }

  getRedisInstance(): Redis {
    return this.redis;
  }

  async getStats(): Promise<any> {
    try {
      const [info, keyCount, memory] = await Promise.all([
        this.redis.info(),
        this.redis.dbsize(),
        this.redis.info('memory')
      ]);
      
      return {
        connected: this.isConnected,
        totalKeys: keyCount,
        retries: this.retries,
        memory: this.parseInfo(memory),
        server: this.parseInfo(info)
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private parseInfo(info: string): any {
    const lines = info.split('\r\n');
    const parsed: any = {};
    
    lines.forEach(line => {
      if (line.includes(':') && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        parsed[key] = isNaN(Number(value)) ? value : Number(value);
      }
    });
    
    return parsed;
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('✅ Redis disconnected gracefully');
    } catch (error) {
      logger.error('❌ Error disconnecting Redis:', error);
    }
  }
}