import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Skip notification for 401 (handled by JWT interceptor) and auth endpoints
      if (error.status === 401 || req.url.includes('/auth/')) {
        return throwError(() => error);
      }

      let message = 'An unexpected error occurred';
      if (error.error?.detail) {
        message = error.error.detail;
      } else if (error.status === 0) {
        message = 'Unable to connect to the server';
      } else if (error.status === 403) {
        message = 'Access denied';
      } else if (error.status === 404) {
        message = 'Resource not found';
      } else if (error.status >= 500) {
        message = 'Server error. Please try again later.';
      }

      snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });

      return throwError(() => error);
    }),
  );
};
