package com.qoj.common;

import java.util.List;

/**
 * 页面结果不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
 */
public record PageResult<T>(long total, List<T> list) {
}
