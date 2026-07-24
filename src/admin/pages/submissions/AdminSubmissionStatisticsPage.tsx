/**
 * 管理员提交统计页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Grid,
  Message,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconDownload, IconRefresh, IconSearch } from '@arco-design/web-react/icon';
import { adminDownload, adminGet } from '../../api/adminClient';

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
  language: string;
  status: string;
  score?: number | null;
  timeUsed?: number | null;
  memoryUsed?: number | null;
  codeLength?: number | null;
  identityType?: string | null;
  identityId?: number | null;
  priority?: number | null;
  retryCount?: number | null;
  judgeServer?: string | null;
  submitTime?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  passedCaseCount?: number | null;
  totalCaseCount?: number | null;
  judgeMessage?: string | null;
  errorMessage?: string | null;
}

/**
 * 班级Option接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ClassOption {
  id: number;
  name: string;
}

/**
 * 用户Option接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface UserOption {
  id: number;
  username?: string | null;
  displayName?: string | null;
}

/**
 * 题目Option接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ProblemOption {
  id: number;
  title: string;
}

/**
 * 比赛Option接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ContestOption {
  id: number;
  title: string;
}

const statusOptions = ['PENDING', 'JUDGING', 'COMPILING', 'RUNNING', 'AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'SE', 'FAILED', 'REJUDGE_PENDING'];
const languageOptions = ['C', 'C++', 'Python', 'Java'];

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

// 默认语言全量集合（含后端可能存在的变体），与题目/提交实际录入一致
const ALL_LANGUAGES = ['C', 'C++', 'Python', 'Python3', 'Java', 'Go', 'Rust', 'Kotlin', 'JavaScript', 'TypeScript'];

/**
 * 渲染管理员提交统计页面，并协调其数据加载、状态和交互。
 */
export function AdminSubmissionStatisticsPage() {
  const [rows, setRows] = useState<AdminSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [exporting, setExporting] = useState(false);

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [problems, setProblems] = useState<ProblemOption[]>([]);
  const [contests, setContests] = useState<ContestOption[]>([]);
  // 学生采用远程模糊搜索（只查 STUDENT 角色），不再预加载全量
  const [studentOptions, setStudentOptions] = useState<UserOption[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const studentSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<UserOption | null>(null);

  const [filters, setFilters] = useState({
    id: '',
    userId: '',
    classId: '',
    problemId: '',
    contestId: '',
    language: '',
    status: '',
    from: '',
    to: '',
    sortBy: 'submitTime',
    sortOrder: 'desc',
  });

  // 加载下拉数据（学生用远程搜索，不在此预加载）
  useEffect(() => {
    (async () => {
      try {
        const cs = await adminGet<ClassOption[]>('/api/admin/v1/classes');
        setClasses(cs ?? []);
      } catch (e) { /* 忽略，下拉为空 */ }
      try {
        const res = await adminGet<PageResult<ProblemOption>>('/api/admin/v1/problems?page=1&pageSize=200');
        setProblems(res?.list ?? []);
      } catch (e) { /* 忽略 */ }
      try {
        const res = await adminGet<PageResult<ContestOption>>('/api/admin/v1/contests?page=1&pageSize=200');
        setContests(res?.list ?? []);
      } catch (e) { /* 忽略 */ }
    })();
  }, []);

  // 学生远程模糊搜索：带去抖，仅查 STUDENT 角色
  const searchStudents = useCallback((keyword: string) => {
    if (studentSearchTimer.current) {
      clearTimeout(studentSearchTimer.current);
    }
    studentSearchTimer.current = setTimeout(async () => {
      setStudentLoading(true);
      try {
        const params = new URLSearchParams({
          page: '1',
          pageSize: '50',
          role: 'STUDENT',
        });
        if (keyword.trim()) params.set('keyword', keyword.trim());
        const res = await adminGet<PageResult<UserOption>>(
          `/api/admin/v1/users?${params.toString()}`
        );
        setStudentOptions(res?.list ?? []);
      } catch (e) {
        setStudentOptions([]);
      } finally {
        setStudentLoading(false);
      }
    }, 300);
  }, []);

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
    setLoading(true);
    try {
      const result = await adminGet<PageResult<AdminSubmission>>(`/api/admin/v1/submissions?${buildQuery()}`);
      setRows(result.list);
      setTotal(result.total);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '提交记录加载失败');
    } finally {
      setLoading(false);
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
      id: '', userId: '', classId: '', problemId: '', contestId: '',
      language: '', status: '', from: '', to: '',
      sortBy: 'submitTime', sortOrder: 'desc',
    });
    setPage(1);
  }

  /**
   * 封装导出Csv相关逻辑。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    try {
      // 导出按当前筛选条件全量（不含分页参数）
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== 'sortBy' && key !== 'sortOrder') {
          params.set(key, value);
        }
      });
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
      await adminDownload(`/api/admin/v1/submissions/export?${params.toString()}`, 'submissions.csv');
      Message.success('导出已开始，请留意浏览器下载');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }

  const columns = [
    { title: '提交ID', dataIndex: 'id', width: 100, fixed: 'left' as const },
    {
      title: '用户',
      dataIndex: 'displayName',
      width: 170,
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
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>problemId: {record.problemId}</Typography.Text>
        </div>
      ),
    },
    { title: '比赛名称', dataIndex: 'contestTitle', width: 170, render: dash },
    { title: '题单名称', dataIndex: 'practiceTitle', width: 160, render: dash },
    { title: '语言', dataIndex: 'language', width: 100 },
    { title: '状态', dataIndex: 'status', width: 120, render: (value: string) => <Tag color={statusColor(value)}>{value || '-'}</Tag> },
    { title: '分数', dataIndex: 'score', width: 80, render: dash },
    { title: '通过测试点', key: 'caseCount', width: 110, render: (_: unknown, record: AdminSubmission) => caseCount(record) },
    { title: '运行时间(ms)', dataIndex: 'timeUsed', width: 120, render: dash },
    { title: '运行内存(KB)', dataIndex: 'memoryUsed', width: 120, render: dash },
    { title: '代码长度', dataIndex: 'codeLength', width: 100, render: dash },
    { title: '身份类型', dataIndex: 'identityType', width: 100, render: dash },
    { title: '判题机', dataIndex: 'judgeServer', width: 110, render: dash },
    { title: '比赛提交', dataIndex: 'isContestSubmission', width: 90, render: boolText },
    { title: '提交时间', dataIndex: 'submitTime', width: 170, render: formatDate },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col span={4}>
            <Select
              placeholder="输入学号/姓名/用户名搜索"
              allowClear
              showSearch
              filterOption={false}
              loading={studentLoading}
              style={{ width: '100%' }}
              notFoundContent="输入关键词以搜索学生"
              value={selectedStudent ? selectedStudent.id : undefined}
              onSearch={(value) => searchStudents(value)}
              onFocus={() => {
                if (studentOptions.length === 0) searchStudents('');
              }}
              onChange={(value) => {
                if (value == null) {
                  setSelectedStudent(null);
                  updateFilter('userId', '');
                  return;
                }
                const picked = studentOptions.find((u) => u.id === value);
                setSelectedStudent(picked ?? { id: value as number, username: `#${value}`, displayName: `#${value}` });
                updateFilter('userId', String(value));
              }}
            >
              {studentOptions.map((u) => (
                <Option key={u.id} value={u.id}>
                  {u.displayName || u.username || `#${u.id}`}（#{u.id}）
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="按班级筛选"
              allowClear
              showSearch
              value={filters.classId || undefined}
              onChange={(value) => updateFilter('classId', String(value ?? ''))}
              style={{ width: '100%' }}
            >
              {classes.map((c) => (
                <Option key={c.id} value={c.id}>{c.name}</Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="按题目筛选"
              allowClear
              showSearch
              value={filters.problemId || undefined}
              onChange={(value) => updateFilter('problemId', String(value ?? ''))}
              style={{ width: '100%' }}
            >
              {problems.map((p) => (
                <Option key={p.id} value={p.id}>{p.title}（#{p.id}）</Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="按比赛筛选"
              allowClear
              showSearch
              value={filters.contestId || undefined}
              onChange={(value) => updateFilter('contestId', String(value ?? ''))}
              style={{ width: '100%' }}
            >
              {contests.map((c) => (
                <Option key={c.id} value={c.id}>{c.title}（#{c.id}）</Option>
              ))}
            </Select>
          </Col>
          <Col span={3}>
            <Select placeholder="语言" allowClear value={filters.language || undefined} onChange={(value) => updateFilter('language', String(value || ''))} style={{ width: '100%' }}>
              {[...new Set([...languageOptions, ...ALL_LANGUAGES])].map((item) => (
                <Option key={item} value={item}>{item}</Option>
              ))}
            </Select>
          </Col>
          <Col span={3}>
            <Select placeholder="状态" allowClear value={filters.status || undefined} onChange={(value) => updateFilter('status', String(value || ''))} style={{ width: '100%' }}>
              {statusOptions.map((item) => <Option key={item} value={item}>{item}</Option>)}
            </Select>
          </Col>
          <Col span={3}>
            <input
              type="datetime-local"
              value={filters.from}
              onChange={(event) => updateFilter('from', event.target.value)}
              style={{ width: '100%', height: 32, border: '1px solid var(--color-border-2)', borderRadius: 2, padding: '0 8px' }}
            />
          </Col>
          <Col span={3}>
            <input
              type="datetime-local"
              value={filters.to}
              onChange={(event) => updateFilter('to', event.target.value)}
              style={{ width: '100%', height: 32, border: '1px solid var(--color-border-2)', borderRadius: 2, padding: '0 8px' }}
            />
          </Col>
          <Col span={3}>
            <Select value={filters.sortBy} onChange={(value) => updateFilter('sortBy', String(value))} style={{ width: '100%' }}>
              <Option value="submitTime">提交时间</Option>
              <Option value="createdAt">创建时间</Option>
              <Option value="id">提交ID</Option>
              <Option value="status">状态</Option>
              <Option value="score">分数</Option>
              <Option value="timeUsed">运行时间</Option>
            </Select>
          </Col>
          <Col span={3}>
            <Select value={filters.sortOrder} onChange={(value) => updateFilter('sortOrder', String(value))} style={{ width: '100%' }}>
              <Option value="desc">降序</Option>
              <Option value="asc">升序</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Space>
              <Button type="primary" icon={<IconSearch />} onClick={load}>查询</Button>
              <Button icon={<IconRefresh />} onClick={resetFilters}>重置</Button>
              <Button type="primary" status="success" icon={<IconDownload />} loading={exporting} onClick={exportCsv}>
                导出 CSV
              </Button>
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
          scroll={{ x: 2300, y: 520 }}
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
    </div>
  );
}
