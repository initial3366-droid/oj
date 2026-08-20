#!/usr/bin/env python3
"""
QOJ 压力测试脚本
模拟多用户同时参赛并提交代码的场景
"""
import asyncio
import aiohttp
import time
import json
import random
import os
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime
import statistics


@dataclass
class TestConfig:
    """测试配置"""
    base_url: str  # OJ 网站地址，例如: http://localhost:8080
    contest_id: int  # 比赛ID
    problem_id: int  # 题目ID
    num_users: int = 100  # 模拟用户数量
    username_prefix: str = "testuser"  # 用户名前缀
    password: str = "test123456"  # 统一密码
    # 代理接口只从本地环境变量读取，避免把供应商密钥写入仓库。
    proxy_api: str = os.getenv("QOJ_PROXY_API_URL", "")
    use_proxy: bool = True  # 是否使用代理
    concurrent_batch: int = 20  # 每批并发数量（避免过载）


@dataclass
class UserResult:
    """单个用户测试结果"""
    user_id: int
    username: str
    login_success: bool
    login_time: float
    register_success: bool
    register_time: float
    submit_success: bool
    submit_time: float
    total_time: float
    error_msg: Optional[str] = None


class ProxyPool:
    """代理池管理"""

    def __init__(self, proxy_api: str):
        self.proxy_api = proxy_api
        self.proxies: List[Dict[str, str]] = []
        self.current_index = 0
        self.lock = asyncio.Lock()

    async def fetch_proxies(self, session: aiohttp.ClientSession):
        """获取代理列表"""
        try:
            async with session.get(self.proxy_api, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                text = await resp.text()
                lines = text.strip().split('\n')

                for line in lines:
                    parts = line.strip().split()
                    if len(parts) >= 3:
                        ip_port, username, password = parts[0], parts[1], parts[2]
                        proxy_url = f"http://{username}:{password}@{ip_port}"
                        self.proxies.append({"http": proxy_url, "https": proxy_url})

                print(f"✓ 获取到 {len(self.proxies)} 个代理")
        except Exception as e:
            print(f"✗ 获取代理失败: {e}")

    async def get_proxy(self) -> Optional[Dict[str, str]]:
        """轮询获取代理"""
        async with self.lock:
            if not self.proxies:
                return None
            proxy = self.proxies[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.proxies)
            return proxy


class StressTest:
    """压力测试主类"""

    def __init__(self, config: TestConfig):
        self.config = config
        self.proxy_pool = ProxyPool(config.proxy_api) if config.use_proxy else None
        self.results: List[UserResult] = []
        self.test_start_time = 0
        self.test_end_time = 0

    async def setup(self):
        """初始化测试环境"""
        print("=" * 60)
        print("QOJ 压力测试初始化")
        print("=" * 60)
        print(f"目标地址: {self.config.base_url}")
        print(f"比赛ID: {self.config.contest_id}")
        print(f"题目ID: {self.config.problem_id}")
        print(f"模拟用户数: {self.config.num_users}")
        print(f"使用代理: {'是' if self.config.use_proxy else '否'}")
        print("=" * 60)

        if self.config.use_proxy:
            if not self.config.proxy_api:
                raise ValueError("启用代理时请先设置 QOJ_PROXY_API_URL")
            async with aiohttp.ClientSession() as session:
                # 获取足够的代理
                needed_batches = (self.config.num_users + 9) // 10
                for i in range(needed_batches):
                    await self.proxy_pool.fetch_proxies(session)
                    if i < needed_batches - 1:
                        await asyncio.sleep(1)  # 避免频繁调用代理API

    async def test_user(self, user_id: int, session: aiohttp.ClientSession) -> UserResult:
        """测试单个用户的完整流程"""
        username = f"{self.config.username_prefix}{user_id}"
        result = UserResult(
            user_id=user_id,
            username=username,
            login_success=False,
            login_time=0,
            register_success=False,
            register_time=0,
            submit_success=False,
            submit_time=0,
            total_time=0
        )

        start_time = time.time()
        proxy = await self.proxy_pool.get_proxy() if self.proxy_pool else None

        try:
            # 1. 登录（如果失败则不继续）
            token, login_time = await self._login(session, username, proxy)
            result.login_time = login_time
            result.login_success = token is not None

            if not token:
                result.error_msg = "登录失败"
                result.total_time = time.time() - start_time
                return result

            # 2. 注册比赛
            register_success, register_time = await self._register_contest(session, token, proxy)
            result.register_time = register_time
            result.register_success = register_success

            # 3. 提交代码（无论是否注册成功都尝试）
            submit_success, submit_time = await self._submit_code(session, token, proxy)
            result.submit_time = submit_time
            result.submit_success = submit_success

        except Exception as e:
            result.error_msg = str(e)

        result.total_time = time.time() - start_time
        return result

    async def _login(self, session: aiohttp.ClientSession, username: str, proxy: Optional[Dict]) -> tuple[Optional[str], float]:
        """登录获取token"""
        url = f"{self.config.base_url}/api/v1/auth/login"
        payload = {
            "username": username,
            "password": self.config.password
        }

        start = time.time()
        try:
            async with session.post(
                url,
                json=payload,
                proxy=proxy.get("http") if proxy else None,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                elapsed = time.time() - start
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("code") == 200:
                        return data.get("data", {}).get("accessToken"), elapsed
                return None, elapsed
        except Exception as e:
            return None, time.time() - start

    async def _register_contest(self, session: aiohttp.ClientSession, token: str, proxy: Optional[Dict]) -> tuple[bool, float]:
        """注册比赛"""
        url = f"{self.config.base_url}/api/v1/contests/{self.config.contest_id}/register"
        payload = {
            "identityType": None,
            "identityId": None,
            "starred": False,
            "password": None
        }
        headers = {"Authorization": f"Bearer {token}"}

        start = time.time()
        try:
            async with session.post(
                url,
                json=payload,
                headers=headers,
                proxy=proxy.get("http") if proxy else None,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                elapsed = time.time() - start
                return resp.status == 200, elapsed
        except Exception:
            return False, time.time() - start

    async def _submit_code(self, session: aiohttp.ClientSession, token: str, proxy: Optional[Dict]) -> tuple[bool, float]:
        """提交代码"""
        url = f"{self.config.base_url}/api/v1/submissions"

        # 简单的AC代码示例（C++）
        code = """#include <iostream>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}"""

        payload = {
            "problemId": self.config.problem_id,
            "contestId": self.config.contest_id,
            "practiceId": None,
            "code": code,
            "language": "C++",
            "identityType": None,
            "identityId": None
        }
        headers = {"Authorization": f"Bearer {token}"}

        start = time.time()
        try:
            async with session.post(
                url,
                json=payload,
                headers=headers,
                proxy=proxy.get("http") if proxy else None,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                elapsed = time.time() - start
                return resp.status == 200, elapsed
        except Exception:
            return False, time.time() - start

    async def run_batch(self, batch_users: List[int]):
        """运行一批用户测试"""
        async with aiohttp.ClientSession() as session:
            tasks = [self.test_user(user_id, session) for user_id in batch_users]
            batch_results = await asyncio.gather(*tasks)
            self.results.extend(batch_results)

    async def run(self):
        """执行压力测试"""
        await self.setup()

        print("\n开始压力测试...")
        self.test_start_time = time.time()

        # 分批执行，避免瞬间并发过高
        user_ids = list(range(1, self.config.num_users + 1))
        batches = [
            user_ids[i:i + self.config.concurrent_batch]
            for i in range(0, len(user_ids), self.config.concurrent_batch)
        ]

        for i, batch in enumerate(batches):
            print(f"执行第 {i+1}/{len(batches)} 批 ({len(batch)} 个用户)...")
            await self.run_batch(batch)

            # 批次间稍微延迟，给服务器喘息机会
            if i < len(batches) - 1:
                await asyncio.sleep(0.5)

        self.test_end_time = time.time()

        self.print_report()
        self.save_report()

    def print_report(self):
        """打印测试报告"""
        total_time = self.test_end_time - self.test_start_time

        login_success = sum(1 for r in self.results if r.login_success)
        register_success = sum(1 for r in self.results if r.register_success)
        submit_success = sum(1 for r in self.results if r.submit_success)

        login_times = [r.login_time for r in self.results if r.login_success]
        register_times = [r.register_time for r in self.results if r.register_success]
        submit_times = [r.submit_time for r in self.results if r.submit_success]
        total_times = [r.total_time for r in self.results]

        print("\n" + "=" * 60)
        print("压力测试报告")
        print("=" * 60)
        print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"总耗时: {total_time:.2f}秒")
        print(f"吞吐量: {self.config.num_users / total_time:.2f} 用户/秒")
        print("-" * 60)

        print(f"\n【成功率统计】")
        print(f"登录成功: {login_success}/{self.config.num_users} ({login_success/self.config.num_users*100:.1f}%)")
        print(f"注册成功: {register_success}/{self.config.num_users} ({register_success/self.config.num_users*100:.1f}%)")
        print(f"提交成功: {submit_success}/{self.config.num_users} ({submit_success/self.config.num_users*100:.1f}%)")

        if login_times:
            print(f"\n【登录性能】")
            print(f"  平均: {statistics.mean(login_times):.3f}秒")
            print(f"  中位数: {statistics.median(login_times):.3f}秒")
            print(f"  最小: {min(login_times):.3f}秒")
            print(f"  最大: {max(login_times):.3f}秒")

        if register_times:
            print(f"\n【注册比赛性能】")
            print(f"  平均: {statistics.mean(register_times):.3f}秒")
            print(f"  中位数: {statistics.median(register_times):.3f}秒")
            print(f"  最小: {min(register_times):.3f}秒")
            print(f"  最大: {max(register_times):.3f}秒")

        if submit_times:
            print(f"\n【提交性能】")
            print(f"  平均: {statistics.mean(submit_times):.3f}秒")
            print(f"  中位数: {statistics.median(submit_times):.3f}秒")
            print(f"  最小: {min(submit_times):.3f}秒")
            print(f"  最大: {max(submit_times):.3f}秒")

        print(f"\n【整体性能】")
        print(f"  平均: {statistics.mean(total_times):.3f}秒")
        print(f"  中位数: {statistics.median(total_times):.3f}秒")
        print(f"  最小: {min(total_times):.3f}秒")
        print(f"  最大: {max(total_times):.3f}秒")

        errors = [r for r in self.results if r.error_msg]
        if errors:
            print(f"\n【错误详情】({len(errors)}个)")
            error_counts = {}
            for r in errors:
                error_counts[r.error_msg] = error_counts.get(r.error_msg, 0) + 1
            for err, count in sorted(error_counts.items(), key=lambda x: x[1], reverse=True):
                print(f"  {err}: {count}次")

        print("=" * 60)

    def save_report(self):
        """保存详细报告到JSON文件"""
        report = {
            "config": asdict(self.config),
            "summary": {
                "total_users": self.config.num_users,
                "total_time": self.test_end_time - self.test_start_time,
                "login_success": sum(1 for r in self.results if r.login_success),
                "register_success": sum(1 for r in self.results if r.register_success),
                "submit_success": sum(1 for r in self.results if r.submit_success),
            },
            "results": [asdict(r) for r in self.results]
        }

        filename = f"stress_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"\n详细报告已保存至: {filename}")


async def main():
    """主函数"""
    # 配置参数 - 请修改以下配置
    config = TestConfig(
        base_url="http://localhost:8080",  # 修改为你的OJ地址
        contest_id=1,  # 修改为实际的比赛ID
        problem_id=1,  # 修改为实际的题目ID
        num_users=100,  # 模拟用户数量
        username_prefix="testuser",  # 用户名前缀
        password="test123456",  # 统一密码
        use_proxy=True,  # 是否使用代理
        concurrent_batch=20  # 每批并发数
    )

    test = StressTest(config)
    await test.run()


if __name__ == "__main__":
    asyncio.run(main())
