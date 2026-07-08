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

@RestController
@RequestMapping("/api/v1/clics")
public class ClicsExportController {
    private final ClicsExportService exportService;
    private final XcpcioConfigService configService;

    public ClicsExportController(ClicsExportService exportService, XcpcioConfigService configService) {
        this.exportService = exportService;
        this.configService = configService;
    }

    @GetMapping({"", "/"})
    public Map<String, Object> root() {
        return exportService.root();
    }

    @GetMapping("/contests")
    public List<ClicsContestDTO> contests(@RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        return exportService.contests(configService.accessibleClicsContestIds(accessToken, authorization));
    }

    @GetMapping("/contests/{contestId}")
    public ClicsContestDTO contest(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.contest(contestId);
    }

    @GetMapping("/contests/{contestId}/state")
    public ClicsStateDTO state(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.state(contestId);
    }

    @GetMapping("/contests/{contestId}/teams")
    public List<ClicsTeamDTO> teams(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.teams(contestId);
    }

    @GetMapping("/contests/{contestId}/groups")
    public List<ClicsGroupDTO> groups(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.groups(contestId);
    }

    @GetMapping("/contests/{contestId}/organizations")
    public List<ClicsOrganizationDTO> organizations(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.organizations(contestId);
    }

    @GetMapping("/contests/{contestId}/problems")
    public List<ClicsProblemDTO> problems(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.problems(contestId);
    }

    @GetMapping("/contests/{contestId}/languages")
    public List<ClicsLanguageDTO> languages(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.languages(contestId);
    }

    @GetMapping("/contests/{contestId}/judgement-types")
    public List<ClicsJudgementTypeDTO> judgementTypes(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.judgementTypes();
    }

    @GetMapping("/contests/{contestId}/submissions")
    public List<ClicsSubmissionDTO> submissions(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.submissionsDto(contestId);
    }

    @GetMapping("/contests/{contestId}/judgements")
    public List<ClicsJudgementDTO> judgements(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.judgements(contestId);
    }

    @GetMapping("/contests/{contestId}/runs")
    public List<ClicsRunDTO> runs(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.runs(contestId);
    }

    @GetMapping("/contests/{contestId}/scoreboard")
    public ClicsScoreboardDTO scoreboard(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.scoreboard(contestId);
    }

    @GetMapping("/contests/{contestId}/event-feed")
    public List<Map<String, Object>> eventFeed(@PathVariable Long contestId, @RequestParam(required = false) String accessToken, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        requireAccess(contestId, accessToken, authorization);
        return exportService.eventFeed(contestId);
    }

    private void requireAccess(Long contestId, String accessToken, String authorization) {
        configService.requireClicsAccess(contestId, accessToken, authorization);
    }
}
