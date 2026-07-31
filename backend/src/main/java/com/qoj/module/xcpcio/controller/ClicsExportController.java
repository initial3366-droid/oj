package com.qoj.module.xcpcio.controller;

import com.qoj.module.xcpcio.dto.clics.ClicsContestDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsGroupDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsJudgementDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsJudgementTypeDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsLanguageDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsOrganizationDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsProblemDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsRunDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsScoreboardDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsStateDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsSubmissionDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsTeamDTO;
import com.qoj.module.xcpcio.service.ClicsExportService;
import com.qoj.module.xcpcio.service.XcpcioConfigService;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Clics导出接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/clics")
public class ClicsExportController {
    private final ClicsExportService exportService;
    private final XcpcioConfigService configService;

    /**
     * 构造 Clics导出Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public ClicsExportController(ClicsExportService exportService, XcpcioConfigService configService) {
        this.exportService = exportService;
        this.configService = configService;
    }

    /**
     * 封装root相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping({"", "/"})
    public Map<String, Object> root() {
        return exportService.root();
    }

    /**
     * 封装contests相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests")
    public List<ClicsContestDTO> contests(@RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        return exportService.contests(configService.accessibleClicsContestIds(accessToken, authorization));
    }

    /**
     * 封装比赛相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}")
    public ClicsContestDTO contest(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.contest(contestId);
    }

    /**
     * 封装state相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}/state")
    public ClicsStateDTO state(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.state(contestId);
    }

    /**
     * 封装teams相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}/teams")
    public List<ClicsTeamDTO> teams(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.teams(contestId);
    }

    /**
     * 封装groups相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}/groups")
    public List<ClicsGroupDTO> groups(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.groups(contestId);
    }

    /**
     * 封装organizations相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}/organizations")
    public List<ClicsOrganizationDTO> organizations(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.organizations(contestId);
    }

    /**
     * 封装problems相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}/problems")
    public List<ClicsProblemDTO> problems(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.problems(contestId);
    }

    /**
     * 封装languages相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}/languages")
    public List<ClicsLanguageDTO> languages(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.languages(contestId);
    }

    /**
     * 封装judgementTypes相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}/judgement-types")
    public List<ClicsJudgementTypeDTO> judgementTypes(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.judgementTypes();
    }

    /**
     * 封装submissions相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}/submissions")
    public List<ClicsSubmissionDTO> submissions(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.submissionsDto(contestId);
    }

    /**
     * 封装judgements相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}/judgements")
    public List<ClicsJudgementDTO> judgements(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.judgements(contestId);
    }

    /**
     * 封装runs相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}/runs")
    public List<ClicsRunDTO> runs(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.runs(contestId);
    }

    /**
     * 封装榜单相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}/scoreboard")
    public ClicsScoreboardDTO scoreboard(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.scoreboard(contestId);
    }

    /**
     * 封装eventFeed相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/contests/{contestId}/event-feed")
    public List<Map<String, Object>> eventFeed(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.eventFeed(contestId);
    }

    /**
     * 校验访问。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private void requireAccess(Long contestId, String accessToken, String authorization) {
        configService.requireClicsAccess(contestId, accessToken, authorization);
    }
}
