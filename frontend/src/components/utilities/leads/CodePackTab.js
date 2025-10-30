import React, { useEffect, useMemo, useState, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../utils/DataTable';
import FilterMenu from '../../common/FilterMenu';
import AddLicenseModal from '../AddLicenseModal';
import ContextMenu from '../../utils/ContextMenu';
import api from '../../../api';
import { toast } from 'react-hot-toast';
import { uploadImageToImgur } from '../../../utils/imgurUploader';
import { AuthContext } from '../../../context/AuthContext';
import { useUserHierarchy } from '../../../hooks/useUserHierarchy';
 

const CodePackTab = () => {
  const { user } = useContext(AuthContext);
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [licensedStates, setLicensedStates] = useState([]);
  const [licensesLoaded, setLicensesLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  
  // Helper function to create proper database timestamps
  // The database expects timestamps in MySQL format: 'YYYY-MM-DD HH:MM:SS' in Eastern Time
  const formatTimestamp = useCallback(() => {
    const now = new Date();
    // Convert to Eastern Time and format for database storage
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const easternTimestamp = easternTime.toISOString().slice(0, 19).replace('T', ' ');
    return easternTimestamp;
  }, []);
  
  // Tab filter: 'all' | 'sent' | 'notSent' | 'requested'
  const [statusTab, setStatusTab] = useState('notSent');
  // Tri-state filters: 'neutral' | 'need' | 'has' (for license/upload), and 'neutral' | '0' | '1' for pending
  const [activeFilters, setActiveFilters] = useState({
    licenseFilter: 'neutral',
    timeFilter: '30', // Default to 30 days, options: '7', '30', '60', '90', '180', 'all'
    deniedFilter: 'hide' // 'show' | 'hide' | 'only' - default to hiding denied entries
  });

  // Sort state preservation
  const [currentSort, setCurrentSort] = useState({ 
    sortBy: 'esid', 
    sortOrder: 'desc' 
  });

  // Handle sort changes from DataTable
  const handleSortChange = useCallback((sortState) => {
    setCurrentSort(sortState);
  }, []);

  const [leadsReleased, setLeadsReleased] = useState([]);
  
  // Add License Modal state
  const [showAddLicenseModal, setShowAddLicenseModal] = useState(false);
  const [selectedUserForLicense, setSelectedUserForLicense] = useState(null);
  
  // Force re-render state for table updates
  const [tableUpdateKey, setTableUpdateKey] = useState(0);
  
  // Cell editing state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editedRows, setEditedRows] = useState({});

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);

  // Check if user can mark packs as sent
  const canMarkSent = useMemo(() => {
    if (!user) return false;
    const teamRole = user.teamRole || '';
    const role = user.Role || '';
    const clname = user.clname || '';
    
    return teamRole === 'app' || role === 'Admin' || clname === 'SGA';
  }, [user]);

  // Check if user has elevated permissions (can see all data)
  const hasElevatedPermissions = useMemo(() => {
    if (!user) return false;
    const teamRole = user.teamRole || '';
    const role = user.Role || '';
    const clname = user.clname || '';
    
    return teamRole === 'app' || role === 'Admin' || clname === 'SGA';
  }, [user]);

  // Check if user is an AGT (agent) who can only see themselves
  const isAgtUser = useMemo(() => {
    if (!user) return false;
    const clname = user.clname || '';
    return clname === 'AGT';
  }, [user]);

  // Get allowed IDs from cached hierarchy data
  const allowedIds = useMemo(() => {
    if (hasElevatedPermissions) return []; // Elevated users see all data
    if (isAgtUser) return [user?.userId || user?.id].filter(Boolean); // AGT users only see themselves
    return getHierarchyForComponent('ids');
  }, [hasElevatedPermissions, isAgtUser, getHierarchyForComponent, user?.userId, user?.id]);
  
  const allowedIdsSet = useMemo(() => new Set(allowedIds.map(id => String(id))), [allowedIds]);

  const fetchEligible = useCallback(async () => {
    setLoading(true);
    try {
      // Get eligible users from activeusers
      const activeUsersRes = await api.get('/release/first-pack/eligible');
      const activeUsersData = activeUsersRes.data?.data || [];
      
      // Get leads_released data
      const leadsRes = await api.get('/release/leads-released');
      const leadsData = leadsRes.data?.data || [];
      setLeadsReleased(leadsData);

      // Combine the data
      const combinedData = activeUsersData.map(user => {
        // Find corresponding lead entry
        const leadEntry = leadsData.find(lead => 
          lead.userId == user.id && 
          (lead.type === '1st Pack' || lead.type === 'First Pack')
        );

        return {
          ...user,
          // Surface common lead fields for easy column access
          notes: leadEntry?.notes || '',
          reasoning: leadEntry?.reasoning || '',
          leadEntry,
          // Add row color from leads_released table
          rowcolor: leadEntry?.rowcolor || null
        };
      });

      // Include additional SENT rows from leads_released even if not in activeusers
      const activeUserIds = new Set(activeUsersData.map(u => String(u.id)));
      const extraSentRows = leadsData
        .filter(lead => (lead.type === '1st Pack' || lead.type === 'First Pack') && lead.sent == 1)
        .filter(lead => !activeUserIds.has(String(lead.userId)))
        .map(lead => ({
          id: lead.userId,
          lagnname: lead.lagnname || lead.name || '',
          // Prefer activeusers join fields when available
          mga: (lead.au_mga ?? lead.mga) || '',
          esid: (lead.au_esid ?? lead.esid) || '',
          lr_type: lead.type,
          lr_sent: lead.sent,
          created_at: lead.created_at || lead.createdAt,
          Active: (lead.au_Active ?? lead.Active),
          released: (lead.au_released ?? lead.released),
          pending: (lead.au_pending ?? lead.pending),
          licensed_states: lead.licensed_states,
          notes: lead.notes || '',
          reasoning: lead.reasoning || '',
          leadEntry: lead,
          // Add row color from leads_released table
          rowcolor: lead.rowcolor || null
        }));

      const allCombined = [...combinedData, ...extraSentRows];

      // Apply hierarchy filtering for non-elevated users
      let filteredData = allCombined;
      if (!hasElevatedPermissions) {
        filteredData = allCombined.filter(r => 
          r.id !== undefined && 
          r.id !== null && 
          allowedIdsSet.has(String(r.id))
        );
      }

      setRows(filteredData);
    } catch (err) {
      console.error('Failed to load eligible users:', err);
      toast.error('Failed to load eligible users');
    } finally {
      setLoading(false);
    }
  }, [hasElevatedPermissions, isAgtUser, allowedIdsSet]);

  useEffect(() => {
    // Only fetch when we have hierarchy data for non-elevated users, or anytime for elevated/AGT users
    if (hasElevatedPermissions || isAgtUser || (hierarchyData && allowedIds.length > 0)) {
      fetchEligible();
    }
  }, [fetchEligible, hasElevatedPermissions, isAgtUser, hierarchyData, allowedIds]);

  const loadLicensedStates = useCallback(async () => {
    try {
      const response = await api.get('/licenses');
      const data = response.data;
      if (data.success) {
        const licenses = data.licenses || [];
        setLicensedStates(licenses);
      }
    } catch (error) {
      console.error('❌ Error loading licensed states:', error);
    } finally {
      setLicensesLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadLicensedStates();
  }, [loadLicensedStates]);

  const convertMDYToYMD = (dateStr) => {
    if (!dateStr) return '';
    const parts = String(dateStr).split('/');
    if (parts.length < 3) return '';
    const [month, day, year] = parts;
    return `${year.padStart(2, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handleRequest = async (userId, lagnname) => {
    const tId = toast.loading('Submitting request...');
    try {
      await api.post('/release/first-pack/request', { userId, lagnname });
      toast.success(`Requested First Pack for ${lagnname}`, { id: tId });
      fetchEligible();
    } catch (err) {
      console.error('Request failed:', err);
      const message = err.response?.data?.message || 'Request failed';
      toast.error(message, { id: tId });
    }
  };

  const handleMarkSent = async (row) => {
    const { leadEntry } = row.original;
    if (!leadEntry?.id) return;
    const tId = toast.loading('Marking pack as sent...');
    try {
      // Format timestamps consistently using America/New_York timezone
      const nowFormatted = formatTimestamp();
      
      await api.put(`/release/leads-released/${leadEntry.id}`, { 
        sent: 1, 
        sent_date: nowFormatted, 
        last_updated: nowFormatted 
      });
      toast.success('Pack marked as sent', { id: tId });
      fetchEligible();
    } catch (e) {
      console.error('Failed to mark sent:', e);
      toast.error('Failed to mark sent', { id: tId });
    }
  };

  const handleUploadImg = async (userId) => {
    try {
      // Create hidden file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const tId = toast.loading('Uploading image...');
        const res = await uploadImageToImgur(file);
        if (!res.success) {
          toast.error(res.message || 'Upload failed', { id: tId });
          return;
        }
        const url = res.data?.url;
        if (!url) {
          toast.error('No URL returned from upload', { id: tId });
          return;
        }
        // Ensure leads_released row exists; update/create img
        try {
          // Format timestamp consistently
          const nowFormatted = formatTimestamp();
          
          // Try to find existing record for this user
          const leads = await api.get('/release/leads-released');
          const existing = (leads.data?.data || []).find(l => String(l.userId) === String(userId));
          if (existing) {
            await api.put(`/release/leads-released/${existing.id}`, { img: url, last_updated: nowFormatted });
            applyRowUpdate(userId, { img: url, lr_img: url });
          } else {
            const createRes = await api.post('/release/leads-released', { userId, lagnname: rowCacheById[userId]?.lagnname || '', type: '1st Pack', img: url, sent: 0 });
            // Fallback: if backend didn't persist img in create, ensure it via PUT
            const created = createRes.data?.data;
            if (created && !created.img && created.id) {
              await api.put(`/release/leads-released/${created.id}`, { img: url, last_updated: nowFormatted });
            }
            applyRowUpdate(userId, { img: url, lr_img: url, leadEntry: { id: created?.id } });
          }
          toast.success('Image saved', { id: tId });
          // Keep UI snappy without full refresh; still refresh in background
          fetchEligible();
        } catch (e) {
          console.error('Failed to save image url:', e);
          toast.error('Failed to save image url', { id: tId });
        }
      };
      input.click();
    } catch (e) {
      // ignore
    }
  };

  const handleOpenAddLicense = (userId, lagnname) => {
    setSelectedUserForLicense({ userId, lagnname });
    setShowAddLicenseModal(true);
  };

  const handleCloseAddLicense = () => {
    setShowAddLicenseModal(false);
    setSelectedUserForLicense(null);
  };

  const applyRowUpdate = useCallback((userId, patch) => {
    setRows(prev => prev.map(r => {
      if (String(r.id) !== String(userId)) return r;
      const next = { ...r, ...patch };
      if (r.leadEntry) {
        next.leadEntry = { ...r.leadEntry, ...patch };
      }
      return next;
    }));
    // Force table re-render
    setTableUpdateKey(prev => prev + 1);
  }, []);

  const handleLicenseAdded = (newLicense) => {
    // Optimistically update table and local licensedStates
    if (newLicense?.userId) {
      setLicensedStates(prev => ([...prev, {
        userId: newLicense.userId,
        state: newLicense.state,
        expiry_date: newLicense.expiry_date || null
      }]));

      // Ensure the row immediately reflects the newly added state so the
      // "States Licensed" column and "Action" button update without refresh.
      const targetRow = rowCacheById[String(newLicense.userId)] || rowCacheById[newLicense.userId];
      const currentStates = ((targetRow?.licensed_states) || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const shouldAdd = newLicense.state && !currentStates.includes(newLicense.state);
      const nextStates = shouldAdd ? [...currentStates, newLicense.state] : currentStates;
      applyRowUpdate(newLicense.userId, { licensed_states: nextStates.join(', ') });
    }

    // Close modal after success (UX) and refresh licenses in background.
    // Avoid immediately refetching rows so the optimistic update isn't overwritten.
    handleCloseAddLicense();
    loadLicensedStates();
    toast.success('License added successfully!');
  };

  // Cell editing handlers
  const handleCellEdit = (id, field, value) => {
    const row = rows.find(r => String(r.id) === String(id));
    if (!row) return;
    
    // For notes, only allow editing if the row has a leadEntry (can edit)
    if (field === 'notes') {
      const leadId = row.leadEntry?.id;
      if (!leadId) return; // Can't edit without a leadEntry
    }
    
    // For reasoning, only allow editing if user has elevated permissions and row has leadEntry
    if (field === 'reasoning') {
      const leadId = row.leadEntry?.id;
      if (!hasElevatedPermissions || !leadId) return; // Can't edit without permissions and leadEntry
    }
    
    setEditedRows(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = async () => {
    const tId = toast.loading('Saving changes...');
    try {
      const promises = Object.entries(editedRows).map(async ([userId, changes]) => {
        const row = rows.find(r => String(r.id) === String(userId));
        const leadId = row?.leadEntry?.id;
        if (leadId) {
          // Format timestamp consistently
          const nowFormatted = formatTimestamp();
          
          // Prepare update payload for any changed fields
          const updatePayload = {
            last_updated: nowFormatted
          };
          
          if (changes.notes !== undefined) {
            updatePayload.notes = changes.notes;
          }
          
          if (changes.reasoning !== undefined) {
            updatePayload.reasoning = changes.reasoning;
          }
          
          // Only make API call if there are actual changes
          if (Object.keys(updatePayload).length > 1) { // More than just last_updated
            await api.put(`/release/leads-released/${leadId}`, updatePayload);
            applyRowUpdate(userId, changes);
          }
        }
      });
      
      await Promise.all(promises);
      setEditedRows({});
      setHasUnsavedChanges(false);
      toast.success('Changes saved successfully', { id: tId });
      fetchEligible();
    } catch (e) {
      console.error('Failed to save changes:', e);
      toast.error('Failed to save changes', { id: tId });
    }
  };

  const handleCancelChanges = () => {
    setEditedRows({});
    setHasUnsavedChanges(false);
    setTableUpdateKey(prev => prev + 1); // Force table re-render to reset values
  };


  // Color options for row highlighting
  const colorOptions = [
    { name: 'Red', color: '#dc3545' },
    { name: 'Orange', color: '#fd7e14' },
    { name: 'Yellow', color: '#ffc107' },
    { name: 'Green', color: '#28a745' },
    { name: 'Blue', color: '#007bff' },
    { name: 'Purple', color: '#6f42c1' },
    { name: 'Pink', color: '#e83e8c' },
    { name: 'Clear', color: null }
  ];

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle row color update
  const handleRowColorUpdate = useCallback(async (row, color) => {
    const leadId = row.leadEntry?.id;
    if (!leadId) {
      toast.error('No lead entry found for this user');
      return;
    }

    const tId = toast.loading('Updating row color...');
    try {
      const nowFormatted = formatTimestamp();
      await api.put(`/release/leads-released/${leadId}`, { 
        rowcolor: color,
        last_updated: nowFormatted 
      });
      
      const colorName = colorOptions.find(opt => opt.color === color)?.name || 'default';
      toast.success(`Row highlighted with ${colorName} color`, { id: tId });
      
      // Refresh data to show the change
      fetchEligible();
    } catch (error) {
      console.error('Failed to update row color:', error);
      toast.error('Failed to update row color', { id: tId });
    }
  }, [formatTimestamp, colorOptions, fetchEligible]);

  // Handle right-click on table rows
  const handleRowRightClick = useCallback((event, row) => {
    event.preventDefault();
    
    if (!hasElevatedPermissions) {
      return; // No context menu for non-elevated users
    }

    if (!row.leadEntry?.id) {
      // Show informative context menu for rows without lead entries
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        options: [
          {
            label: (
              <div style={{ color: '#6c757d', fontStyle: 'italic' }}>
                Cannot highlight - no lead pack requested
              </div>
            ),
            disabled: true
          }
        ]
      });
      return;
    }

    const currentColor = row.rowcolor;
    
    const menuConfig = {
      x: event.clientX,
      y: event.clientY,
      options: [
        {
          label: 'Highlight Row',
          submenu: colorOptions.map(option => ({
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: option.color || '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '2px'
                  }}
                />
                <span>{option.name}</span>
                {currentColor === option.color && <span style={{ color: '#28a745' }}>✓</span>}
              </div>
            ),
            onClick: () => {
              handleRowColorUpdate(row, option.color);
              handleCloseContextMenu();
            }
          }))
        }
      ]
    };
    
    setContextMenu(menuConfig);
  }, [hasElevatedPermissions, colorOptions, handleRowColorUpdate, handleCloseContextMenu]);

  

  const columns = useMemo(() => [
    { 
      Header: 'Agent Name', 
      accessor: 'lagnname',
      Cell: ({ row }) => {
        const name = row.original.lagnname || '';
        const isPending = row.original.pending == 1;
        return isPending ? `* ${name}` : name;
      }
    },
    { Header: 'Active Date', accessor: 'esid' },
    { Header: 'MGA', accessor: 'mga' },
    {
      Header: 'Notes',
      accessor: 'notes',
      Cell: ({ row, value, isEditing, updateCell }) => {
        // Value comes from accessor, but ensure we fallback to row.original.notes or leadEntry.notes
        const notesVal = (typeof value === 'string' && value !== undefined ? value : (row.original.notes ?? row.original.leadEntry?.notes ?? '')) || '';
        const leadId = row.original.leadEntry?.id;
        const canEdit = !!leadId;
        
        if (!canEdit) {
          return <span style={{ color: '#999' }}>—</span>;
        }
        
        // If cell is being edited, render input field
        if (isEditing) {
          return (
            <input
              type="text"
              value={notesVal}
              onChange={(e) => updateCell(row.original.id, 'notes', e.target.value)}
              style={{ 
                width: '100%', 
                border: 'none', 
                outline: 'none', 
                background: 'transparent',
                maxWidth: 220 
              }}
              autoFocus
            />
          );
        }
        
        return (
          <span 
            title={notesVal} 
            style={{ 
              maxWidth: 220, 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              cursor: 'pointer'
            }}
          >
            {notesVal || '—'}
          </span>
        );
      },
      editable: true
    },
    {
      Header: 'States Licensed',
      accessor: 'statesLicensed',
      Cell: ({ row }) => {
        const userId = row.original.id;
        const precomputed = row.original.licensed_states;
        if (precomputed && typeof precomputed === 'string' && precomputed.trim().length > 0) {
          return precomputed;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const states = licensedStates
          .filter(ls => ls.userId == userId && ls.expiry_date)
          .filter(ls => {
            const ymd = convertMDYToYMD(ls.expiry_date);
            const d = new Date(ymd);
            return !isNaN(d.getTime()) && d > today;
          })
          .map(ls => ls.state)
          .filter(Boolean);
        return states.length ? states.join(', ') : 'N/A';
      }
    },
    { 
      Header: 'Requested', 
      accessor: 'created_at',
      Cell: ({ row }) => {
        const { created_at, lr_type, lr_sent } = row.original;
        if (created_at && (lr_type === '1st Pack' || lr_type === 'First Pack') && (lr_sent == 0)) {
          return new Date(created_at).toLocaleString();
        }
        return '—';
      }
    },
    {
      Header: 'Sent', 
      accessor: 'sent_date',
      Cell: ({ row }) => {
        const leadEntry = row.original.leadEntry;
        const sentDate = leadEntry?.sent_date;
        const isSent = leadEntry?.sent == 1;
        
        if (isSent && sentDate) {
          // Database stores sent_date as m/d/yy hh:mm format
          // Return as-is since it's already in a readable format
          return sentDate;
        }
        return '—';
      }
    },
    {
      Header: 'Reasoning',
      accessor: 'reasoning',
      Cell: ({ row, value, isEditing, updateCell }) => {
        const reasoningVal = (typeof value === 'string' && value !== undefined ? value : (row.original.reasoning ?? row.original.leadEntry?.reasoning ?? '')) || '';
        const leadId = row.original.leadEntry?.id;
        const canEdit = hasElevatedPermissions && !!leadId;
        
        const reasoningOptions = [
          { value: '', label: 'Select...' },
          { value: 'Needs Impact', label: 'Needs Impact' },
          { value: 'Denied - Duplicate', label: 'Denied - Duplicate' },
          { value: 'Licensed States/No Lead Availability', label: 'Licensed States/No Lead Availability' },
          { value: 'Denied - Timed out', label: 'Denied - Timed out' }
        ];
        
        if (!canEdit) {
          return <span style={{ color: '#999' }}>{reasoningVal || '—'}</span>;
        }
        
        // If cell is being edited, render dropdown
        if (isEditing) {
          return (
            <select
              value={reasoningVal}
              onChange={(e) => updateCell(row.original.id, 'reasoning', e.target.value)}
              style={{ 
                width: '100%', 
                border: 'none', 
                outline: 'none', 
                background: 'transparent',
                minWidth: '150px'
              }}
              autoFocus
            >
              {reasoningOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );
        }
        
        return (
          <span 
            title={reasoningVal} 
            style={{ 
              minWidth: '150px', 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              cursor: 'pointer',
              display: 'inline-block'
            }}
          >
            {reasoningVal || '—'}
          </span>
        );
      },
      editable: hasElevatedPermissions
    },
    {
      Header: 'Pending Date',
      accessor: 'PendingDate',
      Cell: ({ value }) => {
        if (!value) return '—';
        // Format the date for display
        try {
          const date = new Date(value);
          return date.toLocaleDateString();
        } catch (e) {
          return value;
        }
      }
    },
    {
      Header: 'Days to Code',
      accessor: 'days_to_code',
      Cell: ({ value }) => {
        if (value === null || value === undefined) return '—';
        
        const days = parseInt(value);
        let color = '#000'; // default black
        let backgroundColor = 'transparent';
        
        if (days >= 0 && days <= 7) {
          // Green for 0-7 days (good)
          color = '#155724';
          backgroundColor = '#d4edda';
        } else if (days > 7 && days <= 14) {
          // Yellow for 8-14 days (caution)
          color = '#856404';
          backgroundColor = '#fff3cd';
        } else if (days > 14) {
          // Red for >14 days (concerning)
          color = '#721c24';
          backgroundColor = '#f8d7da';
        }
        
        return (
          <span style={{ 
            color, 
            backgroundColor, 
            padding: '2px 6px', 
            borderRadius: '4px',
            fontWeight: '500'
          }}>
            {days}
          </span>
        );
      }
    },
    
    {
      Header: 'Action',
      accessor: 'action',
      id: 'action',
      Cell: ({ row }) => {
        const { id, lagnname, created_at, lr_type, lr_sent, pending, licensed_states } = row.original;
        const imageUrl = row.original.lr_img || row.original.img || (row.original.leadEntry && row.original.leadEntry.img) || '';
        if (created_at && (lr_type === '1st Pack' || lr_type === 'First Pack') && (lr_sent == 0)) {
          // Check if user can mark as sent
          if (canMarkSent) {
            return (
              <button
                className="btn-primary"
                onClick={async () => {
                  await handleMarkSent(row);
                  // Optimistic update
                  const uid = row.original.id;
                  applyRowUpdate(uid, { lr_sent: 1 });
                }}
                style={{ padding: '6px 10px' }}
                title="Mark as Sent"
              >
                Mark Sent
              </button>
            );
          } else {
            // User cannot mark as sent, just show "Requested"
            return <span style={{ color: '#6c757d' }}>Requested</span>;
          }
        }

        if (lr_type === '1st Pack' || lr_type === 'First Pack') {
          if (lr_sent == 1) {
            return <span style={{ color: '#28a745' }}>Pack Sent</span>;
          }
        }

        // Determine if user has any valid (or precomputed) licenses
        let hasValidLicense = false;
        const precomputedLicensedStates = licensed_states;
        if (precomputedLicensedStates && String(precomputedLicensedStates).trim().length > 0) {
          hasValidLicense = true;
        } else if (licensesLoaded) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const valid = licensedStates.some(ls => {
            if (ls.userId != id || !ls.expiry_date) return false;
            const ymd = convertMDYToYMD(ls.expiry_date);
            const d = new Date(ymd);
            return !isNaN(d.getTime()) && d > today;
          });
          hasValidLicense = valid;
        }

        // Step 1: Need license first
        if (!hasValidLicense && licensesLoaded) {
          return (
            <button
              className="btn-primary"
              onClick={() => handleOpenAddLicense(id, lagnname)}
              style={{ padding: '6px 10px' }}
              title="Add License"
            >
              Add License
            </button>
          );
        }

        // Step 2/3: If pending == 1, must upload image before Request; if pending == 0, can Request directly
        if (String(pending) === '1') {
          if (!imageUrl) {
            return (
              <button
                className="btn-primary"
                onClick={() => handleUploadImg(id)}
                style={{ padding: '6px 10px' }}
                title="Upload Image"
              >
                Upload Image
              </button>
            );
          }
          // Has image → Request
          return (
            <button 
              className="btn-primary"
              onClick={() => handleRequest(id, lagnname)}
              style={{ padding: '6px 10px' }}
            >
              Request
            </button>
          );
        }

        // pending == 0 and has license → Request directly (no upload needed)
        if (String(pending) === '0') {
          return (
            <button 
              className="btn-primary"
              onClick={() => handleRequest(id, lagnname)}
              style={{ padding: '6px 10px' }}
            >
              Request
            </button>
          );
        }

        // Fallback for other pending values
        return (
          <button 
            className="btn-primary"
            onClick={() => handleRequest(id, lagnname)}
            style={{ padding: '6px 10px' }}
          >
            Request
          </button>
        );
      }
    }
  ], [licensesLoaded, licensedStates, rows, tableUpdateKey, canMarkSent, editedRows, hasElevatedPermissions]);

  // Build a quick id -> row map for use in handlers
  const rowCacheById = useMemo(() => {
    const map = {};
    rows.forEach(r => { map[r.id] = r; });
    return map;
  }, [rows]);

  const filteredRows = useMemo(() => {
    let filtered = [...rows];
    // Always exclude pending = 1
    filtered = filtered.filter(r => String(r.pending) !== '1');
    
    // Apply search filter
    const term = searchQuery.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter(r => {
        const name = (r.lagnname || '').toLowerCase();
        const mga = (r.mga || '').toLowerCase();
        const esid = (r.esid || '').toLowerCase();
        return name.includes(term) || mga.includes(term) || esid.includes(term);
      });
    }

    // Apply active filters
    if (statusTab === 'sent') {
      filtered = filtered.filter(r => {
        // Check if user has a lead entry that is sent
        return r.leadEntry && r.leadEntry.sent == 1;
      });
    }

    if (statusTab === 'requested') {
      filtered = filtered.filter(r => {
        // Check if user has requested a pack but it hasn't been sent yet
        return r.leadEntry && r.leadEntry.sent == 0;
      });
    }

    if (statusTab === 'notSent') {
      filtered = filtered.filter(r => {
        const respectsActive = (typeof r.Active === 'undefined') ? true : r.Active === 'y';
        const respectsReleased = (typeof r.released === 'undefined') ? true : r.released == 0;
        const isPending = (typeof r.pending === 'undefined') ? true : (r.pending == 0 || r.pending == 1);

        // Not Sent definition:
        // - No leads_released entry for 1st Pack OR
        // - Has 1st Pack entry with sent == 0
        const hasFirstPackLead = !!r.leadEntry;
        const qualifiesNotSent = !hasFirstPackLead || (r.leadEntry && r.leadEntry.sent == 0);

        // Apply time restriction for notSent based on selected filter
        // Non-elevated users always get 30-day restriction, elevated users can control it
        let withinTimeWindow = true;
        if (r.esid) {
          const timeAgo = new Date();
          let days = hasElevatedPermissions ? 
            (activeFilters.timeFilter === 'all' ? null : parseInt(activeFilters.timeFilter)) : 
            30; // Non-elevated users always get 30-day filter
            
          if (days !== null) {
            timeAgo.setDate(timeAgo.getDate() - days);
            withinTimeWindow = new Date(r.esid) >= timeAgo;
          }
        }

        return respectsActive && respectsReleased && isPending && qualifiesNotSent && withinTimeWindow;
      });
      
      const effectiveTimeFilter = hasElevatedPermissions ? activeFilters.timeFilter : '30';
      console.log(`Not sent filtered results (${effectiveTimeFilter}d window):`, filtered.length);
    }

    // License tri-state filter
    if (activeFilters.licenseFilter !== 'neutral') {
      filtered = filtered.filter(r => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const validLicenses = licensedStates
          .filter(ls => ls.userId == r.id && ls.expiry_date)
          .filter(ls => {
            const ymd = convertMDYToYMD(ls.expiry_date);
            const d = new Date(ymd);
            return !isNaN(d.getTime()) && d > today;
          });
        const hasAnyValid = validLicenses.length > 0;
        return activeFilters.licenseFilter === 'need' ? !hasAnyValid : hasAnyValid;
      });
    }

    // Denied reasoning filter
    if (activeFilters.deniedFilter !== 'show') {
      filtered = filtered.filter(r => {
        const reasoning = (r.reasoning || r.leadEntry?.reasoning || '').toLowerCase();
        const isDenied = reasoning.includes('denied');
        
        if (activeFilters.deniedFilter === 'hide') {
          // Hide denied entries (default behavior)
          return !isDenied;
        } else if (activeFilters.deniedFilter === 'only') {
          // Show only denied entries
          return isDenied;
        }
        return true;
      });
    }

    

    return filtered;
  }, [rows, searchQuery, statusTab, activeFilters.licenseFilter, activeFilters.timeFilter, activeFilters.deniedFilter, licensedStates, hasElevatedPermissions]);

  const handleExport = useCallback(() => {
    // Export filteredRows data as CSV
    if (filteredRows.length === 0) {
      toast.error('No data to export');
      return;
    }

    const tId = toast.loading('Exporting data...');

    try {
      // Define the columns to export with headers
      const exportColumns = [
        { key: 'lagnname', header: 'Agent Name' },
        { key: 'esid', header: 'Active Date' },
        { key: 'mga', header: 'MGA' },
        { key: 'notes', header: 'Notes' },
        { key: 'licensed_states', header: 'States Licensed' },
        { key: 'created_at', header: 'Requested' },
        { key: 'sent_date', header: 'Sent' },
        { key: 'reasoning', header: 'Reasoning' },
        { key: 'PendingDate', header: 'Pending Date' },
        { key: 'days_to_code', header: 'Days to Code' }
      ];

      // Create CSV content
      const csvHeaders = exportColumns.map(col => col.header).join(',');
      
      const csvRows = filteredRows.map(row => {
        return exportColumns.map(col => {
          let value = '';
          
          // Handle special cases for computed values
          switch (col.key) {
            case 'lagnname':
              const name = row.lagnname || '';
              const isPending = row.pending == 1;
              value = isPending ? `* ${name}` : name;
              break;
            case 'notes':
              value = row.notes ?? row.leadEntry?.notes ?? '';
              break;
            case 'licensed_states':
              value = row.licensed_states || 'N/A';
              break;
            case 'created_at':
              const { created_at, lr_type, lr_sent } = row;
              if (created_at && (lr_type === '1st Pack' || lr_type === 'First Pack') && (lr_sent == 0)) {
                value = new Date(created_at).toLocaleString();
              } else {
                value = '—';
              }
              break;
            case 'sent_date':
              const leadEntry = row.leadEntry;
              const sentDate = leadEntry?.sent_date;
              const isSent = leadEntry?.sent == 1;
              if (isSent && sentDate) {
                value = sentDate;
              } else {
                value = '—';
              }
              break;
            case 'reasoning':
              value = row.reasoning ?? row.leadEntry?.reasoning ?? '';
              break;
            case 'PendingDate':
              if (!row.PendingDate) {
                value = '—';
              } else {
                try {
                  const date = new Date(row.PendingDate);
                  value = date.toLocaleDateString();
                } catch (e) {
                  value = row.PendingDate;
                }
              }
              break;
            case 'days_to_code':
              value = row.days_to_code ?? '—';
              break;
            default:
              value = row[col.key] || '';
          }
          
          // Escape quotes and wrap in quotes if contains comma
          const stringValue = String(value);
          return stringValue.includes(',') || stringValue.includes('"') 
            ? `"${stringValue.replace(/"/g, '""')}"` 
            : stringValue;
        }).join(',');
      });

      const csvContent = [csvHeaders, ...csvRows].join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with timestamp and status filter
      const timestamp = new Date().toISOString().slice(0, 10);
      const statusSuffix = statusTab === 'all' ? 'all' : 
                          statusTab === 'sent' ? 'sent' : 
                          statusTab === 'requested' ? 'requested' : 
                          'not-sent';
      const filename = `code-pack-${statusSuffix}-${timestamp}.csv`;
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${filteredRows.length} records`, { id: tId });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed', { id: tId });
    }
  }, [filteredRows, statusTab]);

  // Add context menu event listener
  useEffect(() => {
    const handleTableContextMenu = (event) => {
      // Find the closest table row
      const row = event.target.closest('tr[data-rowid]');
      if (!row) return;

      const rowId = row.getAttribute('data-rowid');
      const rowData = filteredRows.find(r => String(r.id) === String(rowId));
      
      if (rowData) {
        handleRowRightClick(event, rowData);
      }
    };

    // Add event listener to the document to catch context menu events in the table
    document.addEventListener('contextmenu', handleTableContextMenu);

    return () => {
      document.removeEventListener('contextmenu', handleTableContextMenu);
    };
  }, [filteredRows, handleRowRightClick]);

  // Close context menu on clicks outside or escape key
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        handleCloseContextMenu();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && contextMenu) {
        handleCloseContextMenu();
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [contextMenu, handleCloseContextMenu]);

  const rowClassNames = useMemo(() => {
    const classes = {};
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    rows.forEach((r) => {
      const packSent = r.lr_sent == 1 || (r.leadEntry && r.leadEntry.sent == 1);
      
      // In "All" tab, highlight sent rows with light green
      if (statusTab === 'all' && packSent) {
        classes[r.id] = 'row-pack-sent';
      }
      // Don't apply red styling if pack was sent
      else if (r.esid && !packSent) {
        const d = new Date(r.esid);
        if (!isNaN(d.getTime()) && d < oneMonthAgo) {
          classes[r.id] = 'row-stale-esid';
        }
      }
    });
    return classes;
  }, [rows, statusTab]);

  // Show loading state while hierarchy loads for non-elevated, non-AGT users
  if (hierarchyLoading && !hasElevatedPermissions && !isAgtUser && !hierarchyData) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Loading user permissions and eligible agents...</p>
      </div>
    );
  }

  return (
    <div>
      {/* CSS for row styling */}
      <style>{`
        .row-pack-sent td { background-color: #d9f2d9 !important; }
      `}</style>
      
      <div className="search-bar mb-4" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Search by agent name, MGA, or Active Date..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: 360 }}
        />
        <FilterMenu
          activeFilters={{ ...activeFilters }}
          onFilterToggle={() => {}}
          onStatusFilterToggle={() => {}}
          onToggleAllRoles={() => {}}
          onResetFilters={() => setActiveFilters({ licenseFilter: 'neutral', timeFilter: '30', deniedFilter: 'hide' })}
          filterCategories={[
            {
              name: 'Licenses',
              type: 'custom',
              filters: [],
              onToggle: () => {}
            }
          ]}
          customContent={(
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* License tri-state */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#666' }}>Licenses:</span>
                <button className="action-button" style={{ backgroundColor: activeFilters.licenseFilter === 'neutral' ? '#00558c' : 'transparent', color: activeFilters.licenseFilter === 'neutral' ? 'white' : '#666', border: '1px solid #ddd' }} onClick={() => setActiveFilters(prev => ({ ...prev, licenseFilter: 'neutral' }))}>All</button>
                <button className="action-button" style={{ backgroundColor: activeFilters.licenseFilter === 'need' ? '#00558c' : 'transparent', color: activeFilters.licenseFilter === 'need' ? 'white' : '#666', border: '1px solid #ddd' }} onClick={() => setActiveFilters(prev => ({ ...prev, licenseFilter: 'need' }))}>Need</button>
                <button className="action-button" style={{ backgroundColor: activeFilters.licenseFilter === 'has' ? '#00558c' : 'transparent', color: activeFilters.licenseFilter === 'has' ? 'white' : '#666', border: '1px solid #ddd' }} onClick={() => setActiveFilters(prev => ({ ...prev, licenseFilter: 'has' }))}>Has</button>
              </div>
              
              {/* Denied reasoning filter */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#666' }}>Denied:</span>
                <button className="action-button" style={{ backgroundColor: activeFilters.deniedFilter === 'hide' ? '#00558c' : 'transparent', color: activeFilters.deniedFilter === 'hide' ? 'white' : '#666', border: '1px solid #ddd' }} onClick={() => setActiveFilters(prev => ({ ...prev, deniedFilter: 'hide' }))}>Hide</button>
                <button className="action-button" style={{ backgroundColor: activeFilters.deniedFilter === 'show' ? '#00558c' : 'transparent', color: activeFilters.deniedFilter === 'show' ? 'white' : '#666', border: '1px solid #ddd' }} onClick={() => setActiveFilters(prev => ({ ...prev, deniedFilter: 'show' }))}>Show</button>
                <button className="action-button" style={{ backgroundColor: activeFilters.deniedFilter === 'only' ? '#00558c' : 'transparent', color: activeFilters.deniedFilter === 'only' ? 'white' : '#666', border: '1px solid #ddd' }} onClick={() => setActiveFilters(prev => ({ ...prev, deniedFilter: 'only' }))}>Only</button>
              </div>
              
              {/* Time window filter for Not Sent tab - only for elevated users */}
              {statusTab === 'notSent' && hasElevatedPermissions && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#666' }}>Time Window:</span>
                  <button className="action-button" style={{ backgroundColor: activeFilters.timeFilter === '7' ? '#00558c' : 'transparent', color: activeFilters.timeFilter === '7' ? 'white' : '#666', border: '1px solid #ddd' }} onClick={() => setActiveFilters(prev => ({ ...prev, timeFilter: '7' }))}>7d</button>
                  <button className="action-button" style={{ backgroundColor: activeFilters.timeFilter === '30' ? '#00558c' : 'transparent', color: activeFilters.timeFilter === '30' ? 'white' : '#666', border: '1px solid #ddd' }} onClick={() => setActiveFilters(prev => ({ ...prev, timeFilter: '30' }))}>30d</button>
                  <button className="action-button" style={{ backgroundColor: activeFilters.timeFilter === '60' ? '#00558c' : 'transparent', color: activeFilters.timeFilter === '60' ? 'white' : '#666', border: '1px solid #ddd' }} onClick={() => setActiveFilters(prev => ({ ...prev, timeFilter: '60' }))}>60d</button>
                  <button className="action-button" style={{ backgroundColor: activeFilters.timeFilter === '90' ? '#00558c' : 'transparent', color: activeFilters.timeFilter === '90' ? 'white' : '#666', border: '1px solid #ddd' }} onClick={() => setActiveFilters(prev => ({ ...prev, timeFilter: '90' }))}>90d</button>
                  <button className="action-button" style={{ backgroundColor: activeFilters.timeFilter === '180' ? '#00558c' : 'transparent', color: activeFilters.timeFilter === '180' ? 'white' : '#666', border: '1px solid #ddd' }} onClick={() => setActiveFilters(prev => ({ ...prev, timeFilter: '180' }))}>6m</button>
                  <button className="action-button" style={{ backgroundColor: activeFilters.timeFilter === 'all' ? '#00558c' : 'transparent', color: activeFilters.timeFilter === 'all' ? 'white' : '#666', border: '1px solid #ddd' }} onClick={() => setActiveFilters(prev => ({ ...prev, timeFilter: 'all' }))}>All</button>
                </div>
              )}
            </div>
          )}
          customContentOnly={true}
          buttonLabel={<span title="Filters">Filters</span>}
          position="bottom-right"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        disableCellEditing={false}
        disableSorting={false}
        defaultSortBy={currentSort.sortBy}
        defaultSortOrder={currentSort.sortOrder}
        onSortChange={handleSortChange}
        showActionBar={true}
        enableRowColoring={true}
        rowColorColumn="rowcolor"
        actionBarButtons={{
          addNew: false,
          import: false,
          export: true,
          delete: false,
          archive: false,
          sendEmail: false,
          toggleArchived: false,
          refresh: true,
          reassign: false,
          saveChanges: hasUnsavedChanges,
          cancelChanges: hasUnsavedChanges
        }}
        onRefresh={fetchEligible}
        onExport={handleExport}
        onCellUpdate={handleCellEdit}
        onSaveChanges={handleSaveChanges}
        onCancelChanges={handleCancelChanges}
        key={tableUpdateKey}
        actionBarExtras={(
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className="action-button"
              style={{
                backgroundColor: statusTab === 'all' ? '#00558c' : 'transparent',
                color: statusTab === 'all' ? 'white' : '#666',
                border: '1px solid #ddd'
              }}
              onClick={() => setStatusTab('all')}
            >
              All
            </button>
            <button
              className="action-button"
              style={{
                backgroundColor: statusTab === 'requested' ? '#00558c' : 'transparent',
                color: statusTab === 'requested' ? 'white' : '#666',
                border: '1px solid #ddd'
              }}
              onClick={() => setStatusTab('requested')}
            >
              Requested
            </button>
            <button
              className="action-button"
              style={{
                backgroundColor: statusTab === 'sent' ? '#00558c' : 'transparent',
                color: statusTab === 'sent' ? 'white' : '#666',
                border: '1px solid #ddd'
              }}
              onClick={() => setStatusTab('sent')}
            >
              Sent
            </button>
            <button
              className="action-button"
              style={{
                backgroundColor: statusTab === 'notSent' ? '#00558c' : 'transparent',
                color: statusTab === 'notSent' ? 'white' : '#666',
                border: '1px solid #ddd'
              }}
              onClick={() => setStatusTab('notSent')}
            >
              Not Sent
            </button>
          </div>
        )}
        entityName="agent"
        rowClassNames={rowClassNames}
      />
      {(loading || (hierarchyLoading && !hierarchyData)) && (
        <div style={{ marginTop: 12 }}>
          Loading{hierarchyLoading ? ' user permissions and' : ''} eligible agents...
        </div>
      )}
      
      <AddLicenseModal
        isOpen={showAddLicenseModal}
        onClose={handleCloseAddLicense}
        userId={selectedUserForLicense?.userId}
        lagnname={selectedUserForLicense?.lagnname}
        onSuccess={handleLicenseAdded}
      />
      
      {/* Custom Context Menu */}
      {contextMenu && (
        <ContextMenu
          options={contextMenu.options}
          onClose={handleCloseContextMenu}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1200
          }}
        />
      )}
    </div>
  );
};

export default CodePackTab;


