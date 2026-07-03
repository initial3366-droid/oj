import { Card, Typography, Tag, Space } from '@douyinfe/semi-ui';
import { IconUser, IconCalendar, IconClock } from '@douyinfe/semi-icons';
import { ContestStatusTag } from './ContestStatusTag';
import type { CSSProperties } from 'react';

interface ContestCardProps {
  id: number;
  title: string;
  description?: string;
  status: 'NOT_STARTED' | 'RUNNING' | 'ENDED' | string;
  type?: string;
  startTime: string;
  endTime: string;
  participantCount?: number;
  organizer?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

/**
 * 比赛卡片组件
 * 用于比赛列表展示
 */
export function ContestCard({
  id,
  title,
  description,
  status,
  type,
  startTime,
  endTime,
  participantCount = 0,
  organizer,
  onClick,
  style,
}: ContestCardProps) {
  const formatDateTime = (dateTime: string): string => {
    const date = new Date(dateTime);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  };

  const getDuration = (): string => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0 && minutes > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (hours > 0) {
      return `${hours}小时`;
    } else {
      return `${minutes}分钟`;
    }
  };

  return (
    <div onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <Card
        shadows="hover"
        style={{
          transition: 'all 0.2s',
          ...style,
        }}
        bodyStyle={{ padding: 20 }}
      >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Space spacing={8} align="center" style={{ marginBottom: 8 }}>
              <Typography.Text
                type="tertiary"
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                #{id}
              </Typography.Text>
              <Typography.Title
                heading={5}
                ellipsis={{ showTooltip: true }}
                style={{ margin: 0, fontSize: 16 }}
              >
                {title}
              </Typography.Title>
            </Space>
            {description && (
              <Typography.Paragraph
                ellipsis={{ rows: 2, showTooltip: true }}
                type="tertiary"
                style={{ margin: 0, fontSize: 14 }}
              >
                {description}
              </Typography.Paragraph>
            )}
          </div>
          <ContestStatusTag status={status} size="small" />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {type && (
            <Tag size="small" color="cyan" type="light">
              {type}
            </Tag>
          )}
          {participantCount > 0 && (
            <Tag size="small" color="purple" type="light">
              {participantCount} 人参加
            </Tag>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            paddingTop: 8,
            borderTop: '1px solid var(--semi-color-border)',
          }}
        >
          <Space spacing={12} wrap>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconCalendar style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }} />
              <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
                {formatDateTime(startTime)}
              </Typography.Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconClock style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }} />
              <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
                {getDuration()}
              </Typography.Text>
            </div>
            {organizer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconUser style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }} />
                <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
                  {organizer}
                </Typography.Text>
              </div>
            )}
          </Space>
        </div>
      </div>
      </Card>
    </div>
  );
}
