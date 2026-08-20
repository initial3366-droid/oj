# QOJ 压力测试脚本使用说明

## 功能特性

- ✅ 模拟多用户同时参赛并提交代码
- ✅ 支持代理池轮询（避免IP限制）
- ✅ 分批并发控制（避免瞬间过载）
- ✅ 完整的性能报告（成功率、响应时间统计）
- ✅ 详细的JSON报告输出
- ✅ 支持配置文件

## 文件说明

- `stress_test.py` - 独立版本，配置写在代码中
- `stress_test_with_config.py` - 配置文件版本，推荐使用
- `stress_test_config.json` - 配置文件模板

## 环境要求

Python 3.7+ 和 aiohttp 库：

```bash
pip3 install aiohttp
```

## 快速开始

### 1. 修改配置文件

编辑 `stress_test_config.json`：

```json
{
  "base_url": "https://your-oj-domain.com",  // 你的OJ网站地址
  "contest_id": 1,                            // 比赛ID
  "problem_id": 1,                            // 题目ID
  "num_users": 100,                           // 模拟用户数量
  "username_prefix": "testuser",              // 用户名前缀
  "password": "test123456",                   // 统一密码
"use_proxy": true,                          // 是否使用代理
"concurrent_batch": 20                      // 每批并发数
}
```

启用代理时，将代理接口地址（包括密钥）只放在本地环境变量中，不要写入配置文件或提交到 Git：

```bash
export QOJ_PROXY_API_URL='https://your-proxy-provider.example/api/proxy?...'
```

### 2. 准备测试账号

脚本会尝试登录 `testuser1` 到 `testuser100` (根据配置)，你需要：

**方式1：批量创建用户**
```bash
# 使用你的后台管理接口批量创建用户
# 或者使用数据库脚本批量插入
```

**方式2：修改用户名前缀和范围**
如果你已有用户账号，修改配置中的 `username_prefix` 和 `num_users`。

### 3. 运行测试

```bash
# 使用配置文件运行（推荐）
python3 stress_test_with_config.py

# 或指定配置文件路径
python3 stress_test_with_config.py my_config.json

# 使用独立版本（需要修改代码中的配置）
python3 stress_test.py
```

## 配置说明

### base_url
OJ网站的基础地址，例如：
- 本地测试: `http://localhost:8080`
- 生产环境: `https://oj.example.com`

### contest_id 和 problem_id
- 在浏览器中打开比赛和题目页面，从URL中获取ID
- 例如 `/contests/123/problems/456` 中，contest_id=123, problem_id=456

### num_users
模拟的并发用户数量，建议：
- 小规模测试: 10-50
- 中规模测试: 50-100
- 大规模测试: 100-500

### username_prefix
用户名前缀，脚本会自动加上数字后缀：
- `testuser` → `testuser1`, `testuser2`, ...
- `user` → `user1`, `user2`, ...

### password
所有测试账号的统一密码

### use_proxy
是否使用代理池：
- `true`: 使用代理池（地址从 `QOJ_PROXY_API_URL` 或本地配置读取）
- `false`: 直连（适合内网测试）

### concurrent_batch
每批并发的用户数量，用于控制瞬时压力：
- 较小值(10-20): 更平滑，对服务器友好
- 较大值(50-100): 更激进，测试峰值性能

## 测试流程

每个模拟用户执行以下步骤：

1. **登录** - POST `/api/v1/auth/login`
2. **注册比赛** - POST `/api/v1/contests/{id}/register`
3. **提交代码** - POST `/api/v1/submissions`

脚本会记录每个步骤的响应时间和成功率。

## 报告解读

### 终端输出示例

```
============================================================
QOJ 压力测试初始化
============================================================
目标地址: https://oj.example.com
比赛ID: 1
题目ID: 1
模拟用户数: 100
用户名格式: testuser1 ~ testuser100
使用代理: 是
并发批次: 20
============================================================
✓ 获取到 10 个代理
✓ 获取到 10 个代理
...

执行第 1/5 批 (20 个用户)...
执行第 2/5 批 (20 个用户)...
...

============================================================
压力测试报告
============================================================
测试时间: 2026-08-19 14:30:00
总耗时: 12.34秒
吞吐量: 8.10 用户/秒
------------------------------------------------------------

【成功率统计】
登录成功: 98/100 (98.0%)
注册成功: 97/100 (97.0%)
提交成功: 95/100 (95.0%)

【登录性能】
  平均: 0.456秒
  中位数: 0.423秒
  最小: 0.234秒
  最大: 1.234秒

【注册比赛性能】
  平均: 0.234秒
  中位数: 0.212秒
  最小: 0.123秒
  最大: 0.567秒

【提交性能】
  平均: 0.678秒
  中位数: 0.645秒
  最小: 0.456秒
  最大: 1.890秒

【整体性能】
  平均: 1.368秒
  中位数: 1.280秒
  最小: 0.813秒
  最大: 3.691秒

【错误详情】(5个)
  登录失败: 2次
  Connection timeout: 3次
============================================================

详细报告已保存至: stress_test_report_20260819_143000.json
```

### JSON报告

生成的JSON文件包含：
- `config`: 完整的测试配置
- `summary`: 汇总统计
- `results`: 每个用户的详细结果

可以用于：
- 数据分析和可视化
- 性能趋势对比
- 问题排查

## 常见问题

### Q1: 提示"登录失败"
**原因**: 测试账号不存在或密码错误
**解决**: 
- 检查用户是否已创建
- 确认密码配置正确
- 尝试手动登录一个账号验证

### Q2: 大量"Connection timeout"
**原因**: 
- 服务器负载过高
- 网络不稳定
- 并发数过大

**解决**:
- 减少 `num_users` 或 `concurrent_batch`
- 增加批次间延迟（修改代码中的 `asyncio.sleep(0.5)`）
- 检查服务器资源

### Q3: 代理获取失败
**原因**: 
- 代理API配额不足
- 网络问题

**解决**:
- 设置 `use_proxy: false` 改用直连
- 检查代理API是否可用
- 减少并发数，降低代理需求

### Q4: Redis锁冲突
**原因**: 提交接口有Redis锁保护，高并发时可能冲突

**解决**:
- 这是正常的保护机制
- 适当降低 `concurrent_batch`
- 增加批次间延迟

### Q5: 提交成功但注册失败
**原因**: 比赛可能允许未注册用户提交（取决于配置）

**说明**: 这不一定是问题，查看业务逻辑确认是否符合预期

## 高级用法

### 测试不同代码

修改 `_submit_code` 方法中的 `code` 变量：

```python
# 测试不同语言
code = """
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello");
    }
}
"""
payload["language"] = "Java"
```

### 自定义测试流程

在 `test_user` 方法中添加更多步骤：

```python
# 例如：先查看题目详情
problem_detail = await self._get_problem(session, token, proxy)

# 例如：提交后查询结果
submission_result = await self._check_submission(session, token, proxy)
```

### 测试特定场景

```python
# 场景1: 只测试登录性能
# 注释掉注册和提交代码

# 场景2: 测试极限并发
config.concurrent_batch = config.num_users  # 全部同时提交

# 场景3: 持续压测
for round in range(10):
    await test.run()
    await asyncio.sleep(60)  # 每分钟一轮
```

## 注意事项

⚠️ **生产环境测试**
- 提前通知团队，避免影响真实用户
- 选择低峰时段
- 准备好回滚方案
- 监控服务器资源（CPU、内存、数据库连接数）

⚠️ **代理使用**
- 代理API有配额限制，合理使用
- 每次调用返回10个代理，脚本会自动批量获取
- 轮询使用代理，避免单个代理过载

⚠️ **数据清理**
- 测试后及时清理测试数据
- 提交记录、比赛注册记录等
- 避免污染真实数据

## 扩展建议

1. **集成到CI/CD**: 作为性能回归测试的一部分
2. **可视化报告**: 使用 matplotlib 生成图表
3. **实时监控**: 结合 Prometheus/Grafana 监控服务器指标
4. **压测对比**: 记录每次测试结果，对比性能变化
5. **模拟真实场景**: 不同用户提交不同题目、不同语言

## 技术支持

如有问题，检查：
1. Python版本和依赖
2. 网络连接
3. OJ服务状态
4. 配置文件格式

---

**祝测试顺利！** 🚀
