import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useUserHierarchy } from '../../../hooks/useUserHierarchy';
import api from '../../../api';
import DataTable from '../../utils/DataTable';
import Card from '../../utils/Card';
import { FiDownload } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import '../reports/RefReport.css';
import './PotentialVIPs.css';

const PotentialVIPs = ({ searchQuery = '', filters = {}, onFilterOptions }) => {
  const { user } = useAuth();
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const isAdmin = user?.Role === 'Admin'; // Any admin can see all potential VIPs
  
  // Get allowed IDs from cached hierarchy data, excluding managerActive = 'n' users
  const allowedIds = useMemo(() => {
    if (isAdmin) return []; // Admins see all data
    
    // Get full hierarchy data to check managerActive status
    const fullHierarchyData = getHierarchyForComponent('full') || [];
    
    // Create a map of userId to managerActive status
    const managerActiveMap = new Map();
    fullHierarchyData.forEach(user => {
      if (user.id && user.managerActive !== undefined) {
        managerActiveMap.set(String(user.id), String(user.managerActive).toLowerCase() === 'y');
      }
    });
    
    // Get base allowed IDs and filter out managerActive = 'n' users
    const baseAllowedIds = getHierarchyForComponent('ids') || [];
    return baseAllowedIds.filter(id => {
      const isManagerActive = managerActiveMap.get(String(id));
      return isManagerActive !== false; // Include if not found (undefined) or if true
    });
  }, [isAdmin, getHierarchyForComponent]);
  
  const allowedIdsSet = useMemo(() => new Set(allowedIds.map(id => String(id))), [allowedIds]);
  const [potentialVIPs, setPotentialVIPs] = useState([]);
  const [totalPotentialCount, setTotalPotentialCount] = useState(0);
  const [rowClasses, setRowClasses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`; // YYYY-MM
  });
  const [isPreparedForExport, setIsPreparedForExport] = useState(false);

  const usdFormatter = useMemo(() => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }), []);

  const threshold = 5000;

  useEffect(() => {
    // Only fetch when we have hierarchy data for non-admin users, or anytime for admins
    if (isAdmin || (hierarchyData && allowedIds.length > 0)) {
      fetchPotentialVIPs();
    }
  }, [selectedMonth, isAdmin, hierarchyData, allowedIds]);

  const computeRowClasses = (rows) => {
    const classes = {};

    // Determine pace target based on selected month
    const now = new Date();
    const [selYearStr, selMonthStr] = selectedMonth.split('-');
    const selYear = parseInt(selYearStr, 10);
    const selMonthIndex = parseInt(selMonthStr, 10) - 1;
    const isCurrentMonth = now.getFullYear() === selYear && now.getMonth() === selMonthIndex;

    let targetSoFar;
    if (isCurrentMonth) {
      const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      targetSoFar = (threshold * dayOfMonth) / totalDays;
    } else {
      // For non-current months, do not mark "on pace"; only mark hits
      targetSoFar = Number.POSITIVE_INFINITY;
    }

    rows.forEach((r) => {
      const gross = typeof r.totalLvl1Gross === 'number' ? r.totalLvl1Gross : parseFloat(r.totalLvl1Gross || 0);
      if (gross >= threshold) {
        classes[r.id] = 'vip-hit';
      } else if (gross >= targetSoFar) {
        classes[r.id] = 'vip-onpace';
      }
    });
    setRowClasses(classes);
  };

  const fetchPotentialVIPs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/admin/potential-vips', {
        params: { month: selectedMonth }
      });
      
      if (response.data.success) {
        const raw = response.data.data || [];
        const totalPotential = response.data.totalPotentialCount || 0;
        // Ensure gross is numeric for correct sorting
        let mapped = raw.map(r => {
          const gross = typeof r.totalLvl1Gross === 'number' ? r.totalLvl1Gross : parseFloat(r.totalLvl1Gross || 0);
          return {
            ...r,
            totalLvl1Gross: isNaN(gross) ? 0 : gross
          };
        });
        // Apply hierarchy filtering for non-admin users (includes managerActive filtering)
        if (!isAdmin) {
          mapped = mapped.filter(r => r.id !== undefined && r.id !== null && allowedIdsSet.has(String(r.id)));
        } else {
          // For admin users, still filter out managerActive = 'n' users
          // Get full hierarchy data to check managerActive status
          const fullHierarchyData = hierarchyData ? getHierarchyForComponent('full') || [] : [];
          const managerActiveMap = new Map();
          fullHierarchyData.forEach(user => {
            if (user.id && user.managerActive !== undefined) {
              managerActiveMap.set(String(user.id), String(user.managerActive).toLowerCase() === 'y');
            }
          });
          
          // Filter out managerActive = 'n' users for admins too
          mapped = mapped.filter(r => {
            const isManagerActive = managerActiveMap.get(String(r.id));
            return isManagerActive !== false; // Include if not found (undefined) or if true
          });
        }
        // Fetch reported ALP sums from Daily_Activity for the selected month and merge
        try {
          const userIds = Array.from(new Set(mapped.map(r => r.id).filter(Boolean)));
          if (userIds.length > 0) {
            const sumsResp = await api.get('/dailyActivity/sum-by-users', {
              params: { userIds: userIds.join(','), month: selectedMonth }
            });
            if (sumsResp.data && sumsResp.data.success) {
              const list = Array.isArray(sumsResp.data.data) ? sumsResp.data.data : [];
              const idToAlp = new Map(list.map(row => [Number(row.userId), Number(row.monthlyAlp) || 0]));
              mapped = mapped.map(r => ({
                ...r,
                reportedAlp: idToAlp.get(Number(r.id)) || 0
              }));
            } else {
              mapped = mapped.map(r => ({ ...r, reportedAlp: 0 }));
            }
          } else {
            mapped = mapped.map(r => ({ ...r, reportedAlp: 0 }));
          }
        } catch (sumErr) {
          console.warn('[VIPs] Failed to fetch monthly reported ALP sums:', sumErr);
          mapped = mapped.map(r => ({ ...r, reportedAlp: 0 }));
        }
        setPotentialVIPs(mapped);
        setTotalPotentialCount(totalPotential);
        computeRowClasses(mapped);
        // Send unique SA/GA/MGA options up
        if (onFilterOptions) {
          const saSet = Array.from(new Set(mapped.map(r => r.sa).filter(Boolean))).sort();
          const gaSet = Array.from(new Set(mapped.map(r => r.ga).filter(Boolean))).sort();
          const mgaSet = Array.from(new Set(mapped.map(r => r.mga).filter(Boolean))).sort();
          onFilterOptions({ saOptions: saSet, gaOptions: gaSet, mgaOptions: mgaSet });
        }
      } else {
        setError('Failed to fetch potential VIPs data');
      }
    } catch (err) {
      console.error('Error fetching potential VIPs:', err);
      setError('Error loading potential VIPs data');
    } finally {
      setLoading(false);
    }
  };

  // Transform data for Excel export
  const transformDataForExport = (data) => {
    return data.map(item => ({
      agent_name: item.lagnname || '',
      start_date: item.esid || '',
      vip_status: `VIP Month ${item.vipEligibleMonth}/3`,
      total_lvl1_gross: typeof item.totalLvl1Gross === 'number' ? item.totalLvl1Gross : parseFloat(item.totalLvl1Gross || 0),
      reported_alp: typeof item.reportedAlp === 'number' ? item.reportedAlp : parseFloat(item.reportedAlp || 0),
      latest_report_date: item.latestReportDate || 'No reports',
      sa: item.sa || '',
      ga: item.ga || '',
      mga: item.mga || '',
      month: selectedMonth
    }));
  };

  // Excel export function
  const handleXLSXExport = async () => {
    setIsPreparedForExport(true);
    
    try {
      console.log('📊 Starting Potential VIPs XLSX export...');
      
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Transform the filtered data
      const exportData = transformDataForExport(filteredData);
      
      console.log(`📊 Exporting ${exportData.length} Potential VIP records`);
      
      // Define headers
      const headers = [
        'Agent Name',
        'Start Date',
        'VIP Status',
        'Total LVL_1_GROSS',
        'Reported ALP',
        'Latest Report Date',
        'SA',
        'GA',
        'MGA',
        'Month'
      ];
      
      // Create data rows
      const dataRows = exportData.map(item => [
        item.agent_name,
        item.start_date,
        item.vip_status,
        item.total_lvl1_gross,
        item.reported_alp,
        item.latest_report_date,
        item.sa,
        item.ga,
        item.mga,
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
        { wch: 15 }, // Start Date
        { wch: 15 }, // VIP Status
        { wch: 18 }, // Total LVL_1_GROSS
        { wch: 16 }, // Reported ALP
        { wch: 18 }, // Latest Report Date
        { wch: 12 }, // SA
        { wch: 12 }, // GA
        { wch: 12 }, // MGA
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
      XLSX.utils.book_append_sheet(workbook, sheet, 'Potential VIPs');
      
      // Generate filename
      const monthLabel = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
      const searchSuffix = (searchQuery || '').trim() ? '_filtered' : '';
      const filename = `Potential_VIPs_${monthLabel.replace(' ', '_')}${searchSuffix}.xlsx`;
      
      // Write and download the file
      XLSX.writeFile(workbook, filename);
      
      console.log(`✅ Potential VIPs XLSX export completed: ${filename}`);
      
    } catch (error) {
      console.error('❌ Potential VIPs XLSX export failed:', error);
      window.alert('Failed to export XLSX file. Please try again.');
    } finally {
      setIsPreparedForExport(false);
    }
  };

  const columns = useMemo(() => [
    {
      Header: 'Agent Name',
      accessor: 'lagnname',
      Cell: ({ value }) => (
        <span className="agent-name">{value}</span>
      )
    },
    {
      Header: 'Start Date',
      accessor: 'esid',
      Cell: ({ value }) => {
        if (!value) return '-';
        return String(value);
      }
    },
    {
      Header: 'VIP Status',
      accessor: 'vipEligibleMonth',
      Cell: ({ value }) => (
        <span className="vip-status-badge">
          {`VIP Month ${Number(value || 0) + 1}/3`}
        </span>
      )
    },
    {
      Header: 'Total LVL_1_GROSS',
      accessor: 'totalLvl1Gross',
      Cell: ({ value }) => (
        <span className="gross-amount">
          {usdFormatter.format(Number(value) || 0)}
        </span>
      )
    },
    {
      Header: 'Reported ALP',
      accessor: 'reportedAlp',
      Cell: ({ value }) => (
        <span className="gross-amount">
          {usdFormatter.format(Number(value) || 0)}
        </span>
      )
    },
    {
      Header: 'Latest Report',
      accessor: 'latestReportDate',
      Cell: ({ value }) => value || 'No reports'
    },
    {
      Header: 'SA',
      accessor: 'sa',
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'GA',
      accessor: 'ga',
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'MGA',
      accessor: 'mga',
      Cell: ({ value }) => value || '-'
    }
  ], [usdFormatter]);

  // KPI cards data
  const { totalCount, hitCount, withinReachCount, hitPct, reachPct, activePctOfPotential } = useMemo(() => {
    const total = potentialVIPs.length; // active (Active = 'y')

    const now = new Date();
    const [selYearStr, selMonthStr] = selectedMonth.split('-');
    const selYear = parseInt(selYearStr, 10);
    const selMonthIndex = parseInt(selMonthStr, 10) - 1;
    const isCurrentMonth = now.getFullYear() === selYear && now.getMonth() === selMonthIndex;

    let targetSoFar;
    if (isCurrentMonth) {
      const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      targetSoFar = (threshold * dayOfMonth) / totalDays;
    } else {
      targetSoFar = Number.POSITIVE_INFINITY;
    }

    let hit = 0;
    let reach = 0;

    potentialVIPs.forEach(r => {
      const gross = typeof r.totalLvl1Gross === 'number' ? r.totalLvl1Gross : parseFloat(r.totalLvl1Gross || 0);
      if (gross >= threshold) {
        hit += 1;
      } else {
        if (isCurrentMonth) {
          if (gross >= targetSoFar) reach += 1;
        } else {
          if (gross >= 4000 && gross < 5000) reach += 1;
        }
      }
    });

    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
    const activePct = totalPotentialCount > 0 ? Math.round((total / totalPotentialCount) * 100) : 0;

    return { 
      totalCount: total, 
      hitCount: hit, 
      withinReachCount: reach,
      hitPct: pct(hit),
      reachPct: pct(reach),
      activePctOfPotential: activePct
    };
  }, [potentialVIPs, selectedMonth, totalPotentialCount]);

  // Month navigation controls for ActionBar (dropdown with arrows)
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

  // Apply search and dropdown filters
  const filteredData = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim();
    const f = filters || {};
    const isYes = (val) => (String(val).toLowerCase() === 'yes');
    const isNo = (val) => (String(val).toLowerCase() === 'no');

    // Compute pace target for current month checks
    const now = new Date();
    const [selYearStr, selMonthStr] = selectedMonth.split('-');
    const selYear = parseInt(selYearStr, 10);
    const selMonthIndex = parseInt(selMonthStr, 10) - 1;
    const isCurrentMonth = now.getFullYear() === selYear && now.getMonth() === selMonthIndex;
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const targetSoFar = (threshold * dayOfMonth) / totalDays;

    return potentialVIPs.filter(row => {
      // search
      const matchesSearch = !q || (
        (row.lagnname || '').toLowerCase().includes(q) ||
        (row.sa || '').toLowerCase().includes(q) ||
        (row.ga || '').toLowerCase().includes(q) ||
        (row.mga || '').toLowerCase().includes(q) ||
        (row.rga || '').toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;

      // SA/GA/MGA filters
      if (f.sa && f.sa !== 'All' && row.sa !== f.sa) return false;
      if (f.ga && f.ga !== 'All' && row.ga !== f.ga) return false;
      if (f.mga && f.mga !== 'All' && row.mga !== f.mga) return false;

      // VIP month (1..3) matches vipEligibleMonth value
      if (f.vipMonth && f.vipMonth !== 'All') {
        const vipMonth = Number(row.vipEligibleMonth);
        if (vipMonth !== Number(f.vipMonth)) return false;
      }

      // At VIP filter
      if (f.atVip && f.atVip !== 'All') {
        const gross = Number(row.totalLvl1Gross) || 0;
        const atVip = gross >= threshold;
        if (isYes(f.atVip) && !atVip) return false;
        if (isNo(f.atVip) && atVip) return false;
      }

      // Within Reach filter
      if (f.withinReach && f.withinReach !== 'All') {
        const gross = Number(row.totalLvl1Gross) || 0;
        let withinReach = false;
        if (isCurrentMonth) {
          withinReach = gross < threshold && gross >= targetSoFar;
        } else {
          withinReach = gross >= 4000 && gross < 5000;
        }
        if (isYes(f.withinReach) && !withinReach) return false;
        if (isNo(f.withinReach) && withinReach) return false;
      }

      return true;
    });
  }, [potentialVIPs, searchQuery, filters, selectedMonth]);

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
        <span className="vips-loading-text">Loading potential VIPs{hierarchyLoading ? ' and user permissions' : ''}...</span>
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
                onClick={fetchPotentialVIPs}
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
        .vip-hit td { background-color: #d9f2d9 !important; }
        .vip-onpace td { background-color: #fff3cd !important; }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { 
          from { transform: rotate(0deg); } 
          to { transform: rotate(360deg); } 
        }
      `}</style>

      {/* KPI Cards styled like dashboard summary cards */}
      <div className="summary-cards">
        <Card 
          title="At VIP" 
          value={hitCount.toLocaleString()} 
          subText={`${hitPct}% of total`}
          donut
          percentage={hitPct}
          donutColor="#22c55e"
        />
        <Card 
          title="Within Reach" 
          value={withinReachCount.toLocaleString()} 
          subText={`${reachPct}% of total`}
          donut
          percentage={reachPct}
          donutColor="#facc15"
        />
        <Card 
          title="Potential VIPs" 
          value={totalCount.toLocaleString()} 
          subText={`${activePctOfPotential}% active`}
          donut
          percentage={activePctOfPotential}
          donutColor="#3b82f6"
        />
      </div>

      <div className="vips-content">
        <div className="vips-content-inner">
          <DataTable
            columns={columns}
            data={filteredData}
            defaultSortBy="totalLvl1Gross"
            defaultSortOrder="desc"
            rowClassNames={rowClasses}
            onRefresh={fetchPotentialVIPs}
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

export default PotentialVIPs; 