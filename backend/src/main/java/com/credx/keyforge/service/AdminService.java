package com.credx.keyforge.service;

import com.credx.keyforge.dto.admin.PlatformUsageSummaryResponse;
import com.credx.keyforge.entity.ApiKeyStatus;
import com.credx.keyforge.repository.ApiKeyRepository;
import com.credx.keyforge.repository.ApiKeyUsageLogRepository;
import com.credx.keyforge.repository.OrganizationRepository;
import com.credx.keyforge.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final ApiKeyUsageLogRepository usageLogRepository;
    private final ApiKeyRepository apiKeyRepository;
    private final OrganizationRepository organizationRepository;
    private final ProjectRepository projectRepository;

    public PlatformUsageSummaryResponse getPlatformUsageSummary() {
        long totalCalls = usageLogRepository.count();
        long activeKeys = apiKeyRepository.countByStatus(ApiKeyStatus.ACTIVE);
        long totalOrgs = organizationRepository.count();
        long totalProjects = projectRepository.count();

        long errorCalls = usageLogRepository.countByStatusCodeGreaterThanEqual(400);
        double errorRatePercent = totalCalls > 0 ? (errorCalls * 100.0) / totalCalls : 0.0;

        List<Object[]> topOrgsData = usageLogRepository.findTopOrganizationsByUsage(PageRequest.of(0, 5));
        Map<String, Long> topOrgs = new LinkedHashMap<>();
        for (Object[] row : topOrgsData) {
            topOrgs.put((String) row[0], ((Number) row[1]).longValue());
        }

        return new PlatformUsageSummaryResponse(
                totalCalls,
                activeKeys,
                totalOrgs,
                totalProjects,
                errorRatePercent,
                topOrgs
        );
    }
}
