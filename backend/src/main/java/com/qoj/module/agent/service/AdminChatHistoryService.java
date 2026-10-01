package com.qoj.module.agent.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.agent.dto.AdminChatSessionRequest;
import com.qoj.module.agent.dto.AdminChatSessionRequest.Message;
import com.qoj.module.agent.entity.AdminChatSession;
import com.qoj.module.agent.mapper.AdminChatSessionMapper;
import com.qoj.module.agent.vo.AdminChatSessionVO;
import com.qoj.security.CurrentUser;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Chat history belongs to the authenticated admin and survives browser or backend restarts. */
@Service
public class AdminChatHistoryService {
    private final AdminChatSessionMapper mapper;
    private final ObjectMapper objectMapper;
    private final AgentChatService chatService;
    private final AdminChatImageService imageService;
    private final AdminChatFileService fileService;

    public AdminChatHistoryService(AdminChatSessionMapper mapper, ObjectMapper objectMapper, AgentChatService chatService, AdminChatImageService imageService, AdminChatFileService fileService) {
        this.mapper = mapper;
        this.objectMapper = objectMapper;
        this.chatService = chatService;
        this.imageService = imageService;
        this.fileService = fileService;
    }

    public long ownerId() {
        var user = CurrentUser.required();
        if (!user.adminAccount()) throw new BizException(403, "仅后台账号可以访问聊天历史");
        return user.id();
    }

    public List<AdminChatSessionVO> list() {
        return mapper.selectList(new QueryWrapper<AdminChatSession>()
            .select("id", "title", "title_source", "title_revision", "created_at", "updated_at", "version")
            .eq("owner_admin_id", ownerId()).orderByDesc("updated_at", "id"))
            .stream().map(session -> toVO(session, null)).toList();
    }

    public AdminChatSessionVO detail(String id) {
        AdminChatSession session = owned(id, ownerId());
        return toVO(session, readMessages(session));
    }

    @Transactional
    public AdminChatSessionVO save(String id, AdminChatSessionRequest request) {
        if (id == null || !id.matches("[A-Za-z0-9-]{1,80}")) {
            throw new BizException(400, "聊天标识格式不正确");
        }
        long ownerId = ownerId();
        int totalChars = 0;
        var messageIds = new HashSet<String>();
        var canonicalMessages = new ArrayList<Message>();
        for (Message message : request.messages()) {
            var images = imageService.validate(ownerId, message.role(), message.images(), true);
            var files = fileService.validate(ownerId, message.role(), message.files(), true);
            if (images.size() + files.size() > 4) throw new BizException(400, "每条消息最多 4 个附件");
            if (!messageIds.add(message.id()) || ("user".equals(message.role()) && message.content().isBlank() && images.isEmpty() && files.isEmpty())) {
                throw new BizException(400, "聊天消息格式不正确");
            }
            totalChars += message.content().length();
            if (totalChars > 2000000) throw new BizException(400, "聊天记录过长，请新建对话");
            canonicalMessages.add(new Message(message.id(), message.role(), message.content(), message.createdAt(),
                message.completedAt(), message.durationMs(), message.generationStatus(), message.timingEstimate(), images, files));
        }
        AdminChatSession session = mapper.lockOwned(id, ownerId);
        if (session == null) {
            // A versioned save must never recreate a chat that another window deleted.
            if (request.version() != null) throw new BizException(404, "聊天记录不存在");
            session = new AdminChatSession();
            session.id = id;
            session.ownerAdminId = ownerId;
            session.createdAt = request.createdAt();
            session.updatedAt = request.updatedAt();
            session.title = request.title().trim();
            session.titleSource = "pending".equals(request.titleSource()) ? "pending" : "legacy";
            if ("pending".equals(session.titleSource)) session.title = validTitle(session.title);
            session.titleRevision = 0L;
            session.messages = writeMessages(canonicalMessages);
            session.version = 0L;
            try {
                mapper.insert(session);
            } catch (DuplicateKeyException e) {
                // Legacy import can run twice under React StrictMode; it is create-only.
                session = mapper.lockOwned(id, ownerId);
                if (session == null) throw new BizException(404, "聊天记录不存在");
            }
        } else if (request.version() != null) {
            if (!session.version.equals(request.version())) {
                throw new BizException(409, "聊天记录已更新，请刷新后重试");
            }
            // Chat snapshots only update messages. Titles have their own endpoints and revision.
            // Task tokens are server-owned: browser snapshots cannot invent or replace them.
            var existingMessages = readMessages(session).stream().collect(java.util.stream.Collectors.toMap(Message::id, message -> message));
            canonicalMessages.replaceAll(message -> {
                var old = existingMessages.get(message.id());
                if (old != null && "assistant".equals(old.role()) && "stopped".equals(old.generationStatus())) return old;
                return new Message(message.id(), message.role(), message.content(), message.createdAt(), message.completedAt(),
                    message.durationMs(), message.generationStatus(), message.timingEstimate(), message.images(), message.files(),
                    old == null || "complete".equals(message.generationStatus()) ? null : old.continuationToken());
            });
            session.messages = writeMessages(canonicalMessages);
            session.updatedAt = System.currentTimeMillis();
            session.version++;
            mapper.updateById(session);
        }
        return toVO(session, readMessages(session));
    }

    @Transactional
    public void delete(String id) {
        long owner = ownerId();
        AdminChatSession session = mapper.lockOwned(id, owner);
        if (session == null) return;
        var messages = readMessages(session);
        mapper.delete(new QueryWrapper<AdminChatSession>().eq("id", id).eq("owner_admin_id", owner));
        for (var message : messages) imageService.deleteUnused(owner, message.images());
        for (var message : messages) fileService.deleteUnused(owner, message.files());
    }

    @Transactional
    public AdminChatSessionVO rename(String id, String title) {
        title = validTitle(title);
        AdminChatSession session = mapper.lockOwned(id, ownerId());
        if (session == null) throw new BizException(404, "聊天记录不存在");
        session.title = title;
        session.titleSource = "manual";
        session.titleRevision++;
        mapper.updateById(session);
        return toVO(session, null);
    }

    public AdminChatSessionVO generateTitle(String id, boolean onlyIfPending) {
        long ownerId = ownerId();
        AdminChatSession original = owned(id, ownerId);
        if (onlyIfPending && !"pending".equals(original.titleSource)) return toVO(original, null);
        Message firstPrompt = readMessages(original).stream()
            .filter(message -> "user".equals(message.role())).findFirst()
            .orElseThrow(() -> new BizException(400, "请先发送消息再生成名称"));
        // Do not hold a database lock during the model request. A later rename always wins.
        String title = validTitle(chatService.generateAdminChatTitle(firstPrompt.content().strip() + fileService.context(ownerId, firstPrompt.files(), 8000),
            imageService.media(ownerId, firstPrompt.images())));
        mapper.update(null, new UpdateWrapper<AdminChatSession>()
            .eq("id", id).eq("owner_admin_id", ownerId).eq("title_revision", original.titleRevision)
            .set("title", title).set("title_source", "ai").setSql("title_revision = title_revision + 1"));
        return toVO(owned(id, ownerId), null);
    }

    private String validTitle(String title) {
        if (title == null) throw new BizException(400, "请输入聊天名称");
        title = title.strip().replaceAll("\\s+", " ");
        int length = title.codePointCount(0, title.length());
        if (length < 5 || length > 20) throw new BizException(400, "聊天名称必须为 5～20 个字");
        return title;
    }

    public void requirePendingAssistant(String id, String messageId, long ownerId) {
        requirePendingAssistant(id, messageId, ownerId, null);
    }
    public void requirePendingAssistant(String id, String messageId, long ownerId, String token) {
        List<Message> messages = readMessages(owned(id, ownerId));
        if (messages.isEmpty()) throw new BizException(400, "请先保存聊天消息");
        Message last = messages.get(messages.size() - 1);
        if (!last.id().equals(messageId) || !"assistant".equals(last.role()) || ("complete".equals(last.generationStatus()) || (token == null && last.generationStatus() != null)
            || (token != null && !token.equals(last.continuationToken())))) {
            throw new BizException(409, "聊天记录已更新，请刷新后重试");
        }
    }

    /** The owner is captured before SSE leaves the authenticated request thread. */
    @Transactional
    public void saveAssistant(long ownerId, String id, String messageId, String content, String status) {
        AdminChatSession session = mapper.lockOwned(id, ownerId);
        if (session == null) return; // Deletion during generation must stay deleted.
        List<Message> messages = new ArrayList<>(readMessages(session));
        long now = System.currentTimeMillis();
        for (int i = 0; i < messages.size(); i++) {
            Message message = messages.get(i);
            if (!message.id().equals(messageId) || !"assistant".equals(message.role())) continue;
            if ("stopped".equals(message.generationStatus()) && !"stopped".equals(status)) return;
            messages.set(i, new Message(message.id(), message.role(), content, message.createdAt(),
                status == null ? null : now,
                status == null ? null : Math.max(0, now - (message.createdAt() == null ? now : message.createdAt())),
                status, message.timingEstimate(), null, null, "complete".equals(status) ? null : message.continuationToken()));
            session.messages = writeMessages(messages);
            session.updatedAt = now;
            session.version++;
            mapper.updateById(session);
            return;
        }
    }

    public String assistantContent(String id, String messageId, long ownerId) {
        return readMessages(owned(id, ownerId)).stream().filter(message -> message.id().equals(messageId))
            .findFirst().map(Message::content).orElse("");
    }

    @Transactional
    public void saveAssistantCheckpoint(long ownerId, String id, String messageId, String token, boolean resume) {
        AdminChatSession session = mapper.lockOwned(id, ownerId);
        if (session == null) return;
        var messages = new ArrayList<>(readMessages(session));
        for (int i = 0; i < messages.size(); i++) {
            var old = messages.get(i);
            if (!old.id().equals(messageId) || !old.role().equals("assistant")) continue;
            boolean stopped = "stopped".equals(old.generationStatus()) && !resume;
            messages.set(i, new Message(old.id(), old.role(), old.content(), old.createdAt(), stopped ? old.completedAt() : null,
                stopped ? old.durationMs() : null, stopped ? "stopped" : null, old.timingEstimate(), null, null, token));
            session.messages = writeMessages(messages); session.version++; session.updatedAt = System.currentTimeMillis();
            mapper.updateById(session); return;
        }
    }

    public void requireAssistant(String id, String messageId, long owner) {
        if (readMessages(owned(id, owner)).stream().noneMatch(message -> message.id().equals(messageId) && message.role().equals("assistant"))) {
            throw new BizException(404, "聊天消息不存在");
        }
    }

    @Transactional
    public void stopAssistant(long owner, String id, String messageId, String receivedContent) {
        var session = mapper.lockOwned(id, owner);
        if (session == null) throw new BizException(404, "聊天记录不存在");
        var messages = new ArrayList<>(readMessages(session));
        for (int i = 0; i < messages.size(); i++) {
            var old = messages.get(i);
            if (!old.id().equals(messageId) || !old.role().equals("assistant")) continue;
            if ("complete".equals(old.generationStatus())) return;
            long now = System.currentTimeMillis();
            String content = receivedContent != null && receivedContent.startsWith(old.content()) ? receivedContent : old.content();
            messages.set(i, new Message(old.id(), old.role(), content, old.createdAt(), now,
                Math.max(0, now - (old.createdAt() == null ? now : old.createdAt())), "stopped", old.timingEstimate(),
                old.images(), old.files(), old.continuationToken()));
            session.messages = writeMessages(messages); session.version++; session.updatedAt = now;
            mapper.updateById(session); return;
        }
    }

    private AdminChatSession owned(String id, long ownerId) {
        AdminChatSession session = mapper.selectOne(new QueryWrapper<AdminChatSession>()
            .eq("id", id).eq("owner_admin_id", ownerId));
        if (session == null) throw new BizException(404, "聊天记录不存在");
        return session;
    }

    private List<Message> readMessages(AdminChatSession session) {
        try {
            return objectMapper.readValue(session.messages, new TypeReference<List<Message>>() {});
        } catch (JsonProcessingException e) {
            throw new BizException(500, "聊天记录读取失败");
        }
    }

    private String writeMessages(List<Message> messages) {
        try {
            return objectMapper.writeValueAsString(messages);
        } catch (JsonProcessingException e) {
            throw new BizException(500, "聊天记录保存失败");
        }
    }

    private AdminChatSessionVO toVO(AdminChatSession session, List<Message> messages) {
        return new AdminChatSessionVO(session.id, session.title, session.createdAt, session.updatedAt, session.version, messages,
            session.titleSource, session.titleRevision);
    }
}
