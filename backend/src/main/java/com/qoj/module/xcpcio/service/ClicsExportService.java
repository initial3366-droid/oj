package com.qoj.module.xcpcio.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestParticipant;
import com.qoj.module.contest.entity.ContestProblem;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestParticipantMapper;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.xcpcio.entity.ContestXcpcioConfig;
import com.qoj.module.xcpcio.mapper.ContestXcpcioConfigMapper;
import com.qoj.module.xcpcio.dto.clics.ClicsContestDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsGroupDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsJudgementDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsJudgementTypeDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsLanguageDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsOrganizationDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsProblemDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsRunDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsScoreDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsScoreboardDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsScoreboardProblemDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsScoreboardRowDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsStateDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsSubmissionDTO;
import com.qoj.module.xcpcio.dto.clics.ClicsTeamDTO;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class ClicsExportService {
    private final ContestMapper contestMapper;
    private final ContestParticipantMapper participantMapper;
    private final ContestProblemMapper contestProblemMapper;
    private final SubmissionMapper submissionMapper;
    private final UserMapper userMapper;
    private final ContestXcpcioConfigMapper configMapper;
    private final ZoneId zoneId = ZoneId.systemDefault();

    public ClicsExportService(
        ContestMapper contestMapper,
        ContestParticipantMapper participantMapper,
        ContestProblemMapper contestProblemMapper,
        SubmissionMapper submissionMapper,
        UserMapper userMapper,
        ContestXcpcioConfigMapper configMapper
    ) {
        this.contestMapper = contestMapper;
        this.participantMapper = participantMapper;
        this.contestProblemMapper = contestProblemMapper;
        this.submissionMapper = submissionMapper;
        this.userMapper = userMapper;
        this.configMapper = configMapper;
    }

    public Map<String, Object> root() {
        return Map.of(
            "version", "2026-01",
            "type", "qoj-clics-export",
            "endpoints", List.of("contests")
        );
    }

    public List<ClicsContestDTO> contests(List<Long> accessibleContestIds) {
        List<Long> enabledContestIds = accessibleContestIds == null ? List.of() : accessibleContestIds.stream()
            .filter(Objects::nonNull)
            .distinct()
            .toList();
        if (enabledContestIds.isEmpty()) {
            return List.of();
        }
        return contestMapper.selectList(
                new QueryWrapper<Contest>()
                    .in("id", enabledContestIds)
                    .eq("is_deleted", false)
                    .orderByDesc("start_time")
            )
            .stream()
            .map(this::toContest)
            .toList();
    }

    public ClicsContestDTO contest(Long contestId) {
        return toContest(requireContest(contestId));
    }

    public ClicsStateDTO state(Long contestId) {
        Contest contest = requireContest(contestId);
        return new ClicsStateDTO(
            toOffset(contest.startTime),
            Boolean.TRUE.equals(contest.frozen) ? toOffset(contest.freezeTime) : null,
            toOffset(contest.endTime),
            null,
            "ENDED".equals(contest.status) ? toOffset(contest.endTime) : null,
            null
        );
    }

    public List<ClicsTeamDTO> teams(Long contestId) {
        Map<Long, User> users = usersById(participants(contestId));
        return participants(contestId).stream()
            .map(participant -> {
                User user = users.get(participant.userId);
                String name = firstNonBlank(participant.nickname, user == null ? null : user.displayName, user == null ? null : user.username, "Team " + participant.id);
                return new ClicsTeamDTO(
                    String.valueOf(participant.id),
                    name,
                    name,
                    groupIds(participant)
                );
            })
            .toList();
    }

    public List<ClicsGroupDTO> groups(Long contestId) {
        LinkedHashMap<String, ClicsGroupDTO> groups = new LinkedHashMap<>();
        groups.put("official", new ClicsGroupDTO("official", "Official", "contest"));
        groups.put("unofficial", new ClicsGroupDTO("unofficial", "Unofficial", "contest"));
        return new ArrayList<>(groups.values());
    }

    public List<ClicsOrganizationDTO> organizations(Long contestId) {
        LinkedHashMap<String, ClicsOrganizationDTO> organizations = new LinkedHashMap<>();
        organizations.put("qoj", new ClicsOrganizationDTO("qoj", "QOJ", "QOJ", null));
        for (ContestParticipant participant : participants(contestId)) {
            if (participant.organizationId != null) {
                organizations.put(
                    "org-" + participant.organizationId,
                    new ClicsOrganizationDTO(
                        "org-" + participant.organizationId,
                        "Organization " + participant.organizationId,
                        "Organization " + participant.organizationId,
                        null
                    )
                );
            }
        }
        return new ArrayList<>(organizations.values());
    }

    public List<ClicsProblemDTO> problems(Long contestId) {
        return contestProblems(contestId).stream()
            .map(problem -> new ClicsProblemDTO(
                String.valueOf(problem.id),
                problem.displayOrder == null ? 0 : problem.displayOrder,
                firstNonBlank(problem.label, labelFor(problem.displayOrder)),
                firstNonBlank(problem.title, firstNonBlank(problem.label, String.valueOf(problem.id))),
                problem.timeLimit == null ? null : problem.timeLimit / 1000.0,
                null
            ))
            .toList();
    }

    public List<ClicsLanguageDTO> languages(Long contestId) {
        Set<String> ids = submissions(contestId).stream()
            .map(submission -> normalizeLanguage(submission.language))
            .collect(Collectors.toCollection(TreeSet::new));
        if (ids.isEmpty()) {
            ids.addAll(List.of("cpp", "java", "python3", "c"));
        }
        return ids.stream()
            .map(id -> new ClicsLanguageDTO(id, languageName(id)))
            .toList();
    }

    public List<ClicsJudgementTypeDTO> judgementTypes() {
        return List.of(
            new ClicsJudgementTypeDTO("AC", "accepted", false, true),
            new ClicsJudgementTypeDTO("WA", "wrong-answer", true, false),
            new ClicsJudgementTypeDTO("TLE", "time-limit-exceeded", true, false),
            new ClicsJudgementTypeDTO("MLE", "memory-limit-exceeded", true, false),
            new ClicsJudgementTypeDTO("RTE", "run-time-error", true, false),
            new ClicsJudgementTypeDTO("CE", "compile-error", false, false)
        );
    }

    public List<ClicsSubmissionDTO> submissionsDto(Long contestId) {
        Contest contest = requireContest(contestId);
        Map<Long, Long> participantIdByUserId = participantIdByUserId(contestId);
        return submissions(contestId).stream()
            .map(submission -> toSubmission(contest, submission, participantIdByUserId))
            .filter(Objects::nonNull)
            .toList();
    }

    public List<ClicsJudgementDTO> judgements(Long contestId) {
        Contest contest = requireContest(contestId);
        return submissions(contestId).stream()
            .filter(submission -> !isPending(submission.status))
            .map(submission -> {
                LocalDateTime time = submissionTime(submission);
                String judgementType = judgementType(submission.status);
                return new ClicsJudgementDTO(
                    "j" + submission.id,
                    String.valueOf(submission.id),
                    judgementType,
                    toOffset(time),
                    contestTime(contest, time),
                    toOffset(time),
                    contestTime(contest, time),
                    submission.timeUsed == null ? null : submission.timeUsed / 1000.0
                );
            })
            .toList();
    }

    public List<ClicsRunDTO> runs(Long contestId) {
        Contest contest = requireContest(contestId);
        return submissions(contestId).stream()
            .filter(submission -> !isPending(submission.status))
            .map(submission -> {
                LocalDateTime time = submissionTime(submission);
                return new ClicsRunDTO(
                    "r" + submission.id,
                    "j" + submission.id,
                    1,
                    judgementType(submission.status),
                    toOffset(time),
                    contestTime(contest, time),
                    submission.timeUsed == null ? null : submission.timeUsed / 1000.0
                );
            })
            .toList();
    }

    public ClicsScoreboardDTO scoreboard(Long contestId) {
        Contest contest = requireContest(contestId);
        List<ContestProblem> problems = contestProblems(contestId);
        Map<Long, Long> participantIdByUserId = participantIdByUserId(contestId);
        LinkedHashMap<String, ScoreRow> rows = new LinkedHashMap<>();
        for (ContestParticipant participant : participants(contestId)) {
            rows.put(String.valueOf(participant.id), new ScoreRow(String.valueOf(participant.id), problems));
        }

        for (Submission submission : submissions(contestId)) {
            Long participantId = teamId(submission, participantIdByUserId);
            if (participantId == null) {
                continue;
            }
            Long problemId = problemId(submission);
            if (problemId == null) {
                continue;
            }
            ScoreRow row = rows.computeIfAbsent(String.valueOf(participantId), id -> new ScoreRow(id, problems));
            ProblemScore problemScore = row.problemScores.get(String.valueOf(problemId));
            if (problemScore == null || problemScore.solved) {
                continue;
            }
            if (isPending(submission.status)) {
                problemScore.numPending++;
                continue;
            }

            problemScore.numJudged++;
            if (isAccepted(submission.status)) {
                problemScore.solved = true;
                problemScore.time = contestTimeMinutes(contest, submissionTime(submission));
                row.numSolved++;
                row.totalTime += problemScore.time + problemScore.wrongAttempts * penaltyMinutes(contest);
            } else if (isPenaltyStatus(contest, submission.status)) {
                problemScore.wrongAttempts++;
            }
        }

        List<ScoreRow> sorted = rows.values().stream()
            .sorted(Comparator.comparingInt((ScoreRow row) -> row.numSolved).reversed()
                .thenComparingInt(row -> row.totalTime)
                .thenComparing(row -> row.teamId))
            .toList();

        List<ClicsScoreboardRowDTO> rowDtos = new ArrayList<>();
        for (int i = 0; i < sorted.size(); i++) {
            ScoreRow row = sorted.get(i);
            rowDtos.add(new ClicsScoreboardRowDTO(
                i + 1,
                row.teamId,
                new ClicsScoreDTO(row.numSolved, row.totalTime),
                row.problemScores.values().stream()
                    .map(score -> new ClicsScoreboardProblemDTO(
                        score.problemId,
                        score.numJudged,
                        score.numPending,
                        score.solved,
                        score.time
                    ))
                    .toList()
            ));
        }

        LocalDateTime now = LocalDateTime.now();
        return new ClicsScoreboardDTO(
            "scoreboard-" + contestId + "-" + System.currentTimeMillis(),
            toOffset(now),
            contestTime(contest, now),
            state(contestId),
            rowDtos
        );
    }

    public List<Map<String, Object>> eventFeed(Long contestId) {
        List<Map<String, Object>> events = new ArrayList<>();
        long eventId = 1;
        for (ClicsSubmissionDTO submission : submissionsDto(contestId)) {
            events.add(Map.of(
                "id", eventId++,
                "type", "submissions",
                "operation", "create",
                "data", submission
            ));
        }
        for (ClicsJudgementDTO judgement : judgements(contestId)) {
            events.add(Map.of(
                "id", eventId++,
                "type", "judgements",
                "operation", "create",
                "data", judgement
            ));
        }
        return events;
    }

    private ClicsContestDTO toContest(Contest contest) {
        int durationMinutes = contest.durationMinutes == null
            ? (contest.startTime == null || contest.endTime == null ? 0 : (int) Duration.between(contest.startTime, contest.endTime).toMinutes())
            : contest.durationMinutes;
        String freezeDuration = null;
        if (Boolean.TRUE.equals(contest.frozen) && contest.freezeTime != null && contest.endTime != null) {
            freezeDuration = hms(Math.max(0, Duration.between(contest.freezeTime, contest.endTime).getSeconds()));
        }
        return new ClicsContestDTO(
            String.valueOf(contest.id),
            contest.title,
            contest.title,
            toOffset(contest.startTime),
            hms(durationMinutes * 60L),
            freezeDuration,
            hms(penaltyMinutes(contest) * 60L)
        );
    }

    private ClicsSubmissionDTO toSubmission(Contest contest, Submission submission, Map<Long, Long> participantIdByUserId) {
        Long teamId = teamId(submission, participantIdByUserId);
        if (teamId == null || problemId(submission) == null) {
            return null;
        }
        LocalDateTime time = submissionTime(submission);
        return new ClicsSubmissionDTO(
            String.valueOf(submission.id),
            normalizeLanguage(submission.language),
            String.valueOf(problemId(submission)),
            String.valueOf(teamId),
            toOffset(time),
            contestTime(contest, time)
        );
    }

    private Contest requireContest(Long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null || Boolean.TRUE.equals(contest.isDeleted)) {
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }
        return contest;
    }

    private List<ContestParticipant> participants(Long contestId) {
        return participantMapper.selectList(
            new QueryWrapper<ContestParticipant>()
                .eq("contest_id", contestId)
                .orderByAsc("id")
        );
    }

    private List<ContestProblem> contestProblems(Long contestId) {
        return contestProblemMapper.selectList(
            new QueryWrapper<ContestProblem>()
                .eq("contest_id", contestId)
                .orderByAsc("display_order")
                .orderByAsc("id")
        );
    }

    private List<Submission> submissions(Long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        return submissionMapper.selectList(
            new QueryWrapper<Submission>()
                .eq("contest_id", contestId)
                .orderByAsc("submit_time")
                .orderByAsc("created_at")
                .orderByAsc("id")
        )
            .stream()
            .filter(submission -> isRankedSubmission(contest, submission))
            .toList();
    }

    private boolean isRankedSubmission(Contest contest, Submission submission) {
        LocalDateTime submittedAt = submissionTime(submission);
        if (contest == null || contest.startTime == null || contest.endTime == null || submittedAt == null) {
            return false;
        }
        return !submittedAt.isBefore(contest.startTime) && !submittedAt.isAfter(contest.endTime);
    }

    private Map<Long, User> usersById(List<ContestParticipant> participants) {
        Set<Long> userIds = participants.stream()
            .map(participant -> participant.userId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return userMapper.selectBatchIds(userIds).stream().collect(Collectors.toMap(user -> user.id, user -> user));
    }

    private Map<Long, Long> participantIdByUserId(Long contestId) {
        return participants(contestId).stream()
            .filter(participant -> participant.userId != null)
            .collect(Collectors.toMap(participant -> participant.userId, participant -> participant.id, (a, b) -> a));
    }

    private List<String> groupIds(ContestParticipant participant) {
        List<String> ids = new ArrayList<>();
        ids.add("UNOFFICIAL".equals(participant.status) ? "unofficial" : "official");
        return ids.stream().distinct().toList();
    }

    private Long teamId(Submission submission, Map<Long, Long> participantIdByUserId) {
        if (submission.participantId != null) {
            return submission.participantId;
        }
        return participantIdByUserId.get(submission.userId);
    }

    private Long problemId(Submission submission) {
        return submission.contestProblemId == null ? submission.problemId : submission.contestProblemId;
    }

    private boolean isAccepted(String status) {
        return "AC".equals(status) || "ACCEPTED".equals(status);
    }

    private boolean isPending(String status) {
        return status == null || "PENDING".equals(status) || "JUDGING".equals(status) || "QUEUED".equals(status) || "RUNNING".equals(status);
    }

    private boolean isPenaltyStatus(Contest contest, String status) {
        if (isPending(status) || isAccepted(status)) {
            return false;
        }
        if ("CE".equals(status) || "COMPILE_ERROR".equals(status)) {
            return Boolean.TRUE.equals(contest.countCeAsPenalty);
        }
        return true;
    }

    private String judgementType(String status) {
        if (isAccepted(status)) {
            return "AC";
        }
        if ("WA".equals(status) || "WRONG_ANSWER".equals(status)) {
            return "WA";
        }
        if ("TLE".equals(status) || "TIME_LIMIT_EXCEEDED".equals(status)) {
            return "TLE";
        }
        if ("MLE".equals(status) || "MEMORY_LIMIT_EXCEEDED".equals(status)) {
            return "MLE";
        }
        if ("CE".equals(status) || "COMPILE_ERROR".equals(status)) {
            return "CE";
        }
        return "RTE";
    }

    private String normalizeLanguage(String language) {
        String value = language == null || language.isBlank() ? "unknown" : language.trim().toLowerCase(Locale.ROOT);
        if (value.contains("python")) {
            return "python3";
        }
        if (value.contains("java")) {
            return "java";
        }
        if (value.contains("c++") || value.contains("cpp") || value.contains("g++")) {
            return "cpp";
        }
        if ("c".equals(value) || value.contains("gcc")) {
            return "c";
        }
        return value.replaceAll("[^a-z0-9_+.-]", "-");
    }

    private String languageName(String id) {
        return switch (id) {
            case "cpp" -> "C++";
            case "c" -> "C";
            case "java" -> "Java";
            case "python3" -> "Python 3";
            default -> id;
        };
    }

    private LocalDateTime submissionTime(Submission submission) {
        return submission.submitTime == null ? submission.createdAt : submission.submitTime;
    }

    private OffsetDateTime toOffset(LocalDateTime value) {
        return value == null ? null : value.atZone(zoneId).toOffsetDateTime();
    }

    private String contestTime(Contest contest, LocalDateTime time) {
        if (contest.startTime == null || time == null) {
            return "0:00:00";
        }
        return hms(Math.max(0, Duration.between(contest.startTime, time).getSeconds()));
    }

    private int contestTimeMinutes(Contest contest, LocalDateTime time) {
        if (contest.startTime == null || time == null) {
            return 0;
        }
        return Math.max(0, (int) Duration.between(contest.startTime, time).toMinutes());
    }

    private int penaltyMinutes(Contest contest) {
        return contest.penaltyMinutes == null ? 20 : contest.penaltyMinutes;
    }

    private String hms(long totalSeconds) {
        long hours = totalSeconds / 3600;
        long minutes = (totalSeconds % 3600) / 60;
        long seconds = totalSeconds % 60;
        return hours + ":" + String.format("%02d:%02d", minutes, seconds);
    }

    private String labelFor(Integer displayOrder) {
        int order = displayOrder == null ? 0 : displayOrder;
        if (order >= 0 && order < 26) {
            return String.valueOf((char) ('A' + order));
        }
        return String.valueOf(order + 1);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private static class ScoreRow {
        final String teamId;
        final LinkedHashMap<String, ProblemScore> problemScores = new LinkedHashMap<>();
        int numSolved;
        int totalTime;

        ScoreRow(String teamId, List<ContestProblem> problems) {
            this.teamId = teamId;
            for (ContestProblem problem : problems) {
                problemScores.put(String.valueOf(problem.id), new ProblemScore(String.valueOf(problem.id)));
            }
        }
    }

    private static class ProblemScore {
        final String problemId;
        int numJudged;
        int numPending;
        int wrongAttempts;
        boolean solved;
        Integer time;

        ProblemScore(String problemId) {
            this.problemId = problemId;
        }
    }
}
