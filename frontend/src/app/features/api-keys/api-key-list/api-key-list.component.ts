import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ApiKeyService } from '../../../core/services/api-key.service';
import { SessionStateService } from '../../../core/state/session-state.service';
import { ApiKey } from '../../../core/models/api-key.model';
import { MaskKeyPipe } from '../../../shared/pipes/mask-key.pipe';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { CreateApiKeyDialogComponent } from '../create-api-key-dialog/create-api-key-dialog.component';
import { KeyCreatedDialogComponent } from '../key-created-dialog/key-created-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';

@Component({
  selector: 'kf-api-key-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatPaginatorModule,
    MatTooltipModule,
    MaskKeyPipe,
    LoadingSpinnerComponent,
    HasPermissionDirective,
  ],
  template: `
    <div style="padding: 20px 30px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 18px;">
        <h2 style="font-size:20px; margin:0;">API Keys</h2>
        <button
          mat-flat-button
          color="primary"
          (click)="openCreateDialog()"
          *kfHasPermission
          ="'api_key:create'"
        >
          <mat-icon>vpn_key</mat-icon>
          Create API Key
        </button>
      </div>

      @if (loading()) {
        <kf-loading-spinner label="Loading API keys..."></kf-loading-spinner>
      } @else {
        <table mat-table [dataSource]="keys()" style="width:100%; margin-bottom: 8px;" class="mat-elevation-z1">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let key">{{ key.name }}</td>
          </ng-container>

          <ng-container matColumnDef="prefix">
            <th mat-header-cell *matHeaderCellDef>Key</th>
            <td mat-cell *matCellDef="let key"><code>{{ key.keyPrefix | maskKey }}</code></td>
          </ng-container>

          <ng-container matColumnDef="scopes">
            <th mat-header-cell *matHeaderCellDef>Scopes</th>
            <td mat-cell *matCellDef="let key">
              @if (key.scopes?.length) {
                @for (scope of key.scopes; track scope) {
                  <mat-chip class="kf-scope-chip">{{ scope }}</mat-chip>
                }
              } @else {
                <span style="color: #757575;">No scopes</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let key">
              <mat-chip [class]="statusChipClass(key.status)">{{ key.status }}</mat-chip>
            </td>
          </ng-container>

          <ng-container matColumnDef="rateLimit">
            <th mat-header-cell *matHeaderCellDef>Rate Limit</th>
            <td mat-cell *matCellDef="let key">{{ key.rateLimitPerMinute }}/min</td>
          </ng-container>

          <ng-container matColumnDef="lastUsed">
            <th mat-header-cell *matHeaderCellDef>Last Used</th>
            <td mat-cell *matCellDef="let key">{{ key.lastUsedAt ? (key.lastUsedAt | date: 'short') : 'Never' }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let key">
              <button
                mat-icon-button
                matTooltip="Revoke key"
                [disabled]="key.status !== 'ACTIVE' && key.status !== 'ROTATING'"
                (click)="revokeKey(key)"
                *kfHasPermission="'api_key:delete'"
              >
                <mat-icon>block</mat-icon>
              </button>
              <button
                mat-icon-button
                matTooltip="Rotate key"
                [disabled]="key.status !== 'ACTIVE'"
                (click)="rotateKey(key)"
                *kfHasPermission="'api_key:create'"
              >
                <mat-icon>autorenew</mat-icon>
              </button>
              <button
                mat-icon-button
                matTooltip="View usage analytics"
                (click)="viewAnalytics(key)"
                *kfHasPermission="'analytics:read'"
              >
                <mat-icon>insights</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>

        <mat-paginator
          [length]="totalElements()"
          [pageSize]="pageSize()"
          [pageIndex]="pageIndex()"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPageChange($event)"
        ></mat-paginator>
      }
    </div>
  `,
  styles: [`
    .kf-scope-chip {
      font-size: 11px;
      margin-right: 4px;
    }
    .kf-status-chip-active {
      background-color: #4caf50 !important;
      color: white !important;
    }
    .kf-status-chip-rotating {
      background-color: #ff9800 !important;
      color: white !important;
    }
    .kf-status-chip-revoked {
      background-color: #f44336 !important;
      color: white !important;
    }
    .kf-status-chip-expired {
      background-color: #9e9e9e !important;
      color: white !important;
    }
  `],
})
export class ApiKeyListComponent implements OnInit {
  private readonly apiKeyService = inject(ApiKeyService);
  private readonly sessionState = inject(SessionStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  keys = signal<ApiKey[]>([]);
  loading = signal(true);
  totalElements = signal(0);
  pageSize = signal(10);
  pageIndex = signal(0);
  displayedColumns = ['name', 'prefix', 'scopes', 'status', 'rateLimit', 'lastUsed', 'actions'];

  private projectId!: string;
  private readonly orgId$ = toObservable(this.sessionState.currentOrgId);

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('projectId')!;
    this.orgId$
      .pipe(
        filter((orgId): orgId is string => !!orgId),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.load();
      });
  }

  load(): void {
    const orgId = this.sessionState.currentOrgId();
    if (!orgId) return;

    this.loading.set(true);
    this.apiKeyService.list(orgId, this.projectId, this.pageIndex(), this.pageSize()).subscribe({
      next: (page) => {
        this.keys.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  statusChipClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'kf-status-chip-active';
      case 'ROTATING':
        return 'kf-status-chip-rotating';
      case 'REVOKED':
        return 'kf-status-chip-revoked';
      case 'EXPIRED':
        return 'kf-status-chip-expired';
      default:
        return '';
    }
  }

  openCreateDialog(): void {
    const orgId = this.sessionState.currentOrgId();
    if (!orgId) return;

    const ref = this.dialog.open(CreateApiKeyDialogComponent, {
      width: '520px',
      data: { organizationId: orgId, projectId: this.projectId },
    });

    ref.afterClosed().subscribe((created) => {
      if (created?.fullKey) {
        this.dialog.open(KeyCreatedDialogComponent, {
          width: '520px',
          disableClose: true,
          data: { fullKey: created.fullKey, keyName: created.apiKey.name },
        });
        this.load();
      }
    });
  }

  revokeKey(key: ApiKey): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: 'Revoke API Key',
        message: `Are you sure you want to revoke "${key.name}"? This action cannot be undone and any client using it will stop working immediately.`,
        confirmText: 'Revoke Key',
        color: 'warn',
        icon: 'block',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.apiKeyService.revoke(key.id).subscribe({
        next: () => {
          this.snackBar.open('API key revoked', 'Dismiss', { duration: 3000 });
          this.load();
        },
        error: (err) => {
          const msg = err?.error?.message || 'Failed to revoke API key';
          this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
        },
      });
    });
  }

  rotateKey(key: ApiKey): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '480px',
      data: {
        title: 'Rotate API Key',
        message: `Rotate "${key.name}"?\n\nA new key will be generated immediately. The old key will remain valid for a 24-hour grace period so active integrations don't break.`,
        confirmText: 'Rotate Key',
        color: 'primary',
        icon: 'autorenew',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.apiKeyService.rotate(key.id).subscribe({
        next: (created) => {
          this.dialog.open(KeyCreatedDialogComponent, {
            width: '520px',
            disableClose: true,
            data: { fullKey: created.fullKey, keyName: created.apiKey.name },
          });
          this.load();
        },
        error: (err) => {
          const msg = err?.error?.message || 'Failed to rotate API key';
          this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
        },
      });
    });
  }

  viewAnalytics(key: ApiKey): void {
    this.router.navigate(['/projects', this.projectId, 'keys', key.id, 'analytics']);
  }
}
