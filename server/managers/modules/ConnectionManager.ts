// server/managers/modules/ConnectionManager.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../../utils/logger';

export interface ConnectionData {
  startTime: number;
  userAgent: string;
  ip: string;
  tabId?: string;
}

export interface DisconnectStats {
  reasons: Map<string, number>;
  userAgents: Map<string, number>;
  connectionDurations: number[];
}

// Inline type definition to avoid import issues
type HealthCheckResult = {
  status: 'healthy' | 'degraded' | 'down';
  activeConnections: number;
  staleConnections: number;
  onlineUsers: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  timestamp: string;
};

export class ConnectionManager {
  private connectionStartTimes: Map<string, number> = new Map();
  private connectionDetails: Map<string, ConnectionData> = new Map();
  private disconnectStats: DisconnectStats = {
    reasons: new Map(),
    userAgents: new Map(),
    connectionDurations: []
  };
  
  private onlineUserCount = 0;
  private readonly STALE_CONNECTION_THRESHOLD = 90000;
  private readonly HEARTBEAT_INTERVAL = 30000;

  constructor(private io: SocketIOServer) {
    this.startHeartbeat();
    this.startConnectionMonitoring();
  }

  handleConnection(socket: Socket): void {
    this.onlineUserCount++;
    const startTime = Date.now();
    
    this.connectionStartTimes.set(socket.id, startTime);
    this.connectionDetails.set(socket.id, {
      startTime,
      userAgent: socket.handshake.headers['user-agent'] || 'unknown',
      ip: socket.handshake.address || 'unknown'
    });

    logger.info(`👤 User connected : ${socket.id}. Total online: ${this.onlineUserCount}`, {
      userAgent: socket.handshake.headers['user-agent'],
      remoteAddress: socket.handshake.address,
      transport: socket.conn.transport.name,
    });
    
    this.io.emit('onlineUserCountUpdate', this.onlineUserCount);
  }

  handleDisconnection(socket: Socket, reason: string, details?: any): void {
    const connectionData = this.connectionDetails.get(socket.id);
    
    if (connectionData) {
      const connectionDuration = Date.now() - connectionData.startTime;
      this.recordDisconnect(socket.id, reason, connectionData.userAgent, connectionDuration);
      
      logger.info(`👋 Enhanced disconnect handling: ${socket.id}`, {
        reason,
        connectionDuration: Math.round(connectionDuration / 1000),
        userAgent: connectionData.userAgent?.substring(0, 100)
      });
    }
    
    this.onlineUserCount = Math.max(0, this.onlineUserCount - 1);
    this.io.emit('onlineUserCountUpdate', this.onlineUserCount);
    
    // Cleanup tracking data
    this.connectionStartTimes.delete(socket.id);
    this.connectionDetails.delete(socket.id);
  }

  getConnectionData(socketId: string): ConnectionData | undefined {
    return this.connectionDetails.get(socketId);
  }

  getOnlineUserCount(): number {
    return this.onlineUserCount;
  }

  getConnectionDuration(socketId: string): number {
    const startTime = this.connectionStartTimes.get(socketId);
    return startTime ? Date.now() - startTime : 0;
  }

  private recordDisconnect(socketId: string, reason: string, userAgent?: string, connectionDuration?: number): void {
    this.disconnectStats.reasons.set(reason, (this.disconnectStats.reasons.get(reason) || 0) + 1);
    
    if (userAgent) {
      const browser = this.extractBrowser(userAgent);
      this.disconnectStats.userAgents.set(browser, (this.disconnectStats.userAgents.get(browser) || 0) + 1);
    }
    
    if (connectionDuration) {
      this.disconnectStats.connectionDurations.push(connectionDuration);
      if (this.disconnectStats.connectionDurations.length > 1000) {
        this.disconnectStats.connectionDurations = this.disconnectStats.connectionDurations.slice(-500);
      }
    }
  }

  private extractBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  }

  private startHeartbeat(): void {
    setInterval(() => {
      const heartbeatData = {
        timestamp: Date.now(),
        serverTime: new Date().toISOString(),
        onlineCount: this.onlineUserCount,
        serverUptime: process.uptime(),
      };

      this.io.emit('heartbeat', heartbeatData);
      logger.debug(`💓 Heartbeat sent to ${this.io.sockets.sockets.size} connections`);
    }, this.HEARTBEAT_INTERVAL);
  }

  private startConnectionMonitoring(): void {
    setInterval(() => {
      const sockets = this.io.sockets.sockets;
      const now = Date.now();
      
      sockets.forEach((socket) => {
        try {
          const lastPong = (socket.conn as any).lastPong || now;
          const timeSinceLastPong = now - lastPong;
          
          if (timeSinceLastPong > this.STALE_CONNECTION_THRESHOLD) {
            logger.warn(`🔍 Stale connection detected: ${socket.id} - ${Math.round(timeSinceLastPong / 1000)}s since last pong`);
            
            socket.emit('connection_warning', {
              type: 'stale_connection',
              timeSinceLastPong,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          logger.error(`Error monitoring socket ${socket.id}:`, error);
        }
      });
    }, 60000);
  }

  getStats() {
    return {
      onlineUsers: this.onlineUserCount,
      disconnects: this.getDisconnectSummary(),
      trackedConnections: this.connectionDetails.size,
      memoryUsage: {
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`,
      }
    };
  }

  private getDisconnectSummary() {
    const topReasons = Array.from(this.disconnectStats.reasons.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    const avgDuration = this.disconnectStats.connectionDurations.length > 0
      ? this.disconnectStats.connectionDurations.reduce((a, b) => a + b, 0) / this.disconnectStats.connectionDurations.length
      : 0;
    
    return {
      topReasons: Object.fromEntries(topReasons),
      avgConnectionDuration: Math.round(avgDuration / 1000),
      totalTracked: this.disconnectStats.connectionDurations.length,
    };
  }

  healthCheck(): HealthCheckResult {
    const now = Date.now();
    const activeConnections = this.io.sockets.sockets.size;
    const staleConnections = Array.from(this.io.sockets.sockets.values()).filter(socket => {
      const lastPong = (socket.conn as any).lastPong || now;
      return (now - lastPong) > this.STALE_CONNECTION_THRESHOLD;
    }).length;

    // ✅ FIXED: Return proper union type for status
    let status: 'healthy' | 'degraded' | 'down';
    
    if (activeConnections === 0) {
      status = 'down';
    } else if (staleConnections / activeConnections > 0.1) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      activeConnections,
      staleConnections,
      onlineUsers: this.onlineUserCount,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  cleanup(): void {
    // Cleanup method for graceful shutdown
    this.connectionStartTimes.clear();
    this.connectionDetails.clear();
    this.onlineUserCount = 0;
  }
}