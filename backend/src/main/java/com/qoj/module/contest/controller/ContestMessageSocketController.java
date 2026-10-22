package com.qoj.module.contest.controller;

import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.contest.dto.ContestMessageRequest;
import com.qoj.module.contest.service.ContestMessageService;
import com.qoj.module.contest.service.ContestMessageSocketPublisher;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.util.Map;
import com.qoj.security.AuthUser;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.teacher.mapper.TeacherMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
public class ContestMessageSocketController {
    public record SendRequest(@Positive long contestId, @NotNull @Pattern(regexp = "QUESTION|REPLY|BROADCAST") String kind,
        @NotNull @Valid ContestMessageRequest message) {}
    private final ContestMessageService service;
    private final ContestMessageSocketPublisher publisher;
    private final Validator validator;
    private final StringRedisTemplate redis;
    private final AdminUserMapper admins;
    private final UserMapper users;
    private final TeacherMapper teachers;

    public ContestMessageSocketController(ContestMessageService service, ContestMessageSocketPublisher publisher,
        Validator validator, StringRedisTemplate redis, AdminUserMapper admins, UserMapper users, TeacherMapper teachers) {
        this.service = service; this.publisher = publisher; this.validator = validator; this.redis = redis;
        this.admins = admins; this.users = users; this.teachers = teachers;
    }

    private AuthUser actor(SimpMessageHeaderAccessor headers) {
        Map<String, Object> attributes = headers.getSessionAttributes();
        if (attributes == null || !(attributes.get("authUser") instanceof AuthUser user)
            || !(attributes.get("accessExpiresAt") instanceof Number expiresAt)
            || expiresAt.longValue() <= System.currentTimeMillis()
            || Boolean.TRUE.equals(redis.hasKey(RedisKeys.tokenBlacklist((String) attributes.get("accessTokenId"))))) {
            throw new BizException(401, "登录已过期，请重新登录");
        }
        // Roles and account status can change while a long-lived socket remains connected.
        if (user.adminAccount()) {
            var account = admins.selectById(user.id());
            if (account != null) return new AuthUser(account);
        } else if (user.teacherAccount()) {
            var account = teachers.selectById(user.id());
            if (account != null && "ACTIVE".equals(account.status)) return new AuthUser(account);
        } else {
            var account = users.selectById(user.id());
            if (account != null && !account.banned()) return new AuthUser(account);
        }
        throw new BizException(401, "账号已失效，请重新登录");
    }

    @MessageMapping("/contest-messages/ready")
    public void ready(SimpMessageHeaderAccessor headers) {
        actor(headers);
        publisher.sendToSession(headers.getSessionId(), "/queue/contest-message-acks", Map.of("ready", true));
    }

    @MessageMapping("/contest-messages/send")
    public void send(SendRequest request, SimpMessageHeaderAccessor headers) {
        String requestId = request.message() == null || request.message().requestId() == null ? "" : request.message().requestId();
        try {
            AuthUser user = actor(headers);
            if (!validator.validate(request).isEmpty()) throw new BizException(400, "消息内容或参数不合法");
            var message = service.sendFromSocket(request.contestId(), request.message(), request.kind(), user,
                (String) headers.getSessionAttributes().get("clientIp"));
            publisher.sendToSession(headers.getSessionId(), "/queue/contest-message-acks",
                Map.of("requestId", requestId, "code", 200, "message", message));
        } catch (BizException error) {
            publisher.sendToSession(headers.getSessionId(), "/queue/contest-message-acks",
                Map.of("requestId", requestId, "code", error.getCode(), "error", error.getMessage()));
        } catch (Exception error) {
            publisher.sendToSession(headers.getSessionId(), "/queue/contest-message-acks",
                Map.of("requestId", requestId, "code", 500, "error", "消息发送失败，请重试"));
        }
    }
}
