/**
 * Unified Dashboard Layout Component
 * 
 * This component renders the dashboard layout using configuration-driven approach.
 * It works for all user roles (SGA, MGA, RGA, SA, GA) by using the dashboard configuration.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardSection from './DashboardSection';
import Leaderboard from '../utils/Leaderboard';
import { getDashboardConfig, DASHBOARD_SECTIONS } from '../../config/dashboardConfig';
import { useDashboardData, getCurrentWeekRange, getCurrentMonthRange } from '../../hooks/useDashboardData';
import '../../pages/Dashboard.css';

const UnifiedDashboard = ({ userRole, user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('thisWeek');
  
  // Get configuration for this user role
  const config = getDashboardConfig(userRole);
  
  // Get data using unified hook
  const {
    loading,
    error,
    dailyActivityLoading,
    leaderboardLoading,
    selectedDateRange,
    setSelectedDateRange,
    alpMetrics,
    codesAndHiresMetrics,
    dailyActivityData,
    refSalesData,
    currentMonthRefSalesData,
    ytdRefSalesData,
    leaderboardData,
    formatCurrency,
    formatDateRange
  } = useDashboardData(userRole, user);

  // Update date range when tab changes
  useEffect(() => {
    if (activeTab === 'thisWeek') {
      const weekRange = getCurrentWeekRange();
      setSelectedDateRange(weekRange);
    } else if (activeTab === 'thisMonth') {
      const monthRange = getCurrentMonthRange();
      setSelectedDateRange(monthRange);
    }
  }, [activeTab, setSelectedDateRange]);

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
      <div className="route-loading" role="alert" aria-busy="true">
        <div className="spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="dashboard-container padded-content-sm">
        <div className="dashboard-cards-wrapper">
          <div className="card-container">
            <div className="dashboard-card error-card">
              <h3>Error Loading Dashboard</h3>
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Get section data based on section type
   */
  const getSectionData = (sectionType) => {
    switch (sectionType) {
      case DASHBOARD_SECTIONS.YTD_PERFORMANCE:
        return {
          // ALP metrics
          ...alpMetrics,
          // Codes and Hires metrics
          ...codesAndHiresMetrics,
          // YTD Ref Sales data
          ytdRefSales: ytdRefSalesData.ytdRefSales || 0,
          previousYearYtdRefSales: ytdRefSalesData.previousYearYtdRefSales || 0
        };
      case DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE:
        return {
          // ALP metrics
          ...alpMetrics,
          // Codes and Hires metrics
          ...codesAndHiresMetrics,
          // Last Month Ref Sales data
          totalRefSales: refSalesData.totalRefSales || 0,
          previousMonthRefSales: refSalesData.previousMonthRefSales || 0
        };
      case DASHBOARD_SECTIONS.REPORTED_ACTIVITY:
        return {
          // Daily activity data - keep as numbers to avoid NaN formatting issues
          totalAlp: dailyActivityData.totalAlp || 0,
          totalRefAlp: dailyActivityData.totalRefAlp || 0,
          totalRefs: dailyActivityData.totalRefs || 0,
          agentCount: dailyActivityData.agentCount || 0,
          // Current month ref sales data
          totalRefSales: currentMonthRefSalesData.totalRefSales || 0,
          previousMonthRefSales: currentMonthRefSalesData.previousMonthRefSales || 0,
          // Include loading state for conditional rendering
          dailyActivityLoading
        };
      default:
        return {};
    }
  };

  /**
   * Get section title based on section type
   */
  const getSectionTitle = (sectionType) => {
    // No section headers needed anymore
    return '';
  };

  /**
   * Format leaderboard value based on the data
   */
  const formatLeaderboardValue = (value) => {
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return value || '0';
  };

  /**
   * Get sections to display based on active tab
   */
  const getSectionsForTab = (tab) => {
    switch (tab) {
      case 'thisWeek':
        return [DASHBOARD_SECTIONS.REPORTED_ACTIVITY];
      case 'thisMonth':
        return [DASHBOARD_SECTIONS.REPORTED_ACTIVITY];
      case 'lastMonth':
        return [DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE];
      case 'ytd':
        return [DASHBOARD_SECTIONS.YTD_PERFORMANCE];
      default:
        return [];
    }
  };

  const sectionsToShow = getSectionsForTab(activeTab);

  return (
    <div className="dashboard-container padded-content-sm">
      {/* Navigation Buttons */}
      <div className="dashboard-nav-buttons">
        <button 
          className={`time-button ${activeTab === 'thisWeek' ? 'active' : ''}`}
          onClick={() => setActiveTab('thisWeek')}
        >
          This Week
        </button>
        <button 
          className={`time-button ${activeTab === 'thisMonth' ? 'active' : ''}`}
          onClick={() => setActiveTab('thisMonth')}
        >
          This Month
        </button>
        <button 
          className={`time-button ${activeTab === 'lastMonth' ? 'active' : ''}`}
          onClick={() => setActiveTab('lastMonth')}
        >
          Last Month
        </button>
        <button 
          className={`time-button ${activeTab === 'ytd' ? 'active' : ''}`}
          onClick={() => setActiveTab('ytd')}
        >
          YTD
        </button>
      </div>

      <div className="dashboard-layout">
        <div className="dashboard-main-content">
          <div className="dashboard-cards-wrapper">
            {sectionsToShow.map((sectionType) => {
              const sectionCards = config.cards[sectionType];
              if (!sectionCards || sectionCards.length === 0) return null;

              const sectionData = getSectionData(sectionType);
              const sectionTitle = getSectionTitle(sectionType);
              // Show date selector only for "This Week" tab when in REPORTED_ACTIVITY section
              const showDateSelector = sectionType === DASHBOARD_SECTIONS.REPORTED_ACTIVITY && activeTab === 'thisWeek';

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
                />
              );
            })}
          </div>
        </div>

        {/* Leaderboard Sidebar */}
        {config.sections.includes(DASHBOARD_SECTIONS.LEADERBOARD) && (
          <div className="dashboard-sidebar">
            <div className="leaderboard-section">
              <div onClick={() => navigate('/production?section=leaderboard')} style={{ cursor: 'pointer' }}>
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