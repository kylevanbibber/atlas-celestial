import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';
import DataTable from '../../utils/DataTable';
import Card from '../../utils/Card';
import { FiDownload } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import './PotentialVIPs.css';

const SAGACodes = ({ searchQuery = '', filters = {}, onFilterOptions }) => {
  const { user } = useAuth();
  const [activityData, setActivityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`; // YYYY-MM
  });
  const [isPreparedForExport, setIsPreparedForExport] = useState(false);
  const [activeCardFilter, setActiveCardFilter] = useState(null); // 'noAssociates', 'saAtGoal', 'gaAtGoal'

  useEffect(() => {
    fetchActivityData();
  }, [selectedMonth]);

  const fetchActivityData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/vips/activity', {
        params: { month: selectedMonth }
      });
      
      if (response.data.success) {
        const data = response.data.data || [];
        setActivityData(data);
        setDateRange(response.data.dateRange || {});
        // Update selectedMonth if it was normalized by the server
        if (response.data.selectedMonth && response.data.selectedMonth !== selectedMonth) {
          setSelectedMonth(response.data.selectedMonth);
        }
        
        // Send unique SA/GA/MGA options up for filters
        if (onFilterOptions) {
          const saSet = Array.from(new Set(
            data.flatMap(user => user.associates.map(a => a.SA)).filter(Boolean)
          )).sort();
          const gaSet = Array.from(new Set(
            data.flatMap(user => user.associates.map(a => a.GA)).filter(Boolean)
          )).sort();
          const mgaSet = Array.from(new Set(
            data.flatMap(user => user.associates.map(a => a.MGA)).filter(Boolean)
          )).sort();
          const rgaSet = Array.from(new Set(
            data.flatMap(user => user.associates.map(a => a.RGA)).filter(Boolean)
          )).sort();
          
          onFilterOptions({ 
            saOptions: saSet, 
            gaOptions: gaSet, 
            mgaOptions: mgaSet,
            rgaOptions: rgaSet
          });
        }
      } else {
        setError('Failed to fetch SAGA codes data');
      }
    } catch (err) {
      console.error('Error fetching SAGA codes data:', err);
      setError('Error loading SAGA codes data');
    } finally {
      setLoading(false);
    }
  };


  // Transform data for Excel export (main rows only)
  const transformDataForExport = (data) => {
    const exportData = [];
    data.forEach(user => {
      exportData.push({
        user_role: user.role,
        user_name: user.lagnname,
        user_mga: user.mga || '',
        user_rga: user.rga || '',
        associates_count: user.associatesCount,
        date_range: `${dateRange.startDate} to ${dateRange.endDate}`,
        selected_month: selectedMonth
      });
    });
    return exportData;
  };

  // Excel export function
  const handleXLSXExport = async () => {
    setIsPreparedForExport(true);
    
    try {
      console.log('📊 Starting SAGA Codes XLSX export...');
      
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Transform the filtered data
      const exportData = transformDataForExport(filteredData);
      
      console.log(`📊 Exporting ${exportData.length} SAGA Codes records`);
      
      // Define headers
      const headers = [
        'User Role',
        'User Name',
        'User MGA',
        'User RGA',
        'Associates Count',
        'Date Range',
        'Selected Month'
      ];
      
      // Create data rows
      const dataRows = exportData.map(item => [
        item.user_role,
        item.user_name,
        item.user_mga,
        item.user_rga,
        item.associates_count,
        item.date_range,
        item.selected_month
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
        { wch: 12 }, // User Role
        { wch: 25 }, // User Name
        { wch: 15 }, // User MGA
        { wch: 15 }, // User RGA
        { wch: 15 }, // Associates Count
        { wch: 20 }, // Date Range
        { wch: 12 }  // Selected Month
      ];
      sheet['!cols'] = colWidths;
      
      // Add autofilter
      const tableRange = XLSX.utils.encode_range({
        s: { c: 0, r: 0 },
        e: { c: headers.length - 1, r: dataRows.length }
      });
      sheet['!autofilter'] = { ref: tableRange };
      
      // Freeze header row
      sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, sheet, 'SAGA Codes');
      
      // Generate filename
      const monthLabel = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
      const searchSuffix = (searchQuery || '').trim() ? '_filtered' : '';
      const filename = `SAGA_Codes_${monthLabel.replace(' ', '_')}${searchSuffix}.xlsx`;
      
      // Write and download the file
      XLSX.writeFile(workbook, filename);
      
      console.log(`✅ SAGA Codes XLSX export completed: ${filename}`);
      
    } catch (error) {
      console.error('❌ SAGA Codes XLSX export failed:', error);
      window.alert('Failed to export XLSX file. Please try again.');
    } finally {
      setIsPreparedForExport(false);
    }
  };

  const getRoleBadgeStyle = (cl) => {
    const clname = String(cl || '').toUpperCase();
    const styles = { backgroundColor: 'lightgrey', border: '2px solid grey' };
    switch (clname) {
      case 'SA':
        styles.backgroundColor = 'rgb(178, 82, 113)';
        styles.border = '2px solid rgb(138, 62, 93)';
        break;
      case 'GA':
        styles.backgroundColor = 'rgb(237, 114, 47)';
        styles.border = '2px solid rgb(197, 94, 37)';
        break;
      case 'MGA':
        styles.backgroundColor = 'rgb(104, 182, 117)';
        styles.border = '2px solid rgb(84, 152, 97)';
        break;
      case 'RGA':
        styles.backgroundColor = '#00558c';
        styles.border = '2px solid #004372';
        break;
      case 'AGT':
      default:
        styles.backgroundColor = 'lightgrey';
        styles.border = '2px solid grey';
        break;
    }
    return {
      ...styles,
      padding: '2px 4px',
      borderRadius: '4px',
      fontSize: '10px',
      color: 'white',
      fontWeight: 600,
      letterSpacing: '0.5px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      display: 'inline-block'
    };
  };

  const columns = useMemo(() => [
    {
      Header: 'Role',
      accessor: 'role',
      Cell: ({ value }) => (
        <span 
          className="user-role-badge" 
          style={getRoleBadgeStyle(value)}
        >
          {value}
        </span>
      ),
      width: 80
    },
    {
      Header: 'User Name',
      accessor: 'lagnname',
      Cell: ({ value }) => (
        <span className="user-name">{value}</span>
      )
    },
    {
      Header: 'MGA',
      accessor: 'mga',
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'RGA', 
      accessor: 'rga',
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'Associates Count',
      accessor: 'associatesCount',
      Cell: ({ value }) => (
        <span className="count-badge">
          {value.toLocaleString()}
        </span>
      )
    }
  ], []);

  // KPI cards data
  const { totalSAs, totalGAs, zeroAssociatesCount, saAtGoalCount, saAtGoalPct, gaAtGoalCount, gaAtGoalPct, zeroAssociatesPct } = useMemo(() => {
    const saUsers = activityData.filter(user => user.role === 'SA');
    const gaUsers = activityData.filter(user => user.role === 'GA');
    const totalUsers = activityData.length;
    
    const zeroAssociates = activityData.filter(user => user.associatesCount === 0).length;
    const saAtGoal = saUsers.filter(user => user.associatesCount >= 1).length;
    const gaAtGoal = gaUsers.filter(user => user.associatesCount >= 1).length;
    
    const saAtGoalPct = saUsers.length > 0 ? Math.round((saAtGoal / saUsers.length) * 100) : 0;
    const gaAtGoalPct = gaUsers.length > 0 ? Math.round((gaAtGoal / gaUsers.length) * 100) : 0;
    const zeroAssociatesPct = totalUsers > 0 ? Math.round((zeroAssociates / totalUsers) * 100) : 0;
    
    return {
      totalSAs: saUsers.length,
      totalGAs: gaUsers.length,
      zeroAssociatesCount: zeroAssociates,
      saAtGoalCount: saAtGoal,
      saAtGoalPct,
      gaAtGoalCount: gaAtGoal,
      gaAtGoalPct,
      zeroAssociatesPct
    };
  }, [activityData]);

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

  // Apply search and filters
  const filteredData = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim();
    const f = filters || {};

    return activityData.filter(user => {
      // Search filter
      const matchesSearch = !q || (
        user.lagnname.toLowerCase().includes(q) ||
        (user.mga || '').toLowerCase().includes(q) ||
        (user.rga || '').toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q) ||
        user.associates.some(a => 
          (a.LagnName || '').toLowerCase().includes(q) ||
          (a.SA || '').toLowerCase().includes(q) ||
          (a.GA || '').toLowerCase().includes(q) ||
          (a.MGA || '').toLowerCase().includes(q) ||
          (a.RGA || '').toLowerCase().includes(q)
        )
      );
      if (!matchesSearch) return false;

      // Card-based filters
      if (activeCardFilter === 'noAssociates' && user.associatesCount !== 0) return false;
      if (activeCardFilter === 'saAtGoal' && (user.role !== 'SA' || user.associatesCount < 1)) return false;
      if (activeCardFilter === 'gaAtGoal' && (user.role !== 'GA' || user.associatesCount < 1)) return false;

      // Role filters via SA/GA/MGA hierarchy
      let hasMatchingAssociates = true;
      if (f.sa && f.sa !== 'All') {
        hasMatchingAssociates = user.associates.some(a => a.SA === f.sa);
      }
      if (f.ga && f.ga !== 'All' && hasMatchingAssociates) {
        hasMatchingAssociates = user.associates.some(a => a.GA === f.ga);
      }
      if (f.mga && f.mga !== 'All' && hasMatchingAssociates) {
        hasMatchingAssociates = user.associates.some(a => a.MGA === f.mga);
      }
      if (f.rga && f.rga !== 'All' && hasMatchingAssociates) {
        hasMatchingAssociates = user.associates.some(a => a.RGA === f.rga);
      }

      return hasMatchingAssociates;
    });
  }, [activityData, searchQuery, filters, activeCardFilter]);

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
    // Build a dropdown of the last 12 months from current date (fixed reference point)
    const opts = [];
    const now = new Date(); // Fixed reference point - always current date
    const base = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const value = `${yy}-${mm}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      opts.push({ value, label });
    }
    return opts;
  }, []); // No dependencies - only regenerate on component mount

  const renderExpandedRow = (rowData) => {
    return (
      <div className="expanded-content" style={{
        padding: '16px',
        backgroundColor: 'var(--card-bg)',
        borderTop: '1px solid var(--border-color)'
      }}>
        <h4 style={{ 
          margin: '0 0 12px 0',
          color: 'var(--text-primary)',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          Associates Activity ({rowData.associates.length} records)
        </h4>
        {rowData.associates.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            No associates activity found for the last 2 months.
          </p>
        ) : (
          <div className="associates-table" style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
            gap: '8px 16px',
            fontSize: '13px'
          }}>
            <div style={{ fontWeight: '600', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              Associate Name
            </div>
            <div style={{ fontWeight: '600', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              Production Date
            </div>
            <div style={{ fontWeight: '600', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              SA
            </div>
            <div style={{ fontWeight: '600', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              GA
            </div>
            <div style={{ fontWeight: '600', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              MGA
            </div>
            <div style={{ fontWeight: '600', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              RGA
            </div>
            
            {rowData.associates.map((associate, i) => (
              <React.Fragment key={`associate-${i}`}>
                <div style={{ padding: '4px 0' }}>{associate.LagnName}</div>
                <div style={{ padding: '4px 0' }}>{associate.PRODDATE}</div>
                <div style={{ padding: '4px 0' }}>{associate.SA || '-'}</div>
                <div style={{ padding: '4px 0' }}>{associate.GA || '-'}</div>
                <div style={{ padding: '4px 0' }}>{associate.MGA || '-'}</div>
                <div style={{ padding: '4px 0' }}>{associate.RGA || '-'}</div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  };

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

      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
        {dateRange.startDate && dateRange.endDate && 
          `Data from ${dateRange.startDate} to ${dateRange.endDate}`
        }
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

  if (loading) {
    return (
      <div className="vips-loading">
        <div className="vips-loading-spinner"></div>
        <span className="vips-loading-text">Loading SAGA codes data...</span>
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
                onClick={fetchActivityData}
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
      {/* Custom styles for this component */}
      <style>{`
        .count-badge {
          font-weight: 600;
          color: var(--primary-color);
        }
        .user-name {
          font-weight: 500;
        }
        .spinning { 
          animation: spin 1s linear infinite; 
        }
        @keyframes spin { 
          from { transform: rotate(0deg); } 
          to { transform: rotate(360deg); } 
        }
        .card-clickable {
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }
        .card-clickable:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .card-active {
          border: 2px solid #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
        }
        .card-active::after {
          content: '✓';
          position: absolute;
          top: 8px;
          right: 12px;
          color: #3b82f6;
          font-weight: bold;
          font-size: 16px;
        }
      `}</style>

      {/* KPI Cards styled like dashboard summary cards */}
      <div className="summary-cards">
        <div 
          className={`card-clickable ${activeCardFilter === 'noAssociates' ? 'card-active' : ''}`}
          onClick={() => handleCardClick('noAssociates')}
          title="Click to filter by users with no associates"
        >
          <Card 
            title="No Associates" 
            value={zeroAssociatesCount.toLocaleString()} 
            subText={`${zeroAssociatesPct}% of total`}
            donut
            percentage={zeroAssociatesPct}
            donutColor="#ef4444"
          />
        </div>
        <div 
          className={`card-clickable ${activeCardFilter === 'saAtGoal' ? 'card-active' : ''}`}
          onClick={() => handleCardClick('saAtGoal')}
          title="Click to filter by SAs with at least 1 associate"
        >
          <Card 
            title="SAs At Goal" 
            value={saAtGoalCount.toLocaleString()} 
            subText={`${saAtGoalPct}% of ${totalSAs} SAs`}
            donut
            percentage={saAtGoalPct}
            donutColor="rgb(178, 82, 113)"
          />
        </div>
        <div 
          className={`card-clickable ${activeCardFilter === 'gaAtGoal' ? 'card-active' : ''}`}
          onClick={() => handleCardClick('gaAtGoal')}
          title="Click to filter by GAs with at least 1 associate"
        >
          <Card 
            title="GAs At Goal" 
            value={gaAtGoalCount.toLocaleString()} 
            subText={`${gaAtGoalPct}% of ${totalGAs} GAs`}
            donut
            percentage={gaAtGoalPct}
            donutColor="rgb(237, 114, 47)"
          />
        </div>
      </div>

      <div className="vips-content">
        <div className="vips-content-inner">
          <DataTable
            columns={columns}
            data={filteredData}
            defaultSortBy="associatesCount"
            defaultSortOrder="desc"
            onRefresh={fetchActivityData}
            enableRowExpansion={true}
            renderExpandedRow={renderExpandedRow}
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

export default SAGACodes;
