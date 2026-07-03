import { Card, Modal, Typography } from '@douyinfe/semi-ui';
import { IconBell } from '@douyinfe/semi-icons';
import { useEffect, useState } from 'react';
import { fetchLatestAnnouncements, type Announcement } from '../data/apiClient';

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
              onClick={() => handleAnnouncementClick(announcement)}
            >
              <Typography.Title
                heading={6}
                style={{ margin: 0, marginBottom: 8, fontSize: 15 }}
                className="announcement-title"
              >
                {announcement.title}
              </Typography.Title>
              <Typography.Paragraph
                ellipsis={{ rows: 2 }}
                style={{ margin: 0, fontSize: 14 }}
                type="secondary"
              >
                {announcement.content}
              </Typography.Paragraph>
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 12,
                  color: 'var(--semi-color-text-2)',
                }}
              >
                <span>{announcement.authorName}</span>
                <span>·</span>
                <span>{new Date(announcement.createdAt).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        title={selectedAnnouncement?.title}
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
              <span>{selectedAnnouncement.authorName}</span>
              <span>·</span>
              <span>{new Date(selectedAnnouncement.createdAt).toLocaleString('zh-CN')}</span>
            </div>
            <Typography.Paragraph
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 2,
                fontSize: 15,
                margin: 0,
                padding: '10px 0 24px',
              }}
            >
              {selectedAnnouncement.content}
            </Typography.Paragraph>
          </div>
        )}
      </Modal>

      <style>{`
        .announcement-item:hover {
          border-color: var(--semi-color-primary) !important;
          background-color: var(--semi-color-primary-light-default) !important;
        }
        .announcement-item:hover .announcement-title {
          color: var(--semi-color-primary) !important;
        }
      `}</style>
    </>
  );
}
