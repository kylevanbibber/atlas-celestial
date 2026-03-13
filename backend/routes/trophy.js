const express = require('express');
const router = express.Router();
const { pool, query } = require('../db');
const verifyToken = require('../middleware/verifyToken');

// Apply authentication middleware to all routes
router.use(verifyToken);

// Helper function to get user info with proper fallback
const getUserInfo = async (req) => {
    if (req.user && req.user.userId) {
        try {
            const user = await query("SELECT lagnname FROM activeusers WHERE id = ?", [req.user.userId]);
            return user.length > 0 ? user[0] : null;
        } catch (error) {
            console.warn("Could not get user info:", error);
            return null;
        }
    }
    
    // For development - find any existing user or use NULL
    try {
        const existingUser = await query("SELECT id, lagnname FROM activeusers LIMIT 1");
        return existingUser.length > 0 ? existingUser[0] : null;
    } catch (error) {
        console.warn("Could not determine user info, using NULL");
        return null;
    }
};

// GET /api/trophy/trophy-case - Get authenticated user's trophy case data
router.get('/trophy-case', async (req, res) => {
    try {
        const userInfo = await getUserInfo(req);
        
        if (!userInfo || !userInfo.lagnname) {
            return res.status(400).json({ success: false, message: 'User not found or missing agent name' });
        }

        const results = await query(`
            SELECT 
                LagnName,
                LVL_1_NET,
                LVL_2_NET,
                LVL_3_NET,
                MGA_NAME,
                CL_Name,
                month,
                REPORT
            FROM Monthly_ALP 
            WHERE LagnName = ? 
            AND REPORT = 'MONTH RECAP'
            ORDER BY month DESC
        `, [userInfo.lagnname]);

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching trophy case data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch trophy case data' });
    }
});

// GET /api/trophy/all-trophy-case - Get all trophy case data for rankings
router.get('/all-trophy-case', async (req, res) => {
    try {
        const results = await query(`
            SELECT 
                LagnName,
                LVL_1_NET,
                LVL_2_NET,
                LVL_3_NET,
                MGA_NAME,
                CL_Name,
                month,
                REPORT
            FROM Monthly_ALP 
            WHERE REPORT = 'MONTH RECAP'
            ORDER BY month DESC, LagnName
        `);

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching all trophy case data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch all trophy case data' });
    }
});

// GET /api/trophy/weekly-trophy-case - Get authenticated user's weekly trophy case data
router.get('/weekly-trophy-case', async (req, res) => {
    try {
        const userInfo = await getUserInfo(req);
        
        if (!userInfo || !userInfo.lagnname) {
            return res.status(400).json({ success: false, message: 'User not found or missing agent name' });
        }

        const results = await query(`
            SELECT 
                LagnName,
                LVL_1_NET,
                LVL_2_NET,
                LVL_3_NET,
                MGA_NAME,
                CL_Name,
                reportdate,
                REPORT
            FROM Weekly_ALP 
            WHERE LagnName = ? 
            AND REPORT = 'Weekly Recap'
            ORDER BY reportdate DESC
        `, [userInfo.lagnname]);

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching weekly trophy case data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch weekly trophy case data' });
    }
});

// GET /api/trophy/all-weekly-trophy-case - Get all users' weekly trophy case data for rankings
router.get('/all-weekly-trophy-case', async (req, res) => {
    try {
        const results = await query(`
            SELECT 
                LagnName,
                LVL_1_NET,
                LVL_2_NET,
                LVL_3_NET,
                MGA_NAME,
                CL_Name,
                reportdate,
                REPORT
            FROM Weekly_ALP 
            WHERE REPORT = 'Weekly Recap'
            ORDER BY reportdate DESC, LagnName
        `);

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching all weekly trophy case data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch all weekly trophy case data' });
    }
});

// GET /api/trophy/trophy-case/:lagnname - Get trophy case data for a specific user by lagnname
router.get('/trophy-case/:lagnname', async (req, res) => {
    try {
        const { lagnname } = req.params;
        
        if (!lagnname) {
            return res.status(400).json({ success: false, message: 'Lagnname parameter is required' });
        }

        const results = await query(`
            SELECT 
                LagnName,
                LVL_1_NET,
                LVL_2_NET,
                LVL_3_NET,
                MGA_NAME,
                CL_Name,
                month,
                REPORT
            FROM Monthly_ALP 
            WHERE LagnName = ? 
            AND REPORT = 'MONTH RECAP'
            ORDER BY month DESC
        `, [lagnname]);

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching trophy case data for user:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch trophy case data' });
    }
});

// GET /api/trophy/weekly-trophy-case/:lagnname - Get weekly trophy case data for a specific user by lagnname
router.get('/weekly-trophy-case/:lagnname', async (req, res) => {
    try {
        const { lagnname } = req.params;
        
        if (!lagnname) {
            return res.status(400).json({ success: false, message: 'Lagnname parameter is required' });
        }

        const results = await query(`
            SELECT 
                LagnName,
                LVL_1_NET,
                LVL_2_NET,
                LVL_3_NET,
                MGA_NAME,
                CL_Name,
                reportdate,
                REPORT
            FROM Weekly_ALP 
            WHERE LagnName = ? 
            AND REPORT = 'Weekly Recap'
            ORDER BY reportdate DESC
        `, [lagnname]);

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching weekly trophy case data for user:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch weekly trophy case data' });
    }
});

// GET /api/trophy/wall-of-fame/:lagnname - Get Wall of Fame data for a specific user by lagnname
router.get('/wall-of-fame/:lagnname', async (req, res) => {
    try {
        const { lagnname } = req.params;
        
        if (!lagnname) {
            return res.status(400).json({ success: false, message: 'Lagnname parameter is required' });
        }

        const results = await query(`
            SELECT 
                LagnName,
                LVL_1_NET,
                LVL_2_NET,
                LVL_3_NET,
                MGA_NAME,
                CL_Name,
                reportdate,
                REPORT
            FROM Weekly_ALP 
            WHERE LagnName = ?
            AND REPORT = 'Weekly Recap'
            AND (
                CAST(REPLACE(REPLACE(REPLACE(LVL_1_NET, '$', ''), ',', ''), '(', '-') AS DECIMAL(10,2)) >= 8000
                OR CAST(REPLACE(REPLACE(REPLACE(LVL_2_NET, '$', ''), ',', ''), '(', '-') AS DECIMAL(10,2)) >= 8000
                OR CAST(REPLACE(REPLACE(REPLACE(LVL_3_NET, '$', ''), ',', ''), '(', '-') AS DECIMAL(10,2)) >= 8000
            )
            ORDER BY reportdate DESC
        `, [lagnname]);

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching wall of fame data for user:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch wall of fame data' });
    }
});

// GET /api/trophy/wall-of-fame - Get authenticated user's Wall of Fame data (weeks with $8,000+ net ALP)
router.get('/wall-of-fame', async (req, res) => {
    try {
        const userInfo = await getUserInfo(req);
        
        if (!userInfo || !userInfo.lagnname) {
            return res.status(400).json({ success: false, message: 'User not found or missing agent name' });
        }

        const results = await query(`
            SELECT 
                LagnName,
                LVL_1_NET,
                LVL_2_NET,
                LVL_3_NET,
                MGA_NAME,
                CL_Name,
                reportdate,
                REPORT
            FROM Weekly_ALP 
            WHERE LagnName = ? 
            AND REPORT = 'Weekly Recap'
            ORDER BY reportdate DESC
        `, [userInfo.lagnname]);

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching Wall of Fame data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch Wall of Fame data' });
    }
});

// GET /api/trophy/club-leaderboards - Get club qualification counts for all agents
router.get('/club-leaderboards', async (req, res) => {
    try {
        const { view = 'personal', year, experience } = req.query; // 'personal' or 'team', year filter, experience filter
        
        console.log(`📊 [Club Leaderboards] Fetching data for ${view} view, year: ${year || 'all'}, experience: ${experience || 'all'}...`);
        
        // Build year filter for queries
        let monthlyYearFilter = '';
        let weeklyYearFilter = '';
        
        if (year) {
            // For Monthly_ALP, month is in format "MM/YYYY" or "Month YYYY"
            monthlyYearFilter = ` AND (month LIKE '%/${year}' OR month LIKE '% ${year}')`;
            // For Weekly_ALP, reportdate is a date field
            weeklyYearFilter = ` AND YEAR(reportdate) = ${parseInt(year)}`;
        }
        
        // Get all Monthly_ALP records
        const monthlyResults = await query(`
            SELECT 
                LagnName,
                LVL_1_NET,
                LVL_2_NET,
                LVL_3_NET,
                MGA_NAME,
                CL_Name,
                month,
                REPORT
            FROM Monthly_ALP 
            WHERE REPORT = 'MONTH RECAP'${monthlyYearFilter}
            ORDER BY month DESC, LagnName
        `);
        
        // Get all Weekly_ALP records for Wall of Fame
        const weeklyResults = await query(`
            SELECT 
                LagnName,
                LVL_1_NET,
                LVL_2_NET,
                LVL_3_NET,
                reportdate,
                REPORT
            FROM Weekly_ALP 
            WHERE REPORT = 'Weekly Recap'${weeklyYearFilter}
            ORDER BY reportdate DESC, LagnName
        `);
        
        // Get activeusers data for profile pictures and additional info
        const activeUsers = await query(`
            SELECT 
                id,
                lagnname,
                profpic,
                clname,
                sa,
                ga,
                mga,
                rga,
                esid
            FROM activeusers
            WHERE Active = 'y'
        `);
        
        // Create a map for quick lookup and calculate experience
        const userMap = new Map();
        const now = new Date();
        activeUsers.forEach(user => {
            let isRookie = false;
            if (user.esid) {
                try {
                    const esidDate = new Date(user.esid);
                    const monthsDiff = (now - esidDate) / (1000 * 60 * 60 * 24 * 30.44);
                    isRookie = monthsDiff <= 6;
                } catch (e) {
                    // If can't parse esid, default to veteran
                }
            }
            
            userMap.set(user.lagnname, {
                id: user.id,
                profpic: user.profpic,
                clname: user.clname,
                sa: user.sa,
                ga: user.ga,
                mga: user.mga,
                rga: user.rga,
                isRookie: isRookie
            });
        });
        
        // Helper function to parse net value
        const parseNetValue = (value) => {
            if (!value) return 0;
            const numValue = parseFloat(String(value).replace(/[\$,()]/g, '').trim());
            return isNaN(numValue) ? 0 : numValue;
        };
        
        // Helper function to get net value based on view
        const getNetValue = (row) => {
            if (view === 'personal') {
                return parseNetValue(row.LVL_1_NET);
            } else {
                // For team view, use higher of LVL_2_NET or LVL_3_NET
                const lvl2 = parseNetValue(row.LVL_2_NET);
                const lvl3 = parseNetValue(row.LVL_3_NET);
                return Math.max(lvl2, lvl3);
            }
        };
        
        // Helper function to determine club based on net value and view
        const getClubName = (netValue) => {
            if (view === 'team') {
                if (netValue >= 200000) return 'Diamond';
                if (netValue >= 100000) return 'Platinum';
                if (netValue >= 50000) return 'Gold';
                if (netValue >= 35000) return 'Silver';
                if (netValue >= 25000) return 'Bronze';
            } else {
                if (netValue >= 100000) return 'Diamond';
                if (netValue >= 50000) return 'Platinum';
                if (netValue >= 25000) return 'Gold';
                if (netValue >= 20000) return 'Silver';
                if (netValue >= 15000) return 'Bronze';
            }
            return null;
        };
        
        // Count club qualifications for each agent
        const clubCounts = {};
        
        // Process monthly data for club counts
        monthlyResults.forEach(row => {
            const netValue = getNetValue(row);
            const clubName = getClubName(netValue);
            
            if (clubName) {
                if (!clubCounts[row.LagnName]) {
                    clubCounts[row.LagnName] = {
                        lagnname: row.LagnName,
                        Bronze: 0,
                        Silver: 0,
                        Gold: 0,
                        Platinum: 0,
                        Diamond: 0,
                        WallOfFame: 0
                    };
                }
                clubCounts[row.LagnName][clubName]++;
            }
        });
        
        // Process weekly data for Wall of Fame counts
        const weeklyMap = new Map(); // Deduplicate by LagnName + reportdate
        weeklyResults.forEach(row => {
            const key = `${row.LagnName}-${row.reportdate}`;
            if (!weeklyMap.has(key)) {
                const netValue = getNetValue(row);
                if (netValue >= 8000) {
                    weeklyMap.set(key, row);
                    
                    if (!clubCounts[row.LagnName]) {
                        clubCounts[row.LagnName] = {
                            lagnname: row.LagnName,
                            Bronze: 0,
                            Silver: 0,
                            Gold: 0,
                            Platinum: 0,
                            Diamond: 0,
                            WallOfFame: 0
                        };
                    }
                    clubCounts[row.LagnName].WallOfFame++;
                }
            }
        });
        
        // Convert to array and add user info
        let clubLeaderboards = Object.values(clubCounts).map(agent => {
            const userInfo = userMap.get(agent.lagnname);
            return {
                ...agent,
                userId: userInfo?.id || null,
                profpic: userInfo?.profpic || null,
                clname: userInfo?.clname || null,
                sa: userInfo?.sa || null,
                ga: userInfo?.ga || null,
                mga: userInfo?.mga || null,
                rga: userInfo?.rga || null,
                isRookie: userInfo?.isRookie || false,
                // Calculate total club entries
                totalClubEntries: agent.Bronze + agent.Silver + agent.Gold + agent.Platinum + agent.Diamond
            };
        });
        
        // Apply experience filter
        if (experience === 'rookie') {
            clubLeaderboards = clubLeaderboards.filter(agent => agent.isRookie);
            console.log(`📊 [Club Leaderboards] Filtered to ${clubLeaderboards.length} rookie agents`);
        } else if (experience === 'veteran') {
            clubLeaderboards = clubLeaderboards.filter(agent => !agent.isRookie);
            console.log(`📊 [Club Leaderboards] Filtered to ${clubLeaderboards.length} veteran agents`);
        }
        
        // Collect available years from monthly and weekly data
        const availableYears = new Set();
        
        monthlyResults.forEach(row => {
            if (row.month) {
                const yearMatch = row.month.match(/\d{4}/);
                if (yearMatch) {
                    availableYears.add(yearMatch[0]);
                }
            }
        });
        
        weeklyResults.forEach(row => {
            if (row.reportdate) {
                try {
                    const year = new Date(row.reportdate).getFullYear().toString();
                    availableYears.add(year);
                } catch (e) {
                    // Ignore invalid dates
                }
            }
        });
        
        const sortedYears = Array.from(availableYears).sort((a, b) => parseInt(b) - parseInt(a));
        
        console.log(`📊 [Club Leaderboards] Processed ${clubLeaderboards.length} agents with club qualifications`);
        console.log(`📊 [Club Leaderboards] Available years: ${sortedYears.join(', ')}`);
        
        res.json({ 
            success: true, 
            data: clubLeaderboards,
            view: view,
            availableYears: sortedYears
        });
    } catch (error) {
        console.error('Error fetching club leaderboards data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch club leaderboards data' });
    }
});

// GET /api/trophy/club-details/:lagnname/:clubName - Get detailed club entries for a specific agent and club
router.get('/club-details/:lagnname/:clubName', async (req, res) => {
    try {
        const { lagnname, clubName } = req.params;
        const { view = 'personal', year } = req.query;
        
        console.log(`📊 [Club Details] Fetching ${clubName} entries for ${lagnname}, view: ${view}, year: ${year || 'all'}`);
        
        // Build year filter
        let monthlyYearFilter = '';
        let weeklyYearFilter = '';
        
        if (year && year !== 'all') {
            monthlyYearFilter = ` AND (month LIKE '%/${year}' OR month LIKE '% ${year}')`;
            weeklyYearFilter = ` AND YEAR(reportdate) = ${parseInt(year)}`;
        }
        
        // Helper function to parse net value
        const parseNetValue = (value) => {
            if (!value) return 0;
            const numValue = parseFloat(String(value).replace(/[\$,()]/g, '').trim());
            return isNaN(numValue) ? 0 : numValue;
        };
        
        // Helper function to get net value based on view
        const getNetValue = (row) => {
            if (view === 'personal') {
                return parseNetValue(row.LVL_1_NET);
            } else {
                const lvl2 = parseNetValue(row.LVL_2_NET);
                const lvl3 = parseNetValue(row.LVL_3_NET);
                return Math.max(lvl2, lvl3);
            }
        };
        
        // Helper function to determine club thresholds
        const getClubThresholds = () => {
            if (view === 'team') {
                return {
                    'Diamond': 200000,
                    'Platinum': 100000,
                    'Gold': 50000,
                    'Silver': 35000,
                    'Bronze': 25000
                };
            } else {
                return {
                    'Diamond': 100000,
                    'Platinum': 50000,
                    'Gold': 25000,
                    'Silver': 20000,
                    'Bronze': 15000
                };
            }
        };
        
        const thresholds = getClubThresholds();
        const minThreshold = thresholds[clubName];
        
        if (!minThreshold) {
            // Handle Wall of Fame separately
            if (clubName === 'WallOfFame') {
                const weeklyResults = await query(`
                    SELECT 
                        LagnName,
                        LVL_1_NET,
                        LVL_2_NET,
                        LVL_3_NET,
                        reportdate,
                        REPORT
                    FROM Weekly_ALP 
                    WHERE LagnName = ?
                    AND REPORT = 'Weekly Recap'${weeklyYearFilter}
                    ORDER BY reportdate DESC
                `, [lagnname]);
                
                const entries = weeklyResults
                    .filter(row => getNetValue(row) >= 8000)
                    .map(row => ({
                        period: row.reportdate,
                        periodType: 'week',
                        netValue: getNetValue(row),
                        lvl1Net: parseNetValue(row.LVL_1_NET),
                        lvl2Net: parseNetValue(row.LVL_2_NET),
                        lvl3Net: parseNetValue(row.LVL_3_NET)
                    }));
                
                return res.json({
                    success: true,
                    data: {
                        lagnname,
                        clubName,
                        view,
                        entries
                    }
                });
            }
            
            return res.status(400).json({ success: false, message: 'Invalid club name' });
        }
        
        // Get monthly entries for this agent
        const monthlyResults = await query(`
            SELECT 
                LagnName,
                LVL_1_NET,
                LVL_2_NET,
                LVL_3_NET,
                MGA_NAME,
                CL_Name,
                month,
                REPORT
            FROM Monthly_ALP 
            WHERE LagnName = ?
            AND REPORT = 'MONTH RECAP'${monthlyYearFilter}
            ORDER BY month DESC
        `, [lagnname]);
        
        // Determine the max threshold for this club (to get the upper bound)
        const clubOrder = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
        const currentClubIndex = clubOrder.indexOf(clubName);
        const maxThreshold = currentClubIndex < clubOrder.length - 1 
            ? thresholds[clubOrder[currentClubIndex + 1]] 
            : Infinity;
        
        // Filter entries that qualify for this specific club
        const entries = monthlyResults
            .filter(row => {
                const netValue = getNetValue(row);
                return netValue >= minThreshold && netValue < maxThreshold;
            })
            .map(row => ({
                period: row.month,
                periodType: 'month',
                netValue: getNetValue(row),
                lvl1Net: parseNetValue(row.LVL_1_NET),
                lvl2Net: parseNetValue(row.LVL_2_NET),
                lvl3Net: parseNetValue(row.LVL_3_NET),
                mgaName: row.MGA_NAME,
                clName: row.CL_Name
            }));
        
        console.log(`📊 [Club Details] Found ${entries.length} ${clubName} entries for ${lagnname}`);
        
        res.json({
            success: true,
            data: {
                lagnname,
                clubName,
                view,
                threshold: minThreshold,
                entries
            }
        });
    } catch (error) {
        console.error('Error fetching club details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch club details' });
    }
});

module.exports = router;
