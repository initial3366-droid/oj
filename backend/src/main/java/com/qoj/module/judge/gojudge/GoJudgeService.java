package com.qoj.module.judge.gojudge;

import com.qoj.common.enums.SubmissionStatus;
import com.qoj.config.QojProperties;
import com.qoj.module.judge.JudgeCaseResult;
import com.qoj.module.judge.JudgeResult;
import com.qoj.module.judge.JudgeService;
import com.qoj.module.judge.JudgeTask;
import com.qoj.module.judge.gojudge.GoJudgeClient.Command;
import com.qoj.module.judge.gojudge.GoJudgeClient.CommandFile;
import com.qoj.module.judge.gojudge.GoJudgeClient.Result;
import com.qoj.module.judge.gojudge.GoJudgeClient.RunRequest;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Sandboxed judge implementation backed by criyle/go-judge.
 *
 * <p>All executable paths, arguments, environment variables and file names are
 * selected from a server-side language allowlist. User data is only copied as
 * file content or stdin, so it can never become a shell command or host path.
 */
@Service
public class GoJudgeService implements JudgeService {
    private static final Logger log = LoggerFactory.getLogger(GoJudgeService.class);
    private static final long NANOS_PER_MILLISECOND = 1_000_000L;
    private static final long BYTES_PER_MEGABYTE = 1024L * 1024L;
    private static final int CHECKER_MEMORY_MB = 256;
    private static final int MAX_CHECKER_SOURCE_BYTES = 200_000;
    private static final int MAX_TESTLIB_HEADER_BYTES = 1_000_000;
    private static final int MAX_CHECKER_TIME_MS = 5_000;
    private static final String CHECKER_SOURCE_NAME = "checker.cpp";
    private static final String CHECKER_ARTIFACT_NAME = "checker";
    private static final String TESTLIB_HEADER_NAME = "testlib.h";
    private static final String CHECKER_INPUT_NAME = "input.txt";
    private static final String CHECKER_OUTPUT_NAME = "output.txt";
    private static final String CHECKER_ANSWER_NAME = "answer.txt";
    private static final String TESTLIB_HEADER = loadTestlibHeader();
    private static final List<String> FIXED_ENV = List.of(
        "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "LANG=C.UTF-8",
        "HOME=/tmp"
    );

    private final GoJudgeClient client;
    private final QojProperties.GoJudge config;

    /**
     * 构造 Go判题Service 实例并保存其必要依赖或初始状态。可能调用外部判题或网关服务。
     */
    public GoJudgeService(GoJudgeClient client, QojProperties properties) {
        this.client = client;
        this.config = properties.getGoJudge();
    }

    /**
     * 封装判题相关逻辑。执行持久化写入；可能调用外部判题或网关服务。
     */
    @Override
    public JudgeResult judge(JudgeTask task) {
        String validationError = validateTask(task);
        if (validationError != null) {
            return JudgeResult.systemError(validationError);
        }

        Language language = Language.from(task.language());
        CompiledProgram program = compile(language, task.code());
        if (program.status != SubmissionStatus.AC) {
            return program.status == SubmissionStatus.CE
                ? JudgeResult.compileError(program.message)
                : JudgeResult.systemError(program.message);
        }

        CompiledProgram checker = null;
        if (hasChecker(task.checkerSource())) {
            checker = compileChecker(task.checkerSource());
            if (checker.status != SubmissionStatus.AC) {
                String message = "特殊判题编译失败:\n" + checker.message;
                return checker.status == SubmissionStatus.CE
                    ? JudgeResult.compileError(message)
                    : JudgeResult.systemError(message);
            }
        }

        try {
            List<JudgeCaseResult> caseResults = new ArrayList<>();
            SubmissionStatus finalStatus = SubmissionStatus.AC;
            int maxTimeMs = 0;
            Integer maxMemoryKb = null;

            for (JudgeTask.TestCase testCase : task.testCases()) {
                if (utf8Length(testCase.input()) > config.getMaxInputBytes()) {
                    return JudgeResult.systemError("测试点输入超过 go-judge 安全上限");
                }
                if (utf8Length(testCase.expectedOutput()) > config.getMaxOutputBytes()) {
                    return JudgeResult.systemError("测试点输出超过 go-judge 安全上限");
                }
                // go-judge executes multiple cmd entries as one concurrent process group.
                // Independent test cases stay one-per-request to prevent resource amplification.
                List<Result> results = client.run(
                    /**
                     * 封装Run请求相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                     */
                    new RunRequest(List.of(runCommand(
                        language, program.fileId, testCase.input(), task.timeLimit(), task.memoryLimit()))),
                    runRequestTimeout(task.timeLimit())
                );
                if (results.size() != 1 || results.get(0) == null) {
                    return JudgeResult.systemError("go-judge 返回的测试点格式错误");
                }

                CaseExecution execution = mapRunResult(results.get(0));
                SubmissionStatus status = execution.status;
                String message = execution.message;
                if (status == SubmissionStatus.AC) {
                    if (checker == null) {
                        if (!sameOutput(execution.output, testCase.expectedOutput())) {
                            status = SubmissionStatus.WA;
                            message = "Wrong Answer";
                        }
                    } else {
                        CheckerExecution checkerExecution = runChecker(
                            checker.fileId,
                            testCase,
                            execution.output,
                            task.timeLimit()
                        );
                        status = checkerExecution.status;
                        message = checkerExecution.message;
                    }
                }
                caseResults.add(new JudgeCaseResult(
                    testCase.caseNo(),
                    status,
                    execution.timeMs,
                    execution.memoryKb,
                    truncate(testCase.input(), 200),
                    truncate(execution.output, 200),
                    truncate(testCase.expectedOutput(), 200),
                    message
                ));
                maxTimeMs = Math.max(maxTimeMs, execution.timeMs);
                if (execution.memoryKb > 0) {
                    maxMemoryKb = maxMemoryKb == null
                        ? execution.memoryKb
                        : Math.max(maxMemoryKb, execution.memoryKb);
                }
                if (finalStatus == SubmissionStatus.AC && status != SubmissionStatus.AC) {
                    finalStatus = status;
                }
            }

            /**
             * 封装判题结果相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new JudgeResult(finalStatus, "", maxTimeMs, maxMemoryKb, caseResults);
        } catch (GoJudgeClient.GoJudgeClientException ex) {
            log.warn("go-judge execution failed for submission {}: {}", task.submissionId(), ex.getMessage());
            return JudgeResult.systemError("go-judge 服务不可用或执行失败");
        } finally {
            client.deleteFile(program.fileId);
            if (checker != null) {
                client.deleteFile(checker.fileId);
            }
        }
    }

    /**
     * 封装runCustom相关逻辑。执行持久化写入；可能调用外部判题或网关服务。
     */
    @Override
    public SandboxResult runCustom(
        String languageValue,
        String code,
        String input,
        Integer timeLimit,
        Integer memoryLimit
    ) {
        Language language = Language.from(languageValue);
        if (language == null) {
            /**
             * 封装沙箱结果相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new SandboxResult("", "不支持的语言", SubmissionStatus.CE.name(), 0, 0);
        }
        int safeTime = timeLimit == null ? 2000 : timeLimit;
        int safeMemory = memoryLimit == null ? 256 : memoryLimit;
        if (utf8Length(code) > config.getMaxSourceBytes() || utf8Length(input) > config.getMaxInputBytes()) {
            /**
             * 封装沙箱结果相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new SandboxResult("", "代码或输入超过安全上限", SubmissionStatus.SE.name(), 0, 0);
        }
        if (!validCustomRunLimits(safeTime, safeMemory)) {
            /**
             * 封装沙箱结果相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new SandboxResult("", "运行限制超出安全范围", SubmissionStatus.SE.name(), 0, 0);
        }

        CompiledProgram program = compile(language, code);
        if (program.status != SubmissionStatus.AC) {
            /**
             * 封装沙箱结果相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new SandboxResult("", program.message, program.status.name(), 0, 0);
        }
        try {
            List<Result> results = client.run(
                /**
                 * 封装Run请求相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                new RunRequest(List.of(runCommand(language, program.fileId, input, safeTime, safeMemory))),
                runRequestTimeout(safeTime)
            );
            if (results.size() != 1 || results.get(0) == null) {
                /**
                 * 封装沙箱结果相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                return new SandboxResult("", "go-judge 返回格式错误", SubmissionStatus.SE.name(), 0, 0);
            }
            CaseExecution execution = mapRunResult(results.get(0));
            /**
             * 封装沙箱结果相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new SandboxResult(
                execution.output,
                execution.error,
                execution.status.name(),
                execution.timeMs,
                execution.memoryKb
            );
        } catch (GoJudgeClient.GoJudgeClientException ex) {
            /**
             * 封装沙箱结果相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new SandboxResult("", "go-judge 服务不可用或执行失败", SubmissionStatus.SE.name(), 0, 0);
        } finally {
            client.deleteFile(program.fileId);
        }
    }

    public boolean supportsLanguage(String value) {
        return Language.from(value) != null;
    }

    private CompiledProgram compile(Language language, String code) {
        if (language == null) {
            /**
             * 构造 CompiledProgram 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new CompiledProgram(SubmissionStatus.CE, null, "不支持的语言");
        }
        if (utf8Length(code) > config.getMaxSourceBytes()) {
            /**
             * 构造 CompiledProgram 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new CompiledProgram(SubmissionStatus.CE, null, "源代码超过安全上限");
        }
        try {
            Command command = compileCommand(language, code);
            List<Result> results = client.run(
                /**
                 * 封装Run请求相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                new RunRequest(List.of(command)),
                Duration.ofMillis(config.getCompileTimeoutMs() + 10_000L)
            );
            if (results.size() != 1) {
                /**
                 * 构造 CompiledProgram 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                return new CompiledProgram(SubmissionStatus.SE, null, "go-judge 编译响应格式错误");
            }
            Result result = results.get(0);
            if (!"Accepted".equals(result.status()) || result.exitStatus() != 0) {
                if ("Internal Error".equals(result.status()) || "File Error".equals(result.status())) {
                    /**
                     * 构造 CompiledProgram 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                     */
                    return new CompiledProgram(SubmissionStatus.SE, null, "go-judge 编译环境错误");
                }
                /**
                 * 构造 CompiledProgram 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                return new CompiledProgram(SubmissionStatus.CE, null, compileMessage(result));
            }
            String fileId = result.fileIds() == null ? null : result.fileIds().get(language.artifactName);
            if (fileId == null || fileId.isBlank()) {
                /**
                 * 构造 CompiledProgram 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                return new CompiledProgram(SubmissionStatus.SE, null, "go-judge 未返回编译产物");
            }
            /**
             * 构造 CompiledProgram 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new CompiledProgram(SubmissionStatus.AC, fileId, "");
        } catch (GoJudgeClient.GoJudgeClientException ex) {
            log.warn("go-judge compile request failed: {}", ex.getMessage());
            /**
             * 构造 CompiledProgram 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new CompiledProgram(SubmissionStatus.SE, null, "go-judge 编译服务不可用");
        }
    }

    private CompiledProgram compileChecker(String source) {
        if (utf8Length(source) > MAX_CHECKER_SOURCE_BYTES) {
            return new CompiledProgram(SubmissionStatus.CE, null, "特殊判题代码超过安全上限");
        }
        try {
            Map<String, CommandFile> copyIn = new LinkedHashMap<>();
            copyIn.put(CHECKER_SOURCE_NAME, CommandFile.content(source));
            copyIn.put(TESTLIB_HEADER_NAME, CommandFile.content(TESTLIB_HEADER));
            Command command = command(
                List.of(
                    "/usr/bin/g++", "-std=c++17", "-O2", "-pipe",
                    "-I", ".",
                    CHECKER_SOURCE_NAME, "-o", CHECKER_ARTIFACT_NAME
                ),
                standardFiles(""),
                (long) config.getCompileTimeoutMs() * NANOS_PER_MILLISECOND,
                (config.getCompileTimeoutMs() + 5_000L) * NANOS_PER_MILLISECOND,
                512L * BYTES_PER_MEGABYTE,
                copyIn,
                List.of(CHECKER_ARTIFACT_NAME)
            );
            List<Result> results = client.run(
                new RunRequest(List.of(command)),
                Duration.ofMillis(config.getCompileTimeoutMs() + 10_000L)
            );
            if (results.size() != 1 || results.get(0) == null) {
                return new CompiledProgram(SubmissionStatus.SE, null, "go-judge 特殊判题编译响应格式错误");
            }
            Result result = results.get(0);
            if (!"Accepted".equals(result.status()) || result.exitStatus() != 0) {
                if ("Internal Error".equals(result.status()) || "File Error".equals(result.status())) {
                    return new CompiledProgram(SubmissionStatus.SE, null, "go-judge 特殊判题编译环境错误");
                }
                return new CompiledProgram(SubmissionStatus.CE, null, compileMessage(result));
            }
            String fileId = result.fileIds() == null ? null : result.fileIds().get(CHECKER_ARTIFACT_NAME);
            if (fileId == null || fileId.isBlank()) {
                return new CompiledProgram(SubmissionStatus.SE, null, "go-judge 未返回特殊判题编译产物");
            }
            return new CompiledProgram(SubmissionStatus.AC, fileId, "");
        } catch (GoJudgeClient.GoJudgeClientException ex) {
            log.warn("go-judge checker compile request failed: {}", ex.getMessage());
            return new CompiledProgram(SubmissionStatus.SE, null, "go-judge 特殊判题编译服务不可用");
        }
    }

    private CheckerExecution runChecker(
        String checkerFileId,
        JudgeTask.TestCase testCase,
        String actualOutput,
        int timeLimitMs
    ) {
        int timeoutMs = checkerTimeoutMs(timeLimitMs);
        long cpuLimit = timeoutMs * NANOS_PER_MILLISECOND;
        long clockLimit = Math.max(cpuLimit + NANOS_PER_MILLISECOND, cpuLimit * 3L);
        Map<String, CommandFile> copyIn = new LinkedHashMap<>();
        copyIn.put(CHECKER_ARTIFACT_NAME, CommandFile.cached(checkerFileId));
        copyIn.put(CHECKER_INPUT_NAME, CommandFile.content(testCase.input()));
        copyIn.put(CHECKER_OUTPUT_NAME, CommandFile.content(actualOutput));
        copyIn.put(CHECKER_ANSWER_NAME, CommandFile.content(testCase.expectedOutput()));
        try {
            List<Result> results = client.run(
                new RunRequest(List.of(command(
                    List.of(
                        "./" + CHECKER_ARTIFACT_NAME,
                        CHECKER_INPUT_NAME,
                        CHECKER_OUTPUT_NAME,
                        CHECKER_ANSWER_NAME
                    ),
                    standardFiles(""),
                    cpuLimit,
                    clockLimit,
                    CHECKER_MEMORY_MB * BYTES_PER_MEGABYTE,
                    copyIn,
                    List.of()
                ))),
                runRequestTimeout(timeoutMs)
            );
            if (results.size() != 1 || results.get(0) == null) {
                return new CheckerExecution(SubmissionStatus.SE, "go-judge 特殊判题响应格式错误");
            }
            Result result = results.get(0);
            String message = checkerMessage(result);
            if ("Accepted".equals(result.status()) && result.exitStatus() == 0) {
                return new CheckerExecution(SubmissionStatus.AC, message);
            }
            if (result.exitStatus() == 1 || result.exitStatus() == 2) {
                return new CheckerExecution(
                    SubmissionStatus.WA,
                    message.isBlank() ? "Wrong Answer" : message
                );
            }
            if ("Time Limit Exceeded".equals(result.status())) {
                return new CheckerExecution(SubmissionStatus.SE, "特殊判题程序执行超时");
            }
            String failure = message.isBlank() ? "特殊判题程序执行失败" : message;
            return new CheckerExecution(SubmissionStatus.SE, failure);
        } catch (GoJudgeClient.GoJudgeClientException ex) {
            log.warn("go-judge checker execution failed: {}", ex.getMessage());
            return new CheckerExecution(SubmissionStatus.SE, "go-judge 特殊判题服务不可用或执行失败");
        }
    }

    private boolean hasChecker(String source) {
        return source != null && !source.isBlank();
    }

    private int checkerTimeoutMs(int timeLimitMs) {
        return Math.min(MAX_CHECKER_TIME_MS, Math.max(1_000, timeLimitMs + 1_000));
    }

    private String checkerMessage(Result result) {
        String stderr = output(result, "stderr");
        return stderr.isBlank() ? output(result, "stdout") : stderr;
    }

    private static String loadTestlibHeader() {
        try (InputStream stream = GoJudgeService.class.getResourceAsStream("/judge/testlib.h")) {
            if (stream == null) {
                throw new IllegalStateException("缺少内置 testlib.h");
            }
            byte[] bytes = stream.readAllBytes();
            if (bytes.length == 0 || bytes.length > MAX_TESTLIB_HEADER_BYTES) {
                throw new IllegalStateException("内置 testlib.h 大小异常");
            }
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("读取内置 testlib.h 失败", ex);
        }
    }

    private Command compileCommand(Language language, String code) {
        Map<String, CommandFile> copyIn = new LinkedHashMap<>();
        copyIn.put(language.sourceName, CommandFile.content(code));
        /**
         * 封装command相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return command(
            language.compileArgs,
            standardFiles(""),
            (long) config.getCompileTimeoutMs() * NANOS_PER_MILLISECOND,
            (config.getCompileTimeoutMs() + 5_000L) * NANOS_PER_MILLISECOND,
            512L * BYTES_PER_MEGABYTE,
            copyIn,
            List.of(language.artifactName)
        );
    }

    private Command runCommand(Language language, String fileId, String input, int timeLimitMs, int memoryLimitMb) {
        Map<String, CommandFile> copyIn = Map.of(language.artifactName, CommandFile.cached(fileId));
        List<String> args = language.runArgs(memoryLimitMb);
        long cpuLimit = timeLimitMs * NANOS_PER_MILLISECOND;
        long clockLimit = Math.max(cpuLimit + 2_000L * NANOS_PER_MILLISECOND, cpuLimit * 3L);
        /**
         * 封装command相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return command(
            args,
            standardFiles(input),
            cpuLimit,
            clockLimit,
            memoryLimitMb * BYTES_PER_MEGABYTE,
            copyIn,
            List.of()
        );
    }

    private Command command(
        List<String> args,
        List<CommandFile> files,
        long cpuLimit,
        long clockLimit,
        long memoryLimit,
        Map<String, CommandFile> copyIn,
        List<String> copyOutCached
    ) {
        return new Command(
            args,
            FIXED_ENV,
            files,
            cpuLimit,
            clockLimit,
            memoryLimit,
            Math.min(memoryLimit, 256L * BYTES_PER_MEGABYTE),
            config.getMaxProcesses(),
            copyIn,
            List.of("stdout", "stderr"),
            copyOutCached,
            config.getMaxOutputBytes(),
            true,
            true
        );
    }

    private List<CommandFile> standardFiles(String input) {
        return List.of(
            CommandFile.content(input),
            CommandFile.collector("stdout", config.getMaxOutputBytes()),
            CommandFile.collector("stderr", config.getMaxOutputBytes())
        );
    }

    private CaseExecution mapRunResult(Result result) {
        String status = result.status() == null ? "Invalid" : result.status();
        SubmissionStatus mapped = switch (status) {
            case "Accepted" -> result.exitStatus() == 0 ? SubmissionStatus.AC : SubmissionStatus.RE;
            case "Time Limit Exceeded" -> SubmissionStatus.TLE;
            case "Memory Limit Exceeded" -> SubmissionStatus.MLE;
            case "Nonzero Exit Status", "Signalled", "Dangerous Syscall", "Output Limit Exceeded" -> SubmissionStatus.RE;
            case "Wrong Answer", "Partially Correct" -> SubmissionStatus.WA;
            default -> SubmissionStatus.SE;
        };
        String stdout = output(result, "stdout");
        String stderr = output(result, "stderr");
        String message = mapped == SubmissionStatus.SE
            ? "go-judge: " + status
            : status;
        if (result.error() != null && !result.error().isBlank()) {
            message = message + ": " + truncate(result.error(), 4096);
        }
        /**
         * 构造 测试点Execution 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new CaseExecution(
            mapped,
            stdout,
            stderr,
            nanosToMillis(result.time()),
            bytesToKilobytes(result.memory()),
            message
        );
    }

    private String compileMessage(Result result) {
        String stderr = output(result, "stderr");
        String stdout = output(result, "stdout");
        String combined = !stderr.isBlank() ? stderr : stdout;
        if (combined.isBlank()) {
            combined = result.status() == null ? "编译失败" : result.status();
        }
        /**
         * 封装truncate相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return truncate(combined, config.getMaxOutputBytes());
    }

    private String output(Result result, String name) {
        if (result.files() == null) {
            return "";
        }
        /**
         * 封装truncate相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return truncate(result.files().getOrDefault(name, ""), config.getMaxOutputBytes());
    }

    private String validateTask(JudgeTask task) {
        if (task == null || task.testCases() == null || task.testCases().isEmpty()) {
            return "题目未配置隐藏测试点";
        }
        if (Language.from(task.language()) == null) {
            return "不支持的语言";
        }
        if (utf8Length(task.code()) > config.getMaxSourceBytes()) {
            return "源代码超过 go-judge 安全上限";
        }
        if (!validTaskLimits(task.timeLimit(), task.memoryLimit())) {
            return "题目资源限制超出安全范围";
        }
        return null;
    }

    private boolean validCustomRunLimits(Integer timeLimitMs, Integer memoryLimitMb) {
        return timeLimitMs != null && timeLimitMs >= 100 && timeLimitMs <= 60000
            && memoryLimitMb != null && memoryLimitMb >= 16 && memoryLimitMb <= 1024;
    }

    private boolean validTaskLimits(Integer timeLimitMs, Integer memoryLimitMb) {
        return timeLimitMs != null && timeLimitMs >= 100 && timeLimitMs <= 120000
            && memoryLimitMb != null && memoryLimitMb >= 16 && memoryLimitMb <= 2048;
    }

    private Duration runRequestTimeout(int timeLimitMs) {
        long desired = Math.max(5000L, timeLimitMs * 3L + 10_000L);
        return Duration.ofMillis(Math.min(config.getRequestTimeoutMs(), desired));
    }

    private int utf8Length(String value) {
        return value == null ? 0 : value.getBytes(StandardCharsets.UTF_8).length;
    }

    private boolean sameOutput(String actual, String expected) {
        String[] actualTokens = tokenize(actual);
        String[] expectedTokens = tokenize(expected);
        if (actualTokens.length != expectedTokens.length) {
            return false;
        }
        for (int index = 0; index < actualTokens.length; index++) {
            if (!actualTokens[index].equals(expectedTokens[index])) {
                return false;
            }
        }
        return true;
    }

    private String[] tokenize(String value) {
        if (value == null || value.isBlank()) {
            return new String[0];
        }
        return value.strip().split("\\s+");
    }

    private int nanosToMillis(long value) {
        long millis = (value + NANOS_PER_MILLISECOND - 1) / NANOS_PER_MILLISECOND;
        return (int) Math.min(Integer.MAX_VALUE, Math.max(0, millis));
    }

    private int bytesToKilobytes(long value) {
        long kilobytes = (value + 1023L) / 1024L;
        return (int) Math.min(Integer.MAX_VALUE, Math.max(0, kilobytes));
    }

    private String truncate(String value, int maxChars) {
        if (value == null) {
            return "";
        }
        return value.length() <= maxChars ? value : value.substring(0, maxChars) + "\n... (truncated)";
    }

    /**
     * Language枚举。限定该领域允许出现的离散状态，避免在业务代码中传播无约束字符串。
     */
    private enum Language {
        C(
            "main.c",
            "main",
            List.of("/usr/bin/gcc", "-std=c11", "-O2", "-pipe", "main.c", "-o", "main")
        ),
        CPP(
            "main.cpp",
            "main",
            List.of("/usr/bin/g++", "-std=c++17", "-O2", "-pipe", "main.cpp", "-o", "main")
        ),
        PYTHON(
            "main.py",
            "main.py",
            List.of("/usr/bin/python3", "-m", "py_compile", "main.py")
        ),
        JAVA(
            "Main.java",
            "main.jar",
            List.of("/usr/local/bin/qoj-java-compile")
        );

        private final String sourceName;
        private final String artifactName;
        private final List<String> compileArgs;

        /**
         * 构造 Language 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        Language(String sourceName, String artifactName, List<String> compileArgs) {
            this.sourceName = sourceName;
            this.artifactName = artifactName;
            this.compileArgs = compileArgs;
        }

        /**
         * 封装runArgs相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        private List<String> runArgs(int memoryLimitMb) {
            return switch (this) {
                case C, CPP -> List.of("./main");
                case PYTHON -> List.of("/usr/bin/python3", "main.py");
                case JAVA -> List.of(
                    "/usr/bin/java",
                    "-Xms16m",
                    "-Xmx" + Math.max(16, memoryLimitMb - 32) + "m",
                    "-XX:+UseSerialGC",
                    "-cp",
                    "main.jar",
                    "Main"
                );
            };
        }

        /**
         * 封装from相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        private static Language from(String value) {
            String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
            return switch (normalized) {
                case "c" -> C;
                case "cpp", "c++", "cxx", "g++" -> CPP;
                case "python", "python3", "py" -> PYTHON;
                case "java" -> JAVA;
                default -> null;
            };
        }
    }

    /**
     * CompiledProgram不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    private record CompiledProgram(SubmissionStatus status, String fileId, String message) {
    }

    /**
     * 测试点Execution不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    private record CaseExecution(
        SubmissionStatus status,
        String output,
        String error,
        int timeMs,
        int memoryKb,
        String message
    ) {
    }

    private record CheckerExecution(SubmissionStatus status, String message) {
    }
}
