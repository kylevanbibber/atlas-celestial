import React, { useState, useEffect, useMemo } from "react";
import { FiUser, FiChevronLeft } from "react-icons/fi";
import api from "../../api";
import "./AgentViewer.css";

const GROUP_DETAILS = {
  1: { leads: 500, perDrop: 250, refs: 6, leadTypes: 'POS / HC / Dcards' },
  2: { leads: 400, perDrop: 200, refs: 5, leadTypes: 'POS / HC / dcards' },
  3: { leads: 300, perDrop: 150, refs: 4, leadTypes: 'HC / School / dcard' },
  4: { leads: 200, perDrop: 100, refs: 3, leadTypes: 'HC / School / Globe' },
  5: { leads: 150, perDrop: 75, refs: 2, leadTypes: 'Vendor leads' },
};

const formatName = (lagnname) => {
  if (!lagnname) return '';
  const parts = lagnname.split(',').map(p => p.trim());
  if (parts.length < 2) return lagnname;
  const last = parts[0];
  const first = (parts[1] || '').split(/\s+/)[0] || '';
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return `${capitalize(first)} ${capitalize(last)}`;
};

const fmt$ = (val) => {
  const num = Number(val) || 0;
  return num >= 1000 ? `$${(num / 1000).toFixed(1)}k` : `$${num.toLocaleString()}`;
};

const fmtDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const computeCategory = (allAgents, targetAgentId) => {
  const agent = allAgents.find(a => a.agentId === targetAgentId);
  if (!agent) return { agent: null, category: null };
  if ((agent.alp || 0) < 3000) return { agent, category: '6k Reup' };

  const highAlp = allAgents
    .filter(a => (a.alp || 0) >= 3000 && !a.isExcluded)
    .sort((a, b) => (b.alp || 0) - (a.alp || 0));

  const total = highAlp.length;
  const base = Math.floor(total / 5);
  const remainder = total % 5;
  let category = null;
  let currentIndex = 0;
  for (let g = 1; g <= 5; g++) {
    const groupSize = base + (g <= remainder ? 1 : 0);
    if (highAlp.slice(currentIndex, currentIndex + groupSize).some(a => a.agentId === targetAgentId)) {
      category = g;
      break;
    }
    currentIndex += groupSize;
  }
  return { agent, category };
};

const computeTeamCategoryDistribution = (allAgents, teamIds) => {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, '6k Reup': 0 };
  // Assign categories globally (org-wide quintile ranking)
  const eligible = allAgents.filter(a => !a.isExcluded);
  const highAlp = eligible.filter(a => (a.alp || 0) >= 3000).sort((a, b) => (b.alp || 0) - (a.alp || 0));
  const catMap = new Map();
  eligible.filter(a => (a.alp || 0) < 3000).forEach(a => catMap.set(a.agentId, '6k Reup'));
  const total = highAlp.length;
  const base = Math.floor(total / 5);
  const remainder = total % 5;
  let idx = 0;
  for (let g = 1; g <= 5; g++) {
    const size = base + (g <= remainder ? 1 : 0);
    for (let i = idx; i < idx + size; i++) catMap.set(highAlp[i].agentId, g);
    idx += size;
  }
  // Count only team members
  teamIds.forEach(id => {
    const cat = catMap.get(id);
    if (cat !== undefined) dist[cat] = (dist[cat] || 0) + 1;
  });
  return dist;
};

// Assign categories to all agents (global quintile) and return enriched list
const assignCategories = (allAgents) => {
  const eligible = allAgents.filter(a => !a.isExcluded);
  const highAlp = eligible.filter(a => (a.alp || 0) >= 3000).sort((a, b) => (b.alp || 0) - (a.alp || 0));
  const catMap = new Map();
  eligible.filter(a => (a.alp || 0) < 3000).forEach(a => catMap.set(a.agentId, '6k Reup'));
  const total = highAlp.length;
  const base = Math.floor(total / 5);
  const remainder = total % 5;
  let idx = 0;
  for (let g = 1; g <= 5; g++) {
    const size = base + (g <= remainder ? 1 : 0);
    for (let i = idx; i < idx + size; i++) catMap.set(highAlp[i].agentId, g);
    idx += size;
  }
  return eligible.map(a => {
    const cat = catMap.get(a.agentId);
    const details = typeof cat === 'number' ? GROUP_DETAILS[cat] : null;
    const refsHave = a.prevMonthRefs ?? a.rawData?.prev_month_refs_count ?? 0;
    const refsNeeded = details?.refs || 0;
    const meetsRefs = refsNeeded === 0 || refsHave >= refsNeeded;
    const leadsPerMonth = details ? (meetsRefs ? details.leads : Math.floor(details.leads / 2)) : 0;
    return { ...a, category: cat, leadsPerMonth, refsHave, refsNeeded, meetsRefs };
  });
};

// Determine available scopes based on clname
const getScopes = (clname) => {
  const cl = (clname || '').toUpperCase();
  if (cl === 'RGA') return ['personal', 'mga', 'rga'];
  if (['SA', 'GA', 'MGA'].includes(cl)) return ['personal', 'team'];
  return ['personal'];
};

const SCOPE_LABELS = {
  personal: 'Personal',
  team: 'Team',
  mga: 'MGA',
  rga: 'RGA',
};

// Get the clNameFilter for official ALP based on scope and role
const getAlpFilter = (scope, clname) => {
  if (scope === 'personal') return '&clNameFilter=PERSONAL';
  const cl = (clname || '').toUpperCase();
  if (scope === 'rga') return '&clNameFilter=NOT_MGA';
  if (scope === 'mga') return '&clNameFilter=MGA';
  if (scope === 'team' && cl === 'SA') return '&clNameFilter=SA';
  if (scope === 'team' && cl === 'GA') return '&clNameFilter=GA';
  if (scope === 'team') return '&clNameFilter=MGA';
  return '';
};

const AgentViewer = ({ agentData }) => {
  const [scopeData, setScopeData] = useState({}); // { [scope]: { loading, activity, officialAlp } }
  const [activeScope, setActiveScope] = useState('personal');
  const [alpTrend, setAlpTrend] = useState({ loading: true, data: [] });
  const [allotment, setAllotment] = useState({ loading: true, months: {} });
  const [refs, setRefs] = useState({ loading: true, data: [] });
  const [expandedAllotment, setExpandedAllotment] = useState(null); // month offset or null

  const name = formatName(agentData.lagnname);
  const isActive = agentData.managerActive === 'y';
  const scopes = useMemo(() => getScopes(agentData.clname), [agentData.clname]);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const today = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const getMonthKey = (offset) => {
    const d = new Date(year, month - 1 + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const getMonthLabel = (offset) => {
    const d = new Date(year, month - 1 + offset, 1);
    return d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
  };

  // Fetch activity + official ALP for each scope
  useEffect(() => {
    if (!agentData?.id) return;

    const lagnname = encodeURIComponent(agentData.lagnname);
    const initial = {};
    scopes.forEach(s => { initial[s] = { loading: true, activity: [], officialAlp: 0 }; });
    setScopeData(initial);

    scopes.forEach(scope => {
      // Activity: personal uses user-summary, others use team-summary
      const activityUrl = scope === 'personal'
        ? `/dailyActivity/user-summary?userId=${agentData.id}&startDate=${monthStart}&endDate=${today}`
        : `/dailyActivity/team-summary?lagnname=${lagnname}&userId=${agentData.id}&startDate=${monthStart}&endDate=${today}${scope === 'rga' ? '&roleScope=rga' : ''}`;

      // Official ALP
      const alpFilter = getAlpFilter(scope, agentData.clname);
      const alpUrl = `/alp/weekly/user-alp-mtd?lagnname=${lagnname}&month=${month}&year=${year}${alpFilter}`;

      Promise.allSettled([
        api.get(activityUrl),
        api.get(alpUrl),
      ]).then(([actRes, alpRes]) => {
        const activityRows = actRes.status === 'fulfilled' ? (actRes.value.data?.data || []) : [];
        let alpVal = 0;
        if (alpRes.status === 'fulfilled') {
          const d = alpRes.value.data;
          alpVal = d?.totalALP || d?.data?.LVL_3_NET || 0;
        }
        setScopeData(prev => ({
          ...prev,
          [scope]: { loading: false, activity: activityRows, officialAlp: alpVal },
        }));
      });
    });
  }, [agentData.id]);

  // Fetch scope-independent data
  useEffect(() => {
    if (!agentData?.id) return;
    const lagnname = encodeURIComponent(agentData.lagnname);

    // 6-Month ALP Trend (always personal)
    api.get(`/alp/monthly/user-6mo?lagnName=${lagnname}`)
      .then(res => setAlpTrend({ loading: false, data: res.data?.data || [] }))
      .catch(() => setAlpTrend({ loading: false, data: [] }));

    // Allotment for last/this/next month
    Promise.allSettled(
      [-1, 0, 1].map(offset =>
        api.get(`/pnp/allotment?targetMonth=${getMonthKey(offset)}`)
          .then(res => ({ offset, data: res.data }))
      )
    ).then(results => {
      const months = {};
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          const { offset, data } = r.value;
          let allData = data?.data || [];
          // Merge refValidationData into agent records (same pattern as AllotmentTab)
          const refValidation = data?.refValidationData || [];
          if (refValidation.length > 0) {
            const refCounts = {};
            refValidation.forEach(ref => {
              refCounts[ref.agent_id] = (refCounts[ref.agent_id] || 0) + 1;
            });
            allData = allData.map(a => ({
              ...a,
              prevMonthRefs: refCounts[a.agentId] || 0,
            }));
          }
          const { agent, category } = computeCategory(allData, agentData.id);
          months[offset] = { agent: agent ? { ...agent, category } : null, allData };
        }
      });
      setAllotment({ loading: false, months });
    });

    // Refs
    api.get(`/refs?filter_mode=own&user_id=${agentData.id}&archive=0`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setRefs({ loading: false, data });
      })
      .catch(() => setRefs({ loading: false, data: [] }));
  }, [agentData.id]);

  // Current scope's data
  const current = scopeData[activeScope] || { loading: true, activity: [], officialAlp: 0 };

  const mtdTotals = useMemo(() => {
    const rows = current.activity;
    return {
      calls: rows.reduce((s, r) => s + (Number(r.calls) || 0), 0),
      appts: rows.reduce((s, r) => s + (Number(r.appts) || 0), 0),
      sits: rows.reduce((s, r) => s + (Number(r.sits) || 0), 0),
      sales: rows.reduce((s, r) => s + (Number(r.sales) || 0), 0),
      alp: rows.reduce((s, r) => s + (Number(r.alp) || 0), 0),
      refs: rows.reduce((s, r) => s + (Number(r.refs) || 0), 0),
    };
  }, [current.activity]);

  const mtdStats = useMemo(() => {
    const t = mtdTotals;
    return {
      callsToSet: t.appts > 0 ? Math.round(t.calls / t.appts) : 0,
      showPct: t.appts > 0 ? ((t.sits / t.appts) * 100).toFixed(0) : '0',
      closePct: t.sits > 0 ? ((t.sales / t.sits) * 100).toFixed(0) : '0',
      alpPerSit: t.sits > 0 ? Math.round(t.alp / t.sits) : 0,
      refsPerSit: t.sits > 0 ? (t.refs / t.sits).toFixed(2) : '0.00',
    };
  }, [mtdTotals]);

  const recentDays = useMemo(() => {
    if (activeScope === 'personal') {
      return [...current.activity]
        .sort((a, b) => b.reportDate?.localeCompare(a.reportDate))
        .slice(0, 7);
    }
    // Aggregate by date for team scopes
    const byDate = {};
    current.activity.forEach(row => {
      const d = row.reportDate;
      if (!d) return;
      if (!byDate[d]) byDate[d] = { reportDate: d, calls: 0, appts: 0, sits: 0, sales: 0, alp: 0, refs: 0 };
      byDate[d].calls += Number(row.calls) || 0;
      byDate[d].appts += Number(row.appts) || 0;
      byDate[d].sits += Number(row.sits) || 0;
      byDate[d].sales += Number(row.sales) || 0;
      byDate[d].alp += Number(row.alp) || 0;
      byDate[d].refs += Number(row.refs) || 0;
    });
    return Object.values(byDate)
      .sort((a, b) => b.reportDate.localeCompare(a.reportDate))
      .slice(0, 7);
  }, [current.activity, activeScope]);

  const refStats = useMemo(() => {
    const counts = {};
    refs.data.forEach(r => {
      const status = r.status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return { total: refs.data.length, byStatus: counts };
  }, [refs.data]);

  const alpBars = useMemo(() => {
    const sorted = [...alpTrend.data].reverse();
    const maxVal = Math.max(...sorted.map(r => Math.abs(Number(r.netAlp) || 0)), 1);
    return sorted.map(r => ({
      month: r.month,
      value: Number(r.netAlp) || 0,
      pct: (Math.abs(Number(r.netAlp) || 0) / maxVal) * 100,
    }));
  }, [alpTrend.data]);

  // Team agent IDs for filtering allotment in non-personal scopes
  const teamAgentIds = useMemo(() => {
    if (activeScope === 'personal') return null;
    const ids = new Set();
    current.activity.forEach(r => { if (r.userId) ids.add(Number(r.userId)); });
    // For MGA team: also include agents matching mga field in allotment data
    if (agentData.clname === 'MGA' && activeScope === 'team') {
      Object.values(allotment.months).forEach(m => {
        (m?.allData || []).forEach(a => {
          if (a.mga === agentData.lagnname) ids.add(a.agentId);
        });
      });
    }
    return ids;
  }, [current.activity, activeScope, allotment.months, agentData]);

  return (
    <div className="agent-viewer">
      {/* Header */}
      <div className="agent-viewer-header">
        <div className="agent-viewer-header-pic">
          {agentData.profpic ? (
            <img src={agentData.profpic} alt="" />
          ) : (
            <FiUser size={22} />
          )}
        </div>
        <div className="agent-viewer-header-info">
          <span className="agent-viewer-header-name">{name}</span>
          <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
          <span className="status-badge">{agentData.clname}</span>
        </div>
      </div>

      {/* Scope pills — only show if more than one scope */}
      {scopes.length > 1 && (
        <div className="agent-lookup-filters" style={{ borderBottom: 'none', padding: '0 0 12px' }}>
          {scopes.map(scope => (
            <button
              key={scope}
              className={`agent-lookup-filter-pill ${activeScope === scope ? 'active' : ''}`}
              onClick={() => setActiveScope(scope)}
            >
              {SCOPE_LABELS[scope]}
            </button>
          ))}
        </div>
      )}

      {/* MTD Production */}
      <div className="agent-viewer-section">
        <div className="agent-viewer-section-title">MTD Production — {SCOPE_LABELS[activeScope]}</div>
        {current.loading ? (
          <div className="widget-loading"><div className="spinner" /> Loading...</div>
        ) : (() => {
          const R = 15.915;
          const C = 2 * Math.PI * R;
          const dash = (pct) => `${(Math.min(pct, 100) / 100) * C} ${C}`;
          const cards = [
            { label: 'Calls', value: mtdTotals.calls, donutVal: mtdStats.callsToSet, donutLabel: 'C/Set', donutPct: Math.min(mtdStats.callsToSet, 100), color: '#00558c' },
            { label: 'Appts', value: mtdTotals.appts, donutVal: `${mtdStats.showPct}%`, donutLabel: 'Show', donutPct: parseFloat(mtdStats.showPct), color: '#ff9800' },
            { label: 'Sits', value: mtdTotals.sits, donutVal: `${mtdStats.closePct}%`, donutLabel: 'Close', donutPct: parseFloat(mtdStats.closePct), color: 'rgb(178,82,113)' },
            { label: 'Sales', value: mtdTotals.sales, donutVal: `$${mtdStats.alpPerSit}`, donutLabel: 'ALP/Sit', donutPct: Math.min((mtdStats.alpPerSit / 600) * 100, 100), color: '#4caf50' },
            { label: 'Reported ALP', value: fmt$(mtdTotals.alp) },
            { label: 'Official ALP', value: fmt$(current.officialAlp) },
            { label: 'Refs', value: mtdTotals.refs, donutVal: mtdStats.refsPerSit, donutLabel: 'Ref/Sit', donutPct: Math.min((parseFloat(mtdStats.refsPerSit) / 15) * 100, 100), color: '#00558c' },
          ];
          return (
            <div className="agent-viewer-mtd-grid">
              {cards.map(card => (
                <div className="activity-alp-card" key={card.label} style={{ position: 'relative' }}>
                  <div className="activity-alp-card-title">{card.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="activity-alp-card-value">{card.value}</div>
                    {card.donutVal !== undefined && (
                      <svg viewBox="0 0 36 36" style={{ width: 48, height: 48, flexShrink: 0 }}>
                        <circle cx="18" cy="18" r={R} fill="transparent" stroke="#e0e0e0" strokeWidth="3" />
                        <circle cx="18" cy="18" r={R} fill="transparent" stroke={card.color} strokeWidth="3"
                          strokeDasharray={dash(card.donutPct)} strokeDashoffset="0"
                          style={{ transition: 'stroke-dasharray 0.4s ease' }} />
                        <text x="18" y="18" textAnchor="middle" fontSize="7" fill="var(--text-primary, #333)">{card.donutVal}</text>
                        <text x="18" y="24" textAnchor="middle" fontSize="5" fill="var(--text-secondary, #666)">{card.donutLabel}</text>
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Recent Activity */}
      <div className="agent-viewer-section">
        <div className="agent-viewer-section-title">Recent Activity — {SCOPE_LABELS[activeScope]}</div>
        {current.loading ? (
          <div className="widget-loading"><div className="spinner" /> Loading...</div>
        ) : recentDays.length === 0 ? (
          <div className="agent-viewer-empty">No activity this month</div>
        ) : (
          <div className="agent-viewer-table-wrap">
            <table className="agent-viewer-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Calls</th>
                  <th className="text-right">Appts</th>
                  <th className="text-right">Sits</th>
                  <th className="text-right">Sales</th>
                  <th className="text-right">ALP</th>
                  <th className="text-right">Refs</th>
                </tr>
              </thead>
              <tbody>
                {recentDays.map((row, i) => (
                  <tr key={i}>
                    <td>{fmtDate(row.reportDate)}</td>
                    <td className="text-right">{row.calls || 0}</td>
                    <td className="text-right">{row.appts || 0}</td>
                    <td className="text-right">{row.sits || 0}</td>
                    <td className="text-right">{row.sales || 0}</td>
                    <td className="text-right">{fmt$(row.alp)}</td>
                    <td className="text-right">{row.refs || 0}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 600, borderTop: '2px solid var(--border-color, #e5e7eb)' }}>
                  <td>Totals</td>
                  <td className="text-right">{mtdTotals.calls}</td>
                  <td className="text-right">{mtdTotals.appts}</td>
                  <td className="text-right">{mtdTotals.sits}</td>
                  <td className="text-right">{mtdTotals.sales}</td>
                  <td className="text-right">{fmt$(mtdTotals.alp)}</td>
                  <td className="text-right">{mtdTotals.refs}</td>
                </tr>
                <tr style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>
                  <td>Stats</td>
                  <td className="text-right">{mtdStats.callsToSet} C/Set</td>
                  <td className="text-right">{mtdStats.showPct}% Show</td>
                  <td className="text-right">{mtdStats.closePct}% Close</td>
                  <td className="text-right">{fmt$(mtdStats.alpPerSit)}/Sit</td>
                  <td className="text-right"></td>
                  <td className="text-right">{mtdStats.refsPerSit} R/Sit</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Lead Allotment */}
      <div className="agent-viewer-section">
        <div className="agent-viewer-section-title">Lead Allotment</div>
        {allotment.loading ? (
          <div className="widget-loading"><div className="spinner" /> Loading...</div>
        ) : expandedAllotment !== null ? (() => {
          // Expanded view — single month fills full width with agent table
          const offset = expandedAllotment;
          const monthData = allotment.months[offset];
          const allEnriched = monthData?.allData ? assignCategories(monthData.allData) : [];
          // Filter to team if non-personal scope
          const agents = (activeScope !== 'personal' && teamAgentIds)
            ? allEnriched.filter(a => teamAgentIds.has(a.agentId))
            : activeScope === 'personal' ? allEnriched.filter(a => a.agentId === agentData.id) : allEnriched;
          // Group by category
          const grouped = {};
          agents.forEach(a => {
            const key = a.category ?? 'Unknown';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(a);
          });
          const catOrder = [1, 2, 3, 4, 5, '6k Reup'];
          return (
            <div>
              <button
                className="agent-lookup-filter-pill"
                onClick={() => setExpandedAllotment(null)}
                style={{ marginBottom: 10 }}
              >
                <FiChevronLeft size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {getMonthLabel(offset)} — {offset === -1 ? 'Previous' : offset === 0 ? 'Current' : 'Projected'}
              </button>
              {catOrder.map(cat => {
                const list = grouped[cat];
                if (!list || list.length === 0) return null;
                const details = typeof cat === 'number' ? GROUP_DETAILS[cat] : null;
                return (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {cat === '6k Reup' ? '6k Reup' : `Category ${cat}`}
                      {details && <span style={{ fontWeight: 400 }}> — {details.leads} leads/mo ({details.perDrop}/drop) · {details.refs} refs req</span>}
                      <span style={{ fontWeight: 400 }}> · {list.length} agents</span>
                    </div>
                    <div className="agent-viewer-table-wrap">
                      <table className="agent-viewer-table">
                        <thead>
                          <tr>
                            <th>Agent</th>
                            <th className="text-right">ALP</th>
                            <th className="text-right">Refs</th>
                            {details && <th className="text-right">Leads/Mo</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {list.sort((a, b) => (b.alp || 0) - (a.alp || 0)).map(a => (
                            <tr key={a.agentId}>
                              <td>{formatName(a.agent)}</td>
                              <td className="text-right">{fmt$(a.alp || 0)}</td>
                              <td className="text-right">
                                {details ? (
                                  <span style={{ color: a.meetsRefs ? 'inherit' : '#b91c1c' }}>
                                    {a.refsHave}/{a.refsNeeded}
                                  </span>
                                ) : (a.refsHave || 0)}
                              </td>
                              {details && (
                                <td className="text-right">
                                  {a.meetsRefs ? a.leadsPerMonth : (
                                    <span style={{ color: '#b91c1c' }}>{a.leadsPerMonth} (halved)</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })() : (
          <div className="agent-viewer-lead-grid">
            {[-1, 0, 1].map(offset => {
              const monthData = allotment.months[offset];
              return (
                <div
                  className="activity-alp-card"
                  key={offset}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpandedAllotment(offset)}
                >
                  <div className="activity-alp-card-title">
                    {getMonthLabel(offset)} — {offset === -1 ? 'Previous' : offset === 0 ? 'Current' : 'Projected'}
                  </div>
                  {activeScope !== 'personal' && teamAgentIds ? (
                    monthData?.allData?.length ? (() => {
                      const dist = computeTeamCategoryDistribution(monthData.allData, teamAgentIds);
                      return [1, 2, 3, 4, 5, '6k Reup'].map(cat => (
                        <div className="agent-viewer-lead-card-row" key={cat}>
                          <span>{cat === '6k Reup' ? '6k Reup' : `Cat ${cat}`}</span>
                          <span>{dist[cat]} agents</span>
                        </div>
                      ));
                    })() : (
                      <div className="agent-viewer-empty">No allotment data</div>
                    )
                  ) : (
                    monthData?.agent ? (
                      <>
                        <div className="activity-alp-card-value" style={{ marginBottom: 6 }}>
                          Cat {monthData.agent.category || '—'}
                        </div>
                        <div className="agent-viewer-lead-card-row">
                          <span>ALP</span>
                          <span>{fmt$(monthData.agent.alp || 0)}</span>
                        </div>
                        <div className="agent-viewer-lead-card-row">
                          <span>Refs</span>
                          <span>{monthData.agent.rawData?.prev_month_refs_count ?? monthData.agent.prevMonthRefs ?? 0}</span>
                        </div>
                        <div className="agent-viewer-lead-card-row">
                          <span>VIPs</span>
                          <span>{monthData.agent.vipCount ?? monthData.agent.rawData?.vip_count ?? 0}</span>
                        </div>
                      </>
                    ) : (
                      <div className="agent-viewer-empty">Not in allotment</div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6-Month ALP Trend */}
      <div className="agent-viewer-section">
        <div className="agent-viewer-section-title">Monthly ALP (6-Month)</div>
        {alpTrend.loading ? (
          <div className="widget-loading"><div className="spinner" /> Loading...</div>
        ) : alpBars.length === 0 ? (
          <div className="agent-viewer-empty">No ALP history available</div>
        ) : (
          <div className="agent-viewer-bars">
            {alpBars.map((bar, i) => (
              <div className="agent-viewer-bar-row" key={i}>
                <span className="agent-viewer-bar-label">{bar.month}</span>
                <div className="agent-viewer-bar-track">
                  <div className="agent-viewer-bar-fill" style={{ width: `${bar.pct}%` }} />
                </div>
                <span className="agent-viewer-bar-amount">{fmt$(bar.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Referrals */}
      <div className="agent-viewer-section">
        <div className="agent-viewer-section-title">Referrals</div>
        {refs.loading ? (
          <div className="widget-loading"><div className="spinner" /> Loading...</div>
        ) : refStats.total === 0 ? (
          <div className="agent-viewer-empty">No active referrals</div>
        ) : (
          <div className="status-badges" style={{ gap: '6px' }}>
            <span className="status-badge active"><strong>{refStats.total}</strong> Total</span>
            {Object.entries(refStats.byStatus).map(([status, count]) => (
              <span className="status-badge" key={status}><strong>{count}</strong> {status}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentViewer;
