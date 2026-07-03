package com.qoj.module.contest.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.contest.entity.ContestRegistration;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;

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
    void upsertRegistration(ContestRegistration registration);
}
