package com.qoj.module.user.service;

/** Published inside the status transaction; listeners act only after commit. */
public record UserStatusChangedEvent(long userId, String status) {}
