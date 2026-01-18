#!/usr/bin/env node

/**
 * Selector Capture Helper
 *
 * This script helps you capture the correct selectors from HHA Exchange.
 * Run this in headful mode and it will pause at key points to let you
 * inspect elements and capture selectors.
 */

import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('[DEBUG] main() started');
  console.log('='.repeat(60));
  console.log('HHA Exchange Selector Capture Helper');
  console.log('='.repeat(60));
  console.log('');
  console.log('This tool will help you capture the correct selectors.');
  console.log('The browser will pause at key points for you to inspect elements.');
  console.log('');
  console.log('Instructions:');
  console.log('1. Use browser DevTools (F12) to inspect elements');
  console.log('2. Right-click element -> Inspect');
  console.log('3. Copy selector or text content');
  console.log('4. Update rpa/config.yaml with the captured selectors');
  console.log('');
  console.log('='.repeat(60));
  console.log('');

  const username = process.env.HHAE_USERNAME;
  const password = process.env.HHAE_PASSWORD;

  console.log('[DEBUG] Environment check:');
  console.log('[DEBUG] HHAE_USERNAME:', username ? '***SET***' : 'NOT SET');
  console.log('[DEBUG] HHAE_PASSWORD:', password ? '***SET***' : 'NOT SET');

  if (!username || !password) {
    console.error('ERROR: Please set HHAE_USERNAME and HHAE_PASSWORD in .env file');
    process.exit(1);
  }

  console.log('[DEBUG] About to launch browser...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });
  console.log('[DEBUG] Browser launched successfully');

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // Step 1: Navigate to login page
    console.log('Step 1: Navigating to login page...');
    console.log('Current URL:', page.url());
    try {
      console.log('About to navigate...');
      const response = await page.goto('https://app.hhaexchange.com/identity/account/login', { timeout: 30000 });
      console.log('Navigation response:', response?.status());
      console.log('Page loaded, URL is now:', page.url());
    } catch (navError) {
      console.error('Navigation error:', navError.message);
      throw navError;
    }
    console.log('Waiting for page to stabilize...');
    await page.waitForLoadState('networkidle');

    await question('\n✋ PAUSE: Login page loaded. Inspect the page and note:\n  - Username field selector\n  - Password field selector\n  - Login button selector\n\nPress ENTER to continue...');

    // Step 2: Fill credentials
    console.log('\nStep 2: Attempting to fill credentials with generic selectors...');

    try {
      // Try common username selectors
      const usernameSelector = 'input[name="username"], input[type="email"], input#username, input#email, input[name="Username"]';
      await page.fill(usernameSelector, username);
      console.log('✓ Username filled successfully with selector:', usernameSelector);
    } catch (e) {
      console.log('✗ Could not fill username with generic selector');
      await question('Please manually fill the username field and press ENTER...');
    }

    try {
      // Try common password selectors
      const passwordSelector = 'input[name="password"], input[type="password"], input#password, input[name="Password"]';
      await page.fill(passwordSelector, password);
      console.log('✓ Password filled successfully with selector:', passwordSelector);
    } catch (e) {
      console.log('✗ Could not fill password with generic selector');
      await question('Please manually fill the password field and press ENTER...');
    }

    await question('\n✋ PAUSE: Credentials filled. Press ENTER to click login button...');

    // Step 3: Click login button
    console.log('\nStep 3: Attempting to click login button...');

    try {
      const loginButtonSelector = 'button[type="submit"], button:has-text("Login"), button:has-text("Sign In"), input[type="submit"]';
      await page.click(loginButtonSelector);
      console.log('✓ Login button clicked with selector:', loginButtonSelector);
    } catch (e) {
      console.log('✗ Could not click login button with generic selector');
      await question('Please manually click the login button and press ENTER...');
    }

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    await question('\n✋ PAUSE: After login. Check if:\n  - Login was successful\n  - MFA is required (if yes, complete it now)\n  - You can see the dashboard/landing page\n\nNote the landing page URL and any unique elements.\n\nPress ENTER to continue...');

    // Step 4: Navigate to Add Staff form
    console.log('\nStep 4: Now navigate to Add New Staff form manually.');
    console.log('Expected path: Workforce > Staff > Add New Staff');
    console.log('');
    console.log('We need to capture selectors for ALL form fields:');
    console.log('  - Primary Office (dropdown)');
    console.log('  - Caregiver Type (dropdown)');
    console.log('  - First Name, Last Name (text inputs)');
    console.log('  - Gender, Initials (text/dropdown)');
    console.log('  - Date of Birth (date selector)');
    console.log('  - Status (dropdown)');
    console.log('  - Employment Type (checkbox/dropdown)');
    console.log('  - Referral Source, Team, Location, Branch (dropdowns)');
    console.log('  - Address, City, State, Zip (text inputs)');
    console.log('  - Primary Phone, Mobile Phone (3 text inputs each)');
    console.log('  - Language 1, Language 2 (dropdowns)');
    console.log('  - Email (text input)');
    console.log('  - Submit button');
    console.log('');

    await question('Navigate to Add New Staff form and press ENTER when ready...');

    console.log('\nCurrent URL:', page.url());

    await question('\n✋ PAUSE: Inspect the Add Staff form and note:\n  - Use F12 DevTools to inspect each field\n  - Look for name="..." or id="..." attributes\n  - Check if phone fields are 3 separate inputs or one\n  - Note the exact text/value options in dropdowns\n  - Find the Submit/Save button selector\n\nPress ENTER to finish...');

    console.log('\n' + '='.repeat(60));
    console.log('Selector capture session complete!');
    console.log('='.repeat(60));
    console.log('\nNext steps:');
    console.log('1. Update caregiver-config.js with the selectors you captured');
    console.log('2. Set a caregiver to "Active" status in Monday.com board 6119848729');
    console.log('3. Test with: node caregiver-onboarding.js --headful --limit 1');
    console.log('4. Iterate until it works reliably');
    console.log('');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
    rl.close();
  }
}

main().catch(error => {
  console.error('[DEBUG] main() threw an error:');
  console.error(error);
  process.exit(1);
});
