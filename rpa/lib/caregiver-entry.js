/**
 * HHA Exchange Caregiver Entry Module
 * Handles entering caregiver data into HHA Exchange
 */

import {
  humanDelay,
  waitForStableUI,
  safeFill,
  safeClick,
  captureFailureScreenshot
} from './navigation.js';
import { CAREGIVER_CONFIG, extractFieldValue } from '../../caregiver-config.js';

/**
 * Navigate to the Add New Staff page
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} logger - Logger instance
 * @returns {Promise<boolean>} Success status
 */
async function navigateToAddStaff(page, logger) {
  logger.info('Navigating to Add New Caregiver page...');

  const nav = CAREGIVER_CONFIG.hhaExchange.navigationPath;

  try {
    // Wait for page to be ready and navigation to fully load
    await waitForStableUI(page);
    await humanDelay(2000, 3000); // Extra wait for navigation menu to load

    const currentUrl = page.url();
    logger.info(`Current URL before navigation: ${currentUrl}`);

    // Try direct URL navigation first (more reliable than clicking through menus)
    const baseUrl = new URL(currentUrl).origin;

    // Extract tenant ID from current URL (e.g., ENT2507010000)
    const tenantMatch = currentUrl.match(/\/(ENT\d+)\//);
    const tenantId = tenantMatch ? tenantMatch[1] : 'ENT2507010000';

    const directUrls = [
      // Based on the actual HHA Exchange URL structure
      `${baseUrl}/${tenantId}/Aide/AideDetails_ns.aspx`,
      `${baseUrl}/${tenantId}/Aide/AddAide.aspx`,
      `${baseUrl}/${tenantId}/Aide/NewAide.aspx`,
      `${baseUrl}/${tenantId}/Caregiver/CaregiverDetails.aspx`,
      `${baseUrl}/${tenantId}/Caregiver/AddCaregiver.aspx`,
      `${baseUrl}/${tenantId}/Caregiver/NewCaregiver.aspx`,
      // Fallback patterns
      `${baseUrl}/caregiver/new`,
      `${baseUrl}/Caregiver/New`,
      `${baseUrl}/staff/new`,
      `${baseUrl}/Staff/New`
    ];

    for (const url of directUrls) {
      try {
        logger.info(`Attempting direct navigation to: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        await humanDelay(1000, 2000);

        // Check if we landed on a form page
        const hasForm = await page.$('form');
        if (hasForm) {
          logger.info(`✓ Successfully navigated to form via direct URL: ${url}`);
          logger.info(`Current URL: ${page.url()}`);
          return true;
        }
      } catch (e) {
        logger.debug(`Direct URL ${url} failed: ${e.message}`);
      }
    }

    logger.info('Direct URL navigation failed, trying menu navigation...');

    // Fallback to clicking through menus
    // Step 1: Click on the main "Caregiver" menu to open dropdown
    logger.info(`Looking for menu: ${nav.menu}`);

    const menuSelectors = [
      `a[role="menuitem"]:has-text("${nav.menu}")`,
      `a:has-text("${nav.menu}")`,
      `button:has-text("${nav.menu}")`,
      `text="${nav.menu}"`,
      `[aria-label="${nav.menu}"]`,
      `nav a:has-text("${nav.menu}")`,
      `nav button:has-text("${nav.menu}")`,
      `.nav-link:has-text("${nav.menu}")`,
      `[class*="nav"] a:has-text("${nav.menu}")`,
      `header a:has-text("${nav.menu}")`
    ];

    let menuClicked = false;
    for (const selector of menuSelectors) {
      try {
        logger.debug(`Trying selector: ${selector}`);
        // Wait for selector with a longer timeout
        await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          await element.click();
          logger.info(`✓ Clicked main menu: ${nav.menu} using selector: ${selector}`);
          menuClicked = true;
          await humanDelay(500, 1000);
          break;
        }
      } catch (e) {
        logger.debug(`Selector ${selector} not found: ${e.message}`);
        // Try next selector
      }
    }

    if (!menuClicked) {
      logger.error(`Could not find menu: ${nav.menu}`);
      logger.error(`Page title: ${await page.title()}`);
      await captureFailureScreenshot(page, 'nav-error', 'menu-not-found', logger);
      return false;
    }

    // Step 2: Click on "New Caregiver" from the dropdown
    logger.info(`Looking for submenu: ${nav.submenu}`);

    const submenuSelectors = [
      `a:has-text("${nav.submenu}")`,
      `text="${nav.submenu}"`,
      `[role="menuitem"]:has-text("${nav.submenu}")`,
      `.dropdown-item:has-text("${nav.submenu}")`,
      `li:has-text("${nav.submenu}")`
    ];

    let submenuClicked = false;
    for (const selector of submenuSelectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          await element.click();
          logger.info(`✓ Clicked submenu: ${nav.submenu}`);
          submenuClicked = true;
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!submenuClicked) {
      logger.error(`Could not find submenu: ${nav.submenu}`);
      await captureFailureScreenshot(page, 'nav-error', 'submenu-not-found', logger);
      return false;
    }

    // Wait for the form to load
    await waitForStableUI(page);
    await humanDelay(1000, 2000);

    logger.info('✓ Navigation complete - ready to enter caregiver data');
    logger.info(`Current URL: ${page.url()}`);

    return true;

  } catch (error) {
    logger.error(`Navigation failed: ${error.message}`);
    await captureFailureScreenshot(page, 'nav-error', 'navigation-failed', logger);
    return false;
  }
}

/**
 * Fill caregiver form in HHA Exchange
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} caregiver - Caregiver data object
 * @param {Object} logger - Logger instance
 * @param {string} sessionId - Session ID for screenshots
 * @returns {Promise<boolean>} Success status
 */
async function fillCaregiverForm(page, caregiver, logger, sessionId) {
  logger.info(`Filling form for caregiver: ${caregiver.applicantName}`);

  const fields = CAREGIVER_CONFIG.hhaExchange.fields;

  for (const [fieldName, fieldConfig] of Object.entries(fields)) {
    const value = extractFieldValue(caregiver, fieldConfig);

    // Skip empty non-required fields
    if (!value && !fieldConfig.required) {
      logger.debug(`Skipping optional field: ${fieldName}`);
      continue;
    }

    // Log if required field is missing
    if (!value && fieldConfig.required) {
      logger.warn(`Required field ${fieldName} is missing value!`);
      continue;
    }

    logger.info(`Filling ${fieldName}: ${fieldConfig.type === 'password' ? '***' : value}`);

    // Fill the field based on type
    if (fieldConfig.type === 'checkbox') {
      // Handle checkbox - value should be boolean
      try {
        const checkbox = await page.$(fieldConfig.selector);
        if (checkbox) {
          const isChecked = await checkbox.isChecked();
          const shouldBeChecked = Boolean(value);

          if (isChecked !== shouldBeChecked) {
            await checkbox.click();
            logger.info(`${shouldBeChecked ? 'Checked' : 'Unchecked'} ${fieldName}`);
          }
        } else {
          logger.warn(`Checkbox ${fieldName} not found`);
        }
      } catch (e) {
        logger.warn(`Could not handle checkbox ${fieldName}: ${e.message}`);
      }
    } else if (fieldConfig.type === 'dropdown' || fieldConfig.type === 'select') {
      // For dropdowns, try to select the option
      try {
        await page.selectOption(fieldConfig.selector, value);
        logger.info(`Selected ${fieldName}: ${value}`);
      } catch (e) {
        logger.warn(`Could not select dropdown ${fieldName}: ${e.message}`);
        // Try clicking and typing instead
        const success = await safeFill(page, fieldConfig.selector, value, logger);
        if (!success) {
          logger.error(`Failed to fill ${fieldName}`);
          if (fieldConfig.required) {
            return false;
          }
        }
      }
    } else {
      // Regular text input (includes phone-part type)
      const success = await safeFill(page, fieldConfig.selector, value, logger);
      if (!success) {
        logger.error(`Failed to fill required field: ${fieldName}`);
        if (fieldConfig.required) {
          await captureFailureScreenshot(page, sessionId, `fill-${fieldName}-failed`, logger);
          return false;
        }
      }
    }

    await humanDelay(200, 500);
  }

  logger.info('Form filling complete');
  return true;
}

/**
 * Submit the caregiver form
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} logger - Logger instance
 * @param {string} sessionId - Session ID for screenshots
 * @returns {Promise<boolean>} Success status
 */
async function submitCaregiverForm(page, logger, sessionId) {
  logger.info('Submitting caregiver form...');

  const submitSelector = CAREGIVER_CONFIG.hhaExchange.submitButton;

  const success = await safeClick(page, submitSelector, logger);

  if (!success) {
    logger.error('Failed to click submit button');
    await captureFailureScreenshot(page, sessionId, 'submit-failed', logger);
    return false;
  }

  // Wait for submission to process
  await humanDelay(2000, 3000);
  await waitForStableUI(page);

  return true;
}

/**
 * Verify caregiver was successfully added
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} logger - Logger instance
 * @returns {Promise<boolean>} Success status
 */
async function verifyCaregiverAdded(page, logger) {
  logger.info('Verifying caregiver was added successfully...');

  const successIndicators = CAREGIVER_CONFIG.hhaExchange.successIndicators;

  for (const indicator of successIndicators) {
    try {
      const element = await page.$(indicator);
      if (element && await element.isVisible()) {
        logger.info(`Success confirmed via indicator: ${indicator}`);
        return true;
      }
    } catch (e) {
      // Continue checking other indicators
    }
  }

  // Check if still on form page (might indicate error)
  const currentUrl = page.url();
  logger.info(`Current URL after submit: ${currentUrl}`);

  // If we can't confirm success, check for error messages
  const errorSelectors = [
    '.error',
    '.alert-danger',
    '[role="alert"]',
    'text=/error/i',
    'text=/invalid/i'
  ];

  for (const selector of errorSelectors) {
    try {
      const element = await page.$(selector);
      if (element && await element.isVisible()) {
        const errorText = await element.textContent();
        logger.error(`Error message found: ${errorText}`);
        return false;
      }
    } catch (e) {
      // Continue checking
    }
  }

  // If no success or error indicators found, assume success
  logger.warn('Could not confirm success, but no errors detected either');
  return true;
}

/**
 * Enter a single caregiver into HHA Exchange
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} caregiver - Caregiver data object
 * @param {Object} logger - Logger instance
 * @param {string} sessionId - Session ID for screenshots
 * @returns {Promise<boolean>} Success status
 */
export async function enterCaregiver(page, caregiver, logger, sessionId) {
  try {
    logger.info('='.repeat(60));
    logger.info(`ENTERING CAREGIVER: ${caregiver.applicantName}`);
    logger.info('='.repeat(60));

    // Step 1: Navigate to Add Staff page
    const navSuccess = await navigateToAddStaff(page, logger);
    if (!navSuccess) {
      logger.warn('Navigation may have failed, but continuing...');
    }

    // Step 2: Fill the form
    const fillSuccess = await fillCaregiverForm(page, caregiver, logger, sessionId);
    if (!fillSuccess) {
      logger.error('Form filling failed');
      return false;
    }

    // Step 3: Submit the form
    const submitSuccess = await submitCaregiverForm(page, logger, sessionId);
    if (!submitSuccess) {
      logger.error('Form submission failed');
      return false;
    }

    // Step 4: Verify success
    const verifySuccess = await verifyCaregiverAdded(page, logger);
    if (!verifySuccess) {
      logger.error('Could not verify caregiver was added');
      return false;
    }

    logger.info(`✓ Successfully entered caregiver: ${caregiver.applicantName}`);
    return true;

  } catch (error) {
    logger.error(`Error entering caregiver: ${error.message}`);
    await captureFailureScreenshot(page, sessionId, 'caregiver-entry-error', logger);
    return false;
  }
}
