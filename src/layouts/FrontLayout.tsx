/**
 * FrontLayout组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Outlet, useLocation } from 'react-router-dom';
import { Layout, FloatButton } from 'antd';
import { FrontHeader } from './FrontHeader';
import { FrontFooter } from './FrontFooter';
import { PinnedAnnouncementCard } from '../components/PinnedAnnouncementCard';

const { Content } = Layout;

/**
 * 渲染FrontLayout组件，并协调其数据加载、状态和交互。
 */
export function FrontLayout() {
  const location = useLocation();
  const isHome = location.pathname === '/';

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

        @media (max-width: 768px) {
          .front-layout-content {
            padding: 24px 16px;
          }
        }

        /* 返回顶部按钮：固定定位并去除阴影 */
        .front-layout .ant-float-btn {
          right: 40px;
          bottom: 40px;
          box-shadow: none;
        }

        @media (max-width: 768px) {
          .front-layout .ant-float-btn {
            right: 20px;
            bottom: 20px;
          }
        }
      `}</style>

      <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
        {/* 顶部导航 */}
        <FrontHeader />

        {isHome ? <PinnedAnnouncementCard /> : null}

        {/* 主内容区 */}
        <Content className="front-layout-content">
          <Outlet />
        </Content>

        {/* 页脚 */}
        <FrontFooter />

        {/* 返回顶部 */}
        <FloatButton.BackTop type="primary" />
      </Layout>
    </div>
  );
}
