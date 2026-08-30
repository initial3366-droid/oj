# QOJ 后端镜像：Maven 多阶段构建，运行层仅含 JRE 与应用 JAR。
# syntax=docker/dockerfile:1

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

# 可选 Maven 中央仓库镜像，国内网络可传入 https://repo.huaweicloud.com/repository/maven。
ARG MAVEN_MIRROR_URL=""
RUN if [ -n "$MAVEN_MIRROR_URL" ]; then \
      mkdir -p /root/.m2 \
      && printf '<settings><mirrors><mirror><id>mirror</id><url>%s</url><mirrorOf>central</mirrorOf></mirror></mirrors></settings>' \
         "$MAVEN_MIRROR_URL" > /root/.m2/settings.xml; \
    fi

# 先只复制 pom 下载依赖，源码变更时命中缓存层，显著加速反复构建。
COPY pom.xml ./
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:17-jre-jammy
# curl 供健康检查使用；应用以非 root 运行，日志目录挂载命名卷。
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --home-dir /app --shell /usr/sbin/nologin qoj \
 && mkdir -p /app/logs \
 && chown -R qoj:qoj /app

WORKDIR /app
COPY --from=build /build/target/qoj-backend-*.jar app.jar

USER qoj
ENV SERVER_PORT=18080 \
    LOG_PATH=/app/logs
EXPOSE 18080

# 不带 -f：Tomcat 对任意 HTTP 状态有响应即视为存活（部分路径本就要求鉴权）。
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=10 \
  CMD curl -s -o /dev/null http://127.0.0.1:18080/ || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
