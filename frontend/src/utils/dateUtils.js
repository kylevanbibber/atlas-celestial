// Date utility functions for report components

// Fix timezone issues by parsing date string manually instead of using new Date(dateString)
// which treats the string as UTC and can cause off-by-one day errors
export const parseDate = (dateString) => {
  if (typeof dateString === 'string' && dateString.includes('-')) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month - 1 because JS months are 0-indexed
  }
  return new Date(dateString);
};

// UTC Time Conversion Functions
// Convert UTC date string to local time for display
export const utcToLocal = (utcDateString) => {
  if (!utcDateString) return null;
  
  // Parse the UTC date string and convert to local time
  const utcDate = new Date(utcDateString + (utcDateString.includes('Z') ? '' : 'Z'));
  return utcDate;
};

// Convert local datetime-local input value to UTC string for backend
export const localToUTC = (localDateTimeString) => {
  if (!localDateTimeString) return null;
  
  // Create a date object from the local datetime-local input
  const localDate = new Date(localDateTimeString);
  return localDate.toISOString();
};

// Format UTC date for display in local time
export const formatUTCForDisplay = (utcDateString) => {
  if (!utcDateString) return "N/A";
  
  const localDate = utcToLocal(utcDateString);
  return localDate.toLocaleString();
};

// Format UTC date for datetime-local input (returns local time in YYYY-MM-DDTHH:mm format)
export const formatUTCForInput = (utcDateString) => {
  if (!utcDateString) return "";
  
  const localDate = utcToLocal(utcDateString);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Calculate date range based on a date value and range type
export const calculateDateRange = (dateValue, type) => {
  const date = parseDate(dateValue);
  
  if (type === 'week') {
    // Calculate Monday-Sunday range
    const monday = new Date(date);
    const dayOfWeek = monday.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(monday.getDate() + mondayOffset);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
      start_date: monday.toISOString().split('T')[0],
      end_date: sunday.toISOString().split('T')[0],
      type: 'week'
    };
  } else if (type === 'month') {
    // Calculate first and last day of month
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    return {
      start_date: monthStart.toISOString().split('T')[0],
      end_date: monthEnd.toISOString().split('T')[0],
      type: 'month'
    };
  } else if (type === 'year') {
    // Calculate first and last day of year
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const yearEnd = new Date(date.getFullYear(), 11, 31);
    
    return {
      start_date: yearStart.toISOString().split('T')[0],
      end_date: yearEnd.toISOString().split('T')[0],
      type: 'year'
    };
  }
  
  return { start_date: dateValue, end_date: dateValue, type: 'custom' };
};

// Get the start of the week (Monday) for a given date
export const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

// Check if two dates are in the same range (week, month, or year)
export const isSameRange = (date1, date2, rangeType) => {
  if (rangeType === 'week') {
    return getWeekStart(date1).getTime() === getWeekStart(date2).getTime();
  } else if (rangeType === 'month') {
    return date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
  } else if (rangeType === 'year') {
    return date1.getFullYear() === date2.getFullYear();
  }
  return false;
};

// Format date range for display based on range type
export const formatDateRange = (dateRange, rangeType) => {
  if (!dateRange || !dateRange.start_date || !dateRange.end_date) {
    return new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  const startDate = new Date(dateRange.start_date + 'T00:00:00');
  const endDate = new Date(dateRange.end_date + 'T00:00:00');
  
  // Format based on range type
  if (rangeType === 'week') {
    // Week format: m/d/yy-m/d/yy
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    const startYear = startDate.getFullYear().toString().slice(-2);
    
    const endMonth = endDate.getMonth() + 1;
    const endDay = endDate.getDate();
    const endYear = endDate.getFullYear().toString().slice(-2);
    
    return `${startMonth}/${startDay}/${startYear}-${endMonth}/${endDay}/${endYear}`;
  } else if (rangeType === 'month') {
    // Month format: month yy
    return startDate.toLocaleDateString('en-US', { 
      month: 'short', 
      year: '2-digit' 
    });
  } else if (rangeType === 'year') {
    // Year format: YYYY
    return startDate.getFullYear().toString();
  }
  
  // Fallback for custom ranges
  if (dateRange.start_date === dateRange.end_date) {
    return startDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }
  
  // If it's the same month and year
  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`;
  }
  
  // If it's the same year
  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  
  // Different years
  return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}; 