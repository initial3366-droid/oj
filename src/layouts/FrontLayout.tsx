import { Outlet, useLocation } from 'react-router-dom';
import { Layout, BackTop } from '@douyinfe/semi-ui';
import { IconArrowUp } from '@douyinfe/semi-icons';
import { FrontHeader } from './FrontHeader';
import { FrontFooter } from './FrontFooter';
import { PinnedAnnouncementBanner } from '../components/PinnedAnnouncementBanner';

const { Content } = Layout;

export function FrontLayout() {
  const location = useLocation();
  const showPinnedAnnouncement = location.pathname === '/';

  return (
    <div className="front-layout">
      <style>{`
        .front-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(
            180deg,
            rgba(28, 100, 242, 0.03),
            rgba(248, 250, 252, 0) 280px
          ), #FAFAFA;
        }

        .front-layout-content {
          flex: 1;
          width: 100%;
          margin: 0 auto;
          padding: 32px 52px;
        }

        .front-pinned-announcement {
          width: 100%;
          margin: 0 auto;
          padding: 20px 52px 0;
        }

        .front-pinned-announcement-card {
          height: 60px;
          overflow: hidden;
          border: 1px solid rgba(245, 158, 11, 0.35);
          background: linear-gradient(135deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 0.98));
          box-shadow: none;
        }

        .front-pinned-announcement-card .semi-card-body {
          height: 60px;
        }

        .front-pinned-announcement-card:hover {
          border-color: rgba(245, 158, 11, 0.35);
          box-shadow: none;
          transform: none;
        }

        .front-pinned-announcement-title-button {
          width: 100%;
          height: 60px;
          display: flex;
          align-items: center;
          min-width: 0;
          gap: 10px;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          text-align: left;
        }

        .front-pinned-announcement-title-button:hover,
        .front-pinned-announcement-title-button:active {
          background: transparent;
          color: inherit;
          box-shadow: none;
          transform: none;
        }

        .front-pinned-announcement-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.14);
          color: #d97706;
        }

        .front-pinned-announcement-title-text {
          display: block;
          flex: 1;
          min-width: 0;
          height: 60px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--semi-color-text-1);
          font-size: 20px;
          font-weight: 600;
          line-height: 60px;
        }

        .front-pinned-announcement-title-button:hover .front-pinned-announcement-title-text,
        .front-pinned-announcement-title-button:active .front-pinned-announcement-title-text {
          color: var(--semi-color-text-1);
          text-decoration: none;
        }

        .front-pinned-announcement-modal-title {
          max-width: 760px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1.4;
        }

        .qoj-announcement-title-html * {
          display: inline !important;
          margin: 0 !important;
          padding: 0 !important;
          font-size: inherit !important;
          line-height: inherit !important;
          max-height: 100% !important;
        }

        .qoj-announcement-title-html [align="center"] {
          display: block !important;
          width: 100% !important;
          text-align: center !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .qoj-announcement-title-html [align="right"] {
          display: block !important;
          width: 100% !important;
          text-align: right !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .qoj-announcement-title-html red,
        .qoj-announcement-html red {
          color: #e11d48 !important;
        }

        .qoj-announcement-html {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .qoj-announcement-html :is(p, ul, ol, blockquote, pre, table) {
          margin-top: 0;
          margin-bottom: 12px;
        }

        .qoj-announcement-html :is(h1, h2, h3, h4, h5, h6) {
          margin: 16px 0 10px;
          line-height: 1.35;
        }

        .qoj-announcement-html a {
          color: var(--semi-color-primary);
          text-decoration: none;
        }

        .qoj-announcement-html a:hover {
          text-decoration: underline;
        }

        .qoj-announcement-html img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }

        .qoj-announcement-html table {
          width: 100%;
          border-collapse: collapse;
        }

        .qoj-announcement-html th,
        .qoj-announcement-html td {
          border: 1px solid var(--semi-color-border);
          padding: 8px 10px;
        }

        @media (max-width: 768px) {
          .front-layout-content {
            padding: 24px 16px;
          }

          .front-pinned-announcement {
            padding: 16px 16px 0;
          }
        }

        /* BackTop 样式 */
        .semi-backtop {
          right: 40px;
          bottom: 40px;
        }

        @media (max-width: 768px) {
          .semi-backtop {
            right: 20px;
            bottom: 20px;
          }
        }
      `}</style>

      <Layout>
        {/* 顶部导航 */}
        <FrontHeader />

        {showPinnedAnnouncement && <PinnedAnnouncementBanner />}

        {/* 主内容区 */}
        <Content className="front-layout-content">
          <Outlet />
        </Content>

        {/* 页脚 */}
        <FrontFooter />

        {/* 返回顶部 */}
        <BackTop>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--semi-color-primary)',
              color: 'white',
              boxShadow: '0 4px 12px rgba(28, 100, 242, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            <IconArrowUp size="large" />
          </div>
        </BackTop>
      </Layout>
    </div>
  );
}
