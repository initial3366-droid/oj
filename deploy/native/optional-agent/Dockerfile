FROM mcr.microsoft.com/powershell:7.4-alpine-3.20
RUN apk add --no-cache openjdk17-jre-headless \
    && mkdir -p /app /var/lib/qoj-agent/workspaces \
    && chown -R 65534:65534 /var/lib/qoj-agent
WORKDIR /app
COPY --chown=65534:65534 qoj-agent.jar /app/app.jar
USER nobody
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=65", "-jar", "/app/app.jar"]
