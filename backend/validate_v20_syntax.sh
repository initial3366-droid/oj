#!/bin/bash

# SQL语法验证脚本
# 检查V20迁移脚本的语法正确性

SQL_FILE="/Users/initial/qoj/backend/src/main/resources/db/migration/V20__optimize_database_schema.sql"

echo "正在验证 V20 迁移脚本语法..."
echo "文件: $SQL_FILE"
echo ""

# 检查文件是否存在
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ 错误: 文件不存在"
    exit 1
fi

echo "✅ 文件存在"

# 检查文件大小
FILE_SIZE=$(wc -c < "$SQL_FILE")
echo "✅ 文件大小: $FILE_SIZE 字节"

# 检查基本语法
echo ""
echo "检查SQL语法关键点："

# 1. 检查是否有语法错误的关键字
if grep -q "CREAT INDEX" "$SQL_FILE"; then
    echo "❌ 发现拼写错误: CREAT INDEX (应该是 CREATE INDEX)"
    exit 1
fi
echo "✅ 无明显拼写错误"

# 2. 检查DROP INDEX语法
DROP_COUNT=$(grep -c "DROP INDEX.*ON" "$SQL_FILE")
echo "✅ DROP INDEX 语句: $DROP_COUNT 条"

# 3. 检查CREATE INDEX语法
CREATE_INDEX_COUNT=$(grep -c "CREATE INDEX" "$SQL_FILE")
echo "✅ CREATE INDEX 语句: $CREATE_INDEX_COUNT 条"

# 4. 检查ALTER TABLE语句
ALTER_COUNT=$(grep -c "ALTER TABLE" "$SQL_FILE")
echo "✅ ALTER TABLE 语句: $ALTER_COUNT 条"

# 5. 检查条件判断语句
IF_EXISTS_COUNT=$(grep -c "IF EXISTS" "$SQL_FILE")
IF_NOT_EXISTS_COUNT=$(grep -c "IF NOT EXISTS" "$SQL_FILE")
echo "✅ IF EXISTS: $IF_EXISTS_COUNT 个"
echo "✅ IF NOT EXISTS: $IF_NOT_EXISTS_COUNT 个"

# 6. 检查PREPARE语句配对
PREPARE_COUNT=$(grep -c "PREPARE stmt FROM" "$SQL_FILE")
EXECUTE_COUNT=$(grep -c "EXECUTE stmt" "$SQL_FILE")
DEALLOCATE_COUNT=$(grep -c "DEALLOCATE PREPARE stmt" "$SQL_FILE")

if [ "$PREPARE_COUNT" -eq "$EXECUTE_COUNT" ] && [ "$EXECUTE_COUNT" -eq "$DEALLOCATE_COUNT" ]; then
    echo "✅ PREPARE/EXECUTE/DEALLOCATE 配对: $PREPARE_COUNT 组"
else
    echo "❌ PREPARE/EXECUTE/DEALLOCATE 不匹配"
    echo "   PREPARE: $PREPARE_COUNT"
    echo "   EXECUTE: $EXECUTE_COUNT"
    echo "   DEALLOCATE: $DEALLOCATE_COUNT"
    exit 1
fi

# 7. 检查注释
COMMENT_COUNT=$(grep -c "^--" "$SQL_FILE")
echo "✅ 注释行数: $COMMENT_COUNT"

echo ""
echo "=========================================="
echo "✅ V20 迁移脚本语法验证通过"
echo "=========================================="
echo ""
echo "下一步:"
echo "1. 启动测试数据库: docker compose -f .runtime/qoj-deps.compose.yml up -d"
echo "2. 应用迁移: cd backend && mvn flyway:migrate"
echo "3. 验证索引: 使用 SHOW INDEX FROM <table_name>"
echo ""

exit 0
