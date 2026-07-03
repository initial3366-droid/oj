import { useState, useEffect } from 'react';
import { Card, Grid, Spin } from '@arco-design/web-react';
import { IconCode, IconCheck, IconFire, IconCalendar, IconUser, IconBook, IconPen, IconTrophy } from '@arco-design/web-react/icon';
import { fetchTeacherDashboard, type TeacherDashboard } from './teacherApi';
import {
  SubmissionTrendChart, VerdictDonutChart, LanguageProgressBars,
  DifficultyBarChart, HourlyActivityChart, UserGrowthChart, TopProblemsList,
} from '../admin/pages/dashboard/DashboardCharts';

const Row = Grid.Row;
const Col = Grid.Col;

function MiniStatCard({ title, value, icon, color }: { title: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <Col span={6}>
      <Card bordered={false} style={{ borderRadius: 12, borderTop: `3px solid ${color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color, display: 'flex' }}>{icon}</div>
          <div>
            <div style={{ fontSize: 12, color: '#86909c' }}>{title}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1d2129' }}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
          </div>
        </div>
      </Card>
    </Col>
  );
}

function ChartCard({ title, children, span }: { title: string; children: React.ReactNode; span?: number }) {
  return (
    <Col span={span || 24}>
      <Card bordered={false} style={{ borderRadius: 12, height: '100%' }} title={<span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>}>
        {children}
      </Card>
    </Col>
  );
}

export function TeacherDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TeacherDashboard | null>(null);

  useEffect(() => {
    fetchTeacherDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size={32} /></div>;

  const stats = data?.totalStats;

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Today's activity */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <MiniStatCard title="今日提交" value={data?.todaySubmissionCount || 0} icon={<IconCode style={{ fontSize: 20 }} />} color="#2563eb" />
        <MiniStatCard title="今日通过" value={data?.todayAcceptedCount || 0} icon={<IconCheck style={{ fontSize: 20 }} />} color="#10b981" />
        <MiniStatCard title="活跃学生" value={data?.todayActiveUserCount || 0} icon={<IconFire style={{ fontSize: 20 }} />} color="#8b5cf6" />
        <MiniStatCard title="进行中比赛" value={data?.activeContestCount || 0} icon={<IconCalendar style={{ fontSize: 20 }} />} color="#f59e0b" />
      </Row>

      {/* Cumulative summary */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <MiniStatCard title="我的学生" value={stats?.userCount || 0} icon={<IconUser style={{ fontSize: 20 }} />} color="#0ea5e9" />
        <MiniStatCard title="练习题目" value={stats?.problemCount || 0} icon={<IconBook style={{ fontSize: 20 }} />} color="#6366f1" />
        <MiniStatCard title="累计提交" value={stats?.submissionCount || 0} icon={<IconPen style={{ fontSize: 20 }} />} color="#14b8a6" />
        <MiniStatCard title="通过率" value={stats ? `${stats.passRate}%` : '0%'} icon={<IconTrophy style={{ fontSize: 20 }} />} color="#f97316" />
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <ChartCard title="近 7 日提交趋势" span={16}><SubmissionTrendChart data={data?.submissionTrend} /></ChartCard>
        <ChartCard title="评测结果分布" span={8}><VerdictDonutChart data={data?.verdictDistribution} /></ChartCard>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <ChartCard title="语言使用分布" span={8}><LanguageProgressBars data={data?.languageUsage} /></ChartCard>
        <ChartCard title="题目难度分布" span={8}><DifficultyBarChart data={data?.difficultyDistribution} /></ChartCard>
        <ChartCard title="今日逐时活动" span={8}><HourlyActivityChart data={data?.hourlyActivity} /></ChartCard>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <ChartCard title="学生增长趋势" span={12}>
          <UserGrowthChart data={data?.userGrowth} cumulativeLabel="累计学生" />
        </ChartCard>
        <ChartCard title="热门题目 TOP 5" span={12}><TopProblemsList data={data?.topProblems} /></ChartCard>
      </Row>
    </div>
  );
}
