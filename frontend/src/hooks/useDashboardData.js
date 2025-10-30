
/**
 * Unified Dashboard Data Hook
 * 
 * This hook handles data fetching and processing for all dashboard types.
 * It dynamically calls the appropriate APIs based on the user's clname.
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { getApiEndpoints } from '../config/dashboardConfig';

/**
 * Helper function to calculate Monday-Sunday date range for current week
 */
const getCurrentWeekRange = () => {
  // Use UTC to avoid timezone issues
  const today = new Date();
  
  const dayOfWeek = today.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days to go back to Monday
  
  // Calculate Monday of current week (UTC)
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  
  // Calculate Sunday of current week (UTC)
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  
  // Format as YYYY-MM-DD to match Daily_Activity.reportDate format
  const startDate = monday.toISOString().split('T')[0];
  const endDate = sunday.toISOString().split('T')[0];
  
  
  return { startDate, endDate };
};

/**
 * Helper function to get current month date range (first day to last day of current month)
 */
const getCurrentMonthRange = () => {
  // Use UTC to avoid timezone issues
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  
  // First day of current month (UTC)
  const firstDay = new Date(Date.UTC(year, month, 1));
  
  // Last day of current month (UTC)
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  
  // Format as YYYY-MM-DD to match Daily_Activity.reportDate format
  const startDate = firstDay.toISOString().split('T')[0];
  const endDate = lastDay.toISOString().split('T')[0];
  
  
  return { startDate, endDate };
};

const getPreviousMonthRange = () => {
  // Use UTC to avoid timezone issues
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  
  // Calculate previous month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  
  // First day of previous month (UTC)
  const firstDay = new Date(Date.UTC(prevYear, prevMonth, 1));
  
  // Last day of previous month (UTC)
  const lastDay = new Date(Date.UTC(prevYear, prevMonth + 1, 0));
  
  // Format as YYYY-MM-DD to match Daily_Activity.reportDate format
  const startDate = firstDay.toISOString().split('T')[0];
  const endDate = lastDay.toISOString().split('T')[0];
  
  return { startDate, endDate };
};

const getYearToDateRange = () => {
  // Use UTC to avoid timezone issues
  const today = new Date();
  const year = today.getUTCFullYear();
  
  // January 1st of current year (UTC)
  const firstDay = new Date(Date.UTC(year, 0, 1));
  
  // Today (UTC)
  const lastDay = new Date(today);
  lastDay.setUTCHours(23, 59, 59, 999);
  
  // Format as YYYY-MM-DD to match Daily_Activity.reportDate format
  const startDate = firstDay.toISOString().split('T')[0];
  const endDate = lastDay.toISOString().split('T')[0];
  
  return { startDate, endDate };
};

/**
 * Helper function to get the actual current month (for "This Month" section)
 */
const getCurrentMonth = () => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // 1-indexed
  const currentYear = currentDate.getFullYear();
  
  return { currentMonth, currentYear };
};

/**
 * Helper function to calculate reporting month logic
 */
const getReportingMonth = () => {
  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  let reportingDate;
  
  if (currentDay < 5) {
    reportingDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1);
  } else {
    reportingDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  }
  
  const reportingMonth = reportingDate.getMonth() + 1;
  const reportingYear = reportingDate.getFullYear();
  
  return { reportingMonth, reportingYear, reportingDate };
};

/**
 * Helper function to find the most recent month with data
 */
const findMostRecentMonthWithData = (monthlyData, maxIndex, dataType) => {
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  // Start from maxIndex - 1 to exclude the current month
  for (let i = maxIndex - 1; i >= 0; i--) {
    if (monthlyData[i] > 0) {
      return {
        value: monthlyData[i],
        month: monthNames[i]
      };
    }
  }
  
  return {
    value: 0,
    month: monthNames[0]
  };
};

/**
 * Process VIPs data for codes calculation
 */
const processVipsData = (data) => {
  const grouped = {};
  data.forEach((item) => {
    if (!item.vip_month) return;
    const date = new Date(item.vip_month);
    if (isNaN(date.getTime())) return;
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    if (!grouped[year]) {
      grouped[year] = Array(12).fill(0);
    }
    grouped[year][monthIndex] = (grouped[year][monthIndex] || 0) + 1;
  });
  return grouped;
};

/**
 * Process Associates data for codes calculation
 */
const processAssociatesData = (data) => {
  const grouped = {};
  data.forEach((item) => {
    if (!item.PRODDATE) return;
    const date = new Date(item.PRODDATE + 'T00:00:00');
    if (isNaN(date.getTime())) return;
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    if (!grouped[year]) {
      grouped[year] = Array(12).fill(0);
    }
    grouped[year][monthIndex] = (grouped[year][monthIndex] || 0) + 1;
  });
  return grouped;
};

/**
 * Process Hires data 
 */
const processHiresData = (data) => {
  const grouped = {};
  data.forEach((item) => {
    if (!item.MORE_Date) return;
    const date = new Date(item.MORE_Date);
    if (isNaN(date.getTime())) return;
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    if (!grouped[year]) {
      grouped[year] = Array(12).fill(0);
    }
    grouped[year][monthIndex] = (grouped[year][monthIndex] || 0) + (parseInt(item.Total_Hires) || 0);
  });
  return grouped;
};

/**
 * Calculate codes and hires metrics for any role
 */
const calculateCodesAndHiresMetrics = (vipsData, associatesData, hiresData, reportingMonthIndex) => {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  
  const vipsDataProcessed = processVipsData(vipsData);
  const associatesDataProcessed = processAssociatesData(associatesData);
  const hiresDataProcessed = processHiresData(hiresData);

  const currentYearVips = vipsDataProcessed[currentYear] || Array(12).fill(0);
  const previousYearVips = vipsDataProcessed[previousYear] || Array(12).fill(0);
  const currentYearAssociates = associatesDataProcessed[currentYear] || Array(12).fill(0);
  const previousYearAssociates = associatesDataProcessed[previousYear] || Array(12).fill(0);
  const currentYearHires = hiresDataProcessed[currentYear] || Array(12).fill(0);
  const previousYearHires = hiresDataProcessed[previousYear] || Array(12).fill(0);

  const currentYearCodes = currentYearVips.map((vips, index) => vips + currentYearAssociates[index]);
  const previousYearCodes = previousYearVips.map((vips, index) => vips + previousYearAssociates[index]);

  const ytdCodes = currentYearCodes.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);
  const currentMonthCodes = currentYearCodes[reportingMonthIndex] || 0;
  const currentMonthHires = currentYearHires[reportingMonthIndex] || 0;
  
  // Find the most recent month with actual codes data
  const codesComparison = findMostRecentMonthWithData(currentYearCodes, reportingMonthIndex, "Codes");
  const previousMonthCodes = codesComparison.value;
  const codesComparisonMonth = codesComparison.month;
  
  // Find the most recent month with actual hires data  
  const hiresComparison = findMostRecentMonthWithData(currentYearHires, reportingMonthIndex, "Hires");
  const previousMonthHires = hiresComparison.value;
  const hiresComparisonMonth = hiresComparison.month;
  
  const previousYearYtdCodes = previousYearCodes.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);

  return {
    ytdCodes,
    ytdHires: currentYearHires.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0),
    previousYearYtdCodes,
    previousYearYtdHires: previousYearHires.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0),
    currentMonthCodes,
    currentMonthHires,
    previousMonthCodes,
    previousMonthHires,
    codesComparisonMonth,
    hiresComparisonMonth
  };
};

  /**
   * Process SGA ALP data (different structure than other roles)
   */
  const processSgaAlpData = (data) => {
    const grouped = {};
    
    data.forEach((item) => {
      if (!item.month) return;
      const parts = item.month.split("/");
      if (parts.length !== 2) return;
      const monthIndex = parseInt(parts[0], 10) - 1; // convert to 0-indexed
      const year = parseInt(parts[1], 10);
      
      if (!grouped[year]) {
        grouped[year] = Array(12).fill(0);
      }
      grouped[year][monthIndex] = parseFloat(item.net) || 0;
    });
    
    return grouped;
  };

  /**
   * Calculate SGA dashboard metrics (different logic than other roles)
   */
  const calculateSgaDashboardMetrics = (sgaData) => {
    if (!sgaData || Object.keys(sgaData).length === 0) {
      return {
        currentMonthAlp: 0,
        previousMonthAlp: 0,
        ytdAlp: 0,
        previousYearYtdAlp: 0,
        monthOverMonthGrowth: 0,
        yearOverYearGrowth: 0,
        yearOverYearGrowthPercent: 0,
        reportingMonth: new Date().toLocaleString('default', { month: 'long' }),
        comparisonMonth: new Date().toLocaleString('default', { month: 'long' }),
        reportingMonthIndex: 0
      };
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentCalendarMonth = today.getMonth(); // 0-indexed (0 = Jan, 7 = Aug)
    const currentDay = today.getDate();
    const previousYear = currentYear - 1;
    
    const currentYearData = sgaData[currentYear] || Array(12).fill(0);
    const previousYearData = sgaData[previousYear] || Array(12).fill(0);
    
    // Determine the "reporting month" based on 5th-of-month rule
    let reportingMonthIndex;
    let usesPreviousYear = false;
    
    if (currentDay < 5) {
      // Before 5th: use 2 months ago
      reportingMonthIndex = currentCalendarMonth - 2;
      if (reportingMonthIndex < 0) {
        reportingMonthIndex = 12 + reportingMonthIndex;
        usesPreviousYear = true;
      }
    } else {
      // On/after 5th: use last month
      reportingMonthIndex = currentCalendarMonth - 1;
      if (reportingMonthIndex < 0) {
        reportingMonthIndex = 11;
        usesPreviousYear = true;
      }
    }
    
    // Get the month before the reporting month for comparison
    let comparisonMonthIndex = reportingMonthIndex - 1;
    if (comparisonMonthIndex < 0) {
      comparisonMonthIndex = 11;
    }
    
    // Handle year boundary cases for data access
    const reportingYear = usesPreviousYear ? previousYear : currentYear;
    const reportingYearData = usesPreviousYear ? previousYearData : currentYearData;
    
    // Get month names for display
    const reportingMonthName = new Date(reportingYear, reportingMonthIndex, 1).toLocaleString('default', { month: 'long' });
    const comparisonMonthName = new Date(reportingYear, comparisonMonthIndex, 1).toLocaleString('default', { month: 'long' });
    
    // Current month ALP (based on reporting month)
    const currentMonthAlp = reportingYearData[reportingMonthIndex] || 0;
    
    // YTD ALP (sum of months Jan through reporting month)
    const ytdAlp = usesPreviousYear 
      ? previousYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + (val || 0), 0)
      : currentYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + (val || 0), 0);
    
    // Previous month ALP (month before reporting month)
    let previousMonthAlp = 0;
    let actualComparisonMonth = comparisonMonthName;
    if (comparisonMonthIndex >= 0) {
      previousMonthAlp = reportingYearData[comparisonMonthIndex] || 0;
      
      // If no data found, use smart lookup to find most recent month with data
      if (previousMonthAlp === 0) {
        const alpComparison = findMostRecentMonthWithData(reportingYearData, reportingMonthIndex, "SGA ALP");
        previousMonthAlp = alpComparison.value;
        actualComparisonMonth = alpComparison.month;
      }
    }
    
    // Previous year YTD ALP
    const previousYearYtdAlp = previousYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + (val || 0), 0);
    
    // Calculate growth percentages
    const monthOverMonthGrowth = previousMonthAlp > 0 ? ((currentMonthAlp - previousMonthAlp) / previousMonthAlp) * 100 : 0;
    const yearOverYearGrowth = previousYearYtdAlp > 0 ? ((ytdAlp - previousYearYtdAlp) / previousYearYtdAlp) * 100 : 0;
    
    return {
      currentMonthAlp,
      previousMonthAlp,
      ytdAlp,
      previousYearYtdAlp,
      monthOverMonthGrowth,
      yearOverYearGrowth,
      yearOverYearGrowthPercent: yearOverYearGrowth,
      reportingMonth: reportingMonthName,
      comparisonMonth: actualComparisonMonth,
      reportingMonthIndex
    };
  };

  /**
   * Calculate ALP metrics from monthly data for MGA/RGA (uses LVL_3_NET)
   */
  const calculateMgaAlpMetrics = (monthlyData, reportingMonthIndex) => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    // Group data by year and month using LVL_3_NET
    const grouped = {};
    monthlyData.forEach((item, index) => {
      if (!item.month) {
        return;
      }
      if (!item.LVL_3_NET) {
        return;
      }
      
      const parts = item.month.split("/");
      if (parts.length !== 2) {
        return;
      }
      
      const monthIndex = parseInt(parts[0], 10) - 1; // Convert to 0-indexed
      const year = parseInt(parts[1], 10);
      
      
      if (!grouped[year]) {
        grouped[year] = Array(12).fill(0);
      }
      const alpValue = parseFloat(item.LVL_3_NET) || 0;
      grouped[year][monthIndex] = alpValue;
    });

    const currentYearData = grouped[currentYear] || Array(12).fill(0);
    const previousYearData = grouped[previousYear] || Array(12).fill(0);


    const ytdAlp = currentYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);
    const currentMonthAlp = currentYearData[reportingMonthIndex] || 0;
    
    
    // Find the most recent month with actual ALP data
    const alpComparison = findMostRecentMonthWithData(currentYearData, reportingMonthIndex, "MGA ALP");
    const previousMonthAlp = alpComparison.value;
    const comparisonMonth = alpComparison.month;
    
    const previousYearYtdAlp = previousYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);

    // Get month names for display
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const reportingMonth = monthNames[reportingMonthIndex];

    return {
      ytdAlp,
      currentMonthAlp,
      previousMonthAlp,
      previousYearYtdAlp,
      reportingMonth,
      comparisonMonth
    };
  };

  /**
   * Calculate ALP metrics from monthly data for SA (uses LVL_2_NET)
   */
  const calculateSaAlpMetrics = (monthlyData, reportingMonthIndex) => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    // Group data by year and month using LVL_2_NET
    const grouped = {};
    monthlyData.forEach((item, index) => {
      if (!item.month || !item.LVL_2_NET) return;
      const parts = item.month.split("/");
      if (parts.length !== 2) return;
      
      const monthIndex = parseInt(parts[0], 10) - 1; // Convert to 0-indexed
      const year = parseInt(parts[1], 10);
      
      if (!grouped[year]) {
        grouped[year] = Array(12).fill(0);
      }
      grouped[year][monthIndex] = parseFloat(item.LVL_2_NET) || 0;
    });

    const currentYearData = grouped[currentYear] || Array(12).fill(0);
    const previousYearData = grouped[previousYear] || Array(12).fill(0);

    const ytdAlp = currentYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);
    const currentMonthAlp = currentYearData[reportingMonthIndex] || 0;
    
    // Find the most recent month with actual ALP data
    const alpComparison = findMostRecentMonthWithData(currentYearData, reportingMonthIndex, "SA ALP");
    const previousMonthAlp = alpComparison.value;
    const comparisonMonth = alpComparison.month;
    
    const previousYearYtdAlp = previousYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);

    // Get month names for display
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const reportingMonth = monthNames[reportingMonthIndex];

    return {
      ytdAlp,
      currentMonthAlp,
      previousMonthAlp,
      previousYearYtdAlp,
      reportingMonth,
      comparisonMonth
    };
  };

  /**
   * Calculate ALP metrics from monthly data for GA (uses LVL_3_NET with fallback to LVL_2_NET)
   */
  const calculateGaAlpMetrics = (monthlyData, reportingMonthIndex) => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    // Group data by year and month using LVL_3_NET with fallback to LVL_2_NET
    const grouped = {};
    monthlyData.forEach((item, index) => {
      if (!item.month) return;
      const parts = item.month.split("/");
      if (parts.length !== 2) return;
      
      const monthIndex = parseInt(parts[0], 10) - 1; // Convert to 0-indexed
      const year = parseInt(parts[1], 10);
      
      if (!grouped[year]) {
        grouped[year] = Array(12).fill(0);
      }
      
      // Use LVL_3_NET for GA dashboard, fallback to LVL_2_NET if LVL_3_NET is 0
      let alpValue = parseFloat(item.LVL_3_NET) || 0;
      if (alpValue === 0) {
        alpValue = parseFloat(item.LVL_2_NET) || 0;
      }
      
      grouped[year][monthIndex] = alpValue;
    });

    const currentYearData = grouped[currentYear] || Array(12).fill(0);
    const previousYearData = grouped[previousYear] || Array(12).fill(0);

    const ytdAlp = currentYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);
    const currentMonthAlp = currentYearData[reportingMonthIndex] || 0;
    
    // Find the most recent month with actual ALP data
    const alpComparison = findMostRecentMonthWithData(currentYearData, reportingMonthIndex, "GA ALP");
    const previousMonthAlp = alpComparison.value;
    const comparisonMonth = alpComparison.month;
    
    const previousYearYtdAlp = previousYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);

    // Get month names for display
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const reportingMonth = monthNames[reportingMonthIndex];

    return {
      ytdAlp,
      currentMonthAlp,
      previousMonthAlp,
      previousYearYtdAlp,
      reportingMonth,
      comparisonMonth
    };
  };

  /**
   * Calculate ALP metrics from monthly data for AGT (uses LVL_1_NET)
   */
  const calculateAgtAlpMetrics = (monthlyData, reportingMonthIndex) => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    // Group data by year and month using LVL_1_NET
    const grouped = {};
    monthlyData.forEach((item, index) => {
      if (!item.month || !item.LVL_1_NET) return;
      const parts = item.month.split("/");
      if (parts.length !== 2) return;
      
      const monthIndex = parseInt(parts[0], 10) - 1; // Convert to 0-indexed
      const year = parseInt(parts[1], 10);
      
      if (!grouped[year]) {
        grouped[year] = Array(12).fill(0);
      }
      grouped[year][monthIndex] = parseFloat(item.LVL_1_NET) || 0;
    });

    const currentYearData = grouped[currentYear] || Array(12).fill(0);
    const previousYearData = grouped[previousYear] || Array(12).fill(0);

    const ytdAlp = currentYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);
    const currentMonthAlp = currentYearData[reportingMonthIndex] || 0;
    
    // Find the most recent month with actual ALP data
    const alpComparison = findMostRecentMonthWithData(currentYearData, reportingMonthIndex, "AGT ALP");
    const previousMonthAlp = alpComparison.value;
    const comparisonMonth = alpComparison.month;
    
    const previousYearYtdAlp = previousYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);

    // Get month names for display
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const reportingMonth = monthNames[reportingMonthIndex];

    return {
      ytdAlp,
      currentMonthAlp,
      previousMonthAlp,
      previousYearYtdAlp,
      reportingMonth,
      comparisonMonth
    };
  };

/**
 * Main hook for dashboard data
 */
export const useDashboardData = (userRole, user, saViewMode = 'team', gaViewMode = 'team', mgaViewMode = 'team', rgaViewMode = 'team') => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState(getCurrentWeekRange());
  
  // Data states
  const [weeklyYtdData, setWeeklyYtdData] = useState([]);
  const [monthlyAlpData, setMonthlyAlpData] = useState([]);
  const [vipsData, setVipsData] = useState([]);
  const [associatesData, setAssociatesData] = useState([]);
  const [hiresData, setHiresData] = useState([]);
  const [dailyActivityData, setDailyActivityData] = useState({ totalRefAlp: 0, totalAlp: 0, totalRefs: 0, agentCount: 0 });
  const [dailyActivityLoading, setDailyActivityLoading] = useState(false);
  const [weeklyAlpData, setWeeklyAlpData] = useState({ weeklyAlp: 0, comparisonAlp: 0, weekStart: '', weekEnd: '' });
  const [weeklyAlpLoading, setWeeklyAlpLoading] = useState(false);
  const [weeklyHiresData, setWeeklyHiresData] = useState({ weeklyHires: 0 });
  const [weeklyHiresLoading, setWeeklyHiresLoading] = useState(false);
  const [weeklyCodesData, setWeeklyCodesData] = useState({ weeklyCodes: 0 });
  const [weeklyCodesLoading, setWeeklyCodesLoading] = useState(false);
  const [weeklyRefSalesData, setWeeklyRefSalesData] = useState({ weeklyRefSales: 0 });
  const [weeklyRefSalesLoading, setWeeklyRefSalesLoading] = useState(false);
  // Monthly data states (for "This Month" tab)
  const [monthlyAlpSumData, setMonthlyAlpSumData] = useState({ monthlyAlp: 0, comparisonAlp: 0 });
  const [monthlyAlpSumLoading, setMonthlyAlpSumLoading] = useState(false);
  const [monthlyHiresSumData, setMonthlyHiresSumData] = useState({ monthlyHires: 0 });
  const [monthlyHiresSumLoading, setMonthlyHiresSumLoading] = useState(false);
  const [monthlyCodesSumData, setMonthlyCodesSumData] = useState({ monthlyCodes: 0 });
  const [monthlyCodesSumLoading, setMonthlyCodesSumLoading] = useState(false);
  const [monthlyRefSalesSumData, setMonthlyRefSalesSumData] = useState({ monthlyRefSales: 0 });
  const [monthlyRefSalesSumLoading, setMonthlyRefSalesSumLoading] = useState(false);
  const [refSalesData, setRefSalesData] = useState({ totalRefSales: 0, previousMonthRefSales: 0 });
  const [currentMonthRefSalesData, setCurrentMonthRefSalesData] = useState({ totalRefSales: 0 });
  const [ytdRefSalesData, setYtdRefSalesData] = useState({ ytdRefSales: 0, previousYearYtdRefSales: 0 });
  const [currentMonthHiresData, setCurrentMonthHiresData] = useState({ monthlyHires: 0 });
  const [currentMonthHiresLoading, setCurrentMonthHiresLoading] = useState(false);
  const [currentMonthVipsData, setCurrentMonthVipsData] = useState({ monthlyVips: 0 });
  const [currentMonthVipsLoading, setCurrentMonthVipsLoading] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Computed metrics
  const [alpMetrics, setAlpMetrics] = useState({});
  const [codesAndHiresMetrics, setCodesAndHiresMetrics] = useState({});

  /**
   * Fetch main dashboard data (not dependent on date range)
   */
  const fetchDashboardData = useCallback(async () => {
    if (!userRole || !user?.lagnname) return;

    try {
      setLoading(true);
      const endpoints = getApiEndpoints(userRole);
      
      if (!endpoints) {
        throw new Error(`No API endpoints configured for role: ${userRole}`);
      }

      const lagnName = user.lagnname;
      
      
      // Handle different parameter structures for different roles
      let weeklyYtdResponse, monthlyAlpResponse, associatesResponse, vipsResponse, hiresResponse;
      
      if (userRole === 'SGA') {
        // SGA uses different endpoints and parameters
        const effectiveAgnName = lagnName || 'ARIAS SIMON A';
        const queryRole = (userRole === "RGA" || userRole === "SGA") ? "MGA" : userRole;
        
        [weeklyYtdResponse, monthlyAlpResponse, associatesResponse, vipsResponse, hiresResponse] = await Promise.all([
          api.get(`${endpoints.weeklyYtd}?value=${effectiveAgnName}`),
          api.get(`${endpoints.monthlyAlp}?value=${effectiveAgnName}`),
          api.get(`${endpoints.associates}?column=${queryRole}&value=${effectiveAgnName}`),
          api.get(`${endpoints.vips}?column=${queryRole}&value=${effectiveAgnName}`),
          api.get(`${endpoints.hires}?value=${effectiveAgnName}`)
        ]);
      } else {
        // MGA, RGA, SA, GA, AGT all use MGA endpoints with lagnName parameter
        // For SA and GA users, also pass userRole for proper filtering on associates and VIPs only
        
        // Build monthlyAlp and weeklyYtd URLs with viewMode for GA/MGA/RGA users
        let monthlyAlpUrl = `${endpoints.monthlyAlp}?lagnName=${lagnName}`;
        let weeklyYtdUrl = `${endpoints.weeklyYtd}?lagnName=${lagnName}`;
        
        if (userRole === 'GA') {
          monthlyAlpUrl += `&viewMode=${gaViewMode}`;
          weeklyYtdUrl += `&viewMode=${gaViewMode}`;
          console.log('📞 [Main Fetch] GA user with viewMode:', { userRole, gaViewMode, monthlyAlpUrl, weeklyYtdUrl });
        } else if (userRole === 'MGA') {
          monthlyAlpUrl += `&viewMode=${mgaViewMode}`;
          weeklyYtdUrl += `&viewMode=${mgaViewMode}`;
          console.log('📞 [Main Fetch] MGA user with viewMode:', { userRole, mgaViewMode, monthlyAlpUrl, weeklyYtdUrl });
        } else if (userRole === 'RGA') {
          monthlyAlpUrl += `&viewMode=${rgaViewMode}`;
          weeklyYtdUrl += `&viewMode=${rgaViewMode}`;
          console.log('📞 [Main Fetch] RGA user with viewMode:', { userRole, rgaViewMode, monthlyAlpUrl, weeklyYtdUrl });
        }
        
        // Build URLs for associates, vips, hires with viewMode for RGA users
        let associatesUrl = `${endpoints.associates}?lagnName=${lagnName}&userRole=${userRole}`;
        let vipsUrl = `${endpoints.vips}?lagnName=${lagnName}&userRole=${userRole}`;
        let hiresUrl = `${endpoints.hires}?lagnName=${lagnName}&userRole=${userRole}`;
        
        if (userRole === 'RGA') {
          associatesUrl += `&viewMode=${rgaViewMode}`;
          vipsUrl += `&viewMode=${rgaViewMode}`;
          hiresUrl += `&viewMode=${rgaViewMode}`;
        }
        
        [weeklyYtdResponse, monthlyAlpResponse, associatesResponse, vipsResponse, hiresResponse] = await Promise.all([
          api.get(weeklyYtdUrl, { headers: { 'user-role': userRole } }),
          api.get(monthlyAlpUrl, { headers: { 'user-role': userRole } }),
          api.get(associatesUrl),
          api.get(vipsUrl),
          api.get(hiresUrl)
        ]);
      }

      // Set raw data based on role-specific response structures
      if (userRole === 'SGA') {
        // SGA has different response structure and processing
        const processedSgaAlpData = processSgaAlpData(weeklyYtdResponse?.data?.data || []);
        setWeeklyYtdData(processedSgaAlpData);
        setMonthlyAlpData(monthlyAlpResponse?.data?.data || []);
        setAssociatesData(associatesResponse?.data?.data || []);
        setVipsData(vipsResponse?.data?.data || []);
        setHiresData(hiresResponse?.data?.data || []);
      } else {
        // MGA, RGA, SA, GA all use same response structure
        setWeeklyYtdData(weeklyYtdResponse?.data?.data || []);
        setMonthlyAlpData(monthlyAlpResponse?.data?.data || []);
        setAssociatesData(associatesResponse?.data?.data || []);
        setVipsData(vipsResponse?.data?.data || []);
        setHiresData(hiresResponse?.data?.data || []);
      }

      // Fetch ref sales for the reporting month (different API calls for different roles)
      const { reportingMonth, reportingYear } = getReportingMonth();
      let refSalesResponse, reportingMonthPreviousRefSalesResponse;
      
      // Calculate the month before the reporting month for "Last Month Performance" comparison
      const reportingPreviousMonth = reportingMonth === 1 ? 12 : reportingMonth - 1;
      const reportingPreviousYear = reportingMonth === 1 ? reportingYear - 1 : reportingYear;
      
      if (userRole === 'SGA') {
        // SGA doesn't use lagnName parameter
        refSalesResponse = await api.get(`${endpoints.refSales}?month=${reportingMonth}&year=${reportingYear}`);
        reportingMonthPreviousRefSalesResponse = await api.get(`${endpoints.refSales}?month=${reportingPreviousMonth}&year=${reportingPreviousYear}`);
      } else {
        // Other roles (MGA, RGA, SA, GA, AGT) use lagnName parameter
        refSalesResponse = await api.get(`${endpoints.refSales}?month=${reportingMonth}&year=${reportingYear}&lagnName=${lagnName}`);
        reportingMonthPreviousRefSalesResponse = await api.get(`${endpoints.refSales}?month=${reportingPreviousMonth}&year=${reportingPreviousYear}&lagnName=${lagnName}`);
      }
      
      setRefSalesData({
        totalRefSales: refSalesResponse?.data?.totalRefSales || 0,
        previousMonthRefSales: reportingMonthPreviousRefSalesResponse?.data?.totalRefSales || 0
      });

      // Fetch current month ref sales for "This Month" section
      const { currentMonth, currentYear } = getCurrentMonth();
      let currentMonthRefSalesResponse, previousMonthRefSalesResponse;
      
      // Calculate previous month
      const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const previousMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      
      if (userRole === 'SGA') {
        // SGA doesn't use lagnName parameter
        currentMonthRefSalesResponse = await api.get(`${endpoints.refSales}?month=${currentMonth}&year=${currentYear}`);
        previousMonthRefSalesResponse = await api.get(`${endpoints.refSales}?month=${previousMonth}&year=${previousMonthYear}`);
      } else {
        // Other roles (MGA, RGA, SA, GA, AGT) use lagnName parameter
        currentMonthRefSalesResponse = await api.get(`${endpoints.refSales}?month=${currentMonth}&year=${currentYear}&lagnName=${lagnName}`);
        previousMonthRefSalesResponse = await api.get(`${endpoints.refSales}?month=${previousMonth}&year=${previousMonthYear}&lagnName=${lagnName}`);
      }
      
      setCurrentMonthRefSalesData({
        totalRefSales: currentMonthRefSalesResponse?.data?.totalRefSales || 0,
        previousMonthRefSales: previousMonthRefSalesResponse?.data?.totalRefSales || 0
      });

      // Fetch YTD ref sales data (current year and previous year for comparison)
      const ytdCurrentYear = new Date().getFullYear();
      const ytdPreviousYear = ytdCurrentYear - 1;
      
      // Calculate YTD ref sales by fetching each month from January to current month
      let ytdRefSales = 0;
      let previousYearYtdRefSales = 0;
      
      for (let month = 1; month <= reportingMonth; month++) {
        try {
          let currentYearResponse, previousYearResponse;
          
          if (userRole === 'SGA') {
            // SGA doesn't use lagnName parameter
            currentYearResponse = await api.get(`${endpoints.refSales}?month=${month}&year=${ytdCurrentYear}`);
            previousYearResponse = await api.get(`${endpoints.refSales}?month=${month}&year=${ytdPreviousYear}`);
          } else {
            // Other roles use lagnName parameter
            currentYearResponse = await api.get(`${endpoints.refSales}?month=${month}&year=${ytdCurrentYear}&lagnName=${lagnName}`);
            previousYearResponse = await api.get(`${endpoints.refSales}?month=${month}&year=${ytdPreviousYear}&lagnName=${lagnName}`);
          }
          
          ytdRefSales += currentYearResponse?.data?.totalRefSales || 0;
          previousYearYtdRefSales += previousYearResponse?.data?.totalRefSales || 0;
        } catch (monthError) {
          console.warn(`Failed to fetch ref sales for month ${month}:`, monthError);
        }
      }
      
      setYtdRefSalesData({ ytdRefSales, previousYearYtdRefSales });


    } catch (err) {
      console.error(`Error fetching dashboard data for ${userRole}:`, err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [userRole, user?.lagnname, gaViewMode, mgaViewMode, rgaViewMode]); // Re-fetch when users switch view modes

  /**
   * Fetch daily activity data separately (dependent on date range)
   */
  const fetchDailyActivityData = useCallback(async () => {
    if (!userRole || !user?.lagnname) return;

    try {
      setDailyActivityLoading(true);
      const endpoints = getApiEndpoints(userRole);
      
      if (!endpoints) return;

      const lagnName = user.lagnname;
      
      
      let dailyActivityResponse;
      let url;
      
      if (userRole === 'SGA') {
        url = `${endpoints.dailyActivity}?startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}`;
        dailyActivityResponse = await api.get(url);
      } else if ((userRole === 'SA' && saViewMode === 'team' && endpoints.saTeamDailyActivity) || 
                 (userRole === 'GA' && gaViewMode === 'team' && endpoints.gaTeamDailyActivity) ||
                 (userRole === 'MGA' && mgaViewMode === 'team' && endpoints.mgaTeamDailyActivity) ||
                 (userRole === 'RGA' && (rgaViewMode === 'mga' || rgaViewMode === 'rga') && endpoints.rgaTeamDailyActivity)) {
        // For SA/GA/MGA/RGA users in team mode, use special endpoint that combines hierarchical data
        if (userRole === 'SA') {
          url = `${endpoints.saTeamDailyActivity}?lagnName=${lagnName}&startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}`;
          console.log('📞 [fetchDailyActivityData] Using SA team endpoint for', userRole, 'in', saViewMode, 'mode:', lagnName);
        } else if (userRole === 'GA') {
          url = `${endpoints.gaTeamDailyActivity}?lagnName=${lagnName}&startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}`;
          console.log('📞 [fetchDailyActivityData] Using GA team endpoint for', userRole, 'in', gaViewMode, 'mode:', lagnName);
        } else if (userRole === 'MGA') {
          url = `${endpoints.mgaTeamDailyActivity}?lagnName=${lagnName}&startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}`;
          console.log('📞 [fetchDailyActivityData] Using MGA team endpoint for', userRole, 'in', mgaViewMode, 'mode:', lagnName);
        } else if (userRole === 'RGA') {
          url = `${endpoints.rgaTeamDailyActivity}?lagnName=${lagnName}&startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}&viewMode=${rgaViewMode}`;
          console.log('📞 [fetchDailyActivityData] Using RGA team endpoint for', userRole, 'in', rgaViewMode, 'mode:', lagnName);
        }
        dailyActivityResponse = await api.get(url);
      } else {
        url = `${endpoints.dailyActivity}?lagnName=${lagnName}&startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}`;
        console.log('📞 [fetchDailyActivityData] Adding lagnName parameter for', userRole, ':', lagnName);
        dailyActivityResponse = await api.get(url);
      }
      
      console.log('📊 [fetchDailyActivityData] Daily activity data received for', userRole, ':', {
        userRole: userRole,
        userLagnName: user?.lagnname,
        endpoint: url,
        dateRange: `${selectedDateRange.startDate} to ${selectedDateRange.endDate}`,
        receivedData: dailyActivityResponse?.data,
        hasLagnNameFilter: userRole !== 'SGA',
        timestamp: new Date().toISOString()
      });
      
      setDailyActivityData(dailyActivityResponse?.data || { totalRefAlp: 0, totalAlp: 0, totalRefs: 0, agentCount: 0 });


    } catch (err) {
      console.error(`Error fetching daily activity data:`, err);
    } finally {
      setDailyActivityLoading(false);
    }
  }, [userRole, user?.lagnname, selectedDateRange, saViewMode, gaViewMode, mgaViewMode, rgaViewMode]);

  /**
   * Fetch weekly ALP data separately
   */
  const fetchWeeklyAlpData = useCallback(async () => {
    console.log('🚀 [fetchWeeklyAlpData] Starting fetch with:', { user: !!user, userRole, lagnname: user?.lagnname });
    
    if (!userRole || !user?.lagnname) {
      console.log('❌ [fetchWeeklyAlpData] Missing userRole or user.lagnname:', { userRole, lagnname: user?.lagnname });
      return;
    }

    try {
      setWeeklyAlpLoading(true);
      const endpoints = getApiEndpoints(userRole);
      
      console.log('📡 [fetchWeeklyAlpData] Endpoints for role:', { userRole, endpoints });
      
      if (!endpoints) {
        console.log('❌ [fetchWeeklyAlpData] No endpoints found for role:', userRole);
        return;
      }

      if (!endpoints.weeklyAlp) {
        console.log('❌ [fetchWeeklyAlpData] No weeklyAlp endpoint found:', { endpoints });
        setWeeklyAlpData({ weeklyAlp: 0, comparisonAlp: 0, weekStart: '', weekEnd: '' });
        return;
      }

      const lagnName = user.lagnname;
      
      let weeklyAlpResponse;
      let endpoint;
      
      if (userRole === 'SGA') {
        endpoint = endpoints.weeklyAlp;
        console.log('📞 [fetchWeeklyAlpData] Calling SGA endpoint:', endpoint);
        weeklyAlpResponse = await api.get(endpoint);
      } else {
        endpoint = `${endpoints.weeklyAlp}?lagnName=${lagnName}`;
        
        // For SA/GA/MGA/RGA users, add viewMode parameter to determine LVL_1_NET vs LVL_2_NET vs LVL_3_NET
        if (userRole === 'SA') {
          endpoint += `&viewMode=${saViewMode}`;
          console.log('📞 [fetchWeeklyAlpData] SA user with viewMode:', { userRole, saViewMode, endpoint });
        } else if (userRole === 'GA') {
          endpoint += `&viewMode=${gaViewMode}`;
          console.log('📞 [fetchWeeklyAlpData] GA user with viewMode:', { userRole, gaViewMode, endpoint });
        } else if (userRole === 'MGA') {
          endpoint += `&viewMode=${mgaViewMode}`;
          console.log('📞 [fetchWeeklyAlpData] MGA user with viewMode:', { userRole, mgaViewMode, endpoint });
        } else if (userRole === 'RGA') {
          endpoint += `&viewMode=${rgaViewMode}`;
          console.log('📞 [fetchWeeklyAlpData] RGA user with viewMode:', { userRole, rgaViewMode, endpoint });
        }
        
        console.log('📞 [fetchWeeklyAlpData] Calling user endpoint:', { endpoint, lagnName });
        weeklyAlpResponse = await api.get(endpoint, {
          headers: {
            'user-role': userRole
          }
        });
      }
      
      console.log('📥 [fetchWeeklyAlpData] Raw API response:', weeklyAlpResponse);
      
      const receivedData = weeklyAlpResponse?.data || { weeklyAlp: 0, comparisonAlp: 0, weekStart: '', weekEnd: '' };
      
      console.log(`📊 [Frontend] Weekly ALP data received for ${userRole}:`, {
        userRole,
        lagnName: user.lagnname,
        receivedData,
        endpoint
      });
      
      setWeeklyAlpData(receivedData);

    } catch (err) {
      console.error(`❌ [fetchWeeklyAlpData] Error fetching weekly ALP data:`, {
        error: err,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        userRole,
        user: user?.lagnname
      });
      setWeeklyAlpData({ weeklyAlp: 0, comparisonAlp: 0, weekStart: '', weekEnd: '' });
    } finally {
      setWeeklyAlpLoading(false);
    }
  }, [userRole, user?.lagnname, saViewMode, gaViewMode, mgaViewMode, rgaViewMode]);

  /**
   * Fetch weekly hires data for SGA dashboard
   */
  const fetchWeeklyHiresData = useCallback(async () => {
    console.log('🚀 [fetchWeeklyHiresData] Starting fetch for SGA');
    
    if (userRole !== 'SGA') {
      console.log('❌ [fetchWeeklyHiresData] Not SGA role:', userRole);
      return;
    }

    try {
      setWeeklyHiresLoading(true);
      const endpoints = getApiEndpoints(userRole);
      
      if (!endpoints?.weeklyHires) {
        console.log('❌ [fetchWeeklyHiresData] No weeklyHires endpoint found');
        setWeeklyHiresData({ weeklyHires: 0 });
        return;
      }

      console.log('📞 [fetchWeeklyHiresData] Calling endpoint:', endpoints.weeklyHires);
      const weeklyHiresResponse = await api.get(endpoints.weeklyHires);
      
      console.log('📥 [fetchWeeklyHiresData] Raw API response:', weeklyHiresResponse);
      
      const receivedData = weeklyHiresResponse?.data || { weeklyHires: 0 };
      
      console.log('📊 [Frontend] Weekly hires data received:', receivedData);
      
      setWeeklyHiresData(receivedData);

    } catch (err) {
      console.error('❌ [fetchWeeklyHiresData] Error:', {
        error: err,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setWeeklyHiresData({ weeklyHires: 0 });
    } finally {
      setWeeklyHiresLoading(false);
    }
  }, [userRole]);

  /**
   * Fetch weekly codes data for SGA dashboard
   */
  const fetchWeeklyCodesData = useCallback(async () => {
    console.log('🚀 [fetchWeeklyCodesData] Starting fetch for SGA');
    
    if (userRole !== 'SGA') {
      console.log('❌ [fetchWeeklyCodesData] Not SGA role:', userRole);
      return;
    }

    try {
      setWeeklyCodesLoading(true);
      const endpoints = getApiEndpoints(userRole);
      
      if (!endpoints?.weeklyCode) {
        console.log('❌ [fetchWeeklyCodesData] No weeklyCode endpoint found');
        setWeeklyCodesData({ weeklyCodes: 0 });
        return;
      }

      console.log('📞 [fetchWeeklyCodesData] Calling endpoint:', endpoints.weeklyCode);
      const weeklyCodesResponse = await api.get(endpoints.weeklyCode);
      
      console.log('📥 [fetchWeeklyCodesData] Raw API response:', weeklyCodesResponse);
      
      const receivedData = weeklyCodesResponse?.data || { weeklyCodes: 0 };
      
      console.log('📊 [Frontend] Weekly codes data received:', receivedData);
      
      setWeeklyCodesData(receivedData);

    } catch (err) {
      console.error('❌ [fetchWeeklyCodesData] Error:', {
        error: err,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setWeeklyCodesData({ weeklyCodes: 0 });
    } finally {
      setWeeklyCodesLoading(false);
    }
  }, [userRole]);

  /**
   * Fetch weekly ref sales data for SGA dashboard
   */
  const fetchWeeklyRefSalesData = useCallback(async () => {
    console.log('🚀 [fetchWeeklyRefSalesData] Starting fetch for role:', userRole);
    
    if (!['SGA', 'AGT', 'MGA', 'RGA', 'SA', 'GA'].includes(userRole)) {
      console.log('❌ [fetchWeeklyRefSalesData] Invalid role:', userRole);
      return;
    }

    try {
      setWeeklyRefSalesLoading(true);
      const endpoints = getApiEndpoints(userRole);
      
      if (!endpoints?.weeklyRefSales) {
        console.log('❌ [fetchWeeklyRefSalesData] No weeklyRefSales endpoint found');
        setWeeklyRefSalesData({ weeklyRefSales: 0 });
        return;
      }

      // Build URL with lagnName parameter for non-SGA users (same as monthly ref sales)
      let url = endpoints.weeklyRefSales;
      if (userRole !== 'SGA' && user?.lagnname) {
        url += `?lagnName=${encodeURIComponent(user.lagnname)}`;
        console.log('📞 [fetchWeeklyRefSalesData] Adding lagnName parameter for', userRole, ':', user.lagnname);
      }

      console.log('📞 [fetchWeeklyRefSalesData] Calling endpoint:', url);
      const weeklyRefSalesResponse = await api.get(url);
      
      console.log('📥 [fetchWeeklyRefSalesData] Raw API response:', weeklyRefSalesResponse);
      
      const receivedData = weeklyRefSalesResponse?.data || { weeklyRefSales: 0 };
      
      console.log('📊 [Frontend] Weekly ref sales data received:', receivedData);
      
      setWeeklyRefSalesData(receivedData);

    } catch (err) {
      console.error('❌ [fetchWeeklyRefSalesData] Error:', {
        error: err,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setWeeklyRefSalesData({ weeklyRefSales: 0 });
    } finally {
      setWeeklyRefSalesLoading(false);
    }
  }, [userRole, user?.lagnname]);

  /**
   * Fetch monthly ALP data for SGA dashboard
   */
  const fetchMonthlyAlpData = useCallback(async () => {
    console.log('🚀 [fetchMonthlyAlpData] Starting fetch for role:', userRole);
    
    if (!['SGA', 'AGT', 'MGA', 'RGA', 'SA', 'GA'].includes(userRole)) {
      console.log('❌ [fetchMonthlyAlpData] Invalid role:', userRole);
      return;
    }

    try {
      setMonthlyAlpSumLoading(true);
      const endpoints = getApiEndpoints(userRole);
      
      if (!endpoints?.monthlyAlpSum) {
        console.log('❌ [fetchMonthlyAlpData] No monthlyAlpSum endpoint found');
        setMonthlyAlpSumData({ monthlyAlp: 0, comparisonAlp: 0 });
        return;
      }

      // Build URL with lagnName parameter for non-SGA users (same as ref sales)
      let url = endpoints.monthlyAlpSum;
      if (userRole !== 'SGA' && user?.lagnname) {
        url += `?lagnName=${encodeURIComponent(user.lagnname)}`;
        
        // For SA/GA/MGA/RGA users, add viewMode parameter to determine LVL_1_NET vs LVL_2_NET vs LVL_3_NET
        if (userRole === 'SA') {
          url += `&viewMode=${saViewMode}`;
          console.log('📞 [fetchMonthlyAlpData] SA user with viewMode:', { userRole, saViewMode, url });
        } else if (userRole === 'GA') {
          url += `&viewMode=${gaViewMode}`;
          console.log('📞 [fetchMonthlyAlpData] GA user with viewMode:', { userRole, gaViewMode, url });
        } else if (userRole === 'MGA') {
          url += `&viewMode=${mgaViewMode}`;
          console.log('📞 [fetchMonthlyAlpData] MGA user with viewMode:', { userRole, mgaViewMode, url });
        } else if (userRole === 'RGA') {
          url += `&viewMode=${rgaViewMode}`;
          console.log('📞 [fetchMonthlyAlpData] RGA user with viewMode:', { userRole, rgaViewMode, url });
        }
        
        console.log('📞 [fetchMonthlyAlpData] Adding lagnName parameter for', userRole, ':', user.lagnname);
      }

      console.log('📞 [fetchMonthlyAlpData] Calling endpoint:', url);
      const monthlyAlpResponse = await api.get(url, {
        headers: {
          'user-role': userRole
        }
      });
      
      console.log('🔍 [fetchMonthlyAlpData] Full API Response:', {
        status: monthlyAlpResponse.status,
        statusText: monthlyAlpResponse.statusText,
        headers: monthlyAlpResponse.headers,
        data: monthlyAlpResponse.data
      });
      
      const receivedData = monthlyAlpResponse?.data || { monthlyAlp: 0, comparisonAlp: 0 };
      
      console.log('📊 [fetchMonthlyAlpData] Parsed data for', userRole, 'user:', {
        userRole: userRole,
        userLagnName: user?.lagnname,
        endpoint: url,
        rawResponse: monthlyAlpResponse.data,
        parsedData: receivedData,
        monthlyAlp: receivedData.monthlyAlp,
        comparisonAlp: receivedData.comparisonAlp,
        maxReportDate: receivedData.maxReportDate,
        monthStart: receivedData.monthStart,
        monthEnd: receivedData.monthEnd,
        hasLagnNameFilter: userRole !== 'SGA',
        timestamp: new Date().toISOString()
      });
      
      if (receivedData.monthlyAlp === 0) {
        console.warn('⚠️ [fetchMonthlyAlpData] Monthly ALP is 0 - check if data exists for:', {
          userRole,
          lagnName: user?.lagnname,
          endpoint: url,
          possibleIssues: [
            'No Weekly_ALP records with REPORT=MTD Recap for this LagnName',
            'No records for current month',
            'LagnName mismatch between user.lagnname and Weekly_ALP.LagnName'
          ]
        });
      }
      
      setMonthlyAlpSumData(receivedData);

    } catch (err) {
      console.error('❌ [fetchMonthlyAlpData] Error:', {
        error: err,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setMonthlyAlpSumData({ monthlyAlp: 0, comparisonAlp: 0 });
    } finally {
      setMonthlyAlpSumLoading(false);
    }
  }, [userRole, user?.lagnname, saViewMode, gaViewMode, mgaViewMode, rgaViewMode]);

  /**
   * Fetch monthly hires data for SGA dashboard
   */
  const fetchMonthlyHiresData = useCallback(async () => {
    console.log('🚀 [fetchMonthlyHiresData] Starting fetch for SGA');
    
    if (userRole !== 'SGA') {
      console.log('❌ [fetchMonthlyHiresData] Not SGA role:', userRole);
      return;
    }

    try {
      setMonthlyHiresSumLoading(true);
      const endpoints = getApiEndpoints(userRole);
      
      if (!endpoints?.monthlyHiresSum) {
        console.log('❌ [fetchMonthlyHiresData] No monthlyHiresSum endpoint found');
        setMonthlyHiresSumData({ monthlyHires: 0 });
        return;
      }

      console.log('📞 [fetchMonthlyHiresData] Calling endpoint:', endpoints.monthlyHiresSum);
      const monthlyHiresResponse = await api.get(endpoints.monthlyHiresSum);
      
      const receivedData = monthlyHiresResponse?.data || { monthlyHires: 0 };
      
      console.log('📊 [Frontend] Monthly hires data received:', receivedData);
      
      setMonthlyHiresSumData(receivedData);

    } catch (err) {
      console.error('❌ [fetchMonthlyHiresData] Error:', {
        error: err,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setMonthlyHiresSumData({ monthlyHires: 0 });
    } finally {
      setMonthlyHiresSumLoading(false);
    }
  }, [userRole]);

  /**
   * Fetch monthly codes data for SGA dashboard
   */
  const fetchMonthlyCodesData = useCallback(async () => {
    console.log('🚀 [fetchMonthlyCodesData] Starting fetch for SGA');
    
    if (userRole !== 'SGA') {
      console.log('❌ [fetchMonthlyCodesData] Not SGA role:', userRole);
      return;
    }

    try {
      setMonthlyCodesSumLoading(true);
      const endpoints = getApiEndpoints(userRole);
      
      if (!endpoints?.monthlyCodesSum) {
        console.log('❌ [fetchMonthlyCodesData] No monthlyCodesSum endpoint found');
        setMonthlyCodesSumData({ monthlyCodes: 0 });
        return;
      }

      console.log('📞 [fetchMonthlyCodesData] Calling endpoint:', endpoints.monthlyCodesSum);
      const monthlyCodesResponse = await api.get(endpoints.monthlyCodesSum);
      
      const receivedData = monthlyCodesResponse?.data || { monthlyCodes: 0 };
      
      console.log('📊 [Frontend] Monthly codes data received:', receivedData);
      
      setMonthlyCodesSumData(receivedData);

    } catch (err) {
      console.error('❌ [fetchMonthlyCodesData] Error:', {
        error: err,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setMonthlyCodesSumData({ monthlyCodes: 0 });
    } finally {
      setMonthlyCodesSumLoading(false);
    }
  }, [userRole]);

  /**
   * Fetch monthly ref sales data for SGA dashboard
   */
  const fetchMonthlyRefSalesData = useCallback(async () => {
    console.log('🚀 [fetchMonthlyRefSalesData] Starting fetch for role:', userRole);
    
    if (!['SGA', 'AGT', 'MGA', 'RGA', 'SA', 'GA'].includes(userRole)) {
      console.log('❌ [fetchMonthlyRefSalesData] Invalid role:', userRole);
      return;
    }

    try {
      setMonthlyRefSalesSumLoading(true);
      const endpoints = getApiEndpoints(userRole);
      
      if (!endpoints?.monthlyRefSalesSum) {
        console.log('❌ [fetchMonthlyRefSalesData] No monthlyRefSalesSum endpoint found');
        setMonthlyRefSalesSumData({ monthlyRefSales: 0 });
        return;
      }

      // Build URL with lagnName parameter for non-SGA users (same as monthly ref sales)
      let url = endpoints.monthlyRefSalesSum;
      if (userRole !== 'SGA' && user?.lagnname) {
        url += `?lagnName=${encodeURIComponent(user.lagnname)}`;
        console.log('📞 [fetchMonthlyRefSalesData] Adding lagnName parameter for', userRole, ':', user.lagnname);
      }

      console.log('📞 [fetchMonthlyRefSalesData] Calling endpoint:', url);
      const monthlyRefSalesResponse = await api.get(url);
      
      const receivedData = monthlyRefSalesResponse?.data || { monthlyRefSales: 0 };
      
      console.log('📊 [Frontend] Monthly ref sales data received:', receivedData);
      
      setMonthlyRefSalesSumData(receivedData);

    } catch (err) {
      console.error('❌ [fetchMonthlyRefSalesData] Error:', {
        error: err,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setMonthlyRefSalesSumData({ monthlyRefSales: 0 });
    } finally {
      setMonthlyRefSalesSumLoading(false);
    }
  }, [userRole, user?.lagnname]);

  /**
   * Fetch current month hires data for MGA/RGA dashboard (similar to OneOnOne.js logic)
   */
  const fetchCurrentMonthHiresData = useCallback(async () => {
    console.log('🚀 [fetchCurrentMonthHiresData] Starting fetch for role:', userRole);
    
    if (!['MGA', 'RGA'].includes(userRole)) {
      console.log('❌ [fetchCurrentMonthHiresData] Not MGA/RGA role:', userRole);
      return;
    }

    try {
      setCurrentMonthHiresLoading(true);
      
      if (!user?.lagnname) {
        console.log('❌ [fetchCurrentMonthHiresData] No lagnname available');
        setCurrentMonthHiresData({ monthlyHires: 0 });
        return;
      }

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Fetch hires data using the same endpoint as OneOnOne
      const enc = encodeURIComponent(user.lagnname);
      const hiresRes = await api.get(`/dataroutes/total-hires?value=${enc}`);
      const hiresArr = hiresRes?.data?.data || [];
      
      // Calculate current month hires (similar to OneOnOne.js logic)
      const monthlyHires = hiresArr.reduce((sum, row) => {
        const d = row?.MORE_Date ? new Date(row.MORE_Date) : null;
        if (d && d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
          const n = parseFloat(row?.Total_Hires) || 0;
          return sum + n;
        }
        return sum;
      }, 0);
      
      console.log('📊 [fetchCurrentMonthHiresData] Monthly hires:', monthlyHires);
      
      setCurrentMonthHiresData({ monthlyHires });

    } catch (err) {
      console.error('❌ [fetchCurrentMonthHiresData] Error:', {
        error: err,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setCurrentMonthHiresData({ monthlyHires: 0 });
    } finally {
      setCurrentMonthHiresLoading(false);
    }
  }, [userRole, user?.lagnname]);

  /**
   * Fetch current month VIPs data for MGA/RGA dashboard (similar to OneOnOne.js logic)
   */
  const fetchCurrentMonthVipsData = useCallback(async () => {
    console.log('🚀 [fetchCurrentMonthVipsData] Starting fetch for role:', userRole);
    
    if (!['MGA', 'RGA'].includes(userRole)) {
      console.log('❌ [fetchCurrentMonthVipsData] Not MGA/RGA role:', userRole);
      return;
    }

    try {
      setCurrentMonthVipsLoading(true);
      
      if (!user?.lagnname) {
        console.log('❌ [fetchCurrentMonthVipsData] No lagnname available');
        setCurrentMonthVipsData({ monthlyVips: 0 });
        return;
      }

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const ym = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`; // YYYY-MM
      
      // Try to get Potential VIPs data first (preferred method from OneOnOne.js)
      try {
        const potRes = await api.get('/admin/potential-vips', { params: { month: ym } });
        const potRows = potRes?.data?.data || [];
        
        const mgaNameLower = String(user.lagnname || '').toLowerCase();
        
        // Count VIPs where LVL_1_GROSS >= 5000 for this MGA
        let monthlyVips = 0;
        potRows.forEach(r => {
          const rowMgaName = String(r?.mga || '').toLowerCase();
          if (rowMgaName === mgaNameLower) {
            const gross = typeof r?.totalLvl1Gross === 'number' ? r.totalLvl1Gross : parseFloat(r?.totalLvl1Gross || 0);
            if (Number.isFinite(gross) && gross >= 5000) {
              monthlyVips++;
            }
          }
        });
        
        console.log('📊 [fetchCurrentMonthVipsData] Monthly VIPs (from potential-vips):', monthlyVips);
        setCurrentMonthVipsData({ monthlyVips });
        
      } catch (potErr) {
        // Fallback to regular VIPs table if potential-vips fails
        console.warn('⚠️ [fetchCurrentMonthVipsData] Potential VIPs failed, falling back to VIPs table:', potErr.message);
        
        const enc = encodeURIComponent(user.lagnname);
        const vipsRes = await api.get(`/dataroutes/vips/multiple?value=${enc}`);
        const vipsArr = vipsRes?.data?.data || [];
        
        // Calculate current month VIPs
        const monthlyVips = vipsArr.filter((row) => {
          const d = row?.vip_month ? new Date(row.vip_month) : null;
          return d && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        }).length;
        
        console.log('📊 [fetchCurrentMonthVipsData] Monthly VIPs (from VIPs table):', monthlyVips);
        setCurrentMonthVipsData({ monthlyVips });
      }

    } catch (err) {
      console.error('❌ [fetchCurrentMonthVipsData] Error:', {
        error: err,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setCurrentMonthVipsData({ monthlyVips: 0 });
    } finally {
      setCurrentMonthVipsLoading(false);
    }
  }, [userRole, user?.lagnname]);

  /**
   * Process leaderboard data to match the Leaderboard component format
   */
  const processLeaderboardData = (data) => {
    
 
  
    
    const processed = data
      .map((row, index) => {
        let alpValue;
        
        // Determine which ALP level to use based on user role
        if (userRole === 'SA') {
          alpValue = row.LVL_2_NET || 0;
        } else if (userRole === 'GA') {
          alpValue = row.LVL_3_NET || 0;
        } else if (userRole === 'MGA') {
          alpValue = row.LVL_3_NET || 0;
        } else if (userRole === 'RGA') {
          alpValue = row.LVL_3_NET || 0;
        } else {
          // SGA and AGT use LVL_1_NET
          alpValue = row.LVL_1_NET || 0;
        }

        const processedItem = {
          rank: index + 1,
          name: row.LagnName,
          value: alpValue,
          profile_picture: row.profpic,
          clname: row.clname,
          mga: row.MGA_NAME,
          mgaLastName: getMgalastName(row.MGA_NAME, row.LagnName),
          esid: row.esid,
          start: row.start,
          reportdate: row.reportdate
        };
        
     
        return processedItem;
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .map((item, index) => ({ ...item, rank: index + 1 }));
      
    return processed;
  };

  /**
   * Extract last name from MGA field (format: "LAST FIRST MIDDLE SUFFIX")
   */
  const getMgalastName = (mgaName, agentName) => {
    if (mgaName && typeof mgaName === 'string' && mgaName.trim()) {
      const parts = mgaName.trim().split(/\s+/);
      return parts[0] || ''; // Return first part (LAST name)
    }
    
    // If MGA is blank, use agent's last name (first part of LagnName)
    if (agentName && typeof agentName === 'string') {
      const parts = agentName.trim().split(/\s+/);
      return parts[0] || ''; // Return first part (LAST name)
    }
    
    return '';
  };

  /**
   * Fetch leaderboard data
   */
  const fetchLeaderboardData = useCallback(async () => {
    if (!userRole || !user?.lagnname) return;

    try {
      setLeaderboardLoading(true);
      const endpoints = getApiEndpoints(userRole);
      
      if (!endpoints) return;

      // Get report dates for leaderboard
      const reportDatesResponse = await api.get('/alp/getReportDates', {
        params: { reportType: 'Weekly Recap' }
      });
      
      let startDate, endDate;
      
      if (!reportDatesResponse.data.success || !reportDatesResponse.data.defaultDate) {
        // Fallback to current week approach
        const weekRange = getCurrentWeekRange();
        startDate = weekRange.startDate;
        endDate = weekRange.endDate;
      } else {
        // Use report date approach
        const selectedDate = reportDatesResponse.data.defaultDate;
        const reportDate = new Date(selectedDate);
        const start = new Date(reportDate);
        start.setDate(reportDate.getDate() - 3);
        const end = new Date(reportDate);
        end.setDate(reportDate.getDate() + 3);
        
        startDate = start.toISOString().split('T')[0];
        endDate = end.toISOString().split('T')[0];
      }

      // Format to MM/DD/YYYY like the original dashboard
      const formatToMMDDYYYY = (dateObj) => {
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const yyyy = dateObj.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
      };

      const startDateFormatted = formatToMMDDYYYY(new Date(startDate));
      const endDateFormatted = formatToMMDDYYYY(new Date(endDate));


      const response = await api.get(`/alp/${endpoints.leaderboard}`, {
        params: { 
          startDate: startDateFormatted, 
          endDate: endDateFormatted,
          report: 'Weekly Recap'
        }
      });

      if (response.data.success) {
        const processedData = processLeaderboardData(response.data.data || []);
        setLeaderboardData(processedData);
      }

    } catch (err) {
      console.error('Error fetching leaderboard data:', err);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [userRole, user?.lagnname]);

  /**
   * Calculate computed metrics when raw data changes
   */
  useEffect(() => {
    if (userRole === 'SGA') {
      // SGA uses different processing logic
      if (weeklyYtdData && Object.keys(weeklyYtdData).length > 0) {
        const metrics = calculateSgaDashboardMetrics(weeklyYtdData);
        setAlpMetrics({
          ytdAlp: metrics.ytdAlp,
          currentMonthAlp: metrics.currentMonthAlp,
          previousMonthAlp: metrics.previousMonthAlp,
          previousYearYtdAlp: metrics.previousYearYtdAlp,
          reportingMonth: metrics.reportingMonth,
          comparisonMonth: metrics.comparisonMonth
        });
      }
    } else if (userRole === 'AGT') {
      // AGT uses LVL_1_NET processing
      if (monthlyAlpData.length > 0) {
        const { reportingMonth: reportingMonthIndex } = getReportingMonth();
        const metrics = calculateAgtAlpMetrics(monthlyAlpData, reportingMonthIndex - 1); // Convert to 0-based
        setAlpMetrics(metrics);
      }
    } else if (userRole === 'SA') {
      // SA uses LVL_2_NET processing
      if (monthlyAlpData.length > 0) {
        const { reportingMonth: reportingMonthIndex } = getReportingMonth();
        const metrics = calculateSaAlpMetrics(monthlyAlpData, reportingMonthIndex - 1); // Convert to 0-based
        setAlpMetrics(metrics);
      }
    } else if (userRole === 'GA') {
      // GA uses LVL_3_NET with fallback to LVL_2_NET
      if (monthlyAlpData.length > 0) {
        const { reportingMonth: reportingMonthIndex } = getReportingMonth();
        const metrics = calculateGaAlpMetrics(monthlyAlpData, reportingMonthIndex - 1); // Convert to 0-based
        setAlpMetrics(metrics);
      }
    } else if (userRole === 'MGA' || userRole === 'RGA') {
      // MGA and RGA use LVL_3_NET processing
      if (monthlyAlpData.length > 0) {
        const { reportingMonth: reportingMonthIndex } = getReportingMonth();
        const metrics = calculateMgaAlpMetrics(monthlyAlpData, reportingMonthIndex - 1); // Convert to 0-based
        setAlpMetrics(metrics);
      }
    }
  }, [monthlyAlpData, weeklyYtdData, userRole]);

  useEffect(() => {
    if (vipsData.length > 0 || associatesData.length > 0 || hiresData.length > 0) {
      let reportingMonthIndex;
      
      if (userRole === 'SGA') {
        // SGA uses its own reporting month calculation
        if (weeklyYtdData && Object.keys(weeklyYtdData).length > 0) {
          const sgaMetrics = calculateSgaDashboardMetrics(weeklyYtdData);
          reportingMonthIndex = sgaMetrics.reportingMonthIndex;
        } else {
          const { reportingMonth: monthIndex } = getReportingMonth();
          reportingMonthIndex = monthIndex - 1; // Convert to 0-based
        }
      } else {
        // Other roles use standard reporting month
        const { reportingMonth: monthIndex } = getReportingMonth();
        reportingMonthIndex = monthIndex - 1; // Convert to 0-based
      }
      
      const metrics = calculateCodesAndHiresMetrics(vipsData, associatesData, hiresData, reportingMonthIndex);
      setCodesAndHiresMetrics(metrics);
    }
  }, [vipsData, associatesData, hiresData, userRole, weeklyYtdData]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchDailyActivityData(); // Fetch daily activity data separately
  }, [fetchDailyActivityData]);

  useEffect(() => {
    fetchWeeklyAlpData(); // Fetch weekly ALP data separately
  }, [fetchWeeklyAlpData]);

  useEffect(() => {
    fetchWeeklyHiresData(); // Fetch weekly hires data for SGA
  }, [fetchWeeklyHiresData]);

  useEffect(() => {
    fetchWeeklyCodesData(); // Fetch weekly codes data for SGA
  }, [fetchWeeklyCodesData]);

  useEffect(() => {
    fetchWeeklyRefSalesData(); // Fetch weekly ref sales data for SGA
  }, [fetchWeeklyRefSalesData]);

  useEffect(() => {
    fetchMonthlyAlpData(); // Fetch monthly ALP data for SGA
  }, [fetchMonthlyAlpData]);

  useEffect(() => {
    fetchMonthlyHiresData(); // Fetch monthly hires data for SGA
  }, [fetchMonthlyHiresData]);

  useEffect(() => {
    fetchMonthlyCodesData(); // Fetch monthly codes data for SGA
  }, [fetchMonthlyCodesData]);

  useEffect(() => {
    fetchMonthlyRefSalesData(); // Fetch monthly ref sales data for SGA
  }, [fetchMonthlyRefSalesData]);

  useEffect(() => {
    fetchCurrentMonthHiresData(); // Fetch current month hires data for MGA/RGA
  }, [fetchCurrentMonthHiresData]);

  useEffect(() => {
    fetchCurrentMonthVipsData(); // Fetch current month VIPs data for MGA/RGA
  }, [fetchCurrentMonthVipsData]);

  useEffect(() => {
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  // Format currency helper
  const formatCurrency = (value) => {
    if (!value) return '$0';
    return `$${parseFloat(value).toLocaleString('en-US')}`;
  };

  // Format date range helper
  const formatDateRange = (startDate, endDate) => {
    
    // Parse dates as UTC to avoid timezone issues
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T00:00:00.000Z');
    
    
    const formatDate = (date) => {
      // Use UTC methods to format to avoid timezone shifts
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        timeZone: 'UTC'
      });
    };
    
    const formattedStart = formatDate(start);
    const formattedEnd = formatDate(end);
    const result = `${formattedStart} - ${formattedEnd}`;
    
    
    return result;
  };

  return {
    // Loading states
    loading,
    error,
    dailyActivityLoading,
    weeklyAlpLoading,
    weeklyHiresLoading,
    weeklyCodesLoading,
    weeklyRefSalesLoading,
    monthlyAlpSumLoading,
    monthlyHiresSumLoading,
    monthlyCodesSumLoading,
    monthlyRefSalesSumLoading,
    currentMonthHiresLoading,
    currentMonthVipsLoading,
    leaderboardLoading,
    
    // Date range
    selectedDateRange,
    setSelectedDateRange,
    
    // Raw data
    weeklyYtdData,
    // Monthly data (old config, keep for compatibility)
    monthlyAlpData,
    vipsData,
    associatesData,
    hiresData,
    dailyActivityData,
    weeklyAlpData,
    weeklyHiresData,
    weeklyCodesData,
    weeklyRefSalesData,
    // Monthly data - new endpoints for "This Month" tab
    monthlyAlpSumData: monthlyAlpSumData,
    monthlyHiresSumData: monthlyHiresSumData,
    monthlyCodesSumData: monthlyCodesSumData,
    monthlyRefSalesSumData: monthlyRefSalesSumData,
    currentMonthHiresData,
    currentMonthVipsData,
    refSalesData,
    currentMonthRefSalesData,
    ytdRefSalesData,
    leaderboardData,
    
    // Computed metrics
    alpMetrics,
    codesAndHiresMetrics,
    
    // Utilities
    formatCurrency,
    formatDateRange,
    
    // Refetch functions
    refetchData: fetchDashboardData,
    refetchDailyActivity: fetchDailyActivityData,
    refetchWeeklyAlp: fetchWeeklyAlpData,
    refetchWeeklyHires: fetchWeeklyHiresData,
    refetchWeeklyCodes: fetchWeeklyCodesData,
    refetchWeeklyRefSales: fetchWeeklyRefSalesData,
    refetchMonthlyAlp: fetchMonthlyAlpData,
    refetchMonthlyHires: fetchMonthlyHiresData,
    refetchMonthlyCodes: fetchMonthlyCodesData,
    refetchMonthlyRefSales: fetchMonthlyRefSalesData,
    refetchLeaderboard: fetchLeaderboardData
  };
};

// Export helper functions for use in components
export { getCurrentWeekRange, getCurrentMonthRange, getPreviousMonthRange, getYearToDateRange };