'use strict';

/**
 * turnus service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::turnus.turnus', ({ strapi }) => ({
    async find(...args) {  
        // Calling the default core controller
        const { results, pagination } = await super.find(...args);

        results.forEach(turnus => {
            strapi.log.debug(JSON.stringify(turnus));
        });

        return { results, pagination };
    }
}));
