ALTER TABLE contests
    ADD COLUMN allowed_ip_ranges TEXT NULL COMMENT '比赛允许访问的 IP CIDR 网段，空值表示不限制';
