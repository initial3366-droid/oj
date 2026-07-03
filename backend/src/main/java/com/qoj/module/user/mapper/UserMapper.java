package com.qoj.module.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.user.entity.User;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    @Select("SELECT role, COUNT(*) AS count FROM users GROUP BY role")
    List<java.util.Map<String, Object>> selectUserCountByRole();

    @Select("SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count " +
            "FROM users GROUP BY month ORDER BY month")
    List<java.util.Map<String, Object>> selectMonthlyRegistrations();
}
