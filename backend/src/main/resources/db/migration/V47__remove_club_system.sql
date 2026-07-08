-- 移除社团系统，仅保留班级系统

-- 1. 清理比赛受众中的社团数据
DELETE FROM contest_audiences WHERE audience_type = 'CLUB';

-- 2. 将比赛中的 CLUB 受众改为 ALL
UPDATE contests SET audience = 'ALL', audience_id = NULL WHERE audience = 'CLUB';

-- 3. 将练习中的 CLUB 受众改为 ALL（如果存在）
UPDATE practices SET audience = 'ALL', audience_id = NULL WHERE audience = 'CLUB';

-- 4. 将注册/参与者中的 CLUB 身份改为 PERSONAL
UPDATE contest_registrations SET identity_type = 'PERSONAL', identity_id = NULL WHERE identity_type = 'CLUB';
UPDATE contest_participants SET identity_type = 'PERSONAL', identity_id = NULL WHERE identity_type = 'CLUB';
UPDATE submissions SET identity_type = 'PERSONAL', identity_id = NULL WHERE identity_type = 'CLUB';

-- 5. 删除用户表中的社团外键约束（如果存在）
SET @fk_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_club'
);
SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE users DROP FOREIGN KEY fk_users_club',
    'SELECT "fk_users_club does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. 清理用户表中的社团关联列（如果存在）
SET @column_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'club_id'
);
SET @sql = IF(@column_exists > 0,
    'ALTER TABLE users DROP COLUMN club_id',
    'SELECT "club_id column does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. 删除社团申请表
DROP TABLE IF EXISTS club_join_applications;

-- 8. 删除社团成员表
DROP TABLE IF EXISTS club_members;

-- 9. 删除社团表
DROP TABLE IF EXISTS clubs;
