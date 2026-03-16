import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { OidcSecurityService } from 'angular-auth-oidc-client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly oidc = inject(OidcSecurityService);

  readonly isAuthenticated = toSignal(
    this.oidc.isAuthenticated$.pipe(map(({ isAuthenticated }) => isAuthenticated)),
    { initialValue: false }
  );

  readonly userData = toSignal(
    this.oidc.userData$.pipe(map(({ userData }) => userData)),
    { initialValue: null }
  );

  readonly accessToken = toSignal(this.oidc.getAccessToken());

  readonly roles = computed<string[]>(() => {
    const ud = this.userData();
    return ud?.realm_access?.roles ?? [];
  });

  readonly userId     = computed<string>(() => this.userData()?.sub ?? '');
  readonly username   = computed<string>(() => this.userData()?.preferred_username ?? '');
  readonly isAdmin    = computed(() => this.roles().includes('admin'));
  readonly isOperator = computed(() => this.roles().includes('admin') || this.roles().includes('operator'));

  login()  { this.oidc.authorize(); }
  logout() { this.oidc.logoff().subscribe(); }

  getToken(): string { return this.accessToken() ?? ''; }

}

import { map } from 'rxjs';
