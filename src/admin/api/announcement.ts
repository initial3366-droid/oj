/**
 * 公告管理 API
 */
import { adminGet, adminPost, adminPut, adminDelete } from './adminClient';

/**
 * 公告接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface Announcement {
  id: number;
  title: string;
  content: string;
  authorId: number;
  authorName: string;
  isVisible: boolean;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 公告Create请求接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AnnouncementCreateRequest {
  title: string;
  content: string;
  isVisible?: boolean;
  isPinned?: boolean;
}

/**
 * 公告Update请求接口，明确该模块内部及 API 边界使用的数据结构。
 */
export interface AnnouncementUpdateRequest {
  title?: string;
  content?: string;
  isVisible?: boolean;
  isPinned?: boolean;
}

/**
 * 获取公告列表
 */
export async function fetchAnnouncementList(
  page: number = 1,
  pageSize: number = 10
): Promise<{ total: number; list: Announcement[] }> {
  return adminGet<{ total: number; list: Announcement[] }>(
    `/api/admin/v1/announcements?page=${page}&pageSize=${pageSize}`,
    true
  );
}

/** 获取独立的置顶公告；未设置时返回 null。 */
export async function fetchPinnedAnnouncement(): Promise<Announcement | null> {
  return adminGet<Announcement | null>('/api/admin/v1/announcements/pinned', true);
}

/**
 * 获取公告详情
 */
export async function fetchAnnouncementById(id: number): Promise<Announcement> {
  return adminGet<Announcement>(`/api/admin/v1/announcements/${id}`, true);
}

/**
 * 创建公告
 */
export async function createAnnouncement(
  data: AnnouncementCreateRequest
): Promise<number> {
  return adminPost<number>('/api/admin/v1/announcements', data, true);
}

/**
 * 更新公告
 */
export async function updateAnnouncement(
  id: number,
  data: AnnouncementUpdateRequest
): Promise<void> {
  return adminPut<void>(`/api/admin/v1/announcements/${id}`, data, true);
}

/**
 * 删除公告
 */
export async function deleteAnnouncement(id: number): Promise<void> {
  return adminDelete<void>(`/api/admin/v1/announcements/${id}`, true);
}
