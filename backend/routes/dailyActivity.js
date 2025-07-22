const express = require("express");
const router = express.Router();
const { pool, query } = require("../db");

// POST /api/dailyActivity/submit - Submit daily activity data
router.post("/submit", async (req, res) => {
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
        agent,
        Legacy,
        Tree,
        SA,
        GA,
        userId
    } = req.body;

    console.log('Received daily activity submission:', req.body);

    try {
        const checkQuery = `SELECT * FROM Daily_Activity WHERE agent = ? AND reportDate = ?`;
        const existingRecord = await query(checkQuery, [agent, reportDate]);

        if (existingRecord && existingRecord.length > 0) {
            console.log('Updating existing record');
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
            console.log('Inserting new record');
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
    const { userId, startDate, endDate } = req.query;

    console.log(`Received request: userId=${userId}, startDate=${startDate}, endDate=${endDate}`);

    if (!userId || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required parameters: userId, startDate, and endDate' });
    }

    try {
        const queryStr = `
            SELECT 
                reportDate, calls, appts, sits, sales, alp, refs, 
                refAppt, refSit, refSale, refAlp
            FROM Daily_Activity
            WHERE userId = ? 
            AND reportDate BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
            ORDER BY reportDate ASC
        `;

        console.log(`Executing query: ${queryStr} with values`, [userId, startDate, endDate]);

        const result = await query(queryStr, [userId, startDate, endDate]);

        if (result.length > 0) {
            console.log(`Query successful. Retrieved ${result.length} rows.`);
            res.status(200).json({ success: true, data: result });
        } else {
            res.status(200).json({ success: true, data: [] });
        }
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/dailyActivity/update - Update multiple daily activity records
router.post("/update", async (req, res) => {
    const { userId, updates } = req.body;

    if (!userId || !updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'Missing userId or updates' });
    }

    console.log("📥 Received updates:", updates);

    try {
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
                // Insert new record
                const insertQuery = `
                    INSERT INTO Daily_Activity (
                        userId, reportDate, calls, appts, sits, sales, alp,
                        refs, refAppt, refSit, refSale, refAlp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                return query(insertQuery, [
                    userId, reportDate,
                    data.calls || 0, data.appts || 0, data.sits || 0, data.sales || 0, data.alp || 0,
                    data.refs || 0, data.refAppt || 0, data.refSit || 0, data.refSale || 0, data.refAlp || 0
                ]);
            }
        });

        await Promise.all(promises);

        res.status(200).json({ success: true, message: 'Daily activity updated successfully' });
    } catch (err) {
        console.error('Error updating daily activity data:', err);
        res.status(500).json({ success: false, message: 'Error updating daily activity data' });
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

module.exports = router; 