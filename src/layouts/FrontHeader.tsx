import { Nav, Avatar, Dropdown, Button, Space } from '@douyinfe/semi-ui';
import { IconUser, IconSetting, IconExit } from '@douyinfe/semi-icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useOjData } from '../data/OjDataProvider';

export function FrontHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useOjData();
  const isLoggedIn = state.activeUser !== null;

  const [siteTitle, setSiteTitle] = useState('QOJ 在线评测系统');
  const [siteLogo, setSiteLogo] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/settings/frontend')
      .then((res) => res.json())
      .then((body) => {
        if (cancelled || body?.code !== 200) return;
        setSiteTitle(body.data?.siteTitle || 'QOJ 在线评测系统');
        setSiteLogo(body.data?.siteLogo || '');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const logout = () => {
    window.localStorage.removeItem('qoj.accessToken');
    window.localStorage.removeItem('qoj.refreshToken');
    window.dispatchEvent(new Event('qoj:auth-cleared'));
    window.location.href = '/login';
  };

  const navItems = [
    { itemKey: 'home', text: '首页', path: '/' },
    { itemKey: 'problems', text: '题库', path: '/problems' },
    { itemKey: 'practice', text: '题单', path: '/practice' },
    { itemKey: 'contests', text: '比赛', path: '/contests' },
    { itemKey: 'submission-queue', text: '提交队列', path: '/submission-queue' },
    { itemKey: 'leaderboard', text: '排行榜', path: '/leaderboard' },
  ];

  const getActiveKey = () => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/problems')) return 'problems';
    if (path.startsWith('/practice')) return 'practice';
    if (path.startsWith('/contests')) return 'contests';
    if (path.startsWith('/submission-queue')) return 'submission-queue';
    if (path.startsWith('/leaderboard')) return 'leaderboard';
    return '';
  };

  const handleNavClick = (data: any) => {
    const item = navItems.find(item => item.itemKey === data.itemKey);
    if (item) {
      navigate(item.path);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenu = (
    <Dropdown.Menu>
      <Dropdown.Item
        icon={<IconUser />}
        onClick={() => navigate('/user-center')}
      >
        个人中心
      </Dropdown.Item>
      <Dropdown.Item
        icon={<IconSetting />}
        onClick={() => navigate('/user-center?tab=settings')}
      >
        设置
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item
        icon={<IconExit />}
        type="danger"
        onClick={handleLogout}
      >
        退出登录
      </Dropdown.Item>
    </Dropdown.Menu>
  );

  return (
    <div className="front-header">
      <style>{`
        .front-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .front-header-content {
          max-width: 100%;
          margin: 0 auto;
          padding: 0 52px;
          height: 64px;
          position: relative;
        }

        .front-header-logo {
          position: absolute;
          left: 52px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          font-weight: 600;
          font-size: 20px;
          color: var(--semi-color-primary);
          text-decoration: none;
          flex-shrink: 0;
        }

        .front-header-logo-icon {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #1C64F2, #3B82F6);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 18px;
          box-shadow: 0 2px 8px rgba(28, 100, 242, 0.25);
        }

        .front-header-logo-img {
          width: 36px;
          height: 36px;
          object-fit: contain;
          border-radius: 6px;
        }

        .front-header-nav {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .front-header-actions {
          position: absolute;
          right: 52px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .front-header-mobile-menu {
          display: none;
        }

        @media (max-width: 768px) {
          .front-header-content {
            padding: 0 16px;
          }

          .front-header-actions {
            flex-direction: column;
            gap: 8px;
          }
        }

        /* 自定义 Nav 样式 */
        .semi-navigation-horizontal {
          border: none;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .semi-navigation-horizontal .semi-navigation-list {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .semi-navigation-horizontal .semi-navigation-item {
          font-weight: 500;
          font-size: 15px;
          padding: 0 20px;
          height: 40px;
          line-height: 40px;
          border-radius: 10px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: var(--semi-color-text-1);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          cursor: pointer;
          background: transparent;
        }

        .semi-navigation-horizontal .semi-navigation-item:hover {
          background: var(--semi-color-primary-light-default);
          color: var(--semi-color-primary);
          box-shadow: 0 2px 8px rgba(28, 100, 242, 0.15);
          transform: translateY(-2px);
        }

        .semi-navigation-horizontal .semi-navigation-item .semi-navigation-item-text {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          position: relative;
          z-index: 1;
        }

        .semi-navigation-horizontal .semi-navigation-item-selected {
          background: var(--semi-color-primary-light-default) !important;
          color: var(--semi-color-primary) !important;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(28, 100, 242, 0.15);
        }

        .semi-navigation-horizontal .semi-navigation-item-selected::before {
          display: none;
        }

        .semi-navigation-horizontal .semi-navigation-item-selected:hover {
          background: var(--semi-color-primary-light-default) !important;
          color: var(--semi-color-primary) !important;
          box-shadow: 0 2px 8px rgba(28, 100, 242, 0.15);
          transform: translateY(-2px);
        }
      `}</style>

      <div className="front-header-content">
        {/* Logo */}
        <a
          className="front-header-logo"
          onClick={() => navigate('/')}
        >
          {siteLogo ? (
            <img
              className="front-header-logo-img"
              src={siteLogo}
              alt={siteTitle}
            />
          ) : (
            <div className="front-header-logo-icon">OJ</div>
          )}
          <span>{siteTitle}</span>
        </a>

        {/* 桌面端导航 */}
        <div className="front-header-nav">
          <Nav
            mode="horizontal"
            selectedKeys={[getActiveKey()]}
            onSelect={handleNavClick}
            items={navItems}
          />
        </div>

        {/* 右侧操作区 */}
        <div className="front-header-actions">
          {isLoggedIn ? (
            <Dropdown
              render={userMenu}
              position="bottomRight"
            >
              <div style={{ cursor: 'pointer' }}>
                <Space>
                  <Avatar
                    size="small"
                    color="light-blue"
                    style={{ margin: 4 }}
                  >
                    {(state.activeUser?.displayName || state.activeUser?.username || 'U').slice(0, 2).toUpperCase()}
                  </Avatar>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>
                    {state.activeUser?.displayName || state.activeUser?.username || '用户'}
                  </span>
                </Space>
              </div>
            </Dropdown>
          ) : (
            <Space>
              <Button
                type="primary"
                className="nav-btn"
                onClick={() => navigate('/login')}
              >
                登录
              </Button>
              <Button
                type="primary"
                className="nav-btn"
                onClick={() => navigate('/register')}
              >
                注册
              </Button>
            </Space>
          )}
        </div>
      </div>
    </div>
  );
}
