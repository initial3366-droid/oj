# Java Agent replaces the isolated Go Agent while keeping its network and execution boundary.
# syntax=docker/dockerfile:1

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

FROM mcr.microsoft.com/powershell:7.4-alpine-3.20
RUN apk add --no-cache openjdk17-jre-headless \
 && mkdir -p /app /var/lib/qoj-agent/workspaces \
 && chown -R 65534:65534 /var/lib/qoj-agent
WORKDIR /app
COPY --from=build --chown=65534:65534 /build/target/qoj-agent-0.1.0.jar app.jar
USER nobody
ENV AGENT_PORT=19090 \
    AGENT_WORKSPACE_ROOT=/var/lib/qoj-agent/workspaces
EXPOSE 19090
ENTRYPOINT ["java", "-jar", "app.jar"]
