/**
 * Test script to see what happens after MFA
 * This will help us debug the post-MFA navigation issue
 */

import { chromium } from '@playwright/test';
import { login } from './rpa/lib/login.js';
import { createLogger } from './rpa/lib/logger.js';
import * as dotenv from 'dotenv';

dotenv.config();

const logger = createLogger();

async function testPostMFA() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    logger.info('Starting login test...');

    const credentials = {
      username: process.env.HHAE_USERNAME,
      password: process.env.HHAE_PASSWORD
    };

    // Login with manual MFA
    const loginSuccess = await login(
      page,
      credentials,
      logger,
      { headless: false }
    );

    if (!loginSuccess) {
      logger.error('Login failed');
      return;
    }

    logger.info('✓ Login successful!');

    // Wait a bit and log the current URL
    await page.waitForTimeout(5000);
    const currentUrl = page.url();
    logger.info('='.repeat(60));
    logger.info(`CURRENT URL AFTER LOGIN: ${currentUrl}`);
    logger.info('='.repeat(60));

    // Check if tenant ID is in the URL
    const tenantMatch = currentUrl.match(/\/(ENT\d+)\//);
    if (tenantMatch) {
      logger.info(`✓ Tenant ID found: ${tenantMatch[1]}`);
    } else {
      logger.warn('✗ No tenant ID in URL');
    }

    // Extract base URL
    const baseUrl = new URL(currentUrl).origin;
    logger.info(`Base URL: ${baseUrl}`);

    // Log page title
    const title = await page.title();
    logger.info(`Page title: ${title}`);

    // Keep browser open for inspection
    logger.info('Browser will stay open for 60 seconds for inspection...');
    await page.waitForTimeout(60000);

  } catch (error) {
    logger.error(`Error: ${error.message}`);
    logger.error(error.stack);
  } finally {
    await browser.close();
  }
}

testPostMFA();
