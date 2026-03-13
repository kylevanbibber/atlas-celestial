// Date navigation utilities for report components
import { parseDate, calculateDateRange } from './dateUtils';

// Format a Date to YYYY-MM-DD in local timezone (avoids UTC shift from toISOString)
const formatLocal = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Navigate to previous period based on date options
export const navigateBackward = (currentDate, dateOptions, rangeType) => {
  if (dateOptions.length === 0) return null;
  
  let currentValue;
  if (rangeType === 'week') {
    currentValue = formatLocal(currentDate);
  } else if (rangeType === 'month') {
    currentValue = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  } else {
    currentValue = currentDate.getFullYear().toString();
  }
  
  const currentIndex = dateOptions.findIndex(option => option.value === currentValue);
  const nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, dateOptions.length - 1);
  
  if (nextIndex < dateOptions.length) {
    const selectedOption = dateOptions[nextIndex];
    return createDateFromOption(selectedOption, rangeType);
  }
  
  return null;
};

// Navigate to next period based on date options
export const navigateForward = (currentDate, dateOptions, rangeType) => {
  if (dateOptions.length === 0) return null;
  
  let currentValue;
  if (rangeType === 'week') {
    currentValue = formatLocal(currentDate);
  } else if (rangeType === 'month') {
    currentValue = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  } else {
    currentValue = currentDate.getFullYear().toString();
  }
  
  const currentIndex = dateOptions.findIndex(option => option.value === currentValue);
  const prevIndex = currentIndex === -1 ? 0 : Math.max(currentIndex - 1, 0);
  
  if (prevIndex >= 0) {
    const selectedOption = dateOptions[prevIndex];
    return createDateFromOption(selectedOption, rangeType);
  }
  
  return null;
};

// Create date and date range from a date option
export const createDateFromOption = (selectedOption, rangeType) => {
  let newDate;
  let newDateRange;
  
  if (rangeType === 'week') {
    newDate = parseDate(selectedOption.value);
    newDateRange = {
      start_date: selectedOption.value,
      end_date: selectedOption.value,
      type: 'week'
    };
  } else if (rangeType === 'month') {
    const [year, month] = selectedOption.value.split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);
    newDate = startDate;
    newDateRange = {
      start_date: formatLocal(startDate),
      end_date: formatLocal(endDate),
      type: 'month'
    };
  } else if (rangeType === 'year') {
    const year = parseInt(selectedOption.value);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    newDate = startDate;
    newDateRange = {
      start_date: formatLocal(startDate),
      end_date: formatLocal(endDate),
      type: 'year'
    };
  }
  
  return { newDate, newDateRange };
};

// Find current period in date options and set as selected
export const findCurrentPeriodInOptions = (dateOptions, rangeType) => {
  if (dateOptions.length === 0) return null;
  
  const today = new Date();
  let selectedOption = dateOptions[0]; // Default to most recent

  if (rangeType === 'month') {
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const current = dateOptions.find(opt => opt.value === currentMonth);
    if (current) selectedOption = current;
  } else if (rangeType === 'year') {
    const currentYear = today.getFullYear().toString();
    const current = dateOptions.find(opt => opt.value === currentYear);
    if (current) selectedOption = current;
  } else if (rangeType === 'week') {
    // For weeks, find the option that contains today
    const current = dateOptions.find(opt => {
      const optDate = parseDate(opt.value);
      const weekRange = calculateDateRange(opt.value, 'week');
      const weekStart = parseDate(weekRange.start_date);
      const weekEnd = parseDate(weekRange.end_date);
      return today >= weekStart && today <= weekEnd;
    });
    if (current) selectedOption = current;
  }

  return createDateFromOption(selectedOption, rangeType);
}; 