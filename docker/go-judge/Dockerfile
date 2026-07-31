# Docker Official Image mirrored by AWS Public ECR and pinned to a multi-arch digest.
FROM public.ecr.aws/docker/library/debian:bookworm-slim@sha256:60eac759739651111db372c07be67863818726f754804b8707c90979bda511df

ARG GO_JUDGE_VERSION=1.12.1
ARG TARGETARCH

# The image contains only the language toolchains exposed by QOJ's allowlist.
# Package indexes are removed in the same layer to keep the runtime surface small.
RUN set -eu; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i \
        -e 's|https\?://deb.debian.org/debian-security|http://mirrors.huaweicloud.com/debian-security|g' \
        -e 's|https\?://deb.debian.org/debian|http://mirrors.huaweicloud.com/debian|g' \
        /etc/apt/sources.list.d/debian.sources; \
    fi; \
    if [ -f /etc/apt/sources.list ]; then \
      sed -i \
        -e 's|https\?://deb.debian.org/debian-security|http://mirrors.huaweicloud.com/debian-security|g' \
        -e 's|https\?://security.debian.org/debian-security|http://mirrors.huaweicloud.com/debian-security|g' \
        -e 's|https\?://deb.debian.org/debian|http://mirrors.huaweicloud.com/debian|g' \
        /etc/apt/sources.list; \
    fi; \
    apt-get -o Acquire::Retries=10 -o Acquire::http::Timeout=30 update \
    && DEBIAN_FRONTEND=noninteractive apt-get \
        -o Acquire::Retries=10 \
        -o Acquire::http::Timeout=30 \
        install -y --no-install-recommends \
        ca-certificates \
        curl \
        gcc \
        g++ \
        mono-mcs \
        mono-runtime \
        openjdk-17-jdk-headless \
        python3 \
    && rm -rf /var/lib/apt/lists/*

# Debian links JDK configuration into /etc, which is outside go-judge's
# sandbox mount set. Embed dereferenced copies under JAVA_HOME so javac and
# java can load their security policy without exposing the container's /etc.
RUN set -eu; \
    java_home="$(dirname "$(dirname "$(readlink -f /usr/bin/java)")")"; \
    cp -aL "${java_home}/conf" /tmp/qoj-java-conf; \
    rm -rf "${java_home}/conf"; \
    mv /tmp/qoj-java-conf "${java_home}/conf"

# Pin the upstream binary and verify its release checksum before installation.
RUN set -eu; \
    case "${TARGETARCH}" in \
      amd64) asset="go-judge_${GO_JUDGE_VERSION}_linux_amd64v2"; checksum="7d6ef61a43920ec5fde94165c4fa6dcb8520745face0f097517f0b14b2ee94b9" ;; \
      arm64) asset="go-judge_${GO_JUDGE_VERSION}_linux_arm64"; checksum="e688d80a27a5737d89ca763820ea60f1aa1dd2b428a5716e9a5df89912f17425" ;; \
      *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/criyle/go-judge/releases/download/v${GO_JUDGE_VERSION}/${asset}" -o /usr/local/bin/go-judge; \
    echo "${checksum}  /usr/local/bin/go-judge" | sha256sum -c -; \
    chmod 0755 /usr/local/bin/go-judge

# Java compilation and C# process shutdown use fixed image-owned helpers. The
# REST request never supplies shell text or file names in command arguments.
COPY qoj-java-compile /usr/local/bin/qoj-java-compile
COPY qoj-csharp-launcher.cs /tmp/qoj-csharp-launcher.cs
RUN chmod 0755 /usr/local/bin/qoj-java-compile \
    && /usr/bin/mcs -optimize+ \
        -out:/usr/bin/qoj-csharp-launcher.exe \
        /tmp/qoj-csharp-launcher.cs \
    && rm /tmp/qoj-csharp-launcher.cs \
    && mkdir -p /usr/local/lib \
    && ln -sf /usr/bin/qoj-csharp-launcher.exe /usr/local/lib/qoj-csharp-launcher.exe \
    && test -s /usr/bin/qoj-csharp-launcher.exe

EXPOSE 5050
ENTRYPOINT ["/usr/local/bin/go-judge"]
