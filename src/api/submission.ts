/**
 * 提交相关 API
 */
import { apiGet, apiPost } from "./client";

/**
 * 提交Record接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface SubmissionRecord {
  id: number;
  problemId: number;
  problemTitle?: string | null;
  language: string;
  status: string;
  timeUsed?: number | null;
  memoryUsed?: number | null;
  submitTime?: string | null;
  createdAt: string;
  passedCaseCount?: number | null;
  totalCaseCount?: number | null;
  code?: string | null;
  cases?: Array<{
    id?: number;
    submissionId?: number;
    caseNo?: number;
    subtaskNo?: number | null;
    status?: string;
    score?: number | null;
    maxScore?: number | null;
    timeMs?: number | null;
    memoryKb?: number | null;
    judgeMessage?: string | null;
  }> | null;
}

/**
 * Submit编码请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface SubmitCodePayload {
  problemId: number;
  practiceId?: number;
  contestId?: number;
  language: string;
  code: string;
}

/**
 * 沙箱Run请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface SandboxRunPayload {
  language: string;
  code: string;
  input: string;
  timeLimit?: number;
  memoryLimit?: number;
}

/**
 * 沙箱Run结果接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface SandboxRunResult {
  status: string;
  output: string;
  timeUsed?: number;
  memoryUsed?: number;
  exitCode?: number;
}

/**
 * 封装current用户标识From访问令牌相关逻辑。会读写浏览器本地会话信息。
 */
function currentUserIdFromAccessToken() {
  const token = window.localStorage.getItem("qoj.accessToken");
  if (!token) return null;
  try {
    const payloadPart = token.split(".")[1] ?? "";
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(padded));
    const id = Number(payload.userId ?? payload.sub);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * 提交代码
 */
export async function submitCode(payload: SubmitCodePayload): Promise<SubmissionRecord> {
  return apiPost<SubmissionRecord>("/api/v1/submissions", payload, true);
}

/**
 * 沙箱运行代码（调试）
 */
export async function runCodeInSandbox(payload: SandboxRunPayload): Promise<SandboxRunResult> {
  // Compilation plus isolated execution can legitimately exceed the global 15-second API timeout.
  return apiPost<SandboxRunResult>("/api/v1/sandbox/run", payload, true, { timeoutMs: 120_000 });
}

/**
 * 获取我的提交列表
 */
export async function fetchMySubmissions(
  page = 1,
  pageSize = 20
): Promise<SubmissionRecord[]> {
  const userId = currentUserIdFromAccessToken();
  if (!userId) {
    throw new Error("请先登录后查看提交记录");
  }
  const result = await apiGet<{ total: number; list: SubmissionRecord[] }>(
    `/api/v1/submissions?page=${page}&pageSize=${pageSize}&userId=${userId}`,
    true
  );
  return result.list;
}

/**
 * 获取题目的提交列表
 */
export async function fetchProblemSubmissions(
  problemId: number,
  contestId?: number | null,
  page = 1,
  pageSize = 100
): Promise<SubmissionRecord[]> {
  const contestQuery = contestId ? `&contestId=${contestId}` : "";
  const result = await apiGet<{ total: number; list: SubmissionRecord[] }>(
    `/api/v1/submissions?page=${page}&pageSize=${pageSize}&problemId=${problemId}${contestQuery}`,
    false
  );
  return result.list;
}

/**
 * 获取提交详情
 */
export async function fetchSubmissionDetail(submissionId: number): Promise<SubmissionRecord> {
  return apiGet<SubmissionRecord>(`/api/v1/submissions/${submissionId}`, true);
}

/**
 * 获取比赛提交列表
 */
export async function fetchContestSubmissions(
  contestId: number,
  page = 1,
  pageSize = 20
): Promise<{ total: number; list: SubmissionRecord[] }> {
  return apiGet<{ total: number; list: SubmissionRecord[] }>(
    `/api/v1/submissions?page=${page}&pageSize=${pageSize}&contestId=${contestId}`,
    false
  );
}

/**
 * 获取我在比赛中的提交
 */
export async function fetchMyContestSubmissions(
  contestId: number,
  userId: number,
  page = 1,
  pageSize = 20
): Promise<{ total: number; list: SubmissionRecord[] }> {
  return apiGet<{ total: number; list: SubmissionRecord[] }>(
    `/api/v1/submissions?page=${page}&pageSize=${pageSize}&contestId=${contestId}&userId=${userId}`,
    true
  );
}
