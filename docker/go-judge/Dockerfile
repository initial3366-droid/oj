# Release binaries can silently omit seccomp support. Build the pinned module
# explicitly with its seccomp tag; Go verifies dependencies through go.sum.
FROM public.ecr.aws/docker/library/golang:1.25.0-bookworm@sha256:81dc45d05a7444ead8c92a389621fafabc8e40f8fd1a19d7e5df14e61e98bc1a AS judge-builder
ARG GO_JUDGE_VERSION=1.12.1
RUN CGO_ENABLED=0 go install -tags seccomp github.com/criyle/go-judge/cmd/go-judge@v${GO_JUDGE_VERSION}

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
        util-linux \
        gcc \
        g++ \
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

# Copy only the explicitly seccomp-enabled worker into the runtime image.
COPY --from=judge-builder /go/bin/go-judge /usr/local/bin/go-judge

# Java compilation uses a fixed image-owned helper. The
# REST request never supplies shell text or file names in command arguments.
COPY qoj-java-compile /usr/local/bin/qoj-java-compile
RUN chmod 0755 /usr/local/bin/qoj-java-compile

# No language toolchain needs setuid/setgid executables.
RUN find /usr /bin /sbin -xdev -type f \( -perm -4000 -o -perm -2000 \) -exec chmod a-s {} +
COPY seccomp.yaml /etc/qoj/seccomp.yaml
COPY qoj-entrypoint /usr/local/bin/qoj-entrypoint
RUN chmod 0755 /usr/local/bin/qoj-entrypoint && chmod 0644 /etc/qoj/seccomp.yaml

EXPOSE 5050
ENTRYPOINT ["/usr/local/bin/qoj-entrypoint"]
