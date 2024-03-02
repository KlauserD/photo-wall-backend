'use strict';


/**
 * employee service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::employee.employee', ({ strapi }) =>  ({
    async findOne(entityId, params = {}) {  
      // Calling the default core controller
        const employee = await super.findOne(entityId, params);
  
        strapi.log.debug(JSON.stringify(employee));

        if(employee.mnr == null) {
          strapi.log.debug('No MNR has been set for ' + employee.name + '. No data fetching possible.');
        } else {
          const empName = await strapi.config['nrk'].getNameById(employee.mnr);
          strapi.log.debug('NRK emp name: ' + empName);
          
          if(empName != null) {
            super.update(employee.id, {
              data: {
                name: empName,
              },
            });

            const imgBase64 = await strapi.config['nrk'].getPictureById(employee.mnr);
            strapi.log.debug('base64 string: ' + imgBase64);

            if(imgBase64 != null) {
              const file = DataURIToBlob(imgBase64);
              const form = new FormData();
              form.append('files', file, empName + ".png");
              form.append('ref', 'api::employee.employee');
              form.append('refId', employee.id);
              form.append('field', 'picture');

              await fetch('/api/upload', {
                method: 'post',
                body: form
              });
            }
          }
        }

        return employee;
    }
  }));
