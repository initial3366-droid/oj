import { Card, Grid, Statistic, Table, Result, Button } from '@arco-design/web-react';
import { IconCalendar, IconCode, IconRefresh, IconCheck, IconFire } from '@arco-design/web-react/icon';
import { AdminPageContainer } from '../../layout/AdminPageContainer';
import { useDashboardData } from './useDashboardData';
import {
  SubmissionTrendChart, VerdictDonutChart, LanguageProgressBars,
  DifficultyBarChart, HourlyActivityChart, UserGrowthChart, TopProblemsList,
} from './DashboardCharts';

const Row = Grid.Row;
const Col = Grid.Col;

const DIFFICULTY_NAMES: Record<number, string> = { 1: '入门', 2: '简单', 3: '中等', 4: '困难', 5: '地狱' };

function formatNumber(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toLocaleString();
}

function GradientStatCard({ title, value, icon, gradient, change }: {
  title: string; value: number; icon: React.ReactNode; gradient: string; change?: string;
}) {
  return (
    <div style={{
      background: gradient, borderRadius: 12, padding: '20px 24px', color: '#fff',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>{formatNumber(value)}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 10, display: 'flex' }}>{icon}</div>
      </div>
      {change && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>{change}</div>}
    </div>
  );
}

function ChartCard({ title, children, span }: { title: string; children: React.ReactNode; span?: number }) {
  return (
    <Col span={span || 24}>
      <Card bordered={false} style={{ borderRadius: 12, height: '100%' }} title={<span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>}>
        {children}
      </Card>
    </Col>
  );
}

export function DashboardPage() {
  const { loading, data, error, reload } = useDashboardData();

  if (error && !loading) {
    return (
      <Result status="error" title="加载失败" subTitle={error}
        extra={<Button type="primary" icon={<IconRefresh />} onClick={reload}>重新加载</Button>} />
    );
  }

  const ts = data?.totalStats;
  const roleBreakdown = ts?.userByRole
    ? Object.entries(ts.userByRole).map(([k, v]) => `${k === 'STUDENT' ? '学生' : k === 'TEACHER' ? '教师' : k === 'GUEST' ? '访客' : k} ${v}`).join(' / ')
    : '';
  const diffBreakdown = ts?.problemByDifficulty
    ? Object.entries(ts.problemByDifficulty).map(([k, v]) => `${DIFFICULTY_NAMES[Number(k)] || k} ${v}`).join(' / ')
    : '';
  const typeBreakdown = ts?.contestByType
    ? Object.entries(ts.contestByType).map(([k, v]) => `${k} ${v}`).join(' / ')
    : '';

  return (
    <div>
      {/* Today Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><GradientStatCard title="今日提交" value={data?.todaySubmissionCount || 0} icon={<IconCode style={{ fontSize: 22 }} />} gradient="linear-gradient(135deg, #2563eb, #3b82f6)" /></Col>
        <Col span={6}><GradientStatCard title="今日通过" value={data?.todayAcceptedCount || 0} icon={<IconCheck style={{ fontSize: 22 }} />} gradient="linear-gradient(135deg, #10b981, #34d399)" /></Col>
        <Col span={6}><GradientStatCard title="今日活跃用户" value={data?.todayActiveUserCount || 0} icon={<IconFire style={{ fontSize: 22 }} />} gradient="linear-gradient(135deg, #8b5cf6, #a78bfa)" /></Col>
        <Col span={6}><GradientStatCard title="进行中比赛" value={data?.activeContestCount || 0} icon={<IconCalendar style={{ fontSize: 22 }} />} gradient="linear-gradient(135deg, #f59e0b, #fbbf24)" /></Col>
      </Row>

      {/* Total Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: '#86909c', marginBottom: 4 }}>注册用户</div>
            <Statistic value={ts?.userCount || 0} countUp />
            <div style={{ fontSize: 11, color: '#c0c4cc', marginTop: 4 }}>{roleBreakdown}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: '#86909c', marginBottom: 4 }}>题库总量</div>
            <Statistic value={ts?.problemCount || 0} countUp />
            <div style={{ fontSize: 11, color: '#c0c4cc', marginTop: 4 }}>{diffBreakdown}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: '#86909c', marginBottom: 4 }}>累计提交</div>
            <Statistic value={ts?.submissionCount || 0} countUp />
            <div style={{ fontSize: 11, color: '#c0c4cc', marginTop: 4 }}>通过率 {ts?.passRate || 0}%</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: '#86909c', marginBottom: 4 }}>历史比赛</div>
            <Statistic value={ts?.contestCount || 0} countUp />
            <div style={{ fontSize: 11, color: '#c0c4cc', marginTop: 4 }}>{typeBreakdown}</div>
          </Card>
        </Col>
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <ChartCard title="近 7 日提交趋势" span={16}><SubmissionTrendChart data={data?.submissionTrend} /></ChartCard>
        <ChartCard title="评测结果分布" span={8}><VerdictDonutChart data={data?.verdictDistribution} /></ChartCard>
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <ChartCard title="语言使用分布" span={8}><LanguageProgressBars data={data?.languageUsage} /></ChartCard>
        <ChartCard title="题目难度分布" span={8}><DifficultyBarChart data={data?.difficultyDistribution} /></ChartCard>
        <ChartCard title="今日逐时活动" span={8}><HourlyActivityChart data={data?.hourlyActivity} /></ChartCard>
      </Row>

      {/* Charts Row 3 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <ChartCard title="用户增长趋势" span={12}><UserGrowthChart data={data?.userGrowth} /></ChartCard>
        <ChartCard title="热门题目 TOP 5" span={12}><TopProblemsList data={data?.topProblems} /></ChartCard>
      </Row>

      {/* Recent Contests */}
      <AdminPageContainer title="近期比赛" loading={loading}>
        <Table
          columns={[
            { title: '比赛名称', dataIndex: 'title' },
            { title: '类型', dataIndex: 'type' },
            { title: '状态', dataIndex: 'status', render: (s: string) => ({ NOT_STARTED: '未开始', RUNNING: '进行中', ENDED: '已结束' }[s] || s) },
            { title: '开始时间', dataIndex: 'startTime', render: (t: string) => new Date(t).toLocaleString('zh-CN') },
          ]}
          data={data?.recentContests || []}
          pagination={false}
          rowKey="id"
        />
      </AdminPageContainer>
    </div>
  );
}
