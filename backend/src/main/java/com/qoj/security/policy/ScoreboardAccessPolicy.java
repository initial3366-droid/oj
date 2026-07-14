package com.qoj.security.policy;

import com.qoj.security.AuthUser;
import org.springframework.stereotype.Component;

/**
 * 榜单访问访问策略。根据当前身份、资源归属和操作类型统一作出权限判断。
 */
@Component
public class ScoreboardAccessPolicy {

    /**
     * 判断ViewGlobal榜单是否成立。直接返回当前实例保存的true，不产生额外的数据写入。
     */
    public boolean canViewGlobalScoreboard(AuthUser user) {
        // 全局榜单任何人可见
        return true;
    }

    /**
     * 判断View比赛榜单是否成立。调用前会结合当前登录身份执行权限判断。
     */
    public boolean canViewContestScoreboard(AuthUser user, boolean isPublicContest) {
        // 公开比赛榜单任何人可见
        if (isPublicContest) {
            return true;
        }

        // 非公开比赛需要有访问权限（在Service层判断）
        return user != null;
    }
}
