const express = require("express");
const router = express.Router();
const { pool, query } = require("../db");
const verifyToken = require("../middleware/verifyToken");
const { calculatePreviousPeriod, getPreviousPeriodData } = require("../utils/dateComparison");

// Utility function to add ranks with tie handling
const addRanksWithTies = (data, valueField) => {
    if (!data || data.length === 0) return data;
    
    let currentRank = 1;
    let previousValue = null;
    let skipCount = 0;
    
    return data.map((item, index) => {
        const currentValue = item[valueField] || 0;
        
        if (previousValue !== null && currentValue !== previousValue) {
            currentRank += skipCount;
            skipCount = 1;
        } else if (previousValue !== null && currentValue === previousValue) {
            skipCount++;
        } else {
            skipCount = 1;
        }
        
        previousValue = currentValue;
        
        return {
            ...item,
            rank: currentRank
        };
    });
};

// Apply auth middleware to all routes
router.use(verifyToken);

// Helper function to get user ID with proper fallback
const getUserId = async (req) => {
    if (req.user && req.user.userId) {
        return req.user.userId;
    }
    
    // For development - find any existing user or use NULL
    try {
        const existingUser = await query("SELECT id FROM activeusers LIMIT 1");
        return existingUser.length > 0 ? existingUser[0].id : null;
    } catch (error) {
        console.warn("Could not determine user ID, using NULL");
        return null;
    }
};

// Helper function to build date filtering WHERE clause
const buildDateFilter = (whereClause, params, date_range, start_date, end_date) => {
    if (start_date && end_date) {
        whereClause += " AND DATE(r.created_at) BETWEEN ? AND ?";
        params.push(start_date, end_date);
    } else if (date_range) {
        switch (date_range) {
            case 'current-week':
                whereClause += " AND DATE(r.created_at) >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
                break;
            case 'current-month':
                whereClause += " AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
                break;
            case 'last-month':
                whereClause += " AND MONTH(r.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(r.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))";
                break;
            case 'quarter':
                whereClause += " AND QUARTER(r.created_at) = QUARTER(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
                break;
            case 'year':
                whereClause += " AND YEAR(r.created_at) = YEAR(CURDATE())";
                break;
        }
    } else {
        // Fallback to current month if no date filtering is provided
        whereClause += " AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
    }
    return { whereClause, params };
};

// Helper function to build hierarchy filtering WHERE clause
const buildHierarchyFilter = (whereClause, params, hierarchy_level, team) => {
    if (hierarchy_level && hierarchy_level !== 'all' && team && team !== 'all') {
        switch (hierarchy_level) {
            case 'sa':
                whereClause += " AND (r.sa = ? OR r.lagnname = ?)";
                params.push(team, team);
                break;
            case 'ga':
                whereClause += " AND (r.ga = ? OR r.lagnname = ?)";
                params.push(team, team);
                break;
            case 'mga':
                whereClause += " AND (r.mga = ? OR r.lagnname = ?)";
                params.push(team, team);
                break;
        }
    }
    return { whereClause, params };
};

// Helper function to get leaderboard data
const getLeaderboardData = async (baseWhereClause, baseParams, hierarchy_level, team, sort_by = 'true_refs') => {
    let leaderboardQuery;
    let groupByClause;
    let selectClause;
    let whereClause = baseWhereClause;
    let params = [...baseParams];

    if (hierarchy_level && hierarchy_level !== 'all') {
        if (team && team !== 'all') {
            // Show individual agents under the selected team leader
            selectClause = `
                SELECT 
                    r.lagnname as name,
                    r.lagnname as raw_name,
                    MAX(au.profpic) as profile_picture,
                    MAX(COALESCE(au.clname, 'AGENT')) as clname,
                    GROUP_CONCAT(DISTINCT 
                        CASE 
                            WHEN r.mga IS NOT NULL AND r.mga != '' 
                            THEN SUBSTRING_INDEX(r.mga, ' ', 1)
                            ELSE NULL 
                        END 
                        ORDER BY SUBSTRING_INDEX(r.mga, ' ', 1) SEPARATOR '/'
                    ) as mga,
                    CASE 
                        WHEN r.lagnname = '${team}' THEN '${hierarchy_level.toUpperCase()}'
                        ELSE 'AGENT'
                    END as level,
                    COUNT(*) as total_refs,
                    COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs,
                    COUNT(CASE WHEN r.true_ref = 'N' THEN 1 END) as rejected_refs,
                    COUNT(CASE WHEN r.true_ref IS NULL OR r.true_ref = '' THEN 1 END) as pending_refs,
                    ROUND(
                        (COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) * 100.0 / 
                         NULLIF(COUNT(CASE WHEN r.true_ref IS NOT NULL AND r.true_ref != '' THEN 1 END), 0)), 1
                    ) as conversion_rate,
                    1 as agent_count
                FROM refvalidation r
                LEFT JOIN activeusers au ON r.lagnname = au.lagnname AND au.Active = 'y' AND au.managerActive = 'y'
            `;
            groupByClause = `GROUP BY r.lagnname`;
            whereClause += ` AND au.Active = 'y' AND au.managerActive = 'y'`;
        } else {
            // Team-level aggregation
            const hierarchyColumn = hierarchy_level;
            
            if (hierarchy_level === 'mga') {
                // Special handling for MGA level - use a custom query approach
                // We'll build the complete query here and return directly from this section
                
                // Build the date filter for the EXISTS/NOT EXISTS conditions
                // Extract the date condition from the baseWhereClause and baseParams
                let dateCondition = "";
                
                if (baseWhereClause.includes('DATE(r.created_at) BETWEEN') && baseParams.length >= 2) {
                    dateCondition = ` AND DATE(r.created_at) BETWEEN '${baseParams[0]}' AND '${baseParams[1]}'`;
                } else if (baseWhereClause.includes('MONTH(r.created_at) = MONTH(CURDATE())')) {
                    dateCondition = ` AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())`;
                } else if (baseWhereClause.includes('MONTH(r.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))')) {
                    dateCondition = ` AND MONTH(r.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(r.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`;
                } else if (baseWhereClause.includes('WEEKDAY(CURDATE())')) {
                    dateCondition = ` AND DATE(r.created_at) >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`;
                } else if (baseWhereClause.includes('QUARTER(r.created_at)')) {
                    dateCondition = ` AND QUARTER(r.created_at) = QUARTER(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())`;
                } else if (baseWhereClause.includes('YEAR(r.created_at) = YEAR(CURDATE())')) {
                    dateCondition = ` AND YEAR(r.created_at) = YEAR(CURDATE())`;
                } else {
                    // Default to current month if no date filtering is detected
                    dateCondition = ` AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())`;
                }
                
                // Use MGAs table as single source of truth to prevent duplicates
                const mgaQuery = `
                    SELECT 
                        m.lagnname as name,
                        m.lagnname as raw_name,
                        au.profpic as profile_picture,
                        au.clname,
                        GROUP_CONCAT(DISTINCT 
                            CASE 
                                WHEN r.mga IS NOT NULL AND r.mga != '' 
                                THEN SUBSTRING_INDEX(r.mga, ' ', 1)
                                ELSE NULL 
                            END 
                            ORDER BY SUBSTRING_INDEX(r.mga, ' ', 1) SEPARATOR '/'
                        ) as mga,
                        au.clname as level,
                        COUNT(r.id) as total_refs,
                        COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs,
                        COUNT(CASE WHEN r.true_ref = 'N' THEN 1 END) as rejected_refs,
                        COUNT(CASE WHEN r.true_ref IS NULL OR r.true_ref = '' THEN 1 END) as pending_refs,
                        ROUND(
                            (COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) * 100.0 / 
                             NULLIF(COUNT(CASE WHEN r.true_ref IS NOT NULL AND r.true_ref != '' THEN 1 END), 0)), 1
                        ) as conversion_rate,
                        COUNT(DISTINCT CASE WHEN r.lagnname != m.lagnname THEN r.lagnname END) as agent_count
                    FROM MGAs m
                    INNER JOIN activeusers au ON m.lagnname = au.lagnname AND au.Active = 'y' AND au.managerActive = 'y'
                    LEFT JOIN refvalidation r ON (
                        (r.lagnname = m.lagnname OR r.mga = m.lagnname)
                        ${baseWhereClause.replace('WHERE 1=1', '')}
                    )
                    WHERE m.active = 'y' 
                    AND m.hide = 'n'
                    AND au.Active = 'y'
                    AND au.clname IN ('MGA', 'RGA')
                    GROUP BY m.lagnname, au.profpic, au.clname
                `;
                
                // Execute the MGA query directly and return
                let orderByClause;
                switch (sort_by) {
                    case 'total_refs':
                        orderByClause = " ORDER BY total_refs DESC, true_refs DESC";
                        break;
                    case 'conversion_rate':
                        orderByClause = " ORDER BY conversion_rate DESC, true_refs DESC";
                        break;
                    case 'true_refs':
                    default:
                        orderByClause = " ORDER BY true_refs DESC, total_refs DESC";
                        break;
                }
                
                const fullMgaQuery = mgaQuery + orderByClause;
                const result = await query(fullMgaQuery, baseParams);
                return result;
            } else {
                selectClause = `
                    SELECT 
                        au.lagnname as name,
                        au.lagnname as raw_name,
                        au.profpic as profile_picture,
                        au.clname,
                        GROUP_CONCAT(DISTINCT 
                            CASE 
                                WHEN r.mga IS NOT NULL AND r.mga != '' 
                                THEN SUBSTRING_INDEX(r.mga, ' ', 1)
                                ELSE NULL 
                            END 
                            ORDER BY SUBSTRING_INDEX(r.mga, ' ', 1) SEPARATOR '/'
                        ) as mga,
                        '${hierarchy_level.toUpperCase()}' as level,
                        COUNT(*) as total_refs,
                        COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs,
                        COUNT(CASE WHEN r.true_ref = 'N' THEN 1 END) as rejected_refs,
                        COUNT(CASE WHEN r.true_ref IS NULL OR r.true_ref = '' THEN 1 END) as pending_refs,
                        ROUND(
                            (COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) * 100.0 / 
                             NULLIF(COUNT(CASE WHEN r.true_ref IS NOT NULL AND r.true_ref != '' THEN 1 END), 0)), 1
                        ) as conversion_rate,
                        COUNT(DISTINCT CASE WHEN r.lagnname != au.lagnname THEN r.lagnname END) as agent_count
                    FROM activeusers au
                    INNER JOIN refvalidation r ON (
                        r.lagnname = au.lagnname OR r.${hierarchyColumn} = au.lagnname
                    )
                    AND au.Active = 'y' AND au.managerActive = 'y'
                `;
                whereClause += ` AND au.clname = '${hierarchy_level.toUpperCase()}'`;
                groupByClause = `GROUP BY au.lagnname, au.profpic, au.clname`;
            }
        }
    } else {
        // Individual agent aggregation
        selectClause = `
            SELECT 
                r.lagnname as name,
                r.lagnname as raw_name,
                MAX(au.profpic) as profile_picture,
                MAX(COALESCE(au.clname, 'AGENT')) as clname,
                GROUP_CONCAT(DISTINCT 
                    CASE 
                        WHEN r.mga IS NOT NULL AND r.mga != '' 
                        THEN SUBSTRING_INDEX(r.mga, ' ', 1)
                        ELSE NULL 
                    END 
                    ORDER BY SUBSTRING_INDEX(r.mga, ' ', 1) SEPARATOR '/'
                ) as mga,
                'AGENT' as level,
                COUNT(*) as total_refs,
                COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs,
                COUNT(CASE WHEN r.true_ref = 'N' THEN 1 END) as rejected_refs,
                COUNT(CASE WHEN r.true_ref IS NULL OR r.true_ref = '' THEN 1 END) as pending_refs,
                ROUND(
                    (COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) * 100.0 / 
                     NULLIF(COUNT(CASE WHEN r.true_ref IS NOT NULL AND r.true_ref != '' THEN 1 END), 0)), 1
                ) as conversion_rate,
                MAX(r.sa) as sa,
                MAX(r.ga) as ga,
                MAX(r.rga) as rga
            FROM refvalidation r
            LEFT JOIN activeusers au ON r.lagnname = au.lagnname AND au.Active = 'y' AND au.managerActive = 'y'
        `;
        groupByClause = `GROUP BY r.lagnname`;
    }

    leaderboardQuery = `
        ${selectClause}
        ${whereClause}
        ${groupByClause}
        HAVING COUNT(*) > 0
    `;

    let orderByClause;
    switch (sort_by) {
        case 'total_refs':
            orderByClause = " ORDER BY total_refs DESC, true_refs DESC";
            break;
        case 'conversion_rate':
            orderByClause = " ORDER BY conversion_rate DESC, true_refs DESC";
            break;
        case 'true_refs':
        default:
            orderByClause = " ORDER BY true_refs DESC, total_refs DESC";
            break;
    }

    const fullQuery = leaderboardQuery + orderByClause;
    return await query(fullQuery, params);
};

// Helper function to get daily breakdown with user/team specific data
const getDailyBreakdown = async (baseWhereClause, baseParams, currentUser) => {
    let dailyQuery = `
        SELECT 
            DATE(r.created_at) as date,
            COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs`;
    
    let params = [...baseParams];
    
    // Always add user-specific data field, even if user is not available (defaults to 0)
    if (currentUser && currentUser.lagnname) {
        dailyQuery += `,
            COUNT(CASE WHEN r.true_ref = 'Y' AND r.lagnname = ? THEN 1 END) as user_true_refs`;
        params.push(currentUser.lagnname);
    } else {
        // Include user_true_refs as 0 if no user is available
        dailyQuery += `,
            0 as user_true_refs`;
    }
    
    // Always add team-specific data field, even if user is not SA/GA/MGA/RGA (defaults to 0)
    if (currentUser && ['SA', 'GA', 'MGA', 'RGA'].includes(currentUser.clname)) {
        dailyQuery += `,
            COUNT(CASE WHEN r.true_ref = 'Y' AND (`;
        
        if (currentUser.clname === 'SA') {
            dailyQuery += `r.sa = ? OR r.lagnname IN (SELECT lagnname FROM activeusers WHERE sa = ?)`;
            params.push(currentUser.lagnname, currentUser.lagnname);
        } else if (currentUser.clname === 'GA') {
            dailyQuery += `r.ga = ? OR r.lagnname IN (SELECT lagnname FROM activeusers WHERE ga = ?)`;
            params.push(currentUser.lagnname, currentUser.lagnname);
        } else if (currentUser.clname === 'MGA' || currentUser.clname === 'RGA') {
            // Include both MGA and RGA users in MGA-level filtering
            dailyQuery += `r.mga = ? OR r.lagnname IN (SELECT lagnname FROM activeusers WHERE mga = ? OR rga = ?)`;
            params.push(currentUser.lagnname, currentUser.lagnname, currentUser.lagnname);
        }
        
        dailyQuery += `) THEN 1 END) as team_true_refs`;
    } else {
        // Include team_true_refs as 0 if user is not a team leader
        dailyQuery += `,
            0 as team_true_refs`;
    }
    
    dailyQuery += `
        FROM refvalidation r
        LEFT JOIN activeusers a ON r.agent_id = a.id
        ${baseWhereClause}
        GROUP BY DATE(r.created_at)
        ORDER BY DATE(r.created_at) ASC
    `;

    const dailyBreakdown = await query(dailyQuery, params);
    
    // Format dates for frontend and ensure all required fields are present
    return dailyBreakdown.map(row => ({
        ...row,
        date: row.date ? new Date(row.date).toISOString().split('T')[0] : null,
        // Ensure these fields are always numbers (not null/undefined)
        true_refs: row.true_refs || 0,
        user_true_refs: row.user_true_refs || 0,
        team_true_refs: row.team_true_refs || 0
    }));
};

// Helper function to get previous period comparison with proportional time matching
const getPreviousPeriodComparison = async (whereClause, params, start_date, end_date, rangeType) => {
    // If no start_date/end_date provided, return empty comparison
    if (!start_date || !end_date || !rangeType) {
        return { prevTotalRefs: 0, prevCompletedRefs: 0 };
    }

    // Fix timezone issues by parsing date string manually instead of using new Date(dateString)
    // which can cause off-by-one day errors due to UTC interpretation
    const parseDate = (dateString) => {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day); // month - 1 because JS months are 0-indexed
    };
    
    const today = new Date();
    const startDate = parseDate(start_date);
    const endDate = parseDate(end_date);
    
    // Calculate how far we are through the current period
    let currentCutoffDate = today;
    
    // If today is past the end date, use the full period
    if (today > endDate) {
        currentCutoffDate = endDate;
    }
    // If today is before the start date, use the start date
    else if (today < startDate) {
        currentCutoffDate = startDate;
    }
    
    // Calculate the previous period
    const previousPeriod = calculatePreviousPeriod(start_date, end_date, rangeType);
    const prevStartDate = parseDate(previousPeriod.start_date);
    const prevEndDate = parseDate(previousPeriod.end_date);
    
    let prevCutoffDate;
    
    if (rangeType === 'week' || rangeType === 'month' || rangeType === 'year') {
        // Calculate progress percentage through current period
        const totalPeriodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const daysThroughPeriod = Math.ceil((currentCutoffDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const progressPercentage = Math.min(daysThroughPeriod / totalPeriodDays, 1);
        
        // Apply same progress to previous period
        const prevTotalDays = Math.ceil((prevEndDate - prevStartDate) / (1000 * 60 * 60 * 24)) + 1;
        const prevDaysToInclude = Math.ceil(prevTotalDays * progressPercentage);
        
        prevCutoffDate = new Date(prevStartDate);
        prevCutoffDate.setDate(prevStartDate.getDate() + prevDaysToInclude - 1);
        

    } else {
        // For custom ranges, use the full previous period
        prevCutoffDate = prevEndDate;
    }
    
    // Build the query for current period up to cutoff
    const currentCutoffStr = currentCutoffDate.toISOString().split('T')[0];
    const prevCutoffStr = prevCutoffDate.toISOString().split('T')[0];
    
    // Replace date parameters for previous period comparison
    let prevParams = [...params];
    let dateParamCount = 0;
    for (let i = 0; i < prevParams.length && dateParamCount < 2; i++) {
        if (prevParams[i] === start_date) {
            prevParams[i] = previousPeriod.start_date;
            dateParamCount++;
        } else if (prevParams[i] === end_date) {
            prevParams[i] = prevCutoffStr;
            dateParamCount++;
        }
    }

    const prevSummaryQuery = `
        SELECT 
            COUNT(*) as prevTotalRefs,
            COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as prevCompletedRefs
        FROM refvalidation r
        LEFT JOIN activeusers a ON r.agent_id = a.id
        ${whereClause}
    `;

    try {
        const prevSummary = await query(prevSummaryQuery, prevParams);
        return {
            ...prevSummary[0] || { prevTotalRefs: 0, prevCompletedRefs: 0 },
            previousPeriod: {
                ...previousPeriod,
                actual_end_date: prevCutoffStr,
                comparison_type: rangeType === 'custom' ? 'full_period' : 'proportional'
            }
        };
    } catch (error) {
        console.error('Error fetching previous period comparison:', error);
        return { 
            prevTotalRefs: 0, 
            prevCompletedRefs: 0,
            previousPeriod: previousPeriod
        };
    }
};

// Helper function to format activity items
const formatActivityItem = (item) => {
    return {
        id: item.id,
        agent: item.agent || item.lagnname,
        prospect: item.prospect || item.client_name,
        type: item.type || (item.true_ref === 'Y' ? 'conversion' : 
                           item.true_ref === 'N' ? 'rejection' : 'new_ref'),
        date: item.date || item.created_at,
        true_ref: item.true_ref,
        existing_policy: item.existing_policy,
        trial: item.trial,
        zip_code: item.zip_code,
        notes: item.notes,
        sa: item.sa,
        ga: item.ga,
        mga: item.mga,
        rga: item.rga
    };
};

// ==================== REF REPORT ROUTES ====================

// GET /api/ref-report/dashboard - Unified endpoint for all main dashboard data
router.get("/dashboard", async (req, res) => {
    const { 
        date_range, 
        hierarchy_level = 'all', 
        team = 'all', 
        agent_id, 
        start_date, 
        end_date,
        sort_by = 'true_refs',
        activity_limit = 10
    } = req.query;
    
     
    
    try {
        let whereClause = "WHERE 1=1";
        let params = [];
        
        // Build date filtering with today cutoff for current periods
        let adjustedEndDate = end_date;
        
        // If we're looking at a current period that extends beyond today, limit to today
        if (start_date && end_date) {
            const today = new Date().toISOString().split('T')[0];
            const endDateObj = new Date(end_date + 'T00:00:00');
            const todayObj = new Date(today + 'T00:00:00');
            
            if (endDateObj > todayObj) {
                adjustedEndDate = today;
            }
        }
        
        const dateFilter = buildDateFilter(whereClause, params, date_range, start_date, adjustedEndDate);
        whereClause = dateFilter.whereClause;
        params = dateFilter.params;
        
        // Agent filtering
        if (agent_id && agent_id !== 'all') {
            whereClause += " AND r.agent_id = ?";
            params.push(agent_id);
        }
        
        // Build hierarchy filtering
        const hierarchyFilter = buildHierarchyFilter(whereClause, params, hierarchy_level, team);
        whereClause = hierarchyFilter.whereClause;
        params = hierarchyFilter.params;

        // Get current user info from JWT token
        const currentUser = req.user || null;

        // Execute all queries in parallel for better performance
        const [summaryResult, leaderboardResult, activityResult] = await Promise.all([
            // 1. Summary query
            query(`
                SELECT 
                    COUNT(*) as totalRefs,
                    COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as completedRefs,
                    COUNT(CASE WHEN r.true_ref IS NULL OR r.true_ref = '' THEN 1 END) as activeRefs,
                    COUNT(CASE WHEN r.true_ref = 'N' THEN 1 END) as rejectedRefs,
                    ROUND(
                        (COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) * 100.0 / 
                         NULLIF(COUNT(CASE WHEN r.true_ref IS NOT NULL AND r.true_ref != '' THEN 1 END), 0)), 1
                    ) as conversionRate
                FROM refvalidation r
                LEFT JOIN activeusers a ON r.agent_id = a.id
                ${whereClause}
            `, params),
            
            // 2. Leaderboard query
            getLeaderboardData(whereClause, params, hierarchy_level, team, sort_by),
            
            // 3. Activity query  
            query(`
                SELECT 
                    r.id,
                    r.lagnname as agent,
                    r.client_name as prospect,
                    r.true_ref,
                    r.created_at as date,
                    r.updated_at,
                    r.existing_policy,
                    r.trial,
                    r.zip_code,
                    r.notes,
                    r.sa,
                    r.ga,
                    r.mga,
                    r.rga,
                    CASE 
                        WHEN r.true_ref = 'Y' THEN 'conversion'
                        WHEN r.true_ref = 'N' THEN 'rejection'
                        WHEN r.updated_at > r.created_at AND r.true_ref IS NULL THEN 'update'
                        ELSE 'new_ref'
                    END as type
                FROM refvalidation r
                ${whereClause}
                ORDER BY r.updated_at DESC, r.created_at DESC
                LIMIT ?
            `, [...params, parseInt(activity_limit)])
        ]);

        // Get daily breakdown with user/team specific data
        const dailyBreakdown = await getDailyBreakdown(whereClause, params, currentUser);
        
        // Get previous period comparison
        // Determine rangeType from date_range or use default based on date range span
        let rangeType = 'custom';
        if (date_range) {
            if (date_range.includes('week')) rangeType = 'week';
            else if (date_range.includes('month')) rangeType = 'month';
            else if (date_range.includes('year')) rangeType = 'year';
        } else if (start_date && end_date) {
            // Auto-detect range type based on date span
            const startDate = new Date(start_date);
            const endDate = new Date(end_date);
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff <= 7) rangeType = 'week';
            else if (daysDiff <= 35) rangeType = 'month'; // Allow some flexibility for monthly ranges
            else if (daysDiff >= 350) rangeType = 'year';
        }
        

        
        // Use original end_date for period calculation, but comparison function will handle proportional cutoff
        const previousPeriod = await getPreviousPeriodComparison(whereClause, params, start_date, end_date, rangeType);

        // Add ranks to leaderboard data with tie handling
        const rankedLeaderboard = addRanksWithTies(leaderboardResult, 'true_refs');

        // Format activity data
        const formattedActivity = activityResult.map(formatActivityItem);



        res.json({
            success: true,
            data: {
                summary: {
                    ...summaryResult[0],
                    previousPeriod
                },
                dailyBreakdown,
                leaderboard: rankedLeaderboard,
                recentActivity: formattedActivity,
                meta: {
                    aggregation_type: hierarchy_level !== 'all' && team === 'all' ? 'team' : 'agent',
                    hierarchy_level,
                    specific_team: team !== 'all' ? team : null,
                    date_range: { start_date, end_date, type: date_range },
                    currentUser: currentUser
                }
            }
        });

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ success: false, message: "Failed to fetch dashboard data" });
    }
});

// GET /api/ref-report/summary - Get REF report summary statistics
router.get("/summary", async (req, res) => {
    const { date_range, hierarchy_level, team, agent_id, start_date, end_date } = req.query;
    
    try {
        let whereClause = "WHERE 1=1";
        let params = [];
        
        // Date filtering - using DATE() to focus on yyyy-mm-dd part only
        if (start_date && end_date) {
            whereClause += " AND DATE(r.created_at) BETWEEN ? AND ?";
            params.push(start_date, end_date);
        } else if (date_range) {
            switch (date_range) {
                case 'current-week':
                    whereClause += " AND DATE(r.created_at) >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
                    break;
                case 'current-month':
                    whereClause += " AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
                case 'last-month':
                    whereClause += " AND MONTH(r.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(r.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))";
                    break;
                case 'quarter':
                    whereClause += " AND QUARTER(r.created_at) = QUARTER(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
                case 'year':
                    whereClause += " AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
            }
        }
        
        // Agent filtering
        if (agent_id && agent_id !== 'all') {
            whereClause += " AND r.agent_id = ?";
            params.push(agent_id);
        }
        
        // Hierarchical team filtering
        if (hierarchy_level && hierarchy_level !== 'all' && team && team !== 'all') {
            switch (hierarchy_level) {
                case 'sa':
                    whereClause += " AND (r.sa = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
                case 'ga':
                    whereClause += " AND (r.ga = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
                case 'mga':
                    whereClause += " AND (r.mga = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
            }
        }

        // Get summary statistics
        const summaryQuery = `
            SELECT 
                COUNT(*) as totalRefs,
                COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as completedRefs,
                COUNT(CASE WHEN r.true_ref IS NULL OR r.true_ref = '' THEN 1 END) as activeRefs,
                COUNT(CASE WHEN r.true_ref = 'N' THEN 1 END) as rejectedRefs,
                ROUND(
                    (COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) * 100.0 / 
                     NULLIF(COUNT(CASE WHEN r.true_ref IS NOT NULL AND r.true_ref != '' THEN 1 END), 0)), 1
                ) as conversionRate
            FROM refvalidation r
            LEFT JOIN activeusers a ON r.agent_id = a.id
            ${whereClause}
        `;

        const summary = await query(summaryQuery, params);

        // Get previous period comparison using the new reusable utility
        // Determine rangeType from date_range or use default based on date range span
        let rangeType = 'custom';
        if (date_range) {
            if (date_range.includes('week')) rangeType = 'week';
            else if (date_range.includes('month')) rangeType = 'month';
            else if (date_range.includes('year')) rangeType = 'year';
        } else if (start_date && end_date) {
            // Auto-detect range type based on date span
            const startDate = new Date(start_date);
            const endDate = new Date(end_date);
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff <= 7) rangeType = 'week';
            else if (daysDiff <= 35) rangeType = 'month'; // Allow some flexibility for monthly ranges
            else if (daysDiff >= 350) rangeType = 'year';
        }

        const prevSummary = await getPreviousPeriodComparison(whereClause, params, start_date, end_date, rangeType);

        // Get current user info from JWT token
        const currentUser = req.user || null;

        // Get daily breakdown for chart with user and team data
        let dailyQuery = `
            SELECT 
                DATE(r.created_at) as date,
                COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs`;
        
        // Always add user-specific data field, even if user is not available (defaults to 0)
        if (currentUser && currentUser.lagnname) {
            dailyQuery += `,
                COUNT(CASE WHEN r.true_ref = 'Y' AND r.lagnname = ? THEN 1 END) as user_true_refs`;
            params.push(currentUser.lagnname);
        } else {
            // Include user_true_refs as 0 if no user is available
            dailyQuery += `,
                0 as user_true_refs`;
        }
        
        // Always add team-specific data field, even if user is not SA/GA/MGA (defaults to 0)
        if (currentUser && ['SA', 'GA', 'MGA', 'RGA'].includes(currentUser.clname)) {
            dailyQuery += `,
                COUNT(CASE WHEN r.true_ref = 'Y' AND (`;
            
            if (currentUser.clname === 'SA') {
                dailyQuery += `r.sa = ? OR r.lagnname IN (SELECT lagnname FROM activeusers WHERE sa = ?)`;
                params.push(currentUser.lagnname, currentUser.lagnname);
            } else if (currentUser.clname === 'GA') {
                dailyQuery += `r.ga = ? OR r.lagnname IN (SELECT lagnname FROM activeusers WHERE ga = ?)`;
                params.push(currentUser.lagnname, currentUser.lagnname);
            } else if (currentUser.clname === 'MGA') {
                dailyQuery += `r.mga = ? OR r.lagnname IN (SELECT lagnname FROM activeusers WHERE mga = ?)`;
                params.push(currentUser.lagnname, currentUser.lagnname);
            }
            
            dailyQuery += `) THEN 1 END) as team_true_refs`;
        } else {
            // Include team_true_refs as 0 if user is not a team leader
            dailyQuery += `,
                0 as team_true_refs`;
        }
        
        dailyQuery += `
            FROM refvalidation r
            LEFT JOIN activeusers a ON r.agent_id = a.id
            ${whereClause}
            GROUP BY DATE(r.created_at)
            ORDER BY DATE(r.created_at) ASC
        `;

        const dailyBreakdown = await query(dailyQuery, params);

        // Format dates for frontend and ensure all required fields are present
        const formattedDailyData = dailyBreakdown.map(row => ({
            ...row,
            date: row.date ? new Date(row.date).toISOString().split('T')[0] : null,
            // Ensure these fields are always numbers (not null/undefined)
            true_refs: row.true_refs || 0,
            user_true_refs: row.user_true_refs || 0,
            team_true_refs: row.team_true_refs || 0
        }));



        res.json({ 
            success: true, 
            data: {
                ...summary[0],
                previousPeriod: prevSummary,
                dailyBreakdown: formattedDailyData,
                currentUser: currentUser
            }
        });
    } catch (error) {
        console.error("Error fetching REF summary:", error);
        res.status(500).json({ success: false, message: "Failed to fetch REF summary" });
    }
});

// GET /api/ref-report/activity - Get recent REF activity
router.get("/activity", async (req, res) => {
    const { limit = 20, date_range, hierarchy_level, team, agent_id } = req.query;
    
    try {
        let whereClause = "WHERE 1=1";
        let params = [];
        
        // Date filtering - using DATE() to focus on yyyy-mm-dd part only
        if (date_range) {
            switch (date_range) {
                case 'current-week':
                    whereClause += " AND DATE(r.created_at) >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
                    break;
                case 'current-month':
                    whereClause += " AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
                case 'last-month':
                    whereClause += " AND MONTH(r.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(r.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))";
                    break;
            }
        }
        
        // Agent filtering
        if (agent_id && agent_id !== 'all') {
            whereClause += " AND r.agent_id = ?";
            params.push(agent_id);
        }
        
        // Hierarchical team filtering
        if (hierarchy_level && hierarchy_level !== 'all' && team && team !== 'all') {
            switch (hierarchy_level) {
                case 'sa':
                    whereClause += " AND (r.sa = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
                case 'ga':
                    whereClause += " AND (r.ga = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
                case 'mga':
                    whereClause += " AND (r.mga = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
            }
        }

        const activities = await query(`
            SELECT 
                r.id,
                r.lagnname as agent,
                r.client_name as prospect,
                r.true_ref,
                r.created_at as date,
                r.updated_at,
                r.existing_policy,
                r.trial,
                r.zip_code,
                r.notes,
                r.sa,
                r.ga,
                r.mga,
                r.rga,
                CASE 
                    WHEN r.true_ref = 'Y' THEN 'conversion'
                    WHEN r.true_ref = 'N' THEN 'rejection'
                    WHEN r.updated_at > r.created_at AND r.true_ref IS NULL THEN 'update'
                    ELSE 'new_ref'
                END as type
            FROM refvalidation r
            ${whereClause}
            ORDER BY r.updated_at DESC, r.created_at DESC
            LIMIT ?
        `, [...params, parseInt(limit)]);

        res.json({ success: true, data: activities });
    } catch (error) {
        console.error("Error fetching REF activity:", error);
        res.status(500).json({ success: false, message: "Failed to fetch REF activity" });
    }
});

// GET /api/ref-report/charts - Get chart data for REF trends
router.get("/charts", async (req, res) => {
    const { 
        hierarchy_level, 
        team, 
        agent_id, 
        start_date, 
        end_date,
        chart_type = 'daily' 
    } = req.query;
    
    try {
        let whereClause = "WHERE 1=1";
        let params = [];
        
        // Date filtering - prioritize start_date/end_date for custom date ranges
        if (start_date && end_date) {
            whereClause += " AND DATE(r.created_at) BETWEEN ? AND ?";
            params.push(start_date, end_date);
        } else {
            // Default to current month if no dates provided
            whereClause += " AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
        }
        
        // Agent filtering
        if (agent_id && agent_id !== 'all') {
            whereClause += " AND r.agent_id = ?";
            params.push(agent_id);
        }
        
        // Hierarchical team filtering
        if (hierarchy_level && hierarchy_level !== 'all' && team && team !== 'all') {
            switch (hierarchy_level) {
                case 'sa':
                    whereClause += " AND (r.sa = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
                case 'ga':
                    whereClause += " AND (r.ga = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
                case 'mga':
                    whereClause += " AND (r.mga = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
            }
        }

        const chartsQuery = `
            SELECT 
                DATE(r.created_at) as date,
                COUNT(*) as total_refs,
                COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs,
                COUNT(CASE WHEN r.true_ref = 'N' THEN 1 END) as rejected_refs,
                COUNT(CASE WHEN r.true_ref IS NULL OR r.true_ref = '' THEN 1 END) as pending_refs,
                ROUND(
                    (COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) * 100.0 / 
                     NULLIF(COUNT(*), 0)), 1
                ) as conversion_rate
            FROM refvalidation r
            ${whereClause}
            GROUP BY DATE(r.created_at)
            ORDER BY DATE(r.created_at) ASC
        `;

        const chartData = await query(chartsQuery, params);

        // Format dates for better display
        const formattedChartData = chartData.map(row => ({
            ...row,
            date: row.date ? new Date(row.date).toISOString().split('T')[0] : null,
            dateDisplay: row.date ? new Date(row.date).toLocaleDateString() : ''
        }));

        res.json({ 
            success: true, 
            data: {
                chart_data: formattedChartData,
                period_type: 'daily',
                date_range: { start_date, end_date },
                filters: {
                    hierarchy_level,
                    team,
                    agent_id
                }
            }
        });
    } catch (error) {
        console.error("Error fetching REF charts data:", error);
        res.status(500).json({ success: false, message: "Failed to fetch REF charts data" });
    }
});

// GET /api/ref-report/leaderboard - Get leaderboard data for REF report
router.get("/leaderboard", async (req, res) => {
    const { 
        date_range = 'current-month', 
        start_date,
        end_date,
        hierarchy_level, 
        team, 
        sort_by = 'true_refs' // 'true_refs', 'total_refs', 'conversion_rate'
    } = req.query;
    

    
    try {
        let whereClause = "WHERE 1=1";
        let params = [];
        
        // Date filtering - prioritize start_date/end_date over date_range
        if (start_date && end_date) {
            whereClause += " AND DATE(r.created_at) BETWEEN ? AND ?";
            params.push(start_date, end_date);
        } else if (date_range) {
            // Fallback to old date_range format
            switch (date_range) {
                case 'current-week':
                    whereClause += " AND DATE(r.created_at) >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
                    break;
                case 'current-month':
                    whereClause += " AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
                case 'last-month':
                    whereClause += " AND MONTH(r.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(r.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))";
                    break;
                case 'quarter':
                    whereClause += " AND QUARTER(r.created_at) = QUARTER(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
                case 'year':
                    whereClause += " AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
            }
        }
        
        // Hierarchical team filtering (only if specific team selected)
        if (hierarchy_level && hierarchy_level !== 'all' && team && team !== 'all') {
            switch (hierarchy_level) {
                case 'sa':
                    whereClause += " AND (r.sa = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
                case 'ga':
                    whereClause += " AND (r.ga = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
                case 'mga':
                    whereClause += " AND (r.mga = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
            }
        }

        let leaderboardQuery;
        let groupByClause;
        let selectClause;

        if (hierarchy_level && hierarchy_level !== 'all') {
            // If a specific team is selected, show individual agents under that team
            if (team && team !== 'all') {
                // Show individual agents under the selected team leader
                const hierarchyColumn = hierarchy_level; // 'sa', 'ga', or 'mga'
                
                selectClause = `
                    SELECT 
                        r.lagnname as name,
                        r.lagnname as raw_name,
                        MAX(au.profpic) as profile_picture,
                        MAX(COALESCE(au.clname, 'AGENT')) as clname,
                        GROUP_CONCAT(DISTINCT 
                            CASE 
                                WHEN r.mga IS NOT NULL AND r.mga != '' 
                                THEN SUBSTRING_INDEX(r.mga, ' ', 1)
                                ELSE NULL 
                            END 
                            ORDER BY SUBSTRING_INDEX(r.mga, ' ', 1) SEPARATOR '/'
                        ) as mga,
                        CASE 
                            WHEN r.lagnname = '${team}' THEN '${hierarchy_level.toUpperCase()}'
                            ELSE 'AGENT'
                        END as level,
                        COUNT(*) as total_refs,
                        COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs,
                        COUNT(CASE WHEN r.true_ref = 'N' THEN 1 END) as rejected_refs,
                        COUNT(CASE WHEN r.true_ref IS NULL OR r.true_ref = '' THEN 1 END) as pending_refs,
                        ROUND(
                            (COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) * 100.0 / 
                             NULLIF(COUNT(CASE WHEN r.true_ref IS NOT NULL AND r.true_ref != '' THEN 1 END), 0)), 1
                        ) as conversion_rate,
                        1 as agent_count
                    FROM refvalidation r
                    LEFT JOIN activeusers au ON r.lagnname = au.lagnname
                `;
                
                groupByClause = `GROUP BY r.lagnname`;
            } else {
                // Team-level aggregation - sum REFs for users where they either created the REF or lead the team
                const hierarchyColumn = hierarchy_level; // 'sa', 'ga', or 'mga'
                
                selectClause = `
                    SELECT 
                        au.lagnname as name,
                        au.lagnname as raw_name,
                        au.profpic as profile_picture,
                        au.clname,
                        GROUP_CONCAT(DISTINCT 
                            CASE 
                                WHEN r.mga IS NOT NULL AND r.mga != '' 
                                THEN SUBSTRING_INDEX(r.mga, ' ', 1)
                                ELSE NULL 
                            END 
                            ORDER BY SUBSTRING_INDEX(r.mga, ' ', 1) SEPARATOR '/'
                        ) as mga,
                        '${hierarchy_level.toUpperCase()}' as level,
                        COUNT(*) as total_refs,
                        COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs,
                        COUNT(CASE WHEN r.true_ref = 'N' THEN 1 END) as rejected_refs,
                        COUNT(CASE WHEN r.true_ref IS NULL OR r.true_ref = '' THEN 1 END) as pending_refs,
                        ROUND(
                            (COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) * 100.0 / 
                             NULLIF(COUNT(CASE WHEN r.true_ref IS NOT NULL AND r.true_ref != '' THEN 1 END), 0)), 1
                        ) as conversion_rate,
                        COUNT(DISTINCT CASE WHEN r.lagnname != au.lagnname THEN r.lagnname END) as agent_count
                    FROM activeusers au
                    INNER JOIN refvalidation r ON (
                        r.lagnname = au.lagnname OR r.${hierarchyColumn} = au.lagnname
                    )
                `;
                
                // Add filtering for users with matching clname
                const hierarchyFilter = `AND au.clname = '${hierarchy_level.toUpperCase()}'`;
                whereClause += ` ${hierarchyFilter}`;
                
                groupByClause = `GROUP BY au.lagnname, au.profpic, au.clname`;
            }
            
        } else {
            // Individual agent aggregation (when hierarchy_level is 'all' or not specified)
            selectClause = `
                SELECT 
                    r.lagnname as name,
                    r.lagnname as raw_name,
                    MAX(au.profpic) as profile_picture,
                    MAX(COALESCE(au.clname, 'AGENT')) as clname,
                    GROUP_CONCAT(DISTINCT 
                        CASE 
                            WHEN r.mga IS NOT NULL AND r.mga != '' 
                            THEN SUBSTRING_INDEX(r.mga, ' ', 1)
                            ELSE NULL 
                        END 
                        ORDER BY SUBSTRING_INDEX(r.mga, ' ', 1) SEPARATOR '/'
                    ) as mga,
                    'AGENT' as level,
                    COUNT(*) as total_refs,
                    COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs,
                    COUNT(CASE WHEN r.true_ref = 'N' THEN 1 END) as rejected_refs,
                    COUNT(CASE WHEN r.true_ref IS NULL OR r.true_ref = '' THEN 1 END) as pending_refs,
                    ROUND(
                        (COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) * 100.0 / 
                         NULLIF(COUNT(CASE WHEN r.true_ref IS NOT NULL AND r.true_ref != '' THEN 1 END), 0)), 1
                    ) as conversion_rate,
                    MAX(r.sa) as sa,
                    MAX(r.ga) as ga,
                    MAX(r.rga) as rga
                FROM refvalidation r
                LEFT JOIN activeusers au ON r.lagnname = au.lagnname
            `;
            
            groupByClause = `GROUP BY r.lagnname`;
        }

        leaderboardQuery = `
            ${selectClause}
            ${whereClause}
            ${groupByClause}
            HAVING COUNT(*) > 0
        `;

        let orderByClause;
        switch (sort_by) {
            case 'total_refs':
                orderByClause = " ORDER BY total_refs DESC, true_refs DESC";
                break;
            case 'conversion_rate':
                orderByClause = " ORDER BY conversion_rate DESC, true_refs DESC";
                break;
            case 'true_refs':
            default:
                orderByClause = " ORDER BY true_refs DESC, total_refs DESC";
                break;
        }

        const fullQuery = leaderboardQuery + orderByClause;
        const leaderboardData = await query(fullQuery, params);

        // Add rank to each item with tie handling
        const rankedData = addRanksWithTies(leaderboardData, 'true_refs');

        res.json({ 
            success: true, 
            data: rankedData,
            meta: {
                aggregation_type: hierarchy_level && hierarchy_level !== 'all' && (!team || team === 'all') ? 'team' : 'agent',
                hierarchy_level: hierarchy_level || 'all',
                specific_team: team && team !== 'all' ? team : null
            }
        });
    } catch (error) {
        console.error("Error fetching REF leaderboard:", error);
        res.status(500).json({ success: false, message: "Failed to fetch REF leaderboard" });
    }
});

// GET /api/ref-report/team-agents - Get agents within a specific team for expandable rows
router.get("/team-agents", async (req, res) => {
    const { 
        team_name,
        hierarchy_level,
        date_range = 'current-month',
        start_date,
        end_date,
        sort_by = 'true_refs'
    } = req.query;
    
    if (!team_name || !hierarchy_level) {
        return res.status(400).json({ 
            success: false, 
            message: "team_name and hierarchy_level are required" 
        });
    }
    
    try {
        let whereClause = "WHERE 1=1";
        let params = [];
        
        // Date filtering - prioritize start_date/end_date over date_range
        if (start_date && end_date) {
            whereClause += " AND DATE(r.created_at) BETWEEN ? AND ?";
            params.push(start_date, end_date);
        } else if (date_range) {
            // Fallback to old date_range format
            switch (date_range) {
                case 'current-week':
                    whereClause += " AND DATE(r.created_at) >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
                    break;
                case 'current-month':
                    whereClause += " AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
                case 'last-month':
                    whereClause += " AND MONTH(r.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(r.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))";
                    break;
                case 'quarter':
                    whereClause += " AND QUARTER(r.created_at) = QUARTER(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
                case 'year':
                    whereClause += " AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
            }
        }
        
        // Filter to show agents under the specified team leader AND the leader's own REFs
        const hierarchyColumn = hierarchy_level; // 'sa', 'ga', or 'mga'
        whereClause += ` AND (r.${hierarchyColumn} = ? OR r.lagnname = ?)`;
        params.push(team_name, team_name);


        // Simplified query: Find all agents where lagnname OR hierarchy_column = team_name
        // Combine all refs for same agent regardless of different MGA values
        const agentsQuery = `
            SELECT 
                r.lagnname as name,
                MAX(au.profpic) as profile_picture,
                MAX(COALESCE(au.clname, 'AGENT')) as clname,
                GROUP_CONCAT(DISTINCT 
                    CASE 
                        WHEN r.mga IS NOT NULL AND r.mga != '' 
                        THEN SUBSTRING_INDEX(r.mga, ' ', 1)
                        ELSE NULL 
                    END 
                    ORDER BY SUBSTRING_INDEX(r.mga, ' ', 1) SEPARATOR '/'
                ) as mga,
                COUNT(*) as total_refs,
                COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs,
                ROUND(
                    (COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) * 100.0 / 
                     NULLIF(COUNT(CASE WHEN r.true_ref IS NOT NULL AND r.true_ref != '' THEN 1 END), 0)), 1
                ) as conversion_rate
            FROM refvalidation r
            LEFT JOIN activeusers au ON r.lagnname = au.lagnname
            ${whereClause}
            AND r.lagnname IS NOT NULL 
            AND r.lagnname != ''
            AND LENGTH(r.lagnname) > 3
            GROUP BY r.lagnname
            HAVING COUNT(*) > 0
        `;

        let orderByClause;
        switch (sort_by) {
            case 'total_refs':
                orderByClause = " ORDER BY total_refs DESC, true_refs DESC";
                break;
            case 'conversion_rate':
                orderByClause = " ORDER BY conversion_rate DESC, true_refs DESC";
                break;
            case 'true_refs':
            default:
                orderByClause = " ORDER BY true_refs DESC, total_refs DESC";
                break;
        }

        const fullQuery = agentsQuery + orderByClause;
        const agentsData = await query(fullQuery, params);

        // Add rank to each agent within this team with tie handling
        const rankedAgents = addRanksWithTies(agentsData, 'true_refs').map((agent, index) => ({
            ...agent,
            team_rank: agent.rank // Use the tied rank for team rank as well
        }));

        // If no agents found, check if it's due to date filtering
        let meta = {
            team_name: team_name,
            hierarchy_level: hierarchy_level,
            agent_count: rankedAgents.length
        };

        if (rankedAgents.length === 0) {
            // Check if team has any data outside the date range
            const teamExistsQuery = `
                SELECT COUNT(*) as total_refs,
                       MIN(DATE(r.created_at)) as earliest_ref,
                       MAX(DATE(r.created_at)) as latest_ref
                FROM refvalidation r 
                WHERE (r.${hierarchy_level} = ? OR r.lagnname = ?)
            `;
            
            const teamExistsResult = await query(teamExistsQuery, [team_name, team_name]);
            
            if (teamExistsResult[0] && teamExistsResult[0].total_refs > 0) {
                meta.has_data_outside_range = true;
                meta.team_data_range = {
                    earliest: teamExistsResult[0].earliest_ref,
                    latest: teamExistsResult[0].latest_ref,
                    total_refs: teamExistsResult[0].total_refs
                };
                meta.message = `No agents found for ${team_name} in the selected date range (${start_date} to ${end_date}). This team has ${teamExistsResult[0].total_refs} refs from ${teamExistsResult[0].earliest_ref} to ${teamExistsResult[0].latest_ref}.`;
            } else {
                meta.has_data_outside_range = false;
                meta.message = `No data found for team ${team_name}.`;
            }
        }

        res.json({ 
            success: true, 
            data: rankedAgents,
            meta: meta
        });
    } catch (error) {
        console.error("Error fetching team agents:", error);
        res.status(500).json({ success: false, message: "Failed to fetch team agents" });
    }
});

// GET /api/ref-report/agents - Get list of agents for filtering
router.get("/agents", async (req, res) => {
    try {
        const agents = await query(`
            SELECT DISTINCT 
                r.agent_id as id,
                r.lagnname as name,
                r.sa,
                r.ga,
                r.mga,
                r.rga,
                COUNT(*) as ref_count
            FROM refvalidation r
            WHERE r.agent_id IS NOT NULL
            GROUP BY r.agent_id, r.lagnname, r.sa, r.ga, r.mga, r.rga
            ORDER BY r.lagnname ASC
        `);

        res.json({ success: true, data: agents });
    } catch (error) {
        console.error("Error fetching REF agents:", error);
        res.status(500).json({ success: false, message: "Failed to fetch REF agents" });
    }
});

// GET /api/ref-report/date-options - Get available date range options based on actual data
router.get("/date-options", async (req, res) => {
    const { range_type = 'month' } = req.query; // 'week', 'month', 'year'
    
    try {
        let options = [];
        const today = new Date();

        // First, get all unique dates from refvalidation table
        const datesQuery = `
            SELECT DISTINCT DATE(created_at) as ref_date
            FROM refvalidation 
            WHERE created_at IS NOT NULL
            ORDER BY ref_date DESC
        `;
        
        const availableDates = await query(datesQuery);
        
        if (availableDates.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // Convert to Date objects for processing
        const dates = availableDates.map(row => new Date(row.ref_date + 'T00:00:00'));

        if (range_type === 'week') {
            // Group dates by weeks (Monday-Sunday)
            const weekGroups = new Map();
            
            dates.forEach(date => {
                // Get Monday of the week for this date
                const monday = new Date(date);
                const dayOfWeek = monday.getDay(); // 0 = Sunday, 1 = Monday, etc.
                const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                monday.setDate(monday.getDate() + mondayOffset);
                
                const mondayKey = monday.toISOString().split('T')[0];
                
                if (!weekGroups.has(mondayKey)) {
                    const sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);
                    
                    // Format as M/D/YY-M/D/YY
                    const mondayFormatted = monday.toLocaleDateString("en-US", { 
                        month: "numeric", 
                        day: "numeric", 
                        year: "2-digit" 
                    });
                    const sundayFormatted = sunday.toLocaleDateString("en-US", { 
                        month: "numeric", 
                        day: "numeric", 
                        year: "2-digit" 
                    });
                    
                    weekGroups.set(mondayKey, {
                        value: mondayKey,
                        label: `${mondayFormatted}-${sundayFormatted}`,
                        range_key: 'current-week',
                        monday: monday,
                        sunday: sunday
                    });
                }
            });

            // Convert to array and sort by Monday date (newest first)
            options = Array.from(weekGroups.values())
                .sort((a, b) => b.monday.getTime() - a.monday.getTime())
                .map(week => ({
                    value: week.value,
                    label: week.label,
                    range_key: week.range_key
                }));

        } else if (range_type === 'month') {
            // Group dates by months
            const monthGroups = new Map();
            
            dates.forEach(date => {
                const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
                const monthKey = monthStart.toISOString().split('T')[0];
                
                if (!monthGroups.has(monthKey)) {
                    const label = monthStart.toLocaleDateString("en-US", { 
                        month: "long", 
                        year: "numeric" 
                    });
                    
                    // Determine range_key
                    let range_key = 'custom';
                    if (monthStart.getMonth() === today.getMonth() && monthStart.getFullYear() === today.getFullYear()) {
                        range_key = 'current-month';
                    } else if (monthStart.getMonth() === today.getMonth() - 1 && monthStart.getFullYear() === today.getFullYear()) {
                        range_key = 'last-month';
                    } else if (monthStart.getMonth() === today.getMonth() + 11 && monthStart.getFullYear() === today.getFullYear() - 1) {
                        range_key = 'last-month'; // December of previous year when current month is January
                    }
                    
                    monthGroups.set(monthKey, {
                        value: monthKey,
                        label: label,
                        range_key: range_key,
                        date: monthStart
                    });
                }
            });

            // Convert to array and sort by date (newest first)
            options = Array.from(monthGroups.values())
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .map(month => ({
                    value: month.value,
                    label: month.label,
                    range_key: month.range_key
                }));

        } else if (range_type === 'year') {
            // Group dates by years
            const yearGroups = new Map();
            
            dates.forEach(date => {
                const year = date.getFullYear();
                const yearStart = new Date(year, 0, 1);
                const yearKey = yearStart.toISOString().split('T')[0];
                
                if (!yearGroups.has(yearKey)) {
                    yearGroups.set(yearKey, {
                        value: yearKey,
                        label: `${year}`,
                        range_key: year === today.getFullYear() ? 'year' : 'custom',
                        year: year
                    });
                }
            });

            // Convert to array and sort by year (newest first)
            options = Array.from(yearGroups.values())
                .sort((a, b) => b.year - a.year)
                .map(year => ({
                    value: year.value,
                    label: year.label,
                    range_key: year.range_key
                }));
        }

        res.json({ success: true, data: options });
    } catch (error) {
        console.error("Error fetching date options:", error);
        res.status(500).json({ success: false, message: "Failed to fetch date options" });
    }
});

// GET /api/ref-report/teams - Get teams based on hierarchy level from activeusers
router.get("/teams", async (req, res) => {
    const { hierarchy_level, date_range, start_date, end_date } = req.query;
    
    try {
        let teams = [];
        
        // Build date filtering for refvalidation checks
        let dateFilter = "";
        let dateParams = [];
        
        if (start_date && end_date) {
            dateFilter = " AND DATE(r.created_at) BETWEEN ? AND ?";
            dateParams = [start_date, end_date];
        } else if (date_range) {
            switch (date_range) {
                case 'current-week':
                    dateFilter = " AND DATE(r.created_at) >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
                    break;
                case 'current-month':
                    dateFilter = " AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
                case 'last-month':
                    dateFilter = " AND MONTH(r.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(r.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))";
                    break;
                case 'quarter':
                    dateFilter = " AND QUARTER(r.created_at) = QUARTER(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
                case 'year':
                    dateFilter = " AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
            }
        } else {
            // Default to current month if no date filtering is provided
            dateFilter = " AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
        }
        
        if (hierarchy_level === 'all') {
            // Get all teams across all hierarchy levels
            const allTeams = await query(`
                SELECT DISTINCT au.lagnname as team_name, au.clname as level
                FROM activeusers au
                WHERE au.clname IN ('SA', 'GA', 'MGA', 'RGA') 
                AND au.Active = 'y'
                AND EXISTS (
                    SELECT 1 FROM refvalidation r 
                    WHERE (
                        (au.clname = 'SA' AND (r.sa = au.lagnname OR r.lagnname = au.lagnname)) OR
                        (au.clname = 'GA' AND (r.ga = au.lagnname OR r.lagnname = au.lagnname)) OR
                        (au.clname IN ('MGA', 'RGA') AND (r.mga = au.lagnname OR r.lagnname = au.lagnname))
                    )${dateFilter}
                )
                ORDER BY au.clname DESC, au.lagnname ASC
            `, dateParams);
            teams = allTeams;
        } else {
            // Get teams for specific hierarchy level
            const hierarchyMap = {
                'sa': 'SA',
                'ga': 'GA', 
                'mga': 'MGA'
            };
            
            const clname = hierarchyMap[hierarchy_level];
            if (!clname) {
                return res.status(400).json({ success: false, message: "Invalid hierarchy level" });
            }
            
            // Special handling for MGA level - include both MGA and RGA teams
            if (hierarchy_level === 'mga') {
                const mgaTeams = await query(`
                    SELECT DISTINCT au.lagnname as team_name, au.clname as level
                    FROM activeusers au
                    WHERE au.clname IN ('MGA', 'RGA')
                    AND au.Active = 'y'
                    AND EXISTS (
                        SELECT 1 FROM refvalidation r 
                        WHERE (r.mga = au.lagnname OR r.lagnname = au.lagnname)${dateFilter}
                    )
                    
                    UNION
                    
                    SELECT DISTINCT m.lagnname as team_name, 
                           CASE 
                               WHEN m.rga IS NOT NULL AND m.rga != '' THEN 'RGA'
                               ELSE 'MGA'
                           END as level
                    FROM MGAs m
                    INNER JOIN activeusers au ON m.lagnname = au.lagnname
                    WHERE m.active = 'y' 
                    AND m.hide = 'n'
                    AND au.Active = 'y'
                    AND NOT EXISTS (
                        SELECT 1 FROM refvalidation r 
                        WHERE (r.mga = m.lagnname OR r.lagnname = m.lagnname)${dateFilter}
                    )
                    
                    ORDER BY level DESC, team_name ASC
                `, [...dateParams, ...dateParams]);
                
                teams = mgaTeams;
            } else {
                const hierarchyTeams = await query(`
                    SELECT DISTINCT au.lagnname as team_name, au.clname as level
                    FROM activeusers au
                    WHERE au.clname = ? 
                    AND au.Active = 'y'
                    AND EXISTS (
                        SELECT 1 FROM refvalidation r 
                        WHERE (r.${hierarchy_level} = au.lagnname OR r.lagnname = au.lagnname)${dateFilter}
                    )
                    ORDER BY au.lagnname ASC
                `, [clname, ...dateParams]);
                
                teams = hierarchyTeams;
            }
        }

        res.json({ success: true, data: teams });
    } catch (error) {
        console.error("Error fetching REF teams:", error);
        res.status(500).json({ success: false, message: "Failed to fetch REF teams" });
    }
});

// GET /api/ref-report/details - Get detailed REF data with pagination
router.get("/details", async (req, res) => {
    const { 
        page = 1, 
        limit = 50, 
        date_range, 
        hierarchy_level,
        team,
        agent_id, 
        status, 
        search,
        sort_by = 'created_at',
        sort_order = 'DESC'
    } = req.query;
    
    try {
        let whereClause = "WHERE 1=1";
        let params = [];
        
        // Date filtering - using DATE() to focus on yyyy-mm-dd part only
        if (date_range) {
            switch (date_range) {
                case 'current-week':
                    whereClause += " AND DATE(r.created_at) >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
                    break;
                case 'current-month':
                    whereClause += " AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
                    break;
                case 'last-month':
                    whereClause += " AND MONTH(r.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(r.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))";
                    break;
            }
        }
        
        // Status filtering
        if (status) {
            switch (status) {
                case 'completed':
                    whereClause += " AND r.true_ref = 'Y'";
                    break;
                case 'rejected':
                    whereClause += " AND r.true_ref = 'N'";
                    break;
                case 'pending':
                    whereClause += " AND (r.true_ref IS NULL OR r.true_ref = '')";
                    break;
            }
        }
        
        // Agent filtering
        if (agent_id && agent_id !== 'all') {
            whereClause += " AND r.agent_id = ?";
            params.push(agent_id);
        }
        
        // Hierarchical team filtering
        if (hierarchy_level && hierarchy_level !== 'all' && team && team !== 'all') {
            switch (hierarchy_level) {
                case 'sa':
                    whereClause += " AND (r.sa = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
                case 'ga':
                    whereClause += " AND (r.ga = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
                case 'mga':
                    whereClause += " AND (r.mga = ? OR r.lagnname = ?)";
                    params.push(team, team);
                    break;
            }
        }
        
        // Search filtering
        if (search) {
            whereClause += " AND (r.client_name LIKE ? OR r.lagnname LIKE ? OR r.notes LIKE ?)";
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total
            FROM refvalidation r
            ${whereClause}
        `;
        const totalResult = await query(countQuery, params);
        const total = totalResult[0].total;

        // Get paginated data
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const validSortColumns = ['created_at', 'updated_at', 'lagnname', 'client_name', 'true_ref'];
        const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
        const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const detailsQuery = `
            SELECT 
                r.id,
                r.lagnname as agent_name,
                r.agent_id,
                r.client_name,
                r.zip_code,
                r.existing_policy,
                r.trial,
                r.true_ref as status,
                r.ref_detail,
                r.notes,
                r.created_at,
                r.updated_at,
                r.date_app_checked,
                r.admin_name,
                r.sa,
                r.ga,
                r.mga,
                r.rga,
                CASE 
                    WHEN r.true_ref = 'Y' THEN 'Completed'
                    WHEN r.true_ref = 'N' THEN 'Rejected'
                    ELSE 'Pending'
                END as status_label
            FROM refvalidation r
            ${whereClause}
            ORDER BY r.${sortColumn} ${sortDir}
            LIMIT ? OFFSET ?
        `;

        const details = await query(detailsQuery, [...params, parseInt(limit), offset]);

        res.json({ 
            success: true, 
            data: {
                refs: details,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error("Error fetching REF details:", error);
        res.status(500).json({ success: false, message: "Failed to fetch REF details" });
    }
});

// GET /api/ref-report/debug-query - Debug endpoint to test query differences
router.get("/debug-query", async (req, res) => {
    const { team_name = 'LESNIKOVSKY LEO E', hierarchy_level = 'sa', start_date, end_date } = req.query;
    
    try {
        
        let whereClause = "WHERE 1=1";
        let params = [];
        
        // Same date filtering as both endpoints
        if (start_date && end_date) {
            whereClause += " AND DATE(r.created_at) BETWEEN ? AND ?";
            params.push(start_date, end_date);
        } else {
            whereClause += " AND MONTH(r.created_at) = MONTH(CURDATE()) AND YEAR(r.created_at) = YEAR(CURDATE())";
        }
        
        // Test 1: Main leaderboard style query - CORRECTED to use exact same structure
        const leaderboardQuery = `
            SELECT 
                au.lagnname as name,
                au.lagnname as raw_name,
                '${hierarchy_level.toUpperCase()}' as level,
                COUNT(*) as total_refs,
                COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs,
                'LEADERBOARD' as query_type
            FROM activeusers au
            INNER JOIN refvalidation r ON (
                r.lagnname = au.lagnname OR r.${hierarchy_level} = au.lagnname
            )
            ${whereClause} AND au.clname = '${hierarchy_level.toUpperCase()}'
            AND au.lagnname = ?
            GROUP BY au.lagnname, au.profpic, au.clname
            HAVING COUNT(*) > 0
        `;
        
        const leaderboardResult = await query(leaderboardQuery, [...params, team_name]);
        
        // Test 2: Team-agents style query - CORRECTED to use exact same structure
        const teamAgentsQuery = `
            SELECT 
                r.lagnname as name,
                r.lagnname as raw_name,
                CASE 
                    WHEN r.lagnname = ? THEN '${hierarchy_level.toUpperCase()}'
                    ELSE 'AGENT'
                END as level,
                COUNT(*) as total_refs,
                COUNT(CASE WHEN r.true_ref = 'Y' THEN 1 END) as true_refs,
                'TEAM_AGENTS' as query_type
            FROM refvalidation r
            LEFT JOIN activeusers au ON r.lagnname = au.lagnname
            ${whereClause} AND (r.${hierarchy_level} = ? ${hierarchy_level === 'mga' ? 'OR r.rga = ? ' : ''}OR r.lagnname = ?)
            GROUP BY r.lagnname, au.profpic, au.clname
            HAVING COUNT(*) > 0
        `;
        
        const teamAgentsResult = await query(teamAgentsQuery, [...params, team_name, team_name, team_name]);
        
        // Test 3: Raw data check
        const rawDataQuery = `
            SELECT r.lagnname, r.${hierarchy_level}, r.created_at, r.true_ref
            FROM refvalidation r 
            WHERE (r.${hierarchy_level} = ? OR r.lagnname = ?)
            ORDER BY r.created_at DESC
            LIMIT 10
        `;
        
        const rawDataResult = await query(rawDataQuery, [team_name, team_name]);
        
        res.json({
            success: true,
            debug: {
                team_name,
                hierarchy_level,
                date_filter: { start_date, end_date },
                comparison: {
                    leaderboard_count: leaderboardResult.length,
                    team_agents_count: teamAgentsResult.length,
                    raw_data_count: rawDataResult.length
                },
                leaderboard_result: leaderboardResult,
                team_agents_result: teamAgentsResult,
                raw_data_sample: rawDataResult,
                queries: {
                    leaderboard: leaderboardQuery,
                    team_agents: teamAgentsQuery,
                    raw_data: rawDataQuery
                }
            }
        });
        
    } catch (error) {
        console.error("Error in debug query:", error);
        res.status(500).json({ success: false, message: "Debug query failed", error: error.message });
    }
});

module.exports = router; 