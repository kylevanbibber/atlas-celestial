/**
 * Split long SMS messages at natural break points
 * @param {string} message - The full message to split
 * @param {number} maxLength - Maximum length per segment (default 918)
 * @param {boolean} reserveSpaceForIndicator - Whether to reserve space for part indicators like "(1/2) "
 * @returns {Array<string>} - Array of message segments
 */
function splitMessage(message, maxLength = 918, reserveSpaceForIndicator = true) {
  if (!message || message.length <= maxLength) {
    return [message];
  }

  // Reserve space for part indicator "(99/99) " = 8 characters to be safe
  const indicatorSpace = reserveSpaceForIndicator ? 8 : 0;
  const effectiveMaxLength = maxLength - indicatorSpace;

  const segments = [];
  let remainingText = message;

  while (remainingText.length > 0) {
    if (remainingText.length <= effectiveMaxLength) {
      // Last segment
      segments.push(remainingText.trim());
      break;
    }

    // Find natural break point within effectiveMaxLength
    let breakPoint = effectiveMaxLength;
    const chunk = remainingText.substring(0, effectiveMaxLength);

    // Try to break at paragraph (double newline)
    const paragraphBreak = chunk.lastIndexOf('\n\n');
    if (paragraphBreak > effectiveMaxLength * 0.5) { // At least 50% through
      breakPoint = paragraphBreak + 2; // Include the newlines
    } else {
      // Try to break at single newline
      const newlineBreak = chunk.lastIndexOf('\n');
      if (newlineBreak > effectiveMaxLength * 0.5) {
        breakPoint = newlineBreak + 1;
      } else {
        // Try to break at sentence end (. ! ?)
        const sentenceBreak = Math.max(
          chunk.lastIndexOf('. '),
          chunk.lastIndexOf('! '),
          chunk.lastIndexOf('? ')
        );
        if (sentenceBreak > effectiveMaxLength * 0.5) {
          breakPoint = sentenceBreak + 2; // Include punctuation and space
        } else {
          // Try to break at comma or semicolon
          const punctuationBreak = Math.max(
            chunk.lastIndexOf(', '),
            chunk.lastIndexOf('; ')
          );
          if (punctuationBreak > effectiveMaxLength * 0.5) {
            breakPoint = punctuationBreak + 2;
          } else {
            // Last resort: break at last space
            const spaceBreak = chunk.lastIndexOf(' ');
            if (spaceBreak > effectiveMaxLength * 0.5) {
              breakPoint = spaceBreak + 1;
            }
            // If no good break point found, just break at effectiveMaxLength
          }
        }
      }
    }

    // Add segment
    const segment = remainingText.substring(0, breakPoint).trim();
    if (segment) {
      segments.push(segment);
    }

    // Move to next chunk
    remainingText = remainingText.substring(breakPoint).trim();
  }

  return segments;
}

/**
 * Add part indicators to message segments (e.g., "(1/3)", "(2/3)", "(3/3)")
 * @param {Array<string>} segments - Array of message segments
 * @param {boolean} addIndicators - Whether to add part indicators
 * @returns {Array<string>} - Segments with part indicators
 */
function addPartIndicators(segments, addIndicators = true) {
  if (!addIndicators || segments.length === 1) {
    return segments;
  }

  return segments.map((segment, index) => {
    const partIndicator = `(${index + 1}/${segments.length})`;
    return `${partIndicator} ${segment}`;
  });
}

module.exports = {
  splitMessage,
  addPartIndicators
};

