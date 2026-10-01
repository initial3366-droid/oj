/**
 * 后台管理专用 API 客户端
 * 与前台 API 客户端完全隔离
 */
import { adminPath } from '../../utils/adminPath';

/**
 * Api响应接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

const API_TIMEOUT_MS = 15000;
const ADMIN_TOKEN_KEY = "qoj.adminAccessToken";
const ADMIN_REFRESH_TOKEN_KEY = "qoj.adminRefreshToken";
let adminRefreshPromise: Promise<string | null> | null = null;

/**
 * 封装timeoutSignal相关逻辑。会更新 React 状态并触发重新渲染。
 */
function timeoutSignal(timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

/**
 * 读取WithTimeout并返回给调用方。包含异步流程并由调用方处理完成或失败状态；失败时向调用方传播异常。
 */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number | null = API_TIMEOUT_MS) {
  if (timeoutMs === null) return fetch(url, init);
  const { controller, timeout } = timeoutSignal(timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("请求超时，请检查后端服务");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * 读取管理员令牌并返回给调用方。会读写浏览器本地会话信息。
 */
function getAdminToken(): string | null {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

/**
 * 读取管理员Refresh令牌并返回给调用方。会读写浏览器本地会话信息。
 */
function getAdminRefreshToken(): string | null {
  return window.localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);
}

/**
 * 封装set管理员令牌相关逻辑。会更新 React 状态并触发重新渲染；会读写浏览器本地会话信息。
 */
export function setAdminToken(token: string, refreshToken?: string) {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  if (refreshToken) {
    window.localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, refreshToken);
  }
}

/**
 * 重置管理员令牌。会读写浏览器本地会话信息。
 */
export function clearAdminToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
}

/**
 * 封装管理员退出登录相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口。
 */
export async function adminLogout() {
  try {
    let token = getAdminToken();
    if (!token) token = await refreshAdminAccessToken();
    if (!token) return;

    let response = await fetchWithTimeout('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: getAdminRefreshToken() }),
    });
    if (response.status === 401) {
      token = await refreshAdminAccessToken();
      if (token) {
        response = await fetchWithTimeout('/api/v1/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: getAdminRefreshToken() }),
        });
      }
    }
  } finally {
    clearAdminToken();
  }
}

/**
 * 处理Unauthorized。可能改变当前路由或查询参数。
 */
function handleUnauthorized() {
  clearAdminToken();
  const loginPath = adminPath('/login');
  if (!window.location.pathname.startsWith(loginPath)) {
    window.location.href = loginPath;
  }
}

/**
 * 封装refresh管理员访问令牌相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；失败时向调用方传播异常。
 */
async function refreshAdminAccessToken() {
  const refreshToken = getAdminRefreshToken();
  if (!refreshToken) {
    return null;
  }

  if (!adminRefreshPromise) {
    adminRefreshPromise = (async () => {
      const response = await fetchWithTimeout('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      let body: ApiResponse<{ accessToken: string; refreshToken: string }> | null = null;
      try {
        body = (await response.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>;
      } catch {
        body = null;
      }
      if (response.status === 401 || response.status === 403) {
        clearAdminToken();
        return null;
      }
      if (!response.ok) {
        throw new Error(body?.message || `刷新登录状态失败：${response.status}`);
      }
      if (!body || body.code !== 200 || !body.data?.accessToken || !body.data?.refreshToken) {
        throw new Error(body?.message || '刷新登录状态返回格式错误');
      }
      setAdminToken(body.data.accessToken, body.data.refreshToken);
      return body.data.accessToken;
    })().finally(() => {
      adminRefreshPromise = null;
    });
  }

  return adminRefreshPromise;
}

/**
 * 封装管理员FetchWith认证相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；失败时向调用方传播异常。
 */
async function adminFetchWithAuth(
  url: string,
  init: RequestInit,
  requireAuth: boolean,
  allowRefresh = true,
  timeoutMs: number | null = API_TIMEOUT_MS
) {
  if (url.startsWith('/api/admin/v1')) {
    url = adminPath(url);
  }
  let token = getAdminToken();

  if (requireAuth && !token) {
    token = await refreshAdminAccessToken();
  }

  if (requireAuth && !token) {
    handleUnauthorized();
    throw new Error("请先登录");
  }

  const response = await fetchWithTimeout(url, {
    ...init,
    headers: {
      ...(requireAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  }, timeoutMs);

  if (response.status === 401 && requireAuth && allowRefresh) {
    const nextToken = await refreshAdminAccessToken();
    if (nextToken) {
      return adminFetchWithAuth(url, init, requireAuth, false, timeoutMs);
    }
  }

  return response;
}

/**
 * 解析并规范化响应。包含异步流程并由调用方处理完成或失败状态；失败时向调用方传播异常。
 */
async function parseResponse<T>(response: Response, shouldHandleUnauth: boolean, url?: string): Promise<T> {
  let body: ApiResponse<T> | null = null;
  let rawText = "";

  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = (await response.json()) as ApiResponse<T>;
    } else {
      rawText = await response.text();
    }
  } catch {
    body = null;
  }

  const endpointLabel = url ? `接口 ${url}` : "接口";

  // 过滤敏感错误信息
  const sanitizeErrorMessage = (message: string): string => {
    if (!message) return "操作失败，请稍后重试";
    // 过滤可能的堆栈信息、Java异常类名等技术细节
    if (message.includes('Exception') || message.includes(' at ') ||
        message.includes('.java:') || message.includes('Stack trace')) {
      return "操作失败，请稍后重试";
    }
    return message;
  };

  // 对于需要认证的请求，401 时跳转到登录页
  if (response.status === 401 && shouldHandleUnauth) {
    handleUnauthorized();
    throw new Error("未登录或登录已过期，请重新登录");
  }

  if (response.status === 401) {
    throw new Error(sanitizeErrorMessage(body?.message || "账号或密码错误"));
  }

  if (response.status === 403) {
    throw new Error(sanitizeErrorMessage(body?.message || "权限不足，无法访问该资源"));
  }

  if (response.status === 404) {
    throw new Error(sanitizeErrorMessage(body?.message || `${endpointLabel} 不存在，请确认后端服务已更新并重启`));
  }

  if (response.status === 500) {
    throw new Error(sanitizeErrorMessage(body?.message || "服务器内部错误，请稍后重试"));
  }

  if (!response.ok) {
    throw new Error(sanitizeErrorMessage(body?.message || `请求失败：${response.status}`));
  }

  if (!body) {
    const text = rawText.trim().toLowerCase();
    const isHtml = text.startsWith("<!doctype") || text.startsWith("<html");
    throw new Error(
      isHtml
        ? `${endpointLabel} 返回了前端页面，不是接口数据，请确认后端已更新并重启`
        : `${endpointLabel} 返回格式错误，请检查后端响应`
    );
  }

  if (Number(body.code) !== 200) {
    const fallbackMessage = body.code == null
      ? `${endpointLabel} 请求失败`
      : `${endpointLabel} 请求失败（业务码：${body.code}）`;
    throw new Error(sanitizeErrorMessage(body.message || fallbackMessage));
  }

  return body.data;
}

/**
 * 解析并规范化DownloadError。包含异步流程并由调用方处理完成或失败状态；失败时向调用方传播异常。
 */
async function parseDownloadError(response: Response, shouldHandleUnauth: boolean): Promise<never> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    await parseResponse<never>(response, shouldHandleUnauth);
  }

  let message = "";
  try {
    message = (await response.text()).trim();
  } catch {
    message = "";
  }

  if (response.status === 401 && shouldHandleUnauth) {
    handleUnauthorized();
    throw new Error("未登录或登录已过期，请重新登录");
  }
  if (response.status === 403) {
    throw new Error(message || "权限不足，无法访问该资源");
  }
  if (response.status === 404) {
    throw new Error(message || "导出接口不存在，请确认后端服务已更新并重启");
  }
  if (response.status === 500) {
    throw new Error("服务器内部错误，请稍后重试");
  }
  throw new Error(message || `下载失败：${response.status}`);
}

/**
 * 封装管理员Get相关逻辑。包含异步流程并由调用方处理完成或失败状态。
 */
export async function adminGet<T>(url: string, requireAuth = true): Promise<T> {
  const response = await adminFetchWithAuth(url, {
    method: "GET",
  }, requireAuth);

  return parseResponse<T>(response, requireAuth, url);
}

/** Fetch private chat images with the same authentication and refresh rules as other admin APIs. */
export async function adminGetBlob(url: string): Promise<Blob> {
  const response = await adminFetchWithAuth(url, { method: 'GET' }, true);
  if (!response.ok) await parseResponse<never>(response, true, url);
  return response.blob();
}

/**
 * 封装管理员Post相关逻辑。包含异步流程并由调用方处理完成或失败状态。
 */
export async function adminPost<T>(
  url: string,
  body?: unknown,
  requireAuth = true,
  timeoutMs = API_TIMEOUT_MS
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const response = await adminFetchWithAuth(url, {
    method: "POST",
    headers: {
      ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
    },
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  }, requireAuth, true, timeoutMs);

  return parseResponse<T>(response, requireAuth, url);
}

/** 发起带管理员 JWT 的 SSE 请求，用于独立服务的长时间流式任务。 */
export async function adminPostEventStream(
  url: string,
  body: unknown,
  onEvent: (event: string, data: Record<string, unknown>) => void | boolean,
  signal?: AbortSignal,
  options: { idleTimeoutMs?: number; totalTimeoutMs?: number } = {},
): Promise<void> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  let idleTimer: number | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const timeout = () => { timedOut = true; controller.abort(); };
  const resetIdleTimer = () => {
    window.clearTimeout(idleTimer);
    if (options.idleTimeoutMs) idleTimer = window.setTimeout(timeout, options.idleTimeoutMs);
  };
  const totalTimer = options.totalTimeoutMs ? window.setTimeout(timeout, options.totalTimeoutMs) : undefined;
  resetIdleTimer();
  try {
    const response = await adminFetchWithAuth(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    }, true, true, null);

    if (!response.ok) {
      let message = `请求失败：${response.status}`;
      try {
        const result = await response.json() as ApiResponse<unknown>;
        message = result.message || message;
      } catch {
        // Stream errors may use text/plain before the SSE response begins.
      }
      if (response.status === 401) handleUnauthorized();
      throw new Error(message);
    }
    if (!response.body) throw new Error('AI 服务没有返回流式响应');

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const consumeBlock = (block: string) => {
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (!data.length) return;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(data.join('\n')) as Record<string, unknown>;
      } catch {
        throw new Error('AI 流式响应格式错误');
      }
      return onEvent(event, payload) === true;
    };

    while (true) {
      const { value, done } = await reader.read();
      resetIdleTimer();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        // A terminal SSE event completes the request even if the peer keeps HTTP open.
        if (consumeBlock(block)) return;
      }
      if (done) break;
    }
    if (buffer.trim()) consumeBlock(buffer);
  } catch (error) {
    if (timedOut) throw new Error('AI 回复超时，请稍后重试');
    throw error;
  } finally {
    window.clearTimeout(idleTimer);
    window.clearTimeout(totalTimer);
    signal?.removeEventListener('abort', abort);
    if (reader) {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
}

/** 发起带管理员认证的 SSE 请求；流式生成不使用普通 JSON 接口的 15 秒请求时限。 */
export async function adminPostStream(
  url: string,
  body: unknown,
  onDelta: (content: string) => void,
  signal?: AbortSignal,
  onEvent?: (event: string, payload: Record<string, unknown>) => void,
): Promise<string | undefined> {
  let completed = false;
  let continuationToken: string | undefined;
  await adminPostEventStream(url, body, (event, payload) => {
    onEvent?.(event, payload);
    if (event === 'delta' && typeof payload.content === 'string' && payload.content) {
      onDelta(payload.content);
    }
    if (event === 'stopped') throw new DOMException('Aborted', 'AbortError');
    if (event === 'error') {
      throw new Error(typeof payload.message === 'string' ? payload.message : 'AI 回复失败');
    }
    if (event === 'continue' && typeof payload.continuationToken === 'string') {
      continuationToken = payload.continuationToken; completed = true; return true;
    }
    if (event === 'done') {
      completed = true;
      return true;
    }
  }, signal, { idleTimeoutMs: 150000, totalTimeoutMs: 180000 });
  if (!completed) throw new Error('AI 回复连接已中断，请重试');
  return continuationToken;
}

/**
 * 封装管理员Put相关逻辑。包含异步流程并由调用方处理完成或失败状态。
 */
export async function adminPut<T>(
  url: string,
  body?: unknown,
  requireAuth = true
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const response = await adminFetchWithAuth(url, {
    method: "PUT",
    headers: {
      ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
    },
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  }, requireAuth);

  return parseResponse<T>(response, requireAuth, url);
}

/**
 * 封装管理员Delete相关逻辑。包含异步流程并由调用方处理完成或失败状态。
 */
export async function adminDelete<T>(url: string, requireAuth = true, body?: unknown): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const response = await adminFetchWithAuth(url, {
    method: "DELETE",
    headers: {
      ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
    },
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  }, requireAuth);

  return parseResponse<T>(response, requireAuth, url);
}

/**
 * 封装管理员Download相关逻辑。包含异步流程并由调用方处理完成或失败状态。
 */
export async function adminDownload(url: string, filename: string, requireAuth = true): Promise<void> {
  const response = await adminFetchWithAuth(url, {
    method: "GET",
  }, requireAuth);

  if (!response.ok) {
    await parseDownloadError(response, requireAuth);
  }

  const blob = await response.blob();
  const href = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(href);
}
