package com.qoj.module.setting.dto;

import jakarta.validation.constraints.NotBlank;

public class EmailConfigRequest {
    @NotBlank(message = "SMTP服务器地址不能为空")
    public String host;

    public Integer port;

    @NotBlank(message = "发件人邮箱不能为空")
    public String username;

    // 密码允许为空，为空时保留原密码
    public String password;

    public Boolean useSsl = true;

    public String subject;

    public String content;
}
