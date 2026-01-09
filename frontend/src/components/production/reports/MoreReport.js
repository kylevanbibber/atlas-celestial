import React, { useState, useEffect } from 'react';
import { 
  FiUsers, 
  FiTrendingUp, 
  FiActivity,
  FiBarChart2,
  FiCalendar,
  FiTarget,
  FiSettings,
  FiFilter,
  FiX,
  FiRefreshCw
} from 'react-icons/fi';
import Reports from './Reports';
import Leaderboard from '../../utils/Leaderboard';
import DataTable from '../../utils/DataTable';
import Card from '../../utils/Card';
import FilterMenu from '../../common/FilterMenu';
import api from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import ReportMore from './ReportMore';
import MoreReportingStatus from './MoreReportingStatus';
import { calculateRanksWithTies, calculateAchievement, findPreviousRank, calculateWeeksAtNumberOne } from '../../../utils/rankingUtils';
import { calculateDateRange, parseDate, formatDateRange } from '../../../utils/dateUtils';
import { updateFilterUrlParams, readFilterParamsFromUrl, clearFilterUrlParams } from '../../../utils/urlFilterUtils';
import { navigateBackward, navigateForward, findCurrentPeriodInOptions } from '../../../utils/dateNavigationUtils';
import { createExportFunction } from '../../../utils/exportUtils';
import './MoreReport.css';



// MORE Report component - Monthly Operations & Recruiting Excellence
const MoreReport = ({ onBack }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [moreData, setMoreData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [summaryCards, setSummaryCards] = useState([]);
  
  // New date navigation states (matching RefReport)
  const [rangeType, setRangeType] = useState('week'); // 'week', 'month', 'year'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateOptions, setDateOptions] = useState([]);
  const [dateRange, setDateRange] = useState(null);
  
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



  // Load date options from existing MORE data
  const loadDateOptions = () => {
    if (!moreData || moreData.length === 0) {
      setDateOptions([]);
      return;
    }

    let options = [];
    const today = new Date();

    if (rangeType === 'week') {
      // Get unique MORE_Date values (individual weeks)
      const uniqueDates = [...new Set(moreData.map(item => item.MORE_Date))].sort((a, b) => new Date(b) - new Date(a));
      options = uniqueDates.map(date => ({
        value: date,
        label: new Date(date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
      }));
    } else if (rangeType === 'month') {
      // Get unique months from MORE_Date values
      const monthSet = new Set();
      moreData.forEach(item => {
        const date = new Date(item.MORE_Date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthSet.add(monthKey);
      });
      
      const sortedMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
      options = sortedMonths.map(monthKey => {
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return {
          value: monthKey,
          label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        };
      });
    } else if (rangeType === 'year') {
      // Get unique years from MORE_Date values
      const yearSet = new Set();
      moreData.forEach(item => {
        const date = new Date(item.MORE_Date);
        yearSet.add(date.getFullYear());
      });
      
      const sortedYears = Array.from(yearSet).sort((a, b) => b - a);
      options = sortedYears.map(year => ({
        value: year.toString(),
        label: year.toString()
      }));
    }

    setDateOptions(options);

    // Set current selection to most recent option or find current period
    if (options.length > 0) {
      let selectedOption = options[0]; // Default to most recent

      if (rangeType === 'month') {
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const current = options.find(opt => opt.value === currentMonth);
        if (current) selectedOption = current;
      } else if (rangeType === 'year') {
        const currentYear = today.getFullYear().toString();
        const current = options.find(opt => opt.value === currentYear);
        if (current) selectedOption = current;
      }

      // Set the current date and date range based on selection
      if (rangeType === 'week') {
        setCurrentDate(new Date(selectedOption.value));
        setDateRange({
          start_date: selectedOption.value,
          end_date: selectedOption.value,
          type: 'week'
        });
      } else if (rangeType === 'month') {
        const [year, month] = selectedOption.value.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0);
        setCurrentDate(startDate);
        setDateRange({
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          type: 'month'
        });
      } else if (rangeType === 'year') {
        const year = parseInt(selectedOption.value);
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);
        setCurrentDate(startDate);
        setDateRange({
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          type: 'year'
        });
      }
    }
  };



  const handleNavigateBackward = () => {
    const result = navigateBackward(currentDate, dateOptions, rangeType);
    if (result) {
      setCurrentDate(result.newDate);
      setDateRange(result.newDateRange);
      updateFilterUrlParams({ currentDate: result.newDate });
    }
  };

  const handleNavigateForward = () => {
    const result = navigateForward(currentDate, dateOptions, rangeType);
    if (result) {
      setCurrentDate(result.newDate);
      setDateRange(result.newDateRange);
      updateFilterUrlParams({ currentDate: result.newDate });
    }
  };

  const resetAllFilters = () => {
    setFilters({
      dateRange: { start: null, end: null },
      hierarchyLevel: 'mga'
    });
    setRangeType('week'); // Reset to current week as requested
    
    // Reset will trigger loadDateOptions via useEffect which will set the most recent week
    
    // Clear all filter parameters from URL
    clearFilterUrlParams();
  };
  
  // Table columns configuration
  const tableColumns = [
    {
      Header: 'MGA',
      accessor: 'MGA',
      Cell: ({ value }) => <strong>{value}</strong>
    },
    {
      Header: 'Date',
      accessor: 'MORE_Date',
      Cell: ({ value }) => new Date(value).toLocaleDateString()
    },
    {
      Header: 'Total Sets',
      accessor: 'Total_Set',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Total Shows',
      accessor: 'Total_Show',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Group Invites',
      accessor: 'Group_Invite',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Finals Set',
      accessor: 'Finals_Set',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Finals Show',
      accessor: 'Finals_Show',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Total Hires',
      accessor: 'Total_Hires',
      Cell: ({ value }) => <span className="hire-count">{value || 0}</span>
    },
    {
      Header: 'PR Hires',
      accessor: 'PR_Hires',
      Cell: ({ value }) => <span className="pr-hire-count">{value || 0}</span>
    },
    // New recruiting breakdown fields
    {
      Header: 'PR Final Set',
      accessor: 'PR_Final_Set',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'PR Final Show',
      accessor: 'PR_Final_Show',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Happenstance PR Hires',
      accessor: 'Happenstance_PR_Hires',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'PPR Hires',
      accessor: 'PPR_Hires',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Social Media Hires',
      accessor: 'Social_Media_Hires',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Webinar Sets Purchased',
      accessor: 'Webinar_Sets_Purchased',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Webinar Finals Set',
      accessor: 'Webinar_Finals_Set',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Webinar Final Show',
      accessor: 'Webinar_Final_Show',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Webinar Hires',
      accessor: 'Webinar_Hires',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Surveys Purchased',
      accessor: 'Surveys_Purchased',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Survey Finals Set',
      accessor: 'Survey_Finals_Set',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Survey Finals Show',
      accessor: 'Survey_Finals_Show',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Survey Hires',
      accessor: 'Survey_Hires',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Vendor Finals Purchased',
      accessor: 'Vendor_Finals_Purchased',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Vendor Final Show',
      accessor: 'Vendor_Final_Show',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Vendor Final Hires',
      accessor: 'Vendor_Final_Hires',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Vendor Hires Purchased',
      accessor: 'Vendor_Hires_Purchased',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Total Vendor Hires',
      accessor: 'Total_Vendor_Hires',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Internal Webinar Sets',
      accessor: 'Internal_Webinar_Sets',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Internal Finals Set',
      accessor: 'Internal_Finals_Set',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Internal Final Show',
      accessor: 'Internal_Final_Show',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    },
    {
      Header: 'Total Internal Hires',
      accessor: 'Total_Internal_Hires',
      Cell: ({ value }) => <span className="metric-value">{value || 0}</span>
    }
  ];

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load date options when range type or data changes
  useEffect(() => {
    if (moreData && moreData.length > 0) {
      loadDateOptions();
    }
  }, [rangeType, moreData]);

  // Apply filters when they change or when dateRange changes
  useEffect(() => {
    if (dateRange) {
      applyFilters();
    }
  }, [filters, moreData, dateRange]);

  // URL Management - Load filters from URL on mount
  useEffect(() => {
    const urlFilterUpdates = readFilterParamsFromUrl();
    if (urlFilterUpdates) {
      console.log('Loading filters from URL:', urlFilterUpdates);
      
      if (urlFilterUpdates.dateRange !== undefined) {
      setFilters(prev => ({
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
      
      if (urlFilterUpdates.rangeType !== undefined) {
        setRangeType(urlFilterUpdates.rangeType);
      }
      
      if (urlFilterUpdates.currentDate !== undefined) {
        setCurrentDate(urlFilterUpdates.currentDate);
      }
    }
  }, []);

  // Handle browser back/forward navigation for filters
  useEffect(() => {
    const handlePopState = () => {
      const urlFilterUpdates = readFilterParamsFromUrl();
      
      if (urlFilterUpdates) {
        console.log('Browser navigation detected, updating filters:', urlFilterUpdates);
        
        if (urlFilterUpdates.dateRange !== undefined) {
          setFilters(prev => ({
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
        
        if (urlFilterUpdates.rangeType !== undefined) {
          setRangeType(urlFilterUpdates.rangeType);
        }
        
        if (urlFilterUpdates.currentDate !== undefined) {
          setCurrentDate(urlFilterUpdates.currentDate);
        }
      } else {
        console.log('No filter parameters in URL, resetting to defaults');
        resetAllFilters();
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

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

    // Group data based on hierarchy level
    if (filters.hierarchyLevel === 'mga') {
      // Group by MGA
      groupedData = filtered.reduce((acc, item) => {
        const key = item.MGA;
        if (!acc[key]) {
          acc[key] = {
            name: key,
            MGA: key,
            RGA: item.RGA,
            Legacy: item.Legacy,
            Tree: item.Tree,
            Total_Hires: 0,
            PR_Hires: 0,
            Total_Set: 0,
            Total_Show: 0,
            Finals_Set: 0,
            Finals_Show: 0,
            clname: 'MGA',
            periods: [] // Track individual periods for historical analysis
          };
        }
        acc[key].Total_Hires += item.Total_Hires || 0;
        acc[key].PR_Hires += item.PR_Hires || 0;
        acc[key].Total_Set += item.Total_Set || 0;
        acc[key].Total_Show += item.Total_Show || 0;
        acc[key].Finals_Set += item.Finals_Set || 0;
        acc[key].Finals_Show += item.Finals_Show || 0;
        acc[key].periods.push({
          date: item.MORE_Date,
          hires: item.Total_Hires || 0,
          sets: item.Total_Set || 0
        });
        return acc;
      }, {});
    } else if (filters.hierarchyLevel === 'rga') {
      // Group by RGA
      groupedData = filtered.reduce((acc, item) => {
        const key = item.RGA || item.MGA; // Fallback to MGA if no RGA
        if (!acc[key]) {
          acc[key] = {
            name: key,
            RGA: item.RGA,
            MGA: item.MGA,
            Legacy: item.Legacy,
            Tree: item.Tree,
            Total_Hires: 0,
            PR_Hires: 0,
            Total_Set: 0,
            Total_Show: 0,
            Finals_Set: 0,
            Finals_Show: 0,
            clname: 'RGA',
            periods: []
          };
        }
        acc[key].Total_Hires += item.Total_Hires || 0;
        acc[key].PR_Hires += item.PR_Hires || 0;
        acc[key].Total_Set += item.Total_Set || 0;
        acc[key].Total_Show += item.Total_Show || 0;
        acc[key].Finals_Set += item.Finals_Set || 0;
        acc[key].Finals_Show += item.Finals_Show || 0;
        acc[key].periods.push({
          date: item.MORE_Date,
          hires: item.Total_Hires || 0,
          sets: item.Total_Set || 0
        });
        return acc;
      }, {});
    } else {
      // Individual level - use filtered data as-is
      groupedData = filtered.reduce((acc, item, index) => {
        acc[index] = {
          name: item.MGA,
          MGA: item.MGA,
          RGA: item.RGA,
          Legacy: item.Legacy,
          Tree: item.Tree,
          Total_Hires: item.Total_Hires || 0,
          PR_Hires: item.PR_Hires || 0,
          Total_Set: item.Total_Set || 0,
          Total_Show: item.Total_Show || 0,
          Finals_Set: item.Finals_Set || 0,
          Finals_Show: item.Finals_Show || 0,
          clname: item.userRole || 'MGA',
          MORE_Date: item.MORE_Date,
          periods: [{
            date: item.MORE_Date,
            hires: item.Total_Hires || 0,
            sets: item.Total_Set || 0
          }]
        };
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
    let filtered = [...moreData];

    // Apply period filter
    if (dateRange && dateRange.start_date && dateRange.end_date) {
      filtered = filtered.filter(item => {
            const itemDate = new Date(item.MORE_Date);
        return itemDate >= new Date(dateRange.start_date) && itemDate <= new Date(dateRange.end_date);
      });
    }

    // Apply hierarchy filters - since we default to MGA, no additional filtering needed
    // The data is already at MGA level by default

    setFilteredData(filtered);
    
    // Calculate summary metrics from the same filtered data
    calculateSummaryCards(filtered);
    
    // Generate leaderboard from the same filtered data (client-side)
    generateLeaderboardFromFilteredData(filtered).catch(error => {
      console.error('Error generating leaderboard:', error);
    });
  };

  const calculateSummaryCards = (data) => {
    const totals = data.reduce((acc, item) => {
      acc.totalSets += item.Total_Set || 0;
      acc.totalShows += item.Total_Show || 0;
      acc.totalHires += item.Total_Hires || 0;
      acc.prHires += item.PR_Hires || 0;
      acc.finalsSet += item.Finals_Set || 0;
      acc.finalsShow += item.Finals_Show || 0;
      return acc;
    }, {
      totalSets: 0,
      totalShows: 0,
      totalHires: 0,
      prHires: 0,
      finalsSet: 0,
      finalsShow: 0
    });

    // Calculate conversion rates
    const setToShowRate = totals.totalSets > 0 ? ((totals.totalShows / totals.totalSets) * 100) : 0;
    const finalsConversionRate = totals.finalsSet > 0 ? ((totals.finalsShow / totals.finalsSet) * 100) : 0;
    const hiringEfficiency = totals.finalsShow > 0 ? ((totals.totalHires / totals.finalsShow) * 100) : 0;

    setSummaryCards([
      {
        title: "Overview",
        value: `${totals.totalShows} / ${totals.totalSets}`,
        subText: `Shows / Sets`,
        donut: true,
        percentage: Math.round(setToShowRate),
        donutColor: "#10b981"
      },
      {
        title: "Finals",
        value: `${totals.finalsShow} / ${totals.finalsSet}`,
        subText: `Shows / Sets`,
        donut: true,
        percentage: Math.round(finalsConversionRate),
        donutColor: "#3b82f6"
      },
      {
        title: "Hires",
        value: `${totals.totalHires} / ${totals.finalsShow}`,
        subText: `Hires / Finals`,
        donut: true,
        percentage: Math.round(hiringEfficiency),
        donutColor: "#f59e0b"
      }
    ]);
  };



  // Create export function using utility
  const prepareForExport = createExportFunction(setIsPreparedForExport, {
    leaderboardData: leaderboardData,
    showTeamAggregation: false, // MoreReport doesn't show team aggregation
    selectedFilterValue: 'all'
  });

  // Custom filter content for the header FilterMenu (matching RefReport)
  const customFilterContent = (
    <div className="more-report-filter-content">
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
            onClick={handleNavigateBackward}
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
            value={rangeType === 'week' ? (currentDate ? currentDate.toISOString().split('T')[0] : '') : 
                   rangeType === 'month' ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}` :
                   currentDate.getFullYear().toString()}
            onChange={e => {
              const value = e.target.value;
              let newDate;
              let newDateRange;
              
              if (rangeType === 'week') {
                newDate = new Date(value);
                newDateRange = {
                  start_date: value,
                  end_date: value,
                  type: 'week'
                };
              } else if (rangeType === 'month') {
                const [year, month] = value.split('-');
                const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                const endDate = new Date(parseInt(year), parseInt(month), 0);
                newDate = startDate;
                newDateRange = {
                  start_date: startDate.toISOString().split('T')[0],
                  end_date: endDate.toISOString().split('T')[0],
                  type: 'month'
                };
              } else if (rangeType === 'year') {
                const year = parseInt(value);
                const startDate = new Date(year, 0, 1);
                const endDate = new Date(year, 11, 31);
                newDate = startDate;
                newDateRange = {
                  start_date: startDate.toISOString().split('T')[0],
                  end_date: endDate.toISOString().split('T')[0],
                  type: 'year'
                };
              }
              
              setCurrentDate(newDate);
              setDateRange(newDateRange);
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
            onClick={handleNavigateForward}
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

  // Report actions
  const reportActions = [
    {
      component: (
        <FilterMenu
          menuType="expandable"
          buttonLabel={<FiFilter size={16} />}
          position="bottom"
          activeFilters={filters}
          customContent={customFilterContent}
          customContentOnly={true}
        />
      )
    }
  ];

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

  return (
    <Reports
      title="M.O.R.E. Report"
      description="More Opportunity, Recruit Everyday - Track hiring activity"
      onBack={onBack}
      loading={loading}
      error={error}
      onRefresh={loadInitialData}
      actions={reportActions}
      onPrepareForExport={prepareForExport}
      fullScreenCapable={true}
      exportData={exportData}
      dateRange={dateRange ? {
        start: dateRange.start_date,
        type: rangeType
      } : null}
    >
      {/* Weekly Reporting Section - Only show for MGA/RGA roles */}
      {(user?.clname === 'MGA' || user?.clname === 'RGA') && (
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
              donut={card.donut}
              percentage={card.percentage}
              donutColor={card.donutColor}
              donutSize={60}
            />
          ))}
        </div>
      </div>

      {/* Reporting Status Section - Only show for weekly view */}
      {rangeType === 'week' && (
        <div className="more-reporting-status-section">
          <MoreReportingStatus 
            amoreData={filteredData} 
            filters={{
              MGA: filters.hierarchyLevel === 'mga' ? null : filters.MGA,
              RGA: filters.hierarchyLevel === 'rga' ? null : filters.RGA,
              Tree: filters.Tree
            }}
            dateRange={dateRange}
          />
        </div>
      )}

      {/* Leaderboard Section */}
      {leaderboardData.length > 0 && (
        <div className="more-leaderboard-section">
                      <Leaderboard
              data={leaderboardData}
              title={`Top Performers - MGA Level`}
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
              showMGA={false} // Always false since we're at MGA level
              showLevelBadge={true}
              maxHeight={isPreparedForExport ? "none" : "400px"}
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

      {/* Data Table Section */}
      <div className="more-table-section">
        <h3>Detailed Activity Data</h3>
        <DataTable
          columns={tableColumns}
          data={filteredData}
          disablePagination={isPreparedForExport}
          showTotals={true}
          totalsColumns={['Total_Set', 'Total_Show', 'Group_Invite', 'Finals_Set', 'Finals_Show', 'Total_Hires', 'PR_Hires']}
          totalsLabel="Period Totals"
          entityName="activity record"
        />
      </div>


    </Reports>
  );
};

export default MoreReport;
