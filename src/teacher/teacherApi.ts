interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export const TEACHER_TOKEN_KEY = 'qoj.teacherAccessToken';
export const TEACHER_REFRESH_TOKEN_KEY = 'qoj.teacherRefreshToken';

export interface TeacherMe {
  id: number;
  username: string;
  displayName: string;
  role: 'TEACHER';
  email?: string | null;
  studentNo?: string | null;
}

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

export interface TeacherStudent {
  classId?: number | null;
  className?: string | null;
  userId: number;
  username?: string | null;
  displayName?: string | null;
  studentNo?: string | null;
  email?: string | null;
  source?: string | null;
  profileFields?: Record<string, string>;
  joinedAt: string;
}

export interface TeacherApplication {
  id: number;
  classId: number;
  className?: string | null;
  userId: number;
  username?: string | null;
  displayName?: string | null;
  studentNo?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string | null;
  createdAt: string;
  handledAt?: string | null;
}

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
  submitTime?: string | null;
  timeUsed?: number | null;
  memoryUsed?: number | null;
}

export interface PageResult<T> {
  total: number;
  list: T[];
}

export interface ImportPayload {
  classId: number;
  studentNoField: string;
  nameField: string;
  fields: string[];
  rows: Array<Record<string, string>>;
}

export interface ImportResult {
  successCount: number;
  failureCount: number;
  successes: Array<{ rowNumber: number; studentNo?: string | null; displayName?: string | null }>;
  errors: Array<{ rowNumber: number; studentNo?: string | null; reason: string }>;
}

export function getTeacherToken() {
  return window.localStorage.getItem(TEACHER_TOKEN_KEY);
}

export function setTeacherTokens(accessToken: string, refreshToken?: string) {
  window.localStorage.setItem(TEACHER_TOKEN_KEY, accessToken);
  if (refreshToken) {
    window.localStorage.setItem(TEACHER_REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTeacherTokens() {
  window.localStorage.removeItem(TEACHER_TOKEN_KEY);
  window.localStorage.removeItem(TEACHER_REFRESH_TOKEN_KEY);
}

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

async function request<T>(url: string, init: RequestInit = {}, requireAuth = true): Promise<T> {
  const token = getTeacherToken();
  if (requireAuth && !token) {
    window.location.href = '/teacher/login';
    throw new Error('请先登录教师端');
  }
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(requireAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  return parse<T>(response, requireAuth);
}

export async function teacherLogin(username: string, password: string, captchaId: string, captcha: string) {
  const tokens = await request<{ accessToken: string; refreshToken: string }>(
    '/api/v1/auth/login',
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

export function teacherGet<T>(url: string) {
  return request<T>(url);
}

export function teacherPost<T>(url: string, body?: unknown) {
  return request<T>(url, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function teacherPut<T>(url: string, body?: unknown) {
  return request<T>(url, {
    method: 'PUT',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function teacherDelete<T>(url: string, body?: unknown) {
  return request<T>(url, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) });
}

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

export function fetchTeacherDashboard(): Promise<TeacherDashboard> {
  return teacherGet<TeacherDashboard>('/api/teacher/v1/dashboard');
}

/**
 * 下载文件（用于排行榜/提交代码导出等返回二进制的接口）。
 * 后端这些导出接口直接返回 byte[] / 文件流，不走 { code, message, data } 包装，
 * 因此需要单独处理，且错误响应可能是 JSON 也可能是纯文本。
 */
export async function teacherDownload(url: string, filename: string): Promise<void> {
  const token = getTeacherToken();
  if (!token) {
    window.location.href = '/teacher/login';
    throw new Error('请先登录教师端');
  }
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

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
