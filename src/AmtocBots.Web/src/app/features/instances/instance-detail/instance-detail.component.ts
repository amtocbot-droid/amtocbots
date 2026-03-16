import { Component, OnInit, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InstanceStore } from '../instance.store';
import { InstanceApiService } from '../instance-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { InstanceDetail } from '../instance.models';
import { InstanceConfigEditorComponent } from '../instance-config-editor/instance-config-editor.component';
import { InstanceLogViewerComponent } from '../instance-log-viewer/instance-log-viewer.component';
import { ChannelConfigComponent } from '../../channels/channel-config.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-instance-detail',
  standalone: true,
  imports: [
    RouterLink, MatTabsModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule,
    StatusBadgeComponent, InstanceConfigEditorComponent, InstanceLogViewerComponent, ChannelConfigComponent,
  ],
  template: `
    @if (loading()) {
      <div class="center-spinner"><mat-spinner diameter="40" /></div>
    } @else if (detail()) {
      <div class="detail-page">
        <!-- Header -->
        <div class="detail-header">
          <a mat-icon-button routerLink="/instances"><mat-icon>arrow_back</mat-icon></a>
          <div class="detail-title">
            <h1>{{ detail()!.name }}</h1>
            <app-status-badge [status]="liveStatus()" />
          </div>
          <span class="spacer"></span>

          @if (auth.isOperator()) {
            @if (liveStatus() === 'stopped' || liveStatus() === 'error') {
              <button mat-flat-button color="primary" (click)="store.start(id())">
                <mat-icon>play_arrow</mat-icon> Start
              </button>
            }
            @if (liveStatus() === 'running') {
              <button mat-stroked-button (click)="store.restart(id())" matTooltip="Restart">
                <mat-icon>restart_alt</mat-icon>
              </button>
              <button mat-stroked-button color="warn" (click)="store.stop(id())">
                <mat-icon>stop</mat-icon> Stop
              </button>
            }
          }
          @if (auth.isAdmin()) {
            <button mat-icon-button color="warn" matTooltip="Delete instance"
              (click)="confirmDelete()">
              <mat-icon>delete</mat-icon>
            </button>
          }
        </div>

        <!-- Meta row -->
        <div class="meta-row">
          <span class="model-chip">{{ detail()!.currentModel }}</span>
          <span class="meta-item"><mat-icon>lan</mat-icon> :{{ detail()!.hostPort }}</span>
          @if (detail()!.description) {
            <span class="meta-item description">{{ detail()!.description }}</span>
          }
        </div>

        <!-- Live stats bar -->
        @if (liveStats()) {
          <div class="stats-bar">
            <div class="stat-item">
              <span class="stat-l">CPU</span>
              <div class="bar-wrap"><div class="bar" [style.width.%]="liveStats()!.cpuPercent"></div></div>
              <span class="stat-v">{{ liveStats()!.cpuPercent | number:'1.1-1' }}%</span>
            </div>
            <div class="stat-item">
              <span class="stat-l">MEM</span>
              <div class="bar-wrap"><div class="bar mem" [style.width.%]="memPct()"></div></div>
              <span class="stat-v">{{ liveStats()!.memoryUsageMb }} / {{ liveStats()!.memoryLimitMb }} MB</span>
            </div>
          </div>
        }

        <!-- Tabs -->
        <mat-tab-group animationDuration="200ms">
          <mat-tab label="Configuration">
            <div class="tab-body">
              <app-instance-config-editor [instanceId]="id()" />
            </div>
          </mat-tab>
          <mat-tab label="Channels">
            <div class="tab-body">
              <app-channel-config [instanceId]="id()" />
            </div>
          </mat-tab>
          <mat-tab label="Logs">
            <div class="tab-body">
              <app-instance-log-viewer [instanceId]="id()" [isRunning]="liveStatus() === 'running'" />
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    } @else {
      <p class="error-state">Instance not found.</p>
    }
  `,
  styles: [`
    .center-spinner { display: flex; justify-content: center; padding: 64px; }
    .detail-page    { display: flex; flex-direction: column; gap: 16px; }
    .detail-header  { display: flex; align-items: center; gap: 12px; }
    .detail-title   { display: flex; align-items: center; gap: 10px; }
    .detail-title h1 { font-size: 22px; font-weight: 700; margin: 0; }
    .spacer         { flex: 1; }
    .meta-row       { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .model-chip     { font-size: 11px; padding: 2px 10px; border-radius: 999px;
      background: rgba(59,130,246,.12); color: var(--accent-blue); }
    .meta-item      { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary); }
    .meta-item mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .description    { color: var(--text-secondary); font-size: 13px; }
    .stats-bar      { display: flex; gap: 24px; background: var(--bg-surface);
      border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 20px; }
    .stat-item      { display: flex; align-items: center; gap: 10px; flex: 1; }
    .stat-l         { font-size: 10px; color: var(--text-secondary); text-transform: uppercase; width: 28px; }
    .bar-wrap       { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .bar            { height: 100%; background: var(--accent-blue); border-radius: 3px; transition: width .5s ease; }
    .bar.mem        { background: var(--accent-green); }
    .stat-v         { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
    .tab-body       { padding: 20px 0; }
    .error-state    { color: var(--accent-red); }
  `],
})
export class InstanceDetailComponent implements OnInit {
  readonly id = input.required<string>();

  readonly store  = inject(InstanceStore);
  readonly api    = inject(InstanceApiService);
  readonly auth   = inject(AuthService);
  readonly dialog = inject(MatDialog);

  readonly detail  = signal<InstanceDetail | null>(null);
  readonly loading = signal(true);

  // Live data from store signal (updated by SignalR)
  readonly liveStatus = computed(() =>
    this.store.instances().find(i => i.id === this.id())?.status ?? this.detail()?.status ?? 'stopped'
  );
  readonly liveStats = computed(() =>
    this.store.instances().find(i => i.id === this.id())?.stats ?? null
  );
  readonly memPct = computed(() => {
    const s = this.liveStats();
    if (!s || s.memoryLimitMb === 0) return 0;
    return Math.min(100, (s.memoryUsageMb / s.memoryLimitMb) * 100);
  });

  async ngOnInit() {
    try {
      const d = await firstValueFrom(this.api.get(this.id()));
      this.detail.set(d);
      if (d.status === 'running') {
        await this.store.signalr.invoke('instances', 'SubscribeToInstance', this.id());
      }
    } finally {
      this.loading.set(false);
    }
  }

  confirmDelete(): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete Instance', message: `Delete "${this.detail()?.name}"? This stops and removes the container.`, confirmLabel: 'Delete' },
      width: '380px',
    }).afterClosed().subscribe(ok => { if (ok) this.store.delete(this.id()); });
  }
}

import { DecimalPipe } from '@angular/common';
