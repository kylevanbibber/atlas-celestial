import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { FiFilter } from 'react-icons/fi';
import Leaderboard from '../components/utils/Leaderboard';
import FilterMenu from '../components/common/FilterMenu';
import api from '../api';
import './LeaderboardPage.css';

/**
 * LeaderboardPage Component
 * 
 * Features:
 * - Real-time leaderboard data with filtering (Experience, Report Type, F6/Net/Gross, Date, MGA/RGA/Tree)
 * - Rank change tracking: Shows movement indicators (▲ Up, ▼ Down, 🆕 New, ➖ Same)
 * - Achievement system: Detects and displays achievement badges for special accomplishments:
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
    console.log('[combineYTDWithDecember] Starting combination process');
    console.log('[combineYTDWithDecember] YTD data count:', ytdData.length);
    console.log('[combineYTDWithDecember] December data count:', decemberData.length);
    
    // Create a map of December data by LagnName for quick lookup
    const decemberMap = new Map();
    decemberData.forEach(item => {
        const key = item.LagnName;
        decemberMap.set(key, item);
        console.log(`[combineYTDWithDecember] December entry for ${key}:`, {
            LVL_1_NET: item.LVL_1_NET,
            LVL_1_NET_parsed: parseAlpValue(item.LVL_1_NET),
            LVL_1_GROSS: item.LVL_1_GROSS,
            LVL_1_GROSS_parsed: parseAlpValue(item.LVL_1_GROSS),
            month: item.month
        });
    });
    
    // Process YTD data and add December values where available
    const combinedData = ytdData.map(ytdItem => {
        const decemberItem = decemberMap.get(ytdItem.LagnName);
        
        if (decemberItem) {
            // Convert Monthly_ALP VARCHAR values to numbers before adding
            const ytdLvl1Net = parseAlpValue(ytdItem.LVL_1_NET);
            const decLvl1Net = parseAlpValue(decemberItem.LVL_1_NET);
            const combinedLvl1Net = ytdLvl1Net + decLvl1Net;
            
            console.log(`[combineYTDWithDecember] Combining ${ytdItem.LagnName}:`, {
                ytd_LVL_1_NET: ytdItem.LVL_1_NET,
                ytd_LVL_1_NET_parsed: ytdLvl1Net,
                dec_LVL_1_NET: decemberItem.LVL_1_NET,
                dec_LVL_1_NET_parsed: decLvl1Net,
                combined_LVL_1_NET: combinedLvl1Net
            });
            
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
            console.log(`[combineYTDWithDecember] Adding December-only entry for ${decemberItem.LagnName}`);
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
    
    console.log('[combineYTDWithDecember] Final combined data count:', combinedData.length);
    return combinedData;
};

const LeaderboardPage = () => {
    const [isF6, setIsF6] = useState(false);
    const [experienceFilter, setExperienceFilter] = useState('all');
    const [netOrGross, setNetOrGross] = useState('net');
    const [reportType, setReportType] = useState('Weekly Recap');
    const [includePrevDecember, setIncludePrevDecember] = useState(false);
    const [loading, setLoading] = useState(false);
    
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

    // Check if selected date is a month header (format: MM/YYYY)
    const isMonthSelection = (date) => {
        return /^\d{2}\/\d{4}$/.test(date);
    };

    // Fetch leaderboard data with achievements and rank tracking
    const fetchLeaderboardData = async (endpoint, key) => {
        let filters = {};
        
        // Determine if we should use Monthly_ALP or Weekly_ALP
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
                        
                        console.log(`[LeaderboardPage] Fetching December data for: ${previousDecember}`);
                        
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
                            console.log(`[LeaderboardPage] December data found: ${decemberResponse.data.data.length} records`);
                            // Combine current YTD data with previous December data
                            currentData = combineYTDWithDecember(currentData, decemberResponse.data.data);
                            console.log(`[LeaderboardPage] Combined data: ${currentData.length} records`);
                        } else {
                            console.log(`[LeaderboardPage] No December data found for ${previousDecember}`);
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
        if (selectedDate && reportDates.length > 0) {
            fetchLeaderboardData('getweeklyall', 'all');
            fetchLeaderboardData('getweeklysa', 'sa');
            fetchLeaderboardData('getweeklyga', 'ga');
            fetchLeaderboardData('getweeklymga', 'mga');
            fetchLeaderboardData('getweeklyrga', 'rga');
        }
    }, [selectedDate, reportType, selectedMGA, selectedRGA, selectedTree, isF6, netOrGross, experienceFilter, reportDates, includePrevDecember]);

    // Initialize data and refetch when reportType changes
    useEffect(() => {
        fetchReportDates();
        fetchUniqueMGAOptions();
        
        // Reset December toggle when switching away from YTD
        if (reportType !== 'YTD Recap') {
            setIncludePrevDecember(false);
        }
    }, [reportType]);

    // Reset all filters
    const resetAllFilters = () => {
        setSelectedMGA(null);
        setSelectedRGA(null);
        setSelectedTree(null);
    };

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
            {/* Filter Controls */}
            <div className="leaderboard-filters">
                <div className="leaderboard-filters-left">
                    {/* Experience Filter */}
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

                    {/* Report Type Filter */}
                    <div className="tabs-filter-container">
                        <span 
                            className={reportType === 'Weekly Recap' ? 'selected' : 'unselected'} 
                            onClick={() => setReportType('Weekly Recap')}
                        >
                            Week
                        </span>
                        <span className="separator">|</span>
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

                    {/* YTD December Toggle - Only show when YTD is selected */}
                    {reportType === 'YTD Recap' && (
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

                <div className="leaderboard-filters-right">
                    {/* Toggle Controls */}
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
                    {reportDates.map((dateItem, index) => {
                        // Handle grouped format (MTD)
                        if (typeof dateItem === 'object' && dateItem.type) {
                            if (dateItem.isHeader) {
                                return (
                                    <option 
                                        key={`header-${index}`} 
                                        value={dateItem.value}
                                        style={{ 
                                            fontWeight: 'bold', 
                                            backgroundColor: '#f0f0f0',
                                            fontSize: '14px'
                                        }}
                                    >
                                        {dateItem.label}
                                    </option>
                                );
                            } else {
                                return (
                                    <option 
                                        key={`date-${index}`} 
                                        value={dateItem.value}
                                        style={{ paddingLeft: '20px' }}
                                    >
                                        &#8195;{dateItem.label}
                                    </option>
                                );
                            }
                        } else {
                            // Handle regular format (Weekly/YTD)
                            const date = typeof dateItem === 'string' ? dateItem : dateItem.value;
                            return (
                                <option key={date} value={date}>
                                    {formatToMMDDYYYY(date)}
                                </option>
                            );
                        }
                    })}
                </select>
                <button className="arrow-change-button" onClick={handlePreviousDate}>&gt;</button>
            </div>



            {/* Leaderboards */}
            <div className="leaderboards-container">
                {/* Top Producers - spans full width */}
                <div className="leaderboard-main-row">
                    <Leaderboard
                        data={leaderboardData.all.data}
                        title="Top Producers"
                        nameField="name"
                        valueField="value"
                        formatValue={formatValue}
                        loading={leaderboardData.all.loading}
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
                    />
                </div>
                
                {/* Other leaderboards - 2 per row */}
                <div className="leaderboard-row">
                    <Leaderboard
                        data={leaderboardData.sa.data}
                        title="Top SAs"
                        nameField="name"
                        valueField="value"
                        formatValue={formatValue}
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
                    />
                    <Leaderboard
                        data={leaderboardData.ga.data}
                        title="Top GAs"
                        nameField="name"
                        valueField="value"
                        formatValue={formatValue}
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
                    />
                </div>
                
                <div className="leaderboard-row">
                    <Leaderboard
                        data={leaderboardData.mga.data}
                        title="Top MGAs"
                        nameField="name"
                        valueField="value"
                        formatValue={formatValue}
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
                    />
                    <Leaderboard
                        data={leaderboardData.rga.data}
                        title="Top RGAs"
                        nameField="name"
                        valueField="value"
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
                    />
                </div>
            </div>
        </div>
    );
};

export default LeaderboardPage; 