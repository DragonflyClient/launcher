const axios = require('axios').default;
const baseAuthUrl = 'https://api.playdragonfly.net/v1/authentication';

const fs = require('fs');
const path = require('path');

const CryptoJS = require('crypto-js');

module.exports.getDragonflyAccount = (token, validate = false) => {
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
                if (validate) return true;
                return res.data;
            } else {
                if (validate) return false;
                return res.data;
            }
        })
        .catch(err => {
            return false;
        });
};

module.exports.dragonflyAccountLogin = loginBody => {
    return axios
        .post(baseAuthUrl + '/login', loginBody)
        .then(res => {
            if (res.data.success) {
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
