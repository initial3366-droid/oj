/**
 * 认证相关 API
 */
import { apiPost, apiGet, setToken } from "./client";
import { logoutFrontendSession } from "./authSession";

/**
 * 认证令牌响应接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
}

type FrontendLoginResponse =
  | ({ portal: "USER" } & AuthTokenResponse)
  | { portal: "TEACHER"; accessToken: null; refreshToken: null };

/**
 * 注册请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface RegisterPayload {
  username: string;
  displayName: string;
  studentNo: string;
  email?: string;
  password: string;
}

/**
 * 用户当前用户接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface UserMe {
  id: number;
  username: string;
  displayName: string;
  studentNo?: string;
  email?: string;
  role: "STUDENT" | "GUEST";
  totalSolved?: number;
  totalSubmissions?: number;
}

/**
 * 用户登录
 */
export async function login(username: string, password: string): Promise<AuthTokenResponse> {
  const result = await apiPost<FrontendLoginResponse>("/api/v1/auth/login", {
    username,
    password,
  });

  if (result.portal === "TEACHER") {
    throw new Error("教师账号请使用教师端登录");
  }

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
  await logoutFrontendSession();
}
