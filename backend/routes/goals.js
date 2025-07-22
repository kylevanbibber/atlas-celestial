const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

// Apply authentication middleware to all routes
router.use(verifyToken);

// Helper function to promisify database queries
const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// GET /api/goals/agency-rates - Get agency-wide conversion rates
router.get('/agency-rates', async (req, res) => {
  try {
    // Calculate agency averages from Daily_Activity table
    // We'll look at data from the last 6 months to get current averages
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const sql = `
      SELECT 
        SUM(calls) as totalCalls,
        SUM(appts) as totalAppts,
        SUM(sits) as totalSits,
        SUM(sales) as totalSales,
        SUM(alp) as totalAlp,
        COUNT(DISTINCT userId) as activeUsers
      FROM Daily_Activity 
      WHERE reportDate >= ? 
        AND calls > 0
    `;
    
    const results = await query(sql, [sixMonthsAgo.toISOString().split('T')[0]]);
    
    if (results.length === 0 || !results[0].totalCalls) {
      // Default rates if no data available (based on agency importance metrics)
      return res.json({
        callsToAppts: 1/35,     // 35 calls to get 1 appointment (2.86%)
        apptsToSits: 0.33,      // 33% show ratio (appts that sit)
        sitsToSales: 0.33,      // 33% close ratio (sits that sell)
        salesToAlp: 1200,       // $1200 average ALP per sale
        dataSource: 'default',
        period: 'last_6_months',
        sampleSize: 0
      });
    }
    
    const data = results[0];
    const callsToAppts = data.totalAppts / data.totalCalls;
    const apptsToSits = data.totalAppts > 0 ? data.totalSits / data.totalAppts : 0.8;
    const sitsToSales = data.totalSits > 0 ? data.totalSales / data.totalSits : 0.3;
    const salesToAlp = data.totalSales > 0 ? data.totalAlp / data.totalSales : 1000;
    
    res.json({
      callsToAppts: Math.max(0.01, Math.min(1, callsToAppts)), // Clamp between 1% and 100%
      apptsToSits: Math.max(0.01, Math.min(1, apptsToSits)),
      sitsToSales: Math.max(0.01, Math.min(1, sitsToSales)),
      salesToAlp: Math.max(100, salesToAlp), // Minimum $100 per sale
      dataSource: 'calculated',
      period: 'last_6_months',
      sampleSize: data.activeUsers
    });
  } catch (error) {
    console.error('Error calculating agency rates:', error);
    res.status(500).json({ error: 'Failed to calculate agency rates' });
  }
});

// GET /api/goals/personal-rates/:userId - Get personal conversion rates
router.get('/personal-rates/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Calculate personal averages from last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const sql = `
      SELECT 
        SUM(calls) as totalCalls,
        SUM(appts) as totalAppts,
        SUM(sits) as totalSits,
        SUM(sales) as totalSales,
        SUM(alp) as totalAlp,
        COUNT(*) as recordCount
      FROM Daily_Activity 
      WHERE activeUserId = ? 
        AND reportDate >= ?
        AND calls > 0
    `;
    
    const results = await query(sql, [userId, sixMonthsAgo.toISOString().split('T')[0]]);
    
    if (results.length === 0 || !results[0].totalCalls || results[0].recordCount < 10) {
      // Not enough personal data
      return res.json(null);
    }
    
    const data = results[0];
    const callsToAppts = data.totalAppts / data.totalCalls;
    const apptsToSits = data.totalAppts > 0 ? data.totalSits / data.totalAppts : 0;
    const sitsToSales = data.totalSits > 0 ? data.totalSales / data.totalSits : 0;
    const salesToAlp = data.totalSales > 0 ? data.totalAlp / data.totalSales : 0;
    
    // Only return if we have meaningful conversion rates
    if (callsToAppts > 0 && apptsToSits > 0 && sitsToSales > 0 && salesToAlp > 0) {
      res.json({
        callsToAppts: Math.max(0.01, Math.min(1, callsToAppts)),
        apptsToSits: Math.max(0.01, Math.min(1, apptsToSits)),
        sitsToSales: Math.max(0.01, Math.min(1, sitsToSales)),
        salesToAlp: Math.max(100, salesToAlp),
        dataSource: 'personal',
        period: 'last_6_months',
        recordCount: data.recordCount
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error calculating personal rates:', error);
    res.status(500).json({ error: 'Failed to calculate personal rates' });
  }
});

// GET /api/goals/:userId/:year/:month - Get goal for specific month
router.get('/:userId/:year/:month', async (req, res) => {
  try {
    const { userId, year, month } = req.params;
    
    const sql = `
      SELECT * FROM production_goals 
      WHERE activeUserId = ? AND year = ? AND month = ?
    `;
    
    const results = await query(sql, [userId, year, month]);
    
    if (results.length === 0) {
      return res.json(null);
    }
    
    const goal = results[0];
    // Parse JSON fields if they exist
    if (goal.customRates) {
      goal.customRates = JSON.parse(goal.customRates);
    }
    if (goal.workingDays) {
      goal.workingDays = JSON.parse(goal.workingDays);
    }
    
    res.json(goal);
  } catch (error) {
    console.error('Error fetching goal:', error);
    res.status(500).json({ error: 'Failed to fetch goal' });
  }
});

// POST /api/goals - Save/update goal
router.post('/', async (req, res) => {
  try {
    const { userId, year, month, monthlyAlpGoal, workingDays, rateSource, customRates } = req.body;
    
    if (!userId || !year || !month || !monthlyAlpGoal) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if goal already exists
    const existingSql = `
      SELECT id FROM production_goals 
      WHERE activeUserId = ? AND year = ? AND month = ?
    `;
    
    const existing = await query(existingSql, [userId, year, month]);
    
    const customRatesJson = customRates ? JSON.stringify(customRates) : null;
    const workingDaysJson = workingDays ? JSON.stringify(workingDays) : null;
    
    if (existing.length > 0) {
      // Update existing goal
      const updateSql = `
        UPDATE production_goals 
        SET monthlyAlpGoal = ?, workingDays = ?, rateSource = ?, customRates = ?, updatedAt = NOW()
        WHERE activeUserId = ? AND year = ? AND month = ?
      `;
      
      await query(updateSql, [monthlyAlpGoal, workingDaysJson, rateSource, customRatesJson, userId, year, month]);
    } else {
      // Create new goal
      const insertSql = `
        INSERT INTO production_goals (
          activeUserId, year, month, monthlyAlpGoal, workingDays, rateSource, customRates, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      await query(insertSql, [userId, year, month, monthlyAlpGoal, workingDaysJson, rateSource, customRatesJson]);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving goal:', error);
    res.status(500).json({ error: 'Failed to save goal' });
  }
});

// GET /api/goals/:userId - Get all goals for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const sql = `
      SELECT * FROM production_goals 
      WHERE activeUserId = ? 
      ORDER BY year DESC, month DESC
    `;
    
    const results = await query(sql, [userId]);
    
    // Parse JSON fields for each goal
    const goals = results.map(goal => {
      if (goal.customRates) {
        goal.customRates = JSON.parse(goal.customRates);
      }
      if (goal.workingDays) {
        goal.workingDays = JSON.parse(goal.workingDays);
      }
      return goal;
    });
    
    res.json(goals);
  } catch (error) {
    console.error('Error fetching user goals:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

module.exports = router; 