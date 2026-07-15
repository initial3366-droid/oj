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
import com.qoj.module.practice.vo.PracticePublicationVO;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.service.ProblemService;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.ResourceAccessService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
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
        StringRedisTemplate redisTemplate
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
        Map<Long, String> requestedVisibility = normalizeVisibility(request.problems(), sourceByProblem.keySet());
        if (requestedVisibility.values().stream().noneMatch("VISIBLE"::equals)) {
            throw new BizException(400, "至少公开一道题目后才能发布");
        }
        List<Long> classIds = normalizeClasses(publisher, request.studentAccessMode(), request.classIds());

        PracticePublication publication = new PracticePublication();
        publication.sourcePracticeId = source.id;
        publication.publisherAccountType = publisher.accountType();
        publication.publisherId = publisher.id();
        publication.title = hasText(request.title()) ? request.title().trim() : source.title;
        publication.description = request.description() == null ? source.description : request.description().trim();
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
        for (PracticeProblem sourceProblem : sourceProblems) {
            PracticePublicationProblem item = new PracticePublicationProblem();
            item.publicationId = publication.id;
            item.problemId = sourceProblem.problemId;
            item.displayOrder = sourceProblem.displayOrder;
            item.score = sourceProblem.score;
            item.visibility = requestedVisibility.get(sourceProblem.problemId);
            publicationProblemMapper.insert(item);
        }
        return managementDetail(publication.id);
    }

    @Transactional
    public PracticePublicationVO update(long publicationId, PracticePublicationRequest request) {
        PracticePublication publication = requireManaged(publicationId);
        AuthUser publisher = CurrentUser.required();
        List<PracticePublicationProblem> currentItems = publicationProblems(publicationId);
        Set<Long> problemIds = currentItems.stream().map(item -> item.problemId).collect(java.util.stream.Collectors.toSet());
        Map<Long, String> requestedVisibility = normalizeVisibility(request.problems(), problemIds);
        if (requestedVisibility.values().stream().noneMatch("VISIBLE"::equals)) {
            throw new BizException(400, "至少公开一道题目后才能发布");
        }
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
        for (PracticePublicationProblem item : currentItems) {
            item.visibility = requestedVisibility.get(item.problemId);
            publicationProblemMapper.update(
                item,
                new QueryWrapper<PracticePublicationProblem>()
                    .eq("publication_id", publicationId)
                    .eq("problem_id", item.problemId)
            );
        }
        return managementDetail(publicationId);
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

    private Map<Long, String> normalizeVisibility(
        List<PracticePublicationRequest.ProblemVisibilityRequest> requested,
        Set<Long> expectedProblemIds
    ) {
        Map<Long, String> result = new HashMap<>();
        for (PracticePublicationRequest.ProblemVisibilityRequest item : requested) {
            if (item.problemId() == null || !expectedProblemIds.contains(item.problemId()) || result.containsKey(item.problemId())) {
                throw new BizException(400, "发布题目与源题单不一致");
            }
            String visibility = item.visibility().trim().toUpperCase();
            if (!Set.of("VISIBLE", "HIDDEN").contains(visibility)) {
                throw new BizException(400, "题目状态仅支持公开或隐藏");
            }
            result.put(item.problemId(), visibility);
        }
        if (!result.keySet().equals(expectedProblemIds)) {
            throw new BizException(400, "必须设置题单内每道题目的公开状态");
        }
        return result;
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
}
