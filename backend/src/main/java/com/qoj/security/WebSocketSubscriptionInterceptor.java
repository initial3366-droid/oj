package com.qoj.security;

import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestParticipantMapper;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
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

    // 频道模式
    private static final Pattern CONTEST_SCOREBOARD_PATTERN = Pattern.compile("^/topic/contests/(\\d+)/scoreboard$");
    private static final Pattern CONTEST_ANNOUNCEMENT_PATTERN = Pattern.compile("^/topic/contests/(\\d+)/announcements$");
    private static final Pattern CONTEST_STATUS_PATTERN = Pattern.compile("^/topic/contests/(\\d+)/status$");
    private static final Pattern SUBMISSION_PATTERN = Pattern.compile("^/topic/submissions/(\\d+)$");
    private static final Pattern SUBMISSION_QUEUE_PATTERN = Pattern.compile("^/topic/submission-queue$");

    public WebSocketSubscriptionInterceptor(
        ContestMapper contestMapper,
        ContestParticipantMapper participantMapper,
        SubmissionMapper submissionMapper
    ) {
        this.contestMapper = contestMapper;
        this.participantMapper = participantMapper;
        this.submissionMapper = submissionMapper;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            AuthUser authUser = (AuthUser) accessor.getSessionAttributes().get("authUser");
            if (authUser == null) {
                return null; // 未认证，拒绝订阅
            }

            String destination = accessor.getDestination();
            if (destination == null) {
                return null;
            }

            // 检查订阅权限
            if (!canSubscribe(authUser, destination)) {
                return null; // 无权限，拒绝订阅
            }
        }

        return message;
    }

    private boolean canSubscribe(AuthUser authUser, String destination) {
        // 管理员可以订阅所有频道
        if (authUser.adminAccount()) {
            return true;
        }

        // 检查比赛榜单订阅权限
        Matcher scoreboardMatcher = CONTEST_SCOREBOARD_PATTERN.matcher(destination);
        if (scoreboardMatcher.matches()) {
            long contestId = Long.parseLong(scoreboardMatcher.group(1));
            return canAccessContest(authUser, contestId);
        }

        // 检查比赛公告订阅权限
        Matcher announcementMatcher = CONTEST_ANNOUNCEMENT_PATTERN.matcher(destination);
        if (announcementMatcher.matches()) {
            long contestId = Long.parseLong(announcementMatcher.group(1));
            return canAccessContest(authUser, contestId);
        }

        // 检查比赛状态订阅权限
        Matcher statusMatcher = CONTEST_STATUS_PATTERN.matcher(destination);
        if (statusMatcher.matches()) {
            long contestId = Long.parseLong(statusMatcher.group(1));
            return canAccessContest(authUser, contestId);
        }

        // 检查提交状态订阅权限
        Matcher submissionMatcher = SUBMISSION_PATTERN.matcher(destination);
        if (submissionMatcher.matches()) {
            long submissionId = Long.parseLong(submissionMatcher.group(1));
            return canAccessSubmission(authUser, submissionId);
        }

        if (SUBMISSION_QUEUE_PATTERN.matcher(destination).matches()) {
            return true;
        }

        // 未知频道，拒绝订阅
        return false;
    }

    private boolean canAccessContest(AuthUser authUser, long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            return false;
        }

        // 公开比赛，任何登录用户都可以订阅实时频道
        if ("ALL".equals(contest.audience)) {
            return true;
        }

        // 私有比赛，检查是否是参赛者
        return participantMapper.selectCount(
            new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<com.qoj.module.contest.entity.ContestParticipant>()
                .eq("contest_id", contestId)
                .eq("user_id", authUser.id())
        ) > 0;
    }

    private boolean canAccessSubmission(AuthUser authUser, long submissionId) {
        Submission submission = submissionMapper.selectById(submissionId);
        if (submission == null) {
            return false;
        }

        // 只能查看自己的提交
        return submission.userId.equals(authUser.id());
    }
}
