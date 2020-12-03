const path = require('path');
const fs = require('fs');
const fswin = require('fswin');
var CryptoJS = require('crypto-js');

module.exports.rootPath = function (appPath) {
  console.log(appPath, 'APPP PATH');
  if (appPath.toLowerCase().indexOf('app.asar') > -1) {
    console.log('WITH ASAR');
    return path.resolve(appPath, '../..');
  } else {
    console.log('WITHOUT ASAR');
    return appPath;
  }
};

/**
 *
 * @Important Files within a nonexisting folder need to be marked as "dir"
 *
 */
module.exports.ensureDirectoryExistence = function ensureDirectoryExistence(filePath, create, type) {
  console.log(filePath, 'FILEPATH');
  if (type == 'dir') {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    if (create) {
      ensureDirectoryExistence(dirname);
      fs.mkdirSync(dirname);
    }
  } else if (type == 'file') {
    console.log('Requested file');
    if (fs.existsSync(filePath)) {
      return true;
    }
    if (create) {
      try {
        fs.writeFileSync(filePath, '');
        console.log('File written.');
      } catch (error) {
        console.log('Error while writing file', error);
      }
    }
  }
};

module.exports.readToken = async (currentAppPath) => {
  const accessPath = path.join(currentAppPath, '.secrets/access.txt');
  if (!(await this.ensureDirectoryExistence(accessPath, false, 'file'))) return null;
  return await new Promise((resolve, reject) => {
    fs.readFile(accessPath, 'utf-8', (err, data) => {
      if (err) reject(err);
      const bytes = CryptoJS.AES.decrypt(data, 'secretKey');
      const accessToken = bytes.toString(CryptoJS.enc.Utf8);
      resolve(accessToken);
    });
  });
};
