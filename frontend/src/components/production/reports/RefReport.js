import React, { useState, useEffect } from 'react';
import { 
  FiUsers, 
  FiTrendingUp, 
  FiCalendar,
  FiDownload,
  FiRefreshCw,
  FiBarChart2,
  FiPieChart,
  FiInfo,
  FiFilter,
  FiX,
  FiClock,
  FiDollarSign,
  FiSend
} from 'react-icons/fi';
import Reports from './Reports';
import Leaderboard from '../../utils/Leaderboard';
import FilterMenu from '../../common/FilterMenu';
import RefChart from './RefChart';
import ComparisonText from '../../utils/ComparisonText';
import Card from '../../utils/Card';
import api from '../../../api';
import { calculateRanksWithTies, calculateAchievement, findPreviousRank, calculateWeeksAtNumberOne } from '../../../utils/rankingUtils';
import { calculateDateRange, parseDate, formatDateRange, getWeekStart } from '../../../utils/dateUtils';
import { updateFilterUrlParams, readFilterParamsFromUrl, clearFilterUrlParams } from '../../../utils/urlFilterUtils';
import { createExportFunction } from '../../../utils/exportUtils';
import './RefReport.css';

// RefReport component with URL parameter support for filters
// Supported URL parameters:
// - dateStart & dateEnd: Custom date range (YYYY-MM-DD format)
// - hierarchyLevel: 'all', 'sa', 'ga', or 'mga'
// - team: Team name for filtering (when hierarchy level is not 'all')
// - rangeType: 'week', 'month', or 'year' for date navigation
// - currentDate: Currently selected date for navigation (YYYY-MM-DD format)
// 
// Example URLs:
// /production?section=reports&report=referral-sales&hierarchyLevel=mga&team=Smith&rangeType=month&currentDate=2024-01-01
// /production?section=reports&report=referral-sales&dateStart=2024-01-01&dateEnd=2024-01-31
const RefReport = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [hierarchyLevel, setHierarchyLevel] = useState('all'); // 'all', 'sa', 'ga', 'mga'
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [teams, setTeams] = useState([]);
  const [agents, setAgents] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [expandedLeaderboardData, setExpandedLeaderboardData] = useState({});
  // New date navigation states
  const [rangeType, setRangeType] = useState('month'); // 'week', 'month', 'year'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateOptions, setDateOptions] = useState([]);
  
  // Export preparation state
  const [isPreparedForExport, setIsPreparedForExport] = useState(false);
  
  // Filter state for the FilterMenu
  const [activeFilters, setActiveFilters] = useState({
    // Date range filter
    dateRange: { start: null, end: null },
    // Hierarchy level filter
    hierarchyLevel: 'all',
    // Team filter  
    selectedTeam: 'all'
  });



  // Report configuration
  const reportConfig = {
    title: 'Referral Sales',
    description: 'Tracking referral sales performance',
    version: '1.0',
    category: 'Refs',
    frequency: 'Daily'
  };

  // Hierarchy level options
  const hierarchyOptions = [
    { value: 'all', label: 'All' },
    { value: 'sa', label: 'SA Level' },
    { value: 'ga', label: 'GA Level' },
    { value: 'mga', label: 'MGA Level' }
  ];

  // Clear historical data cache when filters change
  useEffect(() => {
    setHistoricalDataCache({});
  }, [hierarchyLevel, selectedTeam, rangeType]);

  // Load report data
  useEffect(() => {
    if (dateRange) {
      loadReportData(); // This now loads everything including leaderboard
    }
  }, [dateRange, hierarchyLevel, selectedTeam]);

  // Load teams when hierarchy level changes
  useEffect(() => {
    loadTeams();
    // Reset selected team when hierarchy level changes
    setSelectedTeam('all');
    setActiveFilters(prev => ({
      ...prev,
      selectedTeam: 'all'
    }));
  }, [hierarchyLevel]);

  // Load date options when range type changes
  useEffect(() => {
    loadDateOptions();
  }, [rangeType]);

  // Update date range when current date changes
  useEffect(() => {
    updateDateRangeFromCurrentDate();
  }, [currentDate, rangeType]);

  // URL Management - Load filters from URL on mount
  useEffect(() => {
    const urlFilterUpdates = readFilterParamsFromUrl({ hierarchyOptions });
    if (urlFilterUpdates) {
      
      // Apply URL filter updates to state
      if (urlFilterUpdates.dateRange !== undefined) {
        setActiveFilters(prev => ({
          ...prev,
          dateRange: urlFilterUpdates.dateRange
        }));
        
        // If custom date range is set, update the main dateRange state
        if (urlFilterUpdates.dateRange.start && urlFilterUpdates.dateRange.end) {
          setDateRange({
            start_date: urlFilterUpdates.dateRange.start,
            end_date: urlFilterUpdates.dateRange.end,
            type: 'custom'
          });
        }
      }
      
      if (urlFilterUpdates.hierarchyLevel !== undefined) {
        setHierarchyLevel(urlFilterUpdates.hierarchyLevel);
        setActiveFilters(prev => ({
          ...prev,
          hierarchyLevel: urlFilterUpdates.hierarchyLevel
        }));
      }
      
      if (urlFilterUpdates.selectedTeam !== undefined) {
        setSelectedTeam(urlFilterUpdates.selectedTeam);
        setActiveFilters(prev => ({
          ...prev,
          selectedTeam: urlFilterUpdates.selectedTeam
        }));
      }
      
      if (urlFilterUpdates.rangeType !== undefined) {
        setRangeType(urlFilterUpdates.rangeType);
      }
      
      if (urlFilterUpdates.currentDate !== undefined) {
        setCurrentDate(urlFilterUpdates.currentDate);
      }
    }
  }, []); // Only run on mount

  // Handle browser back/forward navigation for filters
  useEffect(() => {
    const handlePopState = () => {
      const urlFilterUpdates = readFilterParamsFromUrl({ hierarchyOptions });
      
      if (urlFilterUpdates) {
        
        // Apply URL filter updates to state
        if (urlFilterUpdates.dateRange !== undefined) {
          setActiveFilters(prev => ({
            ...prev,
            dateRange: urlFilterUpdates.dateRange
          }));
          
          if (urlFilterUpdates.dateRange.start && urlFilterUpdates.dateRange.end) {
            setDateRange({
              start_date: urlFilterUpdates.dateRange.start,
              end_date: urlFilterUpdates.dateRange.end,
              type: 'custom'
            });
          }
        }
        
        if (urlFilterUpdates.hierarchyLevel !== undefined) {
          setHierarchyLevel(urlFilterUpdates.hierarchyLevel);
          setActiveFilters(prev => ({
            ...prev,
            hierarchyLevel: urlFilterUpdates.hierarchyLevel
          }));
        }
        
        if (urlFilterUpdates.selectedTeam !== undefined) {
          setSelectedTeam(urlFilterUpdates.selectedTeam);
          setActiveFilters(prev => ({
            ...prev,
            selectedTeam: urlFilterUpdates.selectedTeam
          }));
        }
        
        if (urlFilterUpdates.rangeType !== undefined) {
          setRangeType(urlFilterUpdates.rangeType);
        }
        
        if (urlFilterUpdates.currentDate !== undefined) {
          setCurrentDate(urlFilterUpdates.currentDate);
        }
      } else {
        // No filter parameters, reset to defaults
        resetAllFilters();
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Filter handler functions for FilterMenu
  const handleDateRangeChange = (newDateRange) => {
    setActiveFilters(prev => ({
      ...prev,
      dateRange: newDateRange
    }));
    
    // Update URL with new date range
    updateFilterUrlParams({ dateRange: newDateRange });
    
    // If custom date range is set, update the main dateRange state
    if (newDateRange.start && newDateRange.end) {
      setDateRange({
        start_date: newDateRange.start,
        end_date: newDateRange.end,
        type: 'custom'
      });
    }
  };

  const handleHierarchyLevelChange = (newLevel) => {
    setActiveFilters(prev => ({
      ...prev,
      hierarchyLevel: newLevel
    }));
    setHierarchyLevel(newLevel);
    
    // Update URL with new hierarchy level
    updateFilterUrlParams({ hierarchyLevel: newLevel });
  };

  const handleTeamChange = (newTeam) => {
    setActiveFilters(prev => ({
      ...prev,
      selectedTeam: newTeam
    }));
    setSelectedTeam(newTeam);
    
    // Update URL with new team selection
    updateFilterUrlParams({ selectedTeam: newTeam });
  };

  const resetAllFilters = () => {
    setActiveFilters({
      dateRange: { start: null, end: null },
      hierarchyLevel: 'all',
      selectedTeam: 'all'
    });
    setHierarchyLevel('all');
    setSelectedTeam('all');
    setRangeType('month'); // Reset to default range type
    
    // Reset to current date for the date picker
    const today = new Date();
    setCurrentDate(today);
    const defaultRange = calculateDateRange(today.toISOString().split('T')[0], 'month');
    setDateRange(defaultRange);
    
    // Clear all filter parameters from URL
    clearFilterUrlParams();
  };



  const loadTeams = async () => {
    try {
      // Query backend for teams based on hierarchy level
      // Expected backend behavior:
      // - SA level: return unique values from 'sa' column + lagnname where clname = 'SA'
      // - GA level: return unique values from 'ga' column + lagnname where clname = 'GA'  
      // - MGA level: return unique values from 'mga' column + lagnname where clname = 'MGA' AND lagnname where clname = 'RGA'
      // - All level: return all teams across all hierarchy levels
      const response = await api.get('/ref-report/teams', {
        params: {
          hierarchy_level: hierarchyLevel
        }
      });

      const teamsData = response.data.data || [];
      
      // Add "All" option at the beginning
      const allOption = { 
        team_name: hierarchyLevel === 'all' ? 'All Teams' : `All ${hierarchyLevel.toUpperCase()} Teams`, 
        level: hierarchyLevel.toUpperCase(),
        value: 'all'
      };
      
      setTeams([allOption, ...teamsData]);

    } catch (err) {
      setTeams([{ team_name: 'All Teams', level: 'ALL', value: 'all' }]);
    }
  };

// 1️⃣ loadDateOptions
const loadDateOptions = async () => {
  try {
    const response = await api.get('/ref-report/date-options', {
      params: { range_type: rangeType }
    });
    const options = response.data.data || [];
    setDateOptions(options);

    if (options.length === 0) return;

    const today = new Date();
    let selectedOption = null;

    if (rangeType === 'month') {
      selectedOption = options.find(opt => {
        // Fix timezone issues - parse date string manually
        const [year, month, day] = opt.value.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      });
    } else if (rangeType === 'week') {
      const getMonday = d => {
        const dt = new Date(d);
        const day = dt.getDay();
        const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(dt.setDate(diff));
      };
      selectedOption = options.find(opt => {
        // Fix timezone issues - parse date string manually
        const [year, month, day] = opt.value.split('-').map(Number);
        const optDate = new Date(year, month - 1, day);
        return getMonday(optDate).getTime() === getMonday(today).getTime();
      });
    } else if (rangeType === 'year') {
      selectedOption = options.find(opt => {
        // Fix timezone issues - parse date string manually
        const [year, month, day] = opt.value.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        return d.getFullYear() === today.getFullYear();
      });
    }

    if (!selectedOption) {
      if (rangeType === 'month') {
        const m = new Date(today.getFullYear(), today.getMonth(), 1);
        selectedOption = {
          value: m.toISOString().split('T')[0],
          label: today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        };
      } else if (rangeType === 'week') {
        const monday = (() => {
          const d = new Date(today);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          return new Date(d.setDate(diff));
        })();
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        selectedOption = {
          value: monday.toISOString().split('T')[0],
          label: `${monday.toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'2-digit'})}-${sunday.toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'2-digit'})}`
        };
      } else if (rangeType === 'year') {
        const y = new Date(today.getFullYear(), 0, 1);
        selectedOption = {
          value: y.toISOString().split('T')[0],
          label: `${today.getFullYear()}`
        };
      }
    }

    const iso = selectedOption.value;
    // Fix timezone issues - parse date string manually
    const [year, month, day] = iso.split('-').map(Number);
    const baseDate = new Date(year, month - 1, day);
    setCurrentDate(baseDate);
    setDateRange(calculateDateRange(iso, rangeType));
  } catch (err) {
    setDateOptions([]);
  }
};


// 2️⃣ updateDateRangeFromCurrentDate
const updateDateRangeFromCurrentDate = () => {
  const iso = currentDate.toISOString().split('T')[0];
  setDateRange(calculateDateRange(iso, rangeType));
};


  const isSameRange = (date1, date2) => {
    if (rangeType === 'week') {
      // Check if dates are in the same week
      const getMonday = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
      };
      return getMonday(date1).getTime() === getMonday(date2).getTime();
    } else if (rangeType === 'month') {
      return date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
    } else if (rangeType === 'year') {
      return date1.getFullYear() === date2.getFullYear();
    }
    return false;
  };

  const navigateBackward = () => {
    const currentISOString = currentDate.toISOString();
    const currentIndex = dateOptions.findIndex(option => option.value === currentISOString.split('T')[0]);
    
    let newDate;
    if (currentIndex === -1) {
      // If current date isn't in options, find closest and go to next one
      const currentTime = currentDate.getTime();
      let closestIndex = 0;
      // Fix timezone issues - parse date string manually
      const [year0, month0, day0] = dateOptions[0].value.split('-').map(Number);
      const firstOptionDate = new Date(year0, month0 - 1, day0);
      let closestDistance = Math.abs(firstOptionDate.getTime() - currentTime);
      
      dateOptions.forEach((option, index) => {
        // Fix timezone issues - parse date string manually
        const [year, month, day] = option.value.split('-').map(Number);
        const optionDate = new Date(year, month - 1, day);
        const distance = Math.abs(optionDate.getTime() - currentTime);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      
      const nextIndex = Math.min(closestIndex + 1, dateOptions.length - 1);
      // Fix timezone issues - parse date string manually
      const [year, month, day] = dateOptions[nextIndex].value.split('-').map(Number);
      newDate = new Date(year, month - 1, day);
    } else {
      const nextIndex = Math.min(currentIndex + 1, dateOptions.length - 1);
      // Fix timezone issues - parse date string manually
      const [year, month, day] = dateOptions[nextIndex].value.split('-').map(Number);
      newDate = new Date(year, month - 1, day);
    }
    
    setCurrentDate(newDate);
    // Update URL with new current date
    updateFilterUrlParams({ currentDate: newDate });
  };

  const navigateForward = () => {
    const currentISOString = currentDate.toISOString();
    const currentIndex = dateOptions.findIndex(option => option.value === currentISOString.split('T')[0]);
    
    let newDate;
    if (currentIndex === -1) {
      // If current date isn't in options, find closest and go to previous one
      const currentTime = currentDate.getTime();
      let closestIndex = 0;
      // Fix timezone issues - parse date string manually
      const [year0, month0, day0] = dateOptions[0].value.split('-').map(Number);
      const firstOptionDate = new Date(year0, month0 - 1, day0);
      let closestDistance = Math.abs(firstOptionDate.getTime() - currentTime);
      
      dateOptions.forEach((option, index) => {
        // Fix timezone issues - parse date string manually
        const [year, month, day] = option.value.split('-').map(Number);
        const optionDate = new Date(year, month - 1, day);
        const distance = Math.abs(optionDate.getTime() - currentTime);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      
      const prevIndex = Math.max(closestIndex - 1, 0);
      // Fix timezone issues - parse date string manually
      const [year, month, day] = dateOptions[prevIndex].value.split('-').map(Number);
      newDate = new Date(year, month - 1, day);
    } else {
      const prevIndex = Math.max(currentIndex - 1, 0);
      // Fix timezone issues - parse date string manually
      const [year, month, day] = dateOptions[prevIndex].value.split('-').map(Number);
      newDate = new Date(year, month - 1, day);
    }
    
    setCurrentDate(newDate);
    // Update URL with new current date
    updateFilterUrlParams({ currentDate: newDate });
  };

  const calculateHistoricalIndicators = async (currentLeaderboard) => {
    try {
      // Get previous period data for comparison
      const previousPeriodData = await getPreviousPeriodData();
      
      // Process each item with async personal record checks
      const processedItems = await Promise.all(currentLeaderboard.map(async (currentItem) => {
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
            
            // Validation: Previous rank should be a reasonable number
            if (previousRank < 1 || previousRank > 1000) {
              indicators.rankChange = "NEW";
              indicators.trend = "new";
            } else {
              // Determine trend
              if (indicators.rankChange > 0) {
                indicators.trend = "up";
              } else if (indicators.rankChange < 0) {
                indicators.trend = "down";
              } else {
                indicators.trend = "stable";
              }
            }
          } else {
            indicators.rankChange = "NEW";
            indicators.trend = "new";
          }
        } else {
          indicators.rankChange = "NEW";
          indicators.trend = "new";
        }

        // Check if this is a personal record for this time period
        indicators.isRecord = dateRange && dateRange.start_date && dateRange.end_date
          ? await checkPersonalRecord(currentItem.name, currentItem.true_refs, rangeType)
          : false;

        // Calculate achievements
        indicators.achievement = calculateAchievement(currentItem, indicators, rangeType);

        return {
          ...currentItem,
          indicators
        };
      }));
      
      return processedItems;
    } catch (error) {
      return currentLeaderboard;
    }
  };

  const getPreviousPeriodData = async () => {
    if (!dateRange || !dateRange.start_date || !dateRange.end_date) {
      return null;
    }

    try {
      // Calculate previous period dates
      let previousStartDate, previousEndDate;
      
      // Fix timezone issues by parsing date string manually instead of using new Date(dateString)
      // which treats the string as UTC and can cause off-by-one day errors
      const parseDate = (dateString) => {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day); // month - 1 because JS months are 0-indexed
      };
      
      if (rangeType === 'week') {
        const currentStart = parseDate(dateRange.start_date);
        const currentEnd = parseDate(dateRange.end_date);
        previousStartDate = new Date(currentStart);
        previousStartDate.setDate(currentStart.getDate() - 7);
        previousEndDate = new Date(currentEnd);
        previousEndDate.setDate(currentEnd.getDate() - 7);
      } else if (rangeType === 'month') {
        const currentStart = parseDate(dateRange.start_date);
        previousStartDate = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1);
        previousEndDate = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0);
      } else if (rangeType === 'year') {
        const currentStart = parseDate(dateRange.start_date);
        const currentYear = currentStart.getFullYear();
        previousStartDate = new Date(currentYear - 1, 0, 1);
        previousEndDate = new Date(currentYear - 1, 11, 31);
      }

      if (!previousStartDate || !previousEndDate) {
        return null;
      }

      const previousStartStr = previousStartDate.toISOString().split('T')[0];
      const previousEndStr = previousEndDate.toISOString().split('T')[0];

      // Build query parameters for previous period
      const params = {
        hierarchy_level: hierarchyLevel,
        sort_by: 'true_refs',
        start_date: previousStartStr,
        end_date: previousEndStr
      };

      // Add team filter
      if (selectedTeam !== 'all') {
        params.team = selectedTeam;
      }

      const response = await api.get('/ref-report/dashboard', { params });
      const data = response.data.data;

      if (!data || !data.leaderboard || data.leaderboard.length === 0) {
        return null;
      }

      // Add ranks to previous period data
      const sortedPreviousData = data.leaderboard.sort((a, b) => {
        if (b.true_refs !== a.true_refs) {
          return b.true_refs - a.true_refs;
        }
        return b.total_refs - a.total_refs;
      });
      
      const rankedPreviousData = calculateRanksWithTies(sortedPreviousData, 'true_refs');
      
      return rankedPreviousData;

    } catch (error) {
      return null;
    }
  };



  // Cache for historical data to avoid repeated API calls
  const [historicalDataCache, setHistoricalDataCache] = useState({});

  // Fetch historical data for a specific person for personal record calculations
  const fetchHistoricalDataForPerson = async (name, periodType) => {
    try {
      // Create cache key
      const cacheKey = `${name}_${hierarchyLevel}_${selectedTeam}_${periodType}`;
      
      // Return cached data if available
      if (historicalDataCache[cacheKey]) {
        return historicalDataCache[cacheKey];
      }

      // Get a broader date range to capture historical data
      // Go back 2 years for comprehensive historical comparison
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - 2);

      const params = {
        hierarchy_level: hierarchyLevel,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        person_name: name // Filter for specific person
      };

      // Add team filter if applicable
      if (selectedTeam !== 'all') {
        params.team = selectedTeam;
      }

      const response = await api.get('/ref-report/historical-data', { params });
      
      let historicalData = [];
      
      if (response.data.success && response.data.data) {
        // Filter out current period data
        const currentStartDate = new Date(dateRange.start_date);
        const currentEndDate = new Date(dateRange.end_date);
        
        historicalData = response.data.data.filter(item => {
          const itemDate = new Date(item.date);
          
          // Exclude current period
          if (periodType === 'week') {
            const itemWeekStart = getWeekStart(itemDate);
            const currentWeekStart = getWeekStart(currentStartDate);
            return itemWeekStart.getTime() !== currentWeekStart.getTime();
          } else if (periodType === 'month') {
            return !(itemDate.getFullYear() === currentStartDate.getFullYear() && 
                    itemDate.getMonth() === currentStartDate.getMonth());
          } else if (periodType === 'year') {
            return itemDate.getFullYear() !== currentStartDate.getFullYear();
          }
          
          return itemDate < currentStartDate || itemDate > currentEndDate;
        });
      }
      
      // Cache the result
      setHistoricalDataCache(prev => ({
        ...prev,
        [cacheKey]: historicalData
      }));
      
      return historicalData;
    } catch (error) {
      // If the API endpoint doesn't exist, fall back to simplified record check
      // This ensures backward compatibility
      return [];
    }
  };

  const checkPersonalRecord = async (name, currentValue, periodType) => {
    try {
      // Must have specific period selected to calculate records
      if (!dateRange || !dateRange.start_date || !dateRange.end_date) {
        return false;
      }

      // Get historical data for this person
      const historicalData = await fetchHistoricalDataForPerson(name, periodType);
      
      if (!historicalData || historicalData.length === 0) {
        return false; // No historical data to compare against
      }

      // Group historical data by periods and sum up true_refs
      const historicalPerformance = [];
      
      if (periodType === 'week') {
        // Group by individual weeks (exclude current week)
        const weeklyData = {};
        historicalData.forEach(item => {
          const weekStart = getWeekStart(new Date(item.date));
          const weekKey = weekStart.toISOString().split('T')[0];
          if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = 0;
          }
          weeklyData[weekKey] += item.true_refs || 0;
        });
        historicalPerformance.push(...Object.values(weeklyData));
      } else if (periodType === 'month') {
        // Group by months (exclude current month)
        const monthlyData = {};
        historicalData.forEach(item => {
          const itemDate = new Date(item.date);
          const monthKey = `${itemDate.getFullYear()}-${(itemDate.getMonth() + 1).toString().padStart(2, '0')}`;
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = 0;
          }
          monthlyData[monthKey] += item.true_refs || 0;
        });
        historicalPerformance.push(...Object.values(monthlyData));
      } else if (periodType === 'year') {
        // Group by years (exclude current year)
        const yearlyData = {};
        historicalData.forEach(item => {
          const itemDate = new Date(item.date);
          const yearKey = itemDate.getFullYear().toString();
          if (!yearlyData[yearKey]) {
            yearlyData[yearKey] = 0;
          }
          yearlyData[yearKey] += item.true_refs || 0;
        });
        historicalPerformance.push(...Object.values(yearlyData));
      }

      // Need at least one historical period to compare against
      if (historicalPerformance.length === 0) {
        // Fallback to threshold-based record check if no historical data
        const recordThresholds = {
          week: 5,   // 5+ refs in a week is exceptional
          month: 20, // 20+ refs in a month is exceptional
          year: 80   // 80+ refs in a year is exceptional
        };
        
        const threshold = recordThresholds[periodType] || recordThresholds.month;
        const isThresholdRecord = currentValue >= threshold;
        
        return isThresholdRecord;
      }

      // Check if current value is better than all historical values
      const maxHistorical = Math.max(...historicalPerformance, 0);
      const isPersonalRecord = currentValue > maxHistorical;
      
      return isPersonalRecord;

    } catch (error) {
      // Fallback to threshold-based record check on error
      const recordThresholds = {
        week: 5,   // 5+ refs in a week is exceptional
        month: 20, // 20+ refs in a month is exceptional
        year: 80   // 80+ refs in a year is exceptional
      };
      
      const threshold = recordThresholds[periodType] || recordThresholds.month;
      return currentValue >= threshold;
    }
  };



  const loadReportData = async () => {
    setLoading(true);
    setError(null);
    setChartLoading(true);
    setLeaderboardLoading(true);



    try {
      // Build query parameters
      const params = {
        hierarchy_level: hierarchyLevel,
        sort_by: 'true_refs',
        activity_limit: 10
      };

      // Add team filter
      if (selectedTeam !== 'all') {
        params.team = selectedTeam;
      }

      // Add date range parameters
      if (dateRange && typeof dateRange === 'object' && dateRange.start_date && dateRange.end_date) {
        params.start_date = dateRange.start_date;
        params.end_date = dateRange.end_date;
      } else if (typeof dateRange === 'string') {
        // Fallback for old format
        params.date_range = dateRange;
      }

      // Single API call replaces multiple parallel calls
      const response = await api.get('/ref-report/dashboard', { params });
      const data = response.data.data;

      // Set all state from single response
      setReportData({
        summary: {
          totalRefs: data.summary.totalRefs || 0,
          activeRefs: data.summary.activeRefs || 0,
          completedRefs: data.summary.completedRefs || 0,
          rejectedRefs: data.summary.rejectedRefs || 0,
          conversionRate: data.summary.conversionRate || 0
        },
        previousPeriod: data.summary.previousPeriod
      });
      
      setChartData(data.dailyBreakdown || []);
      
      // Enhanced leaderboard with historical indicators
      const rawLeaderboard = data.leaderboard || [];
      
      // Sort and add proper ranks with tie handling
      const sortedLeaderboard = rawLeaderboard.sort((a, b) => {
        if (b.true_refs !== a.true_refs) {
          return b.true_refs - a.true_refs;
        }
        return b.total_refs - a.total_refs;
      });
      
      const rankedLeaderboard = calculateRanksWithTies(sortedLeaderboard, 'true_refs');
      const enhancedLeaderboard = await calculateHistoricalIndicators(rankedLeaderboard);
      setLeaderboardData(enhancedLeaderboard);
      
      setRecentActivity(data.recentActivity || []);

      // Process chart data to ensure consistent structure
      const processedChartData = (data.dailyBreakdown || []).map(day => ({
        ...day,
        // Ensure these fields are always numbers for chart consistency
        true_refs: day.true_refs || 0,
        user_true_refs: day.user_true_refs !== undefined ? day.user_true_refs : 0,
        team_true_refs: day.team_true_refs !== undefined ? day.team_true_refs : 0,
        total_refs: day.total_refs || 0,
        rejected_refs: day.rejected_refs || 0,
        pending_refs: day.pending_refs || 0,
        conversion_rate: day.conversion_rate || 0
      }));
      
      setChartData(processedChartData);

      // Chart loaded successfully
      if (data.dailyBreakdown && data.dailyBreakdown.length > 0) {
        setChartError(null);
      }

    } catch (err) {
      setError('Failed to load REF report data. Please try again.');
      setChartError('Failed to load chart data.');
    } finally {
      setLoading(false);
      setChartLoading(false);
      setLeaderboardLoading(false);
    }
  };

  const handleRefresh = () => {
    loadReportData(); // This now refreshes all data including leaderboard
  };

  // Handle expanding team to show agents
  const handleExpandTeam = async (teamItem, itemKey) => {
    // Clear any existing data for this item and set loading state
    setExpandedLeaderboardData(prev => {
      const updated = { ...prev };
      delete updated[itemKey]; // Clear existing data first
      return {
        ...updated,
        [itemKey]: { loading: true, data: [] }
      };
    });

    try {
      // Use the name field from the team item (this is the lagnname from database)
      const teamName = teamItem.name;
      
      const params = {
        team_name: teamName,
        hierarchy_level: hierarchyLevel,
        sort_by: 'true_refs'
      };
      
      // Add date range parameters
      if (dateRange && typeof dateRange === 'object' && dateRange.start_date && dateRange.end_date) {
        params.start_date = dateRange.start_date;
        params.end_date = dateRange.end_date;
      } else if (typeof dateRange === 'string') {
        // Fallback for old format
        params.date_range = dateRange;
      }
      
      const response = await api.get('/ref-report/team-agents', { params });
      const result = response.data;
      
      if (result.success) {
        // If no agents found, check if it's a date filtering issue
        if (!result.data || result.data.length === 0) {
          // Use backend metadata to provide helpful information
          const meta = result.meta || {};
          let emptyMessage = `No agents found for ${teamName} in the selected date range.`;
          
          if (meta.has_data_outside_range && meta.team_data_range) {
            emptyMessage = `No activity found for ${teamName} from ${dateRange.start_date} to ${dateRange.end_date}. This team has ${meta.team_data_range.total_refs} refs from ${meta.team_data_range.earliest} to ${meta.team_data_range.latest}. Try adjusting the date filter.`;
          } else if (meta.message) {
            emptyMessage = meta.message;
          }
          
          // Add a helpful message when no data exists for current date range
          const emptyStateData = [{
            name: `No activity in selected period`,
            raw_name: '',
            level: 'INFO',
            true_refs: 0,
            total_refs: 0,
            conversion_rate: 0,
            isEmptyState: true,
            emptyMessage: emptyMessage
          }];
          
          setExpandedLeaderboardData(prev => ({
            ...prev,
            [itemKey]: { loading: false, data: emptyStateData }
          }));
        } else {
          // Filter out any empty state data that might have been mixed in
          const validAgentData = (result.data || []).filter(agent => 
            agent && agent.name && agent.name.length > 3
          );
          
          setExpandedLeaderboardData(prev => ({
            ...prev,
            [itemKey]: { loading: false, data: validAgentData }
          }));
        }
      } else {
        setExpandedLeaderboardData(prev => ({
          ...prev,
          [itemKey]: { loading: false, data: [] }
        }));
      }
    } catch (error) {
      setExpandedLeaderboardData(prev => ({
        ...prev,
        [itemKey]: { loading: false, data: [] }
      }));
    }
  };

  // Create export function using utility
  const prepareForExport = createExportFunction(setIsPreparedForExport, {
    leaderboardData: leaderboardData,
    expandedLeaderboardData: expandedLeaderboardData,
    handleExpandItem: handleExpandTeam,
    showTeamAggregation: hierarchyLevel !== 'all',
    selectedFilterValue: selectedTeam
  });

  // Custom filter content for the header FilterMenu
  const customFilterContent = (
    <div className="ref-report-filter-content">
      {/* Date Navigation */}
      <div className="filter-group">
        <span className="filter-group-label" style={{
          fontWeight: '500',
          marginBottom: '8px',
          display: 'block',
          color: 'var(--text-primary)'
        }}>
          Date Navigation
        </span>
        <div className="navigation-container" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginBottom: '8px'
        }}>
          <button 
            className="nav-button" 
            onClick={navigateBackward}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--surface-color)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '14px',
              minWidth: '28px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {"<"}
          </button>

          <select
            className="date-dropdown"
            value={currentDate.toISOString().split('T')[0]}
            onChange={e => {
              const [y, m, d] = e.target.value.split('-').map(Number);
              const newDate = new Date(y, m - 1, d);
              setCurrentDate(newDate);
              // Update URL with new current date
              updateFilterUrlParams({ currentDate: newDate });
            }}
            style={{
              flex: 1,
              padding: '6px 8px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--surface-color)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              cursor: 'pointer',
              height: '32px',
              minWidth: '140px'
            }}
          >
            {dateOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button 
            className="nav-button" 
            onClick={navigateForward}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--surface-color)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '14px',
              minWidth: '28px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {">"}
          </button>
        </div>

        <div className="period-tabs" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          fontSize: '13px'
        }}>
          <span 
            className={rangeType === "week" ? "selected" : "unselected"} 
            onClick={() => {
              setRangeType("week");
              const newDate = new Date(); // Reset to current week
              setCurrentDate(newDate);
              // Update URL
              updateFilterUrlParams({ 
                rangeType: "week",
                currentDate: newDate
              });
            }}
            style={{
              padding: '4px 8px',
              cursor: 'pointer',
              borderRadius: '3px',
              backgroundColor: rangeType === "week" ? 'var(--primary-color)' : 'transparent',
              color: rangeType === "week" ? 'white' : 'var(--text-primary)',
              transition: 'all 0.2s ease',
              fontSize: '12px',
              fontWeight: rangeType === "week" ? '500' : '400'
            }}
          >
            W
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>|</span>
          <span 
            className={rangeType === "month" ? "selected" : "unselected"} 
            onClick={() => {
              setRangeType("month");
              const today = new Date();
              const newDate = new Date(today.getFullYear(), today.getMonth(), 1); // Reset to current month
              setCurrentDate(newDate);
              // Update URL
              updateFilterUrlParams({ 
                rangeType: "month",
                currentDate: newDate
              });
            }}
            style={{
              padding: '4px 8px',
              cursor: 'pointer',
              borderRadius: '3px',
              backgroundColor: rangeType === "month" ? 'var(--primary-color)' : 'transparent',
              color: rangeType === "month" ? 'white' : 'var(--text-primary)',
              transition: 'all 0.2s ease',
              fontSize: '12px',
              fontWeight: rangeType === "month" ? '500' : '400'
            }}
          >
            M
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>|</span>
          <span 
            className={rangeType === "year" ? "selected" : "unselected"} 
            onClick={() => {
              setRangeType("year");
              const today = new Date();
              const newDate = new Date(today.getFullYear(), 0, 1); // Reset to current year
              setCurrentDate(newDate);
              // Update URL
              updateFilterUrlParams({ 
                rangeType: "year",
                currentDate: newDate
              });
            }}
            style={{
              padding: '4px 8px',
              cursor: 'pointer',
              borderRadius: '3px',
              backgroundColor: rangeType === "year" ? 'var(--primary-color)' : 'transparent',
              color: rangeType === "year" ? 'white' : 'var(--text-primary)',
              transition: 'all 0.2s ease',
              fontSize: '12px',
              fontWeight: rangeType === "year" ? '500' : '400'
            }}
          >
            Y
          </span>
        </div>
      </div>


      {/* Hierarchy Level */}
      <div className="filter-group">
        <label className="filter-group-label" style={{
          fontWeight: '500',
          marginBottom: '8px',
          display: 'block',
          color: 'var(--text-primary)'
        }}>
          Hierarchy Level
        </label>
        <select
          value={hierarchyLevel}
          onChange={(e) => handleHierarchyLevelChange(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            background: 'var(--surface-color)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease',
            width: '100%'
          }}
        >
          {hierarchyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Team Selection - Only show when hierarchyLevel is not 'all' */}
      {hierarchyLevel !== 'all' && (
        <div className="filter-group">
          <label className="filter-group-label" style={{
            fontWeight: '500',
            marginBottom: '8px',
            display: 'block',
            color: 'var(--text-primary)'
          }}>
            Team
          </label>
          <select
            value={selectedTeam}
            onChange={(e) => handleTeamChange(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              background: 'var(--surface-color)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'border-color 0.2s ease',
              width: '100%'
            }}
          >
            {[...teams]
              .sort((a, b) => {
                // Keep "All" option at the top
                if (a.value === 'all') return -1;
                if (b.value === 'all') return 1;
                // Sort other teams alphabetically by team_name
                return a.team_name.localeCompare(b.team_name);
              })
              .map((team, index) => (
                <option key={index} value={team.value === 'all' ? 'all' : team.team_name}>
                  {team.team_name}
                </option>
              ))
            }
          </select>
        </div>
      )}

      {/* Custom Date Range */}
      <div className="filter-group">
        <label className="filter-group-label" style={{
          fontWeight: '500',
          marginBottom: '8px',
          display: 'block',
          color: 'var(--text-primary)'
        }}>
          Custom Date Range
        </label>
        <div className="date-range-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ minWidth: '80px', fontSize: '0.9rem' }}>Start Date:</label>
            <input 
              type="date" 
              value={activeFilters.dateRange.start || ''} 
              onChange={(e) => handleDateRangeChange({
                ...activeFilters.dateRange,
                start: e.target.value
              })}
              style={{ 
                flex: 1,
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ minWidth: '80px', fontSize: '0.9rem' }}>End Date:</label>
            <input 
              type="date" 
              value={activeFilters.dateRange.end || ''} 
              onChange={(e) => handleDateRangeChange({
                ...activeFilters.dateRange,
                end: e.target.value
              })}
              style={{ 
                flex: 1,
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
          
          {(activeFilters.dateRange.start || activeFilters.dateRange.end) && (
            <button
              onClick={() => handleDateRangeChange({ start: null, end: null })}
              style={{
                alignSelf: 'flex-end',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <FiX size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Reset button */}
      <div className="filter-actions" style={{ textAlign: 'right', marginTop: '16px' }}>
        <button 
          onClick={resetAllFilters}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            transition: 'all 0.2s ease',
            backgroundColor: 'var(--button-secondary-bg)',
            color: 'white'
          }}
        >
          Reset All Filters
        </button>
      </div>
    </div>
  );

  // Custom actions for this report - only FilterMenu now since Reports.js handles PDF export
  const reportActions = [
    {
      component: (
        <FilterMenu
          activeFilters={activeFilters}
          onResetFilters={resetAllFilters}
          menuType="expandable"
          buttonLabel={<><FiFilter size={16} /></>}
          position="bottom"
          customContent={customFilterContent}
          customContentOnly={true}
        />
      )
    }
  ];

  const getActivityIcon = (type) => {
    switch (type) {
      case 'new_ref': return <FiUsers className="activity-icon new" />;
      case 'conversion': return <FiTrendingUp className="activity-icon success" />;
      case 'meeting': return <FiCalendar className="activity-icon info" />;
      default: return <FiInfo className="activity-icon" />;
    }
  };

  const getActivityText = (activity) => {
    switch (activity.type) {
      case 'new_ref':
        return `${activity.agent} added new referral: ${activity.prospect}`;
      case 'conversion':
        return `${activity.agent} converted referral: ${activity.prospect}`;
      case 'meeting':
        return `${activity.agent} scheduled meeting with ${activity.prospect}`;
      default:
        return `Activity by ${activity.agent}`;
    }
  };

  // Generate dynamic leaderboard title based on hierarchy level
  const getLeaderboardTitle = () => {
    // Format the date range for display based on range type
    const formatDateRange = () => {
      if (!dateRange || !dateRange.start_date || !dateRange.end_date) {
        return new Date().toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
      }

      const startDate = new Date(dateRange.start_date + 'T00:00:00');
      const endDate = new Date(dateRange.end_date + 'T00:00:00');
      
      // Format based on range type
      if (rangeType === 'week') {
        // Week format: m/d/yy-m/d/yy
        const startMonth = startDate.getMonth() + 1;
        const startDay = startDate.getDate();
        const startYear = startDate.getFullYear().toString().slice(-2);
        
        const endMonth = endDate.getMonth() + 1;
        const endDay = endDate.getDate();
        const endYear = endDate.getFullYear().toString().slice(-2);
        
        return `${startMonth}/${startDay}/${startYear}-${endMonth}/${endDay}/${endYear}`;
      } else if (rangeType === 'month') {
        // Month format: month yy
        return startDate.toLocaleDateString('en-US', { 
          month: 'short', 
          year: '2-digit' 
        });
      } else if (rangeType === 'year') {
        // Year format: YYYY
        return startDate.getFullYear().toString();
      }
      
      // Fallback for custom ranges - use original logic
      if (dateRange.start_date === dateRange.end_date) {
        return startDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
      }
      
      // If it's the same month and year
      if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`;
      }
      
      // If it's the same year
      if (startDate.getFullYear() === endDate.getFullYear()) {
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      
      // Different years
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    };

    const dateStr = formatDateRange();

    if (selectedTeam !== 'all') {
      // Find the selected team details from the teams array
      const teamDetails = teams.find(team => team.team_name === selectedTeam || team.value === selectedTeam);
      
      if (teamDetails && teamDetails.team_name && teamDetails.team_name !== 'All Teams') {
        // Extract team last name and level
        const teamName = teamDetails.team_name;
        const teamLevel = teamDetails.level ? teamDetails.level.toLowerCase() : hierarchyLevel.toLowerCase();
        
        return `${dateStr} - ${teamName} ${teamLevel} Team - Ref Sales`;
      } else {
        // Fallback if team details not found
        return `${dateStr} - ${selectedTeam} Team - Ref Sales`;
      }
    }
    
    // When no specific team is selected, show hierarchy level or "Top Producers"
    switch (hierarchyLevel) {
      case 'sa':
        return `${dateStr} - Top SA Teams - Ref Sales`;
      case 'ga':
        return `${dateStr} - Top GA Teams - Ref Sales`;
      case 'mga':
        return `${dateStr} - Top MGA Teams - Ref Sales`;
      case 'all':
      default:
        return `${dateStr} - Top Producers - Ref Sales`;
    }
  };

  // Get secondary value field based on hierarchy level
  const getSecondaryValueField = () => {
    // When a specific team is selected, always show conversion rate for individual agents
    if (selectedTeam !== 'all') {
      return 'conversion_rate';
    }
    return hierarchyLevel !== 'all' ? 'agent_count' : 'conversion_rate';
  };

  // Format secondary value based on type
  const formatSecondaryValue = (value) => {
    // When a specific team is selected, always show conversion rate for individual agents
    if (selectedTeam !== 'all') {
      return `${value}% conversion`;
    }
    if (hierarchyLevel !== 'all') {
      return `${value} agent${value !== 1 ? 's' : ''}`;
    }
    return `${value}% conversion`;
  };

  // Get dynamic empty message
  const getEmptyMessage = () => {
    if (selectedTeam !== 'all') {
      return `No agents found in ${selectedTeam} team for the selected filters`;
    }
    if (hierarchyLevel !== 'all') {
      return `No ${hierarchyLevel.toUpperCase()} teams found for the selected filters`;
    }
    return "No agents found for the selected filters";
  };

  // fetchLeaderboard function removed - now handled by loadReportData via dashboard endpoint





  return (
    <Reports
      reportConfig={reportConfig}
      onBack={onBack}
      title={reportConfig.title}
      description={reportConfig.description}
      actions={reportActions}
      metadata={{
        category: reportConfig.category,
        frequency: reportConfig.frequency,
        lastUpdated: new Date()
      }}
      loading={loading}
      error={error}
      onRefresh={handleRefresh}
      onPrepareForExport={prepareForExport}
      fullScreenCapable={true}
      dateRange={dateRange}
      rangeType={rangeType}
      exportData={{
        summary: reportData?.summary,
        previousPeriod: reportData?.previousPeriod,
        leaderboardData: leaderboardData,
        expandedData: expandedLeaderboardData,
        chartData: chartData
      }}
    >
                  <div className="ref-report-content">

          {/* Summary Cards */}
          {reportData && (
            <div className="summary-cards">
              <Card
                title="Ref Sales"
                value={reportData.summary.completedRefs}
                subText={
                  <ComparisonText
                    currentValue={reportData.summary.completedRefs}
                    previousValue={reportData.previousPeriod?.prevCompletedRefs}
                    rangeType={rangeType}
                    showIcon={false}
                  />
                }
                backgroundIcon={FiUsers}
                backgroundIconSize={250}
                backgroundIconColor="rgba(167, 167, 167, 0.06)"
                backgroundIconOffsetY={45}
              />

              <Card
                title="Pending"
                value={reportData.summary.activeRefs}
                subText="Pending validation"
                donut={true}
                percentage={reportData.summary.totalRefs > 0 ? Math.round((reportData.summary.activeRefs / reportData.summary.totalRefs) * 100) : 0}
                donutColor="#f59e0b"
                backgroundIcon={FiClock}
                backgroundIconSize={250}
                backgroundIconColor="rgba(114, 114, 114, 0.04)"
                backgroundIconOffsetY={45}
              />

              <Card
                title="Total Submitted"
                value={reportData.summary.totalRefs}
                subText={
                  <ComparisonText
                    currentValue={reportData.summary.totalRefs}
                    previousValue={reportData.previousPeriod?.prevTotalRefs}
                    rangeType={rangeType}
                    showIcon={false}
                  />
                }
                backgroundIcon={FiSend}
                backgroundIconSize={250}
                backgroundIconColor="rgba(162, 162, 162, 0.06)"
                backgroundIconOffsetY={45}
              />
            </div>
          )}

          {/* REF Leaderboard */}
          <div className="leaderboard-section">
            {isPreparedForExport && (
              <div style={{
                background: '#e3f2fd',
                border: '1px solid #2196f3',
                borderRadius: '4px',
                padding: '8px 12px',
                marginBottom: '12px',
                fontSize: '14px',
                color: '#1976d2',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FiInfo size={16} />
                Preparing leaderboard for export - showing all {leaderboardData.length} entries
              </div>
            )}
            <Leaderboard
              data={leaderboardData}
              title={getLeaderboardTitle()}
              nameField="name"
              valueField="true_refs"
              secondaryValueField={getSecondaryValueField()}
              rankField="rank"
              showCount={null} // Show all participants
              variant="detailed"
              loading={leaderboardLoading}
              emptyMessage={getEmptyMessage()}
              formatValue={(value) => value}
              formatSecondaryValue={formatSecondaryValue}
              onItemClick={(agent) => {
                // Could navigate to agent details or show modal
              }}
              // Enhanced movement and achievement indicators
              formatMovementIndicator={(item) => {
                if (!item?.indicators) return null;
                
                const { rankChange } = item.indicators;
                
                if (rankChange === "NEW") {
                  return null; // Remove NEW indicators
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
                
                // Weeks at #1 indicator (only for rank 1) - special format for champion
                if (item.rank === 1 && weeksAtNumber1 > 1 && achievement === "👑 CHAMPION") {
                  achievements.push(`👑 ${weeksAtNumber1} week`);
                } else if (item.rank === 1 && weeksAtNumber1 > 1) {
                  achievements.push(`👑 ${weeksAtNumber1} weeks`);
                  if (achievement) {
                    achievements.push(achievement);
                  }
                } else if (achievement) {
                  // Regular achievement without weeks
                  achievements.push(achievement);
                }
                
                return achievements.length > 0 ? achievements.join(' • ') : null;
              }}
              achievementColors={{
                hotStreak: "#ff6b35", // Orange-red for hot streaks
                champion: "#ffd700", // Gold for champions
                risingStar: "#00d4aa", // Teal for rising stars
                bigMover: "#6366f1", // Indigo for big movers
                climbing: "#10b981", // Green for climbing
                consistent: "#8b5cf6", // Purple for consistent
                record: "#dc2626", // Red for records
                dethroned: "#7c2d12", // Dark red for dethroned
                default: "#6b7280" // Gray for default
              }}
              // Expandable functionality - only when showing team aggregation (not individual agents)
              allowExpansion={hierarchyLevel !== 'all' && hierarchyLevel !== undefined && selectedTeam === 'all'} // Only allow expansion for team views when no specific team is selected
              onExpandItem={handleExpandTeam}
              expandedData={expandedLeaderboardData}
              maxHeight={isPreparedForExport ? "none" : "500px"} // Remove height limit for PDF export
              // Name and profile picture settings
              nameFormat="FIRST_LAST" // Use "First Last" format
              showProfilePicture={true}
              profilePictureField="profile_picture"
              // New hierarchy and level badge display settings
              hierarchyLevel={hierarchyLevel}
              showMGA={['all', 'sa', 'ga'].includes(hierarchyLevel)}
              showLevelBadge={true}
              // Dynamic value colors for REF sales
              valueColorRanges={{
                high: {
                  min: rangeType === 'week' ? 3 : rangeType === 'month' ? 12 : 30,
                  colors: { backgroundColor: '#d1fae5', color: '#059669' }
                },
                medium: {
                  min: rangeType === 'week' ? 1 : rangeType === 'month' ? 4 : 10,
                  colors: { backgroundColor: '#fef3c7', color: '#d97706' }
                },
                low: {
                  colors: { backgroundColor: '#fee2e2', color: '#dc2626' }
                }
              }}
              periodType={rangeType}
            />
          </div>

          {/* Charts Section */}
          {/* <div className="charts-section">
            <div className="chart-container">
              <h3>Daily Approved Referrals</h3>
              <RefChart 
                data={Array.isArray(chartData) ? chartData : []}
                loading={chartLoading}
                error={chartError}
                height={400}
                showLegend={true}
              />
            </div>
          </div> */}

          {/* Recent Activity */}
          {/* <div className="activity-section">
            <h3>Recent Activity</h3>
            <div className="activity-list">
              {recentActivity.length > 0 ? recentActivity.map(activity => (
                <div key={activity.id} className="activity-item">
                  {getActivityIcon(activity.type)}
                  <div className="activity-content">
                    <p className="activity-text">{getActivityText(activity)}</p>
                    <span className="activity-date">
                      {new Date(activity.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="activity-placeholder">
                  <FiInfo size={24} />
                  <p>No recent activity found for the selected filters.</p>
                </div>
              )}
            </div>
          </div> */}

          {/* <div className="data-table-section">
            <h3>Detailed Data</h3>
            <div className="data-table-placeholder">
              <p>📊 Detailed data table would be rendered here</p>
              <p>This could include agent-specific metrics, individual REF status, timeline tracking, etc.</p>
            </div>
          </div> */}
        </div>
      </Reports>
    );
  };

export default RefReport; 