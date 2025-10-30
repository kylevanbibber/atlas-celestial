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

module.exports = router;
