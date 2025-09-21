'use strict';

/**
 * app-auth-token controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::app-auth-token.app-auth-token',
  ({ strapi }) => ({
    async checkIfTokenIsValid(ctx) {
        // strapi.log.debug('findByToken controller: ' + JSON.stringify(ctx));
        ctx.body = await strapi.service('api::app-auth-token.app-auth-token').checkIfTokenIsValid(ctx.request.params.token)
    },
    async tryAuthentication(ctx) {
        ctx.body = await strapi.service('api::app-auth-token.app-auth-token').tryAuthentication(ctx.request.params.token, ctx.request.body.pw);
    },
    async checkAuthenticationStatus(ctx) {
        ctx.body = await strapi.service('api::app-auth-token.app-auth-token').checkAuthenticationStatus(ctx.request.params.token)
    }
  }));
