# Automatic MFA Setup Guide

This guide will help you set up automatic MFA code retrieval from your Outlook email, allowing the RPA to run completely unattended in headless mode.

## Overview

When HHA Exchange sends an MFA code to your Outlook email, the RPA will:
1. Automatically read the email using Microsoft Graph API
2. Extract the 6-digit verification code
3. Enter it into the MFA form
4. Continue with the automation

## Setup Steps

### Step 1: Register an Azure AD Application

1. Go to [Azure Portal - App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **"+ New registration"**
3. Fill in:
   - **Name**: `HHA Exchange RPA Email Reader` (or any name you prefer)
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: Leave blank
4. Click **"Register"**
5. **Copy the following values** (you'll need them later):
   - **Application (client) ID** → This is your `AZURE_CLIENT_ID`
   - **Directory (tenant) ID** → This is your `AZURE_TENANT_ID`

### Step 2: Create a Client Secret

1. In your app registration, go to **"Certificates & secrets"** in the left menu
2. Click **"+ New client secret"**
3. Fill in:
   - **Description**: `RPA Email Access`
   - **Expires**: Choose an appropriate duration (e.g., 24 months)
4. Click **"Add"**
5. **IMMEDIATELY COPY THE SECRET VALUE** → This is your `AZURE_CLIENT_SECRET`
   - ⚠️ **Important**: You can only see this value once! Save it now.

### Step 3: Configure API Permissions

1. In your app registration, go to **"API permissions"** in the left menu
2. Click **"+ Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Application permissions"** (not Delegated permissions)
5. Search for and select:
   - **Mail.Read** (under Mail)
6. Click **"Add permissions"**
7. Click **"Grant admin consent for [your organization]"**
   - ⚠️ You need admin rights to do this. If you don't have admin rights, contact your IT admin.
8. Verify the status shows a green checkmark

### Step 4: Update Your .env File

Add the following to your `.env` file:

```env
# Your existing credentials
HHAE_USERNAME=your-username
HHAE_PASSWORD=your-password
HHAE_EMAIL=your-email@outlook.com

# Azure AD Configuration for Automatic MFA
AZURE_CLIENT_ID=paste-your-client-id-here
AZURE_CLIENT_SECRET=paste-your-client-secret-here
AZURE_TENANT_ID=paste-your-tenant-id-here
```

### Step 5: Install Dependencies

```bash
npm install
```

### Step 6: Test the Setup

Run a test login to verify everything works:

```bash
node test-login-only.js
```

If configured correctly, you should see:
```
Attempting automatic MFA code retrieval from email...
Successfully authenticated with Microsoft Graph
Checking for MFA email (attempt 1)...
Successfully retrieved MFA code from email: 123456
MFA code entered automatically...
MFA completed successfully
```

## Troubleshooting

### Error: "Azure AD credentials not configured"
- Make sure all three Azure variables are set in `.env`
- Check for typos in the variable names

### Error: "Failed to fetch emails: 401 Unauthorized"
- Your client secret may be incorrect or expired
- Verify the Application (client) ID and Tenant ID are correct
- Make sure admin consent was granted

### Error: "Timed out waiting for MFA email"
- Check that `HHAE_EMAIL` matches the email where MFA codes are sent
- Verify the email sender in `rpa/lib/mfa-email.js` matches the actual sender
- The default sender is `noreply@hhaexchange.com` - adjust if different

### Email sender configuration

If your MFA emails come from a different sender, edit `rpa/lib/mfa-email.js`:

```javascript
const MFA_EMAIL_CONFIG = {
  emailCriteria: {
    sender: 'actual-sender@domain.com',  // Change this
    // ...
  }
};
```

## Running with Automatic MFA

Once configured, you can run the RPA in fully automated headless mode:

```bash
# Headless mode - completely automated
node rpa/run.js --report active_patients_auth --from 2024-01-01 --to 2024-01-31

# The RPA will:
# 1. Login with username/password
# 2. Detect MFA requirement
# 3. Wait for email with code
# 4. Extract and enter code automatically
# 5. Continue with report download
```

## Fallback to Manual MFA

If automatic MFA fails or is not configured, the RPA will:
- In **headful mode** (`--headful`): Pause and ask you to enter the code manually
- In **headless mode**: Fail with an error message

## Security Notes

- Keep your `.env` file secure and never commit it to git
- The client secret has the same security importance as a password
- Consider using a shorter expiration time for the client secret
- The app only has Mail.Read permission (read-only access to emails)
- Regularly review the app's activity in Azure AD

## Alternative: IMAP-based Email Reading

If you cannot get Azure AD admin consent, you can use IMAP instead. This requires different setup but doesn't need Azure AD permissions. Let me know if you'd like instructions for IMAP-based MFA.
