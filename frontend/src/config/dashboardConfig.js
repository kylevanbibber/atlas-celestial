/**
 * Dashboard Configuration
 * 
 * This file contains the unified configuration for all dashboard types.
 * Each clname (user role) has specific API endpoints, data processing logic,
 * and UI sections that should be displayed.
 */

import { FiActivity, FiDollarSign, FiUsers, FiTrendingUp } from 'react-icons/fi';

/**
 * Dashboard sections that can be displayed
 */
export const DASHBOARD_SECTIONS = {
  YTD_PERFORMANCE: 'ytd_performance',
  LAST_MONTH_PERFORMANCE: 'last_month_performance', 
  REPORTED_ACTIVITY: 'reported_activity',
  LEADERBOARD: 'leaderboard'
};

/**
 * Card types for each section
 */
export const CARD_TYPES = {
  // YTD Performance Cards
  YTD_ALP: 'ytd_alp',
  YTD_CODES_VIPS: 'ytd_codes_vips',
  YTD_HIRES: 'ytd_hires',
  YTD_REF_SALES: 'ytd_ref_sales',
  
  // Last Month Performance Cards
  MONTHLY_ALP: 'monthly_alp',
  MONTHLY_CODES_VIPS: 'monthly_codes_vips',
  MONTHLY_HIRES: 'monthly_hires',
  MONTHLY_REF_SALES: 'monthly_ref_sales',
  
  // Reported Activity Cards (This Month)
  DAILY_ALP: 'daily_alp',
  DAILY_REF_ALP: 'daily_ref_alp',
  DAILY_REFS: 'daily_refs',
  CURRENT_MONTH_REF_SALES: 'current_month_ref_sales'
};

/**
 * API endpoint configuration for each user role
 */
export const API_ENDPOINTS = {
  SGA: {
    weeklyYtd: '/dataroutes/sga-alp',
    monthlyAlp: '/dataroutes/sga-alp',
    associates: '/dataroutes/associates-sga',
    vips: '/dataroutes/vips-sga',
    hires: '/dataroutes/org-total-hires',
    dailyActivity: '/alp/daily/sum',
    refSales: '/alp/ref-sales',
    leaderboard: 'getweeklyall'
  },
  MGA: {
    weeklyYtd: '/alp/mga/weekly-ytd',
    monthlyAlp: '/alp/mga/monthly-alp',
    associates: '/alp/mga/associates',
    vips: '/alp/mga/vips',
    hires: '/alp/mga/hires',
    dailyActivity: '/alp/mga/daily-activity',
    refSales: '/alp/ref-sales',
    leaderboard: 'getweeklymga'
  },
  RGA: {
    weeklyYtd: '/alp/mga/weekly-ytd', // RGA uses MGA endpoints
    monthlyAlp: '/alp/mga/monthly-alp',
    associates: '/alp/mga/associates',
    vips: '/alp/mga/vips',
    hires: '/alp/mga/hires',
    dailyActivity: '/alp/mga/daily-activity',
    refSales: '/alp/ref-sales',
    leaderboard: 'getweeklyrga'
  },
  SA: {
    weeklyYtd: '/alp/mga/weekly-ytd', // SA uses MGA endpoints
    monthlyAlp: '/alp/mga/monthly-alp',
    associates: '/alp/mga/associates',
    vips: '/alp/mga/vips',
    hires: '/alp/mga/hires',
    dailyActivity: '/alp/mga/daily-activity',
    refSales: '/alp/ref-sales',
    leaderboard: 'getweeklysa'
  },
  GA: {
    weeklyYtd: '/alp/mga/weekly-ytd', // GA uses MGA endpoints
    monthlyAlp: '/alp/mga/monthly-alp',
    associates: '/alp/mga/associates',
    vips: '/alp/mga/vips',
    hires: '/alp/mga/hires',
    dailyActivity: '/alp/mga/daily-activity',
    refSales: '/alp/ref-sales',
    leaderboard: 'getweeklyga'
  },
  AGT: {
    weeklyYtd: '/alp/mga/weekly-ytd', // AGT uses MGA endpoints
    monthlyAlp: '/alp/mga/monthly-alp',
    associates: '/alp/mga/associates',
    vips: '/alp/mga/vips',
    hires: '/alp/mga/hires',
    dailyActivity: '/alp/mga/daily-activity',
    refSales: '/alp/ref-sales',
    leaderboard: 'getweeklyall' // Uses top producer leaderboard
  }
};

/**
 * Dashboard configuration for each user role
 */
export const DASHBOARD_CONFIG = {
  SGA: {
    title: 'SGA Dashboard',
    sections: [
      DASHBOARD_SECTIONS.REPORTED_ACTIVITY,
      DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE,
      DASHBOARD_SECTIONS.YTD_PERFORMANCE,
      DASHBOARD_SECTIONS.LEADERBOARD
    ],
    cards: {
      [DASHBOARD_SECTIONS.YTD_PERFORMANCE]: [
        {
          type: CARD_TYPES.YTD_ALP,
          title: 'YTD SGA ALP',
          dataKey: 'ytdAlp',
          icon: FiDollarSign,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'currency',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_CODES_VIPS,
          title: 'YTD Codes + VIPs',
          dataKey: 'ytdCodes',
          icon: FiActivity,
          iconColor: 'rgba(63, 81, 181, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_HIRES,
          title: 'YTD Hires',
          dataKey: 'ytdHires',
          icon: FiUsers,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_REF_SALES,
          title: 'YTD Ref Sales',
          dataKey: 'ytdRefSales',
          icon: FiTrendingUp,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/reports?report=ref-sales'
        }
      ],
      [DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE]: [
        {
          type: CARD_TYPES.MONTHLY_ALP,
          title: (monthName) => `${monthName} SGA ALP`,
          dataKey: 'currentMonthAlp',
          icon: FiDollarSign,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'currency',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_CODES_VIPS,
          title: (monthName) => `${monthName} Codes + VIPs`,
          dataKey: 'currentMonthCodes',
          icon: FiActivity,
          iconColor: 'rgba(63, 81, 181, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_HIRES,
          title: (monthName) => `${monthName} Hires`,
          dataKey: 'currentMonthHires',
          icon: FiUsers,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_REF_SALES,
          title: (monthName) => `${monthName} Ref Sales`,
          dataKey: 'totalRefSales',
          icon: FiDollarSign,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/reports?report=ref-sales'
        }
      ],
      [DASHBOARD_SECTIONS.REPORTED_ACTIVITY]: [
        {
          type: CARD_TYPES.DAILY_ALP,
          title: 'ALP',
          dataKey: 'totalAlp',
          icon: FiActivity,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'currency',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.DAILY_REF_ALP,
          title: 'Ref ALP',
          dataKey: 'totalRefAlp',
          icon: FiUsers,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'currency',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.DAILY_REFS,
          title: 'Refs Collected',
          dataKey: 'totalRefs',
          icon: FiUsers,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.CURRENT_MONTH_REF_SALES,
          title: 'Ref Sales',
          dataKey: 'totalRefSales',
          icon: FiTrendingUp,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'number',
          showDateRange: false,
          showAgentCount: false,
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/reports?report=ref-sales'
        }
      ]
    },
    leaderboard: {
      title: 'Top Producers',
      endpoint: 'getweeklyall'
    }
  },
  
  MGA: {
    title: 'MGA Dashboard',
    sections: [
      DASHBOARD_SECTIONS.REPORTED_ACTIVITY,
      DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE,
      DASHBOARD_SECTIONS.YTD_PERFORMANCE,
      DASHBOARD_SECTIONS.LEADERBOARD
    ],
    cards: {
      [DASHBOARD_SECTIONS.YTD_PERFORMANCE]: [
        {
          type: CARD_TYPES.YTD_ALP,
          title: 'YTD MGA ALP',
          dataKey: 'ytdAlp',
          icon: FiDollarSign,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'currency',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_CODES_VIPS,
          title: 'YTD Codes + VIPs',
          dataKey: 'ytdCodes',
          icon: FiActivity,
          iconColor: 'rgba(63, 81, 181, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_HIRES,
          title: 'YTD Hires',
          dataKey: 'ytdHires',
          icon: FiUsers,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_REF_SALES,
          title: 'YTD Ref Sales',
          dataKey: 'ytdRefSales',
          icon: FiTrendingUp,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/reports?report=ref-sales'
        }
      ],
      [DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE]: [
        {
          type: CARD_TYPES.MONTHLY_ALP,
          title: (monthName) => `${monthName} ALP`,
          dataKey: 'currentMonthAlp',
          icon: FiDollarSign,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'currency',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_CODES_VIPS,
          title: (monthName) => `${monthName} Codes + VIPs`,
          dataKey: 'currentMonthCodes',
          icon: FiActivity,
          iconColor: 'rgba(63, 81, 181, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_HIRES,
          title: (monthName) => `${monthName} Hires`,
          dataKey: 'currentMonthHires',
          icon: FiUsers,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_REF_SALES,
          title: (monthName) => `${monthName} Ref Sales`,
          dataKey: 'totalRefSales',
          icon: FiDollarSign,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/reports?report=ref-sales'
        }
      ],
      [DASHBOARD_SECTIONS.REPORTED_ACTIVITY]: [
        {
          type: CARD_TYPES.DAILY_ALP,
          title: 'ALP',
          dataKey: 'totalAlp',
          icon: FiActivity,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'currency',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.DAILY_REF_ALP,
          title: 'Ref ALP',
          dataKey: 'totalRefAlp',
          icon: FiUsers,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'currency',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.DAILY_REFS,
          title: 'Refs Collected',
          dataKey: 'totalRefs',
          icon: FiUsers,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.CURRENT_MONTH_REF_SALES,
          title: 'Ref Sales',
          dataKey: 'totalRefSales',
          icon: FiTrendingUp,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'number',
          showDateRange: false,
          showAgentCount: false,
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/reports?report=ref-sales'
        }
      ]
    },
    leaderboard: {
      title: 'Top MGAs',
      endpoint: 'getweeklymga'
    }
  },

  RGA: {
    title: 'RGA Dashboard',
    sections: [
      DASHBOARD_SECTIONS.REPORTED_ACTIVITY,
      DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE,
      DASHBOARD_SECTIONS.YTD_PERFORMANCE,
      DASHBOARD_SECTIONS.LEADERBOARD
    ],
    cards: {
      [DASHBOARD_SECTIONS.YTD_PERFORMANCE]: [
        {
          type: CARD_TYPES.YTD_ALP,
          title: 'YTD RGA ALP',
          dataKey: 'ytdAlp',
          icon: FiDollarSign,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'currency',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_CODES_VIPS,
          title: 'YTD Codes + VIPs',
          dataKey: 'ytdCodes',
          icon: FiActivity,
          iconColor: 'rgba(63, 81, 181, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_HIRES,
          title: 'YTD Hires',
          dataKey: 'ytdHires',
          icon: FiUsers,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_REF_SALES,
          title: 'YTD Ref Sales',
          dataKey: 'ytdRefSales',
          icon: FiTrendingUp,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/reports?report=ref-sales'
        }
      ],
      [DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE]: [
        {
          type: CARD_TYPES.MONTHLY_ALP,
          title: (monthName) => `${monthName} ALP`,
          dataKey: 'currentMonthAlp',
          icon: FiDollarSign,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'currency',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_CODES_VIPS,
          title: (monthName) => `${monthName} Codes + VIPs`,
          dataKey: 'currentMonthCodes',
          icon: FiActivity,
          iconColor: 'rgba(63, 81, 181, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_HIRES,
          title: (monthName) => `${monthName} Hires`,
          dataKey: 'currentMonthHires',
          icon: FiUsers,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_REF_SALES,
          title: (monthName) => `${monthName} Ref Sales`,
          dataKey: 'totalRefSales',
          icon: FiDollarSign,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/reports?report=ref-sales'
        }
      ],
      [DASHBOARD_SECTIONS.REPORTED_ACTIVITY]: [
        {
          type: CARD_TYPES.DAILY_ALP,
          title: 'ALP',
          dataKey: 'totalAlp',
          icon: FiActivity,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'currency',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.DAILY_REF_ALP,
          title: 'Ref ALP',
          dataKey: 'totalRefAlp',
          icon: FiUsers,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'currency',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.DAILY_REFS,
          title: 'Refs Collected',
          dataKey: 'totalRefs',
          icon: FiUsers,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.CURRENT_MONTH_REF_SALES,
          title: 'Ref Sales',
          dataKey: 'totalRefSales',
          icon: FiTrendingUp,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'number',
          showDateRange: false,
          showAgentCount: false,
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/reports?report=ref-sales'
        }
      ]
    },
    leaderboard: {
      title: 'Top RGAs',
      endpoint: 'getweeklyrga'
    }
  },

  SA: {
    title: 'SA Dashboard',
    sections: [
      DASHBOARD_SECTIONS.REPORTED_ACTIVITY,
      DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE,
      DASHBOARD_SECTIONS.YTD_PERFORMANCE,
      DASHBOARD_SECTIONS.LEADERBOARD
    ],
    cards: {
      [DASHBOARD_SECTIONS.YTD_PERFORMANCE]: [
        {
          type: CARD_TYPES.YTD_ALP,
          title: 'YTD SA ALP',
          dataKey: 'ytdAlp',
          icon: FiDollarSign,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'currency',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_CODES_VIPS,
          title: 'YTD Codes + VIPs',
          dataKey: 'ytdCodes',
          icon: FiActivity,
          iconColor: 'rgba(63, 81, 181, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_HIRES,
          title: 'YTD Hires',
          dataKey: 'ytdHires',
          icon: FiUsers,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_REF_SALES,
          title: 'YTD Ref Sales',
          dataKey: 'ytdRefSales',
          icon: FiTrendingUp,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/reports?report=ref-sales'
        }
      ],
      [DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE]: [
        {
          type: CARD_TYPES.MONTHLY_ALP,
          title: (monthName) => `${monthName} ALP`,
          dataKey: 'currentMonthAlp',
          icon: FiDollarSign,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'currency',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_CODES_VIPS,
          title: (monthName) => `${monthName} Codes + VIPs`,
          dataKey: 'currentMonthCodes',
          icon: FiActivity,
          iconColor: 'rgba(63, 81, 181, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_HIRES,
          title: (monthName) => `${monthName} Hires`,
          dataKey: 'currentMonthHires',
          icon: FiUsers,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_REF_SALES,
          title: (monthName) => `${monthName} Ref Sales`,
          dataKey: 'totalRefSales',
          icon: FiDollarSign,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/reports?report=ref-sales'
        }
      ],
      [DASHBOARD_SECTIONS.REPORTED_ACTIVITY]: [
        {
          type: CARD_TYPES.DAILY_ALP,
          title: 'ALP',
          dataKey: 'totalAlp',
          icon: FiActivity,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'currency',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.DAILY_REF_ALP,
          title: 'Ref ALP',
          dataKey: 'totalRefAlp',
          icon: FiUsers,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'currency',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.DAILY_REFS,
          title: 'Refs Collected',
          dataKey: 'totalRefs',
          icon: FiUsers,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.CURRENT_MONTH_REF_SALES,
          title: 'Ref Sales',
          dataKey: 'totalRefSales',
          icon: FiTrendingUp,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'number',
          showDateRange: false,
          showAgentCount: false,
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/reports?report=ref-sales'
        }
      ]
    },
    leaderboard: {
      title: 'Top SAs',
      endpoint: 'getweeklysa'
    }
  },

  GA: {
    title: 'GA Dashboard',
    sections: [
      DASHBOARD_SECTIONS.REPORTED_ACTIVITY,
      DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE,
      DASHBOARD_SECTIONS.YTD_PERFORMANCE,
      DASHBOARD_SECTIONS.LEADERBOARD
    ],
    cards: {
      [DASHBOARD_SECTIONS.YTD_PERFORMANCE]: [
        {
          type: CARD_TYPES.YTD_ALP,
          title: 'YTD GA ALP',
          dataKey: 'ytdAlp',
          icon: FiDollarSign,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'currency',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_CODES_VIPS,
          title: 'YTD Codes + VIPs',
          dataKey: 'ytdCodes',
          icon: FiActivity,
          iconColor: 'rgba(63, 81, 181, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_HIRES,
          title: 'YTD Hires',
          dataKey: 'ytdHires',
          icon: FiUsers,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_REF_SALES,
          title: 'YTD Ref Sales',
          dataKey: 'ytdRefSales',
          icon: FiTrendingUp,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/reports?report=ref-sales'
        }
      ],
      [DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE]: [
        {
          type: CARD_TYPES.MONTHLY_ALP,
          title: (monthName) => `${monthName} ALP`,
          dataKey: 'currentMonthAlp',
          icon: FiDollarSign,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'currency',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_CODES_VIPS,
          title: (monthName) => `${monthName} Codes + VIPs`,
          dataKey: 'currentMonthCodes',
          icon: FiActivity,
          iconColor: 'rgba(63, 81, 181, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_HIRES,
          title: (monthName) => `${monthName} Hires`,
          dataKey: 'currentMonthHires',
          icon: FiUsers,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_REF_SALES,
          title: (monthName) => `${monthName} Ref Sales`,
          dataKey: 'totalRefSales',
          icon: FiDollarSign,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/reports?report=ref-sales'
        }
      ],
      [DASHBOARD_SECTIONS.REPORTED_ACTIVITY]: [
        {
          type: CARD_TYPES.DAILY_ALP,
          title: 'ALP',
          dataKey: 'totalAlp',
          icon: FiActivity,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'currency',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.DAILY_REF_ALP,
          title: 'Ref ALP',
          dataKey: 'totalRefAlp',
          icon: FiUsers,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'currency',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.DAILY_REFS,
          title: 'Refs Collected',
          dataKey: 'totalRefs',
          icon: FiUsers,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.CURRENT_MONTH_REF_SALES,
          title: 'Ref Sales',
          dataKey: 'totalRefSales',
          icon: FiTrendingUp,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'number',
          showDateRange: false,
          showAgentCount: false,
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/reports?report=ref-sales'
        }
      ]
    },
    leaderboard: {
      title: 'Top GAs',
      endpoint: 'getweeklyga'
    }
  },
  
  AGT: {
    title: 'AGT Dashboard',
    sections: [
      DASHBOARD_SECTIONS.REPORTED_ACTIVITY,
      DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE,
      DASHBOARD_SECTIONS.YTD_PERFORMANCE,
      DASHBOARD_SECTIONS.LEADERBOARD
    ],
    cards: {
      [DASHBOARD_SECTIONS.YTD_PERFORMANCE]: [
        {
          type: CARD_TYPES.YTD_ALP,
          title: 'YTD AGT ALP',
          dataKey: 'ytdAlp',
          icon: FiDollarSign,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'currency',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.YTD_REF_SALES,
          title: 'YTD Ref Sales',
          dataKey: 'ytdRefSales',
          icon: FiTrendingUp,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'year',
          navigateTo: '/reports?report=ref-sales'
        }
      ],
      [DASHBOARD_SECTIONS.LAST_MONTH_PERFORMANCE]: [
        {
          type: CARD_TYPES.MONTHLY_ALP,
          title: (monthName) => `${monthName} ALP`,
          dataKey: 'currentMonthAlp',
          icon: FiDollarSign,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'currency',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/production?section=scorecard'
        },
        {
          type: CARD_TYPES.MONTHLY_REF_SALES,
          title: (monthName) => `${monthName} Ref Sales`,
          dataKey: 'totalRefSales',
          icon: FiDollarSign,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/reports?report=ref-sales'
        }
      ],
      [DASHBOARD_SECTIONS.REPORTED_ACTIVITY]: [
        {
          type: CARD_TYPES.DAILY_ALP,
          title: 'ALP',
          dataKey: 'totalAlp',
          icon: FiActivity,
          iconColor: 'rgba(255, 152, 0, 0.1)',
          format: 'currency',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.DAILY_REF_ALP,
          title: 'Ref ALP',
          dataKey: 'totalRefAlp',
          icon: FiUsers,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'currency',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.DAILY_REFS,
          title: 'Refs Collected',
          dataKey: 'totalRefs',
          icon: FiUsers,
          iconColor: 'rgba(156, 39, 176, 0.1)',
          format: 'number',
          showDateRange: true,
          showAgentCount: true,
          navigateTo: '/daily-activity'
        },
        {
          type: CARD_TYPES.CURRENT_MONTH_REF_SALES,
          title: 'Ref Sales',
          dataKey: 'totalRefSales',
          icon: FiTrendingUp,
          iconColor: 'rgba(76, 175, 80, 0.1)',
          format: 'number',
          showDateRange: false,
          showAgentCount: false,
          showComparison: true,
          comparisonType: 'month',
          navigateTo: '/reports?report=ref-sales'
        }
      ]
    },
    leaderboard: {
      title: 'Top Producers',
      endpoint: 'getweeklyall'
    }
  }
};

/**
 * Get dashboard configuration for a specific user role
 */
export const getDashboardConfig = (userRole) => {
  return DASHBOARD_CONFIG[userRole] || null;
};

/**
 * Get API endpoints for a specific user role
 */
export const getApiEndpoints = (userRole) => {
  return API_ENDPOINTS[userRole] || null;
};