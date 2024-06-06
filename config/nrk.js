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

        // strapi.log.debug('nrk emp for id ' + mnr + ': ' + JSON.stringify(data));

        if(data == null) return null;

        return {
            mnr: mnr,
            name: data.Vorname + ' ' + data.Nachname,
            beginDateString: data["Status von"],
            statusCode: data["Status Code"]
        };
    },

    async getAllEmployees() {
        let data = await makeNrkRequest({
            'req': 'GetAllMA',
            'withguests': 0
        });

        // strapi.log.debug('all ma: ');
        //strapi.log.debug(JSON.stringify(data));

        if(data == null) return null;

        return data.map(nrkObject => {
            return {
                mnr: nrkObject.Personalnr,
                name: nrkObject.Vorname + ' ' + nrkObject.Nachname,
                statusCode: nrkObject["Status Code"]
            }
        });
    },

    async getEmployeeQualificationByMnr(mnr) {
        const data = await makeNrkRequest({
            'req': 'MAQualifikationen',
            'mnr': mnr
        });

        // strapi.log.debug('nrk emp for id ' + mnr + ': ' + JSON.stringify(data));

        if(data == null) return null;

        // return {
        //     mnr: mnr,
        //     name: data.Vorname + ' ' + data.Nachname,
        //     beginDateString: data["Status von"],
        //     statusCode: data["Status Code"]
        // };
    },

    async getEmployeeActivityAreaByMnr(mnr) {
        const data = await makeNrkRequest({
            'req': 'GETMATBereiche',
            'mnr': mnr
        });

        //strapi.log.debug('activity area for ' + mnr + ': ' + JSON.stringify(data));

        if(data == null) return null;

        return data;

        // return {
        //     mnr: mnr,
        //     name: data.Vorname + ' ' + data.Nachname,
        //     beginDateString: data["Status von"],
        //     statusCode: data["Status Code"]
        // };
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

    const util = require('util');

    strapi.log.debug(util.inspect(axiosResponse));
    
    if(axiosResponse.status >= 200 && axiosResponse.status < 300) {
        if(axiosResponse.data.status === "OK") {
            return axiosResponse.data.data;
        } else {
            strapi.log.error(axiosResponse.data.msg);
            return null;
        }
    }
}