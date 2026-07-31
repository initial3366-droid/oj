/**
 * 排行榜相关 API
 */
import { apiGet } from "./client";

/**
 * Rating用户接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface RatingUser {
  userId: number;
  name: string;
  avatarUrl?: string | null;
  className?: string;
  acCount: number;
  streak: number;
  weekAcCount?: number;
}

/**
 * 用户排名接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface UserRank extends RatingUser {
  rank: number;
}

/**
 * 班级排名接口，明确该模块内部及 API 边界使用的数据结构。
 */
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

/**
 * 读取排行榜用户排名并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export async function fetchLeaderboardUserRank(userId: number): Promise<UserRank> {
  return apiGet<UserRank>(`/api/v1/leaderboard/user/${userId}`);
}

/**
 * 获取班级 AC 排行榜
 */
export async function fetchClassLeaderboard(limit = 100): Promise<ClassRank[]> {
  return apiGet<ClassRank[]>(`/api/v1/leaderboard/classes?limit=${limit}`);
}
