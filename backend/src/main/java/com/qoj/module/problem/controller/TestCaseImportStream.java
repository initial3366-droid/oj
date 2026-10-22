package com.qoj.module.problem.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.ApiResponse;
import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.problem.dto.TestCaseImportProgress;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** 同步导入期间发送逐行 JSON；最终结果在服务返回、事务提交之后发送。 */
final class TestCaseImportStream {
    private static final Logger log = LoggerFactory.getLogger(TestCaseImportStream.class);

    private TestCaseImportStream() {}

    static <T> void run(HttpServletResponse response, ObjectMapper mapper,
                        Function<Consumer<TestCaseImportProgress>, T> action) {
        response.setContentType("application/x-ndjson");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("X-Accel-Buffering", "no");
        response.setHeader("Cache-Control", "no-store");
        boolean[] disconnected = {false};
        Consumer<Object> send = event -> {
            if (disconnected[0]) return;
            try {
                response.getWriter().write(mapper.writeValueAsString(event) + "\n");
                response.flushBuffer();
            } catch (IOException ex) {
                // 浏览器超时或离开页面后，保留原导入事务的行为。
                disconnected[0] = true;
            }
        };
        try {
            T result = action.apply(progress -> send.accept(Map.of("type", "progress", "data", progress)));
            send.accept(Map.of("type", "result", "data", ApiResponse.ok(result)));
        } catch (BizException ex) {
            send.accept(Map.of("type", "result", "data", ApiResponse.fail(ex.getCode(), ex.getMessage())));
        } catch (Exception ex) {
            log.error("测试点 ZIP 导入失败", ex);
            send.accept(Map.of("type", "result", "data", ApiResponse.fail(ErrorCode.INTERNAL_ERROR)));
        }
    }
}
