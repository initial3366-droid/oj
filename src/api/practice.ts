/**
 * 题单相关 API
 */
import { apiGet } from "./client";
import type { Problem } from "./problem";

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
 * 获取题单列表
 */
export async function fetchPractices(): Promise<Practice[]> {
  const result = await apiGet<{ total: number; list: Practice[] }>(
    "/api/v1/practices"
  );
  return result.list;
}

/**
 * 获取题单详情
 */
export async function fetchPracticeDetail(
  practiceId: number,
  password?: string
): Promise<Practice> {
  const query = password ? `?password=${encodeURIComponent(password)}` : "";
  return apiGet<Practice>(`/api/v1/practices/${practiceId}${query}`);
}
