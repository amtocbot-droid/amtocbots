import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { SwitchRulesComponent } from '../switch-rules/switch-rules.component';

export interface TokenUsageSummary {
  instanceId: string;
  model: string;
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
}

export interface InstanceSummary { id: string; name: string; currentModel: string; }

interface ModelAggregate {
  model: string;
  totalTokens: number;
  estimatedCostUsd: number;
  pct: number;
  instances: number;
}

@Component({
  selector: 'app-token-dashboard',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatSelectModule,
    FormsModule, MatTableModule, MatTooltipModule, RouterLink, SwitchRulesComponent],
  template: `
    <div class="page-header">
      <h1 class="page-title">Model & Token Intelligence</h1>
      <mat-select [(ngModel)]="days" (ngModelChange)="load()" class="days-select">
        <mat-option [value]="1">Today</mat-option>
        <mat-option [value]="7">Last 7 days</mat-option>
        <mat-option [value]="30">Last 30 days</mat-option>
      </mat-select>
    </div>

    <!-- Summary cards -->
    <div class="summary-grid">
      <mat-card class="summary-card">
        <mat-card-content>
          <div class="s-label">Total Tokens Used</div>
          <div class="s-value">{{ totalTokens() | number }}</div>
        </mat-card-content>
      </mat-card>
      <mat-card class="summary-card">
        <mat-card-content>
          <div class="s-label">Est. Cost (USD)</div>
          <div class="s-value cost">{{ totalCost() | currency:'USD':'symbol':'1.4-4' }}</div>
        </mat-card-content>
      </mat-card>
      <mat-card class="summary-card">
        <mat-card-content>
          <div class="s-label">Active Models</div>
          <div class="s-value">{{ modelAggregates().length }}</div>
        </mat-card-content>
      </mat-card>
    </div>

    <!-- Model breakdown -->
    <mat-card class="breakdown-card">
      <mat-card-header><mat-card-title>Usage by Model</mat-card-title></mat-card-header>
      <mat-card-content>
        @for (m of modelAggregates(); track m.model) {
          <div class="model-row">
            <div class="model-info">
              <span class="model-name">{{ m.model }}</span>
              <span class="model-instances">{{ m.instances }} instance{{ m.instances !== 1 ? 's' : '' }}</span>
            </div>
            <div class="model-bar-wrap">
              <div class="model-bar" [style.width.%]="m.pct"
                [class.bar-high]="m.pct > 75"
                [class.bar-mid]="m.pct > 40 && m.pct <= 75">
              </div>
            </div>
            <span class="model-tokens">{{ m.totalTokens | number }}</span>
            @if (m.estimatedCostUsd > 0) {
              <span class="model-cost">{{ m.estimatedCostUsd | currency:'USD':'symbol':'1.4-4' }}</span>
            }
            <span class="model-pct">{{ m.pct | number:'1.0-0' }}%</span>
          </div>
        } @empty {
          <p class="empty-state">No token usage recorded yet.</p>
        }
      </mat-card-content>
    </mat-card>

    <!-- Per-instance table -->
    <mat-card class="table-card">
      <mat-card-header><mat-card-title>Per-Instance Detail</mat-card-title></mat-card-header>
      <mat-card-content>
        <table mat-table [dataSource]="tableData()" class="usage-table">
          <ng-container matColumnDef="instance">
            <th mat-header-cell *matHeaderCellDef>Instance</th>
            <td mat-cell *matCellDef="let row">
              <a [routerLink]="['/instances', row.instanceId]" class="inst-link">{{ instanceName(row.instanceId) }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="model">
            <th mat-header-cell *matHeaderCellDef>Model</th>
            <td mat-cell *matCellDef="let row"><span class="model-chip">{{ row.model }}</span></td>
          </ng-container>
          <ng-container matColumnDef="total">
            <th mat-header-cell *matHeaderCellDef>Total Tokens</th>
            <td mat-cell *matCellDef="let row">{{ row.totalTokens | number }}</td>
          </ng-container>
          <ng-container matColumnDef="cost">
            <th mat-header-cell *matHeaderCellDef>Est. Cost</th>
            <td mat-cell *matCellDef="let row">{{ (row.estimatedCostUsd ?? 0) | currency:'USD':'symbol':'1.4-4' }}</td>
          </ng-container>
          <ng-container matColumnDef="rules">
            <th mat-header-cell *matHeaderCellDef>Rules</th>
            <td mat-cell *matCellDef="let row">
              <a mat-stroked-button [routerLink]="['/models', row.instanceId, 'rules']" class="small-btn">
                <mat-icon>rule</mat-icon> Manage
              </a>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </mat-card-content>
    </mat-card>

    <!-- Switch Rules (global view) -->
    <mat-card class="rules-card">
      <mat-card-header><mat-card-title>Auto-Switch Rules</mat-card-title></mat-card-header>
      <mat-card-content>
        <p class="rules-hint">Configure per-instance rules to automatically switch models based on token thresholds or a schedule.</p>
        @for (inst of instances(); track inst.id) {
          <div class="inst-rules-section">
            <div class="inst-rules-header">
              <a [routerLink]="['/instances', inst.id]" class="inst-link">{{ inst.name }}</a>
              <span class="current-model-chip">{{ inst.currentModel }}</span>
            </div>
            <app-switch-rules [instanceId]="inst.id" />
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .page-header  { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .page-title   { font-size: 22px; font-weight: 700; margin: 0; flex: 1; }
    .days-select  { width: 140px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .summary-card { background: var(--bg-surface); border: 1px solid var(--border); }
    .s-label      { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .5px; }
    .s-value      { font-size: 32px; font-weight: 700; margin-top: 4px; }
    .s-value.cost { color: var(--accent-amber); }
    .breakdown-card, .table-card, .rules-card { background: var(--bg-surface); border: 1px solid var(--border); margin-bottom: 20px; }
    .model-row    { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
    .model-row:last-child { border-bottom: none; }
    .model-info   { display: flex; flex-direction: column; min-width: 200px; }
    .model-name   { font-size: 13px; font-weight: 600; }
    .model-instances { font-size: 11px; color: var(--text-secondary); }
    .model-bar-wrap { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
    .model-bar    { height: 100%; background: var(--accent-blue); border-radius: 4px; transition: width .4s ease; }
    .model-bar.bar-mid  { background: var(--accent-amber); }
    .model-bar.bar-high { background: var(--accent-red); }
    .model-tokens { font-size: 13px; min-width: 80px; text-align: right; }
    .model-cost   { font-size: 12px; color: var(--accent-amber); min-width: 72px; text-align: right; }
    .model-pct    { font-size: 12px; color: var(--text-secondary); min-width: 36px; text-align: right; }
    .usage-table  { width: 100%; }
    .model-chip   { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(59,130,246,.12); color: var(--accent-blue); }
    .inst-link    { color: var(--accent-blue); text-decoration: none; font-size: 13px; }
    .small-btn    { font-size: 11px; padding: 2px 8px; line-height: 24px; min-width: 0; height: 28px; }
    .rules-hint   { color: var(--text-secondary); font-size: 13px; margin-bottom: 16px; }
    .inst-rules-section { border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 16px; }
    .inst-rules-section:last-child { border-bottom: none; }
    .inst-rules-header  { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .current-model-chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(16,185,129,.12); color: var(--accent-green); }
    .empty-state  { color: var(--text-secondary); font-size: 13px; }
  `],
})
export class TokenDashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);

  days = 7;
  readonly usageData  = signal<TokenUsageSummary[]>([]);
  readonly instances  = signal<InstanceSummary[]>([]);

  readonly displayedColumns = ['instance', 'model', 'total', 'cost', 'rules'];

  readonly totalTokens = computed(() => this.usageData().reduce((s, r) => s + r.totalTokens, 0));
  readonly totalCost   = computed(() => this.usageData().reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0));

  readonly modelAggregates = computed<ModelAggregate[]>(() => {
    const map = new Map<string, ModelAggregate>();
    for (const r of this.usageData()) {
      const existing = map.get(r.model) ?? { model: r.model, totalTokens: 0, estimatedCostUsd: 0, pct: 0, instances: 0 };
      map.set(r.model, {
        ...existing,
        totalTokens: existing.totalTokens + r.totalTokens,
        estimatedCostUsd: existing.estimatedCostUsd + (r.estimatedCostUsd ?? 0),
        instances: existing.instances + 1,
      });
    }
    const total = this.totalTokens();
    return [...map.values()]
      .map(m => ({ ...m, pct: total > 0 ? (m.totalTokens / total) * 100 : 0 }))
      .sort((a, b) => b.totalTokens - a.totalTokens);
  });

  readonly tableData = computed(() =>
    [...this.usageData()].sort((a, b) => b.totalTokens - a.totalTokens)
  );

  instanceName(id: string): string {
    return this.instances().find(i => i.id === id)?.name ?? id.substring(0, 8);
  }

  async ngOnInit() {
    await Promise.all([this.load(), this.loadInstances()]);
  }

  async load() {
    const data = await firstValueFrom(
      this.http.get<TokenUsageSummary[]>(`${environment.apiBase}/token-usage/summary?days=${this.days}`)
    );
    this.usageData.set(data);
  }

  private async loadInstances() {
    const list = await firstValueFrom(this.http.get<InstanceSummary[]>(`${environment.apiBase}/instances`));
    this.instances.set(list);
  }
}
