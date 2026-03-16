import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface AvailableModel { id: string; provider: string; local: boolean; }

@Component({
  selector: 'app-instance-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
  ],
  template: `
    <div class="form-page">
      <div class="form-header">
        <a mat-icon-button routerLink="/instances"><mat-icon>arrow_back</mat-icon></a>
        <h1 class="page-title">New Instance</h1>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="instance-form">
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="my-assistant" />
          <mat-hint>Used as container name prefix</mat-hint>
          <mat-error>Required, max 100 chars, no spaces</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="2"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Model</mat-label>
          <mat-select formControlName="model">
            @for (m of models(); track m.id) {
              <mat-option [value]="m.id">
                {{ m.id }} @if (m.local) { <span class="local-chip">local</span> }
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="resource-row">
          <mat-form-field appearance="outline" class="resource-field">
            <mat-label>CPU Limit (cores)</mat-label>
            <input matInput formControlName="cpuLimit" type="number" step="0.5" min="0.5" />
            <mat-hint>e.g. 1.0 = 1 core. Leave blank for no limit.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="resource-field">
            <mat-label>Memory Limit (MB)</mat-label>
            <input matInput formControlName="memoryLimitMb" type="number" min="256" step="256" />
            <mat-hint>e.g. 512. Leave blank for no limit.</mat-hint>
          </mat-form-field>
        </div>

        @if (createdToken()) {
          <div class="token-box">
            <mat-icon>key</mat-icon>
            <div>
              <div class="token-label">Instance API Token (shown once — copy now)</div>
              <code class="token-value">{{ createdToken() }}</code>
            </div>
          </div>
        }

        <div class="form-actions">
          <a mat-stroked-button routerLink="/instances">Cancel</a>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
            @if (saving()) { Creating… } @else { Create Instance }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .form-page  { max-width: 640px; }
    .form-header { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }
    .page-title  { margin: 0; font-size: 22px; font-weight: 700; }
    .instance-form { display: flex; flex-direction: column; gap: 16px; }
    mat-form-field { width: 100%; }
    .resource-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .resource-field { width: 100%; }
    .form-actions   { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
    .local-chip { font-size: 10px; background: rgba(16,185,129,.15); color: var(--accent-green);
      padding: 1px 6px; border-radius: 999px; margin-left: 6px; }
    .token-box { display: flex; gap: 12px; background: rgba(16,185,129,.08); border: 1px solid rgba(16,185,129,.3);
      border-radius: var(--radius-md); padding: 16px; }
    .token-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
    .token-value { display: block; font-size: 12px; word-break: break-all; color: var(--accent-green); }
  `],
})
export class InstanceFormComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly snack  = inject(MatSnackBar);

  readonly models      = signal<AvailableModel[]>([]);
  readonly saving      = signal(false);
  readonly createdToken = signal<string | null>(null);

  readonly form = this.fb.group({
    name:          ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/^[a-z0-9-]+$/)]],
    description:   [''],
    model:         ['anthropic/claude-sonnet-4-6', Validators.required],
    cpuLimit:      [null as number | null],
    memoryLimitMb: [null as number | null],
  });

  async ngOnInit() {
    const models = await firstValueFrom(
      this.http.get<AvailableModel[]>(`${environment.apiBase}/models/available`)
    );
    this.models.set(models);
  }

  async submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const res = await firstValueFrom(
        this.http.post<{ instanceId: string; token: string }>(`${environment.apiBase}/instances`, {
          name: v.name, description: v.description || undefined,
          model: v.model, cpuLimit: v.cpuLimit || undefined, memoryLimitMb: v.memoryLimitMb || undefined,
        })
      );
      this.createdToken.set(res.token);
      this.snack.open('Instance created! Copy the API token above.', undefined, { duration: 6000 });
      // Stay on page so user can copy token, then navigate away after a delay
      setTimeout(() => this.router.navigate(['/instances', res.instanceId]), 8000);
    } catch (e: any) {
      this.snack.open(e?.error?.detail ?? 'Create failed', 'Dismiss', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }
}
