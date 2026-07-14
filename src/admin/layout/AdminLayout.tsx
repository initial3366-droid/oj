/**
 * 管理员Layout组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Button, Layout, Result, Spin } from '@arco-design/web-react';
import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSider } from './AdminSider';
import { AdminHeader } from './AdminHeader';
import { adminGet, adminLogout, clearAdminToken } from '../api/adminClient';
import { adminPath } from '../../utils/adminPath';

const Sider = Layout.Sider;
const Header = Layout.Header;
const Content = Layout.Content;

/**
 * 用户Info接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  role: 'SUPER_ADMIN' | 'STUDENT' | 'GUEST';
}

/**
 * 管理员LayoutProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * 渲染管理员Layout组件，并协调其数据加载、状态和交互。
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loadError, setLoadError] = useState('');
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

  /**
   * 读取用户Info并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数；会读写浏览器本地会话信息。
   */
  async function loadUserInfo() {
    try {
      setLoadError('');
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
      if (!localStorage.getItem('qoj.adminAccessToken')) {
        clearAdminToken();
        navigate(adminPath('/login'), { replace: true });
      } else {
        setLoadError(error instanceof Error ? error.message : '后台信息加载失败');
      }
    }
  }

  /**
   * 处理退出登录。包含异步流程并由调用方处理完成或失败状态；可能改变当前路由或查询参数。
   */
  async function handleLogout() {
    await adminLogout().catch(() => null);
    navigate(adminPath('/login'), { replace: true });
  }

  if (loadError) {
    return (
      <Result
        status="error"
        title="后台信息加载失败"
        subTitle={loadError}
        extra={<Button type="primary" onClick={() => { void loadUserInfo(); }}>重试</Button>}
      />
    );
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
            onLogout={() => { void handleLogout(); }}
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
