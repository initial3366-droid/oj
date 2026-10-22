package com.qoj.security;

import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.service.ContestIpAccessService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** Applies a contest CIDR allowlist to every participant-facing contest API route. */
@Component
public class ContestIpAccessInterceptor implements HandlerInterceptor {
    private static final Pattern CONTEST_API_PATH = Pattern.compile("^/api/v1/contests/(\\d+)(?:/.*)?$");

    private final ContestMapper contestMapper;
    private final ContestIpAccessService contestIpAccessService;

    public ContestIpAccessInterceptor(
        ContestMapper contestMapper,
        ContestIpAccessService contestIpAccessService
    ) {
        this.contestMapper = contestMapper;
        this.contestIpAccessService = contestIpAccessService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String requestPath = request.getRequestURI().substring(request.getContextPath().length());
        try {
            requestPath = URLDecoder.decode(requestPath, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ignored) {
            return true;
        }
        Matcher matcher = CONTEST_API_PATH.matcher(requestPath);
        if (!matcher.matches()) {
            return true;
        }
        Contest contest = contestMapper.selectById(Long.parseLong(matcher.group(1)));
        if (contest != null) {
            contestIpAccessService.requireAllowed(contest);
        }
        return true;
    }
}
