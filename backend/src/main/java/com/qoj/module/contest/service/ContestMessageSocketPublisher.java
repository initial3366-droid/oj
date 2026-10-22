package com.qoj.module.contest.service;

import com.qoj.common.redis.RedisKeys;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.vo.ContestMessageVO;
import com.qoj.security.AuthUser;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Private, session-addressed pushes, filtered against current registrations and ownership. */
@Component
public class ContestMessageSocketPublisher {
    private static final Logger log = LoggerFactory.getLogger(ContestMessageSocketPublisher.class);
    private record Session(String id, String subscriptionId, AuthUser actor, String ip, long expiresAt, String tokenId) {}
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private final SimpMessagingTemplate messaging;
    private final JdbcTemplate jdbc;
    private final ContestMapper contests;
    private final ContestIpAccessService ipAccess;
    private final StringRedisTemplate redis;

    public ContestMessageSocketPublisher(SimpMessagingTemplate messaging, JdbcTemplate jdbc,
        ContestMapper contests, ContestIpAccessService ipAccess, StringRedisTemplate redis) {
        this.messaging = messaging; this.jdbc = jdbc; this.contests = contests; this.ipAccess = ipAccess; this.redis = redis;
    }

    @EventListener
    public void subscribed(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(event.getMessage(), StompHeaderAccessor.class);
        if (accessor == null) return;
        if (!"/user/queue/contest-messages".equals(accessor.getDestination())) return;
        Map<String, Object> attributes = accessor.getSessionAttributes();
        if (attributes == null || !(attributes.get("authUser") instanceof AuthUser actor)
            || !(attributes.get("accessExpiresAt") instanceof Number expiresAt)) return;
        sessions.put(accessor.getSessionId(), new Session(accessor.getSessionId(), accessor.getSubscriptionId(), actor,
            (String) attributes.get("clientIp"), expiresAt.longValue(), (String) attributes.get("accessTokenId")));
    }

    @EventListener
    public void unsubscribed(SessionUnsubscribeEvent event) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(event.getMessage(), StompHeaderAccessor.class);
        if (accessor == null) return;
        sessions.computeIfPresent(accessor.getSessionId(), (id, session) ->
            session.subscriptionId().equals(accessor.getSubscriptionId()) ? null : session);
    }

    @EventListener
    public void disconnected(SessionDisconnectEvent event) { sessions.remove(event.getSessionId()); }

    public void sendToSession(String sessionId, String queue, Object payload) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setSessionId(sessionId);
        headers.setLeaveMutable(true);
        // A session id as the user name targets only this connection, avoiding cross-account numeric ID collisions.
        messaging.convertAndSendToUser(sessionId, queue, payload, headers.getMessageHeaders());
    }

    public void afterCommit(long contestId, ContestMessageVO message) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try { publish(contestId, message); }
                catch (Exception error) { log.error("Contest message {} saved but live delivery failed", message.id(), error); }
            }
        });
    }

    private void publish(long contestId, ContestMessageVO message) {
        Contest contest = contests.selectById(contestId);
        if (contest == null || Boolean.TRUE.equals(contest.isDeleted) || sessions.isEmpty()) return;
        Set<Long> participants = new HashSet<>(jdbc.queryForList(
            "SELECT r.user_id FROM contest_registrations r JOIN users u ON u.id = r.user_id "
                + "WHERE r.contest_id = ? AND r.status = 'APPROVED' AND u.is_deleted = 0 AND u.status = 'NORMAL'", Long.class, contestId));
        Set<Long> admins = new HashSet<>(jdbc.queryForList("SELECT id FROM admin_users WHERE role = 'SUPER_ADMIN'", Long.class));
        Set<Long> teachers = new HashSet<>(jdbc.queryForList("SELECT id FROM teachers WHERE status = 'ACTIVE'", Long.class));
        List<Session> connected = new ArrayList<>(sessions.values());
        List<String> keys = connected.stream().map(session -> RedisKeys.tokenBlacklist(session.tokenId())).toList();
        List<String> revoked = redis.opsForValue().multiGet(keys);
        for (int index = 0; index < connected.size(); index++) {
            Session session = connected.get(index);
            if (session.expiresAt() <= System.currentTimeMillis() || (revoked != null && revoked.get(index) != null)) continue;
            AuthUser actor = session.actor();
            boolean manager = actor.adminAccount() && admins.contains(actor.id())
                || actor.teacherAccount() && teachers.contains(actor.id()) && "TEACHER".equals(contest.ownerAccountType) && actor.id().equals(contest.ownerId);
            boolean participant = "USER".equals(actor.accountType()) && participants.contains(actor.id())
                && ipAccess.isAllowed(contest, actor, session.ip())
                && (message.participantId() == null || actor.id().equals(message.participantId()));
            if (manager || participant) sendToSession(session.id(), "/queue/contest-messages", Map.of("contestId", contestId, "message", message));
        }
    }
}
