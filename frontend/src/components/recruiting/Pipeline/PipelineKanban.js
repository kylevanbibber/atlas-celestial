import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useUserHierarchy } from '../../../hooks/useUserHierarchy';
import api from '../../../api';
import { FiSearch, FiPlus, FiMail, FiPhone, FiUser, FiCheckCircle, FiClock, FiCheck } from 'react-icons/fi';
import AddRecruitModal from './AddRecruitModal';
import RightDetails from '../../utils/RightDetails';
import toast from 'react-hot-toast';
import './PipelineKanban.css';

const PipelineKanban = ({ kpiFilter }) => {
  const { user } = useAuth();
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  
  const [stages, setStages] = useState([]);
  const [recruits, setRecruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTeam, setShowTeam] = useState(true); // Default to team view for managers
  const [showAddRecruitModal, setShowAddRecruitModal] = useState(false);
  const [showRightDetails, setShowRightDetails] = useState(false);
  const [rightDetailsData, setRightDetailsData] = useState(null);
  const [globalSort, setGlobalSort] = useState('oldest-added');
  const [globalFilter, setGlobalFilter] = useState('all');
  const [stageChecklistItems, setStageChecklistItems] = useState({}); // { stageName: [items] }
  const [recruitProgress, setRecruitProgress] = useState({}); // { recruitId: [progress] }
  const [justCheckedInIds, setJustCheckedInIds] = useState(new Set()); // Track recently checked-in recruits for animation
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [activeFilters, setActiveFilters] = useState({
    needsCheckin: null,
    recruitedBy: {},
    codedTo: {},
    checklistItems: {}
  });
  const [sortConfig, setSortConfig] = useState({ key: 'date_added', direction: 'asc' });
  
  const isAgent = user?.clname === 'AGT';
  const isManager = ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);
  const isAdmin = user?.Role === 'Admin';
  const canViewTeam = isManager || isAdmin;
  
  const hierarchyIds = useMemo(() => {
    if (isAdmin || !canViewTeam) return [];
    return getHierarchyForComponent('ids');
  }, [isAdmin, canViewTeam, getHierarchyForComponent]);

  const getUserIds = () => {
    if (isAgent) return [user.userId];
    if (canViewTeam && showTeam) return [...hierarchyIds, user.userId];
    return [user.userId];
  };

  useEffect(() => {
    fetchStages();
  }, []);

  useEffect(() => {
    // Don't fetch until user is loaded
    if (!user?.userId) return;
    
    // If hierarchy is still loading, wait
    if (hierarchyLoading) return;
    
    // If we're in team view and need hierarchy data, wait until it's ready
    if (canViewTeam && showTeam && hierarchyIds.length === 0 && !isAdmin) {
      console.log('[Pipeline Kanban] Waiting for hierarchy data before fetching...');
      return;
    }
    
    fetchData();
  }, [user?.userId, showTeam, hierarchyLoading, hierarchyIds, canViewTeam, isAdmin]);

  // Fetch checklist items and progress when stages or recruits change
  useEffect(() => {
    if (stages.length > 0 && recruits.length > 0) {
      fetchChecklistData();
    }
  }, [stages, recruits]);

  const buildStageOrder = (stageList) => {
    const pipelineStages = stageList.filter(s => !s.is_terminal);
    let currentStage = pipelineStages.find(s => s.position_after === null);
    
    if (!currentStage) {
      console.warn('[PipelineKanban] No starting stage found, using first stage');
      return pipelineStages;
    }
    
    const orderedStages = [];
    const visited = new Set();
    
    while (currentStage && !visited.has(currentStage.stage_name)) {
      orderedStages.push(currentStage);
      visited.add(currentStage.stage_name);
      currentStage = pipelineStages.find(s => 
        s.position_after === currentStage.stage_name && 
        !visited.has(s.stage_name)
      );
    }
    
    pipelineStages.forEach(stage => {
      if (!visited.has(stage.stage_name)) {
        console.warn(`[PipelineKanban] Stage "${stage.stage_name}" not in chain, appending to end`);
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
      }
    } catch (error) {
      console.error('Error fetching stages:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      let recruitsResponse;
      if (isAdmin) {
        recruitsResponse = await api.get('/recruitment/recruits');
      } else {
        const userIds = getUserIds();
        if (userIds.length === 1) {
          recruitsResponse = await api.get(`/recruitment/recruits/agent/${userIds[0]}`);
        } else {
          recruitsResponse = await api.post('/recruitment/recruits/team', { userIds });
        }
      }
      
      setRecruits(Array.isArray(recruitsResponse.data) ? recruitsResponse.data : []);
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
      setRecruits([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to parse date strings (must be before useMemo hooks that use it)
  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    
    // Database stores in EST, treat as local time (no 'Z' suffix)
    let isoString = dateStr;
    if (!isoString.includes('T')) {
      isoString = dateStr.replace(' ', 'T');
    }
    // Do NOT add 'Z' - the timestamp is in EST, not UTC
    
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;
    
    return date;
  };

  const filteredRecruits = useMemo(() => {
    let filtered = recruits;
    
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
    
    // Apply KPI filter
    if (kpiFilter === 'needs-aob') {
      // Filter for recruits in Licensing or Onboarding without AOB completed and aob is null
      filtered = filtered.filter(r => {
        // Check if redeemed (backend only counts unredeemed)
        if (r.pipeline_redeemed === 1 || r.pipeline_redeemed === '1') {
          return false;
        }
        
        // Check stage
        if (!['Licensing', 'Onboarding'].includes(r.step)) {
          return false;
        }
        
        // Check if aob field has value
        if (r.aob && r.aob !== '') {
          return false;
        }
        
        // Check if AOB completed checklist item exists and is completed
        const progress = recruitProgress[r.id] || [];
        const aobItem = Object.values(stageChecklistItems).flat().find(item => 
          item.item_name.toLowerCase().includes('aob') && item.item_name.toLowerCase().includes('completed')
        );
        
        if (aobItem) {
          const aobProgress = progress.find(p => p.checklist_item_id === aobItem.id);
          if (aobProgress?.completed === 1) return false;
        }
        
        return true;
      });
    } else if (kpiFilter === 'needs-checkin') {
      // Filter for recruits that need check-in (3+ days)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      filtered = filtered.filter(r => {
        // Check if redeemed (backend only counts unredeemed)
        if (r.pipeline_redeemed === 1 || r.pipeline_redeemed === '1') {
          return false;
        }
        
        // Only consider recruits in active stages
        if (!['Licensing', 'Onboarding', 'Training'].includes(r.step)) {
          return false;
        }
        
        // Exclude recruits added within the last 2 days
        if (r.date_added) {
          const dateAdded = new Date(r.date_added);
          if (dateAdded > twoDaysAgo) {
            return false;
          }
        }
        
        // No check-in date = needs check-in
        if (!r.last_checkin_sent) {
          return true;
        }
        
        const lastCheckin = new Date(r.last_checkin_sent);
        return lastCheckin < threeDaysAgo;
      });
      
    } else if (kpiFilter === 'completed-this-week') {
      // Filter for recruits who completed checklist items this week
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Go back to Sunday
      startOfWeek.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(r => {
        const progress = recruitProgress[r.id] || [];
        
        if (progress.length === 0) {
          return false;
        }
        
        // Check if any checklist item was completed this week
        return progress.some(p => {
          if (!p.completed || p.completed !== 1) return false;
          if (!p.completed_at) return false;
          
          const completedDate = new Date(p.completed_at);
          return completedDate >= startOfWeek;
        });
      });
    }
    
    return filtered;
  }, [recruits, searchTerm, kpiFilter, recruitProgress, stageChecklistItems]);

  const getRecruitsForStage = useMemo(() => (stageName) => {
    // Only include recruits that belong to valid stages
    const validStageNames = new Set(stages.map(s => s.stage_name));
    let stageRecruits = filteredRecruits.filter(r => r.step === stageName && validStageNames.has(r.step));
    
    // Apply global filter
    if (globalFilter === 'needs-checkin') {
      // Filter for recruits who haven't been checked in within 3 days
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      stageRecruits = stageRecruits.filter(r => {
        if (!r.last_checkin_date) return true; // No check-in at all
        const lastCheckin = parseDateString(r.last_checkin_date);
        return lastCheckin && lastCheckin < threeDaysAgo;
      });
    } else if (globalFilter.startsWith('recruited-by:')) {
      const recruiterName = globalFilter.replace('recruited-by:', '');
      stageRecruits = stageRecruits.filter(r => r.lagnname === recruiterName);
    } else if (globalFilter.startsWith('coded-to:')) {
      const codedTo = globalFilter.replace('coded-to:', '');
      stageRecruits = stageRecruits.filter(r => r.coded_to === codedTo);
    } else if (globalFilter.startsWith('item-')) {
      // Filter by checklist item
      const itemId = parseInt(globalFilter.replace('item-', ''));
      const items = stageChecklistItems[stageName] || [];
      const selectedItemIndex = items.findIndex(item => item.id === itemId);
      
      if (selectedItemIndex !== -1) {
        const previousItems = items.slice(0, selectedItemIndex);
        
        stageRecruits = stageRecruits.filter(recruit => {
          const progress = recruitProgress[recruit.id] || [];
          
          // Check if current item is NOT completed
          const currentItemProgress = progress.find(p => p.checklist_item_id === itemId);
          const currentItemCompleted = currentItemProgress?.completed === 1;
          
          if (currentItemCompleted) return false;
          
          // Check if all previous items are completed
          const allPreviousCompleted = previousItems.every(prevItem => {
            const prevProgress = progress.find(p => p.checklist_item_id === prevItem.id);
            return prevProgress?.completed === 1;
          });
          
          return allPreviousCompleted;
        });
      }
    }
    
    // Apply global sort
    const sortType = globalSort;
    
    stageRecruits.sort((a, b) => {
      if (sortType === 'a-z') {
        const nameA = `${a.recruit_first} ${a.recruit_last}`.toLowerCase();
        const nameB = `${b.recruit_first} ${b.recruit_last}`.toLowerCase();
        return nameA.localeCompare(nameB);
      } else if (sortType === 'z-a') {
        const nameA = `${a.recruit_first} ${a.recruit_last}`.toLowerCase();
        const nameB = `${b.recruit_first} ${b.recruit_last}`.toLowerCase();
        return nameB.localeCompare(nameA);
      } else if (sortType === 'oldest-added') {
        const dateA = parseDateString(a.date_added) || new Date(0);
        const dateB = parseDateString(b.date_added) || new Date(0);
        return dateA - dateB;
      } else if (sortType === 'newest-added') {
        const dateA = parseDateString(a.date_added) || new Date(0);
        const dateB = parseDateString(b.date_added) || new Date(0);
        return dateB - dateA;
      } else if (sortType === 'needs-checkin' || sortType === 'oldest-checkin') {
        // Sort by last check-in date (oldest first, nulls first)
        const dateA = parseDateString(a.last_checkin_date) || new Date(0);
        const dateB = parseDateString(b.last_checkin_date) || new Date(0);
        return dateA - dateB;
      } else if (sortType === 'newest-checkin') {
        // Sort by last check-in date (newest first, nulls last)
        const dateA = parseDateString(a.last_checkin_date) || new Date('9999-12-31');
        const dateB = parseDateString(b.last_checkin_date) || new Date('9999-12-31');
        return dateB - dateA;
      }
      return 0;
    });
    
    return stageRecruits;
  }, [filteredRecruits, stages, globalSort, globalFilter, stageChecklistItems, recruitProgress]);


  const handleCardClick = (recruit) => {
    const detailsData = {
      recruit,
      stages,
      __isPipelineChecklist: true
    };
    setRightDetailsData(detailsData);
    setShowRightDetails(true);
  };

  const handleCloseChecklist = () => {
    setShowRightDetails(false);
    setRightDetailsData(null);
    fetchData();
  };

  const handleRecruitAdded = (newRecruit) => {
    fetchData();
  };

  const handleCheckIn = async (e, recruit) => {
    e.stopPropagation(); // Prevent card click
    
    try {
      const response = await api.post(`/check-in-texts/manual/${recruit.id}`, {});
      
      if (response.data.success) {
        toast.success('Check-in logged!');
        
        // Get the current timestamp in the same format as backend
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const formattedNow = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        
        // Add to recently checked-in set for highlight animation
        setJustCheckedInIds(prev => new Set(prev).add(recruit.id));
        
        // Update the recruit in local state with new check-in data (preserve object reference for stability)
        setRecruits(prevRecruits => 
          prevRecruits.map(r => 
            r.id === recruit.id 
              ? {
                  ...r,
                  last_checkin_date: formattedNow,
                  last_checkin_type: 'manual',
                  last_checkin_by_name: user?.lagnname || null
                }
              : r
          )
        );
        
        // Remove from highlighted set after animation completes
        setTimeout(() => {
          setJustCheckedInIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(recruit.id);
            return newSet;
          });
        }, 1000); // Match animation duration
        
        // Note: The card will automatically reposition due to the sort logic in getRecruitsForStage
      }
    } catch (error) {
      console.error('Error logging check-in:', error);
      toast.error('Failed to log check-in');
    }
  };

  const fetchChecklistData = async () => {
    try {
      const stageItems = {};
      const allProgress = {};
      
      for (const stage of stages) {
        const stageRecruits = recruits.filter(r => r.step === stage.stage_name);
        const recruitIds = stageRecruits.map(r => r.id);
        
        if (recruitIds.length === 0) continue;
        
        // Fetch checklist items for this stage
        const itemsResponse = await api.get(`/recruitment/stages/${encodeURIComponent(stage.stage_name)}/checklist-items`, {
          params: { recruitIds: recruitIds.join(',') }
        });
        
        if (itemsResponse.data.success) {
          stageItems[stage.stage_name] = itemsResponse.data.data || [];
        }
        
        // Fetch progress for recruits in this stage
        const progressResponse = await api.post('/recruitment/recruits/checklist/bulk', {
          recruitIds
        });
        
        if (progressResponse.data.success) {
          Object.assign(allProgress, progressResponse.data.data || {});
        }
      }
      
      setStageChecklistItems(stageItems);
      setRecruitProgress(allProgress);
    } catch (error) {
      console.error('Error fetching checklist data:', error);
    }
  };

  const formatDate = (dateStr) => {
    const date = parseDateString(dateStr);
    if (!date) return '';
    return date.toLocaleDateString();
  };

  const formatDateTime = (dateStr) => {
    const date = parseDateString(dateStr);
    if (!date) return '';
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getTimeSince = (dateStr) => {
    const date = parseDateString(dateStr);
    if (!date) return null;
    
    const now = new Date();
    let diffMs = now - date;
    
    // Clamp negative differences to 0
    if (diffMs < 0) {
      diffMs = 0;
    }
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  // Don't render DragDropContext until both stages and recruits are loaded
  if (loading || stages.length === 0) {
    return (
      <div className="pipeline-kanban-loading">
        <div className="pipeline-loading-spinner"></div>
        <span style={{ marginLeft: 12 }}>Loading pipeline...</span>
      </div>
    );
  }

  return (
    <div className="pipeline-kanban-container">
      {/* Header */}
      <div className="pipeline-kanban-header">
        <div className="pipeline-search">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search recruits..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="pipeline-kanban-controls">
          {/* Sort Dropdown */}
          <select
            className="kanban-control-select"
            value={globalSort}
            onChange={(e) => setGlobalSort(e.target.value)}
            title="Sort by"
          >
            <option value="oldest-added">⏰ Oldest Added</option>
            <option value="newest-added">🆕 Newest Added</option>
            <option value="oldest-checkin">⏰ Oldest Check-in</option>
            <option value="newest-checkin">✅ Newest Check-in</option>
            <option value="needs-checkin">🔔 Needs Check-in</option>
            <option value="a-z">🔤 A → Z</option>
            <option value="z-a">🔤 Z → A</option>
          </select>
          
          {/* Filter Dropdown */}
          <select
            className="kanban-control-select"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            title="Filter by"
          >
            <option value="all">All Recruits</option>
            <option value="needs-checkin">🔔 Needs Check-in (3+ days)</option>
            
            {/* Recruited By Options */}
            {recruits.length > 0 && Array.from(new Set(recruits.map(r => r.lagnname).filter(Boolean))).length > 0 && (
              <optgroup label="Recruited By">
                {Array.from(new Set(recruits.map(r => r.lagnname).filter(Boolean))).map(name => (
                  <option key={`recruited-${name}`} value={`recruited-by:${name}`}>
                    {name}
                  </option>
                ))}
              </optgroup>
            )}
            
            {/* Coded To Options */}
            {recruits.length > 0 && Array.from(new Set(recruits.map(r => r.coded_to).filter(Boolean))).length > 0 && (
              <optgroup label="Coded To">
                {Array.from(new Set(recruits.map(r => r.coded_to).filter(Boolean))).map(coded => (
                  <option key={`coded-${coded}`} value={`coded-to:${coded}`}>
                    {coded}
                  </option>
                ))}
              </optgroup>
            )}
            
            {/* Checklist Items */}
            {Object.entries(stageChecklistItems).map(([stageName, items]) => (
              items.length > 0 && (
                <optgroup key={stageName} label={stageName}>
                  {items.map(item => (
                    <option key={item.id} value={`item-${item.id}`}>
                      {item.item_name}
                    </option>
                  ))}
                </optgroup>
              )
            ))}
          </select>
        </div>
        
        <div className="pipeline-kanban-actions">
          <button
            onClick={() => setShowTutorial(true)}
            className="pipeline-help-btn"
            title="How to use Kanban view"
          >
            ?
          </button>
          
          <button
            className="pipeline-btn pipeline-btn-primary"
            onClick={() => setShowAddRecruitModal(true)}
          >
            <FiPlus style={{ marginRight: '6px' }} />
            Add Recruit
          </button>
          
          {canViewTeam && (
            <button
              className={`pipeline-btn ${showTeam ? 'pipeline-btn-primary' : ''}`}
              onClick={() => setShowTeam(!showTeam)}
              title={showTeam ? 'Currently viewing team data' : 'Currently viewing personal data'}
            >
              {showTeam ? '👥 Team View' : '👤 Personal View'}
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      {stages.length > 0 && (
        <div className="pipeline-kanban-board">
          {stages.map(stage => {
            const stageRecruits = getRecruitsForStage(stage.stage_name);
          
          return (
            <div key={stage.stage_name} className="pipeline-kanban-column">
              <div 
                className="pipeline-kanban-column-header"
                style={{ borderTopColor: stage.stage_color }}
              >
                <h3>{stage.stage_name}</h3>
                <span className="pipeline-kanban-count">{stageRecruits.length}</span>
              </div>
              
              <div className="pipeline-kanban-column-content">
                {stageRecruits.map((recruit) => (
                  <div
                    key={recruit.id}
                    className={`pipeline-kanban-card ${justCheckedInIds.has(recruit.id) ? 'just-checked-in' : ''}`}
                    onClick={() => handleCardClick(recruit)}
                  >
                              <div className="kanban-card-header">
                                <h4>
                                  {recruit.recruit_first} {recruit.recruit_last}
                                </h4>
                              </div>
                              
                              {/* Current Task */}
                              {recruit.current_task_name && (
                                <div className="kanban-card-current-task">
                                  <FiCheckCircle size={12} />
                                  <span className="task-label">Next:</span>
                                  <span className="task-name">{recruit.current_task_name}</span>
                                </div>
                              )}
                              
                              {recruit.phone && (
                                <div className="kanban-card-detail">
                                  <FiPhone size={12} />
                                  <span>{recruit.phone}</span>
                                </div>
                              )}
                              
                              {recruit.email && (
                                <div className="kanban-card-detail">
                                  <FiMail size={12} />
                                  <span>{recruit.email}</span>
                                </div>
                              )}
                              
                              {recruit.resident_state && (
                                <div className="kanban-card-detail">
                                  <span className="kanban-card-state">{recruit.resident_state}</span>
                                </div>
                              )}
                              
                              {/* Last Check-in */}
                              <div className="kanban-card-checkin">
                                {recruit.last_checkin_date ? (
                                  <div className="checkin-info">
                                    <div className="checkin-main">
                                      <FiClock size={11} />
                                      <span className="checkin-type">
                                        {recruit.last_checkin_type === 'automated' ? 'Auto' : 'Manual'}
                                      </span>
                                      <span className="checkin-time">{getTimeSince(recruit.last_checkin_date)}</span>
                                    </div>
                                    {recruit.last_checkin_by_name && (
                                      <div className="checkin-by">by {recruit.last_checkin_by_name}</div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="checkin-info no-checkin">
                                    <FiClock size={11} />
                                    <span>No check-in</span>
                                  </div>
                                )}
                                <button
                                  className="checkin-btn"
                                  onClick={(e) => handleCheckIn(e, recruit)}
                                  title="Mark as checked in"
                                >
                                  <FiCheck size={16} />
                                </button>
                              </div>
                              
                              {recruit.lagnname && (
                                <div className="kanban-card-footer">
                                  <FiUser size={12} />
                                  <span>{recruit.lagnname}</span>
                                </div>
                              )}
                              
                              <div className="kanban-card-date">
                                Added {formatDate(recruit.date_added)}
                              </div>
                            </div>
                ))}
                
                {stageRecruits.length === 0 && !loading && (
                  <div className="pipeline-kanban-empty">
                    <p>No recruits</p>
                  </div>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}

      {/* Add Recruit Modal */}
      <AddRecruitModal
        isOpen={showAddRecruitModal}
        onClose={() => setShowAddRecruitModal(false)}
        onRecruitAdded={handleRecruitAdded}
        initialStage={stages[0]?.stage_name || 'Careers Form'}
        stages={stages}
      />

      {/* RightDetails Panel for Checklist */}
      {showRightDetails && rightDetailsData && (
        <RightDetails
          fromPage="Pipeline"
          data={rightDetailsData}
          onClose={handleCloseChecklist}
          onSave={fetchData}
        />
      )}

      {/* Interactive Tutorial Overlay */}
      {showTutorial && (() => {
        const tutorialSteps = [
          {
            title: "Welcome to Kanban View!",
            description: "Let's take a quick tour of the kanban board. This view helps you visualize and manage your recruiting pipeline. Click 'Next' to continue.",
            target: null,
            position: 'center'
          },
          {
            title: "Sort & Filter Controls",
            description: "Use the dropdowns in the header to sort and filter all recruits across all columns. Sort by date added, check-in status, or alphabetically. Filter by check-in needs or specific checklist items.",
            target: '.pipeline-kanban-controls',
            position: 'bottom'
          },
          {
            title: "Pipeline Columns",
            description: "Each column represents a stage in your recruiting pipeline. Recruits flow from left to right as they progress through the stages.",
            target: '.pipeline-kanban-column',
            position: 'bottom'
          },
          {
            title: "Recruit Cards",
            description: "Each card shows a recruit's information, their next task, and last check-in status. Click any card to see full details and manage their checklist.",
            target: '.pipeline-kanban-card',
            position: 'left'
          },
          {
            title: "Check-in Button",
            description: "Click the green checkmark to quickly log that you've checked in with this recruit. The card will update immediately with the new check-in time.",
            target: '.checkin-btn',
            position: 'left'
          },
          {
            title: "You're All Set!",
            description: "You're ready to use the kanban view! Remember, you can always click the ? button in the header to see this tour again.",
            target: null,
            position: 'center'
          }
        ];

        const currentStep = tutorialSteps[tutorialStep];
        let targetElement = null;
        let targetRect = null;

        if (currentStep.target) {
          targetElement = document.querySelector(currentStep.target);
          if (targetElement) {
            targetRect = targetElement.getBoundingClientRect();
          }
        }

        const isMobile = window.innerWidth < 768;

        const getTooltipPosition = () => {
          if (isMobile) {
            return {
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              transform: 'none',
              borderRadius: '16px 16px 0 0',
              maxWidth: '100%',
              margin: 0
            };
          }

          if (!targetRect || currentStep.position === 'center') {
            return {
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            };
          }

          const tooltipStyle = { position: 'fixed' };
          const offset = 20;
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;

          const spaceRight = viewportWidth - targetRect.right;
          const spaceLeft = targetRect.left;
          const spaceBottom = viewportHeight - targetRect.bottom;
          const spaceTop = targetRect.top;

          let position = currentStep.position;

          if (position === 'right' && spaceRight < 420) {
            position = spaceLeft > 420 ? 'left' : 'bottom';
          }
          if (position === 'left' && spaceLeft < 420) {
            position = spaceRight > 420 ? 'right' : 'bottom';
          }
          if (position === 'bottom' && spaceBottom < 300) {
            position = 'top';
          }
          if (position === 'top' && spaceTop < 300) {
            position = 'bottom';
          }

          switch (position) {
            case 'bottom':
              tooltipStyle.top = targetRect.bottom + offset;
              tooltipStyle.left = Math.max(16, Math.min(targetRect.left + (targetRect.width / 2), viewportWidth - 216));
              tooltipStyle.transform = 'translateX(-50%)';
              break;
            case 'top':
              tooltipStyle.bottom = viewportHeight - targetRect.top + offset;
              tooltipStyle.left = Math.max(16, Math.min(targetRect.left + (targetRect.width / 2), viewportWidth - 216));
              tooltipStyle.transform = 'translateX(-50%)';
              break;
            case 'right':
              tooltipStyle.top = targetRect.top + (targetRect.height / 2);
              tooltipStyle.left = targetRect.right + offset;
              tooltipStyle.transform = 'translateY(-50%)';
              break;
            case 'left':
              tooltipStyle.top = targetRect.top + (targetRect.height / 2);
              tooltipStyle.right = viewportWidth - targetRect.left + offset;
              tooltipStyle.transform = 'translateY(-50%)';
              break;
            default:
              tooltipStyle.top = '50%';
              tooltipStyle.left = '50%';
              tooltipStyle.transform = 'translate(-50%, -50%)';
          }

          return tooltipStyle;
        };

        const handleNext = () => {
          if (tutorialStep < tutorialSteps.length - 1) {
            setTutorialStep(tutorialStep + 1);
          } else {
            setShowTutorial(false);
            setTutorialStep(0);
          }
        };

        const handlePrev = () => {
          if (tutorialStep > 0) {
            setTutorialStep(tutorialStep - 1);
          }
        };

        const handleSkip = () => {
          setShowTutorial(false);
          setTutorialStep(0);
        };

        return (
          <>
            {/* Dark overlay */}
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                zIndex: 9998,
                pointerEvents: 'none'
              }}
            />

            {/* Highlight spotlight */}
            {targetRect && (
              <div
                style={{
                  position: 'fixed',
                  top: targetRect.top - 8,
                  left: Math.max(0, targetRect.left - 8),
                  width: Math.min(window.innerWidth, targetRect.width + 16),
                  height: targetRect.height + 16,
                  border: '3px solid #00558c',
                  borderRadius: 8,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 20px rgba(0, 85, 140, 0.5)',
                  zIndex: 9999,
                  pointerEvents: 'none',
                  animation: 'pulse 2s infinite'
                }}
              />
            )}

            {/* Tooltip */}
            <div
              style={{
                ...getTooltipPosition(),
                backgroundColor: 'var(--card-bg)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                padding: isMobile ? '20px' : '24px',
                maxWidth: isMobile ? '100%' : 400,
                width: isMobile ? '100%' : 'auto',
                zIndex: 10000,
                border: '2px solid #00558c',
                borderRadius: isMobile ? '16px 16px 0 0' : '8px'
              }}
            >
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#00558c',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Step {tutorialStep + 1} of {tutorialSteps.length}
              </div>

              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: 20,
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}>
                {currentStep.title}
              </h3>

              <p style={{
                margin: '0 0 20px 0',
                fontSize: 15,
                lineHeight: 1.6,
                color: 'var(--text-primary)'
              }}>
                {currentStep.description}
              </p>

              <div style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <button
                  onClick={handleSkip}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: 14,
                    cursor: 'pointer',
                    padding: '8px 12px',
                    textDecoration: 'underline'
                  }}
                >
                  Skip Tour
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  {tutorialStep > 0 && (
                    <button
                      onClick={handlePrev}
                      style={{
                        backgroundColor: 'transparent',
                        color: '#00558c',
                        border: '1px solid #00558c',
                        borderRadius: 6,
                        padding: '8px 16px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    style={{
                      backgroundColor: '#00558c',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 20px',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {tutorialStep === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
                  </button>
                </div>
              </div>
            </div>

            <style>{`
              @keyframes pulse {
                0%, 100% {
                  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 20px rgba(0, 85, 140, 0.5);
                }
                50% {
                  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 30px rgba(0, 85, 140, 0.8);
                }
              }
            `}</style>
          </>
        );
      })()}
    </div>
  );
};

export default PipelineKanban;

