# HHA Exchange RPA Export Runner

Production-ready RPA (Robotic Process Automation) tool for automating report downloads from HHA Exchange using Playwright. Available as both a **Web Interface** and **Command Line** tool.

## 🌟 Two Ways to Use

### 1. 🖥️ Web Interface (NEW!)

**The easiest way to run reports** - No command line needed!

```bash
npm run web
```

Open `http://localhost:3000` in your browser and:
- ✅ Browse available reports visually
- ✅ Select dates with a calendar picker
- ✅ Monitor jobs in real-time
- ✅ Download files with one click
- ✅ View detailed logs in browser

**📖 See [WEB_APP_GUIDE.md](WEB_APP_GUIDE.md) for complete web interface documentation**

### 2. ⌨️ Command Line

For automation and scheduled runs:

```bash
node rpa/run.js --report active_patients_auth --from 2024-01-01 --to 2024-01-31
```

## Features

- **🌐 Web Interface** - Modern, user-friendly dashboard
- **⚡ Real-time monitoring** - Watch job progress live via WebSocket
- **🔐 Robust authentication** - Support for MFA (human-in-the-loop)
- **⚙️ Configurable reports** - Define reports via YAML
- **♻️ Idempotent downloads** - Skip re-downloading existing files
- **🔄 Retry logic** - Exponential backoff for transient errors
- **📝 Comprehensive logging** - Automatic password redaction
- **📸 Failure screenshots** - For debugging
- **👤 Human-like behavior** - Randomized delays
- **🔑 Session management** - Automatic re-login
- **🏗️ Production-ready** - Clean separation of concerns

## Prerequisites

- Node.js >= 16.0.0
- npm or yarn
- Valid HHA Exchange account with report access

## Installation

1. **Clone the repository**
   ```bash
   cd your-project-directory
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers**
   ```bash
   npm run install:playwright
   ```

4. **Configure credentials**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:
   ```env
   HHAE_USERNAME=your_username
   HHAE_PASSWORD=your_password
   ```

   **⚠️ SECURITY WARNING:** Never commit the `.env` file to version control!

## Quick Start

### Basic Usage

```bash
# Download a report for a specific date range
node rpa/run.js --report active_patients_auth --from 2024-01-01 --to 2024-01-31
```

### Using npm scripts

```bash
# Standard run (headless)
npm run rpa:run -- --report visits_confirmed_hours --from 2024-01-01 --to 2024-01-31

# Debug mode (show browser)
npm run rpa:debug -- --report aide_roster_compliance --from 2024-01-01 --to 2024-01-31

# Force re-download
npm run rpa:run -- --report active_patients_auth --from 2024-01-01 --to 2024-01-31 --force
```

## Command Line Options

| Option | Alias | Required | Description |
|--------|-------|----------|-------------|
| `--report` | `-r` | Yes | Report name (must match config.yaml) |
| `--from` | `-f` | Yes | Start date (YYYY-MM-DD) |
| `--to` | `-t` | Yes | End date (YYYY-MM-DD) |
| `--config` | `-c` | No | Path to config file (default: ./rpa/config.yaml) |
| `--headful` | | No | Show browser window (required for MFA) |
| `--force` | | No | Force re-download even if file exists |
| `--slow-mo` | | No | Slow down operations by N milliseconds |
| `--help` | `-h` | No | Show help |

## Configuration

### Report Definitions

Edit `rpa/config.yaml` to define your reports. Each report should include:

```yaml
reports:
  your_report_name:
    description: "Human-readable description"
    start_url: "https://www.hhax.com/path/to/report"

    # Menu navigation steps (if needed)
    menu_steps:
      - type: click
        selector: 'button:has-text("Reports")'
        description: "Click Reports menu"

    # Date range inputs
    date_range_selectors:
      from: 'input[name="start_date"]'
      to: 'input[name="end_date"]'

    # Optional: Run/Generate button
    run_button_selector: 'button:has-text("Generate")'

    # Download trigger
    download_trigger:
      trigger_selector: 'button:has-text("Export")'
      trigger_type: click

    # Expected filename pattern (regex)
    expected_filename_regex: 'report.*\.csv$'

    # Optional: Validation rules
    validation:
      required_columns:
        - "Column1"
        - "Column2"
      min_rows: 1
```

### Selector Strategies

**Preferred selectors (in order):**

1. **Role-based selectors**: `button:has-text("Export")`
2. **Text content**: `text=/Download/i`
3. **Data attributes**: `[data-testid="export-button"]`
4. **Stable IDs**: `#exportButton`
5. **CSS selectors** (last resort): `.btn-primary.export`

**Avoid:**
- Position-based selectors (`:nth-child`)
- Auto-generated classes (`._abc123`)
- Overly specific paths (`div > div > div > button`)

## Capturing Selectors

### Method 1: Playwright Codegen

The easiest way to capture selectors:

```bash
# Start Playwright codegen
npm run rpa:codegen

# Or specify a URL
npx playwright codegen https://www.hhax.com
```

**Steps:**
1. Codegen opens a browser and inspector
2. Navigate through the UI
3. Click elements to see generated selectors
4. Copy selectors to `config.yaml`

### Method 2: Headful Mode Inspection

```bash
# Run in headful mode and watch the automation
node rpa/run.js --report your_report --from 2024-01-01 --to 2024-01-31 --headful --slow-mo 1000
```

When it fails, check the browser window and use DevTools to inspect elements.

### Method 3: Browser DevTools

1. Open HHA Exchange in Chrome/Edge
2. Press F12 to open DevTools
3. Use the element picker (Ctrl+Shift+C)
4. Test selectors in the Console:
   ```javascript
   document.querySelector('button:has-text("Export")')
   ```

## MFA Support

If your account has Multi-Factor Authentication (MFA) enabled:

1. **Run in headful mode:**
   ```bash
   node rpa/run.js --report your_report --from 2024-01-01 --to 2024-01-31 --headful
   ```

2. **Complete MFA manually** when prompted:
   - The browser will pause after entering credentials
   - Complete the MFA challenge (SMS code, authenticator app, etc.)
   - Press ENTER in the terminal when you reach the landing page

3. **The automation continues** after MFA completion

**Note:** MFA is not supported in headless mode. The script will fail if MFA is detected in headless mode.

## Output Files

### Downloads

Downloaded files are organized by session:

```
downloads/
  └── 2024-01-15T14-30-00-123Z/
      ├── active_patients_auth_2024-01-01_to_2024-01-31.csv
      └── visits_confirmed_hours_2024-01-01_to_2024-01-31.xlsx
```

### Logs

Comprehensive logs with automatic password redaction:

```
logs/
  ├── 2024-01-15T14-30-00-123Z.log
  └── screenshots/
      ├── 2024-01-15T14-30-00-123Z_login-failed_2024-01-15T14-30-45.png
      └── 2024-01-15T14-30-00-123Z_report-download-failed_2024-01-15T14-31-12.png
```

## Troubleshooting

### Login Fails

**Symptom:** Login fails immediately

**Solutions:**
1. Verify credentials in `.env` file
2. Check if account is locked or password expired
3. Try logging in manually through a browser
4. Run in headful mode to see what's happening:
   ```bash
   node rpa/run.js --report test --from 2024-01-01 --to 2024-01-31 --headful
   ```
5. Check screenshots in `logs/screenshots/`

### MFA Issues

**Symptom:** "MFA detected but running in headless mode"

**Solution:** Add `--headful` flag:
```bash
node rpa/run.js --report your_report --from 2024-01-01 --to 2024-01-31 --headful
```

### Selector Not Found

**Symptom:** "Timeout waiting for selector"

**Solutions:**
1. Use Playwright codegen to capture correct selectors
2. Run in headful mode with slow-mo to watch the flow:
   ```bash
   node rpa/run.js --report test --from 2024-01-01 --to 2024-01-31 --headful --slow-mo 2000
   ```
3. Update selectors in `config.yaml`
4. Try multiple selector strategies:
   ```yaml
   selector: 'button:has-text("Export"), #exportBtn, [data-action="export"]'
   ```

### Download Timeout

**Symptom:** "Download timeout: No file matching pattern found"

**Solutions:**
1. Check `expected_filename_regex` in config matches actual filename
2. Verify download was actually triggered (check browser downloads)
3. Increase timeout (currently 60 seconds)
4. Check if report needs to generate first (add `run_button_selector`)

### Session Expired During Run

**Symptom:** "Session appears to be logged out"

**Solution:** The tool automatically re-logs in. If this fails repeatedly:
1. Check if session timeout is very short
2. Verify the report doesn't take too long to generate
3. Check network connectivity

### File Already Exists

**Symptom:** "Existing download found"

**Solution:** This is idempotency protection. To force re-download:
```bash
node rpa/run.js --report test --from 2024-01-01 --to 2024-01-31 --force
```

## Recording Traces for Debugging

Playwright can record traces for detailed debugging:

1. **Modify run.js temporarily** to enable tracing:

   ```javascript
   // After creating context:
   await context.tracing.start({ screenshots: true, snapshots: true });

   // Before closing browser:
   await context.tracing.stop({ path: `logs/trace-${sessionId}.zip` });
   ```

2. **View the trace:**
   ```bash
   npx playwright show-trace logs/trace-2024-01-15T14-30-00-123Z.zip
   ```

## Architecture

```
rpa/
├── run.js                 # CLI entrypoint
├── config.yaml           # Report definitions
└── lib/
    ├── logger.js         # Logging with redaction
    ├── login.js          # Authentication & MFA
    ├── navigation.js     # UI interaction helpers
    ├── downloads.js      # Download management
    └── reports.js        # Report flow orchestration
```

### Key Design Decisions

- **ESM modules** for modern Node.js
- **Separation of concerns** for maintainability
- **Retry logic** at multiple levels (action, step, report)
- **Human-like delays** to avoid detection
- **Idempotency** to prevent duplicate work
- **Comprehensive logging** for operations visibility
- **Screenshots on failure** for debugging

## Security Best Practices

1. ✅ **Use environment variables** for credentials
2. ✅ **Never commit `.env`** to version control
3. ✅ **Use a dedicated service account** when possible
4. ✅ **Rotate credentials regularly**
5. ✅ **Enable MFA** on the account
6. ✅ **Review logs** for sensitive data before sharing
7. ✅ **Limit report access** to only what's needed
8. ✅ **Run on secure infrastructure** (no shared machines)

## Operational Guidance

### Running in Production

**Recommended approach:**

```bash
# Use a process manager like PM2
pm2 start rpa/run.js --name "hhae-rpa" -- \
  --report monthly_billing \
  --from 2024-01-01 \
  --to 2024-01-31

# Or use cron for scheduled runs
# Daily at 6 AM: Download previous day's visits
0 6 * * * cd /path/to/project && node rpa/run.js --report visits_confirmed_hours --from $(date -d yesterday +\%Y-\%m-\%d) --to $(date -d yesterday +\%Y-\%m-\%d)
```

### Monitoring

Monitor these indicators:

1. **Exit code**: 0 = success, 1 = failure
2. **Log files**: Check for ERROR entries
3. **Download directory**: Verify files are created
4. **File size**: Ensure files aren't empty
5. **Timestamps**: Detect if runs are taking longer than usual

### Error Handling

The tool handles these errors gracefully:

- ✅ Network timeouts (with retry)
- ✅ Element not found (with retry)
- ✅ Session expiration (automatic re-login)
- ✅ Transient UI issues (with retry)

These errors require manual intervention:

- ❌ Invalid credentials
- ❌ Account locked
- ❌ MFA failure
- ❌ Structural changes to the website

## Customization Guide

### Adding a New Report

1. **Explore the UI manually**
   - Log into HHA Exchange
   - Navigate to the report
   - Note the steps and selectors

2. **Use Playwright codegen**
   ```bash
   npm run rpa:codegen
   ```
   Navigate through the report flow and capture selectors

3. **Add to config.yaml**
   ```yaml
   reports:
     your_new_report:
       description: "Your report description"
       start_url: "URL from step 1"
       menu_steps: [...]  # From step 2
       date_range_selectors: {...}
       download_trigger: {...}
       expected_filename_regex: 'pattern.*\.csv$'
   ```

4. **Test in headful mode**
   ```bash
   node rpa/run.js --report your_new_report --from 2024-01-01 --to 2024-01-31 --headful
   ```

5. **Verify and iterate** until it works reliably

### Modifying Timeouts

Edit these values in the respective modules:

- **Page load timeout**: `rpa/lib/login.js` → `LOGIN_CONFIG.timeouts.pageLoad`
- **Element timeout**: `rpa/run.js` → `context.setDefaultTimeout()`
- **Download timeout**: `rpa/lib/downloads.js` → `waitForDownload()` timeout parameter
- **MFA timeout**: `rpa/lib/login.js` → `LOGIN_CONFIG.timeouts.landingPage`

### Customizing Human Delays

Edit `humanDelay()` in `rpa/lib/navigation.js`:

```javascript
export async function humanDelay(minMs = 150, maxMs = 600) {
  // Adjust min/max for your needs
}
```

## FAQ

**Q: Can I run multiple reports in parallel?**
A: Not recommended. Run them sequentially to avoid session conflicts.

**Q: How do I handle reports that take a long time to generate?**
A: Increase the timeout in `waitForStableUI()` after clicking the run button.

**Q: What if the website structure changes?**
A: Update selectors in `config.yaml` using Playwright codegen.

**Q: Can I run this in a Docker container?**
A: Yes, use the official Playwright Docker image:
```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-focal
# Add your app code
```

**Q: How do I debug a failing step?**
A: Use `--headful --slow-mo 2000` and watch the browser, or check screenshots in `logs/screenshots/`.

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review logs in `logs/`
3. Run in headful mode to observe behavior
4. Capture a trace for detailed analysis

## License

MIT

## Contributing

Contributions welcome! Please ensure:

- Code follows existing patterns
- Add comments for complex logic
- Test in both headful and headless modes
- Update README for new features
