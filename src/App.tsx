/**
 * QOJ 前端根路由配置。
 *
 * 路由结构：
 * - FrontLayout（前台）：首页、题库、练习、比赛、榜单、用户中心、登录注册
 * - AdminRoutes（/admin/*）：后台管理独立路由树
 * - ContestPublicScoreboardPage：公开榜单独立页面（无 FrontLayout）
 * - NotFoundPage：404 兜底
 */
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "./pages/AuthPage";
import { ContestsPage } from "./pages/ContestsPage";
import { ContestDetailPage } from "./pages/ContestDetailPage";
import { ContestScoreboardPage } from "./pages/ContestScoreboardPage";
import { ContestPublicScoreboardPage } from "./pages/ContestPublicScoreboardPage";
import { HomePage } from "./pages/HomePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PracticeAssignmentPage } from "./pages/PracticeAssignmentPage";
import { PracticeListPage } from "./pages/PracticeListPage";
import { PracticePage } from "./pages/PracticePage";
import { ProblemSubmissionsPage } from "./pages/ProblemSubmissionsPage";
import { SubmissionQueuePage } from "./pages/SubmissionQueuePage";
import { ProblemsPage } from "./pages/ProblemsPage";
import { UserCenterPage } from "./pages/UserCenterPage";
import { UserProfilePage } from "./pages/UserProfilePage";
import { SemiTestPage } from "./pages/SemiTestPage";
import { FrontLayout } from "./layouts/FrontLayout";
import { AdminRoutes } from "./admin/routes/adminRoutes";
import { ADMIN_PREFIX } from "./config";
import { TeacherRoutes } from "./teacher/TeacherRoutes";
import { DocumentTitle } from "./components/DocumentTitle";

export function App() {
  return (
    <>
      <DocumentTitle />
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
    </>
  );
}
