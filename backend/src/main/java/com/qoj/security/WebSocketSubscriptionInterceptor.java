package com.qoj.security;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestParticipant;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestParticipantMapper;
import com.qoj.module.contest.service.ContestIpAccessService;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * WebSocket 订阅拦截器
 * 验证用户是否有权限订阅特定频道
 */
@Component
public class WebSocketSubscriptionInterceptor implements ChannelInterceptor {
    private final ContestMapper contestMapper;
    private final ContestParticipantMapper participantMapper;
    private final SubmissionMapper submissionMapper;
    private final ContestIpAccessService contestIpAccessService;
    private final UserSocketSessions userSocketSessions;

    // 频道模式
    private static final Pattern CONTEST_SCOREBOARD_PATTERN = Pattern.compile("^/topic/contests/(\\d+)/scoreboard$");
    private static final Pattern CONTEST_ANNOUNCEMENT_PATTERN = Pattern.compile("^/topic/contests/(\\d+)/announcements$");
    private static final Pattern CONTEST_STATUS_PATTERN = Pattern.compile("^/topic/contests/(\\d+)/status$");
    private static final Pattern SUBMISSION_PATTERN = Pattern.compile("^/topic/submissions/(\\d+)$");
    private static final Pattern SUBMISSION_QUEUE_PATTERN = Pattern.compile("^/topic/submission-queue$");

    /**
     * 构造 WebSocketSubscriptionInterceptor 实例并保存其必要依赖或初始状态。从持久化层读取数据；在状态变化后发布异步消息。
     */
    public WebSocketSubscriptionInterceptor(
        ContestMapper contestMapper,
        ContestParticipantMapper participantMapper,
        SubmissionMapper submissionMapper,
        ContestIpAccessService contestIpAccessService,
        UserSocketSessions userSocketSessions
    ) {
        this.contestMapper = contestMapper;
        this.participantMapper = participantMapper;
        this.submissionMapper = submissionMapper;
        this.contestIpAccessService = contestIpAccessService;
        this.userSocketSessions = userSocketSessions;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.SEND.equals(accessor.getCommand())) {
            Map<String, Object> attributes = accessor.getSessionAttributes();
            boolean authenticated = accessor.getUser() != null && attributes != null
                && attributes.get("authUser") instanceof AuthUser;
            String destination = accessor.getDestination();
            // Broker destinations are server-only, regardless of the client's role.
            // Keep this allowlist aligned with the explicit @MessageMapping handlers.
            boolean applicationDestination = "/app/contest-messages/send".equals(destination)
                || "/app/contest-messages/ready".equals(destination);
            if (!authenticated || !applicationDestination) {
                userSocketSessions.reject(accessor.getSessionId(), "Forbidden STOMP destination");
                return null;
            }
        }

        if (accessor != null && accessor.getDestination() != null && accessor.getDestination().contains("contest-message")) {
            String destination = accessor.getDestination();
            if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                if (!destination.equals("/user/queue/contest-messages") && !destination.equals("/user/queue/contest-message-acks")) return null;
                // Per-session destinations: recipients are checked again on every push.
                return accessor.getSessionAttributes() != null && accessor.getSessionAttributes().get("authUser") != null ? message : null;
            }
        }

        if (accessor != null && StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            Map<String, Object> attributes = accessor.getSessionAttributes();
            AuthUser authUser = attributes != null && attributes.get("authUser") instanceof AuthUser user
                ? user : null;
            if (authUser == null) {
                return null; // 未认证，拒绝订阅
            }

            String destination = accessor.getDestination();
            if (destination == null) {
                return null;
            }

            // 检查订阅权限
            Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
            Object clientIpValue = sessionAttributes == null ? null : sessionAttributes.get("clientIp");
            String clientIp = clientIpValue instanceof String value ? value : null;
            if (!canSubscribe(authUser, destination, clientIp)) {
                return null; // 无权限，拒绝订阅
            }
        }

        return message;
    }

    private boolean canSubscribe(AuthUser authUser, String destination, String clientIp) {
        // 管理员可以订阅所有频道
        if (authUser.adminAccount()) {
            return true;
        }

        // 检查比赛榜单订阅权限
        Matcher scoreboardMatcher = CONTEST_SCOREBOARD_PATTERN.matcher(destination);
        if (scoreboardMatcher.matches()) {
            long contestId = Long.parseLong(scoreboardMatcher.group(1));
            /**
             * 判断访问比赛是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return canAccessContest(authUser, contestId, clientIp);
        }

        // 检查比赛公告订阅权限
        Matcher announcementMatcher = CONTEST_ANNOUNCEMENT_PATTERN.matcher(destination);
        if (announcementMatcher.matches()) {
            long contestId = Long.parseLong(announcementMatcher.group(1));
            /**
             * 判断访问比赛是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return canAccessContest(authUser, contestId, clientIp);
        }

        // 检查比赛状态订阅权限
        Matcher statusMatcher = CONTEST_STATUS_PATTERN.matcher(destination);
        if (statusMatcher.matches()) {
            long contestId = Long.parseLong(statusMatcher.group(1));
            /**
             * 判断访问比赛是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return canAccessContest(authUser, contestId, clientIp);
        }

        // 检查提交状态订阅权限
        Matcher submissionMatcher = SUBMISSION_PATTERN.matcher(destination);
        if (submissionMatcher.matches()) {
            long submissionId = Long.parseLong(submissionMatcher.group(1));
            /**
             * 判断访问提交是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return canAccessSubmission(authUser, submissionId, clientIp);
        }

        if (SUBMISSION_QUEUE_PATTERN.matcher(destination).matches()) {
            return true;
        }

        // 未知频道，拒绝订阅
        return false;
    }

    private boolean canAccessContest(AuthUser authUser, long contestId, String clientIp) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            return false;
        }
        if (!contestIpAccessService.isAllowed(contest, authUser, clientIp)) {
            return false;
        }

        // 公开比赛，任何登录用户都可以订阅实时频道
        if ("ALL".equals(contest.audience)) {
            return true;
        }

        // 私有比赛，检查是否是参赛者
        return participantMapper.selectCount(
            new QueryWrapper<ContestParticipant>()
                .eq("contest_id", contestId)
                .eq("user_id", authUser.id())
        ) > 0;
    }

    private boolean canAccessSubmission(AuthUser authUser, long submissionId, String clientIp) {
        Submission submission = submissionMapper.selectById(submissionId);
        if (submission == null) {
            return false;
        }

        if (submission.contestId != null) {
            Contest contest = contestMapper.selectById(submission.contestId);
            if (contest != null && !contestIpAccessService.isAllowed(contest, authUser, clientIp)) {
                return false;
            }
        }

        // 只能查看自己的提交
        return submission.userId.equals(authUser.id());
    }
}
