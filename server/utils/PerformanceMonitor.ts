// ===== server/utils/PerformanceMonitor.ts - Monitoring =====
export class PerformanceMonitor {
  private metrics = {
    totalConnections: 0,
    totalDisconnections: 0,
    currentConnections: 0,
    peakConnections: 0,
    totalMessages: 0,
    messagesPerSecond: 0,
    totalMatches: 0,
    successfulMatches: 0,
    failedMatches: 0,
    memoryUsage: process.memoryUsage(),
    averageResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    totalErrors: 0,
    errorRate: 0,
  };

  private startTime: number;
  private responseTimeHistory: Array<{ timestamp: number; duration: number }> = [];
  private messageHistory: Array<{ timestamp: number }> = [];
  private errorHistory: Array<{ timestamp: number }> = [];
  public readonly isEnabled: boolean;

  constructor() {
    this.startTime = Date.now();
    this.isEnabled = process.env.PERFORMANCE_MONITORING !== 'false';
    
    if (this.isEnabled) {
      this.startPeriodicCollection();
      logger.info('📊 Performance monitoring enabled');
    }
  }

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

  recordMessage(): void {
    if (!this.isEnabled) return;
    this.metrics.totalMessages++;
    this.messageHistory.push({ timestamp: Date.now() });
  }

  recordMatch(userId: string, successful: boolean = true): void {
    if (!this.isEnabled) return;
    this.metrics.totalMatches++;
    if (successful) {
      this.metrics.successfulMatches++;
    } else {
      this.metrics.failedMatches++;
    }
  }

  recordResponseTime(duration: number): void {
    if (!this.isEnabled) return;
    this.responseTimeHistory.push({
      timestamp: Date.now(),
      duration
    });
    this.calculateResponseTimeMetrics();
  }

  recordError(): void {
    if (!this.isEnabled) return;
    this.metrics.totalErrors++;
    this.errorHistory.push({ timestamp: Date.now() });
  }

  private calculateResponseTimeMetrics(): void {
    if (this.responseTimeHistory.length === 0) return;
    
    const durations = this.responseTimeHistory.map(r => r.duration).sort((a, b) => a - b);
    this.metrics.averageResponseTime = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    
    this.metrics.p95ResponseTime = durations[Math.min(p95Index, durations.length - 1)];
    this.metrics.p99ResponseTime = durations[Math.min(p99Index, durations.length - 1)];
  }

  private startPeriodicCollection(): void {
    setInterval(() => {
      this.metrics.memoryUsage = process.memoryUsage();
      
      // Calculate messages per second
      const now = Date.now();
      const oneSecondAgo = now - 1000;
      const recentMessages = this.messageHistory.filter(m => m.timestamp > oneSecondAgo);
      this.metrics.messagesPerSecond = recentMessages.length;
      
      // Calculate error rate
      const oneMinuteAgo = now - 60000;
      const recentErrors = this.errorHistory.filter(e => e.timestamp > oneMinuteAgo);
      const recentTotal = this.messageHistory.filter(m => m.timestamp > oneMinuteAgo).length;
      this.metrics.errorRate = recentTotal > 0 ? (recentErrors.length / recentTotal) * 100 : 0;
    }, 5000);

    setInterval(() => {
      const report = {
        connections: this.metrics.currentConnections,
        messages: this.metrics.totalMessages,
        matches: this.metrics.totalMatches,
        memory: `${(this.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        avgResponseTime: `${this.metrics.averageResponseTime.toFixed(2)}ms`,
        errorRate: `${this.metrics.errorRate.toFixed(2)}%`
      };
      logger.debug('📊 Performance Report:', report);
    }, 30000);
  }

  getStats() {
    return { ...this.metrics };
  }

  getDetailedStats() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      memoryBreakdown: {
        heapUsed: `${(this.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(this.metrics.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        external: `${(this.metrics.memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
        rss: `${(this.metrics.memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`
      }
    };
  }
}

