/**
 * Activity Heatmap Widget
 *
 * GitHub-style contribution heatmap showing daily activity intensity.
 * Always shows Jan 1 – Dec 31 of the current year.
 *
 * Metrics adapt to role:
 *   - MGA/RGA (team view): Agents Reporting (count of agents), Sales, ALP, Refs
 *   - Personal/AGT: Days Reported (binary), Sales, ALP, Refs
 *
 * Uses the same stats.dailyBreakdown data as other trend widgets.
 */

import React, { useMemo, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { FiGrid, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import ViewDots from './ViewDots';
import './ActivityHeatmapWidget.css';

/** Metric definitions — first entry is swapped based on role */
const PERSONAL_METRICS = [
  { key: 'reported', label: 'Days Reported', format: (v) => (v > 0 ? 'Reported' : 'No Report'), color: 'green' },
  { key: 'sales',    label: 'Sales Made',    format: (v) => `${v} sale${v !== 1 ? 's' : ''}`,    color: 'blue' },
  { key: 'alp',      label: 'ALP',           format: (v) => `$${Math.round(v).toLocaleString()}`, color: 'purple' },
  { key: 'refs',     label: 'Refs Collected', format: (v) => `${v} ref${v !== 1 ? 's' : ''}`,    color: 'amber' },
];

const TEAM_METRICS = [
  { key: 'agentsReporting', label: 'Agents Reporting', format: (v, max) => `${v} of ${max} agents`, color: 'green' },
  { key: 'sales',    label: 'Sales Made',    format: (v) => `${v} sale${v !== 1 ? 's' : ''}`,    color: 'blue' },
  { key: 'alp',      label: 'ALP',           format: (v) => `$${Math.round(v).toLocaleString()}`, color: 'purple' },
  { key: 'refs',     label: 'Refs Collected', format: (v) => `${v} ref${v !== 1 ? 's' : ''}`,    color: 'amber' },
];

/** Color palettes (5 levels: 0=empty, 1-4=intensity) matching GitHub's style */
const COLOR_PALETTES = {
  green:  ['var(--heatmap-empty, #161b22)', '#0e4429', '#006d32', '#26a641', '#39d353'],
  blue:   ['var(--heatmap-empty, #161b22)', '#0a3069', '#0550ae', '#2f81f7', '#58a6ff'],
  purple: ['var(--heatmap-empty, #161b22)', '#3b1f70', '#6639a6', '#8957e5', '#b083f0'],
  amber:  ['var(--heatmap-empty, #161b22)', '#5c3d0e', '#8a5d1c', '#d29922', '#e8b931'],
};

/** Day-of-week labels */
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Generate all dates between start and end (inclusive) */
const getDateRange = (startStr, endStr) => {
  const dates = [];
  const current = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

/** Quantize a value into 0-4 level based on the metric's max */
const getLevel = (value, max) => {
  if (!value || value <= 0) return 0;
  if (max <= 0) return 1;
  const ratio = value / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.50) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
};

/** No-op — week numbers are now simple sequential column indices */

const ActivityHeatmapWidget = ({ stats, loading, dateRange, viewScope, userRole, onToggleView, onPrevView, toggleLabel, viewIndex, viewCount }) => {
  const [selectedMetric, setSelectedMetric] = useState(2); // default to ALP
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  // Determine if team-level view (include SGA/Admin/app)
  const isGlobalAdminView = userRole === 'SGA' && viewScope !== 'personal';
  const isTeamView = (isGlobalAdminView || ['MGA', 'RGA'].includes(userRole)) && viewScope !== 'personal';
  const METRICS = isTeamView ? TEAM_METRICS : PERSONAL_METRICS;
  const totalAgents = stats?.totalAgents || 0;

  const metric = METRICS[selectedMetric] || METRICS[0];
  const palette = COLOR_PALETTES[metric.color];

  const heatmapData = useMemo(() => {
    if (!stats?.dailyBreakdown) return null;

    // Always show Jan 1 – Dec 31 of the current year
    const now = new Date();
    const year = now.getFullYear();
    const startStr = `${year}-01-01`;
    const endStr = `${year}-12-31`;
    const todayStr = now.toISOString().split('T')[0];
    const allDates = getDateRange(startStr, endStr);

    // Build lookup from dailyBreakdown
    const dataMap = {};
    (stats.dailyBreakdown || []).forEach(d => { dataMap[d.date] = d; });

    // Determine which dates fall inside the selected period
    const inRange = (date) => {
      if (!dateRange?.start || !dateRange?.end) return true;
      return date >= dateRange.start && date <= dateRange.end;
    };

    // Extract values per date for the selected metric
    const dateValues = allDates.map(date => {
      const day = dataMap[date];
      let value = 0;
      if (day) {
        switch (metric.key) {
          case 'reported':
            value = (day.calls || day.appts || day.sits || day.sales || day.alp || day.refs) ? 1 : 0;
            break;
          case 'agentsReporting':
            value = day.reportingAgents || 0;
            break;
          case 'sales': value = day.sales || 0; break;
          case 'alp':   value = day.alp || 0; break;
          case 'refs':  value = day.refs || 0; break;
          default: value = 0;
        }
      }
      return { date, value, isFuture: date > todayStr, inSelectedRange: inRange(date) };
    });

    // Max value for quantization
    let maxValue;
    if (metric.key === 'reported') {
      maxValue = 1;
    } else if (metric.key === 'agentsReporting') {
      maxValue = totalAgents > 0 ? totalAgents : Math.max(...dateValues.map(d => d.value), 1);
    } else {
      maxValue = Math.max(...dateValues.map(d => d.value), 0);
    }

    // Organize into weeks (columns). First week starts on Sunday of Jan 1's week.
    const firstDate = new Date(allDates[0] + 'T00:00:00');
    const startDow = firstDate.getDay(); // 0=Sun

    // Pad the beginning so the first column starts on Sunday
    const paddedDates = [];
    for (let i = 0; i < startDow; i++) {
      paddedDates.push(null);
    }
    dateValues.forEach(d => paddedDates.push(d));

    // Split into weeks (groups of 7)
    const weeks = [];
    for (let i = 0; i < paddedDates.length; i += 7) {
      const week = paddedDates.slice(i, i + 7);
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    // Simple sequential week numbers (1-based column index)
    const weekNumbers = weeks.map((_, i) => i + 1);

    // Summary stats (within the selected range only)
    const rangeValues = dateValues.filter(d => d.inSelectedRange && !d.isFuture);
    const activeDays = rangeValues.filter(d => d.value > 0).length;
    const totalDaysInRange = rangeValues.length;

    // Full-year stats
    const yearActiveDays = dateValues.filter(d => d.value > 0 && !d.isFuture).length;

    return { weeks, weekNumbers, maxValue, activeDays, totalDaysInRange, yearActiveDays };
  }, [stats?.dailyBreakdown, stats?.totalAgents, dateRange, metric.key, totalAgents]);

  // Month labels for the top of the heatmap (Jan–Dec current year)
  const monthLabels = useMemo(() => {
    const year = new Date().getFullYear();
    const startStr = `${year}-01-01`;
    const endStr = `${year}-12-31`;
    const allDates = getDateRange(startStr, endStr);
    const firstDate = new Date(allDates[0] + 'T00:00:00');
    const startDow = firstDate.getDay();

    const labels = [];
    let lastMonth = null;
    allDates.forEach((dateStr, idx) => {
      const d = new Date(dateStr + 'T00:00:00');
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      if (month !== lastMonth) {
        const adjustedIdx = idx + startDow;
        const weekIdx = Math.floor(adjustedIdx / 7);
        labels.push({ label: month, weekIdx });
        lastMonth = month;
      }
    });
    return labels;
  }, []);

  const handleCellHover = (e, cell) => {
    if (!cell) { setTooltip(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    setTooltip({
      x: rect.left - (containerRect?.left || 0) + rect.width / 2,
      y: rect.top - (containerRect?.top || 0) - 8,
      date: cell.date,
      value: cell.value,
      isFuture: cell.isFuture,
      inSelectedRange: cell.inSelectedRange,
    });
  };

  const navButtonStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--muted-foreground)', padding: '2px',
    borderRadius: '4px', transition: 'all 0.15s ease',
  };

  const handleHover = (e) => {
    e.currentTarget.style.color = 'var(--foreground)';
    e.currentTarget.style.backgroundColor = 'var(--accent, rgba(0,0,0,0.05))';
  };
  const handleLeave = (e) => {
    e.currentTarget.style.color = 'var(--muted-foreground)';
    e.currentTarget.style.backgroundColor = 'transparent';
  };

  const renderToggleTitle = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {(onPrevView || onToggleView) && (
        <button onClick={onPrevView || onToggleView} style={navButtonStyle} title="Previous view">
          <FiChevronLeft size={16} />
        </button>
      )}
      <CardTitle>Activity Heatmap</CardTitle>
      {onToggleView && (
        <button onClick={onToggleView} style={navButtonStyle} title={toggleLabel || 'Next view'}>
          <FiChevronRight size={16} />
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card className="bg-card border-border" style={{ height: '100%' }}>
        <CardHeader>{renderToggleTitle()}</CardHeader>
        <CardContent style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 140 }}>
          <div className="loading-spinner"></div>
        </CardContent>
      </Card>
    );
  }

  if (!heatmapData) {
    return (
      <Card className="bg-card border-border" style={{ height: '100%' }}>
        <CardHeader>{renderToggleTitle()}</CardHeader>
        <CardContent style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 140 }}>
          <p style={{ color: 'var(--muted-foreground)' }}>No data available for this period.</p>
        </CardContent>
      </Card>
    );
  }

  // Dynamic label for the metric in the summary text
  const metricSummaryLabel = (() => {
    switch (metric.key) {
      case 'reported':        return 'activity reported';
      case 'agentsReporting': return 'agents reporting';
      case 'sales':           return 'sales';
      case 'alp':             return 'ALP';
      case 'refs':            return 'refs collected';
      default:                return 'activity';
    }
  })();

  // Derive a human-readable period label from dateRange
  const periodLabel = (() => {
    if (!dateRange?.start || !dateRange?.end) return 'this year';
    const start = new Date(dateRange.start + 'T00:00:00');
    const end = new Date(dateRange.end + 'T00:00:00');
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (days <= 7) return 'this week';
    if (days <= 31) return 'this month';
    if (days <= 93) return 'this quarter';
    return 'this year';
  })();

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTooltipValue = (value) => {
    if (metric.key === 'agentsReporting') {
      return metric.format(value, totalAgents);
    }
    return metric.format(value);
  };

  return (
    <Card className="bg-card border-border" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader className="heatmap-header">
        <div className="heatmap-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {(onPrevView || onToggleView) && (
              <button onClick={onPrevView || onToggleView} style={navButtonStyle} onMouseEnter={handleHover} onMouseLeave={handleLeave} title="Previous view">
                <FiChevronLeft size={16} />
              </button>
            )}
            <CardTitle className="text-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiGrid size={18} />
              Activity Heatmap
            </CardTitle>
            {onToggleView && (
              <button onClick={onToggleView} style={navButtonStyle} onMouseEnter={handleHover} onMouseLeave={handleLeave} title={toggleLabel || 'Next view'}>
                <FiChevronRight size={16} />
              </button>
            )}
            {/* Summary inline */}
            <span className="heatmap-summary-inline">
              <strong>{heatmapData.activeDays}</strong>/{heatmapData.totalDaysInRange} days with {metricSummaryLabel} {periodLabel}
            </span>
          </div>

          {/* Metric selector pills — top right */}
          <div className="heatmap-metric-pills">
            {METRICS.map((m, idx) => (
              <button
                key={m.key}
                className={`heatmap-pill ${idx === selectedMetric ? 'heatmap-pill--active' : ''}`}
                onClick={() => setSelectedMetric(idx)}
                data-color={m.color}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent style={{ flex: 1, minHeight: 0, padding: '0 1rem 0.5rem', overflow: 'hidden' }}>
        <div className="heatmap-container" ref={containerRef}>
          {/* Tooltip */}
          {tooltip && (
            <div
              className="heatmap-tooltip"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              {tooltip.isFuture ? (
                <span className="heatmap-tooltip-future">Future date</span>
              ) : (
                <>
                  <strong>{formatTooltipValue(tooltip.value)}</strong>
                  <span className="heatmap-tooltip-date">{formatDate(tooltip.date)}</span>
                  {!tooltip.inSelectedRange && (
                    <span className="heatmap-tooltip-outside">Outside selected period</span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Day labels */}
          <div className="heatmap-day-labels">
            {DAY_LABELS.map((label, i) => (
              <span key={i} className="heatmap-day-label" style={{ gridRow: i + 1 }}>
                {i % 2 === 1 ? label : ''}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="heatmap-scroll-area">
            {/* Month labels (top) — uses same fixed-width columns as the grid */}
            <div
              className="heatmap-month-row"
              style={{ gridTemplateColumns: `repeat(${heatmapData.weeks.length}, var(--hm-cell, 14px))` }}
            >
              {monthLabels.map((m, i) => (
                <span
                  key={i}
                  className="heatmap-month-label"
                  style={{ gridColumn: m.weekIdx + 1 }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            <div
              className="heatmap-grid"
              style={{ gridTemplateColumns: `repeat(${heatmapData.weeks.length}, var(--hm-cell, 14px))` }}
            >
              {heatmapData.weeks.map((week, wIdx) =>
                week.map((cell, dIdx) => {
                  if (!cell) {
                    return <div key={`${wIdx}-${dIdx}`} className="heatmap-cell heatmap-cell--empty" />;
                  }
                  const level = cell.isFuture ? 0 : getLevel(cell.value, heatmapData.maxValue);
                  const outsideRange = !cell.inSelectedRange && !cell.isFuture;
                  return (
                    <div
                      key={`${wIdx}-${dIdx}`}
                      className={`heatmap-cell${cell.isFuture ? ' heatmap-cell--future' : ''}${outsideRange ? ' heatmap-cell--outside' : ''}`}
                      style={{ backgroundColor: palette[level] }}
                      onMouseEnter={(e) => handleCellHover(e, cell)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })
              )}
            </div>

            {/* Week numbers (bottom) — same fixed-width columns */}
            <div
              className="heatmap-week-row"
              style={{ gridTemplateColumns: `repeat(${heatmapData.weeks.length}, var(--hm-cell, 14px))` }}
            >
              {heatmapData.weekNumbers.map((wn, i) => (
                <span key={i} className="heatmap-week-label">
                  {wn != null && wn % 2 === 1 ? wn : ''}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="heatmap-legend">
          <span className="heatmap-legend-label">Less</span>
          {palette.map((color, i) => (
            <div key={i} className="heatmap-legend-cell" style={{ backgroundColor: color }} />
          ))}
          <span className="heatmap-legend-label">More</span>
        </div>
      </CardContent>
      <ViewDots count={viewCount} activeIndex={viewIndex} />
    </Card>
  );
};

export default ActivityHeatmapWidget;
