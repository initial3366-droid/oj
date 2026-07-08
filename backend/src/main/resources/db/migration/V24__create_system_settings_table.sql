-- V24: 创建系统设置表
-- 用于存储系统配置信息（键值对形式）

CREATE TABLE system_settings (
    setting_key VARCHAR(100) PRIMARY KEY COMMENT '设置键',
    setting_value TEXT NOT NULL COMMENT '设置值（JSON格式）',
    category VARCHAR(50) NOT NULL COMMENT '配置分类（frontend/register）',
    description VARCHAR(200) COMMENT '配置描述',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    updated_by VARCHAR(100) COMMENT '更新人',

    INDEX idx_category (category)
) COMMENT '系统设置表';

-- 初始化默认配置
INSERT INTO system_settings (setting_key, setting_value, category, description) VALUES
('frontend.site_title', '"QOJ 在线评测系统"', 'frontend', '网站标题'),
('frontend.maintenance_mode', 'false', 'frontend', '维护模式开关'),
('frontend.carousel_images', '[]', 'frontend', '轮播图配置'),
('register.enabled', 'true', 'register', '注册开关'),
('register.email_verification', 'false', 'register', '邮箱验证开关'),
('register.email_config', '{}', 'register', '邮件服务器配置'),
('register.fields_config', '{"className":{"enabled":true,"required":true},"studentNo":{"enabled":true,"required":true},"email":{"enabled":true,"required":false}}', 'register', '注册字段配置');
