import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import api from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import "../../../pages/abc.css";
import Placeholder from "../../utils/Placeholder";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

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
    console.warn('Failed to parse MGA start date:', startDateString, error);
  }
  
  return null;
};

// Helper function to check if a date is before the MGA's start date
const isDataBeforeMgaStart = (dataDate, mgaStartDate) => {
  if (!mgaStartDate || !dataDate) return false;
  
  const parsedDataDate = typeof dataDate === 'string' ? new Date(dataDate) : dataDate;
  return parsedDataDate < mgaStartDate;
};

// Custom star point plugin
const starPointPlugin = {
  id: 'starPoint',
  beforeDraw: (chart) => {
    const ctx = chart.ctx;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (dataset.starPoints) {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((point, index) => {
          if (dataset.starPoints[index]) {
            const value = dataset.data[index];
            if (value !== null && value !== undefined) {
              const x = point.x;
              const y = point.y;
              
              // Draw star emoji
              ctx.save();
              ctx.font = '16px Arial';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('⭐', x, y);
              ctx.restore();
            }
          }
        });
      }
    });
  }
};

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Register custom star point plugin
ChartJS.register(starPointPlugin);

const Scorecard = memo(({ filterMode = 'mga' }) => {
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
    console.log('🏭 ScorecardTable: App admin detected, using SGA role and ARIAS SIMON A as lagnname', {
      userRole,
      agnName,
      userId: user?.userId
    });
  }

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
const [lastYear, setLastYear] = useState(currentYear - 1);
const today = new Date();

// Memoize helper functions that don't depend on state
const parseDateWithoutTime = useCallback((dateString) => {
  // Extract the date part before the "T"
  const [year, month, day] = dateString.split("T")[0].split("-");
  return new Date(Number(year), Number(month) - 1, Number(day));
}, []);

// Handler to update years based on navigation
const navigateYears = useCallback((direction) => {
  if (direction === "back") {
    setCurrentYear((prev) => {
      const newYear = prev - 1;
      setLastYear(newYear - 1);
      return newYear;
    });
  } else if (direction === "forward") {
    setCurrentYear((prev) => {
      const newYear = prev + 1;
      setLastYear(newYear - 1);
      return newYear;
    });
  }
}, []);

const getMonthYear = useCallback((dateStr) => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${year}`;
}, []);

  const [vipsData, setVipsData] = useState([]);
  const [associatesData, setAssociatesData] = useState([]);
  const [alpData, setAlpData] = useState([]);
  const [hiresData, setHiresData] = useState([]);
  const [rawHiresData, setRawHiresData] = useState([]); // Add raw hires data
  const [subAgentData, setSubAgentData] = useState([]);
  const [selectedCellData, setSelectedCellData] = useState(null); // New state
  const [selectedTableDetails, setSelectedTableDetails] = useState({}); // Track details per table
  const [hierarchyData, setHierarchyData] = useState([]);
  const [filteredHierarchyData, setFilteredHierarchyData] = useState([]); // Filtered hierarchy data
  const [loading, setLoading] = useState(true);
  const [subAgentWeeks, setSubAgentWeeks] = useState({});
  const [rawMgmtHistoryData, setRawMgmtHistoryData] = useState([]);
  const [selectedManagementDetails, setSelectedManagementDetails] = useState(null);
  const [mgmtCountData, setMgmtCountData] = useState({});
  const [error, setError] = useState("");
  
  // Memoize derived values
  const queryRole = useMemo(() => 
    (userRole === "RGA" || userRole === "SGA") ? "MGA" : userRole
  , [userRole]);
  
  const initialSelectedMga = useMemo(() => 
    (userRole === "MGA" || userRole === "RGA") ? agnName : ""
  , [userRole, agnName]);
  
  const [selectedMga, setSelectedMga] = useState(initialSelectedMga);
  
  const allowedRoles = useMemo(() => ["MGA", "RGA", "SGA"], []);
  
  const defaultAlpTab = useMemo(() => 
    (filterMode === 'rga' || userRole === "MGA" || userRole === "RGA" || userRole === "SGA" || userRole === "Admin") ? "LVL_3" : "LVL_1"
  , [userRole, filterMode]);
  
  const [selectedAlpTab, setSelectedAlpTab] = useState(defaultAlpTab);
  useEffect(() => {
    if (filterMode === 'rga') {
      setSelectedAlpTab('LVL_3');
    }
  }, [filterMode]);
  const [showFutureMonths, setShowFutureMonths] = useState(true);
  const [quartersMode, setQuartersMode] = useState('show'); // 'show', 'hide', 'only'
  const [viewMode, setViewMode] = useState('table'); // 'table', 'graph'
  const [rawAlpData, setRawAlpData] = useState([]);
  const [hireToCodeView, setHireToCodeView] = useState('YTD'); // 'Rolling' or 'YTD'
  
  const showAriasOrganization = useMemo(() => 
    userRole === "SGA" || ["ADMIN", "PARTNER", "STAFF"].includes(userRole)
  , [userRole]);
    
  const effectiveAgnName = useMemo(() => {
    // In RGA filter mode, always honor the selected RGA from the dropdown
    if (filterMode === 'rga' && selectedMga) {
      return selectedMga;
    }
    // For MGA/RGA users, use selected MGA if present; otherwise fall back to own name
    if ((userRole === "MGA" || userRole === "RGA") && selectedMga) {
      return selectedMga;
    }
    return agnName;
  }, [userRole, selectedMga, agnName, filterMode]);
  
  const [selectedView, setSelectedView] = useState("a"); // Track the selected view
  const [uniqueMgas, setUniqueMgas] = useState([]); // State for MGA dropdown options
  const [mgaStartDate, setMgaStartDate] = useState(null); // MGA start date for the current user
  
  // Fetch MGA list for dropdown (without start date logic)
  useEffect(() => {
    const fetchMgaList = async () => {
      try {
        if (filterMode === 'rga') {
          // For RGA mode dropdown, fetch all RGAs from MGAs table
          const res = await api.get('/settings/hierarchy/by-clname/RGA');
          const rgasData = res?.data?.data || [];
          // Exclude if hide='y' OR active='n'
          const rgas = rgasData.filter(item => {
            const activeValue = String(item.active || '').trim().toLowerCase();
            const hideValue = String(item.hide || '').trim().toLowerCase();
            return activeValue !== 'n' && hideValue !== 'y';
          });
          setUniqueMgas(rgas);
          
          // Reset selection when switching to RGA mode
          setSelectedMga("");
        } else {
          // For MGA mode, fetch all MGAs using the hierarchy endpoint
          // Get all MGAs in the system (pass 'ARIAS ORGANIZATION' or any high-level identifier)
          const res = await api.get("/dataroutes/get-all-mgas");
          if (res.data.success) {
            // Filter out MGAs where hide='y' OR Active='n' (note: backend returns 'Active' with capital A)
            const mgas = res.data.data.filter(mga => {
              const activeValue = String(mga.Active || mga.active || '').trim().toLowerCase();
              const hideValue = String(mga.hide || '').trim().toLowerCase();
              return activeValue !== 'n' && hideValue !== 'y';
            });
            setUniqueMgas(mgas);
          
            // Reset to ARIAS ORGANIZATION when switching to MGA mode
            if (showAriasOrganization) {
              setSelectedMga("");
            } else if (!mgas.some((mga) => mga.lagnname === agnName)) {
            setSelectedMga("");
          }
        }
        }
      } catch (err) {
        console.error("Error fetching MGA data:", err);
      }
    };
    
    fetchMgaList();
  }, [agnName, filterMode, showAriasOrganization]);
  
  const toggleView = useCallback((view) => {
    setSelectedView(view);
  }, []);

  // Memoize formatting functions
  const formatName = useCallback((name) => {
    if (!name) return null;
    const parts = name.split(" ");
    if (parts.length === 4) {
      const [last, first, middle, suffix] = parts;
      return `${first} ${middle} ${last} ${suffix}`;
    }
    if (parts.length === 3) {
      const [last, first, middle] = parts;
      return `${first} ${last} `;
    }
    return name; // Return as-is if it doesn't match expected patterns
  }, []);
  
  const formatCurrency = useCallback((amount) => {
    if (!amount || isNaN(amount)) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  }, []);
  
  const formatDate = useCallback((dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString("en-US", {
      timeZone: "UTC",
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  }, []);
  
  // Memoize static arrays to prevent recreation on every render
  const months = useMemo(() => [
    "Jan",
    "Feb",
    "Mar",
    "Q1 ",
    "Apr",
    "May",
    "Jun",
    "Q2 ",
    "Jul",
    "Aug",
    "Sep",
    "Q3 ",
    "Oct",
    "Nov",
    "Dec",
    "Q4 ",
    "YTD ",
    `${currentYear - 1}`,
  ], [currentYear]);

  const monthLabels = useMemo(() => [
    "Jan", "Feb", "Mar",  // index 0,1,2
    "Apr", "May", "Jun",  // index 3,4,5
    "Jul", "Aug", "Sep",  // index 6,7,8
    "Oct", "Nov", "Dec",  // index 9,10,11
  ], []);

  const previousYear = useMemo(() => currentYear - 1, [currentYear]);

  // Memoize data processing functions
  const groupByMonthAndYear = useCallback((data, dateField) => {
    if (!Array.isArray(data) || data.length === 0) {
      return {};
    }
    return data.reduce((acc, item) => {
      const date = new Date(item[dateField]);
      const month = date.getUTCMonth();
      const year = date.getUTCFullYear();
      
      // Check if this data should be excluded based on MGA start date
      if (mgaStartDate) {
        // Only exclude if the data is from a month that's entirely before the start date
        const monthEndDate = new Date(year, month + 1, 0); // Last day of the month
        if (monthEndDate < mgaStartDate) {
          return acc; // Skip this data entirely
        }
        
        // For partial months, only count data that's actually after the start date
        if (date < mgaStartDate) {
          return acc; // Skip this individual data point
        }
      }
      
      if (!acc[year]) acc[year] = Array(12).fill(0);
      acc[year][month] += 1;
      
      return acc;
    }, {});
  }, [mgaStartDate]);
  
  const groupTotalHiresByMonthAndYear = useCallback((data, dateField) => {
    if (!Array.isArray(data) || data.length === 0) {
      return {};
    }
    return data.reduce((acc, row) => {
      const date = new Date(row[dateField]);
      const month = date.getMonth();
      const year = date.getFullYear();
      
      // Check if this data should be excluded based on MGA start date
      if (mgaStartDate) {
        // Only exclude if the data is from a month that's entirely before the start date
        const monthEndDate = new Date(year, month + 1, 0); // Last day of the month
        if (monthEndDate < mgaStartDate) {
          return acc; // Skip this data entirely
        }
        
        // For partial months, only count data that's actually after the start date
        if (date < mgaStartDate) {
          return acc; // Skip this individual data point
        }
      }
      
      if (!acc[year]) acc[year] = Array(12).fill(0);
      acc[year][month] += parseFloat(row.Total_Hires) || 0;
      
      return acc;
    }, {});
  }, [mgaStartDate]);
  
  const calculateQuarterSums = useCallback((monthlyData, previousYearData = null, year = null) => {
    // Helper function to check if a month should be excluded due to MGA start date
    const isMonthExcluded = (monthIndex) => {
      if (!mgaStartDate || !year) return false;
      const monthEndDate = new Date(year, monthIndex + 1, 0); // Last day of the month
      return monthEndDate < mgaStartDate;
    };

    // Calculate quarters, excluding pre-start months
    const q1Months = monthlyData.slice(0, 3).filter((_, idx) => !isMonthExcluded(idx));
    const q2Months = monthlyData.slice(3, 6).filter((_, idx) => !isMonthExcluded(idx + 3));
    const q3Months = monthlyData.slice(6, 9).filter((_, idx) => !isMonthExcluded(idx + 6));
    const q4Months = monthlyData.slice(9, 12).filter((_, idx) => !isMonthExcluded(idx + 9));

    const q1 = q1Months.reduce((sum, value) => sum + value, 0);
    const q2 = q2Months.reduce((sum, value) => sum + value, 0);
    const q3 = q3Months.reduce((sum, value) => sum + value, 0);
    const q4 = q4Months.reduce((sum, value) => sum + value, 0);
    const total = q1 + q2 + q3 + q4;
    
    // Calculate previous year sum if data is provided (this means we're calculating for the previous year row)
    const prevYearSum = previousYearData ? previousYearData.filter((_, idx) => !isMonthExcluded(idx)).reduce((sum, value) => sum + value, 0) : 0;

    return [...monthlyData.slice(0, 3), q1, ...monthlyData.slice(3, 6), q2, ...monthlyData.slice(6, 9), q3, ...monthlyData.slice(9, 12), q4, total, prevYearSum];
  }, [mgaStartDate]);

  const calculateQuarterAverages = useCallback((monthlyData, previousYearData = null, year = null) => {
    // Helper function to check if a month should be excluded due to MGA start date
    const isMonthExcluded = (monthIndex) => {
      if (!mgaStartDate || !year) return false;
      const monthEndDate = new Date(year, monthIndex + 1, 0); // Last day of the month
      return monthEndDate < mgaStartDate;
    };

    // Use the last valid month of each quarter for quarter values
    const q1ValidMonths = [0, 1, 2].filter(idx => !isMonthExcluded(idx));
    const q2ValidMonths = [3, 4, 5].filter(idx => !isMonthExcluded(idx));
    const q3ValidMonths = [6, 7, 8].filter(idx => !isMonthExcluded(idx));
    const q4ValidMonths = [9, 10, 11].filter(idx => !isMonthExcluded(idx));

    const q1 = q1ValidMonths.length > 0 ? monthlyData[q1ValidMonths[q1ValidMonths.length - 1]] : 0;
    const q2 = q2ValidMonths.length > 0 ? monthlyData[q2ValidMonths[q2ValidMonths.length - 1]] : 0;
    const q3 = q3ValidMonths.length > 0 ? monthlyData[q3ValidMonths[q3ValidMonths.length - 1]] : 0;
    const q4 = q4ValidMonths.length > 0 ? monthlyData[q4ValidMonths[q4ValidMonths.length - 1]] : 0;
    
    // For YTD: use the current month from last year and this year, but only if it's valid
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-indexed (0 = January, 11 = December)
    const lastMonthIndex = currentMonth === 0 ? 0 : currentMonth - 1; // If January, use January (0), otherwise use previous month
    const ytd = !isMonthExcluded(lastMonthIndex) ? (monthlyData[lastMonthIndex] || 0) : 0;
    
    // Calculate previous year value: use the same month as current year YTD for proper comparison
    const prevYearValue = previousYearData && !isMonthExcluded(lastMonthIndex) ? (previousYearData[lastMonthIndex] || 0) : 0;
    
    return [
      ...monthlyData.slice(0, 3).map((v) => Math.round(v)),
      q1,
      ...monthlyData.slice(3, 6).map((v) => Math.round(v)),
      q2,
      ...monthlyData.slice(6, 9).map((v) => Math.round(v)),
      q3,
      ...monthlyData.slice(9, 12).map((v) => Math.round(v)),
      q4,
      ytd,
      prevYearValue,
    ];
  }, [mgaStartDate]);

  const calculateQuarterValuesForArray = useCallback((monthlyArray, currentYear) => {
    // Helper function to check if a month should be excluded due to MGA start date
    const isMonthExcluded = (monthIndex) => {
      if (!mgaStartDate || !currentYear) return false;
      const monthEndDate = new Date(currentYear, monthIndex + 1, 0); // Last day of the month
      return monthEndDate < mgaStartDate;
    };

    // monthlyArray: array of length 12 with a value for each month.
    // For quarterly columns, pick the value from the last valid month of each quarter
    const q1ValidMonths = [0, 1, 2].filter(idx => !isMonthExcluded(idx));
    const q2ValidMonths = [3, 4, 5].filter(idx => !isMonthExcluded(idx));
    const q3ValidMonths = [6, 7, 8].filter(idx => !isMonthExcluded(idx));
    const q4ValidMonths = [9, 10, 11].filter(idx => !isMonthExcluded(idx));

    const q1 = q1ValidMonths.length > 0 ? monthlyArray[q1ValidMonths[q1ValidMonths.length - 1]] : 0;
    const q2 = q2ValidMonths.length > 0 ? monthlyArray[q2ValidMonths[q2ValidMonths.length - 1]] : 0;
    const q3 = q3ValidMonths.length > 0 ? monthlyArray[q3ValidMonths[q3ValidMonths.length - 1]] : 0;
    const q4 = q4ValidMonths.length > 0 ? monthlyArray[q4ValidMonths[q4ValidMonths.length - 1]] : 0;
  
    // For YTD: if currentYear is the current calendar year, use the value up to the previous month;
    // otherwise, assume full-year data is available (use December).
    const today = new Date();
    const lastMonthIndex = (currentYear === today.getFullYear()) ? Math.max(0, today.getMonth() - 1) : 11;
    const ytd = !isMonthExcluded(lastMonthIndex) ? monthlyArray[lastMonthIndex] : 0;
  
    return [
      monthlyArray[0],
      monthlyArray[1],
      monthlyArray[2],
      q1,         // Q1 column
      monthlyArray[3],
      monthlyArray[4],
      monthlyArray[5],
      q2,         // Q2 column
      monthlyArray[6],
      monthlyArray[7],
      monthlyArray[8],
      q3,         // Q3 column
      monthlyArray[9],
      monthlyArray[10],
      monthlyArray[11],
      q4,         // Q4 column
      ytd         // YTD column
    ];
  }, [mgaStartDate]);
  
  
    const processManagementHistoryDataByRole = useCallback((data) => {
    // Group rows by year and month using reportdate.
    const groups = {};
    data.forEach((row) => {
      if (!row.reportdate) return;
      const d = new Date(row.reportdate);
      const year = d.getFullYear();
      const month = d.getMonth(); // 0-indexed: 0 for Jan, ... 11 for Dec.
      const key = `${year}-${month}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row);
    });

    const roles = ["SA", "GA", "MGA", "RGA"];
    let result = { total: {} };
    roles.forEach(role => {
      result[role] = {};
    });

    Object.keys(groups).forEach((key) => {
      const [yearStr, monthStr] = key.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const group = groups[key];

      // Pick the maximum (latest) reportdate in this group.
      const maxDate = group.reduce(
        (max, row) => {
          const d = new Date(row.reportdate);
          return d > max ? d : max;
        },
        new Date(0)
      );
      // Filter to only rows with that max reportdate.
      const maxRows = group.filter(
        (row) => new Date(row.reportdate).getTime() === maxDate.getTime()
      );

      roles.forEach(role => {
        let count = 0;
        if (role === "MGA") {
          // For MGA count: include both MGA and RGA (since RGAs function as MGAs)
          count = maxRows.filter(row => row.clname === "MGA" || row.clname === "RGA").length;
        } else {
          // For other roles: count only exact matches
          count = maxRows.filter(row => row.clname === role).length;
        }
        if (!result[role][year]) result[role][year] = Array(12).fill(0);
        result[role][year][month] = count;
      });

      // Total count for this month: count unique individuals with any of the allowed roles
      // Use a Set to avoid double-counting RGAs who appear as both MGA and RGA
      const uniqueIndividuals = new Set();
      maxRows.forEach(row => {
        if (roles.includes(row.clname) && row.lagnname) {
          uniqueIndividuals.add(row.lagnname);
        }
      });
      // Count unique individuals (they should already be in the data)
      const totalCount = uniqueIndividuals.size;
      if (!result.total[year]) result.total[year] = Array(12).fill(0);
      result.total[year][month] = totalCount;
    });

    return result;
  }, []);
  
  
  const processAlpData = useCallback((data, userRole, selectedAlpTab, preferNonMga = false) => {
    // For SA, if user clicks on LVL_3 tab, use LVL_2_NET (as SA is level 2)
    // In RGA filter mode we always use team production (LVL_3_NET)
    const column = (filterMode === 'rga')
      ? "LVL_3_NET"
      : selectedAlpTab === "LVL_1"
        ? "LVL_1_NET"
        : userRole === "SA"
          ? "LVL_2_NET"
          : "LVL_3_NET";

    const groupedData = data.reduce((acc, row) => {
      const [month, year] = row.month.split("/").map(Number);
      const adjustedMonth = month - 1;
      
      // Check if this data should be excluded based on MGA start date
      if (mgaStartDate) {
        // For ALP data, we assume it represents the entire month
        // Only exclude if the entire month is before the start date
        const monthEndDate = new Date(year, adjustedMonth + 1, 0); // Last day of the month
        if (monthEndDate < mgaStartDate) {
          return acc; // Skip this data entirely
        }
      }
      
      if (!acc[year]) acc[year] = Array(12).fill(0);
      const value = parseFloat(row[column]?.replace(/[^\d.-]/g, "")) || 0;

      // Prefer non-MGA row when requested (RGA tab requirement). If both exist for the same month,
      // keep the non-MGA value. Otherwise, fallback to whatever is available.
      const isMga = (row.CL_Name || "").toUpperCase() === "MGA";

      if (preferNonMga) {
        // In RGA mode, ignore MGA rows entirely. Only accept non-MGA values.
        if (!isMga) {
          acc[year][adjustedMonth] = value;
        }
      } else {
        // Original behavior: set if zero or if coming from MGA row to override personal
        if (acc[year][adjustedMonth] === 0 || isMga) {
          acc[year][adjustedMonth] = value;
        }
      }
      
      return acc;
    }, {});

    return groupedData;
  }, [mgaStartDate]);
  
    const processSubmittingAgentCount = useCallback((data) => {
    const groupedData = {};
    const weeklyDetails = {};

    data.forEach((row) => {
      if (!row.reportdate) return;
      // Assume reportdate is in "mm/dd/yyyy" format representing the WEEK END date.
      const parts = row.reportdate.split("/");
      if (parts.length < 3) return;
      const endMonth = parseInt(parts[0], 10); // 1-indexed month
      const endDay = parseInt(parts[1], 10);
      const endYear = parseInt(parts[2], 10);
      const endDate = new Date(endYear, endMonth - 1, endDay);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      
      // Check if this data should be excluded based on MGA start date
      if (mgaStartDate) {
        const month = startDate.getMonth();
        const year = startDate.getFullYear();
        
        // Only exclude if the data is from a month that's entirely before the start date
        const monthEndDate = new Date(year, month + 1, 0); // Last day of the month
        if (monthEndDate < mgaStartDate) {
          return; // Skip this data entirely
        }
        
        // For partial months, only count data that's actually after the start date
        if (startDate < mgaStartDate) {
          return; // Skip this individual data point
        }
      }
      
      const year = startDate.getFullYear();
      const month = startDate.getMonth(); // 0-indexed
      const day = startDate.getDate();
      const weekIndex = Math.floor((day - 1) / 7);
      
      if (!groupedData[year]) groupedData[year] = {};
      if (!groupedData[year][month]) groupedData[year][month] = {};
      if (!groupedData[year][month][weekIndex]) {
        groupedData[year][month][weekIndex] = {
          // Use an array instead of a Set so duplicates are included
          agents: [],
          startDate: startDate,
          endDate: endDate,
        };
      }
      if (row.LagnName) {
        groupedData[year][month][weekIndex].agents.push(row.LagnName);
      }
    });

    const monthlyAveragesByYear = {};
    // Prepare weeklyDetails structured as: { [year]: { [month]: [ {startDate, endDate, count}, ... ] } }
    Object.keys(groupedData).forEach((yearKey) => {
      const year = parseInt(yearKey, 10);
      monthlyAveragesByYear[year] = Array(12).fill(0);
      weeklyDetails[year] = {};
      for (let m = 0; m < 12; m++) {
        if (groupedData[year] && groupedData[year][m]) {
          const weekGroups = Object.values(groupedData[year][m]);
          const weeklyCounts = weekGroups.map((group) => group.agents.length);
          const sum = weeklyCounts.reduce((a, b) => a + b, 0);
          const average = weekGroups.length > 0 ? sum / weekGroups.length : 0;
          monthlyAveragesByYear[year][m] = average;
          weeklyDetails[year][m] = weekGroups.map((group) => ({
            startDate: group.startDate,
            endDate: group.endDate,
            count: group.agents.length,
          }));
        } else {
          monthlyAveragesByYear[year] = 0;
          weeklyDetails[year][m] = [];
        }
      }
    });
    return { monthlyAveragesByYear, weeklyDetails };
  }, [mgaStartDate]);

  const processSubAgentDataFromDatabase = useCallback((data) => {
    const monthlyAveragesByYear = {};
    const weeklyDetails = {};

    // Group data by year and month
    const groupedByYearMonth = {};
    
    data.forEach((row) => {
      if (!row.date) return;
      
      // Parse the date string and ensure it's treated as local date, not UTC
      const [yearStr, monthStr, dayStr] = row.date.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1; // Convert to 0-indexed
      
      // Create date object for this data
      const dataDate = new Date(year, month, parseInt(dayStr, 10));
      
      // Check if this data should be excluded based on MGA start date
      if (mgaStartDate) {
        // Only exclude if the data is from a month that's entirely before the start date
        const monthEndDate = new Date(year, month + 1, 0); // Last day of the month
        if (monthEndDate < mgaStartDate) {
          return; // Skip this data entirely
        }
        
        // For partial months, only count data that's actually after the start date
        if (dataDate < mgaStartDate) {
          return; // Skip this individual data point
        }
      }
      
      if (!groupedByYearMonth[year]) {
        groupedByYearMonth[year] = {};
      }
      if (!groupedByYearMonth[year][month]) {
        groupedByYearMonth[year][month] = [];
      }
      
      groupedByYearMonth[year][month].push({
        count: row.count || 0,
        post_six: row.post_six || 0,
        first_six: row.first_six || 0,
        date: row.date
      });
    });

    // Calculate monthly averages and weekly details
    Object.keys(groupedByYearMonth).forEach((yearKey) => {
      const year = parseInt(yearKey, 10);
      monthlyAveragesByYear[year] = Array(12).fill(0);
      weeklyDetails[year] = {};
      
      for (let m = 0; m < 12; m++) {
        if (groupedByYearMonth[year] && groupedByYearMonth[year][m]) {
          const monthData = groupedByYearMonth[year][m];
          const totalCount = monthData.reduce((sum, week) => sum + week.count, 0);
          const weeksInMonth = monthData.length;
          
          // Calculate average for the month
          const average = weeksInMonth > 0 ? totalCount / weeksInMonth : 0;
          monthlyAveragesByYear[year][m] = average;
          
          // Create weekly details
          weeklyDetails[year][m] = monthData.map((week) => ({
            startDate: new Date(week.date + 'T00:00:00'),
            endDate: new Date(week.date + 'T00:00:00'),
            count: week.count,
            post_six: week.post_six,
            first_six: week.first_six
          }));
        } else {
          monthlyAveragesByYear[year][m] = 0;
          weeklyDetails[year][m] = [];
        }
      }
    });
    
    return { monthlyAveragesByYear, weeklyDetails };
  }, [mgaStartDate]);
  
  
  const processSgaAlpData = (data) => {
    // Initialize an empty object to hold year-based arrays.
    const grouped = {};
  
    data.forEach((item) => {
      if (!item.month) return;
      // Expect month to be in "mm/yyyy" format.
      const parts = item.month.split("/");
      if (parts.length !== 2) return;
      const monthIndex = parseInt(parts[0], 10) - 1; // convert to 0-indexed
      const year = parseInt(parts[1], 10);
  
      // If the year doesn't exist, create an array with 12 zeros.
      if (!grouped[year]) {
        grouped[year] = Array(12).fill(0);
      }
      // Map the net value (as a float) into the proper month index.
      grouped[year][monthIndex] = parseFloat(item.net) || 0;
    });
  
    return grouped;
  };
  
  
  const processSubagentData = (data) => {
    // Group data by year and by month (each month gets a Set to collect unique names)
    const groupedData = {};
  
    data.forEach(row => {
      // Use row.month if available; if not, derive it from row.reportdate.
      let monthField = row.month;
      if (!monthField && row.reportdate) {
        monthField = getMonthYear(row.reportdate);
      }
      if (!monthField || typeof monthField !== "string" || !monthField.includes("/")) {
        return;
      }
  
      const [monthStr, yearStr] = monthField.split("/");
      const month = Number(monthStr);
      const year = Number(yearStr);
      if (!month || !year) return;
  
      const adjustedMonth = month - 1; // Convert to 0-index
      if (adjustedMonth < 0 || adjustedMonth > 11) return;
      
      // Check if this data should be excluded based on MGA start date
      if (mgaStartDate) {
        // Only exclude if the data is from a month that's entirely before the start date
        const monthEndDate = new Date(year, adjustedMonth + 1, 0); // Last day of the month
        if (monthEndDate < mgaStartDate) {
          return; // Skip this data entirely
        }
        
        // For subagent data, we assume it represents the entire month
        // so if any part of the month is valid, we include the whole month
      }
  
      // Initialize the year if it doesn't exist.
      if (!groupedData[year]) {
        groupedData[year] = Array.from({ length: 12 }, () => new Set());
      }
  
      if (row.LagnName) {
        groupedData[year][adjustedMonth].add(row.LagnName);
      }
    });
  
    // Convert monthly sets to counts and compute unique counts for quarters and YTD.
    const result = {};
    Object.keys(groupedData).forEach(year => {
      const monthlySets = groupedData[year];
      const monthlyCounts = monthlySets.map(set => set.size);
  
      // Compute unique names for each quarter using set unions.
      const q1Set = new Set([...monthlySets[0], ...monthlySets[1], ...monthlySets[2]]);
      const q2Set = new Set([...monthlySets[3], ...monthlySets[4], ...monthlySets[5]]);
      const q3Set = new Set([...monthlySets[6], ...monthlySets[7], ...monthlySets[8]]);
      const q4Set = new Set([...monthlySets[9], ...monthlySets[10], ...monthlySets[11]]);
      // For YTD, merge all monthly sets.
      const ytdSet = new Set();
      monthlySets.forEach(set => {
        set.forEach(item => ytdSet.add(item));
      });
  
      const resultArray = [
        monthlyCounts[0],
        monthlyCounts[1],
        monthlyCounts[2],
        q1Set.size,
        monthlyCounts[3],
        monthlyCounts[4],
        monthlyCounts[5],
        q2Set.size,
        monthlyCounts[6],
        monthlyCounts[7],
        monthlyCounts[8],
        q3Set.size,
        monthlyCounts[9],
        monthlyCounts[10],
        monthlyCounts[11],
        q4Set.size,
        ytdSet.size
      ];
  
      result[year] = resultArray;
    });
  
    return result;
  };
  

    const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // For RGA or SGA, use "MGA" as the query role; otherwise use userRole
      const queryRole = (userRole === "RGA" || userRole === "SGA") ? "MGA" : userRole;

      console.log('🔍 ScorecardTable fetchData called:', {
        userRole,
        filterMode,
        selectedMga,
        agnName
      });

      if (!agnName || !userRole) {
        console.warn("Waiting for user data to load...");
        return; // Don't throw error, just return early until user data is loaded
      }
  
      // For MGA/RGA use selectedMga if available; for SGA, use dropdown value if selected; otherwise use stored agnName.
      const effectiveAgnName =
        (userRole === "MGA" || userRole === "RGA" || (userRole === "SGA" && selectedMga))
          ? selectedMga || agnName
          : agnName;

      console.log('📊 Effective agent name:', effectiveAgnName);

      // Get the current MGA start date for the effective MGA
      try {
        const mgaResponse = await api.get("/dataroutes/get-all-mgas");
        if (mgaResponse.data.success) {
          const mgas = mgaResponse.data.data;
          const targetMga = mgas.find((mga) => mga.lagnname === effectiveAgnName);
          
          if (targetMga && targetMga.start) {
            const currentMgaStartDate = parseMgaStartDate(targetMga.start);
            setMgaStartDate(currentMgaStartDate);
            console.log(`Updated MGA start date for ${effectiveAgnName}: ${targetMga.start}`, currentMgaStartDate);
          } else {
            setMgaStartDate(null);
            console.log(`No start date found for ${effectiveAgnName}`);
          }
        }
      } catch (mgaError) {
        console.warn("Failed to fetch MGA start date:", mgaError);
        // Continue with data fetch even if MGA start date fails
      }
  
      // Use SGA endpoints when userRole is in the list and no specific MGA is selected, UNLESS we're in RGA filterMode
      const useSgaEndpoints = (["SGA", "MGA", "RGA"].includes(userRole) && !selectedMga) || filterMode === 'rga';
      
      console.log('🎯 Using SGA endpoints:', useSgaEndpoints, '| Filter mode:', filterMode);
  
      const requests = [];
  
      // For RGA mode, fetch hierarchy first to get list of agents
      let agentNamesToFetch = [effectiveAgnName];
      let alpMgaNamesToFetch = [effectiveAgnName];
      if (filterMode === 'rga') {
        console.log('🏢 RGA MODE: Fetching RGA rollup hierarchy for', effectiveAgnName);
        try {
          // Use the same RGA rollup endpoint as OneOnOne.js
          // This gets all MGAs that count for this RGA (including first-year rollups)
          const rollupRes = await api.get(`/mga-hierarchy/rga-rollup/${encodeURIComponent(effectiveAgnName)}`);
          
          if (rollupRes?.data?.success) {
            const mgas = rollupRes.data.data.mgas || [];
            const mgaNames = mgas.map(m => m.lagnname).filter(Boolean);
            
            // For ALP: Use MGAs only (with blank CL_Name in backend)
            alpMgaNamesToFetch = mgaNames;
            
            // For Hires/Codes/VIPs: Include the RGA themselves PLUS all their MGAs
            agentNamesToFetch = [effectiveAgnName, ...mgaNames];
            
            console.log(`✅ RGA rollup for ${effectiveAgnName}:`, {
              total: rollupRes.data.data.totalMGAs,
              direct: rollupRes.data.data.directMGAs,
              firstYear: rollupRes.data.data.firstYearMGAs,
              includingSelf: true,
              mgaNames: mgaNames.length,
              agentNames: agentNamesToFetch.length
            });
            console.log(`✅ RGA mode: fetching ALP data for ${alpMgaNamesToFetch.length} MGAs:`, alpMgaNamesToFetch);
            console.log(`✅ RGA mode: fetching hires/codes/VIPs data for ${agentNamesToFetch.length} agents (RGA + MGAs):`, agentNamesToFetch);
          } else {
            console.warn('⚠️ RGA rollup returned no data, falling back to user only');
          }
        } catch (hierError) {
          console.error('❌ Error fetching RGA rollup hierarchy:', hierError);
          console.warn('Falling back to single user');
        }
      }

      let responses;

      if (filterMode === 'rga') {
        console.log('🚀 Using RGA-specific data fetching logic');
        // For RGA mode, fetch ALP from MGAs (with blank CL_Name) and hires/codes/VIPs from all agents
        
        console.log('=== RGA DATA FETCHING SUMMARY ===');
        console.log('RGA Name:', effectiveAgnName);
        console.log('MGAs for ALP (blank CL_Name):', alpMgaNamesToFetch);
        console.log('All agents for hires/codes/VIPs:', agentNamesToFetch);
        
        // Fetch ALP data for the selected RGA only; use CL_Name blank (non-MGA) row client-side
        const alpRequests = [
          api.get(`/dataroutes/monthly-alp-by-mga?value=${effectiveAgnName}`)
        ];
        const alpResults = await Promise.all(alpRequests);
        const alpData = alpResults.flatMap(r => r?.data?.data || []);
        
        console.log('ALP Data Results:', {
          totalRecords: alpData.length,
          sampleRecord: alpData[0],
          uniqueMonths: [...new Set(alpData.map(d => d.month))],
          clNames: [...new Set(alpData.map(d => d.CL_Name || 'blank'))]
        });
        
        // Fetch hires, codes, VIPs from ALL agents in the hierarchy
        const hiresRequests = agentNamesToFetch.map(agentName =>
          api.get(`/dataroutes/total-hires?value=${agentName}`)
        );
        const vipsRequests = agentNamesToFetch.map(agentName =>
          api.get(`/dataroutes/vips/multiple?value=${agentName}`)
        );
        const codesRequests = agentNamesToFetch.map(agentName =>
          api.get(`/dataroutes/associates/multiple?value=${agentName}`)
        );
        
        const [hiresResults, vipsResults, codesResults] = await Promise.all([
          Promise.all(hiresRequests),
          Promise.all(vipsRequests),
          Promise.all(codesRequests)
        ]);
        
        // Flatten and DEDUPLICATE to prevent double counting
        const hiresDataRaw = hiresResults.flatMap(r => r?.data?.data || []);
        const vipsDataRaw = vipsResults.flatMap(r => r?.data?.data || []);
        const codesDataRaw = codesResults.flatMap(r => r?.data?.data || []);
        
        // Deduplicate hires by a unique key (e.g., MORE_Date + lagnname + policy info)
        const hiresMap = new Map();
        hiresDataRaw.forEach(hire => {
          // Create a unique key from available fields
          const key = `${hire.MORE_Date}_${hire.lagnname}_${hire.PolicyNumber || ''}_${hire.Total_Hires}`;
          if (!hiresMap.has(key)) {
            hiresMap.set(key, hire);
          }
        });
        const hiresData = Array.from(hiresMap.values());
        
        // Deduplicate VIPs by vipdate + lagnname + unique identifiers
        const vipsMap = new Map();
        vipsDataRaw.forEach(vip => {
          const key = `${vip.vipdate || vip.vip_month}_${vip.lagnname}_${vip.softcode_date || ''}_${vip.gs || ''}`;
          if (!vipsMap.has(key)) {
            vipsMap.set(key, vip);
          }
        });
        const vipsData = Array.from(vipsMap.values());
        
        // Deduplicate codes by PRODDATE + LagnName + unique identifiers
        const codesMap = new Map();
        codesDataRaw.forEach(code => {
          const key = `${code.PRODDATE}_${code.LagnName}_${code.finaldate || ''}_${code.PolicyNumber || ''}`;
          if (!codesMap.has(key)) {
            codesMap.set(key, code);
          }
        });
        const codesData = Array.from(codesMap.values());
        
        console.log('Hires Data Results (after deduplication):', {
          rawRecords: hiresDataRaw.length,
          uniqueRecords: hiresData.length,
          duplicatesRemoved: hiresDataRaw.length - hiresData.length,
          uniqueAgents: [...new Set(hiresData.map(d => d.lagnname))].length,
          sampleRecord: hiresData[0],
          totalHires2024: hiresData.filter(d => new Date(d.MORE_Date).getFullYear() === 2024).length,
          totalHires2025: hiresData.filter(d => new Date(d.MORE_Date).getFullYear() === 2025).length
        });
        
        console.log('VIPs Data Results (after deduplication):', {
          rawRecords: vipsDataRaw.length,
          uniqueRecords: vipsData.length,
          duplicatesRemoved: vipsDataRaw.length - vipsData.length,
          uniqueAgents: [...new Set(vipsData.map(d => d.lagnname))].length,
          sampleRecord: vipsData[0],
          vips2024: vipsData.filter(d => new Date(d.vipdate).getFullYear() === 2024).length,
          vips2025: vipsData.filter(d => new Date(d.vipdate).getFullYear() === 2025).length
        });
        
        console.log('Codes/Associates Data Results (after deduplication):', {
          rawRecords: codesDataRaw.length,
          uniqueRecords: codesData.length,
          duplicatesRemoved: codesDataRaw.length - codesData.length,
          uniqueAgents: [...new Set(codesData.map(d => d.LagnName))].length,
          sampleRecord: codesData[0],
          codes2024: codesData.filter(d => new Date(d.PRODDATE).getFullYear() === 2024).length,
          codes2025: codesData.filter(d => new Date(d.PRODDATE).getFullYear() === 2025).length
        });
        
        // Fetch agent history for the RGA only (includes full hierarchy)
        // Don't fetch for each MGA separately to avoid over-counting
        console.log('🏢 Fetching management history for RGA (includes full hierarchy)...');
        const agentHistoryRequests = [
          api.get(`/dataroutes/agent-history?value=${encodeURIComponent(effectiveAgnName)}`)
        ];
        const agentHistoryResults = await Promise.all(agentHistoryRequests);
        
        // Flatten and deduplicate management history data
        const agentHistoryDataRaw = agentHistoryResults.flatMap(r => r?.data?.data || []);
        
        // Deduplicate by reportdate + lagnname + clname to avoid counting same person twice
        const agentHistoryMap = new Map();
        agentHistoryDataRaw.forEach(entry => {
          const key = `${entry.reportdate}_${entry.lagnname}_${entry.clname}`;
          if (!agentHistoryMap.has(key)) {
            agentHistoryMap.set(key, entry);
          }
        });
        const agentHistoryData = Array.from(agentHistoryMap.values());
        // Ensure we only keep rows that belong to the selected RGA hierarchy
        const agentHistoryDataFiltered = filterAgentHistoryData(
          agentHistoryData,
          effectiveAgnName,
          'RGA'
        );
        
        console.log('Management History Results (after deduplication):', {
          rawRecords: agentHistoryDataRaw.length,
          uniqueRecords: agentHistoryData.length,
          duplicatesRemoved: agentHistoryDataRaw.length - agentHistoryData.length,
          uniquePeople: [...new Set(agentHistoryData.map(d => d.lagnname))].length,
          rgaQueried: effectiveAgnName
        });
        
        const subagentRes = await api.get(`/production-reports/submitting-agent-count?year=${currentYear}`);
        
        console.log('=== END RGA DATA SUMMARY ===');
        
        // Aggregate results
        responses = [
          { data: { data: alpData } }, // ALP data
          { data: { data: vipsData } }, // VIPs from all agents
          { data: { data: codesData } }, // Associates/Codes from all agents
          { data: { data: hiresData } }, // Hires from all agents
          { data: { data: subagentRes?.data?.data || [] } }, // Subagent
          { data: { data: agentHistoryDataFiltered } }  // Agent history filtered to selected RGA hierarchy
        ];
      } else if (useSgaEndpoints) {
        // SGA/MGA endpoints branch
        requests.push(
          api.get(
            `/dataroutes/sga-alp?value=${effectiveAgnName}`
          )
        );
        requests.push(
          api.get(
            `/dataroutes/vips-sga?column=${queryRole}&value=${effectiveAgnName}`
          )
        );
        requests.push(
          api.get(
            `/dataroutes/associates-sga?column=${queryRole}&value=${effectiveAgnName}`
          )
        );
        requests.push(
          api.get(
            `/dataroutes/org-total-hires?value=${effectiveAgnName}`
          )
        );
        requests.push(
          api.get(
            `/dataroutes/subagent-alp-sga?value=${effectiveAgnName}`
          )
        );
        requests.push(
          api.get(
            `/dataroutes/agent-history?value=${effectiveAgnName}`
          )
        );
        responses = await Promise.all(requests);
      } else {
        // Non-SGA endpoints branch
        requests.push(
          api.get(
            `/dataroutes/monthly-alp-by-mga?value=${effectiveAgnName}`
          )
        );
        if (queryRole !== "AGT") {
          requests.push(
            api.get(
              `/dataroutes/vips/multiple?value=${effectiveAgnName}`
            )
          );
          requests.push(
            api.get(
              `/dataroutes/associates/multiple?value=${effectiveAgnName}`
            )
          );
          requests.push(
            api.get(
              `/dataroutes/total-hires?value=${effectiveAgnName}`
            )
          );
          requests.push(
            api.get(
              `/production-reports/submitting-agent-count?year=${currentYear}`
            )
          );
          requests.push(
            api.get(
              `/dataroutes/agent-history?value=${effectiveAgnName}`
            )
          );
        }
        responses = await Promise.all(requests);
      }
  
      if (useSgaEndpoints) {
        // Process SGA responses (or RGA aggregated responses)
        if (filterMode === 'rga') {
          // For RGA mode, process aggregated data from multiple MGAs
          const alpResponse = responses[0];
          const rawData = alpResponse?.data?.data || [];
          setRawAlpData(rawData);
          setAlpData(processAlpData(rawData, queryRole, selectedAlpTab, /* preferNonMga */ true));
          
          setVipsData(responses[1]?.data?.data || []);
          setAssociatesData(responses[2]?.data?.data || []);
          const rawHires = responses[3]?.data?.data || [];
          setRawHiresData(rawHires);
          const hiresGrouped = groupTotalHiresByMonthAndYear(
            rawHires,
            "MORE_Date"
          );
          setHiresData(hiresGrouped);
          
          const { monthlyAveragesByYear, weeklyDetails } = processSubAgentDataFromDatabase(
            responses[4]?.data?.data || []
          );
          setSubAgentData(monthlyAveragesByYear);
          setSubAgentWeeks(weeklyDetails);
          
          const mgmtHistoryData = responses[5]?.data?.data || [];
          setRawMgmtHistoryData(mgmtHistoryData);
          const processedMgmtDataByRole = processManagementHistoryDataByRole(mgmtHistoryData);
          setMgmtCountData(processedMgmtDataByRole);
        } else {
          // Regular SGA/MGA processing
        const alpResponse = responses[0];
        const sgaAlpData = alpResponse?.data?.data || [];
        const groupedSgaAlpData = processSgaAlpData(sgaAlpData);
        setAlpData(groupedSgaAlpData);
  
        setVipsData(responses[1]?.data?.data || []);
        setAssociatesData(responses[2]?.data?.data || []);
        const rawHires = responses[3]?.data?.data || [];
        setRawHiresData(rawHires); // Store raw hires data
        const hiresGrouped = groupTotalHiresByMonthAndYear(
          rawHires,
          "MORE_Date"
        );
        setHiresData(hiresGrouped);
  
        const { monthlyAveragesByYear, weeklyDetails } = processSubAgentDataFromDatabase(
          responses[4]?.data?.data || []
        );
        setSubAgentData(monthlyAveragesByYear);
        setSubAgentWeeks(weeklyDetails);
        const mgmtHistoryData = responses[5]?.data?.data || [];
        setRawMgmtHistoryData(mgmtHistoryData);

        const processedMgmtDataByRole = processManagementHistoryDataByRole(mgmtHistoryData);
        setMgmtCountData(processedMgmtDataByRole);
        }
      } else {
// Process non-SGA responses
if (queryRole !== "AGT") {
  setVipsData(responses[1]?.data?.data || []);
  setAssociatesData(responses[2]?.data?.data || []);
  const rawHires = responses[3]?.data?.data || [];
  setRawHiresData(rawHires); // Store raw hires data
  const hiresGrouped = groupTotalHiresByMonthAndYear(
    rawHires,
    "MORE_Date"
  );
  setHiresData(hiresGrouped);
        const alpResponse = responses[0];
        const rawData = alpResponse?.data?.data || [];
        setRawAlpData(rawData);
        setAlpData(processAlpData(rawData, queryRole, selectedAlpTab));
  // Get the response data from the subagent endpoint.
  const subagentResponseData = responses[4]?.data?.data || [];

  // Process the subagent data using processSubAgentDataFromDatabase for consistency.
  const { monthlyAveragesByYear, weeklyDetails: nonSgaWeeklyDetails } = processSubAgentDataFromDatabase(
    subagentResponseData
  );
  setSubAgentData(monthlyAveragesByYear);
  setSubAgentWeeks(nonSgaWeeklyDetails);
}
if (!useSgaEndpoints && queryRole !== "AGT") {
  // Assuming the agent-history data is the last response in this branch:
  const rawAgentHistoryData = responses[responses.length - 1]?.data?.data || [];
  // When an MGA is selected, use "MGA" as the filter role to properly filter SA/GA under that MGA
  const filterRole = selectedMga ? "MGA" : userRole;
  const filteredAgentHistoryData = filterAgentHistoryData(rawAgentHistoryData, effectiveAgnName, filterRole);
  // Now you can use filteredAgentHistoryData in your further processing,
  // e.g., to compute management counts or to store in state.
  // For example, if you need to pass it to processManagementHistoryDataByRole:
  const processedMgmtDataByRole = processManagementHistoryDataByRole(filteredAgentHistoryData);
  setMgmtCountData(processedMgmtDataByRole);
}

  

      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch data.");
    } finally {
      setLoading(false);
    }
  }, [agnName, userRole, selectedMga, effectiveAgnName, queryRole, rawAlpData, selectedAlpTab, rawMgmtHistoryData, processAlpData, groupTotalHiresByMonthAndYear, processSubAgentDataFromDatabase, processManagementHistoryDataByRole, currentYear, filterMode]);
  const filterAgentHistoryData = useCallback((data, effectiveName, userRole) => {
    const lowerEffectiveName = effectiveName.toLowerCase();
    if (userRole === "MGA") {
      return data.filter(item => {
        // For MGA users, check if the effective name appears in the 'mga' column
        const mgaMatch =
          item.mga && item.mga.toLowerCase().includes(lowerEffectiveName);
        return mgaMatch;
      });
    } else if (userRole === "RGA") {
      return data.filter(item => {
        // For RGA users, check if the effective name appears in either the 'mga' or 'rga' columns
        // This allows RGAs to see both their own data and MGAs under them
        const mgaMatch =
          item.mga && item.mga.toLowerCase().includes(lowerEffectiveName);
        const rgaMatch =
          item.rga && item.rga.toLowerCase().includes(lowerEffectiveName);
        return mgaMatch || rgaMatch;
      });
    } else if (userRole === "SA") {
      // For SA users, filter based on the 'sa' column.
      return data.filter(
        item => item.sa && item.sa.toLowerCase().includes(lowerEffectiveName)
      );
    }
    // Otherwise, default to filtering on the lagnname field.
    return data.filter(
      item =>
        item.lagnname && item.lagnname.toLowerCase().includes(lowerEffectiveName)
    );
  }, []);
  
  
    const filterHierarchyData = useCallback((data, view) => {
    if (view === "a") {
      const logs = [];
      const yearsInUse = [currentYear, lastYear];
      const filtersByYear = {};

      yearsInUse.forEach((year) => {
        filtersByYear[year] = [];
      });

      const filteredData = data.filter((entry) => {
        const entryYear = new Date(entry.start).getFullYear();
        const isWithinCurrentYears = entryYear === currentYear || entryYear === lastYear;
        // Use effectiveAgnName here instead of agnName:
        const isLagnnameMatch = entry.lagnname === effectiveAgnName;
        const isRgaMatchAndRecent = entry.rga === effectiveAgnName && isWithinCurrentYears;

        if (isLagnnameMatch) {
          filtersByYear[entryYear].push({ reason: "lagnname matches effectiveAgnName", entry });
          logs.push(`Included: ${entry.lagnname} (Reason: lagnname matches effectiveAgnName)`);
          return true;
        }

        if (isRgaMatchAndRecent) {
          filtersByYear[entryYear].push({
            reason: "rga matches effectiveAgnName and start date is within the current years",
            entry,
          });
          logs.push(`Included: ${entry.lagnname} (Reason: rga matches effectiveAgnName and start date ${entry.start} is within the current years)`);
          return true;
        }

        logs.push(`Excluded: ${entry.lagnname}`);
        return false;
      });

      setFilteredHierarchyData(filteredData);

      return { yearsInUse, filtersByYear };
    } else {
      setFilteredHierarchyData(data);
    }
  }, [currentYear, lastYear, effectiveAgnName]);
  
  
  const handleViewChange = useCallback((view) => {
    setSelectedView(view);
    filterHierarchyData(hierarchyData, view); // Apply filtering based on the selected view
  }, [hierarchyData]);

  const handleCellClick = useCallback((tableName, dataItem, month, year) => {
    if (dataItem) {
      setSelectedTableDetails((prev) => ({
        ...prev,
        [tableName]: { data: dataItem, month, year }, // Store data and additional details
      }));
    }
  }, []);
  const convertTableIndexToActualMonth = useCallback((index) => {
    switch (index) {
      case 0: return 0;  // Jan
      case 1: return 1;  // Feb
      case 2: return 2;  // Mar
      case 4: return 3;  // Apr
      case 5: return 4;  // May
      case 6: return 5;  // Jun
      case 8: return 6;  // Jul
      case 9: return 7;  // Aug
      case 10: return 8; // Sep
      case 12: return 9; // Oct
      case 13: return 10; // Nov
      case 14: return 11; // Dec
      default: return null; // If index is a quarter or YTD column.
    }
  }, []);
  
  const handleMgmtCellClick = useCallback((role, year, tableCellIndex) => {
    // Convert the table cell index (from our calculated quarter values) 
    // into the actual month index (0-indexed).
    const actualMonth = convertTableIndexToActualMonth(tableCellIndex);
    if (actualMonth === null) {
      return; // Do nothing if a non-month cell is clicked.
    }
    
    // Determine if we're using SGA endpoints.
    // Treat RGA filter mode as SGA endpoints to avoid double-filtering later
    const isSgaEndpoints = ([("SGA"), ("MGA"), ("RGA")].includes(userRole) && !selectedMga) || filterMode === 'rga';
    
    // For non-SGA endpoints, filter the raw management data by effective name.
    let managementData = rawMgmtHistoryData;
    if (!isSgaEndpoints) {
      managementData = filterAgentHistoryData(rawMgmtHistoryData, effectiveAgnName, userRole);
    }
    
    // Filter the (possibly filtered) management data by role, year, and actual month.
    const filtered = managementData.filter(entry => {
      if (!entry.reportdate) return false;
      const entryDate = parseDateWithoutTime(entry.reportdate);
      return (
        entry.clname === role &&
        entryDate.getFullYear() === year &&
        entryDate.getMonth() === actualMonth  // using the actual month index
      );
    });
    
    // Determine the max reportdate from the filtered data.
    let maxDate = null;
    if (filtered.length > 0) {
      maxDate = new Date(Math.max(...filtered.map(item => parseDateWithoutTime(item.reportdate).getTime())));
    }
    
    // Filter to only include rows with the max reportdate.
    const details = maxDate 
      ? filtered.filter(item => parseDateWithoutTime(item.reportdate).getTime() === maxDate.getTime())
      : [];
    
    // Update the state so the breakdown view displays the details.
    setSelectedManagementDetails({
      role,
      year,
      month: tableCellIndex, // store the table cell index for header display if needed
      details
    });
  }, [userRole, selectedMga, rawMgmtHistoryData, effectiveAgnName, convertTableIndexToActualMonth, parseDateWithoutTime, filterAgentHistoryData]);
  
  
  useEffect(() => {
    if (rawAlpData.length > 0) {
      setAlpData(processAlpData(rawAlpData, queryRole, selectedAlpTab, /* preferNonMga */ (filterMode === 'rga')));
    }
  }, [rawAlpData, selectedAlpTab, queryRole]);
  
  // Fetch data when user data becomes available or selectedMga changes
  useEffect(() => {
    if (agnName && userRole) {
      console.log('🔄 Triggering fetchData due to dependency change:', {
        agnName,
        userRole,
        selectedMga,
        filterMode
      });
      fetchData();
    }
  }, [agnName, userRole, selectedMga, filterMode]); 
  
  // Close detail views when MGA selection changes
  useEffect(() => {
    setSelectedTableDetails({});
    setSelectedManagementDetails(null);
  }, [selectedMga]);
  
  // Helper function to check if a month is in the future
  const isMonthInFuture = useCallback((year, monthIndex) => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    return (year > currentYear) || (year === currentYear && monthIndex > currentMonth);
  }, []);

  // Helper function to check if a month index in the months array represents a future month
  const isMonthIndexFuture = useCallback((index) => {
    // Skip quarter columns (3, 7, 11, 15), YTD column (16), and previous year column (17)
    if ([3, 7, 11, 15, 16, 17].includes(index)) {
      return false; // Always show these columns
    }
    
    // Map index to actual month (0-11)
    let actualMonth;
    if (index < 3) actualMonth = index; // Jan, Feb, Mar
    else if (index < 7) actualMonth = index - 1; // Apr, May, Jun (skip Q1)
    else if (index < 11) actualMonth = index - 2; // Jul, Aug, Sep (skip Q1, Q2)
    else actualMonth = index - 3; // Oct, Nov, Dec (skip Q1, Q2, Q3)
    
    return isMonthInFuture(currentYear, actualMonth);
  }, [currentYear, isMonthInFuture]);

  // Helper function for single management table column indices (no previous year column)
  const isMgmtColumnIndexFuture = useCallback((index) => {
    // Skip quarter columns (3, 7, 11, 15) and YTD column (16)
    if ([3, 7, 11, 15, 16].includes(index)) {
      return false; // Always show these columns
    }
    
    // Map index to actual month (0-11) for single management table
    let actualMonth;
    if (index < 3) actualMonth = index; // Jan, Feb, Mar
    else if (index < 7) actualMonth = index - 1; // Apr, May, Jun (skip Q1)
    else if (index < 11) actualMonth = index - 2; // Jul, Aug, Sep (skip Q1, Q2)
    else actualMonth = index - 3; // Oct, Nov, Dec (skip Q1, Q2, Q3)
    
    return isMonthInFuture(currentYear, actualMonth);
  }, [currentYear, isMonthInFuture]);

  // Helper function to check if a column index is a quarter column
  const isQuarterColumn = useCallback((index) => {
    return [3, 7, 11, 15].includes(index);
  }, []);

  // Helper function for single management table quarter columns
  const isMgmtQuarterColumn = useCallback((index) => {
    return [3, 7, 11, 15].includes(index);
  }, []);

  // Helper function to determine if a column should be shown based on quarters mode
  const shouldShowColumn = useCallback((index, isQuarter, isFuture) => {
    // Handle quarters mode
    if (quartersMode === 'hide' && isQuarter) {
      return false; // Hide quarters
    }
    if (quartersMode === 'only') {
      // Only show quarters, YTD, and previous year columns
      if (!isQuarter && ![16, 17].includes(index)) {
        return false; // Hide non-quarter columns (except YTD and previous year)
      }
    }
    
    // Handle future months (existing logic)
    if (!showFutureMonths && isFuture) {
      return false;
    }
    
    return true;
  }, [quartersMode, showFutureMonths]);

  // Helper function for single management table column visibility
  const shouldShowMgmtColumn = useCallback((index, isQuarter, isFuture) => {
    // Handle quarters mode
    if (quartersMode === 'hide' && isQuarter) {
      return false; // Hide quarters
    }
    if (quartersMode === 'only') {
      // Only show quarters and YTD columns (no previous year in mgmt tables)
      if (!isQuarter && index !== 16) {
        return false; // Hide non-quarter columns (except YTD)
      }
    }
    
    // Handle future months (existing logic)
    if (!showFutureMonths && isFuture) {
      return false;
    }
    
    return true;
  }, [quartersMode, showFutureMonths]);

  // Helper function to determine if a cell should be greyed out due to pre-start data
  const shouldGreyOutCell = useCallback((monthIndex, year) => {
    if (!mgaStartDate || monthIndex === undefined) return false;
    
    // Check if this entire month is before the MGA start date
    // Only grey out if the entire month is before the start date
    const monthEndDate = new Date(year, monthIndex + 1, 0); // Last day of the month
    return monthEndDate < mgaStartDate;
  }, [mgaStartDate]);

  // Animated Line Graph Component using Chart.js
  const LineGraph = ({ title, currentYearData, previousYearData, isCurrency = false }) => {
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const today = new Date();
    const currentMonth = today.getMonth();
    
    // Ensure data is always an array with 12 months
    const safeCurrentYearData = Array.isArray(currentYearData) ? currentYearData : Array(12).fill(0);
    const safePreviousYearData = Array.isArray(previousYearData) ? previousYearData : Array(12).fill(0);
    
    // Pad arrays to ensure they have 12 months
    while (safeCurrentYearData.length < 12) safeCurrentYearData.push(0);
    while (safePreviousYearData.length < 12) safePreviousYearData.push(0);
    
    // Find record values (highest in all data for this metric)
    const allDataPoints = [...safeCurrentYearData, ...safePreviousYearData];
    const maxValue = Math.max(...allDataPoints.filter(v => v > 0));
    
    // Create star point arrays - true for records, false for others
    const currentYearStarPoints = safeCurrentYearData.map((value, index) => 
      index <= currentMonth && value === maxValue && value > 0
    );
    const previousYearStarPoints = safePreviousYearData.map(value => 
      value === maxValue && value > 0
    );
    
    // Create point sizes arrays - hide points where we'll draw stars
    const currentYearPointSizes = safeCurrentYearData.map((value, index) => 
      index <= currentMonth && value === maxValue && value > 0 ? 0 : 4
    );
    const previousYearPointSizes = safePreviousYearData.map(value => 
      value === maxValue && value > 0 ? 0 : 4
    );
    
    // Create datasets for Chart.js
    const data = {
      labels: months,
      datasets: [
        {
          label: `${previousYear}`,
          data: safePreviousYearData,
          borderColor: '#94a3b8',
          backgroundColor: '#94a3b8',
          borderWidth: 2,
          borderDash: [5, 5],
          pointBackgroundColor: '#94a3b8',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: previousYearPointSizes,
          pointHoverRadius: previousYearPointSizes.map(size => size + 2),
          starPoints: previousYearStarPoints,
          tension: 0.3,
        },
        {
          label: `${currentYear}`,
          data: safeCurrentYearData.map((value, index) => 
            index <= currentMonth ? value : null
          ),
          borderColor: '#3b82f6',
          backgroundColor: '#3b82f6',
          borderWidth: 3,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: currentYearPointSizes.map((size, index) => 
            index <= currentMonth ? size : 0
          ),
          pointHoverRadius: currentYearPointSizes.map((size, index) => 
            index <= currentMonth ? size + 2 : 0
          ),
          starPoints: currentYearStarPoints.map((isStar, index) => 
            index <= currentMonth ? isStar : false
          ),
          tension: 0.3,
          spanGaps: false,
        },
        // Future months as grayed out points
        {
          label: 'Future',
          data: safeCurrentYearData.map((value, index) => 
            index > currentMonth ? 0 : null
          ),
          borderColor: 'transparent',
          backgroundColor: '#e5e7eb',
          pointBackgroundColor: '#e5e7eb',
          pointBorderColor: 'transparent',
          pointRadius: 3,
          showLine: false,
          spanGaps: false,
        }
      ]
    };
    
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            filter: (legendItem) => legendItem.text !== 'Future'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              if (context.datasetIndex === 2) return null; // Hide future points tooltip
              
              let formattedValue;
              if (isCurrency) {
                formattedValue = new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(value);
              } else {
                formattedValue = value.toLocaleString();
              }
              
              // Check if this is a record value
              const isRecord = value === maxValue && value > 0;
              const recordText = isRecord ? ' ⭐ RECORD!' : '';
              
              return `${label}: ${formattedValue}${recordText}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: '#e0e0e0'
          },
          ticks: {
            color: function(context) {
              const index = context.index;
              return index > currentMonth ? '#ccc' : '#666';
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: '#e0e0e0'
          },
          ticks: {
            color: '#666',
            callback: function(value) {
              if (isCurrency) {
                return new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(value);
              }
              return value.toLocaleString();
            }
          }
        }
      },
      animation: {
        duration: 2500,
        easing: 'easeInOutQuart',
        delay: (context) => {
          // Animate points first, then lines
          if (context.type === 'point') {
            return context.dataIndex * 150; // Stagger point animations
          }
          return 1800; // Lines animate after points
        }
      },
      animations: {
        radius: {
          duration: 400,
          easing: 'linear',
          loop: (context) => context.active
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    };
    
    return (
      <div className="atlas-scorecard-section">
        <h5>{title}</h5>
        <div className="atlas-scorecard-graph-container" style={{ height: '350px', padding: '20px' }}>
          <Line data={data} options={options} />
        </div>
      </div>
    );
  };
  
  if (loading) return <Placeholder/>;
  if (error) return <div>Error: {error}</div>;

  const renderSingleManagementTable = (roleKey, tableLabel) => {
    // Format numbers as before.
    const numberFormatter = (num) => num.toLocaleString();
    const previousYear = currentYear - 1;
    const dataForRole = mgmtCountData[roleKey] || {};
    const prevData = dataForRole[previousYear] || Array(12).fill(0);
    const currData = dataForRole[currentYear] || Array(12).fill(0);
    
    const prevValues = calculateQuarterValuesForArray(prevData, previousYear);
    const currValues = calculateQuarterValuesForArray(currData, currentYear);
    
    // Calculate growth and percentage growth as before.
    const growthData = currValues.map((curr, idx) => ({
      value: curr - prevValues[idx],
      className:
        curr - prevValues[idx] > 0
          ? "growth-positive"
          : curr - prevValues[idx] < 0
          ? "growth-negative"
          : ""
    }));
    
    const percentGrowthData = currValues.map((curr, idx) => {
      const prev = prevValues[idx];
      if (prev === 0) {
        return { value: "N/A", className: "" };
      }
      const pct = ((curr - prev) / prev) * 100;
      return {
        value: pct,
        className: pct > 0 ? "growth-positive" : pct < 0 ? "growth-negative" : ""
      };
    });
    
    // Define the columns for months, quarters, YTD.
    const columns = [
      "Jan", "Feb", "Mar", "Q1",
      "Apr", "May", "Jun", "Q2",
      "Jul", "Aug", "Sep", "Q3",
      "Oct", "Nov", "Dec", "Q4",
      "YTD"
    ];
    
    // For roles that require details sorting.
    let sortedDetails = [];
    if (selectedManagementDetails && selectedManagementDetails.role === roleKey) {
      sortedDetails = [...selectedManagementDetails.details].sort((a, b) => {
        if (roleKey === "SA" || roleKey === "GA") {
          // Sort by mga (case-insensitive), with fallback on lagnname.
          const cmp = (a.mga || "").toLowerCase().localeCompare((b.mga || "").toLowerCase());
          return cmp !== 0
            ? cmp
            : (a.lagnname || "").toLowerCase().localeCompare((b.lagnname || "").toLowerCase());
        }
        // For other roles, sort by lagnname.
        return (a.lagnname || "").toLowerCase().localeCompare((b.lagnname || "").toLowerCase());
      });
    }
    
    return (
      <>
        <div className="atlas-scorecard-section">
          <h5>{tableLabel}</h5>
          <div style={{ overflowX: "auto" }}>
            <div className="atlas-scorecard-custom-table-container">
              <table className="atlas-scorecard-custom-table">
              <thead>
                <tr>
                  <th>Year</th>
                  {columns.map((col, i) => {
                    const isQuarter = isMgmtQuarterColumn(i);
                    const isFuture = isMgmtColumnIndexFuture(i);
                    
                    // Check if column should be shown based on quarters mode and future months toggle
                    if (!shouldShowMgmtColumn(i, isQuarter, isFuture)) {
                      return null;
                    }
                    
                    return (
                      <th
                        key={i}
                        className={i === columns.length - 1 ? "atlas-scorecard-ytd-header" : i % 4 === 3 ? "atlas-scorecard-quarter-header" : ""}
                      >
                        {col}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Previous Year Row */}
                <tr>
                  <td>{previousYear}</td>
                  {prevValues.map((val, idx) => {
                    const isQuarter = isMgmtQuarterColumn(idx);
                    const isFuture = isMgmtColumnIndexFuture(idx);
                    
                    // Check if column should be shown based on quarters mode and future months toggle
                    if (!shouldShowMgmtColumn(idx, isQuarter, isFuture)) {
                      return null;
                    }
                    
                    // Only month cells (not quarter or YTD) should be clickable.
                    const actualMonth = convertTableIndexToActualMonth(idx);
                    const isPreStart = actualMonth !== null && shouldGreyOutCell(actualMonth, previousYear);
                    return (
                      <td
                        key={idx}
                        className={`${idx === prevValues.length - 1 ? "atlas-scorecard-prev-year-cell" : idx === prevValues.length - 2 ? "atlas-scorecard-ytd-cell" : idx % 4 === 3 ? "atlas-scorecard-quarter-cell" : ""} ${isPreStart ? "atlas-scorecard-pre-start-cell" : ""}`}
                        onClick={() => {
                          if (actualMonth !== null && !isPreStart) {
                            handleMgmtCellClick(roleKey, previousYear, idx);
                          }
                        }}
                        title={actualMonth !== null && !isPreStart ? "Click to view breakdown" : isPreStart ? "Pre-start data" : ""}
                        style={{ cursor: actualMonth !== null && !isPreStart ? "pointer" : "default" }}
                      >
                        {isPreStart ? "—" : numberFormatter(val)}
                      </td>
                    );
                  })}
                </tr>
                {/* Current Year Row */}
                <tr>
                  <td>{currentYear}</td>
                  {currValues.map((val, idx) => {
                    const isQuarter = isMgmtQuarterColumn(idx);
                    const isFuture = isMgmtColumnIndexFuture(idx);
                    
                    // Check if column should be shown based on quarters mode and future months toggle
                    if (!shouldShowMgmtColumn(idx, isQuarter, isFuture)) {
                      return null;
                    }
                    
                    const actualMonth = convertTableIndexToActualMonth(idx);
                    const isFutureMonth = actualMonth !== null && isMonthInFuture(currentYear, actualMonth);
                    const isPreStart = actualMonth !== null && shouldGreyOutCell(actualMonth, currentYear);
                    
                    return (
                      <td
                        key={idx}
                        className={`${idx === currValues.length - 1 ? "atlas-scorecard-prev-year-cell" : idx === currValues.length - 2 ? "atlas-scorecard-ytd-cell" : idx % 4 === 3 ? "atlas-scorecard-quarter-cell" : ""} ${isPreStart ? "atlas-scorecard-pre-start-cell" : ""}`}
                        onClick={() => {
                          if (actualMonth !== null && !isFutureMonth && !isPreStart) {
                            handleMgmtCellClick(roleKey, currentYear, idx);
                          }
                        }}
                        title={actualMonth !== null && !isFutureMonth && !isPreStart ? "Click to view breakdown" : isPreStart ? "Pre-start data" : ""}
                        style={{ cursor: actualMonth !== null && !isFutureMonth && !isPreStart ? "pointer" : "default" }}
                      >
                        {isFutureMonth || isPreStart ? "—" : numberFormatter(val)}
                      </td>
                    );
                  })}
                </tr>
                <tr className="atlas-scorecard-growth-row">
                  <td>Growth</td>
                  {growthData.map(({ value, className }, idx) => {
                    const isQuarter = isMgmtQuarterColumn(idx);
                    const isFuture = isMgmtColumnIndexFuture(idx);
                    
                    // Check if column should be shown based on quarters mode and future months toggle
                    if (!shouldShowMgmtColumn(idx, isQuarter, isFuture)) {
                      return null;
                    }
                    
                    const actualMonth = convertTableIndexToActualMonth(idx);
                    const isFutureMonth = actualMonth !== null && isMonthInFuture(currentYear, actualMonth);
                    const isPreStart = actualMonth !== null && shouldGreyOutCell(actualMonth, currentYear);
                    return (
                      <td key={idx} className={`${className} ${isPreStart ? "atlas-scorecard-pre-start-cell" : ""}`}>
                        {isFutureMonth || isPreStart ? "—" : numberFormatter(value)}
                      </td>
                    );
                  })}
                </tr>
                <tr className="atlas-scorecard-percentage-row">
                  <td>%</td>
                  {percentGrowthData.map((data, idx) => {
                    const isQuarter = isMgmtQuarterColumn(idx);
                    const isFuture = isMgmtColumnIndexFuture(idx);
                    
                    // Check if column should be shown based on quarters mode and future months toggle
                    if (!shouldShowMgmtColumn(idx, isQuarter, isFuture)) {
                      return null;
                    }
                    
                    const actualMonth = convertTableIndexToActualMonth(idx);
                    const isFutureMonth = actualMonth !== null && isMonthInFuture(currentYear, actualMonth);
                    const isPreStart = actualMonth !== null && shouldGreyOutCell(actualMonth, currentYear);
                    return (
                      <td key={idx} className={`${data.className} ${isPreStart ? "atlas-scorecard-pre-start-cell" : ""}`}>
                        {isFutureMonth || isPreStart ? "—" : (data.value === "N/A" ? "N/A" : `${data.value.toFixed(1)}%`)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>
        
        {/* Only render the breakdown details view if the role is not 'total' */}
        {roleKey !== "total" && selectedManagementDetails && selectedManagementDetails.role === roleKey && (
          <section className="management-breakdown">
            <h5>
              Breakdown for {roleKey} – {selectedManagementDetails.year} : {columns[selectedManagementDetails.month]}
            </h5>
            <button className="insured-button" onClick={() => setSelectedManagementDetails(null)}>
              Back
            </button>
            <div className="details-view">
              <table className="hierarchyTable">
                <thead>
                  <tr>
                    <th>Name</th>
                    {(roleKey === "SA" || roleKey === "GA") && <th>MGA</th>}
                    {(roleKey === "MGA" || roleKey === "RGA") && <th>Hierarchy</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedDetails.map((entry, index) => (
                    <tr key={index}>
                      <td>{formatName(entry.lagnname) || "N/A"}</td>
                      {(roleKey === "SA" || roleKey === "GA") && (
                        <td>{formatName(entry.mga) || "N/A"}</td>
                      )}
                      {(roleKey === "MGA" || roleKey === "RGA") && (
                        <td>
                          {entry.sa && <div style={{ backgroundColor: "#B25271" }}>SA: {formatName(entry.sa)}</div>}
                          {entry.ga && <div style={{ backgroundColor: "#ED722F" }}>GA: {formatName(entry.ga)}</div>}
                          {entry.mga && <div style={{ backgroundColor: "#68B675" }}>MGA: {formatName(entry.mga)}</div>}
                          {entry.rga && <div style={{ backgroundColor: "#9B59B6" }}>RGA: {formatName(entry.rga)}</div>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </>
    );
  };
// New helper: render the Hire to Code table by computing ratio values  
const renderHireToCodeTable = () => {
  // For ratios we format as a number with 2 decimals.
  const ratioFormatter = (num) => Number(num).toFixed(2);

  // Get current date to determine which months are in the future
  const currentDate = new Date();
  const currentCalendarYear = currentDate.getFullYear();
  const currentCalendarMonth = currentDate.getMonth();
  
  // Check if a month is in the future
  const isMonthInFuture = (year, monthIndex) => {
    return (year > currentCalendarYear) || (year === currentCalendarYear && monthIndex > currentCalendarMonth);
  };

  // Make sure data is available
  const hasCurrentYearData = hiresData[currentYear] && Array.isArray(hiresData[currentYear]);
  const hasPrevYearData = hiresData[lastYear] && Array.isArray(hiresData[lastYear]);
  
  if (!hasCurrentYearData && !hasPrevYearData) {
    return null;
  }

  // Get monthly data for codes from associatesData (need to convert from raw data)
  const codesGrouped = groupByMonthAndYear(associatesData, "PRODDATE");
  const prevCodeMonthly = codesGrouped[lastYear] || Array(12).fill(0);
  const currCodeMonthly = codesGrouped[currentYear] || Array(12).fill(0);

  // Get monthly data for hires (already in year/month format)
  const prevHireMonthly = hiresData[lastYear] || Array(12).fill(0);
  const currHireMonthly = hiresData[currentYear] || Array(12).fill(0);

  // Helper to check if month is excluded due to MGA start date
  const isMonthExcluded = (year, monthIndex) => {
    if (!mgaStartDate || !year) return false;
    const monthEndDate = new Date(year, monthIndex + 1, 0);
    return monthEndDate < mgaStartDate;
  };

  // Simple YTD calculation: sum of hires / sum of codes for each period
  const calculateSimpleRatios = (codeMonthly, hireMonthly, year) => {
    // Q1: sum of hires (Jan-Mar) / sum of codes (Jan-Mar)
    let q1Hires = 0, q1Codes = 0;
    for (let i = 0; i < 3; i++) {
      if (!isMonthExcluded(year, i)) {
        q1Hires += hireMonthly[i] || 0;
        q1Codes += codeMonthly[i] || 0;
      }
    }
    const q1 = q1Codes > 0 ? q1Hires / q1Codes : 0;

    // Q2: sum of hires (Apr-Jun) / sum of codes (Apr-Jun)
    let q2Hires = 0, q2Codes = 0;
    for (let i = 3; i < 6; i++) {
      if (!isMonthExcluded(year, i)) {
        q2Hires += hireMonthly[i] || 0;
        q2Codes += codeMonthly[i] || 0;
      }
    }
    const q2 = q2Codes > 0 ? q2Hires / q2Codes : 0;

    // Q3: sum of hires (Jul-Sep) / sum of codes (Jul-Sep)
    let q3Hires = 0, q3Codes = 0;
    for (let i = 6; i < 9; i++) {
      if (!isMonthExcluded(year, i)) {
        q3Hires += hireMonthly[i] || 0;
        q3Codes += codeMonthly[i] || 0;
      }
    }
    const q3 = q3Codes > 0 ? q3Hires / q3Codes : 0;

    // Q4: sum of hires (Oct-Dec) / sum of codes (Oct-Dec)
    let q4Hires = 0, q4Codes = 0;
    for (let i = 9; i < 12; i++) {
      if (!isMonthExcluded(year, i)) {
        q4Hires += hireMonthly[i] || 0;
        q4Codes += codeMonthly[i] || 0;
      }
    }
    const q4 = q4Codes > 0 ? q4Hires / q4Codes : 0;

    // YTD: sum of hires (up to and including current month) / sum of codes (up to and including current month)
    const today = new Date();
    const monthsToConsider = Math.max(1, today.getMonth() + 1); // Include current month
    let ytdHires = 0, ytdCodes = 0;
    for (let i = 0; i < monthsToConsider; i++) {
      if (!isMonthExcluded(year, i)) {
        ytdHires += hireMonthly[i] || 0;
        ytdCodes += codeMonthly[i] || 0;
      }
    }
    const ytd = ytdCodes > 0 ? ytdHires / ytdCodes : 0;

    // Full year: sum of all hires / sum of all codes
    let fullYearHires = 0, fullYearCodes = 0;
    for (let i = 0; i < 12; i++) {
      if (!isMonthExcluded(year, i)) {
        fullYearHires += hireMonthly[i] || 0;
        fullYearCodes += codeMonthly[i] || 0;
      }
    }
    const fullYear = fullYearCodes > 0 ? fullYearHires / fullYearCodes : 0;

    // Return array: [Q1, Q2, Q3, Q4, YTD, Full Year]
    return [q1, q2, q3, q4, ytd, fullYear];
  };

  // Calculate ratios with rolling windows using raw weekly data
  const calculateRollingRatio = (codeMonthly, hireMonthly, year) => {
    
    // Generate all week ranges for the selected year and previous year
    const prevYear = year - 1;
    
    // Helper function to generate week ranges for codes (Friday to Thursday) 
    const generateCodesWeekRanges = (yearToGenerate) => {
      const weeks = [];
      
      // Start with the first Friday of the year
      let currentDate = new Date(yearToGenerate, 0, 1); // January 1st
      while (currentDate.getDay() !== 5) { // 5 = Friday
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Generate all weeks in the year (Friday to Thursday)
      while (currentDate.getFullYear() === yearToGenerate) {
        const weekStart = new Date(currentDate.getTime()); // Friday
        const weekEnd = new Date(currentDate.getTime());
        weekEnd.setDate(weekEnd.getDate() + 6); // Thursday is 6 days after Friday
        
        weeks.push({
          start: weekStart,
          end: weekEnd
        });
        
        // Move to next Friday
        currentDate.setDate(currentDate.getDate() + 7);
      }
      
      return weeks;
    };
    
    // Helper function to generate week ranges for hires (Saturday to Friday - 7 days ending Friday)
    // Assuming you meant 7-day weeks that end on Friday, not 2-day Thu-Fri periods
    const generateHiresWeekRanges = (yearToGenerate) => {
      const weeks = [];
      
      // Start with the first Saturday of the year (for weeks ending on Friday)
      let currentDate = new Date(yearToGenerate, 0, 1); // January 1st
      while (currentDate.getDay() !== 6) { // 6 = Saturday
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Generate all weeks in the year (Saturday to Friday - 7 days ending Friday)
      while (currentDate.getFullYear() === yearToGenerate) {
        const weekStart = new Date(currentDate.getTime()); // Saturday
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
    
    const codesWeekRanges = generateCodesWeekRanges(year);
    const prevYearCodesWeekRanges = generateCodesWeekRanges(prevYear);
    const hiresWeekRanges = generateHiresWeekRanges(year);
    const prevYearHiresWeekRanges = generateHiresWeekRanges(prevYear);
    
    // Map to store codes and hires by week
    const codesByWeek = {
      [year]: Array(codesWeekRanges.length).fill(0),
      [prevYear]: Array(prevYearCodesWeekRanges.length).fill(0)
    };
    const hiresByWeek = {
      [year]: Array(hiresWeekRanges.length).fill(0),
      [prevYear]: Array(prevYearHiresWeekRanges.length).fill(0)
    };
    
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
    
    // Process codes data (raw associatesData)
    associatesData.forEach(item => {
      if (!item.PRODDATE) return;
      const date = new Date(item.PRODDATE);
      const itemYear = date.getFullYear();
      
      // Only process relevant years
      if (itemYear !== year && itemYear !== prevYear) return;
      
      // Find which week the date belongs to
      const ranges = itemYear === year ? codesWeekRanges : prevYearCodesWeekRanges;
      const weekIndex = findWeekForDate(date, ranges);
      
      if (weekIndex >= 0) {
        codesByWeek[itemYear][weekIndex]++;
      }
    });
    
    // Process hires data (raw rawHiresData)
    rawHiresData.forEach(item => {
      if (!item.MORE_Date) return;
      const date = new Date(item.MORE_Date);
      const itemYear = date.getFullYear();
      
      // Only process relevant years
      if (itemYear !== year && itemYear !== prevYear) return;
      
      // Find which week the date belongs to
      const ranges = itemYear === year ? hiresWeekRanges : prevYearHiresWeekRanges;
      const weekIndex = findWeekForDate(date, ranges);
      
      if (weekIndex >= 0) {
        hiresByWeek[itemYear][weekIndex] += parseFloat(item.Total_Hires) || 0;
      }
    });
    
    // Helper function to get value with year boundary handling
    const getValueForWeek = (dataMap, targetYear, weekIndex, dataType = 'codes') => {
      if (weekIndex < 0) {
        // We need to look at the previous year
        const prevYearWeeks = dataType === 'codes' 
          ? (targetYear === year ? prevYearCodesWeekRanges : generateCodesWeekRanges(targetYear - 1)).length
          : (targetYear === year ? prevYearHiresWeekRanges : generateHiresWeekRanges(targetYear - 1)).length;
        return dataMap[targetYear - 1]?.[prevYearWeeks + weekIndex] || 0;
      } else {
        return dataMap[targetYear]?.[weekIndex] || 0;
      }
    };
    
    // Calculate weekly ratios first, then average by month
    const monthlyRatios = Array(12).fill(0);
    const monthRatioCounts = Array(12).fill(0);
    
    for (let weekIndex = 0; weekIndex < codesWeekRanges.length; weekIndex++) {
      // Get the month this week belongs to
      const month = codesWeekRanges[weekIndex].start.getMonth();
      
      // Skip future months
      if (isMonthInFuture(year, month)) {
        continue;
      }
      
      // Calculate week label (for logging)
      let weekCounter = 0;
      for (let w = 0; w <= weekIndex; w++) {
        if (codesWeekRanges[w].start.getMonth() === month) {
          weekCounter++;
        }
      }
      
      const monthNames = ["January", "February", "March", "April", "May", "June", 
                          "July", "August", "September", "October", "November", "December"];
      
      // Sum codes from previous 14 weeks (changed from 13)
      let totalCodes = 0;
      
      for (let offset = 1; offset <= 14; offset++) {
        const priorWeekIndex = weekIndex - offset;
        const codes = getValueForWeek(codesByWeek, year, priorWeekIndex, 'codes');
        
        // Get the actual week date range for logging
        let weekDateRange = "";
        if (priorWeekIndex < 0) {
          // Previous year week
          const adjustedIndex = prevYearCodesWeekRanges.length + priorWeekIndex;
          if (adjustedIndex >= 0 && adjustedIndex < prevYearCodesWeekRanges.length) {
            const weekStart = prevYearCodesWeekRanges[adjustedIndex].start;
            const weekEnd = prevYearCodesWeekRanges[adjustedIndex].end;
            weekDateRange = `${weekStart.getMonth()+1}/${weekStart.getDate()}-${weekEnd.getMonth()+1}/${weekEnd.getDate()}`;
          }
        } else {
          // Current year week
          if (priorWeekIndex >= 0 && priorWeekIndex < codesWeekRanges.length) {
            const weekStart = codesWeekRanges[priorWeekIndex].start;
            const weekEnd = codesWeekRanges[priorWeekIndex].end;
            weekDateRange = `${weekStart.getMonth()+1}/${weekStart.getDate()}-${weekEnd.getMonth()+1}/${weekEnd.getDate()}`;
          }
        }
        totalCodes += codes;
      }
      
      // Sum hires from 5-17 weeks prior (changed from 4-17)
      let totalHires = 0;
      
      for (let offset = 5; offset <= 17; offset++) {
        const priorWeekIndex = weekIndex - offset;
        const hires = getValueForWeek(hiresByWeek, year, priorWeekIndex, 'hires');
        
        // Get the actual week date range for logging
        let weekDateRange = "";
        let weekRangeForData = null;
        
        if (priorWeekIndex < 0) {
          // Previous year week
          const adjustedIndex = prevYearHiresWeekRanges.length + priorWeekIndex;
          if (adjustedIndex >= 0 && adjustedIndex < prevYearHiresWeekRanges.length) {
            const weekStart = prevYearHiresWeekRanges[adjustedIndex].start;
            const weekEnd = prevYearHiresWeekRanges[adjustedIndex].end;
            weekDateRange = `${weekStart.getMonth()+1}/${weekStart.getDate()}-${weekEnd.getMonth()+1}/${weekEnd.getDate()}`;
            weekRangeForData = { start: weekStart, end: weekEnd, yearType: 'prev' };
          }
        } else {
          // Current year week
          if (priorWeekIndex >= 0 && priorWeekIndex < hiresWeekRanges.length) {
            const weekStart = hiresWeekRanges[priorWeekIndex].start;
            const weekEnd = hiresWeekRanges[priorWeekIndex].end;
            weekDateRange = `${weekStart.getMonth()+1}/${weekStart.getDate()}-${weekEnd.getMonth()+1}/${weekEnd.getDate()}`;
            weekRangeForData = { start: weekStart, end: weekEnd, yearType: 'current' };
          }
        }
        
        // Show the specific MORE_Date values contributing to this week's total
        if (weekRangeForData && hires > 0) {
          const contributingHires = rawHiresData.filter(item => {
            if (!item.MORE_Date) return false;
            const itemDate = new Date(item.MORE_Date);
            const itemYear = itemDate.getFullYear();
            const targetYear = weekRangeForData.yearType === 'current' ? year : prevYear;
            
            return itemYear === targetYear && 
                   itemDate.getTime() >= weekRangeForData.start.getTime() && 
                   itemDate.getTime() <= weekRangeForData.end.getTime();
          });
          
          if (contributingHires.length > 0) {
            // Group by MORE_Date and sum Total_Hires
            const dateGroups = {};
            contributingHires.forEach(hire => {
              const dateKey = hire.MORE_Date;
              if (!dateGroups[dateKey]) {
                dateGroups[dateKey] = 0;
              }
              dateGroups[dateKey] += parseFloat(hire.Total_Hires) || 0;
            });
          }
        }
        
        totalHires += hires;
      }
      
      // Calculate weekly ratio (only if we have codes to avoid division by zero)
      if (totalCodes > 0) {
        const weeklyRatio = totalHires / totalCodes;
        
        // Add this weekly ratio to the monthly accumulator
        monthlyRatios[month] += weeklyRatio;
        monthRatioCounts[month]++;
      }
    }
    
    // Average weekly ratios by month
    for (let m = 0; m < 12; m++) {
      if (monthRatioCounts[m] > 0) {
        monthlyRatios[m] /= monthRatioCounts[m];
      } else if (isMonthInFuture(year, m)) {
        // Zero out future months
        monthlyRatios[m] = 0;
      }
    }
    
    return monthlyRatios;
  };

  // Calculate ratios based on selected view mode
  let prevRatios, currRatios;
  
  if (hireToCodeView === 'YTD') {
    // Simple sum-based calculation
    prevRatios = calculateSimpleRatios(prevCodeMonthly, prevHireMonthly, lastYear);
    currRatios = calculateSimpleRatios(currCodeMonthly, currHireMonthly, currentYear);
  } else {
    // Rolling calculation (original logic) - but format as quarters only for display
  const prevMonthlyRatios = calculateRollingRatio(prevCodeMonthly, prevHireMonthly, lastYear);
  const currMonthlyRatios = calculateRollingRatio(currCodeMonthly, currHireMonthly, currentYear);

    // Convert monthly ratios to quarterly format for display
    const convertToQuarterlyFormat = (monthlyRatios, year) => {
      const q1ValidData = monthlyRatios.slice(0, 3).filter((v, idx) => v > 0 && !isMonthExcluded(year, idx));
      const q2ValidData = monthlyRatios.slice(3, 6).filter((v, idx) => v > 0 && !isMonthExcluded(year, idx + 3));
      const q3ValidData = monthlyRatios.slice(6, 9).filter((v, idx) => v > 0 && !isMonthExcluded(year, idx + 6));
      const q4ValidData = monthlyRatios.slice(9, 12).filter((v, idx) => v > 0 && !isMonthExcluded(year, idx + 9));

    const q1 = q1ValidData.length > 0 ? q1ValidData.reduce((a, b) => a + b, 0) / q1ValidData.length : 0;
    const q2 = q2ValidData.length > 0 ? q2ValidData.reduce((a, b) => a + b, 0) / q2ValidData.length : 0;
    const q3 = q3ValidData.length > 0 ? q3ValidData.reduce((a, b) => a + b, 0) / q3ValidData.length : 0;
    const q4 = q4ValidData.length > 0 ? q4ValidData.reduce((a, b) => a + b, 0) / q4ValidData.length : 0;
    
    const today = new Date();
      const monthsToConsider = Math.max(0, today.getMonth());
      const validMonths = monthlyRatios.slice(0, monthsToConsider).filter((v, idx) => v > 0 && !isMonthExcluded(year, idx));
      const ytd = validMonths.length > 0 ? validMonths.reduce((a, b) => a + b, 0) / validMonths.length : 0;
      
      const fullYearValid = monthlyRatios.filter((v, idx) => v > 0 && !isMonthExcluded(year, idx));
      const fullYear = fullYearValid.length > 0 ? fullYearValid.reduce((a, b) => a + b, 0) / fullYearValid.length : 0;
      
      return [q1, q2, q3, q4, ytd, fullYear];
    };
    
    prevRatios = convertToQuarterlyFormat(prevMonthlyRatios, lastYear);
    currRatios = convertToQuarterlyFormat(currMonthlyRatios, currentYear);
  }

  // Growth and % growth (lower Hire/Code is better: a decrease is positive growth)
  const growthData = currRatios.map((curr, i) => {
    const prev = prevRatios[i];
    const diff = curr - prev;
    return {
      value: Math.abs(diff),
      // For hire to code, an increase is bad (negative growth), a decrease is good (positive growth)
      className: diff < 0 ? "growth-positive" : diff > 0 ? "growth-negative" : "",
    };
  });

  const percentGrowthData = currRatios.map((curr, i) => {
    const prev = prevRatios[i];
    if (prev === 0) {
      return { value: "N/A", className: "" };
    }
      const pct = ((curr - prev) / prev) * 100;
      return {
      value: Math.abs(pct),
        // For hire to code, an increase is bad (negative growth), a decrease is good (positive growth)
        className: pct < 0 ? "growth-positive" : pct > 0 ? "growth-negative" : "",
      };
  });

  // Define headers to show: Q1, Q2, Q3, Q4, YTD, Previous Year
  const displayHeaders = ["Q1 ", "Q2 ", "Q3 ", "Q4 ", "YTD ", `${currentYear - 1}`];

  return (
    <div className="atlas-scorecard-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h5 style={{ margin: 0 }}>Hire to Code Ratios</h5>
        <button 
          className={`hire-to-code-view-toggle-btn ${hireToCodeView === 'YTD' ? 'active' : ''}`}
          onClick={() => setHireToCodeView(hireToCodeView === 'Rolling' ? 'YTD' : 'Rolling')}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: '500',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            backgroundColor: hireToCodeView === 'YTD' ? '#3b82f6' : '#ffffff',
            color: hireToCodeView === 'YTD' ? '#ffffff' : '#374151',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title={hireToCodeView === 'Rolling' ? 'Switch to YTD View' : 'Switch to Rolling View'}
        >
          {hireToCodeView === 'Rolling' ? 'Switch to YTD' : 'Switch to Rolling'}
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
      <div className="atlas-scorecard-custom-table-container">
        <table className="atlas-scorecard-custom-table">
          <thead>
            <tr>
              <th>Year</th>
                {displayHeaders.map((header, index) => (
                  <th
                    key={index}
                    className={
                      index < 4
                        ? "atlas-scorecard-quarter-header"
                        : index === 4
                        ? "atlas-scorecard-ytd-header"
                          : "atlas-scorecard-prev-year-header"
                    }
                  >
                    {header}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{lastYear}</td>
                {prevRatios.map((val, index) => (
                <td
                  key={index}
                    className={
                      index < 4
                      ? "atlas-scorecard-quarter-cell"
                        : index === 4
                      ? "atlas-scorecard-ytd-cell"
                          : "atlas-scorecard-prev-year-cell"
                    }
                  >
                    {ratioFormatter(val)}
                </td>
                ))}
            </tr>
            <tr>
              <td>{currentYear}</td>
                {currRatios.map((val, index) => (
                <td
                  key={index}
                    className={
                      index < 4
                      ? "atlas-scorecard-quarter-cell"
                        : index === 4
                      ? "atlas-scorecard-ytd-cell"
                          : "atlas-scorecard-prev-year-cell"
                    }
                  >
                    {index === 5 ? "—" : ratioFormatter(val)}
                </td>
                ))}
            </tr>
            <tr className="atlas-scorecard-growth-row">
              <td>Growth</td>
                {growthData.map(({ value, className }, index) => (
                  <td key={index} className={className}>
                    {index === 5 ? "—" : ratioFormatter(value)}
                </td>
                ))}
            </tr>
            <tr className="atlas-scorecard-percentage-row">
              <td>%</td>
                {percentGrowthData.map((data, index) => (
                  <td key={index} className={data.className}>
                    {index === 5 ? "—" : (data.value === "N/A" ? "N/A" : `${data.value.toFixed(1)}%`)}
                </td>
                ))}
            </tr>
          </tbody>
        </table>
        </div>
      </div>
      <hr />
    </div>
  );
};


// New helper: render the Code/VIP ratio table (Codes divided by VIPs)
const renderCodeVipRatioTable = () => {
  const ratioFormatter = (num) => Number(num).toFixed(2);

  // Build monthly counts for Codes and VIPs
  const codesGrouped = groupByMonthAndYear(associatesData, "PRODDATE");
  const vipsGrouped = groupByMonthAndYear(vipsData, "vip_month");

  const prevCodeMonthly = codesGrouped[lastYear] || Array(12).fill(0);
  const currCodeMonthly = codesGrouped[currentYear] || Array(12).fill(0);
  const prevVipMonthly = vipsGrouped[lastYear] || Array(12).fill(0);
  const currVipMonthly = vipsGrouped[currentYear] || Array(12).fill(0);

  // Helper to check if month is excluded due to MGA start date
  const isMonthExcluded = (year, monthIndex) => {
      if (!mgaStartDate || !year) return false;
      const monthEndDate = new Date(year, monthIndex + 1, 0);
      return monthEndDate < mgaStartDate;
    };

  // Calculate ratios using sum of codes / sum of vips for each period
  const calculatePeriodRatios = (codeMonthly, vipMonthly, year) => {
    // Q1: sum of codes (Jan-Mar) / sum of vips (Jan-Mar)
    let q1Codes = 0, q1Vips = 0;
    for (let i = 0; i < 3; i++) {
      if (!isMonthExcluded(year, i)) {
        q1Codes += codeMonthly[i] || 0;
        q1Vips += vipMonthly[i] || 0;
      }
    }
    const q1 = q1Vips > 0 ? q1Codes / q1Vips : 0;

    // Q2: sum of codes (Apr-Jun) / sum of vips (Apr-Jun)
    let q2Codes = 0, q2Vips = 0;
    for (let i = 3; i < 6; i++) {
      if (!isMonthExcluded(year, i)) {
        q2Codes += codeMonthly[i] || 0;
        q2Vips += vipMonthly[i] || 0;
      }
    }
    const q2 = q2Vips > 0 ? q2Codes / q2Vips : 0;

    // Q3: sum of codes (Jul-Sep) / sum of vips (Jul-Sep)
    let q3Codes = 0, q3Vips = 0;
    for (let i = 6; i < 9; i++) {
      if (!isMonthExcluded(year, i)) {
        q3Codes += codeMonthly[i] || 0;
        q3Vips += vipMonthly[i] || 0;
      }
    }
    const q3 = q3Vips > 0 ? q3Codes / q3Vips : 0;

    // Q4: sum of codes (Oct-Dec) / sum of vips (Oct-Dec)
    let q4Codes = 0, q4Vips = 0;
    for (let i = 9; i < 12; i++) {
      if (!isMonthExcluded(year, i)) {
        q4Codes += codeMonthly[i] || 0;
        q4Vips += vipMonthly[i] || 0;
      }
    }
    const q4 = q4Vips > 0 ? q4Codes / q4Vips : 0;

    // YTD: sum of codes (up to last completed month) / sum of vips (up to last completed month)
    const today = new Date();
    const monthsToConsider = Math.max(0, today.getMonth()); // Exclude current month
    let ytdCodes = 0, ytdVips = 0;
    for (let i = 0; i < monthsToConsider; i++) {
      if (!isMonthExcluded(year, i)) {
        ytdCodes += codeMonthly[i] || 0;
        ytdVips += vipMonthly[i] || 0;
      }
    }
    const ytd = ytdVips > 0 ? ytdCodes / ytdVips : 0;

    // Full year: sum of all codes / sum of all vips
    let fullYearCodes = 0, fullYearVips = 0;
    for (let i = 0; i < 12; i++) {
      if (!isMonthExcluded(year, i)) {
        fullYearCodes += codeMonthly[i] || 0;
        fullYearVips += vipMonthly[i] || 0;
      }
    }
    const fullYear = fullYearVips > 0 ? fullYearCodes / fullYearVips : 0;

    // Return array: [Q1, Q2, Q3, Q4, YTD, Full Year]
    return [q1, q2, q3, q4, ytd, fullYear];
  };

  const prevRatios = calculatePeriodRatios(prevCodeMonthly, prevVipMonthly, lastYear);
  const currRatios = calculatePeriodRatios(currCodeMonthly, currVipMonthly, currentYear);

  // Growth and % growth (lower Code/VIP is better: a decrease is positive growth)
  const growthData = currRatios.map((curr, i) => {
    const prev = prevRatios[i];
    const diff = curr - prev;
    return {
      value: Math.abs(diff),
      className: diff < 0 ? "growth-positive" : diff > 0 ? "growth-negative" : "",
    };
  });

  const percentGrowthData = currRatios.map((curr, i) => {
    const prev = prevRatios[i];
    if (prev === 0) return { value: "N/A", className: "" };
    const pct = ((curr - prev) / prev) * 100;
    return { value: Math.abs(pct), className: pct < 0 ? "growth-positive" : pct > 0 ? "growth-negative" : "" };
  });

  // Define headers to show: Q1, Q2, Q3, Q4, YTD, Previous Year
  const displayHeaders = ["Q1 ", "Q2 ", "Q3 ", "Q4 ", "YTD ", `${currentYear - 1}`];

  return (
    <div className="atlas-scorecard-section">
      <h5>Code / VIP Ratios</h5>
      <div style={{ overflowX: "auto" }}>
        <div className="atlas-scorecard-custom-table-container">
          <table className="atlas-scorecard-custom-table">
            <thead>
              <tr>
                <th>Year</th>
                {displayHeaders.map((header, index) => (
                    <th
                      key={index}
                      className={
                      index < 4
                          ? "atlas-scorecard-quarter-header"
                        : index === 4
                            ? "atlas-scorecard-ytd-header"
                          : "atlas-scorecard-prev-year-header"
                      }
                    >
                    {header}
                    </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{lastYear}</td>
                {prevRatios.map((val, index) => (
                    <td
                      key={index}
                    className={
                      index < 4
                        ? "atlas-scorecard-quarter-cell"
                        : index === 4
                          ? "atlas-scorecard-ytd-cell"
                          : "atlas-scorecard-prev-year-cell"
                    }
                  >
                    {ratioFormatter(val)}
                    </td>
                ))}
              </tr>
              <tr>
                <td>{currentYear}</td>
                {currRatios.map((val, index) => (
                    <td
                      key={index}
                    className={
                      index < 4
                        ? "atlas-scorecard-quarter-cell"
                        : index === 4
                          ? "atlas-scorecard-ytd-cell"
                          : "atlas-scorecard-prev-year-cell"
                    }
                  >
                    {index === 5 ? "—" : ratioFormatter(val)}
                    </td>
                ))}
              </tr>
              <tr className="atlas-scorecard-growth-row">
                <td>Growth</td>
                {growthData.map(({ value, className }, index) => (
                  <td key={index} className={className}>
                    {index === 5 ? "—" : ratioFormatter(value)}
                    </td>
                ))}
              </tr>
              <tr className="atlas-scorecard-percentage-row">
                <td>%</td>
                {percentGrowthData.map((data, index) => (
                  <td key={index} className={data.className}>
                    {index === 5 ? "—" : (data.value === "N/A" ? "N/A" : `${data.value.toFixed(1)}%`)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <hr />
    </div>
  );
};

// New helper: render the ALP/Code ratio table (ALP divided by Codes)
const renderAlpCodeRatioTable = () => {
  const ratioFormatter = (num) => Number(num).toFixed(2);

  // Build monthly counts for Codes
  const codesGrouped = groupByMonthAndYear(associatesData, "PRODDATE");

  const prevCodeMonthly = codesGrouped[lastYear] || Array(12).fill(0);
  const currCodeMonthly = codesGrouped[currentYear] || Array(12).fill(0);

  // ALP data is already grouped by year
  const prevAlpMonthly = alpData[lastYear] || Array(12).fill(0);
  const currAlpMonthly = alpData[currentYear] || Array(12).fill(0);

  // Helper to check if month is excluded due to MGA start date
  const isMonthExcluded = (year, monthIndex) => {
    if (!mgaStartDate || !year) return false;
    const monthEndDate = new Date(year, monthIndex + 1, 0);
    return monthEndDate < mgaStartDate;
  };

  // Calculate ratios using sum of ALP / sum of codes for each period
  const calculatePeriodRatios = (alpMonthly, codeMonthly, year) => {
    // Q1: sum of ALP (Jan-Mar) / sum of codes (Jan-Mar)
    let q1Alp = 0, q1Codes = 0;
    for (let i = 0; i < 3; i++) {
      if (!isMonthExcluded(year, i)) {
        q1Alp += alpMonthly[i] || 0;
        q1Codes += codeMonthly[i] || 0;
      }
    }
    const q1 = q1Codes > 0 ? q1Alp / q1Codes : 0;

    // Q2: sum of ALP (Apr-Jun) / sum of codes (Apr-Jun)
    let q2Alp = 0, q2Codes = 0;
    for (let i = 3; i < 6; i++) {
      if (!isMonthExcluded(year, i)) {
        q2Alp += alpMonthly[i] || 0;
        q2Codes += codeMonthly[i] || 0;
      }
    }
    const q2 = q2Codes > 0 ? q2Alp / q2Codes : 0;

    // Q3: sum of ALP (Jul-Sep) / sum of codes (Jul-Sep)
    let q3Alp = 0, q3Codes = 0;
    for (let i = 6; i < 9; i++) {
      if (!isMonthExcluded(year, i)) {
        q3Alp += alpMonthly[i] || 0;
        q3Codes += codeMonthly[i] || 0;
      }
    }
    const q3 = q3Codes > 0 ? q3Alp / q3Codes : 0;

    // Q4: sum of ALP (Oct-Dec) / sum of codes (Oct-Dec)
    let q4Alp = 0, q4Codes = 0;
    for (let i = 9; i < 12; i++) {
      if (!isMonthExcluded(year, i)) {
        q4Alp += alpMonthly[i] || 0;
        q4Codes += codeMonthly[i] || 0;
      }
    }
    const q4 = q4Codes > 0 ? q4Alp / q4Codes : 0;

    // YTD: sum of ALP (up to last completed month) / sum of codes (up to last completed month)
    const today = new Date();
    const monthsToConsider = Math.max(0, today.getMonth()); // Exclude current month
    let ytdAlp = 0, ytdCodes = 0;
    for (let i = 0; i < monthsToConsider; i++) {
      if (!isMonthExcluded(year, i)) {
        ytdAlp += alpMonthly[i] || 0;
        ytdCodes += codeMonthly[i] || 0;
      }
    }
    const ytd = ytdCodes > 0 ? ytdAlp / ytdCodes : 0;

    // Full year: sum of all ALP / sum of all codes
    let fullYearAlp = 0, fullYearCodes = 0;
    for (let i = 0; i < 12; i++) {
      if (!isMonthExcluded(year, i)) {
        fullYearAlp += alpMonthly[i] || 0;
        fullYearCodes += codeMonthly[i] || 0;
      }
    }
    const fullYear = fullYearCodes > 0 ? fullYearAlp / fullYearCodes : 0;

    // Return array: [Q1, Q2, Q3, Q4, YTD, Full Year]
    return [q1, q2, q3, q4, ytd, fullYear];
  };

  const prevRatios = calculatePeriodRatios(prevAlpMonthly, prevCodeMonthly, lastYear);
  const currRatios = calculatePeriodRatios(currAlpMonthly, currCodeMonthly, currentYear);

  // Growth and % growth (higher ALP/Code is better: an increase is positive growth)
  const growthData = currRatios.map((curr, i) => {
    const prev = prevRatios[i];
    const diff = curr - prev;
    return {
      value: Math.abs(diff),
      className: diff > 0 ? "growth-positive" : diff < 0 ? "growth-negative" : "",
    };
  });

  const percentGrowthData = currRatios.map((curr, i) => {
    const prev = prevRatios[i];
    if (prev === 0) return { value: "N/A", className: "" };
    const pct = ((curr - prev) / prev) * 100;
    return { value: Math.abs(pct), className: pct > 0 ? "growth-positive" : pct < 0 ? "growth-negative" : "" };
  });

  // Define headers to show: Q1, Q2, Q3, Q4, YTD, Previous Year
  const displayHeaders = ["Q1 ", "Q2 ", "Q3 ", "Q4 ", "YTD ", `${currentYear - 1}`];

                  return (
    <div className="atlas-scorecard-section">
      <h5>ALP / Code Ratios</h5>
      <div style={{ overflowX: "auto" }}>
        <div className="atlas-scorecard-custom-table-container">
          <table className="atlas-scorecard-custom-table">
            <thead>
              <tr>
                <th>Year</th>
                {displayHeaders.map((header, index) => (
                  <th
                    key={index}
                    className={
                      index < 4
                        ? "atlas-scorecard-quarter-header"
                        : index === 4
                          ? "atlas-scorecard-ytd-header"
                          : "atlas-scorecard-prev-year-header"
                    }
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{lastYear}</td>
                {prevRatios.map((val, index) => (
                  <td
                    key={index}
                    className={
                      index < 4
                        ? "atlas-scorecard-quarter-cell"
                        : index === 4
                          ? "atlas-scorecard-ytd-cell"
                          : "atlas-scorecard-prev-year-cell"
                    }
                  >
                    {ratioFormatter(val)}
                    </td>
                ))}
              </tr>
              <tr>
                <td>{currentYear}</td>
                {currRatios.map((val, index) => (
                  <td
                    key={index}
                    className={
                      index < 4
                        ? "atlas-scorecard-quarter-cell"
                        : index === 4
                          ? "atlas-scorecard-ytd-cell"
                          : "atlas-scorecard-prev-year-cell"
                    }
                  >
                    {index === 5 ? "—" : ratioFormatter(val)}
                  </td>
                ))}
              </tr>
              <tr className="atlas-scorecard-growth-row">
                <td>Growth</td>
                {growthData.map(({ value, className }, index) => (
                  <td key={index} className={className}>
                    {index === 5 ? "—" : ratioFormatter(value)}
                  </td>
                ))}
              </tr>
              <tr className="atlas-scorecard-percentage-row">
                <td>%</td>
                {percentGrowthData.map((data, index) => (
                  <td key={index} className={data.className}>
                    {index === 5 ? "—" : (data.value === "N/A" ? "N/A" : `${data.value.toFixed(1)}%`)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <hr />
    </div>
  );
};

// Render YTD Summary Table
const renderYTDSummaryTable = () => {
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const today = new Date();
  const isCurrentYear = currentYear === today.getFullYear();
  const monthsToConsiderForHires = Math.max(1, today.getMonth() + 1); // Include current month for hires
  const monthsToConsiderForOthers = Math.max(0, today.getMonth()); // Exclude current month for others

  // Helper to check if month is excluded due to MGA start date
  const isMonthExcluded = (year, monthIndex) => {
    if (!mgaStartDate || !year) return false;
    const monthEndDate = new Date(year, monthIndex + 1, 0);
    return monthEndDate < mgaStartDate;
  };

  // Calculate YTD values for ALP
  const prevAlpMonthly = alpData[lastYear] || Array(12).fill(0);
  const currAlpMonthly = alpData[currentYear] || Array(12).fill(0);
  
  let prevAlpYTD = 0, currAlpYTD = 0;
  for (let i = 0; i < (isCurrentYear ? monthsToConsiderForOthers : 12); i++) {
    if (!isMonthExcluded(lastYear, i)) prevAlpYTD += prevAlpMonthly[i] || 0;
    if (!isMonthExcluded(currentYear, i)) currAlpYTD += currAlpMonthly[i] || 0;
  }

  // Calculate YTD values for Hires (includes current month)
  const prevHireMonthly = hiresData[lastYear] || Array(12).fill(0);
  const currHireMonthly = hiresData[currentYear] || Array(12).fill(0);
  
  let prevHiresYTD = 0, currHiresYTD = 0;
  for (let i = 0; i < 12; i++) {
    if (!isMonthExcluded(lastYear, i)) prevHiresYTD += prevHireMonthly[i] || 0;
  }
  for (let i = 0; i < (isCurrentYear ? monthsToConsiderForHires : 12); i++) {
    if (!isMonthExcluded(currentYear, i)) currHiresYTD += currHireMonthly[i] || 0;
  }

  // Calculate YTD values for Codes
  const codesGrouped = groupByMonthAndYear(associatesData, "PRODDATE");
  const prevCodeMonthly = codesGrouped[lastYear] || Array(12).fill(0);
  const currCodeMonthly = codesGrouped[currentYear] || Array(12).fill(0);
  
  let prevCodesYTD = 0, currCodesYTD = 0;
  for (let i = 0; i < (isCurrentYear ? monthsToConsiderForOthers : 12); i++) {
    if (!isMonthExcluded(lastYear, i)) prevCodesYTD += prevCodeMonthly[i] || 0;
    if (!isMonthExcluded(currentYear, i)) currCodesYTD += currCodeMonthly[i] || 0;
  }

  // Calculate YTD values for VIPs
  const vipsGrouped = groupByMonthAndYear(vipsData, "vip_month");
  const prevVipMonthly = vipsGrouped[lastYear] || Array(12).fill(0);
  const currVipMonthly = vipsGrouped[currentYear] || Array(12).fill(0);
  
  let prevVipsYTD = 0, currVipsYTD = 0;
  for (let i = 0; i < (isCurrentYear ? monthsToConsiderForOthers : 12); i++) {
    if (!isMonthExcluded(lastYear, i)) prevVipsYTD += prevVipMonthly[i] || 0;
    if (!isMonthExcluded(currentYear, i)) currVipsYTD += currVipMonthly[i] || 0;
  }

  // Calculate ratio YTDs
  const prevHireToCode = prevCodesYTD > 0 ? prevHiresYTD / prevCodesYTD : 0;
  const currHireToCode = currCodesYTD > 0 ? currHiresYTD / currCodesYTD : 0;

  const prevAlpCode = prevCodesYTD > 0 ? prevAlpYTD / prevCodesYTD : 0;
  const currAlpCode = currCodesYTD > 0 ? currAlpYTD / currCodesYTD : 0;

  const prevCodeVip = prevVipsYTD > 0 ? prevCodesYTD / prevVipsYTD : 0;
  const currCodeVip = currVipsYTD > 0 ? currCodesYTD / currVipsYTD : 0;

  // Calculate growth
  const alpGrowth = currAlpYTD - prevAlpYTD;
  const hiresGrowth = currHiresYTD - prevHiresYTD;
  const codesGrowth = currCodesYTD - prevCodesYTD;
  const vipsGrowth = currVipsYTD - prevVipsYTD;
  const hireToCodeGrowth = currHireToCode - prevHireToCode;
  const alpCodeGrowth = currAlpCode - prevAlpCode;
  const codeVipGrowth = currCodeVip - prevCodeVip;

  const ratioFormatter = (num) => Number(num).toFixed(2);

  return (
    <div className="atlas-scorecard-section">
      <h5>YTD Summary</h5>
      <div style={{ overflowX: "auto" }}>
        <div className="atlas-scorecard-custom-table-container">
          <table className="atlas-scorecard-custom-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>ALP</th>
                <th>Hires</th>
                <th>Codes</th>
                <th>VIPs</th>
                <th>Hire/Code</th>
                <th>ALP/Code</th>
                <th>Code/VIP</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{lastYear}</td>
                <td>{currencyFormatter.format(prevAlpYTD)}</td>
                <td>{prevHiresYTD}</td>
                <td>{prevCodesYTD}</td>
                <td>{prevVipsYTD}</td>
                <td>{ratioFormatter(prevHireToCode)}</td>
                <td>{ratioFormatter(prevAlpCode)}</td>
                <td>{ratioFormatter(prevCodeVip)}</td>
              </tr>
              <tr>
                <td>{currentYear}</td>
                <td>{currencyFormatter.format(currAlpYTD)}</td>
                <td>{currHiresYTD}</td>
                <td>{currCodesYTD}</td>
                <td>{currVipsYTD}</td>
                <td>{ratioFormatter(currHireToCode)}</td>
                <td>{ratioFormatter(currAlpCode)}</td>
                <td>{ratioFormatter(currCodeVip)}</td>
              </tr>
              <tr className="atlas-scorecard-growth-row">
                <td>Growth</td>
                <td className={alpGrowth > 0 ? "growth-positive" : alpGrowth < 0 ? "growth-negative" : ""}>
                  {currencyFormatter.format(alpGrowth)}
                </td>
                <td className={hiresGrowth > 0 ? "growth-positive" : hiresGrowth < 0 ? "growth-negative" : ""}>
                  {hiresGrowth}
                </td>
                <td className={codesGrowth > 0 ? "growth-positive" : codesGrowth < 0 ? "growth-negative" : ""}>
                  {codesGrowth}
                </td>
                <td className={vipsGrowth > 0 ? "growth-positive" : vipsGrowth < 0 ? "growth-negative" : ""}>
                  {vipsGrowth}
                </td>
                <td className={hireToCodeGrowth < 0 ? "growth-positive" : hireToCodeGrowth > 0 ? "growth-negative" : ""}>
                  {ratioFormatter(Math.abs(hireToCodeGrowth))}
                </td>
                <td className={alpCodeGrowth > 0 ? "growth-positive" : alpCodeGrowth < 0 ? "growth-negative" : ""}>
                  {ratioFormatter(Math.abs(alpCodeGrowth))}
                </td>
                <td className={codeVipGrowth < 0 ? "growth-positive" : codeVipGrowth > 0 ? "growth-negative" : ""}>
                  {ratioFormatter(Math.abs(codeVipGrowth))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <hr />
    </div>
  );
};


  const renderSummedTable = (title, data, dateField, isGrouped = false, isCurrency = true) => {
    const currentDetails = selectedTableDetails[title];
  
    if (currentDetails) {
      const { data: detailData, month: monthInfo, year } = currentDetails;
  
      if (title === "VIPs") {
        // Group by MGA and count VIPs per MGA
        const mgaCounts = (Array.isArray(detailData) ? detailData : [detailData]).reduce(
          (acc, item) => {
            const mgaName = item.mga || "Unknown";
            if (!acc[mgaName]) {
              acc[mgaName] = {
                count: 0,
                agents: new Set(),
                totalGrossAlp: 0
              };
            }
            acc[mgaName].count++;
            if (item.lagnname) {
              acc[mgaName].agents.add(item.lagnname);
            }
            // Sum gross ALP
            const grossAlp = parseFloat(item.gs) || 0;
            acc[mgaName].totalGrossAlp += grossAlp;
            return acc;
          },
          {}
        );
  
        // Convert to array and sort by count descending
        const sortedMgas = Object.entries(mgaCounts)
          .map(([mga, data]) => ({
            mga,
            count: data.count,
            uniqueAgents: data.agents.size,
            totalGrossAlp: data.totalGrossAlp
          }))
          .sort((a, b) => b.count - a.count);
        
        const totalVips = sortedMgas.reduce((sum, m) => sum + m.count, 0);
        const totalGrossAlp = sortedMgas.reduce((sum, m) => sum + m.totalGrossAlp, 0);
  
        return (
          <div className="atlas-scorecard-section">
            <h5>{`${title} > ${monthInfo.label} '${String(year).slice(-2)}`}</h5>
            <button
              className="insured-button"
              onClick={() =>
                setSelectedTableDetails((prev) => {
                  const updated = { ...prev };
                  delete updated[title];
                  return updated;
                })
              }
            >
              Back
            </button>
            <div style={{ marginBottom: '1rem', color: '#666', fontSize: '0.875rem' }}>
              {sortedMgas.length} {sortedMgas.length === 1 ? 'MGA' : 'MGAs'} • {totalVips} Total VIPs
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', background: '#f8f9fa' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>MGA</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>VIPs</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Unique Agents</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Total Gross ALP</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMgas.map((mga, index) => (
                    <tr 
                      key={index}
                      style={{ 
                        borderBottom: '1px solid #eee',
                        background: index % 2 === 0 ? 'white' : '#f8f9fa'
                      }}
                    >
                      <td style={{ padding: '0.75rem' }}>{formatName(mga.mga)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{mga.count}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{mga.uniqueAgents}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(mga.totalGrossAlp)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid #ddd', fontWeight: 'bold', background: '#f0f8ff' }}>
                    <td style={{ padding: '0.75rem' }}>TOTAL</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalVips}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>—</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(totalGrossAlp)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      }
      
      if (title === "Hires") {
        // Group by MGA and count hires per MGA
        const mgaCounts = (Array.isArray(detailData) ? detailData : [detailData]).reduce(
          (acc, item) => {
            const mgaName = item.mga || item.MGA || "Unknown";
            if (!acc[mgaName]) {
              acc[mgaName] = {
                totalHires: 0,
                agents: new Set()
              };
            }
            const hireCount = parseFloat(item.Total_Hires) || 1;
            acc[mgaName].totalHires += hireCount;
            if (item.lagnname) {
              acc[mgaName].agents.add(item.lagnname);
            }
            return acc;
          },
          {}
        );
  
        // Convert to array and sort by total hires descending
        const sortedMgas = Object.entries(mgaCounts)
          .map(([mga, data]) => ({
            mga,
            totalHires: data.totalHires,
            uniqueAgents: data.agents.size
          }))
          .sort((a, b) => b.totalHires - a.totalHires);
        
        const totalHires = sortedMgas.reduce((sum, m) => sum + m.totalHires, 0);
  
        return (
          <div className="atlas-scorecard-section">
            <h5>{`${title} > ${monthInfo.label} '${String(year).slice(-2)}`}</h5>
            <button
              className="insured-button"
              onClick={() =>
                setSelectedTableDetails((prev) => {
                  const updated = { ...prev };
                  delete updated[title];
                  return updated;
                })
              }
            >
              Back
            </button>
            <div style={{ marginBottom: '1rem', color: '#666', fontSize: '0.875rem' }}>
              {sortedMgas.length} {sortedMgas.length === 1 ? 'MGA' : 'MGAs'} • {totalHires} Total Hires
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', background: '#f8f9fa' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>MGA</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Hires</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Unique Agents</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMgas.map((mga, index) => (
                    <tr 
                      key={index}
                      style={{ 
                        borderBottom: '1px solid #eee',
                        background: index % 2 === 0 ? 'white' : '#f8f9fa'
                      }}
                    >
                      <td style={{ padding: '0.75rem' }}>{formatName(mga.mga)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{mga.totalHires.toFixed(1)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{mga.uniqueAgents}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid #ddd', fontWeight: 'bold', background: '#f0f8ff' }}>
                    <td style={{ padding: '0.75rem' }}>TOTAL</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalHires.toFixed(1)}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      }
  
      if (currentDetails && title === "Submitting Agent Count") {
        return (
          <div className="atlas-scorecard-section">
            <h5>{`${title} > ${currentDetails.month.label} '${String(currentDetails.year).slice(-2)}`}</h5>
            <button
              className="insured-button"
              onClick={() =>
                setSelectedTableDetails((prev) => {
                  const updated = { ...prev };
                  delete updated[title];
                  return updated;
                })
              }
            >
              Back
            </button>
            <div className="details-view">
              <table className="hierarchyTable">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Period</th>
                    <th>Unique Count</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDetails.data.map((weekDetail, idx) => {
                    const startDate = new Date(weekDetail.startDate);
                    const endDate = new Date(weekDetail.endDate);
                    const startFormatted = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
                    const endFormatted = `${endDate.getMonth() + 1}/${endDate.getDate()}`;
                    return (
                      <tr key={idx}>
                        <td>{`Week ${idx + 1}`}</td>
                        <td>{`${startFormatted} - ${endFormatted}`}</td>
                        <td>{weekDetail.count}</td>
                      </tr>
                    );
                  })}
                              </tbody>
            </table>
          </div>
        </div>
        );
      }
      
      
      if (title === "Codes") {
        // Group by MGA and count codes per MGA
        const mgaCounts = (Array.isArray(detailData) ? detailData : [detailData]).reduce(
          (acc, item) => {
            const mgaName = item.MGA || "Unknown";
            if (!acc[mgaName]) {
              acc[mgaName] = {
                count: 0,
                agents: new Set()
              };
            }
            acc[mgaName].count++;
            if (item.LagnName) {
              acc[mgaName].agents.add(item.LagnName);
            }
            return acc;
          },
          {}
        );
  
        // Convert to array and sort by count descending
        const sortedMgas = Object.entries(mgaCounts)
          .map(([mga, data]) => ({
            mga,
            count: data.count,
            uniqueAgents: data.agents.size
          }))
          .sort((a, b) => b.count - a.count);
        
        const totalCodes = sortedMgas.reduce((sum, m) => sum + m.count, 0);
  
        return (
          <div className="atlas-scorecard-section">
            <h5>{`${title} > ${monthInfo.label} '${String(year).slice(-2)}`}</h5>
            <button
              className="insured-button"
              onClick={() =>
                setSelectedTableDetails((prev) => {
                  const updated = { ...prev };
                  delete updated[title];
                  return updated;
                })
              }
            >
              Back
            </button>
            <div style={{ marginBottom: '1rem', color: '#666', fontSize: '0.875rem' }}>
              {sortedMgas.length} {sortedMgas.length === 1 ? 'MGA' : 'MGAs'} • {totalCodes} Total Codes
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', background: '#f8f9fa' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>MGA</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Codes</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Unique Agents</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMgas.map((mga, index) => (
                    <tr 
                      key={index}
                      style={{ 
                        borderBottom: '1px solid #eee',
                        background: index % 2 === 0 ? 'white' : '#f8f9fa'
                      }}
                    >
                      <td style={{ padding: '0.75rem' }}>{formatName(mga.mga)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{mga.count}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{mga.uniqueAgents}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid #ddd', fontWeight: 'bold', background: '#f0f8ff' }}>
                    <td style={{ padding: '0.75rem' }}>TOTAL</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalCodes}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      }
    }
  
    const currencyFormatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  
    const monthIndexToDataIndex = (index) => {
      switch (index) {
        case 0:
          return { isMonth: true, monthIndex: 0, label: "Jan" };
        case 1:
          return { isMonth: true, monthIndex: 1, label: "Feb" };
        case 2:
          return { isMonth: true, monthIndex: 2, label: "Mar" };
        case 3:
          return { isMonth: false, label: "Q1" };
        case 4:
          return { isMonth: true, monthIndex: 3, label: "Apr" };
        case 5:
          return { isMonth: true, monthIndex: 4, label: "May" };
        case 6:
          return { isMonth: true, monthIndex: 5, label: "Jun" };
        case 7:
          return { isMonth: false, label: "Q2" };
        case 8:
          return { isMonth: true, monthIndex: 6, label: "Jul" };
        case 9:
          return { isMonth: true, monthIndex: 7, label: "Aug" };
        case 10:
          return { isMonth: true, monthIndex: 8, label: "Sep" };
        case 11:
          return { isMonth: false, label: "Q3" };
        case 12:
          return { isMonth: true, monthIndex: 9, label: "Oct" };
        case 13:
          return { isMonth: true, monthIndex: 10, label: "Nov" };
        case 14:
          return { isMonth: true, monthIndex: 11, label: "Dec" };
        case 15:
          return { isMonth: false, label: "Q4" };
        case 16:
          return { isMonth: false, label: "YTD" };
        case 17:
          return { isMonth: false, label: `${currentYear - 1}` };
        default:
          return { isMonth: false, label: "" };
      }
    };
  
    const handleCellClickWrapper = (dataItem, monthInfo, year) => {
      if (!monthInfo.isMonth) return;
      handleCellClick(title, dataItem, monthInfo, year);
    };
  
    let currentYearData = [];
    let previousYearData = [];
  
    if (isGrouped) {
      currentYearData = data[currentYear] || Array(12).fill(0);
      previousYearData = data[previousYear] || Array(12).fill(0);
    } else {
      const groupedData = groupByMonthAndYear(data, dateField);
      currentYearData = groupedData[currentYear] || Array(12).fill(0);
      previousYearData = groupedData[previousYear] || Array(12).fill(0);
    }
  
    let currentYearWithQuarters, previousYearWithQuarters;
    if (title === "Submitting Agent Count") {
      currentYearWithQuarters = calculateQuarterAverages(currentYearData, null, currentYear);
      previousYearWithQuarters = calculateQuarterAverages(previousYearData, previousYearData, previousYear);

      // YTD for management count tables should use last month's number (exclude current month)
      const todayLocal = new Date();
      const monthsToUse = Math.max(0, todayLocal.getMonth());
      const lastCompletedIdx = monthsToUse - 1;
      const isMonthExcludedForYear = (yr, mIdx) => {
        if (!mgaStartDate) return false;
        const monthEndDate = new Date(yr, mIdx + 1, 0);
        return monthEndDate < mgaStartDate;
      };

      // Current year YTD: value at last completed month index
      let currentYtdVal = 0;
      if (lastCompletedIdx >= 0 && !isMonthExcludedForYear(currentYear, lastCompletedIdx)) {
        currentYtdVal = Number(currentYearData[lastCompletedIdx] || 0);
      }
      currentYearWithQuarters[16] = currentYtdVal;

      // Previous year YTD: value at the same month index from previous year
      let prevYtdVal = 0;
      if (lastCompletedIdx >= 0 && !isMonthExcludedForYear(previousYear, lastCompletedIdx)) {
        prevYtdVal = Number(previousYearData[lastCompletedIdx] || 0);
      }
      previousYearWithQuarters[16] = prevYtdVal;

      // Adjust Previous Year column (index 17) to AVG of full last year of months
      const prevMonthsAll = previousYearData
        .map((v, idx) => ({ v, idx }))
        .filter(x => !isMonthExcludedForYear(previousYear, x.idx));
      const prevYearFullAvg = prevMonthsAll.length
        ? prevMonthsAll.reduce((sum, x) => sum + (Number(x.v) || 0), 0) / prevMonthsAll.length
        : 0;
      previousYearWithQuarters[17] = prevYearFullAvg;

    } else if (title === "Hires") {
      // For Hires table, use sums for both current year and previous year (full previous year sum in last column)
      currentYearWithQuarters = calculateQuarterSums(currentYearData, null, currentYear);
      previousYearWithQuarters = calculateQuarterSums(previousYearData, previousYearData, previousYear);
    } else {
      currentYearWithQuarters = calculateQuarterSums(currentYearData, null, currentYear);
      previousYearWithQuarters = calculateQuarterSums(previousYearData, previousYearData, previousYear);
    }
    
  
    const growthData = currentYearWithQuarters.map((current, index) => {
      let previousValue = previousYearWithQuarters[index];
      const monthInfo = monthIndexToDataIndex(index);
      // For Submitting Agent Count, YTD (index 16) growth should compare avg-to-date vs avg-to-date (already set above)
      // So skip overriding previousValue for index 16 in that table
      if (title !== "Submitting Agent Count" && index === 16 && currentYear === today.getFullYear()) {
        // For other tables, previous YTD uses months up to last completed month, not including current
        previousValue = previousYearData.slice(0, Math.max(0, today.getMonth())).reduce((sum, val) => sum + val, 0);
      }
      let growth = current - previousValue;
      // For monthly cells in the current year that haven't passed yet, force growth to 0.
      if (
        monthInfo.isMonth &&
        currentYear === today.getFullYear() &&
        monthInfo.monthIndex > today.getMonth()
      ) {
        growth = 0;
      }
      // For the previous year column (index 17), there's no growth comparison
      if (index === 17) {
        growth = 0;
      }
      return {
        value: growth,
        className: growth > 0 ? "growth-positive" : growth < 0 ? "growth-negative" : "",
      };
    });
    
    
    const percentGrowthData = currentYearWithQuarters.map((current, index) => {
      let previousValue = previousYearWithQuarters[index];
      const monthInfo = monthIndexToDataIndex(index);
      // For Submitting Agent Count, YTD (index 16) compares avg-to-date vs avg-to-date, so don't override previousValue
      if (title !== "Submitting Agent Count" && index === 16 && currentYear === today.getFullYear()) {
        previousValue = previousYearData.slice(0, Math.max(0, today.getMonth())).reduce((sum, val) => sum + val, 0);
      }
      let pct;
      if (previousValue === 0) {
        pct = "N/A";
      } else {
        pct = ((current - previousValue) / previousValue) * 100;
      }
      // For monthly cells in the current year that haven't passed yet, force percentage growth to 0.
      if (
        monthInfo.isMonth &&
        currentYear === today.getFullYear() &&
        monthInfo.monthIndex > today.getMonth()
      ) {
        pct = 0;
      }
      // For the previous year column (index 17), there's no percentage growth comparison
      if (index === 17) {
        pct = "N/A";
      }
      return {
        value: pct,
        className:
          pct !== "N/A" && pct > 0 ? "growth-positive" : pct !== "N/A" && pct < 0 ? "growth-negative" : "",
      };
    });
    
  
    return (
      <div className="atlas-scorecard-section">
        <h5>{title}</h5>
        <div style={{ overflowX: "auto" }}>
        <div className="atlas-scorecard-custom-table-container">
          <table className="atlas-scorecard-custom-table">
            <thead>
              <tr>
                <th>Year</th>
                {months.map((month, index) => {
                  const isQuarter = isQuarterColumn(index);
                  const isFuture = isMonthIndexFuture(index);
                  
                  // Check if column should be shown based on quarters mode and future months toggle
                  if (!shouldShowColumn(index, isQuarter, isFuture)) {
                    return null;
                  }
                  
                  return (
                    <th
                      key={index}
                      className={
                        index === 3 || index === 7 || index === 11 || index === 15
                          ? "atlas-scorecard-quarter-header"
                          : index === 16
                          ? "atlas-scorecard-ytd-header"
                          : index === 17
                          ? "atlas-scorecard-prev-year-header"
                          : ""
                      }
                    >
                      {month}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
            <tr>
  <td>{previousYear}</td>
  {previousYearWithQuarters.map((value, index) => {
    const isQuarter = isQuarterColumn(index);
    const isFuture = isMonthIndexFuture(index);
    
    // Check if column should be shown based on quarters mode and future months toggle
    if (!shouldShowColumn(index, isQuarter, isFuture)) {
      return null;
    }
    
    const monthInfo = monthIndexToDataIndex(index);
    // For Submitting Agent Count: YTD (index 16) in previous-year row should be AVG of full last year
    let cellValue = value;
    if (title === "Submitting Agent Count" && index === 16) {
      // Use the precomputed previousYearWithQuarters YTD value, which
      // is the AVG up to last completed month (excludes current month)
      cellValue = previousYearWithQuarters[16];
    } else if (index === 16) {
      // Use up to last completed month for YTD comparison
      cellValue = (currentYear === today.getFullYear()
        ? previousYearData.slice(0, Math.max(0, today.getMonth())).reduce((sum, val) => sum + val, 0)
        : value);
    }

  const isQuarterCell = !monthInfo.isMonth;
  const isPreStart = monthInfo.isMonth && shouldGreyOutCell(monthInfo.monthIndex, previousYear);
  const validData = Array.isArray(data) ? data : [];
  const dataItem = monthInfo.isMonth
    ? title === "Submitting Agent Count"
        ? // Instead of filtering the aggregated value, look up the week details:
          (subAgentWeeks[previousYear] && subAgentWeeks[previousYear][monthInfo.monthIndex]) || []
        : validData.filter((item) => {
            let itemDate = null;
            if (title === "VIPs") {
              itemDate = new Date(item.vip_month);
            } else if (title === "Codes") {
              itemDate = parseDateWithoutTime(item.PRODDATE);
            }
            return (
              itemDate &&
              itemDate.getMonth() === monthInfo.monthIndex &&
              itemDate.getFullYear() === previousYear
            );
          })
    : null;
  
  
  const isClickable = dataItem && dataItem.length > 0 && !isPreStart;
  return (
    <td
      key={index}
      className={`
        ${isQuarterCell ? "atlas-scorecard-quarter-cell" : ""}
        ${index === 16 ? "atlas-scorecard-ytd-cell" : ""}
        ${index === 17 ? "atlas-scorecard-prev-year-cell" : ""}
        ${isClickable ? "has-data" : ""}
        ${isPreStart ? "atlas-scorecard-pre-start-cell" : ""}
      `}
      title={isClickable ? "Details available" : isPreStart ? "Pre-start data" : ""}
      onClick={
        isClickable ? () => handleCellClickWrapper(dataItem, monthInfo, previousYear) : null
      }
    >
      {isPreStart ? "—" : (isCurrency ? currencyFormatter.format(cellValue) : cellValue)}
    </td>
  );
  
  })}
</tr>

                            <tr>
                <td>{currentYear}</td>
                {currentYearWithQuarters.map((value, index) => {
                  const isQuarter = isQuarterColumn(index);
                  const isFuture = isMonthIndexFuture(index);
                  
                  // Check if column should be shown based on quarters mode and future months toggle
                  if (!shouldShowColumn(index, isQuarter, isFuture)) {
                    return null;
                  }
                  
                  const monthInfo = monthIndexToDataIndex(index);
                  const isQuarterCell = !monthInfo.isMonth;
                  const isFutureMonth = monthInfo.isMonth && isMonthInFuture(currentYear, monthInfo.monthIndex);
                  const isPreStart = monthInfo.isMonth && shouldGreyOutCell(monthInfo.monthIndex, currentYear);
                  const validData = Array.isArray(data) ? data : [];
                  const dataItem = monthInfo.isMonth
                    ? title === "Submitting Agent Count"
                        ? (subAgentWeeks[currentYear] && subAgentWeeks[currentYear][monthInfo.monthIndex]) || []
                        : validData.filter((item) => {
                            let itemDate = null;
                            if (title === "VIPs") {
                              itemDate = new Date(item.vip_month);
                            } else if (title === "Codes") {
                              itemDate = new Date(item.PRODDATE.split("T")[0]);
                            }
                            return (
                              itemDate &&
                              itemDate.getMonth() === monthInfo.monthIndex &&
                              itemDate.getFullYear() === currentYear
                            );
                          })
                    : null;
                  
                
                  const isClickable = dataItem && dataItem.length > 0 && !isFutureMonth && !isPreStart;

                  return (
                    <td
                      key={index}
                      className={`
        ${isQuarterCell ? "atlas-scorecard-quarter-cell" : ""}
        ${index === 16 ? "atlas-scorecard-ytd-cell" : ""}
        ${index === 17 ? "atlas-scorecard-prev-year-cell" : ""}
        ${isClickable ? "has-data" : ""}
        ${isPreStart ? "atlas-scorecard-pre-start-cell" : ""}
      `}
                      title={isClickable ? "Details available" : isPreStart ? "Pre-start data" : ""}
                      onClick={isClickable ? () => handleCellClickWrapper(dataItem, monthInfo, currentYear) : null}
                    >
                      {isFutureMonth || isPreStart ? "—" : (isCurrency ? currencyFormatter.format(value) : value)}
                    </td>
                  );
                })}
              </tr>
              <tr className="atlas-scorecard-growth-row">
                <td>Growth</td>
                {growthData.map(({ value, className }, index) => {
                  const isQuarter = isQuarterColumn(index);
                  const isFuture = isMonthIndexFuture(index);
                  
                  // Check if column should be shown based on quarters mode and future months toggle
                  if (!shouldShowColumn(index, isQuarter, isFuture)) {
                    return null;
                  }
                  
                  const monthInfo = monthIndexToDataIndex(index);
                  const isFutureMonth = monthInfo.isMonth && isMonthInFuture(currentYear, monthInfo.monthIndex);
                  const isPreStart = monthInfo.isMonth && shouldGreyOutCell(monthInfo.monthIndex, currentYear);
                  return (
                    <td key={index} className={`${className} ${isPreStart ? "atlas-scorecard-pre-start-cell" : ""}`}>
                      {isFutureMonth || isPreStart ? "—" : (isCurrency ? currencyFormatter.format(value) : value)}
                    </td>
                  );
                })}
              </tr>
              <tr className="atlas-scorecard-percentage-row">
  <td>%</td>
  {percentGrowthData.map((data, index) => {
    const isQuarter = isQuarterColumn(index);
    const isFuture = isMonthIndexFuture(index);
    
    // Check if column should be shown based on quarters mode and future months toggle
    if (!shouldShowColumn(index, isQuarter, isFuture)) {
      return null;
    }
    
    const monthInfo = monthIndexToDataIndex(index);
    const isFutureMonth = monthInfo.isMonth && isMonthInFuture(currentYear, monthInfo.monthIndex);
    const isPreStart = monthInfo.isMonth && shouldGreyOutCell(monthInfo.monthIndex, currentYear);
    return (
      <td key={index} className={`${data.className} ${isPreStart ? "atlas-scorecard-pre-start-cell" : ""}`}>
        {isFutureMonth || isPreStart ? "—" : (data.value === "N/A" ? "N/A" : `${data.value.toFixed(1)}%`)}
      </td>
    );
  })}
</tr>

                      </tbody>
        </table>
        </div>
        </div>
        <hr />
      </div>
    );
  };
  
  
  return (
      <div className="atlas-scorecard-sga-view">
<div className="atlas-scorecard-controls">
  {/* Left side - tabs and dropdowns */}
  <div className="atlas-scorecard-controls-left">
    {filterMode !== 'rga' && ["SA", "GA", "MGA", "RGA"].includes(userRole) && (
      <div className="atlas-scorecard-tabs">
        <input
          type="radio"
          id="lvl1"
          name="alp_view"
          value="LVL_1"
          checked={selectedAlpTab === "LVL_1"}
          onChange={() => setSelectedAlpTab("LVL_1")}
        />
        <label htmlFor="lvl1">Personal</label>
        <input
          type="radio"
          id="lvl3"
          name="alp_view"
          value="LVL_3"
          checked={selectedAlpTab === "LVL_3"}
          onChange={() => setSelectedAlpTab("LVL_3")}
        />
        <label htmlFor="lvl3">Team</label>
      </div>
    )}
    
    {allowedRoles.includes(userRole) && (
      <div className="atlas-scorecard-mga-dropdown">
        <label htmlFor="mga-select">Select {filterMode === 'rga' ? 'RGA' : 'MGA'}: </label>
        <select
          id="mga-select"
          value={selectedMga}
          onChange={(e) => {
            console.log('👤 Dropdown changed to:', e.target.value, '| Filter mode:', filterMode);
            setSelectedMga(e.target.value);
          }}
        >
          {showAriasOrganization && filterMode !== 'rga' && (
            <option value="">ARIAS ORGANIZATION</option>
          )}
          {uniqueMgas.map((mga, index) => (
            <option key={index} value={mga.lagnname}>
              {mga.lagnname}
            </option>
          ))}
        </select>
      </div>
    )}

    <div className="atlas-scorecard-year-navigation">
      <button className="arrow-change-button" onClick={() => navigateYears("back")}>
        ←
      </button>
      <span>
        {lastYear} & {currentYear}
      </span>
      <button
        className="arrow-change-button"
        onClick={() => navigateYears("forward")}
        disabled={currentYear === new Date().getFullYear()}
      >
        →
      </button>
    </div>
  </div>

  {/* Right side - toggle buttons */}
  <div className="atlas-scorecard-controls-right">
    {/* Only show future months and quarters toggles when in table view */}
    {viewMode === 'table' && (
      <>
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
      </>
    )}

    <div className="atlas-scorecard-view-toggle">
      <button 
        className={`view-toggle-btn ${viewMode === 'table' ? 'table-mode' : 'graph-mode'}`}
        onClick={() => setViewMode(viewMode === 'table' ? 'graph' : 'table')}
        title={viewMode === 'table' ? 'Switch to Graph View' : 'Switch to Table View'}
      >
        {viewMode === 'table' ? (
          // Table view - show graph icon to switch to graph
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 12l4-4 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          // Graph view - show table icon to switch to table
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M9 3v18" stroke="currentColor" strokeWidth="2"/>
            <path d="M15 3v18" stroke="currentColor" strokeWidth="2"/>
            <path d="M3 9h18" stroke="currentColor" strokeWidth="2"/>
            <path d="M3 15h18" stroke="currentColor" strokeWidth="2"/>
          </svg>
        )}
      </button>
    </div>
  </div>
</div>


        <h1></h1>
        {/* Commenting out the view toggle for RGA
        {userRole === "RGA" && (
          <div className="view-toggle">
            <button
              className={selectedView === "a" ? "active" : ""}
              onClick={() => handleViewChange("a")}
            >
              View A
            </button>
            <button
              className={selectedView === "b" ? "active" : ""}
              onClick={() => handleViewChange("b")}
            >
              View B
            </button>
          </div>
        )} */}
          <>
            {viewMode === 'table' ? (
              // Table View
              <>
                {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && renderYTDSummaryTable()}
                {renderSummedTable("ALP", alpData, null, true, true)}
                {selectedAlpTab !== "LVL_1" && userRole !== "AGT" &&
                  renderSummedTable("Hires", hiresData, "MORE_Date", true, false)}
                {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && renderSummedTable("Codes", associatesData, "PRODDATE", false, false)}
                {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && renderSummedTable("VIPs", vipsData, "vip_month", false, false)}
                {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && renderHireToCodeTable()}
                {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && renderAlpCodeRatioTable()}
                {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && renderCodeVipRatioTable()}
                {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && filterMode !== 'rga' &&
                  renderSummedTable(
                    "Submitting Agent Count",
                    subAgentData,
                    null,
                    true,
                    false
                  )}
                    {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && renderSingleManagementTable("SA", "Management Count - SA")}
      {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && renderSingleManagementTable("GA", "Management Count - GA")}
      {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && !selectedMga && filterMode !== 'rga' && renderSingleManagementTable("MGA", "Management Count - MGA")}
      {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && !selectedMga && filterMode !== 'rga' && renderSingleManagementTable("RGA", "Management Count - RGA")}
      {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && renderSingleManagementTable("total", "Total Management Count")}
              </>
            ) : (
              // Graph View
              <>
                <LineGraph 
                  title="ALP" 
                  currentYearData={alpData[currentYear] || Array(12).fill(0)}
                  previousYearData={alpData[lastYear] || Array(12).fill(0)}
                  isCurrency={true}
                />
                {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && (
                  <LineGraph 
                    title="Codes" 
                    currentYearData={groupByMonthAndYear(associatesData, "PRODDATE")[currentYear] || Array(12).fill(0)}
                    previousYearData={groupByMonthAndYear(associatesData, "PRODDATE")[lastYear] || Array(12).fill(0)}
                    isCurrency={false}
                  />
                )}
                {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && (
                  <LineGraph 
                    title="VIPs" 
                    currentYearData={groupByMonthAndYear(vipsData, "vip_month")[currentYear] || Array(12).fill(0)}
                    previousYearData={groupByMonthAndYear(vipsData, "vip_month")[lastYear] || Array(12).fill(0)}
                    isCurrency={false}
                  />
                )}
                {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && (
                  <LineGraph 
                    title="Submitting Agent Count" 
                    currentYearData={subAgentData[currentYear] || Array(12).fill(0)}
                    previousYearData={subAgentData[lastYear] || Array(12).fill(0)}
                    isCurrency={false}
                  />
                )}
                {selectedAlpTab !== "LVL_1" && userRole !== "AGT" && (
                  <LineGraph 
                    title="Hires" 
                    currentYearData={hiresData[currentYear] || Array(12).fill(0)}
                    previousYearData={hiresData[lastYear] || Array(12).fill(0)}
                    isCurrency={false}
                  />
                )}
              </>
            )}
          </>
      
      </div>
  );
});

export default Scorecard;
