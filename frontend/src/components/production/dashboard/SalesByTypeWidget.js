/**
 * Sales By Lead Type Widget
 *
 * Doughnut chart showing the breakdown of discord sales by lead_type
 * for the selected time period, scoped to the user's hierarchy.
 */

import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import ViewDots from './ViewDots';

ChartJS.register(ArcElement, Tooltip, Legend);

/* Hide scrollbar in the legend list while keeping scroll functionality */
const hideScrollbarCSS = `
  .sales-type-legend::-webkit-scrollbar { display: none; }
`;
if (typeof document !== 'undefined' && !document.getElementById('sales-type-legend-style')) {
  const style = document.createElement('style');
  style.id = 'sales-type-legend-style';
  style.textContent = hideScrollbarCSS;
  document.head.appendChild(style);
}

/** Palette: pulled from existing chart colours used elsewhere in the app */
const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#a855f7', // violet
  '#84cc16', // lime
];

const fmtCur = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const formatLeadType = (lt) =>
  lt.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

const SalesByTypeWidget = ({ stats, loading, onToggleView, onPrevView, toggleLabel, viewIndex, viewCount }) => {
  const breakdown = stats.leadTypeBreakdown || [];
  const totalSales = useMemo(() => breakdown.reduce((s, b) => s + b.count, 0), [breakdown]);
  const totalAlp = useMemo(() => breakdown.reduce((s, b) => s + b.alp, 0), [breakdown]);

  const chartData = useMemo(() => {
    if (breakdown.length === 0) return null;
    return {
      labels: breakdown.map((b) => formatLeadType(b.type)),
      datasets: [
        {
          data: breakdown.map((b) => b.count),
          backgroundColor: breakdown.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
          borderWidth: 2,
          borderColor: 'var(--card-bg, #fff)',
          hoverOffset: 6,
        },
      ],
    };
  }, [breakdown]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = breakdown[ctx.dataIndex];
              const pct = totalSales > 0 ? ((item.count / totalSales) * 100).toFixed(0) : 0;
              return ` ${item.count} sale${item.count !== 1 ? 's' : ''} (${pct}%) · ${fmtCur(item.alp)} ALP`;
            },
          },
        },
      },
    }),
    [breakdown, totalSales],
  );

  if (loading) {
    return (
      <Card className="bg-card border-border" style={{ height: '100%' }}>
        <CardContent>
          <div className="activity-snapshot-summary loading" style={{ padding: '1rem' }}>
            <div className="loading-spinner"></div>
            <p>Loading sales data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader style={{ paddingBottom: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onPrevView || onToggleView}
            title="Previous view"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', borderRadius: 4, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', transition: 'color 0.15s, background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--foreground)'; e.currentTarget.style.background = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.background = 'none'; }}
          >
            <FiChevronLeft size={16} />
          </button>
          <CardTitle className="text-lg">Sales by Lead Type</CardTitle>
          {onToggleView && (
            <button
              onClick={onToggleView}
              title={toggleLabel || 'Next view'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', borderRadius: 4, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', transition: 'color 0.15s, background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--foreground)'; e.currentTarget.style.background = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.background = 'none'; }}
            >
              <FiChevronRight size={16} />
            </button>
          )}
        </div>
        {totalSales > 0 && (
          <p className="text-xs text-muted-foreground" style={{ marginTop: 2 }}>
            {totalSales} sale{totalSales !== 1 ? 's' : ''} · {fmtCur(totalAlp)} ALP
          </p>
        )}
      </CardHeader>

      <CardContent style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {breakdown.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-secondary, #999)', fontSize: 13 }}>
            No discord sales in this period
          </div>
        ) : (
          <>
            {/* Chart */}
            <div style={{ position: 'relative', flex: '1 1 0', minHeight: 0 }}>
              <Doughnut data={chartData} options={chartOptions} />
            </div>

            {/* Legend / breakdown list */}
            <div className="sales-type-legend" style={{ overflowY: 'auto', maxHeight: 120, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {breakdown.map((item, i) => {
                const pct = totalSales > 0 ? ((item.count / totalSales) * 100).toFixed(0) : 0;
                return (
                  <div
                    key={item.type}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '3px 0',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {formatLeadType(item.type)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, color: 'var(--text-secondary, #666)' }}>
                      <span>{item.count}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmtCur(item.alp)}</span>
                      <span style={{ color: 'var(--text-secondary)', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
      <ViewDots count={viewCount} activeIndex={viewIndex} />
    </Card>
  );
};

export default SalesByTypeWidget;
