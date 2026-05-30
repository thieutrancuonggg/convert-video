const fs = require('fs-extra');
const path = require('path');

async function ensureDir(dirPath) {
  await fs.ensureDir(dirPath);
}

async function removeDir(dirPath) {
  try {
    await fs.remove(dirPath);
  } catch (_) {
    // Silently ignore — already gone
  }
}

function sanitizeFilename(filename) {
  // Strip path traversal, keep only safe chars
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function getOldJobDirs(baseDir, olderThanHours) {
  const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
  let dirs = [];

  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(baseDir, entry.name);
      const stat = await fs.stat(fullPath);
      if (stat.mtimeMs < cutoff) dirs.push(fullPath);
    }
  } catch (_) {
    // Directory might not exist yet
  }

  return dirs;
}

async function fileExists(filePath) {
  return fs.pathExists(filePath);
}

module.exports = { ensureDir, removeDir, sanitizeFilename, getOldJobDirs, fileExists };
