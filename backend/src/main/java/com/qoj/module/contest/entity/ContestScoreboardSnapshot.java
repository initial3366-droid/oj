package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 比赛榜单Snapshot持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("contest_scoreboard_snapshots")
public class ContestScoreboardSnapshot {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long contestId;
    public String scoringMode;
    public String snapshotType;
    public String data;
    public Long generatedBy;
    public LocalDateTime createdAt;

    public Long getContestId() { return contestId; }
    public String getSnapshotType() { return snapshotType; }
}
