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
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days to go back to Monday
  
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  const startDate = monday.toISOString().split('T')[0];
  const endDate = sunday.toISOString().split('T')[0];
  
  return { startDate, endDate };
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
  
  console.log(`🔍 [${dataType}] Searching for most recent month with data. Max index: ${maxIndex}`);
  console.log(`🔍 [${dataType}] Monthly data:`, monthlyData);
  
  // Start from maxIndex - 1 to exclude the current month
  for (let i = maxIndex - 1; i >= 0; i--) {
    console.log(`🔍 [${dataType}] Checking month ${i} (${monthNames[i]}): ${monthlyData[i]}`);
    if (monthlyData[i] > 0) {
      console.log(`🔍 [${dataType}] Found data at month ${i} (${monthNames[i]}): ${monthlyData[i]}`);
      return {
        value: monthlyData[i],
        month: monthNames[i]
      };
    }
  }
  
  console.log(`🔍 [${dataType}] No data found, returning 0`);
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
    console.log(`🔍 [MGA ALP Processing] Raw monthly data:`, monthlyData);
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    // Group data by year and month using LVL_3_NET
    const grouped = {};
    monthlyData.forEach((item, index) => {
      console.log(`🔍 [MGA ALP Processing] Item ${index}:`, item);
      if (!item.month) {
        console.log(`⚠️ [MGA ALP Processing] No month field for item ${index}`);
        return;
      }
      if (!item.LVL_3_NET) {
        console.log(`⚠️ [MGA ALP Processing] No LVL_3_NET field for item ${index}, LVL_3_NET: ${item.LVL_3_NET}`);
        return;
      }
      
      const parts = item.month.split("/");
      if (parts.length !== 2) {
        console.log(`⚠️ [MGA ALP Processing] Invalid month format for item ${index}: ${item.month}`);
        return;
      }
      
      const monthIndex = parseInt(parts[0], 10) - 1; // Convert to 0-indexed
      const year = parseInt(parts[1], 10);
      
      console.log(`🔍 [MGA ALP Processing] Parsed - Month: ${monthIndex + 1}, Year: ${year}, LVL_3_NET: ${item.LVL_3_NET}`);
      
      if (!grouped[year]) {
        grouped[year] = Array(12).fill(0);
      }
      const alpValue = parseFloat(item.LVL_3_NET) || 0;
      grouped[year][monthIndex] = alpValue;
      console.log(`🔍 [MGA ALP Processing] Set month ${monthIndex + 1} to: ${alpValue}`);
    });

    console.log(`🔍 [MGA ALP Processing] Final grouped data:`, grouped);
    const currentYearData = grouped[currentYear] || Array(12).fill(0);
    const previousYearData = grouped[previousYear] || Array(12).fill(0);

    console.log(`🔍 [MGA ALP Processing] Current year data:`, currentYearData);
    console.log(`🔍 [MGA ALP Processing] Previous year data:`, previousYearData);
    console.log(`🔍 [MGA ALP Processing] Reporting month index: ${reportingMonthIndex}`);
    console.log(`🔍 [MGA ALP Processing] May 2025 data (index 4): ${currentYearData[4]}`);

    const ytdAlp = currentYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);
    const currentMonthAlp = currentYearData[reportingMonthIndex] || 0;
    
    console.log(`🔍 [MGA ALP Processing] YTD ALP: ${ytdAlp}, Current Month ALP: ${currentMonthAlp}`);
    
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
export const useDashboardData = (userRole, user) => {
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
  const [refSalesData, setRefSalesData] = useState({ totalRefSales: 0 });
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Computed metrics
  const [alpMetrics, setAlpMetrics] = useState({});
  const [codesAndHiresMetrics, setCodesAndHiresMetrics] = useState({});

  /**
   * Fetch data for the current user role
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
      
      console.log(`🔍 [Dashboard] Fetching data for ${userRole} - ${lagnName}`);
      
      // Handle different parameter structures for different roles
      let weeklyYtdResponse, monthlyAlpResponse, associatesResponse, vipsResponse, hiresResponse, dailyActivityResponse;
      
      if (userRole === 'SGA') {
        // SGA uses different endpoints and parameters
        const effectiveAgnName = lagnName || 'ARIAS SIMON A';
        const queryRole = (userRole === "RGA" || userRole === "SGA") ? "MGA" : userRole;
        
        [weeklyYtdResponse, monthlyAlpResponse, associatesResponse, vipsResponse, hiresResponse, dailyActivityResponse] = await Promise.all([
          api.get(`${endpoints.weeklyYtd}?value=${effectiveAgnName}`),
          api.get(`${endpoints.monthlyAlp}?value=${effectiveAgnName}`),
          api.get(`${endpoints.associates}?column=${queryRole}&value=${effectiveAgnName}`),
          api.get(`${endpoints.vips}?column=${queryRole}&value=${effectiveAgnName}`),
          api.get(`${endpoints.hires}?value=${effectiveAgnName}`),
          api.get(`${endpoints.dailyActivity}?startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}`)
        ]);
      } else {
        // MGA, RGA, SA, GA, AGT all use MGA endpoints with lagnName parameter
        [weeklyYtdResponse, monthlyAlpResponse, associatesResponse, vipsResponse, hiresResponse, dailyActivityResponse] = await Promise.all([
          api.get(`${endpoints.weeklyYtd}?lagnName=${lagnName}`),
          api.get(`${endpoints.monthlyAlp}?lagnName=${lagnName}`),
          api.get(`${endpoints.associates}?lagnName=${lagnName}`),
          api.get(`${endpoints.vips}?lagnName=${lagnName}`),
          api.get(`${endpoints.hires}?lagnName=${lagnName}`),
          api.get(`${endpoints.dailyActivity}?lagnName=${lagnName}&startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}`)
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
        setDailyActivityData(dailyActivityResponse?.data || { totalRefAlp: 0, totalAlp: 0, totalRefs: 0, agentCount: 0 });
      } else {
        // MGA, RGA, SA, GA all use same response structure
        setWeeklyYtdData(weeklyYtdResponse?.data?.data || []);
        setMonthlyAlpData(monthlyAlpResponse?.data?.data || []);
        setAssociatesData(associatesResponse?.data?.data || []);
        setVipsData(vipsResponse?.data?.data || []);
        setHiresData(hiresResponse?.data?.data || []);
        setDailyActivityData(dailyActivityResponse?.data || { totalRefAlp: 0, totalAlp: 0, totalRefs: 0, agentCount: 0 });
      }

      // Fetch ref sales for the reporting month (different API calls for different roles)
      const { reportingMonth, reportingYear } = getReportingMonth();
      let refSalesResponse;
      
      if (userRole === 'SGA') {
        // SGA doesn't use lagnName parameter
        refSalesResponse = await api.get(`${endpoints.refSales}?month=${reportingMonth}&year=${reportingYear}`);
      } else {
        // Other roles (MGA, RGA, SA, GA, AGT) use lagnName parameter
        refSalesResponse = await api.get(`${endpoints.refSales}?month=${reportingMonth}&year=${reportingYear}&lagnName=${lagnName}`);
      }
      
      setRefSalesData(refSalesResponse?.data || { totalRefSales: 0 });

      console.log(`🔍 [Dashboard] Data fetched successfully for ${userRole}`);

    } catch (err) {
      console.error(`Error fetching dashboard data for ${userRole}:`, err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [userRole, user?.lagnname, selectedDateRange]);

  /**
   * Process leaderboard data to match the Leaderboard component format
   */
  const processLeaderboardData = (data) => {
    console.log(`🔍 [Leaderboard] Processing ${data?.length || 0} raw records for role: ${userRole}`);
    
    if (!data || data.length === 0) {
      console.log(`🔍 [Leaderboard] No data to process`);
      return [];
    }
    
    // Log a sample record to understand the data structure
    if (data.length > 0) {
      console.log(`🔍 [Leaderboard] Sample record:`, data[0]);
    }
    
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
        
        // Log first few processed items for debugging
        if (index < 3) {
          console.log(`🔍 [Leaderboard] Processed item ${index}:`, processedItem);
        }
        
        return processedItem;
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .map((item, index) => ({ ...item, rank: index + 1 }));
      
    console.log(`🔍 [Leaderboard] Final processed data count: ${processed.length}`);
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

      console.log(`🔍 [Leaderboard] Fetching for ${userRole} from ${startDateFormatted} to ${endDateFormatted}`);

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
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  // Format currency helper
  const formatCurrency = (value) => {
    if (!value) return '$0';
    return `$${parseFloat(value).toLocaleString('en-US')}`;
  };

  // Format date range helper
  const formatDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    };
    
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  return {
    // Loading states
    loading,
    error,
    leaderboardLoading,
    
    // Date range
    selectedDateRange,
    setSelectedDateRange,
    
    // Raw data
    weeklyYtdData,
    monthlyAlpData,
    vipsData,
    associatesData,
    hiresData,
    dailyActivityData,
    refSalesData,
    leaderboardData,
    
    // Computed metrics
    alpMetrics,
    codesAndHiresMetrics,
    
    // Utilities
    formatCurrency,
    formatDateRange,
    
    // Refetch functions
    refetchData: fetchDashboardData,
    refetchLeaderboard: fetchLeaderboardData
  };
};