// routes/alp.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");

/* =========================
   Daily_Activity Endpoints
   ========================= */

// GET /api/alp/daily - Retrieve data from Daily_Activity table
router.get("/daily", (req, res) => {
  pool.query("SELECT * FROM Daily_Activity", (err, results) => {
    if (err) {
      console.error("Error fetching daily activity data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// GET /api/alp/daily/sum - Retrieve sum of refAlp and alp for a given date or date range
router.get("/daily/sum", (req, res) => {
  const { date, startDate, endDate } = req.query;
  let query = "";
  let params = [];
  
  if (date) {
    query = "SELECT SUM(refAlp) AS totalRefAlp, SUM(alp) AS totalAlp FROM Daily_Activity WHERE reportDate = ?";
    params = [date];
  } else if (startDate && endDate) {
    query = "SELECT SUM(refAlp) AS totalRefAlp, SUM(alp) AS totalAlp FROM Daily_Activity WHERE reportDate BETWEEN ? AND ?";
    params = [startDate, endDate];
  } else {
    return res.status(400).json({ error: "Please provide either a 'date' or both 'startDate' and 'endDate'" });
  }

  pool.query(query, params, (err, results) => {
    if (err) {
      console.error("Error fetching daily sum data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results[0]);
  });
});

/* =========================
   Monthly_ALP Endpoints
   ========================= */

// GET /api/alp/monthly - Retrieve data from Monthly_ALP table
router.get("/monthly", (req, res) => {
  pool.query("SELECT * FROM Monthly_ALP", (err, results) => {
    if (err) {
      console.error("Error fetching monthly ALP data:", err);
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
      console.error("Error fetching monthly summary data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results[0]);
  });
});

/* =========================
   Weekly_ALP Endpoints
   ========================= */

// GET /api/alp/weekly - Retrieve data from Weekly_ALP table
router.get("/weekly", (req, res) => {
  pool.query("SELECT * FROM Weekly_ALP", (err, results) => {
    if (err) {
      console.error("Error fetching weekly ALP data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
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
      console.error("Error fetching weekly summary data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results[0]);
  });
});

// GET /api/alp/weekly/user-alp - Get actual ALP data for specific user and date range from Weekly_ALP
router.get("/weekly/user-alp", (req, res) => {
  const { lagnName, startDate, endDate } = req.query;
  
  console.log("🔍 [Weekly ALP API] Incoming request:");
  console.log("📋 Request params:", { lagnName, startDate, endDate });
  console.log("📋 Full query object:", req.query);
  
  if (!lagnName || !startDate || !endDate) {
    console.log("❌ [Weekly ALP API] Missing required parameters");
    return res.status(400).json({ error: "Please provide lagnName, startDate, and endDate" });
  }

  // Query to get Weekly_ALP data for the user's lagnName within the date range
  // Match by LagnName, filter by REPORT = 'Weekly Recap', and use LVL_1_NET
  // If multiple rows exist for same LagnName/reportdate, prioritize CL_Name = 'MGA'
  // Note: reportdate is stored as varchar in mm/dd/yyyy format, so we need to parse both sides
  const query = `
    SELECT 
      reportdate,
      LVL_1_NET AS actualAlp,
      LagnName,
      REPORT,
      CL_Name
    FROM (
      SELECT 
        reportdate,
        LVL_1_NET,
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
      AND STR_TO_DATE(reportdate, '%m/%d/%Y') BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
    ) ranked
    WHERE rn = 1
    ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') ASC
  `;
  
  console.log("🔍 [Weekly ALP API] Executing SQL query:");
  console.log("📋 Query:", query);
  console.log("📋 Parameters:", [lagnName, startDate, endDate]);
  
  // First, let's run some diagnostic queries to understand the data structure
  
  // Check table structure
  const structureQuery = "DESCRIBE Weekly_ALP";
  console.log("🔍 [Weekly ALP API] Checking table structure:");
  
  pool.query(structureQuery, [], (structErr, structResults) => {
    if (structErr) {
      console.error("❌ [Weekly ALP API] Structure query error:", structErr);
    } else {
      console.log("📊 [Weekly ALP API] Table structure:");
      console.log("📋 Columns:", structResults);
    }
    
    // Check for any records with similar LagnName
    const sampleQuery = `
      SELECT LagnName, REPORT, reportdate, LVL_1_NET
      FROM Weekly_ALP 
      WHERE LagnName LIKE ?
      ORDER BY reportdate DESC 
      LIMIT 5
    `;
    
    pool.query(sampleQuery, [`%${lagnName}%`], (sampleErr, sampleResults) => {
      if (sampleErr) {
        console.error("❌ [Weekly ALP API] Sample query error:", sampleErr);
      } else {
        console.log("📊 [Weekly ALP API] Sample records for similar LagnName:");
        console.log("📋 Sample count:", sampleResults.length);
        console.log("📋 Sample data:", sampleResults);
      }
      
      // Check what REPORT values exist
      const reportQuery = "SELECT DISTINCT REPORT FROM Weekly_ALP LIMIT 10";
      pool.query(reportQuery, [], (reportErr, reportResults) => {
        if (reportErr) {
          console.error("❌ [Weekly ALP API] Report query error:", reportErr);
        } else {
          console.log("📊 [Weekly ALP API] Available REPORT values:");
          console.log("📋 Report values:", reportResults);
        }
        
        // Now run the main query
    pool.query(query, [lagnName, startDate, endDate], (err, results) => {
    if (err) {
      console.error("❌ [Weekly ALP API] Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    console.log("📊 [Weekly ALP API] Raw database results:");
    console.log("📋 Results count:", results.length);
    console.log("📋 Raw data:", results);
    
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
      
      console.log(`📅 [Weekly ALP API] reportdate ${row.reportdate} (parsed: ${reportDate.toISOString().split('T')[0]}) represents week starting ${weekKey}`);
      
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
    
    console.log("✅ [Weekly ALP API] Formatted results:");
    console.log("📋 Formatted data:", formattedResults);
    
    const response = { success: true, data: formattedResults };
    console.log("📤 [Weekly ALP API] Sending response:", response);
    
        res.json(response);
        });
      });
    });
  });
});

/* =========================
   SGA_ALP Endpoints
   ========================= */

// GET /api/alp/sga - Retrieve data from SGA_ALP table
router.get("/sga", (req, res) => {
  pool.query("SELECT * FROM SGA_ALP", (err, results) => {
    if (err) {
      console.error("Error fetching SGA ALP data:", err);
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
      console.error("Error fetching SGA summary data:", err);
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
                    console.error(`[GET /getReportDates] Error fetching weekly dates: ${err.message}`);
                    return res.status(500).json({
                        success: false,
                        message: 'Internal server error while fetching report dates',
                        error: err.message,
                    });
                }

                pool.query(monthlyQuery, (err, monthlyResults) => {
                    if (err) {
                        console.error(`[GET /getReportDates] Error fetching monthly dates: ${err.message}`);
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
                    console.error(`[GET /getReportDates] Error fetching report dates: ${err.message}`);
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
        console.error(`[GET /getReportDates] Error fetching report dates: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching report dates',
            error: error.message,
        });
    }
});

// GET /api/alp/getUniqueMGAOptions - Get unique MGA filter options
router.get('/getUniqueMGAOptions', async (req, res) => {
    console.log('[GET /getUniqueMGAOptions] Request received to fetch unique MGA options.');

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

        console.log(`[GET /getUniqueMGAOptions] Executing query: ${query}`);
        
        pool.query(query, (err, results) => {
            if (err) {
                console.error(`[GET /getUniqueMGAOptions] Error fetching unique MGA options: ${err.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching unique MGA options.',
                    error: err.message,
                });
            }

            if (!results.length) {
                console.warn('[GET /getUniqueMGAOptions] No active MGAs found.');
                return res.status(404).json({
                    success: false,
                    message: 'No active MGAs found.',
                });
            }

            console.log(`[GET /getUniqueMGAOptions] Query executed successfully. Number of rows fetched: ${results.length}`);
            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {
        console.error(`[GET /getUniqueMGAOptions] Error fetching unique MGA options: ${error.message}`);
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

    console.log(`[GET /getweeklyall] Request received with filters - startDate: ${startDate}, endDate: ${endDate}, report: ${report}, MGA_NAME: ${MGA_NAME}, rga: ${rga}, tree: ${tree}`);

    if (!startDate || !endDate) {
        console.warn(`[GET /getweeklyall] Missing required parameters: startDate or endDate`);
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
                wa.LVL_1_NET,
                wa.LVL_1_GROSS, 
                wa.MGA_NAME, 
                au.profpic, 
                au.esid,
                m.rga, 
                m.legacy, 
                m.tree 
            FROM Weekly_ALP wa
            LEFT JOIN activeusers au 
                ON wa.LagnName = au.lagnname
            LEFT JOIN MGAs m 
                ON wa.MGA_NAME = m.lagnname
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

        console.log(`[GET /getweeklyall] Executing query: ${query}`);
        
        pool.query(query, params, (err, results) => {
            if (err) {
                console.error(`[GET /getweeklyall] Error fetching data: ${err.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getweeklyall',
                    error: err.message,
                });
            }

            console.log(`[GET /getweeklyall] Query executed successfully. Number of rows fetched: ${results.length}`);

            // 🛠 Deduplication Logic: Keep only the row where `CTLNO = MGA` if duplicates exist
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

            console.log(`[GET /getweeklyall] Final deduplicated results: ${finalResults.length} rows`);

            res.status(200).json({
                success: true,
                data: finalResults,
            });
        });
    } catch (error) {
        console.error(`[GET /getweeklyall] Error fetching data: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data for getweeklyall',
            error: error.message,
        });
    }
});

// GET /api/alp/getweeklysa - Get SA weekly leaderboard data
router.get('/getweeklysa', async (req, res) => {
    const { startDate, endDate, report = 'Weekly Recap', MGA_NAME, rga, tree } = req.query;

    console.log(`[GET /getweeklysa] Request received with startDate: ${startDate}, endDate: ${endDate}, report: ${report}, MGA_NAME: ${MGA_NAME}, rga: ${rga}, tree: ${tree}`);

    if (!startDate || !endDate) {
        console.warn(`[GET /getweeklysa] Missing required parameters: startDate or endDate`);
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
                ON wa.LagnName = au.lagnname
            LEFT JOIN MGAs m 
                ON wa.MGA_NAME = m.lagnname
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

        console.log(`[GET /getweeklysa] Executing query: ${query}`);
        
        pool.query(query, filters, (err, results) => {
            if (err) {
                console.error(`[GET /getweeklysa] Error fetching data: ${err.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getweeklysa',
                    error: err.message,
                });
            }

            console.log(`[GET /getweeklysa] Query executed successfully. Number of rows fetched: ${results.length}`);
            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {
        console.error(`[GET /getweeklysa] Error fetching data: ${error.message}`);
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

    console.log(`[GET /getweeklyga] Request received with startDate: ${startDate}, endDate: ${endDate}, report: ${report}, MGA_NAME: ${MGA_NAME}, rga: ${rga}, tree: ${tree}`);

    if (!startDate || !endDate) {
        console.warn(`[GET /getweeklyga] Missing required parameters: startDate or endDate`);
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
                ON wa.LagnName = au.lagnname
            LEFT JOIN MGAs m 
                ON wa.MGA_NAME = m.lagnname
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

        console.log(`[GET /getweeklyga] Executing query: ${query}`);
        
        pool.query(query, filters, (err, results) => {
            if (err) {
                console.error(`[GET /getweeklyga] Error fetching data: ${err.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getweeklyga',
                    error: err.message,
                });
            }

            console.log(`[GET /getweeklyga] Query executed successfully. Number of rows fetched: ${results.length}`);
            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {
        console.error(`[GET /getweeklyga] Error fetching data: ${error.message}`);
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

    console.log(`[GET /getweeklymga] Request received with filters - startDate: ${startDate}, endDate: ${endDate}, report: ${report}, rga: ${rga}, tree: ${tree}`);

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
                ON wa.LagnName = au.lagnname
            LEFT JOIN MGAs m 
                ON wa.LagnName = m.LagnName
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

        console.log(`[GET /getweeklymga] Executing query: ${query}`);
        
        pool.query(query, params, (err, results) => {
            if (err) {
                console.error(`[GET /getweeklymga] Error: ${err.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: err.message,
                });
            }

            // 🛠 Deduplication Logic: Keep only rows where `CTLNO = 'MGA'`, or the lowest `CTLNO`
            const deduplicatedResults = [];
            const seen = new Map();

            for (const row of results) {
                const uniqueKey = row.LagnName;

                if (!seen.has(uniqueKey)) {
                    seen.set(uniqueKey, row);
                } else {
                    if (row.CTLNO === 'MGA' || parseInt(row.CTLNO) < parseInt(seen.get(uniqueKey).CTLNO)) {
                        seen.set(uniqueKey, row);
                    }
                }
            }

            const finalResults = Array.from(seen.values());

            console.log(`[GET /getweeklymga] Final deduplicated results: ${finalResults.length} rows`);

            res.status(200).json({
                success: true,
                data: finalResults,
            });
        });
    } catch (error) {
        console.error(`[GET /getweeklymga] Error: ${error.message}`);
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

    console.log(`[GET /getweeklyrga] Request received with filters - startDate: ${startDate}, endDate: ${endDate}, report: ${report}, rga: ${rga}, tree: ${tree}`);

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
                ON wa.LagnName = au.lagnname
            LEFT JOIN MGAs m 
                ON wa.LagnName = m.LagnName
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

        console.log(`[GET /getweeklyrga] Executing query: ${query}`);
        
        pool.query(query, params, (err, results) => {
            if (err) {
                console.error(`[GET /getweeklyrga] Error: ${err.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: err.message,
                });
            }

            // 🛠 Deduplication Logic: Keep only one row per `LagnName` with the lowest `CTLNO`
            const deduplicatedResults = [];
            const seen = new Map();

            for (const row of results) {
                const uniqueKey = row.LagnName;

                if (!seen.has(uniqueKey)) {
                    seen.set(uniqueKey, row);
                } else {
                    if (parseInt(row.CTLNO) < parseInt(seen.get(uniqueKey).CTLNO)) {
                        seen.set(uniqueKey, row);
                    }
                }
            }

            const finalResults = Array.from(seen.values());

            console.log(`[GET /getweeklyrga] Final deduplicated results: ${finalResults.length} rows`);

            res.status(200).json({
                success: true,
                data: finalResults,
            });
        });
    } catch (error) {
        console.error(`[GET /getweeklyrga] Error: ${error.message}`);
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

    console.log(`[GET /getmonthlyall] Request received with filters - month: ${month}, MGA_NAME: ${MGA_NAME}, rga: ${rga}, tree: ${tree}`);

    if (!month) {
        console.warn(`[GET /getmonthlyall] Missing required parameter: month`);
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
                ON ma.LagnName = au.lagnname
            LEFT JOIN MGAs m 
                ON ma.MGA_NAME = m.lagnname
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

        console.log(`[GET /getmonthlyall] Executing query: ${query}`);
        
        pool.query(query, params, (err, results) => {
            if (err) {
                console.error(`[GET /getmonthlyall] Error fetching data: ${err.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getmonthlyall',
                    error: err.message,
                });
            }

            console.log(`[GET /getmonthlyall] Query executed successfully. Number of rows fetched: ${results.length}`);

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

            console.log(`[GET /getmonthlyall] Final deduplicated results: ${finalResults.length} rows`);

            res.status(200).json({
                success: true,
                data: finalResults,
            });
        });
    } catch (error) {
        console.error(`[GET /getmonthlyall] Error fetching data: ${error.message}`);
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

    console.log(`[GET /getmonthlysa] Request received with month: ${month}, MGA_NAME: ${MGA_NAME}, rga: ${rga}, tree: ${tree}`);

    if (!month) {
        console.warn(`[GET /getmonthlysa] Missing required parameter: month`);
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
                ON ma.LagnName = au.lagnname
            LEFT JOIN MGAs m 
                ON ma.MGA_NAME = m.lagnname
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

        console.log(`[GET /getmonthlysa] Executing query: ${query}`);
        
        pool.query(query, params, (err, results) => {
            if (err) {
                console.error(`[GET /getmonthlysa] Error fetching data: ${err.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getmonthlysa',
                    error: err.message,
                });
            }

            console.log(`[GET /getmonthlysa] Query executed successfully. Number of rows fetched: ${results.length}`);

            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {
        console.error(`[GET /getmonthlysa] Error fetching data: ${error.message}`);
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

    console.log(`[GET /getmonthlyga] Request received with month: ${month}, MGA_NAME: ${MGA_NAME}, rga: ${rga}, tree: ${tree}`);

    if (!month) {
        console.warn(`[GET /getmonthlyga] Missing required parameter: month`);
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
                ON ma.LagnName = au.lagnname
            LEFT JOIN MGAs m 
                ON ma.MGA_NAME = m.lagnname
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

        console.log(`[GET /getmonthlyga] Executing query: ${query}`);
        
        pool.query(query, params, (err, results) => {
            if (err) {
                console.error(`[GET /getmonthlyga] Error fetching data: ${err.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getmonthlyga',
                    error: err.message,
                });
            }

            console.log(`[GET /getmonthlyga] Query executed successfully. Number of rows fetched: ${results.length}`);

            res.status(200).json({
                success: true,
                data: results,
            });
        });
    } catch (error) {
        console.error(`[GET /getmonthlyga] Error fetching data: ${error.message}`);
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

    console.log(`[GET /getmonthlymga] Request received with filters - month: ${month}, rga: ${rga}, tree: ${tree}`);

    if (!month) {
        console.warn(`[GET /getmonthlymga] Missing required parameter: month`);
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
                ON ma.LagnName = au.lagnname
            LEFT JOIN MGAs m 
                ON ma.LagnName = m.LagnName
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

        console.log(`[GET /getmonthlymga] Executing query: ${query}`);
        
        pool.query(query, params, (err, results) => {
            if (err) {
                console.error(`[GET /getmonthlymga] Error fetching data: ${err.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getmonthlymga',
                    error: err.message,
                });
            }

            console.log(`[GET /getmonthlymga] Query executed successfully. Number of rows fetched: ${results.length}`);

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

            console.log(`[GET /getmonthlymga] Final deduplicated results: ${finalResults.length} rows`);

            res.status(200).json({
                success: true,
                data: finalResults,
            });
        });
    } catch (error) {
        console.error(`[GET /getmonthlymga] Error fetching data: ${error.message}`);
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

    console.log(`[GET /getmonthlyrga] Request received with filters - month: ${month}, rga: ${rga}, tree: ${tree}`);

    if (!month) {
        console.warn(`[GET /getmonthlyrga] Missing required parameter: month`);
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
                ON ma.LagnName = au.lagnname
            LEFT JOIN MGAs m 
                ON ma.LagnName = m.LagnName
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

        console.log(`[GET /getmonthlyrga] Executing query: ${query}`);
        
        pool.query(query, params, (err, results) => {
            if (err) {
                console.error(`[GET /getmonthlyrga] Error fetching data: ${err.message}`);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error while fetching data for getmonthlyrga',
                    error: err.message,
                });
            }

            console.log(`[GET /getmonthlyrga] Query executed successfully. Number of rows fetched: ${results.length}`);

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

            console.log(`[GET /getmonthlyrga] Final deduplicated results: ${finalResults.length} rows`);

            res.status(200).json({
                success: true,
                data: finalResults,
            });
        });
    } catch (error) {
        console.error(`[GET /getmonthlyrga] Error fetching data: ${error.message}`);
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
        console.error(`[GET /associates-raw] Error fetching data: ${error.message}`);
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
        console.error(`[GET /hires-raw] Error fetching data: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching raw hires data',
            error: error.message,
        });
    }
});

module.exports = router;
