import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import { useUserHierarchy } from '../../../hooks/useUserHierarchy';
import api from '../../../api';
import DataTable from '../../utils/DataTable';
import { toast } from 'react-hot-toast';
import CustomGroupModal from './CustomGroupModal';
import AllotmentSettingsModal from './AllotmentSettingsModal';
import LeadDropDatesModal from './LeadDropDatesModal';
import './AllotmentTab.css';

const AllotmentTab = () => {
  const { user } = useContext(AuthContext);
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const [loading, setLoading] = useState(true);
  const [allotmentData, setAllotmentData] = useState([]);
  const [customGroups, setCustomGroups] = useState([]);
  const [allotmentOverrides, setAllotmentOverrides] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiResponseData, setApiResponseData] = useState(null);
  const [activeGroupFilter, setActiveGroupFilter] = useState('all'); // 'all', '1', '2', '3', '4', '5', 'custom-X', 'exceptions', 'exclusions'
  const [showCustomGroupModal, setShowCustomGroupModal] = useState(false);
  const [editingCustomGroup, setEditingCustomGroup] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(''); // Empty on load, defaults to 1 month ahead
  const [selectedAgents, setSelectedAgents] = useState({}); // For bulk actions
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState(''); // 'exclude', 'move', 'exclude_all_future'
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDropDatesModal, setShowDropDatesModal] = useState(false);
  const [dropDates, setDropDates] = useState([]);
  const [f90AgentIds, setF90AgentIds] = useState(new Set()); // Set of agent IDs eligible for F90
  const [f90AgentData, setF90AgentData] = useState({}); // Map of agent ID to F90 data (firstPackDate, etc)

  // Initial component mount log
  console.log('🎬 [Frontend] AllotmentTab component mounted/updated:', {
    timestamp: new Date().toISOString(),
    user: user ? {
      userId: user.userId,
      role: user.Role,
      clname: user.clname,
      teamRole: user.teamRole
    } : null,
    hierarchyLoading,
    hasHierarchyData: !!hierarchyData,
    loading,
    allotmentDataCount: allotmentData.length
  });

  // Check if user has elevated permissions
  const hasElevatedPermissions = useMemo(() => {
    if (!user) return false;
    const teamRole = user.teamRole || '';
    const role = user.Role || '';
    const clname = user.clname || '';
    
    return teamRole === 'app' || role === 'Admin' || clname === 'SGA';
  }, [user]);

  // Check if user is an AGT (agent)
  const isAgtUser = useMemo(() => {
    if (!user) return false;
    const clname = user.clname || '';
    return clname === 'AGT';
  }, [user]);

  // Check if user can manage custom groups (Admin or app)
  const canManageCustomGroups = useMemo(() => {
    if (!user) return false;
    return user.Role === 'Admin' || user.teamRole === 'app';
  }, [user]);

  // Get allowed IDs from cached hierarchy data
  const allowedIds = useMemo(() => {
    if (hasElevatedPermissions) return []; // Elevated users see all data
    if (isAgtUser) return [user?.userId || user?.id].filter(Boolean); // AGT users only see themselves
    return getHierarchyForComponent('ids');
  }, [hasElevatedPermissions, isAgtUser, getHierarchyForComponent, user?.userId, user?.id]);
  
  const allowedIdsSet = useMemo(() => new Set(allowedIds.map(id => String(id))), [allowedIds]);

  // Debug selected agents
  useEffect(() => {
    const selectedCount = Object.keys(selectedAgents).filter(id => selectedAgents[id]).length;
    if (selectedCount > 0) {
      console.log('🔲 Selected agents changed:', {
        selectedAgents,
        count: selectedCount,
        hasElevatedPermissions,
        selectedIds: Object.keys(selectedAgents).filter(id => selectedAgents[id])
      });
    }
  }, [selectedAgents, hasElevatedPermissions]);

  // Generate month options (6 months back + 6 months forward)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Include past months (6 months back) through future months (current + 8)
    // This gives a range from -6 to +8 relative to current month
    for (let i = -6; i <= 8; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      let label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      // Add indicators for past/current months only
      if (date < currentMonth) {
        label = `${label} (Past)`;
      } else if (date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear()) {
        label = `${label} (Current)`;
      }
      
      options.push({ value, label, isPast: date < currentMonth });
    }
    
    return options;
  }, []);

  // Set default selected month on mount (current + 1 month)
  useEffect(() => {
    if (!selectedMonth && monthOptions.length > 0) {
      const now = new Date();
      const defaultDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const defaultValue = `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonth(defaultValue);
    }
  }, [monthOptions, selectedMonth]);

  const fetchAllotmentData = useCallback(async () => {
    setLoading(true);
    console.log('🚀 [Frontend] Starting allotment data fetch...', selectedMonth ? `for ${selectedMonth}` : '(default)');
    
    try {
      // Use the new PnP allotment endpoint
      console.log('📡 [Frontend] Calling /pnp/allotment API...');
      const url = selectedMonth ? `/pnp/allotment?targetMonth=${selectedMonth}` : '/pnp/allotment';
      const response = await api.get(url);
      
      console.log('✅ [Frontend] API Response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        dataStructure: {
          success: response.data?.success,
          recordCount: response.data?.recordCount,
          targetMonth: response.data?.targetMonth,
          monthlyAlpPattern: response.data?.monthlyAlpPattern,
          pnpPattern: response.data?.pnpPattern,
          debug: response.data?.debug
        }
      });
      
      let data = response.data?.data || [];
      const customGroupsData = response.data?.customGroups || [];
      const overridesData = response.data?.overrides || [];
      console.log(`📊 [Frontend] Raw data received: ${data.length} records, ${customGroupsData.length} custom groups, ${overridesData.length} overrides`);
      
      // Debug: Check if override info is attached to agents
      const agentsWithOverrideInfo = data.filter(record => record.hasOverride === true);
      console.log(`🔍 [Frontend] Agents with override info attached: ${agentsWithOverrideInfo.length}`);
      if (agentsWithOverrideInfo.length > 0) {
        console.log(`🔍 [Frontend] Sample agents with overrides:`, 
          agentsWithOverrideInfo.slice(0, 3).map(a => ({
            agent: a.agent,
            hasOverride: a.hasOverride,
            overrideType: a.overrideType,
            isExcluded: a.isExcluded
          }))
        );
      }
      
      // Handle separate RefValidation and Licensed States data
      const refValidationData = response.data?.refValidationData || [];
      const licensedStatesData = response.data?.licensedStatesData || [];
      
      // Handle F90 agents data
      const f90AgentsRaw = response.data?.f90Agents || [];
      const f90AgentIdsSet = new Set(f90AgentsRaw.map(a => a.userId));
      const f90AgentDataMap = {};
      f90AgentsRaw.forEach(agent => {
        f90AgentDataMap[agent.userId] = {
          firstPackDate: agent.firstPackDate,
          lagnname: agent.lagnname || agent.au_lagnname
        };
      });
      setF90AgentIds(f90AgentIdsSet);
      setF90AgentData(f90AgentDataMap);
      console.log(`📊 [Frontend] F90 Agents: ${f90AgentsRaw.length} eligible agents`);
      
      // Store custom groups and overrides
      setCustomGroups(customGroupsData);
      setAllotmentOverrides(overridesData);
      console.log(`📊 [Frontend] RefValidation data: ${refValidationData.length} records`);
      console.log(`📊 [Frontend] Licensed States data: ${licensedStatesData.length} records`);
      console.log(`🔢 [Frontend] Previous Month Groups:`, {
        prevMonth: response.data?.prevMonth,
        highPerformers: response.data?.debug?.prevMonthHighPerformers,
        groupSize: response.data?.debug?.prevMonthGroupSize,
        agentsWithGroups: response.data?.debug?.agentsWithPrevMonthGroups
      });
      
      // Create lookup maps for efficient frontend aggregation
      const refCountsByAgentId = {};
      refValidationData.forEach(ref => {
        if (!refCountsByAgentId[ref.agent_id]) {
          refCountsByAgentId[ref.agent_id] = 0;
        }
        refCountsByAgentId[ref.agent_id]++;
      });
      
      const licensedStatesByAgentId = {};
      licensedStatesData.forEach(license => {
        if (!licensedStatesByAgentId[license.agent_id]) {
          licensedStatesByAgentId[license.agent_id] = [];
        }
        licensedStatesByAgentId[license.agent_id].push(license.state);
      });
      
      console.log(`🔍 [Frontend] RefValidation aggregation: ${Object.keys(refCountsByAgentId).length} agents with refs, Total refs: ${refValidationData.length}`);
      console.log(`🔍 [Frontend] Licensed States aggregation: ${Object.keys(licensedStatesByAgentId).length} agents with licenses`);
      
      // Sample of ref counts
      if (Object.keys(refCountsByAgentId).length > 0) {
        const sampleRefCounts = Object.entries(refCountsByAgentId).slice(0, 5).map(([agentId, count]) => ({ agentId, count }));
        console.log(`🔍 [Frontend] Sample ref counts:`, sampleRefCounts);
      }
      
      // Update data with frontend-aggregated values
      data = data.map(record => ({
        ...record,
        prevMonthRefs: refCountsByAgentId[record.agentId] || 0, // Real count from RefValidation
        areaRequest: licensedStatesByAgentId[record.agentId]?.join(', ') || 'N/A' // Real states from Licensed States
      }));
      
      console.log(`🔍 [Frontend] Updated ${data.length} records with real RefValidation and Licensed States data`);
      
      // Store API response data for JSX access
      setApiResponseData(response.data);
      
      // Log first few records for inspection
      if (data.length > 0) {
        console.log('🔍 [Frontend] Sample processed records:', data.slice(0, 3).map(record => ({
          id: record.id,
          agentId: record.agentId,
          mga: record.mga,
          agent: record.agent,
          retention: record.retention,
          prevMonthGroup: record.prevMonthGroup, // Real data from prev month grouping
          prevMonthRefs: record.prevMonthRefs, // Real data from refvalidation
          areaRequest: record.areaRequest, // Real data from licensed states
          alp: record.alp,
          hasRawData: !!record.rawData
        })));
        
        // Log detailed raw data for first record
        if (data[0]?.rawData) {
          console.log('🔍 [Frontend] First record raw data:', data[0].rawData);
        }
      }
      
      console.log(`👤 [Frontend] User permissions check:`, {
        hasElevatedPermissions,
        isAgtUser,
        allowedIdsCount: allowedIds.length,
        allowedIds: allowedIds.slice(0, 5) // Show first 5 for brevity
      });
      
      // Apply hierarchy filtering for non-elevated users
      let originalCount = data.length;
      if (!hasElevatedPermissions && !isAgtUser) {
        data = data.filter(item => 
          item.agentId !== undefined && 
          item.agentId !== null && 
          allowedIdsSet.has(String(item.agentId))
        );
        console.log(`🔒 [Frontend] Applied hierarchy filtering: ${originalCount} → ${data.length} records`);
      } else if (isAgtUser) {
        // AGT users only see themselves
        data = data.filter(item => 
          item.agentId !== undefined && 
          item.agentId !== null && 
          allowedIdsSet.has(String(item.agentId))
        );
        console.log(`🔒 [Frontend] Applied AGT filtering: ${originalCount} → ${data.length} records`);
      } else {
        console.log(`✅ [Frontend] No filtering applied (elevated permissions) - keeping all ${data.length} records`);
      }
      
      setAllotmentData(data);
      console.log(`💾 [Frontend] Final data set in state: ${data.length} records`);
      
      if (data.length === 0) {
        console.log(`⚠️ [Frontend] No data after filtering`);
        toast(`There are no agents to show for this allotment at this time`, {
          icon: 'ℹ️',
          duration: 4000
        });
      } else {
        console.log(`✅ [Frontend] Successfully loaded ${data.length} allotment records for ${response.data?.targetMonth}`);
      }
      
    } catch (err) {
      console.error('❌ [Frontend] Failed to load allotment data:', err);
      console.error('❌ [Frontend] Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        responseData: err.response?.data
      });
      
      // Fallback to mock data if API fails
      const mockData = generateMockData();
      console.log(`🔄 [Frontend] Using fallback mock data: ${mockData.length} records`);
      setAllotmentData(mockData);
      toast.error('Failed to load allotment data from PnP - using mock data for demonstration');
    } finally {
      setLoading(false);
      console.log('🏁 [Frontend] Allotment data fetch completed');
    }
  }, [hasElevatedPermissions, isAgtUser, allowedIdsSet, allowedIds, selectedMonth]);

  // Generate mock data for demonstration
  const generateMockData = () => {
    const mockData = [
      {
        id: 1,
        agentId: '101',
        mga: 'Smith, John',
        agent: 'Johnson, Mary',
        retention: '85%',
        leadTypePref: 'Final Expense',
        areaRequest: 'FL, GA, AL',
        prevMonthGroup: 15,
        prevMonthRefs: 8,
        alp: 2500
      },
      {
        id: 2,
        agentId: '102',
        mga: 'Brown, David',
        agent: 'Wilson, Sarah',
        retention: '92%',
        leadTypePref: 'Term Life',
        areaRequest: 'TX, OK, LA',
        prevMonthGroup: 23,
        prevMonthRefs: 12,
        alp: 3200
      },
      {
        id: 3,
        agentId: '103',
        mga: 'Davis, Michael',
        agent: 'Anderson, Robert',
        retention: '78%',
        leadTypePref: 'Whole Life',
        areaRequest: 'CA, NV, AZ',
        prevMonthGroup: 18,
        prevMonthRefs: 6,
        alp: 2800
      },
      {
        id: 4,
        agentId: '104',
        mga: 'Miller, Jennifer',
        agent: 'Taylor, Christopher',
        retention: '88%',
        leadTypePref: 'Universal Life',
        areaRequest: 'NY, NJ, CT',
        prevMonthGroup: 20,
        prevMonthRefs: 9,
        alp: 3500
      },
      {
        id: 5,
        agentId: '105',
        mga: 'Wilson, James',
        agent: 'Martinez, Lisa',
        retention: '83%',
        leadTypePref: 'Final Expense',
        areaRequest: 'NC, SC, VA',
        prevMonthGroup: 14,
        prevMonthRefs: 7,
        alp: 2200
      }
    ];
    
    // Apply hierarchy filtering to mock data
    if (!hasElevatedPermissions && !isAgtUser) {
      return mockData.filter(item => allowedIdsSet.has(String(item.agentId)));
    } else if (isAgtUser) {
      return mockData.filter(item => allowedIdsSet.has(String(item.agentId)));
    }
    
    return mockData;
  };

  // Fetch drop dates for the selected month
  const fetchDropDates = useCallback(async () => {
    if (!selectedMonth) return;
    
    try {
      console.log(`📅 [Frontend] Fetching drop dates for month: ${selectedMonth}`);
      const response = await api.get(`/pnp/lead-drop-dates?month=${selectedMonth}`);
      if (response.data.success) {
        setDropDates(response.data.dropDates || []);
        console.log(`✅ [Frontend] Loaded ${response.data.dropDates?.length || 0} drop dates for ${selectedMonth}`);
      }
    } catch (error) {
      console.error('❌ [Frontend] Error fetching drop dates:', error);
      setDropDates([]);
    }
  }, [selectedMonth]);

  useEffect(() => {
    console.log('🎯 [Frontend] AllotmentTab useEffect triggered:', {
      hasElevatedPermissions,
      isAgtUser,
      hasHierarchyData: !!hierarchyData,
      allowedIdsLength: allowedIds.length,
      selectedMonth,
      userInfo: {
        userId: user?.userId,
        role: user?.Role,
        clname: user?.clname,
        teamRole: user?.teamRole
      }
    });
    
    // Only fetch when we have hierarchy data for non-elevated users, or anytime for elevated/AGT users
    if (hasElevatedPermissions || isAgtUser || (hierarchyData && allowedIds.length > 0)) {
      console.log('✅ [Frontend] Conditions met - starting data fetch');
      fetchAllotmentData();
      fetchDropDates();
    } else {
      console.log('⏳ [Frontend] Waiting for hierarchy data...');
    }
  }, [fetchAllotmentData, fetchDropDates, hasElevatedPermissions, isAgtUser, hierarchyData, allowedIds, user, selectedMonth]);

  // Helper function to get group details from lead pack info
  const getGroupDetails = useCallback((group) => {
    const details = {
      1: { leads: 500, perDrop: 250, refs: 6, leadTypes: 'POS / HC / Dcards', color: '#155724', bgColor: '#d4edda' },
      2: { leads: 400, perDrop: 200, refs: 5, leadTypes: 'POS / HC / dcards', color: '#0c5460', bgColor: '#d1ecf1' },
      3: { leads: 300, perDrop: 150, refs: 4, leadTypes: 'HC / School / dcard', color: '#856404', bgColor: '#fff3cd' },
      4: { leads: 200, perDrop: 100, refs: 3, leadTypes: 'HC / School / Globe', color: '#721c24', bgColor: '#f8d7da' },
      5: { leads: 150, perDrop: 75, refs: 2, leadTypes: 'Vendor leads', color: '#383d41', bgColor: '#d6d8db' }
    };
    return details[group] || { leads: 0, perDrop: 0, refs: 0, leadTypes: 'N/A', color: '#000', bgColor: 'transparent' };
  }, []);

  // Split data into high ALP (>=3000) with allotment groups and low ALP (<3000)
  const { highAlpData, lowAlpData } = useMemo(() => {
    console.log(`🔍 [Frontend] Splitting data by ALP threshold (3000):`, {
      totalRecords: allotmentData.length
    });

    // Split data by ALP >= 3000 vs < 3000
    const highAlpAgents = allotmentData.filter(record => (record.alp || 0) >= 3000);
    const lowAlpAgents = allotmentData.filter(record => (record.alp || 0) < 3000);
    
    console.log(`📊 [Frontend] ALP split: ${highAlpAgents.length} high ALP (>=3000), ${lowAlpAgents.length} low ALP (<3000)`);
    
    // STEP 1: Remove F90 agents FIRST (before assigning groups)
    let f90Agents = [];
    let nonF90HighAlpAgents = highAlpAgents;
    
    if (f90AgentIds && f90AgentIds.size > 0) {
      f90Agents = highAlpAgents.filter(agent => f90AgentIds.has(agent.agentId));
      nonF90HighAlpAgents = highAlpAgents.filter(agent => !f90AgentIds.has(agent.agentId));
      
      console.log(`🔄 [F90 Pre-Filter] Removed ${f90Agents.length} F90 agents before group assignment`);
      console.log(`📊 [F90 Pre-Filter] Remaining for group assignment: ${nonF90HighAlpAgents.length} agents`);
    }
    
    // STEP 2: Sort remaining agents by ALP descending for even group distribution
    nonF90HighAlpAgents.sort((a, b) => (b.alp || 0) - (a.alp || 0));
    
    // STEP 3: Divide remaining agents into 5 allotment groups evenly
    const totalAgents = nonF90HighAlpAgents.length;
    const baseGroupSize = Math.floor(totalAgents / 5);
    const remainder = totalAgents % 5;
    
    console.log(`🔢 [Frontend] Distributing ${totalAgents} non-F90 agents: ${baseGroupSize} base + ${remainder} extra`);
    
    // Groups with remainder get 1 extra agent
    let highAlpWithGroups = nonF90HighAlpAgents.map((agent, index) => {
      let group = 1;
      let currentIndex = 0;
      
      for (let g = 1; g <= 5; g++) {
        const groupSize = baseGroupSize + (g <= remainder ? 1 : 0);
        if (index < currentIndex + groupSize) {
          group = g;
          break;
        }
        currentIndex += groupSize;
      }
      
      return {
        ...agent,
        allotmentGroup: group
      };
    });
    
    console.log(`🔍 [Frontend] Group distribution (evenly split):`, 
      Array.from({length: 5}, (_, i) => ({
        group: i + 1,
        count: highAlpWithGroups.filter(a => a.allotmentGroup === i + 1).length
      }))
    );
    
    // STEP 4: Apply manual group overrides
    highAlpWithGroups = highAlpWithGroups.map(agent => {
      if (agent.hasOverride && agent.overrideType === 'move_to_group') {
        const originalGroup = agent.allotmentGroup;
        return {
          ...agent,
          allotmentGroup: agent.overrideTargetGroup,
          originalGroup: originalGroup,
          groupOverridden: true
        };
      }
      return agent;
    });
    
    // STEP 5: Add F90 agents back with special flag (they won't show in regular groups)
    if (f90Agents.length > 0) {
      const f90AgentsWithFlag = f90Agents.map(agent => ({
        ...agent,
        isF90Only: true, // Flag to identify F90-only agents
        allotmentGroup: null // No regular group assignment
      }));
      
      console.log(`✅ [F90] Marked ${f90AgentsWithFlag.length} agents as F90-only (will not appear in regular groups)`);
    }
    
    console.log(`🔢 [Frontend] Distributing ${totalAgents} agents: ${baseGroupSize} base + ${remainder} extra`);
    console.log(`🔍 [Frontend] Initial group distribution (before F90 filtering):`, 
      Array.from({length: 5}, (_, i) => ({
        group: i + 1,
        count: highAlpWithGroups.filter(a => a.allotmentGroup === i + 1).length
      }))
    );
    
    // Log F90 agents that are still in groups (for debugging)
    if (f90AgentIds.size > 0) {
      const f90AgentsInGroups = highAlpWithGroups.filter(a => f90AgentIds.has(a.agentId));
      const f90AgentsRemovedFromGroups = Array.from(f90AgentIds).filter(id => 
        !highAlpWithGroups.some(a => a.agentId === id)
      );
      
      console.log(`📊 [F90 Debug] F90 agents in regular groups: ${f90AgentsInGroups.length}`);
      console.log(`📊 [F90 Debug] F90 agents removed from groups: ${f90AgentsRemovedFromGroups.length}`);
      
      if (f90AgentsInGroups.length > 0) {
        console.log(`📋 [F90 Debug] F90 agents remaining in groups:`, f90AgentsInGroups.map(a => ({
          name: a.agent,
          agentId: a.agentId,
          group: a.allotmentGroup,
          alp: a.alp,
          f90EligibleButInBetterGroup: a.f90EligibleButInBetterGroup
        })));
      }
    }

    // Final check: Log all F90 agents and where they appear
    if (f90AgentIds && f90AgentIds.size > 0) {
      const allF90Agents = Array.from(f90AgentIds).map(agentId => {
        const agentInGroups = highAlpWithGroups.find(a => a.agentId === agentId);
        const agentInAllData = allotmentData.find(a => a.agentId === agentId);
        
        return {
          agentId,
          name: agentInAllData?.agent || 'Unknown',
          inGroups: !!agentInGroups,
          group: agentInGroups?.allotmentGroup || agentInAllData?.allotmentGroup || 'No Group',
          alp: agentInAllData?.alp || 0,
          firstPackDate: f90AgentData && f90AgentData[agentId]?.firstPackDate
        };
      });
      
      const inGroupsCount = allF90Agents.filter(a => a.inGroups).length;
      const notInGroupsCount = allF90Agents.filter(a => !a.inGroups).length;
      
      console.log(`📊 [F90 Summary] Total F90 eligible: ${allF90Agents.length}`);
      console.log(`   - In regular groups: ${inGroupsCount} (should be Groups 1-3 or Groups 4-5 with better allocation)`);
      console.log(`   - Not in groups (will show in F90): ${notInGroupsCount}`);
      
      // Show breakdown by group
      const byGroup = {};
      allF90Agents.forEach(a => {
        const group = a.group || 'No Group';
        if (!byGroup[group]) byGroup[group] = { inGroups: 0, notInGroups: 0 };
        if (a.inGroups) byGroup[group].inGroups++;
        else byGroup[group].notInGroups++;
      });
      console.log(`📊 [F90 by Group]:`, byGroup);
    }
    
    return { 
      highAlpData: highAlpWithGroups, 
      lowAlpData: lowAlpAgents 
    };
  }, [allotmentData, f90AgentIds, f90AgentData, getGroupDetails]);

  // Filter high ALP data by both search query and group filter
  const filteredHighAlpData = useMemo(() => {
    let filtered = highAlpData;
    
    // Check if filtering by exceptions (moved to another group)
    if (activeGroupFilter === 'exceptions') {
      filtered = allotmentData.filter(item => {
        return item.hasOverride && item.overrideType === 'move_to_group';
      });
      console.log(`🔍 [Frontend] Exceptions filter → ${filtered.length} agents`);
      if (filtered.length > 0) {
        console.log(`🔍 [Exceptions Debug] Sample exception agents:`, 
          filtered.slice(0, 3).map(a => ({
            name: a.agent,
            overrideType: a.overrideType,
            overrideTargetGroup: a.overrideTargetGroup
          }))
        );
      }
    }
    // Check if filtering by exclusions (excluded this month or all future)
    else if (activeGroupFilter === 'exclusions') {
      // Debug: Check all agents for override info
      const agentsWithOverrides = allotmentData.filter(item => item.hasOverride);
      const excludedAgents = allotmentData.filter(item => 
        item.hasOverride && (item.overrideType === 'exclude' || item.overrideType === 'exclude_all_future')
      );
      
      console.log(`🔍 [Exclusions Debug] Total agents: ${allotmentData.length}`);
      console.log(`🔍 [Exclusions Debug] Agents with ANY override: ${agentsWithOverrides.length}`);
      console.log(`🔍 [Exclusions Debug] Agents with exclude override: ${excludedAgents.length}`);
      
      if (agentsWithOverrides.length > 0) {
        console.log(`🔍 [Exclusions Debug] Sample agents with overrides:`, 
          agentsWithOverrides.slice(0, 5).map(a => ({
            name: a.agent,
            hasOverride: a.hasOverride,
            overrideType: a.overrideType,
            isExcluded: a.isExcluded
          }))
        );
      }
      
      filtered = excludedAgents;
      console.log(`🔍 [Frontend] Exclusions filter → ${filtered.length} agents`);
    }
    // Check if filtering by 6k reup group (low ALP)
    else if (activeGroupFilter === '6k-reup') {
      filtered = lowAlpData.filter(item => !item.isExcluded);
      console.log(`🔍 [Frontend] 6k Reup Group filter → ${filtered.length} agents`);
    }
    // Check if filtering by F90 (agents from leads_released with 1st Pack 31-90 days before drop date)
    else if (activeGroupFilter === 'f90') {
      console.log('🔍 [F90] Starting F90 filter...', {
        totalAgents: allotmentData.length,
        f90AgentIds: f90AgentIds ? f90AgentIds.size : 0,
        dropDatesCount: dropDates.length
      });

      // Filter to F90 eligible agents (all F90 agents show here, none appear in regular groups)
      filtered = allotmentData.filter(item => {
        if (item.isExcluded) return false;
        return f90AgentIds && f90AgentIds.has(item.agentId);
      });
      
      console.log(`🔍 [F90] Filter complete: ${filtered.length} agents in F90 tab`);
      
      // Verify no duplicates: F90 agents should NOT appear in regular groups
      const filteredF90AgentIds = new Set(filtered.map(a => a.agentId));
      const groupAgentIds = new Set(highAlpData.map(a => a.agentId));
      const duplicates = Array.from(filteredF90AgentIds).filter(id => groupAgentIds.has(id));
      
      if (duplicates.length > 0) {
        console.error(`⚠️ [F90 DUPLICATE] ${duplicates.length} agents appear in BOTH F90 and regular groups!`);
        const duplicateAgents = filtered.filter(a => duplicates.includes(a.agentId)).map(a => ({
          agentId: a.agentId,
          name: a.agent,
          alp: a.alp,
          inF90: true,
          inGroups: groupAgentIds.has(a.agentId)
        }));
        console.error(`📋 [F90 DUPLICATE] Duplicate agents:`, duplicateAgents);
      } else {
        console.log(`✅ [F90] No duplicates - F90 agents removed from regular groups before assignment`);
      }
      
      // Show sample of F90 agents with their details
      if (filtered.length > 0) {
        console.log(`📋 [F90] Sample F90 agents (F90 tab only):`, filtered.slice(0, 5).map(a => ({
          name: a.agent,
          agentId: a.agentId,
          alp: a.alp,
          firstPackDate: f90AgentData && f90AgentData[a.agentId]?.firstPackDate
        })));
      }
    }
    // Check if filtering by custom group
    else if (activeGroupFilter.startsWith('custom-')) {
      const customGroupId = parseInt(activeGroupFilter.replace('custom-', ''));
      const customGroup = customGroups.find(g => g.id === customGroupId);
      
      if (customGroup) {
        // Get members from the custom group (exclude excluded agents)
        filtered = customGroup.members
          .filter(member => !member.isExcluded)
          .map(member => ({
            ...member,
            allotmentGroup: 'Custom',
            customGroupName: customGroup.groupName,
            customGroupColor: customGroup.color
          }));
        console.log(`🔍 [Frontend] Custom group filter: ${customGroup.groupName} → ${filtered.length} agents`);
      } else {
        filtered = [];
      }
    } 
    // Filter by regular group
    else if (activeGroupFilter !== 'all') {
      const groupNumber = parseInt(activeGroupFilter);
      filtered = highAlpData.filter(item => item.allotmentGroup === groupNumber && !item.isExcluded);
      console.log(`🔍 [Frontend] Group filter: ${activeGroupFilter} → ${filtered.length} agents`);
    }
    // Filter 'all' - exclude agents with isExcluded
    else {
      filtered = highAlpData.filter(item => !item.isExcluded);
      console.log(`🔍 [Frontend] All groups filter → ${filtered.length} agents (excluded agents removed)`);
    }
    
    // Then filter by search query
    if (searchQuery.trim()) {
      const term = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(item => {
        const mga = (item.mga || '').toLowerCase();
        const agent = (item.agent || '').toLowerCase();
        const leadType = (item.leadTypePref || '').toLowerCase();
        const area = (item.areaRequest || '').toLowerCase();
        
        return mga.includes(term) || agent.includes(term) || leadType.includes(term) || area.includes(term);
      });
      console.log(`🔍 [Frontend] Search + Group filter: "${term}" + Group ${activeGroupFilter} → ${filtered.length} agents`);
    }
    
    return filtered;
  }, [highAlpData, lowAlpData, allotmentData, searchQuery, activeGroupFilter, customGroups, getGroupDetails, f90AgentIds, f90AgentData, dropDates]);

  const filteredLowAlpData = useMemo(() => {
    if (!searchQuery.trim()) return lowAlpData;
    
    const term = searchQuery.trim().toLowerCase();
    return lowAlpData.filter(item => {
      const mga = (item.mga || '').toLowerCase();
      const agent = (item.agent || '').toLowerCase();
      const leadType = (item.leadTypePref || '').toLowerCase();
      const area = (item.areaRequest || '').toLowerCase();
      
      return mga.includes(term) || agent.includes(term) || leadType.includes(term) || area.includes(term);
    });
  }, [lowAlpData, searchQuery]);

  // Calculate row class names for inactive agents (grey styling)
  const highAlpRowClassNames = useMemo(() => {
    const classNames = {};
    filteredHighAlpData.forEach(row => {
      if (row.Active === 'n' || row.managerActive === 'n') {
        classNames[row.id] = 'inactive-agent-row';
      }
    });
    console.log('🎨 [Frontend] High ALP inactive agent rows:', Object.keys(classNames).length);
    return classNames;
  }, [filteredHighAlpData]);

  const lowAlpRowClassNames = useMemo(() => {
    const classNames = {};
    filteredLowAlpData.forEach(row => {
      if (row.Active === 'n' || row.managerActive === 'n') {
        classNames[row.id] = 'inactive-agent-row';
      }
    });
    console.log('🎨 [Frontend] Low ALP inactive agent rows:', Object.keys(classNames).length);
    return classNames;
  }, [filteredLowAlpData]);

  // Bulk action handlers
  const handleBulkExclude = useCallback(async () => {
    const selectedIds = Object.keys(selectedAgents).filter(id => selectedAgents[id]);
    if (selectedIds.length === 0) {
      toast.error('No agents selected');
      return;
    }

    try {
      const agentsToExclude = filteredHighAlpData.filter(agent => selectedIds.includes(agent.id.toString()));
      
      for (const agent of agentsToExclude) {
        await api.post('/pnp/allotment-overrides', {
          agentId: agent.agentId,
          targetMonth: selectedMonth,
          overrideType: 'exclude',
          reason: `Bulk excluded by ${user.clname || user.lagnname}`
        });
      }
      
      toast.success(`${agentsToExclude.length} agents excluded from ${selectedMonth} allotment`);
      setSelectedAgents({});
      setShowBulkActionsModal(false);
      fetchAllotmentData();
    } catch (error) {
      console.error('Error applying bulk exclude:', error);
      toast.error('Failed to apply bulk exclusion');
    }
  }, [selectedAgents, filteredHighAlpData, selectedMonth, user, fetchAllotmentData]);

  const handleBulkMove = useCallback(async (targetGroup) => {
    const selectedIds = Object.keys(selectedAgents).filter(id => selectedAgents[id]);
    if (selectedIds.length === 0) {
      toast.error('No agents selected');
      return;
    }

    try {
      const agentsToMove = filteredHighAlpData.filter(agent => selectedIds.includes(agent.id.toString()));
      
      for (const agent of agentsToMove) {
        await api.post('/pnp/allotment-overrides', {
          agentId: agent.agentId,
          targetMonth: selectedMonth,
          overrideType: 'move_to_group',
          targetGroup: parseInt(targetGroup),
          reason: `Bulk moved to Category ${targetGroup} by ${user.clname || user.lagnname}`
        });
      }
      
      toast.success(`${agentsToMove.length} agents moved to Category ${targetGroup}`);
      setSelectedAgents({});
      setShowBulkActionsModal(false);
      fetchAllotmentData();
    } catch (error) {
      console.error('Error applying bulk move:', error);
      toast.error('Failed to move agents');
    }
  }, [selectedAgents, filteredHighAlpData, selectedMonth, user, fetchAllotmentData]);

  const handleBulkExcludeAllFuture = useCallback(async () => {
    const selectedIds = Object.keys(selectedAgents).filter(id => selectedAgents[id]);
    if (selectedIds.length === 0) {
      toast.error('No agents selected');
      return;
    }

    if (!window.confirm(`Are you sure you want to exclude ${selectedIds.length} agents from ALL FUTURE allotments? This is a permanent action.`)) {
      return;
    }

    try {
      const agentsToExclude = filteredHighAlpData.filter(agent => selectedIds.includes(agent.id.toString()));
      
      for (const agent of agentsToExclude) {
        await api.post('/pnp/allotment-overrides', {
          agentId: agent.agentId,
          targetMonth: null,
          overrideType: 'exclude_all_future',
          reason: `Bulk excluded from all future by ${user.clname || user.lagnname}`
        });
      }
      
      toast.success(`${agentsToExclude.length} agents excluded from all future allotments`);
      setSelectedAgents({});
      setShowBulkActionsModal(false);
      fetchAllotmentData();
    } catch (error) {
      console.error('Error applying bulk exclude all future:', error);
      toast.error('Failed to apply exclusion');
    }
  }, [selectedAgents, filteredHighAlpData, user, fetchAllotmentData]);

  const handleRemoveOverride = useCallback(async (agentId) => {
    const override = allotmentOverrides.find(o => o.agent_id === agentId);
    if (!override) return;

    try {
      await api.delete(`/pnp/allotment-overrides/${override.id}`);
      toast.success('Override removed');
      fetchAllotmentData();
    } catch (error) {
      console.error('Error removing override:', error);
      toast.error('Failed to remove override');
    }
  }, [allotmentOverrides, fetchAllotmentData]);

  // Add or update override for a single agent
  const handleAddOverride = useCallback(async (agentId, overrideType, targetGroup = null, reason = '') => {
    try {
      const payload = {
        agentId: agentId,
        targetMonth: overrideType === 'exclude_all_future' ? null : selectedMonth || null,
        overrideType: overrideType,
        reason: reason || `Override by ${user.clname || user.lagnname}`
      };
      
      if (overrideType === 'move_to_group' && targetGroup) {
        payload.targetGroup = targetGroup;
      }

      await api.post('/pnp/allotment-overrides', payload);
      toast.success('Override applied');
      fetchAllotmentData();
    } catch (error) {
      console.error('Error adding override:', error);
      toast.error('Failed to apply override');
    }
  }, [selectedMonth, user, fetchAllotmentData]);

  // Columns for high ALP table (includes Allotment Group)
  const highAlpColumns = useMemo(() => {
    const columns = [];
    
    // Add mass selection column for admins
    if (hasElevatedPermissions) {
      columns.push({
        Header: '☑',
        accessor: 'massSelect',
        massSelection: true,
        width: 40,
        disableSortBy: true
      });
    }
    
    columns.push({
      Header: 'Category',
      accessor: 'allotmentGroup',
      Cell: ({ value, row }) => {
        if (!value) return '-';
        
        // Handle custom groups
        if (value === 'Custom') {
          const customGroupName = row.original.customGroupName || 'Custom';
          const customGroupColor = row.original.customGroupColor || '#6c757d';
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ 
                fontWeight: 'bold', 
                fontSize: '13px',
                color: customGroupColor
              }}>
                {customGroupName}
              </span>
              <span style={{ 
                fontSize: '9px', 
                color: '#666',
                lineHeight: '1.2',
                fontStyle: 'italic'
              }}>
                Custom Category
              </span>
            </div>
          );
        }
        
        // Handle regular groups
        const details = getGroupDetails(value);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ 
              fontWeight: 'bold', 
              fontSize: '16px',
              color: details.color
            }}>
              {value}
            </span>
            <span style={{ 
              fontSize: '10px', 
              color: '#666',
              lineHeight: '1.2'
            }}>
              {details.leads} leads
            </span>
          </div>
        );
      },
      sortType: 'basic',
      width: 100
    },
    {
      Header: 'Lead Types',
      accessor: 'leadTypes',
      Cell: ({ row }) => {
        const group = row.original.allotmentGroup;
        if (!group) return 'N/A';
        const details = getGroupDetails(group);
        return (
          <span style={{ 
            fontSize: '11px',
            color: '#495057',
            fontWeight: '500'
          }}>
            {details.leadTypes}
          </span>
        );
      },
      width: 180
    },
    {
      Header: 'Refs',
      accessor: 'prevMonthRefs',
      Cell: ({ row }) => {
        const group = row.original.allotmentGroup;
        const prevMonthRefs = row.original.prevMonthRefs || 0;
        if (!group) return 'N/A';
        
        // Handle custom groups - get refs requirement from custom group data
        if (group === 'Custom') {
          const customGroupId = activeGroupFilter.startsWith('custom-') ? 
            parseInt(activeGroupFilter.replace('custom-', '')) : null;
          const customGroup = customGroupId ? customGroups.find(g => g.id === customGroupId) : null;
          const refsRequired = customGroup?.refsRequired || 0;
          
          if (refsRequired === 0) {
            return (
              <span style={{ 
                fontWeight: 'bold',
                fontSize: '13px'
              }}>
                {prevMonthRefs}
              </span>
            );
          }
          
          const meetsRequirement = prevMonthRefs >= refsRequired;
          return (
            <span 
              style={{ 
                fontWeight: 'bold',
                color: meetsRequirement ? '#155724' : '#721c24',
                backgroundColor: meetsRequirement ? '#d4edda' : '#f8d7da',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '13px',
                cursor: 'help'
              }}
              title={`${prevMonthRefs} refs out of ${refsRequired} required • ${meetsRequirement ? 'Meets requirement ✓' : 'Below requirement - leads will be halved ✗'}`}
            >
              {prevMonthRefs}/{refsRequired}
            </span>
          );
        }
        
        const details = getGroupDetails(group);
        const meetsRequirement = prevMonthRefs >= details.refs;
        
        return (
          <span 
            style={{ 
              fontWeight: 'bold',
              color: meetsRequirement ? '#155724' : '#721c24',
              backgroundColor: meetsRequirement ? '#d4edda' : '#f8d7da',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: 'help'
            }}
            title={`${prevMonthRefs} refs out of ${details.refs} required • ${meetsRequirement ? 'Meets requirement ✓' : 'Below requirement - leads will be halved ✗'}`}
          >
            {prevMonthRefs}/{details.refs}
          </span>
        );
      },
      width: 90
    },
    {
      Header: 'VIPs',
      accessor: 'vipCount',
      Cell: ({ row }) => {
        const vipCount = row.original.vipCount || 0;
        const vipNames = row.original.vipNames || '';
        const vipAlp = row.original.vipAlp || 0;
        
        if (vipCount === 0) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        
        return (
          <span 
            style={{ 
              fontWeight: 'bold',
              color: '#155724',
              backgroundColor: '#d4edda',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: 'help'
            }}
            title={`${vipCount} VIP${vipCount > 1 ? 's' : ''} = ${vipAlp.toLocaleString()} ALP\n\nVIPs:\n${vipNames}`}
          >
            {vipCount}
          </span>
        );
      },
      width: 70
    },
    {
      Header: 'MGA',
      accessor: 'mga',
      Cell: ({ value }) => value || 'N/A'
    },
    {
      Header: 'Agent',
      accessor: 'agent',
      Cell: ({ value }) => value || 'N/A'
    });
    
    // Add 1st Pack Date column only when F90 filter is active
    if (activeGroupFilter === 'f90') {
      columns.push({
        Header: '1st Pack Date',
        accessor: 'firstPackDate',
        Cell: ({ row }) => {
          const agentId = row.original.agentId;
          const f90Data = f90AgentData && f90AgentData[agentId];
          
          if (!f90Data || !f90Data.firstPackDate) return 'N/A';
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ 
                fontWeight: 'bold', 
                fontSize: '12px',
                color: '#047857'
              }}>
                {f90Data.firstPackDate}
              </span>
              <span style={{ 
                fontSize: '9px', 
                color: '#047857',
                backgroundColor: '#d1fae5',
                padding: '2px 4px',
                borderRadius: '3px',
                fontStyle: 'italic'
              }}>
                Eligible for F90
              </span>
            </div>
          );
        },
        width: 140,
        sortType: 'basic'
      });
    }
    
    columns.push({
      Header: 'System Status',
      accessor: 'systemStatus',
      Cell: ({ row }) => {
        const isSystemInactive = row.original.Active === 'n';
        const isManagerInactive = row.original.managerActive === 'n';
        
        if (!isSystemInactive && !isManagerInactive) {
          return (
            <span style={{
              fontSize: '11px',
              color: '#155724',
              backgroundColor: '#d4edda',
              padding: '2px 6px',
              borderRadius: '3px',
              fontWeight: '500'
            }}>
              Active
            </span>
          );
        }
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {isSystemInactive && (
              <span style={{
                fontSize: '10px',
                color: '#721c24',
                backgroundColor: '#f8d7da',
                padding: '2px 6px',
                borderRadius: '3px',
                fontWeight: '600'
              }}>
                Inactive in System
              </span>
            )}
            {isManagerInactive && (
              <span style={{
                fontSize: '10px',
                color: '#856404',
                backgroundColor: '#fff3cd',
                padding: '2px 6px',
                borderRadius: '3px',
                fontWeight: '600'
              }}>
                Manager Set Inactive
              </span>
            )}
          </div>
        );
      },
      width: 140
    },
    {
      Header: 'Retention',
      accessor: 'retention',
      Cell: ({ value, row }) => {
        if (!value || value === 'N/A') return 'N/A';
        
        // Handle both regular percentages and n2g values
        const isN2G = value.includes('n2g');
        const percentage = parseFloat(value.replace('%', '').replace('n2g', ''));
        
        // Check POS eligibility based on group and retention
        const group = row.original.allotmentGroup;
        const isPosEligible = (group === 1 || group === 2) && (
          (isN2G && percentage >= 85) || // NTG < 13 months needs 85+
          (!isN2G && percentage >= 76) // > 13 months needs 76+
        );
        
        let color = '#000';
        let backgroundColor = 'transparent';
        
        if (percentage >= 90) {
          color = '#155724';
          backgroundColor = '#d4edda';
        } else if (percentage >= 80) {
          color = '#856404';
          backgroundColor = '#fff3cd';
        } else if (percentage < 80) {
          color = '#721c24';
          backgroundColor = '#f8d7da';
        }
        
        // Different styling for n2g values
        if (isN2G) {
          backgroundColor = backgroundColor === 'transparent' ? '#e6f3ff' : backgroundColor;
        }
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{
              color,
              backgroundColor,
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: '500',
              fontSize: '12px'
            }} title={isN2G ? 'Based on YTD percentage (n2g)' : 'Based on 4-month rate'}>
              {value}
            </span>
            {isPosEligible && (
              <span style={{
                fontSize: '9px',
                color: '#0c5460',
                backgroundColor: '#d1ecf1',
                padding: '1px 4px',
                borderRadius: '3px',
                fontWeight: '600'
              }}>
                POS Eligible
              </span>
            )}
          </div>
        );
      },
      width: 110
    },
    {
      Header: 'Area Request',
      accessor: 'areaRequest',
      filterSplitBy: ',', // Enable comma-separated value filtering
      Cell: ({ value }) => (
        <span style={{ fontSize: '11px' }}>
          {value || 'N/A'}
        </span>
      ),
      width: 150
    },
    {
      Header: 'ALP',
      accessor: 'alp',
      Cell: ({ value, row }) => {
        if (value === null || value === undefined) return 'N/A';
        
        // Format as currency
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);
        
        // Get breakdown for tooltip
        const monthlyAlp = row.original.monthlyAlp || 0;
        const vipAlp = row.original.vipAlp || 0;
        const vipCount = row.original.vipCount || 0;
        
        const monthlyFormatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(monthlyAlp);
        
        const vipFormatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(vipAlp);
        
        const tooltipText = vipCount > 0 
          ? `Final ALP: ${formatted}\n\nBreakdown:\n• Monthly ALP: ${monthlyFormatted}\n• VIP ALP: ${vipFormatted} (${vipCount} VIP${vipCount > 1 ? 's' : ''})\n• Formula: (Monthly + VIP) / 2`
          : `Final ALP: ${formatted}\n(No VIP credits)`;
        
        // Style based on ALP amount
        const num = parseInt(value);
        let color = '#000';
        let backgroundColor = 'transparent';
        
        if (num >= 3000) {
          color = '#155724';
          backgroundColor = '#d4edda';
        } else if (num >= 2500) {
          color = '#856404';
          backgroundColor = '#fff3cd';
        } else if (num < 2500) {
          color = '#721c24';
          backgroundColor = '#f8d7da';
        }
        
        return (
          <span style={{
            color,
            backgroundColor,
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: '500',
            cursor: 'help'
          }}
          title={tooltipText}
          >
            {formatted}
          </span>
        );
      },
      width: 110
    },
    {
      Header: 'Status',
      accessor: 'status',
      Cell: ({ row }) => {
        const group = row.original.allotmentGroup;
        const prevMonthRefs = row.original.prevMonthRefs || 0;
        const alp = row.original.alp || 0;
        
        if (!group) return 'N/A';
        
        // Handle custom groups
        if (group === 'Custom') {
          const customGroupId = activeGroupFilter.startsWith('custom-') ? 
            parseInt(activeGroupFilter.replace('custom-', '')) : null;
          const customGroup = customGroupId ? customGroups.find(g => g.id === customGroupId) : null;
          const refsRequired = customGroup?.refsRequired || 0;
          
          if (refsRequired === 0) {
            return (
              <span style={{
                backgroundColor: '#d4edda',
                color: '#155724',
                padding: '4px 8px',
                borderRadius: '4px',
                fontWeight: '600',
                fontSize: '11px'
              }}>
                ✓ In Custom Category
              </span>
            );
          }
          
          const meetsRefs = prevMonthRefs >= refsRequired;
          
          if (meetsRefs) {
            return (
              <span style={{
                backgroundColor: '#d4edda',
                color: '#155724',
                padding: '4px 8px',
                borderRadius: '4px',
                fontWeight: '600',
                fontSize: '11px'
              }}>
                ✓ Full Allotment
              </span>
            );
          } else {
            return (
              <span style={{
                backgroundColor: '#fff3cd',
                color: '#856404',
                padding: '4px 8px',
                borderRadius: '4px',
                fontWeight: '600',
                fontSize: '11px'
              }}>
                ⚠ 50% Leads (Refs)
              </span>
            );
          }
        }
        
        const details = getGroupDetails(group);
        const meetsRefs = prevMonthRefs >= details.refs;
        const meetsAlp = alp >= 3000;
        
        if (meetsAlp && meetsRefs) {
          return (
            <span style={{
              backgroundColor: '#d4edda',
              color: '#155724',
              padding: '4px 8px',
              borderRadius: '4px',
              fontWeight: '600',
              fontSize: '11px'
            }}>
              ✓ Full Allotment
            </span>
          );
        } else if (meetsAlp && !meetsRefs) {
          return (
            <span style={{
              backgroundColor: '#fff3cd',
              color: '#856404',
              padding: '4px 8px',
              borderRadius: '4px',
              fontWeight: '600',
              fontSize: '11px'
            }}>
              ⚠ 50% Leads (Refs)
            </span>
          );
        } else {
          return (
            <span style={{
              backgroundColor: '#f8d7da',
              color: '#721c24',
              padding: '4px 8px',
              borderRadius: '4px',
              fontWeight: '600',
              fontSize: '11px'
            }}>
              ✗ No Allotment
            </span>
          );
        }
      },
      width: 140
    });
    
    // Add override actions column for admins
    if (hasElevatedPermissions) {
      columns.push({
        Header: 'Override',
        accessor: 'overrideActions',
        Cell: ({ row }) => {
          const hasOverride = row.original.hasOverride;
          const overrideType = row.original.overrideType;
          const overrideReason = row.original.overrideReason;
          const agentId = row.original.agentId;
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
              {hasOverride ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <select
                    value={overrideType || ''}
                    onChange={(e) => {
                      const newType = e.target.value;
                      if (!newType) {
                        handleRemoveOverride(agentId);
                      } else if (newType === 'move_to_group') {
                        // Prompt for target group
                        const targetGroup = prompt('Enter target category (1-5 or custom-GROUP_ID):');
                        if (targetGroup) {
                          handleAddOverride(agentId, newType, targetGroup);
                        }
                      } else {
                        handleAddOverride(agentId, newType);
                      }
                    }}
                    style={{
                      padding: '3px 6px',
                      fontSize: '11px',
                      borderRadius: '3px',
                      border: '1px solid #ccc',
                      backgroundColor: '#fff3cd',
                      color: '#856404',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                    title={overrideReason || 'Manual override applied'}
                  >
                    <option value="exclude">Excluded This Month</option>
                    <option value="move_to_group">Moved to {row.original.overrideTargetGroup}</option>
                    <option value="exclude_all_future">Excluded All Future</option>
                    <option value="">Remove Override</option>
                  </select>
                </div>
              ) : (
                <select
                  value=""
                  onChange={(e) => {
                    const newType = e.target.value;
                    if (newType === 'move_to_group') {
                      const targetGroup = prompt('Enter target category (1-5 or custom-GROUP_ID):');
                      if (targetGroup) {
                        handleAddOverride(agentId, newType, targetGroup);
                      }
                    } else if (newType) {
                      handleAddOverride(agentId, newType);
                    }
                  }}
                  style={{
                    padding: '3px 6px',
                    fontSize: '11px',
                    borderRadius: '3px',
                    border: '1px solid #ccc',
                    backgroundColor: '#f8f9fa',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">No Override</option>
                  <option value="exclude">Exclude This Month</option>
                  <option value="move_to_group">Move to Category...</option>
                  <option value="exclude_all_future">Exclude All Future</option>
                </select>
              )}
              {row.original.groupOverridden && (
                <span style={{ fontSize: '9px', color: '#666', fontStyle: 'italic' }}>
                  Original: Category {row.original.originalGroup}
                </span>
              )}
            </div>
          );
        },
        width: 180,
        disableSortBy: true
      });
    }
    
    return columns;
  }, [activeGroupFilter, customGroups, hasElevatedPermissions, handleRemoveOverride, handleAddOverride, f90AgentData]);

  // Columns for low ALP table (no Allotment Group)
  const lowAlpColumns = useMemo(() => [
    {
      Header: 'MGA',
      accessor: 'mga',
      Cell: ({ value }) => value || 'N/A',
      width: 150
    },
    {
      Header: 'Agent',
      accessor: 'agent',
      Cell: ({ value }) => value || 'N/A',
      width: 150
    },
    {
      Header: 'System Status',
      accessor: 'systemStatus',
      Cell: ({ row }) => {
        const isSystemInactive = row.original.Active === 'n';
        const isManagerInactive = row.original.managerActive === 'n';
        
        if (!isSystemInactive && !isManagerInactive) {
          return (
            <span style={{
              fontSize: '11px',
              color: '#155724',
              backgroundColor: '#d4edda',
              padding: '2px 6px',
              borderRadius: '3px',
              fontWeight: '500'
            }}>
              Active
            </span>
          );
        }
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {isSystemInactive && (
              <span style={{
                fontSize: '10px',
                color: '#721c24',
                backgroundColor: '#f8d7da',
                padding: '2px 6px',
                borderRadius: '3px',
                fontWeight: '600'
              }}>
                Inactive in System
              </span>
            )}
            {isManagerInactive && (
              <span style={{
                fontSize: '10px',
                color: '#856404',
                backgroundColor: '#fff3cd',
                padding: '2px 6px',
                borderRadius: '3px',
                fontWeight: '600'
              }}>
                Manager Set Inactive
              </span>
            )}
          </div>
        );
      },
      width: 140
    },
    {
      Header: 'Retention',
      accessor: 'retention',
      Cell: ({ value }) => {
        if (!value || value === 'N/A') return 'N/A';
        
        // Handle both regular percentages and n2g values
        const isN2G = value.includes('n2g');
        const percentage = parseFloat(value.replace('%', '').replace('n2g', ''));
        
        let bgColor = '#fff';
        let textColor = '#000';
        let tooltip = '';
        
        if (isN2G) {
          bgColor = '#fff3cd'; // Light yellow for n2g
          textColor = '#856404';
          tooltip = 'New to Category data';
        } else if (percentage >= 75) {
          bgColor = '#d4edda'; // Light green
          textColor = '#155724';
          tooltip = 'Good retention';
        } else if (percentage >= 50) {
          bgColor = '#fff3cd'; // Light yellow
          textColor = '#856404';
          tooltip = 'Average retention';
        } else if (percentage > 0) {
          bgColor = '#f8d7da'; // Light red
          textColor = '#721c24';
          tooltip = 'Low retention';
        }
        
        return (
          <span 
            style={{ 
              backgroundColor: bgColor, 
              color: textColor, 
              padding: '2px 6px', 
              borderRadius: '3px',
              fontSize: '13px'
            }}
            title={tooltip}
          >
            {value}
          </span>
        );
      }
    },
    {
      Header: 'Lead Type Pref',
      accessor: 'leadTypePref',
      Cell: ({ value }) => value || 'TBD'
    },
    {
      Header: 'Area Request',
      accessor: 'areaRequest',
      filterSplitBy: ',', // Enable comma-separated value filtering
      Cell: ({ value }) => value || 'N/A'
    },
    {
      Header: 'Prev Month Category',
      accessor: 'prevMonthGroup',
      Cell: ({ value }) => {
        const num = Number(value) || 0;
        const bgColor = num > 0 ? '#e7f3ff' : '#fff';
        
        return (
          <span style={{ 
            backgroundColor: bgColor, 
            padding: '2px 6px', 
            borderRadius: '3px',
            fontSize: '13px'
          }}>
            {num.toLocaleString()}
          </span>
        );
      }
    },
    {
      Header: 'Prev Month Refs',
      accessor: 'prevMonthRefs',
      Cell: ({ value }) => {
        const num = Number(value) || 0;
        let bgColor = '#fff';
        let textColor = '#000';
        
        if (num >= 5) {
          bgColor = '#d4edda'; // Light green
          textColor = '#155724';
        } else if (num >= 2) {
          bgColor = '#fff3cd'; // Light yellow
          textColor = '#856404';
        } else if (num > 0) {
          bgColor = '#f8d7da'; // Light red
          textColor = '#721c24';
        }
        
        return (
          <span style={{ 
            backgroundColor: bgColor, 
            color: textColor,
            padding: '2px 6px', 
            borderRadius: '3px',
            fontSize: '13px',
            fontWeight: num > 0 ? 'bold' : 'normal'
          }}>
            {num}
          </span>
        );
      }
    },
    {
      Header: 'VIPs',
      accessor: 'vipCount',
      Cell: ({ row }) => {
        const vipCount = row.original.vipCount || 0;
        const vipNames = row.original.vipNames || '';
        const vipAlp = row.original.vipAlp || 0;
        
        if (vipCount === 0) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        
        return (
          <span 
            style={{ 
              fontWeight: 'bold',
              color: '#155724',
              backgroundColor: '#d4edda',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: 'help'
            }}
            title={`${vipCount} VIP${vipCount > 1 ? 's' : ''} = ${vipAlp.toLocaleString()} ALP\n\nVIPs:\n${vipNames}`}
          >
            {vipCount}
          </span>
        );
      },
      width: 70
    },
    {
      Header: 'ALP',
      accessor: 'alp',
      Cell: ({ value, row }) => {
        const num = Number(value) || 0;
        const formatted = num.toLocaleString();
        const gapTo3k = Math.max(0, 3000 - num);
        const gapTo6k = Math.max(0, 6000 - num);
        
        // Get breakdown for tooltip
        const monthlyAlp = row.original.monthlyAlp || 0;
        const vipAlp = row.original.vipAlp || 0;
        const vipCount = row.original.vipCount || 0;
        
        const tooltipText = vipCount > 0 
          ? `Final ALP: $${formatted}\n\nBreakdown:\n• Monthly ALP: $${monthlyAlp.toLocaleString()}\n• VIP ALP: $${vipAlp.toLocaleString()} (${vipCount} VIP${vipCount > 1 ? 's' : ''})\n• Formula: (Monthly + VIP) / 2`
          : `Final ALP: $${formatted}\n(No VIP credits)`;
        
        let bgColor = '#fff';
        let textColor = '#000';
        let eligible6k = false;
        
        if (num >= 3000) {
          bgColor = '#d4edda'; // Light green
          textColor = '#155724';
        } else if (num >= 1500) {
          bgColor = '#fff3cd'; // Light yellow
          textColor = '#856404';
          if (gapTo6k <= 4500) { // Close to 6k rule
            eligible6k = true;
          }
        } else if (num > 0) {
          bgColor = '#f8d7da'; // Light red
          textColor = '#721c24';
        }
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span 
              style={{ 
                backgroundColor: bgColor,
                color: textColor,
                padding: '2px 6px', 
                borderRadius: '3px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'help'
              }}
              title={tooltipText}
            >
              ${formatted}
            </span>
            {num < 3000 && (
              <span style={{ fontSize: '10px', color: '#666' }}>
                ${gapTo3k.toLocaleString()} to 3k
              </span>
            )}
            {eligible6k && num < 3000 && (
              <span style={{ 
                fontSize: '9px', 
                color: '#0c5460',
                backgroundColor: '#d1ecf1',
                padding: '1px 4px',
                borderRadius: '2px'
              }}>
                6k Rule: +${gapTo6k.toLocaleString()}
              </span>
            )}
          </div>
        );
      },
      width: 130
    },
    {
      Header: 'Path Forward',
      accessor: 'pathForward',
      Cell: ({ row }) => {
        const alp = row.original.alp || 0;
        const refs = row.original.prevMonthRefs || 0;
        
        if (alp >= 6000 && refs >= 2) {
          return (
            <span style={{
              fontSize: '11px',
              color: '#155724',
              backgroundColor: '#d4edda',
              padding: '3px 6px',
              borderRadius: '3px',
              fontWeight: '600'
            }}>
              ✓ 6k Rule Eligible
            </span>
          );
        } else if (alp >= 3000 && alp < 6000) {
          return (
            <span style={{
              fontSize: '11px',
              color: '#856404',
              backgroundColor: '#fff3cd',
              padding: '3px 6px',
              borderRadius: '3px',
              fontWeight: '600'
            }}>
              Monitor for F90
            </span>
          );
        } else {
          const needed = 6000 - alp;
          return (
            <span style={{
              fontSize: '10px',
              color: '#666'
            }}>
              Need ${needed.toLocaleString()} for 6k rule
            </span>
          );
        }
      },
      width: 140
    }
  ], []);

  // Show loading state while hierarchy loads for non-elevated, non-AGT users
  if (hierarchyLoading && !hasElevatedPermissions && !isAgtUser && !hierarchyData) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Loading user permissions and allotment data...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search Bar and Admin Controls */}
      <div className="search-bar mb-4" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search by MGA, Agent, Lead Type, or Area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: 360 }}
          />
          {canManageCustomGroups && (
            <button
              onClick={() => {
                setEditingCustomGroup(null);
                setShowCustomGroupModal(true);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#00558c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              + Custom Category
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#495057', whiteSpace: 'nowrap' }}>
            Allotment Month:
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '13px',
              backgroundColor: 'white',
              cursor: 'pointer',
              minWidth: '150px'
            }}
          >
            {monthOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {hasElevatedPermissions && selectedMonth && (
            <button
              onClick={() => setShowSettingsModal(true)}
              style={{
                padding: '6px 12px',
                border: '1px solid #00558c',
                borderRadius: '4px',
                backgroundColor: 'white',
                color: '#00558c',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#00558c';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.color = '#00558c';
              }}
              title="Configure calculation settings for this allotment month"
            >
              ⚙️ Settings
            </button>
          )}
          {hasElevatedPermissions && (
            <button
              onClick={() => setShowDropDatesModal(true)}
              style={{
                padding: '6px 12px',
                border: '1px solid #10b981',
                borderRadius: '4px',
                backgroundColor: 'white',
                color: '#10b981',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#10b981';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.color = '#10b981';
              }}
              title="Manage lead drop dates"
            >
              📅 Drop Dates
            </button>
          )}
          {apiResponseData && (
            <div style={{ 
              fontSize: '11px', 
              color: '#666', 
              paddingLeft: '12px', 
              borderLeft: '1px solid #dee2e6',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <span>
                <strong>ALP:</strong> {apiResponseData.alpSourceMonths || apiResponseData.alpSourceMonth}
              </span>
              <span>
                <strong>Refs:</strong> {apiResponseData.refMonths}
              </span>
            </div>
          )}
        </div>
      </div>


      {/* Historical Data Notice */}
      {(() => {
        const now = new Date();
        let selectedDate = now;
        
        if (selectedMonth) {
          // Parse YYYY-MM format correctly in local timezone
          const [year, month] = selectedMonth.split('-').map(Number);
          selectedDate = new Date(year, month - 1, 1); // month is 0-indexed
        }
        
        const isPastMonth = selectedDate < new Date(now.getFullYear(), now.getMonth(), 1);
        
        if (isPastMonth) {
          return (
            <div style={{ 
              marginBottom: '16px', 
              padding: '12px 16px', 
              backgroundColor: '#fff3cd', 
              borderRadius: '6px',
              border: '1px solid #ffc107',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '16px' }}>📊</span>
              <span style={{ fontSize: '13px', color: '#856404', fontWeight: '600' }}>
                Viewing historical allotment data for {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          );
        }
        return null;
      })()}

      {/* Debug info for admins */}
      {hasElevatedPermissions && (
        <div style={{ 
          marginBottom: '8px', 
          padding: '8px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          fontSize: '11px',
          color: '#6c757d'
        }}>
          <strong>Selection Debug:</strong> {Object.keys(selectedAgents).filter(id => selectedAgents[id]).length} agents selected
          {Object.keys(selectedAgents).length > 0 && ` (IDs: ${Object.keys(selectedAgents).filter(id => selectedAgents[id]).slice(0, 5).join(', ')}${Object.keys(selectedAgents).filter(id => selectedAgents[id]).length > 5 ? '...' : ''})`}
          {' | '}Total agents in view: {filteredHighAlpData.length}
          {' | '}First agent ID: {filteredHighAlpData[0]?.id || 'N/A'}
        </div>
      )}

      {/* Bulk Actions Bar (Admin Only) */}
      {hasElevatedPermissions && Object.keys(selectedAgents).filter(id => selectedAgents[id]).length > 0 && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 16px',
          backgroundColor: '#d1ecf1',
          borderRadius: '6px',
          border: '2px solid #00558c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 'bold', color: '#00558c', fontSize: '14px' }}>
              {Object.keys(selectedAgents).filter(id => selectedAgents[id]).length} agents selected
            </span>
            <button
              onClick={() => setSelectedAgents({})}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear Selection
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setBulkActionType('exclude');
                setShowBulkActionsModal(true);
              }}
              style={{
                padding: '6px 16px',
                fontSize: '13px',
                background: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Exclude This Month
            </button>
            <button
              onClick={() => {
                setBulkActionType('move');
                setShowBulkActionsModal(true);
              }}
              style={{
                padding: '6px 16px',
                fontSize: '13px',
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Move to Category...
            </button>
            <button
              onClick={() => {
                setBulkActionType('exclude_all_future');
                setShowBulkActionsModal(true);
              }}
              style={{
                padding: '6px 16px',
                fontSize: '13px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Exclude All Future
            </button>
          </div>
        </div>
      )}

      {/* Bulk Actions Modal */}
      {showBulkActionsModal && (
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
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
              {bulkActionType === 'exclude' && 'Exclude Agents from This Month'}
              {bulkActionType === 'move' && 'Move Agents to Different Category'}
              {bulkActionType === 'exclude_all_future' && 'Exclude Agents from All Future Allotments'}
            </h3>
            
            {bulkActionType === 'exclude' && (
              <div>
                <p>Exclude {Object.keys(selectedAgents).filter(id => selectedAgents[id]).length} agents from <strong>{selectedMonth}</strong> allotment?</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    onClick={() => setShowBulkActionsModal(false)}
                    style={{
                      padding: '8px 16px',
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkExclude}
                    style={{
                      padding: '8px 16px',
                      background: '#ffc107',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Exclude
                  </button>
                </div>
              </div>
            )}
            
            {bulkActionType === 'move' && (
              <div>
                <p>Move {Object.keys(selectedAgents).filter(id => selectedAgents[id]).length} agents to which category for <strong>{selectedMonth}</strong>?</p>
                <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                  {[1, 2, 3, 4, 5].map(groupNum => (
                    <button
                      key={groupNum}
                      onClick={() => handleBulkMove(groupNum)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '12px',
                        marginBottom: '8px',
                        background: getGroupDetails(groupNum).bgColor,
                        color: getGroupDetails(groupNum).color,
                        border: `2px solid ${getGroupDetails(groupNum).color}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                        textAlign: 'left'
                      }}
                    >
                      Category {groupNum} - {getGroupDetails(groupNum).leads} leads/month ({getGroupDetails(groupNum).perDrop} per drop)
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowBulkActionsModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            
            {bulkActionType === 'exclude_all_future' && (
              <div>
                <p style={{ color: '#dc3545', fontWeight: 'bold' }}>
                  ⚠️ WARNING: This will exclude {Object.keys(selectedAgents).filter(id => selectedAgents[id]).length} agents from ALL FUTURE allotments!
                </p>
                <p>This action should only be used for agents who are leaving or transitioning out.</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    onClick={() => setShowBulkActionsModal(false)}
                    style={{
                      padding: '8px 16px',
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkExcludeAllFuture}
                    style={{
                      padding: '8px 16px',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Exclude All Future
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* High ALP Table (>= 3000 with Allotment Groups) */}
      <div style={{ marginBottom: '40px', position: 'relative' }}>
        {/* Loading Overlay */}
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            gap: '16px',
            borderRadius: '8px'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid #f3f4f6',
              borderTop: '4px solid #00558c',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#374151'
            }}>
              Loading allotment data{selectedMonth ? (() => {
                const [year, month] = selectedMonth.split('-').map(Number);
                const date = new Date(year, month - 1, 1);
                return ` for ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
              })() : ''}...
            </div>
          </div>
        )}

        <h3 style={{ 
          marginBottom: '15px', 
          color: (() => {
            if (activeGroupFilter === 'exceptions') return '#f59e0b';
            if (activeGroupFilter === 'exclusions') return '#dc2626';
            if (activeGroupFilter.startsWith('custom-')) {
              return customGroups.find(g => g.id === parseInt(activeGroupFilter.replace('custom-', '')))?.color || '#2c5aa0';
            }
            return '#2c5aa0';
          })(), 
          borderBottom: `2px solid ${(() => {
            if (activeGroupFilter === 'exceptions') return '#f59e0b';
            if (activeGroupFilter === 'exclusions') return '#dc2626';
            if (activeGroupFilter.startsWith('custom-')) {
              return customGroups.find(g => g.id === parseInt(activeGroupFilter.replace('custom-', '')))?.color || '#2c5aa0';
            }
            return '#2c5aa0';
          })()}`, 
          paddingBottom: '5px',
          fontSize: '18px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <span>
            {(() => {
              if (activeGroupFilter === 'exceptions') {
                return `Exceptions (Moved to Different Category) - ${filteredHighAlpData.length} agents`;
              }
              if (activeGroupFilter === 'exclusions') {
                return `Exclusions (Removed from Allotment) - ${filteredHighAlpData.length} agents`;
              }
              if (activeGroupFilter === '6k-reup') {
                return `6k Reup Category (ALP < 3000) - ${filteredHighAlpData.length} agents`;
              }
              if (activeGroupFilter === 'f90') {
                return `F90 Category (31-90 Days Since 1st Pack on Drop Date) - ${filteredHighAlpData.length} agents`;
              }
              if (activeGroupFilter.startsWith('custom-')) {
                const customGroupId = parseInt(activeGroupFilter.replace('custom-', ''));
                const customGroup = customGroups.find(g => g.id === customGroupId);
                return `${customGroup?.groupName || 'Custom Category'} - ${filteredHighAlpData.length} agents`;
              }
              return `Agent Allotments - ${filteredHighAlpData.length} agents${activeGroupFilter !== 'all' ? ` in Category ${activeGroupFilter}` : ''}`;
            })()}
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeGroupFilter === 'exclusions' && (
              <>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#dc2626',
                  backgroundColor: '#fee2e2',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: '1px solid #fca5a5'
                }}>
                  {allotmentData.filter(item => item.overrideType === 'exclude').length} This Month • {allotmentData.filter(item => item.overrideType === 'exclude_all_future').length} All Future
                </span>
              </>
            )}
            {activeGroupFilter === 'exceptions' && (
              <>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#f59e0b',
                  backgroundColor: '#fef3c7',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: '1px solid #fde68a'
                }}>
                  Moved to Different Categories
                </span>
              </>
            )}
            {activeGroupFilter === '6k-reup' && (
              <>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#856404',
                  backgroundColor: '#fff3cd',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ffc107'
                }}>
                  Can be added to Category 5 if they write 6k gross
                </span>
              </>
            )}
            {activeGroupFilter === 'f90' && (
              <>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#047857',
                  backgroundColor: '#d1fae5',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: '1px solid #10b981'
                }}>
                  Agents 31-90 days since 1st Pack on drop date{dropDates.length > 0 ? ` (${dropDates.length} drop${dropDates.length !== 1 ? 's' : ''})` : ' (no drops configured)'}
                </span>
              </>
            )}
            {activeGroupFilter !== 'all' && !activeGroupFilter.startsWith('custom-') && activeGroupFilter !== 'exceptions' && activeGroupFilter !== 'exclusions' && activeGroupFilter !== '6k-reup' && activeGroupFilter !== 'f90' && (
              <span style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#495057',
                backgroundColor: '#e7f3ff',
                padding: '4px 12px',
                borderRadius: '4px',
                border: '1px solid #b3d9ff'
              }}>
                {(() => {
                  const details = getGroupDetails(parseInt(activeGroupFilter));
                  return `${details.leads} leads/month • ${details.refs} refs required`;
                })()}
              </span>
            )}
            {activeGroupFilter.startsWith('custom-') && (() => {
              const customGroupId = parseInt(activeGroupFilter.replace('custom-', ''));
              const customGroup = customGroups.find(g => g.id === customGroupId);
              
              if (!customGroup) return null;
              
              return (
                <>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#495057',
                    backgroundColor: '#e7f3ff',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    border: '1px solid #b3d9ff'
                  }}>
                    {customGroup.leadsPerMonth} leads/month • {customGroup.refsRequired} refs required
                    {customGroup.leadTypes && ` • ${customGroup.leadTypes}`}
                  </span>
                  {canManageCustomGroups && (
                    <>
                      <button
                        onClick={() => {
                          setEditingCustomGroup(customGroup);
                          setShowCustomGroupModal(true);
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f8f9fa',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Edit Category
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm(`Delete "${customGroup.groupName}"?`)) {
                            try {
                              await api.delete(`/pnp/custom-groups/${customGroup.id}`);
                              toast.success('Custom category deleted');
                              setActiveGroupFilter('all');
                              fetchAllotmentData();
                            } catch (error) {
                              toast.error('Error deleting category');
                            }
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f8d7da',
                          border: '1px solid #f5c6cb',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          color: '#721c24'
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </h3>
        
        {/* Category Filter Tabs */}
        <div style={{ 
          marginBottom: '15px', 
          borderBottom: '1px solid #dee2e6',
          paddingBottom: '0px'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: '0',
            borderRadius: '0',
            flexWrap: 'wrap'
          }}>
            {/* Custom Groups - Show first */}
            {customGroups.map(customGroup => {
              const isActive = activeGroupFilter === `custom-${customGroup.id}`;
              const count = customGroup.members.filter(m => !m.isExcluded).length;
              
              return (
                <button
                  key={`custom-${customGroup.id}`}
                  onClick={() => setActiveGroupFilter(`custom-${customGroup.id}`)}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: isActive ? `3px solid ${customGroup.color}` : '3px solid transparent',
                    backgroundColor: isActive ? '#f8f9fa' : 'transparent',
                    color: isActive ? customGroup.color : '#6c757d',
                    fontWeight: isActive ? 'bold' : 'normal',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderRadius: '4px 4px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#f1f3f5';
                      e.currentTarget.style.color = '#495057';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#6c757d';
                    }
                  }}
                  title={`${customGroup.leadsPerMonth} leads/month (${customGroup.leadsPerDrop} per drop) • ${customGroup.refsRequired} refs required${customGroup.leadTypes ? ` • ${customGroup.leadTypes}` : ''}`}
                >
                  <span style={{ fontWeight: isActive ? 'bold' : '600' }}>
                    {customGroup.groupName}
                  </span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>
                    {count} agent{count !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>
                    {customGroup.leadsPerMonth} leads • {customGroup.refsRequired} refs
                  </span>
                  {canManageCustomGroups && (
                    <span style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      fontSize: '10px',
                      color: '#666',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCustomGroup(customGroup);
                      setShowCustomGroupModal(true);
                    }}>
                      ✏️
                    </span>
                  )}
                </button>
              );
            })}

            {/* Regular Groups - After Custom Groups */}
            {['all', '1', '2', '3', '4', '5'].map(group => {
              const isActive = activeGroupFilter === group;
              const count = group === 'all' ? 
                highAlpData.filter(item => !item.isExcluded).length : 
                highAlpData.filter(item => item.allotmentGroup === parseInt(group) && !item.isExcluded).length;
              
              const groupDetails = group !== 'all' ? getGroupDetails(parseInt(group)) : null;
              
              return (
                <button
                  key={group}
                  onClick={() => setActiveGroupFilter(group)}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: isActive ? '3px solid #2c5aa0' : '3px solid transparent',
                    backgroundColor: isActive ? '#f8f9fa' : 'transparent',
                    color: isActive ? '#2c5aa0' : '#6c757d',
                    fontWeight: isActive ? 'bold' : 'normal',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderRadius: '4px 4px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#f1f3f5';
                      e.currentTarget.style.color = '#495057';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#6c757d';
                    }
                  }}
                  title={groupDetails ? `${groupDetails.leads} leads/month (${groupDetails.perDrop} per drop) • ${groupDetails.refs} refs required • ${groupDetails.leadTypes}` : 'View all categories'}
                >
                  <span style={{ fontWeight: isActive ? 'bold' : '600' }}>
                    {group === 'all' ? 'All Categories' : `Category ${group}`}
                  </span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>
                    {count} agent{count !== 1 ? 's' : ''}
                  </span>
                  {groupDetails && (
                    <>
                      <span style={{ fontSize: '10px', opacity: 0.7 }}>
                        {groupDetails.leads} leads • {groupDetails.refs} refs
                      </span>
                    </>
                  )}
                </button>
              );
            })}

            {/* F90 Tab */}
            {(() => {
              const isActive = activeGroupFilter === 'f90';
              // Count all F90 eligible agents (they've already been removed from regular groups)
              const count = allotmentData.filter(item => {
                if (item.isExcluded) return false;
                return f90AgentIds && f90AgentIds.has(item.agentId);
              }).length;
              
              return (
                <button
                  key="f90"
                  onClick={() => setActiveGroupFilter('f90')}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: isActive ? '3px solid #10b981' : '3px solid transparent',
                    backgroundColor: isActive ? '#f8f9fa' : 'transparent',
                    color: isActive ? '#047857' : '#6c757d',
                    fontWeight: isActive ? 'bold' : 'normal',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderRadius: '4px 4px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#f1f3f5';
                      e.currentTarget.style.color = '#495057';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#6c757d';
                    }
                  }}
                  title="Agents in their first 90 days (based on ESID)"
                >
                  <span style={{ fontWeight: isActive ? 'bold' : '600' }}>
                    F90
                  </span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>
                    {count} agent{count !== 1 ? 's' : ''}
                  </span>
                </button>
              );
            })()}

            {/* 6k Reup Group Tab */}
            {(() => {
              const isActive = activeGroupFilter === '6k-reup';
              const count = allotmentData.filter(item => (item.alp || 0) < 3000 && !item.isExcluded).length;
              
              return (
                <button
                  key="6k-reup"
                  onClick={() => setActiveGroupFilter('6k-reup')}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: isActive ? '3px solid #ffc107' : '3px solid transparent',
                    backgroundColor: isActive ? '#f8f9fa' : 'transparent',
                    color: isActive ? '#856404' : '#6c757d',
                    fontWeight: isActive ? 'bold' : 'normal',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderRadius: '4px 4px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#f1f3f5';
                      e.currentTarget.style.color = '#495057';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#6c757d';
                    }
                  }}
                  title="Agents below 3k ALP - can be added to Category 5 if they write 6k gross"
                >
                  <span style={{ fontWeight: isActive ? 'bold' : '600' }}>
                    6k Reup
                  </span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>
                    {count} agent{count !== 1 ? 's' : ''}
                  </span>
                </button>
              );
            })()}

            {/* Exceptions Tab */}
            {(() => {
              const isActive = activeGroupFilter === 'exceptions';
              const count = allotmentData.filter(item => item.hasOverride && item.overrideType === 'move_to_group').length;
              
              return (
                <button
                  key="exceptions"
                  onClick={() => setActiveGroupFilter('exceptions')}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: isActive ? '3px solid #f59e0b' : '3px solid transparent',
                    backgroundColor: isActive ? '#f8f9fa' : 'transparent',
                    color: isActive ? '#f59e0b' : '#6c757d',
                    fontWeight: isActive ? 'bold' : 'normal',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderRadius: '4px 4px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#f1f3f5';
                      e.currentTarget.style.color = '#495057';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#6c757d';
                    }
                  }}
                  title="Agents moved to a different group for this month"
                >
                  <span style={{ fontWeight: isActive ? 'bold' : '600' }}>
                    Exceptions
                  </span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>
                    {count} agent{count !== 1 ? 's' : ''}
                  </span>
                </button>
              );
            })()}

            {/* Exclusions Tab */}
            {(() => {
              const isActive = activeGroupFilter === 'exclusions';
              const count = allotmentData.filter(item => item.hasOverride && (item.overrideType === 'exclude' || item.overrideType === 'exclude_all_future')).length;
              
              return (
                <button
                  key="exclusions"
                  onClick={() => setActiveGroupFilter('exclusions')}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: isActive ? '3px solid #dc2626' : '3px solid transparent',
                    backgroundColor: isActive ? '#f8f9fa' : 'transparent',
                    color: isActive ? '#dc2626' : '#6c757d',
                    fontWeight: isActive ? 'bold' : 'normal',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderRadius: '4px 4px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#f1f3f5';
                      e.currentTarget.style.color = '#495057';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#6c757d';
                    }
                  }}
                  title="Agents excluded from this month or all future allotments"
                >
                  <span style={{ fontWeight: isActive ? 'bold' : '600' }}>
                    Exclusions
                  </span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>
                    {count} agent{count !== 1 ? 's' : ''}
                  </span>
                </button>
              );
            })()}
          </div>
        </div>
        <DataTable
          columns={(() => {
            if (activeGroupFilter === '6k-reup') return lowAlpColumns;
            if (activeGroupFilter === 'f90') return highAlpColumns; // F90 uses high ALP columns
            return highAlpColumns;
          })()}
          data={filteredHighAlpData}
          defaultSortBy={(() => {
            if (activeGroupFilter === '6k-reup') return 'alp';
            if (activeGroupFilter === 'f90') return 'agent';
            return 'allotmentGroup';
          })()}
          defaultSortOrder={(() => {
            if (activeGroupFilter === '6k-reup') return 'desc';
            if (activeGroupFilter === 'f90') return 'asc';
            return 'asc';
          })()}
          showActionBar={true}
          rowClassNames={activeGroupFilter === '6k-reup' ? lowAlpRowClassNames : highAlpRowClassNames}
          selectedRows={hasElevatedPermissions ? selectedAgents : undefined}
          setSelectedRows={hasElevatedPermissions ? setSelectedAgents : undefined}
          enableRowContextMenu={hasElevatedPermissions}
          enableColumnFilters={true}
          tableId="allotment-table"
          getRowContextMenuOptions={(row) => {
            return [
              {
                label: 'Exclude This Month',
                onClick: () => handleAddOverride(row.agentId, 'exclude'),
                disabled: row.overrideType === 'exclude'
              },
              {
                label: 'Move to Category',
                submenu: [
                  {
                    label: 'Category 1',
                    onClick: () => handleAddOverride(row.agentId, 'move_to_group', '1')
                  },
                  {
                    label: 'Category 2',
                    onClick: () => handleAddOverride(row.agentId, 'move_to_group', '2')
                  },
                  {
                    label: 'Category 3',
                    onClick: () => handleAddOverride(row.agentId, 'move_to_group', '3')
                  },
                  {
                    label: 'Category 4',
                    onClick: () => handleAddOverride(row.agentId, 'move_to_group', '4')
                  },
                  {
                    label: 'Category 5',
                    onClick: () => handleAddOverride(row.agentId, 'move_to_group', '5')
                  },
                  ...customGroups.filter(g => g.target_month === (selectedMonth || apiResponseData?.targetMonth)).map(customGroup => ({
                    label: customGroup.groupName,
                    onClick: () => handleAddOverride(row.agentId, 'move_to_group', `custom-${customGroup.id}`)
                  }))
                ]
              },
              {
                label: 'Exclude All Future',
                onClick: () => {
                  const confirmed = window.confirm(`Are you sure you want to exclude ${row.agent} from ALL future allotments?`);
                  if (confirmed) {
                    handleAddOverride(row.agentId, 'exclude_all_future');
                  }
                },
                disabled: row.overrideType === 'exclude_all_future',
                className: 'danger-action'
              },
              ...(row.hasOverride ? [{
                label: 'Remove Override',
                onClick: () => handleRemoveOverride(row.agentId),
                className: 'remove-action'
              }] : [])
            ];
          }}
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
            saveChanges: false,
            cancelChanges: false
          }}
          onRefresh={fetchAllotmentData}
          onExport={() => {
            // Check if we're in 6k-reup tab
            if (activeGroupFilter === '6k-reup') {
              // Export low ALP data
              const csvData = filteredHighAlpData.map(row => {
                const alp = row.alp || 0;
                const alpGap = Math.max(0, 3000 - alp);
                const neededFor6k = Math.max(0, 6000 - alp);
                
                return {
                  'MGA': row.mga,
                  'Agent': row.agent,
                  'VIP Count': row.vipCount || 0,
                  'VIP ALP': row.vipAlp || 0,
                  'VIP Names': row.vipNames || '',
                  'Monthly ALP': row.monthlyAlp || 0,
                  'Final ALP': alp,
                  'Gap to 3k': alpGap,
                  'Needed for 6k Rule': neededFor6k,
                  'Retention': row.retention,
                  'Area Request': row.areaRequest,
                  'Previous Month Refs': row.prevMonthRefs,
                  'Notes': alp >= 6000 ? 'Eligible for 6k Rule (Category 5)' : (alp >= 3000 ? 'Above threshold' : `Need $${neededFor6k} more for 6k rule`)
                };
              });
              
              const csvContent = [
                Object.keys(csvData[0]).join(','),
                ...csvData.map(row => Object.values(row).join(','))
              ].join('\n');
              
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = '6k_reup_category_data.csv';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
              
              toast.success('6k Reup Category data exported successfully');
            } else {
              // Export high ALP data
              const csvData = filteredHighAlpData.map(row => {
                const groupDetails = getGroupDetails(row.allotmentGroup);
                const meetsRefs = (row.prevMonthRefs || 0) >= groupDetails.refs;
                const meetsAlp = (row.alp || 0) >= 3000;
                
                let status = 'No Allotment';
                if (meetsAlp && meetsRefs) {
                  status = 'Full Allotment';
                } else if (meetsAlp && !meetsRefs) {
                  status = '50% Leads (Missing Refs)';
                }
                
                return {
                  'Category': row.allotmentGroup,
                  'Leads Per Month': groupDetails.leads,
                  'Leads Per Drop': groupDetails.perDrop,
                  'Lead Types': groupDetails.leadTypes,
                  'Refs Required': groupDetails.refs,
                  'Refs Actual': row.prevMonthRefs,
                  'Meets Ref Requirement': meetsRefs ? 'Yes' : 'No',
                  'VIP Count': row.vipCount || 0,
                  'VIP ALP': row.vipAlp || 0,
                  'VIP Names': row.vipNames || '',
                  'Monthly ALP': row.monthlyAlp || 0,
                  'MGA': row.mga,
                  'Agent': row.agent,
                  'Retention': row.retention,
                  'Area Request': row.areaRequest,
                  'Final ALP': row.alp,
                  'Status': status
                };
              });
              
              const csvContent = [
                Object.keys(csvData[0]).join(','),
                ...csvData.map(row => Object.values(row).join(','))
              ].join('\n');
              
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'agent_allotment_data.csv';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
              
              toast.success('Allotment data exported successfully');
            }
          }}
          entityName="agent-allotment"
        />
      </div>

      {/* Custom Group Modal */}
      {canManageCustomGroups && (
        <CustomGroupModal
          isOpen={showCustomGroupModal}
          onClose={() => {
            setShowCustomGroupModal(false);
            setEditingCustomGroup(null);
          }}
          onSave={() => {
            fetchAllotmentData();
          }}
          groupToEdit={editingCustomGroup}
          targetMonth={apiResponseData?.targetMonth ? apiResponseData.targetMonth.replace('/', '-').split('/').reverse().join('-') : ''}
        />
      )}

      {/* Allotment Settings Modal */}
      {hasElevatedPermissions && (
        <AllotmentSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onSave={() => {
            fetchAllotmentData();
          }}
          targetMonth={selectedMonth}
        />
      )}

      {/* Lead Drop Dates Modal */}
      {hasElevatedPermissions && (
        <LeadDropDatesModal
          isOpen={showDropDatesModal}
          onClose={() => setShowDropDatesModal(false)}
          targetMonth={selectedMonth}
        />
      )}
    </div>
  );
};

export default AllotmentTab;
