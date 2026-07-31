package com.qoj.module.auth.service;

/**
 * 认证服务 — 处理登录、注册、令牌刷新、登出、个人信息修改。
 *
 * 双通道登录：
 * - loginUser()：前台用户登录（query users 表），管理员账号会返回"请从后台入口登录"
 * - loginAdmin()：后台管理员登录（query admin_users 表），学生账号会返回"前台用户不能登录后台"
 *
 * 令牌安全机制：
 * - Refresh Token 家族（familyId）：检测重放攻击，一旦发现旧令牌复用立即撤销整个家族
 * - 令牌黑名单：登出时将 accessToken 的 jti 加入 Redis 黑名单
 * - 在线状态：登录后记录到 Redis，登出后清除
 *
 * 注册流程：验证邮箱验证码 → 检查用户名/学号/邮箱唯一性 → 创建用户 + 初始化评分记录
 */
import com.qoj.common.exception.BizException;
import com.qoj.common.enums.UserRole;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.auth.dto.AuthTokenResponse;
import com.qoj.module.auth.dto.BindEmailRequest;
import com.qoj.module.auth.dto.FrontendLoginResponse;
import com.qoj.module.auth.dto.LoginRequest;
import com.qoj.module.auth.dto.RefreshTokenRequest;
import com.qoj.module.auth.dto.RegisterRequest;
import com.qoj.module.auth.dto.ResetPasswordRequest;
import com.qoj.module.auth.dto.UpdatePasswordRequest;
import com.qoj.module.auth.dto.UpdateProfileRequest;
import com.qoj.module.classroom.entity.ClassMember;
import com.qoj.module.classroom.entity.ClassRoom;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.classroom.mapper.ClassRoomMapper;
import com.qoj.module.teacher.entity.Major;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.MajorMapper;
import com.qoj.module.teacher.mapper.TeacherMapper;
import com.qoj.module.teacher.vo.TeacherMeVO;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.entity.UserScore;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.user.mapper.UserScoreMapper;
import com.qoj.module.user.vo.UserMeVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.JwtService;
import io.jsonwebtoken.Claims;
import java.time.Duration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

/**
 * 认证业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class AuthService {
    private static final Duration ONLINE_USER_TTL = Duration.ofDays(7);
    private static final Duration LOGIN_LOCK_TTL = Duration.ofMinutes(15);
    private static final int MAX_LOGIN_FAILURES = 5;

    private final UserMapper userMapper;
    private final AdminUserMapper adminUserMapper;
    private final TeacherMapper teacherMapper;
    private final MajorMapper majorMapper;
    private final UserScoreMapper userScoreMapper;
    private final ClassRoomMapper classRoomMapper;
    private final ClassMemberMapper classMemberMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final StringRedisTemplate redisTemplate;

    /**
     * 构造 认证Service 实例并保存其必要依赖或初始状态。从持久化层读取数据；读写 Redis 中的缓存、锁或限流状态。
     */
    public AuthService(
        UserMapper userMapper,
        AdminUserMapper adminUserMapper,
        TeacherMapper teacherMapper,
        MajorMapper majorMapper,
        UserScoreMapper userScoreMapper,
        ClassRoomMapper classRoomMapper,
        ClassMemberMapper classMemberMapper,
        PasswordEncoder passwordEncoder,
        JwtService jwtService,
        StringRedisTemplate redisTemplate
    ) {
        this.userMapper = userMapper;
        this.adminUserMapper = adminUserMapper;
        this.teacherMapper = teacherMapper;
        this.majorMapper = majorMapper;
        this.userScoreMapper = userScoreMapper;
        this.classRoomMapper = classRoomMapper;
        this.classMemberMapper = classMemberMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.redisTemplate = redisTemplate;
    }

    public FrontendLoginResponse login(LoginRequest request) {
        /**
         * 封装登录用户相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return loginUser(request);
    }

    @Transactional
    public FrontendLoginResponse loginUser(LoginRequest request) {
        String username = normalizeLoginName(request.username());
        assertLoginNotLocked("front", username);
        User user = userMapper.selectOne(new QueryWrapper<User>().eq("username", request.username()));
        if (user != null && passwordEncoder.matches(request.password(), user.passwordHash)) {
            if (!UserRole.isActiveFrontendRole(user.role)) {
                recordLoginFailure("front", username);
                /**
                 * 封装BadCredentialsException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                throw new BadCredentialsException("bad credentials");
            }
            resetLoginFailures("front", username);
            /**
             * 判断sueFrontendTokens是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return FrontendLoginResponse.user(issueFrontendTokens(user));
        }

        Teacher teacher = teacherMapper.selectOne(
            new QueryWrapper<Teacher>().eq("username", request.username()).eq("status", "ACTIVE")
        );
        if (teacher != null && passwordEncoder.matches(request.password(), teacher.passwordHash)) {
            resetLoginFailures("front", username);
            return FrontendLoginResponse.teacherPortal();
        }

        recordLoginFailure("front", username);
        /**
         * 封装BadCredentialsException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        throw new BadCredentialsException("bad credentials");
    }

    private AuthTokenResponse issueFrontendTokens(User user) {
        return issueAccountTokens(new AuthUser(user), true);
    }

    public AuthTokenResponse loginTeacher(LoginRequest request) {
        String username = normalizeLoginName(request.username());
        assertLoginNotLocked("teacher", username);
        Teacher teacher = teacherMapper.selectOne(
            new QueryWrapper<Teacher>().eq("username", request.username()).eq("status", "ACTIVE")
        );
        if (teacher == null || !passwordEncoder.matches(request.password(), teacher.passwordHash)) {
            recordLoginFailure("teacher", username);
            throw new BadCredentialsException("bad credentials");
        }
        resetLoginFailures("teacher", username);
        return issueAccountTokens(new AuthUser(teacher), true);
    }

    private AuthTokenResponse issueAccountTokens(AuthUser authUser, boolean recordOnline) {
        JwtService.TokenPair pair = jwtService.issueTokens(authUser);
        if (recordOnline) {
            redisTemplate.opsForValue().set(
                RedisKeys.onlineAccount(authUser.accountType(), authUser.id()), "1", ONLINE_USER_TTL
            );
        }
        redisTemplate.opsForValue().set(
            RedisKeys.refreshTokenFamily(pair.familyId()), pair.refreshToken(), refreshTokenTtl()
        );
        return new AuthTokenResponse(pair.accessToken(), pair.refreshToken());
    }

    private Duration refreshTokenTtl() {
        return Duration.ofSeconds(jwtService.refreshTokenTtlSeconds());
    }

    private String normalizeLoginName(String username) {
        return username == null ? "" : username.trim().toLowerCase();
    }

    private String loginFailureKey(String scope, String username) {
        return "oj:auth:login-fail:" + scope + ":" + username;
    }

    private void assertLoginNotLocked(String scope, String username) {
        String key = loginFailureKey(scope, username);
        String value = redisTemplate.opsForValue().get(key);
        int failures = parseInt(value, 0);
        if (failures >= MAX_LOGIN_FAILURES) {
            Long ttl = redisTemplate.getExpire(key);
            long seconds = ttl == null || ttl < 0 ? LOGIN_LOCK_TTL.toSeconds() : ttl;
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(429, "登录失败次数过多，请 " + seconds + " 秒后再试");
        }
    }

    private void recordLoginFailure(String scope, String username) {
        String key = loginFailureKey(scope, username);
        Long failures = redisTemplate.opsForValue().increment(key);
        if (failures != null && failures == 1L) {
            redisTemplate.expire(key, LOGIN_LOCK_TTL);
        }
    }

    private void resetLoginFailures(String scope, String username) {
        redisTemplate.delete(loginFailureKey(scope, username));
    }

    private int parseInt(String value, int fallback) {
        try {
            return value == null ? fallback : Integer.parseInt(value);
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private void ensureScore(Long userId) {
        if (userId == null || userScoreMapper.selectById(userId) != null) {
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
    //后台登录验证
    public AuthTokenResponse loginAdmin(LoginRequest request) {
        String username = normalizeLoginName(request.username());
        assertLoginNotLocked("admin", username);
        AdminUser adminUser = adminUserMapper.selectOne(new QueryWrapper<AdminUser>().eq("username", request.username()));
        if (adminUser != null && passwordEncoder.matches(request.password(), adminUser.passwordHash)) {
            resetLoginFailures("admin", username);
            JwtService.TokenPair pair = jwtService.issueTokens(new AuthUser(adminUser));

            // 保存 refresh token family 到 Redis
            redisTemplate.opsForValue().set(
                RedisKeys.refreshTokenFamily(pair.familyId()),
                pair.refreshToken(),
                refreshTokenTtl()
            );

            /**
             * 封装认证令牌响应相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new AuthTokenResponse(pair.accessToken(), pair.refreshToken());
        }

        User user = userMapper.selectOne(new QueryWrapper<User>().eq("username", request.username()));
        if (user != null && passwordEncoder.matches(request.password(), user.passwordHash)) {
            recordLoginFailure("admin", username);
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "用户名或密码错误");
        }
        Teacher teacher = teacherMapper.selectOne(new QueryWrapper<Teacher>().eq("username", request.username()));
        if (teacher != null && passwordEncoder.matches(request.password(), teacher.passwordHash)) {
            recordLoginFailure("admin", username);
            throw new BizException(403, "用户名或密码错误");
        }

        recordLoginFailure("admin", username);
        /**
         * 封装BadCredentialsException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        throw new BadCredentialsException("bad credentials");
    }

    public AuthTokenResponse register(RegisterRequest request) {
        // 验证邮箱验证码（邮箱验证码获取时已经验证过图形验证码，所以这里不再验证图形验证码）
        String emailCodeKey = RedisKeys.emailVerificationCode(request.email());
        String storedEmailCode = redisTemplate.opsForValue().get(emailCodeKey);
        if (storedEmailCode == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "邮箱验证码已过期，请重新获取");
        }
        if (!storedEmailCode.equals(request.emailVerificationCode())) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "邮箱验证码错误");
        }

        ensureUnique("username", request.username(), "用户名已存在");
        ensureUnique("student_no", request.studentNo(), "学号已存在");
        ensureUnique("email", request.email(), "邮箱已存在");

        User user = new User();
        user.username = request.username();
        user.passwordHash = passwordEncoder.encode(request.password());
        user.displayName = request.username();
        user.studentNo = request.studentNo();
        user.email = request.email();
        user.role = "STUDENT";
        userMapper.insert(user);

        UserScore score = new UserScore();
        score.userId = user.id;
        score.totalScore = 0;
        score.rating = 0;
        score.acCount = 0;
        score.submitCount = 0;
        score.streak = 0;
        userScoreMapper.insert(score);

        // 删除已使用的邮箱验证码
        redisTemplate.delete(emailCodeKey);

        JwtService.TokenPair pair = jwtService.issueTokens(new AuthUser(user));

        // 保存在线状态
        redisTemplate.opsForValue().set(RedisKeys.onlineUser(user.id), "1", ONLINE_USER_TTL);

        // 保存 refresh token family 到 Redis
        redisTemplate.opsForValue().set(
            RedisKeys.refreshTokenFamily(pair.familyId()),
            pair.refreshToken(),
            refreshTokenTtl()
        );

        /**
         * 封装认证令牌响应相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new AuthTokenResponse(pair.accessToken(), pair.refreshToken());
    }

    public AuthTokenResponse refresh(RefreshTokenRequest request) {
        Claims claims;
        try {
            claims = jwtService.parse(request.refreshToken());
        } catch (Exception e) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(401, "Refresh Token 无效或已过期");
        }

        if (!"refresh".equals(claims.get("typ", String.class))) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(401, "Token 类型错误");
        }

        String jti = claims.getId();
        String familyId = claims.get("familyId", String.class);

        // 检查 refresh token 是否在黑名单
        if (Boolean.TRUE.equals(redisTemplate.hasKey(RedisKeys.refreshTokenBlacklist(jti)))) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(401, "Refresh Token 已失效");
        }

        // 检查 family 是否被撤销
        if (familyId != null) {
            String storedToken = redisTemplate.opsForValue().get(RedisKeys.refreshTokenFamily(familyId));
            if (storedToken == null) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(401, "Refresh Token 家族已失效");
            }
            if (!request.refreshToken().equals(storedToken)) {
                // 检测到 refresh token 重用，撤销整个 family
                redisTemplate.delete(RedisKeys.refreshTokenFamily(familyId));
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(401, "检测到 Token 重用，已撤销所有 Token");
            }
        }

        String accountType = claims.get("accountType", String.class);
        Long accountId = Long.valueOf(claims.getSubject());

        AuthUser authUser;
        if ("ADMIN".equals(accountType)) {
            AdminUser adminUser = adminUserMapper.selectById(accountId);
            if (adminUser == null) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(401, "用户不存在");
            }
            authUser = new AuthUser(adminUser);
        } else if ("TEACHER".equals(accountType)) {
            Teacher teacher = teacherMapper.selectById(accountId);
            if (teacher == null || !"ACTIVE".equals(teacher.status)) {
                throw new BizException(401, "教师账号不存在或已停用");
            }
            authUser = new AuthUser(teacher);
        } else {
            User user = userMapper.selectOne(new QueryWrapper<User>().eq("id", accountId));
            if (user == null || !UserRole.isActiveFrontendRole(user.role)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(401, "用户不存在");
            }
            authUser = new AuthUser(user);
        }

        // 将旧的 refresh token 加入黑名单
        redisTemplate.opsForValue().set(
            RedisKeys.refreshTokenBlacklist(jti),
            "1",
            Duration.ofSeconds(jwtService.remainingSeconds(claims))
        );

        // 签发新的 access token 和 refresh token（轮换）
        String newAccessToken = jwtService.issueAccessToken(authUser);
        String newRefreshToken = familyId != null
            ? jwtService.issueRefreshToken(authUser, familyId)
            : jwtService.issueRefreshToken(authUser, claims.getId());

        // 更新 family 中的最新 token
        if (familyId != null) {
            redisTemplate.opsForValue().set(
                RedisKeys.refreshTokenFamily(familyId),
                newRefreshToken,
                refreshTokenTtl()
            );
        }

        /**
         * 封装认证令牌响应相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new AuthTokenResponse(newAccessToken, newRefreshToken);
    }

    public void logout(String authorization) {
        logout(authorization, null);
    }

    public void logout(String authorization, String refreshToken) {
        Claims accessClaims = parseAuthorizationClaims(authorization);
        if (accessClaims != null) {
            redisTemplate.opsForValue().set(
                RedisKeys.tokenBlacklist(accessClaims.getId()),
                "1",
                Duration.ofSeconds(jwtService.remainingSeconds(accessClaims))
            );
        }

        Claims refreshClaims = parseTokenClaims(refreshToken);
        if (refreshClaims != null && "refresh".equals(refreshClaims.get("typ", String.class))) {
            String familyId = refreshClaims.get("familyId", String.class);
            if (familyId != null) {
                redisTemplate.delete(RedisKeys.refreshTokenFamily(familyId));
            }
            redisTemplate.opsForValue().set(
                RedisKeys.refreshTokenBlacklist(refreshClaims.getId()),
                "1",
                Duration.ofSeconds(jwtService.remainingSeconds(refreshClaims))
            );
        }

        Claims userClaims = accessClaims != null ? accessClaims : refreshClaims;
        if (userClaims != null && !"ADMIN".equals(userClaims.get("accountType", String.class))) {
            String accountType = userClaims.get("accountType", String.class);
            redisTemplate.delete(RedisKeys.onlineAccount(
                accountType == null ? "USER" : accountType,
                Long.valueOf(userClaims.getSubject())
            ));
        }
    }

    private Claims parseAuthorizationClaims(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        /**
         * 解析并规范化令牌Claims。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return parseTokenClaims(authorization.substring(7));
    }

    private Claims parseTokenClaims(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        try {
            return jwtService.parse(token);
        } catch (Exception ignored) {
            return null;
        }
    }

    public UserMeVO adminMe() {
        AuthUser authUser = CurrentUser.required();
        if (!authUser.adminAccount()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "权限不足");
        }
        AdminUser admin = authUser.adminUser();
        /**
         * 封装r当前用户VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new UserMeVO(
            admin.id,
            admin.username,
            admin.displayName,
            null,
            null,
            admin.email,
            admin.role,
            0,
            0,
            null,
            null
        );
    }

    public UserMeVO me() {
        AuthUser authUser = CurrentUser.required();
        if (authUser.adminAccount() || !UserRole.isActiveFrontendRole(authUser.role())) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "后台账号不能访问前台用户中心");
        }
        User user = authUser.user();
        UserScore score = userScoreMapper.selectById(user.id);
        Long classId = user.classId;
        if (classId == null) {
            ClassMember member = classMemberMapper.selectOne(
                new QueryWrapper<ClassMember>().eq("user_id", user.id).last("LIMIT 1")
            );
            if (member != null) {
                classId = member.classId;
            }
        }
        String className = null;
        if (classId != null) {
            ClassRoom classRoom = classRoomMapper.selectById(classId);
            if (classRoom != null) {
                className = classRoom.name;
            }
        }
        /**
         * 封装r当前用户VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new UserMeVO(
            user.id,
            user.username,
            user.displayName,
            user.avatarUrl,
            user.studentNo,
            user.email,
            user.role,
            score == null ? 0 : score.acCount,
            score == null ? 0 : score.submitCount,
            classId,
            className
        );
    }

    public TeacherMeVO teacherMe() {
        Teacher teacher = CurrentUser.required().teacher();
        Major major = teacher.majorId == null ? null : majorMapper.selectById(teacher.majorId);
        return new TeacherMeVO(
            teacher.id,
            teacher.username,
            teacher.displayName,
            teacher.avatarUrl,
            teacher.teacherNo,
            teacher.email,
            "TEACHER",
            teacher.majorId,
            major == null ? null : major.name
        );
    }

    public void updateTeacherProfile(UpdateProfileRequest request) {
        Teacher teacher = CurrentUser.required().teacher();
        if (request.displayName() == null || request.displayName().trim().isEmpty()) {
            throw new BizException(400, "姓名不能为空");
        }
        teacher.displayName = request.displayName().trim();
        teacherMapper.updateById(teacher);
    }

    public void updateTeacherPassword(UpdatePasswordRequest request) {
        Teacher teacher = CurrentUser.required().teacher();
        if (!passwordEncoder.matches(request.oldPassword(), teacher.passwordHash)) {
            throw new BizException(400, "旧密码错误");
        }
        teacher.passwordHash = passwordEncoder.encode(request.newPassword());
        teacherMapper.updateById(teacher);
    }

    private void ensureUnique(String column, String value, String message) {
        boolean existsInUsers = userMapper.selectCount(new QueryWrapper<User>().eq(column, value)) > 0;
        boolean existsInAdmins = ("username".equals(column) || "email".equals(column))
            && adminUserMapper.selectCount(new QueryWrapper<AdminUser>().eq(column, value)) > 0;
        String teacherColumn = "student_no".equals(column) ? "teacher_no" : column;
        boolean existsInTeachers = teacherMapper.selectCount(
            new QueryWrapper<Teacher>().eq(teacherColumn, value)
        ) > 0;
        if (existsInUsers || existsInAdmins || existsInTeachers) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, message);
        }
    }

    public void updateProfile(UpdateProfileRequest request) {
        AuthUser authUser = CurrentUser.required();
        if (authUser.adminAccount()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "后台账号无法修改个人信息");
        }

        User user = authUser.user();

        // 验证邮箱验证码
        if (request.emailVerificationCode() == null || request.emailVerificationCode().isEmpty()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "请输入邮箱验证码");
        }

        String emailCodeKey = RedisKeys.emailVerificationCode(user.email);
        String storedEmailCode = redisTemplate.opsForValue().get(emailCodeKey);
        if (storedEmailCode == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "邮箱验证码已过期，请重新获取");
        }
        if (!storedEmailCode.equals(request.emailVerificationCode())) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "邮箱验证码错误");
        }

        // 检查用户名是否已存在（排除自己）
        if (request.username() != null && !request.username().equals(user.username)) {
            boolean existsInUsers = userMapper.selectCount(
                new QueryWrapper<User>()
                    .eq("username", request.username())
                    .ne("id", user.id)
            ) > 0;
            boolean existsInAdmins = adminUserMapper.selectCount(
                new QueryWrapper<AdminUser>().eq("username", request.username())
            ) > 0;
            if (existsInUsers || existsInAdmins) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(400, "用户名已存在");
            }
            user.username = request.username();
        }

        if (request.displayName() != null && !request.displayName().isEmpty()) {
            user.displayName = request.displayName();
        }

        userMapper.updateById(user);

        // 删除已使用的邮箱验证码
        redisTemplate.delete(emailCodeKey);
    }

    public void bindEmail(BindEmailRequest request) {
        AuthUser authUser = CurrentUser.required();
        if (authUser.adminAccount()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "后台账号无法绑定邮箱");
        }

        User user = authUser.user();
        String email = request.email().trim();
        boolean existsInUsers = userMapper.selectCount(
            new QueryWrapper<User>()
                .eq("email", email)
                .ne("id", user.id)
        ) > 0;
        boolean existsInAdmins = adminUserMapper.selectCount(new QueryWrapper<AdminUser>().eq("email", email)) > 0;
        if (existsInUsers || existsInAdmins) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "邮箱已存在");
        }

        String emailCodeKey = RedisKeys.emailVerificationCode(email);
        String storedEmailCode = redisTemplate.opsForValue().get(emailCodeKey);
        if (storedEmailCode == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "邮箱验证码已过期，请重新获取");
        }
        if (!storedEmailCode.equals(request.emailVerificationCode())) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "邮箱验证码错误");
        }

        user.email = email;
        userMapper.updateById(user);
        redisTemplate.delete(emailCodeKey);
    }

    public void updatePassword(UpdatePasswordRequest request) {
        AuthUser authUser = CurrentUser.required();
        if (authUser.adminAccount()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "后台账号无法修改密码");
        }

        User user = authUser.user();

        // 验证旧密码
        if (!passwordEncoder.matches(request.oldPassword(), user.passwordHash)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "旧密码错误");
        }

        // 更新密码
        user.passwordHash = passwordEncoder.encode(request.newPassword());
        userMapper.updateById(user);
    }

    public void resetPassword(ResetPasswordRequest request) {
        // 验证邮箱验证码
        String emailCodeKey = RedisKeys.emailVerificationCode(request.email());
        String storedEmailCode = redisTemplate.opsForValue().get(emailCodeKey);
        if (storedEmailCode == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "邮箱验证码已过期，请重新获取");
        }
        if (!storedEmailCode.equals(request.emailVerificationCode())) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "邮箱验证码错误");
        }

        // 查找用户
        User user = userMapper.selectOne(new QueryWrapper<User>().eq("email", request.email()));
        if (user == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "该邮箱未注册");
        }

        // 更新密码
        user.passwordHash = passwordEncoder.encode(request.newPassword());
        userMapper.updateById(user);

        // 删除已使用的邮箱验证码
        redisTemplate.delete(emailCodeKey);
    }
}
