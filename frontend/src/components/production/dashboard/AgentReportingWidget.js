/**
 * Agent Reporting Widget
 * 
 * Shows agent reporting counts for the selected period, yesterday, and today.
 * Each row shows X/Y agents reported with a progress bar.
 * Designed to be used as a standalone grid widget.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { FiCalendar, FiClock, FiSun } from 'react-icons/fi';
import './ActivitySnapshotSummary.css';

const ReportingRow = ({ icon: Icon, label, reported, total, color }) => {
  const pct = total > 0 ? Math.round((reported / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <Icon size={14} style={{ color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>{label}</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
            {reported}<span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>/{total}</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color, marginLeft: 6 }}>{pct}%</span>
          </span>
        </div>
        <div style={{ width: '100%', height: 5, background: 'var(--border-color, #e9ecef)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 999,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    </div>
  );
};

const AgentReportingWidget = ({ stats, loading }) => {
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

  const total = stats.totalAgents || 0;
  const period = stats.reportedAgents || 0;
  const yesterday = stats.reportedAgentsYesterday || 0;
  const today = stats.reportedAgentsToday || 0;

  return (
    <Card className="bg-card border-border" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader>
        <CardTitle className="text-lg">Agent Reporting</CardTitle>
      </CardHeader>
      <CardContent style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.85rem' }}>
        <ReportingRow icon={FiCalendar} label="Period" reported={period} total={total} color="#3b82f6" />
        <ReportingRow icon={FiClock} label="Yesterday" reported={yesterday} total={total} color="#8b5cf6" />
        <ReportingRow icon={FiSun} label="Today" reported={today} total={total} color="#10b981" />
      </CardContent>
    </Card>
  );
};

export default AgentReportingWidget;
