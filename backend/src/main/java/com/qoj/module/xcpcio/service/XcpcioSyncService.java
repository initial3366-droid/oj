package com.qoj.module.xcpcio.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.xcpcio.entity.ContestXcpcioConfig;
import com.qoj.module.xcpcio.entity.ContestXcpcioSyncLog;
import com.qoj.module.xcpcio.mapper.ContestXcpcioConfigMapper;
import com.qoj.module.xcpcio.mapper.ContestXcpcioSyncLogMapper;
import com.qoj.module.xcpcio.vo.XcpcioConfigVO;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * XcpcioSync业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class XcpcioSyncService {
    private final ContestXcpcioConfigMapper configMapper;
    private final ContestXcpcioSyncLogMapper syncLogMapper;
    private final SubmissionMapper submissionMapper;
    private final XcpcioConfigService configService;
    private final Set<Long> runningContestIds = ConcurrentHashMap.newKeySet();

    /**
     * 构造 XcpcioSyncService 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
    public XcpcioSyncService(
        ContestXcpcioConfigMapper configMapper,
        ContestXcpcioSyncLogMapper syncLogMapper,
        SubmissionMapper submissionMapper,
        XcpcioConfigService configService
    ) {
        this.configMapper = configMapper;
        this.syncLogMapper = syncLogMapper;
        this.submissionMapper = submissionMapper;
        this.configService = configService;
    }

    @Scheduled(fixedDelay = 5000)
    public void syncDueContests() {
        List<ContestXcpcioConfig> configs = configMapper.selectList(
            new QueryWrapper<ContestXcpcioConfig>()
                .eq("enabled", true)
                .eq("sync_enabled", true)
        );
        for (ContestXcpcioConfig config : configs) {
            if (config.contestId == null || shouldBackoff(config)) {
                continue;
            }
            try {
                syncContest(config.contestId, "INCREMENTAL", false);
            } catch (Exception ignored) {
                // 每场比赛的错误已落库，定时任务不向外抛出。
            }
        }
    }

    public XcpcioConfigVO syncContest(Long contestId, String syncType, boolean manual) {
        Contest contest = configService.requireContest(contestId);
        if (manual) {
            configService.requireManage(contest);
        }
        if (!runningContestIds.add(contestId)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.CONFLICT, "该比赛正在同步中");
        }
        LocalDateTime startedAt = LocalDateTime.now();
        ContestXcpcioSyncLog log = new ContestXcpcioSyncLog();
        log.contestId = contestId;
        log.syncType = syncType == null ? "MANUAL" : syncType;
        log.status = "OK";
        log.startedAt = startedAt;
        log.pushedSubmissions = 0;
        syncLogMapper.insert(log);

        ContestXcpcioConfig config = configService.findByContestId(contestId);
        if (config == null || !Boolean.TRUE.equals(config.enabled)) {
            runningContestIds.remove(contestId);
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "该比赛未启用 XCPCIO 榜单");
        }

        try {
            config.status = XcpcioConfigService.STATUS_SYNCING;
            config.lastSyncAt = startedAt;
            configMapper.updateById(config);

            int changed = countChangedSubmissions(contestId, config.lastSuccessAt);
            if (XcpcioConfigService.MODE_XCPCIO_PUSH.equals(config.mode)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.NOT_IMPLEMENTED, "尚未配置 XCPCIO 官方直推 API，请使用 CLICS 导出接口对接 clics-uploader");
            }

            log.pushedSubmissions = changed;
            markSuccess(config);
            finishLog(log, "OK", null, null);
            return configService.toAdminVO(contestId, config);
        } catch (Exception ex) {
            markFailed(config, ex);
            finishLog(log, "FAILED", null, configService.sanitize(ex.getMessage()));
            if (manual) {
                throw ex instanceof BizException bizException
                    ? bizException
                    : new BizException(ErrorCode.INTERNAL_ERROR, "XCPCIO 同步失败");
            }
            return configService.toAdminVO(contestId, config);
        } finally {
            runningContestIds.remove(contestId);
        }
    }

    private int countChangedSubmissions(Long contestId, LocalDateTime since) {
        QueryWrapper<Submission> wrapper = new QueryWrapper<Submission>().eq("contest_id", contestId);
        if (since != null) {
            wrapper.and(w -> w.gt("submit_time", since).or().gt("created_at", since));
        }
        return submissionMapper.selectCount(wrapper).intValue();
    }

    private void markSuccess(ContestXcpcioConfig config) {
        LocalDateTime now = LocalDateTime.now();
        config.status = XcpcioConfigService.STATUS_OK;
        config.lastSyncAt = now;
        config.lastSuccessAt = now;
        config.lastError = null;
        config.lastErrorAt = null;
        config.consecutiveFailures = 0;
        configMapper.updateById(config);
    }

    private void markFailed(ContestXcpcioConfig config, Exception ex) {
        LocalDateTime now = LocalDateTime.now();
        config.status = XcpcioConfigService.STATUS_FAILED;
        config.lastSyncAt = now;
        config.lastError = configService.sanitize(ex.getMessage());
        config.lastErrorAt = now;
        config.consecutiveFailures = (config.consecutiveFailures == null ? 0 : config.consecutiveFailures) + 1;
        configMapper.updateById(config);
    }

    private void finishLog(ContestXcpcioSyncLog log, String status, Integer httpStatus, String error) {
        log.status = status;
        log.httpStatus = httpStatus;
        log.errorMessage = error;
        log.finishedAt = LocalDateTime.now();
        syncLogMapper.updateById(log);
    }

    private boolean shouldBackoff(ContestXcpcioConfig config) {
        int failures = config.consecutiveFailures == null ? 0 : config.consecutiveFailures;
        if (failures < 4 || config.lastErrorAt == null) {
            return false;
        }
        long waitSeconds = Math.min(60, (long) (5 * Math.pow(2, failures - 3)));
        return Duration.between(config.lastErrorAt, LocalDateTime.now()).getSeconds() < waitSeconds;
    }
}
