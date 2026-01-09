import React, { useState, useEffect, useCallback } from 'react';
import { FiTarget, FiTrendingUp, FiEdit3, FiSave, FiRefreshCcw, FiChevronLeft, FiChevronRight, FiCalendar, FiSettings, FiBarChart2, FiGrid, FiX, FiUserMinus } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import Card from '../utils/Card';
import ActionBar from '../utils/ActionBar';
import DataTable from '../utils/DataTable';
import { OverlaySpinner } from '../utils/LoadingSpinner';
import './ProductionGoals.css';

const ProductionGoals = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [goalData, setGoalData] = useState(null);
  const [mgaGoalData, setMgaGoalData] = useState(null);
  const [rgaGoalData, setRgaGoalData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewScope, setViewScope] = useState('personal'); // 'personal' | 'team' | 'agency'
  
  // Goal setting state
  const [monthlyAlpGoal, setMonthlyAlpGoal] = useState('');
  const [mgaGoal, setMgaGoal] = useState('');
  const [rgaGoal, setRgaGoal] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [workingDays, setWorkingDays] = useState([]);
  const [rateSource, setRateSource] = useState('agency'); // 'agency' or 'custom'
  
  // Agency conversion rates (hardcoded)
  const agencyRates = {
    callsToAppts: 35,
    apptsToSits: 0.25,
    sitsToSales: 0.33,
    salesToAlp: 1200
  };
  
  // Custom rates state
  const [customRates, setCustomRates] = useState({
    callsToAppts: 35,
    apptsToSits: 0.25,
    sitsToSales: 0.33,
    salesToAlp: 1200
  });
  
  const [breakdown, setBreakdown] = useState(null);

  // Daily activity data keyed by reportDate (yyyy-mm-dd)
  const [activityByDate, setActivityByDate] = useState({});

  // View mode for smaller screens
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'weekly'
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showWeeklyToggle, setShowWeeklyToggle] = useState(window.innerWidth <= 1000);

  // Track if user has manually cleared working days
  const [userHasClearedDays, setUserHasClearedDays] = useState(false);

  // Team goals state
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamRows, setTeamRows] = useState([]);
  const [teamRowsAll, setTeamRowsAll] = useState([]);
  const [inactiveTeamRows, setInactiveTeamRows] = useState([]);
  const [showInactiveAgents, setShowInactiveAgents] = useState(false);
  const [mgaOnly, setMgaOnly] = useState(false);
  
  // Agency goals state (for SGA users)
  const [agencyLoading, setAgencyLoading] = useState(false);
  const [agencyRows, setAgencyRows] = useState([]);
  const [agencyRowsAll, setAgencyRowsAll] = useState([]);
  const [inactiveAgencyRows, setInactiveAgencyRows] = useState([]);
  const [showInactiveAgencyAgents, setShowInactiveAgencyAgents] = useState(false);
  
  // Date override state
  const [dateOverride, setDateOverride] = useState(null);



  // Function to load date override for the selected month/year
  const loadDateOverride = async () => {
    try {
      const response = await api.get(`/date-overrides/${selectedYear}/${selectedMonth}`);
      setDateOverride(response.data);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        // No date override found, use default dates
        setDateOverride(null);
        return null;
      } else {
        console.error('❌ [loadDateOverride] Error loading date override:', error);
        setDateOverride(null);
        return null;
      }
    }
  };

  // Function to load goal data for all goal types
  const loadGoalData = async () => {
    if (!user?.userId) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Load date override first
      await loadDateOverride();
      
      // Load all three goal types in parallel
      const [personalResponse, mgaResponse, rgaResponse] = await Promise.all([
        api.get(`/goals/${user.userId}/${selectedYear}/${selectedMonth}?goalType=personal`).catch(() => null),
        api.get(`/goals/${user.userId}/${selectedYear}/${selectedMonth}?goalType=mga`).catch(() => null),
        api.get(`/goals/${user.userId}/${selectedYear}/${selectedMonth}?goalType=rga`).catch(() => null)
      ]);
      
      // Handle personal goal
      if (personalResponse?.data) {
        setGoalData(personalResponse.data);
        setMonthlyAlpGoal(personalResponse.data.monthlyAlpGoal || '');
        const loadedWorkingDays = personalResponse.data.workingDays || [];
        setWorkingDays(loadedWorkingDays);
        // If loaded goal has no working days, assume user intentionally cleared them
        setUserHasClearedDays(loadedWorkingDays.length === 0);
        setRateSource(personalResponse.data.rateSource || 'agency');
        if (personalResponse.data.customRates) {
          setCustomRates(personalResponse.data.customRates);
        }
      } else {
        setGoalData(null);
        setMonthlyAlpGoal('');
        setWorkingDays([]);
        setRateSource('agency');
        // No existing goal data, allow default working days to be set
        setUserHasClearedDays(false);
      }
      
      // Handle MGA goal
      if (mgaResponse?.data) {
        setMgaGoalData(mgaResponse.data);
        setMgaGoal(mgaResponse.data.monthlyAlpGoal || '');
      } else {
        setMgaGoalData(null);
        setMgaGoal('');
      }
      
      // Handle RGA goal
      if (rgaResponse?.data) {
        setRgaGoalData(rgaResponse.data);
        setRgaGoal(rgaResponse.data.monthlyAlpGoal || '');
      } else {
        setRgaGoalData(null);
        setRgaGoal('');
      }
      
      // Load team ALP data to calculate actual progress for team goals
      const hasTeamGoals = mgaResponse?.data || rgaResponse?.data;
      const isManager = isManagerRole();
      
      if (hasTeamGoals && isManager) {
        await loadTeamALPProgress();
      } else {
      }
      
    } catch (error) {
      console.error('❌ [loadGoalData] Error loading goal data:', error);
      console.error('❌ [loadGoalData] Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      
      // Set empty state for all goals
      setGoalData(null);
      setMgaGoalData(null);
      setRgaGoalData(null);
      setMonthlyAlpGoal('');
      setMgaGoal('');
      setRgaGoal('');
      setWorkingDays([]);
      setRateSource('agency');
      // On error, allow default working days to be set
      setUserHasClearedDays(false);
    } finally {
      setLoading(false);
    }
  };

  // Load team ALP data and calculate progress for MGA and RGA goals
  const loadTeamALPProgress = async () => {
    if (!user?.userId) return;
    
    try {
      
      // Get team hierarchy data
      const hierarchyResponse = await api.post('/auth/searchByUserIdLite', { 
        userId: user.userId,
        includeInactive: false // Only active users for ALP calculation
      });
      
      const allHierUsers = (hierarchyResponse.data?.data || []);
      
      if (allHierUsers.length === 0) {
        return;
      }
      
      // Get ALP data for all team members in one efficient call
      
      let alpDataMap = {};
      try {
        const userIds = allHierUsers.map(member => member.id);
        const alpResponse = await api.post('/goals/team-alp', {
          userIds: userIds,
          year: selectedYear,
          month: selectedMonth
        });
        
        alpDataMap = alpResponse.data || {};
        
        // Log summary
        const totalTeamALP = Object.values(alpDataMap).reduce((sum, data) => sum + (data.totalAlp || 0), 0);
        
      } catch (error) {
        console.error('❌ Error loading bulk ALP data:', error);
        // Continue with empty data rather than failing completely
        alpDataMap = {};
      }
      
      // Combine hierarchy data with ALP data
      let teamALPData = allHierUsers.map(member => ({
        userId: member.id,
        name: member.lagnname,
        mgaName: member.mgaName,
        role: member.role,
        totalAlp: alpDataMap[member.id]?.totalAlp || 0
      }));
      
      // Filter for SA and GA users to only include directly coded team members
      const userRole = String(user?.clname || '').toUpperCase();
      const userLagnname = user?.lagnname || '';
      
      if (userRole === 'SA') {
        // For SA users: only include team members where SA field equals user's lagnname
        teamALPData = teamALPData.filter(member => {
          const hierarchyData = allHierUsers.find(h => h.id === member.userId);
          return hierarchyData?.sa === userLagnname || member.name === userLagnname;
        });
      } else if (userRole === 'GA') {
        // For GA users: only include team members where GA field equals user's lagnname  
        teamALPData = teamALPData.filter(member => {
          const hierarchyData = allHierUsers.find(h => h.id === member.userId);
          return hierarchyData?.ga === userLagnname || member.name === userLagnname;
        });
      }
      
      // Filter for MGA-level users (same logic as MGA Only toggle)
      let mgaLevelUsers = teamALPData;
      
      if (userRole === 'RGA') {
        // For RGA users, MGA level = users where mgaName matches user's lagnname
        mgaLevelUsers = teamALPData.filter(member => 
          (member.mgaName && member.mgaName === (user?.lagnname || '')) || 
          member.name === (user?.lagnname || '')
        );
      }
      
      // Calculate aggregated ALP
      const mgaTeamALP = mgaLevelUsers.reduce((sum, member) => sum + (member.totalAlp || 0), 0);
      const rgaTeamALP = teamALPData.reduce((sum, member) => sum + (member.totalAlp || 0), 0);
      
      
      // Update goal data with actual team progress
      
      setMgaGoalData(prevData => prevData ? {
        ...prevData,
        reported: mgaTeamALP,
        teamMemberCount: mgaLevelUsers.length
      } : {
        // Create goal data object even if no goal is set, to store reported values
        monthlyAlpGoal: null,
        reported: mgaTeamALP,
        teamMemberCount: mgaLevelUsers.length,
        goalType: 'mga'
      });
      
      setRgaGoalData(prevData => prevData ? {
        ...prevData,
        reported: rgaTeamALP,
        teamMemberCount: teamALPData.length
      } : {
        // Create goal data object even if no goal is set, to store reported values
        monthlyAlpGoal: null,
        reported: rgaTeamALP,
        teamMemberCount: teamALPData.length,
        goalType: 'rga'
      });
      
    } catch (error) {
      console.error('❌ Error loading team ALP progress:', error);
    }
  };

  // Get current rates based on rate source
  const getCurrentRates = () => {
    return rateSource === 'custom' ? customRates : agencyRates;
  };

  // Generate working days for the month (with date override support)
  const generateWorkingDays = () => {
    const workingDaysList = [];
    let startDate, endDate;
    
    if (dateOverride) {
      // Use date override boundaries
      startDate = new Date(dateOverride.start_date + 'T00:00:00');
      endDate = new Date(dateOverride.end_date + 'T00:00:00');
    } else {
      // Use default month boundaries
      startDate = new Date(selectedYear, selectedMonth - 1, 1);
      endDate = new Date(selectedYear, selectedMonth, 0);
    }
    
    // Iterate through each day in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      
      // Monday to Friday (1-5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDaysList.push(currentDate.toISOString().split('T')[0]);
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDaysList;
  };

  // Check if selected month/year is in the past
  const isSelectedMonthInPast = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
    
    if (selectedYear < currentYear) {
      return true;
    } else if (selectedYear === currentYear && selectedMonth < currentMonth) {
      return true;
    }
    return false;
  };

  const isPastMonth = isSelectedMonthInPast();

  // Load data when component mounts or month/year changes
  useEffect(() => {
    if (user?.userId && selectedYear && selectedMonth) {
      loadGoalData();
      // Reset user cleared flag when changing months to allow default working days for new months
      setUserHasClearedDays(false);
    }
  }, [user?.userId, selectedYear, selectedMonth]);

  // Load team ALP data when switching to team view (avoid infinite loop)
  useEffect(() => {
    if (viewScope === 'team' && isManagerRole() && (mgaGoalData || rgaGoalData)) {
      loadTeamALPProgress();
    }
  }, [viewScope]); // Only trigger on viewScope change, not goal data changes

  // Load agency hierarchy and goals when in agency scope (SGA users)
  useEffect(() => {
    const loadAgencyGoals = async () => {
      if (viewScope !== 'agency') return;
      if (!user?.userId || !selectedYear || !selectedMonth) {
        setAgencyRows([]);
        return;
      }
      
      // Only allow SGA users to access agency view
      const userRole = String(user?.clname || '').toUpperCase();
      if (userRole !== 'SGA') {
        setAgencyRows([]);
        return;
      }
      
      try {
        setAgencyLoading(true);
        
        // For SGA users, fetch ALL users from the database (full agency)
        // /users/active returns all Active='y' users with managerActive, sa, ga, mga, rga fields
        const allUsersResponse = await api.get('/users/active');
        const allHierUsers = allUsersResponse.data || [];
        
        console.log(`📊 [Agency Goals] Loaded ${allHierUsers.length} total users for SGA agency view`);
        
        const byUserId = new Map(allHierUsers.map(u => [u.id, { ...u, managerActive: u.managerActive || 'y' }]));
        const members = allHierUsers.map(u => ({ 
          id: u.id, 
          name: u.lagnname, 
          role: u.clname,
          managerActive: u.managerActive || 'y'
        }));
        const byId = new Map(members.map(m => [m.id, m]));
        if (!byId.has(user.userId)) {
          byId.set(user.userId, { 
            id: user.userId, 
            name: user.lagnname || '', 
            role: user.clname || '',
            managerActive: 'y'
          });
        }
        const finalMembers = Array.from(byId.values());

        // Batch fetch personal goals for the month
        const payload = { 
          userIds: finalMembers.map(m => m.id), 
          year: selectedYear, 
          month: selectedMonth,
          goalType: 'personal'
        };
        const batch = await api.post('/goals/batch', payload);
        const goalsByUserId = batch.data?.goalsByUserId || {};

        // Build hierarchy order (RGA > MGA > GA > SA > AGT)
        const orderNames = buildHierarchyOrder(allHierUsers);
        const indexByName = new Map(orderNames.map((n, i) => [n, i]));

        // Load activity for the month and aggregate ALP by agent
        const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
        const monthEnd = new Date(selectedYear, selectedMonth, 0);
        const activityRes = await api.get('/dailyActivity/all');
        const allActivity = (activityRes.data?.data || []).map(a => ({
          ...a,
          reportDate: new Date(new Date(a.reportDate).getTime() + new Date(a.reportDate).getTimezoneOffset() * 60000),
          alp: (a.alp === null || a.alp === undefined || a.alp === '') ? 0 : (parseFloat(a.alp) || 0)
        }));
        const alpByName = new Map();
        allActivity.forEach(a => {
          const d = a.reportDate;
          if (d >= monthStart && d <= monthEnd) {
            const key = (a.agent || '').trim();
            if (!key) return;
            alpByName.set(key, (alpByName.get(key) || 0) + (a.alp || 0));
          }
        });

        const today = new Date();
        const isCurrentMonth = (today.getFullYear() === selectedYear) && ((today.getMonth() + 1) === selectedMonth);

        const rows = finalMembers.map(member => {
          const goalKey = `${member.id}_personal`;
          const goal = goalsByUserId[goalKey] || null;
          const monthlyGoal = goal?.monthlyAlpGoal ? parseFloat(goal.monthlyAlpGoal) : 0;
          const reportedAlp = alpByName.get(member.name) || 0;
          const remainingAlp = Math.max(0, (monthlyGoal || 0) - reportedAlp);
          const workingDaysArr = Array.isArray(goal?.workingDays) ? goal.workingDays : [];
          const workingDaysInMonth = workingDaysArr.filter(ds => {
            const d = new Date(ds + 'T00:00:00');
            return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
          });
          const workingDaysRemaining = isCurrentMonth
            ? workingDaysInMonth.filter(ds => new Date(ds + 'T00:00:00') >= new Date(new Date().toDateString())).length
            : workingDaysInMonth.length;

          const rates = (() => {
            if (goal?.rateSource === 'custom' && goal?.customRates) return goal.customRates;
            return agencyRates;
          })();

          let effectiveGoal = monthlyGoal;
          let effectiveDays = workingDaysInMonth.length || 1;
          if (isCurrentMonth && workingDaysRemaining > 0) {
            effectiveGoal = remainingAlp;
            effectiveDays = workingDaysRemaining;
          }
          const requiredSales = Math.ceil((effectiveGoal || 0) / (rates.salesToAlp || 1200));
          const requiredSits = Math.ceil(requiredSales / (rates.sitsToSales || 0.33));
          const requiredAppts = Math.ceil(requiredSits / (rates.apptsToSits || 0.25));
          const requiredCalls = Math.ceil(requiredAppts * (rates.callsToAppts || 35));
          const dailyNeeded = {
            alp: Math.round((effectiveGoal || 0) / effectiveDays),
            sales: Math.ceil(requiredSales / effectiveDays),
            sits: Math.ceil(requiredSits / effectiveDays),
            appts: Math.ceil(requiredAppts / effectiveDays),
            calls: Math.ceil(requiredCalls / effectiveDays)
          };
          return {
            id: member.id,
            role: member.role || '',
            name: member.name || '',
            mgaName: (byUserId.get(member.id)?.mga) || '',
            rgaName: (byUserId.get(member.id)?.rga) || '',
            managerActive: member.managerActive || 'y',
            monthlyAlpGoal: monthlyGoal || '',
            reportedAlp,
            remainingAlp,
            workingDaysCount: workingDaysInMonth.length,
            dailyCallsNeeded: dailyNeeded.calls,
            dailyApptsNeeded: dailyNeeded.appts,
            dailySitsNeeded: dailyNeeded.sits,
            dailySalesNeeded: dailyNeeded.sales,
            dailyAlpNeeded: dailyNeeded.alp,
            rateSource: goal?.rateSource ? (goal.rateSource === 'custom' ? 'Custom' : 'Agency') : ''
          };
        })
        .sort((a, b) => {
          const ia = indexByName.has(a.name) ? indexByName.get(a.name) : Number.MAX_SAFE_INTEGER;
          const ib = indexByName.has(b.name) ? indexByName.get(b.name) : Number.MAX_SAFE_INTEGER;
          if (ia !== ib) return ia - ib;
          const order = { RGA: 0, MGA: 1, GA: 2, SA: 3, AGT: 4 };
          const ra = order[(a.role || '').toUpperCase()] ?? 99;
          const rb = order[(b.role || '').toUpperCase()] ?? 99;
          if (ra !== rb) return ra - rb;
          return a.name.localeCompare(b.name);
        });
        
        // Separate active and inactive members
        let activeRows = rows.filter(r => r.managerActive === 'y');
        let inactiveRows = rows.filter(r => r.managerActive === 'n');
        
        setInactiveAgencyRows(inactiveRows);
        
        // Build combined table data with inactive agents integrated
        const buildCombinedAgencyData = (filteredActiveRows) => {
          const combinedRows = [...filteredActiveRows];
          
          if (inactiveRows.length > 0) {
            combinedRows.push({
              id: 'inactive-agents-header',
              isInactiveHeader: true,
              name: `Inactive Agents (${inactiveRows.length})`,
              inactiveCount: inactiveRows.length,
              monthlyAlpGoal: 0,
              reportedAlp: 0,
              remainingAlp: 0,
              workingDaysCount: 0,
              dailyCallsNeeded: 0,
              dailyApptsNeeded: 0,
              dailySitsNeeded: 0,
              dailySalesNeeded: 0,
              dailyAlpNeeded: 0,
              rateSource: '',
              role: ''
            });
            
            if (showInactiveAgencyAgents) {
              inactiveRows.forEach(inactiveRow => {
                combinedRows.push({
                  ...inactiveRow,
                  isInactiveAgent: true
                });
              });
            }
          }
          
          return combinedRows;
        };
        
        setAgencyRowsAll(activeRows);
        const combinedData = buildCombinedAgencyData(activeRows);
        setAgencyRows(combinedData);
      } catch (e) {
        console.error('Error loading agency goals:', e);
        setAgencyRows([]);
        setAgencyRowsAll([]);
        setInactiveAgencyRows([]);
      } finally {
        setAgencyLoading(false);
      }
    };
    loadAgencyGoals();
  }, [viewScope, user?.userId, user?.lagnname, user?.clname, selectedYear, selectedMonth, showInactiveAgencyAgents]);

  // Load team hierarchy and goals when in team scope
  useEffect(() => {
    const loadTeamGoals = async () => {
      if (viewScope !== 'team') return;
      if (!user?.userId || !selectedYear || !selectedMonth) {
        setTeamRows([]);
        return;
      }
      try {
        setTeamLoading(true);
        // Fetch both active and inactive team members
        const hier = await api.post('/auth/searchByUserIdLite', { 
          userId: user.userId,
          includeInactive: true // Include inactive managers to show in the collapsed section
        });
        const allHierUsers = (hier.data?.data || []);
        
        const byUserId = new Map(allHierUsers.map(u => [u.id, { ...u, managerActive: u.managerActive || 'y' }]));
        const members = allHierUsers.map(u => ({ 
          id: u.id, 
          name: u.lagnname, 
          role: u.clname,
          managerActive: u.managerActive || 'y'
        }));
        const byId = new Map(members.map(m => [m.id, m]));
        if (!byId.has(user.userId)) {
          byId.set(user.userId, { 
            id: user.userId, 
            name: user.lagnname || '', 
            role: user.clname || '',
            managerActive: 'y' // Current user is presumably active
          });
        }
        const finalMembers = Array.from(byId.values());

        // Batch fetch personal goals for the month
        const payload = { 
          userIds: finalMembers.map(m => m.id), 
          year: selectedYear, 
          month: selectedMonth,
          goalType: 'personal'  // Only fetch personal goals for team view
        };
        const batch = await api.post('/goals/batch', payload);
        const goalsByUserId = batch.data?.goalsByUserId || {};

        // Build a name->index map from hierarchy order
        // For RGA users, use custom sorting that groups MGA teams properly
        const userRole = String(user?.clname || '').toUpperCase();
        const orderNames = userRole === 'RGA' 
          ? buildRGAHierarchyOrder(allHierUsers, user?.lagnname || '')
          : buildHierarchyOrder(allHierUsers);
        const indexByName = new Map(orderNames.map((n, i) => [n, i]));

        // Load activity for the month and aggregate ALP by agent
        const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
        const monthEnd = new Date(selectedYear, selectedMonth, 0);
        const activityRes = await api.get('/dailyActivity/all');
        const allActivity = (activityRes.data?.data || []).map(a => ({
          ...a,
          reportDate: new Date(new Date(a.reportDate).getTime() + new Date(a.reportDate).getTimezoneOffset() * 60000),
          alp: (a.alp === null || a.alp === undefined || a.alp === '') ? 0 : (parseFloat(a.alp) || 0)
        }));
        const alpByName = new Map();
        allActivity.forEach(a => {
          const d = a.reportDate;
          if (d >= monthStart && d <= monthEnd) {
            const key = (a.agent || '').trim();
            if (!key) return;
            alpByName.set(key, (alpByName.get(key) || 0) + (a.alp || 0));
          }
        });

        const today = new Date();
        const isCurrentMonth = (today.getFullYear() === selectedYear) && ((today.getMonth() + 1) === selectedMonth);

        const rows = finalMembers.map(member => {
          // Access goal with the correct key format: "userId_goalType"
          const goalKey = `${member.id}_personal`;
          const goal = goalsByUserId[goalKey] || null;
          const monthlyGoal = goal?.monthlyAlpGoal ? parseFloat(goal.monthlyAlpGoal) : 0;
          const reportedAlp = alpByName.get(member.name) || 0;
          const remainingAlp = Math.max(0, (monthlyGoal || 0) - reportedAlp);
          const workingDaysArr = Array.isArray(goal?.workingDays) ? goal.workingDays : [];
          // Count working days in selected month
          const workingDaysInMonth = workingDaysArr.filter(ds => {
            const d = new Date(ds + 'T00:00:00');
            return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
          });
          // Remaining working days (only for current month)
          const workingDaysRemaining = isCurrentMonth
            ? workingDaysInMonth.filter(ds => new Date(ds + 'T00:00:00') >= new Date(new Date().toDateString())).length
            : workingDaysInMonth.length;

          // Determine rates
          const rates = (() => {
            if (goal?.rateSource === 'custom' && goal?.customRates) return goal.customRates;
            return agencyRates;
          })();

          // Determine effective goal/days for daily targets
          let effectiveGoal = monthlyGoal;
          let effectiveDays = workingDaysInMonth.length || 1;
          if (isCurrentMonth && workingDaysRemaining > 0) {
            effectiveGoal = remainingAlp;
            effectiveDays = workingDaysRemaining;
          }
          const requiredSales = Math.ceil((effectiveGoal || 0) / (rates.salesToAlp || 1200));
          const requiredSits = Math.ceil(requiredSales / (rates.sitsToSales || 0.33));
          const requiredAppts = Math.ceil(requiredSits / (rates.apptsToSits || 0.25));
          const requiredCalls = Math.ceil(requiredAppts * (rates.callsToAppts || 35));
          const dailyNeeded = {
            alp: Math.round((effectiveGoal || 0) / effectiveDays),
            sales: Math.ceil(requiredSales / effectiveDays),
            sits: Math.ceil(requiredSits / effectiveDays),
            appts: Math.ceil(requiredAppts / effectiveDays),
            calls: Math.ceil(requiredCalls / effectiveDays)
          };
          return {
            id: member.id,
            role: member.role || '',
            name: member.name || '',
            mgaName: (byUserId.get(member.id)?.mga) || '',
            managerActive: member.managerActive || 'y',
            monthlyAlpGoal: monthlyGoal || '',
            reportedAlp,
            remainingAlp,
            workingDaysCount: workingDaysInMonth.length,
            dailyCallsNeeded: dailyNeeded.calls,
            dailyApptsNeeded: dailyNeeded.appts,
            dailySitsNeeded: dailyNeeded.sits,
            dailySalesNeeded: dailyNeeded.sales,
            dailyAlpNeeded: dailyNeeded.alp,
            rateSource: goal?.rateSource ? (goal.rateSource === 'custom' ? 'Custom' : 'Agency') : ''
          };
        })
        // sort by hierarchy order, then role, then name
        .sort((a, b) => {
          const ia = indexByName.has(a.name) ? indexByName.get(a.name) : Number.MAX_SAFE_INTEGER;
          const ib = indexByName.has(b.name) ? indexByName.get(b.name) : Number.MAX_SAFE_INTEGER;
          if (ia !== ib) return ia - ib;
          const order = { RGA: 0, MGA: 1, GA: 2, SA: 3, AGT: 4 };
          const ra = order[(a.role || '').toUpperCase()] ?? 99;
          const rb = order[(b.role || '').toUpperCase()] ?? 99;
          if (ra !== rb) return ra - rb;
          return a.name.localeCompare(b.name);
        });
        // Separate active and inactive members
        let activeRows = rows.filter(r => r.managerActive === 'y');
        let inactiveRows = rows.filter(r => r.managerActive === 'n');
        
        // Filter for SA and GA users to only show directly coded team members
        const userLagnname = user?.lagnname || '';
        
        if (userRole === 'SA') {
          // For SA users: only show team members where SA field equals user's lagnname
          activeRows = activeRows.filter(r => {
            const userData = byUserId.get(r.id);
            return userData?.sa === userLagnname || r.name === userLagnname;
          });
          inactiveRows = inactiveRows.filter(r => {
            const userData = byUserId.get(r.id);
            return userData?.sa === userLagnname || r.name === userLagnname;
          });
        } else if (userRole === 'GA') {
          // For GA users: only show team members where GA field equals user's lagnname
          activeRows = activeRows.filter(r => {
            const userData = byUserId.get(r.id);
            return userData?.ga === userLagnname || r.name === userLagnname;
          });
          inactiveRows = inactiveRows.filter(r => {
            const userData = byUserId.get(r.id);
            return userData?.ga === userLagnname || r.name === userLagnname;
          });
        }
        
        // Store inactive rows separately for reference
        setInactiveTeamRows(inactiveRows);
        
        // Build the combined table data with inactive agents integrated
        const buildCombinedTableData = (filteredActiveRows) => {
          const combinedRows = [...filteredActiveRows];
          
          // Add inactive agents section if there are any
          if (inactiveRows.length > 0) {
            // Add collapsible header row for inactive agents
            combinedRows.push({
              id: 'inactive-agents-header',
              isInactiveHeader: true,
              name: `Inactive Agents (${inactiveRows.length})`,
              inactiveCount: inactiveRows.length,
              // Fill other fields with empty values to prevent totals calculations
              monthlyAlpGoal: 0,
              reportedAlp: 0,
              remainingAlp: 0,
              workingDaysCount: 0,
              dailyCallsNeeded: 0,
              dailyApptsNeeded: 0,
              dailySitsNeeded: 0,
              dailySalesNeeded: 0,
              dailyAlpNeeded: 0,
              rateSource: '',
              role: ''
            });
            
            // Add inactive agent rows if expanded
            if (showInactiveAgents) {
              inactiveRows.forEach(inactiveRow => {
                combinedRows.push({
                  ...inactiveRow,
                  isInactiveAgent: true
                });
              });
            }
          }
          
          return combinedRows;
        };
        
        setTeamRowsAll(activeRows); // Store only active rows for filtering reference
        
        // Apply initial filtering for active members
        const filteredActive = (!mgaOnly || String(user?.clname || '').toUpperCase() !== 'RGA')
          ? activeRows
          : activeRows.filter(r => (r.mgaName && r.mgaName === (user?.lagnname || '')) || r.name === (user?.lagnname || ''));
        
        // Build combined data with inactive agents integrated
        const combinedData = buildCombinedTableData(filteredActive);
        setTeamRows(combinedData);
      } catch (e) {
        setTeamRows([]);
        setTeamRowsAll([]);
        setInactiveTeamRows([]);
      } finally {
        setTeamLoading(false);
      }
    };
    loadTeamGoals();
  }, [viewScope, user?.userId, user?.lagnname, user?.clname, selectedYear, selectedMonth]);

  // Function to rebuild combined table data (active + inactive agents)
  const rebuildCombinedTableData = useCallback((activeRows) => {
    const combinedRows = [...activeRows];
    
    // Add inactive agents section if there are any
    if (inactiveTeamRows.length > 0) {
      // Add collapsible header row for inactive agents
      combinedRows.push({
        id: 'inactive-agents-header',
        isInactiveHeader: true,
        name: `Inactive Agents (${inactiveTeamRows.length})`,
        inactiveCount: inactiveTeamRows.length,
        // Fill other fields with empty values to prevent totals calculations
        monthlyAlpGoal: 0,
        reportedAlp: 0,
        remainingAlp: 0,
        workingDaysCount: 0,
        dailyCallsNeeded: 0,
        dailyApptsNeeded: 0,
        dailySitsNeeded: 0,
        dailySalesNeeded: 0,
        dailyAlpNeeded: 0,
        rateSource: '',
        role: ''
      });
      
      // Add inactive agent rows if expanded
      if (showInactiveAgents) {
        inactiveTeamRows.forEach(inactiveRow => {
          combinedRows.push({
            ...inactiveRow,
            isInactiveAgent: true
          });
        });
      }
    }
    
    return combinedRows;
  }, [inactiveTeamRows, showInactiveAgents]);

  // Recompute filtered rows when mgaOnly toggles, source rows change, or inactive agents visibility changes
  useEffect(() => {
    if (viewScope !== 'team') return;
    if (!teamRowsAll || teamRowsAll.length === 0) {
      setTeamRows([]);
      return;
    }
    const isRga = String(user?.clname || '').toUpperCase() === 'RGA';
    
    // Filter active rows based on MGA setting
    const filteredActive = (mgaOnly && isRga) 
      ? teamRowsAll.filter(r => (r.mgaName && r.mgaName === (user?.lagnname || '')) || r.name === (user?.lagnname || ''))
      : teamRowsAll;
    
    // Rebuild combined data including inactive agents
    const combinedData = rebuildCombinedTableData(filteredActive);
    setTeamRows(combinedData);
  }, [mgaOnly, teamRowsAll, viewScope, user?.clname, user?.lagnname, rebuildCombinedTableData]);

  // Debug logging for inactive agents toggle
  useEffect(() => {
    if (viewScope === 'team' && inactiveTeamRows.length > 0) {
    }
  }, [showInactiveAgents, viewScope, inactiveTeamRows.length]);

  // Auto-exit edit mode when switching to a past month
  useEffect(() => {
    if (isPastMonth && isEditing) {
      setIsEditing(false);
    }
  }, [isPastMonth, isEditing]);

  // Load Daily_Activity data for the visible calendar range (includes leading prev-month days)
  useEffect(() => {
    const loadActivity = async () => {
      if (!user?.userId || !selectedYear || !selectedMonth) {
        setActivityByDate({});
        return;
      }
      try {
        let startDate, endDate;
        
        if (dateOverride) {
          // Use date override boundaries
          startDate = new Date(dateOverride.start_date + 'T00:00:00');
          endDate = new Date(dateOverride.end_date + 'T00:00:00');
        } else {
          // Use default calendar logic (includes leading prev-month days for calendar display)
          const firstOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
          const startingDayOfWeek = firstOfMonth.getDay(); // 0=Sun
          const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
          const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
          const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();

          // Start date includes the leading days from previous month if any
          startDate = new Date(selectedYear, selectedMonth - 1, 1);
          if (startingDayOfWeek > 0) {
            const startDayPrev = daysInPrevMonth - (startingDayOfWeek - 1);
            startDate = new Date(prevYear, prevMonth - 1, startDayPrev);
          }
          // End date is last day of current month
          endDate = new Date(selectedYear, selectedMonth, 0);
        }

        const toIso = (d) => d.toISOString().split('T')[0];
        const response = await api.get(`/dailyActivity/user-summary`, {
          params: {
            userId: user.userId,
            startDate: toIso(startDate),
            endDate: toIso(endDate)
          }
        });

        const rows = response.data?.data || [];
        const mapped = {};
        for (const r of rows) {
          if (r.reportDate) {
            mapped[r.reportDate] = {
              calls: Number(r.calls) || 0,
              appts: Number(r.appts) || 0,
              sits: Number(r.sits) || 0,
              sales: Number(r.sales) || 0,
              alp: Number(r.alp) || 0
            };
          }
        }
        setActivityByDate(mapped);
      } catch (err) {
        console.error('[ProductionGoals] Failed to load activity data:', err);
        setActivityByDate({});
      }
    };
    loadActivity();
  }, [user?.userId, selectedYear, selectedMonth, dateOverride]);

  // Set default working days if none are set (but only if user hasn't manually cleared them)
  useEffect(() => {
    if (workingDays.length === 0 && !userHasClearedDays) {
      const defaultWorkingDays = generateWorkingDays();
      setWorkingDays(defaultWorkingDays);
    }
  }, [selectedYear, selectedMonth, workingDays.length, userHasClearedDays]);

  // Calculate how many working days have passed so far this month
  const getWorkingDaysCompleted = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    
    // Only calculate for current month
    if (selectedYear !== currentYear || selectedMonth !== currentMonth) {
      return 0;
    }
    
    let completedDays = 0;
    for (const workingDay of workingDays) {
      const workingDate = new Date(workingDay + 'T00:00:00');
      if (workingDate < today) {
        completedDays++;
      }
    }
    
    return completedDays;
  };

  // Calculate total ALP achieved so far this month
  const getAlpAchievedSoFar = () => {
    let totalAlp = 0;
    for (const workingDay of workingDays) {
      const actual = activityByDate[workingDay];
      if (actual) {
        totalAlp += actual.alp || 0;
      }
    }
    return totalAlp;
  };

  // Dynamic breakdown calculation that adjusts for progress so far
  const calculateBreakdown = () => {
    if (!monthlyAlpGoal || monthlyAlpGoal <= 0 || workingDays.length === 0) return null;

    const goal = parseFloat(monthlyAlpGoal);
    if (isNaN(goal) || goal <= 0) return null;
    
    const rates = getCurrentRates();
    const numberOfWorkingDays = workingDays.length;
    const weeksInMonth = Math.max(1, Math.ceil(numberOfWorkingDays / 5));
    
    // Check if we need to adjust for progress so far
    const workingDaysCompleted = getWorkingDaysCompleted();
    const alpAchievedSoFar = getAlpAchievedSoFar();
    const workingDaysRemaining = numberOfWorkingDays - workingDaysCompleted;
    
    // Determine which goal amount to use for daily calculations
    let effectiveGoal = goal;
    let effectiveDays = numberOfWorkingDays;
    let isAdjusted = false;
    
    // If we're in the current month and have working days remaining, adjust targets
    if (workingDaysCompleted > 0 && workingDaysRemaining > 0) {
      const remainingAlpNeeded = Math.max(0, goal - alpAchievedSoFar);
      effectiveGoal = remainingAlpNeeded;
      effectiveDays = workingDaysRemaining;
      isAdjusted = true;
    }
    
    // Calculate required metrics using effective goal and days
    const requiredSales = Math.ceil(effectiveGoal / rates.salesToAlp);
    const requiredSits = Math.ceil(requiredSales / rates.sitsToSales);
    const requiredAppts = Math.ceil(requiredSits / rates.apptsToSits);
    const requiredCalls = Math.ceil(requiredAppts * rates.callsToAppts);

    // Calculate daily targets based on effective values
    const dailyTargets = {
      alp: Math.round(effectiveGoal / effectiveDays),
      sales: Math.ceil(requiredSales / effectiveDays),
      sits: Math.ceil(requiredSits / effectiveDays),
      appts: Math.ceil(requiredAppts / effectiveDays),
      calls: Math.ceil(requiredCalls / effectiveDays)
    };

    return {
      monthly: {
        alp: goal,
        sales: Math.ceil(goal / rates.salesToAlp),
        sits: Math.ceil((goal / rates.salesToAlp) / rates.sitsToSales),
        appts: Math.ceil(((goal / rates.salesToAlp) / rates.sitsToSales) / rates.apptsToSits),
        calls: Math.ceil((((goal / rates.salesToAlp) / rates.sitsToSales) / rates.apptsToSits) * rates.callsToAppts)
      },
      weekly: {
        alp: Math.round(goal / weeksInMonth),
        sales: Math.ceil((goal / rates.salesToAlp) / weeksInMonth),
        sits: Math.ceil(((goal / rates.salesToAlp) / rates.sitsToSales) / weeksInMonth),
        appts: Math.ceil((((goal / rates.salesToAlp) / rates.sitsToSales) / rates.apptsToSits) / weeksInMonth),
        calls: Math.ceil(((((goal / rates.salesToAlp) / rates.sitsToSales) / rates.apptsToSits) * rates.callsToAppts) / weeksInMonth)
      },
      daily: dailyTargets,
      rates: rates,
      workingDays: numberOfWorkingDays,
      weeksInMonth: weeksInMonth,
      // Progress tracking information
      isAdjusted: isAdjusted,
      workingDaysCompleted: workingDaysCompleted,
      workingDaysRemaining: workingDaysRemaining,
      alpAchievedSoFar: alpAchievedSoFar,
      remainingAlpNeeded: isAdjusted ? effectiveGoal : 0,
      effectiveDays: effectiveDays,
      originalDaily: {
        alp: Math.round(goal / numberOfWorkingDays),
        sales: Math.ceil((goal / rates.salesToAlp) / numberOfWorkingDays),
        sits: Math.ceil(((goal / rates.salesToAlp) / rates.sitsToSales) / numberOfWorkingDays),
        appts: Math.ceil((((goal / rates.salesToAlp) / rates.sitsToSales) / rates.apptsToSits) / numberOfWorkingDays),
        calls: Math.ceil(((((goal / rates.salesToAlp) / rates.sitsToSales) / rates.apptsToSits) * rates.callsToAppts) / numberOfWorkingDays)
      }
    };
  };



  // Save personal goal function
  const handleSaveGoal = async () => {
    if (!user?.userId || !monthlyAlpGoal) return;

    try {
      setLoading(true);
      const goalPayload = {
        userId: user.userId,
        year: selectedYear,
        month: selectedMonth,
        monthlyAlpGoal: parseFloat(monthlyAlpGoal),
        goalType: 'personal',
        workingDays: workingDays,
        rateSource: rateSource,
        customRates: rateSource === 'custom' ? customRates : null
      };

      await api.post('/goals', goalPayload);
      setIsEditing(false);
      loadGoalData();
    } catch (error) {
      console.error('Error saving personal goal:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual trigger to reload team ALP data (for debugging)
  const forceReloadTeamALP = async () => {
    await loadTeamALPProgress();
  };

  // Expose function globally for debugging
  if (typeof window !== 'undefined') {
    window.forceReloadTeamALP = forceReloadTeamALP;
  }

  // Get total days in month for team goals
  // Team goals use full calendar month days instead of working days for simplified ALP tracking
  const getTotalDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  // Save MGA goal function
  const handleSaveMgaGoal = async (skipLoadingState = false) => {
    if (!user?.userId || !mgaGoal) return;

    try {
      if (!skipLoadingState) setLoading(true);
      
      // For team goals, use full month days instead of working days
      const totalDaysInMonth = getTotalDaysInMonth(selectedYear, selectedMonth);
      const teamWorkingDays = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);
      
      const goalPayload = {
        userId: user.userId,
        year: selectedYear,
        month: selectedMonth,
        monthlyAlpGoal: parseFloat(mgaGoal),
        goalType: 'mga',
        workingDays: teamWorkingDays, // Use full month days for team goals
        rateSource: 'default', // Use default rates for team goals (simplified)
        customRates: null
      };

      await api.post('/goals', goalPayload);
      if (!skipLoadingState) {
        await loadGoalData(); // Only reload if this is an individual save
        // Also reload team ALP progress for individual saves
        if (isManagerRole()) {
          await loadTeamALPProgress();
        }
      }
      
      // Show success feedback
      
    } catch (error) {
      console.error('❌ Error saving MGA goal:', error);
      
      if (!skipLoadingState) {
        // Check if it's a constraint error
        if (error.response?.status === 409) {
          const errorData = error.response.data;
          alert(`Database Constraint Error: ${errorData.message}\n\nTo fix this permanently, run this SQL in your database:\n${errorData.solution}`);
        } else {
          alert(`Error saving MGA team goal: ${error.response?.data?.message || error.message}`);
        }
      }
      throw error; // Re-throw for batch operations
    } finally {
      if (!skipLoadingState) setLoading(false);
    }
  };

  // Save RGA goal function
  const handleSaveRgaGoal = async (skipLoadingState = false) => {
    if (!user?.userId || !rgaGoal) return;

    try {
      if (!skipLoadingState) setLoading(true);
      
      // For team goals, use full month days instead of working days
      const totalDaysInMonth = getTotalDaysInMonth(selectedYear, selectedMonth);
      const teamWorkingDays = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);
      
      const goalPayload = {
        userId: user.userId,
        year: selectedYear,
        month: selectedMonth,
        monthlyAlpGoal: parseFloat(rgaGoal),
        goalType: 'rga',
        workingDays: teamWorkingDays, // Use full month days for team goals
        rateSource: 'default', // Use default rates for team goals (simplified)
        customRates: null
      };

      await api.post('/goals', goalPayload);
      if (!skipLoadingState) {
        await loadGoalData(); // Only reload if this is an individual save
        // Also reload team ALP progress for individual saves
        if (isManagerRole()) {
          await loadTeamALPProgress();
        }
      }
      
      // Show success feedback
      
    } catch (error) {
      console.error('❌ Error saving RGA goal:', error);
      
      if (!skipLoadingState) {
        // Check if it's a constraint error
        if (error.response?.status === 409) {
          const errorData = error.response.data;
          alert(`Database Constraint Error: ${errorData.message}\n\nTo fix this permanently, run this SQL in your database:\n${errorData.solution}`);
        } else {
          alert(`Error saving RGA team goal: ${error.response?.data?.message || error.message}`);
        }
      }
      throw error; // Re-throw for batch operations
    } finally {
      if (!skipLoadingState) setLoading(false);
    }
  };

  // Save all team goals (for the main Save Goals button in team view)
  const handleSaveAllTeamGoals = async () => {
    const userRole = String(user?.clname || '').toUpperCase();
    const promises = [];
    
    try {
      setLoading(true);
      
      if (userRole === 'RGA') {
        // RGA users can save both MGA and RGA goals
        if (mgaGoal) {
          promises.push(handleSaveMgaGoal(true)); // Skip individual loading state
        }
        if (rgaGoal) {
          promises.push(handleSaveRgaGoal(true)); // Skip individual loading state
        }
      } else if (['SA', 'GA', 'MGA'].includes(userRole)) {
        // Other users can only save MGA goal (shown as "Team Goal")
        if (mgaGoal) {
          promises.push(handleSaveMgaGoal(true)); // Skip individual loading state
        }
      }
      
      // Wait for all saves to complete
      await Promise.all(promises);
      
      // Reload goal data after all saves complete
      await loadGoalData();
      
      // Also reload team ALP progress to update the cards with latest data
      if (isManagerRole()) {
        await loadTeamALPProgress();
      }
      
      setIsEditing(false); // Exit edit mode after successful save
      
    } catch (error) {
      console.error('❌ Error saving team goals:', error);
      
      // Check if it's a constraint error
      if (error.response?.status === 409) {
        const errorData = error.response.data;
        alert(`Database Constraint Error: ${errorData.message}\n\nTo fix this permanently, run this SQL in your database:\n${errorData.solution}`);
      } else {
        alert(`Error saving team goals: ${error.response?.data?.message || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle setting user managerActive to inactive
  const handleSetManagerInactive = async (userId, userName) => {
    try {
      
      const response = await api.post('/auth/setManagerInactive', { userId });
      
      if (response.data?.success) {
        
        // Show success message (you could add a toast notification here)
        alert(`${userName} has been set to manager inactive`);
        
        // Optionally refresh the team data - the user will likely reload or navigate away
        // since the user is now inactive and may be filtered out
      } else {
        console.error('❌ Failed to set manager inactive:', response.data?.message);
        alert('Failed to update manager status. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error setting manager inactive:', error);
      alert('Error updating manager status. Please try again.');
    }
  };

  // Handle reactivating a manager
  const handleReactivateManager = async (userId, userName) => {
    try {
      
      // We can reuse the toggle endpoint and pass 'y' status
      const response = await api.post('/auth/toggleActive', { 
        userId: userName,  // The toggle endpoint expects lagnname
        currentStatus: 'n' // This will toggle to 'y'
      });
      
      if (response.data?.success) {
        alert(`${userName} has been reactivated as manager`);
        
        // Refresh the team data by triggering a reload
        // The useEffect will automatically run when dependencies change
        setTeamLoading(true);
        setTimeout(() => setTeamLoading(false), 100); // Trigger re-render
      } else {
        console.error('❌ Failed to reactivate manager:', response.data?.message);
        alert('Failed to reactivate manager status. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error reactivating manager:', error);
      alert('Error reactivating manager status. Please try again.');
    }
  };

  // Get context menu options for team table rows
  const getTeamRowContextMenuOptions = (row) => {
    if (!row || !row.id || !row.name) return [];
    
    return [
      {
        label: 'Set Manager Inactive',
        icon: <FiUserMinus />,
        onClick: () => handleSetManagerInactive(row.id, row.name),
        className: 'context-menu-danger'
      }
    ];
  };

  // Calculate breakdown whenever relevant values change
  useEffect(() => {
    const result = calculateBreakdown();
    setBreakdown(result);
  }, [monthlyAlpGoal, workingDays, rateSource, customRates, activityByDate, selectedYear, selectedMonth]);

  // Handle screen size detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setShowWeeklyToggle(window.innerWidth <= 1000);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Switch to calendar view when entering edit mode
  useEffect(() => {
    if (isEditing && viewMode === 'weekly') {
      setViewMode('calendar');
    }
  }, [isEditing]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Safe number formatting to prevent NaN display
  const safeNumber = (value, fallback = 0) => {
    const num = parseFloat(value);
    return isNaN(num) ? fallback : num;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Month/Year navigation functions
  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const isManagerRole = () => {
    const r = (user?.clname || '').toUpperCase();
    return ['SA','GA','MGA','RGA'].includes(r);
  };

  const getRoleBadgeStyle = (cl) => {
    const clname = String(cl || '').toUpperCase();
    const styles = { backgroundColor: 'lightgrey', border: '2px solid grey' };
    switch (clname) {
      case 'SA':
        styles.backgroundColor = 'rgb(178, 82, 113)';
        styles.border = '2px solid rgb(138, 62, 93)';
        break;
      case 'GA':
        styles.backgroundColor = 'rgb(237, 114, 47)';
        styles.border = '2px solid rgb(197, 94, 37)';
        break;
      case 'MGA':
        styles.backgroundColor = 'rgb(104, 182, 117)';
        styles.border = '2px solid rgb(84, 152, 97)';
        break;
      case 'RGA':
        styles.backgroundColor = '#00558c';
        styles.border = '2px solid #004372';
        break;
      default:
        styles.backgroundColor = 'lightgrey';
        styles.border = '2px solid grey';
        break;
    }
    return {
      ...styles,
      padding: '2px 4px',
      borderRadius: '4px',
      fontSize: '10px',
      color: 'white',
      fontWeight: 600,
      letterSpacing: '0.5px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      display: 'inline-block'
    };
  };

  // Build a flattened hierarchy order (top-down) similar to MGADataTable
  const buildHierarchyOrder = (agents) => {
    if (!Array.isArray(agents) || agents.length === 0) return [];
    const orderByRole = ['RGA','MGA','GA','SA','AGT'];
    const normalize = (s) => (s || '').trim();
    const nodesByName = new Map();
    agents.forEach(a => {
      nodesByName.set(a.lagnname, { ...a, children: [] });
    });
    const roots = [];
    agents.forEach(a => {
      const node = nodesByName.get(a.lagnname);
      let parentName = null;
      if (a.sa && nodesByName.has(a.sa)) parentName = a.sa; else
      if (a.ga && nodesByName.has(a.ga)) parentName = a.ga; else
      if (a.mga && nodesByName.has(a.mga)) parentName = a.mga; else
      if (a.rga && nodesByName.has(a.rga)) parentName = a.rga;
      if (parentName && nodesByName.has(parentName)) {
        nodesByName.get(parentName).children.push(node);
      } else {
        roots.push(node);
      }
    });
    const sortRec = (arr, parent = null) => arr
      .sort((a,b)=> {
        const aRole = String(a.clname || '').toUpperCase();
        const bRole = String(b.clname || '').toUpperCase();
        const orphanA = (aRole === 'AGT' && !a.sa && !a.ga);
        const orphanB = (bRole === 'AGT' && !b.sa && !b.ga);

        // Within a GA, place AGTs without SA before SA rows, then SA
        if (parent && String(parent.clname || '').toUpperCase() === 'GA') {
          const agtNoSaA = (aRole === 'AGT' && !a.sa);
          const agtNoSaB = (bRole === 'AGT' && !b.sa);
          if (agtNoSaA !== agtNoSaB) return agtNoSaA ? -1 : 1;
          const isSaA = (aRole === 'SA');
          const isSaB = (bRole === 'SA');
          if (isSaA !== isSaB) return isSaA ? 1 : -1; // non-SA before SA
        }

        // Globally, orphan AGTs (no SA and no GA) first
        if (orphanA !== orphanB) return orphanA ? -1 : 1;

        const oa = orderByRole.indexOf(aRole);
        const ob = orderByRole.indexOf(bRole);
        if (oa === ob) return normalize(a.lagnname).localeCompare(normalize(b.lagnname));
        return oa - ob;
      })
      .map(n => ({ ...n, children: sortRec(n.children, n) }));

    const tree = sortRec(roots);
    const flat = [];
    const dfs = (nodes) => {
      nodes.forEach(n => {
        flat.push(n.lagnname);
        if (n.children && n.children.length) dfs(n.children);
      });
    };
    dfs(tree);
    return flat;
  };

  // Build RGA-specific hierarchy order that shows RGA's MGA team first, then other MGA teams
  const buildRGAHierarchyOrder = (agents, rgaName) => {
    console.log(`\n🏗️ ========== RGA HIERARCHY BREAKDOWN ==========`);
    console.log(`🎯 Building hierarchy for RGA: ${rgaName}`);
    console.log(`👥 Total agents to process: ${agents.length}`);
    
    if (!Array.isArray(agents) || agents.length === 0) {
      console.log(`❌ No agents found, returning empty array`);
      return [];
    }
    
    const normalize = (s) => (s || '').trim();
    const result = [];
    
    // Log all agents for debugging
    console.log(`\n📋 All agents in hierarchy:`);
    agents.forEach((a, i) => {
      console.log(`   ${i + 1}. ${a.lagnname} (${a.clname}) - MGA: ${a.mga || 'none'}, RGA: ${a.rga || 'none'}`);
    });
    
    // 1. Add the RGA user first
    console.log(`\n🔍 STEP 1: Finding RGA user...`);
    const rgaAgent = agents.find(a => normalize(a.lagnname) === normalize(rgaName));
    if (rgaAgent) {
      result.push(rgaAgent.lagnname);
      console.log(`✅ Added RGA: ${rgaAgent.lagnname}`);
    } else {
      console.log(`❌ RGA user not found: ${rgaName}`);
    }
    
    // 2. Add RGA's MGA team (where mga = RGA user name) using existing hierarchy logic
    console.log(`\n🔍 STEP 2: Finding RGA's MGA team...`);
    console.log(`   Looking for agents where mga = "${rgaName}"`);
    const rgaMgaTeam = agents.filter(a => normalize(a.mga) === normalize(rgaName));
    console.log(`   Found ${rgaMgaTeam.length} members in RGA's MGA team:`);
    
    rgaMgaTeam.forEach((member, i) => {
      console.log(`      ${i + 1}. ${member.lagnname} (${member.clname})`);
    });
    
    if (rgaMgaTeam.length > 0) {
      console.log(`   🏗️ Building hierarchy for RGA's MGA team...`);
      const rgaMgaHierarchy = buildHierarchyOrder(rgaMgaTeam);
      console.log(`   📊 RGA MGA team hierarchy order:`, rgaMgaHierarchy);
      result.push(...rgaMgaHierarchy);
      console.log(`   ✅ Added ${rgaMgaHierarchy.length} members from RGA's MGA team`);
    } else {
      console.log(`   ⚠️ No MGA team found for RGA`);
    }
    
    // 3. Find other MGAs under this RGA (excluding the RGA user themselves)
    console.log(`\n🔍 STEP 3: Finding other MGAs under this RGA...`);
    console.log(`   Looking for MGAs where rga = "${rgaName}" but name ≠ "${rgaName}"`);
    
    const otherMGAs = agents.filter(a => {
      const role = String(a.clname || '').toUpperCase();
      return role === 'MGA' && 
             normalize(a.rga) === normalize(rgaName) &&
             normalize(a.lagnname) !== normalize(rgaName);
    }).sort((a, b) => normalize(a.lagnname).localeCompare(normalize(b.lagnname)));
    
    console.log(`   Found ${otherMGAs.length} other MGAs under this RGA:`);
    otherMGAs.forEach((mga, i) => {
      console.log(`      ${i + 1}. ${mga.lagnname} (${mga.clname})`);
    });
    
    // 4. For each other MGA, add them and their MGA team using existing hierarchy logic  
    console.log(`\n🔍 STEP 4: Processing each MGA and their teams...`);
    
    otherMGAs.forEach((mgaAgent, mgaIndex) => {
      console.log(`\n   🎯 Processing MGA ${mgaIndex + 1}/${otherMGAs.length}: ${mgaAgent.lagnname}`);
      
      // Add the MGA
      result.push(mgaAgent.lagnname);
      console.log(`      ✅ Added MGA: ${mgaAgent.lagnname}`);
      
      // Add their MGA team (where mga = this MGA's name)
      console.log(`      🔍 Looking for ${mgaAgent.lagnname}'s MGA team...`);
      console.log(`         Searching for agents where mga = "${mgaAgent.lagnname}"`);
      
      const mgaTeam = agents.filter(a => normalize(a.mga) === normalize(mgaAgent.lagnname));
      console.log(`         Found ${mgaTeam.length} members in ${mgaAgent.lagnname}'s MGA team:`);
      
      mgaTeam.forEach((member, i) => {
        console.log(`            ${i + 1}. ${member.lagnname} (${member.clname})`);
      });
      
      if (mgaTeam.length > 0) {
        console.log(`         🏗️ Building hierarchy for ${mgaAgent.lagnname}'s MGA team...`);
        const mgaHierarchy = buildHierarchyOrder(mgaTeam);
        console.log(`         📊 ${mgaAgent.lagnname}'s team hierarchy order:`, mgaHierarchy);
        result.push(...mgaHierarchy);
        console.log(`         ✅ Added ${mgaHierarchy.length} members from ${mgaAgent.lagnname}'s team`);
      } else {
        console.log(`         ⚠️ No team members found for MGA: ${mgaAgent.lagnname}`);
      }
    });
    
    console.log(`\n🎉 ========== FINAL RGA HIERARCHY RESULT ==========`);
    console.log(`📊 Total hierarchy length: ${result.length}`);
    console.log(`📋 Final order:`);
    result.forEach((name, i) => {
      const agent = agents.find(a => normalize(a.lagnname) === normalize(name));
      console.log(`   ${i + 1}. ${name} (${agent?.clname || 'unknown'})`);
    });
    console.log(`===============================================\n`);
    
    return result;
  };

  return (
    <div className="production-goals">
      <div className="goals-header">
  
            <div className="header-center">
          <div className="nav-and-actions">
            <div className="month-year-navigation">
              <button 
                onClick={goToPreviousMonth}
                className="date-nav-btn"
              >
                <FiChevronLeft />
              </button>
              
              <div className="current-month-year">
                <FiCalendar />
                <span>{monthNames[selectedMonth - 1]} {selectedYear}</span>
              </div>
              
              <button 
                onClick={goToNextMonth}
                className="date-nav-btn"
              >
                <FiChevronRight />
              </button>
            </div>
            {(() => {
              const userRole = String(user?.clname || '').toUpperCase();
              
              if (userRole === 'SGA') {
                // SGA users get Individual and Agency tabs
                return (
                  <div className="edit-section" style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={`btn ${viewScope === 'personal' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setViewScope('personal')}
                      title="View Individual Goals"
                    >
                      Individual
                    </button>
                    <button
                      className={`btn ${viewScope === 'agency' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setViewScope('agency')}
                      title="View Agency Goals"
                    >
                      Agency
                    </button>
                  </div>
                );
              } else if (isManagerRole()) {
                // Other managers get Personal and Team tabs
                return (
                  <div className="edit-section" style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={`btn ${viewScope === 'personal' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setViewScope('personal')}
                      title="View Personal Goals"
                    >
                      Personal
                    </button>
                    <button
                      className={`btn ${viewScope === 'team' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setViewScope('team')}
                      title="View Team Goals"
                    >
                      Team
                    </button>
                  </div>
                );
              }
              return null;
            })()}
            
            {/* Edit buttons for personal view */}
            {viewScope === 'personal' && !isEditing && (
              <div className="edit-section">
                <button 
                  className={`btn ${isPastMonth ? 'btn-disabled' : 'btn-primary'}`}
                  onClick={() => setIsEditing(true)}
                  disabled={isPastMonth}
                  title={isPastMonth ? 'Cannot edit goals for past months' : 'Edit this month\'s goal'}
                >
                  <FiEdit3 />
                </button>
              </div>
            )}
            
            {viewScope === 'personal' && isEditing && (
              <div className="edit-actions">
                <button 
                  className="btn btn-secondary btn-icon"
                  onClick={() => {
                    setIsEditing(false);
                    loadGoalData();
                  }}
                  title="Cancel"
                >
                  <FiX />
                </button>
                <button 
                  className="btn btn-primary btn-icon"
                  onClick={handleSaveGoal}
                  disabled={loading || !monthlyAlpGoal || workingDays.length === 0}
                  title="Save Goal"
                >
                  <FiSave />
                </button>
              </div>
            )}
            
            {/* Team view edit buttons */}
            {viewScope === 'team' && (['SA', 'GA', 'MGA', 'RGA'].includes(String(user?.clname || '').toUpperCase())) && !isEditing && (
              <div className="edit-section">
                <button 
                  className={`btn ${isPastMonth ? 'btn-disabled' : 'btn-primary'}`}
                  onClick={() => setIsEditing(true)}
                  disabled={isPastMonth}
                  title={isPastMonth ? 'Cannot edit goals for past months' : 'Edit team goals'}
                >
                  <FiEdit3 />
                </button>
              </div>
            )}
            
            {viewScope === 'team' && (['SA', 'GA', 'MGA', 'RGA'].includes(String(user?.clname || '').toUpperCase())) && isEditing && (
              <div className="edit-actions">
                <button 
                  className="btn btn-secondary btn-icon"
                  onClick={() => setIsEditing(false)}
                  title="Cancel Edit Mode"
                >
                  <FiX />
                </button>
                <button 
                  className="btn btn-success btn-icon"
                  onClick={handleSaveAllTeamGoals}
                  disabled={loading}
                  title="Save Team Goals and Exit Edit Mode"
                >
                  <FiSave />
                </button>
              </div>
            )}
          </div>
          
          {isPastMonth && !isEditing && (
            <div className="past-month-notice">
              <small>Past months cannot be edited</small>
            </div>
          )}
        </div>
      </div>

      <div className="goals-content">
        {viewScope === 'agency' ? (
          <>
            {/* Agency View - All Hierarchy Goals */}
            <div className="agency-header" style={{ marginBottom: '20px', padding: '16px', background: 'var(--card-background)', borderRadius: '8px' }}>
              <h3 style={{ margin: 0, marginBottom: '8px' }}>Agency Goals & Commits</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
                Viewing goals and commits for entire agency hierarchy ({agencyRowsAll.length} active agents{inactiveAgencyRows.length > 0 ? `, ${inactiveAgencyRows.length} inactive` : ''})
              </p>
            </div>

            <ActionBar
              selectedCount={0}
              totalCount={agencyRows.length}
              entityName="agents"
            />

            <div className="goal-cards-section" style={{ position: 'relative' }}>
              <DataTable
                columns={[
                  { 
                    Header: 'Role', 
                    accessor: 'role', 
                    width: 70,
                    minWidth: 70,
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) {
                        return (
                          <div 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowInactiveAgencyAgents(!showInactiveAgencyAgents);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                              fontSize: '12px',
                              color: '#666',
                              fontWeight: '500',
                              width: '100%',
                              height: '100%',
                              padding: '8px 4px'
                            }}
                            title={showInactiveAgencyAgents ? 'Click to collapse inactive agents' : 'Click to expand inactive agents'}
                          >
                            <span style={{
                              marginRight: '6px',
                              transform: showInactiveAgencyAgents ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                              fontSize: '10px'
                            }}>
                              ▶
                            </span>
                          </div>
                        );
                      }
                      if (row.original.isInactiveAgent) {
                        return (
                          <span className="user-role-badge inactive-badge" style={{...getRoleBadgeStyle(value), opacity: 0.6}}>
                            {value}
                          </span>
                        );
                      }
                      return (
                        <span className="user-role-badge" style={getRoleBadgeStyle(value)}>{value}</span>
                      );
                    }
                  },
                  { 
                    Header: 'Name', 
                    accessor: 'name', 
                    width: 200, 
                    minWidth: 160,
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) {
                        return (
                          <div 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowInactiveAgencyAgents(!showInactiveAgencyAgents);
                            }}
                            style={{
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#666',
                              fontWeight: '500',
                              padding: '8px 12px',
                              borderRadius: '4px',
                              backgroundColor: '#f5f5f5',
                              border: '1px solid #e0e0e0',
                              width: '100%',
                              boxSizing: 'border-box',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                            title={showInactiveAgencyAgents ? 'Click to collapse inactive agents' : 'Click to expand inactive agents'}
                          >
                            <span>{value}</span>
                            <span style={{
                              fontSize: '12px',
                              color: '#999',
                              marginLeft: '8px'
                            }}>
                              {showInactiveAgencyAgents ? 'Click to collapse' : 'Click to expand'}
                            </span>
                          </div>
                        );
                      }
                      if (row.original.isInactiveAgent) {
                        return <span style={{ color: '#999' }}>{value}</span>;
                      }
                      return <span>{value}</span>;
                    }
                  },
                  { 
                    Header: 'RGA', 
                    accessor: 'rgaName', 
                    width: 150, 
                    minWidth: 130,
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) return '';
                      return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value || '-'}</span> : (value || '-');
                    }
                  },
                  { 
                    Header: 'MGA', 
                    accessor: 'mgaName', 
                    width: 150, 
                    minWidth: 130,
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) return '';
                      return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value || '-'}</span> : (value || '-');
                    }
                  },
                  { 
                    Header: 'Goal (ALP)', accessor: 'monthlyAlpGoal', width: 140, minWidth: 120, type: 'number',
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) return '';
                      const formatted = value ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) : '';
                      return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{formatted}</span> : formatted;
                    }
                  },
                  { 
                    Header: 'Reported (ALP)', accessor: 'reportedAlp', width: 150, minWidth: 130, type: 'number',
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) return '';
                      const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
                      return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{formatted}</span> : formatted;
                    }
                  },
                  { 
                    Header: 'Remaining (ALP)', accessor: 'remainingAlp', width: 160, minWidth: 140, type: 'number',
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) return '';
                      const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
                      return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{formatted}</span> : formatted;
                    }
                  },
                  { 
                    Header: 'Working Days', accessor: 'workingDaysCount', width: 130, minWidth: 120, type: 'number',
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) return '';
                      return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value}</span> : value;
                    }
                  },
                  { 
                    Header: 'Daily Calls', accessor: 'dailyCallsNeeded', width: 110, minWidth: 100, type: 'number',
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) return '';
                      return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value}</span> : value;
                    }
                  },
                  { 
                    Header: 'Daily Appts', accessor: 'dailyApptsNeeded', width: 110, minWidth: 100, type: 'number',
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) return '';
                      return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value}</span> : value;
                    }
                  },
                  { 
                    Header: 'Daily Sits', accessor: 'dailySitsNeeded', width: 110, minWidth: 100, type: 'number',
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) return '';
                      return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value}</span> : value;
                    }
                  },
                  { 
                    Header: 'Daily Sales', accessor: 'dailySalesNeeded', width: 110, minWidth: 100, type: 'number',
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) return '';
                      return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value}</span> : value;
                    }
                  },
                  { 
                    Header: 'Daily ALP', accessor: 'dailyAlpNeeded', width: 120, minWidth: 110, type: 'number',
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) return '';
                      const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
                      return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{formatted}</span> : formatted;
                    }
                  },
                  { 
                    Header: 'Rate Source', accessor: 'rateSource', width: 120, minWidth: 100,
                    Cell: ({ value, row }) => {
                      if (row.original.isInactiveHeader) return '';
                      return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value}</span> : value;
                    }
                  }
                ]}
                data={agencyRows}
                disablePagination={true}
                showActionBar={false}
                disableCellEditing={true}
                showTotals={true}
                totalsPosition="bottom"
                totalsColumns={[
                  'monthlyAlpGoal','reportedAlp','remainingAlp','workingDaysCount',
                  'dailyCallsNeeded','dailyApptsNeeded','dailySitsNeeded','dailySalesNeeded','dailyAlpNeeded'
                ]}
                totalsLabel="Agency Totals"
                totalsLabelColumn="name"
                bandedRows={true}
                allowTableOverflow={true}
              />
              {(agencyLoading || loading) && (
                <OverlaySpinner text="Loading agency goals..." />
              )}
            </div>
          </>
        ) : viewScope === 'team' ? (
          <>
            {/* Team Goal Cards */}
            <div className="team-goal-cards" style={{ marginBottom: '20px' }}>
              {(() => {
                const userRole = String(user?.clname || '').toUpperCase();
                
                if (userRole === 'RGA') {
                  // RGA users get both MGA and RGA team goal cards
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                      {/* MGA Team Goal Card */}
                      <Card
                        title="MGA Team Goal"
                        value={!isEditing || isPastMonth ? (
                          mgaGoal ? `$${parseInt(mgaGoal).toLocaleString()}` : 'Not Set'
                        ) : (
                          <input
                            type="number"
                            value={mgaGoal}
                            onChange={(e) => setMgaGoal(e.target.value)}
                            placeholder="Enter MGA team goal"
                            disabled={isPastMonth}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              fontSize: 'inherit',
                              fontWeight: 'inherit',
                              color: 'inherit',
                              width: '100%',
                              outline: 'none'
                            }}
                          />
                        )}
                        subText={(() => {
                          if (!mgaGoalData) return null;
                          const reported = mgaGoalData.reported || 0;
                          
                          // Calculate remaining days in current month
                          const today = new Date();
                          const currentYear = today.getFullYear();
                          const currentMonth = today.getMonth() + 1;
                          const isCurrentMonth = (selectedYear === currentYear && selectedMonth === currentMonth);
                          
                          if (isCurrentMonth) {
                            const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                            const currentDay = today.getDate();
                            const daysRemaining = Math.max(0, lastDayOfMonth - currentDay);
                            return `$${reported.toLocaleString()} achieved - ${daysRemaining} days remaining`;
                          } else {
                            // For past/future months, just show achieved amount
                            return `$${reported.toLocaleString()} achieved`;
                          }
                        })()}
                        donut={mgaGoalData && mgaGoalData.monthlyAlpGoal && mgaGoalData.reported !== undefined}
                        percentage={(() => {
                          if (!mgaGoalData || !mgaGoalData.monthlyAlpGoal) return 0;
                          const percent = Math.round((mgaGoalData.reported || 0) / mgaGoalData.monthlyAlpGoal * 100);
                          return Math.min(percent, 100); // Cap at 100%
                        })()}
                        donutColor={(() => {
                          if (!mgaGoalData || !mgaGoalData.monthlyAlpGoal) return "#e0e0e0";
                          const percent = (mgaGoalData.reported || 0) / mgaGoalData.monthlyAlpGoal * 100;
                          if (percent === 0) return "#e0e0e0"; // Light gray when no progress yet
                          if (percent >= 100) return "#4caf50"; // Green when complete
                          if (percent >= 75) return "#8bc34a"; // Light green when close
                          if (percent >= 50) return "#ff9800"; // Orange when halfway
                          if (percent >= 25) return "#ff5722"; // Red-orange when behind
                          return "#f44336"; // Red when far behind
                        })()}
                        trend={mgaGoalData?.trend}
                        trendValue={mgaGoalData?.trendValue}
                        icon="📊"
                        color="#007bff"
                        textColor="white"
                        backgroundIconColor="rgba(0, 123, 255, 0.15)"
                        actions={!isPastMonth && isEditing ? [
                          {
                            label: 'Save MGA Goal',
                            onClick: handleSaveMgaGoal,
                            disabled: !mgaGoal || loading,
                            variant: 'primary'
                          }
                        ] : []}
                      />
                      
                      {/* RGA Team Goal Card */}
                      <Card
                        title="RGA Team Goal"
                        value={!isEditing || isPastMonth ? (
                          rgaGoal ? `$${parseInt(rgaGoal).toLocaleString()}` : 'Not Set'
                        ) : (
                          <input
                            type="number"
                            value={rgaGoal}
                            onChange={(e) => setRgaGoal(e.target.value)}
                            placeholder="Enter RGA team goal"
                            disabled={isPastMonth}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              fontSize: 'inherit',
                              fontWeight: 'inherit',
                              color: 'inherit',
                              width: '100%',
                              outline: 'none'
                            }}
                          />
                        )}
                        subText={(() => {
                          if (!rgaGoalData) return null;
                          const reported = rgaGoalData.reported || 0;
                          
                          // Calculate remaining days in current month
                          const today = new Date();
                          const currentYear = today.getFullYear();
                          const currentMonth = today.getMonth() + 1;
                          const isCurrentMonth = (selectedYear === currentYear && selectedMonth === currentMonth);
                          
                          if (isCurrentMonth) {
                            const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                            const currentDay = today.getDate();
                            const daysRemaining = Math.max(0, lastDayOfMonth - currentDay);
                            return `$${reported.toLocaleString()} achieved - ${daysRemaining} days remaining`;
                          } else {
                            // For past/future months, just show achieved amount
                            return `$${reported.toLocaleString()} achieved`;
                          }
                        })()}
                        donut={rgaGoalData && rgaGoalData.monthlyAlpGoal && rgaGoalData.reported !== undefined}
                        percentage={(() => {
                          if (!rgaGoalData || !rgaGoalData.monthlyAlpGoal) return 0;
                          const percent = Math.round((rgaGoalData.reported || 0) / rgaGoalData.monthlyAlpGoal * 100);
                          return Math.min(percent, 100); // Cap at 100%
                        })()}
                        donutColor={(() => {
                          if (!rgaGoalData || !rgaGoalData.monthlyAlpGoal) return "#e0e0e0";
                          const percent = (rgaGoalData.reported || 0) / rgaGoalData.monthlyAlpGoal * 100;
                          if (percent === 0) return "#e0e0e0"; // Light gray when no progress yet
                          if (percent >= 100) return "#4caf50"; // Green when complete
                          if (percent >= 75) return "#8bc34a"; // Light green when close
                          if (percent >= 50) return "#ff9800"; // Orange when halfway
                          if (percent >= 25) return "#ff5722"; // Red-orange when behind
                          return "#f44336"; // Red when far behind
                        })()}
                        trend={rgaGoalData?.trend}
                        trendValue={rgaGoalData?.trendValue}
                        icon="📈"
                        color="#ffc107"
                        textColor="white"
                        backgroundIconColor="rgba(255, 193, 7, 0.15)"
                        actions={!isPastMonth && isEditing ? [
                          {
                            label: 'Save RGA Goal',
                            onClick: handleSaveRgaGoal,
                            disabled: !rgaGoal || loading,
                            variant: 'primary'
                          }
                        ] : []}
                      />
                    </div>
                  );
                } else if (['SA', 'GA', 'MGA'].includes(userRole)) {
                  // SA, GA, MGA users get one "Team Goal" card representing MGA goal
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                      <Card
                        title="Team Goal"
                        value={!isEditing || isPastMonth ? (
                          mgaGoal ? `$${parseInt(mgaGoal).toLocaleString()}` : 'Not Set'
                        ) : (
                          <input
                            type="number"
                            value={mgaGoal}
                            onChange={(e) => setMgaGoal(e.target.value)}
                            placeholder="Enter team goal"
                            disabled={isPastMonth}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              fontSize: 'inherit',
                              fontWeight: 'inherit',
                              color: 'inherit',
                              width: '100%',
                              outline: 'none'
                            }}
                          />
                        )}
                        subText={(() => {
                          if (!mgaGoalData) return null;
                          const reported = mgaGoalData.reported || 0;
                          
                          // Calculate remaining days in current month
                          const today = new Date();
                          const currentYear = today.getFullYear();
                          const currentMonth = today.getMonth() + 1;
                          const isCurrentMonth = (selectedYear === currentYear && selectedMonth === currentMonth);
                          
                          if (isCurrentMonth) {
                            const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                            const currentDay = today.getDate();
                            const daysRemaining = Math.max(0, lastDayOfMonth - currentDay);
                            return `$${reported.toLocaleString()} achieved - ${daysRemaining} days remaining`;
                          } else {
                            // For past/future months, just show achieved amount
                            return `$${reported.toLocaleString()} achieved`;
                          }
                        })()}
                        donut={mgaGoalData && mgaGoalData.monthlyAlpGoal && mgaGoalData.reported !== undefined}
                        percentage={(() => {
                          if (!mgaGoalData || !mgaGoalData.monthlyAlpGoal) return 0;
                          const percent = Math.round((mgaGoalData.reported || 0) / mgaGoalData.monthlyAlpGoal * 100);
                          return Math.min(percent, 100); // Cap at 100%
                        })()}
                        donutColor={(() => {
                          if (!mgaGoalData || !mgaGoalData.monthlyAlpGoal) return "#e0e0e0";
                          const percent = (mgaGoalData.reported || 0) / mgaGoalData.monthlyAlpGoal * 100;
                          if (percent === 0) return "#e0e0e0"; // Light gray when no progress yet
                          if (percent >= 100) return "#4caf50"; // Green when complete
                          if (percent >= 75) return "#8bc34a"; // Light green when close
                          if (percent >= 50) return "#ff9800"; // Orange when halfway
                          if (percent >= 25) return "#ff5722"; // Red-orange when behind
                          return "#f44336"; // Red when far behind
                        })()}
                        trend={mgaGoalData?.trend}
                        trendValue={mgaGoalData?.trendValue}
                        icon="🎯"
                        color="#28a745"
                        textColor="white"
                        backgroundIconColor="rgba(40, 167, 69, 0.15)"
                        actions={!isPastMonth && isEditing ? [
                          {
                            label: 'Save Team Goal',
                            onClick: handleSaveMgaGoal,
                            disabled: !mgaGoal || loading,
                            variant: 'primary'
                          }
                        ] : []}
                      />
                    </div>
                  );
                }
                
                // For other roles or no role, don't show any team goal cards
                return null;
              })()}
            </div>

            <ActionBar
              selectedCount={0}
              totalCount={teamRows.length}
              entityName="team members"
            >
              {String(user?.clname || '').toUpperCase() === 'RGA' && (
                <button
                  type="button"
                  className={`btn btn-outline ${mgaOnly ? 'active' : ''}`}
                  onClick={() => setMgaOnly(prev => !prev)}
                  title="Toggle MGA-only view"
                >
                  {mgaOnly ? 'Show All' : 'MGA Only'}
                </button>
              )}
            </ActionBar>

            <div className="goal-cards-section" style={{ position: 'relative' }}>
            <DataTable
              columns={[
                { 
                  Header: 'Role', 
                  accessor: 'role', 
                  width: 70,
                  minWidth: 70,
                  Cell: ({ value, row }) => {
                    if (row.original.isInactiveHeader) {
                      return (
                        <div 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowInactiveAgents(!showInactiveAgents);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: '#666',
                            fontWeight: '500',
                            width: '100%',
                            height: '100%',
                            padding: '8px 4px'
                          }}
                          title={showInactiveAgents ? 'Click to collapse inactive agents' : 'Click to expand inactive agents'}
                        >
                          <span style={{
                            marginRight: '6px',
                            transform: showInactiveAgents ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            fontSize: '10px'
                          }}>
                            ▶
                          </span>
                        </div>
                      );
                    }
                    if (row.original.isInactiveAgent) {
                      return (
                        <span className="user-role-badge inactive-badge" style={{...getRoleBadgeStyle(value), opacity: 0.6}}>
                          {value}
                        </span>
                      );
                    }
                    return (
                      <span className="user-role-badge" style={getRoleBadgeStyle(value)}>{value}</span>
                    );
                  }
                },
                { 
                  Header: 'Name', 
                  accessor: 'name', 
                  width: 200, 
                  minWidth: 160,
                  Cell: ({ value, row }) => {
                    if (row.original.isInactiveHeader) {
                      return (
                        <div 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowInactiveAgents(!showInactiveAgents);
                          }}
                          style={{
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: '#666',
                            fontWeight: '500',
                            padding: '8px 12px',
                            borderRadius: '4px',
                            backgroundColor: '#f5f5f5',
                            border: '1px solid #e0e0e0',
                            width: '100%',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                          title={showInactiveAgents ? 'Click to collapse inactive agents' : 'Click to expand inactive agents'}
                        >
                          <span>{value}</span>
                          <span style={{
                            fontSize: '12px',
                            color: '#999',
                            marginLeft: '8px'
                          }}>
                            {showInactiveAgents ? 'Click to collapse' : 'Click to expand'}
                          </span>
                        </div>
                      );
                    }
                    if (row.original.isInactiveAgent) {
                      return <span style={{ color: '#999' }}>{value}</span>;
                    }
                    return <span>{value}</span>;
                  }
                },
                { 
                  Header: 'Goal (ALP)', accessor: 'monthlyAlpGoal', width: 140, minWidth: 120, type: 'number',
                  Cell: ({ value, row }) => {
                    if (row.original.isInactiveHeader) return '';
                    const formatted = value ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) : '';
                    return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{formatted}</span> : formatted;
                  }
                },
                { 
                  Header: 'Reported (ALP)', accessor: 'reportedAlp', width: 150, minWidth: 130, type: 'number',
                  Cell: ({ value, row }) => {
                    if (row.original.isInactiveHeader) return '';
                    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
                    return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{formatted}</span> : formatted;
                  }
                },
                { 
                  Header: 'Remaining (ALP)', accessor: 'remainingAlp', width: 160, minWidth: 140, type: 'number',
                  Cell: ({ value, row }) => {
                    if (row.original.isInactiveHeader) return '';
                    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
                    return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{formatted}</span> : formatted;
                  }
                },
                { 
                  Header: 'Working Days', accessor: 'workingDaysCount', width: 130, minWidth: 120, type: 'number',
                  Cell: ({ value, row }) => {
                    if (row.original.isInactiveHeader) return '';
                    return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value}</span> : value;
                  }
                },
                { 
                  Header: 'Daily Calls', accessor: 'dailyCallsNeeded', width: 110, minWidth: 100, type: 'number',
                  Cell: ({ value, row }) => {
                    if (row.original.isInactiveHeader) return '';
                    return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value}</span> : value;
                  }
                },
                { 
                  Header: 'Daily Appts', accessor: 'dailyApptsNeeded', width: 110, minWidth: 100, type: 'number',
                  Cell: ({ value, row }) => {
                    if (row.original.isInactiveHeader) return '';
                    return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value}</span> : value;
                  }
                },
                { 
                  Header: 'Daily Sits', accessor: 'dailySitsNeeded', width: 110, minWidth: 100, type: 'number',
                  Cell: ({ value, row }) => {
                    if (row.original.isInactiveHeader) return '';
                    return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value}</span> : value;
                  }
                },
                { 
                  Header: 'Daily Sales', accessor: 'dailySalesNeeded', width: 110, minWidth: 100, type: 'number',
                  Cell: ({ value, row }) => {
                    if (row.original.isInactiveHeader) return '';
                    return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value}</span> : value;
                  }
                },
                { 
                  Header: 'Daily ALP', accessor: 'dailyAlpNeeded', width: 120, minWidth: 110, type: 'number',
                  Cell: ({ value, row }) => {
                    if (row.original.isInactiveHeader) return '';
                    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
                    return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{formatted}</span> : formatted;
                  }
                },
                { 
                  Header: 'Rate Source', accessor: 'rateSource', width: 120, minWidth: 100,
                  Cell: ({ value, row }) => {
                    if (row.original.isInactiveHeader) return '';
                    return row.original.isInactiveAgent ? <span style={{ color: '#999' }}>{value}</span> : value;
                  }
                }
              ]}
              data={teamRows}
              disablePagination={true}
              showActionBar={false}
              disableCellEditing={true}
              showTotals={true}
              totalsPosition="bottom"
              totalsColumns={[
                'monthlyAlpGoal','reportedAlp','remainingAlp','workingDaysCount',
                'dailyCallsNeeded','dailyApptsNeeded','dailySitsNeeded','dailySalesNeeded','dailyAlpNeeded'
              ]}
              totalsLabel="Team Totals"
              totalsLabelColumn="name"
              bandedRows={true}
              allowTableOverflow={true}
              enableRowContextMenu={true}
              getRowContextMenuOptions={(row) => {
                // No context menu for the inactive header row
                if (row.isInactiveHeader) return [];
                
                // Different context menu for inactive agents
                if (row.isInactiveAgent) {
                  return [
                    {
                      label: 'Reactivate Manager',
                      icon: <FiUserMinus />,
                      onClick: () => handleReactivateManager(row.id, row.name),
                      className: 'context-menu-success'
                    }
                  ];
                }
                
                // Regular context menu for active agents
                return getTeamRowContextMenuOptions(row);
              }}
            />
            {(teamLoading || loading) && (
              <OverlaySpinner text="Loading team goals..." />
            )}
            </div>
          </>
        ) : (
        <>
        <div className="goal-cards-section" style={{ position: 'relative' }}>
          {/* Personal View - Show only Personal Goal */}
          {viewScope === 'personal' && (
            <Card
              title="Monthly ALP Goal"
              value={isEditing ? (
                <input
                  type="number"
                  value={monthlyAlpGoal}
                  onChange={(e) => setMonthlyAlpGoal(e.target.value)}
                  placeholder="Enter goal"
                  disabled={isPastMonth}
                  className="card-input"
                  style={{ 
                    background: 'transparent',
                    border: '2px solid var(--primary-color)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: 'var(--text-primary)',
                    textAlign: 'center',
                    width: '100%',
                    maxWidth: '200px'
                  }}
                />
              ) : (monthlyAlpGoal ? formatCurrency(monthlyAlpGoal) : "Set Goal")}
              subText={(() => {
                if (!breakdown) return 'Configure your monthly target';
                
                if (breakdown.isAdjusted) {
                  const hasProgress = breakdown.alpAchievedSoFar > 0;
                  const daysText = `${breakdown.workingDaysRemaining} days left`;
                  
                  if (hasProgress) {
                    const progressPercent = breakdown.monthly.alp > 0 ? Math.round((breakdown.alpAchievedSoFar / breakdown.monthly.alp) * 100) : 0;
                    return `${formatCurrency(breakdown.alpAchievedSoFar)} achieved (${progressPercent}%) • ${daysText}`;
                  }
                  
                  return daysText;
                }
                
                return `${breakdown.daily.calls} calls/day across ${breakdown.workingDays} working days`;
              })()}
              donut={monthlyAlpGoal && breakdown && breakdown.isAdjusted}
              percentage={(() => {
                if (!monthlyAlpGoal || !breakdown || !breakdown.isAdjusted) return 0;
                const percent = breakdown.monthly.alp > 0 ? Math.round((breakdown.alpAchievedSoFar / breakdown.monthly.alp) * 100) : 0;
                return Math.min(percent, 100); // Cap at 100%
              })()}
              donutColor={(() => {
                if (!breakdown || !breakdown.isAdjusted) return "#4caf50";
                const percent = breakdown.monthly.alp > 0 ? (breakdown.alpAchievedSoFar / breakdown.monthly.alp) * 100 : 0;
                if (percent === 0) return "#e0e0e0"; // Light gray when no progress yet
                if (percent >= 100) return "#4caf50"; // Green when complete
                if (percent >= 75) return "#8bc34a"; // Light green when close
                if (percent >= 50) return "#ff9800"; // Orange when halfway
                if (percent >= 25) return "#ff5722"; // Red-orange when behind
                return "#f44336"; // Red when far behind
              })()}
              backgroundIcon={FiTarget}
              backgroundIconSize={60}
              backgroundIconPosition="bottom-right"
              backgroundIconColor="rgba(76, 175, 80, 0.15)"
            />
          )}

          {/* Team View - Show MGA and RGA Team Goals */}
          {viewScope === 'team' && (
            <>
              {/* MGA Goal Card */}
              <Card
                title="MGA Team Goal"
                value={isEditing ? (
                  <input
                    type="number"
                    value={mgaGoal}
                    onChange={(e) => setMgaGoal(e.target.value)}
                    placeholder="Enter MGA goal"
                    disabled={isPastMonth}
                    className="card-input"
                    style={{ 
                      background: 'transparent',
                      border: '2px solid var(--info-color)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                      width: '100%',
                      maxWidth: '200px'
                    }}
                  />
                ) : (mgaGoal ? formatCurrency(mgaGoal) : "Set MGA Goal")}
                subText={mgaGoal ? `Monthly MGA team target` : 'Set your MGA team goal'}
                backgroundIcon={FiTrendingUp}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(23, 162, 184, 0.15)"
                actions={isEditing ? (
                  <div className="card-actions">
                    <button 
                      className="btn btn-info btn-icon"
                      onClick={handleSaveMgaGoal}
                      disabled={loading || !mgaGoal}
                      title="Save MGA Goal"
                    >
                      <FiSave />
                    </button>
                  </div>
                ) : null}
              />

              {/* RGA Goal Card */}
              <Card
                title="RGA Team Goal"
                value={isEditing ? (
                  <input
                    type="number"
                    value={rgaGoal}
                    onChange={(e) => setRgaGoal(e.target.value)}
                    placeholder="Enter RGA goal"
                    disabled={isPastMonth}
                    className="card-input"
                    style={{ 
                      background: 'transparent',
                      border: '2px solid var(--warning-color)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                      width: '100%',
                      maxWidth: '200px'
                    }}
                  />
                ) : (rgaGoal ? formatCurrency(rgaGoal) : "Set RGA Goal")}
                subText={rgaGoal ? `Monthly RGA team target` : 'Set your RGA team goal'}
                backgroundIcon={FiBarChart2}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor="rgba(255, 193, 7, 0.15)"
                actions={isEditing ? (
                  <div className="card-actions">
                    <button 
                      className="btn btn-warning btn-icon"
                      onClick={handleSaveRgaGoal}
                      disabled={loading || !rgaGoal}
                      title="Save RGA Goal"
                    >
                      <FiSave />
                    </button>
                  </div>
                ) : null}
              />
            </>
          )}

          </div>

        {/* Rate Source Configuration - shown only when editing personal goals */}
        {isEditing && !isPastMonth && viewScope === 'personal' && (
          <div className="rate-config-section">
            <h3>Conversion Rate Settings</h3>
            <div className="rate-source-options">
              <label className="radio-option">
                <input
                  type="radio"
                  value="agency"
                  checked={rateSource === 'agency'}
                  onChange={(e) => setRateSource(e.target.value)}
                />
                <span>Agency Standards</span>
                <div className="rate-preview">
                  {Math.round(agencyRates.callsToAppts)} calls per appt, 
                  {Math.round(agencyRates.apptsToSits * 100)}% show ratio, 
                  {Math.round(agencyRates.sitsToSales * 100)}% close ratio
                </div>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  value="custom"
                  checked={rateSource === 'custom'}
                  onChange={(e) => setRateSource(e.target.value)}
                />
                <span>Custom Rates</span>
              </label>
            </div>

            {rateSource === 'custom' && (
              <div className="custom-rates-section">
                <h4>Custom Conversion Rates</h4>
                <div className="custom-rates-grid">
                  <div className="rate-input-group">
                    <label>Calls per Appointment</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="1000"
                      value={customRates.callsToAppts}
                      onChange={(e) => setCustomRates({
                        ...customRates,
                        callsToAppts: parseFloat(e.target.value) || 1
                      })}
                      className="rate-input"
                    />
                  </div>
                  <div className="rate-input-group">
                    <label>Show Ratio (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={customRates.apptsToSits * 100}
                      onChange={(e) => setCustomRates({
                        ...customRates,
                        apptsToSits: parseFloat(e.target.value) / 100 || 0.25
                      })}
                      className="rate-input"
                    />
                  </div>
                  <div className="rate-input-group">
                    <label>Close Ratio (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={customRates.sitsToSales * 100}
                      onChange={(e) => setCustomRates({
                        ...customRates,
                        sitsToSales: parseFloat(e.target.value) / 100 || 0.33
                      })}
                      className="rate-input"
                    />
                  </div>
                  <div className="rate-input-group">
                    <label>Average ALP per Sale ($)</label>
                    <input
                      type="number"
                      step="50"
                      min="0"
                      value={customRates.salesToAlp}
                      onChange={(e) => setCustomRates({
                        ...customRates,
                        salesToAlp: parseFloat(e.target.value) || 1200
                      })}
                      className="rate-input"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Working Days Action Bar */}
        {viewScope === 'personal' && (
        <ActionBar
          selectedCount={0}
          totalCount={workingDays.length}
          entityName="working days"
        >
          {/* Weekly view toggle button (hidden when editing) */}
          {!isEditing && (
            <button
              type="button"
              className={`btn btn-outline view-toggle ${viewMode === 'weekly' ? 'active' : ''}`}
              onClick={() => setViewMode(viewMode === 'calendar' ? 'weekly' : 'calendar')}
            >
              {viewMode === 'calendar' ? (
                <>
                  <FiBarChart2 size={16} />
                  <span>Weekly View</span>
                </>
              ) : (
                <>
                  <FiGrid size={16} />
                  <span>Calendar View</span>
                </>
              )}
            </button>
          )}
          
          {(isEditing && !isPastMonth) && (
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const weekdays = generateWorkingDays();
                  setWorkingDays(weekdays);
                  setUserHasClearedDays(false);
                }}
              >
                Select All Weekdays
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setWorkingDays([]);
                  setUserHasClearedDays(true);
                }}
              >
                Clear All
              </button>
            </>
          )}
        </ActionBar>
        )}

        {/* Calendar Section */}
        {viewScope === 'personal' && (
        <div className="calendar-section">
          <div className="calendar-container">
            <CalendarView
              year={selectedYear}
              month={selectedMonth}
              workingDays={workingDays}
              onWorkingDaysChange={setWorkingDays}
              isEditing={isEditing && !isPastMonth}
              breakdown={breakdown}
              activityByDate={activityByDate}
              viewMode={viewMode}
              isMobile={isMobile}
              showWeeklyToggle={showWeeklyToggle}
              dateOverride={dateOverride}
            />
          </div>
        </div>
        )}

        {/* Goal Breakdown */}
        {viewScope === 'personal' && breakdown && (
          <div className="goal-breakdown-section">
            <h3>
              <FiTrendingUp className="section-icon" />
              Goal Breakdown
            </h3>
            
            <div className="breakdown-summary">
              {breakdown.isAdjusted ? (
                <>
                  <p>
                    <strong>🎯 Adjusted Daily Targets</strong> - Based on your progress so far ({breakdown.workingDaysCompleted} days completed):
                  </p>
                  <p>
                    You've achieved <strong>{formatCurrency(breakdown.alpAchievedSoFar)} ALP</strong> so far. 
                    To reach your <strong>{formatCurrency(breakdown.monthly.alp)} goal</strong>, 
                    you need <strong>{formatCurrency(breakdown.remainingAlpNeeded)} more ALP</strong> over your remaining <strong>{breakdown.workingDaysRemaining} working days</strong>.
                  </p>
                  <p>
                    <strong>New daily target:</strong> <strong>{breakdown.daily.calls} calls per day</strong> 
                    <span className="adjustment-note">
                      (was {breakdown.originalDaily.calls} calls originally)
                    </span>
                  </p>
                </>
              ) : (
              <p>
                To reach your <strong>{formatCurrency(breakdown.monthly.alp)} ALP goal</strong> in {monthNames[selectedMonth - 1]}, 
                you need to average <strong>{breakdown.daily.calls} calls per day</strong> over your {breakdown.workingDays} selected working days.
              </p>
              )}
              <div className="monthly-summary">
                <div className="summary-item">
                  <span className="summary-label">Daily Calls:</span>
                  <span className="summary-value">{breakdown.daily.calls}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Daily Appointments:</span>
                  <span className="summary-value">{breakdown.daily.appts}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Daily Sits:</span>
                  <span className="summary-value">{breakdown.daily.sits}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Daily Sales:</span>
                  <span className="summary-value">{breakdown.daily.sales}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Daily ALP:</span>
                  <span className="summary-value">{formatCurrency(breakdown.daily.alp)}</span>
                </div>
              </div>
            </div>
          </div>
        )}



        {viewScope === 'personal' && loading && (
          <OverlaySpinner text="Loading goals..." />
        )}
        </>
        )}
      </div>
    </div>
  );
};

// Calendar View Component
const CalendarView = ({ year, month, workingDays, onWorkingDaysChange, isEditing, breakdown, activityByDate, viewMode, isMobile, showWeeklyToggle, dateOverride = null }) => {
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayDetails, setShowDayDetails] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [modalTransform, setModalTransform] = useState(0);
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value) => {
    return Math.round(value);
  };


  // Determine date range based on date override or default month
  let rangeStartDate, rangeEndDate, displayStartDate, displayEndDate;
  let scheduleType = 'mon-sun'; // Default schedule type
  
  if (dateOverride) {
    // Use date override boundaries and schedule type
    rangeStartDate = new Date(dateOverride.start_date + 'T00:00:00');
    rangeEndDate = new Date(dateOverride.end_date + 'T00:00:00');
    scheduleType = dateOverride.schedule_type || 'mon-sun';
    displayStartDate = rangeStartDate;
    displayEndDate = rangeEndDate;
    
  } else {
    // Use default month boundaries and include previous month days for calendar display
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Compute previous month info
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    
    rangeStartDate = new Date(year, month - 1, 1);
    rangeEndDate = new Date(year, month, 0);
    
    // Determine week start day based on schedule type
    const sundayBasedDay = firstDay.getDay();
    let weekStartBasedDay;
    
    if (scheduleType === 'wed-tue') {
      // Convert Sunday-based day (0=Sunday) to Wednesday-based (0=Wednesday)
      weekStartBasedDay = sundayBasedDay >= 3 ? sundayBasedDay - 3 : sundayBasedDay + 4;
    } else {
      // Convert Sunday-based day (0=Sunday) to Monday-based (0=Monday)
      weekStartBasedDay = sundayBasedDay === 0 ? 6 : sundayBasedDay - 1;
    }
    
    // For display, include previous month days to fill the first week
    if (weekStartBasedDay > 0) {
      const startDayPrev = daysInPrevMonth - (weekStartBasedDay - 1);
      displayStartDate = new Date(prevYear, prevMonth - 1, startDayPrev);
    } else {
      displayStartDate = rangeStartDate;
    }
    displayEndDate = rangeEndDate;
    
  }

  // Get current date info for highlighting
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;

  // Create calendar grid
  const calendarDays = [];
  
  // Generate calendar days based on display range
  const currentDate = new Date(displayStartDate);
  let weekIndex = 0;
  
  while (currentDate <= displayEndDate) {
    const dateString = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isWorkingDay = workingDays.includes(dateString);
    const isCurrentDay = today.toISOString().split('T')[0] === dateString;
    
    // Determine if this day is in the target month/range
    const isInTargetRange = currentDate >= rangeStartDate && currentDate <= rangeEndDate;
    const isPrevMonth = !dateOverride && currentDate < rangeStartDate;
    
    // Calculate week index for calendar layout
    const displayStart = new Date(displayStartDate);
    const daysDiff = Math.floor((currentDate - displayStart) / (1000 * 60 * 60 * 24));
    const startDayOfWeek = displayStart.getDay();
    
    let weekStartBasedStartDay;
    if (scheduleType === 'wed-tue') {
      // Convert Sunday-based day (0=Sunday) to Wednesday-based (0=Wednesday)
      weekStartBasedStartDay = startDayOfWeek >= 3 ? startDayOfWeek - 3 : startDayOfWeek + 4;
    } else {
      // Convert Sunday-based day (0=Sunday) to Monday-based (0=Monday)
      weekStartBasedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    }
    
    weekIndex = Math.floor((daysDiff + weekStartBasedStartDay) / 7);
    
    calendarDays.push({
      day: currentDate.getDate(),
      date: dateString,
      isWeekday,
      isWorkingDay,
      isPrevMonth: isPrevMonth,
      isInTargetRange: isInTargetRange,
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1,
      weekIndex,
      isCurrentDay,
      isCurrentWeek: isCurrentMonth && Math.abs(today - currentDate) < 7 * 24 * 60 * 60 * 1000
    });
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Define getDailyGoals function before using it
  const getDailyGoals = () => {
    if (!breakdown || workingDays.length === 0) return null;
    
    return {
      calls: breakdown.daily.calls,
      appts: breakdown.daily.appts,
      sits: breakdown.daily.sits,
      sales: breakdown.daily.sales,
      alp: breakdown.daily.alp
    };
  };

  // Group days into weeks for rendering
  const weeks = [];
  let currentWeekDays = [];
  
  calendarDays.forEach((dayData, index) => {
    currentWeekDays.push(dayData);
    
    // If we have 7 days or this is the last day, complete the week
    if (currentWeekDays.length === 7 || index === calendarDays.length - 1) {
      // Fill incomplete weeks with null for styling
      while (currentWeekDays.length < 7) {
        currentWeekDays.push(null);
      }
      
      // Calculate weekly totals for this week
      const weeklyTotals = currentWeekDays.reduce((totals, dayData) => {
        if (!dayData || !dayData.isWorkingDay) return totals;
        
        const actual = activityByDate[dayData.date];
        const goals = getDailyGoals();
        
        if (actual) {
          totals.calls += actual.calls || 0;
          totals.appts += actual.appts || 0;
          totals.sits += actual.sits || 0;
          totals.sales += actual.sales || 0;
          totals.alp += actual.alp || 0;
        }
        
        if (goals) {
          totals.goalCalls += goals.calls || 0;
          totals.goalAppts += goals.appts || 0;
          totals.goalSits += goals.sits || 0;
          totals.goalSales += goals.sales || 0;
          totals.goalAlp += goals.alp || 0;
        }
        
        return totals;
      }, {
        calls: 0, appts: 0, sits: 0, sales: 0, alp: 0,
        goalCalls: 0, goalAppts: 0, goalSits: 0, goalSales: 0, goalAlp: 0
      });
      
      weeks.push({
        days: [...currentWeekDays],
        weeklyTotals,
        isCurrentWeek: currentWeekDays.some(day => day?.isCurrentWeek)
      });
      
      currentWeekDays = [];
    }
  });

  const handleDayClick = (dayData) => {
    if (!dayData) return;

    // If editing (mobile or desktop), handle day selection
    if (isEditing) {
      if (dayData.isWorkingDay) {
        // Remove from working days
        onWorkingDaysChange(workingDays.filter(d => d !== dayData.date));
      } else {
        // Add to working days (any day can be selected)
        onWorkingDaysChange([...workingDays, dayData.date]);
      }
      return;
    }

    // If not editing and on mobile, show day details modal (any day)
    if (isMobile) {
      setSelectedDay(dayData);
      setShowDayDetails(true);
      return;
    }
  };

  const handleCloseDayDetails = () => {
    setShowDayDetails(false);
    setSelectedDay(null);
    setModalTransform(0);
  };

  // Touch handlers for swipe-to-dismiss on mobile
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setTouchStartY(touch.clientY);
  };

  const handleTouchMove = (e) => {
    if (!isMobile) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartY;
    
    // Only allow downward swipes (positive deltaY)
    if (deltaY > 0) {
      setModalTransform(deltaY);
      // Add resistance effect
      const resistance = Math.min(deltaY / 3, 100);
      setModalTransform(resistance);
    }
  };

  const handleTouchEnd = (e) => {
    if (!isMobile) return;

    const touch = e.changedTouches[0];
    const deltaY = touch.clientY - touchStartY;
    
    // If swiped down more than 100px, close the modal
    if (deltaY > 100) {
      handleCloseDayDetails();
    } else {
      // Snap back to original position
      setModalTransform(0);
    }
  };

  const handleToggleWorkingDay = (dayData) => {
    if (!isEditing || !dayData) return;

    if (dayData.isWorkingDay) {
      onWorkingDaysChange(workingDays.filter(d => d !== dayData.date));
    } else {
      onWorkingDaysChange([...workingDays, dayData.date]);
    }
    
    // Update selected day data
    setSelectedDay({
      ...dayData,
      isWorkingDay: !dayData.isWorkingDay
    });
  };

  const dailyGoals = getDailyGoals();

  // Set day names based on schedule type
  const dayNames = scheduleType === 'wed-tue' 
    ? ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const todayMidnight = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

  // Weekly View Component
  const WeeklyView = () => (
    <div className="weekly-view">
      <div className="weekly-header">
        <div className="weekly-title">Weekly Totals</div>
        <div className="weekly-subtitle">{new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
      </div>
      
      <div className="weekly-table">
        <div className="weekly-table-header">
          <div className="weekly-table-cell">Week</div>
          <div className="weekly-table-cell">Planned</div>
          <div className="weekly-table-cell">Reported</div>
          <div className="weekly-table-cell">Remaining</div>
        </div>
        
        {weeks.map((week, weekIndex) => {
          return (
            <div key={weekIndex} className={`weekly-table-row ${week.isCurrentWeek ? 'current-week' : ''}`}>
              <div className="weekly-table-cell week-label">
                <div className="week-number">Week {weekIndex + 1}</div>
                <div className="week-dates">
                  {week.days[0] && week.days[6] ? 
                    `${week.days[0].day} - ${week.days[6].day}` : 
                    'Partial Week'
                  }
                </div>
              </div>
              <div className="weekly-table-cell planned">
                <div className="weekly-metrics-group">
                  <div className="weekly-metric-item">
                    <span className="metric-value">{week.weeklyTotals.goalCalls || 0}</span>
                    <span className="metric-label">calls</span>
                  </div>
                  <div className="weekly-metric-item">
                    <span className="metric-value">{week.weeklyTotals.goalAppts || 0}</span>
                    <span className="metric-label">appts</span>
                  </div>
                  <div className="weekly-metric-item">
                    <span className="metric-value">{week.weeklyTotals.goalSits || 0}</span>
                    <span className="metric-label">sits</span>
                  </div>
                  <div className="weekly-metric-item">
                    <span className="metric-value">{week.weeklyTotals.goalSales || 0}</span>
                    <span className="metric-label">sales</span>
                  </div>
                  <div className="weekly-metric-item currency">
                    <span className="metric-value">{formatCurrency(week.weeklyTotals.goalAlp || 0)}</span>
                    <span className="metric-label">ALP</span>
                  </div>
                </div>
              </div>
              <div className="weekly-table-cell reported">
                <div className="weekly-metrics-group">
                  <div className="weekly-metric-item">
                    <span className="metric-value">{week.weeklyTotals.calls || 0}</span>
                    <span className="metric-label">calls</span>
                  </div>
                  <div className="weekly-metric-item">
                    <span className="metric-value">{week.weeklyTotals.appts || 0}</span>
                    <span className="metric-label">appts</span>
                  </div>
                  <div className="weekly-metric-item">
                    <span className="metric-value">{week.weeklyTotals.sits || 0}</span>
                    <span className="metric-label">sits</span>
                  </div>
                  <div className="weekly-metric-item">
                    <span className="metric-value">{week.weeklyTotals.sales || 0}</span>
                    <span className="metric-label">sales</span>
                  </div>
                  <div className="weekly-metric-item currency">
                    <span className="metric-value">{formatCurrency(week.weeklyTotals.alp || 0)}</span>
                    <span className="metric-label">ALP</span>
                  </div>
                </div>
              </div>
              <div className="weekly-table-cell remaining">
                <div className="weekly-metrics-group">
                  <div className="weekly-metric-item">
                    <span className="metric-value">{Math.max(0, (week.weeklyTotals.goalCalls || 0) - (week.weeklyTotals.calls || 0))}</span>
                    <span className="metric-label">calls</span>
                  </div>
                  <div className="weekly-metric-item">
                    <span className="metric-value">{Math.max(0, (week.weeklyTotals.goalAppts || 0) - (week.weeklyTotals.appts || 0))}</span>
                    <span className="metric-label">appts</span>
                  </div>
                  <div className="weekly-metric-item">
                    <span className="metric-value">{Math.max(0, (week.weeklyTotals.goalSits || 0) - (week.weeklyTotals.sits || 0))}</span>
                    <span className="metric-label">sits</span>
                  </div>
                  <div className="weekly-metric-item">
                    <span className="metric-value">{Math.max(0, (week.weeklyTotals.goalSales || 0) - (week.weeklyTotals.sales || 0))}</span>
                    <span className="metric-label">sales</span>
                  </div>
                  <div className="weekly-metric-item currency">
                    <span className="metric-value">{formatCurrency(Math.max(0, (week.weeklyTotals.goalAlp || 0) - (week.weeklyTotals.alp || 0)))}</span>
                    <span className="metric-label">ALP</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render weekly view if viewMode is 'weekly'
  if (viewMode === 'weekly') {
    return <WeeklyView />;
  }

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        {dayNames.map(dayName => (
          <div key={dayName} className="calendar-day-header">
            {dayName}
          </div>
        ))}
        <div className="calendar-day-header weekly-summary-header">
          Weekly
        </div>
      </div>
      
      <div className="calendar-grid">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className={`calendar-week ${week.isCurrentWeek ? 'current-week' : ''}`}>
            {/* Render days in the week */}
            {week.days.map((dayData, dayIndex) => {
          const isPastDay = dayData ? (new Date(dayData.date + 'T00:00:00') < todayMidnight) : false;
          const actual = dayData ? activityByDate?.[dayData.date] : null;
          const dailyGoals = getDailyGoals();
          const useActuals = !!actual && isPastDay;
          const noActivity = isPastDay && !actual;
          const isPastWorking = isPastDay && dayData?.isWorkingDay;
          let metrics = null;
              if (dayData) {
          if (isPastDay) {
            if (actual) {
              metrics = {
                calls: actual.calls,
                appts: actual.appts,
                sits: actual.sits,
                sales: actual.sales,
                alp: actual.alp
              };
            } else {
              metrics = { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0 };
            }
          } else if (dayData.isWorkingDay && dailyGoals) {
            metrics = {
              calls: dailyGoals.calls,
              appts: dailyGoals.appts,
              sits: dailyGoals.sits,
              sales: dailyGoals.sales,
              alp: dailyGoals.alp
            };
          }
              }

          return (
            <div
                  key={dayIndex}
              className={`calendar-day ${
                    dayData?.isPrevMonth ? 'prev-month' : ''
                  } ${
                    dayData?.isWorkingDay ? 'working' : 
                    dayData?.isWeekday ? 'weekday' : 'weekend'
                  } ${(!dayData?.isWorkingDay) ? 'non-working' : ''} ${noActivity ? 'no-activity' : ''} ${isPastWorking ? 'past-working' : ''} ${isEditing ? 'editable' : ''} ${useActuals ? 'actuals' : ''} ${dayData?.isCurrentDay ? 'current-day' : ''}`}
              onClick={() => handleDayClick(dayData)}
            >
                  <div className={`day-number ${dayData?.isCurrentDay ? 'current-day-number' : ''}`}>
                    {dayData?.day}
              </div>
              {metrics && (
                <div className={`daily-goals ${useActuals ? 'using-actuals' : ''}`}>
                      {!isMobile ? (
                        /* Desktop view - show all metrics */
                        <div className="desktop-metrics">
                  <div className="goal-item primary">
                    <span className="goal-value">{metrics.calls}</span>
                    <span className="goal-label">calls</span>
                  </div>
                  <div className="goal-item">
                    <span className="goal-value">{metrics.appts}</span>
                    <span className="goal-label">appts</span>
                  </div>
                  <div className="goal-item">
                    <span className="goal-value">{metrics.sits}</span>
                    <span className="goal-label">sits</span>
                  </div>
                  <div className="goal-item">
                    <span className="goal-value">{metrics.sales}</span>
                    <span className="goal-label">sales</span>
                  </div>
                  <div className="goal-item currency">
                    <span className="goal-value">{formatCurrency(metrics.alp)}</span>
                    <span className="goal-label">ALP</span>
                  </div>
                        </div>
                      ) : (
                        /* Mobile view - show primary metric only */
                        <div className="mobile-metrics">
                          <div className="mobile-primary-metric">
                            <span className="mobile-value">{metrics.calls}</span>
                            <span className="mobile-label">calls</span>
                          </div>
                          {metrics.alp > 0 && (
                            <div className="mobile-secondary-metric">
                              <span className="mobile-alp">{formatCurrency(metrics.alp)}</span>
                </div>
              )}
                        </div>
                      )}
                    </div>
                  )}
                  {!dayData?.isWorkingDay && dayData?.isWeekday && isEditing && (
                <div className="day-hint">
                      {dayData?.isPrevMonth ? 'Click to add (prev month)' : 'Click to add'}
                </div>
              )}
            </div>
          );
        })}
            
            {/* Weekly Summary Column */}
            <div className="weekly-summary">
              <div className="weekly-summary-header">Week {weekIndex + 1}</div>
              {!isMobile ? (
                <div className="weekly-metrics">
                  <div className="weekly-item primary">
                    <span className="weekly-value">{week.weeklyTotals.calls}</span>
                    <span className="weekly-label">calls</span>
                  </div>
                  <div className="weekly-item">
                    <span className="weekly-value">{week.weeklyTotals.appts}</span>
                    <span className="weekly-label">appts</span>
                  </div>
                  <div className="weekly-item">
                    <span className="weekly-value">{week.weeklyTotals.sits}</span>
                    <span className="weekly-label">sits</span>
                  </div>
                  <div className="weekly-item">
                    <span className="weekly-value">{week.weeklyTotals.sales}</span>
                    <span className="weekly-label">sales</span>
                  </div>
                  <div className="weekly-item currency">
                    <span className="weekly-value">{formatCurrency(week.weeklyTotals.alp)}</span>
                    <span className="weekly-label">ALP</span>
                  </div>
                </div>
              ) : (
                <div className="weekly-metrics-mobile">
                  <div className="weekly-primary">
                    <span className="weekly-mobile-value">{week.weeklyTotals.calls}</span>
                    <span className="weekly-mobile-label">calls</span>
                  </div>
                  {week.weeklyTotals.alp > 0 && (
                    <div className="weekly-secondary">
                      <span className="weekly-mobile-alp">{formatCurrency(week.weeklyTotals.alp)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Mobile Day Details Modal */}
      {showDayDetails && selectedDay && (
        <div className="day-details-overlay" onClick={handleCloseDayDetails}>
          <div 
            className="day-details-modal" 
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              transform: `translateY(${modalTransform}px)`,
              transition: modalTransform === 0 ? 'transform 0.3s ease-out' : 'none'
            }}
          >
            <div className="day-details-header">
              <h3>
                {selectedDay.isPrevMonth ? 
                  `${selectedDay.month === 12 ? 'Dec' : new Date(selectedDay.year, selectedDay.month - 1).toLocaleDateString('en-US', { month: 'short' })} ${selectedDay.day}` :
                  `${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' })} ${selectedDay.day}`
                }
                {selectedDay.isPrevMonth && ` (${selectedDay.year})`}
              </h3>
              <button className="close-modal" onClick={handleCloseDayDetails}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="day-details-content">
              {selectedDay.isWorkingDay && (() => {
                const isPastDay = new Date(selectedDay.date + 'T00:00:00') < todayMidnight;
                const actual = activityByDate?.[selectedDay.date];
                const dailyGoals = getDailyGoals();
                const hasActual = !!actual && isPastDay;
                
                if (hasActual && dailyGoals) {
                  // Show planned vs actual comparison for past days with data
                  return (
                    <div className="day-metrics">
                      <div className="metrics-header goals">
                        <span>Planned vs Actual Results</span>
            </div>
                      <div className="metrics-comparison-grid">
                        <div className="metric-comparison">
                          <span className="comparison-label">Calls</span>
                          <div className="comparison-values">
                            <div className="comparison-value planned">
                              <div className="comparison-value-header">Planned</div>
                              <div className="comparison-value-number">{dailyGoals.calls}</div>
            </div>
                            <div className="comparison-divider"></div>
                            <div className={`comparison-value actual ${actual.calls === 0 ? 'zero' : ''}`}>
                              <div className="comparison-value-header">Actual</div>
                              <div className="comparison-value-number">{actual.calls}</div>
            </div>
            </div>
          </div>
                        
                        <div className="metric-comparison">
                          <span className="comparison-label">Appointments</span>
                          <div className="comparison-values">
                            <div className="comparison-value planned">
                              <div className="comparison-value-header">Planned</div>
                              <div className="comparison-value-number">{dailyGoals.appts}</div>
                            </div>
                            <div className="comparison-divider"></div>
                            <div className={`comparison-value actual ${actual.appts === 0 ? 'zero' : ''}`}>
                              <div className="comparison-value-header">Actual</div>
                              <div className="comparison-value-number">{actual.appts}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="metric-comparison">
                          <span className="comparison-label">Sits</span>
                          <div className="comparison-values">
                            <div className="comparison-value planned">
                              <div className="comparison-value-header">Planned</div>
                              <div className="comparison-value-number">{dailyGoals.sits}</div>
                            </div>
                            <div className="comparison-divider"></div>
                            <div className={`comparison-value actual ${actual.sits === 0 ? 'zero' : ''}`}>
                              <div className="comparison-value-header">Actual</div>
                              <div className="comparison-value-number">{actual.sits}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="metric-comparison">
                          <span className="comparison-label">Sales</span>
                          <div className="comparison-values">
                            <div className="comparison-value planned">
                              <div className="comparison-value-header">Planned</div>
                              <div className="comparison-value-number">{dailyGoals.sales}</div>
                            </div>
                            <div className="comparison-divider"></div>
                            <div className={`comparison-value actual ${actual.sales === 0 ? 'zero' : ''}`}>
                              <div className="comparison-value-header">Actual</div>
                              <div className="comparison-value-number">{actual.sales}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="metric-comparison alp">
                          <span className="comparison-label">ALP</span>
                          <div className="comparison-values">
                            <div className="comparison-value planned">
                              <div className="comparison-value-header">Planned</div>
                              <div className="comparison-value-number">{formatCurrency(dailyGoals.alp)}</div>
                            </div>
                            <div className="comparison-divider"></div>
                            <div className={`comparison-value actual ${actual.alp === 0 ? 'zero' : ''}`}>
                              <div className="comparison-value-header">Actual</div>
                              <div className="comparison-value-number">{formatCurrency(actual.alp)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  // Show single view for future days or past days without data
                  const metrics = isPastDay ? 
                    (actual || { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0 }) :
                    (dailyGoals || { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0 });
                  const useActuals = !!actual && isPastDay;
                  
                  return (
                    <div className="day-metrics">
                      <div className={`metrics-header ${useActuals ? 'actuals' : 'goals'}`}>
                        <span>{useActuals ? 'Actual Results' : 'Daily Goals'}</span>
                      </div>
                      <div className="metrics-grid">
                        <div className="metric-item">
                          <span className="metric-label">Calls</span>
                          <span className="metric-value">{metrics.calls}</span>
                        </div>
                        <div className="metric-item">
                          <span className="metric-label">Appointments</span>
                          <span className="metric-value">{metrics.appts}</span>
                        </div>
                        <div className="metric-item">
                          <span className="metric-label">Sits</span>
                          <span className="metric-value">{metrics.sits}</span>
                        </div>
                        <div className="metric-item">
                          <span className="metric-label">Sales</span>
                          <span className="metric-value">{metrics.sales}</span>
                        </div>
                        <div className="metric-item alp">
                          <span className="metric-label">ALP</span>
                          <span className="metric-value">{formatCurrency(metrics.alp)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }
              })()}
              
              {!selectedDay.isWorkingDay && (
                <div className={selectedDay.isWeekday ? "non-working-day" : "weekend-day"}>
                  <p>{selectedDay.isWeekday ? "This is not set as a working day." : "Weekend - No goals set by default"}</p>
                  {isEditing && (
                    <button 
                      className="btn btn-primary"
                      onClick={() => handleToggleWorkingDay(selectedDay)}
                    >
                      Add as Working Day
                    </button>
                  )}
                </div>
              )}
              
              {selectedDay.isWorkingDay && isEditing && (
                <div className="day-actions">
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleToggleWorkingDay(selectedDay)}
                  >
                    Remove from Working Days
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {breakdown && (
        <div className="calendar-legend">
 
          
          
          <div className="conversion-rates">
            <h5>Stats Used:</h5>
            <div className="rates-grid">
              <div className="rate-item">
                <span>Calls to Appointment</span>
                <strong>{Math.round(breakdown.rates.callsToAppts)}</strong>
                <small>calls to set</small>
              </div>
              <div className="rate-item">
                <span>Show Ratio</span>
                <strong>{Math.round(breakdown.rates.apptsToSits * 100)}%</strong>
                <small>appointments that sit</small>
              </div>
              <div className="rate-item">
                <span>Close Ratio</span>
                <strong>{Math.round(breakdown.rates.sitsToSales * 100)}%</strong>
                <small>sits that sell</small>
              </div>
              <div className="rate-item">
                <span> ALP per Sale</span>
                <strong>{formatCurrency(breakdown.rates.salesToAlp)}</strong>
                <small>dollars per close</small>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionGoals; 