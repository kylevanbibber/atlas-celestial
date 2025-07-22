import React, { useState, useEffect, useMemo } from "react";
import api from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import "./Scorecard.css";
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
  if (["Q1", "Q2", "Q3", "Q4"].includes(key)) return "quarter-column";
  if (key === "YTD") return "year-total-column";
  return "";
};

const calculateQuarterTotals = (counts, isCurrentYear = false) => {
  const Q1 = counts.slice(0, 3).reduce((a, b) => a + b, 0);
  const Q2 = counts.slice(3, 6).reduce((a, b) => a + b, 0);
  const Q3 = counts.slice(6, 9).reduce((a, b) => a + b, 0);
  const Q4 = counts.slice(9, 12).reduce((a, b) => a + b, 0);
  
  let YTD;
  if (isCurrentYear) {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-indexed
    // Sum up to the previous month (excluding current month)
    YTD = counts.slice(0, Math.max(0, currentMonth)).reduce((a, b) => a + b, 0);
  } else {
    YTD = Q1 + Q2 + Q3 + Q4;
  }
  
  return { Q1, Q2, Q3, Q4, YTD };
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
  return grouped;
};



const ScorecardRGAData = () => {
  // Get user data from auth context
  const { user } = useAuth();
  const userId = user?.userId;
  const userRole = user?.clname?.toUpperCase();
  const agnName = user?.lagnname; // Using lagnname as agent name

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
        alp: `/dataroutes/subagent-alp-mga?value=${effectiveAgnName}`,
        vip: `/dataroutes/vips-sga?column=${queryRole}&value=${effectiveAgnName}`,
        associates: `/dataroutes/associates-sga?column=${queryRole}&value=${effectiveAgnName}`,
        hires: `/dataroutes/org-total-hires?value=${effectiveAgnName}`,
        subagent: `/dataroutes/subagent-alp-sga?value=${effectiveAgnName}`,
      }
    : {
        alp: `/dataroutes/monthly-alp-by-mga?value=${effectiveAgnName}`,
        vip: `/dataroutes/vips?column=${queryRole}&value=${effectiveAgnName}`,
        associates: `/dataroutes/associates?column=${queryRole}&value=${effectiveAgnName}`,
        hires: `/dataroutes/total-hires?value=${effectiveAgnName}`,
        subagent: `/dataroutes/subagent-alp?value=${effectiveAgnName}`,
      };

  useEffect(() => {
    api
      .get("/dataroutes/get-rga-hierarchy")
      .then((res) => {
        if (res.data.success) {
          setMgaData(res.data.data);
        }
      })
      .catch((err) => {
        console.error("Error fetching MGA data:", err);
      });
  }, []);

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
      // Log incoming ALP data for BERNSDORFF MARK T when the year is 2025.
      if (key === "BERNSDORFF MARK T" && selectedYear === 2025) {
        console.log("Incoming ALP data for BERNSDORFF MARK T:", item);
      }
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
        grouped[key][monthIndex].clName === "MGA" &&
        item.CL_Name !== "MGA"
      ) {
        grouped[key][monthIndex] = { value: cleanedValue, clName: item.CL_Name };
      }
    });
    // Convert each grouped entry to a numeric array (defaulting missing entries to 0)
    const final = {};
    Object.keys(grouped).forEach((key) => {
      final[key] = grouped[key].map((entry) => (entry ? entry.value : 0));
    });
    // Log the final numeric ALP array for BERNSDORFF MARK T for 2025
    if (final["BERNSDORFF MARK T"] && selectedYear === 2025) {
      console.log("Final numeric ALP data for BERNSDORFF MARK T:", final["BERNSDORFF MARK T"]);
    }
    return final;
  };
  
  const buildHireToCodeRows = (codesRows, hiresRows) => {
    return codesRows.map((codeRow) => {
      const mga = codeRow.mga;
      const hireRow = hiresRows.find((row) => row.mga === mga);
      // If no hires row exists, default ratios to 0.
      if (!hireRow) {
        return {
          mga,
          monthlyCounts: Array(12).fill(0),
          Q1: 0,
          Q2: 0,
          Q3: 0,
          Q4: 0,
          YTD: 0,
          treeValue: codeRow.treeValue,
        };
      }
      // Compute ratio for each month.
      const monthlyCounts = codeRow.monthlyCounts.map((codeCount, idx) => {
        const hireCount = hireRow.monthlyCounts[idx] || 0;
        return codeCount === 0 ? 0 : hireCount / codeCount;
      });
      // Compute quarterly and YTD ratios.
      const Q1 = codeRow.Q1 === 0 ? 0 : hireRow.Q1 / codeRow.Q1;
      const Q2 = codeRow.Q2 === 0 ? 0 : hireRow.Q2 / codeRow.Q2;
      const Q3 = codeRow.Q3 === 0 ? 0 : hireRow.Q3 / codeRow.Q3;
      const Q4 = codeRow.Q4 === 0 ? 0 : hireRow.Q4 / codeRow.Q4;
      const YTD = codeRow.YTD === 0 ? 0 : hireRow.YTD / codeRow.YTD;
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
    const validMgaSet = new Set(filteredMgaData.map((m) => m.original_lagnname));
    return Object.keys(groupedData)
      .filter((lagnName) => validMgaSet.has(lagnName))
      .map((lagnName) => {
        const monthlyCounts = groupedData[lagnName];
        const totals = calculateQuarterTotals(monthlyCounts, selectedYear === new Date().getFullYear());
        const matchingMGA = filteredMgaData.find((m) => m.original_lagnname === lagnName);
        const row = {
          mga: lagnName,
          monthlyCounts,
          Q1: totals.Q1,
          Q2: totals.Q2,
          Q3: totals.Q3,
          Q4: totals.Q4,
          YTD: totals.YTD,
          treeValue: matchingMGA ? matchingMGA.tree : "",
        };
        // Log the final table row for BERNSDORFF MARK T if applicable.
        if (lagnName === "BERNSDORFF MARK T") {
          console.log("Final ALP row for BERNSDORFF MARK T:", row);
        }
        return row;
      });
  };
  
  
  const filteredMgaData = useMemo(() => {
    return mgaData.filter((mgaObj) => {
      // Adjust based on the new schema fields.
      const active = mgaObj.original_active?.toLowerCase();
      const hide = mgaObj.original_hide?.toLowerCase();
      return (active === "y" && hide === "n") || (active === "n" && hide === "n");
    });
  }, [mgaData]);
  

  // Group each dataset by MGA.
  // For VIP, use the "vip_month" field, count occurrences, and use the "mga" field.
  const vipGrouped = groupDataByMGA(vipData, "vip_month", selectedYear, "count", "total", "mga");
  // For ALP, use "month" and sum the "total" field.
// Updated ALP processing branch (for both SGA and non-SGA cases if applicable)
useEffect(() => {
    const alpGrouped = processAlpDataForMGA(alpData, selectedYear);
    setFinalAlpData(buildAlpTableRows(alpGrouped, filteredMgaData));
  }, [alpData, selectedYear, filteredMgaData]);
  
  
  // For Associates, use "associate_month", count occurrences, and use the "MGA" field.
  const associatesGrouped = groupDataByMGA(associatesData, "PRODDATE", selectedYear, "count", "total", "MGA");
  // For Hires, use "MORE_Date", sum the "Total_Hires" field, and use the "MGA_Name-" field.
  const hiresGrouped = groupDataByMGA(hiresData, "MORE_Date", selectedYear, "sum", "Total_Hires", "MGA");
  // For Subagent, use "month", count unique LagnName values, and use the "MGA_NAME" field.

  // Build table rows for each dataset by iterating over filtered MGA records.
  // If an MGA does not have data, default monthly counts to 0.
  const buildTableRows = (groupedData, isSubagent = false) => {
    return filteredMgaData.map((mgaObj) => {
      const mgaName = mgaObj.original_lagnname;
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
        treeValue: mgaObj.tree,
      };
    });
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
  

  const vipRows = buildTableRows(vipGrouped);
  const associatesRows = buildTableRows(associatesGrouped);
  const hiresRows = buildTableRows(hiresGrouped);
  const subagentGrouped = processSubmittingAgentCountByMGA(subagentData, selectedYear);
  const subagentRows = buildTableRows(subagentGrouped, true);

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
  // Compute totals for a set of rows.
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

  if (loading) return <Placeholder />;
  if (error) return <div>{error}</div>;

  const renderTable = (title, rows, totals) => (
    <div className="recruiting-table-container">
      <h4>
        {title} {selectedYear}
      </h4>
      <table className="scorecard-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header.key}
                className={getHeaderClass(header.key)}
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
              style={{
                backgroundColor: index % 2 === 0 ? "white" : "#f9f9f9",
              }}
            >
              {headers.map((header) => (
                <td key={header.key} className={getHeaderClass(header.key)}>
  {monthOrder.hasOwnProperty(header.key)
    ? formatCellValue(title, header.key, row.monthlyCounts[monthOrder[header.key]])
    : formatCellValue(title, header.key, row[header.key])}
</td>

              ))}
            </tr>
          ))}
          {/* Totals Row */}
          <tr className="totals-row">
  <td>
    <strong>Totals</strong>
  </td>
  {headers.slice(1).map((header) => {
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
      <td key={header.key} className={getHeaderClass(header.key)}>
        <strong>
          {title === "Net ALP"
            ? currencyFormatter.format(totalValue)
            : title === "Hire to Code"
              ? Number(totalValue).toFixed(2)
              : totalValue}
        </strong>
      </td>
    );
  })}
</tr>

        </tbody>
      </table>
    </div>
  );
  

  // Get unique tree values for the dropdown filter.
  const uniqueTreeValues = [
    "All",
    ...Array.from(new Set(filteredMgaData.map((m) => m.tree).filter(Boolean))),
  ];

  return (
    <div className="scorecard-sga-view">
      {/* Tree filter dropdown */}
      <div className="filter-container">
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
      {renderTable("Net ALP", finalAlpRows, computeTotals(finalAlpRows))}


    </div>
  );
};

export default ScorecardRGAData;
