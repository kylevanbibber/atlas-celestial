import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FiRefreshCw, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import Leaderboard from '../../utils/Leaderboard';
import Card from '../../utils/Card';
import DateRangeSelector from '../../dashboard/DateRangeSelector';
import api from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useHeader } from '../../../context/HeaderContext';
import ReportMore from './ReportMore';
import MoreReportingStatus from './MoreReportingStatus';
import { calculateRanksWithTies, calculateAchievement, findPreviousRank, calculateWeeksAtNumberOne } from '../../../utils/rankingUtils';
import { formatLocalDate, getMondayOfWeek, getSundayOfWeek } from '../../../utils/dateRangeUtils';
import { createExportFunction } from '../../../utils/exportUtils';
import './MoreReport.css';



// MORE Report component - Monthly Operations & Recruiting Excellence
const MoreReport = () => {
  const { user } = useAuth();
  const { setHeaderContent } = useHeader();
  const userRole = user?.clname?.toUpperCase();
  const isGlobalAdmin = userRole === 'SGA' || user?.teamRole === 'app' || user?.Role === 'Admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [moreData, setMoreData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [summaryCards, setSummaryCards] = useState([]);
  
  // Date range state - using DateRangeSelector
  const [rangeType, setRangeType] = useState('week'); // 'week', 'month', 'year'
  const [selectorDateRange, setSelectorDateRange] = useState(() => {
    // Initialize with current week
    const now = new Date();
    const monday = getMondayOfWeek(now);
    const sunday = getSundayOfWeek(now);
    return { start: formatLocalDate(monday), end: formatLocalDate(sunday) };
  });
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const monday = getMondayOfWeek(now);
    const sunday = getSundayOfWeek(now);
    return { start_date: formatLocalDate(monday), end_date: formatLocalDate(sunday), type: 'week' };
  });

  // View scope state (MGA / RGA) with role-based default
  const [viewScope, setViewScope] = useState(() => {
    if (isGlobalAdmin) return 'rga';
    if (userRole === 'RGA') return 'mga';
    return 'mga'; // MGA and below default to MGA view
  });

  // Hierarchy MGAs for RGA rollup
  const [hierarchyMGAs, setHierarchyMGAs] = useState([]);
  
  // Filter states - simplified to remove hierarchy level
  const [filters, setFilters] = useState({
    // Date range filter
    dateRange: { start: null, end: null },
    // Always default to MGA level
    hierarchyLevel: 'mga'
  });
  
  // Filter options
  const [filterOptions, setFilterOptions] = useState({
    weeks: [],
    months: [],
    years: [],
    mgas: [],
    rgas: [],
    legacies: [],
    trees: []
  });
  
  // Export preparation state
  const [isPreparedForExport, setIsPreparedForExport] = useState(false);

  // Handle DateRangeSelector changes
  const handleDateRangeChange = useCallback(({ start, end }) => {
    setSelectorDateRange({ start, end });
    setDateRange(prev => ({
      start_date: start,
      end_date: end,
      type: prev.type
    }));
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setRangeType(mode);
    setDateRange(prev => ({ ...prev, type: mode }));
  }, []);

  const handleViewScopeChange = useCallback((scope) => {
    setViewScope(scope);
    // Update hierarchy level filter to match scope
    setFilters(prev => ({ ...prev, hierarchyLevel: scope === 'rga' ? 'rga' : 'mga' }));
  }, []);

  // Fetch RGA hierarchy when in RGA view scope
  useEffect(() => {
    if (viewScope !== 'rga') {
      setHierarchyMGAs([]);
      return;
    }
    const fetchRollup = async () => {
      try {
        const res = await api.get(`/mga-hierarchy/rga-rollup/${encodeURIComponent(user.lagnname)}`);
        if (res?.data?.success) {
          const mgas = res.data.data.mgas || [];
          setHierarchyMGAs(mgas.map(m => m.lagnname).filter(Boolean));
        }
      } catch (e) {
        console.warn('Failed to load RGA rollup for MORE report', e);
        setHierarchyMGAs([]);
      }
    };
    if (user?.lagnname) fetchRollup();
  }, [viewScope, user?.lagnname]);

  // Build scope options for the DateRangeSelector
  // MGA users only see MGA; RGA and admins see MGA + RGA
  const scopeOptions = React.useMemo(() => {
    const options = [{ value: 'mga', label: 'MGA' }];
    if (userRole === 'RGA' || isGlobalAdmin) {
      options.push({ value: 'rga', label: 'RGA' });
    }
    return options;
  }, [userRole, isGlobalAdmin]);

  // Set header content with DateRangeSelector
  useEffect(() => {
    setHeaderContent(
      <DateRangeSelector
        dateRange={selectorDateRange}
        onDateRangeChange={handleDateRangeChange}
        viewMode={rangeType}
        onViewModeChange={handleViewModeChange}
        viewScope={viewScope}
        onViewScopeChange={handleViewScopeChange}
        scopeOptions={scopeOptions}
        weekMode="friday"
      />
    );
    return () => setHeaderContent(null);
  }, [selectorDateRange, rangeType, viewScope, scopeOptions, setHeaderContent, handleDateRangeChange, handleViewModeChange, handleViewScopeChange]);
  
  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Apply filters when they change, dateRange changes, or viewScope/hierarchy changes
  useEffect(() => {
    if (dateRange) {
      applyFilters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, moreData, dateRange, viewScope, hierarchyMGAs]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadMoreData(),
        loadFilterOptions()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError('Failed to load MORE data');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreData = async () => {
    try {
      const response = await api.get('/more/all-amore-data');
      if (response.data.success) {
        setMoreData(response.data.data);
      }
    } catch (error) {
      console.error('Error loading MORE data:', error);
      throw error;
    }
  };

  const loadFilterOptions = async () => {
    try {
      const response = await api.get('/more/filter-options');
      if (response.data.success) {
        setFilterOptions(response.data.data);
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
      throw error;
    }
  };

  const generateLeaderboardFromFilteredData = async (filtered) => {
    if (!filtered || filtered.length === 0) {
      setLeaderboardData([]);
      return;
    }

    let groupedData = {};

    // Helper to create default grouped entry
    const createEntry = (name, item, clname) => ({
      name,
      MGA: item.MGA,
      RGA: item.RGA,
      Legacy: item.Legacy,
      Tree: item.Tree,
      Total_Hires: 0,
      PR_Hires: 0,
      Non_PR_Hires: 0,
      Total_Internal_Hires: 0,
      Total_Vendor_Hires: 0,
      Finals_Set: 0,
      Finals_Show: 0,
      clname,
      periods: []
    });

    // Helper to accumulate totals
    const accum = (entry, item) => {
      entry.Total_Hires += item.Total_Hires || 0;
      entry.PR_Hires += item.PR_Hires || 0;
      entry.Non_PR_Hires += item.Non_PR_Hires || 0;
      entry.Total_Internal_Hires += item.Total_Internal_Hires || 0;
      entry.Total_Vendor_Hires += item.Total_Vendor_Hires || 0;
      entry.Finals_Set += item.Finals_Set || 0;
      entry.Finals_Show += item.Finals_Show || 0;
      entry.periods.push({
        date: item.MORE_Date,
        hires: item.Total_Hires || 0,
        finalsSet: item.Finals_Set || 0
      });
    };

    // Group data based on hierarchy level
    if (filters.hierarchyLevel === 'mga') {
      // Group by MGA
      groupedData = filtered.reduce((acc, item) => {
        const key = item.MGA;
        if (!acc[key]) acc[key] = createEntry(key, item, 'MGA');
        accum(acc[key], item);
        return acc;
      }, {});
    } else if (filters.hierarchyLevel === 'rga') {
      // Group by RGA
      groupedData = filtered.reduce((acc, item) => {
        const key = item.RGA || item.MGA;
        if (!acc[key]) acc[key] = createEntry(key, item, 'RGA');
        accum(acc[key], item);
        return acc;
      }, {});
    } else {
      // Individual level - use filtered data as-is
      groupedData = filtered.reduce((acc, item, index) => {
        const entry = createEntry(item.MGA, item, item.userRole || 'MGA');
        entry.MORE_Date = item.MORE_Date;
        accum(entry, item);
        acc[index] = entry;
        return acc;
      }, {});
    }

    // Convert to array and sort by Total_Hires, then by Total_Set
    const sortedLeaderboard = Object.values(groupedData)
      .sort((a, b) => {
        if (b.Total_Hires !== a.Total_Hires) {
          return b.Total_Hires - a.Total_Hires;
        }
        return b.Total_Set - a.Total_Set;
      });
    
    // Add ranks with tie handling
    const currentLeaderboard = calculateRanksWithTies(sortedLeaderboard, 'Total_Hires');

    // Calculate historical indicators
    const leaderboardWithIndicators = await calculateHistoricalIndicators(currentLeaderboard);
    
    setLeaderboardData(leaderboardWithIndicators);
  };

  const calculateHistoricalIndicators = async (currentLeaderboard) => {
    try {
      // Get previous period data for comparison
      const previousPeriodData = await getPreviousPeriodData();
      
      return currentLeaderboard.map(currentItem => {
        const indicators = {
          rankChange: null, // +2, -1, 0, "NEW"
          weeksAtNumber1: 0,
          achievement: null, // "🔥 HOT STREAK", "⭐ CONSISTENT", "📈 RISING"
          trend: null, // "up", "down", "stable"
          isRecord: false // Whether this is a personal record for this time period
        };

        // Calculate weeks at #1 (only for current #1)
        if (currentItem.rank === 1 && rangeType === 'week') {
          indicators.weeksAtNumber1 = calculateWeeksAtNumberOne(currentItem.name, previousPeriodData);
        }

        // Calculate ranking change from previous period
        if (previousPeriodData && previousPeriodData.length > 0) {
          const previousRank = findPreviousRank(currentItem.name, previousPeriodData);
          if (previousRank) {
            indicators.rankChange = previousRank - currentItem.rank; // Positive = moved up
            
            // Determine trend
            if (indicators.rankChange > 0) {
              indicators.trend = "up";
            } else if (indicators.rankChange < 0) {
              indicators.trend = "down";
            } else {
              indicators.trend = "stable";
            }
          } else {
            indicators.rankChange = "NEW";
            indicators.trend = "new";
          }
        }

        // Check if this is a personal record for this time period (only when specific period is selected)
        indicators.isRecord = dateRange && dateRange.start_date && dateRange.end_date
          ? checkPersonalRecord(currentItem.name, currentItem.Total_Hires, rangeType)
          : false;

        // Calculate achievements
        indicators.achievement = calculateAchievement(currentItem, indicators, rangeType);

        return {
          ...currentItem,
          indicators
        };
      });
    } catch (error) {
      console.error('Error calculating historical indicators:', error);
      return currentLeaderboard;
    }
  };

  const getPreviousPeriodData = async () => {
    if (!dateRange || !dateRange.start_date || !dateRange.end_date) return null;

    try {
      let previousPeriods = [];

      if (rangeType === 'week') {
        // Get previous week(s)
        const currentDates = [dateRange.start_date, dateRange.end_date].map(date => new Date(date));
        previousPeriods = currentDates.map(date => {
          const prevDate = new Date(date);
          prevDate.setDate(prevDate.getDate() - 7);
          return prevDate.toISOString().split('T')[0];
        });
      } else if (rangeType === 'month') {
        // Get previous month(s)
        previousPeriods = [dateRange.start_date, dateRange.end_date].map(monthValue => {
          const [year, month] = monthValue.split('-');
          const prevMonth = new Date(parseInt(year), parseInt(month) - 2, 1);
          return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
        });
      } else if (rangeType === 'year') {
        // Get previous year(s)
        previousPeriods = [dateRange.start_date, dateRange.end_date].map(year => (parseInt(year) - 1).toString());
      }

      // Filter moreData for previous periods
      const previousData = moreData.filter(item => {
        return previousPeriods.some(period => {
          if (rangeType === 'week') {
            return item.MORE_Date === period;
          } else if (rangeType === 'month') {
            const itemDate = new Date(item.MORE_Date);
            const [year, month] = period.split('-');
            return (
              itemDate.getFullYear().toString() === year &&
              (itemDate.getMonth() + 1).toString().padStart(2, '0') === month
            );
          } else if (rangeType === 'year') {
            return new Date(item.MORE_Date).getFullYear().toString() === period;
          }
          return false;
        });
      });

      if (previousData.length === 0) return null;

      // Generate previous period leaderboard
      let previousGrouped = {};
      
      if (filters.hierarchyLevel === 'mga') {
        previousGrouped = previousData.reduce((acc, item) => {
          const key = item.MGA;
          if (!acc[key]) {
            acc[key] = { name: key, Total_Hires: 0, Total_Set: 0 };
          }
          acc[key].Total_Hires += item.Total_Hires || 0;
          acc[key].Total_Set += item.Total_Set || 0;
          return acc;
        }, {});
      } else if (filters.hierarchyLevel === 'rga') {
        previousGrouped = previousData.reduce((acc, item) => {
          const key = item.RGA || item.MGA;
          if (!acc[key]) {
            acc[key] = { name: key, Total_Hires: 0, Total_Set: 0 };
          }
          acc[key].Total_Hires += item.Total_Hires || 0;
          acc[key].Total_Set += item.Total_Set || 0;
          return acc;
        }, {});
      }

      const sortedPreviousData = Object.values(previousGrouped)
        .sort((a, b) => {
          if (b.Total_Hires !== a.Total_Hires) {
            return b.Total_Hires - a.Total_Hires;
          }
          return b.Total_Set - a.Total_Set;
        });
      
      return calculateRanksWithTies(sortedPreviousData, 'Total_Hires');

    } catch (error) {
      console.error('Error getting previous period data:', error);
      return null;
    }
  };



  const checkPersonalRecord = (name, currentValue, periodType) => {
    try {
      // Must have specific period selected to calculate records
      if (!dateRange || !dateRange.start_date || !dateRange.end_date) {
        return false;
      }

      // Get current period info to exclude from historical comparison
      const currentPeriods = [dateRange.start_date, dateRange.end_date];
      
      // Get all historical data for this person
      const personHistoricalData = moreData.filter(item => {
        // Match by name based on hierarchy level
        let matches = false;
        if (filters.hierarchyLevel === 'mga') {
          matches = item.MGA === name;
        } else if (filters.hierarchyLevel === 'rga') {
          matches = item.RGA === name || item.MGA === name;
        }
        
        if (!matches) return false;

        // Exclude current period(s) from historical comparison
        const isCurrentPeriod = currentPeriods.some(period => {
          if (periodType === 'week') {
            return item.MORE_Date === period;
          } else if (periodType === 'month') {
            const itemDate = new Date(item.MORE_Date);
            const [year, month] = period.split('-');
            return (
              itemDate.getFullYear().toString() === year &&
              (itemDate.getMonth() + 1).toString().padStart(2, '0') === month
            );
          } else if (periodType === 'year') {
            return new Date(item.MORE_Date).getFullYear().toString() === period;
          }
          return false;
        });
        
        // Exclude current period
        if (isCurrentPeriod) return false;

        // For monthly records, only compare against the same month from different years
        if (periodType === 'month') {
          const itemDate = new Date(item.MORE_Date);
          const currentPeriod = currentPeriods[0]; // Use first selected period
          const [currentYear, currentMonth] = currentPeriod.split('-');
          return (itemDate.getMonth() + 1).toString().padStart(2, '0') === currentMonth;
        }
        
        return true;
      });

      // Group historical data by periods and sum up Total_Hires
      const historicalPerformance = [];
      
      if (periodType === 'week') {
        // Group by individual weeks (exclude current week)
        const weeklyData = {};
        personHistoricalData.forEach(item => {
          const weekKey = item.MORE_Date;
          if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = 0;
          }
          weeklyData[weekKey] += item.Total_Hires || 0;
        });
        historicalPerformance.push(...Object.values(weeklyData));
      } else if (periodType === 'month') {
        // Group by months (exclude current month)
        const monthlyData = {};
        personHistoricalData.forEach(item => {
          const itemDate = new Date(item.MORE_Date);
          const monthKey = `${itemDate.getFullYear()}-${(itemDate.getMonth() + 1).toString().padStart(2, '0')}`;
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = 0;
          }
          monthlyData[monthKey] += item.Total_Hires || 0;
        });
        historicalPerformance.push(...Object.values(monthlyData));
      } else if (periodType === 'year') {
        // Group by years (exclude current year)
        const yearlyData = {};
        personHistoricalData.forEach(item => {
          const itemDate = new Date(item.MORE_Date);
          const yearKey = itemDate.getFullYear().toString();
          if (!yearlyData[yearKey]) {
            yearlyData[yearKey] = 0;
          }
          yearlyData[yearKey] += item.Total_Hires || 0;
        });
        historicalPerformance.push(...Object.values(yearlyData));
      }

      // Need at least one historical period to compare against
      if (historicalPerformance.length === 0) {
        return false;
      }

      // Check if current value is better than all historical values
      const maxHistorical = Math.max(...historicalPerformance, 0);
      return currentValue > maxHistorical;

    } catch (error) {
      console.error('Error checking personal record:', error);
      return false;
    }
  };



  const applyFilters = () => {
    // Step 1: Apply date filter only (for leaderboard — shows everyone)
    let dateFiltered = [...moreData];

    if (dateRange && dateRange.start_date && dateRange.end_date) {
      dateFiltered = dateFiltered.filter(item => {
            const itemDate = new Date(item.MORE_Date);
        return itemDate >= new Date(dateRange.start_date) && itemDate <= new Date(dateRange.end_date);
      });
    }

    // Step 2: Apply viewScope filtering on top of date filter (for summary cards & reporting status)
    let scopeFiltered = [...dateFiltered];

    if (viewScope === 'mga' && !isGlobalAdmin) {
      // MGA view: only show the logged-in user's own data
      const myName = (user?.lagnname || '').toUpperCase();
      scopeFiltered = scopeFiltered.filter(item => (item.MGA || '').toUpperCase() === myName);
    } else if (viewScope === 'rga') {
      if (isGlobalAdmin) {
        // Global admins see all data in RGA view
      } else {
        // RGA view: show the RGA's own data + all their hierarchy MGAs
        const myName = (user?.lagnname || '').toUpperCase();
        const mgaNames = hierarchyMGAs.map(n => n.toUpperCase());
        const allowedNames = [myName, ...mgaNames];
        scopeFiltered = scopeFiltered.filter(item => allowedNames.includes((item.MGA || '').toUpperCase()));
      }
    }

    setFilteredData(scopeFiltered);
    
    // Calculate summary metrics from the scope-filtered data
    calculateSummaryCards(scopeFiltered);
    
    // Generate leaderboard from ALL date-filtered data (shows everyone, user row highlighted)
    generateLeaderboardFromFilteredData(dateFiltered).catch(error => {
      console.error('Error generating leaderboard:', error);
    });
  };

  const calculateSummaryCards = (data) => {
    const totals = data.reduce((acc, item) => {
      // Total hires breakdown
      acc.totalHires += item.Total_Hires || 0;
      acc.prHires += item.PR_Hires || 0;
      acc.nonPrHires += item.Non_PR_Hires || 0;

      // Personal recruiting breakdown
      acc.prFinalSet += item.PR_Final_Set || 0;
      acc.prFinalShow += item.PR_Final_Show || 0;
      acc.happenstancePrHires += item.Happenstance_PR_Hires || 0;
      acc.pprHires += item.PPR_Hires || 0;
      acc.socialMediaHires += item.Social_Media_Hires || 0;

      // Internal recruiting
      acc.internalFinalsSet += item.Internal_Finals_Set || 0;
      acc.internalFinalShow += item.Internal_Final_Show || 0;
      acc.totalInternalHires += item.Total_Internal_Hires || 0;

      // Vendor totals
      acc.totalVendorHires += item.Total_Vendor_Hires || 0;
      acc.webinarHires += item.Webinar_Hires || 0;
      acc.surveyHires += item.Survey_Hires || 0;
      acc.vendorFinalHires += item.Vendor_Final_Hires || 0;
      acc.vendorHiresPurchased += item.Vendor_Hires_Purchased || 0;

      // Overall finals
      acc.finalsSet += item.Finals_Set || 0;
      acc.finalsShow += item.Finals_Show || 0;

      return acc;
    }, {
      totalHires: 0, prHires: 0, nonPrHires: 0,
      prFinalSet: 0, prFinalShow: 0, happenstancePrHires: 0, pprHires: 0, socialMediaHires: 0,
      internalFinalsSet: 0, internalFinalShow: 0, totalInternalHires: 0,
      totalVendorHires: 0, webinarHires: 0, surveyHires: 0, vendorFinalHires: 0, vendorHiresPurchased: 0,
      finalsSet: 0, finalsShow: 0
    });

    // Hiring rate for finals subtext
    const hiringRate = totals.finalsShow > 0 ? ((totals.totalHires / totals.finalsShow) * 100) : 0;

    setSummaryCards([
      {
        title: "Total Hires",
        value: `${totals.totalHires}`,
        subText: `${totals.prHires} PR  ·  ${totals.nonPrHires} Non-PR`,
      },
      {
        title: "Personal (PR)",
        value: `${totals.prHires}`,
        subText: `${totals.happenstancePrHires} Hap · ${totals.pprHires} PPR · ${totals.socialMediaHires} Social`,
      },
      {
        title: "Internal",
        value: `${totals.totalInternalHires}`,
        subText: `${totals.internalFinalShow} / ${totals.internalFinalsSet} Finals`,
      },
      {
        title: "Vendor",
        value: `${totals.totalVendorHires}`,
        subText: `${totals.webinarHires} Web · ${totals.surveyHires} Surv · ${totals.vendorFinalHires + totals.vendorHiresPurchased} Purch`,
      },
      {
        title: "Finals",
        value: `${totals.finalsShow} / ${totals.finalsSet}`,
        subText: `${totals.totalHires} hires from ${totals.finalsShow} finals (${Math.round(hiringRate)}%)`,
      }
    ]);
  };



  // Create export function using utility
  const prepareForExport = createExportFunction(setIsPreparedForExport, {
    leaderboardData: leaderboardData,
    showTeamAggregation: false, // MoreReport doesn't show team aggregation
    selectedFilterValue: 'all'
  });


  // Export data for Reports component - Enhanced structure for dynamic export
  const exportData = {
    summary: {
      totalSets: filteredData.reduce((sum, item) => sum + (item.Total_Set || 0), 0),
      totalShows: filteredData.reduce((sum, item) => sum + (item.Total_Show || 0), 0),
      totalHires: filteredData.reduce((sum, item) => sum + (item.Total_Hires || 0), 0),
      prHires: filteredData.reduce((sum, item) => sum + (item.PR_Hires || 0), 0),
      finalsSet: filteredData.reduce((sum, item) => sum + (item.Finals_Set || 0), 0),
      finalsShow: filteredData.reduce((sum, item) => sum + (item.Finals_Show || 0), 0),
      conversionRate: filteredData.reduce((sum, item) => sum + (item.Total_Show || 0), 0) > 0 
        ? Math.round((filteredData.reduce((sum, item) => sum + (item.Total_Hires || 0), 0) / filteredData.reduce((sum, item) => sum + (item.Total_Show || 0), 0)) * 100)
        : 0
    },
    leaderboardData,
    // Enhanced chart data with all MORE table columns plus calculated ratios - ORDERED for logical analysis
    chartData: filteredData.map(item => {
      // Helper function to calculate percentage ratios safely
      const calcRatio = (numerator, denominator) => {
        return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
      };
      
      // Helper function to calculate decimal ratios safely
      const calcDecimalRatio = (numerator, denominator) => {
        return denominator > 0 ? Math.round((numerator / denominator) * 100) / 100 : 0;
      };

      // Calculate Finals to Hire rate (Finals_Show to Total_Hires)
      const finalsToHireRate = calcDecimalRatio(item.Total_Hires || 0, item.Finals_Show || 0);

      // Return data in the EXACT order requested for logical analysis
      return {
        // 1. Basic identification (ordered as requested)
        MORE_Date: item.MORE_Date,
        MGA: item.MGA,
        
        // 2. Total Hires (key metric first)
        Total_Hires_Key: item.Total_Hires || 0, // Primary value for chart display
        
        // 3-6. External metrics block
        External_Sets: item.External_Sets || 0,
        External_Shows: item.External_Shows || 0,
        External_Show_Ratio: calcRatio(item.External_Shows || 0, item.External_Sets || 0),
        
        // 7-9. Internal metrics block  
        Internal_Sets: item.Internal_Sets || 0,
        Internal_Shows: item.Internal_Shows || 0,
        Internal_Show_Ratio: calcRatio(item.Internal_Shows || 0, item.Internal_Sets || 0),
        
        // 10-12. Personal metrics block
        Personal_Sets: item.Personal_Sets || 0,
        Personal_Shows: item.Personal_Shows || 0,
        Personal_Show_Ratio: calcRatio(item.Personal_Shows || 0, item.Personal_Sets || 0),
        
        // 13-15. Total sets/shows block
        Total_Set: item.Total_Set || 0,
        Total_Show: item.Total_Show || 0,
        Total_Show_Ratio: calcRatio(item.Total_Show || 0, item.Total_Set || 0),
        
        // 16-17. Group invite block
        Group_Invite: item.Group_Invite || 0,
        Group_Invite_Percent: calcRatio(item.Group_Invite || 0, item.Total_Show || 0),
        
        // 18-20. Finals block
        Finals_Set: item.Finals_Set || 0,
        Finals_Show: item.Finals_Show || 0,
        Finals_Show_Ratio: calcRatio(item.Finals_Show || 0, item.Finals_Set || 0),
        
        // 21-23. Hires breakdown
        Non_PR_Hires: item.Non_PR_Hires || 0,
        PR_Hires: item.PR_Hires || 0,
        Total_Hires: item.Total_Hires || 0,
        
        // 24-27. Conversion ratios
        Set_to_Hire_Ratio: calcDecimalRatio(item.Total_Hires || 0, item.Total_Set || 0),
        Show_to_Hire_Ratio: calcDecimalRatio(item.Total_Hires || 0, item.Total_Show || 0),
        PR_Hire_Percentage: calcRatio(item.PR_Hires || 0, item.Total_Hires || 0),
        Finals_to_Hire_Rate: finalsToHireRate,
        
        // 28-29. Hierarchy info
        RGA: item.RGA || '',
        Tree: item.Tree || '',
        
        // Keep legacy fields for compatibility
        date: item.MORE_Date, // For chart display compatibility
        value: item.Total_Hires || 0 // Primary value for chart display
      };
    })
  };

  // ── Hires by Source table state & aggregation ──
  const [hiresSort, setHiresSort] = useState({ column: 'Total_Hires', direction: 'desc' });

  const hiresBreakdownData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];

    const grouped = {};
    filteredData.forEach(item => {
      const key = filters.hierarchyLevel === 'rga' ? (item.RGA || item.MGA) : item.MGA;
      if (!grouped[key]) {
        grouped[key] = {
          name: key,
          Total_Hires: 0,
          Happenstance_PR_Hires: 0,
          PPR_Hires: 0,
          Social_Media_Hires: 0,
          Webinar_Sets_Purchased: 0,
          Webinar_Finals_Set: 0,
          Webinar_Final_Show: 0,
          Webinar_Hires: 0,
          Surveys_Purchased: 0,
          Survey_Finals_Set: 0,
          Survey_Finals_Show: 0,
          Survey_Hires: 0,
          Vendor_Finals_Purchased: 0,
          Vendor_Final_Show: 0,
          Vendor_Final_Hires: 0,
          Vendor_Hires_Purchased: 0,
          Total_Vendor_Hires: 0,
          Internal_Webinar_Sets: 0,
          Internal_Finals_Set: 0,
          Internal_Final_Show: 0,
          Total_Internal_Hires: 0,
        };
      }
      const g = grouped[key];
      g.Total_Hires += item.Total_Hires || 0;
      g.Happenstance_PR_Hires += item.Happenstance_PR_Hires || 0;
      g.PPR_Hires += item.PPR_Hires || 0;
      g.Social_Media_Hires += item.Social_Media_Hires || 0;
      g.Webinar_Sets_Purchased += item.Webinar_Sets_Purchased || 0;
      g.Webinar_Finals_Set += item.Webinar_Finals_Set || 0;
      g.Webinar_Final_Show += item.Webinar_Final_Show || 0;
      g.Webinar_Hires += item.Webinar_Hires || 0;
      g.Surveys_Purchased += item.Surveys_Purchased || 0;
      g.Survey_Finals_Set += item.Survey_Finals_Set || 0;
      g.Survey_Finals_Show += item.Survey_Finals_Show || 0;
      g.Survey_Hires += item.Survey_Hires || 0;
      g.Vendor_Finals_Purchased += item.Vendor_Finals_Purchased || 0;
      g.Vendor_Final_Show += item.Vendor_Final_Show || 0;
      g.Vendor_Final_Hires += item.Vendor_Final_Hires || 0;
      g.Vendor_Hires_Purchased += item.Vendor_Hires_Purchased || 0;
      g.Total_Vendor_Hires += item.Total_Vendor_Hires || 0;
      g.Internal_Webinar_Sets += item.Internal_Webinar_Sets || 0;
      g.Internal_Finals_Set += item.Internal_Finals_Set || 0;
      g.Internal_Final_Show += item.Internal_Final_Show || 0;
      g.Total_Internal_Hires += item.Total_Internal_Hires || 0;
    });

    const arr = Object.values(grouped);
    const { column, direction } = hiresSort;
    arr.sort((a, b) => {
      const aVal = column === 'name' ? (a.name || '') : (a[column] || 0);
      const bVal = column === 'name' ? (b.name || '') : (b[column] || 0);
      if (column === 'name') {
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return arr;
  }, [filteredData, filters.hierarchyLevel, hiresSort]);

  const handleHiresSort = (column) => {
    setHiresSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Column definitions for the hires table
  const hiresColumns = [
    { key: 'name', label: viewScope === 'rga' ? 'RGA' : 'MGA', group: null, sticky: true },
    { key: 'Total_Hires', label: 'Total', group: null },
    { key: 'Happenstance_PR_Hires', label: 'Hap PR', group: 'PR' },
    { key: 'PPR_Hires', label: 'PPR', group: 'PR' },
    { key: 'Social_Media_Hires', label: 'Social', group: 'PR' },
    { key: 'Webinar_Sets_Purchased', label: 'Sets', group: 'Webinar' },
    { key: 'Webinar_Finals_Set', label: 'Finals Set', group: 'Webinar' },
    { key: 'Webinar_Final_Show', label: 'Finals Show', group: 'Webinar' },
    { key: 'Webinar_Hires', label: 'Hires', group: 'Webinar' },
    { key: 'Surveys_Purchased', label: 'Purchased', group: 'Survey' },
    { key: 'Survey_Finals_Set', label: 'Finals Set', group: 'Survey' },
    { key: 'Survey_Finals_Show', label: 'Finals Show', group: 'Survey' },
    { key: 'Survey_Hires', label: 'Hires', group: 'Survey' },
    { key: 'Vendor_Finals_Purchased', label: 'Finals Purch', group: 'Vendor' },
    { key: 'Vendor_Final_Show', label: 'Final Show', group: 'Vendor' },
    { key: 'Vendor_Final_Hires', label: 'Final Hires', group: 'Vendor' },
    { key: 'Vendor_Hires_Purchased', label: 'Hires Purch', group: 'Vendor' },
    { key: 'Total_Vendor_Hires', label: 'Total', group: 'Vendor' },
    { key: 'Internal_Webinar_Sets', label: 'Web Sets', group: 'Internal' },
    { key: 'Internal_Finals_Set', label: 'Finals Set', group: 'Internal' },
    { key: 'Internal_Final_Show', label: 'Final Show', group: 'Internal' },
    { key: 'Total_Internal_Hires', label: 'Total', group: 'Internal' },
  ];

  // Build group header spans
  const hiresGroupHeaders = useMemo(() => {
    const groups = [];
    let currentGroup = null;
    let span = 0;
    hiresColumns.forEach((col) => {
      if (col.group !== currentGroup) {
        if (currentGroup !== null || span > 0) {
          groups.push({ label: currentGroup || '', span });
        }
        currentGroup = col.group;
        span = 1;
      } else {
        span++;
      }
    });
    if (span > 0) groups.push({ label: currentGroup || '', span });
    return groups;
  }, []);

  if (loading) {
    return (
      <div className="route-loading" role="alert" aria-busy="true">
        <div className="spinner"></div>
        <p>Loading M.O.R.E data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>{error}</p>
        <button className="btn-primary" onClick={loadInitialData}>
          <FiRefreshCw size={16} /> Try Again
        </button>
      </div>
    );
  }

  // Determine whether to show reporting status:
  // - MGA view: never show
  // - RGA view: show only for weekly view, filtered by their MGAs
  const showReportingStatus = viewScope === 'rga' && rangeType === 'week';

  return (
    <div>
      {/* Weekly Reporting Section - Only show for MGA/RGA roles */}
      {(userRole === 'MGA' || userRole === 'RGA') && (
        <ReportMore 
          user={user} 
          onDataUpdate={loadInitialData}
        />
      )}

      {/* Summary Cards */}
      <div className="more-summary-section">
        <div className="more-summary-cards">
          {summaryCards.map((card, index) => (
            <Card
              key={index}
              title={card.title}
              value={card.value}
              subText={card.subText}
              donut={false}
            />
          ))}
        </div>
      </div>

      {/* Reporting Status Section - Only show for RGA view in weekly mode */}
      {showReportingStatus && (
        <div className="more-reporting-status-section">
          <MoreReportingStatus 
            amoreData={filteredData} 
            filters={{
              MGA: null,
              RGA: null,
              Tree: filters.Tree
            }}
            dateRange={dateRange}
            allowedMGAs={isGlobalAdmin ? null : [user?.lagnname, ...hierarchyMGAs].filter(Boolean)}
          />
        </div>
      )}

      {/* Leaderboard Section */}
      {leaderboardData.length > 0 && (
        <div className="more-leaderboard-section">
          <Leaderboard
            data={leaderboardData}
            title={`Top Performers - ${viewScope === 'rga' ? 'RGA' : 'MGA'} Level`}
            nameField="name"
            valueField="Total_Hires"
            secondaryValueField="PR_Hires"
            rankField="rank"
            variant="detailed"
            emptyMessage="No performance data available for selected period"
            formatValue={(value) => `${value} hires`}
            formatSecondaryValue={(value) => `${value} PR hires`}
            formatMovementIndicator={(item) => {
              if (!item?.indicators) return null;

              const { rankChange } = item.indicators;

              if (rankChange === "NEW") {
                return null;
              } else if (rankChange && rankChange !== 0) {
                const arrow = rankChange > 0 ? "▲" : "▼";
                return `${arrow}${Math.abs(rankChange)}`;
              } else if (rankChange === 0) {
                return "━";
              }

              return null;
            }}
            formatAchievementBadge={(item) => {
              if (!item?.indicators) return null;

              const { achievement, weeksAtNumber1 } = item.indicators;
              const achievements = [];

              if (item.rank === 1 && weeksAtNumber1 > 1 && achievement === "👑 CHAMPION") {
                achievements.push(`👑 ${weeksAtNumber1} week`);
              } else if (item.rank === 1 && weeksAtNumber1 > 1) {
                achievements.push(`👑 ${weeksAtNumber1} weeks`);
                if (achievement) {
                  achievements.push(achievement);
                }
              } else if (achievement) {
                achievements.push(achievement);
              }

              return achievements.length > 0 ? achievements.join(' • ') : null;
            }}
            currentUser={{ name: user?.lagnname, lagnname: user?.lagnname }}
            showMGA={false}
            showLevelBadge={true}
            maxHeight={isPreparedForExport ? "none" : "400px"}
            achievementColors={{
              hotStreak: "#ff6b35",
              champion: "#ffd700",
              risingStar: "#00d4aa",
              bigMover: "#6366f1",
              climbing: "#10b981",
              consistent: "#8b5cf6",
              record: "#dc2626",
              dethroned: "#7c2d12",
              default: "#6b7280"
            }}
            valueColorRanges={{
              high: {
                min: rangeType === 'week' ? 5 : rangeType === 'month' ? 20 : 50,
                colors: { backgroundColor: '#d1fae5', color: '#059669' }
              },
              medium: {
                min: rangeType === 'week' ? 2 : rangeType === 'month' ? 8 : 20,
                colors: { backgroundColor: '#fef3c7', color: '#d97706' }
              },
              low: {
                colors: { backgroundColor: '#fee2e2', color: '#dc2626' }
              }
            }}
            periodType={rangeType}
          />
        </div>
      )}

      {/* Hires by Source Breakdown Table */}
      {hiresBreakdownData.length > 0 && (
        <div className="hires-breakdown-section">
          <div className="hires-breakdown-header">
            <h3 className="hires-breakdown-title">Hires by Source</h3>
            <span className="hires-breakdown-subtitle">
              {viewScope === 'rga' ? 'RGA' : 'MGA'} Level &middot; {hiresBreakdownData.length} {hiresBreakdownData.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="hires-breakdown-table-wrapper">
            <table className="hires-breakdown-table">
              <thead>
                {/* Group header row */}
                <tr className="hires-group-header-row">
                  {hiresGroupHeaders.map((g, i) => (
                    <th
                      key={i}
                      colSpan={g.span}
                      className={`hires-group-th ${g.label ? '' : 'hires-group-th--empty'}`}
                    >
                      {g.label}
                    </th>
                  ))}
                </tr>
                {/* Column header row */}
                <tr className="hires-column-header-row">
                  {hiresColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`hires-col-th ${col.sticky ? 'hires-col-th--sticky' : ''} ${hiresSort.column === col.key ? 'hires-col-th--sorted' : ''}`}
                      onClick={() => handleHiresSort(col.key)}
                    >
                      <span className="hires-col-th-content">
                        {col.label}
                        {hiresSort.column === col.key && (
                          hiresSort.direction === 'desc'
                            ? <FiChevronDown className="hires-sort-icon" />
                            : <FiChevronUp className="hires-sort-icon" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hiresBreakdownData.map((row, idx) => {
                  const isCurrentUser = (user?.lagnname || '').toUpperCase() === (row.name || '').toUpperCase();
                  return (
                    <tr
                      key={row.name}
                      className={`hires-row ${isCurrentUser ? 'hires-row--current' : ''}`}
                    >
                      {hiresColumns.map((col) => {
                        const val = row[col.key];
                        if (col.key === 'name') {
                          return (
                            <td key={col.key} className="hires-cell hires-cell--name">
                              <span className="hires-rank">{idx + 1}</span>
                              {val}
                            </td>
                          );
                        }
                        const isTotal = col.key === 'Total_Hires' || col.key === 'Total_Vendor_Hires' || col.key === 'Total_Internal_Hires';
                        return (
                          <td
                            key={col.key}
                            className={`hires-cell ${isTotal ? 'hires-cell--total' : ''} ${val > 0 ? 'hires-cell--nonzero' : ''}`}
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="hires-row hires-row--totals">
                  {hiresColumns.map((col) => {
                    if (col.key === 'name') {
                      return <td key={col.key} className="hires-cell hires-cell--name hires-cell--totals-label">Totals</td>;
                    }
                    const total = hiresBreakdownData.reduce((sum, r) => sum + (r[col.key] || 0), 0);
                    return (
                      <td key={col.key} className="hires-cell hires-cell--total">
                        {total}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default MoreReport;
