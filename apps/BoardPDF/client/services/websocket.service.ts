export interface AiProgressEvent {
  message?: string;
  percent?: number;
  result?: Record<string, unknown>;
  runtime?: string;
  sessionId?: string;
  stage: string;
  step?: number;
  tool?: string;
  totalSteps?: number;
}

export interface CollabJoinOptions {
  avatarUrl?: string | null;
  docId: string;
  isGuest?: boolean;
  onMessage: (msg: any) => void;
  userId?: number | string | null;
  username: string;
}

type ProgressCallback = (event: AiProgressEvent) => void;
type CollabCallback = (msg: any) => void;

class WebSocketClientService {
  private activeSubscriptions = new Map<string, Set<ProgressCallback>>();
  private collabCallbacks = new Set<CollabCallback>();
  private connectingSocket: WebSocket | null = null;
  private currentCollabJoin: Record<string, unknown> | null = null;
  private isConnecting = false;
  private pingInterval: number | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private socket: WebSocket | null = null;

  private isEditorRoute(): boolean {
    if (typeof window === 'undefined' || !window.location) return false;
    const path = window.location.pathname || '';
    return path.startsWith('/d/') || path === '/d' || path.startsWith('/collaborative-pdf/editor');
  }

  connect(sessionId?: string): Promise<WebSocket | null> {
    if (!this.isEditorRoute()) {
      return Promise.resolve(null);
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      if (sessionId) {
        this.sendSubscribe(sessionId);
      }
      if (this.currentCollabJoin) {
        this.send(this.currentCollabJoin);
      }
      return Promise.resolve(this.socket);
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const intervalId = window.setInterval(() => {
          if (!this.isEditorRoute()) {
            window.clearInterval(intervalId);
            resolve(null);
            return;
          }
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            window.clearInterval(intervalId);
            if (sessionId) this.sendSubscribe(sessionId);
            if (this.currentCollabJoin) this.send(this.currentCollabJoin);
            resolve(this.socket);
          } else if (!this.isConnecting) {
            window.clearInterval(intervalId);
            resolve(null);
          }
        }, 50);
      });
    }

    this.isConnecting = true;

    return new Promise((resolve) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname || 'localhost';
        const isDevPort = window.location.port === '3000' || window.location.port === '5173';
        const portSuffix = isDevPort ? ':3001' : (window.location.port ? `:${window.location.port}` : '');
        const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
        const wsUrl = `${protocol}//${hostname}${portSuffix}/ws/collab${query}`;

        const ws = new WebSocket(wsUrl);
        this.connectingSocket = ws;
        let wasOpened = false;

        ws.onopen = () => {
          wasOpened = true;
          if (this.connectingSocket !== ws || !this.isEditorRoute()) {
            try {
              ws.close();
            } catch (_) {}
            if (this.connectingSocket === ws) {
              this.connectingSocket = null;
            }
            this.isConnecting = false;
            resolve(null);
            return;
          }

          console.log('[WebSocket] Conexión establecida con éxito con BoardPDF WS (Rust).');
          this.socket = ws;
          this.connectingSocket = null;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();

          for (const [subId] of this.activeSubscriptions.entries()) {
            this.sendSubscribe(subId);
          }

          if (this.currentCollabJoin) {
            this.send(this.currentCollabJoin);
          }

          resolve(ws);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (this.collabCallbacks.size > 0) {
              for (const cb of this.collabCallbacks) {
                cb(data);
              }
            }

            const targets = [data.sessionId, data.chatId, data.target].filter(Boolean) as string[];
            const executedCallbacks = new Set<ProgressCallback>();

            for (const targetKey of targets) {
              const callbacks = this.activeSubscriptions.get(targetKey);
              if (callbacks) {
                for (const cb of callbacks) {
                  if (!executedCallbacks.has(cb)) {
                    executedCallbacks.add(cb);
                    cb(data);
                  }
                }
              }
            }
          } catch (_) {}
        };

        ws.onerror = () => {
          if (this.connectingSocket === ws) {
            this.connectingSocket = null;
          }
        };

        ws.onclose = () => {
          if (wasOpened) {
            console.log('[WebSocket] Conexión cerrada.');
          }
          if (this.connectingSocket === ws) {
            this.connectingSocket = null;
          }
          if (this.socket === ws) {
            this.socket = null;
          }
          this.isConnecting = false;
          this.stopHeartbeat();
          if (this.isEditorRoute()) {
            this.scheduleReconnect();
          }
          resolve(null);
        };
      } catch (_) {
        this.isConnecting = false;
        this.connectingSocket = null;
        resolve(null);
      }
    });
  }

  joinCollabRoom(options: CollabJoinOptions): () => void {
    const rawUserId = options.userId;
    const parsedUserId =
      rawUserId != null && rawUserId !== '' && !isNaN(Number(rawUserId))
        ? Number(rawUserId)
        : null;

    const payload = {
      avatarUrl: options.avatarUrl || null,
      docId: options.docId,
      isGuest: options.isGuest ?? (parsedUserId == null),
      type: 'join',
      userId: parsedUserId,
      username: options.username,
    };

    this.currentCollabJoin = payload;
    this.collabCallbacks.add(options.onMessage);

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send(payload);
    } else {
      void this.connect();
    }

    return () => {
      this.collabCallbacks.delete(options.onMessage);
      if (this.currentCollabJoin?.docId === options.docId) {
        this.currentCollabJoin = null;
        this.send({ type: 'leave' });
      }
      if (this.activeSubscriptions.size === 0 && this.collabCallbacks.size === 0) {
        this.disconnect();
      }
    };
  }

  subscribe(sessionId: string, callback: (event: any) => void): () => void {
    return this.subscribeAiProgress(sessionId, callback as ProgressCallback);
  }

  send(data: Record<string, unknown>): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  subscribeAiProgress(sessionId: string, callback: ProgressCallback): () => void {
    if (!this.activeSubscriptions.has(sessionId)) {
      this.activeSubscriptions.set(sessionId, new Set());
    }
    this.activeSubscriptions.get(sessionId)!.add(callback);

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendSubscribe(sessionId);
    } else {
      this.connect(sessionId);
    }

    return () => {
      this.unsubscribe(sessionId, callback);
    };
  }

  unsubscribe(sessionId: string, callback?: ProgressCallback): void {
    const set = this.activeSubscriptions.get(sessionId);
    if (set) {
      if (callback) {
        set.delete(callback);
      }
      if (!callback || set.size === 0) {
        this.activeSubscriptions.delete(sessionId);
        this.sendUnsubscribe(sessionId);
      }
      if (this.activeSubscriptions.size === 0 && this.collabCallbacks.size === 0) {
        this.disconnect();
      }
    }
  }

  private sendSubscribe(sessionId: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ sessionId, type: 'subscribe' }));
    }
  }

  private sendUnsubscribe(sessionId: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ sessionId, type: 'unsubscribe' }));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval !== null) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.isEditorRoute()) return;
    if (this.reconnectTimer !== null) return;
    if (this.activeSubscriptions.size === 0 && this.collabCallbacks.size === 0) return;

    const baseDelay = Math.min(2000 * Math.pow(1.5, Math.min(this.reconnectAttempts, 8)), 30000);
    const jitter = Math.floor(Math.random() * 1000);
    const delay = baseDelay + jitter;
    this.reconnectAttempts++;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isEditorRoute()) {
        void this.connect();
      }
    }, delay);
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.isConnecting = false;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectingSocket) {
      try {
        this.connectingSocket.close();
      } catch (_) {}
      this.connectingSocket = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch (_) {}
      this.socket = null;
    }
    this.activeSubscriptions.clear();
    this.collabCallbacks.clear();
    this.currentCollabJoin = null;
  }
}

export const wsService = new WebSocketClientService();
