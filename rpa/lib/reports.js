import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import {
  humanDelay,
  waitForStableUI,
  navigateMenuSequence,
  fillDateRange,
  safeClick,
  captureFailureScreenshot,
  retryAction
} from './navigation.js';
import {
  checkExistingDownload,
  triggerAndWaitForDownload
} from './downloads.js';
import { ensureLoggedIn } from './login.js';

/**
 * Load report configurations from YAML file
 * @param {string} configPath - Path to config.yaml
 * @param {Object} logger - Logger instance
 * @returns {Object} Report configurations
 */
export function loadReportConfig(configPath, logger) {
  try {
    logger.info(`Loading report config from: ${configPath}`);
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents);
    logger.info(`Loaded ${Object.keys(config.reports || {}).length} report definitions`);
    return config;
  } catch (error) {
    logger.error(`Failed to load config: ${error.message}`);
    throw error;
  }
}

/**
 * Get specific report definition
 * @param {Object} config - Full configuration object
 * @param {string} reportName - Name of the report
 * @param {Object} logger - Logger instance
 * @returns {Object} Report definition
 */
export function getReportDefinition(config, reportName, logger) {
  if (!config.reports || !config.reports[reportName]) {
    throw new Error(`Report "${reportName}" not found in configuration`);
  }

  const report = config.reports[reportName];
  logger.info(`Retrieved configuration for report: ${reportName}`);
  return report;
}

/**
 * Validate report definition has required fields
 * @param {Object} reportDef - Report definition
 * @param {string} reportName - Report name
 * @param {Object} logger - Logger instance
 * @returns {boolean} Validation result
 */
export function validateReportDefinition(reportDef, reportName, logger) {
  const requiredFields = [
    'start_url',
    'menu_steps',
    'date_range_selectors',
    'download_trigger',
    'expected_filename_regex'
  ];

  for (const field of requiredFields) {
    if (!reportDef[field]) {
      logger.error(`Report "${reportName}" missing required field: ${field}`);
      return false;
    }
  }

  logger.info(`Report definition for "${reportName}" validated successfully`);
  return true;
}

/**
 * Execute report download flow
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} reportDef - Report definition
 * @param {Object} params - Report parameters
 * @param {string} params.reportName - Report name
 * @param {string} params.fromDate - From date (YYYY-MM-DD)
 * @param {string} params.toDate - To date (YYYY-MM-DD)
 * @param {string} params.downloadPath - Download directory path
 * @param {Object} credentials - Login credentials
 * @param {Object} logger - Logger instance
 * @param {string} sessionId - Session ID
 * @param {boolean} headless - Whether running in headless mode
 * @returns {Promise<string>} Path to downloaded file
 */
export async function executeReportDownload(
  page,
  reportDef,
  params,
  credentials,
  logger,
  sessionId,
  headless
) {
  const { reportName, fromDate, toDate, downloadPath } = params;

  logger.info('='.repeat(60));
  logger.info(`Starting report download: ${reportName}`);
  logger.info(`Date range: ${fromDate} to ${toDate}`);
  logger.info('='.repeat(60));

  try {
    // Step 1: Ensure we're logged in
    logger.info('Step 1: Verifying login session...');
    const isLoggedIn = await ensureLoggedIn(page, credentials, logger, sessionId, headless);
    if (!isLoggedIn) {
      throw new Error('Failed to establish login session');
    }

    // Step 2: Navigate to report start URL
    logger.info(`Step 2: Navigating to report page: ${reportDef.start_url}`);
    await retryAction(
      async () => {
        await page.goto(reportDef.start_url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        await waitForStableUI(page);
      },
      logger,
      {
        actionName: 'navigate-to-report-page',
        page,
        sessionId
      }
    );

    // Step 3: Navigate menu sequence (if configured)
    if (reportDef.menu_steps && reportDef.menu_steps.length > 0) {
      logger.info(`Step 3: Navigating menu (${reportDef.menu_steps.length} steps)...`);
      const menuSuccess = await navigateMenuSequence(
        page,
        reportDef.menu_steps,
        logger,
        sessionId
      );

      if (!menuSuccess) {
        throw new Error('Failed to navigate menu sequence');
      }
    } else {
      logger.info('Step 3: Skipping menu navigation (not configured)');
    }

    // Step 4: Fill date range
    if (reportDef.date_range_selectors) {
      logger.info('Step 4: Filling date range...');
      const dateSuccess = await retryAction(
        async () => {
          return await fillDateRange(
            page,
            reportDef.date_range_selectors,
            fromDate,
            toDate,
            logger
          );
        },
        logger,
        {
          actionName: 'fill-date-range',
          page,
          sessionId
        }
      );

      if (!dateSuccess) {
        throw new Error('Failed to fill date range');
      }
    } else {
      logger.info('Step 4: Skipping date range (not configured)');
    }

    // Step 5: Click run/generate button if configured
    if (reportDef.run_button_selector) {
      logger.info('Step 5: Clicking run/generate button...');
      await retryAction(
        async () => {
          await safeClick(page, reportDef.run_button_selector, logger);
          await waitForStableUI(page, 10000); // Reports may take time to generate
        },
        logger,
        {
          actionName: 'click-run-button',
          page,
          sessionId
        }
      );
    } else {
      logger.info('Step 5: Skipping run button (not configured)');
    }

    // Step 6: Trigger download
    logger.info('Step 6: Triggering download...');
    const expectedFilenameRegex = new RegExp(reportDef.expected_filename_regex);

    const downloadedFile = await retryAction(
      async () => {
        return await triggerAndWaitForDownload(
          page,
          reportDef.download_trigger,
          expectedFilenameRegex,
          downloadPath,
          logger
        );
      },
      logger,
      {
        actionName: 'trigger-download',
        maxRetries: 1, // Downloads are less retry-friendly
        page,
        sessionId
      }
    );

    // Step 7: Validate download (if validation rules exist)
    if (reportDef.validation) {
      logger.info('Step 7: Validating downloaded file...');
      await validateDownloadedFile(downloadedFile, reportDef.validation, logger);
    } else {
      logger.info('Step 7: Skipping validation (not configured)');
    }

    logger.info('='.repeat(60));
    logger.info(`Report download completed successfully: ${reportName}`);
    logger.info(`File: ${downloadedFile}`);
    logger.info('='.repeat(60));

    return downloadedFile;
  } catch (error) {
    logger.error(`Report download failed: ${error.message}`);
    await captureFailureScreenshot(page, sessionId, `report-${reportName}-failed`, logger);
    throw error;
  }
}

/**
 * Validate downloaded file content
 * @param {string} filePath - Path to downloaded file
 * @param {Object} validationRules - Validation rules
 * @param {Object} logger - Logger instance
 * @returns {Promise<boolean>} Validation result
 */
async function validateDownloadedFile(filePath, validationRules, logger) {
  logger.info('Running validation checks...');

  try {
    // Check required columns (for CSV files)
    if (validationRules.required_columns) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const firstLine = fileContent.split('\n')[0];

      for (const column of validationRules.required_columns) {
        if (!firstLine.includes(column)) {
          logger.warn(`Validation warning: Expected column "${column}" not found in header`);
        } else {
          logger.info(`Column "${column}" found`);
        }
      }
    }

    // Check minimum row count
    if (validationRules.min_rows) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      const rowCount = lines.length - 1; // Subtract header

      if (rowCount < validationRules.min_rows) {
        logger.warn(
          `Validation warning: Expected at least ${validationRules.min_rows} rows, found ${rowCount}`
        );
      } else {
        logger.info(`Row count validation passed: ${rowCount} rows`);
      }
    }

    logger.info('Validation checks completed');
    return true;
  } catch (error) {
    logger.error(`Validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Run report with idempotency check
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} config - Full configuration
 * @param {Object} params - Report parameters
 * @param {Object} credentials - Login credentials
 * @param {Object} logger - Logger instance
 * @param {string} sessionId - Session ID
 * @param {Object} options - Additional options
 * @param {boolean} options.force - Force re-download even if exists
 * @param {boolean} options.headless - Headless mode
 * @returns {Promise<string>} Path to downloaded file
 */
export async function runReport(page, config, params, credentials, logger, sessionId, options = {}) {
  const { reportName, downloadPath } = params;
  const { force = false, headless = true } = options;

  // Get and validate report definition
  const reportDef = getReportDefinition(config, reportName, logger);
  const isValid = validateReportDefinition(reportDef, reportName, logger);

  if (!isValid) {
    throw new Error(`Invalid report definition for "${reportName}"`);
  }

  // Check for existing download (idempotency)
  if (!force) {
    const expectedFilenameRegex = new RegExp(reportDef.expected_filename_regex);
    const existingFile = checkExistingDownload(downloadPath, expectedFilenameRegex, logger);

    if (existingFile) {
      logger.info('Existing download found and --force not specified');
      logger.info(`Using existing file: ${existingFile}`);
      return existingFile;
    }
  } else {
    logger.info('Force mode enabled, will re-download even if file exists');
  }

  // Execute the download
  return await executeReportDownload(
    page,
    reportDef,
    params,
    credentials,
    logger,
    sessionId,
    headless
  );
}
