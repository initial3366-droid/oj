import { ReactNode } from 'react';
import { Card } from '@arco-design/web-react';

interface AdminPageContainerProps {
  children: ReactNode;
  title?: string;
  extra?: ReactNode;
  loading?: boolean;
}

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
