// src/lib/socketManager.ts - Global Socket Connection Manager
import { io, Socket } from 'socket.io-client';
import { generateDeviceFingerprint } from '@/lib/fingerprint';

interface SocketManagerConfig {
  serverUrl: string;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  circuitBreakerDuration: number;
}

type EventHandler = (...args: any[]) => void;
type SocketEventName = string;

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  retryCount: number;
  isCircuitOpen: boolean;
  lastConnectionAttempt: number;
}

class SocketManager {
  private socket: Socket | null = null;
  private config: SocketManagerConfig;
  private state: ConnectionState;
  private eventHandlers: Map<string, Map<SocketEventName, EventHandler>> = new Map();
  private connectionPromise: Promise<Socket> | null = null;
  private circuitBreakerTimeout: NodeJS.Timeout | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;
  private listeners = new Set<(state: ConnectionState) => void>();
  private isDestroyed = false;

  constructor(config: Partial<SocketManagerConfig> = {}) {
    this.config = {
      serverUrl: process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001',
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      circuitBreakerDuration: 120000, // 2 minutes
      ...config
    };

    this.state = {
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      retryCount: 0,
      isCircuitOpen: false,
      lastConnectionAttempt: 0
    };

    // Handle page visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    // Handle page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.destroy.bind(this));
    }
  }

  private handleVisibilityChange() {
    if (document.hidden) {
      console.log('[SocketManager] Page hidden - maintaining connection');
    } else {
      console.log('[SocketManager] Page visible - checking connection health');
      if (!this.state.isConnected && !this.state.isConnecting && !this.state.isCircuitOpen) {
        this.connect();
      }
    }
  }

  private updateState(updates: Partial<ConnectionState>) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[SocketManager] Error in state listener:', error);
      }
    });
  }

  public onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.state);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async createSocket(): Promise<Socket> {
    if (this.isDestroyed) {
      throw new Error('SocketManager has been destroyed');
    }

    if (this.state.isCircuitOpen) {
      throw new Error('Circuit breaker is open');
    }

    console.log('[SocketManager] Creating new socket connection');
    
    const socket = io(this.config.serverUrl, {
      withCredentials: true,
      transports: ['polling', 'websocket'], // Polling first for stability
      reconnection: false, // We handle reconnection manually
      timeout: 15000,
      forceNew: true,
      upgrade: false, // Don't auto-upgrade to websocket
      rememberUpgrade: false,
      query: {
        clientId: generateDeviceFingerprint(),
        timestamp: Date.now(),
        attempt: this.state.retryCount + 1,
        connectionId: `${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
      }
    });

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
        socket.off('disconnect', onDisconnect);
      };

      const onConnect = () => {
        console.log('[SocketManager] Connected successfully:', socket.id);
        cleanup();
        resolve(socket);
      };

      const onError = (error: Error) => {
        console.error('[SocketManager] Connection error:', error);
        cleanup();
        reject(error);
      };

      const onDisconnect = (reason: string) => {
        console.log('[SocketManager] Disconnected during connection:', reason);
        cleanup();
        reject(new Error(`Disconnected: ${reason}`));
      };

      socket.on('connect', onConnect);
      socket.on('connect_error', onError);
      socket.on('disconnect', onDisconnect);

      // Set a connection timeout
      setTimeout(() => {
        if (!socket.connected) {
          cleanup();
          reject(new Error('Connection timeout'));
        }
      }, this.config.maxRetries * 1000);
    });
  }

  public async connect(): Promise<Socket> {
    if (this.isDestroyed) {
      throw new Error('SocketManager has been destroyed');
    }

    // Return existing connection if available
    if (this.socket?.connected) {
      return this.socket;
    }

    // Return existing connection promise if in progress
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Check circuit breaker
    if (this.state.isCircuitOpen) {
      throw new Error('Circuit breaker is open - too many failed connection attempts');
    }

    // Check rate limiting
    const now = Date.now();
    const timeSinceLastAttempt = now - this.state.lastConnectionAttempt;
    const minDelay = Math.min(this.config.baseDelay * Math.pow(2, this.state.retryCount), this.config.maxDelay);

    if (timeSinceLastAttempt < minDelay) {
      const waitTime = minDelay - timeSinceLastAttempt;
      console.log(`[SocketManager] Rate limiting - waiting ${waitTime}ms before connection attempt`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.updateState({ 
      isConnecting: true, 
      connectionError: null,
      lastConnectionAttempt: Date.now()
    });

    this.connectionPromise = this.createSocket()
      .then(socket => {
        this.socket = socket;
        this.setupSocketEvents(socket);
        this.updateState({
          isConnected: true,
          isConnecting: false,
          connectionError: null,
          retryCount: 0
        });
        this.connectionPromise = null;
        return socket;
      })
      .catch(error => {
        this.connectionPromise = null;
        this.handleConnectionError(error);
        throw error;
      });

    return this.connectionPromise;
  }

  private handleConnectionError(error: Error) {
    const errorMessage = error.message || String(error);
    const isServerRejection = errorMessage.includes('403') || 
                             errorMessage.includes('Forbidden') ||
                             errorMessage.includes('Too many connections') ||
                             errorMessage.includes('xhr poll error') ||
                             errorMessage.includes('websocket error');

    console.log(`[SocketManager] Connection error (attempt ${this.state.retryCount + 1}):`, error);

    if (isServerRejection) {
      this.state.retryCount++;

      if (this.state.retryCount >= this.config.maxRetries) {
        console.log('[SocketManager] Opening circuit breaker due to repeated failures');
        this.updateState({
          isConnecting: false,
          connectionError: 'Server is rejecting connections. Please try again later.',
          isCircuitOpen: true
        });

        // Reset circuit breaker after configured duration
        this.circuitBreakerTimeout = setTimeout(() => {
          console.log('[SocketManager] Resetting circuit breaker');
          this.updateState({
            retryCount: 0,
            isCircuitOpen: false,
            connectionError: null
          });
        }, this.config.circuitBreakerDuration);
      } else {
        // Schedule retry with exponential backoff
        const delay = Math.min(
          this.config.baseDelay * Math.pow(2, this.state.retryCount - 1),
          this.config.maxDelay
        );

        this.updateState({
          isConnecting: false,
          connectionError: `Connection failed. Retrying in ${Math.round(delay/1000)}s... (${this.state.retryCount}/${this.config.maxRetries})`
        });

        this.retryTimeout = setTimeout(() => {
          if (!this.isDestroyed && !this.state.isCircuitOpen) {
            console.log(`[SocketManager] Retrying connection (attempt ${this.state.retryCount + 1})`);
            this.connect().catch(() => {}); // Ignore errors, they're handled above
          }
        }, delay);
      }
    } else {
      this.updateState({
        isConnecting: false,
        connectionError: errorMessage
      });
    }
  }

  private setupSocketEvents(socket: Socket) {
    socket.on('disconnect', (reason: string) => {
      console.log('[SocketManager] Disconnected:', reason);
      this.updateState({
        isConnected: false,
        isConnecting: false
      });

      // Auto-reconnect for certain disconnection reasons
      if (reason === 'io server disconnect') {
        this.updateState({ connectionError: 'Disconnected by server' });
      } else if (reason === 'transport close' || reason === 'ping timeout') {
        if (!this.isDestroyed && !this.state.isCircuitOpen) {
          console.log('[SocketManager] Attempting to reconnect after connection loss');
          setTimeout(() => this.connect().catch(() => {}), 2000);
        }
      }
    });

    socket.on('connect_error', (error: Error) => {
      console.error('[SocketManager] Runtime connection error:', error);
      this.handleConnectionError(error);
    });

    // Forward all events to registered handlers
    const originalEmit = socket.emit.bind(socket);
    const originalOn = socket.on.bind(socket);

    socket.on = ((event: string, handler: EventHandler) => {
      const wrappedHandler = (...args: any[]) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[SocketManager] Error in event handler for ${event}:`, error);
        }
      };
      return originalOn(event, wrappedHandler);
    }) as any;
  }

  public registerHandler(namespace: string, event: SocketEventName, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(namespace)) {
      this.eventHandlers.set(namespace, new Map());
    }

    const namespaceHandlers = this.eventHandlers.get(namespace)!;
    namespaceHandlers.set(event, handler);

    // If socket is connected, register the handler immediately
    if (this.socket?.connected) {
      this.socket.on(event, handler);
    }

    return () => {
      const handlers = this.eventHandlers.get(namespace);
      if (handlers) {
        handlers.delete(event);
        if (handlers.size === 0) {
          this.eventHandlers.delete(namespace);
        }
      }
      if (this.socket) {
        this.socket.off(event, handler);
      }
    };
  }

  public emit(event: string, data?: any): boolean {
    if (!this.socket?.connected) {
      console.warn(`[SocketManager] Cannot emit ${event} - not connected`);
      return false;
    }

    try {
      this.socket.emit(event, data);
      return true;
    } catch (error) {
      console.error(`[SocketManager] Error emitting ${event}:`, error);
      return false;
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public getState(): ConnectionState {
    return { ...this.state };
  }

  public forceReconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.updateState({
      isConnected: false,
      isConnecting: false,
      retryCount: 0,
      isCircuitOpen: false
    });
    this.connect().catch(() => {});
  }

  public destroy(): void {
    console.log('[SocketManager] Destroying socket manager');
    
    this.isDestroyed = true;

    // Clear timeouts
    if (this.circuitBreakerTimeout) {
      clearTimeout(this.circuitBreakerTimeout);
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    // Clear listeners
    this.listeners.clear();
    this.eventHandlers.clear();

    // Disconnect socket
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.connectionPromise = null;
    
    // Remove global listeners
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.destroy.bind(this));
    }
  }
}

// Global singleton instance
let globalSocketManager: SocketManager | null = null;

export function getSocketManager(config?: Partial<SocketManagerConfig>): SocketManager {
  if (!globalSocketManager || globalSocketManager['isDestroyed']) {
    globalSocketManager = new SocketManager(config);
  }
  return globalSocketManager;
}

export function destroySocketManager(): void {
  if (globalSocketManager) {
    globalSocketManager.destroy();
    globalSocketManager = null;
  }
}

export type { ConnectionState, SocketManagerConfig };
export { SocketManager };