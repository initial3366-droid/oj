package com.qoj.common;

/**
 * 统一业务错误码枚举。
 *
 * 编码规则：
 * - 200：成功
 * - 4xxxx：客户端错误（参数/权限/资源问题），映射到 4xx HTTP 状态
 * - 5xxxx：服务端错误（判题异常/系统故障），映射到 5xx HTTP 状态
 *
 * 所有异常通过 GlobalExceptionHandler 自动转换为 ApiResponse JSON。
 */
public enum ErrorCode {
    SUCCESS(200, "成功"),
    BAD_REQUEST(40000, "请求参数错误"),
    UNAUTHORIZED(40001, "未登录或登录已过期"),
    FORBIDDEN(40003, "无权限"),
    NOT_FOUND(40004, "资源不存在"),
    CONFLICT(40009, "资源冲突"),
    TOO_MANY_REQUESTS(42900, "请求过于频繁"),
    INTERNAL_ERROR(50000, "系统错误"),
    JUDGE_ERROR(50001, "判题服务异常"),
    NOT_IMPLEMENTED(50100, "功能尚未实现");

    private final int code;
    private final String message;

    /**
     * 构造 Error编码 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }

    /**
     * 读取编码并返回给调用方。直接返回当前实例保存的编码，不产生额外的数据写入。
     */
    public int getCode() {
        return code;
    }

    /**
     * 读取消息并返回给调用方。直接返回当前实例保存的消息，不产生额外的数据写入。
     */
    public String getMessage() {
        return message;
    }
}
