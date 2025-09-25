'use strict';

/**
 * volunteer-realm service
 */

const { createCoreService } = require('@strapi/strapi').factories;
const axios = require('axios').default;

const declaredRealms = [
  {
    name: 'RKT',
    activityAreas: ['KTW1', 'RTW1', 'FBKTW']
  },
  {
    name: 'EAR',
    activityAreas: ['EaRK', 'EaRA']
  },
  {
    name: 'TÖT',
    // activityAreas: ['TÖT']
    activityAreas: ['TÖTF', 'TÖTTAL', 'TÖTK', 'TÖTW', 'TÖTTltg']
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
    if(employee.picture != null) {
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

    // if(nrkEmp.mnr == 87100) {
    //   strapi.log.debug('maria data');
    //   strapi.log.debug(JSON.stringify(nrkEmp));
    // }

    const volunteerData = {
        mnr: nrkEmp.mnr,
        name: nrkEmp.name,
        firstname: nrkEmp.firstName,
        lastname: nrkEmp.lastName,
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
          populate: 'volunteers'
      });
  } else {
    if(realmData.volunteers.length > 0) {
      await strapiInstance.service('api::volunteer-realm.volunteer-realm').update(existingRealm.id, {
        data: realmData
      });
    }
  }

  return existingRealm;
}

async function updateAllVolunteerRealms() {
  let allVolunteers = (await strapi.config['nrk'].getAllEmployees())
    ?.filter(emp => emp.statusCode != 'H' && emp.statusCode != 'Z' && emp.statusCode != 'FSJ');

  // strapi.log.debug(JSON.stringify(allVolunteers));

  if(allVolunteers != null) {
    // await Promise.all(
      // allVolunteers.map(async volunteer => {

    for (let i = 0; i < allVolunteers.length; i++) {
      const volunteer = allVolunteers[i];
      
      strapi.log.debug('Fetch Activity area of ' + volunteer.mnr);

      const activityAreas = await strapi.config['nrk'].getEmployeeActivityAreaByMnr(volunteer.mnr);
      volunteer.activityAreas = activityAreas == null ? [] : activityAreas.filter(area => area.aktiv == 1);
      
      // synchronous delayed loop to not overload NRK server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const realms = [];
    declaredRealms.forEach(declaredRealm => {
      const realmCopy = { ...declaredRealm };
      realmCopy.volunteers = [];
      realms.push(realmCopy);
    });

    realms.forEach(realm => {
      allVolunteers.forEach(volunteer => {
        if(volunteer.activityAreas.some(volunteerArea => realm.activityAreas.includes(volunteerArea['TB_ID']))) {
          // strapi.log.debug('pushing volunteer ' + volunteer.name + ' to ' + realm.name);
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
    // synchronous delayed loop to not overload NRK server
    for (let i = 0; i < distinctVolunteers.length; i++) {
      const nrkVolunteer = distinctVolunteers[i];

      strapi.log.debug('Persist volunteer ' + nrkVolunteer.mnr);
      
      nrkVolunteer.qualification = await strapi.config['nrk'].getEmployeeQualificationByMnr(nrkVolunteer.mnr)

      if(nrkVolunteer.qualification != null && ['m', 'w'].includes(nrkVolunteer.gender)) {
        nrkVolunteer.qualification = nrkVolunteer.qualification.replace(
          ':in',
          nrkVolunteer.gender == 'm' ? '' : 'in'
        );
      }

      const strapiVolunteer = await createOrUpdateVolunteer(nrkVolunteer, strapi);
      nrkVolunteer.strapiId = strapiVolunteer.id;

      if(nrkVolunteer.imageBlob != null) {
          strapi.log.debug('Update picture for: ' + nrkVolunteer.mnr);

          await updatePicture(
            strapiVolunteer,
            nrkVolunteer.imageBlob,
            'api_' + removeUmlauts(nrkVolunteer.name) + "." + nrkVolunteer.imageBlob.type.split('/')[1]
          );
      }

    // synchronous delayed loop to not overload NRK server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // add realms to strapi DB and relate to volunteers
    for (const realm of realms) {
      const volunteerIds = realm.volunteers.map(volunteer => volunteer.strapiId);

      const realmData = {
        name: realm.name,
        volunteers: volunteerIds
      }

      // find existing realm in DB
      const volunteerRealmQueryResult = (await super.find({
        filters: {
            name: realm.name
        },
        populate: 'volunteers'
      })).results;
      let strapiRealm = volunteerRealmQueryResult.length > 0 ? volunteerRealmQueryResult[0] : null;

      const updatedRealm = await createOrUpdateRealm(strapiRealm, realmData, strapi);
    }
  }
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

        if(latestRealm == null ||
            (new Date() - new Date(latestRealm.updatedAt)) / 36e5 > 12 ) { // last updated longer than 12h ago

            updateAllVolunteerRealms();
            // return await super.find(...args);
          }

        return { results: strapiRealms, pagination };
    }
}));
