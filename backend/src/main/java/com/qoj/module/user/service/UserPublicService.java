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

@Service
public class UserPublicService {
    private final UserMapper userMapper;
    private final UserScoreMapper userScoreMapper;

    public UserPublicService(UserMapper userMapper, UserScoreMapper userScoreMapper) {
        this.userMapper = userMapper;
        this.userScoreMapper = userScoreMapper;
    }

    public PublicUserProfileVO profile(long userId) {
        User user = userMapper.selectById(userId);
        if (user == null || !UserRole.isActiveFrontendRole(user.role)) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "用户不存在");
        }
        UserScore score = userScoreMapper.selectById(userId);
        return new PublicUserProfileVO(
            user.id,
            user.username,
            user.displayName,
            user.role,
            score == null ? 0 : score.acCount,
            score == null ? 0 : score.submitCount,
            score == null ? 0 : score.totalScore,
            user.createdAt
        );
    }
}
