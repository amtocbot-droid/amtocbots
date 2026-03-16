import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { provideAuth, LogLevel } from 'angular-auth-oidc-client';
import { appRoutes } from './app.routes';
import { authTokenInterceptor } from './core/auth/auth-token.interceptor';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withInterceptors([authTokenInterceptor])),
    provideAnimationsAsync(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAuth({
      config: {
        authority: environment.keycloak.authority,
        redirectUrl: environment.keycloak.redirectUri,
        postLogoutRedirectUri: environment.keycloak.postLogoutRedirectUri,
        clientId: environment.keycloak.clientId,
        scope: environment.keycloak.scope,
        responseType: 'code',
        silentRenew: true,
        useRefreshToken: true,
        logLevel: environment.production ? LogLevel.Warn : LogLevel.Debug,
        secureRoutes: [environment.apiBase, environment.hubBase],
      },
    }),
  ],
};
