/**
 * Activity Totals Widget — Pipeline View
 *
 * Shows the sales funnel: Calls → Appts → Sits → Sales → ALP
 * Each conversion insight card is color-coded against agency baselines.
 * Bad metrics turn red with a hover tooltip showing coaching tips
 * and the potential ALP if that metric hit the "good" baseline.
 */

import React from 'react';
import { FiPhone, FiCalendar, FiUsers, FiAward, FiDollarSign, FiArrowRight, FiUserPlus, FiAlertCircle } from 'react-icons/fi';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { evaluate, BASELINES } from './baselines';
import './ActivitySnapshotSummary.css';

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const formatNumber = (v) =>
  new Intl.NumberFormat('en-US').format(v);

const formatPct = (v) => {
  if (!v || !isFinite(v)) return '0%';
  return `${v.toFixed(1)}%`;
};

const formatRatio = (v) => {
  if (!v || !isFinite(v)) return '—';
  return v.toFixed(1);
};

const ActivityTotalsWidget = ({ stats, loading }) => {
  if (loading) {
    return (
      <Card className="bg-card border-border" style={{ height: '100%' }}>
        <CardContent>
          <div className="activity-snapshot-summary loading" style={{ padding: '1rem' }}>
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { calls, appts, sits, sales, alp, refs, officialAlp = 0 } = stats.totals;

  // Current ratios
  const callsPerAppt  = appts > 0 ? calls / appts : 0;
  const showRate      = appts > 0 ? (sits / appts) * 100 : 0;
  const closeRate     = sits  > 0 ? (sales / sits) * 100 : 0;
  const alpPerSale    = sales > 0 ? alp / sales : 0;
  const refsPerSit    = sits  > 0 ? refs / sits : 0;

  // Evaluate each metric
  const evals = {
    callsPerAppt: evaluate('callsPerAppt', callsPerAppt),
    showRate:     evaluate('showRate', showRate),
    closeRate:    evaluate('closeRate', closeRate),
    alpPerSale:   evaluate('alpPerSale', alpPerSale),
    refsPerSit:   evaluate('refsPerSit', refsPerSit),
  };

  // ——— Potential ALP calculations ———
  // For each metric, compute the ALP the team/agent would generate
  // if THAT metric was at the "good" baseline (everything else stays the same).
  const computePotentialAlp = (key) => {
    // Current funnel values
    const curCallsPerAppt = callsPerAppt || Infinity;
    const curShowRate     = showRate / 100 || 0;
    const curCloseRate    = closeRate / 100 || 0;
    const curAlpPerSale   = alpPerSale || 0;

    let projAppts, projSits, projSales, projAlp;

    switch (key) {
      case 'callsPerAppt':
        // If we hit 80 calls/appt instead of current, more appts from same calls
        projAppts = calls / BASELINES.callsPerAppt.good;
        projSits  = projAppts * curShowRate;
        projSales = projSits * curCloseRate;
        projAlp   = projSales * curAlpPerSale;
        break;
      case 'showRate':
        // If show rate hits 33%, more sits from same appts
        projSits  = appts * (BASELINES.showRate.good / 100);
        projSales = projSits * curCloseRate;
        projAlp   = projSales * curAlpPerSale;
        break;
      case 'closeRate':
        // If close rate hits 45%, more sales from same sits
        projSales = sits * (BASELINES.closeRate.good / 100);
        projAlp   = projSales * curAlpPerSale;
        break;
      case 'alpPerSale':
        // If ALP/sale hits $1,200, more ALP from same sales
        projAlp = sales * BASELINES.alpPerSale.good;
        break;
      case 'refsPerSit':
        // Refs don't directly affect ALP — return null
        return null;
      default:
        return null;
    }
    return projAlp;
  };

  // Pipeline arrow config — first arrow shows calls/appt ratio, rest show %
  const getArrowColor = (idx) => {
    if (idx === 0) return evals.callsPerAppt.color;
    if (idx === 1) return evals.showRate.color;
    if (idx === 2) return evals.closeRate.color;
    return 'var(--muted-foreground)';
  };

  const stages = [
    { key: 'calls', label: 'Calls', value: calls, Icon: FiPhone },
    { key: 'appts', label: 'Appts', value: appts, Icon: FiCalendar },
    { key: 'sits',  label: 'Sits',  value: sits,  Icon: FiUsers },
    { key: 'sales', label: 'Sales', value: sales,  Icon: FiAward },
  ];

  const arrows = [
    { display: appts > 0 ? `${Math.round(callsPerAppt)}:1` : '—', hint: `${formatRatio(callsPerAppt)} calls per appointment`, idx: 0 },
    { display: formatPct(showRate), hint: `${formatPct(showRate)} show rate (sits / appts)`, idx: 1 },
    { display: formatPct(closeRate), hint: `${formatPct(closeRate)} close rate (sales / sits)`, idx: 2 },
  ];

  // Insight card configs
  const insights = [
    {
      key: 'callsPerAppt',
      Icon: FiPhone,
      label: 'Calls / Appt',
      value: appts > 0 ? Math.round(callsPerAppt).toString() : '—',
      eval: evals.callsPerAppt,
      target: `≤${BASELINES.callsPerAppt.good}`,
      hasData: appts > 0,
    },
    {
      key: 'showRate',
      Icon: FiCalendar,
      label: 'Show Rate',
      value: formatPct(showRate),
      eval: evals.showRate,
      target: `≥${BASELINES.showRate.good}%`,
      hasData: appts > 0,
    },
    {
      key: 'closeRate',
      Icon: FiAward,
      label: 'Close Rate',
      value: formatPct(closeRate),
      eval: evals.closeRate,
      target: `≥${BASELINES.closeRate.good}%`,
      hasData: sits > 0,
    },
    {
      key: 'alpPerSale',
      Icon: FiDollarSign,
      label: 'ALP / Sale',
      value: sales > 0 ? formatCurrency(alpPerSale) : '—',
      eval: evals.alpPerSale,
      target: `≥${formatCurrency(BASELINES.alpPerSale.good)}`,
      hasData: sales > 0,
    },
    {
      key: 'refsPerSit',
      Icon: FiUserPlus,
      label: 'Refs / Sit',
      value: sits > 0 ? formatRatio(refsPerSit) : '—',
      eval: evals.refsPerSit,
      target: `≥${BASELINES.refsPerSit.good}`,
      hasData: sits > 0,
    },
  ];

  return (
    <Card className="bg-card border-border" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader style={{ paddingBottom: '0.5rem' }}>
        <CardTitle className="text-lg">Activity Pipeline</CardTitle>
      </CardHeader>
      <CardContent style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

        {/* Pipeline Funnel */}
        <div className="pipeline-funnel">
          {stages.map((stage, i) => (
            <React.Fragment key={stage.key}>
              <div className="pipeline-stage">
                <stage.Icon className="pipeline-stage-icon" />
                <span className="pipeline-stage-value">{formatNumber(stage.value)}</span>
                <span className="pipeline-stage-label">{stage.label}</span>
              </div>
              {i < stages.length - 1 && (
                <div className="pipeline-arrow" title={arrows[i].hint}>
                  <FiArrowRight className="pipeline-arrow-icon" />
                  <span className="pipeline-arrow-rate" style={{ color: getArrowColor(i) }}>
                    {arrows[i].display}
                  </span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Conversion Insight Cards */}
        <div className="pipeline-insights">
          {insights.map(ins => {
            const isBad = ins.hasData && ins.eval.status === 'bad';
            const isDecent = ins.hasData && ins.eval.status === 'decent';
            const potentialAlp = ins.hasData && ins.eval.status !== 'good' ? computePotentialAlp(ins.key) : null;
            const alpDelta = potentialAlp != null ? potentialAlp - alp : null;

            return (
              <div
                key={ins.key}
                className="pipeline-insight-item"
                style={{
                  borderColor: isBad ? 'var(--destructive, #ef4444)' : isDecent ? 'var(--warning, #f59e0b)' : undefined,
                  background: isBad ? 'rgba(239, 68, 68, 0.06)' : undefined,
                  position: 'relative',
                }}
              >
                <div className="pipeline-insight-header">
                  <ins.Icon size={13} />
                  <span>{ins.label}</span>
                  {isBad && <FiAlertCircle size={11} style={{ color: 'var(--destructive, #ef4444)', marginLeft: 2 }} />}
                </div>
                <div className="pipeline-insight-value" style={{ color: ins.hasData ? ins.eval.color : undefined }}>
                  {ins.value}
                </div>
                <div style={{ fontSize: '0.55rem', color: 'var(--muted-foreground)', marginTop: '0.1rem' }}>
                  Target: {ins.target}
                </div>
                {/* Potential ALP if this metric hits good */}
                {alpDelta != null && alpDelta > 0 && (
                  <div style={{ fontSize: '0.55rem', color: 'var(--success, #10b981)', fontWeight: 600, marginTop: '0.15rem' }}>
                    +{formatCurrency(alpDelta)} ALP potential
                  </div>
                )}

                {/* Hover context menu with coaching tips — reuses .context-menu / .menu-item from ContextMenu.css */}
                {ins.eval.tips.length > 0 && (
                  <div className="pipeline-context-menu">
                    <div className="context-menu">
                      <div className="menu-item pipeline-tip-title">Why this may be low</div>
                      {ins.eval.tips.map((tip, i) => (
                        <div key={i} className="menu-item pipeline-tip-item">
                          <span className="menu-icon">•</span>
                          <span>{tip}</span>
                        </div>
                      ))}
                      {alpDelta != null && alpDelta > 0 && (
                        <div className="menu-item pipeline-alp-item">
                          Hitting {ins.target} → +{formatCurrency(alpDelta)} ALP
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Summary */}
        <div className="pipeline-summary">
          <div className="pipeline-summary-item">
            <FiDollarSign size={14} />
            <span className="pipeline-summary-label">Total ALP</span>
            <span className="pipeline-summary-value">{formatCurrency(alp)}</span>
          </div>
          <div className="pipeline-summary-divider" />
          <div className="pipeline-summary-item">
            <FiUserPlus size={14} />
            <span className="pipeline-summary-label">Total Refs</span>
            <span className="pipeline-summary-value">{formatNumber(refs)}</span>
          </div>
          <div className="pipeline-summary-divider" />
          <div className="pipeline-summary-item">
            <FiDollarSign size={14} />
            <span className="pipeline-summary-label">Official ALP</span>
            <span className="pipeline-summary-value">{formatCurrency(officialAlp)}</span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default ActivityTotalsWidget;
