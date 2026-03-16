import { Routes } from '@angular/router';

export const modelRoutes: Routes = [
  { path: '', loadComponent: () => import('./token-dashboard/token-dashboard.component').then(m => m.TokenDashboardComponent) },
  { path: ':instanceId/rules', loadComponent: () => import('./switch-rules/switch-rules.component').then(m => m.SwitchRulesComponent) },
];
