#!/usr/bin/env node

/**
 * Examine specific caregiver boards
 */

import dotenv from 'dotenv';
import { createLogger } from './rpa/lib/logger.js';
import { getBoardColumns, getBoardItems } from './rpa/lib/monday.js';

dotenv.config();

async function examineSpecificBoards() {
  const sessionId = 'examine-boards';
  const logger = createLogger(sessionId);

  const boardIds = [
    '6050787001', // HHA/PCA Submitted Applicants
    '6119848729'  // HHA/PCA Hiring
  ];

  console.log('='.repeat(60));
  console.log('EXAMINING CAREGIVER BOARDS');
  console.log('='.repeat(60));
  console.log('');

  for (const boardId of boardIds) {
    try {
      console.log('='.repeat(60));
      console.log(`BOARD ID: ${boardId}`);
      console.log('='.repeat(60));
      console.log('');

      // Get columns
      console.log('COLUMNS:');
      console.log('-'.repeat(60));
      const columns = await getBoardColumns(boardId, logger);

      columns.forEach((col, index) => {
        console.log(`[${index + 1}] ${col.title}`);
        console.log(`    ID: "${col.id}"`);
        console.log(`    Type: ${col.type}`);

        // Show status options if it's a status column
        if (col.type === 'status' && col.settings_str) {
          try {
            const settings = JSON.parse(col.settings_str);
            if (settings.labels) {
              console.log('    Status Options:');
              Object.keys(settings.labels).forEach(key => {
                console.log(`      [${key}] "${settings.labels[key]}"`);
              });
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
        console.log('');
      });

      // Get sample items
      console.log('\nSAMPLE ITEMS (First 3):');
      console.log('-'.repeat(60));
      const items = await getBoardItems(boardId, null, null, logger);

      console.log(`Total items in board: ${items.length}`);
      console.log('');

      items.slice(0, 3).forEach((item, index) => {
        console.log(`[${index + 1}] ${item.name}`);
        console.log(`    Monday Item ID: ${item.id}`);
        console.log('    Fields:');

        item.column_values.forEach(col => {
          if (col.text && col.text.trim()) {
            console.log(`      ${col.id}: "${col.text}"`);
          }
        });
        console.log('');
      });

      console.log('\n');

    } catch (error) {
      console.error(`Error examining board ${boardId}:`, error.message);
      console.log('');
    }
  }

  console.log('='.repeat(60));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(60));
  console.log('');
  console.log('Now I can create the field mapping and automation!');
  console.log('');
}

examineSpecificBoards().catch(console.error);
