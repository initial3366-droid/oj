package com.qoj.module.judge.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.enums.SubmissionStatus;
import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestProblem;
import com.qoj.module.contest.entity.ContestProblemTestCase;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.contest.mapper.ContestProblemTestCaseMapper;
import com.qoj.module.contest.service.ContestAcmRankService;
import com.qoj.module.contest.service.ContestOiRankService;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.entity.SubmissionCaseResult;
import com.qoj.module.submission.mapper.SubmissionCaseResultMapper;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.service.UserProblemStatusService;
import com.qoj.module.user.service.UserScoreService;
import com.qoj.module.ws.JudgeMessagePublisher;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * ⚠️⚠️⚠️ 严重安全警告 ⚠️⚠️⚠️
 *
 * 本服务在主服务器上直接执行用户提交的代码，存在严重的安全风险：
 * - 用户代码可以访问文件系统
 * - 用户代码可以创建网络连接
 * - 用户代码可以消耗系统资源
 * - 用户代码可以执行任意系统命令
 * - 没有任何沙箱隔离机制
 *
 * ⚠️ 生产环境绝对禁止启用此服务 ⚠️
 *
 * 本服务仅用于：
 * 1. 本地开发环境测试
 * 2. 在完全隔离的虚拟机或容器中运行
 * 3. 评估判题逻辑的正确性（非生产用途）
 *
 * 生产环境必须使用：
 * 1. DockerJudgeService（推荐）- 基于 Docker 的隔离判题
 * 2. DOMjudge 远程判题
 * 3. 独立的 Judge Worker 服务
 *
 * @deprecated 不安全的判题服务，仅供开发测试
 */
@Service
@Deprecated(since = "0.2.0", forRemoval = true)
public class LocalJudgeService {
    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper problemTestCaseMapper;
    private final ContestProblemMapper contestProblemMapper;
    private final ContestProblemTestCaseMapper contestProblemTestCaseMapper;
    private final SubmissionMapper submissionMapper;
    private final SubmissionCaseResultMapper submissionCaseResultMapper;
    private final JudgeMessagePublisher judgeMessagePublisher;
    private final StringRedisTemplate redisTemplate;
    private final UserProblemStatusService userProblemStatusService;
    private final UserScoreService userScoreService;
    private final ContestMapper contestMapper;
    private final ContestAcmRankService contestAcmRankService;
    private final ContestOiRankService contestOiRankService;

    public LocalJudgeService(
        ProblemMapper problemMapper,
        ProblemTestCaseMapper problemTestCaseMapper,
        ContestProblemMapper contestProblemMapper,
        ContestProblemTestCaseMapper contestProblemTestCaseMapper,
        SubmissionMapper submissionMapper,
        SubmissionCaseResultMapper submissionCaseResultMapper,
        JudgeMessagePublisher judgeMessagePublisher,
        StringRedisTemplate redisTemplate,
        UserProblemStatusService userProblemStatusService,
        UserScoreService userScoreService,
        ContestMapper contestMapper,
        ContestAcmRankService contestAcmRankService,
        ContestOiRankService contestOiRankService
    ) {
        this.problemMapper = problemMapper;
        this.problemTestCaseMapper = problemTestCaseMapper;
        this.contestProblemMapper = contestProblemMapper;
        this.contestProblemTestCaseMapper = contestProblemTestCaseMapper;
        this.submissionMapper = submissionMapper;
        this.submissionCaseResultMapper = submissionCaseResultMapper;
        this.judgeMessagePublisher = judgeMessagePublisher;
        this.redisTemplate = redisTemplate;
        this.userProblemStatusService = userProblemStatusService;
        this.userScoreService = userScoreService;
        this.contestMapper = contestMapper;
        this.contestAcmRankService = contestAcmRankService;
        this.contestOiRankService = contestOiRankService;
    }

    public boolean hasLocalTestCases(Long problemId) {
        return problemTestCaseMapper.selectCount(
            new QueryWrapper<ProblemTestCase>().eq("problem_id", problemId).eq("sample", false)
        ) > 0;
    }

    public boolean hasLocalContestTestCases(Long contestProblemId) {
        return contestProblemTestCaseMapper.selectCount(
            new QueryWrapper<ContestProblemTestCase>().eq("contest_problem_id", contestProblemId).eq("sample", false)
        ) > 0;
    }

    @Transactional
    public void judgeSubmission(Long submissionId) {
        Submission submission = submissionMapper.selectById(submissionId);
        if (submission == null) {
            throw new BizException(404, "提交不存在");
        }
        JudgeProblemSpec spec = judgeProblemSpec(submission);
        if (spec == null) {
            throw new BizException(404, "题目不存在");
        }
        List<ProblemTestCase> testCases = loadTestCases(submission);
        if (testCases.isEmpty()) {
            throw new BizException(400, "题目未配置测试点");
        }
        LocalDateTime startedAt = LocalDateTime.now();
        submission.status = SubmissionStatus.JUDGING.name();
        if (submission.judgeStartTime == null) {
            submission.judgeStartTime = startedAt;
        }
        submission.judgeServer = submission.judgeServer == null ? "LOCAL" : submission.judgeServer;
        submission.updatedAt = startedAt;
        submissionMapper.updateById(submission);
        judgeMessagePublisher.submissionChanged(submission.id, submission.status, submission.timeUsed, submission.memoryUsed);

        JudgeSummary summary = runAll(submission, spec, testCases);
        LocalDateTime finishedAt = LocalDateTime.now();
        submission.status = summary.status().name();
        submission.timeUsed = summary.maxTimeMs();
        submission.memoryUsed = summary.maxMemoryKb();
        submission.judgeEndTime = finishedAt;
        submission.updatedAt = finishedAt;
        if (summary.status() == SubmissionStatus.SE || summary.status() == SubmissionStatus.FAILED) {
            submission.errorMessage = summary.status().name();
        }
        submissionMapper.updateById(submission);
        if (submission.contestId == null) {
            userProblemStatusService.recordJudged(submission);
            updateProblemAcRate(submission.problemId);
            userScoreService.recompute(submission.userId);
        } else {
            updateContestRank(submission);
        }
        redisTemplate.delete(RedisKeys.judgePending(submission.userId, judgePendingProblemKey(submission), submission.contestId));
        judgeMessagePublisher.submissionChanged(submission.id, submission.status, submission.timeUsed, submission.memoryUsed);
    }

    private Long judgePendingProblemKey(Submission submission) {
        return submission.contestProblemId == null ? submission.problemId : submission.contestProblemId;
    }

    private void updateContestRank(Submission submission) {
        Contest contest = contestMapper.selectById(submission.contestId);
        if (contest == null) {
            return;
        }
        if ("ACM".equals(contest.type)) {
            contestAcmRankService.updateRankAfterJudge(submission);
        } else if ("OI".equals(contest.type)) {
            contestOiRankService.updateRankAfterJudge(submission);
        }
    }

    private JudgeProblemSpec judgeProblemSpec(Submission submission) {
        if (submission.contestProblemId != null) {
            ContestProblem contestProblem = contestProblemMapper.selectById(submission.contestProblemId);
            if (contestProblem == null) {
                return null;
            }
            return new JudgeProblemSpec(
                contestProblem.timeLimit == null ? 2000 : contestProblem.timeLimit,
                contestProblem.memoryLimit == null ? 256 : contestProblem.memoryLimit
            );
        }
        Problem problem = problemMapper.selectById(submission.problemId);
        if (problem == null) {
            return null;
        }
        return new JudgeProblemSpec(
            problem.timeLimit == null ? 2000 : problem.timeLimit,
            problem.memoryLimit == null ? 256 : problem.memoryLimit
        );
    }

    private List<ProblemTestCase> loadTestCases(Submission submission) {
        if (submission.contestProblemId != null) {
            return contestProblemTestCaseMapper.selectList(
                new QueryWrapper<ContestProblemTestCase>()
                    .eq("contest_problem_id", submission.contestProblemId)
                    .eq("sample", false)
                    .orderByAsc("case_no")
            ).stream().map(item -> {
                ProblemTestCase testCase = new ProblemTestCase();
                testCase.caseNo = item.caseNo;
                testCase.inputData = item.inputData;
                testCase.outputData = item.outputData;
                testCase.explanation = item.explanation;
                testCase.sample = item.sample;
                return testCase;
            }).toList();
        }
        return problemTestCaseMapper.selectList(
            new QueryWrapper<ProblemTestCase>()
                .eq("problem_id", submission.problemId)
                .eq("sample", false)
                .orderByAsc("case_no")
        );
    }

    public SandboxResult runCustom(String language, String code, String input, Integer timeLimit, Integer memoryLimit) {
        Problem fake = new Problem();
        fake.timeLimit = timeLimit == null ? 2000 : timeLimit;
        fake.memoryLimit = memoryLimit == null ? 256 : memoryLimit;
        Path workDir = null;
        try {
            workDir = Files.createTempDirectory("qoj-sandbox-");
            PreparedProgram program = prepare(workDir, language, code);
            if (program.compileStatus() != SubmissionStatus.AC) {
                return new SandboxResult("", program.compileOutput(), program.compileStatus().name(), 0, 0);
            }
            RunResult result = execute(program.runCommand(), workDir, input == null ? "" : input, fake.timeLimit, fake.memoryLimit);
            return new SandboxResult(result.stdout(), result.stderr(), result.status().name(), result.timeMs(), result.memoryKb());
        } catch (IOException ex) {
            return new SandboxResult("", ex.getMessage(), SubmissionStatus.RE.name(), 0, 0);
        } finally {
            deleteDir(workDir);
        }
    }

    private JudgeSummary runAll(Submission submission, JudgeProblemSpec spec, List<ProblemTestCase> testCases) {
        Path workDir = null;
        int maxTime = 0;
        int maxMemory = 0;
        SubmissionStatus total = SubmissionStatus.AC;
        try {
            workDir = Files.createTempDirectory("qoj-judge-");
            PreparedProgram program = prepare(workDir, submission.language, submission.code);
            if (program.compileStatus() != SubmissionStatus.AC) {
                insertCase(submission.id, 0, program.compileStatus(), 0, 0);
                return new JudgeSummary(program.compileStatus(), 0, 0);
            }
            for (ProblemTestCase testCase : testCases) {
                RunResult result = execute(
                    program.runCommand(),
                    workDir,
                    testCase.inputData,
                    spec.timeLimit(),
                    spec.memoryLimit()
                );
                SubmissionStatus status = result.status();
                if (status == SubmissionStatus.AC && !sameOutput(result.stdout(), testCase.outputData)) {
                    status = SubmissionStatus.WA;
                }
                insertCase(submission.id, testCase.caseNo, status, result.timeMs(), result.memoryKb());
                maxTime = Math.max(maxTime, result.timeMs());
                maxMemory = Math.max(maxMemory, result.memoryKb());
                if (status != SubmissionStatus.AC) {
                    total = status;
                    break;
                }
            }
        } catch (IOException ex) {
            total = SubmissionStatus.RE;
        } finally {
            deleteDir(workDir);
        }
        return new JudgeSummary(total, maxTime, maxMemory);
    }

    private PreparedProgram prepare(Path workDir, String language, String code) throws IOException {
        String normalized = language == null ? "" : language.toLowerCase(Locale.ROOT).replace("+", "p");
        if (normalized.contains("cpp") || normalized.contains("c++")) {
            Path source = workDir.resolve("main.cpp");
            Path binary = workDir.resolve("main");
            Files.writeString(source, code, StandardCharsets.UTF_8);
            ensureCppAllHeader(workDir);
            RunResult compile = runProcess(
                List.of("g++", "-std=c++17", "-O2", "-I", workDir.toString(), source.toString(), "-o", binary.toString()),
                workDir,
                "",
                10000
            );
            if (compile.exitCode() != 0) {
                return new PreparedProgram(SubmissionStatus.CE, compile.stderr(), List.of());
            }
            return new PreparedProgram(SubmissionStatus.AC, "", List.of(binary.toString()));
        }
        if (normalized.equals("c")) {
            Path source = workDir.resolve("main.c");
            Path binary = workDir.resolve("main");
            Files.writeString(source, code, StandardCharsets.UTF_8);
            RunResult compile = runProcess(List.of("gcc", "-std=c11", "-O2", source.toString(), "-o", binary.toString()), workDir, "", 10000);
            if (compile.exitCode() != 0) {
                return new PreparedProgram(SubmissionStatus.CE, compile.stderr(), List.of());
            }
            return new PreparedProgram(SubmissionStatus.AC, "", List.of(binary.toString()));
        }
        if (normalized.contains("python")) {
            Path source = workDir.resolve("main.py");
            Files.writeString(source, code, StandardCharsets.UTF_8);
            return new PreparedProgram(SubmissionStatus.AC, "", List.of("python3", source.toString()));
        }
        if (normalized.contains("java")) {
            Path source = workDir.resolve("Main.java");
            Files.writeString(source, code, StandardCharsets.UTF_8);
            RunResult compile = runProcess(List.of("javac", source.toString()), workDir, "", 10000);
            if (compile.exitCode() != 0) {
                return new PreparedProgram(SubmissionStatus.CE, compile.stderr(), List.of());
            }
            return new PreparedProgram(SubmissionStatus.AC, "", List.of("java", "-cp", workDir.toString(), "Main"));
        }
        return new PreparedProgram(SubmissionStatus.CE, "不支持的语言", List.of());
    }

    private void ensureCppAllHeader(Path workDir) throws IOException {
        Path bitsDir = workDir.resolve("bits");
        Files.createDirectories(bitsDir);
        Files.writeString(
            bitsDir.resolve("stdc++.h"),
            """
            #pragma once
            #include <algorithm>
            #include <array>
            #include <bitset>
            #include <cassert>
            #include <cctype>
            #include <cerrno>
            #include <cfenv>
            #include <cfloat>
            #include <chrono>
            #include <cinttypes>
            #include <climits>
            #include <cmath>
            #include <complex>
            #include <condition_variable>
            #include <csetjmp>
            #include <csignal>
            #include <cstdarg>
            #include <cstddef>
            #include <cstdint>
            #include <cstdio>
            #include <cstdlib>
            #include <cstring>
            #include <ctime>
            #include <deque>
            #include <exception>
            #include <fstream>
            #include <functional>
            #include <iomanip>
            #include <ios>
            #include <iosfwd>
            #include <iostream>
            #include <istream>
            #include <iterator>
            #include <limits>
            #include <list>
            #include <locale>
            #include <map>
            #include <memory>
            #include <mutex>
            #include <new>
            #include <numeric>
            #include <ostream>
            #include <queue>
            #include <random>
            #include <regex>
            #include <set>
            #include <sstream>
            #include <stack>
            #include <stdexcept>
            #include <streambuf>
            #include <string>
            #include <thread>
            #include <tuple>
            #include <type_traits>
            #include <typeinfo>
            #include <unordered_map>
            #include <unordered_set>
            #include <utility>
            #include <valarray>
            #include <vector>
            """,
            StandardCharsets.UTF_8
        );
    }

    private RunResult execute(List<String> command, Path workDir, String input, int timeLimitMs, int memoryLimitMb) {
        List<String> timedCommand = new ArrayList<>(timeCommandPrefix());
        timedCommand.addAll(command);
        RunResult result = runProcess(timedCommand, workDir, input, Math.max(100, timeLimitMs) + 500);
        int memoryKb = parseMemoryKb(result.stderr());
        SubmissionStatus status = result.status();
        if (status == SubmissionStatus.AC && result.timeMs() > timeLimitMs) {
            status = SubmissionStatus.TLE;
        }
        if (status == SubmissionStatus.AC && memoryKb > memoryLimitMb * 1024) {
            status = SubmissionStatus.MLE;
        }
        if (status == SubmissionStatus.AC && result.exitCode() != 0) {
            status = SubmissionStatus.RE;
        }
        return new RunResult(status, result.stdout(), result.stderr(), result.timeMs(), memoryKb, result.exitCode());
    }

    private RunResult runProcess(List<String> command, Path workDir, String input, int timeoutMs) {
        long start = System.nanoTime();
        try {
            Process process = new ProcessBuilder(command).directory(workDir.toFile()).start();
            CompletableFuture<byte[]> stdout = CompletableFuture.supplyAsync(() -> readAll(process.getInputStream()));
            CompletableFuture<byte[]> stderr = CompletableFuture.supplyAsync(() -> readAll(process.getErrorStream()));
            try {
                process.getOutputStream().write((input == null ? "" : input).getBytes(StandardCharsets.UTF_8));
            } catch (IOException ignored) {
                // The child process may exit before stdin is written, for example on compile/runtime startup errors.
            } finally {
                try {
                    process.getOutputStream().close();
                } catch (IOException ignored) {
                }
            }
            boolean finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
            int timeMs = (int) Duration.ofNanos(System.nanoTime() - start).toMillis();
            if (!finished) {
                process.destroyForcibly();
                return new RunResult(SubmissionStatus.TLE, "", "", timeMs, 0, -1);
            }
            String out = new String(stdout.join(), StandardCharsets.UTF_8);
            String err = new String(stderr.join(), StandardCharsets.UTF_8);
            return new RunResult(SubmissionStatus.AC, out, err, timeMs, parseMemoryKb(err), process.exitValue());
        } catch (Exception ex) {
            return new RunResult(SubmissionStatus.RE, "", ex.getMessage(), 0, 0, -1);
        }
    }

    private List<String> timeCommandPrefix() {
        String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        if (os.contains("mac") || os.contains("darwin")) {
            return List.of("/usr/bin/time", "-l");
        }
        return List.of("/usr/bin/time", "-v");
    }

    private byte[] readAll(java.io.InputStream stream) {
        try {
            return limitedRead(stream, 10_485_760);
        } catch (IOException ex) {
            return new byte[0];
        }
    }

    private byte[] limitedRead(java.io.InputStream stream, int maxBytes) throws IOException {
        byte[] buffer = new byte[maxBytes];
        int total = 0;
        int read;
        while (total < maxBytes && (read = stream.read(buffer, total, maxBytes - total)) != -1) {
            total += read;
        }
        byte[] result = new byte[total];
        System.arraycopy(buffer, 0, result, 0, total);
        return result;
    }

    private void insertCase(Long submissionId, Integer caseNo, SubmissionStatus status, Integer timeMs, Integer memoryKb) {
        SubmissionCaseResult caseResult = new SubmissionCaseResult();
        caseResult.submissionId = submissionId;
        caseResult.caseNo = caseNo;
        caseResult.status = status.name();
        caseResult.timeUsed = timeMs;
        caseResult.memoryUsed = memoryKb;
        caseResult.score = 0;
        caseResult.createdAt = java.time.LocalDateTime.now();
        submissionCaseResultMapper.insert(caseResult);
    }

    private boolean sameOutput(String actual, String expected) {
        return normalizeOutput(actual).equals(normalizeOutput(expected));
    }

    private String normalizeOutput(String value) {
        String normalized = value == null ? "" : value.replace("\r\n", "\n").replace('\r', '\n');
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

    private int parseMemoryKb(String stderr) {
        if (stderr == null) {
            return 0;
        }
        for (String line : stderr.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.endsWith("maximum resident set size")) {
                String number = trimmed.split("\\s+")[0];
                try {
                    long bytes = Long.parseLong(number);
                    return (int) Math.max(0, bytes / 1024);
                } catch (NumberFormatException ignored) {
                    return 0;
                }
            }
            if (trimmed.startsWith("Maximum resident set size")) {
                String[] parts = trimmed.split(":");
                if (parts.length >= 2) {
                    try {
                        return Math.max(0, Integer.parseInt(parts[1].trim()));
                    } catch (NumberFormatException ignored) {
                        return 0;
                    }
                }
            }
        }
        return 0;
    }

    private void updateProblemAcRate(Long problemId) {
        Long total = submissionMapper.countByProblemId(problemId);
        Long accepted = submissionMapper.countAcceptedByProblemId(problemId);
        Problem problem = problemMapper.selectById(problemId);
        if (problem == null) {
            return;
        }
        int rate = total == null || total == 0
            ? 0
            : (int) Math.round((accepted == null ? 0 : accepted) * 100.0 / total);
        problem.acRate = BigDecimal.valueOf(rate);
        problemMapper.updateById(problem);
        redisTemplate.delete(RedisKeys.problem(problemId));
    }

    private void deleteDir(Path path) {
        if (path == null) {
            return;
        }
        try (var stream = Files.walk(path)) {
            stream.sorted(Comparator.reverseOrder()).forEach(item -> {
                try {
                    Files.deleteIfExists(item);
                } catch (IOException ignored) {
                }
            });
        } catch (IOException ignored) {
        }
    }

    public record SandboxResult(String output, String error, String status, Integer timeMs, Integer memoryKb) {
    }

    private record PreparedProgram(SubmissionStatus compileStatus, String compileOutput, List<String> runCommand) {
    }

    private record JudgeProblemSpec(int timeLimit, int memoryLimit) {
    }

    private record RunResult(
        SubmissionStatus status,
        String stdout,
        String stderr,
        Integer timeMs,
        Integer memoryKb,
        int exitCode
    ) {
    }

    private record JudgeSummary(SubmissionStatus status, Integer maxTimeMs, Integer maxMemoryKb) {
    }
}
