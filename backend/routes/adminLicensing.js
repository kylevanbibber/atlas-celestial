const express = require("express");
const router = express.Router();
const { query } = require("../db");

// Get all licenses
router.get("/all", async (req, res) => {
  try {
    const result = await query(`
      SELECT id, userId, lagnname, state, expiry_date, resident_state, license_number
      FROM licensed_states
      ORDER BY id DESC
    `);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error fetching licenses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch licenses",
      error: error.message
    });
  }
});

// Save license (create or update)
router.post("/save", async (req, res) => {
  try {
    const licenses = Array.isArray(req.body) ? req.body : [req.body];
    const results = [];

    for (const license of licenses) {
      const { id, userId, lagnname, state, expiry_date, resident_state, license_number } = license;

      if (id) {
        // Update existing license
        const result = await query(`
          UPDATE licensed_states
          SET userId = ?, lagnname = ?, state = ?, expiry_date = ?, 
              resident_state = ?, license_number = ?
          WHERE id = ?
        `, [userId, lagnname, state, expiry_date, resident_state, license_number, id]);

        results.push({ id, success: true });
      } else {
        // Create new license
        const result = await query(`
          INSERT INTO licensed_states 
          (userId, lagnname, state, expiry_date, resident_state, license_number)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [userId, lagnname, state, expiry_date, resident_state, license_number]);

        results.push({ id: result.insertId, success: true });
      }
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error("Error saving license:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save license",
      error: error.message
    });
  }
});

// Delete license
router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      DELETE FROM licensed_states
      WHERE id = ?
    `, [id]);

    if (result.affectedRows > 0) {
      res.json({
        success: true,
        message: "License deleted successfully"
      });
    } else {
      res.status(404).json({
        success: false,
        message: "License not found"
      });
    }
  } catch (error) {
    console.error("Error deleting license:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete license",
      error: error.message
    });
  }
});

module.exports = router; 