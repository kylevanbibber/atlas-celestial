import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import * as XLSX from "xlsx";
import { FaEnvelope } from "react-icons/fa";
import api from "../../../api";
import Tabs from "../../utils/Tabs";
import DataTable from "../../utils/DataTable";
import ActionBar from "../../utils/ActionBar";
import { formatUTCForDisplay, formatUTCForInput, localToUTC } from "../../../utils/dateUtils";
import "./AgentProgressTable.css";

const AgentProgressTable = () => {
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [progressData, setProgressData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState({});
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [massAction, setMassAction] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [leadsReleased, setLeadsReleased] = useState([]);
  const [leadsReleasedAll, setLeadsReleasedAll] = useState([]);
  const [licensedStates, setLicensedStates] = useState([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [schedulingAgent, setSchedulingAgent] = useState(null);
  const [unscheduledReleases, setUnscheduledReleases] = useState([]);
  const [selectedUnscheduled, setSelectedUnscheduled] = useState([]);
  const [secondPackFilter, setSecondPackFilter] = useState("notSent");
  const [activeTab, setActiveTab] = useState("upcomingReleases");
  const [sortConfig, setSortConfig] = useState({
    key: "agentName",
    direction: "asc",
  });
  const [isHiddenView, setIsHiddenView] = useState(false);

  // Cell editing state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editedRows, setEditedRows] = useState({});

  // Archive state
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [selectedForArchive, setSelectedForArchive] = useState([]);
  const [archiveReason, setArchiveReason] = useState('');
  const [archivedView, setArchivedView] = useState(false);

    // User role variables
  const userRole = user?.Role || user?.clname;
  const userId = user?.userId;
  const isAdmin = userRole === "Admin" || userId === "101";
  const isManager = ['SA', 'GA', 'MGA', 'RGA'].includes(userRole);
  const canSendEmail = userRole === "SGA" || userRole === "Admin" || user?.teamRole === "app";
  
  // Forward declare load functions so handleRefresh can reference them
  let loadUnscheduledReleases, loadProgressData, loadLeadsReleased, loadLicensedStates;
  
  // Refresh function - defined early to avoid temporal dead zone
  const handleRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    try {
      await Promise.all([
        loadUnscheduledReleases(),
        loadProgressData(), 
        loadLeadsReleased(),
        loadLicensedStates()
      ]);
      console.log('✅ Refresh completed successfully');
    } catch (error) {
      console.error('❌ Refresh failed:', error);
    }
  }, []);

  // Progress calculation constants aligned with Checklist.js
  const correctAnswers = {
    contract_2nd: "45",
    bonus_90d: "750",
    bonus_after_90d: "250",
  };
  const radioKeys = ["build_team", "know_team", "ready_release"];
  const booleanKeys = [
    "video_done",
    "arias_training",
    "booking_done",
    "leadership_track",
    "sale_1k",
    // Excluded: know_more should not count toward progress
    "entrance_start",
    "referral_open",
    "texting_referral",
    "closing_rebuttals",
    "personal_recruit",
    "on_script",
    "warmup_conf",
    "create_need",
    "sale_cemented",
    "would_sell",
  ];
  const TOTAL_PROGRESS_ITEMS = 56; // Adjusted to exclude know_more

  // Helper function to filter data based on search query
  const filterData = useCallback((data) => {
    if (!searchQuery) return data;
    return data.filter(
      (agent) =>
        (agent.agentName && agent.agentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (agent.mga && agent.mga.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery]);

  // Helper function to format names
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

  // Helper to convert a mm/dd/yyyy formatted string from the backend
  // into yyyy-mm-dd format so it can be used by the native date input.
  const convertMDYToYMD = (dateStr) => {
    if (!dateStr) return '';
    const [month, day, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  // Memoize filtered data for each tab to avoid recalculating on every render
  const upcomingReleasesData = useMemo(() => {
    let filtered = progressData.filter(agent => agent.releaseScheduled !== null && agent.passed !== "y");
    
    // For managers, additionally filter by MGA match
    if (isManager && user?.lagnname) {
      const userMgaName = user.lagnname;
      filtered = filtered.filter(agent => agent.mga === userMgaName);
    }
    
    // Apply search filter to this tab's data
    return filterData(filtered);
  }, [progressData, userRole, isManager, isAdmin, userId, user?.lagnname, filterData]);

  const pendingSchedulingData = useMemo(() => {
    // Get userId set from unscheduledReleases to avoid duplicates
    const unscheduledUserIds = new Set(unscheduledReleases.map(r => r.userId));
    
    const filtered = progressData.filter(agent => {
      const passesProgress = agent.progress === 100 && agent.releaseScheduled === null;
      // Handle different data types for hide field (string, number, null, undefined)
      const isHidden = agent.hide == 1 || agent.hide === "1" || agent.hide === true;
      const passesHideFilter = isHiddenView ? isHidden : !isHidden;
      // Exclude agents who are already in Ready to Schedule
      const notInReadyToSchedule = !unscheduledUserIds.has(agent.userId);
      return passesProgress && passesHideFilter && notInReadyToSchedule;
    });
    
    // Apply search filter to this tab's data
    return filterData(filtered);
  }, [progressData, isHiddenView, unscheduledReleases, filterData]);

  const checklistInProgressData = useMemo(() => {
    const filtered = progressData.filter(agent => {
      const passesProgress = agent.progress < 100;
      const passesReleased = agent.released === 0;
      const notScheduled = agent.releaseScheduled === null || agent.releaseScheduled === undefined;
      const notPassed = agent.passed !== 'y';
      // New requirement: must have a 1st Pack record sent = 1
      const firstPackSent = (leadsReleasedAll || []).some(lr => 
        String(lr.userId) === String(agent.userId) &&
        ((lr.type && (lr.type === '1st Pack' || lr.type === 'First Pack'))) &&
        (lr.sent == 1 || lr.sent === '1')
      );
      return passesProgress && passesReleased && notScheduled && notPassed && firstPackSent;
    });
    
    // Apply search filter to this tab's data
    return filterData(filtered);
  }, [progressData, leadsReleasedAll, filterData]);

  const passedReleasesData = useMemo(() => {
    // Include all passed agents; filter by 2nd Pack sent/notSent later
    const filtered = progressData
      .filter(agent => agent.passed === "y")
      .sort((a, b) => {
        // Sort by release date (newest to oldest)
        const dateA = new Date(a.releaseScheduled || 0);
        const dateB = new Date(b.releaseScheduled || 0);
        return dateB - dateA; // Descending order (newest first)
      });
    
    // Apply search filter to this tab's data
    return filterData(filtered);
  }, [progressData, filterData]);

  // Memoize combined passed data calculation
  const combinedPassedData = useMemo(() => {
    console.log('🔄 Recalculating combinedPassedData with:', {
      passedReleasesData: passedReleasesData.length,
      leadsReleased: leadsReleased.length,
      licensedStates: licensedStates.length
    });
    
    // Debug: Check what archive data we have
    const archivedLeads = leadsReleased.filter(lead => lead.archive == 1 || lead.archive === '1');
    console.log('🗃️ Archive debug - Total leads with archive=1:', archivedLeads.length, archivedLeads.map(l => ({ id: l.id, userId: l.userId, archive: l.archive, reason_archive: l.reason_archive })));
    
    return passedReleasesData.map((agent) => {
      // Attach 2nd Pack info if present; otherwise leave as not sent
      const leadInfo = leadsReleased.find(
        (lead) => lead.userId == agent.userId && (lead.type === '2nd Pack' || lead.type === 'Second Pack')
      );

      console.log(`🔍 Agent ${agent.userId} (${agent.agentName}):`, {
        leadInfo: leadInfo ? { id: leadInfo.id, notes: leadInfo.notes, sent_date: leadInfo.sent_date } : null
      });

      // Filter licensedStates for entries matching this agent (by userId) 
      // and with expiry_date strictly in the future.
      const validLicenses = licensedStates.filter((license) => {
        if (!license.expiry_date) return false;
        const expiryDate = new Date(convertMDYToYMD(license.expiry_date));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return license.userId == agent.userId && expiryDate > today;
      });

      const statesLicensed = validLicenses.map((license) => license.state).join(", ") || "N/A";

      const combinedAgent = {
        ...agent,
        packReleasedDate: leadInfo ? leadInfo.sent_date : agent.packReleasedDate,
        notes: leadInfo ? leadInfo.notes : agent.notes,
        lastUpdated: leadInfo ? leadInfo.last_updated : agent.lastUpdated,
        leadId: leadInfo ? leadInfo.id : null,
        leadEntry: leadInfo || null, // Add full leadEntry for archive filtering
        statesLicensed,
      };
      
      console.log(`✅ Combined agent ${agent.userId}:`, {
        leadId: combinedAgent.leadId,
        notes: combinedAgent.notes,
        packReleasedDate: combinedAgent.packReleasedDate,
        leadEntry: combinedAgent.leadEntry ? { id: combinedAgent.leadEntry.id, archive: combinedAgent.leadEntry.archive, reason_archive: combinedAgent.leadEntry.reason_archive } : null
      });

      return combinedAgent;
    });
  }, [passedReleasesData, leadsReleased, licensedStates]);

  // Memoize the current tab's data to avoid unnecessary calculations
  const currentTabData = useMemo(() => {
    switch (activeTab) {
      case "upcomingReleases":
        return upcomingReleasesData; // filterData already applied
      case "readyToSchedule":
        const isAdmin = user?.clname === 'Admin' || user?.Role === 'Admin';
        const readyToScheduleData = isAdmin
            ? unscheduledReleases
            : unscheduledReleases.filter(r =>
                progressData.some(pd => pd.userId === r.userId)
        );
        // Apply search filter to ready to schedule data
        return filterData(readyToScheduleData);
      case "pendingScheduling":
        return pendingSchedulingData; // filterData already applied
      case "checklistInProgress":
        return checklistInProgressData; // filterData already applied
      case "passedReleases":
        const filtered = combinedPassedData.filter(agent => {
        // First apply archive filter - handle null leadEntry as non-archived
        const archiveValue = agent.leadEntry?.archive;
        const isArchived = archiveValue == 1 || archiveValue === '1';
        const hasLeadEntry = !!agent.leadEntry;
        
        console.log(`[ARCHIVE FILTER DEBUG] Agent ${agent.userId} (${agent.agentName}) - archiveValue: ${archiveValue}, isArchived: ${isArchived}, archivedView: ${archivedView}, hasLeadEntry: ${hasLeadEntry}`);
        
        if (archivedView) {
          // Archive view: only show records that are explicitly archived (archive = 1)
          if (!isArchived) return false; // Only show archived items in archived view
        } else {
          // Normal view: show records that are NOT archived (archive = 0, null, or no leadEntry)
          if (isArchived) return false; // Hide archived items in normal view
        }

          // Then apply second pack filter
          if (secondPackFilter === "all") return true;
          if (secondPackFilter === "sent") return agent.packReleasedDate && agent.packReleasedDate !== "N/A";
          if (secondPackFilter === "notSent") {
            // Not sent = either no 2nd Pack lead yet OR has 2nd Pack lead with sent = 0.
            const lead = leadsReleased.find(l => l.userId == agent.userId && (l.type === '2nd Pack' || l.type === 'Second Pack'));
            return !lead || lead.sent == 0;
          }
          return true;
        });
        
        // Log final filtering results
        filtered.forEach(agent => {
          console.log(`✅ Agent ${agent.userId} (${agent.agentName}) PASSED all filters for ${archivedView ? 'ARCHIVE' : 'NORMAL'} view`);
        });
        
        console.log(`📊 AgentProgressTable Final filtered results for ${archivedView ? 'ARCHIVE' : 'NORMAL'} view: ${filtered.length} agents`);
        
        return filtered; // filterData already applied in combinedPassedData (via passedReleasesData)
      default:
        return [];
    }
  }, [activeTab, filterData, upcomingReleasesData, unscheduledReleases, pendingSchedulingData, checklistInProgressData, combinedPassedData, secondPackFilter, progressData, user, archivedView]);

  // Selection change handlers for DataTable's built-in selection
  const handleUpcomingReleasesSelectionChange = useCallback((selectedRowIds) => {
    console.log('🔄 handleUpcomingReleasesSelectionChange called with row IDs:', selectedRowIds);
    
    // Convert row IDs to agent names
    const selectedAgentNames = selectedRowIds.map(rowId => {
      const agent = currentTabData.find(a => String(a.id) === String(rowId) || String(a.userId) === String(rowId));
      console.log('🔍 Converting rowId', rowId, 'to agent:', agent?.agentName);
      return agent?.agentName;
    }).filter(Boolean);
    
    console.log('📝 Upcoming releases selection updated to agent names:', selectedAgentNames);
    setSelectedAgents(selectedAgentNames);
  }, [currentTabData]);

  const handleReadyToScheduleSelectionChange = useCallback((selectedRowIds) => {
    console.log('🔄 handleReadyToScheduleSelectionChange called with row IDs:', selectedRowIds);
    
    // Convert row IDs to numeric IDs (Ready to Schedule uses numeric IDs directly)
    const selectedIds = selectedRowIds.map(id => parseInt(id)).filter(Boolean);
    
    console.log('📝 Ready to schedule selection updated to IDs:', selectedIds);
    setSelectedUnscheduled(selectedIds);
  }, []);

  const openBulkForm = useCallback(() => {
    document
      .querySelector('.bulk-schedule-form')
      ?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleAction = useCallback((agentName, action) => {
    setActionStatus((prevState) => ({
      ...prevState,
      [agentName]: action,
    }));
  }, []);

  const handleConfirm = useCallback(async (agentName) => {
    const action = actionStatus[agentName];
    // Look for the agent in progressData which has the userId field
    const selectedAgent = progressData.find((agent) => agent.agentName === agentName);
    
    
    
    if (!selectedAgent) {
      return;
    }

          // Always use activeusers.id - this is what all backend endpoints expect
      const targetUserId = selectedAgent.userId;
    
    

    try {
      let response;
      
      
      // Generate unique request ID for tracing
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      if (action === "Pass") {
        const payload = { userId: targetUserId, requestId };
        response = await api.post("/release/pass-user", payload);
      } else if (action === "Fail") {
        const payload = { userId: targetUserId, requestId };
        response = await api.post("/release/fail-user", payload);
      } else if (action === "Delete") {
        response = await api.delete(`/release/delete-user/${targetUserId}`);
      }

      const data = response.data;
      if (data.success) {
        
        setActionStatus((prevState) => {
          const updatedState = { ...prevState };
          delete updatedState[agentName];
          return updatedState;
        });
        
        alert(`${agentName} has been ${action.toLowerCase()}ed successfully.`);
        
        // Automatically refresh data to show changes
        console.log(`🔄 Auto-refreshing after individual ${action} action`);
        await handleRefresh();
      } else {
        alert(`Failed to ${action.toLowerCase()} ${agentName}: ${data.message}`);
      }
    } catch (error) {
      
      // Handle 404 specifically for delete actions (user already removed)
      if (error.response?.status === 404 && action === "Delete") {
        // User not found in database, remove from UI anyway since they're effectively deleted
        setProgressData((prevData) =>
          prevData.filter((agent) => agent.agentName !== agentName)
        );
        setActionStatus((prevState) => {
          const updatedState = { ...prevState };
          delete updatedState[agentName];
          return updatedState;
        });
        alert(`${agentName} was already removed from the release schedule.`);
      } else {
        alert(`Error ${action.toLowerCase()}ing ${agentName}. Please try again.`);
      }
    }
  }, [actionStatus, progressData]);

  // Mass action functions
  const handleMassPassAll = useCallback(async () => {
    console.log('🚀 handleMassPassAll called, selectedAgents:', selectedAgents);
    if (selectedAgents.length === 0) {
      alert("Please select agents to pass.");
      return;
    }
    
    const confirmed = window.confirm(`Are you sure you want to pass ${selectedAgents.length} selected agents?`);
    if (!confirmed) return;

    try {
      const userIds = selectedAgents.map(agentName => {
        const agent = progressData.find(a => a.agentName === agentName);
        return agent?.userId;
      }).filter(Boolean);

      const promises = userIds.map(userId => 
        api.post("/release/pass-user", { userId })
      );
      
      await Promise.all(promises);
      
      // Clear selection and refresh data automatically
      setSelectedAgents([]);
      alert(`Successfully passed ${selectedAgents.length} agents.`);
      
      // Automatically refresh all data to show changes
      console.log('🔄 Auto-refreshing after Pass All action');
      await handleRefresh();
    } catch (error) {
      
      alert("Failed to pass some agents. Please try again.");
    }
  }, [selectedAgents, progressData]);

  const handleMassFailAll = useCallback(async () => {
    if (selectedAgents.length === 0) {
      alert("Please select agents to fail.");
      return;
    }
    
    const confirmed = window.confirm(`Are you sure you want to fail ${selectedAgents.length} selected agents?`);
    if (!confirmed) return;

    try {
      const userIds = selectedAgents.map(agentName => {
        const agent = progressData.find(a => a.agentName === agentName);
        return agent?.userId;
      }).filter(Boolean);

      const promises = userIds.map(userId => 
        api.post("/release/fail-user", { userId })
      );
      
      await Promise.all(promises);
      
      // Clear selection and refresh data automatically
      setSelectedAgents([]);
      alert(`Successfully failed ${selectedAgents.length} agents.`);
      
      // Automatically refresh all data to show changes
      console.log('🔄 Auto-refreshing after Fail All action');
      await handleRefresh();
    } catch (error) {
      
      alert("Failed to fail some agents. Please try again.");
    }
  }, [selectedAgents, progressData]);

  const handleMassDeleteAll = useCallback(async () => {
    if (selectedAgents.length === 0) {
      alert("Please select agents to delete.");
      return;
    }
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedAgents.length} selected agents? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const userIds = selectedAgents.map(agentName => {
        const agent = progressData.find(a => a.agentName === agentName);
        return agent?.userId;
      }).filter(Boolean);

      const promises = userIds.map(userId => 
        api.delete(`/release/delete-user/${userId}`)
      );
      
      await Promise.all(promises);
      
      // Clear selection and refresh data automatically
      setSelectedAgents([]);
      alert(`Successfully deleted ${selectedAgents.length} agents.`);
      
      // Automatically refresh all data to show changes
      console.log('🔄 Auto-refreshing after Delete All action');
      await handleRefresh();
    } catch (error) {
      
      alert("Failed to delete some agents. Please try again.");
    }
  }, [selectedAgents, progressData]);

  const handleSendEmail = useCallback(async () => {
    if (selectedAgents.length === 0) {
      alert("Please select agents to send email to.");
      return;
    }
    
    const confirmed = window.confirm(`Are you sure you want to send an email to ${selectedAgents.length} selected agent(s)? Their MGAs will be CC'd.`);
    if (!confirmed) return;

    try {
      const userIds = selectedAgents.map(agentName => {
        const agent = progressData.find(a => a.agentName === agentName);
        return agent?.userId;
      }).filter(Boolean);

      // Send email request to backend
      const response = await api.post("/release/send-release-email", { userIds });
      
      if (response.data.success) {
        alert(`Successfully sent email to ${selectedAgents.length} agent(s).`);
        setSelectedAgents([]);
      } else {
        alert(`Failed to send some emails: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error sending emails:', error);
      alert("Failed to send emails. Please try again.");
    }
  }, [selectedAgents, progressData]);

  // Mass actions for Ready to Schedule tab (unscheduled releases)
  const handleMassPassUnscheduled = useCallback(async () => {
    if (selectedUnscheduled.length === 0) {
      alert("Please select agents to pass.");
      return;
    }
    
    const confirmed = window.confirm(`Are you sure you want to pass ${selectedUnscheduled.length} selected agents?`);
    if (!confirmed) return;

    try {
      const selectedReleases = unscheduledReleases.filter(r => selectedUnscheduled.includes(r.id));
      const userIds = selectedReleases.map(release => release.userId).filter(Boolean);

      const promises = userIds.map(userId => 
        api.post("/release/pass-user", { userId })
      );
      
      await Promise.all(promises);
      
      // Remove passed agents from unscheduled releases and progress data
      setUnscheduledReleases(prev => prev.filter(r => !selectedUnscheduled.includes(r.id)));
      setProgressData(prevData => 
        prevData.filter(agent => !userIds.includes(agent.userId))
      );
      
      setSelectedUnscheduled([]);
      alert(`Successfully passed ${selectedUnscheduled.length} agents.`);
    } catch (error) {
      console.error('Mass pass error:', error);
      alert("Failed to pass some agents. Please try again.");
    }
  }, [selectedUnscheduled, unscheduledReleases]);

  const handleMassFailUnscheduled = useCallback(async () => {
    if (selectedUnscheduled.length === 0) {
      alert("Please select agents to fail.");
      return;
    }
    
    const confirmed = window.confirm(`Are you sure you want to fail ${selectedUnscheduled.length} selected agents?`);
    if (!confirmed) return;

    try {
      const selectedReleases = unscheduledReleases.filter(r => selectedUnscheduled.includes(r.id));
      const userIds = selectedReleases.map(release => release.userId).filter(Boolean);

      const promises = userIds.map(userId => 
        api.post("/release/fail-user", { userId })
      );
      
      await Promise.all(promises);
      
      // Remove failed agents from unscheduled releases and progress data
      setUnscheduledReleases(prev => prev.filter(r => !selectedUnscheduled.includes(r.id)));
      setProgressData(prevData => 
        prevData.filter(agent => !userIds.includes(agent.userId))
      );
      
      setSelectedUnscheduled([]);
      alert(`Successfully failed ${selectedUnscheduled.length} agents.`);
    } catch (error) {
      console.error('Mass fail error:', error);
      alert("Failed to fail some agents. Please try again.");
    }
  }, [selectedUnscheduled, unscheduledReleases]);

  const handleMarkReady = useCallback(async (agent) => {
    try {
      const response = await api.post('/release/schedule-release', {
        userId: agent.userId,
      });

      if (!response.data.success) {
        return alert("Error: " + response.data.message);
      }

      alert(`${agent.agentName} is now ready to schedule.`);
      
      // Automatically refresh data to show changes
      console.log('🔄 Auto-refreshing after Mark Ready action');
      await handleRefresh();
    } catch (error) {
      
      alert("Failed to mark ready—see console.");
    }
  }, []);

  const handleHideAgent = useCallback(async (agent) => {
    try {
      const isCurrentlyHidden = agent.hide == 1 || agent.hide === "1" || agent.hide === true;
      const newHideValue = isCurrentlyHidden ? 0 : 1;
      
      // Optimistically update local state immediately
      setProgressData(prevData => 
        prevData.map(item => 
          item.userId === agent.userId 
            ? { ...item, hide: newHideValue }
            : item
        )
      );
      
      const response = await api.post('/release/toggle-hide', {
        userId: agent.userId,
        hide: newHideValue
      });

      if (!response.data.success) {
        // Revert the optimistic update if the API call failed
        setProgressData(prevData => 
          prevData.map(item => 
            item.userId === agent.userId 
              ? { ...item, hide: agent.hide }
              : item
          )
        );
        return alert("Error: " + response.data.message);
      }

      const action = isCurrentlyHidden ? 'unhidden' : 'hidden';
      alert(`${agent.agentName} has been ${action}.`);
    } catch (error) {
      
      // Revert the optimistic update if there was an error
      setProgressData(prevData => 
        prevData.map(item => 
          item.userId === agent.userId 
            ? { ...item, hide: agent.hide }
            : item
        )
      );
      alert("Failed to toggle hide status—see console.");
    }
  }, []);

  const handleSecondPack = useCallback(async (agent) => {
    
    
    try {
      const response = await api.post('/release/second-pack', {
        userId: agent.userId,
      });

      if (!response.data.success) {
        return alert("Error: " + response.data.message);
      }

      // Update the leads released data
      setLeadsReleased((prevLeads) => {
        const updatedLeads = prevLeads.map((lead) => {
          if (lead.userId === agent.userId) {
            const now = new Date();
            const day = now.getDate();
            const month = now.getMonth() + 1;
            const year = now.getFullYear().toString().slice(-2);
            const hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, "0");
            const sentDate = `${month}/${day}/${year}, ${hours}:${minutes}`;
            return { ...lead, sent_date: sentDate };
          }
          return lead;
        });
        return updatedLeads;
      });

      // Update the progress data
      setProgressData((prevData) => {
        return prevData.map((item) => {
          if (item.userId === agent.userId) {
            const now = new Date();
            const day = now.getDate();
            const month = now.getMonth() + 1;
            const year = now.getFullYear().toString().slice(-2);
            const hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, "0");
            const sentDate = `${month}/${day}/${year}, ${hours}:${minutes}`;
            return { ...item, packReleasedDate: sentDate };
          }
          return item;
        });
      });

      alert(`Second code pack marked as sent for ${agent.agentName}`);
    } catch (error) {
      
      alert("Failed to send second code pack—see console.");
    }
  }, []);

  const updateNotes = useCallback(async (leadId, newNotes) => {
    if (!leadId) {
      
      return;
    }
    
    try {
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
        notes: newNotes, 
        last_updated: nowFormatted 
      };
      
      const response = await api.put(`/release/leads-released/${leadId}`, payload);
      const data = response.data;
      
      if (data.success) {
        
        // Refresh the leads released data
        const leadsResponse = await api.get('/release/leads-released');
        if (leadsResponse.data.success) {
          setLeadsReleased(leadsResponse.data.data);
        }
      } else {
        
      }
    } catch (error) {
      
    }
  }, []);

  // Cell editing handlers
  const handleCellEdit = useCallback((id, field, value) => {
    console.log(`📝 Cell edit triggered:`, { id, field, value });
    setEditedRows(prev => {
      const updated = {
        ...prev,
        [id]: {
          ...prev[id],
          [field]: value
        }
      };
      console.log(`📝 Updated editedRows:`, updated);
      return updated;
    });
    setHasUnsavedChanges(true);
    console.log(`📝 hasUnsavedChanges set to true`);
  }, []);

  const handleSaveChanges = useCallback(async () => {
    console.log('💾 Saving changes:', editedRows);
    try {
      const promises = Object.entries(editedRows).map(async ([userId, changes]) => {
        if (changes.notes !== undefined) {
          const agent = combinedPassedData.find(a => String(a.userId) === String(userId));
          const leadId = agent?.leadId;
          console.log(`💾 Saving notes for agent ${userId}, leadId: ${leadId}, notes:`, changes.notes);
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
            
            console.log('💾 API payload:', payload);
            await api.put(`/release/leads-released/${leadId}`, payload);
          } else {
            console.log('⚠️ No leadId found for agent:', userId);
          }
        }
      });
      
      await Promise.all(promises);
      setEditedRows({});
      setHasUnsavedChanges(false);
      
      // Refresh the data
      const leadsResponse = await api.get('/release/leads-released');
      if (leadsResponse.data.success) {
        setLeadsReleased(leadsResponse.data.data);
      }
      
      alert('Changes saved successfully');
      
      // Auto-refresh to show latest data
      console.log('🔄 Auto-refreshing after saving notes');
      await handleRefresh();
    } catch (error) {
      console.error('Failed to save changes:', error);
      alert('Failed to save changes');
    }
  }, [editedRows, combinedPassedData]);

  const handleCancelChanges = useCallback(() => {
    setEditedRows({});
    setHasUnsavedChanges(false);
  }, []);

  // Archive handlers
  const handleArchive = useCallback((selectedIds) => {
    console.log('🗃️ Archive requested for IDs:', selectedIds);
    setSelectedForArchive(selectedIds);
    setShowArchiveModal(true);
  }, []);

  const handleArchiveConfirm = useCallback(async () => {
    if (!archiveReason.trim()) {
      alert('Please provide a reason for archiving');
      return;
    }

    try {
      const promises = selectedForArchive.map(async (userId) => {
        const agent = combinedPassedData.find(a => String(a.userId) === String(userId));
        const leadId = agent?.leadId;
        if (leadId) {
          const payload = {
            archive: 1,
            reason_archive: archiveReason.trim(),
            archived_date: new Date().toISOString(),
            last_updated: new Date().toISOString().slice(0, 19).replace('T', ' ')
          };
          console.log(`[ARCHIVE DEBUG] Sending archive request for leadId ${leadId}:`, payload);
          await api.put(`/release/leads-released/${leadId}`, payload);
        }
      });

      await Promise.all(promises);
      
      // Close modal and reset state
      setShowArchiveModal(false);
      setSelectedForArchive([]);
      setArchiveReason('');
      
      alert(`Successfully archived ${selectedForArchive.length} release(s)`);
      
      // Refresh data to show changes
      await handleRefresh();
    } catch (error) {
      console.error('Failed to archive releases:', error);
      alert('Failed to archive releases');
    }
  }, [selectedForArchive, archiveReason, combinedPassedData]);

  const handleArchiveCancel = useCallback(() => {
    setShowArchiveModal(false);
    setSelectedForArchive([]);
    setArchiveReason('');
  }, []);

  const handleToggleArchivedView = useCallback(() => {
    console.log(`🔄 Toggling archive view from ${archivedView} to ${!archivedView}`);
    setArchivedView(!archivedView);
    // Refresh data when toggling view
    handleRefresh();
  }, [archivedView]);

  // Unarchive handlers
  const handleUnarchive = useCallback(async (userId) => {
    try {
      const agent = combinedPassedData.find(a => String(a.userId) === String(userId));
      const leadId = agent?.leadId;
      
      if (!leadId) {
        alert('Cannot unarchive - no lead pack record found');
        return;
      }

      const payload = {
        archive: 0,
        reason_archive: null,
        last_updated: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
      
      console.log(`[UNARCHIVE DEBUG] Unarchiving leadId ${leadId}:`, payload);
      await api.put(`/release/leads-released/${leadId}`, payload);
      
      alert(`Successfully unarchived ${agent.agentName}`);
      
      // Refresh data to show changes
      await handleRefresh();
    } catch (error) {
      console.error('Failed to unarchive release:', error);
      alert('Failed to unarchive release');
    }
  }, [combinedPassedData]);

  // Helper function to validate column structure
  const validateColumn = useCallback((col) => {
    if (!col || typeof col !== 'object') return false;
    if (!col.accessor || typeof col.accessor !== 'string') return false;
    if (!col.Header) return false;
    return true;
  }, []);

  // Helper function to ensure columns are valid and safe
  const safeColumns = useCallback((columns) => {
    if (!Array.isArray(columns)) return [];
    return columns.filter(validateColumn);
  }, [validateColumn]);

    // Define columns for different tabs
  const getUpcomingReleasesColumns = useMemo(() => {
    if (!currentTabData || !Array.isArray(currentTabData)) return [];
    
    const baseColumns = [];

    // Add DataTable's built-in mass selection column
    if (isAdmin) {
      baseColumns.push({
        Header: "Select",
        accessor: "massSelection",
        id: "massSelection",
        massSelection: true,
        width: 50,
      });
    }

    baseColumns.push({
        Header: "Agent Name",
        accessor: "agentName",
        Cell: ({ value }) => <span>{formatName(value)}</span>,
    });

    baseColumns.push({
        Header: "Release Scheduled",
        accessor: "releaseScheduled",
        Cell: ({ value, row }) => {
          if (isAdmin) {
            return (
              <input
                type="datetime-local"
                value={formatUTCForInput(value)}
                onChange={async (e) => {
                  const newVal = e.target.value;
                  const newUtc = localToUTC(newVal);
                  await api.put(`/release/schedule-release/${row.original.userId}`, {
                    releaseScheduled: newUtc,
                  });
                  setProgressData((pd) =>
                    pd.map((item) =>
                      item.userId === row.original.userId
                        ? { ...item, releaseScheduled: newUtc }
                        : item
                    )
                  );
                }}
                style={{ backgroundColor: "transparent", border: "none" }}
              />
            );
          }
          return formatUTCForDisplay(value);
        },
    });

    baseColumns.push({
        Header: "MGA",
        accessor: "mga",
        Cell: ({ value }) => <span>{formatName(value)}</span>,
    });

    if (isAdmin) {
      baseColumns.push({
        Header: "Actions",
        accessor: "actions",
        id: "actions",
        Cell: ({ row }) => {
          const agent = row.original;
          const status = actionStatus[agent.agentName];
          if (status === "Pass" || status === "Fail" || status === "Delete") {
            return (
              <>
                <button
                  className="insured-button"
                  onClick={() => handleConfirm(agent.agentName)}
                >
                  Confirm {status}
                </button>
                <button
                  className="insured-button"
                  onClick={() =>
                    setActionStatus((s) => ({
                      ...s,
                      [agent.agentName]: null,
                    }))
                  }
                >
                  Cancel
                </button>
              </>
            );
          }
          return (
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                className="insured-button"
                onClick={() => handleAction(agent.agentName, "Pass")}
              >
                Pass
              </button>
              <button
                className="insured-button"
                onClick={() => handleAction(agent.agentName, "Fail")}
              >
                Fail
              </button>
              <button
                className="insured-button"
                onClick={() => handleAction(agent.agentName, "Delete")}
              >
                Delete
              </button>
            </div>
          );
        },
      });
    }

    return baseColumns.filter(validateColumn) || [];
  }, [currentTabData, isAdmin, actionStatus, handleConfirm, handleAction, setActionStatus, formatName, validateColumn]);

    const getReadyToScheduleColumns = useMemo(() => {
    if (!currentTabData || !Array.isArray(currentTabData)) return [];
    
    const baseColumns = [];

    // Add DataTable's built-in mass selection column
    if (isAdmin) {
      baseColumns.push({
        Header: "Select",
        accessor: "massSelection",
        id: "massSelection",
        massSelection: true,
        width: 50,
      });
    }

    baseColumns.push({
      Header: "Agent Name",
      accessor: "agentName",
      Cell: ({ value }) => <span>{formatName(value)}</span>,
    });

    baseColumns.push({
      Header: "MGA",
      accessor: "mga",
      Cell: ({ value }) => <span>{formatName(value)}</span>,
    });

    baseColumns.push({
      Header: "Time Submitted",
      accessor: "timeSubmitted",
      Cell: ({ value }) => <span>{formatUTCForDisplay(value)}</span>,
    });

    if (isAdmin) {
      baseColumns.push({
        Header: "Actions",
        accessor: "actions",
        id: "actions",
        Cell: ({ row }) => {
          const agent = row.original;
          return (
            <button
              className="insured-button"
              onClick={(e) => {
                e.stopPropagation();
                setSchedulingAgent(agent);
              }}
            >
              Schedule
            </button>
          );
        },
      });
    }

    return baseColumns.filter(validateColumn) || [];
  }, [currentTabData, isAdmin, formatName, setSchedulingAgent, validateColumn]);

  const getPendingSchedulingColumns = useMemo(() => {
    const columns = [
    {
      Header: "Agent Name",
      accessor: "agentName",
      Cell: ({ value }) => <span>{formatName(value)}</span>,
    },
    {
      Header: "Code Date",
      accessor: "esid",
      Cell: ({ value }) => <span>{value || 'N/A'}</span>,
    },
    {
      Header: "MGA",
      accessor: "mga",
      Cell: ({ value }) => <span>{formatName(value)}</span>,
    },
    {
        Header: "Actions",
        accessor: "actions",
      id: "actions",
      Cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="insured-button"
            onClick={(e) => {
              e.stopPropagation();
              handleMarkReady(row.original);
            }}
          >
            Mark Ready
          </button>
          <button
            className="insured-button"
            onClick={(e) => {
              e.stopPropagation();
              handleHideAgent(row.original);
            }}
            style={{
              backgroundColor: (row.original.hide == 1 || row.original.hide === "1" || row.original.hide === true) ? '#28a745' : '#dc3545',
              color: 'white'
            }}
          >
            {(row.original.hide == 1 || row.original.hide === "1" || row.original.hide === true) ? 'Unhide' : 'Hide'}
          </button>
        </div>
      ),
    },
    ];
    return columns.filter(validateColumn) || [];
  }, [formatName, handleMarkReady, handleHideAgent, validateColumn]);

  const getInProgressColumns = useMemo(() => {
    const columns = [
    {
      Header: "Agent Name",
      accessor: "agentName",
      Cell: ({ value }) => <span>{formatName(value)}</span>,
    },
    {
      Header: "MGA",
      accessor: "mga",
      Cell: ({ value }) => <span>{formatName(value)}</span>,
    },
    {
      Header: "Code Date",
      accessor: "esid",
      Cell: ({ value }) => <span>{value || 'N/A'}</span>,
    },
    {
      Header: "Net ALP",
      accessor: "netAlp",
      id: "netAlp",
      Cell: ({ row }) => {
        const recap = row.original.__weeklyRecap;
        return <span>{recap?.LVL_1_NET || '—'}</span>;
      }
    },
    {
      Header: "Report Week",
      accessor: "reportWeek",
      id: "reportWeek",
      Cell: ({ row }) => {
        const recap = row.original.__weeklyRecap;
        if (!recap?.reportdate) return <span style={{ color: '#999' }}>—</span>;
        return <span>{new Date(recap.reportdate).toLocaleDateString()}</span>;
      }
    },
    {
      Header: "Actions",
      accessor: "actions",
      id: "actions",
      Cell: ({ row }) => {
        const agent = row.original;
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="insured-button"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  // 1) Auto-complete checklist
                  const completeResp = await api.post('/release/mark-checklist-complete', {
                    userId: agent.userId,
                  });
                  if (!completeResp.data?.success) {
                    return alert('Failed to auto-complete checklist');
                  }
                  // 2) Mark ready (same as Pending Request tab)
                  const readyResp = await api.post('/release/schedule-release', {
                    userId: agent.userId,
                  });
                  if (!readyResp.data?.success) {
                    return alert('Failed to mark ready');
                  }
                  alert(`${agent.agentName} marked ready to schedule.`);
                  await handleRefresh();
                } catch (err) {
                  alert('Error auto-completing and marking ready');
                }
              }}
              style={{ 
                backgroundColor: '#00558c', 
                color: 'white',
                fontSize: '12px', 
                padding: '6px 12px',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Mark Ready
            </button>
          </div>
        );
      },
    },
    ];
    return columns.filter(validateColumn) || [];
  }, [formatName, validateColumn]);

  const getPassedReleasesColumns = useMemo(() => {
    const columns = [
    {
      Header: "Agent Name",
      accessor: "agentName",
      Cell: ({ value }) => <span>{formatName(value)}</span>,
    },
    {
      Header: "Release Date",
      accessor: "releaseScheduled",
      Cell: ({ value }) => formatUTCForDisplay(value),
    },
    {
      Header: "MGA",
      accessor: "mga",
      Cell: ({ value }) => <span>{formatName(value)}</span>,
    },
    {
      Header: "States Licensed",
      accessor: "statesLicensed",
      Cell: ({ value }) => value || "N/A",
    },
    {
      Header: "2nd Code Pack Sent",
      accessor: "packReleasedDate",
      id: "secondPackSent",
      Cell: ({ value, row }) => {
        const agent = row.original;
        return isAdmin ? (
          agent.packReleasedDate && agent.packReleasedDate !== "N/A" ? (
            <button className="insured-button" style={{ 
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
            <button onClick={() => handleSecondPack(agent)} className="insured-button" style={{ 
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
      Header: "Code Pack Released Date",
      accessor: "packReleasedDate",
      Cell: ({ value, row }) => {
        const agent = row.original;
        if (isAdmin) {
          let defaultVal = "";
          if (value) {
            const [mdy, hm] = value.split(", ");
            const [M, D, YY] = mdy.split("/");
            const yyyy = `20${YY}`;
            const MM = M.padStart(2, "0");
            const DD = D.padStart(2, "0");
            defaultVal = `${yyyy}-${MM}-${DD}T${hm}`;
          }

          return (
            <input
              type="datetime-local"
              defaultValue={defaultVal}
              onBlur={async (e) => {
                const [datePart, timePart] = e.target.value.split("T");
                const [year, month, day] = datePart.split("-");
                const yy = year.slice(-2);
                const sentDate = `${parseInt(month)}/${parseInt(day)}/${yy}, ${timePart}`;

                const now = new Date();
                const nYY = now.getFullYear().toString().slice(-2);
                const lastUpdated =
                  `${now.getMonth()+1}/${now.getDate()}/${nYY}, ` +
                  `${now.getHours().toString().padStart(2,"0")}:` +
                  `${now.getMinutes().toString().padStart(2,"0")}`;

                if (agent.leadId) {
                  await api.put(`/release/leads-released/${agent.leadId}`, {
                    sent_date: sentDate,
                    last_updated: lastUpdated,
                  });
                } else {
                  const payload = {
                    type: "2nd Pack",
                    notes: null,
                    last_updated: lastUpdated,
                    userId: agent.userId,
                    lagnname: agent.agentName,
                    sent: 1,
                    sent_date: sentDate,
                    sent_by: null,
                  };
                  const response = await api.post('/release/leads-released', payload);
                  const json = response.data;
                  if (json.success) {
                    agent.leadId = json.data.id;
                    setLeadsReleased(prev => [...prev, json.data]);
                  }
                }

                setProgressData(pd =>
                  pd.map(item =>
                    item.userId === agent.userId
                      ? { ...item, packReleasedDate: sentDate, lastUpdated }
                      : item
                  )
                );
                setLeadsReleased(lr =>
                  lr.map(l =>
                    l.id === agent.leadId
                      ? { ...l, sent_date: sentDate, last_updated: lastUpdated }
                      : l
                  )
                );
              }}
              style={{
                width: "180px",
                backgroundColor: "transparent",
                border: "none"
              }}
            />
          );
        }
        return value || "N/A";
      },
    },
    {
      Header: "Last Updated",
      accessor: "lastUpdated",
        Cell: ({ value }) => formatUTCForDisplay(value),
    },
    {
      Header: "Notes",
      accessor: "notes",
      Cell: ({ value, row, isEditing, updateCell }) => {
        const agent = row.original;
        // Get the current edited value or fallback to original value
        const currentEditedValue = editedRows[agent.userId]?.notes;
        const notesVal = currentEditedValue !== undefined ? currentEditedValue : (value || '');
        const canEdit = isAdmin && agent.leadId;
        
        if (!canEdit) {
          return <span>{notesVal || "N/A"}</span>;
        }
        
        // If cell is being edited, render input field
        if (isEditing) {
          return (
          <input
            type="text"
              value={notesVal}
              onChange={(e) => {
                console.log('📝 Notes cell editing:', agent.userId, e.target.value);
                handleCellEdit(agent.userId, 'notes', e.target.value);
              }}
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
      editable: isAdmin
    },
    {
      Header: "Archive",
      accessor: "archive",
      id: "archive",
      Cell: ({ row }) => {
        const agent = row.original;
        const isArchived = agent.leadEntry?.archive == 1;
        const canArchive = isAdmin && agent.leadId && !isArchived;
        const canUnarchive = isAdmin && agent.leadId && isArchived;
        
        if (archivedView) {
          // In archived view, show unarchive button and archive reason
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {canUnarchive && (
                <button
                  onClick={() => handleUnarchive(agent.userId)}
                  className="insured-button"
                  style={{ 
                    backgroundColor: '#28a745',
                    color: 'white',
                    fontSize: '10px',
                    padding: '4px 8px',
                    border: 'none',
                    borderRadius: '3px'
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
            className="insured-button"
            style={{ 
              backgroundColor: '#dc3545',
              color: 'white',
              fontSize: '10px',
              padding: '4px 8px',
              border: 'none',
              borderRadius: '3px'
            }}
          >
            Archive
          </button>
        );
      },
    },
    ];
    return columns.filter(validateColumn) || [];
  }, [formatName, isAdmin, handleSecondPack, setLeadsReleased, setProgressData, updateNotes, validateColumn, editedRows, handleCellEdit, handleArchive, handleUnarchive, archivedView]);

  // Helper function to export JSON data to an Excel file using SheetJS
  const exportToExcel = (data, fileName = 'export.xlsx') => {
    if (!data.length) return;
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, fileName);
  };



  // Helper to convert a yyyy-mm-dd date (from the native input type date)
  // into mm/dd/yyyy format.
  const convertToMDY = (dateValue) => {
    if (!dateValue) return '';
    const [year, month, day] = dateValue.split('-');
    return `${month}/${day}/${year}`;
  };

  // Helper function to format current date in M/D/YY h:m (Eastern Time)
  const getCurrentESTFormatted = () => {
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
    return now.toLocaleString("en-US", options);
  };






  // Load functions that are used in the handler functions above
  loadUnscheduledReleases = async () => {
    try {
      let unscheduledData = [];

      if (isAdmin) {
        // Admin can see all unscheduled releases
        const response = await api.get('/release/get-unscheduled-releases');
        if (response.data.success) {
          unscheduledData = response.data.data;
        }
      } else if (isManager) {
        // Managers: first get hierarchy, then get all data and filter
        
        
        // Get hierarchy IDs
        const hierarchyResponse = await api.post('/auth/searchByUserId', { userId });
        if (hierarchyResponse.data.success) {
          const hierarchyUserIds = hierarchyResponse.data.data.map(user => user.id);
          
          
          // Get all unscheduled releases using admin endpoint
          const allDataResponse = await api.get('/release/get-unscheduled-releases');
          if (allDataResponse.data.success) {
            // Filter by hierarchy IDs
            unscheduledData = allDataResponse.data.data.filter(release => 
              hierarchyUserIds.includes(release.user_id)
            );
            
          }
        }
      } else {
        // Regular users shouldn't see this, but just in case
        const response = await api.get('/release/get-unscheduled-releases');
        if (response.data.success) {
          unscheduledData = response.data.data;
        }
      }

      
      const mapped = unscheduledData.map((r) => ({
        id: r.id,
        agentName: r.lagnname || `Agent ${r.id}`,
        userId: r.user_id,
        mga: r.mga,
        timeSubmitted: r.time_submitted,
      }));
      setUnscheduledReleases(mapped);
    } catch (error) {
      
    }
  };



  loadLeadsReleased = async () => {
    try {
      let leadsReleasedData = [];

      if (isAdmin) {
        // Admin can see all leads released
        const response = await api.get('/release/leads-released');
        if (response.data.success) {
          leadsReleasedData = response.data.data;
        }
      } else if (isManager) {
        // Managers: first get hierarchy, then get all data and filter
        
        
        // Get hierarchy IDs
        const hierarchyResponse = await api.post('/auth/searchByUserId', { userId });
        if (hierarchyResponse.data.success) {
          const hierarchyUserIds = hierarchyResponse.data.data.map(user => user.id);
          
          
          // Get all leads released using admin endpoint
          const allDataResponse = await api.get('/release/leads-released');
          if (allDataResponse.data.success) {
            // Filter by hierarchy IDs (assuming leads_released has userId field)
            leadsReleasedData = allDataResponse.data.data.filter(lead => 
              hierarchyUserIds.includes(lead.userId)
            );
            
          }
        }
      } else {
        // Regular users shouldn't see this, but just in case
        const response = await api.get('/release/leads-released');
        if (response.data.success) {
          leadsReleasedData = response.data.data;
        }
      }

      // Store all for filtering logic (includes 1st Pack rows)
      setLeadsReleasedAll(leadsReleasedData || []);
      // Maintain second pack slice where needed
      const secondPackOnly = (leadsReleasedData || []).filter(lead => lead.type === '2nd Pack' || lead.type === 'Second Pack');
      setLeadsReleased(secondPackOnly);
    } catch (error) {
      
    }
  };

  // Memoize deduplicateAgents function
  const deduplicateAgents = useCallback((data) => {
    const seen = new Set();
    return data.filter((agent) => {
      const key = `${agent.agentName}-${agent.userId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  // Memoize handleSort function
  const handleSort = useCallback((key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  // Memoize sortedData function
  const sortedData = useCallback((data, sortKey = sortConfig.key, sortDirection = sortConfig.direction) => {
    if (!sortKey) return data;
    
    return [...data].sort((a, b) => {
      let aValue = a[sortKey];
      let bValue = b[sortKey];

      if (sortKey === "releaseScheduled") {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } else if (sortKey === "progress") {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else if (typeof aValue === "string" && typeof bValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [sortConfig]);



  // Filter unscheduled releases for ready to schedule tab badge
  const readyToScheduleFiltered = useMemo(() => {
    const isAdmin = user?.clname === 'Admin' || user?.Role === 'Admin';
    const readyToScheduleData = isAdmin
      ? unscheduledReleases
      : unscheduledReleases.filter(r =>
          progressData.some(pd => pd.userId === r.userId)
        );
    return filterData(readyToScheduleData);
  }, [unscheduledReleases, progressData, filterData, user]);

  // Memoize tab change handler
  const handleTabChange = useCallback((tabKey) => {
    setActiveTab(tabKey);
  }, []);

  // Memoize tabs configuration to show filtered counts in badges
  const tabs = useMemo(() => [
    {
      key: "upcomingReleases",
      label: "Upcoming Releases",
      badge: upcomingReleasesData.length || null
    },
    {
      key: "readyToSchedule",
      label: "Ready to Schedule",
      badge: readyToScheduleFiltered.length || null
    },
    // Pending Request tab hidden
    {
      key: "checklistInProgress",
      label: "Pending Request",
      badge: checklistInProgressData.length || null
    },
    {
      key: "passedReleases",
      label: "Passed Releases",
      badge: combinedPassedData.filter(agent => {
        if (secondPackFilter === "all") return true;
        if (secondPackFilter === "sent") return agent.packReleasedDate && agent.packReleasedDate !== "N/A";
        if (secondPackFilter === "notSent") {
          const lead = leadsReleased.find(l => l.userId == agent.userId && (l.type === '2nd Pack' || l.type === 'Second Pack'));
          return !lead || lead.sent == 0;
        }
        return true;
      }).length || null
    }
  ], [upcomingReleasesData.length, readyToScheduleFiltered.length, pendingSchedulingData.length, checklistInProgressData.length, combinedPassedData, secondPackFilter, leadsReleased]);

  // Handle scheduling a single agent by JA_Release row id
  const handleScheduleAgent = async (agent) => {
    if (!scheduleDate || !scheduleTime) {
      return alert("Please select both a date and time");
    }

    const isoTs = localToUTC(`${scheduleDate}T${scheduleTime}`);

    try {
      const response = await api.put(`/release/schedule-release/${agent.userId}`, {
        releaseScheduled: isoTs,
      });

      if (!response.data.success) {
        return alert("Failed to schedule: " + response.data.message);
      }

      setUnscheduledReleases(prev =>
        prev.filter(r => r.id !== agent.id)
      );

      setScheduleDate("");
      setScheduleTime("");
      setSchedulingAgent(null);
      alert(`Scheduled ${agent.agentName} for ${formatUTCForDisplay(isoTs)}`);
      
      // Automatically refresh data to show changes
      console.log('🔄 Auto-refreshing after individual schedule action');
      await handleRefresh();
    } catch (error) {
      
      alert("Error scheduling agent—see console.");
    }
  };

  const handleBulkSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      return alert('Pick a date & time first');
    }
    const ts = localToUTC(`${scheduleDate}T${scheduleTime}`);

    try {
      // Get the userId for each selected unscheduled release
      const selectedReleases = unscheduledReleases.filter(r => selectedUnscheduled.includes(r.id));
      
      await Promise.all(
        selectedReleases.map(release =>
          api.put(`/release/schedule-release/${release.userId}`, {
            releaseScheduled: ts
          })
        )
      );

      setSelectedUnscheduled([]);
      setScheduleDate('');
      setScheduleTime('');
      alert('All selected agents scheduled!');
      
      // Automatically refresh all data to show changes
      console.log('🔄 Auto-refreshing after Schedule All action');
      await handleRefresh();
    } catch (error) {
      
      alert('Something went wrong scheduling');
    }
  };

  const handleMassAction = async (action) => {
    if (massAction === null) {
      setMassAction(action);
      return;
    }

    try {
      const requests = selectedAgents.map((agentName) => {
        const selectedAgent = agents.find((agent) => agent.lagnname === agentName);
        return api.post(
          action === "Pass" ? "/release/pass-user" : "/release/fail-user",
          { userId: selectedAgent.id }
        );
      });

      await Promise.all(requests);
      setProgressData((prevData) =>
        prevData.filter((agent) => !selectedAgents.includes(agent.agentName))
      );
      setSelectedAgents([]);
      setMassAction(null);
      
    } catch (error) {
      
      setMassAction(null);
    }
  };

  loadLicensedStates = async () => {
    try {
      const response = await api.get('/release/licensed-states');
      const data = response.data;
      
      if (data.success) {
        setLicensedStates(data.data);
      } else {
        
      }
    } catch (error) {
      
    }
  };

  const calculateProgress = (responses) => {
    let completedItems = 0;

    // Validated numeric fields must match exact answers
    if (responses.contract_2nd && String(responses.contract_2nd) === correctAnswers.contract_2nd) {
      completedItems += 1;
    }
    if (responses.bonus_90d && String(responses.bonus_90d) === correctAnswers.bonus_90d) {
      completedItems += 1;
    }
    if (responses.bonus_after_90d && String(responses.bonus_after_90d) === correctAnswers.bonus_after_90d) {
      completedItems += 1;
    }

    // Radio keys are complete only when 'y'
    radioKeys.forEach((key) => {
      if (responses[key] === 'y') completedItems += 1;
    });

    // Boolean-ish fields count when truthy (1/true)
    booleanKeys.forEach((key) => {
      if (responses[key]) completedItems += 1;
    });

    // Add increments for practice presentations and refs collected
    completedItems += Math.min(responses.practice_pres || 0, 10);
    completedItems += Math.min(responses.refs_25 || 0, 25);

    return (completedItems / TOTAL_PROGRESS_ITEMS) * 100;
  };

  // Removed user-specific debug breakdown

  const fetchAgentProgress = async (agentChecklist) => {
    return calculateProgress(agentChecklist);
  };

  loadProgressData = async () => {
    setLoading(true);

    try {
      let agentsData = [];
      
      if (isAdmin) {
        // Admin can see all unreleased users
        const response = await api.get('/release/get-unreleased-users-checklist');
        if (response.data.success) {
          agentsData = response.data.data;
        }
      } else if (isManager) {
        // Managers: first get hierarchy, then get all data and filter
        
        
        // Get hierarchy IDs
        const hierarchyResponse = await api.post('/auth/searchByUserId', { userId });
        if (hierarchyResponse.data.success) {
          const hierarchyUserIds = hierarchyResponse.data.data.map(user => user.id);
          
          
          // Get all data using admin endpoint
          const allDataResponse = await api.get('/release/get-unreleased-users-checklist');
          if (allDataResponse.data.success) {
            // Filter by hierarchy IDs
            agentsData = allDataResponse.data.data.filter(agent => 
              hierarchyUserIds.includes(agent.id)
            );
            
          }
        }
      } else {
        // Regular users shouldn't see this table, but just in case
        const response = await api.get('/release/get-unreleased-users-checklist');
        if (response.data.success) {
          agentsData = response.data.data;
        }
      }

      
      if (isManager) {
        
      }
      setAgents(agentsData);

      const agentProgressPromises = agentsData.map(async (agent) => {
          // Note: agent.id is activeusers.id (primary key)
          // agent.user_id is JA_Release.user_id (foreign key to activeusers.id)
          // All backend endpoints expect activeusers.id
          
          const progress = await fetchAgentProgress(agent);
          return {
            id: agent.id, // Add unique ID for React Table
            agentName: agent.lagnname || `Agent ${agent.id}`,
            userId: agent.id, // Always use activeusers.id - this is what backend expects
            activeusersId: agent.id, // Store the activeusers.id for reference
            progress,
            releaseScheduled: agent.release_scheduled,
            timeSubmitted: agent.time_submitted,
            mga: agent.mga,
            passed: agent.passed,
            released: agent.released,
            hide: agent.hide,
            esid: agent.esid,
          };
        });

        const progressArray = await Promise.all(agentProgressPromises);

        // Removed targeted debug

        // Spot counts logging per clarified rule:
        // A spot is taken when release_scheduled is null AND time_submitted is within this week
        try {
          const now = new Date();
          const day = now.getDay(); // 0 = Sun, 1 = Mon, ...
          const startOfWeek = new Date(now);
          startOfWeek.setHours(0, 0, 0, 0);
          // Move to Monday
          startOfWeek.setDate(now.getDate() - ((day + 6) % 7));
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 7);
          endOfWeek.setMilliseconds(endOfWeek.getMilliseconds() - 1);

          const isWithinThisWeek = (ts) => {
            if (!ts) return false;
            const d = new Date(ts);
            return d >= startOfWeek && d <= endOfWeek;
          };

          const taken = progressArray.filter(a => (a.releaseScheduled == null) && isWithinThisWeek(a.timeSubmitted));
          const remaining = progressArray.filter(a => (
            a.passed !== 'y' && a.progress === 100 && (a.releaseScheduled == null) && !isWithinThisWeek(a.timeSubmitted)
          ));

          
        } catch (e) {}

        // Also log full agent list with percent, matching requested format
        try {
          if (isManager) {
            console.log(`[Load Progress Data] Manager ${userId} agents:`, progressArray.map(a => ({ name: a.agentName, id: a.userId, progress: `${Math.round(a.progress)}%` })));
          }
        } catch (e) {}

        setProgressData(progressArray);
    } catch (error) {
      
    }

    setLoading(false);
  };


  useEffect(() => {
    loadUnscheduledReleases();
    loadProgressData();
    loadLeadsReleased();
    loadLicensedStates();
    // Load Weekly Recap for current tab (pending request)
    (async () => {
      try {
        const names = (checklistInProgressData || []).map(a => a.agentName).filter(Boolean);
        if (names.length) {
          const resp = await api.post('/dataroutes/weekly-alp/latest-weekly-recap', { names });
          if (resp.data?.success) {
            const map = new Map(resp.data.data.map(r => [r.LagnName, r]));
            setProgressData(prev => prev.map(a => ({ ...a, __weeklyRecap: map.get(a.agentName) || null })));
          }
        }
      } catch (_) {}
    })();
  }, []);

  // Refresh Weekly Recap mapping whenever the data in the Pending Request tab changes
  useEffect(() => {
    (async () => {
      try {
        const names = (checklistInProgressData || []).map(a => a.agentName).filter(Boolean);
        if (names.length) {
          const resp = await api.post('/dataroutes/weekly-alp/latest-weekly-recap', { names });
          if (resp.data?.success) {
            const map = new Map(resp.data.data.map(r => [r.LagnName, r]));
            setProgressData(prev => prev.map(a => ({ ...a, __weeklyRecap: map.get(a.agentName) || null })));
          }
        }
      } catch (_) {}
    })();
  }, [checklistInProgressData]);

  useEffect(() => {
    setSortConfig({ key: "releaseScheduled", direction: "desc" });
  }, []);

  // Debug logging for selection state changes
  useEffect(() => {
    console.log('🔍 Selection state changed - selectedAgents:', selectedAgents);
  }, [selectedAgents]);

  useEffect(() => {
    console.log('🔍 Selection state changed - selectedUnscheduled:', selectedUnscheduled);
  }, [selectedUnscheduled]);

  useEffect(() => {
    console.log('🔍 Active tab changed to:', activeTab);
  }, [activeTab]);



  if (loading) {
    return <div className="loading">Loading agent progress data...</div>;
  }

  // Debug log on every render
  console.log('🔄 AgentProgressTable render:', {
    activeTab,
    selectedAgents: selectedAgents.length,
    selectedUnscheduled: selectedUnscheduled.length,
    isAdmin,
    currentTabDataLength: currentTabData?.length
  });

  return (
    <div className="agent-progress-table-container">
      <div className="search-bar mb-4">
        <input
          type="text"
          className="form-control"
          placeholder="Search by agent name or MGA..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        styleSet="modern"
        className=""
      >
        {activeTab === "upcomingReleases" && (
          <>
            {(() => {
              console.log('🎯 Upcoming Releases ActionBar Render:');
              console.log('  - selectedAgents.length:', selectedAgents.length);
              console.log('  - selectedAgents:', selectedAgents);
              console.log('  - currentTabData?.length:', currentTabData?.length);
              console.log('  - isAdmin:', isAdmin);
              console.log('  - Should show buttons?', isAdmin && selectedAgents.length > 0);
              return null;
            })()}
            <ActionBar
              selectedCount={selectedAgents.length}
              totalCount={currentTabData?.length || 0}
              entityName="agents"
              archivedView={false}
              actionBarButtons={{
                refresh: selectedAgents.length === 0 // Only show refresh when no agents are selected
              }}
              onRefresh={handleRefresh}
            >
              {/* Mass Action Buttons - Only render when admin and items selected */}
              {(() => {
                console.log('📋 Inside ActionBar children render - Upcoming Releases');
                console.log('  - isAdmin:', isAdmin);
                console.log('  - selectedAgents.length:', selectedAgents.length);
                console.log('  - Condition result:', isAdmin && selectedAgents.length > 0);
                return null;
              })()}
              {isAdmin && selectedAgents.length > 0 && (
                <>
                  {(() => {
                    console.log('🎯 Rendering mass action buttons for Upcoming Releases');
                    return null;
                  })()}
                      <button
                        className="insured-button"
                    onClick={handleMassPassAll}
                    style={{ 
                      backgroundColor: '#28a745', 
                      color: 'white',
                      fontSize: '12px',
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '4px',
                      marginRight: '8px'
                    }}
                      >
                    Pass All ({selectedAgents.length})
                      </button>
                      <button
                        className="insured-button"
                    onClick={handleMassFailAll}
                    style={{ 
                      backgroundColor: '#dc3545', 
                      color: 'white',
                      fontSize: '12px',
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '4px',
                      marginRight: '8px'
                    }}
                      >
                    Fail All ({selectedAgents.length})
                      </button>
                        <button
                          className="insured-button"
                    onClick={handleMassDeleteAll}
                    style={{ 
                      backgroundColor: '#6c757d', 
                      color: 'white',
                      fontSize: '12px',
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '4px',
                      marginRight: '8px'
                    }}
                        >
                    Delete All ({selectedAgents.length})
                        </button>
                  {canSendEmail && (
                    <button
                      className="insured-button"
                      onClick={handleSendEmail}
                      style={{ 
                        backgroundColor: '#007bff', 
                        color: 'white',
                        fontSize: '12px',
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        marginRight: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <FaEnvelope /> Send Email ({selectedAgents.length})
                    </button>
                  )}
                  <button
                    className="insured-button"
                    onClick={() => setSelectedAgents([])}
                    style={{ 
                      backgroundColor: 'white', 
                      color: '#6c757d',
                      border: '1px solid #6c757d',
                      fontSize: '12px',
                      padding: '6px 12px',
                      borderRadius: '4px'
                    }}
                  >
                    Clear Selection
                  </button>
                </>
              )}
            </ActionBar>

            <DataTable
  key={JSON.stringify(actionStatus)}
  columns={safeColumns(getUpcomingReleasesColumns)}
  data={currentTabData}
  defaultSortBy="releaseScheduled"
  defaultSortOrder="desc"
  showActionBar={false}
  entityName="release"
  disableCellEditing={true}
  customRowStyles={(row) => {
    if (!row.releaseScheduled) return {};
    const releaseDate = new Date(row.releaseScheduled);
    const now = new Date();

    return releaseDate < now
      ? { backgroundColor: "rgba(220, 53, 69, 0.1)" }
      : {};
  }}
  onSortChange={handleSort}
              onSelectionChange={(selectedRowIds) => {
                console.log('🎯 DataTable onSelectionChange called for Upcoming Releases:', selectedRowIds);
                handleUpcomingReleasesSelectionChange(selectedRowIds);
              }}
/>


          </>
        )}

        {activeTab === "readyToSchedule" && (
          <>
            {(() => {
              console.log('🎯 Ready to Schedule ActionBar Render:');
              console.log('  - selectedUnscheduled.length:', selectedUnscheduled.length);
              console.log('  - selectedUnscheduled:', selectedUnscheduled);
              console.log('  - currentTabData?.length:', currentTabData?.length);
              console.log('  - isAdmin:', isAdmin);
              console.log('  - Should show buttons?', isAdmin && selectedUnscheduled.length > 0);
              return null;
            })()}
            {schedulingAgent && (
              <div
                className="scheduling-form mb-4 p-3"
                style={{ backgroundColor: "#f8f9fa", borderRadius: "5px" }}
              >
                <h5>Schedule {schedulingAgent.agentName} for Release</h5>
                <div className="row">
                  <div className="col-md-4">
                    <label>Date:</label>
                    <input
                      type="date"
                      className="form-control"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label>Time:</label>
                    <input
                      type="time"
                      className="form-control"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4 d-flex align-items-end">
                    <button
                      className="insured-button mr-2"
                      onClick={() => handleScheduleAgent(schedulingAgent)}
                    >
                      Schedule
                    </button>
                    <button
                      className="insured-button"
                      onClick={() => {
                        setSchedulingAgent(null);
                        setScheduleDate("");
                        setScheduleTime("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <ActionBar
              selectedCount={selectedUnscheduled.length}
              totalCount={currentTabData?.length || 0}
              entityName="agents"
              archivedView={false}
              actionBarButtons={{
                refresh: selectedUnscheduled.length === 0 // Only show refresh when no agents are selected
              }}
              onRefresh={handleRefresh}
            >
              {/* Mass Action Buttons with Scheduling Inputs - Only render when admin and items selected */}
              {(() => {
                console.log('📋 Inside ActionBar children render - Ready to Schedule');
                console.log('  - isAdmin:', isAdmin);
                console.log('  - selectedUnscheduled.length:', selectedUnscheduled.length);
                console.log('  - Condition result:', isAdmin && selectedUnscheduled.length > 0);
                return null;
              })()}
              {isAdmin && selectedUnscheduled.length > 0 && (
                <>
                  {/* Date and Time Inputs */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
                    <label style={{ fontSize: '12px', color: '#666', marginRight: '4px' }}>Date:</label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      style={{ 
                        padding: '4px 8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                    <label style={{ fontSize: '12px', color: '#666', marginLeft: '8px', marginRight: '4px' }}>Time:</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      style={{ 
                        padding: '4px 8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                  
                  {/* Action Buttons - Only Schedule All and Clear Selection for Ready to Schedule */}
                  <button
                    className="insured-button"
                    onClick={handleBulkSchedule}
                    disabled={!scheduleDate || !scheduleTime}
                    style={{ 
                      backgroundColor: !scheduleDate || !scheduleTime ? '#6c757d' : '#007bff',
                      color: 'white',
                      fontSize: '12px',
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '4px',
                      marginRight: '8px',
                      opacity: !scheduleDate || !scheduleTime ? 0.6 : 1,
                      cursor: !scheduleDate || !scheduleTime ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Schedule All ({selectedUnscheduled.length})
                    </button>
                  
                    <button
                    className="insured-button"
                    onClick={() => {
                      setSelectedUnscheduled([]);
                      setScheduleDate('');
                      setScheduleTime('');
                    }}
                    style={{ 
                      backgroundColor: 'white', 
                      color: '#6c757d',
                      border: '1px solid #6c757d',
                      fontSize: '12px',
                      padding: '6px 12px',
                      borderRadius: '4px'
                    }}
                  >
                    Clear Selection
                    </button>
                </>
              )}
            </ActionBar>
              
            <DataTable
              columns={safeColumns(getReadyToScheduleColumns)}
              data={currentTabData || []}
              defaultSortBy="timeSubmitted"
              defaultSortOrder="desc"
              showActionBar={false}
              entityName="agent"
              disableCellEditing={true}
              onSelectionChange={(selectedRowIds) => {
                console.log('🎯 DataTable onSelectionChange called for Ready to Schedule:', selectedRowIds);
                handleReadyToScheduleSelectionChange(selectedRowIds);
              }}
            />

          </>
        )}

        {/* Pending Request tab removed */}

        {activeTab === "checklistInProgress" && (
          <>
            <DataTable
              columns={safeColumns(getInProgressColumns)}
              data={currentTabData || []}
              showActionBar={false}
              entityName="agent"
              disableCellEditing={true}
            />
          </>
        )}

        {activeTab === "passedReleases" && (
          <>
            <ActionBar
              selectedCount={0}
              totalCount={currentTabData?.length || 0}
              entityName="releases"
              archivedView={archivedView}
              actionBarButtons={{
                saveChanges: hasUnsavedChanges,
                cancelChanges: hasUnsavedChanges,
                archive: true,
                toggleArchived: true
              }}
              onSaveChanges={handleSaveChanges}
              onCancelChanges={handleCancelChanges}
              onArchive={handleArchive}
              onToggleArchivedView={handleToggleArchivedView}
            >
              {/* Export to Excel button */}
              <button
                className="insured-button"
                onClick={() => {
                  const sortedExportData = sortedData(
                    currentTabData,
                    "releaseScheduled",
                    "desc"
                  );
                  const exportData = sortedExportData.map((row) => ({
                    agentName: row.agentName,
                    releaseScheduled: row.releaseScheduled
                      ? new Date(row.releaseScheduled).toLocaleString("en-US", {
                          month: "2-digit",
                          day: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "N/A",
                    mga: row.mga,
                    packReleasedDate: row.packReleasedDate
                      ? new Date(row.packReleasedDate).toLocaleString("en-US", {
                          month: "2-digit",
                          day: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "N/A",
                    lastUpdated: row.lastUpdated
                      ? new Date(row.lastUpdated).toLocaleString("en-US", {
                          month: "2-digit",
                          day: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "N/A",
                    statesLicensed: row.statesLicensed,
                    notes: row.notes,
                  }));
                  exportToExcel(exportData, "passedReleases.xlsx");
                }}
                title="Export to Excel"
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: '1px solid #28a745',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Export to Excel
              </button>
              
              {/* Filter buttons */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  onClick={() => setSecondPackFilter("all")}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: secondPackFilter === "all" ? '#00558c' : 'transparent',
                    color: secondPackFilter === "all" ? 'white' : '#666',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  All
                </button>
                <button 
                  onClick={() => setSecondPackFilter("sent")}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: secondPackFilter === "sent" ? '#00558c' : 'transparent',
                    color: secondPackFilter === "sent" ? 'white' : '#666',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Sent
                </button>
                <button 
                  onClick={() => setSecondPackFilter("notSent")}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: secondPackFilter === "notSent" ? '#00558c' : 'transparent',
                    color: secondPackFilter === "notSent" ? 'white' : '#666',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Not Sent
                </button>
              </div>
            </ActionBar>

            <DataTable
              columns={safeColumns(getPassedReleasesColumns)}
              data={currentTabData || []}
              defaultSortBy="releaseScheduled"
              defaultSortOrder="desc"
              showActionBar={false}
              entityName="release"
              disableCellEditing={false}
              onCellUpdate={handleCellEdit}
              onSaveChanges={handleSaveChanges}
              onCancelChanges={handleCancelChanges}
            />
          </>
        )}
      </Tabs>
      
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

export default AgentProgressTable; 