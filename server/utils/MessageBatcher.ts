// ===== server/utils/MessageBatcher.ts - Performance optimization =====
import { logger } from './logger';

interface QueuedMessage {
  socketId: string;
  event: string;
  data: any;
  timestamp: number;
  priority: 'low' | 'normal' | 'high';
}

export class MessageBatcher {
  private queue: QueuedMessage[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private io: any = null;
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL = 16; // ~60fps for smooth UI
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly HIGH_PRIORITY_EVENTS = new Set(['receiveMessage', 'partnerFound', 'partnerLeft']);
  
  private stats = {
    totalMessages: 0,
    batchesSent: 0,
    queueSize: 0,
    droppedMessages: 0,
    highPriorityMessages: 0
  };

  constructor(io?: any) {
    this.io = io;
    this.startBatching();
    logger.info('📦 MessageBatcher initialized');
  }

  setSocketIOInstance(io: any): void {
    this.io = io;
  }

  // ✅ FIXED: Universal findLastIndex that works with any TypeScript version
  private findLastHighPriorityIndex(): number {
    for (let i = this.queue.length - 1; i >= 0; i--) {
        if (this.queue[i] && this.queue[i]!.priority === 'high') {
          return i;
        }
    }
    return -1;
  }

  queueMessage(socketId: string, event: string, data: any, priority: 'low' | 'normal' | 'high' = 'normal'): void {
    // Handle queue overflow
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      const droppedCount = this.queue.length - Math.floor(this.MAX_QUEUE_SIZE * 0.8);
      logger.warn(`🚨 Message queue full, dropping ${droppedCount} oldest messages`);
      this.queue = this.queue.slice(-Math.floor(this.MAX_QUEUE_SIZE * 0.8));
      this.stats.droppedMessages += droppedCount;
    }

    // Auto-promote high priority events
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

    if (priority === 'high') {
      // ✅ FIXED: Use custom method instead of native findLastIndex
      const lastHighPriorityIndex = this.findLastHighPriorityIndex();
      this.queue.splice(lastHighPriorityIndex + 1, 0, queuedMessage);
      this.stats.highPriorityMessages++;
    } else {
      this.queue.push(queuedMessage);
    }

    this.stats.totalMessages++;
    this.stats.queueSize = this.queue.length;

    // Immediate flush for high priority when queue is getting full
    if (priority === 'high' && this.queue.length > this.BATCH_SIZE * 0.5) {
      this.flushQueue();
    }
  }

  sendImmediate(socketId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(socketId).emit(event, data);
      logger.debug(`⚡ Immediate send: ${event} to ${socketId}`);
    }
  }

  private startBatching(): void {
    this.batchInterval = setInterval(() => {
      this.flushQueue();
    }, this.FLUSH_INTERVAL);
  }

  private flushQueue(): void {
    if (this.queue.length === 0 || !this.io) return;

    const batchToSend = this.queue.splice(0, this.BATCH_SIZE);
    const messagesBySocket = new Map<string, Array<{ event: string; data: any }>>();

    // Group messages by socket for efficient sending
    batchToSend.forEach(message => {
      if (!messagesBySocket.has(message.socketId)) {
        messagesBySocket.set(message.socketId, []);
      }
      messagesBySocket.get(message.socketId)!.push({
        event: message.event,
        data: message.data
      });
    });

    // Send messages to each socket
    messagesBySocket.forEach((messages, socketId) => {
      if (messages.length === 1) {
        // Single message - send directly
        const { event, data } = messages[0] ?? { event: '', data: null };
        this.io.to(socketId).emit(event, data);
      } else {
        // Multiple messages - send as batch
        this.io.to(socketId).emit('batchedMessages', messages);
      }
    });

    this.stats.batchesSent++;
    this.stats.queueSize = this.queue.length;

    if (batchToSend.length > 0) {
      logger.debug(`📦 Batched ${batchToSend.length} messages to ${messagesBySocket.size} sockets`);
    }
  }

  // ✅ Enhanced statistics with more details
  getStats() {
    const priorityCounts = this.getQueueByPriority();
    const avgBatchSize = this.stats.batchesSent > 0 ? 
      (this.stats.totalMessages - this.stats.queueSize) / this.stats.batchesSent : 0;

    return {
      ...this.stats,
      avgBatchSize: Math.round(avgBatchSize * 100) / 100,
      currentQueue: priorityCounts,
      efficiency: this.stats.droppedMessages > 0 ? 
        ((this.stats.totalMessages - this.stats.droppedMessages) / this.stats.totalMessages * 100).toFixed(1) + '%' : '100%'
    };
  }

  // ✅ Compatible queue analysis using filter
  getQueueByPriority(): { high: number; normal: number; low: number } {
    return {
      high: this.queue.filter(msg => msg.priority === 'high').length,
      normal: this.queue.filter(msg => msg.priority === 'normal').length,
      low: this.queue.filter(msg => msg.priority === 'low').length
    };
  }

  // ✅ Advanced queue management
  clearOldMessages(maxAge: number = 30000): number {
    const cutoffTime = Date.now() - maxAge;
    const originalLength = this.queue.length;
    
    // Keep only messages newer than cutoff time
    this.queue = this.queue.filter(msg => msg.timestamp > cutoffTime);
    
    const removedCount = originalLength - this.queue.length;
    this.stats.queueSize = this.queue.length;
    
    if (removedCount > 0) {
      logger.debug(`🧹 Removed ${removedCount} old messages from queue`);
    }
    
    return removedCount;
  }

  // ✅ Force flush specific socket messages
  flushSocketMessages(socketId: string): number {
    const socketMessages = this.queue.filter(msg => msg.socketId === socketId);
    
    if (socketMessages.length === 0) return 0;

    // Remove from queue
    this.queue = this.queue.filter(msg => msg.socketId !== socketId);
    this.stats.queueSize = this.queue.length;

    // Send immediately if IO is available
    if (this.io) {
      socketMessages.forEach(msg => {
        this.io.to(socketId).emit(msg.event, msg.data);
      });
    }

    logger.debug(`🚀 Force flushed ${socketMessages.length} messages for socket ${socketId}`);
    return socketMessages.length;
  }

  // ✅ Health check for monitoring
  healthCheck(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (this.queue.length > this.MAX_QUEUE_SIZE * 0.8) {
      issues.push(`Queue is ${Math.round(this.queue.length / this.MAX_QUEUE_SIZE * 100)}% full`);
    }
    
    if (this.stats.droppedMessages > this.stats.totalMessages * 0.1) {
      issues.push(`High message drop rate: ${this.stats.droppedMessages} dropped`);
    }
    
    if (!this.io) {
      issues.push('Socket.IO instance not connected');
    }
    
    const oldMessages = this.queue.filter(msg => Date.now() - msg.timestamp > 30000).length;
    if (oldMessages > 0) {
      issues.push(`${oldMessages} messages older than 30 seconds in queue`);
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  async destroy(): Promise<void> {
    return new Promise((resolve) => {
      if (this.batchInterval) {
        clearInterval(this.batchInterval);
        this.batchInterval = null;
      }
      
      // Final flush
      this.flushQueue();
      
      setTimeout(() => {
        const remainingMessages = this.queue.length;
        this.queue = [];
        this.stats.queueSize = 0;
        
        if (remainingMessages > 0) {
          logger.warn(`📦 Message batcher destroyed with ${remainingMessages} undelivered messages`);
        } else {
          logger.info('📦 Message batcher destroyed cleanly');
        }
        
        resolve();
      }, this.FLUSH_INTERVAL * 2);
    });
  }
}