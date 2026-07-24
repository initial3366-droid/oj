/**
 * 教师Routes组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import '../utils/arcoSetup';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import {
  IconApps,
  IconBook,
  IconCalendar,
  IconCode,
  IconDashboard,
  IconDelete,
  IconEdit,
  IconFile,
  IconImport,
  IconPlus,
  IconRefresh,
  IconSave,
  IconSearch,
  IconUser,
  IconPoweroff,
  IconUserGroup,
} from '@arco-design/web-react/icon';
import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from 'react';
import {
  getTeacherToken,
  teacherDelete,
  teacherGet,
  teacherImportStudentsFile,
  teacherLogin,
  teacherLogout,
  teacherPost,
  teacherPut,
  type ImportResult,
  type PageResult,
  type TeacherApplication,
  type TeacherClass,
  type TeacherMe,
  type TeacherStudent,
  type TeacherSubmission,
} from './teacherApi';
import { TeacherProblemListPage } from './pages/TeacherProblemListPage';
import { TeacherProblemCreatePage } from './pages/TeacherProblemCreatePage';
import { TeacherProblemFolderPage } from './pages/TeacherProblemFolderPage';
import { TeacherContestListPage } from './pages/TeacherContestListPage';
import { TeacherContestCreatePage } from './pages/TeacherContestCreatePage';
import { TeacherContestDetailPage } from './pages/TeacherContestDetailPage';
import { TeacherPracticeListPage } from './pages/TeacherPracticeListPage';
import { TeacherPracticeCreatePage } from './pages/TeacherPracticeCreatePage';
import { TeacherPracticeReportPage } from './pages/TeacherPracticeReportPage';
import { PracticePublishPage } from '../components/practices/PracticePublishPage';
import { TeacherProfilePage } from './pages/TeacherProfilePage';
import { TeacherDashboardPage } from './TeacherDashboardPage';

const { Sider, Header, Content } = Layout;
const FormItem = Form.Item;
const Option = Select.Option;
const TextArea = Input.TextArea;

/**
 * 格式化Date。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 封装状态Tag相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function statusTag(status: string) {
  const color = status === 'AC' || status === 'APPROVED' ? 'green' : status === 'PENDING' ? 'orange' : 'red';
  return <Tag color={color}>{status}</Tag>;
}

/**
 * 封装dash相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function dash(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

/**
 * 封装角色Text相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function roleText(role?: string | null) {
  const map: Record<string, string> = {
    SUPER_ADMIN: '系统管理员',
    TEACHER: '教师',
    STUDENT: '学生',
  };
  return role ? (map[role] || '-') : '-';
}

/**
 * 渲染Student头像。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function renderStudentAvatar(user: Pick<TeacherStudentDetail, 'avatarUrl' | 'displayName' | 'username'>, size = 72) {
  const name = user.displayName || user.username || '学生';
  return (
    <Avatar size={size} style={{ backgroundColor: '#165dff' }}>
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : name.charAt(0)}
    </Avatar>
  );
}

/**
 * 教师Audience类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type TeacherAudience = 'ALL' | 'CLASS';
/**
 * 比赛类型类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type ContestType = 'ACM' | 'OI';

/**
 * 教师Student详情接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface TeacherStudentDetail {
  id: number;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  studentNo?: string | null;
  email?: string | null;
  role?: string | null;
  className?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * 教师题目接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface TeacherProblem {
  id: number;
  title: string;
  statement?: string | null;
  timeLimit?: number | null;
  memoryLimit?: number | null;
  difficulty?: number | null;
  tags?: string[] | null;
  testCaseCount?: number | null;
  isPublic?: boolean | null;
  ownerName?: string | null;
  createdAt?: string | null;
}

/**
 * 教师练习接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface TeacherPractice {
  id: number;
  title: string;
  description?: string | null;
  audience: string;
  audienceId?: number | null;
  hasPassword?: boolean | null;
  problems?: TeacherProblem[];
  createdAt?: string | null;
}

/**
 * 教师比赛接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface TeacherContest {
  id: number;
  title: string;
  type: ContestType;
  status?: string | null;
  audience?: string | null;
  audienceId?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  problems?: Array<{ problemId: number; title?: string | null; label?: string | null; score?: number | null }>;
}

/**
 * 题目Draft响应接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ProblemDraftResponse {
  draftId: string;
}

/**
 * 教师题目FormValues接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface TeacherProblemFormValues {
  title: string;
  statement: string;
  inputFormat?: string;
  outputFormat?: string;
  timeLimit: number;
  memoryLimit: number;
  tagsText?: string;
  sampleInput?: string;
  sampleOutput?: string;
  isPublic: boolean;
}

/**
 * 教师练习FormValues接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface TeacherPracticeFormValues {
  title: string;
  description?: string;
  audience: TeacherAudience;
  audienceId?: number;
  password?: string;
  problemIds?: number[];
}

/**
 * 教师比赛FormValues接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface TeacherContestFormValues {
  title: string;
  description?: string;
  type: ContestType;
  startTime: string;
  durationMinutes: number;
  audience: TeacherAudience;
  audienceId?: number;
  problemIds?: number[];
}

/**
 * 封装labelOf相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function labelOf(index: number) {
  return String.fromCharCode(65 + index);
}

/**
 * 封装nowLocalInput相关逻辑。会更新 React 状态并触发重新渲染。
 */
function nowLocalInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

/**
 * 构造或转换LocalDateTime。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function toLocalDateTime(value: string) {
  return value.length === 16 ? `${value}:00` : value.slice(0, 19);
}

/**
 * 封装audienceText相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function audienceText(value?: string | null) {
  if (value === 'CLASS') return '班级';
  return '公开';
}

/**
 * 封装比赛状态Text相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function contestStatusText(value?: string | null) {
  if (value === 'RUNNING') return '进行中';
  if (value === 'ENDED') return '已结束';
  return '未开始';
}

/**
 * 解析并规范化Tags。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function parseTags(value?: string) {
  return (value || '')
    .split(/[,\n，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 解析并规范化TestCases。失败时向调用方传播异常。
 */
function parseTestCases(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const delimiterIndex = line.indexOf('|||');
      if (delimiterIndex < 0) {
        throw new Error(`第 ${index + 1} 行测试点缺少分隔符 |||`);
      }
      return {
        caseNo: index + 1,
        input: line.slice(0, delimiterIndex).trim(),
        output: line.slice(delimiterIndex + 3).trim(),
      };
    });
}

/**
 * 构造或转换比赛Problems。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function buildContestProblems(problemIds: number[], type: ContestType) {
  if (type !== 'OI') {
    return problemIds.map((problemId, index) => ({
      problemId,
      label: labelOf(index),
      score: 0,
      displayOrder: index + 1,
      caseScores: [],
    }));
  }
  const base = Math.floor(100 / problemIds.length);
  let rest = 100 - base * problemIds.length;
  return problemIds.map((problemId, index) => {
    const score = base + (rest > 0 ? 1 : 0);
    rest -= 1;
    return {
      problemId,
      label: labelOf(index),
      score,
      displayOrder: index + 1,
      caseScores: [],
    };
  });
}

/**
 * 渲染教师Routes组件，并协调其数据加载、状态和交互。
 */
export function TeacherRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<TeacherLoginPage />} />
      <Route
        path="/*"
        element={
          <TeacherGuard>
            <TeacherLayout />
          </TeacherGuard>
        }
      />
    </Routes>
  );
}

/**
 * 渲染教师Guard组件，并协调其数据加载、状态和交互。
 */
function TeacherGuard({ children }: { children: ReactElement }) {
  if (!getTeacherToken()) {
    return <Navigate to="/teacher/login" replace />;
  }
  return children;
}

/**
 * 渲染教师登录页面，并协调其数据加载、状态和交互。
 */
function TeacherLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [form] = Form.useForm<{ username: string; password: string; captcha: string }>();

  useEffect(() => {
    const username = searchParams.get('username');
    if (username) {
      form.setFieldValue('username', username);
    }
  }, [form, searchParams]);

  /**
   * 读取Captcha并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function loadCaptcha() {
    try {
      const response = await fetch('/api/v1/captcha/image');
      const body = await response.json();
      if (body.code === 200) {
        setCaptchaId(body.data.captchaId);
        setCaptchaImage(body.data.image);
      }
    } catch { /* ignore */ }
  }

  useEffect(() => { loadCaptcha(); }, []);

  /**
   * 创建或提交目标数据。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
  async function submit(values: { username: string; password: string; captcha: string }) {
    if (!captchaId) {
      Message.warning('验证码未加载，请点击刷新');
      return;
    }
    setLoading(true);
    try {
      await teacherLogin(values.username, values.password, captchaId, values.captcha);
      Message.success('登录成功');
      navigate('/teacher/dashboard', { replace: true });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '登录失败');
      loadCaptcha();
      form.setFieldValue('captcha', '');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: '#f3f6fb' }}>
      <Card style={{ width: '100%', maxWidth: 420 }} title="教师端登录">
        <Form
          form={form}
          onSubmit={submit}
          labelCol={{ span: 5 }}
          wrapperCol={{ span: 19 }}
          labelAlign="left"
          requiredSymbol={false}
        >
          <FormItem field="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="教师用户名" />
          </FormItem>
          <FormItem field="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="密码" />
          </FormItem>
          <FormItem field="captcha" label="验证码" rules={[{ required: true, message: '请输入验证码' }]}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Input
                placeholder="验证码"
                maxLength={4}
                style={{ flex: 1 }}
                onChange={(v) => form.setFieldValue('captcha', v)}
              />
              {captchaImage ? (
                <img
                  src={captchaImage}
                  alt="验证码"
                  onClick={loadCaptcha}
                  title="点击刷新验证码"
                  style={{ height: 36, borderRadius: 6, cursor: 'pointer', border: '1px solid #e5e8ef', flexShrink: 0 }}
                />
              ) : (
                <Button size="small" onClick={loadCaptcha} style={{ flexShrink: 0 }}>刷新</Button>
              )}
            </div>
          </FormItem>
          <Button type="primary" htmlType="submit" long loading={loading}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}

/**
 * 渲染教师Layout组件，并协调其数据加载、状态和交互。
 */
function TeacherLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [siteLogo, setSiteLogo] = useState('');
  const [siteTitle, setSiteTitle] = useState('');

  useEffect(() => {
    teacherGet<TeacherMe>('/api/teacher/v1/me').then(setMe).catch(() => null);
    fetch('/api/v1/settings/frontend')
      .then((res) => res.json())
      .then((body) => {
        if (body?.code === 200) {
          setSiteTitle(body.data?.siteTitle || '');
          setSiteLogo(body.data?.siteLogo || '');
        }
      })
      .catch(() => {});
  }, []);

  /**
   * 封装selected相关逻辑。对原始数据进行派生或聚合。
   */
  const selected = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/teacher/classes')) return ['/teacher/classes'];
    if (path.startsWith('/teacher/students')) return ['/teacher/students'];
    if (path.startsWith('/teacher/import')) return ['/teacher/import'];
    if (path.startsWith('/teacher/applications')) return ['/teacher/applications'];
    if (path.startsWith('/teacher/submissions')) return ['/teacher/submissions'];
    if (path.startsWith('/teacher/stats')) return ['/teacher/stats'];
    if (path.startsWith('/teacher/problems')) return ['/teacher/problems'];
    if (path.startsWith('/teacher/problem-folders')) return ['/teacher/problem-folders'];
    if (path.startsWith('/teacher/practices/submissions')) return ['/teacher/practices/submissions'];
    if (path.startsWith('/teacher/practices')) return ['/teacher/practices'];
    if (path.startsWith('/teacher/contests')) return ['/teacher/contests'];
    if (path.startsWith('/teacher/profile')) return ['/teacher/profile'];
    return ['/teacher/dashboard'];
  }, [location.pathname]);

  /**
   * 封装默认值OpenKeys相关逻辑。对原始数据进行派生或聚合。
   */
  const defaultOpenKeys = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/teacher/problems') || path.startsWith('/teacher/problem-folders')) {
      return ['problems-menu'];
    }
    if (path.startsWith('/teacher/practices')) {
      return ['practices-menu'];
    }
    if (path.startsWith('/teacher/students') || path.startsWith('/teacher/import') || path.startsWith('/teacher/applications')) {
      return ['students-menu'];
    }
    return [];
  }, [location.pathname]);

  /**
   * 封装退出登录相关逻辑。包含异步流程并由调用方处理完成或失败状态；可能改变当前路由或查询参数。
   */
  async function logout() {
    await teacherLogout().catch(() => null);
    navigate('/teacher/login', { replace: true });
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #e5e8ef' }}>
        <div
          style={{
            height: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 20px',
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          {siteLogo ? (
            <>
              <img
                src={siteLogo}
                alt={siteTitle || '教师工作台'}
                style={{ height: 36, maxHeight: 36, maxWidth: 36, objectFit: 'contain', borderRadius: 6 }}
              />
              <span>{siteTitle || '教师工作台'}</span>
            </>
          ) : (
            '教师工作台'
          )}
        </div>
        <Menu selectedKeys={selected} defaultOpenKeys={defaultOpenKeys} onClickMenuItem={(key) => navigate(key)}>
          <Menu.Item key="/teacher/dashboard"><IconDashboard />首页</Menu.Item>
          <Menu.Item key="/teacher/classes"><IconUserGroup />班级管理</Menu.Item>
          <Menu.SubMenu key="students-menu" title={<><IconUserGroup />学生管理</>}>
            <Menu.Item key="/teacher/students">学生列表</Menu.Item>
            <Menu.Item key="/teacher/import">导入学生</Menu.Item>
            <Menu.Item key="/teacher/applications">加入申请</Menu.Item>
          </Menu.SubMenu>
          <Menu.Item key="/teacher/submissions"><IconCode />提交记录</Menu.Item>
          <Menu.Item key="/teacher/stats"><IconApps />练习统计</Menu.Item>
          <Menu.SubMenu key="problems-menu" title={<><IconBook />题目管理</>}>
            <Menu.Item key="/teacher/problems">题目列表</Menu.Item>
            <Menu.Item key="/teacher/problem-folders">题目文件夹</Menu.Item>
          </Menu.SubMenu>
          <Menu.SubMenu key="practices-menu" title={<><IconFile />题单管理</>}>
            <Menu.Item key="/teacher/practices">题单列表</Menu.Item>
            <Menu.Item key="/teacher/practices/submissions">提交记录</Menu.Item>
          </Menu.SubMenu>
          <Menu.Item key="/teacher/contests"><IconCalendar />比赛管理</Menu.Item>
          <Menu.Item key="/teacher/profile"><IconUser />个人信息</Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header
          style={{
            height: 60,
            background: '#fff',
            borderBottom: '1px solid #e5e8ef',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
            padding: '0 20px',
            boxShadow: '0 1px 0 rgba(17, 24, 39, 0.02)',
          }}
        >
          <Typography.Text
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 16,
              lineHeight: '24px',
              color: '#1d2129',
              fontWeight: 500,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
            }}
          >
            {me?.displayName || me?.username || '-'}
          </Typography.Text>
          <Button icon={<IconPoweroff />} onClick={() => { void logout(); }} style={{ height: 32, padding: '0 15px', flex: '0 0 auto' }}>
            退出登录
          </Button>
        </Header>
        <Content style={{ padding: 24 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/teacher/dashboard" replace />} />
            <Route path="/dashboard" element={<TeacherDashboardPage />} />
            <Route path="/classes" element={<TeacherClasses />} />
            <Route path="/students" element={<TeacherStudents />} />
            <Route path="/import" element={<TeacherImport />} />
            <Route path="/applications" element={<TeacherApplications />} />
            <Route path="/submissions" element={<TeacherSubmissions />} />
            <Route path="/stats" element={<TeacherPracticeStats />} />
            <Route path="/practices/submissions" element={<TeacherPracticeSubmissions />} />
            <Route path="/problems" element={<TeacherProblemListPage />} />
            <Route path="/problems/new" element={<TeacherProblemCreatePage />} />
            <Route path="/problems/:problemId/edit" element={<TeacherProblemCreatePage />} />
            <Route path="/problems/:problemId/test-cases" element={<TeacherProblemCreatePage />} />
            <Route path="/problem-folders" element={<TeacherProblemFolderPage />} />
            <Route path="/problem-folders/new" element={<TeacherProblemFolderPage />} />
            <Route path="/problem-folders/:folderId" element={<TeacherProblemFolderPage />} />
            <Route path="/practices" element={<TeacherPracticeListPage />} />
            <Route path="/practices/new" element={<TeacherPracticeCreatePage />} />
            <Route path="/practices/:practiceId/publish" element={<PracticePublishPage variant="teacher" />} />
            <Route path="/practices/publications/:publicationId/edit" element={<PracticePublishPage variant="teacher" />} />
            <Route path="/practices/:practiceId/edit" element={<TeacherPracticeCreatePage />} />
            <Route path="/practices/:practiceId/report" element={<TeacherPracticeReportPage />} />
            <Route path="/contests" element={<TeacherContestListPage />} />
            <Route path="/contests/new" element={<TeacherContestCreatePage />} />
            <Route path="/contests/:contestId/edit" element={<TeacherContestCreatePage />} />
            <Route path="/contests/:contestId" element={<TeacherContestDetailPage />} />
            <Route path="/profile" element={<TeacherProfilePage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

/**
 * 渲染教师Classes组件，并协调其数据加载、状态和交互。
 */
function TeacherClasses() {
  const [rows, setRows] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<TeacherClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeacherClass | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [form] = Form.useForm<{ name: string; description?: string; joinEnabled: boolean; approvalRequired: boolean }>();

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const load = async () => {
    setLoading(true);
    try {
      setRows(await teacherGet<TeacherClass[]>('/api/teacher/v1/classes'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  /**
   * 封装openCreate相关逻辑。会更新 React 状态并触发重新渲染。
   */
  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ joinEnabled: true, approvalRequired: true });
    setModalVisible(true);
  }

  /**
   * 封装openEdit相关逻辑。会更新 React 状态并触发重新渲染。
   */
  function openEdit(row: TeacherClass) {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      description: row.description || '',
      joinEnabled: row.joinEnabled,
      approvalRequired: row.approvalRequired,
    });
    setModalVisible(true);
  }

  /**
   * 创建或提交目标数据。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function submit(values: { name: string; description?: string; joinEnabled: boolean; approvalRequired: boolean }) {
    try {
      if (editing) {
        await teacherPut(`/api/teacher/v1/classes/${editing.id}`, values);
        Message.success('班级已更新');
      } else {
        await teacherPost('/api/teacher/v1/classes', values);
        Message.success('班级已创建');
      }
      setModalVisible(false);
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '保存失败');
    }
  }

  /**
   * 封装openDelete相关逻辑。会更新 React 状态并触发重新渲染。
   */
  function openDelete(row: TeacherClass) {
    setDeleteTarget(row);
    setDeletePassword('');
  }

  /**
   * 封装confirmDelete相关逻辑。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function confirmDelete() {
    if (!deleteTarget || !deletePassword) return;
    setDeleting(true);
    try {
      await teacherPost(`/api/teacher/v1/classes/${deleteTarget.id}/delete`, { password: deletePassword });
      Message.success('班级已删除');
      setDeleteTarget(null);
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card title="班级管理" extra={<Button type="primary" icon={<IconPlus />} onClick={openCreate}>创建班级</Button>}>
      <Table
        rowKey="id"
        loading={loading}
        data={rows}
        columns={[
          { title: '班级ID', dataIndex: 'id', width: 120 },
          { title: '班级名称', dataIndex: 'name' },
          { title: '人数', dataIndex: 'memberCount', width: 100 },
          { title: '加入', dataIndex: 'joinEnabled', width: 110, render: (v) => <Tag color={v ? 'green' : 'gray'}>{v ? '开启' : '关闭'}</Tag> },
          { title: '审核', dataIndex: 'approvalRequired', width: 110, render: (v) => <Tag color={v ? 'orange' : 'green'}>{v ? '需要' : '自动'}</Tag> },
          { title: '创建时间', dataIndex: 'createdAt', width: 190, render: formatDate },
          { title: '操作', width: 150, align: 'center',
            render: (_: unknown, row: TeacherClass) => (
              <Space size={4}>
                <Button size="mini" onClick={() => openEdit(row)}>编辑</Button>
                <Button size="mini" status="danger" onClick={() => openDelete(row)}>删除</Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal title={editing ? '编辑班级' : '创建班级'} visible={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()}>
        <Form form={form} onSubmit={submit} labelCol={{ span: 6 }} wrapperCol={{ span: 18 }} requiredSymbol={false}>
          <FormItem field="name" label="班级名称" rules={[{ required: true, message: '请输入班级名称' }]}><Input /></FormItem>
          <FormItem field="description" label="介绍"><Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} /></FormItem>
          <FormItem field="joinEnabled" label="允许加入" triggerPropName="checked"><Switch checkedText="开启" uncheckedText="关闭" /></FormItem>
          <FormItem field="approvalRequired" label="加入审核" triggerPropName="checked"><Switch checkedText="需要" uncheckedText="自动" /></FormItem>
        </Form>
      </Modal>
      <Modal
        title="删除班级"
        visible={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onOk={confirmDelete}
        confirmLoading={deleting}
        okText="确认删除"
        okButtonProps={{ status: 'danger' }}
      >
        <Typography.Text>将删除班级「{deleteTarget?.name}」及其所有关联数据。</Typography.Text>
        <div style={{ marginTop: 12 }}>
          <Input.Password
            placeholder="请输入您的密码确认"
            value={deletePassword}
            onChange={setDeletePassword}
          />
        </div>
      </Modal>
    </Card>
  );
}


/**
 * 渲染教师Students组件，并协调其数据加载、状态和交互。
 */
function TeacherStudents() {
  const [rows, setRows] = useState<TeacherStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [quotaMap, setQuotaMap] = useState<Record<number, { used: number; remaining: number }>>({});
  const [filterName, setFilterName] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterQuota, setFilterQuota] = useState<'all' | 'has' | 'none'>('all');
  const [editStudent, setEditStudent] = useState<TeacherStudent | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<TeacherStudent | null>(null);
  const [updating, setUpdating] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<TeacherStudentDetail | null>(null);
  const [detailSubmissions, setDetailSubmissions] = useState<TeacherSubmission[]>([]);
  const [detailSubmissionTotal, setDetailSubmissionTotal] = useState(0);
  const [detailSubmissionPage, setDetailSubmissionPage] = useState(1);
  const [detailSubmissionLoading, setDetailSubmissionLoading] = useState(false);
  const [editForm] = Form.useForm<{ displayName: string; studentNo: string; email: string; password: string }>();

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const load = async () => {
    setLoading(true);
    try {
      setRows(await teacherGet<TeacherStudent[]>('/api/teacher/v1/students'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (rows.length > 0) {
      const map: Record<number, { used: number; remaining: number }> = {};
      Promise.all(rows.map(async (r) => {
        try {
          const q = await teacherGet<{ used: number; remaining: number }>(`/api/admin/v1/agent/quota/${r.userId}`);
          map[r.userId] = q;
        } catch {
          map[r.userId] = { used: 0, remaining: 5 };
        }
      })).then(() => setQuotaMap({ ...map }));
    }
  }, [rows]);

  /**
   * 封装filtered相关逻辑。对原始数据进行派生或聚合。
   */
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterName && !(r.displayName || '').includes(filterName) && !(r.username || '').includes(filterName)) return false;
      if (filterClass && !(r.className || '').includes(filterClass)) return false;
      if (filterQuota !== 'all') {
        const q = quotaMap[r.userId];
        const remaining = q?.remaining ?? 5;
        if (filterQuota === 'has' && remaining <= 0) return false;
        if (filterQuota === 'none' && remaining > 0) return false;
      }
      return true;
    });
  }, [rows, filterName, filterClass, filterQuota, quotaMap]);

  /**
   * 封装openEdit相关逻辑。会更新 React 状态并触发重新渲染。
   */
  function openEdit(student: TeacherStudent) {
    setEditStudent(student);
    editForm.setFieldsValue({
      displayName: student.displayName || '',
      studentNo: student.studentNo || '',
      email: student.email || '',
      password: '',
    });
  }

  /**
   * 创建或提交Edit。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function submitEdit(values: { displayName: string; studentNo: string; email: string; password: string }) {
    if (!editStudent) return;
    setUpdating(true);
    try {
      const body: Record<string, string> = {};
      if (values.displayName.trim()) body.displayName = values.displayName.trim();
      if (values.studentNo.trim()) body.studentNo = values.studentNo.trim();
      if (values.email.trim()) body.email = values.email.trim();
      if (values.password?.trim()) body.password = values.password;
      await teacherPut(`/api/teacher/v1/students/${editStudent.userId}`, body);
      Message.success('学生信息已更新');
      setEditStudent(null);
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '更新失败');
    } finally {
      setUpdating(false);
    }
  }

  /**
   * 读取Student详情并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function loadStudentDetail(userId: number) {
    setDetailLoading(true);
    try {
      setViewingStudent(await teacherGet<TeacherStudentDetail>(`/api/teacher/v1/students/${userId}`));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '学生详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  }

  /**
   * 读取StudentSubmissions并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function loadStudentSubmissions(userId: number, nextPage = detailSubmissionPage) {
    setDetailSubmissionLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: '10',
        userId: String(userId),
        sortBy: 'submitTime',
        sortOrder: 'desc',
      });
      const result = await teacherGet<PageResult<TeacherSubmission>>(`/api/teacher/v1/submissions?${params.toString()}`);
      setDetailSubmissions(result.list || []);
      setDetailSubmissionTotal(result.total || 0);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '最近提交记录加载失败');
    } finally {
      setDetailSubmissionLoading(false);
    }
  }

  /**
   * 封装openView相关逻辑。会更新 React 状态并触发重新渲染。
   */
  function openView(student: TeacherStudent) {
    setViewingStudent({
      id: student.userId,
      username: student.username,
      displayName: student.displayName,
      avatarUrl: student.avatarUrl,
      studentNo: student.studentNo,
      email: student.email,
      role: 'STUDENT',
      className: student.className,
    });
    setDetailSubmissions([]);
    setDetailSubmissionTotal(0);
    setDetailSubmissionPage(1);
    setDetailVisible(true);
    loadStudentDetail(student.userId);
    loadStudentSubmissions(student.userId, 1);
  }

  /**
   * 封装confirmDelete相关逻辑。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function confirmDelete() {
    if (!deleteStudent || !deleteStudent.classId) return;
    try {
      await teacherDelete(`/api/teacher/v1/classes/${deleteStudent.classId}/students/${deleteStudent.userId}`);
      Message.success('学生已移除');
      setDeleteStudent(null);
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    }
  }

  return (
    <Card title="学生列表">
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          style={{ width: 160 }}
          placeholder="姓名/用户名"
          prefix={<IconSearch />}
          value={filterName}
          onChange={setFilterName}
          allowClear
        />
        <Input
          style={{ width: 160 }}
          placeholder="班级"
          prefix={<IconSearch />}
          value={filterClass}
          onChange={setFilterClass}
          allowClear
        />
        <Select
          style={{ width: 140 }}
          placeholder="AI额度"
          value={filterQuota}
          onChange={(v) => setFilterQuota(v)}
        >
          <Option value="all">全部</Option>
          <Option value="has">有额度</Option>
          <Option value="none">无额度</Option>
        </Select>
      </Space>
      <Table
        rowKey="userId"
        loading={loading}
        data={filtered}
        scroll={{ x: '100%' }}
        columns={[
          { title: '用户ID', dataIndex: 'userId', width: 70 },
          { title: '用户名', dataIndex: 'username', width: 110, ellipsis: true, render: (v: string) => v || '-' },
          { title: '姓名', dataIndex: 'displayName', width: 90, ellipsis: true, render: (v: string) => v || '-' },
          { title: '班级', dataIndex: 'className', width: 120, ellipsis: true, render: (v: string | null) => v || '-' },
          { title: '学号', dataIndex: 'studentNo', width: 110, ellipsis: true, render: (v: string) => v || '-' },
          { title: '邮箱', dataIndex: 'email', width: 170, ellipsis: true, render: (v: string) => v || '-' },
          { title: 'AI额度', width: 80, align: 'center', render: (_: unknown, row: TeacherStudent) => {
            const q = quotaMap[row.userId];
            if (!q) return '-';
            return <Tag color={q.remaining > 0 ? 'green' : 'red'}>{q.remaining}/{q.remaining + q.used}</Tag>;
          }},
          {
            title: '操作', width: 190, align: 'center',
            render: (_: unknown, row: TeacherStudent) => (
              <Space size={2}>
                <Button size="mini" icon={<IconUser />} onClick={() => openView(row)}>查看</Button>
                <Button size="mini" icon={<IconEdit />} onClick={() => openEdit(row)}>编辑</Button>
                <Popconfirm title="确定从班级中移除该学生吗？" onOk={() => confirmDelete()}>
                  <Button size="mini" status="danger" icon={<IconDelete />} onClick={() => setDeleteStudent(row)}>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      {/* 编辑弹窗 */}
      <Modal
        title="编辑学生"
        visible={!!editStudent}
        onCancel={() => setEditStudent(null)}
        onOk={() => editForm.submit()}
        confirmLoading={updating}
      >
        <Form form={editForm} layout="vertical" onSubmit={submitEdit} requiredSymbol={false}>
          <FormItem label="姓名" field="displayName">
            <Input placeholder="留空不修改" maxLength={50} />
          </FormItem>
          <FormItem label="学号" field="studentNo">
            <Input placeholder="留空不修改" maxLength={50} />
          </FormItem>
          <FormItem label="邮箱" field="email">
            <Input placeholder="留空不修改" maxLength={100} />
          </FormItem>
          <FormItem
            label="密码"
            field="password"
            rules={[{ minLength: 6, message: '密码长度至少 6 位' }]}
          >
            <Input.Password placeholder="留空不修改密码" maxLength={64} />
          </FormItem>
        </Form>
      </Modal>

      <Modal
        title="查看学生"
        visible={detailVisible}
        footer={null}
        onCancel={() => setDetailVisible(false)}
        style={{ width: 1000 }}
      >
        <Card title="个人信息" loading={detailLoading} style={{ marginBottom: 16 }}>
          {viewingStudent ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                {renderStudentAvatar(viewingStudent, 72)}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{viewingStudent.displayName || '-'}</div>
                  <div style={{ color: 'var(--color-text-3)' }}>@{viewingStudent.username}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 24px' }}>
                <div><b>ID：</b>{viewingStudent.id}</div>
                <div><b>用户名：</b>{dash(viewingStudent.username)}</div>
                <div><b>显示名称：</b>{dash(viewingStudent.displayName)}</div>
                <div><b>角色：</b>{roleText(viewingStudent.role)}</div>
                <div><b>学号：</b>{dash(viewingStudent.studentNo)}</div>
                <div><b>邮箱：</b>{dash(viewingStudent.email)}</div>
                <div><b>班级：</b>{dash(viewingStudent.className)}</div>
                <div>
                  <b>AI 额度：</b>
                  {quotaMap[viewingStudent.id]
                    ? `${quotaMap[viewingStudent.id].remaining}/${quotaMap[viewingStudent.id].remaining + quotaMap[viewingStudent.id].used}`
                    : '-'}
                </div>
                <div><b>头像地址：</b>{viewingStudent.avatarUrl ? <a href={viewingStudent.avatarUrl} target="_blank" rel="noopener noreferrer">查看头像</a> : '-'}</div>
                <div><b>创建时间：</b>{formatDate(viewingStudent.createdAt)}</div>
                <div><b>更新时间：</b>{formatDate(viewingStudent.updatedAt)}</div>
              </div>
            </div>
          ) : null}
        </Card>

        <Card title="最近提交记录">
          <Table
            rowKey="id"
            loading={detailSubmissionLoading}
            data={detailSubmissions}
            pagination={{
              total: detailSubmissionTotal,
              current: detailSubmissionPage,
              pageSize: 10,
              onChange: (nextPage) => {
                setDetailSubmissionPage(nextPage);
                if (viewingStudent) loadStudentSubmissions(viewingStudent.id, nextPage);
              },
              showTotal: true,
            }}
            columns={[
              { title: '提交ID', dataIndex: 'id', width: 90, align: 'center' },
              { title: '题目', dataIndex: 'problemTitle', render: (value) => dash(value) },
              { title: '语言', dataIndex: 'language', width: 100, align: 'center', render: (value) => dash(value) },
              {
                title: '状态',
                dataIndex: 'status',
                width: 110,
                align: 'center',
                render: (value) => value ? statusTag(value) : '-',
              },
              { title: '分数', dataIndex: 'score', width: 90, align: 'center', render: (value) => dash(value) },
              { title: '时间', dataIndex: 'timeUsed', width: 100, align: 'center', render: (value) => value == null ? '-' : `${value} ms` },
              { title: '内存', dataIndex: 'memoryUsed', width: 110, align: 'center', render: (value) => value == null ? '-' : `${value} KB` },
              { title: '提交时间', dataIndex: 'submitTime', width: 180, render: (value) => formatDate(value) },
            ]}
          />
        </Card>
      </Modal>
    </Card>
  );
}

/**
 * 渲染教师Import组件，并协调其数据加载、状态和交互。
 */
function TeacherImport() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm<{ classId: number; studentNoField: string; nameField: string }>();

  useEffect(() => {
    teacherGet<TeacherClass[]>('/api/teacher/v1/classes').then(setClasses).catch(() => null);
    form.setFieldsValue({
      studentNoField: '学号',
      nameField: '姓名',
    });
  }, []);

  /**
   * 处理FileChange。会更新 React 状态并触发重新渲染。
   */
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.xlsx')) {
      Message.error('仅支持 csv、xls、xlsx 文件');
      event.target.value = '';
      return;
    }
    setSelectedFile(file);
    setResult(null);
    Message.success('文件已选择');
    event.target.value = '';
  }

  /**
   * 创建或提交目标数据。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function submit(values: { classId: number; studentNoField: string; nameField: string }) {
    if (!selectedFile) {
      Message.warning('请选择 csv、xls 或 xlsx 文件');
      return;
    }
    try {
      setImporting(true);
      setResult(await teacherImportStudentsFile({
        classId: Number(values.classId),
        studentNoField: values.studentNoField,
        nameField: values.nameField,
        file: selectedFile,
      }));
      Message.success('导入完成');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '导入失败');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title="导入学生">
        <Form form={form} onSubmit={submit} layout="vertical" requiredSymbol={false}>
          <Alert
            type="info"
            showIcon
            content="导入文件仅支持 .csv、.xls、.xlsx。首行必须是表头，必需字段为“学号”和“姓名”；其他列会保存为学生扩展资料，不导入邮箱和手机号。"
            style={{ marginBottom: 16 }}
          />
          <FormItem field="classId" label="目标班级" rules={[{ required: true, message: '请选择班级' }]}>
            <Select placeholder="选择班级">{classes.map((item) => <Option key={item.id} value={item.id}>{item.name}（{item.id}）</Option>)}</Select>
          </FormItem>
          <FormItem label="导入文件" required>
            <Space>
              <input type="file" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} />
              {selectedFile && <Tag color="blue">{selectedFile.name}</Tag>}
            </Space>
          </FormItem>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormItem field="studentNoField" label="学号字段" rules={[{ required: true, message: '请输入学号字段' }]}><Input /></FormItem>
            <FormItem field="nameField" label="姓名字段" rules={[{ required: true, message: '请输入姓名字段' }]}><Input /></FormItem>
          </div>
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            示例表头：学号,姓名,专业,备注
          </Typography.Paragraph>
          <Button type="primary" icon={<IconImport />} loading={importing} onClick={() => form.submit()}>开始导入</Button>
        </Form>
      </Card>
      {result && (
        <Card title="导入结果">
          <Space>
            <Tag color="green">成功 {result.successCount}</Tag>
            <Tag color="red">失败 {result.failureCount}</Tag>
          </Space>
          <Typography.Title heading={6} style={{ margin: '16px 0 8px' }}>
            成功导入
          </Typography.Title>
          <Table
            rowKey="rowNumber"
            data={result.successes || []}
            pagination={false}
            columns={[
              { title: '行号', dataIndex: 'rowNumber', width: 100 },
              { title: '学号', dataIndex: 'studentNo', width: 160 },
              { title: '姓名', dataIndex: 'displayName' },
            ]}
          />
          {result.errors.length > 0 && (
            <>
              <Typography.Title heading={6} style={{ margin: '16px 0 8px' }}>
                失败明细
              </Typography.Title>
              <Table
                rowKey="rowNumber"
                data={result.errors}
                pagination={false}
                columns={[
                  { title: '行号', dataIndex: 'rowNumber', width: 100 },
                  { title: '学号', dataIndex: 'studentNo', width: 160 },
                  { title: '原因', dataIndex: 'reason' },
                ]}
              />
            </>
          )}
        </Card>
      )}
    </Space>
  );
}

/**
 * 渲染教师Applications组件，并协调其数据加载、状态和交互。
 */
function TeacherApplications() {
  const [rows, setRows] = useState<TeacherApplication[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const load = async () => setRows(await teacherGet<TeacherApplication[]>('/api/teacher/v1/applications'));
  useEffect(() => { load().catch(() => null); }, []);
  /**
   * 处理当前流程。包含异步流程并由调用方处理完成或失败状态。
   */
  async function handle(id: number, action: 'approve' | 'reject') {
    try {
      await teacherPost(`/api/teacher/v1/applications/${id}/${action}`);
      Message.success(action === 'approve' ? '已通过' : '已拒绝');
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '操作失败');
    }
  }
  /**
   * 封装approveAll相关逻辑。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function approveAll() {
    const pending = rows.filter((r) => r.status === 'PENDING');
    if (pending.length === 0) {
      Message.info('没有待审核的申请');
      return;
    }
    setBatchLoading(true);
    let success = 0;
    let fail = 0;
    for (const app of pending) {
      try {
        await teacherPost(`/api/teacher/v1/applications/${app.id}/approve`);
        success++;
      } catch {
        fail++;
      }
    }
    setBatchLoading(false);
    Message.success(`批量批准完成：成功 ${success}，失败 ${fail}`);
    load();
  }
  const pendingCount = rows.filter((r) => r.status === 'PENDING').length;
  return (
    <Card
      title="加入申请"
      extra={
        <Button type="primary" loading={batchLoading} disabled={pendingCount === 0} onClick={approveAll}>
          一键批准全部 ({pendingCount})
        </Button>
      }
    >
      <Table
        rowKey="id"
        data={rows}
        columns={[
          { title: '班级', dataIndex: 'className', width: 180 },
          { title: '学生', dataIndex: 'displayName', width: 150 },
          { title: '学号', dataIndex: 'studentNo', width: 150 },
          { title: '状态', dataIndex: 'status', width: 120, render: statusTag },
          { title: '备注', dataIndex: 'reason' },
          { title: '申请时间', dataIndex: 'createdAt', width: 190, render: formatDate },
          {
            title: '操作',
            width: 170,
            render: (_: unknown, row: TeacherApplication) => row.status === 'PENDING' ? (
              <Space>
                <Button size="mini" type="primary" onClick={() => handle(row.id, 'approve')}>通过</Button>
                <Button size="mini" status="danger" onClick={() => handle(row.id, 'reject')}>拒绝</Button>
              </Space>
            ) : '-',
          },
        ]}
      />
    </Card>
  );
}

/**
 * 渲染教师Submissions组件，并协调其数据加载、状态和交互。
 */
function TeacherSubmissions() {
  const [rows, setRows] = useState<TeacherSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [filters, setFilters] = useState({
    classId: '',
    keyword: '',
    language: '',
    status: '',
    from: '',
    to: '',
  });

  useEffect(() => {
    teacherGet<TeacherClass[]>('/api/teacher/v1/classes').then(setClasses).catch(() => {});
  }, []);

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '50',
        sortBy: 'submitTime',
        sortOrder: 'desc',
      });
      if (filters.language) params.set('language', filters.language);
      if (filters.status) params.set('status', filters.status);
      if (filters.from) params.set('from', `${filters.from}T00:00:00`);
      if (filters.to) params.set('to', `${filters.to}T23:59:59`);
      const result = await teacherGet<PageResult<TeacherSubmission>>(`/api/teacher/v1/submissions?${params.toString()}`);
      let list = result.list;
      if (filters.keyword.trim()) {
        const kw = filters.keyword.trim().toLowerCase();
        list = list.filter((s) =>
          (s.displayName || '').toLowerCase().includes(kw) ||
          (s.problemTitle || '').toLowerCase().includes(kw) ||
          String(s.id).includes(kw)
        );
      }
      setRows(list);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, filters]);

  /**
   * 更新Filter。会更新 React 状态并触发重新渲染。
   */
  function updateFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card bordered={false} title="筛选条件">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Input
            style={{ width: 200 }}
            placeholder="搜索学生/题目/ID"
            prefix={<IconSearch />}
            value={filters.keyword}
            onChange={(val) => updateFilter('keyword', val)}
          />
          <Select
            style={{ width: 140 }}
            placeholder="班级"
            allowClear
            value={filters.classId || undefined}
            onChange={(val) => updateFilter('classId', val || '')}
          >
            {classes.map((c) => <Option key={c.id} value={String(c.id)}>{c.name}</Option>)}
          </Select>
          <Select
            style={{ width: 120 }}
            placeholder="语言"
            allowClear
            value={filters.language || undefined}
            onChange={(val) => updateFilter('language', val || '')}
          >
            <Option value="C">C</Option>
            <Option value="C++">C++</Option>
            <Option value="Python">Python</Option>
            <Option value="Java">Java</Option>
          </Select>
          <Select
            style={{ width: 120 }}
            placeholder="状态"
            allowClear
            value={filters.status || undefined}
            onChange={(val) => updateFilter('status', val || '')}
          >
            <Option value="AC">AC</Option>
            <Option value="WA">WA</Option>
            <Option value="TLE">TLE</Option>
            <Option value="MLE">MLE</Option>
            <Option value="RE">RE</Option>
            <Option value="CE">CE</Option>
          </Select>
          <Input
            type="date"
            style={{ width: 150 }}
            value={filters.from}
            onChange={(val) => updateFilter('from', val)}
          />
          <Input
            type="date"
            style={{ width: 150 }}
            value={filters.to}
            onChange={(val) => updateFilter('to', val)}
          />
          <Button onClick={() => { setFilters({ classId: '', keyword: '', language: '', status: '', from: '', to: '' }); setPage(1); }}>
            重置
          </Button>
        </div>
      </Card>
      <Card bordered={false} title="提交记录">
        <Table
          rowKey="id"
          loading={loading}
          data={rows}
          scroll={{ x: 820 }}
          pagination={{ current: page, pageSize: 50, total, showTotal: true, onChange: setPage }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 90 },
            { title: '学生', dataIndex: 'displayName', width: 150 },
            { title: '题目', dataIndex: 'problemTitle', width: 220 },
            { title: '题单/比赛', width: 220, render: (_: unknown, row: TeacherSubmission) => row.practiceTitle || row.contestTitle || '-' },
            { title: '语言', dataIndex: 'language', width: 100 },
            { title: '状态', dataIndex: 'status', width: 120, render: statusTag },
            { title: '提交时间', dataIndex: 'submitTime', width: 190, render: formatDate },
          ]}
        />
      </Card>
    </Space>
  );
}

/**
 * 渲染教师练习Stats组件，并协调其数据加载、状态和交互。
 */
function TeacherPracticeStats() {
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [submissions, setSubmissions] = useState<TeacherSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const load = async () => {
    setLoading(true);
    try {
      const [studentResult, submissionResult] = await Promise.all([
        teacherGet<TeacherStudent[]>('/api/teacher/v1/students'),
        teacherGet<PageResult<TeacherSubmission>>('/api/teacher/v1/submissions?page=1&pageSize=1000&sortBy=submitTime&sortOrder=desc'),
      ]);
      setStudents(studentResult);
      setSubmissions(submissionResult.list);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '统计数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /**
   * 封装rows相关逻辑。对原始数据进行派生或聚合。
   */
  const rows = useMemo(() => {
    const practiceSubmissions = submissions.filter((submission) => submission.practiceTitle);
    const grouped = new Map<number, {
      userId: number;
      username?: string | null;
      displayName?: string | null;
      studentNo?: string | null;
      submitCount: number;
      acceptedCount: number;
      practiceSubmitCount: number;
      contestSubmitCount: number;
      lastSubmitTime?: string | null;
    }>();

    students.forEach((student) => {
      grouped.set(student.userId, {
        userId: student.userId,
        username: student.username,
        displayName: student.displayName,
        studentNo: student.studentNo,
        submitCount: 0,
        acceptedCount: 0,
        practiceSubmitCount: 0,
        contestSubmitCount: 0,
        lastSubmitTime: null,
      });
    });

    practiceSubmissions.forEach((submission) => {
      const item = grouped.get(submission.userId) ?? {
        userId: submission.userId,
        username: submission.username,
        displayName: submission.displayName,
        studentNo: null,
        submitCount: 0,
        acceptedCount: 0,
        practiceSubmitCount: 0,
        contestSubmitCount: 0,
        lastSubmitTime: null,
      };
      item.submitCount += 1;
      if (submission.status === 'AC' || submission.status === 'ACCEPTED') {
        item.acceptedCount += 1;
      }
      item.practiceSubmitCount += 1;
      if (!item.lastSubmitTime || (submission.submitTime && new Date(submission.submitTime) > new Date(item.lastSubmitTime))) {
        item.lastSubmitTime = submission.submitTime;
      }
      grouped.set(submission.userId, item);
    });

    return Array.from(grouped.values()).sort((a, b) => b.acceptedCount - a.acceptedCount || b.submitCount - a.submitCount);
  }, [students, submissions]);

  return (
    <Card
      title="练习统计"
      extra={<Button icon={<IconRefresh />} onClick={load}>刷新</Button>}
    >
      <Table
        rowKey="userId"
        loading={loading}
        data={rows}
        columns={[
          { title: '学生', dataIndex: 'displayName', width: 150, render: (value: string, row) => value || row.username || '-' },
          { title: '学号', dataIndex: 'studentNo', width: 160 },
          { title: '题单提交', dataIndex: 'practiceSubmitCount', width: 120, sorter: (a, b) => a.practiceSubmitCount - b.practiceSubmitCount },
          { title: 'AC 数', dataIndex: 'acceptedCount', width: 110, sorter: (a, b) => a.acceptedCount - b.acceptedCount },
          { title: '最近提交', dataIndex: 'lastSubmitTime', width: 190, render: formatDate },
        ]}
      />
    </Card>
  );
}

/**
 * 渲染教师练习Submissions组件，并协调其数据加载、状态和交互。
 */
function TeacherPracticeSubmissions() {
  const [submissions, setSubmissions] = useState<TeacherSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [classMap, setClassMap] = useState<Record<number, string>>({});
  const [filterStudent, setFilterStudent] = useState('');
  const [filterProblem, setFilterProblem] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClass, setFilterClass] = useState('');

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const load = async () => {
    setLoading(true);
    try {
      const [submissionResult, studentResult] = await Promise.all([
        teacherGet<PageResult<TeacherSubmission>>('/api/teacher/v1/submissions?page=1&pageSize=1000&sortBy=submitTime&sortOrder=desc'),
        teacherGet<TeacherStudent[]>('/api/teacher/v1/students'),
      ]);
      setSubmissions(submissionResult.list);
      const map: Record<number, string> = {};
      studentResult.forEach((s) => { if (s.className) map[s.userId] = s.className; });
      setClassMap(map);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '提交记录加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /**
   * 封装练习Submissions相关逻辑。对原始数据进行派生或聚合。
   */
  const practiceSubmissions = useMemo(
    () => submissions
      .filter((s) => s.practiceTitle)
      .filter((s) => {
        if (filterStudent && !(s.displayName || '').includes(filterStudent) && !(s.username || '').includes(filterStudent)) return false;
        if (filterProblem && !(s.problemTitle || '').includes(filterProblem)) return false;
        if (filterLanguage && s.language !== filterLanguage) return false;
        if (filterStatus && s.status !== filterStatus) return false;
        if (filterClass) {
          const cls = classMap[s.userId] || '';
          if (!cls.includes(filterClass)) return false;
        }
        return true;
      }),
    [submissions, filterStudent, filterProblem, filterLanguage, filterStatus, filterClass, classMap],
  );

  /**
   * 封装languages相关逻辑。对原始数据进行派生或聚合。
   */
  const languages = useMemo(() => [...new Set(submissions.filter((s) => s.practiceTitle).map((s) => s.language))].sort(), [submissions]);
  /**
   * 封装statuses相关逻辑。对原始数据进行派生或聚合。
   */
  const statuses = useMemo(() => [...new Set(submissions.filter((s) => s.practiceTitle).map((s) => s.status))].sort(), [submissions]);

  return (
    <Card
      title="题单提交记录"
      extra={<Button icon={<IconRefresh />} onClick={load}>刷新</Button>}
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Input style={{ width: 130 }} placeholder="学生" prefix={<IconSearch />} value={filterStudent} onChange={setFilterStudent} allowClear />
        <Input style={{ width: 150 }} placeholder="题目" prefix={<IconSearch />} value={filterProblem} onChange={setFilterProblem} allowClear />
        <Select style={{ width: 100 }} placeholder="语言" allowClear value={filterLanguage || undefined} onChange={(v) => setFilterLanguage(v || '')}>
          {languages.map((l) => <Option key={l} value={l}>{l}</Option>)}
        </Select>
        <Select style={{ width: 100 }} placeholder="状态" allowClear value={filterStatus || undefined} onChange={(v) => setFilterStatus(v || '')}>
          {statuses.map((s) => <Option key={s} value={s}>{s}</Option>)}
        </Select>
        <Input style={{ width: 130 }} placeholder="班级" prefix={<IconSearch />} value={filterClass} onChange={setFilterClass} allowClear />
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        data={practiceSubmissions}
        scroll={{ x: '100%' }}
        columns={[
          { title: '提交ID', dataIndex: 'id', width: 90 },
          { title: '学生', dataIndex: 'displayName', width: 110, ellipsis: true, render: (v: string, row) => v || row.username || '-' },
          { title: '班级', width: 110, ellipsis: true, render: (_: unknown, row: TeacherSubmission) => classMap[row.userId] || '-' },
          { title: '题单', dataIndex: 'practiceTitle', width: 150, ellipsis: true },
          { title: '题目', dataIndex: 'problemTitle', width: 170, ellipsis: true },
          { title: '语言', dataIndex: 'language', width: 80 },
          { title: '状态', dataIndex: 'status', width: 90, render: statusTag },
          { title: '提交时间', dataIndex: 'submitTime', width: 160, render: formatDate },
        ]}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
}

/**
 * 渲染教师Problems组件，并协调其数据加载、状态和交互。
 */
function TeacherProblems() {
  const [rows, setRows] = useState<TeacherProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testCasesText, setTestCasesText] = useState('1|||1');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [form] = Form.useForm<TeacherProblemFormValues>();

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const load = async () => {
    setLoading(true);
    try {
      const result = await teacherGet<PageResult<TeacherProblem>>('/api/admin/v1/problems?page=1&pageSize=200');
      setRows(result.list);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '题目列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /**
   * 封装openCreate相关逻辑。会更新 React 状态并触发重新渲染。
   */
  function openCreate() {
    form.resetFields();
    setTags([]);
    setTagInput('');
    form.setFieldsValue({
      title: '',
      statement: '',
      inputFormat: '',
      outputFormat: '',
      timeLimit: 1000,
      memoryLimit: 256,
      tagsText: '',
      sampleInput: '',
      sampleOutput: '',
      isPublic: false,
    });
    setTestCasesText('1|||1');
    setModalVisible(true);
  }

  /**
   * 创建或提交目标数据。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function create(values: TeacherProblemFormValues) {
    let testCases: Array<{ caseNo: number; input: string; output: string }>;
    try {
      testCases = parseTestCases(testCasesText);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '测试点格式错误');
      return;
    }
    if (testCases.length === 0) {
      Message.warning('请至少添加一个测试点');
      return;
    }

    setSubmitting(true);
    try {
      const draft = await teacherPost<ProblemDraftResponse>('/api/admin/v1/problem-drafts');
      const samples = values.sampleInput || values.sampleOutput
        ? [{ input: values.sampleInput || '', output: values.sampleOutput || '', explanation: '' }]
        : [];
      await teacherPut(`/api/admin/v1/problem-drafts/${draft.draftId}/basic`, {
        title: values.title.trim(),
        statement: values.statement.trim(),
        inputFormat: values.inputFormat?.trim() || '',
        outputFormat: values.outputFormat?.trim() || '',
        timeLimit: Number(values.timeLimit || 1000),
        memoryLimit: Number(values.memoryLimit || 256),
        tags,
        isPublic: Boolean(values.isPublic),
        samples,
      });
      await teacherPut(`/api/admin/v1/problem-drafts/${draft.draftId}/test-cases`, { testCases });
      await teacherPost<TeacherProblem>(`/api/admin/v1/problem-drafts/${draft.draftId}/commit`);
      Message.success('题目已创建');
      setModalVisible(false);
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '创建题目失败');
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 删除目标数据。包含异步流程并由调用方处理完成或失败状态。
   */
  async function remove(id: number) {
    try {
      await teacherDelete<void>(`/api/admin/v1/problems/${id}`);
      Message.success('题目已删除');
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除题目失败');
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title="题目管理"
        extra={
          <Space>
            <Button icon={<IconRefresh />} onClick={load}>刷新</Button>
            <Button type="primary" icon={<IconPlus />} onClick={openCreate}>创建题目</Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          data={rows}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 90 },
            {
              title: '题目',
              dataIndex: 'title',
              render: (title: string, row: TeacherProblem) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text bold>{title}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {row.timeLimit ?? '-'}ms / {row.memoryLimit ?? '-'}MB · {row.testCaseCount ?? 0} 个测试点
                  </Typography.Text>
                </Space>
              ),
            },
            {
              title: '可见',
              dataIndex: 'isPublic',
              width: 100,
              render: (value: boolean) => <Tag color={value ? 'green' : 'orange'}>{value ? '公开' : '仅自己'}</Tag>,
            },
            { title: '创建时间', dataIndex: 'createdAt', width: 190, render: formatDate },
            {
              title: '操作',
              width: 120,
              render: (_: unknown, row: TeacherProblem) => (
                <Popconfirm title="确认删除该题目？" onOk={() => remove(row.id)}>
                  <Button size="mini" status="danger" icon={<IconDelete />}>删除</Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="创建题目"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okButtonProps={{ loading: submitting }}
        style={{ width: 760 }}
      >
        <Form form={form} layout="vertical" onSubmit={create} requiredSymbol={false}>
          <FormItem field="title" label="题目名称" rules={[{ required: true, message: '请输入题目名称' }]}>
            <Input />
          </FormItem>
          <FormItem field="statement" label="题目描述" rules={[{ required: true, message: '请输入题目描述' }]}>
            <TextArea autoSize={{ minRows: 5, maxRows: 10 }} />
          </FormItem>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormItem field="inputFormat" label="输入格式"><TextArea autoSize={{ minRows: 3, maxRows: 6 }} /></FormItem>
            <FormItem field="outputFormat" label="输出格式"><TextArea autoSize={{ minRows: 3, maxRows: 6 }} /></FormItem>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <FormItem field="timeLimit" label="时间限制(ms)" rules={[{ required: true, message: '请输入时间限制' }]}>
              <InputNumber min={100} max={10000} style={{ width: '100%' }} />
            </FormItem>
            <FormItem field="memoryLimit" label="内存限制(MB)" rules={[{ required: true, message: '请输入内存限制' }]}>
              <InputNumber min={16} max={2048} style={{ width: '100%' }} />
            </FormItem>
            <FormItem field="isPublic" label="可见性" triggerPropName="checked">
              <Switch checkedText="公开" uncheckedText="仅自己" />
            </FormItem>
          </div>
          <FormItem label="标签">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: tags.length > 0 ? 8 : 0 }}>
              {tags.map((tag) => (
                <Tag key={tag} closable onClose={() => setTags(tags.filter((t) => t !== tag))} color="blue">{tag}</Tag>
              ))}
            </div>
            <Space>
              <Input
                value={tagInput}
                onChange={setTagInput}
                placeholder="输入标签名称"
                onPressEnter={() => {
                  const val = tagInput.trim();
                  if (val && !tags.includes(val)) setTags([...tags, val]);
                  setTagInput('');
                }}
                style={{ width: 200 }}
              />
              <Button type="primary" size="small" onClick={() => {
                const val = tagInput.trim();
                if (val && !tags.includes(val)) setTags([...tags, val]);
                setTagInput('');
              }}>添加</Button>
            </Space>
          </FormItem>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormItem field="sampleInput" label="样例输入"><TextArea autoSize={{ minRows: 3, maxRows: 6 }} /></FormItem>
            <FormItem field="sampleOutput" label="样例输出"><TextArea autoSize={{ minRows: 3, maxRows: 6 }} /></FormItem>
          </div>
          <FormItem label="测试点">
            <TextArea
              value={testCasesText}
              onChange={setTestCasesText}
              autoSize={{ minRows: 5, maxRows: 10 }}
              placeholder={'每行一个测试点，格式：输入|||输出\n例如：1|||1'}
            />
          </FormItem>
        </Form>
      </Modal>
    </Space>
  );
}

/**
 * 渲染教师Practices组件，并协调其数据加载、状态和交互。
 */
function TeacherPractices() {
  const [rows, setRows] = useState<TeacherPractice[]>([]);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [problems, setProblems] = useState<TeacherProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [audience, setAudience] = useState<TeacherAudience>('ALL');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm<TeacherPracticeFormValues>();

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const load = async () => {
    setLoading(true);
    try {
      const [practiceResult, classResult, problemResult] = await Promise.all([
        teacherGet<PageResult<TeacherPractice>>('/api/admin/v1/practices?page=1&pageSize=200'),
        teacherGet<TeacherClass[]>('/api/teacher/v1/classes'),
        teacherGet<PageResult<TeacherProblem>>('/api/admin/v1/problems?page=1&pageSize=500'),
      ]);
      setRows(practiceResult.list);
      setClasses(classResult);
      setProblems(problemResult.list);
      if (!form.getFieldValue('audience')) {
        form.setFieldsValue({ audience: 'ALL', problemIds: [] });
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '题单数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /**
   * 创建或提交目标数据。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function create(values: TeacherPracticeFormValues) {
    const problemIds = values.problemIds ?? [];
    if (problemIds.length === 0) {
      Message.warning('请至少选择一道题目');
      return;
    }
    if (values.audience === 'CLASS' && !values.audienceId) {
      Message.warning('请选择班级');
      return;
    }
    setSubmitting(true);
    try {
      await teacherPost<TeacherPractice>('/api/admin/v1/practices', {
        title: values.title.trim(),
        description: values.description?.trim() || '',
        audience: values.audience,
        audienceId: values.audience === 'CLASS' ? values.audienceId : null,
        password: values.password?.trim() || undefined,
        problemIds,
      });
      Message.success('题单已创建');
      form.resetFields();
      form.setFieldsValue({ audience: 'ALL', problemIds: [] });
      setAudience('ALL');
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '创建题单失败');
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 删除目标数据。包含异步流程并由调用方处理完成或失败状态。
   */
  async function remove(id: number) {
    try {
      await teacherDelete<void>(`/api/admin/v1/practices/${id}`);
      Message.success('题单已删除');
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除题单失败');
    }
  }

  /**
   * 封装startEdit相关逻辑。会更新 React 状态并触发重新渲染。
   */
  function startEdit(practice: TeacherPractice) {
    setEditingId(practice.id);
    const aud = (practice.audience as TeacherAudience) || 'ALL';
    setAudience(aud);
    form.setFieldsValue({
      title: practice.title,
      description: practice.description || '',
      audience: aud,
      audienceId: practice.audienceId ?? undefined,
      password: '',
      problemIds: (practice.problems ?? []).map((p) => p.id),
    });
  }

  /**
   * 判断celEdit是否成立。会更新 React 状态并触发重新渲染。
   */
  function cancelEdit() {
    setEditingId(null);
    setAudience('ALL');
    form.resetFields();
    form.setFieldsValue({ audience: 'ALL', problemIds: [] });
  }

  /**
   * 处理Update。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function handleUpdate() {
    if (!editingId) return;
    const values = form.getFieldsValue();
    const problemIds = values.problemIds ?? [];
    if (problemIds.length === 0) {
      Message.warning('请至少选择一道题目');
      return;
    }
    if (values.audience === 'CLASS' && !values.audienceId) {
      Message.warning('请选择班级');
      return;
    }
    setSubmitting(true);
    try {
      await teacherPut(`/api/admin/v1/practices/${editingId}`, {
        title: (values.title ?? '').trim(),
        description: values.description?.trim() || '',
        audience: values.audience,
        audienceId: values.audience === 'CLASS' ? values.audienceId : null,
        password: values.password?.trim() || undefined,
        problemIds,
      });
      Message.success('题单已更新');
      cancelEdit();
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '更新题单失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title={editingId ? '编辑题单' : '创建题单'}>
        <Form form={form} layout="vertical" onSubmit={editingId ? handleUpdate : create} requiredSymbol={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
            <FormItem field="title" label="题单名称" rules={[{ required: true, message: '请输入题单名称' }]}>
              <Input />
            </FormItem>
            <FormItem field="audience" label="可见范围" rules={[{ required: true, message: '请选择可见范围' }]}>
              <Select onChange={(value) => setAudience(value as TeacherAudience)}>
                <Option value="ALL">公开</Option>
                <Option value="CLASS">班级</Option>
              </Select>
            </FormItem>
            {audience === 'CLASS' ? (
              <FormItem field="audienceId" label="目标班级" rules={[{ required: true, message: '请选择班级' }]}>
                <Select placeholder="选择班级">{classes.map((item) => <Option key={item.id} value={item.id}>{item.name}（{item.id}）</Option>)}</Select>
              </FormItem>
            ) : (
              <FormItem field="password" label="访问密码"><Input.Password placeholder={editingId ? '留空则不修改密码' : '可选'} /></FormItem>
            )}
          </div>
          <FormItem field="description" label="题单介绍"><TextArea autoSize={{ minRows: 3, maxRows: 6 }} /></FormItem>
          <FormItem field="problemIds" label="组题" rules={[{ required: true, message: '请选择题目' }]}>
            <Select mode="multiple" placeholder="选择题目" allowClear>
              {problems.map((item) => <Option key={item.id} value={item.id}>{item.id}. {item.title}</Option>)}
            </Select>
          </FormItem>
          <Space>
            <Button type="primary" icon={<IconSave />} loading={submitting} onClick={() => form.submit()}>
              {editingId ? '保存修改' : '保存题单'}
            </Button>
            {editingId && <Button onClick={cancelEdit}>取消编辑</Button>}
          </Space>
        </Form>
      </Card>
      <Card
        title="我的题单"
        extra={<Button icon={<IconRefresh />} onClick={load}>刷新</Button>}
      >
        <Table
          rowKey="id"
          loading={loading}
          data={rows}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 90 },
            { title: '题单名称', dataIndex: 'title' },
            { title: '范围', dataIndex: 'audience', width: 110, render: (value: string) => <Tag>{audienceText(value)}</Tag> },
            { title: '题目数', dataIndex: 'problems', width: 100, render: (items: TeacherProblem[]) => items?.length ?? 0 },
            { title: '创建时间', dataIndex: 'createdAt', width: 190, render: formatDate },
            {
              title: '操作',
              width: 180,
              render: (_: unknown, row: TeacherPractice) => (
                <Space>
                  <Button size="mini" icon={<IconEdit />} onClick={() => startEdit(row)}>编辑</Button>
                  <Popconfirm title="确认删除该题单？" onOk={() => remove(row.id)}>
                    <Button size="mini" status="danger" icon={<IconDelete />}>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}

/**
 * 渲染教师Contests组件，并协调其数据加载、状态和交互。
 */
function TeacherContests() {
  const [rows, setRows] = useState<TeacherContest[]>([]);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [problems, setProblems] = useState<TeacherProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [audience, setAudience] = useState<TeacherAudience>('ALL');
  const [form] = Form.useForm<TeacherContestFormValues>();

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const load = async () => {
    setLoading(true);
    try {
      const [contestResult, classResult, problemResult] = await Promise.all([
        teacherGet<PageResult<TeacherContest>>('/api/admin/v1/contests?page=1&pageSize=200'),
        teacherGet<TeacherClass[]>('/api/teacher/v1/classes'),
        teacherGet<PageResult<TeacherProblem>>('/api/admin/v1/problems?page=1&pageSize=500'),
      ]);
      setRows(contestResult.list);
      setClasses(classResult);
      setProblems(problemResult.list);
      if (!form.getFieldValue('audience')) {
        form.setFieldsValue({ type: 'ACM', audience: 'ALL', startTime: nowLocalInput(), durationMinutes: 180, problemIds: [] });
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '比赛数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /**
   * 删除目标数据。包含异步流程并由调用方处理完成或失败状态。
   */
  async function remove(id: number) {
    try {
      await teacherDelete<void>(`/api/admin/v1/contests/${id}`);
      Message.success('比赛已删除');
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除比赛失败');
    }
  }

  /**
   * 格式化比赛End。会更新 React 状态并触发重新渲染。
   */
  function formatContestEnd(startTime: string, durationMinutes: number) {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + Number(durationMinutes || 180) * 60 * 1000);
    end.setMinutes(end.getMinutes() - end.getTimezoneOffset());
    return end.toISOString().slice(0, 19);
  }

  /**
   * 创建或提交比赛。包含异步流程并由调用方处理完成或失败状态。
   */
  async function submitContest(values: TeacherContestFormValues) {
    const endTime = formatContestEnd(values.startTime, values.durationMinutes);
    await createWithEndTime(values, endTime);
  }

  /**
   * 创建或提交WithEndTime。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function createWithEndTime(values: TeacherContestFormValues, endTime: string) {
    const problemIds = values.problemIds ?? [];
    if (problemIds.length === 0) {
      Message.warning('请至少选择一道题目');
      return;
    }
    if (values.audience === 'CLASS' && !values.audienceId) {
      Message.warning('请选择班级');
      return;
    }
    const start = new Date(values.startTime);
    if (Number.isNaN(start.getTime())) {
      Message.warning('请选择有效的开始时间');
      return;
    }
    const durationMinutes = Number(values.durationMinutes || 180);
    const audienceRequest = values.audience === 'CLASS'
      ? { audienceType: 'CLASS', audienceId: values.audienceId }
      : { audienceType: 'ALL', audienceId: 0 };

    setSubmitting(true);
    try {
      await teacherPost<TeacherContest>('/api/admin/v1/contests', {
        title: values.title.trim(),
        description: values.description?.trim() || '',
        durationMinutes,
        startTime: toLocalDateTime(values.startTime),
        endTime,
        type: values.type,
        audience: audienceRequest.audienceType,
        audienceId: audienceRequest.audienceId,
        audiences: [audienceRequest],
        frozen: false,
        freezeTime: null,
        enableRollingScoreboard: false,
        goldRatio: 10,
        silverRatio: 20,
        bronzeRatio: 30,
        allowFullscreen: false,
        antiCheatEnabled: false,
        maxSwitches: 3,
        allowAfterEndSubmit: false,
        allowAfterEndViewProblem: true,
        publicScoreboardEnabled: true,
        registrationType: 'PUBLIC',
        problems: buildContestProblems(problemIds, values.type),
      });
      Message.success('比赛已创建');
      form.resetFields();
      form.setFieldsValue({ type: 'ACM', audience: 'ALL', startTime: nowLocalInput(), durationMinutes: 180, problemIds: [] });
      setAudience('ALL');
      load();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '创建比赛失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title="创建比赛">
        <Form form={form} layout="vertical" onSubmit={submitContest} requiredSymbol={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16 }}>
            <FormItem field="title" label="比赛名称" rules={[{ required: true, message: '请输入比赛名称' }]}>
              <Input />
            </FormItem>
            <FormItem field="type" label="赛制" rules={[{ required: true, message: '请选择赛制' }]}>
              <Select>
                <Option value="ACM">ACM</Option>
                <Option value="OI">OI</Option>
              </Select>
            </FormItem>
            <FormItem field="audience" label="可见范围" rules={[{ required: true, message: '请选择可见范围' }]}>
              <Select onChange={(value) => setAudience(value as TeacherAudience)}>
                <Option value="ALL">公开</Option>
                <Option value="CLASS">班级</Option>
              </Select>
            </FormItem>
            {audience === 'CLASS' ? (
              <FormItem field="audienceId" label="目标班级" rules={[{ required: true, message: '请选择班级' }]}>
                <Select placeholder="选择班级">{classes.map((item) => <Option key={item.id} value={item.id}>{item.name}（{item.id}）</Option>)}</Select>
              </FormItem>
            ) : (
              <FormItem field="durationMinutes" label="时长(分钟)" rules={[{ required: true, message: '请输入比赛时长' }]}>
                <InputNumber min={1} max={10080} style={{ width: '100%' }} />
              </FormItem>
            )}
          </div>
          {audience === 'CLASS' && (
            <FormItem field="durationMinutes" label="时长(分钟)" rules={[{ required: true, message: '请输入比赛时长' }]}>
              <InputNumber min={1} max={10080} style={{ width: '100%' }} />
            </FormItem>
          )}
          <FormItem field="startTime" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
            <Input type="datetime-local" />
          </FormItem>
          <FormItem field="description" label="比赛介绍"><TextArea autoSize={{ minRows: 3, maxRows: 6 }} /></FormItem>
          <FormItem field="problemIds" label="比赛题目" rules={[{ required: true, message: '请选择题目' }]}>
            <Select mode="multiple" placeholder="选择题目" allowClear>
              {problems.map((item) => <Option key={item.id} value={item.id}>{item.id}. {item.title}</Option>)}
            </Select>
          </FormItem>
          <Button type="primary" icon={<IconSave />} loading={submitting} onClick={() => form.submit()}>保存比赛</Button>
        </Form>
      </Card>
      <Card
        title="我的比赛"
        extra={<Button icon={<IconRefresh />} onClick={load}>刷新</Button>}
      >
        <Table
          rowKey="id"
          loading={loading}
          data={rows}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 90 },
            { title: '比赛名称', dataIndex: 'title' },
            { title: '赛制', dataIndex: 'type', width: 90, render: (value: string) => <Tag color={value === 'OI' ? 'purple' : 'blue'}>{value}</Tag> },
            { title: '范围', dataIndex: 'audience', width: 110, render: (value: string) => <Tag>{audienceText(value)}</Tag> },
            { title: '状态', dataIndex: 'status', width: 110, render: (value: string) => <Tag>{contestStatusText(value)}</Tag> },
            { title: '开始时间', dataIndex: 'startTime', width: 190, render: formatDate },
            {
              title: '操作',
              width: 120,
              render: (_: unknown, row: TeacherContest) => (
                <Popconfirm title="确认删除该比赛？" onOk={() => remove(row.id)}>
                  <Button size="mini" status="danger" icon={<IconDelete />}>删除</Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
