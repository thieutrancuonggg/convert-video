const archiver = require('archiver');
const { ZIP_FILENAME } = require('../constants/variant.constants');
const { getJobOutputFile } = require('../utils/path.util');
const { getJob } = require('../jobs/render-queue');
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

  const job = getJob(jobId);
  const outputs = job ? job.outputs : [];

  for (const output of outputs) {
    const filePath = getJobOutputFile(jobId, output.filename);
    archive.file(filePath, { name: output.filename });
  }

  archive.finalize();
}

module.exports = { streamZipToResponse };
