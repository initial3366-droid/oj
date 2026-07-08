package com.qoj.security.policy;

import com.qoj.security.AuthUser;
import org.springframework.stereotype.Component;

@Component
public class ScoreboardAccessPolicy {

    public boolean canViewGlobalScoreboard(AuthUser user) {
        // 全局榜单任何人可见
        return true;
    }

    public boolean canViewContestScoreboard(AuthUser user, boolean isPublicContest) {
        // 公开比赛榜单任何人可见
        if (isPublicContest) {
            return true;
        }

        // 非公开比赛需要有访问权限（在Service层判断）
        return user != null;
    }
}
