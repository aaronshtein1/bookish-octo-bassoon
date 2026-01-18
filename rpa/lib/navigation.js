import { getScreenshotPath } from './logger.js';

/**
 * Random delay to mimic human behavior
 * @param {number} minMs - Minimum delay in milliseconds
 * @param {number} maxMs - Maximum delay in milliseconds
 */
export async function humanDelay(minMs = 150, maxMs = 600) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Wait for UI to stabilize (no network activity)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForStableUI(page, timeout = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
    await humanDelay(200, 400);
  } catch (error) {
    // Fallback to domcontentloaded if networkidle times out
    await page.waitForLoadState('domcontentloaded', { timeout });
    await humanDelay(500, 800);
  }
}

/**
 * Safe click with retry logic
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - Element selector
 * @param {Object} logger - Logger instance
 * @param {Object} options - Click options
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.timeout - Timeout for click action
 * @returns {Promise<boolean>} Success status
 */
export async function safeClick(page, selector, logger, options = {}) {
  const { maxRetries = 2, timeout = 10000 } = options;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`Retry ${attempt}/${maxRetries} for clicking: ${selector}`);
        await humanDelay(1000, 2000);
      }

      await page.waitForSelector(selector, { state: 'visible', timeout });
      await humanDelay();
      await page.click(selector, { timeout });
      logger.info(`Successfully clicked: ${selector}`);
      return true;
    } catch (error) {
      lastError = error;
      logger.warn(`Click attempt ${attempt + 1} failed for ${selector}: ${error.message}`);
    }
  }

  logger.error(`All click attempts failed for ${selector}: ${lastError.message}`);
  return false;
}

/**
 * Safe fill input with retry logic
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - Element selector
 * @param {string} value - Value to fill
 * @param {Object} logger - Logger instance
 * @param {Object} options - Fill options
 * @returns {Promise<boolean>} Success status
 */
export async function safeFill(page, selector, value, logger, options = {}) {
  const { maxRetries = 2, timeout = 10000 } = options;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`Retry ${attempt}/${maxRetries} for filling: ${selector}`);
        await humanDelay(1000, 2000);
      }

      await page.waitForSelector(selector, { state: 'visible', timeout });
      await humanDelay();
      await page.fill(selector, value, { timeout });
      logger.info(`Successfully filled: ${selector}`);
      return true;
    } catch (error) {
      lastError = error;
      logger.warn(`Fill attempt ${attempt + 1} failed for ${selector}: ${error.message}`);
    }
  }

  logger.error(`All fill attempts failed for ${selector}: ${lastError.message}`);
  return false;
}

/**
 * Fill date range inputs
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} dateSelectors - Date field selectors
 * @param {string} dateSelectors.from - From date selector
 * @param {string} dateSelectors.to - To date selector
 * @param {string} fromDate - From date (YYYY-MM-DD)
 * @param {string} toDate - To date (YYYY-MM-DD)
 * @param {Object} logger - Logger instance
 * @returns {Promise<boolean>} Success status
 */
export async function fillDateRange(page, dateSelectors, fromDate, toDate, logger) {
  logger.info(`Filling date range: ${fromDate} to ${toDate}`);

  const fromSuccess = await safeFill(page, dateSelectors.from, fromDate, logger);
  if (!fromSuccess) return false;

  await humanDelay();

  const toSuccess = await safeFill(page, dateSelectors.to, toDate, logger);
  return toSuccess;
}

/**
 * Detect if session has expired or user is logged out
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} logger - Logger instance
 * @returns {Promise<boolean>} True if logged out
 */
export async function detectLoggedOut(page, logger) {
  const currentUrl = page.url();
  const loggedOutIndicators = [
    '/login',
    '/signin',
    '/auth',
    'session-expired',
    'logged-out'
  ];

  const isLoggedOut = loggedOutIndicators.some(indicator =>
    currentUrl.toLowerCase().includes(indicator)
  );

  if (isLoggedOut) {
    logger.warn(`Session appears to be logged out. Current URL: ${currentUrl}`);
    return true;
  }

  // Check for common logged-out elements
  try {
    const loginButton = await page.$('button:has-text("Login"), button:has-text("Sign In"), input[type="password"]');
    if (loginButton) {
      logger.warn('Detected login form - session may have expired');
      return true;
    }
  } catch (error) {
    // Element not found - likely still logged in
  }

  return false;
}

/**
 * Detect common error states
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} logger - Logger instance
 * @returns {Promise<string|null>} Error message if detected, null otherwise
 */
export async function detectErrorState(page, logger) {
  try {
    // Check for error messages or alerts
    const errorSelectors = [
      '.error-message',
      '.alert-danger',
      '[role="alert"]',
      '.notification-error',
      'text=/error/i',
      'text=/failed/i'
    ];

    for (const selector of errorSelectors) {
      const element = await page.$(selector);
      if (element) {
        const errorText = await element.textContent();
        if (errorText && errorText.trim()) {
          logger.error(`Error detected on page: ${errorText.trim()}`);
          return errorText.trim();
        }
      }
    }
  } catch (error) {
    // No error detected
  }

  return null;
}

/**
 * Take screenshot on failure
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} sessionId - Session identifier
 * @param {string} context - Context of the screenshot
 * @param {Object} logger - Logger instance
 * @returns {Promise<string>} Screenshot path
 */
export async function captureFailureScreenshot(page, sessionId, context, logger) {
  try {
    const screenshotPath = getScreenshotPath(sessionId, context);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    logger.info(`Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    logger.error(`Failed to capture screenshot: ${error.message}`);
    return null;
  }
}

/**
 * Execute action with retry logic
 * @param {Function} action - Async function to execute
 * @param {Object} logger - Logger instance
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum retries
 * @param {string} options.actionName - Name of the action for logging
 * @param {import('@playwright/test').Page} options.page - Page for screenshots
 * @param {string} options.sessionId - Session ID for screenshots
 * @returns {Promise<any>} Result of the action
 */
export async function retryAction(action, logger, options = {}) {
  const {
    maxRetries = 2,
    actionName = 'action',
    page = null,
    sessionId = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`Retry ${attempt}/${maxRetries} for ${actionName}`);
        await humanDelay(2000, 3000);
      }

      const result = await action();
      if (attempt > 0) {
        logger.info(`${actionName} succeeded on retry ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      logger.warn(`${actionName} attempt ${attempt + 1} failed: ${error.message}`);

      // Capture screenshot on failure if page is available
      if (page && sessionId) {
        await captureFailureScreenshot(
          page,
          sessionId,
          `${actionName.replace(/\s/g, '-')}-attempt-${attempt + 1}`,
          logger
        );
      }
    }
  }

  logger.error(`${actionName} failed after ${maxRetries + 1} attempts: ${lastError.message}`);
  throw lastError;
}

/**
 * Navigate through menu sequence
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Array} menuSteps - Array of menu step objects
 * @param {Object} logger - Logger instance
 * @param {string} sessionId - Session ID for screenshots
 * @returns {Promise<boolean>} Success status
 */
export async function navigateMenuSequence(page, menuSteps, logger, sessionId) {
  logger.info(`Navigating through ${menuSteps.length} menu steps`);

  for (let i = 0; i < menuSteps.length; i++) {
    const step = menuSteps[i];
    logger.info(`Menu step ${i + 1}/${menuSteps.length}: ${step.description || step.selector}`);

    try {
      await retryAction(
        async () => {
          if (step.type === 'click') {
            await safeClick(page, step.selector, logger);
          } else if (step.type === 'hover') {
            await page.hover(step.selector);
          }
          await waitForStableUI(page);
        },
        logger,
        {
          actionName: `menu-step-${i + 1}`,
          page,
          sessionId
        }
      );
    } catch (error) {
      logger.error(`Failed to complete menu step ${i + 1}: ${error.message}`);
      await captureFailureScreenshot(page, sessionId, `menu-step-${i + 1}-failed`, logger);
      return false;
    }
  }

  logger.info('Menu navigation completed successfully');
  return true;
}
