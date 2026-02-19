import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  // Try to restore session from refresh cookie (page refresh scenario)
  return authService.tryRestoreSession().pipe(
    map((restored) => restored ? true : router.createUrlTree(['/login'])),
  );
};

export const managerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.hasRole('manager')) {
    return true;
  }
  return router.createUrlTree(['/']);
};

export const engineerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.hasRole('engineer')) {
    return true;
  }
  return router.createUrlTree(['/']);
};

export const clientGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.hasRole('client')) {
    return true;
  }
  return router.createUrlTree(['/']);
};

export const superadminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.hasRole('superadmin')) {
    return true;
  }
  return router.createUrlTree(['/']);
};
