import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';
import DataTable from '../../utils/DataTable';
import Card from '../../utils/Card';
import { FiDownload, FiCheck } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import '../reports/RefReport.css';
import './PotentialVIPs.css';

const PendingUsers = ({ searchQuery = '', filters = {}, onFilterOptions }) => {
  const { user } = useAuth();
  const isAdmin = user?.Role === 'Admin'; // Any admin can see all pending users
  const [allowedIds, setAllowedIds] = useState([]); // activeusers.id list for non-admin
  const allowedIdsSet = useMemo(() => new Set(allowedIds.map(id => String(id))), [allowedIds]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [committedUsers, setCommittedUsers] = useState(new Map()); // Map of activeusers_id -> committed_at date
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPreparedForExport, setIsPreparedForExport] = useState(false);
  const [selectedRows, setSelectedRows] = useState({});

  // Load hierarchy IDs for non-admin users
  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        if (!user?.userId) return;
        if (isAdmin) {
          setAllowedIds([]); // No filtering for admins
          return;
        }
        const resp = await api.post('/auth/searchByUserId', { userId: user.userId });
        if (resp.data?.success) {
          const hierarchy = Array.isArray(resp.data.data) ? resp.data.data : [];
          const teamIds = hierarchy.map(u => u.id).filter(Boolean);
          const allIds = [user.userId, ...teamIds];
          setAllowedIds(allIds);
        } else {
          setAllowedIds([]);
        }
      } catch (e) {
        console.warn('[PendingUsers] Failed to fetch hierarchy IDs:', e);
        setAllowedIds([]);
      }
    };
    fetchHierarchy();
  }, [user?.userId, isAdmin]);

  useEffect(() => {
    // Only fetch when we have IDs for non-admin users, or anytime for admins
    if (isAdmin || allowedIds.length > 0) {
      fetchPendingUsers();
      fetchCommittedUsers();
    }
  }, [isAdmin, allowedIds]);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/admin/pending-users');
      
      if (response.data.success) {
        const raw = response.data.data || [];
        
        // Apply hierarchy filtering for non-admin users
        let mapped = raw;
        if (!isAdmin) {
          mapped = mapped.filter(r => r.id !== undefined && r.id !== null && allowedIdsSet.has(String(r.id)));
        }
        
        setPendingUsers(mapped);
        
        // Send unique SA/GA/MGA options up
        if (onFilterOptions) {
          const saSet = Array.from(new Set(mapped.map(r => r.sa).filter(Boolean))).sort();
          const gaSet = Array.from(new Set(mapped.map(r => r.ga).filter(Boolean))).sort();
          const mgaSet = Array.from(new Set(mapped.map(r => r.mga).filter(Boolean))).sort();
          onFilterOptions({ saOptions: saSet, gaOptions: gaSet, mgaOptions: mgaSet });
        }
      } else {
        setError('Failed to fetch pending users data');
      }
    } catch (err) {
      console.error('Error fetching pending users:', err);
      setError('Error loading pending users data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommittedUsers = async () => {
    try {
      console.log('[PendingUsers] 🔍 Fetching committed users...');
      const response = await api.get('/admin/pending-users/commits');
      
      if (response.data.success) {
        const commits = response.data.data || [];
        // Create a Map of activeusers_id -> committed_at date
        const commitMap = new Map(
          commits.map(c => [c.activeusers_id, new Date(c.committed_at)])
        );
        console.log('[PendingUsers] ✅ Committed users loaded:', commitMap.size);
        setCommittedUsers(commitMap);
      }
    } catch (err) {
      console.error('[PendingUsers] ❌ Error fetching committed users:', err);
      // Don't set error state, just log it - this is non-critical
    }
  };

  // Transform data for Excel export
  const transformDataForExport = (data) => {
    return data.map(item => ({
      agent_name: item.lagnname || '',
      start_date: item.esid || '',
      agent_number: item.agtnum || '',
      days_pending: item.daysPending || 0,
      sa: item.sa || '',
      ga: item.ga || '',
      mga: item.mga || '',
      rga: item.rga || ''
    }));
  };

  // Excel export function
  const handleXLSXExport = async () => {
    setIsPreparedForExport(true);
    
    try {
      console.log('📊 Starting Pending Users XLSX export...');
      
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Transform the filtered data
      const exportData = transformDataForExport(filteredData);
      
      console.log(`📊 Exporting ${exportData.length} Pending User records`);
      
      // Define headers
      const headers = [
        'Agent Name',
        'Start Date',
        'Agent Number',
        'Days Pending',
        'SA',
        'GA',
        'MGA',
        'RGA'
      ];
      
      // Create data rows
      const dataRows = exportData.map(item => [
        item.agent_name,
        item.start_date,
        item.agent_number,
        item.days_pending,
        item.sa,
        item.ga,
        item.mga,
        item.rga
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
        { wch: 12 }, // Start Date
        { wch: 15 }, // Agent Number
        { wch: 12 }, // Days Pending
        { wch: 12 }, // SA
        { wch: 12 }, // GA
        { wch: 12 }, // MGA
        { wch: 12 }  // RGA
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
      XLSX.utils.book_append_sheet(workbook, sheet, 'Pending Users');
      
      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const searchSuffix = (searchQuery || '').trim() ? '_filtered' : '';
      const filename = `Pending_Users_${timestamp}${searchSuffix}.xlsx`;
      
      // Write and download the file
      XLSX.writeFile(workbook, filename);
      
      console.log(`✅ Pending Users XLSX export completed: ${filename}`);
      
    } catch (error) {
      console.error('❌ Pending Users XLSX export failed:', error);
      window.alert('Failed to export XLSX file. Please try again.');
    } finally {
      setIsPreparedForExport(false);
    }
  };

  // Commit selected pending users
  const handleCommitUsers = async () => {
    console.log('[PendingUsers] 📊 Selected rows state (raw):', selectedRows);
    console.log('[PendingUsers] 📊 Selected rows type:', typeof selectedRows, 'isArray:', Array.isArray(selectedRows));
    
    // Handle both array and object formats
    let selectedIds;
    if (Array.isArray(selectedRows)) {
      // If it's an array, use it directly
      selectedIds = selectedRows.filter(id => id !== null && id !== undefined);
      console.log('[PendingUsers] 📊 Using array format, selectedIds:', selectedIds);
    } else if (typeof selectedRows === 'object') {
      // If it's an object, filter by truthy values
      selectedIds = Object.keys(selectedRows).filter(id => selectedRows[id]);
      console.log('[PendingUsers] 📊 Using object format, selectedIds:', selectedIds);
    } else {
      selectedIds = [];
      console.log('[PendingUsers] ⚠️ Unexpected selectedRows format');
    }
    
    if (selectedIds.length === 0) {
      alert('Please select users to commit');
      return;
    }

    if (!window.confirm(`Are you sure you want to commit ${selectedIds.length} pending user(s)?`)) {
      console.log('[PendingUsers] ❌ User cancelled commit');
      return;
    }

    const requestData = {
      userIds: selectedIds.map(id => parseInt(id, 10))
    };

    console.log('[PendingUsers] 🚀 Sending commit request:', {
      url: '/admin/pending-users/commit',
      method: 'POST',
      data: requestData,
      selectedCount: selectedIds.length
    });

    try {
      const response = await api.post('/admin/pending-users/commit', requestData);

      console.log('[PendingUsers] ✅ Commit response received:', {
        status: response.status,
        data: response.data
      });

      if (response.data.success) {
        const message = response.data.updated > 0 
          ? `Successfully committed ${response.data.committed} user(s) (${response.data.updated} re-committed with new date)`
          : `Successfully committed ${response.data.committed} user(s)`;
        alert(message);
        setSelectedRows({}); // Clear selection
        fetchPendingUsers(); // Refresh the data
        fetchCommittedUsers(); // Refresh committed status
      } else {
        console.error('[PendingUsers] ❌ Commit failed:', response.data);
        alert(`Error: ${response.data.message}`);
      }
    } catch (error) {
      console.error('[PendingUsers] ❌ Error committing pending users:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
          data: error.config?.data
        }
      });
      alert('Failed to commit pending users. Please try again.');
    }
  };

  const columns = useMemo(() => [
    {
      Header: '',
      accessor: 'select',
      massSelection: true,
      disableSortBy: true,
      width: 50
    },
    {
      Header: 'Agent Name',
      accessor: 'lagnname',
      filterType: 'text', // Enable text search filter
      Cell: ({ value }) => (
        <span className="agent-name">{value}</span>
      )
    },
    {
      Header: 'Start Date',
      accessor: 'esid',
      filterType: 'text', // Enable text search filter
      Cell: ({ value }) => {
        if (!value) return '-';
        return String(value);
      }
    },
    {
      Header: 'Agent Number',
      accessor: 'agtnum',
      filterType: 'text', // Enable text search filter
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'Days Pending',
      accessor: 'daysPending',
      filterType: 'text', // Enable text search filter for number ranges
      Cell: ({ value }) => (
        <span className={`days-pending ${value > 90 ? 'overdue' : value > 60 ? 'warning' : ''}`}>
          {value || 0} days
        </span>
      )
    },
    {
      Header: 'SA',
      accessor: 'sa',
      filterType: 'select', // Dropdown with unique values
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'GA',
      accessor: 'ga',
      filterType: 'select', // Dropdown with unique values
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'MGA',
      accessor: 'mga',
      filterType: 'select', // Dropdown with unique values
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'RGA',
      accessor: 'rga',
      filterType: 'select', // Dropdown with unique values
      Cell: ({ value }) => value || '-'
    }
  ], []);

  // KPI cards data
  const { totalCount, within7Count, midCount, warningCount, within7Pct, midPct, warningPct } = useMemo(() => {
    const total = pendingUsers.length;
    const within7 = pendingUsers.filter(u => u.daysPending <= 7).length;
    const mid = pendingUsers.filter(u => u.daysPending >= 8 && u.daysPending <= 45).length;
    const warning = pendingUsers.filter(u => u.daysPending >= 46 && u.daysPending <= 60).length;
    
    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
    
    return { 
      totalCount: total, 
      within7Count: within7,
      midCount: mid,
      warningCount: warning,
      within7Pct: pct(within7),
      midPct: pct(mid),
      warningPct: pct(warning)
    };
  }, [pendingUsers]);

  // Apply search and dropdown filters
  const filteredData = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim();
    const f = filters || {};

    const totalBeforeFilter = pendingUsers.length;
    const filtered = pendingUsers
      .filter(row => {
        // search
        const matchesSearch = !q || (
          (row.lagnname || '').toLowerCase().includes(q) ||
          (row.agtnum || '').toLowerCase().includes(q) ||
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

        // Days pending filter: only show if 60 days or less
        const daysPending = parseInt(row.daysPending) || 0;
        if (daysPending > 60) {
          console.log(`[PendingUsers] ⏭️ Filtered out ${row.lagnname} - ${daysPending} days pending (>60)`);
          return false;
        }

        return true;
      })
      .map(row => {
        // Determine row color based on commit status
        let rowColor = undefined;
        
        if (row.id && committedUsers.has(row.id)) {
          const committedDate = committedUsers.get(row.id);
          const now = new Date();
          
          // Calculate days since commit
          const daysSinceCommit = Math.floor((now - committedDate) / (1000 * 60 * 60 * 24));
          
          if (daysSinceCommit > 7) {
            // More than 7 days since commit and still pending → Light red
            rowColor = '#FED7D7'; // Light red
            console.log(`[PendingUsers] 🔴 ${row.lagnname} committed ${daysSinceCommit} days ago - still pending (red)`);
          } else {
            // Within 7 days of commit → Light orange
            rowColor = '#FFE5CC'; // Light orange
            console.log(`[PendingUsers] 🟧 ${row.lagnname} committed ${daysSinceCommit} days ago (orange)`);
          }
        }
        
        return {
          ...row,
          rowcolor: rowColor
        };
      });

    const totalAfterFilter = filtered.length;
    const filteredOutCount = totalBeforeFilter - totalAfterFilter;
    
    if (filteredOutCount > 0) {
      console.log(`[PendingUsers] 📊 60-day filter: Showing ${totalAfterFilter} of ${totalBeforeFilter} users (${filteredOutCount} filtered out)`);
    }

    return filtered;
  }, [pendingUsers, searchQuery, filters, committedUsers]);

  const selectedCount = Array.isArray(selectedRows) 
    ? selectedRows.filter(id => id !== null && id !== undefined).length
    : Object.keys(selectedRows).filter(id => selectedRows[id]).length;

  const actionBarExtras = useMemo(() => (
    <>
      {selectedCount > 0 && (
        <button 
          onClick={handleCommitUsers}
          className="action-button"
          title={`Commit ${selectedCount} selected user(s)`}
          aria-label="Commit Selected Users"
          style={{
            backgroundColor: '#4CAF50',
            color: 'white',
            marginRight: '8px'
          }}
        >
          <FiCheck />
          <span style={{ marginLeft: '6px' }}>Commit ({selectedCount})</span>
        </button>
      )}
      <button 
        onClick={handleXLSXExport}
        className="action-button"
        title={`Export to Excel${(searchQuery || '').trim() ? ' (filtered)' : ''}`}
        disabled={isPreparedForExport || filteredData.length === 0}
        aria-label="Export to Excel"
      >
        <FiDownload className={isPreparedForExport ? 'spinning' : ''} />
      </button>
    </>
  ), [selectedCount, isPreparedForExport, filteredData.length, searchQuery, handleCommitUsers, handleXLSXExport]);

  if (loading) {
    return (
      <div className="vips-loading">
        <div className="vips-loading-spinner"></div>
        <span className="vips-loading-text">Loading pending users...</span>
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
                onClick={fetchPendingUsers}
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
        .days-pending.overdue { color: #dc2626; font-weight: 600; }
        .days-pending.warning { color: #d97706; font-weight: 500; }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { 
          from { transform: rotate(0deg); } 
          to { transform: rotate(360deg); } 
        }
      `}</style>

      {/* KPI Cards styled like dashboard summary cards */}
      <div className="summary-cards">
        <Card 
          title="Within 7 days" 
          value={within7Count.toLocaleString()} 
          subText={`${within7Pct}% of total`}
          donut
          percentage={within7Pct}
          donutColor="#22c55e"
        />
        <Card 
          title="Within 8-45 days" 
          value={midCount.toLocaleString()} 
          subText={`${midPct}% of total`}
          donut
          percentage={midPct}
          donutColor="#3b82f6"
        />
        <Card 
          title="Warning (46-60 days)" 
          value={warningCount.toLocaleString()} 
          subText={`${warningPct}% of total`}
          donut
          percentage={warningPct}
          donutColor="#d97706"
        />
      </div>

      <div className="vips-content">
        <div className="vips-content-inner">
          <DataTable
            columns={columns}
            data={filteredData}
            defaultSortBy="daysPending"
            defaultSortOrder="asc"
            onRefresh={fetchPendingUsers}
            enableColumnFilters={true}
            tableId="pending-users-table"
            enableRowColoring={true}
            rowColorColumn="rowcolor"
            onColumnFilterChange={(filters) => {
              console.log('Column filters changed:', filters);
            }}
            onSelectionChange={(selection) => {
              console.log('[PendingUsers] 🔄 onSelectionChange called:', {
                selection,
                type: typeof selection,
                isArray: Array.isArray(selection),
                keys: Object.keys(selection),
                values: Object.values(selection)
              });
              setSelectedRows(selection);
            }}
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

export default PendingUsers;
