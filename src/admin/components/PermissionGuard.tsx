import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Result, Spin } from '@arco-design/web-react';
import { adminGet } from '../api/adminClient';
import { adminPath } from '../../utils/adminPath';

interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  role: 'SUPER_ADMIN' | 'STUDENT' | 'GUEST';
}

interface PermissionGuardProps {
  children: ReactNode;
  requiredRoles?: Array<'SUPER_ADMIN'>;
}

export function PermissionGuard({ children, requiredRoles }: PermissionGuardProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = localStorage.getItem('qoj.adminAccessToken');
      if (!token) {
        setLoading(false);
        return;
      }

      // 调用后端验证 token
      const userData = await adminGet<UserInfo>('/api/admin/v1/me', true);
      setUser(userData);
    } catch (err) {
      console.error('权限验证失败:', err);
      setError(err instanceof Error ? err.message : '权限验证失败');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size={40} />
      </div>
    );
  }

  // 未登录，跳转到后台登录页
  if (!user) {
    return <Navigate to={adminPath('/login')} replace />;
  }

  // 学生角色不允许进入后台
  if (user.role === 'STUDENT' || user.role === 'GUEST') {
    return (
      <Result
        status="403"
        title="无权限访问"
        subTitle="抱歉，您的账户权限不足，无法访问后台管理系统"
        extra={
          <a href="/" style={{ color: '#165dff', textDecoration: 'none' }}>
            返回首页
          </a>
        }
      />
    );
  }

  // 检查角色权限
  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(user.role as any)) {
      return (
        <Result
          status="403"
          title="权限不足"
          subTitle="您没有权限访问此页面"
          extra={
            <a href={adminPath('')} style={{ color: '#165dff', textDecoration: 'none' }}>
              返回后台首页
            </a>
          }
        />
      );
    }
  }

  if (error) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={error}
      />
    );
  }

  return <>{children}</>;
}
