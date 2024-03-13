'use strict';

/**
 * turnus service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::turnus.turnus', ({ strapi }) => ({
    async find(...args) {  
        // Calling the default core controller
        const { results, pagination } = await super.find(...args);

        results.sort((a, b) => (b.year + b.month / 12) - (a.year + a.month / 12));

        results.forEach(turnus => {
            strapi.log.debug('year: ' + turnus.year + ' month: ' + turnus.month + ', updated: ' + turnus.updatedAt);
        });

        return { results, pagination };
    }
}));
