import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useUserHierarchy } from '../../../hooks/useUserHierarchy';
import api from '../../../api';
import Tabs from '../../utils/Tabs';
import DataTable from '../../utils/DataTable';
import RightDetails from '../../utils/RightDetails';
import ContextMenu from '../../utils/ContextMenu';
import Modal from '../../utils/Modal';
import AddRecruitModal from './AddRecruitModal';
import ImportModal from '../../utils/ImportModal';
import SyncAppointmentsModal from './SyncAppointmentsModal';
import { FiSearch, FiPlus, FiUpload, FiFilter, FiMail, FiMessageSquare, FiChevronDown, FiRefreshCw, FiRepeat, FiSend } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import './Pipeline.css';

// Applicant step constants
const APPLICANT_STEPS = ['Careers Form', 'No Answer - Career Form', 'Callback - Career Form', 'Final', 'Not Interested'];

const APPLICANT_SUB_TABS = [
  { key: 'all', label: 'All' },
  { key: 'Careers Form', label: 'Applicants' },
  { key: 'No Answer - Career Form', label: 'No Answer' },
  { key: 'Callback - Career Form', label: 'Callback' },
  { key: 'Final', label: 'Booked Final' },
  { key: 'Not Interested', label: 'Not Interested' },
];

const PipelineProgress = ({
  stages, recruits, setRecruits, loading, showTeam, setShowTeam,
  stageChecklistItems: allStageChecklistItems, recruitProgress,
  refreshSingleRecruit, fetchData, onRecruitAdded,
  smsBalance, fetchSmsBalance, kpiFilter
}) => {
  const { user } = useAuth();
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const navigate = useNavigate();

  // View-specific state (not shared)
  const [activeTab, setActiveTab] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showRightDetails, setShowRightDetails] = useState(false);
  const [rightDetailsData, setRightDetailsData] = useState(null);
  const [showAddRecruitModal, setShowAddRecruitModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedRecruitIds, setSelectedRecruitIds] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncRecruitData, setSyncRecruitData] = useState(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignField, setReassignField] = useState('recruiting_agent');
  const [reassignTarget, setReassignTarget] = useState('');

  // Applicant-specific state
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [finalTimeModalVisible, setFinalTimeModalVisible] = useState(false);
  const [callbackTimeModalVisible, setCallbackTimeModalVisible] = useState(false);
  const [hiredModalVisible, setHiredModalVisible] = useState(false);
  const [finalDate, setFinalDate] = useState('');
  const [finalTime, setFinalTime] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [residentState, setResidentState] = useState('');
  const [enrolled, setEnrolled] = useState('');
  const [course, setCourse] = useState('');
  const [expectedCompleteDate, setExpectedCompleteDate] = useState('');

  // Whether the Applicants pseudo-tab is active
  const isApplicantsTab = activeTab === 'Applicants';

  // Determine user permissions
  const isAgent = user?.clname === 'AGT';
  const isManager = ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);
  const isAdmin = user?.Role === 'Admin';
  const canViewTeam = isManager || isAdmin;
  const canSyncAppointments = ['MGA', 'RGA', 'SGA'].includes(user?.clname);

  // Set initial active tab when stages load
  useEffect(() => {
    if (stages.length > 0 && !activeTab) {
      setActiveTab(stages[0].stage_name);
    }
  }, [stages]);

  // Derive checklist items for the active stage from parent's all-stages data
  const activeStageChecklistItems = useMemo(() => {
    return allStageChecklistItems[activeTab] || [];
  }, [allStageChecklistItems, activeTab]);

  // Get hierarchy IDs for filtering (used by fetchStats)
  const hierarchyIds = useMemo(() => {
    if (isAdmin || !canViewTeam) return [];
    return getHierarchyForComponent('ids');
  }, [isAdmin, canViewTeam, getHierarchyForComponent]);

  // Get team members for display in columns (used by recruiting agent / coded to dropdowns)
  // Combines hierarchy data + agents already visible in the recruits table
  const teamMembers = useMemo(() => {
    const hierarchy = getHierarchyForComponent('raw') || [];
    const uid = user?.userId || user?.id;
    const seen = new Set();
    const members = [];

    const add = (id, name) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      members.push({ id, lagnname: name });
    };

    // Current user first
    add(uid, user?.lagnname);
    // Hierarchy (downline)
    hierarchy.forEach(m => add(m.id, m.lagnname));
    // Agents already appearing in the pipeline data
    recruits.forEach(r => {
      if (r.recruiting_agent && r.lagnname) add(r.recruiting_agent, r.lagnname);
      if (r.code_to && r.coded_to_name) add(r.code_to, r.coded_to_name);
    });

    return members;
  }, [user, getHierarchyForComponent, recruits]);

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

  // Fetch stats when team view or hierarchy changes
  useEffect(() => {
    if (!user?.userId) return;
    if (hierarchyLoading) return;
    if (canViewTeam && showTeam && hierarchyIds.length === 0 && !isAdmin) return;
    fetchStats();
  }, [user?.userId, showTeam, hierarchyLoading, hierarchyIds, canViewTeam, isAdmin]);

  // Fetch stats only (lightweight — just stage counts)
  const fetchStats = async () => {
    try {
      let statsResponse;
      if (isAdmin) {
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
      console.error('Error fetching stats:', error);
    }
  };


  // Apply KPI filter to all recruits first
  const kpiFilteredRecruits = useMemo(() => {
    let filtered = recruits;
    
    if (kpiFilter === 'needs-aob') {
      console.log('[PipelineProgress] 🔍 Filtering for "Needs AOB Sent"');
      console.log('[PipelineProgress] Total recruits before filter:', recruits.length);
      
      // Track filter criteria
      let redeemedCount = 0;
      let inCorrectStage = 0;
      let hasAobField = 0;
      let aobChecklistCompleted = 0;
      let passedFilter = 0;
      
      // Filter for recruits in Licensing or Onboarding without AOB completed and aob is null
      filtered = filtered.filter(r => {
        // Check if redeemed (backend only counts unredeemed)
        if (r.pipeline_redeemed === 1 || r.pipeline_redeemed === '1') {
          redeemedCount++;
          return false;
        }
        
        // Check stage
        if (!['Licensing', 'Onboarding'].includes(r.step)) {
          return false;
        }
        inCorrectStage++;
        
        // Check if aob field has value
        if (r.aob && r.aob !== '') {
          hasAobField++;
          return false;
        }
        
        // Check if AOB completed checklist item exists and is completed
        const progress = recruitProgress[r.id] || [];
        // Look for AOB item across all stages using parent's checklist data
        const aobItem = Object.values(allStageChecklistItems).flat().find(item =>
          item.item_name.toLowerCase().includes('aob') && item.item_name.toLowerCase().includes('completed')
        );
        
        if (aobItem) {
          const aobProgress = progress.find(p => p.checklist_item_id === aobItem.id);
          if (aobProgress?.completed === 1) {
            aobChecklistCompleted++;
            return false;
          }
        }
        
        passedFilter++;
        return true;
      });
      
      console.log('[PipelineProgress] 📊 Filter Results:');
      console.log('  - Excluded (already redeemed):', redeemedCount);
      console.log('  - In Licensing or Onboarding stage (unredeemed):', inCorrectStage);
      console.log('  - Excluded (has AOB field value):', hasAobField);
      console.log('  - Excluded (AOB checklist completed):', aobChecklistCompleted);
      console.log('  - ✅ PASSED FILTER (Needs AOB):', passedFilter);
      console.log('[PipelineProgress] Filtered recruits:', filtered.map(r => ({
        id: r.id,
        name: `${r.recruit_first} ${r.recruit_last}`,
        stage: r.step,
        aob: r.aob,
        last_checkin: r.last_checkin_sent
      })));
      
    } else if (kpiFilter === 'needs-checkin') {
      console.log('[PipelineProgress] 🔍 Filtering for "Needs Check-in"');
      console.log('[PipelineProgress] Total recruits before filter:', recruits.length);
      
      // Track filter criteria
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      console.log('[PipelineProgress] 📅 Three days ago cutoff:', threeDaysAgo.toLocaleString());
      console.log('[PipelineProgress] 📅 Two days ago cutoff (for new recruits):', twoDaysAgo.toLocaleString());
      
      let redeemedCount = 0;
      let inActiveStage = 0;
      let tooNewCount = 0;
      let noCheckinDate = 0;
      let checkinTooRecent = 0;
      let passedFilter = 0;
      
      filtered = filtered.filter(r => {
        // Check if redeemed (backend only counts unredeemed)
        if (r.pipeline_redeemed === 1 || r.pipeline_redeemed === '1') {
          redeemedCount++;
          return false;
        }
        
        // Only consider recruits in active stages
        if (!['Licensing', 'Onboarding', 'Training'].includes(r.step)) {
          return false;
        }
        inActiveStage++;
        
        // Exclude recruits added within the last 2 days
        if (r.date_added) {
          const dateAdded = new Date(r.date_added);
          if (dateAdded > twoDaysAgo) {
            tooNewCount++;
            return false;
          }
        }
        
        // No check-in date = needs check-in
        if (!r.last_checkin_sent) {
          noCheckinDate++;
          passedFilter++;
          return true;
        }
        
        const lastCheckin = new Date(r.last_checkin_sent);
        const needsCheckin = lastCheckin < threeDaysAgo;
        
        if (needsCheckin) {
          passedFilter++;
        } else {
          checkinTooRecent++;
        }
        
        return needsCheckin;
      });
      
      console.log('[PipelineProgress] 📊 Filter Results:');
      console.log('  - Excluded (already redeemed):', redeemedCount);
      console.log('  - In active stages (Licensing/Onboarding/Training, unredeemed):', inActiveStage);
      console.log('  - Excluded (added within last 2 days):', tooNewCount);
      console.log('  - No check-in date recorded:', noCheckinDate);
      console.log('  - Excluded (checked in within 3 days):', checkinTooRecent);
      console.log('  - ✅ PASSED FILTER (Needs Check-in):', passedFilter);
      console.log('[PipelineProgress] Filtered recruits:', filtered.map(r => ({
        id: r.id,
        name: `${r.recruit_first} ${r.recruit_last}`,
        stage: r.step,
        last_checkin: r.last_checkin_sent,
        days_since_checkin: r.last_checkin_sent 
          ? Math.floor((new Date() - new Date(r.last_checkin_sent)) / (1000 * 60 * 60 * 24))
          : 'Never'
      })));
      
    } else if (kpiFilter === 'completed-this-week') {
      console.log('[PipelineProgress] 🔍 Filtering for "Completed This Week"');
      console.log('[PipelineProgress] Total recruits before filter:', recruits.length);
      
      // Get start of this week (Sunday)
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Go back to Sunday
      startOfWeek.setHours(0, 0, 0, 0);
      
      console.log('[PipelineProgress] 📅 Start of week cutoff:', startOfWeek.toLocaleString());
      
      let hasProgress = 0;
      let completedThisWeek = 0;
      
      filtered = filtered.filter(r => {
        const progress = recruitProgress[r.id] || [];
        
        if (progress.length === 0) {
          return false;
        }
        hasProgress++;
        
        // Check if any checklist item was completed this week
        const hasCompletedThisWeek = progress.some(p => {
          if (!p.completed || p.completed !== 1) return false;
          if (!p.completed_at) return false;
          
          const completedDate = new Date(p.completed_at);
          return completedDate >= startOfWeek;
        });
        
        if (hasCompletedThisWeek) {
          completedThisWeek++;
          return true;
        }
        
        return false;
      });
      
      console.log('[PipelineProgress] 📊 Filter Results:');
      console.log('  - Recruits with progress:', hasProgress);
      console.log('  - ✅ PASSED FILTER (Completed This Week):', completedThisWeek);
      console.log('[PipelineProgress] Filtered recruits:', filtered.map(r => {
        const progress = recruitProgress[r.id] || [];
        const completedItems = progress.filter(p => {
          if (!p.completed || p.completed !== 1 || !p.completed_at) return false;
          const completedDate = new Date(p.completed_at);
          return completedDate >= startOfWeek;
        });
        
        return {
          id: r.id,
          name: `${r.recruit_first} ${r.recruit_last}`,
          stage: r.step,
          completedCount: completedItems.length,
          completedItems: completedItems.map(ci => ({
            name: ci.item_name,
            completedAt: ci.completed_at
          }))
        };
      }));
    }
    
    return filtered;
  }, [recruits, kpiFilter, recruitProgress, allStageChecklistItems]);

  // Get recruits for current stage from KPI-filtered data
  const currentStageRecruits = useMemo(() => {
    if (!activeTab) return [];

    let filtered;
    if (isApplicantsTab) {
      // Applicants tab: show recruits in applicant steps
      filtered = kpiFilteredRecruits.filter(r => APPLICANT_STEPS.includes(r.step));
    } else {
      // Regular stage tab
      filtered = kpiFilteredRecruits.filter(r => r.step === activeTab);
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
  }, [kpiFilteredRecruits, activeTab, isApplicantsTab, searchTerm]);

  // Filter recruits by sub-tab (checklist item completion status OR applicant step)
  const filteredBySubTab = useMemo(() => {
    if (activeSubTab === 'all') {
      return currentStageRecruits;
    }

    // Applicants tab: sub-tabs filter by step name
    if (isApplicantsTab) {
      return currentStageRecruits.filter(r => r.step === activeSubTab);
    }

    // Pipeline stage tabs: sub-tabs filter by checklist item completion
    const selectedItemId = parseInt(activeSubTab);
    const selectedItemIndex = activeStageChecklistItems.findIndex(item => item.id === selectedItemId);

    if (selectedItemIndex === -1) return currentStageRecruits;

    // Get all items before this one (in order)
    const previousItems = activeStageChecklistItems.slice(0, selectedItemIndex);

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
  }, [currentStageRecruits, activeSubTab, isApplicantsTab, recruitProgress, activeStageChecklistItems]);

  // Create sub-tabs for checklist items
  const subTabs = useMemo(() => {
    const tabs = [
      {
        key: 'all',
        label: 'All',
        badge: currentStageRecruits.length
      }
    ];

    activeStageChecklistItems.forEach((item, index) => {
      const previousItems = activeStageChecklistItems.slice(0, index);
      
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
  }, [activeStageChecklistItems, currentStageRecruits, recruitProgress]);

  // Reset sub-tab when active tab changes
  useEffect(() => {
    setActiveSubTab('all');
  }, [activeTab]);

  // Get count for each stage (using KPI-filtered recruits)
  const getStageCounts = useMemo(() => {
    const counts = {};
    stages.forEach(stage => {
      let stageRecruits = kpiFilteredRecruits.filter(r => r.step === stage.stage_name);
      
      // For On-boarding stage, count all recruits in this stage
      // (Previously filtered by activeuser status, but that was too restrictive)
      // if (stage.stage_name === 'On-boarding') {
      //   stageRecruits = stageRecruits.filter(r => 
      //     r.activeuser_active === 'y' && 
      //     r.activeuser_manager_active === 'y'
      //   );
      // }
      
      counts[stage.stage_name] = stageRecruits.length;
    });
    return counts;
  }, [stages, kpiFilteredRecruits]);

  // Count of recruits in applicant steps
  const applicantCount = useMemo(() => {
    return kpiFilteredRecruits.filter(r => APPLICANT_STEPS.includes(r.step)).length;
  }, [kpiFilteredRecruits]);

  // Applicant sub-tabs with counts
  const applicantSubTabs = useMemo(() => {
    if (!isApplicantsTab) return [];
    const allApplicants = kpiFilteredRecruits.filter(r => APPLICANT_STEPS.includes(r.step));
    return APPLICANT_SUB_TABS.map(tab => ({
      ...tab,
      badge: tab.key === 'all'
        ? allApplicants.length
        : allApplicants.filter(r => r.step === tab.key).length
    }));
  }, [isApplicantsTab, kpiFilteredRecruits]);

  // Handle moving recruit to different stage
  const handleMoveToStage = async (recruitId, newStage) => {
    try {
      // Optimistic local update
      setRecruits(prev => prev.map(r => r.id === recruitId ? { ...r, step: newStage } : r));
      await api.put(`/recruitment/recruits/${recruitId}/step`, { step: newStage });
      // Refresh single recruit + stats (stage counts changed)
      refreshSingleRecruit(recruitId);
      fetchStats();
    } catch (error) {
      console.error('Error moving recruit:', error);
      fetchData(); // Fallback to full reload on error
    }
  };

  // Applicant action handlers
  const handleApplicantQuickAction = (applicant, action) => {
    setSelectedApplicant(applicant);
    switch (action) {
      case 'booked-final':
        setFinalDate('');
        setFinalTime('');
        setFinalTimeModalVisible(true);
        break;
      case 'callback':
        setCallbackDate('');
        setCallbackTime('');
        setCallbackTimeModalVisible(true);
        break;
      case 'hired':
        setResidentState(applicant.resident_state || '');
        setEnrolled('');
        setCourse('');
        setExpectedCompleteDate('');
        setHiredModalVisible(true);
        break;
      case 'not-interested':
        handleMoveToStage(applicant.id, 'Not Interested');
        break;
      case 'no-answer':
        handleMoveToStage(applicant.id, 'No Answer - Career Form');
        break;
      default:
        break;
    }
  };

  const handleUpdateFinalTime = async () => {
    if (!selectedApplicant || !finalDate || !finalTime) return;
    try {
      const finalDateTime = `${finalDate} ${finalTime}`;
      if (selectedApplicant.__mass) {
        await Promise.all(
          selectedApplicant.ids.map(id =>
            api.put(`/recruitment/recruits/${id}/final-time`, { final_time: finalDateTime })
          )
        );
        await handleMassMoveToStep('Final');
      } else {
        await api.put(`/recruitment/recruits/${selectedApplicant.id}/final-time`, { final_time: finalDateTime });
        await handleMoveToStage(selectedApplicant.id, 'Final');
      }
      setFinalTimeModalVisible(false);
      setSelectedApplicant(null);
    } catch (error) {
      console.error('Error updating final time:', error);
      toast.error('Failed to update final time');
    }
  };

  const handleUpdateCallbackTime = async () => {
    if (!selectedApplicant || !callbackDate || !callbackTime) return;
    try {
      const callbackDateTime = `${callbackDate} ${callbackTime}`;
      if (selectedApplicant.__mass) {
        await Promise.all(
          selectedApplicant.ids.map(id =>
            api.put(`/recruitment/recruits/${id}/callback-time`, { callback_time: callbackDateTime })
          )
        );
        await handleMassMoveToStep('Callback - Career Form');
      } else {
        await api.put(`/recruitment/recruits/${selectedApplicant.id}/callback-time`, { callback_time: callbackDateTime });
        await handleMoveToStage(selectedApplicant.id, 'Callback - Career Form');
      }
      setCallbackTimeModalVisible(false);
      setSelectedApplicant(null);
    } catch (error) {
      console.error('Error updating callback time:', error);
      toast.error('Failed to update callback time');
    }
  };

  const handleSaveHiredInfo = async () => {
    if (!selectedApplicant) return;
    try {
      if (selectedApplicant.__mass) {
        await Promise.all(
          selectedApplicant.ids.map(id =>
            api.put(`/recruitment/recruits/${id}/pre-lic`, {
              resident_state: residentState,
              enrolled,
              course,
              expected_complete_date: expectedCompleteDate
            })
          )
        );
        toast.success(`Updated ${selectedApplicant.ids.length} recruit${selectedApplicant.ids.length > 1 ? 's' : ''}`);
        setSelectedRecruitIds([]);
        fetchData();
        fetchStats();
      } else {
        await api.put(`/recruitment/recruits/${selectedApplicant.id}/pre-lic`, {
          resident_state: residentState,
          enrolled,
          course,
          expected_complete_date: expectedCompleteDate
        });
        refreshSingleRecruit(selectedApplicant.id);
        fetchStats();
      }
      setHiredModalVisible(false);
      setSelectedApplicant(null);
    } catch (error) {
      console.error('Error saving hired info:', error);
      toast.error('Failed to save hired information');
    }
  };

  const handleOpenApplicantDetails = (recruit) => {
    const fullName = [recruit.recruit_first, recruit.recruit_middle, recruit.recruit_last, recruit.recruit_suffix].filter(Boolean).join(' ');
    const detailsData = {
      ...recruit,
      fullName,
      formattedDateAdded: recruit.date_added ? new Date(recruit.date_added).toLocaleString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true }) : '',
      __isApplicantDetails: true
    };
    setRightDetailsData(detailsData);
    setShowRightDetails(true);
  };

  const getApplicantContextMenuOptions = (applicant) => {
    const options = [
      { label: 'Book Final', onClick: () => handleApplicantQuickAction(applicant, 'booked-final') },
      { label: 'Schedule Callback', onClick: () => handleApplicantQuickAction(applicant, 'callback') },
      { label: 'Hired', onClick: () => handleApplicantQuickAction(applicant, 'hired') },
      { label: 'Not Interested', onClick: () => handleApplicantQuickAction(applicant, 'not-interested') },
      { label: 'No Answer', onClick: () => handleApplicantQuickAction(applicant, 'no-answer') },
    ];
    if (applicant.step && applicant.step !== 'Careers Form') {
      options.push({ label: 'Move to Applicants', onClick: () => handleMoveToStage(applicant.id, 'Careers Form') });
    }
    return options;
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
    // Don't refresh on close - only refresh when data is actually saved
  };

  // Handle recruit added successfully
  const handleRecruitAdded = (newRecruit) => {
    onRecruitAdded(newRecruit); // Update shared state in parent
    fetchStats(); // Refresh local stats
    if (newRecruit?.step) {
      setActiveTab(newRecruit.step);
    }
  };

  const handleImportData = async (importedData) => {
    try {
      const dataToSend = (Array.isArray(importedData) ? importedData : [importedData]).map(item => {
        const row = { ...item };
        // Pass fallback IDs separately so backend can distinguish name lookups from fallback values
        if (!row.recruiting_agent) {
          row.recruiting_agent = user?.id || user?.userId;
        } else {
          // Column was mapped — value is a name string; pass fallback separately
          row._fallback_recruiting_agent = user?.id || user?.userId;
        }
        return row;
      });

      const res = await api.post('/recruitment/recruits/import', dataToSend);
      if (res.data?.success) {
        const msg = res.data.message || 'Recruits imported';
        if (res.data.unmatchedNames?.length) {
          toast.success(msg, { duration: 5000 });
        } else {
          toast.success(msg);
        }
        fetchData();
        fetchStats();
      }
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
  };

  // Send onboarding setup email for a single recruit (when redeemed = 0)
  const handleSendOnboardingEmail = async (recruit) => {
    const toastId = toast.loading('Sending email...');
    try {
      let emailToUse = (recruit.email || '').trim();

      if (!emailToUse) {
        toast.dismiss(toastId);
        const input = window.prompt(
          'Enter an email address for this recruit to send their onboarding setup:',
          ''
        );
        if (!input) return;
        emailToUse = input.trim();
        toast.loading('Sending email...', { id: toastId });
      }

      const res = await api.post(`/recruitment/recruits/${recruit.id}/send-onboarding-email`, {
        email: emailToUse
      });

      const msg = res?.data?.message || 'Onboarding setup email sent successfully.';
      toast.success(msg, { id: toastId, duration: 4000 });
    } catch (error) {
      console.error('Error sending onboarding setup email:', error);
      const backendMessage = error?.response?.data?.message;
      toast.error(
        backendMessage || 'Failed to send onboarding setup email. Please try again.',
        { id: toastId, duration: 5000 }
      );
    }
  };

  // Send onboarding setup via text
  const handleSendOnboardingText = async (recruit) => {
    const toastId = toast.loading('Sending text message...');
    try {
      let phoneToUse = (recruit.phone || '').trim();

      if (!phoneToUse) {
        toast.dismiss(toastId);
        const input = window.prompt(
          'Enter a phone number for this recruit to send their onboarding setup:',
          ''
        );
        if (!input) return;
        phoneToUse = input.trim();
        toast.loading('Sending text message...', { id: toastId });
      }

      const res = await api.post(`/recruitment/recruits/${recruit.id}/send-onboarding-text`, {
        phone: phoneToUse
      });

      const msg = res?.data?.message || 'Onboarding setup text sent successfully.';
      toast.success(msg, { id: toastId, duration: 4000 });
      fetchSmsBalance(); // Refresh balance after sending
    } catch (error) {
      console.error('Error sending onboarding setup text:', error);
      const backendMessage = error?.response?.data?.message;
      toast.error(
        backendMessage || 'Failed to send onboarding setup text. Please try again.',
        { id: toastId, duration: 5000 }
      );
    }
  };

  // Send onboarding setup via both email and text
  const handleSendOnboardingBoth = async (recruit) => {
    const toastId = toast.loading('Sending email and text...');
    try {
      let emailToUse = (recruit.email || '').trim();
      let phoneToUse = (recruit.phone || '').trim();

      if (!emailToUse) {
        toast.dismiss(toastId);
        const input = window.prompt(
          'Enter an email address for this recruit:',
          ''
        );
        if (!input) return;
        emailToUse = input.trim();
        toast.loading('Sending email and text...', { id: toastId });
      }

      if (!phoneToUse) {
        toast.dismiss(toastId);
        const input = window.prompt(
          'Enter a phone number for this recruit:',
          ''
        );
        if (!input) return;
        phoneToUse = input.trim();
        toast.loading('Sending email and text...', { id: toastId });
      }

      const res = await api.post(`/recruitment/recruits/${recruit.id}/send-onboarding-both`, {
        email: emailToUse,
        phone: phoneToUse
      });

      const msg = res?.data?.message || 'Onboarding setup sent via email and text successfully.';
      toast.success(msg, { id: toastId, duration: 4000 });
      fetchSmsBalance(); // Refresh balance after sending
    } catch (error) {
      console.error('Error sending onboarding setup:', error);
      const backendMessage = error?.response?.data?.message;
      toast.error(
        backendMessage || 'Failed to send onboarding setup. Please try again.',
        { id: toastId, duration: 5000 }
      );
    }
  };

  // Mass send onboarding info to selected recruits
  const handleMassSendOnboarding = async (method) => {
    if (!selectedRecruitIds || selectedRecruitIds.length === 0) return;

    const idSet = new Set(selectedRecruitIds.map(id => String(id)));
    const selected = recruits.filter(r => idSet.has(String(r.id)));

    // Filter to recruits that haven't logged in yet
    const unredeemed = selected.filter(r => !r.pipeline_redeemed);
    if (unredeemed.length === 0) {
      toast.error('All selected recruits have already logged in.');
      return;
    }

    // Check which have required contact info
    const eligible = unredeemed.filter(r => {
      if (method === 'email') return r.email;
      if (method === 'text') return r.phone;
      return r.email || r.phone; // both — at least one needed
    });

    if (eligible.length === 0) {
      toast.error(`No selected recruits have ${method === 'email' ? 'an email' : method === 'text' ? 'a phone number' : 'contact info'}.`);
      return;
    }

    const skipped = unredeemed.length - eligible.length;
    const confirm = window.confirm(
      `Send login info via ${method} to ${eligible.length} recruit${eligible.length !== 1 ? 's' : ''}?` +
      (skipped > 0 ? `\n(${skipped} will be skipped — missing contact info)` : '')
    );
    if (!confirm) return;

    const toastId = toast.loading(`Sending to ${eligible.length} recruit${eligible.length !== 1 ? 's' : ''}...`);
    let sent = 0;
    let failed = 0;

    const endpoint = method === 'email' ? 'send-onboarding-email'
      : method === 'text' ? 'send-onboarding-text'
      : 'send-onboarding-both';

    // Process in batches of 5 to avoid overwhelming the server
    const BATCH = 5;
    for (let i = 0; i < eligible.length; i += BATCH) {
      const batch = eligible.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(r => {
          const body = {};
          if (r.email) body.email = r.email;
          if (r.phone) body.phone = r.phone;
          return api.post(`/recruitment/recruits/${r.id}/${endpoint}`, body);
        })
      );
      results.forEach(r => {
        if (r.status === 'fulfilled') sent++;
        else failed++;
      });
    }

    if (failed === 0) {
      toast.success(`Sent login info to ${sent} recruit${sent !== 1 ? 's' : ''}.`, { id: toastId });
    } else {
      toast.error(`Sent: ${sent}, Failed: ${failed}`, { id: toastId });
    }
    if (method !== 'email') fetchSmsBalance();
  };

  // Mass actions
  const handleDeleteSelected = async (ids) => {
    const targetIds = ids && ids.length ? ids : selectedRecruitIds;
    if (!targetIds || targetIds.length === 0) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${targetIds.length} recruit${targetIds.length > 1 ? 's' : ''}?`
    );
    if (!confirmDelete) return;

    try {
      await Promise.all(
        targetIds.map((id) =>
          api.delete(`/recruitment/recruits/${id}`).catch((err) => {
            console.error('Error deleting recruit', id, err);
          })
        )
      );
      // Remove from local state
      const deletedSet = new Set(targetIds.map(id => Number(id)));
      setRecruits(prev => prev.filter(r => !deletedSet.has(r.id)));
      setSelectedRecruitIds([]);
      fetchStats(); // Stage counts changed
    } catch (error) {
      console.error('Error deleting selected recruits:', error);
    }
  };

  const handleArchiveSelected = async (ids) => {
    const targetIds = ids && ids.length ? ids : selectedRecruitIds;
    if (!targetIds || targetIds.length === 0) return;

    try {
      await Promise.all(
        targetIds.map((id) =>
          api
            .put(`/recruitment/recruits/${id}`, { archive: 'y' })
            .catch((err) => console.error('Error archiving recruit', id, err))
        )
      );
      // Remove archived from local state
      const archivedSet = new Set(targetIds.map(id => Number(id)));
      setRecruits(prev => prev.filter(r => !archivedSet.has(r.id)));
      setSelectedRecruitIds([]);
      fetchStats(); // Stage counts changed
    } catch (error) {
      console.error('Error archiving selected recruits:', error);
    }
  };

  const handleSyncAilSelected = () => {
    console.log('[Pipeline] 🔄 AIL Sync button clicked');
    console.log('[Pipeline] Selected recruit IDs:', selectedRecruitIds);
    
    if (!selectedRecruitIds || selectedRecruitIds.length === 0) {
      console.warn('[Pipeline] ⚠️ No recruits selected for sync');
      return;
    }
    
    // Get the selected recruit data
    const idSet = new Set(selectedRecruitIds.map((id) => String(id)));
    const selectedRecruits = recruits.filter((r) => idSet.has(String(r.id)));
    
    console.log('[Pipeline] Found recruits to sync:', {
      count: selectedRecruits.length,
      recruits: selectedRecruits.map(r => ({
        id: r.id,
        name: `${r.recruit_first} ${r.recruit_last}`,
        email: r.email
      }))
    });
    
    if (selectedRecruits.length === 0) {
      console.warn('[Pipeline] ⚠️ No matching recruits found in data');
      return;
    }
    
    setSyncRecruitData(selectedRecruits);
    setShowSyncModal(true);
    console.log('[Pipeline] ✅ Sync modal opened');
  };

  const handleSendEmailSelected = () => {
    if (!selectedRecruitIds || selectedRecruitIds.length === 0) return;

    // Collect unique, non-empty emails for selected recruits
    const idSet = new Set(selectedRecruitIds.map((id) => String(id)));
    const emails = recruits
      .filter((r) => idSet.has(String(r.id)))
      .map((r) => r.email)
      .filter((email) => !!email);

    if (emails.length === 0) {
      window.alert('No email addresses found for the selected recruits.');
      return;
    }

    // Open default mail client with BCC list
    const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(','))}`;
    window.location.href = mailto;
  };

  // Mass reassign handler
  const handleMassReassign = () => {
    if (!selectedRecruitIds || selectedRecruitIds.length === 0) return;
    setReassignField('recruiting_agent');
    setReassignTarget('');
    setShowReassignModal(true);
  };

  const handleMassReassignSubmit = async () => {
    if (!reassignTarget || selectedRecruitIds.length === 0) return;
    const targetId = parseInt(reassignTarget, 10);
    const member = teamMembers.find(m => m.id === targetId);
    const nameField = reassignField === 'recruiting_agent' ? 'lagnname' : 'coded_to_name';
    const fieldLabel = reassignField === 'recruiting_agent' ? 'Recruiting Agent' : 'Coded To';

    try {
      await Promise.all(
        selectedRecruitIds.map(id =>
          api.put(`/recruitment/recruits/${id}`, { [reassignField]: targetId })
        )
      );
      // Update local state
      const idSet = new Set(selectedRecruitIds.map(id => String(id)));
      setRecruits(prev => prev.map(r =>
        idSet.has(String(r.id))
          ? { ...r, [reassignField]: targetId, [nameField]: member?.lagnname || null }
          : r
      ));
      toast.success(`${fieldLabel} updated for ${selectedRecruitIds.length} recruit${selectedRecruitIds.length > 1 ? 's' : ''}`);
      setShowReassignModal(false);
    } catch (err) {
      console.error('Mass reassign error:', err);
      toast.error('Failed to reassign recruits');
    }
  };

  // Mass applicant actions
  const handleMassMoveToStep = async (newStep) => {
    if (!selectedRecruitIds || selectedRecruitIds.length === 0) return;
    try {
      // Optimistic local update
      const idSet = new Set(selectedRecruitIds.map(id => Number(id)));
      setRecruits(prev => prev.map(r => idSet.has(r.id) ? { ...r, step: newStep } : r));
      await Promise.all(
        selectedRecruitIds.map(id =>
          api.put(`/recruitment/recruits/${id}/step`, { step: newStep })
        )
      );
      toast.success(`Moved ${selectedRecruitIds.length} recruit${selectedRecruitIds.length > 1 ? 's' : ''}`);
      setSelectedRecruitIds([]);
      fetchStats();
    } catch (error) {
      console.error('Mass move error:', error);
      toast.error('Failed to move recruits');
      fetchData();
    }
  };

  const handleMassBookFinal = () => {
    if (!selectedRecruitIds || selectedRecruitIds.length === 0) return;
    setSelectedApplicant({ __mass: true, ids: selectedRecruitIds });
    setFinalDate('');
    setFinalTime('');
    setFinalTimeModalVisible(true);
  };

  const handleMassScheduleCallback = () => {
    if (!selectedRecruitIds || selectedRecruitIds.length === 0) return;
    setSelectedApplicant({ __mass: true, ids: selectedRecruitIds });
    setCallbackDate('');
    setCallbackTime('');
    setCallbackTimeModalVisible(true);
  };

  const handleMassHired = () => {
    if (!selectedRecruitIds || selectedRecruitIds.length === 0) return;
    setSelectedApplicant({ __mass: true, ids: selectedRecruitIds });
    setResidentState('');
    setEnrolled('');
    setCourse('');
    setExpectedCompleteDate('');
    setHiredModalVisible(true);
  };

  // DataTable columns
  const formatDuration = (fromDateStr) => {
    if (!fromDateStr) return '—';

    console.log('🕐 [formatDuration] Raw timestamp from backend:', fromDateStr);

    // Database stores in EST, so treat as local time (no 'Z' suffix)
    let isoString = fromDateStr;
    if (!isoString.includes('T')) {
      isoString = fromDateStr.replace(' ', 'T');
    }
    // Do NOT add 'Z' - the timestamp is in EST, not UTC

    console.log('🕐 [formatDuration] ISO string after processing:', isoString);

    const from = new Date(isoString);
    console.log('🕐 [formatDuration] Parsed Date object:', from.toString());
    console.log('🕐 [formatDuration] Date in UTC:', from.toUTCString());
    console.log('🕐 [formatDuration] Date in Local:', from.toLocaleString());
    
    if (isNaN(from.getTime())) return '—';

    const now = new Date();
    console.log('🕐 [formatDuration] Current time:', now.toString());
    
    let diffMs = now - from;
    // If the difference is negative (timestamp slightly in the future due to clock / timezone mismatch),
    // clamp it to zero so we don't show negative time-in-stage.
    if (diffMs < 0) {
      console.warn('🕐 [formatDuration] Negative diff detected, clamping to 0. Raw diffMs:', diffMs);
      diffMs = 0;
    }
    console.log('🕐 [formatDuration] Difference in ms (clamped):', diffMs, '(', Math.floor(diffMs / (1000 * 60 * 60)), 'hours )');
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((diffMs / (1000 * 60)) % 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    const secs = Math.floor((diffMs / 1000) % 60);
    return `${mins}m ${secs}s`;
  };

  const columns = useMemo(() => [
    // Mass select column
    {
      id: 'selection',
      Header: '',
      accessor: 'id',
      massSelection: true,
      width: 40
    },
    {
      Header: 'Stage',
      accessor: 'step',
      type: 'select',
      width: 60,
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
      Header: 'XCEL Progress',
      accessor: 'xcel_progress_pct',
      width: 100,
      Cell: ({ value, row }) => {
        const pct = value;
        const preparedStatus = row.original.xcel_prepared_to_pass;
        
        if (pct === null || pct === undefined) {
          return (
            <div style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontStyle: 'italic'
            }}>
              Not enrolled
            </div>
          );
        }
        
        // Determine color based on progress
        let color = '#dc3545'; // red for low progress
        if (pct >= 75) color = '#28a745'; // green
        else if (pct >= 50) color = '#ffc107'; // yellow
        else if (pct >= 25) color = '#fd7e14'; // orange
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: color,
              minWidth: '35px'
            }}>
              {pct}%
            </div>
            {preparedStatus === 'PREPARED' && (
              <span 
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  fontWeight: 500
                }}
                title="Prepared to Pass"
              >
                ✓
              </span>
            )}
          </div>
        );
      }
    },
    {
      Header: 'Phone',
      accessor: 'phone',
      width: 60,
      isEditable: false,
      Cell: ({ value }) => value ? (
        <a href={`tel:${value}`} style={{ color: 'var(--link-color, #00558c)', textDecoration: 'none' }}>{value}</a>
      ) : '—'
    },
    {
      Header: 'Res State',
      accessor: 'resident_state',
      width: 45,
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
      },
      filterDisplayFn: (val) => {
        if (!val) return '';
        let isoString = String(val);
        if (!isoString.includes('T')) isoString = isoString.replace(' ', 'T');
        if (!isoString.endsWith('Z') && !isoString.includes('+')) isoString += 'Z';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return String(val);
        return date.toLocaleDateString();
      },
      width: 50,
    },
    {
      Header: 'Recruiting Agent',
      accessor: 'recruiting_agent',
      width: 100,
      chipDropdown: true,
      chipDropdownOptions: teamMembers,
      chipDropdownValueField: 'id',
      chipDropdownDisplay: (opt) => opt.lagnname,
      chipDropdownChipColor: '#e0e0e0',
      filterDisplayFn: (val) => {
        const member = teamMembers.find(m => String(m.id) === String(val));
        return member ? member.lagnname : val;
      },
    },
    {
      Header: 'Coded To',
      accessor: 'code_to',
      width: 100,
      chipDropdown: true,
      chipDropdownOptions: [{ id: '', lagnname: '— None —' }, ...teamMembers],
      chipDropdownValueField: 'id',
      chipDropdownDisplay: (opt) => opt.lagnname,
      chipDropdownChipColor: '#e0e0e0',
      filterDisplayFn: (val) => {
        const member = teamMembers.find(m => String(m.id) === String(val));
        return member ? member.lagnname : val;
      },
    },
    {
      Header: 'Logged In',
      accessor: 'pipeline_redeemed',
      width: 70,
      isEditable: false,
      filterDisplayFn: (val) => val ? 'Yes' : 'No',
      Cell: ({ value, row }) => {
        const redeemed = !!value;
        const recruit = row.original;
        const hasFunds = smsBalance >= 6;

        if (redeemed) {
          return (
            <div style={{ color: '#27ae60', fontWeight: 500, fontSize: '14px' }}>
              Yes
            </div>
          );
        }

        return (
          <button
            type="button"
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setContextMenu({
                x: rect.left,
                y: rect.bottom + 4,
                recruit
              });
            }}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setContextMenu({
                x: rect.left,
                y: rect.bottom + 4,
                recruit
              });
            }}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              borderRadius: '999px',
              border: '1px solid #0b5a8f',
              backgroundColor: '#ffffff',
              color: '#0b5a8f',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Send onboarding setup"
          >
            No – Send Info
            <FiChevronDown size={12} />
          </button>
        );
      }
    },
    {
      Header: 'Time in Stage',
      accessor: 'current_stage_entered',
      Cell: ({ row }) => (
        <span title={row.original.current_stage_entered || row.original.date_added_utc || row.original.date_added}>
          {formatDuration(row.original.current_stage_entered || row.original.date_added_utc || row.original.date_added)}
        </span>
      )
    },
    {
      Header: 'AOB',
      accessor: 'aob',
      width: 80,
      isEditable: false,
      Cell: ({ row }) => {
        const recruit = row.original;
        const hasAob = recruit.aob && recruit.aob !== '';
        
        // Helper to convert Excel serial date to JS date
        const excelSerialToDate = (serial) => {
          if (!serial || isNaN(serial)) return null;
          // Excel serial date: days since Jan 1, 1900 (with leap year bug)
          const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
          const date = new Date(excelEpoch.getTime() + serial * 86400000);
          return date;
        };
        
        // Format date as m/d/yy
        const formatImportDate = (serial) => {
          const date = excelSerialToDate(serial);
          if (!date || isNaN(date.getTime())) return null;
          const month = date.getMonth() + 1;
          const day = date.getDate();
          const year = String(date.getFullYear()).slice(-2);
          return `${month}/${day}/${year}`;
        };
        
        if (hasAob) {
          // Show import date if available
          const importDate = recruit.aob_import_date ? formatImportDate(recruit.aob_import_date) : null;
          return (
            <span 
              style={{ 
                fontSize: '12px', 
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap'
              }}
              title={`AOB linked (ID: ${recruit.aob})`}
            >
              {importDate ? `Sent ${importDate}` : '✓ Sent'}
            </span>
          );
        }
        
        // Show sync button if user can sync
        if (!canSyncAppointments) return null;
        
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSyncRecruitData(recruit);
              setShowSyncModal(true);
            }}
            title="Sync AIL Appointments - Pull AOB data from AIL Portal for this recruit"
            style={{
              padding: '6px',
              backgroundColor: 'transparent',
              color: '#00558c',
              border: '1px solid #00558c',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <FiRefreshCw size={14} />
          </button>
        );
      }
    }
  ], [smsBalance, navigate, canSyncAppointments, stages, teamMembers]);

  // Applicant-specific columns
  const applicantColumns = useMemo(() => [
    {
      id: 'selection',
      Header: '',
      accessor: 'id',
      massSelection: true,
      width: 40
    },
    {
      Header: 'Recruiting Agent',
      accessor: 'recruiting_agent',
      width: 100,
      chipDropdown: true,
      chipDropdownOptions: teamMembers,
      chipDropdownValueField: 'id',
      chipDropdownDisplay: (opt) => opt.lagnname,
      chipDropdownChipColor: '#e0e0e0',
      filterDisplayFn: (val) => {
        const member = teamMembers.find(m => String(m.id) === String(val));
        return member ? member.lagnname : val;
      },
    },
    {
      Header: 'Applicant',
      accessor: 'recruit_first',
      Cell: ({ row }) => (
        <div style={{ fontWeight: 500 }}>
          {[row.original.recruit_first, row.original.recruit_middle, row.original.recruit_last, row.original.recruit_suffix].filter(Boolean).join(' ')}
        </div>
      )
    },
    {
      Header: 'Res State',
      accessor: 'resident_state',
      width: 50,
      Cell: ({ value }) => value || '—'
    },
    {
      Header: 'Date',
      accessor: 'date_added',
      width: 80,
      Cell: ({ value }) => {
        if (!value) return '';
        const date = new Date(value);
        return date.toLocaleString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true });
      },
      filterDisplayFn: (val) => {
        if (!val) return '';
        const date = new Date(val);
        if (isNaN(date.getTime())) return String(val);
        return date.toLocaleDateString();
      },
    },
    {
      Header: 'Phone',
      accessor: 'phone',
      width: 60,
      isEditable: false,
      Cell: ({ value }) => value ? (
        <a href={`tel:${value}`} style={{ color: 'var(--link-color, #00558c)', textDecoration: 'none' }}>{value}</a>
      ) : '—'
    },
    {
      Header: 'Email',
      accessor: 'email',
      width: 100,
      isEditable: false,
      Cell: ({ value }) => value ? (
        <a href={`mailto:${value}`} style={{ color: 'var(--link-color, #00558c)', textDecoration: 'none' }}>{value}</a>
      ) : '—'
    },
    {
      Header: 'Source',
      accessor: 'referral_source',
      width: 70,
      Cell: ({ value }) => value || '—'
    },
    {
      Header: 'Status',
      accessor: 'step',
      type: 'select',
      width: 80,
      DropdownOptions: APPLICANT_STEPS,
      dropdownBackgroundColor: (value) => {
        const colors = {
          'Careers Form': '#3498db',
          'No Answer - Career Form': '#95a5a6',
          'Callback - Career Form': '#f39c12',
          'Final': '#27ae60',
          'Not Interested': '#e74c3c',
        };
        return colors[value] || '#3498db';
      },
    },
  ], [teamMembers]);

  // Handle cell update (for DataTable inline editing)
  const handleCellUpdate = async (id, field, value) => {
    try {
      if (field === 'step') {
        await handleMoveToStage(id, value);
      } else if (field === 'recruiting_agent' || field === 'code_to') {
        const sendValue = value === '' ? null : value;
        await api.put(`/recruitment/recruits/${id}`, { [field]: sendValue });
        // Update local state with both ID and display name
        const member = teamMembers.find(m => String(m.id) === String(value));
        const nameField = field === 'recruiting_agent' ? 'lagnname' : 'coded_to_name';
        setRecruits(prev => prev.map(r => r.id === id ? { ...r, [field]: sendValue, [nameField]: member?.lagnname || null } : r));
      } else {
        await api.put(`/recruitment/recruits/${id}`, { [field]: value });
        setRecruits(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
      }
    } catch (error) {
      console.error('Error updating recruit:', error);
    }
  };

  // Create tabs configuration — Applicants tab first, then pipeline stages
  const tabs = [
    { key: 'Applicants', label: 'Applicants', badge: applicantCount || null },
    ...stages.map(stage => ({
      key: stage.stage_name,
      label: stage.stage_name,
      badge: getStageCounts[stage.stage_name] || null
    }))
  ];

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

            <button
              className="pipeline-btn"
              onClick={() => setShowImportModal(true)}
              title="Import Recruits"
            >
              <FiUpload style={{ marginRight: '6px' }} />
              Import
            </button>

            {/* Team toggle for managers */}
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

        {/* Tabs */}
        {tabs.length > 0 && (
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            className="pipeline-stage-tabs"
          />
        )}

        {/* Sub-tabs for checklist items OR applicant steps */}
        {activeTab && (isApplicantsTab ? applicantSubTabs.length > 0 : activeStageChecklistItems.length > 0) && (
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 20px',
            borderBottom: '1px solid #dfe4ea',
            backgroundColor: '#f8f9fa',
            overflowX: 'auto',
            flexWrap: 'wrap'
          }}>
            {(isApplicantsTab ? applicantSubTabs : subTabs).map(tab => (
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
            columns={isApplicantsTab ? applicantColumns : columns}
            data={filteredBySubTab}
            onCellUpdate={handleCellUpdate}
            entityName="recruit"
            enableColumnFilters={true}
            tableId={isApplicantsTab ? 'pipeline-applicants' : 'pipeline-recruits'}
            onRowClick={(row) => isApplicantsTab ? handleOpenApplicantDetails(row) : handleOpenChecklist(row)}
            enableRowContextMenu={isApplicantsTab}
            getRowContextMenuOptions={isApplicantsTab ? (row) => getApplicantContextMenuOptions(row) : undefined}
            onSelectionChange={(ids) => setSelectedRecruitIds(ids)}
            onDelete={handleDeleteSelected}
            onArchive={handleArchiveSelected}
            onSendEmail={handleSendEmailSelected}
            onMassReassign={handleMassReassign}
            actionBarExtras={
              selectedRecruitIds.length > 0 ? (
                isApplicantsTab ? (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Book Final', color: '#27ae60', onClick: handleMassBookFinal },
                      { label: 'Callback', color: '#f39c12', onClick: handleMassScheduleCallback },
                      { label: 'Hired', color: '#00558c', onClick: handleMassHired },
                      { label: 'Not Interested', color: '#e74c3c', onClick: () => handleMassMoveToStep('Not Interested') },
                      { label: 'No Answer', color: '#95a5a6', onClick: () => handleMassMoveToStep('No Answer - Career Form') },
                      { label: 'Applicants', color: '#3498db', onClick: () => handleMassMoveToStep('Careers Form') },
                    ].map(btn => (
                      <button
                        key={btn.label}
                        onClick={btn.onClick}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: btn.color,
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          whiteSpace: 'nowrap'
                        }}
                        title={`${btn.label} (${selectedRecruitIds.length})`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {canSyncAppointments && (
                      <button
                        onClick={handleSyncAilSelected}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          backgroundColor: '#00558c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500',
                        }}
                        title={`Sync ${selectedRecruitIds.length} recruit${selectedRecruitIds.length > 1 ? 's' : ''} with AIL`}
                      >
                        <FiRepeat size={16} />
                        <span>Sync AIL ({selectedRecruitIds.length})</span>
                      </button>
                    )}
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleMassSendOnboarding(e.target.value);
                            e.target.value = "";
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 12px',
                          backgroundColor: '#27ae60',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 8px center',
                          paddingRight: '28px',
                        }}
                        title={`Send login info to ${selectedRecruitIds.length} recruit${selectedRecruitIds.length > 1 ? 's' : ''}`}
                      >
                        <option value="">Send Info ({selectedRecruitIds.length})</option>
                        <option value="email">Send via Email</option>
                        <option value="text">Send via Text</option>
                        <option value="both">Send via Both</option>
                      </select>
                    </div>
                  </div>
                )
              ) : null
            }
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

      {/* RightDetails Panel for Checklist or Applicant Details */}
      {showRightDetails && rightDetailsData && (
        rightDetailsData.__isApplicantDetails ? (
          <RightDetails
            fromPage="Applicants"
            data={rightDetailsData}
            onClose={handleCloseChecklist}
            onSave={async (updatedData) => {
              try {
                if (updatedData.id) {
                  await api.put(`/recruitment/recruits/${updatedData.id}`, updatedData);
                  refreshSingleRecruit(updatedData.id);
                }
                return true;
              } catch (error) {
                console.error('Error saving applicant data:', error);
                toast.error('Failed to save applicant changes');
                return false;
              }
            }}
            onQuickAction={handleApplicantQuickAction}
            onMoveToApplicants={(id) => handleMoveToStage(id, 'Careers Form')}
            onAdvanceStep={(id, step) => handleMoveToStage(id, step)}
            onShowFinalModal={(applicant) => {
              setSelectedApplicant(applicant);
              setFinalDate('');
              setFinalTime('');
              setFinalTimeModalVisible(true);
            }}
            onShowCallbackModal={(applicant) => {
              setSelectedApplicant(applicant);
              setCallbackDate('');
              setCallbackTime('');
              setCallbackTimeModalVisible(true);
            }}
            onShowHiredModal={(applicant) => {
              setSelectedApplicant(applicant);
              setResidentState(applicant.resident_state || '');
              setEnrolled('');
              setCourse('');
              setExpectedCompleteDate('');
              setHiredModalVisible(true);
            }}
            onStepChange={(id, newStep) => handleMoveToStage(id, newStep)}
          />
        ) : (
          <RightDetails
            fromPage="Pipeline"
            data={rightDetailsData}
            onClose={handleCloseChecklist}
            onSave={() => {
              if (rightDetailsData?.recruit?.id) {
                refreshSingleRecruit(rightDetailsData.recruit.id);
              }
              fetchStats();
            }}
          />
        )
      )}

      {/* Add Recruit Modal */}
      <AddRecruitModal
        isOpen={showAddRecruitModal}
        onClose={() => setShowAddRecruitModal(false)}
        onRecruitAdded={handleRecruitAdded}
        initialStage={isApplicantsTab ? 'Careers Form' : (activeTab || 'Careers Form')}
        stages={stages}
      />

      {showImportModal && (
        <ImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImportData}
          title="Import Recruits"
          existingData={recruits}
          columns={columns}
          availableFields={[
            'recruit_first',
            'recruit_last',
            'recruit_middle',
            'recruit_suffix',
            'name',
            'email',
            'phone',
            'instagram',
            'birthday',
            'resident_state',
            'referral_source',
            'recruiting_agent',
            'code_to',
          ]}
          assignFields={[
            { field: 'recruiting_agent', label: 'Fallback Recruiting Agent', options: teamMembers },
            { field: 'code_to', label: 'Fallback Coded To', options: teamMembers },
          ]}
          rowAssignField={{
            field: 'step',
            label: 'Pipeline Stage',
            options: stages,
            valueKey: 'stage_name',
            labelKey: 'stage_name',
            placeholder: 'Select Stage',
          }}
          stageChecklistItems={allStageChecklistItems}
        />
      )}

      {/* Context Menu for Send Options */}
      {contextMenu && (() => {
        const hasFunds = smsBalance >= 6;
        return (
          <ContextMenu
            options={[
              {
                label: 'Email',
                icon: <FiMail size={14} />,
                onClick: () => handleSendOnboardingEmail(contextMenu.recruit)
              },
              {
                label: hasFunds ? 'Text' : 'Text (Add Funds)',
                icon: <FiMessageSquare size={14} />,
                onClick: () => {
                  if (!hasFunds) {
                    navigate('/recruiting/pipeline?view=settings');
                  } else {
                    handleSendOnboardingText(contextMenu.recruit);
                  }
                },
                disabled: !hasFunds
              },
              {
                label: 'Both',
                icon: (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <FiMail size={14} />
                    <FiMessageSquare size={14} />
                  </div>
                ),
                onClick: () => {
                  if (!hasFunds) {
                    navigate('/recruiting/pipeline?view=settings');
                  } else {
                    handleSendOnboardingBoth(contextMenu.recruit);
                  }
                },
                disabled: !hasFunds
              }
            ]}
            onClose={() => setContextMenu(null)}
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 10000
            }}
          />
        );
      })()}

      {/* Sync Appointments Modal */}
      {showSyncModal && syncRecruitData && (
        <SyncAppointmentsModal
          isOpen={showSyncModal}
          onClose={() => {
            setShowSyncModal(false);
            setSyncRecruitData(null);
          }}
          recruit={syncRecruitData}
        />
      )}

      {/* Mass Reassign Modal */}
      {showReassignModal && (
        <div className="modal-overlay" onClick={() => setShowReassignModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
              Reassign {selectedRecruitIds.length} Recruit{selectedRecruitIds.length > 1 ? 's' : ''}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Field</label>
                <select
                  value={reassignField}
                  onChange={e => setReassignField(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color, #ddd)', fontSize: 14 }}
                >
                  <option value="recruiting_agent">Recruiting Agent</option>
                  <option value="code_to">Coded To</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Assign To</label>
                <select
                  value={reassignTarget}
                  onChange={e => setReassignTarget(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color, #ddd)', fontSize: 14 }}
                >
                  <option value="">Select agent...</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.lagnname}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setShowReassignModal(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-color, #ddd)', background: 'var(--card-bg, #fff)', cursor: 'pointer', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={handleMassReassignSubmit}
                disabled={!reassignTarget}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none',
                  background: reassignTarget ? '#4f46e5' : '#ccc',
                  color: '#fff', cursor: reassignTarget ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 500
                }}
              >
                Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Applicant Modals */}
      <Modal
        isOpen={finalTimeModalVisible}
        onClose={() => setFinalTimeModalVisible(false)}
        title="Set Final Time"
      >
        <div className="form-group" style={{ marginBottom: 15 }}>
          <label>Date:</label>
          <input type="date" value={finalDate} onChange={(e) => setFinalDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color, #ddd)' }} />
        </div>
        <div className="form-group" style={{ marginBottom: 15 }}>
          <label>Time:</label>
          <input type="time" value={finalTime} onChange={(e) => setFinalTime(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color, #ddd)' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="pipeline-btn" onClick={() => setFinalTimeModalVisible(false)}>Cancel</button>
          <button className="pipeline-btn pipeline-btn-primary" onClick={handleUpdateFinalTime}>Save</button>
        </div>
      </Modal>

      <Modal
        isOpen={callbackTimeModalVisible}
        onClose={() => setCallbackTimeModalVisible(false)}
        title="Set Callback Time"
      >
        <div className="form-group" style={{ marginBottom: 15 }}>
          <label>Date:</label>
          <input type="date" value={callbackDate} onChange={(e) => setCallbackDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color, #ddd)' }} />
        </div>
        <div className="form-group" style={{ marginBottom: 15 }}>
          <label>Time:</label>
          <input type="time" value={callbackTime} onChange={(e) => setCallbackTime(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color, #ddd)' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="pipeline-btn" onClick={() => setCallbackTimeModalVisible(false)}>Cancel</button>
          <button className="pipeline-btn pipeline-btn-primary" onClick={handleUpdateCallbackTime}>Save</button>
        </div>
      </Modal>

      <Modal
        isOpen={hiredModalVisible}
        onClose={() => setHiredModalVisible(false)}
        title="Pre-Licensing Information"
      >
        <div className="form-group" style={{ marginBottom: 15 }}>
          <label>Resident State:</label>
          <select value={residentState} onChange={(e) => setResidentState(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color, #ddd)' }}>
            <option value="">Select State</option>
            {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 15 }}>
          <label>Enrolled:</label>
          <select value={enrolled} onChange={(e) => setEnrolled(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color, #ddd)' }}>
            <option value="">Select</option>
            <option value="y">Yes</option>
            <option value="n">No</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 15 }}>
          <label>Course:</label>
          <input type="text" value={course} onChange={(e) => setCourse(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color, #ddd)' }} />
        </div>
        <div className="form-group" style={{ marginBottom: 15 }}>
          <label>Expected Completion Date:</label>
          <input type="date" value={expectedCompleteDate} onChange={(e) => setExpectedCompleteDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-color, #ddd)' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="pipeline-btn" onClick={() => setHiredModalVisible(false)}>Cancel</button>
          <button className="pipeline-btn pipeline-btn-primary" onClick={handleSaveHiredInfo}>Save</button>
        </div>
      </Modal>
    </div>
  );
};

export default PipelineProgress;

