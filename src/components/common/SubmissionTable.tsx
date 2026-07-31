/**
 * 提交Table组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Table, Typography } from '@douyinfe/semi-ui';
import { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { SubmissionStatusTag } from './SubmissionStatusTag';
import { UserAvatar } from './UserAvatar';
import { TimeText } from './TimeText';
import type { CSSProperties } from 'react';

/**
 * 提交接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface Submission {
  id: number;
  problemId: number;
  problemTitle: string;
  username: string;
  language: string;
  status: string;
  executionTime?: number;
  memoryUsed?: number;
  codeLength?: number;
  submittedAt: string;
}

/**
 * 提交TableProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface SubmissionTableProps {
  data: Submission[];
  loading?: boolean;
  onRowClick?: (record: Submission) => void;
  showProblem?: boolean;
  showUser?: boolean;
  pagination?: {
    currentPage: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  style?: CSSProperties;
}

/**
 * 提交记录表格组件
 * 用于展示提交列表
 */
export function SubmissionTable({
  data,
  loading = false,
  onRowClick,
  showProblem = true,
  showUser = true,
  pagination,
  style,
}: SubmissionTableProps) {
  const columns: ColumnProps<Submission>[] = [
    {
      title: '提交 ID',
      dataIndex: 'id',
      width: 100,
      render: (id: number) => (
        <Typography.Text
          type="tertiary"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
        >
          #{id}
        </Typography.Text>
      ),
    },
  ];

  if (showProblem) {
    columns.push({
      title: '题目',
      dataIndex: 'problemTitle',
      width: 200,
      ellipsis: { showTitle: true },
      render: (title: string, record: Submission) => (
        <div>
          <Typography.Text
            type="tertiary"
            style={{ fontSize: 12, display: 'block', marginBottom: 2 }}
          >
            #{record.problemId}
          </Typography.Text>
          <Typography.Text ellipsis={{ showTooltip: true }} style={{ fontSize: 14 }}>
            {title}
          </Typography.Text>
        </div>
      ),
    });
  }

  if (showUser) {
    columns.push({
      title: '用户',
      dataIndex: 'username',
      width: 120,
      render: (username: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserAvatar username={username} size="extra-small" showTooltip={false} />
          <Typography.Text ellipsis={{ showTooltip: true }} style={{ fontSize: 14 }}>
            {username}
          </Typography.Text>
        </div>
      ),
    });
  }

  columns.push(
    {
      title: '语言',
      dataIndex: 'language',
      width: 100,
      render: (language: string) => (
        <Typography.Text style={{ fontSize: 14 }}>{language}</Typography.Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: string) => <SubmissionStatusTag status={status} size="small" />,
    },
    {
      title: '时间',
      dataIndex: 'executionTime',
      width: 100,
      render: (time: number | undefined) =>
        time !== undefined ? (
          <Typography.Text style={{ fontSize: 14 }}>{time} ms</Typography.Text>
        ) : (
          <Typography.Text type="tertiary" style={{ fontSize: 14 }}>
            -
          </Typography.Text>
        ),
    },
    {
      title: '内存',
      dataIndex: 'memoryUsed',
      width: 100,
      render: (memory: number | undefined) =>
        memory !== undefined ? (
          <Typography.Text style={{ fontSize: 14 }}>
            {(memory / 1024).toFixed(1)} MB
          </Typography.Text>
        ) : (
          <Typography.Text type="tertiary" style={{ fontSize: 14 }}>
            -
          </Typography.Text>
        ),
    },
    {
      title: '代码长度',
      dataIndex: 'codeLength',
      width: 100,
      render: (length: number | undefined) =>
        length !== undefined ? (
          <Typography.Text style={{ fontSize: 14 }}>{length} B</Typography.Text>
        ) : (
          <Typography.Text type="tertiary" style={{ fontSize: 14 }}>
            -
          </Typography.Text>
        ),
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      width: 150,
      render: (time: string) => <TimeText time={time} format="both" />,
    }
  );

  return (
    <Table
      columns={columns}
      dataSource={data}
      loading={loading}
      rowKey="id"
      pagination={
        pagination
          ? {
              currentPage: pagination.currentPage,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: pagination.onPageChange,
              showSizeChanger: false,
              position: 'bottom',
            }
          : false
      }
      onRow={(record) => ({
        onClick: () => {
          if (onRowClick && record) {
            onRowClick(record);
          }
        },
        style: { cursor: onRowClick ? 'pointer' : 'default' },
      })}
      style={style}
    />
  );
}
