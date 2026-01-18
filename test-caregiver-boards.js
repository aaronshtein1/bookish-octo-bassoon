#!/usr/bin/env node

/**
 * Test and examine caregiver boards
 */

import dotenv from 'dotenv';
import { createLogger } from './rpa/lib/logger.js';
import { getBoards, getBoardColumns, getBoardItems } from './rpa/lib/monday.js';

dotenv.config();

async function examineBoards() {
  const sessionId = 'caregiver-boards-test';
  const logger = createLogger(sessionId);

  console.log('='.repeat(60));
  console.log('EXAMINING CAREGIVER BOARDS');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Get all boards first
    const boards = await getBoards(logger);

    // Find the caregiver boards
    const caregiverBoards = boards.filter(board =>
      board.name.includes('HHA/PCA') &&
      (board.name.includes('Submitted Applicants') || board.name.includes('Hiring'))
    );

    if (caregiverBoards.length === 0) {
      console.log('Looking for boards with names:');
      console.log('  - HHA/PCA Submitted Applicants');
      console.log('  - HHA/PCA Hiring');
      console.log('');
      console.log('Found boards:');
      boards.forEach(board => {
        if (board.name.toLowerCase().includes('hha') ||
            board.name.toLowerCase().includes('pca') ||
            board.name.toLowerCase().includes('hiring') ||
            board.name.toLowerCase().includes('applicant')) {
          console.log(`  - ${board.name} (ID: ${board.id})`);
        }
      });
      return;
    }

    console.log(`Found ${caregiverBoards.length} caregiver board(s):`);
    console.log('');

    for (const board of caregiverBoards) {
      console.log('='.repeat(60));
      console.log(`BOARD: ${board.name}`);
      console.log(`ID: ${board.id}`);
      console.log('='.repeat(60));
      console.log('');

      // Get columns
      console.log('Columns:');
      const columns = await getBoardColumns(board.id, logger);

      columns.forEach((col, index) => {
        console.log(`  [${index + 1}] ${col.title}`);
        console.log(`      ID: "${col.id}"`);
        console.log(`      Type: ${col.type}`);

        // Show status options if it's a status column
        if (col.type === 'status' && col.settings_str) {
          try {
            const settings = JSON.parse(col.settings_str);
            if (settings.labels) {
              console.log('      Status options:');
              Object.keys(settings.labels).forEach(key => {
                console.log(`        - "${settings.labels[key]}" (index: ${key})`);
              });
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
        console.log('');
      });

      // Get sample items
      console.log('Sample Items (first 3):');
      const items = await getBoardItems(board.id, null, null, logger);

      items.slice(0, 3).forEach((item, index) => {
        console.log(`\n  [${index + 1}] ${item.name} (ID: ${item.id})`);
        console.log('      Fields:');
        item.column_values.forEach(col => {
          if (col.text && col.text.trim()) {
            console.log(`        ${col.id}: "${col.text}"`);
          }
        });
      });

      console.log('\n');
    }

    console.log('='.repeat(60));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(60));
    console.log('');
    console.log('Next: Tell me which board to use and I\'ll create the mapping!');

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

examineBoards().catch(console.error);
