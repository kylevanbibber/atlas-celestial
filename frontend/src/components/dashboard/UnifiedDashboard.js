/**
 * Unified Dashboard Layout Component
 * 
 * This component renders the dashboard layout using configuration-driven approach.
 * It works for all user roles (SGA, MGA, RGA, SA, GA) by using the dashboard configuration.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardSection from './DashboardSection';
import Leaderboard from '../utils/Leaderboard';
import { getDashboardConfig, DASHBOARD_SECTIONS } from '../../config/dashboardConfig';
import { useDashboardData } from '../../hooks/useDashboardData';
import '../../pages/Dashboard.css';

const UnifiedDashboard = ({ userRole, user }) => {
  const navigate = useNavigate();
  
  // Get configuration for this user role
  const config = getDashboardConfig(userRole);
  
  // Get data using unified hook
  const {
    loading,
    error,
    leaderboardLoading,
    selectedDateRange,
    setSelectedDateRange,
    alpMetrics,
    codesAndHiresMetrics,
    dailyActivityData,
    refSalesData,
    leaderboardData,
    formatCurrency,
    formatDateRange
  } = useDashboardData(userRole, user);

  // If no configuration found for this role, show default message
  if (!config) {
    return (
      <div className="dashboard-container padded-content-sm">
        <div className="dashboard-cards-wrapper">
          <div className="card-container">
            <div className="dashboard-card">
              <h3>Dashboard Coming Soon</h3>
              <p>Role-specific dashboard for {userRole} is being developed.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="dashboard-container padded-content-sm">
        <div className="dashboard-cards-wrapper">
          <div className="loading-message">Loading dashboard data...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="dashboard-container padded-content-sm">
        <div className="dashboard-cards-wrapper">
          <div className="error-message">
            <h3>Error Loading Dashboard</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Get data object for a specific section
   */
  const getSectionData = (sectionType) => {
    switch (sectionType) {
      case DASHBOARD_SECTIONS.YTD_PERFORMANCE:
      case DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE:
        return {
          ...alpMetrics,
          ...codesAndHiresMetrics,
          totalRefSales: refSalesData.totalRefSales || 0
        };
      case DASHBOARD_SECTIONS.REPORTED_ACTIVITY:
        return {
          totalAlp: dailyActivityData.totalAlp || 0,
          totalRefAlp: dailyActivityData.totalRefAlp || 0,
          totalRefs: dailyActivityData.totalRefs || 0,
          agentCount: dailyActivityData.agentCount || 0
        };
      default:
        return {};
    }
  };

  /**
   * Get section title based on section type and data
   */
  const getSectionTitle = (sectionType) => {
    switch (sectionType) {
      case DASHBOARD_SECTIONS.YTD_PERFORMANCE:
        return 'YTD Performance';
      case DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE:
        return `Last Month Performance`;
      case DASHBOARD_SECTIONS.REPORTED_ACTIVITY:
        return 'Reported Activity';
      default:
        return 'Dashboard Section';
    }
  };

  /**
   * Format leaderboard value based on the data
   */
  const formatLeaderboardValue = (value) => {
    if (typeof value === 'number') {
      return formatCurrency(value);
    }
    return value?.toString() || '0';
  };

  /**
   * Navigation handlers
   */
  const handleLeaderboardClick = () => {
    navigate('/production?section=leaderboard');
  };

  const handleYtdPerformanceClick = () => {
    navigate('/production?section=leaderboard');
  };

  const handleLastMonthPerformanceClick = () => {
    navigate('/production?section=leaderboard');
  };

  const handleReportedActivityClick = () => {
    navigate('/production?section=daily-activity');
  };

  return (
    <div className="dashboard-container padded-content-sm">
      <div className="dashboard-layout">
        <div className="dashboard-main-content">
          <div className="dashboard-cards-wrapper">
            {config.sections.map((sectionType) => {
              // Skip leaderboard section as it's rendered separately
              if (sectionType === DASHBOARD_SECTIONS.LEADERBOARD) return null;

              const sectionCards = config.cards[sectionType];
              if (!sectionCards || sectionCards.length === 0) return null;

              const sectionData = getSectionData(sectionType);
              const sectionTitle = getSectionTitle(sectionType);
              const showDateSelector = sectionType === DASHBOARD_SECTIONS.REPORTED_ACTIVITY;

              return (
                <DashboardSection
                  key={sectionType}
                  title={sectionTitle}
                  cards={sectionCards}
                  data={sectionData}
                  formatCurrency={formatCurrency}
                  formatDateRange={formatDateRange}
                  selectedDateRange={selectedDateRange}
                  setSelectedDateRange={setSelectedDateRange}
                  showDateSelector={showDateSelector}
                  onClick={
                    sectionType === DASHBOARD_SECTIONS.YTD_PERFORMANCE ? handleYtdPerformanceClick :
                    sectionType === DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE ? handleLastMonthPerformanceClick :
                    sectionType === DASHBOARD_SECTIONS.REPORTED_ACTIVITY ? handleReportedActivityClick :
                    null
                  }
                />
              );
            })}
          </div>
        </div>

        {/* Leaderboard Sidebar */}
        {config.sections.includes(DASHBOARD_SECTIONS.LEADERBOARD) && (
          <div className="dashboard-sidebar">
            <div className="leaderboard-section">
              <div onClick={handleLeaderboardClick} style={{ cursor: 'pointer' }}>
                <Leaderboard
                  data={leaderboardData}
                  title={config.leaderboard.title}
                  nameField="name"
                  valueField="value"
                  formatValue={formatLeaderboardValue}
                  loading={leaderboardLoading}
                  variant="compact"
                  showProfilePicture={true}
                  profilePictureField="profile_picture"
                  showLevelBadge={true}
                  showMGA={true}
                  hierarchyLevel={userRole?.toLowerCase() || 'all'}
                  className="dashboard-leaderboard"
                  currentUser={user}
                  showScrollButtons={true}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedDashboard;