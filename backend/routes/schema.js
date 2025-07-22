const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

/**
 * Get available database tables
 * This endpoint returns tables that can be queried for notification groups
 */
router.get('/tables', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // List of tables that are safe to expose for querying
    // Include table name and a user-friendly display name
    const availableTables = [
      {
        name: 'activeusers',
        displayName: 'Users',
        description: 'User accounts and profile information'
      },
      {
        name: 'licensed_states',
        displayName: 'Licenses',
        description: 'User license information'
      },
      {
        name: 'amore_data',
        displayName: 'MORE',
        description: 'Hiring data'
      },
      {
        name: 'MGAs',
        displayName: 'MGAs',
        description: 'MGAs'
      },
 
      // Add more tables as needed
    ];

    return res.json({
      success: true,
      tables: availableTables
    });
  } catch (error) {
    console.error('Error fetching available tables:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving available tables',
      error: error.message
    });
  }
});

/**
 * Get columns for specific tables
 * This endpoint returns column information for the requested tables
 */
router.post('/columns', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { tables } = req.body;
    
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of table names'
      });
    }

    // Validate against allowed tables to prevent SQL injection
    const allowedTables = ['activeusers', 'licensed_states', 'amore_data', 'MGAs'];
    const validTables = tables.filter(table => allowedTables.includes(table));

    if (validTables.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid tables provided'
      });
    }

    // Get column information for each table
    const columnData = [];

    for (const table of validTables) {
      // Get column information from information_schema
      const columnsQuery = `
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `;
      
      const columns = await db.query(columnsQuery, [table]);
      
      // Map columns to a more friendly format
      columns.forEach(column => {
        // Exclude sensitive columns like passwords
        if (column.COLUMN_NAME !== 'password' && 
            column.COLUMN_NAME !== 'reset_token' &&
            !column.COLUMN_NAME.includes('secret')) {
          columnData.push({
            table: table,
            column: column.COLUMN_NAME,
            dataType: column.DATA_TYPE,
            isNullable: column.IS_NULLABLE === 'YES',
            description: column.COLUMN_COMMENT || '',
            displayName: formatColumnName(column.COLUMN_NAME)
          });
        }
      });
    }

    return res.json({
      success: true,
      columns: columnData
    });
  } catch (error) {
    console.error('Error fetching table columns:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving table columns',
      error: error.message
    });
  }
});

/**
 * Helper function to format column names for display
 */
function formatColumnName(columnName) {
  // Convert snake_case to Title Case
  return columnName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = router; 