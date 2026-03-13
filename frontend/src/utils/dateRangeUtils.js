/**
 * Centralized Date Range Utilities
 * 
 * Single source of truth for all date range calculations across the application.
 * Eliminates redundant date calculation functions and ensures consistency.
 */

/**
 * Parse a date string (YYYY-MM-DD) in local timezone to avoid UTC conversion issues
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} Date object in local timezone
 */
export const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Format a Date object to YYYY-MM-DD string in local timezone
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYY-MM-DD format
 */
export const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get Monday of a given week
 * @param {Date} date - Any date in the week
 * @returns {Date} Monday of that week
 */
export const getMondayOfWeek = (date) => {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff);
};

/**
 * Get Sunday of a given week
 * @param {Date} date - Any date in the week
 * @returns {Date} Sunday of that week
 */
export const getSundayOfWeek = (date) => {
  const monday = getMondayOfWeek(date);
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
};

/**
 * Get Friday of the business week containing the given date.
 * Sat/Sun map to the *preceding* Friday (the completed business week).
 * Mon–Fri map to that same week's Friday.
 * @param {Date} date - Any date
 * @returns {Date} Friday of the business week
 */
export const getFridayOfWeek = (date) => {
  const dow = date.getDay(); // 0=Sun … 6=Sat
  let diff;
  if (dow === 0) diff = -2;        // Sun → prev Fri
  else if (dow === 6) diff = -1;   // Sat → prev Fri
  else diff = 5 - dow;             // Mon(+4) … Fri(+0)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
};

/**
 * Calculate date range based on period type and reference date
 * @param {string} period - 'week' | 'month' | 'year'
 * @param {Date} refDate - Reference date (defaults to now)
 * @param {Object} options - Optional settings
 * @param {string} options.weekMode - 'standard' (Mon-Sun, default) or 'friday' (Mon-Fri, for MORE report)
 * @returns {Object} { start: Date, end: Date, startDate: string, endDate: string }
 */
export const calculateDateRange = (period, refDate = new Date(), options = {}) => {
  const { weekMode = 'standard' } = options;
  let start, end;

  switch (period) {
    case 'week': {
      if (weekMode === 'friday') {
        // Friday mode (MORE report): Mon-Fri, anchored to Friday
        const fri = getFridayOfWeek(refDate);
        start = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate() - 4); // Monday
        end = fri;
      } else {
        // Standard mode: Mon-Sun
        const monday = getMondayOfWeek(refDate);
        start = monday;
        end = getSundayOfWeek(refDate);
      }
      break;
    }
    
    case 'month':
      start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
      break;
    
    case 'year':
      start = new Date(refDate.getFullYear(), 0, 1);
      end = new Date(refDate.getFullYear(), 11, 31);
      break;
    
    default:
      // Default to month
      start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
  }

  // Normalize times
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
    month: start.getMonth(),
    year: start.getFullYear()
  };
};

/**
 * Calculate date range for stats timeframe (personal stats filter)
 * @param {string} timeframe - 'thisMonth' | 'lastMonth' | 'sixMonths' | 'allTime'
 * @returns {Object} { startDate: string, endDate: string }
 */
export const calculateStatsDateRange = (timeframe) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let start, end;

  switch (timeframe) {
    case 'thisMonth':
      start = new Date(currentYear, currentMonth, 1);
      end = new Date(currentYear, currentMonth + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    
    case 'lastMonth': {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      start = new Date(lastMonthYear, lastMonth, 1);
      end = new Date(lastMonthYear, lastMonth + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    
    case 'sixMonths':
      start = new Date(currentYear, currentMonth - 6, 1);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
    
    case 'allTime':
      start = new Date(2020, 0, 1); // Start from 2020
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
    
    default:
      start = new Date(currentYear, currentMonth, 1);
      end = new Date();
      end.setHours(23, 59, 59, 999);
  }

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end)
  };
};

/**
 * Get current period info - whether viewing current week/month/year
 * @param {string} period - 'week' | 'month' | 'year'
 * @param {Date} refDate - Reference date
 * @returns {boolean} True if refDate is in the current period
 */
export const isCurrentPeriod = (period, refDate) => {
  const now = new Date();
  
  switch (period) {
    case 'week': {
      const nowFri = getFridayOfWeek(now);
      const refFri = getFridayOfWeek(refDate);
      return nowFri.getTime() === refFri.getTime();
    }
    
    case 'month':
      return now.getFullYear() === refDate.getFullYear() && 
             now.getMonth() === refDate.getMonth();
    
    case 'year':
      return now.getFullYear() === refDate.getFullYear();
    
    default:
      return false;
  }
};

/**
 * Navigate to next period
 * @param {string} period - 'week' | 'month' | 'year'
 * @param {Date} currentDate - Current reference date
 * @returns {Date} New reference date
 */
export const navigateNext = (period, currentDate) => {
  const newDate = new Date(currentDate);
  
  switch (period) {
    case 'week':
      newDate.setDate(currentDate.getDate() + 7);
      break;
    
    case 'month':
      newDate.setMonth(currentDate.getMonth() + 1);
      break;
    
    case 'year':
      newDate.setFullYear(currentDate.getFullYear() + 1);
      break;
    
    default:
      newDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return newDate;
};

/**
 * Navigate to previous period
 * @param {string} period - 'week' | 'month' | 'year'
 * @param {Date} currentDate - Current reference date
 * @returns {Date} New reference date
 */
export const navigatePrevious = (period, currentDate) => {
  const newDate = new Date(currentDate);
  
  switch (period) {
    case 'week':
      newDate.setDate(currentDate.getDate() - 7);
      break;
    
    case 'month':
      newDate.setMonth(currentDate.getMonth() - 1);
      break;
    
    case 'year':
      newDate.setFullYear(currentDate.getFullYear() - 1);
      break;
    
    default:
      newDate.setMonth(currentDate.getMonth() - 1);
  }
  
  return newDate;
};

/**
 * Format date range for display
 * @param {string} period - 'week' | 'month' | 'year'
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @param {Object} options - Optional settings
 * @param {string} options.weekMode - 'standard' (Mon-Sun, default) or 'friday' (Mon-Fri, display Friday only)
 * @returns {string} Formatted display string
 */
export const formatDateRangeDisplay = (period, start, end, options = {}) => {
  const { weekMode = 'standard' } = options;

  switch (period) {
    case 'week':
      if (weekMode === 'friday') {
        // MORE report: display just the Friday date (end of the business week)
        return end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      // Standard: display Mon - Sun range
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    
    case 'month':
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    case 'year':
      return start.getFullYear().toString();
    
    default:
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
};
