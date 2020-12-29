const path = require('path');
const fs = require('fs');
const fswin = require('fswin');
var CryptoJS = require('crypto-js');

module.exports.rootPath = function (appPath) {
    if (appPath.toLowerCase().indexOf('app.asar') > -1) {
        return path.resolve(appPath, '../..');
    } else {
        return appPath;
    }
};

/**
 *
 * @Important Files within a nonexisting folder need to be marked as "dir"
 *
 */
module.exports.ensureDirectoryExistence = function ensureDirectoryExistence(filePath, create, type) {
    if (type == 'dir') {
        var sep = filePath.split('\\');
        var last = sep.pop();

        if (last.indexOf('.') > 0) {
            last = '';
        }

        var dirname = sep.join('\\') + last;

        if (fs.existsSync(dirname)) {
            return true;
        } else if (create) {
            fs.mkdirSync(dirname);
            return false;
        }
    } else if (type == 'file') {
        if (fs.existsSync(filePath)) {
            return true;
        }
        if (create) {
            try {
                fs.writeFileSync(filePath, '');
            } catch (error) {
                console.log('! Error while writing file', error);
            }
            return false;
        }
    }
};
