/**
 * Test script to capture the exact office dropdown HTML
 */

import { chromium } from '@playwright/test';
import { login } from './rpa/lib/login.js';
import { createLogger } from './rpa/lib/logger.js';
import * as dotenv from 'dotenv';

dotenv.config();

const logger = createLogger();

async function testOfficeDropdown() {
  let browser;

  try {
    browser = await chromium.launch({
      headless: false,
      slowMo: 500
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    logger.info('Starting test...');

    const credentials = {
      username: process.env.HHAE_USERNAME,
      password: process.env.HHAE_PASSWORD
    };

    // Login
    const loginSuccess = await login(
      page,
      credentials,
      logger,
      'test',
      false
    );

    if (!loginSuccess) {
      logger.error('Login failed');
      await browser.close();
      return;
    }

    logger.info('Login successful, waiting a moment before navigation...');
    await page.waitForTimeout(2000);

    // Navigate to form
    const currentUrl = page.url();
    logger.info(`Current URL after login: ${currentUrl}`);

    const baseUrl = new URL(currentUrl).origin;
    const tenantMatch = currentUrl.match(/\/(ENT\d+)\//);
    const tenantId = tenantMatch ? tenantMatch[1] : 'ENT2507010000';
    const formUrl = `${baseUrl}/${tenantId}/Aide/AideDetails_ns.aspx`;

    logger.info(`Navigating to: ${formUrl}`);
    await page.goto(formUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Find the office dropdown element
    logger.info('Looking for office dropdown...');

    // Try to find the select element
    const selectElement = await page.$('select[id*="Office" i]');
    if (selectElement) {
      const outerHTML = await selectElement.evaluate(el => el.outerHTML);
      logger.info('Found select element:');
      logger.info(outerHTML);

      const id = await selectElement.evaluate(el => el.id);
      logger.info(`Select ID: ${id}`);

      // Look for wrapper
      const wrapper = await page.$(`#${id}_wrapper, [data-for="${id}"], div:has(> #${id})`);
      if (wrapper) {
        const wrapperHTML = await wrapper.evaluate(el => el.outerHTML.substring(0, 500));
        logger.info('Found wrapper:');
        logger.info(wrapperHTML);
      }
    }

    // Look for any element with "Office" label
    logger.info('Looking for Office label...');
    const labels = await page.$$('label');
    for (const label of labels) {
      const text = await label.textContent();
      if (text && text.toLowerCase().includes('office')) {
        logger.info(`Found label: ${text}`);
        const forAttr = await label.evaluate(el => el.getAttribute('for'));
        logger.info(`Label 'for' attribute: ${forAttr}`);

        if (forAttr) {
          const targetElement = await page.$(`#${forAttr}`);
          if (targetElement) {
            const targetHTML = await targetElement.evaluate(el => el.outerHTML);
            logger.info('Target element:');
            logger.info(targetHTML);
          }
        }
        break;
      }
    }

    // Keep browser open
    logger.info('Browser will stay open for 120 seconds for inspection...');
    logger.info('Please manually click on the office dropdown and observe what happens');
    await page.waitForTimeout(120000);

  } catch (error) {
    logger.error(`Error: ${error.message}`);
    logger.error(error.stack);
  } finally {
    if (browser) {
      logger.info('Closing browser...');
      await browser.close();
    }
  }
}

testOfficeDropdown();
