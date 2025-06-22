// server/services/redis/RedisConfig.ts
export class RedisConfig {
  static readonly TTL = {
    PROFILE: 7 * 24 * 60 * 60,      // 7 days
    PROFILE_SHORT: 5 * 60,          // 5 minutes (active users)
    FRIENDS: 60,                    // 1 minute
    ONLINE_STATUS: 30,              // 30 seconds
    CHAT_HISTORY: 30 * 60,          // 30 minutes
    TYPING: 5,                      // 5 seconds
    QUEUE: 10 * 60,                 // 10 minutes
    SERVER_STATS: 60,               // 1 minute
    RATE_LIMIT: 60,                 // 1 minute
    SESSION: 2 * 60 * 60,           // 2 hours
  };

  static readonly PREFIXES = {
    PROFILE: 'profile',
    FRIENDS: 'friends',
    ONLINE: 'online',
    CHAT: 'chat',
    QUEUE: 'queue',
    STATS: 'stats',
    RATE: 'rate',
    SESSION: 'session',
    TYPING: 'typing'
  };

  static buildKey(...parts: string[]): string {
    return parts.filter(Boolean).join(':');
  }
  
}