package com.qoj.common.exception;

import com.qoj.common.ErrorCode;

/**
 * Biz异常类型。携带可对外识别的错误语义，用于中断当前业务流程并交由统一异常处理器转换。
 */
public class BizException extends RuntimeException {

    private final int code;

    /**
     * 构造 BizException 实例并保存其必要依赖或初始状态。不满足业务约束时直接抛出明确异常。
     */
    public BizException(int code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * 构造 BizException 实例并保存其必要依赖或初始状态。不满足业务约束时直接抛出明确异常。
     */
    public BizException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.code = errorCode.getCode();
    }

    /**
     * 构造 BizException 实例并保存其必要依赖或初始状态。不满足业务约束时直接抛出明确异常。
     */
    public BizException(ErrorCode errorCode, String message) {
        super(message);
        this.code = errorCode.getCode();
    }

    /**
     * 读取编码并返回给调用方。直接返回当前实例保存的编码，不产生额外的数据写入。
     */
    public int getCode() {
        return code;
    }
}
