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

        if(data == null) return "_ _";

        strapi.log.debug(JSON.stringify(data));

        const empName = data.Vorname + ' ' + data.Nachname
        return empName;
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
            axiosResponse.data.data;
        } else {
            strapi.log.error(axiosResponse.data.msg);
            return null;
        }
    }
}
