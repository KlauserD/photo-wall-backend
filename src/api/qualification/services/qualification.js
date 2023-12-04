'use strict';

/**
 * qualification service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::qualification.qualification');
