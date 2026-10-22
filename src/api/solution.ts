import { apiGet, apiPost } from './client';

export interface ProblemSolutionLevel {
  height: number;
  currentLevel: number;
  maxViewedLevel: number;
  content: string;
  acceptedCount: number;
  acceptedLevel: number | null;
  levelAcceptedCounts: number[];
}

function practiceQuery(practiceId?: number) {
  return practiceId ? `?practiceId=${encodeURIComponent(practiceId)}` : '';
}

export function fetchProblemSolution(problemId: number, practiceId?: number): Promise<ProblemSolutionLevel> {
  return apiGet<ProblemSolutionLevel>(`/api/v1/problems/${problemId}/solution${practiceQuery(practiceId)}`, true);
}

export function acceptProblemSolutionLevel(problemId: number, level: number, practiceId?: number): Promise<ProblemSolutionLevel> {
  return apiPost<ProblemSolutionLevel>(`/api/v1/problems/${problemId}/solution/accept${practiceQuery(practiceId)}`, { level }, true);
}

export function advanceProblemSolutionLevel(problemId: number, practiceId?: number): Promise<ProblemSolutionLevel> {
  return apiPost<ProblemSolutionLevel>(`/api/v1/problems/${problemId}/solution/next${practiceQuery(practiceId)}`, {}, true);
}

export function viewProblemSolutionLevel(problemId: number, level: number, practiceId?: number): Promise<ProblemSolutionLevel> {
  return apiPost<ProblemSolutionLevel>(`/api/v1/problems/${problemId}/solution/view${practiceQuery(practiceId)}`, { level }, true);
}
