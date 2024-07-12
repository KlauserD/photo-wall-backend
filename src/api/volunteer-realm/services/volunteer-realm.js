'use strict';

/**
 * volunteer-realm service
 */

const { createCoreService } = require('@strapi/strapi').factories;
const axios = require('axios').default;

const declaredRealms = [
  {
    name: 'RKT',
    activityAreas: ['KTW1', 'RTW1']
  },
  {
    name: 'EAR',
    activityAreas: ['ZE/ER']
  },
  {
    name: 'TÖT',
    activityAreas: ['TÖT']
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
        qualification: nrkEmp.qualification,
        gender: nrkEmp.gender,
        department: nrkEmp.department
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

async function createOrUpdateRealm(existingRealm, realmData, strapiInstance) {
  if(existingRealm == null) {
    existingRealm = await strapiInstance.service('api::volunteer-realm.volunteer-realm').create({
          data: realmData,
          populate: '*'
      });
  } else {
      await strapiInstance.service('api::volunteer-realm.volunteer-realm').update(existingRealm.id, {
          data: realmData,
          populate: '*'
        });
  }

  return existingRealm;
}

module.exports = createCoreService('api::volunteer-realm.volunteer-realm', ({ strapi }) => ({
    async find(...args) {  
        // Calling the default core controller
        const { results: strapiRealms, pagination } = await super.find(...args);

        strapi.log.debug(JSON.stringify(pagination))

        let latestRealm;
        strapiRealms.forEach(realm => {
            if(latestRealm == null || (new Date(realm.updatedAt) > new Date(latestRealm.updatedAt))) {
                latestRealm = realm;
            }
        });

        // const allEmps = await strapi.config['nrk'].getAllEmployees();
              
        // const allVolunteers = allEmps.filter(emp => emp.statusCode == 'E');

        if(latestRealm == null ||
            (new Date() - new Date(latestRealm.updatedAt)) / 36e5 > 0.1 ) { // last updated longer than 12h ago

            let allVolunteers = (await strapi.config['nrk'].getAllEmployees())
              ?.filter(emp => emp.statusCode != 'H' && emp.statusCode != 'Z' && emp.statusCode != 'FSJ');

            strapi.log.debug(JSON.stringify(allVolunteers));

            if(allVolunteers != null) {
              await Promise.all(
                allVolunteers.map(async volunteer => {
                  const activityAreas = await strapi.config['nrk'].getEmployeeActivityAreaByMnr(volunteer.mnr);

                  volunteer.activityAreas = activityAreas == null ? [] : activityAreas.filter(area => area.aktiv == 1)
                })
              );

              const realms = [];
              declaredRealms.forEach(declaredRealm => {
                const realmCopy = { ...declaredRealm };
                realmCopy.volunteers = [];
                realms.push(realmCopy);
              });

              realms.forEach(realm => {
                allVolunteers.forEach(volunteer => {
                  if(volunteer.activityAreas.some(volunteerArea => realm.activityAreas.includes(volunteerArea['TB_ID']))) {
                    realm.volunteers.push(volunteer);
                  }
                });
              });

              let distinctVolunteers = [];
              realms.forEach(realm => distinctVolunteers.push(...realm.volunteers));
              strapi.log.debug('length before distinct: ' + distinctVolunteers.length);
              distinctVolunteers = distinctVolunteers.filter((item, index) => distinctVolunteers.indexOf(item) === index);
              strapi.log.debug('length after distinct: ' + distinctVolunteers.length);

              // add all volunteers to strapi DB
              await Promise.all(
                distinctVolunteers.map(async nrkVolunteer => {
                  nrkVolunteer.qualification = await strapi.config['nrk'].getEmployeeQualificationByMnr(nrkVolunteer.mnr)

                  if(nrkVolunteer.qualification != null && ['m', 'w'].includes(nrkVolunteer.gender)) {
                    nrkVolunteer.qualification = nrkVolunteer.qualification.replace(
                      ':in',
                      nrkVolunteer.qualification == 'm' ? '' : 'in'
                    );
                  }

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
                })
              );

              // add realms to strapi DB and relate to volunteers
              for (const realm of realms) {
                const realmData = {
                  name: realm.name,
                  volunteers: realm.volunteers.map(volunteer => volunteer.strapiId)
                }

                // find existing realm in DB
                const volunteerRealmQueryResult = (await super.find({
                  filters: {
                      name: realm.name
                  },
                  populate: '*'
                })).results;
                let strapiRealm = volunteerRealmQueryResult.length > 0 ? volunteerRealmQueryResult[0] : null;

                const updatedRealm = await createOrUpdateRealm(strapiRealm, realmData, strapi);
              }

              return await super.find(...args);

              // await Promise.all(
              //   realms.map(async realm => {
              //     const realmData = {
              //       name: realm.name,
              //       volunteers: realm.volunteers.map(volunteer => volunteer.strapiId)
              //     }

              //     // find existing realm in DB
              //     const volunteerRealmQueryResult = (await super.find({
              //       filters: {
              //           name: realm.name
              //       },
              //       populate: '*'
              //     })).results;
              //     let strapiRealm = volunteerRealmQueryResult.length > 0 ? volunteerRealmQueryResult[0] : null;

              //     await createOrUpdateRealm(strapiRealm, realmData, strapi);
              //   })
              // );

            }

          }

        return { results: strapiRealms, pagination };
    }
}));
