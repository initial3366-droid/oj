package com.qoj.module.teacher.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.exception.BizException;
import com.qoj.module.agent.service.AgentChatService;
import com.qoj.module.agent.vo.AgentQuotaVO;
import com.qoj.module.classroom.service.ClassRoomService;
import com.qoj.module.user.dto.StudentBatchRequest;
import com.qoj.module.user.service.AdminStudentBatchService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/teacher/v1/students")
@PreAuthorize("hasRole('TEACHER')")
public class TeacherStudentManagementController {
    private final AdminStudentBatchService batch;
    private final ClassRoomService classrooms;
    private final AgentChatService agent;

    public TeacherStudentManagementController(AdminStudentBatchService batch, ClassRoomService classrooms, AgentChatService agent) {
        this.batch = batch;
        this.classrooms = classrooms;
        this.agent = agent;
    }

    @PostMapping("/batch")
    public ApiResponse<AdminStudentBatchService.Result> execute(@Valid @RequestBody StudentBatchRequest request) {
        return ApiResponse.ok(batch.execute(request));
    }

    @GetMapping("/quotas")
    public ApiResponse<Map<Long, AgentQuotaVO>> quotas(@RequestParam List<Long> userIds) {
        if (userIds.isEmpty() || userIds.size() > 100 || userIds.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new BizException(400, "一次查询 1 至 100 名学生的 AI 额度");
        }
        userIds.stream().distinct().forEach(classrooms::requireManagedStudent);
        return ApiResponse.ok(agent.getQuotas(userIds));
    }
}
