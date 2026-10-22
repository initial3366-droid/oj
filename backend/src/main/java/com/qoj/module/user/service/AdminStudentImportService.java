package com.qoj.module.user.service;

import com.qoj.common.exception.BizException;
import com.qoj.module.classroom.entity.ClassRoom;
import com.qoj.module.classroom.service.ClassRoomService;
import com.qoj.module.classroom.service.StudentImportFileService;
import com.qoj.module.user.vo.AdminStudentImportResultVO;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AdminStudentImportService {
    private final StudentImportFileService studentImportFileService;
    private final UserAdminService userAdminService;
    private final ClassRoomService classRoomService;

    public AdminStudentImportService(
        StudentImportFileService studentImportFileService,
        UserAdminService userAdminService,
        ClassRoomService classRoomService
    ) {
        this.studentImportFileService = studentImportFileService;
        this.userAdminService = userAdminService;
        this.classRoomService = classRoomService;
    }

    @Transactional
    public AdminStudentImportResultVO importXlsx(MultipartFile file) {
        List<Map<String, String>> rows = studentImportFileService.parseAdminStudentXlsx(file);
        List<AdminStudentImportResultVO.RowSuccess> successes = new ArrayList<>();
        List<AdminStudentImportResultVO.RowError> errors = new ArrayList<>();

        for (Map<String, String> row : rows) {
            int rowNumber = Integer.parseInt(row.get("__rowNumber"));
            String username = row.get("用户名");
            String studentNo = row.get("学号");
            String className = row.get("班级");

            String validationError = validateRow(username, studentNo, className);
            if (validationError != null) {
                errors.add(new AdminStudentImportResultVO.RowError(rowNumber, username, studentNo, validationError));
                continue;
            }
            try {
                userAdminService.assertImportedStudentAvailable(username, studentNo);
            } catch (BizException exception) {
                errors.add(new AdminStudentImportResultVO.RowError(rowNumber, username, studentNo, exception.getMessage()));
                continue;
            }

            ClassRoom classRoom = classRoomService.adminEnsureUnassignedClass(className);
            long userId = userAdminService.createImportedStudent(username, studentNo);
            classRoomService.adminAssignImportedStudent(classRoom.id, userId);
            successes.add(new AdminStudentImportResultVO.RowSuccess(rowNumber, username, studentNo, className));
        }

        return new AdminStudentImportResultVO(successes.size(), errors.size(), successes, errors);
    }

    private String validateRow(String username, String studentNo, String className) {
        if (username == null || username.isBlank()) return "用户名不能为空";
        if (username.length() > 80) return "用户名不能超过 80 个字符";
        if (studentNo == null || studentNo.isBlank()) return "学号不能为空";
        if (studentNo.length() > 80) return "学号不能超过 80 个字符";
        if (className == null || className.isBlank()) return "班级不能为空";
        if (className.length() > 120) return "班级名称不能超过 120 个字符";
        return null;
    }
}
