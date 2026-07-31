package com.qoj.module.submission.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.submission.entity.SandboxRun;
import org.apache.ibatis.annotations.Mapper;

/**
 * 沙箱Run数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface SandboxRunMapper extends BaseMapper<SandboxRun> {
}
