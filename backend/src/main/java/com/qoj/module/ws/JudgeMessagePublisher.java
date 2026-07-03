package com.qoj.module.ws;

import java.util.Map;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * WebSocket 消息推送服务
 * 负责向前端推送实时消息
 */
@Component
public class JudgeMessagePublisher {
    private final SimpMessagingTemplate messagingTemplate;

    public JudgeMessagePublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * 推送提交状态变更
     * 频道: /topic/submissions/{submissionId}
     */
    public void submissionChanged(Long submissionId, String status, Integer time, Integer memory) {
        messagingTemplate.convertAndSend(
            "/topic/submissions/" + submissionId,
            Map.of(
                "submissionId", submissionId,
                "status", status,
                "time", time == null ? 0 : time,
                "memory", memory == null ? 0 : memory,
                "timestamp", System.currentTimeMillis()
            )
        );
        submissionQueueUpdated();
    }

    /**
     * 推送提交队列更新
     * 频道: /topic/submission-queue
     */
    public void submissionQueueUpdated() {
        messagingTemplate.convertAndSend(
            "/topic/submission-queue",
            Map.of(
                "action", "refresh",
                "timestamp", System.currentTimeMillis()
            )
        );
    }

    /**
     * 推送比赛榜单更新
     * 频道: /topic/contests/{contestId}/scoreboard
     */
    public void contestScoreboardUpdated(Long contestId) {
        messagingTemplate.convertAndSend(
            "/topic/contests/" + contestId + "/scoreboard",
            Map.of(
                "contestId", contestId,
                "action", "refresh",
                "timestamp", System.currentTimeMillis()
            )
        );
    }

    /**
     * 推送比赛公告
     * 频道: /topic/contests/{contestId}/announcements
     */
    public void contestAnnouncement(Long contestId, String title, String content) {
        messagingTemplate.convertAndSend(
            "/topic/contests/" + contestId + "/announcements",
            Map.of(
                "contestId", contestId,
                "title", title,
                "content", content,
                "timestamp", System.currentTimeMillis()
            )
        );
    }

    /**
     * 推送比赛状态变更（开始/结束）
     * 频道: /topic/contests/{contestId}/status
     */
    /**
     * 推送新提交创建
     * 频道: /topic/submission-queue
     */
    public void submissionCreated(Long submissionId) {
        submissionQueueUpdated();
    }

    public void contestStatusChanged(Long contestId, String status) {
        messagingTemplate.convertAndSend(
            "/topic/contests/" + contestId + "/status",
            Map.of(
                "contestId", contestId,
                "status", status,
                "timestamp", System.currentTimeMillis()
            )
        );
    }
}
