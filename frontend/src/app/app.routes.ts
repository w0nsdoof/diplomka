import { Routes } from '@angular/router';
import { authGuard, managerGuard, clientGuard, superadminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./core/components/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    loadComponent: () => import('./core/components/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'tasks', pathMatch: 'full' },
      {
        path: 'tasks',
        loadChildren: () => import('./features/tasks/tasks.routes').then(m => m.TASKS_ROUTES),
      },
      {
        path: 'kanban',
        loadChildren: () => import('./features/tasks/tasks.routes').then(m => m.KANBAN_ROUTES),
      },
      {
        path: 'clients',
        canActivate: [managerGuard],
        loadChildren: () => import('./features/clients/clients.routes').then(m => m.CLIENTS_ROUTES),
      },
      {
        path: 'calendar',
        canActivate: [managerGuard],
        loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent),
      },
      {
        path: 'reports',
        canActivate: [managerGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent),
          },
          {
            path: 'summaries',
            loadComponent: () => import('./features/reports/summary-list/summary-list.component').then(m => m.SummaryListComponent),
          },
          {
            path: 'summaries/:id',
            loadComponent: () => import('./features/reports/summary-detail/summary-detail.component').then(m => m.SummaryDetailComponent),
          },
        ],
      },
      {
        path: 'admin/users',
        canActivate: [managerGuard],
        loadComponent: () => import('./features/admin/user-management.component').then(m => m.UserManagementComponent),
      },
      {
        path: 'portal',
        canActivate: [clientGuard],
        loadChildren: () => import('./features/portal/portal.routes').then(m => m.PORTAL_ROUTES),
      },
      {
        path: 'platform',
        canActivate: [superadminGuard],
        loadChildren: () => import('./features/platform/platform.routes').then(m => m.PLATFORM_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
