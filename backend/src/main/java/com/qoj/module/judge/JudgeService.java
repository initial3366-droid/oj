package com.qoj.module.judge;

/**
 * 判题服务抽象接口
 */
public interface JudgeService {
    /**
     * 判题
     * @param task 判题任务
     * @return 判题结果
     */
    JudgeResult judge(JudgeTask task);

    /**
     * 运行自定义代码（沙箱）
     * @param language 语言
     * @param code 代码
     * @param input 输入
     * @param timeLimit 时间限制 (ms)
     * @param memoryLimit 内存限制 (MB)
     * @return 运行结果
     */
    SandboxResult runCustom(String language, String code, String input, Integer timeLimit, Integer memoryLimit);

    /**
     * 沙箱运行结果
     */
    record SandboxResult(
        String output,
        String error,
        String status,
        Integer timeMs,
        Integer memoryKb
    ) {}
}
