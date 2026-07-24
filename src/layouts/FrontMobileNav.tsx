/**
 * FrontMobileNav组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { SideSheet, Nav, Button, Space, Divider } from '@douyinfe/semi-ui';
import { IconHome, IconList, IconTreeTriangleDown, IconUser, IconClose } from '@douyinfe/semi-icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOjData } from '../data/OjDataProvider';
import { logout as logoutFrontend } from '../api/auth';

/**
 * FrontMobileNavProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface FrontMobileNavProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * 渲染FrontMobileNav组件，并协调其数据加载、状态和交互。
 */
export function FrontMobileNav({ visible, onClose }: FrontMobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useOjData();
  const isLoggedIn = state.activeUser !== null;

  const navItems = [
    { itemKey: 'home', text: '首页', icon: <IconHome />, path: '/' },
    { itemKey: 'problems', text: '题库', icon: <IconList />, path: '/problems' },
    { itemKey: 'practice', text: '题单', icon: <IconList />, path: '/practice' },
    { itemKey: 'contests', text: '比赛', icon: <IconTreeTriangleDown />, path: '/contests' },
    { itemKey: 'submission-queue', text: '提交队列', icon: <IconList />, path: '/submission-queue' },
    { itemKey: 'leaderboard', text: '排行榜', icon: <IconTreeTriangleDown />, path: '/leaderboard' },
  ];

  /**
   * 读取有效Key并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
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

  /**
   * 处理NavClick。可能改变当前路由或查询参数。
   */
  const handleNavClick = (data: any) => {
    const item = navItems.find(item => item.itemKey === data.itemKey);
    if (item) {
      navigate(item.path);
      onClose();
    }
  };

  /**
   * 处理登录。可能改变当前路由或查询参数。
   */
  const handleLogin = () => {
    navigate('/login');
    onClose();
  };

  /**
   * 处理注册。可能改变当前路由或查询参数。
   */
  const handleRegister = () => {
    navigate('/register');
    onClose();
  };

  /**
   * 处理资料。可能改变当前路由或查询参数。
   */
  const handleProfile = () => {
    navigate('/user-center');
    onClose();
  };

  /**
   * 处理退出登录。包含异步流程并由调用方处理完成或失败状态；可能改变当前路由或查询参数。
   */
  const handleLogout = async () => {
    await logoutFrontend().catch(() => undefined);
    navigate('/login', { replace: true });
    onClose();
  };

  return (
    <SideSheet
      title="菜单"
      visible={visible}
      onCancel={onClose}
      placement="left"
      width={280}
      closeIcon={<IconClose />}
      bodyStyle={{ padding: 0 }}
    >
      <style>{`
        .front-mobile-nav-header {
          padding: 24px 20px;
          background: linear-gradient(135deg, var(--semi-color-primary), #60A5FA);
          color: white;
        }

        .front-mobile-nav-user {
          font-weight: 600;
          font-size: 18px;
          margin-bottom: 4px;
        }

        .front-mobile-nav-email {
          font-size: 14px;
          opacity: 0.9;
        }

        .front-mobile-nav-content {
          padding: 12px 0;
        }

        .front-mobile-nav-actions {
          padding: 16px 20px;
        }

        /* 自定义 Nav 样式 */
        .semi-navigation-vertical .semi-navigation-item {
          padding: 12px 20px;
          font-size: 15px;
        }

        .semi-navigation-vertical .semi-navigation-item-selected {
          background: var(--semi-color-primary-light-default);
          color: var(--semi-color-primary);
          border-left: 3px solid var(--semi-color-primary);
        }
      `}</style>

      {/* 用户信息头部 */}
      {isLoggedIn ? (
        <div className="front-mobile-nav-header">
          <div className="front-mobile-nav-user">
            {state.activeUser?.displayName || state.activeUser?.username || '用户'}
          </div>
          <div className="front-mobile-nav-email">
            {state.activeUser?.studentNo || ''}
          </div>
        </div>
      ) : (
        <div className="front-mobile-nav-header">
          <div className="front-mobile-nav-user">
            欢迎使用 QOJ
          </div>
          <div className="front-mobile-nav-email">
            登录以获得完整体验
          </div>
        </div>
      )}

      {/* 导航菜单 */}
      <div className="front-mobile-nav-content">
        <Nav
          mode="vertical"
          selectedKeys={[getActiveKey()]}
          onSelect={handleNavClick}
          items={navItems}
        />
      </div>

      <Divider style={{ margin: 0 }} />

      {/* 底部操作按钮 */}
      <div className="front-mobile-nav-actions">
        {isLoggedIn ? (
          <Space vertical style={{ width: '100%' }}>
            <Button
              block
              icon={<IconUser />}
              onClick={handleProfile}
            >
              个人中心
            </Button>
            <Button
              block
              type="danger"
                onClick={() => { void handleLogout(); }}
            >
              退出登录
            </Button>
          </Space>
        ) : (
          <Space vertical style={{ width: '100%' }}>
            <Button
              block
              onClick={handleLogin}
            >
              登录
            </Button>
            <Button
              block
              type="primary"
              onClick={handleRegister}
            >
              注册
            </Button>
          </Space>
        )}
      </div>
    </SideSheet>
  );
}
