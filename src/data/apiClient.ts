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

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

const API_TIMEOUT_MS = 15000;
const FRONT_ACCESS_TOKEN_KEY = "qoj.accessToken";
const FRONT_REFRESH_TOKEN_KEY = "qoj.refreshToken";
let frontendRefreshPromise: Promise<string | null> | null = null;

function clearFrontendToken() {
  window.localStorage.removeItem(FRONT_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(FRONT_REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event("qoj:auth-cleared"));
}

export function saveFrontendAuthTokens(tokens: AuthTokenResponse) {
  window.localStorage.setItem(FRONT_ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(FRONT_REFRESH_TOKEN_KEY, tokens.refreshToken);
}

function getFrontendAccessToken() {
  return window.localStorage.getItem(FRONT_ACCESS_TOKEN_KEY);
}

function getFrontendRefreshToken() {
  return window.localStorage.getItem(FRONT_REFRESH_TOKEN_KEY);
}

function shouldRefreshJwtToken(token: string, skewSeconds = 30) {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) {
      return true;
    }
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const payload = JSON.parse(window.atob(padded)) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    // Optional-auth endpoints are permitAll on the backend. If a stale/corrupt token is sent,
    // the backend may silently treat the request as anonymous and return registered=false.
    // Try refreshing first so pages that depend on optional identity do not briefly show guest state.
    return true;
  }
}

async function getFrontendAccessTokenForOptionalAuth() {
  const token = getFrontendAccessToken();
  if (!token) {
    return undefined;
  }
  if (!shouldRefreshJwtToken(token)) {
    return token;
  }
  return (await refreshFrontendAccessToken()) ?? undefined;
}

function shouldRefreshFrontendToken(url: string, token?: string, allowRefresh = true) {
  return Boolean(
    allowRefresh
    && token
    && !url.includes("/api/v1/auth/login")
    && !url.includes("/api/v1/auth/register")
    && !url.includes("/api/v1/auth/refresh")
  );
}

async function refreshFrontendAccessToken() {
  const refreshToken = getFrontendRefreshToken();
  if (!refreshToken) {
    return null;
  }

  if (!frontendRefreshPromise) {
    frontendRefreshPromise = (async () => {
      try {
        const response = await fetchWithTimeout("/api/v1/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const body = (await response.json()) as ApiResponse<AuthTokenResponse>;
        if (!response.ok || !body || body.code !== 200) {
          clearFrontendToken();
          return null;
        }
        saveFrontendAuthTokens(body.data);
        return body.data.accessToken;
      } catch {
        clearFrontendToken();
        return null;
      }
    })().finally(() => {
      frontendRefreshPromise = null;
    });
  }

  return frontendRefreshPromise;
}

function timeoutSignal() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  return { controller, timeout };
}

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

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
}

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

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
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

export interface RegisterPayload {
  username: string;
  studentNo: string;
  email: string;
  password: string;
  emailVerificationCode: string;
}

export interface ProblemSamplePayload {
  input: string;
  output: string;
  explanation?: string;
}

export interface ProblemTestCasePayload {
  id?: number;
  caseNo?: number;
  input: string;
  output: string;
  explanation?: string;
  sample?: boolean;
}

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

export interface ProblemDraft {
  draftId: string;
  basic: ProblemDraftBasicPayload | null;
  testCases: ProblemTestCasePayload[];
}

export interface PracticePayload {
  title: string;
  description?: string;
  audience?: "ALL" | "CLASS";
  audienceId?: number | null;
  password?: string;
  problemIds: number[];
}

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

export interface PracticeReportRank {
  userId: number;
  displayName: string;
  score: number;
  solved: number;
  submissionCount: number;
}

export interface PracticeReport {
  practiceId: number;
  participantCount: number;
  submissionCount: number;
  rankings: PracticeReportRank[];
  submissions: PracticeReportSubmission[];
}

export interface AdminOrganizationOption {
  id: number;
  name: string;
  description?: string;
}

export interface ContestCaseScorePayload {
  caseNo: number;
  score: number;
}

export interface ContestProblemPayload {
  contestProblemId?: number;
  problemId: number;
  label: string;
  score?: number;
  displayOrder?: number;
  caseScores?: ContestCaseScorePayload[];
}

export interface ContestDraftPayload {
  title?: string;
  durationMinutes?: number;
  startTime?: string;
  description?: string;
  type?: "ACM" | "OI";
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

export interface ContestPayload {
  title: string;
  description?: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  type: "ACM" | "OI";
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

export interface AdminContest {
  id: number;
  title: string;
  description?: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  type: "ACM" | "OI";
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

export interface ContestRegistrationOption {
  identityType: "PERSONAL";
  identityId?: number | null;
  name: string;
  available: boolean;
  disabledReason?: string | null;
  starAvailable?: boolean | null;
}

export interface ContestRegistrationPayload {
  identityType?: "PERSONAL";
  identityId?: number | null;
  starred?: boolean;
  password?: string;
}

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

export interface ContestScoreboardProblem {
  problemId: number;
  contestProblemId?: number;
  label: string;
  title: string;
  score?: number | null;
}

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

export interface ContestXcpcioPublicConfig {
  contestId: number;
  enabled: boolean;
  mode: "CLICS_EXPORT" | "XCPCIO_PUSH";
  boardUrl?: string | null;
  embedAllowed: boolean;
  status: "DISABLED" | "PENDING" | "SYNCING" | "OK" | "FAILED";
  clicsScoreboardUrl?: string | null;
}

export interface ContestPublicScoreboardProblem {
  label: string;
  title: string;
  score?: number | null;
}

export interface ContestPublicScoreboardProblemStatus {
  accepted: boolean;
  attempts: number;
  timeMinutes?: number | null;
  acceptedAt?: string | null;
  score?: number | null;
  history?: ContestPublicScoreboardSubmissionHistory[];
}

export interface ContestPublicScoreboardSubmissionHistory {
  status: string;
  submittedAt: string;
  timeMinutes?: number | null;
}

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
  domjudgeProblemId?: string | null;
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

interface BackendUserMe {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  studentNo?: string;
  email?: string;
  role: "STUDENT" | "TEACHER" | "SUPER_ADMIN" | "GUEST";
  totalSolved?: number;
  totalSubmissions?: number;
  classId?: number | null;
  className?: string | null;
}

interface BackendContest {
  id: number;
  title: string;
  description?: string;
  durationMinutes?: number;
  startTime: string;
  endTime: string;
  type: "ACM" | "OI";
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

interface BackendSlide {
  id: number;
  title: string;
  imageUrl: string;
}

interface BackendHome {
  carouselSlides: BackendSlide[];
  recentContests: BackendContest[];
}

interface BackendRatingUser {
  userId: number;
  name: string;
  className?: string;
  acCount: number;
  streak: number;
}

function difficultyLabel(value: number): Problem["difficulty"] {
  if (value === 1) return "入门";
  if (value === 2) return "简单";
  if (value === 3) return "中等";
  if (value === 4) return "困难";
  return "地狱";
}

function contestStatusLabel(value: BackendContest["status"]): Contest["status"] {
  if (value === "RUNNING") return "进行中";
  if (value === "ENDED") return "已结束";
  return "未开始";
}

function audienceLabel(value: BackendContest["audience"]) {
  if (value === "CLASS") return "班级";
  return "全校公开";
}

function filterVisibleAudienceTypes<T extends { audienceType: string }>(items: T[] | undefined) {
  return (items ?? []).filter((item) => item.audienceType === "ALL" || item.audienceType === "CLASS") as Array<
    T & { audienceType: "ALL" | "CLASS" }
  >;
}

function visibleAudience(value: "ALL" | "CLASS" | string): "ALL" | "CLASS" {
  return value === "CLASS" ? "CLASS" : "ALL";
}

function visibleIdentityType(value?: "PERSONAL" | string | null): "PERSONAL" | null {
  if (value === "PERSONAL") return "PERSONAL";
  return null;
}

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

function mapAdminContest(contest: BackendContest): AdminContest {
  return {
    id: contest.id,
    title: contest.title,
    description: contest.description || "",
    durationMinutes: Number(contest.durationMinutes ?? 0),
    startTime: contest.startTime,
    endTime: contest.endTime,
    type: contest.type,
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

function mapSlide(slide: BackendSlide): CarouselSlide {
  return {
    id: `s${slide.id}`,
    title: slide.title,
    imageUrl: slide.imageUrl,
  };
}

function mapRating(user: BackendRatingUser): RatingUser {
  return {
    id: `r${user.userId}`,
    name: user.name,
    className: user.className || "",
    acCount: user.acCount,
    streak: user.streak,
  };
}

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

function isAuthFailureMessage(message?: string) {
  if (!message) {
    return false;
  }
  return message.includes("未登录")
    || message.includes("登录已过期")
    || message.includes("Token")
    || message.includes("token");
}

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
      // Token 无效，清除 localStorage 并通知页面状态同步
      clearFrontendToken();
      next = { ...next, activeUser: null };
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

export async function adminLogin(username: string, password: string) {
  return request<AuthTokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function login(username: string, password: string) {
  const tokens = await request<AuthTokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  saveFrontendAuthTokens(tokens);
  return tokens;
}

export async function loginWithoutPersist(username: string, password: string) {
  const tokens = await request<AuthTokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return tokens;
}

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

export interface UpdateProfilePayload {
  username?: string;
  displayName?: string;
  emailVerificationCode: string;
}

export interface BindEmailPayload {
  email: string;
  emailVerificationCode: string;
}

export interface UpdatePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

export interface ResetPasswordPayload {
  email: string;
  emailVerificationCode: string;
  newPassword: string;
}

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

export interface ClassJoinApplicationPayload {
  reason?: string;
}

export async function updateProfile(payload: UpdateProfilePayload, token: string) {
  return request<void>("/api/v1/auth/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

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

export async function bindEmail(payload: BindEmailPayload, token: string) {
  return request<void>("/api/v1/auth/email", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export async function updatePassword(payload: UpdatePasswordPayload, token: string) {
  return request<void>("/api/v1/auth/password", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export async function resetPassword(payload: ResetPasswordPayload) {
  return request<void>("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function requireFrontendToken() {
  const token = getFrontendAccessToken();
  if (!token) {
    throw new Error("请先登录");
  }
  return token;
}

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

export async function fetchProblems() {
  const token = window.localStorage.getItem("qoj.accessToken") ?? undefined;
  const result = await get<{ total: number; list: BackendProblem[] }>(
    "/api/v1/problems?page=1&pageSize=200",
    token,
  );
  return result.list.map(mapProblem);
}

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

export async function fetchProblemDetail(problemId: number) {
  const token = window.localStorage.getItem("qoj.accessToken") ?? undefined;
  return mapProblem(await get<BackendProblem>(`/api/v1/problems/${problemId}`, token));
}

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

export async function fetchSubmissionDetail(submissionId: number) {
  const token = window.localStorage.getItem("qoj.accessToken");
  if (!token) {
    throw new Error("请先登录后查看提交代码");
  }
  return request<SubmissionRecord>(`/api/v1/submissions/${submissionId}`, {}, token);
}

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

export async function fetchSubmissionQueue(params: SubmissionQueueQuery = {}) {
  const token = window.localStorage.getItem("qoj.accessToken") ?? undefined;
  return request<{ total: number; list: SubmissionQueueRecord[] }>(
    `/api/v1/submission-queue?${submissionQueueQuery(params)}`,
    {},
    token,
  );
}

export async function fetchSubmissionQueueDetail(queueId: number) {
  const token = window.localStorage.getItem("qoj.accessToken") ?? undefined;
  return request<SubmissionQueueRecord>(`/api/v1/submission-queue/${queueId}`, {}, token);
}

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

export async function fetchAdminProblemDetail(token: string, problemId: number) {
  return mapProblem(await request<BackendProblem>(`/api/admin/v1/problems/${problemId}`, {}, token));
}

export async function deleteAdminProblem(token: string, problemId: number) {
  return request<void>(`/api/admin/v1/problems/${problemId}`, { method: "DELETE" }, token);
}

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

export async function fetchAdminProblemTestCases(token: string, problemId: number) {
  return request<ProblemTestCasePayload[]>(`/api/admin/v1/problems/${problemId}/test-cases`, {}, token);
}

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

export async function deleteAdminProblemTestCase(token: string, problemId: number, testCaseId: number) {
  return request<void>(
    `/api/admin/v1/problems/${problemId}/test-cases/${testCaseId}`,
    { method: "DELETE" },
    token,
  );
}

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

export async function fetchAdminDashboard(token: string) {
  return request<AdminDashboard>("/api/admin/v1/dashboard", {}, token);
}

export async function fetchAdminUsers(token: string) {
  return request<{ total: number; list: AdminUser[] }>(
    "/api/admin/v1/users?page=1&pageSize=200",
    {},
    token,
  );
}

export async function fetchAdminUsersByRole(token: string, role: AdminUser["role"], page = 1, pageSize = 10) {
  return request<{ total: number; list: AdminUser[] }>(
    `/api/admin/v1/users?page=${page}&pageSize=${pageSize}&role=${encodeURIComponent(role)}`,
    {},
    token,
  );
}

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

export async function deleteAdminUser(token: string, userId: number) {
  return request<void>(
    `/api/admin/v1/users/${userId}`,
    {
      method: "DELETE",
    },
    token,
  );
}

export async function createProblemDraft(token: string) {
  return request<ProblemDraft>("/api/admin/v1/problem-drafts", { method: "POST" }, token);
}

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

export async function commitProblemDraft(token: string, draftId: string) {
  return request<BackendProblem>(
    `/api/admin/v1/problem-drafts/${draftId}/commit`,
    {
      method: "POST",
    },
    token,
  );
}

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

export async function fetchPracticeDetail(practiceId: number, password?: string) {
  const query = password ? `?password=${encodeURIComponent(password)}` : "";
  const token = getFrontendAccessToken() ?? undefined;
  return mapPractice(await get<BackendPractice>(`/api/v1/practices/${practiceId}${query}`, token));
}

export async function fetchAdminPractices(token: string) {
  const result = await request<{ total: number; list: BackendPractice[] }>(
    "/api/admin/v1/practices",
    {},
    token,
  );
  return result.list.map(mapPractice);
}

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

export async function fetchAdminPracticeReport(token: string, practiceId: number) {
  return request<PracticeReport>(`/api/admin/v1/practices/${practiceId}/report`, {}, token);
}

export async function fetchAdminContests(token: string, page = 1, pageSize = 20) {
  const result = await request<{ total: number; list: BackendContest[] }>(
    `/api/admin/v1/contests?page=${page}&pageSize=${pageSize}`,
    {},
    token,
  );
  return { total: result.total, list: result.list.map(mapAdminContest) };
}

export async function fetchContests(page = 1, pageSize = 20) {
  const token = await getFrontendAccessTokenForOptionalAuth();
  const result = await get<{ total: number; list: BackendContest[] }>(
    `/api/v1/contests?page=${page}&pageSize=${pageSize}`,
    token,
  );
  return { total: result.total, list: result.list.map(mapPublicContest) };
}

export async function fetchContest(contestId: number) {
  const token = await getFrontendAccessTokenForOptionalAuth();
  return mapPublicContest(await get<BackendContest>(`/api/v1/contests/${contestId}`, token));
}

export async function fetchContestSubmissions(contestId: number, page = 1, pageSize = 20) {
  const token = window.localStorage.getItem("qoj.accessToken") ?? undefined;
  const result = await request<{ total: number; list: SubmissionRecord[] }>(
    `/api/v1/submissions?page=${page}&pageSize=${pageSize}&contestId=${contestId}`,
    {},
    token,
  );
  return { total: result.total, list: result.list };
}

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

export async function fetchAdminContest(token: string, contestId: number) {
  return mapAdminContest(await request<BackendContest>(`/api/admin/v1/contests/${contestId}`, {}, token));
}

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

export async function deleteAdminContest(token: string, contestId: number) {
  return request<void>(`/api/admin/v1/contests/${contestId}`, { method: "DELETE" }, token);
}

export async function fetchAdminContestBoard(token: string, contestId: number) {
  return request<ContestStandingRecord[]>(`/api/admin/v1/contests/${contestId}/board`, {}, token);
}

export async function fetchContestScoreboard(contestId: number) {
  return get<ContestScoreboard>(`/api/v1/contests/${contestId}/scoreboard`);
}

export async function fetchContestPublicScoreboard(contestId: number) {
  return get<ContestPublicScoreboard>(`/api/v1/contests/public/${contestId}/scoreboard`);
}

export async function fetchContestRollingState(token: string, contestId: number) {
  return request<ContestRollingState>(`/api/admin/v1/contests/${contestId}/rolling`, {}, token);
}

export async function startContestRolling(token: string, contestId: number) {
  return request<ContestRollingState>(
    `/api/admin/v1/contests/${contestId}/rolling/start`,
    { method: "POST" },
    token,
  );
}

export async function stepContestRolling(token: string, contestId: number, direction: "next" | "prev") {
  return request<ContestRollingState>(
    `/api/admin/v1/contests/${contestId}/rolling/step?direction=${direction}`,
    { method: "POST" },
    token,
  );
}

export async function finishContestRolling(token: string, contestId: number) {
  return request<ContestRollingState>(
    `/api/admin/v1/contests/${contestId}/rolling/finish`,
    { method: "POST" },
    token,
  );
}

export async function publishContestFinalScoreboard(token: string, contestId: number) {
  return request<ContestRollingState>(
    `/api/admin/v1/contests/${contestId}/rolling/publish-final`,
    { method: "POST" },
    token,
  );
}

export async function fetchContestXcpcioPublicConfig(contestId: number) {
  return get<ContestXcpcioPublicConfig>(`/api/v1/contests/${contestId}/xcpcio/public-config`);
}

export async function fetchPublicUserProfile(userId: number) {
  return get<PublicUserProfile>(`/api/v1/users/${userId}`);
}

export async function fetchContestProblemDetail(contestId: number, contestProblemId: number) {
  return mapContestProblem(
    await get<BackendProblem | BackendContestProblem>(`/api/v1/contests/${contestId}/problems/${contestProblemId}`),
  );
}

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

export async function fetchContestDraft(token: string) {
  return request<ContestDraftPayload | null>("/api/admin/v1/contests/draft", {}, token);
}

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

export async function clearContestDraft(token: string) {
  return request<void>("/api/admin/v1/contests/draft", { method: "DELETE" }, token);
}

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

export async function fetchContestOiRank(contestId: number) {
  return get<import('./contestRankTypes').ContestOiRankVO[]>(`/api/v1/contests/${contestId}/rank?mode=OI`);
}

export async function rebuildContestAcmRank(token: string, contestId: number) {
  return request<void>(
    `/api/admin/v1/contests/${contestId}/rank/rebuild?mode=ACM`,
    { method: "POST" },
    token,
  );
}

export async function rebuildContestOiRank(token: string, contestId: number) {
  return request<void>(
    `/api/admin/v1/contests/${contestId}/rank/rebuild?mode=OI`,
    { method: "POST" },
    token,
  );
}

export async function createContestSnapshot(token: string, contestId: number, type: 'freeze' | 'final') {
  return request<import('./contestRankTypes').ContestScoreboardSnapshot>(
    `/api/admin/v1/contests/${contestId}/scoreboard/snapshot?type=${type}`,
    { method: "POST" },
    token,
  );
}

export async function fetchContestSnapshot(contestId: number, type: 'freeze' | 'final') {
  return get<import('./contestRankTypes').ContestScoreboardSnapshot>(
    `/api/v1/contests/${contestId}/scoreboard/snapshot/${type}`
  );
}

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
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementCreateRequest {
  title: string;
  content: string;
  isVisible?: boolean;
}

export interface AnnouncementUpdateRequest {
  title?: string;
  content?: string;
  isVisible?: boolean;
}

export async function fetchAnnouncements(page: number = 1, pageSize: number = 10) {
  return get<{ total: number; list: Announcement[] }>(
    `/api/v1/announcements?page=${page}&pageSize=${pageSize}`
  );
}

export async function fetchLatestAnnouncements(limit: number = 5) {
  return get<Announcement[]>(
    `/api/v1/announcements/latest?limit=${limit}`
  );
}

export async function fetchAnnouncementById(id: number) {
  return get<Announcement>(`/api/v1/announcements/${id}`);
}

export async function adminFetchAnnouncements(token: string, page: number = 1, pageSize: number = 10) {
  return get<{ total: number; list: Announcement[] }>(
    `/api/admin/v1/announcements?page=${page}&pageSize=${pageSize}`,
    token
  );
}

export async function adminFetchAnnouncementById(token: string, id: number) {
  return get<Announcement>(`/api/admin/v1/announcements/${id}`, token);
}

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

export interface JudgeSettings {
  enabled: boolean;
  mode?: 'domjudge' | 'docker' | 'unsafe-local';
  contestMode?: 'domjudge' | 'docker' | 'unsafe-local';
  enableUnsafeLocalJudge?: boolean;
  enableSandbox?: boolean;
  maxConcurrent: number;
  threadPoolSize: number;
  queueBatchSize?: number;
  pollIntervalMs?: number;
  domjudgeBaseUrl?: string;
  hasDomjudgeApiKey?: boolean;
  domjudgeContestId?: string;
  domjudgePollIntervalMs?: number;
}

export interface PasswordChangeRequest {
  oldPassword: string;
  newPassword: string;
}

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

export async function fetchMaintenanceMode() {
  return get<boolean>(`/api/v1/settings/maintenance-mode`);
}

export async function fetchRegisterSettings() {
  return get<RegisterSettings>(`/api/v1/settings/register`);
}

export async function fetchJudgeSettings() {
  return get<JudgeSettings>(`/api/v1/settings/judge`);
}

// Admin APIs
export async function adminFetchFrontendSettings(token: string) {
  return get<FrontendSettings>(`/api/admin/v1/settings/frontend`, token);
}

export async function adminFetchRegisterSettings(token: string) {
  return get<RegisterSettings>(`/api/admin/v1/settings/register`, token);
}

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

export async function adminUpdateSiteTitle(token: string, title: string) {
  const settings = await adminFetchFrontendSettings(token);
  return adminUpdateFrontendSettings(token, { ...settings, siteTitle: title });
}

export async function adminUpdateMaintenanceMode(token: string, enabled: boolean) {
  const settings = await adminFetchFrontendSettings(token);
  return adminUpdateFrontendSettings(token, { ...settings, maintenanceMode: enabled });
}

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
