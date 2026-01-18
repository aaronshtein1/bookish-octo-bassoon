#!/usr/bin/env node

import { chromium } from '@playwright/test';

async function main() {
  console.log('Starting simple test...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const page = await browser.newPage();
  
  console.log('About to navigate to Google...');
  console.log('URL: https://google.com');
  
  try {
    const response = await page.goto('https://google.com', { waitUntil: 'domcontentloaded' });
    console.log('Navigation complete. Status:', response?.status());
    console.log('Final URL:', page.url());
    
    // Wait for user to see the page
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  await browser.close();
}

main().catch(console.error);
