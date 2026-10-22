package com.qoj.module.course.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.qoj.common.PageResult;
import com.qoj.common.exception.BizException;
import com.qoj.module.classroom.entity.ClassMember;
import com.qoj.module.classroom.entity.ClassRoom;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.classroom.mapper.ClassRoomMapper;
import com.qoj.module.course.dto.CourseRequest;
import com.qoj.module.course.entity.Course;
import com.qoj.module.course.entity.CourseClass;
import com.qoj.module.course.mapper.CourseClassMapper;
import com.qoj.module.course.mapper.CourseMapper;
import com.qoj.module.course.vo.CourseClassVO;
import com.qoj.module.course.vo.CoursePracticeVO;
import com.qoj.module.course.vo.CourseReportVO;
import com.qoj.module.course.vo.CourseVO;
import com.qoj.module.practice.entity.PracticePublication;
import com.qoj.module.practice.entity.PracticePublicationClass;
import com.qoj.module.practice.mapper.PracticePublicationClassMapper;
import com.qoj.module.practice.mapper.PracticePublicationMapper;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CourseService {
    private final CourseMapper courseMapper;
    private final CourseClassMapper courseClassMapper;
    private final ClassRoomMapper classMapper;
    private final ClassMemberMapper memberMapper;
    private final UserMapper userMapper;
    private final PracticePublicationMapper publicationMapper;
    private final PracticePublicationClassMapper publicationClassMapper;

    public CourseService(CourseMapper courseMapper, CourseClassMapper courseClassMapper,
        ClassRoomMapper classMapper, ClassMemberMapper memberMapper, UserMapper userMapper,
        PracticePublicationMapper publicationMapper, PracticePublicationClassMapper publicationClassMapper) {
        this.courseMapper = courseMapper;
        this.courseClassMapper = courseClassMapper;
        this.classMapper = classMapper;
        this.memberMapper = memberMapper;
        this.userMapper = userMapper;
        this.publicationMapper = publicationMapper;
        this.publicationClassMapper = publicationClassMapper;
    }

    public PageResult<CourseVO> list(boolean management, int page, int pageSize, String keyword) {
        AuthUser user = CurrentUser.required();
        Long classId = null;
        QueryWrapper<Course> filter = new QueryWrapper<>();
        QueryWrapper<Course> count = new QueryWrapper<>();
        if (management) {
            requireManager();
            if (!user.isAdmin()) {
                filter.eq("c.owner_account_type", user.accountType()).eq("c.owner_id", user.id());
                count.eq("owner_account_type", user.accountType()).eq("owner_id", user.id());
            }
        } else {
            if (!"USER".equals(user.accountType())) return new PageResult<>(0, List.of());
            classId = studentClassId(user.id());
            if (classId == null) return new PageResult<>(0, List.of());
            filter.apply("c.id IN (SELECT course_id FROM course_classes WHERE class_id = {0})", classId)
                .in("c.status", "ACTIVE", "ARCHIVED");
            count.apply("id IN (SELECT course_id FROM course_classes WHERE class_id = {0})", classId)
                .in("status", "ACTIVE", "ARCHIVED");
        }
        if (keyword != null && !keyword.isBlank()) {
            filter.like("c.title", keyword.trim());
            count.like("title", keyword.trim());
        }
        long total = courseMapper.selectCount(count);
        int size = Math.max(1, Math.min(100, pageSize));
        long offset = (long) (Math.max(1, page) - 1) * size;
        filter.orderByDesc("c.created_at").orderByDesc("c.id").last("LIMIT " + size + " OFFSET " + offset);
        return new PageResult<>(total, withClasses(courseMapper.summaries(filter), classId));
    }

    public CourseVO detail(long id, boolean management) {
        Long classId = null;
        if (management) requireManaged(id);
        else { requireStudent(id); classId = studentClassId(CurrentUser.required().id()); }
        return withClasses(courseMapper.summaries(new QueryWrapper<Course>().eq("c.id", id)), classId).get(0);
    }

    private List<CourseVO> withClasses(List<CourseVO> values, Long studentClassId) {
        if (values.isEmpty()) return values;
        QueryWrapper<CourseClass> filter = new QueryWrapper<CourseClass>()
            .in("cc.course_id", values.stream().map(CourseVO::id).toList());
        if (studentClassId != null) filter.eq("cc.class_id", studentClassId);
        filter.orderByAsc("cc.class_id");
        Map<Long, List<CourseClassVO>> classes = courseClassMapper.classes(filter).stream()
            .collect(Collectors.groupingBy(CourseClassVO::courseId));
        return values.stream().map(c -> c.withClasses(classes.getOrDefault(c.id(), List.of()))).toList();
    }

    @Transactional
    public CourseVO create(CourseRequest request) {
        AuthUser owner = requireManager();
        List<Long> classes = validate(request, owner.accountType(), owner.id());
        Course course = new Course();
        course.ownerAccountType = owner.accountType();
        course.ownerId = owner.id();
        apply(course, request, classes);
        courseMapper.insert(course);
        updateClasses(course.id, classes);
        return detail(course.id, true);
    }

    @Transactional
    public CourseVO update(long id, CourseRequest request) {
        Course course = requireManagedLocked(id);
        List<Long> classes = validate(request, course.ownerAccountType, course.ownerId);
        apply(course, request, classes);
        courseMapper.update(null, new UpdateWrapper<Course>().eq("id", id)
            .set("title", course.title).set("description", course.description).set("term", course.term)
            .set("class_id", course.classId).set("status", course.status));
        updateClasses(id, classes);
        return detail(id, true);
    }

    // Shares the course lock with publication creation. Updating associations does not move or delete work.
    private void updateClasses(Long courseId, List<Long> classIds) {
        courseClassMapper.delete(new QueryWrapper<CourseClass>().eq("course_id", courseId));
        for (Long classId : classIds) {
            CourseClass value = new CourseClass(); value.courseId = courseId; value.classId = classId;
            courseClassMapper.insert(value);
        }
        List<PracticePublication> publications = publicationMapper.selectList(
            new QueryWrapper<PracticePublication>().eq("course_id", courseId));
        for (PracticePublication publication : publications) {
            publicationClassMapper.delete(new QueryWrapper<PracticePublicationClass>().eq("publication_id", publication.id));
            for (Long classId : classIds) {
                PracticePublicationClass grant = new PracticePublicationClass();
                grant.publicationId = publication.id; grant.classId = classId;
                publicationClassMapper.insert(grant);
            }
        }
    }

    @Transactional
    public void archive(long id) {
        requireManagedLocked(id);
        courseMapper.update(null, new UpdateWrapper<Course>().eq("id", id).set("status", "ARCHIVED"));
    }

    public Course requireManaged(long id) {
        AuthUser user = requireManager();
        Course course = courseMapper.selectById(id);
        if (course == null) throw new BizException(404, "课程不存在");
        checkOwner(user, course);
        return course;
    }

    public Course requireManagedLocked(long id) {
        AuthUser user = requireManager();
        Course course = courseMapper.selectOne(new QueryWrapper<Course>().eq("id", id).last("FOR UPDATE"));
        if (course == null) throw new BizException(404, "课程不存在");
        checkOwner(user, course);
        return course;
    }

    private void checkOwner(AuthUser user, Course course) {
        if (!user.isAdmin() && (!user.accountType().equals(course.ownerAccountType) || !user.id().equals(course.ownerId)))
            throw new BizException(403, "只能管理自己的课程");
    }

    public List<Long> classIds(Long courseId) { return courseClassMapper.classIds(courseId); }

    public List<Long> classIdsLocked(Long courseId) { return courseClassMapper.classIdsLocked(courseId); }

    public boolean studentCanAccess(Long courseId, Long userId, boolean submitting) {
        Course course = courseMapper.selectById(courseId);
        if (course == null || !Set.of("ACTIVE", "ARCHIVED").contains(course.status)
            || (submitting && !"ACTIVE".equals(course.status))) return false;
        Long classId = studentClassId(userId);
        return classId != null && courseClassMapper.selectCount(new QueryWrapper<CourseClass>()
            .eq("course_id", courseId).eq("class_id", classId)) > 0;
    }

    public Course requireStudent(long id) {
        AuthUser student = CurrentUser.required();
        if (!"USER".equals(student.accountType()) || !studentCanAccess(id, student.id(), false))
            throw new BizException(404, "课程不存在或未加入关联班级");
        return courseMapper.selectById(id);
    }

    public List<CoursePracticeVO> studentPractices(long id) {
        requireStudent(id);
        return courseMapper.studentPractices(id, CurrentUser.required().id(), LocalDateTime.now());
    }

    public CourseReportVO report(long id) {
        requireManaged(id);
        int count = Math.toIntExact(publicationMapper.selectCount(new QueryWrapper<PracticePublication>()
            .eq("course_id", id).eq("status", "PUBLISHED")));
        return new CourseReportVO(id, count, courseMapper.studentProgress(id));
    }

    private Long studentClassId(Long userId) {
        if (userId == null) return null;
        User user = userMapper.selectById(userId);
        if (user == null || !"STUDENT".equals(user.role) || user.classId == null) return null;
        return memberMapper.selectCount(new QueryWrapper<ClassMember>()
            .eq("user_id", userId).eq("class_id", user.classId)) > 0 ? user.classId : null;
    }

    private AuthUser requireManager() {
        AuthUser user = CurrentUser.required();
        if (!user.teacherAccount() && !user.isAdmin()) throw new BizException(403, "仅教师或管理员可以管理课程");
        return user;
    }

    private List<Long> validate(CourseRequest request, String ownerAccountType, Long ownerId) {
        if (!Set.of("DRAFT", "ACTIVE", "ARCHIVED").contains(request.status())) throw new BizException(400, "课程状态无效");
        List<Long> requested = request.classIds() == null
            ? (request.classId() == null ? List.of() : List.of(request.classId())) : request.classIds();
        if (requested.stream().anyMatch(id -> id == null || id <= 0)) throw new BizException(400, "班级参数无效");
        List<Long> classIds = requested.stream().distinct().sorted().toList();
        if (classIds.isEmpty() && !"DRAFT".equals(request.status())) throw new BizException(400, "发布课程前请选择至少一个班级");
        for (Long classId : classIds) {
            ClassRoom room = classMapper.selectById(classId);
            if (room == null) throw new BizException(404, "班级不存在");
            if ("TEACHER".equals(ownerAccountType) && !ownerId.equals(room.teacherId))
                throw new BizException(403, "课程只能关联任课教师自己管理的班级");
        }
        return classIds;
    }

    private void apply(Course course, CourseRequest request, List<Long> classIds) {
        course.title = request.title().trim();
        course.description = request.description() == null ? "" : request.description().trim();
        course.term = request.term() == null ? "" : request.term().trim();
        course.classId = classIds.isEmpty() ? null : classIds.get(0);
        course.status = request.status();
    }
}
