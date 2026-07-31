/**
 * 首页相关 API
 */
import { apiGet } from "./client";

/**
 * CarouselSlide接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface CarouselSlide {
  id: number;
  title: string;
  imageUrl: string;
  cta: string;
  targetUrl: string;
}

/**
 * 首页比赛接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface HomeContest {
  id: number;
  title: string;
  description?: string;
  durationMinutes?: number;
  startTime: string;
  endTime: string;
  type: "ACM" | "OI";
  audience: "ALL" | "CLASS";
  status: "NOT_STARTED" | "RUNNING" | "ENDED";
  participantCount?: number;
}

/**
 * 首页Data接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface HomeData {
  carouselSlides: CarouselSlide[];
  recentContests: HomeContest[];
}

/**
 * 获取首页数据
 */
export async function fetchHomeData(): Promise<HomeData> {
  return apiGet<HomeData>("/api/v1/home");
}
