package com.qoj.module.xcpcio.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.xcpcio.entity.ContestXcpcioSubmissionSync;
import org.apache.ibatis.annotations.Mapper;

/**
 * 比赛Xcpcio提交Sync数据访问接口。声明数据库查询与写入操作，具体实现由 MyBatis 在运行时生成。
 */
@Mapper
public interface ContestXcpcioSubmissionSyncMapper extends BaseMapper<ContestXcpcioSubmissionSync> {
}
