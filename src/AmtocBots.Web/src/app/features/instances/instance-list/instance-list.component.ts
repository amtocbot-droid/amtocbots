import { Component, OnInit, inject, Pipe, PipeTransform } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { DecimalPipe } from '@angular/common';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InstanceStore } from '../instance.store';
import { AuthService } from '../../../core/auth/auth.service';

@Pipe({ name: 'cpuClamp', standalone: true })
export class CpuClampPipe implements PipeTransform {
  transform(v: number): number { return Math.min(100, Math.max(0, v)); }
}

@Component({
  selector: 'app-instance-list',
  standalone: true,
  imports: [
    RouterLink, MatCardModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatTooltipModule, StatusBadgeComponent, DecimalPipe, CpuClampPipe,
  ],
  template: `
    <div class="page-header">
      <h1 class="page-title">Instances</h1>
      @if (auth.isOperator()) {
        <a mat-flat-button color="primary" routerLink="/instances/new">
          <mat-icon>add</mat-icon> New Instance
        </a>
      }
    </div>

    @if (store.loading()) {
      <mat-progress-bar mode="indeterminate" />
    } @else if (store.error()) {
      <p class="error-state">{{ store.error() }}</p>
    } @else {
      <div class="summary-row">
        <span class="summary-chip running">{{ store.runningCount() }} running</span>
        <span class="summary-chip">{{ store.stoppedCount() }} stopped</span>
        <span class="summary-chip total">{{ store.instances().length }} total</span>
      </div>

      <div class="instance-grid">
        @for (inst of store.instances(); track inst.id) {
          <mat-card class="instance-card" [class.card--running]="inst.status === 'running'">
            <mat-card-header>
              <mat-card-title>
                <a [routerLink]="['/instances', inst.id]" class="inst-name">{{ inst.name }}</a>
              </mat-card-title>
              <mat-card-subtitle>
                <app-status-badge [status]="inst.status" />
              </mat-card-subtitle>
            </mat-card-header>

            <mat-card-content>
              <div class="model-chip">{{ inst.currentModel }}</div>

              @if (inst.stats) {
                <div class="metrics">
                  <div class="metric">
                    <span class="metric-label">CPU</span>
                    <div class="metric-bar-wrap">
                      <div class="metric-bar" [style.width.%]="inst.stats.cpuPercent | cpuClamp"></div>
                    </div>
                    <span class="metric-val">{{ inst.stats.cpuPercent | number:'1.1-1' }}%</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">MEM</span>
                    <div class="metric-bar-wrap">
                      <div class="metric-bar mem"
                        [style.width.%]="memPct(inst.stats)"></div>
                    </div>
                    <span class="metric-val">{{ inst.stats.memoryUsageMb }}MB</span>
                  </div>
                </div>
              }

              <div class="port-row">
                <mat-icon class="port-icon">lan</mat-icon> :{{ inst.hostPort }}
              </div>
            </mat-card-content>

            @if (auth.isOperator()) {
              <mat-card-actions>
                @if (inst.status === 'stopped' || inst.status === 'error') {
                  <button mat-icon-button color="primary" matTooltip="Start"
                    (click)="store.start(inst.id)">
                    <mat-icon>play_arrow</mat-icon>
                  </button>
                }
                @if (inst.status === 'running') {
                  <button mat-icon-button matTooltip="Restart"
                    (click)="store.restart(inst.id)">
                    <mat-icon>restart_alt</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" matTooltip="Stop"
                    (click)="store.stop(inst.id)">
                    <mat-icon>stop</mat-icon>
                  </button>
                }
                <button mat-icon-button matTooltip="Configure"
                  [routerLink]="['/instances', inst.id]">
                  <mat-icon>settings</mat-icon>
                </button>
                @if (auth.isAdmin()) {
                  <button mat-icon-button color="warn" matTooltip="Delete"
                    (click)="confirmDelete(inst.id, inst.name)">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </mat-card-actions>
            }
          </mat-card>
        } @empty {
          <div class="empty-state">
            <mat-icon class="empty-icon">smart_toy</mat-icon>
            <p>No instances yet.</p>
            <a mat-flat-button color="primary" routerLink="/instances/new">Create your first instance</a>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-title  { font-size: 22px; font-weight: 700; margin: 0; }
    .summary-row { display: flex; gap: 10px; margin-bottom: 20px; }
    .summary-chip { padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600;
      background: var(--bg-elevated); color: var(--text-secondary); }
    .summary-chip.running { color: var(--accent-green); background: rgba(16,185,129,.1); }
    .summary-chip.total   { color: var(--accent-blue);  background: rgba(59,130,246,.1); }
    .instance-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .instance-card { background: var(--bg-surface); border: 1px solid var(--border); transition: border-color .2s; }
    .instance-card.card--running { border-color: rgba(16,185,129,.4); }
    .inst-name { color: var(--text-primary); text-decoration: none; font-weight: 600; }
    .inst-name:hover { color: var(--accent-blue); }
    .model-chip { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 999px;
      background: rgba(59,130,246,.12); color: var(--accent-blue); margin-bottom: 10px; }
    .metrics { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .metric  { display: flex; align-items: center; gap: 8px; }
    .metric-label { font-size: 10px; color: var(--text-secondary); width: 28px; text-transform: uppercase; }
    .metric-bar-wrap { flex: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
    .metric-bar { height: 100%; background: var(--accent-blue); border-radius: 2px; transition: width .5s ease; }
    .metric-bar.mem { background: var(--accent-green); }
    .metric-val { font-size: 11px; color: var(--text-secondary); width: 44px; text-align: right; }
    .port-row { display: flex; align-items: center; gap: 4px; color: var(--text-secondary); font-size: 12px; }
    .port-icon { font-size: 14px; width: 14px; height: 14px; }
    .error-state { color: var(--accent-red); }
    .empty-state { grid-column: 1/-1; text-align: center; padding: 48px; color: var(--text-secondary); }
    .empty-icon  { font-size: 48px; width: 48px; height: 48px; opacity: .3; }
  `],
})
export class InstanceListComponent implements OnInit {
  readonly store = inject(InstanceStore);
  readonly auth  = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  ngOnInit() { this.store.loadAll(); }

  memPct(stats: { memoryUsageMb: number; memoryLimitMb: number }): number {
    return stats.memoryLimitMb > 0
      ? Math.min(100, (stats.memoryUsageMb / stats.memoryLimitMb) * 100)
      : 0;
  }

  confirmDelete(id: string, name: string): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete Instance', message: `Delete "${name}"? This will stop and remove the container.`, confirmLabel: 'Delete' },
      width: '380px',
    }).afterClosed().subscribe(ok => { if (ok) this.store.delete(id); });
  }
}
