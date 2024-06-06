'use strict';

/**
 * volunteer-realm service
 */

const { createCoreService } = require('@strapi/strapi').factories;
const axios = require('axios').default;

const declaredRealms = [
  {
    name: 'RKT',
    activityAreas: ['KTW1', 'RTW1'],
    volunteers: []
  },
  {
    name: 'EAR',
    activityAreas: ['ZE/ER'],
    volunteers: []
  },
  {
    name: 'TÖT',
    activityAreas: ['TÖT'],
    volunteers: []
  }
];

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
    form.append('ref', 'api::volunteer.volunteer');
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

async function createOrUpdateVolunteer(nrkEmp, strapiInstance) {
    const volunteerQueryResult = (await strapiInstance.service('api::volunteer.volunteer').find({
        filters: {
            mnr: nrkEmp.mnr
        },
        populate: '*'
    })).results;

    let strapiVolunteer = volunteerQueryResult.length > 0 ? volunteerQueryResult[0] : null;

    const volunteerData = {
        mnr: nrkEmp.mnr,
        name: nrkEmp.name,
        qualification: nrkEmp.qualification
    }

    if(strapiVolunteer == null) {
        strapiVolunteer = await strapiInstance.service('api::volunteer.volunteer').create({
            data: volunteerData,
            populate: '*'
        });
    } else {
        await strapiInstance.service('api::volunteer.volunteer').update(strapiVolunteer.id, {
            data: volunteerData,
          });
    }

    return strapiVolunteer;
}

async function createOrUpdateRealm(realm, volunteerIds, strapiInstance) {
  const volunteerRealmQueryResult = (await strapiInstance.service('api::volunteer-realm.volunteer-realm').find({
      filters: {
          name: realm.name
      },
      populate: '*'
  })).results;

  let strapiRealm = volunteerRealmQueryResult.length > 0 ? volunteerRealmQueryResult[0] : null;

  const realmData = {
      name: realm.name,
      volunteers: volunteerIds
  }

  if(strapiRealm == null) {
    strapiRealm = await strapiInstance.service('api::volunteer-realm.volunteer-realm').create({
          data: realmData,
          populate: '*'
      });
  } else {
      await strapiInstance.service('api::volunteer-realm.volunteer-realm').update(strapiRealm.id, {
          data: realmData,
          populate: '*'
        });
  }

  return strapiRealm;
}

module.exports = createCoreService('api::volunteer-realm.volunteer-realm', ({ strapi }) => ({
    async find(...args) {  
        // Calling the default core controller
        const { results: strapiRealms, pagination } = await super.find(...args);

        let latestRealm;
        strapiRealms.forEach(realm => {
            if(latestRealm == null || (new Date(realm.updatedAt) > new Date(latestRealm.updatedAt))) {
                latestRealm = realm;
            }
        });

        // const allEmps = await strapi.config['nrk'].getAllEmployees();
              
        // const allVolunteers = allEmps.filter(emp => emp.statusCode == 'E');

        if(latestRealm == null ||
            (new Date() - new Date(latestRealm.updatedAt)) / 36e5 > 12 ) { // last updated longer than 12h ago

            let allVolunteers = (await strapi.config['nrk'].getAllEmployees()).filter(emp => emp.statusCode == 'E');

            await Promise.all(
              allVolunteers.map(async volunteer => {
                const activityAreas = await strapi.config['nrk'].getEmployeeActivityAreaByMnr(volunteer.mnr);

                volunteer.activityAreas = activityAreas == null ? [] : activityAreas.filter(area => area.aktiv == 1)
              })
            );

            declaredRealms.forEach(realm => {
              allVolunteers.forEach(volunteer => {
                if(volunteer.activityAreas.some(volunteerArea => realm.activityAreas.includes(volunteerArea['TB_ID']))) {
                  realm.volunteers.push(volunteer);
                }
              });
            });

            let distinctVolunteers = [];
            declaredRealms.forEach(realm => distinctVolunteers.push(...realm.volunteers));
            strapi.log.debug('length before distinct: ' + distinctVolunteers.length);
            distinctVolunteers = distinctVolunteers.filter((item, index) => distinctVolunteers.indexOf(item) === index);
            strapi.log.debug('length after distinct: ' + distinctVolunteers.length);

            // add all volunteers to strapi DB
            distinctVolunteers.map(async nrkVolunteer => {
              nrkVolunteer.qualification = await strapi.config['nrk'].getEmployeeQualificationByMnr(nrkVolunteer.mnr)

              const strapiVolunteer = await createOrUpdateVolunteer(nrkVolunteer, strapi);
              nrkVolunteer.strapiId = strapiVolunteer.id;

              const pictureBlob = await strapi.config['nrk'].getPictureByMnr(strapiVolunteer.mnr);
              if(pictureBlob != null) {
                  await updatePicture(
                    strapiVolunteer,
                    pictureBlob,
                    'api_' + removeUmlauts(nrkVolunteer.name) + "." + pictureBlob.type.split('/')[1]
                  );
              }
            });

            // add realms to strapi DB and relate to volunteers
            declaredRealms.map(async realm => {
              await createOrUpdateRealm(realm, realm.volunteers.map(volunteer => volunteer.strapiId), strapi);
            })
          }
        //strapi.log.debug('volunteers: ' + JSON.stringify(allVolunteers));
      //  if(latestRealm == null ||
      //       (new Date() - new Date(latestRealm.updatedAt)) / 36e5 > 12 ) { // last updated longer than 12h ago
            
      //       realmFilterIds.forEach(async realmFilterId => {
      //           const memberMnrs = await strapi.config['nrk'].getFilterMembers(realmFilterId);
                
      //           if(memberMnrs != null) {
      //               await Promise.all(
      //                   memberMnrs.map(async mnr => {
      //                       const nrkEmp = await strapi.config['nrk'].getEmployeeByMnr(mnr);

      //                       if(nrkEmp != null) {
      //                           const strapiVolunteer = await createOrUpdateVolunteer(nrkEmp, strapi);

      //                           const pictureBlob = await strapi.config['nrk'].getPictureByMnr(strapiVolunteer.mnr);
      //                           if(pictureBlob != null) {
      //                               await updatePicture(
      //                                 strapiVolunteer,
      //                                 pictureBlob,
      //                                 'api_' + removeUmlauts(nrkEmp.name) + "." + pictureBlob.type.split('/')[1]
      //                               );
      //                           }

      //                           await strapi.config['nrk'].getEmployeeQualificationByMnr(strapiVolunteer.mnr);
      //                       }
      //                   })
      //               )
      //           }
      //       });
      //   }

        return await super.find(...args);
    }
}));
