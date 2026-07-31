package com.qoj.module.user.service;

import com.qoj.common.ErrorCode;
import com.qoj.common.enums.UserRole;
import com.qoj.common.exception.BizException;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.entity.UserScore;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.user.mapper.UserScoreMapper;
import com.qoj.module.user.vo.PublicUserProfileVO;
import org.springframework.stereotype.Service;

/**
 * 用户Public业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class UserPublicService {
    private final UserMapper userMapper;
    private final UserScoreMapper userScoreMapper;

    /**
     * 构造 用户PublicService 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
    public UserPublicService(UserMapper userMapper, UserScoreMapper userScoreMapper) {
        this.userMapper = userMapper;
        this.userScoreMapper = userScoreMapper;
    }

    /**
     * 封装资料相关逻辑。不满足业务约束时直接抛出明确异常；从持久化层读取数据。
     */
    public PublicUserProfileVO profile(long userId) {
        User user = userMapper.selectById(userId);
        if (user == null || !UserRole.isActiveFrontendRole(user.role)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "用户不存在");
        }
        UserScore score = userScoreMapper.selectById(userId);
        /**
         * 封装Public用户资料VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new PublicUserProfileVO(
            user.id,
            user.username,
            user.displayName,
            user.avatarUrl,
            user.role,
            score == null ? 0 : score.acCount,
            score == null ? 0 : score.submitCount,
            score == null ? 0 : score.totalScore,
            user.createdAt
        );
    }
}
