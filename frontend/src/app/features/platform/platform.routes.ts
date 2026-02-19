import { Routes } from '@angular/router';

export const PLATFORM_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'organizations',
    pathMatch: 'full',
  },
  {
    path: 'organizations',
    loadComponent: () => import('./components/organization-list/organization-list.component').then(m => m.OrganizationListComponent),
  },
  {
    path: 'organizations/:id',
    loadComponent: () => import('./components/organization-detail/organization-detail.component').then(m => m.OrganizationDetailComponent),
  },
];
