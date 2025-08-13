/**
 * Theme Manager Utility
 * --------------------
 * Handles loading and applying custom team styling to the application
 */

import api from '../api';

// Track the last timestamp we applied styling
let lastStyleApplied = 0;
const DEBOUNCE_TIME = 1000; // 1 second debounce

// CSS Variable names used in the app
const CSS_VARIABLES = {
  primaryColor: '--primary-color',
  secondaryColor: '--secondary-color',
  accentColor: '--accent-color',
  fontFamily: '--font-family',
};

/**
 * Load team customization settings from the API
 * @param {string} userId - The user ID
 * @returns {Promise<Object|null>} - The team settings or null if none found
 */
export const loadTeamCustomization = async (userId) => {
  if (!userId) {
    return null;
  }
  
  try {
    // First try to determine if user is RGA or MGA
    const userResponse = await api.get('/auth/profile', { params: { userId } });
    
    if (!userResponse?.data) {
      return null;
    }
    
    const user = userResponse.data;
    const teamType = user.rga ? 'RGA' : 'MGA';
    const teamId = user.rga || user.mga;
    
    if (!teamId) {
      return null;
    }
    
    const response = await api.get(`/custom/team/${teamType}/${teamId}`);
    
    if (response.data?.success && response.data?.settings) {
      return response.data.settings;
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Apply the custom team styling to the document root
 * @param {Object} settings - The team customization settings
 */
export const applyTeamStyling = (settings) => {
  // Debounce application of styles
  const now = Date.now();
  if (now - lastStyleApplied < DEBOUNCE_TIME) {
    return;
  }
  
  lastStyleApplied = now;
  
  if (!settings) {
    return;
  }
  
  try {
    const rootElement = document.documentElement;
    
    // Apply font family (if provided)
    if (settings.custom_font) {
      rootElement.style.setProperty('--font-family', settings.custom_font);
      document.body.style.fontFamily = settings.custom_font;
    }
    
    // Apply primary color (if provided)
    if (settings.primary_color) {
      rootElement.style.setProperty('--primary-color', settings.primary_color);
      
      // Convert to RGB for rgba() usage
      const rgbValue = hexToRgb(settings.primary_color);
      if (rgbValue) {
        rootElement.style.setProperty('--primary-color-rgb', rgbValue);
      }
    }
    
    // Apply secondary color (if provided)
    if (settings.secondary_color) {
      rootElement.style.setProperty('--secondary-color', settings.secondary_color);
    }
    
    // Apply accent color (if provided)
    if (settings.accent_color) {
      rootElement.style.setProperty('--accent-color', settings.accent_color);
    }
    
    // Set team name attribute for templates
    const teamName = settings.team_name || 'Arias Organization';
    rootElement.setAttribute('data-team-name', teamName);
    
  } catch (error) {
    // Silently handle errors
  }
};

/**
 * Reset the custom styling to default values
 */
export const resetTeamStyling = () => {
  // Debounce application of styles
  const now = Date.now();
  if (now - lastStyleApplied < DEBOUNCE_TIME) {
    return;
  }
  
  lastStyleApplied = now;
  
  try {
    const rootElement = document.documentElement;
    
    // Reset to default values
    rootElement.style.setProperty('--font-family', "'Avenir Next LT Pro', 'Avenir Next', Avenir, 'Segoe UI', sans-serif");
    rootElement.style.setProperty('--primary-color', '#007BFF');
    rootElement.style.setProperty('--primary-color-rgb', '0, 123, 255');
    rootElement.style.setProperty('--secondary-color', '#6C757D');
    rootElement.style.setProperty('--accent-color', '#28A745');
    
    // Reset body font
    document.body.style.fontFamily = "'Avenir Next LT Pro', 'Avenir Next', Avenir, 'Segoe UI', sans-serif";
    
    // Reset team name attribute
    rootElement.setAttribute('data-team-name', 'Arias Organization');
    
  } catch (error) {
    // Silently handle errors
  }
};

/**
 * Load a Google Font
 * @param {string} fontName - The name of the font to load
 */
const loadGoogleFont = (fontName) => {
  // Check if the font is already loaded
  const existingLink = document.querySelector(`link[href*="${fontName}"]`);
  if (existingLink) return;
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(' ', '+')}&display=swap`;
  
  document.head.appendChild(link);
};

/**
 * Apply custom CSS to the document
 * @param {string} css - The custom CSS rules to apply
 * @param {string} teamId - The team ID for the style element ID
 */
const applyCustomCSS = (css, teamId) => {
  if (!css) return;
  
  // Remove any existing custom CSS first
  removeCustomCSS();
  
  // Create a new style element
  const styleEl = document.createElement('style');
  styleEl.id = `team-custom-css-${teamId}`;
  styleEl.textContent = css;
  
  document.head.appendChild(styleEl);
};

/**
 * Remove any custom CSS that was previously applied
 */
const removeCustomCSS = () => {
  const customStyle = document.querySelector('style[id^="team-custom-css-"]');
  if (customStyle) {
    customStyle.remove();
  }
};

/**
 * Update the application logo
 * @param {string} logoUrl - The URL to the logo image
 */
const updateAppLogo = (logoUrl) => {
  // This assumes there's a logo element with a specific class or ID
  // Adjust the selector as needed for your app
  const logoElements = document.querySelectorAll('.app-logo, .header-logo');
  
  logoElements.forEach(logo => {
    if (logo.tagName === 'IMG') {
      logo.src = logoUrl;
    } else {
      // If it's a background image or has another implementation
      logo.style.backgroundImage = `url(${logoUrl})`;
    }
  });
};

/**
 * Reset the app logo to the default
 */
const resetAppLogo = () => {
  // Reset to default logo
  // Adjust as needed for your app
  const logoElements = document.querySelectorAll('.app-logo, .header-logo');
  
  logoElements.forEach(logo => {
    if (logo.tagName === 'IMG') {
      logo.src = '/logo.svg'; // Default logo path
    } else {
      logo.style.backgroundImage = '';
    }
  });
};

// Helper function to convert hex color to RGB format
const hexToRgb = (hex) => {
  try {
    // Remove the hash
    hex = hex.replace('#', '');
    
    // Parse the hex values
    let r, g, b;
    if (hex.length === 3) {
      r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
      g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
      b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    
    return `${r}, ${g}, ${b}`;
  } catch (error) {
    return null;
  }
};

export default {
  loadTeamCustomization,
  applyTeamStyling,
  resetTeamStyling
}; 