package com.qoj.module.practice.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.PageResult;
import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.classroom.entity.ClassMember;
import com.qoj.module.classroom.entity.ClassRoom;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.classroom.mapper.ClassRoomMapper;
import com.qoj.module.practice.dto.PracticePublicationRequest;
import com.qoj.module.practice.entity.Practice;
import com.qoj.module.practice.entity.PracticeProblem;
import com.qoj.module.practice.entity.PracticePublication;
import com.qoj.module.practice.entity.PracticePublicationClass;
import com.qoj.module.practice.entity.PracticePublicationProblem;
import com.qoj.module.practice.mapper.PracticeMapper;
import com.qoj.module.practice.mapper.PracticeProblemMapper;
import com.qoj.module.practice.mapper.PracticePublicationClassMapper;
import com.qoj.module.practice.mapper.PracticePublicationMapper;
import com.qoj.module.practice.mapper.PracticePublicationProblemMapper;
import com.qoj.common.enums.SubmissionStatus;
import com.qoj.module.practice.vo.PracticePublicationVO;
import com.qoj.module.practice.vo.PracticeRankVO;
import com.qoj.module.practice.vo.PracticeReportVO;
import com.qoj.module.practice.vo.PracticeSubmissionVO;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.service.ProblemService;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.ResourceAccessService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PracticePublicationService {
    private final PracticePublicationMapper publicationMapper;
    private final PracticePublicationClassMapper publicationClassMapper;
    private final PracticePublicationProblemMapper publicationProblemMapper;
    private final PracticeMapper practiceMapper;
    private final PracticeProblemMapper practiceProblemMapper;
    private final ProblemMapper problemMapper;
    private final ClassRoomMapper classRoomMapper;
    private final ClassMemberMapper classMemberMapper;
    private final ProblemService problemService;
    private final ResourceAccessService resourceAccessService;
    private final PasswordEncoder passwordEncoder;
    private final StringRedisTemplate redisTemplate;
    private final SubmissionMapper submissionMapper;
    private final UserMapper userMapper;

    public PracticePublicationService(
        PracticePublicationMapper publicationMapper,
        PracticePublicationClassMapper publicationClassMapper,
        PracticePublicationProblemMapper publicationProblemMapper,
        PracticeMapper practiceMapper,
        PracticeProblemMapper practiceProblemMapper,
        ProblemMapper problemMapper,
        ClassRoomMapper classRoomMapper,
        ClassMemberMapper classMemberMapper,
        ProblemService problemService,
        ResourceAccessService resourceAccessService,
        PasswordEncoder passwordEncoder,
        StringRedisTemplate redisTemplate,
        SubmissionMapper submissionMapper,
        UserMapper userMapper
    ) {
        this.publicationMapper = publicationMapper;
        this.publicationClassMapper = publicationClassMapper;
        this.publicationProblemMapper = publicationProblemMapper;
        this.practiceMapper = practiceMapper;
        this.practiceProblemMapper = practiceProblemMapper;
        this.problemMapper = problemMapper;
        this.classRoomMapper = classRoomMapper;
        this.classMemberMapper = classMemberMapper;
        this.problemService = problemService;
        this.resourceAccessService = resourceAccessService;
        this.passwordEncoder = passwordEncoder;
        this.redisTemplate = redisTemplate;
        this.submissionMapper = submissionMapper;
        this.userMapper = userMapper;
    }

    @Transactional
    public PracticePublicationVO publish(long practiceId, PracticePublicationRequest request) {
        AuthUser publisher = requirePublisher();
        Practice source = requireSource(practiceId);
        if (!resourceAccessService.canAccessPractice(publisher, source)) {
            throw new BizException(403, "无权发布该题单");
        }
        List<PracticeProblem> sourceProblems = practiceProblems(practiceId);
        Map<Long, PracticeProblem> sourceByProblem = new HashMap<>();
        sourceProblems.forEach(item -> sourceByProblem.put(item.problemId, item));
        // 发布题目全集由请求决定（支持新增/删减，不影响源题单）
        LinkedHashMap<Long, String> requestedVisibility = resolveRequestedVisibility(request.problems());
        if (requestedVisibility.values().stream().noneMatch("VISIBLE"::equals)) {
            throw new BizException(400, "至少公开一道题目后才能发布");
        }
        // 新增题目（不在源题单中）需校验可用性
        List<Long> addedProblemIds = requestedVisibility.keySet().stream()
            .filter(problemId -> !sourceByProblem.containsKey(problemId))
            .toList();
        requireUsableProblems(publisher, addedProblemIds);
        List<Long> classIds = normalizeClasses(publisher, request.studentAccessMode(), request.classIds());
        String publicationTitle = hasText(request.title()) ? request.title().trim() : source.title;
        String publicationDescription = request.description() == null ? source.description : request.description().trim();

        // 发布题目全集（保序）：仅收录公开的题目（隐藏题不收录，保持原有语义），
        // 分数取自源题单，新增题目默认 100 分
        List<PracticeProblem> publishedProblems = new ArrayList<>();
        for (Long problemId : requestedVisibility.keySet()) {
            if (!"VISIBLE".equals(requestedVisibility.get(problemId))) {
                continue;
            }
            PracticeProblem sourceProblem = sourceByProblem.get(problemId);
            PracticeProblem published = new PracticeProblem();
            published.problemId = problemId;
            published.score = (sourceProblem != null && sourceProblem.score != null)
                ? sourceProblem.score : 100;
            publishedProblems.add(published);
        }
        boolean sourceOwnedByPublisher = resourceAccessService.isOwner(
            publisher, source.ownerAccountType, source.ownerId
        );
        if (publisher.teacherAccount()
            && (!sourceOwnedByPublisher || publishedProblems.size() != sourceProblems.size())) {
            // 教师发布时若调整了题目集合（或使用他人题单），创建独立副本，不影响原题单
            source = createPublicationCopy(
                publisher, publicationTitle, publicationDescription, publishedProblems
            );
        }

        PracticePublication publication = new PracticePublication();
        publication.sourcePracticeId = source.id;
        publication.publisherAccountType = publisher.accountType();
        publication.publisherId = publisher.id();
        publication.title = publicationTitle;
        publication.description = publicationDescription;
        publication.status = "PUBLISHED";
        publication.studentAccessMode = normalizeStudentAccessMode(request.studentAccessMode());
        publication.passwordHash = hasText(request.password()) ? passwordEncoder.encode(request.password()) : null;
        publication.publishedAt = LocalDateTime.now();
        publicationMapper.insert(publication);

        for (Long classId : classIds) {
            PracticePublicationClass grant = new PracticePublicationClass();
            grant.publicationId = publication.id;
            grant.classId = classId;
            publicationClassMapper.insert(grant);
        }
        int displayOrder = 1;
        for (PracticeProblem published : publishedProblems) {
            PracticePublicationProblem item = new PracticePublicationProblem();
            item.publicationId = publication.id;
            item.problemId = published.problemId;
            item.displayOrder = displayOrder++;
            item.score = published.score;
            item.visibility = requestedVisibility.get(published.problemId);
            publicationProblemMapper.insert(item);
        }
        return managementDetail(publication.id);
    }

    @Transactional
    public PracticePublicationVO update(long publicationId, PracticePublicationRequest request) {
        PracticePublication publication = requireManaged(publicationId);
        AuthUser publisher = CurrentUser.required();
        List<PracticePublicationProblem> currentItems = publicationProblems(publicationId);
        Map<Long, PracticePublicationProblem> currentByProblem = new LinkedHashMap<>();
        currentItems.forEach(item -> currentByProblem.put(item.problemId, item));
        // 编辑发布实例时，请求内的题目列表即为发布实例的题目全集与顺序，支持增删。
        LinkedHashMap<Long, String> requestedVisibility = resolveRequestedVisibility(request.problems());
        if (requestedVisibility.values().stream().noneMatch("VISIBLE"::equals)) {
            throw new BizException(400, "至少公开一道题目后才能发布");
        }
        List<Long> addedProblemIds = requestedVisibility.keySet().stream()
            .filter(problemId -> !currentByProblem.containsKey(problemId))
            .toList();
        Map<Long, Problem> addedProblems = requireUsableProblems(publisher, addedProblemIds);

        List<Long> classIds = normalizeClasses(publisher, request.studentAccessMode(), request.classIds());
        publication.title = hasText(request.title()) ? request.title().trim() : publication.title;
        publication.description = request.description() == null ? publication.description : request.description().trim();
        publication.studentAccessMode = normalizeStudentAccessMode(request.studentAccessMode());
        if (request.password() != null) {
            publication.passwordHash = hasText(request.password()) ? passwordEncoder.encode(request.password()) : null;
        }
        publication.status = "PUBLISHED";
        publication.publishedAt = LocalDateTime.now();
        publicationMapper.updateById(publication);
        publicationClassMapper.delete(new QueryWrapper<PracticePublicationClass>().eq("publication_id", publicationId));
        for (Long classId : classIds) {
            PracticePublicationClass grant = new PracticePublicationClass();
            grant.publicationId = publicationId;
            grant.classId = classId;
            publicationClassMapper.insert(grant);
        }

        // 删除请求中不再包含的题目
        for (PracticePublicationProblem existing : currentItems) {
            if (!requestedVisibility.containsKey(existing.problemId)) {
                publicationProblemMapper.delete(
                    new QueryWrapper<PracticePublicationProblem>()
                        .eq("publication_id", publicationId)
                        .eq("problem_id", existing.problemId)
                );
            }
        }
        // 按请求顺序写入题目全集（下标即展示顺序），已有的更新可见性，新增的插入
        int displayOrder = 1;
        for (Map.Entry<Long, String> entry : requestedVisibility.entrySet()) {
            Long problemId = entry.getKey();
            String visibility = entry.getValue();
            PracticePublicationProblem existing = currentByProblem.get(problemId);
            if (existing != null) {
                existing.displayOrder = displayOrder;
                existing.visibility = visibility;
                publicationProblemMapper.update(
                    existing,
                    new QueryWrapper<PracticePublicationProblem>()
                        .eq("publication_id", publicationId)
                        .eq("problem_id", problemId)
                );
            } else {
                PracticePublicationProblem item = new PracticePublicationProblem();
                item.publicationId = publicationId;
                item.problemId = problemId;
                item.displayOrder = displayOrder;
                Integer sourceScore = sourceProblemScore(publication.sourcePracticeId, problemId);
                item.score = sourceScore == null ? 100 : sourceScore;
                item.visibility = visibility;
                publicationProblemMapper.insert(item);
            }
            displayOrder++;
        }
        return managementDetail(publicationId);
    }

    /**
     * 从源题单读取题目分数（编辑发布新增题目时与初次发布保持一致）。
     */
    private Integer sourceProblemScore(Long sourcePracticeId, Long problemId) {
        if (sourcePracticeId == null || problemId == null) {
            return null;
        }
        PracticeProblem source = practiceProblemMapper.selectOne(
            new QueryWrapper<PracticeProblem>()
                .eq("practice_id", sourcePracticeId)
                .eq("problem_id", problemId)
        );
        return source == null ? null : source.score;
    }

    public PracticeReportVO publicationReport(long publicationId) {
        PracticePublication publication = requireManaged(publicationId);
        List<PracticePublicationProblem> items = publicationProblems(publicationId);
        Map<Long, Integer> scoreByProblem = new HashMap<>();
        items.forEach(item -> scoreByProblem.put(item.problemId, item.score == null ? 0 : item.score));
        List<Long> problemIds = items.stream().map(item -> item.problemId).toList();
        Map<Long, Problem> problems = problemIds.isEmpty()
            ? Map.of()
            : problemMapper.selectBatchIds(problemIds).stream()
                .collect(java.util.stream.Collectors.toMap(item -> item.id, item -> item));

        List<Submission> submissions = submissionMapper.selectList(
            new QueryWrapper<Submission>()
                .eq("practice_publication_id", publication.id)
                .orderByDesc("created_at")
        );
        Map<Long, User> users = submissions.isEmpty()
            ? Map.of()
            : userMapper.selectBatchIds(submissions.stream().map(item -> item.userId).distinct().toList()).stream()
                .collect(java.util.stream.Collectors.toMap(item -> item.id, item -> item));

        Map<Long, RankAccumulator> ranks = new LinkedHashMap<>();
        for (Submission submission : submissions) {
            RankAccumulator rank = ranks.computeIfAbsent(submission.userId, userId -> new RankAccumulator());
            rank.submissionCount += 1;
            if (SubmissionStatus.AC.name().equals(submission.status) && scoreByProblem.containsKey(submission.problemId)) {
                int score = scoreByProblem.get(submission.problemId);
                if (rank.acceptedProblems.putIfAbsent(submission.problemId, score) == null) {
                    rank.score += score;
                    rank.solved += 1;
                }
            }
        }

        List<PracticeRankVO> rankings = new ArrayList<>();
        for (Map.Entry<Long, RankAccumulator> entry : ranks.entrySet()) {
            User user = users.get(entry.getKey());
            RankAccumulator rank = entry.getValue();
            rankings.add(new PracticeRankVO(
                entry.getKey(),
                user == null ? String.valueOf(entry.getKey()) : user.displayName,
                rank.score,
                rank.solved,
                rank.submissionCount
            ));
        }
        rankings.sort(
            Comparator.comparing(PracticeRankVO::score).reversed()
                .thenComparing(PracticeRankVO::submissionCount)
                .thenComparing(PracticeRankVO::userId)
        );

        List<PracticeSubmissionVO> submissionVOs = submissions.stream().map(submission -> {
            User user = users.get(submission.userId);
            Problem problem = problems.get(submission.problemId);
            return new PracticeSubmissionVO(
                submission.id,
                submission.userId,
                user == null ? String.valueOf(submission.userId) : user.displayName,
                submission.problemId,
                problem == null ? String.valueOf(submission.problemId) : problem.title,
                submission.language,
                submission.status,
                submission.timeUsed,
                submission.memoryUsed,
                submission.createdAt
            );
        }).toList();

        return new PracticeReportVO(publication.id, rankings.size(), submissions.size(), rankings, submissionVOs);
    }

    @Transactional
    public void delete(long publicationId) {
        PracticePublication publication = requireManaged(publicationId);
        publicationProblemMapper.delete(
            new QueryWrapper<PracticePublicationProblem>().eq("publication_id", publication.id)
        );
        publicationClassMapper.delete(
            new QueryWrapper<PracticePublicationClass>().eq("publication_id", publication.id)
        );
        publicationMapper.deleteById(publication.id);
    }

    public PageResult<PracticePublicationVO> publicList(int page, int pageSize, String scope) {
        AuthUser student = CurrentUser.get();
        if (student == null || !"USER".equals(student.accountType())) {
            return new PageResult<>(0, List.of());
        }
        String normalizedScope = scope == null ? "all" : scope.trim().toLowerCase();
        List<PracticePublication> visible = publicationMapper.selectList(
            new QueryWrapper<PracticePublication>()
                .eq("status", "PUBLISHED")
                .orderByDesc("published_at")
                .orderByDesc("id")
        ).stream()
            .filter(item -> matchesStudentScope(student.id(), item, normalizedScope))
            .toList();
        int normalizedPage = Math.max(1, page);
        int normalizedSize = Math.min(Math.max(1, pageSize), 100);
        int from = Math.min((normalizedPage - 1) * normalizedSize, visible.size());
        int to = Math.min(from + normalizedSize, visible.size());
        return new PageResult<>(
            visible.size(),
            visible.subList(from, to).stream().map(item -> toVO(item, false)).toList()
        );
    }

    public PracticePublicationVO publicDetail(long id, String password) {
        AuthUser student = CurrentUser.required();
        if (!"USER".equals(student.accountType())) {
            throw new BizException(403, "仅学生可以访问已发布题单");
        }
        PracticePublication publication = publicationMapper.selectById(id);
        if (publication == null || !"PUBLISHED".equals(publication.status) || !studentCanAccess(student.id(), publication)) {
            throw new BizException(404, "题单不存在");
        }
        if (hasText(publication.passwordHash)) {
            String unlockKey = RedisKeys.practicePublicationUnlock(id, student.id());
            if (!Boolean.TRUE.equals(redisTemplate.hasKey(unlockKey))) {
                if (!hasText(password)) {
                    throw new BizException(401, "需要题单密码");
                }
                String attemptsKey = RedisKeys.practicePublicationPasswordAttempts(id, student.id());
                Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
                if (attempts != null && attempts == 1L) {
                    redisTemplate.expire(attemptsKey, java.time.Duration.ofMinutes(5));
                }
                if (attempts != null && attempts > 5L) {
                    throw new BizException(429, "密码尝试次数过多，请5分钟后再试");
                }
                if (!passwordEncoder.matches(password, publication.passwordHash)) {
                    throw new BizException(401, "题单密码错误");
                }
                redisTemplate.delete(attemptsKey);
                redisTemplate.opsForValue().set(unlockKey, "1", java.time.Duration.ofHours(2));
            }
        }
        return toVO(publication, false);
    }

    public PracticePublicationVO managementDetail(long id) {
        return toVO(requireManaged(id), true);
    }

    public List<PracticePublicationVO> myPublications() {
        AuthUser user = requirePublisher();
        return publicationMapper.selectList(
            new QueryWrapper<PracticePublication>()
                .eq("publisher_account_type", user.accountType())
                .eq("publisher_id", user.id())
                .orderByDesc("created_at")
        ).stream().map(item -> toVO(item, true)).toList();
    }

    public List<PracticePublicationVO> allPublications() {
        AuthUser user = requirePublisher();
        if (!resourceAccessService.isSuperAdmin(user)) {
            throw new BizException(403, "仅超级管理员可以查看全部发布实例");
        }
        return publicationMapper.selectList(
            new QueryWrapper<PracticePublication>()
                .orderByDesc("published_at")
                .orderByDesc("id")
        ).stream().map(item -> toVO(item, true)).toList();
    }

    public boolean canSubmit(Long publicationId, Long userId, Long problemId) {
        PracticePublication publication = publicationMapper.selectById(publicationId);
        if (publication == null || !studentCanAccess(userId, publication)) {
            return false;
        }
        return publicationProblemMapper.selectCount(
            new QueryWrapper<PracticePublicationProblem>()
                .eq("publication_id", publicationId)
                .eq("problem_id", problemId)
                .eq("visibility", "VISIBLE")
        ) > 0;
    }

    public Long sourcePracticeId(Long publicationId) {
        PracticePublication publication = publicationMapper.selectById(publicationId);
        if (publication == null) {
            throw new BizException(404, "题单不存在");
        }
        return publication.sourcePracticeId;
    }

    private PracticePublication requireManaged(long id) {
        PracticePublication publication = publicationMapper.selectById(id);
        if (publication == null) {
            throw new BizException(404, "发布实例不存在");
        }
        AuthUser user = requirePublisher();
        if (!resourceAccessService.isSuperAdmin(user)
            && (!user.accountType().equals(publication.publisherAccountType) || !user.id().equals(publication.publisherId))) {
            throw new BizException(403, "无权管理该发布实例");
        }
        return publication;
    }

    private AuthUser requirePublisher() {
        AuthUser user = CurrentUser.required();
        if (!user.adminAccount() && !user.teacherAccount()) {
            throw new BizException(403, "仅教师或管理员可以发布题单");
        }
        return user;
    }

    private Practice requireSource(long id) {
        Practice practice = practiceMapper.selectById(id);
        if (practice == null || Boolean.TRUE.equals(practice.isDeleted)) {
            throw new BizException(404, "题单不存在");
        }
        return practice;
    }

    private Practice createPublicationCopy(
        AuthUser publisher,
        String publicationTitle,
        String publicationDescription,
        List<PracticeProblem> publishedProblems
    ) {
        Practice copy = new Practice();
        copy.title = publicationTitle + "（发布副本）";
        copy.description = publicationDescription;
        copy.ownerId = publisher.id();
        copy.ownerAccountType = publisher.accountType();
        copy.accessScope = "PRIVATE";
        copy.majorId = publisher.teacher().majorId;
        copy.audience = "ALL";
        copy.audienceId = null;
        copy.passwordHash = null;
        copy.published = false;
        practiceMapper.insert(copy);

        int displayOrder = 1;
        for (PracticeProblem sourceProblem : publishedProblems) {
            PracticeProblem item = new PracticeProblem();
            item.practiceId = copy.id;
            item.problemId = sourceProblem.problemId;
            item.displayOrder = displayOrder++;
            item.score = sourceProblem.score;
            practiceProblemMapper.insert(item);
        }
        return copy;
    }

    private List<Long> normalizeClasses(AuthUser publisher, String modeValue, List<Long> requested) {
        String mode = normalizeStudentAccessMode(modeValue);
        if ("ALL".equals(mode)) {
            return List.of();
        }
        LinkedHashSet<Long> ids = new LinkedHashSet<>(requested == null ? List.of() : requested);
        if (ids.isEmpty()) {
            throw new BizException(400, "请选择至少一个班级");
        }
        for (Long classId : ids) {
            ClassRoom classRoom = classRoomMapper.selectById(classId);
            if (classRoom == null) {
                throw new BizException(404, "班级不存在：" + classId);
            }
            if (publisher.teacherAccount() && !publisher.id().equals(classRoom.teacherId)) {
                throw new BizException(403, "只能发布到自己管理的班级");
            }
        }
        return new ArrayList<>(ids);
    }

    private String normalizeStudentAccessMode(String value) {
        String mode = value == null ? "ALL" : value.trim().toUpperCase();
        if (!Set.of("ALL", "SELECTED_CLASSES").contains(mode)) {
            throw new BizException(400, "学生范围仅支持所有学生或指定班级");
        }
        return mode;
    }

    private LinkedHashMap<Long, String> resolveRequestedVisibility(
        List<PracticePublicationRequest.ProblemVisibilityRequest> requested
    ) {
        LinkedHashMap<Long, String> result = new LinkedHashMap<>();
        for (PracticePublicationRequest.ProblemVisibilityRequest item : requested) {
            if (item.problemId() == null || result.containsKey(item.problemId())) {
                throw new BizException(400, "发布题目存在重复或缺失");
            }
            String visibility = item.visibility().trim().toUpperCase();
            if (!Set.of("VISIBLE", "HIDDEN").contains(visibility)) {
                throw new BizException(400, "题目状态仅支持公开或隐藏");
            }
            result.put(item.problemId(), visibility);
        }
        if (result.isEmpty()) {
            throw new BizException(400, "题单至少包含一道题目");
        }
        return result;
    }

    private Map<Long, Problem> requireUsableProblems(AuthUser publisher, List<Long> problemIds) {
        if (problemIds.isEmpty()) {
            return Map.of();
        }
        List<Problem> problems = problemMapper.selectBatchIds(problemIds);
        if (problems.size() != problemIds.stream().distinct().count()) {
            throw new BizException(404, "新增题目不存在");
        }
        if (problems.stream().anyMatch(problem -> !resourceAccessService.canUseProblem(publisher, problem))) {
            throw new BizException(403, "包含无权使用的题目");
        }
        return problems.stream().collect(java.util.stream.Collectors.toMap(item -> item.id, item -> item));
    }

    private boolean studentCanAccess(Long userId, PracticePublication publication) {
        if (publication == null || !"PUBLISHED".equals(publication.status) || userId == null) {
            return false;
        }
        if ("ALL".equals(publication.studentAccessMode)) {
            return true;
        }
        List<Long> classIds = publicationClassIds(publication.id);
        return !classIds.isEmpty() && classMemberMapper.selectCount(
            new QueryWrapper<ClassMember>().eq("user_id", userId).in("class_id", classIds)
        ) > 0;
    }

    private boolean matchesStudentScope(Long userId, PracticePublication publication, String scope) {
        if ("public".equals(scope) && !"ALL".equals(publication.studentAccessMode)) {
            return false;
        }
        if ("class".equals(scope) && !"SELECTED_CLASSES".equals(publication.studentAccessMode)) {
            return false;
        }
        return studentCanAccess(userId, publication);
    }

    private PracticePublicationVO toVO(PracticePublication publication, boolean includeHidden) {
        List<PracticePublicationProblem> items = publicationProblems(publication.id).stream()
            .filter(item -> includeHidden || "VISIBLE".equals(item.visibility))
            .toList();
        List<com.qoj.module.problem.vo.ProblemVO> problems = items.stream()
            .map(item -> problemService.detailAsVOUnchecked(item.problemId))
            .toList();
        List<PracticePublicationVO.PublicationProblemVO> itemVOs = items.stream().map(item -> {
            Problem problem = problemMapper.selectById(item.problemId);
            return new PracticePublicationVO.PublicationProblemVO(
                item.problemId, item.displayOrder, item.score, item.visibility,
                problem == null ? null : problem.title
            );
        }).toList();
        List<Long> classIds = publicationClassIds(publication.id);
        return new PracticePublicationVO(
            publication.id,
            publication.sourcePracticeId,
            publication.title,
            publication.description,
            "SELECTED_CLASSES".equals(publication.studentAccessMode) ? "CLASS" : "ALL",
            classIds.isEmpty() ? null : classIds.get(0),
            hasText(publication.passwordHash),
            publication.publisherId,
            problems,
            publication.createdAt,
            publication.updatedAt,
            publication.publisherAccountType,
            publication.status,
            publication.studentAccessMode,
            classIds,
            itemVOs
        );
    }

    private List<PracticeProblem> practiceProblems(Long practiceId) {
        return practiceProblemMapper.selectList(
            new QueryWrapper<PracticeProblem>().eq("practice_id", practiceId).orderByAsc("display_order")
        );
    }

    private List<PracticePublicationProblem> publicationProblems(Long publicationId) {
        return publicationProblemMapper.selectList(
            new QueryWrapper<PracticePublicationProblem>()
                .eq("publication_id", publicationId)
                .orderByAsc("display_order")
        );
    }

    private List<Long> publicationClassIds(Long publicationId) {
        return publicationClassMapper.selectList(
            new QueryWrapper<PracticePublicationClass>().eq("publication_id", publicationId)
        ).stream().map(item -> item.classId).toList();
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static class RankAccumulator {
        int score;
        int solved;
        int submissionCount;
        Map<Long, Integer> acceptedProblems = new HashMap<>();
    }
}
