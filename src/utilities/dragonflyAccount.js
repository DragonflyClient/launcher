const axios = require('axios').default;
const baseAuthUrl = 'https://api.playdragonfly.net/v1/authentication';

const fs = require('fs');
const path = require('path');

const CryptoJS = require('crypto-js');

module.exports.validateDragonflyAccount = token => {
    return axios
        .post(
            baseAuthUrl + '/token',
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        )
        .then(res => {
            if (res.data.success) {
                return true;
            } else {
                return false;
            }
        })
        .catch(err => {
            console.log(err.response.status);
            return false;
        });
};

module.exports.dragonflyAccountLogin = loginBody => {
    return axios
        .post(baseAuthUrl + '/login', loginBody)
        .then(res => {
            console.log(res.data);
            if (res.data.success) {
                console.log(res.data.token, 'DRAGONFLY TOKEN LOGIN!');
                return res.data;
            } else {
                console.log('No success logging into dragonfly account!');
                return false;
            }
        })
        .catch(err => {
            return err.response.data;
        });
};

module.exports.getDragonflyToken = appPath => {
    try {
        const cipherText = fs.readFileSync(path.join(appPath, '.secrets', 'access.txt')).toString();
        const bytes = CryptoJS.AES.decrypt(cipherText, 'secretKey');
        const token = bytes.toString(CryptoJS.enc.Utf8);
        return token;
    } catch (error) {}
};
