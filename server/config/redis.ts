// src/lib/redis.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.UPSTASH_REDIS_REST_URL!, {
  password: process.env.UPSTASH_REDIS_REST_TOKEN,
  tls: {} // Upstash requires TLS
});

export default redis;
