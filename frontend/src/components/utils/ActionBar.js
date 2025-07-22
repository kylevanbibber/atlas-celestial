import React, { useRef, useEffect } from "react";
import "./ActionBar.css";

const ActionBar = ({ selectedCount, totalCount, entityName = "people", archivedView = false, children }) => {
  const actionBarRef = useRef(null);
  
  // Proper pluralization function
  const pluralize = (word, count) => {
    if (count === 1) {
      // If count is 1, we need the singular form
      // If word appears to be plural, convert to singular
      return getSingular(word);
    }
    
    // If count is not 1, we need plural form
    // If word appears to already be plural, return as-is
    if (isProbablyPlural(word)) {
      return word;
    }
    
    // Otherwise, pluralize the singular word
    return getPlural(word);
  };
  
  // Check if a word is likely already plural
  const isProbablyPlural = (word) => {
    const lowerWord = word.toLowerCase();
    
    // Common plural patterns
    if (lowerWord.endsWith('s') && !lowerWord.endsWith('ss') && word.length > 1) {
      // Check if it's a common singular word that ends in 's'
      const singularSWords = ['class', 'pass', 'glass', 'mass', 'grass', 'boss', 'loss', 'cross'];
      if (!singularSWords.includes(lowerWord)) {
        return true;
      }
    }
    
    // Other plural patterns
    if (lowerWord.endsWith('ies') || lowerWord.endsWith('ves') || lowerWord.endsWith('es')) {
      return true;
    }
    
    // Irregular plurals
    const irregularPlurals = ['people', 'children', 'feet', 'teeth', 'mice', 'geese'];
    if (irregularPlurals.includes(lowerWord)) {
      return true;
    }
    
    return false;
  };
  
  // Convert plural to singular (basic conversion)
  const getSingular = (word) => {
    const lowerWord = word.toLowerCase();
    
    // Handle irregular plurals
    const irregularSingulars = {
      'people': 'person',
      'children': 'child',
      'feet': 'foot',
      'teeth': 'tooth',
      'mice': 'mouse',
      'geese': 'goose'
    };
    
    if (irregularSingulars[lowerWord]) {
      return irregularSingulars[lowerWord];
    }
    
    // If it ends with 'ies', change to 'y'
    if (lowerWord.endsWith('ies')) {
      return word.slice(0, -3) + 'y';
    }
    
    // If it ends with 'ves', change to 'f' or 'fe'
    if (lowerWord.endsWith('ves')) {
      return word.slice(0, -3) + 'f';
    }
    
    // If it ends with 'es', remove 'es' (but be careful with words that naturally end in 'es')
    if (lowerWord.endsWith('es') && !lowerWord.endsWith('ses')) {
      return word.slice(0, -2);
    }
    
    // If it ends with 's' (and likely plural), remove the 's'
    if (lowerWord.endsWith('s') && isProbablyPlural(word)) {
      return word.slice(0, -1);
    }
    
    // Otherwise return as-is
    return word;
  };
  
  // Convert singular to plural
  const getPlural = (word) => {
    // Handle irregular plurals
    const irregulars = {
      'person': 'people',
      'child': 'children',
      'foot': 'feet',
      'tooth': 'teeth',
      'mouse': 'mice',
      'goose': 'geese'
    };
    
    if (irregulars[word.toLowerCase()]) {
      return irregulars[word.toLowerCase()];
    }
    
    // If word already ends with 's', 'ss', 'sh', 'ch', 'x', 'z', add 'es'
    if (/[sxz]$/.test(word) || /[sh]$/.test(word) || /ch$/.test(word)) {
      return word + 'es';
    }
    
    // If word ends with 'y' preceded by consonant, change 'y' to 'ies'
    if (/[^aeiou]y$/.test(word)) {
      return word.slice(0, -1) + 'ies';
    }
    
    // If word ends with 'f' or 'fe', change to 'ves'
    if (/fe?$/.test(word)) {
      return word.replace(/fe?$/, 'ves');
    }
    
    // Default: just add 's'
    return word + 's';
  };
  
  const pluralizedEntity = pluralize(entityName, totalCount);
  let displayText;

  if (archivedView) {
    displayText =
      selectedCount > 0
        ? `${selectedCount}/${totalCount} archived ${pluralizedEntity} selected`
        : `${totalCount} archived ${pluralizedEntity}`;
  } else {
    displayText =
      selectedCount > 0
        ? `${selectedCount}/${totalCount} ${pluralizedEntity} selected`
        : `${totalCount} ${pluralizedEntity}`;
  }

  useEffect(() => {
    const actionBar = actionBarRef.current;
    if (!actionBar) return;
    
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    
    const mouseDownHandler = (e) => {
      isDown = true;
      startX = e.pageX - actionBar.offsetLeft;
      scrollLeft = actionBar.scrollLeft;
    };
    
    const mouseLeaveHandler = () => {
      isDown = false;
    };
    
    const mouseUpHandler = () => {
      isDown = false;
    };
    
    const mouseMoveHandler = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - actionBar.offsetLeft;
      const walk = (x - startX) * 1; // adjust multiplier as needed
      actionBar.scrollLeft = scrollLeft - walk;
    };
    
    const touchStartHandler = (e) => {
      startX = e.touches[0].pageX - actionBar.offsetLeft;
      scrollLeft = actionBar.scrollLeft;
    };
    
    const touchMoveHandler = (e) => {
      const x = e.touches[0].pageX - actionBar.offsetLeft;
      const walk = x - startX;
      actionBar.scrollLeft = scrollLeft - walk;
    };
    
    actionBar.addEventListener("mousedown", mouseDownHandler);
    actionBar.addEventListener("mouseleave", mouseLeaveHandler);
    actionBar.addEventListener("mouseup", mouseUpHandler);
    actionBar.addEventListener("mousemove", mouseMoveHandler);
    actionBar.addEventListener("touchstart", touchStartHandler);
    actionBar.addEventListener("touchmove", touchMoveHandler);
    
    return () => {
      actionBar.removeEventListener("mousedown", mouseDownHandler);
      actionBar.removeEventListener("mouseleave", mouseLeaveHandler);
      actionBar.removeEventListener("mouseup", mouseUpHandler);
      actionBar.removeEventListener("mousemove", mouseMoveHandler);
      actionBar.removeEventListener("touchstart", touchStartHandler);
      actionBar.removeEventListener("touchmove", touchMoveHandler);
    };
  }, []);

  return (
    <div className="action-bar" ref={actionBarRef}>
      <div className="selected-count">{displayText}</div>
      <div className="action-controls">{children}</div>
    </div>
  );
};

export default ActionBar; 