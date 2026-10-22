package com.qoj.module.judge.gojudge;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.config.QojProperties;
import java.io.InputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

/**
 * Minimal authenticated client for criyle/go-judge's REST API.
 *
 * <p>The client never retries {@code /run}: repeating an execution request can
 * consume resources twice and makes queue accounting ambiguous. The endpoint is
 * fixed by deployment configuration and cannot be supplied by an HTTP caller.
 */
@Component
public class GoJudgeClient {
    private static final Pattern SAFE_FILE_ID = Pattern.compile("[A-Za-z0-9_-]{1,128}");
    private static final int ERROR_BODY_LIMIT = 4096;
    private static final int RESPONSE_OVERHEAD_BYTES = 1024 * 1024;
    private static final ScheduledExecutorService BODY_TIMEOUTS = Executors.newSingleThreadScheduledExecutor(task -> {
        Thread thread = new Thread(task, "go-judge-body-deadline");
        thread.setDaemon(true);
        return thread;
    });

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final URI baseUri;
    private final String authToken;
    private final int responseLimitBytes;

    /**
     * 构造 Go判题Client 实例并保存其必要依赖或初始状态。从持久化层读取数据；可能调用外部判题或网关服务。
     */
    public GoJudgeClient(ObjectMapper objectMapper, QojProperties properties) {
        QojProperties.GoJudge config = properties.getGoJudge();
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(config.getConnectTimeoutMs()))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
        String normalized = config.getBaseUrl().trim().replaceAll("/+$", "") + "/";
        this.baseUri = URI.create(normalized);
        this.authToken = config.getAuthToken() == null ? "" : config.getAuthToken();
        // Each request contains one command. Bound stdout, stderr and JSON overhead
        // so a compromised worker cannot make the application allocate an unbounded body.
        this.responseLimitBytes = Math.toIntExact(
            Math.addExact(Math.multiplyExact((long) config.getMaxOutputBytes(), 2L), RESPONSE_OVERHEAD_BYTES)
        );
    }

    /**
     * 封装run相关逻辑。从持久化层读取数据；可能调用外部判题或网关服务。
     */
    public List<Result> run(RunRequest request, Duration timeout) {
        Duration remaining = JudgeExecutionBudget.remaining(timeout);
        long requestDeadline = System.nanoTime() + remaining.toNanos();
        long clock = remaining.toNanos();
        request = new RunRequest(request.cmd().stream().map(command -> new Command(
            command.args(), command.env(), command.files(), Math.min(command.cpuLimit(), clock),
            Math.min(command.clockLimit(), clock), command.memoryLimit(), command.stackLimit(),
            command.procLimit(), command.copyIn(), command.copyOut(), command.copyOutCached(),
            command.copyOutMax(), command.copyOutTruncate(), command.strictMemoryLimit())).toList());
        try {
            byte[] payload = objectMapper.writeValueAsBytes(request);
            HttpRequest.Builder builder = HttpRequest.newBuilder(baseUri.resolve("run"))
                .timeout(remaining)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(payload));
            addAuthorization(builder);

            HttpResponse<InputStream> response = httpClient.send(
                builder.build(), HttpResponse.BodyHandlers.ofInputStream());
            byte[] body;
            try (InputStream stream = response.body()) {
                body = readBounded(stream, responseLimitBytes, requestDeadline);
            }
            if (body.length > responseLimitBytes) {
                /**
                 * 构造 Go判题ClientException 实例并保存其必要依赖或初始状态。可能调用外部判题或网关服务。
                 */
                throw new GoJudgeClientException("go-judge 响应超过安全上限");
            }
            if (response.statusCode() != 200) {
                String message = new String(body, 0, Math.min(body.length, ERROR_BODY_LIMIT), StandardCharsets.UTF_8);
                /**
                 * 构造 Go判题ClientException 实例并保存其必要依赖或初始状态。可能调用外部判题或网关服务。
                 */
                throw new GoJudgeClientException(
                    "go-judge 返回 HTTP " + response.statusCode() + sanitize(message));
            }
            List<Result> results = objectMapper.readValue(body, new TypeReference<List<Result>>() {});
            if (results == null) {
                /**
                 * 构造 Go判题ClientException 实例并保存其必要依赖或初始状态。可能调用外部判题或网关服务。
                 */
                throw new GoJudgeClientException("go-judge 返回空响应");
            }
            return results;
        } catch (GoJudgeClientException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            /**
             * 构造 Go判题ClientException 实例并保存其必要依赖或初始状态。可能调用外部判题或网关服务。
             */
            throw new GoJudgeClientException("go-judge 请求被中断", ex);
        } catch (Exception ex) {
            JudgeExecutionBudget.remaining(timeout);
            /**
             * 构造 Go判题ClientException 实例并保存其必要依赖或初始状态。可能调用外部判题或网关服务。
             */
            throw new GoJudgeClientException("go-judge 请求失败", ex);
        }
    }

    /** Read at most limit + 1 raw bytes, so UTF-8 replacement cannot bypass a message budget. */
    public byte[] readFile(String fileId, int limit) {
        if (fileId == null || !SAFE_FILE_ID.matcher(fileId).matches() || limit < 0 || limit > 64 * 1024 * 1024) {
            throw new GoJudgeClientException("无效的判题文件读取请求");
        }
        Duration remaining = JudgeExecutionBudget.remaining(Duration.ofSeconds(15));
        long requestDeadline = System.nanoTime() + remaining.toNanos();
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(baseUri.resolve("file/" + fileId))
                .timeout(remaining).GET();
            addAuthorization(builder);
            HttpResponse<InputStream> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream stream = response.body()) {
                if (response.statusCode() != 200) throw new GoJudgeClientException("无法读取判题缓存文件");
                return readBounded(stream, limit, requestDeadline);
            }
        } catch (GoJudgeClientException e) { throw e; }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new GoJudgeClientException("判题文件读取中断", e); }
        catch (Exception e) {
            JudgeExecutionBudget.remaining(Duration.ofSeconds(15));
            throw new GoJudgeClientException("判题文件读取失败", e);
        }
    }

    private byte[] readBounded(InputStream stream, int limit, long deadline) throws IOException {
        long nanos = deadline - System.nanoTime();
        if (nanos <= 0) throw new IOException("go-judge body deadline exceeded");
        var cancellation = BODY_TIMEOUTS.schedule(() -> {
            try { stream.close(); } catch (IOException ignored) { }
        }, nanos, TimeUnit.NANOSECONDS);
        try {
            byte[] bytes = stream.readNBytes(limit + 1);
            if (System.nanoTime() >= deadline) throw new IOException("go-judge body deadline exceeded");
            return bytes;
        } finally {
            cancellation.cancel(false);
        }
    }

    /** Delete cached compiler artifacts as soon as a submission completes. */
    public void deleteFile(String fileId) {
        if (fileId == null || !SAFE_FILE_ID.matcher(fileId).matches()) {
            return;
        }
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(baseUri.resolve("file/" + fileId))
                .timeout(Duration.ofSeconds(5))
                .DELETE();
            addAuthorization(builder);
            httpClient.send(builder.build(), HttpResponse.BodyHandlers.discarding());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        } catch (Exception ignored) {
            // File TTL remains a bounded fallback if immediate cleanup is unavailable.
        }
    }

    /**
     * 创建或提交Authorization。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private void addAuthorization(HttpRequest.Builder builder) {
        if (!authToken.isBlank()) {
            builder.header("Authorization", "Bearer " + authToken);
        }
    }

    /**
     * 封装sanitize相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private String sanitize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return ": " + value.replaceAll("[\\r\\n\\t]+", " ").trim();
    }

    /**
     * Run请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RunRequest(List<Command> cmd) {
    }

    /**
     * Command不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Command(
        List<String> args,
        List<String> env,
        List<CommandFile> files,
        long cpuLimit,
        long clockLimit,
        long memoryLimit,
        long stackLimit,
        long procLimit,
        Map<String, CommandFile> copyIn,
        List<String> copyOut,
        List<String> copyOutCached,
        long copyOutMax,
        boolean copyOutTruncate,
        boolean strictMemoryLimit
    ) {
    }

    /**
     * CommandFile不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CommandFile(
        String content,
        String fileId,
        String name,
        Long max
    ) {
        /**
         * 封装content相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        public static CommandFile content(String value) {
            /**
             * 构造 CommandFile 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new CommandFile(value == null ? "" : value, null, null, null);
        }

        /**
         * 封装cached相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        public static CommandFile cached(String fileId) {
            /**
             * 构造 CommandFile 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new CommandFile(null, fileId, null, null);
        }

        /**
         * 封装collector相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        public static CommandFile collector(String name, long max) {
            /**
             * 构造 CommandFile 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new CommandFile(null, null, name, max);
        }
    }

    /**
     * 结果不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Result(
        String status,
        int exitStatus,
        String error,
        long time,
        long memory,
        long runTime,
        Map<String, String> files,
        Map<String, String> fileIds
    ) {
    }

    /**
     * Go判题Client异常类型。携带可对外识别的错误语义，用于中断当前业务流程并交由统一异常处理器转换。
     */
    public static class GoJudgeClientException extends RuntimeException {
        /**
         * 构造 Go判题ClientException 实例并保存其必要依赖或初始状态。可能调用外部判题或网关服务。
         */
        public GoJudgeClientException(String message) {
            super(message);
        }

        /**
         * 构造 Go判题ClientException 实例并保存其必要依赖或初始状态。可能调用外部判题或网关服务。
         */
        public GoJudgeClientException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
