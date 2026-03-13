// Utility function to calculate ranks with tie handling
export const calculateRanksWithTies = (data, valueField) => {
  if (!data || data.length === 0) return data;
  
  let currentRank = 1;
  let previousValue = null;
  let skipCount = 0;
  
  return data.map((item, index) => {
    const currentValue = item[valueField] || 0;
    
    if (previousValue !== null && currentValue !== previousValue) {
      currentRank += skipCount;
      skipCount = 1;
    } else if (previousValue !== null && currentValue === previousValue) {
      skipCount++;
    } else {
      skipCount = 1;
    }
    
    previousValue = currentValue;
    
    return {
      ...item,
      rank: currentRank
    };
  });
};

// Calculate achievement badges based on performance indicators
export const calculateAchievement = (currentItem, indicators, rangeType = 'month') => {
  // Check for RECORD achievement first (highest priority)
  if (indicators.isRecord) {
    const periodLabel = rangeType.charAt(0).toUpperCase() + rangeType.slice(1);
    return `🏆 Record ${periodLabel}`;
  }
  
  // Check for DETHRONED - was #1 last period but moved down
  if (indicators.rankChange < 0 && (currentItem.rank + indicators.rankChange) === 1) {
    return "DETHRONED";
  }
  
  if (currentItem.rank === 1) {
    if (indicators.weeksAtNumber1 >= 3) {
      return "🔥 HOT STREAK";
    } else if (indicators.rankChange > 0) {
      return "📈 RISING UP";
    } else if (indicators.rankChange === 0) {
      return "👑 CHAMPION";
    }
  } else if (indicators.rankChange && indicators.rankChange >= 3) {
    return "🚀 BIG MOVER";
  } else if (indicators.rankChange && indicators.rankChange >= 2) {
    return "📈 CLIMBING";
  } else if (currentItem.rank <= 3 && indicators.trend === "stable") {
    return "⭐ CONSISTENT";
  }
  
  return null;
};

// Find previous rank for a given name in previous period data
export const findPreviousRank = (name, previousData) => {
  if (!previousData || previousData.length === 0) {
    return null;
  }
  
  const previousItem = previousData.find(item => item.name === name);
  return previousItem ? previousItem.rank : null;
};

// Calculate weeks at number one (simplified - would need more historical data for accuracy)
export const calculateWeeksAtNumberOne = (name, previousData) => {
  if (!previousData || previousData.length === 0) return 1;
  
  const wasNumberOneLastWeek = previousData.find(item => item.name === name && item.rank === 1);
  return wasNumberOneLastWeek ? 2 : 1; // Simplified - would need more historical data
}; 