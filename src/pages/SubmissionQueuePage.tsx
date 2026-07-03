import { Banner, Button, Card, Input, Select, Spin, Table, Tag, Typography } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchSubmissionQueue,
  type SubmissionQueueQuery,
  type SubmissionQueueRecord,
} from '../data/apiClient';
import { PageContainer } from '../components/common';

const statusOptions = [
  'Waiting',
  'Pending',
  'Judging',
  'Compiling',
  'Running',
  'Accepted',
  'Wrong Answer',
  'Time Limit Exceeded',
  'Memory Limit Exceeded',
  'Runtime Error',
  'Compile Error',
  'System Error',
  'Rejudge Pending',
  'Failed',
];

function queueErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '提交队列加载失败';
  return message === '系统错误' ? '提交队列加载失败，请稍后刷新' : message;
}

function statusColor(status?: string | null): 'green' | 'red' | 'orange' | 'blue' | 'grey' {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'AC' || normalized === 'ACCEPTED') return 'green';
  if (normalized === 'PENDING' || normalized === 'WAITING' || normalized === 'JUDGING' || normalized === 'COMPILING' || normalized === 'RUNNING' || normalized === 'REJUDGE_PENDING') return 'blue';
  if (normalized === 'TLE' || normalized === 'MLE' || normalized.includes('LIMIT')) return 'orange';
  if (normalized === 'SE' || normalized === 'SYSTEM_ERROR' || normalized === 'FAILED') return 'grey';
  return 'red';
}

function isActive(status?: string | null) {
  const normalized = (status || '').toUpperCase();
  return normalized === 'JUDGING' || normalized === 'RUNNING' || normalized === 'COMPILING';
}

export function SubmissionQueuePage() {
  const [rows, setRows] = useState<SubmissionQueueRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState<SubmissionQueueQuery>({
    page: 1,
    pageSize: 20,
    sortBy: 'submitTime',
    sortOrder: 'desc',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchSubmissionQueue(query);
      setRows(result.list);
      setTotal(result.total);
      setMessage('');
    } catch (error) {
      setMessage(queueErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo<ColumnProps<SubmissionQueueRecord>[]>(() => [
    { title: '提交 ID', dataIndex: 'submissionId', width: 130, fixed: 'left' },
    {
      title: '提交者',
      dataIndex: 'displayName',
      width: 180,
      render: (_text, record) => record.displayName || record.username || record.userId,
    },
    {
      title: '题目',
      dataIndex: 'problemTitle',
      width: 260,
      render: (_text, record) => (
        <Typography.Text>
          {record.problemLabel ? `${record.problemLabel}. ` : ''}
          {record.problemTitle || `#${record.problemId}`}
        </Typography.Text>
      ),
    },
    { title: '语言', dataIndex: 'language', width: 120 },
    {
      title: '状态',
      dataIndex: 'statusText',
      width: 170,
      render: (_text, record) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {isActive(record.status) && <Spin size="small" />}
          <Tag color={statusColor(record.status)}>{record.statusText || record.status || '-'}</Tag>
        </span>
      ),
    },
  ], []);

  return (
    <PageContainer title="提交队列" subtitle="Submission Queue">
      {message && <Banner type="danger" description={message} closeIcon={null} style={{ marginBottom: 16 }} />}

      <Card style={{ border: '1px solid var(--semi-color-border)', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder="题目 ID"
            value={query.problemId ? String(query.problemId) : ''}
            onChange={(value) => setQuery((current) => ({ ...current, page: 1, problemId: Number(value) || null }))}
            style={{ width: 120 }}
          />
          <Input
            placeholder="用户 ID"
            value={query.userId ? String(query.userId) : ''}
            onChange={(value) => setQuery((current) => ({ ...current, page: 1, userId: Number(value) || null }))}
            style={{ width: 120 }}
          />
          <Input
            placeholder="语言"
            value={query.language ?? ''}
            onChange={(language) => setQuery((current) => ({ ...current, page: 1, language }))}
            style={{ width: 120 }}
          />
          <Select
            placeholder="状态"
            value={query.status}
            onChange={(status) => setQuery((current) => ({ ...current, page: 1, status: String(status || '') }))}
            style={{ width: 180 }}
            showClear
          >
            {statusOptions.map((status) => (
              <Select.Option key={status} value={status}>{status}</Select.Option>
            ))}
          </Select>
          <Select
            value={query.sortBy}
            onChange={(sortBy) => setQuery((current) => ({ ...current, sortBy: String(sortBy) }))}
            style={{ width: 150 }}
          >
            <Select.Option value="submitTime">提交时间</Select.Option>
            <Select.Option value="priority">优先级</Select.Option>
            <Select.Option value="status">状态</Select.Option>
            <Select.Option value="startJudgeTime">开始时间</Select.Option>
            <Select.Option value="finishTime">结束时间</Select.Option>
          </Select>
          <Select
            value={query.sortOrder}
            onChange={(sortOrder) => setQuery((current) => ({ ...current, sortOrder: sortOrder as 'asc' | 'desc' }))}
            style={{ width: 110 }}
          >
            <Select.Option value="desc">降序</Select.Option>
            <Select.Option value="asc">升序</Select.Option>
          </Select>
          <Button icon={<IconRefresh />} onClick={load} loading={loading}>
            刷新
          </Button>
        </div>
      </Card>

      <Card
        style={{ border: '1px solid var(--semi-color-border)' }}
        bodyStyle={{ padding: '0 clamp(12px, 2vw, 24px) 18px' }}
      >
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="queueId"
          loading={loading}
          scroll={{ x: 860 }}
          pagination={{
            currentPage: query.page ?? 1,
            pageSize: query.pageSize ?? 20,
            total,
            showSizeChanger: true,
            onChange: (page, pageSize) => setQuery((current) => ({ ...current, page, pageSize })),
          }}
        />
      </Card>
    </PageContainer>
  );
}
