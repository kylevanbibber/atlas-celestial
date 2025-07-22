/**
 * Reusable date comparison utilities for reports
 * Handles calculating previous periods for week, month, year comparisons
 */

/**
 * Calculate the previous period date range based on current period and range type
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format  
 * @param {string} rangeType - 'week', 'month', 'year', or 'custom'
 * @returns {object} Previous period with start_date and end_date
 */
const calculatePreviousPeriod = (startDate, endDate, rangeType) => {
    // Fix timezone issues by parsing date string manually instead of using new Date(dateString)
    // which can cause off-by-one day errors due to UTC interpretation
    const parseDate = (dateString) => {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day); // month - 1 because JS months are 0-indexed
    };
    
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    
    let prevStart, prevEnd;
    
    if (rangeType === 'week') {
        // For weekly comparison, go back exactly 7 days
        prevStart = new Date(start);
        prevStart.setDate(start.getDate() - 7);
        
        prevEnd = new Date(end);
        prevEnd.setDate(end.getDate() - 7);
        
    } else if (rangeType === 'month') {
        // For monthly comparison, go back to the same days in the previous month
        prevStart = new Date(start);
        prevStart.setMonth(start.getMonth() - 1);
        
        // For end date, we need to be more careful about month boundaries
        // Get the last day of the previous month
        prevEnd = new Date(start.getFullYear(), start.getMonth(), 0); // Last day of previous month
        
        // If the original end date wasn't the last day of its month,
        // try to use the same day number in the previous month
        const originalEndDay = end.getDate();
        const lastDayOfPrevMonth = prevEnd.getDate();
        
        if (originalEndDay <= lastDayOfPrevMonth) {
            // Safe to use the same day number
            prevEnd.setDate(originalEndDay);
        }
        // Otherwise, keep it as the last day of the previous month
        
    } else if (rangeType === 'year') {
        // For yearly comparison, go back exactly one year
        prevStart = new Date(start);
        prevStart.setFullYear(start.getFullYear() - 1);
        
        prevEnd = new Date(end);
        prevEnd.setFullYear(end.getFullYear() - 1);
        
    } else {
        // For custom ranges, calculate the duration and go back by that amount
        const duration = end.getTime() - start.getTime();
        
        prevEnd = new Date(start);
        prevEnd.setDate(start.getDate() - 1); // Day before current period starts
        
        prevStart = new Date(prevEnd.getTime() - duration);
    }
    
    return {
        start_date: prevStart.toISOString().split('T')[0],
        end_date: prevEnd.toISOString().split('T')[0]
    };
};

/**
 * Get number of days in a specific month
 * @param {number} year 
 * @param {number} month - 1-based month (1 = January)
 * @returns {number} Number of days in the month
 */
const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
};

/**
 * Build WHERE clause for previous period comparison
 * Works with any table that has a date column
 * @param {string} baseWhereClause - Original WHERE clause
 * @param {array} baseParams - Original parameters
 * @param {string} startDate - Current period start date
 * @param {string} endDate - Current period end date
 * @param {string} rangeType - 'week', 'month', 'year', or 'custom'
 * @param {string} dateColumn - Name of the date column (default: 'created_at')
 * @param {string} tableAlias - Table alias (default: 'r')
 * @returns {object} { whereClause, params, previousPeriod }
 */
const buildPreviousPeriodQuery = (baseWhereClause, baseParams, startDate, endDate, rangeType, dateColumn = 'created_at', tableAlias = 'r') => {
    const previousPeriod = calculatePreviousPeriod(startDate, endDate, rangeType);
    
    // Replace the date filtering in the WHERE clause
    let prevWhereClause = baseWhereClause;
    let prevParams = [...baseParams];
    
    // Find and replace date filtering pattern
    const datePattern = new RegExp(`DATE\\(${tableAlias}\\.${dateColumn}\\)\\s+BETWEEN\\s+\\?\\s+AND\\s+\\?`, 'g');
    
    if (datePattern.test(prevWhereClause)) {
        // Replace the date range with previous period dates
        prevWhereClause = prevWhereClause.replace(datePattern, `DATE(${tableAlias}.${dateColumn}) BETWEEN ? AND ?`);
        
        // Update the date parameters in the params array
        const dateParamIndices = [];
        let paramIndex = 0;
        
        // Find which parameters are the date parameters
        const tempClause = baseWhereClause;
        const matches = tempClause.match(/\?/g) || [];
        
        for (let i = 0; i < matches.length; i++) {
            const beforeMatch = tempClause.substring(0, tempClause.indexOf('?', tempClause.indexOf('?') * i));
            if (beforeMatch.includes(`DATE(${tableAlias}.${dateColumn}) BETWEEN`)) {
                dateParamIndices.push(i, i + 1);
                break;
            }
        }
        
        // Replace date parameters with previous period dates
        if (dateParamIndices.length >= 2) {
            prevParams[dateParamIndices[0]] = previousPeriod.start_date;
            prevParams[dateParamIndices[1]] = previousPeriod.end_date;
        }
    } else {
        // If no date range pattern found, add the previous period filter
        prevWhereClause += ` AND DATE(${tableAlias}.${dateColumn}) BETWEEN ? AND ?`;
        prevParams.push(previousPeriod.start_date, previousPeriod.end_date);
    }
    
    return {
        whereClause: prevWhereClause,
        params: prevParams,
        previousPeriod: previousPeriod
    };
};

/**
 * Generic function to get previous period comparison data
 * @param {function} queryFn - Database query function
 * @param {string} baseQuery - Base SQL query without date filtering
 * @param {array} baseParams - Base query parameters
 * @param {string} startDate - Current period start date
 * @param {string} endDate - Current period end date
 * @param {string} rangeType - 'week', 'month', 'year', or 'custom'
 * @param {string} dateColumn - Name of the date column (default: 'created_at')
 * @param {string} tableAlias - Table alias (default: 'r')
 * @returns {object} Previous period data
 */
const getPreviousPeriodData = async (queryFn, baseQuery, baseParams, startDate, endDate, rangeType, dateColumn = 'created_at', tableAlias = 'r') => {
    const previousPeriod = calculatePreviousPeriod(startDate, endDate, rangeType);
    
    // Build the previous period query
    const prevQuery = baseQuery.replace(
        new RegExp(`DATE\\(${tableAlias}\\.${dateColumn}\\)\\s+BETWEEN\\s+\\?\\s+AND\\s+\\?`, 'g'),
        `DATE(${tableAlias}.${dateColumn}) BETWEEN ? AND ?`
    );
    
    // Replace date parameters
    const prevParams = [...baseParams];
    
    // Find and replace the date parameters
    let dateParamCount = 0;
    for (let i = 0; i < prevParams.length && dateParamCount < 2; i++) {
        if (prevParams[i] === startDate) {
            prevParams[i] = previousPeriod.start_date;
            dateParamCount++;
        } else if (prevParams[i] === endDate) {
            prevParams[i] = previousPeriod.end_date;
            dateParamCount++;
        }
    }
    
    try {
        const result = await queryFn(prevQuery, prevParams);
        return {
            ...result[0],
            previousPeriod: previousPeriod
        };
    } catch (error) {
        console.error('Error fetching previous period data:', error);
        return {
            previousPeriod: previousPeriod
        };
    }
};

/**
 * Format comparison text for display
 * @param {number} currentValue - Current period value
 * @param {number} previousValue - Previous period value
 * @param {string} label - Label for the metric (default: 'from last period')
 * @returns {string} Formatted comparison text
 */
const formatComparisonText = (currentValue, previousValue, label = 'from last period') => {
    if (previousValue === undefined || previousValue === null) {
        return 'No comparison data';
    }
    
    const difference = currentValue - previousValue;
    const sign = difference > 0 ? '+' : '';
    
    return `${sign}${difference} ${label}`;
};

/**
 * Get comparison class for styling
 * @param {number} currentValue - Current period value
 * @param {number} previousValue - Previous period value
 * @returns {string} CSS class name ('positive', 'negative', or 'neutral')
 */
const getComparisonClass = (currentValue, previousValue) => {
    if (previousValue === undefined || previousValue === null) {
        return 'neutral';
    }
    
    const difference = currentValue - previousValue;
    if (difference > 0) return 'positive';
    if (difference < 0) return 'negative';
    return 'neutral';
};

module.exports = {
    calculatePreviousPeriod,
    buildPreviousPeriodQuery,
    getPreviousPeriodData,
    formatComparisonText,
    getComparisonClass,
    getDaysInMonth
}; 