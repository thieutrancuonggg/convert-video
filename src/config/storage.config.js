const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');

module.exports = {
  rootDir: ROOT_DIR,
  uploadsDir: path.join(ROOT_DIR, 'uploads'),
  outputsDir: path.join(ROOT_DIR, 'outputs'),
  publicDir: path.join(ROOT_DIR, 'public'),
  viewsDir: path.join(ROOT_DIR, 'views'),
};
