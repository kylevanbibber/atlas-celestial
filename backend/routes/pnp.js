const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
/**
 * GET /api/pnp/user-retention
 * Get latest PnP retention metrics for a specific user across agent_num suffixes -1, -2, -3
 * Query params: lagnName (required)
 */
router.get('/user-retention', verifyToken, async (req, res) => {
  try {
    const { lagnName } = req.query;
    if (!lagnName) {
      return res.status(400).json({ success: false, message: 'lagnName is required' });
    }

    // Helper to fetch latest row for a given suffix
    const fetchForSuffix = async (suffix) => {
      const q = `
        SELECT 
          name_line,
          agent_num,
          date,
          curr_mo_net_submit,
          cur_ytd_life_net_submit,
          first_6_mo_net_submit,
          first_6_ytd_net,
          curr_mo_4mo_rate,
          proj_plus_1_4mo_rate,
          proj_plus_2_4mo_rate
        FROM pnp
        WHERE (name_line = ? OR ? LIKE CONCAT(name_line, ' %'))
          AND agent_num LIKE ?
        ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC
        LIMIT 1
      `;
      const rows = await db.query(q, [lagnName, lagnName, `%${suffix}`]);
      return rows && rows[0] ? rows[0] : null;
    };

    const [lvl1, lvl2, lvl3] = await Promise.all([
      fetchForSuffix('-1'),
      fetchForSuffix('-2'),
      fetchForSuffix('-3')
    ]);

    // Additionally, return all rows from the most current month for this user (covers -3, -4, -5 etc.)
    let rgaAll = [];
    try {
      const latestDateRows = await db.query(`
        SELECT STR_TO_DATE(date, '%m/%d/%y') AS d
        FROM pnp
        WHERE (name_line = ? OR ? LIKE CONCAT(name_line, ' %'))
        ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC
        LIMIT 1
      `, [lagnName, lagnName]);
      if (latestDateRows && latestDateRows[0] && latestDateRows[0].d) {
        const latest = new Date(latestDateRows[0].d);
        const year = latest.getFullYear();
        const month = latest.getMonth() + 1;
        rgaAll = await db.query(`
          SELECT 
            name_line,
            agent_num,
            date,
            curr_mo_net_submit,
            cur_ytd_life_net_submit,
            first_6_mo_net_submit,
            first_6_ytd_net,
            curr_mo_4mo_rate,
            proj_plus_1_4mo_rate,
            proj_plus_2_4mo_rate
          FROM pnp
          WHERE (name_line = ? OR ? LIKE CONCAT(name_line, ' %'))
            AND YEAR(STR_TO_DATE(date, '%m/%d/%y')) = ?
            AND MONTH(STR_TO_DATE(date, '%m/%d/%y')) = ?
          ORDER BY 
            CASE 
              WHEN agent_num REGEXP '-([0-9]+)$' THEN CAST(SUBSTRING_INDEX(agent_num, '-', -1) AS UNSIGNED)
              ELSE 999
            END ASC,
            STR_TO_DATE(date, '%m/%d/%y') DESC
        `, [lagnName, lagnName, year, month]);
      }
    } catch (e) {
      // Non-fatal
    }

    return res.json({ success: true, data: { lvl1, lvl2, lvl3, rgaAll } });
  } catch (err) {
    console.error('[pnp] /user-retention error:', err);
    return res.status(500).json({ success: false, message: 'Error fetching retention data' });
  }
});

/**
 * GET /api/pnp/dates
 * Get all available dates for PnP data
 */
router.get('/dates', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT date 
      FROM pnp 
      WHERE agent_num LIKE '%-1'
        AND date IS NOT NULL 
      ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC
    `;
    
    const results = await db.query(query);
    const dates = results.map(row => row.date);
    
    res.json({
      success: true,
      dates: dates
    });
  } catch (error) {
    console.error('Error fetching PnP dates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching PnP dates',
      error: error.message
    });
  }
});

/**
 * GET /api/pnp/data
 * Get PnP data for a specific date
 */
router.get('/data', verifyToken, async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }
    
    const query = `
      SELECT 
        id,
        date,
        name_line,
        agent_num,
        esid,
        curr_mo_grs_submit,
        curr_mo_net_submit,
        curr_mo_pct,
        past_12_mo_life_grs_submit,
        past_12_mo_life_net_submit,
        past_12_mo_life_pct,
        cur_ytd_life_grs_submit,
        cur_ytd_life_net_submit,
        cur_ytd_pct,
        curr_mo_submit,
        curr_mo_net_iss,
        curr_mo_net_sub,
        curr_mo_paid4mo,
        curr_mo_4mo_rate,
        proj_plus_1,
        proj_plus_1_months,
        proj_plus_1_submit,
        proj_plus_1_net_iss,
        proj_plus_1_net_sub,
        proj_plus_1_paid4mo,
        proj_plus_1_4mo_rate,
        proj_plus_2,
        proj_plus_2_months,
        proj_plus_2_submit,
        proj_plus_2_net_iss,
        proj_plus_2_net_sub,
        proj_plus_2_paid4mo,
        proj_plus_2_4mo_rate,
        lvlnum
      FROM pnp 
      WHERE date = ? 
        AND agent_num LIKE '%-1'
      ORDER BY name_line ASC
    `;
    
    const results = await db.query(query, [date]);
    
    res.json({
      success: true,
      data: results,
      date: date
    });
  } catch (error) {
    console.error('Error fetching PnP data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching PnP data',
      error: error.message
    });
  }
});

/**
 * GET /api/pnp/summary
 * Get summary statistics for a specific date
 */
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }
    
    const query = `
      SELECT 
        COUNT(*) as total_records,
        SUM(CAST(REPLACE(NULLIF(NULLIF(curr_mo_grs_submit, ''), 'N/A'), ',', '') AS DECIMAL(15,2))) as total_curr_mo_grs,
        SUM(CAST(REPLACE(NULLIF(NULLIF(curr_mo_net_submit, ''), 'N/A'), ',', '') AS DECIMAL(15,2))) as total_curr_mo_net,
        AVG(CAST(REPLACE(NULLIF(NULLIF(curr_mo_pct, ''), 'N/A'), ',', '') AS DECIMAL(5,2))) as avg_curr_mo_pct,
        SUM(CAST(REPLACE(NULLIF(NULLIF(past_12_mo_life_grs_submit, ''), 'N/A'), ',', '') AS DECIMAL(15,2))) as total_12mo_grs,
        SUM(CAST(REPLACE(NULLIF(NULLIF(past_12_mo_life_net_submit, ''), 'N/A'), ',', '') AS DECIMAL(15,2))) as total_12mo_net,
        AVG(CAST(REPLACE(NULLIF(NULLIF(past_12_mo_life_pct, ''), 'N/A'), ',', '') AS DECIMAL(5,2))) as avg_12mo_pct
      FROM pnp 
      WHERE date = ? 
        AND agent_num LIKE '%-1'
    `;
    
    const results = await db.query(query, [date]);
    
 
    
    res.json({
      success: true,
      summary: results[0],
      date: date
    });
  } catch (error) {
    console.error('Error fetching PnP summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching PnP summary',
      error: error.message
    });
  }
});

/**
 * GET /api/pnp/test
 * Test endpoint to check PnP table structure and recent data
 */
router.get('/test', verifyToken, async (req, res) => {
  try {
    // Get sample PnP data to understand structure
    const testQuery = `
      SELECT 
        date,
        name_line,
        esid,
        curr_mo_net_submit,
        curr_mo_4mo_rate,
        cur_ytd_pct,
        agent_num
      FROM pnp 
      WHERE agent_num LIKE '%-1'
        AND curr_mo_net_submit IS NOT NULL
        AND curr_mo_net_submit != ''
        AND curr_mo_net_submit != 'N/A'
      ORDER BY date DESC, name_line ASC
      LIMIT 10
    `;
    
    const results = await db.query(testQuery);
    
    // Also check available dates
    const datesQuery = `
      SELECT DISTINCT date 
      FROM pnp 
      WHERE agent_num LIKE '%-1'
      ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC
      LIMIT 20
    `;
    
    const dates = await db.query(datesQuery);
    
    res.json({
      success: true,
      sampleData: results,
      availableDates: dates.map(d => d.date),
      recordCount: results.length
    });
  } catch (error) {
    console.error('❌ Error in PnP test endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing PnP data',
      error: error.message
    });
  }
});

/**
 * GET /api/pnp/allotment
 * Get allotment data by joining PnP data with activeusers (2-month lag)
 */
router.get('/allotment', verifyToken, async (req, res) => {
  // Initialize variables outside try block for error handling
  let targetMonth, targetYear, fullTargetYear, targetMonthPattern, monthlyAlpPattern, currentDateFormatted;
  let refValidationMonth1, refValidationMonth2, refValidationPattern1, refValidationPattern2;
  
  try {
    const now = new Date();
    const currentDate = new Date(); // For licensed_states expiry comparison
    
    // Allow overriding the allotment month via query parameter (format: YYYY-MM)
    const requestedMonth = req.query.targetMonth;
    let targetDate;
    
    if (requestedMonth) {
      // Parse requested month (e.g., "2025-01" for January 2025)
      const [year, month] = requestedMonth.split('-').map(Number);
      targetDate = new Date(year, month - 1, 1);
      console.log(`📅 Using requested allotment month: ${requestedMonth}`);
    } else {
      // Default: 2 months from now (current behavior)
      targetDate = new Date(now.getFullYear(), now.getMonth() + 2, 1);
      console.log(`📅 Using default allotment month: 2 months from now`);
    }
    
    targetMonth = (targetDate.getMonth() + 1).toString().padStart(2, '0');
    fullTargetYear = targetDate.getFullYear();
    targetYear = fullTargetYear.toString().slice(-2);
    
    // Check if custom settings exist for this month
    const targetMonthFormatted = `${fullTargetYear}-${targetMonth}`;
    const settingsQuery = await db.query(
      'SELECT * FROM allotment_settings WHERE target_month = ?',
      [targetMonthFormatted]
    );
    
    let alpMonthsToUse = [];
    let refMonthsToUse = [];
    let vipMonthsToUse = [];
    let useCustomSettings = false;
    
    if (settingsQuery.length > 0) {
      // Custom settings exist - use them
      const settings = settingsQuery[0];
      alpMonthsToUse = JSON.parse(settings.alp_months || '[]');
      refMonthsToUse = JSON.parse(settings.ref_months || '[]');
      vipMonthsToUse = JSON.parse(settings.vip_months || '[]');
      useCustomSettings = true;
      console.log(`⚙️ Using custom settings for ${targetMonthFormatted}:`, {
        alpMonths: alpMonthsToUse,
        refMonths: refMonthsToUse
      });
    } else {
      // No custom settings - use default (single month, prev-prev month)
      const defaultSourceDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 2, 1);
      const defaultMonth = `${defaultSourceDate.getFullYear()}-${String(defaultSourceDate.getMonth() + 1).padStart(2, '0')}`;
      alpMonthsToUse = [defaultMonth];
      refMonthsToUse = [defaultMonth];
      vipMonthsToUse = [defaultMonth];
      console.log(`📅 Using default settings (prev-prev month): ${defaultMonth}`);
    }
    
    // Convert YYYY-MM format to MM/YYYY format for Monthly_ALP queries
    const monthlyAlpPatterns = alpMonthsToUse.map(month => {
      const [year, mon] = month.split('-');
      return `${mon}/${year}`;
    });
    
    // Convert YYYY-MM format to YYYY-MM format for refvalidation queries (already in correct format)
    const refValidationPatterns = refMonthsToUse;
    
    // Convert YYYY-MM format to MM/YYYY for VIP queries
    const vipMonthPatterns = vipMonthsToUse.map(month => {
      const [year, mon] = month.split('-');
      return `${mon}/${year}`;
    });
    
    // For backwards compatibility, set these variables
    const monthlyAlpPattern1 = monthlyAlpPatterns[0] || '';
    const monthlyAlpPattern2 = monthlyAlpPatterns[1] || monthlyAlpPatterns[0] || '';
    monthlyAlpPattern = monthlyAlpPattern1;
    
    refValidationMonth1 = refValidationPatterns[0] ? refValidationPatterns[0].split('-')[1] : '';
    refValidationMonth2 = refValidationPatterns[1] ? refValidationPatterns[1].split('-')[1] : refValidationPatterns[0] ? refValidationPatterns[0].split('-')[1] : '';
    refValidationPattern1 = refValidationPatterns[0] || '';
    refValidationPattern2 = refValidationPatterns[1] || refValidationPatterns[0] || '';
    
    // Calculate the previous month for prev month grouping (used for comparison)
    const prevMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 3, 1);
    const prevMonth = (prevMonthDate.getMonth() + 1).toString().padStart(2, '0');
    const prevMonthYear = prevMonthDate.getFullYear();
    const prevMonthAlpPattern = `${prevMonth}/${prevMonthYear}`;
    
    // Format for PnP table (mm/%/yy pattern - any day in the first source month)
    const firstAlpMonth = alpMonthsToUse[0].split('-');
    targetMonthPattern = `${firstAlpMonth[1]}/%/${firstAlpMonth[0].slice(-2)}`;
    
    // Format current date for licensed_states comparison (mm/dd/yyyy)
    const currentDateFormatted = `${String(currentDate.getMonth() + 1).padStart(2, '0')}/${String(currentDate.getDate()).padStart(2, '0')}/${currentDate.getFullYear()}`;
    
    console.log(`🔍 Allotment month: ${targetMonth}/${fullTargetYear}, Based on ALP: ${monthlyAlpPatterns.join(' + ')}, Refs from: ${refValidationPatterns.join(' + ')}`);
    
    console.log(`🔍 Fetching allotment data - Monthly_ALP: ${monthlyAlpPatterns.join(' + ')}, RefValidation: ${refValidationPatterns.join(' + ')}, Licensed States cutoff: ${currentDateFormatted}, Using ${useCustomSettings ? 'CUSTOM' : 'DEFAULT'} settings`);

    // First, let's debug what we're working with from Monthly_ALP (summed from source months)
    const placeholders = monthlyAlpPatterns.map(() => '?').join(',');
    const debugQuery = `
      SELECT 
        LagnName,
        SUM(LVL_1_GROSS) as LVL_1_GROSS,
        MAX(MGA_NAME) as MGA_NAME,
        GROUP_CONCAT(DISTINCT month ORDER BY month) as months
      FROM Monthly_ALP 
      WHERE month IN (${placeholders})
        AND LagnName IS NOT NULL
        AND LagnName != ''
      GROUP BY LagnName
      ORDER BY LagnName ASC
      LIMIT 5
    `;
    
    const debugResults = await db.query(debugQuery, monthlyAlpPatterns);
    console.log(`🔍 DEBUG: Sample Monthly_ALP data (GROSS summed from ${monthlyAlpPatterns.join(' + ')}):`, debugResults);

    // Check for name matching between Monthly_ALP and activeusers
    if (debugResults.length > 0) {
      console.log(`🔍 DEBUG: Testing name matching for first Monthly_ALP agent: ${debugResults[0].LagnName}`);
      
      const nameMatchQuery = `
        SELECT 
          au.lagnname, 
          au.esid, 
          au.id,
          UPPER(TRIM(au.lagnname)) as normalized_au_name,
          UPPER(TRIM(?)) as normalized_ma_name,
          CASE 
            WHEN UPPER(TRIM(au.lagnname)) = UPPER(TRIM(?)) THEN 'MATCH' 
            ELSE 'NO_MATCH' 
          END as match_status
        FROM activeusers au 
        WHERE UPPER(TRIM(au.lagnname)) = UPPER(TRIM(?))
        LIMIT 5
      `;
      
      const testAgent = debugResults[0].LagnName;
      const nameMatchResults = await db.query(nameMatchQuery, [testAgent, testAgent, testAgent]);
      console.log(`🔍 DEBUG: ActiveUsers matches for "${testAgent}":`, nameMatchResults);
      
      if (nameMatchResults.length === 0) {
        console.log(`❌ DEBUG: No activeusers match found for "${testAgent}" - this explains 0 results!`);
        
        // Let's see what activeusers names are similar
        const similarNamesQuery = `
          SELECT lagnname, UPPER(TRIM(lagnname)) as normalized_name
          FROM activeusers 
          WHERE lagnname LIKE ?
          LIMIT 5
        `;
        const similarResults = await db.query(similarNamesQuery, [`%${testAgent.split(' ')[0]}%`]);
        console.log(`🔍 DEBUG: Similar activeusers names:`, similarResults);
      }
    }

    // Check for MARKINS CONOR N specifically to debug the 31,191 vs 0.0 discrepancy (both months)
    const markinsQuery = `
      SELECT 
        LagnName,
        MGA_NAME,
        CTLNO,
        LVL_1_NET,
        LVL_1_GROSS,
        LVL_2_NET,
        LVL_3_NET,
        month 
      FROM Monthly_ALP 
      WHERE LagnName = 'MARKINS CONOR N' 
        AND month IN (${placeholders})
      ORDER BY month DESC, LVL_1_GROSS DESC
    `;
    
    const markinsResults = await db.query(markinsQuery, monthlyAlpPatterns);
    console.log(`🔍 DEBUG: MARKINS CONOR N records for ${monthlyAlpPatterns.join(' + ')}:`, markinsResults);
    
    if (markinsResults.length > 0) {
      const totalAlpGross = markinsResults.reduce((sum, r) => sum + (parseFloat(r.LVL_1_GROSS) || 0), 0);
      console.log(`📊 MARKINS CONOR N total GROSS ALP from all source months: $${totalAlpGross.toLocaleString()}`);
      markinsResults.forEach((r, i) => {
        console.log(`   ${i+1}. Month: ${r.month}, LVL_1_GROSS: ${r.LVL_1_GROSS}, LVL_1_NET: ${r.LVL_1_NET}, MGA_NAME: ${r.MGA_NAME}`);
      });
    } else {
      console.log(`❌ No Monthly_ALP records found for MARKINS CONOR N in ${monthlyAlpPatterns.join(' + ')}`);
    }
    
    // Debug: Check if PnP data exists for a specific agent
    if (debugResults.length > 0) {
      const testAgent = debugResults[0];
      console.log(`🔍 DEBUG: Checking PnP data for test agent: ${testAgent.LagnName}`);
      
      const pnpCheckQuery = `
        SELECT 
          name_line,
          esid,
          date,
          agent_num,
          curr_mo_net_submit,
          DATE_FORMAT(STR_TO_DATE(esid, '%m/%d/%y'), '%Y-%m-%d') as converted_esid
        FROM pnp 
        WHERE UPPER(TRIM(name_line)) = UPPER(TRIM(?))
          AND agent_num LIKE '%-1'
        ORDER BY date DESC
        LIMIT 5
      `;
      
      const pnpCheck = await db.query(pnpCheckQuery, [testAgent.LagnName]);
      console.log(`🔍 DEBUG: PnP records for ${testAgent.LagnName}:`, pnpCheck);
      
      if (pnpCheck.length === 0) {
        console.log(`❌ DEBUG: No PnP records found for ${testAgent.LagnName} with agent_num ending in -1`);
      } else {
        console.log(`✅ DEBUG: Found ${pnpCheck.length} PnP records for ${testAgent.LagnName}`);
        
        // Show all PnP records for this agent (no longer filtering by month)
        console.log(`🔍 DEBUG: All PnP record dates for ${testAgent.LagnName}:`, 
          pnpCheck.map(p => ({ date: p.date, esid: p.esid, converted_esid: p.converted_esid }))
        );
      }
    }
    
    // Also check some activeusers data for comparison
    const activeUsersDebugQuery = `
      SELECT lagnname, esid, mga, id
      FROM activeusers 
      WHERE lagnname IS NOT NULL 
        AND esid IS NOT NULL 
      ORDER BY lagnname ASC 
      LIMIT 5
    `;
    
    const activeUsersDebug = await db.query(activeUsersDebugQuery);
    console.log(`🔍 DEBUG: Sample ActiveUsers data:`, activeUsersDebug);

    // Fetch previous month's Monthly_ALP data for prev month group calculation
    console.log(`🔍 DEBUG: Fetching previous month GROSS ALP data for ${prevMonthAlpPattern}...`);
    const prevMonthAlpQuery = `
      SELECT 
        LagnName,
        LVL_1_GROSS,
        CL_Name,
        ROW_NUMBER() OVER (
          PARTITION BY LagnName 
          ORDER BY 
            CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END,
            LVL_1_GROSS DESC
        ) as rn
      FROM Monthly_ALP 
      WHERE month = ?
        AND LagnName IS NOT NULL
        AND LagnName != ''
    `;
    
    const prevMonthAlpData = await db.query(prevMonthAlpQuery, [prevMonthAlpPattern]);
    console.log(`📊 DEBUG: Found ${prevMonthAlpData.length} prev month ALP records`);
    
    // Calculate previous month groups (ALP >= 3000 divided into 5 groups)
    // First, get exactly one record per LagnName (preferring CL_Name = 'MGA')
    const oneRecordPerAgent = prevMonthAlpData.filter(r => r.rn === 1);
    console.log(`📊 DEBUG: Prev month - ${prevMonthAlpData.length} total records → ${oneRecordPerAgent.length} unique agents`);
    
    // Check for MGA preference working
    const mgaRecords = oneRecordPerAgent.filter(r => r.CL_Name === 'MGA');
    const nonMgaRecords = oneRecordPerAgent.filter(r => r.CL_Name !== 'MGA');
    console.log(`🔍 DEBUG: Prev month record selection - ${mgaRecords.length} MGA records, ${nonMgaRecords.length} non-MGA records`);
    
    // Filter high performers (>= 3000 ALP GROSS) and sort by LVL_1_GROSS descending
    const prevMonthHighPerformers = oneRecordPerAgent
      .filter(r => parseFloat(r.LVL_1_GROSS) >= 3000) // High performers only (GROSS)
      .sort((a, b) => parseFloat(b.LVL_1_GROSS) - parseFloat(a.LVL_1_GROSS)); // Sort by GROSS ALP desc
    
    const prevMonthGroupSize = Math.ceil(prevMonthHighPerformers.length / 5);
    const prevMonthGroupLookup = {};
    
    prevMonthHighPerformers.forEach((agent, index) => {
      const groupNumber = Math.floor(index / prevMonthGroupSize) + 1;
      prevMonthGroupLookup[agent.LagnName] = Math.min(groupNumber, 5); // Ensure max group 5
    });
    
    console.log(`🔢 DEBUG: Prev month groups - ${prevMonthHighPerformers.length} high performers, ${prevMonthGroupSize} per group`);
    console.log(`🔍 DEBUG: Prev month group distribution:`, 
      Array.from({length: 5}, (_, i) => ({
        group: i + 1,
        count: Object.values(prevMonthGroupLookup).filter(g => g === i + 1).length
      }))
    );
    
    // Verify we have exactly one record per LagnName in previous month data
    const prevUniqueAgents = new Set(oneRecordPerAgent.map(r => r.LagnName));
    const prevDuplicateCheck = oneRecordPerAgent.length === prevUniqueAgents.size;
    console.log(`✅ VERIFICATION: Prev month - ${oneRecordPerAgent.length} records, ${prevUniqueAgents.size} unique agents, no duplicates: ${prevDuplicateCheck}`);
    
    // Sample prev month groups with their selection details
    const samplePrevGroups = Object.entries(prevMonthGroupLookup).slice(0, 5);
    console.log(`🔍 DEBUG: Sample prev month groups:`, samplePrevGroups);
    
    // Show sample of selected records to verify MGA preference and single record per agent
    const sampleSelectedRecords = prevMonthHighPerformers.slice(0, 3).map(r => ({
      LagnName: r.LagnName,
      LVL_1_GROSS: r.LVL_1_GROSS,
      CL_Name: r.CL_Name,
      selectedAsRank: r.rn // Should always be 1
    }));
    console.log(`🔍 DEBUG: Sample prev month selected records (showing MGA preference, GROSS ALP):`, sampleSelectedRecords);

    const query = `
      SELECT 
        -- Monthly_ALP data (GROSS ALP summed from 2 months)
        ma.LagnName,
        ma.LVL_1_GROSS,
        ma.MGA_NAME,
        ma.CL_Name,
        ma.CTLNO,
        ma.month as alp_month,
        
        -- ActiveUsers data
        au.id as agent_id,
        au.lagnname,
        au.mga as au_mga,
        au.esid as au_esid,
        au.Active,
        au.managerActive,
        
        -- PnP data
        p.name_line,
        p.esid as pnp_esid,
        p.date as pnp_date,
        p.agent_num,
        p.curr_mo_net_submit,
        p.curr_mo_4mo_rate,
        p.cur_ytd_pct,
        
        -- Debug fields
        p.converted_esid as converted_pnp_esid,
        
        -- Refvalidation data (combined 2 months of refs count)
        (
          SELECT COUNT(*)
          FROM refvalidation rv
          WHERE rv.agent_id = au.id
            AND DATE_FORMAT(rv.created_at, '%Y-%m') IN (?, ?)
            AND rv.true_ref = 'y'
        ) as prev_month_refs_count,
        
        -- Licensed states data (valid licenses)
        (
          SELECT GROUP_CONCAT(
            CONCAT(ls.state, ':', ls.expiry_date, ':', IFNULL(ls.resident_state, '0'))
            ORDER BY ls.state ASC
            SEPARATOR ';'
          )
          FROM licensed_states ls
          WHERE ls.userId = au.id
            AND STR_TO_DATE(ls.expiry_date, '%m/%d/%Y') > STR_TO_DATE(?, '%m/%d/%Y')
        ) as licensed_states_info,
        
        -- VIP count (each VIP = 5,000 ALP)
        (
          SELECT COUNT(*)
          FROM VIPs v
          WHERE v.count = 1
            AND DATE_FORMAT(v.vip_month, '%Y-%m') IN (?, ?)
            AND (
              (v.sa IS NOT NULL AND UPPER(TRIM(v.sa)) = UPPER(TRIM(au.lagnname)))
              OR (v.sa IS NULL AND v.ga IS NOT NULL AND UPPER(TRIM(v.ga)) = UPPER(TRIM(au.lagnname)))
              OR (v.sa IS NULL AND v.ga IS NULL AND v.mga IS NOT NULL AND UPPER(TRIM(v.mga)) = UPPER(TRIM(au.lagnname)))
            )
        ) as vip_count,
        
        -- VIP names for tooltip
        (
          SELECT GROUP_CONCAT(v.lagnname ORDER BY v.lagnname ASC SEPARATOR ', ')
          FROM VIPs v
          WHERE v.count = 1
            AND DATE_FORMAT(v.vip_month, '%Y-%m') IN (?, ?)
            AND (
              (v.sa IS NOT NULL AND UPPER(TRIM(v.sa)) = UPPER(TRIM(au.lagnname)))
              OR (v.sa IS NULL AND v.ga IS NOT NULL AND UPPER(TRIM(v.ga)) = UPPER(TRIM(au.lagnname)))
              OR (v.sa IS NULL AND v.ga IS NULL AND v.mga IS NOT NULL AND UPPER(TRIM(v.mga)) = UPPER(TRIM(au.lagnname)))
            )
        ) as vip_names
        
      FROM (
        SELECT 
          LagnName,
          SUM(LVL_1_GROSS) as LVL_1_GROSS,
          SUBSTRING_INDEX(GROUP_CONCAT(MGA_NAME ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, LVL_1_GROSS DESC SEPARATOR '|||'), '|||', 1) as MGA_NAME,
          SUBSTRING_INDEX(GROUP_CONCAT(CL_Name ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, LVL_1_GROSS DESC SEPARATOR '|||'), '|||', 1) as CL_Name,
          SUBSTRING_INDEX(GROUP_CONCAT(CTLNO ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, LVL_1_GROSS DESC SEPARATOR '|||'), '|||', 1) as CTLNO,
          MAX(month) as month
        FROM Monthly_ALP 
        WHERE month IN (${placeholders})
          AND LagnName IS NOT NULL
          AND LagnName != ''
        GROUP BY LagnName
      ) ma
      
      -- Join to ActiveUsers on name match
      INNER JOIN activeusers au ON (
        UPPER(TRIM(ma.LagnName)) = UPPER(TRIM(au.lagnname))
      )
      
      -- Join to PnP using proven flexible matching approach (from existing auth.js logic)
      LEFT JOIN (
        SELECT 
          name_line,
          esid,
          date,
          agent_num,
          curr_mo_net_submit,
          curr_mo_4mo_rate,
          cur_ytd_pct,
          DATE_FORMAT(STR_TO_DATE(esid, '%m/%d/%y'), '%Y-%m-%d') as converted_esid,
          ROW_NUMBER() OVER (PARTITION BY name_line, esid ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC) as rn
        FROM pnp 
        WHERE agent_num LIKE '%-1'
          AND curr_mo_net_submit IS NOT NULL
          AND curr_mo_net_submit != ''
          AND curr_mo_net_submit != 'N/A'
      ) p ON (
        (p.name_line = au.lagnname OR au.lagnname LIKE CONCAT(p.name_line, ' %'))
        AND p.rn = 1
        AND ABS(DATEDIFF(STR_TO_DATE(p.esid, '%m/%d/%y'), STR_TO_DATE(au.esid, '%Y-%m-%d'))) <= 7
      )
      
      WHERE au.lagnname IS NOT NULL
        AND au.esid IS NOT NULL
        
      ORDER BY ma.LagnName ASC
    `;
    
    // Test the basic Monthly_ALP to activeusers JOIN first
    const testJoinQuery = `
      SELECT COUNT(*) as join_count
      FROM (
        SELECT LagnName, MAX(month) as month
        FROM Monthly_ALP 
        WHERE month IN (${placeholders})
        GROUP BY LagnName
      ) ma
      INNER JOIN activeusers au ON (
        UPPER(TRIM(ma.LagnName)) = UPPER(TRIM(au.lagnname))
      )
    `;
    
    const joinTestResult = await db.query(testJoinQuery, monthlyAlpPatterns);
    console.log(`🔍 DEBUG: Basic Monthly_ALP -> activeusers JOIN test (using ${monthlyAlpPatterns.length} month(s)): ${joinTestResult[0].join_count} matches`);
    
    if (joinTestResult[0].join_count === 0) {
      console.log(`❌ DEBUG: The basic JOIN is returning 0 matches - this is the root cause!`);
      
      // Let's see some actual names from both tables for comparison
      const monthlyAlpNamesQuery = `SELECT DISTINCT LagnName FROM Monthly_ALP WHERE month IN (${placeholders}) LIMIT 10`;
      const activeUsersNamesQuery = `SELECT DISTINCT lagnname FROM activeusers LIMIT 10`;
      
      const maNames = await db.query(monthlyAlpNamesQuery, monthlyAlpPatterns);
      const auNames = await db.query(activeUsersNamesQuery);
      
      console.log(`🔍 DEBUG: Monthly_ALP names for ${monthlyAlpPatterns.join(' + ')}:`, maNames.map(r => r.LagnName));
      console.log(`🔍 DEBUG: ActiveUsers names (sample):`, auNames.map(r => r.lagnname));
    } else {
      console.log(`✅ DEBUG: Basic JOIN works with ${joinTestResult[0].join_count} matches - issue must be in subqueries`);
      
      // Test the query with subqueries step by step (updated to sum from 2 months)
      const queryWithoutSubqueries = `
        SELECT ma.LagnName, ma.LVL_1_GROSS, ma.MGA_NAME, ma.CL_Name, ma.CTLNO, ma.month as alp_month,
               au.id as agent_id, au.lagnname, au.mga as au_mga, au.esid as au_esid
        FROM (
          SELECT LagnName, SUM(LVL_1_GROSS) as LVL_1_GROSS,
                 SUBSTRING_INDEX(GROUP_CONCAT(MGA_NAME ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, LVL_1_GROSS DESC SEPARATOR '|||'), '|||', 1) as MGA_NAME,
                 SUBSTRING_INDEX(GROUP_CONCAT(CL_Name ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, LVL_1_GROSS DESC SEPARATOR '|||'), '|||', 1) as CL_Name,
                 SUBSTRING_INDEX(GROUP_CONCAT(CTLNO ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, LVL_1_GROSS DESC SEPARATOR '|||'), '|||', 1) as CTLNO,
                 MAX(month) as month
          FROM Monthly_ALP WHERE month IN (${placeholders})
          GROUP BY LagnName
        ) ma
        INNER JOIN activeusers au ON UPPER(TRIM(ma.LagnName)) = UPPER(TRIM(au.lagnname))
        LIMIT 5
      `;
      
      const withoutSubqueriesResult = await db.query(queryWithoutSubqueries, monthlyAlpPatterns);
      console.log(`🔍 DEBUG: Query WITHOUT subqueries (using ${monthlyAlpPatterns.length} month(s)) returns: ${withoutSubqueriesResult.length} records`);
      
      if (withoutSubqueriesResult.length > 0) {
        // Test RefValidation subquery
        const refPlaceholders = refValidationPatterns.map(() => '?').join(',');
        const testRefValidation = `
          SELECT COUNT(*) as ref_count
          FROM refvalidation rv 
          WHERE rv.agent_id = ? 
            AND DATE_FORMAT(rv.created_at, '%Y-%m') IN (${refPlaceholders})
            AND rv.true_ref = 'y'
        `;
        
        const testAgentId = withoutSubqueriesResult[0].agent_id;
        const refResult = await db.query(testRefValidation, [testAgentId, ...refValidationPatterns]);
        console.log(`🔍 DEBUG: RefValidation subquery test for agent ${testAgentId}: ${refResult[0].ref_count} refs (from ${refValidationPatterns.join(' + ')})`);
        
        // Test Licensed States subquery
        const testLicensedStates = `
          SELECT COUNT(*) as license_count
          FROM licensed_states ls 
          WHERE ls.userId = ? 
            AND STR_TO_DATE(ls.expiry_date, '%m/%d/%Y') > STR_TO_DATE(?, '%m/%d/%Y')
        `;
        
        const licenseResult = await db.query(testLicensedStates, [testAgentId, currentDateFormatted]);
        console.log(`🔍 DEBUG: Licensed States subquery test for agent ${testAgentId}: ${licenseResult[0].license_count} valid licenses`);
        
        console.log(`🔍 DEBUG: Both subqueries work individually - issue might be query complexity or timeout`);
      }
    }

    console.log(`🔍 Executing enhanced query with parameters:`, {
      monthlyAlpPatterns: monthlyAlpPatterns,
      refValidationPatterns: refValidationPatterns,
      vipMonthsForQuery: vipMonthsToUse,
      currentDateFormatted: currentDateFormatted,
      usingCustomSettings: useCustomSettings
    });
    
    let results;
    try {
      // Try simplified query first (without subqueries that might be causing timeout)
      const simplifiedQuery = `
        SELECT 
          -- Monthly_ALP data (GROSS ALP summed from source months)
          ma.LagnName,
          ma.LVL_1_GROSS,
          ma.MGA_NAME,
          ma.CL_Name,
          ma.CTLNO,
          ma.month as alp_month,
          
          -- ActiveUsers data
          au.id as agent_id,
          au.lagnname,
          au.mga as au_mga,
          au.esid as au_esid,
          au.Active,
          au.managerActive,
          
          -- PnP data
          p.name_line,
          p.esid as pnp_esid,
          p.date as pnp_date,
          p.agent_num,
          p.curr_mo_net_submit,
          p.curr_mo_4mo_rate,
          p.cur_ytd_pct,
          
          -- Debug fields
          p.converted_esid as converted_pnp_esid,
          
          -- Simplified placeholders for subqueries
          0 as prev_month_refs_count,
          NULL as licensed_states_info,
          0 as vip_count,
          NULL as vip_names
          
        FROM (
          SELECT 
            LagnName,
            SUM(LVL_1_GROSS) as LVL_1_GROSS,
            SUBSTRING_INDEX(GROUP_CONCAT(MGA_NAME ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, LVL_1_GROSS DESC SEPARATOR '|||'), '|||', 1) as MGA_NAME,
            SUBSTRING_INDEX(GROUP_CONCAT(CL_Name ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, LVL_1_GROSS DESC SEPARATOR '|||'), '|||', 1) as CL_Name,
            SUBSTRING_INDEX(GROUP_CONCAT(CTLNO ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, LVL_1_GROSS DESC SEPARATOR '|||'), '|||', 1) as CTLNO,
            MAX(month) as month
          FROM Monthly_ALP 
          WHERE month IN (${placeholders})
            AND LagnName IS NOT NULL
            AND LagnName != ''
          GROUP BY LagnName
        ) ma
        
        -- Join to ActiveUsers on name match
        INNER JOIN activeusers au ON (
          UPPER(TRIM(ma.LagnName)) = UPPER(TRIM(au.lagnname))
        )
        
        -- Join to PnP using proven flexible matching approach
        LEFT JOIN (
          SELECT 
            name_line,
            esid,
            date,
            agent_num,
            curr_mo_net_submit,
            curr_mo_4mo_rate,
            cur_ytd_pct,
            DATE_FORMAT(STR_TO_DATE(esid, '%m/%d/%y'), '%Y-%m-%d') as converted_esid,
            ROW_NUMBER() OVER (PARTITION BY name_line, esid ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC) as rn
          FROM pnp 
          WHERE agent_num LIKE '%-1'
            AND curr_mo_net_submit IS NOT NULL
            AND curr_mo_net_submit != ''
            AND curr_mo_net_submit != 'N/A'
        ) p ON (
          (p.name_line = au.lagnname OR au.lagnname LIKE CONCAT(p.name_line, ' %'))
          AND p.rn = 1
          AND ABS(DATEDIFF(STR_TO_DATE(p.esid, '%m/%d/%y'), STR_TO_DATE(au.esid, '%Y-%m-%d'))) <= 7
        )
        
        WHERE au.lagnname IS NOT NULL
          AND au.esid IS NOT NULL
          
        ORDER BY ma.LVL_1_GROSS DESC, ma.LagnName ASC
      `;
      
      console.log(`🔍 DEBUG: Trying SIMPLIFIED query without subqueries first...`);
      const simplifiedResults = await db.query(simplifiedQuery, monthlyAlpPatterns);
      console.log(`📊 SIMPLIFIED query returned: ${simplifiedResults.length} results (ALP summed from ${monthlyAlpPatterns.join(' + ')})`);
      
      if (simplifiedResults.length > 0) {
        console.log(`✅ DEBUG: Simplified query works! Using it and fetching RefValidation separately...`);
        results = simplifiedResults;
        
        // Fetch RefValidation data separately for better performance
        const refPlaceholders = refValidationPatterns.map(() => '?').join(',');
        const refValidationQuery = `
          SELECT 
            rv.agent_id,
            rv.id as ref_id,
            rv.created_at,
            rv.true_ref,
            DATE_FORMAT(rv.created_at, '%Y-%m') as ref_month
          FROM refvalidation rv
          WHERE DATE_FORMAT(rv.created_at, '%Y-%m') IN (${refPlaceholders})
            AND rv.true_ref = 'y'
          ORDER BY rv.agent_id, rv.created_at DESC
        `;
        
        console.log(`🔍 DEBUG: Fetching RefValidation data for ${refValidationPatterns.join(' + ')}...`);
        const refValidationData = await db.query(refValidationQuery, refValidationPatterns);
        console.log(`📊 DEBUG: Found ${refValidationData.length} RefValidation records across ${refValidationPatterns.length} month(s) (${refValidationPatterns.join(' + ')})`);
        
        // Also fetch Licensed States data separately  
        const licensedStatesQuery = `
          SELECT 
            ls.userId as agent_id,
            ls.state,
            ls.expiry_date,
            ls.resident_state,
            STR_TO_DATE(ls.expiry_date, '%m/%d/%Y') as parsed_expiry
          FROM licensed_states ls
          WHERE STR_TO_DATE(ls.expiry_date, '%m/%d/%Y') > STR_TO_DATE(?, '%m/%d/%Y')
          ORDER BY ls.userId, ls.state
        `;
        
        console.log(`🔍 DEBUG: Fetching Licensed States data with cutoff ${currentDateFormatted}...`);
        const licensedStatesData = await db.query(licensedStatesQuery, [currentDateFormatted]);
        console.log(`📊 DEBUG: Found ${licensedStatesData.length} valid Licensed States records`);
        
        // Fetch VIP data separately
        const vipPlaceholders = vipMonthPatterns.map(() => '?').join(',');
        // Convert vipMonthPatterns from MM/YYYY to YYYY-MM for comparison with VIP table
        const vipMonthsForQuery = vipMonthsToUse;
        const vipQuery = `
          SELECT 
            v.lagnname as vip_name,
            v.sa,
            v.ga,
            v.mga,
            v.count,
            v.vip_month,
            DATE_FORMAT(v.vip_month, '%Y-%m') as vip_month_formatted
          FROM VIPs v
          WHERE v.count = 1
            AND DATE_FORMAT(v.vip_month, '%Y-%m') IN (${vipPlaceholders})
          ORDER BY v.lagnname
        `;
        
        console.log(`🔍 DEBUG: Fetching VIP data for ${vipMonthsForQuery.join(' + ')}...`);
        const vipData = await db.query(vipQuery, vipMonthsForQuery);
        console.log(`📊 DEBUG: Found ${vipData.length} VIP records across ${vipMonthsForQuery.length} month(s)`);
        
        // Add the separate data to the response
        results.refValidationData = refValidationData;
        results.licensedStatesData = licensedStatesData;
        results.vipData = vipData;
        
      } else {
        console.log(`❌ DEBUG: Simplified query returned no results`);
        results = [];
      }
      
      // Debug: Count records with vs without PnP data
      const withPnpResults = results.filter(r => r.pnp_esid !== null);
      const withoutPnpResults = results.filter(r => r.pnp_esid === null);
      
      console.log(`📊 Breakdown: ${withPnpResults.length} with PnP data, ${withoutPnpResults.length} Monthly_ALP-only records`);
      
      // Show Monthly_ALP record selection results
        console.log(`🎯 DEBUG: Monthly_ALP prioritization results (first 3 agents):`);
        results.slice(0, 3).forEach((r, i) => {
          console.log(`   ${i+1}. ${r.LagnName}: CTLNO=${r.CTLNO}, CL_Name='${r.CL_Name}', LVL_1_NET=${r.LVL_1_NET}, MGA='${r.MGA_NAME}'`);
        });
        
        // Verify we have exactly one record per LagnName in current month data
        const uniqueAgents = new Set(results.map(r => r.LagnName));
        const duplicateCheck = results.length === uniqueAgents.size;
        console.log(`✅ VERIFICATION: Current month - ${results.length} records, ${uniqueAgents.size} unique agents, no duplicates: ${duplicateCheck}`);

      // Show examples of records without PnP data for debugging
      if (withoutPnpResults.length > 0) {
        console.log(`🔍 DEBUG: Sample records without PnP data:`, withoutPnpResults.slice(0, 3).map(r => ({
          LagnName: r.LagnName,
          lagnname: r.lagnname,
          au_esid: r.au_esid,
          MGA_NAME: r.MGA_NAME,
          LVL_1_GROSS: r.LVL_1_GROSS
        })));
      }
      
      // Show examples of complete records (with all data)
      if (withPnpResults.length > 0) {
        console.log(`✅ DEBUG: Sample complete records:`, withPnpResults.slice(0, 2).map(r => ({
          LagnName: r.LagnName,
          lagnname: r.lagnname,
          pnp_esid: r.pnp_esid,
          au_esid: r.au_esid,
          agent_num: r.agent_num,
          MGA_NAME: r.MGA_NAME,
          au_mga: r.au_mga,
          LVL_1_GROSS: r.LVL_1_GROSS,
          curr_mo_net_submit: r.curr_mo_net_submit
        })));
        
        // Verify all PnP records have agent_num ending in -1
        const invalidAgentNums = withPnpResults.filter(r => !r.agent_num || !r.agent_num.endsWith('-1'));
        if (invalidAgentNums.length > 0) {
          console.log(`⚠️ WARNING: Found ${invalidAgentNums.length} PnP records without agent_num ending in -1:`, 
            invalidAgentNums.slice(0, 3).map(r => ({
              name_line: r.name_line, 
              agent_num: r.agent_num
            }))
          );
        } else {
          console.log(`✅ VERIFIED: All ${withPnpResults.length} PnP records have agent_num ending in -1`);
          console.log(`✅ MATCHING: Using flexible name matching + 7-day ESID tolerance (from existing auth.js logic)`);
        }
      }
    } catch (queryError) {
      console.error('❌ Three-table query failed:', queryError.message);
      throw queryError; // Re-throw to be caught by outer catch block
    }
    
    // Fetch allotment overrides for this month
    // targetMonthFormatted already declared above when checking for settings
    const overridesQuery = `
      SELECT 
        ao.*,
        au.lagnname
      FROM allotment_overrides ao
      JOIN activeusers au ON ao.agent_id = au.id
      WHERE ao.target_month = ? OR ao.override_type = 'exclude_all_future'
    `;
    
    console.log(`🔍 Fetching allotment overrides for ${targetMonthFormatted}...`);
    const overrides = await db.query(overridesQuery, [targetMonthFormatted]);
    console.log(`📊 Found ${overrides.length} allotment overrides`);
    
    // Debug: Log override types
    if (overrides.length > 0) {
      const overridesByType = {};
      overrides.forEach(o => {
        overridesByType[o.override_type] = (overridesByType[o.override_type] || 0) + 1;
      });
      console.log(`📊 Overrides by type:`, overridesByType);
      console.log(`📊 Sample overrides:`, overrides.slice(0, 3).map(o => ({
        agent_id: o.agent_id,
        lagnname: o.lagnname,
        override_type: o.override_type,
        target_month: o.target_month
      })));
    }
    
    // Create override lookup by agent ID
    const overrideLookup = {};
    overrides.forEach(override => {
      // Month-specific overrides take precedence over exclude_all_future
      if (!overrideLookup[override.agent_id] || override.target_month !== null) {
        overrideLookup[override.agent_id] = override;
      }
    });
    
    console.log(`📊 Created override lookup for ${Object.keys(overrideLookup).length} agents`);
    
    // Transform the data to match the expected allotment format
    const allotmentData = results.map(row => {
      // Parse numeric values safely
      const parseNumeric = (value) => {
        if (!value || value === 'N/A' || value === '') return 0;
        return parseFloat(String(value).replace(/[,$]/g, '')) || 0;
      };

      const parsePercentage = (value) => {
        if (!value || value === 'N/A' || value === '') return 0;
        const num = parseFloat(String(value).replace(/[%,$]/g, ''));
        return isNaN(num) ? 0 : num;
      };

      // Use Monthly_ALP LVL_1_GROSS for base ALP
      const monthlyAlp = parseNumeric(row.LVL_1_GROSS);
      const pnpSubmit = parseNumeric(row.curr_mo_net_submit);
      
      // Calculate VIP ALP (if simplified query was used, count from vipData)
      let vipCount = parseInt(row.vip_count) || 0;
      let vipNames = row.vip_names || '';
      
      // If we used simplified query and have vipData, count VIPs for this agent
      if (results.vipData && results.vipData.length > 0) {
        const agentVips = results.vipData.filter(vip => {
          const agentName = (row.lagnname || row.LagnName || '').trim().toUpperCase();
          // Hierarchical matching: SA > GA > MGA
          if (vip.sa && vip.sa.trim().toUpperCase() === agentName) return true;
          if (!vip.sa && vip.ga && vip.ga.trim().toUpperCase() === agentName) return true;
          if (!vip.sa && !vip.ga && vip.mga && vip.mga.trim().toUpperCase() === agentName) return true;
          return false;
        });
        vipCount = agentVips.length;
        vipNames = agentVips.map(v => v.vip_name).join(', ');
      }
      
      const vipAlp = vipCount * 5000; // Each VIP = 5,000 ALP
      const finalAlp = (monthlyAlp + vipAlp) / 2; // Average of Monthly ALP and VIP ALP
      
      // Debug specific agent to troubleshoot data discrepancy
      if (row.LagnName === 'MARKINS CONOR N') {
        console.log(`🔍 DEBUG: MARKINS CONOR N data breakdown:`, {
          LVL_1_GROSS_raw: row.LVL_1_GROSS,
          LVL_1_GROSS_parsed: monthlyAlp,
          curr_mo_net_submit_raw: row.curr_mo_net_submit,
          curr_mo_net_submit_parsed: pnpSubmit,
          using_gross_alp: monthlyAlp // Now using GROSS ALP
        });
      }
      
      const retentionRate = parsePercentage(row.curr_mo_4mo_rate);
      const ytdRate = parsePercentage(row.cur_ytd_pct);

      // Determine retention display - use curr_4mo_rate first, fallback to cur_ytd_pct with "n2g"
      let retentionDisplay = 'N/A';
      if (retentionRate > 0) {
        retentionDisplay = `${retentionRate}%`;
      } else if (ytdRate > 0) {
        retentionDisplay = `${ytdRate}%n2g`;
      }

      // Parse licensed states info
      let licensedStates = 'N/A';
      if (row.licensed_states_info) {
        try {
          // Format: "state:expiry_date:resident_state;state2:expiry_date2:resident_state2"
          const statesArray = row.licensed_states_info.split(';').map(stateInfo => {
            const [state, expiryDate, residentState] = stateInfo.split(':');
            return state; // Just get the state abbreviation
          });
          licensedStates = statesArray.join(', ');
        } catch (e) {
          console.error('Error parsing licensed_states_info:', e, row.licensed_states_info);
          licensedStates = 'Parse Error';
        }
      }

      // Check for allotment overrides
      const override = overrideLookup[row.agent_id];
      let hasOverride = false;
      let overrideType = null;
      let overrideTargetGroup = null;
      let overrideCustomGroupId = null;
      let overrideReason = null;
      let isExcluded = false;
      
      if (override) {
        hasOverride = true;
        overrideType = override.override_type;
        overrideTargetGroup = override.target_group;
        overrideCustomGroupId = override.custom_group_id;
        overrideReason = override.reason;
        
        // Mark as excluded if override type is exclude or exclude_all_future
        if (overrideType === 'exclude' || overrideType === 'exclude_all_future') {
          isExcluded = true;
        }
      }
      
      return {
        id: row.agent_id || `alp_${row.LagnName?.replace(/[^a-zA-Z0-9]/g, '_')}`,
        agentId: row.agent_id,
        // Prefer MGA_NAME from Monthly_ALP, fallback to activeusers mga
        mga: row.MGA_NAME || row.au_mga || 'Unknown',
        agent: row.lagnname || row.LagnName || 'N/A',
        esid: row.au_esid, // Employee Start ID/Date from activeusers
        retention: retentionDisplay,
        leadTypePref: 'TBD', // TODO: Add lead type preferences from agent settings/preferences table
        areaRequest: licensedStates, // Real data from licensed_states table
        managerActive: row.managerActive, // For row styling (grey if 'n')
        // Override information
        hasOverride,
        overrideType,
        overrideTargetGroup,
        overrideCustomGroupId,
        overrideReason,
        isExcluded,
        // Use actual data sources
        prevMonthGroup: prevMonthGroupLookup[row.LagnName] || 0, // Real data from previous month's ALP grouping
        prevMonthRefs: parseInt(row.prev_month_refs_count) || 0, // Real data from refvalidation
        alp: finalAlp, // Final ALP = (Monthly_ALP + VIP_ALP) / 2
        monthlyAlp: monthlyAlp, // Base Monthly_ALP (summed from source months)
        vipCount: vipCount, // Number of VIPs credited
        vipAlp: vipAlp, // VIP ALP contribution (count * 5000 or custom value)
        vipNames: vipNames, // Comma-separated VIP names for tooltip
        // Additional raw data for debugging
        rawData: {
          // Monthly_ALP data (summed from source months)
          LagnName: row.LagnName,
          LVL_1_GROSS: row.LVL_1_GROSS,
          LVL_1_GROSS_note: 'This is the GROSS ALP SUM from all source months',
          MGA_NAME: row.MGA_NAME,
          CL_Name: row.CL_Name,
          CTLNO: row.CTLNO,
          alp_month: row.alp_month,
          
          // ActiveUsers data
          lagnname: row.lagnname,
          au_mga: row.au_mga,
          au_esid: row.au_esid,
          managerActive: row.managerActive,
          
          // RefValidation data (from source months)
          prev_month_refs_count: row.prev_month_refs_count,
          refvalidation_patterns: refValidationPatterns.join(' + '),
          
          // Previous Month Group data
          prev_month_group_number: prevMonthGroupLookup[row.LagnName] || 0,
          prev_month_pattern: prevMonthAlpPattern,
          had_prev_month_data: !!prevMonthGroupLookup[row.LagnName],
          
          // Licensed States data
          licensed_states_info: row.licensed_states_info,
          licensed_states_cutoff: currentDateFormatted,
          parsed_licensed_states: licensedStates,
          
          // VIP data
          vip_count: vipCount,
          vip_alp: vipAlp,
          vip_names: vipNames,
          vip_months: vipMonthsToUse.join(' + '),
          
          // PnP data (may be null)
          name_line: row.name_line,
          pnp_esid: row.pnp_esid,
          pnp_agent_num: row.agent_num,
          curr_mo_net_submit: row.curr_mo_net_submit,
          curr_mo_4mo_rate: row.curr_mo_4mo_rate,
          cur_ytd_pct: row.cur_ytd_pct,
          converted_pnp_esid: row.converted_pnp_esid,
          
          // Calculations
          retention_source: retentionRate > 0 ? 'curr_4mo_rate' : (ytdRate > 0 ? 'cur_ytd_pct_n2g' : 'none'),
          parsed_retention_rate: retentionRate,
          parsed_ytd_rate: ytdRate,
          monthly_alp: monthlyAlp,
          pnp_submit: pnpSubmit,
          alp_source: 'monthly_alp_GROSS_2_months_summed_plus_vips_divided_by_2', // (GROSS ALP Sum of 2 months + VIP ALP) / 2
          alp_monthly_component: monthlyAlp,
          alp_vip_component: vipAlp,
          alp_final_value: finalAlp,
          
          // Join status (using flexible matching like auth.js)
          has_pnp_data: !!row.pnp_esid,
          name_match: `"${row.LagnName}" -> "${row.lagnname}"`,
          esid_match: row.pnp_esid ? 
            `"${row.pnp_esid}" -> "${row.converted_pnp_esid}" vs "${row.au_esid}" (±7 days tolerance)` : 
            'No PnP data found within 7-day ESID tolerance',
          matching_approach: 'Flexible name + 7-day ESID tolerance (proven from auth.js)'
        }
      };
    });
    
    console.log(`✅ Successfully processed ${allotmentData.length} allotment records`);
    
    // Debug: Count agents with override info
    const agentsWithOverrides = allotmentData.filter(record => record.hasOverride);
    const excludedAgents = allotmentData.filter(record => record.isExcluded);
    console.log(`📊 Agents with overrides: ${agentsWithOverrides.length}`);
    console.log(`📊 Excluded agents: ${excludedAgents.length}`);
    if (agentsWithOverrides.length > 0) {
      const overridesByType = {};
      agentsWithOverrides.forEach(a => {
        overridesByType[a.overrideType] = (overridesByType[a.overrideType] || 0) + 1;
      });
      console.log(`📊 Agents by override type:`, overridesByType);
    }
    
    // Fetch custom groups for this target month and exclude their members from regular groups
    // targetMonthFormatted already declared above when checking for settings
    const customGroupsQuery = `
      SELECT 
        cag.*,
        GROUP_CONCAT(DISTINCT cagm.agent_id) as member_ids
      FROM custom_allotment_groups cag
      LEFT JOIN custom_allotment_group_members cagm ON cag.id = cagm.group_id
      WHERE cag.is_active = 1 
        AND cag.target_month = ?
      GROUP BY cag.id
    `;
    
    const customGroups = await db.query(customGroupsQuery, [targetMonthFormatted]);
    console.log(`📊 Found ${customGroups.length} custom groups for ${targetMonthFormatted}`);
    
    // Get all agent IDs in custom groups
    const customGroupAgentIds = new Set();
    if (customGroups.length > 0) {
      customGroups.forEach(group => {
        if (group.member_ids) {
          const ids = group.member_ids.split(',').map(id => parseInt(id));
          ids.forEach(id => customGroupAgentIds.add(id));
        }
      });
      console.log(`📊 Excluding ${customGroupAgentIds.size} agents in custom groups from regular grouping`);
    }
    
    // Filter out agents who are in custom groups (but keep excluded agents for Exclusions tab)
    const excludedByOverrideCount = allotmentData.filter(record => record.isExcluded).length;
    const inCustomGroupsCount = allotmentData.filter(record => customGroupAgentIds.has(record.agentId)).length;
    const regularAllotmentData = allotmentData.filter(record => 
      !customGroupAgentIds.has(record.agentId)
      // Note: We DO NOT filter out isExcluded agents here - they need to show in Exclusions tab
    );
    console.log(`📊 Regular allotment data: ${regularAllotmentData.length} agents (${inCustomGroupsCount} in custom groups, ${excludedByOverrideCount} have exclusion overrides)`);
    
    // Build custom group data with their members
    const customGroupsData = [];
    for (const group of customGroups) {
      const membersQuery = `
        SELECT 
          cagm.agent_id,
          au.lagnname,
          au.rept_name,
          au.profpic,
          au.mga as au_mga
        FROM custom_allotment_group_members cagm
        JOIN activeusers au ON cagm.agent_id = au.id
        WHERE cagm.group_id = ?
        ORDER BY au.lagnname
      `;
      
      const members = await db.query(membersQuery, [group.id]);
      
      // Get full allotment data for these members
      const memberData = allotmentData.filter(record => 
        members.some(m => m.agent_id === record.agentId)
      );
      
      customGroupsData.push({
        id: group.id,
        groupName: group.group_name,
        targetMonth: group.target_month,
        leadsPerMonth: group.leads_per_month,
        leadsPerDrop: group.leads_per_drop,
        refsRequired: group.refs_required,
        leadTypes: group.lead_types,
        description: group.description,
        color: group.color,
        memberCount: members.length,
        members: memberData
      });
    }
    
    // Fetch F90 agents based on leads_released and drop dates for this month
    console.log(`🔍 [F90] Fetching F90 agents for ${targetMonthFormatted}...`);
    let f90AgentsData = [];
    try {
      // Show all available drop dates for debugging
      const allDropDates = await db.query(
        'SELECT allotment_month, drop_date, drop_name, is_active FROM lead_drop_dates ORDER BY drop_date'
      );
      console.log(`🔍 [F90] All drop dates in database:`, allDropDates);
      
      // Get drop dates for this month
      const dropDatesQuery = await db.query(
        'SELECT id, drop_date, drop_name FROM lead_drop_dates WHERE allotment_month = ? AND is_active = 1',
        [targetMonthFormatted]
      );
      
      console.log(`📅 [F90] Found ${dropDatesQuery.length} drop dates for ${targetMonthFormatted}`);
      
      // Debug: Check if there are any 1st Pack records at all
      const testQuery = await db.query(`
        SELECT COUNT(*) as count, MIN(sent_date) as earliest, MAX(sent_date) as latest
        FROM leads_released 
        WHERE type = '1st Pack' AND sent = 1 AND sent_date IS NOT NULL AND sent_date != ''
      `);
      console.log(`🔍 [F90] 1st Pack records in database:`, testQuery[0]);
      
      // Show a few sample records from both date formats
      const sampleQuery = await db.query(`
        SELECT userId, lagnname, sent_date, type,
          CASE 
            WHEN LOCATE(',', sent_date) > 0 THEN 'Format1: m/d/yy, HH:MM'
            WHEN LOCATE('-', sent_date) > 0 THEN 'Format2: YYYY-MM-DD HH:MM:SS'
            ELSE 'Unknown'
          END as date_format
        FROM leads_released 
        WHERE type = '1st Pack' AND sent = 1 AND sent_date IS NOT NULL AND sent_date != ''
        ORDER BY id DESC
        LIMIT 10
      `);
      console.log(`🔍 [F90] Sample 1st Pack records (both formats):`, sampleQuery);
      
      if (dropDatesQuery.length > 0) {
        // Build query conditions for each drop date
        const dateConditions = dropDatesQuery.map((drop, idx) => {
          const dropDate = new Date(drop.drop_date);
          const startDate = new Date(dropDate);
          startDate.setDate(startDate.getDate() - 90); // 90 days before
          const endDate = new Date(dropDate);
          endDate.setDate(endDate.getDate() - 31); // 31 days before
          
          // Format as mm/dd/yy for comparison
          const formatDate = (d) => {
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const year = String(d.getFullYear()).slice(-2);
            return `${month}/${day}/${year}`;
          };
          
          const startStr = formatDate(startDate);
          const endStr = formatDate(endDate);
          
          console.log(`📅 [F90] Drop "${drop.drop_name}" on ${drop.drop_date}: 1st Pack range ${startStr} to ${endStr}`);
          
          return { startStr, endStr, dropId: drop.id, dropDate: drop.drop_date, dropName: drop.drop_name };
        });
        
        // Build WHERE clause with OR conditions for all drop dates
        // Handle both date formats: "m/d/yy HH:MM" and "YYYY-MM-DD HH:MM:SS"
        const whereClauses = dateConditions.map(() => {
          return `(
            (
              -- Format 1: m/d/yy (with comma separator like "9/9/25, 00:00")
              LOCATE(',', sent_date) > 0
              AND STR_TO_DATE(SUBSTRING_INDEX(sent_date, ',', 1), '%m/%d/%y') >= STR_TO_DATE(?, '%m/%d/%y')
              AND STR_TO_DATE(SUBSTRING_INDEX(sent_date, ',', 1), '%m/%d/%y') <= STR_TO_DATE(?, '%m/%d/%y')
            )
            OR
            (
              -- Format 2: YYYY-MM-DD (with space separator like "2025-12-15 21:14:12")
              LOCATE('-', sent_date) > 0
              AND STR_TO_DATE(SUBSTRING_INDEX(sent_date, ' ', 1), '%Y-%m-%d') >= STR_TO_DATE(?, '%m/%d/%y')
              AND STR_TO_DATE(SUBSTRING_INDEX(sent_date, ' ', 1), '%Y-%m-%d') <= STR_TO_DATE(?, '%m/%d/%y')
            )
          )`;
        }).join(' OR ');
        
        // Need 4 params per condition now (2 for format 1, 2 for format 2)
        const queryParams = dateConditions.flatMap(c => [c.startStr, c.endStr, c.startStr, c.endStr]);
        
        // Query to find agents with 1st Pack in valid ranges
        const f90Query = `
          SELECT 
            first_packs.userId,
            first_packs.lagnname,
            first_packs.sent_date as firstPackDate,
            au.lagnname as au_lagnname,
            au.mga
          FROM (
            SELECT 
              lr.userId,
              lr.lagnname,
              lr.sent_date,
              ROW_NUMBER() OVER (PARTITION BY lr.userId ORDER BY lr.id ASC) as rn
            FROM leads_released lr
            WHERE lr.type = '1st Pack'
              AND lr.sent = 1
              AND lr.sent_date IS NOT NULL
              AND lr.sent_date != ''
              AND (${whereClauses})
          ) first_packs
          INNER JOIN activeusers au ON first_packs.userId = au.id
          WHERE first_packs.rn = 1
        `;
        
        console.log(`🔍 [F90] Executing F90 query with params:`, queryParams);
        f90AgentsData = await db.query(f90Query, queryParams);
        console.log(`✅ [F90] Found ${f90AgentsData.length} F90 agents for ${targetMonthFormatted}`);
        
        if (f90AgentsData.length === 0) {
          console.log(`⚠️ [F90] No matches found. This could mean:`);
          console.log(`   - Drop dates are configured for future 1st packs that haven't been sent yet`);
          console.log(`   - Latest 1st Pack in DB: ${testQuery[0].latest}`);
          console.log(`   - Earliest F90 range needed: ${dateConditions[0].startStr}`);
          console.log(`   💡 Tip: Try selecting a different allotment month or configure drop dates that match existing 1st pack data`);
        } else {
          console.log(`🔍 [F90] Sample F90 agents:`, f90AgentsData.slice(0, 5).map(a => ({
            userId: a.userId,
            lagnname: a.au_lagnname,
            firstPackDate: a.firstPackDate
          })));
        }
      }
    } catch (f90Error) {
      console.error('❌ [F90] Error fetching F90 agents:', f90Error);
    }
    
    // Prepare response data
    const responseData = {
      success: true,
      data: regularAllotmentData, // Only agents NOT in custom groups
      customGroups: customGroupsData, // Custom groups with their members
      f90Agents: f90AgentsData, // F90 eligible agents based on 1st pack dates
      allotmentMonth: `${targetMonth}/${fullTargetYear}`, // The month leads are FOR
      targetMonth: `${targetMonth}/${fullTargetYear}`, // Keep for backwards compatibility
      alpSourceMonths: monthlyAlpPatterns.join(' + '), // The month(s) ALP is based on (summed)
      alpSourceMonth: monthlyAlpPattern, // Keep for backwards compatibility (just first month)
      refMonths: refValidationPatterns.join(' + '), // The month(s) refs are from
      vipMonths: vipMonthsToUse.join(' + '), // The month(s) VIP data is from
      prevMonth: prevMonthAlpPattern,
      monthlyAlpPattern: monthlyAlpPattern,
      monthlyAlpPattern1: monthlyAlpPattern1,
      monthlyAlpPattern2: monthlyAlpPattern2,
      refValidationPattern1: refValidationPattern1,
      refValidationPattern2: refValidationPattern2,
      licensedStatesCutoff: currentDateFormatted,
      recordCount: allotmentData.length,
      overrides: overrides, // Include override data for frontend use
      settings: settingsQuery.length > 0 ? {
        ...settingsQuery[0],
        ref_months: JSON.parse(settingsQuery[0].ref_months),
        alp_months: JSON.parse(settingsQuery[0].alp_months),
        vip_months: JSON.parse(settingsQuery[0].vip_months),
        group_ref_requirements: JSON.parse(settingsQuery[0].group_ref_requirements),
        usingCustomSettings: true
      } : {
        usingCustomSettings: false,
        ref_months: refMonthsToUse,
        alp_months: alpMonthsToUse,
        vip_months: vipMonthsToUse,
        group_ref_requirements: { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2 },
        vip_enabled: true,
        vip_alp_value: 5000,
        custom_groups_enabled: true
      },
      debug: {
        queryExecutedSuccessfully: results && results.length >= 0,
        rawRecordCount: results ? results.length : 0,
        processedRecordCount: allotmentData.length,
        regularGroupAgents: regularAllotmentData.length,
        customGroupsCount: customGroups.length,
        customGroupAgentsCount: customGroupAgentIds.size,
        excludedByOverrideCount: excludedByOverrideCount,
        overridesCount: overrides.length,
        withPnpData: results ? results.filter(r => r.pnp_esid !== null).length : 0,
        monthlyAlpOnly: results ? results.filter(r => r.pnp_esid === null).length : 0,
        withRefValidationData: results ? results.filter(r => r.prev_month_refs_count > 0).length : 0,
        withLicensedStates: results ? results.filter(r => r.licensed_states_info !== null).length : 0,
        prevMonthHighPerformers: prevMonthHighPerformers.length,
        prevMonthGroupSize: prevMonthGroupSize,
        agentsWithPrevMonthGroups: Object.keys(prevMonthGroupLookup).length
      }
    };
    
    // Add separate RefValidation and Licensed States data if available
    if (results.refValidationData) {
      responseData.refValidationData = results.refValidationData;
      responseData.debug.refValidationRecords = results.refValidationData.length;
      console.log(`📊 DEBUG: Including ${results.refValidationData.length} RefValidation records in response`);
    }
    
    if (results.licensedStatesData) {
      responseData.licensedStatesData = results.licensedStatesData;  
      responseData.debug.licensedStatesRecords = results.licensedStatesData.length;
      console.log(`📊 DEBUG: Including ${results.licensedStatesData.length} Licensed States records in response`);
    }

    res.json(responseData);
  } catch (error) {
    console.error('❌ Error fetching allotment data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching allotment data',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      debug: {
        targetMonth: targetMonth,
        targetYear: targetYear,
        fullTargetYear: fullTargetYear,
        monthlyAlpPattern: monthlyAlpPattern,
        pnpPattern: targetMonthPattern,
        refValidationPattern1: refValidationPattern1,
        refValidationPattern2: refValidationPattern2,
        licensedStatesCutoff: currentDateFormatted
      }
    });
  }
});

/**
 * GET /api/pnp/custom-groups
 * Get all custom allotment groups for a specific month
 */
router.get('/custom-groups', verifyToken, async (req, res) => {
  try {
    const { targetMonth } = req.query;
    
    const query = `
      SELECT 
        cag.*,
        creator.lagnname as created_by_name,
        COUNT(DISTINCT cagm.agent_id) as member_count
      FROM custom_allotment_groups cag
      LEFT JOIN activeusers creator ON cag.created_by = creator.id
      LEFT JOIN custom_allotment_group_members cagm ON cag.id = cagm.group_id
      WHERE cag.is_active = 1
      ${targetMonth ? 'AND cag.target_month = ?' : ''}
      GROUP BY cag.id
      ORDER BY cag.target_month DESC, cag.created_at DESC
    `;
    
    const groups = targetMonth 
      ? await db.query(query, [targetMonth])
      : await db.query(query);
    
    res.json({ success: true, groups });
  } catch (error) {
    console.error('❌ Error fetching custom groups:', error);
    res.status(500).json({ success: false, message: 'Error fetching custom groups', error: error.message });
  }
});

/**
 * GET /api/pnp/custom-groups/:groupId/members
 * Get all members of a specific custom group
 */
router.get('/custom-groups/:groupId/members', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const query = `
      SELECT 
        cagm.*,
        au.lagnname,
        au.rept_name,
        au.clname,
        au.mga,
        au.profpic,
        adder.lagnname as added_by_name
      FROM custom_allotment_group_members cagm
      JOIN activeusers au ON cagm.agent_id = au.id
      LEFT JOIN activeusers adder ON cagm.added_by = adder.id
      WHERE cagm.group_id = ?
      ORDER BY au.lagnname
    `;
    
    const members = await db.query(query, [groupId]);
    
    res.json({ success: true, members });
  } catch (error) {
    console.error('❌ Error fetching group members:', error);
    res.status(500).json({ success: false, message: 'Error fetching group members', error: error.message });
  }
});

/**
 * POST /api/pnp/custom-groups
 * Create a new custom allotment group
 */
router.post('/custom-groups', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    
    // Check if user has admin permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Unauthorized: Admin access required' });
    }
    
    const { groupName, targetMonth, leadsPerMonth, leadsPerDrop, refsRequired, leadTypes, description, color } = req.body;
    
    if (!groupName || !targetMonth || !leadsPerMonth || !leadsPerDrop) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    const query = `
      INSERT INTO custom_allotment_groups 
      (group_name, target_month, leads_per_month, leads_per_drop, refs_required, lead_types, description, color, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await db.query(query, [
      groupName,
      targetMonth,
      leadsPerMonth,
      leadsPerDrop,
      refsRequired || 0,
      leadTypes || null,
      description || null,
      color || '#6c757d',
      user.userId
    ]);
    
    res.json({ success: true, groupId: result.insertId, message: 'Custom group created successfully' });
  } catch (error) {
    console.error('❌ Error creating custom group:', error);
    res.status(500).json({ success: false, message: 'Error creating custom group', error: error.message });
  }
});

/**
 * PUT /api/pnp/custom-groups/:groupId
 * Update a custom allotment group
 */
router.put('/custom-groups/:groupId', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    const { groupId } = req.params;
    
    // Check if user has admin permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Unauthorized: Admin access required' });
    }
    
    const { groupName, targetMonth, leadsPerMonth, leadsPerDrop, refsRequired, leadTypes, description, color, isActive } = req.body;
    
    const query = `
      UPDATE custom_allotment_groups 
      SET 
        group_name = COALESCE(?, group_name),
        target_month = COALESCE(?, target_month),
        leads_per_month = COALESCE(?, leads_per_month),
        leads_per_drop = COALESCE(?, leads_per_drop),
        refs_required = COALESCE(?, refs_required),
        lead_types = COALESCE(?, lead_types),
        description = COALESCE(?, description),
        color = COALESCE(?, color),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `;
    
    await db.query(query, [
      groupName,
      targetMonth,
      leadsPerMonth,
      leadsPerDrop,
      refsRequired,
      leadTypes,
      description,
      color,
      isActive,
      groupId
    ]);
    
    res.json({ success: true, message: 'Custom group updated successfully' });
  } catch (error) {
    console.error('❌ Error updating custom group:', error);
    res.status(500).json({ success: false, message: 'Error updating custom group', error: error.message });
  }
});

/**
 * DELETE /api/pnp/custom-groups/:groupId
 * Delete a custom allotment group
 */
router.delete('/custom-groups/:groupId', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    const { groupId } = req.params;
    
    // Check if user has admin permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Unauthorized: Admin access required' });
    }
    
    await db.query('DELETE FROM custom_allotment_groups WHERE id = ?', [groupId]);
    
    res.json({ success: true, message: 'Custom group deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting custom group:', error);
    res.status(500).json({ success: false, message: 'Error deleting custom group', error: error.message });
  }
});

/**
 * POST /api/pnp/custom-groups/:groupId/members
 * Add agents to a custom group
 */
router.post('/custom-groups/:groupId/members', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    const { groupId } = req.params;
    const { agentIds, notes } = req.body;
    
    // Check if user has admin permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Unauthorized: Admin access required' });
    }
    
    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'agentIds array is required' });
    }
    
    // Insert members
    const values = agentIds.map(agentId => [groupId, agentId, user.userId, notes || null]);
    const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
    const flatValues = values.flat();
    
    const query = `
      INSERT INTO custom_allotment_group_members (group_id, agent_id, added_by, notes)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE notes = VALUES(notes)
    `;
    
    await db.query(query, flatValues);
    
    res.json({ success: true, message: `${agentIds.length} agent(s) added to group` });
  } catch (error) {
    console.error('❌ Error adding members to custom group:', error);
    res.status(500).json({ success: false, message: 'Error adding members', error: error.message });
  }
});

/**
 * DELETE /api/pnp/custom-groups/:groupId/members/:agentId
 * Remove an agent from a custom group
 */
router.delete('/custom-groups/:groupId/members/:agentId', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    const { groupId, agentId } = req.params;
    
    // Check if user has admin permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Unauthorized: Admin access required' });
    }
    
    await db.query('DELETE FROM custom_allotment_group_members WHERE group_id = ? AND agent_id = ?', [groupId, agentId]);
    
    res.json({ success: true, message: 'Agent removed from group' });
  } catch (error) {
    console.error('❌ Error removing member from custom group:', error);
    res.status(500).json({ success: false, message: 'Error removing member', error: error.message });
  }
});

/**
 * ==========================================
 * ALLOTMENT OVERRIDES ROUTES
 * ==========================================
 */

/**
 * GET /api/pnp/allotment-overrides
 * Get all allotment overrides (optionally filtered by month)
 */
router.get('/allotment-overrides', verifyToken, async (req, res) => {
  try {
    const { targetMonth } = req.query;
    
    let query = `
      SELECT 
        ao.*,
        au.lagnname as agent_name,
        au.mga,
        cag.group_name as custom_group_name
      FROM allotment_overrides ao
      JOIN activeusers au ON ao.agent_id = au.id
      LEFT JOIN custom_allotment_groups cag ON ao.custom_group_id = cag.id
    `;
    
    const params = [];
    if (targetMonth) {
      query += ' WHERE ao.target_month = ? OR ao.override_type = "exclude_all_future"';
      params.push(targetMonth);
    }
    
    query += ' ORDER BY ao.created_at DESC';
    
    const overrides = await db.query(query, params);
    
    res.json({ success: true, data: overrides });
  } catch (error) {
    console.error('❌ Error fetching allotment overrides:', error);
    res.status(500).json({ success: false, message: 'Error fetching overrides', error: error.message });
  }
});

/**
 * POST /api/pnp/allotment-overrides
 * Create a new allotment override
 */
router.post('/allotment-overrides', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    
    // Check permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    
    const { agentId, targetMonth, overrideType, targetGroup, customGroupId, reason } = req.body;
    
    // Validation
    if (!agentId || !overrideType) {
      return res.status(400).json({ success: false, message: 'Agent ID and override type are required' });
    }
    
    if (overrideType === 'move_to_group' && !targetGroup && !customGroupId) {
      return res.status(400).json({ success: false, message: 'Target group or custom group ID is required for move_to_group type' });
    }
    
    if (overrideType !== 'exclude_all_future' && !targetMonth) {
      return res.status(400).json({ success: false, message: 'Target month is required for month-specific overrides' });
    }
    
    // Insert override
    const query = `
      INSERT INTO allotment_overrides 
        (agent_id, target_month, override_type, target_group, custom_group_id, reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        override_type = VALUES(override_type),
        target_group = VALUES(target_group),
        custom_group_id = VALUES(custom_group_id),
        reason = VALUES(reason),
        updated_at = CURRENT_TIMESTAMP
    `;
    
    const finalTargetMonth = overrideType === 'exclude_all_future' ? null : targetMonth;
    
    await db.query(query, [
      agentId,
      finalTargetMonth,
      overrideType,
      targetGroup || null,
      customGroupId || null,
      reason || null,
      user.id
    ]);
    
    res.json({ success: true, message: 'Allotment override created successfully' });
  } catch (error) {
    console.error('❌ Error creating allotment override:', error);
    res.status(500).json({ success: false, message: 'Error creating override', error: error.message });
  }
});

/**
 * DELETE /api/pnp/allotment-overrides/:overrideId
 * Delete an allotment override
 */
router.delete('/allotment-overrides/:overrideId', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    
    // Check permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    
    const { overrideId } = req.params;
    
    await db.query('DELETE FROM allotment_overrides WHERE id = ?', [overrideId]);
    
    res.json({ success: true, message: 'Override removed successfully' });
  } catch (error) {
    console.error('❌ Error deleting allotment override:', error);
    res.status(500).json({ success: false, message: 'Error deleting override', error: error.message });
  }
});

/**
 * GET /api/pnp/allotment-settings?targetMonth=YYYY-MM
 * Get allotment settings for a specific month
 */
router.get('/allotment-settings', verifyToken, async (req, res) => {
  try {
    const { targetMonth } = req.query;
    
    if (!targetMonth) {
      return res.status(400).json({ success: false, message: 'targetMonth is required' });
    }

    const settings = await db.query(
      'SELECT * FROM allotment_settings WHERE target_month = ?',
      [targetMonth]
    );

    if (settings.length === 0) {
      // Return null/default if no custom settings exist
      return res.json({ 
        success: true, 
        settings: null,
        message: 'No custom settings found for this month, using defaults' 
      });
    }

    res.json({ success: true, settings: settings[0] });
  } catch (error) {
    console.error('❌ Error fetching allotment settings:', error);
    res.status(500).json({ success: false, message: 'Error fetching settings', error: error.message });
  }
});

/**
 * GET /api/pnp/allotment-settings/all
 * Get all allotment settings
 */
router.get('/allotment-settings/all', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    
    // Check permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const settings = await db.query(
      'SELECT * FROM allotment_settings ORDER BY target_month DESC'
    );

    res.json({ success: true, settings });
  } catch (error) {
    console.error('❌ Error fetching all allotment settings:', error);
    res.status(500).json({ success: false, message: 'Error fetching settings', error: error.message });
  }
});

/**
 * POST /api/pnp/allotment-settings
 * Create or update allotment settings for a month
 */
router.post('/allotment-settings', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    
    // Check permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const {
      targetMonth,
      refMonths,
      alpMonths,
      groupRefRequirements,
      vipEnabled,
      vipAlpValue,
      vipMonths,
      customGroupsEnabled,
      notes
    } = req.body;

    if (!targetMonth) {
      return res.status(400).json({ success: false, message: 'targetMonth is required' });
    }

    // Check if settings already exist
    const existing = await db.query(
      'SELECT id FROM allotment_settings WHERE target_month = ?',
      [targetMonth]
    );

    if (existing.length > 0) {
      // Update existing settings
      await db.query(
        `UPDATE allotment_settings 
         SET ref_months = ?, 
             alp_months = ?, 
             group_ref_requirements = ?,
             vip_enabled = ?,
             vip_alp_value = ?,
             vip_months = ?,
             custom_groups_enabled = ?,
             notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE target_month = ?`,
        [
          JSON.stringify(refMonths),
          JSON.stringify(alpMonths),
          JSON.stringify(groupRefRequirements),
          vipEnabled !== undefined ? vipEnabled : true,
          vipAlpValue || 5000,
          JSON.stringify(vipMonths || alpMonths),
          customGroupsEnabled !== undefined ? customGroupsEnabled : true,
          notes || null,
          targetMonth
        ]
      );

      res.json({ success: true, message: 'Settings updated successfully', id: existing[0].id });
    } else {
      // Insert new settings
      const result = await db.query(
        `INSERT INTO allotment_settings 
         (target_month, ref_months, alp_months, group_ref_requirements, vip_enabled, vip_alp_value, vip_months, custom_groups_enabled, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          targetMonth,
          JSON.stringify(refMonths),
          JSON.stringify(alpMonths),
          JSON.stringify(groupRefRequirements),
          vipEnabled !== undefined ? vipEnabled : true,
          vipAlpValue || 5000,
          JSON.stringify(vipMonths || alpMonths),
          customGroupsEnabled !== undefined ? customGroupsEnabled : true,
          notes || null,
          user.userId
        ]
      );

      res.json({ success: true, message: 'Settings created successfully', id: result.insertId });
    }
  } catch (error) {
    console.error('❌ Error saving allotment settings:', error);
    res.status(500).json({ success: false, message: 'Error saving settings', error: error.message });
  }
});

/**
 * DELETE /api/pnp/allotment-settings/:settingsId
 * Delete allotment settings (revert to defaults)
 */
router.delete('/allotment-settings/:settingsId', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    
    // Check permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const { settingsId } = req.params;

    await db.query('DELETE FROM allotment_settings WHERE id = ?', [settingsId]);

    res.json({ success: true, message: 'Settings deleted successfully, will use defaults' });
  } catch (error) {
    console.error('❌ Error deleting allotment settings:', error);
    res.status(500).json({ success: false, message: 'Error deleting settings', error: error.message });
  }
});

/**
 * GET /api/pnp/lead-drop-dates
 * Get all lead drop dates, optionally filtered by month
 */
router.get('/lead-drop-dates', verifyToken, async (req, res) => {
  try {
    const { month } = req.query; // Optional: filter by allotment_month (YYYY-MM)
    
    let query = 'SELECT * FROM lead_drop_dates WHERE is_active = 1';
    const params = [];
    
    if (month) {
      query += ' AND allotment_month = ?';
      params.push(month);
    }
    
    query += ' ORDER BY drop_date ASC';
    
    const dropDates = await db.query(query, params);
    
    res.json({ success: true, dropDates });
  } catch (error) {
    console.error('❌ Error fetching lead drop dates:', error);
    res.status(500).json({ success: false, message: 'Error fetching drop dates', error: error.message });
  }
});

/**
 * POST /api/pnp/lead-drop-dates
 * Create a new lead drop date (Admin only)
 */
router.post('/lead-drop-dates', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    
    // Check permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    
    const { drop_date, drop_name, allotment_month, notes } = req.body;
    
    if (!drop_date || !allotment_month) {
      return res.status(400).json({ success: false, message: 'drop_date and allotment_month are required' });
    }
    
    const result = await db.query(
      `INSERT INTO lead_drop_dates (drop_date, drop_name, allotment_month, notes, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [drop_date, drop_name || null, allotment_month, notes || null, user.userId]
    );
    
    res.json({ success: true, message: 'Drop date created successfully', id: result.insertId });
  } catch (error) {
    console.error('❌ Error creating lead drop date:', error);
    res.status(500).json({ success: false, message: 'Error creating drop date', error: error.message });
  }
});

/**
 * PUT /api/pnp/lead-drop-dates/:id
 * Update a lead drop date (Admin only)
 */
router.put('/lead-drop-dates/:id', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    
    // Check permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    
    const { id } = req.params;
    const { drop_date, drop_name, allotment_month, notes, is_active } = req.body;
    
    const updates = [];
    const values = [];
    
    if (drop_date !== undefined) {
      updates.push('drop_date = ?');
      values.push(drop_date);
    }
    if (drop_name !== undefined) {
      updates.push('drop_name = ?');
      values.push(drop_name);
    }
    if (allotment_month !== undefined) {
      updates.push('allotment_month = ?');
      values.push(allotment_month);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    
    values.push(id);
    
    await db.query(
      `UPDATE lead_drop_dates SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    res.json({ success: true, message: 'Drop date updated successfully' });
  } catch (error) {
    console.error('❌ Error updating lead drop date:', error);
    res.status(500).json({ success: false, message: 'Error updating drop date', error: error.message });
  }
});

/**
 * DELETE /api/pnp/lead-drop-dates/:id
 * Delete a lead drop date (Admin only)
 */
router.delete('/lead-drop-dates/:id', verifyToken, async (req, res) => {
  try {
    const { user } = req;
    
    // Check permissions
    if (user.Role !== 'Admin' && user.teamRole !== 'app') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    
    const { id } = req.params;
    
    await db.query('DELETE FROM lead_drop_dates WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Drop date deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting lead drop date:', error);
    res.status(500).json({ success: false, message: 'Error deleting drop date', error: error.message });
  }
});

module.exports = router;
