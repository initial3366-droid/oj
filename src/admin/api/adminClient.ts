/**
 * 后台管理专用 API 客户端
 * 与前台 API 客户端完全隔离
 */
import { adminPath } from '../../utils/adminPath';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

const API_TIMEOUT_MS = 15000;
const ADMIN_TOKEN_KEY = "qoj.adminAccessToken";
const ADMIN_REFRESH_TOKEN_KEY = "qoj.adminRefreshToken";
let adminRefreshPromise: Promise<string | null> | null = null;

function timeoutSignal() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  return { controller, timeout };
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const { controller, timeout } = timeoutSignal();
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

function getAdminToken(): string | null {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

function getAdminRefreshToken(): string | null {
  return window.localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);
}

export function setAdminToken(token: string, refreshToken?: string) {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  if (refreshToken) {
    window.localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearAdminToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
}

function handleUnauthorized() {
  clearAdminToken();
  const loginPath = adminPath('/login');
  if (!window.location.pathname.startsWith(loginPath)) {
    window.location.href = loginPath;
  }
}

async function refreshAdminAccessToken() {
  const refreshToken = getAdminRefreshToken();
  if (!refreshToken) {
    return null;
  }

  if (!adminRefreshPromise) {
    adminRefreshPromise = (async () => {
      try {
        const response = await fetchWithTimeout('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const body = (await response.json()) as ApiResponse<{
          accessToken: string;
          refreshToken: string;
        }>;
        if (!response.ok || !body || body.code !== 200) {
          clearAdminToken();
          return null;
        }
        setAdminToken(body.data.accessToken, body.data.refreshToken);
        return body.data.accessToken;
      } catch {
        clearAdminToken();
        return null;
      }
    })().finally(() => {
      adminRefreshPromise = null;
    });
  }

  return adminRefreshPromise;
}

async function adminFetchWithAuth(
  url: string,
  init: RequestInit,
  requireAuth: boolean,
  allowRefresh = true
) {
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
  });

  if (response.status === 401 && requireAuth && allowRefresh) {
    const nextToken = await refreshAdminAccessToken();
    if (nextToken) {
      return adminFetchWithAuth(url, init, requireAuth, false);
    }
  }

  return response;
}

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

export async function adminGet<T>(url: string, requireAuth = true): Promise<T> {
  const response = await adminFetchWithAuth(url, {
    method: "GET",
  }, requireAuth);

  return parseResponse<T>(response, requireAuth, url);
}

export async function adminPost<T>(
  url: string,
  body?: unknown,
  requireAuth = true
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const response = await adminFetchWithAuth(url, {
    method: "POST",
    headers: {
      ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
    },
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  }, requireAuth);

  return parseResponse<T>(response, requireAuth, url);
}

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
