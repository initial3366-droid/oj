import { readAuthToken } from '../api/tokenStorage';
/**
 * STOMP over WebSocket 客户端（单例模式）。
 *
 * 功能：
 * - 自动连接/重连（SockJS 降级支持）
 * - STOMP 消息订阅（提交状态 / 比赛榜单 / 判题队列 / 公告）
 * - Token 自动续期（Access Token 过期时静默刷新）
 *
 * 使用方式：
 * import { wsClient } from '../utils/websocket'
 * wsClient.subscribeToSubmission(id, callback)
 */
import { Client, TickerStrategy, type IMessage, type StompSubscription } from "@stomp/stompjs";
import { getValidFrontendAccessToken } from "../api/authSession";
import { refreshAdminAccessToken } from '../admin/api/adminClient';
import type { ContestMessage } from '../api/contestMessages';

export interface ContestMessageEvent { contestId: number; message: ContestMessage }

const WS_URL = import.meta.env.VITE_WS_URL || "/ws";

/**
 * 封装nativeWebSocketUrl相关逻辑。可能改变当前路由或查询参数。
 */
function nativeWebSocketUrl(path: string) {
  if (/^wss?:\/\//i.test(path)) {
    return path;
  }
  if (/^https?:\/\//i.test(path)) {
    return path.replace(/^http/i, "ws");
  }
  const origin = window.location.origin.replace(/^http/i, "ws");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * 提交Update接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface SubmissionUpdate {
  submissionId: number;
  status: string;
  time: number;
  memory: number;
  timestamp: number;
}

/**
 * 榜单Update接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ScoreboardUpdate {
  contestId: number;
  action: "refresh";
  timestamp: number;
}

/**
 * 提交队列Update接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface SubmissionQueueUpdate {
  action: "refresh";
  timestamp: number;
}

/**
 * 比赛公告接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestAnnouncement {
  contestId: number;
  title: string;
  content: string;
  timestamp: number;
}

/**
 * 比赛状态Update接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestStatusUpdate {
  contestId: number;
  status: string;
  timestamp: number;
}

class WebSocketClient {
  private client: Client | null = null;
  private subscriptions: Map<string, StompSubscription> = new Map();
  private subscriptionDefinitions = new Map<string, { destination: string; callback: (message: IMessage) => void }>();
  private isConnecting = false;
  private isConnected = false;
  private connectPromise: Promise<void> | null = null;
  private connectionGeneration = 0;
  private pageSuspended = false;
  private resumeAfterPageShow = false;
  private cancelConnect: (() => void) | undefined;
  private contestReady = false;
  private tokenTimer: number | undefined;
  private readyTimer: number | undefined;
  private contestListeners = new Set<{ event: (event: ContestMessageEvent) => void; ready: () => void; state: (connected: boolean) => void }>();
  private pendingMessages = new Map<string, { resolve: (message: ContestMessage) => void; reject: (error: Error) => void; timer: number }>();

  constructor(private getToken = getValidFrontendAccessToken) {
    window.addEventListener('pagehide', () => {
      if (this.pageSuspended) return;
      const resume = !!this.client?.active || this.isConnecting;
      this.pageSuspended = true;
      this.disconnect(true);
      this.resumeAfterPageShow = resume;
    });
    window.addEventListener('pageshow', () => {
      this.pageSuspended = false;
      if (!this.resumeAfterPageShow) return;
      this.resumeAfterPageShow = false;
      void this.connect().catch(() => { /* Connection state is shown by the messaging panel. */ });
    });
  }

  subscribeContestMessages(event: (event: ContestMessageEvent) => void, ready: () => void, state: (connected: boolean) => void) {
    const listener = { event, ready, state };
    this.contestListeners.add(listener);
    if (this.contestReady) queueMicrotask(() => { if (this.contestListeners.has(listener)) { state(true); ready(); } });
    void this.connect().catch(() => state(false));
    return () => { this.contestListeners.delete(listener); };
  }

  private messageConnectionClosed() {
    window.clearTimeout(this.readyTimer);
    this.contestReady = false;
    this.contestListeners.forEach(listener => listener.state(false));
    this.pendingMessages.forEach(pending => { window.clearTimeout(pending.timer); pending.reject(new Error('连接已断开，请重试')); });
    this.pendingMessages.clear();
  }

  async sendContestMessage(contestId: number, kind: 'QUESTION' | 'REPLY' | 'BROADCAST', content: string, requestId: string, participantId?: number): Promise<ContestMessage> {
    await this.connect();
    if (!this.contestReady || !this.client?.connected) throw new Error('消息连接尚未就绪，请稍后重试');
    if (this.pendingMessages.has(requestId)) throw new Error('消息正在发送，请稍候');
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => { this.pendingMessages.delete(requestId); reject(new Error('消息发送超时，请重试')); }, 15000);
      this.pendingMessages.set(requestId, { resolve, reject, timer });
      try {
        this.client!.publish({ destination: '/app/contest-messages/send', body: JSON.stringify({ contestId, kind, message: { content, requestId, participantId } }) });
      } catch (error) {
        window.clearTimeout(timer); this.pendingMessages.delete(requestId); reject(error);
      }
    });
  }

  /**
   * 连接到 WebSocket 服务器
   */
  async connect(): Promise<void> {
    if (this.pageSuspended) throw new Error('页面已挂起，恢复后重新连接');
    if (this.isConnected) {
      return;
    }

    if (this.isConnecting && this.connectPromise) {
      return this.connectPromise;
    }
    if (this.client?.active) return this.connectPromise ?? Promise.resolve();

    this.isConnecting = true;
    const generation = ++this.connectionGeneration;
    this.connectPromise = new Promise((resolve, reject) => {
      this.cancelConnect = () => reject(new Error('连接已取消'));
      (async () => {
        const token = await this.getToken();
        if (generation !== this.connectionGeneration) { reject(new Error('连接已取消')); return; }
        if (!token) {
          reject(new Error("未登录"));
          this.isConnecting = false;
          return;
        }

        this.client = new Client({
          connectHeaders: {
            Authorization: `Bearer ${token}`,
          },
          beforeConnect: async () => {
            const latestToken = await this.getToken();
            if (generation !== this.connectionGeneration) return;
            if (!latestToken) {
              void this.client?.deactivate();
              this.messageConnectionClosed();
              reject(new Error('未登录'));
              return;
            }
            if (this.client) {
              this.client.connectHeaders = { Authorization: `Bearer ${latestToken}` };
            }
            window.clearTimeout(this.tokenTimer);
            try {
              const payload = JSON.parse(atob(latestToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
              if (payload.exp) this.tokenTimer = window.setTimeout(() => this.client?.forceDisconnect(), Math.max(1000, payload.exp * 1000 - Date.now() - 20000));
            } catch { /* The server remains responsible for validating the token. */ }
          },
          debug: (str) => {
            if (import.meta.env.DEV) {
              console.log("[WebSocket]", str);
            }
          },
          reconnectDelay: 5000,
          connectionTimeout: 10000,
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
          heartbeatStrategy: TickerStrategy.Worker,
          webSocketFactory: () => new WebSocket(nativeWebSocketUrl(WS_URL)),
          onConnect: () => {
            if (generation !== this.connectionGeneration) return;
            this.isConnected = true;
            this.isConnecting = false;
            this.subscriptions.clear();
            this.subscriptionDefinitions.forEach(({ destination, callback }, key) => {
              this.subscriptions.set(key, this.client!.subscribe(destination, callback));
            });
            this.client!.subscribe('/user/queue/contest-message-acks', message => {
              if (generation !== this.connectionGeneration) return;
              const ack = JSON.parse(message.body);
              if (ack.ready === true) {
                window.clearTimeout(this.readyTimer);
                this.contestReady = true;
                this.contestListeners.forEach(listener => { listener.state(true); listener.ready(); });
                return;
              }
              const pending = this.pendingMessages.get(ack.requestId);
              if (!pending) return;
              window.clearTimeout(pending.timer); this.pendingMessages.delete(ack.requestId);
              if (ack.code === 200) pending.resolve(ack.message);
              else pending.reject(new Error(ack.error || '消息发送失败'));
            });
            this.client!.subscribe('/user/queue/contest-messages', message => {
              if (generation !== this.connectionGeneration) return;
              const event = JSON.parse(message.body) as ContestMessageEvent;
              this.contestListeners.forEach(listener => listener.event(event));
            });
            this.client!.publish({ destination: '/app/contest-messages/ready', body: '{}' });
            this.readyTimer = window.setTimeout(() => { if (!this.contestReady) this.client?.forceDisconnect(); }, 10000);
            if (import.meta.env.DEV) console.log("WebSocket 已连接");
            resolve();
          },
          onStompError: (frame) => {
            if (generation !== this.connectionGeneration) return;
            console.error("WebSocket STOMP 错误:", frame.headers.message || '服务器拒绝连接', frame.body);
            this.isConnecting = false;
            reject(new Error("连接失败"));
          },
          onWebSocketError: (event) => {
            if (generation !== this.connectionGeneration) return;
            console.error("WebSocket 错误:", event);
            this.isConnecting = false;
            reject(new Error("连接失败"));
          },
          onDisconnect: () => {
            if (generation !== this.connectionGeneration) return;
            this.isConnected = false;
            this.messageConnectionClosed();
            if (import.meta.env.DEV) console.log("WebSocket 已断开");
          },
        });

        this.client.onWebSocketClose = (event) => {
          if (generation !== this.connectionGeneration) return;
          this.messageConnectionClosed();
          if (this.isConnected || this.isConnecting) {
            this.isConnected = false;
            this.isConnecting = false;
            if (import.meta.env.DEV) console.warn("WebSocket 已关闭:", event);
          }
        };

        this.client.activate();
      })().catch((error) => {
        if (generation === this.connectionGeneration) this.isConnecting = false;
        reject(error instanceof Error ? error : new Error("连接失败"));
      });
    });

    return this.connectPromise;
  }

  /**
   * 断开 WebSocket 连接
   */
  disconnect(preserveSubscriptions = false): void {
    this.connectionGeneration += 1;
    this.resumeAfterPageShow = false;
    this.cancelConnect?.();
    this.cancelConnect = undefined;
    window.clearTimeout(this.tokenTimer);
    this.messageConnectionClosed();
    this.subscriptions.clear();
    if (!preserveSubscriptions) this.subscriptionDefinitions.clear();

    if (this.client) {
      // Closing the transport also removes broker subscriptions. Do not send
      // cleanup frames to a session the browser/server may already have closed.
      void this.client.deactivate({ force: true });
      this.client = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.connectPromise = null;
  }

  private subscribe(key: string, destination: string, callback: (message: IMessage) => void): () => void {
    const previous = this.subscriptions.get(key);
    if (previous && this.client?.connected) previous.unsubscribe();
    const definition = { destination, callback };
    this.subscriptionDefinitions.set(key, definition);
    this.subscriptions.set(key, this.client!.subscribe(destination, callback));
    return () => {
      // A stale Vue effect cleanup must not remove a replacement subscription.
      if (this.subscriptionDefinitions.get(key) !== definition) return;
      const current = this.subscriptions.get(key);
      if (current && this.client?.connected) current.unsubscribe();
      this.subscriptions.delete(key);
      this.subscriptionDefinitions.delete(key);
    };
  }

  /**
   * 订阅提交状态更新
   */
  async subscribeToSubmission(
    submissionId: number,
    callback: (update: SubmissionUpdate) => void
  ): Promise<() => void> {
    await this.connect();

    const destination = `/topic/submissions/${submissionId}`;
    const key = `submission-${submissionId}`;

    return this.subscribe(key, destination, message => {
      callback(JSON.parse(message.body) as SubmissionUpdate);
    });
  }

  /**
   * 订阅比赛榜单更新
   */
  async subscribeToContestScoreboard(
    contestId: number,
    callback: (update: ScoreboardUpdate) => void
  ): Promise<() => void> {
    await this.connect();

    const destination = `/topic/contests/${contestId}/scoreboard`;
    const key = `scoreboard-${contestId}`;

    return this.subscribe(key, destination, message => {
      callback(JSON.parse(message.body) as ScoreboardUpdate);
    });
  }

  /**
   * 订阅提交队列更新
   */
  async subscribeToSubmissionQueue(
    callback: (update: SubmissionQueueUpdate) => void
  ): Promise<() => void> {
    await this.connect();

    const destination = "/topic/submission-queue";
    const key = "submission-queue";

    return this.subscribe(key, destination, message => {
      callback(JSON.parse(message.body) as SubmissionQueueUpdate);
    });
  }

  /**
   * 订阅比赛公告
   */
  async subscribeToContestAnnouncements(
    contestId: number,
    callback: (announcement: ContestAnnouncement) => void
  ): Promise<() => void> {
    await this.connect();

    const destination = `/topic/contests/${contestId}/announcements`;
    const key = `announcements-${contestId}`;

    return this.subscribe(key, destination, message => {
      callback(JSON.parse(message.body) as ContestAnnouncement);
    });
  }

  /**
   * 订阅比赛状态更新
   */
  async subscribeToContestStatus(
    contestId: number,
    callback: (update: ContestStatusUpdate) => void
  ): Promise<() => void> {
    await this.connect();

    const destination = `/topic/contests/${contestId}/status`;
    const key = `status-${contestId}`;

    return this.subscribe(key, destination, message => {
      callback(JSON.parse(message.body) as ContestStatusUpdate);
    });
  }

}

// 单例模式
export const wsClient = new WebSocketClient();
export const adminWsClient = new WebSocketClient(async () => {
  const token = readAuthToken('admin');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now() + 30000) return refreshAdminAccessToken();
  } catch { return null; }
  return token;
});
