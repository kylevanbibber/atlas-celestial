const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const { pool } = require("../db");

// Get all refs with optional archive filter
router.get("/", (req, res) => {
  const { archive } = req.query;
  let sqlQuery = `
    SELECT refs.*, 
           assigned_user.lagnname as assigned_to_display,
           created_user.lagnname as created_by_display
    FROM refs
    LEFT JOIN activeusers assigned_user ON refs.assigned_to = assigned_user.id
    LEFT JOIN activeusers created_user ON refs.created_by = created_user.id
  `;
  const queryParams = [];

  if (archive !== undefined) {
    sqlQuery += " WHERE refs.archive = ?";
    queryParams.push(archive);
  }

  pool.query(sqlQuery, queryParams, (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Get a single ref by ID
router.get("/:id", (req, res) => {
  const sqlQuery = `
    SELECT refs.*, 
           assigned_user.lagnname as assigned_to_display,
           created_user.lagnname as created_by_display
    FROM refs
    LEFT JOIN activeusers assigned_user ON refs.assigned_to = assigned_user.id
    LEFT JOIN activeusers created_user ON refs.created_by = created_user.id
    WHERE refs.id = ?
  `;
  pool.query(sqlQuery, [req.params.id], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Reference not found" });
    }
    res.json(results[0]);
  });
});

// Create a new ref
router.post("/", (req, res) => {
  const fields = req.body;

  if (!fields || Object.keys(fields).length === 0) {
    return res.status(400).json({ error: "No data provided for reference creation." });
  }

  // Handle potential userId field mapping (defensive programming)
  if (fields.userId !== undefined) {
    // If assigned_to is missing but userId is present, use userId for assigned_to
    if (!fields.assigned_to) {
      fields.assigned_to = fields.userId;
    }
    
    // If created_by is missing but userId is present, use userId for created_by  
    if (!fields.created_by) {
      fields.created_by = fields.userId;
    }
    
    // Remove the invalid userId field
    delete fields.userId;
  }

  // Ensure date fields are in the correct format
  if (fields.date_created) {
    fields.date_created = fields.date_created; // Keep as is since it's already formatted
  }
  if (fields.last_updated) {
    fields.last_updated = fields.last_updated; // Keep as is since it's already formatted
  }

  const keys = Object.keys(fields);
  const values = Object.values(fields);

  const sqlQuery = `INSERT INTO refs (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;

  pool.query(sqlQuery, values, (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: result.insertId, message: "Reference created successfully!" });
  });
});

// Define allowed fields for the refs table
const allowedFields = [
  "name",
  "company",
  "email",
  "phone",
  "status",
  "source",
  "industry",
  "assigned_to",
  "created_at",
  "updated_at",
  "street",
  "city",
  "state",
  "zip",
  "country",
  "last_contacted",
  "follow_up_date",
  "notes",
  "account_id",
  "vip",
  "domain",
  "linkedin",
  "role_title",
  "department",
  "linkedin_bio",
  "more_linkedin_info",
  "custom_email_draft",
  "cold_call_script_voicemail",
  "archive",
  "company_id",
  "created_by",
  "referred_by",
  "type",
  "scheduled",
  "resstate"
];

// Update a ref
router.put("/:id", (req, res) => {
  const refId = req.params.id;
  const fields = req.body;
  

  // Ensure date fields are in the correct format
  if (fields.date_created) {
    fields.date_created = fields.date_created; // Keep as is since it's already formatted
  }
  if (fields.last_updated) {
    fields.last_updated = fields.last_updated; // Keep as is since it's already formatted
  }
  if (fields.scheduled) {
    fields.scheduled = fields.scheduled; // Keep as is since it's already formatted
  }

  const fieldsToUpdate = Object.keys(fields).reduce((acc, key) => {
    if (allowedFields.includes(key)) {
      acc[key] = fields[key];
    } else {
      console.log(`🔍 [DEBUG] Field '${key}' is not allowed for update. Skipping.`);
    }
    return acc;
  }, {});

  console.log(`🔍 [DEBUG] Fields to update for ref ${refId}:`, JSON.stringify(fieldsToUpdate, null, 2));


  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({ error: "No valid fields provided for update." });
  }

  const updateKeys = Object.keys(fieldsToUpdate);
  const updateValues = Object.values(fieldsToUpdate);

  const setClause = updateKeys.map((key) => `${key} = ?`).join(", ");
  const sqlQuery = `UPDATE refs SET ${setClause} WHERE id = ?`;
  

  pool.query(sqlQuery, [...updateValues, refId], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Reference not found." });
    }

    res.json({ message: "Reference updated successfully!" });
  });
});

// Delete a ref
router.delete("/:id", (req, res) => {
  pool.query("DELETE FROM refs WHERE id = ?", [req.params.id], (err) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: "Reference deleted successfully!" });
  });
});

// Import refs from Excel/CSV
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
});

router.post("/import", upload.single("file"), (req, res) => {

  if (req.file) {
    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (data.length === 0) {
        console.warn("File is empty or invalid for refs table");
        return res.status(400).json({ error: "File is empty or invalid." });
      }

      const keys = Object.keys(data[0]);
      const placeholders = data
        .map(() => "(" + keys.map(() => "?").join(", ") + ")")
        .join(", ");
      const values = [];
      data.forEach((row) => {
        keys.forEach((key) => {
          values.push(row[key]);
        });
      });
      const sqlQuery = `INSERT INTO refs (${keys.join(", ")}) VALUES ${placeholders}`;

      pool.query(sqlQuery, values, (err, result) => {
        if (err) {
          console.error("Database error during file import for refs:", err);
          return res.status(500).json({ error: err.message });
        }
        res.json({
          message: "References imported successfully from file!",
          inserted: result.affectedRows,
        });
      });
    } catch (error) {
      console.error("Error processing file import for refs:", error);
      return res.status(500).json({ error: error.message });
    }
  } else if (req.body && Object.keys(req.body).length > 0) {
    console.log("Import request received - body type:", typeof req.body);
    console.log("Import request body:", JSON.stringify(req.body, null, 2));
    
    const importedData = req.body;
    if (!Array.isArray(importedData) || importedData.length === 0) {
      console.warn("No valid JSON data provided for refs table");
      console.log("Data is array?", Array.isArray(importedData));
      console.log("Data length:", importedData?.length);
      return res.status(400).json({ error: "No valid data provided for import. Expected an array of objects." });
    }
    
    console.log(`Processing ${importedData.length} rows for import`);
    console.log("First row keys:", Object.keys(importedData[0]));
    
    // Validate and filter only allowed fields
    const processedData = importedData.map((row, index) => {
      const processedRow = {};
      
      // Add required fields if missing
      if (!row.created_by && row.assigned_to) {
        processedRow.created_by = row.assigned_to;
      }
      if (!row.assigned_to && row.created_by) {
        processedRow.assigned_to = row.created_by;
      }
      
      // Add date fields if missing
      if (!row.date_created) {
        processedRow.date_created = new Date().toISOString().slice(0, 19).replace('T', ' ');
      }
      
      // Filter only allowed fields
      Object.keys(row).forEach(key => {
        if (allowedFields.includes(key)) {
          processedRow[key] = row[key];
        } else {
          console.log(`Skipping field '${key}' for row ${index} - not in allowed fields`);
        }
      });
      
      return processedRow;
    });
    
    console.log("Processed data sample:", JSON.stringify(processedData[0], null, 2));
    
    const keys = Object.keys(processedData[0]);
    const placeholders = processedData
      .map(() => "(" + keys.map(() => "?").join(", ") + ")")
      .join(", ");
    const values = [];
    processedData.forEach((row) => {
      keys.forEach((key) => {
        values.push(row[key] || null);
      });
    });
    
    const sqlQuery = `INSERT INTO refs (${keys.join(", ")}) VALUES ${placeholders}`;
    console.log("SQL Query:", sqlQuery);
    console.log("Values count:", values.length);
    
    pool.query(sqlQuery, values, (err, result) => {
      if (err) {
        console.error("Database error during JSON import for refs:", err);
        console.error("SQL Query that failed:", sqlQuery);
        console.error("Values that failed:", values);
        return res.status(500).json({ error: err.message });
      }
      console.log(`Successfully imported ${result.affectedRows} references`);
      res.json({
        message: "References imported successfully from JSON!",
        inserted: result.affectedRows,
      });
    });
  } else {
    console.warn("No file or JSON data provided for refs table");
    return res.status(400).json({ error: "No file or data provided for import." });
  }
});

// Update archive status for multiple refs
router.put("/updateArchive", (req, res) => {
  const { ids, archiveValue } = req.body;

  if (!Array.isArray(ids) || ids.length === 0 || (archiveValue !== 0 && archiveValue !== 1)) {
    return res.status(400).json({ error: "Invalid input data." });
  }

  const placeholders = ids.map(() => "?").join(", ");
  const sqlQuery = `UPDATE refs SET archive = ? WHERE id IN (${placeholders})`;
  const values = [archiveValue, ...ids];

  pool.query(sqlQuery, values, (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: "References updated successfully!", affectedRows: result.affectedRows });
  });
});

module.exports = router; 