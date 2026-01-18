/**
 * Email-based MFA code retrieval
 * Supports Microsoft Outlook via Graph API
 *
 * Setup instructions:
 * 1. Register an app in Azure AD (https://portal.azure.com)
 * 2. Add Microsoft Graph API permissions: Mail.Read
 * 3. Generate a client secret
 * 4. Add credentials to .env file
 */

import { ConfidentialClientApplication } from '@azure/msal-node';

/**
 * Email MFA configuration
 */
const MFA_EMAIL_CONFIG = {
  // How long to wait for email (milliseconds)
  maxWaitTime: 30000, // 30 seconds

  // How often to check for new emails
  checkInterval: 5000, // 5 seconds

  // Email search criteria
  emailCriteria: {
    sender: 'noreply@hhaexchange.com', // Adjust based on actual sender
    subjectKeywords: ['verification', 'code', 'login', 'mfa'],
    maxAge: 300 // Only check emails from last 5 minutes
  }
};

/**
 * Extract MFA code from email body
 * @param {string} emailBody - Email HTML or text content
 * @returns {string|null} Extracted code or null
 */
function extractMFACode(emailBody) {
  // Common patterns for MFA codes
  const patterns = [
    /verification code is:?\s*([0-9]{6})/i,
    /your code is:?\s*([0-9]{6})/i,
    /security code:?\s*([0-9]{6})/i,
    /([0-9]{6})\s*is your verification code/i,
    /code:\s*([0-9]{6})/i,
    /\b([0-9]{6})\b/  // Fallback: any 6-digit number
  ];

  for (const pattern of patterns) {
    const match = emailBody.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Initialize Microsoft Graph client
 * @param {Object} config - Azure AD configuration
 * @returns {ConfidentialClientApplication} MSAL client
 */
function initializeMSALClient(config) {
  const msalConfig = {
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      clientSecret: config.clientSecret
    }
  };

  return new ConfidentialClientApplication(msalConfig);
}

/**
 * Get access token for Microsoft Graph
 * @param {ConfidentialClientApplication} client - MSAL client
 * @returns {Promise<string>} Access token
 */
async function getAccessToken(client) {
  const tokenRequest = {
    scopes: ['https://graph.microsoft.com/.default']
  };

  const response = await client.acquireTokenByClientCredential(tokenRequest);
  return response.accessToken;
}

/**
 * Search for MFA email in Outlook
 * @param {string} accessToken - Microsoft Graph access token
 * @param {string} userEmail - User's email address
 * @param {Object} logger - Logger instance
 * @returns {Promise<string|null>} MFA code or null
 */
async function searchOutlookForMFACode(accessToken, userEmail, logger) {
  const { default: fetch } = await import('node-fetch');

  // Calculate time filter (last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - MFA_EMAIL_CONFIG.emailCriteria.maxAge * 1000);
  const timeFilter = fiveMinutesAgo.toISOString();

  // Build search query
  const filter = `receivedDateTime ge ${timeFilter}`;
  const search = MFA_EMAIL_CONFIG.emailCriteria.subjectKeywords.join(' OR ');

  const url = `https://graph.microsoft.com/v1.0/users/${userEmail}/messages?$filter=${encodeURIComponent(filter)}&$search="${encodeURIComponent(search)}"&$orderby=receivedDateTime DESC&$top=10`;

  logger.debug(`Searching for MFA email: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'ConsistencyLevel': 'eventual'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch emails: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const messages = data.value || [];

  logger.debug(`Found ${messages.length} recent emails`);

  // Search through emails for MFA code
  for (const message of messages) {
    const sender = message.from?.emailAddress?.address || '';
    const subject = message.subject || '';
    const body = message.body?.content || '';

    logger.debug(`Checking email from ${sender}: ${subject}`);

    // Check if sender matches (if configured)
    if (MFA_EMAIL_CONFIG.emailCriteria.sender &&
        !sender.toLowerCase().includes(MFA_EMAIL_CONFIG.emailCriteria.sender.toLowerCase())) {
      continue;
    }

    // Try to extract code
    const code = extractMFACode(body);
    if (code) {
      logger.info(`Found MFA code in email from ${sender}`);
      return code;
    }
  }

  return null;
}

/**
 * Wait for and retrieve MFA code from email
 * @param {Object} logger - Logger instance
 * @returns {Promise<string|null>} MFA code or null
 */
export async function getMFACodeFromEmail(logger) {
  try {
    // Try IMAP first (simpler setup)
    const emailPassword = process.env.EMAIL_PASSWORD || process.env.EMAIL_APP_PASSWORD;

    if (emailPassword) {
      logger.info('Using IMAP for MFA code retrieval...');
      const { getMFACodeViaIMAP } = await import('./mfa-email-imap.js');
      const code = await getMFACodeViaIMAP(logger);
      if (code) {
        return code;
      }
      logger.warn('IMAP method did not find MFA code, trying Microsoft Graph...');
    }

    // Load configuration from environment
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.AZURE_TENANT_ID;
    const userEmail = process.env.HHAE_EMAIL || process.env.HHAE_USERNAME;

    if (!clientId || !clientSecret || !tenantId) {
      logger.warn('Email MFA automation not configured.');
      logger.info('To enable automatic MFA:');
      logger.info('  Option 1 (Simpler): Set EMAIL_PASSWORD or EMAIL_APP_PASSWORD in .env for IMAP');
      logger.info('  Option 2 (More secure): Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID in .env for Microsoft Graph');
      return null;
    }

    logger.info('Starting email-based MFA code retrieval...');
    logger.info(`Monitoring email: ${userEmail}`);

    // Initialize Microsoft Graph client
    const client = initializeMSALClient({ clientId, clientSecret, tenantId });
    const accessToken = await getAccessToken(client);

    logger.info('Successfully authenticated with Microsoft Graph');

    // Poll for email
    const startTime = Date.now();
    let attempts = 0;

    while (Date.now() - startTime < MFA_EMAIL_CONFIG.maxWaitTime) {
      attempts++;
      logger.debug(`Checking for MFA email (attempt ${attempts})...`);

      const code = await searchOutlookForMFACode(accessToken, userEmail, logger);

      if (code) {
        logger.info(`Successfully retrieved MFA code from email: ${code}`);
        return code;
      }

      // Wait before next check
      logger.debug(`No MFA email found yet. Waiting ${MFA_EMAIL_CONFIG.checkInterval / 1000}s before next check...`);
      await new Promise(resolve => setTimeout(resolve, MFA_EMAIL_CONFIG.checkInterval));
    }

    logger.warn('Timed out waiting for MFA email');
    return null;

  } catch (error) {
    logger.error(`Error retrieving MFA code from email: ${error.message}`);
    return null;
  }
}

/**
 * Update MFA email configuration
 * @param {Object} config - Partial config to update
 */
export function updateMFAEmailConfig(config) {
  Object.assign(MFA_EMAIL_CONFIG.emailCriteria, config);
}
