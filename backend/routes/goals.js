const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { debug, debugWarn } = require('../utils/logger');
const verifyToken = require('../middleware/verifyToken');

// Apply authentication middleware to all routes
router.use(verifyToken);

// Helper function to normalize goal_type - defaults to 'personal' for null, undefined, or empty
const normalizeGoalType = (goalType) => {
  return (goalType && goalType.trim() !== '') ? goalType.trim() : 'personal';
};

// Note: using the promise-based query exported from ../db to avoid callback mismatch

// Personal rates are computed on-demand from a simple date range query

// Hardcoded agency rates (no expensive queries needed)
const HARDCODED_AGENCY_RATES = {
  callsToAppts: 35,
  apptsToSits: 0.25,
  sitsToSales: 0.33,
  salesToAlp: 1200,
  dataSource: 'hardcoded',
  period: 'agency_standards',
  sampleSize: 'all_agents'
};



// GET /api/goals/agency-rates - Get hardcoded agency-wide conversion rates (instant response)
router.get('/agency-rates', async (req, res) => {
  debug('\n🏢 AGENCY RATES: Returning hardcoded agency standards');
  
  debug(`✅ Hardcoded rates: ${HARDCODED_AGENCY_RATES.callsToAppts} calls per appt, ${Math.round(HARDCODED_AGENCY_RATES.apptsToSits*100)}% show, ${Math.round(HARDCODED_AGENCY_RATES.sitsToSales*100)}% close`);
  res.json(HARDCODED_AGENCY_RATES);
});

// POST /api/goals/batch - Get goals for multiple users for a given month
router.post('/batch', async (req, res) => {
  try {
    const { userIds, year, month, goalType } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0 || !year || !month) {
      return res.status(400).json({ error: 'Missing required fields: userIds[], year, month' });
    }

    // Build IN clause safely
    const placeholders = userIds.map(() => '?').join(',');
    const sql = `
      SELECT activeUserId, year, month, monthlyAlpGoal, goal_type, workingDays, rateSource, customRates
      FROM production_goals
      WHERE year = ? AND month = ? AND activeUserId IN (${placeholders})
      ${goalType ? 'AND goal_type = ?' : ''}
    `;
    const params = goalType 
      ? [year, month, ...userIds, goalType]
      : [year, month, ...userIds];
    const rows = await query(sql, params);

    const goalsByUserId = {};
    for (const row of rows) {
      let workingDaysParsed = row.workingDays;
      let customRatesParsed = row.customRates;
      try {
        if (typeof workingDaysParsed === 'string') workingDaysParsed = JSON.parse(workingDaysParsed);
      } catch {}
      try {
        if (typeof customRatesParsed === 'string') customRatesParsed = JSON.parse(customRatesParsed);
      } catch {}
      const normalizedGoalType = normalizeGoalType(row.goal_type);
      const key = `${row.activeUserId}_${normalizedGoalType}`;
      goalsByUserId[key] = {
        activeUserId: row.activeUserId,
        year: row.year,
        month: row.month,
        monthlyAlpGoal: row.monthlyAlpGoal,
        goal_type: normalizedGoalType,
        workingDays: workingDaysParsed || [],
        rateSource: row.rateSource || null,
        customRates: customRatesParsed || null
      };
    }

    return res.json({ goalsByUserId });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch batch goals' });
  }
});

// GET /api/goals/personal-rates/:userId - Personal rates from start/end date with min row count
router.get('/personal-rates/:userId', async (req, res) => {
  const { userId } = req.params;
  const { start, end, minRows } = req.query;
  debug(`\n👤 PERSONAL RATES: User ${userId}`);
  
  try {
    // Determine date range: use provided start/end or default to last 2 months
    const endDate = end ? new Date(end) : new Date();
    const startDate = start ? new Date(start) : new Date();
    if (!start) startDate.setMonth(startDate.getMonth() - 2);
    
    const endDateStr = endDate.toISOString().split('T')[0];
    const startDateStr = startDate.toISOString().split('T')[0];
    const minRequired = parseInt(minRows, 10) || 10;
    
    debug(`📅 Date range: ${startDateStr} to ${endDateStr} (minRows=${minRequired})`);
    
    const sql = `
      SELECT 
        SUM(calls) as totalCalls,
        SUM(appts) as totalAppts,
        SUM(sits) as totalSits,
        SUM(sales) as totalSales,
        SUM(alp) as totalAlp,
        COUNT(*) as recordCount
      FROM Daily_Activity 
      WHERE userId = ? 
        AND reportDate >= ? 
        AND reportDate <= ?
    `;
    
    const results = await query(sql, [userId, startDateStr, endDateStr]);
    const data = results && results[0] ? results[0] : null;
    if (!data) {
      return res.json(null);
    }
    
    const recordCount = parseInt(data.recordCount, 10) || 0;
    debug(`📊 Found ${recordCount} records for user ${userId}`);
    if (recordCount < minRequired) {
      debug(`❌ Insufficient data: only ${recordCount} records (need at least ${minRequired})`);
      return res.json(null);
    }
    
    const totalCalls = parseFloat(data.totalCalls) || 0;
    const totalAppts = parseFloat(data.totalAppts) || 0;
    const totalSits = parseFloat(data.totalSits) || 0;
    const totalSales = parseFloat(data.totalSales) || 0;
    const totalAlp = parseFloat(data.totalAlp) || 0;
    
    if (totalCalls === 0 && totalAppts === 0 && totalSits === 0 && totalSales === 0) {
      return res.json(null);
    }
    
    const callsToAppts = totalAppts > 0 ? totalCalls / totalAppts : 35;
    const apptsToSits = totalAppts > 0 ? totalSits / totalAppts : 0.25;
    const sitsToSales = totalSits > 0 ? totalSales / totalSits : 0.33;
    const salesToAlp = totalSales > 0 ? totalAlp / totalSales : 1200;
    
    const response = {
      callsToAppts: Math.max(1, Math.round(callsToAppts)),
      apptsToSits: Math.max(0.01, Math.min(1, apptsToSits)),
      sitsToSales: Math.max(0.01, Math.min(1, sitsToSales)),
      salesToAlp: Math.max(100, Math.round(salesToAlp)),
      dataSource: 'personal',
      period: `${startDateStr}_to_${endDateStr}`,
      recordCount: recordCount,
      startDate: startDateStr,
      endDate: endDateStr
    };
    
    debug(`✅ Personal rates computed`);
    res.json(response);
  } catch (error) {
    // keep as error-level
    res.status(500).json({ error: 'Failed to calculate personal rates' });
  }
});

// GET /api/goals/:userId/:year/:month - Get goal for specific month
// Optional query parameter: goalType (personal, mga, rga) - defaults to personal
router.get('/:userId/:year/:month', async (req, res) => {
  const { userId, year, month } = req.params;
  const { goalType } = req.query;
  const startedAt = Date.now();
  const hasAuthHeader = !!(req.headers.authorization || req.headers['x-access-token']);
  const resolvedUser = req.user?.userId || req.userId || null;
  const finalGoalType = normalizeGoalType(goalType);
  debug(`\n🎯 GOAL LOOKUP: ${year}-${month} (${finalGoalType})`, {
    paramUserId: userId,
    resolvedUserId: resolvedUser,
    goalType: finalGoalType,
    hasAuthHeader,
    env: process.env.NODE_ENV
  });
  const slowWatch = setTimeout(() => {
    debugWarn(`[GOALS] ⚠️ Slow response (>3000ms) for user=${userId} ${year}-${month}`);
  }, 3000);
  
  try {
    // Validate parameters
    if (!userId || !year || !month) {
      return res.status(400).json({ error: 'Missing required parameters: userId, year, month' });
    }
    
    const sql = `
      SELECT * FROM production_goals 
      WHERE activeUserId = ? AND year = ? AND month = ? AND goal_type = ?
    `;
    
    debug(`📋 SQL: ${sql.replace(/\s+/g, ' ').trim()}`);
    debug(`📋 Params: [${userId}, ${year}, ${month}, ${finalGoalType}]`);
    
    const queryStart = Date.now();
    const results = await query(sql, [userId, year, month, finalGoalType]);
    const queryMs = Date.now() - queryStart;
    debug(`[GOALS] ✅ DB query completed in ${queryMs}ms (rows=${results.length})`);
    
    if (results.length === 0) {
      clearTimeout(slowWatch);
      debug(`[GOALS] ⏱️ Total handler time: ${Date.now() - startedAt}ms`);
      return res.json(null);
    }
    
    debug(`✅ Goal found! ID: ${results[0].id}, ALP: $${results[0].monthlyAlpGoal}`);
    
    const goal = results[0];
    
    // Safely parse JSON fields
    try {
      if (goal.customRates && typeof goal.customRates === 'string') {
        goal.customRates = JSON.parse(goal.customRates);
      }
      if (goal.workingDays && typeof goal.workingDays === 'string') {
        goal.workingDays = JSON.parse(goal.workingDays);
      }
    } catch (parseError) {
      debugWarn('⚠️ JSON parse error (continuing):', parseError.message);
    }
    
    clearTimeout(slowWatch);
    debug(`[GOALS] ⏱️ Total handler time: ${Date.now() - startedAt}ms`);
    res.json(goal);
  } catch (error) {
    clearTimeout(slowWatch);
    // keep as error-level
    res.status(500).json({ 
      error: 'Failed to fetch goal',
      message: 'Server error occurred'
    });
  }
});

// POST /api/goals - Save/update goal
router.post('/', async (req, res) => {
  const { userId, year, month, monthlyAlpGoal, goalType, workingDays, rateSource, customRates } = req.body;
  const finalGoalType = normalizeGoalType(goalType);
  debug(`\n💾 SAVE GOAL: User ${userId} for ${year}-${month} (${finalGoalType}) - $${monthlyAlpGoal} ALP`);
  
  try {
    if (!userId || !year || !month || !monthlyAlpGoal) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // First, let's see what goals currently exist for this user/month
    const allExistingSql = `
      SELECT id, goal_type FROM production_goals 
      WHERE activeUserId = ? AND year = ? AND month = ?
    `;
    
    const allExisting = await query(allExistingSql, [userId, year, month]);
    debug(`🔍 Current goals for user ${userId} (${year}-${month}):`, allExisting.map(g => `${g.goal_type}(${g.id})`).join(', '));
    
    // Check if goal already exists for this specific goal type
    const existingSql = `
      SELECT id FROM production_goals 
      WHERE activeUserId = ? AND year = ? AND month = ? AND goal_type = ?
    `;
    
    const existing = await query(existingSql, [userId, year, month, finalGoalType]);
    debug(`🎯 Existing ${finalGoalType} goal:`, existing.length > 0 ? `ID ${existing[0].id}` : 'None');
    
    const customRatesJson = customRates ? JSON.stringify(customRates) : null;
    const workingDaysJson = workingDays ? JSON.stringify(workingDays) : null;
    
    debug(`📊 ${workingDays?.length || 0} working days, ${rateSource} rates`);
    
    if (existing.length > 0) {
      debug(`📝 Updating existing goal (ID: ${existing[0].id})`);
      const updateSql = `
        UPDATE production_goals 
        SET monthlyAlpGoal = ?, workingDays = ?, rateSource = ?, customRates = ?, updatedAt = NOW()
        WHERE activeUserId = ? AND year = ? AND month = ? AND goal_type = ?
      `;
      
      await query(updateSql, [monthlyAlpGoal, workingDaysJson, rateSource, customRatesJson, userId, year, month, finalGoalType]);
      debug('✅ Goal updated successfully');
    } else {
      debug('📝 Creating new goal');
      const insertSql = `
        INSERT INTO production_goals (
          activeUserId, year, month, monthlyAlpGoal, goal_type, workingDays, rateSource, customRates, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      await query(insertSql, [userId, year, month, monthlyAlpGoal, finalGoalType, workingDaysJson, rateSource, customRatesJson]);
      debug('✅ Goal created successfully');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Save goal error:', error.message);
    
    // Handle duplicate entry errors specifically
    if (error.code === 'ER_DUP_ENTRY') {
      debugWarn('🔄 Duplicate entry detected - this means the database constraint needs to be fixed');
      debugWarn('🔍 Error details:', error.sqlMessage || error.message);
      
      // Check what constraint is causing the issue
      if (error.sqlMessage && error.sqlMessage.includes('unique_user_month_year')) {
        debugWarn('❌ Old constraint still exists! Database migration required.');
        
        return res.status(409).json({ 
          error: 'Database constraint prevents multiple goal types',
          message: 'The database constraint needs to be updated to allow MGA and RGA team goals',
          solution: 'Run this SQL: ALTER TABLE production_goals DROP INDEX unique_user_month_year; ALTER TABLE production_goals ADD UNIQUE KEY unique_user_month_type (activeUserId, year, month, goal_type);',
          goalType: finalGoalType
        });
      }
      
      // If it's a different constraint issue, try the workaround
      try {
        const customRatesJson = customRates ? JSON.stringify(customRates) : null;
        const workingDaysJson = workingDays ? JSON.stringify(workingDays) : null;
        
        // Force update by finding any existing goal for this user/month and updating with new goal_type
        const forceUpdateSql = `
          INSERT INTO production_goals (
            activeUserId, year, month, monthlyAlpGoal, goal_type, workingDays, rateSource, customRates, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            monthlyAlpGoal = VALUES(monthlyAlpGoal),
            workingDays = VALUES(workingDays),
            rateSource = VALUES(rateSource),
            customRates = VALUES(customRates),
            updatedAt = NOW()
        `;
        
        await query(forceUpdateSql, [userId, year, month, monthlyAlpGoal, finalGoalType, workingDaysJson, rateSource, customRatesJson]);
        debug(`✅ Workaround successful - ${finalGoalType} goal saved`);
        
        return res.json({ 
          success: true, 
          message: `${finalGoalType.toUpperCase()} goal saved successfully (via workaround)`,
          warning: 'Database constraints should be updated for optimal performance'
        });
      } catch (forceError) {
        console.error('Workaround also failed:', forceError.message);
        return res.status(500).json({ 
          error: 'Unable to save goal due to database constraints',
          details: 'Please update database constraints to allow multiple goal types per user'
        });
      }
    }
    
    res.status(500).json({ error: 'Failed to save goal', details: error.message });
  }
});

// POST /api/goals/bulk - Get all goals for multiple users at once, or all goals for specific years
router.post('/bulk', async (req, res) => {
  try {
    const { userIds, years, goalType } = req.body;
    
    let sql;
    let params = [];
    
    // If years are provided, fetch all goals for those years (optionally filtered by userIds)
    if (years && Array.isArray(years) && years.length > 0) {
      const yearPlaceholders = years.map(() => '?').join(',');
      
      if (userIds && Array.isArray(userIds) && userIds.length > 0) {
        // Fetch goals for specific users and years
        const userPlaceholders = userIds.map(() => '?').join(',');
        sql = `
          SELECT * FROM production_goals 
          WHERE year IN (${yearPlaceholders}) 
          AND activeUserId IN (${userPlaceholders})
          ${goalType ? 'AND goal_type = ?' : ''}
          ORDER BY year DESC, month DESC
        `;
        params = goalType ? [...years, ...userIds, goalType] : [...years, ...userIds];
      } else {
        // Fetch ALL goals for the specified years
        sql = `
          SELECT * FROM production_goals 
          WHERE year IN (${yearPlaceholders})
          ${goalType ? 'AND goal_type = ?' : ''}
          ORDER BY year DESC, month DESC
        `;
        params = goalType ? [...years, goalType] : years;
      }
    } else if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // Original behavior: fetch goals for specific users
      const placeholders = userIds.map(() => '?').join(',');
      sql = `
        SELECT * FROM production_goals 
        WHERE activeUserId IN (${placeholders})
        ${goalType ? 'AND goal_type = ?' : ''}
        ORDER BY year DESC, month DESC
      `;
      params = goalType ? [...userIds, goalType] : userIds;
    } else {
      return res.status(400).json({ error: 'Either userIds or years array is required' });
    }
    
    const results = await query(sql, params);
    
    // Parse JSON fields for each goal and ensure goal_type is set
    const goals = results.map(goal => {
      if (goal.customRates && typeof goal.customRates === 'string') {
        goal.customRates = JSON.parse(goal.customRates);
      }
      if (goal.workingDays && typeof goal.workingDays === 'string') {
        goal.workingDays = JSON.parse(goal.workingDays);
      }
      // Ensure goal_type is normalized for consistency
      goal.goal_type = normalizeGoalType(goal.goal_type);
      return goal;
    });
    
    debug(`📦 Bulk goals fetched: ${goals.length} goals (years: ${years || 'N/A'}, users: ${userIds?.length || 'all'}, goalType: ${goalType || 'all'})`);
    res.json(goals);
  } catch (error) {
    console.error('Error fetching bulk user goals:', error);
    res.status(500).json({ error: 'Failed to fetch bulk goals' });
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
    
    // Parse JSON fields for each goal and ensure goal_type is set
    const goals = results.map(goal => {
      if (goal.customRates) {
        goal.customRates = JSON.parse(goal.customRates);
      }
      if (goal.workingDays) {
        goal.workingDays = JSON.parse(goal.workingDays);
      }
      // Ensure goal_type is normalized for consistency
      goal.goal_type = normalizeGoalType(goal.goal_type);
      return goal;
    });
    
    res.json(goals);
  } catch (error) {
    console.error('Error fetching user goals:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// POST /api/goals/team-alp - Get ALP data for multiple users efficiently
router.post('/team-alp', async (req, res) => {
  const { userIds, year, month } = req.body;
  debug(`\n👥 TEAM ALP: Getting data for ${userIds?.length || 0} users for ${year}-${month}`);
  
  try {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array is required' });
    }
    
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month are required' });
    }
    
    // Get date range for the specified month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    debug(`📅 Date range: ${startDateStr} to ${endDateStr}`);
    debug(`👥 User IDs: ${userIds.join(', ')}`);
    
    // Create placeholders for the IN clause
    const placeholders = userIds.map(() => '?').join(',');
    
    // Query to get ALP totals for all users in one go
    const sql = `
      SELECT 
        userId,
        SUM(alp) as totalAlp,
        COUNT(*) as recordCount
      FROM Daily_Activity 
      WHERE userId IN (${placeholders})
        AND reportDate >= ? 
        AND reportDate <= ?
      GROUP BY userId
    `;
    
    const queryParams = [...userIds, startDateStr, endDateStr];
    const results = await query(sql, queryParams);
    
    debug(`📊 Found ALP data for ${results.length} users`);
    
    // Convert results to a map for easy lookup
    const alpData = {};
    results.forEach(row => {
      alpData[row.userId] = {
        totalAlp: parseFloat(row.totalAlp) || 0,
        recordCount: parseInt(row.recordCount) || 0
      };
    });
    
    // Ensure all requested users have an entry (even if 0)
    userIds.forEach(userId => {
      if (!alpData[userId]) {
        alpData[userId] = {
          totalAlp: 0,
          recordCount: 0
        };
      }
    });
    
    debug(`✅ Returning ALP data for ${Object.keys(alpData).length} users`);
    res.json(alpData);
    
  } catch (error) {
    console.error('❌ Error fetching team ALP data:', error);
    res.status(500).json({ error: 'Failed to fetch team ALP data' });
  }
});

module.exports = router; 