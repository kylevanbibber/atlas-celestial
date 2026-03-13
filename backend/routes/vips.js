// routes/vips.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const { promisify } = require('util');

const query = promisify(pool.query).bind(pool);

router.get("/", (req, res) => {
  pool.query("SELECT * FROM vips_table", (err, results) => {
    if (err) {
      console.error("Error fetching vips data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// Get SAGA codes data - active SA/GA users with their associates count from specified 2 months range
router.get("/activity", async (req, res) => {
  try {
    // Get month parameter, default to current month
    const { month } = req.query;
    let baseYear, baseMonthIndex;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      baseYear = y;
      baseMonthIndex = m - 1; // JS Date month index (0-11)
    } else {
      const now = new Date();
      baseYear = now.getFullYear();
      baseMonthIndex = now.getMonth();
    }

    // Calculate the last 2 months range ending with the specified month
    // If month is Sept (8), get July (6) to Aug (7)
    const endDate = new Date(baseYear, baseMonthIndex, 0); // Last day of previous month
    const startDate = new Date(baseYear, baseMonthIndex - 2, 1); // First day of 2 months ago
    
    // Format dates for SQL (YYYY-MM-DD)
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // First, get all active SA and GA users
    const activeUsers = await query(`
      SELECT 
        id,
        lagnname,
        clname,
        mga,
        rga
      FROM activeusers 
      WHERE clname IN ('SA', 'GA') 
        AND Active = 'y'
      ORDER BY clname, lagnname
    `);

    if (!activeUsers || activeUsers.length === 0) {
      return res.json({
        success: true,
        data: [],
        selectedMonth: month || `${baseYear}-${String(baseMonthIndex + 1).padStart(2, '0')}`,
        dateRange: {
          startDate: startDateStr,
          endDate: endDateStr
        }
      });
    }

    // For each user, get their associates data from the last 2 months
    const usersWithAssociates = await Promise.all(
      activeUsers.map(async (user) => {
        // Query associates where SA, GA, MGA, or RGA matches this user's lagnname
        const associates = await query(`
          SELECT 
            LagnName,
            PRODDATE,
            SA,
            GA,
            MGA,
            RGA
          FROM associates 
          WHERE (SA = ? OR GA = ? OR MGA = ? OR RGA = ?)
            AND PRODDATE >= ?
            AND PRODDATE <= ?
          ORDER BY PRODDATE DESC
        `, [user.lagnname, user.lagnname, user.lagnname, user.lagnname, startDateStr, endDateStr]);

        return {
          id: user.id,
          lagnname: user.lagnname,
          role: user.clname,
          mga: user.mga,
          rga: user.rga,
          associatesCount: associates.length,
          associates: associates || []
        };
      })
    );

    // Include all users, even those with no associates activity
    res.json({
      success: true,
      data: usersWithAssociates,
      totalCount: usersWithAssociates.length,
      selectedMonth: month || `${baseYear}-${String(baseMonthIndex + 1).padStart(2, '0')}`,
      dateRange: {
        startDate: startDateStr,
        endDate: endDateStr
      }
    });

  } catch (error) {
    console.error('Error in activity endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
