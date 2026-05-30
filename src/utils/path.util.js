const path = require('path');
const { outputsDir } = require('../config/storage.config');

function getJobOutputDir(jobId) {
  return path.join(outputsDir, jobId);
}

function getJobOutputFile(jobId, filename) {
  return path.join(outputsDir, jobId, filename);
}

// Prevent path traversal: resolved path must stay inside baseDir
function isPathSafe(targetPath, baseDir) {
  const resolved = path.resolve(targetPath);
  const base = path.resolve(baseDir);
  return resolved.startsWith(base + path.sep) || resolved === base;
}

module.exports = { getJobOutputDir, getJobOutputFile, isPathSafe };
