/**
 * 管理员 API
 */
import { apiGet, apiPost, apiPut, apiDelete } from "./client";

export interface AdminDashboard {
  onlineUserCount: number;
  userCount: number;
  problemCount: number;
  submissionCount: number;
  todaySubmissionCount: number;
  todayAcceptedCount: number;
  todayActiveUserCount: number;
  activeContestCount: number;
  recentContests: Array<{
    id: number;
    title: string;
    startTime: string;
    endTime: string;
    type: "ACM" | "OI";
    audience: "ALL" | "CLASS";
    status: "NOT_STARTED" | "RUNNING" | "ENDED";
  }>;
  totalStats: {
    userCount: number;
    userByRole: Record<string, number>;
    problemCount: number;
    problemByDifficulty: Record<number, number>;
    submissionCount: number;
    passRate: number;
    contestCount: number;
    contestByType: Record<string, number>;
  };
  submissionTrend: Array<{ date: string; total: number; accepted: number }>;
  verdictDistribution: Array<{ verdict: string; count: number }>;
  languageUsage: Array<{ language: string; count: number; percentage: number }>;
  difficultyDistribution: Array<{ difficulty: number; count: number }>;
  hourlyActivity: Array<{ hour: number; count: number }>;
  userGrowth: Array<{ month: string; cumulative: number }>;
  topProblems: Array<{
    problemId: number;
    title: string;
    difficulty: number;
    submissions: number;
    acRate: number;
  }>;
}

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  studentNo?: string;
  email?: string;
  role: "SUPER_ADMIN" | "TEACHER" | "STUDENT" | "GUEST";
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserPayload {
  username?: string;
  password?: string;
  displayName?: string;
  studentNo?: string;
  email?: string;
  role?: AdminUser["role"];
}

/**
 * 获取当前管理员信息
 */
export async function fetchAdminMe(): Promise<AdminUser> {
  return apiGet<AdminUser>("/api/admin/v1/me", true);
}

/**
 * 获取管理员仪表盘
 */
export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  return apiGet<AdminDashboard>("/api/admin/v1/dashboard", true);
}

/**
 * 获取用户列表
 */
export async function fetchAdminUsers(
  page = 1,
  pageSize = 200
): Promise<{ total: number; list: AdminUser[] }> {
  return apiGet<{ total: number; list: AdminUser[] }>(
    `/api/admin/v1/users?page=${page}&pageSize=${pageSize}`,
    true
  );
}

/**
 * 按角色获取用户列表
 */
export async function fetchAdminUsersByRole(
  role: AdminUser["role"],
  page = 1,
  pageSize = 10
): Promise<{ total: number; list: AdminUser[] }> {
  return apiGet<{ total: number; list: AdminUser[] }>(
    `/api/admin/v1/users?page=${page}&pageSize=${pageSize}&role=${encodeURIComponent(role)}`,
    true
  );
}

/**
 * 创建用户
 */
export async function createAdminUser(payload: AdminUserPayload): Promise<AdminUser> {
  return apiPost<AdminUser>("/api/admin/v1/users", payload, true);
}

/**
 * 更新用户
 */
export async function updateAdminUser(
  userId: number,
  payload: AdminUserPayload
): Promise<AdminUser> {
  return apiPut<AdminUser>(`/api/admin/v1/users/${userId}`, payload, true);
}

/**
 * 删除用户
 */
export async function deleteAdminUser(userId: number): Promise<void> {
  return apiDelete<void>(`/api/admin/v1/users/${userId}`, true);
}

// 更多管理员 API 可以继续添加...
