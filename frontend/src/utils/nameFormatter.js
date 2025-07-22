/**
 * Name formatting utilities for lagnname field
 * 
 * lagnname format: "LAST FIRST MIDDLE SUFFIX"
 * - LAST: Always present
 * - FIRST: Always present  
 * - MIDDLE: Single character, optional
 * - SUFFIX: Optional (Jr, Sr, III, etc.)
 * 
 * Examples:
 * - "SMITH JOHN A JR" -> first: "JOHN", middle: "A", last: "SMITH", suffix: "JR"
 * - "SMITH JOHN A" -> first: "JOHN", middle: "A", last: "SMITH", suffix: ""
 * - "SMITH JOHN" -> first: "JOHN", middle: "", last: "SMITH", suffix: ""
 */

/**
 * Parse a lagnname string into its components
 * @param {string} lagnname - The name in "LAST FIRST MIDDLE SUFFIX" format
 * @returns {object} Object with first, middle, last, suffix properties
 */
export const parseLagnname = (lagnname) => {
  if (!lagnname || typeof lagnname !== 'string') {
    return { first: '', middle: '', last: '', suffix: '' };
  }

  const parts = lagnname.trim().split(/\s+/);
  
  if (parts.length < 2) {
    // Handle edge case with insufficient parts
    return { 
      first: parts[0] || '', 
      middle: '', 
      last: '', 
      suffix: '' 
    };
  }

  const last = parts[0];
  const first = parts[1];
  
  // Determine middle and suffix based on remaining parts
  let middle = '';
  let suffix = '';
  
  if (parts.length === 3) {
    // Could be "LAST FIRST MIDDLE" or "LAST FIRST SUFFIX"
    const thirdPart = parts[2];
    if (thirdPart.length === 1) {
      // Single character = middle initial
      middle = thirdPart;
    } else {
      // Multiple characters = suffix
      suffix = thirdPart;
    }
  } else if (parts.length === 4) {
    // "LAST FIRST MIDDLE SUFFIX"
    middle = parts[2];
    suffix = parts[3];
  } else if (parts.length > 4) {
    // Handle edge case with extra parts
    middle = parts[2];
    suffix = parts.slice(3).join(' ');
  }

  return {
    first: first || '',
    middle: middle || '',
    last: last || '',
    suffix: suffix || ''
  };
};

/**
 * Format a lagnname for display
 * @param {string} lagnname - The name in "LAST FIRST MIDDLE SUFFIX" format
 * @param {object} options - Formatting options
 * @param {boolean} options.includeMiddle - Whether to include middle initial (default: false)
 * @param {boolean} options.includeSuffix - Whether to include suffix (default: true)
 * @param {boolean} options.firstNameOnly - Return only first name (default: false)
 * @returns {string} Formatted name
 */
export const formatLagnname = (lagnname, options = {}) => {
  const {
    includeMiddle = false,
    includeSuffix = true,
    firstNameOnly = false
  } = options;

  const { first, middle, last, suffix } = parseLagnname(lagnname);

  if (firstNameOnly) {
    return first;
  }

  // Build the formatted name
  let formattedName = first;

  if (includeMiddle && middle) {
    formattedName += ` ${middle}`;
  }

  if (last) {
    formattedName += ` ${last}`;
  }

  if (includeSuffix && suffix) {
    formattedName += ` ${suffix}`;
  }

  return formattedName;
};

/**
 * Get the first initial from a lagnname
 * @param {string} lagnname - The name in "LAST FIRST MIDDLE SUFFIX" format
 * @returns {string} First initial (uppercase)
 */
export const getFirstInitial = (lagnname) => {
  const { first } = parseLagnname(lagnname);
  return first.charAt(0).toUpperCase();
};

/**
 * Common formatting presets
 */
export const NameFormats = {
  // "John Smith"
  FIRST_LAST: (lagnname) => formatLagnname(lagnname, { 
    includeMiddle: false, 
    includeSuffix: false 
  }),
  
  // "John A Smith"
  FIRST_MIDDLE_LAST: (lagnname) => formatLagnname(lagnname, { 
    includeMiddle: true, 
    includeSuffix: false 
  }),
  
  // "John Smith Jr"
  FIRST_LAST_SUFFIX: (lagnname) => formatLagnname(lagnname, { 
    includeMiddle: false, 
    includeSuffix: true 
  }),
  
  // "John A Smith Jr"
  FULL: (lagnname) => formatLagnname(lagnname, { 
    includeMiddle: true, 
    includeSuffix: true 
  }),
  
  // "John"
  FIRST_ONLY: (lagnname) => formatLagnname(lagnname, { 
    firstNameOnly: true 
  })
}; 