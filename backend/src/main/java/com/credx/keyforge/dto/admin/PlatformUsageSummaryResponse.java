package com.credx.keyforge.dto.admin;

import java.util.Map;

public record PlatformUsageSummaryResponse(
        long totalCalls,
        long activeKeys,
        long totalOrgs,
        long totalProjects,
        double errorRatePercent,
        Map<String, Long> topOrgsByUsage
) {}
