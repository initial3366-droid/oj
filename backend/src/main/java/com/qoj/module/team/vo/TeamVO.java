package com.qoj.module.team.vo;

import java.util.List;

/**
 * 队伍响应视图模型。包含成员列表（用户 id/用户名/显示名），供管理端队伍管理页展示。
 */
public record TeamVO(
    Long id,
    String name,
    Integer memberCount,
    List<MemberVO> members
) {
    public record MemberVO(
        Long userId,
        String username,
        String displayName
    ) {
    }
}
