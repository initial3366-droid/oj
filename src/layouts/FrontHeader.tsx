import { Avatar, Button, ConfigProvider, Dropdown, Flex, Grid, Layout, Menu, Space, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import { LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useOjData } from '../data/OjDataProvider';

const { Header } = Layout;
const { Text } = Typography;

export function FrontHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useOjData();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isLoggedIn = state.activeUser !== null;
  const isCompact = !screens.lg;
  const headerHeight = 64;

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
    { key: 'home', label: '首页', path: '/' },
    { key: 'problems', label: '题库', path: '/problems' },
    { key: 'practice', label: '题单', path: '/practice' },
    { key: 'contests', label: '比赛', path: '/contests' },
    { key: 'submission-queue', label: '提交队列', path: '/submission-queue' },
    { key: 'leaderboard', label: '排行榜', path: '/leaderboard' },
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

  const handleNavClick: MenuProps['onClick'] = ({ key }) => {
    const item = navItems.find(item => item.key === key);
    if (item) {
      navigate(item.path);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'center',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'center') {
      navigate('/user-center');
      return;
    }
    if (key === 'settings') {
      navigate('/user-center?tab=settings');
      return;
    }
    if (key === 'logout') {
      handleLogout();
    }
  };

  const isLoginPage = location.pathname === '/login';
  const isRegisterPage = location.pathname === '/register';

  return (
    <Header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: headerHeight,
        lineHeight: 'normal',
        paddingInline: isCompact ? 16 : 52,
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Flex align="center" gap={24} style={{ height: '100%', minWidth: 0 }}>
        <Button
          type="text"
          size="large"
          onClick={() => navigate('/')}
          style={{ height: 48, paddingInline: 8, flex: '0 0 auto' }}
        >
          <Space size={12}>
            <Avatar
              shape="square"
              size={36}
              src={siteLogo || undefined}
              style={{ background: token.colorPrimary, fontWeight: 700 }}
            >
              OJ
            </Avatar>
            {!isCompact ? (
              <Text strong style={{ color: token.colorPrimary, fontSize: 20 }}>
                {siteTitle}
              </Text>
            ) : null}
          </Space>
        </Button>

        <ConfigProvider
          theme={{
            components: {
              Menu: {
                activeBarHeight: 3,
                activeBarBorderWidth: 0,
                horizontalItemHoverBg: 'transparent',
                horizontalItemSelectedBg: 'transparent',
                itemPaddingInline: 24,
              },
            },
          }}
        >
          <Menu
            mode="horizontal"
            selectedKeys={[getActiveKey()]}
            onClick={handleNavClick}
            items={navItems.map(({ key, label }) => ({ key, label }))}
            style={{
              flex: 1,
              minWidth: 0,
              height: headerHeight,
              lineHeight: `${headerHeight}px`,
              justifyContent: 'center',
              borderBottom: 'none',
              fontSize: 16,
              fontWeight: 500,
            }}
          />
        </ConfigProvider>

        <Flex justify="flex-end" style={{ flex: '0 0 auto' }}>
          {isLoggedIn ? (
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
            >
              <Button type="text" size="large">
                <Space>
                  <Avatar size="small" style={{ background: token.colorPrimary }}>
                    {(state.activeUser?.displayName || state.activeUser?.username || 'U').slice(0, 2).toUpperCase()}
                  </Avatar>
                  {!isCompact ? (
                    <Text strong>
                      {state.activeUser?.displayName || state.activeUser?.username || '用户'}
                    </Text>
                  ) : null}
                </Space>
              </Button>
            </Dropdown>
          ) : (
            <Space size={4}>
              <Button
                type="text"
                size="large"
                onClick={() => navigate('/login')}
                style={{
                  color: isLoginPage ? token.colorPrimary : undefined,
                  fontWeight: isLoginPage ? 600 : 400,
                  textDecoration: 'none',
                }}
              >
                登录
              </Button>
              <Button
                type="text"
                size="large"
                onClick={() => navigate('/register')}
                style={{
                  color: isRegisterPage ? token.colorPrimary : undefined,
                  fontWeight: isRegisterPage ? 600 : 400,
                  textDecoration: 'none',
                }}
              >
                注册
              </Button>
            </Space>
          )}
        </Flex>
      </Flex>
    </Header>
  );
}
