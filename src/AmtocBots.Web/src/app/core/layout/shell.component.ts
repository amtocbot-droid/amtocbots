import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { SignalrService } from '../signalr/signalr.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, MatSidenavModule, MatToolbarModule, SidebarComponent, TopbarComponent, CommonModule],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav #sidenav mode="side" [opened]="sidebarOpen()" class="shell__sidebar">
        <app-sidebar />
      </mat-sidenav>
      <mat-sidenav-content class="shell__content">
        <app-topbar (menuToggle)="sidebarOpen.set(!sidebarOpen())" />
        @if (signalr.reconnecting()) {
          <div class="reconnect-banner">Reconnecting to server…</div>
        }
        <main class="shell__main">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .shell { height: 100vh; }
    .shell__sidebar { width: 240px; background: var(--bg-surface); border-right: 1px solid var(--border); }
    .shell__content { display: flex; flex-direction: column; }
    .shell__main { flex: 1; overflow: auto; padding: 24px; }
    .reconnect-banner {
      background: var(--accent-amber); color: #000; text-align: center;
      padding: 6px; font-size: 12px; font-weight: 600;
    }
  `],
})
export class ShellComponent {
  readonly signalr    = inject(SignalrService);
  readonly sidebarOpen = signal(true);
}
