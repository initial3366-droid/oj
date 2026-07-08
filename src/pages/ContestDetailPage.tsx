import { Button, Card, Tag, Tabs, TabPane, Spin, Modal, Typography, Input, Select } from '@douyinfe/semi-ui';
import {
  IconChevronLeft,
  IconRefresh,
  IconSearch,
  IconTreeTriangleDown,
  IconUserGroup,
} from '@douyinfe/semi-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchContest,
  fetchContestScoreboard,
  fetchContestXcpcioPublicConfig,
  fetchContestSubmissions,
  fetchContestRegistrationOptions,
  fetchMyContestSubmissions,
  fetchSubmissionDetail,
  registerContest,
  type ContestScoreboard,
  type ContestRegistrationOption,
  type ContestXcpcioPublicConfig,
  type PublicContest,
  type SubmissionRecord,
} from '../data/apiClient';
import { CodeViewer } from '../components/common';
import { formatDateTime } from '../lib/format';
import { encryptId } from '../utils/cipher';

const VALID_TABS = ['problems', 'submissions', 'my-submissions', 'scoreboard'] as const;
type TabKey = (typeof VALID_TABS)[number];

function isValidTab(tab: string): tab is TabKey {
  return (VALID_TABS as readonly string[]).includes(tab);
}

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
  return "个人";
}

function registrationTypeText(type?: string | null) {
  if (type === "PASSWORD") return "密码报名";
  if (type === "INVITATION") return "邀请码报名";
  return "公开报名";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const id = Number(contestId ?? 0);

  // 从 URL ?tab=xxx 读取当前 tab，默认 problems
  const tabParam = searchParams.get('tab') || 'problems';
  const activeTab: TabKey = isValidTab(tabParam) ? tabParam : 'problems';

  const setActiveTab = useCallback((key: string) => {
    if (key === 'problems') {
      // 默认 tab 不带 ?tab= 参数，保持 URL 干净
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: true });
    } else {
      setSearchParams({ tab: key }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [contest, setContest] = useState<PublicContest | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState<string>("");
  const [registrationOptions, setRegistrationOptions] = useState<ContestRegistrationOption[]>([]);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [registrationPassword, setRegistrationPassword] = useState("");
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  const [scoreboard, setScoreboard] = useState<ContestScoreboard | null>(null);
  const [scoreboardLoading, setScoreboardLoading] = useState(false);
  const [xcpcioConfig, setXcpcioConfig] = useState<ContestXcpcioPublicConfig | null>(null);

  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsLoaded, setSubmissionsLoaded] = useState(false);
  const [submissionProblemFilter, setSubmissionProblemFilter] = useState<string>("ALL");
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<string>("ALL");
  const [submissionLanguageFilter, setSubmissionLanguageFilter] = useState<string>("ALL");
  const [submissionUserKeyword, setSubmissionUserKeyword] = useState("");

  const [mySubmissions, setMySubmissions] = useState<SubmissionRecord[]>([]);
  const [mySubmissionsLoading, setMySubmissionsLoading] = useState(false);
  const [mySubmissionsLoaded, setMySubmissionsLoaded] = useState(false);
  const [codeModalSubmission, setCodeModalSubmission] = useState<SubmissionRecord | null>(null);
  const [codeLoadingId, setCodeLoadingId] = useState<number | null>(null);

  // 获取我的提交用于判断 AC 状态。
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

  // 题目原始 problemId -> contestProblemId 的映射
  const rawToContestId = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of contest?.problems ?? []) {
      if (p.contestProblemId != null && p.contestProblemId !== p.problemId) {
        map.set(p.problemId, p.contestProblemId);
      }
    }
    return map;
  }, [contest]);

  const contestReturnPath = `/contests/${id}`;
  const loginPath = `/login?redirect=${encodeURIComponent(contestReturnPath)}`;

  const isLoggedIn = () => Boolean(window.localStorage.getItem("qoj.accessToken"));

  const redirectToLogin = useCallback(() => {
    navigate(loginPath, { replace: true });
  }, [loginPath, navigate]);

  const loadContest = useCallback(() => {
    if (!id) {
      setMessage("比赛不存在");
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return fetchContest(id)
      .then((data) => {
        setContest(data);
        setMessage("");
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "比赛加载失败");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ── 数据加载 ──

  useEffect(() => {
    if (id && !isLoggedIn()) {
      redirectToLogin();
      return;
    }
    void loadContest();
  }, [id, loadContest, redirectToLogin]);

  useEffect(() => {
    if (!contest || contest.registered || !isLoggedIn()) {
      setRegistrationOptions([]);
      return;
    }
    fetchContestRegistrationOptions(id)
      .then((options) => {
        setRegistrationOptions(options);
        setRegistrationMessage("");
      })
      .catch((error) => {
        setRegistrationOptions([]);
        setRegistrationMessage(error instanceof Error ? error.message : "报名选项加载失败");
      });
  }, [contest, id]);

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
    if (activeTab === "scoreboard" && !scoreboard && contest?.registered) {
      setScoreboardLoading(true);
      fetchContestScoreboard(id)
        .then(setScoreboard)
        .catch(() => setScoreboard(null))
      .finally(() => setScoreboardLoading(false));
    }
  }, [activeTab, id, contest, scoreboard]);

  useEffect(() => {
    setSubmissions([]);
    setSubmissionsLoaded(false);
    setMySubmissions([]);
    setMySubmissionsLoaded(false);
  }, [id]);

  // ── 手动刷新函数（替代轮询）──

  const refreshSubmissions = useCallback(() => {
    if (!contest) return;
    setSubmissionsLoading(true);
    fetchContestSubmissions(id, 1, 20)
      .then((data) => setSubmissions(data.list))
      .catch(() => setSubmissions([]))
      .finally(() => {
        setSubmissionsLoaded(true);
        setSubmissionsLoading(false);
      });
  }, [id, contest]);

  const refreshMySubmissions = useCallback(() => {
    if (!contest) return;
    setMySubmissionsLoading(true);
    fetchMyContestSubmissions(id, 1, 20)
      .then((data) => setMySubmissions(data.list))
      .catch(() => setMySubmissions([]))
      .finally(() => {
        setMySubmissionsLoaded(true);
        setMySubmissionsLoading(false);
      });
  }, [id, contest]);

  // 首次进入 tab 时加载数据
  useEffect(() => {
    if (activeTab === "submissions" && contest?.registered && !submissionsLoaded && !submissionsLoading) {
      refreshSubmissions();
    }
  }, [activeTab, contest, submissionsLoaded, submissionsLoading, refreshSubmissions]);

  useEffect(() => {
    if ((activeTab === "my-submissions" || activeTab === "problems") && contest?.registered && !mySubmissionsLoaded && !mySubmissionsLoading) {
      refreshMySubmissions();
    }
  }, [activeTab, contest, mySubmissionsLoaded, mySubmissionsLoading, refreshMySubmissions]);

  const submissionProblemOptions = useMemo(() => {
    return (contest?.problems ?? []).map((problem) => ({
      value: String(problem.problemId),
      label: `${problem.label || problem.problemId} ${problem.title}`,
    }));
  }, [contest]);

  const submissionStatusOptions = useMemo(() => {
    return Array.from(new Set(submissions.map((sub) => sub.status).filter(Boolean)))
      .sort((a, b) => submissionStatusText(a).localeCompare(submissionStatusText(b), 'zh-CN'))
      .map((status) => ({
        value: status,
        label: submissionStatusText(status),
      }));
  }, [submissions]);

  const submissionLanguageOptions = useMemo(() => {
    return Array.from(new Set(submissions.map((sub) => sub.language).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
      .map((language) => ({
        value: language,
        label: language,
      }));
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    const userKeyword = submissionUserKeyword.trim().toLowerCase();
    return submissions.filter((sub) => {
      if (submissionProblemFilter !== "ALL" && String(sub.problemId) !== submissionProblemFilter) return false;
      if (submissionStatusFilter !== "ALL" && sub.status !== submissionStatusFilter) return false;
      if (submissionLanguageFilter !== "ALL" && sub.language !== submissionLanguageFilter) return false;
      if (userKeyword) {
        const userText = [sub.displayName, sub.username, sub.userId == null ? "" : String(sub.userId)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!userText.includes(userKeyword)) return false;
      }
      return true;
    });
  }, [submissions, submissionProblemFilter, submissionStatusFilter, submissionLanguageFilter, submissionUserKeyword]);

  const availableRegistrationOption = useMemo(() => {
    return registrationOptions.find((option) => option.available) ?? registrationOptions[0] ?? null;
  }, [registrationOptions]);

  const registrationDisabledReason = availableRegistrationOption && !availableRegistrationOption.available
    ? availableRegistrationOption.disabledReason || "当前账号暂不可报名该比赛"
    : "";

  const openContestProblem = (contestProblemId: number) => {
    if (!isLoggedIn()) {
      redirectToLogin();
      return;
    }
    if (!contest?.registered) {
      setRegistrationMessage("请先报名比赛，报名成功后即可查看题目。");
      return;
    }
    window.open(`/practice/problem/cp${encryptId(contestProblemId)}?contestId=${id}`, '_blank');
  };

  const submitRegistration = async (password?: string) => {
    if (!contest) return;
    if (!isLoggedIn()) {
      redirectToLogin();
      return;
    }
    if (contest.registrationType === "PASSWORD" && !password?.trim()) {
      setPasswordModalVisible(true);
      return;
    }
    if (registrationDisabledReason) {
      setRegistrationMessage(registrationDisabledReason);
      return;
    }

    setRegistrationLoading(true);
    setRegistrationMessage("");
    try {
      await registerContest(id, {
        identityType: availableRegistrationOption?.identityType ?? "PERSONAL",
        identityId: availableRegistrationOption?.identityId ?? null,
        starred: false,
        ...(password?.trim() ? { password: password.trim() } : {}),
      });
      setPasswordModalVisible(false);
      setRegistrationPassword("");
      await loadContest();
      setActiveTab("problems");
    } catch (error) {
      setRegistrationMessage(error instanceof Error ? error.message : "报名失败，请稍后重试");
    } finally {
      setRegistrationLoading(false);
    }
  };

  const formatUsage = (value: number | null | undefined, unit: string) => {
    return value == null ? '-' : `${value}${unit}`;
  };

  const canViewAllSubmissionCode = contest?.status === 'ENDED' && Boolean(contest.allowAfterEndViewCode);

  const openCode = async (sub: SubmissionRecord) => {
    if (codeLoadingId !== null) return;
    setCodeLoadingId(sub.id);
    setMessage('');
    try {
      const detail = sub.code ? sub : await fetchSubmissionDetail(sub.id);
      setCodeModalSubmission(detail);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '提交代码加载失败');
    } finally {
      setCodeLoadingId(null);
    }
  };

  const codeAction = (sub: SubmissionRecord) => {
    const loadingCode = codeLoadingId === sub.id;
    const disabled = codeLoadingId !== null;
    const trigger = () => {
      if (!disabled) {
        void openCode(sub);
      }
    };

    return (
      <span
        role="link"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={trigger}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            trigger();
          }
        }}
        style={{
          color: loadingCode ? 'var(--semi-color-text-2)' : 'var(--semi-color-primary)',
          cursor: disabled ? 'default' : 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {loadingCode ? '加载中…' : '查看代码'}
      </span>
    );
  };

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
      <Card
        style={{
          border: '1px solid var(--semi-color-border)',
          boxShadow: 'none',
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
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  borderRadius: 6,
                  border: '1px solid var(--semi-color-warning-light-default)',
                  backgroundColor: 'var(--semi-color-warning-light-default)',
                  padding: '12px',
                  color: 'var(--semi-color-warning-dark)',
                  minWidth: 180,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>未报名</div>
                <div style={{ fontSize: 12, lineHeight: '18px' }}>
                  {registrationTypeText(contest.registrationType)}，报名后可查看题目。
                </div>
                <Button
                  theme="solid"
                  type="primary"
                  loading={registrationLoading}
                  disabled={Boolean(registrationDisabledReason)}
                  onClick={() => submitRegistration()}
                >
                  {registrationLoading ? "报名中" : "立即报名"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {contest.registered ? (
      <Card
        style={{
          border: '1px solid var(--semi-color-border)',
          boxShadow: 'none',
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
                        <div
                          style={{ fontWeight: 600, fontSize: 14, color: 'var(--semi-color-text-0)', cursor: 'pointer' }}
                          onClick={() => openContestProblem(pid)}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.color = 'var(--semi-color-link)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.color = 'var(--semi-color-text-0)'; }}
                        >
                          {problem.title}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--semi-color-text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {contest.type === "OI" && <span>分值: {problem.score ?? 100}</span>}
                          <span>提交: {problem.submissionCount ?? 0}</span>
                          <span>通过: {problem.acceptedCount ?? 0}</span>
                          {isAccepted && <Tag color="green" size="small">已通过</Tag>}
                        </div>
                      </div>
                      <span
                        onClick={() => openContestProblem(pid)}
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
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <Select
                    value={submissionProblemFilter}
                    onChange={(value) => setSubmissionProblemFilter(typeof value === 'string' ? value : 'ALL')}
                    style={{ width: 180 }}
                    size="small"
                    emptyContent
                  >
                    <Select.Option value="ALL">全部题号</Select.Option>
                    {submissionProblemOptions.map((problem) => (
                      <Select.Option key={problem.value} value={problem.value}>{problem.label}</Select.Option>
                    ))}
                  </Select>
                  <Select
                    value={submissionStatusFilter}
                    onChange={(value) => setSubmissionStatusFilter(typeof value === 'string' ? value : 'ALL')}
                    style={{ width: 140 }}
                    size="small"
                    emptyContent
                  >
                    <Select.Option value="ALL">全部状态</Select.Option>
                    {submissionStatusOptions.map((status) => (
                      <Select.Option key={status.value} value={status.value}>{status.label}</Select.Option>
                    ))}
                  </Select>
                  <Select
                    value={submissionLanguageFilter}
                    onChange={(value) => setSubmissionLanguageFilter(typeof value === 'string' ? value : 'ALL')}
                    style={{ width: 140 }}
                    size="small"
                    emptyContent
                  >
                    <Select.Option value="ALL">全部语言</Select.Option>
                    {submissionLanguageOptions.map((language) => (
                      <Select.Option key={language.value} value={language.value}>{language.label}</Select.Option>
                    ))}
                  </Select>
                  <Input
                    prefix={<IconSearch />}
                    placeholder="搜索用户"
                    value={submissionUserKeyword}
                    onChange={setSubmissionUserKeyword}
                    style={{ width: 180 }}
                    size="small"
                    showClear
                  />
                  <Button
                    icon={<IconRefresh />}
                    size="small"
                    theme="borderless"
                    loading={submissionsLoading}
                    onClick={refreshSubmissions}
                  >
                    刷新
                  </Button>
                </div>
              </div>
              {submissionsLoading && submissions.length === 0 ? (
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
                          用户
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
                        {canViewAllSubmissionCode && (
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                            代码
                          </th>
                        )}
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
                            {sub.displayName || sub.username || `User ${sub.userId ?? '?'}`}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-0)' }}>
                            {sub.problemTitle || `#${sub.problemId}`}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                            {sub.language}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Tag color={submissionStatusColor(sub.status)} size="small">
                              {submissionStatusText(sub.status)}
                            </Tag>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                            {formatUsage(sub.timeUsed, 'ms')}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                            {formatUsage(sub.memoryUsed, 'KB')}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-2)' }}>
                            {formatDateTime(submissionTime(sub))}
                          </td>
                          {canViewAllSubmissionCode && (
                            <td style={{ padding: '12px 16px' }}>
                              {codeAction(sub)}
                            </td>
                          )}
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
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  icon={<IconRefresh />}
                  size="small"
                  theme="borderless"
                  loading={mySubmissionsLoading}
                  onClick={refreshMySubmissions}
                >
                  刷新
                </Button>
              </div>
              {mySubmissionsLoading && mySubmissions.length === 0 ? (
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
                          用户
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
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          代码
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
                            {sub.displayName || sub.username || `User ${sub.userId ?? '?'}`}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-0)' }}>
                            {sub.problemTitle || `#${sub.problemId}`}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                            {sub.language}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Tag color={submissionStatusColor(sub.status)} size="small">
                              {submissionStatusText(sub.status)}
                            </Tag>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                            {formatUsage(sub.timeUsed, 'ms')}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                            {formatUsage(sub.memoryUsed, 'KB')}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--semi-color-text-2)' }}>
                            {formatDateTime(submissionTime(sub))}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {codeAction(sub)}
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
                        {scoreboard.showClassOnScoreboard && (
                          <th style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                            班级
                          </th>
                        )}
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
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {row.displayName || row.userId}
                                {scoreboard.problems.length > 0 && row.solved === scoreboard.problems.length && (
                                  <span style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#fff',
                                    backgroundColor: 'var(--semi-color-warning)',
                                    borderRadius: 4,
                                    padding: '1px 5px',
                                    lineHeight: '18px',
                                  }}>AK</span>
                                )}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
                                {identityBadge(row.identityType)}
                                {row.starred ? " · 打星" : ""}
                              </span>
                            </div>
                          </td>
                          {scoreboard.showClassOnScoreboard && (
                            <td style={{ borderBottom: '1px solid var(--semi-color-border)', padding: '12px 16px', color: 'var(--semi-color-text-1)' }}>
                              {row.className || '-'}
                            </td>
                          )}
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
                            colSpan={4 + (scoreboard.showClassOnScoreboard ? 1 : 0) + scoreboard.problems.length}
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
      ) : (
        <Card
          style={{
            border: '1px solid var(--semi-color-border)',
            boxShadow: 'none',
          }}
          bodyStyle={{ padding: 32 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 260 }}>
              <Tag color="orange" size="large">需要报名</Tag>
              <h2 style={{ margin: '16px 0 8px', fontSize: 22, fontWeight: 600, color: 'var(--semi-color-text-0)' }}>
                报名后查看比赛题目
              </h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: '24px', color: 'var(--semi-color-text-1)' }}>
                当前比赛未报名，题目列表和答题入口已隐藏。完成报名后即可查看题目、进入在线 IDE 并参与提交。
              </p>
              <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Tag>{registrationTypeText(contest.registrationType)}</Tag>
                <Tag>{identityBadge(availableRegistrationOption?.identityType)}</Tag>
                <Tag>{contest.participantCount} 人已报名</Tag>
              </div>
              {(registrationMessage || registrationDisabledReason) && (
                <div
                  style={{
                    marginTop: 16,
                    borderRadius: 6,
                    border: '1px solid var(--semi-color-warning-light-default)',
                    backgroundColor: 'var(--semi-color-warning-light-default)',
                    padding: '10px 12px',
                    color: 'var(--semi-color-warning-dark)',
                    fontSize: 13,
                    lineHeight: '20px',
                  }}
                >
                  {registrationMessage || registrationDisabledReason}
                </div>
              )}
            </div>
            <div
              style={{
                width: 260,
                borderRadius: 10,
                border: '1px solid var(--semi-color-primary-light-default)',
                backgroundColor: 'var(--semi-color-primary-light-default)',
                padding: 20,
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--semi-color-text-2)' }}>报名方式</div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 600, color: 'var(--semi-color-primary)' }}>
                {registrationTypeText(contest.registrationType)}
              </div>
              <Button
                block
                theme="solid"
                type="primary"
                loading={registrationLoading}
                disabled={Boolean(registrationDisabledReason)}
                style={{ marginTop: 18 }}
                onClick={() => submitRegistration()}
              >
                {registrationLoading ? "报名中" : "立即报名"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Modal
        title="报名比赛"
        visible={passwordModalVisible}
        onCancel={() => {
          if (registrationLoading) return;
          setPasswordModalVisible(false);
          setRegistrationPassword("");
        }}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button
              disabled={registrationLoading}
              onClick={() => {
                setPasswordModalVisible(false);
                setRegistrationPassword("");
              }}
            >
              取消
            </Button>
            <Button
              theme="solid"
              type="primary"
              loading={registrationLoading}
              onClick={() => submitRegistration(registrationPassword)}
            >
              确认报名
            </Button>
          </div>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--semi-color-text-1)' }}>
            该比赛需要报名密码，请输入密码后继续报名。
          </p>
          <input
            type="password"
            value={registrationPassword}
            placeholder="请输入报名密码"
            onChange={(event) => setRegistrationPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void submitRegistration(registrationPassword);
              }
            }}
            style={{
              height: 36,
              borderRadius: 6,
              border: '1px solid var(--semi-color-border)',
              padding: '0 12px',
              outline: 'none',
            }}
          />
          {registrationMessage && (
            <div style={{ fontSize: 13, color: 'var(--semi-color-danger)' }}>{registrationMessage}</div>
          )}
        </div>
      </Modal>

      <Modal
        title="提交代码"
        visible={!!codeModalSubmission}
        onCancel={() => setCodeModalSubmission(null)}
        footer={null}
        style={{ width: '50%' }}
      >
        {codeModalSubmission && (
          <div>
            <Typography.Text type="tertiary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
              {formatDateTime(submissionTime(codeModalSubmission))}
            </Typography.Text>
            <CodeViewer
              code={codeModalSubmission.code || '(无代码)'}
              language={codeModalSubmission.language}
              height="60vh"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
