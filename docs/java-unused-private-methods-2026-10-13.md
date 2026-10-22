# 未使用私有方法清单（15 个候选）

PMD 识别到类内无调用；已检索测试和 E2E 夹具中的相关反射字符串。仍需在删除前核对运行时反射和兼容用途。生产 14 个，测试 1 个。

| 文件 | 行 | 方法 |
| --- | ---: | --- |
| [AuthService.java](backend/src/main/java/com/qoj/module/auth/service/AuthService.java:238) | 238 | `ensureScore(Long)` |
| [ContestService.java](backend/src/main/java/com/qoj/module/contest/service/ContestService.java:1092) | 1092 | `buildScoreboard(Contest)` |
| [ContestService.java](backend/src/main/java/com/qoj/module/contest/service/ContestService.java:1457) | 1457 | `requireOwnerOrSuperAdmin(long)` |
| [ContestService.java](backend/src/main/java/com/qoj/module/contest/service/ContestService.java:1475) | 1475 | `isOwner(Contest, AuthUser)` |
| [ContestService.java](backend/src/main/java/com/qoj/module/contest/service/ContestService.java:2543) | 2543 | `emptyStanding(Long, BoardIdentity)` |
| [ContestService.java](backend/src/main/java/com/qoj/module/contest/service/ContestService.java:2562) | 2562 | `identityKey(String, Long)` |
| [ContestService.java](backend/src/main/java/com/qoj/module/contest/service/ContestService.java:2639) | 2639 | `isRankedSubmission(Contest, Submission)` |
| [ProblemFolderService.java](backend/src/main/java/com/qoj/module/problem/service/ProblemFolderService.java:528) | 528 | `accountType(AuthUser)` |
| [ProblemService.java](backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:728) | 728 | `replaceHiddenTestCases(Long, List<ProblemTestCase>)` |
| [ProblemService.java](backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:750) | 750 | `requirePublicManageOwner(long)` |
| [ProblemService.java](backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:977) | 977 | `withAttemptStatuses(List<ProblemVO>, Long)` |
| [ProblemService.java](backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:1135) | 1135 | `sampleEntities(String)` |
| [ProblemService.java](backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:1241) | 1241 | `accountType(AuthUser)` |
| [ProblemService.java](backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:1245) | 1245 | `normalizeAccountType(String)` |
| [SystemSettingServiceTest.java](backend/src/test/java/com/qoj/module/setting/service/SystemSettingServiceTest.java:146) | 146 | `setting(String, String)` |
