import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatCardModule, MatIconModule, StatusBadgeComponent],
  template: `
    <h1 class="page-title">Dashboard</h1>
    <div class="stat-grid">
      <mat-card class="stat-card">
        <mat-card-content>
          <div class="stat-label">Total Instances</div>
          <div class="stat-value">{{ instances()?.length ?? '—' }}</div>
        </mat-card-content>
      </mat-card>
      <mat-card class="stat-card">
        <mat-card-content>
          <div class="stat-label">Running</div>
          <div class="stat-value running">
            {{ running() }}
          </div>
        </mat-card-content>
      </mat-card>
      <mat-card class="stat-card">
        <mat-card-content>
          <div class="stat-label">Stopped</div>
          <div class="stat-value">{{ stopped() }}</div>
        </mat-card-content>
      </mat-card>
    </div>

    <h2 class="section-title">Instances</h2>
    <div class="instance-list">
      @for (inst of instances(); track inst.id) {
        <mat-card class="instance-row">
          <mat-card-content>
            <div class="instance-row__main">
              <span class="instance-name">{{ inst.name }}</span>
              <app-status-badge [status]="inst.status" />
            </div>
            <div class="instance-row__meta">
              <span class="model-chip">{{ inst.currentModel }}</span>
              <span class="port-chip">:{{ inst.hostPort }}</span>
            </div>
          </mat-card-content>
        </mat-card>
      } @empty {
        <p class="empty-state">No instances yet. <a routerLink="/instances">Create one →</a></p>
      }
    </div>
  `,
  styles: [`
    .page-title    { font-size: 22px; font-weight: 700; margin: 0 0 24px; }
    .section-title { font-size: 16px; font-weight: 600; margin: 32px 0 12px; color: var(--text-secondary); }
    .stat-grid     { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
    .stat-card     { background: var(--bg-surface); border: 1px solid var(--border); }
    .stat-label    { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value    { font-size: 36px; font-weight: 700; margin-top: 4px; }
    .stat-value.running { color: var(--accent-green); }
    .instance-list { display: flex; flex-direction: column; gap: 8px; }
    .instance-row  { background: var(--bg-surface); border: 1px solid var(--border); }
    .instance-row__main { display: flex; align-items: center; gap: 12px; }
    .instance-row__meta { margin-top: 6px; display: flex; gap: 8px; }
    .instance-name { font-weight: 600; }
    .model-chip    { font-size: 11px; background: rgba(59,130,246,.12); color: var(--accent-blue); padding: 2px 8px; border-radius: 999px; }
    .port-chip     { font-size: 11px; color: var(--text-secondary); }
    .empty-state   { color: var(--text-secondary); }
    .empty-state a { color: var(--accent-blue); }
  `],
})
export class DashboardComponent {
  private readonly http = inject(HttpClient);

  readonly instances = toSignal(
    this.http.get<any[]>(`${environment.apiBase}/instances`),
    { initialValue: [] }
  );

  readonly running = () => this.instances()?.filter(i => i.status === 'running').length ?? 0;
  readonly stopped = () => this.instances()?.filter(i => i.status === 'stopped').length ?? 0;
}
