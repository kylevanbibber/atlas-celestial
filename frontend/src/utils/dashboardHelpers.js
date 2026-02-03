/**
 * Dashboard Helper Utilities
 * Shared utility functions for dashboard components
 */

/**
 * Format date to MM/DD/YYYY
 */
export const formatToMMDDYYYY = (dateObj) => {
  const date = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

/**
 * Get Monday of a given week
 */
export const getMondayOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

/**
 * Get Sunday of a given week
 */
export const getSundayOfWeek = (date) => {
  const monday = getMondayOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
};

/**
 * Calculate date range for weekly reports
 */
export const calculateDateRange = (mondayDateStr) => {
  const monday = new Date(mondayDateStr);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const startDate = new Date(sunday);
  startDate.setDate(sunday.getDate() + 1);
  
  const endDate = new Date(sunday);
  endDate.setDate(sunday.getDate() + 10);
  
  return {
    startDate: formatToMMDDYYYY(startDate),
    endDate: formatToMMDDYYYY(endDate)
  };
};

/**
 * Calculate +/- 3 day range around a report date
 */
export const calculatePlusMinus3Range = (reportDateIso) => {
  const reportDate = new Date(reportDateIso);
  const startDate = new Date(reportDate);
  startDate.setDate(reportDate.getDate() - 3);
  const endDate = new Date(reportDate);
  endDate.setDate(reportDate.getDate() + 3);
  return {
    startDate: formatToMMDDYYYY(startDate),
    endDate: formatToMMDDYYYY(endDate),
    reportDateIso: reportDate.toISOString().split('T')[0]
  };
};

/**
 * Pick appropriate report date for a week
 */
export const pickReportDateForWeek = (reportDatesIso = [], weekStartDate, weekEndDate) => {
  if (!Array.isArray(reportDatesIso) || reportDatesIso.length === 0) return null;
  const weekEnd = new Date(weekEndDate);
  const windowStart = new Date(weekEnd);
  windowStart.setDate(weekEnd.getDate() + 1);
  const windowEnd = new Date(weekEnd);
  windowEnd.setDate(weekEnd.getDate() + 10);

  const inWindow = reportDatesIso.find((d) => {
    const dt = new Date(d);
    return dt >= windowStart && dt <= windowEnd;
  });
  if (inWindow) return inWindow;

  const looseEnd = new Date(weekEnd);
  looseEnd.setDate(weekEnd.getDate() + 14);
  const looseStart = new Date(weekStartDate);
  looseStart.setDate(looseStart.getDate() - 7);
  const near = reportDatesIso.find((d) => {
    const dt = new Date(d);
    return dt >= looseStart && dt <= looseEnd;
  });
  return near || reportDatesIso[0];
};

/**
 * Pick appropriate report date for a year
 */
export const pickReportDateForYear = (reportDatesIso = [], year) => {
  if (!Array.isArray(reportDatesIso) || reportDatesIso.length === 0) return null;
  const match = reportDatesIso.find((d) => new Date(d).getFullYear() === year);
  return match || reportDatesIso[0];
};

/**
 * Format agent name from "LAST FIRST MIDDLE SUFFIX" to "FIRST MIDDLE LAST SUFFIX"
 */
export const formatAgentName = (lagnname) => {
  if (!lagnname || typeof lagnname !== 'string') {
    return '';
  }

  const parts = lagnname.trim().split(/\s+/);

  if (parts.length < 2) {
    return parts[0] || '';
  }

  const last = parts[0];
  const first = parts[1];
  let middle = '';
  let suffix = '';

  if (parts.length === 3) {
    const thirdPart = parts[2];
    if (thirdPart.length === 1) {
      middle = thirdPart;
    } else {
      suffix = thirdPart;
    }
  } else if (parts.length >= 4) {
    middle = parts[2];
    suffix = parts.slice(3).join(' ');
  }

  let formattedName = first;
  if (middle) formattedName += ` ${middle}`;
  formattedName += ` ${last}`;
  if (suffix) formattedName += ` ${suffix}`;

  return formattedName;
};

/**
 * Get MGA last name from MGA_NAME or agent name
 */
export const getMgaLastName = (mgaName, agentName) => {
  if (mgaName && typeof mgaName === 'string' && mgaName.trim()) {
    const parts = mgaName.trim().split(/\s+/);
    return parts[0] || '';
  }

  if (agentName && typeof agentName === 'string') {
    const parts = agentName.trim().split(/\s+/);
    return parts[0] || '';
  }

  return '';
};

/**
 * Format currency value
 */
export const formatCurrency = (value) => {
  if (!value && value !== 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(value);
};

/**
 * Format number value
 */
export const formatNumber = (value) => {
  if (!value && value !== 0) return '0';
  return new Intl.NumberFormat('en-US').format(value);
};

/**
 * Group data by month and year
 */
export const groupByMonthAndYear = (data, dateField) => {
  const grouped = {};
  
  data.forEach(row => {
    const dateValue = row[dateField];
    if (!dateValue) return;
    
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    if (!grouped[year]) {
      grouped[year] = Array(12).fill(0);
    }
    
    grouped[year][month] += 1;
  });
  
  return grouped;
};
