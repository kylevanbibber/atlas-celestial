import React, { useState, useEffect } from "react";
import Card from "../components/utils/Card";
import Leaderboard from "../components/utils/Leaderboard";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import { FiActivity, FiDollarSign, FiUsers, FiTrendingUp } from 'react-icons/fi';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  
  // SGA-specific dashboard state
  const [sgaAlpData, setSgaAlpData] = useState([]);
  const [dailyActivityData, setDailyActivityData] = useState([]);
  const [vipsData, setVipsData] = useState([]);
  const [associatesData, setAssociatesData] = useState([]);
  const [hiresData, setHiresData] = useState([]);
  const [refSalesData, setRefSalesData] = useState({ totalRefSales: 0 });
  
  // MGA-specific dashboard state
  const [mgaWeeklyYtdData, setMgaWeeklyYtdData] = useState([]);
  const [mgaMonthlyAlpData, setMgaMonthlyAlpData] = useState([]);
  const [mgaVipsData, setMgaVipsData] = useState([]);
  const [mgaAssociatesData, setMgaAssociatesData] = useState([]);
  const [mgaHiresData, setMgaHiresData] = useState([]);
  const [mgaDailyActivityData, setMgaDailyActivityData] = useState([]);

  // SA-specific dashboard state  
  const [saWeeklyYtdData, setSaWeeklyYtdData] = useState([]);
  const [saMonthlyAlpData, setSaMonthlyAlpData] = useState([]);
  const [saVipsData, setSaVipsData] = useState([]);
  const [saAssociatesData, setSaAssociatesData] = useState([]);
  const [saHiresData, setSaHiresData] = useState([]);
  const [saDailyActivityData, setSaDailyActivityData] = useState([]);

  // GA-specific dashboard state
  const [gaWeeklyYtdData, setGaWeeklyYtdData] = useState([]);
  const [gaMonthlyAlpData, setGaMonthlyAlpData] = useState([]);
  const [gaVipsData, setGaVipsData] = useState([]);
  const [gaAssociatesData, setGaAssociatesData] = useState([]);
  const [gaHiresData, setGaHiresData] = useState([]);
  const [gaDailyActivityData, setGaDailyActivityData] = useState([]);
  
  // Leaderboard state
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardTitle, setLeaderboardTitle] = useState('Top Producers');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Calculate Monday-Sunday date range for current week
  const getCurrentWeekRange = () => {
    const today = new Date();
    console.log(`🔍 [Date Debug] Today's date:`, today.toISOString());
    
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days to go back to Monday
    
    console.log(`🔍 [Date Debug] Day of week: ${dayOfWeek}, Days to Monday: ${daysToMonday}`);
    
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    console.log(`🔍 [Date Debug] Calculated Monday:`, monday.toISOString());
    console.log(`🔍 [Date Debug] Calculated Sunday:`, sunday.toISOString());
    
    const startDate = monday.toISOString().split('T')[0];
    const endDate = sunday.toISOString().split('T')[0];
    
    console.log(`🔍 [Date Debug] Final range: ${startDate} to ${endDate}`);
    
    return {
      startDate,
      endDate
    };
  };

  const [selectedDateRange, setSelectedDateRange] = useState(getCurrentWeekRange());

  // Helper function to calculate week range from a report date
  const getWeekRangeFromDate = (reportDate) => {
    const date = new Date(reportDate);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate Monday of that week
    const monday = new Date(date);
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days to Monday
    monday.setDate(date.getDate() - daysToMonday);
    
    // Calculate Sunday of that week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    // Format dates as "MMM DD"
    const formatDate = (dateObj) => {
      return dateObj.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    };
    
    return `${formatDate(monday)} - ${formatDate(sunday)}`;
  };

  // Get current user's clname for role-based rendering
  const userRole = user?.clname;

  // Fetch data on component mount and when dependencies change
  useEffect(() => {
    console.log(`🔍 [Dashboard] useEffect triggered - userRole: ${userRole}, lagnname: ${user?.lagnname}`);
    
    if (userRole === 'SGA' && user?.lagnname) {
      console.log(`🔍 [Dashboard] Fetching SGA dashboard data`);
      fetchSgaDashboardData();
    } else if ((userRole === 'MGA' || userRole === 'RGA') && user?.lagnname) {
      console.log(`🔍 [Dashboard] Fetching MGA dashboard data`);
      fetchMgaDashboardData();
    } else if (userRole === 'SA' && user?.lagnname) {
      console.log(`🔍 [Dashboard] Fetching SA dashboard data`);
      fetchSaDashboardData();
    } else if (userRole === 'GA' && user?.lagnname) {
      console.log(`🔍 [Dashboard] Fetching GA dashboard data`);
      fetchGaDashboardData();
    }
    
    // Fetch leaderboard data for all users
    if (user?.lagnname) {
      console.log(`🔍 [Dashboard] Fetching leaderboard data for role: ${userRole}`);
      fetchLeaderboardData();
    } else {
      console.log(`🔍 [Dashboard] Not fetching leaderboard - no lagnname`);
    }
  }, [userRole, user?.lagnname, selectedDateRange]);

  const fetchSgaDashboardData = async () => {
    try {
      setLoading(true);
      
      // Use the same logic as ScorecardTable for SGA data fetching
      const effectiveAgnName = user?.lagnname || 'ARIAS SIMON A';
      const queryRole = (userRole === "RGA" || userRole === "SGA") ? "MGA" : userRole;
      
      // Fetch SGA ALP data using the proven endpoint from scorecard
      const sgaAlpResponse = await api.get(`/dataroutes/sga-alp?value=${effectiveAgnName}`);
      const sgaAlpData = sgaAlpResponse?.data?.data || [];
      
      // Process SGA ALP data like in scorecard
      const processedSgaAlpData = processSgaAlpData(sgaAlpData);
      setSgaAlpData(processedSgaAlpData);

      // Fetch Daily Activity data for the selected date range
      const dailyActivityResponse = await api.get(`/alp/daily/sum?startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}`);
      setDailyActivityData(dailyActivityResponse.data);

      // Fetch VIPs and Associates data for codes
      const vipsResponse = await api.get(`/dataroutes/vips-sga?column=${queryRole}&value=${effectiveAgnName}`);
      const associatesResponse = await api.get(`/dataroutes/associates-sga?column=${queryRole}&value=${effectiveAgnName}`);
      
      // Fetch hires data
      const hiresResponse = await api.get(`/dataroutes/org-total-hires?value=${effectiveAgnName}`);
      
      // Fetch ref sales data for the reporting month (same as ALP calculation)
      const currentDate = new Date();
      const currentDay = currentDate.getDate();
      
      // Use same 5th-of-month logic as ALP calculation
      let reportingDate;
      if (currentDay < 5) {
        // Before 5th, use two months prior
        reportingDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1);
      } else {
        // On or after 5th, use previous month
        reportingDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      }
      
      const reportingMonth = reportingDate.getMonth() + 1; // getMonth() returns 0-11
      const reportingYear = reportingDate.getFullYear();
      
      const refSalesResponse = await api.get(`/alp/ref-sales?month=${reportingMonth}&year=${reportingYear}`);
      
      // Store additional data for processing
      setVipsData(vipsResponse?.data?.data || []);
      setAssociatesData(associatesResponse?.data?.data || []);
      setHiresData(hiresResponse?.data?.data || []);
      setRefSalesData(refSalesResponse?.data || { totalRefSales: 0 });

    } catch (err) {
      console.error('Error fetching SGA dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch SA Dashboard Data (uses MGA routes but processes LVL_2_NET)
  const fetchSaDashboardData = async () => {
    try {
      setLoading(true);
      const lagnName = user?.lagnname;
      
      console.log(`🔍 [SA Dashboard Fetch] Starting fetch for lagnName: ${lagnName}`);
      
      // Fetch all SA data using MGA routes (same data sources)
      const [weeklyYtdResponse, monthlyAlpResponse, associatesResponse, vipsResponse, hiresResponse, dailyActivityResponse] = await Promise.all([
        api.get(`/alp/mga/weekly-ytd?lagnName=${lagnName}`),
        api.get(`/alp/mga/monthly-alp?lagnName=${lagnName}`),
        api.get(`/alp/mga/associates?lagnName=${lagnName}`),
        api.get(`/alp/mga/vips?lagnName=${lagnName}`),
        api.get(`/alp/mga/hires?lagnName=${lagnName}`),
        api.get(`/alp/mga/daily-activity?lagnName=${lagnName}&startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}`)
      ]);

      console.log(`🔍 [SA Dashboard Fetch] Weekly YTD response:`, weeklyYtdResponse?.data);
      console.log(`🔍 [SA Dashboard Fetch] Monthly ALP response:`, monthlyAlpResponse?.data);
      console.log(`🔍 [SA Dashboard Fetch] Associates response count:`, associatesResponse?.data?.data?.length);
      console.log(`🔍 [SA Dashboard Fetch] VIPs response count:`, vipsResponse?.data?.data?.length);
      console.log(`🔍 [SA Dashboard Fetch] Hires response count:`, hiresResponse?.data?.data?.length);

      setSaWeeklyYtdData(weeklyYtdResponse?.data?.data || []);
      setSaMonthlyAlpData(monthlyAlpResponse?.data?.data || []);
      setSaAssociatesData(associatesResponse?.data?.data || []);
      setSaVipsData(vipsResponse?.data?.data || []);
      setSaHiresData(hiresResponse?.data?.data || []);
      setSaDailyActivityData(dailyActivityResponse?.data || { totalRefAlp: 0, totalAlp: 0, totalRefs: 0, agentCount: 0 });

      // Fetch ref sales for SA (uses lagnname, SA, and GA from refvalidation)
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
      
      // For SA, ref sales include lagnname, SA, and GA from refvalidation
      const refSalesResponse = await api.get(`/alp/ref-sales?month=${reportingMonth}&year=${reportingYear}&lagnName=${lagnName}`);
      setRefSalesData(refSalesResponse?.data || { totalRefSales: 0 });

    } catch (err) {
      console.error('Error fetching SA dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch GA Dashboard Data (uses MGA routes with LVL_3_NET and fallback logic)
  const fetchGaDashboardData = async () => {
    try {
      setLoading(true);
      const lagnName = user?.lagnname;
      
      console.log(`🔍 [GA Dashboard Fetch] Starting fetch for lagnName: ${lagnName}`);
      
      // Fetch all GA data using MGA routes (same data sources)
      const [weeklyYtdResponse, monthlyAlpResponse, associatesResponse, vipsResponse, hiresResponse, dailyActivityResponse] = await Promise.all([
        api.get(`/alp/mga/weekly-ytd?lagnName=${lagnName}`),
        api.get(`/alp/mga/monthly-alp?lagnName=${lagnName}`),
        api.get(`/alp/mga/associates?lagnName=${lagnName}`),
        api.get(`/alp/mga/vips?lagnName=${lagnName}`),
        api.get(`/alp/mga/hires?lagnName=${lagnName}`),
        api.get(`/alp/mga/daily-activity?lagnName=${lagnName}&startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}`)
      ]);

      console.log(`🔍 [GA Dashboard Fetch] Weekly YTD response:`, weeklyYtdResponse?.data);
      console.log(`🔍 [GA Dashboard Fetch] Monthly ALP response:`, monthlyAlpResponse?.data);
      console.log(`🔍 [GA Dashboard Fetch] Associates response count:`, associatesResponse?.data?.data?.length);
      console.log(`🔍 [GA Dashboard Fetch] VIPs response count:`, vipsResponse?.data?.data?.length);
      console.log(`🔍 [GA Dashboard Fetch] Hires response count:`, hiresResponse?.data?.data?.length);

      setGaWeeklyYtdData(weeklyYtdResponse?.data?.data || []);
      setGaMonthlyAlpData(monthlyAlpResponse?.data?.data || []);
      setGaAssociatesData(associatesResponse?.data?.data || []);
      setGaVipsData(vipsResponse?.data?.data || []);
      setGaHiresData(hiresResponse?.data?.data || []);
      setGaDailyActivityData(dailyActivityResponse?.data || { totalRefAlp: 0, totalAlp: 0, totalRefs: 0, agentCount: 0 });

      // Fetch ref sales for GA (uses lagnname, SA, and GA from refvalidation)
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
      
      // For GA, ref sales include lagnname, SA, and GA from refvalidation
      const refSalesResponse = await api.get(`/alp/ref-sales?month=${reportingMonth}&year=${reportingYear}&lagnName=${lagnName}`);
      setRefSalesData(refSalesResponse?.data || { totalRefSales: 0 });

    } catch (err) {
      console.error('Error fetching GA dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Process SGA ALP data (copied from ScorecardTable)
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

  // Calculate current month, YTD, and previous year data for dashboard cards
  // Implements 5th-of-the-month logic: wait until the 5th before showing previous month's data
  const calculateDashboardMetrics = (sgaData) => {
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
        comparisonMonth: new Date().toLocaleString('default', { month: 'long' })
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
    // Business Logic: Wait until 5th of current month before updating to show previous month's complete data
    // Example: In August, before 5th = show June data, on/after 5th = show July data
    let reportingMonthIndex;
    let usesPreviousYear = false;
    
    if (currentDay < 5) {
      // Before 5th: use 2 months ago (allows time for previous month's data to be processed)
      reportingMonthIndex = currentCalendarMonth - 2;
      if (reportingMonthIndex < 0) {
        reportingMonthIndex = 12 + reportingMonthIndex; // Handle year boundary (Jan-Feb goes to Nov-Dec of prev year)
        usesPreviousYear = true;
      }
    } else {
      // On/after 5th: use last month (previous month's data is now complete)
      reportingMonthIndex = currentCalendarMonth - 1;
      if (reportingMonthIndex < 0) {
        reportingMonthIndex = 11; // December of previous year
        usesPreviousYear = true;
      }
    }
    
    // Get the month before the reporting month for comparison
    let comparisonMonthIndex = reportingMonthIndex - 1;
    if (comparisonMonthIndex < 0) {
      comparisonMonthIndex = 11; // December of previous year
    }
    
    // Handle year boundary cases for data access
    const reportingYear = usesPreviousYear ? previousYear : currentYear;
    const reportingYearData = usesPreviousYear ? previousYearData : currentYearData;
    
    // Get month names for display (declare these early to avoid initialization errors)
    const reportingMonthName = new Date(reportingYear, reportingMonthIndex, 1).toLocaleString('default', { month: 'long' });
    const comparisonMonthName = new Date(reportingYear, comparisonMonthIndex, 1).toLocaleString('default', { month: 'long' });
    
    // Current month ALP (based on reporting month)
    const currentMonthAlp = reportingYearData[reportingMonthIndex] || 0;
    
    // YTD ALP (sum of months Jan through reporting month)
    // If using previous year data, calculate full YTD; otherwise use current year through reporting month
    const ytdAlp = usesPreviousYear 
      ? previousYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + (val || 0), 0)
      : currentYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + (val || 0), 0);
    
    // Previous month ALP (month before reporting month) - use smart lookup
    let previousMonthAlp = 0;
    let actualComparisonMonth = comparisonMonthName;
    if (comparisonMonthIndex >= 0) {
      // First try the standard comparison month
      previousMonthAlp = reportingYearData[comparisonMonthIndex] || 0;
      
      // If no data found, use smart lookup to find most recent month with data
      if (previousMonthAlp === 0) {
        const alpComparison = findMostRecentMonthWithData(reportingYearData, reportingMonthIndex, "SGA ALP");
        previousMonthAlp = alpComparison.value;
        actualComparisonMonth = alpComparison.month;
        console.log(`🔍 [SGA ALP] No data in standard comparison month, using ${actualComparisonMonth} instead`);
      }
    }
    
    // Same period last year (YTD through reporting month)
    // Always compare to previous year's data through the same reporting month
    const comparisonYear = usesPreviousYear ? previousYear - 1 : previousYear;
    const comparisonYearData = sgaData[comparisonYear] || Array(12).fill(0);
    const previousYearYtdAlp = comparisonYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + (val || 0), 0);
    
    // Growth calculations
    const monthOverMonthGrowth = currentMonthAlp - previousMonthAlp;
    const yearOverYearGrowth = ytdAlp - previousYearYtdAlp;
    const yearOverYearGrowthPercent = previousYearYtdAlp > 0 ? ((ytdAlp - previousYearYtdAlp) / previousYearYtdAlp) * 100 : 0;
    
    return {
      currentMonthAlp,
      previousMonthAlp,
      ytdAlp,
      previousYearYtdAlp,
      monthOverMonthGrowth,
      yearOverYearGrowth,
      yearOverYearGrowthPercent,
      reportingMonth: reportingMonthName,
      comparisonMonth: actualComparisonMonth,
      reportingMonthIndex,
      isBeforeFifth: currentDay < 5
    };
  };

  // Calculate codes and hires metrics
  const calculateCodesAndHiresMetrics = (vipsData, associatesData, hiresData, reportingMonthIndex) => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    console.log(`[CODES] Calculating codes for reportingMonthIndex: ${reportingMonthIndex}, currentYear: ${currentYear}`);
    console.log(`[CODES] VIPs data count: ${vipsData.length}, Associates data count: ${associatesData.length}`);
    
    // Process VIPs data (uses vip_month field: YYYY-MM-DD HH:MM:SS)
    const processVipsData = (data) => {
      const grouped = {};
      console.log(`[CODES] Processing VIPs data:`, data.slice(0, 3)); // Log first 3 items
      
      data.forEach((item, index) => {
        if (!item.vip_month) {
          if (index < 3) console.log(`[CODES] VIPs item ${index} missing vip_month:`, item);
          return;
        }
        
        // Parse YYYY-MM-DD HH:MM:SS format
        const date = new Date(item.vip_month);
        if (isNaN(date.getTime())) {
          if (index < 3) console.log(`[CODES] VIPs item ${index} invalid vip_month format:`, item.vip_month);
          return;
        }
        
        const monthIndex = date.getMonth(); // 0-based month
        const year = date.getFullYear();
        
        if (!grouped[year]) {
          grouped[year] = Array(12).fill(0);
        }
        grouped[year][monthIndex] = (grouped[year][monthIndex] || 0) + 1;
        
        if (index < 3) console.log(`[CODES] VIPs item ${index}: vip_month=${item.vip_month}, monthIndex=${monthIndex}, year=${year}`);
      });
      
      console.log(`[CODES] VIPs grouped by year:`, grouped);
      return grouped;
    };

    // Process Associates data (uses PRODDATE field: YYYY-MM-DD)
    const processAssociatesData = (data) => {
      const grouped = {};
      console.log(`[CODES] Processing Associates data:`, data.slice(0, 3)); // Log first 3 items
      
      data.forEach((item, index) => {
        if (!item.PRODDATE) {
          if (index < 3) console.log(`[CODES] Associates item ${index} missing PRODDATE:`, item);
          return;
        }
        
        // Parse YYYY-MM-DD format
        const date = new Date(item.PRODDATE + 'T00:00:00'); // Add time to ensure proper parsing
        if (isNaN(date.getTime())) {
          if (index < 3) console.log(`[CODES] Associates item ${index} invalid PRODDATE format:`, item.PRODDATE);
          return;
        }
        
        const monthIndex = date.getMonth(); // 0-based month
        const year = date.getFullYear();
        
        if (!grouped[year]) {
          grouped[year] = Array(12).fill(0);
        }
        grouped[year][monthIndex] = (grouped[year][monthIndex] || 0) + 1;
        
        if (index < 3) console.log(`[CODES] Associates item ${index}: PRODDATE=${item.PRODDATE}, monthIndex=${monthIndex}, year=${year}`);
      });
      
      console.log(`[CODES] Associates grouped by year:`, grouped);
      return grouped;
    };

    // Process VIPs data
    const vipsDataProcessed = processVipsData(vipsData);
    // Process Associates data  
    const associatesDataProcessed = processAssociatesData(associatesData);

    // Process hires data
    const processHiresData = (data) => {
      const grouped = {};
      data.forEach((item) => {
        if (!item.MORE_Date) return;
        const date = new Date(item.MORE_Date);
        const monthIndex = date.getMonth();
        const year = date.getFullYear();
        
        if (!grouped[year]) {
          grouped[year] = Array(12).fill(0);
        }
        grouped[year][monthIndex] += parseFloat(item.Total_Hires) || 0;
      });
      return grouped;
    };

    // Combine VIPs and Associates data
    const currentYearVips = vipsDataProcessed[currentYear] || Array(12).fill(0);
    const previousYearVips = vipsDataProcessed[previousYear] || Array(12).fill(0);
    const currentYearAssociates = associatesDataProcessed[currentYear] || Array(12).fill(0);
    const previousYearAssociates = associatesDataProcessed[previousYear] || Array(12).fill(0);
    
    const hiresDataProcessed = processHiresData(hiresData);
    const currentYearHires = hiresDataProcessed[currentYear] || Array(12).fill(0);
    const previousYearHires = hiresDataProcessed[previousYear] || Array(12).fill(0);

    // Calculate combined codes (VIPs + Associates)
    const currentYearCodes = currentYearVips.map((vips, index) => vips + currentYearAssociates[index]);
    const previousYearCodes = previousYearVips.map((vips, index) => vips + previousYearAssociates[index]);

    console.log(`[CODES] Current year VIPs by month:`, currentYearVips);
    console.log(`[CODES] Current year Associates by month:`, currentYearAssociates);
    console.log(`[CODES] Current year combined codes by month:`, currentYearCodes);
    console.log(`[CODES] Previous year combined codes by month:`, previousYearCodes);

    const ytdCodes = currentYearCodes.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);
    const currentMonthCodes = currentYearCodes[reportingMonthIndex] || 0;
    const currentMonthHires = currentYearHires[reportingMonthIndex] || 0;
    
    // Use smart month lookup for codes and hires comparison
    const codesComparison = findMostRecentMonthWithData(currentYearCodes, reportingMonthIndex, "SGA Codes");
    const previousMonthCodes = codesComparison.value;
    const codesComparisonMonth = codesComparison.month;
    
    const hiresComparison = findMostRecentMonthWithData(currentYearHires, reportingMonthIndex, "SGA Hires");
    const previousMonthHires = hiresComparison.value;
    const hiresComparisonMonth = hiresComparison.month;
    
    const previousYearYtdCodes = previousYearCodes.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);

    console.log(`[CODES] Final calculations:`);
    console.log(`[CODES] - YTD codes (months 0-${reportingMonthIndex}): ${ytdCodes}`);
    console.log(`[CODES] - Current month codes (month ${reportingMonthIndex}): ${currentMonthCodes}`);
    console.log(`[CODES] - Previous month codes: ${previousMonthCodes} (from ${codesComparisonMonth})`);
    console.log(`[CODES] - Current month hires: ${currentMonthHires}`);
    console.log(`[CODES] - Previous month hires: ${previousMonthHires} (from ${hiresComparisonMonth})`);
    console.log(`[CODES] - Previous year YTD codes: ${previousYearYtdCodes}`);

    return {
      // YTD metrics
      ytdCodes,
      ytdHires: currentYearHires.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0),
      previousYearYtdCodes,
      previousYearYtdHires: previousYearHires.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0),
      
      // Current month metrics
      currentMonthCodes,
      currentMonthHires,
      
      // Previous month metrics with smart lookup
      previousMonthCodes,
      previousMonthHires,
      codesComparisonMonth,
      hiresComparisonMonth
    };
  };

  // Format currency helper
  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date range as "m/d/yy-m/d/yy"
  const formatDateRange = (startDate, endDate) => {
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear().toString().slice(-2);
      return `${month}/${day}/${year}`;
    };
    
    return `${formatDate(startDate)}-${formatDate(endDate)}`;
  };

  // SGA Dashboard Component
  const SgaDashboard = () => {
    if (loading) {
      return (
        <div className="dashboard-container padded-content-sm">
          <div className="loading-spinner"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="dashboard-container padded-content-sm">
          <div className="error-message">{error}</div>
        </div>
      );
    }

    // Daily Activity metrics
    const totalAlp = dailyActivityData?.totalAlp || 0;
    const totalRefAlp = dailyActivityData?.totalRefAlp || 0;
    const totalRefs = dailyActivityData?.totalRefs || 0;
    const totalRefSales = refSalesData?.totalRefSales || 0;
    
    // Calculate SGA metrics using processed data
    const sgaMetrics = calculateDashboardMetrics(sgaAlpData);
    
    // Calculate codes and hires metrics
    const codesAndHiresMetrics = calculateCodesAndHiresMetrics(vipsData, associatesData, hiresData, sgaMetrics.reportingMonthIndex);

    return (
      <div className="dashboard-container padded-content-sm">
        
        <div className="dashboard-layout">
          <div className="dashboard-main-content">
            <div className="dashboard-cards-wrapper">
              {/* YTD Section */}
              <div className="dashboard-section">
            <h3 className="section-title">YTD Performance</h3>
            <hr className="section-divider" />
            <div className="card-container">
              <Card
                title="YTD SGA ALP"
                value={formatCurrency(sgaMetrics.ytdAlp)}
                backgroundIcon={FiDollarSign}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(76, 175, 80, 0.1)"
                showComparison={true}
                currentValue={sgaMetrics.ytdAlp}
                previousValue={sgaMetrics.previousYearYtdAlp}
                rangeType="year"
                showIcon={true}
                showPercentage={true}
                comparisonFormat="currency"
                comparisonLabel={`vs same period last year`}
                className="dashboard-card"
              />
              <Card
                title="YTD Codes + VIPs"
                value={codesAndHiresMetrics.ytdCodes.toString()}
                backgroundIcon={FiActivity}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(63, 81, 181, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.ytdCodes}
                previousValue={codesAndHiresMetrics.previousYearYtdCodes}
                rangeType="year"
                showIcon={true}
                showPercentage={true}
                comparisonFormat="number"
                comparisonLabel={`vs same period last year`}
                className="dashboard-card"
              />
              <Card
                title="YTD Hires"
                value={codesAndHiresMetrics.ytdHires.toString()}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 152, 0, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.ytdHires}
                previousValue={codesAndHiresMetrics.previousYearYtdHires}
                rangeType="year"
                showIcon={true}
                showPercentage={true}
                comparisonFormat="number"
                comparisonLabel={`vs same period last year`}
                className="dashboard-card"
              />
            </div>
          </div>

          {/* Last Month Section */}
          <div className="dashboard-section">
            <h3 className="section-title">Last Month Performance</h3>
            <hr className="section-divider" />
            <div className="card-container">
              <Card
                title={`${sgaMetrics.reportingMonth} ALP`}
                value={formatCurrency(sgaMetrics.currentMonthAlp)}
                backgroundIcon={FiDollarSign}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(76, 175, 80, 0.1)"
                showComparison={true}
                currentValue={sgaMetrics.currentMonthAlp}
                previousValue={sgaMetrics.previousMonthAlp}
                rangeType="month"
                showIcon={true}
                comparisonFormat="currency"
                comparisonLabel={`from ${sgaMetrics.comparisonMonth}`}
                className="dashboard-card"
              />
              <Card
                title={`${sgaMetrics.reportingMonth} Codes + VIPs`}
                value={codesAndHiresMetrics.currentMonthCodes.toString()}
                backgroundIcon={FiActivity}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(63, 81, 181, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.currentMonthCodes}
                previousValue={codesAndHiresMetrics.previousMonthCodes}
                rangeType="month"
                showIcon={true}
                comparisonFormat="number"
                comparisonLabel={`from ${codesAndHiresMetrics.codesComparisonMonth}`}
                className="dashboard-card"
              />
              <Card
                title={`${sgaMetrics.reportingMonth} Hires`}
                value={codesAndHiresMetrics.currentMonthHires.toString()}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 152, 0, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.currentMonthHires}
                previousValue={codesAndHiresMetrics.previousMonthHires}
                rangeType="month"
                showIcon={true}
                comparisonFormat="number"
                comparisonLabel={`from ${codesAndHiresMetrics.hiresComparisonMonth}`}
                className="dashboard-card"
              />
              <Card
                title={`${sgaMetrics.reportingMonth} Ref Sales`}
                value={totalRefSales.toString()}
                backgroundIcon={FiDollarSign}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(156, 39, 176, 0.1)"
                subText="From refvalidation table"
                className="dashboard-card"
              />
            </div>
          </div>

          {/* Reported Activity Section */}
          <div className="dashboard-section">
            <div className="section-header-with-controls">
              <h3 className="section-title">Reported Activity</h3>
              <div className="date-range-selector">
                <label>
                  From: 
                  <input 
                    type="date" 
                    value={selectedDateRange.startDate}
                    onChange={(e) => setSelectedDateRange(prev => ({
                      ...prev,
                      startDate: e.target.value
                    }))}
                  />
                </label>
                <label>
                  To: 
                  <input 
                    type="date" 
                    value={selectedDateRange.endDate}
                    onChange={(e) => setSelectedDateRange(prev => ({
                      ...prev,
                      endDate: e.target.value
                    }))}
                  />
                </label>
              </div>
            </div>
            <hr className="section-divider" />
            <div className="card-container">
              <Card
                title="Daily Activity - ALP"
                value={formatCurrency(totalAlp)}
                backgroundIcon={FiActivity}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 152, 0, 0.1)"
                subText={`${formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate)} | ${dailyActivityData?.agentCount || 0} agents`}
                className="dashboard-card"
              />
              <Card
                title="Daily Activity - Ref ALP"
                value={formatCurrency(totalRefAlp)}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(156, 39, 176, 0.1)"
                subText={`${formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate)} | ${dailyActivityData?.agentCount || 0} agents`}
                className="dashboard-card"
              />
              <Card
                title="Daily Activity - Refs"
                value={totalRefs.toString()}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(156, 39, 176, 0.1)"
                subText={`${formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate)} | ${dailyActivityData?.agentCount || 0} agents`}
                className="dashboard-card"
              />
            </div>
          </div>
            </div>
          </div>
          
          {/* Leaderboard Sidebar */}
          <div className="dashboard-sidebar">
            <div className="leaderboard-section">             
              <Leaderboard
                data={leaderboardData}
                title={userRole === 'SA' ? 'Top SAs' : userRole === 'GA' ? 'Top GAs' : userRole === 'MGA' ? 'Top MGAs' : userRole === 'RGA' ? 'Top RGAs' : 'Top Producers'}
                nameField="name"
                valueField="value"
                formatValue={formatLeaderboardValue}
                loading={leaderboardLoading}
                variant="compact"
                showProfilePicture={true}
                profilePictureField="profile_picture"
                showLevelBadge={true}
                showMGA={true}
                hierarchyLevel={userRole?.toLowerCase() || 'all'}
                className="dashboard-leaderboard"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // MGA Dashboard Data Fetching and Processing Functions
  const fetchMgaDashboardData = async () => {
    try {
      setLoading(true);
      const lagnName = user?.lagnname;
      
      console.log(`🔍 [MGA Dashboard Fetch] Starting fetch for lagnName: ${lagnName}`);
      
      console.log(`🔍 [MGA Dashboard Fetch] Fetching all monthly data for comparison calculations`);
      
      // Fetch all MGA data (get all monthly data for comparison calculations)
      const [weeklyYtdResponse, monthlyAlpResponse, associatesResponse, vipsResponse, hiresResponse, dailyActivityResponse] = await Promise.all([
        api.get(`/alp/mga/weekly-ytd?lagnName=${lagnName}`),
        api.get(`/alp/mga/monthly-alp?lagnName=${lagnName}`),
        api.get(`/alp/mga/associates?lagnName=${lagnName}`),
        api.get(`/alp/mga/vips?lagnName=${lagnName}`),
        api.get(`/alp/mga/hires?lagnName=${lagnName}`),
        api.get(`/alp/mga/daily-activity?lagnName=${lagnName}&startDate=${selectedDateRange.startDate}&endDate=${selectedDateRange.endDate}`)
      ]);

      console.log(`🔍 [MGA Dashboard Fetch] Weekly YTD response:`, weeklyYtdResponse?.data);
      console.log(`🔍 [MGA Dashboard Fetch] Monthly ALP response:`, monthlyAlpResponse?.data);
      console.log(`🔍 [MGA Dashboard Fetch] Associates response count:`, associatesResponse?.data?.data?.length);
      console.log(`🔍 [MGA Dashboard Fetch] VIPs response count:`, vipsResponse?.data?.data?.length);
      console.log(`🔍 [MGA Dashboard Fetch] Hires response count:`, hiresResponse?.data?.data?.length);

      setMgaWeeklyYtdData(weeklyYtdResponse?.data?.data || []);
      setMgaMonthlyAlpData(monthlyAlpResponse?.data?.data || []);
      setMgaAssociatesData(associatesResponse?.data?.data || []);
      setMgaVipsData(vipsResponse?.data?.data || []);
      setMgaHiresData(hiresResponse?.data?.data || []);
      setMgaDailyActivityData(dailyActivityResponse?.data || { totalRefAlp: 0, totalAlp: 0, totalRefs: 0, agentCount: 0 });

      // Fetch ref sales for the same reporting month as other metrics
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
      
      const refSalesResponse = await api.get(`/alp/ref-sales?month=${reportingMonth}&year=${reportingYear}&lagnName=${lagnName}`);
      setRefSalesData(refSalesResponse?.data || { totalRefSales: 0 });

    } catch (err) {
      console.error('Error fetching MGA dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch leaderboard data based on user role
  const fetchLeaderboardData = async () => {
    try {
      setLeaderboardLoading(true);
      
      // Determine which leaderboard to show based on user role
      let endpoint = 'getweeklyall'; // Default to all producers
      let title = 'Top Producers';
      
      if (userRole === 'SA') {
        endpoint = 'getweeklysa';
        title = 'Top SAs';
      } else if (userRole === 'GA') {
        endpoint = 'getweeklyga';
        title = 'Top GAs';
      } else if (userRole === 'MGA') {
        endpoint = 'getweeklymga';
        title = 'Top MGAs';
      } else if (userRole === 'RGA') {
        endpoint = 'getweeklyrga';
        title = 'Top RGAs';
      }
      // SGA and AGT will use 'all' (Top Producers)
      
      console.log(`🔍 [Leaderboard] Fetching ${title} data for user role: ${userRole}`);
      
      // First, get available report dates like LeaderboardPage does
      const reportDatesResponse = await api.get('/alp/getReportDates', {
        params: { reportType: 'Weekly Recap' }
      });
      
      if (!reportDatesResponse.data.success || !reportDatesResponse.data.defaultDate) {
        console.warn(`🔍 [Leaderboard] Could not get report dates, falling back to current week`);
        // Fallback to current approach if report dates fail
        let { startDate, endDate } = getCurrentWeekRange();
        
        // If the calculated dates are in the future, use a safe date range (last week)
        const today = new Date();
        const calculatedStart = new Date(startDate);
        
        if (calculatedStart > today) {
          console.log(`🔍 [Leaderboard] Calculated dates are in future, using last week instead`);
          const lastWeekEnd = new Date(today);
          lastWeekEnd.setDate(today.getDate() - 1);
          const lastWeekStart = new Date(lastWeekEnd);
          lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
          
          startDate = lastWeekStart.toISOString().split('T')[0];
          endDate = lastWeekEnd.toISOString().split('T')[0];
        }
        
        console.log(`🔍 [Leaderboard] Using fallback date range: ${startDate} to ${endDate}`);
      } else {
        // Use the approach from LeaderboardPage - get default date and calculate range around it
        const selectedDate = reportDatesResponse.data.defaultDate;
        console.log(`🔍 [Leaderboard] Using default report date: ${selectedDate}`);
        
        // Calculate date range around the selected date (same as LeaderboardPage)
        const reportDate = new Date(selectedDate);
        const startDate = new Date(reportDate);
        startDate.setDate(reportDate.getDate() - 3);
        const endDate = new Date(reportDate);
        endDate.setDate(reportDate.getDate() + 3);
        
        // Format to MM/DD/YYYY like LeaderboardPage
        const formatToMMDDYYYY = (dateObj) => {
          const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
          const dd = String(dateObj.getDate()).padStart(2, '0');
          const yyyy = dateObj.getFullYear();
          return `${mm}/${dd}/${yyyy}`;
        };
        
        const startDateFormatted = formatToMMDDYYYY(startDate);
        const endDateFormatted = formatToMMDDYYYY(endDate);
        
        console.log(`🔍 [Leaderboard] Calculated date range: ${startDateFormatted} to ${endDateFormatted}`);
        
        const apiUrl = `/alp/${endpoint}`;
        const params = {
          startDate: startDateFormatted,
          endDate: endDateFormatted,
          report: 'Weekly Recap'
        };
        
        console.log(`🔍 [Leaderboard] API call: ${apiUrl}`, params);
        
        const response = await api.get(apiUrl, { params });
        
        console.log(`🔍 [Leaderboard] Response:`, response.data);
        
        if (response.data && response.data.success) {
          console.log(`🔍 [Leaderboard] Raw data count: ${response.data.data?.length || 0}`);
          const processedData = processLeaderboardData(response.data.data || []);
          console.log(`🔍 [Leaderboard] Processed data count: ${processedData.length}`);
          setLeaderboardData(processedData);
          
          // Extract report date from the first record and set leaderboard title with week range
          if (response.data.data && response.data.data.length > 0) {
            const reportDate = response.data.data[0].ReportDate;
            const weekRange = getWeekRangeFromDate(reportDate);
            const baseTitle = userRole === 'SA' ? 'Top SAs' : 
                             userRole === 'GA' ? 'Top GAs' : 
                             userRole === 'MGA' ? 'Top MGAs' : 
                             userRole === 'RGA' ? 'Top RGAs' : 
                             'Top Producers';
            setLeaderboardTitle(`${baseTitle} - Week of ${weekRange}`);
            console.log(`🔍 [Leaderboard] Set title: ${baseTitle} - Week of ${weekRange}`);
          } else {
            // Fallback title without date range
            const baseTitle = userRole === 'SA' ? 'Top SAs' : 
                             userRole === 'GA' ? 'Top GAs' : 
                             userRole === 'MGA' ? 'Top MGAs' : 
                             userRole === 'RGA' ? 'Top RGAs' : 
                             'Top Producers';
            setLeaderboardTitle(baseTitle);
          }
        } else {
          console.warn(`🔍 [Leaderboard] API returned unsuccessful response:`, response.data);
          setLeaderboardData([]);
          // Set fallback title
          const baseTitle = userRole === 'SA' ? 'Top SAs' : 
                           userRole === 'GA' ? 'Top GAs' : 
                           userRole === 'MGA' ? 'Top MGAs' : 
                           userRole === 'RGA' ? 'Top RGAs' : 
                           'Top Producers';
          setLeaderboardTitle(baseTitle);
        }
        
        return; // Exit early since we handled the API call
      }
      
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      setLeaderboardData([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  // Process leaderboard data to match the Leaderboard component format
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

  // Extract last name from MGA field (format: "LAST FIRST MIDDLE SUFFIX")
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

  // Format currency values for leaderboard
  const formatLeaderboardValue = (value) => {
    if (!value) return "$0";
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Process SA Weekly YTD data (uses LVL_2_NET instead of LVL_3_NET)
  const processSaWeeklyYtdData = (data) => {
    if (!data || data.length === 0) return {};
    
    // Get the latest YTD record
    const latestRecord = data[0];
    console.log(`🔍 [SA Weekly YTD Processing] Latest record:`, latestRecord);
    console.log(`🔍 [SA Weekly YTD Processing] Using LVL_2_NET: ${latestRecord.LVL_2_NET}`);
    return {
      ytdAlp: parseFloat(latestRecord.LVL_2_NET) || 0,
      reportdate: latestRecord.reportdate
    };
  };

  // Process SA Monthly ALP data (uses LVL_2_NET instead of LVL_3_NET)
  const processSaMonthlyAlpData = (data) => {
    console.log(`🔍 [SA Monthly ALP Processing] Raw data:`, data);
    const grouped = {};
    
    data.forEach((item, index) => {
      console.log(`🔍 [SA Monthly ALP Processing] Item ${index}:`, item);
      if (!item.month) {
        console.log(`⚠️ [SA Monthly ALP Processing] No month field for item ${index}`);
        return;
      }
      
      const parts = item.month.split("/");
      console.log(`🔍 [SA Monthly ALP Processing] Month parts:`, parts);
      
      if (parts.length !== 2) {
        console.log(`⚠️ [SA Monthly ALP Processing] Invalid month format for item ${index}: ${item.month}`);
        return;
      }
      
      const monthIndex = parseInt(parts[0], 10) - 1; // convert to 0-indexed
      const year = parseInt(parts[1], 10);
      
      console.log(`🔍 [SA Monthly ALP Processing] Parsed - Month: ${monthIndex + 1}, Year: ${year}, LVL_2_NET: ${item.LVL_2_NET}`);
      
      if (!grouped[year]) {
        grouped[year] = Array(12).fill(0);
      }
      // Use LVL_2_NET for SA dashboard 
      grouped[year][monthIndex] = parseFloat(item.LVL_2_NET) || 0;
    });
    
    console.log(`🔍 [SA Monthly ALP Processing] Final grouped data:`, grouped);
    return grouped;
  };

  // Process GA Weekly YTD data (uses LVL_3_NET like MGA)
  const processGaWeeklyYtdData = (data) => {
    if (!data || data.length === 0) return {};
    
    // Get the latest YTD record
    const latestRecord = data[0];
    console.log(`🔍 [GA Weekly YTD Processing] Latest record:`, latestRecord);
    console.log(`🔍 [GA Weekly YTD Processing] Using LVL_3_NET: ${latestRecord.LVL_3_NET}`);
    return {
      ytdAlp: parseFloat(latestRecord.LVL_3_NET) || 0,
      reportdate: latestRecord.reportdate
    };
  };

  // Process GA Monthly ALP data (uses LVL_3_NET with fallback to LVL_2_NET)
  const processGaMonthlyAlpData = (data) => {
    console.log(`🔍 [GA Monthly ALP Processing] Raw data:`, data);
    const grouped = {};
    
    data.forEach((item, index) => {
      console.log(`🔍 [GA Monthly ALP Processing] Item ${index}:`, item);
      if (!item.month) {
        console.log(`⚠️ [GA Monthly ALP Processing] No month field for item ${index}`);
        return;
      }
      
      const parts = item.month.split("/");
      console.log(`🔍 [GA Monthly ALP Processing] Month parts:`, parts);
      
      if (parts.length !== 2) {
        console.log(`⚠️ [GA Monthly ALP Processing] Invalid month format for item ${index}: ${item.month}`);
        return;
      }
      
      const monthIndex = parseInt(parts[0], 10) - 1; // convert to 0-indexed
      const year = parseInt(parts[1], 10);
      
      console.log(`🔍 [GA Monthly ALP Processing] Parsed - Month: ${monthIndex + 1}, Year: ${year}, LVL_3_NET: ${item.LVL_3_NET}, LVL_2_NET: ${item.LVL_2_NET}`);
      
      if (!grouped[year]) {
        grouped[year] = Array(12).fill(0);
      }
      // Use LVL_3_NET for GA dashboard, fallback to LVL_2_NET if LVL_3_NET is 0
      let alpValue = parseFloat(item.LVL_3_NET) || 0;
      if (alpValue === 0) {
        alpValue = parseFloat(item.LVL_2_NET) || 0;
        if (alpValue > 0) {
          console.log(`🔍 [GA Monthly ALP Processing] LVL_3_NET was 0, using LVL_2_NET: ${alpValue}`);
        }
      }
      grouped[year][monthIndex] = alpValue;
    });
    
    console.log(`🔍 [GA Monthly ALP Processing] Final grouped data:`, grouped);
    return grouped;
  };

  // Process MGA Weekly YTD data
  const processMgaWeeklyYtdData = (data) => {
    if (!data || data.length === 0) return {};
    
    // Get the latest YTD record
    const latestRecord = data[0];
    console.log(`🔍 [MGA Weekly YTD Processing] Latest record:`, latestRecord);
    console.log(`🔍 [MGA Weekly YTD Processing] Using LVL_3_NET: ${latestRecord.LVL_3_NET}`);
    return {
      ytdAlp: parseFloat(latestRecord.LVL_3_NET) || 0,
      reportdate: latestRecord.reportdate
    };
  };

  // Process MGA Monthly ALP data
  const processMgaMonthlyAlpData = (data) => {
    console.log(`🔍 [MGA Monthly ALP Processing] Raw data:`, data);
    const grouped = {};
    
    data.forEach((item, index) => {
      console.log(`🔍 [MGA Monthly ALP Processing] Item ${index}:`, item);
      if (!item.month) {
        console.log(`⚠️ [MGA Monthly ALP Processing] No month field for item ${index}`);
        return;
      }
      
      const parts = item.month.split("/");
      console.log(`🔍 [MGA Monthly ALP Processing] Month parts:`, parts);
      
      if (parts.length !== 2) {
        console.log(`⚠️ [MGA Monthly ALP Processing] Invalid month format for item ${index}: ${item.month}`);
        return;
      }
      
      const monthIndex = parseInt(parts[0], 10) - 1; // convert to 0-indexed
      const year = parseInt(parts[1], 10);
      
      console.log(`🔍 [MGA Monthly ALP Processing] Parsed - Month: ${monthIndex + 1}, Year: ${year}, LVL_1_NET: ${item.LVL_1_NET}, LVL_3_NET: ${item.LVL_3_NET}`);
      
      if (!grouped[year]) {
        grouped[year] = Array(12).fill(0);
      }
      // Use LVL_3_NET for MGA dashboard (consistent with scorecard components)
      grouped[year][monthIndex] = parseFloat(item.LVL_3_NET) || 0;
    });
    
    console.log(`🔍 [MGA Monthly ALP Processing] Final grouped data:`, grouped);
    return grouped;
  };

  // Helper function to find the most recent month with actual data
  const findMostRecentMonthWithData = (dataArray, startingIndex, dataType = "ALP") => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = startingIndex - 1; i >= 0; i--) {
      if (dataArray[i] && dataArray[i] > 0) {
        console.log(`🔍 [MGA ${dataType}] Found data at month index ${i} (${monthNames[i]}): ${dataArray[i]}`);
        return { index: i, value: dataArray[i], month: monthNames[i] };
      }
    }
    
    console.log(`⚠️ [MGA ${dataType}] No data found in current year, returning zero`);
    return { index: startingIndex - 1, value: 0, month: monthNames[startingIndex - 1] || "Unknown" };
  };

  // Calculate SA dashboard metrics (similar to MGA but using LVL_2_NET)
  const calculateSaDashboardMetrics = (weeklyYtdData, monthlyAlpData) => {
    const currentDate = new Date();
    const currentDay = currentDate.getDate();
    
    console.log(`🔍 [SA Dashboard Metrics] Current date: ${currentDate.toISOString()}, day: ${currentDay}`);
    
    let reportingMonthIndex;
    
    if (currentDay < 5) {
      reportingMonthIndex = currentDate.getMonth() - 2;
    } else {
      reportingMonthIndex = currentDate.getMonth() - 1;
    }
    
    // Handle negative indices (cross-year boundaries)
    if (reportingMonthIndex < 0) reportingMonthIndex += 12;
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const reportingMonth = monthNames[reportingMonthIndex];
    
    console.log(`🔍 [SA Dashboard Metrics] Reporting month: ${reportingMonth} (index: ${reportingMonthIndex})`);
    
    // Process YTD data
    const ytdMetrics = processSaWeeklyYtdData(weeklyYtdData);
    console.log(`🔍 [SA Dashboard Metrics] YTD metrics:`, ytdMetrics);
    
    // Process Monthly ALP data
    const monthlyData = processSaMonthlyAlpData(monthlyAlpData);
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    console.log(`🔍 [SA Dashboard Metrics] Current year: ${currentYear}, Previous year: ${previousYear}`);
    
    const currentYearData = monthlyData[currentYear] || Array(12).fill(0);
    const previousYearData = monthlyData[previousYear] || Array(12).fill(0);
    
    console.log(`🔍 [SA Dashboard Metrics] Current year data:`, currentYearData);
    console.log(`🔍 [SA Dashboard Metrics] Previous year data:`, previousYearData);
    
    const currentMonthAlp = currentYearData[reportingMonthIndex] || 0;
    
    // Find the most recent month with actual ALP data
    const alpComparison = findMostRecentMonthWithData(currentYearData, reportingMonthIndex, "SA ALP");
    const previousMonthAlp = alpComparison.value;
    const comparisonMonth = alpComparison.month;
    
    const previousYearYtdAlp = previousYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);
    
    console.log(`🔍 [SA Dashboard Metrics] Current month ALP: ${currentMonthAlp}, Previous month ALP: ${previousMonthAlp} (from ${comparisonMonth}), Previous year YTD ALP: ${previousYearYtdAlp}`);
    
    const result = {
      ytdAlp: ytdMetrics.ytdAlp || 0,
      currentMonthAlp,
      previousMonthAlp,
      previousYearYtdAlp,
      reportingMonth,
      comparisonMonth,
      reportingMonthIndex,
      alpComparisonIndex: alpComparison.index
    };
    
    console.log(`🔍 [SA Dashboard Metrics] Final result:`, result);
    return result;
  };

  // Calculate GA dashboard metrics (similar to MGA but with LVL_3_NET/LVL_2_NET fallback)
  const calculateGaDashboardMetrics = (weeklyYtdData, monthlyAlpData) => {
    const currentDate = new Date();
    const currentDay = currentDate.getDate();
    
    console.log(`🔍 [GA Dashboard Metrics] Current date: ${currentDate.toISOString()}, day: ${currentDay}`);
    
    let reportingMonthIndex;
    
    if (currentDay < 5) {
      reportingMonthIndex = currentDate.getMonth() - 2;
    } else {
      reportingMonthIndex = currentDate.getMonth() - 1;
    }
    
    // Handle negative indices (cross-year boundaries)
    if (reportingMonthIndex < 0) reportingMonthIndex += 12;
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const reportingMonth = monthNames[reportingMonthIndex];
    
    console.log(`🔍 [GA Dashboard Metrics] Reporting month: ${reportingMonth} (index: ${reportingMonthIndex})`);
    
    // Process YTD data
    const ytdMetrics = processGaWeeklyYtdData(weeklyYtdData);
    console.log(`🔍 [GA Dashboard Metrics] YTD metrics:`, ytdMetrics);
    
    // Process Monthly ALP data
    const monthlyData = processGaMonthlyAlpData(monthlyAlpData);
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    console.log(`🔍 [GA Dashboard Metrics] Current year: ${currentYear}, Previous year: ${previousYear}`);
    
    const currentYearData = monthlyData[currentYear] || Array(12).fill(0);
    const previousYearData = monthlyData[previousYear] || Array(12).fill(0);
    
    console.log(`🔍 [GA Dashboard Metrics] Current year data:`, currentYearData);
    console.log(`🔍 [GA Dashboard Metrics] Previous year data:`, previousYearData);
    
    const currentMonthAlp = currentYearData[reportingMonthIndex] || 0;
    
    // Find the most recent month with actual ALP data (with GA-specific fallback logic)
    const alpComparison = findMostRecentMonthWithData(currentYearData, reportingMonthIndex, "GA ALP");
    const previousMonthAlp = alpComparison.value;
    const comparisonMonth = alpComparison.month;
    
    const previousYearYtdAlp = previousYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);
    
    console.log(`🔍 [GA Dashboard Metrics] Current month ALP: ${currentMonthAlp}, Previous month ALP: ${previousMonthAlp} (from ${comparisonMonth}), Previous year YTD ALP: ${previousYearYtdAlp}`);
    
    const result = {
      ytdAlp: ytdMetrics.ytdAlp || 0,
      currentMonthAlp,
      previousMonthAlp,
      previousYearYtdAlp,
      reportingMonth,
      comparisonMonth,
      reportingMonthIndex,
      alpComparisonIndex: alpComparison.index
    };
    
    console.log(`🔍 [GA Dashboard Metrics] Final result:`, result);
    return result;
  };

  // Calculate MGA dashboard metrics (similar to SGA but using different data sources)
  const calculateMgaDashboardMetrics = (weeklyYtdData, monthlyAlpData) => {
    const currentDate = new Date();
    const currentDay = currentDate.getDate();
    
    console.log(`🔍 [MGA Dashboard Metrics] Current date: ${currentDate.toISOString()}, day: ${currentDay}`);
    
    let reportingMonthIndex;
    
    if (currentDay < 5) {
      reportingMonthIndex = currentDate.getMonth() - 2;
    } else {
      reportingMonthIndex = currentDate.getMonth() - 1;
    }
    
    // Handle negative indices (cross-year boundaries)
    if (reportingMonthIndex < 0) reportingMonthIndex += 12;
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const reportingMonth = monthNames[reportingMonthIndex];
    
    console.log(`🔍 [MGA Dashboard Metrics] Reporting month: ${reportingMonth} (index: ${reportingMonthIndex})`);
    
    // Process YTD data
    const ytdMetrics = processMgaWeeklyYtdData(weeklyYtdData);
    console.log(`🔍 [MGA Dashboard Metrics] YTD metrics:`, ytdMetrics);
    
    // Process Monthly ALP data
    const monthlyData = processMgaMonthlyAlpData(monthlyAlpData);
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    console.log(`🔍 [MGA Dashboard Metrics] Current year: ${currentYear}, Previous year: ${previousYear}`);
    
    const currentYearData = monthlyData[currentYear] || Array(12).fill(0);
    const previousYearData = monthlyData[previousYear] || Array(12).fill(0);
    
    console.log(`🔍 [MGA Dashboard Metrics] Current year data:`, currentYearData);
    console.log(`🔍 [MGA Dashboard Metrics] Previous year data:`, previousYearData);
    
    const currentMonthAlp = currentYearData[reportingMonthIndex] || 0;
    
    // Find the most recent month with actual ALP data
    const alpComparison = findMostRecentMonthWithData(currentYearData, reportingMonthIndex, "ALP");
    const previousMonthAlp = alpComparison.value;
    const comparisonMonth = alpComparison.month;
    
    const previousYearYtdAlp = previousYearData.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);
    
    console.log(`🔍 [MGA Dashboard Metrics] Current month ALP: ${currentMonthAlp}, Previous month ALP: ${previousMonthAlp} (from ${comparisonMonth}), Previous year YTD ALP: ${previousYearYtdAlp}`);
    
    const result = {
      ytdAlp: ytdMetrics.ytdAlp || 0,
      currentMonthAlp,
      previousMonthAlp,
      previousYearYtdAlp,
      reportingMonth,
      comparisonMonth,
      reportingMonthIndex,
      alpComparisonIndex: alpComparison.index
    };
    
    console.log(`🔍 [MGA Dashboard Metrics] Final result:`, result);
    return result;
  };

  // Calculate SA codes and hires metrics (uses SA and GA values for counting)
  const calculateSaCodesAndHiresMetrics = (vipsData, associatesData, hiresData, reportingMonthIndex) => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    console.log(`🔍 [SA Codes/Hires] Processing data for SA - includes both SA and GA levels`);
    
    // Process VIPs data (uses vip_month field: YYYY-MM-DD HH:MM:SS)
    // For SA/GA: includes VIPs where SA or GA fields match
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

    // Process Associates data (uses PRODDATE field: YYYY-MM-DD)  
    // For SA/GA: includes Associates where SA or GA fields match
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

    // Process Hires data (uses MORE_Date field)
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
    const codesComparison = findMostRecentMonthWithData(currentYearCodes, reportingMonthIndex, "SA Codes");
    const previousMonthCodes = codesComparison.value;
    const codesComparisonMonth = codesComparison.month;
    
    // Find the most recent month with actual hires data  
    const hiresComparison = findMostRecentMonthWithData(currentYearHires, reportingMonthIndex, "SA Hires");
    const previousMonthHires = hiresComparison.value;
    const hiresComparisonMonth = hiresComparison.month;
    
    const previousYearYtdCodes = previousYearCodes.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);

    console.log(`🔍 [SA Codes/Hires] Current codes: ${currentMonthCodes}, Previous codes: ${previousMonthCodes} (from ${codesComparisonMonth})`);
    console.log(`🔍 [SA Codes/Hires] Current hires: ${currentMonthHires}, Previous hires: ${previousMonthHires} (from ${hiresComparisonMonth})`);

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

  // Calculate GA codes and hires metrics (uses SA and GA values for counting)
  const calculateGaCodesAndHiresMetrics = (vipsData, associatesData, hiresData, reportingMonthIndex) => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    console.log(`🔍 [GA Codes/Hires] Processing data for GA - includes both SA and GA levels`);
    
    // Process VIPs data (uses vip_month field: YYYY-MM-DD HH:MM:SS)
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

    // Process Associates data (uses PRODDATE field: YYYY-MM-DD)
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

    // Process Hires data (uses MORE_Date field)
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
    const codesComparison = findMostRecentMonthWithData(currentYearCodes, reportingMonthIndex, "GA Codes");
    const previousMonthCodes = codesComparison.value;
    const codesComparisonMonth = codesComparison.month;
    
    // Find the most recent month with actual hires data  
    const hiresComparison = findMostRecentMonthWithData(currentYearHires, reportingMonthIndex, "GA Hires");
    const previousMonthHires = hiresComparison.value;
    const hiresComparisonMonth = hiresComparison.month;
    
    const previousYearYtdCodes = previousYearCodes.slice(0, reportingMonthIndex + 1).reduce((sum, val) => sum + val, 0);

    console.log(`🔍 [GA Codes/Hires] Current codes: ${currentMonthCodes}, Previous codes: ${previousMonthCodes} (from ${codesComparisonMonth})`);
    console.log(`🔍 [GA Codes/Hires] Current hires: ${currentMonthHires}, Previous hires: ${previousMonthHires} (from ${hiresComparisonMonth})`);

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

  // Calculate MGA codes and hires metrics (similar to SGA)
  const calculateMgaCodesAndHiresMetrics = (vipsData, associatesData, hiresData, reportingMonthIndex) => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    // Process VIPs data (uses vip_month field: YYYY-MM-DD HH:MM:SS)
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

    // Process Associates data (uses PRODDATE field: YYYY-MM-DD)
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

    // Process Hires data (uses MORE_Date field)
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

    console.log(`🔍 [MGA Codes/Hires] Current codes: ${currentMonthCodes}, Previous codes: ${previousMonthCodes} (from ${codesComparisonMonth})`);
    console.log(`🔍 [MGA Codes/Hires] Current hires: ${currentMonthHires}, Previous hires: ${previousMonthHires} (from ${hiresComparisonMonth})`);

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

  // MGA Dashboard Component
  const MgaDashboard = () => {
    if (loading) {
      return (
        <div className="dashboard-container padded-content-sm">
          <div className="loading-spinner"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="dashboard-container padded-content-sm">
          <div className="error-message">{error}</div>
        </div>
      );
    }

    // Daily Activity metrics
    const totalAlp = mgaDailyActivityData?.totalAlp || 0;
    const totalRefAlp = mgaDailyActivityData?.totalRefAlp || 0;
    const totalRefs = mgaDailyActivityData?.totalRefs || 0;
    const totalRefSales = refSalesData?.totalRefSales || 0;
    
    // Calculate MGA metrics using processed data
    const mgaMetrics = calculateMgaDashboardMetrics(mgaWeeklyYtdData, mgaMonthlyAlpData);
    
    // Calculate codes and hires metrics
    const codesAndHiresMetrics = calculateMgaCodesAndHiresMetrics(mgaVipsData, mgaAssociatesData, mgaHiresData, mgaMetrics.reportingMonthIndex);

    return (
      <div className="dashboard-container padded-content-sm">
        <div className="dashboard-header">
          <div className="date-range-selector">
            <label>
              From: 
              <input 
                type="date" 
                value={selectedDateRange.startDate} 
                onChange={(e) => setSelectedDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </label>
            <label>
              To: 
              <input 
                type="date" 
                value={selectedDateRange.endDate} 
                onChange={(e) => setSelectedDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </label>
          </div>
        </div>
        
        <div className="dashboard-layout">
          <div className="dashboard-main-content">
            <div className="dashboard-cards-wrapper">
              {/* YTD Section */}
              <div className="dashboard-section">
                <h3 className="section-title">YTD Performance</h3>
            <hr className="section-divider" />
            <div className="card-container">
              <Card
                title="YTD MGA ALP"
                value={formatCurrency(mgaMetrics.ytdAlp)}
                backgroundIcon={FiDollarSign}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(76, 175, 80, 0.1)"
                showComparison={true}
                currentValue={mgaMetrics.ytdAlp}
                previousValue={mgaMetrics.previousYearYtdAlp}
                rangeType="year"
                showIcon={true}
                showPercentage={true}
                comparisonFormat="currency"
                comparisonLabel={`vs same period last year`}
                className="dashboard-card"
              />
              <Card
                title="YTD Codes + VIPs"
                value={codesAndHiresMetrics.ytdCodes.toString()}
                backgroundIcon={FiActivity}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(63, 81, 181, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.ytdCodes}
                previousValue={codesAndHiresMetrics.previousYearYtdCodes}
                rangeType="year"
                showIcon={true}
                showPercentage={true}
                comparisonFormat="number"
                comparisonLabel={`vs same period last year`}
                className="dashboard-card"
              />
              <Card
                title="YTD Hires"
                value={codesAndHiresMetrics.ytdHires.toString()}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 152, 0, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.ytdHires}
                previousValue={codesAndHiresMetrics.previousYearYtdHires}
                rangeType="year"
                showIcon={true}
                showPercentage={true}
                comparisonFormat="number"
                comparisonLabel={`vs same period last year`}
                className="dashboard-card"
              />
            </div>
          </div>

          {/* Last Month Section */}
          <div className="dashboard-section">
            <h3 className="section-title">Last Month Performance</h3>
            <hr className="section-divider" />
            <div className="card-container">
              <Card
                title={`${mgaMetrics.reportingMonth} ALP`}
                value={formatCurrency(mgaMetrics.currentMonthAlp)}
                backgroundIcon={FiDollarSign}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(76, 175, 80, 0.1)"
                showComparison={true}
                currentValue={mgaMetrics.currentMonthAlp}
                previousValue={mgaMetrics.previousMonthAlp}
                rangeType="month"
                showIcon={true}
                comparisonFormat="currency"
                comparisonLabel={`from ${mgaMetrics.comparisonMonth}`}
                className="dashboard-card"
              />
              <Card
                title={`${mgaMetrics.reportingMonth} Codes + VIPs`}
                value={codesAndHiresMetrics.currentMonthCodes.toString()}
                backgroundIcon={FiActivity}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(63, 81, 181, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.currentMonthCodes}
                previousValue={codesAndHiresMetrics.previousMonthCodes}
                rangeType="month"
                showIcon={true}
                comparisonFormat="number"
                comparisonLabel={`from ${codesAndHiresMetrics.codesComparisonMonth}`}
                className="dashboard-card"
              />
              <Card
                title={`${mgaMetrics.reportingMonth} Hires`}
                value={codesAndHiresMetrics.currentMonthHires.toString()}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 152, 0, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.currentMonthHires}
                previousValue={codesAndHiresMetrics.previousMonthHires}
                rangeType="month"
                showIcon={true}
                comparisonFormat="number"
                comparisonLabel={`from ${codesAndHiresMetrics.hiresComparisonMonth}`}
                className="dashboard-card"
              />
              <Card
                title={`${mgaMetrics.reportingMonth} Ref Sales`}
                value={totalRefSales.toString()}
                backgroundIcon={FiDollarSign}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(156, 39, 176, 0.1)"
                subText="From refvalidation table"
                className="dashboard-card"
              />
            </div>
          </div>

          {/* Reported Activity Section */}
          <div className="dashboard-section">
            <div className="section-header-with-controls">
              <h3 className="section-title">Reported Activity</h3>
              <div className="date-range-selector">
                <label>
                  From: 
                  <input 
                    type="date" 
                    value={selectedDateRange.startDate}
                    onChange={(e) => setSelectedDateRange(prev => ({
                      ...prev,
                      startDate: e.target.value
                    }))}
                  />
                </label>
                <label>
                  To: 
                  <input 
                    type="date" 
                    value={selectedDateRange.endDate}
                    onChange={(e) => setSelectedDateRange(prev => ({
                      ...prev,
                      endDate: e.target.value
                    }))}
                  />
                </label>
              </div>
            </div>
            <hr className="section-divider" />
            <div className="card-container">
              <Card
                title="ALP"
                value={formatCurrency(totalAlp)}
                backgroundIcon={FiActivity}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 152, 0, 0.1)"
                subText={`${formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate)} | ${mgaDailyActivityData?.agentCount || 0} agents`}
                className="dashboard-card"
              />
              <Card
                title="Ref ALP"
                value={formatCurrency(totalRefAlp)}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(156, 39, 176, 0.1)"
                subText={`${formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate)} | ${mgaDailyActivityData?.agentCount || 0} agents`}
                className="dashboard-card"
              />
              <Card
                title="Refs Collected"
                value={totalRefs.toString()}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(156, 39, 176, 0.1)"
                subText={`${formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate)} | ${mgaDailyActivityData?.agentCount || 0} agents`}
                className="dashboard-card"
              />
            </div>
          </div>
            </div>
          </div>
          
          {/* Leaderboard Sidebar */}
          <div className="dashboard-sidebar">
              <Leaderboard
                data={leaderboardData}
                title={userRole === 'SA' ? 'Top SAs' : userRole === 'GA' ? 'Top GAs' : userRole === 'MGA' ? 'Top MGAs' : userRole === 'RGA' ? 'Top RGAs' : 'Top Producers'}
                nameField="name"
                valueField="value"
                formatValue={formatLeaderboardValue}
                loading={leaderboardLoading}
                variant="compact"
                showProfilePicture={true}
                profilePictureField="profile_picture"
                showLevelBadge={true}
                showMGA={true}
                hierarchyLevel={userRole?.toLowerCase() || 'all'}
                className="dashboard-leaderboard"
              />
            </div>
          </div>
      </div>
    );
  };

  // SA Dashboard Component
  const SaDashboard = () => {
    if (loading) {
      return (
        <div className="dashboard-container padded-content-sm">
          <div className="loading-spinner"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="dashboard-container padded-content-sm">
          <div className="error-message">{error}</div>
        </div>
      );
    }

    // Daily Activity metrics
    const totalAlp = saDailyActivityData?.totalAlp || 0;
    const totalRefAlp = saDailyActivityData?.totalRefAlp || 0;
    const totalRefs = saDailyActivityData?.totalRefs || 0;
    const totalRefSales = refSalesData?.totalRefSales || 0;
    
    // Calculate SA metrics using processed data
    const saMetrics = calculateSaDashboardMetrics(saWeeklyYtdData, saMonthlyAlpData);
    
    // Calculate codes and hires metrics
    const codesAndHiresMetrics = calculateSaCodesAndHiresMetrics(saVipsData, saAssociatesData, saHiresData, saMetrics.reportingMonthIndex);

    return (
      <div className="dashboard-container padded-content-sm">
        
        <div className="dashboard-layout">
          <div className="dashboard-main-content">
            <div className="dashboard-cards-wrapper">
              {/* YTD Section */}
              <div className="dashboard-section">
                <h3 className="section-title">YTD Performance</h3>
            <hr className="section-divider" />
            <div className="card-container">
              <Card
                title="YTD SA ALP"
                value={formatCurrency(saMetrics.ytdAlp)}
                backgroundIcon={FiDollarSign}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(76, 175, 80, 0.1)"
                showComparison={true}
                currentValue={saMetrics.ytdAlp}
                previousValue={saMetrics.previousYearYtdAlp}
                rangeType="year"
                showIcon={true}
                showPercentage={true}
                comparisonFormat="currency"
                comparisonLabel={`vs same period last year`}
                className="dashboard-card"
              />
              <Card
                title="YTD Codes + VIPs"
                value={codesAndHiresMetrics.ytdCodes.toString()}
                backgroundIcon={FiActivity}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(63, 81, 181, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.ytdCodes}
                previousValue={codesAndHiresMetrics.previousYearYtdCodes}
                rangeType="year"
                showIcon={true}
                showPercentage={true}
                comparisonFormat="number"
                comparisonLabel={`vs same period last year`}
                className="dashboard-card"
              />
              <Card
                title="YTD Hires"
                value={codesAndHiresMetrics.ytdHires.toString()}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 152, 0, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.ytdHires}
                previousValue={codesAndHiresMetrics.previousYearYtdHires}
                rangeType="year"
                showIcon={true}
                showPercentage={true}
                comparisonFormat="number"
                comparisonLabel={`vs same period last year`}
                className="dashboard-card"
              />
            </div>
          </div>

          {/* Last Month Section */}
          <div className="dashboard-section">
            <h3 className="section-title">Last Month Performance</h3>
            <hr className="section-divider" />
            <div className="card-container">
              <Card
                title={`${saMetrics.reportingMonth} ALP`}
                value={formatCurrency(saMetrics.currentMonthAlp)}
                backgroundIcon={FiDollarSign}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(76, 175, 80, 0.1)"
                showComparison={true}
                currentValue={saMetrics.currentMonthAlp}
                previousValue={saMetrics.previousMonthAlp}
                rangeType="month"
                showIcon={true}
                comparisonFormat="currency"
                comparisonLabel={`from ${saMetrics.comparisonMonth}`}
                className="dashboard-card"
              />
              <Card
                title={`${saMetrics.reportingMonth} Codes + VIPs`}
                value={codesAndHiresMetrics.currentMonthCodes.toString()}
                backgroundIcon={FiActivity}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(63, 81, 181, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.currentMonthCodes}
                previousValue={codesAndHiresMetrics.previousMonthCodes}
                rangeType="month"
                showIcon={true}
                comparisonFormat="number"
                comparisonLabel={`from ${codesAndHiresMetrics.codesComparisonMonth}`}
                className="dashboard-card"
              />
              <Card
                title={`${saMetrics.reportingMonth} Hires`}
                value={codesAndHiresMetrics.currentMonthHires.toString()}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 152, 0, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.currentMonthHires}
                previousValue={codesAndHiresMetrics.previousMonthHires}
                rangeType="month"
                showIcon={true}
                comparisonFormat="number"
                comparisonLabel={`from ${codesAndHiresMetrics.hiresComparisonMonth}`}
                className="dashboard-card"
              />
              <Card
                title={`${saMetrics.reportingMonth} Ref Sales`}
                value={totalRefSales.toString()}
                backgroundIcon={FiDollarSign}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(156, 39, 176, 0.1)"
                subText="From refvalidation table (SA + GA)"
                className="dashboard-card"
              />
            </div>
          </div>

          {/* Reported Activity Section */}
          <div className="dashboard-section">
            <div className="section-header-with-controls">
              <h3 className="section-title">Reported Activity</h3>
              <div className="date-range-selector">
                <label>
                  From: 
                  <input 
                    type="date" 
                    value={selectedDateRange.startDate}
                    onChange={(e) => setSelectedDateRange(prev => ({
                      ...prev,
                      startDate: e.target.value
                    }))}
                  />
                </label>
                <label>
                  To: 
                  <input 
                    type="date" 
                    value={selectedDateRange.endDate}
                    onChange={(e) => setSelectedDateRange(prev => ({
                      ...prev,
                      endDate: e.target.value
                    }))}
                  />
                </label>
              </div>
            </div>
            <hr className="section-divider" />
            <div className="card-container">
              <Card
                title="ALP"
                value={formatCurrency(totalAlp)}
                backgroundIcon={FiActivity}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 152, 0, 0.1)"
                subText={`${formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate)} | ${saDailyActivityData?.agentCount || 0} agents`}
                className="dashboard-card"
              />
              <Card
                title="Ref ALP"
                value={formatCurrency(totalRefAlp)}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(156, 39, 176, 0.1)"
                subText={`${formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate)} | ${saDailyActivityData?.agentCount || 0} agents`}
                className="dashboard-card"
              />
              <Card
                title="Refs Collected"
                value={totalRefs.toString()}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(156, 39, 176, 0.1)"
                subText={`${formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate)} | ${saDailyActivityData?.agentCount || 0} agents`}
                className="dashboard-card"
              />
            </div>
          </div>
            </div>
          </div>
          
          {/* Leaderboard Sidebar */}
          <div className="dashboard-sidebar">
              <Leaderboard
                data={leaderboardData}
                title={leaderboardTitle}
                nameField="name"
                valueField="value"
                formatValue={formatLeaderboardValue}
                loading={leaderboardLoading}
                variant="compact"
                showProfilePicture={true}
                profilePictureField="profile_picture"
                showLevelBadge={true}
                showMGA={true}
                hierarchyLevel={userRole?.toLowerCase() || 'all'}
                className="dashboard-leaderboard"
              />
            </div>
          </div>
      </div>
    );
  };

  // GA Dashboard Component
  const GaDashboard = () => {
    if (loading) {
      return (
        <div className="dashboard-container padded-content-sm">
          <div className="loading-spinner"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="dashboard-container padded-content-sm">
          <div className="error-message">{error}</div>
        </div>
      );
    }

    // Daily Activity metrics
    const totalAlp = gaDailyActivityData?.totalAlp || 0;
    const totalRefAlp = gaDailyActivityData?.totalRefAlp || 0;
    const totalRefs = gaDailyActivityData?.totalRefs || 0;
    const totalRefSales = refSalesData?.totalRefSales || 0;
    
    // Calculate GA metrics using processed data
    const gaMetrics = calculateGaDashboardMetrics(gaWeeklyYtdData, gaMonthlyAlpData);
    
    // Calculate codes and hires metrics
    const codesAndHiresMetrics = calculateGaCodesAndHiresMetrics(gaVipsData, gaAssociatesData, gaHiresData, gaMetrics.reportingMonthIndex);

    return (
      <div className="dashboard-container padded-content-sm">
        
        <div className="dashboard-layout">
          <div className="dashboard-main-content">
            <div className="dashboard-cards-wrapper">
              {/* YTD Section */}
              <div className="dashboard-section">
                <h3 className="section-title">YTD Performance</h3>
            <hr className="section-divider" />
            <div className="card-container">
              <Card
                title="YTD GA ALP"
                value={formatCurrency(gaMetrics.ytdAlp)}
                backgroundIcon={FiDollarSign}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(76, 175, 80, 0.1)"
                showComparison={true}
                currentValue={gaMetrics.ytdAlp}
                previousValue={gaMetrics.previousYearYtdAlp}
                rangeType="year"
                showIcon={true}
                showPercentage={true}
                comparisonFormat="currency"
                comparisonLabel={`vs same period last year`}
                className="dashboard-card"
              />
              <Card
                title="YTD Codes + VIPs"
                value={codesAndHiresMetrics.ytdCodes.toString()}
                backgroundIcon={FiActivity}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(63, 81, 181, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.ytdCodes}
                previousValue={codesAndHiresMetrics.previousYearYtdCodes}
                rangeType="year"
                showIcon={true}
                showPercentage={true}
                comparisonFormat="number"
                comparisonLabel={`vs same period last year`}
                className="dashboard-card"
              />
              <Card
                title="YTD Hires"
                value={codesAndHiresMetrics.ytdHires.toString()}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 152, 0, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.ytdHires}
                previousValue={codesAndHiresMetrics.previousYearYtdHires}
                rangeType="year"
                showIcon={true}
                showPercentage={true}
                comparisonFormat="number"
                comparisonLabel={`vs same period last year`}
                className="dashboard-card"
              />
            </div>
          </div>

          {/* Last Month Section */}
          <div className="dashboard-section">
            <h3 className="section-title">Last Month Performance</h3>
            <hr className="section-divider" />
            <div className="card-container">
              <Card
                title={`${gaMetrics.reportingMonth} ALP`}
                value={formatCurrency(gaMetrics.currentMonthAlp)}
                backgroundIcon={FiDollarSign}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(76, 175, 80, 0.1)"
                showComparison={true}
                currentValue={gaMetrics.currentMonthAlp}
                previousValue={gaMetrics.previousMonthAlp}
                rangeType="month"
                showIcon={true}
                comparisonFormat="currency"
                comparisonLabel={`from ${gaMetrics.comparisonMonth}`}
                className="dashboard-card"
              />
              <Card
                title={`${gaMetrics.reportingMonth} Codes + VIPs`}
                value={codesAndHiresMetrics.currentMonthCodes.toString()}
                backgroundIcon={FiActivity}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(63, 81, 181, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.currentMonthCodes}
                previousValue={codesAndHiresMetrics.previousMonthCodes}
                rangeType="month"
                showIcon={true}
                comparisonFormat="number"
                comparisonLabel={`from ${codesAndHiresMetrics.codesComparisonMonth}`}
                className="dashboard-card"
              />
              <Card
                title={`${gaMetrics.reportingMonth} Hires`}
                value={codesAndHiresMetrics.currentMonthHires.toString()}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 152, 0, 0.1)"
                showComparison={true}
                currentValue={codesAndHiresMetrics.currentMonthHires}
                previousValue={codesAndHiresMetrics.previousMonthHires}
                rangeType="month"
                showIcon={true}
                comparisonFormat="number"
                comparisonLabel={`from ${codesAndHiresMetrics.hiresComparisonMonth}`}
                className="dashboard-card"
              />
              <Card
                title={`${gaMetrics.reportingMonth} Ref Sales`}
                value={totalRefSales.toString()}
                backgroundIcon={FiDollarSign}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(156, 39, 176, 0.1)"
                subText="From refvalidation table (SA + GA)"
                className="dashboard-card"
              />
            </div>
          </div>

          {/* Reported Activity Section */}
          <div className="dashboard-section">
            <div className="section-header-with-controls">
              <h3 className="section-title">Reported Activity</h3>
              <div className="date-range-selector">
                <label>
                  From: 
                  <input 
                    type="date" 
                    value={selectedDateRange.startDate}
                    onChange={(e) => setSelectedDateRange(prev => ({
                      ...prev,
                      startDate: e.target.value
                    }))}
                  />
                </label>
                <label>
                  To: 
                  <input 
                    type="date" 
                    value={selectedDateRange.endDate}
                    onChange={(e) => setSelectedDateRange(prev => ({
                      ...prev,
                      endDate: e.target.value
                    }))}
                  />
                </label>
              </div>
            </div>
            <hr className="section-divider" />
            <div className="card-container">
              <Card
                title="ALP"
                value={formatCurrency(totalAlp)}
                backgroundIcon={FiActivity}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 152, 0, 0.1)"
                subText={`${formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate)} | ${gaDailyActivityData?.agentCount || 0} agents`}
                className="dashboard-card"
              />
              <Card
                title="Ref ALP"
                value={formatCurrency(totalRefAlp)}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(156, 39, 176, 0.1)"
                subText={`${formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate)} | ${gaDailyActivityData?.agentCount || 0} agents`}
                className="dashboard-card"
              />
              <Card
                title="Refs Collected"
                value={totalRefs.toString()}
                backgroundIcon={FiUsers}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(156, 39, 176, 0.1)"
                subText={`${formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate)} | ${gaDailyActivityData?.agentCount || 0} agents`}
                className="dashboard-card"
              />
            </div>
          </div>
            </div>
          </div>
          
          {/* Leaderboard Sidebar */}
          <div className="dashboard-sidebar">
              <Leaderboard
                data={leaderboardData}
                title={leaderboardTitle}
                nameField="name"
                valueField="value"
                formatValue={formatLeaderboardValue}
                loading={leaderboardLoading}
                variant="compact"
                showProfilePicture={true}
                profilePictureField="profile_picture"
                showLevelBadge={true}
                showMGA={true}
                hierarchyLevel={userRole?.toLowerCase() || 'all'}
                className="dashboard-leaderboard"
              />
            </div>
          </div>
      </div>
    );
  };

  // Default Dashboard for other roles
  const DefaultDashboard = () => (
    <div className="dashboard-container padded-content-sm">
      <div className="dashboard-cards-wrapper">
        <div className="card-container">
          <Card
            title="Coming Soon"
            value="Dashboard"
            subText="Role-specific dashboard"
            backgroundIcon={FiActivity}
            backgroundIconSize={60}
            backgroundIconPosition="center"
            backgroundIconColor="rgba(0, 0, 0, 0.05)"
            className="dashboard-card"
          />
        </div>
      </div>
    </div>
  );

  // Render appropriate dashboard based on user role
  if (userRole === 'SGA') {
    return <SgaDashboard />;
  }
  
  if (userRole === 'MGA' || userRole === 'RGA') {
    return <MgaDashboard />;
  }

  if (userRole === 'SA') {
    return <SaDashboard />;
  }

  if (userRole === 'GA') {
    return <GaDashboard />;
  }

  return <DefaultDashboard />;
};

export default Dashboard;