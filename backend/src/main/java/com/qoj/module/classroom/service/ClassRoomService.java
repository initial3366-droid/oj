package com.qoj.module.classroom.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.ErrorCode;
import com.qoj.common.enums.UserRole;
import com.qoj.common.exception.BizException;
import com.qoj.module.classroom.dto.ClassJoinApplicationRequest;
import com.qoj.module.classroom.dto.ClassRoomCreateRequest;
import com.qoj.module.classroom.dto.ClassRoomUpdateRequest;
import com.qoj.module.classroom.dto.StudentImportRequest;
import com.qoj.module.classroom.dto.TeacherCreateRequest;
import com.qoj.module.classroom.dto.TeacherUpdateRequest;
import com.qoj.module.classroom.dto.UpdateStudentRequest;
import com.qoj.module.classroom.entity.ClassJoinApplication;
import com.qoj.module.classroom.entity.ClassMember;
import com.qoj.module.classroom.entity.ClassRoom;
import com.qoj.module.classroom.mapper.ClassJoinApplicationMapper;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.classroom.mapper.ClassRoomMapper;
import com.qoj.module.classroom.vo.ClassJoinApplicationVO;
import com.qoj.module.classroom.vo.ClassRoomMemberVO;
import com.qoj.module.classroom.vo.ClassRoomVO;
import com.qoj.module.classroom.vo.StudentImportResultVO;
import com.qoj.module.classroom.vo.TeacherVO;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestAudience;
import com.qoj.module.contest.mapper.ContestAudienceMapper;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.practice.entity.Practice;
import com.qoj.module.practice.mapper.PracticeMapper;
import com.qoj.module.teacher.entity.Major;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.MajorMapper;
import com.qoj.module.teacher.mapper.TeacherMapper;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.entity.UserScore;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.user.mapper.UserScoreMapper;
import com.qoj.module.user.vo.UserVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 班级Room业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class ClassRoomService {
    private static final int RANDOM_ID_RETRY = 30;
    private static final TypeReference<Map<String, String>> STRING_MAP_TYPE = new TypeReference<>() {};
    private static final Pattern TAG_PATTERN = Pattern.compile("<[^>]*>");
    private static final Pattern SCRIPT_PATTERN = Pattern.compile("(?i)<\\s*script[^>]*>.*?<\\s*/\\s*script\\s*>");

    private final ClassRoomMapper classRoomMapper;
    private final ClassMemberMapper classMemberMapper;
    private final ClassJoinApplicationMapper applicationMapper;
    private final UserMapper userMapper;
    private final TeacherMapper teacherMapper;
    private final MajorMapper majorMapper;
    private final UserScoreMapper userScoreMapper;
    private final AdminUserMapper adminUserMapper;
    private final ContestMapper contestMapper;
    private final ContestAudienceMapper contestAudienceMapper;
    private final PracticeMapper practiceMapper;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    /**
     * 构造 班级RoomService 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
    public ClassRoomService(
        ClassRoomMapper classRoomMapper,
        ClassMemberMapper classMemberMapper,
        ClassJoinApplicationMapper applicationMapper,
        UserMapper userMapper,
        TeacherMapper teacherMapper,
        MajorMapper majorMapper,
        UserScoreMapper userScoreMapper,
        AdminUserMapper adminUserMapper,
        ContestMapper contestMapper,
        ContestAudienceMapper contestAudienceMapper,
        PracticeMapper practiceMapper,
        PasswordEncoder passwordEncoder,
        ObjectMapper objectMapper
    ) {
        this.classRoomMapper = classRoomMapper;
        this.classMemberMapper = classMemberMapper;
        this.applicationMapper = applicationMapper;
        this.userMapper = userMapper;
        this.teacherMapper = teacherMapper;
        this.majorMapper = majorMapper;
        this.userScoreMapper = userScoreMapper;
        this.adminUserMapper = adminUserMapper;
        this.contestMapper = contestMapper;
        this.contestAudienceMapper = contestAudienceMapper;
        this.practiceMapper = practiceMapper;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = objectMapper;
    }

    public List<ClassRoomVO> adminList(String keyword) {
        QueryWrapper<ClassRoom> wrapper = new QueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            wrapper.like("name", keyword.trim());
        }
        wrapper.orderByDesc("created_at");
        return classRoomMapper.selectList(wrapper).stream().map(item -> toVO(item, false)).toList();
    }

    public ClassRoomVO adminDetail(long classId) {
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(requireClass(classId), true);
    }

    @Transactional
    public ClassRoomVO adminCreate(ClassRoomCreateRequest request) {
        if (request.teacherId() == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "请选择教师");
        }
        Teacher teacher = requireTeacher(request.teacherId());
        ClassRoom classRoom = newClassRoom(request, teacher.id);
        classRoomMapper.insert(classRoom);
        /**
         * 构造或转换VO。从持久化层读取数据。
         */
        return toVO(classRoomMapper.selectById(classRoom.id), true);
    }

    @Transactional
    public ClassRoomVO adminUpdate(long classId, ClassRoomUpdateRequest request) {
        ClassRoom classRoom = requireClass(classId);
        applyClassUpdate(classRoom, request, true);
        classRoomMapper.updateById(classRoom);
        /**
         * 构造或转换VO。从持久化层读取数据。
         */
        return toVO(classRoomMapper.selectById(classRoom.id), true);
    }

    @Transactional
    public void adminDelete(long classId) {
        requireClass(classId);
        cleanupClassReferences(classId);
        userMapper.update(null, new UpdateWrapper<User>().eq("class_id", classId).set("class_id", null));
        applicationMapper.delete(new QueryWrapper<ClassJoinApplication>().eq("class_id", classId));
        classMemberMapper.delete(new QueryWrapper<ClassMember>().eq("class_id", classId));
        classRoomMapper.deleteById(classId);
    }

    public List<TeacherVO> listTeachers(String keyword) {
        QueryWrapper<Teacher> wrapper = new QueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            String value = keyword.trim();
            wrapper.and(item -> item
                .like("username", value)
                .or()
                .like("display_name", value)
                .or()
                .like("teacher_no", value)
                .or()
                .like("email", value)
            );
        }
        wrapper.orderByDesc("created_at");
        return teacherMapper.selectList(wrapper).stream().map(this::toTeacherVO).toList();
    }

    @Transactional
    public TeacherVO createTeacher(TeacherCreateRequest request) {
        ensureUnique("username", request.username(), null, "用户名已存在");
        ensureUnique("teacher_no", request.teacherNo(), null, "教师编号已存在");
        ensureUnique("email", request.email(), null, "邮箱已存在");
        Major major = requireActiveMajor(request.majorId());
        Teacher teacher = new Teacher();
        teacher.username = request.username().trim();
        teacher.passwordHash = passwordEncoder.encode(request.password());
        teacher.displayName = request.displayName().trim();
        teacher.teacherNo = blankToNull(request.teacherNo());
        teacher.email = blankToNull(request.email());
        teacher.majorId = major.id;
        teacher.status = "ACTIVE";
        teacherMapper.insert(teacher);
        /**
         * 构造或转换教师VO。从持久化层读取数据。
         */
        return toTeacherVO(teacherMapper.selectById(teacher.id));
    }

    @Transactional
    public TeacherVO updateTeacher(long teacherId, TeacherUpdateRequest request) {
        Teacher teacher = requireTeacher(teacherId);
        ensureUnique("username", request.username(), teacher.id, "用户名已存在");
        ensureUnique("teacher_no", request.teacherNo(), teacher.id, "教师编号已存在");
        ensureUnique("email", request.email(), teacher.id, "邮箱已存在");
        if (request.username() != null && !request.username().isBlank()) {
            teacher.username = request.username().trim();
        }
        if (request.password() != null && !request.password().isBlank()) {
            teacher.passwordHash = passwordEncoder.encode(request.password());
        }
        if (request.displayName() != null && !request.displayName().isBlank()) {
            teacher.displayName = request.displayName().trim();
        }
        if (request.teacherNo() != null) {
            teacher.teacherNo = blankToNull(request.teacherNo());
        }
        if (request.email() != null) {
            teacher.email = blankToNull(request.email());
        }
        if (request.majorId() != null) {
            teacher.majorId = requireActiveMajor(request.majorId()).id;
        }
        if (request.status() != null) {
            String status = request.status().trim().toUpperCase();
            if (!Set.of("ACTIVE", "DISABLED").contains(status)) {
                throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "教师状态无效");
            }
            teacher.status = status;
        }
        teacherMapper.updateById(teacher);
        /**
         * 构造或转换教师VO。从持久化层读取数据。
         */
        return toTeacherVO(teacherMapper.selectById(teacher.id));
    }

    @Transactional
    public void deleteTeacher(long teacherId) {
        Teacher teacher = requireTeacher(teacherId);
        Long classCount = classRoomMapper.selectCount(new QueryWrapper<ClassRoom>().eq("teacher_id", teacher.id));
        if (classCount != null && classCount > 0) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "该教师仍有关联班级，请先转移或删除班级");
        }
        teacherMapper.deleteById(teacher.id);
    }

    public List<ClassRoomVO> teacherClasses() {
        AuthUser teacher = requireTeacherAccount();
        return classRoomMapper
            .selectList(new QueryWrapper<ClassRoom>().eq("teacher_id", teacher.id()).orderByDesc("created_at"))
            .stream()
            .map(item -> toVO(item, false))
            .toList();
    }

    public ClassRoomVO teacherClassDetail(long classId) {
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(requireManagedClass(classId), true);
    }

    @Transactional
    public ClassRoomVO teacherCreate(ClassRoomCreateRequest request) {
        AuthUser teacher = requireTeacherAccount();
        ClassRoom classRoom = newClassRoom(request, teacher.id());
        classRoomMapper.insert(classRoom);
        /**
         * 构造或转换VO。从持久化层读取数据。
         */
        return toVO(classRoomMapper.selectById(classRoom.id), true);
    }

    @Transactional
    public ClassRoomVO teacherUpdate(long classId, ClassRoomUpdateRequest request) {
        ClassRoom classRoom = requireManagedClass(classId);
        applyClassUpdate(classRoom, request, false);
        classRoomMapper.updateById(classRoom);
        /**
         * 构造或转换VO。从持久化层读取数据。
         */
        return toVO(classRoomMapper.selectById(classRoom.id), true);
    }

    @Transactional
    public void teacherDelete(long classId, String password) {
        AuthUser teacher = requireTeacherAccount();
        Teacher currentTeacher = teacherMapper.selectById(teacher.id());
        if (currentTeacher == null || !passwordEncoder.matches(password, currentTeacher.passwordHash)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "密码错误");
        }
        requireManagedClass(classId);
        cleanupClassReferences(classId);
        userMapper.update(null, new UpdateWrapper<User>().eq("class_id", classId).set("class_id", null));
        applicationMapper.delete(new QueryWrapper<ClassJoinApplication>().eq("class_id", classId));
        classMemberMapper.delete(new QueryWrapper<ClassMember>().eq("class_id", classId));
        classRoomMapper.deleteById(classId);
    }

    public List<ClassRoomMemberVO> teacherStudents(Long classId) {
        List<Long> classIds = managedClassIds();
        if (classId != null) {
            requireManagedClass(classId);
            classIds = List.of(classId);
        }
        if (classIds.isEmpty()) {
            return List.of();
        }
        return classMemberMapper
            .selectList(new QueryWrapper<ClassMember>().in("class_id", classIds).orderByDesc("joined_at"))
            .stream()
            .map(this::toMemberVO)
            .toList();
    }

    public UserVO teacherStudentDetail(long userId) {
        List<Long> classIds = managedClassIds();
        if (classIds.isEmpty()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无班级管理权限");
        }
        ClassMember member = classMemberMapper.selectOne(
            new QueryWrapper<ClassMember>()
                .eq("user_id", userId)
                .in("class_id", classIds)
                .last("LIMIT 1")
        );
        if (member == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "只能查看自己班级的学生");
        }
        User user = userMapper.selectById(userId);
        if (user == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "用户不存在");
        }
        ClassRoom classRoom = member.classId == null ? null : classRoomMapper.selectById(member.classId);
        /**
         * 封装rVO相关逻辑。执行持久化写入。
         */
        return new UserVO(
            user.id,
            user.username,
            user.displayName,
            user.avatarUrl,
            user.studentNo,
            user.email,
            user.role,
            classRoom == null ? null : classRoom.name,
            user.createdAt,
            user.updatedAt
        );
    }

    @Transactional
    public StudentImportResultVO importStudents(StudentImportRequest request) {
        ClassRoom classRoom = requireManagedClass(request.classId());
        validateImportFields(request);
        List<String> fields = normalizedFields(request);
        String batchId = UUID.randomUUID().toString();
        List<StudentImportResultVO.RowSuccess> successes = new ArrayList<>();
        List<StudentImportResultVO.RowError> errors = new ArrayList<>();
        int success = 0;

        for (int index = 0; index < request.rows().size(); index++) {
            int rowNumber = index + 2;
            Map<String, String> row = request.rows().get(index);
            String studentNo = value(row, request.studentNoField());
            String displayName = value(row, request.nameField());
            if (studentNo == null || studentNo.isBlank()) {
                errors.add(new StudentImportResultVO.RowError(rowNumber, null, "学号不能为空"));
                continue;
            }
            if (displayName == null || displayName.isBlank()) {
                errors.add(new StudentImportResultVO.RowError(rowNumber, studentNo, "姓名不能为空"));
                continue;
            }
            try {
                upsertImportedStudent(classRoom, fields, row, studentNo.trim(), displayName.trim(), batchId);
                successes.add(new StudentImportResultVO.RowSuccess(rowNumber, studentNo.trim(), displayName.trim()));
                success += 1;
            } catch (BizException ex) {
                errors.add(new StudentImportResultVO.RowError(rowNumber, studentNo, ex.getMessage()));
            } catch (RuntimeException ex) {
                errors.add(new StudentImportResultVO.RowError(rowNumber, studentNo, "导入失败"));
            }
        }
        /**
         * 封装StudentImport结果VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new StudentImportResultVO(success, errors.size(), successes, errors);
    }

    private void validateImportFields(StudentImportRequest request) {
        if (request.rows() == null || request.rows().isEmpty()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "导入文件没有学生数据");
        }
        Map<String, String> firstRow = request.rows().get(0);
        if (firstRow == null || !firstRow.containsKey(request.studentNoField())) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "导入文件缺少学号字段：" + request.studentNoField());
        }
        if (!firstRow.containsKey(request.nameField())) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "导入文件缺少姓名字段：" + request.nameField());
        }
    }

    public List<ClassJoinApplicationVO> teacherApplications(Long classId) {
        List<Long> ids = managedClassIds();
        if (classId != null) {
            requireManagedClass(classId);
            ids = List.of(classId);
        }
        if (ids.isEmpty()) {
            return List.of();
        }
        return applicationMapper
            .selectList(new QueryWrapper<ClassJoinApplication>().in("class_id", ids).orderByDesc("created_at"))
            .stream()
            .map(this::toApplicationVO)
            .toList();
    }

    @Transactional
    public ClassJoinApplicationVO apply(long classId, ClassJoinApplicationRequest request) {
        AuthUser authUser = CurrentUser.required();
        if (authUser.adminAccount() || authUser.teacherAccount()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "该入口仅学生可申请加入班级");
        }
        ClassRoom classRoom = requireClass(classId);
        if (Boolean.FALSE.equals(classRoom.joinEnabled)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "该班级暂不允许加入");
        }
        User user = requireActiveUser(authUser.id());
        if (user.classId != null && !Objects.equals(user.classId, classRoom.id)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "你已加入其他班级");
        }
        if (isMember(classRoom.id, user.id)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "你已加入该班级");
        }
        Long pending = applicationMapper.selectCount(
            new QueryWrapper<ClassJoinApplication>()
                .eq("class_id", classRoom.id)
                .eq("user_id", user.id)
                .eq("status", "PENDING")
        );
        if (pending != null && pending > 0) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "已有待处理申请");
        }

        ClassJoinApplication application = new ClassJoinApplication();
        application.classId = classRoom.id;
        application.userId = user.id;
        application.reason = blankToNull(request == null ? null : request.reason());
        application.status = Boolean.FALSE.equals(classRoom.approvalRequired) ? "APPROVED" : "PENDING";
        if ("APPROVED".equals(application.status)) {
            application.handledAt = LocalDateTime.now();
            upsertMember(classRoom.id, user, "APPLICATION", null, null);
        }
        applicationMapper.insert(application);
        /**
         * 构造或转换ApplicationVO。从持久化层读取数据。
         */
        return toApplicationVO(applicationMapper.selectById(application.id));
    }

    @Transactional
    public ClassJoinApplicationVO approve(long applicationId) {
        ClassJoinApplication application = requireApplication(applicationId);
        ClassRoom classRoom = requireManagedClass(application.classId);
        if (!"PENDING".equals(application.status)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "申请已处理");
        }
        User user = requireActiveUser(application.userId);
        if (user.classId != null && !Objects.equals(user.classId, classRoom.id)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "该学生已加入其他班级");
        }
        upsertMember(classRoom.id, user, "APPLICATION", null, null);
        application.status = "APPROVED";
        application.handledAt = LocalDateTime.now();
        application.handledBy = CurrentUser.required().id();
        application.handledByAccountType = CurrentUser.required().accountType();
        applicationMapper.updateById(application);
        /**
         * 构造或转换ApplicationVO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toApplicationVO(application);
    }

    @Transactional
    public ClassJoinApplicationVO reject(long applicationId) {
        ClassJoinApplication application = requireApplication(applicationId);
        requireManagedClass(application.classId);
        if (!"PENDING".equals(application.status)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "申请已处理");
        }
        application.status = "REJECTED";
        application.handledAt = LocalDateTime.now();
        application.handledBy = CurrentUser.required().id();
        application.handledByAccountType = CurrentUser.required().accountType();
        applicationMapper.updateById(application);
        /**
         * 构造或转换ApplicationVO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toApplicationVO(application);
    }

    @Transactional
    public ClassRoomVO removeMember(long classId, long userId) {
        ClassRoom classRoom = requireManagedClass(classId);
        if (classRoom.teacherId != null && classRoom.teacherId.equals(userId)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "不能移除班级教师");
        }
        classMemberMapper.delete(new QueryWrapper<ClassMember>().eq("class_id", classId).eq("user_id", userId));
        User user = userMapper.selectById(userId);
        if (user != null && Objects.equals(user.classId, classId)) {
            user.classId = null;
            userMapper.updateById(user);
        }
        /**
         * 构造或转换VO。从持久化层读取数据。
         */
        return toVO(classRoomMapper.selectById(classId), true);
    }

    @Transactional
    public ClassRoomMemberVO teacherUpdateStudent(long userId, UpdateStudentRequest request) {
        User user = requireManagedStudent(userId);

        if (request.displayName() != null && !request.displayName().isBlank()) {
            user.displayName = request.displayName().trim();
        }
        if (request.studentNo() != null && !request.studentNo().isBlank()) {
            user.studentNo = request.studentNo().trim();
        }
        if (request.email() != null) {
            user.email = request.email().trim();
        }
        if (request.password() != null && !request.password().isBlank()) {
            int passwordLength = request.password().length();
            if (passwordLength < 6 || passwordLength > 64) {
                throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "密码长度必须在6-64个字符之间");
            }
            user.passwordHash = passwordEncoder.encode(request.password());
        }
        userMapper.updateById(user);

        ClassMember member = classMemberMapper.selectOne(
            new QueryWrapper<ClassMember>().eq("class_id", user.classId).eq("user_id", userId));
        /**
         * 构造或转换MemberVO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toMemberVO(member);
    }


    public User requireManagedStudent(long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "用户不存在");
        }
        if (user.classId == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "该学生不属于任何班级");
        }
        requireManagedClass(user.classId);
        return user;
    }

    private void upsertImportedStudent(
        ClassRoom classRoom,
        List<String> fields,
        Map<String, String> row,
        String studentNo,
        String displayName,
        String batchId
    ) {
        User user = userMapper.selectOne(new QueryWrapper<User>().eq("student_no", studentNo));
        if (user == null) {
            user = userMapper.selectOne(new QueryWrapper<User>().eq("username", studentNo));
        }
        if (user != null && user.classId != null && !Objects.equals(user.classId, classRoom.id)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "学生已属于其他班级");
        }
        if (user == null) {
            ensureUnique("username", studentNo, null, "用户名已存在");
            ensureUnique("student_no", studentNo, null, "学号已存在");
            user = new User();
            user.username = studentNo;
            user.studentNo = studentNo;
            user.displayName = displayName;
            user.passwordHash = passwordEncoder.encode(defaultStudentPassword(studentNo));
            user.role = UserRole.STUDENT.name();
            user.classId = classRoom.id;
            userMapper.insert(user);
            ensureScore(user.id);
        } else {
            if (!UserRole.STUDENT.name().equals(user.role)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "该账号不是学生账号");
            }
            user.displayName = displayName;
            if (user.studentNo == null || user.studentNo.isBlank()) {
                user.studentNo = studentNo;
            }
            user.classId = classRoom.id;
            userMapper.updateById(user);
            ensureScore(user.id);
        }
        upsertMember(classRoom.id, user, "IMPORT", batchId, profileJson(fields, row));
    }

    private void upsertMember(Long classId, User user, String source, String importBatchId, String profileFields) {
        ClassMember existing = classMemberMapper.selectOne(
            new QueryWrapper<ClassMember>().eq("class_id", classId).eq("user_id", user.id)
        );
        if (existing == null) {
            ClassMember member = new ClassMember();
            member.classId = classId;
            member.userId = user.id;
            member.source = source;
            member.importBatchId = importBatchId;
            member.profileFields = profileFields;
            member.joinedAt = LocalDateTime.now();
            classMemberMapper.insert(member);
        } else {
            UpdateWrapper<ClassMember> update = new UpdateWrapper<ClassMember>()
                .eq("class_id", classId)
                .eq("user_id", user.id)
                .set("source", source)
                .set("import_batch_id", importBatchId);
            if (profileFields != null) {
                update.set("profile_fields", profileFields);
            }
            classMemberMapper.update(null, update);
        }
        user.classId = classId;
        userMapper.updateById(user);
    }

    private ClassRoom newClassRoom(ClassRoomCreateRequest request, Long teacherId) {
        ClassRoom classRoom = new ClassRoom();
        classRoom.id = generateClassId();
        classRoom.name = request.name().trim();
        classRoom.description = blankToNull(request.description());
        classRoom.teacherId = teacherId;
        classRoom.joinEnabled = request.joinEnabled() == null || Boolean.TRUE.equals(request.joinEnabled());
        classRoom.approvalRequired = request.approvalRequired() == null || Boolean.TRUE.equals(request.approvalRequired());
        return classRoom;
    }

    private void applyClassUpdate(ClassRoom classRoom, ClassRoomUpdateRequest request, boolean allowTeacherChange) {
        if (request.name() != null && !request.name().isBlank()) {
            classRoom.name = request.name().trim();
        }
        if (request.description() != null) {
            classRoom.description = blankToNull(request.description());
        }
        if (allowTeacherChange && request.teacherId() != null) {
            classRoom.teacherId = requireTeacher(request.teacherId()).id;
        }
        if (request.joinEnabled() != null) {
            classRoom.joinEnabled = request.joinEnabled();
        }
        if (request.approvalRequired() != null) {
            classRoom.approvalRequired = request.approvalRequired();
        }
    }

    private void cleanupClassReferences(Long classId) {
        Set<Long> affectedContestIds = new LinkedHashSet<>();
        contestAudienceMapper
            .selectList(new QueryWrapper<ContestAudience>().eq("audience_type", "CLASS").eq("audience_id", classId))
            .stream()
            .map(audience -> audience.contestId)
            .forEach(affectedContestIds::add);
        contestMapper
            .selectList(new QueryWrapper<Contest>().eq("audience", "CLASS").eq("audience_id", classId))
            .stream()
            .map(contest -> contest.id)
            .forEach(affectedContestIds::add);
        contestAudienceMapper.delete(new QueryWrapper<ContestAudience>().eq("audience_type", "CLASS").eq("audience_id", classId));
        for (Long contestId : affectedContestIds) {
            contestMapper.update(
                null,
                new UpdateWrapper<Contest>()
                    .eq("id", contestId)
                    .eq("audience", "CLASS")
                    .eq("audience_id", classId)
                    .set("audience", "ALL")
                    .set("audience_id", 0)
            );
        }
        practiceMapper.update(
            null,
            new UpdateWrapper<Practice>()
                .eq("audience", "CLASS")
                .eq("audience_id", classId)
                .set("audience", "ALL")
                .set("audience_id", null)
        );
    }

    private ClassRoom requireClass(Long classId) {
        ClassRoom classRoom = classRoomMapper.selectById(classId);
        if (classRoom == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "班级不存在");
        }
        return classRoom;
    }

    private ClassRoom requireManagedClass(Long classId) {
        ClassRoom classRoom = requireClass(classId);
        AuthUser authUser = CurrentUser.required();
        if ("SUPER_ADMIN".equals(authUser.role())) {
            return classRoom;
        }
        if (!authUser.teacherAccount() || !Objects.equals(classRoom.teacherId, authUser.id())) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无班级管理权限");
        }
        return classRoom;
    }

    private AuthUser requireTeacherAccount() {
        AuthUser authUser = CurrentUser.required();
        if (!authUser.teacherAccount()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "仅教师可访问");
        }
        return authUser;
    }

    private List<Long> managedClassIds() {
        AuthUser teacher = requireTeacherAccount();
        return classRoomMapper
            .selectList(new QueryWrapper<ClassRoom>().eq("teacher_id", teacher.id()))
            .stream()
            .map(item -> item.id)
            .toList();
    }

    private ClassJoinApplication requireApplication(Long applicationId) {
        ClassJoinApplication application = applicationMapper.selectById(applicationId);
        if (application == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "入班申请不存在");
        }
        return application;
    }

    private Teacher requireTeacher(Long teacherId) {
        Teacher teacher = teacherMapper.selectById(teacherId);
        if (teacher == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "教师不存在");
        }
        return teacher;
    }

    private Major requireActiveMajor(Long majorId) {
        if (majorId == null) {
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "请选择专业");
        }
        Major major = majorMapper.selectById(majorId);
        if (major == null || !"ACTIVE".equals(major.status)) {
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "专业不存在或已停用");
        }
        return major;
    }

    private User requireActiveUser(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null || !UserRole.isActiveFrontendRole(user.role)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "用户不存在");
        }
        return user;
    }

    private boolean isMember(Long classId, Long userId) {
        return classMemberMapper.selectCount(
            new QueryWrapper<ClassMember>().eq("class_id", classId).eq("user_id", userId)
        ) > 0;
    }

    private Long generateClassId() {
        for (int i = 0; i < RANDOM_ID_RETRY; i++) {
            long id = ThreadLocalRandom.current().nextLong(100000L, 1000000L);
            if (classRoomMapper.selectById(id) == null) {
                return id;
            }
        }
        /**
         * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
         */
        throw new BizException(ErrorCode.INTERNAL_ERROR.getCode(), "班级 ID 生成失败");
    }

    private void ensureUnique(String column, String value, Long currentUserId, String message) {
        if (value == null || value.isBlank()) {
            return;
        }
        QueryWrapper<User> userWrapper = new QueryWrapper<User>().eq(
            "teacher_no".equals(column) ? "student_no" : column,
            value.trim()
        );
        boolean existsInUsers = userMapper.selectCount(userWrapper) > 0;
        boolean existsInAdmins = ("username".equals(column) || "email".equals(column))
            && adminUserMapper.selectCount(new QueryWrapper<AdminUser>().eq(column, value.trim())) > 0;
        QueryWrapper<Teacher> teacherWrapper = new QueryWrapper<Teacher>().eq(column, value.trim());
        if (currentUserId != null) {
            teacherWrapper.ne("id", currentUserId);
        }
        boolean existsInTeachers = teacherMapper.selectCount(teacherWrapper) > 0;
        if (existsInUsers || existsInAdmins || existsInTeachers) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), message);
        }
    }

    private void ensureScore(Long userId) {
        if (userScoreMapper.selectById(userId) != null) {
            return;
        }
        UserScore score = new UserScore();
        score.userId = userId;
        score.totalScore = 0;
        score.rating = 0;
        score.acCount = 0;
        score.submitCount = 0;
        score.streak = 0;
        userScoreMapper.insert(score);
    }

    private TeacherVO toTeacherVO(Teacher teacher) {
        Long classCount = classRoomMapper.selectCount(new QueryWrapper<ClassRoom>().eq("teacher_id", teacher.id));
        Major major = teacher.majorId == null ? null : majorMapper.selectById(teacher.majorId);
        /**
         * 封装教师VO相关逻辑。执行持久化写入。
         */
        return new TeacherVO(
            teacher.id,
            teacher.username,
            teacher.displayName,
            teacher.teacherNo,
            teacher.email,
            teacher.majorId,
            major == null ? null : major.name,
            teacher.status,
            Math.toIntExact(classCount == null ? 0L : classCount),
            teacher.createdAt,
            teacher.updatedAt
        );
    }

    private ClassRoomVO toVO(ClassRoom classRoom, boolean includeMembers) {
        Teacher teacher = classRoom.teacherId == null ? null : teacherMapper.selectById(classRoom.teacherId);
        Long memberCount = classMemberMapper.selectCount(new QueryWrapper<ClassMember>().eq("class_id", classRoom.id));
        List<ClassRoomMemberVO> members = includeMembers
            ? classMemberMapper
                .selectList(new QueryWrapper<ClassMember>().eq("class_id", classRoom.id).orderByDesc("joined_at"))
                .stream()
                .map(this::toMemberVO)
                .toList()
            : List.of();
        /**
         * 封装班级RoomVO相关逻辑。执行持久化写入。
         */
        return new ClassRoomVO(
            classRoom.id,
            classRoom.name,
            classRoom.description,
            classRoom.teacherId,
            teacher == null ? null : teacher.displayName,
            classRoom.joinEnabled,
            classRoom.approvalRequired,
            Math.toIntExact(memberCount == null ? 0L : memberCount),
            classRoom.createdAt,
            classRoom.updatedAt,
            members
        );
    }

    private ClassRoomMemberVO toMemberVO(ClassMember member) {
        User user = userMapper.selectById(member.userId);
        ClassRoom classRoom = member.classId == null ? null : classRoomMapper.selectById(member.classId);
        /**
         * 封装班级RoomMemberVO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new ClassRoomMemberVO(
            member.classId,
            classRoom == null ? null : classRoom.name,
            member.userId,
            user == null ? null : user.username,
            user == null ? null : user.displayName,
            user == null ? null : user.avatarUrl,
            user == null ? null : user.studentNo,
            user == null ? null : user.email,
            member.source,
            readProfile(member.profileFields),
            member.joinedAt
        );
    }

    private ClassJoinApplicationVO toApplicationVO(ClassJoinApplication application) {
        ClassRoom classRoom = classRoomMapper.selectById(application.classId);
        User user = userMapper.selectById(application.userId);
        return new ClassJoinApplicationVO(
            application.id,
            application.classId,
            classRoom == null ? null : classRoom.name,
            application.userId,
            user == null ? null : user.username,
            user == null ? null : user.displayName,
            user == null ? null : user.avatarUrl,
            user == null ? null : user.studentNo,
            application.status,
            application.reason,
            application.createdAt,
            application.handledAt
        );
    }

    private Map<String, String> readProfile(String profileFields) {
        if (profileFields == null || profileFields.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(profileFields, STRING_MAP_TYPE);
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    private String profileJson(List<String> fields, Map<String, String> row) {
        Map<String, String> profile = new LinkedHashMap<>();
        for (String field : fields) {
            if (isIgnoredImportField(field)) {
                continue;
            }
            profile.put(cleanText(field), cleanText(value(row, field)));
        }
        try {
            return objectMapper.writeValueAsString(profile);
        } catch (Exception ex) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "自定义字段格式错误");
        }
    }

    private List<String> normalizedFields(StudentImportRequest request) {
        Set<String> fields = new LinkedHashSet<>();
        if (request.fields() != null) {
            for (String field : request.fields()) {
                if (field != null && !field.isBlank()) {
                    fields.add(field.trim());
                }
            }
        }
        for (Map<String, String> row : request.rows()) {
            fields.addAll(row.keySet());
        }
        fields.add(request.studentNoField().trim());
        fields.add(request.nameField().trim());
        return fields.stream()
            .filter(item -> item != null && !item.isBlank())
            .filter(item -> !isIgnoredImportField(item))
            .toList();
    }

    private boolean isIgnoredImportField(String field) {
        if (field == null) {
            return false;
        }
        String normalized = cleanText(field);
        if (normalized == null) {
            return false;
        }
        normalized = normalized.toLowerCase().replaceAll("[\\s_\\-]", "");
        return "email".equals(normalized)
            || "mail".equals(normalized)
            || "e邮箱".equals(normalized)
            || "邮箱".equals(normalized)
            || "邮箱地址".equals(normalized)
            || "电子邮箱".equals(normalized)
            || "电子邮件".equals(normalized)
            || "phone".equals(normalized)
            || "mobile".equals(normalized)
            || "tel".equals(normalized)
            || "telephone".equals(normalized)
            || "手机号".equals(normalized)
            || "手机".equals(normalized)
            || "手机号码".equals(normalized)
            || "联系电话".equals(normalized)
            || "电话".equals(normalized)
            || "电话号码".equals(normalized)
            || "联系方式".equals(normalized);
    }

    private String value(Map<String, String> row, String field) {
        if (row == null || field == null) {
            return null;
        }
        String value = row.get(field);
        /**
         * 封装cleanText相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return cleanText(value);
    }

    private String cleanText(String value) {
        if (value == null) {
            return null;
        }
        String text = value.replace("\uFEFF", "").trim();
        text = SCRIPT_PATTERN.matcher(text).replaceAll("");
        text = TAG_PATTERN.matcher(text).replaceAll("");
        text = text.replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", "");
        if (!text.isEmpty() && "=+-@".indexOf(text.charAt(0)) >= 0) {
            text = "'" + text;
        }
        return text.length() > 500 ? text.substring(0, 500) : text;
    }

    private String defaultStudentPassword(String studentNo) {
        if (studentNo == null) {
            return "123456";
        }
        String trimmed = studentNo.trim();
        return trimmed.length() <= 6 ? trimmed : trimmed.substring(trimmed.length() - 6);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
