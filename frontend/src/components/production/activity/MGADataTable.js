import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../../api';
import { AuthContext } from '../../../context/AuthContext';
import DataTable from '../../utils/DataTable';
import ActivitySummaryCards from './ActivitySummaryCards';

// Builds MGA -> [agents] mapping from /auth/searchByUserId results
function groupAgentsByMGA(users) {
  const groups = new Map();
  users.forEach(u => {
    const mgaName = u.mga || u.lagnname;
    if (!groups.has(mgaName)) groups.set(mgaName, new Set());
    groups.get(mgaName).add(u.lagnname);
    // Ensure MGA itself is included in its team
    if (u.clname === 'MGA' || u.lagnname === mgaName) {
      groups.get(mgaName).add(mgaName);
    }
  });
  return new Map([...groups.entries()].map(([k, v]) => [k, Array.from(v)]));
}

// Compute Monday of week for given date string YYYY-MM-DD
function getMonday(dateInput) {
  const d = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : new Date(dateInput);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return monday;
}

function getCurrentWeekRange() {
  const today = new Date();
  const monday = getMonday(today);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (x) => `${(x.getMonth()+1).toString().padStart(2,'0')}/${x.getDate().toString().padStart(2,'0')}/${x.getFullYear()}`;
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

// Get array of dates for the days of the week (Monday through Sunday)
function getWeekDays(startDate, endDate) {
  const days = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

// Calculate days reported vs days passed for a given week and agents
function calculateDaysRep(filteredActivity, agents, weekDays) {
  const normalize = (s) => (s || '').trim().toUpperCase();
  const normalizedAgents = new Set((agents || []).map(normalize));
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day
  
  // Count days that have passed (including today if it's in the week)
  let daysPassed = 0;
  weekDays.forEach(day => {
    const dayNormalized = new Date(day);
    dayNormalized.setHours(0, 0, 0, 0);
    if (dayNormalized <= today) {
      daysPassed++;
    }
  });
  
  // Count unique days with activity for these agents in this week
  const reportedDates = new Set();
  filteredActivity.forEach(a => {
    if (normalizedAgents.has(normalize(a.agent))) {
      const activityDate = new Date(a.reportDate);
      activityDate.setHours(0, 0, 0, 0);
      
      // Check if this activity date falls within the week days
      const isInWeek = weekDays.some(day => {
        const dayNormalized = new Date(day);
        dayNormalized.setHours(0, 0, 0, 0);
        return dayNormalized.getTime() === activityDate.getTime();
      });
      
      if (isInWeek) {
        reportedDates.add(activityDate.toISOString().split('T')[0]);
      }
    }
  });
  
  return {
    daysReported: reportedDates.size,
    daysPassed: daysPassed
  };
}

function enumerateWeeks(data) {
  const set = new Set();
  data.forEach(item => {
    const d = new Date(item.reportDate);
    const monday = getMonday(d);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const key = `${(monday.getMonth()+1).toString().padStart(2,'0')}/${monday.getDate().toString().padStart(2,'0')}/${monday.getFullYear()} - ${(sunday.getMonth()+1).toString().padStart(2,'0')}/${sunday.getDate().toString().padStart(2,'0')}/${sunday.getFullYear()}`;
    set.add(key);
  });
  set.add(getCurrentWeekRange());
  return Array.from(set.values()).sort((a,b)=> new Date(b.split(' - ')[0]) - new Date(a.split(' - ')[0]));
}

export default function MGADataTable({ startDate, endDate }) {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [expandedMga, setExpandedMga] = useState({}); // { [mgaName]: true }
  const [allowedMgasGlobal, setAllowedMgasGlobal] = useState([]); // Store global allowed MGAs

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError('');

        if (!user?.userId) {
          throw new Error('No user');
        }

        // Fetch hierarchy users for current (or impersonated) user
        const [hierRes, actRes] = await Promise.all([
          api.post('/auth/searchByUserIdLite', { userId: user.userId }),
          api.get('/dailyActivity/all'),
        ]);

        if (!hierRes.data?.success) {
          throw new Error('Hierarchy load failed');
        }

        const activityData = (actRes.data?.data || []).map(a => ({
          ...a,
          // normalize date type for in-memory filtering
          reportDate: new Date(new Date(a.reportDate).getTime() + new Date(a.reportDate).getTimezoneOffset() * 60000),
          // Ensure all numeric fields default to 0 if null/undefined/empty string
          calls: (a.calls === null || a.calls === undefined || a.calls === '') ? 0 : (parseInt(a.calls, 10) || 0),
          appts: (a.appts === null || a.appts === undefined || a.appts === '') ? 0 : (parseInt(a.appts, 10) || 0),
          sits: (a.sits === null || a.sits === undefined || a.sits === '') ? 0 : (parseInt(a.sits, 10) || 0),
          sales: (a.sales === null || a.sales === undefined || a.sales === '') ? 0 : (parseInt(a.sales, 10) || 0),
          alp: (a.alp === null || a.alp === undefined || a.alp === '') ? 0 : (parseInt(a.alp, 10) || 0),
          refs: (a.refs === null || a.refs === undefined || a.refs === '') ? 0 : (parseInt(a.refs, 10) || 0),
          refAppt: (a.refAppt === null || a.refAppt === undefined || a.refAppt === '') ? 0 : (parseInt(a.refAppt, 10) || 0),
          refSit: (a.refSit === null || a.refSit === undefined || a.refSit === '') ? 0 : (parseInt(a.refSit, 10) || 0),
          refSale: (a.refSale === null || a.refSale === undefined || a.refSale === '') ? 0 : (parseInt(a.refSale, 10) || 0),
          refAlp: (a.refAlp === null || a.refAlp === undefined || a.refAlp === '') ? 0 : (parseInt(a.refAlp, 10) || 0)
        }));

        if (mounted) {
          console.log('🔍 [MGADataTable] Raw hierarchy response:', {
            totalUsers: (hierRes.data.data || []).length,
            allowedMgas: hierRes.data.allowedMgas || [],
            allowedMgasGlobal: hierRes.data.allowedMgasGlobal || [],
            agnName: hierRes.data.agnName
          });
          
          // Filter MGA grouping by allowedMgas when provided
          const rawUsers = hierRes.data.data || [];
          console.log('🔍 [MGADataTable] Raw users:', rawUsers.map(u => `${u.lagnname} (${u.clname})`).join(', '));
          
          // Component-level allowlists
          const allowByRga = new Set((hierRes.data.allowedMgas || []).map(s => (s || '').trim().toUpperCase()));
          const allowGlobal = new Set((hierRes.data.allowedMgasGlobal || []).map(s => (s || '').trim().toUpperCase()));
          
          console.log('🔍 [MGADataTable] Allowlists:', {
            allowByRga: Array.from(allowByRga),
            allowGlobal: Array.from(allowGlobal)
          });
          
          const hasAnyAllow = allowByRga.size > 0 || allowGlobal.size > 0;
          const isAllowed = (name) => {
            const key = (name || '').trim().toUpperCase();
            if (!key) return true;
            if (allowByRga.size > 0 && allowByRga.has(key)) return true;
            if (allowGlobal.size > 0 && allowGlobal.has(key)) return true;
            return false;
          };
          const cleanedUsers = hasAnyAllow
            ? rawUsers.filter(u => !u.mga || isAllowed(u.mga) || isAllowed(u.lagnname))
            : rawUsers;

          console.log('🔍 [MGADataTable] Cleaned users after filtering:', {
            total: cleanedUsers.length,
            users: cleanedUsers.map(u => `${u.lagnname} (${u.clname})`).join(', ')
          });

          // Store allowedMgasGlobal for use in topLevelRows filtering
          setAllowedMgasGlobal(hierRes.data.allowedMgasGlobal || []);

          setUsers(cleanedUsers);
          setActivity(activityData);
          // When DailyActivityForm provides a range, prefer it, else fall back to week picker
          if (startDate && endDate) {
            const monday = getMonday(new Date(startDate + 'T00:00:00'));
            const sunday = new Date(new Date(endDate + 'T00:00:00'));
            sunday.setHours(23,59,59,999);
            const fmt = (x) => `${(x.getMonth()+1).toString().padStart(2,'0')}/${x.getDate().toString().padStart(2,'0')}/${x.getFullYear()}`;
            const key = `${fmt(monday)} - ${fmt(sunday)}`;
            setWeeks([key]);
            setSelectedWeek(key);
          } else {
            const wk = enumerateWeeks(activityData);
            setWeeks(wk);
            setSelectedWeek(wk[0] || getCurrentWeekRange());
          }
        }
      } catch (e) {
        if (mounted) setError('Error loading MGA table');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAll();
    return () => { mounted = false; };
  }, [user?.userId]);

  const mgaToAgents = useMemo(() => {
    const grouped = groupAgentsByMGA(users);
    console.log('🔍 [MGADataTable] MGA to Agents grouping:', {
      totalMGAs: grouped.size,
      mgas: Array.from(grouped.keys())
    });
    return grouped;
  }, [users]);

  const filteredActivity = useMemo(() => {
    // If parent provides explicit range, honor it; else derive from selectedWeek
    let rangeStart;
    let rangeEnd;
    if (startDate && endDate) {
      rangeStart = new Date(startDate + 'T00:00:00');
      rangeEnd = new Date(endDate + 'T23:59:59');
    } else if (selectedWeek) {
      const [mondayStr] = selectedWeek.split(' - ');
      rangeStart = new Date(mondayStr);
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeStart.getDate() + 6);
      rangeEnd.setHours(23,59,59,999);
    } else {
      return [];
    }
    return activity.filter(a => a.reportDate >= rangeStart && a.reportDate <= rangeEnd);
  }, [activity, selectedWeek, startDate, endDate]);

  // Determine view type: weekly, monthly (MTD), or yearly (YTD)
  const viewType = useMemo(() => {
    if (startDate && endDate) {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 7) {
        return 'weekly';
      } else if (daysDiff <= 35) { // Roughly monthly (up to 5 weeks)
        return 'monthly';
      } else {
        return 'yearly';
      }
    }
    return 'weekly'; // Default to weekly view for week selector
  }, [startDate, endDate]);

  // Get weekly breakdown for monthly view or single week for weekly view
  const weeklyBreakdown = useMemo(() => {
    if (viewType === 'yearly') return []; // No weekly breakdown for YTD
    
    if (startDate && endDate) {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      
      if (viewType === 'weekly') {
        // Single week - return days
        return [{
          weekLabel: 'Week',
          weekNumber: 1,
          days: getWeekDays(start, end)
        }];
      } else if (viewType === 'monthly') {
        // Multiple weeks - group by weeks
        const weeks = [];
        let currentStart = new Date(start);
        let weekNumber = 1;
        
        while (currentStart <= end) {
          const weekStart = getMonday(currentStart);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          
          // Adjust week end to not exceed the actual end date
          const actualWeekEnd = weekEnd > end ? end : weekEnd;
          
          const weekDays = getWeekDays(weekStart, actualWeekEnd);
          const weekStartStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const weekEndStr = actualWeekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          weeks.push({
            weekLabel: `Week ${weekNumber} (${weekStartStr} - ${weekEndStr})`,
            weekNumber,
            days: weekDays
          });
          
          // Move to next week
          currentStart = new Date(weekEnd);
          currentStart.setDate(weekEnd.getDate() + 1);
          weekNumber++;
        }
        
        return weeks;
      }
    } else if (selectedWeek) {
      // Week selector mode
      const [mondayStr] = selectedWeek.split(' - ');
      const start = new Date(mondayStr);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      
      return [{
        weekLabel: 'Week',
        weekNumber: 1,
        days: getWeekDays(start, end)
      }];
    }
    return [];
  }, [startDate, endDate, selectedWeek, viewType]);

  // Build rows: one row per MGA with period totals and weekly/daily breakdown
  const baseRows = useMemo(() => {
    const cols = ['calls','appts','sits','sales','alp','refs','refAppt','refSit','refSale','refAlp'];
    const result = [];
    
    mgaToAgents.forEach((agents, mgaName) => {
      const normalize = (s) => (s || '').trim().toUpperCase();
      const agentSet = new Set((agents || []).map(normalize));
      
      // Build userId mapping for agents in this MGA (for handling null agent names)
      const userIdSet = new Set();
      users.forEach(u => {
        const mgaKey = u.mga || u.lagnname;
        if (normalize(mgaKey) === normalize(mgaName)) {
          if (u.userId) userIdSet.add(u.userId);
          // Also include userId of the MGA themselves if they match
          if (normalize(u.lagnname) === normalize(mgaName) && u.userId) {
            userIdSet.add(u.userId);
          }
        }
      });
      
      const rowData = {
        id: mgaName,
        role: 'MGA',
        name: mgaName,
        depth: 0,
      };
      
      // Calculate period totals (weekly for week view, monthly for MTD, yearly for YTD)
      const periodTotals = Object.fromEntries(cols.map(k => [k, 0]));
      let hasAnyActivity = false;
      filteredActivity.forEach(a => {
        // Match by agent name OR by userId when agent is null
        const matchByAgent = a.agent && agentSet.has(normalize(a.agent));
        const matchByUserId = !a.agent && a.userId && userIdSet.has(a.userId);
        
        if (matchByAgent || matchByUserId) {
          hasAnyActivity = true;
          cols.forEach(k => { periodTotals[k] += (a[k] || 0); }); // a[k] is already normalized to number
        }
      });
      
      // Only set period totals when there's activity
      if (hasAnyActivity) {
        cols.forEach(col => {
          rowData[col] = periodTotals[col];
        });
      }
      
      // Calculate weekly/daily breakdown based on view type
      if (weeklyBreakdown.length > 0) {
        if (viewType === 'weekly') {
          // Only calculate stats when there's activity
          if (hasAnyActivity) {
            // Weekly view: Calculate days reported for this MGA
            const daysRepData = calculateDaysRep(filteredActivity, agents, weeklyBreakdown[0].days);
            rowData.daysRep = `${daysRepData.daysReported}/${daysRepData.daysPassed}`;
            
            // Calculate stats ratios for this MGA
            const appts = periodTotals.appts || 0;
            const sits = periodTotals.sits || 0;
            const sales = periodTotals.sales || 0;
            const alp = periodTotals.alp || 0;
            const refAlp = periodTotals.refAlp || 0;
            const refSale = periodTotals.refSale || 0;
            const refs = periodTotals.refs || 0;
            
            rowData.showRatio = appts > 0 ? ((sits / appts) * 100).toFixed(1) + '%' : '0.0%';
            rowData.closeRatio = sits > 0 ? ((sales / sits) * 100).toFixed(1) + '%' : '0.0%';
            rowData.alpPerSale = sales > 0 ? (alp / sales).toFixed(0) : '0';
            rowData.alpPerRefSale = refSale > 0 ? (refAlp / refSale).toFixed(0) : '0';
            rowData.alpPerRefCollected = refs > 0 ? (refAlp / refs).toFixed(0) : '0';
            rowData.refCloseRatio = periodTotals.refSit > 0 ? ((periodTotals.refSale / periodTotals.refSit) * 100).toFixed(1) + '%' : '0.0%';
            rowData.refCollectedPerSit = periodTotals.sits > 0 ? (periodTotals.refs / periodTotals.sits).toFixed(2) : '0.00';
            rowData.callsToSitRatio = periodTotals.sits > 0 ? (periodTotals.calls / periodTotals.sits).toFixed(2) : '0.00';
          }
          
          // Weekly view: Calculate daily breakdown
          weeklyBreakdown[0].days.forEach((day, dayIndex) => {
            const dayName = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][dayIndex % 7];
            const dayTotals = Object.fromEntries(cols.map(k => [k, 0]));
            
            // Filter activity for this specific day
            const dayActivity = filteredActivity.filter(a => {
              const activityDate = new Date(a.reportDate);
              return activityDate.toDateString() === day.toDateString();
            });
            
            // Sum up totals for agents in this MGA on this day
            let hadReportForThisMgaOnDay = false;
            dayActivity.forEach(a => {
              // Match by agent name OR by userId when agent is null
              const matchByAgent = a.agent && agentSet.has(normalize(a.agent));
              const matchByUserId = !a.agent && a.userId && userIdSet.has(a.userId);
              
              if (matchByAgent || matchByUserId) {
                hadReportForThisMgaOnDay = true;
                cols.forEach(k => { dayTotals[k] += (a[k] || 0); }); // a[k] is already normalized to number
              }
            });
            
            // Only set values when a report exists for this MGA on this day
            if (hadReportForThisMgaOnDay) {
              cols.forEach(col => {
                rowData[`${dayName}_${col}`] = dayTotals[col];
              });
            }
          });
        } else if (viewType === 'monthly') {
          // Monthly view: Calculate week totals only
          weeklyBreakdown.forEach((week) => {
            const weekTotals = Object.fromEntries(cols.map(k => [k, 0]));
            
            // Filter activity for this entire week
            const weekActivity = filteredActivity.filter(a => {
              const activityDate = new Date(a.reportDate);
              return week.days.some(day => day.toDateString() === activityDate.toDateString());
            });
            
            // Sum up totals for agents in this MGA for this week
            weekActivity.forEach(a => {
              // Match by agent name OR by userId when agent is null
              const matchByAgent = a.agent && agentSet.has(normalize(a.agent));
              const matchByUserId = !a.agent && a.userId && userIdSet.has(a.userId);
              
              if (matchByAgent || matchByUserId) {
                cols.forEach(k => { weekTotals[k] += (a[k] || 0); }); // a[k] is already normalized to number
              }
            });
            
            // Add week totals to row data (ensure 0 for any undefined values)
            cols.forEach(col => {
              rowData[`week${week.weekNumber}_${col}`] = weekTotals[col] || 0;
            });
          });
        }
      }
      
      result.push(rowData);
    });
    
    // Sort alphabetically for stability
    const sorted = result.sort((a,b)=> a.name.localeCompare(b.name));
    
    console.log('🔍 [MGADataTable] Base rows (all MGAs):', {
      total: sorted.length,
      mgas: sorted.map(r => r.name).join(', ')
    });
    
    return sorted;
  }, [mgaToAgents, filteredActivity, weeklyBreakdown, viewType]);

  // Filter top-level MGA rows based on logged-in user's role/hierarchy
  const topLevelRows = useMemo(() => {
    const normalize = (s) => (s || '').trim().toUpperCase();
    const role = (user?.clname || '').toUpperCase();
    const selfName = user?.lagnname || '';

    console.log('🔍 [MGADataTable] Filtering topLevelRows:', {
      role,
      selfName,
      totalBaseRows: baseRows.length,
      allowedMgasGlobal: allowedMgasGlobal
    });

    const allowed = new Set();

    if (role === 'RGA') {
      // Use backend allowlist (active/not hidden MGAs under this RGA)
      // Pull from latest cleaned users by grouping names present in baseRows but restrict by allowedMgas
      // We stored allowed sets earlier when filtering users; rebuild from them for safety
      // Fallback: allow all MGAs present if none available
      // Here we approximate by allowing any MGA present in baseRows whose members have rga equal to selfName if available
      const presentMgas = new Set(baseRows.map(r => normalize(r.name)));
      
      // Include the RGA themselves if they appear as their own MGA team
      // (This happens when an RGA doesn't have an MGA above them)
      if (presentMgas.has(normalize(selfName))) {
        allowed.add(normalize(selfName));
      }
      
      // Prefer MGAs whose rga matches the logged-in RGA
      users.forEach(u => {
        if (u.clname === 'MGA' && presentMgas.has(normalize(u.lagnname))) {
          if (normalize(u.rga) === normalize(selfName)) allowed.add(normalize(u.lagnname));
        }
      });
      // If none found by rga match, keep all present
      if (allowed.size === 0) presentMgas.forEach(n => allowed.add(n));
      
      console.log('🔍 [MGADataTable] RGA filtering - before global list:', {
        allowedMGAs: Array.from(allowed)
      });
      
      // Also allow any MGAs in the global allow list (e.g., LOCKER-ROTOLO MGAs for Brody)
      if (allowedMgasGlobal && allowedMgasGlobal.length > 0) {
        console.log('🔍 [MGADataTable] Adding global allowed MGAs to RGA:', allowedMgasGlobal);
        allowedMgasGlobal.forEach(mgaName => {
          allowed.add(normalize(mgaName));
        });
      }
      
      console.log('🔍 [MGADataTable] RGA filtering - after global list:', {
        allowedMGAs: Array.from(allowed)
      });
    } else if (role === 'MGA') {
      // Allow self MGA and recursively include any MGA whose immediate mga is in the allowed set
      const queue = [normalize(selfName)];
      const seen = new Set(queue);
      while (queue.length) {
        const current = queue.shift();
        allowed.add(current);
        users.forEach(u => {
          if (u.clname === 'MGA' && normalize(u.mga) === current) {
            const child = normalize(u.lagnname);
            if (!seen.has(child)) {
              seen.add(child);
              queue.push(child);
            }
          }
        });
      }

      console.log('🔍 [MGADataTable] MGA filtering - before global list:', {
        allowedMGAs: Array.from(allowed)
      });
      
      // Also allow any MGAs in the global allow list (e.g., LOCKER-ROTOLO MGAs for Brody)
      if (allowedMgasGlobal && allowedMgasGlobal.length > 0) {
        console.log('🔍 [MGADataTable] Adding global allowed MGAs:', allowedMgasGlobal);
        allowedMgasGlobal.forEach(mgaName => {
          allowed.add(normalize(mgaName));
        });
      }
      
      console.log('🔍 [MGADataTable] MGA filtering - after global list:', {
        allowedMGAs: Array.from(allowed)
      });
    } else {
      // For GA/SA/AGT: show only their reporting MGA
      let myMga = '';
      const me = users.find(u => normalize(u.lagnname) === normalize(selfName));
      if (me && me.mga) myMga = me.mga;
      else {
        // Try to infer from any record that references this agent's mga
        users.forEach(u => {
          if (normalize(u.lagnname) === normalize(selfName) && u.mga) myMga = u.mga;
        });
      }
      if (myMga) allowed.add(normalize(myMga));
      
      console.log('🔍 [MGADataTable] GA/SA/AGT filtering result:', {
        myMga,
        allowedMGAs: Array.from(allowed)
      });
    }

    if (allowed.size === 0) {
      console.log('🔍 [MGADataTable] No filtering restrictions, showing all base rows');
      return baseRows; // Fallback: no restriction
    }
    
    const filtered = baseRows.filter(r => allowed.has(normalize(r.name)));
    
    console.log('🔍 [MGADataTable] Final topLevelRows result:', {
      totalAllowed: allowed.size,
      allowedMGAs: Array.from(allowed),
      totalFiltered: filtered.length,
      displayedMGAs: filtered.map(r => r.name).join(', ')
    });
    
    return filtered;
  }, [baseRows, users, user?.clname, user?.lagnname, allowedMgasGlobal]);

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
      case 'AGT':
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

  const numberFormatter = useMemo(() => new Intl.NumberFormat('en-US'), []);
  const currencyFormatter = useMemo(() => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }), []);

  const columns = useMemo(() => {
    const metrics = [
      { key: 'calls', label: 'Calls', formatter: numberFormatter, weeklyWidth: 100, dailyWidth: 100 },
      { key: 'appts', label: 'Appts', formatter: numberFormatter, weeklyWidth: 100, dailyWidth: 100 },
      { key: 'sits', label: 'Sits', formatter: numberFormatter, weeklyWidth: 100, dailyWidth: 100 },
      { key: 'sales', label: 'Sales', formatter: numberFormatter, weeklyWidth: 100, dailyWidth: 100 },
      { key: 'alp', label: 'ALP', formatter: currencyFormatter, weeklyWidth: 100, dailyWidth: 100 },
      { key: 'refs', label: 'Refs', formatter: numberFormatter, weeklyWidth: 100, dailyWidth: 100 },
      { key: 'refAppt', label: 'Ref Appt', formatter: numberFormatter, weeklyWidth: 100, dailyWidth: 100 },
      { key: 'refSit', label: 'Ref Sit', formatter: numberFormatter, weeklyWidth: 100, dailyWidth: 100 },
      { key: 'refSale', label: 'Ref Sale', formatter: numberFormatter, weeklyWidth: 100, dailyWidth: 100 },
      { key: 'refAlp', label: 'Ref ALP', formatter: currencyFormatter, weeklyWidth: 100, dailyWidth: 100 }
    ];
    
    const columns = [
      { 
        Header: 'Role', 
        accessor: 'role', 
        width: 70,
        minWidth: 70,
        filterable: false,
        Cell: ({ value, row }) => (
          <span 
            className="user-role-badge" 
            style={{ 
              ...getRoleBadgeStyle(value), 
              marginLeft: `${(row.original.depth || 0) * 16}px`
            }}
          >
            {value}
          </span>
        )
      },
      { Header: 'Name', accessor: 'name', width: 200, minWidth: 150, filterable: true }
    ];

    if (viewType === 'weekly') {
      // Weekly view: Show weekly totals and daily breakdown
      const weeklyTotalsColumns = [
        ...metrics.map((metric, index) => ({
          Header: metric.label,
          accessor: metric.key,
          width: metric.weeklyWidth,
          minWidth: metric.weeklyWidth,
          type: 'number',
          className: index === 0 ? 'group-first-column' : '',
          filterable: false,
          Cell: ({ value }) => metric.formatter.format(value ?? 0)
        })),
        {
          Header: 'Days Rep',
          accessor: 'daysRep',
          width: 80,
          minWidth: 80,
          type: 'string',
          className: '',
          filterable: false,
          Cell: ({ value }) => value || '0/0'
        }
      ];
      
      columns.push({
        Header: 'Weekly Totals',
        className: 'column-group-weekly',
        width: 1080, // 10 columns × 100px + 1 column × 80px
        minWidth: 1080,
        columns: weeklyTotalsColumns
      });
      
      // Add Stats section
      columns.push({
        Header: 'Stats',
        className: 'column-group-stats',
        width: 800, // 8 columns × 100px each
        minWidth: 800,
        columns: [
          {
            Header: 'Show Ratio',
            accessor: 'showRatio',
            width: 100,
            minWidth: 100,
            type: 'string',
            className: 'group-first-column',
            filterable: false,
            Cell: ({ value }) => value || '0.0%'
          },
          {
            Header: 'Close Ratio',
            accessor: 'closeRatio',
            width: 100,
            minWidth: 100,
            type: 'string',
            className: '',
            filterable: false,
            Cell: ({ value }) => value || '0.0%'
          },
          {
            Header: 'ALP/Sale',
            accessor: 'alpPerSale',
            width: 100,
            minWidth: 100,
            type: 'string',
            className: '',
            filterable: false,
            Cell: ({ value }) => currencyFormatter.format(value || 0)
          },
          {
            Header: 'ALP/Ref Sale',
            accessor: 'alpPerRefSale',
            width: 100,
            minWidth: 100,
            type: 'string',
            className: '',
            filterable: false,
            Cell: ({ value }) => currencyFormatter.format(value || 0)
          },
          {
            Header: 'ALP/Ref Coll',
            accessor: 'alpPerRefCollected',
            width: 100,
            minWidth: 100,
            type: 'string',
            className: '',
            filterable: false,
            Cell: ({ value }) => currencyFormatter.format(value || 0)
          },
          {
            Header: 'Ref Close Ratio',
            accessor: 'refCloseRatio',
            width: 100,
            minWidth: 100,
            type: 'string',
            className: '',
            filterable: false,
            Cell: ({ value }) => value || '0.0%'
          },
          {
            Header: 'Ref Coll/Sit',
            accessor: 'refCollectedPerSit',
            width: 100,
            minWidth: 100,
            type: 'string',
            className: '',
            filterable: false,
            Cell: ({ value }) => value || '0.00'
          },
          {
            Header: 'Calls to Sit',
            accessor: 'callsToSitRatio',
            width: 100,
            minWidth: 100,
            type: 'string',
            className: '',
            filterable: false,
            Cell: ({ value }) => value || '0.00'
          }
        ]
      });
      
      // Add daily group columns for the single week
      if (weeklyBreakdown[0]) {
        weeklyBreakdown[0].days.forEach((day, dayIndex) => {
          const dayName = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][dayIndex % 7];
          const dayLabel = day.toLocaleDateString('en-US', { weekday: 'long', month: 'numeric', day: 'numeric' });
          
          columns.push({
            Header: dayLabel,
            className: `column-group-daily column-group-${dayName}`,
            width: 1000, // 10 columns × 100px each
            minWidth: 1000,
            columns: metrics.map((metric, index) => ({
              Header: metric.label,
              accessor: `${dayName}_${metric.key}`,
              width: metric.dailyWidth,
              minWidth: metric.dailyWidth,
              type: 'number',
              className: index === 0 ? 'group-first-column day-separator' : '',
              filterable: false,
              Cell: ({ value }) => (value === undefined || value === null) ? '' : metric.formatter.format(value)
            }))
          });
        });
      }
    } else if (viewType === 'monthly') {
      // Monthly view: Show month totals and week-by-week breakdown
      // Use endDate to determine the target month since MTD often starts with partial week from previous month
      const periodLabel = startDate && endDate ? 
        `Month Totals (${new Date(endDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})` : 
        'Month Totals';
      
      columns.push({
        Header: periodLabel,
        className: 'column-group-period',
        width: 1000, // 10 columns × 100px each
        minWidth: 1000,
        columns: metrics.map((metric, index) => ({
          Header: metric.label,
          accessor: metric.key,
          width: metric.weeklyWidth,
          minWidth: metric.weeklyWidth,
          type: 'number',
          className: index === 0 ? 'group-first-column' : '',
          filterable: false,
          Cell: ({ value }) => metric.formatter.format(value ?? 0)
        }))
      });
      
      // Add week totals columns
      weeklyBreakdown.forEach((week) => {
        columns.push({
          Header: week.weekLabel,
          className: `column-group-week column-group-week${week.weekNumber}`,
          width: 1000, // 10 columns × 100px each
          minWidth: 1000,
          columns: metrics.map((metric, index) => ({
            Header: metric.label,
            accessor: `week${week.weekNumber}_${metric.key}`,
            width: metric.weeklyWidth,
            minWidth: metric.weeklyWidth,
            type: 'number',
            className: index === 0 ? 'group-first-column' : '',
            filterable: false,
            Cell: ({ value }) => metric.formatter.format(value ?? 0)
          }))
        });
      });
    } else {
      // YTD view: Show only period totals (no weekly breakdown)  
      // Use endDate to determine the target year since that's the "current" year being analyzed
      const periodLabel = startDate && endDate ? 
        `Year Totals (${new Date(endDate).getFullYear()})` : 
        'Year Totals';
      
      columns.push({
        Header: periodLabel,
        className: 'column-group-period',
        width: 1000, // 10 columns × 100px each
        minWidth: 1000,
        columns: metrics.map((metric, index) => ({
          Header: metric.label,
          accessor: metric.key,
          width: metric.weeklyWidth,
          minWidth: metric.weeklyWidth,
          type: 'number',
          className: index === 0 ? 'group-first-column' : '',
          filterable: false,
          Cell: ({ value }) => metric.formatter.format(value ?? 0)
        }))
      });
    }
    
    return columns;
  }, [weeklyBreakdown, viewType, startDate, endDate, numberFormatter, currencyFormatter]);

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>Loading MGA teams...</div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 16, color: 'var(--text-error)' }}>{error}</div>
    );
  }

  // Build hierarchy similar to old mapping
  const buildHierarchy = (agents) => {
    const order = ['RGA','MGA','GA','SA','AGT'];
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

        // Within a GA, place AGTs without SA before SA rows
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

        const oa = order.indexOf(aRole);
        const ob = order.indexOf(bRole);
        if (oa === ob) return a.lagnname.localeCompare(b.lagnname);
        return oa - ob;
      })
      .map(n => ({ ...n, children: sortRec(n.children, n) }));
    return sortRec(roots);
  };

  const agentPeriodAndWeeklyTotals = (agentName) => {
    const cols = ['calls','appts','sits','sales','alp','refs','refAppt','refSit','refSale','refAlp'];
    const allTotals = {};
    
    // Find the userId for this agent for fallback matching
    const agentUser = users.find(u => u.lagnname === agentName);
    const agentUserId = agentUser?.userId;
    
    // Calculate period totals (weekly for week view, monthly for MTD, yearly for YTD)
    const periodTotals = Object.fromEntries(cols.map(k=>[k,0]));
    let hasAnyActivity = false;
    filteredActivity.forEach(a => {
      // Match by agent name OR by userId when agent is null
      const matchByAgent = a.agent === agentName;
      const matchByUserId = !a.agent && agentUserId && a.userId === agentUserId;
      
      if (matchByAgent || matchByUserId) {
        hasAnyActivity = true;
        cols.forEach(k => periodTotals[k] += (a[k] || 0)); // a[k] is already normalized to number
      }
    });
    
    // Only set period totals when there's activity
    if (hasAnyActivity) {
      cols.forEach(col => {
        allTotals[col] = periodTotals[col];
      });
    }
    
    // Calculate weekly/daily breakdown based on view type
    if (weeklyBreakdown.length > 0) {
      if (viewType === 'weekly') {
        // Only calculate stats when there's activity
        if (hasAnyActivity) {
          // Weekly view: Calculate days reported for this individual agent
          const daysRepData = calculateDaysRep(filteredActivity, [agentName], weeklyBreakdown[0].days);
          allTotals.daysRep = `${daysRepData.daysReported}/${daysRepData.daysPassed}`;
          
          // Calculate stats ratios for this individual agent
          const appts = periodTotals.appts || 0;
          const sits = periodTotals.sits || 0;
          const sales = periodTotals.sales || 0;
          const alp = periodTotals.alp || 0;
          const refAlp = periodTotals.refAlp || 0;
          const refSale = periodTotals.refSale || 0;
          const refs = periodTotals.refs || 0;
          
          allTotals.showRatio = appts > 0 ? ((sits / appts) * 100).toFixed(1) + '%' : '0.0%';
          allTotals.closeRatio = sits > 0 ? ((sales / sits) * 100).toFixed(1) + '%' : '0.0%';
          allTotals.alpPerSale = sales > 0 ? (alp / sales).toFixed(0) : '0';
          allTotals.alpPerRefSale = refSale > 0 ? (refAlp / refSale).toFixed(0) : '0';
          allTotals.alpPerRefCollected = refs > 0 ? (refAlp / refs).toFixed(0) : '0';
          allTotals.refCloseRatio = periodTotals.refSit > 0 ? ((periodTotals.refSale / periodTotals.refSit) * 100).toFixed(1) + '%' : '0.0%';
          allTotals.refCollectedPerSit = periodTotals.sits > 0 ? (periodTotals.refs / periodTotals.sits).toFixed(2) : '0.00';
          allTotals.callsToSitRatio = periodTotals.sits > 0 ? (periodTotals.calls / periodTotals.sits).toFixed(2) : '0.00';
        }
        
        // Weekly view: Calculate daily breakdown
        weeklyBreakdown[0].days.forEach((day, dayIndex) => {
          const dayName = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][dayIndex % 7];
          const dayTotals = Object.fromEntries(cols.map(k => [k, 0]));
          
          // Filter activity for this specific day and agent
          const dayActivity = filteredActivity.filter(a => {
            const activityDate = new Date(a.reportDate);
            const dayMatches = activityDate.toDateString() === day.toDateString();
            // Match by agent name OR by userId when agent is null
            const matchByAgent = a.agent === agentName;
            const matchByUserId = !a.agent && agentUserId && a.userId === agentUserId;
            
            return dayMatches && (matchByAgent || matchByUserId);
          });
          
          // Sum up totals for this agent on this day
          dayActivity.forEach(a => {
            cols.forEach(k => dayTotals[k] += (a[k] || 0)); // a[k] is already normalized to number
          });
          
          // Only set values when a report exists for this agent on this day
          if (dayActivity.length > 0) {
            cols.forEach(col => {
              allTotals[`${dayName}_${col}`] = dayTotals[col];
            });
          }
        });
      } else if (viewType === 'monthly') {
        // Monthly view: Calculate week totals only
        weeklyBreakdown.forEach((week) => {
          const weekTotals = Object.fromEntries(cols.map(k => [k, 0]));
          
          // Filter activity for this entire week and agent
          const weekActivity = filteredActivity.filter(a => {
            const activityDate = new Date(a.reportDate);
            const weekMatches = week.days.some(day => day.toDateString() === activityDate.toDateString());
            // Match by agent name OR by userId when agent is null
            const matchByAgent = a.agent === agentName;
            const matchByUserId = !a.agent && agentUserId && a.userId === agentUserId;
            
            return weekMatches && (matchByAgent || matchByUserId);
          });
          
          // Sum up totals for this agent for this week
          weekActivity.forEach(a => {
            cols.forEach(k => weekTotals[k] += (a[k] || 0)); // a[k] is already normalized to number
          });
          
          // Add week totals (ensure 0 for any undefined values)
          cols.forEach(col => {
            allTotals[`week${week.weekNumber}_${col}`] = weekTotals[col] || 0;
          });
        });
      }
    }
    
    return allTotals;
  };

  // Build flattened display rows including expanded agents (kept in the same table)
  const displayRows = (() => {
    const out = [];
    topLevelRows.forEach(mgaRow => {
      // If this MGA is expanded, mark it to exclude from totals but keep values visible
      if (expandedMga[mgaRow.id]) {
        // Create a copy of the MGA row with a flag to exclude from totals
        const mgaRowExcludedFromTotals = {
          ...mgaRow,
          // Add a flag that DataTable can use to exclude from totals calculation
          _excludeFromTotals: true
        };
        
        out.push(mgaRowExcludedFromTotals);
      } else {
        // MGA not expanded, include its totals normally
        out.push(mgaRow);
      }
      
      if (expandedMga[mgaRow.id]) {
        const agents = users.filter(u => u.mga === mgaRow.name || u.lagnname === mgaRow.name);
        const tree = buildHierarchy(agents);
        const flat = [];
        const traverse = (nodes, depth) => {
          nodes.forEach(n => {
            const totals = agentPeriodAndWeeklyTotals(n.lagnname);
            flat.push({
              id: `${mgaRow.id}::${n.lagnname}`,
              role: n.clname || '',
              name: n.lagnname,
              depth,
              ...totals
            });
            if (n.children && n.children.length) traverse(n.children, depth + 1);
          });
        };
        traverse(tree, 0);
        out.push(...flat);
      }
    });
    return out;
  })();

  // Mark MGA rows as expandable (agent rows are not)
  const expandableRows = topLevelRows.reduce((acc, r) => { acc[r.id] = true; return acc; }, {});

  const handleRowExpansionChange = (rowId, isExpanded) => {
    setExpandedMga(prev => ({ ...prev, [rowId]: isExpanded }));
  };

  // Highlight the logged-in user's related rows similar to DailyActivityForm's today-row
  const rowClassNames = (() => {
    const classes = {};
    const normalize = (s) => (s || '').trim().toUpperCase();
    const selfName = user?.lagnname || '';

    // Determine the user's MGA for top-level highlight
    let myMga = '';
    const me = users.find(u => normalize(u.lagnname) === normalize(selfName));
    if (me) {
      if (String(me.clname || '').toUpperCase() === 'MGA') {
        myMga = me.lagnname;
      } else if (me.mga) {
        myMga = me.mga;
      }
    }

    displayRows.forEach(r => {
      // Highlight the user's own agent row when visible
      if (normalize(r.name) === normalize(selfName)) {
        classes[r.id] = 'today-row';
      }
      // Highlight the user's MGA top-level row
      if (r.role === 'MGA' && myMga && normalize(r.name) === normalize(myMga)) {
        classes[r.id] = 'today-row';
      }
    });
    return classes;
  })();

  return (
    <div>
      {!startDate && !endDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <label style={{ fontWeight: 600 }}>Week:</label>
          <select value={selectedWeek} onChange={(e)=> setSelectedWeek(e.target.value)}>
            {weeks.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
      )}
      <DataTable
        columns={columns}
        data={displayRows}
        disablePagination={true}
        showActionBar={false}
        disableCellEditing={true}
        showTotals={true}
        totalsPosition="bottom"
        bandedRows={true}
        enableColumnFilters={true}
        tableId="mga-daily-activity-table"
        totalsColumns={(() => {
          const allTotalsColumns = [];
          const metrics = ['calls','appts','sits','sales','alp','refs','refAppt','refSit','refSale','refAlp'];
          
          // Always add period totals columns
          allTotalsColumns.push(...metrics);
          
          // Add Days Rep and Stats columns for weekly view
          if (viewType === 'weekly') {
            allTotalsColumns.push('daysRep');
            allTotalsColumns.push('showRatio', 'closeRatio', 'alpPerSale', 'alpPerRefSale', 'alpPerRefCollected', 'refCloseRatio', 'refCollectedPerSit', 'callsToSitRatio');
          }
          
          // Add daily/weekly totals columns based on view type
          if (viewType === 'weekly' && weeklyBreakdown[0]) {
            weeklyBreakdown[0].days.forEach((day, dayIndex) => {
              const dayName = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][dayIndex % 7];
              metrics.forEach(metric => {
                allTotalsColumns.push(`${dayName}_${metric}`);
              });
            });
          } else if (viewType === 'monthly') {
            weeklyBreakdown.forEach((week) => {
              metrics.forEach(metric => {
                allTotalsColumns.push(`week${week.weekNumber}_${metric}`);
              });
            });
          }
          
          return allTotalsColumns;
        })()}
        totalsLabel="Org Totals"
        totalsLabelColumn="name"
        stickyHeader={false}
        enableRowExpansion={true}
        expandableRows={expandableRows}
        onRowExpansionChange={handleRowExpansionChange}
        rowClassNames={rowClassNames}
      />
      
      {/* Activity Summary Cards */}
      <ActivitySummaryCards data={displayRows} />
    </div>
  );
}


