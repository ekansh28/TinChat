// server/utils/logger.ts
import { performance } from 'perf_hooks';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: any;
  duration?: number;
  requestId?: string;
  userId?: string;
  socketId?: string;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LoggerConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamps: boolean;
  enableMetadata: boolean;
  enablePerformance: boolean;
  maxLogSize: number;
  rotateInterval: number;
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  enableColors: process.env.NODE_ENV !== 'production',
  enableTimestamps: true,
  enableMetadata: true,
  enablePerformance: true,
  maxLogSize: 1000,
  rotateInterval: 24 * 60 * 60 * 1000 // 24 hours
};

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

const COLORS = {
  error: '\x1b[31m',   // Red
  warn: '\x1b[33m',    // Yellow
  info: '\x1b[36m',    // Cyan
  debug: '\x1b[35m',   // Magenta
  trace: '\x1b[37m',   // White
  reset: '\x1b[0m',    // Reset
  timestamp: '\x1b[90m', // Gray
  metadata: '\x1b[32m'   // Green
};

class Logger {
  private config: LoggerConfig;
  private logHistory: LogEntry[] = [];
  private performanceMarks: Map<string, number> = new Map();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: LogLevel, message: string, meta?: any, duration?: number): string {
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase().padEnd(5);
    
    let formattedMessage = '';
    
    if (this.config.enableColors) {
      const color = COLORS[level];
      const resetColor = COLORS.reset;
      
      if (this.config.enableTimestamps) {
        formattedMessage += `${COLORS.timestamp}[${timestamp}]${resetColor} `;
      }
      
      formattedMessage += `${color}${levelUpper}${resetColor} ${message}`;
      
      if (duration !== undefined && this.config.enablePerformance) {
        formattedMessage += ` ${COLORS.metadata}(${duration.toFixed(2)}ms)${resetColor}`;
      }
      
      if (meta && this.config.enableMetadata) {
        formattedMessage += `\n${COLORS.metadata}${JSON.stringify(meta, null, 2)}${resetColor}`;
      }
    } else {
      if (this.config.enableTimestamps) {
        formattedMessage += `[${timestamp}] `;
      }
      
      formattedMessage += `${levelUpper} ${message}`;
      
      if (duration !== undefined && this.config.enablePerformance) {
        formattedMessage += ` (${duration.toFixed(2)}ms)`;
      }
      
      if (meta && this.config.enableMetadata) {
        formattedMessage += `\n${JSON.stringify(meta, null, 2)}`;
      }
    }
    
    return formattedMessage;
  }

  private addToHistory(entry: LogEntry): void {
    this.logHistory.push(entry);
    
    if (this.logHistory.length > this.config.maxLogSize) {
      this.logHistory = this.logHistory.slice(-this.config.maxLogSize);
    }
  }

  private log(level: LogLevel, message: string, meta?: any, duration?: number): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const formattedMessage = this.formatMessage(level, message, meta, duration);
    
    // Add to history
    this.addToHistory({
      timestamp,
      level,
      message,
      meta,
      duration
    });

    // Output to console
    const consoleMethod = level === 'error' ? 'error' : 
                         level === 'warn' ? 'warn' : 
                         level === 'debug' ? 'debug' : 'log';
    
    console[consoleMethod](formattedMessage);
  }

  // Public logging methods
  error(message: string, meta?: any): void {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  trace(message: string, meta?: any): void {
    this.log('trace', message, meta);
  }

  // Performance timing methods
  time(label: string): void {
    this.performanceMarks.set(label, performance.now());
  }

  timeEnd(label: string, message?: string): number {
    const startTime = this.performanceMarks.get(label);
    if (startTime === undefined) {
      this.warn(`Timer '${label}' not found`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.performanceMarks.delete(label);
    
    const logMessage = message || `Timer '${label}' completed`;
    this.log('debug', logMessage, undefined, duration);
    
    return duration;
  }

  // Context-aware logging
  withContext(context: Partial<Pick<LogEntry, 'requestId' | 'userId' | 'socketId'>>) {
    return {
      error: (message: string, meta?: any) => this.log('error', message, { ...meta, ...context }),
      warn: (message: string, meta?: any) => this.log('warn', message, { ...meta, ...context }),
      info: (message: string, meta?: any) => this.log('info', message, { ...meta, ...context }),
      debug: (message: string, meta?: any) => this.log('debug', message, { ...meta, ...context }),
      trace: (message: string, meta?: any) => this.log('trace', message, { ...meta, ...context })
    };
  }

  // Utility methods
  getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logHistory.slice(-count);
  }

  clearHistory(): void {
    this.logHistory = [];
  }

  getStats() {
    const levels = this.logHistory.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);

    const avgDuration = this.logHistory
      .filter(log => log.duration !== undefined)
      .reduce((sum, log, _, arr) => sum + (log.duration! / arr.length), 0);

    return {
      totalLogs: this.logHistory.length,
      levelBreakdown: levels,
      averageDuration: avgDuration,
      activeTimers: this.performanceMarks.size
    };
  }

  // JSON output for structured logging
  json(level: LogLevel, message: string, meta?: any): void {
    if (!this.shouldLog(level)) return;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta
    };

    console.log(JSON.stringify(logEntry));
    this.addToHistory(logEntry);
  }
}

// Create default logger instance
export const logger = new Logger();

// Export Logger class for custom instances
export { Logger };

// Utility functions for common logging patterns
export const createRequestLogger = (requestId: string) => {
  return logger.withContext({ requestId });
};

export const createSocketLogger = (socketId: string, userId?: string) => {
  return logger.withContext({ socketId, userId });
};

export const createUserLogger = (userId: string) => {
  return logger.withContext({ userId });
};

// Express middleware for request logging
export const requestLoggingMiddleware = (req: any, res: any, next: any) => {
  const requestId = Math.random().toString(36).substr(2, 9);
  const startTime = performance.now();
  
  req.logger = createRequestLogger(requestId);
  req.logger.info(`${req.method} ${req.url}`, {
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = performance.now() - startTime;
    req.logger.info(`${req.method} ${req.url} - ${res.statusCode}`, {
      duration: duration.toFixed(2) + 'ms',
      statusCode: res.statusCode
    });
    originalEnd.apply(res, args);
  };

  next();
};