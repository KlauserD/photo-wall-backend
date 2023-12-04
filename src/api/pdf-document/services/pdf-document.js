'use strict';

/**
 * pdf-document service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::pdf-document.pdf-document');
