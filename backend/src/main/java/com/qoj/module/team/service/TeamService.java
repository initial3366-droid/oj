package com.qoj.module.team.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.team.entity.Team;
import com.qoj.module.team.mapper.TeamMapper;
import com.qoj.module.team.vo.TeamVO;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 队伍业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class TeamService {
    private final TeamMapper teamMapper;
    private final UserMapper userMapper;

    public TeamService(TeamMapper teamMapper, UserMapper userMapper) {
        this.teamMapper = teamMapper;
        this.userMapper = userMapper;
    }

    /**
     * 新建队伍。执行持久化写入。
     */
    @Transactional
    public TeamVO create(String name) {
        String normalized = name == null ? "" : name.trim();
        if (normalized.isBlank()) {
            throw new BizException(400, "队伍名称不能为空");
        }
        if (normalized.length() > 100) {
            throw new BizException(400, "队伍名称过长");
        }
        LocalDateTime now = LocalDateTime.now();
        Team team = new Team();
        team.name = normalized;
        team.createdAt = now;
        team.updatedAt = now;
        teamMapper.insert(team);
        return toVO(team);
    }

    /**
     * 队伍列表（含成员）。从持久化层读取数据。
     */
    public List<TeamVO> list() {
        return teamMapper.selectList(new QueryWrapper<Team>().orderByAsc("id"))
            .stream()
            .map(this::toVO)
            .toList();
    }

    /**
     * 修改队伍名称。不满足业务约束时直接抛出明确异常；执行持久化写入。
     */
    @Transactional
    public TeamVO rename(long id, String name) {
        Team team = requireTeam(id);
        String normalized = name == null || name.isBlank() ? team.name : name.trim();
        if (normalized.length() > 100) {
            throw new BizException(400, "队伍名称过长");
        }
        team.name = normalized;
        teamMapper.updateById(team);
        return toVO(team);
    }

    /**
     * 添加成员：将用户加入队伍。每个用户只能属于一个队伍，已在其他队伍时拒绝。执行持久化写入。
     */
    @Transactional
    public TeamVO addMember(long teamId, long userId) {
        Team team = requireTeam(teamId);
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(404, "用户不存在");
        }
        if (user.teamId != null && !team.id.equals(user.teamId)) {
            throw new BizException(400, "该用户已属于其他队伍，请先从原队伍移除");
        }
        user.teamId = team.id;
        userMapper.updateById(user);
        return toVO(team);
    }

    /**
     * 移除成员：仅当用户属于该队伍时清空其 team_id。执行持久化写入。
     */
    @Transactional
    public TeamVO removeMember(long teamId, long userId) {
        Team team = requireTeam(teamId);
        User user = userMapper.selectById(userId);
        if (user != null && team.id.equals(user.teamId)) {
            user.teamId = null;
            userMapper.updateById(user);
        }
        return toVO(team);
    }

    private Team requireTeam(long id) {
        Team team = teamMapper.selectById(id);
        if (team == null) {
            throw new BizException(404, "队伍不存在");
        }
        return team;
    }

    private TeamVO toVO(Team team) {
        List<User> members = userMapper.selectList(
            new QueryWrapper<User>().eq("team_id", team.id).orderByAsc("id")
        );
        return new TeamVO(
            team.id,
            team.name,
            members.size(),
            members.stream()
                .map(user -> new TeamVO.MemberVO(user.id, user.username, user.displayName))
                .toList()
        );
    }
}
