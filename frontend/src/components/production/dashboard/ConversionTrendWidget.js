/**
 * Conversion Trend Widget
 *
 * Shows cumulative conversion rates over the selected date range:
 *   - Show Rate (Sits / Appts %)
 *   - Close Rate (Sales / Sits %)
 *
 * Includes horizontal baseline reference lines for good/decent/bad thresholds.
 * Header badges are color-coded against agency baselines.
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
import { FiPercent, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import ViewDots from './ViewDots';
import { evaluate, BASELINES } from './baselines';

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

const formatLabel = (dateStr, totalDays) => {
  const d = new Date(dateStr + 'T00:00:00');
  if (totalDays > 90) return d.toLocaleDateString('en-US', { month: 'short' });
  if (totalDays > 31) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const RATE_COLORS = {
  showRate:  { line: 'rgb(245, 158, 11)',  bg: 'rgba(245, 158, 11, 0.06)' },  // amber
  closeRate: { line: 'rgb(16, 185, 129)',  bg: 'rgba(16, 185, 129, 0.06)' },  // green
};

const ConversionTrendWidget = ({ stats, loading, dateRange, onToggleView, onPrevView, toggleLabel, viewIndex, viewCount }) => {
  const chartData = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end || !stats?.dailyBreakdown) return null;

    const allDates = getDateRange(dateRange.start, dateRange.end);
    const totalDays = allDates.length;
    const today = new Date().toISOString().split('T')[0];

    const dataMap = {};
    (stats.dailyBreakdown || []).forEach(d => { dataMap[d.date] = d; });

    // Compute cumulative conversion rates per day
    let cumCalls = 0, cumAppts = 0, cumSits = 0, cumSales = 0;
    const sitRates = [];
    const closeRates = [];

    allDates.forEach(date => {
      const day = dataMap[date];
      if (day) {
        cumCalls += day.calls || 0;
        cumAppts += day.appts || 0;
        cumSits  += day.sits || 0;
        cumSales += day.sales || 0;
      }

      if (date > today) {
        sitRates.push(null);
        closeRates.push(null);
      } else {
        sitRates.push(cumAppts > 0 ? (cumSits / cumAppts) * 100 : null);
        closeRates.push(cumSits > 0 ? (cumSales / cumSits) * 100 : null);
      }
    });

    const labels = allDates.map(d => formatLabel(d, totalDays));

    // Current rates
    const currentShowRate = cumAppts > 0 ? (cumSits / cumAppts) * 100 : 0;
    const currentCloseRate = cumSits > 0 ? (cumSales / cumSits) * 100 : 0;
    const currentCallsPerAppt = cumAppts > 0 ? cumCalls / cumAppts : 0;
    const currentAlpPerSale = cumSales > 0 ? (stats.totals?.alp || 0) / cumSales : 0;
    const currentRefsPerSit = cumSits > 0 ? (stats.totals?.refs || 0) / cumSits : 0;

    // Baseline reference line datasets (horizontal lines across the full chart)
    const showRateGoodLine = new Array(totalDays).fill(BASELINES.showRate.good);
    const showRateDecentLine = new Array(totalDays).fill(BASELINES.showRate.decent);
    const closeRateGoodLine = new Array(totalDays).fill(BASELINES.closeRate.good);
    const closeRateDecentLine = new Array(totalDays).fill(BASELINES.closeRate.decent);

    return {
      labels,
      datasets: [
        // Show Rate actual
        {
          label: 'Show Rate',
          data: sitRates,
          borderColor: RATE_COLORS.showRate.line,
          backgroundColor: RATE_COLORS.showRate.bg,
          borderWidth: 2,
          pointRadius: totalDays > 60 ? 0 : 2,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.3,
          spanGaps: true,
        },
        // Close Rate actual
        {
          label: 'Close Rate',
          data: closeRates,
          borderColor: RATE_COLORS.closeRate.line,
          backgroundColor: RATE_COLORS.closeRate.bg,
          borderWidth: 2,
          pointRadius: totalDays > 60 ? 0 : 2,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.3,
          spanGaps: true,
        },
        // Baseline reference lines
        {
          label: `Show Rate Target (${BASELINES.showRate.good}%)`,
          data: showRateGoodLine,
          borderColor: 'rgba(245, 158, 11, 0.35)',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0,
        },
        {
          label: `Show Rate Min (${BASELINES.showRate.decent}%)`,
          data: showRateDecentLine,
          borderColor: 'rgba(245, 158, 11, 0.2)',
          borderWidth: 1,
          borderDash: [2, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0,
        },
        {
          label: `Close Rate Target (${BASELINES.closeRate.good}%)`,
          data: closeRateGoodLine,
          borderColor: 'rgba(16, 185, 129, 0.35)',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0,
        },
        {
          label: `Close Rate Min (${BASELINES.closeRate.decent}%)`,
          data: closeRateDecentLine,
          borderColor: 'rgba(16, 185, 129, 0.2)',
          borderWidth: 1,
          borderDash: [2, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
      currentRates: {
        showRate: currentShowRate,
        closeRate: currentCloseRate,
        callsPerAppt: currentCallsPerAppt,
        alpPerSale: currentAlpPerSale,
        refsPerSit: currentRefsPerSit,
      },
    };
  }, [stats?.dailyBreakdown, stats?.totals, dateRange]);

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
      <CardTitle>Conversion Trend</CardTitle>
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
          // Only show main rate lines in legend, not the baseline refs
          filter: (item) => !item.text.includes('Target') && !item.text.includes('Min'),
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.raw === null) return null;
            // Skip baseline line tooltips
            if (ctx.dataset.label.includes('Target') || ctx.dataset.label.includes('Min')) return null;
            return `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%`;
          },
        },
        filter: (item) => item.raw !== null && !item.dataset.label.includes('Target') && !item.dataset.label.includes('Min'),
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 15 },
      },
      y: {
        beginAtZero: true,
        max: 100,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { font: { size: 10 }, callback: (val) => `${val}%` },
      },
    },
  };

  const { currentRates } = chartData;

  // Evaluate each metric against baselines
  const showRateEval  = evaluate('showRate', currentRates.showRate);
  const closeRateEval = evaluate('closeRate', currentRates.closeRate);
  const callsPerApptEval = evaluate('callsPerAppt', currentRates.callsPerAppt);
  const alpPerSaleEval = evaluate('alpPerSale', currentRates.alpPerSale);
  const refsPerSitEval = evaluate('refsPerSit', currentRates.refsPerSit);

  const badgeStyle = (evalResult, value, suffix = '%') => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    color: evalResult.color,
  });

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
              <FiPercent size={18} />
              Conversion Trend
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
          {/* Current rate badges — color-coded against baselines */}
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem' }}>
            <span style={badgeStyle(callsPerApptEval)}>
              <strong>{currentRates.callsPerAppt > 0 ? currentRates.callsPerAppt.toFixed(0) : '—'}</strong>
              <span style={{ color: 'var(--muted-foreground)' }}>calls/appt</span>
            </span>
            <span style={badgeStyle(showRateEval)}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: RATE_COLORS.showRate.line, display: 'inline-block' }} />
              <strong>{currentRates.showRate > 0 ? currentRates.showRate.toFixed(1) : '—'}%</strong>
              <span style={{ color: 'var(--muted-foreground)' }}>show</span>
            </span>
            <span style={badgeStyle(closeRateEval)}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: RATE_COLORS.closeRate.line, display: 'inline-block' }} />
              <strong>{currentRates.closeRate > 0 ? currentRates.closeRate.toFixed(1) : '—'}%</strong>
              <span style={{ color: 'var(--muted-foreground)' }}>close</span>
            </span>
            <span style={badgeStyle(alpPerSaleEval)}>
              <strong>{currentRates.alpPerSale > 0 ? `$${Math.round(currentRates.alpPerSale).toLocaleString()}` : '—'}</strong>
              <span style={{ color: 'var(--muted-foreground)' }}>/sale</span>
            </span>
            <span style={badgeStyle(refsPerSitEval)}>
              <strong>{currentRates.refsPerSit > 0 ? currentRates.refsPerSit.toFixed(1) : '—'}</strong>
              <span style={{ color: 'var(--muted-foreground)' }}>refs/sit</span>
            </span>
          </div>
        </div>
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

export default ConversionTrendWidget;
