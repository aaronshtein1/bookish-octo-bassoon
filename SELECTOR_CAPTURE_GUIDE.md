# HHA Exchange Selector Capture Guide

This guide will help you capture the correct selectors for HHA Exchange reports.

## Quick Start

### Method 1: Use the Helper Script (Recommended)

```bash
node rpa/capture-selectors.js
```

This script will:
1. Open HHA Exchange in a visible browser
2. Pause at key points for you to inspect elements
3. Guide you through capturing all necessary selectors

### Method 2: Use Playwright Codegen

```bash
npm run rpa:codegen
```

This opens Playwright's codegen tool where you can:
1. Click through the UI
2. See generated selectors in real-time
3. Copy selectors to config.yaml

### Method 3: Manual Browser Inspection

1. Open https://app.hhaexchange.com/identity/account/login in Chrome
2. Open DevTools (F12)
3. Use the element picker (Ctrl+Shift+C / Cmd+Option+C)
4. Click elements to see their selectors
5. Test selectors in Console: `document.querySelector('your-selector')`

## What Selectors to Capture

### 1. Login Page Selectors

**Already configured in `rpa/lib/login.js`:**
- ✅ Login URL: `https://app.hhaexchange.com/identity/account/login`
- ✅ Username field: `input[name="username"], input[type="email"], input#username`
- ✅ Password field: `input[name="password"], input[type="password"], input#password`
- ✅ Login button: `button[type="submit"], button:has-text("Login")`

**Verify these work** - if not, update in `rpa/lib/login.js` line 17-19.

### 2. Landing Page After Login

**Check what appears after successful login:**
- Dashboard elements
- Navigation menu
- User profile menu

**Update in `rpa/lib/login.js` line 21-25** if needed.

### 3. Report Selectors

For each report in `rpa/config.yaml`, you need to capture:

#### A. Navigation to the Report

**Menu Steps** - How to get to the report:

Example:
```yaml
menu_steps:
  - type: click
    selector: 'a[href*="reports"]'  # Main Reports menu
    description: "Click Reports in navigation"

  - type: click
    selector: 'text=/Patients/i'   # Submenu
    description: "Click Patients submenu"
```

**How to capture:**
1. From the dashboard, click to navigate to your report
2. For each click, inspect that element and note its selector
3. Prefer stable selectors (see tips below)

#### B. Date Range Fields

Most reports have date filters:

```yaml
date_range_selectors:
  from: 'input[name="startDate"]'   # Capture this
  to: 'input[name="endDate"]'       # Capture this
```

**How to find:**
1. Inspect the "From" date input field
2. Look for `name`, `id`, or `data-` attributes
3. Prefer: `input[name="..."]` or `input#id`

#### C. Run/Generate Button

Some reports require clicking "Generate" or "Run":

```yaml
run_button_selector: 'button:has-text("Generate Report")'
```

**How to find:**
1. Look for button that triggers report generation
2. Use text-based selector if button text is stable
3. Fallback to `button[type="submit"]` or specific class

#### D. Download/Export Trigger

The button that downloads the report:

```yaml
download_trigger:
  trigger_selector: 'button:has-text("Export to CSV")'
  trigger_type: click
```

**How to find:**
1. Look for Export, Download, or Save button
2. Note exact button text
3. Inspect for `id` or `data-action` attributes

#### E. Expected Filename Pattern

After download, what filename pattern to expect:

```yaml
expected_filename_regex: '(patients|authorization).*\.(csv|xlsx)$'
```

**How to determine:**
1. Manually download a report
2. Note the filename format
3. Create a regex pattern that matches it

**Examples:**
- `report_2024-01-01.csv` → `'report.*\\.csv$'`
- `Patients_Export_20240101.xlsx` → `'Patients.*\\.xlsx$'`
- `visits-2024-01-01-to-2024-01-31.csv` → `'visits.*\\.csv$'`

## Selector Best Practices

### ✅ Preferred Selector Types (in order)

1. **Text content** (most stable):
   ```javascript
   'button:has-text("Export")'
   'text=/Download/i'  // case insensitive
   'a:has-text("Reports")'
   ```

2. **Data attributes**:
   ```javascript
   '[data-testid="export-button"]'
   '[data-action="download"]'
   ```

3. **Name attribute**:
   ```javascript
   'input[name="startDate"]'
   'button[name="generate"]'
   ```

4. **ID**:
   ```javascript
   '#exportButton'
   'input#startDate'
   ```

5. **CSS class** (least stable):
   ```javascript
   '.btn-primary.export-btn'
   ```

### ❌ Avoid

- Position-based: `div:nth-child(3)`
- Auto-generated classes: `._abc123xyz`
- Overly specific: `div > div > div > button.btn`

### Multiple Fallback Selectors

Use comma-separated selectors for reliability:

```yaml
selector: 'button:has-text("Export"), #exportBtn, [data-action="export"]'
```

Playwright will try each selector in order until one works.

## Testing Your Selectors

### Quick Test in Browser Console

```javascript
// Test if selector works
document.querySelector('button:has-text("Export")')

// Should return the element or null
```

### Test with Playwright

```bash
# Run in headful mode with slow motion to watch
node rpa/run.js --report active_patients_auth \
  --from 2024-01-01 --to 2024-01-31 \
  --headful --slow-mo 1000
```

Watch the browser and see where it fails, then update selectors.

## Example: Capturing a Complete Report

Let's say you want to automate the "Patient Census" report:

### Step 1: Navigate Manually
1. Log into HHA Exchange
2. Click Reports → Census → Patient Census
3. Fill date range: 2024-01-01 to 2024-01-31
4. Click "Generate Report"
5. Click "Export to CSV"
6. Note the downloaded filename: `PatientCensus_2024-01-01_2024-01-31.csv`

### Step 2: Capture Selectors

While doing the above, capture:

1. **Reports menu**: `'nav a:has-text("Reports")'`
2. **Census submenu**: `'text=/Census/i'`
3. **Patient Census option**: `'a:has-text("Patient Census")'`
4. **From date**: `'input[name="startDate"]'`
5. **To date**: `'input[name="endDate"]'`
6. **Generate button**: `'button:has-text("Generate")'`
7. **Export button**: `'button:has-text("Export to CSV")'`

### Step 3: Add to config.yaml

```yaml
patient_census:
  description: "Patient census report"
  start_url: "https://app.hhaexchange.com/reports"

  menu_steps:
    - type: click
      selector: 'nav a:has-text("Reports")'
      description: "Open Reports menu"

    - type: click
      selector: 'text=/Census/i'
      description: "Click Census section"

    - type: click
      selector: 'a:has-text("Patient Census")'
      description: "Select Patient Census report"

  date_range_selectors:
    from: 'input[name="startDate"]'
    to: 'input[name="endDate"]'

  run_button_selector: 'button:has-text("Generate")'

  download_trigger:
    trigger_selector: 'button:has-text("Export to CSV")'
    trigger_type: click

  expected_filename_regex: 'PatientCensus.*\\.csv$'

  validation:
    required_columns:
      - "Patient ID"
      - "Patient Name"
      - "Admission Date"
    min_rows: 1
```

### Step 4: Test

```bash
node rpa/run.js --report patient_census \
  --from 2024-01-01 --to 2024-01-31 \
  --headful
```

### Step 5: Iterate

If it fails:
1. Check logs in `logs/` directory
2. Check screenshots in `logs/screenshots/`
3. Update selectors in config.yaml
4. Test again

## Common Issues

### Issue: "Timeout waiting for selector"

**Solution:**
- Selector is wrong or element doesn't exist
- Run in headful mode and watch where it fails
- Inspect the element and get correct selector
- Update config.yaml

### Issue: "Download timeout"

**Solutions:**
1. Check `expected_filename_regex` matches actual filename
2. Report might take longer to generate - increase timeout in `rpa/lib/downloads.js`
3. Export button might not be visible - check if you need to scroll or click a tab first

### Issue: Login fails

**Solutions:**
1. Check credentials in `.env`
2. Inspect login page for correct field selectors
3. Update selectors in `rpa/lib/login.js` lines 17-19
4. Check if MFA is enabled (use `--headful` to complete it manually)

## Need Help?

1. Run the capture helper: `node rpa/capture-selectors.js`
2. Check logs in `logs/` directory
3. Check screenshots in `logs/screenshots/`
4. Use Playwright codegen: `npm run rpa:codegen`
5. Test selectors in browser console first

## Quick Reference Card

```bash
# Capture selectors interactively
node rpa/capture-selectors.js

# Use Playwright codegen
npm run rpa:codegen

# Test a report in headful mode
node rpa/run.js --report NAME --from DATE --to DATE --headful

# Test with slow motion
node rpa/run.js --report NAME --from DATE --to DATE --headful --slow-mo 2000

# Check logs
cat logs/LATEST.log

# Check screenshots
ls logs/screenshots/
```
