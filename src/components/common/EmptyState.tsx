/**
 * EmptyState组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { ReactNode } from 'react';
import { Empty, Button } from '@douyinfe/semi-ui';
import { IllustrationNoContent } from '@douyinfe/semi-illustrations';

/**
 * EmptyStateProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface EmptyStateProps {
  title?: string;
  description?: string;
  image?: ReactNode;
  action?: {
    text: string;
    onClick: () => void;
    type?: 'primary' | 'secondary' | 'tertiary';
  };
  style?: React.CSSProperties;
}

/**
 * 空状态组件
 * 统一的空数据展示
 */
export function EmptyState({
  title = '暂无数据',
  description,
  image,
  action,
  style,
}: EmptyStateProps) {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        ...style,
      }}
    >
      <Empty
        image={image || <IllustrationNoContent style={{ width: 150, height: 150 }} />}
        title={title}
        description={description}
      >
        {action && (
          <Button
            type={action.type || 'primary'}
            onClick={action.onClick}
            style={{ marginTop: 16 }}
          >
            {action.text}
          </Button>
        )}
      </Empty>
    </div>
  );
}
