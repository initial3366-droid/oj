import { Card, Typography, Space, Tag } from '@douyinfe/semi-ui';
import { IconUser, IconCalendar } from '@douyinfe/semi-icons';
import { DifficultyTag } from './DifficultyTag';
import type { CSSProperties } from 'react';

interface ProblemCardProps {
  id: number;
  title: string;
  difficulty: string;
  tags?: string[];
  submissionCount?: number;
  acceptedCount?: number;
  acceptRate?: number;
  author?: string;
  createdAt?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

/**
 * 题目卡片组件
 * 用于题目列表展示
 */
export function ProblemCard({
  id,
  title,
  difficulty,
  tags = [],
  submissionCount = 0,
  acceptedCount = 0,
  acceptRate,
  author,
  createdAt,
  onClick,
  style,
}: ProblemCardProps) {
  const rate = acceptRate !== undefined
    ? acceptRate
    : submissionCount > 0
      ? Math.round((acceptedCount / submissionCount) * 100)
      : 0;

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
            <Space spacing={8} align="center">
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
          </div>
          <DifficultyTag difficulty={difficulty} size="sm" />
        </div>

        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tags.slice(0, 5).map((tag, index) => (
              <Tag key={index} size="small" color="grey">
                {tag}
              </Tag>
            ))}
            {tags.length > 5 && (
              <Tag size="small" color="grey">
                +{tags.length - 5}
              </Tag>
            )}
          </div>
        )}

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
          <Space spacing={16}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
                通过率
              </Typography.Text>
              <Typography.Text
                strong
                style={{
                  fontSize: 13,
                  color:
                    rate >= 60
                      ? 'var(--semi-color-success)'
                      : rate >= 30
                        ? 'var(--semi-color-warning)'
                        : 'var(--semi-color-danger)',
                }}
              >
                {rate}%
              </Typography.Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
                提交
              </Typography.Text>
              <Typography.Text style={{ fontSize: 13 }}>
                {submissionCount}
              </Typography.Text>
            </div>
          </Space>

          {(author || createdAt) && (
            <Space spacing={12}>
              {author && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconUser style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }} />
                  <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
                    {author}
                  </Typography.Text>
                </div>
              )}
              {createdAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconCalendar style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }} />
                  <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
                    {new Date(createdAt).toLocaleDateString('zh-CN')}
                  </Typography.Text>
                </div>
              )}
            </Space>
          )}
        </div>
      </div>
      </Card>
    </div>
  );
}
