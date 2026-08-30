package com.qoj.module.team.service;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.qoj.module.team.entity.Team;
import com.qoj.module.team.mapper.TeamMapper;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeamServiceTest {
    @Mock private TeamMapper teamMapper;
    @Mock private UserMapper userMapper;
    private TeamService service;

    @BeforeEach
    void setUp() {
        service = new TeamService(teamMapper, userMapper);
    }

    @Test
    void removeMemberClearsTeamIdWithExplicitNullSet() {
        Team team = new Team();
        team.id = 5L;
        team.name = "队伍A";
        when(teamMapper.selectById(5L)).thenReturn(team);

        service.removeMember(5L, 30L);

        // MyBatis-Plus updateById 会跳过 null 字段，必须走 UpdateWrapper 显式 set null 才能真正清空
        UpdateWrapper<?> wrapper = capturedClearUpdate();
        // MP 3.5.9 的 where 条件参数在 getSqlSegment() 时才懒加载生成，须先取片段再断言参数
        String segment = wrapper.getSqlSegment();
        assertTrue(wrapper.getSqlSet().contains("team_id"));
        assertTrue(segment.contains("id =") && segment.contains("team_id ="));
        assertTrue(wrapper.getParamNameValuePairs().containsValue(30L));
        assertTrue(wrapper.getParamNameValuePairs().containsValue(5L));
        verify(userMapper, never()).updateById(any(User.class));
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private UpdateWrapper<?> capturedClearUpdate() {
        ArgumentCaptor<UpdateWrapper> captor = ArgumentCaptor.forClass(UpdateWrapper.class);
        verify(userMapper).update(isNull(), captor.capture());
        return captor.getValue();
    }
}
