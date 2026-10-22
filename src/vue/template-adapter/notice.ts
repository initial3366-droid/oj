import { sanitizeAnnouncementHtml } from "../../utils/announcementHtml";
import { adminPath } from "../../utils/adminPath";
import type { NoticeQueryParams, NoticeItem, NoticeDetail } from '../../../vendor/vue3-element-admin/src/api/system/notice/types';
export type { NoticeQueryParams, NoticeItem, NoticeDetail };
interface Announcement { id: number; title: string; content: string; createdAt?: string }
async function announcements(): Promise<Announcement[]> {
  const response = await fetch('/api/v1/announcements');
  if (!response.ok) return [];
  const body = await response.json();
  return Array.isArray(body.data) ? body.data : body.data?.list || body.data?.records || [];
}
const readKey = 'qoj.template.readAnnouncements';
function readIds(): string[] { try { return JSON.parse(localStorage.getItem(readKey) || '[]'); } catch { return []; } }
function convert(item: Announcement): NoticeItem {
  return { id: String(item.id), title: item.title, content: sanitizeAnnouncementHtml(item.content), type: 1, level: '', publishStatus: 1, publishTime: item.createdAt ? new Date(item.createdAt) : undefined, isRead: readIds().includes(String(item.id)) ? 1 : 0 };
}
export default {
  async getMyNoticePage(query?: NoticeQueryParams) {
    const list = (await announcements()).map(convert).filter(item => query?.isRead === undefined || item.isRead === query.isRead);
    return { list: list.slice(0, query?.pageSize || 5), total: list.length };
  },
  async getDetail(id: string): Promise<NoticeDetail> {
    const item = (await announcements()).find(item => String(item.id) === id);
    if (!item) throw new Error('公告不存在');
    localStorage.setItem(readKey, JSON.stringify([...new Set([...readIds(), id])]));
    return { ...convert(item), publisherName: 'QOJ' } as NoticeDetail;
  },
  async readAll() { localStorage.setItem(readKey, JSON.stringify((await announcements()).map(item => String(item.id)))); },
};

export function useNoticeDestination() { return location.pathname.startsWith(adminPath("/")) ? adminPath("/settings/announcements") : "/"; }
