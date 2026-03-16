export const environment = {
  production: true,
  apiBase: '/api',
  hubBase: '/hubs',
  keycloak: {
    authority: 'https://auth.amtocbot.com/realms/amtocbots',
    clientId: 'amtocbots-web',
    redirectUri: 'https://manager.amtocbot.com/callback',
    postLogoutRedirectUri: 'https://manager.amtocbot.com',
    scope: 'openid profile email roles offline_access',
  },
};
