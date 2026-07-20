import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionStateService } from '../state/session-state.service';

import { environment } from '../../../environments/environment';

/**
 * Attaches the JWT (if present) to backend API requests and redirects to
 * login on a 401 response from the application backend (expired/invalid token).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionState = inject(SessionStateService);
  const router = inject(Router);
  const token = sessionState.getToken();

  // Only attach JWT and handle 401 for application backend requests
  const isBackendReq = req.url.startsWith(environment.apiBaseUrl) ||
                        req.url.startsWith('http://localhost:8080') ||
                        req.url.startsWith('/api/');

  const authorizedReq = (token && isBackendReq)
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isBackendReq && !req.url.includes('/auth/')) {
        sessionState.clearSession();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
