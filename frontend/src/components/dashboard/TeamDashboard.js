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
import ThemeContext from '../../context/ThemeContext';
import api from '../../api';
import '../../pages/Dashboard.css';
import './TeamDashboard.css';

const TeamDashboard = ({ userRole, user }) => {
  console.log('📊 [TeamDashboard] Rendering for:', { userRole, userId: user?.userId, lagnname: user?.lagnname });
  const { theme } = useContext(ThemeContext);

  // View mode states for different roles
  const [saViewMode, setSaViewMode] = useState('team'); // 'personal' or 'team' for SA users
  const [gaViewMode, setGaViewMode] = useState('team'); // 'personal' or 'team' for GA users
  const [mgaViewMode, setMgaViewMode] = useState('team'); // 'personal' or 'team' for MGA users
  const [rgaViewMode, setRgaViewMode] = useState('mga'); // 'personal', 'mga', or 'rga' for RGA users

  // Time period selection
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

  // Determine the current view scope based on role and view mode
  const getViewScope = () => {
    if (userRole === 'SA') return saViewMode;
    if (userRole === 'GA') return gaViewMode;
    if (userRole === 'MGA') return mgaViewMode;
    if (userRole === 'RGA') return rgaViewMode;
    return 'personal'; // AGT default
  };

  const viewScope = getViewScope();

  // Get date range based on selected time period
  const getDateRange = () => {
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

  // Fetch data on mount and when viewScope or timePeriod changes
  useEffect(() => {
    fetchOrgMetrics();
    fetchCommits();
    if (timePeriod === 'ytd') {
      fetchYTDSummaryData();
    }
  }, [userRole, user?.lagnname, viewScope, timePeriod]);

  // Render view mode toggle buttons based on user role
  const renderViewModeToggle = () => {
    if (userRole === 'SA') {
      return (
        <div className="view-mode-toggle">
          <button
            className={`toggle-btn ${saViewMode === 'personal' ? 'active' : ''}`}
            onClick={() => setSaViewMode('personal')}
          >
            Personal
          </button>
          <button
            className={`toggle-btn ${saViewMode === 'team' ? 'active' : ''}`}
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
            className={`toggle-btn ${gaViewMode === 'personal' ? 'active' : ''}`}
            onClick={() => setGaViewMode('personal')}
          >
            Personal
          </button>
          <button
            className={`toggle-btn ${gaViewMode === 'team' ? 'active' : ''}`}
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
            className={`toggle-btn ${mgaViewMode === 'personal' ? 'active' : ''}`}
            onClick={() => setMgaViewMode('personal')}
          >
            Personal
          </button>
          <button
            className={`toggle-btn ${mgaViewMode === 'team' ? 'active' : ''}`}
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
            className={`toggle-btn ${rgaViewMode === 'personal' ? 'active' : ''}`}
            onClick={() => setRgaViewMode('personal')}
          >
            Personal
          </button>
          <button
            className={`toggle-btn ${rgaViewMode === 'mga' ? 'active' : ''}`}
            onClick={() => setRgaViewMode('mga')}
          >
            MGA
          </button>
          <button
            className={`toggle-btn ${rgaViewMode === 'rga' ? 'active' : ''}`}
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

      <div className="dashboard-header">
        {/* Time Period Selection */}
        <div className="time-period-selector">
          <button
            className={timePeriod === 'thisMonth' ? 'period-btn active' : 'period-btn'}
            onClick={() => setTimePeriod('thisMonth')}
          >
            This Month
          </button>
          <button
            className={timePeriod === 'lastMonth' ? 'period-btn active' : 'period-btn'}
            onClick={() => setTimePeriod('lastMonth')}
          >
            Last Month
          </button>
          <button
            className={timePeriod === 'ytd' ? 'period-btn active' : 'period-btn'}
            onClick={() => setTimePeriod('ytd')}
          >
            YTD
          </button>
        </div>
        
        {renderViewModeToggle()}
      </div>

      {/* Org Metrics / Commits Widget */}
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

