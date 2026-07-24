package com.qoj.security;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.TeacherMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * JWT 认证过滤器 — 每次请求时从 Authorization 头提取 Bearer Token 并认证用户。
 *
 * 执行流程：
 * 1. 从请求头取 "Authorization: Bearer <token>"
 * 2. 剥离 "Bearer " 前缀（7 个字符）得到 Token
 * 3. 调用 JwtService.parse() 验证签名和有效期
 * 4. 检查 Token 黑名单（Redis），已撤销的 Token 直接跳过
 * 5. 根据 accountType 区分 AdminUser 和普通 User，查询数据库获取用户信息
 * 6. 构建 UsernamePasswordAuthenticationToken 放入 SecurityContext
 * 7. 非管理员账号记录在线状态到 Redis（7 天 TTL）
 *
 * 关键设计：
 * - 继承 OncePerRequestFilter：每个请求只执行一次认证
 * - 认证失败静默忽略：不阻塞请求，交由 SecurityConfig 的权限规则处理
 * - 管理员不记录在线状态：避免后台用户混入前台在线统计
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final Duration ONLINE_USER_TTL = Duration.ofDays(7);

    private final JwtService jwtService;
    private final StringRedisTemplate redisTemplate;
    private final UserMapper userMapper;
    private final AdminUserMapper adminUserMapper;
    private final TeacherMapper teacherMapper;

    /**
     * 构造 JwtAuthenticationFilter 实例并保存其必要依赖或初始状态。从持久化层读取数据；读写 Redis 中的缓存、锁或限流状态。
     */
    public JwtAuthenticationFilter(
        JwtService jwtService,
        StringRedisTemplate redisTemplate,
        UserMapper userMapper,
        AdminUserMapper adminUserMapper,
        TeacherMapper teacherMapper
    ) {
        this.jwtService = jwtService;
        this.redisTemplate = redisTemplate;
        this.userMapper = userMapper;
        this.adminUserMapper = adminUserMapper;
        this.teacherMapper = teacherMapper;
    }

    /**
     * 过滤器入口。每个 HTTP 请求到达时被调用。
     * 无论认证是否成功，必须调用 filterChain.doFilter() 将请求传递给下游。
     */
    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (StringUtils.hasText(authorization) && authorization.startsWith("Bearer ")) {
            authenticate(authorization.substring(7)); // 剥离 "Bearer " 前缀
        }
        filterChain.doFilter(request, response); // 无论如何都放行，权限由 SecurityConfig 配合处理
    }

    /**
     * The CCPCOJ gateway has an isolated worker-cookie authentication protocol.
     * Skipping JWT parsing avoids mixing user credentials into that trust boundary.
     */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path != null && path.startsWith("/ojtool/judge/");
    }

    /**
     * 核心认证逻辑。
     * 所有 RuntimeException 被静默捕获：即使 Token 无效也不应中断请求处理。
     */
    private void authenticate(String token) {
        try {
            Claims claims = jwtService.parse(token);
            if (!"access".equals(claims.get("typ", String.class))) {
                return;
            }
            // 检查 Token 是否在 Redis 黑名单中（已登出/被撤销的 Token）
            if (Boolean.TRUE.equals(redisTemplate.hasKey(RedisKeys.tokenBlacklist(claims.getId())))) {
                return;
            }
            Long userId = Long.valueOf(claims.getSubject());
            AuthUser authUser = authUser(claims, userId);
            if (authUser == null) {
                return;
            }
            UsernamePasswordAuthenticationToken authentication =
                /**
                 * 封装rnamePasswordAuthentication令牌相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                new UsernamePasswordAuthenticationToken(authUser, token, authUser.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(authentication);
            // 后台管理员不记录在线状态，避免混入前台在线用户统计
            if (!authUser.adminAccount()) {
                redisTemplate.opsForValue().set(
                    RedisKeys.onlineAccount(authUser.accountType(), userId), "1", ONLINE_USER_TTL
                );
            }
        } catch (RuntimeException ignored) {
            // Token 解析失败或数据库查询异常时，静默清空上下文，不阻止请求继续
            SecurityContextHolder.clearContext();
        }
    }

    /**
     * 根据 JWT 中的 accountType 字段区分用户类型：
     * - ADMIN → 查询 admin_users 表
     * - 其他 → 查询 users 表
     * 返回包装后的 AuthUser，查不到则返回 null（认证失败）
     */
    private AuthUser authUser(Claims claims, Long userId) {
        String accountType = claims.get("accountType", String.class);
        if ("ADMIN".equals(accountType)) {
            AdminUser adminUser = adminUserMapper.selectById(userId);
            return adminUser == null ? null : new AuthUser(adminUser);
        }
        if ("TEACHER".equals(accountType)) {
            Teacher teacher = teacherMapper.selectById(userId);
            return teacher == null || !"ACTIVE".equals(teacher.status) ? null : new AuthUser(teacher);
        }
        User user = userMapper.selectOne(new QueryWrapper<User>().eq("id", userId));
        return user == null ? null : new AuthUser(user);
    }
}
