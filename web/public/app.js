// Global state
let ws = null;
let jobs = [];
let downloads = [];
let reports = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
    loadReports();
    loadDownloads();
    loadJobs();
    setupFormHandlers();
    setDefaultDates();

    // Update status every 30 seconds
    setInterval(updateStatus, 30000);
    updateStatus();
});

// WebSocket connection
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(initWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'init':
            jobs = data.jobs;
            renderJobs();
            break;

        case 'job_update':
            updateJob(data.job);
            break;

        case 'job_output':
            appendJobOutput(data.jobId, data.output);
            break;

        case 'job_complete':
            updateJob(data.job);
            showToast('success', `Report completed: ${data.job.reportName}`);
            loadDownloads(); // Refresh downloads
            break;

        case 'job_error':
            updateJob(data.job);
            showToast('error', `Report failed: ${data.error}`);
            break;
    }
}

// Update job in state
function updateJob(updatedJob) {
    const index = jobs.findIndex(j => j.id === updatedJob.id);
    if (index >= 0) {
        jobs[index] = updatedJob;
    } else {
        jobs.push(updatedJob);
    }
    renderJobs();
}

// Append output to job
function appendJobOutput(jobId, output) {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
        job.output = (job.output || '') + output;
        renderJobs();
    }
}

// Load reports
async function loadReports() {
    try {
        const response = await fetch('/api/reports');
        reports = await response.json();

        const select = document.getElementById('reportSelect');
        select.innerHTML = '<option value="">-- Select a Report --</option>';

        reports.forEach(report => {
            const option = document.createElement('option');
            option.value = report.id;
            option.textContent = report.name;
            option.dataset.description = report.description;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading reports:', error);
        showToast('error', 'Failed to load reports');
    }
}

// Load jobs
async function loadJobs() {
    try {
        const response = await fetch('/api/jobs');
        jobs = await response.json();
        renderJobs();
    } catch (error) {
        console.error('Error loading jobs:', error);
    }
}

// Load downloads
async function loadDownloads() {
    try {
        const response = await fetch('/api/downloads');
        downloads = await response.json();
        renderDownloads();
    } catch (error) {
        console.error('Error loading downloads:', error);
    }
}

// Update system status
async function updateStatus() {
    try {
        const response = await fetch('/api/status');
        const status = await response.json();

        document.getElementById('statsDisplay').innerHTML = `
            Active: <strong>${status.activeJobs}</strong> |
            Completed: <strong>${status.completedJobs}</strong> |
            Failed: <strong>${status.failedJobs}</strong>
        `;
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

// Setup form handlers
function setupFormHandlers() {
    const form = document.getElementById('runReportForm');
    form.addEventListener('submit', handleRunReport);

    const reportSelect = document.getElementById('reportSelect');
    reportSelect.addEventListener('change', (e) => {
        const option = e.target.options[e.target.selectedIndex];
        const description = option.dataset.description || '';
        document.getElementById('reportDescription').textContent = description;
    });
}

// Handle run report form submission
async function handleRunReport(e) {
    e.preventDefault();

    const reportId = document.getElementById('reportSelect').value;
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const force = document.getElementById('forceDownload').checked;

    if (!reportId || !fromDate || !toDate) {
        showToast('error', 'Please fill in all required fields');
        return;
    }

    const button = document.getElementById('runButton');
    button.disabled = true;
    button.textContent = '⏳ Starting...';

    try {
        const response = await fetch('/api/reports/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId, fromDate, toDate, force })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('success', 'Report job started successfully!');
            showTab('jobs'); // Switch to jobs tab
        } else {
            showToast('error', result.error || 'Failed to start report');
        }
    } catch (error) {
        console.error('Error running report:', error);
        showToast('error', 'Failed to start report');
    } finally {
        button.disabled = false;
        button.textContent = '▶️ Run Report';
    }
}

// Set default dates (today)
function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fromDate').value = today;
    document.getElementById('toDate').value = today;
}

// Set date range
function setDateRange(range) {
    const today = new Date();
    let fromDate, toDate;

    switch (range) {
        case 'today':
            fromDate = toDate = today;
            break;

        case 'yesterday':
            fromDate = toDate = new Date(today.setDate(today.getDate() - 1));
            break;

        case 'thisWeek':
            const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            fromDate = firstDayOfWeek;
            toDate = new Date();
            break;

        case 'lastWeek':
            const lastWeekEnd = new Date(today.setDate(today.getDate() - today.getDay() - 1));
            const lastWeekStart = new Date(lastWeekEnd);
            lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
            fromDate = lastWeekStart;
            toDate = lastWeekEnd;
            break;

        case 'thisMonth':
            fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
            toDate = new Date();
            break;

        case 'lastMonth':
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            fromDate = lastMonth;
            toDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
    }

    document.getElementById('fromDate').value = fromDate.toISOString().split('T')[0];
    document.getElementById('toDate').value = toDate.toISOString().split('T')[0];
}

// Render jobs
function renderJobs() {
    const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'queued');
    const completedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'failed');

    // Render active jobs
    const activeContainer = document.getElementById('activeJobsList');
    if (activeJobs.length === 0) {
        activeContainer.innerHTML = '<p class="empty-state">No active jobs</p>';
    } else {
        activeContainer.innerHTML = activeJobs.map(job => renderJobCard(job, true)).join('');
    }

    // Render history
    const historyContainer = document.getElementById('historyList');
    if (completedJobs.length === 0) {
        historyContainer.innerHTML = '<p class="empty-state">No job history</p>';
    } else {
        historyContainer.innerHTML = completedJobs.map(job => renderJobCard(job, false)).join('');
    }
}

// Render job card
function renderJobCard(job, showOutput = false) {
    const duration = job.endTime
        ? Math.round((new Date(job.endTime) - new Date(job.startTime)) / 1000)
        : Math.round((new Date() - new Date(job.startTime)) / 1000);

    const outputSection = showOutput && job.output ? `
        <div class="job-output">${escapeHtml(job.output.slice(-500))}</div>
    ` : '';

    const downloadButton = job.downloadedFile ? `
        <button class="btn btn-success btn-sm" onclick="downloadFile('${job.sessionId}', '${getFilename(job.downloadedFile)}')">
            💾 Download
        </button>
    ` : '';

    return `
        <div class="job-card status-${job.status}">
            <div class="job-header">
                <div class="job-title">${escapeHtml(job.reportName)}</div>
                <div class="job-status status-${job.status}">${job.status}</div>
            </div>
            <div class="job-meta">
                <div class="job-meta-item">
                    <span class="job-meta-label">Date Range:</span>
                    <span class="job-meta-value">${job.fromDate} to ${job.toDate}</span>
                </div>
                <div class="job-meta-item">
                    <span class="job-meta-label">Duration:</span>
                    <span class="job-meta-value">${duration}s</span>
                </div>
                <div class="job-meta-item">
                    <span class="job-meta-label">Started:</span>
                    <span class="job-meta-value">${formatTime(job.startTime)}</span>
                </div>
                ${job.error ? `
                <div class="job-meta-item">
                    <span class="job-meta-label">Error:</span>
                    <span class="job-meta-value" style="color: var(--danger-color);">${escapeHtml(job.error)}</span>
                </div>
                ` : ''}
            </div>
            ${outputSection}
            <div class="job-actions">
                <button class="btn btn-secondary btn-sm" onclick="viewJobDetails('${job.id}')">
                    📄 View Details
                </button>
                ${downloadButton}
            </div>
        </div>
    `;
}

// Render downloads
function renderDownloads() {
    const container = document.getElementById('downloadsList');

    if (downloads.length === 0) {
        container.innerHTML = '<p class="empty-state">No downloads available</p>';
        return;
    }

    container.innerHTML = downloads.map(download => `
        <div class="download-item">
            <div class="download-info">
                <div class="download-filename">📄 ${escapeHtml(download.filename)}</div>
                <div class="download-meta">
                    ${formatFileSize(download.size)} • ${formatTime(download.created)}
                </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="downloadFile('${download.sessionId}', '${download.filename}')">
                ⬇️ Download
            </button>
        </div>
    `).join('');
}

// View job details
async function viewJobDetails(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    document.getElementById('modalTitle').textContent = `Job: ${job.reportName}`;

    document.getElementById('modalJobDetails').innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem;">
            <div>
                <strong>Status:</strong>
                <span class="job-status status-${job.status}">${job.status}</span>
            </div>
            <div><strong>Report ID:</strong> ${job.reportId}</div>
            <div><strong>From Date:</strong> ${job.fromDate}</div>
            <div><strong>To Date:</strong> ${job.toDate}</div>
            <div><strong>Started:</strong> ${formatTime(job.startTime)}</div>
            <div><strong>Ended:</strong> ${job.endTime ? formatTime(job.endTime) : 'Still running'}</div>
            ${job.error ? `<div style="grid-column: 1 / -1;"><strong>Error:</strong> <span style="color: var(--danger-color);">${escapeHtml(job.error)}</span></div>` : ''}
        </div>
    `;

    // Load full logs
    try {
        const response = await fetch(`/api/jobs/${jobId}/logs`);
        const data = await response.json();
        document.getElementById('modalLogs').textContent = data.logs || 'No logs available';
    } catch (error) {
        document.getElementById('modalLogs').textContent = 'Failed to load logs';
    }

    openModal();
}

// Download file
function downloadFile(sessionId, filename) {
    window.location.href = `/api/downloads/${sessionId}/${filename}`;
}

// Show tab
function showTab(tabName) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');

    // Show tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Reload data if needed
    if (tabName === 'downloads') {
        loadDownloads();
    }
}

// Modal functions
function openModal() {
    document.getElementById('jobModal').classList.add('active');
}

function closeModal() {
    document.getElementById('jobModal').classList.remove('active');
}

// Toast notification
function showToast(type, message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(isoString) {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getFilename(path) {
    return path.split('/').pop().split('\\').pop();
}
