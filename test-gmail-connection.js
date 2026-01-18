#!/usr/bin/env node

/**
 * Test Gmail IMAP connection
 */

import Imap from 'imap';
import { simpleParser } from 'mailparser';
import dotenv from 'dotenv';

dotenv.config();

async function testGmailConnection() {
  console.log('='.repeat(60));
  console.log('GMAIL IMAP CONNECTION TEST');
  console.log('='.repeat(60));
  console.log('');

  const email = process.env.HHAE_EMAIL;
  const password = process.env.EMAIL_PASSWORD;

  console.log(`Email: ${email}`);
  console.log(`Password: ${password ? '***SET*** (length: ' + password.replace(/ /g, '').length + ')' : 'NOT SET'}`);
  console.log('');

  if (!email || !password) {
    console.error('ERROR: EMAIL and PASSWORD must be set in .env');
    process.exit(1);
  }

  return new Promise((resolve) => {
    const imap = new Imap({
      user: email,
      password: password.replace(/ /g, ''), // Remove spaces from Gmail app password
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    console.log('Connecting to Gmail IMAP...');

    imap.once('ready', () => {
      console.log('✓ Connected to Gmail successfully!');

      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          console.error('✗ Failed to open INBOX:', err.message);
          imap.end();
          return resolve();
        }

        console.log(`✓ Opened INBOX (${box.messages.total} total messages)`);
        console.log('');
        console.log('Fetching last 5 emails...');

        // Get last 5 emails
        const fetch = imap.seq.fetch(`${Math.max(1, box.messages.total - 4)}:*`, {
          bodies: '',
          struct: true
        });

        let count = 0;

        fetch.on('message', (msg, seqno) => {
          msg.on('body', (stream) => {
            simpleParser(stream, (err, parsed) => {
              if (err) {
                console.error(`Error parsing email ${seqno}:`, err.message);
                return;
              }

              count++;
              const from = parsed.from?.text || 'Unknown';
              const subject = parsed.subject || '(no subject)';
              const date = parsed.date || new Date();

              console.log(`\n[Email ${count}]`);
              console.log(`  From: ${from}`);
              console.log(`  Subject: ${subject}`);
              console.log(`  Date: ${date}`);

              // Check if it's an MFA email
              if (subject.toLowerCase().includes('hhaexchange') ||
                  subject.toLowerCase().includes('authentication') ||
                  subject.toLowerCase().includes('code')) {
                console.log('  >>> THIS LOOKS LIKE AN MFA EMAIL! <<<');

                // Try to extract code
                const text = parsed.text || '';
                const patterns = [
                  /verification code is:?\s*([0-9]{6})/i,
                  /your code is:?\s*([0-9]{6})/i,
                  /([0-9]{6})\s*is your/i,
                  /code:\s*([0-9]{6})/i,
                  /\b([0-9]{6})\b/
                ];

                for (const pattern of patterns) {
                  const match = text.match(pattern);
                  if (match && match[1]) {
                    console.log(`  >>> FOUND CODE: ${match[1]} <<<`);
                    break;
                  }
                }
              }
            });
          });
        });

        fetch.once('error', (err) => {
          console.error('✗ Fetch error:', err.message);
        });

        fetch.once('end', () => {
          console.log('\n' + '='.repeat(60));
          console.log('Test complete!');
          console.log('='.repeat(60));
          setTimeout(() => {
            imap.end();
          }, 1000);
        });
      });
    });

    imap.once('error', (err) => {
      console.error('✗ IMAP connection error:', err.message);
      console.log('');
      console.log('Common issues:');
      console.log('1. Gmail app password has spaces - they should be removed automatically');
      console.log('2. 2-Step Verification not enabled on Gmail account');
      console.log('3. IMAP not enabled in Gmail settings');
      console.log('');
      console.log('To enable IMAP in Gmail:');
      console.log('1. Go to Gmail → Settings → See all settings');
      console.log('2. Go to "Forwarding and POP/IMAP" tab');
      console.log('3. Enable IMAP');
      console.log('4. Save changes');
      resolve();
    });

    imap.once('end', () => {
      console.log('\nConnection closed.');
      resolve();
    });

    imap.connect();
  });
}

testGmailConnection().catch(console.error);
