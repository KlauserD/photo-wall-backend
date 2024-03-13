'use strict';

/**
 * turnus service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::turnus.turnus', ({ strapi }) => ({
    async find(...args) {  
        // Calling the default core controller
        const { results, pagination } = await super.find(...args);

        let latestTurnus;
        results.forEach(turnus => {
            if(latestTurnus == null || (turnus.year >= latestTurnus.year && turnus.month > latestTurnus.month)) {
                latestTurnus = turnus;
            }
        });

        strapi.log.debug('lastet turnus: ' + latestTurnus.year + '/' + latestTurnus.month);

        return { results, pagination };
    }
}));
