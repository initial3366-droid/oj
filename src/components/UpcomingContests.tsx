/**
 * UpcomingContests组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Card, Tag, Typography } from 'antd';
import { NavLink } from 'react-router-dom';
import { useOjData } from '../data/OjDataProvider';

const { Text, Title } = Typography;

/**
 * 渲染UpcomingContests组件，并协调其数据加载、状态和交互。
 */
export function UpcomingContests() {
  const { state } = useOjData();
  const contests = [...state.contests].slice(0, 5);

  /**
   * 读取状态Color并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const getStatusColor = (status: string): 'success' | 'processing' | 'default' => {
    const normalized = status.toLowerCase();
    if (normalized.includes('进行中') || normalized === 'running') return 'success';
    if (normalized.includes('未开始') || normalized === 'upcoming') return 'processing';
    return 'default';
  };

  /**
   * 格式化DateTime。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const formatDateTime = (dateTime: string): string => {
    const date = new Date(dateTime);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  };

  return (
    <Card
      style={{
        height: 580,
        border: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
      }}
      styles={{
        body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        header: { padding: 0, borderBottom: '1px solid #f0f0f0' },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <Title level={5} style={{ margin: 0 }}>
            近期比赛
          </Title>
          <NavLink
            to="/contests"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: '#1677ff',
              textDecoration: 'none',
            }}
          >
            查看全部 →
          </NavLink>
        </div>
      }
    >
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {contests.map((contest) => (
          <NavLink
            key={contest.id}
            to={`/contests/${contest.id}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                borderRadius: 8,
                border: '1px solid #f0f0f0',
                padding: 16,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#1677ff';
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#f0f0f0';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <Text strong style={{ fontSize: 14 }}>
                    {contest.title}
                  </Text>
                  <Text
                    type="secondary"
                    style={{ fontSize: 12, display: 'block', marginTop: 8 }}
                  >
                    {formatDateTime(contest.startsAt)} · {contest.type} · {contest.audience}
                  </Text>
                </div>
                <Tag color={getStatusColor(contest.status)} style={{ marginInlineEnd: 0 }}>
                  {contest.status}
                </Tag>
              </div>
            </div>
          </NavLink>
        ))}
      </div>
    </Card>
  );
}
