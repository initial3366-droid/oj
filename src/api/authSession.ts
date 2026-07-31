/**
 * 认证会话接口封装。集中处理请求参数、响应类型与后端 API 调用边界。
 */
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * Frontend认证Tokens接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface FrontendAuthTokens {
  accessToken: string;
  refreshToken: string;
}

const API_TIMEOUT_MS = 15000;
const ACCESS_TOKEN_KEY = "qoj.accessToken";
const REFRESH_TOKEN_KEY = "qoj.refreshToken";
const REFRESH_LOCK_NAME = "qoj.frontend-token-refresh";

let refreshPromise: Promise<string | null> | null = null;

/**
 * 构造或转换kenExpiresSoon。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function tokenExpiresSoon(token: string, skewSeconds = 30) {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return true;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const payload = JSON.parse(window.atob(padded)) as { exp?: number };
    return typeof payload.exp !== "number"
      || payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}

/**
 * 读取WithTimeout并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染；失败时向调用方传播异常。
 */
async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
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
 * 读取Frontend访问令牌并返回给调用方。会读写浏览器本地会话信息。
 */
export function getFrontendAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * 读取FrontendRefresh令牌并返回给调用方。会读写浏览器本地会话信息。
 */
export function getFrontendRefreshToken() {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * 更新FrontendTokens。会更新 React 状态并触发重新渲染；会读写浏览器本地会话信息。
 */
export function saveFrontendTokens(tokens: FrontendAuthTokens) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

/**
 * 重置FrontendTokens。会读写浏览器本地会话信息。
 */
export function clearFrontendTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event("qoj:auth-cleared"));
}

/**
 * 封装performRefresh相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；失败时向调用方传播异常。
 */
async function performRefresh(expectedRefreshToken: string) {
  const latestRefreshToken = getFrontendRefreshToken();
  if (!latestRefreshToken) return null;

  // Another tab may have completed a rotation while this tab was waiting for the lock.
  if (latestRefreshToken !== expectedRefreshToken) {
    return getFrontendAccessToken();
  }

  const response = await fetchWithTimeout("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: latestRefreshToken }),
  });

  let body: ApiResponse<FrontendAuthTokens> | null = null;
  try {
    body = (await response.json()) as ApiResponse<FrontendAuthTokens>;
  } catch {
    body = null;
  }

  if (response.status === 401 || response.status === 403) {
    clearFrontendTokens();
    return null;
  }
  if (!response.ok) {
    throw new Error(body?.message || `刷新登录状态失败：${response.status}`);
  }
  if (!body || body.code !== 200 || !body.data?.accessToken || !body.data?.refreshToken) {
    throw new Error(body?.message || "刷新登录状态返回格式错误");
  }

  saveFrontendTokens(body.data);
  return body.data.accessToken;
}

/**
 * 封装refreshFrontend访问令牌相关逻辑。会访问后端接口。
 */
export async function refreshFrontendAccessToken() {
  const refreshToken = getFrontendRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      if (typeof navigator !== "undefined" && navigator.locks) {
        return navigator.locks.request(REFRESH_LOCK_NAME, () => performRefresh(refreshToken));
      }
      return performRefresh(refreshToken);
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

/**
 * 读取ValidFrontend访问令牌并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function getValidFrontendAccessToken() {
  const accessToken = getFrontendAccessToken();
  if (accessToken && !tokenExpiresSoon(accessToken)) {
    return accessToken;
  }
  if (!getFrontendRefreshToken()) {
    if (accessToken) clearFrontendTokens();
    return null;
  }
  return refreshFrontendAccessToken();
}

/**
 * 封装退出登录Frontend会话相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口。
 */
export async function logoutFrontendSession() {
  const refreshToken = getFrontendRefreshToken();
  try {
    const accessToken = await getValidFrontendAccessToken();
    if (!accessToken) return;
    await fetchWithTimeout("/api/v1/auth/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken: getFrontendRefreshToken() ?? refreshToken }),
    });
  } finally {
    clearFrontendTokens();
  }
}
