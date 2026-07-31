package com.qoj.module.practice.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.practice.dto.PracticeUnlockRequest;
import com.qoj.module.practice.service.PracticeService;
import com.qoj.module.practice.service.PracticePublicationService;
import com.qoj.module.practice.vo.PracticePublicationVO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 练习Controller测试类。验证关键业务规则、异常边界及回归场景。
 */
@ExtendWith(MockitoExtension.class)
class PracticeControllerTest {
    @Mock
    private PracticeService practiceService;
    @Mock
    private PracticePublicationService publicationService;

    @InjectMocks
    private PracticeController practiceController;

    /**
     * 封装详情DoesNotReadPasswordFromQuery相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    void detailDoesNotReadPasswordFromQuery() {
        PracticePublicationVO practice = publication();
        when(publicationService.publicDetail(1L, null)).thenReturn(practice);

        ApiResponse<PracticePublicationVO> response = practiceController.detail(1L);

        assertSame(practice, response.data());
        verify(publicationService).publicDetail(1L, null);
    }

    /**
     * 封装unlockPassesPasswordFrom请求Body相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    void unlockPassesPasswordFromRequestBody() {
        PracticePublicationVO practice = publication();
        when(publicationService.publicDetail(1L, "secret")).thenReturn(practice);

        ApiResponse<PracticePublicationVO> response = practiceController.unlock(1L, new PracticeUnlockRequest("secret"));

        assertSame(practice, response.data());
        verify(publicationService).publicDetail(1L, "secret");
    }

    private PracticePublicationVO publication() {
        return new PracticePublicationVO(
            1L, 10L, "Practice", "", "ALL", null, true, 2L,
            java.util.List.of(), null, null, "TEACHER", "PUBLISHED", "ALL",
            java.util.List.of(), java.util.List.of()
        );
    }
}
