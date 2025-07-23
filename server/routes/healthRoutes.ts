// ===== server/routes/healthRoutes.ts - Health endpoints =====
import { IncomingMessage, ServerResponse } from 'http';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  version: string;
  onlineUserCount: number;
  waitingTextChat: number;
  waitingVideoChat: number;
  supabaseEnabled: boolean;
}

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

export const updateGlobalStats = (updates: Partial<typeof globalStats>) => {
  Object.assign(globalStats, updates);
};

export const setupRoutes = (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '';
  const method = req.method || 'GET';

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    if (method === 'GET') {
      switch (url) {
        case '/':
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('TinChat Socket.IO Server is running\n');
          break;

        case '/health':
          const health: HealthStatus = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            onlineUserCount: globalStats.onlineUserCount,
            waitingTextChat: globalStats.waitingUsers.text,
            waitingVideoChat: globalStats.waitingUsers.video,
            supabaseEnabled: globalStats.supabaseEnabled
          };
          
          res.writeHead(200);
          res.end(JSON.stringify(health, null, 2));
          break;

        case '/metrics':
          const metrics = {
            timestamp: new Date().toISOString(),
            process: {
              pid: process.pid,
              uptime: process.uptime(),
              version: process.version,
              platform: process.platform
            },
            memory: process.memoryUsage(),
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
          
          res.writeHead(200);
          res.end(JSON.stringify(metrics, null, 2));
          break;

        case '/status':
          const status = {
            status: "ok",
            onlineUserCount: globalStats.onlineUserCount,
            waitingTextChat: globalStats.waitingUsers.text,
            waitingVideoChat: globalStats.waitingUsers.video,
            totalRooms: globalStats.totalRooms,
            supabaseEnabled: globalStats.supabaseEnabled,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
          };
          
          res.writeHead(200);
          res.end(JSON.stringify(status));
          break;

        default:
          res.writeHead(404);
          res.end(JSON.stringify({
            error: 'Not Found',
            availableEndpoints: [
              'GET /',
              'GET /health',
              'GET /metrics',
              'GET /status'
            ]
          }));
          break;
      }
    } else {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    }
  } catch (error: any) {
    res.writeHead(500);
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      timestamp: new Date().toISOString()
    }));
  }
};

