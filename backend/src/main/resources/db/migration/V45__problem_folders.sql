-- 题目文件夹表
CREATE TABLE IF NOT EXISTS problem_folders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) DEFAULT '',
    display_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认文件夹
INSERT INTO problem_folders (name, description, display_order) VALUES ('未分类', '默认文件夹，未归类的题目在此', 0);

-- problems 表新增 folder_id 列
SET @column_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problems' AND COLUMN_NAME = 'folder_id'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE problems ADD COLUMN folder_id BIGINT NULL AFTER tags',
    'SELECT "folder_id column already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 回填现有题目的 folder_id 为默认文件夹
UPDATE problems SET folder_id = (SELECT id FROM problem_folders LIMIT 1) WHERE folder_id IS NULL AND is_deleted = 0;
