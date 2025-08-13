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
    let records = req.body;
    const userId = req.userId; // Get userId from middleware instead of body
    console.log("RefValidation Save - Received records:", JSON.stringify(records, null, 2));
    
    // Handle case where records come as an object with numbered keys
    if (!Array.isArray(records)) {
      console.log("RefValidation Save - Converting object to array");
      
      // Check if it's an object with numbered keys and a userId property
      if (typeof records === 'object' && records !== null) {
        const recordsArray = [];
        Object.keys(records).forEach(key => {
          // Skip non-numeric keys (like 'userId')
          if (!isNaN(key)) {
            recordsArray.push(records[key]);
          }
        });
        
        if (recordsArray.length > 0) {
          records = recordsArray;
          console.log("RefValidation Save - Converted to array:", recordsArray.length, "records");
        } else {
          console.error("RefValidation Save - No valid records found in object");
          return res.status(400).json({ success: false, message: "No valid records found" });
        }
      } else {
        console.error("RefValidation Save - Expected array, received:", typeof records);
        return res.status(400).json({ success: false, message: "Expected array of records" });
      }
    }

    const savedRows = [];

    for (const record of records) {
      console.log("RefValidation Save - Processing record:", record.uuid || record.id || "new");
      let savedRecord;
      
      if (record.id) {
        console.log("RefValidation Save - Updating existing record with ID:", record.id);
        
        // Look up agent_id from activeusers based on lagnname for existing records too
        let sa = record.sa, ga = record.ga, mga = record.mga, rga = record.rga, clname = record.clname;
        let lagnnameValue = record.lagnname || '';
        let resolvedAgentId = record.agent_id; // Use the provided agent_id first
        
        // If agent_id is provided, validate it and get hierarchy data
        if (record.agent_id) {
          console.log("RefValidation Save - Validating provided agent_id for update:", record.agent_id);
          const agentQuery = `SELECT id, sa, ga, mga, rga, clname, lagnname FROM activeusers WHERE id = ? AND Active = "y"`;
          const agentResult = await query(agentQuery, [record.agent_id]);
          
          if (agentResult.length > 0) {
            resolvedAgentId = agentResult[0].id;
            sa = agentResult[0].sa;
            ga = agentResult[0].ga;
            mga = agentResult[0].mga;
            rga = agentResult[0].rga;
            clname = agentResult[0].clname;
            lagnnameValue = agentResult[0].lagnname; // Use the canonical lagnname from database
            
            console.log("RefValidation Save - Validated agent_id for update:", { 
              resolvedAgentId, sa, ga, mga, rga, clname, lagnname: lagnnameValue 
            });
          } else {
            console.warn("RefValidation Save - Invalid agent_id provided for update:", record.agent_id);
            resolvedAgentId = null;
          }
        } else if (record.lagnname) {
          // Fallback: look up by lagnname if no agent_id provided
          console.log("RefValidation Save - Looking up agent by lagnname for update:", record.lagnname);
          const agentQuery = `SELECT id, sa, ga, mga, rga, clname, lagnname FROM activeusers WHERE lagnname = ? AND Active = "y"`;
          const agentResult = await query(agentQuery, [record.lagnname]);
          
          if (agentResult.length > 0) {
            resolvedAgentId = agentResult[0].id;
            sa = agentResult[0].sa;
            ga = agentResult[0].ga;
            mga = agentResult[0].mga;
            rga = agentResult[0].rga;
            clname = agentResult[0].clname;
            lagnnameValue = agentResult[0].lagnname;
            
            console.log("RefValidation Save - Found agent by lagnname for update:", { 
              resolvedAgentId, sa, ga, mga, rga, clname, lagnname: lagnnameValue 
            });
          } else {
            console.warn("RefValidation Save - No active agent found for lagnname during update:", record.lagnname);
            resolvedAgentId = null;
          }
        } else {
          console.log("RefValidation Save - No agent_id or lagnname provided for update, agent_id will be NULL");
          resolvedAgentId = null;
        }
        
        // Update existing record
        const updateQuery = `
          UPDATE refvalidation 
          SET true_ref = ?, ref_detail = ?, lagnname = ?, agent_id = ?, client_name = ?, 
              zip_code = ?, existing_policy = ?, trial = ?, date_app_checked = ?, 
              notes = ?, admin_name = ?, admin_id = ?, sa = ?, ga = ?, mga = ?, 
              rga = ?, clname = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        
        await query(updateQuery, [
          record.true_ref || null,
          record.ref_detail || null,
          lagnnameValue,
          resolvedAgentId, // Use the resolved agent_id from lagnname lookup
          record.client_name || null,
          record.zip_code || null,
          record.existing_policy || null,
          record.trial || null,
          record.date_app_checked || null,
          record.notes || null,
          record.admin_name || null,
          record.admin_id || null,
          sa,
          ga,
          mga,
          rga,
          clname,
          record.id
        ]);
        
        savedRecord = { ...record, agent_id: resolvedAgentId, lagnname: lagnnameValue, sa, ga, mga, rga, clname };
        console.log("RefValidation Save - Updated record:", savedRecord.id);
      } else {
        console.log("RefValidation Save - Creating new record");
        // Create new record
        const uuid = record.uuid || uuidv4();
        console.log("RefValidation Save - Generated UUID:", uuid);
        
        // Look up agent_id from activeusers based on lagnname
        let sa = null, ga = null, mga = null, rga = null, clname = null;
        let lagnnameValue = record.lagnname || ''; // Use empty string like old system
        let resolvedAgentId = record.agent_id; // Use the provided agent_id first
        
        // If agent_id is provided, validate it and get hierarchy data
        if (record.agent_id) {
          console.log("RefValidation Save - Validating provided agent_id:", record.agent_id);
          const agentQuery = `SELECT id, sa, ga, mga, rga, clname, lagnname FROM activeusers WHERE id = ? AND Active = "y"`;
          const agentResult = await query(agentQuery, [record.agent_id]);
          
          if (agentResult.length > 0) {
            resolvedAgentId = agentResult[0].id;
            sa = agentResult[0].sa;
            ga = agentResult[0].ga;
            mga = agentResult[0].mga;
            rga = agentResult[0].rga;
            clname = agentResult[0].clname;
            lagnnameValue = agentResult[0].lagnname; // Use the canonical lagnname from database
            
            console.log("RefValidation Save - Validated agent_id:", { 
              resolvedAgentId, sa, ga, mga, rga, clname, lagnname: lagnnameValue 
            });
          } else {
            console.warn("RefValidation Save - Invalid agent_id provided:", record.agent_id);
            resolvedAgentId = null;
          }
        } else if (record.lagnname) {
          // Fallback: look up by lagnname if no agent_id provided
          console.log("RefValidation Save - Looking up agent by lagnname:", record.lagnname);
          const agentQuery = `SELECT id, sa, ga, mga, rga, clname, lagnname FROM activeusers WHERE lagnname = ? AND Active = "y"`;
          const agentResult = await query(agentQuery, [record.lagnname]);
          
          if (agentResult.length > 0) {
            resolvedAgentId = agentResult[0].id;
            sa = agentResult[0].sa;
            ga = agentResult[0].ga;
            mga = agentResult[0].mga;
            rga = agentResult[0].rga;
            clname = agentResult[0].clname;
            lagnnameValue = agentResult[0].lagnname;
            
            console.log("RefValidation Save - Found agent by lagnname:", { 
              resolvedAgentId, sa, ga, mga, rga, clname, lagnname: lagnnameValue 
            });
          } else {
            console.warn("RefValidation Save - No active agent found for lagnname:", record.lagnname);
            resolvedAgentId = null;
          }
        } else {
          console.log("RefValidation Save - No agent_id or lagnname provided, agent_id will be NULL");
          resolvedAgentId = null;
        }
        
        const insertQuery = `
          INSERT INTO refvalidation 
          (true_ref, ref_detail, lagnname, agent_id, client_name, zip_code, 
           existing_policy, trial, date_app_checked, notes, admin_name, admin_id,
           sa, ga, mga, rga, clname) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await query(insertQuery, [
          record.true_ref, 
          record.ref_detail, 
          lagnnameValue, 
          resolvedAgentId, // Use the resolved agent_id from lagnname lookup
          record.client_name, 
          record.zip_code, 
          record.existing_policy, 
          record.trial,
          record.date_app_checked, 
          record.notes, 
          record.admin_name, 
          record.admin_id,
          sa, ga, mga, rga, clname
        ]);
        
        savedRecord = { ...record, id: result.insertId, uuid, agent_id: resolvedAgentId, sa, ga, mga, rga, clname };
        console.log("RefValidation Save - Created new record with ID:", result.insertId);
      }
      
      savedRows.push(savedRecord);
    }

    console.log("RefValidation Save - Returning response with", savedRows.length, "saved rows");
    res.json({ success: true, message: "Records saved successfully", savedRows });
  } catch (error) {
    console.error("RefValidation Save - Error:", error);
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