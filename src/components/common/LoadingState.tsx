import { Spin, Skeleton } from '@douyinfe/semi-ui';

interface LoadingStateProps {
  type?: 'spin' | 'skeleton';
  tip?: string;
  size?: 'small' | 'default' | 'large';
  style?: React.CSSProperties;
  rows?: number;
}

/**
 * 加载状态组件
 * 统一的加载中展示
 */
export function LoadingState({
  type = 'spin',
  tip = '加载中...',
  size = 'default',
  style,
  rows = 3,
}: LoadingStateProps) {
  if (type === 'skeleton') {
    return (
      <div style={{ padding: '24px', ...style }}>
        <Skeleton.Title style={{ marginBottom: 12 }} />
        <Skeleton.Paragraph rows={rows} />
      </div>
    );
  }

  const spinSize = size === 'small' ? 'small' : size === 'large' ? 'large' : 'middle';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px 24px',
        ...style,
      }}
    >
      <Spin size={spinSize} tip={tip} />
    </div>
  );
}
