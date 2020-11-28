const axios = require('axios').default;
const validateAuthURL = 'https://api.playdragonfly.net/v1/authentication/token';

module.exports.validateDragonflyAccount = (token) => {
  console.log(token, 'TOKEN');
  return axios
    .post(
      validateAuthURL,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    .then((res) => {
      if (res.data.success) {
        return true;
      } else {
        return false;
      }
    })
    .catch((err) => {
      console.log(err.response.status);
      return false;
    });
};
