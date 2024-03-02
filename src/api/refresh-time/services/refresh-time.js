'use strict';

/**
 * refresh-time service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::refresh-time.refresh-time');
