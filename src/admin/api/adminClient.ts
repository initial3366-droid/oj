import { clearAuthTokens, readAuthToken, storeAuthTokens } from '../../api/tokenStorage';
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

export class AdminApiError extends Error {
  constructor(message: string, readonly status: number, readonly code = status) {
    super(message);
    this.name = 'AdminApiError';
  }
}

const API_TIMEOUT_MS = 15000;
let adminRefreshPromise: Promise<string | null> | null = null;

/**
 * 封装timeoutSignal相关逻辑。
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
  const cancel = () => controller.abort();
  if (init.signal?.aborted) cancel();
  else init.signal?.addEventListener('abort', cancel, { once: true });
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("请求超时，请检查后端服务");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener('abort', cancel);
  }
}

/**
 * 读取管理员令牌并返回给调用方。会读写浏览器本地会话信息。
 */
export function getAdminToken(): string | null {
  return readAuthToken('admin');
}

/**
 * 读取管理员Refresh令牌并返回给调用方。会读写浏览器本地会话信息。
 */
function getAdminRefreshToken(): string | null {
  return readAuthToken('admin', 'refresh');
}

/**
 * 封装set管理员令牌相关逻辑会读写浏览器本地会话信息。
 */
export function setAdminToken(token: string, refreshToken?: string, rememberMe?: boolean) {
  loginRedirectPending = false;
  storeAuthTokens('admin', token, refreshToken, rememberMe);
  window.dispatchEvent(new Event('qoj:admin-auth-changed'));
}

/**
 * 重置管理员令牌。会读写浏览器本地会话信息。
 */
export function clearAdminToken() {
  clearAuthTokens('admin');
  window.dispatchEvent(new Event('qoj:admin-auth-changed'));
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
let loginRedirectPending = false;

function handleUnauthorized() {
  clearAdminToken();
  const loginPath = adminPath('/login');
  if (!loginRedirectPending && !window.location.pathname.startsWith(loginPath)) {
    loginRedirectPending = true;
    window.location.href = loginPath;
  }
}

/**
 * 封装refresh管理员访问令牌相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口失败时向调用方传播异常。
 */
export async function refreshAdminAccessToken() {
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
      if (getAdminRefreshToken() !== refreshToken) return getAdminToken();
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
    throw new AdminApiError("未登录或登录已过期，请重新登录", 401);
  }

  if (response.status === 401) {
    throw new AdminApiError(sanitizeErrorMessage(body?.message || "账号或密码错误"), response.status, Number(body?.code ?? response.status));
  }

  if (response.status === 403) {
    throw new AdminApiError(sanitizeErrorMessage(body?.message || "权限不足，无法访问该资源"), response.status, Number(body?.code ?? response.status));
  }

  if (response.status === 404) {
    throw new AdminApiError(sanitizeErrorMessage(body?.message || `${endpointLabel} 不存在，请确认后端服务已更新并重启`), response.status, Number(body?.code ?? response.status));
  }

  if (response.status === 500) {
    throw new AdminApiError(sanitizeErrorMessage(body?.message || "服务器内部错误，请稍后重试"), response.status, Number(body?.code ?? response.status));
  }

  if (!response.ok) {
    throw new AdminApiError(sanitizeErrorMessage(body?.message || `请求失败：${response.status}`), response.status, Number(body?.code ?? response.status));
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
    throw new AdminApiError(sanitizeErrorMessage(body.message || fallbackMessage), response.status, Number(body.code));
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

export interface TestCaseImportProgress {
  phase: 'reading' | 'parsed' | 'saved' | 'savingDraft';
  current: number;
  total: number | null;
  caseNo: number;
}

/** 上传表单，报告上传和服务端逐测试点进度，复用后台认证和响应解析。 */
export async function adminUpload<T>(
  url: string,
  body: FormData,
  options: {
    timeoutMs: number;
    onProgress: (percent: number | null) => void;
    onUploaded: () => void;
    onProcessing?: (progress: TestCaseImportProgress) => void;
  },
): Promise<T> {
  const requestUrl = url.startsWith('/api/admin/v1') ? adminPath(url) : url;
  let token = getAdminToken() || await refreshAdminAccessToken();
  if (!token) {
    handleUnauthorized();
    throw new Error('请先登录');
  }
  const send = (accessToken: string) => new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', requestUrl);
    xhr.timeout = options.timeoutMs;
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.upload.onprogress = (event) => options.onProgress(
      event.lengthComputable ? Math.round(event.loaded / event.total * 100) : null,
    );
    xhr.upload.onload = () => options.onUploaded();
    let consumed = 0;
    let result: ApiResponse<T> | undefined;
    const isStream = () => xhr.getResponseHeader('Content-Type')?.includes('application/x-ndjson');
    const consume = () => {
      const text = xhr.responseText;
      let end: number;
      while ((end = text.indexOf('\n', consumed)) !== -1) {
        const line = text.slice(consumed, end).trim();
        consumed = end + 1;
        if (!line) continue;
        const event = JSON.parse(line) as { type: string; data: TestCaseImportProgress | ApiResponse<T> };
        if (event.type === 'progress') options.onProcessing?.(event.data as TestCaseImportProgress);
        if (event.type === 'result') result = event.data as ApiResponse<T>;
      }
    };
    xhr.onprogress = () => {
      if (!isStream()) return;
      try { consume(); } catch {
        reject(new Error('导入进度响应格式错误，请刷新确认测试点是否已导入'));
        xhr.abort();
      }
    };
    xhr.onload = () => {
      if (isStream()) {
        try { consume(); } catch {
          reject(new Error('导入结果格式错误，请刷新确认测试点是否已导入'));
          return;
        }
        if (!result) {
          reject(new Error('导入连接已结束，但未收到最终结果，请刷新确认测试点是否已导入'));
          return;
        }
      }
      resolve(new Response(isStream() ? JSON.stringify(result) : xhr.responseText, {
        status: xhr.status,
        headers: { 'Content-Type': isStream() ? 'application/json' : xhr.getResponseHeader('Content-Type') || '' },
      }));
    };
    xhr.onerror = () => reject(new Error('上传失败，请检查网络连接'));
    xhr.ontimeout = () => reject(new Error(`导入请求超过 ${options.timeoutMs / 1000} 秒，请刷新确认测试点是否已导入，再决定是否重试`));
    xhr.onabort = () => reject(new Error('上传已取消'));
    options.onProgress(0);
    xhr.send(body);
  });
  let response = await send(token);
  if (response.status === 401) {
    token = await refreshAdminAccessToken();
    if (token) response = await send(token);
  }
  return parseResponse<T>(response, true, url);
}

/** 发起后台 POST 请求。 */
export async function adminPost<T>(
  url: string,
  body?: unknown,
  requireAuth = true,
  timeoutMs = API_TIMEOUT_MS,
  signal?: AbortSignal
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const response = await adminFetchWithAuth(url, {
    method: "POST",
    signal,
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
      let code = response.status;
      try {
        const result = await response.json() as ApiResponse<unknown>;
        message = result.message || message;
        code = Number(result.code ?? response.status);
      } catch {
        // Stream errors may use text/plain before the SSE response begins.
      }
      if (response.status === 401) handleUnauthorized();
      throw new AdminApiError(message, response.status, code);
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
      throw new AdminApiError(typeof payload.message === 'string' ? payload.message : 'AI 回复失败', 200, typeof payload.code === 'number' ? payload.code : 500);
    }
    if (event === 'continue' && typeof payload.continuationToken === 'string') {
      continuationToken = payload.continuationToken; completed = true; return true;
    }
    if (event === 'approval_required' && typeof payload.continuationToken === 'string') {
      continuationToken = payload.continuationToken; completed = true; return true;
    }
    if (event === 'done') {
      completed = true;
      return true;
    }
  }, signal, { idleTimeoutMs: 1200000, totalTimeoutMs: 1200000 });
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
export async function adminDownload(url: string, filename: string, requireAuth = true, timeoutMs = API_TIMEOUT_MS): Promise<void> {
  const response = await adminFetchWithAuth(url, {
    method: "GET",
  }, requireAuth, true, timeoutMs);

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
