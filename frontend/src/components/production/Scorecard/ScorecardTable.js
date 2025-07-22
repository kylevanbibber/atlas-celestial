import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import api from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import "../../../pages/abc.css";
import Placeholder from "../../utils/Placeholder";

const Scorecard = memo(() => {
  // Get user data from auth context
  const { user } = useAuth();
  const userId = user?.userId;
  const userRole = user?.clname?.toUpperCase();
  const agnName = user?.lagnname; // Using lagnname as agent name

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
    (userRole === "MGA" || userRole === "RGA" || userRole === "SGA" || userRole === "Admin") ? "LVL_3" : "LVL_1"
  , [userRole]);
  
  const [selectedAlpTab, setSelectedAlpTab] = useState(defaultAlpTab);
  const [rawAlpData, setRawAlpData] = useState([]);
  
  const showAriasOrganization = useMemo(() => 
    userRole === "SGA" || ["ADMIN", "PARTNER", "STAFF"].includes(userRole)
  , [userRole]);
    
  const effectiveAgnName = useMemo(() =>
    (userRole === "MGA" || userRole === "RGA") && selectedMga
      ? selectedMga
      : agnName
  , [userRole, selectedMga, agnName]);
  
  const [selectedView, setSelectedView] = useState("a"); // Track the selected view
  const [uniqueMgas, setUniqueMgas] = useState([]); // State for MGA dropdown options
  
  useEffect(() => {
    // Fetch unique MGA options from the API endpoint
    api
      .get("/dataroutes/get-unique-mgas")
      .then((res) => {
        if (res.data.success) {
          const mgas = res.data.data; // Array of objects containing lagnname
          setUniqueMgas(mgas);
          // If agnName is not in the fetched list, default to empty string
          if (!mgas.some((mga) => mga.lagnname === agnName)) {
            setSelectedMga("");
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching unique MGAs:", err);
      });
  }, []);
  
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
  ], []);

  const monthLabels = useMemo(() => [
    "Jan", "Feb", "Mar",  // index 0,1,2
    "Apr", "May", "Jun",  // index 3,4,5
    "Jul", "Aug", "Sep",  // index 6,7,8
    "Oct", "Nov", "Dec",  // index 9,10,11
  ], []);

  const previousYear = useMemo(() => currentYear - 1, [currentYear]);

  // Memoize data processing functions
  const groupByMonthAndYear = useCallback((data, dateField) => {
    return data.reduce((acc, item) => {
      const date = new Date(item[dateField]);
      const month = date.getUTCMonth();
      const year = date.getUTCFullYear();
      
      if (!acc[year]) acc[year] = Array(12).fill(0);
      acc[year][month] += 1;
      
      return acc;
    }, {});
  }, []);
  
  const groupTotalHiresByMonthAndYear = useCallback((data, dateField) => {
    return data.reduce((acc, row) => {
      const date = new Date(row[dateField]);
      const month = date.getMonth();
      const year = date.getFullYear();
      if (!acc[year]) acc[year] = Array(12).fill(0);
      acc[year][month] += parseFloat(row.Total_Hires) || 0;
      return acc;
    }, {});
  }, []);
  
  const calculateQuarterSums = useCallback((monthlyData) => {
    const q1 = monthlyData.slice(0, 3).reduce((sum, value) => sum + value, 0);
    const q2 = monthlyData.slice(3, 6).reduce((sum, value) => sum + value, 0);
    const q3 = monthlyData.slice(6, 9).reduce((sum, value) => sum + value, 0);
    const q4 = monthlyData.slice(9, 12).reduce((sum, value) => sum + value, 0);
    const total = q1 + q2 + q3 + q4;

    return [...monthlyData.slice(0, 3), q1, ...monthlyData.slice(3, 6), q2, ...monthlyData.slice(6, 9), q3, ...monthlyData.slice(9, 12), q4, total];
  }, []);

  const calculateQuarterAverages = useCallback((monthlyData) => {
    const q1 = Math.round(monthlyData.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3);
    const q2 = Math.round(monthlyData.slice(3, 6).reduce((sum, value) => sum + value, 0) / 3);
    const q3 = Math.round(monthlyData.slice(6, 9).reduce((sum, value) => sum + value, 0) / 3);
    const q4 = Math.round(monthlyData.slice(9, 12).reduce((sum, value) => sum + value, 0) / 3);
    // Exclude current month from YTD calculation
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-indexed (0 = January, 11 = December)
    const monthsToInclude = currentMonth === 0 ? 0 : currentMonth; // If January, include 0 months (no YTD for current year), otherwise exclude current month
    const ytd = monthsToInclude === 0 ? 0 : Math.round(monthlyData.slice(0, monthsToInclude).reduce((sum, value) => sum + value, 0) / monthsToInclude);
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
    ];
  }, []);

  const calculateQuarterValuesForArray = useCallback((monthlyArray, currentYear) => {
    // monthlyArray: array of length 12 with a value for each month.
    // For quarterly columns, pick the value from March (index 2), June (index 5),
    // September (index 8), and December (index 11).
    const q1 = monthlyArray[2];
    const q2 = monthlyArray[5];
    const q3 = monthlyArray[8];
    const q4 = monthlyArray[11];
  
    // For YTD: if currentYear is the current calendar year, use the value up to the previous month;
    // otherwise, assume full-year data is available (use December).
    const today = new Date();
    const lastMonthIndex = (currentYear === today.getFullYear()) ? Math.max(0, today.getMonth() - 1) : 11;
    const ytd = monthlyArray[lastMonthIndex];
  
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
  }, []);
  
  
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
        const count = maxRows.filter(row => row.clname === role).length;
        if (!result[role][year]) result[role][year] = Array(12).fill(0);
        result[role][year][month] = count;
      });

      // Total count for this month: count rows with any of the allowed roles.
      const totalCount = maxRows.filter(row => roles.includes(row.clname)).length;
      if (!result.total[year]) result.total[year] = Array(12).fill(0);
      result.total[year][month] = totalCount;
    });

    return result;
  }, []);
  
  
    const processAlpData = useCallback((data, userRole, selectedAlpTab) => {
    // For SA, if user clicks on LVL_3 tab, use LVL_2_NET (as SA is level 2)
    const column =
      selectedAlpTab === "LVL_1"
        ? "LVL_1_NET"
        : userRole === "SA"
        ? "LVL_2_NET"
        : "LVL_3_NET";

    const groupedData = data.reduce((acc, row) => {
      const [month, year] = row.month.split("/").map(Number);
      const adjustedMonth = month - 1;
      if (!acc[year]) acc[year] = Array(12).fill(0);
      const value = parseFloat(row[column]?.replace(/[^\d.-]/g, "")) || 0;
      // If the cell is 0 or the row comes from MGA, update with the value
      if (acc[year][adjustedMonth] === 0 || row.CL_Name === "MGA") {
        acc[year][adjustedMonth] = value;
      }
      return acc;
    }, {});

    return groupedData;
  }, []);
  
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
          monthlyAveragesByYear[year][m] = 0;
          weeklyDetails[year][m] = [];
        }
      }
    });
    return { monthlyAveragesByYear, weeklyDetails };
  }, []);
  
  
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

      if (!agnName || !userRole) {
        console.warn("Waiting for user data to load...");
        return; // Don't throw error, just return early until user data is loaded
      }
  
      // For MGA/RGA use selectedMga if available; for SGA, use dropdown value if selected; otherwise use stored agnName.
      const effectiveAgnName =
        (userRole === "MGA" || userRole === "RGA" || (userRole === "SGA" && selectedMga))
          ? selectedMga || agnName
          : agnName;
  
      // Use SGA endpoints when userRole is in the list and no specific MGA is selected.
      const useSgaEndpoints = ["SGA", "MGA", "RGA"].includes(userRole) && !selectedMga;
  
      const requests = [];
  
      if (useSgaEndpoints) {
        // SGA endpoints branch
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
              `/dataroutes/subagent-alp?value=${effectiveAgnName}`
            )
          );
          requests.push(
            api.get(
              `/dataroutes/agent-history?value=${effectiveAgnName}`
            )
          );
        }
      }
  
      const responses = await Promise.all(requests);
  
      if (useSgaEndpoints) {
        // Process SGA responses
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
  
        const { monthlyAveragesByYear, weeklyDetails } = processSubmittingAgentCount(
          responses[4]?.data?.data || []
        );
        setSubAgentData(monthlyAveragesByYear);
        setSubAgentWeeks(weeklyDetails);
        const mgmtHistoryData = responses[5]?.data?.data || [];
        setRawMgmtHistoryData(mgmtHistoryData);

        const processedMgmtDataByRole = processManagementHistoryDataByRole(mgmtHistoryData);
        setMgmtCountData(processedMgmtDataByRole);

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

  // Process the subagent data using processSubmittingAgentCount for consistency.
  const { monthlyAveragesByYear, weeklyDetails: nonSgaWeeklyDetails } = processSubmittingAgentCount(
    subagentResponseData
  );
  setSubAgentData(monthlyAveragesByYear);
  setSubAgentWeeks(nonSgaWeeklyDetails);
}
if (!useSgaEndpoints && queryRole !== "AGT") {
  // Assuming the agent-history data is the last response in this branch:
  const rawAgentHistoryData = responses[responses.length - 1]?.data?.data || [];
  const filteredAgentHistoryData = filterAgentHistoryData(rawAgentHistoryData, effectiveAgnName, userRole);
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
  }, [agnName, userRole, selectedMga, effectiveAgnName, queryRole, rawAlpData, selectedAlpTab, rawMgmtHistoryData, processAlpData, groupTotalHiresByMonthAndYear, processSubmittingAgentCount, processManagementHistoryDataByRole]);
  const filterAgentHistoryData = useCallback((data, effectiveName, userRole) => {
    const lowerEffectiveName = effectiveName.toLowerCase();
    if (userRole === "MGA" || userRole === "RGA") {
      return data.filter(item => {
        // Check if the effective name appears in either the 'mga' or 'rga' columns.
        const mgaMatch =
          item.mga && item.mga.toLowerCase().includes(lowerEffectiveName);
        return mgaMatch;
      });
    } else if (userRole === "SA") {
      // For example, if the user is SA, filter based on the 'sa' column.
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
    const isSgaEndpoints = ["SGA", "MGA", "RGA"].includes(userRole) && !selectedMga;
    
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
      setAlpData(processAlpData(rawAlpData, queryRole, selectedAlpTab));
    }
  }, [rawAlpData, selectedAlpTab, queryRole]);
  
  useEffect(() => {
    fetchData();
  }, [selectedMga]);

  // Fetch data when user data becomes available
  useEffect(() => {
    if (agnName && userRole) {
      fetchData();
    }
  }, [agnName, userRole]); 
  
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
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className={i === columns.length - 1 ? "atlas-scorecard-ytd-header" : i % 4 === 3 ? "atlas-scorecard-quarter-header" : ""}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Previous Year Row */}
                <tr>
                  <td>{previousYear}</td>
                  {prevValues.map((val, idx) => {
                    // Only month cells (not quarter or YTD) should be clickable.
                    const actualMonth = convertTableIndexToActualMonth(idx);
                    return (
                      <td
                        key={idx}
                        className={idx === prevValues.length - 1 ? "atlas-scorecard-ytd-cell" : idx % 4 === 3 ? "atlas-scorecard-quarter-cell" : ""}
                        onClick={() => {
                          if (actualMonth !== null) {
                            handleMgmtCellClick(roleKey, previousYear, idx);
                          }
                        }}
                        title={actualMonth !== null ? "Click to view breakdown" : ""}
                        style={{ cursor: actualMonth !== null ? "pointer" : "default" }}
                      >
                        {numberFormatter(val)}
                      </td>
                    );
                  })}
                </tr>
                {/* Current Year Row */}
                <tr>
                  <td>{currentYear}</td>
                  {currValues.map((val, idx) => {
                    const actualMonth = convertTableIndexToActualMonth(idx);
                    return (
                      <td
                        key={idx}
                        className={idx === currValues.length - 1 ? "atlas-scorecard-ytd-cell" : idx % 4 === 3 ? "atlas-scorecard-quarter-cell" : ""}
                        onClick={() => {
                          if (actualMonth !== null) {
                            handleMgmtCellClick(roleKey, currentYear, idx);
                          }
                        }}
                        title={actualMonth !== null ? "Click to view breakdown" : ""}
                        style={{ cursor: actualMonth !== null ? "pointer" : "default" }}
                      >
                        {numberFormatter(val)}
                      </td>
                    );
                  })}
                </tr>
                <tr className="atlas-scorecard-growth-row">
                  <td>Growth</td>
                  {growthData.map(({ value, className }, idx) => (
                    <td key={idx} className={className}>
                      {numberFormatter(value)}
                    </td>
                  ))}
                </tr>
                <tr className="atlas-scorecard-percentage-row">
                  <td>%</td>
                  {percentGrowthData.map((data, idx) => (
                    <td key={idx} className={data.className}>
                      {data.value === "N/A" ? "N/A" : `${data.value.toFixed(1)}%`}
                    </td>
                  ))}
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
                  </tr>
                </thead>
                <tbody>
                  {sortedDetails.map((entry, index) => (
                    <tr key={index}>
                      <td>{formatName(entry.lagnname) || "N/A"}</td>
                      {(roleKey === "SA" || roleKey === "GA") && (
                        <td>{formatName(entry.mga) || "N/A"}</td>
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

  // Calculate rolling ratios for current and previous years
  const prevMonthlyRatios = calculateRollingRatio(prevCodeMonthly, prevHireMonthly, lastYear);
  const currMonthlyRatios = calculateRollingRatio(currCodeMonthly, currHireMonthly, currentYear);

  // Format ratios into display format with quarters and YTD
  const formatRatiosWithQuarters = (monthlyRatios, year) => {
    const q1 = monthlyRatios.slice(0, 3).filter(v => v > 0).length > 0
      ? monthlyRatios.slice(0, 3).reduce((a, b) => a + b, 0) / monthlyRatios.slice(0, 3).filter(v => v > 0).length
      : 0;
    
    const q2 = monthlyRatios.slice(3, 6).filter(v => v > 0).length > 0
      ? monthlyRatios.slice(3, 6).reduce((a, b) => a + b, 0) / monthlyRatios.slice(3, 6).filter(v => v > 0).length
      : 0;
    
    const q3 = monthlyRatios.slice(6, 9).filter(v => v > 0).length > 0
      ? monthlyRatios.slice(6, 9).reduce((a, b) => a + b, 0) / monthlyRatios.slice(6, 9).filter(v => v > 0).length
      : 0;
    
    const q4 = monthlyRatios.slice(9, 12).filter(v => v > 0).length > 0
      ? monthlyRatios.slice(9, 12).reduce((a, b) => a + b, 0) / monthlyRatios.slice(9, 12).filter(v => v > 0).length
      : 0;
    
    // For YTD, consider only months that have data (non-zero) up to previous month for current year
    const today = new Date();
    const isCurrentYear = year === today.getFullYear();
    const monthsToConsider = isCurrentYear ? Math.max(0, today.getMonth()) : 12;
    const validMonths = monthlyRatios.slice(0, monthsToConsider).filter(v => v > 0);
    const ytd = validMonths.length > 0
      ? validMonths.reduce((a, b) => a + b, 0) / validMonths.length
      : 0;
    
    return [
      monthlyRatios[0],
      monthlyRatios[1],
      monthlyRatios[2],
      q1,
      monthlyRatios[3],
      monthlyRatios[4],
      monthlyRatios[5],
      q2,
      monthlyRatios[6],
      monthlyRatios[7],
      monthlyRatios[8],
      q3,
      monthlyRatios[9],
      monthlyRatios[10],
      monthlyRatios[11],
      q4,
      ytd,
    ];
  };

  const prevRatios = formatRatiosWithQuarters(prevMonthlyRatios, lastYear);
  const currRatios = formatRatiosWithQuarters(currMonthlyRatios, currentYear);

  const growthData = currRatios.map((curr, i) => {
    const prev = prevRatios[i];
    const diff = curr - prev;
    return {
      value: diff,
      // For hire to code, an increase is bad (negative growth), a decrease is good (positive growth)
      className: diff < 0 ? "growth-positive" : diff > 0 ? "growth-negative" : "",
    };
  });

  const percentGrowthData = currRatios.map((curr, i) => {
    const prev = prevRatios[i];
    if (prev === 0) {
      return { value: "N/A", className: "" };
    } else {
      const pct = ((curr - prev) / prev) * 100;
      return {
        value: pct,
        // For hire to code, an increase is bad (negative growth), a decrease is good (positive growth)
        className: pct < 0 ? "growth-positive" : pct > 0 ? "growth-negative" : "",
      };
    }
  });

  return (
    <div className="atlas-scorecard-section">
      <h5>Hire to Code Ratios</h5>
      <div style={{ overflowX: "auto" }}>
      <div className="atlas-scorecard-custom-table-container">
        <table className="atlas-scorecard-custom-table">
          <thead>
            <tr>
              <th>Year</th>
              {months.map((month, index) => (
                <th
                  key={index}
                  className={
                    index === 3 ||
                    index === 7 ||
                    index === 11 ||
                    index === 15
                      ? "atlas-scorecard-quarter-header"
                      : index === 16
                      ? "atlas-scorecard-ytd-header"
                      : ""
                  }
                >
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{lastYear}</td>
              {prevRatios.map((val, index) => {
                const monthIndex = convertTableIndexToActualMonth(index);
                return (
                <td
                  key={index}
                  className={
                    index === 3 ||
                    index === 7 ||
                    index === 11 ||
                    index === 15
                      ? "atlas-scorecard-quarter-cell"
                      : index === 16
                      ? "atlas-scorecard-ytd-cell"
                      : ""
                  }
                >
                  {ratioFormatter(val)}
                </td>
                );
              })}
            </tr>
            <tr>
              <td>{currentYear}</td>
              {currRatios.map((val, index) => {
                const monthIndex = convertTableIndexToActualMonth(index);
                const isFutureMonth = monthIndex !== null && isMonthInFuture(currentYear, monthIndex);
                
                return (
                <td
                  key={index}
                  className={
                    index === 3 ||
                    index === 7 ||
                    index === 11 ||
                    index === 15
                      ? "atlas-scorecard-quarter-cell"
                      : index === 16
                      ? "atlas-scorecard-ytd-cell"
                      : ""
                  }
                >
                  {isFutureMonth ? "—" : ratioFormatter(val)}
                </td>
                );
              })}
            </tr>
            <tr className="atlas-scorecard-growth-row">
              <td>Growth</td>
              {growthData.map(({ value, className }, index) => {
                const monthIndex = convertTableIndexToActualMonth(index);
                const isFutureMonth = monthIndex !== null && isMonthInFuture(currentYear, monthIndex);
                
                return (
                <td key={index} className={className}>
                  {isFutureMonth ? "—" : ratioFormatter(value)}
                </td>
                );
              })}
            </tr>
            <tr className="atlas-scorecard-percentage-row">
              <td>%</td>
              {percentGrowthData.map((data, index) => {
                const monthIndex = convertTableIndexToActualMonth(index);
                const isFutureMonth = monthIndex !== null && isMonthInFuture(currentYear, monthIndex);
                
                return (
                <td key={index} className={data.className}>
                  {isFutureMonth ? "—" : data.value === "N/A" ? "N/A" : `${data.value.toFixed(1)}%`}
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


  const renderSummedTable = (title, data, dateField, isGrouped = false, isCurrency = true) => {
    const currentDetails = selectedTableDetails[title];
  
    if (currentDetails) {
      const { data: detailData, month: monthInfo, year } = currentDetails;
  
      if (title === "VIPs") {
        const groupedData = (Array.isArray(detailData) ? detailData : [detailData]).reduce(
          (acc, item) => {
            const name = item.lagnname || "Unknown";
            if (!acc[name]) acc[name] = [];
            acc[name].push(item);
            return acc;
          },
          {}
        );
  
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
            <div className="details-view">
              {Object.entries(groupedData).map(([lagnname, entries], index) => (
                <table className="hierarchyTable" key={index}>
                  <thead>
                    <tr>
                      <th colSpan={2}>{formatName(lagnname) || "N/A"}</th>
                      <th colSpan={2}>Hierarchy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, idx) => (
                      <React.Fragment key={idx}>
                        <tr>
                          <th>Code Date</th>
                          <td>{formatDate(entry?.softcode_date) || "N/A"}</td>
                          <th style={{ backgroundColor: "#68B675" }}>MGA</th>
                          <td>{formatName(entry?.mga) || "N/A"}</td>
                        </tr>
                        <tr>
                          <th>Gross ALP</th>
                          <td>{formatCurrency(entry?.gs) || "N/A"}</td>
                          <th style={{ backgroundColor: "#ED722F" }}>GA</th>
                          <td>{formatName(entry?.ga) || "N/A"}</td>
                        </tr>
                        <tr>
                          <th>Count</th>
                          <td>{entry?.count || "N/A"}</td>
                          <th style={{ backgroundColor: "#B25271" }}>SA</th>
                          <td>{formatName(entry?.sa) || "N/A"}</td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              ))}
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
        const groupedData = (Array.isArray(detailData) ? detailData : [detailData]).reduce(
          (acc, item) => {
            const name = item.LagnName || "Unknown";
            if (!acc[name]) acc[name] = [];
            acc[name].push(item);
            return acc;
          },
          {}
        );
  
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
            <div className="details-view">
              {Object.entries(groupedData).map(([lagnName, entries], index) => (
                <table className="hierarchyTable" key={index}>
                  <thead>
                    <tr>
                      <th colSpan={2}>{formatName(lagnName)}</th>
                      <th colSpan={2}>Hierarchy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, idx) => (
                      <React.Fragment key={idx}>
                        <tr>
                          <th>Prod Date</th>
                          <td>{formatDate(entry?.PRODDATE) || "N/A"}</td>
                          <th style={{ backgroundColor: "#68B675" }}>MGA</th>
                          <td>{formatName(entry?.MGA) || "N/A"}</td>
                        </tr>
                        <tr>
                          <th></th>
                          <td></td>
                          <th style={{ backgroundColor: "#ED722F" }}>GA</th>
                          <td>{formatName(entry?.GA) || "N/A"}</td>
                        </tr>
                        <tr>
                          <th></th>
                          <td></td>
                          <th style={{ backgroundColor: "#B25271" }}>SA</th>
                          <td>{formatName(entry?.SA) || "N/A"}</td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              ))}
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
      currentYearWithQuarters = calculateQuarterAverages(currentYearData);
      previousYearWithQuarters = calculateQuarterAverages(previousYearData);
    } else {
      currentYearWithQuarters = calculateQuarterSums(currentYearData);
      previousYearWithQuarters = calculateQuarterSums(previousYearData);
    }
    
  
    const growthData = currentYearWithQuarters.map((current, index) => {
      let previousValue = previousYearWithQuarters[index];
      const monthInfo = monthIndexToDataIndex(index);
      if (index === 16 && currentYear === today.getFullYear()) {
        // Recalculate previous value as the sum of previousYearData for months that have passed (excluding current month)
        previousValue = previousYearData.slice(0, Math.max(1, today.getMonth())).reduce((sum, val) => sum + val, 0);
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
      return {
        value: growth,
        className: growth > 0 ? "growth-positive" : growth < 0 ? "growth-negative" : "",
      };
    });
    
    
    const percentGrowthData = currentYearWithQuarters.map((current, index) => {
      let previousValue = previousYearWithQuarters[index];
      const monthInfo = monthIndexToDataIndex(index);
      if (index === 16 && currentYear === today.getFullYear()) {
        // Recalculate previous value as the sum of previousYearData for months that have passed (excluding current month)
        previousValue = previousYearData.slice(0, Math.max(1, today.getMonth())).reduce((sum, val) => sum + val, 0);
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
                {months.map((month, index) => (
                  <th
                    key={index}
                                      className={
                    index === 3 || index === 7 || index === 11 || index === 15
                      ? "atlas-scorecard-quarter-header"
                      : index === 16
                      ? "atlas-scorecard-ytd-header"
                      : ""
                  }
                  >
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
            <tr>
  <td>{previousYear}</td>
  {previousYearWithQuarters.map((value, index) => {
    const monthInfo = monthIndexToDataIndex(index);
    // For the YTD column (index 16), override with sum of previousYearData for months that have passed
// For the YTD column (index 16) in the previous-year row:
let cellValue = (index === 16)
  ? (currentYear === today.getFullYear()
      ? previousYearData.slice(0, Math.max(1, today.getMonth())).reduce((sum, val) => sum + val, 0) // Exclude current month, but include at least January
      : value)  // use full-year value if currentYear is not this year
  : value;

  const isQuarterCell = !monthInfo.isMonth;
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
  
  
  const isClickable = dataItem && dataItem.length > 0;
  return (
    <td
      key={index}
      className={`
        ${isQuarterCell ? "atlas-scorecard-quarter-cell" : ""}
        ${index === 16 ? "atlas-scorecard-ytd-cell" : ""}
        ${isClickable ? "has-data" : ""}
      `}
      title={isClickable ? "Details available" : ""}
      onClick={
        isClickable ? () => handleCellClickWrapper(dataItem, monthInfo, previousYear) : null
      }
    >
      {isCurrency ? currencyFormatter.format(cellValue) : cellValue}
    </td>
  );
  
  })}
</tr>

              <tr>
                <td>{currentYear}</td>
                {currentYearWithQuarters.map((value, index) => {
                  const monthInfo = monthIndexToDataIndex(index);
                  const isQuarterCell = !monthInfo.isMonth;
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
                  
                
                  const isClickable = dataItem && dataItem.length > 0;
  
                  return (
                    <td
                      key={index}
                            className={`
        ${isQuarterCell ? "atlas-scorecard-quarter-cell" : ""}
        ${index === 16 ? "atlas-scorecard-ytd-cell" : ""}
        ${isClickable ? "has-data" : ""}
      `}
                      title={isClickable ? "Details available" : ""}
                      onClick={isClickable ? () => handleCellClickWrapper(dataItem, monthInfo, currentYear) : null}
                    >
                      {isCurrency ? currencyFormatter.format(value) : value}
                    </td>
                  );
                })}
              </tr>
              <tr className="atlas-scorecard-growth-row">
                <td>Growth</td>
                {growthData.map(({ value, className }, index) => (
                  <td key={index} className={className}>
                    {isCurrency ? currencyFormatter.format(value) : value}
                  </td>
                ))}
              </tr>
              <tr className="atlas-scorecard-percentage-row">
  <td>%</td>
  {percentGrowthData.map((data, index) => (
    <td key={index} className={data.className}>
      {data.value === "N/A" ? "N/A" : `${data.value.toFixed(1)}%`}
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
  
  
  return (
      <div className="atlas-scorecard-sga-view">
<div className="atlas-scorecard-controls">
{["SA", "GA", "MGA", "RGA"].includes(userRole) && (
  <div className="atlas-scorecard-tabs">
  <input
    type="radio"
    id="lvl1"
    name="alp_view"
    value="LVL_1"
    checked={selectedAlpTab === "LVL_1"}
    onChange={() => setSelectedAlpTab("LVL_1")}
  />
  <label htmlFor="lvl1">LVL 1</label>
  <input
    type="radio"
    id="lvl3"
    name="alp_view"
    value="LVL_3"
    checked={selectedAlpTab === "LVL_3"}
    onChange={() => setSelectedAlpTab("LVL_3")}
  />
  <label htmlFor="lvl3">LVL 3</label>
</div>

    )}
  {allowedRoles.includes(userRole) && (
    <div className="atlas-scorecard-mga-dropdown">
      <label htmlFor="mga-select">Select MGA: </label>
      <select
  id="mga-select"
  value={selectedMga}
  onChange={(e) => setSelectedMga(e.target.value)}
>
  {showAriasOrganization && (
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
            {renderSummedTable("ALP", alpData, null, true, true)}
            {userRole !== "AGT" && renderSummedTable("Codes", associatesData, "PRODDATE", false, false)}
            {userRole !== "AGT" && renderSummedTable("VIPs", vipsData, "vip_month", false, false)}
            {userRole !== "AGT" &&
              renderSummedTable(
                "Submitting Agent Count",
                subAgentData,
                null,
                true,
                false
              )}
            {userRole !== "AGT" &&
              renderSummedTable("Hires", hiresData, "MORE_Date", true, false)}
           {/*      {userRole !== "AGT" && renderHireToCodeTable()} */}
                {userRole !== "AGT" && renderHireToCodeTable()}
                {userRole !== "AGT" && renderSingleManagementTable("SA", "Management Count - SA")}
  {userRole !== "AGT" && renderSingleManagementTable("GA", "Management Count - GA")}
  {userRole !== "AGT" && renderSingleManagementTable("MGA", "Management Count - MGA")}
  {userRole !== "AGT" && renderSingleManagementTable("RGA", "Management Count - RGA")}
  {userRole !== "AGT" && renderSingleManagementTable("total", "Total Management Count")}
          </>
      
      </div>
  );
});

export default Scorecard;
