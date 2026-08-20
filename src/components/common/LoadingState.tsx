/**
 * LoadingState组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Spin, Skeleton, Typography } from 'antd';

/**
 * LoadingStateProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
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
        <Skeleton active paragraph={{ rows }} title={{ style: { marginBottom: 12 } }} />
      </div>
    );
  }

  const spinSize = size === 'small' ? 'small' : size === 'large' ? 'large' : 'middle';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        padding: '48px 24px',
        ...style,
      }}
    >
      <Spin size={spinSize} />
      <Typography.Text type="secondary">{tip}</Typography.Text>
    </div>
  );
}
