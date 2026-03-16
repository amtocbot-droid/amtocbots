import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { InstanceApiService } from './instance-api.service';
import { ContainerStats, InstanceSummary } from './instance.models';
import { SignalrService } from '../../core/signalr/signalr.service';

@Injectable({ providedIn: 'root' })
export class InstanceStore {
  private readonly api     = inject(InstanceApiService);
  readonly signalr = inject(SignalrService);
  private readonly snack   = inject(MatSnackBar);
  private readonly router  = inject(Router);

  // ── State ──────────────────────────────────────────────────────────────────
  readonly instances = signal<InstanceSummary[]>([]);
  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly runningCount = computed(() => this.instances().filter(i => i.status === 'running').length);
  readonly stoppedCount = computed(() => this.instances().filter(i => i.status !== 'running').length);
  readonly totalTokensToday = computed(() =>
    this.instances().reduce((sum, i) => sum + (i.stats?.cpuPercent ?? 0), 0)
  );

  constructor() {
    // Wire SignalR status updates into signal state
    this.signalr.on<ContainerStats>('instances', 'StatusUpdate')
      .pipe(takeUntilDestroyed())
      .subscribe(stats => {
        this.instances.update(list =>
          list.map(i => i.id === stats.instanceId
            ? { ...i, status: stats.status as any, stats }
            : i
          )
        );
      });
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const list = await firstValueFrom(this.api.list());
      this.instances.set(list);
      // Start SignalR and subscribe to each running instance
      await this.signalr.start('instances');
      for (const inst of list.filter(i => i.status === 'running')) {
        await this.signalr.invoke('instances', 'SubscribeToInstance', inst.id);
      }
    } catch (e) {
      this.error.set((e as Error)?.message ?? 'Failed to load instances');
    } finally {
      this.loading.set(false);
    }
  }

  async start(id: string): Promise<void> {
    await this._action(id, 'starting', () => this.api.start(id));
    await this.signalr.invoke('instances', 'SubscribeToInstance', id);
    this.snack.open('Instance starting…', undefined, { duration: 2500 });
  }

  async stop(id: string): Promise<void> {
    await this._action(id, 'stopped', () => this.api.stop(id));
    this.snack.open('Instance stopped', undefined, { duration: 2500 });
  }

  async restart(id: string): Promise<void> {
    this._setStatus(id, 'starting');
    try {
      await firstValueFrom(this.api.restart(id));
      this.snack.open('Instance restarting…', undefined, { duration: 2500 });
    } catch (_e) {
      this._setStatus(id, 'error');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete(id));
      this.instances.update(list => list.filter(i => i.id !== id));
      this.snack.open('Instance deleted', undefined, { duration: 2500 });
      this.router.navigate(['/instances']);
    } catch (e) {
      this.snack.open((e as any)?.error?.detail ?? 'Delete failed', 'Dismiss', { duration: 4000 });
    }
  }

  private async _action(id: string, optimisticStatus: string, fn: () => any): Promise<void> {
    this._setStatus(id, optimisticStatus);
    try { await firstValueFrom(fn()); }
    catch (_e) { this._setStatus(id, 'error'); throw _e; }
  }

  private _setStatus(id: string, status: string): void {
    this.instances.update(list => list.map(i => i.id === id ? { ...i, status: status as any } : i));
  }
}
