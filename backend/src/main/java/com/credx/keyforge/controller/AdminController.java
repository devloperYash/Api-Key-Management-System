package com.credx.keyforge.controller;

import com.credx.keyforge.dto.admin.PlatformUsageSummaryResponse;
import com.credx.keyforge.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Platform super-admin endpoints (Role.ADMIN, not org-membership admin).
 * Locked down at the SecurityConfig level via hasRole("ADMIN").
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/platform-usage-summary")
    public ResponseEntity<PlatformUsageSummaryResponse> platformUsageSummary() {
        return ResponseEntity.ok(adminService.getPlatformUsageSummary());
    }
}
