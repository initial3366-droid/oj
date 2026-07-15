/**
 * QOJ 前端 API 客户端 — 全部后端接口的类型定义与调用封装。
 *
 * 职责：
 * 1. 统一 HTTP 请求（get / request），自动携带 JWT Token（从 localStorage 读取）
 * 2. 超时控制（15 秒）+ 错误信息脱敏（过滤 Java 异常堆栈）
 * 3. 后端实体 → 前端类型映射（BackendProblem → Problem 等）
 * 4. 全局状态 hydration（hydrateStateFromApi）— 合并 home + problems + ratings 到 OjState
 * 5. 所有业务 API 调用（认证、题库、比赛、练习、提交、判题队列、公告、系统设置）
 *
 * 使用方式：直接 import 函数名，如 import { fetchProblems, submitCode } from '../data/apiClient'
 */
import type {
  CarouselSlide,
  Contest,
  OjState,
  Problem,
  RatingUser,
} from "./types";
import { encryptId } from "../utils/cipher";
import {
  clearFrontendTokens as clearStoredFrontendTokens,
  getFrontendAccessToken as readFrontendAccessToken,
  getValidFrontendAccessToken,
  refreshFrontendAccessToken,
  saveFrontendTokens,
} from "../api/authSession";

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
 * 重置Frontend令牌。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function clearFrontendToken() {
  clearStoredFrontendTokens();
}

/**
 * 更新Frontend认证Tokens。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export function saveFrontendAuthTokens(tokens: AuthTokenResponse) {
  saveFrontendTokens(tokens);
}

/**
 * 读取Frontend访问令牌并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function getFrontendAccessToken() {
  return readFrontendAccessToken();
}

/**
 * 读取Frontend访问令牌ForOptional认证并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
async function getFrontendAccessTokenForOptionalAuth() {
  return (await getValidFrontendAccessToken()) ?? undefined;
}

/**
 * 判断shouldRefreshFrontend令牌是否成立。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function shouldRefreshFrontendToken(url: string, token?: string, allowRefresh = true) {
  return Boolean(
    allowRefresh
    && token
    && !url.includes("/api/v1/auth/login")
    && !url.includes("/api/v1/auth/register")
    && !url.includes("/api/v1/auth/refresh")
  );
}

/**
 * 封装timeoutSignal相关逻辑。会更新 React 状态并触发重新渲染。
 */
function timeoutSignal() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  return { controller, timeout };
}

/**
 * 读取WithTimeout并返回给调用方。包含异步流程并由调用方处理完成或失败状态；失败时向调用方传播异常。
 */
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

/**
 * 认证令牌响应接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export type FrontendLoginResponse =
  | ({ portal: "USER" } & AuthTokenResponse)
  | { portal: "TEACHER"; accessToken: null; refreshToken: null };

/**
 * 管理员仪表盘接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AdminDashboard {
  onlineUserCount: number;
  userCount: number;
    problemCount: number;
  submissionCount: number;
  todaySubmissionCount: number;
  todayAcceptedCount: number;
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
}

/**
 * 管理员用户接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  studentNo?: string;
  email?: string;
  role: "SUPER_ADMIN" | "STUDENT" | "GUEST";
  createdAt: string;
  updatedAt: string;
}

/**
 * 管理员用户请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AdminUserPayload {
  username?: string;
  password?: string;
  displayName?: string;
  studentNo?: string;
  email?: string;
  role?: AdminUser["role"];
}

/**
 * 注册请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface RegisterPayload {
  username: string;
  studentNo: string;
  email: string;
  password: string;
  emailVerificationCode: string;
}

/**
 * 题目Sample请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ProblemSamplePayload {
  input: string;
  output: string;
  explanation?: string;
}

/**
 * 题目Test测试点请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ProblemTestCasePayload {
  id?: number;
  caseNo?: number;
  input: string;
  output: string;
  explanation?: string;
  sample?: boolean;
}

/**
 * 题目DraftBasic请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ProblemDraftBasicPayload {
  title: string;
  timeLimit: number;
  memoryLimit: number;
  statement: string;
  inputFormat?: string;
  outputFormat?: string;
  tags?: string[];
  isPublic?: boolean;
  samples: ProblemSamplePayload[];
}

/**
 * 题目Draft接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ProblemDraft {
  draftId: string;
  basic: ProblemDraftBasicPayload | null;
  testCases: ProblemTestCasePayload[];
}

/**
 * 练习请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface PracticePayload {
  title: string;
  description?: string;
  audience?: "ALL" | "CLASS";
  audienceId?: number | null;
  password?: string;
  problemIds: number[];
}

/**
 * 练习接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface Practice {
  id: number;
  title: string;
  description: string;
  audience: "ALL" | "CLASS";
  audienceId?: number | null;
  hasPassword: boolean;
  ownerId: number;
  problems: Problem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 练习Report提交接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface PracticeReportSubmission {
  id: number;
  userId: number;
  displayName: string;
  problemId: number;
  problemTitle: string;
  language: string;
  status: string;
  timeUsed?: number;
  memoryUsed?: number;
  createdAt: string;
}

/**
 * 练习Report排名接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface PracticeReportRank {
  userId: number;
  displayName: string;
  score: number;
  solved: number;
  submissionCount: number;
}

/**
 * 练习Report接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface PracticeReport {
  practiceId: number;
  participantCount: number;
  submissionCount: number;
  rankings: PracticeReportRank[];
  submissions: PracticeReportSubmission[];
}

/**
 * 管理员OrganizationOption接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AdminOrganizationOption {
  id: number;
  name: string;
  description?: string;
}

/**
 * 比赛测试点分数请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestCaseScorePayload {
  caseNo: number;
  score: number;
}

/**
 * 比赛题目请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestProblemPayload {
  contestProblemId?: number;
  problemId: number;
  label: string;
  score?: number;
  displayOrder?: number;
  caseScores?: ContestCaseScorePayload[];
}

/** Server-supported judge routes for a contest; submissions cannot override this choice. */
export type ContestJudgeMode = "GO_JUDGE" | "CCPCOJ";

/**
 * 比赛Draft请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestDraftPayload {
  title?: string;
  durationMinutes?: number;
  startTime?: string;
  description?: string;
  type?: "ACM" | "OI";
  judgeMode?: ContestJudgeMode;
  audience?: "ALL" | "CLASS";
  audienceTypes?: Array<"ALL" | "CLASS">;
  classIds?: number[];
  frozen?: boolean;
  freezeTime?: string | null;
  enableRollingScoreboard?: boolean;
  goldRatio?: number;
  silverRatio?: number;
  bronzeRatio?: number;
  allowAfterEndSubmit?: boolean;
  allowAfterEndViewProblem?: boolean;
  allowAfterEndViewCode?: boolean;
  publicScoreboardEnabled?: boolean;
  showClassOnScoreboard?: boolean;
  allowStarRegistration?: boolean;
  allowViewAllSubmissions?: boolean;
  registrationPassword?: string;
  totalScore?: number;
  problems?: ContestProblemPayload[];
}

/**
 * 比赛请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestPayload {
  title: string;
  description?: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  type: "ACM" | "OI";
  judgeMode: ContestJudgeMode;
  audience: "ALL" | "CLASS";
  audienceId?: number | null;
  audiences?: Array<{ audienceType: "ALL" | "CLASS"; audienceId?: number | null }>;
  frozen?: boolean;
  freezeTime?: string | null;
  enableRollingScoreboard?: boolean;
  goldRatio?: number;
  silverRatio?: number;
  bronzeRatio?: number;
  allowFullscreen?: boolean;
  antiCheatEnabled?: boolean;
  maxSwitches?: number;
  allowAfterEndSubmit?: boolean;
  allowAfterEndViewProblem?: boolean;
  allowAfterEndViewCode?: boolean;
  publicScoreboardEnabled?: boolean;
  showClassOnScoreboard?: boolean;
  allowStarRegistration?: boolean;
  allowViewAllSubmissions?: boolean;
  registrationType?: string;
  registrationPassword?: string;
  problems: ContestProblemPayload[];
}

/**
 * 管理员比赛接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AdminContest {
  id: number;
  title: string;
  description?: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  type: "ACM" | "OI";
  judgeMode: ContestJudgeMode;
  ownerId: number;
  ownerName: string;
  audience: "ALL" | "CLASS";
  audienceId?: number | null;
  audiences: Array<{ audienceType: "ALL" | "CLASS"; audienceId: number; name: string }>;
  frozen: boolean;
  freezeTime?: string | null;
  enableRollingScoreboard: boolean;
  goldRatio: number;
  silverRatio: number;
  bronzeRatio: number;
  allowAfterEndSubmit: boolean;
  allowAfterEndViewProblem: boolean;
  allowAfterEndViewCode: boolean;
  publicScoreboardEnabled: boolean;
  showClassOnScoreboard: boolean;
  allowStarRegistration: boolean;
  allowViewAllSubmissions: boolean;
  registrationType: string;
  hasPassword: boolean;
  status: "NOT_STARTED" | "RUNNING" | "ENDED";
  participantCount: number;
  submissionCount: number;
  problems: Array<{
    contestProblemId?: number;
    problemId: number;
    title: string;
    label: string;
    score?: number;
    displayOrder?: number;
    caseScores: ContestCaseScorePayload[];
    submissionCount?: number;
    acceptedCount?: number;
  }>;
}

/**
 * Public比赛接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface PublicContest {
  id: number;
  title: string;
  description?: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  type: "ACM" | "OI";
  audience: "ALL" | "CLASS";
  audiences: Array<{ audienceType: "ALL" | "CLASS"; audienceId: number; name: string }>;
  frozen: boolean;
  freezeTime?: string | null;
  enableRollingScoreboard: boolean;
  goldRatio: number;
  silverRatio: number;
  bronzeRatio: number;
  allowAfterEndSubmit: boolean;
  allowAfterEndViewProblem: boolean;
  allowAfterEndViewCode: boolean;
  publicScoreboardEnabled: boolean;
  showClassOnScoreboard: boolean;
  allowStarRegistration: boolean;
  allowViewAllSubmissions: boolean;
  registrationType: string;
  hasPassword: boolean;
  status: "NOT_STARTED" | "RUNNING" | "ENDED";
  participantCount: number;
  submissionCount: number;
  registered: boolean;
  registeredIdentityType?: "PERSONAL" | null;
  registeredIdentityId?: number | null;
  registeredIdentityName?: string | null;
  registeredStarred?: boolean | null;
  problems: AdminContest["problems"];
}

/**
 * 比赛报名Option接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestRegistrationOption {
  identityType: "PERSONAL";
  identityId?: number | null;
  name: string;
  available: boolean;
  disabledReason?: string | null;
  starAvailable?: boolean | null;
}

/**
 * 比赛报名请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestRegistrationPayload {
  identityType?: "PERSONAL";
  identityId?: number | null;
  starred?: boolean;
  password?: string;
}

/**
 * 比赛StandingRecord接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestStandingRecord {
  contestId: number;
  userId: number;
  displayName: string;
  classId?: number | null;
  className?: string | null;
  solved: number;
  penalty: number;
  lastAcTime?: string | null;
  score: number;
  identityType?: "PERSONAL";
  identityId?: number | null;
}

/**
 * 比赛榜单题目接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestScoreboardProblem {
  problemId: number;
  contestProblemId?: number;
  label: string;
  title: string;
  score?: number | null;
}

/**
 * 比赛榜单Cell接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestScoreboardCell {
  problemId: number;
  contestProblemId?: number;
  label: string;
  attempts: number;
  accepted: boolean;
  penalty: number;
  score: number;
  acceptedAt?: string | null;
}

/**
 * 比赛榜单Row接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestScoreboardRow {
  rank?: number | null;
  userId: number;
  displayName: string;
  classId?: number | null;
  className?: string | null;
  solved: number;
  penalty: number;
  score: number;
  lastAcceptedAt?: string | null;
  cells: ContestScoreboardCell[];
  identityType?: "PERSONAL";
  identityId?: number | null;
  starred?: boolean | null;
  medal?: "GOLD" | "SILVER" | "BRONZE" | null;
}

/**
 * 比赛榜单接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestScoreboard {
  contestId: number;
  title: string;
  type: "ACM" | "OI";
  status: "NOT_STARTED" | "RUNNING" | "ENDED";
  startTime: string;
  endTime: string;
  durationMinutes: number;
  problems: ContestScoreboardProblem[];
  rows: ContestScoreboardRow[];
  showClassOnScoreboard?: boolean;
}

/**
 * 比赛XcpcioPublic配置接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestXcpcioPublicConfig {
  contestId: number;
  enabled: boolean;
  mode: "CLICS_EXPORT" | "XCPCIO_PUSH";
  boardUrl?: string | null;
  embedAllowed: boolean;
  status: "DISABLED" | "PENDING" | "SYNCING" | "OK" | "FAILED";
  clicsScoreboardUrl?: string | null;
}

/**
 * 比赛Public榜单题目接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestPublicScoreboardProblem {
  label: string;
  title: string;
  score?: number | null;
}

/**
 * 比赛Public榜单题目状态接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestPublicScoreboardProblemStatus {
  accepted: boolean;
  attempts: number;
  timeMinutes?: number | null;
  acceptedAt?: string | null;
  score?: number | null;
  history?: ContestPublicScoreboardSubmissionHistory[];
}

/**
 * 比赛Public榜单提交History接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestPublicScoreboardSubmissionHistory {
  status: string;
  submittedAt: string;
  timeMinutes?: number | null;
}

/**
 * 比赛Public榜单Row接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestPublicScoreboardRow {
  rank?: number | null;
  userId: number;
  username: string;
  displayName: string;
  classId?: number | null;
  className?: string | null;
  solved: number;
  penalty: number;
  totalScore: number;
  lastAcTime?: string | null;
  medal?: "GOLD" | "SILVER" | "BRONZE" | null;
  revealed?: boolean | null;
  frozenRank?: number | null;
  finalRank?: number | null;
  starred?: boolean | null;
  problems: Record<string, ContestPublicScoreboardProblemStatus>;
}

/**
 * 比赛Public榜单接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestPublicScoreboard {
  contestId: number;
  contestTitle: string;
  contestType: "ACM" | "OI";
  startTime: string;
  endTime: string;
  frozen: boolean;
  freezeTime?: string | null;
  boardState?: "LIVE" | "FROZEN" | "ROLLING" | "FINAL";
  problems: ContestPublicScoreboardProblem[];
  rows: ContestPublicScoreboardRow[];
  showClassOnScoreboard?: boolean;
}

/**
 * 比赛RollingStep接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestRollingStep {
  step: number;
  identityType?: "PERSONAL";
  identityId?: number | null;
  userId: number;
  displayName: string;
  frozenRank?: number | null;
  finalRank?: number | null;
  solved: number;
  penalty: number;
  score: number;
  medal?: "GOLD" | "SILVER" | "BRONZE" | null;
  rankDelta?: number | null;
}

/**
 * 比赛RollingState接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestRollingState {
  contestId: number;
  status: "NOT_STARTED" | "ROLLING" | "FINISHED" | "PUBLISHED";
  currentStep: number;
  totalSteps: number;
  publishedFinal: boolean;
  steps: ContestRollingStep[];
  startedAt?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Public用户资料接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface PublicUserProfile {
  id: number;
  username: string;
  displayName: string;
  role: string;
  acCount: number;
  submitCount: number;
  totalScore: number;
  createdAt: string;
}

/**
 * 提交Record接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface SubmissionRecord {
  id: number;
  userId?: number;
  username?: string | null;
  displayName?: string | null;
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
}

/**
 * 提交队列Record接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface SubmissionQueueRecord {
  queueId: number;
  submissionId: number;
  contestId?: number | null;
  contestTitle?: string | null;
  problemId: number;
  contestProblemId?: number | null;
  problemLabel?: string | null;
  problemTitle: string;
  userId: number;
  username?: string | null;
  displayName: string;
  language: string;
  status: string;
  statusText: string;
  judgeServer?: string | null;
  priority: number;
  submitTime: string;
  startJudgeTime?: string | null;
  finishTime?: string | null;
  waitingTimeMillis: number;
  runningTimeMillis: number;
  retryCount: number;
  errorMessage?: string | null;
}

/**
 * 提交队列Log接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface SubmissionQueueLog {
  queueId: number;
  submissionId: number;
  status: string;
  judgeServer?: string | null;
  judgeMessage?: string | null;
  errorMessage?: string | null;
  submitTime: string;
  startJudgeTime?: string | null;
  finishTime?: string | null;
}

/**
 * 提交队列Query接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface SubmissionQueueQuery {
  page?: number;
  pageSize?: number;
  problemId?: number | null;
  userId?: number | null;
  language?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Backend题目接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface BackendProblem {
  id: number;
  title: string;
  statement: string;
  inputFormat?: string;
  outputFormat?: string;
  samples?: Array<{
    caseNo: number;
    input: string;
    output: string;
    explanation?: string;
  }>;
  timeLimit: number;
  memoryLimit: number;
  difficulty: number;
  tags: string[];
  folderId?: number;
  folderName?: string;
  ownerId: number;
  ownerName?: string;
  testCaseCount?: number;
  createdAt?: string;
  updatedAt?: string;
  acRate: number;
  attemptStatus?: string | null;
}

/**
 * Backend比赛题目接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface BackendContestProblem {
  id: number;
  contestProblemId: number;
  problemId: number;
  title: string;
  statement: string;
  inputFormat?: string;
  outputFormat?: string;
  sampleCases?: string;
  timeLimit: number;
  memoryLimit: number;
  difficulty: number;
  tags?: string[];
  ownerId?: number | null;
  isPublic?: boolean;
  acRate?: number;
  createdAt?: string;
  updatedAt?: string;
  samples?: Array<{
    caseNo: number;
    input: string;
    output: string;
    explanation?: string;
  }>;
  testCaseCount?: number;
  ownerName?: string;
  attemptStatus?: string | null;
}

/**
 * Backend用户当前用户接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface BackendUserMe {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  studentNo?: string;
  email?: string;
  role: "STUDENT" | "GUEST";
  totalSolved?: number;
  totalSubmissions?: number;
  classId?: number | null;
  className?: string | null;
}

/**
 * Backend比赛接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface BackendContest {
  id: number;
  title: string;
  description?: string;
  durationMinutes?: number;
  startTime: string;
  endTime: string;
  type: "ACM" | "OI";
  judgeMode?: ContestJudgeMode;
  ownerId?: number;
  ownerName?: string;
  audience: "ALL" | "CLASS";
  audienceId?: number | null;
  audiences?: Array<{ audienceType: "ALL" | "CLASS"; audienceId: number; name: string }>;
  frozen?: boolean;
  freezeTime?: string | null;
  enableRollingScoreboard?: boolean;
  goldRatio?: number;
  silverRatio?: number;
  bronzeRatio?: number;
  allowAfterEndSubmit?: boolean;
  allowAfterEndViewProblem?: boolean;
  allowAfterEndViewCode?: boolean;
  publicScoreboardEnabled?: boolean;
  showClassOnScoreboard?: boolean;
  allowStarRegistration?: boolean;
  allowViewAllSubmissions?: boolean;
  registrationType: string;
  hasPassword?: boolean;
  status: "NOT_STARTED" | "RUNNING" | "ENDED";
  participantCount?: number;
  submissionCount?: number;
  problems?: AdminContest["problems"];
  registered?: boolean;
  registeredIdentityType?: "PERSONAL" | null;
  registeredIdentityId?: number | null;
  registeredIdentityName?: string | null;
  registeredStarred?: boolean | null;
}

/**
 * BackendSlide接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface BackendSlide {
  id: number;
  title: string;
  imageUrl: string;
}

/**
 * Backend首页接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface BackendHome {
  carouselSlides: BackendSlide[];
  recentContests: BackendContest[];
}

/**
 * BackendRating用户接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface BackendRatingUser {
  userId: number;
  name: string;
  avatarUrl?: string | null;
  className?: string;
  acCount: number;
  streak: number;
}

/**
 * 封装difficultyLabel相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function difficultyLabel(value: number): Problem["difficulty"] {
  if (value === 1) return "入门";
  if (value === 2) return "简单";
  if (value === 3) return "中等";
  if (value === 4) return "困难";
  return "地狱";
}

/**
 * 封装比赛状态Label相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function contestStatusLabel(value: BackendContest["status"]): Contest["status"] {
  if (value === "RUNNING") return "进行中";
  if (value === "ENDED") return "已结束";
  return "未开始";
}

/**
 * 封装audienceLabel相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function audienceLabel(value: BackendContest["audience"]) {
  if (value === "CLASS") return "班级";
  return "全校公开";
}

/**
 * 封装filterVisibleAudienceTypes相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function filterVisibleAudienceTypes<T extends { audienceType: string }>(items: T[] | undefined) {
  return (items ?? []).filter((item) => item.audienceType === "ALL" || item.audienceType === "CLASS") as Array<
    T & { audienceType: "ALL" | "CLASS" }
  >;
}

/**
 * 封装visibleAudience相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function visibleAudience(value: "ALL" | "CLASS" | string): "ALL" | "CLASS" {
  return value === "CLASS" ? "CLASS" : "ALL";
}

/**
 * 封装visibleIdentity类型相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function visibleIdentityType(value?: "PERSONAL" | string | null): "PERSONAL" | null {
  if (value === "PERSONAL") return "PERSONAL";
  return null;
}

/**
 * 构造或转换题目。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function mapProblem(problem: BackendProblem): Problem {
  return {
    id: `p${encryptId(problem.id)}`,
    title: problem.title,
    summary: problem.statement,
    statement: problem.statement,
    inputFormat: problem.inputFormat || "",
    outputFormat: problem.outputFormat || "",
    samples: problem.samples ?? [],
    difficulty: difficultyLabel(problem.difficulty),
    tags: problem.tags ?? [],
    timeLimit: problem.timeLimit,
    memoryLimit: problem.memoryLimit,
    acRate: Number(problem.acRate ?? 0),
    owner: String(problem.ownerId),
    ownerName: problem.ownerName || String(problem.ownerId),
    testCaseCount: Number(problem.testCaseCount ?? 0),
    createdAt: problem.createdAt,
    updatedAt: problem.updatedAt,
    attemptStatus: problem.attemptStatus ?? null,
    score: 100,
  };
}

/**
 * 构造或转换比赛题目。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function mapContestProblem(problem: BackendContestProblem | BackendProblem): Problem {
  const snapshotId = "contestProblemId" in problem && problem.contestProblemId
    ? problem.contestProblemId
    : problem.id;
  return {
    id: `cp${encryptId(snapshotId)}`,
    title: problem.title,
    summary: problem.statement,
    statement: problem.statement,
    inputFormat: problem.inputFormat || "",
    outputFormat: problem.outputFormat || "",
    samples: problem.samples ?? [],
    difficulty: difficultyLabel(problem.difficulty),
    tags: problem.tags ?? [],
    timeLimit: problem.timeLimit,
    memoryLimit: problem.memoryLimit,
    acRate: Number(problem.acRate ?? 0),
    owner: String(problem.ownerId ?? 0),
    ownerName: problem.ownerName || "",
    testCaseCount: Number(problem.testCaseCount ?? 0),
    createdAt: problem.createdAt,
    updatedAt: problem.updatedAt,
    attemptStatus: problem.attemptStatus ?? null,
    score: 100,
  };
}

/**
 * Backend练习接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface BackendPractice {
  id: number;
  title: string;
  description?: string;
  audience: "ALL" | "CLASS";
  audienceId?: number | null;
  hasPassword: boolean;
  ownerId: number;
  problems: BackendProblem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 构造或转换比赛。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function mapContest(contest: BackendContest): Contest {
  return {
    id: String(contest.id),
    title: contest.title,
    type: contest.type,
    status: contestStatusLabel(contest.status),
    startsAt: contest.startTime,
    endsAt: contest.endTime,
    audience: audienceLabel(contest.audience),
    registration: contest.registrationType === "PASSWORD" ? "密码报名" : contest.registrationType === "PUBLIC" ? "公开报名" : "邀请码",
    participants: Number(contest.participantCount ?? 0),
  };
}

/**
 * 构造或转换管理员比赛。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function mapAdminContest(contest: BackendContest): AdminContest {
  return {
    id: contest.id,
    title: contest.title,
    description: contest.description || "",
    durationMinutes: Number(contest.durationMinutes ?? 0),
    startTime: contest.startTime,
    endTime: contest.endTime,
    type: contest.type,
    judgeMode: contest.judgeMode === "CCPCOJ" ? "CCPCOJ" : "GO_JUDGE",
    ownerId: Number(contest.ownerId ?? 0),
    ownerName: contest.ownerName || "",
    audience: visibleAudience(contest.audience),
    audienceId: contest.audienceId,
    audiences: filterVisibleAudienceTypes(contest.audiences),
    frozen: Boolean(contest.frozen),
    freezeTime: contest.freezeTime ?? null,
    enableRollingScoreboard: Boolean(contest.enableRollingScoreboard),
    goldRatio: Number(contest.goldRatio ?? 10),
    silverRatio: Number(contest.silverRatio ?? 20),
    bronzeRatio: Number(contest.bronzeRatio ?? 30),
    allowAfterEndSubmit: Boolean(contest.allowAfterEndSubmit),
    allowAfterEndViewProblem: contest.allowAfterEndViewProblem ?? true,
    allowAfterEndViewCode: Boolean(contest.allowAfterEndViewCode),
    publicScoreboardEnabled: contest.publicScoreboardEnabled ?? true,
    showClassOnScoreboard: Boolean(contest.showClassOnScoreboard),
    allowViewAllSubmissions: contest.allowViewAllSubmissions ?? true,
    allowStarRegistration: Boolean(contest.allowStarRegistration),
    registrationType: contest.registrationType,
    hasPassword: Boolean(contest.hasPassword),
    status: contest.status,
    participantCount: Number(contest.participantCount ?? 0),
    submissionCount: Number(contest.submissionCount ?? 0),
    problems: (contest.problems ?? []).map((item) => ({
      contestProblemId: item.contestProblemId,
      problemId: item.problemId,
      title: item.title,
      label: item.label,
      score: item.score,
      displayOrder: item.displayOrder,
      caseScores: item.caseScores ?? [],
      submissionCount: Number(item.submissionCount ?? 0),
      acceptedCount: Number(item.acceptedCount ?? 0),
    })),
  };
}

/**
 * 构造或转换Public比赛。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function mapPublicContest(contest: BackendContest): PublicContest {
  return {
    id: contest.id,
    title: contest.title,
    description: contest.description || "",
    durationMinutes: Number(contest.durationMinutes ?? 0),
    startTime: contest.startTime,
    endTime: contest.endTime,
    type: contest.type,
    audience: visibleAudience(contest.audience),
    audiences: filterVisibleAudienceTypes(contest.audiences),
    frozen: Boolean(contest.frozen),
    freezeTime: contest.freezeTime ?? null,
    enableRollingScoreboard: Boolean(contest.enableRollingScoreboard),
    goldRatio: Number(contest.goldRatio ?? 10),
    silverRatio: Number(contest.silverRatio ?? 20),
    bronzeRatio: Number(contest.bronzeRatio ?? 30),
    allowAfterEndSubmit: Boolean(contest.allowAfterEndSubmit),
    allowAfterEndViewProblem: contest.allowAfterEndViewProblem ?? true,
    allowAfterEndViewCode: Boolean(contest.allowAfterEndViewCode),
    publicScoreboardEnabled: contest.publicScoreboardEnabled ?? true,
    showClassOnScoreboard: Boolean(contest.showClassOnScoreboard),
    allowViewAllSubmissions: contest.allowViewAllSubmissions ?? true,
    allowStarRegistration: Boolean(contest.allowStarRegistration),
    registrationType: contest.registrationType,
    hasPassword: Boolean(contest.hasPassword),
    status: contest.status,
    participantCount: Number(contest.participantCount ?? 0),
    submissionCount: Number(contest.submissionCount ?? 0),
    registered: Boolean(contest.registered),
    registeredIdentityType: visibleIdentityType(contest.registeredIdentityType),
    registeredIdentityId: contest.registeredIdentityId ?? null,
    registeredIdentityName: contest.registeredIdentityName ?? null,
    registeredStarred: Boolean(contest.registeredStarred),
    problems: (contest.problems ?? []).map((item) => ({
      contestProblemId: item.contestProblemId,
      problemId: item.problemId,
      title: item.title,
      label: item.label,
      score: item.score,
      displayOrder: item.displayOrder,
      caseScores: item.caseScores ?? [],
      submissionCount: Number(item.submissionCount ?? 0),
      acceptedCount: Number(item.acceptedCount ?? 0),
    })),
  };
}

/**
 * 构造或转换Slide。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function mapSlide(slide: BackendSlide): CarouselSlide {
  return {
    id: `s${slide.id}`,
    title: slide.title,
    imageUrl: slide.imageUrl,
  };
}

/**
 * 构造或转换Rating。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function mapRating(user: BackendRatingUser): RatingUser {
  return {
    id: `r${user.userId}`,
    userId: user.userId,
    name: user.name,
    avatarUrl: user.avatarUrl || "",
    className: user.className || "",
    acCount: user.acCount,
    streak: user.streak,
  };
}

/**
 * 构造或转换练习。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function mapPractice(practice: BackendPractice): Practice {
  return {
    id: practice.id,
    title: practice.title,
    description: practice.description || "",
    audience: visibleAudience(practice.audience),
    audienceId: practice.audienceId,
    hasPassword: practice.hasPassword,
    ownerId: practice.ownerId,
    problems: (practice.problems ?? []).map(mapProblem),
    createdAt: practice.createdAt,
    updatedAt: practice.updatedAt,
  };
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
 * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；失败时向调用方传播异常。
 */
async function get<T>(url: string, token?: string, allowRefresh = true): Promise<T> {
  const response = await fetchWithTimeout(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  let body: ApiResponse<T> | null = null;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    body = null;
  }
  if (response.status === 401 && shouldRefreshFrontendToken(url, token, allowRefresh)) {
    const nextToken = await refreshFrontendAccessToken();
    if (nextToken) {
      return get<T>(url, nextToken, false);
    }
  }
  if (response.status === 401 && token && isAuthFailureMessage(body?.message)) {
    clearFrontendToken();
  }
  if (!response.ok) {
    throw new Error(body?.message || `request failed: ${response.status}`);
  }
  if (!body || body.code !== 200) {
    throw new Error(body?.message || "request failed");
  }
  return body.data;
}

/**
 * 封装请求相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；失败时向调用方传播异常。
 */
async function request<T>(
  url: string,
  options: RequestInit = {},
  token?: string,
  allowRefresh = true,
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  let body: ApiResponse<T> | null = null;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    body = null;
  }

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

  if (response.status === 401) {
    if (shouldRefreshFrontendToken(url, token, allowRefresh)) {
      const nextToken = await refreshFrontendAccessToken();
      if (nextToken) {
        return request<T>(url, options, nextToken, false);
      }
    }
    if (token && isAuthFailureMessage(body?.message)) {
      clearFrontendToken();
    }
  }
  if (!response.ok) {
    throw new Error(sanitizeErrorMessage(body?.message || `请求失败：${response.status}`));
  }
  if (!body || body.code !== 200) {
    throw new Error(sanitizeErrorMessage(body?.message || "请求失败"));
  }
  return body.data;
}

/**
 * 封装hydrateStateFromApi相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；会读写浏览器本地会话信息。
 */
export async function hydrateStateFromApi(current: OjState): Promise<OjState> {
  let token = getFrontendAccessToken() ?? undefined;
  let next = current;

  // 获取当前登录用户信息
  if (token) {
    try {
      const user = await fetchMe(token);
      token = getFrontendAccessToken() ?? token;
      next = { ...next, activeUser: user };
    } catch {
      // 认证失败时请求层会清除令牌；网络或服务异常时保留本地会话和缓存用户。
      if (!getFrontendAccessToken()) {
        next = { ...next, activeUser: null };
      }
    }
  } else {
    next = { ...next, activeUser: null };
  }

  try {
    const problems = await get<{ total: number; list: BackendProblem[] }>(
      "/api/v1/problems?page=1&pageSize=200",
      token,
    );
    if (problems.list.length > 0) {
      next = { ...next, problems: problems.list.map(mapProblem) };
    }
  } catch {
    // 保持已有状态，不重置
  }

  try {
    const home = await get<BackendHome>("/api/v1/home");
    next = {
      ...next,
      contests: home.recentContests?.length ? home.recentContests.map(mapContest) : next.contests,
      carouselSlides: home.carouselSlides?.length ? home.carouselSlides.map(mapSlide) : next.carouselSlides,
    };
  } catch {
    // 保持已有状态，不重置
  }

  try {
    const ratings = await get<BackendRatingUser[]>("/api/v1/leaderboard/global?limit=10", token);
    next = { ...next, ratings: ratings.map(mapRating) };
  } catch {
    return { ...next, ratings: [] };
  }

  // 拉取判题配置（判题开关 + 最大并发数），供做题页判断是否允许提交/调试
  try {
    const judgeSettings = await get<JudgeSettings>("/api/v1/settings/judge", token);
    next = { ...next, judgeSettings };
  } catch {
    // 拉取失败保持默认（判题开启），不打断 hydration
  }

  // 持久化到 localStorage，避免下次加载展示旧数据
  try {
    window.localStorage.setItem("qoj.frontend.state.v1", JSON.stringify(next));
  } catch {
    // localStorage 写入失败忽略
  }

  return next;
}

/**
 * 封装管理员登录相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminLogin(username: string, password: string) {
  return request<AuthTokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

/**
 * 封装登录相关逻辑。包含异步流程并由调用方处理完成或失败状态。
 */
export async function login(username: string, password: string) {
  const result = await request<FrontendLoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (result.portal === "TEACHER") {
    throw new Error("教师账号请使用教师端登录");
  }
  const tokens: AuthTokenResponse = result;
  saveFrontendAuthTokens(tokens);
  return tokens;
}

/**
 * 封装登录WithoutPersist相关逻辑。包含异步流程并由调用方处理完成或失败状态。
 */
export async function loginWithoutPersist(username: string, password: string) {
  return request<FrontendLoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

/**
 * 创建或提交目标数据。包含异步流程并由调用方处理完成或失败状态。
 */
export async function register(payload: RegisterPayload) {
  const tokens = await request<AuthTokenResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  saveFrontendAuthTokens(tokens);
  return tokens;
}

let _cachedMeToken: string | null = null;
let _cachedMeResult: ReturnType<typeof _buildMeResult> | null = null;

/**
 * 封装build当前用户结果相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function _buildMeResult(user: BackendUserMe) {
  return {
    id: `u${user.id}`,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || "",
    name: user.displayName || user.username,
    studentNo: user.studentNo || "",
    email: user.email || "",
    role: user.role === "GUEST" ? "STUDENT" : user.role,
    totalSolved: user.totalSolved ?? 0,
    totalSubmissions: user.totalSubmissions ?? 0,
    favoriteLanguage: "暂无",
    classId: user.classId ?? null,
    className: user.className ?? null,
  } as const;
}

/**
 * 读取当前用户并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
export async function fetchMe(token: string) {
  if (_cachedMeToken === token && _cachedMeResult) {
    return _cachedMeResult;
  }
  const user = await request<BackendUserMe>("/api/v1/auth/me", {}, token);
  _cachedMeToken = token;
  _cachedMeResult = _buildMeResult(user);
  return _cachedMeResult;
}

/** Clear the cached /auth/me result (call on logout). */
export function clearMeCache() {
  _cachedMeToken = null;
  _cachedMeResult = null;
}

/**
 * Update资料请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface UpdateProfilePayload {
  username?: string;
  displayName?: string;
  emailVerificationCode: string;
}

/**
 * BindEmail请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface BindEmailPayload {
  email: string;
  emailVerificationCode: string;
}

/**
 * UpdatePassword请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface UpdatePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

/**
 * ResetPassword请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ResetPasswordPayload {
  email: string;
  emailVerificationCode: string;
  newPassword: string;
}

/**
 * 班级JoinApplicationRecord接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ClassJoinApplicationRecord {
  id: number;
  classId: number;
  className?: string | null;
  userId: number;
  username?: string | null;
  displayName?: string | null;
  studentNo?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason?: string | null;
  createdAt: string;
  handledAt?: string | null;
}

/**
 * 班级JoinApplication请求参数接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ClassJoinApplicationPayload {
  reason?: string;
}

/**
 * 更新资料。包含异步流程并由调用方处理完成或失败状态。
 */
export async function updateProfile(payload: UpdateProfilePayload, token: string) {
  const result = await request<void>("/api/v1/auth/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
  clearMeCache();
  return result;
}

/**
 * 封装uploadMy头像相关逻辑。包含异步流程并由调用方处理完成或失败状态。
 */
export async function uploadMyAvatar(file: File, token: string) {
  const formData = new FormData();
  formData.append("file", file);
  const result = await request<{ avatarUrl: string }>("/api/v1/auth/avatar", {
    method: "POST",
    body: formData,
  }, token);
  clearMeCache();
  return result;
}

/**
 * 封装bindEmail相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function bindEmail(payload: BindEmailPayload, token: string) {
  return request<void>("/api/v1/auth/email", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

/**
 * 更新Password。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function updatePassword(payload: UpdatePasswordPayload, token: string) {
  return request<void>("/api/v1/auth/password", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

/**
 * 重置Password。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function resetPassword(payload: ResetPasswordPayload) {
  return request<void>("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * 校验Frontend令牌。失败时向调用方传播异常。
 */
function requireFrontendToken() {
  const token = getFrontendAccessToken();
  if (!token) {
    throw new Error("请先登录");
  }
  return token;
}

/**
 * 封装applyTo班级相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function applyToClass(classId: number, payload: ClassJoinApplicationPayload = {}) {
  return request<ClassJoinApplicationRecord>(
    `/api/v1/classes/${classId}/applications`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    requireFrontendToken(),
  );
}

/**
 * 读取Problems并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会读写浏览器本地会话信息。
 */
export async function fetchProblems() {
  const token = window.localStorage.getItem("qoj.accessToken") ?? undefined;
  const result = await get<{ total: number; list: BackendProblem[] }>(
    "/api/v1/problems?page=1&pageSize=200",
    token,
  );
  return result.list.map(mapProblem);
}

/**
 * 读取管理员Problems并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
export async function fetchAdminProblems(token: string, page = 1, pageSize = 10, keyword = "") {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (keyword.trim()) {
    query.set("keyword", keyword.trim());
  }
  const result = await request<{ total: number; list: BackendProblem[] }>(
    `/api/admin/v1/problems?${query.toString()}`,
    {},
    token,
  );
  return { total: result.total, list: result.list.map(mapProblem) };
}

/**
 * 读取题目详情并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会读写浏览器本地会话信息。
 */
export async function fetchProblemDetail(problemId: number) {
  const token = window.localStorage.getItem("qoj.accessToken") ?? undefined;
  return mapProblem(await get<BackendProblem>(`/api/v1/problems/${problemId}`, token));
}

/**
 * 读取My题目Submissions并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会读写浏览器本地会话信息。
 */
export async function fetchMyProblemSubmissions(problemId: number, contestId?: number | null) {
  const token = window.localStorage.getItem("qoj.accessToken") ?? undefined;
  const userId = currentUserIdFromAccessToken(token ?? null);
  const userQuery = userId ? `&userId=${userId}` : "";
  const contestQuery = contestId ? `&contestId=${contestId}` : "";
  const result = await request<{ total: number; list: SubmissionRecord[] }>(
    `/api/v1/submissions?page=1&pageSize=100&problemId=${problemId}${userQuery}${contestQuery}`,
    {},
    token,
  );
  return result.list;
}

/**
 * 读取提交详情并返回给调用方。会读写浏览器本地会话信息；失败时向调用方传播异常。
 */
export async function fetchSubmissionDetail(submissionId: number) {
  const token = window.localStorage.getItem("qoj.accessToken");
  if (!token) {
    throw new Error("请先登录后查看提交代码");
  }
  return request<SubmissionRecord>(`/api/v1/submissions/${submissionId}`, {}, token);
}

/**
 * 封装current用户标识From访问令牌相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function currentUserIdFromAccessToken(token: string | null) {
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
 * 封装提交队列Query相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function submissionQueueQuery(params: SubmissionQueueQuery = {}) {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 20));
  if (params.problemId) query.set("problemId", String(params.problemId));
  if (params.userId) query.set("userId", String(params.userId));
  if (params.language?.trim()) query.set("language", params.language.trim());
  if (params.status?.trim()) query.set("status", params.status.trim());
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);
  return query.toString();
}

/**
 * 读取提交队列并返回给调用方。会读写浏览器本地会话信息。
 */
export async function fetchSubmissionQueue(params: SubmissionQueueQuery = {}) {
  const token = window.localStorage.getItem("qoj.accessToken") ?? undefined;
  return request<{ total: number; list: SubmissionQueueRecord[] }>(
    `/api/v1/submission-queue?${submissionQueueQuery(params)}`,
    {},
    token,
  );
}

/**
 * 读取提交队列详情并返回给调用方。会读写浏览器本地会话信息。
 */
export async function fetchSubmissionQueueDetail(queueId: number) {
  const token = window.localStorage.getItem("qoj.accessToken") ?? undefined;
  return request<SubmissionQueueRecord>(`/api/v1/submission-queue/${queueId}`, {}, token);
}

/**
 * 读取MySubmissions并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会读写浏览器本地会话信息；失败时向调用方传播异常。
 */
export async function fetchMySubmissions(page = 1, pageSize = 20) {
  const token = window.localStorage.getItem("qoj.accessToken");
  if (!token) {
    throw new Error("请先登录后查看提交记录");
  }
  const userId = currentUserIdFromAccessToken(token);
  if (!userId) {
    throw new Error("登录状态异常，请重新登录");
  }
  const result = await request<{ total: number; list: SubmissionRecord[] }>(
    `/api/v1/submissions?page=${page}&pageSize=${pageSize}&userId=${userId}`,
    {},
    token,
  );
  return result.list;
}

/**
 * 读取管理员题目详情并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
export async function fetchAdminProblemDetail(token: string, problemId: number) {
  return mapProblem(await request<BackendProblem>(`/api/admin/v1/problems/${problemId}`, {}, token));
}

/**
 * 删除管理员题目。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function deleteAdminProblem(token: string, problemId: number) {
  return request<void>(`/api/admin/v1/problems/${problemId}`, { method: "DELETE" }, token);
}

/**
 * 更新管理员题目。包含异步流程并由调用方处理完成或失败状态。
 */
export async function updateAdminProblem(
  token: string,
  problemId: number,
  payload: ProblemDraftBasicPayload,
) {
  return mapProblem(
    await request<BackendProblem>(
      `/api/admin/v1/problems/${problemId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          title: payload.title,
          statement: payload.statement,
          inputFormat: payload.inputFormat,
          outputFormat: payload.outputFormat,
          sampleCases: JSON.stringify(payload.samples ?? []),
          timeLimit: payload.timeLimit,
          memoryLimit: payload.memoryLimit,
          difficulty: 1,
          tags: payload.tags ?? [],
          isPublic: payload.isPublic ?? true,
        }),
      },
      token,
    ),
  );
}

/**
 * 读取管理员题目TestCases并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchAdminProblemTestCases(token: string, problemId: number) {
  return request<ProblemTestCasePayload[]>(`/api/admin/v1/problems/${problemId}/test-cases`, {}, token);
}

/**
 * 创建或提交管理员题目Test测试点。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function createAdminProblemTestCase(
  token: string,
  problemId: number,
  payload: ProblemTestCasePayload,
) {
  return request<ProblemTestCasePayload>(
    `/api/admin/v1/problems/${problemId}/test-cases`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

/**
 * 更新管理员题目Test测试点。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function updateAdminProblemTestCase(
  token: string,
  problemId: number,
  testCaseId: number,
  payload: ProblemTestCasePayload,
) {
  return request<ProblemTestCasePayload>(
    `/api/admin/v1/problems/${problemId}/test-cases/${testCaseId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token,
  );
}

/**
 * 删除管理员题目Test测试点。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function deleteAdminProblemTestCase(token: string, problemId: number, testCaseId: number) {
  return request<void>(
    `/api/admin/v1/problems/${problemId}/test-cases/${testCaseId}`,
    { method: "DELETE" },
    token,
  );
}

/**
 * 封装import管理员题目TestCasesZip相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function importAdminProblemTestCasesZip(
  token: string,
  problemId: number,
  file: File,
  overwrite: boolean,
) {
  const form = new FormData();
  form.append("file", file);
  return request<void>(
    `/api/admin/v1/problems/${problemId}/test-cases/zip?overwrite=${overwrite ? "true" : "false"}`,
    {
      method: "POST",
      body: form,
      headers: {},
    },
    token,
  );
}

/**
 * 读取管理员仪表盘并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchAdminDashboard(token: string) {
  return request<AdminDashboard>("/api/admin/v1/dashboard", {}, token);
}

/**
 * 读取管理员Users并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchAdminUsers(token: string) {
  return request<{ total: number; list: AdminUser[] }>(
    "/api/admin/v1/users?page=1&pageSize=200",
    {},
    token,
  );
}

/**
 * 读取管理员UsersBy角色并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchAdminUsersByRole(token: string, role: AdminUser["role"], page = 1, pageSize = 10) {
  return request<{ total: number; list: AdminUser[] }>(
    `/api/admin/v1/users?page=${page}&pageSize=${pageSize}&role=${encodeURIComponent(role)}`,
    {},
    token,
  );
}

/**
 * 创建或提交管理员用户。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function createAdminUser(token: string, payload: AdminUserPayload) {
  return request<AdminUser>(
    "/api/admin/v1/users",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

/**
 * 更新管理员用户。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function updateAdminUser(
  token: string,
  userId: number,
  payload: AdminUserPayload,
) {
  return request<AdminUser>(
    `/api/admin/v1/users/${userId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token,
  );
}

/**
 * 删除管理员用户。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function deleteAdminUser(token: string, userId: number) {
  return request<void>(
    `/api/admin/v1/users/${userId}`,
    {
      method: "DELETE",
    },
    token,
  );
}

/**
 * 创建或提交题目Draft。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function createProblemDraft(token: string) {
  return request<ProblemDraft>("/api/admin/v1/problem-drafts", { method: "POST" }, token);
}

/**
 * 更新题目DraftBasic。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function saveProblemDraftBasic(
  token: string,
  draftId: string,
  payload: ProblemDraftBasicPayload,
) {
  return request<ProblemDraft>(
    `/api/admin/v1/problem-drafts/${draftId}/basic`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token,
  );
}

/**
 * 更新题目DraftTestCases。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function saveProblemDraftTestCases(
  token: string,
  draftId: string,
  testCases: ProblemTestCasePayload[],
) {
  return request<ProblemDraft>(
    `/api/admin/v1/problem-drafts/${draftId}/test-cases`,
    {
      method: "PUT",
      body: JSON.stringify({ testCases }),
    },
    token,
  );
}

/**
 * 封装import题目DraftZip相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function importProblemDraftZip(token: string, draftId: string, file: File, overwrite: boolean) {
  const form = new FormData();
  form.append("file", file);
  return request<ProblemDraft>(
    `/api/admin/v1/problem-drafts/${draftId}/test-cases/zip?overwrite=${overwrite ? "true" : "false"}`,
    {
      method: "POST",
      body: form,
      headers: {},
    },
    token,
  );
}

/**
 * 封装commit题目Draft相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function commitProblemDraft(token: string, draftId: string) {
  return request<BackendProblem>(
    `/api/admin/v1/problem-drafts/${draftId}/commit`,
    {
      method: "POST",
    },
    token,
  );
}

/**
 * 读取Practices并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
export async function fetchPractices(page = 1, pageSize = 20, scope: "all" | "public" | "class" = "all") {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    scope,
  });
  const token = getFrontendAccessToken() ?? undefined;
  const result = await get<{ total: number; list: BackendPractice[] }>(
    `/api/v1/practices?${params.toString()}`,
    token,
  );
  return {
    total: result.total,
    list: result.list.map(mapPractice),
  };
}

/**
 * 读取练习详情并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
export async function fetchPracticeDetail(practiceId: number, password?: string) {
  const token = getFrontendAccessToken() ?? undefined;
  if (password) {
    return mapPractice(await request<BackendPractice>(
      `/api/v1/practices/${practiceId}/unlock`,
      {
        method: "POST",
        body: JSON.stringify({ password }),
      },
      token,
    ));
  }
  return mapPractice(await get<BackendPractice>(`/api/v1/practices/${practiceId}`, token));
}

/**
 * 读取管理员Practices并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
export async function fetchAdminPractices(token: string) {
  const result = await request<{ total: number; list: BackendPractice[] }>(
    "/api/admin/v1/practices",
    {},
    token,
  );
  return result.list.map(mapPractice);
}

/**
 * 创建或提交管理员练习。包含异步流程并由调用方处理完成或失败状态。
 */
export async function createAdminPractice(token: string, payload: PracticePayload) {
  return mapPractice(
    await request<BackendPractice>(
      "/api/admin/v1/practices",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token,
    ),
  );
}

/**
 * 更新管理员练习。包含异步流程并由调用方处理完成或失败状态。
 */
export async function updateAdminPractice(token: string, practiceId: number, payload: PracticePayload) {
  return mapPractice(
    await request<BackendPractice>(
      `/api/admin/v1/practices/${practiceId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
      token,
    ),
  );
}

/**
 * 读取管理员练习Report并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchAdminPracticeReport(token: string, practiceId: number) {
  return request<PracticeReport>(`/api/admin/v1/practices/${practiceId}/report`, {}, token);
}

/**
 * 读取管理员Contests并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
export async function fetchAdminContests(token: string, page = 1, pageSize = 20) {
  const result = await request<{ total: number; list: BackendContest[] }>(
    `/api/admin/v1/contests?page=${page}&pageSize=${pageSize}`,
    {},
    token,
  );
  return { total: result.total, list: result.list.map(mapAdminContest) };
}

/**
 * 读取Contests并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
export async function fetchContests(page = 1, pageSize = 20) {
  const token = await getFrontendAccessTokenForOptionalAuth();
  const result = await get<{ total: number; list: BackendContest[] }>(
    `/api/v1/contests?page=${page}&pageSize=${pageSize}`,
    token,
  );
  return { total: result.total, list: result.list.map(mapPublicContest) };
}

/**
 * 读取比赛并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
export async function fetchContest(contestId: number) {
  const token = await getFrontendAccessTokenForOptionalAuth();
  return mapPublicContest(await get<BackendContest>(`/api/v1/contests/${contestId}`, token));
}

/**
 * 读取比赛Submissions并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会读写浏览器本地会话信息。
 */
export async function fetchContestSubmissions(contestId: number, page = 1, pageSize = 20) {
  const token = window.localStorage.getItem("qoj.accessToken") ?? undefined;
  const result = await request<{ total: number; list: SubmissionRecord[] }>(
    `/api/v1/submissions?page=${page}&pageSize=${pageSize}&contestId=${contestId}`,
    {},
    token,
  );
  return { total: result.total, list: result.list };
}

/**
 * 读取My比赛Submissions并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会读写浏览器本地会话信息；失败时向调用方传播异常。
 */
export async function fetchMyContestSubmissions(contestId: number, page = 1, pageSize = 20) {
  const token = window.localStorage.getItem("qoj.accessToken");
  if (!token) {
    throw new Error("请先登录后查看提交记录");
  }
  const me = await fetchMe(token);
  const userId = Number(me.id.replace('u', ''));
  const result = await request<{ total: number; list: SubmissionRecord[] }>(
    `/api/v1/submissions?page=${page}&pageSize=${pageSize}&contestId=${contestId}&userId=${userId}`,
    {},
    token,
  );
  return { total: result.total, list: result.list };
}

/**
 * 读取管理员比赛并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
export async function fetchAdminContest(token: string, contestId: number) {
  return mapAdminContest(await request<BackendContest>(`/api/admin/v1/contests/${contestId}`, {}, token));
}

/**
 * 创建或提交管理员比赛。包含异步流程并由调用方处理完成或失败状态。
 */
export async function createAdminContest(token: string, payload: ContestPayload) {
  return mapAdminContest(
    await request<BackendContest>(
      "/api/admin/v1/contests",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token,
    ),
  );
}

/**
 * 更新管理员比赛。包含异步流程并由调用方处理完成或失败状态。
 */
export async function updateAdminContest(token: string, contestId: number, payload: Partial<ContestPayload>) {
  return mapAdminContest(
    await request<BackendContest>(
      `/api/admin/v1/contests/${contestId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
      token,
    ),
  );
}

/**
 * 删除管理员比赛。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function deleteAdminContest(token: string, contestId: number) {
  return request<void>(`/api/admin/v1/contests/${contestId}`, { method: "DELETE" }, token);
}

/**
 * 读取管理员比赛Board并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchAdminContestBoard(token: string, contestId: number) {
  return request<ContestStandingRecord[]>(`/api/admin/v1/contests/${contestId}/board`, {}, token);
}

/**
 * 读取比赛榜单并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchContestScoreboard(contestId: number) {
  return get<ContestScoreboard>(`/api/v1/contests/${contestId}/scoreboard`);
}

/**
 * 读取比赛Public榜单并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchContestPublicScoreboard(contestId: number) {
  return get<ContestPublicScoreboard>(`/api/v1/contests/public/${contestId}/scoreboard`);
}

/**
 * 读取比赛RollingState并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchContestRollingState(token: string, contestId: number) {
  return request<ContestRollingState>(`/api/admin/v1/contests/${contestId}/rolling`, {}, token);
}

/**
 * 封装start比赛Rolling相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function startContestRolling(token: string, contestId: number) {
  return request<ContestRollingState>(
    `/api/admin/v1/contests/${contestId}/rolling/start`,
    { method: "POST" },
    token,
  );
}

/**
 * 封装step比赛Rolling相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function stepContestRolling(token: string, contestId: number, direction: "next" | "prev") {
  return request<ContestRollingState>(
    `/api/admin/v1/contests/${contestId}/rolling/step?direction=${direction}`,
    { method: "POST" },
    token,
  );
}

/**
 * 封装finish比赛Rolling相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function finishContestRolling(token: string, contestId: number) {
  return request<ContestRollingState>(
    `/api/admin/v1/contests/${contestId}/rolling/finish`,
    { method: "POST" },
    token,
  );
}

/**
 * 发送比赛Final榜单。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function publishContestFinalScoreboard(token: string, contestId: number) {
  return request<ContestRollingState>(
    `/api/admin/v1/contests/${contestId}/rolling/publish-final`,
    { method: "POST" },
    token,
  );
}

/**
 * 读取比赛XcpcioPublic配置并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchContestXcpcioPublicConfig(contestId: number) {
  return get<ContestXcpcioPublicConfig>(`/api/v1/contests/${contestId}/xcpcio/public-config`);
}

/**
 * 读取Public用户资料并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchPublicUserProfile(userId: number) {
  return get<PublicUserProfile>(`/api/v1/users/${userId}`);
}

/**
 * 读取比赛题目详情并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
export async function fetchContestProblemDetail(contestId: number, contestProblemId: number) {
  return mapContestProblem(
    await get<BackendProblem | BackendContestProblem>(`/api/v1/contests/${contestId}/problems/${contestProblemId}`),
  );
}

/**
 * 读取比赛报名Options并返回给调用方。会读写浏览器本地会话信息；失败时向调用方传播异常。
 */
export async function fetchContestRegistrationOptions(contestId: number) {
  const token = window.localStorage.getItem("qoj.accessToken");
  if (!token) {
    throw new Error("请先登录后报名比赛");
  }
  return request<ContestRegistrationOption[]>(
    `/api/v1/contests/${contestId}/registration-options`,
    {},
    token,
  );
}

/**
 * 创建或提交比赛。会读写浏览器本地会话信息；失败时向调用方传播异常。
 */
export async function registerContest(contestId: number, payload: ContestRegistrationPayload) {
  const token = window.localStorage.getItem("qoj.accessToken");
  if (!token) {
    throw new Error("请先登录后报名比赛");
  }
  return request<void>(
    `/api/v1/contests/${contestId}/register`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

/**
 * 读取比赛Draft并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchContestDraft(token: string) {
  return request<ContestDraftPayload | null>("/api/admin/v1/contests/draft", {}, token);
}

/**
 * 更新比赛Draft。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function saveContestDraft(token: string, payload: ContestDraftPayload) {
  return request<ContestDraftPayload>(
    "/api/admin/v1/contests/draft",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token,
  );
}

/**
 * 重置比赛Draft。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function clearContestDraft(token: string) {
  return request<void>("/api/admin/v1/contests/draft", { method: "DELETE" }, token);
}

/**
 * 读取管理员Classes并返回给调用方。包含异步流程并由调用方处理完成或失败状态。
 */
export async function fetchAdminClasses(token: string) {
  const result = await request<Array<{ id: number; name: string; description?: string }>>(
    "/api/admin/v1/classes",
    {},
    token,
  );
  return result.map((item) => ({ id: item.id, name: item.name, description: item.description }));
}

// Contest Ranking APIs
export async function fetchContestAcmRank(contestId: number) {
  return get<import('./contestRankTypes').ContestAcmRankVO[]>(`/api/v1/contests/${contestId}/rank?mode=ACM`);
}

/**
 * 读取比赛Oi排名并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchContestOiRank(contestId: number) {
  return get<import('./contestRankTypes').ContestOiRankVO[]>(`/api/v1/contests/${contestId}/rank?mode=OI`);
}

/**
 * 封装rebuild比赛Acm排名相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function rebuildContestAcmRank(token: string, contestId: number) {
  return request<void>(
    `/api/admin/v1/contests/${contestId}/rank/rebuild?mode=ACM`,
    { method: "POST" },
    token,
  );
}

/**
 * 封装rebuild比赛Oi排名相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function rebuildContestOiRank(token: string, contestId: number) {
  return request<void>(
    `/api/admin/v1/contests/${contestId}/rank/rebuild?mode=OI`,
    { method: "POST" },
    token,
  );
}

/**
 * 创建或提交比赛Snapshot。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function createContestSnapshot(token: string, contestId: number, type: 'freeze' | 'final') {
  return request<import('./contestRankTypes').ContestScoreboardSnapshot>(
    `/api/admin/v1/contests/${contestId}/scoreboard/snapshot?type=${type}`,
    { method: "POST" },
    token,
  );
}

/**
 * 读取比赛Snapshot并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchContestSnapshot(contestId: number, type: 'freeze' | 'final') {
  return get<import('./contestRankTypes').ContestScoreboardSnapshot>(
    `/api/v1/contests/${contestId}/scoreboard/snapshot/${type}`
  );
}

/**
 * 删除比赛Snapshot。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function deleteContestSnapshot(token: string, contestId: number, type: 'freeze' | 'final') {
  return request<void>(
    `/api/admin/v1/contests/${contestId}/scoreboard/snapshot/${type}`,
    { method: "DELETE" },
    token,
  );
}

// ==================== Announcements ====================

export interface Announcement {
  id: number;
  title: string;
  content: string;
  authorId: number;
  authorName: string;
  isVisible: boolean;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 公告Create请求接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AnnouncementCreateRequest {
  title: string;
  content: string;
  isVisible?: boolean;
  isPinned?: boolean;
}

/**
 * 公告Update请求接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AnnouncementUpdateRequest {
  title?: string;
  content?: string;
  isVisible?: boolean;
  isPinned?: boolean;
}

/**
 * 读取Announcements并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchAnnouncements(page: number = 1, pageSize: number = 10) {
  return get<{ total: number; list: Announcement[] }>(
    `/api/v1/announcements?page=${page}&pageSize=${pageSize}`
  );
}

/**
 * 读取LatestAnnouncements并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchLatestAnnouncements(limit: number = 5) {
  return get<Announcement[]>(
    `/api/v1/announcements/latest?limit=${limit}`
  );
}

/**
 * 读取Pinned公告并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchPinnedAnnouncement() {
  return get<Announcement | null>('/api/v1/announcements/pinned');
}

/**
 * 读取公告By标识并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchAnnouncementById(id: number) {
  return get<Announcement>(`/api/v1/announcements/${id}`);
}

/**
 * 封装管理员FetchAnnouncements相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminFetchAnnouncements(token: string, page: number = 1, pageSize: number = 10) {
  return get<{ total: number; list: Announcement[] }>(
    `/api/admin/v1/announcements?page=${page}&pageSize=${pageSize}`,
    token
  );
}

/**
 * 封装管理员Fetch公告By标识相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminFetchAnnouncementById(token: string, id: number) {
  return get<Announcement>(`/api/admin/v1/announcements/${id}`, token);
}

/**
 * 封装管理员Create公告相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminCreateAnnouncement(token: string, data: AnnouncementCreateRequest) {
  return request<number>(
    `/api/admin/v1/announcements`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
}

/**
 * 封装管理员Update公告相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminUpdateAnnouncement(token: string, id: number, data: AnnouncementUpdateRequest) {
  return request<void>(
    `/api/admin/v1/announcements/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
}

/**
 * 封装管理员Delete公告相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminDeleteAnnouncement(token: string, id: number) {
  return request<void>(
    `/api/admin/v1/announcements/${id}`,
    { method: "DELETE" },
    token
  );
}

// ==================== System Settings ====================

export interface FrontendSettings {
  siteTitle: string;
  siteLogo: string;
  maintenanceMode: boolean;
  footerText?: string;
  icpNumber?: string;
  footerLink1Text?: string;
  footerLink1Url?: string;
  footerLink2Text?: string;
  footerLink2Url?: string;
}

/**
 * 注册Settings接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface RegisterSettings {
  enabled: boolean;
  emailVerification: boolean;
  emailConfig: {
    host?: string;
    port?: number;
    username?: string;
    useSsl?: boolean;
    subject?: string;
    content?: string;
  };
  fieldsConfig: {
    studentNo: { enabled: boolean; required: boolean };
    email: { enabled: boolean; required: boolean };
  };
}

/**
 * 判题Settings接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface JudgeSettings {
  /** Public judge switches; engine routing is fixed by the backend. */
  enabled: boolean;
  enableSandbox?: boolean;
}

/**
 * PasswordChange请求接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface PasswordChangeRequest {
  oldPassword: string;
  newPassword: string;
}

/**
 * Email配置请求接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface EmailConfigRequest {
  host: string;
  port?: number;
  username: string;
  password?: string;
  useSsl?: boolean;
  subject?: string;
  content?: string;
}

// Public APIs
export async function fetchSiteTitle() {
  return get<string>(`/api/v1/settings/site-title`);
}

/**
 * 读取Maintenance模式并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchMaintenanceMode() {
  return get<boolean>(`/api/v1/settings/maintenance-mode`);
}

/**
 * 读取注册Settings并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchRegisterSettings() {
  return get<RegisterSettings>(`/api/v1/settings/register`);
}

/**
 * 读取判题Settings并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchJudgeSettings() {
  return get<JudgeSettings>(`/api/v1/settings/judge`);
}

// Admin APIs
export async function adminFetchFrontendSettings(token: string) {
  return get<FrontendSettings>(`/api/admin/v1/settings/frontend`, token);
}

/**
 * 封装管理员Fetch注册Settings相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminFetchRegisterSettings(token: string) {
  return get<RegisterSettings>(`/api/admin/v1/settings/register`, token);
}

/**
 * 封装管理员UpdateFrontendSettings相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminUpdateFrontendSettings(token: string, settings: FrontendSettings) {
  return request<void>(
    `/api/admin/v1/settings/frontend`,
    {
      method: "PUT",
      body: JSON.stringify(settings),
      headers: { "Content-Type": "application/json" }
    },
    token
  );
}

/**
 * 封装管理员UpdateSite标题相关逻辑。包含异步流程并由调用方处理完成或失败状态。
 */
export async function adminUpdateSiteTitle(token: string, title: string) {
  const settings = await adminFetchFrontendSettings(token);
  return adminUpdateFrontendSettings(token, { ...settings, siteTitle: title });
}

/**
 * 封装管理员UpdateMaintenance模式相关逻辑。包含异步流程并由调用方处理完成或失败状态。
 */
export async function adminUpdateMaintenanceMode(token: string, enabled: boolean) {
  const settings = await adminFetchFrontendSettings(token);
  return adminUpdateFrontendSettings(token, { ...settings, maintenanceMode: enabled });
}

/**
 * 封装管理员ChangePassword相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminChangePassword(token: string, data: PasswordChangeRequest) {
  return request<void>(
    `/api/admin/v1/settings/admin/password`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
}

/**
 * 封装管理员Update注册启用状态相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminUpdateRegisterEnabled(token: string, enabled: boolean) {
  return request<void>(
    `/api/admin/v1/settings/register/enabled`,
    {
      method: "PUT",
      body: JSON.stringify(enabled),
      headers: { "Content-Type": "application/json" }
    },
    token
  );
}

/**
 * 封装管理员UpdateEmailVerification相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminUpdateEmailVerification(token: string, enabled: boolean) {
  return request<void>(
    `/api/admin/v1/settings/register/email-verification`,
    {
      method: "PUT",
      body: JSON.stringify(enabled),
      headers: { "Content-Type": "application/json" }
    },
    token
  );
}

/**
 * 封装管理员UpdateEmail配置相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminUpdateEmailConfig(token: string, data: EmailConfigRequest) {
  return request<void>(
    `/api/admin/v1/settings/register/email-config`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
}

/**
 * 封装管理员UpdateFields配置相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function adminUpdateFieldsConfig(token: string, config: RegisterSettings['fieldsConfig']) {
  return request<void>(
    `/api/admin/v1/settings/register/fields-config`,
    {
      method: "PUT",
      body: JSON.stringify(config),
    },
    token
  );
}
