/**
 * useActivityData Hook
 * 
 * Shared data fetching and computation for all activity dashboard widgets.
 * Fetches hierarchy + daily activity once, then computes:
 *   - Agent reporting counts (for date range)
 *   - Activity totals (for date range)
 *   - Agent metrics: total days, streaks, last reported (all-time)
 */

import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import { NameFormats } from '../../../utils/nameFormatter';
import api from '../../../api';

/**
 * Compute the previous equivalent period for a given date range.
 * Same duration, shifted back (e.g. Feb 1-28 → Jan 1-31).
 */
const getPreviousPeriod = (startStr, endStr) => {
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  const durationMs = end - start;
  const prevEnd = new Date(start.getTime() - 86400000); // day before current start
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return {
    start: prevStart.toISOString().split('T')[0],
    end: prevEnd.toISOString().split('T')[0],
  };
};

/**
 * Compute funnel conversion rates from a totals object.
 */
const computeFunnelRates = (totals) => ({
  callToAppt: totals.calls > 0 ? totals.appts / totals.calls : 0,
  apptToSit:  totals.appts > 0 ? totals.sits / totals.appts : 0,
  sitToSale:  totals.sits > 0  ? totals.sales / totals.sits : 0,
  alpPerSale: totals.sales > 0 ? totals.alp / totals.sales : 0,
  sitToRef:   totals.sits > 0  ? totals.refs / totals.sits : 0,
});

/**
 * Convert YYYY-MM-DD to MM/DD/YYYY for Weekly_ALP endpoints.
 */
const formatToAlpDate = (isoDate) => {
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
};

/**
 * Determine whether a date range refers to a previous month (≥2 months old).
 * If so, we should use Monthly_ALP; otherwise Weekly_ALP.
 * Returns { isPrevMonth, monthKey } where monthKey = "MM/YYYY".
 */
const detectPreviousMonth = (startStr) => {
  const rangeStart = new Date(startStr + 'T00:00:00');
  const now = new Date();
  const currentMonth = now.getMonth();       // 0-indexed
  const currentYear = now.getFullYear();
  const rangeMonth = rangeStart.getMonth();
  const rangeYear = rangeStart.getFullYear();
  const monthsAgo = (currentYear - rangeYear) * 12 + (currentMonth - rangeMonth);
  const isPrevMonth = monthsAgo >= 1;
  const monthKey = `${String(rangeMonth + 1).padStart(2, '0')}/${rangeYear}`;
  return { isPrevMonth, monthKey };
};

/**
 * Aggregate official ALP per LagnName from raw Weekly_ALP rows.
 * Follows TeamDashboard logic: 3-day window around max reportdate,
 * dedup by (reportdate + CTLNO), prefer CL_Name='MGA' over duplicates.
 */
const buildOfficialAlpMap = (rawRows, isMonthly = false) => {
  const map = new Map();
  if (!rawRows || rawRows.length === 0) return map;

  if (isMonthly) {
    // Monthly_ALP: backend already deduplicates by LagnName (prefers CTLNO='MGA').
    // Each row is one agent — just read LVL_1_NET directly.
    rawRows.forEach(row => {
      if (!row.LagnName) return;
      const existing = map.get(row.LagnName) || 0;
      map.set(row.LagnName, existing + (parseFloat(row.LVL_1_NET) || 0));
    });
    return map;
  }

  // Weekly_ALP aggregation
  // Group by LagnName
  const byUser = {};
  rawRows.forEach(row => {
    if (!row.LagnName) return;
    if (!byUser[row.LagnName]) byUser[row.LagnName] = [];
    byUser[row.LagnName].push(row);
  });

  Object.entries(byUser).forEach(([lagnname, rows]) => {
    // Find max reportdate
    let maxDate = null;
    rows.forEach(r => {
      const d = r.reportdate ? new Date(r.reportdate) : null;
      if (d && !isNaN(d.getTime()) && (!maxDate || d > maxDate)) maxDate = d;
    });
    if (!maxDate) return;

    // Keep rows within 3 days of max, dedup by (reportdate + CTLNO)
    const deduped = new Map();
    rows.forEach(r => {
      const d = r.reportdate ? new Date(r.reportdate) : null;
      if (!d || isNaN(d.getTime())) return;
      if (Math.abs(maxDate - d) / 86400000 > 3) return;
      const key = `${r.reportdate}|${r.CTLNO || ''}`;
      const existing = deduped.get(key);
      if (!existing || (r.CL_Name === 'MGA' && existing.CL_Name !== 'MGA')) {
        deduped.set(key, r);
      }
    });

    let total = 0;
    deduped.forEach(r => { total += parseFloat(r.LVL_1_NET) || 0; });
    map.set(lagnname, total);
  });

  return map;
};

const useActivityData = ({ dateRange, viewScope, viewMode = 'month', userRole: propUserRole, user: propUser }) => {
  const { user: contextUser } = useContext(AuthContext);
  const user = propUser || contextUser;
  const userRole = (propUserRole || user?.clname)?.toUpperCase();

  // Global admin: SGA, teamRole=app, or Role=Admin — can see ALL data
  const isGlobalAdmin = userRole === 'SGA' || user?.teamRole === 'app' || user?.Role === 'Admin';

  const isTeamLevel = isGlobalAdmin || ['SA', 'GA', 'MGA', 'RGA'].includes(userRole);
  const showPersonalView = viewScope === 'personal' || !isTeamLevel;

  const [loading, setLoading] = useState(true);
  const [teamUserIds, setTeamUserIds] = useState([]);
  const [stats, setStats] = useState({
    totalAgents: 0,
    reportedAgents: 0,
    reportedAgentsToday: 0,
    reportedAgentsYesterday: 0,
    lastReportTime: null,
    agentMetrics: [],
    totals: { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0, refs: 0, officialAlp: 0 },
    dailyBreakdown: [], // [{ date, calls, appts, sits, sales, alp, refs }] sorted by date
    prevPeriodRates: { callToAppt: 0, apptToSit: 0, sitToSale: 0, alpPerSale: 0, sitToRef: 0 },
    leadTypeBreakdown: [], // [{ type, count, alp, refs }] from discord_sales
  });

  const fetchTeamStats = useCallback(async () => {
    try {
      setLoading(true);

      // Determine ALP fetch strategy based on viewMode:
      //   week  → Weekly_ALP with 'Weekly Recap'
      //   month (current) → Weekly_ALP with 'MTD Recap'
      //   month (previous) → Monthly_ALP table
      //   year  → Weekly_ALP with 'YTD Recap'
      const { isPrevMonth, monthKey } = detectPreviousMonth(dateRange.start);
      const useMonthlyAlp = viewMode === 'month' && isPrevMonth;

      let alpFetch;
      if (useMonthlyAlp) {
        // Previous month: use Monthly_ALP table
        alpFetch = api.get('/alp/getmonthlyall', { params: { month: monthKey } })
          .catch(() => ({ data: { success: false, data: [] } }));
      } else {
        // Determine report type based on viewMode
        let reportType = 'MTD Recap'; // default for current month
        if (viewMode === 'week') reportType = 'Weekly Recap';
        else if (viewMode === 'year') reportType = 'YTD Recap';

        alpFetch = api.get('/alp/getweeklyall_simple', {
          params: {
            startDate: formatToAlpDate(dateRange.start),
            endDate: formatToAlpDate(dateRange.end),
            report: reportType,
          }
        }).catch(() => ({ data: { success: false, data: [] } }));
      }

      const [hierRes, actRes, discordRes, alpRes] = await Promise.all([
        api.post('/auth/searchByUserIdLite', { userId: user.userId }),
        api.get('/dailyActivity/all'),
        api.get(`/discord/sales/all-users?startDate=${dateRange.start}&endDate=${dateRange.end}`)
          .catch(() => ({ data: { success: false, data: [] } })),
        alpFetch,
      ]);

      const hierarchyUsers = hierRes.data?.success ? (hierRes.data.data || []) : [];

      const allActivity = actRes.data?.data || [];

      // --- Build agent list & hierarchy user IDs ---
      let agents;
      let hierarchyUserIds;

      if (isGlobalAdmin && viewScope !== 'personal') {
        // Global admins (SGA, teamRole=app, Role=Admin): load ALL users from activity data
        const hierMap = new Map();
        hierarchyUsers.forEach(u => { if (u.id) hierMap.set(parseInt(u.id), u); });

        // Build unique user map from ALL activity records
        const userMap = new Map();
        allActivity.forEach(a => {
          const uid = a.userId ? parseInt(a.userId) : null;
          if (!uid || isNaN(uid)) return;
          if (!userMap.has(uid)) {
            const hierUser = hierMap.get(uid);
            userMap.set(uid, {
              id: uid,
              lagnname: hierUser?.lagnname || a.agent || 'Unknown',
              profpic: hierUser?.profpic || null,
              clname: hierUser?.clname || '',
              esid: hierUser?.esid || a.esid || null,
              mga: hierUser?.mga || a.MGA || '',
              sa: hierUser?.sa || a.SA || '',
              ga: hierUser?.ga || a.GA || '',
            });
          }
        });

        agents = Array.from(userMap.values());
        hierarchyUserIds = new Set(agents.map(a => a.id));
      } else {
        // Standard hierarchy-based filtering
        // Expose all hierarchy user IDs (+ current user) for downstream consumers
        const allHierarchyIds = hierarchyUsers.map(u => u.id).filter(Boolean);
        if (user.userId && !allHierarchyIds.includes(parseInt(user.userId))) {
          allHierarchyIds.push(parseInt(user.userId));
        }

        // Filter agents based on viewScope
        // MGA/RGA users ARE their own MGA — include them so they show in the table
        const AGENT_ROLES = ['AGT', 'SA', 'GA', 'MGA'];
        if (userRole === 'RGA') {
          if (viewScope === 'mga') {
            // RGA's own direct MGA team — match by mga name
            agents = hierarchyUsers.filter(u => {
              const role = String(u.clname || '').toUpperCase();
              const userMGA = String(u.mga || '').toUpperCase();
              const currentUserName = String(user.lagnname || '').toUpperCase();
              return AGENT_ROLES.includes(role) && userMGA === currentUserName;
            });
          } else {
            // Full RGA view — everyone under them, including MGAs
            agents = hierarchyUsers.filter(u => {
              const role = String(u.clname || '').toUpperCase();
              return AGENT_ROLES.includes(role);
            });
          }
        } else {
          // MGA/GA/SA team view — include MGA users from the hierarchy
          agents = hierarchyUsers.filter(u => {
            const role = String(u.clname || '').toUpperCase();
            return AGENT_ROLES.includes(role);
          });
        }

        // Ensure the current logged-in user is included in the table if they're
        // an MGA or RGA (they are their own MGA and may have activity)
        if (['MGA', 'RGA'].includes(userRole)) {
          const selfId = parseInt(user.userId);
          const alreadyIncluded = agents.some(a => parseInt(a.id) === selfId);
          if (!alreadyIncluded && !isNaN(selfId)) {
            agents.push({
              id: selfId,
              lagnname: user.lagnname || 'Unknown',
              profpic: user.profpic || null,
              clname: userRole,
              mga: user.mga || user.lagnname || '',
            });
          }
        }

        hierarchyUserIds = new Set(
          agents.map(a => a.id).filter(id => id != null).map(id => parseInt(id)).filter(id => !isNaN(id))
        );
      }

      // Expose all user IDs for downstream consumers
      const allHierarchyIds = Array.from(hierarchyUserIds);
      setTeamUserIds(allHierarchyIds);

      const totalAgents = agents.length;

      // Filter activity within date range
      const startDate = new Date(dateRange.start + 'T00:00:00');
      const endDate = new Date(dateRange.end + 'T23:59:59');

      const filteredActivity = allActivity.filter(a => {
        const activityDate = new Date(a.reportDate);
        return activityDate >= startDate && activityDate <= endDate;
      });

      // Count unique reported users in date range
      const reportedUserIdsInRange = new Set();
      filteredActivity.forEach(a => {
        const activityUserId = a.userId ? parseInt(a.userId) : null;
        if (activityUserId && hierarchyUserIds.has(activityUserId)) {
          reportedUserIdsInRange.add(activityUserId);
        }
      });

      // Count unique reported users for today and yesterday
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

      const reportedToday = new Set();
      const reportedYesterday = new Set();
      allActivity.forEach(a => {
        const activityUserId = a.userId ? parseInt(a.userId) : null;
        if (!activityUserId || !hierarchyUserIds.has(activityUserId)) return;
        const dateStr = new Date(a.reportDate).toISOString().split('T')[0];
        if (dateStr === todayStr) reportedToday.add(activityUserId);
        if (dateStr === yesterdayStr) reportedYesterday.add(activityUserId);
      });

      // Build all-time activity map for metrics
      let lastReportDate = null;
      const allUserActivityMap = new Map();

      allActivity.forEach(a => {
        const activityUserId = a.userId ? parseInt(a.userId) : null;
        if (activityUserId && hierarchyUserIds.has(activityUserId)) {
          if (!allUserActivityMap.has(activityUserId)) {
            allUserActivityMap.set(activityUserId, new Set());
          }
          const dateStr = new Date(a.reportDate).toISOString().split('T')[0];
          allUserActivityMap.get(activityUserId).add(dateStr);

          const reportDate = new Date(a.reportDate);
          if (!lastReportDate || reportDate > lastReportDate) {
            lastReportDate = reportDate;
          }
        }
      });

      // Calculate agent metrics (all-time) + per-agent period totals
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Build per-agent period totals from teamActivityInRange (computed below, but
      // we need it here — so build it early from filteredActivity + hierarchyUserIds)
      const perAgentPeriod = new Map();
      filteredActivity.forEach(a => {
        const uid = a.userId ? parseInt(a.userId) : null;
        if (!uid || !hierarchyUserIds.has(uid)) return;
        if (!perAgentPeriod.has(uid)) {
          perAgentPeriod.set(uid, { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0, refs: 0 });
        }
        const t = perAgentPeriod.get(uid);
        t.calls += parseInt(a.calls) || 0;
        t.appts += parseInt(a.appts) || 0;
        t.sits  += parseInt(a.sits) || 0;
        t.sales += parseInt(a.sales) || 0;
        t.alp   += parseFloat(a.alp) || 0;
        t.refs  += parseInt(a.refs) || 0;
      });

      // Build official ALP map from Weekly_ALP or Monthly_ALP data
      const alpRawData = (alpRes.data?.success && Array.isArray(alpRes.data?.data)) ? alpRes.data.data : [];
      const officialAlpByName = buildOfficialAlpMap(alpRawData, useMonthlyAlp);

      const agentMetrics = agents.map(agent => {
        const agentId = parseInt(agent.id);
        const agentName = agent.lagnname || 'Unknown';
        const agentDisplayName = NameFormats.FIRST_LAST_SUFFIX(agentName);
        const agentProfpic = agent.profpic || null;
        const agentClname = (agent.clname || '').toUpperCase();
        const agentEsid = agent.esid || null;
        // mga is "Last, First Middle Suffix" — extract just the last name
        const agentMga = agent.mga ? String(agent.mga).split(',')[0].trim() : '';
        const activityDates = allUserActivityMap.get(agentId);

        // Period totals for this agent
        const pt = perAgentPeriod.get(agentId) || { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0, refs: 0 };

        // Official ALP from Weekly_ALP table
        const officialAlp = officialAlpByName.get(agentName) || 0;

        if (!activityDates || activityDates.size === 0) {
          return {
            id: agentId, name: agentName, displayName: agentDisplayName, profpic: agentProfpic,
            clname: agentClname, mga: agentMga, esid: agentEsid,
            totalDays: 0, currentStreak: 0, longestStreak: 0, isStreakActive: false,
            daysSinceReport: Infinity, lastReportDisplay: 'No reports',
            periodTotals: pt, officialAlp,
          };
        }

        const totalDays = activityDates.size;

        // Current streak
        let currentStreak = 0;
        let checkDate = new Date(today);
        while (currentStreak < 365) {
          const dateStr = checkDate.toISOString().split('T')[0];
          if (activityDates.has(dateStr)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }

        // Longest streak
        const sortedDates = Array.from(activityDates).sort();
        let longestStreak = 0;
        let tempStreak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i - 1] + 'T00:00:00');
          const currDate = new Date(sortedDates[i] + 'T00:00:00');
          const dayDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
          if (dayDiff === 1) {
            tempStreak++;
          } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, tempStreak);

        // Days since last report
        const lastReport = new Date(sortedDates[sortedDates.length - 1] + 'T00:00:00');
        const daysSince = Math.floor((today - lastReport) / (1000 * 60 * 60 * 24));
        let lastReportDisplay;
        if (daysSince === 0) lastReportDisplay = 'Today';
        else if (daysSince === 1) lastReportDisplay = 'Yesterday';
        else lastReportDisplay = `${daysSince} days ago`;

        return {
          id: agentId, name: agentName, displayName: agentDisplayName, profpic: agentProfpic,
          clname: agentClname, mga: agentMga, esid: agentEsid,
          totalDays, currentStreak, longestStreak, isStreakActive: currentStreak > 0,
          daysSinceReport: daysSince, lastReportDisplay,
          periodTotals: pt, officialAlp,
        };
      });

      // Calculate totals for date range — only for agents in the hierarchy scope
      const teamActivityInRange = filteredActivity.filter(a => {
        const activityUserId = a.userId ? parseInt(a.userId) : null;
        return activityUserId && hierarchyUserIds.has(activityUserId);
      });

      const totals = teamActivityInRange.reduce((acc, a) => {
        acc.calls += parseInt(a.calls) || 0;
        acc.appts += parseInt(a.appts) || 0;
        acc.sits += parseInt(a.sits) || 0;
        acc.sales += parseInt(a.sales) || 0;
        acc.alp += parseFloat(a.alp) || 0;
        acc.refs += parseInt(a.refs) || 0;
        return acc;
      }, { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0, refs: 0 });

      // Build daily breakdown for trend charts
      const dailyMap = {};
      const dailyUserSets = {}; // track unique reporting agents per day
      teamActivityInRange.forEach(a => {
        const dateStr = new Date(a.reportDate).toISOString().split('T')[0];
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = { date: dateStr, calls: 0, appts: 0, sits: 0, sales: 0, alp: 0, refs: 0, reportingAgents: 0 };
          dailyUserSets[dateStr] = new Set();
        }
        dailyMap[dateStr].calls += parseInt(a.calls) || 0;
        dailyMap[dateStr].appts += parseInt(a.appts) || 0;
        dailyMap[dateStr].sits += parseInt(a.sits) || 0;
        dailyMap[dateStr].sales += parseInt(a.sales) || 0;
        dailyMap[dateStr].alp += parseFloat(a.alp) || 0;
        dailyMap[dateStr].refs += parseInt(a.refs) || 0;
        const uid = a.userId ? parseInt(a.userId) : null;
        if (uid) dailyUserSets[dateStr].add(uid);
      });
      // Assign reportingAgents counts
      Object.keys(dailyMap).forEach(dateStr => {
        dailyMap[dateStr].reportingAgents = dailyUserSets[dateStr]?.size || 0;
      });
      const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

      // --- Previous period conversion rates (for funnel projection) ---
      const prevPeriod = getPreviousPeriod(dateRange.start, dateRange.end);
      const prevStart = new Date(prevPeriod.start + 'T00:00:00');
      const prevEnd = new Date(prevPeriod.end + 'T23:59:59');

      const prevPeriodTotals = allActivity.reduce((acc, a) => {
        const activityDate = new Date(a.reportDate);
        if (activityDate < prevStart || activityDate > prevEnd) return acc;
        const uid = a.userId ? parseInt(a.userId) : null;
        if (!uid || !hierarchyUserIds.has(uid)) return acc;
        acc.calls += parseInt(a.calls) || 0;
        acc.appts += parseInt(a.appts) || 0;
        acc.sits  += parseInt(a.sits) || 0;
        acc.sales += parseInt(a.sales) || 0;
        acc.alp   += parseFloat(a.alp) || 0;
        acc.refs  += parseInt(a.refs) || 0;
        return acc;
      }, { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0, refs: 0 });

      const prevPeriodRates = computeFunnelRates(prevPeriodTotals);

      // --- Discord sales: lead type breakdown ---
      const discordSales = (discordRes.data?.success && Array.isArray(discordRes.data.data))
        ? discordRes.data.data
        : [];
      const byLeadType = {};
      discordSales.forEach(sale => {
        const saleUserId = sale.user_id ? parseInt(sale.user_id) : null;
        if (!saleUserId || !hierarchyUserIds.has(saleUserId)) return;
        const lt = sale.lead_type || 'Unknown';
        if (!byLeadType[lt]) byLeadType[lt] = { count: 0, alp: 0, refs: 0 };
        byLeadType[lt].count += 1;
        byLeadType[lt].alp += parseFloat(sale.alp) || 0;
        byLeadType[lt].refs += parseInt(sale.refs) || 0;
      });
      const leadTypeBreakdown = Object.entries(byLeadType)
        .map(([type, data]) => ({ type, ...data }))
        .sort((a, b) => b.count - a.count);

      // Sum official ALP across all agents
      const totalOfficialAlp = agentMetrics.reduce((sum, a) => sum + (a.officialAlp || 0), 0);

      setStats({
        totalAgents,
        reportedAgents: reportedUserIdsInRange.size,
        reportedAgentsToday: reportedToday.size,
        reportedAgentsYesterday: reportedYesterday.size,
        lastReportTime: lastReportDate,
        agentMetrics,
        totals: { ...totals, officialAlp: totalOfficialAlp },
        dailyBreakdown,
        prevPeriodRates,
        leadTypeBreakdown,
      });
    } catch (error) {
      console.error('Error fetching team stats:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, viewScope, viewMode, userRole, user, isGlobalAdmin]);

  const fetchPersonalStats = useCallback(async () => {
    try {
      setLoading(true);
      setTeamUserIds(user?.userId ? [parseInt(user.userId)] : []);

      // Fetch current period + previous period + discord sales in parallel
      const prevPeriod = getPreviousPeriod(dateRange.start, dateRange.end);
      const [currentRes, prevRes, discordRes] = await Promise.all([
        api.get(`/dailyActivity/user-summary?startDate=${dateRange.start}&endDate=${dateRange.end}`),
        api.get(`/dailyActivity/user-summary?startDate=${prevPeriod.start}&endDate=${prevPeriod.end}`),
        api.get(`/discord/sales/user-sales?startDate=${dateRange.start}&endDate=${dateRange.end}&userId=${user.userId}`)
          .catch(() => ({ data: { success: false, data: [] } })),
      ]);

      const result = currentRes.data;
      const prevResult = prevRes.data;

      if (result.success && Array.isArray(result.data)) {
        const totals = result.data.reduce((acc, a) => {
          acc.calls += parseInt(a.calls) || 0;
          acc.appts += parseInt(a.appts) || 0;
          acc.sits += parseInt(a.sits) || 0;
          acc.sales += parseInt(a.sales) || 0;
          acc.alp += parseFloat(a.alp) || 0;
          acc.refs += parseInt(a.refs) || 0;
          return acc;
        }, { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0, refs: 0 });

        let lastReportDate = null;
        result.data.forEach(a => {
          if (a.reportDate) {
            const reportDate = new Date(a.reportDate);
            if (!lastReportDate || reportDate > lastReportDate) lastReportDate = reportDate;
          }
        });

        const daysWithActivity = result.data.filter(a =>
          a.calls || a.appts || a.sits || a.sales || a.alp || a.refs
        ).length;

        // Build daily breakdown for personal trend charts
        const dailyBreakdown = result.data.map(a => ({
          date: new Date(a.reportDate).toISOString().split('T')[0],
          calls: parseInt(a.calls) || 0,
          appts: parseInt(a.appts) || 0,
          sits: parseInt(a.sits) || 0,
          sales: parseInt(a.sales) || 0,
          alp: parseFloat(a.alp) || 0,
          refs: parseInt(a.refs) || 0,
        })).sort((a, b) => a.date.localeCompare(b.date));

        // Previous period conversion rates
        let prevPeriodRates = { callToAppt: 0, apptToSit: 0, sitToSale: 0, alpPerSale: 0, sitToRef: 0 };
        if (prevResult.success && Array.isArray(prevResult.data)) {
          const prevTotals = prevResult.data.reduce((acc, a) => {
            acc.calls += parseInt(a.calls) || 0;
            acc.appts += parseInt(a.appts) || 0;
            acc.sits  += parseInt(a.sits) || 0;
            acc.sales += parseInt(a.sales) || 0;
            acc.alp   += parseFloat(a.alp) || 0;
            acc.refs  += parseInt(a.refs) || 0;
            return acc;
          }, { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0, refs: 0 });
          prevPeriodRates = computeFunnelRates(prevTotals);
        }

        // --- Discord sales: lead type breakdown (personal) ---
        const discordSales = (discordRes.data?.success && Array.isArray(discordRes.data.data))
          ? discordRes.data.data
          : [];
        const byLeadType = {};
        discordSales.forEach(sale => {
          const lt = sale.lead_type || 'Unknown';
          if (!byLeadType[lt]) byLeadType[lt] = { count: 0, alp: 0, refs: 0 };
          byLeadType[lt].count += 1;
          byLeadType[lt].alp += parseFloat(sale.alp) || 0;
          byLeadType[lt].refs += parseInt(sale.refs) || 0;
        });
        const leadTypeBreakdown = Object.entries(byLeadType)
          .map(([type, data]) => ({ type, ...data }))
          .sort((a, b) => b.count - a.count);

        setStats({
          totalAgents: 1,
          reportedAgents: daysWithActivity > 0 ? 1 : 0,
          lastReportTime: lastReportDate,
          agentMetrics: [],
          totals,
          dailyBreakdown,
          prevPeriodRates,
          leadTypeBreakdown,
        });
      }
    } catch (error) {
      console.error('Error fetching personal stats:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, user?.userId]);

  useEffect(() => {
    if (dateRange?.start && dateRange?.end && user?.userId) {
      if (showPersonalView) {
        fetchPersonalStats();
      } else {
        fetchTeamStats();
      }
    }
  }, [dateRange, user?.userId, showPersonalView, viewScope, fetchTeamStats, fetchPersonalStats]);

  return {
    loading,
    stats,
    isTeamLevel,
    isGlobalAdmin,
    showPersonalView,
    userRole,
    teamUserIds,
  };
};

export default useActivityData;
