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
      // Day view: Day, Date, Arias, NY (daily breakdown for a week)
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
          Header: "Arias",
          accessor: "arias",
          type: "number",
          width: 120,
          inputProps: {
            pattern: "[0-9]*\\.?[0-9]*",
            inputMode: "decimal",
            step: "0.01"
          },
          Cell: ({ value, row, isEditing, updateCell }) => {
            if (isEditing) {
              return (
                <input
                  type="number"
                  value={value || ''}
                  onChange={(e) => updateCell(row.id, 'arias', e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    padding: '4px',
                    fontFamily: 'inherit'
                  }}
                  autoFocus
                  step="any"
                  min="0"
                  placeholder="0.00"
                />
              );
            }
            if (value !== undefined && value !== '') {
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
          Header: "NY",
          accessor: "ny",
          type: "number",
          width: 120,
          inputProps: {
            pattern: "[0-9]*\\.?[0-9]*",
            inputMode: "decimal",
            step: "0.01"
          },
          Cell: ({ value, row, isEditing, updateCell }) => {
            if (isEditing) {
              return (
                <input
                  type="number"
                  value={value || ''}
                  onChange={(e) => updateCell(row.id, 'ny', e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    padding: '4px',
                    fontFamily: 'inherit'
                  }}
                  autoFocus
                  step="any"
                  min="0"
                  placeholder="0.00"
                />
              );
            }
            if (value !== undefined && value !== '') {
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
          Cell: ({ value }) => <span>{value !== undefined && value !== '' ? `$${parseFloat(value).toLocaleString()}` : ''}</span>
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
          Cell: ({ value }) => <span>{value !== undefined && value !== '' ? `$${parseFloat(value).toLocaleString()}` : ''}</span>
        }
      ];
    } else if (selectedRange === "year") {
      // Year view: Year, Net (yearly aggregated rows - calculated from monthly data)
      return [
        {
          Header: "Year",
          accessor: "displayYear",
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
          disableCellEditing: true,
          Cell: ({ value }) => {
            if (value !== undefined && value !== '') {
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
    
    if (selectedRange === "week") {
      console.log('[Production Tracker] transformDataForTable - ALL dateRows:', dateRows);
      console.log('[Production Tracker] transformDataForTable - ALL productionData keys:', Object.keys(productionData));
      console.log('[Production Tracker] transformDataForTable - Checking if keys match...');
      dateRows.forEach(weekStart => {
        const hasData = productionData[weekStart] !== undefined;
        console.log(`  ${weekStart}: ${hasData ? 'HAS DATA' : 'NO DATA'}`);
      });
    }

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

        const getFieldValue = (field) => {
          if (editedRow[field] !== undefined) return editedRow[field];
          if (row[field] !== undefined) return row[field];
          return '';
        };

        return {
          id: date,
          dayOfWeek,
          displayDate,
          arias: getFieldValue('arias'),
          ny: getFieldValue('ny'),
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

        const getFieldValue = (field) => {
          if (editedRow[field] !== undefined) return editedRow[field];
          if (row[field] !== undefined) return row[field];
          return '';
        };

        const grossValue = getFieldValue('gross');
        const netValue = getFieldValue('net');
        
        const weekRow = {
          id: weekStart,
          displayPeriod,
          gross: grossValue,
          net: netValue,
          reportDate: weekStart
        };
        
        // Log every week's data
        console.log(`[Production Tracker] Week ${displayPeriod}:`, {
          weekStart,
          hasRowData: Object.keys(row).length > 0,
          rawRow: row,
          grossValue: grossValue,
          netValue: netValue,
          grossType: typeof grossValue,
          netType: typeof netValue
        });
        
        return weekRow;
      });

      console.log('[Production Tracker] Setting tableData with', weeklyRows.length, 'weekly rows');
      console.log('[Production Tracker] First 3 rows going to table:', weeklyRows.slice(0, 3));
      setTableData(weeklyRows);
    } else if (selectedRange === "year") {
      // Year view: Yearly aggregated rows
      const yearlyRows = dateRows.map((year) => {
        const row = productionData[year] || {};
        const editedRow = editedRows[year] || {};
        
        const getFieldValue = (field) => {
          if (editedRow[field] !== undefined) return editedRow[field];
          if (row[field] !== undefined) return row[field];
          return '';
        };

        return {
          id: year,
          displayYear: year,
          net: getFieldValue('net'),
          reportDate: year
        };
      });

      setTableData(yearlyRows);
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
      // IMPORTANT: Weekly_ALP data always uses Wed-Tue weeks, so we force 'wed-tue'
      const currentYear = todayDate.getFullYear();
      const currentWeekStartStr = getWeekStart(todayEastern, 'wed-tue'); // Force Wed-Tue weeks
      const currentWeekStart = new Date(currentWeekStartStr + 'T00:00:00');
      
      console.log('[Production Tracker] Generating weeks starting from:', currentWeekStartStr);
      
      // Start from current week and go back to the first week of the year
      let weekStart = new Date(currentWeekStart);
      
      while (weekStart.getFullYear() === currentYear) {
        const weekStartStr = weekStart.toISOString().split("T")[0];
        dates.push(weekStartStr);
        weekStart.setDate(weekStart.getDate() - 7);
      }
      
      console.log('[Production Tracker] Generated', dates.length, 'weeks. First:', dates[0], 'Last:', dates[dates.length - 1]);
    } else if (selectedRange === "year") {
      // Year view: Generate years from current year back to 2008
      const currentYear = todayDate.getFullYear();
      
      for (let year = currentYear; year >= 2008; year--) {
        dates.push(year.toString());
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
      // Week, Month, and Year views: Show current view (no navigation needed as all data shown)
      const currentYear = new Date().getFullYear();
      let label = "Last 24 Months";
      if (selectedRange === "week") {
        label = `${currentYear} Weeks`;
      } else if (selectedRange === "year") {
        label = "2008 - Present";
      }
      options.push({
        value: todayDate.toISOString(),
        label: label
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

        console.log('[Production Tracker] RAW API response:', result);

        if (!result.success || !Array.isArray(result.data)) {
          console.error("Invalid API response format:", result);
          setProductionData({});
          setLoading(false);
          return;
        }

        // Map by reportDate (week start date)
        const mappedData = {};
        result.data.forEach((entry, index) => {
          if (entry.reportDate) {
            const key = entry.reportDate.split("T")[0];
            mappedData[key] = {
              gross: entry.gross,
              net: entry.net
            };
            if (index < 5) {
              console.log(`[Production Tracker] API entry ${index}:`, entry);
            }
          }
        });

        console.log('[Production Tracker] Mapped weekly data:', Object.keys(mappedData).length, 'weeks');
        console.log('[Production Tracker] All week keys from API:', Object.keys(mappedData).sort());
        console.log('[Production Tracker] Sample data values from API (first 5):');
        Object.entries(mappedData).slice(0, 5).forEach(([key, value]) => {
          console.log(`  ${key}: gross=${value.gross}, net=${value.net}`);
        });
        setProductionData(mappedData);
      } else if (selectedRange === "year") {
        // Year view: Fetch from yearly_sga_alp table
        console.log('[Production Tracker] Fetching yearly data from yearly_sga_alp');
        const response = await api.get('/alp/yearly-tracker');
        const result = response.data;

        if (!result.success || !Array.isArray(result.data)) {
          console.error("Invalid API response format:", result);
          setProductionData({});
          setLoading(false);
          return;
        }

        // Map by year
        const mappedData = {};
        result.data.forEach((entry) => {
          if (entry.year) {
            mappedData[entry.year.toString()] = {
              net: entry.net
            };
          }
        });

        console.log('[Production Tracker] Mapped yearly data:', Object.keys(mappedData).length, 'years');
        setProductionData(mappedData);
      } else {
        // Day view: Fetch from daily_sga_alp table
        const startDate = dateRows[dateRows.length - 1];
        const endDate = dateRows[0];
        
        console.log('[Production Tracker] Fetching daily data from daily_sga_alp');
        const response = await api.get(`/alp/daily-tracker?startDate=${startDate}&endDate=${endDate}`);
        const result = response.data;

        if (!result.success || !Array.isArray(result.data)) {
          console.error("Invalid API response format:", result);
          setProductionData({});
          setLoading(false);
          return;
        }

        // Map by date
        const mappedData = {};
        result.data.forEach((entry) => {
          if (entry.date) {
            const key = entry.date.split("T")[0];
            mappedData[key] = {
              arias: entry.arias,
              ny: entry.ny
            };
          }
        });

        console.log('[Production Tracker] Mapped daily data:', Object.keys(mappedData).length, 'days');
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
      } else if (selectedRange === "day") {
        // Day view: Update daily_sga_alp table
        console.log('[Production Tracker] Submitting daily updates to daily_sga_alp');
        console.log('[Production Tracker] Edited rows:', editedRows);
        
        const response = await api.post("/alp/daily-tracker", {
          updates: editedRows
        });

        const result = response.data;

        if (result.success) {
          console.log(`✅ Successfully updated ${result.successCount} day(s)`);
          setProductionData((prev) => {
            const updated = { ...prev };
            Object.keys(editedRows).forEach(date => {
              updated[date] = {
                ...updated[date],
                ...editedRows[date]
              };
            });
            return updated;
          });
          setEditedRows({});
          alert(`Successfully updated ${result.successCount} day(s)`);
        } else {
          console.error("❌ Update failed:", result.message);
          alert(`Error: ${result.message}`);
        }
      } else {
        // Week and Year views: Read-only, no updates
        console.log('[Production Tracker] Week and Year views are read-only');
        alert('This view is read-only and cannot be edited.');
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
      headers = ['Date', 'Day', 'Arias', 'NY'];
      csvContent = [
        headers.join(','),
        ...tableData.map(row => [
          row.displayDate,
          row.dayOfWeek,
          row.arias || 0,
          row.ny || 0
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
    } else if (selectedRange === "year") {
      headers = ['Year', 'Net'];
      csvContent = [
        headers.join(','),
        ...tableData.map(row => [
          row.displayYear,
          row.net || 0
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
                {selectedRange === "week" ? `${new Date().getFullYear()} Weeks` : 
                 selectedRange === "year" ? "2008 - Present" : "Last 24 Months"}
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
            <span className="separator">|</span>
            <span 
              className={selectedRange === "year" ? "selected" : "unselected"} 
              onClick={() => {
                setSelectedRange("year");
                setCurrentDate(new Date());
              }}
            >
              Year
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
            disableCellEditing={selectedRange === "week" || selectedRange === "year"}  // Week and Year are read-only
            showTotals={selectedRange !== "week" && selectedRange !== "year"}
            totalsPosition="top"
            totalsColumns={
              selectedRange === "day" ? ['arias', 'ny'] : 
              selectedRange === "year" ? ['net'] : 
              ['net', 'gross']
            }
            totalsLabel="Totals"
            totalsLabelColumn={
              selectedRange === "day" ? "displayDate" : 
              selectedRange === "year" ? "displayYear" : 
              "displayPeriod"
            }
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

