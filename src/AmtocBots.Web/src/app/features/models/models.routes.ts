import { Routes } from '@angular/router';

export const modelRoutes: Routes = [
  { path: '', loadComponent: () => import('./token-dashboard/token-dashboard.component').then(m => m.TokenDashboardComponent) },
];
