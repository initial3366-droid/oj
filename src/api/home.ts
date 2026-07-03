/**
 * 首页相关 API
 */
import { apiGet } from "./client";

export interface CarouselSlide {
  id: number;
  title: string;
  imageUrl: string;
  cta: string;
  targetUrl: string;
}

export interface HomeContest {
  id: number;
  title: string;
  description?: string;
  durationMinutes?: number;
  startTime: string;
  endTime: string;
  type: "ACM" | "OI";
  audience: "ALL" | "CLUB";
  status: "NOT_STARTED" | "RUNNING" | "ENDED";
  participantCount?: number;
}

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
