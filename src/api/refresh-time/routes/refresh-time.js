'use strict';

/**
 * refresh-time router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::refresh-time.refresh-time');
