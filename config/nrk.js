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

        strapi.log.debug('members: ', members);
        strapi.log.debug('members stringed: ', JSON.stringify(members));
    },

    async getEmployeeByMnr(mnr) {
        const data = await makeNrkRequest({
            'req': 'GetMAData',
            'mnr': mnr
        });

        strapi.log.debug('nrk emp: ' + JSON.stringify(data));

        if(data == null) return null;

        return {
            name: data.Vorname + ' ' + data.Nachname,
        };
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

    strapi.log.log(JSON.stringify(axiosResponse.data));
    strapi.log.log(JSON.stringify(axiosResponse));

    if(axiosResponse.status >= 200 && axiosResponse.status < 300) {
        if(axiosResponse.data.status === "OK") {
            return axiosResponse.data.data;
        } else {
            strapi.log.error(axiosResponse.data.msg);
            return null;
        }
    }
}