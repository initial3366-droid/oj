import { Card, Typography, Tag } from '@douyinfe/semi-ui';
import { NavLink } from 'react-router-dom';
import { useOjData } from '../data/OjDataProvider';

export function UpcomingContests() {
  const { state } = useOjData();
  const contests = [...state.contests].slice(0, 4);

  const getStatusColor = (status: string): 'blue' | 'green' | 'grey' => {
    const normalized = status.toLowerCase();
    if (normalized.includes('进行中') || normalized === 'running') return 'green';
    if (normalized.includes('未开始') || normalized === 'upcoming') return 'blue';
    return 'grey';
  };

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
        border: '1px solid var(--semi-color-border)',
        display: 'flex',
        flexDirection: 'column',
      }}
      bodyStyle={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <Typography.Title heading={5} style={{ margin: 0 }}>
            近期比赛
          </Typography.Title>
          <NavLink
            to="/contests"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--semi-color-primary)',
              textDecoration: 'none',
            }}
          >
            查看全部 →
          </NavLink>
        </div>
      }
      headerStyle={{ padding: 0, borderBottom: '1px solid var(--semi-color-border)' }}
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
                border: '1px solid var(--semi-color-border)',
                padding: 16,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--semi-color-primary)';
                e.currentTarget.style.backgroundColor = 'var(--semi-color-fill-0)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--semi-color-border)';
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <Typography.Text strong style={{ fontSize: 14 }}>
                    {contest.title}
                  </Typography.Text>
                  <Typography.Text
                    type="tertiary"
                    style={{ fontSize: 12, display: 'block', marginTop: 8 }}
                  >
                    {formatDateTime(contest.startsAt)} · {contest.type} · {contest.audience}
                  </Typography.Text>
                </div>
                <Tag color={getStatusColor(contest.status)} size="small">
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
