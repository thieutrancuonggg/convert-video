const archiver = require('archiver');
const fs = require('fs-extra');
const path = require('path');
const { ZIP_FILENAME } = require('../constants/variant.constants');
const { getJobOutputDir, getJobOutputFile } = require('../utils/path.util');
const { VARIANTS } = require('../constants/variant.constants');
const { logger } = require('../utils/logger.util');

// Stream all variant files directly into the response — never loads full video into RAM
function streamZipToResponse(res, jobId) {
  const archive = archiver('zip', { zlib: { level: 0 } }); // level 0 = no compression for video

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${ZIP_FILENAME}"`);

  archive.on('warning', (err) => {
    if (err.code !== 'ENOENT') logger.warn(`ZIP warning: ${err.message}`);
  });
  archive.on('error', (err) => {
    logger.error(`ZIP error: ${err.message}`);
    if (!res.headersSent) res.status(500).end();
  });

  archive.pipe(res);

  for (const variant of VARIANTS) {
    const filePath = getJobOutputFile(jobId, variant.filename);
    archive.file(filePath, { name: variant.filename });
  }

  archive.finalize();
}

module.exports = { streamZipToResponse };
