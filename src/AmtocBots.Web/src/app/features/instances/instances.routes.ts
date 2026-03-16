import { Routes } from '@angular/router';
import { operatorGuard } from '../../core/auth/role.guard';

export const instanceRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./instance-list/instance-list.component').then(m => m.InstanceListComponent),
  },
  {
    path: 'new',
    canActivate: [operatorGuard],
    loadComponent: () => import('./instance-form/instance-form.component').then(m => m.InstanceFormComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./instance-detail/instance-detail.component').then(m => m.InstanceDetailComponent),
  },
];
