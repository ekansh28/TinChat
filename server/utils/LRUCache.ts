// server/utils/LRUCache.ts
interface CacheNode<T> {
  key: string;
  data: T;
  timestamp: number;
  prev: CacheNode<T> | null;
  next: CacheNode<T> | null;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  capacity: number;
}

export class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, CacheNode<T>>;
  private head: CacheNode<T> | null = null;
  private tail: CacheNode<T> | null = null;
  private stats: CacheStats;

  constructor(capacity: number = 100) {
    this.capacity = capacity;
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      capacity: this.capacity
    };
  }

  get(key: string): T | null {
    const node = this.cache.get(key);
    
    if (node) {
      // Move to front (most recently used)
      this.moveToFront(node);
      this.stats.hits++;
      return node.data;
    }
    
    this.stats.misses++;
    return null;
  }

  set(key: string, data: T): void {
    this.stats.sets++;
    
    const existingNode = this.cache.get(key);
    
    if (existingNode) {
      // Update existing node
      existingNode.data = data;
      existingNode.timestamp = Date.now();
      this.moveToFront(existingNode);
      return;
    }
    
    // Create new node
    const newNode: CacheNode<T> = {
      key,
      data,
      timestamp: Date.now(),
      prev: null,
      next: null
    };
    
    this.cache.set(key, newNode);
    this.addToFront(newNode);
    this.stats.size++;
    
    // Check if we need to evict
    if (this.cache.size > this.capacity) {
      this.evictLRU();
    }
  }

  delete(key: string): boolean {
    const node = this.cache.get(key);
    
    if (node) {
      this.cache.delete(key);
      this.removeNode(node);
      this.stats.deletes++;
      this.stats.size--;
      return true;
    }
    
    return false;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.stats.size = 0;
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    const keys: string[] = [];
    let current = this.head;
    
    while (current) {
      keys.push(current.key);
      current = current.next;
    }
    
    return keys;
  }

  values(): T[] {
    const values: T[] = [];
    let current = this.head;
    
    while (current) {
      values.push(current.data);
      current = current.next;
    }
    
    return values;
  }

  entries(): Array<{ key: string; data: T; timestamp: number }> {
    const entries: Array<{ key: string; data: T; timestamp: number }> = [];
    let current = this.head;
    
    while (current) {
      entries.push({
        key: current.key,
        data: current.data,
        timestamp: current.timestamp
      });
      current = current.next;
    }
    
    return entries;
  }

  // Get cache statistics
  getStats(): CacheStats {
    return { ...this.stats };
  }

  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  // Clean up expired entries
  cleanup(maxAge?: number): number {
    if (!maxAge) return 0;
    
    const cutoffTime = Date.now() - maxAge;
    const keysToDelete: string[] = [];
    
    // Find expired entries
    for (const [key, node] of this.cache.entries()) {
      if (node.timestamp < cutoffTime) {
        keysToDelete.push(key);
      }
    }
    
    // Remove expired entries
    keysToDelete.forEach(key => this.delete(key));
    
    return keysToDelete.length;
  }

  // Resize the cache
  resize(newCapacity: number): void {
    this.capacity = newCapacity;
    this.stats.capacity = newCapacity;
    
    // Evict items if new capacity is smaller
    while (this.cache.size > this.capacity) {
      this.evictLRU();
    }
  }

  // Peek at a value without affecting its position
  peek(key: string): T | null {
    const node = this.cache.get(key);
    return node ? node.data : null;
  }

  // Get the least recently used item
  getLRU(): { key: string; data: T } | null {
    if (this.tail) {
      return {
        key: this.tail.key,
        data: this.tail.data
      };
    }
    return null;
  }

  // Get the most recently used item
  getMRU(): { key: string; data: T } | null {
    if (this.head) {
      return {
        key: this.head.key,
        data: this.head.data
      };
    }
    return null;
  }

  private moveToFront(node: CacheNode<T>): void {
    if (node === this.head) return;
    
    this.removeNode(node);
    this.addToFront(node);
  }

  private addToFront(node: CacheNode<T>): void {
    node.prev = null;
    node.next = this.head;
    
    if (this.head) {
      this.head.prev = node;
    }
    
    this.head = node;
    
    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: CacheNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private evictLRU(): void {
    if (this.tail) {
      const keyToEvict = this.tail.key;
      this.cache.delete(keyToEvict);
      this.removeNode(this.tail);
      this.stats.evictions++;
      this.stats.size--;
    }
  }

  // For debugging and monitoring
  toString(): string {
    const entries = this.entries();
    const recent = entries.slice(0, 5).map(e => e.key).join(', ');
    const stats = this.getStats();
    
    return `LRUCache(size: ${stats.size}/${stats.capacity}, hitRate: ${this.getHitRate().toFixed(1)}%, recent: [${recent}])`;
  }

  // Get memory usage estimation
  getMemoryUsage(): { estimatedBytes: number; averageKeySize: number; averageDataSize: number } {
    if (this.cache.size === 0) {
      return { estimatedBytes: 0, averageKeySize: 0, averageDataSize: 0 };
    }

    // Rough estimation - this is not precise but gives an idea
    const entries = this.entries();
    const totalKeySize = entries.reduce((sum, entry) => sum + entry.key.length * 2, 0); // Assume 2 bytes per char
    const averageKeySize = totalKeySize / entries.length;
    
    // Estimate data size (this is very rough)
    const averageDataSize = 100; // Placeholder - actual size depends on data type
    
    const estimatedBytes = (averageKeySize + averageDataSize + 64) * this.cache.size; // 64 bytes overhead per node
    
    return {
      estimatedBytes,
      averageKeySize,
      averageDataSize
    };
  }
}