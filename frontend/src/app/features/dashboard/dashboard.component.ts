import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, interval, startWith, switchMap } from 'rxjs';
import { UsageService } from '../../core/services/usage.service';
import { SessionStateService } from '../../core/state/session-state.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { DashboardStats } from '../../core/models/usage.model';

const POLL_INTERVAL_MS = 15000;

@Component({
  selector: 'kf-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, LoadingSpinnerComponent],
  template: `
    <div class="kf-page">
      <div class="kf-page-header">
        <div>
          <h1>Organization Dashboard</h1>
          <span style="font-size:13px; color:#616161;">Real-time API activity and platform health overview</span>
        </div>
        <span class="kf-dashboard__live-indicator">
          <mat-icon class="kf-dashboard__live-dot">fiber_manual_record</mat-icon>
          Live Monitoring (polling every 15s)
        </span>
      </div>

      @if (loading()) {
        <kf-loading-spinner label="Loading dashboard stats..."></kf-loading-spinner>
      } @else if (stats()) {
        <div class="kf-card-grid" style="margin-bottom: 20px;">
          <mat-card class="kf-stat-card kf-border-blue">
            <mat-icon class="kf-stat-card__icon" style="color:#3f51b5;">bolt</mat-icon>
            <div class="kf-stat-card__value">{{ stats()!.totalApiCallsToday | number }}</div>
            <div class="kf-stat-card__label">API calls today</div>
          </mat-card>

          <mat-card class="kf-stat-card kf-border-green">
            <mat-icon class="kf-stat-card__icon" style="color:#2e7d32;">vpn_key</mat-icon>
            <div class="kf-stat-card__value">{{ stats()!.activeKeyCount }}</div>
            <div class="kf-stat-card__label">Active API keys</div>
          </mat-card>

          <mat-card class="kf-stat-card kf-border-red">
            <mat-icon class="kf-stat-card__icon" style="color:#d32f2f;">error_outline</mat-icon>
            <div class="kf-stat-card__value" [style.color]="stats()!.errorRatePercent > 1 ? '#d32f2f' : '#2e7d32'">
              {{ stats()!.errorRatePercent }}%
            </div>
            <div class="kf-stat-card__label">Error rate (today)</div>
          </mat-card>

          <mat-card class="kf-stat-card kf-border-purple">
            <mat-icon class="kf-stat-card__icon" style="color:#7b1fa2;">folder</mat-icon>
            <div class="kf-stat-card__value">{{ stats()!.totalProjects }}</div>
            <div class="kf-stat-card__label">Projects</div>
          </mat-card>
        </div>

        <div style="display:grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 20px;">
          <mat-card style="padding: 20px;">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #212121;">
              System Health & Protection Summary
            </h3>
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:13px; color:#424242;">Gateway Status</span>
                <span style="font-size:12px; font-weight:600; background:#e8f5e9; color:#2e7d32; padding:4px 8px; border-radius:12px;">
                  Operational (100% Uptime)
                </span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:13px; color:#424242;">Rate Limiting Engine</span>
                <span style="font-size:12px; font-weight:600; background:#e3f2fd; color:#1565c0; padding:4px 8px; border-radius:12px;">
                  Enforced (60s Window)
                </span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:13px; color:#424242;">Zero-Trust Hash Storage</span>
                <span style="font-size:12px; font-weight:600; background:#f3e5f5; color:#7b1fa2; padding:4px 8px; border-radius:12px;">
                  SHA-256 Enabled
                </span>
              </div>
            </div>
          </mat-card>

          <mat-card style="padding: 20px; background: #fafafa;">
            <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #212121;">
              Quick Tip
            </h3>
            <p style="font-size: 13px; color: #616161; line-height: 1.5; margin: 0;">
              Rotate API keys regularly to maintain zero-downtime security. Rotated keys remain active during a 24-hour grace period.
            </p>
          </mat-card>
        </div>

        <mat-card class="kf-dashboard__hint">
          <mat-icon color="primary">info</mat-icon>
          <span>
            Dashboard statistics are refreshed live every 15 seconds.
          </span>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .kf-dashboard__live-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: #2e7d32;
      background: #e8f5e9;
      padding: 4px 10px;
      border-radius: 16px;
    }

    .kf-dashboard__live-dot {
      font-size: 10px;
      width: 10px;
      height: 10px;
      color: #2e7d32;
    }

    .kf-stat-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-top: 4px solid transparent;
    }

    .kf-border-blue { border-top-color: #3f51b5 !important; }
    .kf-border-green { border-top-color: #2e7d32 !important; }
    .kf-border-red { border-top-color: #d32f2f !important; }
    .kf-border-purple { border-top-color: #7b1fa2 !important; }

    .kf-stat-card__icon {
      margin-bottom: 8px;
    }

    .kf-stat-card__value {
      font-size: 28px;
      font-weight: 700;
    }

    .kf-stat-card__label {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }

    .kf-dashboard__hint {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.7);
      background: #eef1fb;
    }
  `],
})
export class DashboardComponent implements OnInit {
  private readonly usageService = inject(UsageService);
  private readonly sessionState = inject(SessionStateService);
  private readonly destroyRef = inject(DestroyRef);

  stats = signal<DashboardStats | null>(null);
  loading = signal(true);

  private readonly orgId$ = toObservable(this.sessionState.currentOrgId);

  ngOnInit(): void {
    this.orgId$
      .pipe(
        filter((orgId): orgId is string => !!orgId),
        switchMap((orgId) =>
          interval(POLL_INTERVAL_MS).pipe(
            startWith(0),
            switchMap(() => this.usageService.getDashboardStats(orgId))
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data) => {
          this.stats.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }
}
