import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { ShellComponent } from './core/layout/shell.component';

export const appRoutes: Routes = [
  {
    path: 'callback',
    loadComponent: () => import('./core/auth/auth-callback.component').then(m => m.AuthCallbackComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.dashboardRoutes),
      },
      {
        path: 'instances',
        loadChildren: () => import('./features/instances/instances.routes').then(m => m.instanceRoutes),
      },
      {
        path: 'models',
        loadChildren: () => import('./features/models/models.routes').then(m => m.modelRoutes),
      },
      {
        path: 'kanban',
        loadChildren: () => import('./features/kanban/kanban.routes').then(m => m.kanbanRoutes),
      },
      {
        path: 'chat',
        loadChildren: () => import('./features/chat/chat.routes').then(m => m.chatRoutes),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
