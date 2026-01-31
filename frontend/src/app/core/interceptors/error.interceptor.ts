import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'An unexpected error occurred';
      if (error.error?.detail) {
        message = error.error.detail;
      } else if (error.status === 0) {
        message = 'Unable to connect to the server';
      } else if (error.status === 403) {
        message = 'Access denied';
      } else if (error.status === 404) {
        message = 'Resource not found';
      }
      console.error(`HTTP Error ${error.status}: ${message}`);
      return throwError(() => error);
    }),
  );
};
