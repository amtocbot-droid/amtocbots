import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#94a3b8">Authenticating…</div>`,
})
export class AuthCallbackComponent implements OnInit {
  private readonly oidc   = inject(OidcSecurityService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.oidc.checkAuth().subscribe(({ isAuthenticated }) => {
      this.router.navigateByUrl(isAuthenticated ? '/' : '/');
    });
  }
}
