import { Layout, Spin } from '@arco-design/web-react';
import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSider } from './AdminSider';
import { AdminHeader } from './AdminHeader';
import { adminGet, clearAdminToken } from '../api/adminClient';
import { adminPath } from '../../utils/adminPath';
import '@arco-design/web-react/dist/css/arco.css';

const Sider = Layout.Sider;
const Header = Layout.Header;
const Content = Layout.Content;

interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  role: 'SUPER_ADMIN' | 'STUDENT' | 'GUEST';
}

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [siteLogo, setSiteLogo] = useState('');
  const [siteTitle, setSiteTitle] = useState('');

  useEffect(() => {
    loadUserInfo();
    fetch('/api/v1/settings/frontend')
      .then((res) => res.json())
      .then((body) => {
        if (body?.code === 200) {
          setSiteTitle(body.data?.siteTitle || '');
          setSiteLogo(body.data?.siteLogo || '');
        }
      })
      .catch(() => {});
  }, []);

  async function loadUserInfo() {
    try {
      const token = localStorage.getItem('qoj.adminAccessToken');
      if (!token) {
        navigate(adminPath('/login'), { replace: true });
        return;
      }

      const user = await adminGet<UserInfo>('/api/admin/v1/me', true);
      setUserInfo(user);

      // 学生和访客不允许访问后台
      if (user.role === 'STUDENT' || user.role === 'GUEST') {
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      clearAdminToken();
      navigate(adminPath('/login'), { replace: true });
    }
  }

  function handleLogout() {
    clearAdminToken();
    navigate(adminPath('/login'), { replace: true });
  }

  if (!userInfo) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#f2f3f5',
        }}
      >
        <Spin size={40} />
      </div>
    );
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        collapsed={collapsed}
        collapsible
        trigger={null}
        breakpoint="lg"
        width={220}
        style={{
          backgroundColor: '#001529',
          overflowY: 'hidden',
        }}
      >
        <div
          style={{
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: collapsed ? '0' : '0 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: '#fff',
            color: '#000',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          {siteLogo ? (
            <>
              <img
                src={siteLogo}
                alt={siteTitle || '后台管理'}
                style={{ height: '36px', maxHeight: '36px', maxWidth: '36px', objectFit: 'contain', borderRadius: '6px' }}
              />
              {!collapsed && <span>{siteTitle || '后台管理'}</span>}
            </>
          ) : (
            <>{collapsed ? 'ADMIN' : '后台管理'}</>
          )}
        </div>
        <div style={{ height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
          <AdminSider userRole={userInfo.role as any} />
        </div>
      </Sider>

      <Layout>
        <Header style={{ padding: 0, height: 'auto' }}>
          <AdminHeader
            username={userInfo.username}
            displayName={userInfo.displayName}
            role={userInfo.role}
            onLogout={handleLogout}
          />
        </Header>

        <Content
          style={{
            padding: '20px',
            overflowY: 'auto',
            backgroundColor: '#f2f3f5',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
