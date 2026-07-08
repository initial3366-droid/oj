import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Grid,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
} from '@arco-design/web-react';
import { IconDownload, IconEdit, IconLeft } from '@arco-design/web-react/icon';
import {
  teacherDownload,
  teacherGet,
  teacherPost,
} from '../teacherApi';

const { Row, Col } = Grid;
const TabPane = Tabs.TabPane;

interface ContestDetail {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  audience: string;
  audiences?: Array<{ audienceType: string; audienceId: number; name: string }>;
  registrationType: string;
  frozen: boolean;
  freezeTime?: string | null;
  enableRollingScoreboard?: boolean;
  goldRatio?: number;
  silverRatio?: number;
  bronzeRatio?: number;
  allowAfterEndSubmit?: boolean;
  allowAfterEndViewProblem?: boolean;
  publicScoreboardEnabled?: boolean;
  allowFullscreen?: boolean;
  antiCheatEnabled?: boolean;
  maxSwitches?: number;
  registrationCount?: number;
  participantCount?: number;
  submissionCount?: number;
  createdAt: string;
  updatedAt?: string;
}

interface ContestProblem {
  id: number;
  contestProblemId: number;
  problemId: number;
  title: string;
  label: string;
  score: number;
  displayOrder: number;
}

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

function statusText(status: string) {
  if (status === 'RUNNING') return '进行中';
  if (status === 'ENDED') return '已结束';
  return '未开始';
}

function statusColor(status: string) {
  if (status === 'RUNNING') return 'green';
  if (status === 'ENDED') return 'red';
  return 'gray';
}

function audienceText(contest: ContestDetail) {
  if (contest.audiences?.length) {
    const names = contest.audiences.map((a) => a.name).filter(Boolean);
    if (names.length > 0) return names.join('、');
  }
  if (contest.audience === 'CLASS') return '班级';
  return '所有人';
}

export function TeacherContestDetailPage() {
  const navigate = useNavigate();
  const { contestId } = useParams();
  const numericId = contestId ? Number(contestId) : undefined;

  const [loading, setLoading] = useState(true);
  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [problems, setProblems] = useState<ContestProblem[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [rollingState, setRollingState] = useState<RollingState | null>(null);
  const [rollingLoading, setRollingLoading] = useState(false);
  const [scoreboardExporting, setScoreboardExporting] = useState(false);
  const [submissionsExporting, setSubmissionsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; content: string } | null>(null);

  useEffect(() => {
    if (numericId) loadContestDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericId]);

  async function loadContestDetail() {
    if (!numericId) return;
    setLoading(true);
    try {
      const [contestData, problemsData, registrationsData, rollingData] = await Promise.all([
        teacherGet<ContestDetail>(`/api/admin/v1/contests/${numericId}`),
        teacherGet<ContestProblem[]>(`/api/admin/v1/contests/${numericId}/problems`).catch(() => []),
        teacherGet<Registration[]>(`/api/admin/v1/contests/${numericId}/registrations`).catch(() => []),
        teacherGet<RollingState>(`/api/admin/v1/contests/${numericId}/rolling`).catch(() => null),
      ]);
      setContest(contestData);
      setProblems(problemsData);
      setRegistrations(registrationsData);
      setRollingState(rollingData);
    } catch (error) {
      setNotice({ type: 'error', content: '加载比赛详情失败' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function exportScoreboard() {
    if (!numericId) return;
    setScoreboardExporting(true);
    try {
      await teacherDownload(
        `/api/admin/v1/contests/${numericId}/scoreboard/export`,
        `contest-${numericId}-scoreboard.csv`,
      );
      setNotice({ type: 'success', content: '排行榜已开始下载' });
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '排行榜导出失败' });
    } finally {
      setScoreboardExporting(false);
    }
  }

  async function exportSubmissions() {
    if (!numericId) return;
    setSubmissionsExporting(true);
    try {
      await teacherDownload(
        `/api/admin/v1/contests/${numericId}/submissions/export`,
        `contest-${numericId}-submissions.zip`,
      );
      setNotice({ type: 'success', content: '提交代码包已开始下载' });
    } catch (error) {
      setNotice({ type: 'error', content: error instanceof Error ? error.message : '提交代码导出失败' });
    } finally {
      setSubmissionsExporting(false);
    }
  }

  async function runRollingAction(path: string, successMessage: string) {
    if (!numericId) return;
    setRollingLoading(true);
    try {
      const next = await teacherPost<RollingState>(`/api/admin/v1/contests/${numericId}/rolling/${path}`);
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
    return <Card><div>比赛不存在</div></Card>;
  }

  const problemColumns = [
    {
      title: '序号',
      dataIndex: 'displayOrder',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '编号',
      dataIndex: 'label',
      width: 100,
      align: 'center' as const,
      render: (label: string) => <Tag color="blue">{label}</Tag>,
    },
    { title: '题目名称', dataIndex: 'title', ellipsis: true },
    {
      title: '分值',
      dataIndex: 'score',
      width: 100,
      align: 'center' as const,
      render: (score: number) => (contest.type === 'OI' ? <Tag color="orange">{score} 分</Tag> : '-'),
    },
  ];

  const registrationColumns = [
    { title: 'ID', dataIndex: 'id', width: 80, align: 'center' as const },
    { title: '用户名', dataIndex: 'username', width: 150 },
    { title: '显示名称', dataIndex: 'displayName', width: 200 },
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
      render: (value: string) => (value ? new Date(value).toLocaleString('zh-CN') : '-'),
    },
  ];

  const registeredRegistrations = registrations.filter((registration) => !registration.status || registration.status === 'APPROVED');
  const registrationCount = registeredRegistrations.length;
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
  const medalText: Record<string, string> = { GOLD: '金', SILVER: '银', BRONZE: '铜' };
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
          <Button icon={<IconLeft />} onClick={() => navigate('/teacher/contests')}>返回列表</Button>
          <Button type="primary" icon={<IconEdit />} onClick={() => navigate(`/teacher/contests/${contestId}/edit`)}>编辑比赛</Button>
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
            { label: '比赛状态', value: <Tag color={statusColor(contest.status)}>{statusText(contest.status)}</Tag> },
            { label: '开始时间', value: contest.startTime ? new Date(contest.startTime).toLocaleString('zh-CN') : '-' },
            { label: '结束时间', value: contest.endTime ? new Date(contest.endTime).toLocaleString('zh-CN') : '-' },
            { label: '比赛时长', value: `${contest.durationMinutes ?? 0} 分钟` },
            { label: '面向群体', value: audienceText(contest) },
            { label: '报名方式', value: contest.registrationType || 'PUBLIC' },
            { label: '榜单封榜', value: contest.frozen ? '是' : '否' },
            { label: '封榜时间', value: contest.freezeTime ? new Date(contest.freezeTime).toLocaleString('zh-CN') : '-' },
            { label: '启用滚榜', value: contest.enableRollingScoreboard ? '是' : '否' },
            { label: '奖牌比例', value: `${contest.goldRatio ?? 10}% / ${contest.silverRatio ?? 20}% / ${contest.bronzeRatio ?? 30}%` },
            { label: '赛后提交', value: contest.allowAfterEndSubmit ? '允许' : '关闭' },
            { label: '赛后查看题目', value: contest.allowAfterEndViewProblem !== false ? '允许' : '关闭' },
            { label: '公开榜单', value: contest.publicScoreboardEnabled !== false ? '开启' : '关闭' },
            ...(contest.allowFullscreen != null ? [{ label: '全屏模式', value: contest.allowFullscreen ? '开启' : '关闭' }] : []),
            ...(contest.antiCheatEnabled != null ? [{ label: '反作弊', value: contest.antiCheatEnabled ? '开启' : '关闭' }] : []),
            ...(contest.maxSwitches != null ? [{ label: '切屏限制', value: `${contest.maxSwitches} 次` }] : []),
          ]}
        />
      </Card>

      <Card>
        <Tabs activeTab={activeTab} onChange={(key) => setActiveTab(String(key))}>
          <TabPane key="overview" title="比赛概览">
            <div style={{ padding: '16px 0' }}>
              <h3 style={{ marginBottom: 16 }}>比赛描述</h3>
              <div style={{ lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{contest.description || '暂无描述'}</div>
            </div>
          </TabPane>

          <TabPane key="problems" title={`题目列表 (${problems.length})`}>
            <Table
              columns={problemColumns}
              data={problems}
              pagination={false}
              rowKey="contestProblemId"
            />
          </TabPane>

          <TabPane key="registrations" title={`报名列表 (${registrationCount})`}>
            <div style={{ marginBottom: 16 }}>
              <Tag color="blue">报名人数: {registrationCount}</Tag>
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
                  <Card title="提交与榜单导出">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>导出本场比赛排行榜 CSV 与全部提交代码 ZIP。</div>
                      <Button icon={<IconDownload />} loading={submissionsExporting} onClick={exportSubmissions}>
                        导出提交代码 ZIP
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
        </Tabs>
      </Card>
    </div>
  );
}
