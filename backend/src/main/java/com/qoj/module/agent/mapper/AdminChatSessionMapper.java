package com.qoj.module.agent.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.agent.entity.AdminChatSession;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AdminChatSessionMapper extends BaseMapper<AdminChatSession> {
    @Select("SELECT * FROM admin_ai_chat_sessions WHERE id = #{id} AND owner_admin_id = #{ownerId} FOR UPDATE")
    AdminChatSession lockOwned(@Param("id") String id, @Param("ownerId") long ownerId);
}
