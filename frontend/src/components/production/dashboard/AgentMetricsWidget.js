/**
 * Agent Metrics Widget
 *
 * Sortable table showing:
 *   - Agent name + profile pic (clickable → AgentProfile)
 *   - Role + MGA columns with inline multi-select filters (DataTable-style)
 *   - Period activity: Calls, Appts, Sits, Sales, ALP, Refs
 *   - Conversion stats: Calls/Appt, Show%, Close%, ALP/Sale, Refs/Sit
 *     → red text for problem areas, green for good
 *   - Reporting: Total Days, Streak, Last Reported (all-time)
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { FiFilter } from 'react-icons/fi';
import { BiSortAZ, BiSortZA } from 'react-icons/bi';
import { AiOutlineClose } from 'react-icons/ai';
import { evaluate } from './baselines';
import RightDetails from '../../utils/RightDetails';
import api from '../../../api';
import '../../dashboard/TeamLeaderboard.css';
import '../../utils/ContextMenu.css';

/* ---------- helpers ---------- */

const fmtNum = (v) => new Intl.NumberFormat('en-US').format(v);
const fmtCur = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtPct = (v) => (isFinite(v) ? `${v.toFixed(0)}%` : '—');
const fmtRatio = (v) => (isFinite(v) && v > 0 ? v.toFixed(0) : '—');

const getStatColor = (baselineKey, value, hasDenominator) => {
  if (!hasDenominator) return undefined;
  const result = evaluate(baselineKey, value);
  if (result.status === 'bad')  return 'var(--destructive, #ef4444)';
  if (result.status === 'good') return 'var(--success, #10b981)';
  return undefined;
};

/**
 * Determine career stage from ESID (hire date).
 *   F6      = contracted < 6 months
 *   Rookie  = contracted ≤ 1 year (but ≥ 6 months, so not F6)
 *   Veteran = contracted > 1 year
 *   null    = no esid available
 */
const getCareerStage = (esid) => {
  if (!esid) return null;
  try {
    const esidDate = new Date(typeof esid === 'string' && !esid.includes('T') ? esid + 'T00:00:00' : esid);
    if (isNaN(esidDate.getTime())) return null;
    const now = new Date();
    const totalMonths = (now.getFullYear() - esidDate.getFullYear()) * 12 + (now.getMonth() - esidDate.getMonth());
    if (totalMonths < 6) return 'f6';
    if (totalMonths <= 12) return 'rookie';
    return 'veteran';
  } catch {
    return null;
  }
};

const CAREER_RING_STYLES = {
  f6:      { border: '2.5px solid #3b82f6', title: 'F6 — First 6 Months' },        // Blue
  rookie:  { border: '2.5px solid #f59e0b', title: 'Rookie — Less than 1 year' },   // Amber
  veteran: { border: '2.5px solid #10b981', title: 'Veteran — Over 1 year' },       // Green
};

/* ---------- column definitions ---------- */

const COLUMNS = [
  // --- Period activity ---
  { key: 'calls',  label: 'Calls',  group: 'activity', getValue: (a) => a.periodTotals?.calls ?? 0, format: fmtNum },
  { key: 'appts',  label: 'Appts',  group: 'activity', getValue: (a) => a.periodTotals?.appts ?? 0, format: fmtNum },
  { key: 'sits',   label: 'Sits',   group: 'activity', getValue: (a) => a.periodTotals?.sits ?? 0,  format: fmtNum },
  { key: 'sales',  label: 'Sales',  group: 'activity', getValue: (a) => a.periodTotals?.sales ?? 0, format: fmtNum },
  { key: 'alp',    label: 'ALP',    group: 'activity', getValue: (a) => a.periodTotals?.alp ?? 0,   format: fmtCur },
  { key: 'officialAlp', label: 'Official ALP', group: 'activity', getValue: (a) => a.officialAlp ?? 0, format: fmtCur },
  { key: 'refs',   label: 'Refs',   group: 'activity', getValue: (a) => a.periodTotals?.refs ?? 0,  format: fmtNum },

  // --- Conversion stats (color-coded) ---
  {
    key: 'callsPerAppt', label: 'Calls/Appt', group: 'conversion',
    getValue: (a) => {
      const pt = a.periodTotals || {};
      return pt.appts > 0 ? pt.calls / pt.appts : Infinity;
    },
    format: fmtRatio, baseline: 'callsPerAppt',
    hasDenom: (a) => (a.periodTotals?.appts ?? 0) > 0,
  },
  {
    key: 'showRate', label: 'Show%', group: 'conversion',
    getValue: (a) => {
      const pt = a.periodTotals || {};
      return pt.appts > 0 ? (pt.sits / pt.appts) * 100 : 0;
    },
    format: fmtPct, baseline: 'showRate',
    hasDenom: (a) => (a.periodTotals?.appts ?? 0) > 0,
  },
  {
    key: 'closeRate', label: 'Close%', group: 'conversion',
    getValue: (a) => {
      const pt = a.periodTotals || {};
      return pt.sits > 0 ? (pt.sales / pt.sits) * 100 : 0;
    },
    format: fmtPct, baseline: 'closeRate',
    hasDenom: (a) => (a.periodTotals?.sits ?? 0) > 0,
  },
  {
    key: 'alpPerSale', label: 'ALP/Sale', group: 'conversion',
    getValue: (a) => {
      const pt = a.periodTotals || {};
      return pt.sales > 0 ? pt.alp / pt.sales : 0;
    },
    format: fmtCur, baseline: 'alpPerSale',
    hasDenom: (a) => (a.periodTotals?.sales ?? 0) > 0,
  },
  {
    key: 'refsPerSit', label: 'Refs/Sit', group: 'conversion',
    getValue: (a) => {
      const pt = a.periodTotals || {};
      return pt.sits > 0 ? pt.refs / pt.sits : 0;
    },
    format: (v) => (isFinite(v) && v > 0 ? v.toFixed(1) : '—'),
    baseline: 'refsPerSit',
    hasDenom: (a) => (a.periodTotals?.sits ?? 0) > 0,
  },

  // --- Goal ---
  { key: 'goalProgress', label: 'Goal', group: 'goal', getValue: (a) => a._goalProgress ?? -1, format: null },

  // --- Reporting (all-time) ---
  { key: 'totalDays',     label: 'Days Rptd', group: 'reporting', getValue: (a) => a.totalDays,  format: (v) => `${v}` },
  { key: 'currentStreak', label: 'Streak',    group: 'reporting', getValue: (a) => a.currentStreak > 0 ? a.currentStreak : a.longestStreak, format: null },
  { key: 'lastReport',    label: 'Last Rptd', group: 'reporting', getValue: (a) => a.daysSinceReport, format: null },
];

/* ---------- Inline column filter (DataTable-style, uses ContextMenu.css) ---------- */

const ColumnFilter = ({ columnId, options, selected, onChange, onSort, sortDir, filterPos, onOpen, isOpen }) => {
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);
  const [search, setSearch] = useState('');
  const hasFilter = selected.length > 0 && selected.length < options.length;

  const handleOpen = useCallback((e) => {
    e.stopPropagation();
    if (isOpen) {
      onOpen(null);
      setSearch('');
    } else {
      const rect = btnRef.current.getBoundingClientRect();
      onOpen(columnId, {
        top: rect.bottom + window.scrollY + 4,
        left: Math.min(rect.right + window.scrollX - 240, window.innerWidth - 250),
      });
    }
  }, [isOpen, columnId, onOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) {
        onOpen(null);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onOpen]);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
  const allSelected = filtered.length > 0 && filtered.every((o) => selected.includes(o));

  const toggle = (val) => {
    onChange(
      columnId,
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val]
    );
  };

  const toggleAll = (checked) => {
    if (checked) {
      onChange(columnId, [...new Set([...selected, ...filtered])]);
    } else {
      onChange(columnId, selected.filter((v) => !filtered.includes(v)));
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
          display: 'flex', alignItems: 'center',
          color: hasFilter ? 'var(--primary-color, #3498db)' : 'var(--text-secondary, #999)',
        }}
        title="Filter column"
      >
        <FiFilter size={12} />
      </button>

      {isOpen && filterPos && (
        <div
          ref={dropdownRef}
          className="context-menu"
          style={{
            position: 'fixed',
            top: filterPos.top,
            left: filterPos.left,
            zIndex: 10000,
            minWidth: 240,
            width: 240,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sort A to Z */}
          <div className="menu-item" onClick={() => { onSort(columnId, 'asc'); onOpen(null); setSearch(''); }}>
            <span className="menu-icon"><BiSortAZ size={16} /></span>
            <span>Sort A to Z</span>
            {sortDir === 'asc' && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--primary-color, #3b82f6)' }}>✓</span>}
          </div>

          {/* Sort Z to A */}
          <div className="menu-item" onClick={() => { onSort(columnId, 'desc'); onOpen(null); setSearch(''); }}>
            <span className="menu-icon"><BiSortZA size={16} /></span>
            <span>Sort Z to A</span>
            {sortDir === 'desc' && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--primary-color, #3b82f6)' }}>✓</span>}
          </div>

          {/* Clear Filter */}
          {hasFilter && (
            <div className="menu-item" style={{ color: '#f44336' }} onClick={() => { onChange(columnId, []); }}>
              <span className="menu-icon"><AiOutlineClose size={14} /></span>
              <span>Clear Filter</span>
            </div>
          )}

          {/* Search */}
          <div className="context-menu-search">
            <input
              className="context-menu-search-input"
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>

          {/* Select All */}
          <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-color, #eee)' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 600, gap: 8, margin: 0, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
                style={{ margin: 0, flexShrink: 0, width: 14, height: 14 }}
              />
              <span>Select All</span>
            </label>
          </div>

          {/* Checkbox list */}
          <div className="context-menu-items" style={{ maxHeight: 200, padding: '4px 0' }}>
            {filtered.map((val) => (
              <div key={val} style={{ padding: '4px 12px', display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 13, gap: 8, width: '100%', margin: 0, color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(val)}
                    onChange={() => toggle(val)}
                    style={{ margin: 0, flexShrink: 0, width: 14, height: 14 }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {val}
                  </span>
                </label>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="menu-item menu-item-hint">No matches</div>
            )}
          </div>

          {/* Apply / Clear buttons */}
          <div style={{ display: 'flex', gap: 4, padding: 8, borderTop: '1px solid var(--border-color, #eee)' }}>
            <button
              onClick={() => { onOpen(null); setSearch(''); }}
              style={{
                flex: 1, padding: '6px 12px', background: '#4CAF50',
                color: 'white', border: 'none', borderRadius: 4,
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              Apply
            </button>
            <button
              onClick={() => { onChange(columnId, []); onOpen(null); setSearch(''); }}
              style={{
                flex: 1, padding: '6px 12px', background: '#f44336',
                color: 'white', border: 'none', borderRadius: 4,
                cursor: 'pointer', fontSize: 13,
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </>
  );
};

/* ---------- main component ---------- */

const AgentMetricsWidget = ({ stats, loading, viewScope, dateRange, viewMode }) => {
  const [sortColumn, setSortColumn] = useState('alp');
  const [sortDirection, setSortDirection] = useState('desc');
  const [columnFilters, setColumnFilters] = useState({}); // { clname: [...], mga: [...] }
  const [openFilter, setOpenFilter] = useState(null);     // which column filter is open
  const [filterPos, setFilterPos] = useState(null);       // { top, left } for fixed dropdown
  const [showRightDetails, setShowRightDetails] = useState(false);
  const [rightDetailsData, setRightDetailsData] = useState(null);
  const [goalsByUserId, setGoalsByUserId] = useState({}); // { `${userId}_personal`: { monthlyAlpGoal, ... } }
  const [goalEditAgent, setGoalEditAgent] = useState(null); // agentId being edited
  const [goalEditValue, setGoalEditValue] = useState('');
  const [goalEditSaving, setGoalEditSaving] = useState(false);
  const goalEditRef = useRef(null);
  const goalEditTriggerRef = useRef(null);

  // Close goal popover when clicking outside
  useEffect(() => {
    if (goalEditAgent == null) return;
    const handler = (e) => {
      if (goalEditRef.current && !goalEditRef.current.contains(e.target) &&
          goalEditTriggerRef.current && !goalEditTriggerRef.current.contains(e.target)) {
        setGoalEditAgent(null);
        setGoalEditValue('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [goalEditAgent]);

  // Save goal via API
  const handleSaveGoal = async (agentId) => {
    const val = parseFloat(goalEditValue);
    if (!val || val <= 0 || !dateRange?.start) return;

    setGoalEditSaving(true);
    try {
      const rangeStart = new Date(dateRange.start + 'T00:00:00');
      const year = rangeStart.getFullYear();
      const month = rangeStart.getMonth() + 1;

      await api.post('/goals', {
        userId: agentId,
        year,
        month,
        monthlyAlpGoal: val,
        goalType: 'personal',
        workingDays: [],
        rateSource: 'default',
        customRates: null,
      });

      // Update local state
      setGoalsByUserId(prev => ({
        ...prev,
        [`${agentId}_personal`]: { activeUserId: agentId, year, month, monthlyAlpGoal: val, goal_type: 'personal' },
      }));
      setGoalEditAgent(null);
      setGoalEditValue('');
    } catch (err) {
      console.error('Error saving goal:', err);
    } finally {
      setGoalEditSaving(false);
    }
  };

  // Fetch personal goals for all agents when metrics or dateRange change
  useEffect(() => {
    const fetchGoals = async () => {
      if (!stats.agentMetrics || stats.agentMetrics.length === 0 || !dateRange?.start) return;

      const rangeStart = new Date(dateRange.start + 'T00:00:00');
      const year = rangeStart.getFullYear();
      const month = rangeStart.getMonth() + 1;
      const userIds = stats.agentMetrics.map(a => a.id).filter(Boolean);

      if (userIds.length === 0) return;

      try {
        const chunkSize = 250;
        const combined = {};
        for (let i = 0; i < userIds.length; i += chunkSize) {
          const chunk = userIds.slice(i, i + chunkSize);
          const res = await api.post('/goals/batch', {
            userIds: chunk,
            year,
            month,
            goalType: 'personal',
          });
          Object.assign(combined, res.data?.goalsByUserId || {});
        }
        setGoalsByUserId(combined);
      } catch (err) {
        console.error('Error fetching goals for agent metrics:', err);
      }
    };

    fetchGoals();
  }, [stats.agentMetrics, dateRange?.start]);

  // Unique values for filterable columns
  const uniqueRoles = useMemo(() => {
    if (!stats.agentMetrics) return [];
    return [...new Set(stats.agentMetrics.map((a) => a.clname).filter(Boolean))].sort();
  }, [stats.agentMetrics]);

  const uniqueMgas = useMemo(() => {
    if (!stats.agentMetrics) return [];
    return [...new Set(stats.agentMetrics.map((a) => a.mga).filter(Boolean))].sort();
  }, [stats.agentMetrics]);

  const hasRoleFilter = (columnFilters.clname?.length > 0 && columnFilters.clname.length < uniqueRoles.length);
  const hasMgaFilter = (columnFilters.mga?.length > 0 && columnFilters.mga.length < uniqueMgas.length);
  const hasAnyFilter = hasRoleFilter || hasMgaFilter;

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Called from ColumnFilter sort options
  const handleColumnSort = useCallback((colId, dir) => {
    setSortColumn(colId);
    setSortDirection(dir);
  }, []);

  const handleFilterChange = useCallback((colId, values) => {
    setColumnFilters((prev) => ({ ...prev, [colId]: values }));
  }, []);

  const handleFilterOpen = useCallback((colId, pos) => {
    setOpenFilter(colId);
    setFilterPos(pos || null);
  }, []);

  // Open agent profile in RightDetails panel
  const handleOpenAgentProfile = async (agent) => {
    try {
      const response = await api.get(`/users/profile/${agent.name}`);
      if (response.data && response.data.success) {
        setRightDetailsData({ __isAgentProfile: true, ...response.data.data });
      } else {
        setRightDetailsData({
          __isAgentProfile: true, id: agent.id, lagnname: agent.name,
          displayName: agent.displayName, profpic: agent.profpic, managerActive: 'y',
        });
      }
    } catch (error) {
      console.error('Error fetching agent profile:', error);
      setRightDetailsData({
        __isAgentProfile: true, id: agent.id, lagnname: agent.name,
        displayName: agent.displayName, profpic: agent.profpic, managerActive: 'y',
      });
    }
    setShowRightDetails(true);
  };

  const sortedMetrics = useMemo(() => {
    if (!stats.agentMetrics || stats.agentMetrics.length === 0) return [];

    // 1. Enrich with goal data
    let enriched = stats.agentMetrics.map(agent => {
      const goalKey = `${agent.id}_personal`;
      const goal = goalsByUserId[goalKey];
      if (!goal || !goal.monthlyAlpGoal) return { ...agent, _monthlyGoal: null, _goalProgress: -1 };
      const monthlyGoal = parseFloat(goal.monthlyAlpGoal);
      const alp = agent.periodTotals?.alp ?? 0;
      const progress = monthlyGoal > 0 ? Math.round((alp / monthlyGoal) * 100) : 0;
      return { ...agent, _monthlyGoal: monthlyGoal, _goalProgress: progress };
    });

    // 2. Apply column filters
    let filtered = enriched;
    if (hasRoleFilter) {
      filtered = filtered.filter((a) => columnFilters.clname.includes(a.clname));
    }
    if (hasMgaFilter) {
      filtered = filtered.filter((a) => columnFilters.mga.includes(a.mga));
    }

    // 3. Sort
    if (sortColumn === 'clname' || sortColumn === 'mga') {
      return [...filtered].sort((a, b) => {
        const av = (a[sortColumn] || '').toLowerCase();
        const bv = (b[sortColumn] || '').toLowerCase();
        const cmp = av.localeCompare(bv);
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    const colDef = COLUMNS.find((c) => c.key === sortColumn);
    const getVal = colDef ? colDef.getValue : () => 0;

    return [...filtered].sort((a, b) => {
      let av = getVal(a);
      let bv = getVal(b);
      if (!isFinite(av)) av = sortDirection === 'asc' ? 1e12 : -1;
      if (!isFinite(bv)) bv = sortDirection === 'asc' ? 1e12 : -1;
      return sortDirection === 'asc' ? av - bv : bv - av;
    });
  }, [stats.agentMetrics, sortColumn, sortDirection, columnFilters, hasRoleFilter, hasMgaFilter, goalsByUserId]);

  // Hide Goal column when viewing yearly data (goals are monthly only)
  const visibleColumns = useMemo(() => {
    if (viewMode === 'year') return COLUMNS.filter(c => c.key !== 'goalProgress');
    return COLUMNS;
  }, [viewMode]);

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'desc' ? (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M7 10l5 5 5-5H7z" fill="currentColor" /></svg>
    ) : (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M7 14l5-5 5 5H7z" fill="currentColor" /></svg>
    );
  };

  if (loading) {
    return (
      <Card className="bg-card border-border" style={{ height: '100%' }}>
        <CardContent>
          <div className="activity-snapshot-summary loading" style={{ padding: '1rem' }}>
            <div className="loading-spinner"></div>
            <p>Loading metrics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardHeader style={{ paddingBottom: '0.5rem' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">Agent Metrics</CardTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {hasAnyFilter && (
                <p className="text-xs text-muted-foreground">
                  Showing {sortedMetrics.length} of {stats.agentMetrics?.length || 0} agents
                </p>
              )}
              {/* Career stage ring legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.65rem', color: 'var(--muted-foreground)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #3b82f6', display: 'inline-block' }} />F6
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.65rem', color: 'var(--muted-foreground)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #f59e0b', display: 'inline-block' }} />Rookie
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.65rem', color: 'var(--muted-foreground)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #10b981', display: 'inline-block' }} />Veteran
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
          <div style={{ overflow: 'auto', height: '100%', padding: '0 1rem 1rem' }}>
            <table className="w-full team-leaderboard-table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr className="border-b border-border">
                  {/* Agent */}
                  <th
                    className="pb-2 pt-0 text-left text-xs font-medium text-muted-foreground"
                    style={{ position: 'sticky', left: 0, background: 'var(--card-bg, #fff)', zIndex: 2, minWidth: 140 }}
                  >
                    Agent
                  </th>

                  {/* Role — sortable + filterable */}
                  <th
                    className="pb-2 pt-0 text-left text-xs font-medium text-muted-foreground select-none"
                    style={{ whiteSpace: 'nowrap', paddingLeft: '0.5rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'space-between' }}>
                      <span
                        className="cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort('clname')}
                      >
                        Role
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <SortIcon column="clname" />
                        <ColumnFilter
                          columnId="clname"
                          options={uniqueRoles}
                          selected={columnFilters.clname || []}
                          onChange={handleFilterChange}
                          onSort={handleColumnSort}
                          sortDir={sortColumn === 'clname' ? sortDirection : null}
                          filterPos={filterPos}
                          onOpen={handleFilterOpen}
                          isOpen={openFilter === 'clname'}
                        />
                      </div>
                    </div>
                  </th>

                  {/* MGA — sortable + filterable (always visible) */}
                  <th
                    className="pb-2 pt-0 text-left text-xs font-medium text-muted-foreground select-none"
                    style={{ whiteSpace: 'nowrap', paddingLeft: '0.5rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'space-between' }}>
                      <span
                        className="cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort('mga')}
                      >
                        MGA
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <SortIcon column="mga" />
                        <ColumnFilter
                          columnId="mga"
                          options={uniqueMgas}
                          selected={columnFilters.mga || []}
                          onChange={handleFilterChange}
                          onSort={handleColumnSort}
                          sortDir={sortColumn === 'mga' ? sortDirection : null}
                          filterPos={filterPos}
                          onOpen={handleFilterOpen}
                          isOpen={openFilter === 'mga'}
                        />
                      </div>
                    </div>
                  </th>

                  {/* Data columns */}
                  {visibleColumns.map((col) => (
                    <th
                      key={col.key}
                      className="pb-2 pt-0 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort(col.key)}
                      title={`Sort by ${col.label}`}
                      style={{ whiteSpace: 'nowrap', paddingLeft: '0.5rem' }}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{col.label}</span>
                        <SortIcon column={col.key} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedMetrics.map((agent) => {
                  const pt = agent.periodTotals || {};
                  const hasActivity = pt.calls > 0 || pt.appts > 0 || pt.sits > 0 || pt.sales > 0;

                  return (
                    <tr key={agent.id}>
                      {/* Agent name + pic */}
                      <td
                        className="py-2"
                        style={{ position: 'sticky', left: 0, background: 'var(--card-bg, #fff)', zIndex: 1 }}
                      >
                        <div
                          className="min-w-0 flex items-center gap-2 cursor-pointer"
                          onClick={() => handleOpenAgentProfile(agent)}
                        >
                          {(() => {
                            const stage = getCareerStage(agent.esid);
                            const ringStyle = stage ? CAREER_RING_STYLES[stage] : null;
                            const ringCss = ringStyle ? { border: ringStyle.border, padding: '1px' } : {};
                            return agent.profpic ? (
                              <img
                                src={agent.profpic}
                                alt={agent.displayName}
                                title={ringStyle?.title}
                                className="w-7 h-7 rounded-full object-cover flex-shrink-0 hover:opacity-80 transition-opacity"
                                style={ringCss}
                              />
                            ) : (
                              <div
                                className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-xs flex-shrink-0"
                                title={ringStyle?.title}
                                style={ringCss}
                              >
                                {agent.displayName.charAt(0).toUpperCase()}
                              </div>
                            );
                          })()}
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-foreground truncate hover:text-primary transition-colors">
                              {agent.displayName}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-2 text-left" style={{ whiteSpace: 'nowrap', paddingLeft: '0.5rem' }}>
                        <span className="text-xs font-medium text-muted-foreground">{agent.clname || '—'}</span>
                      </td>

                      {/* MGA */}
                      <td className="py-2 text-left" style={{ whiteSpace: 'nowrap', paddingLeft: '0.5rem' }}>
                        <span className="text-xs font-medium text-foreground">{agent.mga || '—'}</span>
                      </td>

                      {/* Data columns */}
                      {visibleColumns.map((col) => {
                        const rawVal = col.getValue(agent);

                        if (col.key === 'goalProgress') {
                          const goalVal = agent._monthlyGoal;
                          const progress = agent._goalProgress;
                          const isEditingThis = goalEditAgent === agent.id;

                          if (!goalVal || goalVal <= 0) {
                            return (
                              <td key={col.key} className="py-2 text-right" style={{ whiteSpace: 'nowrap', position: 'relative' }}>
                                <span
                                  ref={isEditingThis ? goalEditTriggerRef : undefined}
                                  className="text-xs text-muted-foreground goal-dash-trigger"
                                  style={{ cursor: 'pointer', userSelect: 'none' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGoalEditAgent(agent.id);
                                    setGoalEditValue('');
                                  }}
                                  title="Click to set goal"
                                >
                                  —
                                </span>
                                {isEditingThis && (
                                  <div ref={goalEditRef} className="goal-edit-popover">
                                    <div className="goal-edit-popover-arrow" />
                                    <div className="goal-edit-popover-content">
                                      <label className="goal-edit-label">Monthly ALP Goal</label>
                                      <div className="goal-edit-row">
                                        <span className="goal-edit-prefix">$</span>
                                        <input
                                          type="number"
                                          className="goal-edit-input"
                                          placeholder="e.g. 5000"
                                          value={goalEditValue}
                                          onChange={(e) => setGoalEditValue(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGoal(agent.id); if (e.key === 'Escape') { setGoalEditAgent(null); setGoalEditValue(''); } }}
                                          autoFocus
                                          min="0"
                                          step="100"
                                        />
                                        <button
                                          className="goal-edit-save"
                                          disabled={goalEditSaving || !goalEditValue || parseFloat(goalEditValue) <= 0}
                                          onClick={(e) => { e.stopPropagation(); handleSaveGoal(agent.id); }}
                                        >
                                          {goalEditSaving ? '…' : '✓'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </td>
                            );
                          }
                          return (
                            <td key={col.key} className="py-2 text-right" style={{ whiteSpace: 'nowrap', minWidth: 120 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ width: 60, height: 6, background: 'var(--border, #e5e7eb)', borderRadius: 999, overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        height: '100%',
                                        width: `${Math.min(progress, 100)}%`,
                                        borderRadius: 999,
                                        background: progress >= 100 ? '#10b981'
                                          : progress >= 75 ? '#3b82f6'
                                          : progress >= 50 ? '#eab308'
                                          : '#ef4444',
                                        transition: 'width 0.3s',
                                      }}
                                    />
                                  </div>
                                  <span
                                    className="text-xs font-bold"
                                    style={{
                                      color: progress >= 100 ? '#10b981'
                                        : progress >= 75 ? '#3b82f6'
                                        : progress >= 50 ? '#eab308'
                                        : '#ef4444',
                                    }}
                                  >
                                    {progress}%
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground">{fmtCur(goalVal)}</span>
                              </div>
                            </td>
                          );
                        }

                        if (col.key === 'currentStreak') {
                          const display = agent.currentStreak > 0 ? agent.currentStreak : agent.longestStreak;
                          const label = display === 1 ? 'day' : 'days';
                          return (
                            <td key={col.key} className="py-2 text-right" style={{ whiteSpace: 'nowrap' }}>
                              <span
                                className={`text-xs font-bold ${
                                  agent.isStreakActive ? 'text-green-500'
                                    : display > 0 ? 'text-red-500'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {display > 0
                                  ? `${display} ${label}${!agent.isStreakActive ? ' (prev)' : ''}`
                                  : '—'}
                              </span>
                            </td>
                          );
                        }

                        if (col.key === 'lastReport') {
                          return (
                            <td key={col.key} className="py-2 text-right" style={{ whiteSpace: 'nowrap' }}>
                              <span
                                className={`text-xs font-bold ${
                                  agent.daysSinceReport > 3 ? 'text-red-500' : 'text-foreground'
                                }`}
                              >
                                {agent.lastReportDisplay}
                              </span>
                            </td>
                          );
                        }

                        if (col.baseline) {
                          const denomOk = col.hasDenom ? col.hasDenom(agent) : hasActivity;
                          const color = getStatColor(col.baseline, rawVal, denomOk);
                          const formatted = col.format(rawVal);
                          return (
                            <td key={col.key} className="py-2 text-right" style={{ whiteSpace: 'nowrap' }}>
                              <span
                                className="text-xs font-bold"
                                style={{ color: denomOk ? color : 'var(--muted-foreground)' }}
                              >
                                {denomOk ? formatted : '—'}
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={col.key} className="py-2 text-right" style={{ whiteSpace: 'nowrap' }}>
                            <span className="text-xs font-bold text-foreground">
                              {col.format(rawVal)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {sortedMetrics.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length + 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>
                      No agent data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showRightDetails && rightDetailsData && (
        <RightDetails
          data={rightDetailsData}
          isOpen={showRightDetails}
          onClose={() => setShowRightDetails(false)}
        />
      )}
    </>
  );
};

export default AgentMetricsWidget;
