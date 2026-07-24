/**
 * 题目相关 API
 */
import { apiGet } from "./client";
import type { Problem, Difficulty } from "../data/types";
import { encryptId } from "../utils/cipher";

// 导出类型
export type { Problem } from "../data/types";

// 导出后端接口（用于类型标注）
export interface BackendProblem {
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
 * 封装difficultyLabel相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function difficultyLabel(value: number): Difficulty {
  if (value === 1) return "入门";
  if (value === 2) return "简单";
  if (value === 3) return "中等";
  if (value === 4) return "困难";
  return "地狱";
}

/**
 * 将后端 Problem 转换为前端 Problem
 */
export function mapProblem(problem: BackendProblem): Problem {
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
 * 将后端比赛 Problem 转换为前端 Problem
 */
export function mapContestProblem(problem: BackendProblem & { contestProblemId?: number }): Problem {
  const snapshotId = problem.contestProblemId ?? problem.id;
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
 * 获取题目列表
 */
export async function fetchProblems(
  page = 1,
  pageSize = 20,
  keyword?: string
): Promise<{ total: number; list: BackendProblem[] }> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (keyword?.trim()) {
    query.set("keyword", keyword.trim());
  }
  return apiGet<{ total: number; list: BackendProblem[] }>(
    `/api/v1/problems?${query.toString()}`
  );
}

/**
 * 获取题目详情（已转换为前端格式）
 */
export async function fetchProblemDetail(problemId: number): Promise<Problem> {
  const backend = await apiGet<BackendProblem>(
    `/api/v1/problems/${problemId}`,
    Boolean(window.localStorage.getItem("qoj.accessToken")),
  );
  return mapProblem(backend);
}

/**
 * 获取比赛题目详情（已转换为前端格式）
 */
export async function fetchContestProblemDetail(
  contestId: number,
  contestProblemId: number
): Promise<Problem> {
  const backend = await apiGet<BackendProblem & { contestProblemId?: number }>(
    `/api/v1/contests/${contestId}/problems/${contestProblemId}`
  );
  return mapContestProblem(backend);
}
