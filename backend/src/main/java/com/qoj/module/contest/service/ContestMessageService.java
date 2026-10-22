package com.qoj.module.contest.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.exception.BizException;
import com.qoj.common.util.IpNetworkUtils;
import com.qoj.module.contest.dto.ContestMessageRequest;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestRegistration;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestRegistrationMapper;
import com.qoj.module.contest.vo.ContestMessageFeedVO;
import com.qoj.module.contest.vo.ContestMessageVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.ContestAccessPolicy;
import com.qoj.security.policy.Permission;
import java.util.List;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContestMessageService {
    private final JdbcTemplate jdbc;
    private final ContestMapper contests;
    private final ContestRegistrationMapper registrations;
    private final ContestAccessPolicy policy;
    private final ContestIpAccessService ipAccess;
    private final ContestMessageSocketPublisher socketPublisher;
    private static final RowMapper<ContestMessageVO> MESSAGE = (rs, row) -> new ContestMessageVO(
        rs.getLong("id"), rs.getObject("participant_id", Long.class), rs.getString("kind"),
        rs.getString("author_name"), rs.getString("content"), rs.getTimestamp("created_at").toLocalDateTime());

    public ContestMessageService(JdbcTemplate jdbc, ContestMapper contests, ContestRegistrationMapper registrations,
        ContestAccessPolicy policy, ContestIpAccessService ipAccess, ContestMessageSocketPublisher socketPublisher) {
        this.jdbc = jdbc;
        this.contests = contests;
        this.registrations = registrations;
        this.policy = policy;
        this.ipAccess = ipAccess;
        this.socketPublisher = socketPublisher;
    }

    private Contest requireContest(long id, boolean management) {
        return requireContest(id, management, CurrentUser.required(), IpNetworkUtils.currentClientIp());
    }

    private Contest requireContest(long id, boolean management, AuthUser actor, String clientIp) {
        Contest contest = contests.selectById(id);
        if (contest == null || Boolean.TRUE.equals(contest.isDeleted)) throw new BizException(404, "比赛不存在");
        if (management) {
            if (!(actor.adminAccount() && "SUPER_ADMIN".equals(actor.role()) || actor.teacherAccount()) || !policy.can(actor, Permission.UPDATE, contest)) {
                throw new BizException(403, "无权管理该比赛答疑");
            }
        } else {
            if (!"USER".equals(actor.accountType())) throw new BizException(403, "请使用已报名的选手账号");
            requireRegistration(id, actor.id());
            ipAccess.requireAllowed(contest, actor, clientIp);
        }
        return contest;
    }

    private void requireRegistration(long contestId, long participantId) {
        if (registrations.selectCount(new QueryWrapper<ContestRegistration>().eq("contest_id", contestId)
            .eq("user_id", participantId).eq("status", "APPROVED")) == 0) {
            throw new BizException(403, "报名通过后才能查看比赛答疑和广播");
        }
    }

    public ContestMessageFeedVO feed(long contestId, long afterId, boolean management) {
        Contest contest = requireContest(contestId, management);
        long userId = CurrentUser.id();
        String scope = management ? "" : " AND (participant_id IS NULL OR participant_id = ?)";
        List<ContestMessageVO> messages = management
            ? jdbc.query("SELECT * FROM contest_messages WHERE contest_id = ? AND id > ? ORDER BY id LIMIT 201",
                MESSAGE, contestId, afterId)
            : jdbc.query("SELECT * FROM contest_messages WHERE contest_id = ? AND id > ?" + scope + " ORDER BY id LIMIT 201",
                MESSAGE, contestId, afterId, userId);
        List<Long> reads = management ? List.of() : jdbc.queryForList(
            "SELECT last_read_id FROM contest_message_reads WHERE contest_id = ? AND user_id = ?", Long.class, contestId, userId);
        return new ContestMessageFeedVO(contest.title, userId, reads.isEmpty() ? 0 : reads.get(0),
            messages.size() > 200 ? messages.subList(0, 200) : messages, messages.size() > 200);
    }

    @Transactional
    public ContestMessageVO send(long contestId, ContestMessageRequest request, String kind) {
        return sendAs(contestId, request, kind, CurrentUser.required(), IpNetworkUtils.currentClientIp());
    }

    @Transactional
    public ContestMessageVO sendFromSocket(long contestId, ContestMessageRequest request, String kind, AuthUser actor, String clientIp) {
        return sendAs(contestId, request, kind, actor, clientIp);
    }

    private ContestMessageVO sendAs(long contestId, ContestMessageRequest request, String kind, AuthUser actor, String clientIp) {
        if (!List.of("QUESTION", "REPLY", "BROADCAST").contains(kind)) throw new BizException(400, "消息类型不合法");
        boolean management = !"QUESTION".equals(kind);
        requireContest(contestId, management, actor, clientIp);
        Long participantId = "QUESTION".equals(kind) ? actor.id() : request.participantId();
        if ("BROADCAST".equals(kind)) participantId = null;
        if ("REPLY".equals(kind)) {
            if (participantId == null) throw new BizException(400, "请选择要回复的选手");
            requireRegistration(contestId, participantId);
        }
        String content = request.content().trim();
        if (content.isEmpty()) throw new BizException(400, "消息不能为空");
        // Idempotent retries preserve one durable message even if the original response was lost.
        jdbc.update("INSERT INTO contest_messages (contest_id, participant_id, kind, author_id, author_account_type, author_name, content, request_id) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id",
            contestId, participantId, kind, actor.id(), actor.accountType(),
            actor.displayName() == null ? actor.getUsername() : actor.displayName(), content, request.requestId());
        ContestMessageVO result = jdbc.queryForObject("SELECT * FROM contest_messages WHERE contest_id = ? "
            + "AND author_id = ? AND author_account_type = ? AND request_id = ?", MESSAGE,
            contestId, actor.id(), actor.accountType(), request.requestId());
        if (result == null || !result.kind().equals(kind) || !Objects.equals(result.participantId(), participantId)
            || !result.content().equals(content)) throw new BizException(409, "消息请求编号已被使用，请重新发送");
        socketPublisher.afterCommit(contestId, result);
        return result;
    }

    @Transactional
    public void markRead(long contestId, long throughId) {
        requireContest(contestId, false);
        long userId = CurrentUser.id();
        Long visibleId = jdbc.queryForObject("SELECT COALESCE(MAX(id), 0) FROM contest_messages WHERE contest_id = ? "
            + "AND id <= ? AND (participant_id IS NULL OR participant_id = ?)", Long.class, contestId, throughId, userId);
        jdbc.update("INSERT INTO contest_message_reads (contest_id, user_id, last_read_id) VALUES (?, ?, ?) "
            + "ON DUPLICATE KEY UPDATE last_read_id = GREATEST(last_read_id, VALUES(last_read_id))", contestId, userId, visibleId);
    }
}
