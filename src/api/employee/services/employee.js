'use strict';


/**
 * employee service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::employee.employee', ({ strapi }) =>  ({
    async findOne(entityId, params = {}) {  
      // Calling the default core controller
        const result = await super.findOne(entityId, params);
  
        // strapi.log.debug(JSON.stringify(strapi.config));

        const name = await strapi.config['nrk'].getNameById(entityId);
        strapi.log.debug('NRK emp name: ' + name);

        return result;
    }
  }));
