package com.qoj.module.judge.gojudge;

import com.qoj.common.enums.SubmissionStatus;
import com.qoj.config.QojProperties;
import com.qoj.module.judge.JudgeCaseResult;
import com.qoj.module.judge.JudgeResult;
import com.qoj.module.judge.JudgeTask;
import com.qoj.module.judge.gojudge.GoJudgeClient.Command;
import com.qoj.module.judge.gojudge.GoJudgeClient.CommandFile;
import com.qoj.module.judge.gojudge.GoJudgeClient.Result;
import com.qoj.module.judge.gojudge.GoJudgeClient.RunRequest;
import com.qoj.module.judge.gojudge.GoJudgeService.CompiledProgram;
import com.qoj.module.judge.gojudge.GoJudgeService.Language;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Sequential two-pass communication. No contestant-created file crosses a sandbox boundary. */
final class CommunicationJudge {
    private static final Logger log = LoggerFactory.getLogger(CommunicationJudge.class);
    private final GoJudgeService executor;
    private final GoJudgeClient client;
    private final QojProperties.GoJudge limits;
    private final List<String> cached = new ArrayList<>();

    CommunicationJudge(GoJudgeService executor, GoJudgeClient client, QojProperties.GoJudge limits) {
        this.executor = executor;
        this.client = client;
        this.limits = limits;
    }

    JudgeResult judge(JudgeTask task) {
        List<JudgeCaseResult> cases = new ArrayList<>();
        try {
            var config = task.communication().validated();
            if (config == null || config.maxMessageBytes() >= limits.getMaxOutputBytes()) {
                return JudgeResult.systemError("通信消息上限必须小于判题器全局输出上限");
            }
            var language = Language.from(task.language());
            var program = compile(executor.compile(language, task.code()));
            if (program.status() != SubmissionStatus.AC) {
                return program.status() == SubmissionStatus.CE ? JudgeResult.compileError(program.message())
                    : JudgeResult.systemError("选手编译环境故障");
            }
            var channel = compile(executor.compileChecker(config.channelSource()));
            var checker = compile(executor.compileChecker(config.checkerSource()));
            if (channel.status() != SubmissionStatus.AC || checker.status() != SubmissionStatus.AC) {
                log.warn("Communication jury compilation failed for submission {}: channel={}, checker={}",
                    task.submissionId(), bounded(channel.message()), bounded(checker.message()));
                return JudgeResult.systemError("通信裁判编译失败，请管理员检查信道程序和最终检查器");
            }
            SubmissionStatus overall = SubmissionStatus.AC;
            int maxTime = 0, maxMemory = 0;
            for (var test : task.testCases()) {
                if (bytes(test.input()) + 7L > limits.getMaxInputBytes() || bytes(test.publicInput()) > limits.getMaxInputBytes()
                    || bytes(test.expectedOutput()) > limits.getMaxOutputBytes()) {
                    return JudgeResult.systemError("通信题测试点超过平台输入输出安全上限");
                }
                int cacheStart = cached.size();
                JudgeCaseResult result;
                try { result = runCase(task, test, language, program.fileId(), channel.fileId(), checker.fileId()); }
                finally {
                    // A large test set must not accumulate messages in go-judge's file store.
                    while (cached.size() > cacheStart) client.deleteFile(cached.remove(cached.size() - 1));
                }
                cases.add(result);
                maxTime = Math.max(maxTime, result.timeMs());
                maxMemory = Math.max(maxMemory, result.memoryKb());
                if (overall == SubmissionStatus.AC && result.status() != SubmissionStatus.AC) overall = result.status();
                if (result.status() == SubmissionStatus.SE) break;
            }
            return new JudgeResult(overall, overall == SubmissionStatus.SE ? "通信裁判执行失败，请管理员检查" : "",
                maxTime, maxMemory, cases);
        } catch (JudgeExecutionBudget.Exceeded e) {
            return JudgeExecutionBudget.exceeded(task, cases);
        } catch (java.util.concurrent.CancellationException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Communication execution failed for submission {}: {}", task.submissionId(), e.toString());
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            return JudgeResult.systemError("通信题判题服务异常，请管理员检查");
        } finally {
            cached.forEach(client::deleteFile);
        }
    }

    private CompiledProgram compile(CompiledProgram program) {
        if (program.fileId() != null) cached.add(program.fileId());
        return program;
    }

    private JudgeCaseResult runCase(JudgeTask task, JudgeTask.TestCase test, Language language,
                                    String program, String channel, String checker) throws Exception {
        var config = task.communication();
        Result sender = run(executor.runCommand(language, program, "ENCODE\n" + text(test.input()), task.timeLimit(), task.memoryLimit()));
        byte[] message = readStdout(sender, config.maxMessageBytes());
        if (message.length > config.maxMessageBytes()) {
            return result(test, SubmissionStatus.WA, sender, null, "发送阶段：通信消息超过 " + config.maxMessageBytes() + " 字节", config.maxMessageBytes() + 1);
        }
        var senderExecution = executor.mapRunResult(sender);
        if (senderExecution.status() != SubmissionStatus.AC) return result(test, senderExecution.status(), sender, null, "发送阶段：" + senderExecution.status(), message.length);
        if (message.length == 0 && !config.allowEmptyMessage()) return result(test, SubmissionStatus.WA, sender, null, "发送阶段：不允许空消息", 0);
        String decoded;
        try { decoded = utf8(message); }
        catch (CharacterCodingException e) { return result(test, SubmissionStatus.WA, sender, null, "发送阶段：消息不是合法 UTF-8 文本", message.length); }
        Map<String, CommandFile> channelFiles = new LinkedHashMap<>();
        channelFiles.put("checker", CommandFile.cached(channel));
        channelFiles.put("input.txt", CommandFile.content(test.input()));
        channelFiles.put("sender.out", CommandFile.content(decoded));
        channelFiles.put("answer.txt", CommandFile.content(test.expectedOutput()));
        channelFiles.put("public2.txt", CommandFile.content(test.publicInput()));
        Result transformed = run(jury(List.of("./checker", "input.txt", "sender.out", "answer.txt", "public2.txt"), channelFiles));
        SubmissionStatus channelStatus = verdict(transformed);
        if (channelStatus != SubmissionStatus.AC) {
            diagnostic(task, test, "channel", transformed);
            return result(test, channelStatus, sender, null, channelStatus == SubmissionStatus.WA
                ? "信道校验：消息格式或通信规则不合法" : "信道程序执行失败，请管理员检查", message.length);
        }
        byte[] receiverInput = readStdout(transformed, limits.getMaxInputBytes());
        if (receiverInput.length > limits.getMaxInputBytes()) return result(test, SubmissionStatus.SE, sender, null, "信道程序生成的接收方输入过大", message.length);
        String input;
        try { input = utf8(receiverInput); }
        catch (CharacterCodingException e) { return result(test, SubmissionStatus.SE, sender, null, "信道程序未生成合法 UTF-8 输入", message.length); }
        if (!input.startsWith("DECODE\n") && !input.startsWith("DECODE\r\n")) {
            return result(test, SubmissionStatus.SE, sender, null, "信道程序必须生成以 DECODE 换行开头的接收方输入", message.length);
        }
        Result receiver = run(executor.runCommand(language, program, input, task.timeLimit(), task.memoryLimit()));
        var receiverExecution = executor.mapRunResult(receiver);
        if (receiverExecution.status() != SubmissionStatus.AC) return result(test, receiverExecution.status(), sender, receiver, "接收阶段：" + receiverExecution.status(), message.length);
        byte[] answer = readStdout(receiver, limits.getMaxOutputBytes());
        if (answer.length > limits.getMaxOutputBytes()) return result(test, SubmissionStatus.RE, sender, receiver, "接收阶段：输出超过平台安全上限", message.length);
        Map<String, CommandFile> checkerFiles = new LinkedHashMap<>();
        checkerFiles.put("checker", CommandFile.cached(checker));
        checkerFiles.put("input.txt", CommandFile.content(test.input()));
        String finalAnswer;
        try { finalAnswer = utf8(answer); }
        catch (CharacterCodingException e) { return result(test, SubmissionStatus.WA, sender, receiver, "接收阶段：答案不是合法 UTF-8 文本", message.length); }
        checkerFiles.put("receiver.out", CommandFile.content(finalAnswer));
        checkerFiles.put("answer.txt", CommandFile.content(test.expectedOutput()));
        Result checked = run(jury(List.of("./checker", "input.txt", "receiver.out", "answer.txt"), checkerFiles));
        SubmissionStatus status = verdict(checked);
        if (status != SubmissionStatus.AC) diagnostic(task, test, "checker", checked);
        return result(test, status, sender, receiver, status == SubmissionStatus.AC ? "通信题通过"
            : status == SubmissionStatus.WA ? "接收阶段：最终答案错误" : "最终检查器执行失败，请管理员检查", message.length);
    }

    private Command jury(List<String> args, Map<String, CommandFile> files) {
        return executor.command(args, List.of(CommandFile.content(""), CommandFile.collector("stdout", limits.getMaxOutputBytes()),
            CommandFile.collector("stderr", limits.getMaxOutputBytes())), 5_000_000_000L, 15_000_000_000L,
            256L * 1024 * 1024, files, List.of());
    }

    private Result run(Command original) {
        if (Thread.currentThread().isInterrupted()) throw new IllegalStateException("通信任务已中断");
        // Keep stdout as raw bytes; every /run creates a fresh sandbox and only copies declared files.
        Command command = new Command(original.args(), original.env(), original.files(), original.cpuLimit(), original.clockLimit(),
            original.memoryLimit(), original.stackLimit(), original.procLimit(), original.copyIn(), List.of("stderr"),
            List.of("stdout"), original.copyOutMax(), false, original.strictMemoryLimit());
        List<Result> results = client.run(new RunRequest(List.of(command)), Duration.ofMillis(
            Math.max(limits.getRequestTimeoutMs(), original.clockLimit() / 1_000_000L + 10_000L)));
        if (results.size() != 1 || results.get(0) == null) throw new IllegalStateException("通信判题响应格式错误");
        Result result = results.get(0);
        if (result.fileIds() != null) result.fileIds().values().forEach(cached::add);
        return result;
    }

    private byte[] readStdout(Result result, int max) {
        String id = result.fileIds() == null ? null : result.fileIds().get("stdout");
        if (id == null) {
            if (!"Accepted".equals(result.status())) return new byte[0];
            throw new IllegalStateException("通信判题未返回 stdout 文件");
        }
        return client.readFile(id, max);
    }

    private SubmissionStatus verdict(Result result) {
        if ("Accepted".equals(result.status()) && result.exitStatus() == 0) return SubmissionStatus.AC;
        if ("Nonzero Exit Status".equals(result.status()) && (result.exitStatus() == 1 || result.exitStatus() == 2)) return SubmissionStatus.WA;
        return SubmissionStatus.SE;
    }

    private JudgeCaseResult result(JudgeTask.TestCase test, SubmissionStatus status, Result sender, Result receiver, String message, int size) {
        int sendTime = millis(sender.time()), sendMemory = kb(sender.memory());
        int receiveTime = receiver == null ? 0 : millis(receiver.time()), receiveMemory = receiver == null ? 0 : kb(receiver.memory());
        String stats = message + "；消息 " + size + " 字节；发送 " + sendTime + "ms / " + sendMemory
            + "KB；接收 " + (receiver == null ? "未运行" : receiveTime + "ms / " + receiveMemory + "KB");
        // Hidden inputs, messages, generated input and jury stderr must not enter contestant previews.
        return new JudgeCaseResult(test.caseNo(), status, Math.max(sendTime, receiveTime), Math.max(sendMemory, receiveMemory), "", "", "", stats);
    }

    private void diagnostic(JudgeTask task, JudgeTask.TestCase test, String stage, Result result) {
        String stderr = result.files() == null ? "" : result.files().getOrDefault("stderr", "");
        log.warn("Communication jury diagnostic submission={} case={} stage={} status={} exit={} stderr={}",
            task.submissionId(), test.caseNo(), stage, result.status(), result.exitStatus(), stderr.substring(0, Math.min(stderr.length(), 4096)));
    }

    private static String bounded(String text) { return text == null ? "" : text.substring(0, Math.min(text.length(), 4096)); }

    private static String utf8(byte[] value) throws CharacterCodingException {
        return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(value)).toString();
    }
    private static int bytes(String value) { return text(value).getBytes(StandardCharsets.UTF_8).length; }
    private static String text(String value) { return value == null ? "" : value; }
    private static int millis(long value) { return (int) Math.min(Integer.MAX_VALUE, Math.max(0, value / 1_000_000L)); }
    private static int kb(long value) { return (int) Math.min(Integer.MAX_VALUE, Math.max(0, value / 1024L)); }
}
