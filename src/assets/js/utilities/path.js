const path = require('path');
const fs = require('fs');
const fswin = require('fswin');
var CryptoJS = require('crypto-js');

exports.appPath = function (appPath) {
  console.log(appPath, 'AP');
  if (appPath.toLowerCase().indexOf('app.asar') > -1) {
    return path.resolve(appPath, '../..');
  } else {
    return appPath;
  }
};

module.exports.ensureDirectoryExistence = function ensureDirectoryExistence(filePath, create) {
  var dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  if (create) {
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
  }
};

module.exports.readToken = async (currentAppPath) => {
  const accessPath = path.join(currentAppPath, '.secrets/access.txt');
  if (!(await this.ensureDirectoryExistence(accessPath, false))) return null;
  return await new Promise((resolve, reject) => {
    fs.readFile(accessPath, 'utf-8', (err, data) => {
      if (err) reject(err);
      const bytes = CryptoJS.AES.decrypt(data, 'secretKey');
      const accessToken = bytes.toString(CryptoJS.enc.Utf8);
      resolve(accessToken);
    });
  });
};
