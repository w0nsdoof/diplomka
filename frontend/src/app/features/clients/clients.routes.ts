import { Routes } from '@angular/router';

export const CLIENTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./components/client-list/client-list.component').then(m => m.ClientListComponent) },
  { path: 'new', loadComponent: () => import('./components/client-form/client-form.component').then(m => m.ClientFormComponent) },
  { path: ':id', loadComponent: () => import('./components/client-detail/client-detail.component').then(m => m.ClientDetailComponent) },
  { path: ':id/edit', loadComponent: () => import('./components/client-form/client-form.component').then(m => m.ClientFormComponent) },
];
