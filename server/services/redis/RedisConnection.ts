
// server/services/redis/RedisConnection.ts - ENHANCED WITH BETTER ERROR HANDLING
import Redis from 'ioredis';
import { logger } from '../../utils/logger';

export class RedisConnection {
  private redis: Redis;
  private isConnected: boolean = false;
  private retries: number = 0;
  private readonly MAX_RETRIES = 5;
  private connectionPromise: Promise<void> | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(redisUrl: string, redisToken: string) {
    this.redis = new Redis(redisUrl, {
      password: redisToken,
      tls: {},
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      keepAlive: 30000,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      autoResubscribe: true,
      autoResendUnfulfilledCommands: true
    });

    this.setupEventListeners();
    this.startHealthChecking();
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
      logger.error('❌ Redis error:', err.message);
      
      if (this.retries >= this.MAX_RETRIES) {
        logger.error(`🚨 Redis failed after ${this.MAX_RETRIES} retries`);
      }
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      logger.info('🚀 Redis ready for operations');
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      logger.warn('⚠️ Redis connection closed');
    });

    this.redis.on('reconnecting', (delay: number) => {
      logger.info(`🔄 Redis reconnecting in ${delay}ms (attempt ${this.retries + 1})`);
    });

    this.redis.on('end', () => {
      this.isConnected = false;
      logger.warn('📡 Redis connection ended');
    });
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isConnected) return;
      
      try {
        const start = Date.now();
        await this.redis.ping();
        const latency = Date.now() - start;
        
        if (latency > 1000) {
          logger.warn(`⚠️ Redis ping slow: ${latency}ms`);
        }
      } catch (error) {
        logger.error('❌ Redis health check failed:', error);
        this.isConnected = false;
      }
    }, 30000); // Every 30 seconds
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.connectionPromise) {
        this.connectionPromise = this.ensureConnection();
      }
      
      await this.connectionPromise;
      
      const startTime = Date.now();
      const result = await this.redis.ping();
      const latency = Date.now() - startTime;
      
      if (result === 'PONG' && latency < 2000) {
        logger.debug(`✅ Redis ping successful (${latency}ms)`);
        return true;
      }
      
      logger.warn(`⚠️ Redis ping slow or failed (${latency}ms, result: ${result})`);
      return false;
    } catch (error) {
      logger.error('❌ Redis connection test failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  private async ensureConnection(): Promise<void> {
    if (this.isConnected) return;
    
    try {
      await this.redis.connect();
      this.isConnected = true;
    } catch (error) {
      this.isConnected = false;
      throw error;
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
      if (!this.isConnected) {
        return {
          connected: false,
          error: 'Not connected'
        };
      }

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
        server: this.parseInfo(info),
        latency: await this.measureLatency()
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async measureLatency(): Promise<number> {
    try {
      const start = Date.now();
      await this.redis.ping();
      return Date.now() - start;
    } catch {
      return -1;
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
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      if (this.isConnected) {
        await this.redis.quit();
        logger.info('✅ Redis disconnected gracefully');
      }
      
      this.isConnected = false;
      this.connectionPromise = null;
    } catch (error) {
      logger.error('❌ Error disconnecting Redis:', error);
    }
  }
}


