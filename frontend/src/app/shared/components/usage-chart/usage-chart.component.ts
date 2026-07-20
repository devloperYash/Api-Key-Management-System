import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { DailyUsagePoint } from '../../../core/models/usage.model';

@Component({
  selector: 'kf-usage-chart',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <mat-card class="kf-chart-card">
      <div class="kf-chart-header">
        <div class="kf-chart-title">
          <h3>API Call Volume Trend</h3>
          <span class="kf-chart-subtitle">Daily request breakdown and error counts</span>
        </div>
        <div class="kf-chart-legend">
          <span class="kf-legend-item">
            <span class="kf-legend-color kf-color-calls"></span> Total Calls
          </span>
          <span class="kf-legend-item">
            <span class="kf-legend-color kf-color-errors"></span> Errors
          </span>
        </div>
      </div>

      @if (!data() || data().length === 0) {
        <div class="kf-chart-empty">No usage data recorded for this period</div>
      } @else {
        <div class="kf-chart-container">
          <svg class="kf-chart-svg" [attr.viewBox]="'0 0 ' + chartWidth + ' ' + chartHeight" preserveAspectRatio="none">
            <!-- Grid lines -->
            @for (gridY of gridLines; track gridY) {
              <line
                x1="40"
                [attr.y1]="gridY"
                [attr.x2]="chartWidth - 20"
                [attr.y2]="gridY"
                stroke="#e0e0e0"
                stroke-dasharray="4 4"
                stroke-width="1"
              />
            }

            <!-- Bars -->
            @for (bar of barData(); track bar.date) {
              <!-- Total Calls Bar -->
              <rect
                [attr.x]="bar.x"
                [attr.y]="bar.yCalls"
                [attr.width]="bar.width"
                [attr.height]="bar.hCalls"
                fill="url(#callsGradient)"
                rx="3"
                class="kf-bar"
              >
                <title>{{ bar.date }}: {{ bar.totalCalls }} calls</title>
              </rect>

              <!-- Error Calls Bar overlay if any -->
              @if (bar.errorCalls > 0) {
                <rect
                  [attr.x]="bar.x"
                  [attr.y]="bar.yErrors"
                  [attr.width]="bar.width"
                  [attr.height]="bar.hErrors"
                  fill="#f44336"
                  rx="3"
                  class="kf-bar-error"
                >
                  <title>{{ bar.date }}: {{ bar.errorCalls }} errors</title>
                </rect>
              }
            }

            <!-- SVG Gradients -->
            <defs>
              <linearGradient id="callsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#3f51b5" stop-opacity="0.9" />
                <stop offset="100%" stop-color="#7986cb" stop-opacity="0.6" />
              </linearGradient>
            </defs>
          </svg>

          <!-- Date Labels -->
          <div class="kf-chart-labels">
            @for (bar of barData(); track bar.date) {
              <span class="kf-date-label" [style.left.%]="bar.labelLeftPercent">
                {{ bar.shortDate }}
              </span>
            }
          </div>
        </div>
      }
    </mat-card>
  `,
  styles: [`
    .kf-chart-card {
      padding: 20px;
      margin-top: 16px;
      margin-bottom: 20px;
    }

    .kf-chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .kf-chart-title h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #212121;
    }

    .kf-chart-subtitle {
      font-size: 12px;
      color: #757575;
    }

    .kf-chart-legend {
      display: flex;
      gap: 16px;
      font-size: 12px;
    }

    .kf-legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .kf-legend-color {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    .kf-color-calls {
      background: #3f51b5;
    }

    .kf-color-errors {
      background: #f44336;
    }

    .kf-chart-empty {
      padding: 40px;
      text-align: center;
      color: #9e9e9e;
      font-size: 14px;
    }

    .kf-chart-container {
      position: relative;
      width: 100%;
      height: 220px;
    }

    .kf-chart-svg {
      width: 100%;
      height: 190px;
      overflow: visible;
    }

    .kf-bar {
      transition: opacity 0.2s ease;
      cursor: pointer;
    }

    .kf-bar:hover {
      opacity: 0.8;
    }

    .kf-chart-labels {
      position: absolute;
      bottom: 0;
      left: 40px;
      right: 20px;
      height: 24px;
      display: flex;
      justify-content: space-between;
    }

    .kf-date-label {
      font-size: 11px;
      color: #757575;
      transform: translateX(-50%);
      white-space: nowrap;
    }
  `],
})
export class UsageChartComponent {
  data = input<DailyUsagePoint[]>([]);

  readonly chartWidth = 700;
  readonly chartHeight = 180;
  readonly gridLines = [30, 75, 120, 165];

  barData = computed(() => {
    const rawData = this.data() || [];
    if (rawData.length === 0) return [];

    const maxVal = Math.max(...rawData.map((d) => d.totalCalls), 10);
    const plotWidth = this.chartWidth - 60;
    const barSpacing = plotWidth / rawData.length;
    const barWidth = Math.max(Math.min(barSpacing * 0.6, 30), 6);

    return rawData.map((d, index) => {
      const x = 45 + index * barSpacing + (barSpacing - barWidth) / 2;
      const hCalls = Math.max((d.totalCalls / maxVal) * (this.chartHeight - 40), d.totalCalls > 0 ? 4 : 0);
      const yCalls = this.chartHeight - 20 - hCalls;

      const hErrors = Math.max((d.errorCalls / maxVal) * (this.chartHeight - 40), d.errorCalls > 0 ? 3 : 0);
      const yErrors = this.chartHeight - 20 - hErrors;

      const parts = d.date ? d.date.split('-') : [];
      const shortDate = parts.length === 3 ? `${parts[1]}/${parts[2]}` : d.date;
      const labelLeftPercent = ((index + 0.5) / rawData.length) * 100;

      return {
        date: d.date,
        shortDate,
        totalCalls: d.totalCalls,
        errorCalls: d.errorCalls,
        x,
        yCalls,
        hCalls,
        yErrors,
        hErrors,
        width: barWidth,
        labelLeftPercent,
      };
    });
  });
}
