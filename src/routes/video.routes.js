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
  downloadFile,
  healthCheck,
} = require('../controllers/video.controller');

router.get('/', (_req, res) => {
  res.render('pages/index', { title: 'TikTok Affiliate Video Tool' });
});

router.post('/upload', upload.single('video'), validateVideo, uploadAndProcess);

router.get('/processing/:jobId', showProcessing);

router.get('/jobs/:jobId/status', getJobStatus);

router.get('/result/:jobId', showResult);

// Inline preview for <video> tag — before download routes
router.get('/preview/:jobId/:filename', previewFile);

router.get('/download/:jobId/:filename', downloadFile);

router.get('/health', healthCheck);

module.exports = router;
