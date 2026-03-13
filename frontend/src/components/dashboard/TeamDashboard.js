/**
 * Team Dashboard Component
 * 
 * Simplified dashboard for AGT, SA, GA, MGA, and RGA users.
 * This is a parent component that will host various child components.
 */

import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import ActivityFeedList from '../activityFeed/ActivityFeedList';
import AddSaleModal from '../activityFeed/AddSaleModal';
import CompetitionsDisplay from '../competitions/CompetitionsDisplay';
import CommitsWidget from '../OneOnOne/CommitsWidget';
import YTDSummaryWidget from '../OneOnOne/YTDSummaryWidget';
import ActivityWidget from '../OneOnOne/ActivityWidget';
import StatisticsWidget from '../OneOnOne/StatisticsWidget';
import Leaderboard from '../utils/Leaderboard';
import WidgetCard from '../utils/WidgetCard';
import TeamLeaderboard from './TeamLeaderboard';
import DateRangeSelector from './DateRangeSelector';
import ThemeContext from '../../context/ThemeContext';
import { useHeader } from '../../context/HeaderContext';
import { FiPhone, FiCalendar, FiUsers, FiTrendingUp, FiDollarSign, FiUserPlus, FiEdit2, FiToggleLeft, FiToggleRight, FiX, FiSave, FiGlobe, FiPlus, FiChevronsRight, FiChevronsLeft } from 'react-icons/fi';
import api from '../../api';
import { parseLocalDate, formatLocalDate, calculateStatsDateRange } from '../../utils/dateRangeUtils';
import '../../pages/Dashboard.css';
import '../../pages/OneOnOne.css';
import './TeamDashboard.css';

const TeamDashboard = ({ userRole, user }) => {
  const { theme } = useContext(ThemeContext);
  const { setHeaderContent } = useHeader();

  // Abort controllers to prevent stacked requests when user changes date/view quickly
  const teamLeaderboardAbortRef = useRef(null);
  const leaderboardAbortRef = useRef(null);
  // Tracks whether we've already auto-switched to prev month due to empty data
  const hasAutoSwitchedMonth = useRef(false);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showFeedSidebar, setShowFeedSidebar] = useState(window.innerWidth >= 1400);

  // Activity feed sidebar state
  const [feedScope, setFeedScope] = useState('org');
  const [showAddSale, setShowAddSale] = useState(false);
  const [addFeedEventFn, setAddFeedEventFn] = useState(null);
  const handleRegisterFeedEvent = useCallback((fn) => { setAddFeedEventFn(() => fn); }, []);
  const handleFeedSaleAdded = useCallback((event) => { if (addFeedEventFn) addFeedEventFn(event); }, [addFeedEventFn]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setShowFeedSidebar(window.innerWidth >= 1400);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Unified view scope state - consolidates saViewMode, gaViewMode, mgaViewMode, rgaViewMode
  // 'personal' | 'team' (for SA/GA/MGA) | 'mga' | 'rga' (for RGA)
  const [viewScope, setViewScope] = useState(() => {
    // Initialize based on user role
    if (['SA', 'GA', 'MGA'].includes(userRole)) return 'team';
    if (userRole === 'RGA') return 'rga';
    if (userRole === 'SGA') return 'personal';
    return 'personal'; // AGT default
  });

  // Date range selection
  const [viewMode, setViewMode] = useState('month'); // 'week', 'month', 'year'
  const [dateRangeState, setDateRangeState] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
      end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    };
  });
  
  // Keep timePeriod for backward compatibility with existing code
  // Calculate timePeriod based on viewMode and date range for CommitsWidget title
  const getTimePeriod = () => {
    if (viewMode === 'year') return 'ytd';
    if (viewMode === 'month') {
      const now = new Date();
      const rangeStart = parseLocalDate(dateRangeState.start);
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const rangeMonth = rangeStart.getMonth();
      const rangeYear = rangeStart.getFullYear();
      
      // Check if it's the current month AND year
      if (rangeMonth === currentMonth && rangeYear === currentYear) {
        return 'thisMonth';
      }
      // Any other month (previous or future) should use Monthly_ALP
      return 'previousMonth';
    }
    return 'thisMonth';
  };
  
  const timePeriod = getTimePeriod();

  // Org Metrics state (for CommitsWidget)
  const [orgMetrics, setOrgMetrics] = useState(null);
  const [orgMetricsHistory, setOrgMetricsHistory] = useState(null); // For comparison data
  const [orgMetricsLoading, setOrgMetricsLoading] = useState(false);
  const [alpAsOfDate, setAlpAsOfDate] = useState(null);
  const [commits, setCommits] = useState({ hires: null, codes: null, vips: null, alp: null, refSales: null });
  const [commitHistory, setCommitHistory] = useState({ hires: [], codes: [], vips: [], alp: [], refSales: [] });
  const [editingCommit, setEditingCommit] = useState(null);
  const [commitInput, setCommitInput] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyModalType, setHistoryModalType] = useState(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownData, setBreakdownData] = useState([]);
  const [refSalesBreakdown, setRefSalesBreakdown] = useState([]);
  
  // YTD Summary Widget data
  const [ytdSummaryData, setYtdSummaryData] = useState({
    alpData: {},
    hiresData: {},
    associatesData: [],
    vipsData: [],
    mgaStartDate: null
  });

  // Activity Widget state
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityData, setActivityData] = useState(null);
  // Removed redundant selectedPeriod and currentDate - now uses main viewMode and dateRangeState
  const [activityViewMode, setActivityViewMode] = useState('reported'); // reported, official
  const [comparisonData, setComparisonData] = useState(null);
  const [officialYtdAlp, setOfficialYtdAlp] = useState(null);
  const [activityError, setActivityError] = useState('');
  
  // Consolidated stats state - removed redundant personalStatsData/statsData duplication
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [personalStatsTimeframe, setPersonalStatsTimeframe] = useState('thisMonth'); // thisMonth, lastMonth, sixMonths, allTime
  
  // Personal metrics comparison state (for showing vs last year / prev month)
  const [personalComparison, setPersonalComparison] = useState(null);
  
  // Personal ALP state (for goal editing and official/reported toggle)
  const [personalAlpMode, setPersonalAlpMode] = useState('reported'); // 'reported' or 'official'
  const [editingPersonalGoal, setEditingPersonalGoal] = useState(false);
  const [personalGoalInput, setPersonalGoalInput] = useState('');
  const [personalGoal, setPersonalGoal] = useState(null);
  const [personalOfficialAlp, setPersonalOfficialAlp] = useState(null); // Official ALP from Weekly_ALP
  const [hasOfficialAlpData, setHasOfficialAlpData] = useState(false); // Whether official data exists

  // MGA/RGA ALP state (for official/reported toggle in team views)
  const [mgaAlpMode, setMgaAlpMode] = useState('reported'); // 'reported' or 'official'
  const [rgaAlpMode, setRgaAlpMode] = useState('reported'); // 'reported' or 'official'
  const [mgaOfficialAlp, setMgaOfficialAlp] = useState(null); // Official ALP from Weekly_ALP/Monthly_ALP for MGA
  const [rgaOfficialAlp, setRgaOfficialAlp] = useState(null); // Official ALP from Weekly_ALP/Monthly_ALP for RGA
  const [hasMgaOfficialAlpData, setHasMgaOfficialAlpData] = useState(false);
  const [hasRgaOfficialAlpData, setHasRgaOfficialAlpData] = useState(false);

  // NOTE: TeamDashboard does not render the compact "Top 10" leaderboard widget.
  // Avoid fetching it here to reduce load/errors (UnifiedDashboard handles that UI separately).

  // Team Leaderboard state
  const [teamLeaderboardData, setTeamLeaderboardData] = useState([]);
  const [teamLeaderboardLoading, setTeamLeaderboardLoading] = useState(false);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardHasMore, setLeaderboardHasMore] = useState(true);
  const [leaderboardAllUsers, setLeaderboardAllUsers] = useState([]); // Store all users for pagination
  const [leaderboardAlpDataMap, setLeaderboardAlpDataMap] = useState(new Map()); // Store fetched ALP data for pagination
  const [leaderboardAlpField, setLeaderboardAlpField] = useState('LVL_1_NET'); // Store which ALP field to use
  const LEADERBOARD_PAGE_SIZE = 50;

  // Helper function to validate and set view scope based on user role
  const handleViewScopeChange = (newScope) => {
    const validScopes = {
      'AGT': ['personal'],
      'SA': ['personal', 'team'],
      'GA': ['personal', 'team'],
      'MGA': ['personal', 'team'],
      'RGA': ['personal', 'mga', 'rga'],
      'SGA': ['personal', 'mga', 'rga']
    };
    
    if (validScopes[userRole]?.includes(newScope)) {
      setViewScope(newScope);
    }
  };

  // Handle date range change from DateRangeSelector
  const handleDateRangeChange = (newRange) => {
    setDateRangeState(newRange);
  };

  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  // Get date range based on selected time period or dateRangeState
  const getDateRange = () => {
    // If we have dateRangeState from DateRangeSelector, use it
    if (dateRangeState && dateRangeState.start && dateRangeState.end) {
      const start = parseLocalDate(dateRangeState.start);
      const end = parseLocalDate(dateRangeState.end);
      
      return {
        startDate: start,
        endDate: end,
        month: start.getMonth(),
        year: start.getFullYear()
      };
    }
    
    // Fallback to old logic for backward compatibility
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    switch (timePeriod) {
      case 'thisWeek': {
        // Get Monday of current week
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now);
        monday.setDate(now.getDate() + mondayOffset);
        monday.setHours(0, 0, 0, 0);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        return {
          startDate: monday,
          endDate: sunday,
          month: monday.getMonth(),
          year: monday.getFullYear()
        };
      }
      
      case 'thisMonth': {
        const startDate = new Date(currentYear, currentMonth, 1);
        const endDate = new Date(currentYear, currentMonth + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        
        return {
          startDate,
          endDate,
          month: currentMonth,
          year: currentYear
        };
      }
      
      case 'lastMonth': {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const startDate = new Date(lastMonthYear, lastMonth, 1);
        const endDate = new Date(lastMonthYear, lastMonth + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        
        return {
          startDate,
          endDate,
          month: lastMonth,
          year: lastMonthYear
        };
      }
      
      case 'ytd': {
        const startDate = new Date(currentYear, 0, 1);
        const endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        
        return {
          startDate,
          endDate,
          month: null, // Not applicable for YTD
          year: currentYear
        };
      }
      
      default:
        return {
          startDate: new Date(currentYear, currentMonth, 1),
          endDate: new Date(currentYear, currentMonth + 1, 0),
          month: currentMonth,
          year: currentYear
        };
    }
  };

  // Format helpers
  const formatCurrency = (value) => {
    if (!value && value !== 0) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value) => {
    if (!value && value !== 0) return '0';
    return new Intl.NumberFormat('en-US').format(value);
  };

  // Activity Widget now uses main dateRangeState - no separate date range calculation needed

  // Removed getPeriodOptions and getPeriodKeyForDate - activity widget now uses main date controls

  // Use centralized stats date range utility
  const getStatsDateRange = () => calculateStatsDateRange(personalStatsTimeframe);

  // Save commit function (from OneOnOne.js)
  const saveCommit = async (type) => {
    try {
      const val = parseFloat(commitInput);
      if (isNaN(val) || val < 0) {
        alert('Please enter a valid number');
        return;
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      
      // Determine time_period and date range based on current timePeriod state
      let time_period_param, start, end;
      if (timePeriod === 'ytd') {
        // For YTD, save year-based commits
        time_period_param = 'year';
        start = `${year}-01-01`;
        end = `${year}-12-31`;
      } else {
        // For monthly commits (thisMonth, lastMonth)
        time_period_param = 'month';
        start = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }

      // Determine clname based on view scope
      let commitClname = userRole;
      if (userRole === 'RGA') {
        commitClname = viewScope === 'mga' ? 'MGA' : 'RGA';
      } else if (userRole === 'MGA') {
        commitClname = 'MGA';
      }

      await api.post('/commits', {
        time_period: time_period_param,
        type,
        start,
        end,
        amount: val,
        clname: commitClname
      });

      setCommits(prev => ({ ...prev, [type]: val }));
      setEditingCommit(null);
      setCommitInput('');
      
      // Reload commits
      fetchCommits();
    } catch (e) {
      console.error('Error saving commit:', e);
      alert('Failed to save commit');
    }
  };

  // Save ALP goal function (from OneOnOne.js)
  // Save personal ALP goal
  const savePersonalAlpGoal = async () => {
    try {
      const val = parseFloat(personalGoalInput);
      if (isNaN(val) || val < 0) {
        alert('Please enter a valid number');
        return;
      }
      
      // Get month/year from date range selector
      const rangeStart = parseLocalDate(dateRangeState.start);
      const month = rangeStart.getMonth() + 1;
      const year = rangeStart.getFullYear();
      
      const totalDaysInMonth = new Date(year, month, 0).getDate();
      const workingDays = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);
      
      const goalPayload = {
        userId: user.userId,
        year: year,
        month: month,
        monthlyAlpGoal: val,
        goalType: 'personal',
        workingDays: workingDays,
        rateSource: 'default',
        customRates: null
      };
      
      await api.post('/goals', goalPayload);
      setPersonalGoal(val);
      setEditingPersonalGoal(false);
      
      // Refresh activity data to show updated goal progress
      fetchActivityData();
    } catch (error) {
      console.error('Error saving personal goal:', error);
      alert('Failed to save goal. Please try again.');
    }
  };

  const saveAlpGoal = async () => {
    try {
      const val = parseFloat(commitInput);
      if (isNaN(val) || val < 0) {
        alert('Please enter a valid number');
        return;
      }
      
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      // Determine which goal type to save based on viewScope
      let goalType = 'mga';
      if (userRole === 'RGA') {
        goalType = viewScope === 'mga' ? 'mga' : 'rga';
      }
      
      const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      const teamWorkingDays = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);
      
      const goalPayload = {
        userId: user.userId,
        year: currentYear,
        month: currentMonth,
        monthlyAlpGoal: val,
        goalType: goalType,
        workingDays: teamWorkingDays,
        rateSource: 'default',
        customRates: null
      };
      
      await api.post('/goals', goalPayload);
      
      setCommits(prev => ({
        ...prev,
        alp: val
      }));
      
      setEditingCommit(null);
      setCommitInput('');
      
      // Reload commits
      await fetchCommits();
    } catch (error) {
      console.error('Error saving ALP goal:', error);
      alert('Failed to save ALP goal. Please try again.');
    }
  };

  // Fetch commits function (from OneOnOne.js - simplified)
  const fetchCommits = async () => {
    try {
      if (!['MGA', 'RGA', 'GA', 'SA', 'SGA'].includes(userRole)) return;
      const now = new Date();
      let year = now.getFullYear();
      let month = now.getMonth() + 1;
      
      // Adjust for last month if needed
      if (timePeriod === 'lastMonth') {
        month = month - 1;
        if (month === 0) {
          month = 12;
          year = year - 1;
        }
      }
      
      // Determine time_period and date range based on current timePeriod state
      let time_period_param, start, end;
      if (timePeriod === 'ytd') {
        // For YTD, fetch year-based commits
        time_period_param = 'year';
        start = `${now.getFullYear()}-01-01`;
        end = `${now.getFullYear()}-12-31`;
      } else {
        // For monthly commits (thisMonth, lastMonth)
        time_period_param = 'month';
        start = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }

      const res = await api.get('/commits', {
        params: { time_period: time_period_param, start, end }
      });

      if (res?.data?.success) {
        const list = res.data.data || [];
        
        // For RGA users, filter by the appropriate clname based on view scope
        let filteredList = list;
        if (userRole === 'RGA') {
          const targetClname = viewScope === 'mga' ? 'MGA' : 'RGA';
          filteredList = list.filter(c => c.clname === targetClname);
        }
        
        filteredList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        const hiresCommit = filteredList.find(c => c.type === 'hires');
        const codesCommit = filteredList.find(c => c.type === 'codes');
        const vipsCommit = filteredList.find(c => c.type === 'vips');
        
        const hiresHistory = filteredList.filter(c => c.type === 'hires');
        const codesHistory = filteredList.filter(c => c.type === 'codes');
        const vipsHistory = filteredList.filter(c => c.type === 'vips');
        
        // Fetch ALP goal from production goals table
        let alpGoal = null;
        try {
          let goalType = 'mga';
          if (userRole === 'RGA') {
            goalType = viewScope === 'mga' ? 'mga' : 'rga';
          }
          
          const alpGoalRes = await api.get(`/goals/${user.userId}/${year}/${month}?goalType=${goalType}`);
          if (alpGoalRes?.data?.monthlyAlpGoal) {
            alpGoal = parseFloat(alpGoalRes.data.monthlyAlpGoal);
          }
        } catch (alpError) {
          // No ALP goal found
        }
        
        setCommits({
          hires: hiresCommit ? parseFloat(hiresCommit.amount) : null,
          codes: codesCommit ? parseFloat(codesCommit.amount) : null,
          vips: vipsCommit ? parseFloat(vipsCommit.amount) : null,
          alp: alpGoal
        });
        
        setCommitHistory({
          hires: hiresHistory,
          codes: codesHistory,
          vips: vipsHistory,
          alp: []
        });
      }
    } catch (e) {
      console.error('Error fetching commits:', e);
    }
  };

  // Fetch org metrics function (from OneOnOne.js - simplified version)
  const fetchOrgMetrics = async () => {
    try {
      if (!['MGA', 'RGA', 'GA', 'SA', 'SGA'].includes(userRole)) return;
      if (!user?.lagnname) return;

      const isOrgScope = (userRole === 'MGA' && viewScope === 'team') ||
                         (userRole === 'RGA' && (viewScope === 'mga' || viewScope === 'rga')) ||
                         (userRole === 'GA' && viewScope === 'team') ||
                         (userRole === 'SA' && viewScope === 'team') ||
                         (userRole === 'SGA');
      if (!isOrgScope) { setOrgMetrics(null); return; }

      setOrgMetricsLoading(true);

      // Get date range based on selected time period
      const dateRange = getDateRange();
      const { startDate, endDate, year } = dateRange;
      const month = startDate.getMonth();

      // SGA uses org-wide endpoints (no lagnName filtering)
      if (userRole === 'SGA') {
        try {
          const [vipsRes, codesRes, hiresRes, refSalesRes, alpRes] = await Promise.all([
            api.get('/dataroutes/vips-sga'),
            api.get('/dataroutes/associates-sga'),
            api.get('/dataroutes/org-total-hires'),
            api.get(`/alp/ref-sales?month=${month + 1}&year=${year}`),
            api.get('/dataroutes/sga-alp')
          ]);

          const vipsArr = vipsRes?.data?.data || [];
          const codesArr = codesRes?.data?.data || [];
          const hiresArr = hiresRes?.data?.data || [];
          const refSalesCount = refSalesRes?.data?.totalRefSales || 0;
          const alpArr = alpRes?.data?.data || [];

          // Filter by date range
          const vipsMTD = vipsArr.filter(row => {
            const d = row?.vip_month ? new Date(row.vip_month) : null;
            return d && d >= startDate && d <= endDate;
          }).length;

          const codesMTD = codesArr.filter(row => {
            const d = row?.PRODDATE ? new Date(row.PRODDATE) : null;
            return d && d >= startDate && d <= endDate;
          }).length;

          const hiresMTD = hiresArr.reduce((sum, row) => {
            const d = row?.MORE_Date ? new Date(row.MORE_Date) : null;
            if (d && d >= startDate && d <= endDate) {
              return sum + (parseFloat(row?.Total_Hires) || 0);
            }
            return sum;
          }, 0);

          // ALP from sga_alp table - find matching month
          let alpMTD = 0;
          if (viewMode === 'year' || timePeriod === 'ytd') {
            // Sum all months up to current for YTD
            alpArr.forEach(item => {
              if (!item.month) return;
              const parts = item.month.split('/');
              const itemMonth = parseInt(parts[0], 10) - 1;
              const itemYear = parseInt(parts[1], 10);
              if (itemYear === year) {
                alpMTD += parseFloat(item.net) || 0;
              }
            });
          } else {
            // Single month
            const targetMonth = month + 1;
            const match = alpArr.find(item => {
              if (!item.month) return false;
              const parts = item.month.split('/');
              return parseInt(parts[0], 10) === targetMonth && parseInt(parts[1], 10) === year;
            });
            alpMTD = match ? (parseFloat(match.net) || 0) : 0;
          }

          // Set as of date
          if (alpArr.length > 0) {
            const latestMonth = alpArr.reduce((latest, item) => {
              if (!item.month) return latest;
              return item.month;
            }, null);
            if (latestMonth) setAlpAsOfDate(latestMonth);
          }

          setOrgMetrics({ hiresMTD, codesMTD, vipsMTD, refSalesMTD: refSalesCount, alpMTD });
          setBreakdownData([]);

          // Auto-switch to previous month if 3+ of the 5 SGA cards have no data yet.
          // Only do this once per session and only when viewing the current month.
          if (!hasAutoSwitchedMonth.current) {
            const nowCheck = new Date();
            const currentMonthStart = `${nowCheck.getFullYear()}-${String(nowCheck.getMonth() + 1).padStart(2, '0')}-01`;
            const isCurrentMonth = dateRangeState.start === currentMonthStart;
            if (isCurrentMonth) {
              const cardValues = [hiresMTD, codesMTD, vipsMTD, refSalesCount, alpMTD];
              const emptyCount = cardValues.filter(v => !v || v === 0).length;
              if (emptyCount >= 3) {
                hasAutoSwitchedMonth.current = true;
                const prevStart = new Date(nowCheck.getFullYear(), nowCheck.getMonth() - 1, 1);
                const prevEnd = new Date(nowCheck.getFullYear(), nowCheck.getMonth(), 0);
                const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                setDateRangeState({ start: fmt(prevStart), end: fmt(prevEnd) });
              }
            }
          }

          // Fetch historical comparison for SGA
          await fetchOrgMetricsHistory([], startDate);
        } catch (e) {
          console.error('Error fetching SGA org metrics:', e);
          setOrgMetrics({ hiresMTD: 0, codesMTD: 0, vipsMTD: 0, refSalesMTD: 0, alpMTD: 0 });
          setBreakdownData([]);
        } finally {
          setOrgMetricsLoading(false);
        }
        return;
      }

      let lagnNames = [user.lagnname];

      if (userRole === 'RGA' && viewScope === 'rga') {
        try {
          const rollupRes = await api.get(`/mga-hierarchy/rga-rollup/${encodeURIComponent(user.lagnname)}`);
          if (rollupRes?.data?.success) {
            const mgas = rollupRes.data.data.mgas || [];
            const mgaNames = mgas.map(m => m.lagnname).filter(Boolean);
            lagnNames = [user.lagnname, ...mgaNames];
          }
        } catch (e) {
          console.warn('Failed to load RGA rollup', e);
        }
      }

      const fetchForName = async (name) => {
        const enc = encodeURIComponent(name);
        const [vipsRes, codesRes, hiresRes, refSalesRes] = await Promise.all([
          api.get(`/dataroutes/vips/multiple?value=${enc}`),
          api.get(`/dataroutes/associates/multiple?value=${enc}`),
          api.get(`/dataroutes/total-hires?value=${enc}`),
          api.get(`/alp/ref-sales?month=${month + 1}&year=${year}&lagnName=${enc}`)
        ]);
        const vipsArr = vipsRes?.data?.data || [];
        const codesArr = codesRes?.data?.data || [];
        const hiresArr = hiresRes?.data?.data || [];
        const refSalesCount = refSalesRes?.data?.totalRefSales || 0;
        
        const vipsPeriodLocal = vipsArr.filter((row) => {
          const d = row?.vip_month ? new Date(row.vip_month) : null;
          return d && d >= startDate && d <= endDate;
        }).length;
        
        const codesPeriodLocal = codesArr.filter((row) => {
          const d = row?.PRODDATE ? new Date(row.PRODDATE) : null;
          return d && d >= startDate && d <= endDate;
        }).length;
        
        const hiresPeriodLocal = hiresArr.reduce((sum, row) => {
          const d = row?.MORE_Date ? new Date(row.MORE_Date) : null;
          if (d && d >= startDate && d <= endDate) {
            const n = parseFloat(row?.Total_Hires) || 0;
            return sum + n;
          }
          return sum;
        }, 0);
        
        // Ref sales is already filtered by month/year in the API call
        const refSalesPeriodLocal = refSalesCount;
        
        return { vipsPeriodLocal, codesPeriodLocal, hiresPeriodLocal, refSalesPeriodLocal };
      };

      const results = await Promise.all(lagnNames.map(fetchForName));
      
      // For VIPs, use the filtered period data directly (Potential VIPs API is month-specific)
      // Use the already filtered vipsPeriodLocal from results
      const breakdown = lagnNames.map((name, idx) => ({
        lagnname: name,
        hires: results[idx].hiresPeriodLocal,
        codes: results[idx].codesPeriodLocal,
        vips: results[idx].vipsPeriodLocal,
        refSales: results[idx].refSalesPeriodLocal,
        isSelf: name === user.lagnname
      }));
      
      const totals = {
        hires: results.reduce((sum, r) => sum + r.hiresPeriodLocal, 0),
        codes: results.reduce((sum, r) => sum + r.codesPeriodLocal, 0),
        vips: results.reduce((sum, r) => sum + r.vipsPeriodLocal, 0),
        refSales: results.reduce((sum, r) => sum + r.refSalesPeriodLocal, 0)
      };

      // Fetch ALP data based on time period
      let alpMTD = 0;
      try {
        const now = new Date();
        
        if (timePeriod === 'previousMonth') {
          // Use Monthly_ALP table for any previous month
          const selectedMonth = startDate.getMonth() + 1; // +1 because getMonth() is 0-indexed
          const selectedYear = startDate.getFullYear();
          const monthKey = `${String(selectedMonth).padStart(2, '0')}/${selectedYear}`;
          
          console.log('💰 [OrgMetrics ALP Card] Using Monthly_ALP for previous month:', {
            monthKey,
            lagnname: user.lagnname,
            viewScope
          });
          
          // Determine endpoint based on viewScope
          let alpEndpoint;
          if (viewScope === 'mga') {
            alpEndpoint = '/alp/getmonthlymga';
          } else if (viewScope === 'rga') {
            alpEndpoint = '/alp/getmonthlyrga';
          } else {
            alpEndpoint = '/alp/getmonthlyall';
          }
          
          const alpRes = await api.get(alpEndpoint, {
            params: {
              month: monthKey
            }
          });
          
          if (alpRes?.data?.success && Array.isArray(alpRes.data.data)) {
            // Filter to get this user's data
            let userDataRows = alpRes.data.data.filter(row => 
              row.LagnName && user.lagnname && 
              row.LagnName.trim().toLowerCase() === user.lagnname.trim().toLowerCase()
            );
            
            if (userDataRows.length > 0) {
              // Apply CL_Name filtering for MGA/RGA views (same logic as weekly)
              let filteredRows = userDataRows;
              if (viewScope === 'mga' || viewScope === 'rga') {
                filteredRows = userDataRows.filter(item => {
                  // Check if there's a paired row (different CL_Name)
                  const pairedRows = userDataRows.filter(r => 
                    r.CTLNO === item.CTLNO // Same code
                  );
                  
                  const hasMgaRow = pairedRows.some(r => r.CL_Name === 'MGA');
                  const hasBlankRow = pairedRows.some(r => !r.CL_Name || r.CL_Name === '');
                  
                  if (pairedRows.length >= 2 && hasMgaRow && hasBlankRow) {
                    // Two rows exist: filter by viewScope
                    if (viewScope === 'mga') return item.CL_Name === 'MGA';
                    if (viewScope === 'rga') return !item.CL_Name || item.CL_Name === '';
                  } else {
                    // Single row: include in MGA view, exclude from RGA view
                    return viewScope === 'mga';
                  }
                  return true;
                });
              }
              
              // Deduplicate rows with identical LVL_3_NET values for same REPORT
              const seenValues = new Set();
              const deduplicatedRows = filteredRows.filter(row => {
                const lvl3NetValue = parseFloat(row.LVL_3_NET) || 0;
                const dedupeKey = `${row.REPORT}|${lvl3NetValue}`;
                
                if (seenValues.has(dedupeKey)) {
                  return false; // Skip duplicate
                }
                seenValues.add(dedupeKey);
                return true;
              });
              
              // Sum all LVL_3_NET values across deduplicated rows
              alpMTD = deduplicatedRows.reduce((sum, row) => sum + (parseFloat(row.LVL_3_NET) || 0), 0);
              
              console.log('💰 [OrgMetrics ALP Card] Monthly_ALP data aggregated:', {
                lagnname: user.lagnname,
                totalRows: userDataRows.length,
                filteredRows: filteredRows.length,
                viewScope,
                totalLVL_3_NET: alpMTD
              });
            }
            
            // Set as of date to month key
            setAlpAsOfDate(monthKey);
          }
        } else if (timePeriod === 'ytd' || viewMode === 'year' || viewMode === 'week') {
          // Use Weekly_ALP for YTD/Year/Week views
          const selectedYear = startDate.getFullYear();
          
          console.log('💰 [OrgMetrics ALP Card] Week/Year view data:', {
            viewMode,
            timePeriod,
            selectedYear,
            startDate,
            endDate,
            userLagnname: user.lagnname,
            userRole,
            viewScope
          });
          
          // Adjust date range for week view (reports come out AFTER the week)
          let queryStartDate = startDate;
          let queryEndDate = endDate;
          if (viewMode === 'week') {
            // Reports for week Mon-Sun come out 3-10 days after Sunday
            const sunday = new Date(endDate);
            queryStartDate = new Date(sunday);
            queryStartDate.setDate(sunday.getDate() + 1);
            queryEndDate = new Date(sunday);
            queryEndDate.setDate(sunday.getDate() + 10);
          }
          
          const formattedStartDate = formatToMMDDYYYY(queryStartDate);
          const formattedEndDate = formatToMMDDYYYY(queryEndDate);
          const reportType = viewMode === 'week' ? 'Weekly Recap' : 'YTD Recap';
          
          // Determine endpoint based on viewScope
          let alpEndpoint;
          if (viewScope === 'mga') {
            alpEndpoint = '/alp/getweeklymga';
          } else if (viewScope === 'rga') {
            alpEndpoint = '/alp/getweeklyrga';
          } else {
            alpEndpoint = '/alp/getweeklyall';
          }
          
          const alpRes = await api.get(alpEndpoint, {
            params: {
              startDate: formattedStartDate,
              endDate: formattedEndDate,
              report: reportType
            }
          });
          
          console.log('💰 [OrgMetrics ALP Card] API response:', {
            endpoint: alpEndpoint,
            params: { startDate: formattedStartDate, endDate: formattedEndDate, report: reportType },
            success: alpRes?.data?.success,
            dataLength: alpRes?.data?.data?.length,
            sampleRow: alpRes?.data?.data?.[0]
          });
          
          // Complex aggregation: Sum LVL_3_NET across:
          // 1. All CTLNO codes for this user
          // 2. All reportdates within 3 days of max (Arias Main + New York)
          // 3. Apply CL_Name filtering for MGA/RGA views
          if (alpRes?.data?.success && Array.isArray(alpRes.data.data)) {
            let userDataRows = alpRes.data.data.filter(row => 
              row.LagnName && user.lagnname && 
              row.LagnName.trim().toLowerCase() === user.lagnname.trim().toLowerCase()
            );
            
            if (userDataRows.length > 0) {
              // Find the most recent reportdate
              const maxDate = userDataRows.reduce((max, row) => {
                if (!row.reportdate) return max;
                const rowDate = new Date(row.reportdate);
                return !max || rowDate > max ? rowDate : max;
              }, null);
              
              // Filter to rows within 3 days of max reportdate
              const rowsWithin3Days = userDataRows.filter(row => {
                if (!row.reportdate || !maxDate) return false;
                const rowDate = new Date(row.reportdate);
                const daysDiff = (maxDate - rowDate) / (1000 * 60 * 60 * 24);
                return daysDiff <= 3;
              });
              
              // Apply CL_Name filtering for MGA/RGA views
              let filteredRows = rowsWithin3Days;
              if (viewScope === 'mga' || viewScope === 'rga') {
                filteredRows = rowsWithin3Days.filter(item => {
                  // Check if there's a paired row (same reportdate, REPORT, different CL_Name)
                  const pairedRows = rowsWithin3Days.filter(r => 
                    r.reportdate === item.reportdate && 
                    r.REPORT === item.REPORT
                  );
                  
                  const hasMgaRow = pairedRows.some(r => r.CL_Name === 'MGA');
                  const hasBlankRow = pairedRows.some(r => !r.CL_Name || r.CL_Name === '');
                  
                  if (pairedRows.length >= 2 && hasMgaRow && hasBlankRow) {
                    // Two rows exist: filter by viewScope
                    if (viewScope === 'mga') return item.CL_Name === 'MGA';
                    if (viewScope === 'rga') return !item.CL_Name || item.CL_Name === '';
                  } else {
                    // Single row: include in MGA view, exclude from RGA view
                    return viewScope === 'mga';
                  }
                  return true;
                });
              }
              
              // Deduplicate rows with identical LVL_3_NET values for same reportdate and REPORT
              const seenValues = new Set();
              const deduplicatedRows = filteredRows.filter(row => {
                const lvl3NetValue = parseFloat(row.LVL_3_NET) || 0;
                const dedupeKey = `${row.reportdate}|${row.REPORT}|${lvl3NetValue}`;
                
                if (seenValues.has(dedupeKey)) {
                  return false; // Skip duplicate
                }
                seenValues.add(dedupeKey);
                return true;
              });
              
              // Sum all LVL_3_NET values across deduplicated rows
              alpMTD = deduplicatedRows.reduce((sum, row) => sum + (parseFloat(row.LVL_3_NET) || 0), 0);
              
              if (maxDate) {
                setAlpAsOfDate(maxDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }));
              } else {
                setAlpAsOfDate(`YTD ${selectedYear}`);
              }
              
              console.log('💰 [OrgMetrics ALP Card] User data aggregated:', {
                lagnname: user.lagnname,
                totalRows: userDataRows.length,
                maxDate: maxDate?.toLocaleDateString(),
                rowsWithin3Days: rowsWithin3Days.length,
                filteredRows: filteredRows.length,
                viewScope,
                breakdown: filteredRows.map(r => ({ 
                  CTLNO: r.CTLNO, 
                  CL_Name: r.CL_Name,
                  LVL_3_NET: r.LVL_3_NET, 
                  reportdate: r.reportdate 
                })),
                totalLVL_3_NET: alpMTD
              });
            } else {
              console.log('💰 [OrgMetrics ALP Card] No user data found for:', user.lagnname);
            }
          }
        } else {
          // Use Weekly_ALP for thisMonth (MTD Recap)
          const currentMonth = now.getMonth() + 1;
          const currentYear = now.getFullYear();
          
          let clNameFilter = '';
          if (userRole === 'RGA') {
            clNameFilter = viewScope === 'mga' ? 'MGA' : 'NOT_MGA';
          } else if (userRole === 'MGA') {
            clNameFilter = 'MGA';
          } else if (userRole === 'GA') {
            clNameFilter = 'GA';
          } else if (userRole === 'SA') {
            clNameFilter = 'SA';
          }
          
          const alpRes = await api.get('/alp/weekly/user-alp-mtd', {
            params: {
              lagnname: user.lagnname,
              month: currentMonth,
              year: currentYear,
              clNameFilter: clNameFilter
            }
          });
          
          if (alpRes?.data?.success && alpRes.data.data) {
            alpMTD = alpRes.data.data.LVL_3_NET || 0;
            if (alpRes.data.data.reportdate) {
              setAlpAsOfDate(alpRes.data.data.reportdate);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch ALP data:', e);
      }

      setOrgMetrics({ hiresMTD: totals.hires, codesMTD: totals.codes, vipsMTD: totals.vips, refSalesMTD: totals.refSales, alpMTD });
      setBreakdownData(breakdown);
      
      // Fetch historical comparison data
      await fetchOrgMetricsHistory(lagnNames, startDate);
    } catch (e) {
      console.error('Error fetching org metrics:', e);
      setOrgMetrics({ hiresMTD: 0, codesMTD: 0, vipsMTD: 0, refSalesMTD: 0, alpMTD: 0 });
      setBreakdownData([]);
    } finally {
      setOrgMetricsLoading(false);
    }
  };

  // Fetch historical comparison data (same month last year or previous month)
  const fetchOrgMetricsHistory = async (lagnNames, currentStartDate) => {
    try {
      const now = new Date();
      const currentMonth = currentStartDate.getMonth();
      const currentYear = currentStartDate.getFullYear();
      const isYTD = timePeriod === 'ytd';

      // Calculate previous month for comparison
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      // SGA uses org-wide endpoints for historical comparison
      if (userRole === 'SGA') {
        const [vipsRes, codesRes, hiresRes, refSalesLastYearRes, refSalesPrevMonthRes, alpRes] = await Promise.all([
          api.get('/dataroutes/vips-sga'),
          api.get('/dataroutes/associates-sga'),
          api.get('/dataroutes/org-total-hires'),
          api.get(`/alp/ref-sales?month=${currentMonth + 1}&year=${currentYear - 1}`),
          api.get(`/alp/ref-sales?month=${prevMonth + 1}&year=${prevMonthYear}`),
          api.get('/dataroutes/sga-alp')
        ]);

        const vipsArr = vipsRes?.data?.data || [];
        const codesArr = codesRes?.data?.data || [];
        const hiresArr = hiresRes?.data?.data || [];
        const alpArr = alpRes?.data?.data || [];

        const monthsToConsider = Math.max(0, now.getMonth());

        // Last year same month (or YTD range)
        const vipsLastYear = vipsArr.filter(row => {
          const d = row?.vip_month ? new Date(row.vip_month) : null;
          if (!d) return false;
          if (isYTD) return d.getUTCFullYear() === currentYear - 1 && d.getUTCMonth() < monthsToConsider;
          return d.getUTCFullYear() === currentYear - 1 && d.getUTCMonth() === currentMonth;
        }).length;

        const codesLastYear = codesArr.filter(row => {
          const d = row?.PRODDATE ? new Date(row.PRODDATE) : null;
          if (!d) return false;
          if (isYTD) return d.getUTCFullYear() === currentYear - 1 && d.getUTCMonth() < monthsToConsider;
          return d.getUTCFullYear() === currentYear - 1 && d.getUTCMonth() === currentMonth;
        }).length;

        const hiresLastYear = hiresArr.reduce((sum, row) => {
          const d = row?.MORE_Date ? new Date(row.MORE_Date) : null;
          if (!d) return sum;
          if (isYTD) {
            if (d.getUTCFullYear() === currentYear - 1 && d.getUTCMonth() < monthsToConsider) return sum + (parseFloat(row?.Total_Hires) || 0);
          } else {
            if (d.getUTCFullYear() === currentYear - 1 && d.getUTCMonth() === currentMonth) return sum + (parseFloat(row?.Total_Hires) || 0);
          }
          return sum;
        }, 0);

        // Previous month
        const vipsPrevMonth = vipsArr.filter(row => {
          const d = row?.vip_month ? new Date(row.vip_month) : null;
          return d && d.getUTCFullYear() === prevMonthYear && d.getUTCMonth() === prevMonth;
        }).length;

        const codesPrevMonth = codesArr.filter(row => {
          const d = row?.PRODDATE ? new Date(row.PRODDATE) : null;
          return d && d.getUTCFullYear() === prevMonthYear && d.getUTCMonth() === prevMonth;
        }).length;

        const hiresPrevMonth = hiresArr.reduce((sum, row) => {
          const d = row?.MORE_Date ? new Date(row.MORE_Date) : null;
          if (d && d.getUTCFullYear() === prevMonthYear && d.getUTCMonth() === prevMonth) {
            return sum + (parseFloat(row?.Total_Hires) || 0);
          }
          return sum;
        }, 0);

        // ALP from sga_alp
        let alpLastYear = 0;
        let alpPrevMonth = 0;
        alpArr.forEach(item => {
          if (!item.month) return;
          const parts = item.month.split('/');
          const itemMonth = parseInt(parts[0], 10);
          const itemYear = parseInt(parts[1], 10);
          if (isYTD) {
            if (itemYear === currentYear - 1) alpLastYear += parseFloat(item.net) || 0;
          } else {
            if (itemYear === currentYear - 1 && itemMonth === currentMonth + 1) alpLastYear = parseFloat(item.net) || 0;
          }
          if (itemYear === prevMonthYear && itemMonth === prevMonth + 1) alpPrevMonth = parseFloat(item.net) || 0;
        });

        setOrgMetricsHistory({
          hiresLastYear, codesLastYear, vipsLastYear,
          refSalesLastYear: refSalesLastYearRes?.data?.totalRefSales || 0,
          hiresPrevMonth, codesPrevMonth, vipsPrevMonth,
          refSalesPrevMonth: refSalesPrevMonthRes?.data?.totalRefSales || 0,
          alpLastYear,
          alpPrevMonth
        });
        return;
      }

      const fetchHistoricalForName = async (name) => {
        const enc = encodeURIComponent(name);
        const lastYearMonth = currentMonth + 1; // +1 because getMonth() is 0-indexed
        const lastYearYear = currentYear - 1;
        const prevMonthNum = prevMonth + 1; // +1 because prevMonth is 0-indexed
        
        const [
          vipsLastYearRes, codesLastYearRes, hiresLastYearRes,
          vipsPrevMonthRes, codesPrevMonthRes, hiresPrevMonthRes,
          refSalesPrevMonthRes
        ] = await Promise.all([
          api.get(`/dataroutes/vips/multiple?value=${enc}`),
          api.get(`/dataroutes/associates/multiple?value=${enc}`),
          api.get(`/dataroutes/total-hires?value=${enc}`),
          api.get(`/dataroutes/vips/multiple?value=${enc}`),
          api.get(`/dataroutes/associates/multiple?value=${enc}`),
          api.get(`/dataroutes/total-hires?value=${enc}`),
          api.get(`/alp/ref-sales?month=${prevMonthNum}&year=${prevMonthYear}&lagnName=${enc}`)
        ]);
        
        // Fetch ref sales for last year (same month range for YTD to match YTDSummaryWidget)
        let refSalesLastYear = 0;
        if (isYTD) {
          // Sum ref sales up to same month range as current year (Jan-Sept)
          const monthsToSum = Math.max(0, now.getMonth()); // Exclude current month
          for (let month = 1; month <= monthsToSum; month++) {
            try {
              const refSalesMonthRes = await api.get(`/alp/ref-sales?month=${month}&year=${lastYearYear}&lagnName=${enc}`);
              refSalesLastYear += refSalesMonthRes?.data?.totalRefSales || 0;
            } catch (refError) {
              console.warn(`Failed to fetch ref sales for month ${month} of ${lastYearYear}:`, refError);
            }
          }
        } else {
          // Single month
          const refSalesLastYearRes = await api.get(`/alp/ref-sales?month=${lastYearMonth}&year=${lastYearYear}&lagnName=${enc}`);
          refSalesLastYear = refSalesLastYearRes?.data?.totalRefSales || 0;
        }
        
        // Filter for last year using UTC methods to match YTDSummaryWidget
        // For YTD mode: Codes/VIPs/Ref Sales compare same month range (Jan-Sept vs Jan-Sept)
        // Hires compare full year 2024 vs YTD 2025
        const monthsToConsiderForOthers = Math.max(0, now.getMonth()); // Exclude current month (Sept = 9 months)
        
        const vipsLastYear = (vipsLastYearRes?.data?.data || []).filter((row) => {
          const d = row?.vip_month ? new Date(row.vip_month) : null;
          if (!d) return false;
          const year = d.getUTCFullYear();
          const month = d.getUTCMonth();
          
          if (isYTD) {
            // For YTD: match same month range as current year (Jan-Sept)
            return year === currentYear - 1 && month < monthsToConsiderForOthers;
          } else {
            // For single month: match same month of previous year
            return year === currentYear - 1 && month === currentMonth;
          }
        }).length;
        
        const codesLastYear = (codesLastYearRes?.data?.data || []).filter((row) => {
          const d = row?.PRODDATE ? new Date(row.PRODDATE) : null;
          if (!d) return false;
          const year = d.getUTCFullYear();
          const month = d.getUTCMonth();
          
          if (isYTD) {
            // For YTD: match same month range as current year (Jan-Sept)
            return year === currentYear - 1 && month < monthsToConsiderForOthers;
          } else {
            // For single month: match same month of previous year
            return year === currentYear - 1 && month === currentMonth;
          }
        }).length;
        
        const hiresLastYear = (hiresLastYearRes?.data?.data || []).reduce((sum, row) => {
          const d = row?.MORE_Date ? new Date(row.MORE_Date) : null;
          if (!d) return sum;
          const year = d.getUTCFullYear();
          const month = d.getUTCMonth();
          
          let shouldInclude = false;
          if (isYTD) {
            // For YTD: Hires use same month range as Codes/VIPs (Jan-Sept)
            shouldInclude = year === currentYear - 1 && month < monthsToConsiderForOthers;
          } else {
            // For single month: match same month of previous year
            shouldInclude = year === currentYear - 1 && month === currentMonth;
          }
          
          if (shouldInclude) {
            return sum + (parseFloat(row?.Total_Hires) || 0);
          }
          return sum;
        }, 0);
        
        // Filter for previous month using UTC methods to match ScorecardTable
        const vipsPrevMonth = (vipsPrevMonthRes?.data?.data || []).filter((row) => {
          const d = row?.vip_month ? new Date(row.vip_month) : null;
          if (!d) return false;
          const year = d.getUTCFullYear();
          const month = d.getUTCMonth();
          return year === prevMonthYear && month === prevMonth;
        }).length;
        
        const codesPrevMonth = (codesPrevMonthRes?.data?.data || []).filter((row) => {
          const d = row?.PRODDATE ? new Date(row.PRODDATE) : null;
          if (!d) return false;
          const year = d.getUTCFullYear();
          const month = d.getUTCMonth();
          return year === prevMonthYear && month === prevMonth;
        }).length;
        
        const hiresPrevMonth = (hiresPrevMonthRes?.data?.data || []).reduce((sum, row) => {
          const d = row?.MORE_Date ? new Date(row.MORE_Date) : null;
          if (!d) return sum;
          const year = d.getUTCFullYear();
          const month = d.getUTCMonth();
          
          if (year === prevMonthYear && month === prevMonth) {
            return sum + (parseFloat(row?.Total_Hires) || 0);
          }
          return sum;
        }, 0);
        
        // Ref sales prev month is already filtered by month/year in the API call
        const refSalesPrevMonth = refSalesPrevMonthRes?.data?.totalRefSales || 0;
        
        return {
          vipsLastYear, codesLastYear, hiresLastYear,
          vipsPrevMonth, codesPrevMonth, hiresPrevMonth,
          refSalesLastYear, refSalesPrevMonth
        };
      };
      
      const results = await Promise.all(lagnNames.map(fetchHistoricalForName));
      
      const history = {
        hiresLastYear: results.reduce((sum, r) => sum + r.hiresLastYear, 0),
        codesLastYear: results.reduce((sum, r) => sum + r.codesLastYear, 0),
        vipsLastYear: results.reduce((sum, r) => sum + r.vipsLastYear, 0),
        refSalesLastYear: results.reduce((sum, r) => sum + r.refSalesLastYear, 0),
        hiresPrevMonth: results.reduce((sum, r) => sum + r.hiresPrevMonth, 0),
        codesPrevMonth: results.reduce((sum, r) => sum + r.codesPrevMonth, 0),
        vipsPrevMonth: results.reduce((sum, r) => sum + r.vipsPrevMonth, 0),
        refSalesPrevMonth: results.reduce((sum, r) => sum + r.refSalesPrevMonth, 0)
      };
      
      // Fetch ALP historical data
      // For YTD: sum all 12 months of previous year (full year)
      // For single month: just get that month
      try {
        if (isYTD) {
          // Fetch full year sum for last year (all 12 months)
          let alpYTDLastYear = 0;
          for (let month = 1; month <= 12; month++) {
            const monthKey = `${String(month).padStart(2, '0')}/${currentYear - 1}`;
            try {
              const alpMonthRes = await api.get('/alp/mga/monthly-alp', {
                params: {
                  lagnName: user.lagnname,
                  month: monthKey,
                  viewMode: viewScope
                },
                headers: {
                  'user-role': userRole
                }
              });
              
              if (alpMonthRes?.data?.success && alpMonthRes.data.data && alpMonthRes.data.data.length > 0) {
                alpYTDLastYear += parseFloat(alpMonthRes.data.data[0].LVL_3_NET) || 0;
              }
            } catch (monthError) {
              console.warn(`Failed to fetch ALP for month ${month} of ${currentYear - 1}:`, monthError);
            }
          }
          history.alpLastYear = alpYTDLastYear;
        } else {
          // Single month comparison
          const lastYearMonthKey = `${String(currentMonth + 1).padStart(2, '0')}/${currentYear - 1}`;
          const alpLastYearRes = await api.get('/alp/mga/monthly-alp', {
            params: {
              lagnName: user.lagnname,
              month: lastYearMonthKey,
              viewMode: viewScope
            },
            headers: {
              'user-role': userRole
            }
          });
          
          if (alpLastYearRes?.data?.success && alpLastYearRes.data.data && alpLastYearRes.data.data.length > 0) {
            history.alpLastYear = parseFloat(alpLastYearRes.data.data[0].LVL_3_NET) || 0;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch last year ALP:', e);
      }
      
      // Previous month
      try {
        const prevMonthKey = `${String(prevMonth + 1).padStart(2, '0')}/${prevMonthYear}`;
        const alpPrevMonthRes = await api.get('/alp/mga/monthly-alp', {
          params: {
            lagnName: user.lagnname,
            month: prevMonthKey,
            viewMode: viewScope
          },
          headers: {
            'user-role': userRole
          }
        });
        
        if (alpPrevMonthRes?.data?.success && alpPrevMonthRes.data.data && alpPrevMonthRes.data.data.length > 0) {
          history.alpPrevMonth = parseFloat(alpPrevMonthRes.data.data[0].LVL_3_NET) || 0;
        }
      } catch (e) {
        console.warn('Failed to fetch previous month ALP:', e);
      }
      
      setOrgMetricsHistory(history);
    } catch (e) {
      console.error('Error fetching historical org metrics:', e);
      setOrgMetricsHistory(null);
    }
  };

  // Helper function to group data by month and year
  const groupByMonthAndYear = (data, dateField) => {
    const grouped = {};
    
    data.forEach(row => {
      const dateValue = row[dateField];
      if (!dateValue) return;
      
      const date = new Date(dateValue);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-indexed
      
      if (!grouped[year]) {
        grouped[year] = Array(12).fill(0);
      }
      
      grouped[year][month] += 1;
    });
    
    return grouped;
  };

  // Fetch YTD Summary data
  const fetchYTDSummaryData = async () => {
    try {
      if (!['MGA', 'RGA', 'GA', 'SA', 'SGA'].includes(userRole)) return;
      if (!user?.lagnname) return;
      // SGA always fetches YTD summary; other roles only when in year view
      if (userRole !== 'SGA' && timePeriod !== 'ytd') return;

      const isOrgScope = (userRole === 'MGA' && viewScope === 'team') ||
                         (userRole === 'RGA' && (viewScope === 'mga' || viewScope === 'rga')) ||
                         (userRole === 'GA' && viewScope === 'team') ||
                         (userRole === 'SA' && viewScope === 'team') ||
                         (userRole === 'SGA');

      if (!isOrgScope) return;

      // SGA-specific YTD data fetching using org-wide endpoints
      if (userRole === 'SGA') {
        const now = new Date();
        const currentYear = now.getFullYear();
        const lastYear = currentYear - 1;

        const [vipsRes, codesRes, hiresRes, alpRes] = await Promise.all([
          api.get('/dataroutes/vips-sga'),
          api.get('/dataroutes/associates-sga'),
          api.get('/dataroutes/org-total-hires'),
          api.get('/dataroutes/sga-alp')
        ]);

        const allVips = vipsRes?.data?.data || [];
        const allCodes = codesRes?.data?.data || [];
        const allHires = hiresRes?.data?.data || [];
        const alpRows = alpRes?.data?.data || [];

        // Build ALP data from sga-alp (month format: "M/YYYY")
        const alpData = {};
        alpData[currentYear] = Array(12).fill(0);
        alpData[lastYear] = Array(12).fill(0);
        alpRows.forEach(row => {
          if (!row.month) return;
          const parts = row.month.split('/');
          if (parts.length !== 2) return;
          const m = parseInt(parts[0], 10) - 1;
          const y = parseInt(parts[1], 10);
          if (alpData[y] && m >= 0 && m < 12) {
            alpData[y][m] = parseFloat(row.net) || 0;
          }
        });

        // Group hires by month/year
        const hiresData = {};
        allHires.forEach(row => {
          const date = row.MORE_Date ? new Date(row.MORE_Date) : null;
          if (date) {
            const year = date.getFullYear();
            const month = date.getMonth();
            if (!hiresData[year]) hiresData[year] = Array(12).fill(0);
            hiresData[year][month] += parseFloat(row.Total_Hires) || 0;
          }
        });

        setYtdSummaryData({
          alpData,
          hiresData,
          associatesData: allCodes,
          vipsData: allVips,
          mgaStartDate: null
        });
        return;
      }

      let lagnNames = [user.lagnname];
      
      if (userRole === 'RGA' && viewScope === 'rga') {
        try {
          const rollupRes = await api.get(`/mga-hierarchy/rga-rollup/${encodeURIComponent(user.lagnname)}`);
          if (rollupRes?.data?.success) {
            const mgas = rollupRes.data.data.mgas || [];
            const mgaNames = mgas.map(m => m.lagnname).filter(Boolean);
            lagnNames = [user.lagnname, ...mgaNames];
          }
        } catch (e) {
          console.warn('Failed to load RGA rollup for YTD summary', e);
        }
      }

      // Fetch raw data for all MGAs
      const results = await Promise.all(
        lagnNames.map(async (name) => {
          const enc = encodeURIComponent(name);
          const [vipsRes, codesRes, hiresRes] = await Promise.all([
            api.get(`/dataroutes/vips/multiple?value=${enc}`),
            api.get(`/dataroutes/associates/multiple?value=${enc}`),
            api.get(`/dataroutes/total-hires?value=${enc}`)
          ]);
          return {
            vips: vipsRes?.data?.data || [],
            codes: codesRes?.data?.data || [],
            hires: hiresRes?.data?.data || []
          };
        })
      );

      // Combine all data
      const allVips = results.flatMap(r => r.vips);
      const allCodes = results.flatMap(r => r.codes);
      const allHires = results.flatMap(r => r.hires);

      // Fetch ALP data from Monthly_ALP
      const now = new Date();
      const currentYear = now.getFullYear();
      const lastYear = currentYear - 1;
      const alpData = {};

      // Fetch ALP for current year and last year
      for (const year of [lastYear, currentYear]) {
        alpData[year] = Array(12).fill(0);
        for (let month = 1; month <= 12; month++) {
          const monthKey = `${String(month).padStart(2, '0')}/${year}`;
          try {
            const alpRes = await api.get('/alp/mga/monthly-alp', {
              params: {
                lagnName: user.lagnname,
                month: monthKey,
                viewMode: viewScope
              },
              headers: {
                'user-role': userRole
              }
            });
            
            if (alpRes?.data?.success && alpRes.data.data && alpRes.data.data.length > 0) {
              alpData[year][month - 1] = parseFloat(alpRes.data.data[0].LVL_3_NET) || 0;
            }
          } catch (e) {
            // Ignore errors for individual months
          }
        }
      }

      // Group hires by month/year
      const hiresData = {};
      allHires.forEach(row => {
        const date = row.MORE_Date ? new Date(row.MORE_Date) : null;
        if (date) {
          const year = date.getFullYear();
          const month = date.getMonth();
          
          if (!hiresData[year]) {
            hiresData[year] = Array(12).fill(0);
          }
          
          hiresData[year][month] += parseFloat(row.Total_Hires) || 0;
        }
      });

      setYtdSummaryData({
        alpData,
        hiresData,
        associatesData: allCodes,
        vipsData: allVips,
        mgaStartDate: null // TODO: Get from user data if available
      });
    } catch (e) {
      console.error('Error fetching YTD summary data:', e);
    }
  };

  // Fetch ref sales agent-level breakdown
  const fetchRefSalesBreakdown = async () => {
    try {
      if (!['MGA', 'RGA', 'GA', 'SA', 'SGA'].includes(userRole)) return;
      if (!user?.lagnname) return;
      
      const dateRange = getDateRange();
      const { startDate } = dateRange;
      const month = startDate.getMonth() + 1;
      const year = startDate.getFullYear();

      let lagnNames = [user.lagnname];
      
      if (userRole === 'RGA' && viewScope === 'rga') {
        try {
          const rollupRes = await api.get(`/mga-hierarchy/rga-rollup/${encodeURIComponent(user.lagnname)}`);
          if (rollupRes?.data?.success) {
            const mgas = rollupRes.data.data.mgas || [];
            const mgaNames = mgas.map(m => m.lagnname).filter(Boolean);
            lagnNames = [user.lagnname, ...mgaNames];
          }
        } catch (e) {
          console.warn('Failed to load RGA rollup for ref sales', e);
        }
      }

      const breakdownResults = await Promise.all(
        lagnNames.map(async (name) => {
          try {
            const enc = encodeURIComponent(name);
            const res = await api.get(`/alp/ref-sales-breakdown?month=${month}&year=${year}&lagnName=${enc}`);
            return { mga: name, agents: res?.data?.data || [] };
          } catch (e) {
            console.warn(`Failed to fetch ref sales breakdown for ${name}:`, e);
            return { mga: name, agents: [] };
          }
        })
      );

      setRefSalesBreakdown(breakdownResults);
    } catch (e) {
      console.error('Error fetching ref sales breakdown:', e);
      setRefSalesBreakdown([]);
    }
  };

  // Fetch Official ALP from Weekly_ALP or Monthly_ALP for Personal View
  const fetchPersonalOfficialAlp = async () => {
    try {
      if (!user?.lagnname || viewScope !== 'personal') {
        setPersonalOfficialAlp(null);
        setHasOfficialAlpData(false);
        return;
      }

      // Get date range
      const startDate = parseLocalDate(dateRangeState.start);
      const endDate = parseLocalDate(dateRangeState.end);
      
      // Determine if we should use Monthly_ALP or Weekly_ALP
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const selectedMonth = startDate.getMonth();
      const selectedYear = startDate.getFullYear();
      
      // Calculate how many months ago the selected month is
      const monthsAgo = (currentYear - selectedYear) * 12 + (currentMonth - selectedMonth);
      
      const isPreviousMonth = viewMode === 'month' && monthsAgo >= 2;

      let officialAlp = 0;
      let hasData = false;

      if (isPreviousMonth) {
        // Use Monthly_ALP for previous months
        const monthParam = `${String(selectedMonth + 1).padStart(2, '0')}/${selectedYear}`;
        
        try {
          const response = await api.get('/alp/getmonthlyall', {
            params: { month: monthParam }
          });
          
          if (response.data.success) {
            // Filter to user's rows
            const userDataRows = response.data.data.filter(row => 
              row.LagnName && user.lagnname && 
              row.LagnName.trim().toLowerCase() === user.lagnname.trim().toLowerCase()
            );
            
            // Deduplicate and sum all CTLNO codes for this user (Monthly_ALP can also have multiple CTLNO)
            if (userDataRows.length > 0) {
              // Deduplicate rows with identical LVL_1_NET values for same REPORT
              const seenValues = new Set();
              const deduplicatedRows = userDataRows.filter(row => {
                const lvl1NetValue = parseFloat(row.LVL_1_NET) || 0;
                const dedupeKey = `${row.REPORT}|${lvl1NetValue}`;
                
                if (seenValues.has(dedupeKey)) {
                  return false; // Skip duplicate
                }
                seenValues.add(dedupeKey);
                return true;
              });
              
              officialAlp = deduplicatedRows.reduce((sum, row) => {
                return sum + (parseFloat(row.LVL_1_NET) || 0);
              }, 0);
              hasData = true;
            }
          }
        } catch (error) {
          // No Monthly_ALP data found
        }
      } else {
        // Use Weekly_ALP for current period or weeks
        let queryStartDate, queryEndDate;
        if (viewMode === 'year') {
          // Force full year range to avoid picking up previous year's YTD
          queryStartDate = new Date(startDate.getFullYear(), 0, 1);
          queryEndDate = new Date(startDate.getFullYear(), 11, 31);
        } else if (viewMode === 'week') {
          // For week view, shift date range forward since reports come out AFTER the week
          // Reports for week Mon-Sun come out 3-10 days after Sunday
          const sunday = new Date(endDate); // endDate should be the Sunday
          queryStartDate = new Date(sunday);
          queryStartDate.setDate(sunday.getDate() + 1); // Day after week ends
          queryEndDate = new Date(sunday);
          queryEndDate.setDate(sunday.getDate() + 10); // Up to 10 days after week ends
        } else if (viewMode === 'month') {
          // For MTD Recap, avoid querying the entire month (can be very heavy).
          // Use the backend-provided +/- 3 day range around the latest reportdate.
          try {
            const reportDatesResponse = await api.getCached('/alp/getReportDates', { reportType: 'MTD Recap' });
            const rangeStart = reportDatesResponse?.data?.range?.start;
            const rangeEnd = reportDatesResponse?.data?.range?.end;
            if (rangeStart && rangeEnd) {
              queryStartDate = new Date(rangeStart);
              queryEndDate = new Date(rangeEnd);
            } else {
              queryStartDate = startDate;
              queryEndDate = endDate;
            }
          } catch {
            queryStartDate = startDate;
            queryEndDate = endDate;
          }
        } else {
          queryStartDate = startDate;
          queryEndDate = endDate;
        }
        
        const formattedStartDate = formatToMMDDYYYY(queryStartDate);
        const formattedEndDate = formatToMMDDYYYY(queryEndDate);
        
        // Determine report type based on viewMode
        let reportType = 'Weekly Recap';
        if (viewMode === 'month') {
          reportType = 'MTD Recap';
        } else if (viewMode === 'year') {
          reportType = 'YTD Recap';
        }
        
        try {
          const response = await api.get('/alp/getweeklyall', {
            params: {
              startDate: formattedStartDate,
              endDate: formattedEndDate,
              report: reportType
            }
          });
          
          if (response.data.success && response.data.data.length > 0) {
            // Filter to only records matching the user
            let userDataRows = response.data.data.filter(row => 
              row.LagnName && user.lagnname && 
              row.LagnName.trim().toLowerCase() === user.lagnname.trim().toLowerCase()
            );
            
            // For year view, ensure we only get data from the selected year
            if (viewMode === 'year' && userDataRows.length > 0) {
              const targetYear = startDate.getFullYear();
              userDataRows = userDataRows.filter(row => {
                if (!row.reportdate) return false;
                // Parse reportdate (format: MM/DD/YYYY)
                const reportParts = row.reportdate.split('/');
                if (reportParts.length !== 3) return false;
                const reportYear = parseInt(reportParts[2]);
                return reportYear === targetYear;
              });
            }
            
            if (userDataRows.length > 0) {
              // Apply 3-day aggregation logic (same as leaderboard)
              // 1. Find the most recent reportdate
              const maxDate = userDataRows.reduce((max, row) => {
                if (!row.reportdate) return max;
                const rowDate = new Date(row.reportdate);
                return !max || rowDate > max ? rowDate : max;
              }, null);
              
              // 2. Filter to rows within 3 days of max reportdate
              const rowsWithin3Days = userDataRows.filter(row => {
                if (!row.reportdate || !maxDate) return false;
                const rowDate = new Date(row.reportdate);
                const daysDiff = (maxDate - rowDate) / (1000 * 60 * 60 * 24);
                return daysDiff <= 3;
              });
              
              // 3. Deduplicate and sum LVL_1_NET across all CTLNO codes within 3-day window
              const seenValues = new Set();
              const deduplicatedRows = rowsWithin3Days.filter(row => {
                const lvl1NetValue = parseFloat(row.LVL_1_NET) || 0;
                const dedupeKey = `${row.reportdate}|${row.REPORT}|${lvl1NetValue}`;
                
                if (seenValues.has(dedupeKey)) {
                  return false; // Skip duplicate
                }
                seenValues.add(dedupeKey);
                return true;
              });
              
              officialAlp = deduplicatedRows.reduce((sum, row) => {
                return sum + (parseFloat(row.LVL_1_NET) || 0);
              }, 0);
              
              hasData = deduplicatedRows.length > 0;
            }
          }
        } catch (error) {
          // No Weekly_ALP data found
        }
      }
      
      setPersonalOfficialAlp(officialAlp);
      setHasOfficialAlpData(hasData);
      
    } catch (error) {
      console.error('[TeamDashboard] Error fetching official ALP:', error);
      setPersonalOfficialAlp(null);
      setHasOfficialAlpData(false);
    }
  };

  // Fetch Activity Data
  const fetchActivityData = async () => {
    try {
      setActivityLoading(true);
      setActivityError('');

      if (!user?.userId) {
        setActivityError('User information not available');
        return;
      }

      // Use main date range selector for all views
      const dateRange = {
        startDate: dateRangeState.start,
        endDate: dateRangeState.end
      };
      
      if (!dateRange.startDate || !dateRange.endDate) {
        setActivityError('Invalid date range');
        return;
      }

      // Fetch activity data from Daily_Activity table
      let endpoint;
      const ln = encodeURIComponent(user?.lagnname || '');
      const uid = encodeURIComponent(String(user?.userId || ''));
      
      if (['SA','GA','MGA'].includes(userRole) && viewScope === 'team') {
        endpoint = `/dailyActivity/team-summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&lagnname=${ln}&userId=${uid}`;
      } else if (userRole === 'RGA' && viewScope === 'mga') {
        endpoint = `/dailyActivity/team-summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&lagnname=${ln}&userId=${uid}`;
      } else if (userRole === 'RGA' && viewScope === 'rga') {
        endpoint = `/dailyActivity/team-summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&lagnname=${ln}&userId=${uid}&roleScope=rga`;
      } else {
        endpoint = `/dailyActivity/user-summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&userId=${uid}`;
      }
      
      const activityResponse = await api.get(endpoint);
      
      if (activityResponse.data.success) {
        // Aggregate the daily activity data
        const dailyData = activityResponse.data.data;
        const aggregated = dailyData.reduce((acc, day) => {
          acc.calls += parseFloat(day.calls) || 0;
          acc.appts += parseFloat(day.appts) || 0;
          acc.sits += parseFloat(day.sits) || 0;
          acc.sales += parseFloat(day.sales) || 0;
          acc.alp += parseFloat(day.alp) || 0;
          acc.refs += parseFloat(day.refs) || 0;
          acc.refAppt += parseFloat(day.refAppt) || 0;
          acc.refSit += parseFloat(day.refSit) || 0;
          acc.refSale += parseFloat(day.refSale) || 0;
          acc.refAlp += parseFloat(day.refAlp) || 0;
          return acc;
        }, {
          calls: 0, appts: 0, sits: 0, sales: 0, alp: 0,
          refs: 0, refAppt: 0, refSit: 0, refSale: 0, refAlp: 0
        });

        setActivityData(aggregated);

        // Personal cards default to Reported ALP (Daily Activity).
        // Only fetch Official ALP (Weekly/Monthly_ALP) when user explicitly switches to it.
      } else {
        throw new Error('Failed to fetch activity data');
      }

    } catch (error) {
      console.error('Error fetching activity data:', error);
      setActivityError('Failed to load activity data: ' + (error.response?.data?.message || error.message));
      
      // Set fallback data
      setActivityData({
        calls: 0, appts: 0, sits: 0, sales: 0, alp: 0,
        refs: 0, refAppt: 0, refSit: 0, refSale: 0, refAlp: 0
      });
    } finally {
      setActivityLoading(false);
    }
  };

  // Fetch official ALP lazily:
  // In Personal view, the cards render immediately using Reported ALP from Daily Activity.
  // Only hit Weekly/Monthly_ALP when the user switches the card to "Official".
  useEffect(() => {
    if (viewScope !== 'personal') return;
    if (personalAlpMode !== 'official') return;
    fetchPersonalOfficialAlp();
  }, [viewScope, personalAlpMode, dateRangeState, viewMode, user?.lagnname]);

  // Fetch MGA Official ALP (from Weekly_ALP or Monthly_ALP)
  const fetchMgaOfficialAlp = async () => {
    try {
      if (!user?.lagnname) return;
      if (viewScope !== 'mga') return;
      
      const dateRange = getDateRange();
      const startDate = dateRange.startDate;
      const endDate = dateRange.endDate;
      
      let officialAlp = 0;
      let hasData = false;
      
      // Determine if using Monthly_ALP (previous month) or Weekly_ALP (current period)
      const isPreviousMonth = timePeriod === 'previousMonth' || timePeriod === 'lastMonth';
      
      if (isPreviousMonth) {
        // Use Monthly_ALP
        const monthParam = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
        
        try {
          const response = await api.get('/alp/getmonthlymga', { params: { month: monthParam } });
          
          if (response.data.success && response.data.data.length > 0) {
            // Aggregate LVL_3_NET for all MGAs (team production)
            officialAlp = response.data.data.reduce((sum, row) => {
              return sum + (parseFloat(row.LVL_3_NET) || 0);
            }, 0);
            hasData = response.data.data.length > 0;
          }
        } catch (error) {
          // No Monthly_ALP data found
        }
      } else {
        // Use Weekly_ALP for current period
        let queryStartDate, queryEndDate;
        if (viewMode === 'year') {
          queryStartDate = new Date(startDate.getFullYear(), 0, 1);
          queryEndDate = new Date(startDate.getFullYear(), 11, 31);
        } else if (viewMode === 'week') {
          const sunday = new Date(endDate);
          queryStartDate = new Date(sunday);
          queryStartDate.setDate(sunday.getDate() + 1);
          queryEndDate = new Date(sunday);
          queryEndDate.setDate(sunday.getDate() + 10);
        } else if (viewMode === 'month') {
          try {
            const reportDatesResponse = await api.getCached('/alp/getReportDates', { reportType: 'MTD Recap' });
            const rangeStart = reportDatesResponse?.data?.range?.start;
            const rangeEnd = reportDatesResponse?.data?.range?.end;
            if (rangeStart && rangeEnd) {
              queryStartDate = new Date(rangeStart);
              queryEndDate = new Date(rangeEnd);
            } else {
              queryStartDate = startDate;
              queryEndDate = endDate;
            }
          } catch {
            queryStartDate = startDate;
            queryEndDate = endDate;
          }
        } else {
          queryStartDate = startDate;
          queryEndDate = endDate;
        }
        
        const formattedStartDate = formatToMMDDYYYY(queryStartDate);
        const formattedEndDate = formatToMMDDYYYY(queryEndDate);
        
        let reportType = 'Weekly Recap';
        if (viewMode === 'month') reportType = 'MTD Recap';
        else if (viewMode === 'year') reportType = 'YTD Recap';
        
        try {
          const response = await api.get('/alp/getweeklymga', {
            params: { startDate: formattedStartDate, endDate: formattedEndDate, report: reportType }
          });
          
          if (response.data.success && response.data.data.length > 0) {
            // Aggregate LVL_3_NET for all MGAs (team production)
            officialAlp = response.data.data.reduce((sum, row) => {
              return sum + (parseFloat(row.LVL_3_NET) || 0);
            }, 0);
            hasData = response.data.data.length > 0;
          }
        } catch (error) {
          // No Weekly_ALP data found
        }
      }
      
      setMgaOfficialAlp(officialAlp);
      setHasMgaOfficialAlpData(hasData);
      
    } catch (error) {
      console.error('[TeamDashboard] Error fetching MGA official ALP:', error);
      setMgaOfficialAlp(null);
      setHasMgaOfficialAlpData(false);
    }
  };

  // Fetch RGA Official ALP (from Weekly_ALP or Monthly_ALP)
  const fetchRgaOfficialAlp = async () => {
    try {
      if (!user?.lagnname) return;
      if (viewScope !== 'rga') return;
      
      const dateRange = getDateRange();
      const startDate = dateRange.startDate;
      const endDate = dateRange.endDate;
      
      let officialAlp = 0;
      let hasData = false;
      
      const isPreviousMonth = timePeriod === 'previousMonth' || timePeriod === 'lastMonth';
      
      if (isPreviousMonth) {
        const monthParam = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
        
        try {
          const response = await api.get('/alp/getmonthlyrga', { params: { month: monthParam } });
          
          if (response.data.success && response.data.data.length > 0) {
            // Aggregate LVL_3_NET for all RGAs (team production)
            officialAlp = response.data.data.reduce((sum, row) => {
              return sum + (parseFloat(row.LVL_3_NET) || 0);
            }, 0);
            hasData = response.data.data.length > 0;
          }
        } catch (error) {
          // No Monthly_ALP data found
        }
      } else {
        let queryStartDate, queryEndDate;
        if (viewMode === 'year') {
          queryStartDate = new Date(startDate.getFullYear(), 0, 1);
          queryEndDate = new Date(startDate.getFullYear(), 11, 31);
        } else if (viewMode === 'week') {
          const sunday = new Date(endDate);
          queryStartDate = new Date(sunday);
          queryStartDate.setDate(sunday.getDate() + 1);
          queryEndDate = new Date(sunday);
          queryEndDate.setDate(sunday.getDate() + 10);
        } else if (viewMode === 'month') {
          try {
            const reportDatesResponse = await api.getCached('/alp/getReportDates', { reportType: 'MTD Recap' });
            const rangeStart = reportDatesResponse?.data?.range?.start;
            const rangeEnd = reportDatesResponse?.data?.range?.end;
            if (rangeStart && rangeEnd) {
              queryStartDate = new Date(rangeStart);
              queryEndDate = new Date(rangeEnd);
            } else {
              queryStartDate = startDate;
              queryEndDate = endDate;
            }
          } catch {
            queryStartDate = startDate;
            queryEndDate = endDate;
          }
        } else {
          queryStartDate = startDate;
          queryEndDate = endDate;
        }
        
        const formattedStartDate = formatToMMDDYYYY(queryStartDate);
        const formattedEndDate = formatToMMDDYYYY(queryEndDate);
        
        let reportType = 'Weekly Recap';
        if (viewMode === 'month') reportType = 'MTD Recap';
        else if (viewMode === 'year') reportType = 'YTD Recap';
        
        try {
          const response = await api.get('/alp/getweeklyrga', {
            params: { startDate: formattedStartDate, endDate: formattedEndDate, report: reportType }
          });
          
          if (response.data.success && response.data.data.length > 0) {
            // Aggregate LVL_3_NET for all RGAs (team production)
            officialAlp = response.data.data.reduce((sum, row) => {
              return sum + (parseFloat(row.LVL_3_NET) || 0);
            }, 0);
            hasData = response.data.data.length > 0;
          }
        } catch (error) {
          // No Weekly_ALP data found
        }
      }
      
      setRgaOfficialAlp(officialAlp);
      setHasRgaOfficialAlpData(hasData);
      
    } catch (error) {
      console.error('[TeamDashboard] Error fetching RGA official ALP:', error);
      setRgaOfficialAlp(null);
      setHasRgaOfficialAlpData(false);
    }
  };

  // Fetch MGA official ALP when toggled
  useEffect(() => {
    if (viewScope !== 'mga') return;
    if (mgaAlpMode !== 'official') return;
    fetchMgaOfficialAlp();
  }, [viewScope, mgaAlpMode, dateRangeState, viewMode, user?.lagnname]);

  // Fetch RGA official ALP when toggled
  useEffect(() => {
    if (viewScope !== 'rga') return;
    if (rgaAlpMode !== 'official') return;
    fetchRgaOfficialAlp();
  }, [viewScope, rgaAlpMode, dateRangeState, viewMode, user?.lagnname]);

  // Fetch Personal Goal
  const fetchPersonalGoal = async () => {
    try {
      if (!user?.userId) return;
      
      // Get month/year from date range selector
      const rangeStart = parseLocalDate(dateRangeState.start);
      const month = rangeStart.getMonth() + 1;
      const year = rangeStart.getFullYear();
      
      const response = await api.get(`/goals/${user.userId}/${year}/${month}`, {
        params: { goalType: 'personal' }
      });
      
      if (response.data?.monthlyAlpGoal) {
        setPersonalGoal(parseFloat(response.data.monthlyAlpGoal));
      } else {
        setPersonalGoal(null);
      }
    } catch (error) {
      console.error('Error fetching personal goal:', error);
      setPersonalGoal(null);
    }
  };

  // Fetch Personal Comparison Data (for card comparisons)
  const fetchPersonalComparison = async () => {
    try {
      if (!user?.userId) return;
      
      const now = new Date();
      const rangeStart = parseLocalDate(dateRangeState.start);
      const rangeEnd = parseLocalDate(dateRangeState.end);
      
      // Calculate comparison period (prefer same period last year, fall back to previous month)
      let comparisonStart, comparisonEnd, comparisonLabel;
      
      if (viewMode === 'year') {
        // YTD: Compare to full previous year
        comparisonStart = new Date(rangeStart.getFullYear() - 1, 0, 1);
        comparisonEnd = new Date(rangeStart.getFullYear() - 1, 11, 31);
        comparisonLabel = 'vs last year';
      } else if (viewMode === 'month') {
        // Month: Compare to same month last year
        comparisonStart = new Date(rangeStart.getFullYear() - 1, rangeStart.getMonth(), 1);
        comparisonEnd = new Date(rangeStart.getFullYear() - 1, rangeStart.getMonth() + 1, 0);
        comparisonLabel = 'vs last year';
      } else {
        // Week: Compare to previous month's similar period
        const daysDiff = Math.ceil((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24));
        comparisonEnd = new Date(rangeStart);
        comparisonEnd.setDate(comparisonEnd.getDate() - 1);
        comparisonStart = new Date(comparisonEnd);
        comparisonStart.setDate(comparisonStart.getDate() - daysDiff);
        comparisonLabel = 'vs prev period';
      }
      
      const uid = encodeURIComponent(String(user?.userId || ''));
      const currentEndpoint = `/dailyActivity/user-summary?startDate=${dateRangeState.start}&endDate=${dateRangeState.end}&userId=${uid}`;
      const comparisonEndpoint = `/dailyActivity/user-summary?startDate=${formatLocalDate(comparisonStart)}&endDate=${formatLocalDate(comparisonEnd)}&userId=${uid}`;
      
      const [currentResponse, comparisonResponse] = await Promise.all([
        api.get(currentEndpoint),
        api.get(comparisonEndpoint)
      ]);
      
      const aggregateDailyData = (data) => {
        return (data || []).reduce((acc, day) => {
          acc.calls += parseFloat(day.calls) || 0;
          acc.appts += parseFloat(day.appts) || 0;
          acc.sits += parseFloat(day.sits) || 0;
          acc.sales += parseFloat(day.sales) || 0;
          acc.alp += parseFloat(day.alp) || 0;
          acc.refs += parseFloat(day.refs) || 0;
          return acc;
        }, { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0, refs: 0 });
      };
      
      const currentData = aggregateDailyData(currentResponse.data?.data);
      const comparisonData = aggregateDailyData(comparisonResponse.data?.data);
      
      setPersonalComparison({
        calls: currentData.calls - comparisonData.calls,
        appts: currentData.appts - comparisonData.appts,
        sits: currentData.sits - comparisonData.sits,
        sales: currentData.sales - comparisonData.sales,
        alp: currentData.alp - comparisonData.alp,
        refs: currentData.refs - comparisonData.refs,
        label: comparisonLabel
      });
    } catch (error) {
      console.error('Error fetching personal comparison data:', error);
      setPersonalComparison(null);
    }
  };

  // Fetch Personal Stats Data (for card ratios)
  // Removed - consolidated into fetchStatsData to eliminate duplicate API call

  // Fetch Statistics Data
  const fetchStatsData = async () => {
    try {
      setStatsLoading(true);
      if (!user?.userId) return;

      const { startDate, endDate } = getStatsDateRange();
      let statsEndpoint;
      const isTeamScope = (['SA','GA','MGA'].includes(userRole) && viewScope === 'team');
      
      if (isTeamScope) {
        const ln = encodeURIComponent(user?.lagnname || '');
        const uid = encodeURIComponent(String(user?.userId || ''));
        statsEndpoint = `/dailyActivity/team-summary?startDate=${startDate}&endDate=${endDate}&lagnname=${ln}&userId=${uid}`;
      } else {
        const uid = encodeURIComponent(String(user?.userId || ''));
        statsEndpoint = `/dailyActivity/user-summary?startDate=${startDate}&endDate=${endDate}&userId=${uid}`;
      }
      
      const response = await api.get(statsEndpoint);
      if (response.data.success) {
        const dailyData = response.data.data;
        const aggregated = dailyData.reduce((acc, day) => {
          acc.calls += parseFloat(day.calls) || 0;
          acc.appts += parseFloat(day.appts) || 0;
          acc.sits += parseFloat(day.sits) || 0;
          acc.sales += parseFloat(day.sales) || 0;
          acc.alp += parseFloat(day.alp) || 0;
          acc.refs += parseFloat(day.refs) || 0;
          acc.refAppt += parseFloat(day.refAppt) || 0;
          acc.refSit += parseFloat(day.refSit) || 0;
          acc.refSale += parseFloat(day.refSale) || 0;
          acc.refAlp += parseFloat(day.refAlp) || 0;
          return acc;
        }, { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0, refs: 0, refAppt: 0, refSit: 0, refSale: 0, refAlp: 0 });

        const showRatio = aggregated.appts > 0 ? ((aggregated.sits / aggregated.appts) * 100).toFixed(1) : 0;
        const closeRatio = aggregated.sits > 0 ? ((aggregated.sales / aggregated.sits) * 100).toFixed(1) : 0;
        const callsToAppt = aggregated.appts > 0 ? (aggregated.calls / aggregated.appts).toFixed(1) : 0;
        const callsToSit = aggregated.sits > 0 ? (aggregated.calls / aggregated.sits).toFixed(1) : 0;
        const alpPerSit = aggregated.sits > 0 ? (aggregated.alp / aggregated.sits).toFixed(2) : 0;
        const alpPerSale = aggregated.sales > 0 ? (aggregated.alp / aggregated.sales).toFixed(2) : 0;
        const refsPerSit = aggregated.sits > 0 ? (aggregated.refs / aggregated.sits).toFixed(2) : 0;
        const refAlpPerRef = aggregated.refs > 0 ? (aggregated.refAlp / aggregated.refs).toFixed(2) : 0;

        setStatsData({
          callsToAppt: parseFloat(callsToAppt),
          callsToSit: parseFloat(callsToSit),
          showRatio: parseFloat(showRatio),
          closeRatio: parseFloat(closeRatio),
          alpPerSit: parseFloat(alpPerSit),
          alpPerSale: parseFloat(alpPerSale),
          refsPerSit: parseFloat(refsPerSit),
          refAlpPerRef: parseFloat(refAlpPerRef)
        });
      }
    } catch (e) {
      console.error('Error fetching stats data:', e);
    } finally {
      setStatsLoading(false);
    }
  };

  // Helper functions for date calculations (matching LeaderboardPage)
  const formatToMMDDYYYY = (dateObj) => {
    const date = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const getMondayOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  };

  const getSundayOfWeek = (date) => {
    const monday = getMondayOfWeek(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday;
  };

  const calculateDateRange = (mondayDateStr) => {
    // Since reportdate represents when the report was submitted (not the week it covers),
    // reports for a given week come out 3-10 days AFTER the week ends (Sunday).
    // For week Jan 26 - Feb 1, reports would have reportdate around Feb 5-11.
    
    const monday = new Date(mondayDateStr);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // Get Sunday of the week
    
    // Query for reportdates from (Sunday + 1 day) to (Sunday + 10 days)
    // This catches both Arias Main (typically Wed, ~3-4 days after) 
    // and New York (typically Fri-Sat, ~5-7 days after)
    const startDate = new Date(sunday);
    startDate.setDate(sunday.getDate() + 1); // Day after week ends
    
    const endDate = new Date(sunday);
    endDate.setDate(sunday.getDate() + 10); // Up to 10 days after week ends
    
    return {
      startDate: formatToMMDDYYYY(startDate),
      endDate: formatToMMDDYYYY(endDate)
    };
  };

  // Match LeaderboardPage behavior: query a tight +/- 3 day window around a specific report publish date
  const calculatePlusMinus3Range = (reportDateIso) => {
    const reportDate = new Date(reportDateIso);
    const startDate = new Date(reportDate);
    startDate.setDate(reportDate.getDate() - 3);
    const endDate = new Date(reportDate);
    endDate.setDate(reportDate.getDate() + 3);
    return {
      startDate: formatToMMDDYYYY(startDate),
      endDate: formatToMMDDYYYY(endDate),
      reportDateIso: formatLocalDate(reportDate)
    };
  };

  const pickReportDateForWeek = (reportDatesIso = [], weekStartDate, weekEndDate) => {
    if (!Array.isArray(reportDatesIso) || reportDatesIso.length === 0) return null;
    const weekEnd = new Date(weekEndDate);
    const windowStart = new Date(weekEnd);
    windowStart.setDate(weekEnd.getDate() + 1);
    const windowEnd = new Date(weekEnd);
    windowEnd.setDate(weekEnd.getDate() + 10);

    // reportDatesIso is usually newest-first; pick the first one that falls in the publish window
    const inWindow = reportDatesIso.find((d) => {
      const dt = new Date(d);
      return dt >= windowStart && dt <= windowEnd;
    });
    if (inWindow) return inWindow;

    // Fallback: pick latest date not too far after the week ends
    const looseEnd = new Date(weekEnd);
    looseEnd.setDate(weekEnd.getDate() + 14);
    const looseStart = new Date(weekStartDate);
    looseStart.setDate(looseStart.getDate() - 7);
    const near = reportDatesIso.find((d) => {
      const dt = new Date(d);
      return dt >= looseStart && dt <= looseEnd;
    });
    return near || reportDatesIso[0];
  };

  const pickReportDateForYear = (reportDatesIso = [], year) => {
    if (!Array.isArray(reportDatesIso) || reportDatesIso.length === 0) return null;
    const match = reportDatesIso.find((d) => new Date(d).getFullYear() === year);
    return match || reportDatesIso[0];
  };

  // NOTE: Removed the compact "Top 10" leaderboard fetch from TeamDashboard.

  // Fetch Team Leaderboard Data (for team view)
  // Load more leaderboard data (for frontend pagination in Personal view)
  // No backend fetching needed - we already have all ALP data
  const loadMoreLeaderboardData = () => {
    try {
      if (!leaderboardHasMore || teamLeaderboardLoading) return;
      if (leaderboardAllUsers.length === 0) return;
      if (leaderboardAlpDataMap.size === 0) return;
      
      setTeamLeaderboardLoading(true);
      
      const nextPage = leaderboardPage + 1;
      const startIdx = (nextPage - 1) * LEADERBOARD_PAGE_SIZE;
      const endIdx = startIdx + LEADERBOARD_PAGE_SIZE;
      const pageUsers = leaderboardAllUsers.slice(startIdx, endIdx);
      
      if (pageUsers.length === 0) {
        setLeaderboardHasMore(false);
        setTeamLeaderboardLoading(false);
        return;
      }
      
      // Helper functions (same as in main fetch)
      const formatAgentName = (lagnname) => {
        if (!lagnname || typeof lagnname !== 'string') return '';
        const parts = lagnname.trim().split(/\s+/);
        if (parts.length < 2) return parts[0] || '';
        const last = parts[0];
        const first = parts[1];
        let middle = '';
        let suffix = '';
        if (parts.length === 3) {
          const thirdPart = parts[2];
          if (thirdPart.length === 1) {
            middle = thirdPart;
          } else {
            suffix = thirdPart;
          }
        } else if (parts.length >= 4) {
          middle = parts[2];
          suffix = parts.slice(3).join(' ');
        }
        let formattedName = first;
        if (middle) formattedName += ` ${middle}`;
        formattedName += ` ${last}`;
        if (suffix) formattedName += ` ${suffix}`;
        return formattedName;
      };
      
      const getMgaLastName = (mgaName, agentName) => {
        if (mgaName && typeof mgaName === 'string' && mgaName.trim()) {
          const parts = mgaName.trim().split(/\s+/);
          return parts[0] || '';
        }
        if (agentName && typeof agentName === 'string') {
          const parts = agentName.trim().split(/\s+/);
          return parts[0] || '';
        }
        return '';
      };
      
      // Map page users to ALP data (using stored alpDataMap and alpField)
      const newAgents = pageUsers.map(user => {
        const alpData = leaderboardAlpDataMap.get(user.lagnname);
        const premium = alpData ? parseFloat(alpData[leaderboardAlpField] || 0) : 0;
        
        return {
          id: user.id,
          agent_name: formatAgentName(user.lagnname),
          mga_name: getMgaLastName(alpData?.MGA_NAME || user.mga, user.lagnname),
          email: user.email || '',
          policy_count: alpData?.policy_count || 0,
          total_premium: premium,
          lagnname: user.lagnname,
          userId: user.id,
          hasProduction: premium > 0,
          profile_picture: user.profpic || null,
          esid: user.esid || null,
          reported_alp: 0,
          report_days: 0
        };
      });
      
      // Append new agents to existing leaderboard
      setTeamLeaderboardData(prev => [...prev, ...newAgents]);
      setLeaderboardPage(nextPage);
      setLeaderboardHasMore(endIdx < leaderboardAllUsers.length);
      setTeamLeaderboardLoading(false);
      
    } catch (error) {
      console.error('🏆 [TeamLeaderboard] Error loading more data:', error);
      setTeamLeaderboardLoading(false);
    }
  };

  const fetchTeamLeaderboardData = async () => {
    try {
      setTeamLeaderboardLoading(true);

      const isCanceledError = (err) =>
        err?.name === 'CanceledError' ||
        err?.code === 'ERR_CANCELED' ||
        err?.message === 'canceled';

      // Cancel any in-flight team leaderboard request
      if (teamLeaderboardAbortRef.current) {
        teamLeaderboardAbortRef.current.abort();
      }
      const controller = new AbortController();
      teamLeaderboardAbortRef.current = controller;

      // Start fetching active users ASAP (do not block the initial official ALP render on this)
      // IMPORTANT: attach a handler immediately so aborts don't surface as unhandled promise rejections.
      const usersPromise = api
        .getCached('/users/active', {}, { signal: controller.signal })
        .catch((err) => {
          if (isCanceledError(err)) return null;
          throw err;
        });

      // Get date range based on time period
      const dateRange = getDateRange();
      let { startDate, endDate } = dateRange;
      
      // Determine if we should use Monthly_ALP or Weekly_ALP
      // Use Monthly_ALP for month view when looking at a previous month
      // BUT: Only use Monthly_ALP if the month is at least 2 months old (to give time for data population)
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const selectedMonth = startDate.getMonth();
      const selectedYear = startDate.getFullYear();
      
      // Calculate how many months ago the selected month is
      const monthsAgo = (currentYear - selectedYear) * 12 + (currentMonth - selectedMonth);
      
      const isPreviousMonth = viewMode === 'month' && monthsAgo >= 2;

      // Format for Monthly_ALP: MM/YYYY
      const monthParam = `${String(selectedMonth + 1).padStart(2, '0')}/${selectedYear}`;
      
      // Map view mode to Weekly_ALP.REPORT type
      let reportType;
      if (viewMode === 'week') {
        reportType = 'Weekly Recap';
      } else if (viewMode === 'month') {
        reportType = isPreviousMonth ? 'MONTH RECAP' : 'MTD Recap'; // Monthly_ALP uses 'MONTH RECAP'
      } else if (viewMode === 'year') {
        reportType = 'YTD Recap'; // Will use max YTD Recap
      } else {
        // Fallback to old logic if viewMode is not set
        reportType = timePeriod === 'ytd' ? 'YTD Recap' : 'MTD Recap';
      }

      // LeaderboardPage strategy:
      // pick the report publish date and query only +/- 3 days around it (much smaller + faster).
      let formattedStartDate, formattedEndDate;
      if (viewMode === 'week' || viewMode === 'year') {
        try {
          const reportDatesRes = await api.getCached('/alp/getReportDates', { reportType });
          const reportDatesIso = reportDatesRes?.data?.type === 'grouped'
            ? (reportDatesRes?.data?.reportDates || []).filter(d => d && !d.isHeader).map(d => d.value)
            : (reportDatesRes?.data?.reportDates || []);

          let chosenReportDate;
          if (viewMode === 'week') {
            chosenReportDate = pickReportDateForWeek(reportDatesIso, startDate, endDate);
          } else {
            chosenReportDate = pickReportDateForYear(reportDatesIso, selectedYear);
          }

          if (chosenReportDate) {
            const pm3 = calculatePlusMinus3Range(chosenReportDate);
            formattedStartDate = pm3.startDate;
            formattedEndDate = pm3.endDate;
          } else {
            // Fallback to narrow window around period end
            const pm3 = calculatePlusMinus3Range(formatLocalDate(endDate));
            formattedStartDate = pm3.startDate;
            formattedEndDate = pm3.endDate;
          }
        } catch {
          const pm3 = calculatePlusMinus3Range(formatLocalDate(endDate));
          formattedStartDate = pm3.startDate;
          formattedEndDate = pm3.endDate;
        }
      } else if (viewMode === 'month' && !isPreviousMonth) {
        // For MTD Recap, avoid querying the entire month (can be very heavy).
        // Use the backend-provided +/- 3 day range around the latest reportdate.
        try {
          const reportDatesResponse = await api.getCached('/alp/getReportDates', { reportType: 'MTD Recap' });
          const rangeStart = reportDatesResponse?.data?.range?.start;
          const rangeEnd = reportDatesResponse?.data?.range?.end;
          if (rangeStart && rangeEnd) {
            formattedStartDate = formatToMMDDYYYY(new Date(rangeStart));
            formattedEndDate = formatToMMDDYYYY(new Date(rangeEnd));
          } else {
            formattedStartDate = formatToMMDDYYYY(startDate);
            formattedEndDate = formatToMMDDYYYY(endDate);
          }
        } catch {
          formattedStartDate = formatToMMDDYYYY(startDate);
          formattedEndDate = formatToMMDDYYYY(endDate);
        }
      } else {
        // For month/year views, use exact date ranges
        formattedStartDate = formatToMMDDYYYY(startDate);
        formattedEndDate = formatToMMDDYYYY(endDate);
      }

      // Determine which endpoint to use based on viewScope and whether we're looking at previous month
      // Following LeaderboardPage.js pattern
      let endpoint;
      
      if (viewScope === 'personal') {
        // Personal view - show all agents
        endpoint = isPreviousMonth ? '/alp/getmonthlyall' : '/alp/getweeklyall_simple';
      } else if (viewScope === 'mga') {
        // MGA view - show MGAs and RGAs (RGAs are also MGAs)
        // Filter out MGAs/RGAs where hide='y' or active='n' (from MGAs table)
        endpoint = isPreviousMonth ? '/alp/getmonthlymga' : '/alp/getweeklymga';
      } else if (viewScope === 'rga') {
        // RGA view - show only RGAs
        // Filter out RGAs where hide='y' or active='n' (from MGAs table)
        endpoint = isPreviousMonth ? '/alp/getmonthlyrga' : '/alp/getweeklyrga';
      } else if (viewScope === 'team') {
        // Team view for SA/GA - show all agents in their team
        endpoint = isPreviousMonth ? '/alp/getmonthlyall' : '/alp/getweeklyall';
      } else {
        // Default to all
        endpoint = isPreviousMonth ? '/alp/getmonthlyall' : '/alp/getweeklyall';
      }

      // Log API call parameters for year view
      if (viewMode === 'year') {
        console.log('📡 [TeamLeaderboard] Year view - API request:', {
          endpoint,
          viewMode,
          viewScope,
          year: selectedYear,
          isPreviousMonth,
          params: isPreviousMonth ? {
            month: monthParam
          } : {
            startDate: formattedStartDate,
            endDate: formattedEndDate,
            report: reportType
          }
        });
      }

      // Build params for Weekly_ALP or Monthly_ALP
      const alpParams = isPreviousMonth
        ? { month: monthParam }
        : { startDate: formattedStartDate, endDate: formattedEndDate, report: reportType };

      // Start ALP fetch (cached) - always fetch all ALP data without userIds filter
      // The backend can handle fetching all ALP data; it's the large userIds IN clause that causes timeouts
      const alpPromise = api.getCached(endpoint, alpParams, { signal: controller.signal });

      // Wait for ALP data (official) to render the main leaderboard ordering
      const response = await alpPromise;
      
      // Log raw response for year view
      if (viewMode === 'year') {
        console.log('📥 [TeamLeaderboard] Year view - Raw API response:', {
          endpoint,
          success: response?.data?.success,
          totalRows: response?.data?.data?.length,
          firstFewRows: response?.data?.data?.slice(0, 3),
          allReportDates: [...new Set(response?.data?.data?.map(r => r.reportdate || r.month))].sort(),
          bratinRows: response?.data?.data?.filter(r => 
            r.LagnName && r.LagnName.toLowerCase().includes('bratin')
          )
        });
      }

      // We'll compute ALP aggregation once and reuse it for both the quick render and the final (filtered) render.
      let alpDataMap = new Map();
      let alpField = 'LVL_1_NET';

      // Helper function to extract last name from MGA_NAME (format: "LAST FIRST MIDDLE SUFFIX")
      const getMgaLastName = (mgaName, agentName) => {
        if (mgaName && typeof mgaName === 'string' && mgaName.trim()) {
          const parts = mgaName.trim().split(/\s+/);
          return parts[0] || ''; // Return first part (LAST name)
        }

        // If MGA is blank, use agent's last name (first part of LagnName)
        if (agentName && typeof agentName === 'string') {
          const parts = agentName.trim().split(/\s+/);
          return parts[0] || ''; // Return first part (LAST name)
        }

        return '';
      };

      // Helper function to format name to "FIRST MIDDLE LAST SUFFIX" from "LAST FIRST MIDDLE SUFFIX"
      const formatAgentName = (lagnname) => {
        if (!lagnname || typeof lagnname !== 'string') {
          return '';
        }

        const parts = lagnname.trim().split(/\s+/);

        if (parts.length < 2) {
          return parts[0] || '';
        }

        const last = parts[0];
        const first = parts[1];
        let middle = '';
        let suffix = '';

        if (parts.length === 3) {
          const thirdPart = parts[2];
          if (thirdPart.length === 1) {
            middle = thirdPart;
          } else {
            suffix = thirdPart;
          }
        } else if (parts.length >= 4) {
          middle = parts[2];
          suffix = parts.slice(3).join(' ');
        }

        // Build "FIRST MIDDLE LAST SUFFIX"
        let formattedName = first;
        if (middle) formattedName += ` ${middle}`;
        formattedName += ` ${last}`;
        if (suffix) formattedName += ` ${suffix}`;

        return formattedName;
      };

      if (response.data.success) {
        const rawData = response.data.data || [];
        
        // Log reportdates when viewing year data
        if (viewMode === 'year') {
          const uniqueReportDates = [...new Set(rawData.map(item => item.reportdate || item.month).filter(d => d))];
          console.log('📅 [TeamLeaderboard] Year view - reportdates in data:', {
            year: selectedYear,
            viewMode,
            reportType,
            isPreviousMonth,
            dateRange: `${formattedStartDate} to ${formattedEndDate}`,
            totalRecords: rawData.length,
            uniqueReportDates: uniqueReportDates.sort(),
            sampleRecord: rawData[0] ? {
              lagnname: rawData[0].LagnName,
              reportdate: rawData[0].reportdate || rawData[0].month,
              LVL_3_NET: rawData[0].LVL_3_NET,
              LVL_1_NET: rawData[0].LVL_1_NET
            } : null
          });
        }
        
        // Complex aggregation logic for Weekly_ALP/Monthly_ALP data:
        // 1. Users can have multiple CTLNO codes (sum them)
        // 2. Users can have reports from Arias Main + New York within 3 days (sum them)
        // 3. CL_Name logic: For MGA/RGA views, filter by CL_Name
        //    - If 2 rows exist for same (LagnName, reportdate, REPORT): one with CL_Name='MGA' is MGA, one with CL_Name='' is RGA
        //    - If 1 row exists: it's the MGA row regardless of CL_Name
        
        // First, normalize the date field (reportdate for Weekly_ALP, month for Monthly_ALP)
        const normalizedData = rawData.map(item => ({
          ...item,
          reportdate: item.reportdate || item.month // Use month field if reportdate doesn't exist
        }));
        
        // Find the most recent reportdate for each user
        const userMaxDates = new Map();
        normalizedData.forEach(item => {
          if (item.LagnName && item.reportdate) {
            const existing = userMaxDates.get(item.LagnName);
            const itemDate = new Date(item.reportdate);
            if (!existing || itemDate > existing) {
              userMaxDates.set(item.LagnName, itemDate);
            }
          }
        });
        
        // Now aggregate data: include rows within 3 days of max reportdate (or all rows for Monthly_ALP)
        // IMPORTANT: use the outer alpDataMap so we can reuse it in the "finalize" phase.
        alpDataMap = new Map();
        const seenRows = new Map(); // Track seen row combinations to deduplicate
        
        normalizedData.forEach(item => {
          if (item.LagnName) {
            const maxDate = userMaxDates.get(item.LagnName);
            const itemDate = item.reportdate ? new Date(item.reportdate) : null;
            
            // Skip if no date
            if (!itemDate) {
              return;
            }
            
            // For Weekly_ALP, skip if more than 3 days before max date
            // For Monthly_ALP (isPreviousMonth), include all rows from the month
            if (!isPreviousMonth && maxDate) {
              const daysDiff = (maxDate - itemDate) / (1000 * 60 * 60 * 24);
              if (daysDiff > 3) {
                return;
              }
            }
            
            // For MGA/RGA views, apply CL_Name filtering
            // viewScope: 'mga' = show MGA rows (CL_Name='MGA' or single row)
            // viewScope: 'rga' = show RGA rows (CL_Name='' when paired with MGA row)
            if (viewScope === 'mga' || viewScope === 'rga') {
              // Check if there's a paired row (same LagnName, reportdate, REPORT, different CL_Name)
              const pairedRows = normalizedData.filter(r => 
                r.LagnName === item.LagnName && 
                r.reportdate === item.reportdate && 
                r.REPORT === item.REPORT
              );
              
              const hasMgaRow = pairedRows.some(r => r.CL_Name === 'MGA');
              const hasBlankRow = pairedRows.some(r => !r.CL_Name || r.CL_Name === '');
              
              if (pairedRows.length >= 2 && hasMgaRow && hasBlankRow) {
                // Two rows exist: one MGA, one RGA
                if (viewScope === 'mga' && item.CL_Name !== 'MGA') {
                  return; // Skip non-MGA rows in MGA view
                }
                if (viewScope === 'rga' && item.CL_Name === 'MGA') {
                  return; // Skip MGA rows in RGA view
                }
              }
              // If single row exists, include it in both MGA and RGA views
              // (it represents the MGA's production, which rolls up to the RGA)
            }
            
            // Check for duplicates: rows with same LagnName, reportdate, REPORT, and ALP values
            // These are database duplicates and should only be counted once
            const lvl1NetValue = parseFloat(item.LVL_1_NET) || 0;
            const lvl3NetValue = parseFloat(item.LVL_3_NET) || 0;
            const dedupeKey = `${item.LagnName}|${item.reportdate}|${item.REPORT}|${lvl1NetValue}|${lvl3NetValue}`;
            
            if (seenRows.has(dedupeKey)) {
              // This is a duplicate row - skip it
              return;
            }
            seenRows.set(dedupeKey, true);
            
            const existing = alpDataMap.get(item.LagnName);
            if (existing) {
              // User already exists - aggregate the ALP values (across reportdates and CTLNO codes)
              existing.LVL_1_NET = (parseFloat(existing.LVL_1_NET) || 0) + lvl1NetValue;
              existing.LVL_1_GROSS = (parseFloat(existing.LVL_1_GROSS) || 0) + (parseFloat(item.LVL_1_GROSS) || 0);
              existing.LVL_3_NET = (parseFloat(existing.LVL_3_NET) || 0) + lvl3NetValue;
              existing.LVL_3_GROSS = (parseFloat(existing.LVL_3_GROSS) || 0) + (parseFloat(item.LVL_3_GROSS) || 0);
              existing.policy_count = (existing.policy_count || 0) + (item.policy_count || 0);
              // Keep the most recent reportdate
              if (itemDate && (!existing.reportdate || itemDate > new Date(existing.reportdate))) {
                existing.reportdate = item.reportdate;
              }
            } else {
              // First entry for this user - clone the item
              alpDataMap.set(item.LagnName, {
                ...item,
                LVL_1_NET: lvl1NetValue,
                LVL_1_GROSS: parseFloat(item.LVL_1_GROSS) || 0,
                LVL_3_NET: lvl3NetValue,
                LVL_3_GROSS: parseFloat(item.LVL_3_GROSS) || 0
              });
            }
          }
        });

        // Log alpDataMap aggregation details for year view
        if (viewMode === 'year') {
          const sampleEntries = Array.from(alpDataMap.entries()).slice(0, 5);
          console.log('🗺️ [TeamLeaderboard] Year view - alpDataMap aggregated:', {
            totalEntries: alpDataMap.size,
            viewScope,
            aggregationRules: '3-day reportdate window + CL_Name filtering + CTLNO summing',
            sampleUsers: sampleEntries.map(([lagnname, data]) => {
              // Get raw rows for this user to show what was aggregated
              const userRawRows = rawData.filter(r => r.LagnName === lagnname);
              // Get normalized rows for this user to show what was aggregated
              const userNormalizedRows = normalizedData.filter(r => r.LagnName === lagnname);
              return {
                lagnname,
                aggregatedData: {
                  reportdate: data.reportdate,
                  LVL_1_NET: data.LVL_1_NET,
                  LVL_3_NET: data.LVL_3_NET
                },
                rawRowCount: userNormalizedRows.length,
                rawRows: userNormalizedRows.map(r => ({
                  CTLNO: r.CTLNO,
                  CL_Name: r.CL_Name,
                  reportdate: r.reportdate,
                  LVL_3_NET: r.LVL_3_NET
                }))
              };
            })
          });
        }

        // Determine which ALP level to use based on viewScope
        // Following LeaderboardPage.js logic:
        // - personal: LVL_1_NET (personal production)
        // - mga/rga/team: LVL_3_NET (includes team production)
        if (viewScope === 'personal') {
          alpField = 'LVL_1_NET';
        } else if (viewScope === 'mga' || viewScope === 'rga' || viewScope === 'team') {
          alpField = 'LVL_3_NET';
        } else {
          alpField = 'LVL_1_NET';
        }

        // QUICK RENDER: Show official ALP rows immediately (even before we finish filtering inactive users).
        // This keeps personal view feeling responsive.
        const quickData = Array.from(alpDataMap.entries())
          .map(([lagnname, data]) => {
            const premium = parseFloat(data?.[alpField] || 0);
            return {
              id: null,
              agent_name: formatAgentName(lagnname),
              mga_name: getMgaLastName(data?.MGA_NAME, lagnname),
              email: '',
              policy_count: data?.policy_count || 0,
              total_premium: premium,
              lagnname,
              userId: null,
              hasProduction: premium > 0,
              profile_picture: null,
              esid: null
            };
          })
          .sort((a, b) => {
            if (b.total_premium !== a.total_premium) return b.total_premium - a.total_premium;
            return (a.lagnname || '').localeCompare(b.lagnname || '');
          });
        
        // Log leaderboard data for year view (use quickData; transformedData isn't built in this phase)
        if (viewMode === 'year') {
          const loggedInUserData = quickData.find(agent =>
            agent.lagnname && user?.lagnname &&
            agent.lagnname.trim().toLowerCase() === user.lagnname.trim().toLowerCase()
          );
          console.log('📊 [TeamLeaderboard] Year view - quick data:', {
            totalAgents: quickData.length,
            viewScope,
            alpField,
            loggedInUser: loggedInUserData ? {
              lagnname: loggedInUserData.lagnname,
              total_premium: loggedInUserData.total_premium
            } : 'Not found',
            top5: quickData.slice(0, 5).map(agent => ({
              lagnname: agent.lagnname,
              total_premium: agent.total_premium
            }))
          });
        }
        
        // Set "as of" date from the leaderboard data
        if (isPreviousMonth) {
          // For Monthly_ALP, use the month parameter
          setAlpAsOfDate(monthParam);
        } else {
          // For Weekly_ALP, find the most recent reportdate
          const allReportDates = Array.from(alpDataMap.values())
            .map(data => data.reportdate)
            .filter(date => date);
          
          if (allReportDates.length > 0) {
            // Find the max date
            const maxDate = allReportDates.reduce((max, dateStr) => {
              const date = new Date(dateStr);
              return !max || date > new Date(max) ? dateStr : max;
            }, null);
            
            if (maxDate) {
              // Format as MM/DD/YYYY
              const date = new Date(maxDate);
              const formatted = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
              setAlpAsOfDate(formatted);
            }
          }
        }
        
        setTeamLeaderboardData(quickData);
        setTeamLeaderboardLoading(false);
      } else {
        setTeamLeaderboardData([]);
      }

      // FINALIZE: now apply active/hidden filtering and enrich rows with userId/profile, goals, reported ALP.
      const usersResponse = await usersPromise;
      if (!usersResponse) return;
      const allUsers = usersResponse.data || [];

      // Apply filtering rules to the active users list
      let filteredUsers;
      if (viewScope === 'personal') {
        filteredUsers = allUsers;
      } else if (viewScope === 'mga') {
        filteredUsers = allUsers.filter(u => {
          const isMgaOrRga = u.clname === 'MGA' || u.clname === 'RGA';
          if (!isMgaOrRga) return false;
          const isHidden = u.hide === 'y' || u.hide === 'Y';
          const isInactive = u.active === 'n' || u.active === 'N';
          return !isHidden && !isInactive;
        });
      } else if (viewScope === 'rga') {
        filteredUsers = allUsers.filter(u => {
          const isRga = u.clname === 'RGA';
          if (!isRga) return false;
          const isHidden = u.hide === 'y' || u.hide === 'Y';
          const isInactive = u.active === 'n' || u.active === 'N';
          return !isHidden && !isInactive;
        });
      } else {
        filteredUsers = allUsers;
      }

      // For Personal view with many users, use frontend pagination to avoid overwhelming the backend
      const usesFrontendPagination = viewScope === 'personal' && filteredUsers.length > LEADERBOARD_PAGE_SIZE;

      // Store ALP data and field for pagination (only used in personal scope)
      if (usesFrontendPagination) {
        setLeaderboardAlpDataMap(alpDataMap);
        setLeaderboardAlpField(alpField);
      }

      // IMPORTANT (personal pagination):
      // Sort the full user list by official ALP FIRST so the initial 50 are the true top 50.
      // Otherwise, ranks will "jump" as more pages load and the table re-sorts.
      const usersSortedByOfficialAlp = (users) => {
        return [...users].sort((a, b) => {
          const aAlp = parseFloat(alpDataMap.get(a.lagnname)?.[alpField] || 0);
          const bAlp = parseFloat(alpDataMap.get(b.lagnname)?.[alpField] || 0);
          if (bAlp !== aAlp) return bAlp - aAlp;
          return (a.lagnname || '').localeCompare(b.lagnname || '');
        });
      };

      const paginationUsers = usesFrontendPagination
        ? usersSortedByOfficialAlp(filteredUsers)
        : filteredUsers;

      // Setup pagination state
      if (usesFrontendPagination) {
        setLeaderboardAllUsers(paginationUsers);
        setLeaderboardPage(1);
        setLeaderboardHasMore(true);
      } else {
        setLeaderboardAllUsers([]);
        setLeaderboardPage(1);
        setLeaderboardHasMore(false);
      }

      const usersToDisplay = usesFrontendPagination
        ? paginationUsers.slice(0, LEADERBOARD_PAGE_SIZE)
        : paginationUsers;

      const transformedData = usersToDisplay
        .map(u => {
          const alpData = alpDataMap.get(u.lagnname);
          const premium = alpData ? parseFloat(alpData[alpField] || 0) : 0;
          return {
            id: u.id,
            agent_name: formatAgentName(u.lagnname),
            mga_name: getMgaLastName(alpData?.MGA_NAME || u.mga, u.lagnname),
            email: u.email || '',
            policy_count: alpData?.policy_count || 0,
            total_premium: premium,
            lagnname: u.lagnname,
            userId: u.id,
            hasProduction: premium > 0,
            profile_picture: u.profpic || null,
            esid: u.esid || null
          };
        })
        .sort((a, b) => {
          if (b.total_premium !== a.total_premium) return b.total_premium - a.total_premium;
          return a.lagnname.localeCompare(b.lagnname);
        });

      setTeamLeaderboardData(transformedData);

      // Start goals + reported ALP in parallel (requires userIds)
      const personalMonth = startDate.getMonth() + 1;
      const personalYear = startDate.getFullYear();
      const allUserIds = filteredUsers.map(u => u.id).filter(Boolean);

      const goalsPromise = (async () => {
        try {
          if (!allUserIds.length) return null;

          let goalType = 'personal';
          if (viewScope === 'mga') goalType = 'mga';
          if (viewScope === 'rga') goalType = 'rga';
          if (viewScope === 'team') goalType = 'mga';

          const chunkSize = 250;
          const chunks = [];
          for (let i = 0; i < allUserIds.length; i += chunkSize) {
            chunks.push(allUserIds.slice(i, i + chunkSize));
          }

          const combinedGoalsByUserId = {};
          for (const chunk of chunks) {
            const res = await api.post('/goals/batch', {
              userIds: chunk,
              year: personalYear,
              month: personalMonth,
              goalType
            });
            Object.assign(combinedGoalsByUserId, res.data?.goalsByUserId || {});
          }

          return { goalsByUserId: combinedGoalsByUserId, goalType };
        } catch (e) {
          console.error('❌ [TeamLeaderboard] Error fetching goals:', e);
          return null;
        }
      })();

      const reportedPromise = (async () => {
        try {
          const params = {
            startDate: formatLocalDate(startDate),
            endDate: formatLocalDate(endDate),
          };

          const shouldOmitUserIds = viewScope === 'personal' || allUserIds.length > 250;
          if (!shouldOmitUserIds) {
            params.userIds = allUserIds.join(',');
          }

          const res = await api.get('/dailyActivity/reported-alp-summary', { params });
          if (!res.data?.success) return [];
          return res.data.data || [];
        } catch (e) {
          console.error('❌ [TeamLeaderboard] Error fetching reported ALP:', e);
          return [];
        }
      })();

      goalsPromise.then(result => {
        if (!result?.goalsByUserId) return;
        const { goalsByUserId, goalType } = result;
        setTeamLeaderboardData(prev => prev.map(agent => {
          if (!agent.userId) return agent;
          const goalKey = `${agent.userId}_${goalType}`;
          const goal = goalsByUserId[goalKey];
          if (!goal || !goal.monthlyAlpGoal) return agent;
          const monthlyGoal = parseFloat(goal.monthlyAlpGoal);
          const goalProgress = monthlyGoal > 0 ? Math.round((agent.total_premium / monthlyGoal) * 100) : 0;
          const goalRemaining = Math.max(0, monthlyGoal - agent.total_premium);
          return { ...agent, monthlyGoal, goalProgress, goalRemaining };
        }));
      });

      reportedPromise.then(reportedAlpData => {
        if (!Array.isArray(reportedAlpData) || reportedAlpData.length === 0) return;
        const reportedAlpMap = {};
        reportedAlpData.forEach(item => {
          if (item.userId) {
            reportedAlpMap[item.userId] = {
              reported_alp: parseFloat(item.reported_alp) || 0,
              report_days: item.report_days || 0
            };
          }
        });
        setTeamLeaderboardData(prev => prev.map(agent => ({
          ...agent,
          reported_alp: reportedAlpMap[agent.userId]?.reported_alp || 0,
          report_days: reportedAlpMap[agent.userId]?.report_days || 0
        })));
      });
    } catch (error) {
      // Ignore abort/cancel errors (user changed filters quickly)
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
      console.error('🏆 [TeamLeaderboard] Error fetching data:', error);
      setTeamLeaderboardData([]);
    } finally {
      setTeamLeaderboardLoading(false);
    }
  };

  // Handle agent detail click for TeamLeaderboard
  const handleTeamLeaderboardAgentClick = async (agent) => {
    try {
      // For now, return basic calculated data
      // In the future, you could fetch from specific endpoints for detailed breakdowns
      const avgPremium = agent.policy_count > 0 ? agent.total_premium / agent.policy_count : 0;
      
      return {
        total_policies: agent.policy_count,
        total_premium: agent.total_premium,
        average_premium: avgPremium,
        by_type: [
          { type: 'Life', premium: agent.total_premium * 0.6 },
          { type: 'Health', premium: agent.total_premium * 0.3 },
          { type: 'Other', premium: agent.total_premium * 0.1 }
        ],
        by_carrier: [
          { carrier: 'Various Carriers', premium: agent.total_premium }
        ],
        by_lead: [
          { lead_type: 'Referral', premium: agent.total_premium * 0.4 },
          { lead_type: 'Direct', premium: agent.total_premium * 0.6 }
        ],
        recent_policies: []
      };
    } catch (error) {
      console.error('Error fetching agent details:', error);
      return null;
    }
  };

  // Set the DateRangeSelector in the header for eligible roles (desktop only)
  useEffect(() => {
    if (!isMobile && ['MGA', 'RGA', 'GA', 'SA', 'SGA'].includes(userRole)) {
      setHeaderContent(
        <DateRangeSelector
          dateRange={dateRangeState}
          onDateRangeChange={handleDateRangeChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          viewScope={viewScope}
          onViewScopeChange={handleViewScopeChange}
          userRole={userRole}
          statsTimeframe={personalStatsTimeframe}
          onStatsTimeframeChange={setPersonalStatsTimeframe}
          asOfDate={alpAsOfDate}
        />
      );
    } else {
      // Clear header content for mobile, AGT users, or other cases
      setHeaderContent(null);
    }

    // Clear header content when component unmounts
    return () => {
      setHeaderContent(null);
    };
  }, [isMobile, userRole, dateRangeState, viewMode, viewScope, setHeaderContent]);

  // Fetch data on mount and when viewScope, timePeriod, or dateRangeState changes
  useEffect(() => {
    fetchOrgMetrics();
    fetchCommits();
    if (timePeriod === 'ytd' || viewMode === 'year' || userRole === 'SGA') {
      fetchYTDSummaryData();
    }
    
    // Fetch team leaderboard for all views (including personal and AGT)
    if (['MGA', 'RGA', 'GA', 'SA', 'AGT', 'SGA'].includes(userRole) || viewScope === 'personal') {
      fetchTeamLeaderboardData();
    }
  }, [userRole, user?.lagnname, viewScope, timePeriod, dateRangeState, viewMode]);

  // Fetch activity data when date range changes
  useEffect(() => {
    if (userRole === 'SGA') return; // SGA doesn't show personal activity
    if (userRole === 'AGT' || viewScope === 'personal') {
      fetchActivityData();
    } else if (viewScope === 'team' || viewScope === 'mga' || viewScope === 'rga') {
      fetchActivityData();
    }
  }, [userRole, viewScope, dateRangeState, user?.userId]);

  // Fetch statistics data when personalStatsTimeframe changes (consolidated - no duplicate fetch)
  useEffect(() => {
    if (userRole === 'SGA') return;
    if (userRole === 'AGT' || viewScope === 'personal') {
      fetchStatsData();
    }
  }, [userRole, viewScope, personalStatsTimeframe, user?.userId]);

  // Fetch personal comparison data when date range changes
  useEffect(() => {
    if (userRole === 'SGA') return;
    if (userRole === 'AGT' || viewScope === 'personal') {
      fetchPersonalComparison();
    }
  }, [userRole, viewScope, dateRangeState, viewMode, user?.userId]);

  // Fetch personal goal when date range changes
  useEffect(() => {
    if (userRole === 'SGA') return;
    if (userRole === 'AGT' || viewScope === 'personal') {
      fetchPersonalGoal();
    }
  }, [userRole, viewScope, dateRangeState, user?.userId]);

  // NOTE: Removed compact "Top 10" leaderboard fetch from TeamDashboard (not rendered here).

  return (
    <div className="dashboard-with-feed">
    <div className="dashboard-container padded-content-sm dashboard-main">
      {/* Competitions Section */}
      <div>
        <CompetitionsDisplay />
      </div>
      

      {/* Date Range Selector - Mobile only (desktop shows in header) */}
      {isMobile && ['MGA', 'RGA', 'GA', 'SA', 'SGA'].includes(userRole) && (
        <DateRangeSelector
          dateRange={dateRangeState}
          onDateRangeChange={handleDateRangeChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          viewScope={viewScope}
          onViewScopeChange={handleViewScopeChange}
          userRole={userRole}
          statsTimeframe={personalStatsTimeframe}
          onStatsTimeframeChange={setPersonalStatsTimeframe}
          asOfDate={alpAsOfDate}
        />
      )}

      {/* Org Metrics / Commits Widget - Only show for MGA, RGA, GA, SA in team view */}
      {((['MGA', 'RGA', 'GA', 'SA'].includes(userRole) && viewScope !== 'personal') || userRole === 'SGA') && (
        <div>
          <CommitsWidget
            viewingUserClname={userRole}
            viewScope={viewScope}
            orgMetrics={orgMetrics}
            orgMetricsLoading={orgMetricsLoading}
            alpAsOfDate={alpAsOfDate}
            commits={commits}
            commitHistory={commitHistory}
            editingCommit={editingCommit}
            setEditingCommit={setEditingCommit}
            commitInput={commitInput}
            setCommitInput={setCommitInput}
            saveCommit={saveCommit}
            saveAlpGoal={saveAlpGoal}
            setShowHistoryModal={setShowHistoryModal}
            setHistoryModalType={setHistoryModalType}
            setShowBreakdownModal={setShowBreakdownModal}
            fetchRefSalesBreakdown={fetchRefSalesBreakdown}
            formatCurrency={formatCurrency}
            formatNumber={formatNumber}
            userClname={userRole}
            timePeriod={timePeriod}
            viewMode={viewMode}
            orgMetricsHistory={orgMetricsHistory}
            showSectionBackground={false}
            // MGA/RGA Official ALP toggle props
            mgaAlpMode={mgaAlpMode}
            setMgaAlpMode={setMgaAlpMode}
            rgaAlpMode={rgaAlpMode}
            setRgaAlpMode={setRgaAlpMode}
            mgaOfficialAlp={mgaOfficialAlp}
            rgaOfficialAlp={rgaOfficialAlp}
            hasMgaOfficialAlpData={hasMgaOfficialAlpData}
            hasRgaOfficialAlpData={hasRgaOfficialAlpData}
          />
        </div>
      )}

      {/* SGA YTD Summary - Show for SGA users below the org metrics cards */}
      {userRole === 'SGA' && ytdSummaryData.alpData && Object.keys(ytdSummaryData.alpData).length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <YTDSummaryWidget
            currentYear={new Date().getFullYear()}
            lastYear={new Date().getFullYear() - 1}
            alpData={ytdSummaryData.alpData}
            hiresData={ytdSummaryData.hiresData}
            associatesData={ytdSummaryData.associatesData}
            vipsData={ytdSummaryData.vipsData}
            mgaStartDate={ytdSummaryData.mgaStartDate}
            groupByMonthAndYear={groupByMonthAndYear}
          />
        </div>
      )}

      {/* Team Leaderboard - Show for team views only (not personal) */}
      {viewScope !== 'personal' && (
        <div style={{ marginTop: '2rem' }}>
          <TeamLeaderboard
            agents={teamLeaderboardData}
            title="Team Performance Leaderboard"
            dateRange={dateRangeState}
            loading={teamLeaderboardLoading}
            onAgentClick={handleTeamLeaderboardAgentClick}
            showDetails={true}
            showGoals={viewMode === 'month'}
            formatCurrency={formatCurrency}
            viewScope={viewScope}
            currentUser={user}
            onLoadMore={null}
            hasMore={false}
          />
        </div>
      )}

      {/* Personal Metrics Cards and Statistics - Show for AGT or any role in personal view (except SGA) */}
      {(userRole === 'AGT' || (viewScope === 'personal' && userRole !== 'SGA')) && (
        <>
          <div style={{ marginTop: '1rem' }}>
            <div className="metric-row" style={{ 
          display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem'
        }}>
              <WidgetCard
                title="Calls"
                value={activityLoading ? <span className="spinner"></span> : formatNumber(activityData?.calls || 0)}
                icon={FiPhone}
                color="#3b82f6"
                loading={activityLoading}
                subText={statsLoading ? '' : `${statsData?.callsToAppt || 0} calls to appt`}
                showComparison={!!personalComparison}
                comparisonValue={personalComparison?.calls}
                comparisonLabel={personalComparison?.label}
                comparisonFormat="number"
              />
              <WidgetCard
                title="Appointments"
                value={activityLoading ? <span className="spinner"></span> : formatNumber(activityData?.appts || 0)}
                icon={FiCalendar}
                color="#8b5cf6"
                loading={activityLoading}
                subText={statsLoading ? '' : `${statsData?.showRatio || 0}% show ratio`}
                showComparison={!!personalComparison}
                comparisonValue={personalComparison?.appts}
                comparisonLabel={personalComparison?.label}
                comparisonFormat="number"
              />
              <WidgetCard
                title="Sits"
                value={activityLoading ? <span className="spinner"></span> : formatNumber(activityData?.sits || 0)}
                icon={FiUsers}
                color="#f59e0b"
                loading={activityLoading}
                subText={statsLoading ? '' : `${statsData?.closeRatio || 0}% close ratio`}
                showComparison={!!personalComparison}
                comparisonValue={personalComparison?.sits}
                comparisonLabel={personalComparison?.label}
                comparisonFormat="number"
              />
              <WidgetCard
                title="Sales"
                value={activityLoading ? <span className="spinner"></span> : formatNumber(activityData?.sales || 0)}
                icon={FiTrendingUp}
                color="#10b981"
                loading={activityLoading}
                subText={statsLoading ? '' : `${formatCurrency(statsData?.alpPerSit || 0)} ALP per sit`}
                showComparison={!!personalComparison}
                comparisonValue={personalComparison?.sales}
                comparisonLabel={personalComparison?.label}
                comparisonFormat="number"
              />
              <WidgetCard
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>ALP</span>
                    {hasOfficialAlpData && (
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '0.25rem',
                        background: personalAlpMode === 'official' ? '#06b6d420' : '#8b5cf620',
                        color: personalAlpMode === 'official' ? '#06b6d4' : '#8b5cf6',
                        fontWeight: '500'
                      }}>
                        {personalAlpMode === 'official' ? 'Official' : 'Reported'}
                    </span>
                  )}
              </div>
                }
                value={activityLoading ? <span className="spinner"></span> : formatCurrency(
                  personalAlpMode === 'official' && hasOfficialAlpData
                    ? personalOfficialAlp || 0
                    : activityData?.alp || 0
                )}
                icon={FiDollarSign}
                color="#06b6d4"
                loading={activityLoading}
                subText={statsLoading ? '' : `${formatCurrency(statsData?.alpPerSale || 0)} ALP per sale`}
                showComparison={!!personalComparison}
                comparisonValue={personalComparison?.alp}
                comparisonLabel={personalComparison?.label}
                comparisonFormat="currency"
                // Hide goal/progress in week view (and year view); only show in month view.
                showProgress={viewMode === 'month' && !!personalGoal}
                currentValue={
                  personalAlpMode === 'official' && hasOfficialAlpData
                    ? personalOfficialAlp || 0
                    : activityData?.alp || 0
                }
                goalValue={personalGoal}
                topRightAction={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Toggle between reported and official ALP - only show if official data exists */}
                    {hasOfficialAlpData && (
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setPersonalAlpMode(personalAlpMode === 'reported' ? 'official' : 'reported');
                        }}
                        style={{ 
                          padding: '6px', 
                          borderRadius: '6px', 
                          background: 'transparent', 
                          color: '#06b6d4', 
                          border: 'none', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#06b6d420'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        title={`Switch to ${personalAlpMode === 'reported' ? 'official' : 'reported'} ALP`}
                      >
                        {personalAlpMode === 'reported' ? <FiToggleRight size={18} /> : <FiToggleLeft size={18} />}
                      </button>
                    )}
                    {/* Edit/Save/Cancel goal controls */}
                    {editingPersonalGoal ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            savePersonalAlpGoal();
                          }}
                          style={{
                            padding: '6px',
                            borderRadius: '6px',
                            background: 'transparent',
                            color: '#06b6d4',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#06b6d420')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          title="Save goal"
                        >
                          <FiSave size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPersonalGoal(false);
                          }}
                          style={{
                            padding: '6px',
                            borderRadius: '6px',
                            background: 'transparent',
                            color: '#06b6d4',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#06b6d420')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          title="Cancel editing"
                        >
                          <FiX size={18} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPersonalGoal(true);
                          setPersonalGoalInput(personalGoal ? String(personalGoal) : '');
                        }}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          background: 'transparent',
                          color: '#06b6d4',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#06b6d420')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        title={personalGoal ? 'Edit Goal' : 'Set Goal'}
                      >
                        <FiEdit2 size={18} />
                      </button>
                    )}
                  </div>
                }
              >
                {editingPersonalGoal && (
                  <div className="alp-goal-edit-row">
                    <input
                      type="number"
                      value={personalGoalInput}
                      onChange={(e) => setPersonalGoalInput(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="alp-goal-input"
                      placeholder="Enter goal amount"
                      autoFocus
                    />
              </div>
                )}
              </WidgetCard>
              <WidgetCard
                title="Refs"
                value={activityLoading ? <span className="spinner"></span> : formatNumber(activityData?.refs || 0)}
                icon={FiUserPlus}
                color="#ec4899"
                loading={activityLoading}
                subText={statsLoading ? '' : `${statsData?.refsPerSit || 0} refs per sit`}
                showComparison={!!personalComparison}
                comparisonValue={personalComparison?.refs}
                comparisonLabel={personalComparison?.label}
                comparisonFormat="number"
              />
            </div>
          </div>
        </>
      )}

      {/* Team Leaderboard - Show for personal view below Activity & Stats */}
      {(userRole === 'AGT' || viewScope === 'personal') && (
        <div style={{ marginTop: '1rem' }}>
          <TeamLeaderboard
            agents={teamLeaderboardData}
            title="Team Performance Leaderboard"
            dateRange={dateRangeState}
            loading={teamLeaderboardLoading}
            onAgentClick={handleTeamLeaderboardAgentClick}
            showDetails={true}
            showGoals={viewMode === 'month'}
            formatCurrency={formatCurrency}
            viewScope={viewScope}
            currentUser={user}
            onLoadMore={leaderboardHasMore ? loadMoreLeaderboardData : null}
            hasMore={leaderboardHasMore}
          />
        </div>
      )}

      {/* YTD Summary Widget */}
      {timePeriod === 'ytd' && ytdSummaryData.alpData && Object.keys(ytdSummaryData.alpData).length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <YTDSummaryWidget
            currentYear={new Date().getFullYear()}
            lastYear={new Date().getFullYear() - 1}
            alpData={ytdSummaryData.alpData}
            hiresData={ytdSummaryData.hiresData}
            associatesData={ytdSummaryData.associatesData}
            vipsData={ytdSummaryData.vipsData}
            mgaStartDate={ytdSummaryData.mgaStartDate}
            groupByMonthAndYear={groupByMonthAndYear}
            visibleColumns={['hireCode', 'alpCode', 'codeVip']}
          />
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && historyModalType && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            style={{
              background: theme === 'dark' ? '#1e1e1e' : 'white',
              color: theme === 'dark' ? '#f0f0f0' : '#000',
              borderRadius: '8px',
              padding: '1.5rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: theme === 'dark' ? '0 4px 6px rgba(0, 0, 0, 0.4)' : '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, textTransform: 'capitalize', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>
                {historyModalType} Commitment History
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: theme === 'dark' ? '#aaa' : '#666'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '1rem', color: theme === 'dark' ? '#aaa' : '#666', fontSize: '0.875rem' }}>
              {commitHistory[historyModalType]?.length} total {commitHistory[historyModalType]?.length === 1 ? 'entry' : 'entries'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {commitHistory[historyModalType]?.map((entry, index) => {
                const isLatest = index === 0;
                const prevEntry = index < commitHistory[historyModalType].length - 1 ? commitHistory[historyModalType][index + 1] : null;
                const change = prevEntry ? entry.amount - prevEntry.amount : null;
                
                return (
                  <div 
                    key={entry.id}
                    style={{
                      padding: '1rem',
                      border: isLatest ? '2px solid var(--primary-color, #007bff)' : (theme === 'dark' ? '1px solid #444' : '1px solid #ddd'),
                      borderRadius: '6px',
                      background: isLatest ? (theme === 'dark' ? '#2a3a4a' : '#f0f8ff') : (theme === 'dark' ? '#2a2a2a' : 'white'),
                      color: theme === 'dark' ? '#f0f0f0' : '#000',
                      position: 'relative'
                    }}
                  >
                    {isLatest && (
                      <div 
                        style={{
                          position: 'absolute',
                          top: '-10px',
                          right: '10px',
                          background: 'var(--primary-color, #007bff)',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}
                      >
                        CURRENT
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                        {formatNumber(entry.amount)}
                        {change !== null && (
                          <span style={{ 
                            marginLeft: '0.5rem', 
                            fontSize: '0.875rem', 
                            color: change > 0 ? '#28a745' : change < 0 ? '#dc3545' : '#666',
                            fontWeight: 'normal'
                          }}>
                            ({change > 0 ? '+' : ''}{formatNumber(change)})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#aaa' : '#666' }}>
                        {(() => {
                          const timestamp = entry.created_at;
                          
                          let date;
                          if (typeof timestamp === 'string') {
                            const parts = timestamp.split(/[- :]/);
                            date = new Date(
                              parseInt(parts[0]), 
                              parseInt(parts[1]) - 1, 
                              parseInt(parts[2]), 
                              parseInt(parts[3]) + 3,
                              parseInt(parts[4]), 
                              parseInt(parts[5])
                            );
                          } else {
                            date = new Date(timestamp);
                          }
                          
                          return date.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          }) + ' ET';
                        })()}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '0.75rem', color: theme === 'dark' ? '#aaa' : '#666' }}>
                      {entry.lagnname}
                      {entry.clname && ` • ${entry.clname}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Org Metrics Breakdown Modal */}
      {showBreakdownModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowBreakdownModal(false)}
        >
          <div 
            style={{
              background: theme === 'dark' ? '#1e1e1e' : 'white',
              color: theme === 'dark' ? '#f0f0f0' : '#000',
              borderRadius: '8px',
              padding: '1.5rem',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: theme === 'dark' ? '0 4px 6px rgba(0, 0, 0, 0.4)' : '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: theme === 'dark' ? '#f0f0f0' : '#000' }}>
                Org Metrics Breakdown
              </h3>
              <button
                onClick={() => setShowBreakdownModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: theme === 'dark' ? '#aaa' : '#666'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '1rem', color: theme === 'dark' ? '#aaa' : '#666', fontSize: '0.875rem' }}>
              {breakdownData.length} {breakdownData.length === 1 ? 'MGA' : 'MGAs'} • {
                timePeriod === 'thisMonth' ? 'This Month' :
                timePeriod === 'lastMonth' ? 'Last Month' :
                timePeriod === 'ytd' ? 'Year-to-Date' : 'Current Period'
              }
            </div>

            {breakdownData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: theme === 'dark' ? '#888' : '#999' }}>
                No data available
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ 
                      borderBottom: theme === 'dark' ? '2px solid #444' : '2px solid #ddd', 
                      background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa'
                    }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>MGA</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>Hires</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>Codes</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>VIPs</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>Ref Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const grouped = {};
                      const selfRows = [];
                      const directMGAs = [];
                      
                      breakdownData.forEach(row => {
                        if (row.isSelf) {
                          selfRows.push(row);
                        } else if (row.isFirstYearRollup && row.uplineMGA) {
                          if (!grouped[row.uplineMGA]) {
                            grouped[row.uplineMGA] = [];
                          }
                          grouped[row.uplineMGA].push(row);
                        } else {
                          directMGAs.push(row);
                        }
                      });
                      
                      directMGAs.sort((a, b) => {
                        const totalA = a.hires + a.codes + a.vips + (a.refSales || 0);
                        const totalB = b.hires + b.codes + b.vips + (b.refSales || 0);
                        return totalB - totalA;
                      });
                      
                      const displayRows = [];
                      let rowIndex = 0;
                      
                      selfRows.forEach(row => {
                        displayRows.push(
                          <tr 
                            key={`self-${rowIndex}`}
                            style={{ 
                              borderBottom: theme === 'dark' ? '1px solid #444' : '1px solid #eee',
                              background: rowIndex % 2 === 0 ? (theme === 'dark' ? '#1e1e1e' : 'white') : (theme === 'dark' ? '#2a2a2a' : '#f8f9fa'),
                              fontWeight: '600',
                              color: theme === 'dark' ? '#f0f0f0' : '#000'
                            }}
                          >
                            <td style={{ padding: '0.75rem' }}>{row.lagnname} (You)</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(row.hires)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(row.codes)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(row.vips)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(row.refSales || 0)}</td>
                          </tr>
                        );
                        rowIndex++;
                      });
                      
                      directMGAs.forEach(mga => {
                        displayRows.push(
                          <tr 
                            key={`mga-${rowIndex}`}
                            style={{ 
                              borderBottom: theme === 'dark' ? '1px solid #444' : '1px solid #eee',
                              background: rowIndex % 2 === 0 ? (theme === 'dark' ? '#1e1e1e' : 'white') : (theme === 'dark' ? '#2a2a2a' : '#f8f9fa'),
                              color: theme === 'dark' ? '#f0f0f0' : '#000'
                            }}
                          >
                            <td style={{ padding: '0.75rem', fontWeight: '500' }}>{mga.lagnname}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(mga.hires)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(mga.codes)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(mga.vips)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(mga.refSales || 0)}</td>
                          </tr>
                        );
                        rowIndex++;
                        
                        const rollups = grouped[mga.lagnname] || [];
                        rollups.forEach(rollup => {
                          displayRows.push(
                            <tr 
                              key={`rollup-${rowIndex}`}
                              style={{ 
                                borderBottom: theme === 'dark' ? '1px solid #444' : '1px solid #eee',
                                background: rowIndex % 2 === 0 ? (theme === 'dark' ? '#1e1e1e' : 'white') : (theme === 'dark' ? '#2a2a2a' : '#f8f9fa')
                              }}
                            >
                              <td style={{ padding: '0.75rem', paddingLeft: '2rem', fontStyle: 'italic', color: theme === 'dark' ? '#aaa' : '#666' }}>
                                ↳ {rollup.lagnname}*
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: theme === 'dark' ? '#aaa' : '#666' }}>{formatNumber(rollup.hires)}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: theme === 'dark' ? '#aaa' : '#666' }}>{formatNumber(rollup.codes)}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: theme === 'dark' ? '#aaa' : '#666' }}>{formatNumber(rollup.vips)}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: theme === 'dark' ? '#aaa' : '#666' }}>{formatNumber(rollup.refSales || 0)}</td>
                            </tr>
                          );
                          rowIndex++;
                        });
                      });
                      
                      return displayRows;
                    })()}
                    <tr style={{ 
                      borderTop: theme === 'dark' ? '2px solid #444' : '2px solid #ddd', 
                      fontWeight: 'bold', 
                      background: theme === 'dark' ? '#2a2a2a' : '#f0f8ff',
                      color: theme === 'dark' ? '#f0f0f0' : '#000'
                    }}>
                      <td style={{ padding: '0.75rem' }}>TOTAL</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {formatNumber(breakdownData.reduce((sum, r) => sum + r.hires, 0))}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {formatNumber(breakdownData.reduce((sum, r) => sum + r.codes, 0))}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {formatNumber(breakdownData.reduce((sum, r) => sum + r.vips, 0))}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {formatNumber(breakdownData.reduce((sum, r) => sum + (r.refSales || 0), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
                
                {breakdownData.some(row => row.isFirstYearRollup) && (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa', 
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    color: theme === 'dark' ? '#aaa' : '#666'
                  }}>
                    <strong>*</strong> First-year MGA rolling up to their upline
                  </div>
                )}

                {/* Ref Sales Agent Breakdown */}
                {refSalesBreakdown.length > 0 && (
                  <div style={{ marginTop: '2rem' }}>
                    <h4 style={{ 
                      marginBottom: '1rem', 
                      color: theme === 'dark' ? '#f0f0f0' : '#000',
                      fontSize: '1rem',
                      fontWeight: '600'
                    }}>
                      Ref Sales by Agent
                    </h4>
                    {refSalesBreakdown.map((mgaData, mgaIdx) => (
                      <div key={mgaIdx} style={{ marginBottom: '1.5rem' }}>
                        <h5 style={{ 
                          marginBottom: '0.5rem', 
                          color: theme === 'dark' ? '#aaa' : '#666',
                          fontSize: '0.875rem',
                          fontWeight: '600'
                        }}>
                          {mgaData.mga}
                        </h5>
                        {mgaData.agents.length === 0 ? (
                          <div style={{ 
                            padding: '1rem', 
                            textAlign: 'center', 
                            color: theme === 'dark' ? '#666' : '#999',
                            fontStyle: 'italic'
                          }}>
                            No ref sales for this MGA
                          </div>
                        ) : (
                          <table style={{ 
                            width: '100%', 
                            borderCollapse: 'collapse',
                            fontSize: '0.875rem'
                          }}>
                            <thead>
                              <tr style={{ 
                                borderBottom: theme === 'dark' ? '2px solid #444' : '2px solid #ddd',
                                background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa'
                              }}>
                                <th style={{ padding: '0.5rem', textAlign: 'left', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>Agent</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right', color: theme === 'dark' ? '#f0f0f0' : '#000' }}>Ref Sales</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mgaData.agents.map((agent, agentIdx) => (
                                <tr 
                                  key={agentIdx}
                                  style={{ 
                                    borderBottom: theme === 'dark' ? '1px solid #444' : '1px solid #eee',
                                    background: agentIdx % 2 === 0 ? (theme === 'dark' ? '#1e1e1e' : 'white') : (theme === 'dark' ? '#2a2a2a' : '#f8f9fa'),
                                    color: theme === 'dark' ? '#f0f0f0' : '#000'
                                  }}
                                >
                                  <td style={{ padding: '0.5rem' }}>{agent.lagnname}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{agent.refSales}</td>
                                </tr>
                              ))}
                              <tr style={{ 
                                borderTop: theme === 'dark' ? '2px solid #444' : '2px solid #ddd',
                                fontWeight: 'bold',
                                background: theme === 'dark' ? '#2a2a2a' : '#f0f8ff',
                                color: theme === 'dark' ? '#f0f0f0' : '#000'
                              }}>
                                <td style={{ padding: '0.5rem' }}>TOTAL</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                  {mgaData.agents.reduce((sum, agent) => sum + parseInt(agent.refSales || 0), 0)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>

    {!showFeedSidebar && (
      <button
        className="dashboard-feed-reopen-btn"
        onClick={() => setShowFeedSidebar(true)}
        title="Show activity feed"
      >
        <FiChevronsLeft size={14} />
      </button>
    )}
    <aside className={`dashboard-feed-sidebar${showFeedSidebar ? '' : ' collapsed'}`}>
        <div className="dashboard-feed-sidebar-header">
          <div className="dashboard-feed-tabs">
            <button
              className={`dashboard-feed-tab${feedScope === 'org' ? ' active' : ''}`}
              onClick={() => setFeedScope('org')}
            >
              <FiGlobe size={13} /> Org
            </button>
            <button
              className={`dashboard-feed-tab${feedScope === 'team' ? ' active' : ''}`}
              onClick={() => setFeedScope('team')}
            >
              <FiUsers size={13} /> My Team
            </button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="dashboard-feed-add-btn"
              onClick={() => setShowAddSale(true)}
              title="Log a sale"
            >
              <FiPlus size={15} />
            </button>
            <button
              className="dashboard-feed-add-btn"
              onClick={() => setShowFeedSidebar(false)}
              title="Hide activity feed"
            >
              <FiChevronsRight size={15} />
            </button>
          </div>
        </div>
        <ActivityFeedList scope={feedScope} onRegisterAddEvent={handleRegisterFeedEvent} />
        {showAddSale && (
          <AddSaleModal
            onClose={() => setShowAddSale(false)}
            onSaleAdded={handleFeedSaleAdded}
          />
        )}
      </aside>
    </div>
  );
};

export default TeamDashboard;

