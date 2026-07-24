/**
 * 管理员Routes模块。集中声明该文件对外提供的前端能力与初始化逻辑。
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import '../../utils/arcoSetup';
import { AdminLayout } from '../layout/AdminLayout';
import { PermissionGuard } from '../components/PermissionGuard';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { AdminLoginPage } from '../pages/login/AdminLoginPage';
import { AnnouncementManagementPage } from '../pages/announcement/AnnouncementManagementPage';
import { AdminUserManagementPage } from '../pages/users/AdminUserManagementPage';
import { AdminContestManagementPage } from '../pages/contests/AdminContestManagementPage';
import { AdminContestDetailPage } from '../pages/contests/AdminContestDetailPage';
import { AdminCodeTemplateSettingsPage } from '../pages/settings/AdminCodeTemplateSettingsPage';
import { AdminSystemSettingsPage } from '../pages/settings/AdminSystemSettingsPage';
import { AdminProblemListPage } from '../pages/problems/AdminProblemListPage';
import { AdminProblemCreatePage } from '../pages/problems/AdminProblemCreatePage';
import { AdminProblemFolderPage } from '../pages/problems/AdminProblemFolderPage';
import { AdminPracticeManagementPage } from '../pages/practices/AdminPracticeManagementPage';
import { PracticePublishPage } from '../../components/practices/PracticePublishPage';
import { AdminSubmissionQueuePage } from '../pages/judge/AdminSubmissionQueuePage';
import { AdminSubmissionListPage } from '../pages/submissions/AdminSubmissionListPage';
import { AdminSubmissionStatisticsPage } from '../pages/submissions/AdminSubmissionStatisticsPage';
import { AdminLeaderboardPage } from '../pages/leaderboard/AdminLeaderboardPage';
import { AdminClassDetailPage, AdminClassManagementPage } from '../pages/classes/AdminClassManagementPage';
import { AdminTeacherManagementPage } from '../pages/classes/AdminTeacherManagementPage';
import { AdminMajorManagementPage } from '../pages/classes/AdminMajorManagementPage';
import { AdminProfilePage } from '../pages/profile/AdminProfilePage';
import { adminPath } from '../../utils/adminPath';
import { Result } from '@arco-design/web-react';

/**
 * 渲染管理员Routes组件，并协调其数据加载、状态和交互。
 */
export function AdminRoutes() {
  return (
    <Routes>
      {/* 登录页面（无需鉴权） */}
      <Route path="/login" element={<AdminLoginPage />} />

      {/* 后台管理页面（需要鉴权） */}
      <Route
        path="/*"
        element={
          <PermissionGuard>
            <AdminLayout>
              <Routes>
                {/* 默认重定向到 dashboard */}
                <Route path="/" element={<Navigate to={adminPath('/dashboard')} replace />} />

                {/* Dashboard */}
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* 用户管理 */}
                <Route path="/users/students" element={<AdminUserManagementPage />} />
                <Route path="/users/teachers" element={<AdminTeacherManagementPage />} />
                <Route path="/majors" element={<AdminMajorManagementPage />} />

                {/* 题目管理 */}
                <Route path="/problems" element={<AdminProblemListPage />} />
                <Route path="/problems/new" element={<AdminProblemCreatePage />} />
                <Route path="/problems/:problemId/edit" element={<AdminProblemCreatePage />} />
                <Route path="/problems/:problemId/test-cases" element={<AdminProblemCreatePage />} />
                <Route path="/problem-folders" element={<AdminProblemFolderPage />} />
                <Route path="/problem-folders/new" element={<AdminProblemFolderPage />} />
                <Route path="/problem-folders/:folderId" element={<AdminProblemFolderPage />} />

                {/* 题单管理 */}
                <Route path="/practices" element={<AdminPracticeManagementPage />} />
                <Route path="/practices/new" element={<AdminPracticeManagementPage />} />
                <Route path="/practices/:practiceId/publish" element={<PracticePublishPage variant="admin" />} />
                <Route path="/practices/publications/:publicationId/edit" element={<PracticePublishPage variant="admin" />} />
                <Route path="/practices/:practiceId/edit" element={<AdminPracticeManagementPage />} />

                {/* 比赛管理 */}
                <Route path="/contests" element={<AdminContestManagementPage />} />
                <Route path="/contests/new" element={<AdminContestManagementPage />} />
                <Route path="/contests/rankings" element={<AdminContestManagementPage />} />
                <Route path="/contests/:contestId/edit" element={<AdminContestManagementPage />} />
                <Route path="/contests/:contestId/submissions" element={<AdminSubmissionListPage />} />
                <Route path="/contests/:contestId/judge/queue" element={<AdminSubmissionQueuePage />} />
                <Route path="/contests/:contestId" element={<AdminContestDetailPage />} />

                {/* 提交管理 */}
                <Route path="/submissions" element={<AdminSubmissionListPage />} />
                <Route path="/submissions/statistics" element={<AdminSubmissionStatisticsPage />} />

                {/* 判题管理 */}
                <Route path="/judge/queue" element={<AdminSubmissionQueuePage />} />
                <Route path="/submission-queue" element={<AdminSubmissionQueuePage />} />
                <Route path="/judge/config" element={<AdminSystemSettingsPage section="judge" />} />

                {/* 榜单管理 */}
                <Route path="/leaderboard" element={<AdminLeaderboardPage />} />

                {/* 班级管理 */}
                <Route path="/classes" element={<AdminClassManagementPage />} />
                <Route path="/classes/:classId" element={<AdminClassDetailPage />} />

                {/* 系统设置 */}
                <Route path="/settings/frontend" element={<AdminSystemSettingsPage section="frontend" />} />
                <Route path="/settings/register" element={<AdminSystemSettingsPage section="register" />} />
                <Route path="/settings/system" element={<AdminSystemSettingsPage section="system" />} />
                <Route path="/settings/code-templates" element={<AdminCodeTemplateSettingsPage />} />
                <Route path="/settings/announcements" element={<AnnouncementManagementPage />} />

                {/* 个人信息 */}
                <Route path="/profile" element={<AdminProfilePage />} />

                {/* 404 */}
                <Route
                  path="*"
                  element={
                    <Result
                      status="404"
                      title="页面不存在"
                      subTitle="抱歉，您访问的页面不存在"
                      extra={
                        <a href={adminPath('/dashboard')} style={{ color: '#165dff', textDecoration: 'none' }}>
                          返回首页
                        </a>
                      }
                    />
                  }
                />
              </Routes>
            </AdminLayout>
          </PermissionGuard>
        }
      />
    </Routes>
  );
}
