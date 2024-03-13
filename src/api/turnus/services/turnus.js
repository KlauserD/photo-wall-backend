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

        /* 
            {
                "2024/1": [ ... ],
                "2023/10": [ ... ],
                "2023/7": [ ... ]
            }
        
        */

        let result = {};

        if((new Date() - new Date(latestTurnus.updatedAt)) / 36e5 > 0) { // last updated longer than 12h ago
            const memberMnrs = await strapi.config['nrk'].getFilterMembers(30287);

            await Promise.all(
                memberMnrs.map(async mnr => {
                    const nrkEmp = await strapi.config['nrk'].getEmployeeByMnr(mnr);

                    strapi.log.debug('nrkEmp: ' + JSON.stringify(nrkEmp));

                    // const beginDateSplitted = nrkEmp.beginDateString.split('.'); // "02.01.2024"
                    // const selector = beginDateSplitted[2] + '/' + beginDateSplitted[1]; // 2024/1

                    // if(result[selector] == null) result[selector] = [];
                    // result[selector].push(nrkEmp);
                })
            );

            strapi.log.debug(JSON.stringify(result));

        }

        strapi.log.debug('lastet turnus: ' + latestTurnus.year + '/' + latestTurnus.month);

        return { results, pagination };
    }
}));
