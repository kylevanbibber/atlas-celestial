import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useUserHierarchy } from '../../../hooks/useUserHierarchy';
import api from '../../../api';
import Tabs from '../../utils/Tabs';
import DataTable from '../../utils/DataTable';
import RightDetails from '../../utils/RightDetails';
import AddRecruitModal from './AddRecruitModal';
import { FiSearch, FiPlus, FiFilter } from 'react-icons/fi';
import './Pipeline.css';

const PipelineProgress = () => {
  const { user } = useAuth();
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  
  // State
  const [stages, setStages] = useState([]);
  const [recruits, setRecruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('all'); // 'all' or checklist item id
  const [stageChecklistItems, setStageChecklistItems] = useState([]); // Checklist items for active stage
  const [recruitProgress, setRecruitProgress] = useState({}); // Map of recruitId -> progress array
  const [searchTerm, setSearchTerm] = useState('');
  const [showTeam, setShowTeam] = useState(false);
  const [showRightDetails, setShowRightDetails] = useState(false);
  const [rightDetailsData, setRightDetailsData] = useState(null);
  const [showAddRecruitModal, setShowAddRecruitModal] = useState(false);
  const [stats, setStats] = useState(null);
  
  // Determine user permissions
  const isAgent = user?.clname === 'AGT';
  const isManager = ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);
  const isAdmin = user?.Role === 'Admin';
  const canViewTeam = isManager || isAdmin;
  
  // Get hierarchy IDs for filtering
  const hierarchyIds = useMemo(() => {
    if (isAdmin || !canViewTeam) return [];
    return getHierarchyForComponent('ids');
  }, [isAdmin, canViewTeam, getHierarchyForComponent]);

  // Get team members for display in columns
  const teamMembers = useMemo(() => {
    const hierarchy = getHierarchyForComponent('full') || [];
    return [
      { id: user?.id, lagnname: user?.lagnname },
      ...hierarchy.filter(m => m.id !== user?.id)
    ];
  }, [user, getHierarchyForComponent]);

  // Get user IDs to fetch (self or team)
  const getUserIds = () => {
    if (isAgent) {
      return [user.userId];
    }
    if (canViewTeam && showTeam) {
      return [...hierarchyIds, user.userId];
    }
    return [user.userId];
  };

  // Fetch stages
  useEffect(() => {
    fetchStages();
  }, []);

  // Fetch recruits and stats when user or view changes
  useEffect(() => {
    if (!hierarchyLoading) {
      fetchData();
    }
  }, [user?.userId, showTeam, hierarchyLoading]);

  // Build ordered stages from before/after relationships
  const buildStageOrder = (stageList) => {
    // Filter out terminal stages (they're not in the main pipeline flow)
    const pipelineStages = stageList.filter(s => !s.is_terminal);
    
    // Find the starting stage (position_after is NULL)
    let currentStage = pipelineStages.find(s => s.position_after === null);
    
    if (!currentStage) {
      console.warn('[Pipeline] No starting stage found, using first stage');
      return pipelineStages;
    }
    
    const orderedStages = [];
    const visited = new Set();
    
    // Follow the chain
    while (currentStage && !visited.has(currentStage.stage_name)) {
      orderedStages.push(currentStage);
      visited.add(currentStage.stage_name);
      
      // Find next stage (where position_after === current stage_name)
      currentStage = pipelineStages.find(s => 
        s.position_after === currentStage.stage_name && 
        !visited.has(s.stage_name)
      );
    }
    
    // Add any stages not in the chain (shouldn't happen, but safety check)
    pipelineStages.forEach(stage => {
      if (!visited.has(stage.stage_name)) {
        console.warn(`[Pipeline] Stage "${stage.stage_name}" not in chain, appending to end`);
        orderedStages.push(stage);
      }
    });
    
    return orderedStages;
  };

  const fetchStages = async () => {
    try {
      const response = await api.get('/recruitment/stages');
      if (response.data.success) {
        const sortedStages = buildStageOrder(response.data.data);
        setStages(sortedStages);
        if (sortedStages.length > 0 && !activeTab) {
          setActiveTab(sortedStages[0].stage_name);
        }
      }
    } catch (error) {
      console.error('Error fetching stages:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch recruits
      let recruitsResponse;
      if (isAdmin) {
        // Admins see ALL recruits
        recruitsResponse = await api.get('/recruitment/recruits');
      } else {
        // Non-admins see only their own or their team's recruits
        const userIds = getUserIds();
        if (userIds.length === 1) {
          recruitsResponse = await api.get(`/recruitment/recruits/agent/${userIds[0]}`);
        } else {
          recruitsResponse = await api.post('/recruitment/recruits/team', { userIds });
        }
      }
      
      setRecruits(Array.isArray(recruitsResponse.data) ? recruitsResponse.data : []);
      
      // Fetch stats
      let statsResponse;
      if (isAdmin) {
        // Get stats for all recruits
        statsResponse = await api.get('/recruitment/stats');
      } else {
        const userIds = getUserIds();
        statsResponse = await api.get('/recruitment/stats', {
          params: { userIds: userIds.join(',') }
        });
      }
      
      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
      setRecruits([]);
    } finally {
      setLoading(false);
    }
  };

  // Get recruits for current stage
  const currentStageRecruits = useMemo(() => {
    if (!activeTab) return [];
    
    let filtered = recruits.filter(r => r.step === activeTab);
    
    // For On-boarding stage, only show if linked to activeuser and both Active='y' and managerActive='y'
    if (activeTab === 'On-boarding') {
      filtered = filtered.filter(r => 
        r.activeuser_active === 'y' && 
        r.activeuser_manager_active === 'y'
      );
    }
    
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        `${r.recruit_first} ${r.recruit_last}`.toLowerCase().includes(search) ||
        r.email?.toLowerCase().includes(search) ||
        r.phone?.includes(search) ||
        r.lagnname?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [recruits, activeTab, searchTerm]);

  // Filter recruits by sub-tab (checklist item completion status)
  const filteredBySubTab = useMemo(() => {
    if (activeSubTab === 'all') {
      return currentStageRecruits;
    }

    const selectedItemId = parseInt(activeSubTab);
    const selectedItemIndex = stageChecklistItems.findIndex(item => item.id === selectedItemId);
    
    if (selectedItemIndex === -1) return currentStageRecruits;

    // Get all items before this one (in order)
    const previousItems = stageChecklistItems.slice(0, selectedItemIndex);

    // Filter recruits who have completed all previous items but NOT this one
    return currentStageRecruits.filter(recruit => {
      const progress = recruitProgress[recruit.id] || [];
      
      // Check if current item is NOT completed
      const currentItemProgress = progress.find(p => p.checklist_item_id === selectedItemId);
      const currentItemCompleted = currentItemProgress?.completed === 1;
      
      if (currentItemCompleted) {
        return false; // Don't show if already completed
      }
      
      // Check if all previous items are completed
      const allPreviousCompleted = previousItems.every(prevItem => {
        const prevProgress = progress.find(p => p.checklist_item_id === prevItem.id);
        return prevProgress?.completed === 1;
      });
      
      return allPreviousCompleted;
    });
  }, [currentStageRecruits, activeSubTab, recruitProgress, stageChecklistItems]);

  // Create sub-tabs for checklist items
  const subTabs = useMemo(() => {
    const tabs = [
      {
        key: 'all',
        label: 'All',
        badge: currentStageRecruits.length
      }
    ];

    stageChecklistItems.forEach((item, index) => {
      const previousItems = stageChecklistItems.slice(0, index);
      
      // Count recruits who need to complete this item
      // (completed all previous items but not this one)
      const needsCount = currentStageRecruits.filter(recruit => {
        const progress = recruitProgress[recruit.id] || [];
        
        // Check if current item is NOT completed
        const currentItemProgress = progress.find(p => p.checklist_item_id === item.id);
        const currentItemCompleted = currentItemProgress?.completed === 1;
        
        if (currentItemCompleted) {
          return false;
        }
        
        // Check if all previous items are completed
        const allPreviousCompleted = previousItems.every(prevItem => {
          const prevProgress = progress.find(p => p.checklist_item_id === prevItem.id);
          return prevProgress?.completed === 1;
        });
        
        return allPreviousCompleted;
      }).length;

      tabs.push({
        key: String(item.id),
        label: item.item_name,
        badge: needsCount,
        completed: item.completed_count,
        total: item.total_count,
        pending: needsCount
      });
    });

    return tabs;
  }, [stageChecklistItems, currentStageRecruits, recruitProgress]);

  // Fetch checklist items and progress when active tab or recruits change
  useEffect(() => {
    const fetchStageChecklistData = async () => {
      if (!activeTab) {
        setStageChecklistItems([]);
        setRecruitProgress({});
        setActiveSubTab('all');
        return;
      }

      // Filter recruits for current stage
      let stageRecruits = recruits.filter(r => r.step === activeTab);
      
      // For On-boarding stage, only show if linked to activeuser and both Active='y' and managerActive='y'
      if (activeTab === 'On-boarding') {
        stageRecruits = stageRecruits.filter(r => 
          r.activeuser_active === 'y' && 
          r.activeuser_manager_active === 'y'
        );
      }

      const recruitIds = stageRecruits.map(r => r.id);
      
      if (recruitIds.length === 0) {
        setStageChecklistItems([]);
        setRecruitProgress({});
        setActiveSubTab('all');
        return;
      }

      try {
        // Fetch checklist items with completion stats
        const itemsResponse = await api.get(`/recruitment/stages/${encodeURIComponent(activeTab)}/checklist-items`, {
          params: { recruitIds: recruitIds.join(',') }
        });

        if (itemsResponse.data.success) {
          setStageChecklistItems(itemsResponse.data.data || []);
        }

        // Fetch bulk progress for all recruits
        const progressResponse = await api.post('/recruitment/recruits/checklist/bulk', {
          recruitIds
        });

        if (progressResponse.data.success) {
          setRecruitProgress(progressResponse.data.data || {});
        }
      } catch (error) {
        console.error('Error fetching stage checklist data:', error);
        setStageChecklistItems([]);
        setRecruitProgress({});
      }
    };

    fetchStageChecklistData();
  }, [activeTab, recruits]);

  // Get count for each stage
  const getStageCounts = useMemo(() => {
    const counts = {};
    stages.forEach(stage => {
      let stageRecruits = recruits.filter(r => r.step === stage.stage_name);
      
      // For On-boarding stage, only count if linked to activeuser and both Active='y' and managerActive='y'
      if (stage.stage_name === 'On-boarding') {
        stageRecruits = stageRecruits.filter(r => 
          r.activeuser_active === 'y' && 
          r.activeuser_manager_active === 'y'
        );
      }
      
      counts[stage.stage_name] = stageRecruits.length;
    });
    return counts;
  }, [stages, recruits]);

  // Handle moving recruit to different stage
  const handleMoveToStage = async (recruitId, newStage) => {
    try {
      await api.put(`/recruitment/recruits/${recruitId}/step`, { step: newStage });
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error moving recruit:', error);
    }
  };

  // Handle opening checklist
  const handleOpenChecklist = (recruit) => {
    const detailsData = {
      recruit,
      stages,
      __isPipelineChecklist: true
    };
    setRightDetailsData(detailsData);
    setShowRightDetails(true);
  };

  // Handle closing checklist
  const handleCloseChecklist = () => {
    setShowRightDetails(false);
    setRightDetailsData(null);
    fetchData(); // Refresh to get updated progress
  };

  // Handle recruit added successfully
  const handleRecruitAdded = (newRecruit) => {
    // Refresh data to show the new recruit (includes stats)
    fetchData();
    // Optionally, switch to the stage the recruit was added to
    if (newRecruit.step) {
      setActiveTab(newRecruit.step);
    }
  };

  // DataTable columns
  const formatDuration = (fromDateStr) => {
    if (!fromDateStr) return '—';

    // Ensure we have an ISO string; backend now returns UTC timestamps with "Z"
    let isoString = fromDateStr;
    if (!isoString.includes('T')) {
      isoString = fromDateStr.replace(' ', 'T');
    }
    if (!isoString.endsWith('Z') && !isoString.includes('+')) {
      isoString += 'Z';
    }

    const from = new Date(isoString);
    if (isNaN(from.getTime())) return '—';

    const now = new Date();
    const diffMs = now - from;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((diffMs / (1000 * 60)) % 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    const secs = Math.floor((diffMs / 1000) % 60);
    return `${mins}m ${secs}s`;
  };

  const columns = [
    {
      Header: 'Stage',
      accessor: 'step',
      type: 'select',
      DropdownOptions: stages.map(s => s.stage_name),
      dropdownBackgroundColor: (value) => {
        const stage = stages.find(s => s.stage_name === value);
        return stage?.stage_color || '#3498db';
      }
    },
    {
      Header: 'Name',
      accessor: 'recruit_first',
      Cell: ({ row }) => (
        <div style={{ fontWeight: 500 }}>
          {row.original.recruit_first} {row.original.recruit_last}
        </div>
      )
    },
    {
      Header: 'Phone',
      accessor: 'phone'
    },
    {
      Header: 'Resident State',
      accessor: 'resident_state',
      width: 110,
      Cell: ({ value }) => value || '—'
    },
    {
      Header: 'Date Added',
      accessor: 'date_added_utc',
      Cell: ({ value, row }) => {
        const raw = value || row.original.date_added;
        if (!raw) return '';
        let isoString = raw;
        if (!isoString.includes('T')) {
          isoString = raw.replace(' ', 'T');
        }
        if (!isoString.endsWith('Z') && !isoString.includes('+')) {
          isoString += 'Z';
        }
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString();
      }
    },
    {
      Header: 'Recruiting Agent',
      accessor: 'lagnname',
      Cell: ({ value }) => (
        <div style={{
          backgroundColor: '#e0e0e0',
          color: '#000',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          display: 'inline-block'
        }}>
          {value || 'N/A'}
        </div>
      )
    },
    {
      Header: 'Coded To',
      accessor: 'coded_to_name',
      Cell: ({ value }) => (
        <div style={{
          backgroundColor: value ? '#e0e0e0' : 'transparent',
          color: value ? '#000' : 'var(--text-secondary)',
          padding: value ? '2px 8px' : '0',
          borderRadius: value ? '12px' : '0',
          fontSize: '12px',
          display: 'inline-block'
        }}>
          {value || 'N/A'}
        </div>
      )
    },
    {
      Header: 'Redeemed',
      accessor: 'redeemed',
      Cell: ({ value }) => (
        <div style={{
          color: value ? '#27ae60' : '#95a5a6',
          fontWeight: 500,
          fontSize: '14px'
        }}>
          {value ? 'Yes' : 'No'}
        </div>
      )
    },
    {
      Header: 'Time in Stage',
      accessor: 'current_stage_entered',
      Cell: ({ row }) => (
        <span title={row.original.current_stage_entered || row.original.date_added_utc || row.original.date_added}>
          {formatDuration(row.original.current_stage_entered || row.original.date_added_utc || row.original.date_added)}
        </span>
      )
    }
  ];

  // Handle cell update (for DataTable inline editing)
  const handleCellUpdate = async (id, field, value) => {
    try {
      if (field === 'step') {
        await handleMoveToStage(id, value);
      } else {
        await api.put(`/recruitment/recruits/${id}`, { [field]: value });
        // Update local state
        setRecruits(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
      }
    } catch (error) {
      console.error('Error updating recruit:', error);
    }
  };

  // Create tabs configuration
  const tabs = stages.map(stage => ({
    key: stage.stage_name,
    label: stage.stage_name,
    badge: getStageCounts[stage.stage_name] || null
  }));

  if (loading && stages.length === 0) {
    return (
      <div className="pipeline-loading">
        <div className="pipeline-loading-spinner"></div>
        <span style={{ marginLeft: 12 }}>Loading pipeline...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Table Section */}
      <div className="pipeline-table-section">
        {/* Header with actions */}
        <div className="pipeline-table-header">
          <h2 className="pipeline-table-title">
            {activeTab || 'Pipeline'}
          </h2>
          
          <div className="pipeline-table-actions">
            {/* Search */}
            <div className="pipeline-search">
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search recruits..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Add Recruit Button */}
            <button
              className="pipeline-btn pipeline-btn-primary"
              onClick={() => setShowAddRecruitModal(true)}
              title="Add New Recruit"
            >
              <FiPlus style={{ marginRight: '6px' }} />
              Add Recruit
            </button>
            
            {/* Team toggle for managers */}
            {canViewTeam && (
              <button
                className={`pipeline-btn ${showTeam ? 'pipeline-btn-primary' : ''}`}
                onClick={() => setShowTeam(!showTeam)}
              >
                {showTeam ? 'Team View' : 'Personal View'}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            className="pipeline-stage-tabs"
          />
        )}

        {/* Sub-tabs for checklist items */}
        {activeTab && stageChecklistItems.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 20px',
            borderBottom: '1px solid #dfe4ea',
            backgroundColor: '#f8f9fa',
            overflowX: 'auto',
            flexWrap: 'wrap'
          }}>
            {subTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveSubTab(tab.key)}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: activeSubTab === tab.key ? '600' : '500',
                  color: activeSubTab === tab.key ? '#00558c' : '#666',
                  backgroundColor: activeSubTab === tab.key ? '#fff' : 'transparent',
                  border: activeSubTab === tab.key ? '2px solid #00558c' : '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  if (activeSubTab !== tab.key) {
                    e.target.style.backgroundColor = '#fff';
                    e.target.style.borderColor = '#999';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSubTab !== tab.key) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.borderColor = '#ddd';
                  }
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  backgroundColor: activeSubTab === tab.key ? '#00558c' : '#ddd',
                  color: activeSubTab === tab.key ? '#fff' : '#666'
                }}>
                  {tab.badge}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* DataTable */}
        {loading ? (
          <div className="pipeline-loading" style={{ padding: '40px' }}>
            <div className="pipeline-loading-spinner"></div>
            <span style={{ marginLeft: 12 }}>Loading recruits...</span>
          </div>
        ) : filteredBySubTab.length > 0 ? (
          <DataTable
            columns={columns}
            data={filteredBySubTab}
            onCellUpdate={handleCellUpdate}
            entityName="recruit"
            onRowClick={(row) => handleOpenChecklist(row)}
          />
        ) : currentStageRecruits.length > 0 ? (
          <div className="pipeline-empty">
            <h3>No recruits need this item</h3>
            <p>
              {activeSubTab === 'all'
                ? 'Try adjusting your search criteria'
                : 'All recruits in this stage have either completed this item or haven\'t finished the previous steps yet.'
              }
            </p>
          </div>
        ) : (
          <div className="pipeline-empty">
            <h3>No recruits in this stage</h3>
            <p>
              {searchTerm 
                ? 'Try adjusting your search criteria'
                : 'Recruits will appear here when they enter this stage'
              }
            </p>
          </div>
        )}
      </div>

      {/* RightDetails Panel for Checklist */}
      {showRightDetails && rightDetailsData && (
        <RightDetails
          fromPage="Pipeline"
          data={rightDetailsData}
          onClose={handleCloseChecklist}
          onSave={() => fetchData()} // Refresh on save
        />
      )}

      {/* Add Recruit Modal */}
      <AddRecruitModal
        isOpen={showAddRecruitModal}
        onClose={() => setShowAddRecruitModal(false)}
        onRecruitAdded={handleRecruitAdded}
        initialStage={activeTab || 'Careers Form'}
        stages={stages}
      />
    </div>
  );
};

export default PipelineProgress;

