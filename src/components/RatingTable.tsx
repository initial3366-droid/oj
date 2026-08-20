/**
 * RatingTable组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useOjData } from '../data/OjDataProvider';
import type { RatingUser } from '../data/types';
import { UserAvatar } from './common/UserAvatar';

const { Text } = Typography;

/**
 * 渲染RatingTable组件，并协调其数据加载、状态和交互。
 */
export function RatingTable() {
  const { state } = useOjData();
  const ratings = [...state.ratings]
    .sort((a, b) => b.acCount - a.acCount)
    .slice(0, 10);

  const columns: TableColumnsType<RatingUser> = [
    {
      title: '排名',
      dataIndex: 'rank',
      width: 100,
      render: (_text, _record, index) => (
        <Tag color={index < 3 ? 'gold' : 'default'} style={{ marginInlineEnd: 0 }}>
          {index + 1}
        </Tag>
      ),
    },
    {
      title: '用户',
      dataIndex: 'name',
      width: 200,
      render: (name: string, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <UserAvatar
            username={name || `#${record.userId}`}
            avatarUrl={record.avatarUrl || undefined}
            size="small"
            showTooltip={false}
          />
          <Text strong>{name}</Text>
        </div>
      ),
    },
    {
      title: '班级',
      dataIndex: 'className',
      width: 150,
      render: (className?: string) => (
        <Text type={className ? undefined : 'secondary'}>
          {className || '-'}
        </Text>
      ),
    },
    {
      title: 'AC 数',
      dataIndex: 'acCount',
      width: 120,
      render: (acCount: number) => (
        <Text strong style={{ color: '#1677ff', fontSize: 15 }}>
          {acCount}
        </Text>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={ratings}
      rowKey="id"
      pagination={false}
      style={{
        border: '1px solid #f0f0f0',
      }}
      locale={{
        emptyText: (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <Text type="secondary">暂无真实排行榜数据</Text>
          </div>
        ),
      }}
    />
  );
}
