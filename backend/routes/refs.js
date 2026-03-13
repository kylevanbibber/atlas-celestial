const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const { pool } = require("../db");

const STATE_NAME_TO_ABBR = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'district of columbia': 'DC',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL',
  'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA',
  'maine': 'ME', 'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
  'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR',
  'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA',
  'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'puerto rico': 'PR', 'guam': 'GU', 'virgin islands': 'VI', 'american samoa': 'AS',
};

function normalizeState(val) {
  if (!val) return val;
  const trimmed = String(val).trim();
  if (trimmed.length <= 2) return trimmed.toUpperCase();
  return STATE_NAME_TO_ABBR[trimmed.toLowerCase()] || trimmed;
}

// Get all refs with optional archive filter and server-side filtering
router.get("/", (req, res) => {
  const { archive, filter_mode, user_id, allowed_ids } = req.query;
  let sqlQuery = `
    SELECT refs.*,
           assigned_user.lagnname as assigned_to_display,
           created_user.lagnname as created_by_display
    FROM refs
    LEFT JOIN activeusers assigned_user ON refs.assigned_to = assigned_user.id
    LEFT JOIN activeusers created_user ON refs.created_by = created_user.id
  `;
  const conditions = [];
  const queryParams = [];

  if (archive !== undefined) {
    if (String(archive) === '0') {
      // Show non-archived: archive is 0 or NULL
      conditions.push("(refs.archive = 0 OR refs.archive IS NULL)");
    } else {
      conditions.push("refs.archive = ?");
      queryParams.push(archive);
    }
  }

  // Server-side filtering by user access level
  if (filter_mode === 'own' && user_id) {
    // AGT users: only see refs they are assigned to or created
    conditions.push("(refs.assigned_to = ? OR refs.created_by = ?)");
    queryParams.push(user_id, user_id);
  } else if (filter_mode === 'hierarchy' && allowed_ids) {
    // SA/GA/MGA/RGA users: see refs for anyone in their hierarchy
    const ids = allowed_ids.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ');
      conditions.push(`(refs.assigned_to IN (${placeholders}) OR refs.created_by IN (${placeholders}))`);
      queryParams.push(...ids, ...ids);
    }
  }
  // filter_mode === 'all' or undefined = no user filtering (admin/SGA)

  if (conditions.length > 0) {
    sqlQuery += " WHERE " + conditions.join(" AND ");
  }

  pool.query(sqlQuery, queryParams, (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }

    // Server-side overdue check: update refs with scheduled appointments 5+ hours overdue to "No Show"
    const now = new Date();
    const overdueIds = [];
    results.forEach(ref => {
      if (ref.scheduled && ref.status !== 'No Show') {
        try {
          let scheduledDate;
          if (typeof ref.scheduled === 'string') {
            if (ref.scheduled.match(/^\d{1,2}\/\d{1,2}\/\d{2} \d{1,2}:\d{2} [AP]M$/)) {
              const [datePart, timePart, period] = ref.scheduled.split(' ');
              const [month, day, year] = datePart.split('/');
              const fullYear = '20' + year;
              scheduledDate = new Date(`${month}/${day}/${fullYear} ${timePart} ${period}`);
            } else {
              scheduledDate = new Date(ref.scheduled);
            }
          } else {
            scheduledDate = new Date(ref.scheduled);
          }

          if (!isNaN(scheduledDate.getTime())) {
            const hoursOverdue = (now - scheduledDate) / (1000 * 60 * 60);
            if (hoursOverdue > 5) {
              overdueIds.push(ref.id);
              ref.status = 'No Show'; // Update in response data
            }
          }
        } catch (error) {
          // Skip refs with unparseable dates
        }
      }
    });

    // Batch update overdue refs in the database
    if (overdueIds.length > 0) {
      const placeholders = overdueIds.map(() => '?').join(', ');
      pool.query(
        `UPDATE refs SET status = 'No Show' WHERE id IN (${placeholders})`,
        overdueIds,
        (updateErr) => {
          if (updateErr) {
            console.error("Error updating overdue refs:", updateErr);
          }
        }
      );
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
    if (!fields.assigned_to) {
      fields.assigned_to = fields.userId;
    }
    if (!fields.created_by) {
      fields.created_by = fields.userId;
    }
    delete fields.userId;
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
  "date_created",
  "last_updated",
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
  "ref_relation",
  "type",
  "scheduled",
  "resstate"
];

// Update archive status for multiple refs — MUST be before /:id to avoid route capture
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

// Helper: parse ref scheduled date string (m/d/yy h:mm AM/PM) to a Date object
function parseRefDate(dateStr) {
  if (!dateStr || dateStr === 'null') return null;
  if (typeof dateStr === 'string' && dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2} \d{1,2}:\d{2} [AP]M$/)) {
    const [datePart, timePart, period] = dateStr.split(' ');
    const [month, day, year] = datePart.split('/');
    return new Date(`${month}/${day}/20${year} ${timePart} ${period}`);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// Helper: sync a ref's scheduled date to a calendar event
function syncRefCalendarEvent(refId, scheduledValue, assignedTo) {
  const externalId = `ref-${refId}`;

  if (!scheduledValue || scheduledValue === '' || scheduledValue === 'null') {
    // Scheduled was cleared — soft-delete the calendar event
    pool.query(
      `UPDATE calendar_events SET deleted_at = NOW() WHERE external_id = ? AND source = 'system' AND deleted_at IS NULL`,
      [externalId],
      (err) => { if (err) console.error('Error removing ref calendar event:', err); }
    );
    return;
  }

  const startDate = parseRefDate(scheduledValue);
  if (!startDate) return;

  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
  const startTime = startDate.toISOString().slice(0, 19).replace('T', ' ');
  const endTime = endDate.toISOString().slice(0, 19).replace('T', ' ');

  // Look up the ref name for the calendar event title
  pool.query('SELECT name, assigned_to FROM refs WHERE id = ?', [refId], (err, refRows) => {
    if (err || !refRows.length) return;
    const refName = refRows[0].name || 'Unnamed';
    const userId = assignedTo || refRows[0].assigned_to;
    if (!userId) return;

    const title = `Ref Appt: ${refName}`;

    // Check if a calendar event already exists
    pool.query(
      `SELECT id FROM calendar_events WHERE external_id = ? AND source = 'system' AND deleted_at IS NULL LIMIT 1`,
      [externalId],
      (err, existing) => {
        if (err) { console.error('Error checking ref calendar event:', err); return; }

        if (existing.length > 0) {
          // Update existing event
          pool.query(
            `UPDATE calendar_events SET title = ?, start_time = ?, end_time = ?, user_id = ? WHERE id = ?`,
            [title, startTime, endTime, userId, existing[0].id],
            (err) => { if (err) console.error('Error updating ref calendar event:', err); }
          );
        } else {
          // Create new event
          pool.query(
            `INSERT INTO calendar_events
              (user_id, title, start_time, end_time, all_day, event_type, color, visibility, source, external_id)
             VALUES (?, ?, ?, ?, 0, 'meeting', '#e67e22', 'private', 'system', ?)`,
            [userId, title, startTime, endTime, externalId],
            (err) => { if (err) console.error('Error creating ref calendar event:', err); }
          );
        }
      }
    );
  });
}

// Update a ref
router.put("/:id", (req, res) => {
  const refId = req.params.id;
  const fields = req.body;

  const fieldsToUpdate = Object.keys(fields).reduce((acc, key) => {
    if (allowedFields.includes(key)) {
      acc[key] = fields[key];
    }
    return acc;
  }, {});

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

    // Sync calendar event when scheduled field changes
    if (fieldsToUpdate.hasOwnProperty('scheduled')) {
      syncRefCalendarEvent(refId, fieldsToUpdate.scheduled, fieldsToUpdate.assigned_to);
    }

    res.json({ message: "Reference updated successfully!" });
  });
});

// Batch delete multiple refs
router.post("/batch-delete", (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Invalid input: ids array required." });
  }

  const numericIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
  if (numericIds.length === 0) {
    return res.status(400).json({ error: "No valid IDs provided." });
  }

  const placeholders = numericIds.map(() => "?").join(", ");
  pool.query(`DELETE FROM refs WHERE id IN (${placeholders})`, numericIds, (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }

    // Clean up associated calendar events
    const externalIds = numericIds.map(id => `ref-${id}`);
    const calPlaceholders = externalIds.map(() => "?").join(", ");
    pool.query(
      `UPDATE calendar_events SET deleted_at = NOW() WHERE external_id IN (${calPlaceholders}) AND source = 'system'`,
      externalIds,
      (cleanupErr) => { if (cleanupErr) console.error('Error cleaning up ref calendar events:', cleanupErr); }
    );

    res.json({ success: true, message: `${result.affectedRows} reference(s) deleted successfully.`, affectedRows: result.affectedRows });
  });
});

// Delete a ref
router.delete("/:id", (req, res) => {
  const refId = req.params.id;
  pool.query("DELETE FROM refs WHERE id = ?", [refId], (err) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }

    // Clean up associated calendar event
    const externalId = `ref-${refId}`;
    pool.query(
      `UPDATE calendar_events SET deleted_at = NOW() WHERE external_id = ? AND source = 'system'`,
      [externalId],
      (cleanupErr) => { if (cleanupErr) console.error('Error cleaning up ref calendar event:', cleanupErr); }
    );

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

      // Filter to only allowed fields
      const filteredData = data.map(row => {
        const filtered = {};
        Object.keys(row).forEach(key => {
          if (allowedFields.includes(key)) {
            filtered[key] = row[key];
          }
        });
        if (filtered.resstate) {
          filtered.resstate = normalizeState(filtered.resstate);
        }
        if (!filtered.date_created) {
          filtered.date_created = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }
        if (filtered.archive === undefined || filtered.archive === null) {
          filtered.archive = 0;
        }
        return filtered;
      });

      const keys = Object.keys(filteredData[0]);
      const placeholders = filteredData
        .map(() => "(" + keys.map(() => "?").join(", ") + ")")
        .join(", ");
      const values = [];
      filteredData.forEach((row) => {
        keys.forEach((key) => {
          values.push(row[key] !== undefined ? row[key] : null);
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
    const importedData = req.body;
    if (!Array.isArray(importedData) || importedData.length === 0) {
      return res.status(400).json({ error: "No valid data provided for import. Expected an array of objects." });
    }

    // Validate and filter only allowed fields
    const processedData = importedData.map((row) => {
      const processedRow = {};

      // Copy allowed fields from the import row
      Object.keys(row).forEach(key => {
        if (allowedFields.includes(key)) {
          processedRow[key] = row[key];
        }
      });

      // Add defaults for missing required fields
      if (!processedRow.created_by && processedRow.assigned_to) {
        processedRow.created_by = processedRow.assigned_to;
      }
      if (!processedRow.assigned_to && processedRow.created_by) {
        processedRow.assigned_to = processedRow.created_by;
      }
      if (!processedRow.date_created) {
        processedRow.date_created = new Date().toISOString().slice(0, 19).replace('T', ' ');
      }
      if (processedRow.resstate) {
        processedRow.resstate = normalizeState(processedRow.resstate);
      }
      if (!processedRow.status) {
        processedRow.status = 'New';
      }
      if (processedRow.archive === undefined || processedRow.archive === null) {
        processedRow.archive = 0;
      }

      return processedRow;
    });

    if (processedData.length === 0 || Object.keys(processedData[0]).length === 0) {
      return res.status(400).json({ error: "No valid fields found in import data." });
    }

    // Use a consistent key set from all rows to handle rows with different fields
    const allKeys = new Set();
    processedData.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));
    const keys = Array.from(allKeys);

    const placeholders = processedData
      .map(() => "(" + keys.map(() => "?").join(", ") + ")")
      .join(", ");
    const values = [];
    processedData.forEach((row) => {
      keys.forEach((key) => {
        values.push(row[key] !== undefined ? row[key] : null);
      });
    });

    const sqlQuery = `INSERT INTO refs (${keys.join(", ")}) VALUES ${placeholders}`;

    pool.query(sqlQuery, values, (err, result) => {
      if (err) {
        console.error("Database error during JSON import for refs:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        message: "References imported successfully from JSON!",
        inserted: result.affectedRows,
      });
    });
  } else {
    return res.status(400).json({ error: "No file or data provided for import." });
  }
});

module.exports = router;