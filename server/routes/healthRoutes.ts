// server/routes/healthRoutes.ts
import { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../utils/logger';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    socketIO: {
      status: 'ok' | 'error';
      connectedClients: number;
      totalConnections: number;
    };
    database: {
      status: 'ok' | 'error';
      connected: boolean;
      responseTime?: number;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    queues: {
      textWaiting: number;
      videoWaiting: number;
      totalRooms: number;
    };
  };
  performance: {
    avgResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
}

// Global stats that will be updated by other parts of the application
export const globalStats = {
  onlineUserCount: 0,
  totalConnections: 0,
  waitingUsers: { text: 0, video: 0 },
  totalRooms: 0,
  supabaseEnabled: false,
  performance: {
    avgResponseTime: 0,
    requestsPerSecond: 0,
    errorRate: 0
  }
};

// Health check endpoint
export const healthCheck = async (): Promise<HealthStatus> => {
  const startTime = Date.now();
  const memoryUsage = process.memoryUsage();
  
  // Calculate memory percentage
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const memoryPercentage = (usedMemory / totalMemory) * 100;
  
  // Determine overall status
  let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';
  
  // Check if memory usage is too high
  if (memoryPercentage > 85) {
    overallStatus = 'degraded';
  }
  
  // Check if error rate is too high
  if (globalStats.performance.errorRate > 5) {
    overallStatus = 'degraded';
  }

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      socketIO: {
        status: 'ok',
        connectedClients: globalStats.onlineUserCount,
        totalConnections: globalStats.totalConnections
      },
      database: {
        status: globalStats.supabaseEnabled ? 'ok' : 'error',
        connected: globalStats.supabaseEnabled,
        responseTime: Date.now() - startTime
      },
      memory: {
        used: Math.round(usedMemory / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        percentage: Math.round(memoryPercentage)
      },
      queues: {
        textWaiting: globalStats.waitingUsers.text,
        videoWaiting: globalStats.waitingUsers.video,
        totalRooms: globalStats.totalRooms
      }
    },
    performance: {
      avgResponseTime: globalStats.performance.avgResponseTime,
      requestsPerSecond: globalStats.performance.requestsPerSecond,
      errorRate: globalStats.performance.errorRate
    }
  };

  return healthStatus;
};

// Metrics endpoint for more detailed statistics
export const getMetrics = () => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return {
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    chat: {
      onlineUsers: globalStats.onlineUserCount,
      totalConnections: globalStats.totalConnections,
      waitingUsers: globalStats.waitingUsers,
      totalRooms: globalStats.totalRooms
    },
    features: {
      supabaseEnabled: globalStats.supabaseEnabled
    }
  };
};

// Status endpoint (simplified health check)
export const getStatus = () => {
  return {
    status: "ok",
    onlineUserCount: globalStats.onlineUserCount,
    waitingTextChat: globalStats.waitingUsers.text,
    waitingVideoChat: globalStats.waitingUsers.video,
    totalRooms: globalStats.totalRooms,
    supabaseEnabled: globalStats.supabaseEnabled,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
};

// Route handler
export const setupRoutes = (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '';
  const method = req.method || 'GET';

  // Set common headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    if (method === 'GET') {
      switch (url) {
        case '/':
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('TinChat Socket.IO Server is running and configured for CORS.\n');
          break;

        case '/health':
          healthCheck().then(health => {
            const statusCode = health.status === 'ok' ? 200 : 
                             health.status === 'degraded' ? 200 : 503;
            res.writeHead(statusCode);
            res.end(JSON.stringify(health, null, 2));
            
            logger.debug('Health check requested', { status: health.status });
          }).catch(error => {
            logger.error('Health check failed', { error: error.message });
            res.writeHead(500);
            res.end(JSON.stringify({ 
              status: 'error', 
              message: 'Health check failed',
              timestamp: new Date().toISOString()
            }));
          });
          break;

        case '/metrics':
          res.writeHead(200);
          res.end(JSON.stringify(getMetrics(), null, 2));
          logger.debug('Metrics requested');
          break;

        case '/status':
          res.writeHead(200);
          res.end(JSON.stringify(getStatus()));
          logger.debug('Status requested');
          break;

        case '/logs':
          // Return recent logs for debugging (only in development)
          if (process.env.NODE_ENV === 'development') {
            const recentLogs = logger.getRecentLogs(50);
            res.writeHead(200);
            res.end(JSON.stringify({
              logs: recentLogs,
              stats: logger.getStats()
            }, null, 2));
          } else {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Logs endpoint not available in production' }));
          }
          break;

        default:
          res.writeHead(404);
          res.end(JSON.stringify({
            error: 'Not Found',
            availableEndpoints: [
              'GET /',
              'GET /health',
              'GET /metrics', 
              'GET /status',
              'GET /logs (dev only)'
            ]
          }));
          break;
      }
    } else {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    }
  } catch (error: any) {
    logger.error('Route handler error', { 
      url, 
      method, 
      error: error.message,
      stack: error.stack 
    });
    
    res.writeHead(500);
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }));
  }
};

// Helper function to update global stats (called from other parts of the app)
export const updateGlobalStats = (updates: Partial<typeof globalStats>) => {
  Object.assign(globalStats, updates);
};

// Middleware for performance tracking
export const performanceMiddleware = (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
  const startTime = Date.now();
  
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = Date.now() - startTime;
    
    // Update performance stats
    globalStats.performance.avgResponseTime = 
      (globalStats.performance.avgResponseTime + duration) / 2;
    
    logger.debug('Request completed', {
      url: req.url,
      method: req.method,
      duration: `${duration}ms`,
      statusCode: res.statusCode
    });
    
    originalEnd.apply(res, args);
  };
  
  if (next) next();
};