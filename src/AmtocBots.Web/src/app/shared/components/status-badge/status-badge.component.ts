import { Component, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="badge badge--{{ status() }}">{{ status() }}</span>`,
  styles: [`
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 999px;
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .badge--running  { background: rgba(16,185,129,.15); color: #10b981; }
    .badge--stopped  { background: rgba(148,163,184,.12); color: #94a3b8; }
    .badge--starting { background: rgba(245,158,11,.15); color: #f59e0b; }
    .badge--error    { background: rgba(239,68,68,.15); color: #ef4444; }
  `],
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
}
