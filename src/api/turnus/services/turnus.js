'use strict';

/**
 * turnus service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::turnus.turnus');
