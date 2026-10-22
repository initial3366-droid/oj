> 本文件为历史 HTTP 路由快照，不代表当前 Agent 能力。课程、定时题单、题解和学生批量功能的最新工具见 [admin-agent-api-catalog.md](admin-agent-api-catalog.md)；实际可用路由及 DTO 以 `list_admin_apis` / `describe_admin_api` 返回为准。旧 XCPCIO 配置和同步路由已从 Agent 目录中移除。

# QOJ HTTP 路由清单

由当前 Java Controller 源码生成，共 270 条方法映射。路径展示默认后台前缀 `/api/admin/v1`；实际部署可配置。一个映射若声明多个路径，列在同一行。

## admin

### AdminAuthController

源码：[`AdminAuthController.java`](../backend/src/main/java/com/qoj/module/admin/controller/AdminAuthController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/admin/v1/auth/login` |
| GET | `/api/admin/v1/me` |
| PUT | `/api/admin/v1/me` |

### AdminDashboardController

源码：[`AdminDashboardController.java`](../backend/src/main/java/com/qoj/module/admin/controller/AdminDashboardController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/dashboard` |

## agent

### AdminAgentController

源码：[`AdminAgentController.java`](../backend/src/main/java/com/qoj/module/agent/controller/AdminAgentController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/agent/quota/{userId}` |
| GET | `/api/admin/v1/agent/quota/batch` |
| POST | `/api/admin/v1/agent/chat/stop` |
| POST | `/api/admin/v1/agent/chat/tasks/{token}/stop` |
| POST | `/api/admin/v1/agent/chat/stream` |
| POST | `/api/admin/v1/agent/reset/user/{userId}` |
| POST | `/api/admin/v1/agent/reset/class/{classId}` |
| POST | `/api/admin/v1/agent/reset/all` |

### AdminChatFileController

源码：[`AdminChatFileController.java`](../backend/src/main/java/com/qoj/module/agent/controller/AdminChatFileController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/admin/v1/agent/chat/files` |
| GET | `/api/admin/v1/agent/chat/files/{id}` |
| GET | `/api/admin/v1/agent/chat/files/{id}/download` |
| DELETE | `/api/admin/v1/agent/chat/files/{id}` |

### AdminChatHistoryController

源码：[`AdminChatHistoryController.java`](../backend/src/main/java/com/qoj/module/agent/controller/AdminChatHistoryController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/agent/chat/sessions` |
| GET | `/api/admin/v1/agent/chat/sessions/{id}` |
| PUT | `/api/admin/v1/agent/chat/sessions/{id}` |
| DELETE | `/api/admin/v1/agent/chat/sessions/{id}` |
| PUT | `/api/admin/v1/agent/chat/sessions/{id}/title` |
| POST | `/api/admin/v1/agent/chat/sessions/{id}/title/generate` |

### AdminChatImageController

源码：[`AdminChatImageController.java`](../backend/src/main/java/com/qoj/module/agent/controller/AdminChatImageController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/admin/v1/agent/chat/images` |
| GET | `/api/admin/v1/agent/chat/images/{id}` |
| DELETE | `/api/admin/v1/agent/chat/images/{id}` |

### AdminChatImportController

源码：[`AdminChatImportController.java`](../backend/src/main/java/com/qoj/module/agent/controller/AdminChatImportController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/admin/v1/agent/chat/imports/preview` |
| GET | `/api/admin/v1/agent/chat/imports/{id}` |
| POST | `/api/admin/v1/agent/chat/imports/{id}/commit` |

### AgentController

源码：[`AgentController.java`](../backend/src/main/java/com/qoj/module/agent/controller/AgentController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/v1/agent/chat` |
| GET | `/api/v1/agent/quota` |

## announcement

### AdminAnnouncementController

源码：[`AdminAnnouncementController.java`](../backend/src/main/java/com/qoj/module/announcement/controller/AdminAnnouncementController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/announcements` |
| GET | `/api/admin/v1/announcements/pinned` |
| GET | `/api/admin/v1/announcements/{id}` |
| POST | `/api/admin/v1/announcements` |
| PUT | `/api/admin/v1/announcements/{id}` |
| DELETE | `/api/admin/v1/announcements/{id}` |

### AnnouncementController

源码：[`AnnouncementController.java`](../backend/src/main/java/com/qoj/module/announcement/controller/AnnouncementController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/announcements` |
| GET | `/api/v1/announcements/latest` |
| GET | `/api/v1/announcements/pinned` |
| GET | `/api/v1/announcements/{id}` |

## auth

### AuthController

源码：[`AuthController.java`](../backend/src/main/java/com/qoj/module/auth/controller/AuthController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/v1/auth/login` |
| POST | `/api/v1/auth/register` |
| POST | `/api/v1/auth/reset-password` |
| POST | `/api/v1/auth/refresh` |
| POST | `/api/v1/auth/logout` |
| GET | `/api/v1/auth/me` |
| PUT | `/api/v1/auth/profile` |
| POST | `/api/v1/auth/avatar` |
| PUT | `/api/v1/auth/email` |
| PUT | `/api/v1/auth/password` |

### CaptchaController

源码：[`CaptchaController.java`](../backend/src/main/java/com/qoj/module/auth/controller/CaptchaController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/captcha/image` |
| POST | `/api/v1/captcha/email` |
| GET | `/api/v1/captcha/email/remaining` |

## classroom

### AdminClassRoomController

源码：[`AdminClassRoomController.java`](../backend/src/main/java/com/qoj/module/classroom/controller/AdminClassRoomController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/classes` |
| GET | `/api/admin/v1/classes/{classId}` |
| POST | `/api/admin/v1/classes` |
| PUT | `/api/admin/v1/classes/{classId}` |
| DELETE | `/api/admin/v1/classes/{classId}` |
| POST | `/api/admin/v1/students/import` |
| GET | `/api/admin/v1/teachers` |
| POST | `/api/admin/v1/teachers` |
| PUT | `/api/admin/v1/teachers/{teacherId}` |
| DELETE | `/api/admin/v1/teachers/{teacherId}` |

### ClassRoomController

源码：[`ClassRoomController.java`](../backend/src/main/java/com/qoj/module/classroom/controller/ClassRoomController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/v1/classes/{classId}/applications` |

## contest

### AdminContestController

源码：[`AdminContestController.java`](../backend/src/main/java/com/qoj/module/contest/controller/AdminContestController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/contests` |
| POST | `/api/admin/v1/contests` |
| GET | `/api/admin/v1/contests/{id}` |
| PUT | `/api/admin/v1/contests/{id}` |
| POST | `/api/admin/v1/contests/{id}/unbind` |
| POST | `/api/admin/v1/contests/{id}/replay` |
| GET | `/api/admin/v1/contests/draft` |
| PUT | `/api/admin/v1/contests/draft` |
| DELETE | `/api/admin/v1/contests/draft` |
| DELETE | `/api/admin/v1/contests/{id}` |
| GET | `/api/admin/v1/contests/{id}/problems` |
| GET | `/api/admin/v1/contests/{id}/registration-candidates` |
| GET | `/api/admin/v1/contests/{id}/registrations` |
| POST | `/api/admin/v1/contests/{id}/registrations` |
| DELETE | `/api/admin/v1/contests/{id}/registrations/{registrationId}` |
| GET | `/api/admin/v1/contests/{id}/scoreboard/export` |
| GET | `/api/admin/v1/contests/{id}/submissions/export` |
| GET | `/api/admin/v1/contests/{id}/registrations/export` |

### AdminContestRankController

源码：[`AdminContestRankController.java`](../backend/src/main/java/com/qoj/module/contest/controller/AdminContestRankController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/admin/v1/contests/{contestId}/rank/rebuild` |
| POST | `/api/admin/v1/contests/{contestId}/scoreboard/snapshot` |
| DELETE | `/api/admin/v1/contests/{contestId}/scoreboard/snapshot/{type}` |

### AdminContestRollingController

源码：[`AdminContestRollingController.java`](../backend/src/main/java/com/qoj/module/contest/controller/AdminContestRollingController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/contests/{contestId}/rolling` |
| POST | `/api/admin/v1/contests/{contestId}/rolling/start` |
| POST | `/api/admin/v1/contests/{contestId}/rolling/step` |
| POST | `/api/admin/v1/contests/{contestId}/rolling/finish` |
| POST | `/api/admin/v1/contests/{contestId}/rolling/publish-final` |

### ContestController

源码：[`ContestController.java`](../backend/src/main/java/com/qoj/module/contest/controller/ContestController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/contests` |
| GET | `/api/v1/contests/my` |
| GET | `/api/v1/contests/{id}` |
| POST | `/api/v1/contests/{id}/register` |
| GET | `/api/v1/contests/{id}/registration-options` |
| GET | `/api/v1/contests/{id}/my-accepted-problems` |
| GET | `/api/v1/contests/{id}/problems/{contestProblemId}` |
| GET | `/api/v1/contests/{id}/scoreboard` |

### ContestPublicController

源码：[`ContestPublicController.java`](../backend/src/main/java/com/qoj/module/contest/controller/ContestPublicController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/contests/public/{id}/scoreboard` |

### ContestRankController

源码：[`ContestRankController.java`](../backend/src/main/java/com/qoj/module/contest/controller/ContestRankController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/contests/{contestId}/rank` |
| GET | `/api/v1/contests/{contestId}/scoreboard/snapshot/{type}` |

## home

### AdminHomeController

源码：[`AdminHomeController.java`](../backend/src/main/java/com/qoj/module/home/controller/AdminHomeController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/home` |
| GET | `/api/admin/v1/home/carousel` |
| POST | `/api/admin/v1/home/carousel` |
| PUT | `/api/admin/v1/home/carousel/{id}` |
| DELETE | `/api/admin/v1/home/carousel/{id}` |

### HomeController

源码：[`HomeController.java`](../backend/src/main/java/com/qoj/module/home/controller/HomeController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/home` |

## leaderboard

### LeaderboardController

源码：[`LeaderboardController.java`](../backend/src/main/java/com/qoj/module/leaderboard/controller/LeaderboardController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/leaderboard/global` |
| GET | `/api/v1/leaderboard/classes` |
| GET | `/api/v1/leaderboard/user/{id}` |

## practice

### AdminPracticeController

源码：[`AdminPracticeController.java`](../backend/src/main/java/com/qoj/module/practice/controller/AdminPracticeController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/practices` |
| POST | `/api/admin/v1/practices` |
| PUT | `/api/admin/v1/practices/{id}` |
| GET | `/api/admin/v1/practices/{id}/report` |
| DELETE | `/api/admin/v1/practices/{id}` |
| POST | `/api/admin/v1/practices/{id}/copy` |
| POST | `/api/admin/v1/practices/{id}/publications` |
| GET | `/api/admin/v1/practices/publications/mine` |
| GET | `/api/admin/v1/practices/publications` |
| GET | `/api/admin/v1/practices/publications/{publicationId}` |
| GET | `/api/admin/v1/practices/publications/{publicationId}/report` |
| PUT | `/api/admin/v1/practices/publications/{publicationId}` |
| DELETE | `/api/admin/v1/practices/publications/{publicationId}` |

### PracticeController

源码：[`PracticeController.java`](../backend/src/main/java/com/qoj/module/practice/controller/PracticeController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/practices` |
| GET | `/api/v1/practices/{id}` |
| POST | `/api/v1/practices/{id}/unlock` |

## problem

### AdminProblemController

源码：[`AdminProblemController.java`](../backend/src/main/java/com/qoj/module/problem/controller/AdminProblemController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/problems` |
| GET | `/api/admin/v1/problems/{id}` |
| PUT | `/api/admin/v1/problems/{id}` |
| GET | `/api/admin/v1/problems/{id}/checker-source` |
| DELETE | `/api/admin/v1/problems/{id}` |
| GET | `/api/admin/v1/problems/{id}/test-cases` |
| PUT | `/api/admin/v1/problems/{id}/test-cases` |
| POST | `/api/admin/v1/problems/{id}/test-cases` |
| PUT | `/api/admin/v1/problems/{id}/test-cases/{testCaseId}` |
| DELETE | `/api/admin/v1/problems/{id}/test-cases/{testCaseId}` |
| POST | `/api/admin/v1/problems/{id}/test-cases/zip` |

### AdminProblemDraftController

源码：[`AdminProblemDraftController.java`](../backend/src/main/java/com/qoj/module/problem/controller/AdminProblemDraftController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/admin/v1/problem-drafts` |
| GET | `/api/admin/v1/problem-drafts/{draftId}` |
| PUT | `/api/admin/v1/problem-drafts/{draftId}/basic` |
| PUT | `/api/admin/v1/problem-drafts/{draftId}/test-cases` |
| POST | `/api/admin/v1/problem-drafts/{draftId}/test-cases/zip` |
| POST | `/api/admin/v1/problem-drafts/{draftId}/commit` |

### AdminProblemFolderController

源码：[`AdminProblemFolderController.java`](../backend/src/main/java/com/qoj/module/problem/controller/AdminProblemFolderController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/problem-folders` |
| GET | `/api/admin/v1/problem-folders/{id}` |
| POST | `/api/admin/v1/problem-folders` |
| PUT | `/api/admin/v1/problem-folders/{id}` |
| DELETE | `/api/admin/v1/problem-folders/{id}` |
| GET | `/api/admin/v1/problem-folders/{id}/candidates` |
| PUT | `/api/admin/v1/problem-folders/{id}/problems` |
| POST | `/api/admin/v1/problem-folders/{id}/problems` |

### ProblemController

源码：[`ProblemController.java`](../backend/src/main/java/com/qoj/module/problem/controller/ProblemController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/problems` |
| GET | `/api/v1/problems/{id}` |

## setting

### AdminSettingController

源码：[`AdminSettingController.java`](../backend/src/main/java/com/qoj/module/setting/controller/AdminSettingController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/settings/frontend` |
| GET | `/api/admin/v1/settings/register` |
| GET | `/api/admin/v1/settings/system/agent` |
| PUT | `/api/admin/v1/settings/system/agent` |
| GET | `/api/admin/v1/settings/system/oss` |
| PUT | `/api/admin/v1/settings/system/oss` |
| GET | `/api/admin/v1/settings/system/code-templates` |
| PUT | `/api/admin/v1/settings/system/code-templates` |
| PUT | `/api/admin/v1/settings/frontend/site-title` |
| PUT | `/api/admin/v1/settings/frontend/maintenance-mode` |
| PUT | `/api/admin/v1/settings/frontend` |
| PUT | `/api/admin/v1/settings/frontend/footer-text` |
| PUT | `/api/admin/v1/settings/frontend/icp-number` |
| PUT | `/api/admin/v1/settings/frontend/footer-links` |
| PUT | `/api/admin/v1/settings/admin/password` |
| PUT | `/api/admin/v1/settings/register/enabled` |
| PUT | `/api/admin/v1/settings/register/email-verification` |
| PUT | `/api/admin/v1/settings/register/email-config` |
| PUT | `/api/admin/v1/settings/register/fields-config` |
| GET | `/api/admin/v1/settings/judge` |
| PUT | `/api/admin/v1/settings/judge` |
| PUT | `/api/admin/v1/settings/judge/enabled` |
| PUT | `/api/admin/v1/settings/judge/max-concurrent` |

### InternalAgentController

源码：[`InternalAgentController.java`](../backend/src/main/java/com/qoj/module/setting/controller/InternalAgentController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/internal/agent/config` |
| POST | `/api/internal/agent/authorize` |

### SettingController

源码：[`SettingController.java`](../backend/src/main/java/com/qoj/module/setting/controller/SettingController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/settings/register` |
| GET | `/api/v1/settings/site-title` |
| GET | `/api/v1/settings/frontend` |
| GET | `/api/v1/settings/maintenance-mode` |
| GET | `/api/v1/settings/judge` |
| GET | `/api/v1/settings/code-templates` |

## submission

### AdminSubmissionController

源码：[`AdminSubmissionController.java`](../backend/src/main/java/com/qoj/module/submission/controller/AdminSubmissionController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/submissions` |
| GET | `/api/admin/v1/submissions/export` |
| GET | `/api/admin/v1/submissions/{id}` |
| GET | `/api/admin/v1/submissions/{id}/code` |
| DELETE | `/api/admin/v1/submissions/{id}` |
| POST | `/api/admin/v1/submissions/{id}/rejudge` |

### AdminSubmissionQueueController

源码：[`AdminSubmissionQueueController.java`](../backend/src/main/java/com/qoj/module/submission/controller/AdminSubmissionQueueController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/submission-queue` |
| GET | `/api/admin/v1/submission-queue/{queueId}` |
| POST | `/api/admin/v1/submission-queue/{queueId}/rejudge` |
| POST | `/api/admin/v1/submission-queue/{queueId}/cancel` |
| POST | `/api/admin/v1/submission-queue/{queueId}/priority` |
| DELETE | `/api/admin/v1/submission-queue/{queueId}` |
| GET | `/api/admin/v1/submission-queue/{queueId}/logs` |
| GET | `/api/admin/v1/submission-queue/stats` |

### SandboxController

源码：[`SandboxController.java`](../backend/src/main/java/com/qoj/module/submission/controller/SandboxController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/v1/sandbox/run` |

### SubmissionController

源码：[`SubmissionController.java`](../backend/src/main/java/com/qoj/module/submission/controller/SubmissionController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/v1/submissions` |
| GET | `/api/v1/submissions` |
| GET | `/api/v1/submissions/{id}` |

### SubmissionQueueController

源码：[`SubmissionQueueController.java`](../backend/src/main/java/com/qoj/module/submission/controller/SubmissionQueueController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/submission-queue, /api/submission-queue` |
| GET | `/api/v1/submission-queue/{queueId}, /api/submission-queue/{queueId}` |

## teacher

### MajorController

源码：[`MajorController.java`](../backend/src/main/java/com/qoj/module/teacher/controller/MajorController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/majors` |
| POST | `/api/admin/v1/majors` |
| PUT | `/api/admin/v1/majors/{id}` |
| DELETE | `/api/admin/v1/majors/{id}` |

### TeacherAuthController

源码：[`TeacherAuthController.java`](../backend/src/main/java/com/qoj/module/teacher/controller/TeacherAuthController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/teacher/v1/auth/login` |

### TeacherController

源码：[`TeacherController.java`](../backend/src/main/java/com/qoj/module/teacher/controller/TeacherController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/teacher/v1/me` |
| GET | `/api/teacher/v1/dashboard` |
| PUT | `/api/teacher/v1/me/profile` |
| POST | `/api/teacher/v1/me/avatar` |
| PUT | `/api/teacher/v1/me/password` |
| GET | `/api/teacher/v1/classes` |
| GET | `/api/teacher/v1/classes/{classId}` |
| POST | `/api/teacher/v1/classes` |
| PUT | `/api/teacher/v1/classes/{classId}` |
| POST | `/api/teacher/v1/classes/{classId}/delete` |
| GET | `/api/teacher/v1/students` |
| GET | `/api/teacher/v1/students/{userId}` |
| POST | `/api/teacher/v1/students/import` |
| POST | `/api/teacher/v1/students/import-file` |
| DELETE | `/api/teacher/v1/classes/{classId}/students/{userId}` |
| PUT | `/api/teacher/v1/students/{userId}` |
| POST | `/api/teacher/v1/students/{userId}/avatar` |
| GET | `/api/teacher/v1/applications` |
| POST | `/api/teacher/v1/applications/{applicationId}/approve` |
| POST | `/api/teacher/v1/applications/{applicationId}/reject` |
| GET | `/api/teacher/v1/submissions` |
| GET | `/api/teacher/v1/submissions/{id}` |
| GET | `/api/teacher/v1/submissions/{id}/code` |
| GET | `/api/teacher/v1/submissions/export` |
| GET | `/api/teacher/v1/practices/{id}/report` |

## team

### AdminTeamController

源码：[`AdminTeamController.java`](../backend/src/main/java/com/qoj/module/team/controller/AdminTeamController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/teams` |
| POST | `/api/admin/v1/teams` |
| PUT | `/api/admin/v1/teams/{id}` |
| POST | `/api/admin/v1/teams/{id}/members` |
| DELETE | `/api/admin/v1/teams/{id}/members/{userId}` |

## upload

### UploadController

源码：[`UploadController.java`](../backend/src/main/java/com/qoj/module/upload/controller/UploadController.java)

| 方法 | 路径 |
| --- | --- |
| POST | `/api/v1/uploads/images` |

## user

### AdminUserController

源码：[`AdminUserController.java`](../backend/src/main/java/com/qoj/module/user/controller/AdminUserController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/users` |
| GET | `/api/admin/v1/users/{id}` |
| POST | `/api/admin/v1/users` |
| PUT | `/api/admin/v1/users/{id}` |
| POST | `/api/admin/v1/users/{id}/avatar` |
| DELETE | `/api/admin/v1/users/{id}` |

### UserPublicController

源码：[`UserPublicController.java`](../backend/src/main/java/com/qoj/module/user/controller/UserPublicController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/users/{id}` |

## xcpcio

### AdminXcpcioController

源码：[`AdminXcpcioController.java`](../backend/src/main/java/com/qoj/module/xcpcio/controller/AdminXcpcioController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/admin/v1/contests/{contestId}/xcpcio/config` |
| PUT | `/api/admin/v1/contests/{contestId}/xcpcio/config` |
| POST | `/api/admin/v1/contests/{contestId}/xcpcio/sync` |
| GET | `/api/admin/v1/contests/{contestId}/xcpcio/status` |
| GET | `/api/admin/v1/contests/{contestId}/xcpcio/logs` |

### ClicsExportController

源码：[`ClicsExportController.java`](../backend/src/main/java/com/qoj/module/xcpcio/controller/ClicsExportController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/clics, /api/v1/clics` |
| GET | `/api/v1/clics/contests` |
| GET | `/api/v1/clics/contests/{contestId}` |
| GET | `/api/v1/clics/contests/{contestId}/state` |
| GET | `/api/v1/clics/contests/{contestId}/teams` |
| GET | `/api/v1/clics/contests/{contestId}/groups` |
| GET | `/api/v1/clics/contests/{contestId}/organizations` |
| GET | `/api/v1/clics/contests/{contestId}/problems` |
| GET | `/api/v1/clics/contests/{contestId}/languages` |
| GET | `/api/v1/clics/contests/{contestId}/judgement-types` |
| GET | `/api/v1/clics/contests/{contestId}/submissions` |
| GET | `/api/v1/clics/contests/{contestId}/judgements` |
| GET | `/api/v1/clics/contests/{contestId}/runs` |
| GET | `/api/v1/clics/contests/{contestId}/scoreboard` |
| GET | `/api/v1/clics/contests/{contestId}/event-feed` |

### XcpcioPublicController

源码：[`XcpcioPublicController.java`](../backend/src/main/java/com/qoj/module/xcpcio/controller/XcpcioPublicController.java)

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/contests/{contestId}/xcpcio/public-config` |
