-- 添加 contest_registrations 表的 id 和 status 字段

-- 先删除外键约束
ALTER TABLE contest_registrations DROP FOREIGN KEY fk_contest_registrations_contest;
ALTER TABLE contest_registrations DROP FOREIGN KEY fk_contest_registrations_user;

-- 删除现有的复合主键
ALTER TABLE contest_registrations DROP PRIMARY KEY;

-- 添加 id 主键字段
ALTER TABLE contest_registrations
ADD COLUMN id BIGINT PRIMARY KEY AUTO_INCREMENT FIRST;

-- 恢复外键约束
ALTER TABLE contest_registrations
ADD CONSTRAINT fk_contest_registrations_contest FOREIGN KEY (contest_id) REFERENCES contests(id);
ALTER TABLE contest_registrations
ADD CONSTRAINT fk_contest_registrations_user FOREIGN KEY (user_id) REFERENCES users(id);

-- 添加 status 字段用于审核状态
ALTER TABLE contest_registrations
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'APPROVED' AFTER identity_id;

-- 添加 username 和 displayName 字段以便查询
ALTER TABLE contest_registrations
ADD COLUMN username VARCHAR(80) AFTER user_id,
ADD COLUMN display_name VARCHAR(255) AFTER username;

-- 填充现有数据的 username 和 display_name
UPDATE contest_registrations cr
JOIN users u ON cr.user_id = u.id
SET cr.username = u.username,
    cr.display_name = u.display_name;

-- 为 contest_id 和 user_id 创建唯一索引（之前是主键）
CREATE UNIQUE INDEX uk_contest_user ON contest_registrations(contest_id, user_id);

-- 添加 contests 表的统计字段
ALTER TABLE contests
ADD COLUMN registration_count INT NOT NULL DEFAULT 0 AFTER status,
ADD COLUMN participant_count INT NOT NULL DEFAULT 0 AFTER registration_count;

-- 更新 contests 表统计字段
UPDATE contests c
SET
    registration_count = (
        SELECT COUNT(*)
        FROM contest_registrations cr
        WHERE cr.contest_id = c.id
    ),
    participant_count = (
        SELECT COUNT(*)
        FROM contest_registrations cr
        WHERE cr.contest_id = c.id
        AND cr.status = 'APPROVED'
    );
