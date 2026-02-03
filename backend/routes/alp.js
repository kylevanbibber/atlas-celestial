// routes/alp.js
const express = require("express");
const router = express.Router();
const { pool, query: dbQuery } = require("../db");
const { debug, debugWarn } = require("../utils/logger");

/* =========================
   Daily_Activity Endpoints
   ========================= */

// GET /api/alp/daily - Retrieve data from Daily_Activity table
router.get("/daily", (req, res) => {
  pool.query("SELECT * FROM Daily_Activity", (err, results) => {
    if (err) {

      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// GET /api/alp/daily/sum - Retrieve sum of refAlp, alp, and refs for a given date or date range
router.get("/daily/sum", (req, res) => {
  const { date, startDate, endDate, lagnName } = req.query;
  let query = "";
  let params = [];
  
  // Handle lagnName filtering - need to join with activeusers since Daily_Activity uses userId
  if (lagnName) {
    if (date) {
      query = `SELECT SUM(da.refAlp) AS totalRefAlp, SUM(da.alp) AS totalAlp, SUM(da.refs) AS totalRefs, COUNT(DISTINCT da.agent) AS agentCount 
               FROM Daily_Activity da 
               JOIN activeusers au ON da.userId = au.id 
               WHERE da.reportDate = ? AND au.lagnname = ?`;
      params = [date, lagnName];
    } else if (startDate && endDate) {
      query = `SELECT SUM(da.refAlp) AS totalRefAlp, SUM(da.alp) AS totalAlp, SUM(da.refs) AS totalRefs, COUNT(DISTINCT da.agent) AS agentCount 
               FROM Daily_Activity da 
               JOIN activeusers au ON da.userId = au.id 
               WHERE da.reportDate BETWEEN ? AND ? AND au.lagnname = ?`;
      params = [startDate, endDate, lagnName];
    } else {
      return res.status(400).json({ error: "Please provide either a 'date' or both 'startDate' and 'endDate'" });
    }
    debug('📊 [Daily Sum] Filtering Daily_Activity by joining with activeusers.lagnname:', lagnName);
  } else {
    // Original queries for SGA (organization-wide)
    if (date) {
      query = "SELECT SUM(refAlp) AS totalRefAlp, SUM(alp) AS totalAlp, SUM(refs) AS totalRefs, COUNT(DISTINCT agent) AS agentCount FROM Daily_Activity WHERE reportDate = ?";
      params = [date];
    } else if (startDate && endDate) {
      query = "SELECT SUM(refAlp) AS totalRefAlp, SUM(alp) AS totalAlp, SUM(refs) AS totalRefs, COUNT(DISTINCT agent) AS agentCount FROM Daily_Activity WHERE reportDate BETWEEN ? AND ?";
      params = [startDate, endDate];
    } else {
      return res.status(400).json({ error: "Please provide either a 'date' or both 'startDate' and 'endDate'" });
    }
  }

  pool.query(query, params, (err, results) => {
    if (err) {

      return res.status(500).json({ error: "Database error" });
    }
    res.json(results[0]);
  });
});

// GET /api/alp/ref-sales - Retrieve ref sales from refvalidation table for a given month
router.get("/ref-sales", (req, res) => {
  const { month, year, lagnName } = req.query;
  
  if (!month || !year) {
    return res.status(400).json({ error: "Please provide both 'month' and 'year' parameters" });
  }

  // Format month to ensure it's 2 digits
  const formattedMonth = month.toString().padStart(2, '0');
  const startDate = `${year}-${formattedMonth}-01`;
  
  // Calculate end date (last day of the month)
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${formattedMonth}-${String(lastDay).padStart(2, '0')}`;

  let query = `
    SELECT COUNT(*) AS totalRefSales 
    FROM refvalidation 
    WHERE true_ref = 'Y' 
    AND DATE(created_at) >= ? AND DATE(created_at) <= ?
  `;
  
  let params = [startDate, endDate];
  
  // If lagnName is provided, filter by lagnname or mga
  if (lagnName) {
    query += ` AND (lagnname = ? OR mga = ?)`;
    params.push(lagnName, lagnName);
  }

  pool.query(query, params, (err, results) => {
    if (err) {

      return res.status(500).json({ error: "Database error" });
    }
    
    const totalRefSales = results[0].totalRefSales || 0;
    res.json({ totalRefSales });
  });
});

// GET /api/alp/ref-sales-breakdown - Retrieve agent-level ref sales breakdown
router.get("/ref-sales-breakdown", (req, res) => {
  const { month, year, lagnName } = req.query;
  
  if (!month || !year) {
    return res.status(400).json({ error: "Please provide both 'month' and 'year' parameters" });
  }

  // Format month to ensure it's 2 digits
  const formattedMonth = month.toString().padStart(2, '0');
  const startDate = `${year}-${formattedMonth}-01`;
  
  // Calculate end date (last day of the month)
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${formattedMonth}-${String(lastDay).padStart(2, '0')}`;

  let query = `
    SELECT 
      lagnname,
      COUNT(*) AS refSales 
    FROM refvalidation 
    WHERE true_ref = 'Y' 
    AND DATE(created_at) >= ? AND DATE(created_at) <= ?
    AND lagnname IS NOT NULL
  `;
  
  let params = [startDate, endDate];
  
  // If lagnName is provided, filter by mga (to get all agents under this MGA)
  if (lagnName) {
    query += ` AND mga = ?`;
    params.push(lagnName);
  }
  
  query += ` GROUP BY lagnname ORDER BY refSales DESC`;

  pool.query(query, params, (err, results) => {
    if (err) {
      console.error('Error fetching ref sales breakdown:', err);
      return res.status(500).json({ error: "Database error" });
    }
    
    res.json({ success: true, data: results });
  });
});

/* =========================
   Monthly_ALP Endpoints
   ========================= */

// GET /api/alp/monthly - Retrieve data from Monthly_ALP table
router.get("/monthly", (req, res) => {
  pool.query("SELECT * FROM Monthly_ALP", (err, results) => {
    if (err) {

      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// GET /api/alp/monthly/summary - Retrieve summary for Monthly_ALP for a given month (mm/yyyy)
router.get("/monthly/summary", (req, res) => {
  const { month } = req.query;
  if (!month) {
    return res.status(400).json({ error: "Please provide a 'month' in mm/yyyy format" });
  }
  const query = `
    SELECT 
      SUM(LVL_1_GROSS) AS totalLVL1Gross,
      SUM(LVL_1_NET) AS totalLVL1Net,
      SUM(LVL_2_GROSS) AS totalLVL2Gross,
      SUM(LVL_2_NET) AS totalLVL2Net,
      SUM(LVL_2_F6_GROSS) AS totalLVL2F6Gross,
      SUM(LVL_2_F6_NET) AS totalLVL2F6Net,
      SUM(LVL_3_GROSS) AS totalLVL3Gross,
      SUM(LVL_3_NET) AS totalLVL3Net,
      SUM(LVL_3_F6_GROSS) AS totalLVL3F6Gross,
      SUM(LVL_3_F6_NET) AS totalLVL3F6Net
    FROM Monthly_ALP
    WHERE month = ?
  `;
  pool.query(query, [month], (err, results) => {
    if (err) {

      return res.status(500).json({ error: "Database error" });
    }
    res.json(results[0]);
  });
});

// GET /api/alp/monthly/user-6mo - Get last 6 months Monthly_ALP for a user (LVL_1_NET)
router.get("/monthly/user-6mo", (req, res) => {
  const { lagnName } = req.query;
  if (!lagnName) {
    return res.status(400).json({ error: "Please provide lagnName" });
  }

  const query = `
    SELECT month, LVL_1_NET AS netAlp
    FROM Monthly_ALP
    WHERE LagnName = ? AND month IS NOT NULL AND month != ''
    ORDER BY STR_TO_DATE(CONCAT('01/', month), '%d/%m/%Y') DESC
    LIMIT 6
  `;

  pool.query(query, [lagnName], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    return res.json({ success: true, data: results || [] });
  });
});

/* =========================
   Weekly_ALP Endpoints
   ========================= */

// GET /api/alp/weekly - Retrieve data from Weekly_ALP table
router.get("/weekly", (req, res) => {
  pool.query("SELECT * FROM Weekly_ALP", (err, results) => {
    if (err) {

      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// GET /api/alp/weekly-tracker - Fetch weekly production data for Production Tracker
router.get("/weekly-tracker", async (req, res) => {
        debug('📊 [Weekly Tracker] GET request received');
    
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both startDate and endDate parameters'
            });
        }
        
        debug('📊 [Weekly Tracker] Fetching data from', startDate, 'to', endDate);
        
        // Fetch all Weekly Recap reports from Weekly_ALP table for the current year
        // The reportdate represents when the report was generated (Wed or Fri)
        // Each report is for the PREVIOUS Wed-Tue week
        // Note: reportdate in Weekly_ALP is stored as MM/DD/YYYY format
        const currentYear = new Date().getFullYear();
        const query = `
            SELECT 
                reportdate,
                LVL_1_NET,
                LVL_1_GROSS,
                LagnName
            FROM Weekly_ALP
            WHERE REPORT = 'Weekly Recap'
            AND STR_TO_DATE(reportdate, '%m/%d/%Y') >= STR_TO_DATE(?, '%Y-%m-%d')
            AND STR_TO_DATE(reportdate, '%m/%d/%Y') <= STR_TO_DATE(?, '%Y-%m-%d')
            AND YEAR(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
        `;
        
        const results = await dbQuery(query, [startDate, endDate, currentYear]);
        
        debug('📊 [Weekly Tracker] Fetched', results.length, 'records from', startDate, 'to', endDate, 'for year', currentYear);
        
        // Helper function to get week start (Wed-Tue weeks)
        // For a given date, find the Wednesday that starts its Wed-Tue week
        const getWeekStart = (date) => {
            const d = new Date(date);
            const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
            
            let daysToSubtract;
            if (dayOfWeek >= 3) {
                // Wed(3), Thu(4), Fri(5), Sat(6) -> subtract days to get to Wed
                daysToSubtract = dayOfWeek - 3;
            } else {
                // Sun(0), Mon(1), Tue(2) -> subtract days + 4 to get to previous Wed
                daysToSubtract = dayOfWeek + 4;
            }
            
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - daysToSubtract);
            return weekStart.toISOString().split('T')[0];
        };
        
        // Group reports by week
        // Since reportdate is for the PREVIOUS week, we subtract 7 days first
        const weeklyData = {};
        
        results.forEach(row => {
            if (!row.reportdate) {
                debugWarn('📊 [Weekly Tracker] Skipping row with no reportdate:', row);
                return;
            }
            
            // The report date is Wed or Fri of the current week
            // It represents data for the PREVIOUS Wed-Tue week
            // So we subtract 7 days to get into the previous week, then find its Wed start
            
            // Parse MM/DD/YYYY format
            const [month, day, year] = row.reportdate.split('/');
            const reportDate = new Date(year, month - 1, day); // month is 0-indexed
            
            if (isNaN(reportDate.getTime())) {
                debugWarn('📊 [Weekly Tracker] Invalid date:', row.reportdate);
                return;
            }
            
            reportDate.setDate(reportDate.getDate() - 7); // Go back to previous week
            
            const weekStart = getWeekStart(reportDate);
            
            if (!weeklyData[weekStart]) {
                weeklyData[weekStart] = {
                    weekStart: weekStart,
                    net: 0,
                    gross: 0,
                    reportDates: []
                };
            }
            
            // Sum the LVL_1_NET and LVL_1_GROSS values
            const netValue = parseFloat(row.LVL_1_NET || 0);
            const grossValue = parseFloat(row.LVL_1_GROSS || 0);
            weeklyData[weekStart].net += netValue;
            weeklyData[weekStart].gross += grossValue;
            weeklyData[weekStart].reportDates.push(row.reportdate);
        });
        
        // Convert to array and sort by week start (newest first)
        const weeklyArray = Object.values(weeklyData).sort((a, b) => {
            return new Date(b.weekStart) - new Date(a.weekStart);
        });
        
        debug('📊 [Weekly Tracker] Aggregated into', weeklyArray.length, 'weeks');
        if (weeklyArray.length > 0) {
            debug('📊 [Weekly Tracker] First week:', weeklyArray[0].weekStart, '| Net:', weeklyArray[0].net, '| Gross:', weeklyArray[0].gross);
            debug('📊 [Weekly Tracker] Last week:', weeklyArray[weeklyArray.length - 1].weekStart, '| Net:', weeklyArray[weeklyArray.length - 1].net, '| Gross:', weeklyArray[weeklyArray.length - 1].gross);
        }
        
        res.json({
            success: true,
            data: weeklyArray.map(week => ({
                reportDate: week.weekStart,
                net: week.net,
                gross: week.gross
            }))
        });
        
    } catch (error) {
        console.error('❌ [Weekly Tracker] Error fetching weekly data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/alp/weekly/summary - Retrieve summary for Weekly_ALP for a given report date (yyyy-mm-dd)
router.get("/weekly/summary", (req, res) => {
  const { reportDate } = req.query;
  if (!reportDate) {
    return res.status(400).json({ error: "Please provide a 'reportDate' in yyyy-mm-dd format" });
  }
  const query = `
    SELECT 
      SUM(LVL_1_GROSS) AS totalLVL1Gross,
      SUM(LVL_1_NET) AS totalLVL1Net,
      SUM(LVL_2_GROSS) AS totalLVL2Gross,
      SUM(LVL_2_NET) AS totalLVL2Net,
      SUM(LVL_2_F6_GROSS) AS totalLVL2F6Gross,
      SUM(LVL_2_F6_NET) AS totalLVL2F6Net,
      SUM(LVL_3_GROSS) AS totalLVL3Gross,
      SUM(LVL_3_NET) AS totalLVL3Net,
      SUM(LVL_3_F6_GROSS) AS totalLVL3F6Gross,
      SUM(LVL_3_F6_NET) AS totalLVL3F6Net
    FROM Weekly_ALP
    WHERE reportdate = ?
  `;
  pool.query(query, [reportDate], (err, results) => {
    if (err) {

      return res.status(500).json({ error: "Database error" });
    }
    res.json(results[0]);
  });
});

// GET /api/alp/weekly/user-alp-by-date - Get ALP for a specific user and reportdate from Weekly_ALP
// If there are two rows for the same LagnName/reportdate, prioritize CL_Name = 'MGA'
router.get("/weekly/user-alp-by-date", (req, res) => {
  const { lagnname, reportdate } = req.query;
  
  if (!lagnname || !reportdate) {
    return res.status(400).json({ error: "Please provide lagnname and reportdate" });
  }

  // Query to get ALP for this user at this specific reportdate
  // If multiple rows exist (e.g., different CL_Name), prioritize CL_Name = 'MGA'
  const query = `
    SELECT 
      LVL_3_NET,
      reportdate,
      LagnName,
      CL_Name
    FROM Weekly_ALP
    WHERE LagnName = ?
    AND REPORT = 'MTD Recap'
    AND reportdate = ?
    ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END
    LIMIT 1
  `;

  pool.query(query, [lagnname, reportdate], (err, results) => {
    if (err) {
      console.error('[ALP] Error fetching ALP by date:', err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results && results.length > 0) {
      res.json({ success: true, data: results[0] });
    } else {
      res.json({ success: true, data: { LVL_3_NET: 0 } });
    }
  });
});

// GET /api/alp/weekly/user-alp-mtd - Get MTD ALP for a specific user from Weekly_ALP (max reportdate in current month)
// Handles users who may have entries in both Arias Main (Wednesday) and New York (Friday) reports
router.get("/weekly/user-alp-mtd", (req, res) => {
  const { lagnname, month, year, clNameFilter } = req.query;
  
  if (!lagnname || !month || !year) {
    return res.status(400).json({ error: "Please provide lagnname, month, and year" });
  }

  // Build the WHERE clause for CL_Name filtering
  let clNameCondition = '';
  let alpColumn = 'LVL_3_NET'; // Default to LVL_3_NET for MGA/GA/RGA
  
  if (clNameFilter === 'MGA') {
    clNameCondition = "AND CL_Name = 'MGA'";
  } else if (clNameFilter === 'NOT_MGA') {
    clNameCondition = "AND CL_Name != 'MGA'";
  } else if (clNameFilter === 'GA') {
    clNameCondition = "AND CL_Name = 'GA'";
  } else if (clNameFilter === 'SA') {
    clNameCondition = "AND CL_Name = 'SA'";
    alpColumn = 'LVL_2_NET'; // SA uses LVL_2_NET
  }

  // First, find the max reportdate for this user in the current month
  // We'll get the reportdate as a string and find the max by converting to date for comparison
  const maxDateQuery = `
    SELECT reportdate, STR_TO_DATE(reportdate, '%m/%d/%Y') as parsedDate
    FROM Weekly_ALP
    WHERE LagnName = ?
    AND REPORT = 'MTD Recap'
    AND MONTH(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
    AND YEAR(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
    ${clNameCondition}
    ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
    LIMIT 1
  `;

  pool.query(maxDateQuery, [lagnname, month, year], (err, maxResults) => {
    if (err) {
      console.error('[ALP] Error fetching max date:', err);
      return res.status(500).json({ error: "Database error" });
    }

    if (!maxResults || !maxResults[0] || !maxResults[0].reportdate) {
      return res.json({ success: true, data: { LVL_3_NET: 0, reportdate: null } });
    }

    const maxReportDate = maxResults[0].reportdate; // mm/dd/yyyy format
    const maxParsedDate = maxResults[0].parsedDate; // Date object

    // Calculate date 3 days prior to catch both Arias Main (Wed) and New York (Fri) reports
    const threeDaysPrior = new Date(maxParsedDate);
    threeDaysPrior.setDate(threeDaysPrior.getDate() - 3);

    // Now get all rows for this user within the 3-day window and sum by CL_Name
    // This handles cases where the user appears in both Arias Main and New York reports
    const sumQuery = `
      SELECT 
        SUM(${alpColumn}) as totalALP,
        CL_Name,
        GROUP_CONCAT(DISTINCT reportdate ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC SEPARATOR ', ') as reportdates,
        GROUP_CONCAT(DISTINCT REPORT ORDER BY REPORT SEPARATOR ', ') as reports
      FROM Weekly_ALP
      WHERE LagnName = ?
      AND REPORT = 'MTD Recap'
      AND STR_TO_DATE(reportdate, '%m/%d/%Y') BETWEEN ? AND ?
      ${clNameCondition}
      GROUP BY CL_Name
    `;

    pool.query(sumQuery, [lagnname, threeDaysPrior, maxParsedDate], (err, results) => {
      if (err) {
        console.error('[ALP] Error fetching summed ALP:', err);
        return res.status(500).json({ error: "Database error" });
      }

      if (results && results.length > 0) {
        // Sum across all CL_Name groups (MGA + RGA if both exist)
        const totalALP = results.reduce((sum, row) => sum + (row.totalALP || 0), 0);
        const allReportDates = results.map(r => r.reportdates).join(', ');
        
        res.json({ 
          success: true, 
          data: { 
            LVL_3_NET: totalALP,
            reportdate: maxReportDate,
            reportdates: allReportDates,
            reports: results.map(r => r.reports).join(', '),
            breakdown: results.map(r => ({
              clName: r.CL_Name,
              alp: r.totalALP,
              reportdates: r.reportdates
            }))
          } 
        });
      } else {
        res.json({ success: true, data: { LVL_3_NET: 0, reportdate: null } });
      }
    });
  });
});

// GET /api/alp/weekly/user-alp - Get actual ALP data for specific user and date range from Weekly_ALP
router.get("/weekly/user-alp", (req, res) => {
  const { lagnName, startDate, endDate, viewMode } = req.query;
  

  
  if (!lagnName || !startDate || !endDate) {

    return res.status(400).json({ error: "Please provide lagnName, startDate, and endDate" });
  }

  // Determine ALP column based on view mode and (optional) user role header
  const userRoleHeader = (req.headers && req.headers['user-role']) || '';
  let alpColumn = 'LVL_1_NET';
  let clNameCondition = '';
  
  if (viewMode === 'team' || viewMode === 'mga' || viewMode === 'rga') {
    const upperRole = String(userRoleHeader || '').toUpperCase();
    alpColumn = (upperRole === 'GA' || upperRole === 'MGA' || upperRole === 'RGA') ? 'LVL_3_NET' : 'LVL_2_NET';
    
    // For RGA users, apply CL_Name filtering based on viewMode
    if (upperRole === 'RGA') {
      if (viewMode === 'mga') {
        clNameCondition = "AND CL_Name = 'MGA'"; // MGA tab: show only MGA-level data
      } else if (viewMode === 'rga') {
        clNameCondition = "AND CL_Name != 'MGA'"; // RGA tab: show non-MGA data (RGA level + first-year rollups)
      }
    }
  }

  // Query to get Weekly_ALP data for the user's lagnName within the date range
  // Match by LagnName, filter by REPORT = 'Weekly Recap', and use dynamic ALP column
  // If multiple rows exist for same LagnName/reportdate, prioritize CL_Name = 'MGA'
  // Note: reportdate is stored as varchar in mm/dd/yyyy format, so we need to parse both sides
  const query = `
    SELECT 
      reportdate,
      ${alpColumn} AS actualAlp,
      LagnName,
      REPORT,
      CL_Name
    FROM (
      SELECT 
        reportdate,
        ${alpColumn},
        LagnName,
        REPORT,
        CL_Name,
        ROW_NUMBER() OVER (
          PARTITION BY LagnName, reportdate 
          ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, CL_Name
        ) as rn
      FROM Weekly_ALP
      WHERE LagnName = ?
      AND REPORT = 'Weekly Recap'
      ${clNameCondition}
      AND STR_TO_DATE(reportdate, '%m/%d/%Y') BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
    ) ranked
    WHERE rn = 1
    ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') ASC
  `;
  

  
  // Now run the main query
    pool.query(query, [lagnName, startDate, endDate], (err, results) => {
    if (err) {

      return res.status(500).json({ error: "Database error" });
    }
    

    
    // Transform results to match the expected format
    // The reportdate in Weekly_ALP represents the end of the week period
    // For example, reportdate 05/21/2025 represents data for week of 5/12-5/18
    // Note: reportdate is in mm/dd/yyyy format as varchar
    const formattedResults = results.map(row => {
      // Parse the mm/dd/yyyy format correctly
      const [month, day, year] = row.reportdate.split('/');
      const reportDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      
      // Go back 7 days from the reportdate to get to the week it represents
      const weekStartDate = new Date(reportDate);
      weekStartDate.setDate(reportDate.getDate() - 7);
      
      // Then find the Monday of that week
      const dayOfWeek = weekStartDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const monday = new Date(weekStartDate);
      monday.setDate(weekStartDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const weekKey = monday.toISOString().split('T')[0];
      

      
      return {
        reportDate: row.reportdate, // Keep original for reference
        weekKey: weekKey, // Monday of the week this data represents
        actualAlp: row.actualAlp || 0,
        // Include additional fields for debugging
        _debug: {
          lagnName: row.LagnName,
          report: row.REPORT,
          rawReportDate: row.reportdate,
          parsedReportDate: reportDate.toISOString().split('T')[0],
          calculatedWeekKey: weekKey
        }
      };
    });
    
    
    const response = { success: true, data: formattedResults };
    
        res.json(response);
        });
});

// GET /api/alp/weekly/user-mtd - Get latest MTD Recap ALP for specific user from Weekly_ALP
router.get("/weekly/user-mtd", (req, res) => {
  const { lagnName } = req.query;

  if (!lagnName) {
    return res.status(400).json({ error: "Please provide lagnName" });
  }

  const query = `
    SELECT reportdate, LVL_1_NET AS mtdAlp, LagnName, REPORT, CL_Name
    FROM (
      SELECT 
        reportdate,
        LVL_1_NET,
        LagnName,
        REPORT,
        CL_Name,
        ROW_NUMBER() OVER (
          PARTITION BY LagnName, STR_TO_DATE(reportdate, '%m/%d/%Y')
          ORDER BY CASE WHEN CL_Name = 'MGA' THEN 0 ELSE 1 END, CL_Name
        ) as rn
      FROM Weekly_ALP
      WHERE LagnName = ?
      AND REPORT = 'MTD Recap'
    ) ranked
    WHERE rn = 1
    ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
    LIMIT 1
  `;

  pool.query(query, [lagnName], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    const row = results && results[0] ? results[0] : null;
    return res.json({ success: true, data: row });
  });
});

/* =========================
   SGA_ALP Endpoints
   ========================= */

// GET /api/alp/sga - Retrieve data from SGA_ALP table
router.get("/sga", (req, res) => {
  pool.query("SELECT * FROM SGA_ALP", (err, results) => {
    if (err) {

      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// GET /api/alp/sga/summary - Retrieve summary for SGA_ALP for a given date or date range
router.get("/sga/summary", (req, res) => {
  const { date, startDate, endDate } = req.query;
  let query = "";
  let params = [];
  
  if (date) {
    query = "SELECT SUM(NET) AS totalNet, SUM(GROSS) AS totalGross FROM SGA_ALP WHERE date = ?";
    params = [date];
  } else if (startDate && endDate) {
    query = "SELECT SUM(NET) AS totalNet, SUM(GROSS) AS totalGross FROM SGA_ALP WHERE date BETWEEN ? AND ?";
    params = [startDate, endDate];
  } else {
    return res.status(400).json({ error: "Please provide either a 'date' or both 'startDate' and 'endDate'" });
  }
  
  pool.query(query, params, (err, results) => {
    if (err) {

      return res.status(500).json({ error: "Database error" });
    }
    res.json(results[0]);
  });
});

/* =========================
   Leaderboard Endpoints
   ========================= */

// GET /api/alp/getReportDates - Get available report dates for leaderboards
router.get('/getReportDates', async (req, res) => {
    const { reportType } = req.query;
    
    try {
        // For MTD reports, we need both Weekly_ALP dates and Monthly_ALP months
        if (reportType === 'MTD Recap') {
            // Get weekly dates
            const weeklyQuery = `
                SELECT DISTINCT STR_TO_DATE(reportdate, '%m/%d/%Y') AS reportdate
                FROM Weekly_ALP
                WHERE reportdate IS NOT NULL 
                AND reportdate != ''
                ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
            `;
            
            // Get monthly data
            const monthlyQuery = `
                SELECT DISTINCT month
                FROM Monthly_ALP
                WHERE month IS NOT NULL 
                AND month != ''
                ORDER BY month DESC
            `;

            // Execute both queries
            pool.query(weeklyQuery, (err, weeklyResults) => {
                if (err) {

                    return res.status(500).json({
                        success: false,
                        message: 'Internal server error while fetching report dates',
                        error: err.message,
                    });
                }

                pool.query(monthlyQuery, (err, monthlyResults) => {
                    if (err) {

                        return res.status(500).json({
                            success: false,
                            message: 'Internal server error while fetching report dates',
                            error: err.message,
                        });
                    }

                    // Process weekly dates
                    const weeklyDates = weeklyResults.map((row) => new Date(row.reportdate));
                    const formattedWeeklyDates = weeklyDates.map((date) => date.toISOString().split('T')[0]);

                    // Process monthly dates
                    const monthlyDates = monthlyResults.map((row) => row.month);

                    // Group weekly dates by month
                    const groupedDates = {};
                    formattedWeeklyDates.forEach(date => {
                        const [year, month] = date.split('-');
                        const monthKey = `${month}/${year}`;
                        
                        if (!groupedDates[monthKey]) {
                            groupedDates[monthKey] = {
                                monthHeader: monthKey,
                                dates: [],
                                hasMonthlyData: monthlyDates.includes(monthKey)
                            };
                        }
                        groupedDates[monthKey].dates.push(date);
                    });

                    // Create the final structure with month headers and dates
                    const reportDates = [];
                    Object.keys(groupedDates).sort((a, b) => {
                        // Sort by year/month descending
                        const [monthA, yearA] = a.split('/');
                        const [monthB, yearB] = b.split('/');
                        return new Date(`${yearB}-${monthB}-01`) - new Date(`${yearA}-${monthA}-01`);
                    }).forEach(monthKey => {
                        const group = groupedDates[monthKey];
                        
                        // Add month header if there's monthly data
                        if (group.hasMonthlyData) {
                            reportDates.push({
                                value: monthKey,
                                label: monthKey,
                                type: 'month',
                                isHeader: true
                            });
                        }
                        
                        // Add individual dates
                        group.dates.sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
                            const dateObj = new Date(date);
                            const formattedLabel = `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}/${dateObj.getFullYear()}`;
                            reportDates.push({
                                value: date,
                                label: formattedLabel,
                                type: 'date',
                                isHeader: false
                            });
                        });
                    });

                    const maxWeeklyDate = weeklyDates.length > 0 ? new Date(Math.max(...weeklyDates)) : new Date();

                    res.status(200).json({
                        success: true,
                        reportDates: reportDates,
                        defaultDate: formattedWeeklyDates[0] || maxWeeklyDate.toISOString().split('T')[0],
                        type: 'grouped'
                    });
                });
            });
        } else {
            // Regular query for non-MTD reports
            const query = `
                SELECT DISTINCT STR_TO_DATE(reportdate, '%m/%d/%Y') AS reportdate
                FROM Weekly_ALP
                WHERE reportdate IS NOT NULL 
                AND reportdate != ''
                ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
            `;

            pool.query(query, (err, results) => {
                if (err) {

                    return res.status(500).json({
                        success: false,
                        message: 'Internal server error while fetching report dates',
                        error: err.message,
                    });
                }

                if (!results.length) {
                    return res.status(404).json({ success: false, message: 'No report dates found' });
                }

                // Convert to Date objects and sort in descending order
                const reportDates = results.map((row) => new Date(row.reportdate));
                const maxReportDate = new Date(Math.max(...reportDates));

                // Calculate range (3 days before and after max date)
                const rangeStart = new Date(maxReportDate);
                rangeStart.setDate(maxReportDate.getDate() - 3);

                const rangeEnd = new Date(maxReportDate);
                rangeEnd.setDate(maxReportDate.getDate() + 3);

                res.status(200).json({
                    success: true,
                    reportDates: reportDates.map((date) => date.toISOString().split('T')[0]), // Return as strings
                    defaultDate: maxReportDate.toISOString().split('T')[0],
                    type: 'simple',
                    range: {
                        start: rangeStart.toISOString().split('T')[0],
                        end: rangeEnd.toISOString().split('T')[0],
                    },
                });
            });
        }
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching report dates',
            error: error.message,
        });
    }
});

// GET /api/alp/getUniqueMGAOptions - Get unique MGA filter options
router.get('/getUniqueMGAOptions', async (req, res) => {


    try {
        // Query to fetch unique combinations of MGA fields
        const query = `
            SELECT DISTINCT 
                lagnname,
                rga,
                tree 
            FROM MGAs
            WHERE Active = 'y' AND hide = 'n'
        `;


        
        pool.query(query, (err, results) => {
            if (err) {

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching unique MGA options.',
                    error: err.message,
                });
            }

            if (!results.length) {

                return res.status(404).json({
                    success: false,
                    message: 'No active MGAs found.',
                });
            }


            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching unique MGA options.',
            error: error.message,
        });
    }
});

// GET /api/alp/getweeklyall - Get all weekly leaderboard data
router.get('/getweeklyall', async (req, res) => {
    const { startDate, endDate, report = 'Weekly Recap', MGA_NAME, rga, tree } = req.query;



    if (!startDate || !endDate) {

        return res.status(400).json({ success: false, message: 'Start date and end date are required' });
    }

    try {
        // Base query
        let query = `
            SELECT DISTINCT 
                wa.reportdate, 
                wa.REPORT, 
                wa.LagnName, 
                au.clname, 
                wa.CTLNO,
                wa.CL_Name,
                wa.LVL_1_NET,
                wa.LVL_1_GROSS,
                wa.LVL_3_NET,
                wa.LVL_3_GROSS, 
                wa.MGA_NAME, 
                au.profpic, 
                au.esid,
                au.id AS userId,
                m.rga, 
                m.legacy, 
                m.tree 
            FROM Weekly_ALP wa
            LEFT JOIN activeusers au 
                ON TRIM(REGEXP_REPLACE(wa.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(au.lagnname, '[[:space:]]+', ' '))
            LEFT JOIN MGAs m 
                ON TRIM(REGEXP_REPLACE(wa.MGA_NAME, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(m.lagnname, '[[:space:]]+', ' '))
            WHERE wa.REPORT = ?
            AND STR_TO_DATE(wa.reportdate, '%m/%d/%Y') BETWEEN STR_TO_DATE(?, '%m/%d/%Y') AND STR_TO_DATE(?, '%m/%d/%Y')
        `;

        // Filters
        const params = [report, startDate, endDate];

        if (MGA_NAME) {
            query += ' AND (wa.MGA_NAME = ? OR wa.LagnName = ?)';
            params.push(MGA_NAME, MGA_NAME);
        }
        if (rga) {
            query += ' AND (m.rga = ? OR wa.LagnName = ?)';
            params.push(rga, rga);
        }
        if (tree) {
            query += ' AND (m.tree = ? OR wa.LagnName = ?)';
            params.push(tree, tree);
        }


        
        pool.query(query, params, (err, results) => {
            if (err) {

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getweeklyall',
                    error: err.message,
                });
            }


            // Return all rows - frontend will handle aggregation
            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data for getweeklyall',
            error: error.message,
        });
    }
});

// GET /api/alp/getweeklyall_simple - Weekly_ALP data without expensive joins (frontend already has /users/active)
router.get('/getweeklyall_simple', async (req, res) => {
    const { startDate, endDate, report = 'Weekly Recap', MGA_NAME } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'Start date and end date are required' });
    }

    try {
        let query = `
            SELECT
                wa.reportdate,
                wa.REPORT,
                wa.LagnName,
                wa.CTLNO,
                wa.CL_Name,
                wa.LVL_1_NET,
                wa.LVL_1_GROSS,
                wa.LVL_3_NET,
                wa.LVL_3_GROSS,
                wa.MGA_NAME,
                0 AS policy_count
            FROM Weekly_ALP wa
            WHERE wa.REPORT = ?
            AND STR_TO_DATE(wa.reportdate, '%m/%d/%Y') BETWEEN STR_TO_DATE(?, '%m/%d/%Y') AND STR_TO_DATE(?, '%m/%d/%Y')
        `;

        const params = [report, startDate, endDate];

        // Optional: MGA filter (same semantics as getweeklyall)
        if (MGA_NAME) {
            query += ' AND (wa.MGA_NAME = ? OR wa.LagnName = ?)';
            params.push(MGA_NAME, MGA_NAME);
        }

        pool.query(query, params, (err, results) => {
            if (err) {
                console.error('[alp/getweeklyall_simple] SQL error:', {
                    message: err.message,
                    code: err.code,
                    report,
                    startDate,
                    endDate,
                    MGA_NAME,
                });
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getweeklyall_simple',
                    error: err.message,
                });
            }

            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data for getweeklyall_simple',
            error: error.message,
        });
    }
});

// GET /api/alp/getweeklysa - Get SA weekly leaderboard data
router.get('/getweeklysa', async (req, res) => {
    const { startDate, endDate, report = 'Weekly Recap', MGA_NAME, rga, tree } = req.query;



    if (!startDate || !endDate) {

        return res.status(400).json({ success: false, message: 'Start date and end date are required' });
    }

    try {
        // Base query
        let query = `
            SELECT DISTINCT 
                wa.reportdate, 
                wa.REPORT, 
                wa.LagnName, 
                au.clname, 
                wa.CTLNO, 
                wa.LVL_2_NET, 
                wa.LVL_2_F6_NET,
                wa.LVL_2_GROSS,
                wa.LVL_2_F6_GROSS, 
                wa.MGA_NAME, 
                au.profpic, 
                au.esid,
                m.rga, 
                m.legacy, 
                m.tree 
            FROM Weekly_ALP wa
            LEFT JOIN activeusers au 
                ON TRIM(REGEXP_REPLACE(wa.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(au.lagnname, '[[:space:]]+', ' '))
            LEFT JOIN MGAs m 
                ON TRIM(REGEXP_REPLACE(wa.MGA_NAME, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(m.lagnname, '[[:space:]]+', ' '))
            WHERE wa.REPORT = ?
            AND au.clname = 'SA'
            AND STR_TO_DATE(wa.reportdate, '%m/%d/%Y') BETWEEN STR_TO_DATE(?, '%m/%d/%Y') AND STR_TO_DATE(?, '%m/%d/%Y')
        `;

        // Filters
        const filters = [report, startDate, endDate];
        if (MGA_NAME) {
            query += ' AND wa.MGA_NAME = ?';
            filters.push(MGA_NAME);
        }
        if (rga) {
            query += ' AND (m.rga = ? OR wa.MGA_NAME = ?)';
            filters.push(rga, rga);
        }
        if (tree) {
            query += ' AND m.tree = ?';
            filters.push(tree);
        }


        
        pool.query(query, filters, (err, results) => {
            if (err) {

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getweeklysa',
                    error: err.message,
                });
            }


            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data for getweeklysa',
            error: error.message,
        });
    }
});

// GET /api/alp/getweeklyga - Get GA weekly leaderboard data
router.get('/getweeklyga', async (req, res) => {
    const { startDate, endDate, report = 'Weekly Recap', MGA_NAME, rga, tree } = req.query;



    if (!startDate || !endDate) {

        return res.status(400).json({ success: false, message: 'Start date and end date are required' });
    }

    try {
        // Base query
        let query = `
            SELECT DISTINCT 
                wa.reportdate, 
                wa.REPORT, 
                wa.LagnName, 
                au.clname, 
                wa.CTLNO, 
                wa.LVL_3_NET, 
                wa.LVL_3_F6_NET,
                wa.LVL_3_GROSS,
                wa.LVL_3_F6_GROSS, 
                wa.MGA_NAME, 
                au.profpic, 
                au.esid,
                m.rga, 
                m.legacy, 
                m.tree 
            FROM Weekly_ALP wa
            LEFT JOIN activeusers au 
                ON TRIM(REGEXP_REPLACE(wa.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(au.lagnname, '[[:space:]]+', ' '))
            LEFT JOIN MGAs m 
                ON TRIM(REGEXP_REPLACE(wa.MGA_NAME, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(m.lagnname, '[[:space:]]+', ' '))
            WHERE wa.REPORT = ?
            AND au.clname = 'GA'
            AND STR_TO_DATE(wa.reportdate, '%m/%d/%Y') BETWEEN STR_TO_DATE(?, '%m/%d/%Y') AND STR_TO_DATE(?, '%m/%d/%Y')
        `;

        // Filters
        const filters = [report, startDate, endDate];
        if (MGA_NAME) {
            query += ' AND wa.MGA_NAME = ?';
            filters.push(MGA_NAME);
        }
        if (rga) {
            query += ' AND (m.rga = ? OR wa.MGA_NAME = ?)';
            filters.push(rga, rga);
        }
        if (tree) {
            query += ' AND m.tree = ?';
            filters.push(tree);
        }


        
        pool.query(query, filters, (err, results) => {
            if (err) {

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getweeklyga',
                    error: err.message,
                });
            }


            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data for getweeklyga',
            error: error.message,
        });
    }
});

// GET /api/alp/getweeklymga - Get MGA weekly leaderboard data
router.get('/getweeklymga', async (req, res) => {
    const { startDate, endDate, report = 'Weekly Recap', rga, tree } = req.query;



    if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'Start date and end date are required' });
    }

    try {
        let query = `
            SELECT 
                wa.reportdate, 
                wa.REPORT, 
                wa.LagnName, 
                au.clname, 
                wa.CTLNO,
                wa.CL_Name,
                wa.LVL_1_NET,
                wa.LVL_1_GROSS, 
                wa.LVL_3_NET,
                wa.LVL_3_F6_NET,
                wa.LVL_3_GROSS,
                wa.LVL_3_F6_GROSS, 
                wa.MGA_NAME, 
                au.profpic,
                m.start,
                m.rga, 
                m.tree
            FROM Weekly_ALP wa
            LEFT JOIN activeusers au 
                ON TRIM(REGEXP_REPLACE(wa.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(au.lagnname, '[[:space:]]+', ' '))
            LEFT JOIN MGAs m 
                ON TRIM(REGEXP_REPLACE(wa.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(m.LagnName, '[[:space:]]+', ' '))
            WHERE wa.REPORT = ?
            AND au.clname IN ('MGA', 'RGA')
            AND m.Active = 'y'
            AND m.hide = 'n'
            AND STR_TO_DATE(wa.reportdate, '%m/%d/%Y') BETWEEN STR_TO_DATE(?, '%m/%d/%Y') AND STR_TO_DATE(?, '%m/%d/%Y')
        `;

        const params = [report, startDate, endDate];

        // Apply filtering based on `rga` or `tree`
        if (rga) {
            query += ' AND (m.rga = ? OR wa.MGA_NAME = ?)';
            params.push(rga, rga);
        }
        if (tree) {
            query += ' AND m.tree = ?';
            params.push(tree);
        }


        
        pool.query(query, params, (err, results) => {
            if (err) {

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: err.message,
                });
            }

            // Return all rows - frontend will handle aggregation
            // This allows proper summing of:
            // 1. Multiple CTLNO codes per user
            // 2. Multiple reportdates (Arias Main + New York reports within 3 days)
            // 3. CL_Name filtering for MGA vs RGA views
            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
});

// GET /api/alp/getweeklyrga - Get RGA weekly leaderboard data
router.get('/getweeklyrga', async (req, res) => {
    const { startDate, endDate, report = 'Weekly Recap', rga, tree } = req.query;



    if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'Start date and end date are required' });
    }

    try {
        let query = `
            SELECT 
                wa.reportdate, 
                wa.REPORT, 
                wa.LagnName, 
                au.clname, 
                wa.CTLNO,
                wa.CL_Name,
                wa.LVL_1_NET,
                wa.LVL_1_GROSS,
                wa.LVL_3_NET,
                wa.LVL_3_F6_NET,
                wa.LVL_3_GROSS,
                wa.LVL_3_F6_GROSS, 
                wa.MGA_NAME, 
                au.profpic,
                COALESCE(m.rga, ?) AS rga, -- Ensure the selected rga is included
                COALESCE(m.tree, ?) AS tree -- Ensure the selected tree is included
            FROM Weekly_ALP wa
            LEFT JOIN activeusers au 
                ON TRIM(REGEXP_REPLACE(wa.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(au.lagnname, '[[:space:]]+', ' '))
            LEFT JOIN MGAs m 
                ON TRIM(REGEXP_REPLACE(wa.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(m.LagnName, '[[:space:]]+', ' '))
            WHERE wa.REPORT = ?
            AND au.clname = 'RGA'
            AND m.Active = 'y'
            AND m.hide = 'n'
            AND wa.CL_Name = ''
            AND STR_TO_DATE(wa.reportdate, '%m/%d/%Y') BETWEEN STR_TO_DATE(?, '%m/%d/%Y') AND STR_TO_DATE(?, '%m/%d/%Y')
        `;

        const params = [rga || 'N/A', tree || 'N/A', report, startDate, endDate];

        if (rga) {
            query += ' AND (m.rga = ? OR wa.MGA_NAME = ?)';
            params.push(rga, rga);
        }
        if (tree) {
            query += ' AND m.tree = ?';
            params.push(tree);
        }


        
        pool.query(query, params, (err, results) => {
            if (err) {

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: err.message,
                });
            }

            // Return all rows - frontend will handle aggregation
            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
});

/* =========================
   Monthly_ALP Endpoints
   ========================= */

// GET /api/alp/getmonthlyall - Get all monthly leaderboard data
router.get('/getmonthlyall', async (req, res) => {
    const { month, MGA_NAME, rga, tree } = req.query;



    if (!month) {

        return res.status(400).json({ success: false, message: 'Month is required' });
    }

    try {
        // Base query for Monthly_ALP
        let query = `
            SELECT DISTINCT 
                ma.month, 
                ma.REPORT, 
                ma.LagnName, 
                au.clname, 
                ma.CTLNO, 
                ma.LVL_1_NET,
                ma.LVL_1_GROSS, 
                ma.MGA_NAME, 
                au.profpic, 
                au.esid,
                m.rga, 
                m.legacy, 
                m.tree 
            FROM Monthly_ALP ma
            LEFT JOIN activeusers au 
                ON TRIM(REGEXP_REPLACE(ma.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(au.lagnname, '[[:space:]]+', ' '))
            LEFT JOIN MGAs m 
                ON TRIM(REGEXP_REPLACE(ma.MGA_NAME, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(m.lagnname, '[[:space:]]+', ' '))
            WHERE ma.month = ?
        `;

        // Filters
        const params = [month];

        if (MGA_NAME) {
            query += ' AND (ma.MGA_NAME = ? OR ma.LagnName = ?)';
            params.push(MGA_NAME, MGA_NAME);
        }
        if (rga) {
            query += ' AND (m.rga = ? OR ma.LagnName = ?)';
            params.push(rga, rga);
        }
        if (tree) {
            query += ' AND (m.tree = ? OR ma.LagnName = ?)';
            params.push(tree, tree);
        }


        
        pool.query(query, params, (err, results) => {
            if (err) {

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getmonthlyall',
                    error: err.message,
                });
            }



            // Deduplication Logic: Keep only the row where `CTLNO = MGA` if duplicates exist
            const deduplicatedResults = [];
            const seen = new Map();

            for (const row of results) {
                const uniqueKey = row.LagnName;

                if (!seen.has(uniqueKey)) {
                    seen.set(uniqueKey, row);
                } else {
                    // If a duplicate exists, prefer the row where `CTLNO = MGA`
                    if (row.CTLNO === 'MGA') {
                        seen.set(uniqueKey, row);
                    }
                }
            }

            const finalResults = Array.from(seen.values());



            res.status(200).json({
                success: true,
                data: finalResults,
            });
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data for getmonthlyall',
            error: error.message,
        });
    }
});

// GET /api/alp/getmonthlysa - Get SA monthly leaderboard data
router.get('/getmonthlysa', async (req, res) => {
    const { month, MGA_NAME, rga, tree } = req.query;



    if (!month) {

        return res.status(400).json({ success: false, message: 'Month is required' });
    }

    try {
        let query = `
            SELECT DISTINCT 
                ma.month, 
                ma.REPORT, 
                ma.LagnName, 
                au.clname, 
                ma.CTLNO, 
                ma.LVL_2_NET,
                ma.LVL_2_F6_NET,
                ma.LVL_2_GROSS, 
                ma.LVL_2_F6_GROSS,
                ma.MGA_NAME, 
                au.profpic, 
                au.esid,
                m.rga, 
                m.legacy, 
                m.tree 
            FROM Monthly_ALP ma
            LEFT JOIN activeusers au 
                ON TRIM(REGEXP_REPLACE(ma.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(au.lagnname, '[[:space:]]+', ' '))
            LEFT JOIN MGAs m 
                ON TRIM(REGEXP_REPLACE(ma.MGA_NAME, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(m.lagnname, '[[:space:]]+', ' '))
            WHERE au.clname = 'SA'
            AND ma.month = ?
        `;

        const params = [month];

        if (MGA_NAME) {
            query += ' AND (ma.MGA_NAME = ? OR ma.LagnName = ?)';
            params.push(MGA_NAME, MGA_NAME);
        }
        if (rga) {
            query += ' AND (m.rga = ? OR ma.LagnName = ?)';
            params.push(rga, rga);
        }
        if (tree) {
            query += ' AND (m.tree = ? OR ma.LagnName = ?)';
            params.push(tree, tree);
        }


        
        pool.query(query, params, (err, results) => {
            if (err) {

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getmonthlysa',
                    error: err.message,
                });
            }



            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data for getmonthlysa',
            error: error.message,
        });
    }
});

// GET /api/alp/getmonthlyga - Get GA monthly leaderboard data
router.get('/getmonthlyga', async (req, res) => {
    const { month, MGA_NAME, rga, tree } = req.query;



    if (!month) {

        return res.status(400).json({ success: false, message: 'Month is required' });
    }

    try {
        let query = `
            SELECT DISTINCT 
                ma.month, 
                ma.REPORT, 
                ma.LagnName, 
                au.clname, 
                ma.CTLNO, 
                ma.LVL_3_NET,
                ma.LVL_3_F6_NET,
                ma.LVL_3_GROSS, 
                ma.LVL_3_F6_GROSS,
                ma.MGA_NAME, 
                au.profpic, 
                au.esid,
                m.rga, 
                m.legacy, 
                m.tree 
            FROM Monthly_ALP ma
            LEFT JOIN activeusers au 
                ON TRIM(REGEXP_REPLACE(ma.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(au.lagnname, '[[:space:]]+', ' '))
            LEFT JOIN MGAs m 
                ON TRIM(REGEXP_REPLACE(ma.MGA_NAME, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(m.lagnname, '[[:space:]]+', ' '))
            WHERE au.clname = 'GA'
            AND ma.month = ?
        `;

        const params = [month];

        if (MGA_NAME) {
            query += ' AND (ma.MGA_NAME = ? OR ma.LagnName = ?)';
            params.push(MGA_NAME, MGA_NAME);
        }
        if (rga) {
            query += ' AND (m.rga = ? OR ma.LagnName = ?)';
            params.push(rga, rga);
        }
        if (tree) {
            query += ' AND (m.tree = ? OR ma.LagnName = ?)';
            params.push(tree, tree);
        }


        
        pool.query(query, params, (err, results) => {
            if (err) {

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getmonthlyga',
                    error: err.message,
                });
            }



            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data for getmonthlyga',
            error: error.message,
        });
    }
});

// GET /api/alp/getmonthlymga - Get MGA monthly leaderboard data
router.get('/getmonthlymga', async (req, res) => {
    const { month, rga, tree } = req.query;



    if (!month) {

        return res.status(400).json({ success: false, message: 'Month is required' });
    }

    try {
        let query = `
            SELECT
                ma.month, 
                ma.REPORT, 
                ma.LagnName, 
                au.clname, 
                ma.CTLNO, 
                ma.LVL_3_NET,
                ma.LVL_3_F6_NET,
                ma.LVL_3_GROSS, 
                ma.LVL_3_F6_GROSS,
                ma.MGA_NAME, 
                au.profpic, 
                m.start, 
                m.rga,
                m.tree
            FROM Monthly_ALP ma
            LEFT JOIN activeusers au 
                ON TRIM(REGEXP_REPLACE(ma.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(au.lagnname, '[[:space:]]+', ' '))
            LEFT JOIN MGAs m 
                ON TRIM(REGEXP_REPLACE(ma.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(m.LagnName, '[[:space:]]+', ' '))
            WHERE au.clname IN ('MGA', 'RGA')
            AND m.Active = 'y'
            AND m.hide = 'n'
            AND ma.month = ?
        `;

        const params = [month];

        if (rga) {
            query += ' AND m.rga = ?';
            params.push(rga);
        }
        if (tree) {
            query += ' AND m.tree = ?';
            params.push(tree);
        }


        
        pool.query(query, params, (err, results) => {
            if (err) {

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getmonthlymga',
                    error: err.message,
                });
            }



            // Deduplication Logic
            const deduplicatedResults = [];
            const seen = new Map();

            for (const row of results) {
                const uniqueKey = row.LagnName;

                if (!seen.has(uniqueKey)) {
                    seen.set(uniqueKey, row);
                } else {
                    if (row.CTLNO === 'MGA') {
                        seen.set(uniqueKey, row);
                    }
                }
            }

            const finalResults = Array.from(seen.values());



            res.status(200).json({
                success: true,
                data: finalResults,
            });
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data for getmonthlymga',
            error: error.message,
        });
    }
});

// GET /api/alp/getmonthlyrga - Get RGA monthly leaderboard data
router.get('/getmonthlyrga', async (req, res) => {
    const { month, rga, tree } = req.query;



    if (!month) {

        return res.status(400).json({ success: false, message: 'Month is required' });
    }

    try {
        let query = `
            SELECT
                ma.month, 
                ma.REPORT, 
                ma.LagnName, 
                au.clname, 
                ma.CTLNO, 
                ma.LVL_3_NET,
                ma.LVL_3_F6_NET,
                ma.LVL_3_GROSS, 
                ma.LVL_3_F6_GROSS,
                ma.MGA_NAME, 
                au.profpic, 
                COALESCE(m.rga, ?) AS rga, -- Ensure the selected rga is included
                COALESCE(m.tree, ?) AS tree -- Ensure the selected tree is included
            FROM Monthly_ALP ma
            LEFT JOIN activeusers au 
                ON TRIM(REGEXP_REPLACE(ma.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(au.lagnname, '[[:space:]]+', ' '))
            LEFT JOIN MGAs m 
                ON TRIM(REGEXP_REPLACE(ma.LagnName, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(m.LagnName, '[[:space:]]+', ' '))
            WHERE au.clname = 'RGA'
            AND m.Active = 'y'
            AND m.hide = 'n'
            AND ma.CL_Name = ''
            AND ma.month = ?
        `;

        const params = [rga || '', tree || '', month];

        if (rga) {
            query += ' AND m.rga = ?';
            params.push(rga);
        }
        if (tree) {
            query += ' AND m.tree = ?';
            params.push(tree);
        }


        
        pool.query(query, params, (err, results) => {
            if (err) {

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getmonthlyrga',
                    error: err.message,
                });
            }



            // Deduplication Logic
            const deduplicatedResults = [];
            const seen = new Map();

            for (const row of results) {
                const uniqueKey = row.LagnName;

                if (!seen.has(uniqueKey)) {
                    seen.set(uniqueKey, row);
                } else {
                    if (row.CTLNO === 'MGA') {
                        seen.set(uniqueKey, row);
                    }
                }
            }

            const finalResults = Array.from(seen.values());



            res.status(200).json({
                success: true,
                data: finalResults,
            });
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data for getmonthlyrga',
            error: error.message,
        });
    }
});

/* =========================
   Raw Data Endpoints for Hire to Code Calculation
   ========================= */

// GET /api/alp/associates-raw - Retrieve raw associates/codes data for hire to code calculation
router.get("/associates-raw", async (req, res) => {
    try {
        const { agnName, userRole, useSgaEndpoints, years } = req.query;
        
        // Parse years parameter
        const yearsList = years ? years.split(',').map(y => parseInt(y)) : [new Date().getFullYear()];
        
        let query = `
            SELECT 
                PRODDATE,
                MGA,
                YEAR(PRODDATE) as year,
                MONTH(PRODDATE) as month
            FROM Associates_Codes 
            WHERE YEAR(PRODDATE) IN (${yearsList.map(() => '?').join(',')})
        `;
        
        let params = [...yearsList];
        
        // Add filtering based on user role and MGA selection
        if (useSgaEndpoints === 'true' || userRole === 'ADMIN' || userRole === 'SGA') {
            if (agnName && agnName !== '') {
                query += ` AND (MGA = ? OR RGA = ? OR GA = ? OR SA = ?)`;
                params.push(agnName, agnName, agnName, agnName);
            }
        } else {
            if (agnName && agnName !== '') {
                query += ` AND (MGA = ? OR RGA = ? OR GA = ? OR SA = ?)`;
                params.push(agnName, agnName, agnName, agnName);
            }
        }
        
        query += ` ORDER BY PRODDATE ASC`;
        
        const { query: dbQuery } = require('../db');
        const results = await dbQuery(query, params);
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching raw associates data',
            error: error.message,
        });
    }
});

// GET /api/alp/hires-raw - Retrieve raw hires data for hire to code calculation
router.get("/hires-raw", async (req, res) => {
    try {
        const { agnName, userRole, useSgaEndpoints, years } = req.query;
        
        // Parse years parameter
        const yearsList = years ? years.split(',').map(y => parseInt(y)) : [new Date().getFullYear()];
        
        let query = `
            SELECT 
                MORE_Date,
                MGA,
                Total_Hires,
                YEAR(MORE_Date) as year,
                MONTH(MORE_Date) as month
            FROM MORE_Reports 
            WHERE YEAR(MORE_Date) IN (${yearsList.map(() => '?').join(',')})
        `;
        
        let params = [...yearsList];
        
        // Add filtering based on user role and MGA selection
        if (useSgaEndpoints === 'true' || userRole === 'ADMIN' || userRole === 'SGA') {
            if (agnName && agnName !== '') {
                query += ` AND (MGA = ? OR RGA = ? OR GA = ? OR SA = ?)`;
                params.push(agnName, agnName, agnName, agnName);
            }
        } else {
            if (agnName && agnName !== '') {
                query += ` AND (MGA = ? OR RGA = ? OR GA = ? OR SA = ?)`;
                params.push(agnName, agnName, agnName, agnName);
            }
        }
        
        query += ` ORDER BY MORE_Date ASC`;
        
        const { query: dbQuery } = require('../db');
        const results = await dbQuery(query, params);
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching raw hires data',
            error: error.message,
        });
    }
});

// MGA Dashboard Endpoints

// GET /api/alp/mga/weekly-ytd - Get YTD data from Weekly_ALP for MGA dashboard
router.get("/mga/weekly-ytd", async (req, res) => {
    try {
        const { lagnName, viewMode } = req.query;
        
        debug('[YTD Backend] Fetching YTD data for lagnName:', lagnName, 'viewMode:', viewMode);
        
        if (!lagnName) {
            debugWarn('[YTD Backend] ERROR: lagnName parameter missing');
            return res.status(400).json({ error: "lagnName parameter is required" });
        }
        
        // Determine CL_Name filtering based on viewMode (for RGA users)
        const userRoleHeader = (req.headers && req.headers['user-role']) || '';
        const upperRole = String(userRoleHeader || '').toUpperCase();
        let clNameCondition = '';
        
        if (upperRole === 'RGA') {
            if (viewMode === 'mga') {
                clNameCondition = "AND CL_Name = 'MGA'"; // MGA tab: show only MGA-level data
            } else if (viewMode === 'rga') {
                clNameCondition = "AND (CL_Name = '' OR CL_Name IS NULL)"; // RGA tab: show blank CL_Name rows
            }
        }
        
        // Get the max reportdate where REPORT = 'YTD Recap' for the specific MGA in the current year
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        
        const query = `
            SELECT *
            FROM Weekly_ALP 
            WHERE LagnName = ? 
            AND REPORT = 'YTD Recap' 
            ${clNameCondition}
            AND YEAR(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            AND reportdate = (
                SELECT MAX(reportdate) 
                FROM Weekly_ALP 
                WHERE LagnName = ? 
                AND REPORT = 'YTD Recap'
                ${clNameCondition}
                AND YEAR(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            )
        `;
        
        debug('[YTD Backend] Executing query:', query);
        debug('[YTD Backend] Query parameters:', [lagnName, currentYear, lagnName, currentYear]);
        debug('[YTD Backend] Current year filter:', currentYear);
        debug('[YTD Backend] CL_Name condition:', clNameCondition || 'None (no filtering)');
        
        const { query: dbQuery } = require('../db');
        const results = await dbQuery(query, [lagnName, currentYear, lagnName, currentYear]);
        
        debug('[YTD Backend] Query returned', results.length, 'rows');
        
        if (results.length > 0) {
            const row = results[0];
            debug('[YTD Backend] First row data:');
            debug('[YTD Backend] - LagnName:', row.LagnName);
            debug('[YTD Backend] - REPORT:', row.REPORT);
            debug('[YTD Backend] - reportdate:', row.reportdate);
            debug('[YTD Backend] - LVL_1_NET:', row.LVL_1_NET);
            debug('[YTD Backend] - LVL_2_F6_NET:', row.LVL_2_F6_NET);
            debug('[YTD Backend] - Available fields:', Object.keys(row));
        } else {
            debug('[YTD Backend] No data found for lagnName:', lagnName);
        }
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {
        console.error('[YTD Backend] Error fetching YTD data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching MGA Weekly_ALP YTD data',
            error: error.message,
        });
    }
});

// GET /api/alp/mga/monthly-alp - Get Monthly_ALP data for MGA dashboard
router.get("/mga/monthly-alp", async (req, res) => {
    try {
        const { lagnName, month, viewMode } = req.query;
        

        
        if (!lagnName) {
            return res.status(400).json({ error: "lagnName parameter is required" });
        }
        
        // Determine CL_Name filtering based on viewMode (for RGA users)
        const userRoleHeader = (req.headers && req.headers['user-role']) || '';
        const upperRole = String(userRoleHeader || '').toUpperCase();
        let clNameCondition = '';
        
        if (upperRole === 'RGA') {
            if (viewMode === 'mga') {
                clNameCondition = "AND CL_Name = 'MGA'"; // MGA tab: show only MGA-level data
            } else if (viewMode === 'rga') {
                clNameCondition = "AND (CL_Name = '' OR CL_Name IS NULL)"; // RGA tab: show blank CL_Name rows
            }
        }
        
        // First, get all rows for the agent (with or without month filter)
        let baseQuery = `
            SELECT *
            FROM Monthly_ALP 
            WHERE LagnName = ?
            ${clNameCondition}
        `;
        
        let params = [lagnName];
        
        // If specific month is requested (mm/yyyy format)
        if (month) {
            baseQuery += ` AND month = ?`;
            params.push(month);

        }
        
        baseQuery += ` ORDER BY month DESC, CL_Name DESC`;
        

        
        const { query: dbQuery } = require('../db');
        const allResults = await dbQuery(baseQuery, params);
        
        console.log('[Monthly ALP] Query results:', {
            lagnName,
            viewMode,
            clNameCondition: clNameCondition || 'None',
            rowCount: allResults.length
        });
        
        // Group by month and prefer MGA records when multiple exist (unless filtered by CL_Name)
        const groupedByMonth = {};
        allResults.forEach(row => {
            const monthKey = row.month;
            if (!groupedByMonth[monthKey]) {
                groupedByMonth[monthKey] = [];
            }
            groupedByMonth[monthKey].push(row);
        });
        
        // For each month, prefer MGA record if multiple exist, otherwise take the single record
        // Note: If CL_Name is already filtered in query, this step is mostly redundant but safe
        const finalResults = [];
        Object.keys(groupedByMonth).forEach(monthKey => {
            const monthRecords = groupedByMonth[monthKey];
            if (monthRecords.length === 1) {
                // Only one record for this month, use it regardless of CL_Name
                finalResults.push(monthRecords[0]);

            } else {
                // Multiple records, prefer MGA unless we're filtering for non-MGA
                if (viewMode === 'rga') {
                    // For RGA view, prefer non-MGA records
                    const nonMgaRecord = monthRecords.find(r => r.CL_Name !== 'MGA');
                    if (nonMgaRecord) {
                        finalResults.push(nonMgaRecord);
                    } else {
                        finalResults.push(monthRecords[0]);
                    }
                } else {
                    // Default: prefer MGA
                    const mgaRecord = monthRecords.find(r => r.CL_Name === 'MGA');
                    if (mgaRecord) {
                        finalResults.push(mgaRecord);
                    } else {
                        // No MGA record, take the first one
                        finalResults.push(monthRecords[0]);
                    }
                }
            }
        });
        
        // Sort final results by month descending
        finalResults.sort((a, b) => {
            if (a.month > b.month) return -1;
            if (a.month < b.month) return 1;
            return 0;
        });
        

        
        res.json({
            success: true,
            data: finalResults
        });
        
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching MGA Monthly_ALP data',
            error: error.message,
        });
    }
});

// GET /api/alp/mga/associates - Get Associates data filtered by MGA (same table as SGA)
router.get("/mga/associates", async (req, res) => {
    try {
        const { lagnName, userRole, viewMode } = req.query;
        
        if (!lagnName) {
            return res.status(400).json({ error: "lagnName parameter is required" });
        }
        
        let query, queryParams;
        
        // For SA and GA users, check multiple columns (sa, ga, mga) for their name
        if (userRole === 'SA' || userRole === 'GA') {
            query = `
                SELECT *
                FROM associates 
                WHERE sa = ? OR ga = ? OR mga = ?
                ORDER BY PRODDATE DESC
            `;
            queryParams = [lagnName, lagnName, lagnName];
        } else if (userRole === 'RGA' && viewMode === 'rga') {
            // For RGA users in RGA view mode, filter by RGA column (includes first-year MGA rollups)
            query = `
                SELECT *
                FROM associates 
                WHERE RGA = ?
                ORDER BY PRODDATE DESC
            `;
            queryParams = [lagnName];
        } else {
            // For other roles (MGA, AGT) or RGA in MGA view mode, use MGA filtering
            query = `
                SELECT *
                FROM associates 
                WHERE MGA = ?
                ORDER BY PRODDATE DESC
            `;
            queryParams = [lagnName];
        }
        
        const { query: dbQuery } = require('../db');
        const results = await dbQuery(query, queryParams);
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching MGA Associates data',
            error: error.message,
        });
    }
});

// GET /api/alp/mga/vips - Get VIPs data filtered by MGA (from VIPs table)
router.get("/mga/vips", async (req, res) => {
    try {
        const { lagnName, userRole, viewMode } = req.query;
        
        if (!lagnName) {
            return res.status(400).json({ error: "lagnName parameter is required" });
        }
        
        let query, queryParams;
        
        // For SA and GA users, check multiple columns (sa, ga, mga) for their name
        if (userRole === 'SA' || userRole === 'GA') {
            query = `
                SELECT *
                FROM VIPs 
                WHERE sa = ? OR ga = ? OR mga = ?
                ORDER BY vip_month DESC
            `;
            queryParams = [lagnName, lagnName, lagnName];
        } else if (userRole === 'RGA' && viewMode === 'rga') {
            // For RGA users in RGA view mode, filter by RGA column (includes first-year MGA rollups)
            query = `
                SELECT *
                FROM VIPs 
                WHERE rga = ?
                ORDER BY vip_month DESC
            `;
            queryParams = [lagnName];
        } else {
            // For other roles (MGA, AGT) or RGA in MGA view mode, use MGA filtering
            query = `
                SELECT *
                FROM VIPs 
                WHERE mga = ?
                ORDER BY vip_month DESC
            `;
            queryParams = [lagnName];
        }
        
        const { query: dbQuery } = require('../db');
        const results = await dbQuery(query, queryParams);
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching MGA VIPs data',
            error: error.message,
        });
    }
});

// GET /api/alp/mga/hires - Get Hires data from amore_data where MGA matches
router.get("/mga/hires", async (req, res) => {
    try {
        const { lagnName, userRole, viewMode } = req.query;
        
        if (!lagnName) {
            return res.status(400).json({ error: "lagnName parameter is required" });
        }
        
        let query, queryParams;
        
        if (userRole === 'RGA' && viewMode === 'rga') {
            // For RGA users in RGA view mode, filter by RGA column (includes first-year MGA rollups)
            query = `
                SELECT *
                FROM amore_data 
                WHERE RGA = ?
                ORDER BY MORE_Date DESC
            `;
            queryParams = [lagnName];
        } else {
            // For other roles (MGA, AGT) or RGA in MGA view mode, use MGA filtering
            query = `
                SELECT *
                FROM amore_data 
                WHERE MGA = ?
                ORDER BY MORE_Date DESC
            `;
            queryParams = [lagnName];
        }
        
        const { query: dbQuery } = require('../db');
        const results = await dbQuery(query, queryParams);
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching MGA Hires data',
            error: error.message,
        });
    }
});

// GET /api/alp/sa/team-daily-activity - Get Daily_Activity data for SA team mode (agent's own ALP + all agents where SA = agent)
router.get("/sa/team-daily-activity", async (req, res) => {
    try {
        const { lagnName, startDate, endDate } = req.query;
        
        if (!lagnName) {
            return res.status(400).json({ error: "lagnName parameter is required" });
        }
        
        const { query: dbQuery } = require('../db');
        
        console.log('📊 [SA Team Daily Activity] Request params:', {
            lagnName,
            startDate,
            endDate,
            timestamp: new Date().toISOString()
        });
        
        // Build the query to get:
        // 1. This agent's own Daily_Activity.alp where agent = lagnName
        // 2. All Daily_Activity.alp where SA = lagnName
        let query = `
            SELECT 
                SUM(alp) AS totalAlp,
                SUM(refAlp) AS totalRefAlp, 
                SUM(refs) AS totalRefs,
                COUNT(DISTINCT agent) AS agentCount
            FROM Daily_Activity 
            WHERE (agent = ? OR SA = ?)
        `;
        
        let params = [lagnName, lagnName];
        
        // Add date filtering if provided
        if (startDate && endDate) {
            query += ` AND reportDate >= ? AND reportDate <= ?`;
            params.push(startDate, endDate);
        }
        
        console.log('📊 [SA Team Daily Activity] Query:', {
            query: query.replace(/\s+/g, ' ').trim(),
            params,
            description: 'Summing ALP where user is agent OR where user is SA'
        });
        
        const results = await dbQuery(query, params);
        const result = results[0] || {};
        
        let responseData = {
            totalAlp: parseFloat(result.totalAlp) || 0,
            totalRefAlp: parseFloat(result.totalRefAlp) || 0,
            totalRefs: parseInt(result.totalRefs) || 0,
            agentCount: parseInt(result.agentCount) || 0
        };
        
        // Special case: For MAUGHANEVANSON BRODY W, also include all LOCKER-ROTOLO users
        if (lagnName === 'MAUGHANEVANSON BRODY W') {
            let lockerRotoloQuery = `
                SELECT 
                    SUM(da.alp) AS totalAlp,
                    SUM(da.refAlp) AS totalRefAlp, 
                    SUM(da.refs) AS totalRefs,
                    COUNT(DISTINCT da.agent) AS agentCount
                FROM Daily_Activity da
                JOIN activeusers au ON da.agent = au.lagnname
                WHERE au.rept_name = 'LOCKER-ROTOLO'
                  AND au.Active = 'y'
            `;
            
            let lockerRotoloParams = [];
            if (startDate && endDate) {
                lockerRotoloQuery += ` AND da.reportDate >= ? AND da.reportDate <= ?`;
                lockerRotoloParams = [startDate, endDate];
            }
            
            const lockerRotoloResults = await dbQuery(lockerRotoloQuery, lockerRotoloParams);
            const lockerRotoloResult = lockerRotoloResults[0] || {};
            
            // Add LOCKER-ROTOLO results to the main results
            responseData.totalAlp += parseFloat(lockerRotoloResult.totalAlp) || 0;
            responseData.totalRefAlp += parseFloat(lockerRotoloResult.totalRefAlp) || 0;
            responseData.totalRefs += parseInt(lockerRotoloResult.totalRefs) || 0;
            responseData.agentCount += parseInt(lockerRotoloResult.agentCount) || 0;
        }
        
        console.log('📊 [SA Team Daily Activity] Response:', {
            lagnName,
            responseData,
            rawResult: result,
            explanation: 'Combined ALP from user as agent + user as SA'
        });
        
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ [SA Team Daily Activity] Error:', error);
        res.status(500).json({ 
            error: "Failed to fetch SA team daily activity data",
            details: error.message 
        });
    }
});

// GET /api/alp/ga/team-daily-activity - Get Daily_Activity data for GA team mode (agent's own ALP + all agents where SA = agent OR GA = agent)
router.get("/ga/team-daily-activity", async (req, res) => {
    try {
        const { lagnName, startDate, endDate } = req.query;
        
        if (!lagnName) {
            return res.status(400).json({ error: "lagnName parameter is required" });
        }
        
        const { query: dbQuery } = require('../db');
        
        console.log('📊 [GA Team Daily Activity] Request params:', {
            lagnName,
            startDate,
            endDate,
            timestamp: new Date().toISOString()
        });
        
        // Build the query to get:
        // 1. This agent's own Daily_Activity.alp where agent = lagnName
        // 2. All Daily_Activity.alp where SA = lagnName (GA supervises SAs)
        // 3. All Daily_Activity.alp where GA = lagnName (GA supervises agents directly)
        let query = `
            SELECT 
                SUM(alp) AS totalAlp,
                SUM(refAlp) AS totalRefAlp, 
                SUM(refs) AS totalRefs,
                COUNT(DISTINCT agent) AS agentCount
            FROM Daily_Activity 
            WHERE (agent = ? OR SA = ? OR GA = ?)
        `;
        
        let params = [lagnName, lagnName, lagnName];
        
        // Add date filtering if provided
        if (startDate && endDate) {
            query += ` AND reportDate >= ? AND reportDate <= ?`;
            params.push(startDate, endDate);
        }
        
        console.log('📊 [GA Team Daily Activity] Query:', {
            query: query.replace(/\s+/g, ' ').trim(),
            params,
            description: 'Summing ALP where user is agent OR where user is SA OR where user is GA'
        });
        
        const results = await dbQuery(query, params);
        const result = results[0] || {};
        
        let responseData = {
            totalAlp: parseFloat(result.totalAlp) || 0,
            totalRefAlp: parseFloat(result.totalRefAlp) || 0,
            totalRefs: parseInt(result.totalRefs) || 0,
            agentCount: parseInt(result.agentCount) || 0
        };
        
        // Special case: For MAUGHANEVANSON BRODY W, also include all LOCKER-ROTOLO users
        if (lagnName === 'MAUGHANEVANSON BRODY W') {
            let lockerRotoloQuery = `
                SELECT 
                    SUM(da.alp) AS totalAlp,
                    SUM(da.refAlp) AS totalRefAlp, 
                    SUM(da.refs) AS totalRefs,
                    COUNT(DISTINCT da.agent) AS agentCount
                FROM Daily_Activity da
                JOIN activeusers au ON da.agent = au.lagnname
                WHERE au.rept_name = 'LOCKER-ROTOLO'
                  AND au.Active = 'y'
            `;
            
            let lockerRotoloParams = [];
            if (startDate && endDate) {
                lockerRotoloQuery += ` AND da.reportDate >= ? AND da.reportDate <= ?`;
                lockerRotoloParams = [startDate, endDate];
            }
            
            const lockerRotoloResults = await dbQuery(lockerRotoloQuery, lockerRotoloParams);
            const lockerRotoloResult = lockerRotoloResults[0] || {};
            
            // Add LOCKER-ROTOLO results to the main results
            responseData.totalAlp += parseFloat(lockerRotoloResult.totalAlp) || 0;
            responseData.totalRefAlp += parseFloat(lockerRotoloResult.totalRefAlp) || 0;
            responseData.totalRefs += parseInt(lockerRotoloResult.totalRefs) || 0;
            responseData.agentCount += parseInt(lockerRotoloResult.agentCount) || 0;
        }
        
        console.log('📊 [GA Team Daily Activity] Response:', {
            lagnName,
            responseData,
            rawResult: result,
            explanation: 'Combined ALP from user as agent + user as SA + user as GA'
        });
        
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ [GA Team Daily Activity] Error:', error);
        res.status(500).json({ 
            error: "Failed to fetch GA team daily activity data",
            details: error.message 
        });
    }
});

// GET /api/alp/ga/monthly-alp - Get Monthly_ALP data for GA users with LVL_3_NET for team mode, LVL_1_NET for personal mode
router.get("/ga/monthly-alp", async (req, res) => {
    try {
        const { lagnName, viewMode } = req.query;
        
        if (!lagnName) {
            return res.status(400).json({ error: "lagnName parameter is required" });
        }
        
        const { query: dbQuery } = require('../db');
        
        // Calculate previous month in mm/yyyy format
        const now = new Date();
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const monthStr = `${String(prevMonth.getMonth() + 1).padStart(2, '0')}/${prevMonth.getFullYear()}`;
        
        console.log('📊 [GA Monthly ALP] Request params:', {
            lagnName,
            viewMode,
            targetMonth: monthStr,
            timestamp: new Date().toISOString()
        });
        
        // Determine which ALP column to use based on viewMode
        // GA team mode uses LVL_3_NET, personal mode uses LVL_1_NET
        const alpColumn = (viewMode === 'team') ? 'LVL_3_NET' : 'LVL_1_NET';
        
        console.log('📊 [GA Monthly ALP] Using ALP column:', {
            viewMode,
            alpColumn,
            explanation: viewMode === 'team' ? 'GA Team mode uses LVL_3_NET' : 'Personal mode uses LVL_1_NET'
        });
        
        // Query Monthly_ALP table for the specific user and month
        const query = `
            SELECT 
                ${alpColumn} as monthlyAlp,
                month,
                LagnName
            FROM Monthly_ALP 
            WHERE LagnName = ? AND month = ?
        `;
        
        const params = [lagnName, monthStr];
        
        console.log('📊 [GA Monthly ALP] Query:', {
            query: query.replace(/\s+/g, ' ').trim(),
            params,
            description: `Getting ${alpColumn} from Monthly_ALP for ${lagnName} in ${monthStr}`
        });
        
        const results = await dbQuery(query, params);
        const result = results[0] || {};
        
        // Format the response to match the expected structure from mga/monthly-alp
        // Frontend expects { success: true, data: [array of monthly records] }
        // The calculateGaAlpMetrics function expects LVL_3_NET (with fallback to LVL_2_NET)
        // So we put team mode values in LVL_3_NET and personal mode values in LVL_2_NET
        const alpValue = parseFloat(result.monthlyAlp) || 0;
        const monthlyRecord = {
            month: result.month || monthStr,
            LagnName: result.LagnName || lagnName,
            CL_Name: 'GA',
            // Put values in appropriate columns based on viewMode for frontend calculation compatibility
            LVL_3_NET: (viewMode === 'team') ? alpValue : 0,
            LVL_2_NET: (viewMode === 'personal') ? alpValue : 0,
            LVL_1_NET: 0, // Not used for GA calculations
            // Debugging fields
            alpColumn: alpColumn,
            viewMode: viewMode,
            originalValue: alpValue
        };
        
        const responseData = {
            success: true,
            data: [monthlyRecord] // Wrap in array like mga/monthly-alp does
        };
        
        console.log('📊 [GA Monthly ALP] Response:', {
            lagnName,
            targetMonth: monthStr,
            viewMode,
            alpColumn,
            monthlyRecord,
            rawResult: result,
            explanation: `Monthly ALP from Monthly_ALP.${alpColumn} for previous month, formatted for frontend compatibility`
        });
        
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ [GA Monthly ALP] Error:', error);
        res.status(500).json({ 
            error: "Failed to fetch GA monthly ALP data",
            details: error.message 
        });
    }
});

// GET /api/alp/mga/team-daily-activity - Get Daily_Activity data for MGA team mode (agent's own ALP + all agents where GA/SA = agent)
router.get("/mga/team-daily-activity", async (req, res) => {
    try {
        const { lagnName, startDate, endDate } = req.query;
        
        if (!lagnName) {
            return res.status(400).json({ error: "lagnName parameter is required" });
        }
        
        const { query: dbQuery } = require('../db');
        
        console.log('📊 [MGA Team Daily Activity] Request params:', {
            lagnName,
            startDate,
            endDate,
            timestamp: new Date().toISOString()
        });
        
        // Build the query to get:
        // 1. This agent's own Daily_Activity.alp where agent = lagnName
        // 2. All Daily_Activity.alp where SA = lagnName (MGA supervises SAs)
        // 3. All Daily_Activity.alp where GA = lagnName (MGA supervises GAs)
        // 4. All Daily_Activity.alp where MGA = lagnName (MGA supervises agents directly)
        let query = `
            SELECT 
                SUM(alp) AS totalAlp,
                SUM(refAlp) AS totalRefAlp, 
                SUM(refs) AS totalRefs,
                COUNT(DISTINCT agent) AS agentCount
            FROM Daily_Activity 
            WHERE (agent = ? OR SA = ? OR GA = ? OR MGA = ?)
        `;
        
        let params = [lagnName, lagnName, lagnName, lagnName];
        
        // Add date filtering if provided
        if (startDate && endDate) {
            query += ` AND reportDate >= ? AND reportDate <= ?`;
            params.push(startDate, endDate);
        }
        
        console.log('📊 [MGA Team Daily Activity] Query:', {
            query: query.replace(/\s+/g, ' ').trim(),
            params,
            description: 'Summing ALP where user is agent OR where user is SA OR where user is GA OR where user is MGA'
        });
        
        const results = await dbQuery(query, params);
        const result = results[0] || {};
        
        let responseData = {
            totalAlp: parseFloat(result.totalAlp) || 0,
            totalRefAlp: parseFloat(result.totalRefAlp) || 0,
            totalRefs: parseInt(result.totalRefs) || 0,
            agentCount: parseInt(result.agentCount) || 0
        };
        
        // Special case: For MAUGHANEVANSON BRODY W, also include all LOCKER-ROTOLO users
        if (lagnName === 'MAUGHANEVANSON BRODY W') {
            let lockerRotoloQuery = `
                SELECT 
                    SUM(da.alp) AS totalAlp,
                    SUM(da.refAlp) AS totalRefAlp, 
                    SUM(da.refs) AS totalRefs,
                    COUNT(DISTINCT da.agent) AS agentCount
                FROM Daily_Activity da
                JOIN activeusers au ON da.agent = au.lagnname
                WHERE au.rept_name = 'LOCKER-ROTOLO'
                  AND au.Active = 'y'
            `;
            
            let lockerRotoloParams = [];
            if (startDate && endDate) {
                lockerRotoloQuery += ` AND da.reportDate >= ? AND da.reportDate <= ?`;
                lockerRotoloParams = [startDate, endDate];
            }
            
            const lockerRotoloResults = await dbQuery(lockerRotoloQuery, lockerRotoloParams);
            const lockerRotoloResult = lockerRotoloResults[0] || {};
            
            // Add LOCKER-ROTOLO results to the main results
            responseData.totalAlp += parseFloat(lockerRotoloResult.totalAlp) || 0;
            responseData.totalRefAlp += parseFloat(lockerRotoloResult.totalRefAlp) || 0;
            responseData.totalRefs += parseInt(lockerRotoloResult.totalRefs) || 0;
            responseData.agentCount += parseInt(lockerRotoloResult.agentCount) || 0;
        }
        
        console.log('📊 [MGA Team Daily Activity] Response:', {
            lagnName,
            responseData,
            rawResult: result,
            explanation: 'Combined ALP from user as agent + user as SA + user as GA + user as MGA'
        });
        
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ [MGA Team Daily Activity] Error:', error);
        res.status(500).json({ 
            error: "Failed to fetch MGA team daily activity data",
            details: error.message 
        });
    }
});

// GET /api/alp/rga/team-daily-activity - Get Daily_Activity data for RGA team mode (agent's own ALP + all agents in hierarchy)
router.get("/rga/team-daily-activity", async (req, res) => {
    try {
        const { lagnName, startDate, endDate, viewMode } = req.query;
        
        if (!lagnName) {
            return res.status(400).json({ error: "lagnName parameter is required" });
        }
        
        const { query: dbQuery } = require('../db');
        
        console.log('📊 [RGA Team Daily Activity] Request params:', {
            lagnName,
            startDate,
            endDate,
            viewMode,
            timestamp: new Date().toISOString()
        });
        
        // Build the query based on viewMode:
        // - viewMode='mga': Get MGA-level data (WHERE MGA = lagnName OR agent = lagnName)
        // - viewMode='rga': Get RGA-level data (WHERE RGA = lagnName OR agent = lagnName)
        // - viewMode='team' or undefined: Get all levels (legacy behavior)
        let whereClause;
        let params;
        
        if (viewMode === 'mga') {
            // MGA tab: Only MGA-level data
            whereClause = '(agent = ? OR MGA = ?)';
            params = [lagnName, lagnName];
        } else if (viewMode === 'rga') {
            // RGA tab: Only RGA-level data (includes first-year MGA rollups)
            whereClause = '(agent = ? OR RGA = ?)';
            params = [lagnName, lagnName];
        } else {
            // Legacy: All levels (for backward compatibility)
            whereClause = '(agent = ? OR SA = ? OR GA = ? OR MGA = ? OR RGA = ?)';
            params = [lagnName, lagnName, lagnName, lagnName, lagnName];
        }
        
        let query = `
            SELECT 
                SUM(alp) AS totalAlp,
                SUM(refAlp) AS totalRefAlp, 
                SUM(refs) AS totalRefs,
                COUNT(DISTINCT agent) AS agentCount
            FROM Daily_Activity 
            WHERE ${whereClause}
        `;
        
        // Add date filtering if provided
        if (startDate && endDate) {
            query += ` AND reportDate >= ? AND reportDate <= ?`;
            params.push(startDate, endDate);
        }
        
        console.log('📊 [RGA Team Daily Activity] Query:', {
            query: query.replace(/\s+/g, ' ').trim(),
            params,
            viewMode,
            description: viewMode === 'mga' ? 'MGA-level data (agent + MGA)' : 
                        viewMode === 'rga' ? 'RGA-level data (agent + RGA)' :
                        'All levels (agent + SA + GA + MGA + RGA)'
        });
        
        const results = await dbQuery(query, params);
        const result = results[0] || {};
        
        let responseData = {
            totalAlp: parseFloat(result.totalAlp) || 0,
            totalRefAlp: parseFloat(result.totalRefAlp) || 0,
            totalRefs: parseInt(result.totalRefs) || 0,
            agentCount: parseInt(result.agentCount) || 0
        };
        
        // Special case: For MAUGHANEVANSON BRODY W, also include all LOCKER-ROTOLO users
        if (lagnName === 'MAUGHANEVANSON BRODY W') {
            let lockerRotoloQuery = `
                SELECT 
                    SUM(da.alp) AS totalAlp,
                    SUM(da.refAlp) AS totalRefAlp, 
                    SUM(da.refs) AS totalRefs,
                    COUNT(DISTINCT da.agent) AS agentCount
                FROM Daily_Activity da
                JOIN activeusers au ON da.agent = au.lagnname
                WHERE au.rept_name = 'LOCKER-ROTOLO'
                  AND au.Active = 'y'
            `;
            
            let lockerRotoloParams = [];
            if (startDate && endDate) {
                lockerRotoloQuery += ` AND da.reportDate >= ? AND da.reportDate <= ?`;
                lockerRotoloParams = [startDate, endDate];
            }
            
            const lockerRotoloResults = await dbQuery(lockerRotoloQuery, lockerRotoloParams);
            const lockerRotoloResult = lockerRotoloResults[0] || {};
            
            // Add LOCKER-ROTOLO results to the main results
            responseData.totalAlp += parseFloat(lockerRotoloResult.totalAlp) || 0;
            responseData.totalRefAlp += parseFloat(lockerRotoloResult.totalRefAlp) || 0;
            responseData.totalRefs += parseInt(lockerRotoloResult.totalRefs) || 0;
            // Note: agentCount might have duplicates, but that's okay for this use case
            responseData.agentCount += parseInt(lockerRotoloResult.agentCount) || 0;
        }
        
        console.log('📊 [RGA Team Daily Activity] Response:', {
            lagnName,
            viewMode,
            responseData,
            rawResult: result,
            explanation: viewMode === 'mga' ? 'MGA-level: agent + MGA hierarchy' :
                        viewMode === 'rga' ? 'RGA-level: agent + RGA hierarchy' :
                        'All levels: agent + SA + GA + MGA + RGA'
        });
        
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ [RGA Team Daily Activity] Error:', error);
        res.status(500).json({ 
            error: "Failed to fetch RGA team daily activity data",
            details: error.message 
        });
    }
});

// GET /api/alp/mga/daily-activity - Get Daily_Activity data filtered by MGA or agent
router.get("/mga/daily-activity", async (req, res) => {
    try {
        const { lagnName, startDate, endDate } = req.query;
        
        if (!lagnName) {
            return res.status(400).json({ error: "lagnName parameter is required" });
        }
        
        let query = `
            SELECT SUM(refAlp) AS totalRefAlp, SUM(alp) AS totalAlp, SUM(refs) AS totalRefs, COUNT(DISTINCT agent) AS agentCount
            FROM Daily_Activity 
            WHERE (MGA = ? OR agent = ?)
        `;
        
        let params = [lagnName, lagnName];
        
        if (startDate && endDate) {
            query += ` AND reportDate BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        } else if (startDate) {
            query += ` AND reportDate = ?`;
            params.push(startDate);
        }
        
        const { query: dbQuery } = require('../db');
        const results = await dbQuery(query, params);
        
        res.json(results[0] || { totalRefAlp: 0, totalAlp: 0, totalRefs: 0, agentCount: 0 });
        
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching MGA Daily_Activity data',
            error: error.message,
        });
    }
});

// GET /api/alp/weekly-alp-sum - Get Weekly_ALP data summed for SGA dashboard
router.get('/weekly-alp-sum', async (req, res) => {
    try {
        const { query: dbQuery } = require('../db');
        
        // Get max reportdate in current month for Weekly Recap
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        console.log('📊 [Weekly ALP Sum] Current date info:', {
            now: currentDate.toISOString(),
            currentYear,
            currentMonth,
            currentMonthName: currentDate.toLocaleString('default', { month: 'long' })
        });
        
        // First, let's see what REPORT values exist in current month (reportdate is mm/dd/yyyy format)
        const reportTypesQuery = `
            SELECT DISTINCT REPORT, COUNT(*) as count
            FROM Weekly_ALP 
            WHERE STR_TO_DATE(reportdate, '%m/%d/%Y') IS NOT NULL
            AND YEAR(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            AND MONTH(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            GROUP BY REPORT
        `;
        
        const reportTypesResult = await dbQuery(reportTypesQuery, [currentYear, currentMonth]);
        console.log('📊 [Weekly ALP Sum] Available REPORT types for current month:', reportTypesResult);
        
        // Let's also see all records for current month (reportdate is mm/dd/yyyy format)
        const currentMonthQuery = `
            SELECT reportdate, REPORT, LagnName, LVL_1_NET
            FROM Weekly_ALP 
            WHERE STR_TO_DATE(reportdate, '%m/%d/%Y') IS NOT NULL
            AND YEAR(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            AND MONTH(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
            LIMIT 10
        `;
        
        const currentMonthResult = await dbQuery(currentMonthQuery, [currentYear, currentMonth]);
        console.log('📊 [Weekly ALP Sum] Recent records for current month:', currentMonthResult);
        
        // Get the latest Weekly Recap reportdate from this month (reportdate is mm/dd/yyyy format)
        const maxDateQuery = `
            SELECT reportdate as maxDate
            FROM Weekly_ALP 
            WHERE REPORT = 'Weekly Recap'
            AND STR_TO_DATE(reportdate, '%m/%d/%Y') IS NOT NULL
            AND YEAR(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            AND MONTH(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
            LIMIT 1
        `;
        
        const maxDateResult = await dbQuery(maxDateQuery, [currentYear, currentMonth]);
        console.log('📊 [Weekly ALP Sum] Max date query result:', { 
            maxDateResult, 
            query: maxDateQuery, 
            params: [currentYear, currentMonth] 
        });
        const maxReportDate = maxDateResult[0]?.maxDate;
        
        if (!maxReportDate) {
            console.log('📊 [Weekly ALP Sum] No max report date found for current month');
            return res.json({ weeklyAlp: 0, comparisonAlp: 0 });
        }
        
        // Calculate the week range (previous Thursday to current Wednesday)
        // maxReportDate is in mm/dd/yyyy format, convert to Date object
        const [month, day, year] = maxReportDate.split('/').map(num => parseInt(num, 10));
        const reportDate = new Date(year, month - 1, day); // month is 0-based in Date constructor
        const dayOfWeek = reportDate.getDay(); // 0=Sunday, 3=Wednesday, 5=Friday
        
        console.log('📊 [Weekly ALP Sum] Date calculations:', {
            maxReportDate,
            parsedDate: `${month}/${day}/${year}`,
            reportDate: reportDate.toISOString().split('T')[0],
            dayOfWeek,
            dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]
        });
        
        // Calculate the Thursday that starts this week
        let weekStart = new Date(reportDate);
        if (dayOfWeek === 3) { // Wednesday
            weekStart.setDate(reportDate.getDate() - 6); // Go back 6 days to previous Thursday
        } else if (dayOfWeek === 5) { // Friday  
            weekStart.setDate(reportDate.getDate() - 8); // Go back 8 days to previous Thursday
        }
        
        // Calculate the Wednesday that ends this week
        let weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // Thursday + 6 days = Wednesday
        
        console.log('📊 [Weekly ALP Sum] Calculated week range:', {
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
            weekSpan: `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`
        });
        
        // Look back 3 days from max date to capture both Wednesday and Friday from same week
        const lookbackDate = new Date(reportDate);
        lookbackDate.setDate(reportDate.getDate() - 3);
        
        console.log('📊 [Weekly ALP Sum] Lookback range:', {
            maxReportDate,
            lookbackDate: lookbackDate.toISOString().split('T')[0],
            lookbackRange: `${lookbackDate.toISOString().split('T')[0]} to ${reportDate.toISOString().split('T')[0]}`
        });
        
        // Get Weekly_ALP data for this week (both Wednesday=Arias main and Friday=NY ALP)
        const weeklyAlpQuery = `
            SELECT 
                reportdate,
                SUM(LVL_1_NET) as totalWeeklyAlp,
                COUNT(*) as recordCount
            FROM Weekly_ALP 
            WHERE REPORT = 'Weekly Recap'
            AND STR_TO_DATE(reportdate, '%m/%d/%Y') >= ?
            AND STR_TO_DATE(reportdate, '%m/%d/%Y') <= ?
            GROUP BY reportdate
            ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') ASC
        `;
        
        const weeklyAlpResults = await dbQuery(weeklyAlpQuery, [lookbackDate, reportDate]);
        
        console.log('📊 [Weekly ALP Sum] Weekly ALP breakdown by date:', weeklyAlpResults);
        
        // Separate Wednesday (Arias main) and Friday (NY) data
        let ariasMainAlp = 0;
        let nyAlp = 0;
        let totalWeeklyAlp = 0;
        
        weeklyAlpResults.forEach(result => {
            const [month, day, year] = result.reportdate.split('/').map(num => parseInt(num, 10));
            const dateObj = new Date(year, month - 1, day);
            const dayOfWeek = dateObj.getDay();
            
            const alpValue = parseFloat(result.totalWeeklyAlp) || 0;
            totalWeeklyAlp += alpValue;
            
            if (dayOfWeek === 3) { // Wednesday = Arias main
                ariasMainAlp += alpValue;
            } else if (dayOfWeek === 5) { // Friday = NY ALP
                nyAlp += alpValue;
            }
        });
        
        console.log('📊 [Weekly ALP Sum] ALP breakdown:', {
            ariasMainAlp,
            nyAlp,
            totalWeeklyAlp,
            recordsFound: weeklyAlpResults.length
        });
        
        const weeklyAlp = totalWeeklyAlp;
        
        // Get Daily_Activity data for comparison (same week range)
        const dailyActivityQuery = `
            SELECT SUM(alp) as totalDailyAlp
            FROM Daily_Activity 
            WHERE reportDate >= ?
            AND reportDate <= ?
        `;
        
        const dailyActivityResult = await dbQuery(dailyActivityQuery, [weekStart, weekEnd]);
        const comparisonAlp = dailyActivityResult[0]?.totalDailyAlp || 0;
        
        const response = {
            success: true,
            weeklyAlp: parseFloat(weeklyAlp) || 0,
            comparisonAlp: parseFloat(comparisonAlp) || 0,
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
            maxReportDate: maxReportDate,
            // Separate ALP breakdown
            ariasMainAlp: parseFloat(ariasMainAlp) || 0,
            nyAlp: parseFloat(nyAlp) || 0,
            breakdown: {
                ariasMain: parseFloat(ariasMainAlp) || 0,
                newYork: parseFloat(nyAlp) || 0,
                total: parseFloat(totalWeeklyAlp) || 0
            }
        };
        
        console.log('📊 [Weekly ALP Sum] Response data:', {
            weeklyAlp: response.weeklyAlp,
            comparisonAlp: response.comparisonAlp,
            weekRange: `${response.weekStart} to ${response.weekEnd}`,
            maxReportDate: response.maxReportDate,
            breakdown: response.breakdown,
            weeklyAlpResults: weeklyAlpResults,
            rawDailyActivityResult: dailyActivityResult[0],
            note: 'Using LVL_1_NET column from Weekly_ALP table, handling Wed+Fri dates'
        });
        
        res.json(response);
        
    } catch (error) {
        console.error('Error fetching weekly ALP sum:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching weekly ALP data',
            error: error.message,
        });
    }
});

// GET /api/alp/mga/weekly-alp - Get Weekly_ALP data for MGA/RGA/SA/GA/AGT roles
router.get('/mga/weekly-alp', async (req, res) => {
    try {
        const { lagnName, viewMode } = req.query;
        
        if (!lagnName) {
            return res.status(400).json({ error: "lagnName parameter is required" });
        }
        
        const { query: dbQuery } = require('../db');
        
        // Get max reportdate in current month for Weekly Recap
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        // Get the latest Weekly Recap reportdate from this month (reportdate is mm/dd/yyyy format)
        const maxDateQuery = `
            SELECT reportdate as maxDate
            FROM Weekly_ALP 
            WHERE REPORT = 'Weekly Recap'
            AND STR_TO_DATE(reportdate, '%m/%d/%Y') IS NOT NULL
            AND YEAR(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            AND MONTH(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
            LIMIT 1
        `;
        
        const maxDateResult = await dbQuery(maxDateQuery, [currentYear, currentMonth]);
        const maxReportDate = maxDateResult[0]?.maxDate;
        
        if (!maxReportDate) {
            return res.json({ weeklyAlp: 0, comparisonAlp: 0 });
        }
        
        // Calculate the week range (previous Thursday to current Wednesday)
        // maxReportDate is in mm/dd/yyyy format, convert to Date object
        const [month, day, year] = maxReportDate.split('/').map(num => parseInt(num, 10));
        const reportDate = new Date(year, month - 1, day); // month is 0-based in Date constructor
        const dayOfWeek = reportDate.getDay();
        
        let weekStart = new Date(reportDate);
        if (dayOfWeek === 3) { // Wednesday
            weekStart.setDate(reportDate.getDate() - 6);
        } else if (dayOfWeek === 5) { // Friday  
            weekStart.setDate(reportDate.getDate() - 8);
        }
        
        let weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        // Look back 3 days from max date to capture both Wednesday and Friday from same week
        const lookbackDate = new Date(reportDate);
        lookbackDate.setDate(reportDate.getDate() - 3);
        
        // Get Weekly_ALP data for this user and week (both Wednesday=Arias main and Friday=NY ALP)
        // Use different ALP columns based on user role and view mode
        let alpColumn;
        let clNameCondition = '';
        
        if (viewMode === 'team' || viewMode === 'mga' || viewMode === 'rga') {
          // Determine user role from request or user context
          const userRole = req.headers['user-role'] || 'SA'; // Default to SA for backward compatibility
          if (userRole === 'GA' || userRole === 'MGA' || userRole === 'RGA') {
            alpColumn = 'LVL_3_NET'; // GA, MGA, RGA use LVL_3_NET for team mode
            
            // For RGA users, apply CL_Name filtering based on viewMode
            if (userRole === 'RGA') {
              if (viewMode === 'mga') {
                clNameCondition = "AND CL_Name = 'MGA'"; // MGA tab: show only MGA-level data
              } else if (viewMode === 'rga') {
                clNameCondition = "AND CL_Name != 'MGA'"; // RGA tab: show non-MGA data (RGA level + first-year rollups)
              }
            }
          } else {
            alpColumn = 'LVL_2_NET'; // SA uses LVL_2_NET for team mode
          }
        } else {
          alpColumn = 'LVL_1_NET'; // All roles use LVL_1_NET for personal mode
        }
        const weeklyAlpQuery = `
            SELECT 
                reportdate,
                SUM(${alpColumn}) as totalWeeklyAlp,
                COUNT(*) as recordCount
            FROM Weekly_ALP 
            WHERE REPORT = 'Weekly Recap'
            AND LagnName = ?
            ${clNameCondition}
            AND STR_TO_DATE(reportdate, '%m/%d/%Y') >= ?
            AND STR_TO_DATE(reportdate, '%m/%d/%Y') <= ?
            GROUP BY reportdate
            ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') ASC
        `;
        
        console.log(`📊 [Backend] Weekly ALP query for ${lagnName}:`, {
            lagnName,
            viewMode,
            alpColumn,
            query: weeklyAlpQuery.replace(/\s+/g, ' ').trim()
        });
        
        const weeklyAlpResults = await dbQuery(weeklyAlpQuery, [lagnName, lookbackDate, reportDate]);
        
        // Separate Wednesday (Arias main) and Friday (NY) data for this user
        let ariasMainAlp = 0;
        let nyAlp = 0;
        let totalWeeklyAlp = 0;
        
        weeklyAlpResults.forEach(result => {
            const [month, day, year] = result.reportdate.split('/').map(num => parseInt(num, 10));
            const dateObj = new Date(year, month - 1, day);
            const dayOfWeek = dateObj.getDay();
            
            const alpValue = parseFloat(result.totalWeeklyAlp) || 0;
            totalWeeklyAlp += alpValue;
            
            if (dayOfWeek === 3) { // Wednesday = Arias main
                ariasMainAlp += alpValue;
            } else if (dayOfWeek === 5) { // Friday = NY ALP
                nyAlp += alpValue;
            }
        });
        
        const weeklyAlp = totalWeeklyAlp;
        
        // Get Daily_Activity data for comparison (same user and week)
        const dailyActivityQuery = `
            SELECT SUM(alp) as totalDailyAlp
            FROM Daily_Activity 
            WHERE agent = ?
            AND reportDate >= ?
            AND reportDate <= ?
        `;
        
        const dailyActivityResult = await dbQuery(dailyActivityQuery, [lagnName, weekStart, weekEnd]);
        const comparisonAlp = dailyActivityResult[0]?.totalDailyAlp || 0;
        
        const response = {
            success: true,
            weeklyAlp: parseFloat(weeklyAlp) || 0,
            comparisonAlp: parseFloat(comparisonAlp) || 0,
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
            maxReportDate: maxReportDate,
            // Separate ALP breakdown for this user
            ariasMainAlp: parseFloat(ariasMainAlp) || 0,
            nyAlp: parseFloat(nyAlp) || 0,
            breakdown: {
                ariasMain: parseFloat(ariasMainAlp) || 0,
                newYork: parseFloat(nyAlp) || 0,
                total: parseFloat(totalWeeklyAlp) || 0
            }
        };
        
        console.log(`📊 [MGA Weekly ALP] Response data for ${lagnName}:`, {
            weeklyAlp: response.weeklyAlp,
            comparisonAlp: response.comparisonAlp,
            weekRange: `${response.weekStart} to ${response.weekEnd}`,
            maxReportDate: response.maxReportDate,
            breakdown: response.breakdown,
            weeklyAlpResults: weeklyAlpResults,
            rawDailyActivityResult: dailyActivityResult[0],
            note: 'Using LVL_1_NET column from Weekly_ALP table, handling Wed+Fri dates'
        });
        
        res.json(response);
        
    } catch (error) {
        console.error('Error fetching MGA weekly ALP:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching MGA weekly ALP data',
            error: error.message,
        });
    }
});

// GET /api/alp/weekly-hires-sum - Get weekly hires from amore_data for SGA dashboard
router.get('/weekly-hires-sum', async (req, res) => {
    try {
        const { query: dbQuery } = require('../db');
        
        // Get max MORE_Date from amore_data
        const maxDateQuery = `
            SELECT MAX(MORE_Date) as maxDate
            FROM amore_data
        `;
        
        const maxDateResult = await dbQuery(maxDateQuery);
        const maxDate = maxDateResult[0]?.maxDate;
        
        console.log('📊 [Weekly Hires Sum] Max MORE_Date found:', { maxDate });
        
        if (!maxDate) {
            console.log('📊 [Weekly Hires Sum] No max date found in amore_data');
            return res.json({ weeklyHires: 0 });
        }
        
        // Get Total_Hires for the max date (this represents the week's hires)
        const hiresQuery = `
            SELECT SUM(Total_Hires) as totalHires
            FROM amore_data 
            WHERE MORE_Date = ?
        `;
        
        const hiresResult = await dbQuery(hiresQuery, [maxDate]);
        const weeklyHires = hiresResult[0]?.totalHires || 0;
        
        console.log('📊 [Weekly Hires Sum] Response data:', {
            weeklyHires: weeklyHires,
            maxDate: maxDate,
            rawResult: hiresResult[0]
        });
        
        res.json({
            success: true,
            weeklyHires: parseInt(weeklyHires) || 0,
            maxDate: maxDate
        });
        
    } catch (error) {
        console.error('Error fetching weekly hires sum:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// GET /api/alp/weekly-codes-sum - Get weekly codes from associates.PRODDATE for SGA dashboard
router.get('/weekly-codes-sum', async (req, res) => {
    try {
        const { query: dbQuery } = require('../db');
        
        // Get max reportdate from Weekly_ALP (same as Weekly ALP endpoint)
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        const maxDateQuery = `
            SELECT reportdate as maxDate
            FROM Weekly_ALP 
            WHERE REPORT = 'Weekly Recap'
            AND STR_TO_DATE(reportdate, '%m/%d/%Y') IS NOT NULL
            AND YEAR(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            AND MONTH(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
            LIMIT 1
        `;
        
        const maxDateResult = await dbQuery(maxDateQuery, [currentYear, currentMonth]);
        const maxReportDate = maxDateResult[0]?.maxDate;
        
        if (!maxReportDate) {
            console.log('📊 [Weekly Codes Sum] No max report date found in Weekly_ALP');
            return res.json({ weeklyCodes: 0 });
        }
        
        // Parse mm/dd/yyyy format and calculate week range (same logic as Weekly ALP)
        const [month, day, year] = maxReportDate.split('/').map(num => parseInt(num, 10));
        const reportDate = new Date(year, month - 1, day);
        const dayOfWeek = reportDate.getDay();
        
        // Calculate the Thursday that starts this week
        let weekStart = new Date(reportDate);
        if (dayOfWeek === 3) { // Wednesday
            weekStart.setDate(reportDate.getDate() - 6); // Go back 6 days to previous Thursday
        } else if (dayOfWeek === 5) { // Friday  
            weekStart.setDate(reportDate.getDate() - 8); // Go back 8 days to previous Thursday
        } else {
            // For other days, find the most recent Thursday
            const daysToSubtract = (dayOfWeek + 7 - 4) % 7; // 4 = Thursday
            weekStart.setDate(reportDate.getDate() - daysToSubtract);
        }
        
        // Calculate the Wednesday that ends this week
        let weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // Thursday + 6 days = Wednesday
        
        console.log('📊 [Weekly Codes Sum] Week range calculated from Weekly_ALP:', {
            maxReportDate: maxReportDate,
            parsedDate: `${month}/${day}/${year}`,
            reportDate: reportDate.toISOString().split('T')[0],
            dayOfWeek,
            dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0]
        });
        
        // Get codes count from associates table where PRODDATE falls within the week
        const codesQuery = `
            SELECT COUNT(*) as totalCodes
            FROM associates 
            WHERE PRODDATE >= ?
            AND PRODDATE <= ?
            AND LagnName IS NOT NULL
            AND LagnName != ''
        `;
        
        const codesResult = await dbQuery(codesQuery, [weekStart, weekEnd]);
        const weeklyCodes = codesResult[0]?.totalCodes || 0;
        
        console.log('📊 [Weekly Codes Sum] Response data:', {
            weeklyCodes: weeklyCodes,
            weekRange: `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`,
            maxReportDate: maxReportDate,
            rawResult: codesResult[0]
        });
        
        res.json({
            success: true,
            weeklyCodes: parseInt(weeklyCodes) || 0,
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
            maxReportDate: maxReportDate
        });
        
    } catch (error) {
        console.error('Error fetching weekly codes sum:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// GET /api/alp/weekly-ref-sales-sum - Get weekly ref sales using same week range as ALP for SGA dashboard
router.get('/weekly-ref-sales-sum', async (req, res) => {
    try {
        const { query: dbQuery } = require('../db');
        
        // Get max reportdate from Weekly_ALP (same as Weekly ALP endpoint)
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        const maxDateQuery = `
            SELECT reportdate as maxDate
            FROM Weekly_ALP 
            WHERE REPORT = 'Weekly Recap'
            AND STR_TO_DATE(reportdate, '%m/%d/%Y') IS NOT NULL
            AND YEAR(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            AND MONTH(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
            LIMIT 1
        `;
        
        const maxDateResult = await dbQuery(maxDateQuery, [currentYear, currentMonth]);
        const maxReportDate = maxDateResult[0]?.maxDate;
        
        if (!maxReportDate) {
            console.log('📊 [Weekly Ref Sales Sum] No max report date found in Weekly_ALP');
            return res.json({ weeklyRefSales: 0 });
        }
        
        // Parse mm/dd/yyyy format and calculate week range (same logic as Weekly ALP)
        const [month, day, year] = maxReportDate.split('/').map(num => parseInt(num, 10));
        const reportDate = new Date(year, month - 1, day);
        const dayOfWeek = reportDate.getDay();
        
        // Calculate the Thursday that starts this week
        let weekStart = new Date(reportDate);
        if (dayOfWeek === 3) { // Wednesday
            weekStart.setDate(reportDate.getDate() - 6); // Go back 6 days to previous Thursday
        } else if (dayOfWeek === 5) { // Friday  
            weekStart.setDate(reportDate.getDate() - 8); // Go back 8 days to previous Thursday
        } else {
            // For other days, find the most recent Thursday
            const daysToSubtract = (dayOfWeek + 7 - 4) % 7; // 4 = Thursday
            weekStart.setDate(reportDate.getDate() - daysToSubtract);
        }
        
        // Calculate the Wednesday that ends this week
        let weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // Thursday + 6 days = Wednesday
        
        console.log('📊 [Weekly Ref Sales Sum] Week range calculated from Weekly_ALP:', {
            maxReportDate: maxReportDate,
            parsedDate: `${month}/${day}/${year}`,
            reportDate: reportDate.toISOString().split('T')[0],
            dayOfWeek,
            dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0]
        });
        
        // Get ref sales count for the week range using refvalidation.created_at
        // Handle lagnName parameter for role-based filtering (AGT, MGA, RGA, etc.)
        const { lagnName } = req.query;
        
        let refSalesQuery = `
            SELECT COUNT(*) as totalRefSales
            FROM refvalidation 
            WHERE DATE(created_at) >= ?
            AND DATE(created_at) <= ?
            AND created_at IS NOT NULL
            AND true_ref = 'Y'
        `;
        
        let queryParams = [weekStart, weekEnd];
        
        // If lagnName is provided, filter by lagnname or mga (same as monthly ref sales)
        if (lagnName) {
            refSalesQuery += ` AND (lagnname = ? OR mga = ?)`;
            queryParams.push(lagnName, lagnName);
            console.log('📊 [Weekly Ref Sales Sum] Filtering by lagnName:', lagnName);
        }
        
        const refSalesResult = await dbQuery(refSalesQuery, queryParams);
        const weeklyRefSales = refSalesResult[0]?.totalRefSales || 0;
        
        console.log('📊 [Weekly Ref Sales Sum] Response data:', {
            weeklyRefSales: weeklyRefSales,
            weekRange: `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`,
            maxReportDate: maxReportDate,
            rawResult: refSalesResult[0],
            note: 'Using refvalidation.created_at for ref sales count where true_ref = Y'
        });
        
        res.json({
            success: true,
            weeklyRefSales: parseInt(weeklyRefSales) || 0,
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
            maxReportDate: maxReportDate
        });
        
    } catch (error) {
        console.error('Error fetching weekly ref sales sum:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// GET /api/alp/monthly-alp-sum - Get monthly ALP from Weekly_ALP where REPORT = 'MTD Recap'
router.get('/monthly-alp-sum', async (req, res) => {
    try {
        const { query: dbQuery } = require('../db');
        
        // Get max reportdate from Weekly_ALP for MTD Recap in current month
        // Handle lagnName parameter for role-based filtering (AGT, MGA, RGA, etc.)
        const { lagnName, viewMode } = req.query;
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        console.log('📊 [Monthly ALP Sum] Current date info:', {
            now: currentDate.toISOString(),
            currentYear,
            currentMonth,
            currentMonthName: currentDate.toLocaleString('default', { month: 'long' }),
            lagnName: lagnName || 'SGA (organization-wide)'
        });
        
        // Build max date query with optional lagnName filtering
        let maxDateQuery = `
            SELECT reportdate as maxDate
            FROM Weekly_ALP 
            WHERE REPORT = 'MTD Recap'
            AND STR_TO_DATE(reportdate, '%m/%d/%Y') IS NOT NULL
            AND YEAR(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
            AND MONTH(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
        `;
        
        let maxDateParams = [currentYear, currentMonth];
        
        // Add lagnName filtering for non-SGA users
        if (lagnName) {
            maxDateQuery += ` AND LagnName = ?`;
            maxDateParams.push(lagnName);
            console.log('📊 [Monthly ALP Sum] Filtering by LagnName:', lagnName);
        }
        
        maxDateQuery += `
            ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
            LIMIT 1
        `;
        
        const maxDateResult = await dbQuery(maxDateQuery, maxDateParams);
        const maxReportDate = maxDateResult[0]?.maxDate;
        
        if (!maxReportDate) {
            console.log('📊 [Monthly ALP Sum] No max report date found for MTD Recap in current month');
            return res.json({ monthlyAlp: 0, comparisonAlp: 0 });
        }

        console.log('📊 [Monthly ALP Sum] Max MTD Recap date found:', { maxReportDate });
        
        // For SGA users (no lagnName), look for additional report dates within 3 days
        // SGA gets 2 reports per week, so we need to sum both
        let reportDatesToInclude = [maxReportDate];
        
        if (!lagnName) {
            // Parse the maxReportDate (format: MM/DD/YYYY)
            const [month, day, year] = maxReportDate.split('/').map(Number);
            const maxDate = new Date(year, month - 1, day);
            
            // Calculate date 3 days before maxReportDate
            const threeDaysBeforeMax = new Date(maxDate);
            threeDaysBeforeMax.setDate(threeDaysBeforeMax.getDate() - 3);
            
            console.log('📊 [Monthly ALP Sum - SGA] Looking for additional report dates within 3 days:', {
                maxReportDate,
                maxDateParsed: maxDate.toISOString(),
                threeDaysBeforeParsed: threeDaysBeforeMax.toISOString(),
                lookingBetween: `${threeDaysBeforeMax.toLocaleDateString('en-US')} and ${maxDate.toLocaleDateString('en-US')}`
            });
            
            // Find all report dates within 3 days before the max date
            const additionalDatesQuery = `
                SELECT DISTINCT reportdate
                FROM Weekly_ALP
                WHERE REPORT = 'MTD Recap'
                AND STR_TO_DATE(reportdate, '%m/%d/%Y') >= ?
                AND STR_TO_DATE(reportdate, '%m/%d/%Y') < ?
                AND YEAR(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
                AND MONTH(STR_TO_DATE(reportdate, '%m/%d/%Y')) = ?
                ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
            `;
            
            const additionalDatesResult = await dbQuery(additionalDatesQuery, [
                threeDaysBeforeMax.toISOString().split('T')[0],
                maxDate.toISOString().split('T')[0],
                currentYear,
                currentMonth
            ]);
            
            // Add any additional dates found
            additionalDatesResult.forEach(row => {
                if (row.reportdate && row.reportdate !== maxReportDate) {
                    reportDatesToInclude.push(row.reportdate);
                }
            });
            
            console.log('📊 [Monthly ALP Sum - SGA] Report dates to include:', {
                count: reportDatesToInclude.length,
                dates: reportDatesToInclude,
                note: 'Will sum LVL_1_NET from all these dates'
            });
        }
        
        // Get Monthly ALP data from Weekly_ALP where REPORT = 'MTD Recap' for all report dates
        // Apply same lagnName filtering as the max date query
        // Use different ALP columns based on user role and view mode
        let alpColumn;
        let clNameCondition = '';
        
        if (viewMode === 'team' || viewMode === 'mga' || viewMode === 'rga') {
          // Determine user role from request or user context
          const userRole = req.headers['user-role'] || 'SA'; // Default to SA for backward compatibility
          if (userRole === 'GA' || userRole === 'MGA' || userRole === 'RGA') {
            alpColumn = 'LVL_3_NET'; // GA, MGA, RGA use LVL_3_NET for team mode
            
            // For RGA users, apply CL_Name filtering based on viewMode
            if (userRole === 'RGA') {
              if (viewMode === 'mga') {
                clNameCondition = "AND CL_Name = 'MGA'"; // MGA tab: show only MGA-level data
              } else if (viewMode === 'rga') {
                clNameCondition = "AND CL_Name != 'MGA'"; // RGA tab: show non-MGA data (RGA level + first-year rollups)
              }
            }
          } else {
            alpColumn = 'LVL_2_NET'; // SA uses LVL_2_NET for team mode
          }
        } else {
          alpColumn = 'LVL_1_NET'; // All roles use LVL_1_NET for personal mode
        }
        
        // Build IN clause for all report dates
        const reportDatePlaceholders = reportDatesToInclude.map(() => '?').join(', ');
        
        let monthlyAlpQuery = `
            SELECT SUM(${alpColumn}) as totalMonthlyAlp
            FROM Weekly_ALP 
            WHERE REPORT = 'MTD Recap'
            AND reportdate IN (${reportDatePlaceholders})
            ${clNameCondition}
        `;
        
        console.log(`📊 [Monthly ALP Sum] Query for ${lagnName || 'SGA'}:`, {
            lagnName,
            viewMode,
            alpColumn,
            reportDatesCount: reportDatesToInclude.length,
            reportDates: reportDatesToInclude
        });
        
        let monthlyAlpParams = [...reportDatesToInclude];
        
        // Add lagnName filtering for non-SGA users
        if (lagnName) {
            monthlyAlpQuery += ` AND LagnName = ?`;
            monthlyAlpParams.push(lagnName);
        }
        
        const monthlyAlpResult = await dbQuery(monthlyAlpQuery, monthlyAlpParams);
        const monthlyAlp = monthlyAlpResult[0]?.totalMonthlyAlp || 0;
        
        // DETAILED SGA LOGGING FOR THIS MONTH NUMBER DEBUG
        if (!lagnName) {
            console.log('🔍🔍🔍 [SGA THIS MONTH BACKEND DEBUG] Detailed Monthly ALP query results:', {
                '1_SQL_QUERY': monthlyAlpQuery.replace(/\s+/g, ' ').trim(),
                '2_QUERY_PARAMS': monthlyAlpParams,
                '3_REPORT_DATES_INCLUDED': {
                    count: reportDatesToInclude.length,
                    dates: reportDatesToInclude,
                    note: 'SGA gets 2 reports per week - summing all dates within 3-day window'
                },
                '4_RAW_DATABASE_RESULT': monthlyAlpResult,
                '5_EXTRACTED_MONTHLY_ALP': monthlyAlp,
                '6_DATABASE_TABLE': 'Weekly_ALP',
                '7_FILTER_CONDITIONS': {
                    REPORT: 'MTD Recap',
                    reportdates: reportDatesToInclude,
                    column_summed: alpColumn || 'LVL_1_NET'
                },
                '8_EXPECTED_QUERY': `SELECT SUM(${alpColumn || 'LVL_1_NET'}) FROM Weekly_ALP WHERE REPORT='MTD Recap' AND reportdate IN (${reportDatesToInclude.map(d => `'${d}'`).join(', ')})`,
                '9_CHECK_IN_DATABASE': `Run this query: SELECT reportdate, LagnName, LVL_1_NET FROM Weekly_ALP WHERE REPORT='MTD Recap' AND reportdate IN (${reportDatesToInclude.map(d => `'${d}'`).join(', ')}) ORDER BY reportdate DESC, LagnName LIMIT 50`,
                '10_ALL_MTD_DATES': `Run this query: SELECT DISTINCT reportdate, COUNT(*) as count, SUM(LVL_1_NET) as total FROM Weekly_ALP WHERE REPORT='MTD Recap' GROUP BY reportdate ORDER BY reportdate DESC LIMIT 10`
            });
            
            if (monthlyAlp < 100000 && monthlyAlp !== 0) {
                console.warn('⚠️⚠️⚠️ [SGA BACKEND] Monthly ALP unusually low!', {
                    value: monthlyAlp,
                    reportDatesIncluded: reportDatesToInclude,
                    possibleIssues: [
                        'Weekly_ALP table might not have data for these reportdates',
                        'LVL_1_NET column might be NULL or have low values',
                        'REPORT filter might not match exactly (check for extra spaces)',
                        'reportdate format might not match (should be MM/DD/YYYY)',
                        'Data might be in a different column (check LVL_2_NET, LVL_3_NET)',
                        'Sum might be including negative values that cancel out',
                        'Not all report dates within 3-day window were found'
                    ]
                });
            }
        }
        
        // Get Daily_Activity data for comparison (current month)
        // Apply same lagnName filtering if provided - need to join with activeusers since Daily_Activity uses userId
        // Use Date.UTC to avoid timezone issues
        const monthStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
        const monthEnd = new Date(Date.UTC(currentYear, currentMonth, 0));
        
        let dailyActivityQuery = `
            SELECT SUM(da.alp) as totalDailyAlp
            FROM Daily_Activity da
            WHERE da.reportDate >= ?
            AND da.reportDate <= ?
        `;
        
        let dailyActivityParams = [monthStart, monthEnd];
        
        // Add lagnName filtering for non-SGA users (need to join with activeusers since Daily_Activity uses userId)
        if (lagnName) {
            dailyActivityQuery = `
                SELECT SUM(da.alp) as totalDailyAlp
                FROM Daily_Activity da
                JOIN activeusers au ON da.userId = au.id
                WHERE da.reportDate >= ?
                AND da.reportDate <= ?
                AND au.lagnname = ?
            `;
            dailyActivityParams.push(lagnName);
            console.log('📊 [Monthly ALP Sum] Filtering Daily_Activity by joining with activeusers.lagnname:', lagnName);
        }
        
        const dailyActivityResult = await dbQuery(dailyActivityQuery, dailyActivityParams);
        const comparisonAlp = dailyActivityResult[0]?.totalDailyAlp || 0;
        
        const response = {
            success: true,
            monthlyAlp: parseFloat(monthlyAlp) || 0,
            comparisonAlp: parseFloat(comparisonAlp) || 0,
            maxReportDate: maxReportDate,
            monthStart: monthStart.toISOString().split('T')[0],
            monthEnd: monthEnd.toISOString().split('T')[0]
        };
        
        console.log('📊 [Monthly ALP Sum] Response data:', {
            monthlyAlp: response.monthlyAlp,
            comparisonAlp: response.comparisonAlp,
            maxReportDate: response.maxReportDate,
            monthRange: `${response.monthStart} to ${response.monthEnd}`,
            rawMonthlyAlpResult: monthlyAlpResult[0],
            rawDailyActivityResult: dailyActivityResult[0],
            note: 'Using LVL_1_NET from Weekly_ALP where REPORT = MTD Recap'
        });
        
        res.json(response);
        
    } catch (error) {
        console.error('Error fetching monthly ALP sum:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// GET /api/alp/monthly-hires-sum - Get monthly hires from amore_data for current month
router.get('/monthly-hires-sum', async (req, res) => {
    try {
        const { query: dbQuery } = require('../db');
        
        // Get current month range
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        const monthStart = new Date(currentYear, currentMonth - 1, 1);
        const monthEnd = new Date(currentYear, currentMonth, 0);
        
        console.log('📊 [Monthly Hires Sum] Month range:', {
            currentYear,
            currentMonth,
            monthStart: monthStart.toISOString().split('T')[0],
            monthEnd: monthEnd.toISOString().split('T')[0]
        });
        
        // Get Total_Hires sum for current month
        const hiresQuery = `
            SELECT SUM(Total_Hires) as totalHires
            FROM amore_data 
            WHERE MORE_Date >= ?
            AND MORE_Date <= ?
        `;
        
        const hiresResult = await dbQuery(hiresQuery, [monthStart, monthEnd]);
        const monthlyHires = hiresResult[0]?.totalHires || 0;
        
        console.log('📊 [Monthly Hires Sum] Response data:', {
            monthlyHires: monthlyHires,
            monthRange: `${monthStart.toISOString().split('T')[0]} to ${monthEnd.toISOString().split('T')[0]}`,
            rawResult: hiresResult[0]
        });
        
        res.json({
            success: true,
            monthlyHires: parseInt(monthlyHires) || 0,
            monthStart: monthStart.toISOString().split('T')[0],
            monthEnd: monthEnd.toISOString().split('T')[0]
        });
        
    } catch (error) {
        console.error('Error fetching monthly hires sum:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// GET /api/alp/monthly-codes-sum - Get monthly codes from associates.PRODDATE for current month
router.get('/monthly-codes-sum', async (req, res) => {
    try {
        const { query: dbQuery } = require('../db');
        
        // Get current month range
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        const monthStart = new Date(currentYear, currentMonth - 1, 1);
        const monthEnd = new Date(currentYear, currentMonth, 0);
        
        console.log('📊 [Monthly Codes Sum] Month range:', {
            currentYear,
            currentMonth,
            monthStart: monthStart.toISOString().split('T')[0],
            monthEnd: monthEnd.toISOString().split('T')[0]
        });
        
        // Get codes count from associates table for current month
        const codesQuery = `
            SELECT COUNT(*) as totalCodes
            FROM associates 
            WHERE PRODDATE >= ?
            AND PRODDATE <= ?
            AND LagnName IS NOT NULL
            AND LagnName != ''
        `;
        
        const codesResult = await dbQuery(codesQuery, [monthStart, monthEnd]);
        const monthlyCodes = codesResult[0]?.totalCodes || 0;
        
        console.log('📊 [Monthly Codes Sum] Response data:', {
            monthlyCodes: monthlyCodes,
            monthRange: `${monthStart.toISOString().split('T')[0]} to ${monthEnd.toISOString().split('T')[0]}`,
            rawResult: codesResult[0]
        });
        
        res.json({
            success: true,
            monthlyCodes: parseInt(monthlyCodes) || 0,
            monthStart: monthStart.toISOString().split('T')[0],
            monthEnd: monthEnd.toISOString().split('T')[0]
        });
        
    } catch (error) {
        console.error('Error fetching monthly codes sum:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// GET /api/alp/monthly-ref-sales-sum - Get monthly ref sales from refvalidation.created_at for current month
router.get('/monthly-ref-sales-sum', async (req, res) => {
    try {
        const { query: dbQuery } = require('../db');
        
        // Get current month range
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        const monthStart = new Date(currentYear, currentMonth - 1, 1);
        const monthEnd = new Date(currentYear, currentMonth, 0);
        
        console.log('📊 [Monthly Ref Sales Sum] Month range:', {
            currentYear,
            currentMonth,
            monthStart: monthStart.toISOString().split('T')[0],
            monthEnd: monthEnd.toISOString().split('T')[0]
        });
        
        // Get ref sales count for current month using refvalidation.created_at
        // Handle lagnName parameter for role-based filtering (AGT, MGA, RGA, etc.)
        const { lagnName } = req.query;
        
        let refSalesQuery = `
            SELECT COUNT(*) as totalRefSales
            FROM refvalidation 
            WHERE DATE(created_at) >= ?
            AND DATE(created_at) <= ?
            AND created_at IS NOT NULL
            AND true_ref = 'Y'
        `;
        
        let queryParams = [monthStart, monthEnd];
        
        // If lagnName is provided, filter by lagnname or mga (same as monthly ref sales)
        if (lagnName) {
            refSalesQuery += ` AND (lagnname = ? OR mga = ?)`;
            queryParams.push(lagnName, lagnName);
            console.log('📊 [Monthly Ref Sales Sum] Filtering by lagnName:', lagnName);
        }
        
        const refSalesResult = await dbQuery(refSalesQuery, queryParams);
        const monthlyRefSales = refSalesResult[0]?.totalRefSales || 0;
        
        console.log('📊 [Monthly Ref Sales Sum] Response data:', {
            monthlyRefSales: monthlyRefSales,
            monthRange: `${monthStart.toISOString().split('T')[0]} to ${monthEnd.toISOString().split('T')[0]}`,
            rawResult: refSalesResult[0],
            note: 'Using refvalidation.created_at where true_ref = Y for current month'
        });
        
        res.json({
            success: true,
            monthlyRefSales: parseInt(monthlyRefSales) || 0,
            monthStart: monthStart.toISOString().split('T')[0],
            monthEnd: monthEnd.toISOString().split('T')[0]
        });
        
    } catch (error) {
        console.error('Error fetching monthly ref sales sum:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/* =========================
   Daily Production Tracker (daily_sga_alp table)
   ========================= */

// GET /api/alp/daily-tracker - Fetch daily production data from daily_sga_alp table
router.get("/daily-tracker", async (req, res) => {
    console.log('📊 [Daily Tracker] GET request received');
    
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both startDate and endDate parameters'
            });
        }
        
        console.log('📊 [Daily Tracker] Fetching data from', startDate, 'to', endDate);
        
        const query = `
            SELECT 
                date,
                arias,
                ny
            FROM daily_sga_alp
            WHERE date >= ?
            AND date <= ?
            ORDER BY date DESC
        `;
        
        const results = await dbQuery(query, [startDate, endDate]);
        
        console.log('📊 [Daily Tracker] Fetched', results.length, 'days');
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {
        console.error('❌ [Daily Tracker] Error fetching daily data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/alp/daily-tracker - Update daily production data in daily_sga_alp table
router.post("/daily-tracker", async (req, res) => {
    console.log('📊 [Daily Tracker] POST request received');
    console.log('📊 [Daily Tracker] Request body:', req.body);
    
    try {
        const { updates } = req.body;
        
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Invalid request body. Expected { updates: { "YYYY-MM-DD": { arias, ny }, ... } }'
            });
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        // Process each date update
        for (const [date, data] of Object.entries(updates)) {
            try {
                const { arias, ny } = data;
                
                console.log(`📊 [Daily Tracker] Updating date ${date}:`, { arias, ny });
                
                // Use INSERT ... ON DUPLICATE KEY UPDATE to handle both insert and update
                const query = `
                    INSERT INTO daily_sga_alp (date, arias, ny)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        arias = VALUES(arias),
                        ny = VALUES(ny)
                `;
                
                await dbQuery(query, [
                    date,
                    arias !== undefined && arias !== '' ? parseFloat(arias) : null,
                    ny !== undefined && ny !== '' ? parseFloat(ny) : null
                ]);
                
                successCount++;
                console.log(`✅ [Daily Tracker] Successfully updated date ${date}`);
                
            } catch (error) {
                errorCount++;
                console.error(`❌ [Daily Tracker] Error updating date ${date}:`, error);
            }
        }
        
        console.log(`📊 [Daily Tracker] Update complete: ${successCount} success, ${errorCount} errors`);
        
        res.json({
            success: true,
            message: `Successfully updated ${successCount} day(s)`,
            successCount,
            errorCount
        });
        
    } catch (error) {
        console.error('❌ [Daily Tracker] Error updating daily data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/* =========================
   Yearly Production Tracker (calculated from sga_alp table)
   ========================= */

// GET /api/alp/yearly-tracker - Calculate yearly totals from sga_alp monthly data
router.get("/yearly-tracker", async (req, res) => {
    console.log('📊 [Yearly Tracker] GET request received');
    
    try {
        console.log('📊 [Yearly Tracker] Calculating yearly totals from sga_alp');
        
        // Sum monthly net values grouped by year
        // month field is in MM/YYYY format, so we extract the year part
        // Show all years from 2008 onwards
        const query = `
            SELECT 
                SUBSTRING(month, 4, 4) as year,
                SUM(net) as net
            FROM sga_alp
            WHERE month IS NOT NULL 
            AND month != ''
            AND SUBSTRING(month, 4, 4) >= '2008'
            GROUP BY SUBSTRING(month, 4, 4)
            ORDER BY year DESC
        `;
        
        const results = await dbQuery(query);
        
        console.log('📊 [Yearly Tracker] Calculated', results.length, 'years from monthly data');
        if (results.length > 0) {
            console.log('📊 [Yearly Tracker] Sample:', results[0]);
        }
        
        res.json({
            success: true,
            data: results.map(row => ({
                year: parseInt(row.year),
                net: parseFloat(row.net || 0)
            }))
        });
        
    } catch (error) {
        console.error('❌ [Yearly Tracker] Error calculating yearly data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/* =========================
   SGA Monthly Production Tracker (sga_alp table)
   ========================= */

// GET /api/alp/sga-monthly - Fetch monthly production data from sga_alp table
router.get("/sga-monthly", async (req, res) => {
    console.log('📊 [SGA Monthly] GET request received');
    
    try {
        // Fetch all monthly data from sga_alp table
        const query = `
            SELECT 
                id,
                month,
                net,
                gross,
                rowcolor
            FROM sga_alp
            ORDER BY 
                SUBSTRING(month, 4, 4) DESC,
                SUBSTRING(month, 1, 2) DESC
        `;
        
        const results = await dbQuery(query);
        
        console.log('📊 [SGA Monthly] Fetched records:', results.length);
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {
        console.error('❌ [SGA Monthly] Error fetching monthly data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/alp/sga-monthly - Update monthly production data in sga_alp table
router.post("/sga-monthly", async (req, res) => {
    console.log('📊 [SGA Monthly] POST request received');
    console.log('📊 [SGA Monthly] Request body:', req.body);
    
    try {
        const { updates } = req.body;
        
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Invalid request body. Expected { updates: { "MM/YYYY": { gross, net }, ... } }'
            });
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        // Process each month update
        for (const [month, data] of Object.entries(updates)) {
            try {
                const { gross, net } = data;
                
                console.log(`📊 [SGA Monthly] Updating month ${month}:`, { gross, net });
                
                // Use INSERT ... ON DUPLICATE KEY UPDATE to handle both insert and update
                const query = `
                    INSERT INTO sga_alp (month, gross, net)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        gross = VALUES(gross),
                        net = VALUES(net)
                `;
                
                await dbQuery(query, [
                    month,
                    gross !== undefined && gross !== '' ? parseFloat(gross) : null,
                    net !== undefined && net !== '' ? parseFloat(net) : null
                ]);
                
                successCount++;
                console.log(`✅ [SGA Monthly] Successfully updated month ${month}`);
                
            } catch (error) {
                errorCount++;
                console.error(`❌ [SGA Monthly] Error updating month ${month}:`, error);
            }
        }
        
        console.log(`📊 [SGA Monthly] Update complete: ${successCount} success, ${errorCount} errors`);
        
        res.json({
            success: true,
            message: `Successfully updated ${successCount} month(s)`,
            successCount,
            errorCount
        });
        
    } catch (error) {
        console.error('❌ [SGA Monthly] Error updating monthly data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
