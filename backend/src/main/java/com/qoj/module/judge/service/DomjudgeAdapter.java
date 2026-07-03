package com.qoj.module.judge.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.qoj.module.judge.dto.DomjudgeJudgementResult;
import com.qoj.module.judge.dto.DomjudgeSubmissionResponse;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DomjudgeAdapter {
    private final SystemSettingService settingService;
    private final RestClient restClient;

    public DomjudgeAdapter(SystemSettingService settingService, RestClient restClient) {
        this.settingService = settingService;
        this.restClient = restClient;
    }

    public boolean enabled() {
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        return settings.domjudgeApiKey != null && !settings.domjudgeApiKey.isBlank();
    }

    public String createProblem(Problem problem) {
        if (!enabled()) {
            return null;
        }
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        return restClient.post()
            .uri(settings.domjudgeBaseUrl + "/api/v4/problems")
            .header("Authorization", "Bearer " + settings.domjudgeApiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .body(problem)
            .retrieve()
            .body(String.class);
    }

    public void uploadTestdata(String domjudgeProblemId, MultipartFile file) {
        if (!enabled()) {
            return;
        }
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        restClient.post()
            .uri(settings.domjudgeBaseUrl + "/api/v4/problems/" + domjudgeProblemId + "/testdata")
            .header("Authorization", "Bearer " + settings.domjudgeApiKey)
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .body(file)
            .retrieve()
            .toBodilessEntity();
    }

    public DomjudgeSubmissionResponse submit(
        String contestId,
        String problemId,
        String language,
        String code
    ) {
        if (!enabled()) {
            return new DomjudgeSubmissionResponse(null);
        }
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        String cid = contestId == null || contestId.isBlank()
            ? settings.domjudgeContestId
            : contestId;
        return restClient.post()
            .uri(settings.domjudgeBaseUrl + "/api/v4/contests/" + cid + "/submissions")
            .header("Authorization", "Bearer " + settings.domjudgeApiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .body(new DomjudgeSubmissionRequest(problemId, language, code))
            .retrieve()
            .body(DomjudgeSubmissionResponse.class);
    }

    public DomjudgeJudgementResult fetchJudgement(String contestId, String submissionId) {
        if (!enabled() || submissionId == null || submissionId.isBlank()) {
            return null;
        }
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();
        String cid = contestId == null || contestId.isBlank()
            ? settings.domjudgeContestId
            : contestId;
        try {
            JsonNode[] judgements = restClient.get()
                .uri(
                    settings.domjudgeBaseUrl
                        + "/api/v4/contests/{contestId}/judgements?submission_id={submissionId}",
                    cid,
                    submissionId
                )
                .header("Authorization", "Bearer " + settings.domjudgeApiKey)
                .retrieve()
                .body(JsonNode[].class);
            if (judgements == null || judgements.length == 0) {
                return null;
            }
            JsonNode latest = judgements[judgements.length - 1];
            String type = text(latest, "judgement_type_id");
            boolean finalResult = type != null && !type.isBlank() && latest.path("end_time").isTextual();
            Integer timeUsed = latest.hasNonNull("max_run_time")
                ? (int) Math.round(latest.path("max_run_time").asDouble() * 1000)
                : null;
            return new DomjudgeJudgementResult(type, timeUsed, null, finalResult);
        } catch (RestClientException ex) {
            return null;
        }
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isTextual() ? value.asText() : null;
    }

    private record DomjudgeSubmissionRequest(String problem, String language, String code) {
    }
}
