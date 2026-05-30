const express = require('express');
const router = express.Router();
const { upload } = require('../middlewares/upload.middleware');
const { validateVideo } = require('../middlewares/validate-video.middleware');
const {
  uploadAndProcess,
  showProcessing,
  getJobStatus,
  showResult,
  previewFile,
  downloadZip,   // must come before downloadFile to avoid :filename catching 'zip'
  downloadFile,
  healthCheck,
} = require('../controllers/video.controller');

router.get('/', (_req, res) => {
  res.render('pages/index', { title: 'TikTok Affiliate Video Variation Tool' });
});

router.post('/upload', upload.single('video'), validateVideo, uploadAndProcess);

router.get('/processing/:jobId', showProcessing);

router.get('/jobs/:jobId/status', getJobStatus);

router.get('/result/:jobId', showResult);

// Inline preview for <video> tag — before download routes
router.get('/preview/:jobId/:filename', previewFile);

// ZIP must be before :filename so 'zip' isn't captured as a filename
router.get('/download/:jobId/zip', downloadZip);
router.get('/download/:jobId/:filename', downloadFile);

router.get('/health', healthCheck);

module.exports = router;
