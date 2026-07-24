/**
 * 比赛排名Types数据模块。定义前端领域类型、数据转换或共享状态访问方式。
 */
// Contest Ranking Types

export interface ContestAcmRankVO {
  participantId: number;
  userId: number;
  nickname: string;
  organizationName?: string;
  rankNo: number;
  solvedCount: number;
  penaltyTime: number;
  submissionCount: number;
  lastAcTime?: string;
  problemStatus: AcmProblemStatusVO[];
}

/**
 * Acm题目状态VO接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AcmProblemStatusVO {
  contestProblemId: number;
  label: string;
  isSolved: boolean;
  wrongAttempts: number;
  solveTimeMinutes?: number;
}

/**
 * 比赛Oi排名VO接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestOiRankVO {
  participantId: number;
  userId: number;
  nickname: string;
  organizationName?: string;
  rankNo: number;
  totalScore: number;
  solvedCount: number;
  submissionCount: number;
  lastScoreUpdateTime?: string;
  problemScores: OiProblemScoreVO[];
}

/**
 * Oi题目分数VO接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface OiProblemScoreVO {
  contestProblemId: number;
  label: string;
  bestScore: number;
  fullScore: number;
  submissionCount: number;
}

/**
 * 比赛榜单Snapshot接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface ContestScoreboardSnapshot {
  id: number;
  contestId: number;
  scoringMode: 'ACM' | 'OI' | string;
  snapshotType: 'freeze' | 'final';
  data: string;
  generatedBy?: number | null;
  createdAt: string;
}
