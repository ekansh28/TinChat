// ===== server/utils/logger.ts =====
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: any;
  duration?: number;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

class Logger {
  private logHistory: LogEntry[] = [];

  private shouldLog(level: LogLevel): boolean {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    return levels[level] <= levels[currentLevel];
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const entry = { timestamp, level, message, meta };
    
    this.logHistory.push(entry);
    if (this.logHistory.length > 1000) {
      this.logHistory = this.logHistory.slice(-500);
    }

    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[${timestamp}] ${level.toUpperCase()}: ${message}`, meta || '');
  }

  error(message: string, meta?: any): void { this.log('error', message, meta); }
  warn(message: string, meta?: any): void { this.log('warn', message, meta); }
  info(message: string, meta?: any): void { this.log('info', message, meta); }
  debug(message: string, meta?: any): void { this.log('debug', message, meta); }

  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logHistory.slice(-count);
  }

  getStats() {
    return { totalLogs: this.logHistory.length };
  }
}

export const logger = new Logger();

// ===== server/utils/LRUCache.ts =====
interface CacheNode<T> {
  key: string;
  data: T;
  timestamp: number;
  prev: CacheNode<T> | null;
  next: CacheNode<T> | null;
}

export class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, CacheNode<T>>;
  private head: CacheNode<T> | null = null;
  private tail: CacheNode<T> | null = null;
  private hits = 0;
  private misses = 0;

  constructor(capacity: number = 100) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: string): T | null {
    const node = this.cache.get(key);
    if (node) {
      this.moveToFront(node);
      this.hits++;
      return node.data;
    }
    this.misses++;
    return null;
  }

  set(key: string, data: T): void {
    const existingNode = this.cache.get(key);
    if (existingNode) {
      existingNode.data = data;
      existingNode.timestamp = Date.now();
      this.moveToFront(existingNode);
      return;
    }

    const newNode: CacheNode<T> = {
      key, data, timestamp: Date.now(), prev: null, next: null
    };

    this.cache.set(key, newNode);
    this.addToFront(newNode);

    if (this.cache.size > this.capacity) {
      this.evictLRU();
    }
  }

  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (node) {
      this.cache.delete(key);
      this.removeNode(node);
      return true;
    }
    return false;
  }

  private moveToFront(node: CacheNode<T>): void {
    if (node === this.head) return;
    this.removeNode(node);
    this.addToFront(node);
  }

  private addToFront(node: CacheNode<T>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private removeNode(node: CacheNode<T>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
  }

  private evictLRU(): void {
    if (this.tail) {
      this.cache.delete(this.tail.key);
      this.removeNode(this.tail);
    }
  }

  size(): number { return this.cache.size; }
  clear(): void { this.cache.clear(); this.head = null; this.tail = null; }
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }
}
