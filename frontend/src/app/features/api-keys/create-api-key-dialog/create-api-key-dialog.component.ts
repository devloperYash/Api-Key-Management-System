import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { ApiKeyService } from '../../../core/services/api-key.service';
import { GeminiAiService } from '../../../core/services/gemini-ai.service';
import { ALL_SCOPES, Scope } from '../../../core/models/api-key.model';
import { MatNativeDateModule } from '@angular/material/core';

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
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  template: `
    <h2 mat-dialog-title style="display:flex; justify-content:space-between; align-items:center;">
      <span>Create API Key</span>
      <button
        type="button"
        mat-stroke-button
        color="accent"
        style="font-size:12px; height:32px; border-radius:16px;"
        [disabled]="aiLoading()"
        (click)="applyAiRecommendation()"
        title="Autofill optimal scopes using Forge Assistant"
      >
        <mat-icon style="font-size:16px; width:16px; height:16px; margin-right:4px;">auto_awesome</mat-icon>
        Ask Forge Assistant
      </button>
    </h2>
    <mat-dialog-content>
      @if (aiReasoning()) {
        <div style="background:#eef1fb; border-left:4px solid #3f51b5; padding:8px 12px; border-radius:4px; margin-bottom:12px; font-size:12px; color:#333;">
          <strong>Forge Assistant Advisor:</strong> {{ aiReasoning() }}
        </div>
      }

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
  private readonly geminiAi = inject(GeminiAiService);

  readonly allScopes = ALL_SCOPES;
  submitting = signal(false);
  submittedOnce = signal(false);
  aiLoading = signal(false);
  aiReasoning = signal<string | null>(null);

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

  applyAiRecommendation(): void {
    const keyName = this.form.controls.name.value;
    this.aiLoading.set(true);

    this.geminiAi.recommendScopesForKey(keyName).subscribe({
      next: (rec) => {
        this.aiLoading.set(false);
        this.aiReasoning.set(rec.reasoning);

        // Update rate limit
        this.form.controls.rateLimitPerMinute.setValue(rec.recommendedRateLimit);

        // Update scope checkboxes
        const scopesArray = this.form.controls.scopes as FormArray;
        this.allScopes.forEach((scope, index) => {
          const isRecommended = rec.recommendedScopes.includes(scope.value);
          scopesArray.at(index).setValue(isRecommended);
        });
      },
      error: () => {
        this.aiLoading.set(false);
      },
    });
  }

  submit(): void {
    this.submittedOnce.set(true);
    if (this.form.invalid) {
      return;
    }

    this.submitting.set(true);
    const raw = this.form.getRawValue();

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
