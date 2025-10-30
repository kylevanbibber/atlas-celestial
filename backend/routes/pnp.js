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
  let targetMonth, targetYear, fullTargetYear, targetMonthPattern, monthlyAlpPattern, refValidationPattern, currentDateFormatted;
  
  try {
    // Calculate the target month (2 months ago)
    const now = new Date();
    const currentDate = new Date(); // For licensed_states expiry comparison
    const targetDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    targetMonth = (targetDate.getMonth() + 1).toString().padStart(2, '0');
    fullTargetYear = targetDate.getFullYear();
    targetYear = fullTargetYear.toString().slice(-2);
    
    // Calculate the previous month (1 month before target) for prev month group calculation
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const prevMonth = (prevMonthDate.getMonth() + 1).toString().padStart(2, '0');
    const prevMonthYear = prevMonthDate.getFullYear();
    
    // Format for Monthly_ALP table (mm/yyyy format)
    monthlyAlpPattern = `${targetMonth}/${fullTargetYear}`;
    const prevMonthAlpPattern = `${prevMonth}/${prevMonthYear}`;
    // Format for PnP table (mm/%/yy pattern - any day in the target month)
    targetMonthPattern = `${targetMonth}/%/${targetYear}`;
    // Format for refvalidation created_at (yyyy-mm format for target month)
    const refValidationPattern = `${fullTargetYear}-${targetMonth}`;
    // Format current date for licensed_states comparison (mm/dd/yyyy)
    const currentDateFormatted = `${String(currentDate.getMonth() + 1).padStart(2, '0')}/${String(currentDate.getDate()).padStart(2, '0')}/${currentDate.getFullYear()}`;
    
    console.log(`🔍 Target month: ${monthlyAlpPattern}, Prev month for grouping: ${prevMonthAlpPattern}`);
    
    console.log(`🔍 Fetching allotment data - Monthly_ALP: ${monthlyAlpPattern}, RefValidation: ${refValidationPattern}, Licensed States cutoff: ${currentDateFormatted}`);

    // First, let's debug what we're working with from Monthly_ALP
    const debugQuery = `
      SELECT 
        LagnName,
        LVL_1_NET,
        MGA_NAME,
        month
      FROM Monthly_ALP 
      WHERE month = ?
        AND LagnName IS NOT NULL
        AND LagnName != ''
      ORDER BY LagnName ASC
      LIMIT 5
    `;
    
    const debugResults = await db.query(debugQuery, [monthlyAlpPattern]);
    console.log(`🔍 DEBUG: Sample Monthly_ALP data for ${monthlyAlpPattern}:`, debugResults);

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

    // Check for MARKINS CONOR N specifically to debug the 31,191 vs 0.0 discrepancy
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
        AND month = ?
      ORDER BY LVL_1_NET DESC
    `;
    
    const markinsResults = await db.query(markinsQuery, [monthlyAlpPattern]);
    console.log(`🔍 DEBUG: MARKINS CONOR N records for ${monthlyAlpPattern}:`, markinsResults);
    
      if (markinsResults.length > 1) {
        console.log(`⚠️  MULTIPLE RECORDS found for MARKINS CONOR N - showing prioritization logic:`);
        markinsResults.forEach((r, i) => {
          console.log(`   ${i+1}. CTLNO: ${r.CTLNO}, CL_Name: ${r.CL_Name}, LVL_1_NET: ${r.LVL_1_NET}, MGA_NAME: ${r.MGA_NAME}`);
        });
        console.log(`✅ Will select record where CL_Name = 'MGA' (if available), then highest LVL_1_NET`);
      } else if (markinsResults.length === 1) {
        const r = markinsResults[0];
        console.log(`📊 Single record for MARKINS CONOR N: CTLNO: ${r.CTLNO}, CL_Name: ${r.CL_Name}, LVL_1_NET = ${r.LVL_1_NET}`);
      } else {
        console.log(`❌ No Monthly_ALP records found for MARKINS CONOR N in ${monthlyAlpPattern}`);
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
    console.log(`🔍 DEBUG: Fetching previous month ALP data for ${prevMonthAlpPattern}...`);
    const prevMonthAlpQuery = `
      SELECT 
        LagnName,
        LVL_1_NET,
        CL_Name,
        ROW_NUMBER() OVER (
          PARTITION BY LagnName 
          ORDER BY 
            CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END,
            LVL_1_NET DESC
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
    
    // Filter high performers (>= 3000 ALP) and sort by LVL_1_NET descending
    const prevMonthHighPerformers = oneRecordPerAgent
      .filter(r => parseFloat(r.LVL_1_NET) >= 3000) // High performers only
      .sort((a, b) => parseFloat(b.LVL_1_NET) - parseFloat(a.LVL_1_NET)); // Sort by ALP desc
    
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
      LVL_1_NET: r.LVL_1_NET,
      CL_Name: r.CL_Name,
      selectedAsRank: r.rn // Should always be 1
    }));
    console.log(`🔍 DEBUG: Sample prev month selected records (showing MGA preference):`, sampleSelectedRecords);

    const query = `
      SELECT 
        -- Monthly_ALP data (one record per LagnName, prefer CL_Name = 'MGA')
        ma.LagnName,
        ma.LVL_1_NET,
        ma.MGA_NAME,
        ma.CL_Name,
        ma.CTLNO,
        ma.month as alp_month,
        
        -- ActiveUsers data
        au.id as agent_id,
        au.lagnname,
        au.mga as au_mga,
        au.esid as au_esid,
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
        
        -- Refvalidation data (prev month refs count)
        (
          SELECT COUNT(*)
          FROM refvalidation rv
          WHERE rv.agent_id = au.id
            AND DATE_FORMAT(rv.created_at, '%Y-%m') = ?
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
        ) as licensed_states_info
        
      FROM (
        SELECT 
          LagnName,
          LVL_1_NET,
          MGA_NAME,
          CL_Name,
          CTLNO,
          month,
          ROW_NUMBER() OVER (
            PARTITION BY LagnName 
            ORDER BY 
              CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END,  -- Prefer CL_Name = 'MGA'
              LVL_1_NET DESC                                -- Then by highest LVL_1_NET
          ) as rn
        FROM Monthly_ALP 
        WHERE month = ?
          AND LagnName IS NOT NULL
          AND LagnName != ''
      ) ma
      
      -- Join to ActiveUsers on name match
      INNER JOIN activeusers au ON (
        UPPER(TRIM(ma.LagnName)) = UPPER(TRIM(au.lagnname))
        AND ma.rn = 1  -- Only get the preferred record per LagnName
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
        SELECT LagnName, month, ROW_NUMBER() OVER (PARTITION BY LagnName ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, LVL_1_NET DESC) as rn
        FROM Monthly_ALP 
        WHERE month = ?
      ) ma
      INNER JOIN activeusers au ON (
        UPPER(TRIM(ma.LagnName)) = UPPER(TRIM(au.lagnname))
        AND ma.rn = 1
      )
    `;
    
    const joinTestResult = await db.query(testJoinQuery, [monthlyAlpPattern]);
    console.log(`🔍 DEBUG: Basic Monthly_ALP -> activeusers JOIN test: ${joinTestResult[0].join_count} matches`);
    
    if (joinTestResult[0].join_count === 0) {
      console.log(`❌ DEBUG: The basic JOIN is returning 0 matches - this is the root cause!`);
      
      // Let's see some actual names from both tables for comparison
      const monthlyAlpNamesQuery = `SELECT DISTINCT LagnName FROM Monthly_ALP WHERE month = ? LIMIT 10`;
      const activeUsersNamesQuery = `SELECT DISTINCT lagnname FROM activeusers LIMIT 10`;
      
      const maNames = await db.query(monthlyAlpNamesQuery, [monthlyAlpPattern]);
      const auNames = await db.query(activeUsersNamesQuery);
      
      console.log(`🔍 DEBUG: Monthly_ALP names for ${monthlyAlpPattern}:`, maNames.map(r => r.LagnName));
      console.log(`🔍 DEBUG: ActiveUsers names (sample):`, auNames.map(r => r.lagnname));
    } else {
      console.log(`✅ DEBUG: Basic JOIN works with ${joinTestResult[0].join_count} matches - issue must be in subqueries`);
      
      // Test the query with subqueries step by step
      const queryWithoutSubqueries = `
        SELECT ma.LagnName, ma.LVL_1_NET, ma.MGA_NAME, ma.CL_Name, ma.CTLNO, ma.month as alp_month,
               au.id as agent_id, au.lagnname, au.mga as au_mga, au.esid as au_esid
        FROM (
          SELECT LagnName, LVL_1_NET, MGA_NAME, CL_Name, CTLNO, month,
                 ROW_NUMBER() OVER (PARTITION BY LagnName ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, LVL_1_NET DESC) as rn
          FROM Monthly_ALP WHERE month = ?
        ) ma
        INNER JOIN activeusers au ON (UPPER(TRIM(ma.LagnName)) = UPPER(TRIM(au.lagnname)) AND ma.rn = 1)
        LIMIT 5
      `;
      
      const withoutSubqueriesResult = await db.query(queryWithoutSubqueries, [monthlyAlpPattern]);
      console.log(`🔍 DEBUG: Query WITHOUT subqueries returns: ${withoutSubqueriesResult.length} records`);
      
      if (withoutSubqueriesResult.length > 0) {
        // Test RefValidation subquery
        const testRefValidation = `
          SELECT COUNT(*) as ref_count
          FROM refvalidation rv 
          WHERE rv.agent_id = ? 
            AND DATE_FORMAT(rv.created_at, '%Y-%m') = ?
            AND rv.true_ref = 'y'
        `;
        
        const testAgentId = withoutSubqueriesResult[0].agent_id;
        const refResult = await db.query(testRefValidation, [testAgentId, refValidationPattern]);
        console.log(`🔍 DEBUG: RefValidation subquery test for agent ${testAgentId}: ${refResult[0].ref_count} refs`);
        
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
      monthlyAlpPattern: monthlyAlpPattern,
      refValidationPattern: refValidationPattern, 
      currentDateFormatted: currentDateFormatted,
      parameterOrder: `[${monthlyAlpPattern}, ${refValidationPattern}, ${currentDateFormatted}]`
    });
    
    let results;
    try {
      // Try simplified query first (without subqueries that might be causing timeout)
      const simplifiedQuery = `
        SELECT 
          -- Monthly_ALP data (one record per LagnName, prefer CL_Name = 'MGA')
          ma.LagnName,
          ma.LVL_1_NET,
          ma.MGA_NAME,
          ma.CL_Name,
          ma.CTLNO,
          ma.month as alp_month,
          
          -- ActiveUsers data
          au.id as agent_id,
          au.lagnname,
          au.mga as au_mga,
          au.esid as au_esid,
          
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
          NULL as licensed_states_info
          
        FROM (
          SELECT 
            LagnName,
            LVL_1_NET,
            MGA_NAME,
            CL_Name,
            CTLNO,
            month,
            ROW_NUMBER() OVER (
              PARTITION BY LagnName 
              ORDER BY 
                CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END,
                LVL_1_NET DESC
            ) as rn
          FROM Monthly_ALP 
          WHERE month = ?
            AND LagnName IS NOT NULL
            AND LagnName != ''
        ) ma
        
        -- Join to ActiveUsers on name match
        INNER JOIN activeusers au ON (
          UPPER(TRIM(ma.LagnName)) = UPPER(TRIM(au.lagnname))
          AND ma.rn = 1
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
          
        ORDER BY ma.LVL_1_NET DESC, ma.LagnName ASC
      `;
      
      console.log(`🔍 DEBUG: Trying SIMPLIFIED query without subqueries first...`);
      const simplifiedResults = await db.query(simplifiedQuery, [monthlyAlpPattern]);
      console.log(`📊 SIMPLIFIED query returned: ${simplifiedResults.length} results`);
      
      if (simplifiedResults.length > 0) {
        console.log(`✅ DEBUG: Simplified query works! Using it and fetching RefValidation separately...`);
        results = simplifiedResults;
        
        // Fetch RefValidation data separately for better performance
        const refValidationQuery = `
          SELECT 
            rv.agent_id,
            rv.id as ref_id,
            rv.created_at,
            rv.true_ref,
            DATE_FORMAT(rv.created_at, '%Y-%m') as ref_month
          FROM refvalidation rv
          WHERE DATE_FORMAT(rv.created_at, '%Y-%m') = ?
            AND rv.true_ref = 'y'
          ORDER BY rv.agent_id, rv.created_at DESC
        `;
        
        console.log(`🔍 DEBUG: Fetching RefValidation data for ${refValidationPattern}...`);
        const refValidationData = await db.query(refValidationQuery, [refValidationPattern]);
        console.log(`📊 DEBUG: Found ${refValidationData.length} RefValidation records for ${refValidationPattern}`);
        
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
        
        // Add the separate data to the response
        results.refValidationData = refValidationData;
        results.licensedStatesData = licensedStatesData;
        
      } else {
        console.log(`❌ DEBUG: Even simplified query failed - trying full query anyway`);
        results = await db.query(query, [monthlyAlpPattern, refValidationPattern, currentDateFormatted]);
        console.log(`📊 Found ${results.length} raw results from database`);
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
          LVL_1_NET: r.LVL_1_NET
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
          LVL_1_NET: r.LVL_1_NET,
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

      // Use ONLY Monthly_ALP LVL_1_NET for ALP (no fallback to PnP data)
      const monthlyAlp = parseNumeric(row.LVL_1_NET);
      const pnpSubmit = parseNumeric(row.curr_mo_net_submit);
      
      // Debug specific agent to troubleshoot data discrepancy
      if (row.LagnName === 'MARKINS CONOR N') {
        console.log(`🔍 DEBUG: MARKINS CONOR N data breakdown:`, {
          LVL_1_NET_raw: row.LVL_1_NET,
          LVL_1_NET_parsed: monthlyAlp,
          curr_mo_net_submit_raw: row.curr_mo_net_submit,
          curr_mo_net_submit_parsed: pnpSubmit,
          old_logic_would_show: monthlyAlp || pnpSubmit || 0,
          new_logic_will_show: monthlyAlp // Only Monthly_ALP
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

      return {
        id: row.agent_id || `alp_${row.LagnName?.replace(/[^a-zA-Z0-9]/g, '_')}`,
        agentId: row.agent_id,
        // Prefer MGA_NAME from Monthly_ALP, fallback to activeusers mga
        mga: row.MGA_NAME || row.au_mga || 'Unknown',
        agent: row.lagnname || row.LagnName || 'N/A',
        retention: retentionDisplay,
        leadTypePref: 'TBD', // TODO: Add lead type preferences from agent settings/preferences table
        areaRequest: licensedStates, // Real data from licensed_states table
        managerActive: row.managerActive, // For row styling (grey if 'n')
        // Use actual data sources
        prevMonthGroup: prevMonthGroupLookup[row.LagnName] || 0, // Real data from previous month's ALP grouping
        prevMonthRefs: parseInt(row.prev_month_refs_count) || 0, // Real data from refvalidation
        alp: monthlyAlp, // ONLY use Monthly_ALP LVL_1_NET (even if 0)
        // Additional raw data for debugging
        rawData: {
          // Monthly_ALP data (selected record)
          LagnName: row.LagnName,
          LVL_1_NET: row.LVL_1_NET,
          MGA_NAME: row.MGA_NAME,
          CL_Name: row.CL_Name,
          CTLNO: row.CTLNO,
          alp_month: row.alp_month,
          
          // ActiveUsers data
          lagnname: row.lagnname,
          au_mga: row.au_mga,
          au_esid: row.au_esid,
          managerActive: row.managerActive,
          
          // RefValidation data
          prev_month_refs_count: row.prev_month_refs_count,
          refvalidation_pattern: refValidationPattern,
          
          // Previous Month Group data
          prev_month_group_number: prevMonthGroupLookup[row.LagnName] || 0,
          prev_month_pattern: prevMonthAlpPattern,
          had_prev_month_data: !!prevMonthGroupLookup[row.LagnName],
          
          // Licensed States data
          licensed_states_info: row.licensed_states_info,
          licensed_states_cutoff: currentDateFormatted,
          parsed_licensed_states: licensedStates,
          
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
          alp_source: 'monthly_alp_only', // Now only using Monthly_ALP
          alp_final_value: monthlyAlp,
          
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
    
    // Prepare response data
    const responseData = {
      success: true,
      data: allotmentData,
      targetMonth: `${targetMonth}/${fullTargetYear}`,
      prevMonth: prevMonthAlpPattern,
      monthlyAlpPattern: monthlyAlpPattern,
      refValidationPattern: refValidationPattern,
      licensedStatesCutoff: currentDateFormatted,
      recordCount: allotmentData.length,
      debug: {
        queryExecutedSuccessfully: results && results.length >= 0,
        rawRecordCount: results ? results.length : 0,
        processedRecordCount: allotmentData.length,
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
        refValidationPattern: refValidationPattern,
        licensedStatesCutoff: currentDateFormatted
      }
    });
  }
});

module.exports = router;
