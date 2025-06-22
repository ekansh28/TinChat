// server/services/redis/RedisConnection.ts - FIXED VERSION
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
      tls: {}, // Upstash requires TLS
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      enableReadyCheck: true,
      autoResubscribe: true,
      autoResendUnfulfilledCommands: true,
      keepAlive: 30000,
      family: 4, // IPv4
    });

    this.setupEventListeners();
    this.startHealthChecking();
  }

  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      this.isConnected = true;
      this.retries = 0;
      logger.info('✅ Redis connected successfully!');
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

    // Handle connection issues
    this.redis.on('node error', (err, address) => {
      logger.error(`❌ Redis node error at ${address}:`, err.message);
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
        } else {
          logger.debug(`✅ Redis ping: ${latency}ms`);
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
        this.isConnected = true;
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
      logger.info('✅ Redis connection established');
    } catch (error) {
      this.isConnected = false;
      logger.error('❌ Redis connection failed:', error);
      throw error;
    }
  }

  isRedisConnected(): boolean {
    return this.isConnected && this.redis.status === 'ready';
  }

  getRedisInstance(): Redis {
    return this.redis;
  }

  async getStats(): Promise<any> {
    try {
      if (!this.isConnected) {
        return {
          connected: false,
          status: this.redis.status,
          error: 'Not connected'
        };
      }

      const [info, keyCount, memory] = await Promise.allSettled([
        this.redis.info(),
        this.redis.dbsize(),
        this.redis.info('memory')
      ]);
      
      const serverInfo = info.status === 'fulfilled' ? this.parseInfo(info.value) : {};
      const memoryInfo = memory.status === 'fulfilled' ? this.parseInfo(memory.value) : {};
      
      return {
        connected: this.isConnected,
        status: this.redis.status,
        totalKeys: keyCount.status === 'fulfilled' ? keyCount.value : 0,
        retries: this.retries,
        memory: {
          used: memoryInfo.used_memory_human || 'unknown',
          peak: memoryInfo.used_memory_peak_human || 'unknown',
          total: memoryInfo.total_system_memory_human || 'unknown'
        },
        server: {
          version: serverInfo.redis_version || 'unknown',
          uptime: serverInfo.uptime_in_seconds || 0,
          connected_clients: serverInfo.connected_clients || 0
        },
        latency: await this.measureLatency()
      };
    } catch (error) {
      return {
        connected: false,
        status: this.redis.status,
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
        if (key && value !== undefined) {
          // Try to parse as number if possible
          const numValue = Number(value);
          parsed[key] = isNaN(numValue) ? value : numValue;
        }
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
      
      if (this.isConnected || this.redis.status !== 'end') {
        await this.redis.quit();
        logger.info('✅ Redis disconnected gracefully');
      }
      
      this.isConnected = false;
      this.connectionPromise = null;
    } catch (error) {
      logger.error('❌ Error disconnecting Redis:', error);
      // Force disconnect if graceful quit fails
      try {
        this.redis.disconnect();
      } catch (forceError) {
        logger.error('❌ Force disconnect also failed:', forceError);
      }
    }
  }

  // Additional utility methods
  async flushAll(): Promise<boolean> {
    try {
      if (!this.isConnected) return false;
      await this.redis.flushall();
      logger.warn('🗑️ Redis database flushed completely');
      return true;
    } catch (error) {
      logger.error('❌ Redis flush failed:', error);
      return false;
    }
  }

  async getKeyCount(): Promise<number> {
    try {
      if (!this.isConnected) return 0;
      return await this.redis.dbsize();
    } catch (error) {
      logger.error('❌ Key count retrieval failed:', error);
      return 0;
    }
  }

  async getMemoryUsage(): Promise<{ used: string; peak: string; total: string } | null> {
    try {
      if (!this.isConnected) return null;
      
      const info = await this.redis.info('memory');
      const memoryData = this.parseInfo(info);
      
      return {
        used: memoryData.used_memory_human || '0B',
        peak: memoryData.used_memory_peak_human || '0B',
        total: memoryData.total_system_memory_human || '0B'
      };
    } catch (error) {
      logger.error('❌ Memory usage retrieval failed:', error);
      return null;
    }
  }

  // Check if Redis is available and responding
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.isConnected) return false;
      
      const start = Date.now();
      const result = await this.redis.ping();
      const latency = Date.now() - start;
      
      return result === 'PONG' && latency < 1000; // Healthy if responds in under 1 second
    } catch {
      return false;
    }
  }
}