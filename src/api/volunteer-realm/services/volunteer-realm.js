'use strict';

/**
 * volunteer-realm service
 */

const { createCoreService } = require('@strapi/strapi').factories;
const realmFilterIds = [ /*30579, 30582, */ 30585];

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
        name: nrkEmp.name
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
            
            realmFilterIds.forEach(async realmFilterId => {
                const memberMnrs = await strapi.config['nrk'].getFilterMembers(realmFilterId);
                
                if(memberMnrs != null) {
                    await Promise.all(
                        memberMnrs.map(async mnr => {
                            const nrkEmp = await strapi.config['nrk'].getEmployeeByMnr(mnr);

                            if(nrkEmp != null) {
                                const strapiVolunteer = await createOrUpdateVolunteer(nrkEmp, strapi);

                                const pictureBlob = await strapi.config['nrk'].getPictureByMnr(strapiVolunteer.mnr);
                                if(pictureBlob != null) {
                                    await updatePicture(
                                      strapiVolunteer,
                                      pictureBlob,
                                      'api_' + removeUmlauts(nrkEmp.name) + "." + pictureBlob.type.split('/')[1]
                                    );
                                }

                                await strapi.config['nrk'].getEmployeeQualificationByMnr();
                            }
                        })
                    )
                }
            });

            let membersGroupedByTurnus = {};

            const memberMnrs = await strapi.config['nrk'].getFilterMembers(30287);

            strapi.log.debug('turnus filter members: ' + JSON.stringify(memberMnrs));

            if(memberMnrs != null) {
                await Promise.all(
                    memberMnrs.map(async mnr => {
                        const nrkEmp = await strapi.config['nrk'].getEmployeeByMnr(mnr);
    
                        if(nrkEmp != null) {
                            const beginDateSplitted = nrkEmp.beginDateString.split('-'); // "2024-01-02"
                            const selector = parseInt(beginDateSplitted[0]) + '/' + parseInt(beginDateSplitted[1]); // 2024/1
        
                            if(membersGroupedByTurnus[selector] == null) membersGroupedByTurnus[selector] = [];
                            membersGroupedByTurnus[selector].push(nrkEmp);
                        }
                    })
                );

                // strapi.log.debug(JSON.stringify(membersGroupedByTurnus));

                await Promise.all(
                    strapiRealms.map(async turnus => {
                        if(!membersGroupedByTurnus.hasOwnProperty(turnus.year + '/' + turnus.month)) {
                            // set turnus inactive
                            strapi.log.debug('setting turnus ' + turnus.year + '/' + turnus.month + ' inactive');
    
                            await super.update(turnus.id, {
                                data: {
                                  active: false
                                },
                            });
                        }
                    })
                );

                for (const turnusKey in membersGroupedByTurnus) {
                    if (Object.hasOwnProperty.call(membersGroupedByTurnus, turnusKey)) {
                        const turnusKeySplitted = turnusKey.split('/');
                        const turnusYear = turnusKeySplitted[0];
                        const turnusMonth = turnusKeySplitted[1];

                        /* make sure turnus entry exists in strapi */
                        const turnusQueryResult = (await super.find({
                            filters: {
                                year: turnusYear,
                                month: turnusMonth
                            },
                            populate: '*'
                        })).results;

                        let strapiTurnus = turnusQueryResult.length > 0 ? turnusQueryResult[0] : null;
                        if(strapiTurnus == null) {
                            strapiTurnus = await super.create({
                                data: {
                                    year: turnusYear,
                                    month: turnusMonth,
                                    active: true
                                },
                                populate: '*'
                            });
                        }

                        // empty pictures before adding new ones
                        await super.update(strapiTurnus.id, {
                            data: {
                              pictures: null,
                            },
                        });

                        await updateTurnusPictures(strapiTurnus, membersGroupedByTurnus[turnusKey], strapi)
                    }
                }
            }
        }

        return await super.find(...args);
    }
}));
