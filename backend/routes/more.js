// routes/more.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require('../middleware/authMiddleware');

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

router.get("/", async (req, res) => {
  try {
    const results = await db.query("SELECT * FROM amore_data ORDER BY MORE_Date DESC LIMIT 10");
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error("Error fetching more data:", error);
    return res.status(500).json({ 
      success: false,
      message: "Database error",
      error: error.message 
    });
  }
});

// Middleware to parse JSON bodies
router.use(express.json());

// Submit personal hires data
router.post('/submit-personal-hires', verifyToken, async (req, res) => {
    const personalHires = req.body;

    try {
        for (const hire of personalHires) {
            // Check for existing record based on recruitName and recruitEmail
            const checkQuery = 'SELECT * FROM PersonalHires WHERE recruitName = ? AND recruitEmail = ?';
            const checkValues = [hire.name, hire.email];
            const existingRecords = await db.query(checkQuery, checkValues);

            if (existingRecords.length > 0) {
                console.log('Duplicate personal hire detected, not inserting:', hire);
                continue; // Skip this record and move to the next one
            }

            // Proceed with insertion if no duplicate was found
            const values = [hire.name, hire.email, hire.agent, hire.mga];
            await db.query(`
                INSERT INTO PersonalHires (recruitName, recruitEmail, recruitAgent, MGA)
                VALUES (?, ?, ?, ?)
            `, values);
        }

        console.log('Personal hires successfully submitted:', personalHires);
        res.status(201).json({ 
            success: true, 
            message: 'Personal hires successfully submitted to PersonalHires table.' 
        });
    } catch (error) {
        console.error('Failed to submit personal hires data:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to submit personal hires data', 
            error: error.message 
        });
    }
});

// Update MORE data
router.post('/update-more-data', verifyToken, async (req, res) => {
    try {
        const { 
            MGA, 
            MORE_Date, 
            updates, 
            userRole, 
            on_time, 
            rga, 
            legacy, 
            tree 
        } = req.body;
        
        console.log('Body:', req.body);

        // Validate input
        if (!MGA || !MORE_Date || !updates) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing MGA, MORE_Date, or updates' 
            });
        }

        // Check if there is already a record for this MGA and MORE_Date
        const checkQuery = 'SELECT * FROM amore_data WHERE MGA = ? AND MORE_Date = ?';
        const existingRecords = await db.query(checkQuery, [MGA, MORE_Date]);

        if (existingRecords.length === 0) {
            console.log('No existing row found for MGA and MORE_Date. Creating a new row...');

            const defaultValues = {
                MGA,
                MORE_Date,
                userRole,
                on_time: on_time || false,
                External_Sets: 0,
                External_Shows: 0,
                Internal_Sets: 0,
                Internal_Shows: 0,
                Personal_Sets: 0,
                Personal_Shows: 0,
                Total_Set: 0,
                Total_Show: 0,
                Group_Invite: 0,
                Finals_Set: 0,
                Finals_Show: 0,
                Non_PR_Hires: 0,
                PR_Hires: 0,
                Total_Hires: 0,
                RGA: rga || null,
                Legacy: legacy || null,
                Tree: tree || null,
                Office: updates.Office || null,
                first_reported: new Date(),
                ...updates, // Allow updates to overwrite defaults
            };

            const insertQuery = `
                INSERT INTO amore_data (${Object.keys(defaultValues).join(', ')})
                VALUES (${Object.keys(defaultValues).map(() => '?').join(', ')})
            `;

            await db.query(insertQuery, Object.values(defaultValues));
            return res.status(201).json({ 
                success: true, 
                message: 'aMORE data created successfully' 
            });
        } else {
            console.log('Existing row found for MGA and MORE_Date. Updating row...');

            // Update the existing row with the new values
            const updateFields = Object.keys(updates)
                .map((field) => `${field} = ?`)
                .join(', ');
            const updateValues = Object.values(updates);

            const updateQuery = `
                UPDATE amore_data
                SET ${updateFields}, 
                    RGA = ?, 
                    Legacy = ?, 
                    Tree = ?, 
                    on_time = ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE MGA = ? AND MORE_Date = ?
            `;

            await db.query(updateQuery, [...updateValues, rga, legacy, tree, on_time, MGA, MORE_Date]);
            return res.status(200).json({ 
                success: true, 
                message: 'aMORE data updated successfully' 
            });
        }
    } catch (error) {
        console.error('Error updating aMORE data:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Fetch MORE data for specific MGA and date
router.get('/fetch-more-data/:mga/:date', verifyToken, async (req, res) => {
    const { mga, date } = req.params;

    try {
        // Query to check if data exists for the provided MGA and MORE_Date
        const checkQuery = 'SELECT * FROM amore_data WHERE MGA = ? AND MORE_Date = ?';
        const results = await db.query(checkQuery, [mga, date]);

        if (results.length > 0) {
            // If data exists, return the data
            return res.status(200).json({ 
                success: true, 
                data: results[0] 
            });
        } else {
            // If no data exists for the MGA and MORE_Date
            return res.status(200).json({
                success: false,
                message: `You have not reported this week for MGA: ${mga}, Date: ${date}`,
            });
        }
    } catch (error) {
        console.error('Error fetching aMORE data:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching aMORE data',
            error: error.message,
        });
    }
});

// Get all MORE data
router.get('/all-amore-data', verifyToken, async (req, res) => {
    try {
        const results = await db.query('SELECT * FROM amore_data ORDER BY MORE_Date DESC');
        res.json({ 
            success: true, 
            data: results 
        });
    } catch (error) {
        console.error('Failed to fetch all MORE data:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to retrieve all MORE data', 
            error: error.message 
        });
    }
});

// Get totals (MTD/YTD) for specific MGA
router.get('/get-totals', verifyToken, async (req, res) => {
    const { MGA } = req.query;

    if (!MGA) {
        return res.status(400).json({ 
            success: false, 
            message: 'MGA parameter is required' 
        });
    }

    try {
        // Get the current date
        const currentDate = new Date();

        // Calculate the first day of the current month
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

        // Calculate the first day of the current year
        const startOfYear = new Date(currentDate.getFullYear(), 0, 1);

        // Format dates as `yyyy-mm-dd` for SQL
        const formatDate = (date) =>
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const monthStart = formatDate(startOfMonth);
        const yearStart = formatDate(startOfYear);
        const today = formatDate(currentDate);

        // Query for MTD totals
        const mtdQuery = `
            SELECT 
                COALESCE(SUM(Total_Set), 0) AS Total_Sets, 
                COALESCE(SUM(Total_Show), 0) AS Total_Shows, 
                COALESCE(SUM(Total_Hires), 0) AS Total_Hires
            FROM amore_data 
            WHERE MGA = ? AND MORE_Date BETWEEN ? AND ?
        `;

        // Query for YTD totals
        const ytdQuery = `
            SELECT 
                COALESCE(SUM(Total_Set), 0) AS Total_Sets, 
                COALESCE(SUM(Total_Show), 0) AS Total_Shows, 
                COALESCE(SUM(Total_Hires), 0) AS Total_Hires
            FROM amore_data 
            WHERE MGA = ? AND MORE_Date BETWEEN ? AND ?
        `;

        // Execute the queries
        const mtdResults = await db.query(mtdQuery, [MGA, monthStart, today]);
        const ytdResults = await db.query(ytdQuery, [MGA, yearStart, today]);

        // Send the response
        res.status(200).json({
            success: true,
            mtd: mtdResults[0] || { Total_Sets: 0, Total_Shows: 0, Total_Hires: 0 },
            ytd: ytdResults[0] || { Total_Sets: 0, Total_Shows: 0, Total_Hires: 0 },
        });
    } catch (error) {
        console.error('Error fetching MTD/YTD totals:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching totals',
            error: error.message,
        });
    }
});

// Get aggregated leaderboard data
router.get('/leaderboard', verifyToken, async (req, res) => {
    try {
        const { 
            periodType = 'week', 
            periodValue, 
            hierarchyLevel = 'mga' 
        } = req.query;

        let whereClause = '';
        let queryParams = [];

        // Build where clause based on period type and value
        if (periodValue) {
            if (Array.isArray(periodValue)) {
                // Multiple period values
                const placeholders = periodValue.map(() => '?').join(',');
                if (periodType === 'week') {
                    whereClause = `WHERE MORE_Date IN (${placeholders})`;
                    queryParams = [...periodValue];
                } else if (periodType === 'month') {
                    whereClause = `WHERE DATE_FORMAT(MORE_Date, '%Y-%m') IN (${placeholders})`;
                    queryParams = [...periodValue];
                } else if (periodType === 'year') {
                    whereClause = `WHERE YEAR(MORE_Date) IN (${placeholders})`;
                    queryParams = [...periodValue];
                }
            } else {
                // Single period value
                if (periodType === 'week') {
                    whereClause = 'WHERE MORE_Date = ?';
                    queryParams = [periodValue];
                } else if (periodType === 'month') {
                    whereClause = 'WHERE DATE_FORMAT(MORE_Date, \'%Y-%m\') = ?';
                    queryParams = [periodValue];
                } else if (periodType === 'year') {
                    whereClause = 'WHERE YEAR(MORE_Date) = ?';
                    queryParams = [periodValue];
                }
            }
        }

        // Build query based on hierarchy level
        let query;
        let groupBy;
        
        if (hierarchyLevel === 'mga') {
            query = `
                SELECT 
                    MGA as name,
                    MGA,
                    SUM(Total_Hires) as Total_Hires,
                    SUM(PR_Hires) as PR_Hires,
                    SUM(Total_Set) as Total_Set,
                    SUM(Total_Show) as Total_Show,
                    SUM(Finals_Set) as Finals_Set,
                    SUM(Finals_Show) as Finals_Show,
                    'MGA' as clname
                FROM amore_data 
                ${whereClause}
                GROUP BY MGA
                ORDER BY Total_Hires DESC, Total_Set DESC
            `;
        } else if (hierarchyLevel === 'rga') {
            query = `
                SELECT 
                    RGA as name,
                    RGA,
                    MGA,
                    SUM(Total_Hires) as Total_Hires,
                    SUM(PR_Hires) as PR_Hires,
                    SUM(Total_Set) as Total_Set,
                    SUM(Total_Show) as Total_Show,
                    SUM(Finals_Set) as Finals_Set,
                    SUM(Finals_Show) as Finals_Show,
                    'RGA' as clname
                FROM amore_data 
                ${whereClause}
                GROUP BY RGA, MGA
                ORDER BY Total_Hires DESC, Total_Set DESC
            `;
        } else {
            // Default to individual MGA level
            query = `
                SELECT 
                    MGA as name,
                    MGA,
                    RGA,
                    Total_Hires,
                    PR_Hires,
                    Total_Set,
                    Total_Show,
                    Finals_Set,
                    Finals_Show,
                    userRole as clname,
                    MORE_Date
                FROM amore_data 
                ${whereClause}
                ORDER BY Total_Hires DESC, Total_Set DESC
            `;
        }

        const results = await db.query(query, queryParams);

        // Add rank to results with tie handling
        const rankedResults = addRanksWithTies(results, 'Total_Hires');

        res.json({
            success: true,
            data: rankedResults
        });
    } catch (error) {
        console.error('Error fetching leaderboard data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching leaderboard data',
            error: error.message
        });
    }
});

// Get unique filter values (periods, MGAs, RGAs, etc.)
router.get('/filter-options', verifyToken, async (req, res) => {
    try {
        // Get unique weeks (dates)
        const weeksQuery = `
            SELECT DISTINCT MORE_Date as date
            FROM amore_data 
            ORDER BY MORE_Date DESC
        `;
        const weeks = await db.query(weeksQuery);

        // Get unique months
        const monthsQuery = `
            SELECT DISTINCT DATE_FORMAT(MORE_Date, '%Y-%m') as month,
                   DATE_FORMAT(MORE_Date, '%M %Y') as label
            FROM amore_data 
            ORDER BY month DESC
        `;
        const months = await db.query(monthsQuery);

        // Get unique years
        const yearsQuery = `
            SELECT DISTINCT YEAR(MORE_Date) as year
            FROM amore_data 
            ORDER BY year DESC
        `;
        const years = await db.query(yearsQuery);

        // Get unique MGAs, RGAs, Legacies, Trees
        const mgasQuery = 'SELECT DISTINCT MGA FROM amore_data WHERE MGA IS NOT NULL ORDER BY MGA';
        const rgasQuery = 'SELECT DISTINCT RGA FROM amore_data WHERE RGA IS NOT NULL ORDER BY RGA';
        const legaciesQuery = 'SELECT DISTINCT Legacy FROM amore_data WHERE Legacy IS NOT NULL ORDER BY Legacy';
        const treesQuery = 'SELECT DISTINCT Tree FROM amore_data WHERE Tree IS NOT NULL ORDER BY Tree';

        const [mgas, rgas, legacies, trees] = await Promise.all([
            db.query(mgasQuery),
            db.query(rgasQuery),
            db.query(legaciesQuery),
            db.query(treesQuery)
        ]);

        res.json({
            success: true,
            data: {
                weeks: weeks.map(w => ({
                    value: w.date,
                    label: new Date(w.date).toLocaleDateString()
                })),
                months: months.map(m => ({
                    value: m.month,
                    label: m.label
                })),
                years: years.map(y => ({
                    value: y.year.toString(),
                    label: y.year.toString()
                })),
                mgas: mgas.map(m => m.MGA),
                rgas: rgas.map(r => r.RGA),
                legacies: legacies.map(l => l.Legacy),
                trees: trees.map(t => t.Tree)
            }
        });
    } catch (error) {
        console.error('Error fetching filter options:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching filter options',
            error: error.message
        });
    }
});

// Add new route for MGAs with active users (needed for reporting status)
router.get('/get-mgas-with-activeusers', verifyToken, async (req, res) => {
    try {
        // Get MGAs with active users - similar to KyleTesting implementation
        const query = `
            SELECT 
                m.lagnname,
                m.hide,
                m.active,
                m.rga,
                m.tree,
                COUNT(au.id) as active_user_count
            FROM MGAs m
            LEFT JOIN activeusers au ON m.lagnname = au.mga AND au.Active = 'y'
            WHERE m.hide = 'n' AND m.active = 'y'
            GROUP BY m.lagnname, m.hide, m.active, m.rga, m.tree
            ORDER BY m.lagnname
        `;
        
        const results = await db.query(query);
        
        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Error fetching MGAs with active users:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching MGAs with active users',
            error: error.message
        });
    }
});

module.exports = router;
