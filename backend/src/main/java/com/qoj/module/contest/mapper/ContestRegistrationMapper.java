package com.qoj.module.contest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.contest.entity.ContestRegistration;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;

/**
 * 比赛报名数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface ContestRegistrationMapper extends BaseMapper<ContestRegistration> {

    @Insert("""
        INSERT INTO contest_registrations (
            contest_id,
            user_id,
            identity_type,
            identity_id,
            starred,
            registered_at
        )
        VALUES (
            #{contestId},
            #{userId},
            #{identityType},
            #{identityId},
            #{starred},
            #{registeredAt}
        )
        ON DUPLICATE KEY UPDATE
            identity_type = VALUES(identity_type),
            identity_id = VALUES(identity_id),
            starred = VALUES(starred),
            registered_at = VALUES(registered_at)
        """)
    /**
     * 封装upsert报名相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    void upsertRegistration(ContestRegistration registration);
}
