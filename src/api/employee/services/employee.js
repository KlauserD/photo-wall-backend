'use strict';


/**
 * employee service
 */

const { createCoreService } = require('@strapi/strapi').factories;
const axios = require('axios').default;

function removeUmlauts(str) {
  return str.replace('/\u00dc/g', 'Ue')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00c4/g, 'Ae')
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00d6/g, 'Oe')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00df/g, 'ss')
}

async function updatePicture(employee, fileBlob, filename) {
  // delete if api image is present
  if(employee.picture?.name == filename) {
    await axios.delete(
      'http://127.0.0.1:1337/api/upload/files/' + employee.picture.id,
      {
        headers: {
          "Authorization": 'Bearer ' + strapi.config['api'].uploadToken
        }
      }
    );
  }

  const form = new FormData();
  form.append('files', fileBlob, filename);
  form.append('ref', 'api::employee.employee');
  form.append('refId', employee.id); //employee.id);
  form.append('field', 'picture');

  try {
    await axios.post(
      'http://127.0.0.1:1337/api/upload', 
      form,
      {
        headers: {
          "Authorization": 'Bearer ' + strapi.config['api'].uploadToken,
          "Content-Type": 'multipart/form-data'
        }
      });

  } catch(e) {
    strapi.log.error('upload fetch error: ' + e);
  }
}

module.exports = createCoreService('api::employee.employee', ({ strapi }) =>  ({
    async findOne(entityId, params = {}) {  
      // Calling the default core controller
      let strapiEmployee = await super.findOne(entityId, params);

      if(strapiEmployee.mnr == null || strapiEmployee.mnr < 0) {
        strapi.log.debug('No MNR has been set for ' + strapiEmployee.name + '. No data fetching possible.');
      } else if(strapiEmployee.name == null ||  
        strapiEmployee.name == '' || 
        (new Date() - new Date(strapiEmployee.updatedAt)) / 36e5 > 0.01 // last updated longer than 12h ago
      ) { 
        strapi.log.debug('Trying to update employee: ' + strapiEmployee.mnr);
        
        const nrkEmp = await strapi.config['nrk'].getEmployeeByMnr(strapiEmployee.mnr);

        if(strapiEmployee.mnr == 65856) {
          const duties = await strapi.config['nrk'].getNextEmployeeDuties(strapiEmployee.mnr);
        }

        if(nrkEmp != null) {
          await super.update(strapiEmployee.id, {
            data: {
              name: nrkEmp.name,
            },
          });

          const pictureBlob = await strapi.config['nrk'].getPictureByMnr(strapiEmployee.mnr);

          if(pictureBlob != null) {
            await updatePicture(
              strapiEmployee,
              pictureBlob,
              'api_' + removeUmlauts(nrkEmp.name) + "." + pictureBlob.type.split('/')[1]
            );
          }

          strapiEmployee = await super.findOne(entityId, params);
        }
      }

      return strapiEmployee;
    }


  }));
