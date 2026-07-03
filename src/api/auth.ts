/**
 * 认证相关 API
 */
import { apiPost, apiGet, setToken, clearToken } from "./client";

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterPayload {
  username: string;
  displayName: string;
  studentNo: string;
  email?: string;
  password: string;
}

export interface UserMe {
  id: number;
  username: string;
  displayName: string;
  studentNo?: string;
  email?: string;
  role: "STUDENT" | "TEACHER" | "SUPER_ADMIN" | "GUEST";
  totalSolved?: number;
  totalSubmissions?: number;
}

/**
 * 用户登录
 */
export async function login(username: string, password: string): Promise<AuthTokenResponse> {
  const result = await apiPost<AuthTokenResponse>("/api/v1/auth/login", {
    username,
    password,
  });

  // 自动保存 token
  setToken(result.accessToken, result.refreshToken);

  return result;
}

/**
 * 用户注册
 */
export async function register(payload: RegisterPayload): Promise<AuthTokenResponse> {
  const result = await apiPost<AuthTokenResponse>("/api/v1/auth/register", payload);

  // 自动保存 token
  setToken(result.accessToken, result.refreshToken);

  return result;
}

/**
 * 获取当前用户信息
 */
export async function fetchMe(): Promise<UserMe> {
  return apiGet<UserMe>("/api/v1/auth/me", true);
}

/**
 * 刷新 token
 */
export async function refreshToken(refreshToken: string): Promise<AuthTokenResponse> {
  const result = await apiPost<AuthTokenResponse>("/api/v1/auth/refresh", {
    refreshToken,
  });

  setToken(result.accessToken, result.refreshToken);

  return result;
}

/**
 * 登出
 */
export async function logout(): Promise<void> {
  try {
    await apiPost<void>("/api/v1/auth/logout", undefined, true);
  } finally {
    clearToken();
  }
}
