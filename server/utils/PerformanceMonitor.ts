// server/utils/PerformanceMonitor.ts
import { logger } from './logger';

interface PerformanceMetrics {
  // Connection metrics
  totalConnections: number;
  totalDisconnections: number;
  currentConnections: number;
  peakConnections: number;
  
  // Message metrics
  totalMessages: number;
  messagesPerSecond: number;
  averageMessageSize: number;
  
  // Match metrics
  totalMatches: number;
  averageMatchTime: number;
  successfulMatches: number;
  failedMatches: number;
  
  // System metrics
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  uptime: number;
  
  // Response time metrics
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  
  // Error metrics
  totalErrors: number;
  errorRate: number;
  
  // Custom metrics
  customMetrics: { [key: string]: number };
}

interface ResponseTimeRecord {
  timestamp: number;
  duration: number;
  operation: string;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private startTime: number;
  private responseTimeHistory: ResponseTimeRecord[] = [];
  private messageHistory: Array<{ timestamp: number; size: number }> = [];
  private errorHistory: Array<{ timestamp: number; error: string }> = [];
  private matchStartTimes: Map<string, number> = new Map();
  
  private readonly MAX_HISTORY_SIZE = 1000;
  public readonly isEnabled: boolean;

  constructor() {
    this.startTime = Date.now();
    this.isEnabled = process.env.PERFORMANCE_MONITORING !== 'false';
    
    this.metrics = {
      totalConnections: 0,
      totalDisconnections: 0,
      currentConnections: 0,
      peakConnections: 0,
      totalMessages: 0,
      messagesPerSecond: 0,
      averageMessageSize: 0,
      totalMatches: 0,
      averageMatchTime: 0,
      successfulMatches: 0,
      failedMatches: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: 0,
      uptime: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      totalErrors: 0,
      errorRate: 0,
      customMetrics: {}
    };

    if (this.isEnabled) {
      this.startPeriodicCollection();
      logger.info('📊 Performance monitoring enabled');
    }
  }

  // Connection tracking
  recordConnection(): void {
    if (!this.isEnabled) return;
    
    this.metrics.totalConnections++;
    this.metrics.currentConnections++;
    
    if (this.metrics.currentConnections > this.metrics.peakConnections) {
      this.metrics.peakConnections = this.metrics.currentConnections;
    }
  }

  recordDisconnection(): void {
    if (!this.isEnabled) return;
    
    this.metrics.totalDisconnections++;
    this.metrics.currentConnections = Math.max(0, this.metrics.currentConnections - 1);
  }

  // Message tracking
  recordMessage(messageSize: number = 0): void {
    if (!this.isEnabled) return;
    
    this.metrics.totalMessages++;
    
    if (messageSize > 0) {
      this.messageHistory.push({
        timestamp: Date.now(),
        size: messageSize
      });
      
      // Cleanup old message history
      this.cleanupHistory(this.messageHistory);
    }
  }

  // Match tracking
  startMatchTimer(userId: string): void {
    if (!this.isEnabled) return;
    this.matchStartTimes.set(userId, Date.now());
  }

  recordMatch(userId: string, successful: boolean = true): void {
    if (!this.isEnabled) return;
    
    this.metrics.totalMatches++;
    
    if (successful) {
      this.metrics.successfulMatches++;
      
      // Calculate match time if we have a start time
      const startTime = this.matchStartTimes.get(userId);
      if (startTime) {
        const matchTime = Date.now() - startTime;
        this.updateAverageMatchTime(matchTime);
        this.matchStartTimes.delete(userId);
      }
    } else {
      this.metrics.failedMatches++;
    }
  }

  // Response time tracking
  recordResponseTime(operation: string, duration: number): void {
    if (!this.isEnabled) return;
    
    this.responseTimeHistory.push({
      timestamp: Date.now(),
      duration,
      operation
    });
    
    this.cleanupHistory(this.responseTimeHistory);
    this.calculateResponseTimeMetrics();
  }

  // Error tracking
  recordError(error: string): void {
    if (!this.isEnabled) return;
    
    this.metrics.totalErrors++;
    this.errorHistory.push({
      timestamp: Date.now(),
      error
    });
    
    this.cleanupHistory(this.errorHistory);
  }

  // Custom metrics
  setCustomMetric(key: string, value: number): void {
    if (!this.isEnabled) return;
    this.metrics.customMetrics[key] = value;
  }

  incrementCustomMetric(key: string, increment: number = 1): void {
    if (!this.isEnabled) return;
    this.metrics.customMetrics[key] = (this.metrics.customMetrics[key] || 0) + increment;
  }

  // Performance measurement utilities
  measureAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    if (!this.isEnabled) return fn();
    
    const startTime = process.hrtime.bigint();
    
    return fn().then(
      (result) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
        this.recordResponseTime(operation, duration);
        return result;
      },
      (error) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000;
        this.recordResponseTime(operation, duration);
        this.recordError(`${operation}: ${error.message}`);
        throw error;
      }
    );
  }

  measureSync<T>(operation: string, fn: () => T): T {
    if (!this.isEnabled) return fn();
    
    const startTime = process.hrtime.bigint();
    
    try {
      const result = fn();
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      this.recordResponseTime(operation, duration);
      return result;
    } catch (error: any) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      this.recordResponseTime(operation, duration);
      this.recordError(`${operation}: ${error.message}`);
      throw error;
    }
  }

  // Statistics calculation
  private calculateResponseTimeMetrics(): void {
    if (this.responseTimeHistory.length === 0) return;
    
    const durations = this.responseTimeHistory.map(r => r.duration).sort((a, b) => a - b);
    
    this.metrics.averageResponseTime = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    
    this.metrics.p95ResponseTime = durations[Math.min(p95Index, durations.length - 1)];
    this.metrics.p99ResponseTime = durations[Math.min(p99Index, durations.length - 1)];
  }

  private updateAverageMatchTime(newMatchTime: number): void {
    const totalMatches = this.metrics.successfulMatches;
    if (totalMatches === 1) {
      this.metrics.averageMatchTime = newMatchTime;
    } else {
      this.metrics.averageMatchTime = 
        ((this.metrics.averageMatchTime * (totalMatches - 1)) + newMatchTime) / totalMatches;
    }
  }

  private calculateMessagesPerSecond(): void {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    const recentMessages = this.messageHistory.filter(m => m.timestamp > oneSecondAgo);
    this.metrics.messagesPerSecond = recentMessages.length;
  }

  private calculateErrorRate(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentErrors = this.errorHistory.filter(e => e.timestamp > oneMinuteAgo);
    const recentMessages = this.messageHistory.filter(m => m.timestamp > oneMinuteAgo);
    
    const totalOperations = recentMessages.length + recentErrors.length;
    this.metrics.errorRate = totalOperations > 0 ? (recentErrors.length / totalOperations) * 100 : 0;
  }

  private updateSystemMetrics(): void {
    this.metrics.memoryUsage = process.memoryUsage();
    this.metrics.uptime = Date.now() - this.startTime;
    
    // Simple CPU usage estimation (this is basic - in production you might want something more sophisticated)
    const usage = process.cpuUsage();
    this.metrics.cpuUsage = (usage.user + usage.system) / 1000; // Convert to milliseconds
  }

  private cleanupHistory<T extends { timestamp: number }>(history: T[]): void {
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.splice(0, history.length - this.MAX_HISTORY_SIZE);
    }
    
    // Also remove entries older than 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const firstRecentIndex = history.findIndex(item => item.timestamp > oneHourAgo);
    if (firstRecentIndex > 0) {
      history.splice(0, firstRecentIndex);
    }
  }

  private startPeriodicCollection(): void {
    // Update metrics every 5 seconds
    setInterval(() => {
      this.updateSystemMetrics();
      this.calculateMessagesPerSecond();
      this.calculateErrorRate();
    }, 5000);

    // Detailed logging every 30 seconds
    setInterval(() => {
      this.logPerformanceReport();
    }, 30000);

    // Cleanup old data every 10 minutes
    setInterval(() => {
      this.cleanupHistory(this.responseTimeHistory);
      this.cleanupHistory(this.messageHistory);
      this.cleanupHistory(this.errorHistory);
    }, 10 * 60 * 1000);
  }

  private logPerformanceReport(): void {
    const report = {
      connections: {
        current: this.metrics.currentConnections,
        peak: this.metrics.peakConnections,
        total: this.metrics.totalConnections
      },
      messages: {
        total: this.metrics.totalMessages,
        perSecond: this.metrics.messagesPerSecond
      },
      matches: {
        total: this.metrics.totalMatches,
        successful: this.metrics.successfulMatches,
        averageTime: `${this.metrics.averageMatchTime.toFixed(2)}ms`
      },
      performance: {
        avgResponseTime: `${this.metrics.averageResponseTime.toFixed(2)}ms`,
        p95ResponseTime: `${this.metrics.p95ResponseTime.toFixed(2)}ms`,
        errorRate: `${this.metrics.errorRate.toFixed(2)}%`
      },
      system: {
        memory: `${(this.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        uptime: `${(this.metrics.uptime / 1000 / 60).toFixed(2)}min`
      }
    };

    logger.info('📊 Performance Report:', report);
  }

  // Public API
  getStats(): PerformanceMetrics {
    if (!this.isEnabled) {
      return { ...this.metrics, totalConnections: 0, totalMessages: 0 };
    }
    
    // Update real-time metrics before returning
    this.updateSystemMetrics();
    this.calculateMessagesPerSecond();
    this.calculateErrorRate();
    
    return { ...this.metrics };
  }

  getDetailedStats() {
    if (!this.isEnabled) return null;
    
    const stats = this.getStats();
    
    return {
      ...stats,
      responseTimeHistory: [...this.responseTimeHistory.slice(-100)], // Last 100 operations
      topErrors: this.getTopErrors(),
      operationBreakdown: this.getOperationBreakdown(),
      memoryBreakdown: {
        heapUsed: `${(stats.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(stats.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        external: `${(stats.memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
        rss: `${(stats.memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`
      }
    };
  }

  private getTopErrors(): Array<{ error: string; count: number }> {
    const errorCounts = new Map<string, number>();
    
    this.errorHistory.forEach(({ error }) => {
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    });
    
    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getOperationBreakdown(): Array<{ operation: string; avgTime: number; count: number }> {
    const operationStats = new Map<string, { totalTime: number; count: number }>();
    
    this.responseTimeHistory.forEach(({ operation, duration }) => {
      const stats = operationStats.get(operation) || { totalTime: 0, count: 0 };
      stats.totalTime += duration;
      stats.count += 1;
      operationStats.set(operation, stats);
    });
    
    return Array.from(operationStats.entries())
      .map(([operation, stats]) => ({
        operation,
        avgTime: stats.totalTime / stats.count,
        count: stats.count
      }))
      .sort((a, b) => b.count - a.count);
  }

  // Reset metrics (useful for testing)
  reset(): void {
    this.metrics = {
      totalConnections: 0,
      totalDisconnections: 0,
      currentConnections: 0,
      peakConnections: 0,
      totalMessages: 0,
      messagesPerSecond: 0,
      averageMessageSize: 0,
      totalMatches: 0,
      averageMatchTime: 0,
      successfulMatches: 0,
      failedMatches: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: 0,
      uptime: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      totalErrors: 0,
      errorRate: 0,
      customMetrics: {}
    };
    
    this.responseTimeHistory = [];
    this.messageHistory = [];
    this.errorHistory = [];
    this.matchStartTimes.clear();
    this.startTime = Date.now();
    
    logger.info('📊 Performance metrics reset');
  }
}