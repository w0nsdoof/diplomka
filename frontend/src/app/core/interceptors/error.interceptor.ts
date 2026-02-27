import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const translate = inject(TranslateService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Skip notification for 401 (handled by JWT interceptor) and auth endpoints
      if (error.status === 401 || req.url.includes('/auth/')) {
        return throwError(() => error);
      }

      let message = translate.instant('errors.unexpected');
      if (error.error?.detail) {
        const backendKey = `backendErrors.${error.error.detail}`;
        const translated = translate.instant(backendKey);
        message = translated !== backendKey ? translated : error.error.detail;
      } else if (error.error?.errors && typeof error.error.errors === 'object') {
        const msgs: string[] = [];
        for (const [, val] of Object.entries(error.error.errors)) {
          if (Array.isArray(val)) {
            msgs.push(...val);
          } else if (typeof val === 'string') {
            msgs.push(val);
          }
        }
        if (msgs.length) {
          message = msgs.join(' ');
        }
      } else if (error.status === 0) {
        message = translate.instant('errors.connectionFailed');
      } else if (error.status === 403) {
        message = translate.instant('errors.accessDenied');
      } else if (error.status === 404) {
        message = translate.instant('errors.notFound');
      } else if (error.status >= 500) {
        message = translate.instant('errors.serverError');
      }

      snackBar.open(message, translate.instant('common.close'), { duration: 5000, panelClass: 'error-snackbar' });

      return throwError(() => error);
    }),
  );
};
