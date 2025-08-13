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
  // Navigation logging disabled
};

/**
 * Log a redirect event
 * @param {string} from - Source path
 * @param {string} to - Destination path
 * @param {string} reason - Reason for the redirect
 * @param {Object} metadata - Additional metadata about the redirect
 */
export const logRedirect = (from, to, reason, metadata = {}) => {
  // Redirect logging disabled
};

/**
 * Log an access denied event
 * @param {string} path - Path that was denied
 * @param {string} reason - Reason for denial
 * @param {Object} metadata - Additional metadata about the denied access
 */
export const logAccessDenied = (path, reason, metadata = {}) => {
  // Access denied logging disabled
};

export default {
  logNavigation,
  logRedirect,
  logAccessDenied
}; 