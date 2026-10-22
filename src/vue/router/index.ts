/** Vue Router owns each screen as it is migrated from the legacy route tree. */
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { adminPath } from "../../utils/adminPath";
import AdminLayout from "../layouts/AdminLayout.vue";
import FrontLayout from "../layouts/FrontLayout.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/practice/problem/:problemId",
    name: "practice-problem",
    component: () => import("../views/public/PracticeProblemPage.vue"),
  },
  {
    path: adminPath("/login"),
    name: "admin-login",
    component: () => import("../views/admin/AdminLoginPage.vue"),
  },
  {
    path: adminPath("/"),
    component: AdminLayout,
    children: [
      { path: "redirect/:path(.*)", meta: { hidden: true, breadcrumb: false }, component: () => import("../template-adapter/RedirectPage.vue") },
      { path: "", redirect: () => adminPath("/dashboard") },
      {
        path: "dashboard",
        name: "admin-dashboard",
        meta: { title: "仪表盘" },
        component: () => import("../views/admin/AdminDashboardPage.vue"),
      },
      {
        path: "users/teachers",
        name: "admin-teachers",
        meta: { title: "教师管理" },
        component: () => import("../views/admin/AdminTeacherManagementPage.vue"),
      },
      {
        path: "majors",
        name: "admin-majors",
        meta: { title: "专业管理" },
        component: () => import("../views/admin/AdminMajorManagementPage.vue"),
      },
      { path: "users/students", name: "admin-students", meta: { title: "学生管理" }, component: () => import("../views/admin/AdminStudentManagementPage.vue") },
      { path: "problems/new", name: "admin-problem-create", meta: { title: "新增题目" }, component: () => import("../views/shared/ProblemEditorPage.vue") },
      { path: "problems/:problemId/edit", name: "admin-problem-edit", meta: { title: "编辑题目" }, component: () => import("../views/shared/ProblemEditorPage.vue") },
      { path: "problems/:problemId/test-cases", name: "admin-problem-test-cases", meta: { title: "题目测试数据" }, component: () => import("../views/shared/ProblemEditorPage.vue") },
      { path: "problems", name: "admin-problems", meta: { title: "题目管理" }, component: () => import("../views/shared/ProblemManagementPage.vue") },
      { path: "problem-folders", name: "admin-problem-folders", meta: { title: "题目文件夹" }, component: () => import("../views/shared/ProblemFolderManagementPage.vue") },
      { path: "problem-folders/new", name: "admin-problem-folder-create", meta: { title: "新建题目文件夹" }, component: () => import("../views/shared/ProblemFolderManagementPage.vue") },
      { path: "problem-folders/:folderId", name: "admin-problem-folder-edit", meta: { title: "编辑题目文件夹" }, component: () => import("../views/shared/ProblemFolderManagementPage.vue") },
      { path: "courses", name: "admin-courses", meta: { title: "课程管理" }, component: () => import("../views/shared/CourseManagementPage.vue") },
      { path: "courses/:courseId", name: "admin-course-detail", meta: { title: "课程详情" }, component: () => import("../views/shared/CourseManagementPage.vue") },
      { path: "practices", name: "admin-practices", meta: { title: "题单管理" }, component: () => import("../views/shared/PracticeManagementPage.vue") },
      { path: "practices/new", name: "admin-practice-create", meta: { title: "创建题单" }, component: () => import("../views/shared/PracticeManagementPage.vue") },
      { path: "practices/:practiceId/edit", name: "admin-practice-edit", meta: { title: "编辑题单" }, component: () => import("../views/shared/PracticeManagementPage.vue") },
      { path: "practices/:practiceId/publish", name: "admin-practice-publish", meta: { title: "发布题单" }, component: () => import("../views/shared/PracticePublishPage.vue") },
      { path: "practices/publications/:publicationId/edit", name: "admin-publication-edit", meta: { title: "编辑发布题单" }, component: () => import("../views/shared/PracticePublishPage.vue") },
      { path: "practices/publications/:publicationId/report", name: "admin-publication-report", meta: { title: "发布做题信息" }, component: () => import("../views/shared/PracticePublicationReportPage.vue") },
      { path: "classes", name: "admin-classes", meta: { title: "班级管理" }, component: () => import("../views/admin/AdminClassManagementPage.vue") },
      { path: "classes/:classId", name: "admin-class-detail", meta: { title: "班级详情" }, component: () => import("../views/admin/AdminClassManagementPage.vue") },
      { path: "teams", name: "admin-teams", meta: { title: "队伍管理" }, component: () => import("../views/admin/AdminTeamManagementPage.vue") },
      { path: "contests", name: "admin-contests", meta: { title: "比赛管理" }, component: () => import("../views/shared/ContestManagementPage.vue"), props: { portal: "admin" } },
      { path: "contests/new", name: "admin-contest-create", meta: { title: "创建比赛" }, component: () => import("../views/shared/ContestManagementPage.vue"), props: { portal: "admin" } },
      { path: "contests/:contestId/edit", name: "admin-contest-edit", meta: { title: "编辑比赛" }, component: () => import("../views/shared/ContestManagementPage.vue"), props: { portal: "admin" } },
      { path: "contests/:contestId/submissions", name: "admin-contest-submissions", meta: { title: "比赛提交" }, component: () => import("../views/admin/AdminSubmissionManagementPage.vue"), props: { view: "submissions" } },
      { path: "contests/:contestId/judge/queue", name: "admin-contest-queue", meta: { title: "比赛判题队列" }, component: () => import("../views/admin/AdminSubmissionManagementPage.vue"), props: { view: "queue" } },
      { path: "submissions", name: "admin-submissions", meta: { title: "提交管理" }, component: () => import("../views/admin/AdminSubmissionManagementPage.vue"), props: { view: "submissions" } },
      { path: "submissions/statistics", name: "admin-submission-statistics", meta: { title: "提交统计" }, component: () => import("../views/admin/AdminSubmissionManagementPage.vue"), props: { view: "statistics" } },
      { path: "leaderboard", name: "admin-leaderboard", meta: { title: "排行榜管理" }, component: () => import("../views/admin/AdminLeaderboardPage.vue") },
      { path: "profile", name: "admin-profile", meta: { title: "个人信息" }, component: () => import("../views/admin/AdminProfilePage.vue") },
      { path: "contests/rankings", redirect: () => adminPath("/contests") },
      { path: "judge/queue", name: "admin-judge-queue", meta: { title: "判题队列" }, component: () => import("../views/admin/AdminSubmissionManagementPage.vue"), props: { view: "queue" } },
      { path: "submission-queue", name: "admin-submission-queue", meta: { title: "判题队列" }, component: () => import("../views/admin/AdminSubmissionManagementPage.vue"), props: { view: "queue" } },
      { path: "judge/config", name: "admin-judge-config", meta: { title: "判题配置" }, component: () => import("../views/admin/AdminSystemSettingsPage.vue"), props: { section: "judge" } },
      { path: "ai/chat", name: "admin-ai-chat", component: () => import("../views/admin/AdminWorkspacePage.vue") },
      { path: "ai/problem-generator", name: "admin-ai-problem-generator", component: () => import("../views/admin/AdminWorkspacePage.vue") },
      { path: "ai/settings", name: "admin-ai-settings", component: () => import("../views/admin/AdminAiSettingsPage.vue") },
      { path: "settings/frontend", name: "admin-settings-frontend", meta: { title: "前台设置" }, component: () => import("../views/admin/AdminSystemSettingsPage.vue"), props: { section: "frontend" } },
      { path: "settings/register", name: "admin-settings-register", meta: { title: "注册设置" }, component: () => import("../views/admin/AdminSystemSettingsPage.vue"), props: { section: "register" } },
      { path: "settings/system", name: "admin-settings-system", meta: { title: "系统设置" }, component: () => import("../views/admin/AdminSystemSettingsPage.vue"), props: { section: "system" } },
      { path: "settings/code-templates", name: "admin-settings-code-templates", component: () => import("../views/admin/AdminCodeTemplateSettingsPage.vue") },
      { path: "settings/announcements", name: "admin-settings-announcements", meta: { title: "公告管理" }, component: () => import("../views/admin/AdminAnnouncementManagementPage.vue") },
      { path: "contests/:contestId", name: "admin-contest-detail", meta: { title: "比赛详情" }, component: () => import("../views/shared/ContestManagementPage.vue"), props: { portal: "admin" } },
      {
        path: ":pathMatch(.*)*",
        name: "admin-not-found",
        component: () => import("../views/shared/PortalNotFoundPage.vue"),
        props: { returnTo: adminPath("/dashboard") },
      },
    ],
  },
  {
    path: "/teacher/login",
    name: "teacher-login",
    component: () => import("../views/teacher/TeacherLoginPage.vue"),
  },
  {
    path: "/teacher",
    component: () => import("../layouts/TeacherLayout.vue"),
    children: [
      { path: "redirect/:path(.*)", meta: { hidden: true, breadcrumb: false }, component: () => import("../template-adapter/RedirectPage.vue") },
      { path: "", redirect: "/teacher/dashboard" },
      { path: "problems/new", name: "teacher-problem-create", component: () => import("../views/shared/ProblemEditorPage.vue") },
      { path: "problems/:problemId/edit", name: "teacher-problem-edit", component: () => import("../views/shared/ProblemEditorPage.vue") },
      { path: "problems/:problemId/test-cases", name: "teacher-problem-test-cases", component: () => import("../views/shared/ProblemEditorPage.vue") },
      { path: "problems", name: "teacher-problems", meta: { title: "题目管理" }, component: () => import("../views/shared/ProblemManagementPage.vue") },
      { path: "problem-folders", name: "teacher-problem-folders", meta: { title: "题目文件夹" }, component: () => import("../views/shared/ProblemFolderManagementPage.vue") },
      { path: "problem-folders/new", name: "teacher-problem-folder-create", meta: { title: "新建题目文件夹" }, component: () => import("../views/shared/ProblemFolderManagementPage.vue") },
      { path: "problem-folders/:folderId", name: "teacher-problem-folder-edit", meta: { title: "编辑题目文件夹" }, component: () => import("../views/shared/ProblemFolderManagementPage.vue") },
      { path: "courses", name: "teacher-courses", meta: { title: "课程管理" }, component: () => import("../views/shared/CourseManagementPage.vue") },
      { path: "courses/:courseId", name: "teacher-course-detail", meta: { title: "课程详情" }, component: () => import("../views/shared/CourseManagementPage.vue") },
      { path: "practices", name: "teacher-practices", meta: { title: "题单管理" }, component: () => import("../views/shared/PracticeManagementPage.vue") },
      { path: "practices/new", name: "teacher-practice-create", meta: { title: "创建题单" }, component: () => import("../views/shared/PracticeManagementPage.vue") },
      { path: "practices/:practiceId/edit", name: "teacher-practice-edit", meta: { title: "编辑题单" }, component: () => import("../views/shared/PracticeManagementPage.vue") },
      { path: "practices/:practiceId/publish", name: "teacher-practice-publish", meta: { title: "发布题单" }, component: () => import("../views/shared/PracticePublishPage.vue") },
      { path: "practices/publications/:publicationId/edit", name: "teacher-publication-edit", meta: { title: "编辑发布题单" }, component: () => import("../views/shared/PracticePublishPage.vue") },
      { path: "practices/publications/:publicationId/report", name: "teacher-publication-report", meta: { title: "发布做题信息" }, component: () => import("../views/shared/PracticePublicationReportPage.vue") },
      { path: "practices/:practiceId/report", name: "teacher-practice-report", meta: { title: "题单做题信息" }, component: () => import("../views/shared/PracticePublicationReportPage.vue") },
      { path: "contests", name: "teacher-contests", meta: { title: "比赛管理" }, component: () => import("../views/shared/ContestManagementPage.vue"), props: { portal: "teacher" } },
      { path: "contests/new", name: "teacher-contest-create", meta: { title: "创建比赛" }, component: () => import("../views/shared/ContestManagementPage.vue"), props: { portal: "teacher" } },
      { path: "contests/:contestId/edit", name: "teacher-contest-edit", meta: { title: "编辑比赛" }, component: () => import("../views/shared/ContestManagementPage.vue"), props: { portal: "teacher" } },
      { path: "contests/:contestId", name: "teacher-contest-detail", meta: { title: "比赛详情" }, component: () => import("../views/shared/ContestManagementPage.vue"), props: { portal: "teacher" } },
      { path: "students", name: "teacher-students", meta: { title: "学生管理" }, component: () => import("../views/teacher/TeacherStudentManagementPage.vue") },
      { path: "applications", name: "teacher-applications", meta: { title: "加入申请" }, component: () => import("../views/teacher/TeacherApplicationsPage.vue") },
      { path: "classes", name: "teacher-classes", meta: { title: "班级管理" }, component: () => import("../views/teacher/TeacherClassManagementPage.vue") },
      { path: "import", name: "teacher-import-students", meta: { title: "导入学生" }, component: () => import("../views/teacher/TeacherImportPage.vue") },
      { path: "submissions", name: "teacher-submissions", meta: { title: "提交记录" }, component: () => import("../views/teacher/TeacherSubmissionManagementPage.vue") },
      { path: "practices/submissions", name: "teacher-practice-submissions", meta: { title: "题单提交" }, component: () => import("../views/teacher/TeacherSubmissionManagementPage.vue") },
      { path: "stats", name: "teacher-practice-statistics", meta: { title: "练习统计" }, component: () => import("../views/teacher/TeacherPracticeStatisticsPage.vue") },
      { path: "dashboard", name: "teacher-dashboard", meta: { title: "工作概览" }, component: () => import("../views/teacher/TeacherDashboardPage.vue") },
      { path: "profile", name: "teacher-profile", meta: { title: "个人信息" }, component: () => import("../views/teacher/TeacherProfilePage.vue") },
      { path: ":pathMatch(.*)*", name: "teacher-not-found", component: () => import("../views/shared/PortalNotFoundPage.vue"), props: { returnTo: "/teacher/dashboard" } },
    ],
  },
  {
    path: "/",
    component: FrontLayout,
    children: [
      { path: "redirect/:path(.*)", meta: { hidden: true, breadcrumb: false }, component: () => import("../template-adapter/RedirectPage.vue") },
      {
        path: "",
        name: "home",
        component: () => import("../views/public/HomePage.vue"),
      },
      {
        path: "login",
        name: "user-login",
        component: () => import("../views/public/AuthPage.vue"),
        props: { mode: "login" },
      },
      {
        path: "register",
        name: "user-register",
        component: () => import("../views/public/AuthPage.vue"),
        props: { mode: "register" },
      },
      {
        path: "about",
        name: "about",
        component: () => import("../views/public/AboutPage.vue"),
      },
      {
        path: "courses",
        name: "course-list",
        component: () => import("../views/public/CourseListPage.vue"),
      },
      {
        path: "courses/:courseId",
        name: "course-detail",
        component: () => import("../views/public/CourseDetailPage.vue"),
      },
      {
        path: "leaderboard",
        name: "leaderboard",
        component: () => import("../views/public/LeaderboardPage.vue"),
      },
      {
        path: "problems",
        name: "problems",
        component: () => import("../views/public/ProblemsPage.vue"),
      },
      {
        path: "problems/:problemId/submissions",
        name: "problem-submissions",
        component: () => import("../views/public/ProblemSubmissionsPage.vue"),
      },
      {
        path: "contests",
        name: "contests",
        component: () => import("../views/public/ContestsPage.vue"),
      },
      {
        path: "contests/:contestId/scoreboard",
        name: "contest-scoreboard",
        component: () => import("../views/public/ContestScoreboardPage.vue"),
      },
      {
        path: "contests/:contestId",
        name: "contest-detail",
        component: () => import("../views/public/ContestDetailPage.vue"),
      },
      {
        path: "users/:userId",
        name: "user-profile",
        component: () => import("../views/public/UserProfilePage.vue"),
      },
      {
        path: "user-center",
        name: "user-center",
        component: () => import("../views/public/UserCenterPage.vue"),
      },
      { path: "profile", redirect: "/user-center" },
      { path: "practice", redirect: "/courses" },
      {
        path: "practice/legacy",
        name: "practice-list",
        component: () => import("../views/public/PracticeListPage.vue"),
      },
      {
        path: "practice/history/:problemId",
        name: "practice-history",
        component: () => import("../views/public/PracticeHistoryPage.vue"),
      },
      {
        path: "practice/:practiceId",
        name: "practice-assignment",
        component: () => import("../views/public/PracticeAssignmentPage.vue"),
      },
    ],
  },
  {
    path: "/contests/:contestId/public-scoreboard",
    name: "contest-public-scoreboard",
    component: () => import("../views/public/ContestPublicScoreboardPage.vue"),
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: () => import("../views/public/NotFoundPage.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Recover old links with duplicated path separators without touching query values.
router.beforeEach((to) => {
  const path = to.path.replace(/\/{2,}/g, "/");
  if (path !== to.path) return { path, query: to.query, hash: to.hash, replace: true };
});

// Vue owns the application routes. Portal catchalls render an in-layout 404 page.
export default router;
