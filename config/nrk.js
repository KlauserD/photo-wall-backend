const environment = {
    production: false,
    nrkServer: 'https://api.nrk-hosting.at',
    apiToken: 'XYescCVxf3auqJKWxJxvER4wqCRustwnzDboJMw8chUouomZqK'
};

module.exports = {
    async getNameById(id) {
        const data = await makeNrkRequest({
            'req': 'GetMAData',
            'mnr': id
        });

        if(data == null) return null;

        const empName = data.Vorname + ' ' + data.Nachname
        return empName;
    },

    async getPictureById(id) {
        const imgBase64 = await makeNrkRequest({
            'req': 'MAPicture',
            'mnr': id
        });

        if (imgBase64 == null) return null;

        return imgBase64;
    }
}

async function makeNrkRequest(params) {
    const axios = require('axios').default;

    const axiosResponse = await axios.post(
        environment.nrkServer, 
        params, {
            timeout: 5000,
            headers: {
                'NRK-AUTH': environment.apiToken,
                'Content-Type': 'application/json'
            }
    });

    if(axiosResponse.status >= 200 && axiosResponse.status < 300) {
        if(axiosResponse.data.status === "OK") {
            return axiosResponse.data.data;
        } else {
            strapi.log.error(axiosResponse.data.msg);
            return null;
        }
    }
}
