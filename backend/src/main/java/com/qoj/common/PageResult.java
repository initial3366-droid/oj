package com.qoj.common;

import java.util.List;

public record PageResult<T>(long total, List<T> list) {
}
