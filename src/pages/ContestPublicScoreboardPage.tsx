/**
 * 无需登录的比赛外榜。榜单表格与比赛详情页排行榜保持一致。
 */
import { Alert, Button, Card, Spin, Tag, Typography } from '../ui/compat';
import { ReloadOutlined, SafetyOutlined, StarOutlined } from '../ui/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchContestPublicScoreboard,
  type ContestPublicScoreboard,
  type ContestPublicScoreboardProblemStatus,
} from '../data/apiClient';

function boardStateText(state?: ContestPublicScoreboard['boardState']) {
  if (state === 'FROZEN') return '封榜中';
  if (state === 'ROLLING') return '滚榜中';
  if (state === 'FINAL') return '最终榜';
  return '实时榜';
}

function boardStateColor(state?: ContestPublicScoreboard['boardState']): 'green' | 'orange' | 'blue' | 'default' {
  if (state === 'FROZEN') return 'orange';
  if (state === 'ROLLING') return 'blue';
  if (state === 'FINAL') return 'green';
  return 'default';
}

function rankText(rank?: number | null, starred?: boolean | null) {
  return starred ? '打星' : rank ?? '-';
}

function attemptText(attempts: number) {
  return attempts === 1 ? '1 try' : `${attempts} tries`;
}

function acceptedMinute(startTime: string, status?: ContestPublicScoreboardProblemStatus) {
  if (!status?.accepted) return null;
  if (status.timeMinutes != null) return Math.max(0, Math.floor(status.timeMinutes));
  if (status.acceptedAt) {
    const start = new Date(startTime).getTime();
    const acceptedAt = new Date(status.acceptedAt).getTime();
    if (Number.isFinite(start) && Number.isFinite(acceptedAt)) {
      return Math.max(0, Math.floor((acceptedAt - start) / 60_000));
    }
  }
  return null;
}

function acceptedTimestamp(startTime: string, status?: ContestPublicScoreboardProblemStatus) {
  if (!status?.accepted) return null;
  if (status.acceptedAt) {
    const acceptedAt = new Date(status.acceptedAt).getTime();
    if (Number.isFinite(acceptedAt)) return acceptedAt;
  }
  if (status.timeMinutes != null) {
    const start = new Date(startTime).getTime();
    if (Number.isFinite(start)) return start + Math.max(0, status.timeMinutes) * 60_000;
  }
  return null;
}

function cellStyle(hasHiddenSubmissions: boolean, accepted: boolean, attempts: number, score: number, isOi: boolean, firstBlood: boolean) {
  if (hasHiddenSubmissions) return { backgroundColor: '#e6f4ff', borderColor: '#91caff', color: '#1677ff' };
  if (firstBlood) return { backgroundColor: '#047857', borderColor: '#065f46', color: '#fff' };
  if (accepted) return { backgroundColor: '#a7f3d0', borderColor: '#6ee7b7', color: '#065f46' };
  if (isOi && score > 0) return { backgroundColor: 'var(--qoj-color-warning-light-default)', borderColor: '#fcd34d', color: 'var(--qoj-color-warning-dark)' };
  if (attempts > 0) return { backgroundColor: 'var(--qoj-color-danger-light-default)', borderColor: '#fecaca', color: 'var(--qoj-color-danger-dark)' };
  return { backgroundColor: 'var(--qoj-color-fill-0)', borderColor: 'var(--qoj-color-border)', color: 'var(--qoj-color-text-2)' };
}

export function ContestPublicScoreboardPage() {
  const { contestId } = useParams();
  const id = Number(contestId ?? 0);
  const [scoreboard, setScoreboard] = useState<ContestPublicScoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!id) {
      setMessage('比赛不存在');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setScoreboard(await fetchContestPublicScoreboard(id));
      setMessage('');
    } catch (error) {
      setScoreboard(null);
      setMessage(error instanceof Error ? error.message : '外榜加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const firstBloodRowByProblem = useMemo(() => {
    const earliest = new Map<string, { rowIndex: number; acceptedAt: number }>();
    scoreboard?.rows.forEach((row, rowIndex) => {
      scoreboard.problems.forEach((problem) => {
        const status = row.problems?.[problem.label];
        if (!status?.accepted) return;
        const acceptedAt = acceptedTimestamp(scoreboard.startTime, status);
        if (acceptedAt == null) return;
        const current = earliest.get(problem.label);
        if (!current || acceptedAt < current.acceptedAt) {
          earliest.set(problem.label, { rowIndex, acceptedAt });
        }
      });
    });
    return new Map(Array.from(earliest, ([label, value]) => [label, value.rowIndex]));
  }, [scoreboard]);

  const problemStats = useMemo(() => {
    const stats = new Map<string, { submissions: number; accepted: number }>();
    scoreboard?.problems.forEach((problem) => stats.set(problem.label, { submissions: 0, accepted: 0 }));
    scoreboard?.rows.forEach((row) => {
      scoreboard.problems.forEach((problem) => {
        const status = row.problems?.[problem.label];
        const current = stats.get(problem.label);
        if (!current) return;
        current.submissions += status?.attempts ?? 0;
        if (status?.accepted) current.accepted += 1;
      });
    });
    return stats;
  }, [scoreboard]);

  // 榜单表格容器宽度测量：按容器实际宽度动态收缩题目列，避免出现横向滚动条
  const [boardWrapEl, setBoardWrapEl] = useState<HTMLDivElement | null>(null);
  const [boardWrapWidth, setBoardWrapWidth] = useState(0);
  useEffect(() => {
    if (!boardWrapEl || typeof ResizeObserver === 'undefined') return;
    const update = () => setBoardWrapWidth(boardWrapEl.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(boardWrapEl);
    return () => observer.disconnect();
  }, [boardWrapEl]);
  const scoreboardDensity = useMemo(() => {
    const problemCount = scoreboard?.problems.length ?? 0;
    if (problemCount <= 0 || boardWrapWidth <= 0) return 2;
    // 固定列（排名/用户/通过/时间）估算约 460px，班级列按需追加 170px；
    // 估算略偏保守，宁可提前一档收缩徽章也不要出现横向滚动条
    const fixedWidth = 460 + (scoreboard?.showClassOnScoreboard ? 170 : 0);
    const perProblem = (boardWrapWidth - fixedWidth) / problemCount;
    if (perProblem >= 104) return 2;
    if (perProblem >= 76) return 1;
    return 0;
  }, [boardWrapWidth, scoreboard]);
  const scoreboardChip = useMemo(() => {
    const isOi = scoreboard?.contestType === 'OI';
    if (scoreboardDensity >= 2) {
      return { minWidth: 76, minHeight: isOi ? 76 : 64, padding: '8px 10px', gap: 3, main: 13, sub: 11, mark: 18 };
    }
    if (scoreboardDensity === 1) {
      return { minWidth: 56, minHeight: isOi ? 64 : 56, padding: '6px 7px', gap: 2, main: 12, sub: 10, mark: 16 };
    }
    return { minWidth: 36, minHeight: isOi ? 48 : 44, padding: '4px 5px', gap: 1, main: 11, sub: 10, mark: 14 };
  }, [scoreboardDensity, scoreboard?.contestType]);

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--qoj-color-bg-1)' }}>
        <Spin size="large" />
        <Typography.Text type="secondary">外榜加载中</Typography.Text>
      </div>
    );
  }

  if (!scoreboard) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--qoj-color-bg-1)', padding: 24 }}>
        <Alert type="error" message={message || '外榜未开启'} />
      </div>
    );
  }

  const isOi = scoreboard.contestType === 'OI';
  const showClass = Boolean(scoreboard.showClassOnScoreboard);
  const boardState = scoreboard.boardState ?? 'LIVE';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--qoj-color-bg-1)', padding: 24 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card className="contest-detail-static-card" style={{ border: '1px solid var(--qoj-color-border)', boxShadow: 'none' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <SafetyOutlined style={{ color: 'var(--qoj-color-primary)' }} />
              <Typography.Title level={4} style={{ margin: 0 }}>{scoreboard.contestTitle}</Typography.Title>
              <Tag color="blue">{scoreboard.contestType}</Tag>
              <Tag color={boardStateColor(boardState)}>{boardStateText(boardState)}</Tag>
            </div>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>刷新</Button>
          </div>
        </Card>

        {(boardState === 'FROZEN' || boardState === 'ROLLING') && (
          <Alert
            type={boardState === 'FROZEN' ? 'warning' : 'info'}
            message={boardState === 'FROZEN' ? '已经封榜' : '当前正在滚榜，只显示已揭晓参赛者的最终变化。'}
            showIcon
            closable={false}
          />
        )}

        <div ref={setBoardWrapEl} style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--qoj-color-border)', backgroundColor: 'var(--qoj-color-bg-0)' }}>
          <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--qoj-color-fill-1)' }}>
                <th style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: 'var(--qoj-color-fill-1)', borderBottom: '1px solid var(--qoj-color-border)', padding: 12, textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>排名</th>
                <th style={{ borderBottom: '1px solid var(--qoj-color-border)', padding: '12px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>用户</th>
                {showClass && <th style={{ borderBottom: '1px solid var(--qoj-color-border)', padding: '12px 16px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>班级</th>}
                <th style={{ borderBottom: '1px solid var(--qoj-color-border)', padding: 12, textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>通过</th>
                <th style={{ borderBottom: '1px solid var(--qoj-color-border)', padding: 12, textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>{isOi ? '分数' : '时间'}</th>
                {scoreboard.problems.map((problem) => {
                  const stats = problemStats.get(problem.label) ?? { submissions: 0, accepted: 0 };
                  const submissionCount = problem.submissionCount ?? stats.submissions;
                  const acceptedCount = problem.acceptedCount ?? stats.accepted;
                  return (
                    <th key={problem.label} title={problem.title} style={{ borderBottom: '1px solid var(--qoj-color-border)', padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                      <div style={{ whiteSpace: 'nowrap' }}>{problem.label}</div>
                      <div style={{ marginTop: 3, fontSize: 11, lineHeight: '16px', fontWeight: 400, color: 'var(--qoj-color-text-2)', whiteSpace: 'nowrap' }} title={`提交 ${submissionCount} / 通过 ${acceptedCount}`}>
                        {submissionCount} / {acceptedCount}
                      </div>
                      {isOi && <div style={{ fontSize: 11, lineHeight: '16px', fontWeight: 400, color: 'var(--qoj-color-text-2)', whiteSpace: 'nowrap' }}>{problem.score ?? 0} 分</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {scoreboard.rows.map((row, rowIndex) => (
                <tr
                  key={`${row.userId}-${row.username}`}
                  style={{ opacity: row.revealed === false ? 0.82 : 1 }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.backgroundColor = 'var(--qoj-color-fill-0)';
                    const firstCell = event.currentTarget.querySelector('td:first-child') as HTMLElement;
                    if (firstCell) firstCell.style.backgroundColor = 'var(--qoj-color-fill-0)';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = '';
                    const firstCell = event.currentTarget.querySelector('td:first-child') as HTMLElement;
                    if (firstCell) firstCell.style.backgroundColor = 'var(--qoj-color-bg-0)';
                  }}
                >
                  <td style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: 'var(--qoj-color-bg-0)', borderBottom: '1px solid var(--qoj-color-border)', padding: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {rankText(row.rank, row.starred)}
                  </td>
                  <td style={{ borderBottom: '1px solid var(--qoj-color-border)', padding: '12px 16px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {row.displayName || row.username || row.userId}
                        {scoreboard.problems.length > 0 && row.solved === scoreboard.problems.length && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', backgroundColor: 'var(--qoj-color-warning)', borderRadius: 4, padding: '1px 5px', lineHeight: '18px' }}>AK</span>}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--qoj-color-text-2)' }}>个人{row.starred ? ' · 打星' : ''}</span>
                    </div>
                  </td>
                  {showClass && <td style={{ borderBottom: '1px solid var(--qoj-color-border)', padding: '12px 16px', color: 'var(--qoj-color-text-1)', whiteSpace: 'nowrap' }}>{row.className || '-'}</td>}
                  <td style={{ borderBottom: '1px solid var(--qoj-color-border)', padding: 12, textAlign: 'center', whiteSpace: 'nowrap' }}>{row.solved}</td>
                  <td style={{ borderBottom: '1px solid var(--qoj-color-border)', padding: 12, textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>{isOi ? row.totalScore : row.penalty}</td>
                  {scoreboard.problems.map((problem) => {
                    const status = row.problems?.[problem.label];
                    const attempts = status?.attempts ?? 0;
                    const accepted = Boolean(status?.accepted);
                    const score = status?.score ?? 0;
                    const hasHiddenSubmissions = Boolean(status?.hasHiddenSubmissions);
                    const hiddenAttempts = status?.hiddenAttempts ?? 0;
                    const minute = acceptedMinute(scoreboard.startTime, status);
                    const isFirstBlood = accepted && firstBloodRowByProblem.get(problem.label) === rowIndex;
                    return (
                      <td key={problem.label} style={{ borderBottom: '1px solid var(--qoj-color-border)', padding: 8, textAlign: 'center' }}>
                        <div
                          title={hasHiddenSubmissions ? '封榜后有提交' : isFirstBlood ? '一血' : accepted ? '已通过' : attempts > 0 ? '未通过' : '暂无提交'}
                          style={{ position: 'relative', margin: '0 auto', minWidth: scoreboardChip.minWidth, minHeight: scoreboardChip.minHeight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: scoreboardChip.gap, borderRadius: 6, border: '1px solid transparent', padding: scoreboardChip.padding, fontWeight: 600, ...cellStyle(hasHiddenSubmissions, accepted, attempts, score, isOi, isFirstBlood) }}
                        >
                          {!hasHiddenSubmissions && isFirstBlood && (
                            <StarOutlined aria-hidden="true" style={{ position: 'absolute', top: 4, left: 5, fontSize: 10, lineHeight: 1, color: '#fef3c7' }} />
                          )}
                          {hasHiddenSubmissions ? (
                            <>
                              <span aria-hidden="true" style={{ minHeight: 18, lineHeight: '18px', fontSize: scoreboardChip.mark }}>+</span>
                              <div style={{ fontSize: scoreboardChip.sub, lineHeight: '16px', opacity: 0.82, whiteSpace: 'nowrap' }}>{attemptText(hiddenAttempts)}</div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: scoreboardChip.main, lineHeight: '18px', whiteSpace: 'nowrap' }}>
                                <span>{accepted && minute != null ? `${minute} min` : '-'}</span>
                              </div>
                              {isOi && attempts > 0 && <div style={{ fontSize: scoreboardChip.sub, lineHeight: '16px', opacity: 0.9, whiteSpace: 'nowrap' }}>{score} pts</div>}
                              <div style={{ fontSize: scoreboardChip.sub, lineHeight: '16px', opacity: 0.82, whiteSpace: 'nowrap' }}>{attemptText(attempts)}</div>
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {scoreboard.rows.length === 0 && (
                <tr>
                  <td colSpan={4 + (showClass ? 1 : 0) + scoreboard.problems.length} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--qoj-color-text-2)' }}>暂无提交数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
