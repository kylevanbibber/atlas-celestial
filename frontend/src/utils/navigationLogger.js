import api from '../api';

/**
 * Utility for logging navigation events throughout the application
 */

// Debounce to prevent excessive API calls
let lastLoggedPath = null;
let logTimeout = null;

/**
 * Generate a user-friendly label from a path
 */
const generateLabel = (path) => {
  // Extract pathname and search from full path
  const [pathname, search] = path.split('?');
  const pathParts = pathname.split('/').filter(Boolean);
  
  if (pathParts.length === 0) return 'Home';
  
  // Capitalize and format the main path
  const mainPath = pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1);
  
  // Check for query params that indicate a section
  if (search) {
    const params = new URLSearchParams(search);
    const section = params.get('section') || params.get('active');
    
    if (section) {
      const sectionLabel = section.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      return `${mainPath} > ${sectionLabel}`;
    }
  }
  
  return mainPath;
};

/**
 * Log a navigation event
 * @param {string} from - Source path
 * @param {string} to - Destination path
 * @param {Object} metadata - Additional metadata about the navigation
 */
export const logNavigation = (from, to, metadata = {}) => {
  // Skip if not authenticated or same path
  if (!metadata.isAuthenticated || to === lastLoggedPath) {
    return;
  }
  
  // Skip auth pages
  if (to.startsWith('/login') || to.startsWith('/register') || to.startsWith('/reset')) {
    return;
  }
  
  // Clear any pending log
  if (logTimeout) {
    clearTimeout(logTimeout);
  }
  
  // Debounce the log (wait 300ms to ensure user actually stays on page)
  logTimeout = setTimeout(async () => {
    lastLoggedPath = to;
    
    try {
      await api.post('/navigation/log', {
        path: to,
        label: generateLabel(to)
      });
    } catch (error) {
      // Silently fail - tracking is not critical
      console.debug('Navigation tracking failed:', error);
    }
  }, 300);
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