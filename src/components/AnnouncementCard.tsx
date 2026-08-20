/**
 * 公告Card组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Card, Modal, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { fetchLatestAnnouncements, type Announcement } from '../data/apiClient';
import { AnnouncementContent, announcementPlainText } from './AnnouncementContent';

const { Paragraph, Title } = Typography;

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
          border: '1px solid #f0f0f0',
          background: '#ffffff',
        }}
        styles={{ body: { padding: '20px 24px' } }}
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
            <BellOutlined style={{ fontSize: 20 }} />
          </div>
          <Title level={5} style={{ margin: 0 }}>
            公告
          </Title>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              style={{
                cursor: 'pointer',
                borderRadius: 8,
                border: '1px solid #f0f0f0',
                padding: 16,
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
              <Paragraph
                ellipsis={{ rows: 2 }}
                style={{ margin: 0, fontSize: 14 }}
                type="secondary"
              >
                {announcementPlainText(announcement.content)}
              </Paragraph>
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(0, 0, 0, 0.45)' }}>
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
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={920}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        styles={{ body: { padding: '24px 32px 36px' } }}
      >
        {selectedAnnouncement && (
          <div style={{ paddingBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 14,
                color: 'rgba(0, 0, 0, 0.45)',
                marginBottom: 22,
                paddingBottom: 18,
                borderBottom: '1px solid #f0f0f0',
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
          border-color: #1677ff !important;
          background-color: #e6f4ff !important;
        }
        .announcement-item:focus-visible {
          outline: 2px solid #1677ff;
          outline-offset: 2px;
        }
        .announcement-item:hover .announcement-list-title {
          color: #1677ff !important;
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
