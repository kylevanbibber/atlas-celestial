import React, { useState, useEffect, useContext, useCallback } from "react";
import DataTable from "../../utils/DataTable";
import ActionBar from "../../utils/ActionBar";
import DiscordSalesExpanded from "./DiscordSalesExpanded";
import HierarchyActivity from "./HierarchyActivity";
import MGADataTable from "./MGADataTable";
import ActivitySummaryCards from "./ActivitySummaryCards";
import api from "../../../api";
import { AuthContext } from "../../../context/AuthContext";
import "./DailyActivityForm.css";

const DailyActivityForm = () => {
  const { user, loading: authLoading } = useContext(AuthContext);
  
  // Utility function to get today's date in Eastern Time
  const getTodayEastern = () => {
    const now = new Date();
    const easternTimeString = now.toLocaleString("en-US", {
      timeZone: "America/New_York",
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Parse the MM/DD/YYYY format and convert to YYYY-MM-DD
    const [month, day, year] = easternTimeString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  // Helper function to get the start of the week for any date (respects schedule_type)
  const getWeekStart = (dateInput, weekScheduleType = scheduleType) => {
    // Handle both string dates and Date objects
    const date = typeof dateInput === 'string' 
      ? new Date(dateInput + 'T00:00:00') 
      : new Date(dateInput);
    
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const weekStart = new Date(date);
    
    if (weekScheduleType === 'wed-tue') {
      // For Wed-Tue weeks, find the Wednesday that starts the week
      let daysToSubtract;
      if (dayOfWeek >= 3) {
        // Wed (3), Thu (4), Fri (5), Sat (6) -> go back to this Wed
        daysToSubtract = dayOfWeek - 3;
      } else {
        // Sun (0), Mon (1), Tue (2) -> go back to previous Wed
        daysToSubtract = dayOfWeek + 4; // 0+4=4, 1+4=5, 2+4=6
      }
      weekStart.setDate(date.getDate() - daysToSubtract);
    } else {
      // Default Mon-Sun week
      weekStart.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    }
    
    return weekStart.toISOString().split('T')[0];
  };
  
  const [selectedRange, setSelectedRange] = useState("week"); // week, month, ytd
  const [dateRows, setDateRows] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activityData, setActivityData] = useState({});
  const [actualAlpData, setActualAlpData] = useState({});
  const [discordSalesData, setDiscordSalesData] = useState({});
  const [discordVsManualBreakdown, setDiscordVsManualBreakdown] = useState({});
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editedRows, setEditedRows] = useState({});
  const [rowClassNames, setRowClassNames] = useState({});
  const [showWeeklyTotals, setShowWeeklyTotals] = useState(false);
  const [showMissingDataWarnings, setShowMissingDataWarnings] = useState(false);
  const [hoveredWeekKey, setHoveredWeekKey] = useState(null);
  const [expandableRows, setExpandableRows] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [showMgaTable, setShowMgaTable] = useState(false);
  
  // Initialize schedule type from localStorage or default to 'mon-sun'
  const [scheduleType, setScheduleType] = useState(() => {
    try {
      const savedScheduleType = localStorage.getItem('dailyActivityScheduleType');
      return savedScheduleType === 'wed-tue' ? 'wed-tue' : 'mon-sun';
    } catch (error) {
      console.error('Error reading schedule type from localStorage:', error);
      return 'mon-sun';
    }
  });


  // Define columns for DataTable - memoized to update when showMissingDataWarnings changes
  const columns = React.useMemo(() => [
    // Dedicated expander column (first)
    {
      Header: "",
      accessor: "_expander",
      width: 26,
      disableSortBy: true,
      Cell: () => null
    },
    // Day of week column (second)
    {
      Header: "Day",
      accessor: "dayOfWeek",
      width: 30,
      Cell: ({ value }) => <strong>{value}</strong>
    },
    {
      Header: "Date",
      accessor: "displayDate",
      width: 40,
      Cell: ({ value, row }) => {
        const hasWarning = showMissingDataWarnings && row.original.hasNoData;
        return (
          <div 
            className={hasWarning ? 'date-cell-warning' : ''}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center'
            }}
            title={hasWarning ? "Missing data for this past date" : ""}
          >
            <strong>{value}</strong>
          </div>
        );
      }
    },
    {
      Header: "Calls",
      accessor: "calls",
      type: "number",
      width: 50,
      inputProps: {
        pattern: "[0-9]*\\.?[0-9]*",
        inputMode: "decimal"
      }
    },
    {
      Header: "Appts",
      accessor: "appts", 
      type: "number",
      width: 50,
      inputProps: {
        pattern: "[0-9]*\\.?[0-9]*",
        inputMode: "decimal"
      }
    },
    {
      Header: "Sits",
      accessor: "sits",
      type: "number", 
      width: 50,
      inputProps: {
        pattern: "[0-9]*\\.?[0-9]*",
        inputMode: "decimal"
      }
    },
    {
      Header: "Sales",
      accessor: "sales",
      type: "number",
      width: 50,
      inputProps: {
        pattern: "[0-9]*\\.?[0-9]*",
        inputMode: "decimal"
      }
    },
    {
      Header: "Total ALP",
      accessor: "alp",
      type: "number",
      width: 80,
      inputProps: {
        pattern: "[0-9]*\\.?[0-9]*",
        inputMode: "decimal"
      },
      Cell: ({ value, row, isEditing, updateCell }) => {
        const reportDate = row.original.reportDate;
        const reportedAlp = value;
        const isWeeklyTotal = row.original.isWeeklyTotal;
        
        // If cell is being edited, render input field
        if (isEditing) {
          return (
            <input
              type="number"
              value={reportedAlp || ''}
              onChange={(e) => updateCell(row.original.id, 'alp', e.target.value)}
              style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent' }}
              autoFocus
              step="0.01"
            />
          );
        }
        
        // Only show actual ALP data for weekly total rows
        if (isWeeklyTotal) {
          const weekKey = row.original.weekKey;
          
          // Look for actual ALP data for the specific week using the new structure
          let actualAlp = null;
          
          // Check if we have actual ALP data for this specific week
          if (actualAlpData?.byWeek?.[weekKey]) {
            actualAlp = actualAlpData.byWeek[weekKey].actualAlp;
          }
          
          // If we have actual ALP data for the week, show "actual/reported"
          if (actualAlp !== undefined && actualAlp !== null && actualAlp !== '') {
            return (
              <div className="alp-cell-container alp-tooltip">
                <div className="alp-actual-value">
                  {actualAlp}
                </div>
                <div className="alp-reported-value">
                  /{reportedAlp || 0}
                </div>
              </div>
            );
          }
        } else {
          // For daily rows, check if there are Discord sales for this date
          const hasDiscordSales = discordSalesData[reportDate] && discordSalesData[reportDate].length > 0;
          
          // If there are Discord sales, show the breakdown as a tooltip but still allow editing
          if (hasDiscordSales) {
            const breakdown = discordVsManualBreakdown[reportDate];
            
            if (breakdown && (breakdown.manual_alp > 0 || breakdown.discord_alp > 0)) {
              const hasManual = breakdown.manual_alp > 0;
              const hasDiscord = breakdown.discord_alp > 0;
              
              // Show breakdown as tooltip but return null to allow editing
              if (hasDiscord && hasManual) {
                return (
                  <div 
                    className="alp-editable-with-tooltip" 
                    title={`Discord: $${breakdown.discord_alp}, Manual: $${breakdown.manual_alp}, Total: $${breakdown.total_alp}`}
                    style={{ cursor: 'pointer' }}
                  >
                    {reportedAlp || ''}
                  </div>
                );
              } else if (hasDiscord && !hasManual) {
                return (
                  <div 
                    className="alp-editable-with-tooltip" 
                    title={`All from Discord sales: $${breakdown.discord_alp}`}
                    style={{ cursor: 'pointer' }}
                  >
                    {reportedAlp || ''}
                  </div>
                );
              }
            }
          }
        }
        
        // For daily rows or weekly totals without actual data, show just the reported value
        return <span>{reportedAlp || ''}</span>;
      }
    },
    {
      Header: "Refs",
      accessor: "refs",
      type: "number",
      width: 50,
      inputProps: {
        pattern: "[0-9]*\\.?[0-9]*",
        inputMode: "decimal"
      }
    },
    {
      Header: "Ref Appts",
      accessor: "refAppt",
      type: "number",
      width: 50,
      inputProps: {
        pattern: "[0-9]*\\.?[0-9]*",
        inputMode: "decimal"
      }
    },
    {
      Header: "Ref Sits", 
      accessor: "refSit",
      type: "number",
      width: 50,
      inputProps: {
        pattern: "[0-9]*\\.?[0-9]*",
        inputMode: "decimal"
      }
    },
    {
      Header: "Ref Sales",
      accessor: "refSale", 
      type: "number",
      width: 50,
      inputProps: {
        pattern: "[0-9]*\\.?[0-9]*",
        inputMode: "decimal"
      }
    },
    {
      Header: "Ref ALP",
      accessor: "refAlp",
      type: "number",
      width: 80,
      inputProps: {
        pattern: "[0-9]*\\.?[0-9]*",
        inputMode: "decimal"
      },
      // No custom Cell renderer needed for Ref ALP since we only show actual data for main ALP
    },
    {
      Header: "Show Ratio",
      accessor: "showRatio",
      width: 80,
      Cell: ({ value }) => <span>{value || ''}</span>
    },
    {
      Header: "Close Ratio", 
      accessor: "closeRatio",
      width: 80,
      Cell: ({ value }) => <span>{value || ''}</span>
    },
    {
      Header: "ALP/Sale",
      accessor: "alpPerSale", 
      width: 80,
      Cell: ({ value }) => <span>{value ? `$${value}` : ''}</span>
    },
    {
      Header: "ALP/Ref Sale",
      accessor: "alpPerRefSale",
      width: 100,
      Cell: ({ value }) => <span>{value ? `$${value}` : ''}</span>
    },
    {
      Header: "ALP/Ref Coll",
      accessor: "alpPerRefCollected", 
      width: 100,
      Cell: ({ value }) => <span>{value ? `$${value}` : ''}</span>
    },
    {
      Header: "Ref Close Ratio",
      accessor: "refCloseRatio",
      width: 100,
      Cell: ({ value }) => <span>{value || ''}</span>
    },
    {
      Header: "Ref Coll/Sit",
      accessor: "refCollectedPerSit",
      width: 100,
      Cell: ({ value }) => <span>{value || ''}</span>
    },
    {
      Header: "Calls to Sit",
      accessor: "callsToSitRatio",
      width: 100,
      Cell: ({ value }) => <span>{value || ''}</span>
    }
  ], [showMissingDataWarnings, discordSalesData, actualAlpData, discordVsManualBreakdown]);

  // Save schedule type to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('dailyActivityScheduleType', scheduleType);
    } catch (error) {
      console.error('Error saving schedule type to localStorage:', error);
    }
  }, [scheduleType]);

  // Warn user before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (Object.keys(editedRows).length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
        return ''; // Some browsers use the return value
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [editedRows]);

  useEffect(() => {
    generateDateRows();
  }, [selectedRange, currentDate, scheduleType]);

  // Refetch on user change (including admin impersonation)
  useEffect(() => {
    // When user changes, reset local state and regenerate rows to trigger refetches
    setActivityData({});
    setActualAlpData({});
    setDiscordSalesData({});
    setDiscordVsManualBreakdown({});
    setEditedRows({});
    setExpandableRows({});
    setExpandedRows({});
    setTableData([]);
    // Keep the same period and date; generate rows to trigger downstream fetches
    generateDateRows();
  }, [user?.userId, user?.lagnname]);

  useEffect(() => {
    if (dateRows.length > 0) {
      fetchData();
      fetchActualAlpData();
      fetchDiscordSalesData();
      fetchDiscordVsManualBreakdown();
    }
  }, [dateRows]);



  useEffect(() => {
    // Transform data for DataTable (main data transformation)
    transformDataForTable();
  }, [dateRows, activityData, actualAlpData, discordSalesData, discordVsManualBreakdown, editedRows, showWeeklyTotals, selectedRange, showMissingDataWarnings]);

  useEffect(() => {
    // Update row class names only when hover state changes (lightweight operation)
    updateRowClassNames();
  }, [hoveredWeekKey, tableData]);



  // Don't render until user is loaded (moved after all hooks)
  if (authLoading || !user) {
    return <div>Loading user data...</div>;
  }

  // (console logs removed)

  const transformDataForTable = () => {
    // Pre-calculate today's date to avoid repeated calculations
    const today = getTodayEastern();

    // Helper function to check if a row exists in the database or has edited data
    const hasAnyData = (row, editedRow, date) => {
      // Check if there's a row with actual activity data (not just reportDate)
      const hasDbRecord = row && typeof row === 'object' && (
        row.calls !== undefined || 
        row.appts !== undefined || 
        row.sits !== undefined || 
        row.sales !== undefined || 
        row.alp !== undefined || 
        row.refs !== undefined ||
        row.refAppt !== undefined ||
        row.refSit !== undefined ||
        row.refSale !== undefined ||
        row.refAlp !== undefined
      );
      
      // If there are any edited values for this date, then data exists
      const hasEditedData = editedRow && Object.keys(editedRow).length > 0;
      
      // Return true if there's either a database record OR edited data
      return hasDbRecord || hasEditedData;
    };

    // Helper function to calculate stats ratios
    const calculateStats = (calls, appts, sits, sales, alp, refs, refAppt, refSit, refSale, refAlp) => {
      const stats = {};
      
      // Only calculate stats if there's any activity
      const hasActivity = calls > 0 || appts > 0 || sits > 0 || sales > 0 || alp > 0 || refs > 0 || refAppt > 0 || refSit > 0 || refSale > 0 || refAlp > 0;
      
      if (hasActivity) {
        stats.showRatio = appts > 0 ? ((sits / appts) * 100).toFixed(1) + '%' : '0.0%';
        stats.closeRatio = sits > 0 ? ((sales / sits) * 100).toFixed(1) + '%' : '0.0%';
        stats.alpPerSale = sales > 0 ? (alp / sales).toFixed(0) : '0';
        stats.alpPerRefSale = refSale > 0 ? (refAlp / refSale).toFixed(0) : '0';
        stats.alpPerRefCollected = refs > 0 ? (refAlp / refs).toFixed(0) : '0';
        stats.refCloseRatio = refSit > 0 ? ((refSale / refSit) * 100).toFixed(1) + '%' : '0.0%';
        stats.refCollectedPerSit = sits > 0 ? (refs / sits).toFixed(2) : '0.00';
        stats.callsToSitRatio = sits > 0 ? (calls / sits).toFixed(2) : '0.00';
      } else {
        stats.showRatio = '';
        stats.closeRatio = '';
        stats.alpPerSale = '';
        stats.alpPerRefSale = '';
        stats.alpPerRefCollected = '';
        stats.refCloseRatio = '';
        stats.refCollectedPerSit = '';
        stats.callsToSitRatio = '';
      }
      
      return stats;
    };

    // First, create all daily rows with optimized data checking
    // (console logs removed)
    
    const dailyRows = dateRows.map((date, index) => {
      const row = activityData[date] || {};
      const editedRow = editedRows[date] || {};
      
      const isToday = date === today;
      const isPastDate = date < today;

      // Optimized missing data detection
      const hasData = hasAnyData(row, editedRow, date);
      const hasNoData = isPastDate && !hasData;

      // Create date object once and reuse
      const dateObj = new Date(date + 'T00:00:00');

      // Pre-computed day abbreviations map
      const dayAbbreviations = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      const dayOfWeek = dayAbbreviations[dateObj.getDay()];

      // Create display date (m/d format)
      const displayDate = dateObj.toLocaleDateString("en-US", { 
          month: "numeric", 
          day: "numeric" 
        });

      // Helper function to get field value efficiently
      const getFieldValue = (field) => editedRow[field] !== undefined ? editedRow[field] : (row[field] || '');

      // Check if this date has Discord sales
      const hasDiscordSales = discordSalesData[date] && discordSalesData[date].length > 0;
      const discordSalesCount = hasDiscordSales ? discordSalesData[date].length : 0;

      // Get numeric values for stats calculation
      const calls = parseFloat(getFieldValue('calls')) || 0;
      const appts = parseFloat(getFieldValue('appts')) || 0;
      const sits = parseFloat(getFieldValue('sits')) || 0;
      const sales = parseFloat(getFieldValue('sales')) || 0;
      const alp = parseFloat(getFieldValue('alp')) || 0;
      const refs = parseFloat(getFieldValue('refs')) || 0;
      const refAppt = parseFloat(getFieldValue('refAppt')) || 0;
      const refSit = parseFloat(getFieldValue('refSit')) || 0;
      const refSale = parseFloat(getFieldValue('refSale')) || 0;
      const refAlp = parseFloat(getFieldValue('refAlp')) || 0;

      // Calculate stats for this row
      const stats = calculateStats(calls, appts, sits, sales, alp, refs, refAppt, refSit, refSale, refAlp);

      // (console logs removed)

      return {
        id: date,
        dayOfWeek,
        displayDate,
        calls: getFieldValue('calls'),
        appts: getFieldValue('appts'),
        sits: getFieldValue('sits'),
        sales: getFieldValue('sales'),
        alp: getFieldValue('alp'),
        refs: getFieldValue('refs'),
        refAppt: getFieldValue('refAppt'),
        refSit: getFieldValue('refSit'),
        refSale: getFieldValue('refSale'),
        refAlp: getFieldValue('refAlp'),
        ...stats, // Add the calculated stats
        reportDate: date,
        hasNoData,
        isWeeklyTotal: false,
        weekKey: getWeekStart(date) // Add week identifier for hover highlighting
      };
    });

    let transformedData = [...dailyRows];

    // (console logs removed)

    // If weekly totals are enabled, group by weeks and insert total rows
    if (showWeeklyTotals && (selectedRange === "month" || selectedRange === "ytd")) {
      // (console logs removed)
      
      const finalData = [];
      const weekGroups = {};

      // Group rows by week (Monday's date as key)
      dailyRows.forEach(row => {
        const weekKey = row.weekKey;
        if (!weekGroups[weekKey]) {
          weekGroups[weekKey] = [];
        }
        weekGroups[weekKey].push(row);
      });

      // Process weeks in order (newest first to match our data order)
      const weekKeys = Object.keys(weekGroups).sort((a, b) => new Date(b) - new Date(a));
      
      // (console logs removed)
      
      weekKeys.forEach((weekKey, weekIndex) => {
        const weekRows = weekGroups[weekKey];
        const weekDates = weekRows.map(r => `${r.reportDate} (${r.dayOfWeek})`).sort();
        
        // Calculate weekly totals
        const totals = {
          calls: 0, appts: 0, sits: 0, sales: 0, alp: 0, refs: 0,
          refAppt: 0, refSit: 0, refSale: 0, refAlp: 0
        };

        weekRows.forEach(row => {
          Object.keys(totals).forEach(field => {
            const value = parseFloat(row[field]) || 0;
            totals[field] += value;
          });
        });

        // For weekly totals, show sum of actual ALP if available, otherwise sum of reported ALP
        let actualAlpTotal = 0;
        let hasActualAlpData = false;
        weekRows.forEach(row => {
          const actualAlp = actualAlpData[row.reportDate]?.actualAlp;
          if (actualAlp !== undefined && actualAlp !== null && actualAlp !== '') {
            actualAlpTotal += parseFloat(actualAlp) || 0;
            hasActualAlpData = true;
          } else {
            actualAlpTotal += parseFloat(row.alp) || 0;
          }
        });

        // If we have any actual ALP data for this week, use the mixed total
        if (hasActualAlpData) {
          totals.alp = actualAlpTotal;
        }

        // Calculate stats for weekly total
        const weeklyStats = calculateStats(
          totals.calls, totals.appts, totals.sits, totals.sales, totals.alp, 
          totals.refs, totals.refAppt, totals.refSit, totals.refSale, totals.refAlp
        );

                 // Get Monday and Sunday of this week for display
         const mondayDate = new Date(weekKey + 'T00:00:00');
         const sundayDate = new Date(mondayDate);
         sundayDate.setDate(mondayDate.getDate() + 6);
         
         const mondayDisplay = mondayDate.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
         const sundayDisplay = sundayDate.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });

                 // Create weekly total row
         const weeklyTotalRow = {
           id: `week-total-${weekKey}-${weekIndex}`,
           dayOfWeek: "",
           displayDate: `Week ${mondayDisplay}-${sundayDisplay}`,
           ...totals,
           ...weeklyStats, // Add the calculated stats
           reportDate: `week-total-${weekKey}`,
           hasNoData: false,
           isWeeklyTotal: true,
           weekKey: weekKey // Add week identifier for hover highlighting
         };
         

        // Add weekly total row first, then the week's daily rows
        finalData.push(weeklyTotalRow);
        // Sort the week rows to maintain date order (newest first)
        weekRows.sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));
        finalData.push(...weekRows);
      });

      transformedData = finalData;
    }

    // (console logs removed)

    setTableData(transformedData);
    // (console logs removed)
  };

  const updateRowClassNames = () => {
    if (!tableData.length) return;
    
    const today = getTodayEastern();
    const newRowClassNames = {};
    
    tableData.forEach(row => {
      const classes = [];
      
      if (row.isWeeklyTotal) {
        classes.push("weekly-total-row");
      } else {
        if (row.reportDate === today) {
          classes.push("today-row");
        }
        
        // Add week-end border for week-end rows in MTD and YTD views (but not when weekly totals are shown)
        if ((selectedRange === "month" || selectedRange === "ytd") && !showWeeklyTotals) {
          const dateObj = new Date(row.reportDate + 'T00:00:00');
          const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
          
          // Add border at start of week based on schedule type
          if (scheduleType === 'wed-tue') {
            if (dayOfWeek === 3) { // Wednesday - start of Wed-Tue week
              classes.push("week-end-row");
            }
          } else {
            if (dayOfWeek === 1) { // Monday - start of Mon-Sun week
              classes.push("week-end-row");
            }
          }
        }
        
        // Add week highlighting when hovering over weekly total
        if (hoveredWeekKey && row.weekKey === hoveredWeekKey) {
          classes.push("week-row-highlighted");
        }
      }
      
      newRowClassNames[row.id] = classes.join(" ");
    });
    
    setRowClassNames(newRowClassNames);
  };



  const generateDateRows = () => {
    let start, end, dates = [];
    const todayEastern = getTodayEastern(); // YYYY-MM-DD string in Eastern time
    const todayDate = new Date(); // Date object for calculations
    const viewingDate = new Date(currentDate);

    if (selectedRange === "week") {
        // Get the week start using the appropriate schedule type
        const weekStartStr = getWeekStart(viewingDate, scheduleType);
        start = new Date(weekStartStr + 'T00:00:00');
        start.setHours(0, 0, 0, 0); // Normalize time

        // Set end date - always 7 days (full week)
        end = new Date(start);
        end.setDate(start.getDate() + 6);

        // Populate the week range in reverse order (newest to oldest)
        for (let i = 6; i >= 0; i--) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            dates.push(date.toISOString().split("T")[0]);
        }
    } else if (selectedRange === "month") {
        // Ensure month start and end use correct date formatting (no timezone shift)
        start = new Date(viewingDate.getFullYear(), viewingDate.getMonth(), 1);
        end = new Date(viewingDate.getFullYear(), viewingDate.getMonth() + 1, 0);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().split("T")[0]);
        }
        
        // Reverse for newest to oldest
        dates.reverse();
    } else if (selectedRange === "ytd") {
        // YTD: From January 1st of selected year to today (if current year) or end of year (if past year)
        start = new Date(viewingDate.getFullYear(), 0, 1);
        if (viewingDate.getFullYear() === todayDate.getFullYear()) {
            // For current year, go up to today (Eastern time)
            end = new Date(todayEastern);
        } else {
            end = new Date(viewingDate.getFullYear(), 11, 31);
        }

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().split("T")[0]);
        }
        
        // Reverse for newest to oldest
        dates.reverse();
    }

    setDateRows(dates);
  };

  const generateDropdownOptions = () => {
    const options = [];
    const todayEastern = getTodayEastern(); // YYYY-MM-DD string in Eastern time
    const todayDate = new Date(todayEastern + 'T00:00:00'); // Use Eastern date for calculations

    if (selectedRange === "week") {
        const currentWeekStartStr = getWeekStart(todayEastern, scheduleType); // Pass Eastern date string and schedule type
        const currentWeekStart = new Date(currentWeekStartStr + 'T00:00:00'); // Convert string to Date object
        
        for (let i = 0; i < 52; i++) { // Show 52 weeks
            const weekStart = new Date(currentWeekStart);
            weekStart.setDate(currentWeekStart.getDate() - (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);

            // Format label based on schedule type
            const startLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endLabel = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const weekLabel = scheduleType === 'wed-tue' 
                ? `Week ${startLabel} - ${endLabel} (Wed-Tue)`
                : `Week ${startLabel} - ${endLabel}`;

            options.push({
                value: weekStart.toISOString(),
                label: weekLabel
            });
        }
    } else if (selectedRange === "month") {
        // Generate months from current month backward
        let month = todayDate.getMonth();
        let year = todayDate.getFullYear();

        for (let i = 0; i < 24; i++) { // Last 24 months
            const monthStart = new Date(year, month, 1);
            const monthName = monthStart.toLocaleDateString("en-US", { 
                month: "long", 
                year: "numeric" 
            });

            options.push({
                value: monthStart.toISOString(),
                label: monthName
            });

            month--;
            if (month < 0) {
                month = 11;
                year--;
            }
        }
    } else if (selectedRange === "ytd") {
        // Generate years from current year backward
        let year = todayDate.getFullYear();

        while (year >= todayDate.getFullYear() - 4) { // Last 5 years
            options.push({
                value: new Date(year, 0, 1).toISOString(),
                label: `${year} YTD`
            });
            year--;
        }
    }

    return options;
  };

  const fetchData = async () => {
    if (dateRows.length === 0) return;

    setLoading(true);
    
    if (!user?.userId) {
        console.error("User ID not found in AuthContext");
        setLoading(false);
        return;
    }

    const startDate = dateRows[dateRows.length - 1]; // Oldest date
    const endDate = dateRows[0]; // Newest date


    try {
        // Remove userId from URL since AuthContext interceptor adds it automatically
        const response = await api.get(`/dailyActivity/user-summary?startDate=${startDate}&endDate=${endDate}`);
        const result = response.data;

        if (!result.success || !Array.isArray(result.data)) {
            console.error("Invalid API response format:", result);
            setActivityData({});
            setLoading(false);
            return;
        }


        // Ensure data is mapped using `reportDate` as the key
        const mappedData = {};
        result.data.forEach((entry) => {
            if (entry.reportDate) {
                const formattedDate = entry.reportDate.split("T")[0]; // Keep only YYYY-MM-DD
                mappedData[formattedDate] = entry;
            }
        });

        setActivityData(mappedData);
    } catch (error) {
        console.error("🚨 Error fetching activity data:", error);
        setActivityData({});
    }
    setLoading(false);
  };

  const fetchActualAlpData = async () => {
    
    if (dateRows.length === 0) {
        return;
    }
    
    if (!user?.lagnname) {
        console.error("❌ [Frontend] User lagnname not found for fetching actual ALP data");
        return;
    }

    const startDate = dateRows[dateRows.length - 1]; // Oldest date
    const endDate = dateRows[0]; // Newest date


    const requestUrl = `/alp/weekly/user-alp?lagnName=${encodeURIComponent(user.lagnname)}&startDate=${startDate}&endDate=${endDate}`;

    try {
        const response = await api.get(requestUrl);

        
        const result = response.data;

        if (!result.success) {

            setActualAlpData({});
            return;
        }

        if (!Array.isArray(result.data)) {

            setActualAlpData({});
            return;
        }

 

        // Map the actual ALP data by both report date and week key
        const mappedActualAlpData = { byDate: {}, byWeek: {} };
        
        result.data.forEach((entry, index) => {
            
            if (entry.reportDate) {
                const originalDate = entry.reportDate;
                const formattedDate = originalDate.split("T")[0]; // Keep only YYYY-MM-DD
                
                // Store by date
                mappedActualAlpData.byDate[formattedDate] = {
                    actualAlp: entry.actualAlp,
                    _debug: entry._debug
                };
                
                // Use the weekKey calculated by the backend if available, otherwise calculate it
                let weekKey;
                if (entry.weekKey) {
                    weekKey = entry.weekKey;
                } else {
                    // Fallback calculation (should match backend logic)
                    // If reportdate is 05/21/2025, it represents data for the week of 5/12-5/18
                    const reportDateObj = new Date(formattedDate + 'T00:00:00');
                    
                    // Go back 7 days from the reportdate to get to the week it represents
                    const weekStartDate = new Date(reportDateObj);
                    weekStartDate.setDate(reportDateObj.getDate() - 7);
                    
                    // Then find the Monday of that week
                    const dayOfWeek = weekStartDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
                    const monday = new Date(weekStartDate);
                    monday.setDate(weekStartDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                    weekKey = monday.toISOString().split('T')[0];
                }
                
                // Store by week key for easy weekly total lookup
                mappedActualAlpData.byWeek[weekKey] = {
                    actualAlp: entry.actualAlp,
                    originalReportDate: formattedDate,
                    weekKey: weekKey,
                    _debug: entry._debug
                };
                
   
            } else {
            }
        });


        setActualAlpData(mappedActualAlpData);
        
    } catch (error) {
        console.error("🚨 [Frontend] Error fetching actual ALP data:");
        console.error("📋 Error object:", error);
        console.error("📋 Error message:", error.message);
        if (error.response) {
            console.error("📋 Error response status:", error.response.status);
            console.error("📋 Error response data:", error.response.data);
        }
        setActualAlpData({});
    }
  };

  const fetchDiscordSalesData = async () => {
    // (console logs removed)
    
    if (dateRows.length === 0) {
      // (console logs removed)
      return;
    }

    const startDate = dateRows[dateRows.length - 1]; // Oldest date
    const endDate = dateRows[0]; // Newest date

    // (console logs removed)

    const requestUrl = `/discord/sales/user-sales?startDate=${startDate}&endDate=${endDate}`;
    // (console logs removed)

    try {
      // For testing, pass userId as query param (using fallback user ID 21)
      const testUserId = user?.userId || user?.id || 21;
      const requestUrlWithUserId = `${requestUrl}&userId=${testUserId}`;
      const response = await api.get(requestUrlWithUserId);
      // (console logs removed)

      const result = response.data;

      if (!result.success) {
        setDiscordSalesData({});
        setExpandableRows({});
        return;
      }

      if (!Array.isArray(result.data)) {
        setDiscordSalesData({});
        setExpandableRows({});
        return;
      }

      // (console logs removed)

      // (console logs removed)

      // Group Discord sales data by sale_date
      const mappedDiscordSalesData = {};
      const newExpandableRows = {};
      
      // (console logs removed)
      
      result.data.forEach((sale, index) => {
        // (console logs removed)

        if (sale.sale_date) {
          const formattedDate = sale.sale_date; // Already in YYYY-MM-DD format from DB
          
          if (!mappedDiscordSalesData[formattedDate]) {
            mappedDiscordSalesData[formattedDate] = [];
          }
          
          mappedDiscordSalesData[formattedDate].push(sale);
          newExpandableRows[formattedDate] = true; // Mark this date as expandable
          
          // (console logs removed)
        } else {
          // (console logs removed)
        }
      });

      // (console logs removed)

      // (console logs removed)

      setDiscordSalesData(mappedDiscordSalesData);
      setExpandableRows(newExpandableRows);
      
      // (console logs removed)
      
    } catch (error) {
      console.error(`[DISCORD-SALES-FRONTEND] ❌ Error fetching Discord sales data:`, error);
      console.error(`[DISCORD-SALES-FRONTEND] Error name:`, error.name);
      console.error(`[DISCORD-SALES-FRONTEND] Error message:`, error.message);
      if (error.response) {
        console.error(`[DISCORD-SALES-FRONTEND] Response status:`, error.response.status);
        console.error(`[DISCORD-SALES-FRONTEND] Response data:`, error.response.data);
        console.error(`[DISCORD-SALES-FRONTEND] Response headers:`, error.response.headers);
      }
      if (error.request) {
        console.error(`[DISCORD-SALES-FRONTEND] Request details:`, error.request);
      }
      setDiscordSalesData({});
      setExpandableRows({});
    }
  };

  const fetchDiscordVsManualBreakdown = async () => {
    // (console logs removed)
    
    if (dateRows.length === 0) {
      // (console logs removed)
      return;
    }

    const startDate = dateRows[dateRows.length - 1]; // Oldest date
    const endDate = dateRows[0]; // Newest date

    // (console logs removed)

    try {
      const testUserId = user?.userId || user?.id || 21;
      const requestUrl = `/discord/sales/breakdown?startDate=${startDate}&endDate=${endDate}&userId=${testUserId}`;
      const response = await api.get(requestUrl);
      
      // (console logs removed)

      const result = response.data;

      if (!result.success) {
        setDiscordVsManualBreakdown({});
        return;
      }

      if (!Array.isArray(result.data)) {
        setDiscordVsManualBreakdown({});
        return;
      }

      // (console logs removed)

      // Map the breakdown data by date
      const mappedBreakdownData = {};
      result.data.forEach(breakdown => {
        if (breakdown.date) {
          mappedBreakdownData[breakdown.date] = breakdown;
        }
      });

      setDiscordVsManualBreakdown(mappedBreakdownData);
      // (console logs removed)
      
    } catch (error) {
      console.error(`[DISCORD-BREAKDOWN-FRONTEND] ❌ Error fetching breakdown data:`, error);
      setDiscordVsManualBreakdown({});
    }
  };

  const handleCellUpdate = (id, field, value) => {
    const reportDate = id; // id is the reportDate for daily rows
    
    // Stage all changes locally without saving to backend
    setEditedRows(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleCellBlur = (id, field, value) => {
    const reportDate = id;
    const numericValue = value === '' ? null : parseFloat(value) || 0;
    
    // For alp/refs fields, enforce Discord floor constraint on blur
    if (['alp', 'refs'].includes(field)) {
      const sales = discordSalesData[reportDate] || [];
      const discordFloor = sales.reduce((acc, s) => {
        if (field === 'alp') acc += Number(s.alp) || 0;
        if (field === 'refs') acc += Number(s.refs) || 0;
        return acc;
      }, 0);
      const clampedValue = Math.max(discordFloor, numericValue ?? 0);
      
      if (clampedValue !== numericValue) {
        // Update the edited rows with clamped value
        setEditedRows(prev => ({
          ...prev,
          [id]: {
            ...prev[id],
            [field]: clampedValue
          }
        }));
      }
    }
  };

  const handleSubmit = async () => {
    if (!user?.userId || Object.keys(editedRows).length === 0) {
        console.error("🚨 No changes to submit or missing user ID.");
        return;
    }

    // Validate and correct ALP/Refs values against Discord floors before saving
    const correctedEditedRows = { ...editedRows };
    
    Object.keys(correctedEditedRows).forEach(reportDate => {
      const rowEdits = correctedEditedRows[reportDate];
      
      // Check if this row has ALP or Refs edits
      if (rowEdits.alp !== undefined || rowEdits.refs !== undefined) {
        const sales = discordSalesData[reportDate] || [];
        const discordTotals = sales.reduce((acc, s) => {
          acc.alp += Number(s.alp) || 0;
          acc.refs += Number(s.refs) || 0;
          return acc;
        }, { alp: 0, refs: 0 });
        
        // Correct ALP if it's below Discord floor
        if (rowEdits.alp !== undefined) {
          const alpValue = parseFloat(rowEdits.alp) || 0;
          if (alpValue < discordTotals.alp) {
            console.log(`[SUBMIT] Correcting ALP for ${reportDate}: ${alpValue} → ${discordTotals.alp} (Discord floor)`);
            correctedEditedRows[reportDate].alp = discordTotals.alp;
          }
        }
        
        // Correct Refs if it's below Discord floor
        if (rowEdits.refs !== undefined) {
          const refsValue = parseFloat(rowEdits.refs) || 0;
          if (refsValue < discordTotals.refs) {
            console.log(`[SUBMIT] Correcting Refs for ${reportDate}: ${refsValue} → ${discordTotals.refs} (Discord floor)`);
            correctedEditedRows[reportDate].refs = discordTotals.refs;
          }
        }
      }
    });

    // Ensure each row update contains the correctly formatted reportDate
    const updatesWithDates = Object.keys(correctedEditedRows).reduce((acc, reportDate) => {
        const formattedDate = new Date(reportDate).toISOString().split("T")[0]; // Ensure it's YYYY-MM-DD
        acc[formattedDate] = { reportDate: formattedDate, ...correctedEditedRows[reportDate] };
        return acc;
    }, {});


    try {
        const response = await api.post("/dailyActivity/update", {
            // Send userId explicitly (backend will also use token-based req.user.id when available)
            userId: user?.userId || user?.id,
            updates: updatesWithDates
        });

        const result = response.data;

        if (result.success) {
            // Merge corrected edited fields with existing data for each date, preserving unedited fields
            setActivityData((prev) => {
                const updated = { ...prev };
                Object.keys(correctedEditedRows).forEach(reportDate => {
                    updated[reportDate] = {
                        ...updated[reportDate], // Keep existing fields
                        ...correctedEditedRows[reportDate] // Overwrite only edited fields (with corrections)
                    };
                });
                return updated;
            });
            setEditedRows({});
        } else {
            console.error("❌ Update failed:", result.message);
        }
    } catch (error) {
        console.error("🚨 Error updating data:", error);
    }
  };

  const handleCancel = () => {
    setEditedRows({});
  };

  // Discord sales handlers
  const handleDiscordSalesUpdate = (saleId, updatedData) => {
    setDiscordSalesData(prev => {
      const newData = { ...prev };
      
      // Find and update the sale in the appropriate date group
      Object.keys(newData).forEach(date => {
        const salesForDate = newData[date];
        const saleIndex = salesForDate.findIndex(sale => sale.id === saleId);
        
        if (saleIndex !== -1) {
          newData[date][saleIndex] = {
            ...salesForDate[saleIndex],
            ...updatedData
          };
          
          // Recalculate daily totals for this date
          recalculateDailyTotals(date, newData[date]);
        }
      });
      
      return newData;
    });

    // Refresh both the main Daily Activity data and breakdown data to pick up backend changes
    setTimeout(() => {
      fetchData();
      fetchDiscordVsManualBreakdown();
    }, 1000); // Small delay to allow backend processing
  };

  const handleDiscordSalesDelete = (saleId) => {
    setDiscordSalesData(prev => {
      const newData = { ...prev };
      let deletedFromDate = null;
      
      // Find and remove the sale from the appropriate date group
      Object.keys(newData).forEach(date => {
        const originalLength = newData[date].length;
        newData[date] = newData[date].filter(sale => sale.id !== saleId);
        
        // If a sale was actually removed, recalculate totals
        if (newData[date].length < originalLength) {
          deletedFromDate = date;
          recalculateDailyTotals(date, newData[date]);
        }
        
        // If no sales left for this date, remove expandable row capability
        if (newData[date].length === 0) {
          delete newData[date];
          setExpandableRows(prevExpandable => {
            const newExpandable = { ...prevExpandable };
            delete newExpandable[date];
            return newExpandable;
          });
        }
      });
      
      return newData;
    });

    // Refresh both the main Daily Activity data and breakdown data to pick up backend changes
    setTimeout(() => {
      fetchData();
      fetchDiscordVsManualBreakdown();
    }, 1000); // Small delay to allow backend processing
  };

  // Handle manual addition updates
  const handleManualAdditionUpdate = async (date, manualData) => {
    try {
      // Fallback-friendly source of discord totals
      const breakdown = discordVsManualBreakdown[date];
      let discordAlp = 0;
      let discordRefs = 0;
      
      if (breakdown) {
        discordAlp = Number(breakdown.discord_alp) || 0;
        discordRefs = Number(breakdown.discord_refs) || 0;
      } else if (discordSalesData && discordSalesData[date]) {
        // If breakdown is missing, derive from raw discord sales loaded in memory
        const derived = (discordSalesData[date] || []).reduce((acc, sale) => {
          acc.alp += Number(sale.alp) || 0;
          acc.refs += Number(sale.refs) || 0;
          return acc;
        }, { alp: 0, refs: 0 });
        discordAlp = derived.alp;
        discordRefs = derived.refs;
      }
      
      // Calculate new totals: Discord + Manual
      const manualAlp = Number(manualData.alp) || 0;
      const manualRefs = Number(manualData.refs) || 0;
      const newTotalAlp = discordAlp + manualAlp;
      const newTotalRefs = discordRefs + manualRefs;
      
      // (console logs removed)
      
      // Update the Daily_Activity record
      const response = await api.put('/dailyActivity', {
        reportDate: date,
        alp: newTotalAlp,
        refs: newTotalRefs
      });
      
      if (response.data.success) {
        // (console logs removed)
        
        // Refresh both main data and breakdown data
        setTimeout(() => {
          fetchData();
          fetchDiscordVsManualBreakdown();
        }, 500);
      } else {
        throw new Error(response.data.message || 'Failed to update manual amounts');
      }
    } catch (error) {
      console.error(`[DAILY-ACTIVITY] ❌ Error updating manual amounts:`, error);
      throw error;
    }
  };

  const recalculateDailyTotals = (date, salesForDate) => {
    // Calculate totals from Discord sales
    const discordTotals = salesForDate.reduce((acc, sale) => {
      acc.sales += 1;
      acc.alp += parseFloat(sale.alp) || 0;
      acc.refs += parseInt(sale.refs) || 0;
      return acc;
    }, { sales: 0, alp: 0, refs: 0 });

    // Update the activity data if Discord totals are higher than current values
    setActivityData(prev => {
      const currentData = prev[date] || {};
      const shouldUpdate = 
        discordTotals.sales > (currentData.sales || 0) ||
        discordTotals.alp > (currentData.alp || 0) ||
        discordTotals.refs > (currentData.refs || 0);

      if (shouldUpdate) {
        return {
          ...prev,
          [date]: {
            ...currentData,
            sales: Math.max(discordTotals.sales, currentData.sales || 0),
            alp: Math.max(discordTotals.alp, currentData.alp || 0),
            refs: Math.max(discordTotals.refs, currentData.refs || 0),
            reportDate: date
          }
        };
      }
      
      return prev;
    });
  };

  const renderExpandedRow = (rowData) => {
    const date = rowData.reportDate;
    const salesForDate = discordSalesData[date] || [];
    const breakdownForDate = discordVsManualBreakdown[date] || {};
    
    return (
      <DiscordSalesExpanded
        salesData={salesForDate}
        onSalesUpdate={handleDiscordSalesUpdate}
        onSalesDelete={handleDiscordSalesDelete}
        dateString={date}
        breakdownData={breakdownForDate}
        onManualUpdate={(manualData) => handleManualAdditionUpdate(date, manualData)}
      />
    );
  };

  // Hover handlers for weekly total rows
  const handleWeeklyTotalHover = (row, isHovering) => {
    if (row.isWeeklyTotal) {
      setHoveredWeekKey(isHovering ? row.weekKey : null);
    }
  };

  const navigateBackward = () => {
    const options = generateDropdownOptions();
    const currentISOString = currentDate.toISOString();
    
    // Find current option index
    const currentIndex = options.findIndex(option => option.value === currentISOString);
    
    if (currentIndex === -1) {
      // If current date isn't in options, find closest and go to next one
      const currentTime = currentDate.getTime();
      let closestIndex = 0;
      let closestDistance = Math.abs(new Date(options[0].value).getTime() - currentTime);
      
      options.forEach((option, index) => {
        const distance = Math.abs(new Date(option.value).getTime() - currentTime);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      
      // Move to next option (or stay at last if at end)
      const nextIndex = Math.min(closestIndex + 1, options.length - 1);
      setCurrentDate(new Date(options[nextIndex].value));
    } else {
      // Move to next option (or stay at current if at last)
      const nextIndex = Math.min(currentIndex + 1, options.length - 1);
      setCurrentDate(new Date(options[nextIndex].value));
    }
  };

  const navigateForward = () => {
    const options = generateDropdownOptions();
    const currentISOString = currentDate.toISOString();
    
    // Find current option index
    const currentIndex = options.findIndex(option => option.value === currentISOString);
    
    if (currentIndex === -1) {
      // If current date isn't in options, find closest and go to previous one
      const currentTime = currentDate.getTime();
      let closestIndex = 0;
      let closestDistance = Math.abs(new Date(options[0].value).getTime() - currentTime);
      
      options.forEach((option, index) => {
        const distance = Math.abs(new Date(option.value).getTime() - currentTime);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      
      // Move to previous option (or stay at first if at beginning)
      const prevIndex = Math.max(closestIndex - 1, 0);
      setCurrentDate(new Date(options[prevIndex].value));
    } else {
      // Move to previous option (or stay at current if at first)
      const prevIndex = Math.max(currentIndex - 1, 0);
      setCurrentDate(new Date(options[prevIndex].value));
    }
  };

  const handleExport = () => {
    // Generate CSV content
    const headers = ['Date', 'Day', 'Calls', 'Appts', 'Sits', 'Sales', 'ALP (Reported)', 'ALP (Actual)', 'Refs', 'Ref Appts', 'Ref Sits', 'Ref Sales', 'Ref ALP'];
    
    // Determine which data to export based on weekly totals setting
    let exportData;
    if (showWeeklyTotals && (selectedRange === "month" || selectedRange === "ytd")) {
      // Include all data (daily rows and weekly totals) when weekly totals are enabled
      exportData = tableData;
    } else {
      // Filter out weekly total rows when weekly totals are disabled or not applicable
      exportData = tableData.filter(row => !row.isWeeklyTotal);
    }
    
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => {
        const actualAlp = row.reportDate && actualAlpData[row.reportDate]?.actualAlp || '';
        return [
          row.displayDate,
          row.dayOfWeek || (row.isWeeklyTotal ? 'Weekly Total' : ''),
          row.calls || 0,
          row.appts || 0,
          row.sits || 0,
          row.sales || 0,
          row.alp || 0,
          actualAlp,
          row.refs || 0,
          row.refAppt || 0,
          row.refSit || 0,
          row.refSale || 0,
          row.refAlp || 0
        ].join(',');
      })
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generate filename based on current period and whether weekly totals are included
    const startDate = dateRows[dateRows.length - 1];
    const endDate = dateRows[0];
    const weeklyTotalsSuffix = (showWeeklyTotals && (selectedRange === "month" || selectedRange === "ytd")) ? '-with-weekly-totals' : '';
    const filename = `daily-activity-${selectedRange}-${startDate}-to-${endDate}${weeklyTotalsSuffix}.csv`;
    
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  return (
    <div className="daily-activity-report">
      <div className="padded-content">
        

        {/* Navigation and Period Selection - Above Table */}
        <div className="controls-container">
          <div className="navigation-container">
            <button className="nav-button" onClick={navigateBackward}>{"<"}</button>

            <select 
                className="date-dropdown" 
                value={(() => {
                  const options = generateDropdownOptions();
                  const currentISOString = currentDate.toISOString();
                  
                  // Find the closest matching option or use the first one
                  const matchingOption = options.find(option => option.value === currentISOString);
                  if (matchingOption) {
                    return matchingOption.value;
                  }
                  
                  // If no exact match, find the closest date
                  const currentTime = currentDate.getTime();
                  let closestOption = options[0];
                  let closestDistance = Math.abs(new Date(options[0].value).getTime() - currentTime);
                  
                  options.forEach(option => {
                    const distance = Math.abs(new Date(option.value).getTime() - currentTime);
                    if (distance < closestDistance) {
                      closestDistance = distance;
                      closestOption = option;
                    }
                  });
                  
                  return closestOption ? closestOption.value : options[0]?.value;
                })()} 
                onChange={(e) => setCurrentDate(new Date(e.target.value))}
            >
                {generateDropdownOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>

            <button className="nav-button" onClick={navigateForward}>{">"}</button>
          </div>

          <div className="period-tabs">
            <span 
                className={selectedRange === "week" ? "selected" : "unselected"} 
                onClick={() => {
                  setSelectedRange("week");
                  setCurrentDate(new Date()); // Reset to current week
                }}
            >
                Week
            </span>
            <span className="separator">|</span>
            <span 
                className={selectedRange === "month" ? "selected" : "unselected"} 
                onClick={() => {
                  setSelectedRange("month");
                  const todayDate = new Date();
                  setCurrentDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)); // Reset to current month
                }}
            >
                MTD
            </span>
            <span className="separator">|</span>
            <span 
                className={selectedRange === "ytd" ? "selected" : "unselected"} 
                onClick={() => {
                  setSelectedRange("ytd");
                  const todayDate = new Date();
                  setCurrentDate(new Date(todayDate.getFullYear(), 0, 1)); // Reset to current year
                }}
            >
                YTD
            </span>
          </div>
        </div>

        {/* ActionBar with Submit/Cancel on Left, Toggles on Right */}
        <ActionBar
          selectedCount={0}
          totalCount={0}
          entityName=""
          archivedView={false}
        >
          {/* Left side - Submit and Cancel buttons */}
          <div className="action-buttons-left">
            {Object.keys(editedRows).length > 0 && (
              <>
                <button 
                  className="check-submit-button icon-only" 
                  onClick={handleSubmit} 
                  disabled={loading}
                  title={loading ? "Submitting..." : "Submit Changes"}
                  style={{
                    backgroundColor: 'var(--success-color, #27ae60)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#229954';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--success-color, #27ae60)';
                  }}
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      d="m5 12 5 5 9-9" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button 
                  className="cancel-button icon-only" 
                  onClick={handleCancel} 
                  title="Cancel Changes"
                  style={{
                    backgroundColor: 'var(--danger-color, #e74c3c)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#c0392b';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--danger-color, #e74c3c)';
                  }}
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      d="m18 6-12 12 M6 6l12 12" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Right side - Toggle and Export buttons */}
          <div className="action-buttons-right">
            {/* Weekly totals toggle for MTD and YTD views - Icon only */}
            {(selectedRange === "month" || selectedRange === "ytd") && (
              <div 
                className={`weekly-totals-toggle icon-only ${showWeeklyTotals ? 'active' : ''}`}
                onClick={() => setShowWeeklyTotals(!showWeeklyTotals)}
                title={showWeeklyTotals ? 'Hide Weekly Totals' : 'Show Weekly Totals'}
              >
                <svg 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="eye-icon"
                >
                  {showWeeklyTotals ? (
                    // Open eye icon (visible)
                    <path 
                      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  ) : (
                    // Closed eye icon (hidden)
                    <>
                      <path 
                        d="m1 1 22 22 M9.88 9.88a3 3 0 1 0 4.24 4.24 M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68 M6.61 6.61A13.526 13.526 0 0 0 1 12s4 8 11 8a9.74 9.74 0 0 0 5-1.28" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </>
                  )}
                </svg>
              </div>
            )}

            {/* Missing Data Warnings Toggle - Icon only */}
            <div 
              className={`missing-data-toggle icon-only ${showMissingDataWarnings ? 'active' : ''}`}
              onClick={() => setShowMissingDataWarnings(!showMissingDataWarnings)}
              title={showMissingDataWarnings ? 'Hide Missing Data Warnings' : 'Show Missing Data Warnings'}
            >
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {showMissingDataWarnings ? (
                  // Warning icon (visible)
                  <path 
                    d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                ) : (
                  // Warning icon with slash (hidden)
                  <>
                    <path 
                      d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      opacity="0.5"
                    />
                    <path 
                      d="m1 1 22 22" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </>
                )}
              </svg>
            </div>

            {/* Week Schedule Toggle - Calendar icon */}
            <button 
              className={`schedule-toggle-button icon-only ${scheduleType === 'wed-tue' ? 'active' : ''}`}
              onClick={() => setScheduleType(scheduleType === 'mon-sun' ? 'wed-tue' : 'mon-sun')}
              title={scheduleType === 'mon-sun' ? 'Switch to Wed-Tue Week' : 'Switch to Mon-Sun Week'}
            >
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
                <line x1="9" y1="4" x2="9" y2="22" stroke="currentColor" strokeWidth="2"/>
                {scheduleType === 'wed-tue' && (
                  <text x="12" y="18" fontSize="8" fill="currentColor" fontWeight="bold">W</text>
                )}
                {scheduleType === 'mon-sun' && (
                  <text x="12" y="18" fontSize="8" fill="currentColor" fontWeight="bold">M</text>
                )}
              </svg>
            </button>

            {/* MGA Teams (DataTable) Toggle - People icon */}
            <button 
              className={`hierarchy-toggle-button icon-only ${showMgaTable ? 'active' : ''}`}
              onClick={() => setShowMgaTable(!showMgaTable)}
              title={showMgaTable ? 'Hide MGA Teams' : 'Show MGA Teams'}
            >
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M16 11c1.657 0 3-1.79 3-4s-1.343-4-3-4-3 1.79-3 4 1.343 4 3 4z" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M8 11c1.657 0 3-1.79 3-4S9.657 3 8 3 5 4.79 5 7s1.343 4 3 4z" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M2 21v-2c0-2.761 3.582-4 6-4s6 1.239 6 4v2" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M22 21v-2c0-2.2-2.686-3.6-5-3.95" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
            </button>

            {/* Export Button - Icon only */}
            <button 
              className="export-button icon-only" 
              onClick={handleExport}
              title="Export Data"
              disabled={loading}
            >
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5-5 5 5 M12 15V5" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </ActionBar>

        {/* Table Content - Conditional; replace with MGA view when enabled */}
        {showMgaTable ? (
          <div className="hierarchy-section" >
            <MGADataTable 
              startDate={dateRows[dateRows.length - 1]}
              endDate={dateRows[0]}
            />
          </div>
        ) : (
          loading ? (
            <div style={{ padding: "20px", textAlign: "center" }}>
              <p>Loading data...</p>
            </div>
          ) : (
            (() => {
              return (
                <>
                  <DataTable
                    key={`datatable-${showMissingDataWarnings}`}
                    columns={columns}
                    data={tableData}
                    onCellUpdate={handleCellUpdate}
                    onCellBlur={handleCellBlur}
                    autoSave={false}
                    disablePagination={true}
                    highlightRowOnEdit={true}
                    showActionBar={false}
                    disableCellEditing={false}
                    showTotals={true}
                    totalsPosition="top"
                    totalsColumns={['calls', 'appts', 'sits', 'sales', 'alp', 'refs', 'refAppt', 'refSit', 'refSale', 'refAlp', 'showRatio', 'closeRatio', 'alpPerSale', 'alpPerRefSale', 'alpPerRefCollected', 'refCloseRatio', 'refCollectedPerSit', 'callsToSitRatio']}
                    totalsLabel="Totals"
                    totalsLabelColumn="displayDate"
                    rowClassNames={rowClassNames}
                    stickyHeader={true}
                    stickyTop={0}
                    pageScrollSticky={true}
                    onRowHover={handleWeeklyTotalHover}
                    enableRowExpansion={true}
                    expandableRows={{}} // Allow all rows to be expandable
                    renderExpandedRow={renderExpandedRow}
                    expandedRowsInitial={{}}
                  />
                  
                  {/* Activity Summary Cards for individual view */}
                  <ActivitySummaryCards data={tableData} />
                </>
              );
            })()
          )
        )}

        {/* Hierarchy View - Show below table when toggled */}
        {showHierarchy && (
          <div className="hierarchy-section">
            <HierarchyActivity currentUserOnly={true} />
          </div>
        )}

        {/* MGA Teams View now replaces main table; no separate below-table rendering */}
      </div>
    </div>
  );
};

export default DailyActivityForm; 