import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ApiKeyService } from '../../../core/services/api-key.service';
import { ALL_SCOPES, Scope } from '../../../core/models/api-key.model';

export interface CreateApiKeyDialogData {
  organizationId: string;
  projectId: string;
}

@Component({
  selector: 'kf-create-api-key-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  template: `
    <h2 mat-dialog-title>Create API Key</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="kf-key-form">
        <mat-form-field appearance="outline" class="kf-full-width">
          <mat-label>Key name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Production Server Key" />
        </mat-form-field>

        <label class="kf-key-form__scopes-label">Scopes</label>
        <div class="kf-key-form__scopes" formArrayName="scopes">
          @for (scope of allScopes; track scope.value; let i = $index) {
            <mat-checkbox [formControlName]="i">
              {{ scope.label }}
              <span class="kf-key-form__scope-desc">{{ scope.description }}</span>
            </mat-checkbox>
          }
        </div>
        @if (form.controls.scopes.hasError('required') && submittedOnce()) {
          <div class="kf-key-form__scope-error">Select at least one scope</div>
        }

        <mat-form-field appearance="outline" class="kf-full-width">
          <mat-label>Expires on (optional)</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="expiresAt" />
          <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
          <mat-hint>Leave blank for a key that never expires</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="kf-full-width">
          <mat-label>Rate limit (requests/minute)</mat-label>
          <input matInput type="number" formControlName="rateLimitPerMinute" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(null)">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="submitting()" (click)="submit()">
        Create Key
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .kf-key-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-top: 8px;
    }

    .kf-key-form__scopes-label {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
      margin-bottom: 4px;
    }

    .kf-key-form__scopes {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
      padding: 8px 0;
    }

    .kf-key-form__scope-desc {
      display: block;
      font-size: 11px;
      color: rgba(0, 0, 0, 0.5);
      margin-left: 32px;
      margin-top: -2px;
    }

    .kf-key-form__scope-error {
      color: #b3261e;
      font-size: 12px;
      margin-bottom: 12px;
    }
  `],
})
export class CreateApiKeyDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<CreateApiKeyDialogComponent>);
  private readonly data = inject<CreateApiKeyDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly apiKeyService = inject(ApiKeyService);

  readonly allScopes = ALL_SCOPES;
  submitting = signal(false);
  submittedOnce = signal(false);

  form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    scopes: this.fb.array(
      this.allScopes.map(() => this.fb.control(false)),
      (control) => {
        const selected = (control as FormArray).value.some((val: boolean) => val);
        return selected ? null : { required: true };
      }
    ),
    expiresAt: this.fb.control<Date | null>(null),
    rateLimitPerMinute: this.fb.nonNullable.control(60, [Validators.required]),
  });

  submit(): void {
    this.submittedOnce.set(true);
    if (this.form.invalid) {
      return;
    }

    this.submitting.set(true);
    const raw = this.form.getRawValue();

    // Map boolean array back to Scope[]
    const selectedScopes = this.allScopes
      .filter((_, i) => raw.scopes[i])
      .map(s => s.value);

    this.apiKeyService
      .create(this.data.organizationId, this.data.projectId, {
        name: raw.name,
        scopes: selectedScopes,
        expiresAt: raw.expiresAt ? new Date(raw.expiresAt).toISOString() : null,
        rateLimitPerMinute: raw.rateLimitPerMinute,
      })
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          this.dialogRef.close(result);
        },
        error: () => {
          this.submitting.set(false);
        },
      });
  }
}
