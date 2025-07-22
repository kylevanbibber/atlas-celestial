import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import * as XLSX from "xlsx";
import api from "../../api";
import Tabs from "../utils/Tabs";
import DataTable from "../utils/DataTable";
import ActionBar from "../utils/ActionBar";
import { formatUTCForDisplay, formatUTCForInput, localToUTC } from "../../utils/dateUtils";
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

    // User role variables
  const userRole = user?.Role || user?.clname;
  const userId = user?.userId;
  const isAdmin = userRole === "Admin" || userId === "101";
  const isManager = ['SA', 'GA', 'MGA', 'RGA'].includes(userRole);
  
  // Debug user role detection
  console.log(`[User Role Detection] User:`, { 
    Role: user?.Role, 
    clname: user?.clname, 
    userId: user?.userId,
    userRole, 
    isAdmin, 
    isManager 
  });

  const filteredProgressKeys = [
    "contract_2nd",
    "bonus_90d",
    "bonus_after_90d",
    "practice_pres",
    "refs_25",
  ];
  const totalProgressItems = filteredProgressKeys.length + 10 + 25;

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
      console.log(`[Upcoming Releases] Manager MGA filtering: ${userMgaName}`);
      console.log(`[Upcoming Releases] Agents before MGA filter: ${progressData.filter(agent => agent.releaseScheduled !== null && agent.passed !== "y").length}`);
      console.log(`[Upcoming Releases] Agents after MGA filter: ${filtered.length}`);
    }
    
    console.log(`[Upcoming Releases] User Role: ${userRole}, Is Manager: ${isManager}, Is Admin: ${isAdmin}`);
    console.log(`[Upcoming Releases] User lagnname: ${user?.lagnname}`);
    console.log(`[Upcoming Releases] Total progress data: ${progressData.length}, Filtered upcoming: ${filtered.length}`);
    if (isManager) {
      console.log(`[Upcoming Releases] Manager ${userId} upcoming releases:`, filtered.map(a => ({ name: a.agentName, userId: a.userId, mga: a.mga })));
    }
    return filtered;
  }, [progressData, userRole, isManager, isAdmin, userId, user?.lagnname]);

  const pendingSchedulingData = useMemo(() => {
    return progressData.filter(agent => {
      const passesProgress = agent.progress === 100 && agent.releaseScheduled === null;
      // Handle different data types for hide field (string, number, null, undefined)
      const isHidden = agent.hide == 1 || agent.hide === "1" || agent.hide === true;
      const passesHideFilter = isHiddenView ? isHidden : !isHidden;
      return passesProgress && passesHideFilter;
    });
  }, [progressData, isHiddenView]);

  const checklistInProgressData = useMemo(() => {
    return progressData.filter(agent => {
      const passesProgress = agent.progress < 100;
      const passesReleased = agent.released === 0;
      return passesProgress && passesReleased;
    });
  }, [progressData]);

  const passedReleasesData = useMemo(() => {
    return progressData
      .filter(agent => agent.passed === "y")
      .sort((a, b) => {
        // Sort by release date (newest to oldest)
        const dateA = new Date(a.releaseScheduled || 0);
        const dateB = new Date(b.releaseScheduled || 0);
        return dateB - dateA; // Descending order (newest first)
      });
  }, [progressData]);

  // Memoize combined passed data calculation
  const combinedPassedData = useMemo(() => {
    return passedReleasesData.map((agent) => {
      const leadInfo = leadsReleased.find((lead) => lead.userId == agent.userId);

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

      return {
        ...agent,
        packReleasedDate: leadInfo ? leadInfo.sent_date : agent.packReleasedDate,
        notes: leadInfo ? leadInfo.notes : agent.notes,
        lastUpdated: leadInfo ? leadInfo.last_updated : agent.lastUpdated,
        leadId: leadInfo ? leadInfo.id : null,
        statesLicensed,
      };
    });
  }, [passedReleasesData, leadsReleased, licensedStates]);

  // Memoize the current tab's data to avoid unnecessary calculations
  const currentTabData = useMemo(() => {
    switch (activeTab) {
      case "upcomingReleases":
        return filterData(upcomingReleasesData);
      case "readyToSchedule":
        const isAdmin = user?.clname === 'Admin' || user?.Role === 'Admin';
        return filterData(
          isAdmin
            ? unscheduledReleases
            : unscheduledReleases.filter(r =>
                progressData.some(pd => pd.userId === r.userId)
              )
        );
      case "pendingScheduling":
        return filterData(pendingSchedulingData);
      case "checklistInProgress":
        return filterData(checklistInProgressData);
      case "passedReleases":
        return filterData(combinedPassedData).filter(agent => {
          if (secondPackFilter === "all") return true;
          if (secondPackFilter === "sent") return agent.packReleasedDate && agent.packReleasedDate !== "N/A";
          if (secondPackFilter === "notSent") return !agent.packReleasedDate || agent.packReleasedDate === "N/A";
          return true;
        });
      default:
        return [];
    }
  }, [activeTab, filterData, upcomingReleasesData, unscheduledReleases, pendingSchedulingData, checklistInProgressData, combinedPassedData, secondPackFilter, progressData, user]);

  // Handler functions that are used in column definitions - defined before column definitions
  const toggleSelection = useCallback((agentName) => {
    setSelectedAgents((prevSelected) =>
      prevSelected.includes(agentName)
        ? prevSelected.filter((name) => name !== agentName)
        : [...prevSelected, agentName]
    );
  }, []);

  const toggleUnscheduledSelection = useCallback((id) => {
    setSelectedUnscheduled(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
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
      console.error("Agent not found:", agentName);
      return;
    }

    console.log(`Initiating ${action} action for agentName: ${agentName}, userId: ${selectedAgent.userId}`);

    try {
      let response;
      if (action === "Pass") {
        response = await api.post("/release/pass-user", { userId: selectedAgent.userId });
      } else if (action === "Fail") {
        response = await api.post("/release/fail-user", { userId: selectedAgent.userId });
      } else if (action === "Delete") {
        response = await api.delete(`/release/delete-user/${selectedAgent.userId}`);
      }

      const data = response.data;
      if (data.success) {
        console.log(`Successfully confirmed ${action} for agentName: ${agentName}, userId: ${selectedAgent.userId}`);
        
        // Remove the agent from the UI
        setProgressData((prevData) =>
          prevData.filter((agent) => agent.agentName !== agentName)
        );
        setActionStatus((prevState) => {
          const updatedState = { ...prevState };
          delete updatedState[agentName];
          return updatedState;
        });
        
        alert(`${agentName} has been ${action.toLowerCase()}ed successfully.`);
      } else {
        console.error("Action failed:", data.message);
        alert(`Failed to ${action.toLowerCase()} ${agentName}: ${data.message}`);
      }
    } catch (error) {
      console.error("Error confirming action:", error);
      
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
      
      // Remove passed agents from the data
      setProgressData((prevData) =>
        prevData.filter((agent) => !selectedAgents.includes(agent.agentName))
      );
      
      setSelectedAgents([]);
      alert(`Successfully passed ${selectedAgents.length} agents.`);
    } catch (error) {
      console.error("Error passing agents:", error);
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
      
      // Remove failed agents from the data
      setProgressData((prevData) =>
        prevData.filter((agent) => !selectedAgents.includes(agent.agentName))
      );
      
      setSelectedAgents([]);
      alert(`Successfully failed ${selectedAgents.length} agents.`);
    } catch (error) {
      console.error("Error failing agents:", error);
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
      
      // Remove deleted agents from the data
      setProgressData((prevData) =>
        prevData.filter((agent) => !selectedAgents.includes(agent.agentName))
      );
      
      setSelectedAgents([]);
      alert(`Successfully deleted ${selectedAgents.length} agents.`);
    } catch (error) {
      console.error("Error deleting agents:", error);
      alert("Failed to delete some agents. Please try again.");
    }
  }, [selectedAgents, progressData]);

  const handleMarkReady = useCallback(async (agent) => {
    try {
      const response = await api.post('/release/schedule-release', {
        userId: agent.userId,
      });

      if (!response.data.success) {
        return alert("Error: " + response.data.message);
      }

      loadUnscheduledReleases();
      loadProgressData();
      alert(`${agent.agentName} is now ready to schedule.`);
    } catch (error) {
      console.error(error);
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
      console.error(error);
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
    console.log("2nd Pack action initiated for:", agent.agentName);
    
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

      alert(`Second pack marked as sent for ${agent.agentName}`);
    } catch (error) {
      console.error("Error sending second pack:", error);
      alert("Failed to send second pack—see console.");
    }
  }, []);

  const updateNotes = useCallback(async (leadId, newNotes) => {
    if (!leadId) {
      console.error("No leadId available; cannot update notes.");
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
        console.log(`Notes and Last Updated updated successfully for leadId: ${leadId}`);
        // Refresh the leads released data
        const leadsResponse = await api.get('/release/leads-released');
        if (leadsResponse.data.success) {
          setLeadsReleased(leadsResponse.data.data);
        }
      } else {
        console.error("Failed to update notes:", data.message);
      }
    } catch (error) {
      console.error("Error updating notes:", error);
    }
  }, []);

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

    // Mass selection checkbox as first column
    if (isAdmin) {
      baseColumns.push({
        Header: (
          <input
            type="checkbox"
            onChange={(e) => {
              const checked = e.target.checked;
              setSelectedAgents(
                checked
                  ? currentTabData.map((a) => a.agentName)
                  : []
              );
            }}
            checked={
              selectedAgents.length === currentTabData.length && currentTabData.length > 0
            }
          />
        ),
        accessor: "userId", // Changed from "agentName" to avoid collision
        id: "massSelection",
        massSelection: true,
        Cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedAgents.includes(row.original.agentName)}
            onChange={() => toggleSelection(row.original.agentName)}
          />
        ),
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
  }, [currentTabData, isAdmin, actionStatus, selectedAgents, handleConfirm, handleAction, setActionStatus, setSelectedAgents, toggleSelection, formatName, validateColumn]);

    const getReadyToScheduleColumns = useMemo(() => {
    if (!currentTabData || !Array.isArray(currentTabData)) return [];
    
    const baseColumns = [];

    // Mass selection checkbox as first column
    if (isAdmin) {
      baseColumns.push({
        Header: (
          <input
            type="checkbox"
            onChange={(e) => {
              const allIds = currentTabData.map(r => r.id);
              setSelectedUnscheduled(e.target.checked ? allIds : []);
            }}
            checked={
              selectedUnscheduled.length > 0 &&
              selectedUnscheduled.length === currentTabData.length
            }
          />
        ),
        accessor: "id",
        id: "massSelection",
        massSelection: true,
        Cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedUnscheduled.includes(row.original.id)}
            onChange={() => toggleUnscheduledSelection(row.original.id)}
          />
        ),
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
              disabled={selectedUnscheduled.length > 0}
            >
              Schedule
            </button>
          );
        },
      });
    }

    return baseColumns.filter(validateColumn) || [];
  }, [currentTabData, isAdmin, selectedUnscheduled, setSelectedUnscheduled, toggleUnscheduledSelection, formatName, setSchedulingAgent, validateColumn]);

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
      Header: "Progress (%)",
      accessor: "progress",
      Cell: ({ value }) => <span>{Math.round(value || 0)}%</span>,
    },
    {
      Header: "MGA",
      accessor: "mga",
      Cell: ({ value }) => <span>{formatName(value)}</span>,
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
      Header: "2nd Pack Sent",
      accessor: "packReleasedDate",
      id: "secondPackSent",
      Cell: ({ value, row }) => {
        const agent = row.original;
        return isAdmin ? (
          agent.packReleasedDate && agent.packReleasedDate !== "N/A" ? (
            <button className="insured-button" style={{ backgroundColor: 'grey' }} disabled>
              Already Sent
            </button>
          ) : (
            <button onClick={() => handleSecondPack(agent)} className="insured-button">
              Sent 2nd Pack
            </button>
          )
        ) : (
          value || "N/A"
        );
      },
    },
    {
      Header: "Pack Released Date",
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
      Cell: ({ value, row }) => {
        const agent = row.original;
        return isAdmin ? (
          <input
            type="text"
            defaultValue={value}
            onBlur={(e) => updateNotes(agent.leadId, e.target.value)}
            style={{ width: "auto", minWidth: "80px", border: "1px solid #ccc", padding: "2px" }}
          />
        ) : (
          value || "N/A"
        );
      },
    },
    ];
    return columns.filter(validateColumn) || [];
  }, [formatName, isAdmin, handleSecondPack, setLeadsReleased, setProgressData, updateNotes, validateColumn]);

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
  const loadUnscheduledReleases = async () => {
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
        console.log('Getting hierarchy for unscheduled releases with userId:', userId);
        
        // Get hierarchy IDs
        const hierarchyResponse = await api.post('/auth/searchByUserId', { userId });
        if (hierarchyResponse.data.success) {
          const hierarchyUserIds = hierarchyResponse.data.data.map(user => user.id);
          console.log('Hierarchy user IDs for unscheduled:', hierarchyUserIds);
          
          // Get all unscheduled releases using admin endpoint
          const allDataResponse = await api.get('/release/get-unscheduled-releases');
          if (allDataResponse.data.success) {
            // Filter by hierarchy IDs
            unscheduledData = allDataResponse.data.data.filter(release => 
              hierarchyUserIds.includes(release.user_id)
            );
            console.log('Filtered unscheduled releases:', unscheduledData.length, 'releases found');
          }
        }
      } else {
        // Regular users shouldn't see this, but just in case
        const response = await api.get('/release/get-unscheduled-releases');
        if (response.data.success) {
          unscheduledData = response.data.data;
        }
      }

      console.log("Final unscheduled releases data:", unscheduledData);
      const mapped = unscheduledData.map((r) => ({
        id: r.id,
        agentName: r.lagnname || `Agent ${r.id}`,
        userId: r.user_id,
        mga: r.mga,
        timeSubmitted: r.time_submitted,
      }));
      setUnscheduledReleases(mapped);
    } catch (error) {
      console.error("Error loading unscheduled releases:", error);
    }
  };



  const loadLeadsReleased = async () => {
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
        console.log('Getting hierarchy for leads released with userId:', userId);
        
        // Get hierarchy IDs
        const hierarchyResponse = await api.post('/auth/searchByUserId', { userId });
        if (hierarchyResponse.data.success) {
          const hierarchyUserIds = hierarchyResponse.data.data.map(user => user.id);
          console.log('Hierarchy user IDs for leads released:', hierarchyUserIds);
          
          // Get all leads released using admin endpoint
          const allDataResponse = await api.get('/release/leads-released');
          if (allDataResponse.data.success) {
            // Filter by hierarchy IDs (assuming leads_released has userId field)
            leadsReleasedData = allDataResponse.data.data.filter(lead => 
              hierarchyUserIds.includes(lead.userId)
            );
            console.log('Filtered leads released:', leadsReleasedData.length, 'leads found');
          }
        }
      } else {
        // Regular users shouldn't see this, but just in case
        const response = await api.get('/release/leads-released');
        if (response.data.success) {
          leadsReleasedData = response.data.data;
        }
      }

      console.log("Final leads released data:", leadsReleasedData);
      setLeadsReleased(leadsReleasedData);
    } catch (error) {
      console.error("Error fetching leads released data:", error);
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



  // Memoize tab change handler
  const handleTabChange = useCallback((tabKey) => {
    setActiveTab(tabKey);
  }, []);

  // Memoize tabs configuration to avoid recalculating badges on every render
  const tabs = useMemo(() => [
    {
      key: "upcomingReleases",
      label: "Upcoming Releases",
      badge: upcomingReleasesData.length || null
    },
    {
      key: "readyToSchedule",
      label: "Ready to Schedule",
      badge: unscheduledReleases.length || null
    },
    {
      key: "pendingScheduling",
      label: "Pending Scheduling",
      badge: pendingSchedulingData.length || null
    },
    {
      key: "checklistInProgress",
      label: "Checklist in Progress",
      badge: checklistInProgressData.length || null
    },
    {
      key: "passedReleases",
      label: "Passed Releases"
    }
  ], [upcomingReleasesData.length, unscheduledReleases.length, pendingSchedulingData.length, checklistInProgressData.length]);

  // Handle scheduling a single agent by JA_Release row id
  const handleScheduleAgent = async (agent) => {
    if (!scheduleDate || !scheduleTime) {
      return alert("Please select both a date and time");
    }

    const isoTs = localToUTC(`${scheduleDate}T${scheduleTime}`);

    try {
      const response = await api.put(`/release/schedule-release/${agent.id}`, {
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
    } catch (error) {
      console.error("Error scheduling agent:", error);
      alert("Error scheduling agent—see console.");
    }
  };

  const handleBulkSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      return alert('Pick a date & time first');
    }
    const ts = localToUTC(`${scheduleDate}T${scheduleTime}`);

    try {
      await Promise.all(
        selectedUnscheduled.map(id =>
          api.put(`/release/schedule-release/${id}`, {
            releaseScheduled: ts
          })
        )
      );

      setUnscheduledReleases(prev =>
        prev.filter(r => !selectedUnscheduled.includes(r.id))
      );
      setSelectedUnscheduled([]);
      setScheduleDate('');
      setScheduleTime('');
      alert('All selected agents scheduled!');
    } catch (error) {
      console.error('Bulk schedule error', error);
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
          { userId: selectedAgent.user_id }
        );
      });

      await Promise.all(requests);
      setProgressData((prevData) =>
        prevData.filter((agent) => !selectedAgents.includes(agent.agentName))
      );
      setSelectedAgents([]);
      setMassAction(null);
      console.log(`Mass ${action} action completed successfully.`);
    } catch (error) {
      console.error("Error during mass action:", error);
      setMassAction(null);
    }
  };

  const loadLicensedStates = async () => {
    try {
      const response = await api.get('/release/licensed-states');
      const data = response.data;
      
      if (data.success) {
        setLicensedStates(data.data);
      } else {
        console.error("Failed to fetch licensed states:", data.message);
      }
    } catch (error) {
      console.error("Error fetching licensed states data:", error);
    }
  };

  const calculateProgress = (responses) => {
    let completedItems = filteredProgressKeys.filter((key) => {
      if (key === "contract_2nd" || key === "bonus_90d" || key === "bonus_after_90d") {
        return (
          (key === "bonus_90d" && responses[key] === "750") ||
          (key === "bonus_after_90d" && responses[key] === "250") ||
          responses[key]
        );
      }
      return responses[key];
    }).length;

    completedItems += Math.min(responses.practice_pres || 0, 10);
    completedItems += Math.min(responses.refs_25 || 0, 25);

    return (completedItems / totalProgressItems) * 100;
  };

  const fetchAgentProgress = async (agentChecklist) => {
    return calculateProgress(agentChecklist);
  };

  const loadProgressData = async () => {
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
        console.log('Getting hierarchy for manager with userId:', userId, 'userRole:', userRole);
        
        // Get hierarchy IDs
        const hierarchyResponse = await api.post('/auth/searchByUserId', { userId });
        if (hierarchyResponse.data.success) {
          const hierarchyUserIds = hierarchyResponse.data.data.map(user => user.id);
          console.log(`[Manager Hierarchy] ${userId} can see user IDs:`, hierarchyUserIds);
          console.log(`[Manager Hierarchy] ${userId} hierarchy details:`, hierarchyResponse.data.data.map(u => ({ id: u.id, name: u.lagnname, clname: u.clname })));
          
          // Get all data using admin endpoint
          const allDataResponse = await api.get('/release/get-unreleased-users-checklist');
          if (allDataResponse.data.success) {
            // Filter by hierarchy IDs
            agentsData = allDataResponse.data.data.filter(agent => 
              hierarchyUserIds.includes(agent.id)
            );
            console.log('Filtered agents data:', agentsData.length, 'agents found');
          }
        }
      } else {
        // Regular users shouldn't see this table, but just in case
        const response = await api.get('/release/get-unreleased-users-checklist');
        if (response.data.success) {
          agentsData = response.data.data;
        }
      }

      console.log(`[Load Progress Data] Final agents data for ${userRole} (${userId}):`, agentsData.length, 'agents');
      if (isManager) {
        console.log(`[Load Progress Data] Manager ${userId} agents:`, agentsData.map(a => ({ name: a.lagnname, id: a.id })));
      }
      setAgents(agentsData);

      const agentProgressPromises = agentsData.map(async (agent) => {
          const progress = await fetchAgentProgress(agent);
          return {
            id: agent.id, // Add unique ID for React Table
            agentName: agent.lagnname || `Agent ${agent.id}`,
            userId: agent.id,
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
        setProgressData(progressArray);
    } catch (error) {
      console.error("Error loading progress data:", error);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadUnscheduledReleases();
    loadProgressData();
    loadLeadsReleased();
    loadLicensedStates();
  }, []);

  useEffect(() => {
    setSortConfig({ key: "releaseScheduled", direction: "desc" });
  }, []);



  if (loading) {
    return <div className="loading">Loading agent progress data...</div>;
  }

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
            <div className="bulk-action-container">
              {isAdmin && selectedAgents.length > 0 && (
                <div className="bulk-action-buttons" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                      <button
                        className="insured-button"
                    onClick={handleMassPassAll}
                    style={{ backgroundColor: '#28a745', color: 'white' }}
                      >
                    Pass All ({selectedAgents.length})
                      </button>
                      <button
                        className="insured-button"
                    onClick={handleMassFailAll}
                    style={{ backgroundColor: '#dc3545', color: 'white' }}
                      >
                    Fail All ({selectedAgents.length})
                      </button>
                        <button
                          className="insured-button"
                    onClick={handleMassDeleteAll}
                    style={{ backgroundColor: '#6c757d', color: 'white' }}
                        >
                    Delete All ({selectedAgents.length})
                        </button>
                </div>
              )}
            </div>

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
/>


          </>
        )}

        {activeTab === "readyToSchedule" && (
          <>
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

            <DataTable
              columns={safeColumns(getReadyToScheduleColumns)}
              data={currentTabData || []}
              defaultSortBy="timeSubmitted"
              defaultSortOrder="desc"
              showActionBar={false}
              entityName="agent"
              disableCellEditing={true}
            />

            {selectedUnscheduled.length > 0 && (
              <div
                className="bulk-schedule-form mb-3 p-3"
                style={{ background: "#f0f0f0" }}
              >
                <h5>Schedule {selectedUnscheduled.length} agents for release</h5>
                <div className="row">
                  <div className="col-md-4">
                    <input
                      type="date"
                      className="form-control"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <input
                      type="time"
                      className="form-control"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4 d-flex align-items-end">
                    <button className="insured-button" onClick={handleBulkSchedule}>
                      Schedule All
                    </button>
                    <button
                      className="insured-button ml-2"
                      onClick={() => setSelectedUnscheduled([])}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "pendingScheduling" && (
          <>
            <ActionBar
              selectedCount={0}
              totalCount={currentTabData?.length || 0}
              entityName="agents"
              archivedView={isHiddenView}
            >
              {/* Hidden view toggle - Eye icon */}
              <div 
                className={`archive-toggle icon-only ${isHiddenView ? 'active' : ''}`}
                onClick={() => setIsHiddenView(!isHiddenView)}
                title={isHiddenView ? 'Show Active Agents' : 'Show Hidden Agents'}
                style={{
                  padding: '8px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  backgroundColor: isHiddenView ? '#00558c' : 'transparent',
                  color: isHiddenView ? 'white' : '#666',
                  border: '1px solid #ddd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {isHiddenView ? (
                    // Open eye icon (showing hidden)
                    <path 
                      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  ) : (
                    // Closed eye icon (hiding hidden)
                    <>
                      <path 
                        d="m1 1 22 22 M9.88 9.88a3 3 0 1 0 4.24 4.24 M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68 M6.61 6.61A13.526 13.526 0 0 0 1 12s4 8 11 8a9.74 9.74 0 0 0 5-1.28" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </>
                  )}
                </svg>
              </div>
            </ActionBar>
            <DataTable
              columns={safeColumns(getPendingSchedulingColumns)}
              data={currentTabData || []}
              showActionBar={false}
              entityName="agent"
              disableCellEditing={true}
            />
          </>
        )}

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
              archivedView={false}
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
              disableCellEditing={true}
            />
          </>
        )}
      </Tabs>
    </div>
  );
};

export default AgentProgressTable; 