const express = require("express");
const router = express.Router();
const { pool, query } = require("../db");
const verifyToken = require("../middleware/verifyToken");
const { v4: uuidv4 } = require('uuid');

// Apply auth middleware to all routes
router.use(verifyToken);

// Get all refvalidation records with filtering
router.get("/all", async (req, res) => {
  try {
    const { month, admin_name, true_ref } = req.query;
    
    let baseQuery = `SELECT * FROM refvalidation WHERE DATE_FORMAT(created_at, '%Y-%m') = ?`;
    const params = [month];

    // Add admin_name filter
    if (admin_name && admin_name !== 'all') {
      baseQuery += " AND admin_name = ?";
      params.push(admin_name);
    }

    // Add true_ref filter
    if (true_ref && true_ref !== 'all') {
      if (true_ref === 'blank') {
        baseQuery += " AND (true_ref IS NULL OR true_ref = '')";
      } else {
        baseQuery += " AND true_ref = ?";
        params.push(true_ref);
      }
    }

    baseQuery += " ORDER BY created_at DESC";

    const result = await query(baseQuery, params);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching refvalidation data:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get month options for filtering
router.get("/month-options", async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT DATE_FORMAT(created_at, '%Y-%m') as month_value
      FROM refvalidation
      ORDER BY month_value DESC
    `);

    const monthOptions = result.map(row => ({
      value: row.month_value,
      label: new Date(`${row.month_value}-01T00:00:00`).toLocaleDateString('default', { 
        month: 'long', 
        year: 'numeric' 
      })
    }));

    res.json({ success: true, data: monthOptions });
  } catch (error) {
    console.error("Error fetching month options:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get unique admin names for tabs
router.get("/admin-tabs", async (req, res) => {
  try {
    const result = await query("SELECT DISTINCT admin_name FROM refvalidation WHERE admin_name IS NOT NULL ORDER BY admin_name");
    const adminNames = result.map(row => row.admin_name);
    res.json({ success: true, data: adminNames });
  } catch (error) {
    console.error("Error fetching admin tabs:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save (create/update) refvalidation records
router.post("/save", async (req, res) => {
  try {
    const records = req.body;
    
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, message: "Expected array of records" });
    }

    const savedRows = [];

    for (const record of records) {
      let savedRecord;
      
      if (record.id) {
        // Update existing record
        const updateQuery = `
          UPDATE refvalidation 
          SET true_ref = ?, ref_detail = ?, lagnname = ?, agent_id = ?, client_name = ?, 
              zip_code = ?, existing_policy = ?, trial = ?, date_app_checked = ?, 
              notes = ?, admin_name = ?, admin_id = ?, sa = ?, ga = ?, mga = ?, 
              rga = ?, clname = ?, agent_admin_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        
        await query(updateQuery, [
          record.true_ref || null,
          record.ref_detail || null,
          record.lagnname || null,
          record.agent_id || null,
          record.client_name || null,
          record.zip_code || null,
          record.existing_policy || null,
          record.trial || null,
          record.date_app_checked || null,
          record.notes || null,
          record.admin_name || null,
          record.admin_id || null,
          record.sa || null,
          record.ga || null,
          record.mga || null,
          record.rga || null,
          record.clname || null,
          record.agent_admin_id || null,
          record.id
        ]);
        
        savedRecord = { ...record };
      } else {
        // Create new record
        const uuid = record.uuid || uuidv4();
        
        const insertQuery = `
          INSERT INTO refvalidation 
          (uuid, true_ref, ref_detail, lagnname, agent_id, client_name, zip_code, 
           existing_policy, trial, date_app_checked, notes, admin_name, admin_id, 
           sa, ga, mga, rga, clname, agent_admin_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        
        const result = await query(insertQuery, [
          uuid,
          record.true_ref || null,
          record.ref_detail || null,
          record.lagnname || null,
          record.agent_id || null,
          record.client_name || null,
          record.zip_code || null,
          record.existing_policy || null,
          record.trial || null,
          record.date_app_checked || null,
          record.notes || null,
          record.admin_name || null,
          record.admin_id || null,
          record.sa || null,
          record.ga || null,
          record.mga || null,
          record.rga || null,
          record.clname || null,
          record.agent_admin_id || null
        ]);
        
        savedRecord = { ...record, id: result.insertId, uuid };
      }
      
      savedRows.push(savedRecord);
    }

    res.json({ success: true, message: "Records saved successfully", savedRows });
  } catch (error) {
    console.error("Error saving refvalidation records:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete refvalidation record
router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if record exists (by ID or UUID)
    const checkQuery = `SELECT * FROM refvalidation WHERE uuid = ? OR id = ?`;
    const existingRecord = await query(checkQuery, [id, id]);
    
    if (existingRecord.length === 0) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    
    // Delete the record
    const deleteQuery = `DELETE FROM refvalidation WHERE uuid = ? OR id = ?`;
    await query(deleteQuery, [id, id]);
    
    res.json({ success: true, message: "Record deleted successfully" });
  } catch (error) {
    console.error("Error deleting refvalidation record:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get refvalidation records for a specific agent
router.get("/agent", async (req, res) => {
  try {
    const { userId, month } = req.query;
    
    if (!userId || !month) {
      return res.status(400).json({ success: false, message: "userId and month are required" });
    }
    
    const result = await query(`
      SELECT * FROM refvalidation 
      WHERE agent_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?
      ORDER BY created_at DESC
    `, [userId, month]);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching agent refvalidation data:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get active users for agent dropdown
router.get("/active-users", async (req, res) => {
  try {
    const result = await query(`
      SELECT id, lagnname, admin_id 
      FROM activeusers 
      WHERE Active = "y" 
      ORDER BY lagnname ASC
    `);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching active users:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get current user's activeusers data for creating new refvalidation records
router.get("/current-user", async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }
    
    const result = await query(`
      SELECT id, admin_id, screen_name, lagnname
      FROM activeusers 
      WHERE id = ? AND Active = "y"
    `, [userId]);
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, message: "User not found in activeusers" });
    }
    
    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("Error fetching current user data:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;