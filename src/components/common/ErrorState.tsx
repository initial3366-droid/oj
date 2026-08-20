/**
 * ErrorState组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Empty, Button } from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';

/**
 * ErrorStateProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryText?: string;
  style?: React.CSSProperties;
}

/**
 * 错误状态组件
 * 统一的错误展示和重试
 */
export function ErrorState({
  title = '加载失败',
  message = '抱歉，数据加载失败，请稍后重试',
  onRetry,
  retryText = '重试',
  style,
}: ErrorStateProps) {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        ...style,
      }}
    >
      <Empty
        image={<CloseCircleOutlined style={{ fontSize: 150, color: '#f5222d' }} />}
        description={
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
            {message && <div style={{ marginTop: 8 }}>{message}</div>}
          </div>
        }
      >
        {onRetry && (
          <Button
            type="primary"
            onClick={onRetry}
            style={{ marginTop: 16 }}
          >
            {retryText}
          </Button>
        )}
      </Empty>
    </div>
  );
}
