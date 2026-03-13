/**
 * Activity Trend Widget
 *
 * Charts only Calls and ALP over the selected date range.
 * Projection uses the full funnel (calls → appts → sits → sales → ALP)
 * based on previous period conversion rates, but only Calls and ALP are
 * drawn on the chart. All projected funnel numbers display in the header.
 *
 * Uses react-chartjs-2 (Chart.js) — consistent with existing charts in the app.
 */

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { FiTrendingUp, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import ViewDots from './ViewDots';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/** Generate all dates between start and end (inclusive) as YYYY-MM-DD strings. */
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

/** Format a date string for the x-axis. */
const formatLabel = (dateStr, totalDays) => {
  const d = new Date(dateStr + 'T00:00:00');
  if (totalDays > 90) return d.toLocaleDateString('en-US', { month: 'short' });
  if (totalDays > 31) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** Format end date for the "Projected by" label. */
const formatEndDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const CALLS_COLOR = { line: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.08)' };   // blue
const ALP_COLOR   = { line: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.08)' };   // green

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const ActivityTrendWidget = ({ stats, loading, dateRange, onToggleView, onPrevView, toggleLabel, viewIndex, viewCount }) => {
  const chartData = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end || !stats?.dailyBreakdown) return null;

    const allDates = getDateRange(dateRange.start, dateRange.end);
    const totalDays = allDates.length;
    const today = new Date().toISOString().split('T')[0];

    // Lookup daily data
    const dataMap = {};
    (stats.dailyBreakdown || []).forEach(d => { dataMap[d.date] = d; });

    // Anchor index — last day ≤ today in the range
    let anchorIdx = -1;
    allDates.forEach((date, idx) => {
      if (date <= today) anchorIdx = idx;
    });
    if (anchorIdx === -1) anchorIdx = 0;

    // --- Build cumulative actual data for Calls and ALP ---
    const cumCalls = [];
    const cumAlp = [];

    let running = { calls: 0, appts: 0, sits: 0, sales: 0, alp: 0 };
    allDates.forEach((date, idx) => {
      const day = dataMap[date];
      if (day) {
        running.calls += day.calls || 0;
        running.appts += day.appts || 0;
        running.sits  += day.sits || 0;
        running.sales += day.sales || 0;
        running.alp   += day.alp || 0;
      }
      cumCalls.push(idx <= anchorIdx ? running.calls : null);
      cumAlp.push(idx <= anchorIdx ? running.alp : null);
    });

    // --- Funnel-based projection (uses all metrics internally) ---
    const rates = stats.prevPeriodRates || {};
    const hasPrevData = rates.callToAppt > 0 || rates.apptToSit > 0;

    const daysElapsed = anchorIdx + 1;
    const dailyCallPace = daysElapsed > 0 ? running.calls / daysElapsed : 0;

    // Projected end-of-period totals via funnel
    const projEndCalls = dailyCallPace * totalDays;
    const projEndAppts = hasPrevData ? projEndCalls * rates.callToAppt : (daysElapsed > 0 ? (running.appts / daysElapsed) * totalDays : 0);
    const projEndSits  = hasPrevData ? projEndAppts * rates.apptToSit : (daysElapsed > 0 ? (running.sits / daysElapsed) * totalDays : 0);
    const projEndSales = hasPrevData ? projEndSits * rates.sitToSale : (daysElapsed > 0 ? (running.sales / daysElapsed) * totalDays : 0);
    const projEndAlp   = hasPrevData ? projEndSales * rates.alpPerSale : (daysElapsed > 0 ? (running.alp / daysElapsed) * totalDays : 0);

    const projectedTotals = {
      calls: Math.round(projEndCalls),
      appts: Math.round(projEndAppts),
      sits:  Math.round(projEndSits),
      sales: Math.round(projEndSales),
      alp:   projEndAlp,
    };

    // Build projection lines for Calls and ALP only
    const projCalls = [];
    const projAlp = [];
    const remainingDays = totalDays - daysElapsed;

    allDates.forEach((_date, idx) => {
      if (idx < anchorIdx) {
        projCalls.push(null);
        projAlp.push(null);
      } else if (idx === anchorIdx) {
        projCalls.push(running.calls);
        projAlp.push(running.alp);
      } else {
        const progress = remainingDays > 0 ? (idx - anchorIdx) / remainingDays : 1;
        projCalls.push(Math.round(running.calls + (projectedTotals.calls - running.calls) * progress));
        projAlp.push(Math.round(running.alp + (projectedTotals.alp - running.alp) * progress));
      }
    });

    const labels = allDates.map(d => formatLabel(d, totalDays));

    // Chart datasets — Calls (left axis) + ALP (right axis), each with solid + dashed
    const datasets = [
      {
        label: 'Calls',
        data: cumCalls,
        borderColor: CALLS_COLOR.line,
        backgroundColor: CALLS_COLOR.bg,
        borderWidth: 2,
        pointRadius: totalDays > 60 ? 0 : 2,
        pointHoverRadius: 4,
        fill: false,
        tension: 0.3,
        spanGaps: false,
        yAxisID: 'yCalls',
      },
      {
        label: 'Calls (projected)',
        data: projCalls,
        borderColor: CALLS_COLOR.line,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        spanGaps: false,
        yAxisID: 'yCalls',
      },
      {
        label: 'ALP',
        data: cumAlp,
        borderColor: ALP_COLOR.line,
        backgroundColor: ALP_COLOR.bg,
        borderWidth: 2,
        pointRadius: totalDays > 60 ? 0 : 2,
        pointHoverRadius: 4,
        fill: false,
        tension: 0.3,
        spanGaps: false,
        yAxisID: 'yAlp',
      },
      {
        label: 'ALP (projected)',
        data: projAlp,
        borderColor: ALP_COLOR.line,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        spanGaps: false,
        yAxisID: 'yAlp',
      },
    ];

    return { labels, datasets, projectedTotals, hasPrevData, daysElapsed, totalDays };
  }, [stats?.dailyBreakdown, stats?.prevPeriodRates, dateRange]);

  const renderToggleTitle = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {(onPrevView || onToggleView) && (
        <button
          onClick={onPrevView || onToggleView}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted-foreground)', padding: '2px',
            borderRadius: '4px', transition: 'all 0.15s ease',
          }}
          title="Previous view"
        >
          <FiChevronLeft size={16} />
        </button>
      )}
      <CardTitle>Activity Trend</CardTitle>
      {onToggleView && (
        <button
          onClick={onToggleView}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted-foreground)', padding: '2px',
            borderRadius: '4px', transition: 'all 0.15s ease',
          }}
          title={toggleLabel || 'Next view'}
        >
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

  if (!chartData) {
    return (
      <Card className="bg-card border-border" style={{ height: '100%' }}>
        <CardHeader>{renderToggleTitle()}</CardHeader>
        <CardContent style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 140 }}>
          <p style={{ color: 'var(--muted-foreground)' }}>No data available for this period.</p>
        </CardContent>
      </Card>
    );
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { size: 11 },
          filter: (item) => !item.text.includes('(projected)'),
        },
      },
      tooltip: {
        callbacks: {
          title: (items) => items[0]?.label || '',
          label: (ctx) => {
            if (ctx.dataset.label.includes('(projected)')) return null;
            if (ctx.dataset.yAxisID === 'yAlp') {
              return `ALP: ${formatCurrency(ctx.parsed.y)}`;
            }
            return `${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() ?? '—'}`;
          },
        },
        filter: (item) => item.raw !== null,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 15 },
      },
      yCalls: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { font: { size: 10 }, color: CALLS_COLOR.line },
        title: { display: true, text: 'Calls', font: { size: 10 }, color: CALLS_COLOR.line },
      },
      yAlp: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        ticks: {
          font: { size: 10 },
          color: ALP_COLOR.line,
          callback: (val) => formatCurrency(val),
        },
        title: { display: true, text: 'ALP', font: { size: 10 }, color: ALP_COLOR.line },
      },
    },
  };

  const { projectedTotals, hasPrevData } = chartData;
  const endDateLabel = dateRange?.end ? formatEndDate(dateRange.end) : '';

  return (
    <Card className="bg-card border-border" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader style={{ paddingBottom: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {(onPrevView || onToggleView) && (
              <button
                onClick={onPrevView || onToggleView}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted-foreground)', padding: '2px',
                  borderRadius: '4px', transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--foreground)'; e.currentTarget.style.backgroundColor = 'var(--accent, rgba(0,0,0,0.05))'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                title="Previous view"
              >
                <FiChevronLeft size={16} />
              </button>
            )}
            <CardTitle className="text-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiTrendingUp size={18} />
              Activity Trend
            </CardTitle>
            {onToggleView && (
              <button
                onClick={onToggleView}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted-foreground)', padding: '2px',
                  borderRadius: '4px', transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--foreground)'; e.currentTarget.style.backgroundColor = 'var(--accent, rgba(0,0,0,0.05))'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                title={toggleLabel || 'Next view'}
              >
                <FiChevronRight size={16} />
              </button>
            )}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
            Projected by {endDateLabel}
          </span>
        </div>
        {/* Projected funnel numbers */}
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--muted-foreground)', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.35rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: CALLS_COLOR.line, display: 'inline-block' }} />
            <strong style={{ color: 'var(--foreground)' }}>{projectedTotals.calls?.toLocaleString()}</strong>
            <span>calls</span>
          </span>
          <span style={{ color: 'var(--border-color, #ccc)' }}>→</span>
          <span>
            <strong style={{ color: 'var(--foreground)' }}>{projectedTotals.appts?.toLocaleString()}</strong>
            <span> appts</span>
          </span>
          <span style={{ color: 'var(--border-color, #ccc)' }}>→</span>
          <span>
            <strong style={{ color: 'var(--foreground)' }}>{projectedTotals.sits?.toLocaleString()}</strong>
            <span> sits</span>
          </span>
          <span style={{ color: 'var(--border-color, #ccc)' }}>→</span>
          <span>
            <strong style={{ color: 'var(--foreground)' }}>{projectedTotals.sales?.toLocaleString()}</strong>
            <span> sales</span>
          </span>
          <span style={{ color: 'var(--border-color, #ccc)' }}>→</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: ALP_COLOR.line, display: 'inline-block' }} />
            <strong style={{ color: 'var(--foreground)' }}>{formatCurrency(projectedTotals.alp)}</strong>
            <span>ALP</span>
          </span>
        </div>
        {hasPrevData && (
          <p style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', margin: '0.2rem 0 0', fontStyle: 'italic' }}>
            Based on last period's conversion rates
          </p>
        )}
      </CardHeader>
      <CardContent style={{ flex: 1, minHeight: 0, padding: '0 1rem 1rem' }}>
        <div style={{ height: '100%', minHeight: 160 }}>
          <Line data={{ labels: chartData.labels, datasets: chartData.datasets }} options={options} />
        </div>
      </CardContent>
      <ViewDots count={viewCount} activeIndex={viewIndex} />
    </Card>
  );
};

export default ActivityTrendWidget;
