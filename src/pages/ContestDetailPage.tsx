/**
 * 比赛详情页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { Button, Card, Checkbox, Input, Modal, Pagination, Select, Spin, Tabs, Tag, Typography } from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  SearchOutlined,
  StarFilled,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchContest,
  fetchContestScoreboard,
  fetchContestSubmissions,
  fetchContestRegistrationOptions,
  fetchMyContestAcceptedProblems,
  fetchMyContestSubmissions,
  fetchSubmissionDetail,
  registerContest,
  type ContestScoreboard,
  type ContestRegistrationOption,
  type PublicContest,
  type SubmissionRecord,
} from '../data/apiClient';
import { CodeViewer, PageContainer } from '../components/common';
import { sanitizeAnnouncementHtml } from '../components/AnnouncementContent';
import { formatDateTime } from '../lib/format';
import { useContestClock } from '../lib/useContestClock';
import { encryptId } from '../utils/cipher';
import { ContestOverviewCard } from './ContestOverviewCard';

const { Text } = Typography;

const VALID_TABS = ['intro', 'problems', 'submissions', 'my-submissions', 'scoreboard'] as const;
const SUBMISSION_PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_SUBMISSION_PAGE_SIZE = 20;
/**
 * TabKey类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type TabKey = (typeof VALID_TABS)[number];

/**
 * 判断ValidTab是否成立。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function isValidTab(tab: string): tab is TabKey {
  return (VALID_TABS as readonly string[]).includes(tab);
}

/**
 * 封装identityBadge相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function identityBadge(type?: string | null) {
  return "已报名";
}

/**
 * 封装报名类型Text相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function registrationTypeText(type?: string | null) {
  if (type === "PASSWORD") return "密码报名";
  if (type === "INVITATION") return "邀请码报名";
  return "公开报名";
}

/**
 * 封装排名Text相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function rankText(rank?: number | null, starred?: boolean | null) {
  return starred ? "打星" : rank ?? "-";
}

/**
 * 封装提交Time相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function submissionTime(submission: SubmissionRecord) {
  return submission.submitTime || submission.createdAt;
}

/**
 * 封装提交状态Color相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function submissionStatusColor(status: string): 'success' | 'error' | 'warning' | 'gold' | 'purple' | 'processing' | 'default' {
  const normalized = status.toUpperCase();
  if (normalized === "AC" || normalized === "ACCEPTED") return "success";
  if (normalized === "WA" || normalized === "WRONG_ANSWER") return "error";
  if (normalized === "TLE" || normalized === "TIME_LIMIT_EXCEEDED") return "gold";
  if (normalized === "MLE" || normalized === "MEMORY_LIMIT_EXCEEDED") return "warning";
  if (normalized === "RE" || normalized === "RUNTIME_ERROR") return "purple";
  if (normalized === "CE" || normalized === "COMPILE_ERROR") return "error";
  if (["WAITING", "PENDING", "QUEUED", "REJUDGE_PENDING", "JUDGING", "COMPILING", "RUNNING"].includes(normalized)) return "processing";
  return "default";
}

/**
 * 封装提交状态Text相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function submissionStatusText(status: string) {
  const map: Record<string, string> = {
    AC: "Accepted",
    ACCEPTED: "Accepted",
    WA: "Wrong Answer",
    WRONG_ANSWER: "Wrong Answer",
    TLE: "Time Limit Exceeded",
    TIME_LIMIT_EXCEEDED: "Time Limit Exceeded",
    MLE: "Memory Limit Exceeded",
    MEMORY_LIMIT_EXCEEDED: "Memory Limit Exceeded",
    RE: "Runtime Error",
    RUNTIME_ERROR: "Runtime Error",
    CE: "Compile Error",
    COMPILE_ERROR: "Compile Error",
    WAITING: "Waiting",
    PENDING: "Pending",
    QUEUED: "Pending",
    REJUDGE_PENDING: "Rejudge Pending",
    JUDGING: "Judging",
    COMPILING: "Compiling",
    RUNNING: "Running",
    NOO: "No Output",
    SE: "System Error",
    SYSTEM_ERROR: "System Error",
    FAILED: "Failed",
  };
  return map[status.toUpperCase()] || status;
}

/**
 * 封装cellStyle相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function cellStyle(hasHiddenSubmissions: boolean, accepted: boolean, attempts: number, score: number, type: ContestScoreboard["type"], firstBlood: boolean) {
  if (hasHiddenSubmissions) return { backgroundColor: '#e6f4ff', borderColor: '#91caff', color: '#1677ff' };
  if (firstBlood) return { backgroundColor: '#047857', borderColor: '#065f46', color: '#fff' };
  if (accepted) return { backgroundColor: '#a7f3d0', borderColor: '#6ee7b7', color: '#065f46' };
  if (type === "OI" && score > 0) return { backgroundColor: '#fffbe6', borderColor: '#fcd34d', color: '#d48806' };
  if (attempts > 0) return { backgroundColor: '#fff1f0', borderColor: '#fecaca', color: '#cf1322' };
  return { backgroundColor: '#f5f5f5', borderColor: '#f0f0f0', color: 'rgba(0, 0, 0, 0.45)' };
}

/**
 * 封装榜单题目标识相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function scoreboardProblemId(problem: { problemId: number; contestProblemId?: number }) {
  return problem.contestProblemId ?? problem.problemId;
}

function acceptedMinute(startTime: string, acceptedAt?: string | null) {
  if (!acceptedAt) return null;
  const start = new Date(startTime).getTime();
  const accepted = new Date(acceptedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(accepted)) return null;
  return Math.max(0, Math.floor((accepted - start) / 60_000));
}

function attemptText(attempts: number) {
  return attempts === 1 ? '1 try' : `${attempts} tries`;
}

/**
 * 渲染比赛详情页面，并协调其数据加载、状态和交互。
 */
export function ContestDetailPage() {
  const { contestId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const id = Number(contestId ?? 0);

  // 从 URL ?tab=xxx 读取当前 tab，默认 problems
  const tabParam = searchParams.get('tab') || 'problems';
  const activeTab: TabKey = isValidTab(tabParam) ? tabParam : 'problems';

  /**
   * 封装set有效Tab相关逻辑。会更新 React 状态并触发重新渲染；可能改变当前路由或查询参数。
   */
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
  const [registrationOptions, setRegistrationOptions] = useState<ContestRegistrationOption[]>([]);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [registrationPassword, setRegistrationPassword] = useState("");
  const [registrationStarred, setRegistrationStarred] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  const [scoreboard, setScoreboard] = useState<ContestScoreboard | null>(null);
  const [scoreboardLoading, setScoreboardLoading] = useState(false);
  const firstBloodRowByProblem = useMemo(() => {
    const earliestByProblem = new Map<number, { rowIndex: number; acceptedAt: number }>();
    scoreboard?.rows.forEach((row, rowIndex) => {
      row.cells.forEach((cell) => {
        if (!cell.accepted || !cell.acceptedAt) return;
        const acceptedAt = new Date(cell.acceptedAt).getTime();
        if (!Number.isFinite(acceptedAt)) return;
        const problemId = scoreboardProblemId(cell);
        const current = earliestByProblem.get(problemId);
        if (!current || acceptedAt < current.acceptedAt) {
          earliestByProblem.set(problemId, { rowIndex, acceptedAt });
        }
      });
    });
    return new Map(Array.from(earliestByProblem, ([problemId, value]) => [problemId, value.rowIndex]));
  }, [scoreboard]);
  const problemStats = useMemo(() => {
    const stats = new Map<number, { submissions: number; accepted: number }>();
    scoreboard?.problems.forEach((problem) => {
      stats.set(scoreboardProblemId(problem), { submissions: 0, accepted: 0 });
    });
    scoreboard?.rows.forEach((row) => {
      row.cells.forEach((cell) => {
        const problemId = scoreboardProblemId(cell);
        const current = stats.get(problemId);
        if (!current) return;
        current.submissions += cell.attempts ?? 0;
        if (cell.accepted) current.accepted += 1;
      });
    });
    return stats;
  }, [scoreboard]);

  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [submissionPage, setSubmissionPage] = useState(1);
  const [submissionPageSize, setSubmissionPageSize] = useState(DEFAULT_SUBMISSION_PAGE_SIZE);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionProblemFilter, setSubmissionProblemFilter] = useState<string>("ALL");
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<string>("ALL");
  const [submissionLanguageFilter, setSubmissionLanguageFilter] = useState<string>("ALL");
  const [submissionUserKeyword, setSubmissionUserKeyword] = useState("");

  const [mySubmissions, setMySubmissions] = useState<SubmissionRecord[]>([]);
  const [mySubmissionsTotal, setMySubmissionsTotal] = useState(0);
  const [mySubmissionPage, setMySubmissionPage] = useState(1);
  const [mySubmissionPageSize, setMySubmissionPageSize] = useState(DEFAULT_SUBMISSION_PAGE_SIZE);
  const [mySubmissionsLoading, setMySubmissionsLoading] = useState(false);
  const [acceptedProblemIds, setAcceptedProblemIds] = useState<number[]>([]);
  const [codeModalSubmission, setCodeModalSubmission] = useState<SubmissionRecord | null>(null);
  const [codeLoadingId, setCodeLoadingId] = useState<number | null>(null);
  const registrationClosed = Boolean(
    contest && (contest.status === "ENDED" || Date.now() >= new Date(contest.endTime).getTime()),
  );

  // AC 状态独立从完整的已通过题目列表获取，不受“我的提交”分页影响。
  const acRawIds = useMemo(() => {
    return new Set(acceptedProblemIds);
  }, [acceptedProblemIds]);

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

  /**
   * 判断LoggedIn是否成立。会读写浏览器本地会话信息。
   */
  const isLoggedIn = () => Boolean(window.localStorage.getItem("qoj.accessToken"));

  /**
   * 封装redirectTo登录相关逻辑。可能改变当前路由或查询参数。
   */
  const redirectToLogin = useCallback(() => {
    navigate(loginPath, { replace: true });
  }, [loginPath, navigate]);

  /**
   * 读取比赛并返回给调用方。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
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

  /**
   * 静默刷新比赛数据。仅在开赛边界同步一次，比赛结束后由用户手动刷新。
   */
  const silentRefreshContest = useCallback(() => {
    if (!id) return;
    fetchContest(id)
      .then((data) => setContest(data))
      .catch(() => {});
  }, [id]);

  /**
   * 进入比赛/查看题目：切换到题目 Tab 并平滑定位到题目区域锚点。
   */
  const handleEnterContest = useCallback(() => {
    setActiveTab("problems");
    window.setTimeout(() => {
      document.getElementById("contest-problems")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [setActiveTab]);

  /**
   * 统一派生比赛阶段与倒计时；开赛时静默同步，结束后停止倒计时并等待用户手动刷新。
   */
  const { phase, countdownLabel, countdownValue } = useContestClock({
    startTime: contest?.startTime ?? "",
    endTime: contest?.endTime ?? "",
    status: contest?.status ?? "NOT_STARTED",
    onStartBoundaryCross: () => {
      void silentRefreshContest();
    },
  });

  // ── 数据加载 ──

  useEffect(() => {
    if (id && !isLoggedIn()) {
      redirectToLogin();
      return;
    }
    void loadContest();
  }, [id, loadContest, redirectToLogin]);

  useEffect(() => {
    if (!contest || contest.registered || registrationClosed || !isLoggedIn()) {
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
  }, [contest, id, registrationClosed]);

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
    setSubmissionsTotal(0);
    setSubmissionPage(1);
    setSubmissionPageSize(DEFAULT_SUBMISSION_PAGE_SIZE);
    setMySubmissions([]);
    setMySubmissionsTotal(0);
    setMySubmissionPage(1);
    setMySubmissionPageSize(DEFAULT_SUBMISSION_PAGE_SIZE);
    setAcceptedProblemIds([]);
  }, [id]);

  // ── 手动刷新函数（替代轮询）──

  const refreshSubmissions = useCallback(() => {
    if (!contest) return;
    setSubmissionsLoading(true);
    fetchContestSubmissions(id, submissionPage, submissionPageSize)
      .then((data) => {
        setSubmissions(data.list);
        setSubmissionsTotal(data.total);
      })
      .catch(() => {
        setSubmissions([]);
        setSubmissionsTotal(0);
      })
      .finally(() => {
        setSubmissionsLoading(false);
      });
  }, [id, contest, submissionPage, submissionPageSize]);

  const refreshMyAcceptedProblems = useCallback(() => {
    if (!contest?.registered) return;
    fetchMyContestAcceptedProblems(id)
      .then((items) => {
        const ids = new Set<number>();
        for (const item of items) {
          if (item.problemId != null) ids.add(item.problemId);
          if (item.contestProblemId != null) ids.add(item.contestProblemId);
        }
        setAcceptedProblemIds(Array.from(ids));
      })
      .catch(() => {
        // 保留上一次成功的状态，避免短暂网络错误导致 AC 标记消失。
      });
  }, [id, contest?.registered]);

  /**
   * 封装refreshMySubmissions相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
  const refreshMySubmissions = useCallback(() => {
    if (!contest) return;
    setMySubmissionsLoading(true);
    fetchMyContestSubmissions(id, mySubmissionPage, mySubmissionPageSize)
      .then((data) => {
        setMySubmissions(data.list);
        setMySubmissionsTotal(data.total);
      })
      .catch(() => {
        setMySubmissions([]);
        setMySubmissionsTotal(0);
      })
      .finally(() => {
        setMySubmissionsLoading(false);
      });
  }, [id, contest, mySubmissionPage, mySubmissionPageSize]);

  // 进入标签页、翻页或调整每页数量时加载数据。
  useEffect(() => {
    if (activeTab === "submissions" && contest?.registered) {
      refreshSubmissions();
    }
  }, [activeTab, contest?.registered, refreshSubmissions]);

  useEffect(() => {
    if ((activeTab === "my-submissions" || activeTab === "problems") && contest?.registered) {
      refreshMySubmissions();
      refreshMyAcceptedProblems();
    }
  }, [activeTab, contest?.registered, refreshMySubmissions, refreshMyAcceptedProblems]);

  /**
   * 封装提交题目Options相关逻辑。对原始数据进行派生或聚合。
   */
  const submissionProblemOptions = useMemo(() => {
    return (contest?.problems ?? []).map((problem) => ({
      value: String(problem.problemId),
      label: `${problem.label || problem.problemId} ${problem.title}`,
    }));
  }, [contest]);

  /**
   * 封装提交状态Options相关逻辑。对原始数据进行派生或聚合。
   */
  const submissionStatusOptions = useMemo(() => {
    return Array.from(new Set(submissions.map((sub) => sub.status).filter(Boolean)))
      .sort((a, b) => submissionStatusText(a).localeCompare(submissionStatusText(b), 'zh-CN'))
      .map((status) => ({
        value: status,
        label: submissionStatusText(status),
      }));
  }, [submissions]);

  /**
   * 封装提交LanguageOptions相关逻辑。对原始数据进行派生或聚合。
   */
  const submissionLanguageOptions = useMemo(() => {
    return Array.from(new Set(submissions.map((sub) => sub.language).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
      .map((language) => ({
        value: language,
        label: language,
      }));
  }, [submissions]);

  /**
   * 封装filteredSubmissions相关逻辑。对原始数据进行派生或聚合。
   */
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

  /**
   * 封装available报名Option相关逻辑。对原始数据进行派生或聚合。
   */
  const availableRegistrationOption = useMemo(() => {
    return registrationOptions.find((option) => option.available) ?? registrationOptions[0] ?? null;
  }, [registrationOptions]);

  const registrationDisabledReason = availableRegistrationOption && !availableRegistrationOption.available
    ? availableRegistrationOption.disabledReason || "当前账号暂不可报名该比赛"
    : "";
  const canViewProblemsAfterEnd = Boolean(
    contest
      && registrationClosed
      && contest.allowAfterEndViewProblem !== false
      && (!contest.hasPassword || contest.registered),
  );
  const afterEndPasswordAccessBlocked = Boolean(
    contest && registrationClosed && contest.hasPassword && !contest.registered,
  );
  const canViewProblemSection = Boolean(contest?.registered || canViewProblemsAfterEnd);

  /**
   * 封装open比赛题目相关逻辑。会更新 React 状态并触发重新渲染。
   */
  const openContestProblem = (contestProblemId: number, contestProblemLabel: string) => {
    if (!isLoggedIn()) {
      redirectToLogin();
      return;
    }
    if (!contest?.registered && !canViewProblemsAfterEnd) {
      setRegistrationMessage("请先报名比赛，报名成功后即可查看题目。");
      return;
    }
    const query = new URLSearchParams({
      contestId: String(id),
      contestProblemLabel,
    });
    window.open(`/practice/problem/cp${encryptId(contestProblemId)}?${query.toString()}`, '_blank');
  };

  /**
   * 创建或提交报名。包含异步流程并由调用方处理完成或失败状态；会更新 React 状态并触发重新渲染。
   */
  const submitRegistration = async (password?: string, starred?: boolean) => {
    if (!contest) return;
    if (!isLoggedIn()) {
      redirectToLogin();
      return;
    }
    if (registrationClosed) {
      setRegistrationMessage("比赛已结束，报名已截止。");
      setPasswordModalVisible(false);
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
        starred: starred === true,
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

  /**
   * 打开报名确认弹窗：重置密码与打星状态，供密码/打星选择后提交报名。
   */
  const openRegistrationModal = () => {
    setRegistrationPassword("");
    setRegistrationStarred(Boolean(contest?.registeredStarred));
    setPasswordModalVisible(true);
  };

  /**
   * 格式化Usage。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const formatUsage = (value: number | null | undefined, unit: string) => {
    return value == null ? '-' : `${value}${unit}`;
  };

  const canViewAllSubmissionCode = contest?.status === 'ENDED' && Boolean(contest.allowAfterEndViewCode);

  /**
   * 封装open编码相关逻辑。包含异步流程并由调用方处理完成或失败状态；会访问后端接口；会更新 React 状态并触发重新渲染。
   */
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

  /**
   * 封装编码Action相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const codeAction = (sub: SubmissionRecord) => {
    const loadingCode = codeLoadingId === sub.id;
    const disabled = codeLoadingId !== null;
    /**
     * 封装trigger相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
     */
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
          color: loadingCode ? 'rgba(0, 0, 0, 0.45)' : '#1677ff',
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
        <Spin />
        <div style={{ marginTop: 12, fontSize: 14, color: 'rgba(0, 0, 0, 0.45)' }}>比赛加载中</div>
      </div>
    );
  }

  if (!contest) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={() => navigate('/contests')}
        >
          返回比赛列表
        </Button>
        <Card
          style={{
            border: '1px solid #fff1f0',
            backgroundColor: '#fff1f0',
          }}
        >
          <div style={{ color: '#cf1322', fontSize: 14 }}>
            {message || "比赛不存在"}
          </div>
        </Card>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'intro',
      label: '比赛介绍',
      children: (
        <div style={{ padding: 16 }}>
          {contest.description ? (
            <div
              className="contest-intro-html announcement-html markdown-math"
              dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(contest.description) }}
            />
          ) : (
            <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: 'rgba(0, 0, 0, 0.45)' }}>
              暂无比赛介绍
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'problems',
      label: '题目列表',
      children: (
        <div style={{ padding: 16 }}>
          {!contest.problems || contest.problems.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.45)', marginBottom: 8 }}>
                {contest.status === "NOT_STARTED" ? "比赛尚未开始，题目列表暂未公开" : "暂无题目"}
              </div>
              {contest.status === "NOT_STARTED" && (
                <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.25)' }}>
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
                    border: isAccepted ? '1px solid #52c41a' : '1px solid #f0f0f0',
                    backgroundColor: isAccepted ? '#f6ffed' : '#fff',
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
                      backgroundColor: isAccepted ? '#52c41a' : '#e6f4ff',
                      color: isAccepted ? '#fff' : '#1677ff',
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {isAccepted ? '✓' : problem.label}
                  </div>
                  <div>
<div
                    role="link"
                    tabIndex={0}
                    onClick={() => openContestProblem(pid, problem.label)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') openContestProblem(pid, problem.label);
                    }}
                    style={{ fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'rgba(0, 0, 0, 0.88)', cursor: 'pointer' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.color = '#1677ff'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.color = 'rgba(0, 0, 0, 0.88)'; }}
                  >
                      {problem.title}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, color: 'rgba(0, 0, 0, 0.45)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {contest.type === "OI" && <span>分值: {problem.score ?? 100}</span>}
                      {isAccepted && <Tag color="success" style={{ marginInlineEnd: 0 }}>已通过</Tag>}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 3ch',
                      rowGap: 2,
                      columnGap: 8,
                      minWidth: 78,
                      color: 'rgba(0, 0, 0, 0.45)',
                      fontSize: 16,
                      lineHeight: '24px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>提交</span>
                    <strong style={{ color: 'rgba(0, 0, 0, 0.88)', fontSize: 16, width: '3ch', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {problem.submissionCount ?? 0}
                    </strong>
                    <span>通过</span>
                    <strong style={{ color: '#52c41a', fontSize: 16, width: '3ch', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {problem.acceptedCount ?? 0}
                    </strong>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      ),
    },
    ...(contest.registered ? [
      {
        key: 'submissions',
        label: '提交记录',
        children: (
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                <Select
                  value={submissionProblemFilter}
                  onChange={(value) => {
                    setSubmissionProblemFilter(typeof value === 'string' ? value : 'ALL');
                    setSubmissionPage(1);
                  }}
                  style={{ width: 180 }}
                  size="small"
                  options={[
                    { value: 'ALL', label: '全部题号' },
                    ...submissionProblemOptions,
                  ]}
                />
                <Select
                  value={submissionStatusFilter}
                  onChange={(value) => {
                    setSubmissionStatusFilter(typeof value === 'string' ? value : 'ALL');
                    setSubmissionPage(1);
                  }}
                  style={{ width: 140 }}
                  size="small"
                  options={[
                    { value: 'ALL', label: '全部状态' },
                    ...submissionStatusOptions,
                  ]}
                />
                <Select
                  value={submissionLanguageFilter}
                  onChange={(value) => {
                    setSubmissionLanguageFilter(typeof value === 'string' ? value : 'ALL');
                    setSubmissionPage(1);
                  }}
                  style={{ width: 140 }}
                  size="small"
                  options={[
                    { value: 'ALL', label: '全部语言' },
                    ...submissionLanguageOptions,
                  ]}
                />
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="搜索用户"
                  value={submissionUserKeyword}
                  onChange={(event) => {
                    setSubmissionUserKeyword(event.target.value);
                    setSubmissionPage(1);
                  }}
                  style={{ width: 180 }}
                  size="small"
                  allowClear
                />
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  loading={submissionsLoading}
                  onClick={refreshSubmissions}
                >
                  刷新
                </Button>
              </div>
            </div>
            {submissionsLoading && submissions.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center' }}>
                <Spin />
                <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(0, 0, 0, 0.45)' }}>加载中</div>
              </div>
            ) : (
              <>
                {filteredSubmissions.length === 0 ? (
                  <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: 'rgba(0, 0, 0, 0.45)' }}>
                    暂无提交记录
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                    <table style={{ minWidth: '100%', fontSize: 14 }}>
                      <thead style={{ backgroundColor: '#fafafa' }}>
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
                            style={{ borderTop: '1px solid #f0f0f0' }}
                          >
                            <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.65)' }}>{sub.id}</td>
                            <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.88)' }}>
                              {sub.displayName || sub.username || `User ${sub.userId ?? '?'}`}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.88)' }}>
                              {sub.problemTitle || `#${sub.problemId}`}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.65)' }}>
                              {sub.language}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <Tag color={submissionStatusColor(sub.status)} style={{ marginInlineEnd: 0 }}>
                                {submissionStatusText(sub.status)}
                              </Tag>
                            </td>
                            <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.45)' }}>
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
                {submissionsTotal > 0 && (
                  <div className="front-table-pagination">
                    <Text type="secondary">
                      显示第 {Math.min((submissionPage - 1) * submissionPageSize + 1, submissionsTotal)} 条-第 {Math.min(submissionPage * submissionPageSize, submissionsTotal)} 条，共 {submissionsTotal} 条
                    </Text>
                    <Pagination
                      current={submissionPage}
                      pageSize={submissionPageSize}
                      pageSizeOptions={SUBMISSION_PAGE_SIZE_OPTIONS}
                      total={submissionsTotal}
                      showSizeChanger
                      onChange={(nextPage, nextPageSize) => {
                        if (nextPageSize !== submissionPageSize) {
                          setSubmissionPageSize(nextPageSize);
                          setSubmissionPage(1);
                          return;
                        }
                        setSubmissionPage(nextPage);
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        ),
      },
      {
        key: 'my-submissions',
        label: '我的提交',
        children: (
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                icon={<ReloadOutlined />}
                size="small"
                loading={mySubmissionsLoading}
                onClick={refreshMySubmissions}
              >
                刷新
              </Button>
            </div>
            {mySubmissionsLoading && mySubmissions.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center' }}>
                <Spin />
                <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(0, 0, 0, 0.45)' }}>加载中</div>
              </div>
            ) : (
              <>
                {mySubmissions.length === 0 ? (
                  <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: 'rgba(0, 0, 0, 0.45)' }}>
                    暂无提交记录
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                    <table style={{ minWidth: '100%', fontSize: 14 }}>
                      <thead style={{ backgroundColor: '#fafafa' }}>
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
                            style={{ borderTop: '1px solid #f0f0f0' }}
                          >
                            <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.65)' }}>{sub.id}</td>
                            <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.88)' }}>
                              {sub.displayName || sub.username || `User ${sub.userId ?? '?'}`}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.88)' }}>
                              {sub.problemTitle || `#${sub.problemId}`}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.65)' }}>
                              {sub.language}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <Tag color={submissionStatusColor(sub.status)} style={{ marginInlineEnd: 0 }}>
                                {submissionStatusText(sub.status)}
                              </Tag>
                            </td>
                            <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.65)' }}>
                              {formatUsage(sub.timeUsed, 'ms')}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.65)' }}>
                              {formatUsage(sub.memoryUsed, 'KB')}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.45)' }}>
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
                {mySubmissionsTotal > 0 && (
                  <div className="front-table-pagination">
                    <Text type="secondary">
                      显示第 {Math.min((mySubmissionPage - 1) * mySubmissionPageSize + 1, mySubmissionsTotal)} 条-第 {Math.min(mySubmissionPage * mySubmissionPageSize, mySubmissionsTotal)} 条，共 {mySubmissionsTotal} 条
                    </Text>
                    <Pagination
                      current={mySubmissionPage}
                      pageSize={mySubmissionPageSize}
                      pageSizeOptions={SUBMISSION_PAGE_SIZE_OPTIONS}
                      total={mySubmissionsTotal}
                      showSizeChanger
                      onChange={(nextPage, nextPageSize) => {
                        if (nextPageSize !== mySubmissionPageSize) {
                          setMySubmissionPageSize(nextPageSize);
                          setMySubmissionPage(1);
                          return;
                        }
                        setMySubmissionPage(nextPage);
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        ),
      },
      {
        key: 'scoreboard',
        label: '排行榜',
        children: (
          <div style={{ padding: 16 }}>
            {scoreboardLoading ? (
              <div style={{ padding: '48px 0', textAlign: 'center' }}>
                <Spin />
                <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(0, 0, 0, 0.45)' }}>排行榜加载中</div>
              </div>
            ) : !scoreboard ? (
              <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: 'rgba(0, 0, 0, 0.45)' }}>
                排行榜暂不可用
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {scoreboard.boardState === 'FROZEN' && (
                  <div style={{ color: '#d48806', fontSize: 14, fontWeight: 600 }}>
                    已经封榜
                  </div>
                )}
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                  <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 10,
                          backgroundColor: '#f5f5f5',
                          borderBottom: '1px solid #f0f0f0',
                          padding: '12px',
                          textAlign: 'left',
                          fontWeight: 600,
                        }}
                      >
                        排名
                      </th>
                      <th style={{ borderBottom: '1px solid #f0f0f0', padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                        用户
                      </th>
                      {scoreboard.showClassOnScoreboard && (
                        <th style={{ borderBottom: '1px solid #f0f0f0', padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                          班级
                        </th>
                      )}
                      <th style={{ borderBottom: '1px solid #f0f0f0', padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                        通过
                      </th>
                      <th style={{ borderBottom: '1px solid #f0f0f0', padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                        {scoreboard.type === "OI" ? "分数" : "时间"}
                      </th>
                      {scoreboard.problems.map((problem) => {
                        const problemKey = scoreboardProblemId(problem);
                        const fallbackStats = problemStats.get(problemKey) ?? { submissions: 0, accepted: 0 };
                        const submissionCount = problem.submissionCount ?? fallbackStats.submissions;
                        const acceptedCount = problem.acceptedCount ?? fallbackStats.accepted;
                        return (
                          <th
                            key={problemKey}
                            style={{ borderBottom: '1px solid #f0f0f0', padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}
                            title={problem.title}
                          >
                            <div>{problem.label}</div>
                            <div
                              style={{ marginTop: 3, fontSize: 11, lineHeight: '16px', fontWeight: 400, color: 'rgba(0, 0, 0, 0.45)', whiteSpace: 'nowrap' }}
                              title={`提交 ${submissionCount} / 通过 ${acceptedCount}`}
                            >
                              {submissionCount} / {acceptedCount}
                            </div>
                            {scoreboard.type === "OI" && (
                              <div style={{ fontSize: 11, lineHeight: '16px', fontWeight: 400, color: 'rgba(0, 0, 0, 0.45)', whiteSpace: 'nowrap' }}>
                                {problem.score ?? 0} 分
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {scoreboard.rows.map((row, rowIndex) => (
                      <tr
                        key={`${row.identityType ?? "PERSONAL"}-${row.identityId ?? row.userId}`}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fafafa';
                          const firstCell = e.currentTarget.querySelector('td:first-child') as HTMLElement;
                          if (firstCell) firstCell.style.backgroundColor = '#fafafa';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '';
                          const firstCell = e.currentTarget.querySelector('td:first-child') as HTMLElement;
                          if (firstCell) firstCell.style.backgroundColor = '#ffffff';
                        }}
                      >
                        <td
                          style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 10,
                            backgroundColor: '#ffffff',
                            borderBottom: '1px solid #f0f0f0',
                            padding: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {rankText(row.rank, row.starred)}
                        </td>
                        <td style={{ borderBottom: '1px solid #f0f0f0', padding: '12px 16px', fontWeight: 500 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {row.displayName || row.userId}
                              {row.teamName && (
                                <Tag color="blue" style={{ marginLeft: 2, marginInlineEnd: 0 }}>
                                  {row.teamName}
                                </Tag>
                              )}
                              {scoreboard.problems.length > 0 && row.solved === scoreboard.problems.length && (
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: '#fff',
                                  backgroundColor: '#faad14',
                                  borderRadius: 4,
                                  padding: '1px 5px',
                                  lineHeight: '18px',
                                }}>AK</span>
                              )}
                            </span>
                            <span style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.45)' }}>
                              {row.studentNo}
                              {row.starred ? " · 打星" : ""}
                            </span>
                          </div>
                        </td>
                        {scoreboard.showClassOnScoreboard && (
                          <td style={{ borderBottom: '1px solid #f0f0f0', padding: '12px 16px', color: 'rgba(0, 0, 0, 0.65)' }}>
                            {row.className || '-'}
                          </td>
                        )}
                        <td style={{ borderBottom: '1px solid #f0f0f0', padding: '12px', textAlign: 'center' }}>
                          {row.solved}
                        </td>
                        <td style={{ borderBottom: '1px solid #f0f0f0', padding: '12px', textAlign: 'center', fontWeight: 600 }}>
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
                          const hasHiddenSubmissions = Boolean(cell?.hasHiddenSubmissions);
                          const hiddenAttempts = cell?.hiddenAttempts ?? 0;
                          const isFirstBlood = accepted && firstBloodRowByProblem.get(problemKey) === rowIndex;
                          const minute = acceptedMinute(scoreboard.startTime, cell?.acceptedAt);
                          const cellStyles = cellStyle(hasHiddenSubmissions, accepted, attempts, score, scoreboard.type, isFirstBlood);
                          return (
                            <td
                              key={problemKey}
                              style={{ borderBottom: '1px solid #f0f0f0', padding: '8px', textAlign: 'center' }}
                            >
                              <div
                                style={{
                                  position: 'relative',
                                  margin: '0 auto',
                                  minWidth: 76,
                                  minHeight: scoreboard.type === "OI" ? 76 : 64,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 3,
                                  borderRadius: 6,
                                  border: '1px solid transparent',
                                  padding: '8px 10px',
                                  fontWeight: 600,
                                  ...cellStyles,
                                }}
                                title={hasHiddenSubmissions ? "封榜后有提交" : isFirstBlood ? "一血" : accepted ? "已通过" : attempts > 0 ? "未通过" : "暂无提交"}
                              >
                                {!hasHiddenSubmissions && isFirstBlood && (
                                  <StarFilled aria-hidden="true" style={{ position: 'absolute', top: 4, left: 5, fontSize: 10, lineHeight: 1, color: '#fef3c7' }} />
                                )}
                                {hasHiddenSubmissions ? (
                                  <>
                                    <span aria-hidden="true" style={{ minHeight: 18, lineHeight: '18px', fontSize: 18 }}>+</span>
                                    <span style={{ fontSize: 11, lineHeight: '16px', opacity: 0.82, whiteSpace: 'nowrap' }}>{attemptText(hiddenAttempts)}</span>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, lineHeight: '18px', whiteSpace: 'nowrap' }}>
                                      <span>{accepted && minute != null ? `${minute} min` : '-'}</span>
                                    </div>
                                    {scoreboard.type === "OI" && attempts > 0 && (
                                      <div style={{ fontSize: 11, lineHeight: '16px', opacity: 0.9, whiteSpace: 'nowrap' }}>{score} pts</div>
                                    )}
                                    <div style={{ fontSize: 11, lineHeight: '16px', opacity: 0.82, whiteSpace: 'nowrap' }}>
                                      {attemptText(attempts)}
                                    </div>
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
                        <td
                          colSpan={4 + (scoreboard.showClassOnScoreboard ? 1 : 0) + scoreboard.problems.length}
                          style={{ padding: '48px 16px', textAlign: 'center', color: 'rgba(0, 0, 0, 0.45)' }}
                        >
                          暂无提交数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ),
      },
    ] : []),
  ];

  return (
    <PageContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <ContestOverviewCard
          contest={contest}
          phase={phase}
          countdownLabel={countdownLabel}
          countdownValue={countdownValue}
          registrationClosed={registrationClosed}
          registrationLoading={registrationLoading}
          registrationDisabledReason={registrationDisabledReason}
          canViewProblemsAfterEnd={canViewProblemsAfterEnd}
          onRegister={openRegistrationModal}
          onEnterContest={handleEnterContest}
        />

      {canViewProblemSection ? (
      <Card
        id="contest-problems"
        className="contest-detail-static-card"
        style={{
          border: '1px solid #f0f0f0',
          boxShadow: 'none',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          activeKey={tabItems.some((item) => item.key === activeTab) ? activeTab : 'problems'}
          onChange={(key) => setActiveTab(key)}
          style={{ padding: '0 24px' }}
          items={tabItems}
        />
      </Card>
      ) : (
        <Card
          className="contest-detail-static-card"
          style={{
            border: '1px solid #f0f0f0',
            boxShadow: 'none',
          }}
          styles={{ body: { padding: 32 } }}
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
              <Tag color="orange" style={{ marginInlineEnd: 0 }}>{registrationClosed ? "赛后题目关闭" : "需要报名"}</Tag>
              <h2 style={{ margin: '16px 0 8px', fontSize: 22, fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }}>
                {registrationClosed ? "比赛题目暂不可查看" : "报名后查看比赛题目"}
              </h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: '24px', color: 'rgba(0, 0, 0, 0.65)' }}>
                {registrationClosed
                  ? afterEndPasswordAccessBlocked
                    ? "比赛已结束，密码赛仅限已报名的参赛者查看题目。"
                    : "比赛已结束，后台当前关闭了赛后题目查看。"
                  : "当前比赛未报名，题目列表和答题入口已隐藏。完成报名后即可查看题目、进入在线 IDE 并参与提交。"}
              </p>
              <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Tag style={{ marginInlineEnd: 0 }}>{registrationTypeText(contest.registrationType)}</Tag>
                <Tag style={{ marginInlineEnd: 0 }}>{identityBadge(availableRegistrationOption?.identityType)}</Tag>
                <Tag style={{ marginInlineEnd: 0 }}>{contest.participantCount} 人已报名</Tag>
              </div>
              {(registrationMessage || registrationDisabledReason) && (
                <div
                  style={{
                    marginTop: 16,
                    borderRadius: 6,
                    border: '1px solid #fffbe6',
                    backgroundColor: '#fffbe6',
                    padding: '10px 12px',
                    color: '#d48806',
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
                border: '1px solid #e6f4ff',
                backgroundColor: '#e6f4ff',
                padding: 20,
              }}
            >
              <div style={{ fontSize: 13, color: 'rgba(0, 0, 0, 0.45)' }}>
                {registrationClosed ? "报名状态" : "报名方式"}
              </div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 600, color: '#1677ff' }}>
                {registrationClosed ? "报名已截止" : registrationTypeText(contest.registrationType)}
              </div>
              {!registrationClosed && (
                <Button
                  block
                  type="primary"
                  loading={registrationLoading}
                  disabled={Boolean(registrationDisabledReason)}
                  style={{ marginTop: 18 }}
                  onClick={openRegistrationModal}
                >
                  {registrationLoading ? "报名中" : "立即报名"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <Modal
        title="报名比赛"
        open={passwordModalVisible}
        onCancel={() => {
          if (registrationLoading) return;
          setPasswordModalVisible(false);
          setRegistrationPassword("");
          setRegistrationStarred(false);
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
              type="primary"
              loading={registrationLoading}
              onClick={() => submitRegistration(registrationPassword, registrationStarred)}
            >
              确认报名
            </Button>
          </div>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(0, 0, 0, 0.65)' }}>
            {contest?.registrationType === "PASSWORD"
              ? "该比赛需要报名密码，请输入密码后继续报名。"
              : "确认以当前账号报名该比赛？"}
          </p>
          {contest?.registrationType === "PASSWORD" && (
            <Input.Password
              value={registrationPassword}
              placeholder="请输入报名密码"
              onChange={(event) => setRegistrationPassword(event.target.value)}
              onPressEnter={() => void submitRegistration(registrationPassword, registrationStarred)}
            />
          )}
          {contest?.allowStarRegistration && (
            <Checkbox
              checked={registrationStarred}
              onChange={(event) => setRegistrationStarred(event.target.checked)}
            >
              打星报名
            </Checkbox>
          )}
          {registrationMessage && (
            <div style={{ fontSize: 13, color: '#ff4d4f' }}>{registrationMessage}</div>
          )}
        </div>
      </Modal>

      <Modal
        title="提交代码"
        open={!!codeModalSubmission}
        onCancel={() => setCodeModalSubmission(null)}
        footer={null}
        width="60%"
        styles={{ body: { paddingTop: 20 } }}
      >
        {codeModalSubmission && (
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
              {formatDateTime(submissionTime(codeModalSubmission))}
            </Text>
            <CodeViewer
              code={codeModalSubmission.code || '(无代码)'}
              language={codeModalSubmission.language}
              height="60vh"
            />
          </div>
        )}
      </Modal>
    </div>
    </PageContainer>
  );
}
