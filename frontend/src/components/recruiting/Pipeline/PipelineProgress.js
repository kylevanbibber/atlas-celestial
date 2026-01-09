import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useUserHierarchy } from '../../../hooks/useUserHierarchy';
import api from '../../../api';
import Tabs from '../../utils/Tabs';
import DataTable from '../../utils/DataTable';
import RightDetails from '../../utils/RightDetails';
import ContextMenu from '../../utils/ContextMenu';
import AddRecruitModal from './AddRecruitModal';
import SyncAppointmentsModal from './SyncAppointmentsModal';
import { FiSearch, FiPlus, FiFilter, FiMail, FiMessageSquare, FiChevronDown, FiRefreshCw, FiRepeat } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import './Pipeline.css';

const PipelineProgress = ({ kpiFilter }) => {
  const { user } = useAuth();
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const navigate = useNavigate();
  
  // State
  const [stages, setStages] = useState([]);
  const [recruits, setRecruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('all'); // 'all' or checklist item id
  const [stageChecklistItems, setStageChecklistItems] = useState([]); // Checklist items for active stage
  const [recruitProgress, setRecruitProgress] = useState({}); // Map of recruitId -> progress array
  const [searchTerm, setSearchTerm] = useState('');
  const [showTeam, setShowTeam] = useState(true); // Default to team view for managers
  const [showRightDetails, setShowRightDetails] = useState(false);
  const [rightDetailsData, setRightDetailsData] = useState(null);
  const [showAddRecruitModal, setShowAddRecruitModal] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedRecruitIds, setSelectedRecruitIds] = useState([]); // for mass actions
  const [smsBalance, setSmsBalance] = useState(0); // SMS balance in cents
  const [contextMenu, setContextMenu] = useState(null); // { x, y, recruit }
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncRecruitData, setSyncRecruitData] = useState(null);
  
  // Determine user permissions
  const isAgent = user?.clname === 'AGT';
  const isManager = ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);
  const isAdmin = user?.Role === 'Admin';
  const canViewTeam = isManager || isAdmin;
  const canSyncAppointments = ['MGA', 'RGA', 'SGA'].includes(user?.clname);
  
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
    fetchSmsBalance();
  }, []);

  // Fetch recruits and stats when user or view changes
  useEffect(() => {
    // Don't fetch until user is loaded
    if (!user?.userId) return;
    
    // If hierarchy is still loading, wait
    if (hierarchyLoading) return;
    
    // If we're in team view and need hierarchy data, wait until it's ready
    if (canViewTeam && showTeam && hierarchyIds.length === 0 && !isAdmin) {
      console.log('[Pipeline] Waiting for hierarchy data before fetching...');
      return;
    }
    
    fetchData();
  }, [user?.userId, showTeam, hierarchyLoading, hierarchyIds, canViewTeam, isAdmin]);

  // Fetch SMS balance
  const fetchSmsBalance = async () => {
    try {
      const response = await api.get('/recruitment/sms/credits');
      if (response.data?.success) {
        setSmsBalance(response.data.balance || 0);
        console.log('[Pipeline] SMS Credits Info:', {
          balance: response.data.balance,
          mgaUserId: response.data.mgaUserId,
          isMgaOwner: response.data.isMgaOwner,
          userMga: user?.mga,
          userClname: user?.clname
        });
      }
    } catch (error) {
      console.error('Error fetching SMS balance:', error);
    }
  };


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
        // Look for AOB item across all stages
        let aobItem = null;
        for (const stage of stages) {
          const items = stage.checklistItems || [];
          aobItem = items.find(item => 
            item.item_name.toLowerCase().includes('aob') && item.item_name.toLowerCase().includes('completed')
          );
          if (aobItem) break;
        }
        
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
  }, [recruits, kpiFilter, recruitProgress, stages]);

  // Get recruits for current stage from KPI-filtered data
  const currentStageRecruits = useMemo(() => {
    if (!activeTab) return [];
    
    // Start with KPI-filtered recruits in the current stage
    let filtered = kpiFilteredRecruits.filter(r => r.step === activeTab);
    
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
  }, [kpiFilteredRecruits, activeTab, searchTerm]);

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
      
      // For On-boarding stage, show all recruits in this stage
      // (Previously filtered by activeuser status, but that was too restrictive)
      // if (activeTab === 'On-boarding') {
      //   stageRecruits = stageRecruits.filter(r => 
      //     r.activeuser_active === 'y' && 
      //     r.activeuser_manager_active === 'y'
      //   );
      // }

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
      
      // Refresh to pick up any updated email value
      fetchData();
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
      
      fetchData();
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
      
      fetchData();
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
      fetchData();
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
      fetchData();
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
      Header: 'Phone',
      accessor: 'phone',
      width: 60,
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
      width: 50,
    },
    {
      Header: 'Recruiting Agent',
      accessor: 'lagnname',
      width: 100,
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
      width: 100,
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
      Header: 'Logged In',
      accessor: 'pipeline_redeemed',
      width: 70,
      isEditable: false,
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
  ], [smsBalance, navigate, canSyncAppointments, stages]);


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
            onSelectionChange={(ids) => setSelectedRecruitIds(ids)}
            onDelete={handleDeleteSelected}
            onArchive={handleArchiveSelected}
            onSendEmail={handleSendEmailSelected}
            actionBarExtras={
              canSyncAppointments && selectedRecruitIds.length > 0 ? (
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
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#004070';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#00558c';
                  }}
                  title={`Sync ${selectedRecruitIds.length} recruit${selectedRecruitIds.length > 1 ? 's' : ''} with AIL`}
                >
                  <FiRepeat size={16} />
                  <span>Sync AIL ({selectedRecruitIds.length})</span>
                </button>
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
    </div>
  );
};

export default PipelineProgress;

