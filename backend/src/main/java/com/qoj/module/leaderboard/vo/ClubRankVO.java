package com.qoj.module.leaderboard.vo;

public record ClubRankVO(
    Long clubId,
    String clubName,
    Long memberCount,
    Long acCount
) {
}
