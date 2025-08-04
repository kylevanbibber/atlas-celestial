import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import "../../../pages/abc.css";
import Placeholder from "../../utils/Placeholder";

// Define the header layout in the desired order.
const headers = [
  { key: "mga", label: "MGA" },
  { key: "Jan", label: "Jan" },
  { key: "Feb", label: "Feb" },
  { key: "Mar", label: "Mar" },
  { key: "Q1", label: "Q1" },
  { key: "Apr", label: "Apr" },
  { key: "May", label: "May" },
  { key: "Jun", label: "Jun" },
  { key: "Q2", label: "Q2" },
  { key: "Jul", label: "Jul" },
  { key: "Aug", label: "Aug" },
  { key: "Sep", label: "Sep" },
  { key: "Q3", label: "Q3" },
  { key: "Oct", label: "Oct" },
  { key: "Nov", label: "Nov" },
  { key: "Dec", label: "Dec" },
  { key: "Q4", label: "Q4" },
  { key: "YTD", label: "YTD" },
];

const monthOrder = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const getHeaderClass = (key) => {
  if (["Q1", "Q2", "Q3", "Q4"].includes(key)) return "atlas-scorecard-quarter-column";
  if (key === "YTD") return "atlas-scorecard-year-total-column";
  return "";
};

const calculateQuarterTotals = (counts, isCurrentYear = false) => {
  // Use the last month of each quarter for quarter values
  const Q1 = counts[2]; // March (index 2)
  const Q2 = counts[5]; // June (index 5)
  const Q3 = counts[8]; // September (index 8)
  const Q4 = counts[11]; // December (index 11)
  
  let YTD;
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-indexed
  const lastMonthIndex = currentMonth === 0 ? 0 : currentMonth - 1; // If January, use January (0), otherwise use previous month
  
  if (isCurrentYear) {
    YTD = counts[lastMonthIndex] || 0;
  } else {
    // For previous year, use the same month as current year YTD for proper comparison
    YTD = counts[lastMonthIndex] || 0;
  }
  
  return { Q1, Q2, Q3, Q4, YTD };
};

// Function to calculate rolling hire to code ratios
const calculateRollingHireToCode = (codesData, hiresData, selectedYear) => {
  console.log(`==== HIRE TO CODE CALCULATION (${selectedYear}) ====`);
  console.log(`Total codes data records: ${codesData.length}`);
  console.log(`Total hires data records: ${hiresData.length}`);
  
  // Get current date to determine which months are in the future
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  // Check if a month is in the future
  const isFutureMonth = (year, month) => {
    return (year > currentYear) || (year === currentYear && month > currentMonth);
  };
  
  console.log(`Current date: ${currentDate.toDateString()}, will not display future months`);
  
  // Generate all week ranges for the selected year and previous year
  const prevYear = selectedYear - 1;
  const weekRanges = generateWeekRanges(selectedYear);
  const prevYearWeekRanges = generateWeekRanges(prevYear);
  
  console.log(`Generated ${weekRanges.length} weeks for ${selectedYear}`);
  console.log(`Generated ${prevYearWeekRanges.length} weeks for ${prevYear}`);
  
  // Map to store codes and hires by MGA and week
  const codesByMgaAndWeek = {};
  const hiresByMgaAndWeek = {};
  
  // Function to find which week a date belongs to
  const findWeekForDate = (date, ranges) => {
    const timestamp = date.getTime();
    for (let i = 0; i < ranges.length; i++) {
      if (timestamp >= ranges[i].start.getTime() && timestamp <= ranges[i].end.getTime()) {
        return i;
      }
    }
    return -1; // Not found in any week
  };
  
  // Process codes data
  codesData.forEach(item => {
    if (!item.PRODDATE) return;
    const date = new Date(item.PRODDATE);
    const year = date.getFullYear();
    
    // Only process relevant years
    if (year !== selectedYear && year !== prevYear) return;
    
    const mga = item.MGA || "Unknown";
    
    // Initialize MGA in our maps if needed
    if (!codesByMgaAndWeek[mga]) {
      codesByMgaAndWeek[mga] = {
        [selectedYear]: Array(weekRanges.length).fill(0),
        [prevYear]: Array(prevYearWeekRanges.length).fill(0)
      };
    }
    
    // Find which week the date belongs to
    const ranges = year === selectedYear ? weekRanges : prevYearWeekRanges;
    const weekIndex = findWeekForDate(date, ranges);
    
    if (weekIndex >= 0) {
      codesByMgaAndWeek[mga][year][weekIndex]++;
    }
  });
  
  // Process hires data
  hiresData.forEach(item => {
    if (!item.MORE_Date) return;
    const date = new Date(item.MORE_Date);
    const year = date.getFullYear();
    
    // Only process relevant years
    if (year !== selectedYear && year !== prevYear) return;
    
    const mga = item.MGA || "Unknown";
    
    // Initialize MGA in our maps if needed
    if (!hiresByMgaAndWeek[mga]) {
      hiresByMgaAndWeek[mga] = {
        [selectedYear]: Array(weekRanges.length).fill(0),
        [prevYear]: Array(prevYearWeekRanges.length).fill(0)
      };
    }
    
    // Find which week the date belongs to
    const ranges = year === selectedYear ? weekRanges : prevYearWeekRanges;
    const weekIndex = findWeekForDate(date, ranges);
    
    if (weekIndex >= 0) {
      hiresByMgaAndWeek[mga][year][weekIndex] += parseFloat(item.Total_Hires) || 0;
    }
  });
  
  // Helper function to get value with year boundary handling
  const getValueForWeek = (dataMap, mga, year, weekIndex) => {
    if (weekIndex < 0) {
      // We need to look at the previous year
      const prevYearWeeks = (year === selectedYear ? prevYearWeekRanges : generateWeekRanges(year - 1)).length;
      return dataMap[mga]?.[year - 1]?.[prevYearWeeks + weekIndex] || 0;
    } else {
      return dataMap[mga]?.[year]?.[weekIndex] || 0;
    }
  };
  
  // Calculate weekly ratios first, then average them monthly
  const monthlyRatios = {};
  const allMgas = new Set([...Object.keys(codesByMgaAndWeek), ...Object.keys(hiresByMgaAndWeek)]);
  
  allMgas.forEach(mga => {
    monthlyRatios[mga] = Array(12).fill(0);
    const monthRatioCounts = Array(12).fill(0);
    const weeklyRatios = [];
    
    // Calculate ratio for each week in the selected year
    for (let weekIndex = 0; weekIndex < weekRanges.length; weekIndex++) {
      // Get the month this week belongs to
      const month = weekRanges[weekIndex].start.getMonth();
      
      // Skip future months
      if (isFutureMonth(selectedYear, month)) continue;
      
      // Sum codes from previous 13 weeks
      let totalCodes = 0;
      for (let offset = 1; offset <= 13; offset++) {
        const priorWeekIndex = weekIndex - offset;
        totalCodes += getValueForWeek(codesByMgaAndWeek, mga, selectedYear, priorWeekIndex);
      }
      
      // Sum hires from 4-17 weeks prior
      let totalHires = 0;
      for (let offset = 4; offset <= 17; offset++) {
        const priorWeekIndex = weekIndex - offset;
        totalHires += getValueForWeek(hiresByMgaAndWeek, mga, selectedYear, priorWeekIndex);
      }
      
      // Calculate weekly ratio (only if we have codes to avoid division by zero)
      if (totalCodes > 0) {
        const weeklyRatio = totalHires / totalCodes;
        weeklyRatios.push({
          week: weekIndex,
          month: month,
          ratio: weeklyRatio,
          codes: totalCodes,
          hires: totalHires
        });
        
        // Add this weekly ratio to the monthly accumulator
        monthlyRatios[mga][month] += weeklyRatio;
        monthRatioCounts[month]++;
        
        // Detailed logging for week 3 (or another early week) for first MGA
        if (weekIndex === 3 && mga === [...allMgas][0]) {
          console.log(`\nDetailed calculation for week ${weekIndex+1} (${weekRanges[weekIndex].start.toDateString()} - ${weekRanges[weekIndex].end.toDateString()}):`);
          
          console.log(`Codes (sum of prior 13 weeks):`);
          for (let offset = 1; offset <= 13; offset++) {
            const priorWeekIndex = weekIndex - offset;
            let weekDate, weekYear;
            
            if (priorWeekIndex < 0) {
              // Previous year
              const adjustedIndex = prevYearWeekRanges.length + priorWeekIndex;
              weekDate = prevYearWeekRanges[adjustedIndex]?.start;
              weekYear = prevYear;
            } else {
              weekDate = weekRanges[priorWeekIndex]?.start;
              weekYear = selectedYear;
            }
            
            const codes = getValueForWeek(codesByMgaAndWeek, mga, selectedYear, priorWeekIndex);
            if (weekDate) {
              console.log(`  - Week ${priorWeekIndex + 1 < 0 ? prevYearWeekRanges.length + priorWeekIndex + 1 : priorWeekIndex + 1} (${weekDate.toDateString()} - ${weekDate ? new Date(weekDate.getTime() + 6*86400000).toDateString() : 'unknown'}): ${codes} codes`);
            } else {
              console.log(`  - Week calculation error for index ${priorWeekIndex}`);
            }
          }
          
          console.log(`Hires (weeks 4-17 prior):`);
          for (let offset = 4; offset <= 17; offset++) {
            const priorWeekIndex = weekIndex - offset;
            let weekDate, weekYear;
            
            if (priorWeekIndex < 0) {
              // Previous year
              const adjustedIndex = prevYearWeekRanges.length + priorWeekIndex;
              weekDate = prevYearWeekRanges[adjustedIndex]?.start;
              weekYear = prevYear;
            } else {
              weekDate = weekRanges[priorWeekIndex]?.start;
              weekYear = selectedYear;
            }
            
            const hires = getValueForWeek(hiresByMgaAndWeek, mga, selectedYear, priorWeekIndex);
            if (weekDate) {
              console.log(`  - Week ${priorWeekIndex + 1 < 0 ? prevYearWeekRanges.length + priorWeekIndex + 1 : priorWeekIndex + 1} (${weekDate.toDateString()} - ${weekDate ? new Date(weekDate.getTime() + 6*86400000).toDateString() : 'unknown'}): ${hires} hires`);
            } else {
              console.log(`  - Week calculation error for index ${priorWeekIndex}`);
            }
          }
          
          console.log(`Week ${weekIndex+1} ratio: ${totalHires} hires / ${totalCodes} codes = ${weeklyRatio.toFixed(4)}`);
        }
      }
    }
    
    // Average the weekly ratios for each month
    for (let i = 0; i < 12; i++) {
      // Zero out future months
      if (isFutureMonth(selectedYear, i)) {
        monthlyRatios[mga][i] = 0;
      } else if (monthRatioCounts[i] > 0) {
        monthlyRatios[mga][i] /= monthRatioCounts[i];
      }
    }
    
    // Log summary for the first MGA
    if (mga === [...allMgas][0]) {
      console.log(`\nWeekly ratios summary for "${mga}":`);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      monthRatioCounts.forEach((count, idx) => {
        if (count > 0) {
          console.log(`  ${monthNames[idx]}: ${count} weeks, average ratio: ${monthlyRatios[mga][idx].toFixed(4)}`);
        }
      });
    }
  });
  
  // Log a sample of the monthly ratios
  if (allMgas.size > 0) {
    const sampleMga = [...allMgas][0];
    console.log(`\nFinal monthly hire-to-code ratios for "${sampleMga}":`);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    monthlyRatios[sampleMga]?.forEach((ratio, idx) => {
      console.log(`  ${monthNames[idx]}: ${ratio.toFixed(4)}`);
    });
  }
  
  console.log(`Calculated monthly ratios for ${Object.keys(monthlyRatios).length} MGAs`);
  return monthlyRatios;
};

// Generate array of week ranges (Saturday to Friday) for a given year
const generateWeekRanges = (year) => {
  const weeks = [];
  
  // Start with the first Saturday of the year
  let currentDate = new Date(year, 0, 1); // January 1st
  while (currentDate.getDay() !== 6) { // 6 = Saturday
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Generate all weeks in the year
  while (currentDate.getFullYear() === year) {
    const weekStart = new Date(currentDate.getTime());
    const weekEnd = new Date(currentDate.getTime());
    weekEnd.setDate(weekEnd.getDate() + 6); // Friday is 6 days after Saturday
    
    weeks.push({
      start: weekStart,
      end: weekEnd
    });
    
    // Move to next Saturday
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return weeks;
};

// Helper to get total weeks in a year
const getWeeksInYear = (year) => {
  const lastDay = new Date(year, 11, 31);
  const lastWeek = getWeekNumber(lastDay);
  return lastWeek;
};

// Helper to get week number from date
const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

// Helper to get date from week number
const getDateFromWeekNumber = (year, weekNum) => {
  const januaryFirst = new Date(year, 0, 1);
  const dayOffset = 1 + (weekNum - 1) * 7;
  const date = new Date(year, 0, dayOffset);
  return date;
};

const groupDataByMGA = (
  data,
  dateField,
  selectedYear,
  type = "count",
  sumField = "total",
  mgaField = null,
  uniqueField = null
) => {
  const grouped = {};
  console.log(`Grouping ${data.length} items for ${dateField}, year ${selectedYear}, type ${type}`);
  
  data.forEach((item) => {
    const mga = mgaField ? item[mgaField] : (item.mga || item.MGA || "Unknown");
    if (!item[dateField]) return;
    let d;
    if (dateField === "month") {
      const parts = item[dateField].split("/");
      if (parts.length < 2) return;
      const month = parseInt(parts[0], 10) - 1;
      const year = parseInt(parts[1], 10);
      if (year !== selectedYear) return;
      d = new Date(year, month);
    } else {
      d = new Date(item[dateField]);
      if (d.getFullYear() !== selectedYear) return;
    }
    const monthIndex = d.getMonth();
    if (grouped[mga] === undefined) {
      if (type === "unique") {
        grouped[mga] = Array.from({ length: 12 }, () => new Set());
      } else {
        grouped[mga] = Array(12).fill(0);
      }
    }
    if (type === "count") {
      grouped[mga][monthIndex] += 1;
    } else if (type === "sum") {
      grouped[mga][monthIndex] += parseFloat(item[sumField]) || 0;
    } else if (type === "unique") {
      if (uniqueField && item[uniqueField] !== undefined && item[uniqueField] !== null) {
        grouped[mga][monthIndex].add(item[uniqueField]);
      }
    }
  });

  if (type === "unique") {
    // Convert each set to its size.
    for (const mga in grouped) {
      grouped[mga] = grouped[mga].map((set) => set.size);
    }
  }
  
  console.log(`Grouped into ${Object.keys(grouped).length} MGAs:`, Object.keys(grouped));
  return grouped;
};

const ScorecardSGAData = () => {
  // Get user data from auth context
  const { user } = useAuth();
  const userId = user?.userId;
  
  // Check if user is admin with teamRole="app" - treat as SGA
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
  
  // Use SGA role for app admins, otherwise use actual clname
  const userRole = isAppAdmin ? 'SGA' : user?.clname?.toUpperCase();
  
  // Use "ARIAS SIMON A" as lagnname for app admins, otherwise use actual lagnname
  const agnName = isAppAdmin ? 'ARIAS SIMON A' : user?.lagnname; // Using lagnname as agent name
  
  // Log for debugging app admin data fetching
  if (isAppAdmin) {
    console.log('🏭 ScorecardSGAView: App admin detected, using SGA role and ARIAS SIMON A as lagnname', {
      userRole,
      agnName,
      userId: user?.userId
    });
  }

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [mgaData, setMgaData] = useState([]);
  const [vipData, setVipData] = useState([]);
  const [alpData, setAlpData] = useState([]); // raw API response
  const [finalAlpData, setFinalAlpData] = useState([]); // processed ALP table rows
  const [associatesData, setAssociatesData] = useState([]);
  const [hiresData, setHiresData] = useState([]);
  const [subagentData, setSubagentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortColumn, setSortColumn] = useState("mga");
  const [sortOrder, setSortOrder] = useState("asc");
  const [selectedTreeFilter, setSelectedTreeFilter] = useState("All");
  const [hireToCodeView, setHireToCodeView] = useState("Month");
  const [showInactiveMgas, setShowInactiveMgas] = useState(false);
  const [showFutureMonths, setShowFutureMonths] = useState(true);
  const [quartersMode, setQuartersMode] = useState('show'); // 'show', 'hide', 'only'
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  
  const queryRole = (userRole === "RGA" || userRole === "SGA") ? "MGA" : userRole;
  const selectedMga = null;
  if (!agnName) {
    console.error("Invalid user role or agnName");
  }
  const effectiveAgnName =
    (userRole === "MGA" || userRole === "RGA" || (userRole === "SGA" && selectedMga))
      ? selectedMga || agnName
      : agnName;

  const useSgaEndpoints = ["SGA", "MGA", "RGA"].includes(userRole);
  const endpoints = useSgaEndpoints
    ? {
        alp: `/dataroutes/monthly-alp-all`,
        vip: `/dataroutes/vips-sga?column=${queryRole}&value=${effectiveAgnName}`,
        associates: `/dataroutes/associates-sga?column=${queryRole}&value=${effectiveAgnName}`,
        hires: `/dataroutes/org-total-hires?value=${effectiveAgnName}`,
        subagent: `/production-reports/submitting-agent-count?year=${selectedYear}&manager=ARIAS ORGANIZATION`,
      }
    : {
        alp: `/dataroutes/monthly-alp-by-mga?value=${effectiveAgnName}`,
        vip: `/dataroutes/vips?column=${queryRole}&value=${effectiveAgnName}`,
        associates: `/dataroutes/associates?column=${queryRole}&value=${effectiveAgnName}`,
        hires: `/dataroutes/total-hires?value=${effectiveAgnName}`,
        subagent: `/production-reports/submitting-agent-count?year=${selectedYear}`,
      };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(endpoints.vip),
      api.get(endpoints.alp),
      api.get(endpoints.associates),
      api.get(endpoints.hires),
      api.get(endpoints.subagent),
    ])
      .then(([vipRes, alpRes, assocRes, hiresRes, subagentRes]) => {
        setVipData(vipRes.data.data || []);
        setAlpData(alpRes.data.data || []);
        setAssociatesData(assocRes.data.data || []);
        setHiresData(hiresRes.data.data || []);
        setSubagentData(subagentRes.data.data || []);
      })
      .catch((err) => {
        console.error("Error fetching endpoint data:", err);
        setError("Error fetching endpoint data");
      })
      .finally(() => setLoading(false));
  }, [
    endpoints.vip,
    endpoints.alp,
    endpoints.associates,
    endpoints.hires,
    endpoints.subagent,
  ]);

  const processAlpDataForMGA = (data, selectedYear) => {
    const grouped = {};
    data.forEach((item) => {
      if (!item.month || typeof item.month !== "string") return;
      const parts = item.month.split("/");
      if (parts.length < 2) return;
      const monthIndex = parseInt(parts[0], 10) - 1;
      const year = parseInt(parts[1], 10);
      if (year !== selectedYear) return;
      const key = item.LagnName;
      if (!key) return;
      const rawValue = item.LVL_3_NET;
      const cleanedValue =
        parseFloat(
          rawValue.replace(/[$,()]/g, (match) => (match === "(" ? "-" : ""))
        ) || 0;
      if (!grouped[key]) {
        grouped[key] = Array(12).fill(undefined);
      }
      if (grouped[key][monthIndex] === undefined) {
        grouped[key][monthIndex] = { value: cleanedValue, clName: item.CL_Name };
      } else if (
        grouped[key][monthIndex].clName !== "MGA" &&
        item.CL_Name === "MGA"
      ) {
        grouped[key][monthIndex] = { value: cleanedValue, clName: item.CL_Name };
      }
    });
    // Convert each grouped entry to a numeric array (defaulting missing entries to 0)
    const final = {};
    Object.keys(grouped).forEach((key) => {
      final[key] = grouped[key].map((entry) => (entry ? entry.value : 0));
    });
    return final;
  };
  
  const buildHireToCodeRows = (codesRows, hiresRows) => {
    // Calculate rolling hire to code ratios
    console.log(`Building Hire to Code rows for ${codesRows.length} MGAs`);
    const rollingRatios = calculateRollingHireToCode(associatesData, hiresData, selectedYear);
    
    const rows = codesRows.map((codeRow) => {
      const mga = codeRow.mga;
      const monthlyCounts = rollingRatios[mga] || Array(12).fill(0);
      
      // Calculate quarterly and YTD ratios
      const Q1 = monthlyCounts.slice(0, 3).filter(v => v > 0).length > 0 
        ? monthlyCounts.slice(0, 3).reduce((a, b) => a + b, 0) / monthlyCounts.slice(0, 3).filter(v => v > 0).length 
        : 0;
      
      const Q2 = monthlyCounts.slice(3, 6).filter(v => v > 0).length > 0 
        ? monthlyCounts.slice(3, 6).reduce((a, b) => a + b, 0) / monthlyCounts.slice(3, 6).filter(v => v > 0).length 
        : 0;
      
      const Q3 = monthlyCounts.slice(6, 9).filter(v => v > 0).length > 0 
        ? monthlyCounts.slice(6, 9).reduce((a, b) => a + b, 0) / monthlyCounts.slice(6, 9).filter(v => v > 0).length 
        : 0;
      
      const Q4 = monthlyCounts.slice(9, 12).filter(v => v > 0).length > 0 
        ? monthlyCounts.slice(9, 12).reduce((a, b) => a + b, 0) / monthlyCounts.slice(9, 12).filter(v => v > 0).length 
        : 0;
      
      // For YTD, exclude current month if looking at current year
      const today = new Date();
      const isCurrentYear = selectedYear === today.getFullYear();
      const monthsToConsider = isCurrentYear ? Math.max(0, today.getMonth()) : 12;
      const relevantMonths = monthlyCounts.slice(0, monthsToConsider);
      const nonZeroMonths = relevantMonths.filter(v => v > 0).length;
      const YTD = nonZeroMonths > 0 
        ? relevantMonths.reduce((a, b) => a + b, 0) / nonZeroMonths 
        : 0;
      
      return {
        mga,
        monthlyCounts,
        Q1,
        Q2,
        Q3,
        Q4,
        YTD,
        treeValue: codeRow.treeValue,
      };
    });
    
    // Log a sample row for verification
    if (rows.length > 0) {
      console.log("Sample Hire to Code row:");
      console.log(`  MGA: ${rows[0].mga}`);
      console.log(`  Monthly: ${rows[0].monthlyCounts.map(v => v.toFixed(4)).join(', ')}`);
      console.log(`  Q1: ${rows[0].Q1.toFixed(4)}, Q2: ${rows[0].Q2.toFixed(4)}, Q3: ${rows[0].Q3.toFixed(4)}, Q4: ${rows[0].Q4.toFixed(4)}`);
      console.log(`  YTD: ${rows[0].YTD.toFixed(4)}`);
    }
    
    console.log("Hire to Code calculation complete");
    return rows;
  };

  const computeRatioTotals = (rows) => {
    if (rows.length === 0) return { monthly: Array(12).fill(0), Q1: 0, Q2: 0, Q3: 0, Q4: 0, YTD: 0 };
    const monthly = Array(12).fill(0);
    rows.forEach((row) => {
      row.monthlyCounts.forEach((val, idx) => {
        monthly[idx] += val;
      });
    });
    const avgMonthly = monthly.map(val => val / rows.length);
    const Q1 = rows.reduce((sum, row) => sum + row.Q1, 0) / rows.length;
    const Q2 = rows.reduce((sum, row) => sum + row.Q2, 0) / rows.length;
    const Q3 = rows.reduce((sum, row) => sum + row.Q3, 0) / rows.length;
    const Q4 = rows.reduce((sum, row) => sum + row.Q4, 0) / rows.length;
    const YTD = rows.reduce((sum, row) => sum + row.YTD, 0) / rows.length;
    return { monthly: avgMonthly, Q1, Q2, Q3, Q4, YTD };
  };
  
  const formatCellValue = (title, key, value) => {
    if (key === "mga") return value;
    if (title === "Net ALP") return currencyFormatter.format(value);
    if (title === "Hire to Code") return Number(value).toFixed(2); // e.g., show 2 decimals
    return value;
  };
  
  
  const buildAlpTableRows = (groupedData, filteredMgaData) => {
    const validMgaSet = new Set(filteredMgaData.map((m) => m.lagnname));
    return Object.keys(groupedData)
      .filter((lagnName) => validMgaSet.has(lagnName))
      .map((lagnName) => {
        const monthlyCounts = groupedData[lagnName];
        const totals = calculateQuarterTotals(monthlyCounts, selectedYear === new Date().getFullYear());
        const matchingMGA = filteredMgaData.find((m) => m.lagnname === lagnName);
        const row = {
          mga: lagnName,
          monthlyCounts,
          Q1: totals.Q1,
          Q2: totals.Q2,
          Q3: totals.Q3,
          Q4: totals.Q4,
          YTD: totals.YTD,
          treeValue: matchingMGA ? getTreeValue(matchingMGA) : "",
        };
        return row;
      });
  };
  
  
  // Helper function to get tree value from MGA object
  const getTreeValue = (mgaObj) => {
    // Try different possible field names for tree
    return mgaObj.tree || mgaObj.treeValue || mgaObj.tree_name || mgaObj.treeName || "Unknown";
  };

  // Helper function to determine if a month is in the future
  const isMonthInFuture = (year, monthIndex) => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    return (year > currentYear) || (year === currentYear && monthIndex > currentMonth);
  };

  // Helper function to determine if a column should be shown based on quarters mode and future months
  const shouldShowColumn = useCallback((index, isQuarter, isFuture, headerKey) => {
    // Always show the MGA column (first column)
    if (headerKey === 'mga' || index === 0) {
      return true;
    }
    
    // Handle quarters mode
    if (quartersMode === 'hide' && isQuarter) {
      return false; // Hide quarters
    }
    if (quartersMode === 'only') {
      // Only show quarters, YTD, and previous year columns (plus MGA column which is handled above)
      if (!isQuarter && !['YTD'].includes(headerKey)) {
        return false; // Hide non-quarter columns (except YTD)
      }
    }
    
    // Handle future months
    if (!showFutureMonths && isFuture) {
      return false;
    }
    
    return true;
  }, [quartersMode, showFutureMonths]);

  // All MGA data for totals calculation (always includes all MGAs)
  const [allMgaData, setAllMgaData] = useState([]);

  // Fetch all MGAs for filtering and totals calculation
  useEffect(() => {
    const fetchAllMgaData = async () => {
      try {
        const response = await api.get("/dataroutes/get-all-mgas");
        
        if (response.data.success) {
          console.log("All MGA data loaded:", response.data.data.length, "MGAs");
          setAllMgaData(response.data.data);
        }
      } catch (err) {
        console.error("Error fetching all MGA data:", err);
      }
    };

    fetchAllMgaData();
  }, []);

  // Filter MGA data based on showInactiveMgas state
  const filteredMgaData = useMemo(() => {
    if (!allMgaData.length) return [];
    
    return allMgaData.filter((mgaObj) => {
      const isActive = mgaObj.Active?.toLowerCase() === 'y';
      const isHidden = mgaObj.hide?.toLowerCase() === 'y';
      
      // Show active, non-hidden MGAs
      if (isActive && !isHidden) {
        return true;
      }
      
      // Show inactive MGAs only if showInactiveMgas is true
      return showInactiveMgas;
    });
  }, [allMgaData, showInactiveMgas]);

  // Get inactive MGAs for the "Inactive MGAs" row
  const inactiveMgaData = useMemo(() => {
    if (!allMgaData.length) return [];
    
    return allMgaData.filter((mgaObj) => {
      const isActive = mgaObj.Active?.toLowerCase() === 'y';
      const isHidden = mgaObj.hide?.toLowerCase() === 'y';
      
      // Include inactive MGAs
      if (!isActive) return true;
      
      // Include hidden active MGAs (since we're not showing them in the main table)
      if (isActive && isHidden) return true;
      
      return false;
    });
  }, [allMgaData]);

  // Group each dataset by MGA.
  // For VIP, use the "vip_month" field, count occurrences, and use the "mga" field.
  const vipGrouped = groupDataByMGA(vipData, "vip_month", selectedYear, "count", "total", "mga");
  console.log(`VIP grouped data:`, Object.keys(vipGrouped));
  
  // For Associates, use "PRODDATE", count occurrences, and use the "MGA" field.
  const associatesGrouped = groupDataByMGA(associatesData, "PRODDATE", selectedYear, "count", "total", "MGA");
  console.log(`Associates grouped data:`, Object.keys(associatesGrouped));
  
  // For Hires, use "MORE_Date", sum the "Total_Hires" field, and use the "MGA" field.
  const hiresGrouped = groupDataByMGA(hiresData, "MORE_Date", selectedYear, "sum", "Total_Hires", "MGA");
  console.log(`Hires grouped data:`, Object.keys(hiresGrouped));
  
  // For Subagent, use "month", count unique LagnName values, and use the "MGA_NAME" field.

  // Build table rows for each dataset by iterating over filtered MGA records.
  // If an MGA does not have data, default monthly counts to 0.
  const buildTableRows = (groupedData, isSubagent = false) => {
    console.log(`Building table rows for ${filteredMgaData.length} MGAs`);
    console.log(`Grouped data keys:`, Object.keys(groupedData));
    
    return filteredMgaData.map((mgaObj) => {
      const mgaName = mgaObj.lagnname;
      let monthlyCounts, Q1, Q2, Q3, Q4, YTD;
      
      if (isSubagent) {
        if (groupedData[mgaName]) {
          monthlyCounts = groupedData[mgaName].monthly;
          Q1 = groupedData[mgaName].Q1;
          Q2 = groupedData[mgaName].Q2;
          Q3 = groupedData[mgaName].Q3;
          Q4 = groupedData[mgaName].Q4;
          YTD = groupedData[mgaName].YTD;
        } else {
          monthlyCounts = Array(12).fill(0);
          Q1 = Q2 = Q3 = Q4 = YTD = 0;
        }
      } else {
        monthlyCounts = groupedData[mgaName] || Array(12).fill(0);
        const totals = calculateQuarterTotals(monthlyCounts, selectedYear === new Date().getFullYear());
        Q1 = totals.Q1;
        Q2 = totals.Q2;
        Q3 = totals.Q3;
        Q4 = totals.Q4;
        YTD = totals.YTD;
      }
      
      return {
        mga: mgaName,
        monthlyCounts,
        Q1,
        Q2,
        Q3,
        Q4,
        YTD,
        treeValue: getTreeValue(mgaObj),
      };
    });
  };

  // Build inactive MGAs row
  const buildInactiveMgaRow = (groupedData, isSubagent = false) => {
    if (inactiveMgaData.length === 0) return null;
    
    console.log(`Building inactive MGAs row for ${inactiveMgaData.length} MGAs`);
    
    // Sum up data from all inactive MGAs
    const inactiveMonthlyCounts = Array(12).fill(0);
    let inactiveQ1 = 0, inactiveQ2 = 0, inactiveQ3 = 0, inactiveQ4 = 0, inactiveYTD = 0;
    
    inactiveMgaData.forEach((mgaObj) => {
      const mgaName = mgaObj.lagnname;
      
      if (isSubagent) {
        if (groupedData[mgaName]) {
          const monthly = groupedData[mgaName].monthly;
          monthly.forEach((count, idx) => {
            inactiveMonthlyCounts[idx] += count;
          });
          inactiveQ1 += groupedData[mgaName].Q1 || 0;
          inactiveQ2 += groupedData[mgaName].Q2 || 0;
          inactiveQ3 += groupedData[mgaName].Q3 || 0;
          inactiveQ4 += groupedData[mgaName].Q4 || 0;
          inactiveYTD += groupedData[mgaName].YTD || 0;
        }
      } else {
        const monthlyCounts = groupedData[mgaName] || Array(12).fill(0);
        monthlyCounts.forEach((count, idx) => {
          inactiveMonthlyCounts[idx] += count;
        });
        const totals = calculateQuarterTotals(monthlyCounts, selectedYear === new Date().getFullYear());
        inactiveQ1 += totals.Q1;
        inactiveQ2 += totals.Q2;
        inactiveQ3 += totals.Q3;
        inactiveQ4 += totals.Q4;
        inactiveYTD += totals.YTD;
      }
    });
    
    return {
      mga: "Inactive MGAs",
      monthlyCounts: inactiveMonthlyCounts,
      Q1: inactiveQ1,
      Q2: inactiveQ2,
      Q3: inactiveQ3,
      Q4: inactiveQ4,
      YTD: inactiveYTD,
      treeValue: "",
      isInactiveRow: true,
    };
  };
  
    const processSubmittingAgentCountByMGA = (data, selectedYear) => {
    const groupedByMGA = {};
    data.forEach((row) => {
      if (!row.reportdate) return;
      const parts = row.reportdate.split("/");
      if (parts.length < 3) return;
      const endMonth = parseInt(parts[0], 10);
      const endDay = parseInt(parts[1], 10);
      const endYear = parseInt(parts[2], 10);
      if (endYear !== selectedYear) return;
      // Create the end date from the reportdate.
      const endDate = new Date(endYear, endMonth - 1, endDay);
      // Subtract 6 days to determine the start date of the week.
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      const month = startDate.getMonth();
      const mga = row["MGA_NAME"];
      if (!mga) return;
      if (!groupedByMGA[mga]) {
        groupedByMGA[mga] = {};
      }
      if (!groupedByMGA[mga][month]) {
        groupedByMGA[mga][month] = {};
      }
      // Determine week index within the month.
      const weekIndex = Math.floor((startDate.getDate() - 1) / 7);
      if (!groupedByMGA[mga][month][weekIndex]) {
        groupedByMGA[mga][month][weekIndex] = { agents: [] };
      }
      groupedByMGA[mga][month][weekIndex].agents.push(row.LagnName);
    });

    // For each MGA, compute a 12-element array with the monthly average count (rounded to a whole number)
    // and compute quarterly averages as the average of the three monthly counts, then rounded.
    // For YTD, if the selected year is the current year, average only the months that have passed so far.
    const result = {};
    const today = new Date();
    for (const mga in groupedByMGA) {
      const monthlyAverages = Array(12).fill(0);
      for (let m = 0; m < 12; m++) {
        if (groupedByMGA[mga][m]) {
          const weekGroups = Object.values(groupedByMGA[mga][m]);
          const weeklyCounts = weekGroups.map((week) => week.agents.length);
          const sum = weeklyCounts.reduce((a, b) => a + b, 0);
          const average = weekGroups.length ? sum / weekGroups.length : 0;
          monthlyAverages[m] = Math.round(average);
        } else {
          monthlyAverages[m] = 0;
        }
      }
      const Q1 = Math.round((monthlyAverages[0] + monthlyAverages[1] + monthlyAverages[2]) / 3);
      const Q2 = Math.round((monthlyAverages[3] + monthlyAverages[4] + monthlyAverages[5]) / 3);
      const Q3 = Math.round((monthlyAverages[6] + monthlyAverages[7] + monthlyAverages[8]) / 3);
      const Q4 = Math.round((monthlyAverages[9] + monthlyAverages[10] + monthlyAverages[11]) / 3);
      
      let YTD;
      if (selectedYear === today.getFullYear()) {
        const monthsPassed = today.getMonth(); // Exclude current month (e.g., if today is May then monthsPassed = 4 for Jan-Apr)
        YTD = monthsPassed === 0 ? 0 : Math.round(
          monthlyAverages.slice(0, monthsPassed).reduce((a, b) => a + b, 0) / monthsPassed
        );
      } else {
        YTD = Math.round(monthlyAverages.reduce((a, b) => a + b, 0) / 12);
      }
      
      result[mga] = { monthly: monthlyAverages, Q1, Q2, Q3, Q4, YTD };
    }
    return result;
  };

  const processSubAgentDataFromDatabase = (data, selectedYear) => {
    const groupedByMGA = {};
    
    data.forEach((row) => {
      if (!row.date) return;
      
      // Parse the date string and ensure it's treated as local date, not UTC
      const [yearStr, monthStr, dayStr] = row.date.split('-');
      const year = parseInt(yearStr, 10);
      if (year !== selectedYear) return;
      
      const month = parseInt(monthStr, 10) - 1; // Convert to 0-indexed
      const mga = row.MGA;
      if (!mga) return;
      
      if (!groupedByMGA[mga]) {
        groupedByMGA[mga] = {};
      }
      if (!groupedByMGA[mga][month]) {
        groupedByMGA[mga][month] = [];
      }
      
      groupedByMGA[mga][month].push({
        count: row.count || 0,
        post_six: row.post_six || 0,
        first_six: row.first_six || 0
      });
    });

    // For each MGA, compute monthly averages and quarterly/YTD totals
    const result = {};
    const today = new Date();
    
    for (const mga in groupedByMGA) {
      const monthlyAverages = Array(12).fill(0);
      
      for (let m = 0; m < 12; m++) {
        if (groupedByMGA[mga][m]) {
          const monthData = groupedByMGA[mga][m];
          const totalCount = monthData.reduce((sum, week) => sum + week.count, 0);
          const weeksInMonth = monthData.length;
          
          // Calculate average for the month
          const average = weeksInMonth > 0 ? totalCount / weeksInMonth : 0;
          monthlyAverages[m] = Math.round(average);
        } else {
          monthlyAverages[m] = 0;
        }
      }
      
      const Q1 = Math.round((monthlyAverages[0] + monthlyAverages[1] + monthlyAverages[2]) / 3);
      const Q2 = Math.round((monthlyAverages[3] + monthlyAverages[4] + monthlyAverages[5]) / 3);
      const Q3 = Math.round((monthlyAverages[6] + monthlyAverages[7] + monthlyAverages[8]) / 3);
      const Q4 = Math.round((monthlyAverages[9] + monthlyAverages[10] + monthlyAverages[11]) / 3);
      
      let YTD;
      if (selectedYear === today.getFullYear()) {
        const monthsPassed = today.getMonth();
        YTD = monthsPassed === 0 ? 0 : Math.round(
          monthlyAverages.slice(0, monthsPassed).reduce((a, b) => a + b, 0) / monthsPassed
        );
      } else {
        YTD = Math.round(monthlyAverages.reduce((a, b) => a + b, 0) / 12);
      }
      
      result[mga] = { monthly: monthlyAverages, Q1, Q2, Q3, Q4, YTD };
    }
    
    return result;
  };
  
  
  

  const processSubagentUniqueByMGA = (data, selectedYear) => {
    const result = {};
    data.forEach((row) => {
      if (!row.month || typeof row.month !== "string" || !row.month.includes("/")) return;
      const parts = row.month.split("/");
      if (parts.length < 2) return;
      const month = parseInt(parts[0], 10);
      const year = parseInt(parts[1], 10);
      if (year !== selectedYear) return;
      const adjustedMonth = month - 1;
      const mga = row["MGA_NAME"];
      if (!mga) return;
      if (!result[mga]) {
        result[mga] = Array.from({ length: 12 }, () => new Set());
      }
      if (row.LagnName) {
        result[mga][adjustedMonth].add(row.LagnName);
      }
    });
    // Convert each MGA's data into final counts with quarterly and YTD union.
    const final = {};
    Object.keys(result).forEach((mga) => {
      const monthlySets = result[mga];
      const monthlyCounts = monthlySets.map((set) => set.size);
      const q1Set = new Set([...monthlySets[0], ...monthlySets[1], ...monthlySets[2]]);
      const q2Set = new Set([...monthlySets[3], ...monthlySets[4], ...monthlySets[5]]);
      const q3Set = new Set([...monthlySets[6], ...monthlySets[7], ...monthlySets[8]]);
      const q4Set = new Set([...monthlySets[9], ...monthlySets[10], ...monthlySets[11]]);
      const ytdSet = new Set([
        ...monthlySets[0],
        ...monthlySets[1],
        ...monthlySets[2],
        ...monthlySets[3],
        ...monthlySets[4],
        ...monthlySets[5],
        ...monthlySets[6],
        ...monthlySets[7],
        ...monthlySets[8],
        ...monthlySets[9],
        ...monthlySets[10],
        ...monthlySets[11],
      ]);
      final[mga] = {
        monthly: monthlyCounts,
        Q1: q1Set.size,
        Q2: q2Set.size,
        Q3: q3Set.size,
        Q4: q4Set.size,
        YTD: ytdSet.size,
      };
    });
    return final;
  };
  

  // Process ALP data separately since it has a different structure
  useEffect(() => {
    const alpGrouped = processAlpDataForMGA(alpData, selectedYear);
    setFinalAlpData(buildAlpTableRows(alpGrouped, filteredMgaData));
  }, [alpData, selectedYear, filteredMgaData]);

  const vipRows = buildTableRows(vipGrouped);
  const associatesRows = buildTableRows(associatesGrouped);
  const hiresRows = buildTableRows(hiresGrouped);
  const subagentGrouped = processSubAgentDataFromDatabase(subagentData, selectedYear);
  const subagentRows = buildTableRows(subagentGrouped, true);

  // Build inactive MGAs rows
  const vipInactiveRow = buildInactiveMgaRow(vipGrouped);
  const associatesInactiveRow = buildInactiveMgaRow(associatesGrouped);
  const hiresInactiveRow = buildInactiveMgaRow(hiresGrouped);
  const subagentInactiveRow = buildInactiveMgaRow(subagentGrouped, true);

  // Sorting logic – sorts rows based on the selected sort column and order.
  const sortRows = (rows) => {
    const getCellValue = (row, key) => {
      if (key === "mga") return row.mga;
      if (key === "Q1") return row.Q1;
      if (key === "Q2") return row.Q2;
      if (key === "Q3") return row.Q3;
      if (key === "Q4") return row.Q4;
      if (key === "YTD") return row.YTD;
      if (monthOrder.hasOwnProperty(key)) {
        return row.monthlyCounts[monthOrder[key]];
      }
      return null;
    };
    return rows.sort((a, b) => {
      if (sortColumn === "mga") {
        return sortOrder === "asc"
          ? a.mga.localeCompare(b.mga)
          : b.mga.localeCompare(a.mga);
      } else {
        const aValue = getCellValue(a, sortColumn);
        const bValue = getCellValue(b, sortColumn);
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }
    });
  };

  // Apply tree filter.
  const filterRowsByTree = (rows) => {
    if (selectedTreeFilter === "All") return rows;
    return rows.filter((row) => row.treeValue === selectedTreeFilter);
  };

  // Final sorted and filtered rows for each dataset.
  const finalVipRows = sortRows(filterRowsByTree([...vipRows]));
  const finalAlpRows = sortRows(filterRowsByTree([...finalAlpData]));
  const finalAssociatesRows = sortRows(filterRowsByTree([...associatesRows]));
  const finalHiresRows = sortRows(filterRowsByTree([...hiresRows]));
  const finalSubagentRows = sortRows(filterRowsByTree([...subagentRows]));
  const finalHireToCodeRows = useMemo(() => buildHireToCodeRows(finalAssociatesRows, finalHiresRows), [finalAssociatesRows, finalHiresRows]);
  const hireToCodeTotals = useMemo(() => computeRatioTotals(finalHireToCodeRows), [finalHireToCodeRows]);

  // Add inactive rows to the final rows if they exist and inactive MGAs are not being shown
  const addInactiveRows = (rows, inactiveRow) => {
    if (inactiveRow && !showInactiveMgas && inactiveMgaData.length > 0) {
      return [...rows, inactiveRow];
    }
    return rows;
  };

  const finalVipRowsWithInactive = addInactiveRows(finalVipRows, vipInactiveRow);
  const finalAssociatesRowsWithInactive = addInactiveRows(finalAssociatesRows, associatesInactiveRow);
  const finalHiresRowsWithInactive = addInactiveRows(finalHiresRows, hiresInactiveRow);
  const finalSubagentRowsWithInactive = addInactiveRows(finalSubagentRows, subagentInactiveRow);
  // Compute totals for a set of rows (for individual table calculations)
  const computeTotals = (rows) => {
    return rows.reduce(
      (acc, row) => {
        row.monthlyCounts.forEach((count, idx) => {
          acc.monthly[idx] += count;
        });
        acc.Q1 += row.Q1;
        acc.Q2 += row.Q2;
        acc.Q3 += row.Q3;
        acc.Q4 += row.Q4;
        acc.YTD += row.YTD;
        return acc;
      },
      { monthly: Array(12).fill(0), Q1: 0, Q2: 0, Q3: 0, Q4: 0, YTD: 0 }
    );
  };

  // Build table rows using all MGA data (including hidden)
  const buildAllTableRows = (groupedData, isSubagent = false) => {
    console.log(`Building ALL table rows for ${allMgaData.length} MGAs`);
    
    return allMgaData.map((mgaObj) => {
      const mgaName = mgaObj.lagnname;
      let monthlyCounts, Q1, Q2, Q3, Q4, YTD;
      
      if (isSubagent) {
        if (groupedData[mgaName]) {
          monthlyCounts = groupedData[mgaName].monthly;
          Q1 = groupedData[mgaName].Q1;
          Q2 = groupedData[mgaName].Q2;
          Q3 = groupedData[mgaName].Q3;
          Q4 = groupedData[mgaName].Q4;
          YTD = groupedData[mgaName].YTD;
        } else {
          monthlyCounts = Array(12).fill(0);
          Q1 = Q2 = Q3 = Q4 = YTD = 0;
        }
      } else {
        monthlyCounts = groupedData[mgaName] || Array(12).fill(0);
        const totals = calculateQuarterTotals(monthlyCounts, selectedYear === new Date().getFullYear());
        Q1 = totals.Q1;
        Q2 = totals.Q2;
        Q3 = totals.Q3;
        Q4 = totals.Q4;
        YTD = totals.YTD;
      }
      
      return {
        mga: mgaName,
        monthlyCounts,
        Q1,
        Q2,
        Q3,
        Q4,
        YTD,
        treeValue: getTreeValue(mgaObj),
      };
    });
  };

  // Compute totals including ALL MGAs (including hidden ones) for totals row
  const computeAllTotals = (groupedData, isSubagent = false) => {
    const allRows = buildAllTableRows(groupedData, isSubagent);
    return computeTotals(allRows);
  };

  // Compute totals for ALP data including ALL MGAs
  const computeAllAlpTotals = (groupedData) => {
    const allRows = buildAlpTableRows(groupedData, allMgaData);
    return computeTotals(allRows);
  };

  // Header click handler to toggle sorting.
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortOrder("asc");
    }
  };

  // Optional: display a sort indicator arrow next to the header.
  const getSortIndicator = (column) => {
    if (sortColumn === column) {
      return sortOrder === "asc" ? " ▲" : " ▼";
    }
    return "";
  };

  // Helper function to check if a month is in the future


  if (loading) return (
    <div className="atlas-scorecard-loading">
      <div className="loading-spinner"></div>
      <p>Loading scorecard data...</p>
    </div>
  );
  if (error) return (
    <div className="scorecard-error">
      <p>{error}</p>
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  const renderTable = (title, rows, totals) => {
    // Filter headers based on quarters mode and future months
    const filteredHeaders = headers.filter((header, index) => {
      const isQuarter = ["Q1", "Q2", "Q3", "Q4"].includes(header.key);
      const isFuture = monthOrder.hasOwnProperty(header.key) && 
        isMonthInFuture(selectedYear, monthOrder[header.key]);
      
      return shouldShowColumn(index, isQuarter, isFuture, header.key);
    });

    return (
      <div className="atlas-scorecard-section">
        <h4>
          {title} {selectedYear}
        </h4>
        <div className="atlas-scorecard-custom-table-container">
          <table className="atlas-scorecard-custom-table">
            <thead>
              <tr>
                {filteredHeaders.map((header) => (
                  <th
                    key={header.key}
                    className={`${getHeaderClass(header.key)} ${
                      header.key === "Q1" || header.key === "Q2" || header.key === "Q3" || header.key === "Q4" 
                        ? "atlas-scorecard-quarter-header" 
                        : header.key === "YTD" 
                          ? "atlas-scorecard-ytd-header" 
                          : ""
                    }`}
                    onClick={() => handleSort(header.key)}
                  >
                    {header.label}
                    {getSortIndicator(header.key)}
                  </th>
                ))}
              </tr>
            </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.mga}
                className={row.isInactiveRow ? "atlas-scorecard-inactive-row" : ""}
                style={{
                  backgroundColor: row.isInactiveRow 
                    ? "#fff3cd" 
                    : index % 2 === 0 ? "white" : "#f9fafb",
                }}
              >
                {filteredHeaders.map((header) => {
                  // Check if this is a future month for all tables
                  const isFutureCell = monthOrder.hasOwnProperty(header.key) && 
                    isMonthInFuture(selectedYear, monthOrder[header.key]);
                  
                  return (
                    <td 
                      key={header.key} 
                      className={`${getHeaderClass(header.key)} ${
                        header.key === "Q1" || header.key === "Q2" || header.key === "Q3" || header.key === "Q4" 
                          ? "atlas-scorecard-quarter-cell" 
                          : header.key === "YTD" 
                            ? "atlas-scorecard-ytd-cell" 
                            : ""
                      }`}
                    >
                      {isFutureCell ? 
                        "—" : // Display dash for future months
                        (monthOrder.hasOwnProperty(header.key) ?
                          formatCellValue(title, header.key, row.monthlyCounts[monthOrder[header.key]]) :
                          formatCellValue(title, header.key, row[header.key]))
                      }
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Totals Row */}
            <tr className="atlas-scorecard-totals-row">
              <td className="atlas-scorecard-metric-cell">
                <strong>Totals</strong>
              </td>
              {filteredHeaders.slice(1).map((header) => {
                // Check if this is a future month for all tables
                const isFutureCell = monthOrder.hasOwnProperty(header.key) && 
                  isMonthInFuture(selectedYear, monthOrder[header.key]);
                
                let totalValue = 0;
                if (monthOrder.hasOwnProperty(header.key)) {
                  totalValue = totals.monthly[monthOrder[header.key]];
                } else if (
                  header.key === "Q1" ||
                  header.key === "Q2" ||
                  header.key === "Q3" ||
                  header.key === "Q4" ||
                  header.key === "YTD"
                ) {
                  totalValue = totals[header.key];
                }
                
                return (
                  <td 
                    key={header.key} 
                    className={`${getHeaderClass(header.key)} ${
                      header.key === "Q1" || header.key === "Q2" || header.key === "Q3" || header.key === "Q4" 
                        ? "atlas-scorecard-quarter-cell" 
                        : header.key === "YTD" 
                          ? "atlas-scorecard-ytd-cell" 
                          : ""
                    }`}
                  >
                    <strong>
                      {isFutureCell ? 
                        "—" : // Display dash for future months
                        (title === "Net ALP" ?
                          currencyFormatter.format(totalValue) :
                          title === "Hire to Code" ?
                            Number(totalValue).toFixed(2) :
                            totalValue)
                    }
                    </strong>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  // Get unique tree values for the dropdown filter.
  const uniqueTreeValues = [
    "All",
    ...Array.from(new Set(filteredMgaData.map(getTreeValue).filter(val => val && val !== "Unknown"))),
  ];
  
  console.log(`Tree filter options:`, uniqueTreeValues);
  console.log(`Sample MGA tree values:`, filteredMgaData.slice(0, 5).map(m => ({ 
    lagnname: m.lagnname, 
    treeValue: getTreeValue(m)
  })));

  return (
    <div className="atlas-scorecard-sga-view">
      {/* Controls section with left and right alignment */}
      <div className="atlas-scorecard-controls">
        {/* Left side - tree filter dropdown */}
        <div className="atlas-scorecard-controls-left">
          <div className="atlas-scorecard-mga-dropdown">
            <label htmlFor="treeFilter">Filter by Tree: </label>
            <select
              id="treeFilter"
              value={selectedTreeFilter}
              onChange={(e) => setSelectedTreeFilter(e.target.value)}
            >
              {uniqueTreeValues.map((treeVal) => (
                <option key={treeVal} value={treeVal}>
                  {treeVal}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right side - toggle buttons */}
        <div className="atlas-scorecard-controls-right">
          <div className="atlas-scorecard-inactive-toggle">
            <button 
              className={`inactive-mga-toggle-btn ${showInactiveMgas ? 'active' : ''}`}
              onClick={() => setShowInactiveMgas(!showInactiveMgas)}
              title={showInactiveMgas ? 'Hide Inactive MGAs' : 'Show Inactive MGAs'}
            >
              {showInactiveMgas ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              <span style={{ marginLeft: '6px' }}>
                {showInactiveMgas ? 'Hide Inactive' : 'Show Inactive'}
              </span>
            </button>
          </div>

          <div className="atlas-scorecard-future-months-toggle">
            <button 
              className={`future-months-toggle-btn ${showFutureMonths ? 'active' : ''}`}
              onClick={() => setShowFutureMonths(!showFutureMonths)}
              title={showFutureMonths ? 'Hide Future Months' : 'Show Future Months'}
            >
              {showFutureMonths ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="m1 1 22 22 M9.88 9.88a3 3 0 1 0 4.24 4.24 M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68 M6.61 6.61A13.526 13.526 0 0 0 1 12s4 8 11 8a9.74 9.74 0 0 0 5-1.28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>

          <div className="atlas-scorecard-quarters-toggle">
            <button 
              className={`quarters-toggle-btn ${quartersMode}`}
              onClick={() => {
                const nextMode = quartersMode === 'show' ? 'hide' : quartersMode === 'hide' ? 'only' : 'show';
                setQuartersMode(nextMode);
              }}
              title={
                quartersMode === 'show' 
                  ? 'Hide Quarters' 
                  : quartersMode === 'hide' 
                  ? 'Show Only Quarters' 
                  : 'Show All Columns'
              }
            >
              {quartersMode === 'show' ? (
                // Show quarters: Circle with one quarter missing (outline only)
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2 A10 10 0 0 1 22 12 A10 10 0 0 1 12 22 A10 10 0 0 1 2 12 A10 10 0 0 1 12 12 Z" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              ) : quartersMode === 'hide' ? (
                // Hide quarters: Circle with line through it
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2"/>
                </svg>
              ) : (
                // Only quarters: Circle with 3 quarters filled
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <path d="M12 2 A10 10 0 0 1 22 12 L12 12 Z" fill="currentColor"/>
                  <path d="M22 12 A10 10 0 0 1 12 22 L12 12 Z" fill="currentColor"/>
                  <path d="M12 22 A10 10 0 0 1 2 12 L12 12 Z" fill="currentColor"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="atlas-scorecard-tables">
        {renderTable("Net ALP", finalAlpRows, computeAllAlpTotals(processAlpDataForMGA(alpData, selectedYear)))}
        {renderTable("VIPs", finalVipRowsWithInactive, computeAllTotals(vipGrouped))}
        {renderTable(
          "Codes",
          finalAssociatesRowsWithInactive,
          computeAllTotals(associatesGrouped)
        )}
        {renderTable("Hires", finalHiresRowsWithInactive, computeAllTotals(hiresGrouped))}
        {renderTable(
          "Submitting Agent Count",
          finalSubagentRowsWithInactive,
          computeAllTotals(subagentGrouped, true)
        )}
        
        {renderTable("Hire to Code", finalHireToCodeRows, hireToCodeTotals)}
      </div>
    </div>
  );
};

export default ScorecardSGAData;
