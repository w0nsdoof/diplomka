import { Routes } from '@angular/router';

export const PORTAL_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./components/ticket-list/ticket-list.component').then(m => m.TicketListComponent) },
  { path: ':id', loadComponent: () => import('./components/ticket-detail/ticket-detail.component').then(m => m.TicketDetailComponent) },
];
