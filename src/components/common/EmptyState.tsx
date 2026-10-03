/**
 * EmptyState组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '../motion/button/base';

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
      <div className="qoj-beui-empty">
        {image || <Inbox size={64} strokeWidth={1.25} aria-hidden="true" />}
        <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
        {description && <div>{description}</div>}
        {action && (
          <Button
            variant={action.type === 'secondary' ? 'secondary' : action.type === 'tertiary' ? 'ghost' : 'primary'}
            onClick={action.onClick}
            style={{ marginTop: 16 }}
          >
            {action.text}
          </Button>
        )}
      </div>
    </div>
  );
}
