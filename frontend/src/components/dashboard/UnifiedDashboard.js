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
import CompetitionsDisplay from '../competitions/CompetitionsDisplay';
import { getDashboardConfig, DASHBOARD_SECTIONS, CARD_TYPES } from '../../config/dashboardConfig';
import { useDashboardData, getPreviousMonthRange, getCurrentWeekRange, getCurrentMonthRange, getYearToDateRange } from '../../hooks/useDashboardData';
import '../../pages/Dashboard.css';

const UnifiedDashboard = ({ userRole, user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('thisMonth');
  const [saViewMode, setSaViewMode] = useState('team'); // 'personal' or 'team' for SA users
  const [gaViewMode, setGaViewMode] = useState('team'); // 'personal' or 'team' for GA users
  const [mgaViewMode, setMgaViewMode] = useState('team'); // 'personal' or 'team' for MGA users
  const [rgaViewMode, setRgaViewMode] = useState('mga'); // 'personal', 'mga', or 'rga' for RGA users
  
  // Get configuration for this user role
  const config = getDashboardConfig(userRole);
  
  // Get data using unified hook
  const {
    loading,
    error,
    dailyActivityLoading,
    leaderboardLoading,
    alpMetrics,
    codesAndHiresMetrics,
    dailyActivityData,
    weeklyAlpData,
    weeklyHiresData,
    weeklyCodesData,
    weeklyRefSalesData,
    // Monthly data for "This Month" tab
    monthlyAlpSumData,
    monthlyHiresSumData,
    monthlyCodesSumData,
    monthlyRefSalesSumData,
    currentMonthHiresData,
    currentMonthHiresLoading,
    currentMonthVipsData,
    currentMonthVipsLoading,
    refSalesData,
    currentMonthRefSalesData,
    ytdRefSalesData,
    leaderboardData,
    formatCurrency,
    formatDateRange,
    setSelectedDateRange
  } = useDashboardData(userRole, user, saViewMode, gaViewMode, mgaViewMode, rgaViewMode);

  // Update date range based on active tab for proper Daily Activity data fetching
  useEffect(() => {
    if (activeTab === 'lastMonth') {
      // For "Last Month" tab, use previous month's date range
      const prevMonthRange = getPreviousMonthRange();
      setSelectedDateRange(prevMonthRange);
      console.log('📊 [Dashboard] Setting date range for Last Month tab:', prevMonthRange);
    } else if (activeTab === 'ytd') {
      // For "YTD" tab, use year-to-date range
      const ytdRange = getYearToDateRange();
      setSelectedDateRange(ytdRange);
      console.log('📊 [Dashboard] Setting date range for YTD tab:', ytdRange);
    } else if (activeTab === 'thisMonth') {
      // For "This Month" tab, use current month's date range
      const currentMonthRange = getCurrentMonthRange();
      setSelectedDateRange(currentMonthRange);
      console.log('📊 [Dashboard] Setting date range for This Month tab:', currentMonthRange);
    } else {
      // For other tabs (thisWeek), use current week range
      const currentWeekRange = getCurrentWeekRange();
      setSelectedDateRange(currentWeekRange);
      console.log('📊 [Dashboard] Setting date range for', activeTab, 'tab:', currentWeekRange);
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
        const ytdData = {
          // ALP metrics
          ...alpMetrics,
          // Codes and Hires metrics
          ...codesAndHiresMetrics,
          // YTD Ref Sales data
          ytdRefSales: ytdRefSalesData.ytdRefSales || 0,
          previousYearYtdRefSales: ytdRefSalesData.previousYearYtdRefSales || 0
        };
        
        // For AGT users or SA users (any mode), also include Daily Activity data for YTD
        if (userRole === 'AGT' || userRole === 'SA') {
          ytdData.totalAlp = dailyActivityData.totalAlp || 0;
          ytdData.totalRefAlp = dailyActivityData.totalRefAlp || 0;
          ytdData.totalRefs = dailyActivityData.totalRefs || 0;
          ytdData.agentCount = dailyActivityData.agentCount || 0;
          ytdData.dailyActivityLoading = dailyActivityLoading;
          
          console.log(`📊 [Dashboard] ${userRole} YTD section - including Daily Activity data:`, {
            userRole,
            saViewMode: userRole === 'SA' ? saViewMode : 'N/A',
            totalAlp: ytdData.totalAlp,
            totalRefAlp: ytdData.totalRefAlp,
            totalRefs: ytdData.totalRefs,
            agentCount: ytdData.agentCount,
            dataSource: userRole === 'SA' && saViewMode === 'team' ? 'SA Team Daily Activity (agent + SA)' : 'Standard Daily Activity',
            timestamp: new Date().toISOString()
          });
        }
        
        return ytdData;
      case DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE:
        const lastMonthData = {
          // ALP metrics
          ...alpMetrics,
          // Codes and Hires metrics
          ...codesAndHiresMetrics,
          // Last Month Ref Sales data
          totalRefSales: refSalesData.totalRefSales || 0,
          previousMonthRefSales: refSalesData.previousMonthRefSales || 0
        };
        
        // For AGT users or SA users (any mode), also include Daily Activity data for last month
        if (userRole === 'AGT' || userRole === 'SA') {
          lastMonthData.totalAlp = dailyActivityData.totalAlp || 0;
          lastMonthData.totalRefAlp = dailyActivityData.totalRefAlp || 0;
          lastMonthData.totalRefs = dailyActivityData.totalRefs || 0;
          lastMonthData.agentCount = dailyActivityData.agentCount || 0;
          lastMonthData.dailyActivityLoading = dailyActivityLoading;
          
          console.log(`📊 [Dashboard] ${userRole} Last Month section - including Daily Activity data:`, {
            userRole,
            saViewMode: userRole === 'SA' ? saViewMode : 'N/A',
            totalAlp: lastMonthData.totalAlp,
            totalRefAlp: lastMonthData.totalRefAlp,
            totalRefs: lastMonthData.totalRefs,
            agentCount: lastMonthData.agentCount,
            dataSource: userRole === 'SA' && saViewMode === 'team' ? 'SA Team Daily Activity (agent + SA)' : 'Standard Daily Activity',
            timestamp: new Date().toISOString()
          });
        }
        
        return lastMonthData;
      case DASHBOARD_SECTIONS.REPORTED_ACTIVITY:
        // Return different data based on active tab
        if (activeTab === 'thisMonth') {
          // Monthly data for "This Month" tab
          const monthlyActivitySectionData = {
            // Daily activity data - keep as numbers to avoid NaN formatting issues
            totalAlp: dailyActivityData.totalAlp || 0,
            totalRefAlp: dailyActivityData.totalRefAlp || 0,
            totalRefs: dailyActivityData.totalRefs || 0,
            agentCount: dailyActivityData.agentCount || 0,
            // Monthly ALP data (from MTD Recap)
            monthlyAlp: monthlyAlpSumData.monthlyAlp || 0,
            comparisonAlp: monthlyAlpSumData.comparisonAlp || 0,
            // Monthly date range
            monthStart: monthlyAlpSumData.monthStart,
            monthEnd: monthlyAlpSumData.monthEnd,
            // Monthly hires data (SGA only)
            monthlyHires: monthlyHiresSumData.monthlyHires || 0,
            hiresMonthStart: monthlyHiresSumData.monthStart,
            hiresMonthEnd: monthlyHiresSumData.monthEnd,
            // Monthly codes data (SGA only)
            monthlyCodes: monthlyCodesSumData.monthlyCodes || 0,
            codesMonthStart: monthlyCodesSumData.monthStart,
            codesMonthEnd: monthlyCodesSumData.monthEnd,
            // Monthly ref sales data (SGA only)
            monthlyRefSales: monthlyRefSalesSumData.monthlyRefSales || 0,
            refSalesMonthStart: monthlyRefSalesSumData.monthStart,
            refSalesMonthEnd: monthlyRefSalesSumData.monthEnd,
            // Current month ref sales data
            totalRefSales: currentMonthRefSalesData.totalRefSales || 0,
            previousMonthRefSales: currentMonthRefSalesData.previousMonthRefSales || 0,
            // Current month hires and VIPs data (MGA/RGA only)
            monthlyHires: currentMonthHiresData.monthlyHires || monthlyHiresSumData.monthlyHires || 0,
            monthlyVips: currentMonthVipsData.monthlyVips || 0,
            // Include loading state for conditional rendering
            dailyActivityLoading,
            currentMonthHiresLoading,
            currentMonthVipsLoading
          };

          console.log(`📊 [Dashboard] Monthly activity section data for ${userRole}:`, {
            userRole,
            activeTab,
            userLagnName: user?.lagnname,
            rawDataSources: {
              monthlyAlpSumData: monthlyAlpSumData,
              monthlyHiresSumData: monthlyHiresSumData,
              monthlyCodesSumData: monthlyCodesSumData,
              monthlyRefSalesSumData: monthlyRefSalesSumData,
              dailyActivityData: dailyActivityData
            },
            processedSectionData: {
              monthlyAlp: monthlyActivitySectionData.monthlyAlp,
              comparisonAlp: monthlyActivitySectionData.comparisonAlp,
              monthStart: monthlyAlpSumData.monthStart,
              monthEnd: monthlyAlpSumData.monthEnd,
              maxReportDate: monthlyAlpSumData.maxReportDate,
              monthlyHires: monthlyActivitySectionData.monthlyHires,
              monthlyCodes: monthlyActivitySectionData.monthlyCodes,
              monthlyRefSales: monthlyActivitySectionData.monthlyRefSales,
              dailyActivityTotals: {
                totalAlp: monthlyActivitySectionData.totalAlp,
                totalRefAlp: monthlyActivitySectionData.totalRefAlp,
                totalRefs: monthlyActivitySectionData.totalRefs,
                agentCount: monthlyActivitySectionData.agentCount
              }
            },
            dataValidation: {
              hasMonthlyAlpData: monthlyAlpSumData.monthlyAlp > 0,
              hasComparisonData: monthlyAlpSumData.comparisonAlp > 0,
              hasDateRange: !!(monthlyAlpSumData.monthStart && monthlyAlpSumData.monthEnd),
              hasMaxReportDate: !!monthlyAlpSumData.maxReportDate,
              isAgtUser: userRole === 'AGT',
              shouldHaveLagnNameFilter: userRole !== 'SGA'
            },
            timestamp: new Date().toISOString()
          });
          
          // Additional logging for AGT users specifically
          if (userRole === 'AGT') {
            console.log('👤 [Dashboard] AGT User Monthly ALP Details:', {
              agtUser: user?.lagnname,
              monthlyAlpFromWeeklyALP: monthlyAlpSumData.monthlyAlp,
              comparisonAlpFromDailyActivity: monthlyAlpSumData.comparisonAlp,
              weeklyAlpTable_MTD_Recap: {
                maxReportDate: monthlyAlpSumData.maxReportDate,
                monthStart: monthlyAlpSumData.monthStart,
                monthEnd: monthlyAlpSumData.monthEnd,
                value: monthlyAlpSumData.monthlyAlp
              },
              dailyActivityTable: {
                monthRange: `${monthlyAlpSumData.monthStart} to ${monthlyAlpSumData.monthEnd}`,
                value: monthlyAlpSumData.comparisonAlp
              },
              expectedQuery: `Weekly_ALP WHERE LagnName='${user?.lagnname}' AND REPORT='MTD Recap' AND reportdate='${monthlyAlpSumData.maxReportDate}'`
            });
          }

          return monthlyActivitySectionData;
        } else {
          // Weekly data for "This Week" tab (default)
          const activitySectionData = {
            // Daily activity data - keep as numbers to avoid NaN formatting issues
            totalAlp: dailyActivityData.totalAlp || 0,
            totalRefAlp: dailyActivityData.totalRefAlp || 0,
            totalRefs: dailyActivityData.totalRefs || 0,
            agentCount: dailyActivityData.agentCount || 0,
            // Weekly ALP data
            weeklyAlp: weeklyAlpData.weeklyAlp || 0,
            comparisonAlp: weeklyAlpData.comparisonAlp || 0,
            // Weekly ALP date range
            weekStart: weeklyAlpData.weekStart,
            weekEnd: weeklyAlpData.weekEnd,
            // Weekly hires data (SGA only)
            weeklyHires: weeklyHiresData.weeklyHires || 0,
            hiresMaxDate: weeklyHiresData.maxDate,
            // Weekly codes data (SGA only)
            weeklyCodes: weeklyCodesData.weeklyCodes || 0,
            codesWeekStart: weeklyCodesData.weekStart,
            codesWeekEnd: weeklyCodesData.weekEnd,
            // Weekly ref sales data (SGA only)
            weeklyRefSales: weeklyRefSalesData.weeklyRefSales || 0,
            refSalesWeekStart: weeklyRefSalesData.weekStart,
            refSalesWeekEnd: weeklyRefSalesData.weekEnd,
            // Current month ref sales data
            totalRefSales: currentMonthRefSalesData.totalRefSales || 0,
            previousMonthRefSales: currentMonthRefSalesData.previousMonthRefSales || 0,
            // Include loading state for conditional rendering
            dailyActivityLoading
          };
          
          console.log(`📊 [Dashboard] Weekly activity section data for ${userRole}:`, {
            userRole,
            activeTab,
            weeklyAlpData: {
              weeklyAlp: activitySectionData.weeklyAlp,
              comparisonAlp: activitySectionData.comparisonAlp,
              weekStart: weeklyAlpData.weekStart,
              weekEnd: weeklyAlpData.weekEnd
            },
            weeklyHiresData: {
              weeklyHires: activitySectionData.weeklyHires,
              maxDate: weeklyHiresData.maxDate
            },
            weeklyCodesData: {
              weeklyCodes: activitySectionData.weeklyCodes,
              weekStart: weeklyCodesData.weekStart,
              weekEnd: weeklyCodesData.weekEnd
            },
            weeklyRefSalesData: {
              weeklyRefSales: activitySectionData.weeklyRefSales,
              weekStart: weeklyRefSalesData.weekStart,
              weekEnd: weeklyRefSalesData.weekEnd
            },
            dailyActivityData: {
              totalAlp: activitySectionData.totalAlp,
              totalRefAlp: activitySectionData.totalRefAlp,
              totalRefs: activitySectionData.totalRefs,
              agentCount: activitySectionData.agentCount
            }
          });

          return activitySectionData;
        }
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

  /**
   * Get cards for a section based on the active tab and user role
   */
  const getSectionCards = (sectionType) => {
    // For REPORTED_ACTIVITY section, use different cards based on tab and user role
    if (sectionType === DASHBOARD_SECTIONS.REPORTED_ACTIVITY) {
      if (activeTab === 'thisWeek') {
        // Weekly cards for "This Week"
        const baseCards = [
          {
            type: CARD_TYPES.WEEKLY_ALP,
            title: 'Weekly ALP',
            dataKey: 'weeklyAlp',
            icon: config.cards[sectionType][0].icon,
            iconColor: 'rgba(255, 152, 0, 0.1)',
            format: 'currency',
            comparisonDataKey: 'comparisonAlp',
            comparisonLabel: 'Daily Activity',
            navigateTo: '/daily-activity'
          }
        ];

        // For AGT users, SA/GA/MGA/RGA users in personal mode, show Daily Activity cards instead of Hires/Codes
        if (userRole === 'AGT' || 
            (userRole === 'SA' && saViewMode === 'personal') || 
            (userRole === 'GA' && gaViewMode === 'personal') ||
            (userRole === 'MGA' && mgaViewMode === 'personal') ||
            (userRole === 'RGA' && rgaViewMode === 'personal')) {
          return [
            ...baseCards,
            {
              type: CARD_TYPES.DAILY_ALP,
              title: 'Daily ALP',
              dataKey: 'totalAlp',
              icon: config.cards[sectionType][1].icon,
              iconColor: 'rgba(156, 39, 176, 0.1)',
              format: 'currency',
              navigateTo: '/daily-activity'
            },
            {
              type: CARD_TYPES.DAILY_REF_ALP,
              title: 'Daily Ref ALP',
              dataKey: 'totalRefAlp',
              icon: config.cards[sectionType][2].icon,
              iconColor: 'rgba(63, 81, 181, 0.1)',
              format: 'currency',
              navigateTo: '/daily-activity'
            },
            {
              type: CARD_TYPES.WEEKLY_REF_SALES,
              title: 'Weekly Ref Sales',
              dataKey: 'weeklyRefSales',
              icon: config.cards[sectionType][3].icon,
              iconColor: 'rgba(76, 175, 80, 0.1)',
              format: 'number',
              navigateTo: '/reports?report=ref-sales'
            }
          ];
        } else {
          // For SGA, RGA, MGA, GA users, or SA users in team mode, show different cards
          const cards = [...baseCards];
          
          if ((userRole === 'SA' && saViewMode === 'team') || 
              (userRole === 'GA' && gaViewMode === 'team')) {
            // For SA/GA users in team mode, show Daily Activity ALP
            cards.push(
              {
                type: CARD_TYPES.DAILY_ALP,
                title: 'Daily Activity ALP',
                dataKey: 'totalAlp',
                icon: config.cards[sectionType][1].icon,
                iconColor: 'rgba(255, 152, 0, 0.1)',
                format: 'currency',
                navigateTo: '/daily-activity'
              },
              {
                type: CARD_TYPES.WEEKLY_CODES,
                title: 'Weekly Codes',
                dataKey: 'weeklyCodes',
                icon: config.cards[sectionType][2].icon,
                iconColor: 'rgba(63, 81, 181, 0.1)',
                format: 'number',
                navigateTo: '/production?section=codes'
              },
              {
                type: CARD_TYPES.WEEKLY_REF_SALES,
                title: 'Weekly Ref Sales',
                dataKey: 'weeklyRefSales',
                icon: config.cards[sectionType][3].icon,
                iconColor: 'rgba(76, 175, 80, 0.1)',
                format: 'number',
                navigateTo: '/reports?report=ref-sales'
              }
            );
          } else if ((userRole === 'MGA' && mgaViewMode === 'team') ||
                     (userRole === 'RGA' && (rgaViewMode === 'mga' || rgaViewMode === 'rga'))) {
            // For MGA/RGA users in team mode, show Hires, VIPs, and Codes instead of Daily Activity ALP
            cards.push(
              {
                type: CARD_TYPES.CURRENT_MONTH_HIRES,
                title: 'Monthly Hires',
                dataKey: 'monthlyHires',
                icon: config.cards[sectionType][1].icon,
                iconColor: 'rgba(255, 152, 0, 0.1)',
                format: 'number',
                navigateTo: '/production?section=hires'
              },
              {
                type: CARD_TYPES.CURRENT_MONTH_VIPS,
                title: 'Monthly VIPs',
                dataKey: 'monthlyVips',
                icon: config.cards[sectionType][2].icon,
                iconColor: 'rgba(156, 39, 176, 0.1)',
                format: 'number',
                navigateTo: '/production?section=vips'
              },
              {
                type: CARD_TYPES.WEEKLY_CODES,
                title: 'Weekly Codes',
                dataKey: 'weeklyCodes',
                icon: config.cards[sectionType][3].icon,
                iconColor: 'rgba(63, 81, 181, 0.1)',
                format: 'number',
                navigateTo: '/production?section=codes'
              }
            );
          } else {
            // For other users (SGA, RGA, MGA) and GA in non-team mode, show Hires/Codes cards
            cards.push(
              {
                type: CARD_TYPES.WEEKLY_HIRES,
                title: 'Weekly Hires',
                dataKey: 'weeklyHires',
                icon: config.cards[sectionType][1].icon,
                iconColor: 'rgba(156, 39, 176, 0.1)',
                format: 'number',
                navigateTo: '/production?section=hires'
              },
              {
                type: CARD_TYPES.WEEKLY_CODES,
                title: 'Weekly Codes',
                dataKey: 'weeklyCodes',
                icon: config.cards[sectionType][2].icon,
                iconColor: 'rgba(63, 81, 181, 0.1)',
                format: 'number',
                navigateTo: '/production?section=codes'
              },
              {
                type: CARD_TYPES.WEEKLY_REF_SALES,
                title: 'Weekly Ref Sales',
                dataKey: 'weeklyRefSales',
                icon: config.cards[sectionType][3].icon,
                iconColor: 'rgba(76, 175, 80, 0.1)',
                format: 'number',
                navigateTo: '/reports?report=ref-sales'
              }
            );
          }
          
          return cards;
        }
      } else if (activeTab === 'thisMonth') {
        // Monthly cards for "This Month"
        const baseCards = [
          {
            type: CARD_TYPES.MONTHLY_ALP,
            title: 'Monthly ALP',
            dataKey: 'monthlyAlp',
            icon: config.cards[sectionType][0].icon,
            iconColor: 'rgba(255, 152, 0, 0.1)',
            format: 'currency',
            comparisonDataKey: 'comparisonAlp',
            comparisonLabel: 'Daily Activity',
            navigateTo: '/daily-activity'
          }
        ];

        // For AGT users, SA/GA/MGA/RGA users in personal mode, show Daily Activity cards instead of Hires/Codes
        if (userRole === 'AGT' || 
            (userRole === 'SA' && saViewMode === 'personal') || 
            (userRole === 'GA' && gaViewMode === 'personal') ||
            (userRole === 'MGA' && mgaViewMode === 'personal') ||
            (userRole === 'RGA' && rgaViewMode === 'personal')) {
          return [
            ...baseCards,
            {
              type: CARD_TYPES.DAILY_ALP,
              title: 'Daily ALP',
              dataKey: 'totalAlp',
              icon: config.cards[sectionType][1].icon,
              iconColor: 'rgba(156, 39, 176, 0.1)',
              format: 'currency',
              navigateTo: '/daily-activity'
            },
            {
              type: CARD_TYPES.DAILY_REF_ALP,
              title: 'Daily Ref ALP',
              dataKey: 'totalRefAlp',
              icon: config.cards[sectionType][2].icon,
              iconColor: 'rgba(63, 81, 181, 0.1)',
              format: 'currency',
              navigateTo: '/daily-activity'
            },
            {
              type: CARD_TYPES.MONTHLY_REF_SALES,
              title: 'Monthly Ref Sales',
              dataKey: 'monthlyRefSales',
              icon: config.cards[sectionType][3].icon,
              iconColor: 'rgba(76, 175, 80, 0.1)',
              format: 'number',
              navigateTo: '/reports?report=ref-sales'
            }
          ];
        } else {
          // For SGA, RGA, MGA, GA users, or SA users in team mode, show different cards
          const cards = [...baseCards];
          
          if ((userRole === 'SA' && saViewMode === 'team') || 
              (userRole === 'GA' && gaViewMode === 'team')) {
            // For SA/GA users in team mode, show Daily Activity ALP
            cards.push(
              {
                type: CARD_TYPES.DAILY_ALP,
                title: 'Daily Activity ALP',
                dataKey: 'totalAlp',
                icon: config.cards[sectionType][1].icon,
                iconColor: 'rgba(255, 152, 0, 0.1)',
                format: 'currency',
                navigateTo: '/daily-activity'
              },
              {
                type: CARD_TYPES.MONTHLY_CODES,
                title: 'Monthly Codes',
                dataKey: 'monthlyCodes',
                icon: config.cards[sectionType][2].icon,
                iconColor: 'rgba(63, 81, 181, 0.1)',
                format: 'number',
                navigateTo: '/production?section=codes'
              },
              {
                type: CARD_TYPES.MONTHLY_REF_SALES,
                title: 'Monthly Ref Sales',
                dataKey: 'monthlyRefSales',
                icon: config.cards[sectionType][3].icon,
                iconColor: 'rgba(76, 175, 80, 0.1)',
                format: 'number',
                navigateTo: '/reports?report=ref-sales'
              }
            );
          } else if ((userRole === 'MGA' && mgaViewMode === 'team') ||
                     (userRole === 'RGA' && (rgaViewMode === 'mga' || rgaViewMode === 'rga'))) {
            // For MGA/RGA users in team mode, show Hires, VIPs, and Codes instead of Daily Activity ALP
            cards.push(
              {
                type: CARD_TYPES.CURRENT_MONTH_HIRES,
                title: 'Monthly Hires',
                dataKey: 'monthlyHires',
                icon: config.cards[sectionType][1].icon,
                iconColor: 'rgba(255, 152, 0, 0.1)',
                format: 'number',
                navigateTo: '/production?section=hires'
              },
              {
                type: CARD_TYPES.CURRENT_MONTH_VIPS,
                title: 'Monthly VIPs',
                dataKey: 'monthlyVips',
                icon: config.cards[sectionType][2].icon,
                iconColor: 'rgba(156, 39, 176, 0.1)',
                format: 'number',
                navigateTo: '/production?section=vips'
              },
              {
                type: CARD_TYPES.MONTHLY_CODES,
                title: 'Monthly Codes',
                dataKey: 'monthlyCodes',
                icon: config.cards[sectionType][3].icon,
                iconColor: 'rgba(63, 81, 181, 0.1)',
                format: 'number',
                navigateTo: '/production?section=codes'
              }
            );
          } else {
            // For other users (SGA, RGA, MGA) and GA in non-team mode, show Hires/Codes cards
            cards.push(
              {
                type: CARD_TYPES.MONTHLY_HIRES,
                title: 'Monthly Hires',
                dataKey: 'monthlyHires',
                icon: config.cards[sectionType][1].icon,
                iconColor: 'rgba(156, 39, 176, 0.1)',
                format: 'number',
                navigateTo: '/production?section=hires'
              },
              {
                type: CARD_TYPES.MONTHLY_CODES,
                title: 'Monthly Codes',
                dataKey: 'monthlyCodes',
                icon: config.cards[sectionType][2].icon,
                iconColor: 'rgba(63, 81, 181, 0.1)',
                format: 'number',
                navigateTo: '/production?section=codes'
              },
              {
                type: CARD_TYPES.MONTHLY_REF_SALES,
                title: 'Monthly Ref Sales',
                dataKey: 'monthlyRefSales',
                icon: config.cards[sectionType][3].icon,
                iconColor: 'rgba(76, 175, 80, 0.1)',
                format: 'number',
                navigateTo: '/reports?report=ref-sales'
              }
            );
          }
          
          return cards;
        }
      }
    }
    
    // For other sections (YTD_PERFORMANCE, LAST_MONTH_PERFORMANCE), handle SA/GA/MGA/RGA toggles
    if (userRole === 'SA' || userRole === 'GA' || userRole === 'MGA' || userRole === 'RGA') {
      if ((userRole === 'SA' && saViewMode === 'personal') || 
          (userRole === 'GA' && gaViewMode === 'personal') ||
          (userRole === 'MGA' && mgaViewMode === 'personal') ||
          (userRole === 'RGA' && rgaViewMode === 'personal')) {
        // For SA/GA/MGA/RGA users in personal mode, modify Last Month and YTD cards to include Daily Activity cards
        if (sectionType === DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE) {
          const defaultCards = config.cards[sectionType] || [];
          
          // Calculate previous month name
          const now = new Date();
          const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const prevMonthName = prevMonth.toLocaleDateString('en-US', { month: 'long' });
          
          console.log(`📊 [${userRole} Last Month Cards] Using previous month name:`, {
            userRole,
            currentMonth: now.toLocaleDateString('en-US', { month: 'long' }),
            previousMonth: prevMonthName,
            viewMode: userRole === 'SA' ? saViewMode : gaViewMode
          });
          
          // Insert Daily Activity cards after the first Monthly ALP card
          return [
            defaultCards[0], // Monthly ALP
            {
              type: CARD_TYPES.DAILY_ALP,
              title: `${prevMonthName} Daily ALP`,
              dataKey: 'totalAlp',
              icon: defaultCards[1].icon,
              iconColor: 'rgba(255, 152, 0, 0.1)',
              format: 'currency',
              showComparison: true,
              comparisonType: 'month',
              navigateTo: '/daily-activity'
            },
            {
              type: CARD_TYPES.DAILY_REF_ALP,
              title: `${prevMonthName} Daily Ref ALP`,
              dataKey: 'totalRefAlp',
              icon: defaultCards[2].icon,
              iconColor: 'rgba(63, 81, 181, 0.1)',
              format: 'currency',
              showComparison: true,
              comparisonType: 'month',
              navigateTo: '/daily-activity'
            },
            defaultCards[3] // Only Monthly Ref Sales (skip codes+vips and hires)
          ];
          
          console.log(`📊 [${userRole} Personal Last Month] Cards included:`, {
            cardCount: 4,
            cards: ['Monthly ALP', 'Daily ALP', 'Daily Ref ALP', 'Monthly Ref Sales'],
            skipped: ['Monthly Codes+VIPs', 'Monthly Hires']
          });
        } else if (sectionType === DASHBOARD_SECTIONS.YTD_PERFORMANCE) {
          const defaultCards = config.cards[sectionType] || [];
          // Insert Daily Activity cards after the first YTD ALP card
          return [
            defaultCards[0], // YTD SA ALP
            {
              type: CARD_TYPES.DAILY_ALP,
              title: 'YTD Daily ALP',
              dataKey: 'totalAlp',
              icon: defaultCards[1].icon,
              iconColor: 'rgba(255, 152, 0, 0.1)',
              format: 'currency',
              showComparison: true,
              comparisonType: 'year',
              navigateTo: '/daily-activity'
            },
            {
              type: CARD_TYPES.DAILY_REF_ALP,
              title: 'YTD Daily Ref ALP',
              dataKey: 'totalRefAlp',
              icon: defaultCards[2].icon,
              iconColor: 'rgba(63, 81, 181, 0.1)',
              format: 'currency',
              showComparison: true,
              comparisonType: 'year',
              navigateTo: '/daily-activity'
            },
            defaultCards[3] // Only YTD Ref Sales (skip codes+vips and hires)
          ];
          
          console.log(`📊 [${userRole} Personal YTD] Cards included:`, {
            cardCount: 4,
            cards: [`YTD ${userRole} ALP`, 'YTD Daily ALP', 'YTD Daily Ref ALP', 'YTD Ref Sales'],
            skipped: ['YTD Codes+VIPs', 'YTD Hires']
          });
        }
      } else if ((userRole === 'SA' && saViewMode === 'team') || 
                 (userRole === 'GA' && gaViewMode === 'team') ||
                 (userRole === 'MGA' && mgaViewMode === 'team') ||
                 (userRole === 'RGA' && (rgaViewMode === 'mga' || rgaViewMode === 'rga'))) {
        // For SA/GA/MGA/RGA users in team mode, replace hires with Daily Activity ALP but keep codes and ref sales
        if (sectionType === DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE) {
          const defaultCards = config.cards[sectionType] || [];
          
          // Calculate previous month name
          const now = new Date();
          const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const prevMonthName = prevMonth.toLocaleDateString('en-US', { month: 'long' });
          
          console.log(`📊 [${userRole} Last Month Cards] Using previous month name:`, {
            userRole,
            currentMonth: now.toLocaleDateString('en-US', { month: 'long' }),
            previousMonth: prevMonthName,
            viewMode: userRole === 'SA' ? saViewMode : gaViewMode
          });
          
          return [
            defaultCards[0], // Monthly ALP
            {
              type: CARD_TYPES.DAILY_ALP,
              title: `${prevMonthName} Daily Activity ALP`,
              dataKey: 'totalAlp',
              icon: defaultCards[1].icon,
              iconColor: 'rgba(255, 152, 0, 0.1)',
              format: 'currency',
              showComparison: true,
              comparisonType: 'month',
              navigateTo: '/daily-activity'
            },
            defaultCards[1], // Monthly Codes+VIPs (keep)
            defaultCards[3] // Monthly Ref Sales (keep, skip hires which is defaultCards[2])
          ];
        } else if (sectionType === DASHBOARD_SECTIONS.YTD_PERFORMANCE) {
          const defaultCards = config.cards[sectionType] || [];
          return [
            defaultCards[0], // YTD SA ALP
            {
              type: CARD_TYPES.DAILY_ALP,
              title: 'YTD Daily Activity ALP',
              dataKey: 'totalAlp',
              icon: defaultCards[1].icon,
              iconColor: 'rgba(255, 152, 0, 0.1)',
              format: 'currency',
              showComparison: true,
              comparisonType: 'year',
              navigateTo: '/daily-activity'
            },
            defaultCards[1], // YTD Codes+VIPs (keep)
            defaultCards[3] // YTD Ref Sales (keep, skip hires which is defaultCards[2])
          ];
        }
      }
    }
    
    // For other sections, use default configuration
    return config.cards[sectionType] || [];
  };

  return (
    <div className="dashboard-container padded-content-sm">
      {/* Competitions Display - Shows active competitions at the top */}
      <CompetitionsDisplay 
        user={user} 
        className="dashboard-competitions"
      />
      
      {/* SA View Mode Toggle */}
      {userRole === 'SA' && (
        <div className="sa-view-toggle" style={{ 
          marginBottom: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px' 
        }}>
          <span style={{ fontWeight: 'bold', marginRight: '10px' }}>View Mode:</span>
          <button
            className={`time-button ${saViewMode === 'personal' ? 'active' : ''}`}
            onClick={() => {
              setSaViewMode('personal');
              console.log('📊 [SA Dashboard] Switched to Personal view mode');
            }}
            style={{ 
              fontSize: '14px', 
              padding: '8px 16px',
              minWidth: '80px'
            }}
          >
            Personal
          </button>
          <button
            className={`time-button ${saViewMode === 'team' ? 'active' : ''}`}
            onClick={() => {
              setSaViewMode('team');
              console.log('📊 [SA Dashboard] Switched to Team view mode');
            }}
            style={{ 
              fontSize: '14px', 
              padding: '8px 16px',
              minWidth: '80px'
            }}
          >
            Team
          </button>
        </div>
      )}
      
      {/* GA View Mode Toggle */}
      {userRole === 'GA' && (
        <div className="ga-view-toggle" style={{ 
          marginBottom: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px' 
        }}>
          <span style={{ fontWeight: 'bold', marginRight: '10px' }}>View Mode:</span>
          <button
            className={`time-button ${gaViewMode === 'personal' ? 'active' : ''}`}
            onClick={() => {
              setGaViewMode('personal');
              console.log('📊 [GA Dashboard] Switched to Personal view mode');
            }}
            style={{ 
              fontSize: '14px', 
              padding: '8px 16px',
              minWidth: '80px'
            }}
          >
            Personal
          </button>
          <button
            className={`time-button ${gaViewMode === 'team' ? 'active' : ''}`}
            onClick={() => {
              setGaViewMode('team');
              console.log('📊 [GA Dashboard] Switched to Team view mode');
            }}
            style={{ 
              fontSize: '14px', 
              padding: '8px 16px',
              minWidth: '80px'
            }}
          >
            Team
          </button>
        </div>
      )}
      
      {/* MGA View Mode Toggle */}
      {userRole === 'MGA' && (
        <div className="mga-view-toggle" style={{ 
          marginBottom: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px' 
        }}>
          <span style={{ fontWeight: 'bold', marginRight: '10px' }}>View Mode:</span>
          <button
            className={`time-button ${mgaViewMode === 'personal' ? 'active' : ''}`}
            onClick={() => {
              setMgaViewMode('personal');
              console.log('📊 [MGA Dashboard] Switched to Personal view mode');
            }}
            style={{ 
              fontSize: '14px', 
              padding: '8px 16px',
              minWidth: '80px'
            }}
          >
            Personal
          </button>
          <button
            className={`time-button ${mgaViewMode === 'team' ? 'active' : ''}`}
            onClick={() => {
              setMgaViewMode('team');
              console.log('📊 [MGA Dashboard] Switched to Team view mode');
            }}
            style={{ 
              fontSize: '14px', 
              padding: '8px 16px',
              minWidth: '80px'
            }}
          >
            Team
          </button>
        </div>
      )}
      
      {/* RGA View Mode Toggle */}
      {userRole === 'RGA' && (
        <div className="rga-view-toggle" style={{ 
          marginBottom: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px' 
        }}>
          <span style={{ fontWeight: 'bold', marginRight: '10px' }}>View Mode:</span>
          <button
            className={`time-button ${rgaViewMode === 'personal' ? 'active' : ''}`}
            onClick={() => {
              setRgaViewMode('personal');
              console.log('📊 [RGA Dashboard] Switched to Personal view mode');
            }}
            style={{ 
              fontSize: '14px', 
              padding: '8px 16px',
              minWidth: '80px'
            }}
          >
            Personal
          </button>
          <button
            className={`time-button ${rgaViewMode === 'mga' ? 'active' : ''}`}
            onClick={() => {
              setRgaViewMode('mga');
              console.log('📊 [RGA Dashboard] Switched to MGA view mode');
            }}
            style={{ 
              fontSize: '14px', 
              padding: '8px 16px',
              minWidth: '80px'
            }}
          >
            MGA
          </button>
          <button
            className={`time-button ${rgaViewMode === 'rga' ? 'active' : ''}`}
            onClick={() => {
              setRgaViewMode('rga');
              console.log('📊 [RGA Dashboard] Switched to RGA view mode');
            }}
            style={{ 
              fontSize: '14px', 
              padding: '8px 16px',
              minWidth: '80px'
            }}
          >
            RGA
          </button>
        </div>
      )}
      
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
              const sectionCards = getSectionCards(sectionType);
              if (!sectionCards || sectionCards.length === 0) return null;

              const sectionData = getSectionData(sectionType);
              const sectionTitle = getSectionTitle(sectionType);

              return (
                <DashboardSection
                  key={sectionType}
                  title={sectionTitle}
                  cards={sectionCards}
                  data={sectionData}
                  formatCurrency={formatCurrency}
                  formatDateRange={formatDateRange}
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