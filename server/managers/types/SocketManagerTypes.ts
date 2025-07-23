// server/managers/types/SocketManagerTypes.ts
// Interface to ensure backward compatibility with server/index.ts

export interface SocketManagerStats {
  onlineUsers: number;
  queues: {
    text: number;
    video: number;
    totalWaiting: number;
    averageWaitTime: number;
    textWaitTime: number;
    videoWaitTime: number;
    oldestTextWait: number;
    oldestVideoWait: number;
    authUsers: {
      text: number;
      video: number;
    };
    anonymousUsers: {
      text: number;
      video: number;
    };
  };
  rooms: {
    totalRooms: number;
    textRooms: number;
    videoRooms: number;
    activeRooms: number;
  };
  cache: {
    size: number;
    maxSize: number;
    cacheDuration: number;
  };
  performance: {
    totalConnections: number;
    totalDisconnections: number;
    currentConnections: number;
    peakConnections: number;
    totalMessages: number;
    messagesPerSecond: number;
    totalMatches: number;
    successfulMatches: number;
    failedMatches: number;
    memoryUsage: NodeJS.MemoryUsage;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    totalErrors: number;
    errorRate: number;
  };
  disconnects: {
    topReasons: { [key: string]: number };
    avgConnectionDuration: number;
    totalTracked: number;
  };
  memory: {
    trackedConnections: number;
    authMappings: number;
    roomMappings: number;
    roomToSocketMappings: number;
    heapUsed: string;
  };
  modules?: {
    connections: any;
    messages: any;
    matchmaking: any;
    userStatus: any;
  };
}

export interface SocketManagerHealthCheck {
  status: 'healthy' | 'degraded' | 'down';
  activeConnections: number;
  staleConnections: number;
  onlineUsers: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  timestamp: string;
}

export interface MatchmakingDebugInfo {
  queueStats: {
    text: number;
    video: number;
    totalWaiting: number;
    averageWaitTime: number;
    textWaitTime: number;
    videoWaitTime: number;
    oldestTextWait: number;
    oldestVideoWait: number;
    authUsers: {
      text: number;
      video: number;
    };
    anonymousUsers: {
      text: number;
      video: number;
    };
  };
  queueDetails: {
    text: Array<{
      id: string;
      authId: string | null;
      interests: string[];
      waitTime: number;
      connectionStartTime?: number;
      status?: string;
      hasProfile: boolean;
    }>;
    video: Array<{
      id: string;
      authId: string | null;
      interests: string[];
      waitTime: number;
      connectionStartTime?: number;
      status?: string;
      hasProfile: boolean;
    }>;
  };
  socketToAuthMapping: number;
  authToSocketMapping: number;
  userInterests: number;
  roomMappings: number;
  roomToSocketMappings: number;
}
