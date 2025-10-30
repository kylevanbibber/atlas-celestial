import React, { useState, useEffect, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle, faMedal, faChevronRight, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { AuthContext } from '../../context/AuthContext';
import ThemeContext from '../../context/ThemeContext';
import api from '../../api';
import Card from '../utils/Card';
import './TrophyCase.css';

// Medal images for modal
import bronzeMedalImage from '../../img/bronzecoin.png';
import silverMedalImage from '../../img/silvercoin.png';
import goldMedalImage from '../../img/goldcoin.png';
import platinumMedalImage from '../../img/platinumcoin.png';
import diamondMedalImage from '../../img/diamondcoin.png';

// Background images for cards
import calendarImage from '../../img/calendar.png';
import trophyImage from '../../img/trophy.png';
import bronzeImage from '../../img/bronze.png';
import silverImage from '../../img/silver.png';
import goldImage from '../../img/gold.png';
import platinumImage from '../../img/platinum.png';
import diamondImage from '../../img/diamond.png';

const TrophyCase = ({ view, trophyView = 'personal' }) => {
    const { user } = useContext(AuthContext);
    const { theme } = useContext(ThemeContext);
    const [trophyCaseData, setTrophyCaseData] = useState([]);
    const [allTrophyData, setAllTrophyData] = useState([]);
    const [recordWeekData, setRecordWeekData] = useState(null);
    const [wallOfFameData, setWallOfFameData] = useState([]);
    const [userMonthlyRaw, setUserMonthlyRaw] = useState([]);
    const [userWeeklyRaw, setUserWeeklyRaw] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [expandedClubs, setExpandedClubs] = useState({
        Bronze: true,
        Silver: true,
        Gold: true,
        Platinum: true,
        Diamond: true,
        WallOfFame: true
    });

    useEffect(() => {
        if (user) {
            fetchTrophyCaseData();
        }
    }, [user, trophyView]);

    // Normalize current user's agent name across varying shapes/cases
    const getCurrentUserLagnName = () => {
        try {
            return (user && (user.LagnName || user.lagnname)) || null;
        } catch {
            return null;
        }
    };

    // Helper function to get the net value field based on current view
    const getNetValueField = () => {
        return trophyView === 'personal' ? 'LVL_1_NET' : 'LVL_2_NET';
    };

    // Helper function to get the calculated net value based on current view
    const getNetValue = (row) => {
        if (trophyView === 'personal') {
            return parseFloat(String(row.LVL_1_NET || 0).replace(/[\$,()]/g, '').trim());
        } else {
            // For team view, use whichever is higher between LVL_2_NET and LVL_3_NET
            const lvl2 = parseFloat(String(row.LVL_2_NET || 0).replace(/[\$,()]/g, '').trim());
            const lvl3 = parseFloat(String(row.LVL_3_NET || 0).replace(/[\$,()]/g, '').trim());
            
            const maxValue = Math.max(lvl2, lvl3);
            // Handle case where both values are NaN
            return isNaN(maxValue) ? 0 : maxValue;
        }
    };

    // Determine contract type for a given row (team context)
    // Rules:
    // - SA when LVL_2_NET produced the selected net value
    // - If LVL_3 selected: GA when MGA_NAME is not blank; otherwise decide MGA/RGA using CL_Name among duplicate rows for same name+period
    const classifyContract = (row, samePeriodRows = []) => {
        if (trophyView === 'personal') return null;

        const parseMoney = (v) => parseFloat(String(v || 0).replace(/[\$,()]/g, '').trim());
        const selectedNet = typeof row.calculatedNetValue === 'number' ? row.calculatedNetValue : getNetValue(row);

        const keyMonth = row.month || null;
        const keyDate = row.reportdate || null;
        const keyName = row.LagnName;
        const candidates = (samePeriodRows || []).filter(r => r.LagnName === keyName && (r.month === keyMonth || r.reportdate === keyDate));

        // Identify which raw row produced the selected value
        const matched = candidates.find(r => {
            const l2 = parseMoney(r.LVL_2_NET);
            const l3 = parseMoney(r.LVL_3_NET);
            const mx = Math.max(l2, l3);
            return Math.abs(mx - selectedNet) < 0.01;
        });

        const source = matched || row;
        const l2 = parseMoney(source.LVL_2_NET);
        const l3 = parseMoney(source.LVL_3_NET);

        // Store classification reason for logging
        let classificationReason = '';

        if (!isNaN(l2) && l2 >= (l3 || 0)) {
            classificationReason = `LVL_2_NET (${formatCurrency(l2)}) >= LVL_3_NET (${formatCurrency(l3 || 0)})`;
            row.classificationReason = classificationReason;
            return 'SA';
        }

        // LVL_3 chosen → determine GA/MGA/RGA by producing row
        const mName = (source.MGA_NAME || '').trim();
        const clName = (source.CL_Name || '').trim();
        
        if (mName) {
            classificationReason = `LVL_3_NET selected, MGA_NAME="${mName}" (not blank)`;
            row.classificationReason = classificationReason;
            return 'GA';
        }

        const dupCount = candidates.length;
        if (dupCount >= 2) {
            // Check if there's an MGA candidate among the duplicates
            const mgaCandidate = candidates.find(r => (r.CL_Name || '').toUpperCase().includes('MGA'));
            
            if (mgaCandidate) {
                // There's a dedicated MGA row, so we can distinguish MGA vs RGA
                if ((source.CL_Name || '').toUpperCase().includes('MGA')) {
                    classificationReason = `LVL_3_NET selected, ${dupCount} duplicates found, CL_Name="${clName}" contains MGA`;
                    row.classificationReason = classificationReason;
                    return 'MGA';
                } else if (clName === '') {
                    classificationReason = `LVL_3_NET selected, ${dupCount} duplicates found, CL_Name is blank while another row has MGA in CL_Name`;
                    row.classificationReason = classificationReason;
                    return 'RGA';
                }
            }
            
            // If no clear MGA candidate, default to MGA for blank CL_Name
            classificationReason = `LVL_3_NET selected, ${dupCount} duplicates found, no clear MGA/RGA distinction, defaulting to MGA`;
            row.classificationReason = classificationReason;
            return 'MGA';
        }

        // No duplicates: treat MGA_NAME blank as MGA role
        classificationReason = `LVL_3_NET selected, MGA_NAME blank, single row for period, defaulting to MGA`;
        row.classificationReason = classificationReason;
        return 'MGA';
    };

    // Helper function to deduplicate entries by month, keeping the highest Net ALP value
    const deduplicateByMonth = (data) => {
        const monthlyMap = new Map();
        let duplicatesFound = 0;
        
        data.forEach(entry => {
            const monthKey = entry.month; // Using the month field as the unique key
            const netValue = getNetValue(entry);
            

            
            if (!monthlyMap.has(monthKey)) {
                monthlyMap.set(monthKey, { ...entry, netValue });
            } else {
                duplicatesFound++;
                const existing = monthlyMap.get(monthKey);
                if (netValue > existing.netValue) {
                    console.log(`Duplicate found for ${monthKey}: Replacing ${formatCurrency(existing.netValue)} (${existing.LagnName}) with higher value ${formatCurrency(netValue)} (${entry.LagnName})`);
                    monthlyMap.set(monthKey, { ...entry, netValue });
                } else {
                    console.log(`Duplicate found for ${monthKey}: Keeping existing ${formatCurrency(existing.netValue)} (${existing.LagnName}) over lower value ${formatCurrency(netValue)} (${entry.LagnName})`);
                }
            }
        });
        
        if (duplicatesFound > 0) {
            console.log(`Deduplication complete: Removed ${duplicatesFound} duplicate entries, ${monthlyMap.size} unique months remaining`);
        }
        
        // Return the deduplicated entries WITH the netValue field for further processing
        return Array.from(monthlyMap.values());
    };

    // Helper function to deduplicate entries by month + LagnName (used for ALL users dataset)
    const deduplicateByMonthAll = (data) => {
        const monthlyMap = new Map();
        let duplicatesFound = 0;

        data.forEach(entry => {
            const key = `${entry.month}|${entry.LagnName}`; // Per-user per-month key
            const netValue = getNetValue(entry);

            if (!monthlyMap.has(key)) {
                monthlyMap.set(key, { ...entry, netValue });
            } else {
                duplicatesFound++;
                const existing = monthlyMap.get(key);
                if (netValue > existing.netValue) {
                    console.log(`Per-user duplicate for ${key}: Replacing ${formatCurrency(existing.netValue)} with ${formatCurrency(netValue)}`);
                    monthlyMap.set(key, { ...entry, netValue });
                }
            }
        });

        if (duplicatesFound > 0) {
            console.log(`All-users dedup complete: Removed ${duplicatesFound} duplicate entries (per user/month), ${monthlyMap.size} unique items remaining`);
        }

        return Array.from(monthlyMap.values()).map(({ netValue, ...entry }) => entry);
    };

    // Helper function to deduplicate weekly entries by reportdate, keeping the highest Net ALP value
    const deduplicateByWeek = (data) => {
        const weeklyMap = new Map();
        let duplicatesFound = 0;
        
        data.forEach(entry => {
            const dateKey = entry.reportdate; // Using the reportdate field as the unique key
            const netValue = getNetValue(entry);
            
            if (!weeklyMap.has(dateKey)) {
                weeklyMap.set(dateKey, { ...entry, netValue });
            } else {
                duplicatesFound++;
                const existing = weeklyMap.get(dateKey);
                if (netValue > existing.netValue) {
                    console.log(`Weekly duplicate found for ${dateKey}: Replacing ${formatCurrency(existing.netValue)} with higher value ${formatCurrency(netValue)}`);
                    weeklyMap.set(dateKey, { ...entry, netValue });
                } else {
                    console.log(`Weekly duplicate found for ${dateKey}: Keeping existing ${formatCurrency(existing.netValue)} over lower value ${formatCurrency(netValue)}`);
                }
            }
        });
        
        if (duplicatesFound > 0) {
            console.log(`Weekly deduplication complete: Removed ${duplicatesFound} duplicate entries, ${weeklyMap.size} unique weeks remaining`);
        }
        
        // Return the deduplicated entries without the temporary netValue field
        return Array.from(weeklyMap.values()).map(({ netValue, ...entry }) => entry);
    };

    // Helper function to sort trophy data by month/year (newest to oldest)
    const sortByDateDescending = (data) => {
        return data.sort((a, b) => {
            // Parse month strings like "March 2024" into Date objects for comparison
            const parseMonth = (monthStr) => {
                try {
                    const date = new Date(monthStr + ' 01'); // Add day to make it a valid date
                    return date.getTime(); // Return timestamp for comparison
                } catch (error) {
                    console.warn(`Could not parse month: ${monthStr}`, error);
                    return 0; // Fallback for invalid dates
                }
            };
            
            const dateA = parseMonth(a.month);
            const dateB = parseMonth(b.month);
            
            // Sort in descending order (newest first)
            return dateB - dateA;
        });
    };

    // Helper function to sort weekly data by reportdate (newest to oldest)
    const sortWeeklyByDateDescending = (data) => {
        return data.sort((a, b) => {
            const dateA = new Date(a.reportdate).getTime();
            const dateB = new Date(b.reportdate).getTime();
            
            // Sort in descending order (newest first)
            return dateB - dateA;
        });
    };

    // Helper function to get background image for each card type
    const getBackgroundImage = (cardType) => {
        switch(cardType) {
            case 'Bronze':
                return bronzeImage;
            case 'Silver':
                return silverImage;
            case 'Gold':
                return goldImage;
            case 'Platinum':
                return platinumImage;
            case 'Diamond':
                return diamondImage;
            case 'RecordMonth':
                return trophyImage;
            case 'RecordWeek':
                return calendarImage;
            default:
                return null;
        }
    };

    const fetchTrophyCaseData = async () => {
        try {
            setLoading(true);
            
            // Fetch individual agent's trophy data (now uses authenticated user context)
            const trophyResponse = await api.get('/trophy/trophy-case');
            
            if (trophyResponse.data.success && trophyResponse.data.data.length > 0) {
                // Store RAW data with duplicates intact - deduplication will happen in categorizeData
                // Sort by date (newest to oldest) for proper display order
                const sortedData = sortByDateDescending(trophyResponse.data.data);
                console.log(`Trophy data sorted: ${sortedData.length} entries (RAW with duplicates), newest: ${sortedData[0]?.month}, oldest: ${sortedData[sortedData.length-1]?.month}`);
                setTrophyCaseData(sortedData);
                // Save raw user monthly for classification reference
                const currentName = getCurrentUserLagnName();
                const rawUserMonthly = currentName ? trophyResponse.data.data.filter(r => r.LagnName === currentName) : trophyResponse.data.data;
                setUserMonthlyRaw(rawUserMonthly);
            } else {
                console.log(`No trophy data found for authenticated user`);
            }

            // Fetch all trophy data for rankings
            const allTrophyResponse = await api.get('/trophy/all-trophy-case');
            if (allTrophyResponse.data.success) {
                // Also deduplicate the all trophy data for accurate rankings
                const deduplicatedAllData = deduplicateByMonthAll(allTrophyResponse.data.data);
                
                // Sort the all trophy data by date as well for consistent processing
                const sortedAllData = sortByDateDescending(deduplicatedAllData);
                setAllTrophyData(sortedAllData);
            }

            // Fetch weekly trophy data (now uses authenticated user context)
            const weeklyResponse = await api.get('/trophy/weekly-trophy-case');
            
            if (weeklyResponse.data.success && weeklyResponse.data.data.length > 0) {
                // Deduplicate weekly data before finding the highest week
                const deduplicatedWeeklyData = deduplicateByWeek(weeklyResponse.data.data);
                
                // Sort weekly data by date (newest to oldest)
                const sortedWeeklyData = sortWeeklyByDateDescending(deduplicatedWeeklyData);
                // Save raw user weekly for classification reference
                const rawWeeklyName = getCurrentUserLagnName();
                const rawUserWeekly = rawWeeklyName ? weeklyResponse.data.data.filter(r => r.LagnName === rawWeeklyName) : weeklyResponse.data.data;
                setUserWeeklyRaw(rawUserWeekly);
                
                // Filter to only include records for the current logged-in user
                const currentWeeklyName = getCurrentUserLagnName();
                const userWeeklyData = currentWeeklyName ? sortedWeeklyData.filter(row => row.LagnName === currentWeeklyName) : sortedWeeklyData;

                console.log(`📊 Weekly data for ${currentWeeklyName || 'unknown'} (${trophyView} view): ${userWeeklyData.length} records found`);
                
                // Filter out records that don't have valid net values for the current view
                const validWeeklyData = userWeeklyData.filter(row => {
                    const netValue = getNetValue(row);
                    const isValid = !isNaN(netValue) && netValue > 0;
                    
                    if (trophyView === 'team') {
                        console.log(`🔍 ${currentWeeklyName || 'unknown'} Weekly - Date: ${row.reportdate}, LVL_2_NET: ${row.LVL_2_NET}, LVL_3_NET: ${row.LVL_3_NET}, Calculated: ${netValue}, Valid: ${isValid}`);
                    }
                    
                    return isValid;
                });
                
                if (validWeeklyData.length > 0) {
                    const highestWeek = validWeeklyData.reduce((max, row) => {
                        const maxValue = getNetValue(max);
                        const currentValue = getNetValue(row);
                    return currentValue > maxValue ? row : max;
                    }, validWeeklyData[0]);
                    setRecordWeekData({ ...highestWeek, calculatedNetValue: getNetValue(highestWeek) });
                } else {
                    setRecordWeekData(null);
                }
            }

            // Fetch Wall of Fame data (weeks with $8,000+ net ALP)
            const wallOfFameResponse = await api.get('/trophy/wall-of-fame');
            
            if (wallOfFameResponse.data.success && wallOfFameResponse.data.data.length > 0) {
                // Deduplicate Wall of Fame entries by week (reportdate), keeping highest Net ALP value
                const deduplicatedWallOfFame = deduplicateByWeek(wallOfFameResponse.data.data);
                
                // Filter to only include records for the current logged-in user
                const wofName = getCurrentUserLagnName();
                const userWallOfFameData = wofName ? deduplicatedWallOfFame.filter(row => row.LagnName === wofName) : deduplicatedWallOfFame;

                console.log(`📊 Wall of Fame data for ${wofName || 'unknown'} (${trophyView} view): ${userWallOfFameData.length} records found`);
                
                // Filter out records that don't have valid net values for the current view
                const validWallOfFameData = userWallOfFameData.filter(row => {
                    const netValue = getNetValue(row);
                    const isValid = !isNaN(netValue) && netValue >= 8000; // Wall of Fame threshold
                    
                    if (trophyView === 'team') {
                        console.log(`🔍 ${wofName || 'unknown'} Wall of Fame - Date: ${row.reportdate}, LVL_2_NET: ${row.LVL_2_NET}, LVL_3_NET: ${row.LVL_3_NET}, Calculated: ${netValue}, Valid: ${isValid}`);
                    }
                    
                    return isValid;
                });
                
                // Sort Wall of Fame data by date (newest to oldest) for proper display order
                const sortedWallOfFameData = sortWeeklyByDateDescending(validWallOfFameData);
                setWallOfFameData(sortedWallOfFameData.map(row => ({ 
                    ...row, 
                    calculatedNetValue: getNetValue(row) 
                })));
            }

        } catch (error) {
            console.error('Error fetching trophy case data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        const numericValue = parseFloat(String(value).replace(/[\$,()]/g, '').trim());
        return numericValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    const formatDateRange = (reportdate) => {
        const date = new Date(reportdate);
        const dayOfWeek = date.getDay();
        const lastSunday = new Date(date);
        lastSunday.setDate(date.getDate() - dayOfWeek);
        const previousMonday = new Date(lastSunday);
        previousMonday.setDate(lastSunday.getDate() - 6);
    
        const options = { month: 'numeric', day: 'numeric', year: '2-digit' };
        return `${previousMonday.toLocaleDateString('en-US', options)} - ${lastSunday.toLocaleDateString('en-US', options)}`;
    };

    const getTimeSince = (dateString, isWeekly = false) => {
        if (!dateString) return 'N/A';
        
        let targetDate;
        try {
            if (isWeekly) {
                // For weekly data in format "mm/dd/yy - mm/dd/yy", use the end date (second date)
                if (dateString.includes(' - ')) {
                    const endDateStr = dateString.split(' - ')[1].trim();
                    // Parse mm/dd/yy format - need to handle 2-digit year
                    const [month, day, year] = endDateStr.split('/');
                    const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
                    targetDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
                } else {
                    targetDate = new Date(dateString);
                }
            } else {
                // For monthly data in "mm/yyyy" format
                if (dateString.includes('/')) {
                    const [month, year] = dateString.split('/');
                    targetDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                } else {
                    // Fallback for other formats
                    targetDate = new Date(dateString + ' 01');
                }
            }
            
            // Check if date is valid
            if (isNaN(targetDate.getTime())) {
                console.warn(`Invalid date parsed from: ${dateString}`);
                return 'N/A';
            }
        } catch (error) {
            console.error(`Error parsing date: ${dateString}`, error);
            return 'N/A';
        }
        
        const currentDate = new Date();
        const diffTime = currentDate - targetDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return 'Recent';
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return '1 day ago';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
        }
        
        // More precise calculation for months and years
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth();
        
        let yearsDiff = currentYear - targetYear;
        let monthsDiff = currentMonth - targetMonth;
        
        // Adjust if current day is before target day in the month
        if (currentDate.getDate() < targetDate.getDate()) {
            monthsDiff--;
        }
        
        // Adjust months and years
        if (monthsDiff < 0) {
            monthsDiff += 12;
            yearsDiff--;
        }
        
        // Calculate total months for comparison
        const totalMonths = yearsDiff * 12 + monthsDiff;
        
        if (totalMonths < 12) {
            return monthsDiff === 1 ? '1 month ago' : `${monthsDiff} months ago`;
        } else if (yearsDiff === 1 && monthsDiff === 0) {
            return '1 year ago';
        } else if (monthsDiff === 0) {
            return `${yearsDiff} years ago`;
        } else {
            return `${yearsDiff}y ${monthsDiff}m ago`;
        }
    };

    const getMostRecentClubEntry = (categorizedData) => {
        let mostRecentEntry = null;
        let mostRecentDate = null;
        
        // Check all club categories (excluding Record Month)
        const clubCategories = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
        
        clubCategories.forEach(club => {
            if (categorizedData[club] && categorizedData[club].length > 0) {
                // Since data is already sorted by date (newest first), take the first entry
                const entry = categorizedData[club][0];
                
                // Make sure this entry has a valid net value for the current view
                const netValue = getNetValue(entry);
                if (isNaN(netValue) || netValue <= 0) {
                    return; // Skip this entry
                }
                
                try {
                    // Parse the month string (should be in format like "March 2024" or "10/2022")
                    let entryDate;
                    if (entry.month.includes('/')) {
                        // Handle mm/yyyy format
                        const [month, year] = entry.month.split('/');
                        entryDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                    } else {
                        // Handle "March 2024" format
                        entryDate = new Date(entry.month + ' 01');
                    }
                    
                    if (!isNaN(entryDate.getTime()) && (!mostRecentDate || entryDate > mostRecentDate)) {
                        mostRecentDate = entryDate;
                        mostRecentEntry = { ...entry, clubName: club, calculatedNetValue: netValue };
                    }
                } catch (error) {
                    console.warn(`Error parsing club entry date: ${entry.month}`, error);
                }
            }
        });
        
        return mostRecentEntry;
    };
    
    const getClubName = (value) => {
        const numericValue = parseFloat(String(value).replace(/[\$,()]/g, '').trim());
        
        if (trophyView === 'team') {
            // Team view thresholds (higher values for team achievements)
            if (numericValue >= 200000) return 'Diamond';
            if (numericValue >= 100000) return 'Platinum';
            if (numericValue >= 50000) return 'Gold';
            if (numericValue >= 35000) return 'Silver';
            if (numericValue >= 25000) return 'Bronze';
        } else {
            // Personal view thresholds (original)
        if (numericValue >= 100000) return 'Diamond';
        if (numericValue >= 50000) return 'Platinum';
        if (numericValue >= 25000) return 'Gold';
        if (numericValue >= 20000) return 'Silver';
        if (numericValue >= 15000) return 'Bronze';
        }
        return 'Record Month';
    };

    const categorizeData = (data) => {
        const categories = {
            'Record Month': [],
            'Bronze': [],
            'Silver': [],
            'Gold': [],
            'Platinum': [],
            'Diamond': []
        };

        if (data.length === 0) return categories;

        // Filter to only include records for the current logged-in user
        const currentName = getCurrentUserLagnName();
        const userSpecificData = currentName ? data.filter(row => row.LagnName === currentName) : data;

        console.log(`📊 Trophy data for ${currentName || 'unknown'} (${trophyView} view): ${userSpecificData.length} records found`);
        
        if (userSpecificData.length > 0) {
            console.log(`📋 Sample raw data:`, userSpecificData.slice(0, 3));
            
            // Check for duplicates in raw data
            const monthCounts = {};
            userSpecificData.forEach(row => {
                const month = row.month;
                if (!monthCounts[month]) monthCounts[month] = [];
                monthCounts[month].push({
                    month: month,
                    LVL_3_NET: row.LVL_3_NET,
                    CL_Name: row.CL_Name,
                    MGA_NAME: row.MGA_NAME
                });
            });
            
            // Show months with duplicates
            const duplicateMonths = Object.keys(monthCounts).filter(month => monthCounts[month].length > 1);
            if (duplicateMonths.length > 0) {
                console.log(`🔍 Found ${duplicateMonths.length} months with duplicates:`, duplicateMonths.slice(0, 5));
                duplicateMonths.slice(0, 2).forEach(month => {
                    console.log(`📅 ${month} entries:`, monthCounts[month]);
                });
            } else {
                console.log(`⚠️ No duplicate months found in raw data! This explains why we only see single entries.`);
            }
        }
        
        // Store raw data for classification (with duplicates intact)
        const rawDataForClassification = userSpecificData.slice();
        
        // Filter out records that don't have valid net values for the current view
        const validData = userSpecificData.filter(row => {
            const netValue = getNetValue(row);
            const isValid = !isNaN(netValue) && netValue > 0;
            return isValid;
        });

        console.log(`📊 Valid data after filtering: ${validData.length} records`);
        
        if (validData.length === 0) return categories;

        // FIRST: Add classification to ALL valid entries (including duplicates)
        const dataWithClassification = validData.map(row => {
            // Get all raw entries for this same period to determine classification
            const samePeriodRows = rawDataForClassification.filter(r => r.month === row.month);
            const contractType = classifyContract(row, samePeriodRows);
            const netValue = getNetValue(row);
            
            console.log(`🏷️ Classifying ${row.month}: ${formatCurrency(netValue)} → ${contractType} (${samePeriodRows.length} entries for this month) | ${row.classificationReason || 'No reason provided'}`);
            
            return { ...row, contractType, netValue };
        });

        // THEN: Deduplicate by month, but keep the HIGHEST value entry for each contract type
        const deduplicatedData = [];
        const monthlyContractMap = new Map();
        
        dataWithClassification.forEach(row => {
            const monthKey = row.month;
            const contractType = row.contractType || 'Unknown';
            const key = `${monthKey}-${contractType}`;
            
            if (!monthlyContractMap.has(key)) {
                monthlyContractMap.set(key, row);
            } else {
                const existing = monthlyContractMap.get(key);
                if (row.netValue > existing.netValue) {
                    console.log(`📈 Replacing ${contractType} for ${monthKey}: ${formatCurrency(existing.netValue)} → ${formatCurrency(row.netValue)}`);
                    monthlyContractMap.set(key, row);
                }
            }
        });
        
        const finalData = Array.from(monthlyContractMap.values());
        console.log(`📊 After contract-aware deduplication: ${finalData.length} records`);

        const highestRecordMonth = finalData.reduce((max, row) => {
            return row.netValue > (max.netValue || 0) ? row : max;
        }, { netValue: 0 });

        console.log(`📊 Highest record month:`, highestRecordMonth);

        if (highestRecordMonth.netValue > 0) {
            categories['Record Month'].push({
                ...highestRecordMonth,
                calculatedNetValue: highestRecordMonth.netValue || getNetValue(highestRecordMonth)
            });
        }

        finalData.forEach(row => {
            const clubName = getClubName(row.netValue);
            
            console.log(`📋 Processing ${row.month}: ${formatCurrency(row.netValue)} → ${clubName} Club • ${row.contractType} | Reason: ${row.classificationReason || 'No reason provided'}`);
            
            if (clubName !== 'Record Month') {
                categories[clubName].push({ 
                    ...row, 
                    calculatedNetValue: row.netValue || getNetValue(row)
                });
            }
        });
        
        console.log(`📊 Final categories:`, Object.keys(categories).map(cat => `${cat}: ${categories[cat].length}`).join(', '));

        // Ensure each category is sorted by date (newest to oldest) for display order
        // Data should already be sorted from fetchTrophyCaseData, but this guarantees proper order
        Object.keys(categories).forEach(clubName => {
            if (clubName !== 'Record Month' && categories[clubName].length > 0) {
                categories[clubName].sort((a, b) => {
                    const parseMonth = (monthStr) => {
                        try {
                            const date = new Date(monthStr + ' 01');
                            return date.getTime();
                        } catch (error) {
                            return 0;
                        }
                    };
                    
                    const dateA = parseMonth(a.month);
                    const dateB = parseMonth(b.month);
                    
                    // Sort in descending order (newest first)
                    return dateB - dateA;
                });
            }
        });



        return categories;
    };

    const calculateRankings = (data) => {
        const rankings = {};

        // Filter out records that don't have valid net values for the current view
        const validData = data.filter(row => {
            const netValue = getNetValue(row);
            return !isNaN(netValue) && netValue > 0;
        });

        const groupedByMonth = validData.reduce((acc, row) => {
            const { month } = row;
            if (!acc[month]) acc[month] = [];
            acc[month].push({ 
                ...row, 
                calculatedNetValue: getNetValue(row)
            });
            return acc;
        }, {});

        for (const [month, rows] of Object.entries(groupedByMonth)) {
            rows.sort((a, b) => b.calculatedNetValue - a.calculatedNetValue);
            rows.forEach((row, index) => {
                rankings[row.LagnName + month] = index + 1;
            });
        }

        return rankings;
    };

    const categorizedData = categorizeData(trophyCaseData);
    const rankings = calculateRankings(allTrophyData);
    const mostRecentClubEntry = getMostRecentClubEntry(categorizedData);

    const toggleClubExpansion = (club) => {
        setExpandedClubs((prevState) => ({
            ...prevState,
            [club]: !prevState[club]
        }));
    };

    if (loading) {
        return (
            <div className="trophy-case-container">
                <div className="widget-loading">
                    <div className="spinner"></div>
                    Loading Trophy Case...
                </div>
            </div>
        );
    }

        return (
        <>
            <div className={`trophy-header ${theme}`}>
                <h5>Trophy Case</h5>
                <FontAwesomeIcon 
                    icon={faInfoCircle} 
                    className="info-icon" 
                    onClick={() => setShowInfoModal(true)}
                />
            </div>

            {/* Time Since Cards */}
            <div className={`time-cards-container ${theme}`}>
                {categorizedData['Record Month'].length > 0 && (
                    <div className="time-card">
                        <div className="time-card-label">Time Since Record Month</div>
                        <div className="time-card-value">
                            {getTimeSince(categorizedData['Record Month'][0].month, false)}
                        </div>
                    </div>
                )}
                {recordWeekData && (
                    <div className="time-card">
                        <div className="time-card-label">Time Since Record Week</div>
                        <div className="time-card-value">
                            {getTimeSince(recordWeekData.reportdate, true)}
                        </div>
                    </div>
                )}
                {mostRecentClubEntry && (() => {
                    const contract = trophyView === 'team' && mostRecentClubEntry.contractType ? mostRecentClubEntry.contractType : null;
                    return (
                        <div className="time-card">
                            <div className="time-card-label">Time Since Last Club Entry</div>
                            <div className="time-card-value">
                                {getTimeSince(mostRecentClubEntry.month, false)}
                            </div>
                            <div className="time-card-subtitle">
                                {mostRecentClubEntry.clubName} Club{contract ? ` • ${contract}` : ''}
                            </div>
                        </div>
                    );
                })()}
            </div>
            
            <div className={`trophy-case-container ${theme}`}>
                <div className="trophy-card-container">
                    {categorizedData['Record Month'].map((row, index) => {
                        const contract = trophyView === 'team' && row.contractType ? row.contractType : null;
                        const sub = contract ? `${row.month} • ${contract}` : row.month;
                        return (
                        <Card
                            key={`record-${index}`}
                                title={`Record Month ${trophyView === 'team' ? '(Team)' : ''}`}
                                value={formatCurrency((row.calculatedNetValue || row.netValue || 0).toString())}
                                subText={sub}
                            backgroundImage={getBackgroundImage('RecordMonth')}
                            backgroundSize="auto 80%"
                            backgroundPositionX="96%"
                            backgroundPositionY="75%"
                        />
                        );
                    })}
                    
                    {recordWeekData && (() => {
                        const sameWeekRows = userWeeklyRaw.filter(r => r.reportdate === recordWeekData.reportdate);
                        const contract = trophyView === 'team' ? classifyContract(recordWeekData, sameWeekRows) : null;
                        const sub = contract ? `${formatDateRange(recordWeekData.reportdate)} • ${contract}` : formatDateRange(recordWeekData.reportdate);
                        return (
                        <Card
                                title={`Record Week ${trophyView === 'team' ? '(Team)' : ''}`}
                                value={formatCurrency((recordWeekData.calculatedNetValue || recordWeekData.netValue || 0).toString())}
                                subText={sub}
                            backgroundImage={getBackgroundImage('RecordWeek')}
                            backgroundSize="auto 80%"
                            backgroundPositionX="95%"
                            backgroundPositionY="50%"
                        />
                        );
                    })()}
                </div>
                
                {['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'].map((club) => {
                    const getClubThreshold = (clubName) => {
                        if (trophyView === 'team') {
                            switch(clubName) {
                                case 'Bronze': return '($25,000+)';
                                case 'Silver': return '($35,000+)';
                                case 'Gold': return '($50,000+)';
                                case 'Platinum': return '($100,000+)';
                                case 'Diamond': return '($200,000+)';
                                default: return '';
                            }
                        } else {
                        switch(clubName) {
                                case 'Bronze': return '($15,000+)';
                                case 'Silver': return '($20,000+)';
                                case 'Gold': return '($25,000+)';
                                case 'Platinum': return '($50,000+)';
                            case 'Diamond': return '($100,000+)';
                            default: return '';
                            }
                        }
                    };

                    return (
                        <div key={club} className="club-section">
                            <div 
                                className={`club-title-container ${theme}`} 
                                onClick={() => toggleClubExpansion(club)} 
                                style={{ cursor: 'pointer' }}
                            >
                                <h5 className="club-title">
                                    {club} Club {getClubThreshold(club)}
                                </h5>
                                <div className="club-icons">
                                    {categorizedData[club].slice(0, 10).map((_, idx) => (
                                        <FontAwesomeIcon key={idx} icon={faMedal} className="club-icon" />
                                    ))}
                                    <span className="entry-count">
                                        {categorizedData[club].length}
                                    </span>
                                </div>
                                <div style={{marginLeft: '5px'}}>
                                    <FontAwesomeIcon
                                        icon={expandedClubs[club] ? faChevronDown : faChevronRight}
                                        className="chevron-icon"
                                    />
                                </div>
                            </div>
                            
                            {expandedClubs[club] && (
                                <div className="trophy-card-container">
                                    {categorizedData[club].length > 0 ? (
                                        categorizedData[club].map((row, idx) => {
                                            const contract = trophyView === 'team' && row.contractType ? row.contractType : null;
                                        const rankingText = rankings[row.LagnName + row.month] <= 3 
                                            ? `Ranked #${rankings[row.LagnName + row.month]} in the organization` 
                                            : '';
                                            const baseSub = contract ? `${row.month} • ${contract}` : row.month;
                                            const subText = rankingText ? `${baseSub} • ${rankingText}` : baseSub;
                                        
                                        return (
                                            <Card
                                                key={`${club}-${idx}`}
                                                    title={`${club} Club ${trophyView === 'team' ? '(Team)' : ''}`}
                                                    value={formatCurrency((row.calculatedNetValue || row.netValue || 0).toString())}
                                                subText={subText}
                                                backgroundImage={getBackgroundImage(club)}
                                                backgroundSize="auto 100%"
                                                backgroundPositionX="95%"
                                                backgroundPositionY="50%"
                                            />
                                        );
                                        })
                                    ) : (
                                        <div className="empty-club-message">
                                            <p>No achievements yet. Keep working towards your first {club} Club entry!</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                
                {/* Wall of Fame Section */}
                    <div className="club-section wall-of-fame-section">
                        <div 
                            className={`club-title-container wall-of-fame-title ${theme}`} 
                            onClick={() => toggleClubExpansion('WallOfFame')} 
                            style={{ cursor: 'pointer' }}
                        >
                            <h5 className="club-title">
                            🌟 Wall of Fame ($8,000+ Weekly {trophyView === 'team' ? 'Team ' : ''}Net ALP)
                            </h5>
                            <div className="club-icons">
                                {wallOfFameData.slice(0, 10).map((_, idx) => (
                                    <FontAwesomeIcon key={idx} icon={faMedal} className="club-icon wall-of-fame-icon" />
                                ))}
                                <span className="entry-count wall-of-fame-count">
                                    {wallOfFameData.length}
                                </span>
                            </div>
                            <div style={{marginLeft: '5px'}}>
                                <FontAwesomeIcon
                                    icon={expandedClubs.WallOfFame ? faChevronDown : faChevronRight}
                                    className="chevron-icon"
                                />
                            </div>
                        </div>
                        
                        {expandedClubs.WallOfFame && (
                            <div className="trophy-card-container">
                            {wallOfFameData.length > 0 ? (
                                wallOfFameData.map((row, idx) => {
                                    const subText = `${formatDateRange(row.reportdate)} • Weekly Achievement`;
                                    
                                    return (
                                        <Card
                                            key={`wall-of-fame-${idx}`}
                                            title={`Wall of Fame ${trophyView === 'team' ? '(Team)' : ''}`}
                                            value={formatCurrency((row.calculatedNetValue || row.netValue || 0).toString())}
                                            subText={subText}
                                        />
                                    );
                                })
                            ) : (
                                <div className="empty-club-message">
                                    <p>No Wall of Fame achievements yet. Reach $8,000+ weekly {trophyView === 'team' ? 'team ' : ''}net ALP to earn your spot!</p>
                            </div>
                        )}
                    </div>
                )}
                </div>
            </div>

            {/* Info Modal */}
            {showInfoModal && (
                <div className="modal-overlay" onClick={() => setShowInfoModal(false)}>
                    <div className={`modal-content ${theme}`} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Trophy Case Information</h3>
                            <button 
                                className="modal-close-btn"
                                onClick={() => setShowInfoModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>Your Trophy Case is an easy way to keep track of your {trophyView === 'team' ? 'team' : 'personal'} production records achieved in your career. Being a part of one of these clubs is a display of your commitment to {trophyView === 'team' ? 'team' : 'your own'} success and a reminder of the effort it took to attain this accolade. Below are the <strong>{trophyView === 'team' ? 'Team Net ALP' : 'Net ALP'}</strong> levels needed in a month to reach each club level:</p>
                            <ul className="trophy-levels-list">
                                <li>
                                    <img src={bronzeMedalImage} alt="Bronze Medal" />
                                    Bronze Club: {trophyView === 'team' ? '$25,000+' : '$15,000+'}
                                </li>
                                <li>
                                    <img src={silverMedalImage} alt="Silver Medal" />
                                    Silver Club: {trophyView === 'team' ? '$35,000+' : '$20,000+'}
                                </li>
                                <li>
                                    <img src={goldMedalImage} alt="Gold Medal" />
                                    Gold Club: {trophyView === 'team' ? '$50,000+' : '$25,000+'}
                                </li>
                                <li>
                                    <img src={platinumMedalImage} alt="Platinum Medal" />
                                    Platinum Club: {trophyView === 'team' ? '$100,000+' : '$50,000+'}
                                </li>
                                <li>
                                    <img src={diamondMedalImage} alt="Diamond Medal" />
                                    Diamond Club: {trophyView === 'team' ? '$200,000+' : '$100,000+'}
                                </li>
                            </ul>
                            <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#fff8dc', borderRadius: '8px', border: '2px solid #ffd700' }}>
                                <h4 style={{ color: '#8b4513', margin: '0 0 0.5rem 0' }}>🌟 Wall of Fame</h4>
                                <p style={{ color: '#654321', margin: 0 }}>The <strong>Wall of Fame</strong> showcases your exceptional weekly achievements - any week where you reached <strong>$8,000 or more in {trophyView === 'team' ? 'Team Net ALP' : 'Net ALP'}</strong>. These weekly milestones demonstrate your consistent high performance and dedication to excellence.</p>
                            </div>
                            <p>If you have a record week or month that is not currently showing, please have your MGA send proof to kvanbibber@ariasagencies.com using either a P&P or week certificate from the Home Office.</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TrophyCase;
