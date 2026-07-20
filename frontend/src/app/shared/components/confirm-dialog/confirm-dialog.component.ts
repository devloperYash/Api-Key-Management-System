import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  color?: 'primary' | 'accent' | 'warn';
  icon?: string;
}

@Component({
  selector: 'kf-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title style="display:flex; align-items:center; gap:8px;">
      @if (data.icon) {
        <mat-icon [color]="data.color || 'primary'">{{ data.icon }}</mat-icon>
      }
      <span>{{ data.title }}</span>
    </h2>
    <mat-dialog-content>
      <p style="font-size:14px; color: #424242; line-height: 1.5; margin: 8px 0;">
        {{ data.message }}
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end" style="padding-top: 12px;">
      <button mat-button (click)="dialogRef.close(false)">
        {{ data.cancelText || 'Cancel' }}
      </button>
      <button
        mat-flat-button
        [color]="data.color || 'primary'"
        (click)="dialogRef.close(true)"
      >
        {{ data.confirmText }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
