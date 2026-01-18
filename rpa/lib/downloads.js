import fs from 'fs';
import path from 'path';
import { humanDelay } from './navigation.js';

/**
 * Setup download directory for session
 * @param {string} sessionId - Session identifier
 * @returns {string} Download directory path
 */
export function setupDownloadDirectory(sessionId) {
  const downloadDir = path.join(process.cwd(), 'downloads', sessionId);

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  return downloadDir;
}

/**
 * Configure browser context for downloads
 * @param {import('@playwright/test').BrowserContext} context - Browser context
 * @param {string} downloadPath - Path for downloads
 */
export async function configureDownloads(context, downloadPath) {
  // Downloads are configured at context creation time in Playwright
  // This function exists for consistency but downloads are set in browser launch
  return downloadPath;
}

/**
 * Wait for download to complete and verify
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} downloadPath - Expected download directory
 * @param {RegExp} expectedFilenamePattern - Expected filename pattern
 * @param {Object} logger - Logger instance
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<string>} Path to downloaded file
 */
export async function waitForDownload(page, downloadPath, expectedFilenamePattern, logger, timeoutMs = 60000) {
  logger.info('Waiting for download to complete...');

  const startTime = Date.now();
  let downloadedFile = null;

  // Poll the download directory
  while (Date.now() - startTime < timeoutMs) {
    const files = fs.readdirSync(downloadPath);

    // Filter out partial downloads (.crdownload, .tmp, etc.)
    const completeFiles = files.filter(file =>
      !file.endsWith('.crdownload') &&
      !file.endsWith('.tmp') &&
      !file.endsWith('.part')
    );

    for (const file of completeFiles) {
      if (expectedFilenamePattern.test(file)) {
        const filePath = path.join(downloadPath, file);
        const stats = fs.statSync(filePath);

        // Verify file has content
        if (stats.size > 0) {
          logger.info(`Download complete: ${file} (${stats.size} bytes)`);
          downloadedFile = filePath;
          break;
        }
      }
    }

    if (downloadedFile) break;

    await humanDelay(500, 1000);
  }

  if (!downloadedFile) {
    throw new Error(`Download timeout: No file matching pattern ${expectedFilenamePattern} found in ${timeoutMs}ms`);
  }

  return downloadedFile;
}

/**
 * Verify downloaded file matches expected pattern and has content
 * @param {string} filePath - Path to downloaded file
 * @param {RegExp} expectedFilenamePattern - Expected filename pattern
 * @param {number} minSizeBytes - Minimum expected file size
 * @param {Object} logger - Logger instance
 * @returns {Promise<boolean>} Validation result
 */
export async function verifyDownload(filePath, expectedFilenamePattern, minSizeBytes = 100, logger) {
  try {
    const filename = path.basename(filePath);

    // Check filename matches pattern
    if (!expectedFilenamePattern.test(filename)) {
      logger.error(`Filename ${filename} does not match expected pattern ${expectedFilenamePattern}`);
      return false;
    }

    // Check file exists and has minimum size
    const stats = fs.statSync(filePath);
    if (stats.size < minSizeBytes) {
      logger.error(`File size ${stats.size} bytes is below minimum ${minSizeBytes} bytes`);
      return false;
    }

    logger.info(`Download verified: ${filename} (${stats.size} bytes)`);
    return true;
  } catch (error) {
    logger.error(`Download verification failed: ${error.message}`);
    return false;
  }
}

/**
 * Check if download already exists for idempotency
 * @param {string} downloadPath - Download directory path
 * @param {RegExp} expectedFilenamePattern - Expected filename pattern
 * @param {Object} logger - Logger instance
 * @returns {string|null} Path to existing file or null
 */
export function checkExistingDownload(downloadPath, expectedFilenamePattern, logger) {
  try {
    if (!fs.existsSync(downloadPath)) {
      return null;
    }

    const files = fs.readdirSync(downloadPath);
    const matchingFile = files.find(file => expectedFilenamePattern.test(file));

    if (matchingFile) {
      const filePath = path.join(downloadPath, matchingFile);
      const stats = fs.statSync(filePath);

      if (stats.size > 0) {
        logger.info(`Existing download found: ${matchingFile} (${stats.size} bytes)`);
        return filePath;
      }
    }
  } catch (error) {
    logger.warn(`Error checking for existing download: ${error.message}`);
  }

  return null;
}

/**
 * Trigger download and wait for completion
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} downloadConfig - Download configuration
 * @param {string} downloadConfig.trigger_selector - Selector for download button
 * @param {string} downloadConfig.trigger_type - Type of trigger (click, submit)
 * @param {RegExp} expectedFilenamePattern - Expected filename pattern
 * @param {string} downloadPath - Download directory path
 * @param {Object} logger - Logger instance
 * @returns {Promise<string>} Path to downloaded file
 */
export async function triggerAndWaitForDownload(
  page,
  downloadConfig,
  expectedFilenamePattern,
  downloadPath,
  logger
) {
  logger.info(`Triggering download: ${downloadConfig.trigger_selector}`);

  // Start waiting for download before triggering
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

  // Trigger download
  if (downloadConfig.trigger_type === 'click') {
    await page.click(downloadConfig.trigger_selector);
  } else if (downloadConfig.trigger_type === 'submit') {
    await page.click(downloadConfig.trigger_selector);
  } else {
    await page.click(downloadConfig.trigger_selector);
  }

  // Wait for download to start
  let download;
  try {
    download = await downloadPromise;
    logger.info('Download started...');
  } catch (error) {
    logger.error('Download did not start within timeout');
    throw error;
  }

  // Wait for download to complete
  const suggestedFilename = download.suggestedFilename();
  const targetPath = path.join(downloadPath, suggestedFilename);

  await download.saveAs(targetPath);
  logger.info(`Download saved to: ${targetPath}`);

  // Verify the download
  const isValid = await verifyDownload(targetPath, expectedFilenamePattern, 100, logger);
  if (!isValid) {
    throw new Error('Downloaded file failed verification');
  }

  return targetPath;
}

/**
 * Get download statistics
 * @param {string} downloadPath - Download directory path
 * @param {Object} logger - Logger instance
 * @returns {Object} Download statistics
 */
export function getDownloadStats(downloadPath, logger) {
  try {
    if (!fs.existsSync(downloadPath)) {
      return { count: 0, totalSize: 0, files: [] };
    }

    const files = fs.readdirSync(downloadPath);
    let totalSize = 0;
    const fileStats = [];

    for (const file of files) {
      const filePath = path.join(downloadPath, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
      fileStats.push({
        name: file,
        size: stats.size,
        created: stats.birthtime
      });
    }

    return {
      count: files.length,
      totalSize,
      files: fileStats
    };
  } catch (error) {
    logger.error(`Error getting download stats: ${error.message}`);
    return { count: 0, totalSize: 0, files: [] };
  }
}
