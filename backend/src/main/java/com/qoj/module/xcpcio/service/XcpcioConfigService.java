package com.qoj.module.xcpcio.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.xcpcio.dto.XcpcioConfigRequest;
import com.qoj.module.xcpcio.entity.ContestXcpcioConfig;
import com.qoj.module.xcpcio.entity.ContestXcpcioSyncLog;
import com.qoj.module.xcpcio.mapper.ContestXcpcioConfigMapper;
import com.qoj.module.xcpcio.mapper.ContestXcpcioSyncLogMapper;
import com.qoj.module.xcpcio.vo.XcpcioConfigVO;
import com.qoj.module.xcpcio.vo.XcpcioPublicConfigVO;
import com.qoj.module.xcpcio.vo.XcpcioSyncLogVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.ContestAccessPolicy;
import com.qoj.security.policy.Permission;
import java.net.URI;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Xcpcio配置业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class XcpcioConfigService {
    public static final String MODE_CLICS_EXPORT = "CLICS_EXPORT";
    public static final String MODE_XCPCIO_PUSH = "XCPCIO_PUSH";
    public static final String STATUS_DISABLED = "DISABLED";
    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_SYNCING = "SYNCING";
    public static final String STATUS_OK = "OK";
    public static final String STATUS_FAILED = "FAILED";

    private final ContestXcpcioConfigMapper configMapper;
    private final ContestXcpcioSyncLogMapper syncLogMapper;
    private final ContestMapper contestMapper;
    private final ContestAccessPolicy contestAccessPolicy;
    private final XcpcioSecretCipher secretCipher;

    /**
     * 构造 Xcpcio配置Service 实例并保存其必要依赖或初始状态。调用前会结合当前登录身份执行权限判断；从持久化层读取数据。
     */
    public XcpcioConfigService(
        ContestXcpcioConfigMapper configMapper,
        ContestXcpcioSyncLogMapper syncLogMapper,
        ContestMapper contestMapper,
        ContestAccessPolicy contestAccessPolicy,
        XcpcioSecretCipher secretCipher
    ) {
        this.configMapper = configMapper;
        this.syncLogMapper = syncLogMapper;
        this.contestMapper = contestMapper;
        this.contestAccessPolicy = contestAccessPolicy;
        this.secretCipher = secretCipher;
    }

    public XcpcioConfigVO getAdminConfig(Long contestId) {
        Contest contest = requireContest(contestId);
        requireManage(contest);
        ContestXcpcioConfig config = findByContestId(contestId);
        /**
         * 构造或转换管理员VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toAdminVO(contestId, config == null ? defaultConfig(contestId) : config);
    }

    @Transactional
    public XcpcioConfigVO updateConfig(Long contestId, XcpcioConfigRequest request) {
        Contest contest = requireContest(contestId);
        AuthUser user = requireManage(contest);
        ContestXcpcioConfig config = findByContestId(contestId);
        boolean insert = config == null;
        if (insert) {
            config = defaultConfig(contestId);
            config.createdAt = LocalDateTime.now();
        }

        if (request.enabled() != null) {
            config.enabled = request.enabled();
        }
        config.mode = normalizeMode(request.mode() == null ? config.mode : request.mode());
        if (request.xcpcioContestId() != null) {
            config.xcpcioContestId = blankToNull(request.xcpcioContestId());
        }
        if (request.token() != null && !request.token().isBlank()) {
            config.tokenEncrypted = secretCipher.encrypt(request.token().trim());
        }
        if (request.boardUrl() != null) {
            config.boardUrl = normalizeBoardUrl(request.boardUrl());
        }
        if (request.clicsAccessToken() != null) {
            config.clicsAccessToken = blankToNull(request.clicsAccessToken());
        }
        if (request.syncEnabled() != null) {
            config.syncEnabled = request.syncEnabled();
        }
        if (request.syncIntervalSeconds() != null) {
            config.syncIntervalSeconds = Math.max(5, request.syncIntervalSeconds());
        }
        config.status = Boolean.TRUE.equals(config.enabled) ? normalizeActiveStatus(config.status) : STATUS_DISABLED;
        config.updatedBy = user.id();

        if (insert) {
            configMapper.insert(config);
        } else {
            configMapper.updateById(config);
        }
        /**
         * 构造或转换管理员VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toAdminVO(contestId, config);
    }

    public XcpcioPublicConfigVO getPublicConfig(Long contestId) {
        Contest contest = requireContest(contestId);
        if (Boolean.TRUE.equals(contest.isDeleted)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }
        ContestXcpcioConfig config = findByContestId(contestId);
        if (config == null || !Boolean.TRUE.equals(config.enabled)) {
            /**
             * 封装XcpcioPublic配置VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new XcpcioPublicConfigVO(contestId, false, MODE_CLICS_EXPORT, null, false, STATUS_DISABLED, null);
        }
        String boardUrl = blankToNull(config.boardUrl);
        /**
         * 封装XcpcioPublic配置VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new XcpcioPublicConfigVO(
            contestId,
            true,
            config.mode == null ? MODE_CLICS_EXPORT : config.mode,
            boardUrl,
            boardUrl != null,
            config.status == null ? STATUS_PENDING : config.status,
            clicsScoreboardUrl(contestId)
        );
    }

    public List<XcpcioSyncLogVO> listLogs(Long contestId) {
        Contest contest = requireContest(contestId);
        requireManage(contest);
        return syncLogMapper.selectList(
                new QueryWrapper<ContestXcpcioSyncLog>()
                    .eq("contest_id", contestId)
                    .orderByDesc("started_at")
                    .last("LIMIT 50")
            )
            .stream()
            .map(this::toLogVO)
            .toList();
    }

    public ContestXcpcioConfig findByContestId(Long contestId) {
        if (contestId == null) {
            return null;
        }
        return configMapper.selectOne(
            new QueryWrapper<ContestXcpcioConfig>().eq("contest_id", contestId).last("LIMIT 1")
        );
    }

    public void requireClicsAccess(Long contestId, String accessToken, String authorizationHeader) {
        ContestXcpcioConfig config = findByContestId(contestId);
        if (config == null || !Boolean.TRUE.equals(config.enabled)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "该比赛未启用 XCPCIO/CLICS 榜单导出");
        }
        String requiredToken = blankToNull(config.clicsAccessToken);
        if (requiredToken == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "CLICS 导出未配置访问 token，已拒绝公开访问");
        }
        String actual = clicsActualToken(accessToken, authorizationHeader);
        if (actual == null || !constantTimeEquals(requiredToken, actual)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.UNAUTHORIZED, "CLICS 导出访问 token 无效");
        }
    }

    public List<Long> accessibleClicsContestIds(String accessToken, String authorizationHeader) {
        String actual = clicsActualToken(accessToken, authorizationHeader);
        if (actual == null) {
            return List.of();
        }
        return configMapper.selectList(new QueryWrapper<ContestXcpcioConfig>().eq("enabled", true))
            .stream()
            .filter(config -> {
                String required = blankToNull(config.clicsAccessToken);
                return required != null && constantTimeEquals(required, actual);
            })
            .map(config -> config.contestId)
            .filter(java.util.Objects::nonNull)
            .toList();
    }

    public Contest requireContest(Long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }
        return contest;
    }

    public AuthUser requireManage(Contest contest) {
        AuthUser user = CurrentUser.required();
        if (!contestAccessPolicy.can(user, Permission.MANAGE_SCOREBOARD, contest)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权管理该比赛 XCPCIO 榜单");
        }
        return user;
    }

    public XcpcioConfigVO toAdminVO(Long contestId, ContestXcpcioConfig config) {
        return new XcpcioConfigVO(
            contestId,
            Boolean.TRUE.equals(config.enabled),
            config.mode == null ? MODE_CLICS_EXPORT : config.mode,
            config.xcpcioContestId,
            config.tokenEncrypted != null && !config.tokenEncrypted.isBlank(),
            config.clicsAccessToken != null && !config.clicsAccessToken.isBlank(),
            config.boardUrl,
            Boolean.TRUE.equals(config.syncEnabled),
            config.syncIntervalSeconds == null ? 5 : config.syncIntervalSeconds,
            config.status == null ? STATUS_DISABLED : config.status,
            config.lastSyncAt,
            config.lastSuccessAt,
            sanitize(config.lastError),
            config.lastErrorAt,
            config.consecutiveFailures == null ? 0 : config.consecutiveFailures,
            "/api/v1/clics/contests/" + contestId,
            clicsScoreboardUrl(contestId)
        );
    }

    public String sanitize(String message) {
        if (message == null) {
            return null;
        }
        return message
            .replaceAll("(?i)bearer\\s+[A-Za-z0-9._\\-]+", "Bearer ******")
            .replaceAll("(?i)(token|access_token)=([^\\s&]+)", "$1=******");
    }

    private XcpcioSyncLogVO toLogVO(ContestXcpcioSyncLog log) {
        /**
         * 封装XcpcioSyncLogVO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new XcpcioSyncLogVO(
            log.id,
            log.contestId,
            log.syncType,
            log.status,
            log.startedAt,
            log.finishedAt,
            log.pushedSubmissions,
            log.httpStatus,
            sanitize(log.errorMessage)
        );
    }

    private ContestXcpcioConfig defaultConfig(Long contestId) {
        ContestXcpcioConfig config = new ContestXcpcioConfig();
        config.contestId = contestId;
        config.enabled = false;
        config.mode = MODE_CLICS_EXPORT;
        config.syncEnabled = false;
        config.syncIntervalSeconds = 5;
        config.status = STATUS_DISABLED;
        config.consecutiveFailures = 0;
        return config;
    }

    private String normalizeMode(String mode) {
        String value = mode == null || mode.isBlank() ? MODE_CLICS_EXPORT : mode.trim().toUpperCase();
        if (!MODE_CLICS_EXPORT.equals(value) && !MODE_XCPCIO_PUSH.equals(value)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "同步模式必须是 CLICS_EXPORT 或 XCPCIO_PUSH");
        }
        return value;
    }

    private String normalizeActiveStatus(String status) {
        if (STATUS_OK.equals(status) || STATUS_SYNCING.equals(status) || STATUS_FAILED.equals(status)) {
            return status;
        }
        return STATUS_PENDING;
    }

    private String normalizeBoardUrl(String boardUrl) {
        String value = blankToNull(boardUrl);
        if (value == null) {
            return null;
        }
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                /**
                 * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new IllegalArgumentException();
            }
            if (uri.getHost() == null || value.length() > 512) {
                /**
                 * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new IllegalArgumentException();
            }
            return value;
        } catch (Exception ex) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "boardUrl 必须是有效的 http/https 地址");
        }
    }

    private String clicsScoreboardUrl(Long contestId) {
        return "/api/v1/clics/contests/" + contestId + "/scoreboard";
    }

    private String clicsActualToken(String accessToken, String authorizationHeader) {
        String actual = blankToNull(accessToken);
        if (actual == null && authorizationHeader != null) {
            if (authorizationHeader.startsWith("Bearer ")) {
                actual = blankToNull(authorizationHeader.substring("Bearer ".length()));
            } else if (authorizationHeader.startsWith("Basic ")) {
                actual = basicAuthPassword(authorizationHeader);
            }
        }
        return actual;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean constantTimeEquals(String expected, String actual) {
        return MessageDigest.isEqual(expected.getBytes(java.nio.charset.StandardCharsets.UTF_8),
            actual.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private String basicAuthPassword(String authorizationHeader) {
        try {
            String encoded = authorizationHeader.substring("Basic ".length()).trim();
            String decoded = new String(Base64.getDecoder().decode(encoded), java.nio.charset.StandardCharsets.UTF_8);
            int separator = decoded.indexOf(':');
            if (separator < 0) {
                return null;
            }
            /**
             * 封装blankToNull相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return blankToNull(decoded.substring(separator + 1));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
