import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a Winston logger instance for the RPA runner
 * @param {string} sessionId - Unique session identifier (timestamp)
 * @returns {winston.Logger} Configured logger instance
 */
export function createLogger(sessionId) {
  const logsDir = path.join(process.cwd(), 'logs');
  const screenshotsDir = path.join(logsDir, 'screenshots');

  // Ensure directories exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const logFile = path.join(logsDir, `${sessionId}.log`);

  // Custom format to redact sensitive information
  const redactSensitive = winston.format((info) => {
    // Redact passwords from log messages
    if (typeof info.message === 'string') {
      info.message = info.message.replace(
        /password[=:]\s*['"]?[^'"}\s]+['"]?/gi,
        'password=***REDACTED***'
      );
    }
    return info;
  })();

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      redactSensitive,
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
      })
    ),
    transports: [
      new winston.transports.File({ filename: logFile }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} ${level}: ${message}`;
          })
        )
      })
    ]
  });

  logger.info(`Logger initialized. Session ID: ${sessionId}`);
  logger.info(`Log file: ${logFile}`);

  return logger;
}

/**
 * Get screenshot directory path
 * @returns {string} Screenshots directory path
 */
export function getScreenshotDir() {
  return path.join(process.cwd(), 'logs', 'screenshots');
}

/**
 * Generate screenshot filename
 * @param {string} sessionId - Session identifier
 * @param {string} context - Context of the screenshot (e.g., 'login-failed')
 * @returns {string} Screenshot file path
 */
export function getScreenshotPath(sessionId, context) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${sessionId}_${context}_${timestamp}.png`;
  return path.join(getScreenshotDir(), filename);
}
