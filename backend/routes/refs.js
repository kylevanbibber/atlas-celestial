const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const { pool } = require("../db");

// Get all refs with optional archive filter
router.get("/", (req, res) => {
  const { archive } = req.query;
  let sqlQuery = `
    SELECT refs.*, userinfo.first_name, userinfo.last_name, userinfo.chip_color, userinfo.active
    FROM refs
    LEFT JOIN userinfo ON refs.assigned_to = userinfo.id
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
    SELECT refs.*, userinfo.first_name, userinfo.last_name 
    FROM refs
    LEFT JOIN userinfo ON refs.assigned_to = userinfo.id
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
  "type",
  "scheduled"
];

// Update a ref
router.put("/:id", (req, res) => {
  const refId = req.params.id;
  const fields = req.body;
  
  console.log('PUT /refs/:id called with:', { refId, fields });

  // Ensure date fields are in the correct format
  if (fields.date_created) {
    console.log('Processing date_created:', fields.date_created);
    fields.date_created = fields.date_created; // Keep as is since it's already formatted
  }
  if (fields.last_updated) {
    console.log('Processing last_updated:', fields.last_updated);
    fields.last_updated = fields.last_updated; // Keep as is since it's already formatted
  }
  if (fields.scheduled) {
    console.log('Processing scheduled:', fields.scheduled);
    fields.scheduled = fields.scheduled; // Keep as is since it's already formatted
  }

  const fieldsToUpdate = Object.keys(fields).reduce((acc, key) => {
    if (allowedFields.includes(key)) {
      acc[key] = fields[key];
    } else {
      console.log('Field not in allowedFields:', key);
    }
    return acc;
  }, {});

  console.log('Fields to update:', fieldsToUpdate);

  if (Object.keys(fieldsToUpdate).length === 0) {
    console.log('No valid fields provided for update');
    return res.status(400).json({ error: "No valid fields provided for update." });
  }

  const updateKeys = Object.keys(fieldsToUpdate);
  const updateValues = Object.values(fieldsToUpdate);

  const setClause = updateKeys.map((key) => `${key} = ?`).join(", ");
  const sqlQuery = `UPDATE refs SET ${setClause} WHERE id = ?`;
  
  console.log('SQL Query:', sqlQuery);
  console.log('Query values:', [...updateValues, refId]);

  pool.query(sqlQuery, [...updateValues, refId], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }

    if (result.affectedRows === 0) {
      console.log('No rows affected - reference not found');
      return res.status(404).json({ error: "Reference not found." });
    }

    console.log('Update successful, rows affected:', result.affectedRows);
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
  console.log("POST /refs/import called.");

  if (req.file) {
    console.log("File uploaded. Processing file for refs table.");
    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      console.log("Using sheet:", sheetName);
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      console.log("Parsed data:", data);

      if (data.length === 0) {
        console.warn("File is empty or invalid for refs table");
        return res.status(400).json({ error: "File is empty or invalid." });
      }

      const keys = Object.keys(data[0]);
      console.log("Detected columns:", keys);
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
      console.log("SQL Query:", sqlQuery);
      console.log("Values length:", values.length);

      pool.query(sqlQuery, values, (err, result) => {
        if (err) {
          console.error("Database error during file import for refs:", err);
          return res.status(500).json({ error: err.message });
        }
        console.log("File data imported successfully into refs table. Inserted rows:", result.affectedRows);
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
    console.log("JSON data received for import into refs table");
    const importedData = req.body;
    if (!Array.isArray(importedData) || importedData.length === 0) {
      console.warn("No valid JSON data provided for refs table");
      return res.status(400).json({ error: "No valid data provided for import." });
    }
    const keys = Object.keys(importedData[0]);
    console.log("Detected JSON columns:", keys);
    const placeholders = importedData
      .map(() => "(" + keys.map(() => "?").join(", ") + ")")
      .join(", ");
    const values = [];
    importedData.forEach((row) => {
      keys.forEach((key) => {
        values.push(row[key]);
      });
    });
    const sqlQuery = `INSERT INTO refs (${keys.join(", ")}) VALUES ${placeholders}`;
    console.log("SQL Query for JSON import:", sqlQuery);
    pool.query(sqlQuery, values, (err, result) => {
      if (err) {
        console.error("Database error during JSON import for refs:", err);
        return res.status(500).json({ error: err.message });
      }
      console.log("JSON data imported successfully into refs table. Inserted rows:", result.affectedRows);
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