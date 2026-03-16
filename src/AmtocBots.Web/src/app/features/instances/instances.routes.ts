import { Routes } from '@angular/router';

export const instanceRoutes: Routes = [
  { path: '', loadComponent: () => import('./instance-list/instance-list.component').then(m => m.InstanceListComponent) },
  { path: ':id', loadComponent: () => import('./instance-detail/instance-detail.component').then(m => m.InstanceDetailComponent) },
  { path: 'new', loadComponent: () => import('./instance-form/instance-form.component').then(m => m.InstanceFormComponent) },
];
