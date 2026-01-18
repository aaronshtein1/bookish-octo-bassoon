/**
 * IMAP-based MFA code retrieval (simpler alternative to Azure AD)
 * Works with Outlook.com, Gmail, or any email provider that supports IMAP
 *
 * Setup:
 * 1. Enable IMAP in your email account
 * 2. For Outlook.com: Generate an app password at https://account.microsoft.com/security
 * 3. For Gmail: Enable "Less secure app access" or use an App Password
 * 4. Add credentials to .env file
 */

import Imap from 'imap';
import { simpleParser } from 'mailparser';

/**
 * IMAP configuration for different providers
 */
const IMAP_PROVIDERS = {
  'outlook.com': {
    host: 'outlook.office365.com',
    port: 993,
    tls: true
  },
  'hotmail.com': {
    host: 'outlook.office365.com',
    port: 993,
    tls: true
  },
  'gmail.com': {
    host: 'imap.gmail.com',
    port: 993,
    tls: true
  }
};

/**
 * Extract MFA code from email body
 * @param {string} text - Email text content
 * @param {string} html - Email HTML content
 * @returns {string|null} Extracted code or null
 */
function extractMFACodeFromEmail(text, html) {
  const content = text || html || '';

  const patterns = [
    /verification code is:?\s*([0-9]{6})/i,
    /your code is:?\s*([0-9]{6})/i,
    /security code:?\s*([0-9]{6})/i,
    /([0-9]{6})\s*is your verification code/i,
    /code:\s*([0-9]{6})/i,
    /\b([0-9]{6})\b/
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Get IMAP configuration for email provider
 * @param {string} email - User's email address
 * @returns {Object} IMAP config
 */
function getImapConfig(email) {
  const domain = email.split('@')[1].toLowerCase();
  return IMAP_PROVIDERS[domain] || {
    host: `imap.${domain}`,
    port: 993,
    tls: true
  };
}

/**
 * Connect to IMAP and search for MFA email
 * @param {string} email - User's email address
 * @param {string} password - Email password or app password
 * @param {Object} logger - Logger instance
 * @param {number} startTime - Timestamp to filter emails (only accept emails newer than this)
 * @returns {Promise<string|null>} MFA code or null
 */
async function searchIMAPForMFACode(email, password, logger, startTime = null) {
  return new Promise((resolve, reject) => {
    const imapConfig = getImapConfig(email);

    logger.debug(`Connecting to IMAP: ${imapConfig.host}:${imapConfig.port}`);

    const imap = new Imap({
      user: email,
      password: password,
      host: imapConfig.host,
      port: imapConfig.port,
      tls: imapConfig.tls,
      tlsOptions: { rejectUnauthorized: false }
    });

    let mfaCode = null;

    imap.once('ready', () => {
      logger.debug('IMAP connection established');

      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          logger.error(`Failed to open inbox: ${err.message}`);
          imap.end();
          return resolve(null);
        }

        logger.debug('Opened INBOX');

        // Search for emails from last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        // Search for emails from last 5 minutes with HHAeXchange subject
        const searchCriteria = [
          ['SINCE', fiveMinutesAgo],
          ['OR',
            ['SUBJECT', 'HHAeXchange'],
            ['OR',
              ['SUBJECT', 'Authentication Code'],
              ['OR', ['SUBJECT', 'verification'], ['SUBJECT', 'code']]
            ]
          ]
        ];

        logger.debug('Searching for MFA emails...');

        imap.search(searchCriteria, (err, results) => {
          if (err) {
            logger.debug(`Search error (may be expected): ${err.message}`);
            // Try a simpler search
            imap.search(['ALL'], async (err2, results2) => {
              if (err2) {
                logger.error(`Failed to search emails: ${err2.message}`);
                imap.end();
                return resolve(null);
              }

              await processResults(imap, results2.slice(-10), logger, startTime)
                .then(code => { mfaCode = code; })
                .catch(() => {});

              imap.end();
            });
            return;
          }

          logger.debug(`Found ${results.length} matching emails`);

          processResults(imap, results.slice(-10), logger, startTime)
            .then(code => {
              mfaCode = code;
              imap.end();
            })
            .catch(() => {
              imap.end();
            });
        });
      });
    });

    imap.once('error', (err) => {
      logger.error(`IMAP error: ${err.message}`);
      resolve(null);
    });

    imap.once('end', () => {
      logger.debug('IMAP connection closed');
      resolve(mfaCode);
    });

    imap.connect();
  });
}

/**
 * Process email search results
 * @param {Imap} imap - IMAP connection
 * @param {Array} messageIds - Array of message IDs
 * @param {Object} logger - Logger instance
 * @param {number} startTime - Timestamp to filter emails (only accept emails newer than this)
 * @returns {Promise<string|null>} MFA code or null
 */
async function processResults(imap, messageIds, logger, startTime = null) {
  if (!messageIds || messageIds.length === 0) {
    logger.debug('No messages to process');
    return null;
  }

  return new Promise((resolve) => {
    const fetch = imap.fetch(messageIds, { bodies: '' });
    let foundCode = null;

    fetch.on('message', (msg) => {
      msg.on('body', (stream) => {
        simpleParser(stream, (err, parsed) => {
          if (err) {
            logger.debug(`Failed to parse email: ${err.message}`);
            return;
          }

          const subject = parsed.subject || '';
          const from = parsed.from?.text || '';
          const emailDate = parsed.date || new Date(0);

          logger.debug(`Checking email: "${subject}" from ${from}, date: ${emailDate}`);

          // Check if email is fresh enough (only if startTime provided)
          if (startTime) {
            const emailTimestamp = emailDate.getTime();
            if (emailTimestamp < startTime) {
              logger.debug(`Skipping old email (received before MFA request started)`);
              return;
            }
          }

          // Check if from HHA Exchange (be flexible with sender check)
          const isHHAEmail = from.toLowerCase().includes('hhaexchange') ||
                           from.toLowerCase().includes('noreply') ||
                           subject.toLowerCase().includes('hhaexchange');

          if (!isHHAEmail) {
            logger.debug('Skipping email - not from HHAeXchange');
            return;
          }

          const code = extractMFACodeFromEmail(parsed.text, parsed.html);
          if (code) {
            logger.info(`Found MFA code in email: "${subject}"`);
            foundCode = code;
          }
        });
      });
    });

    fetch.once('error', (err) => {
      logger.error(`Fetch error: ${err.message}`);
      resolve(null);
    });

    fetch.once('end', () => {
      setTimeout(() => resolve(foundCode), 500); // Small delay to ensure parsing completes
    });
  });
}

/**
 * Get MFA code from email via IMAP
 * @param {Object} logger - Logger instance
 * @returns {Promise<string|null>} MFA code or null
 */
export async function getMFACodeViaIMAP(logger) {
  try {
    const email = process.env.HHAE_EMAIL || process.env.HHAE_USERNAME;
    const emailPassword = process.env.EMAIL_PASSWORD || process.env.EMAIL_APP_PASSWORD;

    if (!email || !emailPassword) {
      logger.debug('IMAP credentials not configured (EMAIL_PASSWORD not set)');
      return null;
    }

    logger.info('Attempting to retrieve MFA code via IMAP...');
    logger.info(`Email: ${email}`);
    logger.info('Waiting for NEW MFA email (ignoring old ones)...');

    // Record start time to only accept fresh emails
    const startTime = Date.now();

    // Poll for email with retries
    const maxAttempts = 18; // 18 attempts = 1.5 minutes (allow time for email forwarding)
    const delayBetweenAttempts = 5000; // 5 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      logger.debug(`IMAP check attempt ${attempt}/${maxAttempts}...`);

      const code = await searchIMAPForMFACode(email, emailPassword, logger, startTime);

      if (code) {
        logger.info(`Successfully retrieved MFA code via IMAP: ${code}`);
        return code;
      }

      if (attempt < maxAttempts) {
        logger.debug(`No MFA email found yet. Waiting ${delayBetweenAttempts / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
      }
    }

    logger.warn('Timed out waiting for MFA email via IMAP');
    return null;

  } catch (error) {
    logger.error(`Error retrieving MFA code via IMAP: ${error.message}`);
    return null;
  }
}
