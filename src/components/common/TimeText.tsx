import { Typography, Tooltip } from '@douyinfe/semi-ui';
import { IconClock } from '@douyinfe/semi-icons';

interface TimeTextProps {
  time: string | number | Date;
  format?: 'relative' | 'absolute' | 'both';
  showIcon?: boolean;
  style?: React.CSSProperties;
}

/**
 * 时间文本组件
 * 统一的时间格式化展示
 */
export function TimeText({
  time,
  format = 'both',
  showIcon = false,
  style,
}: TimeTextProps) {
  const getDate = (t: string | number | Date): Date => {
    if (t instanceof Date) return t;
    return new Date(t);
  };

  const formatAbsolute = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const formatRelative = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    if (months < 12) return `${months}个月前`;
    return `${years}年前`;
  };

  const date = getDate(time);
  const absoluteTime = formatAbsolute(date);
  const relativeTime = formatRelative(date);

  const displayText =
    format === 'absolute'
      ? absoluteTime
      : format === 'relative'
        ? relativeTime
        : relativeTime;

  const tooltipContent = format === 'both' ? absoluteTime : undefined;

  const content = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}>
      {showIcon && (
        <IconClock style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }} />
      )}
      <Typography.Text type="tertiary" style={{ fontSize: 14 }}>
        {displayText}
      </Typography.Text>
    </span>
  );

  if (tooltipContent) {
    return (
      <Tooltip content={tooltipContent} position="top">
        {content}
      </Tooltip>
    );
  }

  return content;
}
