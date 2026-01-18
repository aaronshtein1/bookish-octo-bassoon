#!/usr/bin/env node

/**
 * Auto-detect selectors from HHA Exchange
 * This script will navigate to the login page and detect the actual selectors
 */

import { chromium } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

async function detectSelectors() {
  console.log('='.repeat(60));
  console.log('AUTO-DETECTING SELECTORS FROM HHA EXCHANGE');
  console.log('='.repeat(60));
  console.log('');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });

  const page = await browser.newPage();

  try {
    console.log('Step 1: Navigating to login page...');
    await page.goto('https://app.hhaexchange.com/identity/account/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log('✓ Page loaded');
    console.log('');

    // Detect username field
    console.log('Step 2: Detecting username field...');
    const usernameSelectors = [
      'input[name="username"]',
      'input[name="Username"]',
      'input[type="email"]',
      'input#username',
      'input#email',
      'input[autocomplete="username"]',
      'input[placeholder*="username" i]',
      'input[placeholder*="email" i]'
    ];

    let detectedUsername = null;
    for (const selector of usernameSelectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          detectedUsername = selector;
          console.log(`✓ Found username field: ${selector}`);

          // Get additional info
          const name = await element.getAttribute('name');
          const id = await element.getAttribute('id');
          const placeholder = await element.getAttribute('placeholder');
          console.log(`  - name="${name}"`);
          console.log(`  - id="${id}"`);
          console.log(`  - placeholder="${placeholder}"`);
          break;
        }
      } catch (e) {
        // Continue checking
      }
    }

    if (!detectedUsername) {
      console.log('⚠ Could not auto-detect username field');
      console.log('Available input fields:');
      const inputs = await page.$$('input');
      for (let i = 0; i < inputs.length; i++) {
        const type = await inputs[i].getAttribute('type');
        const name = await inputs[i].getAttribute('name');
        const id = await inputs[i].getAttribute('id');
        console.log(`  Input ${i}: type="${type}", name="${name}", id="${id}"`);
      }
    }
    console.log('');

    // Detect password field
    console.log('Step 3: Detecting password field...');
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[name="Password"]',
      'input#password',
      'input[autocomplete="current-password"]'
    ];

    let detectedPassword = null;
    for (const selector of passwordSelectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          detectedPassword = selector;
          console.log(`✓ Found password field: ${selector}`);

          const name = await element.getAttribute('name');
          const id = await element.getAttribute('id');
          console.log(`  - name="${name}"`);
          console.log(`  - id="${id}"`);
          break;
        }
      } catch (e) {
        // Continue checking
      }
    }

    if (!detectedPassword) {
      console.log('⚠ Could not auto-detect password field');
    }
    console.log('');

    // Detect submit button
    console.log('Step 4: Detecting login button...');
    const buttonSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Login")',
      'button:has-text("Log In")',
      'button.btn-primary',
      'button.submit'
    ];

    let detectedButton = null;
    for (const selector of buttonSelectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          detectedButton = selector;
          const text = await element.textContent();
          console.log(`✓ Found login button: ${selector}`);
          console.log(`  - text="${text?.trim()}"`);
          break;
        }
      } catch (e) {
        // Continue checking
      }
    }

    if (!detectedButton) {
      console.log('⚠ Could not auto-detect login button');
      console.log('Available buttons:');
      const buttons = await page.$$('button');
      for (let i = 0; i < buttons.length; i++) {
        const text = await buttons[i].textContent();
        const type = await buttons[i].getAttribute('type');
        console.log(`  Button ${i}: type="${type}", text="${text?.trim()}"`);
      }
    }
    console.log('');

    // Wait a moment for inspection
    console.log('Browser will stay open for 10 seconds so you can inspect...');
    await page.waitForTimeout(10000);

    console.log('='.repeat(60));
    console.log('DETECTED SELECTORS SUMMARY');
    console.log('='.repeat(60));
    console.log('');
    console.log('Add these to your login.js LOGIN_CONFIG:');
    console.log('');
    console.log('selectors: {');
    console.log(`  username: '${detectedUsername || 'NEED_TO_MANUALLY_FIND'}',`);
    console.log(`  password: '${detectedPassword || 'NEED_TO_MANUALLY_FIND'}',`);
    console.log(`  submitButton: '${detectedButton || 'NEED_TO_MANUALLY_FIND'}',`);
    console.log('}');
    console.log('');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

detectSelectors().catch(console.error);
