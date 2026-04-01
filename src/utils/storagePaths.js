const path = require('path');

function getDatabasePath() {
  return path.resolve(process.env.DB_PATH || './data/database.sqlite');
}

function getUploadBaseDir() {
  return path.resolve(process.env.UPLOAD_DIR || './data/uploads');
}

function getBrandingBaseDir() {
  return path.resolve(process.env.BRANDING_DIR || './data/branding');
}

function toStoredUploadPath(filePath) {
  return path.relative(getUploadBaseDir(), path.resolve(filePath));
}

function resolveStoredUploadPath(storedPath) {
  if (!storedPath) return '';

  if (path.isAbsolute(storedPath)) {
    return storedPath;
  }

  const legacyPath = path.resolve(storedPath);
  if (legacyPath.startsWith(getUploadBaseDir()) || legacyPath.includes(`${path.sep}data${path.sep}uploads${path.sep}`)) {
    return legacyPath;
  }

  return path.resolve(getUploadBaseDir(), storedPath);
}

module.exports = {
  getDatabasePath,
  getUploadBaseDir,
  getBrandingBaseDir,
  toStoredUploadPath,
  resolveStoredUploadPath
};
