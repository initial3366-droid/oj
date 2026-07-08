/**
 * 比赛相关 API
 */
import { apiGet, apiPost } from "./client";

export interface Contest {
  id: number;
  title: string;
  description?: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  type: "ACM" | "OI";
  audience: "ALL" | "CLASS";
  audiences: Array<{
    audienceType: "ALL" | "CLASS";
    audienceId: number;
    name: string;
  }>;
  registrationType: string;
  hasPassword: boolean;
  status: "NOT_STARTED" | "RUNNING" | "ENDED";
  participantCount: number;
  submissionCount: number;
  registered: boolean;
  registeredIdentityType?: "PERSONAL" | null;
  registeredIdentityId?: number | null;
  registeredIdentityName?: string | null;
  problems?: Array<{
    contestProblemId?: number;
    problemId: number;
    title: string;
    label: string;
    score?: number;
    displayOrder?: number;
    caseScores: Array<{ caseNo: number; score: number }>;
  }>;
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

export interface ContestScoreboard {
  contestId: number;
  title: string;
  type: "ACM" | "OI";
  status: "NOT_STARTED" | "RUNNING" | "ENDED";
  startTime: string;
  endTime: string;
  durationMinutes: number;
  problems: Array<{
    problemId: number;
    contestProblemId?: number;
    label: string;
    title: string;
    score?: number | null;
  }>;
  rows: Array<{
    rank: number;
    userId: number;
    displayName: string;
    solved: number;
    penalty: number;
    score: number;
    lastAcceptedAt?: string | null;
    cells: Array<{
      problemId: number;
      contestProblemId?: number;
      label: string;
      attempts: number;
      accepted: boolean;
      penalty: number;
      score: number;
      acceptedAt?: string | null;
    }>;
    identityType?: "PERSONAL";
    identityId?: number | null;
  }>;
}

/**
 * 获取比赛列表
 */
export async function fetchContests(
  page = 1,
  pageSize = 20
): Promise<{ total: number; list: Contest[] }> {
  return apiGet<{ total: number; list: Contest[] }>(
    `/api/v1/contests?page=${page}&pageSize=${pageSize}`
  );
}

/**
 * 获取比赛详情
 */
export async function fetchContest(contestId: number): Promise<Contest> {
  return apiGet<Contest>(`/api/v1/contests/${contestId}`);
}

/**
 * 获取比赛榜单
 */
export async function fetchContestScoreboard(contestId: number): Promise<ContestScoreboard> {
  return apiGet<ContestScoreboard>(`/api/v1/contests/${contestId}/scoreboard`);
}

/**
 * 获取比赛报名选项
 */
export async function fetchContestRegistrationOptions(
  contestId: number
): Promise<ContestRegistrationOption[]> {
  return apiGet<ContestRegistrationOption[]>(
    `/api/v1/contests/${contestId}/registration-options`,
    true
  );
}

/**
 * 报名比赛
 */
export async function registerContest(
  contestId: number,
  payload: ContestRegistrationPayload
): Promise<void> {
  return apiPost<void>(`/api/v1/contests/${contestId}/register`, payload, true);
}
