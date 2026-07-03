package com.qoj.common.enums;

public enum SubmissionStatus {
    WAITING,      // 等待入队
    PENDING,      // 等待判题
    JUDGING,      // 判题中
    COMPILING,    // 编译中
    RUNNING,      // 运行中
    AC,           // Accepted 通过
    WA,           // Wrong Answer 答案错误
    TLE,          // Time Limit Exceeded 超时
    MLE,          // Memory Limit Exceeded 内存超限
    RE,           // Runtime Error 运行时错误
    CE,           // Compile Error 编译错误
    NOO,          // No Output 无输出
    SE,           // System Error 系统错误
    REJUDGE_PENDING, // 重判等待
    FAILED        // 队列任务失败
}
