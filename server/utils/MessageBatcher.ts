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
    queueSize: 0
  };

  constructor(io?: any) {
    this.io = io;
    this.startBatching();
    logger.info('📦 MessageBatcher initialized');
  }

  setSocketIOInstance(io: any): void {
    this.io = io;
  }

  queueMessage(socketId: string, event: string, data: any, priority: 'low' | 'normal' | 'high' = 'normal'): void {
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      logger.warn(`🚨 Message queue full, dropping oldest messages`);
      this.queue = this.queue.slice(-this.MAX_QUEUE_SIZE * 0.8);
    }

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
      const lastHighPriorityIndex = this.queue.findLastIndex(msg => msg.priority === 'high');
      this.queue.splice(lastHighPriorityIndex + 1, 0, queuedMessage);
    } else {
      this.queue.push(queuedMessage);
    }

    this.stats.totalMessages++;
    this.stats.queueSize = this.queue.length;

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

    batchToSend.forEach(message => {
      if (!messagesBySocket.has(message.socketId)) {
        messagesBySocket.set(message.socketId, []);
      }
      messagesBySocket.get(message.socketId)!.push({
        event: message.event,
        data: message.data
      });
    });

    messagesBySocket.forEach((messages, socketId) => {
      if (messages.length === 1) {
        const { event, data } = messages[0];
        this.io.to(socketId).emit(event, data);
      } else {
        this.io.to(socketId).emit('batchedMessages', messages);
      }
    });

    this.stats.batchesSent++;
    this.stats.queueSize = this.queue.length;

    if (batchToSend.length > 0) {
      logger.debug(`📦 Batched ${batchToSend.length} messages to ${messagesBySocket.size} sockets`);
    }
  }

  getStats() {
    return { ...this.stats };
  }

  destroy(): Promise<void> {
    return new Promise((resolve) => {
      if (this.batchInterval) {
        clearInterval(this.batchInterval);
        this.batchInterval = null;
      }
      this.flushQueue();
      setTimeout(() => {
        this.queue = [];
        logger.info('📦 Message batcher destroyed');
        resolve();
      }, this.FLUSH_INTERVAL * 2);
    });
  }
}

