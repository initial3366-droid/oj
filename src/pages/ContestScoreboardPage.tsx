import { Card, Tag, Typography, Spin, Banner, Button } from '@douyinfe/semi-ui';
import { IconChevronLeft, IconTreeTriangleDown } from '@douyinfe/semi-icons';
import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { fetchContestScoreboard, type ContestScoreboard } from '../data/apiClient';

function statusText(status: ContestScoreboard['status']) {
  if (status === 'RUNNING') return '进行中';
  if (status === 'ENDED') return '已结束';
  return '未开始';
}

function cellClass(accepted: boolean, attempts: number, score: number, type: ContestScoreboard['type']) {
  if (accepted) return 'scoreboard-cell-accepted';
  if (type === 'OI' && score > 0) return 'scoreboard-cell-partial';
  if (attempts > 0) return 'scoreboard-cell-failed';
  return 'scoreboard-cell-empty';
}

function identityBadge(type?: string | null) {
  return '个人';
}

function medalTag(medal?: ContestScoreboard['rows'][number]['medal']) {
  if (medal === 'GOLD') return <Tag color="orange">金</Tag>;
  if (medal === 'SILVER') return <Tag color="grey">银</Tag>;
  if (medal === 'BRONZE') return <Tag color="yellow">铜</Tag>;
  return <Typography.Text type="tertiary">-</Typography.Text>;
}

function rankText(rank?: number | null, starred?: boolean | null) {
  return starred ? '打星' : rank ?? '-';
}

function scoreboardProblemId(problem: { problemId: number; contestProblemId?: number }) {
  return problem.contestProblemId ?? problem.problemId;
}

function formatDateTime(dateTime: string): string {
  const date = new Date(dateTime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function ContestScoreboardPage() {
  const { contestId } = useParams();
  const id = Number(contestId ?? 0);
  const [scoreboard, setScoreboard] = useState<ContestScoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!id) {
      setMessage('比赛不存在');
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchContestScoreboard(id)
      .then(setScoreboard)
      .catch((error) => setMessage(error instanceof Error ? error.message : '榜单加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
        <Spin tip="榜单加载中" />
      </div>
    );
  }

  if (!scoreboard) {
    return (
      <Banner
        type="danger"
        description={message || '榜单不存在'}
        closeIcon={null}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Button
        icon={<IconChevronLeft />}
        theme="borderless"
        onClick={() => {
          window.location.href = '/contests';
        }}
      >
        返回比赛
      </Button>

      <Card
        style={{
          border: '1px solid var(--semi-color-border)',
        }}
        bodyStyle={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Tag color="blue">{scoreboard.type}</Tag>
              <Tag>{statusText(scoreboard.status)}</Tag>
            </div>
            <Typography.Title heading={2} style={{ marginTop: 12, marginBottom: 0 }}>
              {scoreboard.title}
            </Typography.Title>
            <Typography.Text type="tertiary" style={{ marginTop: 8, display: 'block', fontSize: 14 }}>
              {formatDateTime(scoreboard.startTime)} - {formatDateTime(scoreboard.endTime)} · {scoreboard.durationMinutes} 分钟
            </Typography.Text>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 8,
              backgroundColor: 'var(--semi-color-warning-light-default)',
              padding: '12px 16px',
              color: 'var(--semi-color-warning-dark)',
            }}
          >
            <IconTreeTriangleDown size="large" />
            <Typography.Text style={{ fontSize: 14, fontWeight: 500 }}>Public Scoreboard</Typography.Text>
          </div>
        </div>
      </Card>

      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--semi-color-border)', background: 'var(--semi-color-bg-0)' }}>
        <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--semi-color-fill-1)' }}>
              <th
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 10,
                  backgroundColor: 'var(--semi-color-fill-1)',
                  borderBottom: '1px solid var(--semi-color-border)',
                  padding: '12px',
                  textAlign: 'left',
                  fontWeight: 600,
                }}
              >
                Rank
              </th>
              <th style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                Medal
              </th>
              <th style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                User
              </th>
              <th style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                Solved
              </th>
              <th style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                {scoreboard.type === 'OI' ? 'Score' : 'Penalty'}
              </th>
              {scoreboard.problems.map((problem) => (
                <th
                  key={scoreboardProblemId(problem)}
                  style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px', textAlign: 'center', fontWeight: 600 }}
                  title={problem.title}
                >
                  <div>{problem.label}</div>
                  {scoreboard.type === 'OI' && (
                    <div style={{ marginTop: 2, fontSize: 11, fontWeight: 400, color: 'var(--semi-color-text-2)' }}>
                      {problem.score ?? 0}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scoreboard.rows.map((row) => (
              <tr key={`${row.identityType ?? 'PERSONAL'}-${row.identityId ?? row.userId}`} className="scoreboard-row">
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    backgroundColor: 'var(--semi-color-bg-0)',
                    borderBottom: '1px solid var(--semi-color-border)',
                    padding: '12px',
                    fontWeight: 600,
                  }}
                >
                  {rankText(row.rank, row.starred)}
                </td>
                <td style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px', textAlign: 'center' }}>
                  {medalTag(row.medal)}
                </td>
                <td style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px 16px', fontWeight: 500 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span>{row.displayName || row.userId}</span>
                    <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                      {identityBadge(row.identityType)}
                      {row.starred ? ' · 打星' : ''}
                    </Typography.Text>
                  </div>
                </td>
                <td style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px', textAlign: 'center' }}>
                  {row.solved}
                </td>
                <td style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                  {scoreboard.type === 'OI' ? row.score : row.penalty}
                </td>
                {scoreboard.problems.map((problem) => {
                  const problemKey = scoreboardProblemId(problem);
                  const cell = row.cells.find((item) => scoreboardProblemId(item) === problemKey);
                  const attempts = cell?.attempts ?? 0;
                  const accepted = Boolean(cell?.accepted);
                  const score = cell?.score ?? 0;
                  return (
                    <td key={problemKey} style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '8px', textAlign: 'center' }}>
                      <div className={cellClass(accepted, attempts, score, scoreboard.type)}>
                        {scoreboard.type === 'OI'
                          ? attempts > 0
                            ? score
                            : '-'
                          : accepted
                            ? `+${attempts > 1 ? attempts - 1 : ''}`
                            : attempts > 0
                              ? `-${attempts}`
                              : '-'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {scoreboard.rows.length === 0 && (
              <tr>
                <td
                  colSpan={5 + scoreboard.problems.length}
                  style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--semi-color-text-2)' }}
                >
                  暂无提交数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .scoreboard-row:hover {
          background-color: var(--semi-color-fill-0);
        }
        .scoreboard-row:hover td:first-child {
          background-color: var(--semi-color-fill-0);
        }
        .scoreboard-cell-accepted {
          margin: 0 auto;
          min-width: 56px;
          border-radius: 6px;
          padding: 6px 8px;
          fontSize: 12px;
          fontWeight: 600;
          backgroundColor: var(--semi-color-success-light-default);
          color: var(--semi-color-success-dark);
        }
        .scoreboard-cell-partial {
          margin: 0 auto;
          min-width: 56px;
          border-radius: 6px;
          padding: 6px 8px;
          fontSize: 12px;
          fontWeight: 600;
          backgroundColor: var(--semi-color-warning-light-default);
          color: var(--semi-color-warning-dark);
        }
        .scoreboard-cell-failed {
          margin: 0 auto;
          min-width: 56px;
          border-radius: 6px;
          padding: 6px 8px;
          fontSize: 12px;
          fontWeight: 600;
          backgroundColor: var(--semi-color-danger-light-default);
          color: var(--semi-color-danger-dark);
        }
        .scoreboard-cell-empty {
          margin: 0 auto;
          min-width: 56px;
          border-radius: 6px;
          padding: 6px 8px;
          fontSize: 12px;
          fontWeight: 600;
          backgroundColor: var(--semi-color-fill-0);
          color: var(--semi-color-text-2);
        }
      `}</style>
    </div>
  );
}
