#!/usr/bin/env python3
"""
批量创建测试用户的辅助脚本
用于快速准备压力测试所需的账号
"""
import asyncio
import aiohttp
import json
import sys
from typing import List, Dict


async def create_user(session: aiohttp.ClientSession, base_url: str, username: str, password: str, email: str = None) -> Dict:
    """创建单个用户"""
    url = f"{base_url}/api/v1/auth/register"

    payload = {
        "username": username,
        "password": password,
        "email": email or f"{username}@test.local"
    }

    try:
        async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            result = {
                "username": username,
                "success": resp.status == 200,
                "status": resp.status
            }

            if resp.status == 200:
                data = await resp.json()
                result["response"] = data
            else:
                text = await resp.text()
                result["error"] = text[:200]

            return result
    except Exception as e:
        return {
            "username": username,
            "success": False,
            "error": str(e)
        }


async def batch_create_users(base_url: str, prefix: str, count: int, password: str, batch_size: int = 10):
    """批量创建用户"""
    print(f"准备创建 {count} 个用户...")
    print(f"用户名: {prefix}1 ~ {prefix}{count}")
    print(f"密码: {password}")
    print(f"邮箱: {prefix}N@test.local")
    print("-" * 60)

    results = []

    async with aiohttp.ClientSession() as session:
        for i in range(0, count, batch_size):
            batch = range(i + 1, min(i + batch_size + 1, count + 1))
            print(f"创建第 {i//batch_size + 1} 批 ({min(batch_size, count - i)} 个用户)...")

            tasks = [
                create_user(session, base_url, f"{prefix}{j}", password)
                for j in batch
            ]

            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)

            success_count = sum(1 for r in batch_results if r["success"])
            print(f"  成功: {success_count}/{len(batch_results)}")

            if i + batch_size < count:
                await asyncio.sleep(0.5)

    return results


def print_summary(results: List[Dict]):
    """打印创建结果汇总"""
    total = len(results)
    success = sum(1 for r in results if r["success"])
    failed = total - success

    print("\n" + "=" * 60)
    print("创建结果汇总")
    print("=" * 60)
    print(f"总数: {total}")
    print(f"成功: {success} ({success/total*100:.1f}%)")
    print(f"失败: {failed} ({failed/total*100:.1f}%)")

    if failed > 0:
        print("\n失败详情:")
        for r in results:
            if not r["success"]:
                error = r.get("error", "Unknown error")
                print(f"  {r['username']}: {error}")

    print("=" * 60)


def save_results(results: List[Dict], filename: str = "user_creation_results.json"):
    """保存结果到文件"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n详细结果已保存至: {filename}")


async def main():
    """主函数"""
    if len(sys.argv) < 5:
        print("用法: python3 create_test_users.py <base_url> <prefix> <count> <password>")
        print("\n示例:")
        print("  python3 create_test_users.py http://localhost:8080 testuser 100 test123456")
        print("\n将创建:")
        print("  testuser1, testuser2, ..., testuser100")
        print("  所有用户密码: test123456")
        print("  邮箱格式: testuser1@test.local, testuser2@test.local, ...")
        sys.exit(1)

    base_url = sys.argv[1].rstrip('/')
    prefix = sys.argv[2]
    count = int(sys.argv[3])
    password = sys.argv[4]

    print("=" * 60)
    print("批量创建测试用户")
    print("=" * 60)

    confirm = input(f"\n确认创建 {count} 个用户? (yes/no): ")
    if confirm.lower() != 'yes':
        print("已取消")
        return

    results = await batch_create_users(base_url, prefix, count, password)
    print_summary(results)
    save_results(results)

    print("\n提示:")
    print("  - 成功创建的用户可以直接用于压力测试")
    print("  - 记得在压力测试配置中使用相同的用户名前缀和密码")
    print("  - 测试完成后建议清理这些测试账号")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n操作被用户中断")
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
