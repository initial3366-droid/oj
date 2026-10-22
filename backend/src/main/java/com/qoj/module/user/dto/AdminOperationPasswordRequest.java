package com.qoj.module.user.dto;

import jakarta.validation.constraints.Size;

public record AdminOperationPasswordRequest(@Size(max = 128) String adminPassword) {}
