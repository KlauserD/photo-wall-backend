'use strict';

/**
 * turnus service
 */

const { createCoreService } = require('@strapi/strapi').factories;
const axios = require('axios').default;

async function updateTurnusPictures(turnus, nrkEmps, strapiInstance) {

    await Promise.all(
        nrkEmps.map(async nrkEmp => {
            const pictureBlob = await strapiInstance.config['nrk'].getPictureByMnr(nrkEmp.mnr);
    
            const filename = 'api_' + 
                (nrkEmp.statusCode == 'Z' ? 'ZD-' : 'FSJ-') +
                nrkEmp.name +
                '.' +
                pictureBlob.type.split('/')[1];
    

            // delete if api image is present
            const existingApiPictures = turnus.pictures?.filter(picture => picture.name == filename);
            if(existingApiPictures?.length > 0) {
                await axios.delete(
                'http://127.0.0.1:1337/api/upload/files/' + existingApiPictures[0].id,
                {
                    headers: {
                    "Authorization": 'Bearer ' + strapiInstance.config['api'].uploadToken
                    }
                }
                );
            }
    
            nrkEmp.pictureBlob = pictureBlob;
            nrkEmp.pictureFilename = filename;
        })
    );

    const form = new FormData();
    nrkEmps.forEach(nrkEmp => {
        form.append('files', nrkEmp.pictureBlob, nrkEmp.pictureFilename);
    });

    form.append('ref', 'api::turnus.turnus');
    form.append('refId', turnus.id);
    form.append('field', 'pictures');

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

module.exports = createCoreService('api::turnus.turnus', ({ strapi }) => ({
    async find(...args) {  
        // Calling the default core controller
        const { results: strapiTurnuses, pagination } = await super.find(...args);

        let latestTurnus;
        strapiTurnuses.forEach(turnus => {
            if(latestTurnus == null || (turnus.year >= latestTurnus.year && turnus.month > latestTurnus.month)) {
                latestTurnus = turnus;
            }
        });
              
       if((new Date() - new Date(latestTurnus.updatedAt)) / 36e5 > 12) { // last updated longer than 12h ago
            let membersGroupedByTurnus = {};
            /* 
                {
                    "2024/1": [ ... ],
                    "2023/10": [ ... ],
                    "2023/7": [ ... ]
                }
            */

            const memberMnrs = await strapi.config['nrk'].getFilterMembers(30287);

            if(memberMnrs != null) {
                await Promise.all(
                    memberMnrs.map(async mnr => {
                        const nrkEmp = await strapi.config['nrk'].getEmployeeByMnr(mnr);
    
                        const beginDateSplitted = nrkEmp.beginDateString.split('.'); // "02.01.2024"
                        const selector = parseInt(beginDateSplitted[2]) + '/' + parseInt(beginDateSplitted[1]); // 2024/1
    
                        if(membersGroupedByTurnus[selector] == null) membersGroupedByTurnus[selector] = [];
                        membersGroupedByTurnus[selector].push(nrkEmp);
                    })
                );

                // strapi.log.debug(JSON.stringify(membersGroupedByTurnus));

                await Promise.all(
                    strapiTurnuses.map(async turnus => {
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
