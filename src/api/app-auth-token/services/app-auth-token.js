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
    },

    async getApiToken(appToken) {
        if(!(await this.doCheckStatus(appToken))) {
            return null;
        }

        // local api key:
        //return '363477aede2f66618998ccb1a3891b1cee16b50bd84aa474650a00ba1103352080984e3f0c7ac530ec22d2cb7c6fb91d6bf565f8fa926649e1901b89a69d611782f6b566f86d1b56165037bd656b818dcc2ef9c99ea4499567ccdc6181d6032016714cfd6e6dcb3b15d8edac1db4d695c5d6ef24b5ab4628dc9223407d5da125';
        
        // production api key:
        return 'e501ffc1b9020c5db876c2b032e5f7a2da18dca7e2c9204b54a35a2ba20207d425e82f4052ecaa0d15a128cd1f8fd13e45084ea5acc24d9b3b78dceac5dfe299ad25397720631b927c90153e592e0a5fa6cd7a3dcf4fccb7c01aabd4c70de16270c55b300822498bd6d74926d3bce3ca8042e4610e323b9e6c879f161c636267';
    }
  }));
