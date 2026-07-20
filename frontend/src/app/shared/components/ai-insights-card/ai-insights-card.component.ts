import { Component, inject, input, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { GeminiAiService, AiInsightResult } from '../../../core/services/gemini-ai.service';
import { DashboardStats } from '../../../core/models/usage.model';

@Component({
  selector: 'kf-ai-insights-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatChipsModule],
  template: `
    <mat-card class="kf-ai-card">
      <div class="kf-ai-header">
        <div class="kf-ai-title">
          <mat-icon class="kf-sparkle-icon">auto_awesome</mat-icon>
          <h3>Gemini AI Smart Security & Gateway Insights</h3>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          @if (insight()) {
            <span [class]="statusBadgeClass(insight()!.statusLevel)">
              {{ insight()!.statusLevel }}
            </span>
          }
          <button mat-icon-button (click)="refresh()" [disabled]="loading()" title="Re-analyze metrics with AI">
            <mat-icon [class.kf-spin]="loading()">refresh</mat-icon>
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="kf-ai-loading">
          <mat-icon class="kf-spin">auto_awesome</mat-icon>
          <span>Analyzing API call metrics and threat vectors with Gemini AI...</span>
        </div>
      } @else if (insight()) {
        <div class="kf-ai-content">
          <div class="kf-ai-summary">
            <strong>Executive Overview:</strong> {{ insight()!.summary }}
          </div>

          <div class="kf-ai-details-grid">
            <div class="kf-ai-detail-box">
              <div class="kf-detail-label">
                <mat-icon style="color: #1976d2;">verified_user</mat-icon>
                <span>Security Assessment</span>
              </div>
              <p>{{ insight()!.securityRecommendation }}</p>
            </div>

            <div class="kf-ai-detail-box">
              <div class="kf-detail-label">
                <mat-icon style="color: #7b1fa2;">speed</mat-icon>
                <span>Traffic & Quota Assessment</span>
              </div>
              <p>{{ insight()!.trafficAssessment }}</p>
            </div>
          </div>
        </div>
      }
    </mat-card>
  `,
  styles: [`
    .kf-ai-card {
      background: linear-gradient(135deg, #1e1b4b 0%, #311b92 50%, #1a237e 100%);
      color: #ffffff;
      padding: 20px;
      margin-bottom: 24px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(49, 27, 146, 0.25);
    }

    .kf-ai-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .kf-ai-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .kf-ai-title h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      color: #ffffff;
      letter-spacing: 0.3px;
    }

    .kf-sparkle-icon {
      color: #ffd54f;
    }

    .kf-badge-optimal {
      background: #2e7d32;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
    }

    .kf-badge-attention {
      background: #f57c00;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
    }

    .kf-badge-critical {
      background: #c62828;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
    }

    .kf-ai-loading {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 0;
      color: #b39ddb;
      font-size: 13px;
    }

    .kf-spin {
      animation: spin 1.5s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    .kf-ai-summary {
      font-size: 14px;
      line-height: 1.6;
      color: #e8eaf6;
      background: rgba(255, 255, 255, 0.08);
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;

      border-left: 4px solid #ffd54f;
    }

    .kf-ai-details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .kf-ai-detail-box {
      background: rgba(255, 255, 255, 0.05);
      padding: 14px 16px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .kf-detail-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #b39ddb;
      margin-bottom: 6px;
    }

    .kf-ai-detail-box p {
      margin: 0;
      font-size: 13px;
      color: #e0e0e0;
      line-height: 1.4;
    }
  `],
})
export class AiInsightsCardComponent {
  private readonly geminiAi = inject(GeminiAiService);

  stats = input<DashboardStats | null>(null);

  insight = signal<AiInsightResult | null>(null);
  loading = signal(false);

  constructor() {
    effect(() => {
      const currentStats = this.stats();
      if (currentStats && !this.insight() && !this.loading()) {
        this.analyze(currentStats);
      }
    });
  }

  refresh(): void {
    const currentStats = this.stats();
    if (currentStats) {
      this.analyze(currentStats);
    }
  }

  private analyze(stats: DashboardStats): void {
    this.loading.set(true);
    this.geminiAi.generateDashboardInsights(stats).subscribe({
      next: (res) => {
        this.insight.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  statusBadgeClass(level: string): string {
    switch (level) {
      case 'CRITICAL':
        return 'kf-badge-critical';
      case 'ATTENTION':
        return 'kf-badge-attention';
      default:
        return 'kf-badge-optimal';
    }
  }
}
