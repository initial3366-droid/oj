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
import { Client, StompSubscription } from "@stomp/stompjs";
import { getValidFrontendAccessToken } from "../api/authSession";

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
  private isConnecting = false;
  private isConnected = false;
  private connectPromise: Promise<void> | null = null;

  /**
   * 连接到 WebSocket 服务器
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.isConnecting && this.connectPromise) {
      return this.connectPromise;
    }

    this.isConnecting = true;
    this.connectPromise = new Promise((resolve, reject) => {
      (async () => {
        const token = await getValidFrontendAccessToken();
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
            const latestToken = await getValidFrontendAccessToken();
            if (!latestToken) {
              throw new Error("未登录");
            }
            if (this.client) {
              this.client.connectHeaders = { Authorization: `Bearer ${latestToken}` };
            }
          },
          debug: (str) => {
            if (import.meta.env.DEV) {
              console.log("[WebSocket]", str);
            }
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
          webSocketFactory: () => new WebSocket(nativeWebSocketUrl(WS_URL)),
          onConnect: () => {
            this.isConnected = true;
            this.isConnecting = false;
            if (import.meta.env.DEV) console.log("WebSocket 已连接");
            resolve();
          },
          onStompError: (frame) => {
            console.error("WebSocket STOMP 错误:", frame);
            this.isConnecting = false;
            reject(new Error("连接失败"));
          },
          onWebSocketError: (event) => {
            console.error("WebSocket 错误:", event);
            this.isConnecting = false;
            reject(new Error("连接失败"));
          },
          onDisconnect: () => {
            this.isConnected = false;
            if (import.meta.env.DEV) console.log("WebSocket 已断开");
          },
        });

        this.client.onWebSocketClose = (event) => {
          if (this.isConnected || this.isConnecting) {
            this.isConnected = false;
            this.isConnecting = false;
            if (import.meta.env.DEV) console.warn("WebSocket 已关闭:", event);
          }
        };

        this.client.activate();
      })().catch((error) => {
        this.isConnecting = false;
        reject(error instanceof Error ? error : new Error("连接失败"));
      });
    });

    return this.connectPromise;
  }

  /**
   * 断开 WebSocket 连接
   */
  disconnect(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();

    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.connectPromise = null;
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

    // 如果已经订阅，先取消
    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key)!.unsubscribe();
    }

    const subscription = this.client!.subscribe(destination, (message) => {
      const update = JSON.parse(message.body) as SubmissionUpdate;
      callback(update);
    });

    this.subscriptions.set(key, subscription);

    // 返回取消订阅函数
    return () => {
      subscription.unsubscribe();
      this.subscriptions.delete(key);
    };
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

    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key)!.unsubscribe();
    }

    const subscription = this.client!.subscribe(destination, (message) => {
      const update = JSON.parse(message.body) as ScoreboardUpdate;
      callback(update);
    });

    this.subscriptions.set(key, subscription);

    return () => {
      subscription.unsubscribe();
      this.subscriptions.delete(key);
    };
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

    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key)!.unsubscribe();
    }

    const subscription = this.client!.subscribe(destination, (message) => {
      const update = JSON.parse(message.body) as SubmissionQueueUpdate;
      callback(update);
    });

    this.subscriptions.set(key, subscription);

    return () => {
      subscription.unsubscribe();
      this.subscriptions.delete(key);
    };
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

    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key)!.unsubscribe();
    }

    const subscription = this.client!.subscribe(destination, (message) => {
      const announcement = JSON.parse(message.body) as ContestAnnouncement;
      callback(announcement);
    });

    this.subscriptions.set(key, subscription);

    return () => {
      subscription.unsubscribe();
      this.subscriptions.delete(key);
    };
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

    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key)!.unsubscribe();
    }

    const subscription = this.client!.subscribe(destination, (message) => {
      const update = JSON.parse(message.body) as ContestStatusUpdate;
      callback(update);
    });

    this.subscriptions.set(key, subscription);

    return () => {
      subscription.unsubscribe();
      this.subscriptions.delete(key);
    };
  }
}

// 单例模式
export const wsClient = new WebSocketClient();
