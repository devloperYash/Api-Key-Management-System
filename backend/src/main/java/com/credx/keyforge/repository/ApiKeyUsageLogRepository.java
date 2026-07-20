package com.credx.keyforge.repository;

import com.credx.keyforge.entity.ApiKeyUsageLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface ApiKeyUsageLogRepository extends JpaRepository<ApiKeyUsageLog, String> {

    Page<ApiKeyUsageLog> findAllByApiKeyIdOrderByOccurredAtDesc(String apiKeyId, Pageable pageable);

    List<ApiKeyUsageLog> findAllByApiKeyIdAndOccurredAtAfter(String apiKeyId, Instant after);

    long countByApiKeyIdAndOccurredAtAfter(String apiKeyId, Instant after);

    long countByApiKeyIdAndOccurredAtAfterAndStatusCodeGreaterThanEqual(
            String apiKeyId, Instant after, Integer statusCode);

    @Query("select count(u) from ApiKeyUsageLog u where u.apiKey.project.id = :projectId and u.occurredAt >= :since")
    long countByProjectIdSince(@Param("projectId") String projectId, @Param("since") Instant since);

    long countByStatusCodeGreaterThanEqual(Integer statusCode);

    @Query("SELECT p.organization.id, COUNT(u) " +
           "FROM ApiKeyUsageLog u " +
           "JOIN u.apiKey k " +
           "JOIN k.project p " +
           "GROUP BY p.organization.id " +
           "ORDER BY COUNT(u) DESC")
    List<Object[]> findTopOrganizationsByUsage(Pageable pageable);
    @Query("select count(u) from ApiKeyUsageLog u where u.apiKey.project.organization.id = :orgId and u.occurredAt >= :since")
    long countByOrganizationIdSince(@Param("orgId") String orgId, @Param("since") Instant since);

    @Query("select count(u) from ApiKeyUsageLog u where u.apiKey.project.organization.id = :orgId and u.occurredAt >= :since and u.statusCode >= :statusCode")
    long countByOrganizationIdSinceAndStatusCodeGreaterThanEqual(@Param("orgId") String orgId, @Param("since") Instant since, @Param("statusCode") Integer statusCode);
}
