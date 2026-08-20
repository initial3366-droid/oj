/**
 * 首页页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Card, Tag, Typography } from 'antd';
import { ExperimentOutlined, TrophyOutlined, TeamOutlined } from '@ant-design/icons';
import { AnnouncementCard } from '../components/AnnouncementCard';
import { HomeCarousel } from '../components/HomeCarousel';
import { RatingTable } from '../components/RatingTable';
import { UpcomingContests } from '../components/UpcomingContests';
import { useOjData } from '../data/OjDataProvider';

const { Text, Title } = Typography;

/**
 * 渲染首页页面，并协调其数据加载、状态和交互。
 */
export function HomePage() {
  const { state } = useOjData();
  const activeContestCount = state.contests.filter(
    (contest) => contest.status === '进行中',
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <section
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: '1fr',
        }}
        className="home-carousel-section"
      >
        <HomeCarousel />
        <UpcomingContests />
      </section>

      <section>
        <AnnouncementCard />
      </section>

      <section
        style={{
          display: 'grid',
          gap: 24,
          gridTemplateColumns: '1fr',
        }}
        className="home-stats-section"
      >
        <Card styles={{ body: { padding: 20 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 48,
                height: 48,
                borderRadius: 8,
                backgroundColor: '#e8f1ff',
                color: '#1677ff',
              }}
            >
              <ExperimentOutlined style={{ fontSize: 24 }} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 14 }}>
                题库题目
              </Text>
              <Title level={3} style={{ margin: '4px 0 0 0' }}>
                {state.problems.length}
              </Title>
            </div>
          </div>
        </Card>

        <Card styles={{ body: { padding: 20 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 48,
                height: 48,
                borderRadius: 8,
                backgroundColor: '#f0fff4',
                color: '#52c41a',
              }}
            >
              <TrophyOutlined style={{ fontSize: 24 }} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 14 }}>
                进行中比赛
              </Text>
              <Title level={3} style={{ margin: '4px 0 0 0' }}>
                {activeContestCount}
              </Title>
            </div>
          </div>
        </Card>

        <Card styles={{ body: { padding: 20 } }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 48,
                height: 48,
                borderRadius: 8,
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                color: 'rgb(139, 92, 246)',
              }}
            >
              <TeamOutlined style={{ fontSize: 24 }} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 14 }}>
                上榜用户
              </Text>
              <Title level={3} style={{ margin: '4px 0 0 0' }}>
                {Math.min(state.ratings.length, 10)}
              </Title>
            </div>
          </div>
        </Card>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              全站 AC 榜
            </Title>
            <Text type="secondary" style={{ marginTop: 8, display: 'block', fontSize: 14 }}>
              按非比赛 AC 题目数量排序，每日 00:00 刷新前十名。
            </Text>
          </div>
          <Tag color="blue" style={{ fontSize: 14, padding: '4px 10px' }}>
            每日榜单
          </Tag>
        </div>
        <RatingTable />
      </section>

      <style>{`
        @media (min-width: 1024px) {
          .home-carousel-section {
            grid-template-columns: 2fr 1fr !important;
          }
        }
        @media (min-width: 768px) {
          .home-stats-section {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
