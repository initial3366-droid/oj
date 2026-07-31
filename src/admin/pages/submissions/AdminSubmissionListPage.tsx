/**
 * 管理员提交列表页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Grid,
  Input,
  Message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconCode, IconDelete, IconEye, IconRefresh, IconSearch } from '@arco-design/web-react/icon';
import { useParams, useSearchParams } from 'react-router-dom';
import { adminDelete, adminGet } from '../../api/adminClient';

const { Row, Col } = Grid;
const Option = Select.Option;

/**
 * 页面结果接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface PageResult<T> {
  total: number;
  list: T[];
}

/**
 * 提交测试点接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface SubmissionCase {
  id?: number | null;
  submissionId?: number | null;
  caseNo: number;
  subtaskNo?: number | null;
  status: string;
  score?: number | null;
  maxScore?: number | null;
  timeMs?: number | null;
  memoryKb?: number | null;
  inputPreview?: string | null;
  outputPreview?: string | null;
  expectedPreview?: string | null;
  judgeMessage?: string | null;
}

/**
 * 管理员提交接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface AdminSubmission {
  id: number;
  userId: number;
  username?: string | null;
  displayName?: string | null;
  problemId: number;
  problemTitle?: string | null;
  contestId?: number | null;
  contestTitle?: string | null;
  contestProblemId?: number | null;
  contestProblemLabel?: string | null;
  practiceId?: number | null;
  practiceTitle?: string | null;
  participantId?: number | null;
  teamId?: number | null;
  codeLength?: number | null;
  language: string;
  status: string;
  score?: number | null;
  timeUsed?: number | null;
  memoryUsed?: number | null;
  identityType?: string | null;
  identityId?: number | null;
  judgeServer?: string | null;
  priority?: number | null;
  retryCount?: number | null;
  judgeMessage?: string | null;
  errorMessage?: string | null;
  submitTime?: string | null;
  isContestSubmission?: boolean | null;
  isFrozen?: boolean | null;
  isRejudged?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  passedCaseCount?: number | null;
  totalCaseCount?: number | null;
  code?: string | null;
  cases?: SubmissionCase[];
}

const statusOptions = ['PENDING', 'JUDGING', 'COMPILING', 'RUNNING', 'AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'SE', 'FAILED', 'REJUDGE_PENDING'];
const languageOptions = ['C', 'C++', 'Python', 'Java'];

/**
 * 封装scoped比赛标识FromLocation相关逻辑。可能改变当前路由或查询参数。
 */
function scopedContestIdFromLocation(routeContestId?: string, queryContestId?: string | null) {
  if (routeContestId) return routeContestId;
  if (queryContestId) return queryContestId;
  const match = window.location.pathname.match(/\/admin\/contests\/(\d+)\/submissions(?:\/|$)/);
  return match?.[1] ?? '';
}

/**
 * 格式化Date。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 封装dash相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function dash(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

/**
 * 封装boolText相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function boolText(value?: boolean | null) {
  if (value === null || value === undefined) return '-';
  return value ? '是' : '否';
}

/**
 * 封装状态Color相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function statusColor(status?: string | null) {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'AC' || normalized === 'ACCEPTED') return 'green';
  if (['PENDING', 'WAITING', 'JUDGING', 'COMPILING', 'RUNNING', 'REJUDGE_PENDING'].includes(normalized)) return 'blue';
  if (normalized === 'TLE' || normalized === 'MLE') return 'orange';
  if (normalized === 'SE' || normalized === 'FAILED') return 'gray';
  return 'red';
}

/**
 * 封装测试点Count相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function caseCount(record: AdminSubmission) {
  const passed = record.passedCaseCount ?? 0;
  const total = record.totalCaseCount ?? 0;
  return `${passed}/${total}`;
}

/**
 * 渲染管理员提交列表页面，并协调其数据加载、状态和交互。
 */
export function AdminSubmissionListPage() {
  const requestSequence = useRef(0);
  const [searchParams] = useSearchParams();
  const routeParams = useParams();
  const scopedContestId = scopedContestIdFromLocation(routeParams.contestId, searchParams.get('contestId'));
  const initialContestId = scopedContestId;
  const [rows, setRows] = useState<AdminSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({
    id: '',
    userId: '',
    problemId: '',
    contestId: initialContestId,
    contestProblemId: '',
    practiceId: '',
    language: '',
    status: '',
    judgeServer: '',
    identityType: '',
    from: '',
    to: '',
    sortBy: 'submitTime',
    sortOrder: 'desc',
  });
  const [detail, setDetail] = useState<AdminSubmission | null>(null);
  const [code, setCode] = useState('');
  const [codeModalVisible, setCodeModalVisible] = useState(false);

  useEffect(() => {
    setFilters((current) => (
      current.contestId === scopedContestId ? current : { ...current, contestId: scopedContestId }
    ));
    setPage(1);
  }, [scopedContestId]);

  /**
   * 构造或转换Query。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const buildQuery = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    });
    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== 'sortBy' && key !== 'sortOrder') {
        params.set(key, value);
      }
    });
    return params.toString();
  }, [filters, page, pageSize]);

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const result = await adminGet<PageResult<AdminSubmission>>(`/api/admin/v1/submissions?${buildQuery()}`);
      if (sequence !== requestSequence.current) return;
      setRows(result.list);
      setTotal(result.total);
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      Message.error(error instanceof Error ? error.message : '提交列表加载失败');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * 更新Filter。会更新 React 状态并触发重新渲染。
   */
  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  /**
   * 重置Filters。会更新 React 状态并触发重新渲染。
   */
  function resetFilters() {
    setFilters({
      id: '',
      userId: '',
      problemId: '',
      contestId: scopedContestId,
      contestProblemId: '',
      practiceId: '',
      language: '',
      status: '',
      judgeServer: '',
      identityType: '',
      from: '',
      to: '',
      sortBy: 'submitTime',
      sortOrder: 'desc',
    });
    setPage(1);
  }

  /**
   * 封装open详情相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function openDetail(record: AdminSubmission) {
    try {
      setDetail(await adminGet<AdminSubmission>(`/api/admin/v1/submissions/${record.id}`));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '提交详情加载失败');
    }
  }

  /**
   * 封装open编码相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function openCode(record: AdminSubmission) {
    try {
      setCode(await adminGet<string>(`/api/admin/v1/submissions/${record.id}/code`));
      setCodeModalVisible(true);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '代码加载失败');
    }
  }

  /**
   * 删除提交。包含异步流程并由调用方处理完成或失败状态；会访问后端接口。
   */
  async function deleteSubmission(record: AdminSubmission) {
    try {
      await adminDelete(`/api/admin/v1/submissions/${record.id}`);
      Message.success('提交已删除');
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  const columns = [
    { title: '提交ID', dataIndex: 'id', width: 100, fixed: 'left' as const },
    {
      title: '用户',
      dataIndex: 'displayName',
      width: 180,
      render: (_: unknown, record: AdminSubmission) => (
        <div>
          <Typography.Text>{record.displayName || record.username || `#${record.userId}`}</Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>ID: {record.userId}</Typography.Text>
        </div>
      ),
    },
    {
      title: '题目',
      dataIndex: 'problemTitle',
      width: 240,
      render: (_: unknown, record: AdminSubmission) => (
        <div>
          <Typography.Text>{record.contestProblemLabel ? `${record.contestProblemLabel}. ` : ''}{record.problemTitle || `#${record.problemId}`}</Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            problemId: {record.problemId}{record.contestProblemId ? ` / contestProblemId: ${record.contestProblemId}` : ''}
          </Typography.Text>
        </div>
      ),
    },
    { title: '比赛ID', dataIndex: 'contestId', width: 110, render: dash },
    { title: '比赛名称', dataIndex: 'contestTitle', width: 180, render: dash },
    { title: '题单ID', dataIndex: 'practiceId', width: 110, render: dash },
    { title: '题单名称', dataIndex: 'practiceTitle', width: 180, render: dash },
    { title: '参赛者ID', dataIndex: 'participantId', width: 110, render: dash },
    { title: '团队ID', dataIndex: 'teamId', width: 100, render: dash },
    { title: '语言', dataIndex: 'language', width: 110 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 130,
      render: (value: string) => <Tag color={statusColor(value)}>{value || '-'}</Tag>,
    },
    { title: '分数', dataIndex: 'score', width: 90, render: dash },
    { title: '通过测试点', key: 'caseCount', width: 120, render: (_: unknown, record: AdminSubmission) => caseCount(record) },
    { title: '运行时间(ms)', dataIndex: 'timeUsed', width: 130, render: dash },
    { title: '运行内存(KB)', dataIndex: 'memoryUsed', width: 130, render: dash },
    { title: '代码长度', dataIndex: 'codeLength', width: 110, render: dash },
    { title: '身份类型', dataIndex: 'identityType', width: 110, render: dash },
    { title: '身份ID', dataIndex: 'identityId', width: 100, render: dash },
    { title: '判题机', dataIndex: 'judgeServer', width: 120, render: dash },
    { title: '优先级', dataIndex: 'priority', width: 90, render: dash },
    { title: '重试次数', dataIndex: 'retryCount', width: 100, render: dash },
    { title: '比赛提交', dataIndex: 'isContestSubmission', width: 100, render: boolText },
    { title: '封榜', dataIndex: 'isFrozen', width: 80, render: boolText },
    { title: '重判', dataIndex: 'isRejudged', width: 80, render: boolText },
    { title: '提交时间', dataIndex: 'submitTime', width: 180, render: formatDate },
    { title: '创建时间', dataIndex: 'createdAt', width: 180, render: formatDate },
    { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: formatDate },
    { title: '判题信息', dataIndex: 'judgeMessage', width: 220, render: dash },
    { title: '错误信息', dataIndex: 'errorMessage', width: 220, render: dash },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      fixed: 'right' as const,
      render: (_: unknown, record: AdminSubmission) => (
        <Space wrap={false} size={4} style={{ whiteSpace: 'nowrap' }}>
          <Button type="text" size="small" icon={<IconEye />} onClick={() => openDetail(record)}>查看</Button>
          <Button type="text" size="small" icon={<IconCode />} onClick={() => openCode(record)}>代码</Button>
          <Popconfirm
            title={`确定删除提交 #${record.id} 吗？`}
            okText="删除"
            cancelText="取消"
            onOk={() => deleteSubmission(record)}
          >
            <Button type="text" status="danger" size="small" icon={<IconDelete />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col span={3}><Input placeholder="提交ID" value={filters.id} onChange={(value) => updateFilter('id', value)} /></Col>
          <Col span={3}><Input placeholder="用户ID" value={filters.userId} onChange={(value) => updateFilter('userId', value)} /></Col>
          <Col span={3}><Input placeholder="题目ID" value={filters.problemId} onChange={(value) => updateFilter('problemId', value)} /></Col>
          <Col span={3}><Input placeholder="比赛ID" value={filters.contestId} disabled={!!scopedContestId} onChange={(value) => updateFilter('contestId', value)} /></Col>
          <Col span={3}><Input placeholder="比赛题目ID" value={filters.contestProblemId} onChange={(value) => updateFilter('contestProblemId', value)} /></Col>
          <Col span={3}><Input placeholder="题单ID" value={filters.practiceId} onChange={(value) => updateFilter('practiceId', value)} /></Col>
          <Col span={3}>
            <Select placeholder="语言" allowClear value={filters.language || undefined} onChange={(value) => updateFilter('language', String(value || ''))}>
              {languageOptions.map((item) => <Option key={item} value={item}>{item}</Option>)}
            </Select>
          </Col>
          <Col span={3}>
            <Select placeholder="状态" allowClear value={filters.status || undefined} onChange={(value) => updateFilter('status', String(value || ''))}>
              {statusOptions.map((item) => <Option key={item} value={item}>{item}</Option>)}
            </Select>
          </Col>
          <Col span={3}><Input placeholder="判题机" value={filters.judgeServer} onChange={(value) => updateFilter('judgeServer', value)} /></Col>
          <Col span={3}><Input placeholder="身份类型" value={filters.identityType} onChange={(value) => updateFilter('identityType', value)} /></Col>
          <Col span={4}>
            <input
              type="datetime-local"
              value={filters.from}
              onChange={(event) => updateFilter('from', event.target.value)}
              style={{ width: '100%', height: 32, border: '1px solid var(--color-border-2)', borderRadius: 2, padding: '0 8px' }}
            />
          </Col>
          <Col span={4}>
            <input
              type="datetime-local"
              value={filters.to}
              onChange={(event) => updateFilter('to', event.target.value)}
              style={{ width: '100%', height: 32, border: '1px solid var(--color-border-2)', borderRadius: 2, padding: '0 8px' }}
            />
          </Col>
          <Col span={3}>
            <Select value={filters.sortBy} onChange={(value) => updateFilter('sortBy', String(value))}>
              <Option value="submitTime">提交时间</Option>
              <Option value="createdAt">创建时间</Option>
              <Option value="updatedAt">更新时间</Option>
              <Option value="id">提交ID</Option>
              <Option value="status">状态</Option>
              <Option value="score">分数</Option>
              <Option value="timeUsed">运行时间</Option>
              <Option value="memoryUsed">运行内存</Option>
              <Option value="priority">优先级</Option>
            </Select>
          </Col>
          <Col span={3}>
            <Select value={filters.sortOrder} onChange={(value) => updateFilter('sortOrder', String(value))}>
              <Option value="desc">降序</Option>
              <Option value="asc">升序</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Space>
              <Button type="primary" icon={<IconSearch />} onClick={load}>查询</Button>
              <Button icon={<IconRefresh />} onClick={resetFilters}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          data={rows}
          rowKey="id"
          loading={loading}
          scroll={{ x: 4340 }}
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
      </Card>

      <Modal
        title={detail ? `提交详情 #${detail.id}` : '提交详情'}
        visible={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        style={{ width: 1040 }}
      >
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions
              column={3}
              data={[
                { key: 'id', label: '提交ID', value: detail.id },
                { key: 'userId', label: '用户ID', value: detail.userId },
                { key: 'user', label: '用户', value: detail.displayName || detail.username || '-' },
                { key: 'problemId', label: '题目ID', value: detail.problemId },
                { key: 'problemTitle', label: '题目', value: detail.problemTitle || '-' },
                { key: 'contestProblemId', label: '比赛题目ID', value: dash(detail.contestProblemId) },
                { key: 'contestId', label: '比赛ID', value: dash(detail.contestId) },
                { key: 'contestTitle', label: '比赛', value: dash(detail.contestTitle) },
                { key: 'practiceId', label: '题单ID', value: dash(detail.practiceId) },
                { key: 'practiceTitle', label: '题单', value: dash(detail.practiceTitle) },
                { key: 'participantId', label: '参赛者ID', value: dash(detail.participantId) },
                { key: 'teamId', label: '团队ID', value: dash(detail.teamId) },
                { key: 'language', label: '语言', value: detail.language },
                { key: 'status', label: '状态', value: <Tag color={statusColor(detail.status)}>{detail.status}</Tag> },
                { key: 'score', label: '分数', value: dash(detail.score) },
                { key: 'timeUsed', label: '运行时间', value: dash(detail.timeUsed) },
                { key: 'memoryUsed', label: '运行内存', value: dash(detail.memoryUsed) },
                { key: 'cases', label: '测试点', value: caseCount(detail) },
                { key: 'codeLength', label: '代码长度', value: dash(detail.codeLength) },
                { key: 'identityType', label: '身份类型', value: dash(detail.identityType) },
                { key: 'identityId', label: '身份ID', value: dash(detail.identityId) },
                { key: 'judgeServer', label: '判题机', value: dash(detail.judgeServer) },
                { key: 'priority', label: '优先级', value: dash(detail.priority) },
                { key: 'retryCount', label: '重试次数', value: dash(detail.retryCount) },
                { key: 'isContestSubmission', label: '比赛提交', value: boolText(detail.isContestSubmission) },
                { key: 'isFrozen', label: '封榜', value: boolText(detail.isFrozen) },
                { key: 'isRejudged', label: '重判', value: boolText(detail.isRejudged) },
                { key: 'submitTime', label: '提交时间', value: formatDate(detail.submitTime) },
                { key: 'createdAt', label: '创建时间', value: formatDate(detail.createdAt) },
                { key: 'updatedAt', label: '更新时间', value: formatDate(detail.updatedAt) },
              ]}
            />
            <div>
              <Typography.Title heading={6}>判题信息</Typography.Title>
              <pre style={{ padding: 12, background: '#f7f8fa', borderRadius: 4, whiteSpace: 'pre-wrap' }}>
                {detail.judgeMessage || detail.errorMessage || '暂无'}
              </pre>
            </div>
            <div>
              <Typography.Title heading={6}>测试点</Typography.Title>
              <Table
                size="small"
                rowKey={(record) => record.id ?? `${record.caseNo}-${record.subtaskNo ?? 'main'}-${record.status}`}
                pagination={false}
                data={detail.cases || []}
                columns={[
                  { title: 'ID', dataIndex: 'id', width: 90, render: dash },
                  { title: '测试点', dataIndex: 'caseNo', width: 120 },
                  { title: '子任务', dataIndex: 'subtaskNo', width: 100, render: dash },
                  { title: '状态', dataIndex: 'status', width: 160, render: (value: string) => <Tag color={statusColor(value)}>{value}</Tag> },
                  { title: '得分', dataIndex: 'score', width: 90, render: dash },
                  { title: '满分', dataIndex: 'maxScore', width: 90, render: dash },
                  { title: '时间(ms)', dataIndex: 'timeMs', render: dash },
                  { title: '内存(KB)', dataIndex: 'memoryKb', render: dash },
                  { title: '输入预览', dataIndex: 'inputPreview', width: 180, render: dash },
                  { title: '输出预览', dataIndex: 'outputPreview', width: 180, render: dash },
                  { title: '期望预览', dataIndex: 'expectedPreview', width: 180, render: dash },
                  { title: '判题信息', dataIndex: 'judgeMessage', width: 220, render: dash },
                ]}
              />
            </div>
            <div>
              <Typography.Title heading={6}>代码</Typography.Title>
              <pre style={{ maxHeight: 360, overflow: 'auto', padding: 12, background: '#111827', color: '#f9fafb', borderRadius: 4 }}>
                {detail.code || '(无代码)'}
              </pre>
            </div>
          </Space>
        )}
      </Modal>

      <Modal
        title="提交代码"
        visible={codeModalVisible}
        footer={null}
        onCancel={() => setCodeModalVisible(false)}
        style={{ width: 920 }}
      >
        <pre style={{ maxHeight: 620, overflow: 'auto', padding: 12, background: '#111827', color: '#f9fafb', borderRadius: 4 }}>
          {code || '(无代码)'}
        </pre>
      </Modal>
    </div>
  );
}
