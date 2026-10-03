/**
 * FrontLayout组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '../components/motion/button/base';
import { FrontHeader } from './FrontHeader';
import { FrontFooter } from './FrontFooter';
import { PinnedAnnouncementCard } from '../components/PinnedAnnouncementCard';

/**
 * 渲染FrontLayout组件，并协调其数据加载、状态和交互。
 */
export function FrontLayout() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [showBackTop, setShowBackTop] = useState(false);

  useEffect(() => {
    const update = () => setShowBackTop(window.scrollY > 280);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

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

        .front-back-top {
          position: fixed;
          right: 40px;
          bottom: 40px;
          z-index: 40;
          box-shadow: 0 8px 30px rgba(0, 102, 250, .18);
        }

        @media (max-width: 768px) {
          .front-back-top {
            right: 20px;
            bottom: 20px;
          }
        }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
        {/* 顶部导航 */}
        <FrontHeader />

        {isHome ? <PinnedAnnouncementCard /> : null}

        {/* 主内容区 */}
        <main className="front-layout-content">
          <Outlet />
        </main>

        {/* 页脚 */}
        <FrontFooter />

        {/* 返回顶部 */}
        {showBackTop && <Button className="front-back-top" size="icon" aria-label="返回顶部" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp size={18} /></Button>}
      </div>
    </div>
  );
}
