package com.qoj.common;

/**
 * 统一 API 响应包装类（Java Record，不可变）。
 *
 * 所有接口返回的 JSON 格式均为：
 * { "code": int, "message": string, "data": T | null }
 *
 * 使用方式：
 * - 成功：ApiResponse.ok(data) 或 ApiResponse.ok()（无数据时）
 * - 失败：ApiResponse.fail(code, message) 或 ApiResponse.fail(ErrorCode)
 *
 * 注意：code 是业务错误码（如 40001），不是 HTTP 状态码。
 *       HTTP 状态码由 @ResponseStatus 或 GlobalExceptionHandler 单独设置。
 */
public record ApiResponse<T>(int code, String message, T data) {

    /** 成功响应，携带数据 */
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(), ErrorCode.SUCCESS.getMessage(), data);
    }

    /**
     * 成功响应（无返回数据，如 DELETE / 更新操作）。
     * 使用 Void 而非 Object，Jackson 序列化 data 为 null。
     */
    public static ApiResponse<Void> ok() {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(), ErrorCode.SUCCESS.getMessage(), null);
    }

    /** 失败响应，自定义错误码和信息 */
    public static <T> ApiResponse<T> fail(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }

    /** 失败响应，使用 ErrorCode 枚举中预设的 code 和 message */
    public static <T> ApiResponse<T> fail(ErrorCode errorCode) {
        return new ApiResponse<>(errorCode.getCode(), errorCode.getMessage(), null);
    }

    /**
     * 失败响应，使用 ErrorCode 的 code 但覆盖 message。
     * 典型用途：返回标准错误码（如 40000 BAD_REQUEST），但携带字段级校验信息。
     */
    public static <T> ApiResponse<T> fail(ErrorCode errorCode, String message) {
        return new ApiResponse<>(errorCode.getCode(), message, null);
    }
}
