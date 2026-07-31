/**
 * ErrorState组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Empty, Button } from '@douyinfe/semi-ui';
import { IllustrationFailure } from '@douyinfe/semi-illustrations';

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
        image={<IllustrationFailure style={{ width: 150, height: 150 }} />}
        title={title}
        description={message}
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
