import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { FiFilter } from 'react-icons/fi';
import Leaderboard from '../components/utils/Leaderboard';
import FilterMenu from '../components/common/FilterMenu';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './LeaderboardPage.css';

/**
 * LeaderboardPage Component
 * 
 * Features:
 * - Real-time leaderboard data with filtering (Experience, Report Type, F6/Net/Gross, Date, MGA/RGA/Tree)
 * - Rank change tracking: Shows movement indicators (▲ Up, ▼ Down, 🆕 New, ➖ Same)
 *   - Achievement system: Detects and displays achievement badges for special accomplishments:
 *   - 👑 Champion/Defending Champion - #1 position
 *   - 🚀 Big Mover - moved up 5+ positions 
 *   - 📈 Rising Star - moved up 3+ positions and in top 10
 *   - 🔥 Hot Streak - top 3 for multiple periods
 *   - 📈 Climbing - moved up any amount
 *   - ⭐ Consistent Performer - maintained top 5 position
 *   - 🏆 High Performer - value above threshold
 */

/**
 * Helper function to safely convert Monthly_ALP string values to numbers
 * @param {string|number} value - Value from Monthly_ALP (stored as VARCHAR)
 * @returns {number} Numeric value
 */
const parseAlpValue = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    
    // If already a number, return it
    if (typeof value === 'number') return value;
    
    // Convert string to number, handling potential formatting
    const numValue = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    return isNaN(numValue) ? 0 : numValue;
};

/**
 * Combines YTD data with previous December data
 * @param {Array} ytdData - Current YTD data from Weekly_ALP (has reportdate field, DECIMAL values)
 * @param {Array} decemberData - Previous December data from Monthly_ALP (has month field, VARCHAR values)
 * @returns {Array} Combined data with December values added to YTD values
 */
const combineYTDWithDecember = (ytdData, decemberData) => {
    // Create a map of December data by LagnName for quick lookup
    const decemberMap = new Map();
    decemberData.forEach(item => {
        const key = item.LagnName;
        decemberMap.set(key, item);
    });
    
    // Process YTD data and add December values where available
    const combinedData = ytdData.map(ytdItem => {
        const decemberItem = decemberMap.get(ytdItem.LagnName);
        
        if (decemberItem) {
            // Convert Monthly_ALP VARCHAR values to numbers before adding
            const ytdLvl1Net = parseAlpValue(ytdItem.LVL_1_NET);
            const decLvl1Net = parseAlpValue(decemberItem.LVL_1_NET);
            const combinedLvl1Net = ytdLvl1Net + decLvl1Net;
            
            // Add December values to YTD values for all ALP levels (convert strings to numbers first)
            return {
                ...ytdItem, // Keep all YTD structure including reportdate
                LVL_1_NET: parseAlpValue(ytdItem.LVL_1_NET) + parseAlpValue(decemberItem.LVL_1_NET),
                LVL_1_GROSS: parseAlpValue(ytdItem.LVL_1_GROSS) + parseAlpValue(decemberItem.LVL_1_GROSS),
                LVL_2_NET: parseAlpValue(ytdItem.LVL_2_NET) + parseAlpValue(decemberItem.LVL_2_NET),
                LVL_2_GROSS: parseAlpValue(ytdItem.LVL_2_GROSS) + parseAlpValue(decemberItem.LVL_2_GROSS),
                LVL_2_F6_NET: parseAlpValue(ytdItem.LVL_2_F6_NET) + parseAlpValue(decemberItem.LVL_2_F6_NET),
                LVL_2_F6_GROSS: parseAlpValue(ytdItem.LVL_2_F6_GROSS) + parseAlpValue(decemberItem.LVL_2_F6_GROSS),
                LVL_3_NET: parseAlpValue(ytdItem.LVL_3_NET) + parseAlpValue(decemberItem.LVL_3_NET),
                LVL_3_GROSS: parseAlpValue(ytdItem.LVL_3_GROSS) + parseAlpValue(decemberItem.LVL_3_GROSS),
                LVL_3_F6_NET: parseAlpValue(ytdItem.LVL_3_F6_NET) + parseAlpValue(decemberItem.LVL_3_F6_NET),
                LVL_3_F6_GROSS: parseAlpValue(ytdItem.LVL_3_F6_GROSS) + parseAlpValue(decemberItem.LVL_3_F6_GROSS),
                // Add a flag to indicate this data includes previous December
                _includesDecember: true,
                _decemberMonth: decemberItem.month
            };
        }
        
        // Return original YTD item if no December data found
        return {
            ...ytdItem,
            _includesDecember: false
        };
    });
    
    // Add any December-only entries (people who had December data but no YTD data)
    decemberData.forEach(decemberItem => {
        const existsInYTD = ytdData.some(ytdItem => ytdItem.LagnName === decemberItem.LagnName);
        if (!existsInYTD) {
            // Create YTD-compatible structure from December data (convert strings to numbers)
            combinedData.push({
                ...decemberItem,
                // Convert Monthly_ALP VARCHAR values to numbers for compatibility
                LVL_1_NET: parseAlpValue(decemberItem.LVL_1_NET),
                LVL_1_GROSS: parseAlpValue(decemberItem.LVL_1_GROSS),
                LVL_2_NET: parseAlpValue(decemberItem.LVL_2_NET),
                LVL_2_GROSS: parseAlpValue(decemberItem.LVL_2_GROSS),
                LVL_2_F6_NET: parseAlpValue(decemberItem.LVL_2_F6_NET),
                LVL_2_F6_GROSS: parseAlpValue(decemberItem.LVL_2_F6_GROSS),
                LVL_3_NET: parseAlpValue(decemberItem.LVL_3_NET),
                LVL_3_GROSS: parseAlpValue(decemberItem.LVL_3_GROSS),
                LVL_3_F6_NET: parseAlpValue(decemberItem.LVL_3_F6_NET),
                LVL_3_F6_GROSS: parseAlpValue(decemberItem.LVL_3_F6_GROSS),
                // Convert Monthly_ALP structure to Weekly_ALP-compatible structure
                reportdate: `12/31/${decemberItem.month.split('/')[1]}`, // Convert "12/2024" to "12/31/2024"
                REPORT: 'YTD Recap', // Mark as YTD since we're in YTD context
                _includesDecember: true,
                _decemberMonth: decemberItem.month,
                _decemberOnly: true
            });
        }
    });
    
    return combinedData;
};

const LeaderboardPage = () => {
    const { user } = useAuth();
    const [isF6, setIsF6] = useState(false);
    const [experienceFilter, setExperienceFilter] = useState('all');
    const [netOrGross, setNetOrGross] = useState('net');
    const [reportType, setReportType] = useState('Weekly Recap');
    const [includePrevDecember, setIncludePrevDecember] = useState(false);
    const [loading, setLoading] = useState(false);
    // Add Daily_Activity toggle state
    const [isDailyActivity, setIsDailyActivity] = useState(false);
    // Add Daily_Activity metric selection state
    const [dailyActivityMetric, setDailyActivityMetric] = useState('alp');
    // Add Codes toggle state
    const [isCodes, setIsCodes] = useState(false);
    // Add VIPs toggle state
    const [isVIPs, setIsVIPs] = useState(false);
    // Add Ref Sales toggle state
    const [isRefSales, setIsRefSales] = useState(false);
    // Add MORE toggle state
    const [isMORE, setIsMORE] = useState(false);
    
    // Add dropdown state for Reported button
    const [isReportedDropdownOpen, setIsReportedDropdownOpen] = useState(false);
    
    // Filter states for the filter menu
    const [filters, setFilters] = useState({});
    
    // Filter options
    const [mgaOptions, setMgaOptions] = useState([]);
    const [rgaOptions, setRgaOptions] = useState([]);
    const [treeOptions, setTreeOptions] = useState([]);
    const [selectedMGA, setSelectedMGA] = useState(null);
    const [selectedRGA, setSelectedRGA] = useState(null);
    const [selectedTree, setSelectedTree] = useState(null);
    const [allOptions, setAllOptions] = useState([]);
    
    // Date handling
    const [reportDates, setReportDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [defaultDate, setDefaultDate] = useState('');
    
    // Leaderboard data
    const [leaderboardData, setLeaderboardData] = useState({
        all: { data: [], loading: true },
        sa: { data: [], loading: true },
        ga: { data: [], loading: true },
        mga: { data: [], loading: true },
        rga: { data: [], loading: true }
    });

    // Allowed lagnnames (Active = 'y' and managerActive = 'y') for client-side filtering
    const [allowedNames, setAllowedNames] = useState(new Set());
    // Allowed user IDs for sources that link to userId
    const [allowedIds, setAllowedIds] = useState(new Set());

    // Previous period data for rank comparison
    const [previousLeaderboardData, setPreviousLeaderboardData] = useState({
        all: { data: [] },
        sa: { data: [] },
        ga: { data: [] },
        mga: { data: [] },
        rga: { data: [] }
    });

    // Format date to MM/DD/YYYY
    const formatToMMDDYYYY = (dateStr) => {
        const date = new Date(dateStr);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
    };

    // Format date to MM/DD/YY (for Daily_Activity ranges)
    const formatToMMDDYY = (dateStr) => {
        const date = new Date(dateStr);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const yy = String(date.getFullYear()).slice(-2);
        return `${mm}/${dd}/${yy}`;
    };

    // Get the Monday of the week for a given date
    const getMondayOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(d.setDate(diff));
    };

    // Get the Sunday of the week for a given date
    const getSundayOfWeek = (date) => {
        const monday = getMondayOfWeek(date);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return sunday;
    };

    // Format weekly date range for display (MM/DD/YY-MM/DD/YY)
    const formatWeeklyRange = (date) => {
        // Handle invalid dates gracefully
        if (!date || date === '' || date === null || date === undefined) {
            return 'Invalid Date';
        }
        
        // If the date is already in MM/YYYY or YYYY format, return it as-is
        if (isMMYYYYFormat(date) || isYYYYFormat(date)) {
            return date;
        }
        
        try {
            const monday = getMondayOfWeek(date);
            const sunday = getSundayOfWeek(date);
            
            // Check if the dates are valid
            if (isNaN(monday.getTime()) || isNaN(sunday.getTime())) {
                return date; // Return original date if parsing failed
            }
            
            return `${formatToMMDDYY(monday)}-${formatToMMDDYY(sunday)}`;
        } catch (error) {
            console.warn('Error formatting weekly range for date:', date, error);
            return date; // Return original date if formatting failed
        }
    };

    // Get weekly date range in YYYY-MM-DD format for API filtering
    const getWeeklyDateRange = (date) => {
        const monday = getMondayOfWeek(date);
        const sunday = getSundayOfWeek(date);
        return {
            startDate: monday.toISOString().split('T')[0],
            endDate: sunday.toISOString().split('T')[0]
        };
    };

    // Check if the date is in MM/YYYY format (for MTD)
    const isMMYYYYFormat = (dateStr) => {
        return /^\d{2}\/\d{4}$/.test(dateStr);
    };

    // Check if the date is in YYYY format (for YTD)
    const isYYYYFormat = (dateStr) => {
        return /^\d{4}$/.test(dateStr);
    };

    // Get monthly date range from MM/YYYY format
    const getMonthlyDateRange = (mmYYYY) => {
        const [month, year] = mmYYYY.split('/');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0); // Last day of month
        
        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };
    };

    // Get yearly date range from YYYY format
    const getYearlyDateRange = (yyyy) => {
        const year = parseInt(yyyy);
        const startDate = new Date(year, 0, 1); // January 1st
        const endDate = new Date(year, 11, 31); // December 31st
        
        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };
    };

    // Calculate date range for filtering
    const calculateDateRange = (date) => {
        const reportDate = new Date(date);
        const startDate = new Date(reportDate);
        startDate.setDate(reportDate.getDate() - 3);

        const endDate = new Date(reportDate);
        endDate.setDate(reportDate.getDate() + 3);

        return {
            startDate: formatToMMDDYYYY(startDate),
            endDate: formatToMMDDYYYY(endDate),
        };
    };

    // Get previous period date for rank comparison
    const getPreviousDate = (currentDate) => {
        // Handle grouped format (MTD)
        if (reportDates.length > 0 && typeof reportDates[0] === 'object' && reportDates[0].type) {
            const currentIndex = reportDates.findIndex(item => item.value === currentDate);
            if (currentIndex >= 0 && currentIndex < reportDates.length - 1) {
                // Find the next non-header item
                for (let i = currentIndex + 1; i < reportDates.length; i++) {
                    if (!reportDates[i].isHeader) {
                        return reportDates[i].value;
                    }
                }
            }
            return null;
        } else {
            // Handle regular format (Weekly/YTD)
            const currentIndex = reportDates.indexOf(currentDate);
            // Since reportDates is sorted in descending order (newest first),
            // the previous period is at currentIndex + 1 (further down the array)
            const previousDate = currentIndex >= 0 && currentIndex < reportDates.length - 1 
                ? reportDates[currentIndex + 1] 
                : null;
            
            return previousDate;
        }
    };

    // Calculate rank changes between current and previous data
    const calculateRankChanges = (currentData, previousData) => {
        if (!previousData || previousData.length === 0) {
            return currentData.map(item => ({
                ...item,
                previousRank: undefined,
                rankChange: "NEW"
            }));
        }

        const previousRanks = {};
        previousData.forEach((item, index) => {
            if (item.name) {
                previousRanks[item.name] = index + 1;
            }
        });

        return currentData.map((item, currentIndex) => {
            const currentRank = currentIndex + 1;
            const previousRank = previousRanks[item.name];
            
            let rankChange = null;
            if (previousRank === undefined) {
                rankChange = "NEW";
            } else if (previousRank > currentRank) {
                rankChange = previousRank - currentRank; // Positive number for improvement
            } else if (previousRank < currentRank) {
                rankChange = -(currentRank - previousRank); // Negative number for decline
            } else {
                rankChange = 0; // Same position
            }

            return {
                ...item,
                previousRank,
                rankChange: rankChange
            };
        });
    };

    // Detect achievements based on performance patterns
    const detectAchievements = (item, currentData, previousData, key) => {
        const achievements = [];
        const currentRank = currentData.findIndex(d => d.name === item.name) + 1;
        const previousRank = previousData.findIndex(d => d.name === item.name) + 1;
        
        // Champion - #1 position
        if (currentRank === 1) {
            if (previousRank === 1) {
                achievements.push('👑 Defending Champion');
            } else {
                achievements.push('👑 New Champion');
            }
        }

        // Big mover - moved up 5+ positions
        if (previousRank > 0 && previousRank - currentRank >= 200) {
            achievements.push('🚀 Big Mover');
        }

        // Rising star - moved up 3+ positions and in top 10
        if (previousRank > 0 && previousRank - currentRank >= 3 && currentRank <= 5) {
            achievements.push('📈 Rising Star');
        }

        // Hot streak - top 3 for multiple periods (simplified check)
        if (currentRank <= 3 && previousRank <= 3) {
            achievements.push('🔥 Hot Streak');
        }



        // Consistent - maintained top 5 position
        if (currentRank <= 5 && previousRank <= 5 && previousRank > 0) {
            achievements.push('⭐ Consistent Performer');
        }

        // High performer badge based on value - only for main "all" leaderboard
        if (key === 'all') {
            const value = item.value || 0;
            // Set different thresholds based on report type
            const highPerformerThreshold = reportType === 'YTD Recap' ? 500000 : 25000;
            if (value > highPerformerThreshold) {
                achievements.push('🏆 High Performer');
            }
        }

        return achievements.length > 0 ? achievements[0] : null; // Return first/most important achievement
    };

    // Format movement indicator for display (consistent with More Report)
    const formatMovementIndicator = (item) => {
        if (!item?.rankChange) return null;
        
        if (item.rankChange === "NEW") {
            return null; // Remove NEW indicators
        } else if (item.rankChange && item.rankChange !== 0) {
            const arrow = item.rankChange > 0 ? "▲" : "▼";
            return `${arrow}${Math.abs(item.rankChange)}`;
        } else if (item.rankChange === 0) {
            return "━";
        }
        
        return null;
    };

    // Format achievement badge for display (consistent with More Report)
    const formatAchievementBadge = (item) => {
        if (!item?.achievement) return null;
        
        const achievements = [];
        
        // Handle champion with weeks count
        if (item.achievement === "👑 Champion" && item.weeksAtNumber1 > 1) {
            achievements.push(`👑 ${item.weeksAtNumber1} week${item.weeksAtNumber1 > 1 ? 's' : ''}`);
        } else if (item.achievement) {
            // Regular achievement without weeks
            achievements.push(item.achievement);
        }
        
        return achievements.length > 0 ? achievements.join(' • ') : null;
    };

    // Achievement colors configuration (consistent with More Report)
    const achievementColors = {
        hotStreak: "#ff6b35",      // Orange-red for hot streaks
        champion: "#ffd700",       // Gold for champions
        risingStar: "#00d4aa",     // Teal for rising stars
        bigMover: "#6366f1",       // Indigo for big movers
        climbing: "#10b981",       // Green for climbing
        consistent: "#8b5cf6",     // Purple for consistent
        record: "#dc2626",         // Red for records
        dethroned: "#7c2d12",      // Dark red for dethroned
        default: "#6b7280"         // Gray for default
    };

    // Fetch unique MGA options
    const fetchUniqueMGAOptions = async () => {
        try {
            const response = await api.get('/alp/getUniqueMGAOptions');
            if (response.data.success) {
                const options = response.data.data;
                const allOptions = options;

                const uniqueRGAs = [...new Set(options.map((opt) => opt.rga))];
                const uniqueTrees = [...new Set(options.map((opt) => opt.tree))];

                setMgaOptions(options.map((opt) => ({ value: opt.lagnname, label: opt.lagnname })));
                setRgaOptions(uniqueRGAs.map((value) => ({ value, label: value })));
                setTreeOptions(uniqueTrees.map((value) => ({ value, label: value })));
                setAllOptions(allOptions);
            }
        } catch (error) {
            console.error('Error fetching unique MGA options:', error);
        }
    };

    // Fetch report dates
    const fetchReportDates = async () => {
        try {
            // For Daily_Activity, Codes, VIPs, Ref Sales, or MORE mode, generate date ranges based on report type
            if (isDailyActivity || isCodes || isVIPs || isRefSales || isMORE) {
                if (reportType === 'MTD Recap') {
                    // Generate last 12 months in MM/YYYY format for MTD
                    const months = [];
                    const today = new Date();
                    
                    for (let i = 0; i < 12; i++) {
                        const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
                        const monthString = `${String(monthDate.getMonth() + 1).padStart(2, '0')}/${monthDate.getFullYear()}`;
                        months.push(monthString);
                    }
                    
                    setReportDates(months);
                    setDefaultDate(months[0]); // Most recent month
                    setSelectedDate(months[0]);
                } else if (reportType === 'YTD Recap') {
                    // Generate last 5 years in YYYY format for YTD
                    const years = [];
                    const currentYear = new Date().getFullYear();
                    
                    for (let i = 0; i < 5; i++) {
                        years.push((currentYear - i).toString());
                    }
                    
                    setReportDates(years);
                    setDefaultDate(years[0]); // Most recent year
                    setSelectedDate(years[0]);
                } else {
                    // Handle Weekly mode differently for VIPs vs Daily_Activity/Codes/MORE
                    if (isVIPs) {
                        // For VIPs in Weekly mode, default to current month (MM/YYYY format) since VIPs doesn't support weekly
                        const today = new Date();
                        const currentMonth = `${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
                        setReportDates([currentMonth]);
                        setDefaultDate(currentMonth);
                        setSelectedDate(currentMonth);
                    } else if (isMORE) {
                        // For MORE in Weekly mode, fetch unique MORE_Date values from the backend
                        if (reportType === 'Weekly Recap') {
                            fetchMoreWeeklyDates();
                            return; // Exit early since fetchMoreWeeklyDates will handle setting dates
                        } else {
                            // For non-weekly MORE modes, this shouldn't happen, but handle gracefully
                            console.warn('MORE mode in non-weekly report type, this should not happen');
                            setReportDates([]);
                            setDefaultDate('');
                            setSelectedDate('');
                            return;
                        }
                    } else {
                        // Generate last 12 weeks of Monday-Sunday ranges for Weekly (Daily_Activity and Codes only)
                        const weeks = [];
                        const today = new Date();
                        
                        for (let i = 0; i < 12; i++) {
                            const weekDate = new Date(today);
                            weekDate.setDate(today.getDate() - (i * 7));
                            const monday = getMondayOfWeek(weekDate);
                            weeks.push(monday.toISOString().split('T')[0]);
                        }
                        
                        setReportDates(weeks);
                        setDefaultDate(weeks[0]); // Most recent week
                        setSelectedDate(weeks[0]);
                    }
                }
                return;
            }

            // For regular ALP data
            const response = await api.get('/alp/getReportDates', {
                params: { reportType }
            });
            if (response.data.success) {
                if (response.data.type === 'grouped') {
                    // For MTD grouped format
                    setReportDates(response.data.reportDates);
                } else {
                    // For regular format, ensure dates are sorted
                    const sortedDates = response.data.reportDates.sort((a, b) => new Date(b) - new Date(a));
                    setReportDates(sortedDates);
                }
                setDefaultDate(response.data.defaultDate);
                setSelectedDate(response.data.defaultDate);
            }
        } catch (error) {
            console.error('Error fetching report dates:', error);
        }
    };

    // Fetch MORE weekly dates from backend
    const fetchMoreWeeklyDates = async () => {
        try {
            const response = await api.get('/more/all-amore-data');
            
            if (response.data.success && response.data.data) {
                // Get unique MORE_Date values directly from the data
                const uniqueDates = [...new Set(response.data.data.map(item => item.MORE_Date))];
                
                // Sort dates in descending order (most recent first)
                const sortedDates = uniqueDates.sort((a, b) => new Date(b) - new Date(a));
                
                setReportDates(sortedDates);
                if (sortedDates.length > 0) {
                    setDefaultDate(sortedDates[0]); // Most recent date
                    setSelectedDate(sortedDates[0]);
                }
            } else {
                setReportDates([]);
                setDefaultDate('');
                setSelectedDate('');
            }
        } catch (error) {
            console.error('Error fetching MORE weekly dates:', error);
            setReportDates([]);
            setDefaultDate('');
            setSelectedDate('');
        }
    };

    // Check if selected date is a month header (format: MM/YYYY)
    const isMonthSelection = (date) => {
        return /^\d{2}\/\d{4}$/.test(date);
    };

    // Fetch leaderboard data with achievements and rank tracking
    const fetchLeaderboardData = async (endpoint, key) => {
        let filters = {};
        
        // Handle Daily_Activity data source
        if (isDailyActivity) {
            try {
                setLeaderboardData(prev => ({
                    ...prev,
                    [key]: { ...prev[key], loading: true }
                }));

                // Build filter parameters for the new filtered endpoint
                const filterParams = {};
                
                // Add date range filtering
                if (selectedDate) {
                    let startDate, endDate;
                    
                    if (isYYYYFormat(selectedDate)) {
                        // YTD format: YYYY -> get full year range
                        const yearRange = getYearlyDateRange(selectedDate);
                        startDate = yearRange.startDate;
                        endDate = yearRange.endDate;
                    } else if (isMMYYYYFormat(selectedDate)) {
                        // MTD format: MM/YYYY -> get full month range
                        const monthRange = getMonthlyDateRange(selectedDate);
                        startDate = monthRange.startDate;
                        endDate = monthRange.endDate;
                    } else {
                        // Weekly format: get Monday-Sunday range
                        const weekRange = getWeeklyDateRange(selectedDate);
                        startDate = weekRange.startDate;
                        endDate = weekRange.endDate;
                    }
                    
                    filterParams.startDate = startDate;
                    filterParams.endDate = endDate;
                }
                
                // Add MGA/RGA/Tree filters (same logic as Weekly_ALP)
                if (selectedMGA && selectedMGA.value) {
                    filterParams.MGA_NAME = selectedMGA.value;
                }
                if (selectedRGA && selectedRGA.value) {
                    filterParams.rga = selectedRGA.value;
                }
                if (selectedTree && selectedTree.value) {
                    filterParams.tree = selectedTree.value;
                }

                // Use the new filtered endpoint with MGA table joins
                const response = await api.get('/dailyActivity/filtered', { params: filterParams });
                
                if (response.data.success) {
                    let currentData = response.data.data;
                    
                    const currentProcessedData = processDailyActivityData(currentData, key, dailyActivityMetric);
                    
                    // For Daily_Activity, we might not have previous period data initially
                    // TODO: Implement previous period comparison for Daily_Activity if needed
                    const dataWithRankChanges = currentProcessedData.map(item => ({
                        ...item,
                        previousRank: undefined,
                        rankChange: "NEW"
                    }));

                    setLeaderboardData(prev => ({
                        ...prev,
                        [key]: { data: dataWithRankChanges, loading: false }
                    }));
                } else {
                    setLeaderboardData(prev => ({
                        ...prev,
                        [key]: { data: [], loading: false }
                    }));
                }
            } catch (error) {
                console.error(`Error fetching Daily_Activity ${key} leaderboard data:`, error);
                setLeaderboardData(prev => ({
                    ...prev,
                    [key]: { data: [], loading: false }
                }));
            }
            return; // Exit early for Daily_Activity data
        }

        // Handle Codes data source
        if (isCodes) {
            try {
                setLeaderboardData(prev => ({
                    ...prev,
                    [key]: { ...prev[key], loading: true }
                }));

                // Build filter parameters for the codes endpoint
                const filterParams = {};
                
                // Add date range filtering
                if (selectedDate) {
                    let startDate, endDate;
                    
                    if (isYYYYFormat(selectedDate)) {
                        // YTD format: YYYY -> get full year range
                        const yearRange = getYearlyDateRange(selectedDate);
                        startDate = yearRange.startDate;
                        endDate = yearRange.endDate;
                    } else if (isMMYYYYFormat(selectedDate)) {
                        // MTD format: MM/YYYY -> get full month range
                        const monthRange = getMonthlyDateRange(selectedDate);
                        startDate = monthRange.startDate;
                        endDate = monthRange.endDate;
                    } else {
                        // Weekly format: get Monday-Sunday range
                        const weekRange = getWeeklyDateRange(selectedDate);
                        startDate = weekRange.startDate;
                        endDate = weekRange.endDate;
                    }
                    
                    filterParams.startDate = startDate;
                    filterParams.endDate = endDate;
                }
                
                // Add MGA/RGA/Tree filters (same logic as Weekly_ALP)
                if (selectedMGA && selectedMGA.value) {
                    filterParams.MGA_NAME = selectedMGA.value;
                }
                if (selectedRGA && selectedRGA.value) {
                    filterParams.rga = selectedRGA.value;
                }
                if (selectedTree && selectedTree.value) {
                    filterParams.tree = selectedTree.value;
                }

                // Use the codes endpoint
                const response = await api.get('/dailyActivity/codes', { params: filterParams });
                
                if (response.data.success) {
                    let currentData = response.data.data;
                    
                    const currentProcessedData = processCodesData(currentData, key);
                    
                    // For Codes, we might not have previous period data initially
                    const dataWithRankChanges = currentProcessedData.map(item => ({
                        ...item,
                        previousRank: undefined,
                        rankChange: "NEW"
                    }));

                    setLeaderboardData(prev => ({
                        ...prev,
                        [key]: { data: dataWithRankChanges, loading: false }
                    }));
                } else {
                    setLeaderboardData(prev => ({
                        ...prev,
                        [key]: { data: [], loading: false }
                    }));
                }
            } catch (error) {
                console.error(`Error fetching Codes ${key} leaderboard data:`, error);
                setLeaderboardData(prev => ({
                    ...prev,
                    [key]: { data: [], loading: false }
                }));
            }
            return; // Exit early for Codes data
        }

        // Handle VIPs data source
        if (isVIPs) {
            try {
                setLeaderboardData(prev => ({
                    ...prev,
                    [key]: { ...prev[key], loading: true }
                }));

                // Validate that selectedDate format matches reportType expectations
                const isValidDateFormat = 
                    (reportType === 'MTD Recap' && isMMYYYYFormat(selectedDate)) ||
                    (reportType === 'YTD Recap' && isYYYYFormat(selectedDate)) ||
                    (reportType === 'Weekly Recap') || // Weekly can use any format since it defaults to MTD
                    (!selectedDate); // Allow empty selectedDate during initialization
                
                if (!isValidDateFormat && selectedDate) {
                    setLeaderboardData(prev => ({
                        ...prev,
                        [key]: { data: [], loading: false }
                    }));
                    return;
                }

                // Build filter parameters for the VIPs endpoint
                const filterParams = {};
                
                // Add period and date filtering for VIPs (MTD/YTD only)
                // Convert reportType to the format expected by backend
                let period;
                let year, month;
                
                if (reportType === 'MTD Recap') {
                    period = 'mtd';
                    if (selectedDate && isMMYYYYFormat(selectedDate)) {
                        // Parse MM/YYYY format
                        const [monthStr, yearStr] = selectedDate.split('/');
                        month = parseInt(monthStr);
                        year = parseInt(yearStr);
                    } else {
                        // Default to current month when selectedDate is not in MM/YYYY format
                        // This happens when switching from YTD (YYYY format) to MTD mode
                        const currentDate = new Date();
                        year = currentDate.getFullYear();
                        month = currentDate.getMonth() + 1;
                    }
                } else if (reportType === 'YTD Recap') {
                    period = 'ytd';
                    if (selectedDate && isYYYYFormat(selectedDate)) {
                        // Parse YYYY format
                        year = parseInt(selectedDate);
                    } else {
                        // Default to current year
                        year = new Date().getFullYear();
                    }
                } else {
                    // Default to MTD for Weekly mode (VIPs doesn't support weekly)
                    period = 'mtd';
                    if (selectedDate && isMMYYYYFormat(selectedDate)) {
                        const [monthStr, yearStr] = selectedDate.split('/');
                        month = parseInt(monthStr);
                        year = parseInt(yearStr);
                    } else {
                        // Default to current month for any other date format or no date
                        const currentDate = new Date();
                        year = currentDate.getFullYear();
                        month = currentDate.getMonth() + 1;
                    }
                }
                
                filterParams.period = period;
                filterParams.year = year;
                
                if (period === 'mtd') {
                    filterParams.month = month;
                }
                
                // Add MGA/RGA/Tree filters (same logic as other endpoints)
                if (selectedMGA && selectedMGA.value) {
                    filterParams.MGA_NAME = selectedMGA.value;
                }
                if (selectedRGA && selectedRGA.value) {
                    filterParams.rga = selectedRGA.value;
                }
                if (selectedTree && selectedTree.value) {
                    filterParams.tree = selectedTree.value;
                }

                // Use the VIPs endpoint
                const response = await api.get('/dailyActivity/vips', { params: filterParams });
                
                if (response.data.success) {
                    let currentData = response.data.data;
                    
                    const currentProcessedData = processVIPsData(currentData, key);
                    
                    // For VIPs, we might not have previous period data initially
                    const dataWithRankChanges = currentProcessedData.map(item => ({
                        ...item,
                        previousRank: undefined,
                        rankChange: "NEW"
                    }));

                    setLeaderboardData(prev => ({
                        ...prev,
                        [key]: { data: dataWithRankChanges, loading: false }
                    }));
                } else {
                    setLeaderboardData(prev => ({
                        ...prev,
                        [key]: { data: [], loading: false }
                    }));
                }
            } catch (error) {
                console.error(`Error fetching VIPs ${key} leaderboard data:`, error);
                setLeaderboardData(prev => ({
                    ...prev,
                    [key]: { data: [], loading: false }
                }));
            }
            return; // Exit early for VIPs data
        }

        // Handle Ref Sales data source
        if (isRefSales) {
            try {
                setLeaderboardData(prev => ({
                    ...prev,
                    [key]: { ...prev[key], loading: true }
                }));

                // Build parameters for ref sales leaderboard
                const params = {
                    hierarchy_level: key === 'all' ? 'all' : key,
                    sort_by: 'true_refs'
                };

                // Add date range parameters based on report type
                if (reportType === 'Weekly Recap') {
                    // For weekly, use the selected date as the week start and calculate the range
                    const weekRange = getWeeklyDateRange(new Date(selectedDate));
                    params.start_date = weekRange.startDate;
                    params.end_date = weekRange.endDate;
                } else if (reportType === 'MTD Recap' && isMMYYYYFormat(selectedDate)) {
                    // For monthly, convert MM/YYYY to date range
                    const monthRange = getMonthlyDateRange(selectedDate);
                    params.start_date = monthRange.startDate;
                    params.end_date = monthRange.endDate;
                } else if (reportType === 'YTD Recap' && isYYYYFormat(selectedDate)) {
                    // For yearly, convert YYYY to date range
                    const yearRange = getYearlyDateRange(selectedDate);
                    params.start_date = yearRange.startDate;
                    params.end_date = yearRange.endDate;
                } else {
                    // Default to current month if date format is invalid
                    const today = new Date();
                    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    params.start_date = firstDay.toISOString().split('T')[0];
                    params.end_date = lastDay.toISOString().split('T')[0];
                }

                // Add team filter if selected
                if (selectedMGA?.value) {
                    params.team = selectedMGA.value;
                }

                // Fetch data from ref-report dashboard endpoint
                const response = await api.get('/ref-report/dashboard', { params });
                
                if (response.data && response.data.data && response.data.data.leaderboard) {
                    const refSalesData = response.data.data.leaderboard;
                    
                    // Process and format the data for Leaderboard component
                    const processedData = refSalesData.map((item, index) => ({
                        name: item.name || 'Unknown',
                        value: item.true_refs || 0,
                        secondaryValue: item.conversion_rate || 0,
                        rank: index + 1,
                        profile_picture: item.profile_picture,
                        mgaLastName: item.mgaLastName,
                        clname: item.level || item.clname,
                        // Add other fields needed by Leaderboard component
                        total_refs: item.total_refs || 0,
                        conversion_rate: item.conversion_rate || 0,
                        agent_count: item.agent_count || 0
                    }));

                    setLeaderboardData(prev => ({
                        ...prev,
                        [key]: { data: processedData, loading: false }
                    }));
                } else {
                    setLeaderboardData(prev => ({
                        ...prev,
                        [key]: { data: [], loading: false }
                    }));
                }
            } catch (error) {
                console.error(`Error fetching Ref Sales ${key} leaderboard data:`, error);
                setLeaderboardData(prev => ({
                    ...prev,
                    [key]: { data: [], loading: false }
                }));
            }
            return; // Exit early for Ref Sales data
        }

        // Handle MORE data source
        if (isMORE) {
            try {
                setLeaderboardData(prev => ({
                    ...prev,
                    [key]: { ...prev[key], loading: true }
                }));

                // Fetch all MORE data (same as MoreReport.js)
                const response = await api.get('/more/all-amore-data');
                
                if (response.data && response.data.success && response.data.data) {
                    let moreData = response.data.data;
                    
                    // Apply date filtering based on report type
                    let filteredData;
                    
                    if (reportType === 'Weekly Recap') {
                        // For weekly, filter by exact MORE_Date match
                        filteredData = moreData.filter(item => {
                            return item.MORE_Date === selectedDate;
                        });
                    } else if (reportType === 'MTD Recap' && isMMYYYYFormat(selectedDate)) {
                        // For monthly, convert MM/YYYY to date range
                        const [month, year] = selectedDate.split('/');
                        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                        const endDate = new Date(parseInt(year), parseInt(month), 0);
                        
                        filteredData = moreData.filter(item => {
                            const itemDate = new Date(item.MORE_Date);
                            return itemDate >= startDate && itemDate <= endDate;
                        });
                    } else if (reportType === 'YTD Recap' && isYYYYFormat(selectedDate)) {
                        // For yearly, use full year range
                        const year = parseInt(selectedDate);
                        const startDate = new Date(year, 0, 1);
                        const endDate = new Date(year, 11, 31);
                        
                        filteredData = moreData.filter(item => {
                            const itemDate = new Date(item.MORE_Date);
                            return itemDate >= startDate && itemDate <= endDate;
                        });
                    } else {
                        // Default to current month
                        const today = new Date();
                        const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        
                        filteredData = moreData.filter(item => {
                            const itemDate = new Date(item.MORE_Date);
                            return itemDate >= startDate && itemDate <= endDate;
                        });
                    }
                    
                    // Group data based on hierarchy level (same logic as MoreReport.js)
                    let groupedData = {};
                    
                    if (key === 'mga' || key === 'all') {
                        // Group by MGA (same as MoreReport.js)
                        groupedData = filteredData.reduce((acc, item) => {
                            const mgaKey = item.MGA;
                            if (!acc[mgaKey]) {
                                acc[mgaKey] = {
                                    name: mgaKey,
                                    MGA: mgaKey,
                                    RGA: item.RGA,
                                    Legacy: item.Legacy,
                                    Tree: item.Tree,
                                    Total_Hires: 0,
                                    PR_Hires: 0,
                                    Total_Set: 0,
                                    Total_Show: 0,
                                    Finals_Set: 0,
                                    Finals_Show: 0,
                                    clname: 'MGA'
                                };
                            }
                            acc[mgaKey].Total_Hires += item.Total_Hires || 0;
                            acc[mgaKey].PR_Hires += item.PR_Hires || 0;
                            acc[mgaKey].Total_Set += item.Total_Set || 0;
                            acc[mgaKey].Total_Show += item.Total_Show || 0;
                            acc[mgaKey].Finals_Set += item.Finals_Set || 0;
                            acc[mgaKey].Finals_Show += item.Finals_Show || 0;
                            return acc;
                        }, {});
                    } else if (key === 'rga') {
                        // Group by RGA - include both their MGAs' data (RGA column) AND their own personal data (MGA column)
                        groupedData = {};
                        
                        // First pass: collect all unique RGA names
                        const allRGAs = new Set();
                        filteredData.forEach(item => {
                            if (item.RGA) allRGAs.add(item.RGA);
                        });
                        
                        console.log('🎯 MORE RGA Leaderboard - Found RGAs:', Array.from(allRGAs));
                        
                        // Initialize RGA entries
                        allRGAs.forEach(rgaName => {
                            groupedData[rgaName] = {
                                name: rgaName,
                                RGA: rgaName,
                                MGA: rgaName, // RGA is also an MGA
                                Legacy: null,
                                Tree: null,
                                Total_Hires: 0,
                                PR_Hires: 0,
                                Total_Set: 0,
                                Total_Show: 0,
                                Finals_Set: 0,
                                Finals_Show: 0,
                                clname: 'RGA'
                            };
                        });
                        
                        // Second pass: aggregate data for each RGA
                        filteredData.forEach(item => {
                            const rgaName = item.RGA;
                            const mgaName = item.MGA;
                            
                            // Add data where this item's RGA matches (their MGAs' data)
                            if (rgaName && groupedData[rgaName]) {
                                groupedData[rgaName].Total_Hires += item.Total_Hires || 0;
                                groupedData[rgaName].PR_Hires += item.PR_Hires || 0;
                                groupedData[rgaName].Total_Set += item.Total_Set || 0;
                                groupedData[rgaName].Total_Show += item.Total_Show || 0;
                                groupedData[rgaName].Finals_Set += item.Finals_Set || 0;
                                groupedData[rgaName].Finals_Show += item.Finals_Show || 0;
                                
                                // Update hierarchy info from first item
                                if (!groupedData[rgaName].Legacy) {
                                    groupedData[rgaName].Legacy = item.Legacy;
                                    groupedData[rgaName].Tree = item.Tree;
                                }
                            }
                            
                            // Also add data where this item's MGA matches an RGA name (RGA's own personal data)
                            if (mgaName && groupedData[mgaName]) {
                                console.log(`📊 Adding RGA personal data: ${mgaName} +${item.Total_Hires || 0} hires`);
                                groupedData[mgaName].Total_Hires += item.Total_Hires || 0;
                                groupedData[mgaName].PR_Hires += item.PR_Hires || 0;
                                groupedData[mgaName].Total_Set += item.Total_Set || 0;
                                groupedData[mgaName].Total_Show += item.Total_Show || 0;
                                groupedData[mgaName].Finals_Set += item.Finals_Set || 0;
                                groupedData[mgaName].Finals_Show += item.Finals_Show || 0;
                            }
                        });
                    } else {
                        // For SA/GA levels, return empty data since MORE only supports MGA/RGA
                        setLeaderboardData(prev => ({
                            ...prev,
                            [key]: { data: [], loading: false }
                        }));
                        return;
                    }
                    
                    // Convert to array and sort by Total_Hires, then by Total_Set (same as MoreReport.js)
                    const sortedLeaderboard = Object.values(groupedData)
                        .sort((a, b) => {
                            if (b.Total_Hires !== a.Total_Hires) {
                                return b.Total_Hires - a.Total_Hires;
                            }
                            return b.Total_Set - a.Total_Set;
                        });
                    
                    // Add ranks and format for Leaderboard component
                    const processedData = sortedLeaderboard.map((item, index) => ({
                        name: item.name || 'Unknown',
                        value: item.Total_Hires || 0,
                        secondaryValue: item.PR_Hires || 0,
                        rank: index + 1,
                        profile_picture: item.profile_picture,
                        mgaLastName: item.mgaLastName,
                        clname: item.clname,
                        // Add other MORE-specific fields
                        Total_Set: item.Total_Set || 0,
                        Total_Show: item.Total_Show || 0,
                        Finals_Set: item.Finals_Set || 0,
                        Finals_Show: item.Finals_Show || 0,
                        PR_Hires: item.PR_Hires || 0,
                        Total_Hires: item.Total_Hires || 0,
                        MGA: item.MGA,
                        RGA: item.RGA,
                        Legacy: item.Legacy,
                        Tree: item.Tree
                    }));

                    setLeaderboardData(prev => ({
                        ...prev,
                        [key]: { data: processedData, loading: false }
                    }));
                } else {
                    setLeaderboardData(prev => ({
                        ...prev,
                        [key]: { data: [], loading: false }
                    }));
                }
            } catch (error) {
                console.error(`Error fetching MORE ${key} leaderboard data:`, error);
                setLeaderboardData(prev => ({
                    ...prev,
                    [key]: { data: [], loading: false }
                }));
            }
            return; // Exit early for MORE data
        }
        
        // Determine if we should use Monthly_ALP or Weekly_ALP (existing logic)
        const useMonthlyData = isMonthSelection(selectedDate);
        
        if (useMonthlyData) {
            // Use Monthly_ALP endpoints - report parameter not needed since all Monthly_ALP records are month recaps
            filters = {
                month: selectedDate,
                MGA_NAME: selectedMGA?.value || '',
                rga: selectedRGA?.value || '',
                tree: selectedTree?.value || '',
            };
            // Convert weekly endpoint to monthly endpoint
            endpoint = endpoint.replace('getweekly', 'getmonthly');
        } else {
            // Use Weekly_ALP endpoints
            const { startDate, endDate } = calculateDateRange(selectedDate);
            filters = {
                startDate,
                endDate,
                report: reportType,
                MGA_NAME: selectedMGA?.value || '',
                rga: selectedRGA?.value || '',
                tree: selectedTree?.value || '',
            };
        }

        // Apply RGA filtering for MGA leaderboard
        if (key === 'mga' && selectedRGA) {
            filters = { ...filters, MGA_NAME: '', rga: selectedRGA.value };
        }

        // Apply Tree filtering for RGA leaderboard
        if (key === 'rga' && selectedTree) {
            filters = { ...filters, MGA_NAME: '', rga: '', tree: selectedTree.value };
        }

        try {
            setLeaderboardData(prev => ({
                ...prev,
                [key]: { ...prev[key], loading: true }
            }));

            // Fetch current period data
            const response = await api.get(`/alp/${endpoint}`, { params: filters });
            
            if (response.data.success) {
                let currentData = response.data.data;
                
                // For YTD with previous December inclusion, fetch and combine December data
                if (reportType === 'YTD Recap' && includePrevDecember && !useMonthlyData) {
                    try {
                        const currentYear = new Date().getFullYear();
                        const previousDecember = `12/${currentYear - 1}`;
                        
                        const decemberEndpoint = endpoint.replace('getweekly', 'getmonthly');
                        const decemberResponse = await api.get(`/alp/${decemberEndpoint}`, {
                            params: {
                                month: previousDecember,
                                MGA_NAME: selectedMGA?.value || '',
                                rga: selectedRGA?.value || '',
                                tree: selectedTree?.value || '',
                            }
                        });
                        
                        if (decemberResponse.data.success && decemberResponse.data.data.length > 0) {
                            // Combine current YTD data with previous December data
                            currentData = combineYTDWithDecember(currentData, decemberResponse.data.data);
                        }
                    } catch (error) {
                        console.warn('Could not fetch previous December data:', error);
                        // Continue with regular YTD data if December fetch fails
                    }
                }
                
                const currentProcessedData = processLeaderboardData(currentData, key);
                
                // Fetch previous period data for comparison
                const previousDate = getPreviousDate(selectedDate);
                let previousProcessedData = [];
                
                if (previousDate) {
                    try {
                        const { startDate: prevStartDate, endDate: prevEndDate } = calculateDateRange(previousDate);
                        const previousFilters = { ...filters, startDate: prevStartDate, endDate: prevEndDate };
                        const previousResponse = await api.get(`/alp/${endpoint}`, { params: previousFilters });
                        
                        if (previousResponse.data.success) {
                            previousProcessedData = processLeaderboardData(previousResponse.data.data, key);
                        }
                    } catch (error) {
                        console.warn(`Could not fetch previous period data for ${key}:`, error);
                    }
                }

                // Calculate rank changes and achievements
                const dataWithRankChanges = calculateRankChanges(currentProcessedData, previousProcessedData);
                const finalData = dataWithRankChanges.map(item => ({
                    ...item,
                    achievement: detectAchievements(item, currentProcessedData, previousProcessedData, key)
                }));

                setLeaderboardData(prev => ({
                    ...prev,
                    [key]: { data: finalData, loading: false }
                }));

                // Store previous data for reference
                setPreviousLeaderboardData(prev => ({
                    ...prev,
                    [key]: { data: previousProcessedData }
                }));
            }
        } catch (error) {
            console.error(`Error fetching ${key} leaderboard data:`, error);
            setLeaderboardData(prev => ({
                ...prev,
                [key]: { data: [], loading: false }
            }));
        }
    };

    // Process leaderboard data to match the Leaderboard component format
    const processLeaderboardData = (data, key) => {
        return data
            .filter(filterByExperience)
            .map((row, index) => {
                let alpValue;

                if (key === 'sa') {
                    alpValue = isF6
                        ? netOrGross === 'net' ? row.LVL_2_F6_NET : row.LVL_2_F6_GROSS
                        : netOrGross === 'net' ? row.LVL_2_NET : row.LVL_2_GROSS;
                } else if (['ga', 'mga', 'rga'].includes(key)) {
                    alpValue = isF6
                        ? netOrGross === 'net' ? row.LVL_3_F6_NET : row.LVL_3_F6_GROSS
                        : netOrGross === 'net' ? row.LVL_3_NET : row.LVL_3_GROSS;
                } else {
                    alpValue = netOrGross === 'net' ? row.LVL_1_NET : row.LVL_1_GROSS;
                }

                return {
                    rank: index + 1,
                    name: row.LagnName,
                    value: alpValue || 0,
                    profile_picture: row.profpic,
                    clname: row.clname,
                    mga: row.MGA_NAME,
                    mgaLastName: getMgalastName(row.MGA_NAME, row.LagnName),
                    esid: row.esid,
                    start: row.start,
                    // Handle both reportdate (Weekly_ALP) and month (Monthly_ALP)
                    reportdate: row.reportdate || row.month
                };
            })
            .sort((a, b) => (b.value || 0) - (a.value || 0))
            .map((item, index) => ({ ...item, rank: index + 1 }));
    };

    // Process Daily_Activity data to match the Leaderboard component format
    const processDailyActivityData = (data, key, selectedMetric = 'alp') => {
        if (key === 'all') {
            // For "all" leaderboard, aggregate by agent name to avoid duplicates
            const agentMap = new Map();
            
            // First, group all data by agent name and apply experience filtering
            data.forEach(row => {
                if (!row.agent || row.agent.trim() === '') return;
                
                // Apply experience filtering
                if (!filterByExperienceForDailyActivity(row)) return;
                
                const agentName = row.agent.trim();
                if (!agentMap.has(agentName)) {
                    agentMap.set(agentName, {
                        agent: agentName,
                        MGA: row.MGA || '',
                        esid: row.esid || '',
                        reportDate: row.reportDate,
                        userRole: row.userRole || '', // Add userRole from activeusers.clname
                        calls: 0,
                        appts: 0,
                        sits: 0,
                        sales: 0,
                        alp: 0,
                        refs: 0,
                        refAlp: 0
                    });
                }
                
                // Aggregate the metrics
                const existing = agentMap.get(agentName);
                existing.calls += parseFloat(row.calls || 0);
                existing.appts += parseFloat(row.appts || 0);
                existing.sits += parseFloat(row.sits || 0);
                existing.sales += parseFloat(row.sales || 0);
                existing.alp += parseFloat(row.alp || 0);
                existing.refs += parseFloat(row.refs || 0);
                existing.refAlp += parseFloat(row.refAlp || 0);
                
                // Update userRole if current entry has one and existing doesn't
                if (row.userRole && !existing.userRole) {
                    existing.userRole = row.userRole;
                }
            });
            
            // Convert aggregated data to array and process
            return Array.from(agentMap.values())
                .map((row, index) => {
                    let value;
                    
                    // Map the selected metric to the actual column value
                    switch (selectedMetric) {
                        case 'calls':
                            value = row.calls;
                            break;
                        case 'appts':
                            value = row.appts;
                            break;
                        case 'sits':
                            value = row.sits;
                            break;
                        case 'sales':
                            value = row.sales;
                            break;
                        case 'alp':
                            value = row.alp;
                            break;
                        case 'refs':
                            value = row.refs;
                            break;
                        case 'refAlp':
                            value = row.refAlp;
                            break;
                        default:
                            value = row.alp;
                    }

                    return {
                        rank: index + 1,
                        name: row.agent,
                        value: parseFloat(value) || 0,
                        profile_picture: null,
                        clname: row.userRole || row.agent, // Use userRole from activeusers.clname, fallback to agent name
                        mga: getMgalastName(row.MGA, row.agent), // Use last name only
                        mgaLastName: getMgalastName(row.MGA, row.agent),
                        esid: row.esid || '',
                        start: null,
                        reportdate: row.reportDate,
                        // Additional Daily_Activity specific fields for reference
                        calls: row.calls,
                        appts: row.appts,
                        sits: row.sits,
                        sales: row.sales,
                        alp: row.alp,
                        refs: row.refs,
                        refAlp: row.refAlp
                    };
                })
                .sort((a, b) => (b.value || 0) - (a.value || 0))
                .map((item, index) => ({ ...item, rank: index + 1 }));
        } else {
            // For SA, GA, MGA, RGA - aggregate by hierarchy level
            let hierarchyColumn;
            let hierarchyName;
            
            switch (key) {
                case 'sa':
                    hierarchyColumn = 'SA';
                    hierarchyName = 'SA';
                    break;
                case 'ga':
                    hierarchyColumn = 'GA';
                    hierarchyName = 'GA';
                    break;
                case 'mga':
                    hierarchyColumn = 'MGA';
                    hierarchyName = 'MGA';
                    break;
                case 'rga':
                    hierarchyColumn = 'rga';
                    hierarchyName = 'RGA';
                    break;
                default:
                    return [];
            }
            
            // Apply experience filtering to the data first
            const filteredData = data.filter(filterByExperienceForDailyActivity);
            
            // Get unique values from the hierarchy column
            const uniqueHierarchyValues = [...new Set(
                filteredData
                    .filter(row => row[hierarchyColumn] && row[hierarchyColumn].trim() !== '')
                    .map(row => row[hierarchyColumn].trim())
            )];
            
            // Aggregate data for each unique hierarchy value
            const aggregatedData = uniqueHierarchyValues.map(hierarchyValue => {
                // Find all rows where either:
                // 1. The hierarchy column matches this value, OR
                // 2. The agent column matches this value (for self-reporting)
                const relatedRows = filteredData.filter(row => 
                    (row[hierarchyColumn] && row[hierarchyColumn].trim() === hierarchyValue) ||
                    (row.agent && row.agent.trim() === hierarchyValue)
                );
                
                // Sum up the metrics for all related rows
                const aggregatedMetrics = relatedRows.reduce((acc, row) => {
                    acc.calls += parseFloat(row.calls || 0);
                    acc.appts += parseFloat(row.appts || 0);
                    acc.sits += parseFloat(row.sits || 0);
                    acc.sales += parseFloat(row.sales || 0);
                    acc.alp += parseFloat(row.alp || 0);
                    acc.refs += parseFloat(row.refs || 0);
                    acc.refAlp += parseFloat(row.refAlp || 0);
                    return acc;
                }, {
                    calls: 0,
                    appts: 0,
                    sits: 0,
                    sales: 0,
                    alp: 0,
                    refs: 0,
                    refAlp: 0
                });
                
                // Get the value for the selected metric
                let value;
                switch (selectedMetric) {
                    case 'calls':
                        value = aggregatedMetrics.calls;
                        break;
                    case 'appts':
                        value = aggregatedMetrics.appts;
                        break;
                    case 'sits':
                        value = aggregatedMetrics.sits;
                        break;
                    case 'sales':
                        value = aggregatedMetrics.sales;
                        break;
                    case 'alp':
                        value = aggregatedMetrics.alp;
                        break;
                    case 'refs':
                        value = aggregatedMetrics.refs;
                        break;
                    case 'refAlp':
                        value = aggregatedMetrics.refAlp;
                        break;
                    default:
                        value = aggregatedMetrics.alp;
                }
                
                // Get additional info from the first related row for display purposes
                const firstRow = relatedRows[0] || {};
                
                return {
                    rank: 0, // Will be set after sorting
                    name: hierarchyValue,
                    value: value,
                    profile_picture: null,
                    clname: hierarchyName,
                    mga: getMgalastName(firstRow.MGA, firstRow.agent), // Use last name only
                    mgaLastName: getMgalastName(firstRow.MGA, firstRow.agent),
                    esid: firstRow.esid || '',
                    start: null,
                    reportdate: firstRow.reportDate,
                    // Store all aggregated metrics for reference
                    calls: aggregatedMetrics.calls,
                    appts: aggregatedMetrics.appts,
                    sits: aggregatedMetrics.sits,
                    sales: aggregatedMetrics.sales,
                    alp: aggregatedMetrics.alp,
                    refs: aggregatedMetrics.refs,
                    refAlp: aggregatedMetrics.refAlp
                };
            });
            
            // Sort by value and assign ranks
            return aggregatedData
                .sort((a, b) => (b.value || 0) - (a.value || 0))
                .map((item, index) => ({ ...item, rank: index + 1 }));
        }
    };

    // Process Codes data to match the Leaderboard component format
    const processCodesData = (data, key) => {
        if (key === 'all') {
            // For "all" leaderboard, aggregate all manager types with hierarchical counting
            const managerMap = new Map();
            
            // Process each row and count codes for the highest-level manager present
            data.forEach(row => {
                let managerName = null;
                let managerType = null;
                
                // Hierarchical logic: SA takes priority, then GA, then MGA
                if (row.SA && row.SA.trim() !== '') {
                    // If SA is present, count for SA only
                    managerName = row.SA.trim();
                    managerType = 'SA';
                } else if (row.GA && row.GA.trim() !== '') {
                    // If GA is present but no SA, count for GA
                    managerName = row.GA.trim();
                    managerType = 'GA';
                } else if (row.MGA && row.MGA.trim() !== '') {
                    // If MGA is present but no SA or GA, count for MGA
                    managerName = row.MGA.trim();
                    managerType = 'MGA';
                }
                
                // Only process if we found a manager
                if (managerName && managerType) {
                    if (!managerMap.has(managerName)) {
                        managerMap.set(managerName, {
                            name: managerName,
                            MGA: row.MGA || '',
                            PRODDATE: row.PRODDATE,
                            codeCount: 0,
                            managerType: managerType
                        });
                    }
                    managerMap.get(managerName).codeCount += 1;
                }
            });
            
            // Convert aggregated data to array and process
            return Array.from(managerMap.values())
                .map((row, index) => ({
                    rank: index + 1,
                    name: row.name,
                    value: row.codeCount,
                    profile_picture: null,
                    clname: row.managerType, // Show SA, GA, or MGA as the role
                    mga: getMgalastName(row.MGA, row.name),
                    mgaLastName: getMgalastName(row.MGA, row.name),
                    esid: '',
                    start: null,
                    reportdate: row.PRODDATE,
                }))
                .sort((a, b) => (b.value || 0) - (a.value || 0))
                .map((item, index) => ({ ...item, rank: index + 1 }));
        } else {
            // For SA, GA, MGA - aggregate by hierarchy level
            let hierarchyColumn;
            let hierarchyName;
            
            switch (key) {
                case 'sa':
                    hierarchyColumn = 'SA';
                    hierarchyName = 'SA';
                    break;
                case 'ga':
                    hierarchyColumn = 'GA';
                    hierarchyName = 'GA';
                    break;
                case 'mga':
                    hierarchyColumn = 'MGA';
                    hierarchyName = 'MGA';
                    break;
                default:
                    return [];
            }
            
            // Get unique values from the hierarchy column
            const uniqueHierarchyValues = [...new Set(
                data
                    .filter(row => row[hierarchyColumn] && row[hierarchyColumn].trim() !== '')
                    .map(row => row[hierarchyColumn].trim())
            )];
            
            // Aggregate data for each unique hierarchy value
            const aggregatedData = uniqueHierarchyValues.map(hierarchyValue => {
                // Find all rows where either:
                // 1. The hierarchy column matches this value, OR
                // 2. The LagnName column matches this value (for self-reporting)
                const relatedRows = data.filter(row => 
                    (row[hierarchyColumn] && row[hierarchyColumn].trim() === hierarchyValue) ||
                    (row.LagnName && row.LagnName.trim() === hierarchyValue)
                );
                
                // Count the codes for this hierarchy value
                const codeCount = relatedRows.length;
                
                // Get additional info from the first related row for display purposes
                const firstRow = relatedRows[0] || {};
                
                return {
                    rank: 0, // Will be set after sorting
                    name: hierarchyValue,
                    value: codeCount,
                    profile_picture: null,
                    clname: hierarchyName,
                    mga: getMgalastName(firstRow.MGA, firstRow.LagnName),
                    mgaLastName: getMgalastName(firstRow.MGA, firstRow.LagnName),
                    esid: '',
                    start: null,
                    reportdate: firstRow.PRODDATE,
                };
            });
            
            // Sort by value and assign ranks
            return aggregatedData
                .sort((a, b) => (b.value || 0) - (a.value || 0))
                .map((item, index) => ({ ...item, rank: index + 1 }));
        }
    };

    // Process VIPs data to match the Leaderboard component format
    const processVIPsData = (data, key) => {
        // DEBUG: Log raw VIP data being processed
        console.log(`🔍 [VIP Debug] Processing VIPs data for key: ${key}`, {
            dataLength: data.length,
            sampleData: data.slice(0, 3).map(row => ({
                lagnname: row.lagnname,
                mga: row.mga,
                sa: row.sa,
                ga: row.ga,
                vip_month: row.vip_month
            }))
        });
        
        if (key === 'all') {
            // For "all" leaderboard, aggregate all manager types with hierarchical counting
            const managerMap = new Map();
            
            // Process each row and count VIPs for the highest-level manager present
            data.forEach(row => {
                let managerName = null;
                let managerType = null;
                
                // Hierarchical logic: SA takes priority, then GA, then MGA
                if (row.sa && row.sa.trim() !== '') {
                    // If SA is present, count for SA only
                    managerName = row.sa.trim();
                    managerType = 'SA';
                } else if (row.ga && row.ga.trim() !== '') {
                    // If GA is present but no SA, count for GA
                    managerName = row.ga.trim();
                    managerType = 'GA';
                } else if (row.mga && row.mga.trim() !== '') {
                    // If MGA is present but no SA or GA, count for MGA
                    managerName = row.mga.trim();
                    managerType = 'MGA';
                }
                
                // Only process if we found a manager
                if (managerName && managerType) {
                    if (!managerMap.has(managerName)) {
                        managerMap.set(managerName, {
                            name: managerName,
                            mga: row.mga || '',
                            vip_month: row.vip_month,
                            vipCount: 0,
                            managerType: managerType
                        });
                    }
                    managerMap.get(managerName).vipCount += 1;
                }
            });
            
            // Convert aggregated data to array and process
            return Array.from(managerMap.values())
                .map((row, index) => ({
                    rank: index + 1,
                    name: row.name,
                    value: row.vipCount,
                    profile_picture: null,
                    clname: row.managerType, // Show SA, GA, or MGA as the role
                    mga: getMgalastName(row.mga, row.name),
                    mgaLastName: getMgalastName(row.mga, row.name),
                    esid: '',
                    start: null,
                    reportdate: row.vip_month,
                }))
                .sort((a, b) => (b.value || 0) - (a.value || 0))
                .map((item, index) => ({ ...item, rank: index + 1 }));
        } else {
            // For SA, GA, MGA - aggregate by hierarchy level
            let hierarchyColumn;
            let hierarchyName;
            
            switch (key) {
                case 'sa':
                    hierarchyColumn = 'sa';
                    hierarchyName = 'SA';
                    break;
                case 'ga':
                    hierarchyColumn = 'ga';
                    hierarchyName = 'GA';
                    break;
                case 'mga':
                    hierarchyColumn = 'mga';
                    hierarchyName = 'MGA';
                    break;
                default:
                    return [];
            }
            
            // Get unique values from the hierarchy column
            const uniqueHierarchyValues = [...new Set(
                data
                    .filter(row => row[hierarchyColumn] && row[hierarchyColumn].trim() !== '')
                    .map(row => row[hierarchyColumn].trim())
            )];
            
            // Aggregate data for each unique hierarchy value
            const aggregatedData = uniqueHierarchyValues.map(hierarchyValue => {
                // Find all rows where the hierarchy column matches this value
                // Do NOT include self-reporting to avoid double counting
                const relatedRows = data.filter(row => 
                    row[hierarchyColumn] && row[hierarchyColumn].trim() === hierarchyValue
                );
                
                // Count the VIPs for this hierarchy value
                const vipCount = relatedRows.length;
                
                // DEBUG: Log the count for MGA table
                if (hierarchyName === 'MGA') {
                    console.log(`🔍 [VIP Debug] ${hierarchyName} ${hierarchyValue}:`, {
                        totalDataRows: data.length,
                        relatedRowsCount: relatedRows.length,
                        relatedRows: relatedRows.map(row => ({
                            lagnname: row.lagnname,
                            mga: row.mga,
                            vip_month: row.vip_month
                        })),
                        hierarchyColumn: hierarchyColumn,
                        searchValue: hierarchyValue
                    });
                }
                
                // Get additional info from the first related row for display purposes
                const firstRow = relatedRows[0] || {};
                
                return {
                    rank: 0, // Will be set after sorting
                    name: hierarchyValue,
                    value: vipCount,
                    profile_picture: null,
                    clname: hierarchyName,
                    mga: getMgalastName(firstRow.mga, firstRow.lagnname),
                    mgaLastName: getMgalastName(firstRow.mga, firstRow.lagnname),
                    esid: '',
                    start: null,
                    reportdate: firstRow.vip_month,
                };
            });
            
            // Sort by value and assign ranks
            return aggregatedData
                .sort((a, b) => (b.value || 0) - (a.value || 0))
                .map((item, index) => ({ ...item, rank: index + 1 }));
        }
    };

    // Filter by experience logic for Daily_Activity data
    const filterByExperienceForDailyActivity = (row) => {
        if (experienceFilter === 'all') return true;

        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        let hireDate = null;

        // Use esid as hire date for Daily_Activity data
        if (row.esid) {
            // Handle different date formats that might be in esid
            // Could be ISO string, date string, or timestamp
            hireDate = new Date(row.esid);
            
            // If the date parsing failed, try parsing as ISO date
            if (isNaN(hireDate.getTime()) && typeof row.esid === 'string') {
                // Try parsing just the date part if it's an ISO string
                const datePart = row.esid.split('T')[0];
                hireDate = new Date(datePart);
            }
        }

        // If we couldn't parse a valid hire date, include in all groups
        if (!hireDate || isNaN(hireDate.getTime())) {
            return true;
        }

        // Rookie: hired within the last year
        // Veteran: hired more than a year ago
        if (experienceFilter === 'rookie') {
            return hireDate > oneYearAgo;
        } else if (experienceFilter === 'veteran') {
            return hireDate <= oneYearAgo;
        }

        return true;
    };

    // Filter by experience logic
    const filterByExperience = (row) => {
        if (experienceFilter === 'all') return true;

        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        let formattedDate = null;

        if (row.start) {
            const [month, day, year] = row.start.split('/');
            formattedDate = new Date(`${year}-${month}-${day}`);
        } else if (row.esid) {
            formattedDate = new Date(row.esid.split('T')[0]);
        }

        if (!formattedDate) return true;

        if (row.clname === 'MGA' || row.clname === 'RGA') {
            return experienceFilter === 'rookie'
                ? formattedDate > oneYearAgo
                : experienceFilter === 'veteran'
                ? formattedDate <= oneYearAgo
                : true;
        } else {
            return experienceFilter === 'rookie'
                ? formattedDate > new Date('2023-12-31')
                : experienceFilter === 'veteran'
                ? formattedDate <= new Date('2023-12-31')
                : true;
        }
    };

    // Format currency values
    const formatValue = (value) => {
        if (!value) return "$0";
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    // Format Daily_Activity values (non-currency)
    const formatDailyActivityValue = (value) => {
        if (!value && value !== 0) return "0";
        
        // For ALP and refAlp metrics, format as currency
        if (dailyActivityMetric === 'alp' || dailyActivityMetric === 'refAlp') {
            return new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(value);
        }
        
        // For other metrics (calls, appts, sits, sales, refs), format as number
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    // Extract last name from MGA field (format: "LAST FIRST MIDDLE SUFFIX")
    // If MGA is blank, use the agent's last name (also in "LAST FIRST MIDDLE SUFFIX" format)
    const getMgalastName = (mgaName, agentName) => {
        if (mgaName && typeof mgaName === 'string' && mgaName.trim()) {
            const parts = mgaName.trim().split(/\s+/);
            return parts[0] || ''; // Return first part (LAST name)
        }
        
        // If MGA is blank, use agent's last name (first part of LagnName)
        if (agentName && typeof agentName === 'string') {
            const parts = agentName.trim().split(/\s+/);
            return parts[0] || ''; // Return first part (LAST name)
        }
        
        return '';
    };

    // Format metric name for display
    const formatMetricName = (metric) => {
        const metricNames = {
            'calls': 'Calls',
            'appts': 'Appointments',
            'sits': 'Sits',
            'sales': 'Sales',
            'alp': 'ALP',
            'refs': 'Referrals',
            'refAlp': 'Ref ALP'
        };
        return metricNames[metric] || metric;
    };

    // Handle date navigation
    const handlePreviousDate = () => {
        // Handle grouped format (MTD)
        if (reportDates.length > 0 && typeof reportDates[0] === 'object' && reportDates[0].type) {
            const currentIndex = reportDates.findIndex(item => item.value === selectedDate);
            if (currentIndex > 0) {
                // Find the previous non-header item
                for (let i = currentIndex - 1; i >= 0; i--) {
                    if (!reportDates[i].isHeader) {
                        setSelectedDate(reportDates[i].value);
                        return;
                    }
                }
            }
        } else {
            // Handle regular format (Weekly/YTD)
            const currentIndex = reportDates.indexOf(selectedDate);
            if (currentIndex > 0) {
                setSelectedDate(reportDates[currentIndex - 1]);
            }
        }
    };

    const handleNextDate = () => {
        // Handle grouped format (MTD)
        if (reportDates.length > 0 && typeof reportDates[0] === 'object' && reportDates[0].type) {
            const currentIndex = reportDates.findIndex(item => item.value === selectedDate);
            if (currentIndex < reportDates.length - 1) {
                // Find the next non-header item
                for (let i = currentIndex + 1; i < reportDates.length; i++) {
                    if (!reportDates[i].isHeader) {
                        setSelectedDate(reportDates[i].value);
                        return;
                    }
                }
            }
        } else {
            // Handle regular format (Weekly/YTD)
            const currentIndex = reportDates.indexOf(selectedDate);
            if (currentIndex < reportDates.length - 1) {
                setSelectedDate(reportDates[currentIndex + 1]);
            }
        }
    };

    // Update MGA options when RGA changes
    useEffect(() => {
        if (selectedRGA) {
            const filteredMGAOptions = allOptions
                .filter((opt) => opt.rga === selectedRGA.value)
                .map((opt) => ({ value: opt.lagnname, label: opt.lagnname }));
            setMgaOptions(filteredMGAOptions);
        } else {
            const uniqueMGAs = [...new Set(allOptions.map((opt) => opt.lagnname))];
            setMgaOptions(uniqueMGAs.map((value) => ({ value, label: value })));
        }
    }, [selectedRGA, allOptions]);

    // Load data when filters change
    useEffect(() => {
        if ((selectedDate && reportDates.length > 0) || (isVIPs && selectedDate)) {
            if (isMORE) {
                // For MORE, only fetch MGA and RGA data
                fetchLeaderboardData('getweeklyall', 'mga'); // Use 'mga' as the main leaderboard for MORE
                fetchLeaderboardData('getweeklyrga', 'rga');
            } else {
                // For other data sources, fetch all hierarchy levels
                fetchLeaderboardData('getweeklyall', 'all');
                fetchLeaderboardData('getweeklysa', 'sa');
                fetchLeaderboardData('getweeklyga', 'ga');
                fetchLeaderboardData('getweeklymga', 'mga');
                // Only fetch RGA data when not in Daily Activity, Codes, VIPs, or Ref Sales mode
                if (!isDailyActivity && !isCodes && !isVIPs && !isRefSales) {
                    fetchLeaderboardData('getweeklyrga', 'rga');
                }
            }
        }
    }, [selectedDate, reportType, selectedMGA, selectedRGA, selectedTree, isF6, netOrGross, experienceFilter, reportDates, includePrevDecember, isDailyActivity, dailyActivityMetric, isCodes, isVIPs, isRefSales, isMORE]);

    // Initialize data and refetch when reportType changes
    useEffect(() => {
        fetchReportDates();
        fetchUniqueMGAOptions();
        // Fetch allowed names once (or when auth/session changes if needed)
        fetchAllowedNamesAndIds();
        
        // Reset December toggle when switching away from YTD
        if (reportType !== 'YTD Recap') {
            setIncludePrevDecember(false);
        }
    }, [reportType, isDailyActivity, isCodes, isVIPs, isRefSales, isMORE]);

    const fetchAllowedNamesAndIds = async () => {
        try {
            // Prefer endpoint that exposes Active and managerActive
            // Fallback to admin or auth endpoints if needed
            const response = await api.get('/auth/activeusers', { params: { active: 'y', managerActive: 'y' } });
            const rows = Array.isArray(response.data) ? response.data : (response.data.users || response.data.data || []);
            const names = rows
                .filter(r => (r.Active === 'y' || r.active === 'y') && (r.managerActive === 'y' || r.manageractive === 'y'))
                .map(r => r.lagnname)
                .filter(Boolean);
            setAllowedNames(new Set(names.map(n => String(n).toLowerCase().trim())));
            const ids = rows
                .map(r => r.id)
                .filter((v) => v !== null && v !== undefined)
                .map(String);
            setAllowedIds(new Set(ids));
        } catch (e) {
            try {
                // Secondary attempt: users active listing without Active flag; still capture managerActive
                const response2 = await api.get('/users/active');
                const rows2 = Array.isArray(response2.data) ? response2.data : [];
                const names2 = rows2
                    .filter(r => (r.managerActive === 'y' || r.manageractive === 'y'))
                    .map(r => r.lagnname)
                    .filter(Boolean);
                setAllowedNames(new Set(names2.map(n => String(n).toLowerCase().trim())));
                const ids2 = rows2
                    .map(r => r.id)
                    .filter((v) => v !== null && v !== undefined)
                    .map(String);
                setAllowedIds(new Set(ids2));
            } catch (_) {
                // As last resort, leave set empty (no extra filtering beyond backend/row flags)
                setAllowedNames(new Set());
                setAllowedIds(new Set());
            }
        }
    };

    // Reset all filters
    const resetAllFilters = () => {
        setSelectedMGA(null);
        setSelectedRGA(null);
        setSelectedTree(null);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.reported-button-container')) {
                setIsReportedDropdownOpen(false);
            }
        };

        if (isReportedDropdownOpen) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [isReportedDropdownOpen]);

    // Custom filter content for the FilterMenu
    const customFilterContent = (
        <div className="leaderboard-filter-content">
            <div className="filter-group">
                <span className="filter-group-label" style={{
                    fontWeight: '500',
                    marginBottom: '8px',
                    display: 'block',
                    color: 'var(--text-primary)'
                }}>
                    Filter by MGA
                </span>
                <Select
                    options={mgaOptions}
                    value={selectedMGA}
                    onChange={(value) => setSelectedMGA(value)}
                    isClearable
                    placeholder="Select MGA"
                    className="filter-select-small"
                    styles={{
                        container: (base) => ({ ...base, fontSize: '14px' }),
                        control: (base) => ({ 
                            ...base, 
                            minHeight: '32px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--surface-color)'
                        }),
                        menuPortal: (base) => ({ ...base, zIndex: 9999 })
                    }}
                    menuPortalTarget={document.body}
                />
            </div>

            <div className="filter-group">
                <span className="filter-group-label" style={{
                    fontWeight: '500',
                    marginBottom: '8px',
                    display: 'block',
                    color: 'var(--text-primary)'
                }}>
                    Filter by RGA
                </span>
                <Select
                    options={rgaOptions}
                    value={selectedRGA}
                    onChange={(value) => setSelectedRGA(value)}
                    isClearable
                    placeholder="Select RGA"
                    className="filter-select-small"
                    styles={{
                        container: (base) => ({ ...base, fontSize: '14px' }),
                        control: (base) => ({ 
                            ...base, 
                            minHeight: '32px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--surface-color)'
                        }),
                        menuPortal: (base) => ({ ...base, zIndex: 9999 })
                    }}
                    menuPortalTarget={document.body}
                />
            </div>

            <div className="filter-group">
                <span className="filter-group-label" style={{
                    fontWeight: '500',
                    marginBottom: '8px',
                    display: 'block',
                    color: 'var(--text-primary)'
                }}>
                    Filter by Tree
                </span>
                <Select
                    options={treeOptions}
                    value={selectedTree}
                    onChange={(value) => setSelectedTree(value)}
                    isClearable
                    placeholder="Select Tree"
                    className="filter-select-small"
                    styles={{
                        container: (base) => ({ ...base, fontSize: '14px' }),
                        control: (base) => ({ 
                            ...base, 
                            minHeight: '32px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--surface-color)'
                        }),
                        menuPortal: (base) => ({ ...base, zIndex: 9999 })
                    }}
                    menuPortalTarget={document.body}
                />
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
                    Reset Filters
                </button>
            </div>
        </div>
    );

    return (
        <div className="leaderboard-page">
            {/* Data Source Selection - Centered at top */}
            <div className="data-source-selection">
                <div className="data-source-buttons">
                    <button 
                        className={!isDailyActivity && !isCodes && !isVIPs && !isRefSales && !isMORE ? 'data-source-btn active' : 'data-source-btn'}
                        onClick={() => {
                            setIsDailyActivity(false);
                            setIsCodes(false);
                            setIsVIPs(false);
                            setIsRefSales(false);
                            setIsMORE(false);
                        }}
                    >
                        Official ALP
                    </button>
                    <div className="reported-button-container">
                        <button 
                            className={isDailyActivity ? 'data-source-btn active reported-btn' : 'data-source-btn reported-btn'}
                            onClick={() => {
                                setIsDailyActivity(true);
                                setIsCodes(false);
                                setIsVIPs(false);
                                setIsRefSales(false);
                                setIsMORE(false);
                            }}
                        >
                            <span>Reported {formatMetricName(dailyActivityMetric)}</span>
                        </button>
                        <button 
                            className={isDailyActivity ? 'data-source-dropdown-btn active' : 'data-source-dropdown-btn'}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsReportedDropdownOpen(!isReportedDropdownOpen);
                            }}
                        >
                            <span className={`dropdown-arrow ${isReportedDropdownOpen ? 'open' : ''}`}>▼</span>
                        </button>
                        {isReportedDropdownOpen && (
                            <div className="reported-dropdown">
                                <div className="dropdown-item" onClick={() => { setDailyActivityMetric('alp'); setIsReportedDropdownOpen(false); }}>
                                    ALP
                                </div>
                                <div className="dropdown-item" onClick={() => { setDailyActivityMetric('calls'); setIsReportedDropdownOpen(false); }}>
                                    Calls
                                </div>
                                <div className="dropdown-item" onClick={() => { setDailyActivityMetric('appts'); setIsReportedDropdownOpen(false); }}>
                                    Appointments
                                </div>
                                <div className="dropdown-item" onClick={() => { setDailyActivityMetric('sits'); setIsReportedDropdownOpen(false); }}>
                                    Sits
                                </div>
                                <div className="dropdown-item" onClick={() => { setDailyActivityMetric('sales'); setIsReportedDropdownOpen(false); }}>
                                    Sales
                                </div>
                                <div className="dropdown-item" onClick={() => { setDailyActivityMetric('refs'); setIsReportedDropdownOpen(false); }}>
                                    Referrals
                                </div>
                                <div className="dropdown-item" onClick={() => { setDailyActivityMetric('refAlp'); setIsReportedDropdownOpen(false); }}>
                                    Ref ALP
                                </div>
                            </div>
                        )}
                    </div>
                    <button 
                        className={isCodes ? 'data-source-btn active' : 'data-source-btn'}
                        onClick={() => {
                            setIsDailyActivity(false);
                            setIsCodes(true);
                            setIsVIPs(false);
                            setIsRefSales(false);
                            setIsMORE(false);
                        }}
                    >
                        Codes
                    </button>
                    <button 
                        className={isVIPs ? 'data-source-btn active' : 'data-source-btn'}
                        onClick={() => {
                            setIsDailyActivity(false);
                            setIsCodes(false);
                            setIsVIPs(true);
                            setIsRefSales(false);
                            setIsMORE(false);
                            // Switch to MTD if currently on Weekly since VIPs doesn't support weekly
                            if (reportType === 'Weekly Recap') {
                                setReportType('MTD Recap');
                            }
                        }}
                    >
                        VIPs
                    </button>
                    <button 
                        className={isRefSales ? 'data-source-btn active' : 'data-source-btn'}
                        onClick={() => {
                            setIsDailyActivity(false);
                            setIsCodes(false);
                            setIsVIPs(false);
                            setIsRefSales(true);
                            setIsMORE(false);
                        }}
                    >
                        Ref Sales
                    </button>
                    <button 
                        className={isMORE ? 'data-source-btn active' : 'data-source-btn'}
                        onClick={() => {
                            setIsDailyActivity(false);
                            setIsCodes(false);
                            setIsVIPs(false);
                            setIsRefSales(false);
                            setIsMORE(true);
                        }}
                    >
                        M.O.R.E.
                    </button>
                </div>
            </div>

            {/* Filter Controls */}
            <div className="leaderboard-filters">
                <div className="leaderboard-filters-left">
                    {/* Experience Filter - Hide when VIPs, Codes, Ref Sales, or MORE is active */}
                    {!isVIPs && !isCodes && !isRefSales && !isMORE && (
                    <div className="experience-filter-container">
                        <span 
                            className={experienceFilter === 'all' ? 'selected' : 'unselected'} 
                            onClick={() => setExperienceFilter('all')}
                        >
                            All
                        </span>
                        <span className="separator">|</span>
                        <span 
                            className={experienceFilter === 'rookie' ? 'selected' : 'unselected'} 
                            onClick={() => setExperienceFilter('rookie')}
                        >
                            Rookie
                        </span>
                        <span className="separator">|</span>
                        <span 
                            className={experienceFilter === 'veteran' ? 'selected' : 'unselected'} 
                            onClick={() => setExperienceFilter('veteran')}
                        >
                            Veteran
                        </span>
                    </div>
                    )}
                    </div>

                {/* Report Type Filter - Centered - Hide Week option when VIPs is active */}
                <div className="leaderboard-filters-center">
                    <div className={`tabs-filter-container ${isVIPs ? 'vips-mode' : ''}`}>
                        {!isVIPs && (
                        <>
                        <span 
                            className={reportType === 'Weekly Recap' ? 'selected' : 'unselected'} 
                            onClick={() => setReportType('Weekly Recap')}
                        >
                            Week
                        </span>
                        <span className="separator">|</span>
                        </>
                        )}
                        <span 
                            className={reportType === 'MTD Recap' ? 'selected' : 'unselected'} 
                            onClick={() => setReportType('MTD Recap')}
                        >
                            MTD
                        </span>
                        <span className="separator">|</span>
                        <span 
                            className={reportType === 'YTD Recap' ? 'selected' : 'unselected'} 
                            onClick={() => setReportType('YTD Recap')}
                        >
                            YTD
                        </span>
                    </div>
                </div>

                <div className="leaderboard-filters-right">
                    {/* Toggle Controls - Hide when Daily Activity, Codes, VIPs, Ref Sales, or MORE is active */}
                    {!isDailyActivity && !isCodes && !isVIPs && !isRefSales && !isMORE && (
                    <div className="toggle-container">
                        <span 
                            className={isF6 ? 'selected' : 'unselected'} 
                            onClick={() => setIsF6(!isF6)}
                        >
                            F6
                        </span>
                        <span className="separator">|</span>
                        <span 
                            className={netOrGross === 'net' ? 'selected' : 'unselected'} 
                            onClick={() => setNetOrGross('net')}
                        >
                            Net
                        </span>
                        <span className="separator">|</span>
                        <span 
                            className={netOrGross === 'gross' ? 'selected' : 'unselected'} 
                            onClick={() => setNetOrGross('gross')}
                        >
                            Gross
                        </span>
                    </div>
                    )}

                    {/* Filter Button */}
                    <div className="filter-button-container">
                        <FilterMenu
                            menuType="expandable"
                            buttonLabel={<FiFilter size={16} />}
                            position="bottom"
                            activeFilters={filters}
                            customContent={customFilterContent}
                            customContentOnly={true}
                        />
                    </div>

                    {/* YTD December Toggle - Only show when YTD is selected and not in Daily Activity, Codes, VIPs, Ref Sales, or MORE mode */}
                    {reportType === 'YTD Recap' && !isDailyActivity && !isCodes && !isVIPs && !isRefSales && !isMORE && (
                        <div className="december-toggle-container">
                            <span 
                                className={includePrevDecember ? 'selected' : 'unselected'} 
                                onClick={() => setIncludePrevDecember(!includePrevDecember)}
                                title="Include December from previous year"
                            >
                                +Prev Dec
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Date Selection */}
            <div className="date-select-container">
                <button className="arrow-change-button" onClick={handleNextDate}>&lt;</button>
                <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="date-select"
                >
                    {reportDates && reportDates.length > 0 ? reportDates.map((dateItem, index) => {
                        // Safety check for undefined/null dateItem
                        if (!dateItem) {
                            console.warn('Undefined dateItem at index:', index);
                            return null;
                        }

                        // Handle grouped format (MTD)
                        if (typeof dateItem === 'object' && dateItem.type) {
                            if (dateItem.isHeader) {
                                return (
                                    <option 
                                        key={`header-${index}`} 
                                        value={dateItem.value || ''}
                                        style={{ 
                                            fontWeight: 'bold', 
                                            backgroundColor: '#f0f0f0',
                                            fontSize: '14px'
                                        }}
                                    >
                                        {dateItem.label || 'Unknown'}
                                    </option>
                                );
                            } else {
                                return (
                                    <option 
                                        key={`date-${index}`} 
                                        value={dateItem.value || ''}
                                        style={{ paddingLeft: '20px' }}
                                    >
                                        &#8195;{dateItem.label || 'Unknown'}
                                    </option>
                                );
                            }
                        } else {
                            // Handle regular format (Weekly/YTD)
                            const date = typeof dateItem === 'string' ? dateItem : (dateItem && dateItem.value ? dateItem.value : '');
                            
                            if (!date) {
                                console.warn('No valid date found for dateItem:', dateItem);
                                return null;
                            }
                            
                            return (
                                <option key={date} value={date}>
                                    {isMORE ? 
                                        date // Display MORE_Date as-is
                                        : (isDailyActivity || isCodes || isVIPs || isRefSales) ? 
                                            (isYYYYFormat(date) ? date : isMMYYYYFormat(date) ? date : formatWeeklyRange(date)) 
                                            : formatToMMDDYYYY(date)
                                    }
                                </option>
                            );
                        }
                    }).filter(Boolean) : (
                        <option value="">Loading dates...</option>
                    )}
                </select>
                <button className="arrow-change-button" onClick={handlePreviousDate}>&gt;</button>
            </div>



            {/* Leaderboards */}
            <div className="leaderboards-container">
                {/* Top Producers - spans full width - hide for MORE mode since we show MGA/RGA below */}
                {!isMORE && (
                    <div className="leaderboard-main-row">
                        <Leaderboard
                            data={leaderboardData.all.data}
                        title={
                            isDailyActivity 
                                ? `Top Producers - ${formatMetricName(dailyActivityMetric)}`
                                : isCodes 
                                    ? "Top Producers - Direct Codes"
                                    : isVIPs
                                        ? "Top Producers - VIPs"
                                        : isRefSales
                                            ? "Top Producers - Ref Sales"
                                            : isMORE
                                                ? "Top MGAs - M.O.R.E. Hires"
                                                : "Top Producers"
                        }
                        nameField="name"
                        valueField="value"
                        allowedNames={allowedNames}
                        allowedIds={allowedIds}
                        rawNameField={
                            isDailyActivity ? 'name' :
                            isCodes ? 'name' :
                            isVIPs ? 'name' :
                            isRefSales ? 'name' :
                            isMORE ? 'name' :
                            'name'
                        }
                        formatValue={
                            isDailyActivity 
                                ? formatDailyActivityValue 
                                : isCodes 
                                    ? (value) => new Intl.NumberFormat('en-US').format(value || 0)
                                    : isVIPs
                                        ? (value) => new Intl.NumberFormat('en-US').format(value || 0)
                                        : isRefSales
                                            ? (value) => new Intl.NumberFormat('en-US').format(value || 0)
                                            : isMORE
                                                ? (value) => `${value || 0} hires`
                                                : formatValue
                        }
                        loading={isMORE ? leaderboardData.mga.loading : leaderboardData.all.loading}
                        variant="detailed"
                        showTrophies={true}
                        showProfilePicture={true}
                        profilePictureField="profile_picture"
                        showLevelBadge={true}
                        showMGA={true}
                        hierarchyLevel="all"
                        formatMovementIndicator={formatMovementIndicator}
                        formatAchievementBadge={formatAchievementBadge}
                        achievementColors={achievementColors}
                        className="main-leaderboard"
                        currentUser={user}
                        showScrollButtons={true}
                    />
                </div>
                )}
                
                {/* Other leaderboards - 2 per row */}
                {isMORE ? (
                    // For MORE, show both MGA and RGA leaderboards with responsive layout
                    <div className="more-leaderboard-container">
                        <Leaderboard
                            data={leaderboardData.mga.data}
                            title="Top MGAs - M.O.R.E. Hires"
                            nameField="name"
                            valueField="value"
                            allowedNames={allowedNames}
                            allowedIds={allowedIds}
                            rawNameField={'name'}
                            formatValue={(value) => `${value || 0} hires`}
                            loading={leaderboardData.mga.loading}
                            variant="detailed"
                            showProfilePicture={true}
                            profilePictureField="profile_picture"
                            showLevelBadge={true}
                            showMGA={true}
                            hierarchyLevel="mga"
                            formatMovementIndicator={formatMovementIndicator}
                            formatAchievementBadge={formatAchievementBadge}
                            achievementColors={achievementColors}
                            currentUser={user}
                            showScrollButtons={true}
                        />
                        <Leaderboard
                            data={leaderboardData.rga.data}
                            title="Top RGAs - M.O.R.E. Hires"
                            nameField="name"
                            valueField="value"
                            allowedNames={allowedNames}
                            allowedIds={allowedIds}
                            rawNameField={'name'}
                            formatValue={(value) => `${value || 0} hires`}
                            loading={leaderboardData.rga.loading}
                            variant="detailed"
                            showProfilePicture={true}
                            profilePictureField="profile_picture"
                            showLevelBadge={true}
                            showMGA={true}
                            hierarchyLevel="rga"
                            formatMovementIndicator={formatMovementIndicator}
                            formatAchievementBadge={formatAchievementBadge}
                            achievementColors={achievementColors}
                            currentUser={user}
                            showScrollButtons={true}
                        />
                    </div>
                ) : (
                    // For other data sources, show all hierarchy levels
                    <>
                <div className="leaderboard-row">
                    <Leaderboard
                        data={leaderboardData.sa.data}
                        title={
                            isDailyActivity 
                                ? `Top SAs - ${formatMetricName(dailyActivityMetric)}` 
                                : isCodes 
                                    ? "Top SAs - Codes"
                                    : isVIPs
                                        ? "Top SAs - VIPs"
                                        : isRefSales
                                            ? "Top SAs - Ref Sales"
                                            : "Top SAs"
                        }
                        nameField="name"
                        valueField="value"
                        allowedNames={allowedNames}
                        allowedIds={allowedIds}
                        rawNameField={'name'}
                        formatValue={
                            isDailyActivity 
                                ? formatDailyActivityValue 
                                : isCodes 
                                    ? (value) => new Intl.NumberFormat('en-US').format(value || 0)
                                    : isVIPs
                                        ? (value) => new Intl.NumberFormat('en-US').format(value || 0)
                                        : isRefSales
                                            ? (value) => new Intl.NumberFormat('en-US').format(value || 0)
                                            : isMORE
                                                ? (value) => `${value || 0} hires`
                                                : formatValue
                        }
                        loading={leaderboardData.sa.loading}
                        variant="detailed"
                        showProfilePicture={true}
                        profilePictureField="profile_picture"
                        showLevelBadge={true}
                        showMGA={true}
                        hierarchyLevel="sa"
                        formatMovementIndicator={formatMovementIndicator}
                        formatAchievementBadge={formatAchievementBadge}
                        achievementColors={achievementColors}
                        currentUser={user}
                        showScrollButtons={true}
                    />
                    <Leaderboard
                        data={leaderboardData.ga.data}
                        title={
                            isDailyActivity 
                                ? `Top GAs - ${formatMetricName(dailyActivityMetric)}` 
                                : isCodes 
                                    ? "Top GAs - Codes"
                                    : isVIPs
                                        ? "Top GAs - VIPs"
                                        : isRefSales
                                            ? "Top GAs - Ref Sales"
                                            : isMORE
                                                ? "Top GAs - M.O.R.E. Hires"
                                                : "Top GAs"
                        }
                        nameField="name"
                        valueField="value"
                        allowedNames={allowedNames}
                        allowedIds={allowedIds}
                        rawNameField={'name'}
                        formatValue={
                            isDailyActivity 
                                ? formatDailyActivityValue 
                                : isCodes 
                                    ? (value) => new Intl.NumberFormat('en-US').format(value || 0)
                                    : isVIPs
                                        ? (value) => new Intl.NumberFormat('en-US').format(value || 0)
                                        : isRefSales
                                            ? (value) => new Intl.NumberFormat('en-US').format(value || 0)
                                            : isMORE
                                                ? (value) => `${value || 0} hires`
                                                : formatValue
                        }
                        loading={leaderboardData.ga.loading}
                        variant="detailed"
                        showProfilePicture={true}
                        profilePictureField="profile_picture"
                        showLevelBadge={true}
                        showMGA={true}
                        hierarchyLevel="ga"
                        formatMovementIndicator={formatMovementIndicator}
                        formatAchievementBadge={formatAchievementBadge}
                        achievementColors={achievementColors}
                        currentUser={user}
                        showScrollButtons={true}
                    />
                </div>
                
                <div className="leaderboard-row">
                    <Leaderboard
                        data={leaderboardData.mga.data}
                        title={
                            isDailyActivity 
                                ? `Top MGAs - ${formatMetricName(dailyActivityMetric)}` 
                                : isCodes 
                                    ? "Top MGAs - Codes"
                                    : isVIPs
                                        ? "Top MGAs - VIPs"
                                        : isRefSales
                                            ? "Top MGAs - Ref Sales"
                                            : isMORE
                                                ? "Top MGAs - M.O.R.E. Hires"
                                                : "Top MGAs"
                        }
                        nameField="name"
                        valueField="value"
                        allowedNames={allowedNames}
                        allowedIds={allowedIds}
                        rawNameField={'name'}
                        formatValue={
                            isDailyActivity 
                                ? formatDailyActivityValue 
                                : isCodes 
                                    ? (value) => new Intl.NumberFormat('en-US').format(value || 0)
                                    : isVIPs
                                        ? (value) => new Intl.NumberFormat('en-US').format(value || 0)
                                        : isRefSales
                                            ? (value) => new Intl.NumberFormat('en-US').format(value || 0)
                                            : isMORE
                                                ? (value) => `${value || 0} hires`
                                                : formatValue
                        }
                        loading={leaderboardData.mga.loading}
                        variant="detailed"
                        showProfilePicture={true}
                        profilePictureField="profile_picture"
                        showLevelBadge={true}
                        showMGA={true}
                        hierarchyLevel="mga"
                        formatMovementIndicator={formatMovementIndicator}
                        formatAchievementBadge={formatAchievementBadge}
                        achievementColors={achievementColors}
                        currentUser={user}
                        showScrollButtons={true}
                    />
                    {/* Only show RGA leaderboard when not in Daily Activity, Codes, VIPs, Ref Sales, or MORE mode */}
                    {!isDailyActivity && !isCodes && !isVIPs && !isRefSales && !isMORE && (
                    <Leaderboard
                        data={leaderboardData.rga.data}
                        title="Top RGAs"
                        nameField="name"
                        valueField="value"
                        allowedNames={allowedNames}
                        allowedIds={allowedIds}
                        rawNameField={'name'}
                        formatValue={formatValue}
                        loading={leaderboardData.rga.loading}
                        variant="detailed"
                        showProfilePicture={true}
                        profilePictureField="profile_picture"
                        showLevelBadge={true}
                        showMGA={true}
                        hierarchyLevel="rga"
                        formatMovementIndicator={formatMovementIndicator}
                        formatAchievementBadge={formatAchievementBadge}
                        achievementColors={achievementColors}
                        currentUser={user}
                        showScrollButtons={true}
                    />
                    )}
                </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default LeaderboardPage; 