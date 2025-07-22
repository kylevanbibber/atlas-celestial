import React, { useState, useEffect, useContext } from "react";
import DataTable from "../utils/DataTable";
import ActionBar from "../utils/ActionBar";
import api from "../../api";
import { AuthContext } from "../../context/AuthContext";
import "./DailyActivityForm.css";

const DailyActivityForm = () => {
  const { user, loading: authLoading } = useContext(AuthContext);
  
  const [selectedRange, setSelectedRange] = useState("week"); // week, month, ytd
  const [dateRows, setDateRows] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activityData, setActivityData] = useState({});
  const [actualAlpData, setActualAlpData] = useState({});
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editedRows, setEditedRows] = useState({});
  const [rowClassNames, setRowClassNames] = useState({});
  const [showWeeklyTotals, setShowWeeklyTotals] = useState(false);
  const [showMissingDataWarnings, setShowMissingDataWarnings] = useState(true);
  const [hoveredWeekKey, setHoveredWeekKey] = useState(null);


  // Define columns for DataTable
  const columns = [
    {
      Header: "",
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
      Header: "ALP",
      accessor: "alp",
      type: "number",
      width: 80,
      inputProps: {
        pattern: "[0-9]*\\.?[0-9]*",
        inputMode: "decimal"
      },
      Cell: ({ value, row }) => {
        const reportDate = row.original.reportDate;
        const reportedAlp = value;
        const isWeeklyTotal = row.original.isWeeklyTotal;
        
        // Only show actual ALP data for weekly total rows
        if (isWeeklyTotal) {
          const weekKey = row.original.weekKey;
          
          // Debug logging for weekly total ALP cell rendering

          
          // Look for actual ALP data for the specific week using the new structure
          let actualAlp = null;
          
          // Check if we have actual ALP data for this specific week
          if (actualAlpData?.byWeek?.[weekKey]) {
            actualAlp = actualAlpData.byWeek[weekKey].actualAlp;
          } else {
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
    }
  ];

  useEffect(() => {
    generateDateRows();
  }, [selectedRange, currentDate]);

  useEffect(() => {
    if (dateRows.length > 0) {
      fetchData();
      fetchActualAlpData();
    }
  }, [dateRows]);



  useEffect(() => {
    // Transform data for DataTable (main data transformation)
    transformDataForTable();
  }, [dateRows, activityData, actualAlpData, editedRows, showWeeklyTotals, selectedRange, showMissingDataWarnings]);

  useEffect(() => {
    // Update row class names only when hover state changes (lightweight operation)
    updateRowClassNames();
  }, [hoveredWeekKey, tableData]);



  // Don't render until user is loaded (moved after all hooks)
  if (authLoading || !user) {
    return <div>Loading user data...</div>;
  }

  const transformDataForTable = () => {
    // Helper function to get Monday of the week for any date
    const getMondayOfWeek = (dateStr) => {
      const date = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const monday = new Date(date);
      monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const mondayStr = monday.toISOString().split('T')[0];
      
      return mondayStr;
    };

    // Pre-calculate today's date to avoid repeated calculations
    const today = new Date().toISOString().split("T")[0];

    // Helper function to check if a row has any data - optimized version
    const hasAnyData = (row, editedRow) => {
      // Check all possible data fields efficiently
      const fields = ['calls', 'appts', 'sits', 'sales', 'alp', 'refs', 'refAppt', 'refSit', 'refSale', 'refAlp'];
      
      for (const field of fields) {
        const value = editedRow[field] !== undefined ? editedRow[field] : row[field];
        if (value !== '' && value !== null && value !== undefined) {
          return true;
        }
      }
      return false;
    };

    // First, create all daily rows with optimized data checking
    const dailyRows = dateRows.map((date) => {
      const row = activityData[date] || {};
      const editedRow = editedRows[date] || {};
      
      const isToday = date === today;
      const isPastDate = date < today;

      // Optimized missing data detection
      const hasData = hasAnyData(row, editedRow);
      const hasNoData = isPastDate && !hasData;

      // Create date object once and reuse
      const dateObj = new Date(date + 'T00:00:00');

      // Pre-computed day abbreviations map
      const dayAbbreviations = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      const dayOfWeek = dayAbbreviations[dateObj.getDay()];

      // Create display date
      const displayDate = dateObj.toLocaleDateString("en-US", { 
          year: "2-digit", 
          month: "numeric", 
          day: "numeric" 
        });

      // Helper function to get field value efficiently
      const getFieldValue = (field) => editedRow[field] !== undefined ? editedRow[field] : (row[field] || '');

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
        reportDate: date,
        hasNoData,
        isWeeklyTotal: false,
        weekKey: getMondayOfWeek(date) // Add week identifier for hover highlighting
      };
    });

    let transformedData = [...dailyRows];

    // If weekly totals are enabled, group by weeks and insert total rows
    if (showWeeklyTotals && (selectedRange === "month" || selectedRange === "ytd")) {
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

        setTableData(transformedData);
  };

  const updateRowClassNames = () => {
    if (!tableData.length) return;
    
    const today = new Date().toISOString().split("T")[0];
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
          
          if (dayOfWeek === 1) { // Monday - add border after Monday to visually separate from previous week
            classes.push("week-end-row");
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
    const today = new Date();
    const viewingDate = new Date(currentDate);

    if (selectedRange === "week") {
        // Determine the Monday of the current week
        const dayOfWeek = viewingDate.getDay(); // 0 = Sunday, 6 = Saturday
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Move backward to Monday
        start = new Date(viewingDate);
        start.setDate(viewingDate.getDate() + mondayOffset);
        start.setHours(0, 0, 0, 0); // Normalize time

        // Set end date to the following Sunday
        end = new Date(start);
        end.setDate(start.getDate() + 6); // Always go to Sunday

       
        // Populate the week range from Monday to Sunday
        for (let i = 0; i <= 6; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            dates.push(date.toISOString().split("T")[0]);
        }
    } else if (selectedRange === "month") {
        // Ensure month start and end use correct date formatting (no timezone shift)
        start = new Date(viewingDate.getFullYear(), viewingDate.getMonth(), 1);
        end = new Date(viewingDate.getFullYear(), viewingDate.getMonth() + 1, 0); // Last day of month

     

        // Populate month range from first to last day
        let current = new Date(start);
        while (current <= end) {
            dates.push(current.toISOString().split("T")[0]); // Ensure format is YYYY-MM-DD
            current.setDate(current.getDate() + 1);
        }
    } else if (selectedRange === "ytd") {
        // YTD: From January 1st of selected year to today (if current year) or end of year (if past year)
        start = new Date(viewingDate.getFullYear(), 0, 1);
        if (viewingDate.getFullYear() === today.getFullYear()) {
            end = today;
        } else {
            end = new Date(viewingDate.getFullYear(), 11, 31);
        }
        
 
        
        while (start <= end) {
            dates.push(start.toISOString().split("T")[0]);
            start.setDate(start.getDate() + 1);
        }
    }

    setDateRows(dates.reverse()); // Reverse to show newest dates first
  };

  const generateDropdownOptions = () => {
    const options = [];
    const today = new Date();

    if (selectedRange === "week") {
        // Generate weeks from the current week backward
        let start = new Date(today);
        start.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1)); // Set to Monday

        while (start >= new Date(today.getFullYear(), 0, 1)) { // Stop at first week of the year
            let end = new Date(start);
            end.setDate(start.getDate() + 6); // Sunday

            options.push({
                value: start.toISOString(),
                label: `${start.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })} - 
                        ${end.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })}`
            });

            start.setDate(start.getDate() - 7); // Move back one week
        }
    } else if (selectedRange === "month") {
        // Generate months from current month backward
        let start = new Date(today.getFullYear(), today.getMonth(), 1);

        while (start.getFullYear() >= today.getFullYear() - 1) { // Stop at Jan of last year
            let end = new Date(start.getFullYear(), start.getMonth() + 1, 0); // Last day of the month

            options.push({
                value: start.toISOString(),
                label: `${start.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
            });

            start.setMonth(start.getMonth() - 1); // Move back one month
        }
    } else if (selectedRange === "ytd") {
        // Generate years from current year backward
        let year = today.getFullYear();

        while (year >= today.getFullYear() - 4) { // Last 5 years
            options.push({
                value: new Date(year, 0, 1).toISOString(),
                label: `${year}`
            });
            year--; // Move back one year
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

  const handleCellUpdate = async (id, field, value) => {
    // Don't allow editing of weekly total rows
    if (id.startsWith('week-total-')) {
      return;
    }
    
    const reportDate = id; // The row ID is the report date
    
    // Validate input - only allow numbers and decimals
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) {
      console.warn(`Invalid input rejected: "${value}" - only numbers and decimals allowed`);
      return; // Reject invalid input
    }
    
    // Parse the numeric value
    const numericValue = value === "" ? "" : parseFloat(value) || 0;
    
    // Get current row data (combining existing data with edits)
    const currentRowData = {
      ...(activityData[reportDate] || {}),
      ...(editedRows[reportDate] || {}),
      [field]: numericValue
    };
    
    // Validation: Sales cannot exceed Sits
    if (field === 'sales' || field === 'sits') {
      const sits = field === 'sits' ? numericValue : (currentRowData.sits || 0);
      const sales = field === 'sales' ? numericValue : (currentRowData.sales || 0);
      
      if (sales > sits && sits > 0) {
        console.warn(`Sales (${sales}) cannot exceed Sits (${sits})`);
        alert(`Sales (${sales}) cannot exceed Sits (${sits}). Please adjust your values.`);
        return; // Reject the update
      }
    }
    
    // Update edited rows state only - no auto-save
    setEditedRows(prev => ({
      ...prev,
      [reportDate]: {
        ...prev[reportDate],
        reportDate,
        [field]: numericValue
      }
    }));
  };

  const handleSubmit = async () => {
    if (!user?.userId || Object.keys(editedRows).length === 0) {
        console.error("🚨 No changes to submit or missing user ID.");
        return;
    }

    // Ensure each row update contains the correctly formatted reportDate
    const updatesWithDates = Object.keys(editedRows).reduce((acc, reportDate) => {
        const formattedDate = new Date(reportDate).toISOString().split("T")[0]; // Ensure it's YYYY-MM-DD
        acc[formattedDate] = { reportDate: formattedDate, ...editedRows[reportDate] };
        return acc;
    }, {});


    try {
        // Remove userId from body since AuthContext interceptor adds it automatically
        const response = await api.post("/dailyActivity/update", {
            updates: updatesWithDates
        });

        const result = response.data;

        if (result.success) {
            // Merge edited fields with existing data for each date, preserving unedited fields
            setActivityData((prev) => {
                const updated = { ...prev };
                Object.keys(editedRows).forEach(reportDate => {
                    updated[reportDate] = {
                        ...updated[reportDate], // Keep existing fields
                        ...editedRows[reportDate] // Overwrite only edited fields
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
                  const today = new Date();
                  setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1)); // Reset to current month
                }}
            >
                MTD
            </span>
            <span className="separator">|</span>
            <span 
                className={selectedRange === "ytd" ? "selected" : "unselected"} 
                onClick={() => {
                  setSelectedRange("ytd");
                  const today = new Date();
                  setCurrentDate(new Date(today.getFullYear(), 0, 1)); // Reset to current year
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

        {/* Table Content - Conditional */}
        {loading ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            <p>Loading data...</p>
          </div>
        ) : (
          <DataTable
            key={`datatable-${showMissingDataWarnings}`} // Force re-render when toggle changes
            columns={columns}
            data={tableData}
            onCellUpdate={handleCellUpdate}
            disablePagination={true}
            highlightRowOnEdit={true}
            showActionBar={false}
            disableCellEditing={false}
            showTotals={true}
            totalsPosition="top"
            totalsColumns={['calls', 'appts', 'sits', 'sales', 'alp', 'refs', 'refAppt', 'refSit', 'refSale', 'refAlp']}
            totalsLabel="Totals"
            totalsLabelColumn="displayDate"
            rowClassNames={rowClassNames}
            stickyHeader={true}
            stickyTop={0}
            pageScrollSticky={true}
            onRowHover={handleWeeklyTotalHover}
          />
        )}
      </div>
    </div>
  );
};

export default DailyActivityForm; 