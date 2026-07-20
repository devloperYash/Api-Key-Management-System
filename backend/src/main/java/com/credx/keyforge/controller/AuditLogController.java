package com.credx.keyforge.controller;

import com.credx.keyforge.dto.audit.AuditLogResponse;
import com.credx.keyforge.security.AuthenticatedUser;
import com.credx.keyforge.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organizationId}/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<Page<AuditLogResponse>> listAuditLogs(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String organizationId,
            Pageable pageable) {
        return ResponseEntity.ok(auditLogService.listAuditLogs(user.getUserId(), organizationId, pageable));
    }
}
