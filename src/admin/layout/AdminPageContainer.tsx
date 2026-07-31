/**
 * 管理员页面Container组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { ReactNode } from 'react';
import { Card } from '@arco-design/web-react';

/**
 * 管理员页面ContainerProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface AdminPageContainerProps {
  children: ReactNode;
  title?: string;
  extra?: ReactNode;
  loading?: boolean;
}

/**
 * 渲染管理员页面Container组件，并协调其数据加载、状态和交互。
 */
export function AdminPageContainer({ children, title, extra, loading }: AdminPageContainerProps) {
  return (
    <Card
      bordered={false}
      loading={loading}
      title={title}
      extra={extra}
      style={{ marginBottom: '16px' }}
    >
      {children}
    </Card>
  );
}
