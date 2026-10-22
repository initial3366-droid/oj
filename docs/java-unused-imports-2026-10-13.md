# 全部无用 import（PMD AST 检查，29 处）

按审核时源码定位，生产 20 处、测试 9 处。本轮未删除。

| 文件 | 行 | import |
| --- | ---: | --- |
| [SecurityConfig.java](backend/src/main/java/com/qoj/config/SecurityConfig.java:21) | 21 | `import org.springframework.web.cors.UrlBasedCorsConfigurationSource;` |
| [DashboardChartsVO.java](backend/src/main/java/com/qoj/module/admin/vo/DashboardChartsVO.java:3) | 3 | `import java.util.List;` |
| [AdminChatImportService.java](backend/src/main/java/com/qoj/module/agent/service/AdminChatImportService.java:27) | 27 | `import java.util.Map;` |
| [OpenAiCompatibleAgentClient.java](backend/src/main/java/com/qoj/module/agent/service/OpenAiCompatibleAgentClient.java:10) | 10 | `import org.springframework.ai.openai.OpenAiChatModel;` |
| [CaptchaService.java](backend/src/main/java/com/qoj/module/auth/service/CaptchaService.java:3) | 3 | `import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;` |
| [AdminContestController.java](backend/src/main/java/com/qoj/module/contest/controller/AdminContestController.java:16) | 16 | `import com.qoj.module.contest.entity.ContestRegistration;` |
| [ContestController.java](backend/src/main/java/com/qoj/module/contest/controller/ContestController.java:14) | 14 | `import org.springframework.security.access.prepost.PreAuthorize;` |
| [ContestAcmRankService.java](backend/src/main/java/com/qoj/module/contest/service/ContestAcmRankService.java:16) | 16 | `import java.time.LocalDateTime;` |
| [ContestOiRankService.java](backend/src/main/java/com/qoj/module/contest/service/ContestOiRankService.java:16) | 16 | `import java.time.LocalDateTime;` |
| [LeaderboardService.java](backend/src/main/java/com/qoj/module/leaderboard/service/LeaderboardService.java:26) | 26 | `import java.util.HashMap;` |
| [LeaderboardService.java](backend/src/main/java/com/qoj/module/leaderboard/service/LeaderboardService.java:28) | 28 | `import java.util.Map;` |
| [LeaderboardService.java](backend/src/main/java/com/qoj/module/leaderboard/service/LeaderboardService.java:29) | 29 | `import java.util.stream.Collectors;` |
| [PracticeController.java](backend/src/main/java/com/qoj/module/practice/controller/PracticeController.java:7) | 7 | `import com.qoj.module.practice.vo.PracticeVO;` |
| [PracticeService.java](backend/src/main/java/com/qoj/module/practice/service/PracticeService.java:4) | 4 | `import com.baomidou.mybatisplus.extension.plugins.pagination.Page;` |
| [PracticeService.java](backend/src/main/java/com/qoj/module/practice/service/PracticeService.java:21) | 21 | `import com.qoj.module.problem.vo.ProblemVO;` |
| [PracticeService.java](backend/src/main/java/com/qoj/module/practice/service/PracticeService.java:40) | 40 | `import org.springframework.security.core.Authentication;` |
| [PracticeService.java](backend/src/main/java/com/qoj/module/practice/service/PracticeService.java:41) | 41 | `import org.springframework.security.core.context.SecurityContextHolder;` |
| [ProblemService.java](backend/src/main/java/com/qoj/module/problem/service/ProblemService.java:49) | 49 | `import java.util.HashMap;` |
| [SubmissionService.java](backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java:30) | 30 | `import com.qoj.module.problem.entity.ProblemTestCase;` |
| [ClicsExportService.java](backend/src/main/java/com/qoj/module/xcpcio/service/ClicsExportService.java:18) | 18 | `import com.qoj.module.xcpcio.entity.ContestXcpcioConfig;` |
| [AuthServiceTest.java](backend/src/test/java/com/qoj/module/auth/service/AuthServiceTest.java:4) | 4 | `import com.qoj.common.exception.BizException;` |
| [AuthServiceTest.java](backend/src/test/java/com/qoj/module/auth/service/AuthServiceTest.java:15) | 15 | `import com.qoj.module.user.entity.AdminUser;` |
| [AuthServiceTest.java](backend/src/test/java/com/qoj/module/auth/service/AuthServiceTest.java:30) | 30 | `import org.mockito.ArgumentCaptor;` |
| [AuthServiceTest.java](backend/src/test/java/com/qoj/module/auth/service/AuthServiceTest.java:38) | 38 | `import static org.junit.jupiter.api.Assertions.assertFalse;` |
| [AuthServiceTest.java](backend/src/test/java/com/qoj/module/auth/service/AuthServiceTest.java:39) | 39 | `import static org.junit.jupiter.api.Assertions.assertThrows;` |
| [AuthServiceTest.java](backend/src/test/java/com/qoj/module/auth/service/AuthServiceTest.java:43) | 43 | `import static org.mockito.Mockito.doAnswer;` |
| [SystemSettingServiceTest.java](backend/src/test/java/com/qoj/module/setting/service/SystemSettingServiceTest.java:8) | 8 | `import com.qoj.module.setting.vo.JudgeSettingsVO;` |
| [SystemSettingServiceTest.java](backend/src/test/java/com/qoj/module/setting/service/SystemSettingServiceTest.java:23) | 23 | `import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;` |
| [SystemSettingServiceTest.java](backend/src/test/java/com/qoj/module/setting/service/SystemSettingServiceTest.java:28) | 28 | `import static org.mockito.ArgumentMatchers.anyString;` |
