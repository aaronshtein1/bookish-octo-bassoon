import readline from 'readline';
import {
  humanDelay,
  waitForStableUI,
  safeFill,
  safeClick,
  captureFailureScreenshot,
  detectLoggedOut
} from './navigation.js';
import { getMFACodeFromEmail } from './mfa-email.js';

/**
 * Login configuration
 */
const LOGIN_CONFIG = {
  url: 'https://app.hhaexchange.com/identity/account/login',
  selectors: {
    username: 'input[name="Username"], input#Username',
    password: 'input[type="password"], input[name="Password"], input#Password',
    submitButton: 'input[type="submit"], button[type="submit"]',
    // Indicators that we've successfully logged in
    loggedInIndicators: [
      '.dashboard',
      '.main-nav',
      'text=/Welcome/i',
      '[data-testid="user-menu"]'
    ],
    // MFA indicators
    mfaIndicators: [
      'input[name="code"]',
      'input[name="Code"]',
      'input[name="mfa"]',
      'input[name="verification"]',
      'input[type="text"][placeholder*="code" i]',
      'text=/verification code/i',
      'text=/two-factor/i',
      'text=/enter code/i',
      'text=/security code/i'
    ]
  },
  timeouts: {
    pageLoad: 30000,
    loginSubmit: 15000,
    mfaDetection: 5000,
    landingPage: 60000
  }
};

/**
 * Prompt user for manual MFA completion
 * @param {Object} logger - Logger instance
 * @returns {Promise<void>}
 */
async function promptForMFA(logger) {
  logger.info('='.repeat(60));
  logger.info('MFA DETECTED - Human Intervention Required');
  logger.info('='.repeat(60));
  logger.info('Please complete the MFA challenge in the browser window.');
  logger.info('Press ENTER when you have completed MFA and reached the landing page...');
  logger.info('='.repeat(60));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('', () => {
      rl.close();
      logger.info('Continuing automation...');
      resolve();
    });
  });
}

/**
 * Detect if MFA is required
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} logger - Logger instance
 * @returns {Promise<boolean>} True if MFA detected
 */
async function detectMFA(page, logger) {
  try {
    // Check URL first - most reliable
    const currentUrl = page.url();
    if (currentUrl.includes('/mfa/') || currentUrl.includes('/2fa/') || currentUrl.includes('/verify')) {
      logger.info(`MFA detected via URL: ${currentUrl}`);
      return true;
    }

    // Check for MFA form elements
    for (const selector of LOGIN_CONFIG.selectors.mfaIndicators) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          logger.info(`MFA detected via selector: ${selector}`);
          return true;
        }
      }
    }
  } catch (error) {
    logger.debug(`MFA detection check failed: ${error.message}`);
  }

  return false;
}

/**
 * Wait for landing page after login
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} logger - Logger instance
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} True if landing page detected
 */
async function waitForLandingPage(page, logger, timeout = 60000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const currentUrl = page.url();

    // Check if we're on the home page (post-MFA landing page)
    if (currentUrl.includes('/Common/Home_ns.aspx') || currentUrl.includes('/Home')) {
      logger.info(`Landing page detected via URL: ${currentUrl}`);
      return true;
    }

    // Check if URL no longer contains MFA indicators
    if (!currentUrl.includes('/mfa/') && !currentUrl.includes('login') && !currentUrl.includes('signin')) {
      // Also verify we're not logged out
      const loggedOut = await detectLoggedOut(page, logger);
      if (!loggedOut) {
        logger.info('Landing page detected via URL change (no longer on MFA/login page)');
        return true;
      }
    }

    // Check for logged-in indicators as fallback
    for (const selector of LOGIN_CONFIG.selectors.loggedInIndicators) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            logger.info(`Landing page detected via selector: ${selector}`);
            return true;
          }
        }
      } catch (error) {
        // Continue checking
      }
    }

    await humanDelay(500, 1000);
  }

  logger.warn('Landing page not detected within timeout');
  return false;
}

/**
 * Perform login with username and password
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {Object} logger - Logger instance
 * @param {string} sessionId - Session ID for screenshots
 * @returns {Promise<boolean>} Success status
 */
async function performCredentialEntry(page, username, password, logger, sessionId) {
  logger.info('Entering credentials...');

  // Fill username
  const usernameSuccess = await safeFill(
    page,
    LOGIN_CONFIG.selectors.username,
    username,
    logger
  );

  if (!usernameSuccess) {
    await captureFailureScreenshot(page, sessionId, 'login-username-failed', logger);
    return false;
  }

  await humanDelay();

  // Fill password
  const passwordSuccess = await safeFill(
    page,
    LOGIN_CONFIG.selectors.password,
    password,
    logger
  );

  if (!passwordSuccess) {
    await captureFailureScreenshot(page, sessionId, 'login-password-failed', logger);
    return false;
  }

  await humanDelay();

  // Click submit button
  logger.info('Submitting login form...');
  const submitSuccess = await safeClick(
    page,
    LOGIN_CONFIG.selectors.submitButton,
    logger
  );

  if (!submitSuccess) {
    await captureFailureScreenshot(page, sessionId, 'login-submit-failed', logger);
    return false;
  }

  return true;
}

/**
 * Handle MFA flow with automatic email code retrieval or manual fallback
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} logger - Logger instance
 * @param {boolean} headless - Whether running in headless mode
 * @returns {Promise<boolean>} Success status
 */
async function handleMFA(page, logger, headless) {
  logger.info('Attempting automatic MFA code retrieval from email...');

  // Try to get MFA code from email
  const mfaCode = await getMFACodeFromEmail(logger);

  if (mfaCode) {
    // Automatic MFA: Enter code programmatically
    logger.info('Entering MFA code automatically...');

    try {
      // Find and fill MFA code input field
      const codeInputSelectors = [
        'input[name="Code"]',
        'input[name="code"]',
        'input[type="text"]',
        'input[placeholder*="code" i]',
        'input[placeholder*="verification" i]'
      ];

      let codeFilled = false;
      for (const selector of codeInputSelectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            await element.fill(mfaCode);
            logger.info(`MFA code entered using selector: ${selector}`);
            codeFilled = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (!codeFilled) {
        logger.warn('Could not find MFA code input field. Falling back to manual entry.');
        if (headless) {
          logger.error('Running in headless mode, cannot fall back to manual MFA.');
          return false;
        }
        await promptForMFA(logger);
      } else {
        // Submit the MFA form
        await humanDelay(500, 1000);

        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("Verify")',
          'button:has-text("Submit")',
          'button:has-text("Continue")'
        ];

        let submitted = false;
        for (const selector of submitSelectors) {
          try {
            const element = await page.$(selector);
            if (element && await element.isVisible()) {
              await element.click();
              logger.info(`MFA form submitted using: ${selector}`);
              submitted = true;
              break;
            }
          } catch (e) {
            // Try next selector
          }
        }

        if (!submitted) {
          logger.warn('Could not find MFA submit button');
          if (!headless) {
            await promptForMFA(logger);
          }
        }
      }
    } catch (error) {
      logger.error(`Error during automatic MFA: ${error.message}`);
      if (headless) {
        return false;
      }
      // Fall back to manual MFA
      await promptForMFA(logger);
    }
  } else {
    // No automatic MFA available
    logger.info('Automatic MFA not available. Waiting for manual MFA completion...');

    if (headless) {
      logger.error('MFA detected but running in headless mode and email automation not configured.');
      logger.info('To enable automatic MFA, configure Azure AD credentials in .env file.');
      logger.info('Or use --headful flag for manual MFA support.');
      return false;
    }

    // Manual MFA: Display message and wait for completion automatically
    logger.info('='.repeat(60));
    logger.info('MFA DETECTED - Please complete the MFA challenge');
    logger.info('='.repeat(60));
    logger.info('The automation will continue automatically after you complete MFA...');
    logger.info('='.repeat(60));
  }

  // Wait for landing page (automatically detects when MFA is complete)
  logger.info('Waiting for MFA completion and landing page...');
  await humanDelay(500, 1000); // Reduced from 2-3 seconds to 0.5-1 second
  const landingPageDetected = await waitForLandingPage(
    page,
    logger,
    LOGIN_CONFIG.timeouts.landingPage
  );

  if (!landingPageDetected) {
    logger.error('Landing page not detected after MFA completion');
    return false;
  }

  logger.info('MFA completed successfully');
  return true;
}

/**
 * Main login function
 * Supports two modes:
 * a) Normal login (no MFA)
 * b) MFA human-in-the-loop: pause and prompt operator to complete MFA manually
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.username - Username
 * @param {string} credentials.password - Password
 * @param {Object} logger - Logger instance
 * @param {string} sessionId - Session ID for screenshots
 * @param {boolean} headless - Whether running in headless mode
 * @returns {Promise<boolean>} Success status
 */
export async function login(page, credentials, logger, sessionId, headless = true) {
  try {
    logger.info('Starting login process...');
    logger.info(`Navigating to: ${LOGIN_CONFIG.url}`);

    // Navigate to login page
    await page.goto(LOGIN_CONFIG.url, {
      waitUntil: 'domcontentloaded',
      timeout: LOGIN_CONFIG.timeouts.pageLoad
    });

    await waitForStableUI(page);

    // Enter credentials and submit
    const credentialsSuccess = await performCredentialEntry(
      page,
      credentials.username,
      credentials.password,
      logger,
      sessionId
    );

    if (!credentialsSuccess) {
      logger.error('Failed to enter credentials');
      return false;
    }

    // Wait a moment for redirect/response
    await humanDelay(1000, 2000);
    await waitForStableUI(page);

    // Check for MFA
    const mfaRequired = await detectMFA(page, logger);

    if (mfaRequired) {
      logger.info('MFA challenge detected');
      const mfaSuccess = await handleMFA(page, logger, headless);

      if (!mfaSuccess) {
        await captureFailureScreenshot(page, sessionId, 'login-mfa-failed', logger);
        return false;
      }
    } else {
      // No MFA - wait for landing page
      logger.info('No MFA detected, waiting for landing page...');
      const landingPageDetected = await waitForLandingPage(
        page,
        logger,
        LOGIN_CONFIG.timeouts.loginSubmit
      );

      if (!landingPageDetected) {
        logger.warn('Landing page not clearly detected, but continuing...');
        // Don't fail - sometimes the indicators aren't perfect
      }
    }

    // Final verification
    await humanDelay(300, 500); // Reduced from 1-1.5 seconds
    const isLoggedOut = await detectLoggedOut(page, logger);

    if (isLoggedOut) {
      logger.error('Login failed - still on login page');
      await captureFailureScreenshot(page, sessionId, 'login-final-check-failed', logger);
      return false;
    }

    logger.info('Login successful!');
    return true;
  } catch (error) {
    logger.error(`Login failed with error: ${error.message}`);
    await captureFailureScreenshot(page, sessionId, 'login-exception', logger);
    throw error;
  }
}

/**
 * Verify login session is still active
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} logger - Logger instance
 * @returns {Promise<boolean>} True if still logged in
 */
export async function verifyLoginSession(page, logger) {
  logger.info('Verifying login session...');

  const isLoggedOut = await detectLoggedOut(page, logger);

  if (isLoggedOut) {
    logger.warn('Session verification failed - user appears logged out');
    return false;
  }

  logger.info('Session verified - still logged in');
  return true;
}

/**
 * Re-login if session has expired
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} credentials - Login credentials
 * @param {Object} logger - Logger instance
 * @param {string} sessionId - Session ID
 * @param {boolean} headless - Whether running in headless mode
 * @returns {Promise<boolean>} Success status
 */
export async function ensureLoggedIn(page, credentials, logger, sessionId, headless) {
  const isLoggedIn = await verifyLoginSession(page, logger);

  if (!isLoggedIn) {
    logger.info('Session expired, re-logging in...');
    return await login(page, credentials, logger, sessionId, headless);
  }

  return true;
}
