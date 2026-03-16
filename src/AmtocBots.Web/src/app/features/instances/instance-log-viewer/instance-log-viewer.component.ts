import { Component, ElementRef, OnDestroy, ViewChild, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-instance-log-viewer',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatSelectModule, FormsModule],
  template: `
    <div class="log-toolbar">
      <mat-select [(ngModel)]="tailLines" class="tail-select">
        <mat-option [value]="50">Last 50 lines</mat-option>
        <mat-option [value]="200">Last 200 lines</mat-option>
        <mat-option [value]="500">Last 500 lines</mat-option>
      </mat-select>
      <button mat-stroked-button (click)="fetch()" [disabled]="fetching()">
        <mat-icon>refresh</mat-icon> Refresh
      </button>
      <button mat-icon-button (click)="scrollToBottom()" matTooltip="Scroll to bottom">
        <mat-icon>vertical_align_bottom</mat-icon>
      </button>
      <button mat-icon-button (click)="clear()" matTooltip="Clear">
        <mat-icon>clear_all</mat-icon>
      </button>
    </div>

    @if (!isRunning()) {
      <div class="not-running">Instance is not running. Start it to view logs.</div>
    } @else {
      <div #logContainer class="log-pane">
        <pre class="log-text">{{ logText() }}</pre>
      </div>
    }
  `,
  styles: [`
    .log-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .tail-select { width: 160px; }
    .log-pane    { height: 480px; overflow-y: auto; background: #0d1117;
      border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; }
    .log-text    { margin: 0; font-size: 12px; line-height: 1.6; color: #c9d1d9;
      font-family: 'Menlo','Monaco','Consolas',monospace; white-space: pre-wrap; word-break: break-all; }
    .not-running { color: var(--text-secondary); font-size: 13px; padding: 24px 0; }
  `],
})
export class InstanceLogViewerComponent implements OnDestroy {
  @ViewChild('logContainer') logContainer?: ElementRef<HTMLDivElement>;

  readonly instanceId = input.required<string>();
  readonly isRunning  = input.required<boolean>();

  private readonly http = inject(HttpClient);

  readonly logText  = signal('');
  readonly fetching = signal(false);
  tailLines = 200;

  private autoRefreshInterval?: ReturnType<typeof setInterval>;

  constructor() {
    // Auto-fetch when running state changes to true
    effect(() => {
      if (this.isRunning()) {
        this.fetch();
        this.autoRefreshInterval = setInterval(() => this.fetch(), 10_000);
      } else {
        clearInterval(this.autoRefreshInterval);
      }
    });
  }

  async fetch() {
    if (!this.isRunning()) return;
    this.fetching.set(true);
    try {
      const text = await firstValueFrom(
        this.http.get(`${environment.apiBase}/instances/${this.instanceId()}/logs?tail=${this.tailLines}`, { responseType: 'text' })
      );
      this.logText.set(text);
      setTimeout(() => this.scrollToBottom(), 50);
    } finally {
      this.fetching.set(false);
    }
  }

  clear()           { this.logText.set(''); }
  scrollToBottom()  { this.logContainer?.nativeElement.scrollTo({ top: 99999, behavior: 'smooth' }); }
  ngOnDestroy()     { clearInterval(this.autoRefreshInterval); }
}
