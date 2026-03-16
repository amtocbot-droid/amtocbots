import { Routes } from '@angular/router';

export const ollamaRoutes: Routes = [
  { path: '', loadComponent: () => import('./ollama-dashboard/ollama-dashboard.component').then(m => m.OllamaDashboardComponent) },
];
