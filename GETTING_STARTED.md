# Getting Started with HHA Exchange RPA Runner

## ✅ What's Already Done

Your RPA runner is now fully configured and ready to capture selectors:

### 1. ✅ Dependencies Installed
- npm packages installed
- Playwright Chromium browser installed
- All required libraries ready

### 2. ✅ Credentials Configured
- `.env` file created with your HHA Exchange credentials
- Username: `aaronshtein`
- Password: `AHS2025!home` (securely stored, not committed to git)

### 3. ✅ URLs Updated
- Login URL: `https://app.hhaexchange.com/identity/account/login`
- Base URL: `https://app.hhaexchange.com`
- All report URLs updated to use correct domain

### 4. ✅ Helper Tools Created
- `rpa/capture-selectors.js` - Interactive selector capture script
- `SELECTOR_CAPTURE_GUIDE.md` - Comprehensive documentation
- Ready to use Playwright codegen

## 🎯 Next Steps (What You Need to Do)

### Step 1: Capture Login Selectors (5 minutes)

The login page selectors are already configured with common patterns, but you should verify they work:

```bash
# Run the capture helper to verify login
node rpa/capture-selectors.js
```

This will:
1. Open HHA Exchange login page in a visible browser
2. Show you the login fields
3. Let you verify our selectors work
4. Guide you through completing login (including MFA if enabled)

**If login selectors don't work**, update them in `rpa/lib/login.js` lines 17-19.

### Step 2: Identify Your Reports (10 minutes)

Log into HHA Exchange manually and identify which reports you want to automate:

1. What is the report called?
2. How do you navigate to it? (which menus do you click?)
3. Does it have date range filters?
4. What button generates the report?
5. What button exports/downloads the report?
6. What does the downloaded filename look like?

**Make a list** - you'll need this information for the next step.

### Step 3: Capture Selectors for Your First Report (20 minutes)

Choose ONE report to start with. Use the capture helper:

```bash
node rpa/capture-selectors.js
```

Or use Playwright codegen for more control:

```bash
npm run rpa:codegen
```

**Follow the prompts** and capture:
- Menu navigation selectors (how to get to the report)
- Date range field selectors
- Generate/Run button selector
- Export/Download button selector
- Expected filename pattern

**Write them down** or keep the browser open for reference.

### Step 4: Update config.yaml (10 minutes)

Edit `rpa/config.yaml` and replace ONE of the placeholder reports with your real report.

Example - Replace `active_patients_auth` with your report:

```yaml
reports:
  my_actual_report:  # Give it a meaningful name
    description: "Description of what this report contains"
    start_url: "https://app.hhaexchange.com/reports/whatever"

    menu_steps:
      - type: click
        selector: 'a:has-text("Reports")'  # Your actual selector
        description: "Click Reports menu"

      - type: click
        selector: 'text=/Your Report Name/i'  # Your actual selector
        description: "Click your report name"

    date_range_selectors:
      from: 'input[name="startDate"]'  # Your actual selector
      to: 'input[name="endDate"]'      # Your actual selector

    run_button_selector: 'button:has-text("Generate")'  # If needed

    download_trigger:
      trigger_selector: 'button:has-text("Export to CSV")'  # Your actual selector
      trigger_type: click

    expected_filename_regex: 'YourReport.*\\.csv$'  # Match your actual filename

    validation:  # Optional
      required_columns:
        - "Column 1"
        - "Column 2"
      min_rows: 1
```

**Refer to `SELECTOR_CAPTURE_GUIDE.md`** for detailed examples and best practices.

### Step 5: Test Your First Report (10 minutes)

Run the automation in headful mode so you can watch it:

```bash
node rpa/run.js --report my_actual_report \
  --from 2024-01-01 --to 2024-01-31 \
  --headful
```

**Watch what happens:**
- ✅ If it works: Great! The file will be in `downloads/`
- ❌ If it fails: Check where it failed, update the selector in config.yaml, and try again

**Check the logs:**
```bash
# View the latest log
ls -lt logs/*.log | head -1 | xargs cat

# View screenshots if it failed
ls -lt logs/screenshots/ | head -5
```

### Step 6: Refine and Iterate (variable time)

Keep testing and updating selectors until the report downloads reliably:

```bash
# Test again
node rpa/run.js --report my_actual_report \
  --from 2024-01-01 --to 2024-01-31 \
  --headful --slow-mo 1000
```

**Common fixes needed:**
- Selector doesn't find element → Inspect element, get better selector
- Element not visible → May need to scroll or wait longer
- Wrong date format → Check if dates need different format
- Download doesn't start → Check export button selector

### Step 7: Add More Reports (repeat steps 3-6)

Once your first report works, add more reports to `config.yaml`:

1. Capture selectors for the next report
2. Add it to config.yaml
3. Test it
4. Refine until it works

### Step 8: Go to Production (when ready)

Once your reports work reliably:

```bash
# Run in headless mode (no browser window)
node rpa/run.js --report my_actual_report \
  --from 2024-01-01 --to 2024-01-31

# Schedule with cron (example: daily at 6 AM)
0 6 * * * cd /path/to/project && node rpa/run.js --report daily_visits --from $(date -d yesterday +\%Y-\%m-\%d) --to $(date -d yesterday +\%Y-\%m-\%d)
```

## 📚 Documentation Reference

- **README.md** - Main documentation with all features
- **SELECTOR_CAPTURE_GUIDE.md** - Detailed guide for capturing selectors
- **rpa/config.yaml** - Report configuration (you'll edit this)
- **rpa/lib/login.js** - Login configuration (edit if login selectors need updating)

## 🔧 Useful Commands

```bash
# Run capture helper (interactive)
node rpa/capture-selectors.js

# Run Playwright codegen
npm run rpa:codegen

# Test a report (headful mode)
node rpa/run.js --report NAME --from 2024-01-01 --to 2024-01-31 --headful

# Test with slow motion (good for debugging)
node rpa/run.js --report NAME --from 2024-01-01 --to 2024-01-31 --headful --slow-mo 2000

# Run in production (headless)
node rpa/run.js --report NAME --from 2024-01-01 --to 2024-01-31

# Force re-download even if file exists
node rpa/run.js --report NAME --from 2024-01-01 --to 2024-01-31 --force

# View latest log
ls -lt logs/*.log | head -1 | xargs cat

# View screenshots
ls -lt logs/screenshots/
```

## 🆘 Troubleshooting

### Login doesn't work

1. Check credentials in `.env` file
2. Run capture helper: `node rpa/capture-selectors.js`
3. Manually verify login page selectors
4. Update selectors in `rpa/lib/login.js` if needed

### Can't find element / Timeout error

1. Run in headful mode: `--headful`
2. Watch where it fails
3. Inspect that element in browser
4. Get the correct selector
5. Update config.yaml
6. Test again

### MFA challenge appears

1. Run with `--headful` flag
2. Complete MFA manually when prompted
3. Press ENTER in terminal to continue
4. Automation will continue after MFA

### Download doesn't work

1. Check the export button selector
2. Verify the filename pattern matches
3. Check if report needs time to generate first
4. Look at logs for specific error

### Need more help?

1. Check `SELECTOR_CAPTURE_GUIDE.md` for detailed examples
2. Check logs in `logs/` directory
3. Check screenshots in `logs/screenshots/`
4. Run capture helper: `node rpa/capture-selectors.js`

## 🎉 Success Criteria

You'll know it's working when:

1. ✅ Login succeeds automatically
2. ✅ Report page loads correctly
3. ✅ Date range is filled correctly
4. ✅ Report generates (if applicable)
5. ✅ File downloads successfully
6. ✅ File appears in `downloads/<timestamp>/` directory
7. ✅ Log shows "SUCCESS!" message
8. ✅ Exit code is 0

## 📊 Example Workflow

**Goal**: Automate the "Visits Report" for yesterday's data, run daily at 6 AM

1. **Capture selectors** (one time):
   ```bash
   node rpa/capture-selectors.js
   # Navigate to Visits Report, capture all selectors
   ```

2. **Update config.yaml** (one time):
   ```yaml
   daily_visits:
     description: "Daily visits report"
     start_url: "https://app.hhaexchange.com/reports/visits"
     # ... add selectors you captured
   ```

3. **Test** (until it works):
   ```bash
   node rpa/run.js --report daily_visits --from 2024-01-15 --to 2024-01-15 --headful
   ```

4. **Schedule** (production):
   ```bash
   # Add to crontab
   crontab -e
   # Add this line:
   0 6 * * * cd /path/to/project && node rpa/run.js --report daily_visits --from $(date -d yesterday +\%Y-\%m-\%d) --to $(date -d yesterday +\%Y-\%m-\%d) >> /var/log/hhae-rpa.log 2>&1
   ```

5. **Monitor**:
   - Check downloads directory for new files daily
   - Check logs for errors
   - Verify file sizes are reasonable

## 🎯 Quick Win: Start Here

**Want to get something working in the next 30 minutes?**

1. Run: `node rpa/capture-selectors.js`
2. Complete login (verify our selectors work)
3. Navigate to your simplest report
4. Capture the selectors
5. Edit `rpa/config.yaml` - replace one placeholder report
6. Test: `node rpa/run.js --report NAME --from 2024-01-01 --to 2024-01-31 --headful`
7. Iterate until it works

**You got this!** 🚀

---

## Still Stuck?

The most common issue is incorrect selectors. When in doubt:

1. **Run the capture helper**: `node rpa/capture-selectors.js`
2. **Use Playwright codegen**: `npm run rpa:codegen`
3. **Test selectors in browser console**: `document.querySelector('your-selector')`
4. **Check the guide**: `SELECTOR_CAPTURE_GUIDE.md` has examples
5. **Look at logs and screenshots**: `logs/` directory

Remember: Selector capture is the only manual step. Once you have the right selectors in config.yaml, the automation runs completely hands-free!
