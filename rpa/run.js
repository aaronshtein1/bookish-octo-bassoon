#!/usr/bin/env node

import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import { createLogger } from './lib/logger.js';
import { login } from './lib/login.js';
import { setupDownloadDirectory } from './lib/downloads.js';
import { loadReportConfig, runReport } from './lib/reports.js';

// Load environment variables
dotenv.config();

/**
 * Parse command line arguments
 */
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 --report <name> --from <date> --to <date> [options]')
  .option('report', {
    alias: 'r',
    type: 'string',
    description: 'Report name (must match config.yaml)',
    demandOption: true
  })
  .option('from', {
    alias: 'f',
    type: 'string',
    description: 'Start date (YYYY-MM-DD)',
    demandOption: true
  })
  .option('to', {
    alias: 't',
    type: 'string',
    description: 'End date (YYYY-MM-DD)',
    demandOption: true
  })
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to config.yaml',
    default: './rpa/config.yaml'
  })
  .option('headful', {
    type: 'boolean',
    description: 'Run in headful mode (show browser)',
    default: false
  })
  .option('force', {
    type: 'boolean',
    description: 'Force re-download even if file exists',
    default: false
  })
  .option('slow-mo', {
    type: 'number',
    description: 'Slow down operations by N milliseconds',
    default: 0
  })
  .example('$0 --report active_patients_auth --from 2024-01-01 --to 2024-01-31', 'Download report for January 2024')
  .example('$0 --report visits_confirmed_hours --from 2024-01-01 --to 2024-01-31 --headful', 'Download with visible browser')
  .example('$0 --report aide_roster_compliance --from 2024-01-01 --to 2024-01-31 --force', 'Force re-download')
  .help('h')
  .alias('h', 'help')
  .parseSync();

/**
 * Validate date format
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid
 */
function validateDate(dateStr) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }

  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

/**
 * Get credentials from environment
 * @returns {Object} Credentials object
 */
function getCredentials() {
  const username = process.env.HHAE_USERNAME;
  const password = process.env.HHAE_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Missing credentials. Please set HHAE_USERNAME and HHAE_PASSWORD environment variables.\n' +
      'You can create a .env file based on .env.example'
    );
  }

  return { username, password };
}

/**
 * Main execution function
 */
async function main() {
  const sessionId = new Date().toISOString().replace(/[:.]/g, '-');
  const logger = createLogger(sessionId);

  let browser = null;
  let exitCode = 0;

  try {
    // Validate inputs
    logger.info('Validating inputs...');

    if (!validateDate(argv.from)) {
      throw new Error(`Invalid from date: ${argv.from}. Expected format: YYYY-MM-DD`);
    }

    if (!validateDate(argv.to)) {
      throw new Error(`Invalid to date: ${argv.to}. Expected format: YYYY-MM-DD`);
    }

    const fromDate = new Date(argv.from);
    const toDate = new Date(argv.to);

    if (fromDate > toDate) {
      throw new Error('From date must be before or equal to To date');
    }

    logger.info(`Report: ${argv.report}`);
    logger.info(`Date range: ${argv.from} to ${argv.to}`);
    logger.info(`Headful mode: ${argv.headful}`);
    logger.info(`Force re-download: ${argv.force}`);

    // Get credentials
    logger.info('Loading credentials...');
    const credentials = getCredentials();
    logger.info(`Username: ${credentials.username}`);

    // Load configuration
    logger.info('Loading report configuration...');
    const configPath = path.resolve(argv.config);
    const config = loadReportConfig(configPath, logger);

    // Setup download directory
    const downloadPath = setupDownloadDirectory(sessionId);
    logger.info(`Download directory: ${downloadPath}`);

    // Launch browser
    logger.info('Launching browser...');
    browser = await chromium.launch({
      headless: !argv.headful,
      slowMo: argv.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ]
    });

    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Enable downloads
    await context.setDefaultTimeout(30000);

    const page = await context.newPage();
    logger.info('Browser launched successfully');

    // Perform login
    logger.info('Initiating login...');
    const loginSuccess = await login(
      page,
      credentials,
      logger,
      sessionId,
      !argv.headful
    );

    if (!loginSuccess) {
      throw new Error('Login failed');
    }

    // Run report download
    logger.info('Starting report download...');
    const downloadedFile = await runReport(
      page,
      config,
      {
        reportName: argv.report,
        fromDate: argv.from,
        toDate: argv.to,
        downloadPath
      },
      credentials,
      logger,
      sessionId,
      {
        force: argv.force,
        headless: !argv.headful
      }
    );

    logger.info('');
    logger.info('='.repeat(60));
    logger.info('SUCCESS!');
    logger.info('='.repeat(60));
    logger.info(`Report: ${argv.report}`);
    logger.info(`Date range: ${argv.from} to ${argv.to}`);
    logger.info(`Downloaded file: ${downloadedFile}`);
    logger.info(`Session ID: ${sessionId}`);
    logger.info('='.repeat(60));

  } catch (error) {
    logger.error('');
    logger.error('='.repeat(60));
    logger.error('EXECUTION FAILED');
    logger.error('='.repeat(60));
    logger.error(`Error: ${error.message}`);
    logger.error(`Session ID: ${sessionId}`);
    logger.error(`Log file: logs/${sessionId}.log`);
    logger.error('='.repeat(60));

    if (error.stack) {
      logger.error('Stack trace:');
      logger.error(error.stack);
    }

    exitCode = 1;
  } finally {
    // Cleanup
    if (browser) {
      logger.info('Closing browser...');
      await browser.close();
    }

    logger.info('RPA runner completed');
  }

  process.exit(exitCode);
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
