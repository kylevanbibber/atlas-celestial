// routes/vips.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");

router.get("/", (req, res) => {
  pool.query("SELECT * FROM vips_table", (err, results) => {
    if (err) {
      console.error("Error fetching vips data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

module.exports = router;
