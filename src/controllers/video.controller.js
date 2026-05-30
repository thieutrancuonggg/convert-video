const path = require('path');
const fs = require('fs-extra');
const { saveUploadedFile } = require('../services/upload.service');
const { generateVariants } = require('../services/variant.service');
const { streamZipToResponse } = require('../services/zip.service');
const { createJob, getJob, updateJob, enqueue } = require('../jobs/render-queue');
const { getJobOutputFile, isPathSafe } = require('../utils/path.util');
const { outputsDir } = require('../config/storage.config');
const { VARIANTS } = require('../constants/variant.constants');
const { logger } = require('../utils/logger.util');

// POST /upload
async function uploadAndProcess(req, res, next) {
  try {
    const { jobId, inputPath, originalFilename } = await saveUploadedFile(req.file);
    const videoInfo = req.videoInfo;
    const outputDir = path.join(outputsDir, jobId);

    const job = createJob({ id: jobId, originalFilename, inputPath, outputDir });

    if (videoInfo.warnings.length > 0) {
      updateJob(jobId, { warning: videoInfo.warnings.join(' | ') });
    }

    enqueue(jobId, async (jId) => {
      const outputs = await generateVariants(jId, inputPath, videoInfo);
      updateJob(jId, { outputs });
    });

    res.redirect(`/processing/${jobId}`);
  } catch (err) {
    next(err);
  }
}

// GET /processing/:jobId
function showProcessing(req, res) {
  const job = getJob(req.params.jobId);

  if (!job) {
    return res.status(404).render('pages/error', {
      title: 'Không tìm thấy',
      message: 'Job không tồn tại hoặc đã bị xóa (server restart sẽ xóa trạng thái).',
    });
  }

  if (job.status === 'completed') return res.redirect(`/result/${job.id}`);
  if (job.status === 'failed') {
    return res.render('pages/error', {
      title: 'Xử lý thất bại',
      message: job.errorMessage || 'Lỗi không xác định trong quá trình render.',
    });
  }

  res.render('pages/processing', { title: 'Đang xử lý…', jobId: job.id, job });
}

// GET /jobs/:jobId/status  →  JSON
function getJobStatus(req, res) {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

  res.json({
    success: true,
    data: {
      id: job.id,
      status: job.status,
      progress: job.progress,
      warning: job.warning,
      errorMessage: job.errorMessage,
    },
  });
}

// GET /result/:jobId
function showResult(req, res) {
  const job = getJob(req.params.jobId);

  if (!job) {
    return res.status(404).render('pages/error', {
      title: 'Không tìm thấy',
      message: 'Job không tồn tại hoặc đã bị xóa.',
    });
  }

  if (job.status !== 'completed') return res.redirect(`/processing/${job.id}`);

  res.render('pages/result', { title: 'Kết quả', jobId: job.id, job });
}

// GET /preview/:jobId/:filename  →  stream video inline for <video> tag
async function previewFile(req, res, next) {
  try {
    const { jobId, filename } = req.params;

    if (!isValidJobId(jobId)) return res.status(400).end();

    const safeName = path.basename(filename);
    const allowed = VARIANTS.map((v) => v.filename);
    if (!allowed.includes(safeName)) return res.status(403).end();

    const filePath = getJobOutputFile(jobId, safeName);
    if (!isPathSafe(filePath, outputsDir)) return res.status(403).end();

    const exists = await fs.pathExists(filePath);
    if (!exists) return res.status(404).end();

    // sendFile handles range requests so <video> seeking works
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
}

// GET /download/:jobId/zip
async function downloadZip(req, res, next) {
  try {
    const { jobId } = req.params;
    if (!isValidJobId(jobId)) return res.status(400).end();

    const job = getJob(jobId);
    if (!job || job.status !== 'completed') {
      return res.status(404).json({ message: 'Job not found or not completed' });
    }

    streamZipToResponse(res, jobId);
  } catch (err) {
    next(err);
  }
}

// GET /download/:jobId/:filename
async function downloadFile(req, res, next) {
  try {
    const { jobId, filename } = req.params;
    if (!isValidJobId(jobId)) return res.status(400).end();

    const safeName = path.basename(filename);
    const allowed = VARIANTS.map((v) => v.filename);
    if (!allowed.includes(safeName)) return res.status(403).end();

    const filePath = getJobOutputFile(jobId, safeName);
    if (!isPathSafe(filePath, outputsDir)) return res.status(403).end();

    const exists = await fs.pathExists(filePath);
    if (!exists) return res.status(404).end();

    res.download(filePath, safeName);
  } catch (err) {
    next(err);
  }
}

// GET /health
function healthCheck(_req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function isValidJobId(id) {
  // UUID v4 format
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

module.exports = {
  uploadAndProcess,
  showProcessing,
  getJobStatus,
  showResult,
  previewFile,
  downloadZip,
  downloadFile,
  healthCheck,
};
