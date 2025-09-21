module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/app-auth-token/checkIfTokenIsValid/:token', 
      handler: 'app-auth-token.checkIfTokenIsValid',
    },
    {
      method: 'POST',
      path: '/app-auth-token/tryAuthentication/:token', 
      handler: 'app-auth-token.tryAuthentication',
    },
    {
      method: 'GET',
      path: '/app-auth-token/checkAuthenticationStatus/:token', 
      handler: 'app-auth-token.checkAuthenticationStatus',
    }
  ]
}