import {
  Button,
  Card,
  Grid,
  Input,
  InputNumber,
  Message,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconDelete, IconRefresh } from '@arco-design/web-react/icon';
import { Statistic, Progress } from '@arco-design/web-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { adminDelete, adminGet, adminPost } from '../../api/adminClient';

const { Row, Col } = Grid;
const Option = Select.Option;
const QUEUE_TABLE_SCROLL_X = 2800;
const QUEUE_TABLE_FIXED_OPERATION_WIDTH = 320;
const QUEUE_TABLE_SCROLL_BODY_WIDTH = QUEUE_TABLE_SCROLL_X - QUEUE_TABLE_FIXED_OPERATION_WIDTH;

interface PageResult<T> {
  total: number;
  list: T[];
}

interface QueueRecord {
  queueId: number;
  submissionId: number;
  contestId?: number | null;
  contestTitle?: string | null;
  problemId: number;
  contestProblemId?: number | null;
  problemLabel?: string | null;
  problemTitle: string;
  userId: number;
  username?: string | null;
  displayName: string;
  language: string;
  status: string;
  statusText: string;
  judgeServer?: string | null;
  priority: number;
  submitTime: string;
  startJudgeTime?: string | null;
  finishTime?: string | null;
  waitingTimeMillis: number;
  runningTimeMillis: number;
  retryCount: number;
  errorMessage?: string | null;
}

interface QueueStats {
  waiting: number;
  judging: number;
  finished: number;
  currentConcurrent: number;
  maxConcurrent: number;
  total: number;
}

interface QueueLog {
  queueId: number;
  submissionId: number;
  status: string;
  judgeServer?: string | null;
  judgeMessage?: string | null;
  errorMessage?: string | null;
  submitTime: string;
  startJudgeTime?: string | null;
  finishTime?: string | null;
}

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

function scopedContestIdFromLocation(routeContestId?: string, queryContestId?: string | null) {
  if (routeContestId) return routeContestId;
  if (queryContestId) return queryContestId;
  const match = window.location.pathname.match(/\/admin\/contests\/(\d+)\/judge\/queue(?:\/|$)/);
  return match?.[1] ?? '';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function formatDuration(ms?: number | null) {
  const seconds = Math.floor(Math.max(0, ms ?? 0) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function statusColor(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'AC' || normalized === 'ACCEPTED') return 'green';
  if (normalized === 'PENDING' || normalized === 'WAITING' || normalized === 'JUDGING' || normalized === 'COMPILING' || normalized === 'RUNNING' || normalized === 'REJUDGE_PENDING') return 'blue';
  if (normalized === 'TLE' || normalized === 'MLE' || normalized.includes('LIMIT')) return 'orange';
  if (normalized === 'SE' || normalized === 'SYSTEM_ERROR' || normalized === 'FAILED') return 'gray';
  return 'red';
}

function isActive(status: string) {
  const normalized = status.toUpperCase();
  return normalized === 'JUDGING' || normalized === 'RUNNING' || normalized === 'COMPILING';
}

export function AdminSubmissionQueuePage() {
  const [searchParams] = useSearchParams();
  const routeParams = useParams();
  const scopedContestId = scopedContestIdFromLocation(routeParams.contestId, searchParams.get('contestId'));
  const initialContestId = Number(scopedContestId || 0) || undefined;
  const [rows, setRows] = useState<QueueRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({
    contestId: initialContestId ? String(initialContestId) : '',
    problemId: '',
    userId: '',
    language: '',
    status: '',
    sortBy: 'submitTime',
    sortOrder: 'desc',
  });
  const [log, setLog] = useState<QueueLog | null>(null);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [priorityRecord, setPriorityRecord] = useState<QueueRecord | null>(null);
  const [priorityValue, setPriorityValue] = useState(0);
  const tableShellRef = useRef<HTMLDivElement | null>(null);
  const manualScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFilters((current) => (
      current.contestId === scopedContestId ? current : { ...current, contestId: scopedContestId }
    ));
    setPage(1);
  }, [scopedContestId]);

  const query = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    });
    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== 'sortBy' && key !== 'sortOrder') params.set(key, value);
    });
    return params.toString();
  }, [filters, page, pageSize]);

  const statsQuery = useCallback(() => {
    const params = new URLSearchParams();
    (['contestId', 'problemId', 'userId', 'language'] as const).forEach((key) => {
      const value = filters[key];
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const loadStats = useCallback(async () => {
    try {
      const params = statsQuery();
      const result = await adminGet<QueueStats>(`/api/admin/v1/submission-queue/stats${params ? `?${params}` : ''}`);
      setStats(result);
    } catch {
      // silently ignore stats loading errors
    }
  }, [statsQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminGet<PageResult<QueueRecord>>(`/api/admin/v1/submission-queue?${query()}`);
      setRows(result.list);
      setTotal(result.total);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '提交队列加载失败');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
    loadStats();
  }, [load, loadStats]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => { load(); loadStats(); }, 3000);
    return () => window.clearInterval(timer);
  }, [load, loadStats, paused]);

  useEffect(() => {
    const root = tableShellRef.current;
    const manualScroll = manualScrollRef.current;
    if (!root || !manualScroll) return undefined;

    const tableScrollTargets = Array.from(
      root.querySelectorAll<HTMLElement>('.arco-table-body, .arco-table-header, div.arco-table-tfoot')
    );
    if (!tableScrollTargets.length) return undefined;

    let syncing = false;
    const syncManualToTable = () => {
      if (syncing) return;
      syncing = true;
      tableScrollTargets.forEach((target) => {
        target.scrollLeft = manualScroll.scrollLeft;
      });
      window.requestAnimationFrame(() => { syncing = false; });
    };
    const syncTableToManual = (event: Event) => {
      if (syncing) return;
      syncing = true;
      manualScroll.scrollLeft = (event.currentTarget as HTMLElement).scrollLeft;
      window.requestAnimationFrame(() => { syncing = false; });
    };

    manualScroll.addEventListener('scroll', syncManualToTable, { passive: true });
    tableScrollTargets.forEach((target) => {
      target.addEventListener('scroll', syncTableToManual, { passive: true });
    });
    syncManualToTable();

    return () => {
      manualScroll.removeEventListener('scroll', syncManualToTable);
      tableScrollTargets.forEach((target) => {
        target.removeEventListener('scroll', syncTableToManual);
      });
    };
  }, [rows, loading]);

  async function rejudge(record: QueueRecord) {
    try {
      await adminPost(`/api/admin/v1/submission-queue/${record.queueId}/rejudge`);
      Message.success('已提交重判');
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '重判失败');
    }
  }

  async function cancel(record: QueueRecord) {
    try {
      await adminPost(`/api/admin/v1/submission-queue/${record.queueId}/cancel`);
      Message.success('已取消队列任务');
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '取消失败');
    }
  }

  async function openLogs(record: QueueRecord) {
    try {
      setLog(await adminGet<QueueLog>(`/api/admin/v1/submission-queue/${record.queueId}/logs`));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '日志加载失败');
    }
  }

  async function savePriority() {
    if (!priorityRecord) return;
    try {
      await adminPost(`/api/admin/v1/submission-queue/${priorityRecord.queueId}/priority`, { priority: priorityValue });
      Message.success('优先级已更新');
      setPriorityRecord(null);
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '优先级更新失败');
    }
  }

  function confirmDelete(record: QueueRecord) {
    Modal.confirm({
      title: '删除队列任务',
      content: `确定要删除提交 #${record.submissionId} 吗？相关测试点结果也会被清理。`,
      okText: '继续',
      cancelText: '取消',
      onOk: () => {
        Modal.confirm({
          title: '二次确认',
          content: '删除后不可恢复，请再次确认。',
          okButtonProps: { status: 'danger' },
          okText: '确认删除',
          cancelText: '取消',
          onOk: async () => {
            try {
              await adminDelete(`/api/admin/v1/submission-queue/${record.queueId}`);
              Message.success('队列任务已删除');
              load();
              loadStats();
            } catch (error) {
              Message.error(error instanceof Error ? error.message : '删除失败');
            }
          },
        });
      },
    });
  }

  const columns = [
    { title: '队列ID', dataIndex: 'queueId', width: 110 },
    { title: '提交ID', dataIndex: 'submissionId', width: 130 },
    { title: '比赛', dataIndex: 'contestTitle', width: 180, render: (_: unknown, record: QueueRecord) => record.contestTitle || '-' },
    {
      title: '题目',
      dataIndex: 'problemTitle',
      width: 220,
      render: (_: unknown, record: QueueRecord) => (
        <div>
          <Typography.Text bold>{record.problemLabel || `#${record.problemId}`}</Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{record.problemTitle}</Typography.Text>
        </div>
      ),
    },
    {
      title: '用户',
      dataIndex: 'displayName',
      width: 160,
      render: (_: unknown, record: QueueRecord) => (
        <div>
          <Typography.Text>{record.displayName}</Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{record.username || record.userId}</Typography.Text>
        </div>
      ),
    },
    { title: '语言', dataIndex: 'language', width: 110 },
    {
      title: '状态',
      dataIndex: 'statusText',
      width: 180,
      render: (_: unknown, record: QueueRecord) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {isActive(record.status) && <Spin size={14} />}
          <Tag color={statusColor(record.status)}>{record.statusText || record.status}</Tag>
        </span>
      ),
    },
    { title: '判题机', dataIndex: 'judgeServer', width: 130, render: (value: string) => value || '-' },
    { title: '优先级', dataIndex: 'priority', width: 100 },
    { title: '提交时间', dataIndex: 'submitTime', width: 190, render: formatDate },
    { title: '开始判题时间', dataIndex: 'startJudgeTime', width: 190, render: formatDate },
    { title: '完成时间', dataIndex: 'finishTime', width: 190, render: formatDate },
    { title: '等待时长', dataIndex: 'waitingTimeMillis', width: 130, render: formatDuration },
    { title: '运行时长', dataIndex: 'runningTimeMillis', width: 130, render: formatDuration },
    { title: '重试次数', dataIndex: 'retryCount', width: 110 },
    { title: '错误信息', dataIndex: 'errorMessage', width: 220, render: (value: string) => value || '-' },
    {
      title: '操作',
      width: QUEUE_TABLE_FIXED_OPERATION_WIDTH,
      fixed: 'right' as const,
      render: (_: unknown, record: QueueRecord) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Space size={4} wrap={false} style={{ whiteSpace: 'nowrap' }}>
            <Button size="mini" onClick={() => rejudge(record)}>重判</Button>
            <Button size="mini" status="warning" onClick={() => cancel(record)}>取消</Button>
            <Button
              size="mini"
              onClick={() => {
                setPriorityRecord(record);
                setPriorityValue(record.priority);
              }}
            >
              提优先级
            </Button>
            <Button size="mini" onClick={() => openLogs(record)}>日志</Button>
            <Button size="mini" status="danger" icon={<IconDelete />} onClick={() => confirmDelete(record)}>
              删除
            </Button>
          </Space>
        </div>
      ),
    },
  ];

  return (
    <div>
      <style>
        {`
          .admin-queue-table .arco-table-td:last-child,
          .admin-queue-table .arco-table-th:last-child {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }

          .admin-queue-table-shell .arco-table-body::-webkit-scrollbar,
          .admin-queue-table-shell .arco-table-header::-webkit-scrollbar {
            height: 0;
          }

          .admin-queue-table-manual-scroll {
            margin-top: 8px;
            margin-right: ${QUEUE_TABLE_FIXED_OPERATION_WIDTH}px;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-color: var(--color-neutral-4) var(--color-fill-2);
            scrollbar-width: thin;
          }

          .admin-queue-table-manual-scroll::-webkit-scrollbar {
            height: 12px;
          }

          .admin-queue-table-manual-scroll::-webkit-scrollbar-track {
            background: var(--color-fill-2);
            border-radius: 999px;
          }

          .admin-queue-table-manual-scroll::-webkit-scrollbar-thumb {
            background: var(--color-neutral-4);
            border-radius: 999px;
          }
        `}
      </style>
      <Card title="判题队列监控" style={{ marginBottom: 16 }}>
        <Row gutter={[24, 24]}>
          <Col span={4}>
            <Statistic
              title="等待判题"
              value={stats?.waiting ?? 0}
              suffix={
                <Typography.Text type="secondary" style={{ fontSize: 14, marginLeft: 8 }}>
                  <Tag color="blue">WAITING</Tag>
                </Typography.Text>
              }
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="正在判题"
              value={stats?.judging ?? 0}
              suffix={
                <Typography.Text type="secondary" style={{ fontSize: 14, marginLeft: 8 }}>
                  <Tag color="orange">JUDGING</Tag>
                </Typography.Text>
              }
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="已完成"
              value={stats?.finished ?? 0}
              suffix={
                <Typography.Text type="secondary" style={{ fontSize: 14, marginLeft: 8 }}>
                  <Tag color="green">FINISHED</Tag>
                </Typography.Text>
              }
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="当前并发"
              value={stats?.currentConcurrent ?? 0}
              suffix={`/ ${stats?.maxConcurrent ?? 2}`}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="最大并发"
              value={stats?.maxConcurrent ?? 2}
            />
          </Col>
          <Col span={4}>
            <Progress
              percent={stats ? (stats.maxConcurrent > 0 ? Math.round((stats.currentConcurrent / stats.maxConcurrent) * 100) : 0) : 0}
              status={stats && stats.currentConcurrent >= stats.maxConcurrent ? 'warning' : 'normal'}
              showText={false}
              style={{ width: '100%' }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              并发使用率
            </Typography.Text>
          </Col>
        </Row>
      </Card>

      <Card title="提交队列" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col span={4}><Input placeholder="比赛 ID" value={filters.contestId} disabled={!!scopedContestId} onChange={(contestId) => { setPage(1); setFilters({ ...filters, contestId }); }} /></Col>
          <Col span={4}><Input placeholder="题目 ID" value={filters.problemId} onChange={(problemId) => { setPage(1); setFilters({ ...filters, problemId }); }} /></Col>
          <Col span={4}><Input placeholder="用户 ID" value={filters.userId} onChange={(userId) => { setPage(1); setFilters({ ...filters, userId }); }} /></Col>
          <Col span={4}><Input placeholder="语言" value={filters.language} onChange={(language) => { setPage(1); setFilters({ ...filters, language }); }} /></Col>
          <Col span={4}>
            <Select placeholder="状态" allowClear value={filters.status || undefined} onChange={(status) => { setPage(1); setFilters({ ...filters, status: String(status || '') }); }}>
              {statusOptions.map((status) => <Option key={status} value={status}>{status}</Option>)}
            </Select>
          </Col>
          <Col span={4}>
            <Select value={filters.sortBy} onChange={(sortBy) => setFilters({ ...filters, sortBy: String(sortBy) })}>
              <Option value="submitTime">提交时间</Option>
              <Option value="priority">优先级</Option>
              <Option value="status">状态</Option>
              <Option value="startJudgeTime">开始时间</Option>
              <Option value="finishTime">结束时间</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select value={filters.sortOrder} onChange={(sortOrder) => setFilters({ ...filters, sortOrder: String(sortOrder) })}>
              <Option value="desc">降序</Option>
              <Option value="asc">升序</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Space>
              <div style={{ minWidth: 116 }}>
                <Switch checked={!paused} onChange={(checked) => setPaused(!checked)} checkedText="自动刷新" uncheckedText="已暂停" />
              </div>
              <Button icon={<IconRefresh />} loading={loading} onClick={load}>刷新</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <div className="admin-queue-table-shell" ref={tableShellRef}>
          <Table
            className="admin-queue-table"
            columns={columns}
            data={rows}
            rowKey="queueId"
            loading={loading}
            scroll={{ x: QUEUE_TABLE_SCROLL_X, y: 520 }}
            pagination={{
              current: page,
              pageSize,
              total,
              showTotal: true,
              showJumper: true,
              sizeCanChange: true,
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              },
            }}
          />
          <div className="admin-queue-table-manual-scroll" ref={manualScrollRef}>
            <div style={{ width: QUEUE_TABLE_SCROLL_BODY_WIDTH, height: 1 }} />
          </div>
        </div>
      </Card>

      <Modal
        title="错误日志"
        visible={!!log}
        onCancel={() => setLog(null)}
        footer={null}
      >
        {log && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text>状态：{log.status}</Typography.Text>
            <Typography.Text>判题机：{log.judgeServer || '-'}</Typography.Text>
            <pre style={{ padding: 12, background: '#f7f8fa', borderRadius: 6, whiteSpace: 'pre-wrap' }}>
              {log.errorMessage || log.judgeMessage || '暂无错误日志'}
            </pre>
          </Space>
        )}
      </Modal>

      <Modal
        title="调整优先级"
        visible={!!priorityRecord}
        onCancel={() => setPriorityRecord(null)}
        onOk={savePriority}
      >
        <InputNumber min={0} max={1000} value={priorityValue} onChange={(value) => setPriorityValue(Number(value) || 0)} />
      </Modal>
    </div>
  );
}
