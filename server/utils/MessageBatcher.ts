// server/utils/MessageBatcher.ts
import { logger } from './logger';

interface QueuedMessage {
  socketId: string;
  event: string;
  data: any;
  timestamp: number;
  priority: 'low' | 'normal' | 'high';
}

interface BatchStats {
  totalMessages: number;
  batchesSent: number;
  averageBatchSize: number;
  lastBatchTime: number;
  queueSize: number;
}

export class MessageBatcher {
  private queue: QueuedMessage[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private io: any = null; // Add io instance property
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL = 16; // ~60fps for smooth UI
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly HIGH_PRIORITY_EVENTS = new Set(['receiveMessage', 'partnerFound', 'partnerLeft']);
  
  // Statistics
  private stats: BatchStats = {
    totalMessages: 0,
    batchesSent: 0,
    averageBatchSize: 0,
    lastBatchTime: 0,
    queueSize: 0
  };

  constructor(io?: any) {
    this.io = io; // Accept io instance in constructor
    this.startBatching();
  }

    // Add method to set io instance
  setSocketIOInstance(io: any): void {
    this.io = io;
  }


  queueMessage(socketId: string, event: string, data: any, priority: 'low' | 'normal' | 'high' = 'normal'): void {
    // Check queue size limit
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      logger.warn(`🚨 Message queue full, dropping oldest messages`);
      this.queue = this.queue.slice(-this.MAX_QUEUE_SIZE * 0.8); // Keep 80% of queue
    }

    // Determine priority based on event type
    if (this.HIGH_PRIORITY_EVENTS.has(event)) {
      priority = 'high';
    }

    const queuedMessage: QueuedMessage = {
      socketId,
      event,
      data,
      timestamp: Date.now(),
      priority
    };

    // Insert based on priority
    if (priority === 'high') {
      // Find the last high priority message and insert after it
      const lastHighPriorityIndex = this.queue.findLastIndex(msg => msg.priority === 'high');
      this.queue.splice(lastHighPriorityIndex + 1, 0, queuedMessage);
    } else {
      this.queue.push(queuedMessage);
    }

    this.stats.totalMessages++;
    this.stats.queueSize = this.queue.length;

    // For high priority messages, flush immediately if queue is getting large
    if (priority === 'high' && this.queue.length > this.BATCH_SIZE * 0.5) {
      this.flushQueue();
    }
  }

  // Immediate send for critical messages
  sendImmediate(socketId: string, event: string, data: any): void {
    const io = this.getSocketIOInstance();
    if (io) {
      io.to(socketId).emit(event, data);
      logger.debug(`⚡ Immediate send: ${event} to ${socketId}`);
    }
  }

  private startBatching(): void {
    this.batchInterval = setInterval(() => {
      this.flushQueue();
    }, this.FLUSH_INTERVAL);

    logger.info(`📦 Message batching started (${this.FLUSH_INTERVAL}ms interval, ${this.BATCH_SIZE} batch size)`);
  }

  private flushQueue(): void {
    if (this.queue.length === 0) return;

    const io = this.getSocketIOInstance();
    if (!io) return;

    const batchToSend = this.queue.splice(0, this.BATCH_SIZE);
    const now = Date.now();

    // Group messages by socket ID for efficient sending
    const messagesBySocket = new Map<string, Array<{ event: string; data: any }>>();

    batchToSend.forEach(message => {
      if (!messagesBySocket.has(message.socketId)) {
        messagesBySocket.set(message.socketId, []);
      }
      messagesBySocket.get(message.socketId)!.push({
        event: message.event,
        data: message.data
      });
    });

    // Send batched messages
    messagesBySocket.forEach((messages, socketId) => {
      if (messages.length === 1) {
        // Single message - send directly
        const { event, data } = messages[0];
        io.to(socketId).emit(event, data);
      } else {
        // Multiple messages - send as batch
        io.to(socketId).emit('batchedMessages', messages);
      }
    });

    // Update statistics
    this.stats.batchesSent++;
    this.stats.lastBatchTime = now;
    this.stats.queueSize = this.queue.length;
    
    const totalBatchedMessages = this.stats.batchesSent * this.stats.averageBatchSize + batchToSend.length;
    this.stats.averageBatchSize = totalBatchedMessages / this.stats.batchesSent;

    if (batchToSend.length > 0) {
      logger.debug(`📦 Batched ${batchToSend.length} messages to ${messagesBySocket.size} sockets`);
    }

    // Check for old messages in queue
    this.cleanupOldMessages();
  }

  private cleanupOldMessages(): void {
    const cutoffTime = Date.now() - 5000; // Remove messages older than 5 seconds
    const originalLength = this.queue.length;
    
    this.queue = this.queue.filter(message => message.timestamp > cutoffTime);
    
    const removedCount = originalLength - this.queue.length;
    if (removedCount > 0) {
      logger.warn(`🧹 Removed ${removedCount} stale messages from batch queue`);
      this.stats.queueSize = this.queue.length;
    }
  }

    private getSocketIOInstance(): any {
    // Return the injected io instance
    if (this.io) {
      return this.io;
    }
    
    logger.error('Socket.IO instance not available for message batching');
    return null;
  }
  // Queue management
  clearQueue(): number {
    const clearedCount = this.queue.length;
    this.queue = [];
    this.stats.queueSize = 0;
    logger.info(`🧹 Cleared message queue (${clearedCount} messages)`);
    return clearedCount;
  }

  // Priority queue operations
  promoteMessage(predicate: (msg: QueuedMessage) => boolean): number {
    let promotedCount = 0;
    const promotedMessages: QueuedMessage[] = [];
    
    this.queue = this.queue.filter(message => {
      if (predicate(message)) {
        message.priority = 'high';
        promotedMessages.push(message);
        promotedCount++;
        return false;
      }
      return true;
    });
    
    // Add promoted messages to the front of the queue
    this.queue.unshift(...promotedMessages);
    
    return promotedCount;
  }

  // Statistics and monitoring
  getStats(): BatchStats {
    return { ...this.stats };
  }

  getQueueSnapshot(): QueuedMessage[] {
    return [...this.queue];
  }

  // Performance tuning
  adjustBatchSize(newSize: number): void {
    if (newSize > 0 && newSize <= 200) {
      // @ts-ignore - We're modifying a readonly property for configuration
      this.BATCH_SIZE = newSize;
      logger.info(`📦 Batch size adjusted to ${newSize}`);
    }
  }

  adjustFlushInterval(newInterval: number): void {
    if (newInterval >= 1 && newInterval <= 1000) {
      if (this.batchInterval) {
        clearInterval(this.batchInterval);
      }
      
      // @ts-ignore - We're modifying a readonly property for configuration
      this.FLUSH_INTERVAL = newInterval;
      this.startBatching();
      
      logger.info(`📦 Flush interval adjusted to ${newInterval}ms`);
    }
  }

  // Health check
  isHealthy(): boolean {
    const queueFull = this.queue.length >= this.MAX_QUEUE_SIZE * 0.8;
    const oldestMessage = this.queue.length > 0 ? this.queue[0] : null;
    const hasStaleMessages = oldestMessage && (Date.now() - oldestMessage.timestamp) > 10000; // 10 seconds
    
    return !queueFull && !hasStaleMessages;
  }

  // Graceful shutdown
  destroy(): Promise<void> {
    return new Promise((resolve) => {
      if (this.batchInterval) {
        clearInterval(this.batchInterval);
        this.batchInterval = null;
      }
      
      // Flush remaining messages
      this.flushQueue();
      
      // Wait a bit for final flush
      setTimeout(() => {
        this.clearQueue();
        logger.info('📦 Message batcher destroyed');
        resolve();
      }, this.FLUSH_INTERVAL * 2);
    });
  }
}