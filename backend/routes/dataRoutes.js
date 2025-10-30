const express = require('express');
const router = express.Router();
const { query } = require('../db');

router.get('/potentialvip', async (req, res) => {
    const { column, value, month } = req.query;

    if (!column || !value || !month) {
        return res.status(400).json({ success: false, message: 'Column, value, and month are required' });
    }

    try {
        // Create a base date from the given month (first day of that month)
        const baseDate = new Date(`${month}-01`);

        // Start date: 3 months behind the base date (first day of that month)
        const startDate = new Date(baseDate);
        startDate.setMonth(startDate.getMonth() - 3);
        const formattedStartDate = startDate.toISOString().split("T")[0];

        // End date: last day of the month immediately preceding the base date
        const endDate = new Date(baseDate);
        endDate.setDate(0);  // Setting day to 0 gives the last day of the previous month
        const formattedEndDate = endDate.toISOString().split("T")[0];

        // Query the database, adding Active = 'n'
        const queryStr = `
            SELECT * FROM activeusers 
            WHERE ?? = ? 
            AND esid BETWEEN ? AND ?
            AND Active = 'y'
        `;

        const results = await query(queryStr, [column, value, formattedStartDate, formattedEndDate]);

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from activeusers:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from activeusers',
            error: error.message,
        });
    }
});

router.get('/allvip-alp', async (req, res) => {
    const { column, value, month } = req.query;

    if (!column || !value || !month) {
        return res.status(400).json({ success: false, message: 'Column, value, and month are required' });
    }

    try {

        // Fetch all VIPs from activeusers (without date filter)
        const vipQuery = `
            SELECT lagnname 
            FROM activeusers 
            WHERE ?? = ?
        `;


        const vipResults = await query(vipQuery, [column, value]);

        if (!vipResults.length) {
            return res.status(200).json({ success: true, data: [] });
        }

        // Add agnName itself to the list
        const vipNames = vipResults.map(row => row.lagnname);
        vipNames.push(value); // Include the agnName itself


        // Query Weekly_ALP for the latest MTD Report data for these names
        const alpQuery = `
            SELECT w1.LagnName, w1.LVL_1_NET, w1.reportdate
            FROM Weekly_ALP w1
            INNER JOIN (
                SELECT LagnName, MAX(reportdate) AS latest_date
                FROM Weekly_ALP
                WHERE REPORT = "MTD Recap"
                AND LagnName IN (?)
                GROUP BY LagnName
            ) w2 
            ON w1.LagnName = w2.LagnName 
            AND DATE(w1.reportdate) = DATE(w2.latest_date)
        `;


        const alpResults = await query(alpQuery, [vipNames]);


        res.status(200).json({
            success: true,
            data: alpResults,
        });

    } catch (error) {
        console.error('Error fetching data from Weekly_ALP:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from Weekly_ALP',
            error: error.message,
        });
    }
});

router.get('/potentialvip-alp', async (req, res) => {
    const { column, value, month } = req.query;

    if (!column || !value || !month) {
        return res.status(400).json({ success: false, message: 'Column, value, and month are required' });
    }

    try {
        // Create a base date from the given month (first day of that month)
        const baseDate = new Date(`${month}-01`);

        // Start date: 3 months behind the base date (first day of that month)
        const startDate = new Date(baseDate);
        startDate.setMonth(startDate.getMonth() - 3);
        const formattedStartDate = startDate.toISOString().split("T")[0];

        // End date: last day of the month immediately preceding the base date
        const endDate = new Date(baseDate);
        endDate.setDate(0);  // Setting the date to 0 gets the last day of the previous month
        const formattedEndDate = endDate.toISOString().split("T")[0];


        // Fetch potential VIPs from activeusers within the computed date range
        const vipQuery = `
            SELECT lagnname FROM activeusers 
            WHERE ?? = ? 
            AND esid BETWEEN ? AND ?
        `;

        const vipResults = await query(vipQuery, [column, value, formattedStartDate, formattedEndDate]);

        if (!vipResults.length) {
            return res.status(200).json({ success: true, data: [] });
        }

        const vipNames = vipResults.map(row => row.lagnname); // Ensure column case matches DB

        // Now create a date range for the selected month.
        // Month start: first day of selected month
        const monthStart = new Date(`${month}-01`);
        // Month end: last day of selected month
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0); // last day of the selected month
        const formattedMonthStart = monthStart.toISOString().split("T")[0];
        const formattedMonthEnd = monthEnd.toISOString().split("T")[0];


        // Query Weekly_ALP to get only rows where:
        // - REPORT = "MTD Recap"
        // - reportdate is within the selected month
        // - LagnName is in the vipNames list
        const alpQuery = `
            SELECT *
            FROM Weekly_ALP
            WHERE REPORT = "MTD Recap"
              AND DATE(reportdate) BETWEEN ? AND ?
              AND LagnName IN (?)
        `;

        const alpResults = await query(alpQuery, [formattedMonthStart, formattedMonthEnd, vipNames]);


        res.status(200).json({
            success: true,
            data: alpResults,
        });

    } catch (error) {
        console.error('Error fetching data from Weekly_ALP:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from Weekly_ALP',
            error: error.message,
        });
    }
});

// Route to get data from VIPs table based on a specified column and value
router.get('/vips', async (req, res) => {
    const { column, value } = req.query;

    if (!column || !value) {
        return res.status(400).json({ success: false, message: 'Column and value are required' });
    }

    try {
        const queryStr = `SELECT * FROM VIPs WHERE ?? = ?`;
        const results = await query(queryStr, [column, value]);

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from VIPs:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from VIPs',
            error: error.message,
        });
    }
});

// Route to get data from associates table based on a specified column and value
router.get('/associates', async (req, res) => {
    const { column, value } = req.query;

    if (!column || !value) {
        return res.status(400).json({ success: false, message: 'Column and value are required' });
    }

    try {
        const queryStr = `SELECT * FROM associates WHERE ?? = ?`;
        const results = await query(queryStr, [column, value]);

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from associates:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from associates',
            error: error.message,
        });
    }
});

// Route to get data from pending table based on a specified column and value
router.get('/pending', async (req, res) => {
    const { column, value } = req.query;

    if (!column || !value) {
        return res.status(400).json({ success: false, message: 'Column and value are required' });
    }

    try {
        const queryStr = `SELECT * FROM pending WHERE ?? = ?`;
        const results = await query(queryStr, [column, value]);

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from pending:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from pending',
            error: error.message,
        });
    }
});

router.get('/monthly-alp-by-mga', async (req, res) => {
    const { value, clNameFilter } = req.query;

    if (!value) {
        return res.status(400).json({ success: false, message: 'Value is required' });
    }

    try {
        // Build query with optional CL_Name filtering
        let queryStr = `
            SELECT * FROM Monthly_ALP 
            WHERE LagnName = ?
        `;
        const params = [value];
        
        // Add CL_Name filter if specified
        if (clNameFilter === 'blank') {
            // For RGA mode: get rows where CL_Name is blank or NULL
            queryStr += ` AND (CL_Name = '' OR CL_Name IS NULL)`;
        } else if (clNameFilter === 'MGA') {
            // For MGA mode: get rows where CL_Name = 'MGA'
            queryStr += ` AND CL_Name = 'MGA'`;
        }
        // If clNameFilter is not specified, return all rows (original behavior)

        const results = await query(queryStr, params);

        // Directly return the filtered results
        return res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from Monthly_ALP:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from Monthly_ALP',
            error: error.message,
        });
    }
});

// New endpoint for SGA users to get all ALP data
router.get('/monthly-alp-all', async (req, res) => {
    try {
        // Query to get all rows from Monthly_ALP
        const queryStr = `
            SELECT * FROM Monthly_ALP 
            ORDER BY LagnName, month
        `;

        const results = await query(queryStr);

        // Directly return all results
        return res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching all data from Monthly_ALP:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching all data from Monthly_ALP',
            error: error.message,
        });
    }
});

// Route to get Total_Hires from amore_data where MGA matches the specified value
router.get('/total-hires', async (req, res) => {
    const { value } = req.query;

    if (!value) {
        return res.status(400).json({ success: false, message: 'Value is required' });
    }

    try {
        const queryStr = `
            SELECT * FROM amore_data
            WHERE MGA = ?
        `;

        const results = await query(queryStr, [value]);

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching Total_Hires from amore_data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching Total_Hires from amore_data',
            error: error.message,
        });
    }
});

router.get('/subagent-alp', async (req, res) => {
    const { value } = req.query;

    if (!value) {
        return res.status(400).json({ success: false, message: 'Value is required' });
    }

    try {
        // Query to fetch data from the new sub_agent table
        const queryStr = `
            SELECT 
                date,
                MGA,
                count,
                post_six,
                first_six
            FROM sub_agent 
            WHERE MGA = ?
            ORDER BY date ASC
        `;

        // Execute the query with the provided value
        const results = await query(queryStr, [value]);

        // Return the results
        return res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from sub_agent:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from sub_agent',
            error: error.message,
        });
    }
});

//combined routes
router.get('/vips/multiple', async (req, res) => {
    const { value } = req.query;

    if (!value) {
        return res.status(400).json({ success: false, message: 'Value is required' });
    }

    try {
        const queryStr = `
            SELECT * FROM VIPs
            WHERE sa = ? OR ga = ? OR mga = ?
        `;
        const results = await query(queryStr, [value, value, value]);

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from VIPs with multiple columns:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from VIPs',
            error: error.message,
        });
    }
});

router.get('/associates/multiple', async (req, res) => {
    const { value } = req.query;

    if (!value) {
        return res.status(400).json({ success: false, message: 'Value is required' });
    }

    try {
        const queryStr = `
            SELECT * FROM associates
            WHERE sa = ? OR ga = ? OR mga = ?
        `;
        const results = await query(queryStr, [value, value, value]);

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from associates with multiple columns:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from associates',
            error: error.message,
        });
    }
});

//SGA Routes
router.get('/vips-sga', async (req, res) => {
    const { column, value } = req.query;

    if (!column || !value) {
        return res.status(400).json({ success: false, message: 'Column and value are required' });
    }

    try {
        const queryStr = `SELECT * FROM VIPs WHERE reg_dir = "ZOPHIN"`;
        const results = await query(queryStr, [column, value]);

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from VIPs:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from VIPs',
            error: error.message,
        });
    }
});

// Route to get data from associates table based on a specified column and value
router.get('/associates-sga', async (req, res) => {
    const { column, value } = req.query;

    if (!column || !value) {
        return res.status(400).json({ success: false, message: 'Column and value are required' });
    }

    try {
        const queryStr = `SELECT * FROM associates WHERE DIR = "ZOPHIN"`;
        const results = await query(queryStr, [column, value]);

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from associates:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from associates',
            error: error.message,
        });
    }
});

// Route to get data from pending table based on a specified column and value
router.get('/pending-sga', async (req, res) => {
    const { column, value } = req.query;

    if (!column || !value) {
        return res.status(400).json({ success: false, message: 'Column and value are required' });
    }

    try {
        const queryStr = `SELECT * FROM pending WHERE DIR = "ZOPHIN"`;
        const results = await query(queryStr, [column, value]);

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from pending:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from pending',
            error: error.message,
        });
    }
});

router.get('/monthly-alp-by-sga', async (req, res) => {
    const { value } = req.query;
    
    if (!value) {
      return res.status(400).json({ 
        success: false, 
        message: 'Value is required' 
      });
    }
  
    try {
      // Assuming the 'month' column is stored in mm/yyyy format.
      // If LVL_1_NET is stored with currency formatting (e.g., "$1,234.56"),
      // we remove "$" and commas, then cast to DECIMAL(10,2) before summing.
      const queryStr = `
        SELECT month, 
               SUM(
                 CAST(
                   REPLACE(REPLACE(LVL_1_NET, '$', ''), ',', '')
                 AS DECIMAL(10,2))
               ) AS total
        FROM Monthly_ALP 
        WHERE REPORT = "MONTH RECAP"
        GROUP BY month
      `;
      
      const results = await query(queryStr, [value]);
  
      return res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error('Error fetching summed ALP data:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching summed ALP data',
        error: error.message,
      });
    }
  });

router.get('/org-total-hires', async (req, res) => {
    const { value } = req.query;

    if (!value) {
        return res.status(400).json({ success: false, message: 'Value is required' });
    }

    try {
        const queryStr = `
            SELECT * FROM amore_data
        `;

        const results = await query(queryStr, [value]);

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching Total_Hires from amore_data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching Total_Hires from amore_data',
            error: error.message,
        });
    }
});

router.get('/subagent-alp-sga', async (req, res) => {
    const { value } = req.query;

    if (!value) {
        return res.status(400).json({ success: false, message: 'Value is required' });
    }

    try {
        // Query to fetch data from the new sub_agent table for SGA (ARIAS ORGANIZATION)
        const queryStr = `
            SELECT 
                date,
                MGA,
                count,
                post_six,
                first_six
            FROM sub_agent 
            WHERE MGA = 'ARIAS ORGANIZATION'
            ORDER BY date ASC
        `;

        // Execute the query
        const results = await query(queryStr);

        // Return the results
        return res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from sub_agent:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from sub_agent',
            error: error.message,
        });
    }
});

router.get('/subagent-alp-mga', async (req, res) => {
    const { value } = req.query;

    if (!value) {
        return res.status(400).json({ success: false, message: 'Value is required' });
    }

    try {
        // Query to fetch data from the new sub_agent table for MGA
        const queryStr = `
            SELECT 
                date,
                MGA,
                count,
                post_six,
                first_six
            FROM sub_agent 
            WHERE MGA = ?
            ORDER BY date ASC
        `;

        // Execute the query with the provided value
        const results = await query(queryStr, [value]);

        // Return the results
        return res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from sub_agent:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from sub_agent',
            error: error.message,
        });
    }
});

// Get latest Weekly Recap row per LagnName from Weekly_ALP
router.post('/weekly-alp/latest-weekly-recap', async (req, res) => {
    try {
        const { names } = req.body; // array of lagnname strings
        if (!Array.isArray(names) || names.length === 0) {
            return res.status(400).json({ success: false, message: 'names array required' });
        }

        // Find the latest reportdate for REPORT = 'YTD Recap' for each name, then join back
        const sql = `
            SELECT w1.LagnName, w1.reportdate, w1.LVL_1_NET
            FROM Weekly_ALP w1
            INNER JOIN (
                SELECT LagnName, MAX(reportdate) AS latest_date
                FROM Weekly_ALP
                WHERE REPORT = 'YTD Recap' AND LagnName IN (?)
                GROUP BY LagnName
            ) w2 ON w1.LagnName = w2.LagnName AND DATE(w1.reportdate) = DATE(w2.latest_date)
            WHERE w1.REPORT = 'YTD Recap'
        `;
        const rows = await query(sql, [names]);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching YTD Recap ALP:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.get('/sga-alp', async (req, res) => {
    const { value } = req.query;

    if (!value) {
        return res.status(400).json({ success: false, message: 'Value is required' });
    }

    try {
        // Query to fetch all rows where the conditions are met, cleaning LVL_1_GROSS
        const queryStr = `
            SELECT *
            FROM sga_alp
        `;

        // Execute the query with the provided value
        const results = await query(queryStr, [value, value]);

        // Return the results
        return res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from sga:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from sga',
            error: error.message,
        });
    }
});

// Utility function to convert mm/dd/yyyy to mm/dd/yy
const convertDateToShortYear = (dateStr) => {
    const parts = dateStr.split('/');
    if (parts.length !== 3) {
      throw new Error('Invalid date format. Expected mm/dd/yyyy');
    }
    // parts: [month, day, year]
    // Return mm/dd/yy (last two digits of year)
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2].slice(-2)}`;
  };
  
  router.get('/pnp', async (req, res) => {
    const { name_line, esid, startDate, endDate } = req.query;
  
  
    if (!name_line || !esid || !startDate || !endDate) {
      console.error('Missing required parameters.');
      return res.status(400).json({
        success: false,
        message: 'name_line, esid, startDate, and endDate are required',
      });
    }
  
    try {
      // Convert startDate and endDate from mm/dd/yyyy to mm/dd/yy
      const formattedStartDate = convertDateToShortYear(startDate);
      const formattedEndDate = convertDateToShortYear(endDate);
  
      // Build the query:
      // - Use an exact match for name_line.
      // - Filter by esid.
      // - Use the date range (date column is stored as mm/dd/yy)
      const queryStr = `
        SELECT * FROM pnp
        WHERE name_line = ?
          AND esid = ?
          AND date BETWEEN ? AND ?
      `;
      const params = [name_line, esid, formattedStartDate, formattedEndDate];
  
      const results = await query(queryStr, params);
  
      return res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error('Error fetching data from pnp:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while fetching data from pnp',
        error: error.message,
      });
    }
  });

  router.get('/agent-history', async (req, res) => {
    const { value } = req.query;

    if (!value) {
        return res.status(400).json({ success: false, message: 'Value is required' });
    }

    try {
        // Query to fetch all rows where the conditions are met, cleaning LVL_1_GROSS
        const queryStr = `
            SELECT *
            FROM activeusers_archive
        `;

        // Execute the query with the provided value
        const results = await query(queryStr, [value, value]);

        // Return the results
        return res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching data from activeusers:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching data from activeusers',
            error: error.message,
        });
    }
});

router.get('/agent-history-filtered', async (req, res) => {
    const { column, value } = req.query;
  
    if (!column || !value) {
      return res.status(400).json({ success: false, message: 'Column and value are required.' });
    }
  
    // Define a list of allowed column names
    const allowedColumns = ['clname', 'mga', 'lagnname', 'reportdate', 'LVL_1_GROSS']; // update as needed
  
    if (!allowedColumns.includes(column)) {
      return res.status(400).json({ success: false, message: 'Invalid column name provided.' });
    }
  
    try {
      // Construct the query string with the validated column name.
      const queryStr = `
        SELECT *
        FROM activeusers_archive
        WHERE ${column} = ?
      `;
      
      // Execute the query. The value is parameterized.
      const results = await query(queryStr, [value]);
  
      // Return the filtered results.
      return res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error('Error fetching filtered data:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while fetching filtered data.',
        error: error.message,
      });
    }
  });

// Route to get unique MGA options - public version
router.get('/get-unique-mgas', async (req, res) => {
    try {
        const queryStr = `
            SELECT DISTINCT 
                lagnname,
                rga,
                tree,
                Active,
                hide
            FROM MGAs
        `;
        
        const results = await query(queryStr);
        
        if (!results.length) {
            return res.status(404).json({
                success: false,
                message: 'No MGAs found.',
            });
        }

        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching unique MGA options:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching unique MGA options.',
            error: error.message,
        });
    }
});

// Route to get RGA hierarchy data - public version
router.get('/get-rga-hierarchy', async (req, res) => {
    try {
        const queryStr = `
            SELECT DISTINCT 
                lagnname,
                rga,
                tree,
                'MGA' as clname,
                Active,
                hide
            FROM MGAs
            ORDER BY lagnname
        `;
        
        const results = await query(queryStr);
        
        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching RGA hierarchy:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching RGA hierarchy.',
            error: error.message,
        });
    }
});

// Route to get all MGAs - public version
router.get('/get-all-mgas', async (req, res) => {
    try {
        const queryStr = `
            SELECT DISTINCT 
                lagnname,
                rga,
                tree,
                'MGA' as clname,
                Active,
                hide,
                start
            FROM MGAs
            ORDER BY lagnname
        `;
        
        const results = await query(queryStr);
        
        res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching all MGAs:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching all MGAs.',
            error: error.message,
        });
    }
});

module.exports = router;