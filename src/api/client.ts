/**
 * 统一 API 客户端
 * 处理：
 * 1. 自动带 Authorization token
 * 2. token 过期自动跳转登录
 * 3. 统一错误处理和 message 显示
 * 4. 统一解析 ApiResponse
 */

import {
  clearFrontendTokens,
  getFrontendAccessToken,
  refreshFrontendAccessToken,
  saveFrontendTokens,
} from "./authSession";

/**
 * Api响应接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

const API_TIMEOUT_MS = 15000;
/**
 * Api请求Options接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ApiRequestOptions {
  timeoutMs?: number;
}

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

/**
 * 读取令牌并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function getToken(): string | null {
  return getFrontendAccessToken();
}

/**
 * 封装set令牌相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export function setToken(token: string, refreshToken?: string) {
  if (refreshToken) {
    saveFrontendTokens({ accessToken: token, refreshToken });
  }
}

/**
 * 重置令牌。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export function clearToken() {
  clearFrontendTokens();
}

/**
 * 处理Unauthorized。可能改变当前路由或查询参数。
 */
function handleUnauthorized() {
  clearToken();
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

/**
 * 判断认证Failure消息是否成立。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function isAuthFailureMessage(message?: string) {
  if (!message) {
    return false;
  }
  return message.includes("未登录")
    || message.includes("登录已过期")
    || message.includes("Token")
    || message.includes("token");
}

/**
 * 解析并规范化响应。包含异步流程并由调用方处理完成或失败状态；失败时向调用方传播异常。
 */
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

/**
 * 封装请求With认证相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；失败时向调用方传播异常。
 */
async function requestWithAuth<T>(
  url: string,
  init: RequestInit,
  requireAuth: boolean,
  allowRefresh = true,
  options: ApiRequestOptions = {}
): Promise<T> {
  let token = getToken();

  if (requireAuth && !token) {
    token = await refreshFrontendAccessToken();
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
    const nextToken = await refreshFrontendAccessToken();
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
