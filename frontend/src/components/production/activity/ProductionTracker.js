import React, { useState, useEffect, useContext } from "react";
import DataTable from "../../utils/DataTable";
import ActionBar from "../../utils/ActionBar";
import api from "../../../api";
import { AuthContext } from "../../../context/AuthContext";
import "./DailyActivityForm.css";

const ProductionTracker = () => {
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
    
    const [month, day, year] = easternTimeString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  // Helper function to get the start of the week for any date (respects schedule_type)
  const getWeekStart = (dateInput, weekScheduleType = scheduleType) => {
    const date = typeof dateInput === 'string' 
      ? new Date(dateInput + 'T00:00:00') 
      : new Date(dateInput);
    
    const dayOfWeek = date.getDay();
    const weekStart = new Date(date);
    
    if (weekScheduleType === 'wed-tue') {
      let daysToSubtract;
      if (dayOfWeek >= 3) {
        daysToSubtract = dayOfWeek - 3;
      } else {
        daysToSubtract = dayOfWeek + 4;
      }
      weekStart.setDate(date.getDate() - daysToSubtract);
    } else {
      weekStart.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    }
    
    return weekStart.toISOString().split('T')[0];
  };
  
  const [selectedRange, setSelectedRange] = useState("day");
  const [dateRows, setDateRows] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [productionData, setProductionData] = useState({});
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editedRows, setEditedRows] = useState({});
  const [rowClassNames, setRowClassNames] = useState({});
  
  // Initialize schedule type from localStorage or default to 'mon-sun'
  const [scheduleType, setScheduleType] = useState(() => {
    try {
      const savedScheduleType = localStorage.getItem('productionTrackerScheduleType');
      return savedScheduleType === 'wed-tue' ? 'wed-tue' : 'mon-sun';
    } catch (error) {
      console.error('Error reading schedule type from localStorage:', error);
      return 'mon-sun';
    }
  });

  // Define columns for DataTable based on selected range
  const columns = React.useMemo(() => {
    if (selectedRange === "day") {
      // Day view: Day, Date, Send, Gross, Net (daily breakdown for a week)
      return [
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
          Cell: ({ value }) => <strong>{value}</strong>
        },
        {
          Header: "Send",
          accessor: "send",
          type: "number",
          width: 80,
          inputProps: {
            pattern: "[0-9]*\\.?[0-9]*",
            inputMode: "decimal"
          }
        },
        {
          Header: "Gross",
          accessor: "gross",
          type: "number",
          width: 100,
          inputProps: {
            pattern: "[0-9]*\\.?[0-9]*",
            inputMode: "decimal"
          },
          Cell: ({ value }) => <span>{value ? `$${parseFloat(value).toLocaleString()}` : ''}</span>
        },
        {
          Header: "Net",
          accessor: "net",
          type: "number",
          width: 100,
          inputProps: {
            pattern: "[0-9]*\\.?[0-9]*",
            inputMode: "decimal"
          },
          Cell: ({ value }) => <span>{value ? `$${parseFloat(value).toLocaleString()}` : ''}</span>
        }
      ];
    } else if (selectedRange === "week") {
      // Week view: Week, Gross, Net (weekly aggregated rows)
      return [
        {
          Header: "Week",
          accessor: "displayPeriod",
          width: 150,
          Cell: ({ value }) => <strong>{value}</strong>
        },
        {
          Header: "Gross",
          accessor: "gross",
          type: "number",
          width: 120,
          inputProps: {
            pattern: "[0-9]*\\.?[0-9]*",
            inputMode: "decimal"
          },
          Cell: ({ value }) => <span>{value ? `$${parseFloat(value).toLocaleString()}` : ''}</span>
        },
        {
          Header: "Net",
          accessor: "net",
          type: "number",
          width: 120,
          inputProps: {
            pattern: "[0-9]*\\.?[0-9]*",
            inputMode: "decimal"
          },
          Cell: ({ value }) => <span>{value ? `$${parseFloat(value).toLocaleString()}` : ''}</span>
        }
      ];
    } else {
      // Month view: Month, Net, Gross (monthly aggregated rows)
      return [
        {
          Header: "Month",
          accessor: "displayPeriod",
          width: 120,
          disableSortBy: false,
          disableCellEditing: true,
          Cell: ({ value }) => <strong>{value}</strong>
        },
        {
          Header: "Net",
          accessor: "net",
          type: "number",
          width: 180,
          inputProps: {
            pattern: "[0-9]*\\.?[0-9]*",
            inputMode: "decimal"
          },
          Cell: ({ value, row, isEditing, updateCell }) => {
            if (isEditing) {
              // Editing mode: show input field
              return (
                <input
                  type="number"
                  value={value || ''}
                  onChange={(e) => updateCell(row.id, 'net', e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    padding: '4px',
                    fontFamily: 'inherit'
                  }}
                  autoFocus
                  step="0.01"
                />
              );
            }
            // Display mode: format as currency
            if (value) {
              return (
                <span style={{ fontFamily: 'monospace' }}>
                  ${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              );
            }
            return <span></span>;
          }
        },
        {
          Header: "Gross",
          accessor: "gross",
          type: "number",
          width: 180,
          inputProps: {
            pattern: "[0-9]*\\.?[0-9]*",
            inputMode: "decimal"
          },
          Cell: ({ value, row, isEditing, updateCell }) => {
            if (isEditing) {
              // Editing mode: show input field
              return (
                <input
                  type="number"
                  value={value || ''}
                  onChange={(e) => updateCell(row.id, 'gross', e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    padding: '4px',
                    fontFamily: 'inherit'
                  }}
                  autoFocus
                  step="0.01"
                />
              );
            }
            // Display mode: format as currency
            if (value) {
              return (
                <span style={{ fontFamily: 'monospace' }}>
                  ${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              );
            }
            return <span></span>;
          }
        }
      ];
    }
  }, [selectedRange]);

  // Save schedule type to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('productionTrackerScheduleType', scheduleType);
    } catch (error) {
      console.error('Error saving schedule type to localStorage:', error);
    }
  }, [scheduleType]);

  useEffect(() => {
    generateDateRows();
  }, [selectedRange, currentDate, scheduleType]);

  // Refetch on user change
  useEffect(() => {
    setProductionData({});
    setEditedRows({});
    setTableData([]);
    generateDateRows();
  }, [user?.userId, user?.lagnname]);

  useEffect(() => {
    if (dateRows.length > 0) {
      fetchData();
    }
  }, [dateRows]);

  useEffect(() => {
    transformDataForTable();
  }, [dateRows, productionData, editedRows, selectedRange]);

  useEffect(() => {
    updateRowClassNames();
  }, [tableData]);

  // Don't render until user is loaded
  if (authLoading || !user) {
    return <div>Loading user data...</div>;
  }

  // Check if user has access
  const hasAccess = user?.Role === 'Admin' || user?.teamRole === 'app';
  if (!hasAccess) {
    return <div>You do not have access to this page.</div>;
  }

  const transformDataForTable = () => {
    const today = getTodayEastern();

    if (selectedRange === "day") {
      // Day view: Daily rows for the selected week
      const dailyRows = dateRows.map((date) => {
        const row = productionData[date] || {};
        const editedRow = editedRows[date] || {};
        
        const isToday = date === today;
        const dateObj = new Date(date + 'T00:00:00');
        const dayAbbreviations = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
        const dayOfWeek = dayAbbreviations[dateObj.getDay()];
        const displayDate = dateObj.toLocaleDateString("en-US", { 
          month: "numeric", 
          day: "numeric" 
        });

        const getFieldValue = (field) => editedRow[field] !== undefined ? editedRow[field] : (row[field] || '');

        return {
          id: date,
          dayOfWeek,
          displayDate,
          send: getFieldValue('send'),
          gross: getFieldValue('gross'),
          net: getFieldValue('net'),
          reportDate: date,
          weekKey: getWeekStart(date)
        };
      });

      setTableData(dailyRows);
    } else if (selectedRange === "week") {
      // Week view: Weekly aggregated rows
      const weeklyRows = dateRows.map((weekStart) => {
        const row = productionData[weekStart] || {};
        const editedRow = editedRows[weekStart] || {};
        
        const weekStartDate = new Date(weekStart + 'T00:00:00');
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekStartDate.getDate() + 6);
        
        const startDisplay = weekStartDate.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
        const endDisplay = weekEndDate.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
        const displayPeriod = `${startDisplay} - ${endDisplay}`;

        const getFieldValue = (field) => editedRow[field] !== undefined ? editedRow[field] : (row[field] || '');

        return {
          id: weekStart,
          displayPeriod,
          gross: getFieldValue('gross'),
          net: getFieldValue('net'),
          reportDate: weekStart
        };
      });

      setTableData(weeklyRows);
    } else {
      // Month view: Monthly aggregated rows
      // dateRows contains keys in YYYY-MM format, but we need to use MM/YYYY for sga_alp
      const monthlyRows = dateRows.map((monthKey) => {
        // Convert YYYY-MM to MM/YYYY for database lookup
        const [year, month] = monthKey.split('-');
        const sgaMonthKey = `${month}/${year}`;
        
        const row = productionData[sgaMonthKey] || {};
        const editedRow = editedRows[sgaMonthKey] || {};
        
        const displayPeriod = sgaMonthKey;

        const getFieldValue = (field) => editedRow[field] !== undefined ? editedRow[field] : (row[field] || '');

        return {
          id: sgaMonthKey, // Use MM/YYYY as the ID for consistency with database
          displayPeriod,
          gross: getFieldValue('gross'),
          net: getFieldValue('net'),
          reportDate: sgaMonthKey
        };
      });

      setTableData(monthlyRows);
    }
  };

  const updateRowClassNames = () => {
    if (!tableData.length) return;
    
    const today = getTodayEastern();
    const newRowClassNames = {};
    
    tableData.forEach(row => {
      const classes = [];
      
      if (row.reportDate === today) {
        classes.push("today-row");
      }
      
      newRowClassNames[row.id] = classes.join(" ");
    });
    
    setRowClassNames(newRowClassNames);
  };

  const generateDateRows = () => {
    let dates = [];
    const todayEastern = getTodayEastern();
    const todayDate = new Date();
    const viewingDate = new Date(currentDate);

    if (selectedRange === "day") {
      // Day view: Generate daily dates for the selected week
      const weekStartStr = getWeekStart(viewingDate, scheduleType);
      const start = new Date(weekStartStr + 'T00:00:00');
      start.setHours(0, 0, 0, 0);

      // Generate 7 days in reverse order (newest to oldest)
      for (let i = 6; i >= 0; i--) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dates.push(date.toISOString().split("T")[0]);
      }
    } else if (selectedRange === "week") {
      // Week view: Generate week start dates for the current year only
      const currentYear = todayDate.getFullYear();
      const currentWeekStartStr = getWeekStart(todayEastern, scheduleType);
      const currentWeekStart = new Date(currentWeekStartStr + 'T00:00:00');
      
      // Start from current week and go back to the first week of the year
      let weekStart = new Date(currentWeekStart);
      
      while (weekStart.getFullYear() === currentYear) {
        dates.push(weekStart.toISOString().split("T")[0]);
        weekStart.setDate(weekStart.getDate() - 7);
      }
    } else {
      // Month view: Generate month keys (YYYY-MM) going back (e.g., last 24 months)
      let month = todayDate.getMonth();
      let year = todayDate.getFullYear();

      for (let i = 0; i < 24; i++) {
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        dates.push(monthKey);
        
        month--;
        if (month < 0) {
          month = 11;
          year--;
        }
      }
    }

    setDateRows(dates);
  };

  const generateDropdownOptions = () => {
    const options = [];
    const todayEastern = getTodayEastern();
    const todayDate = new Date(todayEastern + 'T00:00:00');

    if (selectedRange === "day") {
      // Day view: Navigate between weeks
      const currentWeekStartStr = getWeekStart(todayEastern, scheduleType);
      const currentWeekStart = new Date(currentWeekStartStr + 'T00:00:00');
      
      for (let i = 0; i < 52; i++) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(currentWeekStart.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

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
    } else {
      // Week and Month views: Show current view (no navigation needed as all data shown)
      const currentYear = new Date().getFullYear();
      options.push({
        value: todayDate.toISOString(),
        label: selectedRange === "week" ? `${currentYear} Weeks` : "Last 24 Months"
      });
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

    try {
      if (selectedRange === "month") {
        // Month view: Fetch from sga_alp table
        console.log('[Production Tracker] Fetching monthly data from sga_alp');
        const response = await api.get('/alp/sga-monthly');
        const result = response.data;

        if (!result.success || !Array.isArray(result.data)) {
          console.error("Invalid API response format:", result);
          setProductionData({});
          setLoading(false);
          return;
        }

        // Map by month field (MM/YYYY format)
        const mappedData = {};
        result.data.forEach((entry) => {
          if (entry.month) {
            mappedData[entry.month] = {
              gross: entry.gross,
              net: entry.net
            };
          }
        });

        console.log('[Production Tracker] Mapped monthly data:', Object.keys(mappedData).length, 'months');
        setProductionData(mappedData);
      } else if (selectedRange === "week") {
        // Week view: Fetch from Weekly_ALP table
        // Note: reportdates in Weekly_ALP are 7 days AFTER the week they represent
        // So we need to extend the date range to capture reports for the most recent weeks
        const oldestWeekStart = dateRows[dateRows.length - 1];
        const newestWeekStart = dateRows[0];
        
        // Extend the end date by 14 days to capture Wed and Fri reports for the newest week
        const endDateObj = new Date(newestWeekStart + 'T00:00:00');
        endDateObj.setDate(endDateObj.getDate() + 14);
        const endDate = endDateObj.toISOString().split('T')[0];
        
        console.log('[Production Tracker] Fetching weekly data from Weekly_ALP:', {
          oldestWeekStart,
          newestWeekStart,
          extendedEndDate: endDate
        });
        const response = await api.get(`/alp/weekly-tracker?startDate=${oldestWeekStart}&endDate=${endDate}`);
        const result = response.data;

        if (!result.success || !Array.isArray(result.data)) {
          console.error("Invalid API response format:", result);
          setProductionData({});
          setLoading(false);
          return;
        }

        // Map by reportDate (week start date)
        const mappedData = {};
        result.data.forEach((entry) => {
          if (entry.reportDate) {
            const key = entry.reportDate.split("T")[0];
            mappedData[key] = {
              gross: entry.gross,
              net: entry.net
            };
          }
        });

        console.log('[Production Tracker] Mapped weekly data:', Object.keys(mappedData).length, 'weeks');
        setProductionData(mappedData);
      } else {
        // Day view: TODO - implement endpoint
        const startDate = dateRows[dateRows.length - 1];
        const endDate = dateRows[0];
        
        console.log('[Production Tracker] Day view not yet implemented');
        const response = await api.get(`/production-tracker/data?view=${selectedRange}&startDate=${startDate}&endDate=${endDate}`);
        const result = response.data;

        if (!result.success || !Array.isArray(result.data)) {
          console.error("Invalid API response format:", result);
          setProductionData({});
          setLoading(false);
          return;
        }

        const mappedData = {};
        result.data.forEach((entry) => {
          if (entry.reportDate) {
            const key = entry.reportDate.split("T")[0];
            mappedData[key] = entry;
          }
        });

        setProductionData(mappedData);
      }
    } catch (error) {
      console.error("🚨 Error fetching production tracker data:", error);
      setProductionData({});
    }
    setLoading(false);
  };

  const handleCellUpdate = (id, field, value) => {
    console.log('[Production Tracker] Cell updated:', { id, field, value, selectedRange });
    setEditedRows(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    if (!user?.userId || Object.keys(editedRows).length === 0) {
      console.error("🚨 No changes to submit or missing user ID.");
      alert("No changes to submit. Please edit some values first.");
      return;
    }

    try {
      if (selectedRange === "month") {
        // Month view: Update sga_alp table
        console.log('[Production Tracker] Submitting monthly updates to sga_alp');
        console.log('[Production Tracker] Edited rows:', editedRows);
        console.log('[Production Tracker] Number of months being updated:', Object.keys(editedRows).length);
        
        // editedRows keys are already in MM/YYYY format (e.g., "01/2025")
        const response = await api.post("/alp/sga-monthly", {
          updates: editedRows
        });

        const result = response.data;

        if (result.success) {
          console.log(`✅ Successfully updated ${result.successCount} month(s)`);
          setProductionData((prev) => {
            const updated = { ...prev };
            Object.keys(editedRows).forEach(month => {
              updated[month] = {
                ...updated[month],
                ...editedRows[month]
              };
            });
            return updated;
          });
          setEditedRows({});
          alert(`Successfully updated ${result.successCount} month(s)`);
        } else {
          console.error("❌ Update failed:", result.message);
          alert(`Error: ${result.message}`);
        }
      } else {
        // Day and Week views: TODO - implement endpoints
        const updatesWithDates = Object.keys(editedRows).reduce((acc, reportDate) => {
          acc[reportDate] = { reportDate, ...editedRows[reportDate] };
          return acc;
        }, {});

        const response = await api.post("/production-tracker/update", {
          view: selectedRange,
          updates: updatesWithDates
        });

        const result = response.data;

        if (result.success) {
          setProductionData((prev) => {
            const updated = { ...prev };
            Object.keys(editedRows).forEach(reportDate => {
              updated[reportDate] = {
                ...updated[reportDate],
                ...editedRows[reportDate]
              };
            });
            return updated;
          });
          setEditedRows({});
        } else {
          console.error("❌ Update failed:", result.message);
        }
      }
    } catch (error) {
      console.error("🚨 Error updating data:", error);
      alert(`Error updating data: ${error.message}`);
    }
  };

  const handleCancel = () => {
    setEditedRows({});
  };

  const navigateBackward = () => {
    const options = generateDropdownOptions();
    const currentISOString = currentDate.toISOString();
    const currentIndex = options.findIndex(option => option.value === currentISOString);
    
    if (currentIndex === -1) {
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
      
      const nextIndex = Math.min(closestIndex + 1, options.length - 1);
      setCurrentDate(new Date(options[nextIndex].value));
    } else {
      const nextIndex = Math.min(currentIndex + 1, options.length - 1);
      setCurrentDate(new Date(options[nextIndex].value));
    }
  };

  const navigateForward = () => {
    const options = generateDropdownOptions();
    const currentISOString = currentDate.toISOString();
    const currentIndex = options.findIndex(option => option.value === currentISOString);
    
    if (currentIndex === -1) {
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
      
      const prevIndex = Math.max(closestIndex - 1, 0);
      setCurrentDate(new Date(options[prevIndex].value));
    } else {
      const prevIndex = Math.max(currentIndex - 1, 0);
      setCurrentDate(new Date(options[prevIndex].value));
    }
  };

  const handleExport = () => {
    let headers, csvContent;
    
    if (selectedRange === "day") {
      headers = ['Date', 'Day', 'Send', 'Gross', 'Net'];
      csvContent = [
        headers.join(','),
        ...tableData.map(row => [
          row.displayDate,
          row.dayOfWeek,
          row.send || 0,
          row.gross || 0,
          row.net || 0
        ].join(','))
      ].join('\n');
    } else if (selectedRange === "week") {
      headers = ['Week', 'Net', 'Gross'];
      csvContent = [
        headers.join(','),
        ...tableData.map(row => [
          row.displayPeriod,
          row.net || 0,
          row.gross || 0
        ].join(','))
      ].join('\n');
    } else {
      headers = ['Month', 'Net', 'Gross'];
      csvContent = [
        headers.join(','),
        ...tableData.map(row => [
          row.displayPeriod,
          row.net || 0,
          row.gross || 0
        ].join(','))
      ].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `production-tracker-${selectedRange}-${timestamp}.csv`;
    
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="daily-activity-report">
      <div className="padded-content">
        <h2 style={{ marginBottom: '20px', color: '#333' }}>Production Tracker</h2>

        {/* Navigation and Period Selection */}
        <div className="controls-container">
          {selectedRange === "day" ? (
            <div className="navigation-container">
              <button className="nav-button" onClick={navigateBackward}>{"<"}</button>

              <select 
                className="date-dropdown" 
                value={(() => {
                  const options = generateDropdownOptions();
                  const currentISOString = currentDate.toISOString();
                  const matchingOption = options.find(option => option.value === currentISOString);
                  if (matchingOption) return matchingOption.value;
                  
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
          ) : (
            <div className="navigation-container">
              <div style={{ padding: '8px 16px', color: '#666', fontSize: '14px' }}>
                {selectedRange === "week" ? `${new Date().getFullYear()} Weeks` : "Last 24 Months"}
              </div>
            </div>
          )}

          <div className="period-tabs">
            <span 
              className={selectedRange === "day" ? "selected" : "unselected"} 
              onClick={() => {
                setSelectedRange("day");
                setCurrentDate(new Date());
              }}
            >
              Day
            </span>
            <span className="separator">|</span>
            <span 
              className={selectedRange === "week" ? "selected" : "unselected"} 
              onClick={() => {
                setSelectedRange("week");
                setCurrentDate(new Date());
              }}
            >
              Week
            </span>
            <span className="separator">|</span>
            <span 
              className={selectedRange === "month" ? "selected" : "unselected"} 
              onClick={() => {
                setSelectedRange("month");
                setCurrentDate(new Date());
              }}
            >
              Month
            </span>
          </div>
        </div>

        {/* ActionBar */}
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
            {/* Week Schedule Toggle - Only show for day view */}
            {selectedRange === "day" && (
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
            )}

            {/* Export Button */}
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

        {/* Table Content */}
        {loading ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            <p>Loading data...</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={tableData}
            onCellUpdate={handleCellUpdate}
            autoSave={false}
            disablePagination={true}
            highlightRowOnEdit={true}
            showActionBar={false}
            disableCellEditing={selectedRange === "week"}
            showTotals={true}
            totalsPosition="top"
            totalsColumns={selectedRange === "day" ? ['send', 'gross', 'net'] : ['net', 'gross']}
            totalsLabel="Totals"
            totalsLabelColumn={selectedRange === "day" ? "displayDate" : "displayPeriod"}
            rowClassNames={rowClassNames}
            stickyHeader={true}
            stickyTop={0}
            pageScrollSticky={true}
          />
        )}
      </div>
    </div>
  );
};

export default ProductionTracker;

