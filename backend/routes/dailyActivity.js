const express = require("express");
const router = express.Router();
const { pool, query } = require("../db");
const { verifyToken } = require("../middleware/authMiddleware");

// POST /api/dailyActivity/submit - Submit daily activity data
router.post("/submit", async (req, res) => {
    // Get user information from authenticated context (via middleware)
    const authenticatedUserId = req.user?.id;
    const authenticatedUser = req.user; // Should contain lagnname, MGA, etc.
    
    let {
        reportDate,
        esid,
        MGA,
        Work,
        HC_Appt = 0,
        HC_Sit = 0,
        HC_Sale = 0,
        HC_ALP = 0,
        POS_Appt = 0,
        POS_Sit = 0,
        POS_Sale = 0,
        POS_ALP = 0,
        refAppt = 0,
        refSit = 0,
        refSale = 0,
        refAlp = 0,
        Vendor_Appt = 0,
        Vendor_Sit = 0,
        Vendor_Sale = 0,
        Vendor_ALP = 0,
        calls,
        appts,
        sits,
        sales,
        alp,
        refs,
        rga,
        agent, // This will be overridden with authenticated user's lagnname
        Legacy,
        Tree,
        SA,
        GA,
        userId
    } = req.body;
    
    // Override critical fields with authenticated user data to prevent spoofing
    agent = authenticatedUser?.lagnname || agent; // Use authenticated user's lagnname
    userId = authenticatedUserId || userId; // Use authenticated userId
    esid = authenticatedUser?.esid || esid;
    MGA = authenticatedUser?.MGA || MGA;
    rga = authenticatedUser?.rga || rga;
    SA = authenticatedUser?.SA || SA;
    GA = authenticatedUser?.GA || GA;


    try {
        const checkQuery = `SELECT * FROM Daily_Activity WHERE agent = ? AND reportDate = ?`;
        const existingRecord = await query(checkQuery, [agent, reportDate]);

        if (existingRecord && existingRecord.length > 0) {
            const updateQuery = `
                UPDATE Daily_Activity SET
                    esid = ?,
                    MGA = ?,
                    Work = ?,
                    HC_Appt = ?,
                    HC_Sit = ?,
                    HC_Sale = ?,
                    HC_ALP = ?,
                    POS_Appt = ?,
                    POS_Sit = ?,
                    POS_Sale = ?,
                    POS_ALP = ?,
                    refAppt = ?,
                    refSit = ?,
                    refSale = ?,
                    refAlp = ?,
                    Vendor_Appt = ?,
                    Vendor_Sit = ?,
                    Vendor_Sale = ?,
                    Vendor_ALP = ?,
                    calls = ?,
                    appts = ?,
                    sits = ?,
                    sales = ?,
                    alp = ?,
                    refs = ?,
                    rga = ?,
                    Legacy = ?,
                    Tree = ?,
                    SA = ?,
                    GA = ?,
                    userId = ?
                WHERE agent = ? AND reportDate = ?
            `;
            const updateValues = [
                esid, MGA, Work, HC_Appt, HC_Sit, HC_Sale, HC_ALP,
                POS_Appt, POS_Sit, POS_Sale, POS_ALP, refAppt, refSit,
                refSale, refAlp, Vendor_Appt, Vendor_Sit, Vendor_Sale,
                Vendor_ALP, calls, appts, sits, sales, alp, refs, rga,
                Legacy, Tree, SA, GA, userId, agent, reportDate
            ];
            await query(updateQuery, updateValues);
        } else {
            const insertQuery = `
                INSERT INTO Daily_Activity (
                    reportDate, esid, MGA, Work, HC_Appt, HC_Sit, HC_Sale, HC_ALP,
                    POS_Appt, POS_Sit, POS_Sale, POS_ALP, refAppt, refSit, refSale, refAlp,
                    Vendor_Appt, Vendor_Sit, Vendor_Sale, Vendor_ALP, calls, appts, sits,
                    sales, alp, refs, rga, agent, Legacy, Tree, SA, GA, userId
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const insertValues = [
                reportDate, esid, MGA, Work, HC_Appt, HC_Sit, HC_Sale, HC_ALP,
                POS_Appt, POS_Sit, POS_Sale, POS_ALP, refAppt, refSit, refSale, refAlp,
                Vendor_Appt, Vendor_Sit, Vendor_Sale, Vendor_ALP, calls, appts, sits,
                sales, alp, refs, rga, agent, Legacy, Tree, SA, GA, userId
            ];
            await query(insertQuery, insertValues);
        }

        res.status(200).json({ success: true, message: 'Daily activity submitted successfully' });
    } catch (err) {
        console.error('Error processing daily activity data', err);
        res.status(500).json({ success: false, message: 'Error submitting daily activity data' });
    }
});

// GET /api/dailyActivity/user-summary - Get user activity summary for date range
router.get("/user-summary", async (req, res) => {
    const { startDate, endDate, roleScope } = req.query;
    
    // Get userId from authenticated user context (via middleware) or query parameter
    let userId = req.user?.id || req.query.userId;

    if (!userId || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required parameters: userId, startDate, and endDate' });
    }

    // Ensure userId is a number
    userId = parseInt(userId, 10);
    
    if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid userId parameter' });
    }

    console.log('[dailyActivity/user-summary] Request params:', { userId, startDate, endDate });

    try {
        const queryStr = `
            SELECT 
                reportDate, calls, appts, sits, sales, alp, refs, 
                refAppt, refSit, refSale, refAlp,
                agent, userId
            FROM Daily_Activity
            WHERE userId = ? 
            AND reportDate BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
            ORDER BY reportDate ASC
        `;

        const result = await query(queryStr, [userId, startDate, endDate]);

        console.log('[dailyActivity/user-summary] Query result:', { rowCount: result.length, userId, startDate, endDate });

        if (result.length > 0) {
            res.status(200).json({ success: true, data: result });
        } else {
            res.status(200).json({ success: true, data: [] });
        }
    } catch (err) {
        console.error('[dailyActivity/user-summary] Database query error:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// GET /api/dailyActivity/team-summary - Get team activity summary for date range
// Team is defined as any Daily_Activity row where SA, GA, or MGA equals the current user's lagnname,
// or userId equals the current user's id (include leader's own rows)
router.get("/team-summary", async (req, res) => {
    const { startDate, endDate, roleScope } = req.query;

    // Accept from auth or query (dev fallback)
    const userIdRaw = (req.user?.id ?? req.user?.userId ?? req.query.userId);
    const lagnRaw = (req.user?.lagnname ?? req.query.lagnname);

    // Sanitize possible array inputs (e.g., duplicated query params)
    const currentUserId = Array.isArray(userIdRaw) ? userIdRaw[0] : userIdRaw;
    const currentUserLagn = Array.isArray(lagnRaw) ? lagnRaw[0] : lagnRaw;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required parameters: startDate and endDate' });
    }

    try {
        // Build role-aware condition: default (SA/GA/MGA) or include RGA when roleScope=rga
        let whereCond = '(SA = ? OR GA = ? OR MGA = ? OR userId = ?)';
        if (String(roleScope || '').toLowerCase() === 'rga') {
            whereCond = '(SA = ? OR GA = ? OR MGA = ? OR RGA = ? OR userId = ?)';
        }

        const queryStr = `
            SELECT 
                reportDate, calls, appts, sits, sales, alp, refs,
                refAppt, refSit, refSale, refAlp,
                agent, userId
            FROM Daily_Activity
            WHERE ${whereCond}
              AND reportDate BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
            ORDER BY reportDate ASC
        `;

        const userIdParam = Number(currentUserId) || 0;
        const lagnParam = currentUserLagn || '';
        const params = (String(roleScope || '').toLowerCase() === 'rga')
            ? [lagnParam, lagnParam, lagnParam, lagnParam, userIdParam, startDate, endDate]
            : [lagnParam, lagnParam, lagnParam, userIdParam, startDate, endDate];
        let result = await query(queryStr, params);
        
        // Special case: For MAUGHANEVANSON BRODY W, also include all LOCKER-ROTOLO users
        if (currentUserLagn === 'MAUGHANEVANSON BRODY W') {
            const lockerRotoloQuery = `
                SELECT 
                    da.reportDate, da.calls, da.appts, da.sits, da.sales, da.alp, da.refs,
                    da.refAppt, da.refSit, da.refSale, da.refAlp,
                    da.agent, da.userId
                FROM Daily_Activity da
                JOIN activeusers au ON da.userId = au.id
                WHERE au.rept_name = 'LOCKER-ROTOLO'
                  AND au.Active = 'y'
                  AND da.reportDate BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
                ORDER BY da.reportDate ASC
            `;
            const lockerRotoloResult = await query(lockerRotoloQuery, [startDate, endDate]);
            
            // Merge results, avoiding duplicates by userId + reportDate
            const existingKeys = new Set(result.map(r => `${r.userId}_${r.reportDate}`));
            const newRecords = lockerRotoloResult.filter(r => !existingKeys.has(`${r.userId}_${r.reportDate}`));
            result = [...result, ...newRecords];
        }

        res.status(200).json({ success: true, data: result || [] });
    } catch (err) {
        console.error('Database query error (team-summary):', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/dailyActivity/reported-alp-summary - Get reported ALP totals by user for date range
router.get("/reported-alp-summary", async (req, res) => {
    const { startDate, endDate, userIds } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required parameters: startDate and endDate' 
        });
    }

    try {
        let queryStr;
        let params;

        if (userIds) {
            // If specific userIds provided, filter by them
            const userIdArray = Array.isArray(userIds) ? userIds : userIds.split(',');
            const placeholders = userIdArray.map(() => '?').join(',');
            
            queryStr = `
                SELECT 
                    userId,
                    agent,
                    SUM(alp) as reported_alp,
                    COUNT(*) as report_days
                FROM Daily_Activity
                WHERE userId IN (${placeholders})
                  AND reportDate BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
                  AND userId IS NOT NULL
                GROUP BY userId, agent
                ORDER BY reported_alp DESC
            `;
            params = [...userIdArray, startDate, endDate];
        } else {
            // Get all users with reported ALP for the date range
            queryStr = `
                SELECT 
                    userId,
                    agent,
                    SUM(alp) as reported_alp,
                    COUNT(*) as report_days
                FROM Daily_Activity
                WHERE reportDate BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
                  AND userId IS NOT NULL
                GROUP BY userId, agent
                ORDER BY reported_alp DESC
            `;
            params = [startDate, endDate];
        }

        const result = await query(queryStr, params);

        res.status(200).json({ 
            success: true, 
            data: result || [] 
        });
    } catch (err) {
        console.error('Database query error (reported-alp-summary):', err);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// POST /api/dailyActivity/update - Update multiple daily activity records
router.post("/update", verifyToken, async (req, res) => {
    const userId = req.user?.id || req.body.userId;
    const { updates } = req.body;

    if (!userId || !updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'Missing userId or updates' });
    }

    try {
        // Fetch user hierarchy data for populating new records
        const userQuery = `SELECT lagnname, esid, SA, GA, MGA, rga FROM activeusers WHERE id = ? LIMIT 1`;
        const userResult = await query(userQuery, [userId]);
        
        if (userResult.length === 0) {
            return res.status(400).json({ success: false, message: 'User not found' });
        }
        
        const user = userResult[0];

        const promises = Object.keys(updates).map(async (reportDate) => {
            const data = updates[reportDate];
            
            // Check if record exists
            const checkQuery = `SELECT * FROM Daily_Activity WHERE userId = ? AND reportDate = ?`;
            const existingRecord = await query(checkQuery, [userId, reportDate]);

            if (existingRecord && existingRecord.length > 0) {
                // Update existing record - only update fields that were actually provided
                const fieldsToUpdate = [];
                const valuesToUpdate = [];
                
                // List of all possible fields that can be updated
                const updatableFields = ['calls', 'appts', 'sits', 'sales', 'alp', 'refs', 'refAppt', 'refSit', 'refSale', 'refAlp'];
                
                // Only include fields that are present in the data object
                updatableFields.forEach(field => {
                    if (data.hasOwnProperty(field)) {
                        fieldsToUpdate.push(`${field} = ?`);
                        valuesToUpdate.push(data[field] || 0);
                    }
                });
                
                // Only proceed if there are fields to update
                if (fieldsToUpdate.length > 0) {
                    const updateQuery = `
                        UPDATE Daily_Activity SET
                            ${fieldsToUpdate.join(', ')}
                        WHERE userId = ? AND reportDate = ?
                    `;
                    valuesToUpdate.push(userId, reportDate);
                    return query(updateQuery, valuesToUpdate);
                }
            } else {
                // Insert new record with full hierarchy data
                const insertQuery = `
                    INSERT INTO Daily_Activity (
                        reportDate, esid, MGA, Work, rga, agent, SA, GA, userId,
                        calls, appts, sits, sales, alp, refs, refAppt, refSit, refSale, refAlp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                const insertValues = [
                    reportDate,
                    user.esid,
                    user.MGA,
                    new Date().toISOString().split('T')[0], // Work = current date
                    user.rga,
                    user.lagnname, // agent = user's lagnname
                    user.SA,
                    user.GA,
                    userId,
                    data.calls || 0,
                    data.appts || 0,
                    data.sits || 0,
                    data.sales || 0,
                    data.alp || 0,
                    data.refs || 0,
                    data.refAppt || 0,
                    data.refSit || 0,
                    data.refSale || 0,
                    data.refAlp || 0
                ];
                
                return query(insertQuery, insertValues);
            }
        });

        await Promise.all(promises);

        res.status(200).json({ success: true, message: 'Daily activity updated successfully' });
    } catch (err) {
        console.error('Error updating daily activity data:', err);
        res.status(500).json({ success: false, message: 'Error updating daily activity data' });
    }
});

// PUT /api/dailyActivity - Update a single field in Daily_Activity
router.put("/", async (req, res) => {
    const { reportDate, ...updateFields } = req.body;
    

    if (!reportDate) {
        return res.status(400).json({ 
            success: false, 
            message: 'reportDate is required' 
        });
    }

    try {
        // Get user info from the request (assuming it's available from middleware)
        const userId = req.user?.id || req.body.userId;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID is required' 
            });
        }

        // Get user details from activeusers table
        const userQuery = `SELECT lagnname, esid, MGA, rga, SA, GA FROM activeusers WHERE id = ?`;
        const userResult = await query(userQuery, [userId]);
        
        if (!userResult || userResult.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        const user = userResult[0];

        // Check if record exists
        const existingQuery = `SELECT * FROM Daily_Activity WHERE agent = ? AND reportDate = ?`;
        const existingRecord = await query(existingQuery, [user.lagnname, reportDate]);

        if (existingRecord && existingRecord.length > 0) {
            // Update existing record
            const existing = existingRecord[0];
            
            // Build dynamic update query
            const fields = Object.keys(updateFields);
            const values = Object.values(updateFields);
            
            if (fields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No fields to update'
                });
            }
            
            const setClause = fields.map(field => `${field} = ?`).join(', ');
            const updateQuery = `UPDATE Daily_Activity SET ${setClause} WHERE reportDate = ? AND agent = ?`;
            
            await query(updateQuery, [...values, reportDate, user.lagnname]);
            
            
            res.status(200).json({ 
                success: true, 
                message: 'Daily activity updated successfully',
                updatedFields: fields
            });
        } else {
            // Create new record with all required fields
            
            const insertQuery = `
                INSERT INTO Daily_Activity (
                    reportDate, esid, MGA, Work, rga, agent, SA, GA, userId,
                    calls, appts, sits, sales, alp, refs, refAppt, refSit, refSale, refAlp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const insertValues = [
                reportDate,
                user.esid,
                user.MGA,
                new Date().toISOString().split('T')[0], // Work = current date
                user.rga,
                user.lagnname,
                user.SA,
                user.GA,
                userId,
                updateFields.calls || 0,
                updateFields.appts || 0,
                updateFields.sits || 0,
                updateFields.sales || 0,
                updateFields.alp || 0,
                updateFields.refs || 0,
                updateFields.refAppt || 0,
                updateFields.refSit || 0,
                updateFields.refSale || 0,
                updateFields.refAlp || 0
            ];
            
            await query(insertQuery, insertValues);
            
            
            res.status(200).json({ 
                success: true, 
                message: 'Daily activity created successfully',
                createdFields: Object.keys(updateFields)
            });
        }
    } catch (error) {
        console.error(`[DAILY-ACTIVITY-API] ❌ Error updating daily activity:`, error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating daily activity data' 
        });
    }
});

// GET /api/dailyActivity/agent/:agent/:date - Get specific daily activity for agent and date
router.get("/agent/:agent/:date", async (req, res) => {
    const { agent, date } = req.params;

    try {
        const queryStr = `SELECT * FROM Daily_Activity WHERE agent = ? AND reportDate = ?`;
        const result = await query(queryStr, [agent, date]);

        if (result.length > 0) {
            res.status(200).json({ success: true, data: result[0] });
        } else {
            res.status(200).json({ success: false, message: 'No activity found' });
        }
    } catch (err) {
        console.error('Error fetching daily activity data', err);
        res.status(500).json({ success: false, message: 'Error fetching daily activity data' });
    }
});

// GET /api/dailyActivity/all - Get all daily activity records
router.get("/all", async (req, res) => {
    try {
        const queryStr = `SELECT * FROM Daily_Activity ORDER BY reportDate DESC`;
        const result = await query(queryStr);

        if (result.length > 0) {
            res.status(200).json({ success: true, data: result });
        } else {
            res.status(200).json({ success: true, data: [] });
        }
    } catch (err) {
        console.error('Error fetching daily activity data', err);
        res.status(500).json({ success: false, message: 'Error fetching daily activity data' });
    }
});

// GET /api/dailyActivity/filtered - Get filtered daily activity records with MGA table joins
router.get("/filtered", async (req, res) => {
    try {
        const { startDate, endDate, MGA_NAME, rga, tree } = req.query;
        

        let queryStr = `
            SELECT 
                da.*,
                m.rga,
                m.tree,
                au.clname as userRole
            FROM Daily_Activity da
            LEFT JOIN MGAs m 
                ON da.MGA = m.lagnname
            LEFT JOIN activeusers au 
                ON da.userId = au.id
        `;
        
        const params = [];
        const conditions = [];

        // Date filtering
        if (startDate && endDate) {
            conditions.push('da.reportDate BETWEEN ? AND ?');
            params.push(startDate, endDate);
        }

        // MGA filtering - include both direct MGA match and self-reporting
        if (MGA_NAME) {
            conditions.push('(da.MGA = ? OR da.agent = ?)');
            params.push(MGA_NAME, MGA_NAME);
        }

        // RGA filtering - include both MGA table RGA match and self-reporting
        if (rga) {
            conditions.push('(m.rga = ? OR da.agent = ?)');
            params.push(rga, rga);
        }

        // Tree filtering - include both MGA table tree match and self-reporting
        if (tree) {
            conditions.push('(m.tree = ? OR da.agent = ?)');
            params.push(tree, tree);
        }

        // Add WHERE clause if there are conditions
        if (conditions.length > 0) {
            queryStr += ' WHERE ' + conditions.join(' AND ');
        }

        queryStr += ' ORDER BY da.reportDate DESC';


        const result = await query(queryStr, params);


        res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error('Error fetching filtered daily activity data', err);
        res.status(500).json({ success: false, message: 'Error fetching filtered daily activity data' });
    }
});

// GET /api/dailyActivity/codes - Get filtered associates (codes) data with MGA table joins
router.get("/codes", async (req, res) => {
    try {
        const { startDate, endDate, MGA_NAME, rga, tree } = req.query;
        

        let queryStr = `
            SELECT 
                a.*,
                m.rga as mga_rga,
                m.tree as mga_tree
            FROM associates a
            LEFT JOIN MGAs m 
                ON a.MGA = m.lagnname
        `;
        
        const params = [];
        const conditions = [];

        // Date filtering based on PRODDATE
        if (startDate && endDate) {
            conditions.push('a.PRODDATE BETWEEN ? AND ?');
            params.push(startDate, endDate);
        }

        // MGA filtering - include both direct MGA match and self-reporting
        if (MGA_NAME) {
            conditions.push('(a.MGA = ? OR a.LagnName = ?)');
            params.push(MGA_NAME, MGA_NAME);
        }

        // RGA filtering - include both MGA table RGA match and self-reporting
        if (rga) {
            conditions.push('(m.rga = ? OR a.LagnName = ?)');
            params.push(rga, rga);
        }

        // Tree filtering - include both MGA table tree match and self-reporting
        if (tree) {
            conditions.push('(m.tree = ? OR a.LagnName = ?)');
            params.push(tree, tree);
        }

        // Add WHERE clause if there are conditions
        if (conditions.length > 0) {
            queryStr += ' WHERE ' + conditions.join(' AND ');
        }

        queryStr += ' ORDER BY a.PRODDATE DESC';

      

        const result = await query(queryStr, params);


        res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error('Error fetching codes data', err);
        res.status(500).json({ success: false, message: 'Error fetching codes data' });
    }
});

// GET /api/dailyActivity/vips - Get filtered VIPs data with MGA table joins
router.get("/vips", async (req, res) => {
    try {
        const { period, month, year, MGA_NAME, rga, tree } = req.query;
        

        let queryStr = `
            SELECT DISTINCT
                v.*,
                m.rga as mga_rga,
                m.tree as mga_tree
            FROM VIPs v
            LEFT JOIN MGAs m 
                ON v.mga = m.lagnname
        `;
        
        const params = [];
        const conditions = [];

        // Date filtering based on vip_month and period
        if (period && year) {
            if (period === 'mtd' && month) {
                // MTD: Filter for specific month and year
                conditions.push('YEAR(v.vip_month) = ? AND MONTH(v.vip_month) = ?');
                params.push(year, month);
            } else if (period === 'ytd') {
                // YTD: Filter for year to date
                conditions.push('YEAR(v.vip_month) = ? AND v.vip_month <= NOW()');
                params.push(year);
            }
        }

        // MGA filtering - include both direct MGA match and self-reporting
        if (MGA_NAME) {
            conditions.push('(v.mga = ? OR v.lagnname = ?)');
            params.push(MGA_NAME, MGA_NAME);
        }

        // RGA filtering - include both MGA table RGA match and self-reporting
        if (rga) {
            conditions.push('(m.rga = ? OR v.lagnname = ?)');
            params.push(rga, rga);
        }

        // Tree filtering - include both MGA table tree match and self-reporting
        if (tree) {
            conditions.push('(m.tree = ? OR v.lagnname = ?)');
            params.push(tree, tree);
        }

        // Add WHERE clause if there are conditions
        if (conditions.length > 0) {
            queryStr += ' WHERE ' + conditions.join(' AND ');
        }

        queryStr += ' ORDER BY v.vip_month DESC';

      

        const result = await query(queryStr, params);


        res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error('Error fetching VIPs data', err);
        res.status(500).json({ success: false, message: 'Error fetching VIPs data' });
    }
});

module.exports = router; 
 
// Add new endpoint to sum ALP by user for a given month
// GET /api/dailyActivity/sum-by-users?userIds=1,2,3&month=YYYY-MM
router.get("/sum-by-users", async (req, res) => {
    try {
        const { userIds, month } = req.query;
        if (!userIds || !month) {
            return res.status(400).json({ success: false, message: "Missing required params: userIds, month (YYYY-MM)" });
        }

        const ids = userIds
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .map((s) => Number(s))
            .filter((n) => Number.isFinite(n));

        if (ids.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        // Compute month date range [start, nextMonthStart)
        const [y, m] = month.split("-").map((v) => parseInt(v, 10));
        if (!y || !m || m < 1 || m > 12) {
            return res.status(400).json({ success: false, message: "Invalid month format. Use YYYY-MM" });
        }
        const startDate = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
        const endDate = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

        // Build placeholders for IN clause
        const placeholders = ids.map(() => "?").join(",");
        const sql = `
            SELECT userId, CAST(SUM(alp) AS DECIMAL(12,2)) as monthlyAlp
            FROM Daily_Activity
            WHERE userId IN (${placeholders})
              AND reportDate >= ?
              AND reportDate < ?
            GROUP BY userId
        `;

        const rows = await query(sql, [...ids, startDate, endDate]);

        res.status(200).json({ success: true, data: rows });
    } catch (err) {
        console.error("[dailyActivity] Error in /sum-by-users:", err);
        res.status(500).json({ success: false, message: "Error fetching monthly sums" });
    }
});