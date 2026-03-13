/**
 * Production Dashboard Component
 * 
 * Centralized dashboard for tracking daily activity, sales, and team performance.
 * Uses a simple CSS grid layout with standalone widget components
 * powered by the shared useActivityData hook.
 */

import React, { useState, useContext, useMemo, useCallback } from 'react';
import { useHeader } from '../../context/HeaderContext';
import { AuthContext } from '../../context/AuthContext';
import { formatLocalDate } from '../../utils/dateRangeUtils';
import DateRangeSelector from './DateRangeSelector';
import useActivityData from '../production/dashboard/useActivityData';
import AgentReportingWidget from '../production/dashboard/AgentReportingWidget';
import AgentMetricsWidget from '../production/dashboard/AgentMetricsWidget';
import ActivityTotalsWidget from '../production/dashboard/ActivityTotalsWidget';
import SalesByTypeWidget from '../production/dashboard/SalesByTypeWidget';
import RefTrackingWidget from '../production/dashboard/RefTrackingWidget';
import ActivityTrendWidget from '../production/dashboard/ActivityTrendWidget';
import ConversionTrendWidget from '../production/dashboard/ConversionTrendWidget';
import ActivityHeatmapWidget from '../production/dashboard/ActivityHeatmapWidget';
import VerificationSurveyWidget from '../production/dashboard/VerificationSurveyWidget';
import './ProductionDashboard.css';

const ProductionDashboard = () => {
  const { setHeaderContent } = useHeader();
  const { user } = useContext(AuthContext);
  const userRole = user?.clname?.toUpperCase();
  const isGlobalAdmin = userRole === 'SGA' || user?.teamRole === 'app' || user?.Role === 'Admin';

  // Date range state – default to full current month so the display reads "February 2026"
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  });
  const [viewMode, setViewMode] = useState('month');
  const [viewScope, setViewScope] = useState(() => {
    if (isGlobalAdmin) return 'team';
    if (['SA', 'GA', 'MGA'].includes(userRole)) return 'team';
    if (userRole === 'RGA') return 'mga';
    return 'personal';
  });

  // Shared data hook — single fetch for all widgets
  const { loading, stats, isTeamLevel, teamUserIds } = useActivityData({
    dateRange, viewScope, viewMode, userRole, user
  });

  const showTeamWidgets = useMemo(
    () => isTeamLevel && viewScope !== 'personal',
    [isTeamLevel, viewScope]
  );

  // Cycle through Activity Trend → Activity Heatmap → Conversion Trend
  const TREND_VIEWS = ['activity', 'heatmap', 'conversion'];
  const [trendView, setTrendView] = useState('activity');
  const handleNextTrend = useCallback(() => {
    setTrendView(prev => {
      const idx = TREND_VIEWS.indexOf(prev);
      return TREND_VIEWS[(idx + 1) % TREND_VIEWS.length];
    });
  }, []);
  const handlePrevTrend = useCallback(() => {
    setTrendView(prev => {
      const idx = TREND_VIEWS.indexOf(prev);
      return TREND_VIEWS[(idx - 1 + TREND_VIEWS.length) % TREND_VIEWS.length];
    });
  }, []);

  // Toggle between Sales by Lead Type ↔ Ref Tracking
  const SALES_VIEWS = ['leadType', 'refs'];
  const [salesView, setSalesView] = useState('leadType');
  const handleNextSales = useCallback(() => {
    setSalesView(prev => {
      const idx = SALES_VIEWS.indexOf(prev);
      return SALES_VIEWS[(idx + 1) % SALES_VIEWS.length];
    });
  }, []);
  const handlePrevSales = useCallback(() => {
    setSalesView(prev => {
      const idx = SALES_VIEWS.indexOf(prev);
      return SALES_VIEWS[(idx - 1 + SALES_VIEWS.length) % SALES_VIEWS.length];
    });
  }, []);

  // Header — date range selector
  React.useEffect(() => {
    setHeaderContent(
      <DateRangeSelector
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        viewScope={viewScope}
        onViewScopeChange={setViewScope}
        userRole={userRole}
        isGlobalAdmin={isGlobalAdmin}
      />
    );
    return () => setHeaderContent(null);
  }, [dateRange, viewMode, viewScope, userRole, isGlobalAdmin, setHeaderContent]);

  return (
    <div className="dashboard-container padded-content-sm">
      {/* Top Row: Reporting + Pipeline + Quick Actions */}
      <div className={`prod-grid-top ${showTeamWidgets ? 'prod-grid-top--team' : 'prod-grid-top--personal'}`}>
        {showTeamWidgets && (
          <div className="prod-widget">
            <AgentReportingWidget stats={stats} loading={loading} />
          </div>
        )}
        <div className="prod-widget">
          <ActivityTotalsWidget stats={stats} loading={loading} />
        </div>
        <div className="prod-widget">
          {salesView === 'leadType' && (
            <SalesByTypeWidget
              stats={stats}
              loading={loading}
              onToggleView={handleNextSales}
              onPrevView={handlePrevSales}
              toggleLabel="Ref Tracking"
              viewIndex={0}
              viewCount={SALES_VIEWS.length}
            />
          )}
          {salesView === 'refs' && (
            <RefTrackingWidget
              viewScope={viewScope}
              userRole={userRole}
              teamUserIds={teamUserIds}
              dateRange={dateRange}
              userId={user?.userId}
              parentLoading={loading}
              onToggleView={handleNextSales}
              onPrevView={handlePrevSales}
              toggleLabel="Sales by Lead Type"
              viewIndex={1}
              viewCount={SALES_VIEWS.length}
            />
          )}
        </div>
      </div>

      {/* Trend Row: Activity/Conversion Toggle + Verification Survey */}
      <div className="prod-grid-trends">
        <div className="prod-widget">
          {trendView === 'activity' && (
            <ActivityTrendWidget
              stats={stats}
              loading={loading}
              dateRange={dateRange}
              onToggleView={handleNextTrend}
              onPrevView={handlePrevTrend}
              toggleLabel="Activity Heatmap"
              viewIndex={0}
              viewCount={TREND_VIEWS.length}
            />
          )}
          {trendView === 'heatmap' && (
            <ActivityHeatmapWidget
              stats={stats}
              loading={loading}
              dateRange={dateRange}
              viewScope={viewScope}
              userRole={userRole}
              onToggleView={handleNextTrend}
              onPrevView={handlePrevTrend}
              toggleLabel="Conversion Trend"
              viewIndex={1}
              viewCount={TREND_VIEWS.length}
            />
          )}
          {trendView === 'conversion' && (
            <ConversionTrendWidget
              stats={stats}
              loading={loading}
              dateRange={dateRange}
              onToggleView={handleNextTrend}
              onPrevView={handlePrevTrend}
              toggleLabel="Activity Trend"
              viewIndex={2}
              viewCount={TREND_VIEWS.length}
            />
          )}
        </div>
        <div className="prod-widget">
          <VerificationSurveyWidget viewScope={viewScope} userRole={userRole} teamUserIds={teamUserIds} />
        </div>
      </div>

      {/* Bottom Row: Agent Metrics (team only) */}
      {showTeamWidgets && (
        <div className="prod-grid-bottom">
          <div className="prod-widget">
            <AgentMetricsWidget stats={stats} loading={loading} viewScope={viewScope} dateRange={dateRange} viewMode={viewMode} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionDashboard;
