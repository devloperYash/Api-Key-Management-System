import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AuditLogService, AuditLogResponse } from '../../core/services/audit-log.service';
import { SessionStateService } from '../../core/state/session-state.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'kf-audit-log',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule
  ],
  template: `
    <div class="kf-page">
      <div class="kf-page-header" style="justify-content: space-between;">
        <h1>Audit Log</h1>
        <mat-form-field appearance="outline" style="width: 200px;">
          <mat-label>Filter by Action</mat-label>
          <mat-select [(ngModel)]="selectedAction" (selectionChange)="applyFilter()">
            <mat-option value="ALL">All Actions</mat-option>
            <mat-option value="API_KEY_CREATED">Key Created</mat-option>
            <mat-option value="API_KEY_REVOKED">Key Revoked</mat-option>
            <mat-option value="API_KEY_ROTATED">Key Rotated</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <table mat-table [dataSource]="filteredLogs()" class="mat-elevation-z1" style="width: 100%; margin-bottom: 8px;">
        <ng-container matColumnDef="action">
          <th mat-header-cell *matHeaderCellDef>Action</th>
          <td mat-cell *matCellDef="let log">
            <mat-chip [class]="actionChipClass(log.action)">{{ log.action }}</mat-chip>
          </td>
        </ng-container>

        <ng-container matColumnDef="actor">
          <th mat-header-cell *matHeaderCellDef>Actor</th>
          <td mat-cell *matCellDef="let log">
            <div>{{ log.actorEmail }}</div>
            <div style="font-size: 11px; color: rgba(0,0,0,0.6);">{{ log.actorUserId }}</div>
          </td>
        </ng-container>

        <ng-container matColumnDef="target">
          <th mat-header-cell *matHeaderCellDef>Target</th>
          <td mat-cell *matCellDef="let log">{{ log.targetType }} - {{ log.targetId }}</td>
        </ng-container>

        <ng-container matColumnDef="timestamp">
          <th mat-header-cell *matHeaderCellDef>Timestamp</th>
          <td mat-cell *matCellDef="let log">{{ log.createdAt | date:'medium' }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
      </table>

      <mat-paginator
        [length]="totalElements()"
        [pageSize]="pageSize()"
        [pageIndex]="pageIndex()"
        [pageSizeOptions]="[10, 20, 50]"
        (page)="onPageChange($event)">
      </mat-paginator>
    </div>
  `,
  styles: [`
    .kf-action-chip-create {
      background-color: #e3f6e9 !important;
      color: #1c7c3f !important;
    }
    .kf-action-chip-revoke {
      background-color: #fdeaea !important;
      color: #b3261e !important;
    }
    .kf-action-chip-rotate {
      background-color: #fff8e1 !important;
      color: #ff8f00 !important;
    }
  `]
})
export class AuditLogComponent implements OnInit {
  private readonly auditLogService = inject(AuditLogService);
  private readonly sessionState = inject(SessionStateService);

  logs = signal<AuditLogResponse[]>([]);
  totalElements = signal(0);
  pageSize = signal(10);
  pageIndex = signal(0);
  selectedAction = 'ALL';
  displayedColumns = ['action', 'actor', 'target', 'timestamp'];

  // Frontend filtering since backend doesn't have an action filter parameter yet
  filteredLogs = computed(() => {
    if (this.selectedAction === 'ALL') return this.logs();
    return this.logs().filter(log => log.action === this.selectedAction);
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const orgId = this.sessionState.currentOrgId();
    if (!orgId) return;

    this.auditLogService.list(orgId, this.pageIndex(), this.pageSize()).subscribe(page => {
      this.logs.set(page.content);
      this.totalElements.set(page.totalElements);
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  applyFilter(): void {
    // Re-evaluates computed signal automatically
  }

  actionChipClass(action: string): string {
    if (action === 'API_KEY_CREATED') return 'kf-action-chip-create';
    if (action === 'API_KEY_REVOKED') return 'kf-action-chip-revoke';
    if (action === 'API_KEY_ROTATED') return 'kf-action-chip-rotate';
    return '';
  }
}
