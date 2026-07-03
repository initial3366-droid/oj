package com.qoj.common.exception;

import com.qoj.common.ApiResponse;
import com.qoj.common.ErrorCode;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局异常处理器，拦截 Controller 层所有异常并统一转换为 ApiResponse JSON。
 *
 * 设计原则:
 * - 每类异常独立 @ExceptionHandler，返回对应 HTTP 状态码
 * - 兜底 catch-all 不泄露内部异常详情（安全）
 * - 数据完整性异常用 WARN（客户端错误），未知异常用 ERROR（服务端故障）
 */
@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BizException.class)
    public ResponseEntity<ApiResponse<Void>> handleBizException(BizException ex) {
        return ResponseEntity
            .status(httpStatus(ex.getCode()))
            .body(ApiResponse.fail(ex.getCode(), ex.getMessage()));
    }

    @ExceptionHandler({
        MethodArgumentNotValidException.class,
        ConstraintViolationException.class,
        BindException.class
    })
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidationException(Exception ex) {
        String message = "请求参数错误";
        if (ex instanceof MethodArgumentNotValidException validEx) {
            message = validEx.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getDefaultMessage())
                .findFirst()
                .orElse("请求参数错误");
        } else if (ex instanceof BindException bindEx) {
            message = bindEx.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getDefaultMessage())
                .findFirst()
                .orElse("请求参数错误");
        } else if (ex instanceof ConstraintViolationException constraintEx) {
            message = constraintEx.getConstraintViolations().stream()
                .map(violation -> violation.getMessage())
                .findFirst()
                .orElse("请求参数错误");
        }
        return ApiResponse.fail(ErrorCode.BAD_REQUEST.getCode(), message);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleUnreadableRequest() {
        return ApiResponse.fail(ErrorCode.BAD_REQUEST.getCode(), "请求数据格式错误");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        log.warn("Invalid data rejected by database constraints", ex);
        return ApiResponse.fail(ErrorCode.BAD_REQUEST.getCode(), "数据不合法，请检查编号是否重复、必填内容是否为空或内容是否过长");
    }

    @ExceptionHandler({BadCredentialsException.class})
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiResponse<Void> handleBadCredentialsException() {
        return ApiResponse.fail(ErrorCode.UNAUTHORIZED, "账号或密码错误");
    }

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> handleAccessDeniedException() {
        return ApiResponse.fail(ErrorCode.FORBIDDEN);
    }

    @ExceptionHandler({NoHandlerFoundException.class, NoResourceFoundException.class})
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> handleNotFoundException() {
        return ApiResponse.fail(ErrorCode.NOT_FOUND);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleException(Exception ex) {
        log.error("Unhandled application exception", ex);
        return ApiResponse.fail(ErrorCode.INTERNAL_ERROR);
    }

    private HttpStatus httpStatus(int code) {
        return switch (code) {
            case 400, 40000 -> HttpStatus.BAD_REQUEST;
            case 401, 40001 -> HttpStatus.UNAUTHORIZED;
            case 403, 40003 -> HttpStatus.FORBIDDEN;
            case 404, 40004 -> HttpStatus.NOT_FOUND;
            case 409, 40009 -> HttpStatus.CONFLICT;
            case 429, 42900 -> HttpStatus.TOO_MANY_REQUESTS;
            case 502 -> HttpStatus.BAD_GATEWAY;
            case 503 -> HttpStatus.SERVICE_UNAVAILABLE;
            case 501, 50100 -> HttpStatus.NOT_IMPLEMENTED;
            default -> code >= 500 ? HttpStatus.INTERNAL_SERVER_ERROR : HttpStatus.BAD_REQUEST;
        };
    }
}
