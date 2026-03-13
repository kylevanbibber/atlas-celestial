import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import "../../../pages/abc.css";
import Placeholder from "../../utils/Placeholder";

// Helper function to parse MGA start date from MM/DD/YYYY format
const parseMgaStartDate = (startDateString) => {
  if (!startDateString) return null;
  
  try {
    // Handle MM/DD/YYYY format
    const parts = startDateString.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // months are 0-indexed in JS
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  } catch (error) {
  }
  
  return null;
};

// Helper function to check if a date is before the MGA's start date
const isDataBeforeMgaStart = (dataDate, mgaStartDate) => {
  if (!mgaStartDate || !dataDate) return false;
  
  const parsedDataDate = typeof dataDate === 'string' ? new Date(dataDate) : dataDate;
  return parsedDataDate < mgaStartDate;
};

// Helper function to normalize names by removing extra whitespace
const normalizeName = (name) => {
  if (!name) return name;
  // Replace multiple spaces with single space and trim
  return name.replace(/\s+/g, ' ').trim();
};

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

// Helpers to detect month/quarter keys for filtering
const isMonthKey = (key) => Object.prototype.hasOwnProperty.call(monthOrder, key);
const isQuarterKey = (key) => ["Q1","Q2","Q3","Q4"].includes(key);

const calculateQuarterTotals = (counts, isCurrentYear = false) => {
  // Sum months for each quarter
  const val = (i) => Number(counts[i] || 0);
  const Q1 = val(0) + val(1) + val(2);
  const Q2 = val(3) + val(4) + val(5);
  const Q3 = val(6) + val(7) + val(8);
  const Q4 = val(9) + val(10) + val(11);

  // Compute YTD as a sum rather than a single month
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-indexed
  const lastMonthIndex = currentMonth === 0 ? 0 : currentMonth - 1; // If January, use January (0), otherwise use previous month

  let YTD = 0;
  if (isCurrentYear) {
    // Sum from January through the last completed month
    for (let i = 0; i <= lastMonthIndex; i++) {
      YTD += Number(counts[i] || 0);
    }
  } else {
    // Sum all 12 months for past years
    for (let i = 0; i < 12; i++) {
      YTD += Number(counts[i] || 0);
    }
  }

  return { Q1, Q2, Q3, Q4, YTD };
};

// Function to calculate rolling hire to code ratios
const calculateRollingHireToCode = (codesData, hiresData, selectedYear) => {
  
  // Get current date to determine which months are in the future
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  // Check if a month is in the future
  const isFutureMonth = (year, month) => {
    return (year > currentYear) || (year === currentYear && month > currentMonth);
  };
  
  // Generate all week ranges for the selected year and previous year
  const prevYear = selectedYear - 1;
  const weekRanges = generateWeekRanges(selectedYear);
  const prevYearWeekRanges = generateWeekRanges(prevYear);
  
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
    
  });
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
  uniqueField = null,
  mgaStartDates = {} // New parameter to pass MGA start dates
) => {
  const grouped = {};
  const preStartData = {}; // Track data before MGA start dates
  
  data.forEach((item) => {
    const mga = normalizeName(mgaField ? item[mgaField] : (item.mga || item.MGA || "Unknown"));
    if (!item[dateField]) return;

    let dataDate;
    let monthIndex;

    if (dateField === "month") {
      // Monthly-aggregated data (e.g. ALP): we can only include or exclude whole months.
      const parts = item[dateField].split("/");
      if (parts.length < 2) return;
      const month = parseInt(parts[0], 10) - 1;
      const year = parseInt(parts[1], 10);
      if (year !== selectedYear) return;
      dataDate = new Date(year, month, 1);
      monthIndex = dataDate.getMonth();
    } else {
      // Daily-level data: preserve the full date so we can apply per-record start-date filtering.
      const raw = item[dateField];
      let year;
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        // Explicit YYYY-MM-DD format
        const [yStr, mStr, dStr] = raw.split('-');
        year = parseInt(yStr, 10);
        const m = parseInt(mStr, 10) - 1;
        const day = parseInt(dStr, 10);
        dataDate = new Date(year, m, day);
      } else {
        const tmp = new Date(raw);
        year = tmp.getFullYear();
        dataDate = tmp;
      }

      if (year !== selectedYear) return;
      monthIndex = dataDate.getMonth();
    }
    
    // Check if this data should be excluded based on MGA start date
    const mgaStartDate = parseMgaStartDate(mgaStartDates[mga]);
    let shouldExclude = false;
    let isPreStart = false;
    
    if (mgaStartDate) {
      // Only exclude if the data is from a month that's entirely before the start date
      const monthEndDate = new Date(dataDate.getFullYear(), monthIndex + 1, 0); // Last day of the month
      if (monthEndDate < mgaStartDate) {
        shouldExclude = true; // Skip this data entirely
      } else if (dateField !== "month") {
        // For partial months with daily-level data, mark only records before the start date
        isPreStart = dataDate < mgaStartDate;
      }
      // For monthly-aggregated data we cannot split the month, so we treat the entire
      // month as post-start once it intersects the start date.
    }
    
    if (shouldExclude) return; // Skip data from months entirely before start date
    
    // Initialize grouped data structures
    if (grouped[mga] === undefined) {
      if (type === "unique") {
        grouped[mga] = Array.from({ length: 12 }, () => new Set());
        preStartData[mga] = Array.from({ length: 12 }, () => new Set());
      } else {
        grouped[mga] = Array(12).fill(0);
        preStartData[mga] = Array(12).fill(0);
      }
    }
    
    // Add to the appropriate bucket (all data and, separately, pre-start subset)
    if (type === "count") {
      grouped[mga][monthIndex] += 1;
      if (isPreStart) {
        preStartData[mga][monthIndex] += 1;
      }
    } else if (type === "sum") {
      const value = parseFloat(item[sumField]) || 0;
      grouped[mga][monthIndex] += value;
      if (isPreStart) {
        preStartData[mga][monthIndex] += value;
      }
    } else if (type === "unique") {
      if (uniqueField && item[uniqueField] !== undefined && item[uniqueField] !== null) {
        grouped[mga][monthIndex].add(item[uniqueField]);
        if (isPreStart) {
          preStartData[mga][monthIndex].add(item[uniqueField]);
        }
      }
    }
  });

  if (type === "unique") {
    // Convert each set to its size.
    for (const mga in grouped) {
      grouped[mga] = grouped[mga].map((set) => set.size);
      preStartData[mga] = preStartData[mga].map((set) => set.size);
    }
  }
  return { grouped, preStartData };
};

const ScorecardSGAData = ({ activeTab: propActiveTab, selectedAgency: propSelectedAgency, onSelectAgency }) => {
  // Get user data from auth context
  const { user } = useAuth();
  const userId = user?.userId;
  
  // Check if user is admin with teamRole="app" - treat as SGA
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
  
  // Use SGA role for app admins, otherwise use actual clname
  const userRole = isAppAdmin ? 'SGA' : user?.clname?.toUpperCase();
  
  // Use prop activeTab if provided, otherwise default to 'mga'
  const activeTab = propActiveTab || 'mga';
  
  // Use "ARIAS SIMON A" as lagnname for app admins, otherwise use actual lagnname
  const agnName = isAppAdmin ? 'ARIAS SIMON A' : user?.lagnname; // Using lagnname as agent name
  
  if (isAppAdmin) {
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
  // Toggle between Hire-to-Code calculation modes
  // 'YTD' (sum of hires / sum of codes; default) vs 'Rolling' (weekly rolling ratios averaged by month)
  const [hireToCodeMode, setHireToCodeMode] = useState('YTD');
  const [showInactiveMgas, setShowInactiveMgas] = useState(false);
  const [showFutureMonths, setShowFutureMonths] = useState(true);
  const [quartersMode, setQuartersMode] = useState('show'); // 'show', 'hide', 'only'
  const [onlySortedColumn, setOnlySortedColumn] = useState(false); // show only MGA + sorted col
  const [showCommits, setShowCommits] = useState(false); // Toggle between actuals and commits
  const [commitsData, setCommitsData] = useState({}); // Store commits by MGA
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownData, setBreakdownData] = useState({ metric: '', period: '', data: [], rgaName: '' });
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  
  const queryRole = (userRole === "RGA" || userRole === "SGA") ? "MGA" : userRole;
  const selectedMga = null;
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

  // Fetch commits data when showCommits is toggled on (only on MGA breakdown tab)
  useEffect(() => {
    const fetchCommitsData = async () => {
      if (!showCommits || activeTab !== 'mga') {
        return;
      }

      try {
        // Get unique MGA lagnnames from the processed data
        // We'll need to get all MGAs that are being displayed
        const mgaRes = await api.get('/settings/hierarchy/by-clname/MGA');
        const allMgas = mgaRes?.data?.data || [];
        const mgaLagnnames = allMgas
          .filter(mga => {
            const activeValue = String(mga.Active || mga.active || '').trim().toLowerCase();
            const hideValue = String(mga.hide || '').trim().toLowerCase();
            return activeValue !== 'n' && hideValue !== 'y';
          })
          .map(mga => normalizeName(mga.lagnname))
          .filter(Boolean);
        
        if (mgaLagnnames.length === 0) {
          console.warn('📊 No MGAs found to fetch commits for');
          return;
        }


        // Initialize commits data structure for each MGA
        const commitsDataObj = {};
        mgaLagnnames.forEach(lagnname => {
          commitsDataObj[lagnname] = {};
          for (const year of [selectedYear - 1, selectedYear]) {
            commitsDataObj[lagnname][year] = {
              hires: Array(12).fill(null),
              codes: Array(12).fill(null),
              vips: Array(12).fill(null),
              alp: Array(12).fill(null)
            };
          }
        });

        // Fetch commits for each month of the current and previous year
        try {
          // Build params based on user role
          const commitParams = { time_period: 'month', all: 'true' };

          const commitsResponse = await api.get('/commits/admin', { params: commitParams });

          // Process all commits and organize by MGA, year, month, type
          if (commitsResponse?.data?.success) {
            const allCommits = commitsResponse.data.data || [];
            
            // Sort by created_at DESC to get most recent commits first
            allCommits.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            // Log commit lagnnames vs commitsDataObj keys for debugging
            const commitLagnnames = [...new Set(allCommits.map(c => normalizeName(c.lagnname)))];
            const objKeys = Object.keys(commitsDataObj);
            const unmatched = commitLagnnames.filter(n => !commitsDataObj[n]);
            console.log('📊 Commits matching debug:', {
              commitLagnnames,
              commitsDataObjKeys: objKeys,
              unmatchedCommitNames: unmatched
            });

            // Filter to only MGAs we care about and organize
            let commitMatchCount = 0, commitSkipCount = 0;
            allCommits.forEach(commit => {
              const lagnname = normalizeName(commit.lagnname);

              // Only process commits for MGAs in our list
              if (!commitsDataObj[lagnname]) { commitSkipCount++; return; }
              
              // Parse date as local time (not UTC) to avoid timezone shift
              // e.g. '2026-03-01' parsed as UTC would show as Feb in EST
              const startStr = typeof commit.start === 'string' ? commit.start.split('T')[0] : String(commit.start);
              const [yearStr, monthStr] = startStr.split('-');
              const year = parseInt(yearStr, 10);
              const month = parseInt(monthStr, 10) - 1; // 0-indexed (0 = January)
              
              // Only process commits for the years we care about
              if (year === selectedYear || year === selectedYear - 1) {
                const type = commit.type; // 'hires', 'codes', or 'vips'
                
                if (commitsDataObj[lagnname][year] && commitsDataObj[lagnname][year][type]) {
                  // Only set if not already set (keeps most recent due to sort)
                  if (commitsDataObj[lagnname][year][type][month] === null) {
                    commitsDataObj[lagnname][year][type][month] = parseFloat(commit.amount) || 0;
                    commitMatchCount++;
                  }
                }
              }
            });
            console.log(`📊 Commits summary: ${commitMatchCount} matched, ${commitSkipCount} skipped (name not in MGA list)`);
          }

          // Fetch ALL MGA goals for the relevant years
          // Create mapping from userId to lagnname (normalized)
          const userIdToLagnname = {};
          allMgas.forEach(m => {
            if (m.userId) userIdToLagnname[m.userId] = normalizeName(m.lagnname);
          });

          const mgasWithUserId = allMgas.filter(m => m.userId);
          const mgasWithoutUserId = allMgas.filter(m => !m.userId);
          console.log('📊 MGA User ID mapping:', {
            total: allMgas.length,
            withUserId: mgasWithUserId.length,
            withoutUserId: mgasWithoutUserId.length,
            missingUserIds: mgasWithoutUserId.map(m => m.lagnname),
            mapping: userIdToLagnname
          });
          console.log('📊 Fetching ALL goals for years:', [selectedYear - 1, selectedYear]);

          try {
            const bulkGoalsRes = await api.post('/goals/bulk', {
              years: [selectedYear - 1, selectedYear],
              goalType: 'mga'  // Only get MGA-type goals
            });

            const allGoals = bulkGoalsRes?.data || [];
            console.log('📊 Total MGA goals fetched:', allGoals.length);
            console.log('📊 Sample MGA goals:', allGoals.slice(0, 5));

            // Organize goals by MGA, year, month
            let matchedCount = 0, noLagnnameCount = 0, noCommitsObjCount = 0;
            allGoals.forEach(goal => {
              const lagnname = userIdToLagnname[goal.activeUserId];

              if (!lagnname) {
                noLagnnameCount++;
                console.log(`⚠️ Goal skipped - no lagnname mapping for activeUserId ${goal.activeUserId} (year=${goal.year}, month=${goal.month}, alp=${goal.monthlyAlpGoal})`);
                return;
              }

              if (!commitsDataObj[lagnname]) {
                noCommitsObjCount++;
                return;
              }
              
              const year = goal.year;
              const month = goal.month - 1; // Convert to 0-indexed
              
              if (commitsDataObj[lagnname][year] && commitsDataObj[lagnname][year].alp) {
                commitsDataObj[lagnname][year].alp[month] = parseFloat(goal.monthlyAlpGoal) || 0;
                matchedCount++;
                console.log(`✅ Set ALP goal for ${lagnname} ${year}-${month+1}: $${goal.monthlyAlpGoal} (goal.month=${goal.month}, activeUserId=${goal.activeUserId})`);
              }
            });
            console.log(`📊 Goals summary: ${matchedCount} matched, ${noLagnnameCount} skipped (no userId mapping), ${noCommitsObjCount} skipped (not in display list)`);
          } catch (goalsErr) {
            console.error('Failed to fetch bulk goals:', goalsErr);
          }

          setCommitsData(commitsDataObj);
          
          console.log('✅ Commits data loaded for', Object.keys(commitsDataObj).length, 'MGAs');
          
          // Log a sample MGA's commits to verify structure
          const sampleMgaName = Object.keys(commitsDataObj)[0];
          if (sampleMgaName) {
            console.log('\n📋 Sample commits data structure for:', sampleMgaName);
            console.log('  Years:', Object.keys(commitsDataObj[sampleMgaName]));
            console.log('  Data:', JSON.stringify(commitsDataObj[sampleMgaName], null, 2));
          }
        } catch (err) {
          console.error('Failed to fetch commits/goals data:', err);
          setCommitsData({});
        }
      } catch (err) {
        console.error('Error fetching commits data:', err);
      }
    };

    fetchCommitsData();
  }, [showCommits, activeTab, selectedYear]);

  // Reset showCommits when leaving MGA breakdown tab
  useEffect(() => {
    if (activeTab !== 'mga' && showCommits) {
      setShowCommits(false);
    }
  }, [activeTab, showCommits]);

  const processAlpDataForMGA = (data, selectedYear) => {
    
    // First pass: check if each MGA has any "MGA" CL_Name rows for any month
    const hasMgaRows = {};
    data.forEach((item) => {
      if (!item.month || typeof item.month !== "string") return;
      const parts = item.month.split("/");
      if (parts.length < 2) return;
      const monthIndex = parseInt(parts[0], 10) - 1;
      const year = parseInt(parts[1], 10);
      if (year !== selectedYear) return;
      const key = normalizeName(item.LagnName);
      if (!key) return;
      
      const trackerKey = `${key}-${year}-${monthIndex}`;
      const isMga = (item.CL_Name || "").toUpperCase() === "MGA";
      if (isMga) {
        hasMgaRows[trackerKey] = true;
      }
    });
    
    // Second pass: process data with deduplication
    const grouped = {};
    const valueTracker = {}; // Track unique values per MGA per month
    
    data.forEach((item) => {
      if (!item.month || typeof item.month !== "string") return;
      const parts = item.month.split("/");
      if (parts.length < 2) return;
      const monthIndex = parseInt(parts[0], 10) - 1;
      const year = parseInt(parts[1], 10);
      if (year !== selectedYear) return;
      const key = normalizeName(item.LagnName);
      if (!key) return;
      
      // Check if this data should be excluded based on MGA start date
      const mgaStartDate = parseMgaStartDate(mgaStartDates[key]);
      if (mgaStartDate) {
        // For ALP data, we assume it represents the entire month
        // Only exclude if the entire month is before the start date
        const monthEndDate = new Date(year, monthIndex + 1, 0); // Last day of the month
        if (monthEndDate < mgaStartDate) {
          return; // Skip this data entirely
        }
      }
      
      const rawValue = item.LVL_3_NET;
      const cleanedValue =
        parseFloat(
          rawValue.replace(/[$,()]/g, (match) => (match === "(" ? "-" : ""))
        ) || 0;
      
      if (!grouped[key]) {
        grouped[key] = Array(12).fill(0);
      }
      
      // Create tracker key for this MGA/month
      const trackerKey = `${key}-${year}-${monthIndex}`;
      if (!valueTracker[trackerKey]) {
        valueTracker[trackerKey] = new Set();
      }
      
      // Determine if this is an MGA row or blank row
      const isMga = (item.CL_Name || "").toUpperCase() === "MGA";
      const monthHasMgaRows = hasMgaRows[trackerKey];
      
      // Logic matching ScorecardTable.js:
      // - If this month has "MGA" rows: Only count "MGA" rows
      // - If this month has NO "MGA" rows: Count blank rows
      // - Only add unique values (skip duplicates)
      
      if (monthHasMgaRows) {
        // Month has MGA rows - only count MGA designated rows
        if (isMga && !valueTracker[trackerKey].has(cleanedValue)) {
          grouped[key][monthIndex] += cleanedValue;
          valueTracker[trackerKey].add(cleanedValue);
        }
      } else {
        // Month has NO MGA rows - count blank rows
        if (!isMga && !valueTracker[trackerKey].has(cleanedValue)) {
          grouped[key][monthIndex] += cleanedValue;
          valueTracker[trackerKey].add(cleanedValue);
        }
      }
    });
    
    return grouped;
  };
  
  const buildHireToCodeRows = (codesRows, hiresRows, mode = 'YTD') => {
    // Calculate rolling hire to code ratios
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
      
      // Compute YTD based on selected mode
      let YTD = 0;
      const today = new Date();
      const isCurrentYear = selectedYear === today.getFullYear();
      const lastCompletedMonth = isCurrentYear ? Math.max(0, today.getMonth()) : 12; // exclude current month when current year

      if (mode === 'Rolling') {
        // Average of monthly ratios (existing behavior)
        const relevantMonths = monthlyCounts.slice(0, lastCompletedMonth);
      const nonZeroMonths = relevantMonths.filter(v => v > 0).length;
        YTD = nonZeroMonths > 0 
        ? relevantMonths.reduce((a, b) => a + b, 0) / nonZeroMonths 
        : 0;
      } else {
        // YTD ratio = (sum of hires) / (sum of codes) across completed months
        // Use provided rows (already processed for pre-start) to get raw counts
        const codeRow = codesRows.find(r => r.mga === mga);
        const hireRow = hiresRows.find(r => r.mga === mga);
        let sumCodes = 0;
        let sumHires = 0;
        for (let i = 0; i < lastCompletedMonth; i++) {
          const codesVal = (codeRow?.monthlyCounts?.[i] || 0) - (codeRow?.preStartMonthlyCounts?.[i] || 0);
          const hiresVal = (hireRow?.monthlyCounts?.[i] || 0) - (hireRow?.preStartMonthlyCounts?.[i] || 0);
          sumCodes += Math.max(0, codesVal);
          sumHires += Math.max(0, hiresVal);
        }
        YTD = sumCodes > 0 ? (sumHires / sumCodes) : 0;
      }
      
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

  // Specialized function for hire to code totals: sum of all MGAs' hires / sum of all MGAs' codes
  const computeHireToCodeTotals = (hiresRows, codesRows) => {
    
    if (hiresRows.length === 0 || codesRows.length === 0) {
      return { monthly: Array(12).fill(0), Q1: 0, Q2: 0, Q3: 0, Q4: 0, YTD: 0 };
    }

    // Sum up hires and codes for each month from the MGA rows
    const totalHiresMonthly = Array(12).fill(0);
    const totalCodesMonthly = Array(12).fill(0);

    hiresRows.forEach((row) => {
      row.monthlyCounts.forEach((val, idx) => {
        const preStartVal = row.preStartMonthlyCounts?.[idx] || 0;
        totalHiresMonthly[idx] += Math.max(0, val - preStartVal);
      });
    });

    codesRows.forEach((row) => {
      row.monthlyCounts.forEach((val, idx) => {
        const preStartVal = row.preStartMonthlyCounts?.[idx] || 0;
        totalCodesMonthly[idx] += Math.max(0, val - preStartVal);
      });
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Calculate monthly ratios (not used for display but kept for consistency)
    const monthlyRatios = totalHiresMonthly.map((hires, idx) => {
      const codes = totalCodesMonthly[idx];
      const ratio = codes > 0 ? hires / codes : 0;
      return ratio;
    });

    // Calculate quarterly ratios by summing the months in each quarter
    const calculateQuarterRatio = (startMonth, endMonth, quarterName) => {
      let totalHires = 0;
      let totalCodes = 0;
      for (let i = startMonth; i < endMonth; i++) {
        totalHires += totalHiresMonthly[i];
        totalCodes += totalCodesMonthly[i];
      }
      const ratio = totalCodes > 0 ? totalHires / totalCodes : 0;
      return ratio;
    };

    const Q1 = calculateQuarterRatio(0, 3, 'Q1');
    const Q2 = calculateQuarterRatio(3, 6, 'Q2');
    const Q3 = calculateQuarterRatio(6, 9, 'Q3');
    const Q4 = calculateQuarterRatio(9, 12, 'Q4');

    // Calculate YTD by summing YTD months from each MGA
    const today = new Date();
    const isCurrentYear = selectedYear === today.getFullYear();
    const lastCompletedMonth = isCurrentYear ? Math.max(0, today.getMonth()) : 12;
    
    let ytdHires = 0;
    let ytdCodes = 0;
    for (let i = 0; i < lastCompletedMonth; i++) {
      ytdHires += totalHiresMonthly[i];
      ytdCodes += totalCodesMonthly[i];
    }
    const YTD = ytdCodes > 0 ? ytdHires / ytdCodes : 0;

    return { monthly: monthlyRatios, Q1, Q2, Q3, Q4, YTD };
  };
  
  const formatCellValue = (title, key, value, isPreStart = false) => {
    if (key === "mga") return value;
    if (title === "Net ALP" || title === "ALP / Code") return currencyFormatter.format(value);
    if (title === "Hire to Code" || title === "VIP / Code" || title === "Code / VIP") {
      const num = Number(value) || 0;
      return num === 0 ? "—" : num.toFixed(2);
    }
    return value;
  };

  // Helper function to determine if a cell should be greyed out due to pre-start data
  const shouldGreyOutCell = (row, headerKey) => {
    if (!row.mgaStartDate) return false;
    
    const monthIndex = monthOrder[headerKey];
    if (monthIndex !== undefined) {
      // Check if this entire month is before the MGA/RGA start date
      // Only grey out if the entire month is before the start date
      const monthStartDate = new Date(selectedYear, monthIndex, 1);
      const monthEndDate = new Date(selectedYear, monthIndex + 1, 0); // Last day of the month
      
      const isGreyedOut = monthEndDate < row.mgaStartDate;
      
      return isGreyedOut;
    }
    
    return false;
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
    
    // When showing commits, always hide quarters (only show months and YTD)
    if (showCommits && isQuarter) {
      return false;
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
  }, [quartersMode, showFutureMonths, showCommits]);

  // All MGA data for totals calculation (always includes all MGAs)
  const [allMgaData, setAllMgaData] = useState([]);
  const [uniqueRgas, setUniqueRgas] = useState([]);

  // Deduplicate MGAs by lagnname with stable preference and latest start
  const dedupedMgaByName = useMemo(() => {
    if (!allMgaData.length) return new Map();

    const toEpoch = (start) => {
      const d = parseMgaStartDate(start);
      return d ? d.getTime() : -Infinity;
    };

    const score = (mga) => {
      const isActive = mga.Active?.toLowerCase() === 'y';
      const isHidden = mga.hide?.toLowerCase() === 'y';
      // Higher is better: active > inactive; visible > hidden; newer start > older
      return (
        (isActive ? 2 : 0) +
        (!isHidden ? 1 : 0) +
        0 // base; tie-break by start date separately
      );
    };

    const map = new Map();
    allMgaData.forEach((mga) => {
      const key = mga.lagnname;
      if (!key) return;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, mga);
        return;
      }
      const prevScore = score(prev);
      const currScore = score(mga);
      if (currScore > prevScore) {
        map.set(key, mga);
      } else if (currScore === prevScore) {
        // Prefer latest start date when scores tie
        if (toEpoch(mga.start) > toEpoch(prev.start)) {
          map.set(key, mga);
        }
      }
    });
    return map;
  }, [allMgaData]);

  // Create MGA start dates lookup object from deduped set
  const mgaStartDates = useMemo(() => {
    const startDatesLookup = {};
    dedupedMgaByName.forEach((mga, name) => {
      if (name && mga.start) {
        startDatesLookup[name] = mga.start;
      }
    });
    return startDatesLookup;
  }, [dedupedMgaByName]);

  // Fetch all MGAs and RGAs for filtering and totals calculation
  useEffect(() => {
    const fetchAllAgencyData = async () => {
      try {
        // Fetch MGAs
        const mgaRes = await api.get("/dataroutes/get-all-mgas");
        if (mgaRes.data.success) {
          // Normalize lagnname for all MGAs
          const normalizedMgas = (mgaRes.data.data || []).map(mga => ({
            ...mga,
            lagnname: normalizeName(mga.lagnname)
          }));
          setAllMgaData(normalizedMgas);
        }

        // Fetch RGAs
        const rgaRes = await api.get('/settings/hierarchy/by-clname/RGA');
        const rgasData = rgaRes?.data?.data || [];
        // Exclude if hide='y' OR active='n' and normalize lagnname
        const rgas = rgasData
          .filter(item => {
            const activeValue = String(item.active || '').trim().toLowerCase();
            const hideValue = String(item.hide || '').trim().toLowerCase();
            return activeValue !== 'n' && hideValue !== 'y';
          })
          .map(rga => ({
            ...rga,
            lagnname: normalizeName(rga.lagnname)
          }));
        setUniqueRgas(rgas);
      } catch (err) {
      }
    };

    fetchAllAgencyData();
  }, []);

  // Create RGA start dates lookup object
  const rgaStartDates = useMemo(() => {
    const startDatesLookup = {};
    uniqueRgas.forEach((rga) => {
      if (rga.lagnname && rga.start) {
        startDatesLookup[rga.lagnname] = rga.start;
      }
    });
    return startDatesLookup;
  }, [uniqueRgas]);

  // Filter MGA/RGA data based on activeTab - return appropriate list
  const filteredMgaData = useMemo(() => {
    // On RGA breakdown tab, return RGA list
    if (activeTab === 'rga') {
      return uniqueRgas;
    }
    
    // On MGA breakdown or agency tab, use MGA data
    if (dedupedMgaByName.size === 0) {
      return [];
    }

    const result = [];
    let filteredOutByInactive = 0;
    
    dedupedMgaByName.forEach((mga) => {
      const isActive = mga.Active?.toLowerCase() === 'y';
      const isHidden = mga.hide?.toLowerCase() === 'y';
      const clname = (mga.clname || '').toUpperCase();

      // On MGA breakdown, exclude RGAs
      if (activeTab === 'mga' && clname === 'RGA') {
        return;
      }

      if (!showInactiveMgas) {
        // Default view: only active, visible MGAs
        if (isActive && !isHidden) {
          result.push(mga);
        } else {
          filteredOutByInactive++;
        }
      } else {
        // Include one record per MGA (best deduped record)
        result.push(mga);
      }
    });
    
    return result;
  }, [dedupedMgaByName, showInactiveMgas, activeTab, uniqueRgas]);

  // Get inactive MGAs for the "Inactive MGAs" row (disjoint from main list)
  const inactiveMgaData = useMemo(() => {
    if (!allMgaData.length || dedupedMgaByName.size === 0) return [];

    const includedNames = new Set(filteredMgaData.map((m) => m.lagnname));

    // Group by name and pick best record among inactive or hidden ones
    const groups = new Map();
    allMgaData.forEach((mga) => {
      const name = mga.lagnname;
      if (!name || includedNames.has(name)) return; // skip names already included in main list

      const isActive = mga.Active?.toLowerCase() === 'y';
      const isHidden = mga.hide?.toLowerCase() === 'y';
      const isInactiveOrHidden = !isActive || isHidden;
      if (!isInactiveOrHidden) return;

      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(mga);
    });

    const toEpoch = (start) => {
      const d = parseMgaStartDate(start);
      return d ? d.getTime() : -Infinity;
    };
    const pickBest = (records) => {
      return records.reduce((best, curr) => {
        if (!best) return curr;
        const bestHidden = best.hide?.toLowerCase() === 'y';
        const currHidden = curr.hide?.toLowerCase() === 'y';
        if (bestHidden !== currHidden) return currHidden ? best : curr; // prefer visible
        return toEpoch(curr.start) > toEpoch(best.start) ? curr : best; // latest start
      }, null);
    };

    const result = [];
    groups.forEach((records) => {
      const chosen = pickBest(records);
      if (chosen) result.push(chosen);
    });
    return result;
  }, [allMgaData, dedupedMgaByName, filteredMgaData]);

  // Fetch RGA hierarchy to map MGAs to RGAs (only when on RGA breakdown tab)
  // Now stores full MGA objects with metadata (isFirstYear, uplineMGA)
  const [rgaHierarchyMap, setRgaHierarchyMap] = useState(new Map()); // Map<rgaName, Set<mgaNames>>
  const [rgaHierarchyMetadata, setRgaHierarchyMetadata] = useState(new Map()); // Map<rgaName, Map<mgaName, {isFirstYear, uplineMGA}>>
  
  useEffect(() => {
    if (activeTab !== 'rga' || uniqueRgas.length === 0) return;
    
    const fetchRgaHierarchies = async () => {
      const hierarchyMap = new Map();
      const metadataMap = new Map();
      
      try {
        // Fetch hierarchy for each RGA
        const promises = uniqueRgas.map(async (rga) => {
          try {
            const rollupRes = await api.get(`/mga-hierarchy/rga-rollup/${encodeURIComponent(rga.lagnname)}`);
            if (rollupRes?.data?.success) {
              const mgas = rollupRes.data.data.mgas || [];
              // Normalize MGA names from the rollup
              const mgaNames = new Set(mgas.map(m => normalizeName(m.lagnname)).filter(Boolean));
              // Also include the RGA themselves
              mgaNames.add(rga.lagnname);
              hierarchyMap.set(rga.lagnname, mgaNames);
              
              // Store metadata for each MGA (with normalized names)
              const mgaMetadata = new Map();
              mgas.forEach(mga => {
                const normalizedMgaName = normalizeName(mga.lagnname);
                mgaMetadata.set(normalizedMgaName, {
                  isFirstYear: mga.isFirstYear || false,
                  uplineMGA: normalizeName(mga.rga) || null, // The MGA they roll up to
                  rollupReason: mga.rollupReason
                });
              });
              metadataMap.set(rga.lagnname, mgaMetadata);
            }
          } catch (err) {
            // If fetch fails, just include the RGA themselves
            hierarchyMap.set(rga.lagnname, new Set([rga.lagnname]));
            metadataMap.set(rga.lagnname, new Map());
          }
        });
        
        await Promise.all(promises);
        setRgaHierarchyMap(hierarchyMap);
        setRgaHierarchyMetadata(metadataMap);
      } catch (err) {
      }
    };
    
    fetchRgaHierarchies();
  }, [activeTab, uniqueRgas]);

  // Group each dataset by MGA.
  // For VIP, use the "vip_month" field, count occurrences, and use the "mga" field.
  const vipGroupedResult = groupDataByMGA(vipData, "vip_month", selectedYear, "count", "total", "mga", null, mgaStartDates);
  const vipGrouped = vipGroupedResult.grouped;
  const vipPreStartData = vipGroupedResult.preStartData;
  
  // For Associates, use "PRODDATE", count occurrences, and use the "MGA" field.
  const associatesGroupedResult = groupDataByMGA(associatesData, "PRODDATE", selectedYear, "count", "total", "MGA", null, mgaStartDates);
  const associatesGrouped = associatesGroupedResult.grouped;
  const associatesPreStartData = associatesGroupedResult.preStartData;
  
  // For Hires, use "MORE_Date", sum the "Total_Hires" field, and use the "MGA" field.
  const hiresGroupedResult = groupDataByMGA(hiresData, "MORE_Date", selectedYear, "sum", "Total_Hires", "MGA", null, mgaStartDates);
  const hiresGrouped = hiresGroupedResult.grouped;
  const hiresPreStartData = hiresGroupedResult.preStartData;
  
  // For Subagent, use "month", count unique LagnName values, and use the "MGA_NAME" field.

  // Helper function to aggregate MGA data into RGA rollup data
  const aggregateRgaData = (mgaGroupedData, preStartData = {}, rgaStartDatesLookup = {}) => {
    if (activeTab !== 'rga' || rgaHierarchyMap.size === 0) {
      return { grouped: mgaGroupedData, preStart: preStartData };
    }
    
    const rgaAggregated = {};
    
    // For each RGA, sum up data from the RGA themselves + all their MGAs
    // IMPORTANT: Subtract pre-start data at MGA level BEFORE aggregating to avoid negative value issues
    rgaHierarchyMap.forEach((mgaSet, rgaName) => {
      rgaAggregated[rgaName] = Array(12).fill(0);
      
    
      
      // Get RGA start date for filtering
      const rgaStartDate = parseMgaStartDate(rgaStartDatesLookup[rgaName]);
      if (rgaStartDate) {
      }
      
      // Aggregate from the RGA themselves + all MGAs under this RGA
      // Note: mgaSet already includes the RGA themselves, so we don't need to add them separately
      mgaSet.forEach(mgaName => {
        const mgaData = mgaGroupedData[mgaName];
        const mgaPreStartData = preStartData[mgaName];
        
        if (mgaData) {
          // Subtract pre-start at MGA level and apply Math.max(0, ...) before aggregating
          mgaData.forEach((count, monthIdx) => {
            const preStart = mgaPreStartData?.[monthIdx] || 0;
            const validCount = Math.max(0, (count || 0) - preStart);
            rgaAggregated[rgaName][monthIdx] += validCount;
          });
        }
      });
      
      // CRITICAL FIX: Filter aggregated RGA data based on RGA's own start date
      // Zero out any months that are entirely before the RGA's start date
      if (rgaStartDate) {
        rgaAggregated[rgaName] = rgaAggregated[rgaName].map((count, monthIdx) => {
          const monthEndDate = new Date(selectedYear, monthIdx + 1, 0); // Last day of month
          if (monthEndDate < rgaStartDate) {
            return 0;
          }
          return count;
        });
      }
    });
    // Return aggregated data with empty preStart since we've already subtracted it
    return { grouped: rgaAggregated, preStart: {} };
  };
  
  // Apply RGA aggregation if on RGA breakdown tab
  const finalVipData = useMemo(() => aggregateRgaData(vipGrouped, vipPreStartData, rgaStartDates), [vipGrouped, vipPreStartData, activeTab, rgaHierarchyMap, rgaStartDates]);
  const finalAssociatesData = useMemo(() => aggregateRgaData(associatesGrouped, associatesPreStartData, rgaStartDates), [associatesGrouped, associatesPreStartData, activeTab, rgaHierarchyMap, rgaStartDates]);
  const finalHiresData = useMemo(() => aggregateRgaData(hiresGrouped, hiresPreStartData, rgaStartDates), [hiresGrouped, hiresPreStartData, activeTab, rgaHierarchyMap, rgaStartDates]);

  // Build table rows for each dataset by iterating over filtered MGA/RGA records.
  // If an MGA/RGA does not have data, default monthly counts to 0.
  const buildTableRows = (dataResult, isSubagent = false) => {
    const groupedData = dataResult.grouped || dataResult;
    const preStartData = dataResult.preStart || {};
   
    
    return filteredMgaData.map((mgaObj) => {
      const mgaName = mgaObj.lagnname;
      let monthlyCounts, Q1, Q2, Q3, Q4, YTD;
      let preStartMonthlyCounts = Array(12).fill(0);
      
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
        preStartMonthlyCounts = preStartData[mgaName] || Array(12).fill(0);
        
        // For RGA breakdown, pre-start has already been subtracted during aggregation
        // For MGA breakdown, we need to subtract it here
        let validMonthlyCounts;
        if (activeTab === 'rga') {
          // Pre-start already subtracted in aggregateRgaData
          validMonthlyCounts = monthlyCounts;
        } else {
          // Calculate totals excluding pre-start data, ensuring no negative values
          validMonthlyCounts = monthlyCounts.map((total, idx) => Math.max(0, total - preStartMonthlyCounts[idx]));
        }
        
        const totals = calculateQuarterTotals(validMonthlyCounts, selectedYear === new Date().getFullYear());
        Q1 = totals.Q1;
        Q2 = totals.Q2;
        Q3 = totals.Q3;
        Q4 = totals.Q4;
        YTD = totals.YTD;
      }
      
      return {
        mga: mgaName,
        monthlyCounts,
        preStartMonthlyCounts, // Add pre-start data for rendering decisions
        Q1,
        Q2,
        Q3,
        Q4,
        YTD,
        treeValue: getTreeValue(mgaObj),
        mgaStartDate: parseMgaStartDate(mgaObj.start), // Add parsed start date
      };
    });
  };

  // Build inactive MGAs row
  const buildInactiveMgaRow = (groupedData, isSubagent = false) => {
    if (inactiveMgaData.length === 0) return null;
    
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
      const mga = normalizeName(row["MGA_NAME"]);
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
      const mga = normalizeName(row.MGA);
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
      const mga = normalizeName(row["MGA_NAME"]);
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
    let alpGrouped = processAlpDataForMGA(alpData, selectedYear);
    
    // Process ALP data for RGAs if on RGA breakdown tab
    // For ALP: ONLY show RGA's personal production (blank CL_Name rows), NOT their team's ALP
    if (activeTab === 'rga' && rgaHierarchyMap.size > 0) {
      
      // Process raw ALP data for RGAs only (not their MGAs)
      const rgaAlpProcessed = {};
      
      rgaHierarchyMap.forEach((mgaSet, rgaName) => {
        rgaAlpProcessed[rgaName] = Array(12).fill(0);
        
        // Get RGA start date for filtering
        const rgaStartDate = parseMgaStartDate(rgaStartDates[rgaName]);
        
        // Only process data for the RGA themselves, not their MGAs
        const valueTracker = {};
        
        alpData.forEach((item) => {
          if (!item.month || typeof item.month !== "string") return;
          const parts = item.month.split("/");
          if (parts.length < 2) return;
          const monthIndex = parseInt(parts[0], 10) - 1;
          const year = parseInt(parts[1], 10);
          if (year !== selectedYear) return;
          const agentName = normalizeName(item.LagnName);
          
          // ONLY process data for this RGA, skip their MGAs
          if (agentName !== rgaName) return;
          
          const rawValue = item.LVL_3_NET;
          const cleanedValue = parseFloat(rawValue.replace(/[$,()]/g, (match) => (match === "(" ? "-" : ""))) || 0;
          
          const trackerKey = `${agentName}-${year}-${monthIndex}`;
          if (!valueTracker[trackerKey]) {
            valueTracker[trackerKey] = new Set();
          }
          
          // Skip duplicate values
          if (valueTracker[trackerKey].has(cleanedValue)) return;
          
          const isMga = (item.CL_Name || "").toUpperCase() === "MGA";
          
          // For RGA: only count blank rows (personal production as RGA)
          if (!isMga) {
            rgaAlpProcessed[rgaName][monthIndex] += cleanedValue;
            valueTracker[trackerKey].add(cleanedValue);
          }
        });
        
        // CRITICAL FIX: Filter ALP data based on RGA's start date
        // Zero out any months that are entirely before the RGA's start date
        if (rgaStartDate) {
          rgaAlpProcessed[rgaName] = rgaAlpProcessed[rgaName].map((value, monthIdx) => {
            const monthEndDate = new Date(selectedYear, monthIdx + 1, 0); // Last day of month
            if (monthEndDate < rgaStartDate) {
              return 0;
            }
            return value;
          });
        }
        
        const rgaTotal = rgaAlpProcessed[rgaName].reduce((sum, val) => sum + (val || 0), 0);
      });
      
      alpGrouped = rgaAlpProcessed;
    }
    
    setFinalAlpData(buildAlpTableRows(alpGrouped, filteredMgaData));
  }, [alpData, selectedYear, filteredMgaData, activeTab, rgaHierarchyMap, rgaStartDates]);

  // Build commits rows when showing commits
  const buildCommitsRows = useCallback((commitType) => {
    console.log('\n🔷 buildCommitsRows called:', {
      commitType,
      showCommits,
      commitsDataKeys: Object.keys(commitsData),
      commitsDataLength: Object.keys(commitsData).length,
      filteredMgaDataLength: filteredMgaData.length,
      selectedYear
    });

    if (!showCommits || Object.keys(commitsData).length === 0) {
      console.log('❌ Returning empty array - showCommits:', showCommits, 'commitsData length:', Object.keys(commitsData).length);
      return [];
    }

    const rows = filteredMgaData.map((mgaObj, index) => {
      const mgaName = normalizeName(mgaObj.lagnname);
      const mgaCommits = commitsData[mgaName];
      
      console.log(`\n  📊 MGA ${index + 1}/${filteredMgaData.length}: ${mgaName}`);
      console.log(`    - Has commits data:`, !!mgaCommits);
      
      let monthlyCounts = Array(12).fill(0);
      
      if (mgaCommits && mgaCommits[selectedYear] && mgaCommits[selectedYear][commitType]) {
        monthlyCounts = mgaCommits[selectedYear][commitType].map(val => val || 0);
        console.log(`    - Year ${selectedYear} ${commitType} commits:`, monthlyCounts);
      } else {
        console.log(`    - No commits found for ${selectedYear} ${commitType}`);
        if (mgaCommits) {
          console.log(`    - Available years:`, Object.keys(mgaCommits));
          if (mgaCommits[selectedYear]) {
            console.log(`    - Available types for ${selectedYear}:`, Object.keys(mgaCommits[selectedYear]));
          }
        }
      }
      
      // Calculate quarters and YTD from monthly commits
      const Q1 = monthlyCounts[0] + monthlyCounts[1] + monthlyCounts[2];
      const Q2 = monthlyCounts[3] + monthlyCounts[4] + monthlyCounts[5];
      const Q3 = monthlyCounts[6] + monthlyCounts[7] + monthlyCounts[8];
      const Q4 = monthlyCounts[9] + monthlyCounts[10] + monthlyCounts[11];
      
      // YTD: sum up to last completed month
      const today = new Date();
      const currentMonth = today.getMonth();
      const lastMonthIndex = currentMonth === 0 ? 0 : currentMonth - 1;
      let YTD = 0;
      for (let i = 0; i <= lastMonthIndex; i++) {
        YTD += monthlyCounts[i] || 0;
      }
      
      const row = {
        mga: mgaName,
        monthlyCounts,
        Q1,
        Q2,
        Q3,
        Q4,
        YTD,
        preStartMonthlyCounts: Array(12).fill(0), // No pre-start data for commits
        Jan: monthlyCounts[0],
        Feb: monthlyCounts[1],
        Mar: monthlyCounts[2],
        Apr: monthlyCounts[3],
        May: monthlyCounts[4],
        Jun: monthlyCounts[5],
        Jul: monthlyCounts[6],
        Aug: monthlyCounts[7],
        Sep: monthlyCounts[8],
        Oct: monthlyCounts[9],
        Nov: monthlyCounts[10],
        Dec: monthlyCounts[11],
      };
      
      console.log(`    ✅ Row created:`, { mga: mgaName, Jan: row.Jan, Feb: row.Feb, Mar: row.Mar, YTD: row.YTD });
      
      return row;
    });

    console.log(`\n✅ buildCommitsRows returning ${rows.length} rows for ${commitType}`);
    console.log('Sample row:', rows[0]);
    
    return rows;
  }, [showCommits, commitsData, filteredMgaData, selectedYear]);

  console.log('\n🔹 Building table rows:', {
    showCommits,
    activeTab,
    selectedYear,
    commitsDataAvailable: Object.keys(commitsData).length > 0,
    filteredMgaDataCount: filteredMgaData.length
  });

  // Build ALP rows with commits if showing commits
  const alpRowsForCommits = showCommits ? buildCommitsRows('alp') : [];
  const vipRows = showCommits ? buildCommitsRows('vips') : buildTableRows(finalVipData, false);
  const associatesRows = showCommits ? buildCommitsRows('codes') : buildTableRows(finalAssociatesData, false);
  const hiresRows = showCommits ? buildCommitsRows('hires') : buildTableRows(finalHiresData, false);
  
  console.log('📋 Rows built:', {
    showCommits,
    alpRowsCount: alpRowsForCommits.length,
    vipRowsCount: vipRows.length,
    associatesRowsCount: associatesRows.length,
    hiresRowsCount: hiresRows.length,
    sampleVipRow: vipRows[0],
    sampleAlpRow: alpRowsForCommits[0]
  });
  
  // Process and aggregate subagent data
  let subagentGrouped = processSubAgentDataFromDatabase(subagentData, selectedYear);
  
  // Aggregate subagent data for RGAs if on RGA breakdown tab
  if (activeTab === 'rga' && rgaHierarchyMap.size > 0) {
    const rgaSubagentAggregated = {};
    
    rgaHierarchyMap.forEach((mgaSet, rgaName) => {
      const monthlyTotals = Array(12).fill(0);
      let q1Count = 0, q2Count = 0, q3Count = 0, q4Count = 0, ytdCount = 0;
      let q1Months = 0, q2Months = 0, q3Months = 0, q4Months = 0, ytdMonths = 0;
      
      // Get RGA start date for filtering
      const rgaStartDate = parseMgaStartDate(rgaStartDates[rgaName]);
      
      // Aggregate from the RGA themselves + all MGAs under this RGA
      // Note: mgaSet already includes the RGA themselves, so we don't need to add them separately
      mgaSet.forEach(mgaName => {
        const mgaSubagentData = subagentGrouped[mgaName];
        const isSelf = mgaName === rgaName;
        
        if (mgaSubagentData) {
          // Sum monthly averages
          mgaSubagentData.monthly.forEach((avg, monthIdx) => {
            if (avg > 0) {
              monthlyTotals[monthIdx] += avg;
            }
          });
          
          // Aggregate quarters (sum, we'll average later)
          if (mgaSubagentData.Q1 > 0) { q1Count += mgaSubagentData.Q1; q1Months++; }
          if (mgaSubagentData.Q2 > 0) { q2Count += mgaSubagentData.Q2; q2Months++; }
          if (mgaSubagentData.Q3 > 0) { q3Count += mgaSubagentData.Q3; q3Months++; }
          if (mgaSubagentData.Q4 > 0) { q4Count += mgaSubagentData.Q4; q4Months++; }
          if (mgaSubagentData.YTD > 0) { ytdCount += mgaSubagentData.YTD; ytdMonths++; }
        }
      });
      
      // CRITICAL FIX: Filter Subagent data based on RGA's start date
      // Zero out any months that are entirely before the RGA's start date
      if (rgaStartDate) {
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
          const monthEndDate = new Date(selectedYear, monthIdx + 1, 0); // Last day of month
          if (monthEndDate < rgaStartDate) {
            monthlyTotals[monthIdx] = 0;
          }
        }
      }
      
      // Average the quarterly data
      const Q1 = q1Months > 0 ? q1Count / q1Months : 0;
      const Q2 = q2Months > 0 ? q2Count / q2Months : 0;
      const Q3 = q3Months > 0 ? q3Count / q3Months : 0;
      const Q4 = q4Months > 0 ? q4Count / q4Months : 0;
      const YTD = ytdMonths > 0 ? ytdCount / ytdMonths : 0;
      
      rgaSubagentAggregated[rgaName] = {
        monthly: monthlyTotals,
        Q1, Q2, Q3, Q4, YTD
      };
    });
    subagentGrouped = rgaSubagentAggregated;
  }
  
  const subagentRows = buildTableRows(subagentGrouped, true);

  // Build inactive MGAs rows (skip when showing commits)
  const vipInactiveRow = showCommits ? null : buildInactiveMgaRow(vipGrouped);
  const associatesInactiveRow = showCommits ? null : buildInactiveMgaRow(associatesGrouped);
  const hiresInactiveRow = showCommits ? null : buildInactiveMgaRow(hiresGrouped);
  const subagentInactiveRow = showCommits ? null : buildInactiveMgaRow(subagentGrouped, true);

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
        // For RGA breakdown, pre-start already subtracted during aggregation
        const monthValue = row.monthlyCounts[monthOrder[key]];
        if (activeTab === 'rga') {
          return monthValue;
        }
        // For MGA breakdown, subtract pre-start data to match displayed values
        const preStartValue = row.preStartMonthlyCounts?.[monthOrder[key]] || 0;
        return Math.max(0, monthValue - preStartValue);
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

  // Apply tree filter for agency tab, or agency filter for breakdown tabs
  const filterRows = (rows) => {
    if (activeTab === 'agency') {
      // On agency tab, apply tree filter
      if (selectedTreeFilter === "All") return rows;
      return rows.filter((row) => row.treeValue === selectedTreeFilter);
    } else {
      // On breakdown tabs, filter by selected agency or show all
      if (propSelectedAgency && propSelectedAgency !== 'All') {
        return rows.filter((row) => row.mga === propSelectedAgency);
      }
      return rows;
    }
  };

  // Final sorted and filtered rows for each dataset.
  const finalVipRows = sortRows(filterRows([...vipRows]));
  // Use commits rows for ALP when showing commits (ALP goals from production_goals table)
  const finalAlpRows = showCommits ? sortRows(filterRows([...alpRowsForCommits])) : sortRows(filterRows([...finalAlpData]));
  const finalAssociatesRows = sortRows(filterRows([...associatesRows]));
  const finalHiresRows = sortRows(filterRows([...hiresRows]));
  const finalSubagentRows = sortRows(filterRows([...subagentRows]));
  
  console.log('📦 Final rows prepared:', {
    showCommits,
    finalVipRowsCount: finalVipRows.length,
    finalAssociatesRowsCount: finalAssociatesRows.length,
    finalHiresRowsCount: finalHiresRows.length,
    sampleFinalVipRow: finalVipRows[0],
    sampleFinalAssociatesRow: finalAssociatesRows[0],
    sampleFinalHiresRow: finalHiresRows[0]
  });
  const finalHireToCodeRows = useMemo(
    () => sortRows(buildHireToCodeRows(finalAssociatesRows, finalHiresRows, hireToCodeMode)),
    [finalAssociatesRows, finalHiresRows, sortColumn, sortOrder, hireToCodeMode]
  );

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
  
  // Calculate hire to code totals by summing all MGAs' hires and codes
  // Uses the same rows as displayed in the table (respects MGA start dates and filtering)
  const hireToCodeTotals = useMemo(
    () => computeHireToCodeTotals(finalHiresRowsWithInactive, finalAssociatesRowsWithInactive),
    [finalHiresRowsWithInactive, finalAssociatesRowsWithInactive]
  );
  
  const finalVipCodeRows = useMemo(
    () => sortRows(buildVipCodeRows(finalVipRowsWithInactive, finalAssociatesRowsWithInactive)),
    [finalVipRowsWithInactive, finalAssociatesRowsWithInactive, sortColumn, sortOrder]
  );
  const finalAlpCodeRows = useMemo(
    () => sortRows(buildAlpCodeRows(finalAlpRows, finalAssociatesRowsWithInactive)),
    [finalAlpRows, finalAssociatesRowsWithInactive, sortColumn, sortOrder]
  );
  // Compute totals for a set of rows (for individual table calculations)
  const computeTotals = (rows) => {
    return rows.reduce(
      (acc, row) => {
        row.monthlyCounts.forEach((count, idx) => {
          // Subtract pre-start data from totals
          const preStartCount = row.preStartMonthlyCounts ? row.preStartMonthlyCounts[idx] : 0;
          acc.monthly[idx] += (count - preStartCount);
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

  // Build VIP/Code rows (per MGA: monthly ratio = VIPs / Codes, quarter/YTD as averages)
  function buildVipCodeRows(vipRowsIn, codeRowsIn) {
    // Map by MGA for quick lookup
    const codeByMga = new Map(codeRowsIn.map(r => [r.mga, r]));
    const rows = vipRowsIn.map(vr => {
      const cr = codeByMga.get(vr.mga);
      const monthlyRatios = Array(12).fill(0);
      const now = new Date();
      const isCurrentYear = selectedYear === now.getFullYear();
      const lastCompletedMonth = isCurrentYear ? Math.max(0, now.getMonth()) : 12; // exclude current month when current year

      // Calculate monthly ratios (Code / VIP)
      for (let i = 0; i < 12; i++) {
        const vipVal = (vr.monthlyCounts?.[i] || 0) - (vr.preStartMonthlyCounts?.[i] || 0);
        const codeVal = (cr?.monthlyCounts?.[i] || 0) - (cr?.preStartMonthlyCounts?.[i] || 0);
        monthlyRatios[i] = vipVal > 0 ? (codeVal / vipVal) : 0;
      }

      // Helper to average non-zero entries in a slice (if none, 0)
      const avgSlice = (arr, start, end) => {
        const slice = arr.slice(start, end).filter(v => v > 0);
        if (slice.length === 0) return 0;
        return slice.reduce((a,b)=>a+b,0) / slice.length;
      };

      const Q1 = avgSlice(monthlyRatios, 0, 3);
      const Q2 = avgSlice(monthlyRatios, 3, 6);
      const Q3 = avgSlice(monthlyRatios, 6, 9);
      const Q4 = avgSlice(monthlyRatios, 9, 12);

      let YTD;
      if (isCurrentYear) {
        const ytdSlice = monthlyRatios.slice(0, lastCompletedMonth);
        const nonZero = ytdSlice.filter(v => v > 0);
        YTD = nonZero.length > 0 ? nonZero.reduce((a,b)=>a+b,0) / nonZero.length : 0;
      } else {
        const nonZero = monthlyRatios.filter(v => v > 0);
        YTD = nonZero.length > 0 ? nonZero.reduce((a,b)=>a+b,0) / nonZero.length : 0;
      }

      return {
        mga: vr.mga,
        monthlyCounts: monthlyRatios,
        preStartMonthlyCounts: Array(12).fill(0), // not used for ratios in rendering
        Q1, Q2, Q3, Q4, YTD,
        treeValue: vr.treeValue
      };
    });
    return rows;
  }

  // Build ALP/Code rows (per MGA: monthly ratio = ALP / Codes, quarter/YTD as averages)
  function buildAlpCodeRows(alpRowsIn, codeRowsIn) {
    const codeByMga = new Map(codeRowsIn.map(r => [r.mga, r]));
    const rows = alpRowsIn.map(ar => {
      const cr = codeByMga.get(ar.mga);
      const now = new Date();
      const isCurrentYear = selectedYear === now.getFullYear();
      const lastCompletedMonth = isCurrentYear ? Math.max(0, now.getMonth()) : 12; // exclude current month when current year
      // Sum ALP and Codes across the year (exclude current month if current year)
      let sumAlp = 0;
      let sumCodes = 0;
      const monthsToConsider = lastCompletedMonth; // already excludes current month when current year
      for (let i = 0; i < (isCurrentYear ? monthsToConsider : 12); i++) {
        const alpVal = (ar.monthlyCounts?.[i] || 0);
        const codeVal = ((cr?.monthlyCounts?.[i] || 0) - (cr?.preStartMonthlyCounts?.[i] || 0));
        sumAlp += alpVal;
        sumCodes += codeVal > 0 ? codeVal : 0;
      }
      const YTD = sumCodes > 0 ? (sumAlp / sumCodes) : 0;

      return {
        mga: ar.mga,
        monthlyCounts: Array(12).fill(0),
        preStartMonthlyCounts: Array(12).fill(0),
        Q1: 0, Q2: 0, Q3: 0, Q4: 0, YTD,
        treeValue: ar.treeValue
      };
    });
    return rows;
  }

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

  // Handle cell click to show breakdown (only for RGA breakdown tab)
  const handleCellClick = (metricType, period, clickedRow) => {
    // Only show breakdown for RGA tab
    if (activeTab !== 'rga') {
      return;
    }
    
    // Don't show breakdown for ALP table
    if (metricType === 'Net ALP') {
      return;
    }
    
    // For RGA breakdown, we need to use the underlying MGA-level data (before aggregation)
    let sourceGroupedData = {};
    let sourcePreStartData = {};
    
    if (metricType === 'VIPs') {
      sourceGroupedData = vipGrouped;
      sourcePreStartData = vipPreStartData;
    } else if (metricType === 'Codes') {
      sourceGroupedData = associatesGrouped;
      sourcePreStartData = associatesPreStartData;
    } else if (metricType === 'Hires') {
      sourceGroupedData = hiresGrouped;
      sourcePreStartData = hiresPreStartData;
    } else if (metricType === 'Net ALP') {
      // For ALP, we need to process the raw data
      sourceGroupedData = processAlpDataForMGA(alpData, selectedYear);
      sourcePreStartData = {};
    }
    
    // Show which MGAs contribute to the clicked RGA
    if (activeTab === 'rga') {
      const breakdown = [];
      const rgaName = clickedRow.mga;
      
      // Get the hierarchy for this specific RGA
      const mgaSet = rgaHierarchyMap.get(rgaName);
      const mgaMetadata = rgaHierarchyMetadata.get(rgaName);
      
      if (!mgaSet) {
        return;
      }
      
      // Get contributions from the RGA themselves and their MGAs
      mgaSet.forEach(mgaName => {
        // Get the MGA-level data (not aggregated)
        const mgaMonthlyData = sourceGroupedData[mgaName];
        const mgaPreStartData = sourcePreStartData[mgaName];
        
        if (!mgaMonthlyData) {
          return;
        }
        
        let value = 0;
        
        // Get value for the specific period, ensuring no negative values
        if (monthOrder.hasOwnProperty(period)) {
          const monthIdx = monthOrder[period];
          value = Math.max(0, (mgaMonthlyData[monthIdx] || 0) - (mgaPreStartData?.[monthIdx] || 0));
        } else if (period === 'Q1') {
          for (let i = 0; i < 3; i++) {
            value += Math.max(0, (mgaMonthlyData[i] || 0) - (mgaPreStartData?.[i] || 0));
          }
        } else if (period === 'Q2') {
          for (let i = 3; i < 6; i++) {
            value += Math.max(0, (mgaMonthlyData[i] || 0) - (mgaPreStartData?.[i] || 0));
          }
        } else if (period === 'Q3') {
          for (let i = 6; i < 9; i++) {
            value += Math.max(0, (mgaMonthlyData[i] || 0) - (mgaPreStartData?.[i] || 0));
          }
        } else if (period === 'Q4') {
          for (let i = 9; i < 12; i++) {
            value += Math.max(0, (mgaMonthlyData[i] || 0) - (mgaPreStartData?.[i] || 0));
          }
        } else if (period === 'YTD') {
          const today = new Date();
          const currentMonth = today.getMonth(); // 0-indexed
          const isCurrentYear = today.getFullYear() === selectedYear;
          
          if (isCurrentYear) {
            // Sum from January through the last completed month (exclude current month)
            const lastMonthIndex = currentMonth === 0 ? 0 : currentMonth - 1;
            for (let i = 0; i <= lastMonthIndex; i++) {
              value += Math.max(0, (mgaMonthlyData[i] || 0) - (mgaPreStartData?.[i] || 0));
            }
          } else {
            // Sum all 12 months for past years
            for (let i = 0; i < 12; i++) {
              value += Math.max(0, (mgaMonthlyData[i] || 0) - (mgaPreStartData?.[i] || 0));
            }
          }
        }
        
        // Get metadata for this MGA (if not the RGA themselves)
        const metadata = mgaMetadata?.get(mgaName);
        
        breakdown.push({
          lagnname: mgaName,
          value,
          isSelf: mgaName === rgaName,
          isFirstYearRollup: metadata?.isFirstYear || false,
          uplineMGA: metadata?.uplineMGA || null
        });
      });
      
      // Sort: self first, then by value descending
      breakdown.sort((a, b) => {
        if (a.isSelf !== b.isSelf) {
          return a.isSelf ? -1 : 1;
        }
        return b.value - a.value;
      });
      
      setBreakdownData({
        metric: metricType,
        period: period,
        data: breakdown,
        rgaName: rgaName  // Add RGA name for modal title
      });
      setShowBreakdownModal(true);
    }
  };

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

  // Function to copy table data to clipboard
  const copyTableData = (title, rows, totals, filteredHeaders) => {
    // Build header row
    const headerRow = filteredHeaders.map(h => h.label).join('\t');
    
    // Build data rows
    const dataRows = rows.map(row => {
      return filteredHeaders.map(header => {
        const isFutureCell = monthOrder.hasOwnProperty(header.key) && 
          isMonthInFuture(selectedYear, monthOrder[header.key]);
        const isGreyedOut = shouldGreyOutCell(row, header.key);
        
        if (isFutureCell || isGreyedOut) {
          return '—';
        }
        
        if (monthOrder.hasOwnProperty(header.key)) {
          // For RGA breakdown, pre-start already subtracted during aggregation
          const value = activeTab === 'rga' 
            ? row.monthlyCounts[monthOrder[header.key]]
            : Math.max(0, row.monthlyCounts[monthOrder[header.key]] - (row.preStartMonthlyCounts?.[monthOrder[header.key]] || 0));
          return formatCellValue(title, header.key, value).toString().replace(/[$,]/g, '');
        }
        
        return formatCellValue(title, header.key, row[header.key]).toString().replace(/[$,]/g, '');
      }).join('\t');
    }).join('\n');
    
    // Build totals row
    const totalsRow = filteredHeaders.map((header, idx) => {
      if (idx === 0) return 'Totals';
      
      const isFutureCell = monthOrder.hasOwnProperty(header.key) && 
        isMonthInFuture(selectedYear, monthOrder[header.key]);
      
      if (isFutureCell) return '—';
      
      let totalValue = 0;
      if (monthOrder.hasOwnProperty(header.key)) {
        totalValue = totals.monthly[monthOrder[header.key]];
      } else if (["Q1", "Q2", "Q3", "Q4", "YTD"].includes(header.key)) {
        totalValue = totals[header.key];
      }
      
      if (title === "Net ALP") {
        return totalValue.toString();
      } else if (title === "Hire to Code") {
        return Number(totalValue).toFixed(2);
      }
      return totalValue.toString();
    }).join('\t');
    
    // Combine all parts
    const fullData = `${title} ${selectedYear}\n${headerRow}\n${dataRows}\n${totalsRow}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(fullData).then(() => {
      // Optional: Show a brief success message
    }).catch(err => {
    });
  };

  const renderTable = (title, rows, totals) => {
    // Filter headers based on quarters mode and future months
    let filteredHeaders = headers.filter((header, index) => {
      const isQuarter = ["Q1", "Q2", "Q3", "Q4"].includes(header.key);
      const isFuture = monthOrder.hasOwnProperty(header.key) && 
        isMonthInFuture(selectedYear, monthOrder[header.key]);
      
      return shouldShowColumn(index, isQuarter, isFuture, header.key);
    });

    // If toggled and sorting by a month, quarter, or YTD, show only MGA and that column
    if (onlySortedColumn && (isMonthKey(sortColumn) || isQuarterKey(sortColumn) || sortColumn === 'YTD')) {
      filteredHeaders = headers.filter(h => h.key === 'mga' || h.key === sortColumn);
    }

    return (
      <div className="atlas-scorecard-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4>
          {title} {selectedYear}
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {title === "Hire to Code" && (
            <button
              onClick={() => setHireToCodeMode(hireToCodeMode === 'Rolling' ? 'YTD' : 'Rolling')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: '500',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: hireToCodeMode === 'YTD' ? '#3b82f6' : '#ffffff',
                color: hireToCodeMode === 'YTD' ? '#ffffff' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title={hireToCodeMode === 'Rolling' ? 'Switch to YTD View' : 'Switch to Rolling View'}
            >
              {hireToCodeMode === 'Rolling' ? 'Switch to YTD' : 'Switch to Rolling'}
            </button>
          )}
        <button
          onClick={() => copyTableData(title, rows, totals, filteredHeaders)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#666',
            fontSize: '14px'
          }}
          title="Copy table data"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        </div>
        </div>
        <div className="atlas-scorecard-custom-table-container">
          <table className="atlas-scorecard-custom-table">
            <thead>
              <tr>
                {filteredHeaders.map((header) => {
                  const isSortedCol = sortColumn === header.key;
                  const baseHeaderStyle = header.key === 'mga'
                    ? { position: 'sticky', left: 0, zIndex: 3, background: '#ffffff' }
                    : {};
                  const highlightStyle = isSortedCol ? { background: '#FFE5CC' } : {};
                  
                  // Change first column label based on active tab
                  let displayLabel = header.label;
                  if (header.key === 'mga') {
                    if (activeTab === 'agency') {
                      displayLabel = 'Agency';
                    } else if (activeTab === 'mga') {
                      displayLabel = 'MGA';
                    } else if (activeTab === 'rga') {
                      displayLabel = 'RGA';
                    }
                  }
                  
                  return (
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
                      style={{ ...baseHeaderStyle, ...highlightStyle }}
                    >
                      {displayLabel}
                      {getSortIndicator(header.key)}
                    </th>
                  );
                })}
              </tr>
            </thead>
          <tbody>
            {/* On agency tab, hide individual rows - only show totals */}
            {activeTab !== 'agency' && rows.map((row, index) => (
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
                  
                  // Check if this cell should be greyed out due to pre-start data
                  const isGreyedOut = shouldGreyOutCell(row, header.key);
                  const rowBg = row.isInactiveRow 
                    ? "#fff3cd" 
                    : index % 2 === 0 ? "white" : "#f9fafb";
                  const isSortedCol = sortColumn === header.key;
                  
                  const isClickable = activeTab === 'rga' && title !== 'Net ALP' && header.key !== 'mga' && !isFutureCell && !isGreyedOut;
                  
                  return (
                    <td 
                      key={header.key} 
                      className={`${getHeaderClass(header.key)} ${
                        header.key === "Q1" || header.key === "Q2" || header.key === "Q3" || header.key === "Q4" 
                          ? "atlas-scorecard-quarter-cell" 
                          : header.key === "YTD" 
                            ? "atlas-scorecard-ytd-cell" 
                            : ""
                      } ${isGreyedOut ? "atlas-scorecard-pre-start-cell" : ""} ${isClickable ? "has-data" : ""}`}
                      style={{
                        ...(header.key === 'mga'
                          ? { position: 'sticky', left: 0, zIndex: 2, background: isSortedCol ? '#FFEFE0' : rowBg }
                          : (isSortedCol ? { background: '#FFF2E6' } : undefined)),
                        cursor: isClickable ? 'pointer' : 'default'
                      }}
                      onClick={isClickable ? () => handleCellClick(title, header.key, row) : undefined}
                      title={isClickable ? "Click to view breakdown" : ""}
                    >
                      {isFutureCell ? 
                        "—" : // Display dash for future months
                        isGreyedOut ?
                          "—" : // Display dash for entire months before start date
                          (monthOrder.hasOwnProperty(header.key) ?
                            // For RGA breakdown, pre-start already subtracted during aggregation
                            formatCellValue(title, header.key, activeTab === 'rga' ? row.monthlyCounts[monthOrder[header.key]] : Math.max(0, row.monthlyCounts[monthOrder[header.key]] - (row.preStartMonthlyCounts?.[monthOrder[header.key]] || 0))) :
                            formatCellValue(title, header.key, row[header.key]))
                      }
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Totals Row - hide for RGA breakdown, ALP, and ALP/Code tables */}
            {activeTab !== 'rga' && title !== 'Net ALP' && title !== 'ALP / Code' && (
            <tr className="atlas-scorecard-totals-row">
              <td className="atlas-scorecard-metric-cell" style={{ position: 'sticky', left: 0, zIndex: 2, background: '#ffffff' }}>
                <strong>{activeTab === 'agency' ? 'Agency Total' : 'Totals'}</strong>
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
                          (title === "Hire to Code" || title === "Code / VIP") ?
                            Number(totalValue).toFixed(2) :
                            totalValue)
                    }
                    </strong>
                  </td>
                );
              })}
            </tr>
            )}
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

  return (
    <div className="atlas-scorecard-sga-view">
      {/* Controls section with left and right alignment */}
      <div className="atlas-scorecard-controls">
        {/* Left side - tree filter dropdown or agency selector */}
        <div className="atlas-scorecard-controls-left">
          {activeTab === 'agency' ? (
            // On Agency tab, show tree filter
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
          ) : (
            // On breakdown tabs, show individual MGA/RGA selector
            <>
              <div className="atlas-scorecard-mga-dropdown">
                <label htmlFor="agencySelector">
                  {activeTab === 'mga' ? 'Select MGA: ' : 'Select RGA: '}
                </label>
                <select
                  id="agencySelector"
                  value={propSelectedAgency || 'All'}
                  onChange={(e) => {
                    if (onSelectAgency) {
                      onSelectAgency(e.target.value);
                    }
                  }}
                >
                  <option value="All">All</option>
                  {filteredMgaData.map((item, index) => (
                    <option key={`agency-${index}`} value={item.lagnname}>
                      {item.lagnname}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Year selector with navigation arrows */}
              <div className="atlas-scorecard-year-selector" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginLeft: '16px'
              }}>
                <button
                  onClick={() => setSelectedYear(selectedYear - 1)}
                  style={{
                    background: '#f0f0f0',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px'
                  }}
                  title="Previous year"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                <span style={{
                  fontWeight: '600',
                  fontSize: '16px',
                  minWidth: '60px',
                  textAlign: 'center',
                  color: '#333'
                }}>
                  {selectedYear}
                </span>
                
                <button
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  disabled={selectedYear >= new Date().getFullYear()}
                  style={{
                    background: selectedYear >= new Date().getFullYear() ? '#e0e0e0' : '#f0f0f0',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: selectedYear >= new Date().getFullYear() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px',
                    opacity: selectedYear >= new Date().getFullYear() ? 0.5 : 1
                  }}
                  title={selectedYear >= new Date().getFullYear() ? "Cannot go beyond current year" : "Next year"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </>
          )}
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

          {/* Toggle between Actuals and Commits - Only show on MGA breakdown tab */}
          {activeTab === 'mga' && (
            <div className="atlas-scorecard-commits-toggle">
              <button 
                className={`commits-toggle-btn ${showCommits ? 'active' : ''}`}
                onClick={() => {
                  console.log('🔘 Commits toggle clicked! Current:', showCommits, '-> New:', !showCommits);
                  setShowCommits(!showCommits);
                }}
                title={showCommits ? 'Show Actuals' : 'Show Commits'}
              >
                {showCommits ? (
                  // Showing commits - display "C" icon
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="bold">C</text>
                  </svg>
                ) : (
                  // Showing actuals - display "A" icon
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="bold">A</text>
                  </svg>
                )}
              </button>
            </div>
          )}

          {(isMonthKey(sortColumn) || isQuarterKey(sortColumn) || sortColumn === 'YTD') && (
            <div className="atlas-scorecard-only-sorted-toggle" style={{ marginLeft: '8px' }}>
              <button 
                className={`only-sorted-toggle-btn ${onlySortedColumn ? 'active' : ''}`}
                onClick={() => setOnlySortedColumn(!onlySortedColumn)}
                title={onlySortedColumn ? 'Show All Columns' : `Show Only ${sortColumn}`}
              >
                {onlySortedColumn ? 'Show All' : `Only ${sortColumn}`}
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="atlas-scorecard-tables">
        {/* ALP goals from production_goals table */}
        {renderTable(
          showCommits ? "Net ALP (Goals)" : "Net ALP", 
          finalAlpRows, 
          computeTotals(finalAlpRows)
        )}
        {renderTable(
          showCommits ? "Hires (Commits)" : "Hires", 
          finalHiresRowsWithInactive, 
          computeTotals(finalHiresRowsWithInactive)
        )}
        {renderTable(
          showCommits ? "Codes (Commits)" : "Codes",
          finalAssociatesRowsWithInactive,
          computeTotals(finalAssociatesRowsWithInactive)
        )}
        {renderTable(
          showCommits ? "VIPs (Commits)" : "VIPs", 
          finalVipRowsWithInactive, 
          computeTotals(finalVipRowsWithInactive)
        )}
        {/* Hide ratio tables when showing commits */}
        {!showCommits && renderTable("Hire to Code", finalHireToCodeRows, hireToCodeTotals)}
        {!showCommits && renderTable("Code / VIP", finalVipCodeRows, computeTotals(finalVipCodeRows))}
        {!showCommits && renderTable("ALP / Code", finalAlpCodeRows.map(r=>({ ...r, monthlyCounts: Array(12).fill(0) })), computeTotals(finalAlpCodeRows))}
        {/* Submitting Agent Count hidden in SGA view */}
      </div>

      {/* Breakdown Modal */}
      {showBreakdownModal && (
        <div 
          className="oo-modal-overlay" 
          onClick={() => setShowBreakdownModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div 
            className="oo-modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>
                {breakdownData.rgaName && `${breakdownData.rgaName} - `}
                {breakdownData.metric} - {breakdownData.period} Breakdown
              </h3>
              <button 
                onClick={() => setShowBreakdownModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
            
            <table className="hierarchyTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#ecf0f1', borderBottom: '2px solid #95a5a6' }}>
                  <th style={{ textAlign: 'left', padding: '8px', border: '1px solid #ddd' }}>MGA</th>
                  <th style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd' }}>
                    {breakdownData.metric === 'Net ALP' ? 'ALP' : breakdownData.metric}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Group data: self first, then direct MGAs, then rollups
                  const selfRows = breakdownData.data.filter(agent => agent.isSelf);
                  const directMGAs = breakdownData.data.filter(agent => !agent.isSelf && !agent.isFirstYearRollup);
                  const rollups = breakdownData.data.filter(agent => agent.isFirstYearRollup);
                  
                  // Group rollups by their upline
                  const grouped = {};
                  rollups.forEach(rollup => {
                    if (rollup.uplineMGA) {
                      if (!grouped[rollup.uplineMGA]) {
                        grouped[rollup.uplineMGA] = [];
                      }
                      grouped[rollup.uplineMGA].push(rollup);
                    }
                  });
                  
                  // Sort direct MGAs by value descending
                  directMGAs.sort((a, b) => b.value - a.value);
                  
                  let rowIndex = 0;
                  let rows = [];
                  
                  // Self first
                  selfRows.forEach(agent => {
                    const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';
                    rows.push(
                      <tr 
                        key={`self-${rowIndex}`}
                        style={{ background: bgColor, borderBottom: '1px solid #eee' }}
                      >
                        <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 600 }}>
                          {agent.lagnname} (You)
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd' }}>
                          {breakdownData.metric === 'Net ALP' 
                            ? currencyFormatter.format(agent.value)
                            : breakdownData.metric === 'Hire to Code' || breakdownData.metric === 'Code / VIP' || breakdownData.metric === 'ALP / Code'
                            ? Number(agent.value).toFixed(2)
                            : agent.value}
                        </td>
                      </tr>
                    );
                    rowIndex++;
                  });
                  
                  // Direct MGAs and their rollups
                  directMGAs.forEach(mga => {
                    const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';
                    rows.push(
                      <tr 
                        key={`mga-${mga.lagnname}-${rowIndex}`}
                        style={{ background: bgColor, borderBottom: '1px solid #eee' }}
                      >
                        <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 500 }}>
                          {mga.lagnname}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd' }}>
                          {breakdownData.metric === 'Net ALP' 
                            ? currencyFormatter.format(mga.value)
                            : breakdownData.metric === 'Hire to Code' || breakdownData.metric === 'Code / VIP' || breakdownData.metric === 'ALP / Code'
                            ? Number(mga.value).toFixed(2)
                            : mga.value}
                        </td>
                      </tr>
                    );
                    rowIndex++;
                    
                    // Add rollups under this MGA
                    const mgaRollups = grouped[mga.lagnname] || [];
                    mgaRollups.forEach(rollup => {
                      const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';
                      rows.push(
                        <tr 
                          key={`rollup-${rollup.lagnname}-${rowIndex}`}
                          style={{ background: bgColor, borderBottom: '1px solid #eee' }}
                        >
                          <td style={{ padding: '8px 8px 8px 24px', border: '1px solid #ddd', fontStyle: 'italic', color: '#666' }}>
                            ↳ {rollup.lagnname}*
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', color: '#666' }}>
                            {breakdownData.metric === 'Net ALP' 
                              ? currencyFormatter.format(rollup.value)
                              : breakdownData.metric === 'Hire to Code' || breakdownData.metric === 'Code / VIP' || breakdownData.metric === 'ALP / Code'
                              ? Number(rollup.value).toFixed(2)
                              : rollup.value}
                          </td>
                        </tr>
                      );
                      rowIndex++;
                    });
                  });
                  
                  return rows;
                })()}
              </tbody>
              <tfoot>
                <tr style={{ background: '#e8f5e9', borderTop: '2px solid #4caf50', fontWeight: 'bold' }}>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>TOTAL</td>
                  <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd' }}>
                    {breakdownData.metric === 'Net ALP' 
                      ? currencyFormatter.format(breakdownData.data.reduce((sum, agent) => sum + agent.value, 0))
                      : breakdownData.metric === 'Hire to Code' || breakdownData.metric === 'Code / VIP' || breakdownData.metric === 'ALP / Code'
                      ? Number(breakdownData.data.reduce((sum, agent) => sum + agent.value, 0)).toFixed(2)
                      : breakdownData.data.reduce((sum, agent) => sum + agent.value, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
            {breakdownData.data.some(agent => agent.isFirstYearRollup) && (
              <p style={{ marginTop: '10px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                * First-year MGA rolling up to their upline
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScorecardSGAData;
