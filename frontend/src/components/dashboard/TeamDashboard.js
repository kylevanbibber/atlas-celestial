/**
 * Team Dashboard Component
 * 
 * Simplified dashboard for AGT, SA, GA, MGA, and RGA users.
 * This is a parent component that will host various child components.
 */

import React, { useState, useEffect, useContext } from 'react';
import CompetitionsDisplay from '../competitions/CompetitionsDisplay';
import CommitsWidget from '../OneOnOne/CommitsWidget';
import YTDSummaryWidget from '../OneOnOne/YTDSummaryWidget';
import ActivityWidget from '../OneOnOne/ActivityWidget';
import StatisticsWidget from '../OneOnOne/StatisticsWidget';
import Leaderboard from '../utils/Leaderboard';
import TeamLeaderboard from './TeamLeaderboard';
import DateRangeSelector from './DateRangeSelector';
import ThemeContext from '../../context/ThemeContext';
import api from '../../api';
import '../../pages/Dashboard.css';
import '../../pages/OneOnOne.css';
import './TeamDashboard.css';

const TeamDashboard = ({ userRole, user }) => {
  console.log('📊 [TeamDashboard] Rendering for:', { userRole, userId: user?.userId, lagnname: user?.lagnname });
  const { theme } = useContext(ThemeContext);

  // View mode states for different roles
  const [saViewMode, setSaViewMode] = useState('team'); // 'personal' or 'team' for SA users
  const [gaViewMode, setGaViewMode] = useState('team'); // 'personal' or 'team' for GA users
  const [mgaViewMode, setMgaViewMode] = useState('team'); // 'personal' or 'team' for MGA users
  const [rgaViewMode, setRgaViewMode] = useState('mga'); // 'personal', 'mga', or 'rga' for RGA users

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
  const [timePeriod, setTimePeriod] = useState('thisMonth'); // 'thisMonth', 'lastMonth', 'ytd'

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
  const [selectedPeriod, setSelectedPeriod] = useState('week'); // week, month, ytd
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activityViewMode, setActivityViewMode] = useState('reported'); // reported, official
  const [comparisonData, setComparisonData] = useState(null);
  const [officialYtdAlp, setOfficialYtdAlp] = useState(null);
  const [activityError, setActivityError] = useState('');
  
  // Statistics Widget state
  const [statisticsData, setStatisticsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsTimeframe, setStatsTimeframe] = useState('this_month'); // this_month, last_month, six_months, all_time

  // Leaderboard state
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('week'); // week, month, ytd
  const [leaderboardAsOfDate, setLeaderboardAsOfDate] = useState('');

  // Team Leaderboard state
  const [teamLeaderboardData, setTeamLeaderboardData] = useState([]);
  const [teamLeaderboardLoading, setTeamLeaderboardLoading] = useState(false);

  // Determine the current view scope based on role and view mode
  const getViewScope = () => {
    if (userRole === 'SA') return saViewMode;
    if (userRole === 'GA') return gaViewMode;
    if (userRole === 'MGA') return mgaViewMode;
    if (userRole === 'RGA') return rgaViewMode;
    return 'personal'; // AGT default
  };

  const viewScope = getViewScope();

  // Handle date range change from DateRangeSelector
  const handleDateRangeChange = (newRange) => {
    setDateRangeState(newRange);
    
    // Update timePeriod based on the date range (for backward compatibility)
    const start = new Date(newRange.start);
    const end = new Date(newRange.end);
    const now = new Date();
    
    // Check if it's year-to-date
    const yearStart = new Date(now.getFullYear(), 0, 1);
    if (start.toDateString() === yearStart.toDateString() && viewMode === 'year') {
      setTimePeriod('ytd');
    } else if (viewMode === 'month') {
      // Check if current month
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      if (start.toDateString() === currentMonthStart.toDateString()) {
        setTimePeriod('thisMonth');
      } else {
        setTimePeriod('lastMonth');
      }
    } else if (viewMode === 'week') {
      setTimePeriod('thisWeek');
    }
  };

  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    
    // Sync with timePeriod for backward compatibility
    if (mode === 'year') {
      setTimePeriod('ytd');
    } else if (mode === 'month') {
      setTimePeriod('thisMonth');
    } else if (mode === 'week') {
      setTimePeriod('thisWeek');
    }
  };

  // Get date range based on selected time period or dateRangeState
  const getDateRange = () => {
    // If we have dateRangeState from DateRangeSelector, use it
    if (dateRangeState && dateRangeState.start && dateRangeState.end) {
      const start = new Date(dateRangeState.start);
      const end = new Date(dateRangeState.end);
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

  // Activity Widget helper functions
  const getActivityDateRange = () => {
    if (selectedPeriod === 'week') {
      const dayOfWeek = currentDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(currentDate);
      monday.setDate(currentDate.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      
      return {
        startDate: monday.toISOString().split('T')[0],
        endDate: sunday.toISOString().split('T')[0],
        start: monday,
        end: sunday
      };
    } else if (selectedPeriod === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      end.setHours(23, 59, 59, 999);
      
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        start,
        end
      };
    } else if (selectedPeriod === 'ytd') {
      const year = currentDate.getFullYear();
      const start = new Date(year, 0, 1);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        start,
        end
      };
    }
    return null;
  };

  const getPeriodOptions = (period) => {
    const options = [];
    const today = new Date();
    
    if (period === 'week') {
      // Generate last 12 weeks
      for (let i = 0; i < 12; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - (i * 7));
        const dayOfWeek = d.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(d);
        monday.setDate(d.getDate() + mondayOffset);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        options.push({
          value: monday.toISOString().split('T')[0],
          label: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        });
      }
    } else if (period === 'month') {
      // Generate last 12 months
      for (let i = 0; i < 12; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        options.push({
          value: monthKey,
          label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        });
      }
    } else if (period === 'ytd') {
      // Generate last 3 years
      for (let i = 0; i < 3; i++) {
        const year = today.getFullYear() - i;
        options.push({
          value: String(year),
          label: `YTD ${year}`
        });
      }
    }
    
    return options;
  };

  const getPeriodKeyForDate = (period, date) => {
    if (period === 'week') {
      const dayOfWeek = date.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(date);
      monday.setDate(date.getDate() + mondayOffset);
      return monday.toISOString().split('T')[0];
    } else if (period === 'month') {
      return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    } else if (period === 'ytd') {
      return String(date.getFullYear());
    }
    return '';
  };

  // Statistics Widget helper function
  const getStatsDateRange = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    switch (statsTimeframe) {
      case 'this_month': {
        const start = new Date(currentYear, currentMonth, 1);
        const end = new Date(currentYear, currentMonth + 1, 0);
        end.setHours(23, 59, 59, 999);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        };
      }
      case 'last_month': {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const start = new Date(lastMonthYear, lastMonth, 1);
        const end = new Date(lastMonthYear, lastMonth + 1, 0);
        end.setHours(23, 59, 59, 999);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        };
      }
      case 'six_months': {
        const sixMonthsAgo = new Date(currentYear, currentMonth - 6, 1);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return {
          startDate: sixMonthsAgo.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        };
      }
      case 'all_time': {
        // Use a far back date
        const start = new Date(2020, 0, 1);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        };
      }
      default:
        return {
          startDate: new Date(currentYear, currentMonth, 1).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        };
    }
  };

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
      if (!['MGA', 'RGA', 'GA', 'SA'].includes(userRole)) return;
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
          console.log('No ALP goal found');
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
      if (!['MGA', 'RGA', 'GA', 'SA'].includes(userRole)) return;
      if (!user?.lagnname) return;
      
      const isOrgScope = (userRole === 'MGA' && viewScope === 'team') || 
                         (userRole === 'RGA' && (viewScope === 'mga' || viewScope === 'rga')) ||
                         (userRole === 'GA' && viewScope === 'team') ||
                         (userRole === 'SA' && viewScope === 'team');
      if (!isOrgScope) { setOrgMetrics(null); return; }
      
      setOrgMetricsLoading(true);

      // Get date range based on selected time period
      const dateRange = getDateRange();
      const { startDate, endDate, year } = dateRange;
      const month = startDate.getMonth();

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
        
        if (timePeriod === 'lastMonth') {
          // Use Monthly_ALP table for last month
          const lastMonth = startDate.getMonth() + 1; // +1 because getMonth() is 0-indexed
          const lastMonthYear = startDate.getFullYear();
          const monthKey = `${String(lastMonth).padStart(2, '0')}/${lastMonthYear}`;
          
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
            alpMTD = parseFloat(alpRes.data.data[0].LVL_3_NET) || 0;
            // Set a generic date label for last month
            setAlpAsOfDate(`${lastMonth}/${lastMonthYear}`);
          }
        } else if (timePeriod === 'ytd') {
          // Use Weekly_ALP with REPORT = 'YTD Recap' for YTD
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
          
          const alpRes = await api.get('/alp/mga/weekly-ytd', {
            params: {
              lagnName: user.lagnname,
              viewMode: viewScope
            },
            headers: {
              'user-role': userRole
            }
          });
          
          if (alpRes?.data?.success && Array.isArray(alpRes.data.data) && alpRes.data.data.length > 0) {
            const row = alpRes.data.data[0];
            alpMTD = parseFloat(row.LVL_3_NET || row.lvl_3_net || 0);
            if (row.reportdate) {
              setAlpAsOfDate(row.reportdate);
            } else {
              setAlpAsOfDate(`YTD ${currentYear}`);
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
      if (!['MGA', 'RGA', 'GA', 'SA'].includes(userRole)) return;
      if (!user?.lagnname) return;
      if (timePeriod !== 'ytd') return;
      
      const isOrgScope = (userRole === 'MGA' && viewScope === 'team') || 
                         (userRole === 'RGA' && (viewScope === 'mga' || viewScope === 'rga')) ||
                         (userRole === 'GA' && viewScope === 'team') ||
                         (userRole === 'SA' && viewScope === 'team');
      
      if (!isOrgScope) return;

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
      if (!['MGA', 'RGA', 'GA', 'SA'].includes(userRole)) return;
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

  // Fetch Activity Data
  const fetchActivityData = async () => {
    try {
      setActivityLoading(true);
      setActivityError('');

      if (!user?.userId) {
        setActivityError('User information not available');
        return;
      }

      const dateRange = getActivityDateRange();
      if (!dateRange) {
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
      
      console.log('[TeamDashboard] Fetching activity data:', {
        userRole,
        viewScope,
        endpoint,
        dateRange
      });
      
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

        setStatisticsData({
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

  const calculateDateRange = (date) => {
    const reportDate = new Date(date);
    const startDate = new Date(reportDate);
    startDate.setDate(reportDate.getDate() - 3);
    
    const endDate = new Date(reportDate);
    endDate.setDate(reportDate.getDate() + 3);
    
    return {
      startDate: formatToMMDDYYYY(startDate),
      endDate: formatToMMDDYYYY(endDate)
    };
  };

  // Format the "as of" date based on period type and report date
  const formatAsOfDate = (reportDate, period, startDateStr, endDateStr) => {
    if (period === 'week') {
      // For week: show range like "12/16/24 - 12/22/24"
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      const formatShort = (d) => {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        return `${mm}/${dd}/${yy}`;
      };
      return `${formatShort(start)} - ${formatShort(end)}`;
    } else if (period === 'month' || period === 'ytd') {
      // For month/YTD: use the actual reportdate from the data
      if (reportDate) {
        const date = new Date(reportDate);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const yy = String(date.getFullYear()).slice(-2);
        return `${mm}/${dd}/${yy}`;
      }
    }
    return '';
  };

  // Fetch Leaderboard Data (using LVL_1_NET for personal/AGT view)
  const fetchLeaderboardData = async () => {
    try {
      setLeaderboardLoading(true);

      let startDate, endDate, reportType;
      
      if (leaderboardPeriod === 'week') {
        // Get report dates from backend for Weekly Recap
        const reportDatesResponse = await api.get('/alp/getReportDates', {
          params: { reportType: 'Weekly Recap' }
        });
        
        let selectedDate;
        if (reportDatesResponse.data.success && reportDatesResponse.data.defaultDate) {
          selectedDate = reportDatesResponse.data.defaultDate;
        } else {
          // Fallback: use current week's Monday
          const today = new Date();
          selectedDate = getMondayOfWeek(today).toISOString().split('T')[0];
        }
        
        // Calculate week range from the selected date (±3 days like LeaderboardPage)
        const dateRange = calculateDateRange(selectedDate);
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;
        reportType = 'Weekly Recap';
      } else if (leaderboardPeriod === 'month') {
        // Current month
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        startDate = formatToMMDDYYYY(firstDay);
        endDate = formatToMMDDYYYY(lastDay);
        reportType = 'MTD Recap';
      } else if (leaderboardPeriod === 'ytd') {
        // Year to date
        const today = new Date();
        const year = today.getFullYear();
        const firstDay = new Date(year, 0, 1);
        
        startDate = formatToMMDDYYYY(firstDay);
        endDate = formatToMMDDYYYY(today);
        reportType = 'YTD Recap';
      }

      // Fetch leaderboard data - use 'getweeklyall' for top producers
      const response = await api.get('/alp/getweeklyall', {
        params: { 
          startDate: startDate,
          endDate: endDate,
          report: reportType
        }
      });

      if (response.data.success) {
        const rawData = response.data.data || [];
        
        // Get the report date - for YTD, find the most recent reportdate
        let reportDate = null;
        if (rawData.length > 0) {
          if (leaderboardPeriod === 'ytd') {
            // For YTD, find the maximum (most recent) reportdate from all items
            const reportDates = rawData
              .map(item => item.reportdate)
              .filter(date => date)
              .map(date => new Date(date).getTime())
              .filter(timestamp => !isNaN(timestamp));
            
            if (reportDates.length > 0) {
              const maxTimestamp = Math.max(...reportDates);
              reportDate = new Date(maxTimestamp).toISOString().split('T')[0];
            }
          } else {
            // For week/month, use the first item's reportdate (they should all be the same)
            reportDate = rawData[0].reportdate;
          }
        }
        
        // Set the "as of" date for display using the actual reportdate
        setLeaderboardAsOfDate(formatAsOfDate(reportDate, leaderboardPeriod, startDate, endDate));
        
        // Process leaderboard data - use LVL_1_NET
        const processedData = rawData
          .map((item, index) => ({
            rank: index + 1,
            name: item.LagnName || item.lagnname || 'Unknown',
            value: parseFloat(item.LVL_1_NET || item.lvl_1_net || 0),
            profile_picture: item.profpic || null,
            clname: item.clname || null,
            mga: item.mga || null,
            rga: item.rga || null
          }))
          .filter(item => item.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 10); // Top 10

        setLeaderboardData(processedData);
      }

    } catch (err) {
      console.error('Error fetching leaderboard data:', err);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  // Fetch Team Leaderboard Data (for team view)
  const fetchTeamLeaderboardData = async () => {
    try {
      console.log('🏆 [TeamLeaderboard] Fetching data...', { viewMode, timePeriod, viewScope, userRole });
      setTeamLeaderboardLoading(true);

      // Get date range based on time period
      const dateRange = getDateRange();
      const { startDate, endDate } = dateRange;
      
      // Map view mode to Weekly_ALP.REPORT type
      let reportType;
      if (viewMode === 'week') {
        reportType = 'Weekly Recap';
      } else if (viewMode === 'month') {
        reportType = 'MTD Recap'; // Will use max MTD Recap
      } else if (viewMode === 'year') {
        reportType = 'YTD Recap'; // Will use max YTD Recap
      } else {
        // Fallback to old logic if viewMode is not set
        reportType = timePeriod === 'ytd' ? 'YTD Recap' : 'MTD Recap';
      }

      const formattedStartDate = formatToMMDDYYYY(startDate);
      const formattedEndDate = formatToMMDDYYYY(endDate);
      
      console.log('🏆 [TeamLeaderboard] API params:', {
        viewMode,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        report: reportType
      });

      // Fetch all active users first
      const usersResponse = await api.get('/users/active');
      const allUsers = usersResponse.data || [];
      console.log('🏆 [TeamLeaderboard] All active users count:', allUsers.length);

      // Fetch from Weekly_ALP using existing endpoint
      const response = await api.get('/alp/getweeklyall', {
        params: {
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          report: reportType
        }
      });

      console.log('🏆 [TeamLeaderboard] API response:', response.data);

      if (response.data.success) {
        const rawData = response.data.data || [];
        console.log('🏆 [TeamLeaderboard] Weekly ALP data count:', rawData.length);
        
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

        // Create a map of ALP data by lagnname for easy lookup
        const alpDataMap = new Map();
        rawData.forEach(item => {
          if (item.LagnName) {
            alpDataMap.set(item.LagnName, item);
          }
        });

        // Transform ALL active users, merging with ALP data if available
        let transformedData = allUsers.map(user => {
          const alpData = alpDataMap.get(user.lagnname);
          const premium = alpData ? parseFloat(alpData.LVL_1_NET || 0) : 0;
          
          return {
            id: user.id,
            agent_name: formatAgentName(user.lagnname),
            mga_name: getMgaLastName(alpData?.MGA_NAME || user.mga, user.lagnname),
            email: user.email || '',
            policy_count: alpData?.policy_count || 0,
            total_premium: premium,
            lagnname: user.lagnname,
            userId: user.id,
            hasProduction: premium > 0
          };
        })
        .sort((a, b) => {
          // Sort by premium descending, then by name ascending for those with $0
          if (b.total_premium !== a.total_premium) {
            return b.total_premium - a.total_premium;
          }
          return a.lagnname.localeCompare(b.lagnname);
        })
        .slice(0, 50); // Show top 50 (includes those with and without production)

        console.log('🏆 [TeamLeaderboard] Transformed data:', transformedData.length, 'agents');
        console.log('🏆 [TeamLeaderboard] Sample agent:', transformedData[0]);
        console.log('🏆 [TeamLeaderboard] Users with production:', transformedData.filter(a => a.hasProduction).length);
        console.log('🏆 [TeamLeaderboard] Users without production:', transformedData.filter(a => !a.hasProduction).length);
        
        // Fetch goals for all agents in the leaderboard
        try {
          // Get the month/year from the dateRange
          const startDateObj = new Date(startDate);
          const month = startDateObj.getMonth() + 1;
          const year = startDateObj.getFullYear();
          
          console.log('🎯 [TeamLeaderboard] Fetching goals for:', { 
            year, 
            month, 
            viewMode,
            agentCount: transformedData.length 
          });
          
          // Collect userIds for batch goals fetch (filter out entries without userId)
          const userIds = transformedData
            .map(agent => agent.userId)
            .filter(id => id); // Filter out null/undefined
          
          console.log('🎯 [TeamLeaderboard] UserIds to fetch goals for:', userIds.length);
          
          if (userIds.length > 0) {
            // Fetch goals using batch endpoint
            const goalsResponse = await api.post('/goals/batch', {
              userIds: userIds,
              year: year,
              month: month,
              goalType: 'personal'
            });
            
            const goalsByUserId = goalsResponse.data?.goalsByUserId || {};
            console.log('🎯 [TeamLeaderboard] Goals fetched:', Object.keys(goalsByUserId).length);
            
            // Match goals with agents
            transformedData = transformedData.map(agent => {
              if (!agent.userId) {
                return {
                  ...agent,
                  monthlyGoal: null,
                  goalProgress: null,
                  goalRemaining: null
                };
              }
              
              const goalKey = `${agent.userId}_personal`;
              const goal = goalsByUserId[goalKey];
              
              if (!goal || !goal.monthlyAlpGoal) {
                return {
                  ...agent,
                  monthlyGoal: null,
                  goalProgress: null,
                  goalRemaining: null
                };
              }
              
              const monthlyGoal = parseFloat(goal.monthlyAlpGoal);
              const goalProgress = Math.round((agent.total_premium / monthlyGoal) * 100);
              const goalRemaining = Math.max(0, monthlyGoal - agent.total_premium);
              
              return {
                ...agent,
                monthlyGoal: monthlyGoal,
                goalProgress: goalProgress,
                goalRemaining: goalRemaining
              };
            });
            
            console.log('🎯 [TeamLeaderboard] Data with goals - sample:', {
              agent: transformedData[0]?.agent_name,
              premium: transformedData[0]?.total_premium,
              goal: transformedData[0]?.monthlyGoal,
              progress: transformedData[0]?.goalProgress
            });
          } else {
            console.log('⚠️ [TeamLeaderboard] No userIds found for goals lookup');
          }
        } catch (error) {
          console.error('❌ [TeamLeaderboard] Error fetching goals:', error);
          console.error('❌ [TeamLeaderboard] Error details:', {
            message: error.message,
            response: error.response?.data
          });
          // Continue without goals data
        }
        
        setTeamLeaderboardData(transformedData);
      } else {
        console.log('🏆 [TeamLeaderboard] API returned success=false');
        setTeamLeaderboardData([]);
      }
    } catch (error) {
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

  // Fetch data on mount and when viewScope, timePeriod, or dateRangeState changes
  useEffect(() => {
    fetchOrgMetrics();
    fetchCommits();
    if (timePeriod === 'ytd' || viewMode === 'year') {
      fetchYTDSummaryData();
    }
    
    // Fetch team leaderboard for team view
    if (['MGA', 'RGA', 'GA', 'SA'].includes(userRole) && viewScope !== 'personal') {
      fetchTeamLeaderboardData();
    }
  }, [userRole, user?.lagnname, viewScope, timePeriod, dateRangeState, viewMode]);

  // Fetch activity data when selectedPeriod or currentDate changes
  useEffect(() => {
    if (userRole === 'AGT' || viewScope === 'personal') {
      fetchActivityData();
    }
  }, [userRole, viewScope, selectedPeriod, currentDate, user?.userId]);

  // Fetch statistics data when statsTimeframe changes
  useEffect(() => {
    if (userRole === 'AGT' || viewScope === 'personal') {
      fetchStatsData();
    }
  }, [userRole, viewScope, statsTimeframe, user?.userId]);

  // Fetch leaderboard data on mount for AGT/personal view
  useEffect(() => {
    if (userRole === 'AGT' || viewScope === 'personal') {
      fetchLeaderboardData();
    }
  }, [userRole, viewScope, leaderboardPeriod]);

  // Render view mode toggle buttons based on user role
  const renderViewModeToggle = () => {
    if (userRole === 'SA') {
      return (
        <div className="view-mode-toggle">
          <button
            className={`nav-tab ${saViewMode === 'personal' ? 'active' : ''}`}
            onClick={() => setSaViewMode('personal')}
          >
            Personal
          </button>
          <span className="nav-separator">|</span>
          <button
            className={`nav-tab ${saViewMode === 'team' ? 'active' : ''}`}
            onClick={() => setSaViewMode('team')}
          >
            Team
          </button>
        </div>
      );
    }

    if (userRole === 'GA') {
      return (
        <div className="view-mode-toggle">
          <button
            className={`nav-tab ${gaViewMode === 'personal' ? 'active' : ''}`}
            onClick={() => setGaViewMode('personal')}
          >
            Personal
          </button>
          <span className="nav-separator">|</span>
          <button
            className={`nav-tab ${gaViewMode === 'team' ? 'active' : ''}`}
            onClick={() => setGaViewMode('team')}
          >
            Team
          </button>
        </div>
      );
    }

    if (userRole === 'MGA') {
      return (
        <div className="view-mode-toggle">
          <button
            className={`nav-tab ${mgaViewMode === 'personal' ? 'active' : ''}`}
            onClick={() => setMgaViewMode('personal')}
          >
            Personal
          </button>
          <span className="nav-separator">|</span>
          <button
            className={`nav-tab ${mgaViewMode === 'team' ? 'active' : ''}`}
            onClick={() => setMgaViewMode('team')}
          >
            Team
          </button>
        </div>
      );
    }

    if (userRole === 'RGA') {
      return (
        <div className="view-mode-toggle">
          <button
            className={`nav-tab ${rgaViewMode === 'personal' ? 'active' : ''}`}
            onClick={() => setRgaViewMode('personal')}
          >
            Personal
          </button>
          <span className="nav-separator">|</span>
          <button
            className={`nav-tab ${rgaViewMode === 'mga' ? 'active' : ''}`}
            onClick={() => setRgaViewMode('mga')}
          >
            MGA
          </button>
          <span className="nav-separator">|</span>
          <button
            className={`nav-tab ${rgaViewMode === 'rga' ? 'active' : ''}`}
            onClick={() => setRgaViewMode('rga')}
          >
            RGA
          </button>
        </div>
      );
    }

    // AGT users don't need a toggle
    return null;
  };

  return (
    <div className="dashboard-container padded-content-sm">
      {/* Competitions Section */}
      <div>
        <CompetitionsDisplay />
      </div>

      {/* Date Range Selection with View Scope Toggle */}
      {['MGA', 'RGA', 'GA', 'SA'].includes(userRole) && (
        <DateRangeSelector
          dateRange={dateRangeState}
          onDateRangeChange={handleDateRangeChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          viewScope={viewScope}
          onViewScopeChange={(newScope) => {
            if (userRole === 'SA') setSaViewMode(newScope);
            else if (userRole === 'GA') setGaViewMode(newScope);
            else if (userRole === 'MGA') setMgaViewMode(newScope);
            else if (userRole === 'RGA') setRgaViewMode(newScope);
          }}
          userRole={userRole}
        />
      )}

      {/* Org Metrics / Commits Widget - Only show for MGA, RGA, GA, SA in team view */}
      {(['MGA', 'RGA', 'GA', 'SA'].includes(userRole) && viewScope !== 'personal') && (
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
            orgMetricsHistory={orgMetricsHistory}
            showSectionBackground={false}
          />
        </div>
      )}

      {/* Team Leaderboard - Only show for MGA, RGA, GA, SA in team view */}
      {(['MGA', 'RGA', 'GA', 'SA'].includes(userRole) && viewScope !== 'personal') && (
        <div style={{ marginTop: '2rem' }}>
          <TeamLeaderboard
            agents={teamLeaderboardData}
            title="Team Performance Leaderboard"
            dateRange={{
              start: getDateRange().startDate.toISOString().split('T')[0],
              end: getDateRange().endDate.toISOString().split('T')[0]
            }}
            loading={teamLeaderboardLoading}
            onAgentClick={handleTeamLeaderboardAgentClick}
            showDetails={true}
            formatCurrency={formatCurrency}
          />
        </div>
      )}

      {/* Activity, Statistics & Leaderboard Widgets - Show for AGT or any role in personal view */}
      {(userRole === 'AGT' || viewScope === 'personal') && (
        <div style={{ 
          marginTop: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '1rem'
        }}>
          <div>
            <ActivityWidget
              activityData={activityData}
              activityLoading={activityLoading}
              selectedPeriod={selectedPeriod}
              setSelectedPeriod={setSelectedPeriod}
              viewMode={activityViewMode}
              setViewMode={setActivityViewMode}
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              getPeriodOptions={getPeriodOptions}
              getPeriodKeyForDate={getPeriodKeyForDate}
              comparisonData={comparisonData}
              officialYtdAlp={officialYtdAlp}
              error={activityError}
              formatCurrency={formatCurrency}
              formatNumber={formatNumber}
            />
          </div>

          <div>
            <StatisticsWidget
              statsTimeframe={statsTimeframe}
              setStatsTimeframe={setStatsTimeframe}
              statsLoading={statsLoading}
              statisticsData={statisticsData}
              formatCurrency={formatCurrency}
            />
          </div>

          <div>
            <div className="oneonone-section">
              {/* Header with "as of" date */}
              <div className="section-header">
                <h2>
                  Top Producers
                  {leaderboardAsOfDate && (
                    <span style={{ fontSize: '0.85em', fontWeight: 'normal', marginLeft: '0.5rem', opacity: 0.8 }}>
                      - as of {leaderboardAsOfDate}
                    </span>
                  )}
                </h2>
              </div>
              
              {/* Period selector tabs for leaderboard */}
              <div className="oneonone-period-tabs" style={{ marginBottom: '1rem' }}>
                <span 
                  className={leaderboardPeriod === "week" ? "selected" : "unselected"} 
                  onClick={() => setLeaderboardPeriod("week")}
                >
                  Week
                </span>
                <span className="separator">|</span>
                <span 
                  className={leaderboardPeriod === "month" ? "selected" : "unselected"} 
                  onClick={() => setLeaderboardPeriod("month")}
                >
                  Month
                </span>
                <span className="separator">|</span>
                <span 
                  className={leaderboardPeriod === "ytd" ? "selected" : "unselected"} 
                  onClick={() => setLeaderboardPeriod("ytd")}
                >
                  YTD
                </span>
              </div>
              
              <Leaderboard
                data={leaderboardData}
                title=""
                nameField="name"
                valueField="value"
                formatValue={formatCurrency}
                loading={leaderboardLoading}
                variant="compact"
                showProfilePicture={true}
                profilePictureField="profile_picture"
                showLevelBadge={true}
                showMGA={true}
                hierarchyLevel="all"
                currentUser={user}
                showScrollButtons={true}
              />
            </div>
          </div>
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
  );
};

export default TeamDashboard;

