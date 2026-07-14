package com.qoj.module.practice.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.practice.dto.PracticeUnlockRequest;
import com.qoj.module.practice.service.PracticeService;
import com.qoj.module.practice.vo.PracticeVO;
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

    @InjectMocks
    private PracticeController practiceController;

    /**
     * 封装详情DoesNotReadPasswordFromQuery相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    void detailDoesNotReadPasswordFromQuery() {
        PracticeVO practice = new PracticeVO(1L, "Practice", "", "ALL", null, true, 2L, null, null, null);
        when(practiceService.detail(1L, null)).thenReturn(practice);

        ApiResponse<PracticeVO> response = practiceController.detail(1L);

        assertSame(practice, response.data());
        verify(practiceService).detail(1L, null);
    }

    /**
     * 封装unlockPassesPasswordFrom请求Body相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    void unlockPassesPasswordFromRequestBody() {
        PracticeVO practice = new PracticeVO(1L, "Practice", "", "ALL", null, true, 2L, null, null, null);
        when(practiceService.detail(1L, "secret")).thenReturn(practice);

        ApiResponse<PracticeVO> response = practiceController.unlock(1L, new PracticeUnlockRequest("secret"));

        assertSame(practice, response.data());
        verify(practiceService).detail(1L, "secret");
    }
}
