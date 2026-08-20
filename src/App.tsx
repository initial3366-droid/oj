/**
 * QOJ 前端根路由配置。
 *
 * 路由结构：
 * - FrontLayout（前台）：首页、题库、练习、比赛、榜单、用户中心、登录注册
 * - AdminRoutes（/admin/*）：后台管理独立路由树
 * - ContestPublicScoreboardPage：公开榜单独立页面（无 FrontLayout）
 * - DataStructureLabPage：数据结构实验室独立页面（无 FrontLayout）
 * - NotFoundPage：404 兜底
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal, Typography } from "antd";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { FrontLayout } from "./layouts/FrontLayout";
import { ADMIN_PREFIX } from "./config";
import { DocumentTitle } from "./components/DocumentTitle";
import { useOjData } from "./data/OjDataProvider";
import { fetchContest, fetchContests } from "./data/apiClient";
import { wsClient } from "./utils/websocket";

interface ContestEndTarget {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface ContestEndObservation {
  endAt: number;
  sawBeforeEnd: boolean;
  status: string;
}

/**
 * 规范化比赛状态，兼容首页缓存使用的中文状态和比赛接口使用的枚举状态。
 */
function normalizeContestStatus(status: string | undefined): string {
  const value = String(status ?? "").trim().toUpperCase();
  if (value === "ENDED" || value.includes("已结束")) return "ENDED";
  if (value === "RUNNING" || value.includes("进行中")) return "RUNNING";
  if (value === "NOT_STARTED" || value.includes("未开始")) return "NOT_STARTED";
  return value;
}

/**
 * 将路由或查询参数中的比赛编号解析为安全的正整数。
 */
function parseContestId(value: string | null | undefined): number | null {
  const id = Number(value ?? 0);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * 全局比赛结束通知。只在比赛从未结束状态跨过结束时间，或收到 ENDED 推送时提醒一次。
 * 确认后仅移除当前弹窗，不刷新页面、不重新拉取比赛数据。
 */
function ContestEndNotice() {
  const location = useLocation();
  const { state } = useOjData();
  const [routeContest, setRouteContest] = useState<ContestEndTarget | null>(null);
  const [listContests, setListContests] = useState<ContestEndTarget[]>([]);
  const [noticeQueue, setNoticeQueue] = useState<number[]>([]);
  const handledContestIdsRef = useRef(new Set<number>());
  const observationsRef = useRef(new Map<number, ContestEndObservation>());

  const pathContestId = useMemo(() => {
    const match = location.pathname.match(/(?:^|\/)contests\/(\d+)(?:\/|$)/);
    return parseContestId(match?.[1]);
  }, [location.pathname]);
  const queryContestId = useMemo(
    () => parseContestId(new URLSearchParams(location.search).get("contestId")),
    [location.search],
  );
  const activeContestId = pathContestId ?? queryContestId;

  useEffect(() => {
    if (!activeContestId) {
      setRouteContest(null);
      return;
    }

    let cancelled = false;
    fetchContest(activeContestId)
      .then((contest) => {
        if (cancelled) return;
        setRouteContest({
          id: contest.id,
          title: contest.title,
          startTime: contest.startTime,
          endTime: contest.endTime,
          status: contest.status,
        });
      })
      .catch(() => {
        if (!cancelled) setRouteContest(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeContestId]);

  useEffect(() => {
    if (location.pathname.replace(/\/$/, "") !== "/contests") {
      setListContests([]);
      return;
    }

    let cancelled = false;
    fetchContests(1, 100)
      .then(({ list }) => {
        if (cancelled) return;
        setListContests(list.map((contest) => ({
          id: contest.id,
          title: contest.title,
          startTime: contest.startTime,
          endTime: contest.endTime,
          status: contest.status,
        })));
      })
      .catch(() => {
        if (!cancelled) setListContests([]);
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const targets = useMemo(() => {
    const byId = new Map<number, ContestEndTarget>();
    state.contests.forEach((contest) => {
      const id = parseContestId(contest.id);
      if (id) {
        byId.set(id, {
          id,
          title: contest.title,
          startTime: contest.startsAt,
          endTime: contest.endsAt,
          status: contest.status,
        });
      }
    });
    listContests.forEach((contest) => byId.set(contest.id, contest));
    if (routeContest) byId.set(routeContest.id, routeContest);
    return Array.from(byId.values());
  }, [listContests, routeContest, state.contests]);

  const targetIds = useMemo(
    () => targets.map((target) => target.id).sort((a, b) => a - b),
    [targets],
  );
  const targetIdKey = targetIds.join(",");
  const targetById = useMemo(
    () => new Map(targets.map((target) => [target.id, target])),
    [targets],
  );

  const enqueueNotice = useCallback((contestId: number) => {
    if (handledContestIdsRef.current.has(contestId)) return;
    handledContestIdsRef.current.add(contestId);
    setNoticeQueue((current) => current.includes(contestId) ? current : [...current, contestId]);
  }, []);

  // 记录首次观察到的状态，避免用户打开已经结束的比赛时立即弹出旧通知。
  useEffect(() => {
    const now = Date.now();
    targets.forEach((target) => {
      const endAt = new Date(target.endTime).getTime();
      if (!Number.isFinite(endAt)) return;
      const status = normalizeContestStatus(target.status);
      const previous = observationsRef.current.get(target.id);
      if (!previous || previous.endAt !== endAt) {
        observationsRef.current.set(target.id, {
          endAt,
          sawBeforeEnd: now < endAt && status !== "ENDED",
          status,
        });
        return;
      }
      if (previous.status !== "ENDED" && status === "ENDED") {
        enqueueNotice(target.id);
      }
      previous.status = status;
    });
  }, [enqueueNotice, targets]);

  // 不依赖登录和 WebSocket，匿名用户在首页或写题页也能按结束时间收到通知。
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      targets.forEach((target) => {
        const observation = observationsRef.current.get(target.id);
        if (!observation || !observation.sawBeforeEnd || now < observation.endAt) return;
        observation.sawBeforeEnd = false;
        observation.status = "ENDED";
        enqueueNotice(target.id);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [enqueueNotice, targets]);

  // 登录用户优先接收服务端状态推送；本地结束时间检测仍作为断线和匿名访问兜底。
  useEffect(() => {
    if (!targetIds.length) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    targetIds.forEach((contestId) => {
      wsClient.subscribeToContestStatus(contestId, (update) => {
        if (normalizeContestStatus(update.status) === "ENDED") {
          enqueueNotice(contestId);
        }
      })
        .then((cleanup) => {
          if (cancelled) {
            cleanup();
          } else {
            cleanups.push(cleanup);
          }
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [enqueueNotice, targetIdKey, targetIds]);

  const activeNoticeContestId = noticeQueue[0] ?? null;
  const activeNoticeContest = activeNoticeContestId == null
    ? null
    : targetById.get(activeNoticeContestId) ?? null;

  const acknowledgeNotice = () => {
    setNoticeQueue((current) => current.slice(1));
  };

  return (
    <Modal
      title="比赛已结束"
      open={activeNoticeContestId != null}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={
        <Button type="primary" onClick={acknowledgeNotice}>
          确定
        </Button>
      }
    >
      <Typography.Paragraph style={{ marginBottom: 0 }}>
        {activeNoticeContest?.title ? `“${activeNoticeContest.title}”已结束，请手动刷新页面获取最新状态。` : "比赛已结束，请手动刷新页面获取最新状态。"}
      </Typography.Paragraph>
    </Modal>
  );
}

const AuthPage = lazy(() => import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })));
const ContestsPage = lazy(() => import("./pages/ContestsPage").then((module) => ({ default: module.ContestsPage })));
const ContestDetailPage = lazy(() => import("./pages/ContestDetailPage").then((module) => ({ default: module.ContestDetailPage })));
const ContestScoreboardPage = lazy(() => import("./pages/ContestScoreboardPage").then((module) => ({ default: module.ContestScoreboardPage })));
const ContestPublicScoreboardPage = lazy(() => import("./pages/ContestPublicScoreboardPage").then((module) => ({ default: module.ContestPublicScoreboardPage })));
const DataStructureLabPage = lazy(() => import("./pages/DataStructureLabPage").then((module) => ({ default: module.DataStructureLabPage })));
const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage").then((module) => ({ default: module.LeaderboardPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const PracticeAssignmentPage = lazy(() => import("./pages/PracticeAssignmentPage").then((module) => ({ default: module.PracticeAssignmentPage })));
const PracticeListPage = lazy(() => import("./pages/PracticeListPage").then((module) => ({ default: module.PracticeListPage })));
const PracticePage = lazy(() => import("./pages/PracticePage").then((module) => ({ default: module.PracticePage })));
const PracticeHistoryPage = lazy(() => import("./pages/PracticeHistoryPage").then((module) => ({ default: module.PracticeHistoryPage })));
const ProblemSubmissionsPage = lazy(() => import("./pages/ProblemSubmissionsPage").then((module) => ({ default: module.ProblemSubmissionsPage })));
const SubmissionQueuePage = lazy(() => import("./pages/SubmissionQueuePage").then((module) => ({ default: module.SubmissionQueuePage })));
const ProblemsPage = lazy(() => import("./pages/ProblemsPage").then((module) => ({ default: module.ProblemsPage })));
const UserCenterPage = lazy(() => import("./pages/UserCenterPage").then((module) => ({ default: module.UserCenterPage })));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage").then((module) => ({ default: module.UserProfilePage })));
const AdminRoutes = lazy(() => import("./admin/routes/adminRoutes").then((module) => ({ default: module.AdminRoutes })));
const TeacherRoutes = lazy(() => import("./teacher/TeacherRoutes").then((module) => ({ default: module.TeacherRoutes })));

/**
 * 渲染路由兜底界面组件，并协调其数据加载、状态和交互。
 */
function RouteFallback() {
  return <div style={{ minHeight: 320, display: "grid", placeItems: "center" }}>加载中...</div>;
}

/**
 * 渲染应用组件，并协调其数据加载、状态和交互。
 */
export function App() {
  return (
    <>
      <DocumentTitle />
      <ContestEndNotice />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        {/* 外榜路由 - 独立页面，不使用 FrontLayout */}
        <Route path="/contests/:contestId/public-scoreboard" element={<ContestPublicScoreboardPage />} />
        <Route path="/practice/problem/:problemId" element={<PracticePage />} />
        <Route path="/practice/history/:problemId" element={<PracticeHistoryPage />} />
        <Route path="/data-structures" element={<DataStructureLabPage />} />

        <Route element={<FrontLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/problems" element={<ProblemsPage />} />
          <Route path="/problems/:problemId/submissions" element={<ProblemSubmissionsPage />} />
          <Route path="/practice" element={<PracticeListPage />} />
          <Route path="/practice/:practiceId" element={<PracticeAssignmentPage />} />
          <Route path="/contests" element={<ContestsPage />} />
          <Route path="/contests/:contestId" element={<ContestDetailPage />} />
          <Route path="/contests/:contestId/scoreboard" element={<ContestScoreboardPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/submission-queue" element={<SubmissionQueuePage />} />
          <Route path="/users/:userId" element={<UserProfilePage />} />
          <Route path="/user-center" element={<UserCenterPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
        </Route>
        <Route path="/profile" element={<Navigate to="/user-center" replace />} />

        {/* 新后台路由 */}
        <Route path={`/${ADMIN_PREFIX}/*`} element={<AdminRoutes />} />
        <Route path="/teacher/*" element={<TeacherRoutes />} />

        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
