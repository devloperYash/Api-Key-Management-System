package com.credx.keyforge.service;

import com.credx.keyforge.dto.apikey.ApiKeyCreatedResponse;
import com.credx.keyforge.dto.apikey.ApiKeyResponse;
import com.credx.keyforge.dto.apikey.CreateApiKeyRequest;
import com.credx.keyforge.entity.ApiKey;
import com.credx.keyforge.entity.ApiKeyStatus;
import com.credx.keyforge.entity.AuditLog;
import com.credx.keyforge.entity.MembershipRole;
import com.credx.keyforge.entity.Project;
import com.credx.keyforge.exception.ForbiddenOperationException;
import com.credx.keyforge.exception.ResourceNotFoundException;
import com.credx.keyforge.repository.ApiKeyRepository;
import com.credx.keyforge.repository.AuditLogRepository;
import com.credx.keyforge.repository.ProjectRepository;
import com.credx.keyforge.security.AuthenticatedUser;
import com.credx.keyforge.security.CurrentUserProvider;
import com.credx.keyforge.util.ApiKeyGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.springframework.scheduling.annotation.Scheduled;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApiKeyService {

    private final ApiKeyRepository apiKeyRepository;
    private final ProjectRepository projectRepository;
    private final ApiKeyGenerator apiKeyGenerator;
    private final OrganizationAccessService accessService;
    private final AuditLogRepository auditLogRepository;
    private final CurrentUserProvider currentUserProvider;

    @Transactional
    public ApiKeyCreatedResponse createApiKey(String userId, String organizationId, String projectId, CreateApiKeyRequest request) {
        accessService.requireRole(userId, organizationId, MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MEMBER);

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        if (!project.getOrganization().getId().equals(organizationId)) {
            throw new ResourceNotFoundException("Project not found");
        }

        ApiKeyGenerator.GeneratedKey generated = apiKeyGenerator.generate(project.getEnvironment());

        ApiKey apiKey = ApiKey.builder()
                .project(project)
                .name(request.name().trim())
                .keyPrefix(generated.keyPrefix())
                .hashedKey(generated.hashedKey())
                .scopes(request.scopes())
                .status(ApiKeyStatus.ACTIVE)
                .expiresAt(request.expiresAt())
                .rateLimitPerMinute(request.rateLimitPerMinute())
                .currentWindowCount(0)
                .currentWindowStart(Instant.now())
                .build();
        apiKey = apiKeyRepository.save(apiKey);

        writeAuditLog(organizationId, "API_KEY_CREATED", apiKey.getId());

        return new ApiKeyCreatedResponse(toResponse(apiKey), generated.fullKey());
    }

    /**
     * Lists API keys for a project, paginated. Called from the API Keys list
     * page in the dashboard.
     */
    @Transactional(readOnly = true)
    public Page<ApiKeyResponse> listApiKeys(String userId, String organizationId, String projectId, Pageable pageable) {
        accessService.requireMembership(userId, organizationId);

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        if (!project.getOrganization().getId().equals(organizationId)) {
            throw new ResourceNotFoundException("Project not found");
        }

        Page<ApiKey> page = apiKeyRepository.findAllByProjectId(projectId, pageable);
        // NOTE: toResponse() below reaches into apiKey.getProject().getName() for
        // each row. Project is a LAZY association, so for a page of N keys this
        // fires one extra SELECT per row on top of the page query itself.
        return page.map(this::toResponse);
    }

    /**
     * Fetches a single API key by id. Used by the key detail view and by the
     * revoke action to confirm what's being revoked before showing a
     * confirmation dialog.
     */
    @Transactional(readOnly = true)
    public ApiKeyResponse getApiKey(String userId, String apiKeyId) {
        ApiKey apiKey = apiKeyRepository.findById(apiKeyId)
                .orElseThrow(() -> new ResourceNotFoundException("API key not found"));

        String organizationId = apiKey.getProject().getOrganization().getId();
        accessService.requireMembership(userId, organizationId);

        return toResponse(apiKey);
    }

    @Transactional
    public void revokeApiKey(String userId, String apiKeyId) {
        ApiKey apiKey = apiKeyRepository.findById(apiKeyId)
                .orElseThrow(() -> new ResourceNotFoundException("API key not found"));

        String organizationId = apiKey.getProject().getOrganization().getId();
        accessService.requireMembership(userId, organizationId);

        if (apiKey.getStatus() == ApiKeyStatus.REVOKED) {
            throw new IllegalArgumentException("API key is already revoked");
        }

        apiKey.setStatus(ApiKeyStatus.REVOKED);
        apiKey.setRevokedAt(Instant.now());
        apiKeyRepository.save(apiKey);

        writeAuditLog(organizationId, "API_KEY_REVOKED", apiKey.getId());
    }

    /**
     * @deprecated superseded by the paginated {@link #listApiKeys} above. Kept
     * around because the CSV export job (ops script, not in this repo) still
     * calls it directly for a full unpaginated dump. Do not use for
     * user-facing endpoints - loads every key for a project into memory.
     */
    @Deprecated
    public List<ApiKeyResponse> listAllApiKeysUnpaged(String userId, String projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        
        accessService.requireMembership(userId, project.getOrganization().getId());

        return apiKeyRepository.findAllByProjectId(projectId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ApiKeyCreatedResponse rotateApiKey(String userId, String apiKeyId) {
        ApiKey oldKey = apiKeyRepository.findById(apiKeyId)
                .orElseThrow(() -> new ResourceNotFoundException("API key not found"));

        String organizationId = oldKey.getProject().getOrganization().getId();
        accessService.requireMembership(userId, organizationId);

        if (oldKey.getStatus() != ApiKeyStatus.ACTIVE) {
            throw new IllegalArgumentException("Only ACTIVE keys can be rotated");
        }

        // Generate the new key using the same project, scopes, rate limit, and expiry
        ApiKeyGenerator.GeneratedKey generated = apiKeyGenerator.generate(oldKey.getProject().getEnvironment());

        ApiKey newKey = ApiKey.builder()
                .project(oldKey.getProject())
                .name(oldKey.getName() + " (Rotated)")
                .keyPrefix(generated.keyPrefix())
                .hashedKey(generated.hashedKey())
                .scopes(oldKey.getScopes() == null ? new ArrayList<>() : new ArrayList<>(oldKey.getScopes()))
                .status(ApiKeyStatus.ACTIVE)
                .expiresAt(oldKey.getExpiresAt())
                .rateLimitPerMinute(oldKey.getRateLimitPerMinute())
                .currentWindowCount(0)
                .currentWindowStart(Instant.now())
                .build();
        newKey = apiKeyRepository.save(newKey);

        // Mark the old key as rotating and set the grace period (24 hours)
        oldKey.setStatus(ApiKeyStatus.ROTATING);
        oldKey.setGracePeriodEndsAt(Instant.now().plus(24, ChronoUnit.HOURS));
        oldKey.setReplacedByKeyId(newKey.getId());
        apiKeyRepository.save(oldKey);

        writeAuditLog(organizationId, "API_KEY_ROTATED", oldKey.getId());

        return new ApiKeyCreatedResponse(toResponse(newKey), generated.fullKey());
    }

    @Scheduled(fixedRate = 60000) // Run every minute
    @Transactional
    public void expireKeys() {
        Instant now = Instant.now();
        
        // Expire rotating keys past grace period
        List<ApiKey> expiredRotatingKeys = apiKeyRepository.findAllByStatusAndGracePeriodEndsAtBefore(
                ApiKeyStatus.ROTATING, now);
        
        for (ApiKey key : expiredRotatingKeys) {
            key.setStatus(ApiKeyStatus.EXPIRED);
            apiKeyRepository.save(key);
            log.info("Expired rotating key {}", key.getId());
        }

        // Expire active keys past their expiration date
        List<ApiKey> activeKeysPastExpiry = apiKeyRepository.findAllByStatusAndExpiresAtBefore(
                ApiKeyStatus.ACTIVE, now);

        for (ApiKey key : activeKeysPastExpiry) {
            key.setStatus(ApiKeyStatus.EXPIRED);
            apiKeyRepository.save(key);
            log.info("Expired active key {} due to expiry date", key.getId());
        }
    }

    private void writeAuditLog(String organizationId, String action, String targetId) {
        AuthenticatedUser actor = currentUserProvider.get();
        AuditLog log = AuditLog.builder()
                .organizationId(organizationId)
                .actorUserId(actor.getUserId())
                .actorEmail(actor.getEmail())
                .action(action)
                .targetType("API_KEY")
                .targetId(targetId)
                .build();
        auditLogRepository.save(log);
    }

    private ApiKeyResponse toResponse(ApiKey apiKey) {
        return new ApiKeyResponse(
                apiKey.getId(),
                apiKey.getProject().getId(),
                apiKey.getProject().getName(),
                apiKey.getName(),
                apiKey.getKeyPrefix(),
                apiKey.getScopes() == null ? List.of() : List.copyOf(apiKey.getScopes()),
                apiKey.getStatus(),
                apiKey.getCreatedAt(),
                apiKey.getExpiresAt(),
                apiKey.getLastUsedAt(),
                apiKey.getRateLimitPerMinute());
    }
}
