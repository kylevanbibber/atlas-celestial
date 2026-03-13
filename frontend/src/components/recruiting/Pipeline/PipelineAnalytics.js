import React, { useState, useEffect, useMemo } from 'react';
import { FiUsers, FiClock, FiCheckCircle, FiChevronDown, FiTrendingUp, FiTrendingDown, FiAlertTriangle } from 'react-icons/fi';
import api from '../../../api';
import './PipelineAnalytics.css';

const formatDuration = (hours) => {
  if (!hours || hours <= 0) return '\u2014';
  const days = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  if (days === 0) return `${h}h`;
  if (h === 0) return `${days}d`;
  return `${days}d ${h}h`;
};

const APPLICANT_STEPS = [
  { stage_name: 'Careers Form', stage_color: '#3498db' },
  { stage_name: 'No Answer - Career Form', stage_color: '#95a5a6' },
  { stage_name: 'Callback - Career Form', stage_color: '#f39c12' },
  { stage_name: 'Final', stage_color: '#27ae60' },
  { stage_name: 'Not Interested', stage_color: '#e74c3c' },
];

const APPLICANT_STEP_NAMES = new Set(APPLICANT_STEPS.map(s => s.stage_name));

const PipelineAnalytics = ({ stages, showTeam, getUserIds }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [expandedManagers, setExpandedManagers] = useState({});

  useEffect(() => {
    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const userIds = getUserIds();
        const params = userIds && userIds.length > 0 ? { userIds: userIds.join(',') } : {};
        const response = await api.get('/recruitment/analytics', { params });
        if (response.data.success) {
          setAnalyticsData(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching pipeline analytics:', error);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    fetchAnalytics();
  }, [showTeam, getUserIds]);

  // Build combined order: applicant steps first, then pipeline stages
  const allStepsOrdered = useMemo(() => {
    return [...APPLICANT_STEPS, ...(stages || []).map(s => ({ stage_name: s.stage_name, stage_color: s.stage_color }))];
  }, [stages]);

  // Order stage metrics by the combined order
  const orderedStageMetrics = useMemo(() => {
    if (!analyticsData?.stageMetrics) return [];
    const metricMap = {};
    analyticsData.stageMetrics.forEach(m => { metricMap[m.stage_name] = m; });

    return allStepsOrdered
      .filter(s => metricMap[s.stage_name])
      .map(s => ({
        ...metricMap[s.stage_name],
        stage_color: s.stage_color,
        isApplicantStep: APPLICANT_STEP_NAMES.has(s.stage_name)
      }));
  }, [analyticsData, allStepsOrdered]);

  const maxAvgHours = useMemo(() => {
    if (!orderedStageMetrics.length) return 1;
    return Math.max(...orderedStageMetrics.map(m => m.avg_hours_inclusive || m.avg_hours || 0), 1);
  }, [orderedStageMetrics]);

  // Order funnel data by combined order
  const orderedFunnel = useMemo(() => {
    if (!analyticsData?.bottlenecks?.funnel) return [];
    const funnelMap = {};
    analyticsData.bottlenecks.funnel.forEach(f => { funnelMap[f.stage_name] = f; });
    return allStepsOrdered
      .filter(s => funnelMap[s.stage_name])
      .map(s => ({
        ...funnelMap[s.stage_name],
        stage_color: s.stage_color
      }));
  }, [analyticsData, allStepsOrdered]);

  const maxFunnelEntered = useMemo(() => {
    if (!orderedFunnel.length) return 1;
    return Math.max(...orderedFunnel.map(f => f.entered), 1);
  }, [orderedFunnel]);

  // Order bottleneck data by combined order, filter to only stages with stalled recruits
  const orderedBottlenecks = useMemo(() => {
    if (!analyticsData?.bottlenecks?.stalledByStage) return [];
    const bnMap = {};
    analyticsData.bottlenecks.stalledByStage.forEach(b => { bnMap[b.stage_name] = b; });
    return allStepsOrdered
      .filter(s => bnMap[s.stage_name] && bnMap[s.stage_name].stalled_14d > 0)
      .map(s => ({
        ...bnMap[s.stage_name],
        stage_color: s.stage_color
      }));
  }, [analyticsData, allStepsOrdered]);

  const toggleManager = (id) => {
    setExpandedManagers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (analyticsLoading) {
    return (
      <div className="pipeline-analytics">
        <div className="analytics-loading">
          <div className="analytics-loading-spinner"></div>
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="pipeline-analytics">
        <div className="analytics-empty">
          <h3>No analytics data available</h3>
          <p>Analytics will appear once recruits have stage history.</p>
        </div>
      </div>
    );
  }

  const { overallMetrics, managerBreakdown, bottlenecks } = analyticsData;
  const completionRate = overallMetrics.total_recruits > 0
    ? Math.round((overallMetrics.completed_recruits / overallMetrics.total_recruits) * 100)
    : 0;
  const totalStalled = (bottlenecks?.stalledByStage || []).reduce((sum, s) => sum + (s.stalled_14d || 0), 0);

  // Sort managers by recruit count descending
  const sortedManagers = Object.entries(managerBreakdown || {})
    .filter(([, data]) => data.manager_name)
    .sort((a, b) => b[1].total_recruits - a[1].total_recruits);

  return (
    <div className="pipeline-analytics">
      {/* Summary Cards */}
      <div className="analytics-summary-cards">
        <div className="analytics-summary-card">
          <div className="analytics-card-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <FiUsers size={22} />
          </div>
          <div className="analytics-card-content">
            <div className="analytics-card-label">Total Recruits</div>
            <div className="analytics-card-value">{overallMetrics.total_recruits}</div>
            <div className="analytics-card-sub">{overallMetrics.completed_recruits} completed</div>
          </div>
        </div>

        <div className="analytics-summary-card">
          <div className="analytics-card-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <FiClock size={22} />
          </div>
          <div className="analytics-card-content">
            <div className="analytics-card-label">Avg Pipeline Duration</div>
            <div className="analytics-card-value">{formatDuration(overallMetrics.avg_completed_hours)}</div>
            <div className="analytics-card-sub">completed recruits only</div>
          </div>
        </div>

        <div className="analytics-summary-card">
          <div className="analytics-card-icon" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
            <FiCheckCircle size={22} />
          </div>
          <div className="analytics-card-content">
            <div className="analytics-card-label">Completion Rate</div>
            <div className="analytics-card-value">{completionRate}%</div>
            <div className="analytics-card-sub">{overallMetrics.completed_recruits} of {overallMetrics.total_recruits}</div>
          </div>
        </div>

        <div className="analytics-summary-card">
          <div className="analytics-card-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}>
            <FiAlertTriangle size={22} />
          </div>
          <div className="analytics-card-content">
            <div className="analytics-card-label">Stalled 14+ Days</div>
            <div className="analytics-card-value">{totalStalled}</div>
            <div className="analytics-card-sub">recruits stuck in stage</div>
          </div>
        </div>
      </div>

      {/* Stage Duration Bars */}
      <div className="analytics-section">
        <h2 className="analytics-section-title">
          Average Time per Step / Stage
          <span className="analytics-section-subtitle">including in-progress recruits</span>
        </h2>
        <div className="analytics-bar-chart">
          {orderedStageMetrics.length > 0 ? (() => {
            let shownApplicantLabel = false;
            let shownPipelineLabel = false;
            const hasApplicantData = orderedStageMetrics.some(m => m.isApplicantStep);
            return orderedStageMetrics.map(metric => {
              const hours = metric.avg_hours_inclusive || metric.avg_hours || 0;
              const pct = Math.max((hours / maxAvgHours) * 100, 5);
              const showApplicantLabel = metric.isApplicantStep && !shownApplicantLabel && hasApplicantData;
              const showPipelineLabel = !metric.isApplicantStep && !shownPipelineLabel;
              if (showApplicantLabel) shownApplicantLabel = true;
              if (showPipelineLabel) shownPipelineLabel = true;
              return (
                <React.Fragment key={metric.stage_name}>
                  {showApplicantLabel && (
                    <div className="analytics-bar-divider">
                      <span>Applicant Steps</span>
                    </div>
                  )}
                  {showPipelineLabel && (
                    <div className="analytics-bar-divider">
                      <span>Pipeline Stages</span>
                    </div>
                  )}
                  <div className="analytics-bar-row">
                    <div className="analytics-bar-label" title={metric.stage_name}>{metric.stage_name}</div>
                    <div className="analytics-bar-track">
                      <div
                        className="analytics-bar-fill"
                        style={{ width: `${pct}%`, background: metric.stage_color }}
                      >
                        <span className="analytics-bar-fill-text">{formatDuration(hours)}</span>
                      </div>
                    </div>
                    <div className="analytics-bar-meta">
                      <strong>{metric.total_count || metric.transition_count}</strong> recruits
                    </div>
                  </div>
                </React.Fragment>
              );
            });
          })() : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
              No stage transition data available yet.
            </p>
          )}
        </div>
      </div>

      {/* Drop-off Funnel */}
      {orderedFunnel.length > 0 && (
        <div className="analytics-section">
          <h2 className="analytics-section-title">
            Stage Funnel
            <span className="analytics-section-subtitle">where recruits drop off</span>
          </h2>
          <div className="analytics-funnel">
            {orderedFunnel.map((stage, idx) => {
              const pct = Math.max((stage.entered / maxFunnelEntered) * 100, 5);
              const nextStage = orderedFunnel[idx + 1];
              return (
                <React.Fragment key={stage.stage_name}>
                  <div className="analytics-funnel-row">
                    <div className="analytics-funnel-label" title={stage.stage_name}>{stage.stage_name}</div>
                    <div className="analytics-funnel-bar-wrap">
                      <div
                        className="analytics-funnel-bar"
                        style={{ width: `${pct}%`, background: stage.stage_color }}
                      >
                        <span>{stage.entered}</span>
                      </div>
                    </div>
                    <div className="analytics-funnel-meta">
                      {stage.drop_off > 0 && (
                        <span className="analytics-funnel-dropoff">
                          <FiTrendingDown size={12} />
                          {stage.drop_off} still here ({stage.drop_off_rate}%)
                        </span>
                      )}
                    </div>
                  </div>
                  {nextStage && stage.entered > nextStage.entered && (
                    <div className="analytics-funnel-connector">
                      <div className="analytics-funnel-connector-line">
                        {stage.entered - nextStage.entered} didn't advance
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottleneck Stages */}
      {orderedBottlenecks.length > 0 && (
        <div className="analytics-section">
          <h2 className="analytics-section-title">
            Bottleneck Stages
            <span className="analytics-section-subtitle">where agents get caught up</span>
          </h2>
          <div className="analytics-bottleneck-grid">
            {orderedBottlenecks.map(bn => {
              const severity = bn.stalled_30d > 0 ? 'high' : bn.stalled_14d >= 3 ? 'medium' : 'low';
              return (
                <div className={`analytics-bottleneck-card severity-${severity}`} key={bn.stage_name}>
                  <div className="analytics-bottleneck-stage">{bn.stage_name}</div>
                  <div className="analytics-bottleneck-stats">
                    <div className="analytics-bottleneck-stat">
                      <span className="analytics-bottleneck-stat-label">Active in stage</span>
                      <span className="analytics-bottleneck-stat-value">{bn.total_in_stage}</span>
                    </div>
                    <div className="analytics-bottleneck-stat">
                      <span className="analytics-bottleneck-stat-label">Stalled 14+ days</span>
                      <span className={`analytics-bottleneck-stat-value ${bn.stalled_14d >= 3 ? 'warn' : ''}`}>{bn.stalled_14d}</span>
                    </div>
                    <div className="analytics-bottleneck-stat">
                      <span className="analytics-bottleneck-stat-label">Stalled 30+ days</span>
                      <span className={`analytics-bottleneck-stat-value ${bn.stalled_30d > 0 ? 'danger' : ''}`}>{bn.stalled_30d}</span>
                    </div>
                    <div className="analytics-bottleneck-stat">
                      <span className="analytics-bottleneck-stat-label">Avg time in stage</span>
                      <span className="analytics-bottleneck-stat-value">{formatDuration(bn.avg_current_hours)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-Manager Breakdown */}
      {sortedManagers.length > 1 && (
        <div className="analytics-section">
          <h2 className="analytics-section-title">Per-Manager Breakdown</h2>
          <div className="analytics-manager-list">
            {sortedManagers.map(([agentId, data]) => {
              const isExpanded = expandedManagers[agentId];
              const managerMaxHours = Math.max(
                ...(data.stages || []).map(s => s.avg_hours || 0), 1
              );
              const diff = overallMetrics.avg_total_hours > 0
                ? ((data.avg_total_hours - overallMetrics.avg_total_hours) / overallMetrics.avg_total_hours) * 100
                : 0;
              const managerStalled = bottlenecks?.stalledByManager?.[agentId];

              // Order this manager's stages by combined order (applicant steps + pipeline stages)
              const mStageMap = {};
              (data.stages || []).forEach(s => { mStageMap[s.stage_name] = s; });
              const orderedMStages = allStepsOrdered
                .filter(s => mStageMap[s.stage_name])
                .map(s => ({
                  ...mStageMap[s.stage_name],
                  stage_color: s.stage_color
                }));

              return (
                <div className="analytics-manager-card" key={agentId}>
                  <div className="analytics-manager-header" onClick={() => toggleManager(agentId)}>
                    <div className="analytics-manager-info">
                      <span className="analytics-manager-name">{data.manager_name}</span>
                      <span className="analytics-role-badge">{data.clname || 'AGT'}</span>
                    </div>
                    <div className="analytics-manager-stats">
                      <div className="analytics-manager-stat">
                        <div className="analytics-manager-stat-value">{data.total_recruits}</div>
                        <div className="analytics-manager-stat-label">Recruits</div>
                      </div>
                      <div className="analytics-manager-stat">
                        <div className="analytics-manager-stat-value">{formatDuration(data.avg_total_hours)}</div>
                        <div className="analytics-manager-stat-label">Avg Duration</div>
                      </div>
                      {Math.abs(diff) >= 5 && (
                        <span className={`analytics-comparison ${diff < 0 ? 'faster' : 'slower'}`}>
                          {diff < 0 ? <FiTrendingDown size={12} /> : <FiTrendingUp size={12} />}
                          {Math.abs(Math.round(diff))}%
                        </span>
                      )}
                      {managerStalled && managerStalled.total_stalled > 0 && (
                        <span className="analytics-stalled-badge">
                          <FiAlertTriangle size={11} />
                          {managerStalled.total_stalled} stalled
                        </span>
                      )}
                    </div>
                    <FiChevronDown size={18} className={`analytics-manager-chevron ${isExpanded ? 'expanded' : ''}`} />
                  </div>
                  {isExpanded && (
                    <div className="analytics-manager-body">
                      {orderedMStages.length > 0 ? orderedMStages.map(s => {
                        const pct = Math.max((s.avg_hours / managerMaxHours) * 100, 5);
                        return (
                          <div className="analytics-bar-row" key={s.stage_name}>
                            <div className="analytics-bar-label" title={s.stage_name}>{s.stage_name}</div>
                            <div className="analytics-bar-track">
                              <div
                                className="analytics-bar-fill"
                                style={{ width: `${pct}%`, background: s.stage_color }}
                              >
                                <span className="analytics-bar-fill-text">{formatDuration(s.avg_hours)}</span>
                              </div>
                            </div>
                            <div className="analytics-bar-meta">
                              <strong>{s.transition_count}</strong> recruits
                            </div>
                          </div>
                        );
                      }) : (
                        <p style={{ color: 'var(--text-secondary)', padding: '12px 0', fontSize: '13px' }}>
                          No stage data for this manager.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineAnalytics;
