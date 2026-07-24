/**
 * 权限Guard组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Result, Spin } from '@arco-design/web-react';
import { adminGet } from '../api/adminClient';
import { adminPath } from '../../utils/adminPath';

/**
 * 用户Info接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

/**
 * 权限GuardProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface PermissionGuardProps {
  children: ReactNode;
  requiredRoles?: Array<'SUPER_ADMIN'>;
}

/**
 * 渲染权限Guard组件，并协调其数据加载、状态和交互。
 */
export function PermissionGuard({ children, requiredRoles }: PermissionGuardProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  /**
   * 校验认证。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染；会读写浏览器本地会话信息。
   */
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

  if (error) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={error}
      />
    );
  }

  // 未登录，跳转到后台登录页
  if (!user) {
    return <Navigate to={adminPath('/login')} replace />;
  }

  if (user.role !== 'SUPER_ADMIN') {
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

  return <>{children}</>;
}
