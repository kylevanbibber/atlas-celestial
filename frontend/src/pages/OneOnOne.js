import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ThemeContext from '../context/ThemeContext';
import LoadingSpinner from '../components/utils/LoadingSpinner';
import api from '../api';
import './OneOnOne.css';
import '../components/widgets/TrophyCase.css';

// Widget Components
import ActivityWidget from '../components/OneOnOne/ActivityWidget';
import HighlightsWidget from '../components/OneOnOne/HighlightsWidget';
import StatisticsWidget from '../components/OneOnOne/StatisticsWidget';
import RetentionWidget from '../components/OneOnOne/RetentionWidget';
import HierarchyWidget from '../components/OneOnOne/HierarchyWidget';
import ConventionWidget from '../components/OneOnOne/ConventionWidget';
import CommitsWidget from '../components/OneOnOne/CommitsWidget';

const OneOnOne = () => {
  const { user } = useAuth(); // The logged-in user from auth context
  const [selectedUser, setSelectedUser] = useState(null); // The user we're viewing (defaults to logged-in user)
  const [hierarchyUsers, setHierarchyUsers] = useState([]); // List of users in hierarchy for dropdown
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityData, setActivityData] = useState(null);
  const [orgMetricsLoading, setOrgMetricsLoading] = useState(false);
  const [orgMetrics, setOrgMetrics] = useState(null);
  const [alpAsOfDate, setAlpAsOfDate] = useState(null);
  const [commits, setCommits] = useState({ hires: null, codes: null, vips: null, alp: null });
  const [commitHistory, setCommitHistory] = useState({ hires: [], codes: [], vips: [], alp: [] });
  const [editingCommit, setEditingCommit] = useState(null); // 'hires', 'codes', 'vips', or null
  const [commitInput, setCommitInput] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyModalType, setHistoryModalType] = useState(null); // 'hires', 'codes', or 'vips'
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownData, setBreakdownData] = useState([]);
  const [statisticsData, setStatisticsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('week'); // week, month, ytd
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('reported'); // reported, official
  const [officialData, setOfficialData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [statsTimeframe, setStatsTimeframe] = useState('this_month'); // this_month, last_month, six_months, all_time
  const [viewScope, setViewScope] = useState('personal'); // personal | team
  const [recordMonth, setRecordMonth] = useState(null); // { value, month, timeSince }
  const [recordWeek, setRecordWeek] = useState(null);   // { value, range, reportdate, timeSince }
  const [recordMonthLoading, setRecordMonthLoading] = useState(false);
  const [recordWeekLoading, setRecordWeekLoading] = useState(false);
  const [officialYtdAlp, setOfficialYtdAlp] = useState(null);
  const [officialYtdF6, setOfficialYtdF6] = useState(null);
  const [hierarchyData, setHierarchyData] = useState([]);
  const [hierarchySummary, setHierarchySummary] = useState({
    RGA: 0,
    MGA: 0,
    GA: 0,
    SA: 0,
    AGT: 0
  });
  const [expandedRoles, setExpandedRoles] = useState({});
  const [promotionStatus, setPromotionStatus] = useState({
    vipWindowMonths: [], // ['04/2025','05/2025','06/2025']
    vipMonthsMet: [], // months in window where LVL_1_GROSS >= 5000
    vipCount: 0,
    personalMonthMet: false, // any month with LVL_1_NET > 0
    twoMonthNetMet: false, // whether previous 2 months sum to >= 16000 LVL_1_NET
    twoMonthPrevTwo: null, // { months: ['mm/yyyy','mm/yyyy'], total }
    lastMonthNeededThisMonth: null, // number required this month to reach 16000 with last month
    metPath: null, // 'VIP Path' or 'Two-Month Net Path'
    isQualified: false,
    isInVipWindow: false,
    vipPathMet: false,
    monthsBreakdown: [],
    vipTargets: [] // [{ month: 'mm/yyyy', neededGross: number, met: boolean }]
  });
  const [saPromotion, setSaPromotion] = useState({ twoMonthNet: 0, prev1Key: null, prev2Key: null, prev1Value: 0, prev2Value: 0, neededThisMonth: 0 });
  const [gaPromotion, setGaPromotion] = useState({ twoMonthNet: 0, prev1Key: null, prev2Key: null, prev1Value: 0, prev2Value: 0, neededThisMonth: 0 });
  const [conventionQualification, setConventionQualification] = useState({
    hireDate: null,
    monthsContracted: 0,
    requiredAlp: 0,
    currentAlp: 0,
    remainingAlp: 0,
    percentageComplete: 0,
    isQualified: false,
    userRole: null,
    requirements: [],
    additionalRequirements: [],
    qualificationPaths: [], // Track multiple paths with their status
    metPath: null, // Which path (if any) the user has met
    closestRequirementIndex: null // Index of requirement user is closest to
  });
  
  const [requirementsExpanded, setRequirementsExpanded] = useState(false);
  const [retentionData, setRetentionData] = useState(null);
  const [retentionLoading, setRetentionLoading] = useState(false);

  // Safe JSON parser for backend JSON string fields (e.g., pnp_data)
  const safeParseJSON = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  };

  const formatFourMoRate = (rate) => {
    if (rate === undefined || rate === null) return '—';
    const s = String(rate).trim();
    if (s.length === 0 || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '—';
    return s.endsWith('%') ? s : `${s}%`;
  };

  // The effective user we're viewing (either selectedUser or the logged-in user)
  // Use this for all data fetching, but use `user` for permissions/role checks
  const viewingUser = selectedUser || user;

  // Debug log for viewing user
  useEffect(() => {
    if (viewingUser) {
      console.log('🔍 [OneOnOne] Currently viewing user:', {
        userId: viewingUser.userId,
        lagnname: viewingUser.lagnname,
        clname: viewingUser.clname,
        isLoggedInUser: viewingUser.userId === user?.userId,
        loggedInUser: {
          userId: user?.userId,
          lagnname: user?.lagnname,
          clname: user?.clname
        }
      });
    }
  }, [viewingUser?.userId, viewingUser?.lagnname, viewingUser?.clname]);

  // Helper function to determine if role has multiple qualification paths
  const hasMultipleQualificationPaths = (userRole) => {
    return ['SA', 'GA', 'MGA', 'RGA'].includes(userRole);
  };

  // Handle user selection from dropdown
  const handleUserSelection = async (userId) => {
    if (!userId) {
      // Reset to logged-in user
      setSelectedUser(user);
      return;
    }

    try {
      // Fetch full user data for the selected user
      const response = await api.post('/auth/searchByUserIdLite', {
        userId: parseInt(userId),
        includeInactive: false
      });

      if (response.data?.data && response.data.data.length > 0) {
        const selectedUserData = response.data.data.find(u => u.id === parseInt(userId));
        if (selectedUserData) {
          // Create a user object similar to the auth context format
          setSelectedUser({
            userId: selectedUserData.id,
            lagnname: selectedUserData.lagnname,
            clname: selectedUserData.clname,
            esid: selectedUserData.esid,
            Role: selectedUserData.role,
            // Add other fields as needed
            ...selectedUserData
          });
        }
      }
    } catch (error) {
      console.error('Error fetching selected user data:', error);
      // Fall back to logged-in user on error
      setSelectedUser(user);
    }
  };

  // Initialize selectedUser when user loads or changes
  useEffect(() => {
    if (user && !selectedUser) {
      setSelectedUser(user);
    }
  }, [user]);

  // Fetch hierarchy for user selection dropdown (managers only)
  useEffect(() => {
    const fetchHierarchyForDropdown = async () => {
      if (!user?.userId) return;
      
      // Only fetch for managers
      if (!['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname)) return;
      
      try {
        setHierarchyLoading(true);
        const response = await api.post('/auth/searchByUserIdLite', {
          userId: user.userId,
          includeInactive: false // Only active users
        });
        
        if (response.data?.data) {
          const users = response.data.data || [];
          // Check if logged-in user is already in the hierarchy
          const selfAlreadyExists = users.some(u => u.id === user.userId);
          
          // Add the logged-in user to the list if not already there
          const usersWithSelf = selfAlreadyExists ? 
            users.map(u => ({
              id: u.id,
              lagnname: u.lagnname,
              clname: u.clname,
              isSelf: u.id === user.userId
            })) :
            [
              {
                id: user.userId,
                lagnname: user.lagnname,
                clname: user.clname,
                isSelf: true
              },
              ...users.map(u => ({
                id: u.id,
                lagnname: u.lagnname,
                clname: u.clname,
                isSelf: false
              }))
            ];
          setHierarchyUsers(usersWithSelf);
        }
      } catch (error) {
        console.error('Error fetching hierarchy for dropdown:', error);
      } finally {
        setHierarchyLoading(false);
      }
    };
    
    fetchHierarchyForDropdown();
  }, [user?.userId]);

  // Separate useEffect for initial load of static data (trophy, qualification, etc.)
  useEffect(() => {
    if (user?.userId) {
      fetchStaticData();
      if (user?.clname !== 'AGT') {
        fetchHierarchyData();
      }
      fetchOfficialYtdData(); // Fetch YTD data on component load for convention qualification
      if (viewingUser?.clname === 'AGT' || viewingUser?.clname === 'SA' || viewingUser?.clname === 'GA') {
        fetchPromotionData();
      }
      fetchRetentionData();
    }
  }, [user, viewingUser?.userId, viewingUser?.lagnname, viewingUser?.clname]);
  const fetchRetentionData = async () => {
    try {
      setRetentionLoading(true);
      if (!viewingUser?.lagnname) return;
      const res = await api.get(`/pnp/user-retention?lagnName=${encodeURIComponent(viewingUser.lagnname)}`);
      if (res?.data?.success) {
        setRetentionData(res.data.data || null);
      } else {
        setRetentionData(null);
      }
    } catch (e) {
      console.error('Error fetching retention data:', e);
      setRetentionData(null);
    } finally {
      setRetentionLoading(false);
    }
  };


  // Recompute highlights when switching Personal/Team view or selected user
  useEffect(() => {
    if (viewingUser?.userId) {
      fetchTrophyHighlights();
    }
  }, [viewingUser?.userId, viewScope]);

  // Separate useEffect for activity data that responds to period changes and selected user
  useEffect(() => {
    if (viewingUser?.userId) {
      fetchActivityData();
      if (viewMode === 'official') {
        if (selectedPeriod === 'week') {
          fetchOfficialData();
        } else if (selectedPeriod === 'month') {
          fetchOfficialMonthData();
        }
        // YTD data is already fetched on component load
      }
    }
  }, [viewingUser?.userId, selectedPeriod, currentDate, viewMode, viewScope]);

  // Separate useEffect for statistics that respond to stats timeframe changes and selected user
  useEffect(() => {
    if (viewingUser?.userId) {
      fetchStatsData();
    }
  }, [viewingUser?.userId, statsTimeframe, viewScope]);

  // Calculate convention qualification when user data changes (don't wait for YTD ALP)
  useEffect(() => {
    if (user?.esid) {
      calculateConventionQualification();
    }
  }, [user?.esid, officialYtdAlp, officialYtdF6]);

  // Utility function to get date range based on selected period
  const getDateRange = () => {
    const today = new Date();
    const viewingDate = new Date(currentDate);
    
    if (selectedPeriod === 'week') {
      // Get Monday of the current week
      const dayOfWeek = viewingDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(viewingDate);
      monday.setDate(viewingDate.getDate() + mondayOffset);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      return {
        startDate: monday.toISOString().split('T')[0],
        endDate: sunday.toISOString().split('T')[0]
      };
    } else if (selectedPeriod === 'month') {
      const startDate = new Date(viewingDate.getFullYear(), viewingDate.getMonth(), 1);
      const endDate = new Date(viewingDate.getFullYear(), viewingDate.getMonth() + 1, 0);
      
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };
    } else if (selectedPeriod === 'ytd') {
      const startDate = new Date(viewingDate.getFullYear(), 0, 1);
      const endDate = viewingDate.getFullYear() === today.getFullYear() ? today : new Date(viewingDate.getFullYear(), 11, 31);
      
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };
    }
  };

  // Build selectable options for the date dropdown based on selected period
  const getPeriodKeyForDate = (period, dateObj) => {
    const d = new Date(dateObj);
    if (period === 'week') {
      const day = d.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(d.getDate() + mondayOffset);
      return monday.toISOString().split('T')[0]; // use Monday ISO as key
    } else if (period === 'month') {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${yyyy}`;
    }
    // ytd -> year key
    return String(d.getFullYear());
  };

  const getPeriodOptions = (period) => {
    const options = [];
    const base = new Date(currentDate);
    if (period === 'week') {
      // last 12 weeks including current reference week
      for (let i = 0; i < 12; i++) {
        const ref = new Date(base);
        ref.setDate(ref.getDate() - i * 7);
        // Compute Monday locally to avoid UTC parsing shifts
        const day = ref.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const start = new Date(ref);
        start.setHours(0, 0, 0, 0);
        start.setDate(ref.getDate() + mondayOffset);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const key = start.toISOString().split('T')[0];
        options.push({
          key,
          label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
          date: start
        });
      }
    } else if (period === 'month') {
      // last 12 months
      for (let i = 0; i < 12; i++) {
        const ref = new Date(base.getFullYear(), base.getMonth() - i, 1);
        const key = getPeriodKeyForDate('month', ref);
        const label = ref.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
        options.push({ key, label, date: ref });
      }
    } else if (period === 'ytd') {
      // last 5 years
      for (let i = 0; i < 5; i++) {
        const year = base.getFullYear() - i;
        const key = String(year);
        const date = new Date(year, 0, 1);
        options.push({ key, label: key, date });
      }
    }
    return options;
  };

  // -------- Promotion (AGT -> SA) ---------
  const monthKeyFromDate = (dateObj) => {
    const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const y = dateObj.getFullYear();
    return `${m}/${y}`;
  };

  const getVipWindowMonths = (hireDateStr) => {
    try {
      const hire = new Date(hireDateStr);
      // 2nd, 3rd, 4th months after hire
      const months = [];
      for (let offset = 1; offset <= 3; offset++) {
        const d = new Date(hire.getFullYear(), hire.getMonth() + offset + 1 - 1, 1);
        months.push(monthKeyFromDate(d));
      }
      return months;
    } catch {
      return [];
    }
  };

  const parseMoneyField = (val) => {
    if (val === null || val === undefined) return 0;
    const n = parseFloat(String(val).toString().replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const fetchPromotionData = async () => {
    try {
      if (!viewingUser?.lagnname && !viewingUser?.LagnName) return;
      if (!viewingUser?.esid) return;
      const lagn = viewingUser.lagnname || viewingUser.LagnName;
      const vipWindow = getVipWindowMonths(viewingUser.esid);
      const now = new Date();
      const currentKey = monthKeyFromDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const prev1Key = monthKeyFromDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const prev2Key = monthKeyFromDate(new Date(now.getFullYear(), now.getMonth() - 2, 1));
      const isInVipWindow = vipWindow.includes(currentKey);

      const res = await api.get('/alp/mga/monthly-alp', { params: { lagnName: lagn } });
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];

      // Normalize month key and pick fields
      const normalized = rows.map(r => ({
        month: (r.month || '').trim(),
        lvl1Gross: parseMoneyField(r.LVL_1_GROSS ?? r.lvl_1_gross),
        lvl1Net: parseMoneyField(r.LVL_1_NET ?? r.lvl_1_net),
        lvl2Net: parseMoneyField(r.LVL_2_NET ?? r.lvl_2_net),
        lvl3Net: parseMoneyField(r.LVL_3_NET ?? r.lvl_3_net)
      }));
      const byMonth = new Map(normalized.map(r => [r.month, r]));

      // VIP months met inside window
      const vipMet = normalized
        .filter(r => vipWindow.includes(r.month) && r.lvl1Gross >= 5000)
        .map(r => r.month);

      // Personal month met (any month with LVL_1_NET > 0)
      const personalMet = normalized.some(r => r.lvl1Net > 0);

      // Two-month net path: previous two months relative to now
      const prev1Net = byMonth.get(prev1Key)?.lvl1Net || 0;
      const prev2Net = byMonth.get(prev2Key)?.lvl1Net || 0;
      const prevTwoTotal = prev1Net + prev2Net;
      const twoMonthNetMet = prevTwoTotal >= 16000;
      const prevTwo = { months: [prev2Key, prev1Key], total: prevTwoTotal };
      const lastMonthNeededThisMonth = Math.max(0, 16000 - prev1Net);

      // Determine met path per rules
      const vipPathMet = vipMet.length >= 2 && personalMet;
      const isQualified = vipPathMet || twoMonthNetMet;
      const metPath = vipPathMet ? '2 VIPs in months 2–4'
        : (twoMonthNetMet ? '$16,000+ across 2 months' : null);

      // Build months breakdown (show VIP window months, previous two, and current)
      const keysSet = new Set([prev2Key, prev1Key, currentKey, ...vipWindow]);
      // Filter out empty strings
      const validKeys = Array.from(keysSet).filter(k => k && /\d{2}\/\d{4}/.test(k));
      // Sort by date ascending
      const sortKey = (k) => { const [m, y] = k.split('/').map(n => parseInt(n, 10)); return y * 12 + m; };
      const sortedKeys = validKeys.sort((a, b) => sortKey(a) - sortKey(b));
      const monthsBreakdown = sortedKeys.map(k => {
        const rec = byMonth.get(k) || { lvl1Gross: 0, lvl1Net: 0 };
        const isVipWin = vipWindow.includes(k);
        const isVip = isVipWin && rec.lvl1Gross >= 5000;
        const isPersonal = rec.lvl1Net > 0;
        const isPrevTwo = (k === prev2Key || k === prev1Key);
        const isCurrent = (k === currentKey);
        const neededThis = isCurrent ? Math.max(0, 16000 - (byMonth.get(prev1Key)?.lvl1Net || 0)) : null;
        const neededVipGross = isVipWin ? Math.max(0, 5000 - rec.lvl1Gross) : null;
        return {
          month: k,
          lvl1Gross: rec.lvl1Gross,
          lvl1Net: rec.lvl1Net,
          isVipWindow: isVipWin,
          isVipMet: isVip,
          isPersonal,
          isPrevTwo,
          isCurrent,
          neededThis,
          neededVipGross
        };
      });

      // Build VIP targets list only for window months
      const vipTargets = monthsBreakdown
        .filter(m => m.isVipWindow)
        .map(m => ({ month: m.month, neededGross: m.neededVipGross || 0, met: m.isVipMet }));

      setPromotionStatus({
        vipWindowMonths: vipWindow,
        vipMonthsMet: vipMet,
        vipCount: vipMet.length,
        personalMonthMet: personalMet,
        twoMonthNetMet,
        twoMonthPrevTwo: prevTwo,
        lastMonthNeededThisMonth,
        metPath,
        isQualified,
        isInVipWindow,
        monthsBreakdown,
        vipPathMet,
        vipTargets
      });

      // SA -> GA promotion metric: $50,000 over 2 months using LVL_2_NET only
      const prev1Combined = (byMonth.get(prev1Key)?.lvl2Net || 0);
      const prev2Combined = (byMonth.get(prev2Key)?.lvl2Net || 0);
      setSaPromotion({ 
        twoMonthNet: prev1Combined + prev2Combined,
        prev1Key,
        prev2Key,
        prev1Value: prev1Combined,
        prev2Value: prev2Combined,
        neededThisMonth: Math.max(0, 50000 - prev1Combined)
      });

      // GA -> MGA promotion metric: $120,000 over 2 months using LVL_3_NET only
      const gaPrev1 = (byMonth.get(prev1Key)?.lvl3Net || 0);
      const gaPrev2 = (byMonth.get(prev2Key)?.lvl3Net || 0);
      setGaPromotion({ 
        twoMonthNet: gaPrev1 + gaPrev2,
        prev1Key,
        prev2Key,
        prev1Value: gaPrev1,
        prev2Value: gaPrev2,
        neededThisMonth: Math.max(0, 120000 - gaPrev1)
      });
    } catch (e) {
      console.error('Error fetching promotion data:', e);
    }
  };

  // Fetch official YTD from Weekly_ALP (max reportdate with REPORT='YTD Recap')
  const fetchOfficialYtdData = async () => {
    try {
      if (!user?.lagnname) return;
      const res = await api.get(`/alp/mga/weekly-ytd?lagnName=${encodeURIComponent(user.lagnname)}`);
      if (res?.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        const row = res.data.data[0];
        
        
        // Get Personal Net ALP (LVL_1_NET)
        const personalAlp = parseFloat(String(row.LVL_1_NET ?? row.lvl_1_net ?? 0));
        const finalPersonalAlp = isNaN(personalAlp) ? 0 : personalAlp;
        setOfficialYtdAlp(finalPersonalAlp);
        
        // Get First 6 Months Net ALP (LVL_2_F6_NET) for SA/GA F6 qualification
        const f6Alp = parseFloat(String(row.LVL_2_F6_NET ?? row.lvl_2_f6_net ?? 0));
        const finalF6Alp = isNaN(f6Alp) ? 0 : f6Alp;
        setOfficialYtdF6(finalF6Alp);
        
      } else {
        setOfficialYtdAlp(null);
        setOfficialYtdF6(null);
      }
    } catch (e) {
      console.error('Error fetching official YTD data:', e);
      setOfficialYtdAlp(null);
      setOfficialYtdF6(null);
    }
  };

  // Dedicated stats date range independent from activity period
  const getStatsDateRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based

    if (statsTimeframe === 'this_month') {
      const start = new Date(year, month, 1);
      const end = now;
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
    }

    if (statsTimeframe === 'last_month') {
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const start = new Date(prevYear, prevMonth, 1);
      const end = new Date(prevYear, prevMonth + 1, 0);
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
    }

    if (statsTimeframe === 'six_months') {
      const startRef = new Date(year, month, 1);
      // go back 5 more months to include current month as 1 of 6
      startRef.setMonth(startRef.getMonth() - 5);
      const start = new Date(startRef.getFullYear(), startRef.getMonth(), 1);
      const end = now;
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
    }

    // all_time
    return { startDate: '2000-01-01', endDate: now.toISOString().split('T')[0] };
  };

  // Fetch static data that doesn't change with period selection
  const fetchStaticData = async () => {
    try {
      setLoading(true);
      setError('');

      // Qualification data is now calculated dynamically in convention qualification

      // Fetch Record Month and Record Week highlights (personal view)
      await fetchTrophyHighlights();

    } catch (error) {
      console.error('Error fetching static 1on1 data:', error);
      setError('Failed to load static data: ' + (error.response?.data?.message || error.message));
      
    } finally {
      setLoading(false);
    }
  };

  // Helpers for parsing values/dates similar to TrophyCase
  const parseMoney = (v) => {
    if (v === null || v === undefined) return 0;
    const num = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const getUserLagnName = () => viewingUser?.lagnname || viewingUser?.LagnName || null;

  const formatWeeklyRangeFromReportDate = (reportdate) => {
    // reportdate expected mm/dd/yyyy
    try {
      const [m, d, y] = String(reportdate).split('/').map((t) => parseInt(t, 10));
      const end = new Date(y, m - 1, d);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      const fmt = (dt) => `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear().toString().slice(-2)}`;
      return `${fmt(start)} - ${fmt(end)}`;
    } catch {
      return String(reportdate);
    }
  };

  const timeSinceFromMonth = (mmYYYY) => {
    if (!mmYYYY || !mmYYYY.includes('/')) return '';
    try {
      const [mm, yyyy] = mmYYYY.split('/').map((t) => parseInt(t, 10));
      const then = new Date(yyyy, mm - 1, 1);
      const now = new Date();
      let months = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - (mm - 1));
      if (months < 0) months = 0;
      if (months < 1) return 'This month';
      if (months === 1) return '1 month ago';
      const years = Math.floor(months / 12);
      const rem = months % 12;
      if (years === 0) return `${months} months ago`;
      if (rem === 0) return `${years} year${years > 1 ? 's' : ''} ago`;
      return `${years}y ${rem}m ago`;
    } catch {
      return '';
    }
  };

  const timeSinceFromDate = (dateStr) => {
    // expects mm/dd/yyyy, output years/months like timeSinceFromMonth
    try {
      const [m, d, y] = String(dateStr).split('/').map((t) => parseInt(t, 10));
      const then = new Date(y, m - 1, d);
      const now = new Date();

      // Calculate year/month difference
      let years = now.getFullYear() - then.getFullYear();
      let months = now.getMonth() - then.getMonth();

      // Adjust if current day is before the target day
      if (now.getDate() < then.getDate()) {
        months -= 1;
      }

      if (months < 0) {
        months += 12;
        years -= 1;
      }

      const totalMonths = years * 12 + months;

      if (totalMonths <= 0) return 'This month';
      if (years === 0) return totalMonths === 1 ? '1 month ago' : `${totalMonths} months ago`;
      if (months === 0) return years === 1 ? '1 year ago' : `${years} years ago`;
      return `${years}y ${months}m ago`;
    } catch {
      return '';
    }
  };

  const fetchTrophyHighlights = async () => {
    try {
      const lagn = getUserLagnName();
      console.log('[fetchTrophyHighlights] Fetching for:', {
        lagnname: lagn,
        viewingUserId: viewingUser?.userId,
        viewingUserClname: viewingUser?.clname,
        viewScope
      });
      
      // Clear existing data before fetching new data
      setRecordMonth(null);
      setRecordWeek(null);
      setRecordMonthLoading(true);
      setRecordWeekLoading(true);
      // Monthly record - use all-trophy-case to get all users' data
      const monthlyRes = await api.get('/trophy/all-trophy-case');
      if (monthlyRes?.data?.success) {
        const rows = Array.isArray(monthlyRes.data.data) ? monthlyRes.data.data : [];
        const userRows = lagn ? rows.filter((r) => r.LagnName === lagn) : rows;
        console.log('[fetchTrophyHighlights] Monthly data:', {
          totalRows: rows.length,
          filteredToUser: userRows.length,
          filteringBy: lagn
        });
        // For team view with MGA/RGA roles, prefer specific CL_Name rows and LVL_3_NET
        const monthBest = new Map();
        const isTeamView = (viewScope === 'team') || (viewingUser?.clname === 'RGA' && (viewScope === 'mga' || viewScope === 'rga'));
        // Prefer MGA rows when:
        //  - user is MGA in team view, or
        //  - user is RGA and selected the MGA tab
        const preferMGA = (isTeamView && viewingUser?.clname === 'MGA') || (viewingUser?.clname === 'RGA' && viewScope === 'mga');
        // Prefer non-MGA rows when user is RGA and selected the RGA tab
        const preferNonMGA = (viewingUser?.clname === 'RGA' && viewScope === 'rga');
        // Group by month
        const byMonth = userRows.reduce((acc, r) => {
          const m = r.month;
          if (!m) return acc;
          if (!acc[m]) acc[m] = [];
          acc[m].push(r);
          return acc;
        }, {});
        Object.keys(byMonth).forEach((m) => {
          const list = byMonth[m];
          let candidates = list;
          if (preferMGA) {
            const mgas = list.filter(r => String(r.CL_Name || '').toUpperCase().includes('MGA'));
            if (mgas.length > 0) candidates = mgas;
          } else if (preferNonMGA) {
            const non = list.filter(r => !String(r.CL_Name || '').toUpperCase().includes('MGA'));
            if (non.length > 0) candidates = non;
          }
          // Compute value
          let best = null;
          candidates.forEach(r => {
            const personal = parseMoney(r.LVL_1_NET);
            const lvl3 = parseMoney(r.LVL_3_NET);
            const teamValue = (preferMGA || preferNonMGA) ? lvl3 : Math.max(parseMoney(r.LVL_2_NET), lvl3);
            const value = isTeamView ? teamValue : personal;
            if (!best || value > best.val) best = { val: value, month: m };
          });
          if (best) monthBest.set(m, best);
        });
        const best = Array.from(monthBest.values()).reduce((acc, cur) => (!acc || cur.val > acc.val ? cur : acc), null);
        if (best) {
          console.log('[fetchTrophyHighlights] Setting record month:', { value: best.val, month: best.month });
          setRecordMonth({ value: best.val, month: best.month, timeSince: timeSinceFromMonth(best.month) });
        } else {
          console.log('[fetchTrophyHighlights] No record month found');
        }
      }
      setRecordMonthLoading(false);

      // Weekly record - use all-weekly-trophy-case to get all users' data
      const weeklyRes = await api.get('/trophy/all-weekly-trophy-case');
      if (weeklyRes?.data?.success) {
        const rows = Array.isArray(weeklyRes.data.data) ? weeklyRes.data.data : [];
        const userRows = lagn ? rows.filter((r) => r.LagnName === lagn) : rows;
        console.log('[fetchTrophyHighlights] Weekly data:', {
          totalRows: rows.length,
          filteredToUser: userRows.length,
          filteringBy: lagn
        });
        // Deduplicate by reportdate keeping best, with CL_Name preferences for MGA/RGA
        const weekBest = new Map();
        const isTeamViewW = (viewScope === 'team') || (viewingUser?.clname === 'RGA' && (viewScope === 'mga' || viewScope === 'rga'));
        const preferMGAW = (isTeamViewW && viewingUser?.clname === 'MGA') || (viewingUser?.clname === 'RGA' && viewScope === 'mga');
        const preferNonMGAW = (viewingUser?.clname === 'RGA' && viewScope === 'rga');
        const byDate = userRows.reduce((acc, r) => {
          const d = r.reportdate;
          if (!d) return acc;
          if (!acc[d]) acc[d] = [];
          acc[d].push(r);
          return acc;
        }, {});
        Object.keys(byDate).forEach((d) => {
          const list = byDate[d];
          let candidates = list;
          if (preferMGAW) {
            const mgas = list.filter(r => String(r.CL_Name || '').toUpperCase().includes('MGA'));
            if (mgas.length > 0) candidates = mgas;
          } else if (preferNonMGAW) {
            const non = list.filter(r => !String(r.CL_Name || '').toUpperCase().includes('MGA'));
            if (non.length > 0) candidates = non;
          }
          let best = null;
          candidates.forEach(r => {
            const personal = parseMoney(r.LVL_1_NET);
            const lvl3 = parseMoney(r.LVL_3_NET);
            const teamValue = (preferMGAW || preferNonMGAW) ? lvl3 : Math.max(parseMoney(r.LVL_2_NET), lvl3);
            const value = isTeamViewW ? teamValue : personal;
            if (!best || value > best.val) best = { val: value, reportdate: d };
          });
          if (best) weekBest.set(d, best);
        });
        const best = Array.from(weekBest.values()).reduce((acc, cur) => (!acc || cur.val > acc.val ? cur : acc), null);
        if (best) {
          console.log('[fetchTrophyHighlights] Setting record week:', { value: best.val, reportdate: best.reportdate });
          setRecordWeek({
            value: best.val,
            reportdate: best.reportdate,
            range: formatWeeklyRangeFromReportDate(best.reportdate),
            timeSince: timeSinceFromDate(best.reportdate)
          });
        } else {
          console.log('[fetchTrophyHighlights] No record week found');
        }
      }
      setRecordWeekLoading(false);
    } catch (e) {
      console.error('Error fetching trophy highlights:', e);
      setRecordMonthLoading(false);
      setRecordWeekLoading(false);
    }
  };

  // Fetch hierarchy data and calculate clname sums
  const fetchHierarchyData = async () => {
    try {
      if (!user?.userId) {
        console.error('User ID not available for hierarchy data');
        return;
      }

      const response = await api.post('/auth/userHierarchy', {
        userId: user.userId
      });
      
      if (response.data.success) {
        const hierarchyUsersRaw = response.data.data || [];
        // Normalize potential JSON string fields
        const hierarchyUsers = hierarchyUsersRaw.map(u => ({
          ...u,
          pnp_data: safeParseJSON(u?.pnp_data) || u?.pnp_data || null
        }));
        setHierarchyData(hierarchyUsers);
        
        // Calculate the sum of different clname values
        const summary = calculateHierarchySummary(hierarchyUsers);
        setHierarchySummary(summary);
      } else {
        console.error('Failed to fetch hierarchy data:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching hierarchy data:', error);
    }
  };

  // Calculate the sum/count of different clname values in the hierarchy
  const calculateHierarchySummary = (hierarchyUsers) => {
    const summary = {
      RGA: 0,
      MGA: 0,
      GA: 0,
      SA: 0,
      AGT: 0
    };

    // Count each clname type in the hierarchy
    hierarchyUsers.forEach(user => {
      const clname = user.clname;
      if (summary.hasOwnProperty(clname)) {
        summary[clname]++;
      }
    });

    return summary;
  };

  const toggleRoleExpanded = (role) => {
    setExpandedRoles(prev => ({ ...prev, [role]: !prev[role] }));
  };

  const getRoleAgents = (role) => {
    try {
      return (hierarchyData || []).filter(u => u?.clname === role);
    } catch {
      return [];
    }
  };

  const getUserDisplayName = (u) => {
    const name = u?.lagnname || u?.LagnName || u?.name || [u?.firstName, u?.lastName].filter(Boolean).join(' ');
    return name && name.trim().length > 0 ? name : (u?.email || String(u?.userId || u?.id || ''));
  };

  // Calculate convention qualification based on hire date, role, and current YTD ALP
  const calculateConventionQualification = () => {
    try {
      if (!user?.esid) {
        console.error('User ESID not available for convention qualification');
        return;
      }

      // Use user's esid as the hire date (esid is the contracted hire date)
      const hireDate = user.esid;
      const userRole = user.clname;
      
      console.log('[Convention Qualification] Starting calculation for:', {
        userRole,
        hireDate,
        officialYtdAlp,
        officialYtdF6
      });
      
      // Calculate months contracted from hire date to December 31st of current year
      const monthsContracted = calculateMonthsContracted(hireDate);
      console.log('[Convention Qualification] Months contracted to Dec 31:', monthsContracted, monthsContracted >= 12 ? '(displayed as 12+)' : '');
      
      // Get qualification requirements based on role
      const qualificationData = getQualificationByRole(userRole, monthsContracted);
      console.log('[Convention Qualification] Role requirements:', {
        requiredAlp: qualificationData.requiredAlp,
        qualificationPath: qualificationData.qualificationPath,
        requirementsCount: qualificationData.requirements.length,
        additionalRequirementsCount: qualificationData.additionalRequirements.length
      });
      
      // Use current YTD ALP and F6 data
      const currentPersonalAlp = officialYtdAlp || 0;
      const currentF6Alp = officialYtdF6 || 0;
      // Calculate combination as LVL_1_NET + LVL_2_F6_NET per requirements
      const currentCombinedAlp = currentPersonalAlp + currentF6Alp;
      
      console.log('[Convention Qualification] Current ALP values:', {
        personalAlp: currentPersonalAlp,
        f6Alp: currentF6Alp,
        combinedAlp: currentCombinedAlp
      });
      
      // Check qualification paths for SA and GA users
      let qualificationResult;
      if (userRole === 'SA') {
        qualificationResult = checkSAQualification(qualificationData, currentPersonalAlp, currentF6Alp, currentCombinedAlp);
      } else if (userRole === 'GA') {
        qualificationResult = checkGAQualification(qualificationData, currentPersonalAlp, currentF6Alp, currentCombinedAlp);
      } else {
        // For other roles, use personal ALP only
        qualificationResult = {
          isQualified: currentPersonalAlp >= qualificationData.requiredAlp,
          metPath: currentPersonalAlp >= qualificationData.requiredAlp ? 'Personal ALP' : null,
          displayRequiredAlp: qualificationData.requiredAlp,
          displayCurrentAlp: currentPersonalAlp,
          remainingAlp: Math.max(0, qualificationData.requiredAlp - currentPersonalAlp),
          percentageComplete: qualificationData.requiredAlp > 0 ? 
            Math.min(100, (currentPersonalAlp / qualificationData.requiredAlp) * 100) : 0,
          qualificationPaths: [{
            name: 'Personal Net ALP',
            required: qualificationData.requiredAlp,
            current: currentPersonalAlp,
            met: currentPersonalAlp >= qualificationData.requiredAlp
          }],
          closestRequirementIndex: 0 // Single requirement for other roles
        };
      }

      console.log('[Convention Qualification] Final result:', {
        isQualified: qualificationResult.isQualified,
        metPath: qualificationResult.metPath,
        currentAlp: qualificationResult.displayCurrentAlp,
        requiredAlp: qualificationResult.displayRequiredAlp,
        remainingAlp: qualificationResult.remainingAlp,
        percentageComplete: qualificationResult.percentageComplete,
        pathsChecked: qualificationResult.qualificationPaths.length
      });
      
      setConventionQualification({
        hireDate,
        monthsContracted,
        requiredAlp: qualificationResult.displayRequiredAlp,
        currentAlp: qualificationResult.displayCurrentAlp,
        remainingAlp: qualificationResult.remainingAlp,
        percentageComplete: qualificationResult.percentageComplete,
        isQualified: qualificationResult.isQualified,
        userRole,
        requirements: qualificationData.requirements,
        additionalRequirements: qualificationData.additionalRequirements,
        qualificationPaths: qualificationResult.qualificationPaths,
        metPath: qualificationResult.metPath,
        closestRequirementIndex: qualificationResult.closestRequirementIndex
      });

    } catch (error) {
      console.error('Error calculating convention qualification:', error);
    }
  };

  // Check SA qualification paths
  const checkSAQualification = (qualificationData, personalAlp, f6Alp, combinedAlp) => {
    const proRatedPersonalReq = qualificationData.requiredAlp; // Already pro-rated in getQualificationByRole
    const f6Requirement = 200000; // Fixed requirement for F6
    
    console.log('[SA Qualification] Checking paths with requirements:', {
      personalReq: proRatedPersonalReq,
      f6Req: f6Requirement,
      combinedReq: f6Requirement
    });
    
    const paths = [
      {
        name: 'Personal Net ALP',
        required: proRatedPersonalReq,
        current: personalAlp,
        met: personalAlp >= proRatedPersonalReq
      },
      {
        name: 'Combined Personal + F6 Agent Net ALP',
        required: f6Requirement, // Use F6 requirement for combined
        current: combinedAlp,
        met: combinedAlp >= f6Requirement,
        personalPortion: personalAlp,
        f6Portion: f6Alp,
        isCombined: true
      }
    ];
    
    const metPaths = paths.filter(path => path.met);
    const bestPath = metPaths.length > 0 ? metPaths[0] : paths[0]; // Use first met path or first path
    
    // Find the path with the highest completion percentage (closest to qualifying)
    const pathsWithProgress = paths.map((path, index) => ({
      ...path,
      index,
      percentageComplete: path.required > 0 ? Math.min(100, (path.current / path.required) * 100) : 0
    }));
    
    const closestPath = pathsWithProgress.reduce((closest, current) => 
      current.percentageComplete > closest.percentageComplete ? current : closest
    );
    
    console.log('[SA Qualification] Path results:', {
      pathsTotal: paths.length,
      pathsMet: metPaths.length,
      bestPathName: bestPath.name,
      bestPathMet: bestPath.met,
      closestPathName: closestPath.name,
      closestPathProgress: closestPath.percentageComplete,
      metPathNames: metPaths.map(p => p.name)
    });
    
    return {
      isQualified: metPaths.length > 0,
      metPath: metPaths.length > 0 ? bestPath.name : null,
      displayRequiredAlp: bestPath.required,
      displayCurrentAlp: bestPath.current,
      remainingAlp: Math.max(0, bestPath.required - bestPath.current),
      percentageComplete: bestPath.required > 0 ? Math.min(100, (bestPath.current / bestPath.required) * 100) : 0,
      qualificationPaths: paths,
      closestRequirementIndex: closestPath.index
    };
  };

  // Check GA qualification paths
  const checkGAQualification = (qualificationData, personalAlp, f6Alp, combinedAlp) => {
    const proRatedPersonalReq = qualificationData.requiredAlp; // Already pro-rated
    const f6Requirement = 250000; // Fixed requirement for F6 (GA has higher requirement than SA)
    
    console.log('[GA Qualification] Checking paths with requirements:', {
      personalReq: proRatedPersonalReq,
      f6Req: f6Requirement,
      combinedReq: f6Requirement
    });
    
    const paths = [
      {
        name: 'Personal Net ALP',
        required: proRatedPersonalReq,
        current: personalAlp,
        met: personalAlp >= proRatedPersonalReq
      },
      {
        name: 'Combined Personal + F6 Agent Net ALP',
        required: f6Requirement, // Use F6 requirement for combined
        current: combinedAlp,
        met: combinedAlp >= f6Requirement,
        personalPortion: personalAlp,
        f6Portion: f6Alp,
        isCombined: true
      }
    ];
    
    const metPaths = paths.filter(path => path.met);
    const bestPath = metPaths.length > 0 ? metPaths[0] : paths[0];
    
    // Find the path with the highest completion percentage (closest to qualifying)
    const pathsWithProgress = paths.map((path, index) => ({
      ...path,
      index,
      percentageComplete: path.required > 0 ? Math.min(100, (path.current / path.required) * 100) : 0
    }));
    
    const closestPath = pathsWithProgress.reduce((closest, current) => 
      current.percentageComplete > closest.percentageComplete ? current : closest
    );
    
    console.log('[GA Qualification] Path results:', {
      pathsTotal: paths.length,
      pathsMet: metPaths.length,
      bestPathName: bestPath.name,
      bestPathMet: bestPath.met,
      closestPathName: closestPath.name,
      closestPathProgress: closestPath.percentageComplete,
      metPathNames: metPaths.map(p => p.name)
    });
    
    return {
      isQualified: metPaths.length > 0,
      metPath: metPaths.length > 0 ? bestPath.name : null,
      displayRequiredAlp: bestPath.required,
      displayCurrentAlp: bestPath.current,
      remainingAlp: Math.max(0, bestPath.required - bestPath.current),
      percentageComplete: bestPath.required > 0 ? Math.min(100, (bestPath.current / bestPath.required) * 100) : 0,
      qualificationPaths: paths,
      closestRequirementIndex: closestPath.index
    };
  };

  // Calculate months between hire date and December 31st of current year
  const calculateMonthsContracted = (hireDate) => {
    const hire = new Date(hireDate);
    const currentYear = new Date().getFullYear();
    const decemberEnd = new Date(currentYear, 11, 31); // December 31st of current year
    
    let years = decemberEnd.getFullYear() - hire.getFullYear();
    let months = decemberEnd.getMonth() - hire.getMonth();
    
    if (decemberEnd.getDate() < hire.getDate()) {
      months--;
    }
    
    if (months < 0) {
      months += 12;
      years--;
    }
    
    const totalMonths = years * 12 + months;
    
    // Cap at 12+ months, minimum 0
    return Math.min(Math.max(0, totalMonths), 12);
  };

  // Get required ALP based on months contracted (convention qualification table)
  const getRequiredAlpForConvention = (monthsContracted) => {
    if (monthsContracted < 7) return 50000;        // < 7 months
    if (monthsContracted === 7) return 58333;      // 7 months
    if (monthsContracted === 8) return 66667;      // 8 months  
    if (monthsContracted === 9) return 75000;      // 9 months
    if (monthsContracted === 10) return 83333;     // 10 months
    if (monthsContracted === 11) return 91667;     // 11 months
    return 100000;                                 // 12+ months
  };

  // Get qualification requirements based on user role
  const getQualificationByRole = (userRole, monthsContracted) => {
    // Check if user has been contracted less than 1 year (pro-rated qualification)
    const isProRated = monthsContracted < 12;
    const proRateMultiplier = isProRated ? (monthsContracted / 12) : 1;

    switch (userRole) {
      case 'SA': // Supervising Agent
        return {
          requiredAlp: Math.round(100000 * proRateMultiplier),
          qualificationPath: 'Supervising Agent',
          requirements: [
            `$${formatNumber(Math.round(100000 * proRateMultiplier))} Personal Net ALP ${isProRated ? '(Pro-rated)' : ''}`,
            'OR $120,000 Net Annualized Premium',
            `OR Combined Personal + F6 Agent Net ALP totaling $200,000`
          ],
          additionalRequirements: [
            'At least 1 active First Six Months Agent as of Dec 31, 2025',
            'Combination of Personal + Agent Production allowed'
          ]
        };

      case 'GA': // General Agent
        return {
          requiredAlp: Math.round(100000 * proRateMultiplier),
          qualificationPath: 'General Agent',
          requirements: [
            `$${formatNumber(Math.round(100000 * proRateMultiplier))} Personal Net ALP ${isProRated ? '(Pro-rated)' : ''}`,
            'OR $120,000 Net Annualized Premium',
            `OR Combined Personal + F6 Agent Net ALP totaling $250,000`
          ],
          additionalRequirements: [
            'At least 2 active First Six Months Agents as of Dec 31, 2025',
            'Combination of Personal + Agent Production allowed'
          ]
        };

      case 'MGA': // Master General Agent
        // Determine if Rookie or Veteran MGA
        const quartersCompleted = Math.floor(monthsContracted / 3);
        const isRookieMGA = quartersCompleted < 4;
        
        if (isRookieMGA) {
          return {
            requiredAlp: Math.round(300000 * proRateMultiplier),
            qualificationPath: 'Master General Agent (Rookie)',
            requirements: [
              `$${formatNumber(Math.round(100000 * proRateMultiplier))} Personal Net ALP ${isProRated ? '(Pro-rated)' : ''}`,
              'OR $120,000 Personal Net Annualized Premium',
              `OR $${formatNumber(Math.round(300000 * proRateMultiplier))} Agency Net ALP ${isProRated ? '(Pro-rated)' : ''}`
            ],
            additionalRequirements: [
              'Rookie MGA status (less than 4 quarters completed)',
              'Agency ALP based on YTD MGA/RGA Report'
            ]
          };
        } else {
          return {
            requiredAlp: Math.round(375000 * proRateMultiplier),
            qualificationPath: 'Master General Agent (Veteran)',
            requirements: [
              `$${formatNumber(Math.round(100000 * proRateMultiplier))} Personal Net ALP ${isProRated ? '(Pro-rated)' : ''}`,
              'OR $120,000 Personal Net Annualized Premium',
              `OR $${formatNumber(Math.round(375000 * proRateMultiplier))} Agency Net ALP with 10% YTD growth ${isProRated ? '(Pro-rated)' : ''}`
            ],
            additionalRequirements: [
              'Veteran MGA status (4+ quarters completed)',
              'Agency ALP based on YTD MGA/RGA Report',
              'Must have 10% growth over prior year for Agency ALP option'
            ]
          };
        }

      case 'RGA': // Regional General Agent
        return {
          requiredAlp: Math.round(400000 * proRateMultiplier),
          qualificationPath: 'Regional General Agent',
          requirements: [
            `$${formatNumber(Math.round(400000 * proRateMultiplier))} Agency Net ALP with 10% YTD growth ${isProRated ? '(Pro-rated)' : ''}`,
            'OR $400,000 Agency Net ALP with 10% growth at highest level (MGA + RGA)',
            'OR Qualify as MGA with own MGA agency Net ALP production'
          ],
          additionalRequirements: [
            'Must have minimum 1 full year comparison benchmark',
            'Agency ALP based on YTD MGA/RGA Report',
            'Growth calculated against prior year'
          ]
        };

      default: // AGT or other roles - use original agent qualification
        const originalRequiredAlp = getRequiredAlpForConvention(monthsContracted);
        return {
          requiredAlp: originalRequiredAlp,
          qualificationPath: getConventionQualificationDescription(monthsContracted),
          requirements: [
            `$${formatNumber(originalRequiredAlp)} Net ALP required`
          ],
          additionalRequirements: [
            'Based on contracted hire date',
            'Standard agent qualification'
          ]
        };
    }
  };

  // Get convention qualification description based on months
  const getConventionQualificationDescription = (monthsContracted) => {
    if (monthsContracted < 7) return 'Less than 7 months (After May 31, 2025)';
    if (monthsContracted === 7) return '7 months (May 2025)';
    if (monthsContracted === 8) return '8 months (April 2025)';
    if (monthsContracted === 9) return '9 months (March 2025)';
    if (monthsContracted === 10) return '10 months (February 2025)';
    if (monthsContracted === 11) return '11 months (January 2025)';
    return '12+ months (Prior to January 2025)';
  };

  // Fetch activity data that changes with period selection
  const fetchActivityData = async () => {
    try {
      setActivityLoading(true);
      setError('');

      if (!viewingUser?.userId) {
        setError('User information not available');
        return;
      }

      // Get date range for selected period
      const dateRange = getDateRange();
      if (!dateRange) {
        setError('Invalid date range');
        return;
      }

      // Fetch activity data from Daily_Activity table
      let endpoint;
      const ln = encodeURIComponent(viewingUser?.lagnname || viewingUser?.LagnName || '');
      const uid = encodeURIComponent(String(viewingUser?.userId || ''));
      if (['SA','GA','MGA'].includes(viewingUser?.clname) && viewScope === 'team') {
        endpoint = `/dailyActivity/team-summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&lagnname=${ln}&userId=${uid}`;
      } else if (viewingUser?.clname === 'RGA' && viewScope === 'mga') {
        endpoint = `/dailyActivity/team-summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&lagnname=${ln}&userId=${uid}`;
      } else if (viewingUser?.clname === 'RGA' && viewScope === 'rga') {
        endpoint = `/dailyActivity/team-summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&lagnname=${ln}&userId=${uid}&roleScope=rga`;
      } else {
        endpoint = `/dailyActivity/user-summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&userId=${uid}`;
      }
      console.log('[OneOnOne] Fetching activity data', {
        scope: viewScope,
        role: viewingUser?.clname,
        viewingUserId: viewingUser?.userId,
        endpoint,
        dateRange
      });
      const activityResponse = await api.get(endpoint);
      console.log('[OneOnOne] Activity response raw payload:', activityResponse?.data);
      
      if (activityResponse.data.success) {
        // Aggregate the daily activity data
        const dailyData = activityResponse.data.data;
        if (viewScope === 'team') {
          console.log('[OneOnOne] Aggregating TEAM daily data', { count: dailyData?.length || 0 });
        }
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
      setError('Failed to load activity data: ' + (error.response?.data?.message || error.message));
      
      // Set fallback data so the component still renders
      setActivityData({
        calls: 0, appts: 0, sits: 0, sales: 0, alp: 0,
        refs: 0, refAppt: 0, refSit: 0, refSale: 0, refAlp: 0
      });

      setStatisticsData({
        showRatio: 0,
        closeRatio: 0,
        alpPsr: 0,
        alpPsrGoal: 613.90,
        alpNeed: 1,
        recruitLevel: 601
      });
    } finally {
      setActivityLoading(false);
    }
  };

  // Fetch org-level Hires, Codes, VIPs for MGA/RGA/GA/SA users (current month totals)
  const fetchOrgMetrics = async () => {
    try {
      if (!['MGA', 'RGA', 'GA', 'SA'].includes(viewingUser?.clname)) return;
      if (!viewingUser?.lagnname) return;
      // Only when viewing org scope (not personal)
      const isOrgScope = (viewingUser?.clname === 'MGA' && viewScope === 'team') || 
                         (viewingUser?.clname === 'RGA' && (viewScope === 'mga' || viewScope === 'rga')) ||
                         (viewingUser?.clname === 'GA' && viewScope === 'team') ||
                         (viewingUser?.clname === 'SA' && viewScope === 'team');
      if (!isOrgScope) { setOrgMetrics(null); return; }
      setOrgMetricsLoading(true);

      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();

      // Determine which lagnnames to aggregate
      let lagnNames = [viewingUser.lagnname]; // Always include the viewing user themselves
      
      if (String(viewingUser?.clname).toUpperCase() === 'MGA' && viewScope === 'team') {
        // For MGA viewing team: include self only (their team rolls up to them)
        lagnNames = [viewingUser.lagnname];
      } else if (String(viewingUser?.clname).toUpperCase() === 'GA' && viewScope === 'team') {
        // For GA viewing team: include self only (their team rolls up to them)
        lagnNames = [viewingUser.lagnname];
      } else if (String(viewingUser?.clname).toUpperCase() === 'SA' && viewScope === 'team') {
        // For SA viewing team: include self only (their team rolls up to them)
        lagnNames = [viewingUser.lagnname];
      } else if (String(viewingUser?.clname).toUpperCase() === 'RGA' && viewScope === 'rga') {
        // Get all MGAs that count for this RGA (including first-year rollups)
        try {
          const rollupRes = await api.get(`/mga-hierarchy/rga-rollup/${encodeURIComponent(viewingUser.lagnname)}`);
          if (rollupRes?.data?.success) {
            const mgas = rollupRes.data.data.mgas || [];
            const mgaNames = mgas.map(m => m.lagnname).filter(Boolean);
            // Include the RGA themselves PLUS all their MGAs
            lagnNames = [viewingUser.lagnname, ...mgaNames];
            console.log(`[OrgMetrics] RGA rollup for ${viewingUser.lagnname}:`, {
              total: rollupRes.data.data.totalMGAs + 1, // +1 for self
              direct: rollupRes.data.data.directMGAs,
              firstYear: rollupRes.data.data.firstYearMGAs,
              includingSelf: true,
              names: lagnNames
            });
          }
        } catch (e) {
          console.warn('Failed to load RGA rollup; falling back to user only', e);
        }
      } else if (String(viewingUser?.clname).toUpperCase() === 'RGA' && viewScope === 'mga') {
        // For RGA viewing MGA scope: include self only (their MGA numbers)
        lagnNames = [viewingUser.lagnname];
      }

      // Fetch per-lagnname and aggregate MTD
      const fetchForName = async (name) => {
        const enc = encodeURIComponent(name);
        const [vipsRes, codesRes, hiresRes] = await Promise.all([
          api.get(`/dataroutes/vips/multiple?value=${enc}`),
          api.get(`/dataroutes/associates/multiple?value=${enc}`),
          api.get(`/dataroutes/total-hires?value=${enc}`)
        ]);
        const vipsArr = vipsRes?.data?.data || [];
        const codesArr = codesRes?.data?.data || [];
        const hiresArr = hiresRes?.data?.data || [];
        const vipsMTDLocal = vipsArr.filter((row) => {
          const d = row?.vip_month ? new Date(row.vip_month) : null;
          return d && d.getFullYear() === year && d.getMonth() === month;
        }).length;
        const codesMTDLocal = codesArr.filter((row) => {
          const d = row?.PRODDATE ? new Date(row.PRODDATE) : null;
          return d && d.getFullYear() === year && d.getMonth() === month;
        }).length;
        const hiresMTDLocal = hiresArr.reduce((sum, row) => {
          const d = row?.MORE_Date ? new Date(row.MORE_Date) : null;
          if (d && d.getFullYear() === year && d.getMonth() === month) {
            const n = parseFloat(row?.Total_Hires) || 0;
            return sum + n;
          }
          return sum;
        }, 0);
        return { vipsMTDLocal, codesMTDLocal, hiresMTDLocal };
      };

      const results = await Promise.all(lagnNames.map(fetchForName));
      
      // Get Potential VIPs data and calculate per-MGA VIP counts using the same logic
      let vipsByMGA = {};
      try {
        const ym = `${year}-${String(month + 1).padStart(2, '0')}`; // YYYY-MM
        const potRes = await api.get('/admin/potential-vips', { params: { month: ym } });
        const potRows = potRes?.data?.data || [];
        const allowedSet = new Set(lagnNames.map(n => String(n).toLowerCase()));
        
        // Count VIPs per MGA
        lagnNames.forEach(name => {
          vipsByMGA[name] = 0;
        });
        
        potRows.forEach(r => {
          const mgaName = String(r?.mga || '').toLowerCase();
          const matchedMGA = lagnNames.find(n => String(n).toLowerCase() === mgaName);
          if (!matchedMGA) return;
          
          const gross = typeof r?.totalLvl1Gross === 'number' ? r.totalLvl1Gross : parseFloat(r?.totalLvl1Gross || 0);
          if (Number.isFinite(gross) && gross >= 5000) {
            vipsByMGA[matchedMGA] = (vipsByMGA[matchedMGA] || 0) + 1;
          }
        });
      } catch (e) {
        console.warn('Potential VIPs fetch failed; falling back to VIP count', e);
        // Fallback to the regular VIP count
        lagnNames.forEach((name, idx) => {
          vipsByMGA[name] = results[idx].vipsMTDLocal;
        });
      }
      
      // Store per-MGA breakdown for modal with rollup info
      let rollupInfo = {};
      if (String(user?.clname).toUpperCase() === 'RGA' && viewScope === 'rga') {
        // Get rollup information from the previous API call
        try {
          const rollupRes = await api.get(`/mga-hierarchy/rga-rollup/${encodeURIComponent(user.lagnname)}`);
          if (rollupRes?.data?.success) {
            const mgas = rollupRes.data.data.mgas || [];
            mgas.forEach(mga => {
              rollupInfo[mga.lagnname] = {
                isFirstYear: mga.isFirstYear || false,
                rollupReason: mga.rollupReason,
                uplineMGA: mga.rga // This is the MGA they roll up to (not the RGA)
              };
            });
          }
        } catch (e) {
          console.warn('Failed to get rollup info for breakdown', e);
        }
      }
      
      const breakdown = lagnNames.map((name, idx) => ({
        lagnname: name,
        hires: results[idx].hiresMTDLocal,
        codes: results[idx].codesMTDLocal,
        vips: vipsByMGA[name] || 0, // Use Potential VIPs count
        isFirstYearRollup: rollupInfo[name]?.isFirstYear || false,
        uplineMGA: rollupInfo[name]?.uplineMGA || null, // The direct MGA they roll up to
        isSelf: name === user.lagnname
      }));
      
      const totals = {
        hires: results.reduce((sum, r) => sum + r.hiresMTDLocal, 0),
        codes: results.reduce((sum, r) => sum + r.codesMTDLocal, 0),
        vips: Object.values(vipsByMGA).reduce((sum, v) => sum + v, 0)
      };

      // Fetch ALP data from Weekly_ALP
      let alpMTD = 0;
      try {
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();
        
        // Determine CL_Name filter based on viewScope
        let clNameFilter = '';
        if (String(viewingUser?.clname).toUpperCase() === 'RGA') {
          clNameFilter = viewScope === 'mga' ? 'MGA' : 'NOT_MGA'; // NOT_MGA means CL_Name != 'MGA'
        } else if (String(viewingUser?.clname).toUpperCase() === 'MGA') {
          clNameFilter = 'MGA';
        } else if (String(viewingUser?.clname).toUpperCase() === 'GA') {
          clNameFilter = 'GA'; // GA uses LVL_3_NET
        } else if (String(viewingUser?.clname).toUpperCase() === 'SA') {
          clNameFilter = 'SA'; // SA uses LVL_2_NET
        }
        
        const alpRes = await api.get('/alp/weekly/user-alp-mtd', {
          params: {
            lagnname: viewingUser.lagnname,
            month: currentMonth,
            year: currentYear,
            clNameFilter: clNameFilter
          }
        });
        
        if (alpRes?.data?.success && alpRes.data.data) {
          alpMTD = alpRes.data.data.LVL_3_NET || 0;
          // Store the "as of" date for display
          if (alpRes.data.data.reportdate) {
            setAlpAsOfDate(alpRes.data.data.reportdate);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch ALP data:', e);
      }

      setOrgMetrics({ hiresMTD: totals.hires, codesMTD: totals.codes, vipsMTD: totals.vips, alpMTD });
      setBreakdownData(breakdown);
    } catch (e) {
      console.error('Error fetching org metrics:', e);
      setOrgMetrics({ hiresMTD: 0, codesMTD: 0, vipsMTD: 0, alpMTD: 0 });
      setBreakdownData([]);
    } finally {
      setOrgMetricsLoading(false);
    }
  };

  // Fetch ALP goal (commit) from production goals
  const fetchAlpGoal = async () => {
    try {
      if (!['MGA', 'RGA'].includes(user?.clname)) return;
      
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      // Determine which goal type to fetch based on viewScope
      let goalType = 'mga';
      if (user.clname === 'RGA') {
        goalType = viewScope === 'mga' ? 'mga' : 'rga';
      }
      
      const response = await api.get(`/goals/${user.userId}/${currentYear}/${currentMonth}`, {
        params: { goalType }
      });
      
      if (response?.data?.monthlyAlpGoal) {
        setCommits(prev => ({
          ...prev,
          alp: parseFloat(response.data.monthlyAlpGoal)
        }));
      } else {
        setCommits(prev => ({
          ...prev,
          alp: null
        }));
      }
    } catch (error) {
      console.error('[OneOnOne] Error fetching ALP goal:', error);
      setCommits(prev => ({
        ...prev,
        alp: null
      }));
    }
  };

  // Fetch commits for current month
  const fetchCommits = async () => {
    try {
      if (!['MGA', 'RGA', 'GA', 'SA'].includes(user?.clname)) return;
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const res = await api.get('/commits', {
        params: { time_period: 'month', start, end }
      });

      if (res?.data?.success) {
        const list = res.data.data || [];
        
        // For RGA users, filter by the appropriate clname based on view scope
        let filteredList = list;
        if (user?.clname === 'RGA') {
          const targetClname = viewScope === 'mga' ? 'MGA' : 'RGA';
          filteredList = list.filter(c => c.clname === targetClname);
        }
        
        // Sort by created_at descending to get the most recent commits first
        filteredList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Get the most recent commit for each type (since we now keep history)
        const hiresCommit = filteredList.find(c => c.type === 'hires');
        const codesCommit = filteredList.find(c => c.type === 'codes');
        const vipsCommit = filteredList.find(c => c.type === 'vips');
        
        // Get full history for each type
        const hiresHistory = filteredList.filter(c => c.type === 'hires');
        const codesHistory = filteredList.filter(c => c.type === 'codes');
        const vipsHistory = filteredList.filter(c => c.type === 'vips');
        
        // Fetch ALP goal from production goals table
        let alpGoal = null;
        try {
          // Determine which goal type to fetch based on viewScope
          let goalType = 'mga'; // Default for MGA, GA, and SA
          if (viewingUser.clname === 'RGA') {
            goalType = viewScope === 'mga' ? 'mga' : 'rga';
          }
          // GA and SA users use 'mga' goalType (same as MGA)
          
          const alpGoalRes = await api.get(`/goals/${viewingUser.userId}/${year}/${month}?goalType=${goalType}`);
          if (alpGoalRes?.data?.monthlyAlpGoal) {
            alpGoal = parseFloat(alpGoalRes.data.monthlyAlpGoal);
          }
          
          console.log('[OneOnOne] Fetched ALP goal:', { goalType, alpGoal, viewingUserId: viewingUser.userId });
        } catch (alpError) {
          console.log('[OneOnOne] No ALP goal found or error fetching:', alpError.response?.status === 404 ? 'Not set' : alpError.message);
        }
        
        console.log('[OneOnOne] Fetched commits:', {
          viewScope,
          userClname: user?.clname,
          totalCommits: list.length,
          filteredCommits: filteredList.length,
          mostRecentCommits: { 
            hires: hiresCommit ? { amount: hiresCommit.amount, created_at: hiresCommit.created_at } : null,
            codes: codesCommit ? { amount: codesCommit.amount, created_at: codesCommit.created_at } : null,
            vips: vipsCommit ? { amount: vipsCommit.amount, created_at: vipsCommit.created_at } : null,
            alp: alpGoal
          },
          historyCount: {
            hires: hiresHistory.length,
            codes: codesHistory.length,
            vips: vipsHistory.length
          }
        });
        
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
          alp: [] // ALP doesn't use commit history, it uses production goals
        });
      }
    } catch (e) {
      console.error('Error fetching commits:', e);
    }
  };

  // Save ALP goal to production goals
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
      let goalType = 'mga'; // Default for MGA, GA, and SA
      if (user.clname === 'RGA') {
        goalType = viewScope === 'mga' ? 'mga' : 'rga';
      }
      // GA and SA users use 'mga' goalType (same as MGA)
      
      // For team goals, use full month days instead of working days
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
      
      console.log('[OneOnOne] Saving ALP goal:', { val, goalType, viewScope });
      
      await api.post('/goals', goalPayload);
      
      // Update local state
      setCommits(prev => ({
        ...prev,
        alp: val
      }));
      
      setEditingCommit(null);
      setCommitInput('');
      
      console.log('[OneOnOne] ALP goal saved successfully');
      
      // Reload commits to ensure we have the latest data
      await fetchCommits();
    } catch (error) {
      console.error('[OneOnOne] Error saving ALP goal:', error);
      alert('Failed to save ALP goal. Please try again.');
    }
  };

  // Save commit
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
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // For RGA users, set clname based on which tab they're viewing
      // MGA tab = 'MGA', RGA tab = 'RGA'
      // For MGA users, always use 'MGA'
      // For other users, use their actual clname
      let commitClname = user?.clname;
      if (user?.clname === 'RGA') {
        commitClname = viewScope === 'mga' ? 'MGA' : 'RGA';
      } else if (user?.clname === 'MGA') {
        commitClname = 'MGA';
      }

      // Debug logging for impersonation
      console.log('[OneOnOne] Saving commit:', {
        type,
        amount: val,
        viewScope,
        user: {
          id: user?.id,
          userId: user?.userId,
          lagnname: user?.lagnname,
          clname: user?.clname,
          commitClname
        },
        impersonationState: window.__IMPERSONATION_STATE__
      });

      await api.post('/commits', {
        time_period: 'month',
        type,
        start,
        end,
        amount: val,
        clname: commitClname  // Override clname based on view scope
      });

      setCommits(prev => ({ ...prev, [type]: val }));
      setEditingCommit(null);
      setCommitInput('');
    } catch (e) {
      console.error('Error saving commit:', e);
      alert('Failed to save commit');
    }
  };

  // Generate a simple, data-driven Activity insight
  const generateActivityInsight = () => {
    try {
      const a = activityData;
      if (!a) return 'Loading activity insight…';

      const refs = Number(a?.refs ?? 0);
      const sits = Number(a?.sits ?? 0);
      const apps = Number(a?.apps ?? 0);
      const alp = Number(a?.alp ?? 0);

      const refsPerSit = sits > 0 ? (refs / sits) : 0;
      const appsPerSit = sits > 0 ? (apps / sits) : 0;
      const alpPerApp = apps > 0 ? (alp / apps) : 0;

      // Priority: celebrate strengths, then guide improvements
      if (appsPerSit >= 0.75 && alpPerApp >= 1200) {
        return `High close rate and strong quality: ${appsPerSit.toFixed(2)} apps/sit and ${formatCurrency(alpPerApp)} per app. Keep momentum by maintaining sit quality.`;
      }

      if (refsPerSit >= 0.5 && sits >= 8) {
        return `Solid pipeline generation: ${refsPerSit.toFixed(2)} refs/sit with ${sits} sits. Focus on conversion to increase apps/sit above 0.6.`;
      }

      if (sits < 6) {
        return `Low sit volume (${sits}). Prioritize booking to reach 8–10 sits/week for consistent flow.`;
      }

      if (appsPerSit < 0.5) {
        return `Conversion opportunity: ${appsPerSit.toFixed(2)} apps/sit. Review needs analysis and objection handling to increase close rate.`;
      }

      if (alpPerApp < 1000) {
        return `Production per app at ${formatCurrency(alpPerApp)}. Explore upsell opportunities and coverage depth to raise ALP per app.`;
      }

      return 'Steady activity. Keep refining your booking and conversion to elevate results.';
    } catch {
      return 'Insight unavailable.';
    }
  };

  useEffect(() => {
    fetchOrgMetrics();
    fetchCommits();
  }, [user?.clname, user?.lagnname, selectedPeriod, viewScope, viewingUser?.userId]);

  // Fetch statistics data for selected stats timeframe
  const fetchStatsData = async () => {
    try {
      setStatsLoading(true);
      setError('');
      if (!viewingUser?.userId) return;

      const { startDate, endDate } = getStatsDateRange();
      let statsEndpoint;
      const isTeamScope = (['SA','GA','MGA'].includes(viewingUser?.clname) && viewScope === 'team');
      if (isTeamScope) {
        const ln = encodeURIComponent(viewingUser?.lagnname || viewingUser?.LagnName || '');
        const uid = encodeURIComponent(String(viewingUser?.userId || ''));
        statsEndpoint = `/dailyActivity/team-summary?startDate=${startDate}&endDate=${endDate}&lagnname=${ln}&userId=${uid}`;
      } else {
        const uid = encodeURIComponent(String(viewingUser?.userId || ''));
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
    }
    finally {
      setStatsLoading(false);
    }
  };

  // Fetch official data from Weekly_ALP table for comparison
  const fetchOfficialData = async () => {
    try {
      if (!viewingUser?.lagnname) {
        console.error('User lagnname not available for official data');
        return;
      }

      // For official view, get past 8 weeks of data
      const today = new Date();
      const eightWeeksAgo = new Date(today);
      eightWeeksAgo.setDate(today.getDate() - (8 * 7));

      const startDate = eightWeeksAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      // Fetch official ALP data from Weekly_ALP table
      const lagnEnc = encodeURIComponent(viewingUser.lagnname);
      const teamParam = (viewScope === 'team') ? '&viewMode=team' : '';
      const officialUrl = `/alp/weekly/user-alp?lagnName=${lagnEnc}&startDate=${startDate}&endDate=${endDate}${teamParam}`;
      const officialResponse = await api.get(officialUrl, {
        headers: (viewScope === 'team') ? { 'user-role': viewingUser?.clname || '' } : undefined
      });
      
      if (officialResponse.data.success) {
        const officialWeeklyData = officialResponse.data.data;
        setOfficialData(officialWeeklyData);

        // Create comparison data by matching reported vs official for each week
        const comparison = [];
        
        for (const officialWeek of officialWeeklyData) {
          // Get the Monday of the week this official data represents
          const weekKey = officialWeek.weekKey; // This is the Monday date (YYYY-MM-DD)
          let mondayDate;
          if (typeof weekKey === 'string' && weekKey.includes('-')) {
            const [y, m, d] = weekKey.split('-').map((t) => parseInt(t, 10));
            mondayDate = new Date(y, (m || 1) - 1, d || 1);
          } else {
            mondayDate = new Date(weekKey);
          }
          const sundayDate = new Date(mondayDate);
          sundayDate.setDate(mondayDate.getDate() + 6);

          // Fetch reported data for this specific week range (team vs personal)
          try {
            const weekStartStr = weekKey;
            const weekEndStr = sundayDate.toISOString().split('T')[0];
            const isTeamScope = (['SA','GA','MGA'].includes(viewingUser?.clname) && viewScope === 'team');
            let reportedEndpoint;
            if (isTeamScope) {
              const ln = encodeURIComponent(viewingUser?.lagnname || viewingUser?.LagnName || '');
              const uid = encodeURIComponent(String(viewingUser?.userId || ''));
              reportedEndpoint = `/dailyActivity/team-summary?startDate=${weekStartStr}&endDate=${weekEndStr}&lagnname=${ln}&userId=${uid}`;
            } else {
              const uid = encodeURIComponent(String(viewingUser?.userId || ''));
              reportedEndpoint = `/dailyActivity/user-summary?startDate=${weekStartStr}&endDate=${weekEndStr}&userId=${uid}`;
            }
            const reportedResponse = await api.get(reportedEndpoint);
            
            let reportedAlp = 0;
            if (reportedResponse.data.success) {
              reportedAlp = reportedResponse.data.data.reduce((acc, day) => acc + (parseFloat(day.alp) || 0), 0);
            }

            comparison.push({
              weekKey: weekKey,
              weekRange: `${mondayDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })} - ${sundayDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}`,
              reportedAlp: reportedAlp,
              officialAlp: parseFloat(officialWeek.actualAlp) || 0,
              originalReportDate: officialWeek.reportDate
            });
          } catch (error) {
            console.error(`Error fetching reported data for week ${weekKey}:`, error);
            // Add the week with only official data
            comparison.push({
              weekKey: weekKey,
              weekRange: `${mondayDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })} - ${sundayDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}`,
              reportedAlp: 0,
              officialAlp: parseFloat(officialWeek.actualAlp) || 0,
              originalReportDate: officialWeek.reportDate
            });
          }
        }

        // Sort by week key (most recent first)
        comparison.sort((a, b) => new Date(b.weekKey) - new Date(a.weekKey));
        setComparisonData(comparison.slice(0, 8)); // Limit to 8 weeks

      } else {
        console.error('Failed to fetch official data:', officialResponse.data);
      }

    } catch (error) {
      console.error('Error fetching official data:', error);
    }
  };

  // Fetch official month data for comparison (MTD for current month, Monthly_ALP for previous months)
  const fetchOfficialMonthData = async () => {
    try {
      if (!viewingUser?.lagnname) return;

      const lagn = encodeURIComponent(viewingUser.lagnname);

      // Current month official MTD
      let mtd = null;
      if (viewScope === 'team') {
        // Use monthly-alp-sum which supports team role-based LVL_2/3
        const mtdRes = await api.get(`/alp/monthly-alp-sum?lagnName=${lagn}&viewMode=team`, {
          headers: { 'user-role': viewingUser?.clname || '' }
        });
        const monthlyAlp = mtdRes?.data?.monthlyAlp;
        if (monthlyAlp !== undefined && monthlyAlp !== null) {
          mtd = { mtdAlp: monthlyAlp };
        }
      } else {
        const mtdRes = await api.get(`/alp/weekly/user-mtd?lagnName=${lagn}`);
        mtd = mtdRes?.data?.data || null;
      }

      // Past 6 months official from Monthly_ALP
      const moRes = await api.get(`/alp/monthly/user-6mo?lagnName=${lagn}`);
      const last6 = Array.isArray(moRes?.data?.data) ? moRes.data.data : [];

      // Build comparison: current month (MTD) first, then previous months
      const comparison = [];

      if (mtd) {
        // Compute current calendar month date range for reported side
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = now;
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        try {
          const isTeamScope = (['SA','GA','MGA'].includes(viewingUser?.clname) && viewScope === 'team');
          let repEndpoint;
          if (isTeamScope) {
            const ln = encodeURIComponent(viewingUser?.lagnname || viewingUser?.LagnName || '');
            const uid = encodeURIComponent(String(viewingUser?.userId || ''));
            repEndpoint = `/dailyActivity/team-summary?startDate=${startStr}&endDate=${endStr}&lagnname=${ln}&userId=${uid}`;
          } else {
            const uid = encodeURIComponent(String(viewingUser?.userId || ''));
            repEndpoint = `/dailyActivity/user-summary?startDate=${startStr}&endDate=${endStr}&userId=${uid}`;
          }
          const repRes = await api.get(repEndpoint);
          const reportedAlp = repRes?.data?.success
            ? repRes.data.data.reduce((acc, d) => acc + (parseFloat(d.alp) || 0), 0)
            : 0;
          comparison.push({
            month: `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
            reportedAlp,
            officialAlp: parseFloat(mtd.mtdAlp) || 0,
            source: 'MTD Recap'
          });
        } catch {}
      }

      for (const row of last6) {
        // For each previous month, compute reported range for that month
        const [mm, yyyy] = String(row.month).split('/').map((t) => parseInt(t, 10));
        const start = new Date(yyyy, mm - 1, 1);
        const end = new Date(yyyy, mm, 0);
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        try {
          const isTeamScope = (['SA','GA','MGA'].includes(viewingUser?.clname) && viewScope === 'team');
          let repEndpoint;
          if (isTeamScope) {
            const ln = encodeURIComponent(viewingUser?.lagnname || viewingUser?.LagnName || '');
            const uid = encodeURIComponent(String(viewingUser?.userId || ''));
            repEndpoint = `/dailyActivity/team-summary?startDate=${startStr}&endDate=${endStr}&lagnname=${ln}&userId=${uid}`;
          } else {
            const uid = encodeURIComponent(String(viewingUser?.userId || ''));
            repEndpoint = `/dailyActivity/user-summary?startDate=${startStr}&endDate=${endStr}&userId=${uid}`;
          }
          const repRes = await api.get(repEndpoint);
          const reportedAlp = repRes?.data?.success
            ? repRes.data.data.reduce((acc, d) => acc + (parseFloat(d.alp) || 0), 0)
            : 0;
          comparison.push({
            month: row.month,
            reportedAlp,
            officialAlp: parseFloat(row.netAlp) || 0,
            source: 'Monthly_ALP'
          });
        } catch {}
      }

      // Deduplicate by month (prefer the first occurrence - MTD if present)
      const seen = new Set();
      const unique = [];
      for (const item of comparison) {
        const key = item.month;
        if (key) {
          if (seen.has(key)) continue;
          seen.add(key);
        }
        unique.push(item);
      }

      // Sort by month descending
      unique.sort((a, b) => {
        const [am, ay] = a.month.split('/').map(Number);
        const [bm, by] = b.month.split('/').map(Number);
        return new Date(by, bm - 1, 1) - new Date(ay, am - 1, 1);
      });

      // Limit to 6 items (current + last 5) for display
      setComparisonData(unique.slice(0, 6));

    } catch (e) {
      console.error('Error fetching official month data:', e);
    }
  };

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

  if (loading) {
    return (
      <div className="oneonone-loading">
        <LoadingSpinner />
        <p>Loading 1on1 Dashboard...</p>
      </div>
    );
  }

    return (
      <div >
        {/* User Selection Dropdown for Managers */}
        {['SA','GA','MGA','RGA'].includes(user?.clname) && hierarchyUsers.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 12px 0', padding: '12px', background: 'var(--card-background, #fff)', borderRadius: '8px', border: '1px solid var(--border-color, #e0e0e0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '600px', width: '100%' }}>
              <label style={{ fontWeight: '600', color: 'var(--text-secondary, #666)', minWidth: 'fit-content' }}>
                Viewing:
              </label>
              <select
                value={selectedUser?.userId || user?.userId}
                onChange={(e) => handleUserSelection(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #e0e0e0)',
                  background: 'var(--input-background, #fff)',
                  color: 'var(--text-primary, #333)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
                disabled={hierarchyLoading}
              >
                {hierarchyUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.lagnname} {u.isSelf ? '(You)' : ''} - {u.clname}
                  </option>
                ))}
              </select>
              {selectedUser?.userId !== user?.userId && (
                <button
                  onClick={() => handleUserSelection(null)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #e0e0e0)',
                    background: 'var(--secondary-background, #f5f7fa)',
                    color: 'var(--text-primary, #333)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  title="Reset to your view"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* Global Personal/Team toggle (SA/GA/MGA only) */}
        {['SA','GA','MGA','RGA'].includes(user?.clname) && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 12px 0' }}>
            <div style={{ display: 'inline-flex', gap: '8px', background: 'var(--secondary-background, #f5f7fa)', border: '1px solid var(--border-color, #e0e0e0)', padding: '6px', borderRadius: '8px' }}>
              <button
                onClick={() => setViewScope('personal')}
                className={viewScope === 'personal' ? 'btn btn-primary' : 'btn'}
                style={{ padding: '6px 10px', borderRadius: '6px' }}
              >
                Personal
              </button>
              {['SA','GA','MGA'].includes(viewingUser?.clname) && (
                <button
                  onClick={() => setViewScope('team')}
                  className={viewScope === 'team' ? 'btn btn-primary' : 'btn'}
                  style={{ padding: '6px 10px', borderRadius: '6px' }}
                >
                  Team
                </button>
              )}
              {user?.clname === 'RGA' && (
                <>
                  <button
                    onClick={() => setViewScope('mga')}
                    className={viewScope === 'mga' ? 'btn btn-primary' : 'btn'}
                    style={{ padding: '6px 10px', borderRadius: '6px' }}
                  >
                    MGA
                  </button>
                  <button
                    onClick={() => setViewScope('rga')}
                    className={viewScope === 'rga' ? 'btn btn-primary' : 'btn'}
                    style={{ padding: '6px 10px', borderRadius: '6px' }}
                  >
                    RGA
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="oneonone-grid">
        {/* Activity Section - Top Left */}
        <ActivityWidget
          activityData={activityData}
          activityLoading={activityLoading}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
          viewMode={viewMode}
          setViewMode={setViewMode}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          getPeriodOptions={getPeriodOptions}
          getPeriodKeyForDate={getPeriodKeyForDate}
          comparisonData={comparisonData}
          officialYtdAlp={officialYtdAlp}
          error={error}
          formatCurrency={formatCurrency}
          formatNumber={formatNumber}
        />

        {/* Org Metrics (Hires/Codes/VIPs/ALP) - Show for MGA/RGA/GA/SA, spans three cards width */}
        <CommitsWidget
          viewingUserClname={viewingUser?.clname}
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
          formatCurrency={formatCurrency}
          formatNumber={formatNumber}
          userClname={user?.clname}
          timePeriod={null}
          orgMetricsHistory={null}
        />

        {/* Highlights Section - Styled like TrophyCase cards */}
        <HighlightsWidget
          recordMonth={recordMonth}
          recordWeek={recordWeek}
          recordMonthLoading={recordMonthLoading}
          recordWeekLoading={recordWeekLoading}
          formatCurrency={formatCurrency}
        />

        {/* Statistics Section - Top Right */}
        <StatisticsWidget
          statsTimeframe={statsTimeframe}
          setStatsTimeframe={setStatsTimeframe}
          statsLoading={statsLoading}
          statisticsData={statisticsData}
          formatCurrency={formatCurrency}
        />

        {/* Retention Section - Middle Row (full width under top sections) */}
        <RetentionWidget
          retentionLoading={retentionLoading}
          retentionData={retentionData}
          userClname={user?.clname}
        />

        {/* AGT Promotion Status OR Hierarchy Section - Bottom Left */}
        <HierarchyWidget
          viewingUserClname={viewingUser?.clname}
          userClname={user?.clname}
          promotionStatus={promotionStatus}
          saPromotion={saPromotion}
          gaPromotion={gaPromotion}
          hierarchySummary={hierarchySummary}
          expandedRoles={expandedRoles}
          toggleRoleExpanded={toggleRoleExpanded}
          getRoleAgents={getRoleAgents}
          getUserDisplayName={getUserDisplayName}
          formatCurrency={formatCurrency}
          formatFourMoRate={formatFourMoRate}
        />

        {/* Convention Qualification Section - Bottom Right */}
        <ConventionWidget
          conventionQualification={conventionQualification}
          formatCurrency={formatCurrency}
        />
      </div>

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
              background: 'white',
              borderRadius: '8px',
              padding: '1.5rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, textTransform: 'capitalize' }}>
                {historyModalType} Commitment History
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '1rem', color: '#666', fontSize: '0.875rem' }}>
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
                      border: isLatest ? '2px solid var(--primary-color, #007bff)' : '1px solid #ddd',
                      borderRadius: '6px',
                      background: isLatest ? '#f0f8ff' : 'white',
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
                      <div style={{ fontSize: '0.875rem', color: '#666' }}>
                        {(() => {
                          const timestamp = entry.created_at;
                          
                          // Database stores in Pacific Time, add 3 hours to get Eastern Time
                          let date;
                          if (typeof timestamp === 'string') {
                            // Format: "2025-10-07 05:33:15" (Pacific Time)
                            const parts = timestamp.split(/[- :]/);
                            date = new Date(
                              parseInt(parts[0]), 
                              parseInt(parts[1]) - 1, 
                              parseInt(parts[2]), 
                              parseInt(parts[3]) + 3,  // Add 3 hours for EST
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
                    
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>
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
              background: 'white',
              borderRadius: '8px',
              padding: '1.5rem',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                Org Metrics Breakdown
              </h3>
              <button
                onClick={() => setShowBreakdownModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '1rem', color: '#666', fontSize: '0.875rem' }}>
              {breakdownData.length} {breakdownData.length === 1 ? 'MGA' : 'MGAs'} • Month-to-Date
            </div>

            {breakdownData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                No data available
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd', background: '#f8f9fa' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>MGA</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Hires</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Codes</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>VIPs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Group by upline for hierarchical display
                      const grouped = {};
                      const selfRows = [];
                      const directMGAs = [];
                      
                      breakdownData.forEach(row => {
                        if (row.isSelf) {
                          selfRows.push(row);
                        } else if (row.isFirstYearRollup && row.uplineMGA) {
                          // Group first-year rollups under their upline MGA
                          if (!grouped[row.uplineMGA]) {
                            grouped[row.uplineMGA] = [];
                          }
                          grouped[row.uplineMGA].push(row);
                        } else {
                          directMGAs.push(row);
                        }
                      });
                      
                      // Sort direct MGAs by total
                      directMGAs.sort((a, b) => {
                        const totalA = a.hires + a.codes + a.vips;
                        const totalB = b.hires + b.codes + b.vips;
                        return totalB - totalA;
                      });
                      
                      // Build display order: self, then direct MGAs with their rollups
                      const displayRows = [];
                      let rowIndex = 0;
                      
                      // Add self first
                      selfRows.forEach(row => {
                        displayRows.push(
                          <tr 
                            key={`self-${rowIndex}`}
                            style={{ 
                              borderBottom: '1px solid #eee',
                              background: rowIndex % 2 === 0 ? 'white' : '#f8f9fa',
                              fontWeight: '600'
                            }}
                          >
                            <td style={{ padding: '0.75rem' }}>{row.lagnname} (You)</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(row.hires)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(row.codes)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(row.vips)}</td>
                          </tr>
                        );
                        rowIndex++;
                      });
                      
                      // Add direct MGAs and their rollups
                      directMGAs.forEach(mga => {
                        displayRows.push(
                          <tr 
                            key={`mga-${rowIndex}`}
                            style={{ 
                              borderBottom: '1px solid #eee',
                              background: rowIndex % 2 === 0 ? 'white' : '#f8f9fa'
                            }}
                          >
                            <td style={{ padding: '0.75rem', fontWeight: '500' }}>{mga.lagnname}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(mga.hires)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(mga.codes)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatNumber(mga.vips)}</td>
                          </tr>
                        );
                        rowIndex++;
                        
                        // Add rollups under this MGA
                        const rollups = grouped[mga.lagnname] || [];
                        rollups.forEach(rollup => {
                          displayRows.push(
                            <tr 
                              key={`rollup-${rowIndex}`}
                              style={{ 
                                borderBottom: '1px solid #eee',
                                background: rowIndex % 2 === 0 ? 'white' : '#f8f9fa'
                              }}
                            >
                              <td style={{ padding: '0.75rem', paddingLeft: '2rem', fontStyle: 'italic', color: '#666' }}>
                                ↳ {rollup.lagnname}*
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#666' }}>{formatNumber(rollup.hires)}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#666' }}>{formatNumber(rollup.codes)}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#666' }}>{formatNumber(rollup.vips)}</td>
                            </tr>
                          );
                          rowIndex++;
                        });
                      });
                      
                      return displayRows;
                    })()}
                    <tr style={{ borderTop: '2px solid #ddd', fontWeight: 'bold', background: '#f0f8ff' }}>
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
                    </tr>
                  </tbody>
                </table>
                
                {/* Show legend if there are any rollups */}
                {breakdownData.some(row => row.isFirstYearRollup) && (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    background: '#f8f9fa', 
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    color: '#666'
                  }}>
                    <strong>*</strong> First-year MGA rolling up to their upline
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

export default OneOnOne;

