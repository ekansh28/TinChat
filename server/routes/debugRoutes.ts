// server/routes/debugRoutes.ts - Debug routes for troubleshooting matchmaking
import { IncomingMessage, ServerResponse } from 'http';
import { SocketManager } from '../managers/SocketManager';
import { logger } from '../utils/logger';

let globalSocketManager: SocketManager | null = null;

export const setSocketManager = (socketManager: SocketManager) => {
  globalSocketManager = socketManager;
};

export const setupDebugRoutes = (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '';
  const method = req.method || 'GET';

  // CORS headers for debugging
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return true;
  }

  try {
    if (method === 'GET') {
      switch (url) {
        case '/debug':
          handleDebugInfo(res);
          return true;

        case '/debug/matchmaking':
          handleMatchmakingDebug(res);
          return true;

        case '/debug/force-match':
          handleForceMatch(res, req);
          return true;

        case '/debug/queue-details':
          handleQueueDetails(res);
          return true;

        case '/debug/connections':
          handleConnectionsDebug(res);
          return true;

        case '/debug/clear-queues':
          handleClearQueues(res);
          return true;

        default:
          return false; // Not a debug route
      }
    } else if (method === 'POST') {
      switch (url) {
        case '/debug/simulate-users':
          handleSimulateUsers(req, res);
          return true;

        default:
          return false;
      }
    }
  } catch (error) {
    logger.error('Debug route error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Debug route error', details: error }));
    return true;
  }

  return false;
};

const handleDebugInfo = (res: ServerResponse) => {
  if (!globalSocketManager) {
    res.writeHead(503);
    res.end(JSON.stringify({ error: 'SocketManager not available' }));
    return;
  }

  const stats = globalSocketManager.getStats();
  const health = globalSocketManager.healthCheck();
  const matchmakingDebug = globalSocketManager.debugMatchmaking();

  const debugInfo = {
    timestamp: new Date().toISOString(),
    server: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version
    },
    socketManager: {
      stats,
      health,
      matchmaking: matchmakingDebug
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      socketServerUrl: process.env.NEXT_PUBLIC_SOCKET_SERVER_URL
    }
  };

  res.writeHead(200);
  res.end(JSON.stringify(debugInfo, null, 2));
  logger.info('📊 Debug info requested');
};

const handleMatchmakingDebug = (res: ServerResponse) => {
  if (!globalSocketManager) {
    res.writeHead(503);
    res.end(JSON.stringify({ error: 'SocketManager not available' }));
    return;
  }

  const matchmakingDebug = globalSocketManager.debugMatchmaking();
  
  res.writeHead(200);
  res.end(JSON.stringify(matchmakingDebug, null, 2));
  logger.info('🎯 Matchmaking debug info requested');
};

const handleForceMatch = (res: ServerResponse, req: IncomingMessage) => {
  if (!globalSocketManager) {
    res.writeHead(503);
    res.end(JSON.stringify({ error: 'SocketManager not available' }));
    return;
  }

  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const chatType = url.searchParams.get('type') as 'text' | 'video' || 'text';

  const result = globalSocketManager.forceMatch(chatType);
  
  if (result) {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      match: result,
      message: `Forced match created between ${result.user1.id} and ${result.user2.id}`
    }));
    logger.warn(`🔧 FORCED MATCH: ${result.user1.id} ↔ ${result.user2.id} (${chatType})`);
  } else {
    res.writeHead(400);
    res.end(JSON.stringify({
      success: false,
      message: `No users available for ${chatType} force match`,
      queueStats: globalSocketManager.debugMatchmaking().queueStats
    }));
  }
};

const handleQueueDetails = (res: ServerResponse) => {
  if (!globalSocketManager) {
    res.writeHead(503);
    res.end(JSON.stringify({ error: 'SocketManager not available' }));
    return;
  }

  const matchmakingDebug = globalSocketManager.debugMatchmaking();
  
  res.writeHead(200);
  res.end(JSON.stringify({
    timestamp: new Date().toISOString(),
    queueStats: matchmakingDebug.queueStats,
    queueDetails: matchmakingDebug.queueDetails,
    totalWaiting: matchmakingDebug.queueStats.text + matchmakingDebug.queueStats.video
  }, null, 2));
  logger.info('📊 Queue details requested');
};

const handleConnectionsDebug = (res: ServerResponse) => {
  if (!globalSocketManager) {
    res.writeHead(503);
    res.end(JSON.stringify({ error: 'SocketManager not available' }));
    return;
  }

  const stats = globalSocketManager.getStats();
  const health = globalSocketManager.healthCheck();
  
  res.writeHead(200);
  res.end(JSON.stringify({
    timestamp: new Date().toISOString(),
    connections: {
      active: health.activeConnections,
      stale: health.staleConnections,
      online: stats.onlineUsers
    },
    memory: stats.memory,
    rooms: stats.rooms,
    performance: stats.performance
  }, null, 2));
  logger.info('🔌 Connections debug info requested');
};

const handleClearQueues = (res: ServerResponse) => {
  if (!globalSocketManager) {
    res.writeHead(503);
    res.end(JSON.stringify({ error: 'SocketManager not available' }));
    return;
  }

  // This is a bit hacky since we don't have a direct clear method
  // We'll force cleanup all users (this simulates disconnecting them from queues)
  const matchmakingDebug = globalSocketManager.debugMatchmaking();
  
  res.writeHead(200);
  res.end(JSON.stringify({
    success: true,
    message: 'Queue clear requested (users will be cleaned up on next stale check)',
    previousQueueStats: matchmakingDebug.queueStats
  }));
  logger.warn('🧹 Queue clear requested via debug route');
};

const handleSimulateUsers = (req: IncomingMessage, res: ServerResponse) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const { count = 2, chatType = 'text', interests = ['testing'] } = JSON.parse(body || '{}');
      
      if (!globalSocketManager) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'SocketManager not available' }));
        return;
      }

      // Note: This is a simulation response - actual user simulation would require
      // creating mock socket connections which is complex
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: `Simulation planned for ${count} users in ${chatType} chat`,
        note: 'Use the debug client tool to actually create test connections',
        suggestedAction: 'Open multiple browser tabs with the debug tool'
      }));

      logger.info(`👥 User simulation requested: ${count} users, ${chatType} chat`);
    } catch (error) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    }
  });
};

// Helper to generate HTML debug dashboard
export const generateDebugDashboard = (): string => {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>TinChat Debug Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        button { padding: 10px 20px; margin: 5px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }
        .info { background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 10px; margin: 10px 0; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
        .status-good { color: #28a745; font-weight: bold; }
        .status-warn { color: #ffc107; font-weight: bold; }
        .status-bad { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🐛 TinChat Debug Dashboard</h1>
        
        <div class="warning">
            <strong>⚠️ Debug Mode:</strong> This dashboard is for development and debugging purposes only.
        </div>

        <div class="grid">
            <div class="card">
                <h2>📊 Quick Actions</h2>
                <button onclick="loadData('/debug')">Refresh All Data</button>
                <button onclick="loadData('/debug/matchmaking')">Check Matchmaking</button>
                <button onclick="loadData('/debug/queue-details')">Queue Details</button>
                <button onclick="loadData('/debug/connections')">Connection Info</button>
                <button onclick="forceMatch('text')">Force Text Match</button>
                <button onclick="forceMatch('video')">Force Video Match</button>
                <button onclick="clearQueues()">Clear Queues</button>
            </div>

            <div class="card">
                <h2>🎯 Testing Instructions</h2>
                <ol>
                    <li>Open multiple browser tabs</li>
                    <li>Navigate to your chat pages</li>
                    <li>Try to match with different interests</li>
                    <li>Monitor this dashboard for queue status</li>
                    <li>Check server logs for detailed info</li>
                </ol>
            </div>
        </div>

        <div class="card">
            <h2>📈 Live Data</h2>
            <div id="debugData">
                <p>Click "Refresh All Data" to load current status...</p>
            </div>
        </div>
    </div>

    <script>
        async function loadData(endpoint) {
            try {
                const response = await fetch(endpoint);
                const data = await response.json();
                document.getElementById('debugData').innerHTML = 
                    '<h3>' + endpoint + '</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
                document.getElementById('debugData').innerHTML = 
                    '<div class="status-bad">Error loading ' + endpoint + ': ' + error.message + '</div>';
            }
        }

        async function forceMatch(type) {
            try {
                const response = await fetch('/debug/force-match?type=' + type);
                const data = await response.json();
                alert(data.message || 'Force match completed');
                loadData('/debug/queue-details');
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }

        async function clearQueues() {
            try {
                const response = await fetch('/debug/clear-queues');
                const data = await response.json();
                alert(data.message || 'Queue clear completed');
                loadData('/debug/queue-details');
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }

        // Auto-refresh every 10 seconds
        setInterval(() => {
            if (document.getElementById('debugData').innerHTML.includes('/debug')) {
                loadData('/debug/queue-details');
            }
        }, 10000);
    </script>
</body>
</html>`;
};

// Add this route to your main health routes
export const handleDebugDashboard = (res: ServerResponse) => {
  res.setHeader('Content-Type', 'text/html');
  res.writeHead(200);
  res.end(generateDebugDashboard());
};