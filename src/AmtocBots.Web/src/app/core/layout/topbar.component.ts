import { Component, EventEmitter, Output, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [MatToolbarModule, MatIconButton, MatIconModule, MatMenuModule],
  template: `
    <mat-toolbar class="topbar">
      <button mat-icon-button (click)="menuToggle.emit()">
        <mat-icon>menu</mat-icon>
      </button>
      <span class="spacer"></span>
      <span class="topbar__user">{{ auth.userData()?.preferred_username }}</span>
      <button mat-icon-button [matMenuTriggerFor]="userMenu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #userMenu>
        <button mat-menu-item (click)="auth.logout()">
          <mat-icon>logout</mat-icon> Sign out
        </button>
      </mat-menu>
    </mat-toolbar>
  `,
  styles: [`
    .topbar { background: var(--bg-surface); border-bottom: 1px solid var(--border); height: 56px; }
    .spacer { flex: 1; }
    .topbar__user { font-size: 13px; color: var(--text-secondary); margin-right: 8px; }
  `],
})
export class TopbarComponent {
  @Output() menuToggle = new EventEmitter<void>();
  readonly auth = inject(AuthService);
}
