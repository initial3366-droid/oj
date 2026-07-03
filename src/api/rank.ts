/**
 * 排行榜相关 API
 */
import { apiGet } from "./client";

export interface RatingUser {
  userId: number;
  name: string;
  className?: string;
  acCount: number;
  streak: number;
  weekAcCount?: number;
}

export interface UserRank extends RatingUser {
  rank: number;
}

export interface ClassRank {
  classId: number;
  className: string;
  memberCount: number;
  acCount: number;
  teacherName: string;
}

/**
 * 获取全局排行榜
 */
export async function fetchGlobalLeaderboard(limit = 10): Promise<RatingUser[]> {
  return apiGet<RatingUser[]>(`/api/v1/leaderboard/global?limit=${limit}`);
}

export async function fetchLeaderboardUserRank(userId: number): Promise<UserRank> {
  return apiGet<UserRank>(`/api/v1/leaderboard/user/${userId}`);
}

/**
 * 获取班级 AC 排行榜
 */
export async function fetchClassLeaderboard(limit = 100): Promise<ClassRank[]> {
  return apiGet<ClassRank[]>(`/api/v1/leaderboard/classes?limit=${limit}`);
}
