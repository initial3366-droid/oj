#!/bin/bash
# QOJ 压力测试快速启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "QOJ 压力测试工具"
echo "========================================"
echo ""
echo "请选择操作:"
echo "  1. 批量创建测试用户"
echo "  2. 运行压力测试"
echo "  3. 查看使用说明"
echo "  4. 退出"
echo ""
read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "创建测试用户"
        echo "--------------------"
        read -p "OJ地址 (例如 http://localhost:8080): " base_url
        read -p "用户名前缀 (例如 testuser): " prefix
        read -p "用户数量 (例如 100): " count
        read -p "统一密码 (例如 test123456): " password

        echo ""
        python3 create_test_users.py "$base_url" "$prefix" "$count" "$password"
        ;;

    2)
        echo ""
        if [ ! -f "stress_test_config.json" ]; then
            echo "配置文件不存在，正在创建模板..."
            cat > stress_test_config.json << 'EOF'
{
  "base_url": "http://localhost:8080",
  "contest_id": 1,
  "problem_id": 1,
  "num_users": 100,
  "username_prefix": "testuser",
  "password": "test123456",
  "use_proxy": true,
  "concurrent_batch": 20
}
EOF
            echo "已创建配置文件: stress_test_config.json"
            echo "请先编辑配置文件，然后重新运行此脚本"
            exit 0
        fi

        echo "当前配置:"
        cat stress_test_config.json
        echo ""
        read -p "确认使用此配置运行压力测试? (yes/no): " confirm

        if [ "$confirm" = "yes" ]; then
            python3 stress_test_with_config.py
        else
            echo "已取消"
        fi
        ;;

    3)
        echo ""
        if [ -f "STRESS_TEST_README.md" ]; then
            cat STRESS_TEST_README.md
        else
            echo "使用说明文件不存在"
        fi
        ;;

    4)
        echo "再见！"
        exit 0
        ;;

    *)
        echo "无效选项"
        exit 1
        ;;
esac
