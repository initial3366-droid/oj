/**
 * 教师Api接口封装。集中处理请求参数、响应类型与后端 API 调用边界。
 */
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export const TEACHER_TOKEN_KEY = 'qoj.teacherAccessToken';
export const TEACHER_REFRESH_TOKEN_KEY = 'qoj.teacherRefreshToken';
const API_TIMEOUT_MS = 15000;
let teacherRefreshPromise: Promise<string | null> | null = null;

/**
 * 教师当前用户接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface TeacherMe {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  role: 'TEACHER';
  email?: string | null;
  teacherNo?: string | null;
  majorId?: number | null;
  majorName?: string | null;
}

/**
 * 教师班级接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface TeacherClass {
  id: number;
  name: string;
  description?: string | null;
  teacherId: number;
  teacherName?: string | null;
  joinEnabled: boolean;
  approvalRequired: boolean;
  memberCount: number;
  createdAt: string;
  members?: TeacherStudent[];
}

/**
 * 教师Student接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface TeacherStudent {
  classId?: number | null;
  className?: string | null;
  userId: number;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  studentNo?: string | null;
  email?: string | null;
  source?: string | null;
  profileFields?: Record<string, string>;
  joinedAt: string;
}

/**
 * 教师Application接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface TeacherApplication {
  id: number;
  classId: number;
  className?: string | null;
  userId: number;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  studentNo?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string | null;
  createdAt: string;
  handledAt?: string | null;
}

/**
 * 教师提交接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface TeacherSubmission {
  id: number;
  userId: number;
  username?: string | null;
  displayName?: string | null;
  problemTitle?: string | null;
  contestTitle?: string | null;
  practiceTitle?: string | null;
  language: string;
  status: string;
  score?: number | null;
  submitTime?: string | null;
  timeUsed?: number | null;
  memoryUsed?: number | null;
}

/**
 * 页面结果接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface PageResult<T> {
  total: number;
  list: T[];
}

/**
 * Import请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ImportPayload {
  classId: number;
  studentNoField: string;
  nameField: string;
  fields: string[];
  rows: Array<Record<string, string>>;
}

/**
 * Import结果接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ImportResult {
  successCount: number;
  failureCount: number;
  successes: Array<{ rowNumber: number; studentNo?: string | null; displayName?: string | null }>;
  errors: Array<{ rowNumber: number; studentNo?: string | null; reason: string }>;
}

/**
 * 读取教师令牌并返回给调用方。会读写浏览器本地会话信息。
 */
export function getTeacherToken() {
  return window.localStorage.getItem(TEACHER_TOKEN_KEY);
}

/**
 * 读取教师Refresh令牌并返回给调用方。会读写浏览器本地会话信息。
 */
function getTeacherRefreshToken() {
  return window.localStorage.getItem(TEACHER_REFRESH_TOKEN_KEY);
}

/**
 * 封装set教师Tokens相关逻辑。会更新 React 状态并触发重新渲染；会读写浏览器本地会话信息。
 */
export function setTeacherTokens(accessToken: string, refreshToken?: string) {
  window.localStorage.setItem(TEACHER_TOKEN_KEY, accessToken);
  if (refreshToken) {
    window.localStorage.setItem(TEACHER_REFRESH_TOKEN_KEY, refreshToken);
  }
}

/**
 * 重置教师Tokens。会读写浏览器本地会话信息。
 */
export function clearTeacherTokens() {
  window.localStorage.removeItem(TEACHER_TOKEN_KEY);
  window.localStorage.removeItem(TEACHER_REFRESH_TOKEN_KEY);
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
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时，请检查后端服务');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * 封装refresh教师访问令牌相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；失败时向调用方传播异常。
 */
async function refreshTeacherAccessToken() {
  const refreshToken = getTeacherRefreshToken();
  if (!refreshToken) return null;

  if (!teacherRefreshPromise) {
    teacherRefreshPromise = (async () => {
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
        clearTeacherTokens();
        return null;
      }
      if (!response.ok) {
        throw new Error(body?.message || `刷新登录状态失败：${response.status}`);
      }
      if (!body || body.code !== 200 || !body.data?.accessToken || !body.data?.refreshToken) {
        throw new Error(body?.message || '刷新登录状态返回格式错误');
      }
      setTeacherTokens(body.data.accessToken, body.data.refreshToken);
      return body.data.accessToken;
    })().finally(() => {
      teacherRefreshPromise = null;
    });
  }

  return teacherRefreshPromise;
}

/**
 * 封装教师FetchWith认证相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；可能改变当前路由或查询参数；失败时向调用方传播异常。
 */
async function teacherFetchWithAuth(url: string, init: RequestInit = {}, allowRefresh = true): Promise<Response> {
  let token = getTeacherToken();
  if (!token) {
    token = await refreshTeacherAccessToken();
  }
  if (!token) {
    window.location.href = '/teacher/login';
    throw new Error('请先登录教师端');
  }

  const response = await fetchWithTimeout(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401 && allowRefresh) {
    const nextToken = await refreshTeacherAccessToken();
    if (nextToken) {
      return teacherFetchWithAuth(url, init, false);
    }
  }
  return response;
}

/**
 * 解析并规范化输入数据。包含异步流程并由调用方处理完成或失败状态；可能改变当前路由或查询参数；失败时向调用方传播异常。
 */
async function parse<T>(response: Response, requireAuth = true): Promise<T> {
  let body: ApiResponse<T> | null = null;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    body = null;
  }
  if (response.status === 401 && requireAuth) {
    clearTeacherTokens();
    if (!window.location.pathname.startsWith('/teacher/login')) {
      window.location.href = '/teacher/login';
    }
    throw new Error('未登录或登录已过期');
  }
  if (!response.ok || !body || body.code !== 200) {
    throw new Error(body?.message || `请求失败：${response.status}`);
  }
  return body.data;
}

/**
 * 封装请求相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口。
 */
async function request<T>(url: string, init: RequestInit = {}, requireAuth = true): Promise<T> {
  const response = requireAuth
    ? await teacherFetchWithAuth(url, init)
    : await fetchWithTimeout(url, {
        ...init,
        headers: {
          ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      });
  return parse<T>(response, requireAuth);
}

/**
 * 封装教师退出登录相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口。
 */
export async function teacherLogout() {
  try {
    let token = getTeacherToken();
    if (!token) token = await refreshTeacherAccessToken();
    if (!token) return;

    let response = await fetchWithTimeout('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: getTeacherRefreshToken() }),
    });
    if (response.status === 401) {
      token = await refreshTeacherAccessToken();
      if (token) {
        response = await fetchWithTimeout('/api/v1/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: getTeacherRefreshToken() }),
        });
      }
    }
  } finally {
    clearTeacherTokens();
  }
}

/**
 * 封装教师登录相关逻辑。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染；失败时向调用方传播异常。
 */
export async function teacherLogin(username: string, password: string, captchaId: string, captcha: string) {
  const tokens = await request<{ accessToken: string; refreshToken: string }>(
    '/api/teacher/v1/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password, captchaId, captcha }),
    },
    false,
  );
  setTeacherTokens(tokens.accessToken, tokens.refreshToken);
  const me = await teacherGet<TeacherMe>('/api/teacher/v1/me');
  if (me.role !== 'TEACHER') {
    clearTeacherTokens();
    throw new Error('当前账号不是教师账号');
  }
  return me;
}

/**
 * 封装教师ImportStudentsFile相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function teacherImportStudentsFile(payload: {
  classId: number;
  studentNoField: string;
  nameField: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append('classId', String(payload.classId));
  formData.append('studentNoField', payload.studentNoField);
  formData.append('nameField', payload.nameField);
  formData.append('file', payload.file);
  return request<ImportResult>('/api/teacher/v1/students/import-file', {
    method: 'POST',
    body: formData,
  });
}

/**
 * 封装教师Get相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export function teacherGet<T>(url: string) {
  return request<T>(url);
}

/**
 * 封装教师Post相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export function teacherPost<T>(url: string, body?: unknown) {
  return request<T>(url, {
    method: 'POST',
    body: body === undefined
      ? undefined
      : body instanceof FormData
        ? body
        : JSON.stringify(body),
  });
}

/**
 * 封装教师Put相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export function teacherPut<T>(url: string, body?: unknown) {
  return request<T>(url, {
    method: 'PUT',
    body: body === undefined
      ? undefined
      : body instanceof FormData
        ? body
        : JSON.stringify(body),
  });
}

/**
 * 封装教师Delete相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export function teacherDelete<T>(url: string, body?: unknown) {
  return request<T>(url, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) });
}

/**
 * 教师仪表盘接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface TeacherDashboard {
  onlineUserCount: number;
  userCount: number;
  problemCount: number;
  submissionCount: number;
  todaySubmissionCount: number;
  todayAcceptedCount: number;
  todayActiveUserCount: number;
  activeContestCount: number;
  recentContests: Array<Record<string, unknown>>;
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
  topProblems: Array<{ problemId: number; title: string; difficulty: number; submissions: number; acRate: number }>;
}

/**
 * 读取教师仪表盘并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export function fetchTeacherDashboard(): Promise<TeacherDashboard> {
  return teacherGet<TeacherDashboard>('/api/teacher/v1/dashboard');
}

/**
 * 下载文件（用于排行榜/提交代码导出等返回二进制的接口）。
 * 后端这些导出接口直接返回 byte[] / 文件流，不走 { code, message, data } 包装，
 * 因此需要单独处理，且错误响应可能是 JSON 也可能是纯文本。
 */
export async function teacherDownload(url: string, filename: string): Promise<void> {
  const response = await teacherFetchWithAuth(url, { method: 'GET' });

  if (!response.ok) {
    // 错误体可能是 JSON（业务异常）或纯文本
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const body = (await response.json()) as ApiResponse<unknown>;
        if (response.status === 401) {
          clearTeacherTokens();
          if (!window.location.pathname.startsWith('/teacher/login')) {
            window.location.href = '/teacher/login';
          }
          throw new Error('未登录或登录已过期');
        }
        throw new Error(body?.message || `请求失败：${response.status}`);
      } catch (err) {
        if (err instanceof Error && err.message) throw err;
      }
    }
    if (response.status === 401) {
      clearTeacherTokens();
      if (!window.location.pathname.startsWith('/teacher/login')) {
        window.location.href = '/teacher/login';
      }
      throw new Error('未登录或登录已过期');
    }
    if (response.status === 403) {
      throw new Error('权限不足，无法导出');
    }
    let text = '';
    try { text = (await response.text()).trim(); } catch { text = ''; }
    throw new Error(text || `下载失败：${response.status}`);
  }

  const blob = await response.blob();
  const href = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(href);
}
