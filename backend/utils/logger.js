// Simple debug logger to prevent noisy backend logs.
// Enable by setting DEBUG_LOGS=true in the backend environment.

const DEBUG_LOGS = String(process.env.DEBUG_LOGS || '').toLowerCase() === 'true';

function debug(...args) {
  if (DEBUG_LOGS) console.log(...args);
}

function debugWarn(...args) {
  if (DEBUG_LOGS) console.warn(...args);
}

module.exports = { debug, debugWarn, DEBUG_LOGS };

/**
 * Simple logger utility
 */
// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level (can be changed at runtime)
let currentLogLevel = process.env.NODE_ENV === 'production' 
  ? LOG_LEVELS.INFO 
  : LOG_LEVELS.DEBUG;

/**
 * Set the current log level
 * @param {string} level - Log level: 'error', 'warn', 'info', or 'debug'
 */
function setLogLevel(level) {
  const levelUpper = level.toUpperCase();
  if (LOG_LEVELS[levelUpper] !== undefined) {
    currentLogLevel = LOG_LEVELS[levelUpper];
    info(`Log level set to ${level}`);
  } else {
    warn(`Invalid log level: ${level}`);
  }
}

/**
 * Format the current timestamp
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Log an error message
 * @param {string} message - The message to log
 * @param {Error|any} [error] - Optional error object
 */
function error(message, error) {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    console.error(`[${getTimestamp()}] ERROR: ${message}`);
    if (error) {
      if (error instanceof Error) {
        console.error(`Stack: ${error.stack}`);
      } else {
        console.error(error);
      }
    }
  }
}

/**
 * Log a warning message
 * @param {string} message - The message to log
 * @param {any} [data] - Optional data to log
 */
function warn(message, data) {
  if (currentLogLevel >= LOG_LEVELS.WARN) {
    console.warn(`[${getTimestamp()}] WARN: ${message}`);
    if (data !== undefined) {
      console.warn(data);
    }
  }
}

/**
 * Log an info message
 * @param {string} message - The message to log
 * @param {any} [data] - Optional data to log
 */
function info(message, data) {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(`[${getTimestamp()}] INFO: ${message}`);
    if (data !== undefined) {
      console.log(data);
    }
  }
}

/**
 * Log a debug message
 * @param {string} message - The message to log
 * @param {any} [data] - Optional data to log
 */
function debug(message, data) {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.log(`[${getTimestamp()}] DEBUG: ${message}`);
    if (data !== undefined) {
      console.log(data);
    }
  }
}

module.exports = {
  error,
  warn,
  info,
  debug,
  setLogLevel
}; 