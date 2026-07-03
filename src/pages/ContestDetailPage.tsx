import { Button, Card, Tag, Tabs, TabPane, Spin } from '@douyinfe/semi-ui';
import {
  IconChevronLeft,
  IconTreeTriangleDown,
  IconUserGroup,
} from '@douyinfe/semi-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import {
  fetchContest,
  fetchContestScoreboard,
  fetchContestXcpcioPublicConfig,
  fetchContestSubmissions,
  fetchMyContestSubmissions,
  type ContestScoreboard,
  type ContestXcpcioPublicConfig,
  type PublicContest,
  type SubmissionRecord,
} from '../data/apiClient';
import { wsClient } from '../utils/websocket';
import { formatDateTime } from '../lib/format';
import { encryptId } from '../utils/cipher';

function statusText(status: PublicContest["status"]) {
  if (status === "RUNNING") return "进行中";
  if (status === "ENDED") return "已结束";
  return "未开始";
}

function statusColor(status: PublicContest["status"]): 'green' | 'grey' | 'blue' {
  if (status === "RUNNING") return "green";
  if (status === "ENDED") return "grey";
  return "blue";
}

function identityBadge(type?: string | null) {
  if (type === "CLUB") return "社团";
  return "个人";
}

function rankText(rank?: number | null, starred?: boolean | null) {
  return starred ? "打星" : rank ?? "-";
}

function submissionTime(submission: SubmissionRecord) {
  return submission.submitTime || submission.createdAt;
}

function submissionStatusColor(status: string): 'green' | 'red' | 'orange' | 'amber' | 'purple' | 'blue' | 'grey' {
  const normalized = status.toUpperCase();
  if (normalized === "AC" || normalized === "ACCEPTED") return "green";
  if (normalized === "WA" || normalized === "WRONG_ANSWER") return "red";
  if (normalized === "TLE" || normalized === "TIME_LIMIT_EXCEEDED") return "amber";
  if (normalized === "MLE" || normalized === "MEMORY_LIMIT_EXCEEDED") return "orange";
  if (normalized === "RE" || normalized === "RUNTIME_ERROR") return "purple";
  if (normalized === "CE" || normalized === "COMPILE_ERROR") return "red";
  if (["WAITING", "PENDING", "QUEUED", "REJUDGE_PENDING", "JUDGING", "COMPILING", "RUNNING"].includes(normalized)) return "blue";
  return "grey";
}

function submissionStatusText(status: string) {
  const map: Record<string, string> = {
    AC: "通过",
    ACCEPTED: "通过",
    WA: "答案错误",
    WRONG_ANSWER: "答案错误",
    TLE: "超时",
    TIME_LIMIT_EXCEEDED: "超时",
    MLE: "超内存",
    MEMORY_LIMIT_EXCEEDED: "超内存",
    RE: "运行错误",
    RUNTIME_ERROR: "运行错误",
    CE: "编译错误",
    COMPILE_ERROR: "编译错误",
    WAITING: "队列中",
    PENDING: "等待中",
    QUEUED: "等待中",
    REJUDGE_PENDING: "等待重判",
    JUDGING: "评测中",
    COMPILING: "编译中",
    RUNNING: "运行中",
  };
  return map[status.toUpperCase()] || status;
}

function cellStyle(accepted: boolean, attempts: number, score: number, type: ContestScoreboard["type"]) {
  if (accepted) return { backgroundColor: 'var(--semi-color-success-light-default)', color: 'var(--semi-color-success-dark)' };
  if (type === "OI" && score > 0) return { backgroundColor: 'var(--semi-color-warning-light-default)', color: 'var(--semi-color-warning-dark)' };
  if (attempts > 0) return { backgroundColor: 'var(--semi-color-danger-light-default)', color: 'var(--semi-color-danger-dark)' };
  return { backgroundColor: 'var(--semi-color-fill-0)', color: 'var(--semi-color-text-2)' };
}

function scoreboardProblemId(problem: { problemId: number; contestProblemId?: number }) {
  return problem.contestProblemId ?? problem.problemId;
}

export function ContestDetailPage() {
  const { contestId } = useParams();
  const navigate = useNavigate();
  const id = Number(contestId ?? 0);
  const [contest, setContest] = useState<PublicContest | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("problems");
  const [countdown, setCountdown] = useState<string>("");

  const [scoreboard, setScoreboard] = useState<ContestScoreboard | null>(null);
  const [scoreboardLoading, setScoreboardLoading] = useState(false);
  const [xcpcioConfig, setXcpcioConfig] = useState<ContestXcpcioPublicConfig | null>(null);

  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<string>("ALL");

  const [mySubmissions, setMySubmissions] = useState<SubmissionRecord[]>([]);
  const [mySubmissionsLoading, setMySubmissionsLoading] = useState(false);

  // 获取我的提交用于判断 AC 状态。
  // 注意：SubmissionVO.problemId 存的是题目原始 ID（SubmissionService 把 contestProblem.problemId 写入 submission.problemId），
  // 而题目卡片里的 pid 优先取 contestProblemId，因此这里收集的必须是原始 problemId，
  // 再通过下方 rawToContestId 映射补全，避免 AC 状态匹配失败。
  const acRawIds = useMemo(() => {
    const ids = new Set<number>();
    for (const sub of mySubmissions) {
      const status = (sub.status || '').toUpperCase();
      if (status === 'AC' || status === 'ACCEPTED') {
        ids.add(sub.problemId);
      }
    }
    return ids;
  }, [mySubmissions]);

  // 题目原始 problemId -> contestProblemId 的映射，用于把 AC 的原始 id 转成卡片用的 pid。
  const rawToContestId = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of contest?.problems ?? []) {
      if (p.contestProblemId != null && p.contestProblemId !== p.problemId) {
        map.set(p.problemId, p.contestProblemId);
      }
    }
    return map;
  }, [contest]);

  useEffect(() => {
    if (!id) {
      setMessage("比赛不存在");
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchContest(id)
      .then((data) => {
        setContest(data);
        setMessage("");
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "比赛加载失败");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchContestXcpcioPublicConfig(id)
      .then(setXcpcioConfig)
      .catch(() => setXcpcioConfig(null));
  }, [id]);

  useEffect(() => {
    if (!contest) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const endTime = new Date(contest.endTime).getTime();
      const startTime = new Date(contest.startTime).getTime();

      let targetTime = endTime;
      let prefix = "距离结束：";

      if (contest.status === "NOT_STARTED") {
        targetTime = startTime;
        prefix = "距离开始：";
      } else if (contest.status === "ENDED") {
        setCountdown("比赛已结束");
        return;
      }

      const distance = targetTime - now;

      if (distance < 0) {
        setCountdown(contest.status === "NOT_STARTED" ? "即将开始" : "比赛已结束");
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdown(`${prefix}${days}天 ${hours}小时`);
      } else if (hours > 0) {
        setCountdown(`${prefix}${hours}小时 ${minutes}分钟`);
      } else if (minutes > 0) {
        setCountdown(`${prefix}${minutes}分钟 ${seconds}秒`);
      } else {
        setCountdown(`${prefix}${seconds}秒`);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [contest]);

  useEffect(() => {
    if (activeTab === "scoreboard" && !scoreboard && contest) {
      setScoreboardLoading(true);
      fetchContestScoreboard(id)
        .then(setScoreboard)
        .catch(() => setScoreboard(null))
        .finally(() => setScoreboardLoading(false));
    }
  }, [activeTab, id, contest, scoreboard]);

  useEffect(() => {
    if (activeTab === "submissions" && contest) {
      setSubmissionsLoading(true);
      fetchContestSubmissions(id, 1, 100)
        .then((data) => setSubmissions(data.list))
        .catch(() => setSubmissions([]))
        .finally(() => setSubmissionsLoading(false));
    }
  }, [activeTab, id, contest]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (submissionStatusFilter === "ALL") return true;
      if (submissionStatusFilter === "ACCEPTED") return sub.status === "ACCEPTED" || sub.status === "AC";
      if (submissionStatusFilter === "WRONG") return sub.status === "WRONG_ANSWER" || sub.status === "WA";
      if (submissionStatusFilter === "PENDING") return sub.status === "PENDING" || sub.status === "JUDGING" || sub.status === "WAITING";
      return true;
    });
  }, [submissions, submissionStatusFilter]);

  useEffect(() => {
    if ((activeTab === "my-submissions" || activeTab === "problems") && contest) {
      setMySubmissionsLoading(true);
      fetchMyContestSubmissions(id, 1, 100)
        .then((data) => setMySubmissions(data.list))
        .catch(() => setMySubmissions([]))
        .finally(() => setMySubmissionsLoading(false));
    }
  }, [activeTab, id, contest]);

  // 实时刷新提交状态：WebSocket + 轮询
  useEffect(() => {
    if (!contest) return;
    const isSubmissionsTab = activeTab === 'submissions' || activeTab === 'my-submissions';

    const refreshSubmissions = () => {
      if (activeTab === 'submissions') {
        fetchContestSubmissions(id, 1, 100)
          .then((data) => setSubmissions(data.list))
          .catch(() => {});
      }
      if (activeTab === 'my-submissions') {
        fetchMyContestSubmissions(id, 1, 100)
          .then((data) => setMySubmissions(data.list))
          .catch(() => {});
      }
    };

    // WebSocket 订阅
    let unsubscribe: (() => void) | null = null;
    wsClient.subscribeToSubmissionQueue(() => {
      if (isSubmissionsTab) refreshSubmissions();
    }).then((fn) => { unsubscribe = fn; }).catch(() => {});

    // 轮询兜底：每 2 秒刷新一次
    const interval = isSubmissionsTab ? setInterval(refreshSubmissions, 2000) : null;

    return () => {
      if (unsubscribe) unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, [activeTab, id, contest]);

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
        <Spin tip="比赛加载中" />
      </div>
    );
  }

  if (!contest) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Button
          icon={<IconChevronLeft />}
          theme="borderless"
          onClick={() => navigate('/contests')}
        >
          返回比赛列表
        </Button>
        <Card
          style={{
            border: '1px solid var(--semi-color-danger-light-default)',
            backgroundColor: 'var(--semi-color-danger-light-default)',
          }}
        >
          <div style={{ color: 'var(--semi-color-danger)', fontSize: 14 }}>
            {message || "比赛不存在"}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Button
        icon={<IconChevronLeft />}
        theme="borderless"
        onClick={() => navigate('/contests')}
      >
        返回比赛列表
      </Button>

      <Card
        style={{
          border: '1px solid var(--semi-color-border)',
        }}
        bodyStyle={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Tag color={statusColor(contest.status)}>{statusText(contest.status)}</Tag>
              <Tag>{contest.type}</Tag>
            </div>
            <h1 style={{ marginTop: 16, fontSize: 28, fontWeight: 600, color: 'var(--semi-color-text-0)' }}>
              {contest.title}
            </h1>
            {contest.description && (
              <p style={{ marginTop: 12, fontSize: 14, color: 'var(--semi-color-text-1)' }}>{contest.description}</p>
            )}
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--semi-color-text-2)' }}>
              {formatDateTime(contest.startTime)} - {formatDateTime(contest.endTime)} · {contest.durationMinutes} 分钟
            </p>
            {contest.status === "ENDED" && contest.allowAfterEndSubmit && (
              <div
                style={{
                  marginTop: 12,
                  display: 'inline-flex',
                  borderRadius: 6,
                  border: '1px solid var(--semi-color-warning-light-default)',
                  backgroundColor: 'var(--semi-color-warning-light-default)',
                  padding: '6px 10px',
                  fontSize: 12,
                  color: 'var(--semi-color-warning-dark)',
                }}
              >
                比赛已结束，仍可继续提交代码，但不会计入排行榜。
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {countdown && (
              <div
                style={{
                  borderRadius: 8,
                  border: '1px solid var(--semi-color-primary-light-default)',
                  backgroundColor: 'var(--semi-color-primary-light-default)',
                  padding: '12px 16px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>倒计时</div>
                <div style={{ marginTop: 4, fontSize: 18, fontWeight: 600, color: 'var(--semi-color-primary)' }}>
                  {countdown}
                </div>
              </div>
            )}
            {contest.publicScoreboardEnabled !== false && xcpcioConfig?.enabled && (
              <Button
                icon={<IconTreeTriangleDown />}
                theme="solid"
                type="primary"
                onClick={() => window.open(`/contests/${id}/public-scoreboard`, '_blank')}
                style={{ width: '100%' }}
              >
                外榜
              </Button>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 8,
                backgroundColor: 'var(--semi-color-fill-0)',
                padding: '8px 16px',
                color: 'var(--semi-color-text-1)',
                lineHeight: 1,
              }}
            >
              <IconUserGroup size="large" style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }} />
              <span style={{ fontSize: 14, lineHeight: '20px' }}>{contest.participantCount} 人报名</span>
            </div>
            {contest.registered ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 6,
                  border: '1px solid var(--semi-color-success-light-default)',
                  backgroundColor: 'var(--semi-color-success-light-default)',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: 'var(--semi-color-success-dark)',
                }}
              >
                <span>已报名：{identityBadge(contest.registeredIdentityType)}</span>
              </div>
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 6,
                  border: '1px solid var(--semi-color-warning-light-default)',
                  backgroundColor: 'var(--semi-color-warning-light-default)',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: 'var(--semi-color-warning-dark)',
                }}
              >
                <span>未报名</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card
        style={{
          border: '1px solid var(--semi-color-border)',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          style={{ padding: '0 24px' }}
        >
          <TabPane
            tab="题目列表"
            itemKey="problems"
          >
            <div style={{ padding: 16 }}>
              {!contest.problems || contest.problems.length === 0 ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: 'var(--semi-color-text-2)', marginBottom: 8 }}>
                    {contest.status === "NOT_STARTED" ? "比赛尚未开始，题目列表暂未公开" : "暂无题目"}
                  </div>
                  {contest.status === "NOT_STARTED" && (
                    <div style={{ fontSize: 12, color: 'var(--semi-color-text-3)' }}>
                      比赛开始后即可查看题目
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(contest.problems || []).map((problem) => {
                    const pid = problem.contestProblemId ?? problem.problemId;
                    const acPid = rawToContestId.get(problem.problemId) ?? problem.problemId;
                    const isAccepted = acRawIds.has(problem.problemId) || acRawIds.has(acPid);
                    return (
                    <div
                      key={pid}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr auto',
                        alignItems: 'center',
                        padding: '14px 16px',
                        borderRadius: 8,
                        border: isAccepted ? '1px solid var(--semi-color-success)' : '1px solid var(--semi-color-border)',
                        backgroundColor: isAccepted ? 'var(--semi-color-success-light-default)' : '#fff',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isAccepted ? 'var(--semi-color-success)' : 'var(--semi-color-primary-light-default)',
                          color: isAccepted ? '#fff' : 'var(--semi-color-primary)',
                          fontWeight: 700,
                          fontSize: 15,
                        }}
                      >
                        {isAccepted ? '✓' : problem.label}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--semi-color-text-0)' }}>
                          {problem.title}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--semi-color-text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {contest.type === "OI" && <span>分值: {problem.score ?? 100}</span>}
                          {isAccepted && <Tag color="green" size="small">已通过</Tag>}
                        </div>
                      </div>
                      <span
                        onClick={() => navigate(`/practice/problem/cp${encryptId(pid)}?contestId=${id}`)}
                        style={{
                          color: 'var(--semi-color-primary)',
                          cursor: 'pointer',
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isAccepted ? '查看' : '答题'}
                      </span>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabPane>

          <TabPane
            tab="提交记录"
            itemKey="submissions"
          >
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                <Button
                  size="small"
                  theme={submissionStatusFilter === "ALL" ? "solid" : "borderless"}
                  type={submissionStatusFilter === "ALL" ? "primary" : "tertiary"}
                  onClick={() => setSubmissionStatusFilter("ALL")}
                >
                  全部
                </Button>
                <Button
                  size="small"
                  theme={submissionStatusFilter === "ACCEPTED" ? "solid" : "borderless"}
                  type={submissionStatusFilter === "ACCEPTED" ? "primary" : "tertiary"}
                  onClick={() => setSubmissionStatusFilter("ACCEPTED")}
                >
                  通过
                </Button>
                <Button
                  size="small"
                  theme={submissionStatusFilter === "WRONG" ? "solid" : "borderless"}
                  type={submissionStatusFilter === "WRONG" ? "primary" : "tertiary"}
                  onClick={() => setSubmissionStatusFilter("WRONG")}
                >
                  错误
                </Button>
                <Button
                  size="small"
                  theme={submissionStatusFilter === "PENDING" ? "solid" : "borderless"}
                  type={submissionStatusFilter === "PENDING" ? "primary" : "tertiary"}
                  onClick={() => setSubmissionStatusFilter("PENDING")}
                >
                  评测中
                </Button>
              </div>
              {submissionsLoading ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <Spin tip="加载中" />
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: 'var(--semi-color-text-2)' }}>
                  暂无提交记录
                </div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--semi-color-border)' }}>
                  <table style={{ minWidth: '100%', fontSize: 14 }}>
                    <thead style={{ backgroundColor: 'var(--semi-color-fill-0)' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          提交ID
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          题目
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          语言
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          状态
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          时间
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          内存
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          提交时间
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.map((sub) => (
                        <tr
                          key={sub.id}
                          style={{ borderTop: '1px solid var(--semi-color-border)' }}
                        >
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>{sub.id}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-0)' }}>
                            {sub.problemTitle || `#${sub.problemId}`}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                            {sub.language}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Tag color={submissionStatusColor(sub.status)} size="small">
                              {submissionStatusText(sub.status)}
                              {sub.passedCaseCount !== null && sub.totalCaseCount !== null
                                ? ` (${sub.passedCaseCount}/${sub.totalCaseCount})`
                                : ""}
                            </Tag>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                            {sub.timeUsed ? `${sub.timeUsed}ms` : "-"}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                            {sub.memoryUsed ? `${sub.memoryUsed}KB` : "-"}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-2)' }}>
                            {formatDateTime(submissionTime(sub))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabPane>

          <TabPane
            tab="我的提交"
            itemKey="my-submissions"
          >
            <div style={{ padding: 16 }}>
              {mySubmissionsLoading ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <Spin tip="加载中" />
                </div>
              ) : mySubmissions.length === 0 ? (
                <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: 'var(--semi-color-text-2)' }}>
                  暂无提交记录
                </div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--semi-color-border)' }}>
                  <table style={{ minWidth: '100%', fontSize: 14 }}>
                    <thead style={{ backgroundColor: 'var(--semi-color-fill-0)' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          提交ID
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          题目
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          语言
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          状态
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          时间
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          内存
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          提交时间
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySubmissions.map((sub) => (
                        <tr
                          key={sub.id}
                          style={{ borderTop: '1px solid var(--semi-color-border)' }}
                        >
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>{sub.id}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-0)' }}>
                            {sub.problemTitle || `#${sub.problemId}`}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                            {sub.language}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Tag color={submissionStatusColor(sub.status)} size="small">
                              {submissionStatusText(sub.status)}
                              {sub.passedCaseCount !== null && sub.totalCaseCount !== null
                                ? ` (${sub.passedCaseCount}/${sub.totalCaseCount})`
                                : ""}
                            </Tag>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                            {sub.timeUsed ? `${sub.timeUsed}ms` : "-"}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                            {sub.memoryUsed ? `${sub.memoryUsed}KB` : "-"}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-2)' }}>
                            {formatDateTime(submissionTime(sub))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabPane>

          <TabPane
            tab="排行榜"
            itemKey="scoreboard"
          >
            <div style={{ padding: 16 }}>
              {scoreboardLoading ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <Spin tip="排行榜加载中" />
                </div>
              ) : !scoreboard ? (
                <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: 'var(--semi-color-text-2)' }}>
                  排行榜暂不可用
                </div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--semi-color-border)' }}>
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
                          排名
                        </th>
                        <th style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          用户
                        </th>
                        <th style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                          通过
                        </th>
                        <th style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                          {scoreboard.type === "OI" ? "分数" : "罚时"}
                        </th>
                        {scoreboard.problems.map((problem) => (
                          <th
                            key={scoreboardProblemId(problem)}
                            style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px', textAlign: 'center', fontWeight: 600 }}
                            title={problem.title}
                          >
                            <div>{problem.label}</div>
                            {scoreboard.type === "OI" && (
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
                        <tr
                          key={`${row.identityType ?? "PERSONAL"}-${row.identityId ?? row.userId}`}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--semi-color-fill-0)';
                            const firstCell = e.currentTarget.querySelector('td:first-child') as HTMLElement;
                            if (firstCell) firstCell.style.backgroundColor = 'var(--semi-color-fill-0)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '';
                            const firstCell = e.currentTarget.querySelector('td:first-child') as HTMLElement;
                            if (firstCell) firstCell.style.backgroundColor = 'var(--semi-color-bg-0)';
                          }}
                        >
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
                          <td style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px 16px', fontWeight: 500 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span>{row.displayName || row.userId}</span>
                              <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
                                {identityBadge(row.identityType)}
                                {row.starred ? " · 打星" : ""}
                              </span>
                            </div>
                          </td>
                          <td style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px', textAlign: 'center' }}>
                            {row.solved}
                          </td>
                          <td style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                            {scoreboard.type === "OI" ? row.score : row.penalty}
                          </td>
                          {scoreboard.problems.map((problem) => {
                            const problemKey = scoreboardProblemId(problem);
                            const cell = row.cells.find(
                              (item) => scoreboardProblemId(item) === problemKey
                            );
                            const attempts = cell?.attempts ?? 0;
                            const accepted = Boolean(cell?.accepted);
                            const score = cell?.score ?? 0;
                            const cellStyles = cellStyle(accepted, attempts, score, scoreboard.type);
                            return (
                              <td
                                key={problemKey}
                                style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '8px', textAlign: 'center' }}
                              >
                                <div
                                  style={{
                                    margin: '0 auto',
                                    minWidth: 56,
                                    borderRadius: 6,
                                    padding: '6px 8px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    ...cellStyles,
                                  }}
                                >
                                  {scoreboard.type === "OI"
                                    ? attempts > 0
                                      ? score
                                      : "-"
                                    : accepted
                                      ? `+${attempts > 1 ? attempts - 1 : ""}`
                                      : attempts > 0
                                        ? `-${attempts}`
                                        : "-"}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {scoreboard.rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={4 + scoreboard.problems.length}
                            style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--semi-color-text-2)' }}
                          >
                            暂无提交数据
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}
