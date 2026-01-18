/**
 * Test script to capture the Add New Caregiver page URL
 * This will login, pause, and let the user manually navigate to the form
 * Then we can capture the exact URL to use in the automation
 */

import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import { createLogger } from './rpa/lib/logger.js';
import { login } from './rpa/lib/login.js';
import readline from 'readline';

dotenv.config();

async function captureFormUrl() {
  const logger = createLogger('test-navigation');
  const sessionId = new Date().toISOString().replace(/[:.]/g, '-');

  logger.info('Starting test to capture Add New Caregiver URL...');
  logger.info('');

  const browser = await chromium.launch({
    headless: false,  // Must be visible
    slowMo: 500
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Login
    const credentials = {
      username: process.env.HHAE_USERNAME,
      password: process.env.HHAE_PASSWORD
    };

    logger.info('Logging in...');
    const loginSuccess = await login(page, credentials, logger, sessionId, false);

    if (!loginSuccess) {
      logger.error('Login failed!');
      await browser.close();
      return;
    }

    logger.info('✓ Login successful!');
    logger.info('');
    logger.info('='.repeat(70));
    logger.info('MANUAL STEP REQUIRED:');
    logger.info('='.repeat(70));
    logger.info('1. In the browser window that just opened:');
    logger.info('   - Click on "Caregiver" in the navigation menu');
    logger.info('   - Click on "New Caregiver" from the dropdown');
    logger.info('   - Wait for the form page to fully load');
    logger.info('');
    logger.info('2. When you can see the Add New Caregiver form, press ENTER here...');
    logger.info('='.repeat(70));
    logger.info('');

    // Wait for user to navigate manually
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise((resolve) => {
      rl.question('Press ENTER when you are on the Add New Caregiver form: ', () => {
        rl.close();
        resolve();
      });
    });

    // Capture the URL
    const formUrl = page.url();
    logger.info('');
    logger.info('='.repeat(70));
    logger.info('CAPTURED FORM URL:');
    logger.info(formUrl);
    logger.info('='.repeat(70));
    logger.info('');
    logger.info('Copy this URL and paste it below when prompted...');
    logger.info('');

    // Parse URL to determine the pattern
    const url = new URL(formUrl);
    logger.info('URL Components:');
    logger.info(`  Origin: ${url.origin}`);
    logger.info(`  Pathname: ${url.pathname}`);
    logger.info(`  Search: ${url.search}`);
    logger.info('');

    // Show what to update
    logger.info('='.repeat(70));
    logger.info('NEXT STEPS:');
    logger.info('='.repeat(70));
    logger.info('Update rpa/lib/caregiver-entry.js with this direct URL:');
    logger.info('');
    logger.info('In the navigateToAddStaff() function, replace the directUrls array with:');
    logger.info('');
    logger.info('const directUrls = [');
    logger.info(`  '${formUrl}'`);
    logger.info('];');
    logger.info('');
    logger.info('This will make navigation much more reliable!');
    logger.info('='.repeat(70));

    // Keep browser open for inspection
    logger.info('');
    logger.info('Press ENTER to close the browser...');
    await new Promise((resolve) => {
      const rl2 = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl2.question('', () => {
        rl2.close();
        resolve();
      });
    });

  } catch (error) {
    logger.error(`Error: ${error.message}`);
    logger.error(error.stack);
  } finally {
    await browser.close();
    logger.info('Test complete!');
  }
}

captureFormUrl();
