import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { switchMap, take } from 'rxjs';

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const oidc = inject(OidcSecurityService);

  return oidc.getAccessToken().pipe(
    take(1),
    switchMap(token => {
      if (token && (req.url.startsWith('/api') || req.url.startsWith('/hubs'))) {
        req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
      }
      return next(req);
    })
  );
};
