/**
 * 统一 API 客户端
 * 处理：
 * 1. 自动带 Authorization token
 * 2. token 过期自动跳转登录
 * 3. 统一错误处理和 message 显示
 * 4. 统一解析 ApiResponse
 */

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

const API_TIMEOUT_MS = 15000;
const TOKEN_KEY = "qoj.accessToken";
const REFRESH_TOKEN_KEY = "qoj.refreshToken";
let refreshPromise: Promise<string | null> | null = null;

interface ApiRequestOptions {
  timeoutMs?: number;
}

function timeoutSignal(timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs?: number) {
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

function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setToken(token: string, refreshToken?: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event("qoj:auth-cleared"));
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetchWithTimeout("/api/v1/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const body = (await response.json()) as ApiResponse<{
          accessToken: string;
          refreshToken: string;
        }>;
        if (!response.ok || !body || body.code !== 200) {
          clearToken();
          return null;
        }
        setToken(body.data.accessToken, body.data.refreshToken);
        return body.data.accessToken;
      } catch {
        clearToken();
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function handleUnauthorized() {
  clearToken();
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

function isAuthFailureMessage(message?: string) {
  if (!message) {
    return false;
  }
  return message.includes("未登录")
    || message.includes("登录已过期")
    || message.includes("Token")
    || message.includes("token");
}

async function parseResponse<T>(response: Response): Promise<T> {
  let body: ApiResponse<T> | null = null;

  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    body = null;
  }

  if (response.status === 401) {
    if (isAuthFailureMessage(body?.message)) {
      handleUnauthorized();
      throw new Error("未登录或登录已过期，请重新登录");
    }
    throw new Error(body?.message || "请求失败：401");
  }

  // 处理 403 禁止访问
  if (response.status === 403) {
    throw new Error(body?.message || "权限不足，无法访问该资源");
  }

  // 处理 500 服务器错误
  if (response.status === 500) {
    throw new Error(body?.message || "服务器内部错误，请稍后重试");
  }

  // 处理其他错误状态
  if (!response.ok) {
    throw new Error(body?.message || `请求失败：${response.status}`);
  }

  // 验证响应格式
  if (!body || body.code !== 200) {
    throw new Error(body?.message || "请求失败");
  }

  return body.data;
}

async function requestWithAuth<T>(
  url: string,
  init: RequestInit,
  requireAuth: boolean,
  allowRefresh = true,
  options: ApiRequestOptions = {}
): Promise<T> {
  let token = getToken();

  if (requireAuth && !token) {
    token = await refreshAccessToken();
  }

  if (requireAuth && !token) {
    handleUnauthorized();
    throw new Error("请先登录");
  }

  const response = await fetchWithTimeout(
    url,
    {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    },
    options.timeoutMs,
  );

  const canRefresh = allowRefresh
    && !url.includes("/api/v1/auth/login")
    && !url.includes("/api/v1/auth/register")
    && !url.includes("/api/v1/auth/refresh")
    && Boolean(requireAuth || token);

  if (response.status === 401 && canRefresh) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return requestWithAuth<T>(url, init, requireAuth, false, options);
    }
  }

  return parseResponse<T>(response);
}

/**
 * GET 请求
 */
export async function apiGet<T>(
  url: string,
  requireAuth = false,
  options: ApiRequestOptions = {},
): Promise<T> {
  return requestWithAuth<T>(url, { method: "GET" }, requireAuth, true, options);
}

/**
 * POST 请求
 */
export async function apiPost<T>(
  url: string,
  body?: unknown,
  requireAuth = false,
  options: ApiRequestOptions = {},
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  return requestWithAuth<T>(
    url,
    {
      method: "POST",
      headers: {
        ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
      },
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    },
    requireAuth,
    true,
    options,
  );
}

/**
 * PUT 请求
 */
export async function apiPut<T>(
  url: string,
  body?: unknown,
  requireAuth = false,
  options: ApiRequestOptions = {},
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  return requestWithAuth<T>(
    url,
    {
      method: "PUT",
      headers: {
        ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
      },
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    },
    requireAuth,
    true,
    options,
  );
}

/**
 * DELETE 请求
 */
export async function apiDelete<T>(
  url: string,
  requireAuth = false,
  options: ApiRequestOptions = {},
): Promise<T> {
  return requestWithAuth<T>(url, { method: "DELETE" }, requireAuth, true, options);
}

/**
 * 通用请求方法（兼容旧代码）
 */
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  requireAuth = false,
  requestOptions: ApiRequestOptions = {},
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  return requestWithAuth<T>(
    url,
    {
      ...options,
      headers: {
        ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    },
    requireAuth,
    true,
    requestOptions,
  );
}
