#!/usr/bin/env node

/**
 * Diagnostic script to identify RPA issues
 */

import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config();

console.log('='.repeat(60));
console.log('RPA DIAGNOSTIC TOOL');
console.log('='.repeat(60));
console.log('');

// Check 1: Environment variables
console.log('✓ Check 1: Environment Variables');
const username = process.env.HHAE_USERNAME;
const password = process.env.HHAE_PASSWORD;
console.log(`  HHAE_USERNAME: ${username ? '✓ SET' : '✗ NOT SET'}`);
console.log(`  HHAE_PASSWORD: ${password ? '✓ SET' : '✗ NOT SET'}`);
console.log('');

// Check 2: .env file
console.log('✓ Check 2: Configuration Files');
console.log(`  .env file: ${existsSync('.env') ? '✓ EXISTS' : '✗ MISSING'}`);
console.log(`  config.yaml: ${existsSync('rpa/config.yaml') ? '✓ EXISTS' : '✗ MISSING'}`);
console.log('');

// Check 3: Playwright installation
console.log('✓ Check 3: Playwright Installation');
try {
  const browser = await chromium.launch({ headless: true });
  await browser.close();
  console.log('  Chromium browser: ✓ INSTALLED');
} catch (error) {
  console.log('  Chromium browser: ✗ NOT INSTALLED OR ERROR');
  console.log(`  Error: ${error.message}`);
  console.log('  Run: npm run install:playwright');
}
console.log('');

// Check 4: Network connectivity
console.log('✓ Check 4: Network Connectivity Test');
try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('  Testing connection to HHA Exchange...');
  const response = await page.goto('https://app.hhaexchange.com/identity/account/login', {
    timeout: 15000,
    waitUntil: 'domcontentloaded'
  });

  console.log(`  Response status: ${response.status()}`);
  console.log(`  Final URL: ${page.url()}`);

  if (response.status() === 200) {
    console.log('  Network test: ✓ SUCCESS');
  } else {
    console.log(`  Network test: ⚠ WARNING (Status ${response.status()})`);
  }

  await browser.close();
} catch (error) {
  console.log('  Network test: ✗ FAILED');
  console.log(`  Error: ${error.message}`);
}
console.log('');

// Check 5: Sample RPA command
console.log('✓ Check 5: How to Run RPA');
console.log('  Correct command examples:');
console.log('');
console.log('  # Run capture tool to inspect selectors:');
console.log('  node rpa/capture-selectors.js');
console.log('');
console.log('  # Run actual RPA (headful mode to see browser):');
console.log('  node rpa/run.js --report active_patients_auth --from 2024-01-01 --to 2024-01-31 --headful');
console.log('');
console.log('  # AVOID running this (opens Playwright inspector on localhost):');
console.log('  npm run rpa:codegen');
console.log('');

console.log('='.repeat(60));
console.log('DIAGNOSIS COMPLETE');
console.log('='.repeat(60));
