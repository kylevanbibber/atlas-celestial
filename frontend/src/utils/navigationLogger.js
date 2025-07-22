/**
 * Utility for logging navigation events throughout the application
 */

/**
 * Log a navigation event
 * @param {string} from - Source path
 * @param {string} to - Destination path
 * @param {Object} metadata - Additional metadata about the navigation
 */
export const logNavigation = (from, to, metadata = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[Navigation] ${timestamp} - From: ${from} To: ${to}`, {
    ...metadata,
    timestamp
  });
};

/**
 * Log a redirect event
 * @param {string} from - Source path
 * @param {string} to - Destination path
 * @param {string} reason - Reason for the redirect
 * @param {Object} metadata - Additional metadata about the redirect
 */
export const logRedirect = (from, to, reason, metadata = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[Redirect] ${timestamp} - From: ${from} To: ${to} Reason: ${reason}`, {
    ...metadata,
    reason,
    timestamp
  });
};

/**
 * Log an access denied event
 * @param {string} path - Path that was denied
 * @param {string} reason - Reason for denial
 * @param {Object} metadata - Additional metadata about the denied access
 */
export const logAccessDenied = (path, reason, metadata = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[Access Denied] ${timestamp} - Path: ${path} Reason: ${reason}`, {
    ...metadata,
    reason,
    timestamp
  });
};

export default {
  logNavigation,
  logRedirect,
  logAccessDenied
}; 