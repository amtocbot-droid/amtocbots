import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

interface NavItem { label: string; icon: string; path: string; }

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatListModule, MatIconModule],
  template: `
    <div class="sidebar-header">
      <span class="sidebar-logo">AmtocBots</span>
    </div>
    <mat-nav-list>
      @for (item of navItems; track item.path) {
        <a mat-list-item [routerLink]="item.path" routerLinkActive="active">
          <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
          <span matListItemTitle>{{ item.label }}</span>
        </a>
      }
    </mat-nav-list>
  `,
  styles: [`
    .sidebar-header { padding: 20px 16px 12px; border-bottom: 1px solid var(--border); }
    .sidebar-logo { font-size: 16px; font-weight: 700; color: var(--accent-blue); }
    .active { background: rgba(59,130,246,0.12) !important; color: var(--accent-blue) !important; }
  `],
})
export class SidebarComponent {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard',  icon: 'dashboard',    path: '/dashboard' },
    { label: 'Instances',  icon: 'smart_toy',    path: '/instances' },
    { label: 'Models',     icon: 'auto_awesome', path: '/models' },
    { label: 'Kanban',     icon: 'view_kanban',  path: '/kanban' },
    { label: 'Chat',       icon: 'chat',         path: '/chat' },
  ];
}
