/**
 * 比赛Public榜单页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Banner, Button, Card, Input, Modal, Select, Spin, Table, Tag, Typography } from '@douyinfe/semi-ui';
import { IconExternalOpen, IconList, IconOrderedList, IconRefresh, IconShield } from '@douyinfe/semi-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { UserAvatar } from '../components/common/UserAvatar';
import {
  fetchContestPublicScoreboard,
  fetchContestSubmissions,
  fetchContestXcpcioPublicConfig,
  type ContestPublicScoreboardProblemStatus,
  type ContestPublicScoreboardRow,
  type ContestPublicScoreboard,
  type ContestXcpcioPublicConfig,
  type SubmissionRecord,
} from '../data/apiClient';

/**
 * 封装absoluteUrl相关逻辑。可能改变当前路由或查询参数。
 */
function absoluteUrl(url?: string | null) {
  if (!url) return '';
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

/**
 * 封装状态Color相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function statusColor(status?: string): 'green' | 'orange' | 'red' | 'grey' | 'blue' {
  if (status === 'OK') return 'green';
  if (status === 'SYNCING' || status === 'PENDING') return 'orange';
  if (status === 'FAILED') return 'red';
  if (status === 'DISABLED') return 'grey';
  return 'blue';
}

/**
 * 格式化Minutes。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatMinutes(minutes?: number | null) {
  const safe = Math.max(0, minutes ?? 0);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return hours > 0 ? `${hours}:${String(mins).padStart(2, '0')}` : `${mins}`;
}

/**
 * 格式化SubmitTime。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function formatSubmitTime(value?: string | null) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * 封装结果Color相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function resultColor(status?: string): 'green' | 'orange' | 'red' | 'grey' | 'blue' {
  const normalized = (status ?? '').toUpperCase();
  if (normalized === 'AC' || normalized === 'ACCEPTED') return 'green';
  if (['WAITING', 'PENDING', 'QUEUED', 'REJUDGE_PENDING', 'JUDGING', 'COMPILING', 'RUNNING'].includes(normalized)) return 'blue';
  if (normalized === 'TLE' || normalized === 'MLE') return 'orange';
  if (normalized === 'SE' || normalized === 'SYSTEM_ERROR' || normalized === 'FAILED') return 'grey';
  return 'red';
}

/**
 * 封装boardStateText相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function boardStateText(state?: ContestPublicScoreboard['boardState']) {
  if (state === 'FROZEN') return '封榜中';
  if (state === 'ROLLING') return '滚榜中';
  if (state === 'FINAL') return '最终榜';
  return '实时榜';
}

/**
 * 封装boardStateColor相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function boardStateColor(state?: ContestPublicScoreboard['boardState']): 'green' | 'orange' | 'red' | 'grey' | 'blue' {
  if (state === 'FROZEN') return 'orange';
  if (state === 'ROLLING') return 'blue';
  if (state === 'FINAL') return 'green';
  return 'grey';
}

/**
 * 封装medalTag相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function medalTag(medal?: ContestPublicScoreboardRow['medal']) {
  if (medal === 'GOLD') return <Tag color="orange">金</Tag>;
  if (medal === 'SILVER') return <Tag color="grey">银</Tag>;
  if (medal === 'BRONZE') return <Tag color="yellow">铜</Tag>;
  return <span style={{ color: 'var(--semi-color-text-2)' }}>-</span>;
}

/**
 * 封装排名Text相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function rankText(rank?: number | null, starred?: boolean | null) {
  return starred ? '打星' : rank ?? '-';
}

/**
 * 渲染比赛Public榜单页面，并协调其数据加载、状态和交互。
 */
export function ContestPublicScoreboardPage() {
  const { contestId } = useParams();
  const id = Number(contestId ?? 0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [scoreboard, setScoreboard] = useState<ContestPublicScoreboard | null>(null);
  const [config, setConfig] = useState<ContestXcpcioPublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedCell, setSelectedCell] = useState<{
    row: ContestPublicScoreboardRow;
    label: string;
    title: string;
    status?: ContestPublicScoreboardProblemStatus;
  } | null>(null);

  /* ── submission queue state ── */
  const [viewMode, setViewMode] = useState<'board' | 'queue'>(
    searchParams.get('tab') === 'queue' ? 'queue' : 'board'
  );
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [qUserKw, setQUserKw] = useState('');
  const [qProblemKw, setQProblemKw] = useState('');
  const [qLangFilter, setQLangFilter] = useState('');
  const [qStatusFilter, setQStatusFilter] = useState('');
  const [qPage, setQPage] = useState(1);
  const [qPageSize, setQPageSize] = useState(20);

  /**
   * 读取目标数据并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const load = async () => {
    if (!id) {
      setMessage('比赛不存在');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchContestPublicScoreboard(id);
      setScoreboard(data);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '公开榜单加载失败');
    } finally {
      setLoading(false);
    }

    try {
      setConfig(await fetchContestXcpcioPublicConfig(id));
    } catch {
      setConfig(null);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!scoreboard?.endTime) { setCountdown(''); return; }
    const end = new Date(scoreboard.endTime).getTime();
    /**
     * 封装tick相关逻辑。会更新 React 状态并触发重新渲染。
     */
    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setCountdown('已结束'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [scoreboard?.endTime]);

  const queueLoadedRef = useRef(false);

  /**
   * 读取队列并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const loadQueue = useCallback(async () => {
    if (!id) return;
    setQueueLoading(true);
    try {
      const result = await fetchContestSubmissions(id, 1, 500);
      setSubmissions(result.list || []);
    } catch {
      setSubmissions([]);
    } finally {
      setQueueLoading(false);
      queueLoadedRef.current = true;
    }
  }, [id]);

  useEffect(() => {
    if (viewMode === 'queue' && !queueLoadedRef.current && !queueLoading) {
      loadQueue();
    }
  }, [viewMode, queueLoading, loadQueue]);

  /**
   * 封装r名称Map相关逻辑。对原始数据进行派生或聚合。
   */
  const userNameMap = useMemo(() => {
    const map = new Map<number, string>();
    scoreboard?.rows.forEach(r => {
      if (r.userId != null) map.set(r.userId, r.displayName || r.username || `User ${r.userId}`);
    });
    return map;
  }, [scoreboard]);

  /**
   * 封装题目LabelMap相关逻辑。对原始数据进行派生或聚合。
   */
  const problemLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    scoreboard?.problems.forEach(p => {
      if (p.title) map.set(p.title.toLowerCase(), p.label);
    });
    return map;
  }, [scoreboard]);

  /**
   * 封装队列Languages相关逻辑。对原始数据进行派生或聚合。
   */
  const queueLanguages = useMemo(() => {
    const s = new Set<string>();
    submissions.forEach(r => { if (r.language) s.add(r.language); });
    return [...s].sort();
  }, [submissions]);

  /**
   * 封装队列Statuses相关逻辑。对原始数据进行派生或聚合。
   */
  const queueStatuses = useMemo(() => {
    const s = new Set<string>();
    submissions.forEach(r => { if (r.status) s.add(r.status); });
    return [...s].sort();
  }, [submissions]);

  /**
   * 封装filteredSubs相关逻辑。对原始数据进行派生或聚合。
   */
  const filteredSubs = useMemo(() => {
    let data = submissions;
    const ukw = qUserKw.trim().toLowerCase();
    const pkw = qProblemKw.trim().toLowerCase();
    if (ukw) {
      data = data.filter(r => {
        const name = r.displayName || r.username || userNameMap.get(r.userId ?? 0) || '';
        return name.toLowerCase().includes(ukw);
      });
    }
    if (pkw) {
      data = data.filter(r => {
        const title = (r.problemTitle || '').toLowerCase();
        const label = problemLabelMap.get(title) || '';
        return title.includes(pkw) ||
          String(r.problemId).includes(pkw) ||
          label.toLowerCase().includes(pkw);
      });
    }
    if (qLangFilter) data = data.filter(r => r.language === qLangFilter);
    if (qStatusFilter) data = data.filter(r => r.status === qStatusFilter);
    return data;
  }, [submissions, qUserKw, qProblemKw, qLangFilter, qStatusFilter, userNameMap, problemLabelMap]);

  /**
   * 封装pagedSubs相关逻辑。对原始数据进行派生或聚合。
   */
  const pagedSubs = useMemo(() => {
    const start = (qPage - 1) * qPageSize;
    return filteredSubs.slice(start, start + qPageSize);
  }, [filteredSubs, qPage, qPageSize]);

  /**
   * 封装boardUrl相关逻辑。对原始数据进行派生或聚合。
   */
  const boardUrl = useMemo(() => absoluteUrl(config?.boardUrl), [config?.boardUrl]);
  const isOi = scoreboard?.contestType === 'OI';
  const showClassOnScoreboard = Boolean(scoreboard?.showClassOnScoreboard);
  const boardState = scoreboard?.boardState ?? 'LIVE';

  /**
   * 封装q状态Color相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const qStatusColor = (s: string): string => {
    const u = s.toUpperCase();
    if (u === 'AC' || u === 'ACCEPTED') return 'green';
    if (u === 'WA' || u === 'WRONG_ANSWER') return 'red';
    if (u === 'TLE' || u === 'TIME_LIMIT_EXCEEDED') return 'orange';
    if (u === 'MLE' || u === 'MEMORY_LIMIT_EXCEEDED') return 'orange';
    if (u === 'RE' || u === 'RUNTIME_ERROR') return 'purple';
    if (u === 'CE' || u === 'COMPILE_ERROR') return 'yellow';
    if (u === 'PENDING' || u === 'WAITING' || u === 'QUEUED') return 'blue';
    if (u === 'JUDGING' || u === 'RUNNING') return 'cyan';
    return 'grey';
  };

  /**
   * 封装队列TableColumns相关逻辑。对原始数据进行派生或聚合。
   */
  const queueTableColumns = useMemo(() => [
    {
      title: '提交者',
      dataIndex: 'userId',
      width: '16%',
      render: (_: unknown, record: SubmissionRecord) => {
        const name = record.displayName || record.username || userNameMap.get(record.userId ?? 0) || `User ${record.userId ?? '?'}`;
        return <Typography.Text strong ellipsis={{ showTooltip: true }}>{name}</Typography.Text>;
      },
    },
    {
      title: '题目',
      dataIndex: 'problemTitle',
      width: '14%',
      render: (title: string, record: SubmissionRecord) => {
        const label = problemLabelMap.get((title || '').toLowerCase()) || title || `#${record.problemId}`;
        return <Tag color="blue" size="small" style={{ fontFamily: 'monospace' }}>{label}</Tag>;
      },
    },
    {
      title: '语言',
      dataIndex: 'language',
      width: '12%',
      render: (lang: string) => (
        <Typography.Text style={{ fontFamily: 'monospace', fontSize: 13 }}>{lang || '-'}</Typography.Text>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'submitTime',
      width: '20%',
      render: (time: string) => {
        if (!time) return '-';
        const d = new Date(time);
        /**
         * 封装pad相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
         */
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: '14%',
      render: (status: string) => (
        <Tag color={qStatusColor(status) as any} size="small">{status || '-'}</Tag>
      ),
    },
  ], [userNameMap, problemLabelMap]);

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--semi-color-bg-1)' }}>
        <Spin size="large" tip="公开榜单加载中..." />
      </div>
    );
  }

  if (!scoreboard) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--semi-color-bg-1)', padding: 24 }}>
        <Banner type="danger" description={message || '公开榜单加载失败'} closeIcon={null} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--semi-color-bg-1)', padding: 24 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card
          style={{ border: '1px solid var(--semi-color-border)' }}
          bodyStyle={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <IconShield style={{ color: 'var(--semi-color-primary)' }} />
              <Typography.Title heading={4} style={{ margin: 0 }}>
                {scoreboard.contestTitle} 公开榜单
              </Typography.Title>
              <Tag color="blue">{scoreboard.contestType}</Tag>
              <Tag color={boardStateColor(boardState)}>{boardStateText(boardState)}</Tag>
              {countdown && (
                <Tag color={countdown === '已结束' ? 'grey' : 'red'}>
                  {countdown === '已结束' ? '比赛已结束' : `剩余 ${countdown}`}
                </Tag>
              )}
              {config?.enabled && <Tag color={statusColor(config.status)}>外榜 {config.status}</Tag>}
            </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {viewMode === 'board' ? (
              <Button icon={<IconList />} onClick={() => { setViewMode('queue'); setQPage(1); setSearchParams({ tab: 'queue' }, { replace: true }); }}>提交队列</Button>
            ) : (
              <Button icon={<IconOrderedList />} onClick={() => { setViewMode('board'); setSearchParams({}, { replace: true }); }}>排行榜</Button>
            )}
            <Button
              icon={<IconRefresh />}
              onClick={() => {
                if (viewMode === 'board') { load(); }
                else { setSubmissions([]); loadQueue(); }
              }}
              loading={viewMode === 'board' ? loading : queueLoading}
            >
              刷新
            </Button>
            {boardUrl && viewMode === 'board' && (
              <Button theme="solid" type="primary" icon={<IconExternalOpen />} onClick={() => window.open(boardUrl, '_blank')}>
                打开外榜
              </Button>
            )}
          </div>
        </Card>

        {viewMode === 'board' && (<>
        {boardUrl && (
          <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--semi-color-bg-0)' }}>
            <iframe
              title="外榜"
              src={boardUrl}
              style={{ display: 'block', width: '100%', height: 520, border: 0 }}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
        )}

        {(boardState === 'FROZEN' || boardState === 'ROLLING') && (
          <Banner
            type={boardState === 'FROZEN' ? 'warning' : 'info'}
            description={boardState === 'FROZEN' ? '当前为封榜展示，只显示封榜时间前的提交。' : '当前正在滚榜，只显示已揭晓队伍的最终变化。'}
            closeIcon={null}
          />
        )}

        <Card style={{ border: '1px solid var(--semi-color-border)' }} bodyStyle={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--semi-color-fill-1)' }}>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--semi-color-border)' }}>排名</th>
                  <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid var(--semi-color-border)' }}>奖牌</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--semi-color-border)' }}>用户</th>
                  {showClassOnScoreboard && (
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--semi-color-border)' }}>班级</th>
                  )}
                  <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid var(--semi-color-border)' }}>{isOi ? '总分' : '通过'}</th>
                  <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid var(--semi-color-border)' }}>{isOi ? '通过' : '罚时'}</th>
                  {scoreboard.problems.map((problem) => (
                    <th key={problem.label} style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid var(--semi-color-border)' }} title={problem.title}>
                      {problem.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scoreboard.rows.map((row) => (
                  <tr key={`${row.userId}-${row.username}`} style={row.revealed === false ? { opacity: 0.82 } : undefined}>
                    <td style={{ padding: 12, borderBottom: '1px solid var(--semi-color-border)', fontWeight: 600 }}>
                      <span>{rankText(row.rank, row.starred)}</span>
                      {boardState === 'ROLLING' && row.revealed && row.frozenRank != null && row.finalRank != null && row.frozenRank !== row.finalRank && (
                        <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--semi-color-success)' }}>
                          {row.frozenRank} → {row.finalRank}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 12, borderBottom: '1px solid var(--semi-color-border)', textAlign: 'center' }}>
                      {row.revealed === false ? <Tag color="grey">未揭晓</Tag> : medalTag(row.medal)}
                    </td>
                    <td style={{ padding: 12, borderBottom: '1px solid var(--semi-color-border)' }}>
                      <button
                        type="button"
                        style={{
                          border: 0,
                          padding: 0,
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <UserAvatar username={row.username || row.displayName} size="extra-small" showTooltip={false} />
                        <span style={{ fontWeight: 600, color: 'var(--semi-color-text-0)' }}>
                          {row.displayName || row.username}
                          {row.starred ? <Tag color="amber" size="small" style={{ marginLeft: 6 }}>打星</Tag> : null}
                        </span>
                      </button>
                    </td>
                    {showClassOnScoreboard && (
                      <td style={{ padding: 12, borderBottom: '1px solid var(--semi-color-border)', color: 'var(--semi-color-text-1)' }}>
                        {row.className || '-'}
                      </td>
                    )}
                    <td style={{ padding: 12, borderBottom: '1px solid var(--semi-color-border)', textAlign: 'center', fontWeight: 600 }}>
                      {isOi ? row.totalScore : row.solved}
                    </td>
                    <td style={{ padding: 12, borderBottom: '1px solid var(--semi-color-border)', textAlign: 'center' }}>
                      {isOi ? row.solved : row.penalty}
                    </td>
                    {scoreboard.problems.map((problem) => {
                      const status = row.problems?.[problem.label];
                      const accepted = Boolean(status?.accepted);
                      const attempts = status?.attempts ?? 0;
                      const score = status?.score ?? 0;
                      const background = accepted
                        ? 'var(--semi-color-success-light-default)'
                        : attempts > 0
                          ? 'var(--semi-color-danger-light-default)'
                          : 'var(--semi-color-fill-0)';
                      const color = accepted
                        ? 'var(--semi-color-success-dark)'
                        : attempts > 0
                          ? 'var(--semi-color-danger-dark)'
                          : 'var(--semi-color-text-2)';
                      return (
                        <td key={problem.label} style={{ padding: 8, borderBottom: '1px solid var(--semi-color-border)', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedCell({ row, label: problem.label, title: problem.title, status })}
                            style={{
                              minWidth: 56,
                              borderRadius: 6,
                              padding: '6px 8px',
                              background,
                              color,
                              fontWeight: 600,
                              border: 0,
                              cursor: 'pointer',
                            }}
                          >
                            {isOi
                              ? attempts > 0 ? score : '-'
                              : accepted
                                ? `+${attempts > 1 ? attempts - 1 : ''}`
                                : attempts > 0
                                  ? `-${attempts}`
                                  : '-'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {scoreboard.rows.length === 0 && (
                  <tr>
                    <td colSpan={5 + (showClassOnScoreboard ? 1 : 0) + scoreboard.problems.length} style={{ padding: 40, textAlign: 'center', color: 'var(--semi-color-text-2)' }}>
                      暂无提交数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        </>)}

        {viewMode === 'queue' && (
          <Card style={{ border: '1px solid var(--semi-color-border)' }} bodyStyle={{ padding: 0 }}>
            <style>{`
              .psq-queue-table .semi-table-pagination-outer {
                padding: 16px 5px;
              }
            `}</style>
            <div style={{
              display: 'flex',
              gap: 12,
              padding: '16px 20px',
              borderBottom: '1px solid var(--semi-color-border)',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <Input
                placeholder="搜索提交者"
                value={qUserKw}
                onChange={v => { setQUserKw(v); setQPage(1); }}
                style={{ width: 150 }}
                showClear
              />
              <Input
                placeholder="搜索题目（名称/ID/题号）"
                value={qProblemKw}
                onChange={v => { setQProblemKw(v); setQPage(1); }}
                style={{ width: 190 }}
                showClear
              />
              <Select
                placeholder="语言"
                value={qLangFilter}
                onChange={v => { setQLangFilter(typeof v === 'string' ? v : ''); setQPage(1); }}
                style={{ width: 120 }}
                showClear
                optionList={queueLanguages.map(l => ({ label: l, value: l }))}
              />
              <Select
                placeholder="状态"
                value={qStatusFilter}
                onChange={v => { setQStatusFilter(typeof v === 'string' ? v : ''); setQPage(1); }}
                style={{ width: 120 }}
                showClear
                optionList={queueStatuses.map(s => ({ label: s, value: s }))}
              />
            </div>
            {queueLoading && submissions.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center' }}>
                <Spin tip="提交队列加载中" />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <Table
                  className="psq-queue-table"
                  columns={queueTableColumns}
                  dataSource={pagedSubs}
                  rowKey="id"
                  pagination={{
                    currentPage: qPage,
                    pageSize: qPageSize,
                    total: filteredSubs.length,
                    showSizeChanger: true,
                    pageSizeOpts: [10, 20, 50],
                    showTotal: true,
                    onPageChange: (p: number) => setQPage(p),
                    onPageSizeChange: (s: number) => { setQPageSize(s); setQPage(1); },
                  }}
                  empty={
                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                      <Typography.Text type="tertiary">暂无提交数据</Typography.Text>
                    </div>
                  }
                />
              </div>
            )}
          </Card>
        )}

        <Modal
          title={selectedCell ? `${selectedCell.row.displayName} · ${selectedCell.label}` : '提交历史'}
          visible={!!selectedCell}
          footer={null}
          onCancel={() => setSelectedCell(null)}
          style={{ maxWidth: 620 }}
          bodyStyle={{ maxHeight: 380, overflowY: 'auto', padding: '16px 24px' }}
        >
          {selectedCell && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 12, borderBottom: '1px solid #e5e6eb' }}>
                <div>
                  <Typography.Text type="tertiary" size="small">提交次数</Typography.Text>
                  <Typography.Title heading={5} style={{ margin: '4px 0 0' }}>
                    {selectedCell.status?.attempts ?? 0}
                  </Typography.Title>
                </div>
                <div>
                  <Typography.Text type="tertiary" size="small">AC 时间</Typography.Text>
                  <Typography.Title heading={5} style={{ margin: '4px 0 0' }}>
                    {selectedCell.status?.acceptedAt ? formatSubmitTime(selectedCell.status.acceptedAt) : '-'}
                  </Typography.Title>
                </div>
              </div>
              <div style={{ border: '1px solid #e5e6eb', borderRadius: 8, overflow: 'hidden' }}>
                {(selectedCell.status?.history ?? []).slice().reverse().map((item, index, arr) => (
                  <div
                    key={`${item.submittedAt}-${index}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderBottom: index < arr.length - 1 ? '1px solid #e5e6eb' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag color={resultColor(item.status)}>{item.status}</Tag>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>#{selectedCell.status!.attempts - index}</span>
                    </div>
                    <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
                      {formatSubmitTime(item.submittedAt)}{item.timeMinutes != null ? ` · ${formatMinutes(item.timeMinutes)}` : ''}
                    </Typography.Text>
                  </div>
                ))}
                {(selectedCell.status?.history ?? []).length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center' }}>
                    <Typography.Text type="tertiary">暂无提交记录</Typography.Text>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
