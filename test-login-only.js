#!/usr/bin/env node

/**
 * Test login functionality only
 * This verifies that login works before testing the full report automation
 */

import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import { createLogger } from './rpa/lib/logger.js';
import { login } from './rpa/lib/login.js';

dotenv.config();

async function testLogin() {
  const sessionId = new Date().toISOString().replace(/[:.]/g, '-');
  const logger = createLogger(sessionId);

  console.log('='.repeat(60));
  console.log('LOGIN TEST');
  console.log('='.repeat(60));
  console.log('');

  const username = process.env.HHAE_USERNAME;
  const password = process.env.HHAE_PASSWORD;

  if (!username || !password) {
    console.error('ERROR: HHAE_USERNAME and HHAE_PASSWORD must be set in .env file');
    process.exit(1);
  }

  logger.info('Launching browser...');
  const browser = await chromium.launch({
    headless: false,  // Show browser so you can see what happens
    slowMo: 500
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    logger.info('Testing login...');
    const loginSuccess = await login(
      page,
      { username, password },
      logger,
      sessionId,
      false  // headless = false (running in headful mode)
    );

    if (loginSuccess) {
      logger.info('');
      logger.info('='.repeat(60));
      logger.info('✓ LOGIN TEST PASSED');
      logger.info('='.repeat(60));
      logger.info('Current URL: ' + page.url());
      logger.info('');
      logger.info('The browser will stay open for 15 seconds so you can:');
      logger.info('1. Verify you are logged in');
      logger.info('2. Navigate to Reports menu and inspect selectors');
      logger.info('3. Note down the report page structure');
      logger.info('='.repeat(60));

      // Keep browser open for inspection
      await page.waitForTimeout(15000);

    } else {
      logger.error('');
      logger.error('='.repeat(60));
      logger.error('✗ LOGIN TEST FAILED');
      logger.error('='.repeat(60));
      logger.error('Please check the browser window and logs for details');
      logger.error(`Log file: logs/${sessionId}.log`);
    }

  } catch (error) {
    logger.error('Error during login test:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    logger.info('Browser closed');
  }
}

testLogin().catch(console.error);
