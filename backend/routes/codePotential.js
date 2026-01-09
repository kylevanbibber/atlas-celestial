const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/code-potential
 * Fetch code potential data
 * Optional query params:
 *   - date: Filter by email_received_date (YYYY-MM-DD format)
 */
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    
    let query = `
      SELECT 
        id,
        org,
        recruiting_obj,
        codes_mtd,
        potential_vips,
        potential_code_with_vips,
        pct_of_obj_mtd,
        pending_agents,
        setup_kits_inprogress,
        processed_date,
        email_received_date,
        created_at
      FROM code_potential
    `;
    
    const params = [];
    
    // Filter by date if provided
    if (date) {
      query += ` WHERE email_received_date = ?`;
      params.push(date);
    }
    
    // Order by most recent email_received_date first, then by org
    query += ` ORDER BY email_received_date DESC, org ASC`;
    
    const rows = await db.query(query, params);
    
    console.log(`[Code Potential API] Fetched ${rows.length} rows, isArray: ${Array.isArray(rows)}`);
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching code potential data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch code potential data',
      error: error.message
    });
  }
});

/**
 * GET /api/code-potential/monthly-codes
 * Get actual monthly code counts from associates table by PRODDATE
 * Returns counts grouped by year-month
 * NOTE: This must come BEFORE /:id routes to avoid route conflicts
 */
router.get('/monthly-codes', async (req, res) => {
  try {
    const query = `
      SELECT 
        DATE_FORMAT(PRODDATE, '%Y-%m') as month,
        COUNT(*) as code_count
      FROM associates
      WHERE PRODDATE IS NOT NULL
        AND PRODDATE >= '2025-01-01'
      GROUP BY DATE_FORMAT(PRODDATE, '%Y-%m')
      ORDER BY month ASC
    `;
    
    const rows = await db.query(query);
    
    console.log(`[Code Potential API] Monthly codes fetched: ${rows.length} months`);
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching monthly codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly codes',
      error: error.message
    });
  }
});

/**
 * POST /api/code-potential
 * Create a new code potential record
 */
router.post('/', async (req, res) => {
  try {
    const {
      org,
      recruiting_obj,
      codes_mtd,
      potential_vips,
      potential_code_with_vips,
      pct_of_obj_mtd,
      pending_agents,
      setup_kits_inprogress,
      processed_date,
      email_received_date
    } = req.body;
    
    // Validate required fields
    if (!org || !processed_date || !email_received_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: org, processed_date, email_received_date'
      });
    }
    
    const query = `
      INSERT INTO code_potential (
        org,
        recruiting_obj,
        codes_mtd,
        potential_vips,
        potential_code_with_vips,
        pct_of_obj_mtd,
        pending_agents,
        setup_kits_inprogress,
        processed_date,
        email_received_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await db.query(query, [
      org,
      recruiting_obj || null,
      codes_mtd || null,
      potential_vips || null,
      potential_code_with_vips || null,
      pct_of_obj_mtd || null,
      pending_agents || null,
      setup_kits_inprogress || null,
      processed_date,
      email_received_date
    ]);
    
    res.json({
      success: true,
      message: 'Code potential record created successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error creating code potential record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create code potential record',
      error: error.message
    });
  }
});

/**
 * PUT /api/code-potential/:id
 * Update a code potential record
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      org,
      recruiting_obj,
      codes_mtd,
      potential_vips,
      potential_code_with_vips,
      pct_of_obj_mtd,
      pending_agents,
      setup_kits_inprogress,
      processed_date,
      email_received_date
    } = req.body;
    
    const query = `
      UPDATE code_potential
      SET
        org = ?,
        recruiting_obj = ?,
        codes_mtd = ?,
        potential_vips = ?,
        potential_code_with_vips = ?,
        pct_of_obj_mtd = ?,
        pending_agents = ?,
        setup_kits_inprogress = ?,
        processed_date = ?,
        email_received_date = ?
      WHERE id = ?
    `;
    
    const result = await db.query(query, [
      org,
      recruiting_obj,
      codes_mtd,
      potential_vips,
      potential_code_with_vips,
      pct_of_obj_mtd,
      pending_agents,
      setup_kits_inprogress,
      processed_date,
      email_received_date,
      id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Code potential record not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Code potential record updated successfully'
    });
  } catch (error) {
    console.error('Error updating code potential record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update code potential record',
      error: error.message
    });
  }
});

/**
 * DELETE /api/code-potential/:id
 * Delete a code potential record
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM code_potential WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Code potential record not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Code potential record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting code potential record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete code potential record',
      error: error.message
    });
  }
});

module.exports = router;

