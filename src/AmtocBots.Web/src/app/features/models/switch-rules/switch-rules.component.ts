import { Component, OnInit, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SwitchRule {
  id: string;
  instanceId: string;
  ruleType: 'threshold' | 'cron' | 'manual';
  triggerModel: string;
  thresholdPct?: number;
  cronExpression?: string;
  targetModel: string;
  isActive: boolean;
  priority: number;
}

export interface SwitchRuleCreate {
  ruleType: 'threshold' | 'cron' | 'manual';
  triggerModel: string;
  thresholdPct?: number;
  cronExpression?: string;
  targetModel: string;
  isActive: boolean;
  priority: number;
}

const COMMON_MODELS = [
  'claude-3-5-sonnet', 'claude-3-haiku', 'claude-3-opus',
  'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo',
  'llama3.2', 'llama3.1', 'mistral', 'gemma2',
];

@Component({
  selector: 'app-switch-rules',
  standalone: true,
  imports: [
    MatButtonModule, MatIconModule, MatSelectModule, MatInputModule,
    MatFormFieldModule, MatSlideToggleModule, MatTooltipModule, FormsModule,
  ],
  template: `
    <div class="rules-container">
      @for (rule of rules(); track rule.id) {
        <div class="rule-row" [class.inactive]="!rule.isActive">
          <div class="rule-type-badge" [class]="'badge-' + rule.ruleType">{{ rule.ruleType }}</div>
          <div class="rule-desc">
            @if (rule.ruleType === 'threshold') {
              When <strong>{{ rule.triggerModel }}</strong> reaches
              <strong>{{ rule.thresholdPct }}%</strong> → switch to
              <strong>{{ rule.targetModel }}</strong>
            } @else if (rule.ruleType === 'cron') {
              At <code>{{ rule.cronExpression }}</code> → switch to
              <strong>{{ rule.targetModel }}</strong>
            } @else {
              Manual override → <strong>{{ rule.targetModel }}</strong>
            }
          </div>
          <div class="rule-actions">
            <mat-slide-toggle
              [checked]="rule.isActive"
              (change)="toggleRule(rule)"
              matTooltip="Enable/disable rule">
            </mat-slide-toggle>
            <button mat-icon-button color="warn" (click)="deleteRule(rule.id)" matTooltip="Delete">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
      }

      @if (rules().length === 0 && !showForm()) {
        <p class="no-rules">No auto-switch rules configured.</p>
      }

      @if (showForm()) {
        <div class="rule-form">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Rule Type</mat-label>
            <mat-select [(ngModel)]="form.ruleType">
              <mat-option value="threshold">Token Threshold</mat-option>
              <mat-option value="cron">Schedule (Cron)</mat-option>
            </mat-select>
          </mat-form-field>

          @if (form.ruleType === 'threshold') {
            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Trigger Model</mat-label>
              <mat-select [(ngModel)]="form.triggerModel">
                @for (m of availableModels; track m) {
                  <mat-option [value]="m">{{ m }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="form-field sm">
              <mat-label>Threshold %</mat-label>
              <input matInput type="number" [(ngModel)]="form.thresholdPct" min="1" max="100" />
            </mat-form-field>
          }

          @if (form.ruleType === 'cron') {
            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Cron Expression</mat-label>
              <input matInput [(ngModel)]="form.cronExpression" placeholder="0 9 * * 1-5" />
            </mat-form-field>
          }

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Switch To Model</mat-label>
            <mat-select [(ngModel)]="form.targetModel">
              @for (m of availableModels; track m) {
                <mat-option [value]="m">{{ m }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field sm">
            <mat-label>Priority</mat-label>
            <input matInput type="number" [(ngModel)]="form.priority" min="1" />
          </mat-form-field>

          <div class="form-actions">
            <button mat-stroked-button (click)="showForm.set(false)">Cancel</button>
            <button mat-flat-button color="primary" (click)="saveRule()" [disabled]="saving()">
              <mat-icon>save</mat-icon> Save Rule
            </button>
          </div>
        </div>
      }

      @if (!showForm()) {
        <button mat-stroked-button class="add-btn" (click)="openForm()">
          <mat-icon>add</mat-icon> Add Rule
        </button>
      }
    </div>
  `,
  styles: [`
    .rules-container  { display: flex; flex-direction: column; gap: 8px; }
    .rule-row         { display: flex; align-items: center; gap: 10px; padding: 8px 12px;
                        background: var(--bg-base); border: 1px solid var(--border); border-radius: var(--radius-sm); }
    .rule-row.inactive { opacity: .5; }
    .rule-type-badge  { font-size: 10px; padding: 2px 7px; border-radius: 999px; font-weight: 600;
                        text-transform: uppercase; letter-spacing: .5px; flex-shrink: 0; }
    .badge-threshold  { background: rgba(59,130,246,.12); color: var(--accent-blue); }
    .badge-cron       { background: rgba(16,185,129,.12); color: var(--accent-green); }
    .badge-manual     { background: rgba(245,158,11,.12); color: var(--accent-amber); }
    .rule-desc        { flex: 1; font-size: 13px; }
    .rule-desc strong { color: var(--text-primary); }
    .rule-desc code   { font-family: monospace; font-size: 12px; background: var(--border);
                        padding: 1px 4px; border-radius: 3px; }
    .rule-actions     { display: flex; align-items: center; gap: 4px; }
    .no-rules         { font-size: 13px; color: var(--text-secondary); margin: 4px 0; }
    .rule-form        { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start;
                        padding: 16px; background: var(--bg-surface); border: 1px solid var(--border);
                        border-radius: var(--radius-sm); }
    .form-field       { min-width: 180px; }
    .form-field.sm    { min-width: 100px; max-width: 120px; }
    .form-actions     { display: flex; gap: 8px; align-items: center; align-self: flex-end; padding-bottom: 4px; }
    .add-btn          { align-self: flex-start; font-size: 12px; }
  `],
})
export class SwitchRulesComponent implements OnInit {
  readonly instanceId = input.required<string>();
  private readonly http = inject(HttpClient);

  readonly rules   = signal<SwitchRule[]>([]);
  readonly saving  = signal(false);
  readonly showForm = signal(false);

  readonly availableModels = COMMON_MODELS;

  form: SwitchRuleCreate = this.blankForm();

  private blankForm(): SwitchRuleCreate {
    return { ruleType: 'threshold', triggerModel: '', thresholdPct: 80, cronExpression: '', targetModel: '', isActive: true, priority: 10 };
  }

  async ngOnInit() {
    await this.loadRules();
  }

  private async loadRules() {
    const data = await firstValueFrom(
      this.http.get<SwitchRule[]>(`${environment.apiBase}/instances/${this.instanceId()}/switch-rules`)
    );
    this.rules.set(data);
  }

  openForm() {
    this.form = this.blankForm();
    this.showForm.set(true);
  }

  async saveRule() {
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBase}/instances/${this.instanceId()}/switch-rules`, this.form)
      );
      await this.loadRules();
      this.showForm.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  async toggleRule(rule: SwitchRule) {
    await firstValueFrom(
      this.http.put(`${environment.apiBase}/instances/${this.instanceId()}/switch-rules/${rule.id}`, {
        ...rule, isActive: !rule.isActive,
      })
    );
    await this.loadRules();
  }

  async deleteRule(id: string) {
    await firstValueFrom(
      this.http.delete(`${environment.apiBase}/instances/${this.instanceId()}/switch-rules/${id}`)
    );
    this.rules.update(rs => rs.filter(r => r.id !== id));
  }
}
