/**
 * 提交队列页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Alert, Button, Card, Input, Select, Spin, Table, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchSubmissionQueue,
  type SubmissionQueueQuery,
  type SubmissionQueueRecord,
} from '../data/apiClient';
import { PageContainer } from '../components/common';

const { Text } = Typography;

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

/**
 * 封装队列Error消息相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function queueErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '提交队列加载失败';
  return message === '系统错误' ? '提交队列加载失败，请稍后刷新' : message;
}

/**
 * 封装状态Color相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function statusColor(status?: string | null): 'success' | 'error' | 'warning' | 'processing' | 'default' {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'AC' || normalized === 'ACCEPTED') return 'success';
  if (normalized === 'PENDING' || normalized === 'WAITING' || normalized === 'JUDGING' || normalized === 'COMPILING' || normalized === 'RUNNING' || normalized === 'REJUDGE_PENDING') return 'processing';
  if (normalized === 'TLE' || normalized === 'MLE' || normalized.includes('LIMIT')) return 'warning';
  if (normalized === 'SE' || normalized === 'SYSTEM_ERROR' || normalized === 'FAILED') return 'default';
  return 'error';
}

/**
 * 判断有效是否成立。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function isActive(status?: string | null) {
  const normalized = (status || '').toUpperCase();
  return normalized === 'JUDGING' || normalized === 'RUNNING' || normalized === 'COMPILING';
}

/**
 * 格式化提交时间到分钟（MM-DD HH:mm）。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatSubmitTime(dateTime: string): string {
  const date = new Date(dateTime);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

/**
 * 渲染提交队列页面，并协调其数据加载、状态和交互。
 */
export function SubmissionQueuePage() {
  const requestSequence = useRef(0);
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

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const result = await fetchSubmissionQueue(query);
      if (sequence !== requestSequence.current) return;
      setRows(result.list);
      setTotal(result.total);
      setMessage('');
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setMessage(queueErrorMessage(error));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * 封装columns相关逻辑。对原始数据进行派生或聚合。
   */
  const columns = useMemo<TableColumnsType<SubmissionQueueRecord>>(() => [
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
        <Text>
          {record.problemLabel ? `${record.problemLabel}. ` : ''}
          {record.problemTitle || `#${record.problemId}`}
        </Text>
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
          <Tag color={statusColor(record.status)} style={{ marginInlineEnd: 0 }}>{record.statusText || record.status || '-'}</Tag>
        </span>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'submitTime',
      width: 140,
      render: (submitTime: string) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {submitTime ? formatSubmitTime(submitTime) : '-'}
        </Text>
      ),
    },
  ], []);

  return (
    <PageContainer title="提交队列">
      {message && <Alert type="error" message={message} showIcon={false} banner style={{ marginBottom: 16 }} />}

      <Card style={{ border: '1px solid #f0f0f0', marginBottom: 16 }} styles={{ body: { padding: 20 } }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder="题目 ID"
            value={query.problemId ? String(query.problemId) : ''}
            onChange={(event) => {
              const value = event.target.value;
              setQuery((current) => ({ ...current, page: 1, problemId: value ? Number(value) || null : null }));
            }}
            style={{ width: 120 }}
          />
          <Input
            placeholder="用户 ID"
            value={query.userId ? String(query.userId) : ''}
            onChange={(event) => {
              const value = event.target.value;
              setQuery((current) => ({ ...current, page: 1, userId: value ? Number(value) || null : null }));
            }}
            style={{ width: 120 }}
          />
          <Input
            placeholder="语言"
            value={query.language ?? ''}
            onChange={(event) => setQuery((current) => ({ ...current, page: 1, language: event.target.value }))}
            style={{ width: 120 }}
          />
          <Select
            placeholder="状态"
            value={query.status || undefined}
            onChange={(status) => setQuery((current) => ({ ...current, page: 1, status: String(status || '') }))}
            style={{ width: 180 }}
            allowClear
            options={statusOptions.map((status) => ({ value: status, label: status }))}
          />
          <Select
            value={query.sortBy}
            onChange={(sortBy) => setQuery((current) => ({ ...current, sortBy: String(sortBy) }))}
            style={{ width: 150 }}
            options={[
              { value: 'submitTime', label: '提交时间' },
              { value: 'priority', label: '优先级' },
              { value: 'status', label: '状态' },
              { value: 'startJudgeTime', label: '开始时间' },
              { value: 'finishTime', label: '结束时间' },
            ]}
          />
          <Select
            value={query.sortOrder}
            onChange={(sortOrder) => setQuery((current) => ({ ...current, sortOrder: sortOrder as 'asc' | 'desc' }))}
            style={{ width: 110 }}
            options={[
              { value: 'desc', label: '降序' },
              { value: 'asc', label: '升序' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
        </div>
      </Card>

      <Card
        style={{ border: '1px solid #f0f0f0' }}
        styles={{ body: { padding: '0 0 18px' } }}
      >
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="queueId"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            current: query.page ?? 1,
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
