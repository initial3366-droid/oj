package com.qoj.module.contest.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.common.util.IpNetworkUtils;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.mapper.ContestMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import java.util.HashSet;
import java.util.Set;
import org.springframework.stereotype.Service;

/** Enforces per-contest CIDR allowlists for participant-facing access. */
@Service
public class ContestIpAccessService {
    private final ContestMapper contestMapper;
    private final JdbcTemplate jdbc;

    public ContestIpAccessService(ContestMapper contestMapper, JdbcTemplate jdbc) {
        this.contestMapper = contestMapper;
        this.jdbc = jdbc;
    }

    public void requireAllowed(Contest contest) {
        requireAllowed(contest, CurrentUser.get(), IpNetworkUtils.currentClientIp());
    }

    public void requireAllowed(Contest contest, AuthUser user, String clientIp) {
        if (!isAllowed(contest, user, clientIp)) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "比赛不可见或当前 IP 不在允许的网段内");
        }
    }

    public boolean isAllowed(Contest contest, AuthUser user, String clientIp) {
        if (contest == null || isContestManager(user, contest)) return true;
        if (Boolean.TRUE.equals(contest.hidden) && !hasApprovedRegistration(contest.id, user)) return false;
        return contest.allowedIpRanges == null || contest.allowedIpRanges.isBlank()
            || IpNetworkUtils.isAllowed(contest.allowedIpRanges, clientIp);
    }

    private boolean hasApprovedRegistration(Long contestId, AuthUser user) {
        return user != null && "USER".equals(user.accountType())
            && Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM contest_registrations WHERE contest_id = ? AND user_id = ? AND status = 'APPROVED')",
                Boolean.class, contestId, user.id()));
    }

    /** Contest ids hidden from a participant-facing list for the current request IP. */
    public Set<Long> deniedContestIds() {
        AuthUser user = CurrentUser.get();
        Set<Long> denied = new HashSet<>();
        String clientIp = IpNetworkUtils.currentClientIp();
        contestMapper.selectList(
            new QueryWrapper<Contest>()
                .select("id", "owner_id", "owner_account_type", "allowed_ip_ranges", "hidden")
                .and(q -> q.eq("hidden", true).or(ip -> ip.isNotNull("allowed_ip_ranges").ne("allowed_ip_ranges", "")))
        ).forEach(contest -> {
            if (!isAllowed(contest, user, clientIp)) {
                denied.add(contest.id);
            }
        });
        return denied;
    }

    private boolean isContestManager(AuthUser user, Contest contest) {
        if (user == null) {
            return false;
        }
        if ("SUPER_ADMIN".equals(user.role())) {
            return true;
        }
        return contest.ownerId != null
            && contest.ownerId.equals(user.id())
            && user.accountType().equals(contest.ownerAccountType);
    }
}
