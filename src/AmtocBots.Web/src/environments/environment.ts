export const environment = {
  production: false,
  apiBase: '/api',
  hubBase: '/hubs',
  keycloak: {
    authority: 'http://localhost:8180/realms/amtocbots',
    clientId: 'amtocbots-web',
    redirectUri: 'http://localhost:4200/callback',
    postLogoutRedirectUri: 'http://localhost:4200',
    scope: 'openid profile email roles',
  },
};
