/**
 * Pinned公告Card组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Card, Modal } from 'antd';
import { PushpinOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { fetchPinnedAnnouncement, type Announcement } from '../data/apiClient';
import { AnnouncementContent } from './AnnouncementContent';

/** Home-only pinned announcement placed directly below the primary navigation. */
export function PinnedAnnouncementCard() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPinnedAnnouncement()
      .then((result) => {
        if (!cancelled) setAnnouncement(result);
      })
      .catch(() => {
        if (!cancelled) setAnnouncement(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement) return null;

  /**
   * 封装open公告相关逻辑。会更新 React 状态并触发重新渲染。
   */
  const openAnnouncement = () => setIsModalOpen(true);

  return (
    <>
      <div className="pinned-announcement-wrap">
        <Card
          className="pinned-announcement-card"
          style={{ height: 70, border: '1px solid #f0f0f0' }}
          styles={{ body: { height: '100%', padding: 0 } }}
        >
          <div
            className="pinned-announcement-button"
            role="button"
            tabIndex={0}
            onClick={openAnnouncement}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openAnnouncement();
              }
            }}
          >
            <span className="pinned-announcement-icon" aria-hidden="true">
              <PushpinOutlined style={{ fontSize: 20 }} />
            </span>
            <AnnouncementContent content={announcement.title} className="pinned-announcement-title" />
          </div>
        </Card>
      </div>

      <Modal
        title={<AnnouncementContent content={announcement.title} className="announcement-modal-title" />}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={920}
        style={{ maxWidth: 'calc(100vw - 20px)' }}
        styles={{ body: { padding: '24px 32px 36px' } }}
      >
        <div className="pinned-announcement-date">
          更新时间：{new Date(announcement.updatedAt || announcement.createdAt).toLocaleString('zh-CN')}
        </div>
        <AnnouncementContent content={announcement.content} className="announcement-modal-content" />
      </Modal>

      <style>{`
        .pinned-announcement-wrap {
          width: 100%;
          padding: 20px 52px 0;
          box-sizing: border-box;
        }
        .pinned-announcement-card {
          overflow: hidden;
          background: #ffffff;
        }
        .pinned-announcement-button {
          position: relative;
          width: 100%;
          height: 70px;
          padding: 0 20px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #1677ff;
          cursor: pointer;
        }
        .pinned-announcement-button:hover {
          background: #e6f4ff;
        }
        .pinned-announcement-button:focus-visible {
          outline: 2px solid #1677ff;
          outline-offset: -2px;
        }
        .pinned-announcement-title {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          padding: 0 40px;
          overflow: hidden;
          color: rgba(0, 0, 0, 0.88);
          font-size: 20px;
          font-weight: 600;
          line-height: 22px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .pinned-announcement-icon {
          position: absolute;
          left: 20px;
          top: 50%;
          display: grid;
          place-items: center;
          transform: translateY(-50%);
        }
        .pinned-announcement-title > * {
          display: block;
          width: 100%;
          overflow: hidden;
          margin: 0;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pinned-announcement-date {
          margin-bottom: 18px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f0f0f0;
          color: rgba(0, 0, 0, 0.45);
          font-size: 13px;
        }
        @media (max-width: 768px) {
          .pinned-announcement-wrap {
            padding: 16px 16px 0;
          }
          .pinned-announcement-button {
            padding: 0 14px;
          }
          .pinned-announcement-icon {
            left: 14px;
          }
        }
      `}</style>
    </>
  );
}
