// licensing.js
const express = require("express");
const router = express.Router();

// Import database connection
const { query } = require("../db");

// Import verifyToken middleware
const verifyToken = require("../middleware/verifyToken");

/* ----------------------
   License Management Routes
------------------------- */
// Get user licenses
router.get("/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    const licenses = await query(
      'SELECT * FROM licensed_states WHERE userId = ?',
      [userId]
    );
    
    res.json({
      success: true,
      licenses
    });
  } catch (error) {
    console.error("Error fetching user licenses:", error);
    res.status(500).json({ success: false, message: "Error fetching license data" });
  }
});

// Add new license
router.post("/", verifyToken, async (req, res) => {
  try {
    const { userId, lagnname, state, expiry_date, resident_state, license_number } = req.body;
    
    console.log(`[POST /licenses] Received request:`, { 
      userId, 
      state, 
      expiry_date, 
      resident_state,
      license_number: license_number ? `${license_number.substring(0, 3)}...` : null // Truncate for privacy
    });
    
    if (!userId || !state) {
      console.log(`[POST /licenses] Validation failed:`, { userId, state });
      return res.status(400).json({ 
        success: false, 
        message: "User ID and state are required" 
      });
    }
    
    // Format the expiry date to mm/dd/yyyy format for database storage
    let formattedExpiryDate = null;
    if (expiry_date) {
      console.log(`[POST /licenses] Processing expiry date: ${expiry_date}`);
      try {
        const date = new Date(expiry_date);
        if (!isNaN(date.getTime())) {
          // Format as mm/dd/yyyy
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          const year = date.getFullYear();
          formattedExpiryDate = `${month}/${day}/${year}`;
          console.log(`[POST /licenses] Converted date ${expiry_date} to ${formattedExpiryDate}`);
        } else {
          console.log(`[POST /licenses] Invalid date format received: ${expiry_date}`);
          formattedExpiryDate = expiry_date; // Use original if parsing fails
        }
      } catch (dateError) {
        console.warn(`[POST /licenses] Error formatting date: ${dateError.message}`);
        formattedExpiryDate = expiry_date; // Use original if parsing fails
      }
    }
    
    console.log(`[POST /licenses] Inserting license with date: ${formattedExpiryDate}`);
    const insertResult = await query(
      'INSERT INTO licensed_states (userId, lagnname, state, expiry_date, resident_state, license_number) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, lagnname || null, state, formattedExpiryDate, resident_state || 0, license_number || null]
    );
    
    if (insertResult.affectedRows === 0) {
      console.log(`[POST /licenses] Insert failed, no rows affected`);
      return res.status(500).json({ success: false, message: "Failed to add license" });
    }
    
    console.log(`[POST /licenses] License added successfully with ID: ${insertResult.insertId}`);
    res.json({
      success: true,
      message: "License added successfully",
      licenseId: insertResult.insertId
    });
  } catch (error) {
    console.error(`[POST /licenses] Error adding license:`, error);
    res.status(500).json({ success: false, message: "Error adding license" });
  }
});

// Update existing license
router.put("/:licenseId", verifyToken, async (req, res) => {
  try {
    const { licenseId } = req.params;
    const { lagnname, state, expiry_date, resident_state, license_number } = req.body;
    
    console.log(`[PUT /licenses/${licenseId}] Received update request:`, { 
      licenseId,
      state, 
      expiry_date, 
      resident_state,
      license_number: license_number ? `${license_number.substring(0, 3)}...` : null // Truncate for privacy
    });
    
    if (!licenseId) {
      console.log(`[PUT /licenses] No licenseId provided`);
      return res.status(400).json({ success: false, message: "License ID is required" });
    }
    
    // Build update query dynamically based on provided fields
    let updateFields = [];
    const updateValues = [];
    
    if (lagnname !== undefined) {
      updateFields.push('lagnname = ?');
      updateValues.push(lagnname);
    }
    
    if (state !== undefined) {
      updateFields.push('state = ?');
      updateValues.push(state);
    }
    
    if (expiry_date !== undefined) {
      console.log(`[PUT /licenses/${licenseId}] Processing expiry date: ${expiry_date}`);
      
      // Format the expiry date to mm/dd/yyyy format for database storage
      let formattedExpiryDate = expiry_date;
      try {
        if (expiry_date) {
          const date = new Date(expiry_date);
          if (!isNaN(date.getTime())) {
            // Format as mm/dd/yyyy
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const year = date.getFullYear();
            formattedExpiryDate = `${month}/${day}/${year}`;
            console.log(`[PUT /licenses/${licenseId}] Converted date ${expiry_date} to ${formattedExpiryDate}`);
          } else {
            console.log(`[PUT /licenses/${licenseId}] Invalid date format received: ${expiry_date}`);
          }
        }
      } catch (dateError) {
        console.warn(`[PUT /licenses/${licenseId}] Error formatting date:`, dateError);
        // Use original if parsing fails
      }
      
      updateFields.push('expiry_date = ?');
      updateValues.push(formattedExpiryDate);
    }
    
    if (resident_state !== undefined) {
      updateFields.push('resident_state = ?');
      updateValues.push(resident_state ? 1 : 0);
    }
    
    if (license_number !== undefined) {
      updateFields.push('license_number = ?');
      updateValues.push(license_number || null);
    }
    
    // If no fields to update, return error
    if (updateFields.length === 0) {
      console.log(`[PUT /licenses/${licenseId}] No fields to update`);
      return res.status(400).json({ success: false, message: "No license information provided to update" });
    }
    
    // Add licenseId to values array for WHERE clause
    updateValues.push(licenseId);
    
    // Execute update query
    const updateQuery = `UPDATE licensed_states SET ${updateFields.join(', ')} WHERE id = ?`;
    console.log(`[PUT /licenses/${licenseId}] Executing update with fields: ${updateFields.join(', ')}`);
    
    const updateResult = await query(updateQuery, updateValues);
    
    if (updateResult.affectedRows === 0) {
      console.log(`[PUT /licenses/${licenseId}] Update failed, no rows affected`);
      return res.status(500).json({ success: false, message: "Failed to update license information" });
    }
    
    // Get updated license data
    const license = await query(
      'SELECT * FROM licensed_states WHERE id = ?',
      [licenseId]
    );
    
    if (license.length > 0) {
      console.log(`[PUT /licenses/${licenseId}] License updated successfully, stored expiry_date: ${license[0].expiry_date}`);
    }
    
    // Return success with updated license data
    res.json({
      success: true,
      message: "License updated successfully",
      license: license[0]
    });
  } catch (error) {
    console.error(`[PUT /licenses/${licenseId}] Error updating license:`, error);
    res.status(500).json({ success: false, message: "Error updating license" });
  }
});

// Delete license
router.delete("/:licenseId", verifyToken, async (req, res) => {
  try {
    const { licenseId } = req.params;
    
    if (!licenseId) {
      return res.status(400).json({ success: false, message: "License ID is required" });
    }
    
    const deleteResult = await query(
      'DELETE FROM licensed_states WHERE id = ?',
      [licenseId]
    );
    
    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "License not found or already deleted" });
    }
    
    res.json({
      success: true,
      message: "License deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting license:", error);
    res.status(500).json({ success: false, message: "Error deleting license" });
  }
});

module.exports = router; 