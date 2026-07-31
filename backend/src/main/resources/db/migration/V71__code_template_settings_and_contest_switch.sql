SET @schema_name = DATABASE();

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contests'
          AND COLUMN_NAME = 'enable_code_templates'
    ),
    'ALTER TABLE contests ADD COLUMN enable_code_templates BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''比赛是否启用默认代码模板'' AFTER allow_after_end_view_code',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at, updated_by)
VALUES (
    'system.code_templates',
    JSON_OBJECT(
        'c', CONCAT('#include <stdio.h>', CHAR(10), CHAR(10), 'int main(void) {', CHAR(10), '    return 0;', CHAR(10), '}'),
        'cpp', CONCAT('#include <bits/stdc++.h>', CHAR(10), 'using namespace std;', CHAR(10), CHAR(10), 'int main() {', CHAR(10), '    ios::sync_with_stdio(false);', CHAR(10), '    cin.tie(nullptr);', CHAR(10), CHAR(10), '    return 0;', CHAR(10), '}'),
        'python', CONCAT('import sys', CHAR(10), CHAR(10), 'def solve():', CHAR(10), '    pass', CHAR(10), CHAR(10), 'if __name__ == "__main__":', CHAR(10), '    solve()', CHAR(10)),
        'java', CONCAT('import java.io.*;', CHAR(10), 'import java.util.*;', CHAR(10), CHAR(10), 'public class Main {', CHAR(10), '    public static void main(String[] args) throws Exception {', CHAR(10), '    }', CHAR(10), '}'),
        'csharp', CONCAT('using System;', CHAR(10), CHAR(10), 'public static class Program', CHAR(10), '{', CHAR(10), '    public static void Main()', CHAR(10), '    {', CHAR(10), '    }', CHAR(10), '}')
    ),
    'system',
    '各语言默认代码模板',
    NOW(),
    'flyway-v71'
)
ON DUPLICATE KEY UPDATE setting_value = setting_value;
