#!/usr/bin/env node

import dotenv from 'dotenv';
import { getBoardItems } from './rpa/lib/monday.js';
import { createLogger } from './rpa/lib/logger.js';

dotenv.config();

const logger = createLogger('test-active-status');

async function testActiveStatus() {
  const boardId = '6119848729';

  console.log('Fetching ALL items from board...');
  const allItems = await getBoardItems(boardId, null, null, logger);

  console.log(`\nTotal items in board: ${allItems.length}`);

  // Get all unique statuses
  const statuses = new Map();
  allItems.forEach(item => {
    const statusCol = item.column_values.find(c => c.id === 'status');
    if (statusCol && statusCol.text) {
      statuses.set(statusCol.text, (statuses.get(statusCol.text) || 0) + 1);
    }
  });

  console.log('\nStatus distribution:');
  Array.from(statuses.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

  // Try filtering by "Active"
  console.log('\n\nFetching items with status="Active"...');
  const activeItems = await getBoardItems(boardId, 'status', 'Active', logger);
  console.log(`Found ${activeItems.length} items with status="Active"`);

  if (activeItems.length > 0) {
    console.log('\nFirst 3 Active items:');
    activeItems.slice(0, 3).forEach((item, i) => {
      console.log(`\n[${i + 1}] ${item.name}`);
      console.log(`    ID: ${item.id}`);
      const statusCol = item.column_values.find(c => c.id === 'status');
      console.log(`    Status: ${statusCol?.text}`);
    });
  }
}

testActiveStatus().catch(console.error);
