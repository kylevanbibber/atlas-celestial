import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, luxonLocalizer } from 'react-big-calendar';
import { DateTime } from 'luxon';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { FiTarget, FiTrendingUp, FiCalendar, FiSettings, FiBarChart2, FiGrid, FiX, FiUserMinus } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useHeader } from '../../context/HeaderContext';
import { Button } from '../ui/button';
import api from '../../api';
import Card from '../utils/Card';
import ActionBar from '../utils/ActionBar';
import DataTable from '../utils/DataTable';
import { OverlaySpinner } from '../utils/LoadingSpinner';
import './ProductionGoals.css';
import '../dashboard/DateRangeSelector.css';

// --- Module-level constants & pure helpers ---

const AGENCY_RATES = {
  callsToAppts: 35,
  apptsToSits: 0.25,
  sitsToSales: 0.33,
  salesToAlp: 1200
};

const PROGRESS_COLOR = (pct) => {
  if (pct === 0) return '#e0e0e0';
  if (pct >= 100) return '#4caf50';
  if (pct >= 75) return '#8bc34a';
  if (pct >= 50) return '#ff9800';
  if (pct >= 25) return '#ff5722';
  return '#f44336';
};

const getRoleBadgeStyle = (cl) => {
  const clname = String(cl || '').toUpperCase();
  let backgroundColor = 'lightgrey';
  let border = '2px solid grey';
  switch (clname) {
    case 'SA': backgroundColor = 'rgb(178, 82, 113)'; border = '2px solid rgb(138, 62, 93)'; break;
    case 'GA': backgroundColor = 'rgb(237, 114, 47)'; border = '2px solid rgb(197, 94, 37)'; break;
    case 'MGA': backgroundColor = 'rgb(104, 182, 117)'; border = '2px solid rgb(84, 152, 97)'; break;
    case 'RGA': backgroundColor = '#00558c'; border = '2px solid #004372'; break;
    default: break;
  }
  return {
    backgroundColor, border,
    padding: '2px 4px', borderRadius: '4px', fontSize: '10px',
    color: 'white', fontWeight: 600, letterSpacing: '0.5px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)', display: 'inline-block'
  };
};

// Builds [...activeRows, optional inactive-header + inactive rows]
function buildCombinedRows(activeRows, inactiveRows, showInactive) {
  const rows = [...activeRows];
  if (inactiveRows.length > 0) {
    rows.push({
      id: 'inactive-agents-header',
      isInactiveHeader: true,
      name: `Inactive Agents (${inactiveRows.length})`,
      inactiveCount: inactiveRows.length,
      monthlyAlpGoal: 0, reportedAlp: 0, remainingAlp: 0, workingDaysCount: 0,
      dailyCallsNeeded: 0, dailyApptsNeeded: 0, dailySitsNeeded: 0,
      dailySalesNeeded: 0, dailyAlpNeeded: 0, rateSource: '', role: ''
    });
    if (showInactive) {
      inactiveRows.forEach(r => rows.push({ ...r, isInactiveAgent: true }));
    }
  }
  return rows;
}

// Computes all per-member row fields from a goal + activity data
function buildMemberRow(member, byUserIdMap, goalsByUserId, alpByName, isCurrentMonth, year, month) {
  const goalKey = `${member.id}_personal`;
  const goal = goalsByUserId[goalKey] || null;
  const monthlyGoal = goal?.monthlyAlpGoal ? parseFloat(goal.monthlyAlpGoal) : 0;
  const reportedAlp = alpByName.get(member.name) || 0;
  const remainingAlp = Math.max(0, monthlyGoal - reportedAlp);
  const workingDaysArr = Array.isArray(goal?.workingDays) ? goal.workingDays : [];
  const workingDaysInMonth = workingDaysArr.filter(ds => {
    const d = new Date(ds + 'T00:00:00');
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });
  const workingDaysRemaining = isCurrentMonth
    ? workingDaysInMonth.filter(ds => new Date(ds + 'T00:00:00') >= new Date(new Date().toDateString())).length
    : workingDaysInMonth.length;
  const rates = (goal?.rateSource === 'custom' && goal?.customRates) ? goal.customRates : AGENCY_RATES;
  let effectiveGoal = monthlyGoal;
  let effectiveDays = workingDaysInMonth.length || 1;
  if (isCurrentMonth && workingDaysRemaining > 0) {
    effectiveGoal = remainingAlp;
    effectiveDays = workingDaysRemaining;
  }
  const requiredSales = Math.ceil(effectiveGoal / (rates.salesToAlp || 1200));
  const requiredSits = Math.ceil(requiredSales / (rates.sitsToSales || 0.33));
  const requiredAppts = Math.ceil(requiredSits / (rates.apptsToSits || 0.25));
  const requiredCalls = Math.ceil(requiredAppts * (rates.callsToAppts || 35));
  const d = effectiveDays || 1;
  return {
    id: member.id,
    role: member.role || '',
    name: member.name || '',
    mgaName: byUserIdMap?.get(member.id)?.mga || '',
    rgaName: byUserIdMap?.get(member.id)?.rga || '',
    managerActive: member.managerActive || 'y',
    monthlyAlpGoal: monthlyGoal || '',
    reportedAlp,
    remainingAlp,
    workingDaysCount: workingDaysInMonth.length,
    dailyCallsNeeded: Math.ceil(requiredCalls / d),
    dailyApptsNeeded: Math.ceil(requiredAppts / d),
    dailySitsNeeded: Math.ceil(requiredSits / d),
    dailySalesNeeded: Math.ceil(requiredSales / d),
    dailyAlpNeeded: Math.round(effectiveGoal / d),
    rateSource: goal?.rateSource ? (goal.rateSource === 'custom' ? 'Custom' : 'Agency') : ''
  };
}

// Shared DataTable for both team and agency goal views
const TeamGoalsTable = ({ data, loading, showInactive, onToggleInactive, showRgaColumn,
                          totalsLabel, enableContextMenu, getContextMenuOptions }) => {
  const fmtCur = (v) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(v || 0);

  const inactiveCell = (row, content) => {
    if (row.original.isInactiveHeader) return '';
    return row.original.isInactiveAgent
      ? <span style={{ color: '#999' }}>{content}</span>
      : content;
  };

  const roleCell = ({ value, row }) => {
    if (row.original.isInactiveHeader) {
      return (
        <div
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleInactive(); }}
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '12px',
                   color: '#666', fontWeight: '500', width: '100%', height: '100%', padding: '8px 4px' }}
          title={showInactive ? 'Click to collapse inactive agents' : 'Click to expand inactive agents'}
        >
          <span style={{ marginRight: '6px', fontSize: '10px',
                         transform: showInactive ? 'rotate(90deg)' : 'rotate(0deg)',
                         transition: 'transform 0.2s ease' }}>▶</span>
        </div>
      );
    }
    return (
      <span className="user-role-badge" style={{ ...getRoleBadgeStyle(value), ...(row.original.isInactiveAgent ? { opacity: 0.6 } : {}) }}>
        {value}
      </span>
    );
  };

  const nameCell = ({ value, row }) => {
    if (row.original.isInactiveHeader) {
      return (
        <div
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleInactive(); }}
          style={{ cursor: 'pointer', fontSize: '14px', color: '#666', fontWeight: '500',
                   padding: '8px 12px', borderRadius: '4px', backgroundColor: '#f5f5f5',
                   border: '1px solid #e0e0e0', width: '100%', boxSizing: 'border-box',
                   display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          title={showInactive ? 'Click to collapse inactive agents' : 'Click to expand inactive agents'}
        >
          <span>{value}</span>
          <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
            {showInactive ? 'Click to collapse' : 'Click to expand'}
          </span>
        </div>
      );
    }
    return row.original.isInactiveAgent
      ? <span style={{ color: '#999' }}>{value}</span>
      : <span>{value}</span>;
  };

  const columns = [
    { Header: 'Role', accessor: 'role', width: 70, minWidth: 70, Cell: roleCell },
    { Header: 'Name', accessor: 'name', width: 200, minWidth: 160, Cell: nameCell },
    ...(showRgaColumn ? [{
      Header: 'RGA', accessor: 'rgaName', width: 150, minWidth: 130,
      Cell: ({ value, row }) => inactiveCell(row, value || '-')
    }] : []),
    { Header: 'MGA', accessor: 'mgaName', width: 150, minWidth: 130,
      Cell: ({ value, row }) => inactiveCell(row, value || '-') },
    { Header: 'Goal (ALP)', accessor: 'monthlyAlpGoal', width: 140, minWidth: 120, type: 'number',
      Cell: ({ value, row }) => inactiveCell(row, value ? fmtCur(value) : '') },
    { Header: 'Reported (ALP)', accessor: 'reportedAlp', width: 150, minWidth: 130, type: 'number',
      Cell: ({ value, row }) => inactiveCell(row, fmtCur(value)) },
    { Header: 'Remaining (ALP)', accessor: 'remainingAlp', width: 160, minWidth: 140, type: 'number',
      Cell: ({ value, row }) => inactiveCell(row, fmtCur(value)) },
    { Header: 'Working Days', accessor: 'workingDaysCount', width: 130, minWidth: 120, type: 'number',
      Cell: ({ value, row }) => inactiveCell(row, value) },
    { Header: 'Daily Calls', accessor: 'dailyCallsNeeded', width: 110, minWidth: 100, type: 'number',
      Cell: ({ value, row }) => inactiveCell(row, value) },
    { Header: 'Daily Appts', accessor: 'dailyApptsNeeded', width: 110, minWidth: 100, type: 'number',
      Cell: ({ value, row }) => inactiveCell(row, value) },
    { Header: 'Daily Sits', accessor: 'dailySitsNeeded', width: 110, minWidth: 100, type: 'number',
      Cell: ({ value, row }) => inactiveCell(row, value) },
    { Header: 'Daily Sales', accessor: 'dailySalesNeeded', width: 110, minWidth: 100, type: 'number',
      Cell: ({ value, row }) => inactiveCell(row, value) },
    { Header: 'Daily ALP', accessor: 'dailyAlpNeeded', width: 120, minWidth: 110, type: 'number',
      Cell: ({ value, row }) => inactiveCell(row, fmtCur(value)) },
    { Header: 'Rate Source', accessor: 'rateSource', width: 120, minWidth: 100,
      Cell: ({ value, row }) => inactiveCell(row, value) }
  ];

  const totalsColumns = [
    'monthlyAlpGoal', 'reportedAlp', 'remainingAlp', 'workingDaysCount',
    'dailyCallsNeeded', 'dailyApptsNeeded', 'dailySitsNeeded', 'dailySalesNeeded', 'dailyAlpNeeded'
  ];

  return (
    <div className="goal-cards-section" style={{ position: 'relative' }}>
      <DataTable
        columns={columns}
        data={data}
        disablePagination={true}
        showActionBar={false}
        disableCellEditing={true}
        showTotals={true}
        totalsPosition="bottom"
        totalsColumns={totalsColumns}
        totalsLabel={totalsLabel}
        totalsLabelColumn="name"
        bandedRows={true}
        allowTableOverflow={true}
        enableRowContextMenu={enableContextMenu}
        getRowContextMenuOptions={getContextMenuOptions}
      />
      {loading && <OverlaySpinner text={`Loading ${totalsLabel.replace(' Totals', '').toLowerCase()} goals...`} />}
    </div>
  );
};

// ---

const ProductionGoals = ({ summaryOnly = false, displayPeriod, weekStart, externalViewScope, onBreakdownChange, reloadTrigger, suppressHeader = false, forceEditing = false, onHasChanges, saveTrigger }) => {
  const { user } = useAuth();
  const { setHeaderContent } = useHeader();
  const [isDirty, setIsDirty] = useState(false);
  const isLoadedRef = React.useRef(false);
  const saveGoalRef = React.useRef(null);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
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
      // Mark as loaded so subsequent user edits are tracked as dirty
      isLoadedRef.current = true;
      setIsDirty(false);
      onHasChanges?.(false);
    }
  };

  // Mark the form dirty (only after initial data has loaded)
  const markDirty = useCallback(() => {
    if (!isLoadedRef.current) return;
    setIsDirty(true);
    onHasChanges?.(true);
  }, [onHasChanges]);

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
    return rateSource === 'custom' ? customRates : AGENCY_RATES;
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

  // When in summaryOnly mode, sync the displayed month/year to the activity form's weekStart date
  useEffect(() => {
    if (!summaryOnly || !weekStart) return;
    const d = weekStart instanceof Date ? weekStart : new Date(weekStart);
    setSelectedMonth(d.getMonth() + 1);
    setSelectedYear(d.getFullYear());
  }, [summaryOnly, weekStart]);

  // When in summaryOnly mode, sync viewScope from the wrapper
  useEffect(() => {
    if (!summaryOnly || !externalViewScope) return;
    setViewScope(externalViewScope);
  }, [summaryOnly, externalViewScope]);

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

        const rows = finalMembers
          .map(member => buildMemberRow(member, byUserId, goalsByUserId, alpByName, isCurrentMonth, selectedYear, selectedMonth))
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

        const activeRows = rows.filter(r => r.managerActive === 'y');
        const inactiveRows = rows.filter(r => r.managerActive === 'n');

        setInactiveAgencyRows(inactiveRows);
        setAgencyRowsAll(activeRows);
        setAgencyRows(buildCombinedRows(activeRows, inactiveRows, showInactiveAgencyAgents));
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

        const rows = finalMembers
          .map(member => buildMemberRow(member, byUserId, goalsByUserId, alpByName, isCurrentMonth, selectedYear, selectedMonth))
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

        let activeRows = rows.filter(r => r.managerActive === 'y');
        let inactiveRows = rows.filter(r => r.managerActive === 'n');

        // Filter for SA and GA users to only show directly coded team members
        const userLagnname = user?.lagnname || '';
        if (userRole === 'SA') {
          activeRows = activeRows.filter(r => { const d = byUserId.get(r.id); return d?.sa === userLagnname || r.name === userLagnname; });
          inactiveRows = inactiveRows.filter(r => { const d = byUserId.get(r.id); return d?.sa === userLagnname || r.name === userLagnname; });
        } else if (userRole === 'GA') {
          activeRows = activeRows.filter(r => { const d = byUserId.get(r.id); return d?.ga === userLagnname || r.name === userLagnname; });
          inactiveRows = inactiveRows.filter(r => { const d = byUserId.get(r.id); return d?.ga === userLagnname || r.name === userLagnname; });
        }

        setInactiveTeamRows(inactiveRows);
        setTeamRowsAll(activeRows);

        const filteredActive = (!mgaOnly || userRole !== 'RGA')
          ? activeRows
          : activeRows.filter(r => (r.mgaName && r.mgaName === userLagnname) || r.name === userLagnname);

        setTeamRows(buildCombinedRows(filteredActive, inactiveRows, showInactiveAgents));
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

  // Recompute filtered rows when mgaOnly, inactive toggle, or source rows change
  useEffect(() => {
    if (viewScope !== 'team') return;
    if (!teamRowsAll || teamRowsAll.length === 0) {
      setTeamRows([]);
      return;
    }
    const isRga = String(user?.clname || '').toUpperCase() === 'RGA';
    const filteredActive = (mgaOnly && isRga)
      ? teamRowsAll.filter(r => (r.mgaName && r.mgaName === (user?.lagnname || '')) || r.name === (user?.lagnname || ''))
      : teamRowsAll;
    setTeamRows(buildCombinedRows(filteredActive, inactiveTeamRows, showInactiveAgents));
  }, [mgaOnly, teamRowsAll, viewScope, user?.clname, user?.lagnname, inactiveTeamRows, showInactiveAgents]);

  // Auto-exit edit mode when switching to a past month
  useEffect(() => {
    if (isPastMonth && isEditing) {
      setIsEditing(false);
    }
  }, [isPastMonth, isEditing]);

  // Enter edit mode when parent reveals this component
  useEffect(() => {
    if (forceEditing && !isPastMonth) setIsEditing(true);
  }, [forceEditing]);

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
    if (!monthlyAlpGoal || monthlyAlpGoal <= 0) return null;

    const goal = parseFloat(monthlyAlpGoal);
    if (isNaN(goal) || goal <= 0) return null;

    const rates = getCurrentRates();
    const effectiveWorkingDays = workingDays.length > 0 ? workingDays : generateWorkingDays();
    const numberOfWorkingDays = effectiveWorkingDays.length || 1;
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
      isLoadedRef.current = false; // loadGoalData will reset dirty when it completes
      loadGoalData();
    } catch (error) {
      console.error('Error saving personal goal:', error);
    } finally {
      setLoading(false);
    }
  };

  // Allow parent to trigger save via saveTrigger prop
  useEffect(() => {
    saveGoalRef.current = handleSaveGoal;
  });
  useEffect(() => {
    if (saveTrigger > 0) saveGoalRef.current?.();
  }, [saveTrigger]);

  // Save MGA goal function
  const handleSaveMgaGoal = async (skipLoadingState = false) => {
    if (!user?.userId || !mgaGoal) return;

    try {
      if (!skipLoadingState) setLoading(true);
      const teamWorkingDays = Array.from({ length: new Date(selectedYear, selectedMonth, 0).getDate() }, (_, i) => i + 1);
      
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
        setSaveError(error.response?.data?.message || error.message || 'Error saving MGA team goal');
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
      const teamWorkingDays = Array.from({ length: new Date(selectedYear, selectedMonth, 0).getDate() }, (_, i) => i + 1);
      
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
        setSaveError(error.response?.data?.message || error.message || 'Error saving RGA team goal');
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
      setSaveError(error.response?.data?.message || error.message || 'Error saving team goals');
    } finally {
      setLoading(false);
    }
  };

  // Handle setting user managerActive to inactive
  const handleSetManagerInactive = async (userId, userName) => {
    try {
      const response = await api.post('/auth/setManagerInactive', { userId });
      if (!response.data?.success) {
        setSaveError('Failed to update leader status. Please try again.');
      }
    } catch (error) {
      setSaveError('Error updating leader status. Please try again.');
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
        alert(`${userName} has been reactivated as leader`);
        
        // Refresh the team data by triggering a reload
        // The useEffect will automatically run when dependencies change
        setTeamLoading(true);
        setTimeout(() => setTeamLoading(false), 100); // Trigger re-render
      } else {
        console.error('❌ Failed to reactivate manager:', response.data?.message);
        alert('Failed to reactivate leader status. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error reactivating manager:', error);
      alert('Error reactivating leader status. Please try again.');
    }
  };

  // Get context menu options for team table rows
  const getTeamRowContextMenuOptions = (row) => {
    if (!row || !row.id || !row.name) return [];
    
    return [
      {
        label: 'Set Leader Inactive',
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
    if (summaryOnly) {
      // Sum actual ALP across all days in the month (not just working days)
      const actualMonthAlp = Object.values(activityByDate).reduce((sum, day) => sum + (day?.alp || 0), 0);
      if (result) {
        onBreakdownChange?.({ ...result, actualMonthAlp, _settings: { workingDays, rateSource, customRates } });
      } else {
        onBreakdownChange?.({ actualMonthAlp, _settings: { workingDays, rateSource, customRates } });
      }
    }
  }, [monthlyAlpGoal, workingDays, rateSource, customRates, activityByDate, selectedYear, selectedMonth]);

  // Reload goal data when parent triggers it (e.g., after inline goal save)
  useEffect(() => {
    if (summaryOnly && reloadTrigger > 0) {
      loadGoalData();
    }
  }, [reloadTrigger]);

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
    if (!Array.isArray(agents) || agents.length === 0) return [];
    const normalize = (s) => (s || '').trim();
    const result = [];

    // 1. Add the RGA user first
    const rgaAgent = agents.find(a => normalize(a.lagnname) === normalize(rgaName));
    if (rgaAgent) result.push(rgaAgent.lagnname);

    // 2. Add RGA's MGA team (where mga = RGA user name)
    const rgaMgaTeam = agents.filter(a => normalize(a.mga) === normalize(rgaName));
    if (rgaMgaTeam.length > 0) result.push(...buildHierarchyOrder(rgaMgaTeam));

    // 3. Find other MGAs under this RGA (excluding the RGA user themselves)
    const otherMGAs = agents.filter(a => {
      const role = String(a.clname || '').toUpperCase();
      return role === 'MGA' &&
             normalize(a.rga) === normalize(rgaName) &&
             normalize(a.lagnname) !== normalize(rgaName);
    }).sort((a, b) => normalize(a.lagnname).localeCompare(normalize(b.lagnname)));

    // 4. For each other MGA, add them and their MGA team
    otherMGAs.forEach((mgaAgent) => {
      result.push(mgaAgent.lagnname);
      const mgaTeam = agents.filter(a => normalize(a.mga) === normalize(mgaAgent.lagnname));
      if (mgaTeam.length > 0) result.push(...buildHierarchyOrder(mgaTeam));
    });

    return result;
  };

  // Clear the header when this component owns it (parent handles header content via goals-editor-nav)
  useEffect(() => {
    if (summaryOnly || suppressHeader) return;
    setHeaderContent(null);
    return () => setHeaderContent(null);
  }, [summaryOnly, suppressHeader, setHeaderContent]);

  if (summaryOnly) return null;

  return (
    <div className="production-goals">
      <div className="goals-content">
        {saveError && (
          <div style={{ background: '#ffebee', color: '#c62828', padding: '10px 16px', borderRadius: '6px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{saveError}</span>
            <button onClick={() => setSaveError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontSize: '18px', fontWeight: 'bold', lineHeight: 1 }}>×</button>
          </div>
        )}
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

            <TeamGoalsTable
              data={agencyRows}
              loading={agencyLoading || loading}
              showInactive={showInactiveAgencyAgents}
              onToggleInactive={() => setShowInactiveAgencyAgents(prev => !prev)}
              showRgaColumn={true}
              totalsLabel="Agency Totals"
              enableContextMenu={false}
              getContextMenuOptions={null}
            />
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

            <TeamGoalsTable
              data={teamRows}
              loading={teamLoading || loading}
              showInactive={showInactiveAgents}
              onToggleInactive={() => setShowInactiveAgents(prev => !prev)}
              showRgaColumn={false}
              totalsLabel="Team Totals"
              enableContextMenu={true}
              getContextMenuOptions={(row) => {
                if (row.isInactiveHeader) return [];
                if (row.isInactiveAgent) {
                  return [
                    {
                      label: 'Reactivate Leader',
                      icon: <FiUserMinus />,
                      onClick: () => handleReactivateManager(row.id, row.name),
                      className: 'context-menu-success'
                    }
                  ];
                }
                return getTeamRowContextMenuOptions(row);
              }}
            />
          </>
        ) : (
        <>
        <div className={`goal-cards-section${isEditing && !isPastMonth && viewScope === 'personal' ? ' goal-cards-section--editing' : ' goal-cards-section--combined'}`} style={{ position: 'relative' }}>
          {/* Personal View - Show ALP Goal Card only when editing or no breakdown yet */}
          {viewScope === 'personal' && (isEditing || !breakdown) && (
            <Card
              title="Monthly ALP Goal"
              value={isEditing ? (
                <input
                  type="number"
                  value={monthlyAlpGoal}
                  onChange={(e) => { setMonthlyAlpGoal(e.target.value); markDirty(); }}
                  placeholder="Enter goal"
                  disabled={isPastMonth}
                  className="card-input"
                />
              ) : (monthlyAlpGoal ? formatCurrency(monthlyAlpGoal) : (
                isPastMonth
                  ? <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No goal set</span>
                  : <button className="btn btn-primary set-goal-btn" onClick={() => setIsEditing(true)}><FiTarget /> Set Goal</button>
              ))}
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
              donutSize={40}
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

          {/* Rate Source Configuration - shown only when editing personal goals */}
          {isEditing && !isPastMonth && viewScope === 'personal' && (
            <div className="rate-config-section">
              <h3>Conversion Rates</h3>
              <div className="rate-source-options">
                <label className="radio-option">
                  <input
                    type="radio"
                    value="agency"
                    checked={rateSource === 'agency'}
                    onChange={(e) => { setRateSource(e.target.value); markDirty(); }}
                  />
                  <div className="radio-option-content">
                    <span>Agency Standards</span>
                    <div className="rate-preview">
                      {Math.round(AGENCY_RATES.callsToAppts)} calls/appt · {Math.round(AGENCY_RATES.apptsToSits * 100)}% show · {Math.round(AGENCY_RATES.sitsToSales * 100)}% close
                    </div>
                  </div>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    value="custom"
                    checked={rateSource === 'custom'}
                    onChange={(e) => { setRateSource(e.target.value); markDirty(); }}
                  />
                  <div className="radio-option-content">
                    <span>Custom Rates</span>
                    {rateSource === 'custom' && (
                      <div className="rate-inputs-inline">
                        <div className="rate-input-inline-group">
                          <span className="rate-input-label">Calls/appt</span>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="1000"
                            value={customRates.callsToAppts}
                            onChange={(e) => { setCustomRates({ ...customRates, callsToAppts: parseFloat(e.target.value) || 1 }); markDirty(); }}
                            onClick={(e) => e.stopPropagation()}
                            className="rate-input-sm"
                          />
                        </div>
                        <div className="rate-input-inline-group">
                          <span className="rate-input-label">Show %</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={customRates.apptsToSits * 100}
                            onChange={(e) => { setCustomRates({ ...customRates, apptsToSits: parseFloat(e.target.value) / 100 || 0.25 }); markDirty(); }}
                            onClick={(e) => e.stopPropagation()}
                            className="rate-input-sm"
                          />
                        </div>
                        <div className="rate-input-inline-group">
                          <span className="rate-input-label">Close %</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={customRates.sitsToSales * 100}
                            onChange={(e) => { setCustomRates({ ...customRates, sitsToSales: parseFloat(e.target.value) / 100 || 0.33 }); markDirty(); }}
                            onClick={(e) => e.stopPropagation()}
                            className="rate-input-sm"
                          />
                        </div>
                        <div className="rate-input-inline-group">
                          <span className="rate-input-label">ALP/sale $</span>
                          <input
                            type="number"
                            step="50"
                            min="0"
                            value={customRates.salesToAlp}
                            onChange={(e) => { setCustomRates({ ...customRates, salesToAlp: parseFloat(e.target.value) || 1200 }); markDirty(); }}
                            onClick={(e) => e.stopPropagation()}
                            className="rate-input-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Combined Goal + Breakdown — when not editing and breakdown exists */}
          {viewScope === 'personal' && !isEditing && breakdown && (
            <div className="goal-breakdown-section">
              <div className="breakdown-goal-display">
                <span className="breakdown-goal-label">Monthly ALP Goal</span>
                <span className="breakdown-goal-amount">
                  {monthlyAlpGoal ? formatCurrency(monthlyAlpGoal) : <button className="btn btn-primary set-goal-btn" onClick={() => setIsEditing(true)}><FiTarget /> Set Goal</button>}
                </span>
              </div>
              <div className="breakdown-header">
                <span className="breakdown-label">
                  <FiTrendingUp size={12} />
                  Goal Breakdown
                </span>
                {breakdown.isAdjusted ? (
                  <span className="breakdown-status adjusted">
                    {breakdown.workingDaysCompleted}/{breakdown.workingDays} days complete · {formatCurrency(breakdown.alpAchievedSoFar)} of {formatCurrency(breakdown.monthly.alp)} ({Math.min(100, Math.round((breakdown.alpAchievedSoFar / breakdown.monthly.alp) * 100))}%)
                  </span>
                ) : (
                  <span className="breakdown-status">
                    {breakdown.workingDays} working days · {monthNames[selectedMonth - 1]}
                  </span>
                )}
              </div>
              <div className="breakdown-stats">
                <div className="breakdown-stat breakdown-stat--primary">
                  <span className="breakdown-stat-value">{breakdown.daily.calls}</span>
                  <span className="breakdown-stat-label">Calls/day</span>
                </div>
                <div className="breakdown-stat">
                  <span className="breakdown-stat-value">{breakdown.daily.appts}</span>
                  <span className="breakdown-stat-label">Appts/day</span>
                </div>
                <div className="breakdown-stat">
                  <span className="breakdown-stat-value">{breakdown.daily.sits}</span>
                  <span className="breakdown-stat-label">Sits/day</span>
                </div>
                <div className="breakdown-stat">
                  <span className="breakdown-stat-value">{breakdown.daily.sales}</span>
                  <span className="breakdown-stat-label">Sales/day</span>
                </div>
                <div className="breakdown-stat breakdown-stat--alp">
                  <span className="breakdown-stat-value">{formatCurrency(breakdown.daily.alp)}</span>
                  <span className="breakdown-stat-label">ALP/day</span>
                </div>
              </div>
              {breakdown.isAdjusted && breakdown.originalDaily.calls !== breakdown.daily.calls && (
                <div className="breakdown-adjustment-note">
                  Originally {breakdown.originalDaily.calls} calls/day · adjusted for {breakdown.workingDaysRemaining} remaining days and {formatCurrency(breakdown.remainingAlpNeeded)} remaining ALP
                </div>
              )}
              {summaryOnly && displayPeriod === 'week' && (() => {
                const wkStart = weekStart instanceof Date ? weekStart : new Date();
                const wkEnd = new Date(wkStart);
                wkEnd.setDate(wkStart.getDate() + 6);
                const wkWorkingDays = workingDays.filter(ds => {
                  const d = new Date(ds + 'T00:00:00');
                  return d >= wkStart && d <= wkEnd;
                });
                const n = wkWorkingDays.length;
                if (!n) return null;
                const wt = {
                  calls: Math.round(breakdown.daily.calls * n),
                  appts: Math.round(breakdown.daily.appts * n),
                  sits:  Math.round(breakdown.daily.sits * n),
                  sales: Math.round(breakdown.daily.sales * n),
                  alp:   breakdown.daily.alp * n,
                };
                return (
                  <>
                    <div className="breakdown-header" style={{ marginTop: '10px' }}>
                      <span className="breakdown-label">
                        <FiTrendingUp size={12} /> Targets
                      </span>
                      <span className="breakdown-status">{n} working {n === 1 ? 'day' : 'days'} this week · {monthNames[selectedMonth - 1]}</span>
                    </div>
                    <div className="targets-comparison-grid">
                      <div className="targets-row-label" />
                      <div className="targets-col-header">Calls</div>
                      <div className="targets-col-header">Appts</div>
                      <div className="targets-col-header">Sits</div>
                      <div className="targets-col-header">Sales</div>
                      <div className="targets-col-header">ALP</div>

                      <div className="targets-row-label">Week</div>
                      <div className="targets-cell">{wt.calls}</div>
                      <div className="targets-cell">{wt.appts}</div>
                      <div className="targets-cell">{wt.sits}</div>
                      <div className="targets-cell">{wt.sales}</div>
                      <div className="targets-cell targets-cell--alp">{formatCurrency(wt.alp)}</div>

                      <div className="targets-row-label">Month</div>
                      <div className="targets-cell">{breakdown.monthly.calls}</div>
                      <div className="targets-cell">{breakdown.monthly.appts}</div>
                      <div className="targets-cell">{breakdown.monthly.sits}</div>
                      <div className="targets-cell">{breakdown.monthly.sales}</div>
                      <div className="targets-cell targets-cell--alp">{formatCurrency(breakdown.monthly.alp)}</div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

        </div>


        {/* Calendar Section */}
        {viewScope === 'personal' && (
        <div className="calendar-section">
          <div className="calendar-container">
            <CalendarView
              year={selectedYear}
              month={selectedMonth}
              workingDays={workingDays}
              onWorkingDaysChange={(days) => { setWorkingDays(days); markDirty(); }}
              isEditing={isEditing && !isPastMonth}
              breakdown={breakdown}
              activityByDate={activityByDate}
              viewMode={viewMode}
              isMobile={isMobile}
              dateOverride={dateOverride}
              isPastMonth={isPastMonth}
              onViewModeToggle={() => setViewMode(viewMode === 'calendar' ? 'weekly' : 'calendar')}
              onSelectAllWeekdays={() => { setWorkingDays(generateWorkingDays()); setUserHasClearedDays(false); }}
              onClearAll={() => { setWorkingDays([]); setUserHasClearedDays(true); }}
            />
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

// Calendar View Component — uses react-big-calendar
const rbcLocalizer = luxonLocalizer(DateTime);

const MONTH_NAMES_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function GoalsCalendarToolbar({ year, month, workingDaysCount, isEditing, viewMode, onViewModeToggle, onSelectAllWeekdays, onClearAll, isPastMonth }) {
  return (
    <div className="calendar-toolbar goals-cal-toolbar">
      <div className="calendar-toolbar-left">
        <span className="calendar-toolbar-label">{MONTH_NAMES_FULL[month - 1]} {year}</span>
        {workingDaysCount > 0 && (
          <span className="goals-cal-working-badge">{workingDaysCount} working {workingDaysCount === 1 ? 'day' : 'days'}</span>
        )}
      </div>
      <div className="calendar-toolbar-right">
        {isEditing && !isPastMonth ? (
          <>
            <span className="goals-cal-toolbar-hint">Click days to toggle</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={onSelectAllWeekdays}>Select All Weekdays</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClearAll}>Clear All</button>
          </>
        ) : !isEditing ? (
          <button
            type="button"
            className={`btn btn-outline btn-sm view-toggle ${viewMode === 'weekly' ? 'active' : ''}`}
            onClick={onViewModeToggle}
          >
            {viewMode === 'calendar' ? <><FiBarChart2 size={14} /> Weekly</> : <><FiGrid size={14} /> Calendar</>}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const CalendarView = ({ year, month, workingDays, onWorkingDaysChange, isEditing, breakdown, activityByDate, viewMode, isMobile, dateOverride = null, onViewModeToggle, onSelectAllWeekdays, onClearAll, isPastMonth }) => {
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);
  const todayMidnight = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const fmtCur = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);
  const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dailyGoals = breakdown?.daily || null;
  const calendarDate = useMemo(() => new Date(year, month - 1, 1), [year, month]);

  // Build one allDay event per working day, carrying metrics as resource data
  const events = useMemo(() => workingDays.map(dateStr => {
    const d = new Date(dateStr + 'T00:00:00');
    const isPast = d < todayMidnight;
    const actual = activityByDate?.[dateStr];
    return {
      id: dateStr,
      title: dateStr,
      start: d,
      end: d,
      allDay: true,
      resource: { dateStr, metrics: isPast ? (actual || null) : dailyGoals, isPast, hasActual: !!actual }
    };
  }), [workingDays, activityByDate, dailyGoals, todayMidnight]);

  // Color day backgrounds
  const dayPropGetter = useCallback((date) => {
    const dateStr = toDateStr(date);
    const isWorking = workingDays.includes(dateStr);
    const isPast = date < todayMidnight;
    const isInMonth = date.getFullYear() === year && date.getMonth() + 1 === month;
    const classes = [];
    if (isWorking) classes.push(isPast ? 'goals-day-past' : 'goals-day-working');
    if (isEditing && isInMonth) classes.push('goals-day-editable');
    return classes.length ? { className: classes.join(' ') } : {};
  }, [workingDays, year, month, isEditing, todayMidnight]);

  // Slot click: toggle working day (editing) or show details (viewing)
  const handleSelectSlot = useCallback(({ start, action }) => {
    if (action !== 'click') return;
    const isInMonth = start.getFullYear() === year && start.getMonth() + 1 === month;
    if (!isInMonth) return;
    const dateStr = toDateStr(start);
    if (isEditing) {
      onWorkingDaysChange(
        workingDays.includes(dateStr)
          ? workingDays.filter(d => d !== dateStr)
          : [...workingDays, dateStr].sort()
      );
    } else {
      setSelectedDayInfo({ dateStr, date: start, isWorking: workingDays.includes(dateStr), isPast: start < todayMidnight, actual: activityByDate?.[dateStr] || null });
    }
  }, [isEditing, year, month, workingDays, onWorkingDaysChange, activityByDate, todayMidnight]);

  // Event click: toggle (editing) or show details (viewing)
  const handleSelectEvent = useCallback((event) => {
    const { dateStr, isPast, hasActual } = event.resource;
    if (isEditing) {
      onWorkingDaysChange(workingDays.filter(d => d !== dateStr));
    } else {
      const date = new Date(dateStr + 'T00:00:00');
      setSelectedDayInfo({ dateStr, date, isWorking: true, isPast, actual: hasActual ? activityByDate?.[dateStr] : null });
    }
  }, [isEditing, workingDays, onWorkingDaysChange, activityByDate]);

  // Event content: shows daily metrics inside each working day
  const EventComponent = useCallback(({ event }) => {
    const { metrics, isPast, hasActual } = event.resource;
    const noData = isPast && !hasActual;
    return (
      <div className={`goals-rbc-event-content${isPast ? ' past' : ''}${noData ? ' no-data' : ''}`}>
        {noData && <span className="grbc-dash">—</span>}
        {metrics && !noData && (
          <>
            <div className="grbc-row grbc-calls">
              <span className="grbc-v">{metrics.calls}</span>
              <span className="grbc-l">calls</span>
            </div>
            {!isMobile && (
              <>
                <div className="grbc-row">
                  <span className="grbc-v">{metrics.appts}</span>
                  <span className="grbc-l">appts</span>
                </div>
                <div className="grbc-row grbc-alp">
                  <span className="grbc-v">{fmtCur(metrics.alp)}</span>
                  <span className="grbc-l">ALP</span>
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  }, [isMobile]);

  const components = useMemo(() => ({
    toolbar: () => <GoalsCalendarToolbar year={year} month={month} workingDaysCount={workingDays.length} isEditing={isEditing} viewMode={viewMode} onViewModeToggle={onViewModeToggle} onSelectAllWeekdays={onSelectAllWeekdays} onClearAll={onClearAll} isPastMonth={isPastMonth} />,
    event: EventComponent,
  }), [EventComponent, year, month, workingDays.length, isEditing]);

  // Compute weeks for WeeklyView (only when needed)
  const weeks = useMemo(() => {
    if (viewMode !== 'weekly') return [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDow = firstDay.getDay();
    const startOffset = startDow === 0 ? 6 : startDow - 1;
    const cursor = new Date(firstDay);
    cursor.setDate(cursor.getDate() - startOffset);
    const result = [];
    const today = new Date(); today.setHours(0,0,0,0);
    while (cursor <= lastDay) {
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(cursor);
        weekDays.push({ date: d, dateStr: toDateStr(d), day: d.getDate(), isInMonth: d.getMonth() + 1 === month && d.getFullYear() === year });
        cursor.setDate(cursor.getDate() + 1);
      }
      const isCurrentWeek = weekDays.some(w => w.date >= today && w.date < new Date(today.getTime() + 7 * 86400000));
      const totals = weekDays.reduce((acc, { dateStr, isInMonth }) => {
        if (!isInMonth || !workingDays.includes(dateStr)) return acc;
        const a = activityByDate?.[dateStr];
        const g = dailyGoals;
        if (a) { acc.calls += a.calls||0; acc.appts += a.appts||0; acc.sits += a.sits||0; acc.sales += a.sales||0; acc.alp += a.alp||0; }
        if (g) { acc.gCalls += g.calls||0; acc.gAppts += g.appts||0; acc.gSits += g.sits||0; acc.gSales += g.sales||0; acc.gAlp += g.alp||0; }
        return acc;
      }, { calls:0, appts:0, sits:0, sales:0, alp:0, gCalls:0, gAppts:0, gSits:0, gSales:0, gAlp:0 });
      result.push({ days: weekDays, totals, isCurrentWeek });
    }
    return result;
  }, [viewMode, year, month, workingDays, activityByDate, dailyGoals]);

  if (viewMode === 'weekly') {
    const fmtVal = (v) => (v != null && v !== 0) ? v : '—';
    const fmtAlpVal = (v) => (v != null && v !== 0) ? fmtCur(v) : '—';
    return (
      <div className="weekly-view">
        <table className="weekly-dt">
          <thead>
            <tr className="weekly-dt-head">
              <th>Week</th>
              <th></th>
              <th>Calls</th>
              <th>Appts</th>
              <th>Sits</th>
              <th>Sales</th>
              <th>ALP</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => {
              const rowDefs = [
                { label: 'planned',   vals: [week.totals.gCalls, week.totals.gAppts, week.totals.gSits, week.totals.gSales, week.totals.gAlp] },
                { label: 'reported',  vals: [week.totals.calls,  week.totals.appts,  week.totals.sits,  week.totals.sales,  week.totals.alp] },
                { label: 'remaining', vals: [
                    Math.max(0, week.totals.gCalls  - week.totals.calls),
                    Math.max(0, week.totals.gAppts  - week.totals.appts),
                    Math.max(0, week.totals.gSits   - week.totals.sits),
                    Math.max(0, week.totals.gSales  - week.totals.sales),
                    Math.max(0, week.totals.gAlp    - week.totals.alp),
                ]},
              ];
              const isEven = wi % 2 === 0;
              return rowDefs.map(({ label, vals }, ri) => (
                <tr
                  key={`w${wi}-${label}`}
                  className={`weekly-dt-row weekly-dt-${label}${week.isCurrentWeek ? ' current-week' : ''}${ri === 2 ? ' week-end' : ''}${isEven ? ' week-even' : ''}`}
                >
                  {ri === 0 && (
                    <td rowSpan={3} className={`weekly-dt-week-cell${week.isCurrentWeek ? ' current-week' : ''}${isEven ? ' week-even' : ''}`}>
                      <span className="weekly-dt-week-num">{wi + 1}</span>
                      <span className="weekly-dt-week-dates">
                        {week.days.find(d => d.isInMonth)?.day ?? week.days[0]?.day}
                        {' – '}
                        {[...week.days].reverse().find(d => d.isInMonth)?.day ?? week.days[6]?.day}
                      </span>
                    </td>
                  )}
                  <td className="weekly-dt-type">{label}</td>
                  {vals.slice(0, 4).map((v, ci) => (
                    <td key={ci} className="weekly-dt-val">{fmtVal(v)}</td>
                  ))}
                  <td className="weekly-dt-val">{fmtAlpVal(vals[4])}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Placeholder for old date range code (kept as comment so logic is clear)
  // dateOverride support: working days can span adjacent months; react-big-calendar
  // shows the calendar month but dayPropGetter highlights all working days regardless.

  return (
    <div className={`goals-rbc-wrap${isEditing ? ' is-editing' : ''}`}>
      <Calendar
        localizer={rbcLocalizer}
        events={events}
        defaultView="month"
        views={['month']}
        date={calendarDate}
        onNavigate={() => {}}
        selectable
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        dayPropGetter={dayPropGetter}
        eventPropGetter={() => ({ className: 'goals-rbc-event-item' })}
        components={components}
        style={{ height: isMobile ? 460 : 550 }}
        popup={false}
        showMultiDayTimes={false}
      />

      {/* Day details popup */}
      {selectedDayInfo && (
        <div className="goals-day-overlay" onClick={() => setSelectedDayInfo(null)}>
          <div className="goals-day-popup" onClick={e => e.stopPropagation()}>
            <div className="goals-day-popup-header">
              <h4>{selectedDayInfo.date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}</h4>
              <button className="goals-day-popup-close" onClick={() => setSelectedDayInfo(null)}><FiX size={18} /></button>
            </div>
            <div className="goals-day-popup-body">
              {!selectedDayInfo.isWorking ? (
                <p className="goals-day-empty">
                  {[0, 6].includes(selectedDayInfo.date.getDay()) ? 'Weekend – no goals set.' : 'Not set as a working day.'}
                </p>
              ) : selectedDayInfo.isPast && selectedDayInfo.actual && dailyGoals ? (
                <div className="goals-compare">
                  <div className="goals-compare-header">
                    <span></span>
                    <span className="goals-compare-col">Planned</span>
                    <span className="goals-compare-col">Actual</span>
                  </div>
                  {[
                    { label: 'Calls',  g: dailyGoals.calls,  a: selectedDayInfo.actual.calls  },
                    { label: 'Appts',  g: dailyGoals.appts,  a: selectedDayInfo.actual.appts  },
                    { label: 'Sits',   g: dailyGoals.sits,   a: selectedDayInfo.actual.sits   },
                    { label: 'Sales',  g: dailyGoals.sales,  a: selectedDayInfo.actual.sales  },
                    { label: 'ALP',    g: fmtCur(dailyGoals.alp), a: fmtCur(selectedDayInfo.actual.alp), isCur: true },
                  ].map(({ label, g, a, isCur }) => (
                    <div key={label} className="goals-compare-row">
                      <span className="goals-compare-label">{label}</span>
                      <span className="goals-compare-planned">{g}</span>
                      <span className={`goals-compare-actual${!isCur && a >= g ? ' met' : !isCur && a === 0 ? ' zero' : ''}`}>{a}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="goals-metrics-list">
                  {(selectedDayInfo.actual || dailyGoals) && (() => {
                    const m = selectedDayInfo.actual || dailyGoals;
                    return [
                      { label: 'Calls',        v: m?.calls             },
                      { label: 'Appointments', v: m?.appts             },
                      { label: 'Sits',         v: m?.sits              },
                      { label: 'Sales',        v: m?.sales             },
                      { label: 'ALP',          v: fmtCur(m?.alp), alp: true },
                    ].map(({ label, v, alp }) => (
                      <div key={label} className={`goals-metric-item${alp ? ' alp' : ''}`}>
                        <span className="gmi-label">{label}</span>
                        <span className="gmi-value">{v}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
              {isEditing && (
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 12, width: '100%' }}
                  onClick={() => {
                    const { dateStr } = selectedDayInfo;
                    onWorkingDaysChange(
                      selectedDayInfo.isWorking
                        ? workingDays.filter(d => d !== dateStr)
                        : [...workingDays, dateStr].sort()
                    );
                    setSelectedDayInfo(null);
                  }}
                >
                  {selectedDayInfo.isWorking ? 'Remove Working Day' : 'Add Working Day'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


export default ProductionGoals; 