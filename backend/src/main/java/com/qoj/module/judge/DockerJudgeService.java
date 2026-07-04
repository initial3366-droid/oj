package com.qoj.module.judge;

import com.qoj.common.enums.SubmissionStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Docker 隔离判题服务
 *
 * 使用 Docker 容器隔离执行用户代码，限制：
 * - CPU
 * - 内存
 * - 进程数
 * - 网络访问
 * - 文件系统
 * - 运行时间
 * - 输出大小
 */
@Service
public class DockerJudgeService implements JudgeService {
    private static final Logger log = LoggerFactory.getLogger(DockerJudgeService.class);

    private static final int MAX_OUTPUT_BYTES = 10 * 1024 * 1024; // 10MB
    private static final int MAX_PROCESSES = 32;
    private static final String DOCKER_IMAGE = "qoj-judge:latest";
    private static final String JUDGE_WORK_DIR_ENV = "JUDGE_WORK_DIR";

    @Override
    public JudgeResult judge(JudgeTask task) {
        Path workDir = null;
        try {
            workDir = createWorkDir("qoj-docker-judge-");

            // 编译
            CompileResult compileResult = compile(workDir, task.language(), task.code());
            if (compileResult.status() != SubmissionStatus.AC) {
                return JudgeResult.compileError(compileResult.output());
            }

            // 运行所有测试点
            List<JudgeCaseResult> caseResults = new ArrayList<>();
            int maxTime = 0;
            int maxMemory = 0;
            SubmissionStatus finalStatus = SubmissionStatus.AC;

            for (JudgeTask.TestCase testCase : task.testCases()) {
                RunResult result = runTestCase(
                    workDir,
                    compileResult.runCommand(),
                    testCase.input(),
                    task.timeLimit(),
                    task.memoryLimit()
                );

                SubmissionStatus caseStatus = result.status();
                if (caseStatus == SubmissionStatus.AC && !compareOutput(result.output(), testCase.expectedOutput())) {
                    caseStatus = SubmissionStatus.WA;
                }

                caseResults.add(new JudgeCaseResult(
                    testCase.caseNo(),
                    caseStatus,
                    result.timeMs(),
                    result.memoryKb(),
                    result.message()
                ));

                maxTime = Math.max(maxTime, result.timeMs());
                maxMemory = Math.max(maxMemory, result.memoryKb());

                if (caseStatus != SubmissionStatus.AC) {
                    finalStatus = caseStatus;
                    break;
                }
            }

            return new JudgeResult(finalStatus, "", maxTime, maxMemory, caseResults);

        } catch (IOException ex) {
            log.error("Judge error", ex);
            return JudgeResult.systemError("系统错误: " + ex.getMessage());
        } finally {
            cleanupWorkDir(workDir);
        }
    }

    @Override
    public SandboxResult runCustom(String language, String code, String input, Integer timeLimit, Integer memoryLimit) {
        Path workDir = null;
        try {
            workDir = createWorkDir("qoj-docker-sandbox-");

            CompileResult compileResult = compile(workDir, language, code);
            if (compileResult.status() != SubmissionStatus.AC) {
                return new SandboxResult("", compileResult.output(), SubmissionStatus.CE.name(), 0, 0);
            }

            RunResult result = runTestCase(
                workDir,
                compileResult.runCommand(),
                input,
                timeLimit == null ? 2000 : timeLimit,
                memoryLimit == null ? 256 : memoryLimit
            );

            return new SandboxResult(
                result.output(),
                result.error(),
                result.status().name(),
                result.timeMs(),
                result.memoryKb()
            );

        } catch (IOException ex) {
            log.error("Sandbox error", ex);
            return new SandboxResult("", "系统错误: " + ex.getMessage(), SubmissionStatus.SE.name(), 0, 0);
        } finally {
            cleanupWorkDir(workDir);
        }
    }

    private CompileResult compile(Path workDir, String language, String code) throws IOException {
        String normalized = language == null ? "" : language.toLowerCase(Locale.ROOT).replace("+", "p");

        if (normalized.contains("cpp") || normalized.contains("c++")) {
            return compileCpp(workDir, code);
        } else if (normalized.equals("c")) {
            return compileC(workDir, code);
        } else if (normalized.contains("python")) {
            return compilePython(workDir, code);
        } else if (normalized.contains("java")) {
            return compileJava(workDir, code);
        } else {
            return new CompileResult(SubmissionStatus.CE, "不支持的语言: " + language, List.of());
        }
    }

    private CompileResult compileCpp(Path workDir, String code) throws IOException {
        Path source = workDir.resolve("main.cpp");
        Files.writeString(source, code, StandardCharsets.UTF_8);
        makeSourceReadable(source);

        // 在 Docker 中编译
        List<String> compileCmd = List.of(
            "docker", "run", "--rm",
            "--network", "none",
            "--memory", "512m",
            "--cpus", "1",
            "--pids-limit", String.valueOf(MAX_PROCESSES),
            "-v", workDir.toString() + ":/workspace:rw",
            "-w", "/workspace",
            DOCKER_IMAGE,
            "g++", "-std=c++17", "-O2", "-Wall", "/workspace/main.cpp", "-o", "/workspace/main"
        );

        ProcessResult result = runProcess(compileCmd, workDir, "", 10000);
        if (result.exitCode() != 0) {
            return new CompileResult(SubmissionStatus.CE, truncateOutput(result.stderr()), List.of());
        }

        return new CompileResult(SubmissionStatus.AC, "", List.of("/workspace/main"));
    }

    private CompileResult compileC(Path workDir, String code) throws IOException {
        Path source = workDir.resolve("main.c");
        Files.writeString(source, code, StandardCharsets.UTF_8);
        makeSourceReadable(source);

        List<String> compileCmd = List.of(
            "docker", "run", "--rm",
            "--network", "none",
            "--memory", "512m",
            "--cpus", "1",
            "--pids-limit", String.valueOf(MAX_PROCESSES),
            "-v", workDir.toString() + ":/workspace:rw",
            "-w", "/workspace",
            DOCKER_IMAGE,
            "gcc", "-std=c11", "-O2", "-Wall", "/workspace/main.c", "-o", "/workspace/main"
        );

        ProcessResult result = runProcess(compileCmd, workDir, "", 10000);
        if (result.exitCode() != 0) {
            return new CompileResult(SubmissionStatus.CE, truncateOutput(result.stderr()), List.of());
        }

        return new CompileResult(SubmissionStatus.AC, "", List.of("/workspace/main"));
    }

    private CompileResult compilePython(Path workDir, String code) throws IOException {
        Path source = workDir.resolve("main.py");
        Files.writeString(source, code, StandardCharsets.UTF_8);
        makeSourceReadable(source);

        // Python 不需要编译，直接返回解释器命令
        return new CompileResult(SubmissionStatus.AC, "", List.of("python3", "/workspace/main.py"));
    }

    private CompileResult compileJava(Path workDir, String code) throws IOException {
        Path source = workDir.resolve("Main.java");
        Files.writeString(source, code, StandardCharsets.UTF_8);
        makeSourceReadable(source);

        List<String> compileCmd = List.of(
            "docker", "run", "--rm",
            "--network", "none",
            "--memory", "512m",
            "--cpus", "1",
            "--pids-limit", String.valueOf(MAX_PROCESSES),
            "-v", workDir.toString() + ":/workspace:rw",
            "-w", "/workspace",
            DOCKER_IMAGE,
            "javac", "/workspace/Main.java"
        );

        ProcessResult result = runProcess(compileCmd, workDir, "", 10000);
        if (result.exitCode() != 0) {
            return new CompileResult(SubmissionStatus.CE, truncateOutput(result.stderr()), List.of());
        }

        return new CompileResult(SubmissionStatus.AC, "", List.of("java", "-cp", "/workspace", "Main"));
    }

    private RunResult runTestCase(Path workDir, List<String> command, String input, int timeLimitMs, int memoryLimitMb) {
        Path metricsDir = null;
        try {
            // 创建可写目录用于 /usr/bin/time 输出
            metricsDir = workDir.resolve("metrics_" + System.nanoTime());
            Files.createDirectories(metricsDir);
            makeWorkDirAccessible(metricsDir);

            // 构建 Docker 运行命令
            List<String> dockerCmd = new ArrayList<>();
            dockerCmd.add("docker");
            dockerCmd.add("run");
            dockerCmd.add("--rm");
            dockerCmd.add("-i");
            dockerCmd.add("--network");
            dockerCmd.add("none");  // 禁止网络访问
            dockerCmd.add("--memory");
            dockerCmd.add(memoryLimitMb + "m");
            dockerCmd.add("--memory-swap");
            dockerCmd.add(memoryLimitMb + "m");  // 禁用 swap
            dockerCmd.add("--cpus");
            dockerCmd.add("1");
            dockerCmd.add("--pids-limit");
            dockerCmd.add(String.valueOf(MAX_PROCESSES));
            dockerCmd.add("-v");
            dockerCmd.add(workDir.toString() + ":/workspace:ro");  // 只读挂载
            dockerCmd.add("-v");
            dockerCmd.add(metricsDir.toString() + ":/metrics:rw");  // 可写挂载用于 time 输出
            dockerCmd.add("-w");
            dockerCmd.add("/workspace");
            dockerCmd.add(DOCKER_IMAGE);
            // 使用 /usr/bin/time 包装用户命令以获取内存峰值
            dockerCmd.add("/usr/bin/time");
            dockerCmd.add("-v");
            dockerCmd.add("-o");
            dockerCmd.add("/metrics/time.txt");
            dockerCmd.addAll(command);

            ProcessResult result = runProcess(dockerCmd, workDir, input == null ? "" : input, timeLimitMs + 1000);

            SubmissionStatus status = SubmissionStatus.AC;
            String message = "";

            if (result.timeout()) {
                status = SubmissionStatus.TLE;
                message = "Time Limit Exceeded";
            } else if (result.exitCode() != 0) {
                status = SubmissionStatus.RE;
                message = "Runtime Error (exit code: " + result.exitCode() + ")";
            } else if (result.timeMs() > timeLimitMs) {
                status = SubmissionStatus.TLE;
                message = "Time Limit Exceeded";
            }

            // 内存限制由 Docker 强制执行，如果超过会被 killed (exit code 137)
            if (result.exitCode() == 137) {
                status = SubmissionStatus.MLE;
                message = "Memory Limit Exceeded";
            }

            // 从 /usr/bin/time 输出文件解析内存峰值
            int memoryKb = parseMemoryKb(metricsDir.resolve("time.txt"));

            return new RunResult(
                status,
                truncateOutput(result.stdout()),
                truncateOutput(result.stderr()),
                result.timeMs(),
                memoryKb,
                message
            );

        } catch (Exception ex) {
            log.error("Run test case error", ex);
            return new RunResult(SubmissionStatus.SE, "", ex.getMessage(), 0, 0, "系统错误");
        } finally {
            cleanupMetricsDir(metricsDir);
        }
    }

    /**
     * 从 /usr/bin/time -v 的输出文件中解析最大驻留集大小（RSS），单位 KB。
     * 文件不存在或解析失败时返回 0（如进程被 OOM kill 或超时强杀）。
     */
    private int parseMemoryKb(Path timeFile) {
        try {
            if (!Files.exists(timeFile)) return 0;
            List<String> lines = Files.readAllLines(timeFile, StandardCharsets.UTF_8);
            for (String line : lines) {
                if (line.startsWith("Maximum resident set size (kbytes):")) {
                    String value = line.substring("Maximum resident set size (kbytes):".length()).trim();
                    return Integer.parseInt(value);
                }
            }
        } catch (Exception ex) {
            log.warn("Failed to parse memory from time output: {}", timeFile, ex);
        }
        return 0;
    }

    private void cleanupMetricsDir(Path metricsDir) {
        if (metricsDir == null) return;
        try (var stream = Files.walk(metricsDir)) {
            stream.sorted(Comparator.reverseOrder()).forEach(item -> {
                try {
                    Files.deleteIfExists(item);
                } catch (IOException ignored) {}
            });
        } catch (IOException ex) {
            log.warn("Failed to cleanup metrics directory: {}", metricsDir, ex);
        }
    }

    private ProcessResult runProcess(List<String> command, Path workDir, String input, int timeoutMs) {
        long start = System.nanoTime();
        try {
            Process process = new ProcessBuilder(command)
                .directory(workDir.toFile())
                .start();

            CompletableFuture<byte[]> stdoutFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return limitedRead(process.getInputStream(), MAX_OUTPUT_BYTES);
                } catch (IOException ex) {
                    return new byte[0];
                }
            });

            CompletableFuture<byte[]> stderrFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return limitedRead(process.getErrorStream(), MAX_OUTPUT_BYTES);
                } catch (IOException ex) {
                    return new byte[0];
                }
            });

            // 写入输入
            if (input != null && !input.isEmpty()) {
                process.getOutputStream().write(input.getBytes(StandardCharsets.UTF_8));
            }
            process.getOutputStream().close();

            // 等待完成
            boolean finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
            int timeMs = (int) Duration.ofNanos(System.nanoTime() - start).toMillis();

            if (!finished) {
                process.destroyForcibly();
                return new ProcessResult("", "", timeMs, 0, -1, true);
            }

            String stdout = new String(stdoutFuture.join(), StandardCharsets.UTF_8);
            String stderr = new String(stderrFuture.join(), StandardCharsets.UTF_8);

            // 从 Docker stats 解析内存使用（简化版，实际可通过 cgroup 获取更准确值）
            int memoryKb = 0;

            return new ProcessResult(stdout, stderr, timeMs, memoryKb, process.exitValue(), false);

        } catch (Exception ex) {
            log.error("Process execution error", ex);
            return new ProcessResult("", ex.getMessage(), 0, 0, -1, false);
        }
    }

    private byte[] limitedRead(java.io.InputStream stream, int maxBytes) throws IOException {
        byte[] buffer = new byte[Math.min(8192, maxBytes)];
        int total = 0;
        int read;

        while (total < maxBytes && (read = stream.read(buffer, 0, Math.min(buffer.length, maxBytes - total))) != -1) {
            total += read;
        }

        byte[] result = new byte[total];
        System.arraycopy(buffer, 0, result, 0, total);
        return result;
    }

    private boolean compareOutput(String actual, String expected) {
        return normalizeOutput(actual).equals(normalizeOutput(expected));
    }

    private String normalizeOutput(String value) {
        if (value == null) return "";

        String normalized = value.replace("\r\n", "\n").replace('\r', '\n');
        String[] lines = normalized.split("\n", -1);
        List<String> cleaned = new ArrayList<>();

        for (String line : lines) {
            cleaned.add(line.replaceAll("[ \\t]+$", ""));
        }

        while (!cleaned.isEmpty() && cleaned.get(cleaned.size() - 1).isEmpty()) {
            cleaned.remove(cleaned.size() - 1);
        }

        return String.join("\n", cleaned);
    }

    private String truncateOutput(String output) {
        if (output == null) return "";
        if (output.length() <= 10000) return output;
        return output.substring(0, 10000) + "\n... (truncated)";
    }

    private Path createWorkDir(String prefix) throws IOException {
        Path baseDir = judgeWorkBaseDir();
        Files.createDirectories(baseDir);
        makeWorkDirAccessible(baseDir);
        Path workDir = Files.createTempDirectory(baseDir, prefix);
        makeWorkDirAccessible(workDir);
        log.debug("Docker judge work directory: {}", workDir);
        return workDir;
    }

    private Path judgeWorkBaseDir() {
        String configured = System.getenv(JUDGE_WORK_DIR_ENV);
        if (configured == null || configured.isBlank()) {
            configured = "judge-tmp";
        }
        return Path.of(configured).toAbsolutePath().normalize();
    }

    private void makeWorkDirAccessible(Path workDir) {
        try {
            Set<PosixFilePermission> permissions = PosixFilePermissions.fromString("rwxrwxrwx");
            Files.setPosixFilePermissions(workDir, permissions);
        } catch (Exception ex) {
            log.warn("Failed to set judge work directory permissions: {}", workDir, ex);
        }
    }

    private void makeSourceReadable(Path source) {
        try {
            Set<PosixFilePermission> permissions = PosixFilePermissions.fromString("rw-r--r--");
            Files.setPosixFilePermissions(source, permissions);
        } catch (Exception ex) {
            log.warn("Failed to set judge source file permissions: {}", source, ex);
        }
    }

    private void cleanupWorkDir(Path path) {
        if (path == null) return;

        try (var stream = Files.walk(path)) {
            stream.sorted(Comparator.reverseOrder()).forEach(item -> {
                try {
                    Files.deleteIfExists(item);
                } catch (IOException ignored) {}
            });
        } catch (IOException ex) {
            log.warn("Failed to cleanup work directory: {}", path, ex);
        }
    }

    private record CompileResult(SubmissionStatus status, String output, List<String> runCommand) {}

    private record RunResult(
        SubmissionStatus status,
        String output,
        String error,
        int timeMs,
        int memoryKb,
        String message
    ) {}

    private record ProcessResult(
        String stdout,
        String stderr,
        int timeMs,
        int memoryKb,
        int exitCode,
        boolean timeout
    ) {}
}
