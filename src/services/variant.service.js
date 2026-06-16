const path = require('path');
const fs = require('fs-extra');
const { VARIANTS } = require('../constants/variant.constants');
const { renderVariant } = require('./ffmpeg.service');
const { findHookSegment } = require('./video-analysis.service');
const { getJobOutputDir } = require('../utils/path.util');
const { updateJob } = require('../jobs/render-queue');
const { logger } = require('../utils/logger.util');

async function generateVariants(jobId, inputPath, videoInfo, productName) {
  const outputDir = getJobOutputDir(jobId);
  await fs.ensureDir(outputDir);
  const hookSegment = await findHookSegment(inputPath, videoInfo.duration);

  const outputs = [];
  const total = VARIANTS.length;

  for (let i = 0; i < total; i++) {
    const variant = VARIANTS[i];
    const outputPath = path.join(outputDir, variant.filename);

    // Report progress before each render (~0 → 90%)
    updateJob(jobId, { progress: Math.round((i / total) * 90) });

    logger.info(`Job ${jobId}: rendering variant ${i + 1}/${total} (${variant.name})`);

    await renderVariant(
      inputPath,
      outputPath,
      videoInfo,
      variant,
      productName,
      hookSegment,
    );

    outputs.push({
      id: variant.id,
      name: variant.name,
      label: variant.label,
      description: variant.description,
      filename: variant.filename,
    });

    updateJob(jobId, {
      progress: Math.round(((i + 1) / total) * 90),
      outputs: [...outputs],
    });
  }

  return outputs;
}

module.exports = { generateVariants };
