#!/usr/bin/env node

/**
 * Caregiver Onboarding RPA
 * Fetches caregivers from Monday.com and enters them into HHA Exchange
 */

import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createLogger } from './rpa/lib/logger.js';
import { login } from './rpa/lib/login.js';
import { getCaregiversReadyForEntry, markCaregiverAsEntered } from './rpa/lib/monday.js';
import { enterCaregiver } from './rpa/lib/caregiver-entry.js';
import { CAREGIVER_CONFIG } from './caregiver-config.js';

dotenv.config();

/**
 * Parse command line arguments
 */
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .option('headful', {
    type: 'boolean',
    description: 'Run in headful mode (show browser)',
    default: false
  })
  .option('slow-mo', {
    type: 'number',
    description: 'Slow down operations by N milliseconds',
    default: 0
  })
  .option('dry-run', {
    type: 'boolean',
    description: 'Test run - fetch caregivers but don\'t enter into HHA Exchange',
    default: false
  })
  .option('limit', {
    type: 'number',
    description: 'Maximum number of caregivers to process',
    default: null
  })
  .example('$0 --headful', 'Run with visible browser')
  .example('$0 --dry-run', 'Fetch caregivers but don\'t enter them')
  .example('$0 --limit 5', 'Process only first 5 caregivers')
  .help('h')
  .alias('h', 'help')
  .parseSync();

/**
 * Get credentials from environment
 */
function getCredentials() {
  const username = process.env.HHAE_USERNAME;
  const password = process.env.HHAE_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Missing HHA Exchange credentials. Please set HHAE_USERNAME and HHAE_PASSWORD in .env file'
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
  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    caregivers: []
  };

  try {
    logger.info('='.repeat(60));
    logger.info('CAREGIVER ONBOARDING RPA');
    logger.info('='.repeat(60));
    logger.info('');

    // Step 1: Fetch caregivers from Monday.com
    logger.info('Step 1: Fetching caregivers from Monday.com...');

    const mondayConfig = CAREGIVER_CONFIG.monday;
    const caregivers = await getCaregiversReadyForEntry(
      mondayConfig.boardId,
      mondayConfig.statusColumnId,
      mondayConfig.readyStatusValue,
      mondayConfig.columnMapping,
      logger
    );

    results.total = caregivers.length;

    if (caregivers.length === 0) {
      logger.info('No caregivers found with status "Active"');
      logger.info('Nothing to do. Exiting...');
      return;
    }

    // Apply limit if specified
    const caregiversToProcess = argv.limit
      ? caregivers.slice(0, argv.limit)
      : caregivers;

    logger.info(`Found ${caregivers.length} caregiver(s) ready for entry`);
    if (argv.limit && caregivers.length > argv.limit) {
      logger.info(`Limiting to first ${argv.limit} caregiver(s)`);
    }
    logger.info('');

    caregivers.forEach((cg, index) => {
      logger.info(`  [${index + 1}] ${cg.applicantName} (${cg.email})`);
    });
    logger.info('');

    if (argv.dryRun) {
      logger.info('DRY RUN MODE - Not entering into HHA Exchange');
      logger.info('Exiting...');
      return;
    }

    // Step 2: Login to HHA Exchange
    logger.info('Step 2: Logging into HHA Exchange...');

    const credentials = getCredentials();

    browser = await chromium.launch({
      headless: !argv.headful,
      slowMo: argv.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    await context.setDefaultTimeout(30000);
    const page = await context.newPage();

    const loginSuccess = await login(
      page,
      credentials,
      logger,
      sessionId,
      !argv.headful
    );

    if (!loginSuccess) {
      throw new Error('Login to HHA Exchange failed');
    }

    logger.info('Successfully logged into HHA Exchange');
    logger.info('');

    // Step 3: Enter each caregiver
    logger.info('Step 3: Entering caregivers into HHA Exchange...');
    logger.info('');

    for (let i = 0; i < caregiversToProcess.length; i++) {
      const caregiver = caregiversToProcess[i];

      logger.info(`Processing ${i + 1}/${caregiversToProcess.length}...`);

      const entrySuccess = await enterCaregiver(page, caregiver, logger, sessionId);

      if (entrySuccess) {
        results.successful++;
        results.caregivers.push({
          name: caregiver.applicantName,
          status: 'success'
        });

        // Update Monday.com status
        try {
          logger.info('Updating Monday.com status...');
          await markCaregiverAsEntered(
            mondayConfig.boardId,
            caregiver.mondayItemId,
            mondayConfig.statusColumnId,
            mondayConfig.completedStatusValue,
            logger
          );
          logger.info('Monday.com status updated');
        } catch (mondayError) {
          logger.warn(`Failed to update Monday.com: ${mondayError.message}`);
          logger.warn('Caregiver was entered, but Monday.com status not updated');
        }
      } else {
        results.failed++;
        results.caregivers.push({
          name: caregiver.applicantName,
          status: 'failed'
        });
      }

      logger.info('');
    }

    // Step 4: Summary
    logger.info('');
    logger.info('='.repeat(60));
    logger.info('CAREGIVER ONBOARDING COMPLETE');
    logger.info('='.repeat(60));
    logger.info(`Total caregivers processed: ${results.total}`);
    logger.info(`Successfully entered: ${results.successful}`);
    logger.info(`Failed: ${results.failed}`);
    logger.info('');

    results.caregivers.forEach((cg, index) => {
      const status = cg.status === 'success' ? '✓' : '✗';
      logger.info(`  ${status} ${cg.name}`);
    });

    logger.info('='.repeat(60));
    logger.info(`Session ID: ${sessionId}`);
    logger.info(`Log file: logs/${sessionId}.log`);
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
      if (argv.keepOpen) {
        logger.info('Browser will remain open (--keep-open flag set)');
        logger.info('Press Ctrl+C to close when done');
        // Keep the process alive
        await new Promise(() => {});
      } else {
        logger.info('Closing browser...');
        await browser.close();
      }
    }

    logger.info('RPA completed');
  }

  process.exit(exitCode);
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
