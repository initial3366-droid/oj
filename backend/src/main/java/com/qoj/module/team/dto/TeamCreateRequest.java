package com.qoj.module.team.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 新建队伍请求参数。
 */
public record TeamCreateRequest(
    @NotBlank(message = "队伍名称不能为空")
    @Size(max = 100, message = "队伍名称过长")
    String name
) {
}
