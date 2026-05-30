const { logger } = require('../utils/logger.util');
const appConfig = require('../config/app.config');

// In-memory job store — cleared on restart (MVP)
const jobs = new Map();

let activeRenders = 0;
const pendingQueue = []; // [{ jobId, processorFn }]

function createJob({ id, originalFilename, inputPath, outputDir }) {
  const job = {
    id,
    originalFilename,
    inputPath,
    outputDir,
    status: 'pending',    // pending | processing | completed | failed
    progress: 0,
    warning: null,
    outputs: [],
    errorMessage: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  jobs.set(id, job);
  return job;
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function updateJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, patch);
  return job;
}

// Enqueue a render job; processorFn receives the jobId and must be async
function enqueue(jobId, processorFn) {
  pendingQueue.push({ jobId, processorFn });
  tick();
}

async function tick() {
  if (activeRenders >= appConfig.maxConcurrentRenders) return;
  if (pendingQueue.length === 0) return;

  const { jobId, processorFn } = pendingQueue.shift();
  activeRenders++;

  updateJob(jobId, { status: 'processing' });
  logger.info(`Job ${jobId} started (active: ${activeRenders})`);

  try {
    await processorFn(jobId);
    updateJob(jobId, {
      status: 'completed',
      progress: 100,
      completedAt: new Date().toISOString(),
    });
    logger.info(`Job ${jobId} completed`);
  } catch (err) {
    updateJob(jobId, {
      status: 'failed',
      errorMessage: err.message,
      completedAt: new Date().toISOString(),
    });
    logger.error(`Job ${jobId} failed: ${err.message}`);
  } finally {
    activeRenders--;
    tick(); // process next item in queue
  }
}

module.exports = { createJob, getJob, updateJob, enqueue };
