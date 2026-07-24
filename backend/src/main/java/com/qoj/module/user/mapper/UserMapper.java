package com.qoj.module.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.user.entity.User;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * 用户数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface UserMapper extends BaseMapper<User> {
    /**
     * 封装select用户CountBy角色相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Select("SELECT role, COUNT(*) AS count FROM users GROUP BY role")
    List<java.util.Map<String, Object>> selectUserCountByRole();

    @Select("SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count " +
            "FROM users GROUP BY month ORDER BY month")
    /**
     * 封装selectMonthlyRegistrations相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    List<java.util.Map<String, Object>> selectMonthlyRegistrations();
}
