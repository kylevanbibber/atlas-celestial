import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import { useUserHierarchy } from '../../../hooks/useUserHierarchy';
import api from '../../../api';
import DataTable from '../../utils/DataTable';
import ActionBar from '../../utils/ActionBar';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

const ReleasePackTab = () => {
  const { user } = useContext(AuthContext);
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const [loading, setLoading] = useState(true);
  const [passedReleases, setPassedReleases] = useState([]);
  const [leadsReleased, setLeadsReleased] = useState([]);
  const [licensedStates, setLicensedStates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [secondPackFilter, setSecondPackFilter] = useState('notSent');
  const [exportFilter, setExportFilter] = useState('all');

  // Cell editing state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editedRows, setEditedRows] = useState({});

  // Archive state
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [selectedForArchive, setSelectedForArchive] = useState([]);
  const [archiveReason, setArchiveReason] = useState('');
  const [archivedView, setArchivedView] = useState(false);

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

  // Helper to convert a mm/dd/yyyy formatted string from the backend
  // into yyyy-mm-dd format so it can be used by the native date input.
  const convertMDYToYMD = (dateStr) => {
    if (!dateStr) return '';
    
    // Handle both mm/dd/yyyy and yyyy-mm-dd formats
    const parts = String(dateStr).split('/');
    
    if (parts.length === 3) {
      // mm/dd/yyyy format
      const [month, day, year] = parts;
      
      // Validate all parts exist and are valid
      if (!month || !day || !year || year.length < 4) {
        return '';
      }
      
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else if (dateStr.includes('-')) {
      // Already in yyyy-mm-dd format
      return dateStr;
    }
    
    return '';
  };

  const fetchPassedReleases = useCallback(async () => {
    setLoading(true);
    try {
      // Get all unreleased users with checklist data, then filter for passed ones
      const response = await api.get('/release/get-unreleased-users-checklist');
      const allData = response.data?.data || [];
      
      // Filter for passed agents only
      const passedData = allData.filter(agent => agent.passed === 'y').map(agent => ({
        userId: agent.id,
        lagnname: agent.lagnname,
        mga: agent.mga,
        releaseScheduled: agent.release_scheduled,
            esid: agent.esid,
            PendingDate: agent.PendingDate,
            days_to_code: agent.days_to_code
      }));
      
      // Apply hierarchy filtering for non-elevated users
      let filteredData = passedData;
      if (!hasElevatedPermissions) {
        if (isAgtUser) {
          // AGT users only see themselves
          filteredData = passedData.filter(r => 
            r.userId !== undefined && 
            r.userId !== null && 
            allowedIdsSet.has(String(r.userId))
          );
        } else {
          // Regular users see hierarchy-based filtered data
          filteredData = passedData.filter(r => 
            r.userId !== undefined && 
            r.userId !== null && 
            allowedIdsSet.has(String(r.userId))
          );
        }
      }

      setPassedReleases(filteredData);
    } catch (err) {
      console.error('Failed to load passed releases:', err);
      toast.error('Failed to load passed releases');
    } finally {
      setLoading(false);
    }
  }, [hasElevatedPermissions, isAgtUser, allowedIdsSet]);

  const fetchLeadsReleased = useCallback(async () => {
    try {
      const response = await api.get('/release/leads-released');
      const leadsData = response.data?.data || [];
      
      // Keep only 2nd Pack entries (support both '2nd Pack' and legacy 'Second Pack')
      const secondPackOnly = leadsData.filter(lead => lead.type === '2nd Pack' || lead.type === 'Second Pack');
      setLeadsReleased(secondPackOnly);
    } catch (err) {
      console.error('Failed to load leads released:', err);
    }
  }, []);

  const fetchLicensedStates = useCallback(async () => {
    try {
      const response = await api.get('/release/licensed-states');
      const data = response.data;
      if (data.success) {
        const licenses = data.data || [];
        setLicensedStates(licenses);
      }
    } catch (err) {
      console.error('Failed to load licensed states:', err);
    }
  }, []);

  useEffect(() => {
    // Only fetch when we have hierarchy data for non-elevated users, or anytime for elevated/AGT users
    if (hasElevatedPermissions || isAgtUser || (hierarchyData && allowedIds.length > 0)) {
      fetchPassedReleases();
      fetchLeadsReleased();
      fetchLicensedStates();
    }
  }, [fetchPassedReleases, fetchLeadsReleased, fetchLicensedStates, hasElevatedPermissions, isAgtUser, hierarchyData, allowedIds]);

  // Combine passed releases with leads and license data
  const combinedData = useMemo(() => {
    return passedReleases.map((agent) => {
      // Attach 2nd Pack info if present
      const leadInfo = leadsReleased.find(
        (lead) => lead.userId == agent.userId && (lead.type === '2nd Pack' || lead.type === 'Second Pack')
      );

      // Get all licenses for this agent
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find all licenses for this agent
      const agentLicenses = licensedStates.filter(l => l.userId == agent.userId);
      
      // Categorize licenses by status (but include ALL of them)
      const licensesWithStatus = agentLicenses.map((license) => {
        let status = 'valid';
        
        // Check if has expiry date
        if (!license.expiry_date) {
          status = 'no-expiry';
        } else {
          // Convert and validate the date
          const convertedDate = convertMDYToYMD(license.expiry_date);
          if (!convertedDate) {
            status = 'no-expiry';
          } else {
            const expiryDate = new Date(convertedDate);
            
            // Check if date is valid
            if (isNaN(expiryDate.getTime())) {
              status = 'no-expiry';
            } else if (expiryDate <= today) {
              status = 'expired';
            }
          }
        }
        
        return { ...license, status };
      });

      const combinedAgent = {
        ...agent,
        packReleasedDate: leadInfo ? leadInfo.sent_date : null,
        notes: leadInfo ? leadInfo.notes : null,
        lastUpdated: leadInfo ? leadInfo.last_updated : null,
        leadId: leadInfo ? leadInfo.id : null,
        leadEntry: leadInfo || null, // Add full leadEntry for archive filtering
        licensesWithStatus, // Store licenses with their status for rendering
        sent: leadInfo ? leadInfo.sent : 0,
      };
      
      return combinedAgent;
    });
  }, [passedReleases, leadsReleased, licensedStates]);

  // Filter data based on search and pack filter
  const filteredData = useMemo(() => {
    let filtered = [...combinedData];
    
    // Apply archive filter first
    filtered = filtered.filter(agent => {
      const archiveValue = agent.leadEntry?.archive;
      const isArchived = archiveValue == 1 || archiveValue === '1';
      
      if (archivedView) {
        // Archive view: only show records that are explicitly archived (archive = 1)
        return isArchived;
      } else {
        // Normal view: show records that are NOT archived (archive = 0, null, or no leadEntry)
        return !isArchived;
      }
    });
    
    // Apply search filter
    const term = searchQuery.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter(r => {
        const name = (r.lagnname || '').toLowerCase();
        const mga = (r.mga || '').toLowerCase();
        return name.includes(term) || mga.includes(term);
      });
    }

    // Apply second pack filter
    if (secondPackFilter === "sent") {
      filtered = filtered.filter(agent => agent.packReleasedDate && agent.packReleasedDate !== "N/A");
    } else if (secondPackFilter === "notSent") {
      // Not sent = either no 2nd Pack lead yet OR has 2nd Pack lead with sent = 0.
      filtered = filtered.filter(agent => {
        const lead = leadsReleased.find(l => l.userId == agent.userId && (l.type === '2nd Pack' || l.type === 'Second Pack'));
        return !lead || lead.sent == 0;
      });
    }
    // "all" shows everything

    // Log only for agents that are displayed
    if (filtered.length > 0) {
      console.log('=== LICENSED STATES DEBUG (Displayed Agents Only) ===');
      console.log(`Total agents displayed: ${filtered.length}`);
      console.log('\n--- ALL LICENSED STATES DATA ---');
      console.log(`Total licensedStates records: ${licensedStates.length}`);
      console.log('All unique userIds in licensedStates:', [...new Set(licensedStates.map(l => l.userId))].sort((a, b) => a - b));
      console.log('Sample licensedStates records:', licensedStates.slice(0, 3).map(l => ({
        userId: l.userId,
        type: typeof l.userId,
        state: l.state,
        expiry_date: l.expiry_date
      })));
      
      filtered.forEach(agent => {
        const licenses = agent.licensesWithStatus || [];
        console.log(`\nAgent ${agent.userId} (${agent.lagnname}):`);
        
        if (licenses.length === 0) {
          console.log(`  → No licenses found`);
          console.log(`  → Agent userId type: ${typeof agent.userId}, value: ${agent.userId}`);
          
          // Check if there are ANY licenses that might match with type conversion
          const matchingByString = licensedStates.filter(l => String(l.userId) === String(agent.userId));
          const matchingByNumber = licensedStates.filter(l => Number(l.userId) === Number(agent.userId));
          const matchingByLooseEquality = licensedStates.filter(l => l.userId == agent.userId);
          
          console.log(`  → Matching by String comparison: ${matchingByString.length}`);
          console.log(`  → Matching by Number comparison: ${matchingByNumber.length}`);
          console.log(`  → Matching by loose equality (==): ${matchingByLooseEquality.length}`);
          
          // Show any licenses that have this agent's name
          const possibleMatches = licensedStates.filter(l => 
            l.lagnname && agent.lagnname && 
            String(l.lagnname).toLowerCase() === String(agent.lagnname).toLowerCase()
          );
          if (possibleMatches.length > 0) {
            console.log(`  → Found ${possibleMatches.length} licenses matching by name:`, possibleMatches.map(l => ({
              licenseUserId: l.userId,
              state: l.state,
              name: l.lagnname
            })));
          }
        } else {
          const validCount = licenses.filter(l => l.status === 'valid').length;
          const expiredCount = licenses.filter(l => l.status === 'expired').length;
          const noExpiryCount = licenses.filter(l => l.status === 'no-expiry').length;
          console.log(`  → Total licenses: ${licenses.length}`);
          console.log(`  → Status: ${validCount} valid, ${expiredCount} expired, ${noExpiryCount} no expiry`);
          console.log(`  → States: ${licenses.map(l => `${l.state}(${l.status})`).join(', ')}`);
        }
      });
      
      // Summary
      const agentsWithLicenses = filtered.filter(a => a.licensesWithStatus && a.licensesWithStatus.length > 0).length;
      const agentsWithoutLicenses = filtered.filter(a => !a.licensesWithStatus || a.licensesWithStatus.length === 0).length;
      const totalValid = filtered.reduce((sum, a) => 
        sum + (a.licensesWithStatus?.filter(l => l.status === 'valid').length || 0), 0);
      const totalExpired = filtered.reduce((sum, a) => 
        sum + (a.licensesWithStatus?.filter(l => l.status === 'expired').length || 0), 0);
      const totalNoExpiry = filtered.reduce((sum, a) => 
        sum + (a.licensesWithStatus?.filter(l => l.status === 'no-expiry').length || 0), 0);
      
      console.log('\n--- SUMMARY ---');
      console.log(`Agents with licenses: ${agentsWithLicenses}`);
      console.log(`Agents without licenses (showing N/A): ${agentsWithoutLicenses}`);
      console.log(`Total licenses - Valid: ${totalValid}, Expired: ${totalExpired}, No Expiry: ${totalNoExpiry}`);
      console.log('=== END DEBUG ===');
    }

    return filtered;
  }, [combinedData, searchQuery, secondPackFilter, leadsReleased, archivedView]);

  const handleSecondPack = useCallback(async (agent) => {
    try {
      const response = await api.post('/release/second-pack', {
        userId: agent.userId,
      });

      if (!response.data.success) {
        return toast.error("Error: " + response.data.message);
      }

      // Build the sent date string for immediate UI update
      const now = new Date();
      const day = now.getDate();
      const month = now.getMonth() + 1;
      const year = now.getFullYear().toString().slice(-2);
      const hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const sentDate = `${month}/${day}/${year} ${hours}:${minutes}`;

      // Update local state optimistically, then re-fetch for accuracy
      setLeadsReleased((prevLeads) => {
        const existingIdx = prevLeads.findIndex(
          (lead) => lead.userId == agent.userId && (lead.type === '2nd Pack' || lead.type === 'Second Pack')
        );

        if (existingIdx >= 0) {
          // Update existing entry
          const updated = [...prevLeads];
          updated[existingIdx] = { ...updated[existingIdx], sent_date: sentDate, sent: 1 };
          return updated;
        } else {
          // No existing entry — add a new one so the UI updates immediately
          return [...prevLeads, {
            userId: agent.userId,
            lagnname: agent.lagnname,
            type: 'Second Pack',
            sent: 1,
            sent_date: sentDate,
            last_updated: sentDate,
          }];
        }
      });

      toast.success(`Second code pack marked as sent for ${agent.lagnname}`);

      // Re-fetch to get the actual server data (correct IDs, dates, etc.)
      fetchLeadsReleased();
    } catch (error) {
      console.error('Failed to send second code pack:', error);
      toast.error('Failed to send second code pack');
    }
  }, [fetchLeadsReleased]);

  // Cell editing handlers
  const handleCellEdit = (id, field, value) => {
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
        if (changes.notes !== undefined) {
          const agent = combinedData.find(a => String(a.userId) === String(userId));
          const leadId = agent?.leadId;
          if (leadId) {
      const now = new Date();
      const options = {
        year: "2-digit",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
        timeZone: "America/New_York",
      };
      const nowFormatted = now.toLocaleString("en-US", options);
      
      const payload = { 
              notes: changes.notes, 
        last_updated: nowFormatted 
      };
      
            await api.put(`/release/leads-released/${leadId}`, payload);
          }
        }
      });
      
      await Promise.all(promises);
      setEditedRows({});
      setHasUnsavedChanges(false);
      toast.success('Changes saved successfully', { id: tId });
      fetchLeadsReleased();
    } catch (error) {
      console.error('Failed to save changes:', error);
      toast.error('Failed to save changes', { id: tId });
    }
  };

  const handleCancelChanges = () => {
    setEditedRows({});
    setHasUnsavedChanges(false);
  };

  // Archive handlers
  const handleArchive = useCallback((selectedIds) => {
    setSelectedForArchive(selectedIds);
    setShowArchiveModal(true);
  }, []);

  const handleArchiveConfirm = useCallback(async () => {
    if (!archiveReason.trim()) {
      toast.error('Please provide a reason for archiving');
      return;
    }

    const tId = toast.loading('Archiving releases...');
    try {
      const promises = selectedForArchive.map(async (userId) => {
        const agent = combinedData.find(a => String(a.userId) === String(userId));
        const leadId = agent?.leadId;
        if (leadId) {
          const payload = {
            archive: 1,
            reason_archive: archiveReason.trim(),
            archived_date: new Date().toISOString(),
            last_updated: new Date().toISOString().slice(0, 19).replace('T', ' ')
          };
          await api.put(`/release/leads-released/${leadId}`, payload);
        }
      });

      await Promise.all(promises);
      
      // Close modal and reset state
      setShowArchiveModal(false);
      setSelectedForArchive([]);
      setArchiveReason('');
      
      toast.success(`Successfully archived ${selectedForArchive.length} release(s)`, { id: tId });
      
      // Refresh data to show changes
      fetchPassedReleases();
      fetchLeadsReleased();
    } catch (error) {
      console.error('Failed to archive releases:', error);
      toast.error('Failed to archive releases', { id: tId });
    }
  }, [selectedForArchive, archiveReason, combinedData, fetchPassedReleases, fetchLeadsReleased]);

  const handleArchiveCancel = useCallback(() => {
    setShowArchiveModal(false);
    setSelectedForArchive([]);
    setArchiveReason('');
  }, []);

  const handleToggleArchivedView = useCallback(() => {
    setArchivedView(!archivedView);
    // Refresh data when toggling view
    fetchPassedReleases();
        fetchLeadsReleased();
  }, [archivedView, fetchPassedReleases, fetchLeadsReleased]);

  // Unarchive handlers
  const handleUnarchive = useCallback(async (userId) => {
    const tId = toast.loading('Unarchiving release...');
    try {
      const agent = combinedData.find(a => String(a.userId) === String(userId));
      const leadId = agent?.leadId;
      
      if (!leadId) {
        toast.error('Cannot unarchive - no lead pack record found', { id: tId });
        return;
      }

      const payload = {
        archive: 0,
        reason_archive: null,
        last_updated: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
      
      await api.put(`/release/leads-released/${leadId}`, payload);
      
      toast.success(`Successfully unarchived ${agent.agentName}`, { id: tId });
      
      // Refresh data to show changes
      await fetchPassedReleases();
      await fetchLeadsReleased();
    } catch (error) {
      console.error('Failed to unarchive release:', error);
      toast.error('Failed to unarchive release', { id: tId });
    }
  }, [combinedData, fetchPassedReleases, fetchLeadsReleased]);

  const formatName = useCallback((name) => {
    if (!name) return "N/A";
    const parts = name.split(" ").filter(Boolean);
    const [last, first, middle, suffix] = parts;

    if (parts.length === 2) {
      return `${first} ${last}`;
    } else if (parts.length === 3) {
      if (middle && middle.length === 1) {
        return `${first} ${middle} ${last}`;
      }
      return `${first} ${last} ${middle}`;
    } else if (parts.length === 4) {
      return `${first} ${middle} ${last} ${suffix}`;
    }

    return name;
  }, []);

  // Format UTC date for display
  const formatUTCForDisplay = (utcString) => {
    if (!utcString) return 'N/A';
    try {
      const date = new Date(utcString);
      return date.toLocaleString();
    } catch (e) {
      return utcString;
    }
  };

  const columns = useMemo(() => [
    {
      Header: 'Agent Name',
      accessor: 'lagnname',
      Cell: ({ value }) => <span>{formatName(value)}</span>,
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
      Header: 'SGA', 
      accessor: 'sga',
      width: 35,
      Cell: ({ row }) => {
        const mgaReptName = row.original.mga_rept_name || '';
        return mgaReptName === 'LOCKER-ROTOLO' ? 'E4' : 'A$';
      }
    },
    {
      Header: 'Notes',
      accessor: 'notes',
      Cell: ({ value, row, isEditing, updateCell }) => {
        const agent = row.original;
        // Get the current edited value or fallback to original value
        const currentEditedValue = editedRows[agent.userId]?.notes;
        const notesVal = currentEditedValue !== undefined ? currentEditedValue : (value || '');
        const canEdit = hasElevatedPermissions && agent.leadId;
        
        if (!canEdit) {
          return <span>{notesVal || "N/A"}</span>;
        }
        
        // If cell is being edited, render input field
        if (isEditing) {
          return (
          <input
            type="text"
              value={notesVal}
              onChange={(e) => updateCell(agent.userId, 'notes', e.target.value)}
              style={{ 
                width: '100%', 
                border: 'none', 
                outline: 'none', 
                background: 'transparent',
                minWidth: "80px"
              }}
              autoFocus
            />
          );
        }
        
        return (
          <span 
            style={{ 
              cursor: 'pointer',
              minWidth: "80px", 
              display: "inline-block"
            }}
          >
            {notesVal || "—"}
          </span>
        );
      },
      editable: hasElevatedPermissions
    },
    {
      Header: 'MGA',
      accessor: 'mga',
      Cell: ({ value }) => <span>{formatName(value)}</span>,
    },
    {
      Header: 'States Licensed',
      accessor: 'licensesWithStatus',
      Cell: ({ value, row }) => {
        const licenses = value || [];
        
        if (licenses.length === 0) {
          return <span>N/A</span>;
        }
        
        return (
          <span>
            {licenses.map((license, idx) => {
              let color = '#000'; // Default black for valid licenses
              
              if (license.status === 'expired') {
                color = '#dc3545'; // Red for expired
              } else if (license.status === 'no-expiry') {
                color = '#6c757d'; // Gray for no expiry date
              }
              
              return (
                <span key={idx}>
                  <span style={{ color }}>{license.state}</span>
                  {idx < licenses.length - 1 && ', '}
                </span>
              );
            })}
          </span>
        );
      },
    },
    {
      Header: 'Code Pack Released Date',
      accessor: 'packReleasedDate',
      Cell: ({ value, row }) => {
        const agent = row.original;
        if (hasElevatedPermissions) {
          if (agent.packReleasedDate && agent.packReleasedDate !== "N/A") {
            return (
              <button className="action-button" style={{
                backgroundColor: '#6c757d',
                color: 'white',
                fontSize: '10px',
                padding: '4px 8px',
                border: 'none',
                borderRadius: '3px'
              }} disabled>
                Already Sent
              </button>
            );
          }
          return (
            <button onClick={() => handleSecondPack(agent)} className="btn-primary" style={{
              backgroundColor: '#28a745',
              color: 'white',
              fontSize: '10px',
              padding: '4px 8px',
              border: 'none',
              borderRadius: '3px'
            }}>
              Mark Sent
            </button>
          );
        }
        return value || "N/A";
      },
    },
    {
      Header: 'Archive',
      accessor: 'archive',
      id: 'archive',
      Cell: ({ row }) => {
        const agent = row.original;
        const isArchived = agent.leadEntry?.archive == 1;
        const canArchive = hasElevatedPermissions && agent.leadId && !isArchived;
        const canUnarchive = hasElevatedPermissions && agent.leadId && isArchived;
        
        if (archivedView) {
          // In archived view, show unarchive button and archive reason
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {canUnarchive && (
                <button
                  onClick={() => handleUnarchive(agent.userId)}
                  className="btn-success"
                  style={{ 
                    fontSize: '10px',
                    padding: '4px 8px'
                  }}
                >
                  Unarchive
                </button>
              )}
              <span style={{ 
                fontSize: '10px', 
                color: '#666',
                fontStyle: 'italic'
              }}>
                {agent.leadEntry?.reason_archive || 'Archived'}
              </span>
            </div>
          );
        }
        
        if (!canArchive) {
          return <span style={{ color: '#999' }}>—</span>;
        }
        
        return (
          <button
            onClick={() => handleArchive([agent.userId])}
            className="btn-primary"
            style={{ 
              fontSize: '10px',
              padding: '4px 8px'
            }}
          >
            Archive
          </button>
        );
      },
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
      Header: 'Release Date',
      accessor: 'releaseScheduled',
      Cell: ({ value }) => formatUTCForDisplay(value),
    },
    {
      Header: '2nd Code Pack Sent',
      accessor: 'packReleasedDate',
      id: 'secondPackSent',
      Cell: ({ value, row }) => {
        const agent = row.original;
        return hasElevatedPermissions ? (
          agent.packReleasedDate && agent.packReleasedDate !== "N/A" ? (
            <button className="action-button" style={{ 
              backgroundColor: '#6c757d',
              color: 'white',
              fontSize: '10px',
              padding: '4px 8px',
              border: 'none',
              borderRadius: '3px'
            }} disabled>
              Already Sent
            </button>
          ) : (
            <button onClick={() => handleSecondPack(agent)} className="btn-primary" style={{
              backgroundColor: '#28a745',
              color: 'white',
              fontSize: '10px',
              padding: '4px 8px',
              border: 'none',
              borderRadius: '3px'
            }}>
              Mark Sent
            </button>
          )
        ) : (
          value || "N/A"
        );
      },
    },
    {
      Header: 'Last Updated',
      accessor: 'lastUpdated',
      Cell: ({ value }) => value || 'N/A',
    },
  ], [hasElevatedPermissions, formatName, handleSecondPack, fetchLeadsReleased, combinedData, editedRows, handleArchive, handleUnarchive, archivedView]);

  // Helper function to format dates for Excel export
  const formatDateForExcel = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    
    // Convert to string and check for invalid date patterns
    const dateString = String(dateStr).trim();
    
    // Check for malformed dates (NaN, undefined, null in string form)
    if (dateString.includes('NaN') || dateString.includes('undefined') || dateString.includes('null')) {
      return 'N/A';
    }
    
    try {
      // Check if it's MySQL datetime format (YYYY-MM-DD HH:MM:SS or YYYY-MM-DD)
      if (dateString.includes('-') && dateString.match(/^\d{4}-\d{1,2}-\d{1,2}/)) {
        // Parse MySQL datetime: "2026-01-30 19:27:22" or "2026-01-30"
        const [datePart, timePart] = dateString.split(' ');
        const [year, month, day] = datePart.split('-');
        
        const monthNum = parseInt(month);
        const dayNum = parseInt(day);
        
        // Validate
        if (isNaN(monthNum) || isNaN(dayNum) || isNaN(parseInt(year))) {
          return 'N/A';
        }
        
        // Format as MM/DD/YYYY HH:MM:SS for Excel
        const formattedMonth = String(monthNum).padStart(2, '0');
        const formattedDay = String(dayNum).padStart(2, '0');
        
        if (timePart) {
          return `${formattedMonth}/${formattedDay}/${year} ${timePart}`;
        } else {
          return `${formattedMonth}/${formattedDay}/${year}`;
        }
      }
      
      // Handle m/d/yy h:mm format (e.g., "4/14/25, 13:59" or "7/31/25 15:59")
      const cleanStr = dateString.replace(',', '').trim();
      const parts = cleanStr.split(' ');
      
      if (parts.length >= 1) {
        const datePart = parts[0];
        const timePart = parts[1] || '';
        
        const dateComponents = datePart.split('/');
        if (dateComponents.length === 3) {
          let [month, day, year] = dateComponents;
          
          // Validate all components exist and are valid numbers
          if (!month || !day || !year) {
            return 'N/A';
          }
          
          const monthNum = parseInt(month);
          const dayNum = parseInt(day);
          const yearNum = parseInt(year);
          
          // Check if any parsing resulted in NaN
          if (isNaN(monthNum) || isNaN(dayNum) || isNaN(yearNum)) {
            return 'N/A';
          }
          
          // Validate ranges
          if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
            return 'N/A';
          }
          
          // Convert 2-digit year to 4-digit
          if (year.length === 2) {
            year = yearNum >= 0 && yearNum <= 50 ? `20${year}` : `19${year}`;
          }
          
          // Pad month and day with leading zeros
          month = String(monthNum).padStart(2, '0');
          day = String(dayNum).padStart(2, '0');
          
          // Format as MM/DD/YYYY HH:MM for Excel
          if (timePart) {
            return `${month}/${day}/${year} ${timePart}`;
          } else {
            return `${month}/${day}/${year}`;
          }
        }
      }
      
      // If we can't parse it, return N/A
      return 'N/A';
    } catch (e) {
      console.error('Error formatting date for excel:', dateStr, e);
      return 'N/A';
    }
  };

  // Export to Excel functionality
  const exportToExcel = () => {
    if (!filteredData.length) {
      toast.error('No data to export');
      return;
    }

    // Apply date filter for export
    let dataToExport = [...filteredData];
    
    if (exportFilter !== 'all') {
      const now = new Date();
      const daysAgo = parseInt(exportFilter);
      const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      
      dataToExport = filteredData.filter(row => {
        if (!row.releaseScheduled) return false;
        const releaseDate = new Date(row.releaseScheduled);
        return releaseDate >= cutoffDate;
      });
      
      if (dataToExport.length === 0) {
        toast.error(`No data found for the last ${daysAgo} days`);
        return;
      }
    }

    const exportData = dataToExport.map((row) => ({
      agentName: row.lagnname,
      releaseScheduled: row.releaseScheduled ? formatUTCForDisplay(row.releaseScheduled) : "N/A",
      mga: row.mga,
      sga: (row.mga_rept_name === 'LOCKER-ROTOLO') ? 'E4' : 'A$',
      statesLicensed: row.licensesWithStatus && row.licensesWithStatus.length > 0 
        ? row.licensesWithStatus.map(l => l.state).join(', ') 
        : "N/A",
      packReleasedDate: formatDateForExcel(row.packReleasedDate),
      lastUpdated: formatDateForExcel(row.lastUpdated),
      notes: row.notes || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Release Code Packs");
    XLSX.writeFile(workbook, "release_code_packs.xlsx");
    
    const filterText = exportFilter === 'all' ? 'All' : `Last ${exportFilter} days`;
    toast.success(`Excel file downloaded successfully (${filterText}: ${exportData.length} records)`);
  };

  // Show loading state while hierarchy loads for non-elevated, non-AGT users
  if (hierarchyLoading && !hasElevatedPermissions && !isAgtUser && !hierarchyData) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Loading user permissions and release data...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="search-bar mb-4" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Search by agent name or MGA..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: 360 }}
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        defaultSortBy="releaseScheduled"
        defaultSortOrder="desc"
        showActionBar={true}
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
          saveChanges: hasUnsavedChanges,
          cancelChanges: hasUnsavedChanges
        }}
        onRefresh={() => {
          fetchPassedReleases();
          fetchLeadsReleased();
          fetchLicensedStates();
        }}
        disableCellEditing={false}
        onCellUpdate={handleCellEdit}
        onSaveChanges={handleSaveChanges}
        onCancelChanges={handleCancelChanges}
        actionBarExtras={(
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Export filter dropdown */}
            <select
              value={exportFilter}
              onChange={(e) => setExportFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
              title="Select date range for export"
            >
              <option value="all">Export All</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="180">Last 180 Days</option>
            </select>
            
            {/* Export button */}
            <button
              className="action-button"
              onClick={exportToExcel}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: '1px solid #28a745',
                borderRadius: '4px',
                padding: '8px 12px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
              title="Export to Excel"
            >
              Export
            </button>
            
            {/* Filter buttons */}
            <button 
              className="action-button"
              onClick={() => setSecondPackFilter("all")}
              style={{
                backgroundColor: secondPackFilter === "all" ? '#00558c' : 'transparent',
                color: secondPackFilter === "all" ? 'white' : '#666',
                border: '1px solid #ddd'
              }}
            >
              All
            </button>
            <button 
              className="action-button"
              onClick={() => setSecondPackFilter("sent")}
              style={{
                backgroundColor: secondPackFilter === "sent" ? '#00558c' : 'transparent',
                color: secondPackFilter === "sent" ? 'white' : '#666',
                border: '1px solid #ddd'
              }}
            >
              Sent
            </button>
            <button 
              className="action-button"
              onClick={() => setSecondPackFilter("notSent")}
              style={{
                backgroundColor: secondPackFilter === "notSent" ? '#00558c' : 'transparent',
                color: secondPackFilter === "notSent" ? 'white' : '#666',
                border: '1px solid #ddd'
              }}
            >
              Not Sent
            </button>
          </div>
        )}
        entityName="release"
      />
      
      {loading && <div style={{ marginTop: 12 }}>Loading release data...</div>}
      
      {/* Archive Modal */}
      {showArchiveModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            width: '400px',
            maxWidth: '90vw'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
              Archive {selectedForArchive.length} Release{selectedForArchive.length !== 1 ? 's' : ''}
            </h3>
            <p style={{ marginBottom: '16px', color: '#666' }}>
              Please provide a reason for archiving these releases:
            </p>
            <textarea
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="Enter reason for archiving..."
              style={{
                width: '100%',
                height: '80px',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                resize: 'vertical',
                fontSize: '14px'
              }}
              autoFocus
            />
            <div style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end',
              marginTop: '16px'
            }}>
              <button
                onClick={handleArchiveCancel}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveConfirm}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                disabled={!archiveReason.trim()}
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReleasePackTab;
