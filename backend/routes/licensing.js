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
// Get all licensed states (for admin/management use)
router.get("/", verifyToken, async (req, res) => {
  try {
    const licenses = await query('SELECT * FROM licensed_states');
    
    res.json({
      success: true,
      licenses
    });
  } catch (error) {
    console.error('Error fetching all license data:', error);
    res.status(500).json({ success: false, message: "Error fetching license data" });
  }
});

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

    res.status(500).json({ success: false, message: "Error fetching license data" });
  }
});

// Add new license
router.post("/", verifyToken, async (req, res) => {
  try {
    const { userId, lagnname, state, expiry_date, resident_state, license_number } = req.body;
    

    
    if (!userId || !state) {

      return res.status(400).json({ 
        success: false, 
        message: "User ID and state are required" 
      });
    }
    
    // Format the expiry date to mm/dd/yyyy format for database storage
    let formattedExpiryDate = null;
    if (expiry_date) {

      try {
        const date = new Date(expiry_date);
        if (!isNaN(date.getTime())) {
          // Format as mm/dd/yyyy
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          const year = date.getFullYear();
          formattedExpiryDate = `${month}/${day}/${year}`;

        } else {

          formattedExpiryDate = expiry_date; // Use original if parsing fails
        }
      } catch (dateError) {

        formattedExpiryDate = expiry_date; // Use original if parsing fails
      }
    }
    

    const insertResult = await query(
      'INSERT INTO licensed_states (userId, lagnname, state, expiry_date, resident_state, license_number) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, lagnname || null, state, formattedExpiryDate, resident_state || 0, license_number || null]
    );
    
    if (insertResult.affectedRows === 0) {

      return res.status(500).json({ success: false, message: "Failed to add license" });
    }
    

    res.json({
      success: true,
      message: "License added successfully",
      licenseId: insertResult.insertId
    });
  } catch (error) {

    res.status(500).json({ success: false, message: "Error adding license" });
  }
});

// Update existing license
router.put("/:licenseId", verifyToken, async (req, res) => {
  try {
    const { licenseId } = req.params;
    const { lagnname, state, expiry_date, resident_state, license_number } = req.body;
    

    
    if (!licenseId) {

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

          } else {

          }
        }
      } catch (dateError) {

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

      return res.status(400).json({ success: false, message: "No license information provided to update" });
    }
    
    // Add licenseId to values array for WHERE clause
    updateValues.push(licenseId);
    
    // Execute update query
    const updateQuery = `UPDATE licensed_states SET ${updateFields.join(', ')} WHERE id = ?`;

    
    const updateResult = await query(updateQuery, updateValues);
    
    if (updateResult.affectedRows === 0) {

      return res.status(500).json({ success: false, message: "Failed to update license information" });
    }
    
    // Get updated license data
    const license = await query(
      'SELECT * FROM licensed_states WHERE id = ?',
      [licenseId]
    );
    
    if (license.length > 0) {

    }
    
    // Return success with updated license data
    res.json({
      success: true,
      message: "License updated successfully",
      license: license[0]
    });
  } catch (error) {

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

    res.status(500).json({ success: false, message: "Error deleting license" });
  }
});

module.exports = router; 