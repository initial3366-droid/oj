/**
 * 公告Card组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Card, Modal, Typography } from '@douyinfe/semi-ui';
import { IconBell } from '@douyinfe/semi-icons';
import { useEffect, useState } from 'react';
import { fetchLatestAnnouncements, type Announcement } from '../data/apiClient';
import { AnnouncementContent, announcementPlainText } from './AnnouncementContent';

/**
 * 渲染公告Card组件，并协调其数据加载、状态和交互。
 */
export function AnnouncementCard() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestAnnouncements(5)
      .then((data) => {
        setAnnouncements(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  /**
   * 处理公告Click。会更新 React 状态并触发重新渲染。
   */
  const handleAnnouncementClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setIsModalOpen(true);
  };

  if (loading || announcements.length === 0) {
    return null;
  }

  return (
    <>
      <Card
        style={{
          border: '1px solid var(--semi-color-border)',
          background: 'var(--semi-color-bg-0)',
        }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 8,
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: 'rgb(59, 130, 246)',
            }}
          >
            <IconBell size="large" />
          </div>
          <Typography.Title heading={5} style={{ margin: 0 }}>
            公告
          </Typography.Title>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              style={{
                cursor: 'pointer',
                borderRadius: 8,
                border: '1px solid var(--semi-color-border)',
                padding: 16,
                transition: 'all 0.2s',
              }}
              className="announcement-item"
              role="button"
              tabIndex={0}
              onClick={() => handleAnnouncementClick(announcement)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleAnnouncementClick(announcement);
                }
              }}
            >
              <AnnouncementContent content={announcement.title} className="announcement-list-title" />
              <Typography.Paragraph
                ellipsis={{ rows: 2 }}
                style={{ margin: 0, fontSize: 14 }}
                type="secondary"
              >
                {announcementPlainText(announcement.content)}
              </Typography.Paragraph>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--semi-color-text-2)' }}>
                更新于 {new Date(announcement.updatedAt || announcement.createdAt).toLocaleDateString('zh-CN')}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        title={selectedAnnouncement ? (
          <AnnouncementContent content={selectedAnnouncement.title} className="announcement-modal-title" />
        ) : undefined}
        visible={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={920}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        bodyStyle={{ padding: '24px 32px 36px' }}
      >
        {selectedAnnouncement && (
          <div style={{ paddingBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 14,
                color: 'var(--semi-color-text-2)',
                marginBottom: 22,
                paddingBottom: 18,
                borderBottom: '1px solid var(--semi-color-border)',
              }}
            >
              <span>
                更新时间：{new Date(selectedAnnouncement.updatedAt || selectedAnnouncement.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
            <AnnouncementContent content={selectedAnnouncement.content} className="announcement-modal-content" />
          </div>
        )}
      </Modal>

      <style>{`
        .announcement-item:hover {
          border-color: var(--semi-color-primary) !important;
          background-color: var(--semi-color-primary-light-default) !important;
        }
        .announcement-item:focus-visible {
          outline: 2px solid var(--semi-color-primary);
          outline-offset: 2px;
        }
        .announcement-item:hover .announcement-list-title {
          color: var(--semi-color-primary) !important;
        }
        .announcement-list-title {
          margin-bottom: 8px;
          font-size: 15px;
          font-weight: 600;
          line-height: 1.5;
        }
        .announcement-list-title > * {
          display: block;
          width: 100%;
          overflow: hidden;
          margin: 0;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .announcement-modal-content {
          padding: 10px 0 24px;
        }
        .announcement-modal-title {
          font-size: 18px;
          font-weight: 600;
          line-height: 1.5;
        }
      `}</style>
    </>
  );
}
