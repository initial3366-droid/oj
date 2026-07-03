# QOJ Judge Docker Image

用于安全隔离执行用户代码的 Docker 镜像。

## 构建镜像

```bash
cd docker/judge
docker build -t qoj-judge:latest .
```

## 特性

- 基于 Ubuntu 22.04
- 包含 C/C++、Java、Python 编译器和运行时
- 使用非特权用户 `judge` (UID 1000)
- 配合 Docker 运行时参数实现完整隔离：
  - `--network none` - 禁止网络访问
  - `--memory` - 限制内存
  - `--cpus` - 限制 CPU
  - `--pids-limit` - 限制进程数
  - 只读文件系统挂载

## 支持的语言

- C++ (g++ 11.4)
- C (gcc 11.4)
- Java (OpenJDK 17)
- Python (Python 3.10)

## 使用示例

```bash
# 编译 C++ 代码
docker run --rm --network none -v $(pwd):/workspace qoj-judge:latest \
  g++ -std=c++17 -O2 /workspace/main.cpp -o /workspace/main

# 运行程序（带资源限制）
docker run --rm --network none \
  --memory 256m --cpus 1 --pids-limit 32 \
  -v $(pwd):/workspace:ro \
  qoj-judge:latest \
  /workspace/main < input.txt
```

## 安全特性

1. **网络隔离** - `--network none` 完全禁止网络访问
2. **内存限制** - `--memory` 和 `--memory-swap` 强制限制内存使用
3. **CPU 限制** - `--cpus` 限制 CPU 核心数
4. **进程限制** - `--pids-limit` 防止 fork 炸弹
5. **文件系统隔离** - 只读挂载用户代码目录
6. **非特权用户** - 容器内以 UID 1000 的普通用户运行
7. **时间限制** - 通过 ProcessBuilder 的 waitFor 超时控制

## 与 LocalJudgeService 的对比

| 特性 | LocalJudgeService | DockerJudgeService |
|------|-------------------|---------------------|
| 网络隔离 | ❌ 无 | ✅ 完全隔离 |
| 内存限制 | ❌ 无 | ✅ 强制限制 |
| CPU 限制 | ❌ 无 | ✅ 强制限制 |
| 进程限制 | ❌ 无 | ✅ 强制限制 |
| 文件系统隔离 | ❌ 无 | ✅ 只读挂载 |
| 生产环境可用 | ❌ 严禁使用 | ✅ 推荐使用 |
