'use strict';

/**
 * app-auth-token service
 */

const { createCoreService } = require('@strapi/strapi').factories;
const bcrypt = require('bcryptjs');

module.exports = createCoreService('api::app-auth-token.app-auth-token', ({ strapi }) =>  ({
    async createByToken(token) {
        return await strapi.service('api::app-auth-token.app-auth-token').create({
            data: {
                token: token,
                auth_start_time: new Date(),
                password: ""
            }
        });
    },

    async findByToken(token) {
        const existingEntries = (await strapi.service('api::app-auth-token.app-auth-token').find({
            filters: { token: token }
        })).results;

        // strapi.log.debug('filter res: ' + JSON.stringify(existingEntries));

        if(existingEntries.length == 0) {
            return null;
        } else {
            return existingEntries[0];
        }
    },

    async checkIfTokenIsValid(token) {
        return (await this.findByToken(token)) != null;
    },

    async tryAuthentication(token, password) {
        const entry = await this.findByToken(token);

        let success = false;

        if(entry != null && !(await this.checkAuthenticationStatus(token))) {
            // const mainPw = (await strapi.service('api::app-auth-password.app-auth-password').find()).password;
            
            // success = mainPw === password;

            strapi.log.debug(JSON.stringify(entry));

            if((new Date() - new Date(entry.updatedAt)) / 1000 < 15) { // 15s cooldown after last password try
                return null;
            } else {
                await strapi.service('api::app-auth-token.app-auth-token').update(entry.id, {
                    data: { password: password }
                });

                return await this.checkAuthenticationStatus(token);
            }
        }
    },

    async doCheckStatus(token) {
        let entry = await this.findByToken(token);

        if(entry == null) {
            entry = await this.createByToken(token);
            return false;
        }

        const mainPw = (await strapi.service('api::app-auth-password.app-auth-password').find()).password;

        return await bcrypt.compare(mainPw, entry.password);
    },

    async deleteOldAuthenticationEntries() {
        const entries = (await strapi.service('api::app-auth-token.app-auth-token').find()).results;
            
        for (const e of entries) {
            if(!(await this.doCheckStatus(e.token)) && (new Date() - new Date(e.auth_start_time)) / 36e5 > 0.17 ) { // delete after 10 minutes
                await strapi.service('api::app-auth-token.app-auth-token').delete(e.id);
            }
        }
    },

    async checkAuthenticationStatus(token) { //wrapper method to be able to manage old entries without recursion
        await this.deleteOldAuthenticationEntries();

        return await this.doCheckStatus(token);
    }
  }));
