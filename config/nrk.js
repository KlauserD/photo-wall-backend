const environment = {
    production: false,
    nrkServer: 'https://api.nrk-hosting.at',
    apiToken: 'XYescCVxf3auqJKWxJxvER4wqCRustwnzDboJMw8chUouomZqK'
};

module.exports = {
    async getFilterMembers(filterId) {
        const members = await makeNrkRequest({
            'req': 'GetFilterMember',
            'filterid': filterId
        });

        return members;
    },

    async getEmployeeByMnr(mnr) {
        const data = await makeNrkRequest({
            'req': 'GetMAData',
            'mnr': mnr
        });

        // if(mnr == 87100) {

        //     strapi.log.debug('nrk emp for id ' + mnr + ': ' + JSON.stringify(data));
        // }

        if(data == null) return null;

        return {
            mnr: mnr,
            name: data.Vorname + ' ' + data.Nachname,
            firstName: data.Vorname,
            lastName: data.Nachname,
            beginDateString: data["Status von"],
            statusCode: data["Status Code"]
        };
    },

    async getAllEmployees() {
        let data = await makeNrkRequest({
            'req': 'GetAllMA',
            'withguests': 0
        });

        //strapi.log.debug('all ma: ');
        //strapi.log.debug(JSON.stringify(data));

        if(data == null) return null;

        return data.map(nrkObject => {
            return {
                mnr: nrkObject.Personalnr,
                name: nrkObject.Nachname + ' ' + nrkObject.Vorname,
                firstName: nrkObject.Vorname,
                lastName: nrkObject.Nachname,
                gender: nrkObject.Geschlecht,
                department: nrkObject["Dienststelle Name"] == 'St. Leonhard-Ruprechtshofen' ? 'St. Leonhard' : nrkObject["Dienststelle Name"],
                beginDateString: nrkObject["Status von"],
                statusCode: nrkObject["Status Code"]
            }
        });
    },

    async getEmployeeQualificationByMnr(mnr) {
        const qualifications = await makeNrkRequest({
            'req': 'MAQualifikationen',
            'mnr': mnr
        });

        //strapi.log.debug('qualification for id ' + mnr + ': ' + JSON.stringify(qualifications));

        if(qualifications == null) return null;
        
        const rktQualifications = qualifications.filter(
            qualification => qualification['qualifikation_id'] >= 1 && 
            qualification['qualifikation_id'] <= 6
        );

        if(rktQualifications.length === 1) {
            switch (rktQualifications[0]['qualifikation_id']) {
                case 1: return 'Rettungs&shy;sanitäter:in';
                case 2: return 'Notfall&shy;sanitäter:in';
                case 3: return 'Notfall&shy;sanitäter:in NKA';
                case 4: return 'Notfall&shy;sanitäter:in NKV';
                case 5: 
                case 6: return 'Notfall&shy;sanitäter:in NKI';
            
                default: return null;
            }
        } else {
            return null;
        }
    },

    async getEmployeeActivityAreaByMnr(mnr) {
        const data = await makeNrkRequest({
            'req': 'GETMATBereiche',
            'mnr': mnr
        });

        // strapi.log.debug('activity area for ' + mnr + ': ' + JSON.stringify(data));

        if(data == null) return null;

        return data;
    },

    // async getUnits(mnr) {
    //     const data = await makeNrkRequest({
    //         'req': 'GetMAEinheiten',
    //         'mnr': mnr
    //     });

    //     strapi.log.debug('unit for ' + mnr + ': ' + JSON.stringify(data));

    //     if(data == null) return null;

    //     return data;
    // },

    async getNextEmployeeDuties(mnr) {
        const data = await makeNrkRequest({
            'req': 'GET_NEXT_DIENSTE',
            'mnr': 289936,
            'anzahl': 10
        });

        strapi.log.error('duties for ' + mnr + ': ' + JSON.stringify(data));

        if(data == null) return null;

        return data;
    },

    async getPictureByMnr(mnr) {
        const resultString = await makeNrkRequest({
            'req': 'MAPicture',
            'mnr': mnr
        });

        if (resultString == null) return null;

        const resultStringSplitted = resultString.split(',');

        const mimeString = resultStringSplitted[0].split(':')[1].split(';')[0]
        const imgBase64 = resultStringSplitted[1];

        const buffer = Buffer.from(imgBase64, 'base64');
        return new Blob([buffer], { type: mimeString });
    }
}

async function makeNrkRequest(params) {
    const axios = require('axios').default;

    const axiosResponse = await axios.post(
        environment.nrkServer, 
        params, {
            timeout: 15000,
            headers: {
                'NRK-AUTH': environment.apiToken,
                'Content-Type': 'application/json'
            }
    });
    
    if(axiosResponse.status >= 200 && axiosResponse.status < 300) {
        if(axiosResponse.data.status === "OK" || axiosResponse.data.status === "NODATA") {
            return axiosResponse.data.data;
        } else {
            strapi.log.error(
                'fetch error. status: ' + 
                axiosResponse.data.status +
                ', msg: ' +
                axiosResponse.data.msg
            );
            return null;
        }
    }
}