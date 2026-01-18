# HHA Exchange RPA Web Interface

A modern, user-friendly web application for managing and running RPA report downloads from HHA Exchange.

## 🎯 Features

- **Visual Report Management** - Browse and select reports from a clean interface
- **One-Click Execution** - Run reports with date range selection
- **Real-Time Monitoring** - Watch job progress with live updates via WebSocket
- **Job History** - View all completed and failed jobs
- **Download Management** - Browse and download all exported files
- **Detailed Logs** - View full logs for any job
- **Quick Date Ranges** - Preset buttons for common date ranges (today, yesterday, this week, etc.)
- **Responsive Design** - Works on desktop, tablet, and mobile

## 🚀 Quick Start

### 1. Start the Web Server

```bash
npm run web
```

The server will start on `http://localhost:3000`

### 2. Open in Browser

Navigate to: `http://localhost:3000`

### 3. Run Your First Report

1. Click "Run Report" in the sidebar
2. Select a report from the dropdown
3. Choose date range (or use quick date buttons)
4. Click "▶️ Run Report"
5. Switch to "Active Jobs" to watch progress
6. Download the file when complete!

## 📊 Interface Overview

### Dashboard Sections

#### 🏠 Header
- **System Status** - Shows if the system is running
- **Statistics** - Active, completed, and failed job counts

#### 📋 Navigation Tabs

1. **Run Report** - Start new report jobs
2. **Active Jobs** - Monitor currently running jobs
3. **History** - View completed and failed jobs
4. **Downloads** - Browse and download all files

### Run Report Tab

**Features:**
- Report selector with descriptions
- Date range inputs (from/to)
- Force re-download checkbox
- Quick date range buttons:
  - Today
  - Yesterday
  - This Week
  - Last Week
  - This Month
  - Last Month

**How to Use:**
1. Select report from dropdown
2. Set date range (or click quick date button)
3. Optional: Check "Force re-download" to bypass cache
4. Click "Run Report"

### Active Jobs Tab

Shows all currently running or queued jobs with:
- Report name and status badge
- Date range
- Duration
- Real-time output (last 500 characters)
- "View Details" button - See full logs
- "Download" button (when complete)

**Status Indicators:**
- 🔵 **Running** - Job is currently executing
- 🟡 **Queued** - Job waiting to start
- 🟢 **Completed** - Job finished successfully
- 🔴 **Failed** - Job encountered an error

### History Tab

Shows all completed and failed jobs with:
- Full job details
- Duration and timestamps
- Error messages (if failed)
- Download button for completed jobs

### Downloads Tab

Browse all downloaded files with:
- Filename
- File size
- Created timestamp
- Download button

## 🔌 API Endpoints

The web server exposes the following REST API endpoints:

### Reports

**GET `/api/reports`**
- Returns list of available reports

```json
[
  {
    "id": "active_patients_auth",
    "name": "Active Patients Auth",
    "description": "Active patients with authorization details"
  }
]
```

**POST `/api/reports/run`**
- Start a new report job

Request:
```json
{
  "reportId": "active_patients_auth",
  "fromDate": "2024-01-01",
  "toDate": "2024-01-31",
  "force": false
}
```

Response:
```json
{
  "jobId": "job-1234567890-1",
  "message": "Report job queued",
  "job": {
    "id": "job-1234567890-1",
    "reportId": "active_patients_auth",
    "reportName": "Active Patients Auth",
    "fromDate": "2024-01-01",
    "toDate": "2024-01-31",
    "status": "queued"
  }
}
```

### Jobs

**GET `/api/jobs`**
- Returns list of all jobs

**GET `/api/jobs/:jobId`**
- Get specific job details

**GET `/api/jobs/:jobId/logs`**
- Get full logs for a job

### Downloads

**GET `/api/downloads`**
- List all downloaded files

**GET `/api/downloads/:sessionId/:filename`**
- Download a specific file

### System

**GET `/api/status`**
- Get system status

```json
{
  "status": "running",
  "activeJobs": 1,
  "completedJobs": 5,
  "failedJobs": 0,
  "totalJobs": 6,
  "uptime": 3600
}
```

## 🔄 WebSocket Events

The web interface uses WebSocket for real-time updates:

### Client receives:

**`init`** - Initial data on connection
```json
{
  "type": "init",
  "jobs": [...]
}
```

**`job_update`** - Job status changed
```json
{
  "type": "job_update",
  "job": {...}
}
```

**`job_output`** - New output from job
```json
{
  "type": "job_output",
  "jobId": "job-123",
  "output": "Login successful..."
}
```

**`job_complete`** - Job finished
```json
{
  "type": "job_complete",
  "job": {...}
}
```

**`job_error`** - Job failed
```json
{
  "type": "job_error",
  "job": {...},
  "error": "Error message"
}
```

## ⚙️ Configuration

### Environment Variables

```bash
# Server port (default: 3000)
PORT=3000

# RPA credentials (same as CLI)
HHAE_USERNAME=your_username
HHAE_PASSWORD=your_password

# Logging level
LOG_LEVEL=info
```

### Custom Port

```bash
PORT=8080 npm run web
```

## 🏗️ Architecture

```
web/
├── server.js           # Express server + WebSocket
└── public/
    ├── index.html      # Main HTML
    ├── styles.css      # Styles
    └── app.js          # Frontend JavaScript
```

### Backend (server.js)

- **Express.js** - HTTP server
- **WebSocket (ws)** - Real-time communication
- **Child Process** - Spawns RPA jobs
- **Job Queue** - Tracks active/completed jobs

### Frontend (public/)

- **Vanilla JavaScript** - No framework dependencies
- **WebSocket Client** - Receives real-time updates
- **Responsive CSS** - Mobile-friendly design

## 🔧 Advanced Usage

### Running in Production

#### Option 1: PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start web server
pm2 start npm --name "hhae-web" -- run web

# View logs
pm2 logs hhae-web

# Restart
pm2 restart hhae-web

# Stop
pm2 stop hhae-web
```

#### Option 2: systemd (Linux)

Create `/etc/systemd/system/hhae-web.service`:

```ini
[Unit]
Description=HHA Exchange RPA Web Interface
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/project
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run web
Restart=always

[Install]
WantedBy=multi-user.target
```

Start service:
```bash
sudo systemctl enable hhae-web
sudo systemctl start hhae-web
sudo systemctl status hhae-web
```

### Reverse Proxy (nginx)

To expose the web interface on port 80/443:

```nginx
server {
    listen 80;
    server_name rpa.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

### Security Considerations

**⚠️ IMPORTANT:** The web interface has no authentication by default!

For production:

1. **Add Authentication**
   - Use nginx basic auth
   - Implement session-based auth
   - Use OAuth/SAML

2. **Use HTTPS**
   - Get SSL certificate (Let's Encrypt)
   - Configure nginx with SSL
   - Redirect HTTP to HTTPS

3. **Firewall Rules**
   - Only expose to internal network
   - Use VPN for remote access

4. **Example nginx with basic auth:**

```nginx
server {
    listen 443 ssl;
    server_name rpa.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    auth_basic "RPA Admin";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://localhost:3000;
        # ... proxy settings ...
    }
}
```

Create password file:
```bash
htpasswd -c /etc/nginx/.htpasswd admin
```

## 🐛 Troubleshooting

### Web server won't start

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:** Port 3000 is already in use. Either:
- Stop the other process using port 3000
- Use a different port: `PORT=8080 npm run web`

### WebSocket not connecting

**Symptoms:** Real-time updates don't work, jobs don't appear

**Solutions:**
1. Check browser console for errors
2. Ensure WebSocket isn't blocked by firewall
3. If behind a proxy, ensure WebSocket upgrade headers are allowed

### Jobs don't start

**Check:**
1. Credentials in `.env` file are correct
2. RPA runner works from CLI: `node rpa/run.js --report test --from 2024-01-01 --to 2024-01-01 --headful`
3. Check server logs for errors

### Downloads don't work

**Solutions:**
1. Check if file exists in `downloads/` directory
2. Verify file permissions
3. Check browser console for 404 errors

## 📱 Mobile Usage

The web interface is fully responsive and works on mobile devices:

- Touch-friendly buttons
- Responsive layout
- Works on iOS and Android browsers
- Portrait and landscape support

## 🎨 Customization

### Change Theme Colors

Edit `web/public/styles.css`:

```css
:root {
    --primary-color: #2563eb;  /* Change to your brand color */
    --success-color: #10b981;
    --danger-color: #ef4444;
    /* ... etc */
}
```

### Add Custom Reports

Reports are automatically loaded from `rpa/config.yaml`. Just add new reports there and they'll appear in the web interface!

### Modify Layout

Edit `web/public/index.html` to change the layout or add new sections.

## 📊 Comparison: Web vs CLI

| Feature | Web Interface | Command Line |
|---------|--------------|--------------|
| Ease of Use | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Real-time Monitoring | ✅ Yes | ❌ No |
| Multiple Jobs | ✅ Track all | ❌ One at a time |
| Date Selection | ✅ Visual calendar | ⏱️ Manual typing |
| Log Viewing | ✅ In-browser | 📁 File system |
| Download Management | ✅ Built-in browser | 📁 File system |
| Remote Access | ✅ Yes (with proxy) | ❌ SSH only |
| Automation | ❌ Manual trigger | ✅ Cron/scripts |
| Headful Mode | ❌ Not supported | ✅ For MFA |

**Use Web Interface when:**
- Running reports manually
- Need to monitor progress
- Want visual feedback
- Multiple team members need access

**Use CLI when:**
- Automating with cron/scripts
- MFA is required (need --headful)
- Running on headless server
- Integrating with other tools

## 🔮 Future Enhancements

Potential features to add:

- [ ] User authentication
- [ ] Scheduled reports (cron-like interface)
- [ ] Report templates
- [ ] Email notifications
- [ ] Report data preview (CSV viewer)
- [ ] Multi-report batch execution
- [ ] Export job history to CSV
- [ ] Dark mode
- [ ] Custom branding

## 💡 Tips & Tricks

1. **Keep browser tab open** for real-time updates
2. **Use quick date buttons** for common ranges
3. **Force re-download** only when needed (wastes time otherwise)
4. **View details** to see full logs if job fails
5. **Download immediately** - files are organized by session
6. **Multiple tabs** work fine - all see same data via WebSocket

## 🆘 Support

If you encounter issues:

1. Check browser console (F12) for JavaScript errors
2. Check server logs in terminal
3. Verify RPA works from CLI first
4. Review the troubleshooting section above
5. Check that all dependencies are installed: `npm install`

---

**Enjoy your new web interface! 🎉**

Much easier than command line, right? Now you can run reports with just a few clicks!
