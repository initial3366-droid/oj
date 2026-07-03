FROM ubuntu:22.04

RUN sed -i 's|http://archive.ubuntu.com/ubuntu|http://mirrors.aliyun.com/ubuntu|g; s|http://security.ubuntu.com/ubuntu|http://mirrors.aliyun.com/ubuntu|g' /etc/apt/sources.list
RUN printf 'Acquire::Retries "5";\nAcquire::http::Timeout "60";\nAcquire::https::Timeout "60";\n' > /etc/apt/apt.conf.d/80-retries

# 安装编译器和运行时
RUN apt-get update && \
    apt-get install -y --fix-missing --no-install-recommends \
    g++ \
    gcc \
    openjdk-17-jdk-headless \
    python3 \
    python3-pip \
    time \
    && rm -rf /var/lib/apt/lists/*

# 创建非特权用户
RUN useradd -m -u 1000 -s /bin/bash judge && \
    mkdir -p /workspace && \
    chown judge:judge /workspace

# 切换到非特权用户
USER judge
WORKDIR /workspace

# 设置资源限制
RUN ulimit -s unlimited

CMD ["/bin/bash"]
