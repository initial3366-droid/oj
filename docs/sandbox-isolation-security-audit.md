# 沙箱隔离核查与修复（2026-10-25）

附件证明了沙箱内启动子进程，未证明宿主机逃逸。判题系统的职责是运行不可信代码，安全结论应依据隔离边界，不能仅依据 shell 输出。报告将“无 no_new_privs”作为根因也缺少证据：本地实际进程为 `NoNewPrivs: 1`。

## 确认的问题与修复

1. 现有本地 worker 进程为 `Seccomp: 0`。其二进制未编译 seccomp 支持，上游在此构建模式下会静默忽略策略路径。Dockerfile 改为固定模块版本、显式 `-tags seccomp` 构建；构建与运行基础镜像固定摘要。
2. 上游使用 `NoSetGroups: true`，会保留继承的附加组。启动入口通过 `setpriv --clear-groups` 清除附加组。本地验证执行进程不含 root 组。
3. 新增沙箱内核策略，终止 ptrace、跨进程内存、挂载/命名空间操作、BPF、keyring、内核模块、perf、userfaultfd、io_uring 等高风险调用；连接/监听网络返回 EPERM。保留正常编译器和 JVM 所需的 exec/clone，进程数仍受 cgroup 限制。
4. 移除镜像内可执行文件的 setuid/setgid 位，入口要求策略文件存在。新镜像标签为 `qoj-go-judge:seccomp-1.12.1`，compose 已使用新标签。

没有通过关键词过滤源码或篡改输出阻止信息回显，没有移除普通学生调试功能。现有调试用户/全局速率与并发限制仍在。

## 实际验证

- 完整 Dockerfile 构建成功。
- `python3 tools/verify-sandbox-isolation.py`：完整新镜像内的 11 项隔离/兼容性检查，加临时真实后端的 5 项业务 API 检查，共 16 项通过。
- 验证执行进程非 root、附加组为空、CapEff 为 0、NoNewPrivs 为 1、Seccomp 为 2。
- C/C++ 编译运行、Java 编译与 JVM、Python 正常；ptrace 与 unshare 返回 Dangerous Syscall，连接网络被拒，宿主敏感路径不可见，工具链挂载只读，临时文件不跨运行持久化。
- `/api/v1/sandbox/run`：匿名拒绝，普通 Python 返回 AC，危险调用返回 RE。
- `/api/v1/submissions`：正常 C 提交完成 AC，危险 Python 提交完成 RE。使用临时数据库、账户及 Redis DB15，不接触生产数据。
- 对完整镜像扫描 `/usr /bin /sbin`，未发现 setuid/setgid 文件。
- 既有 `python3 tools/verify-judge-security-http.py` 9 项通过。这组使用受控模拟 worker 验证后端队列/超时等；上面的 16 项才是本次真实 worker 的证据。
- 后端现有测试 189 项通过，无失败/错误；未新增单元测试。

可重复执行命令与运行前提见 `docker/go-judge/README.md`。结果位于 `.runtime/security-remediation/sandbox-isolation-report.json`、`judge-http-report.json`。

## 尚未执行

未替换原有本地 worker，未部署公网生产，未尝试内核逃逸。上线需要重建并重新创建 worker，而不只是重启后端。生产判题节点仍应部署在独立主机/虚拟机，不携带业务凭据；这次加固不构成对所有内核漏洞的安全保证。
