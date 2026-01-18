#!/usr/bin/env node

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import yaml from 'js-yaml';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Job tracking
const jobs = new Map(); // sessionId -> job details
let jobCounter = 0;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Broadcast to all connected WebSocket clients
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(data));
    }
  });
}

// Load reports configuration
function loadReportsConfig() {
  try {
    const configPath = path.join(process.cwd(), 'rpa', 'config.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents);
    return config.reports || {};
  } catch (error) {
    console.error('Error loading config:', error);
    return {};
  }
}

// Get list of available reports
app.get('/api/reports', (req, res) => {
  const reports = loadReportsConfig();
  const reportList = Object.keys(reports).map(key => ({
    id: key,
    name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: reports[key].description || ''
  }));
  res.json(reportList);
});

// Get active and completed jobs
app.get('/api/jobs', (req, res) => {
  const jobList = Array.from(jobs.values()).map(job => ({
    id: job.id,
    sessionId: job.sessionId,
    reportId: job.reportId,
    reportName: job.reportName,
    fromDate: job.fromDate,
    toDate: job.toDate,
    status: job.status,
    startTime: job.startTime,
    endTime: job.endTime,
    output: job.output ? job.output.slice(-1000) : '', // Last 1000 chars
    downloadedFile: job.downloadedFile,
    error: job.error
  }));
  res.json(jobList);
});

// Get specific job details
app.get('/api/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// Get job logs
app.get('/api/jobs/:jobId/logs', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const logFile = path.join(process.cwd(), 'logs', `${job.sessionId}.log`);
  if (fs.existsSync(logFile)) {
    const logs = fs.readFileSync(logFile, 'utf8');
    res.json({ logs });
  } else {
    res.json({ logs: job.output || 'No logs available yet' });
  }
});

// Run a report
app.post('/api/reports/run', async (req, res) => {
  const { reportId, fromDate, toDate, force = false } = req.body;

  if (!reportId || !fromDate || !toDate) {
    return res.status(400).json({
      error: 'Missing required fields: reportId, fromDate, toDate'
    });
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
    return res.status(400).json({
      error: 'Invalid date format. Use YYYY-MM-DD'
    });
  }

  // Generate job ID
  jobCounter++;
  const jobId = `job-${Date.now()}-${jobCounter}`;
  const sessionId = new Date().toISOString().replace(/[:.]/g, '-');

  const reports = loadReportsConfig();
  const reportName = reportId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Create job record
  const job = {
    id: jobId,
    sessionId,
    reportId,
    reportName,
    fromDate,
    toDate,
    force,
    status: 'queued',
    startTime: new Date().toISOString(),
    endTime: null,
    output: '',
    downloadedFile: null,
    error: null
  };

  jobs.set(jobId, job);

  // Return immediately with job ID
  res.json({
    jobId,
    message: 'Report job queued',
    job: {
      id: jobId,
      reportId,
      reportName,
      fromDate,
      toDate,
      status: 'queued'
    }
  });

  // Run the report in background
  runReportJob(job);
});

// Run report job
function runReportJob(job) {
  job.status = 'running';
  broadcast({ type: 'job_update', job });

  const args = [
    'rpa/run.js',
    '--report', job.reportId,
    '--from', job.fromDate,
    '--to', job.toDate
  ];

  if (job.force) {
    args.push('--force');
  }

  const child = spawn('node', args, {
    cwd: process.cwd(),
    env: { ...process.env }
  });

  child.stdout.on('data', (data) => {
    const output = data.toString();
    job.output += output;

    broadcast({
      type: 'job_output',
      jobId: job.id,
      output
    });

    // Check for success message with file path
    const successMatch = output.match(/Downloaded file: (.+)/);
    if (successMatch) {
      job.downloadedFile = successMatch[1].trim();
    }
  });

  child.stderr.on('data', (data) => {
    const output = data.toString();
    job.output += output;

    broadcast({
      type: 'job_output',
      jobId: job.id,
      output
    });
  });

  child.on('close', (code) => {
    job.endTime = new Date().toISOString();

    if (code === 0) {
      job.status = 'completed';

      // Try to find downloaded file if not already found
      if (!job.downloadedFile) {
        const downloadDir = path.join(process.cwd(), 'downloads', job.sessionId);
        if (fs.existsSync(downloadDir)) {
          const files = fs.readdirSync(downloadDir);
          if (files.length > 0) {
            job.downloadedFile = path.join(downloadDir, files[0]);
          }
        }
      }
    } else {
      job.status = 'failed';
      job.error = `Process exited with code ${code}`;
    }

    broadcast({ type: 'job_complete', job });
  });

  child.on('error', (error) => {
    job.status = 'failed';
    job.error = error.message;
    job.endTime = new Date().toISOString();

    broadcast({ type: 'job_error', job, error: error.message });
  });
}

// Download a file
app.get('/api/downloads/:sessionId/:filename', (req, res) => {
  const { sessionId, filename } = req.params;
  const filePath = path.join(process.cwd(), 'downloads', sessionId, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath);
});

// List all downloads
app.get('/api/downloads', (req, res) => {
  const downloadsDir = path.join(process.cwd(), 'downloads');

  if (!fs.existsSync(downloadsDir)) {
    return res.json([]);
  }

  const sessions = fs.readdirSync(downloadsDir);
  const downloads = [];

  for (const sessionId of sessions) {
    const sessionDir = path.join(downloadsDir, sessionId);
    const stat = fs.statSync(sessionDir);

    if (stat.isDirectory()) {
      const files = fs.readdirSync(sessionDir);

      for (const file of files) {
        const filePath = path.join(sessionDir, file);
        const fileStat = fs.statSync(filePath);

        downloads.push({
          sessionId,
          filename: file,
          size: fileStat.size,
          created: fileStat.birthtime.toISOString(),
          downloadUrl: `/api/downloads/${sessionId}/${file}`
        });
      }
    }
  }

  // Sort by created date, newest first
  downloads.sort((a, b) => new Date(b.created) - new Date(a.created));

  res.json(downloads);
});

// Get system status
app.get('/api/status', (req, res) => {
  const activeJobs = Array.from(jobs.values()).filter(j =>
    j.status === 'running' || j.status === 'queued'
  ).length;

  const completedJobs = Array.from(jobs.values()).filter(j =>
    j.status === 'completed'
  ).length;

  const failedJobs = Array.from(jobs.values()).filter(j =>
    j.status === 'failed'
  ).length;

  res.json({
    status: 'running',
    activeJobs,
    completedJobs,
    failedJobs,
    totalJobs: jobs.size,
    uptime: process.uptime()
  });
});

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  // Send current jobs on connection
  ws.send(JSON.stringify({
    type: 'init',
    jobs: Array.from(jobs.values())
  }));

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Start server
server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('HHA Exchange RPA Web Interface');
  console.log('='.repeat(60));
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`WebSocket server running on: ws://localhost:${PORT}`);
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('='.repeat(60));
});
