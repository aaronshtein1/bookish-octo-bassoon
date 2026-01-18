#!/usr/bin/env node

/**
 * Test Monday.com API connection
 */

import dotenv from 'dotenv';
import { createLogger } from './rpa/lib/logger.js';
import { getBoards, getBoardColumns, getBoardItems } from './rpa/lib/monday.js';

dotenv.config();

async function testMondayConnection() {
  const sessionId = 'monday-test';
  const logger = createLogger(sessionId);

  console.log('='.repeat(60));
  console.log('MONDAY.COM API CONNECTION TEST');
  console.log('='.repeat(60));
  console.log('');

  const apiToken = process.env.MONDAY_API_TOKEN;
  if (!apiToken) {
    console.error('ERROR: MONDAY_API_TOKEN not set in .env file');
    process.exit(1);
  }

  console.log(`API Token: ${apiToken.substring(0, 20)}...`);
  console.log('');

  try {
    // Step 1: Get all boards
    console.log('Step 1: Fetching your Monday.com boards...');
    const boards = await getBoards(logger);

    console.log(`Found ${boards.length} boards:`);
    console.log('');

    boards.forEach((board, index) => {
      console.log(`[${index + 1}] ${board.name}`);
      console.log(`    ID: ${board.id}`);
      console.log(`    Type: ${board.board_kind}`);
      if (board.description) {
        console.log(`    Description: ${board.description}`);
      }
      console.log('');
    });

    // Step 2: Let's examine the first board in detail
    if (boards.length > 0) {
      const firstBoard = boards[0];
      console.log('='.repeat(60));
      console.log(`Examining Board: "${firstBoard.name}"`);
      console.log('='.repeat(60));
      console.log('');

      // Get columns
      console.log('Columns in this board:');
      const columns = await getBoardColumns(firstBoard.id, logger);

      columns.forEach((col, index) => {
        console.log(`  [${index + 1}] ${col.title}`);
        console.log(`      ID: ${col.id}`);
        console.log(`      Type: ${col.type}`);
      });
      console.log('');

      // Get items (first 5)
      console.log('First 5 items in this board:');
      const items = await getBoardItems(firstBoard.id, null, null, logger);

      items.slice(0, 5).forEach((item, index) => {
        console.log(`  [${index + 1}] ${item.name} (ID: ${item.id})`);
        console.log('      Column values:');
        item.column_values.forEach(col => {
          if (col.text) {
            console.log(`        - ${col.id}: ${col.text}`);
          }
        });
        console.log('');
      });
    }

    console.log('='.repeat(60));
    console.log('✓ Monday.com connection successful!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Next steps:');
    console.log('1. Identify which board contains your caregiver data');
    console.log('2. Note the column IDs for caregiver fields (name, phone, etc.)');
    console.log('3. Note the status column ID and value for "ready to enter"');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('✗ ERROR');
    console.error('='.repeat(60));
    console.error(`Error: ${error.message}`);
    console.error('');
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testMondayConnection().catch(console.error);
