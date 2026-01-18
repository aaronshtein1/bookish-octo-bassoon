# Quick MFA Automation Setup (5 Minutes)

This is the **easiest way** to set up automatic MFA for your RPA. No Azure AD registration needed!

## Option 1: IMAP (Recommended - Easiest)

### Step 1: Generate an App Password for Your Email

#### For Outlook.com / Hotmail:
1. Go to https://account.microsoft.com/security
2. Click "Advanced security options"
3. Scroll to "App passwords"
4. Click "Create a new app password"
5. Copy the generated password (looks like: `abcd-efgh-ijkl-mnop`)

#### For Gmail:
1. Go to https://myaccount.google.com/apppasswords
2. Select app: "Mail"
3. Select device: "Other" → Type "RPA Automation"
4. Click "Generate"
5. Copy the 16-character password

### Step 2: Update Your .env File

Add this line to your `.env` file:

```env
HHAE_EMAIL=your-email@outlook.com
EMAIL_PASSWORD=your-app-password-here
```

**Example:**
```env
HHAE_EMAIL=aaronshtein@outlook.com
EMAIL_PASSWORD=abcd-efgh-ijkl-mnop
```

### Step 3: Test It!

Run the test:
```bash
node test-login-only.js
```

You should see:
```
Using IMAP for MFA code retrieval...
Email: your-email@outlook.com
IMAP connection established
Found MFA code in email: "Your verification code"
Successfully retrieved MFA code via IMAP: 123456
MFA code entered automatically...
✓ LOGIN TEST PASSED
```

## That's It!

Once configured, you can run the RPA in fully automated headless mode:

```bash
node rpa/run.js --report active_patients_auth --from 2024-01-01 --to 2024-01-31
```

The RPA will automatically:
1. Login with username/password
2. Detect MFA requirement
3. Read your email to get the code
4. Enter the code automatically
5. Continue with the report download

## Troubleshooting

### "IMAP connection failed"
- Make sure you generated an **App Password**, not your regular email password
- For Outlook: Make sure IMAP is enabled in settings
- For Gmail: Make sure "Less secure app access" is enabled OR you're using an App Password

### "No MFA email found"
- Check that `HHAE_EMAIL` is the email address where you receive MFA codes
- Wait a few seconds - sometimes emails take time to arrive
- Check your email manually to see if the code arrived

### Still not working?
- Try the Azure AD method instead (see SETUP-MFA-AUTOMATION.md)
- Or use `--headful` flag to enter MFA manually

## Security Note

- The app password only has permission to read emails
- It's more secure than your main password
- You can revoke it anytime from your account security settings
- Don't share your `.env` file - it's in `.gitignore` for security
