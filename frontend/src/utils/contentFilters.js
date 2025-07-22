/**
 * Content Filtering Utilities
 * --------------------------
 * Provides functions for filtering inappropriate content in user-generated text.
 */

// List of banned words - expand as needed based on your moderation policies
const BANNED_WORDS = [
  // Common profanity
  'profanity', 'obscene', 'vulgar',
  // Add additional words based on your content guidelines
  
  // This is just a placeholder list - you should replace with actual words
  // that violate your application's content policy
];

/**
 * Check if text contains banned words
 * @param {string} text - The text to check
 * @returns {boolean} - True if banned content is found
 */
export const containsBannedWords = (text) => {
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  
  // Check for exact matches and word boundaries
  for (const word of BANNED_WORDS) {
    // Use word boundary check to avoid false positives
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lowerText)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Validate content length
 * @param {string} text - The text to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {boolean} - True if length is valid
 */
export const validateLength = (text, maxLength) => {
  if (!text) return true;
  return text.length <= maxLength;
};

/**
 * Get feedback about content issues
 * @param {string} text - The text to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {object} - Object with validation results
 */
export const getContentFeedback = (text, maxLength) => {
  const result = {
    isValid: true,
    lengthValid: true,
    contentValid: true,
    message: '',
    currentLength: text ? text.length : 0,
    maxLength
  };
  
  // Check length
  if (!validateLength(text, maxLength)) {
    result.lengthValid = false;
    result.isValid = false;
    result.message = `Content exceeds maximum length of ${maxLength} characters`;
  }
  
  // Check for banned words
  if (containsBannedWords(text)) {
    result.contentValid = false;
    result.isValid = false;
    result.message = 'Content contains inappropriate language. Please revise.';
  }
  
  return result;
};

export default {
  containsBannedWords,
  validateLength,
  getContentFeedback
}; 