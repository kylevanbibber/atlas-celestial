import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import { useUserHierarchy } from '../../../hooks/useUserHierarchy';
import api from '../../../api';
import DataTable from '../../utils/DataTable';
import { toast } from 'react-hot-toast';
import './AllotmentTab.css';

const AllotmentTab = () => {
  const { user } = useContext(AuthContext);
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const [loading, setLoading] = useState(true);
  const [allotmentData, setAllotmentData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiResponseData, setApiResponseData] = useState(null);
  const [activeGroupFilter, setActiveGroupFilter] = useState('all'); // 'all', '1', '2', '3', '4', '5'

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

  // Get allowed IDs from cached hierarchy data
  const allowedIds = useMemo(() => {
    if (hasElevatedPermissions) return []; // Elevated users see all data
    if (isAgtUser) return [user?.userId || user?.id].filter(Boolean); // AGT users only see themselves
    return getHierarchyForComponent('ids');
  }, [hasElevatedPermissions, isAgtUser, getHierarchyForComponent, user?.userId, user?.id]);
  
  const allowedIdsSet = useMemo(() => new Set(allowedIds.map(id => String(id))), [allowedIds]);

  const fetchAllotmentData = useCallback(async () => {
    setLoading(true);
    console.log('🚀 [Frontend] Starting allotment data fetch...');
    
    try {
      // Use the new PnP allotment endpoint
      console.log('📡 [Frontend] Calling /pnp/allotment API...');
      const response = await api.get('/pnp/allotment');
      
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
      console.log(`📊 [Frontend] Raw data received: ${data.length} records`);
      
      // Handle separate RefValidation and Licensed States data
      const refValidationData = response.data?.refValidationData || [];
      const licensedStatesData = response.data?.licensedStatesData || [];
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
        toast(`No allotment data found for ${response.data?.targetMonth || 'target period'}`, {
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
  }, [hasElevatedPermissions, isAgtUser, allowedIdsSet, allowedIds]);

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

  useEffect(() => {
    console.log('🎯 [Frontend] AllotmentTab useEffect triggered:', {
      hasElevatedPermissions,
      isAgtUser,
      hasHierarchyData: !!hierarchyData,
      allowedIdsLength: allowedIds.length,
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
    } else {
      console.log('⏳ [Frontend] Waiting for hierarchy data...');
    }
  }, [fetchAllotmentData, hasElevatedPermissions, isAgtUser, hierarchyData, allowedIds, user]);

  // Split data into high ALP (>=3000) with allotment groups and low ALP (<3000)
  const { highAlpData, lowAlpData } = useMemo(() => {
    console.log(`🔍 [Frontend] Splitting data by ALP threshold (3000):`, {
      totalRecords: allotmentData.length
    });

    // Split data by ALP >= 3000 vs < 3000
    const highAlpAgents = allotmentData.filter(record => (record.alp || 0) >= 3000);
    const lowAlpAgents = allotmentData.filter(record => (record.alp || 0) < 3000);
    
    console.log(`📊 [Frontend] ALP split: ${highAlpAgents.length} high ALP (>=3000), ${lowAlpAgents.length} low ALP (<3000)`);
    
    // Sort high ALP agents by ALP descending for even group distribution
    highAlpAgents.sort((a, b) => (b.alp || 0) - (a.alp || 0));
    
    // Divide high ALP agents into 5 allotment groups evenly
    const groupSize = Math.ceil(highAlpAgents.length / 5);
    const highAlpWithGroups = highAlpAgents.map((agent, index) => ({
      ...agent,
      allotmentGroup: Math.floor(index / groupSize) + 1 // Groups 1-5
    }));
    
    console.log(`🔢 [Frontend] Allotment groups: ${groupSize} agents per group (5 groups total)`);
    console.log(`🔍 [Frontend] Group distribution:`, 
      Array.from({length: 5}, (_, i) => ({
        group: i + 1,
        count: highAlpWithGroups.filter(a => a.allotmentGroup === i + 1).length
      }))
    );

    return {
      highAlpData: highAlpWithGroups,
      lowAlpData: lowAlpAgents
    };
  }, [allotmentData]);

  // Filter high ALP data by both search query and group filter
  const filteredHighAlpData = useMemo(() => {
    let filtered = highAlpData;
    
    // Filter by group first
    if (activeGroupFilter !== 'all') {
      const groupNumber = parseInt(activeGroupFilter);
      filtered = highAlpData.filter(item => item.allotmentGroup === groupNumber);
      console.log(`🔍 [Frontend] Group filter: ${activeGroupFilter} → ${filtered.length} agents`);
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
  }, [highAlpData, searchQuery, activeGroupFilter]);

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

  // Calculate row class names for inactive managers (grey styling)
  const highAlpRowClassNames = useMemo(() => {
    const classNames = {};
    filteredHighAlpData.forEach(row => {
      if (row.managerActive === 'n') {
        classNames[row.id] = 'inactive-manager-row';
      }
    });
    console.log('🎨 [Frontend] High ALP inactive manager rows:', Object.keys(classNames).length);
    return classNames;
  }, [filteredHighAlpData]);

  const lowAlpRowClassNames = useMemo(() => {
    const classNames = {};
    filteredLowAlpData.forEach(row => {
      if (row.managerActive === 'n') {
        classNames[row.id] = 'inactive-manager-row';
      }
    });
    console.log('🎨 [Frontend] Low ALP inactive manager rows:', Object.keys(classNames).length);
    return classNames;
  }, [filteredLowAlpData]);

  // Columns for high ALP table (includes Allotment Group)
  const highAlpColumns = useMemo(() => [
    {
      Header: 'Group',
      accessor: 'allotmentGroup',
      Cell: ({ value }) => value || '-',
      sortType: 'basic',
      width: 80
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
    },
    {
      Header: 'Retention',
      accessor: 'retention',
      Cell: ({ value }) => {
        if (!value || value === 'N/A') return 'N/A';
        
        // Handle both regular percentages and n2g values
        const isN2G = value.includes('n2g');
        const percentage = parseFloat(value.replace('%', '').replace('n2g', ''));
        
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
          <span style={{
            color,
            backgroundColor,
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: '500'
          }} title={isN2G ? 'Based on YTD percentage (n2g)' : 'Based on 4-month rate'}>
            {value}
          </span>
        );
      }
    },
    {
      Header: 'Lead Type Pref',
      accessor: 'leadTypePref',
      Cell: ({ value }) => (
        <span style={{ color: '#666', fontStyle: 'italic' }}>
          {value === 'TBD' ? 'To Be Determined' : (value || 'N/A')}
        </span>
      )
    },
    {
      Header: 'Area Request (Licensed States)',
      accessor: 'areaRequest',
      Cell: ({ value }) => value || 'N/A'
    },
    {
      Header: 'Prev Month Group',
      accessor: 'prevMonthGroup',
      Cell: ({ value }) => {
        if (value === null || value === undefined) return 'N/A';
        
        // Style based on performance
        const num = parseInt(value);
        let color = '#000';
        let backgroundColor = 'transparent';
        
        if (num >= 20) {
          color = '#155724';
          backgroundColor = '#d4edda';
        } else if (num >= 15) {
          color = '#856404';
          backgroundColor = '#fff3cd';
        } else if (num < 15) {
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
            {value}
          </span>
        );
      }
    },
    {
      Header: 'Prev Month Refs',
      accessor: 'prevMonthRefs',
      Cell: ({ value }) => {
        if (value === null || value === undefined) return 'N/A';
        
        // Style based on performance
        const num = parseInt(value);
        let color = '#000';
        let backgroundColor = 'transparent';
        
        if (num >= 10) {
          color = '#155724';
          backgroundColor = '#d4edda';
        } else if (num >= 6) {
          color = '#856404';
          backgroundColor = '#fff3cd';
        } else if (num < 6) {
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
            {value}
          </span>
        );
      }
    },
    {
      Header: 'ALP',
      accessor: 'alp',
      Cell: ({ value }) => {
        if (value === null || value === undefined) return 'N/A';
        
        // Format as currency
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);
        
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
            fontWeight: '500'
          }}>
            {formatted}
          </span>
        );
      }
    }
  ], []);

  // Columns for low ALP table (no Allotment Group)
  const lowAlpColumns = useMemo(() => [
    {
      Header: 'MGA',
      accessor: 'mga',
      Cell: ({ value }) => value || 'N/A'
    },
    {
      Header: 'Agent',
      accessor: 'agent',
      Cell: ({ value }) => value || 'N/A'
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
          tooltip = 'New to Group data';
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
      Cell: ({ value }) => value || 'N/A'
    },
    {
      Header: 'Prev Month Group',
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
      Header: 'ALP',
      accessor: 'alp',
      Cell: ({ value }) => {
        const num = Number(value) || 0;
        const formatted = num.toLocaleString();
        
        let bgColor = '#fff';
        let textColor = '#000';
        
        if (num >= 3000) {
          bgColor = '#d4edda'; // Light green
          textColor = '#155724';
        } else if (num >= 1500) {
          bgColor = '#fff3cd'; // Light yellow
          textColor = '#856404';
        } else if (num < 0) {
          bgColor = '#f8d7da'; // Light red
          textColor = '#721c24';
        }
        
        return (
          <span 
            style={{ 
              backgroundColor: bgColor,
              color: textColor,
              padding: '2px 6px', 
              borderRadius: '3px',
              fontSize: '13px',
              fontWeight: 'bold'
            }}
          >
            {formatted}
          </span>
        );
      }
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
      {/* Search Bar */}
      <div className="search-bar mb-4" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Search by MGA, Agent, Lead Type, or Area..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: 360 }}
        />
        <div style={{ fontSize: '12px', color: '#666' }}>
          Data from Monthly_ALP ({apiResponseData?.targetMonth || 'N/A'}), Prev Groups ({apiResponseData?.prevMonth || 'N/A'}), RefValidation ({apiResponseData?.refValidationData?.length || 0} refs), Licensed States ({apiResponseData?.licensedStatesData?.length || 0} licenses) • Total: {allotmentData.length} records
        </div>
      </div>

      {/* High ALP Table (>= 3000 with Allotment Groups) */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ 
          marginBottom: '15px', 
          color: '#2c5aa0', 
          borderBottom: '2px solid #2c5aa0', 
          paddingBottom: '5px',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
         (ALP ≥ 3000) - {filteredHighAlpData.length} agents
          {activeGroupFilter !== 'all' && ` in Group ${activeGroupFilter}`}
        </h3>
        
        {/* Group Filter Tabs */}
        <div style={{ 
          marginBottom: '15px', 
          borderBottom: '1px solid #dee2e6',
          paddingBottom: '0px'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: '0',
            borderRadius: '0'
          }}>
            {['all', '1', '2', '3', '4', '5'].map(group => {
              const isActive = activeGroupFilter === group;
              const count = group === 'all' ? 
                highAlpData.length : 
                highAlpData.filter(item => item.allotmentGroup === parseInt(group)).length;
              
              return (
                <button
                  key={group}
                  onClick={() => setActiveGroupFilter(group)}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderBottom: isActive ? '3px solid #2c5aa0' : '3px solid transparent',
                    backgroundColor: isActive ? '#f8f9fa' : 'transparent',
                    color: isActive ? '#2c5aa0' : '#6c757d',
                    fontWeight: isActive ? 'bold' : 'normal',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderRadius: '4px 4px 0 0'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.target.style.backgroundColor = '#f1f3f5';
                      e.target.style.color = '#495057';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.target.style.backgroundColor = 'transparent';
                      e.target.style.color = '#6c757d';
                    }
                  }}
                >
                  {group === 'all' ? 'All' : `Group ${group}`} ({count})
                </button>
              );
            })}
          </div>
        </div>
        <DataTable
          columns={highAlpColumns}
          data={filteredHighAlpData}
          defaultSortBy="allotmentGroup"
          defaultSortOrder="asc"
          showActionBar={true}
          rowClassNames={highAlpRowClassNames}
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
            const csvData = filteredHighAlpData.map(row => ({
              'Group': row.allotmentGroup,
              'MGA': row.mga,
              'Agent': row.agent,
              'Retention': row.retention,
              'Lead Type Preference': row.leadTypePref,
              'Area Request': row.areaRequest,
              'Previous Month Group': row.prevMonthGroup,
              'Previous Month Refs': row.prevMonthRefs,
              'ALP': row.alp
            }));
            
            const csvContent = [
              Object.keys(csvData[0]).join(','),
              ...csvData.map(row => Object.values(row).join(','))
            ].join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'high_alp_allotment_data.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            toast.success('High ALP allotment data exported successfully');
          }}
          entityName="high-alp-allotment"
        />
      </div>

      {/* Low ALP Table (< 3000) */}
      <div>
        <h3 style={{ 
          marginBottom: '15px', 
          color: '#6c757d', 
          borderBottom: '2px solid #6c757d', 
          paddingBottom: '5px',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          (ALP &lt; 3000) - {filteredLowAlpData.length} agents
        </h3>
        <DataTable
          columns={lowAlpColumns}
          data={filteredLowAlpData}
          defaultSortBy="alp"
          defaultSortOrder="desc"
          showActionBar={true}
          rowClassNames={lowAlpRowClassNames}
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
            const csvData = filteredLowAlpData.map(row => ({
              'MGA': row.mga,
              'Agent': row.agent,
              'Retention': row.retention,
              'Lead Type Preference': row.leadTypePref,
              'Area Request': row.areaRequest,
              'Previous Month Group': row.prevMonthGroup,
              'Previous Month Refs': row.prevMonthRefs,
              'ALP': row.alp
            }));
            
            const csvContent = [
              Object.keys(csvData[0]).join(','),
              ...csvData.map(row => Object.values(row).join(','))
            ].join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'low_alp_allotment_data.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            toast.success('Development focus data exported successfully');
          }}
          entityName="low-alp-allotment"
        />
      </div>
      
      {loading && (
        <div style={{ marginTop: 12 }}>
          Loading allotment data...
        </div>
      )}
    </div>
  );
};

export default AllotmentTab;
