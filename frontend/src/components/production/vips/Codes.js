import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useUserHierarchy } from '../../../hooks/useUserHierarchy';
import api from '../../../api';
import DataTable from '../../utils/DataTable';
import Card from '../../utils/Card';
import { FiDownload } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import '../reports/RefReport.css';
import './PotentialVIPs.css';

const Codes = ({ searchQuery = '', filters = {}, onFilterOptions }) => {
  const { user } = useAuth();
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const isAdmin = user?.Role === 'Admin'; // Any admin can see all codes
  
  // Get allowed IDs from cached hierarchy data
  const allowedIds = useMemo(() => {
    if (isAdmin) return []; // Admins see all data
    return getHierarchyForComponent('ids');
  }, [isAdmin, getHierarchyForComponent]);
  
  const allowedIdsSet = useMemo(() => new Set(allowedIds.map(id => String(id))), [allowedIds]);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPreparedForExport, setIsPreparedForExport] = useState(false);
  const [historicalData, setHistoricalData] = useState([]);
  const [committedUsers, setCommittedUsers] = useState(new Map()); // Map of lagnname -> committed_at date
  const [historicalMetrics, setHistoricalMetrics] = useState({
    dailyAvg: 0,
    weeklyAvg: 0,
    quickCodersCount: 0,
    quickCodersTotal: 0,
    quickCodersPercentage: 0
  });
  const [activeCardFilter, setActiveCardFilter] = useState(null); // 'quickCoders'
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`; // YYYY-MM
  });

  useEffect(() => {
    // Only fetch when we have hierarchy data for non-admin users, or anytime for admins
    if (isAdmin || (hierarchyData && allowedIds.length > 0)) {
      fetchCodes();
      fetchCommittedUsers();
    }
  }, [selectedMonth, isAdmin, hierarchyData, allowedIds]);

  const fetchCodes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/admin/codes', {
        params: { 
          month: selectedMonth,
          includeHistorical: 'true'
        }
      });
      
      if (response.data.success) {
        const raw = response.data.data || [];
        const historical = response.data.historicalData || [];
        
        // Apply hierarchy filtering for non-admin users
        let mapped = raw;
        let historicalMapped = historical;
        
        if (!isAdmin) {
          mapped = mapped.filter(r => r.userId !== undefined && r.userId !== null && allowedIdsSet.has(String(r.userId)));
          historicalMapped = historicalMapped.filter(r => r.userId !== undefined && r.userId !== null && allowedIdsSet.has(String(r.userId)));
        }
        
        setCodes(mapped);
        setHistoricalData(historicalMapped);
        
        // Calculate previous month metrics for comparison
        calculateHistoricalMetrics(historicalMapped);
        
        // Send unique SA/GA/MGA/RGA options up
        if (onFilterOptions) {
          const saSet = Array.from(new Set(mapped.map(r => r.SA).filter(Boolean))).sort();
          const gaSet = Array.from(new Set(mapped.map(r => r.GA).filter(Boolean))).sort();
          const mgaSet = Array.from(new Set(mapped.map(r => r.MGA).filter(Boolean))).sort();
          const rgaSet = Array.from(new Set(mapped.map(r => r.RGA).filter(Boolean))).sort();
          onFilterOptions({ 
            saOptions: saSet, 
            gaOptions: gaSet, 
            mgaOptions: mgaSet,
            rgaOptions: rgaSet 
          });
        }
      } else {
        setError('Failed to fetch codes data');
      }
    } catch (err) {
      console.error('Error fetching codes:', err);
      setError('Error loading codes data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommittedUsers = async () => {
    try {
      console.log('[Codes] 🔍 Fetching committed users...');
      const response = await api.get('/admin/pending-users/commits');
      
      if (response.data.success) {
        const commits = response.data.data || [];
        // Create a Map of lagnname -> committed_at date for easy lookup
        const commitMap = new Map(
          commits.map(c => [c.lagnname, new Date(c.committed_at)])
        );
        console.log('[Codes] ✅ Committed users loaded:', commitMap.size);
        setCommittedUsers(commitMap);
      }
    } catch (err) {
      console.error('[Codes] ❌ Error fetching committed users:', err);
      // Don't set error state, just log it - this is non-critical
    }
  };

  // Calculate previous month metrics for comparison
  const calculateHistoricalMetrics = useCallback((previousMonthData) => {
    if (!previousMonthData || previousMonthData.length === 0) {
      setHistoricalMetrics({
        dailyAvg: 0,
        weeklyAvg: 0,
        quickCodersCount: 0,
        quickCodersTotal: 0,
        quickCodersPercentage: 0
      });
      return;
    }

    // Get the previous month info from selected month
    const [currentYear, currentMonth] = selectedMonth.split('-').map(Number);
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    const daysInPreviousMonth = new Date(previousYear, previousMonth, 0).getDate();
    const weeksInPreviousMonth = Math.ceil(daysInPreviousMonth / 7);

    const totalCodes = previousMonthData.length;
    const dailyAvg = totalCodes / daysInPreviousMonth;
    const weeklyAvg = totalCodes / weeksInPreviousMonth;

    // Calculate quick coders from previous month
    const quickCoders = previousMonthData.filter(record => 
      record.days_to_code != null && 
      parseInt(record.days_to_code) <= 7 && 
      parseInt(record.days_to_code) >= 0
    ).length;
    
    const agentsWithPendingData = previousMonthData.filter(record => record.days_to_code != null).length;
    const quickCodersPercentage = agentsWithPendingData > 0 ? (quickCoders / agentsWithPendingData) * 100 : 0;

    const historicalMetricsCalc = {
      dailyAvg: Math.round(dailyAvg * 10) / 10,
      weeklyAvg: Math.round(weeklyAvg * 10) / 10,
      quickCodersCount: quickCoders,
      quickCodersTotal: agentsWithPendingData,
      quickCodersPercentage: Math.round(quickCodersPercentage * 10) / 10
    };

    setHistoricalMetrics(historicalMetricsCalc);
  }, [selectedMonth]);

  // Card click handlers
  const handleCardClick = (cardType) => {
    if (activeCardFilter === cardType) {
      // If clicking the same card, clear the filter
      setActiveCardFilter(null);
    } else {
      // Set the new filter
      setActiveCardFilter(cardType);
    }
  };

  // Transform data for Excel export
  const transformDataForExport = (data) => {
    return data.map(item => ({
      agent_name: item.LagnName || '',
      agent_number: item.AgtNum || '',
      prod_date: item.PRODDATE || '',
      pending_date: item.PendingDate || '',
      days_to_code: item.days_to_code != null ? item.days_to_code : '',
      sa: item.SA || '',
      ga: item.GA || '',
      mga: item.MGA || '',
      rga: item.RGA || '',
      month: selectedMonth
    }));
  };

  // Excel export function
  const handleXLSXExport = async () => {
    setIsPreparedForExport(true);
    
    try {
      console.log('📊 Starting Codes XLSX export...');
      
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Transform the filtered data
      const exportData = transformDataForExport(filteredData);
      
      console.log(`📊 Exporting ${exportData.length} Code records`);
      
      // Define headers
      const headers = [
        'Agent Name',
        'Agent Number',
        'Production Date',
        'Pending Date',
        'Days to Code',
        'SA',
        'GA',
        'MGA',
        'RGA',
        'Month'
      ];
      
      // Create data rows
      const dataRows = exportData.map(item => [
        item.agent_name,
        item.agent_number,
        item.prod_date,
        item.pending_date,
        item.days_to_code,
        item.sa,
        item.ga,
        item.mga,
        item.rga,
        item.month
      ]);
      
      // Create sheet data
      const sheetData = [headers, ...dataRows];
      const sheet = XLSX.utils.aoa_to_sheet(sheetData);
      
      // Apply formatting
      const range = XLSX.utils.decode_range(sheet['!ref']);
      
      // Format header row
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (sheet[cellRef]) {
          sheet[cellRef].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { bgColor: { indexed: 64 }, fgColor: { rgb: "366092" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" }
            }
          };
        }
      }
      
      // Set column widths
      const colWidths = [
        { wch: 25 }, // Agent Name
        { wch: 15 }, // Agent Number
        { wch: 15 }, // Production Date
        { wch: 15 }, // Pending Date
        { wch: 12 }, // Days to Code
        { wch: 12 }, // SA
        { wch: 12 }, // GA
        { wch: 12 }, // MGA
        { wch: 12 }, // RGA
        { wch: 10 }  // Month
      ];
      sheet['!cols'] = colWidths;
      
      // Add autofilter (enables filtering dropdowns)
      const tableRange = XLSX.utils.encode_range({
        s: { c: 0, r: 0 }, // Start at A1
        e: { c: headers.length - 1, r: dataRows.length } // End at last column, last row
      });
      sheet['!autofilter'] = { ref: tableRange };
      
      // Freeze header row
      sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, sheet, 'Codes');
      
      // Generate filename
      const monthLabel = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
      const searchSuffix = (searchQuery || '').trim() ? '_filtered' : '';
      const filename = `Codes_${monthLabel.replace(' ', '_')}${searchSuffix}.xlsx`;
      
      // Write and download the file
      XLSX.writeFile(workbook, filename);
      
      console.log(`✅ Codes XLSX export completed: ${filename}`);
      
    } catch (error) {
      console.error('❌ Codes XLSX export failed:', error);
      window.alert('Failed to export XLSX file. Please try again.');
    } finally {
      setIsPreparedForExport(false);
    }
  };

  const columns = useMemo(() => [
    {
      Header: 'Agent Name',
      accessor: 'LagnName',
      Cell: ({ value }) => (
        <span className="agent-name">{value}</span>
      )
    },
    {
      Header: 'Agent Number',
      accessor: 'AgtNum',
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'Production Date',
      accessor: 'PRODDATE',
      Cell: ({ value }) => {
        if (!value) return '-';
        // Format date if needed
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        return String(value);
      }
    },
    {
      Header: 'Pending Date',
      accessor: 'PendingDate',
      Cell: ({ value }) => {
        if (!value) return '-';
        // Format date if needed
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        return String(value);
      }
    },
    {
      Header: 'Days to Code',
      accessor: 'days_to_code',
      Cell: ({ value }) => {
        if (value == null) return '-';
        const days = parseInt(value);
        
        // Color coding similar to DaysPending
        let color = '#333';
        if (days < 0) color = '#dc3545'; // Red for negative days (coded before pending)
        else if (days > 60) color = '#dc3545'; // Red for over 60 days
        else if (days > 30) color = '#ffc107'; // Yellow for over 30 days
        else if (days >= 0) color = '#28a745'; // Green for normal range
        
        return <span style={{ color, fontWeight: '500' }}>{days}</span>;
      },
    },
    {
      Header: 'SA',
      accessor: 'SA',
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'GA',
      accessor: 'GA',
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'MGA',
      accessor: 'MGA',
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'RGA',
      accessor: 'RGA',
      Cell: ({ value }) => value || '-'
    }
  ], []);

  // Month navigation controls
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1); // previous month
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${ny}-${nm}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1); // next month
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${ny}-${nm}`);
  };

  const monthOptions = useMemo(() => {
    // Build a dropdown of the last 12 months including current
    const opts = [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const base = new Date(y, m - 1, 1);
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const value = `${yy}-${mm}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      opts.push({ value, label });
    }
    return opts;
  }, [selectedMonth]);

  // KPI cards data - now based on selected month data
  const { totalCount, weeklyAvg, dailyAvg, quickCoders } = useMemo(() => {
    const total = codes.length;
    
    // Calculate averages based on the selected month
    const [selYearStr, selMonthStr] = selectedMonth.split('-');
    const selYear = parseInt(selYearStr, 10);
    const selMonth = parseInt(selMonthStr, 10) - 1; // 0-based month
    const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
    const weeksInMonth = Math.ceil(daysInMonth / 7);
    
    const daily = total > 0 ? Math.round(total / daysInMonth * 10) / 10 : 0;
    const weekly = total > 0 ? Math.round(total / weeksInMonth * 10) / 10 : 0;
    
    // Count agents with days_to_code <= 7 (quick coders)
    const quickCodersCount = codes.filter(agent => 
      agent.days_to_code != null && 
      parseInt(agent.days_to_code) <= 7 && 
      parseInt(agent.days_to_code) >= 0 // Exclude negative values
    ).length;
    
    // Calculate total agents with pending data (those who have days_to_code data)
    const agentsWithPendingData = codes.filter(agent => agent.days_to_code != null).length;
    
    const quickCodersPercentage = agentsWithPendingData > 0 ? Math.round((quickCodersCount / agentsWithPendingData) * 100) : 0;
    
    return { 
      totalCount: total,
      weeklyAvg: weekly,
      dailyAvg: daily,
      quickCoders: {
        count: quickCodersCount,
        total: agentsWithPendingData,
        percentage: quickCodersPercentage
      }
    };
  }, [codes, selectedMonth]);

  // Apply search and dropdown filters
  const filteredData = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim();
    const f = filters || {};

    return codes
      .filter(row => {
        // search
        const matchesSearch = !q || (
          (row.LagnName || '').toLowerCase().includes(q) ||
          (row.AgtNum || '').toLowerCase().includes(q) ||
          (row.SA || '').toLowerCase().includes(q) ||
          (row.GA || '').toLowerCase().includes(q) ||
          (row.MGA || '').toLowerCase().includes(q) ||
          (row.RGA || '').toLowerCase().includes(q)
        );
        if (!matchesSearch) return false;

        // Card-based filter for Quick Coders
        if (activeCardFilter === 'quickCoders') {
          const isQuickCoder = row.days_to_code != null && 
            parseInt(row.days_to_code) <= 7 && 
            parseInt(row.days_to_code) >= 0;
          if (!isQuickCoder) return false;
        }

        // SA/GA/MGA/RGA filters
        if (f.sa && f.sa !== 'All' && row.SA !== f.sa) return false;
        if (f.ga && f.ga !== 'All' && row.GA !== f.ga) return false;
        if (f.mga && f.mga !== 'All' && row.MGA !== f.mga) return false;
        if (f.rga && f.rga !== 'All' && row.RGA !== f.rga) return false;

        return true;
      })
      .map(row => {
        // Check if this agent was committed and coded within 7 days
        let rowColor = undefined;
        
        if (row.LagnName && committedUsers.has(row.LagnName)) {
          const committedDate = committedUsers.get(row.LagnName);
          const prodDate = row.PRODDATE ? new Date(row.PRODDATE) : null;
          
          if (prodDate && committedDate) {
            // Calculate days between commit and code
            const daysDiff = Math.floor((prodDate - committedDate) / (1000 * 60 * 60 * 24));
            
            // If coded within 7 days after being committed, highlight green
            if (daysDiff >= 0 && daysDiff <= 7) {
              rowColor = '#C6F6D5'; // Light green
              console.log(`[Codes] ✅ ${row.LagnName} coded within 7 days (${daysDiff} days) - highlighting green`);
            }
          }
        }
        
        return {
          ...row,
          rowcolor: rowColor
        };
      });
  }, [codes, searchQuery, filters, activeCardFilter, committedUsers]);

  const actionBarExtras = (
    <div className="action-bar-controls" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
      <div className="action-bar-month-selector">
        <button onClick={handlePrevMonth} className="action-button" aria-label="Previous Month">{"<"}</button>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="month-selector"
        >
          {monthOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button onClick={handleNextMonth} className="action-button" aria-label="Next Month">{">"}</button>
      </div>
      
      <button 
        onClick={handleXLSXExport}
        className="action-button"
        title={`Export to Excel${(searchQuery || '').trim() ? ' (filtered)' : ''}`}
        disabled={isPreparedForExport || filteredData.length === 0}
        aria-label="Export to Excel"
      >
        <FiDownload className={isPreparedForExport ? 'spinning' : ''} />
      </button>
    </div>
  );

  if (loading || (hierarchyLoading && !hierarchyData)) {
    return (
      <div className="vips-loading">
        <div className="vips-loading-spinner"></div>
        <span className="vips-loading-text">Loading codes{hierarchyLoading ? ' and user permissions' : ''}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vips-error">
        <div className="vips-error-content">
          <div className="vips-error-details">
            <h3 className="vips-error-title">Error</h3>
            <div className="vips-error-message">
              <p>{error}</p>
            </div>
            <div className="vips-error-actions">
              <button
                onClick={fetchCodes}
                className="vips-retry-button"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row coloring styles */}
      <style>{`
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { 
          from { transform: rotate(0deg); } 
          to { transform: rotate(360deg); } 
        }
      `}</style>

      {/* KPI Cards styled like dashboard summary cards */}
      <div className="summary-cards">
        <Card 
          title="Daily Average" 
          value={`${dailyAvg.toFixed(1)} codes/day`}
          subText={`Last month: ${historicalMetrics.dailyAvg.toFixed(1)} (${dailyAvg >= historicalMetrics.dailyAvg ? '+' : ''}${(dailyAvg - historicalMetrics.dailyAvg).toFixed(1)})`}
        />
        <Card 
          title="Weekly Average" 
          value={`${weeklyAvg.toFixed(1)} codes/week`}
          subText={`Last month: ${historicalMetrics.weeklyAvg.toFixed(1)} (${weeklyAvg >= historicalMetrics.weeklyAvg ? '+' : ''}${(weeklyAvg - historicalMetrics.weeklyAvg).toFixed(1)})`}
        />
        <Card 
          title="Quick Coders" 
          value={`${quickCoders.count} of ${quickCoders.total}`}
          subText={`Last month: ${historicalMetrics.quickCodersCount} of ${historicalMetrics.quickCodersTotal} (${quickCoders.count >= historicalMetrics.quickCodersCount ? '+' : ''}${(quickCoders.count - historicalMetrics.quickCodersCount)})`}
          donut
          percentage={quickCoders.percentage}
          donutColor="#f59e0b"
          onClick={() => handleCardClick('quickCoders')}
          style={{ 
            cursor: 'pointer',
            border: activeCardFilter === 'quickCoders' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
            boxShadow: activeCardFilter === 'quickCoders' ? '0 4px 12px rgba(245, 158, 11, 0.3)' : '0 2px 4px var(--shadow-color)'
          }}
        />
      </div>


      <div className="vips-content">
        <div className="vips-content-inner">
          <DataTable
            columns={columns}
            data={filteredData}
            defaultSortBy="PRODDATE"
            defaultSortOrder="desc"
            onRefresh={fetchCodes}
            enableRowColoring={true}
            rowColorColumn="rowcolor"
            actionBarButtons={{
              addNew: false,
              import: false,
              export: false,
              delete: false,
              archive: false,
              sendEmail: false,
              toggleArchived: false,
              refresh: true,
              reassign: false,
              saveChanges: false,
              cancelChanges: false
            }}
            actionBarExtras={actionBarExtras}
          />
        </div>
      </div>
    </div>
  );
};

export default Codes;
