const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// Get all date overrides
router.get("/", (req, res) => {
  const sqlQuery = `
    SELECT 
      do.id,
      do.year,
      do.month,
      do.start_date,
      do.end_date,
      do.schedule_type,
      do.created_at,
      do.updated_at,
      au.lagnname as created_by_name
    FROM date_overrides do
    LEFT JOIN activeusers au ON do.created_by = au.id
    ORDER BY do.year DESC, do.month ASC
  `;
  
  pool.query(sqlQuery, (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Get date override for specific year/month
router.get("/:year/:month", (req, res) => {
  const { year, month } = req.params;
  
  const sqlQuery = `
    SELECT 
      do.id,
      do.year,
      do.month,
      do.start_date,
      do.end_date,
      do.schedule_type,
      do.created_at,
      do.updated_at,
      au.lagnname as created_by_name
    FROM date_overrides do
    LEFT JOIN activeusers au ON do.created_by = au.id
    WHERE do.year = ? AND do.month = ?
  `;
  
  pool.query(sqlQuery, [year, month], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: "Date override not found" });
    }
    
    res.json(results[0]);
  });
});

// Create new date override
router.post("/", (req, res) => {
  const { year, month, start_date, end_date, schedule_type, created_by } = req.body;
  
  if (!year || !month || !start_date || !end_date) {
    return res.status(400).json({ 
      error: "Year, month, start_date, and end_date are required" 
    });
  }
  
  // Validate that start_date is before end_date
  if (new Date(start_date) >= new Date(end_date)) {
    return res.status(400).json({ 
      error: "Start date must be before end date" 
    });
  }
  
  // Validate month is between 1-12
  if (month < 1 || month > 12) {
    return res.status(400).json({ 
      error: "Month must be between 1 and 12" 
    });
  }
  
  // Validate schedule_type
  const validScheduleTypes = ['mon-sun', 'wed-tue'];
  const finalScheduleType = schedule_type && validScheduleTypes.includes(schedule_type) 
    ? schedule_type 
    : 'mon-sun'; // Default to mon-sun if not provided or invalid
  
  const sqlQuery = `
    INSERT INTO date_overrides (year, month, start_date, end_date, schedule_type, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  pool.query(sqlQuery, [year, month, start_date, end_date, finalScheduleType, created_by], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ 
          error: `Date override already exists for ${year}/${month}` 
        });
      }
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    
    res.status(201).json({ 
      id: result.insertId, 
      message: "Date override created successfully!" 
    });
  });
});

// Update existing date override
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { year, month, start_date, end_date, schedule_type } = req.body;
  
  if (!year || !month || !start_date || !end_date) {
    return res.status(400).json({ 
      error: "Year, month, start_date, and end_date are required" 
    });
  }
  
  // Validate that start_date is before end_date
  if (new Date(start_date) >= new Date(end_date)) {
    return res.status(400).json({ 
      error: "Start date must be before end date" 
    });
  }
  
  // Validate month is between 1-12
  if (month < 1 || month > 12) {
    return res.status(400).json({ 
      error: "Month must be between 1 and 12" 
    });
  }
  
  // Validate schedule_type
  const validScheduleTypes = ['mon-sun', 'wed-tue'];
  const finalScheduleType = schedule_type && validScheduleTypes.includes(schedule_type) 
    ? schedule_type 
    : 'mon-sun'; // Default to mon-sun if not provided or invalid
  
  const sqlQuery = `
    UPDATE date_overrides 
    SET year = ?, month = ?, start_date = ?, end_date = ?, schedule_type = ?
    WHERE id = ?
  `;
  
  pool.query(sqlQuery, [year, month, start_date, end_date, finalScheduleType, id], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ 
          error: `Date override already exists for ${year}/${month}` 
        });
      }
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Date override not found" });
    }
    
    res.json({ message: "Date override updated successfully!" });
  });
});

// Delete date override
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  
  const sqlQuery = "DELETE FROM date_overrides WHERE id = ?";
  
  pool.query(sqlQuery, [id], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Date override not found" });
    }
    
    res.json({ message: "Date override deleted successfully!" });
  });
});

// Get all years that have date overrides (for dropdown selection)
router.get("/years/available", (req, res) => {
  const sqlQuery = `
    SELECT DISTINCT year 
    FROM date_overrides 
    ORDER BY year DESC
  `;
  
  pool.query(sqlQuery, (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    
    const years = results.map(row => row.year);
    res.json(years);
  });
});

module.exports = router;
