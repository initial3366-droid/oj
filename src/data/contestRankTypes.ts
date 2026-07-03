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

export interface AcmProblemStatusVO {
  contestProblemId: number;
  label: string;
  isSolved: boolean;
  wrongAttempts: number;
  solveTimeMinutes?: number;
}

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

export interface OiProblemScoreVO {
  contestProblemId: number;
  label: string;
  bestScore: number;
  fullScore: number;
  submissionCount: number;
}

export interface ContestScoreboardSnapshot {
  id: number;
  contestId: number;
  scoringMode: 'ACM' | 'OI' | string;
  snapshotType: 'freeze' | 'final';
  data: string;
  generatedBy?: number | null;
  createdAt: string;
}
