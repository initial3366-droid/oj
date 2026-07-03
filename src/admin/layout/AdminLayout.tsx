import { Layout, Spin } from '@arco-design/web-react';
import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSider } from './AdminSider';
import { AdminHeader } from './AdminHeader';
import { AdminBreadcrumb } from './AdminBreadcrumb';
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

  useEffect(() => {
    loadUserInfo();
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
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: '#fff',
            color: '#000',
            fontSize: '18px',
            fontWeight: 'bold',
          }}
        >
          {collapsed ? 'QOJ' : 'QOJ Admin'}
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
          <AdminBreadcrumb />
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
