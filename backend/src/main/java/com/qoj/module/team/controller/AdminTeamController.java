package com.qoj.module.team.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.team.dto.TeamAddMemberRequest;
import com.qoj.module.team.dto.TeamCreateRequest;
import com.qoj.module.team.dto.TeamRenameRequest;
import com.qoj.module.team.service.TeamService;
import com.qoj.module.team.vo.TeamVO;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理员队伍接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/admin/v1/teams")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminTeamController {
    private final TeamService teamService;

    public AdminTeamController(TeamService teamService) {
        this.teamService = teamService;
    }

    @GetMapping
    public ApiResponse<List<TeamVO>> list() {
        return ApiResponse.ok(teamService.list());
    }

    @PostMapping
    public ApiResponse<TeamVO> create(@Valid @RequestBody TeamCreateRequest request) {
        return ApiResponse.ok(teamService.create(request.name()));
    }

    @PutMapping("/{id}")
    public ApiResponse<TeamVO> rename(@PathVariable long id, @Valid @RequestBody TeamRenameRequest request) {
        return ApiResponse.ok(teamService.rename(id, request.name()));
    }

    @PostMapping("/{id}/members")
    public ApiResponse<TeamVO> addMember(@PathVariable long id, @Valid @RequestBody TeamAddMemberRequest request) {
        return ApiResponse.ok(teamService.addMember(id, request.userId()));
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ApiResponse<TeamVO> removeMember(@PathVariable long id, @PathVariable long userId) {
        return ApiResponse.ok(teamService.removeMember(id, userId));
    }
}
