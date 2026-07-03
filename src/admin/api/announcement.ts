/**
 * 公告管理 API
 */
import { adminGet, adminPost, adminPut, adminDelete } from './adminClient';

export interface Announcement {
  id: number;
  title: string;
  content: string;
  authorId: number;
  authorName: string;
  isVisible: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementCreateRequest {
  title: string;
  content: string;
  isVisible?: boolean;
}

export interface AnnouncementUpdateRequest {
  title?: string;
  content?: string;
  isVisible?: boolean;
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
