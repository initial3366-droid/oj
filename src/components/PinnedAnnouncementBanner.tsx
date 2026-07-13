import { Card, Modal } from '@douyinfe/semi-ui';
import { IconBell } from '@douyinfe/semi-icons';
import { useEffect, useMemo, useState } from 'react';
import { fetchPinnedAnnouncement, type Announcement } from '../data/apiClient';
import { sanitizeAnnouncementHtml } from '../utils/html';

export function PinnedAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    let ignore = false;

    fetchPinnedAnnouncement()
      .then((data) => {
        if (!ignore) {
          setAnnouncement(data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setAnnouncement(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const safeTitleHtml = useMemo(
    () => sanitizeAnnouncementHtml(announcement?.title || ''),
    [announcement?.title],
  );

  const safeContentHtml = useMemo(
    () => sanitizeAnnouncementHtml(announcement?.content || ''),
    [announcement?.content],
  );

  if (!announcement) {
    return null;
  }

  return (
    <div className="front-pinned-announcement">
      <Card className="front-pinned-announcement-card" bodyStyle={{ padding: '0 16px', height: 60 }}>
        <button
          type="button"
          className="front-pinned-announcement-title-button"
          onClick={() => setModalVisible(true)}
          title={announcement.title.replace(/<[^>]*>/g, '')}
        >
          <span className="front-pinned-announcement-icon">
            <IconBell />
          </span>
          <div
            className="qoj-announcement-title-html front-pinned-announcement-title-text"
            dangerouslySetInnerHTML={{ __html: safeTitleHtml }}
          />
        </button>
      </Card>

      <Modal
        title={
          <div
            className="qoj-announcement-title-html front-pinned-announcement-modal-title"
            dangerouslySetInnerHTML={{ __html: safeTitleHtml }}
          />
        }
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={920}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        bodyStyle={{ padding: '24px 32px 36px' }}
      >
        <div
          className="qoj-announcement-html"
          style={{
            lineHeight: 2,
            fontSize: 15,
            margin: 0,
          }}
          dangerouslySetInnerHTML={{ __html: safeContentHtml }}
        />
      </Modal>
    </div>
  );
}
