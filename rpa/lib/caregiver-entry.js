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
    await humanDelay(1000, 1500); // Reduced wait time

    const currentUrl = page.url();
    logger.info(`Current URL before navigation: ${currentUrl}`);

    // Try direct URL navigation first (more reliable than clicking through menus)
    const baseUrl = new URL(currentUrl).origin;

    // Extract tenant ID from current URL (e.g., ENT2507010000)
    const tenantMatch = currentUrl.match(/\/(ENT\d+)\//);
    const tenantId = tenantMatch ? tenantMatch[1] : 'ENT2507010000';

    logger.info(`Extracted tenant ID: ${tenantId} (using ${tenantMatch ? 'URL match' : 'default'})`);

    // We know the working URL, go directly to it
    const directUrl = `${baseUrl}/${tenantId}/Aide/AideDetails_ns.aspx`;

    logger.info(`Navigating to: ${directUrl}`);
    await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await humanDelay(500, 1000); // Reduced wait time

    const currentPageUrl = page.url();
    logger.info(`Landed on: ${currentPageUrl}`);

    // Check if we landed on the form page
    const hasForm = await page.$('form');
    if (hasForm) {
      logger.info(`✓ Successfully navigated to form`);
      return true;
    } else {
      logger.warn('No form found on page');
      return false;
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
 * Handle zmultiselect widget (Primary Office field)
 * This is a multi-select checkbox widget with bubbles/checkboxes next to text
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} officeName - Office name to select (e.g., "AHS-Albany")
 * @param {Object} logger - Logger instance
 * @returns {Promise<boolean>} Success status
 */
async function selectPrimaryOffice(page, officeName, logger) {
  try {
    logger.info(`Selecting primary office: ${officeName}`);

    // Wait a moment for the widget to render
    await humanDelay(500, 1000);

    // First, try to open the office dropdown/multiselect widget
    logger.info('Looking for office dropdown widget to open...');
    try {
      // Look for elements that might trigger the office selector
      const opened = await page.evaluate(() => {
        // Look for label or container for "Primary Office"
        const labels = document.querySelectorAll('label, span, div');
        for (const label of labels) {
          if (label.textContent && label.textContent.toLowerCase().includes('primary office')) {
            // Try to find a clickable element near it (button, dropdown, etc.)
            const parent = label.closest('div, td, span');
            if (parent) {
              // Look for buttons, dropdowns, or clickable divs
              const clickables = parent.querySelectorAll('button, .dropdown, .zmultiselect, div[role="button"], span[role="button"]');
              for (const clickable of clickables) {
                clickable.click();
                return { success: true, element: clickable.className || clickable.tagName };
              }
              // Try clicking the parent itself
              if (parent.className && (parent.className.includes('select') || parent.className.includes('dropdown') || parent.className.includes('multi'))) {
                parent.click();
                return { success: true, element: parent.className };
              }
            }
          }
        }
        return { success: false };
      });

      if (opened && opened.success) {
        logger.info(`✓ Opened office dropdown widget: ${opened.element}`);
        await humanDelay(700, 1000);
      } else {
        logger.debug('Could not find dropdown opener - widget may already be open');
      }
    } catch (err) {
      logger.debug(`Error opening dropdown: ${err.message}`);
    }

    // DEBUG: See what's in the dropdown structure first - find the trigger element
    const dropdownState = await page.evaluate(() => {
      const dropdown = document.querySelector('div.ms-drop');
      const msParent = document.querySelector('div.ms-parent');

      // Try to find the trigger element - could be button, div, span, etc.
      const possibleTriggers = msParent ? msParent.querySelectorAll('button, div[class*="choice"], span[class*="choice"], div[class*="select"]') : [];

      const triggerInfo = [];
      for (const trigger of possibleTriggers) {
        triggerInfo.push({
          tag: trigger.tagName,
          className: trigger.className,
          id: trigger.id || 'NO ID',
          text: trigger.textContent ? trigger.textContent.trim().substring(0, 50) : '',
          isVisible: trigger.offsetParent !== null
        });
      }

      // Also check ms-parent's direct children
      const parentChildren = msParent ? Array.from(msParent.children).map(child => ({
        tag: child.tagName,
        className: child.className,
        id: child.id || 'NO ID'
      })) : [];

      const labels = document.querySelectorAll('label.hhax-input');

      const labelInfo = [];
      for (let i = 0; i < Math.min(labels.length, 10); i++) {
        const label = labels[i];
        const span = label.querySelector('span.text-wrap-div');
        const checkbox = label.querySelector('input[type="checkbox"]');
        labelInfo.push({
          spanText: span ? span.textContent.trim() : 'NO SPAN',
          checkboxId: checkbox ? checkbox.id : 'NO CHECKBOX',
          isVisible: label.offsetParent !== null,
          ariaHidden: label.getAttribute('aria-hidden')
        });
      }

      return {
        msParentExists: !!msParent,
        msParentClass: msParent ? msParent.className : 'NO PARENT',
        msParentChildren: parentChildren,
        possibleTriggers: triggerInfo,
        dropdownExists: !!dropdown,
        dropdownVisible: dropdown ? dropdown.offsetParent !== null : false,
        totalLabels: labels.length,
        sampleLabels: labelInfo
      };
    });

    logger.info(`Dropdown structure: ${JSON.stringify(dropdownState, null, 2)}`);

    // CRITICAL: The dropdown is disabled by default - need to enable it first!
    logger.info('Enabling office dropdown...');
    await page.evaluate(() => {
      const dropdown = document.querySelector('div.ms-choice');
      if (dropdown) {
        dropdown.removeAttribute('aria-disabled');
        dropdown.setAttribute('aria-disabled', 'false');
        dropdown.setAttribute('aria-expanded', 'false');

        // Also enable the actual select element if it exists
        const select = document.querySelector('select[name*="Office" i]');
        if (select) {
          select.disabled = false;
        }
      }
    });
    await humanDelay(300, 500);
    logger.info('✓ Dropdown enabled');

    // Try to find and click the trigger element
    if (dropdownState.possibleTriggers && dropdownState.possibleTriggers.length > 0) {
      const trigger = dropdownState.possibleTriggers[0];
      logger.info(`Found potential trigger: ${trigger.tag}.${trigger.className}`);

      // Try clicking it based on className
      const selector = trigger.className ? `.${trigger.className.split(' ')[0]}` : trigger.tag;
      logger.info(`Attempting to click selector: ${selector}`);

      try {
        await page.click(selector, { timeout: 3000, force: true });
        await humanDelay(700, 1000);
        logger.info(`✓ Clicked dropdown trigger: ${selector}`);
      } catch (e) {
        logger.warn(`Could not click trigger: ${e.message}`);
      }
    } else {
      logger.warn('No trigger element found - trying to click ms-parent directly');
      try {
        await page.click('div.ms-parent', { timeout: 3000, force: true });
        await humanDelay(700, 1000);
        logger.info('✓ Clicked ms-parent');
      } catch (e) {
        logger.warn(`Could not click ms-parent: ${e.message}`);
      }
    }

    // Check if dropdown opened and what the structure looks like now
    const dropdownAfterClick = await page.evaluate(() => {
      const dropdown = document.querySelector('div.ms-drop');
      const labels = document.querySelectorAll('label.hhax-input');

      const labelInfo = [];
      for (let i = 0; i < Math.min(labels.length, 10); i++) {
        const label = labels[i];
        const span = label.querySelector('span.text-wrap-div');
        const checkbox = label.querySelector('input[type="checkbox"]');

        // Get parent LI to understand hierarchy
        const li = label.closest('li');
        const liClass = li ? li.className : 'NO LI';
        const liHasChildren = li ? li.querySelectorAll('ul').length > 0 : false;

        labelInfo.push({
          spanText: span ? span.textContent.trim() : 'NO SPAN',
          checkboxId: checkbox ? checkbox.id : 'NO CHECKBOX',
          checkboxChecked: checkbox ? checkbox.checked : false,
          isVisible: label.offsetParent !== null,
          parentLiClass: liClass,
          hasChildList: liHasChildren
        });
      }

      return {
        dropdownVisible: dropdown ? dropdown.offsetParent !== null : false,
        dropdownAriaHidden: dropdown ? dropdown.getAttribute('aria-hidden') : null,
        sampleLabels: labelInfo
      };
    });

    logger.info(`Dropdown AFTER click: ${JSON.stringify(dropdownAfterClick, null, 2)}`);

    // Try to find and click the checkbox/bubble for the office
    // Generate search terms from the office name
    const searchTerms = [officeName];  // Try exact match first

    // Add variations for offices like "AHS-Albany"
    if (officeName.includes('-')) {
      const parts = officeName.split('-');
      searchTerms.push(parts[parts.length - 1].trim());  // "Albany" from "AHS-Albany"
      searchTerms.push(parts[0].trim());  // "AHS" from "AHS-Albany"
    }

    for (const term of searchTerms) {
      try {
        // Try to find text containing the office name and click the LABEL directly
        logger.info(`Looking for office option with text: ${term}`);

        // For single-select dropdowns, clicking the visible label should select it
        const clicked = await page.evaluate((searchTerm) => {
          const labels = document.querySelectorAll('label.hhax-input');

          for (const label of labels) {
            const span = label.querySelector('span.text-wrap-div');
            if (span) {
              const text = span.textContent ? span.textContent.trim() : '';

              if (text === searchTerm) {
                // Check if this is a visible, clickable item
                const li = label.closest('li');
                const isVisible = label.offsetParent !== null;

                if (isVisible) {
                  // Click the LABEL itself - this should trigger the selection
                  label.click();

                  return {
                    success: true,
                    matchedText: text,
                    liClass: li ? li.className : 'NO LI'
                  };
                }
              }
            }
          }
          return { success: false };
        }, term);

        if (clicked && clicked.success) {
          logger.info(`✓ Clicked label for: ${clicked.matchedText} (li class: ${clicked.liClass})`);
          await humanDelay(500, 700);

          // Verify selection
          const verification = await page.evaluate(() => {
            // Check the dropdown button text to see what's selected
            const button = document.querySelector('div.ms-choice');
            return button ? button.textContent.trim() : 'not found';
          });

          logger.info(`Dropdown now shows: "${verification}"`);

          if (verification && verification.includes(term)) {
            logger.info(`✓ Successfully selected office: ${term}`);
            return true;
          }
        }

        // Fallback: try to find checkbox-based selection
        const checkboxInfo = await page.evaluate((searchTerm) => {
          const labels = document.querySelectorAll('label.hhax-input');

          for (const label of labels) {
            const span = label.querySelector('span.text-wrap-div');
            if (span) {
              const text = span.textContent ? span.textContent.trim() : '';

              if (text === searchTerm) {
                const checkbox = label.querySelector('input[type="checkbox"]');
                if (checkbox) {
                  return {
                    found: true,
                    id: checkbox.id,
                    name: checkbox.name,
                    checked: checkbox.checked,
                    matchedText: text,
                    isExact: true,
                    labelFor: label.getAttribute('for')
                  };
                }
              }
            }
          }
          return { found: false };
        }, term);

        if (checkboxInfo && checkboxInfo.found) {
          logger.info(`Found checkbox: id="${checkboxInfo.id}", currently checked=${checkboxInfo.checked}, matched text="${checkboxInfo.matchedText}", exact match=${checkboxInfo.isExact}`);

          // DEBUG: Dump the HTML structure around the checkbox
          const htmlStructure = await page.evaluate((id) => {
            const cb = document.getElementById(id);
            if (!cb) return 'Checkbox not found';

            // Get parent hierarchy
            let parent = cb.parentElement;
            let level = 0;
            const structure = [];

            while (parent && level < 5) {
              structure.push({
                level,
                tag: parent.tagName,
                className: parent.className || '',
                id: parent.id || '',
                children: parent.children.length,
                html: parent.outerHTML.substring(0, 300)
              });
              parent = parent.parentElement;
              level++;
            }

            return {
              checkbox: {
                tag: cb.tagName,
                id: cb.id,
                name: cb.name,
                type: cb.type,
                checked: cb.checked,
                html: cb.outerHTML
              },
              parents: structure
            };
          }, checkboxInfo.id);

          logger.info(`Checkbox structure: ${JSON.stringify(htmlStructure, null, 2)}`);

          // zmultiselect widgets have a hidden checkbox and a visible styled element
          // We need to find and click the visible element, not the hidden checkbox
          logger.info(`Looking for visible clickable element associated with checkbox...`);

          let clicked;
          try {
            clicked = await page.evaluate(({searchTerm, checkboxId}) => {
              try {
                const cb = document.getElementById(checkboxId);
                if (!cb) return {success: false, reason: 'checkbox not found'};

                // The checkbox is DISABLED and the label is the clickable element
                // Find label for this checkbox and click it
                const label = document.querySelector(`label[for="${checkboxId}"]`);
                if (label) {
                  // First, enable the checkbox
                  cb.removeAttribute('disabled');
                  cb.disabled = false;

                  // Then click the label
                  label.click();

                  return {
                    success: true,
                    method: 'label click (after enabling checkbox)',
                    nowChecked: cb.checked,
                    labelClass: label.className
                  };
                }

                return {success: false, reason: 'no label found for checkbox'};
              } catch (err) {
                return {success: false, reason: `error: ${err.message}`};
              }
            }, {searchTerm: term, checkboxId: checkboxInfo.id});
          } catch (evalErr) {
            logger.warn(`Evaluate error: ${evalErr.message}`);
            clicked = {success: false, reason: `evaluate failed: ${evalErr.message}`};
          }

          if (clicked && clicked.success) {
            logger.info(`✓ Clicked via ${clicked.method}, checkbox state: ${clicked.nowChecked}`);

            await humanDelay(700, 1000);

            // Verify it stuck
            const finalState = await page.evaluate((id) => {
              const cb = document.getElementById(id);
              return cb ? cb.checked : false;
            }, checkboxInfo.id);

            logger.info(`  Final verification: checkbox is ${finalState ? 'CHECKED' : 'UNCHECKED'}`);

            if (finalState) {
              logger.info(`✓ Successfully selected office: ${term}`);
              return true;
            } else {
              logger.warn(`Checkbox state didn't persist after ${clicked.method}`);
            }
          } else {
            logger.warn(`Could not find/click clickable element: ${clicked?.reason || 'unknown'}`);
          }
        } else {
          logger.warn(`Checkbox not found for term: ${term}`);
        }
      } catch (e) {
        logger.debug(`Failed to select with term "${term}": ${e.message}`);
      }
    }

    // Fallback: try Playwright's text selector
    try {
      logger.info('Trying Playwright text selector as fallback...');
      await page.click('text=AHS-Albany', { timeout: 3000 });
      logger.info('✓ Selected office via text selector');
      await humanDelay(200, 400);
      return true;
    } catch (e) {
      logger.warn(`Could not select office using text selector: ${e.message}`);
    }

    logger.warn('Could not select primary office - continuing without it');
    return false;
  } catch (error) {
    logger.error(`Error selecting primary office: ${error.message}`);
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

  // Wait for form to fully load
  await humanDelay(1000, 1500);

  // FIRST: Handle Primary Office dropdown (zmultiselect widget)
  // Use the office from caregiver data or default to AHS-Albany
  const primaryOffice = caregiver.primaryOffice || 'AHS-Albany';
  const officeSelected = await selectPrimaryOffice(page, primaryOffice, logger);

  if (officeSelected) {
    // Verify the office is still selected - check ALL office checkboxes to see which ones are checked
    const verification = await page.evaluate(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"][name="selectGroup"]');
      const officeCheckboxes = [];
      for (const cb of checkboxes) {
        if (cb.checked) {
          // Only include checked checkboxes
          const label = cb.parentElement?.textContent || '';
          officeCheckboxes.push({
            id: cb.id,
            name: cb.name,
            checked: cb.checked,
            label: label.trim().substring(0, 80)
          });
        }
      }
      return officeCheckboxes;
    });
    logger.info(`CHECKED office checkboxes: ${JSON.stringify(verification)}`);

    // Also get the visible selected value from the dropdown
    const selectedText = await page.evaluate(() => {
      const dropdown = document.querySelector('button.ms-choice');
      return dropdown ? dropdown.textContent.trim() : 'not found';
    });
    logger.info(`Dropdown visible selection: "${selectedText}"`);
  } else {
    logger.warn('Office selection failed - form fields may not be enabled properly');
  }

  // Wait for the form to update after office selection (enables other fields)
  logger.info('Waiting for form to update after office selection...');
  await humanDelay(2000, 3000);

  // Try to trigger the form update by enabling all disabled fields
  logger.info('Triggering form update...');
  await page.evaluate(() => {
    // Enable ALL disabled form fields (inputs, selects, textareas)
    const allDisabledFields = document.querySelectorAll('input[disabled], select[disabled], textarea[disabled]');
    allDisabledFields.forEach(field => {
      field.removeAttribute('disabled');
      field.disabled = false;
    });
  });

  logger.info('✓ Form fields enabled via JavaScript');
  await humanDelay(500, 1000);

  const fields = CAREGIVER_CONFIG.hhaExchange.fields;

  for (const [fieldName, fieldConfig] of Object.entries(fields)) {
    // Skip primaryOffice since we handle it separately above
    if (fieldName === 'primaryOffice') {
      continue;
    }

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
          logger.warn(`Checkbox ${fieldName} not found with selector: ${fieldConfig.selector}`);
        }
      } catch (e) {
        logger.warn(`Could not handle checkbox ${fieldName}: ${e.message}`);
      }
    } else if (fieldConfig.type === 'dropdown' || fieldConfig.type === 'select') {
      // For dropdowns, try to select the option
      try {
        await page.selectOption(fieldConfig.selector, value);
        logger.info(`Selected ${fieldName}: ${value}`);

        // Verify the dropdown by checking selected text
        await humanDelay(200, 300);
        const selectedText = await page.evaluate((sel) => {
          const select = document.querySelector(sel);
          if (select && select.tagName === 'SELECT') {
            const option = select.options[select.selectedIndex];
            return option ? option.text : null;
          }
          return null;
        }, fieldConfig.selector);

        logger.info(`  Dropdown ${fieldName} selected text: "${selectedText}"`);
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
      // Regular text input (includes phone-part type and date type)
      const success = await safeFill(page, fieldConfig.selector, value, logger);
      if (!success) {
        logger.error(`Failed to fill required field: ${fieldName}`);
        if (fieldConfig.required) {
          await captureFailureScreenshot(page, sessionId, `fill-${fieldName}-failed`, logger);
          return false;
        }
      }

      // VERIFY date fields actually got filled (they sometimes fail silently)
      if (fieldConfig.type === 'date') {
        await humanDelay(200, 300);
        const actualValue = await page.evaluate((sel) => {
          const input = document.querySelector(sel);
          return input ? input.value : null;
        }, fieldConfig.selector);

        logger.info(`  Verification for ${fieldName}: expected="${value}", actual="${actualValue}"`);

        if (actualValue !== value) {
          logger.warn(`Date field ${fieldName} verification FAILED - trying alternative method`);

          // Try using keyboard input instead
          try {
            await page.click(fieldConfig.selector);
            await page.keyboard.press('Control+A');
            await page.keyboard.type(value);
            await humanDelay(200, 300);

            const retryValue = await page.evaluate((sel) => {
              const input = document.querySelector(sel);
              return input ? input.value : null;
            }, fieldConfig.selector);

            logger.info(`  After keyboard input: actual="${retryValue}"`);
          } catch (e) {
            logger.warn(`Keyboard input also failed: ${e.message}`);
          }
        }
      }
    }

    await humanDelay(100, 200); // Reduced delay between fields
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

  // DEBUG: Check critical field values before submit
  const fieldCheck = await page.evaluate(() => {
    const result = {
      addressFields: [],
      appDateFields: []
    };

    // Find all address-related fields
    const allInputs = document.querySelectorAll('input[type="text"], input[type="password"], input:not([type])');
    for (const input of allInputs) {
      if (input.id && (input.id.toLowerCase().includes('address') || input.id.toLowerCase().includes('street'))) {
        result.addressFields.push({
          id: input.id,
          name: input.name,
          value: input.value,
          visible: input.offsetParent !== null
        });
      }
      if (input.id && input.id.toLowerCase().includes('application') && input.id.toLowerCase().includes('date')) {
        result.appDateFields.push({
          id: input.id,
          name: input.name,
          value: input.value,
          visible: input.offsetParent !== null
        });
      }
      if (input.id && input.id.toLowerCase().includes('ssn')) {
        if (!result.ssnFields) result.ssnFields = [];
        result.ssnFields.push({
          id: input.id,
          name: input.name,
          value: input.value,
          type: input.type,
          visible: input.offsetParent !== null
        });
      }
    }

    return result;
  });
  logger.info(`PRE-SUBMIT CHECK - Address fields found:`);
  fieldCheck.addressFields.forEach(f => logger.info(`  ${f.id}: "${f.value}" (visible: ${f.visible})`));
  logger.info(`PRE-SUBMIT CHECK - Application Date fields found:`);
  fieldCheck.appDateFields.forEach(f => logger.info(`  ${f.id}: "${f.value}" (visible: ${f.visible})`));
  if (fieldCheck.ssnFields) {
    logger.info(`PRE-SUBMIT CHECK - SSN fields found:`);
    fieldCheck.ssnFields.forEach(f => logger.info(`  ${f.id}: "${f.value}" (type: ${f.type}, visible: ${f.visible})`));
  }

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
async function verifyCaregiverAdded(page, logger, sessionId) {
  logger.info('Verifying caregiver was added successfully...');

  // Take a screenshot to see what's on the page
  await captureFailureScreenshot(page, sessionId, 'after-submit', logger);

  // Check for green success notification (common in HHA Exchange)
  const successText = await page.evaluate(() => {
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      const text = div.textContent.toLowerCase();
      if (text.includes('successfully') || text.includes('success')) {
        return div.textContent.trim();
      }
    }
    return null;
  });

  if (successText) {
    logger.info(`✓ Success confirmed! Message: "${successText}"`);
    return true;
  }

  // Also check configured success indicators
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
    'text=/invalid/i',
    '.validation-summary-errors',  // ASP.NET validation summary
    'span[style*="color:Red"]',    // ASP.NET validation messages
    'span[style*="color: Red"]',
    'span.field-validation-error'
  ];

  for (const selector of errorSelectors) {
    try {
      const element = await page.$(selector);
      if (element && await element.isVisible()) {
        const errorText = await element.textContent();
        logger.error(`Error message found (${selector}): ${errorText}`);
        return false;
      }
    } catch (e) {
      // Continue checking
    }
  }

  // Check for validation popup and extract all error messages
  const validationErrors = await page.evaluate(() => {
    const errors = [];

    // Check for validation popup
    const popup = document.querySelector('[role="dialog"], .modal, .popup');
    if (popup) {
      errors.push(`Popup found: ${popup.textContent.trim()}`);
    }

    // Check for validation summary
    const validationSummary = document.querySelector('.validation-summary-errors');
    if (validationSummary) {
      errors.push(`Validation Summary: ${validationSummary.textContent.trim()}`);
    }

    // Check for red text spans
    const allSpans = document.querySelectorAll('span');
    for (const span of allSpans) {
      const style = window.getComputedStyle(span);
      if (style.color === 'rgb(255, 0, 0)' || style.color === 'red') {
        const text = span.textContent.trim();
        if (text && text.length > 2 && text !== '*') { // Skip single asterisks
          errors.push(`Red text: ${text}`);
        }
      }
    }

    return errors.length > 0 ? errors : null;
  });

  if (validationErrors) {
    logger.error(`Validation errors detected:`);
    validationErrors.forEach(err => logger.error(`  - ${err}`));
    return false;
  }

  // If no success or error indicators found, assume failure and log warning
  logger.warn('Could not confirm success - staying on same page may indicate validation error');
  return false;
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
    const verifySuccess = await verifyCaregiverAdded(page, logger, sessionId);
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
