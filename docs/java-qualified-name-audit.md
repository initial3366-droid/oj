# Java 全限定类名清理统计

本轮扫描当前项目 503 个 Java 源文件，包含主后端、独立 Agent、测试和 Java 示例。不扫描生成目录、依赖目录或运行时归档副本。统计不包含 import、package、注释、字符串、反射类名文本。

| 项目 | 数量 |
|---|---:|
| 扫描文件 | 503 |
| 存在全限定类型引用的文件 | 55 |
| 清理前引用 | 268 |
| 修改文件 | 55 |
| 替换引用 | 266 |
| 必要保留引用 | 2 |

## 修改方法和验证

使用 JDK 编译器语法树及类型符号解析，检查已有 import、通配符 import、已使用简名、当前作用域和继承成员的命名冲突，替换无冲突引用。保留嵌套类型的外部类限定方式。没有新增依赖、修改业务逻辑或全项目格式化；检查确认 55 个修改文件的字符串和注释原文全部保持一致。

- 主后端：45 个生产文件、8 个现有测试文件。
- 独立 Agent：2 个生产文件。
- 修改前后全部 503 个源文件均通过 JDK 类型分析，编译错误为 0。
- 主后端 `mvn package`：183 项测试通过，失败 0、错误 0、跳过 0。
- 独立 Agent `mvn package`：成功；该模块没有测试用例。
- 未新增测试，未执行真实模型、数据库或浏览器端到端测试；此次仅调整类型引用和 import。

## 保留项

`backend/src/main/java/com/qoj/module/agent/service/OpenAiCompatibleAgentClient.java` 第 81、139 行的 `org.springframework.ai.chat.messages.Message` 必须区分继承自 `AgentClient` 的 `Message`，因此保留全限定名。清理后重新扫描仅余这两处实际全限定类型引用。

## 各文件统计

| 文件 | 清理前 | 已替换 | 保留 |
|---|---:|---:|---:|
| `agent-java/src/main/java/com/qojagent/service/ProblemGenerationService.java` | 1 | 1 | 0 |
| `agent-java/src/main/java/com/qojagent/api/AgentController.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/security/WebSocketSubscriptionInterceptor.java` | 2 | 2 | 0 |
| `backend/src/main/java/com/qoj/config/SecurityConfig.java` | 3 | 3 | 0 |
| `backend/src/main/java/com/qoj/module/xcpcio/service/XcpcioConfigService.java` | 4 | 4 | 0 |
| `backend/src/main/java/com/qoj/module/submission/service/SubmissionService.java` | 19 | 19 | 0 |
| `backend/src/main/java/com/qoj/module/submission/service/SubmissionQueueService.java` | 6 | 6 | 0 |
| `backend/src/main/java/com/qoj/module/submission/mapper/SubmissionMapper.java` | 6 | 6 | 0 |
| `backend/src/main/java/com/qoj/module/home/service/HomeService.java` | 1 | 1 | 0 |
| `backend/src/test/java/com/qoj/module/submission/service/SubmissionQueueServiceTest.java` | 2 | 2 | 0 |
| `backend/src/test/java/com/qoj/module/submission/service/JudgeCallbackServiceTest.java` | 3 | 3 | 0 |
| `backend/src/test/java/com/qoj/module/setting/service/SystemSettingServiceTest.java` | 1 | 1 | 0 |
| `backend/src/test/java/com/qoj/module/contest/service/ContestServiceScoreboardFreezeTest.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/agent/service/OpenAiCompatibleAgentClient.java` | 7 | 5 | 2 |
| `backend/src/main/java/com/qoj/module/agent/service/AgentTimeouts.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/agent/service/AgentModelFactory.java` | 5 | 5 | 0 |
| `backend/src/test/java/com/qoj/module/problem/service/ProblemServiceOwnerIdentityTest.java` | 1 | 1 | 0 |
| `backend/src/test/java/com/qoj/module/practice/service/PracticePublicationServiceTest.java` | 16 | 16 | 0 |
| `backend/src/test/java/com/qoj/module/agent/service/AgentToolContractTest.java` | 1 | 1 | 0 |
| `backend/src/test/java/com/qoj/module/practice/controller/PracticeControllerTest.java` | 3 | 3 | 0 |
| `backend/src/main/java/com/qoj/module/practice/service/PracticeService.java` | 3 | 3 | 0 |
| `backend/src/main/java/com/qoj/module/practice/service/PracticePublicationService.java` | 12 | 12 | 0 |
| `backend/src/main/java/com/qoj/module/user/service/AdminStudentBatchService.java` | 3 | 3 | 0 |
| `backend/src/main/java/com/qoj/module/practice/controller/AdminPracticeController.java` | 4 | 4 | 0 |
| `backend/src/main/java/com/qoj/module/auth/service/AuthService.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/auth/service/CaptchaService.java` | 16 | 16 | 0 |
| `backend/src/main/java/com/qoj/module/practice/dto/PracticePublicationRequest.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/practice/entity/PracticePublication.java` | 2 | 2 | 0 |
| `backend/src/main/java/com/qoj/module/contest/service/ContestInspectionExportService.java` | 9 | 9 | 0 |
| `backend/src/main/java/com/qoj/module/contest/service/ContestService.java` | 54 | 54 | 0 |
| `backend/src/main/java/com/qoj/module/contest/service/ContestMessageService.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/auth/controller/AuthController.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/course/service/CourseService.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/course/controller/AdminCourseController.java` | 4 | 4 | 0 |
| `backend/src/main/java/com/qoj/module/contest/mapper/ContestMapper.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/admin/service/AdminDashboardService.java` | 3 | 3 | 0 |
| `backend/src/main/java/com/qoj/module/judge/JudgeTask.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/course/vo/CoursePracticeVO.java` | 2 | 2 | 0 |
| `backend/src/main/java/com/qoj/module/course/dto/CourseRequest.java` | 2 | 2 | 0 |
| `backend/src/main/java/com/qoj/module/judge/service/JudgeQueueScheduler.java` | 3 | 3 | 0 |
| `backend/src/main/java/com/qoj/module/course/mapper/CourseMapper.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/problem/service/ProblemDraftService.java` | 5 | 5 | 0 |
| `backend/src/main/java/com/qoj/module/problem/service/ProblemService.java` | 24 | 24 | 0 |
| `backend/src/main/java/com/qoj/module/problem/service/TestCaseZipReader.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/problem/service/CommunicationPackageReader.java` | 2 | 2 | 0 |
| `backend/src/main/java/com/qoj/module/problem/entity/Problem.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/problem/mapper/ProblemMapper.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/judge/gojudge/GoJudgeService.java` | 7 | 7 | 0 |
| `backend/src/main/java/com/qoj/module/judge/gojudge/CommunicationJudge.java` | 4 | 4 | 0 |
| `backend/src/main/java/com/qoj/module/problem/controller/AdminProblemController.java` | 1 | 1 | 0 |
| `backend/src/main/java/com/qoj/module/problem/controller/AdminProblemDraftController.java` | 2 | 2 | 0 |
| `backend/src/main/java/com/qoj/module/problem/vo/AdminProblemVO.java` | 3 | 3 | 0 |
| `backend/src/main/java/com/qoj/module/problem/vo/PublicProblemVO.java` | 3 | 3 | 0 |
| `backend/src/main/java/com/qoj/module/problem/vo/ProblemVO.java` | 3 | 3 | 0 |
| `backend/src/main/java/com/qoj/module/problem/dto/CommunicationConfig.java` | 2 | 2 | 0 |
