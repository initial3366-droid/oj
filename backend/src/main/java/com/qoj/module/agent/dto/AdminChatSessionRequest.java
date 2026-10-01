package com.qoj.module.agent.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;
import com.qoj.module.agent.vo.AdminChatImageVO;
import com.qoj.module.agent.vo.AdminChatFileVO;

public record AdminChatSessionRequest(
    @NotBlank @Size(max = 128) String title,
    @NotNull @PositiveOrZero Long createdAt,
    @NotNull @PositiveOrZero Long updatedAt,
    @PositiveOrZero Long version,
    @NotNull @Size(max = 2000) List<@NotNull @Valid Message> messages,
    @Pattern(regexp = "pending|ai|manual|legacy") String titleSource
) {
    public record Message(
        @NotBlank @Size(max = 80) String id,
        @NotBlank @Pattern(regexp = "user|assistant") String role,
        @NotNull @Size(max = 200000) String content,
        @PositiveOrZero Long createdAt,
        @PositiveOrZero Long completedAt,
        @PositiveOrZero Long durationMs,
        @Pattern(regexp = "complete|stopped|error") String generationStatus,
        Boolean timingEstimate,
        @Size(max = 4) List<@NotNull @Valid AdminChatImageVO> images,
        @Size(max = 4) List<@NotNull @Valid AdminChatFileVO> files,
        @Size(max = 80) String continuationToken
    ) {
        public Message(String id, String role, String content, Long createdAt, Long completedAt,
                       Long durationMs, String generationStatus, Boolean timingEstimate,
                       List<AdminChatImageVO> images, List<AdminChatFileVO> files) {
            this(id, role, content, createdAt, completedAt, durationMs, generationStatus, timingEstimate, images, files, null);
        }
        public Message(String id, String role, String content, Long createdAt, Long completedAt,
                       Long durationMs, String generationStatus, Boolean timingEstimate) {
            this(id, role, content, createdAt, completedAt, durationMs, generationStatus, timingEstimate, null, null, null);
        }
    }
}
