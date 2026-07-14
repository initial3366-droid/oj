/**
 * QOJ 前端根路由配置。
 *
 * 路由结构：
 * - FrontLayout（前台）：首页、题库、练习、比赛、榜单、用户中心、登录注册
 * - AdminRoutes（/admin/*）：后台管理独立路由树
 * - ContestPublicScoreboardPage：公开榜单独立页面（无 FrontLayout）
 * - NotFoundPage：404 兜底
 */
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { FrontLayout } from "./layouts/FrontLayout";
import { ADMIN_PREFIX } from "./config";
import { DocumentTitle } from "./components/DocumentTitle";

const AuthPage = lazy(() => import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })));
const ContestsPage = lazy(() => import("./pages/ContestsPage").then((module) => ({ default: module.ContestsPage })));
const ContestDetailPage = lazy(() => import("./pages/ContestDetailPage").then((module) => ({ default: module.ContestDetailPage })));
const ContestScoreboardPage = lazy(() => import("./pages/ContestScoreboardPage").then((module) => ({ default: module.ContestScoreboardPage })));
const ContestPublicScoreboardPage = lazy(() => import("./pages/ContestPublicScoreboardPage").then((module) => ({ default: module.ContestPublicScoreboardPage })));
const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage").then((module) => ({ default: module.LeaderboardPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const PracticeAssignmentPage = lazy(() => import("./pages/PracticeAssignmentPage").then((module) => ({ default: module.PracticeAssignmentPage })));
const PracticeListPage = lazy(() => import("./pages/PracticeListPage").then((module) => ({ default: module.PracticeListPage })));
const PracticePage = lazy(() => import("./pages/PracticePage").then((module) => ({ default: module.PracticePage })));
const ProblemSubmissionsPage = lazy(() => import("./pages/ProblemSubmissionsPage").then((module) => ({ default: module.ProblemSubmissionsPage })));
const SubmissionQueuePage = lazy(() => import("./pages/SubmissionQueuePage").then((module) => ({ default: module.SubmissionQueuePage })));
const ProblemsPage = lazy(() => import("./pages/ProblemsPage").then((module) => ({ default: module.ProblemsPage })));
const UserCenterPage = lazy(() => import("./pages/UserCenterPage").then((module) => ({ default: module.UserCenterPage })));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage").then((module) => ({ default: module.UserProfilePage })));
const SemiTestPage = lazy(() => import("./pages/SemiTestPage").then((module) => ({ default: module.SemiTestPage })));
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
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        {/* 外榜路由 - 独立页面，不使用 FrontLayout */}
        <Route path="/contests/:contestId/public-scoreboard" element={<ContestPublicScoreboardPage />} />
        <Route path="/practice/problem/:problemId" element={<PracticePage />} />

        <Route element={<FrontLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/semi-test" element={<SemiTestPage />} />
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
