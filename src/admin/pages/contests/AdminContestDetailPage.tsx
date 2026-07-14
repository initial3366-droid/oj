/**
 * 管理员比赛详情页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { adminPath } from '../../../utils/adminPath';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Table,
  Button,
  Alert,
  Space,
  Tag,
  Spin,
  Tabs,
  Statistic,
  Grid,
  Input,
  Select,
  Switch,
} from '@arco-design/web-react';
import { IconDownload, IconLeft, IconEdit } from '@arco-design/web-react/icon';
import { adminDownload, adminGet, adminPost, adminPut } from '../../api/adminClient';

const { Row, Col } = Grid;
const TabPane = Tabs.TabPane;
const Option = Select.Option;

/**
 * 比赛详情接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ContestDetail {
  id: number;
  title: string;
  description: string;
  type: string;
  judgeMode?: 'GO_JUDGE' | 'CCPCOJ';
  status: string;
  startTime: string;
  endTime: string;
  audience: string;
  registrationType: string;
  frozen: boolean;
  freezeTime?: string | null;
  enableRollingScoreboard?: boolean;
  goldRatio?: number;
  silverRatio?: number;
  bronzeRatio?: number;
  allowAfterEndViewProblem?: boolean;
  allowAfterEndViewCode?: boolean;
  publicScoreboardEnabled?: boolean;
  showClassOnScoreboard?: boolean;
  allowFullscreen: boolean;
  antiCheatEnabled: boolean;
  maxSwitches: number;
  registrationCount?: number;
  participantCount?: number;
  problemCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 比赛题目接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface ContestProblem {
  id: number;
  contestProblemId: number;
  label: string;
  title: string;
  score: number;
  order: number;
  submissionCount: number;
  acceptedCount: number;
}

/**
 * 报名接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface Registration {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  identityType: string;
  identityId: number;
  status: string;
  registeredAt: string;
}

/**
 * Xcpcio配置接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface XcpcioConfig {
  contestId: number;
  enabled: boolean;
  mode: 'CLICS_EXPORT' | 'XCPCIO_PUSH';
  xcpcioContestId?: string | null;
  hasToken: boolean;
  hasClicsAccessToken: boolean;
  boardUrl?: string | null;
  syncEnabled: boolean;
  syncIntervalSeconds: number;
  status: string;
  lastSyncAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
  consecutiveFailures: number;
  clicsBaseUrl?: string | null;
  clicsScoreboardUrl?: string | null;
}

/**
 * RollingStep接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface RollingStep {
  step: number;
  displayName: string;
  frozenRank?: number | null;
  finalRank?: number | null;
  solved: number;
  penalty: number;
  score: number;
  medal?: 'GOLD' | 'SILVER' | 'BRONZE' | null;
  rankDelta?: number | null;
}

/**
 * RollingState接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface RollingState {
  contestId: number;
  status: 'NOT_STARTED' | 'ROLLING' | 'FINISHED' | 'PUBLISHED';
  currentStep: number;
  totalSteps: number;
  publishedFinal: boolean;
  steps: RollingStep[];
  startedAt?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

/**
 * 渲染管理员比赛详情页面，并协调其数据加载、状态和交互。
 */
export function AdminContestDetailPage() {
  const { contestId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [problems, setProblems] = useState<ContestProblem[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [xcpcioConfig, setXcpcioConfig] = useState<XcpcioConfig | null>(null);
  const [xcpcioToken, setXcpcioToken] = useState('');
  const [clicsAccessToken, setClicsAccessToken] = useState('');
  const [xcpcioSaving, setXcpcioSaving] = useState(false);
  const [xcpcioSyncing, setXcpcioSyncing] = useState(false);
  const [rollingState, setRollingState] = useState<RollingState | null>(null);
  const [rollingLoading, setRollingLoading] = useState(false);
  const [scoreboardExporting, setScoreboardExporting] = useState(false);
  const [submissionsExporting, setSubmissionsExporting] = useState(false);
  const [registrationExporting, setRegistrationExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; content: string } | null>(null);

  useEffect(() => {
    loadContestDetail();
  }, [contestId]);

  /**
   * 读取比赛详情并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function loadContestDetail() {
    setLoading(true);
    setLoadError('');
    setNotice(null);
    setContest(null);
    setProblems([]);
    setRegistrations([]);
    setXcpcioConfig(null);
    setRollingState(null);
    if (!contestId || !/^\d+$/.test(contestId)) {
      setLoadError('比赛编号无效');
      setLoading(false);
      return;
    }
    try {
      const contestData = await adminGet<ContestDetail>(`/api/admin/v1/contests/${contestId}`);
      setContest(contestData);

      const [problemsResult, registrationsResult, xcpcioResult, rollingResult] = await Promise.allSettled([
        adminGet<ContestProblem[]>(`/api/admin/v1/contests/${contestId}/problems`),
        adminGet<Registration[]>(`/api/admin/v1/contests/${contestId}/registrations`),
        adminGet<XcpcioConfig>(`/api/admin/v1/contests/${contestId}/xcpcio/config`),
        adminGet<RollingState>(`/api/admin/v1/contests/${contestId}/rolling`),
      ]);
      if (problemsResult.status === 'fulfilled') setProblems(problemsResult.value);
      if (registrationsResult.status === 'fulfilled') setRegistrations(registrationsResult.value);
      if (xcpcioResult.status === 'fulfilled') setXcpcioConfig(xcpcioResult.value);
      if (rollingResult.status === 'fulfilled') setRollingState(rollingResult.value);

      const failedModules = [problemsResult, registrationsResult, xcpcioResult, rollingResult]
        .filter((result) => result.status === 'rejected').length;
      if (failedModules > 0) {
        setNotice({ type: 'error', content: `比赛基本信息已加载，${failedModules} 个附加模块暂时不可用` });
      }
      setXcpcioToken('');
      setClicsAccessToken('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '加载比赛详情失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 更新Xcpcio配置。会更新 React 状态并触发重新渲染。
   */
  function updateXcpcioConfig(patch: Partial<XcpcioConfig>) {
    setXcpcioConfig((current) => current ? { ...current, ...patch } : current);
  }

  /**
   * 封装fullUrl相关逻辑。可能改变当前路由或查询参数。
   */
  function fullUrl(path?: string | null) {
    if (!path) return '';
    try {
      return new URL(path, window.location.origin).href;
    } catch {
      return path;
    }
  }

  /**
   * 更新Xcpcio配置。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function saveXcpcioConfig() {
    if (!contestId || !xcpcioConfig) return;
    setXcpcioSaving(true);
    try {
      const payload = {
        enabled: xcpcioConfig.enabled,
        mode: xcpcioConfig.mode,
        xcpcioContestId: xcpcioConfig.xcpcioContestId || '',
        token: xcpcioToken,
        boardUrl: xcpcioConfig.boardUrl || '',
        syncEnabled: xcpcioConfig.syncEnabled,
        syncIntervalSeconds: xcpcioConfig.syncIntervalSeconds,
        ...(clicsAccessToken ? { clicsAccessToken } : {}),
      };
      const saved = await adminPut<XcpcioConfig>(`/api/admin/v1/contests/${contestId}/xcpcio/config`, payload);
      setXcpcioConfig(saved);
      setXcpcioToken('');
      setClicsAccessToken('');
      setNotice({ type: 'success', content: 'XCPCIO 配置已保存' });
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '保存 XCPCIO 配置失败' });
    } finally {
      setXcpcioSaving(false);
    }
  }

  /**
   * 封装syncXcpcio配置相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function syncXcpcioConfig() {
    if (!contestId) return;
    setXcpcioSyncing(true);
    try {
      const synced = await adminPost<XcpcioConfig>(`/api/admin/v1/contests/${contestId}/xcpcio/sync`);
      setXcpcioConfig(synced);
      setNotice({ type: 'success', content: 'XCPCIO/CLICS 同步状态已刷新' });
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '同步失败' });
    } finally {
      setXcpcioSyncing(false);
    }
  }

  /**
   * 封装导出榜单相关逻辑。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function exportScoreboard() {
    if (!contestId) return;
    setScoreboardExporting(true);
    try {
      await adminDownload(
        `/api/admin/v1/contests/${contestId}/scoreboard/export`,
        `contest-${contestId}-scoreboard.csv`,
      );
      setNotice({ type: 'success', content: '排行榜已开始下载' });
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '排行榜导出失败' });
    } finally {
      setScoreboardExporting(false);
    }
  }

  /**
   * 封装导出Submissions相关逻辑。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function exportSubmissions() {
    if (!contestId) return;
    setSubmissionsExporting(true);
    try {
      await adminDownload(
        `/api/admin/v1/contests/${contestId}/submissions/export`,
        `contest-${contestId}-submissions.zip`,
      );
      setNotice({ type: 'success', content: '提交代码包已开始下载' });
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '提交代码导出失败' });
    } finally {
      setSubmissionsExporting(false);
    }
  }

  /**
   * 封装导出报名Users相关逻辑。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  async function exportRegistrationUsers() {
    if (!contestId) return;
    setRegistrationExporting(true);
    try {
      await adminDownload(
        `/api/admin/v1/contests/${contestId}/registrations/export`,
        `contest-${contestId}-registration-users.csv`,
      );
      setNotice({ type: 'success', content: '报名人信息已开始下载' });
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '报名人信息导出失败' });
    } finally {
      setRegistrationExporting(false);
    }
  }

  /**
   * 封装runRollingAction相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  async function runRollingAction(path: string, successMessage: string) {
    if (!contestId) return;
    setRollingLoading(true);
    try {
      const next = await adminPost<RollingState>(`/api/admin/v1/contests/${contestId}/rolling/${path}`);
      setRollingState(next);
      setNotice({ type: 'success', content: successMessage });
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '滚榜操作失败' });
    } finally {
      setRollingLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size={32} tip="加载中..." />
      </div>
    );
  }

  if (!contest) {
    return (
      <Card>
        <Alert
          type="error"
          content={loadError || '比赛详情暂时无法加载'}
          action={(
            <Space>
              <Button onClick={() => navigate(adminPath('/contests'))}>返回列表</Button>
              <Button type="primary" onClick={() => void loadContestDetail()}>重新加载</Button>
            </Space>
          )}
        />
      </Card>
    );
  }

  const statusMap: Record<string, { color: string; text: string }> = {
    NOT_STARTED: { color: 'gray', text: '未开始' },
    RUNNING: { color: 'green', text: '进行中' },
    ENDED: { color: 'red', text: '已结束' },
  };

  const statusInfo = statusMap[contest.status] || { color: 'gray', text: contest.status };

  const problemColumns = [
    {
      title: '序号',
      dataIndex: 'order',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '题目标签',
      dataIndex: 'label',
      width: 100,
      align: 'center' as const,
      render: (label: string) => <Tag color="blue">{label}</Tag>,
    },
    {
      title: '题目名称',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '分值',
      dataIndex: 'score',
      width: 100,
      align: 'center' as const,
      render: (score: number) => <Tag color="orange">{score} 分</Tag>,
    },
    {
      title: '提交数',
      dataIndex: 'submissionCount',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '通过数',
      dataIndex: 'acceptedCount',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '通过率',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: ContestProblem) => {
        const rate = record.submissionCount > 0
          ? ((record.acceptedCount / record.submissionCount) * 100).toFixed(1)
          : '0.0';
        return <span>{rate}%</span>;
      },
    },
  ];

  const registrationColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      width: 150,
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      width: 200,
    },
    {
      title: '身份类型',
      dataIndex: 'identityType',
      width: 120,
      align: 'center' as const,
      render: (type: string) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          PERSONAL: { color: 'blue', text: '个人' },
        };
        const info = typeMap[type] || { color: 'gray', text: type };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '报名时间',
      dataIndex: 'registeredAt',
      width: 180,
      align: 'center' as const,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
  ];

  const registeredRegistrations = registrations.filter((registration) => !registration.status || registration.status === 'APPROVED');
  const registrationCount = registeredRegistrations.length;
  const xcpcioStatusColor: Record<string, string> = {
    OK: 'green',
    SYNCING: 'blue',
    PENDING: 'orange',
    FAILED: 'red',
    DISABLED: 'gray',
  };
  const rollingStatusText: Record<string, string> = {
    NOT_STARTED: '未开始',
    ROLLING: '滚榜中',
    FINISHED: '已完成未发布',
    PUBLISHED: '已发布最终榜',
  };
  const rollingStatusColor: Record<string, string> = {
    NOT_STARTED: 'gray',
    ROLLING: 'blue',
    FINISHED: 'orange',
    PUBLISHED: 'green',
  };
  const medalText: Record<string, string> = {
    GOLD: '金',
    SILVER: '银',
    BRONZE: '铜',
  };
  const currentRollingStep = rollingState?.steps?.find((item) => item.step === rollingState.currentStep);

  return (
    <div>
      {notice && (
        <Alert
          type={notice.type}
          content={notice.content}
          closable
          onClose={() => setNotice(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        <Space size="medium">
          <Button icon={<IconLeft />} onClick={() => navigate(adminPath('/contests'))}>
            返回列表
          </Button>
          <Button type="primary" icon={<IconEdit />} onClick={() => navigate(`/admin/contests/${contestId}/edit`)}>
            编辑比赛
          </Button>
        </Space>
      </Card>

      <Card title={contest.title} style={{ marginBottom: 16 }}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Statistic title="报名人数" value={registrationCount} />
          </Col>
          <Col span={6}>
            <Statistic title="参赛人数" value={contest.participantCount ?? registrationCount} />
          </Col>
          <Col span={6}>
            <Statistic title="题目数量" value={problems.length} />
          </Col>
          <Col span={6}>
            <Statistic
              title="总分值"
              value={problems.reduce((sum, p) => sum + p.score, 0)}
              suffix="分"
            />
          </Col>
        </Row>

        <Descriptions
          column={2}
          data={[
            { label: '比赛类型', value: <Tag color={contest.type === 'ACM' ? 'blue' : 'orange'}>{contest.type}</Tag> },
            { label: '判题服务', value: contest.judgeMode === 'CCPCOJ'
              ? <Tag color="purple">CCPCOJ</Tag>
              : <Tag color="green">go-judge</Tag> },
            { label: '比赛状态', value: <Tag color={statusInfo.color}>{statusInfo.text}</Tag> },
            { label: '开始时间', value: new Date(contest.startTime).toLocaleString('zh-CN') },
            { label: '结束时间', value: new Date(contest.endTime).toLocaleString('zh-CN') },
            { label: '面向对象', value: contest.audience },
            { label: '报名方式', value: contest.registrationType },
            { label: '榜单封榜', value: contest.frozen ? '是' : '否' },
            { label: '封榜时间', value: contest.freezeTime ? new Date(contest.freezeTime).toLocaleString('zh-CN') : '-' },
            { label: '启用滚榜', value: contest.enableRollingScoreboard ? '是' : '否' },
            { label: '奖牌比例', value: `${contest.goldRatio ?? 10}% / ${contest.silverRatio ?? 20}% / ${contest.bronzeRatio ?? 30}%` },
            { label: '赛后查看题目', value: contest.allowAfterEndViewProblem !== false ? '允许' : '关闭' },
            { label: '赛后查看他人代码', value: contest.allowAfterEndViewCode ? '允许' : '关闭' },
            { label: '公共榜单', value: contest.publicScoreboardEnabled !== false ? '开启' : '关闭' },
            { label: '榜单显示班级', value: contest.showClassOnScoreboard ? '显示' : '隐藏' },
            { label: '全屏模式', value: contest.allowFullscreen ? '开启' : '关闭' },
            { label: '反作弊', value: contest.antiCheatEnabled ? '开启' : '关闭' },
            { label: '切屏限制', value: `${contest.maxSwitches} 次` },
          ]}
        />
      </Card>

      <Card>
        <Tabs activeTab={activeTab} onChange={(key) => setActiveTab(String(key))}>
          <TabPane key="overview" title="比赛概览">
            <div style={{ padding: '16px 0' }}>
              <h3 style={{ marginBottom: 16 }}>比赛描述</h3>
              <div style={{ lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{contest.description}</div>
            </div>
          </TabPane>

          <TabPane key="problems" title={`题目列表 (${problems.length})`}>
            <Table
              columns={problemColumns}
              data={problems}
              pagination={false}
              rowKey="id"
            />
          </TabPane>

          <TabPane key="registrations" title={`报名列表 (${registrationCount})`}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <Tag color="blue">报名人数: {registrationCount}</Tag>
              <Button icon={<IconDownload />} loading={registrationExporting} onClick={exportRegistrationUsers}>
                导出报名人信息
              </Button>
            </div>
            <Table
              columns={registrationColumns}
              data={registeredRegistrations}
              pagination={{ pageSize: 20, showTotal: true }}
              rowKey="id"
            />
          </TabPane>

          <TabPane key="scoreboard" title="排行榜">
            <div style={{ padding: '16px 0' }}>
              <Row gutter={16}>
                <Col span={24}>
                  <Card title="滚榜控制台" style={{ marginBottom: 16 }}>
                    <Space direction="vertical" style={{ width: '100%' }} size={16}>
                      <Space wrap>
                        <Tag color={rollingStatusColor[rollingState?.status ?? 'NOT_STARTED'] || 'gray'}>
                          {rollingStatusText[rollingState?.status ?? 'NOT_STARTED'] || rollingState?.status || '未开始'}
                        </Tag>
                        <span>
                          当前步数：{rollingState?.currentStep ?? 0} / {rollingState?.totalSteps ?? 0}
                        </span>
                        {contest.enableRollingScoreboard ? <Tag color="green">已启用滚榜</Tag> : <Tag color="gray">未启用滚榜</Tag>}
                      </Space>
                      {currentRollingStep ? (
                        <div style={{ padding: 12, border: '1px solid var(--color-border-2)', borderRadius: 6 }}>
                          当前揭晓：{currentRollingStep.displayName}
                          {' · '}
                          冻结排名 {currentRollingStep.frozenRank ?? '-'} → 最终排名 {currentRollingStep.finalRank ?? '-'}
                          {currentRollingStep.medal ? ` · ${medalText[currentRollingStep.medal] ?? currentRollingStep.medal}牌` : ''}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--color-text-3)' }}>开始滚榜后会在这里显示当前揭晓队伍。</div>
                      )}
                      <Space wrap>
                        <Button
                          type="primary"
                          loading={rollingLoading}
                          disabled={!contest.enableRollingScoreboard || rollingState?.status === 'PUBLISHED'}
                          onClick={() => runRollingAction('start', '滚榜步骤已生成')}
                        >
                          开始滚榜
                        </Button>
                        <Button
                          loading={rollingLoading}
                          disabled={!rollingState || rollingState.status === 'NOT_STARTED' || rollingState.status === 'PUBLISHED'}
                          onClick={() => runRollingAction('step?direction=prev', '已回到上一队')}
                        >
                          上一队
                        </Button>
                        <Button
                          loading={rollingLoading}
                          disabled={!rollingState || rollingState.status === 'NOT_STARTED' || rollingState.status === 'PUBLISHED'}
                          onClick={() => runRollingAction('step?direction=next', '已揭晓下一队')}
                        >
                          下一队
                        </Button>
                        <Button
                          loading={rollingLoading}
                          disabled={!rollingState || rollingState.status === 'NOT_STARTED' || rollingState.status === 'PUBLISHED'}
                          onClick={() => runRollingAction('finish', '滚榜已推进到最后')}
                        >
                          一键完成滚榜
                        </Button>
                        <Button
                          status="success"
                          loading={rollingLoading}
                          disabled={!contest.enableRollingScoreboard || rollingState?.status === 'PUBLISHED'}
                          onClick={() => runRollingAction('publish-final', '最终榜已发布')}
                        >
                          发布最终榜
                        </Button>
                      </Space>
                    </Space>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="Public Scoreboard">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>公开榜单地址与前台同步，未登录用户也可以访问。</div>
                      <Button
                        type="primary"
                        onClick={() => window.open(`/contests/${contestId}/public-scoreboard`, '_blank')}
                      >
                        打开公开榜单
                      </Button>
                      <Button icon={<IconDownload />} loading={scoreboardExporting} onClick={exportScoreboard}>
                        导出排行榜 CSV
                      </Button>
                    </Space>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="提交队列">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>查看本场比赛下的 Waiting / Judging / Failed 等判题任务。</div>
                      <Button
                        type="primary"
                        onClick={() => navigate(`/admin/contests/${contestId}/judge/queue?contestId=${contestId}`)}
                      >
                        打开本场提交队列
                      </Button>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </div>
          </TabPane>

          <TabPane key="inspection" title="比赛巡查">
            <div style={{ padding: '16px 0' }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card title="本场提交列表">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>查看本场比赛所有提交，支持查看详情、查看代码和删除。</div>
                      <Button
                        type="primary"
                        onClick={() => navigate(`/admin/contests/${contestId}/submissions?contestId=${contestId}`)}
                      >
                        打开本场提交列表
                      </Button>
                    </Space>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="本场判题队列">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>查看本场比赛 Waiting / Judging / Failed 等判题任务。</div>
                      <Button
                        type="primary"
                        onClick={() => navigate(`/admin/contests/${contestId}/judge/queue?contestId=${contestId}`)}
                      >
                        打开本场判题队列
                      </Button>
                    </Space>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="导出排行榜">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>导出本场比赛排行榜 CSV，包含每题提交次数、分数和 AC 时间。</div>
                      <Button icon={<IconDownload />} loading={scoreboardExporting} onClick={exportScoreboard}>
                        导出排行榜 CSV
                      </Button>
                    </Space>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="导出提交代码">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>导出本场比赛所有提交代码 ZIP，并附带提交清单与排行榜。</div>
                      <Button icon={<IconDownload />} loading={submissionsExporting} onClick={exportSubmissions}>
                        导出提交代码 ZIP
                      </Button>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </div>
          </TabPane>

          <TabPane key="xcpcio" title="XCPCIO 榜单">
            <div style={{ padding: '16px 0', display: 'grid', gap: 16 }}>
              <Card title="同步概况">
                {xcpcioConfig ? (
                  <Descriptions
                    column={2}
                    data={[
                      { label: '启用状态', value: <Tag color={xcpcioConfig.enabled ? 'green' : 'gray'}>{xcpcioConfig.enabled ? '已启用' : '未启用'}</Tag> },
                      { label: '同步模式', value: xcpcioConfig.mode },
                      { label: 'XCPCIO ContestId', value: xcpcioConfig.xcpcioContestId || '-' },
                      { label: '榜单状态', value: <Tag color={xcpcioStatusColor[xcpcioConfig.status] || 'gray'}>{xcpcioConfig.status}</Tag> },
                      { label: '同步开关', value: xcpcioConfig.syncEnabled ? '开启' : '关闭' },
                      { label: '同步间隔', value: `${xcpcioConfig.syncIntervalSeconds} 秒` },
                      { label: '最后同步', value: xcpcioConfig.lastSyncAt ? new Date(xcpcioConfig.lastSyncAt).toLocaleString('zh-CN') : '-' },
                      { label: '最后成功', value: xcpcioConfig.lastSuccessAt ? new Date(xcpcioConfig.lastSuccessAt).toLocaleString('zh-CN') : '-' },
                      { label: '连续失败', value: `${xcpcioConfig.consecutiveFailures}` },
                      { label: 'boardUrl', value: xcpcioConfig.boardUrl || '-' },
                      { label: 'CLICS 导出', value: fullUrl(xcpcioConfig.clicsScoreboardUrl) || '-' },
                      { label: 'CLICS Token', value: xcpcioConfig.hasClicsAccessToken ? '已配置' : '未配置' },
                    ]}
                  />
                ) : (
                  <div>暂无配置</div>
                )}
              </Card>

              <Card title="编辑配置">
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Switch
                      checked={xcpcioConfig?.enabled ?? false}
                      onChange={(checked) => updateXcpcioConfig({ enabled: checked })}
                    />
                    <span>启用 XCPCIO 榜单</span>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <span>同步模式</span>
                    <Select
                      value={xcpcioConfig?.mode ?? 'CLICS_EXPORT'}
                      style={{ width: 260 }}
                      onChange={(value) => updateXcpcioConfig({ mode: value as XcpcioConfig['mode'] })}
                    >
                      <Option value="CLICS_EXPORT">CLICS 导出</Option>
                      <Option value="XCPCIO_PUSH">XCPCIO 直推</Option>
                    </Select>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <span>XCPCIO ContestId</span>
                    <Input
                      value={xcpcioConfig?.xcpcioContestId ?? ''}
                      placeholder="可选"
                      onChange={(value) => updateXcpcioConfig({ xcpcioContestId: value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <span>XCPCIO Token</span>
                    <Input.Password
                      value={xcpcioToken}
                      placeholder={xcpcioConfig?.hasToken ? '留空则保留已有 token' : '输入 XCPCIO token'}
                      onChange={(value) => setXcpcioToken(value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <span>boardUrl</span>
                    <Input
                      value={xcpcioConfig?.boardUrl ?? ''}
                      placeholder="https://xcpcio.com/zh/..."
                      onChange={(value) => updateXcpcioConfig({ boardUrl: value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <span>CLICS Access Token</span>
                    <Input
                      value={clicsAccessToken}
                      placeholder={xcpcioConfig?.hasClicsAccessToken ? '留空则保留已有 token' : '可选，只读访问 token'}
                      onChange={(value) => setClicsAccessToken(value)}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Switch
                      checked={xcpcioConfig?.syncEnabled ?? false}
                      onChange={(checked) => updateXcpcioConfig({ syncEnabled: checked })}
                    />
                    <span>开启定时同步</span>
                    <Input
                      style={{ width: 120 }}
                      value={String(xcpcioConfig?.syncIntervalSeconds ?? 5)}
                      onChange={(value) => {
                        const next = Number(value);
                        if (!Number.isNaN(next)) {
                          updateXcpcioConfig({ syncIntervalSeconds: Math.max(5, next) });
                        }
                      }}
                    />
                    <span>秒</span>
                  </div>

                  <Space>
                    <Button type="primary" onClick={saveXcpcioConfig} loading={xcpcioSaving}>
                      保存配置
                    </Button>
                    <Button onClick={syncXcpcioConfig} loading={xcpcioSyncing}>
                      手动同步
                    </Button>
                    {xcpcioConfig?.clicsScoreboardUrl && (
                      <Button onClick={() => window.open(fullUrl(xcpcioConfig.clicsScoreboardUrl), '_blank')}>
                        打开 CLICS
                      </Button>
                    )}
                  </Space>
                </Space>
              </Card>
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}
