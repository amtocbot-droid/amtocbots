import { Routes } from '@angular/router';

export const chatRoutes: Routes = [
  { path: '', loadComponent: () => import('./chat-shell/chat-shell.component').then(m => m.ChatShellComponent) },
];
