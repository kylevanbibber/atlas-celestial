// routes/account.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { query } = require("../db");

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log("[Account Route] Fetching profile for userId:", userId);

    const results = await query("SELECT * FROM activeusers WHERE id = ? LIMIT 1", [userId]);
    console.log("[Account Route] Query results:", results);

    if (!results || results.length === 0) {
      console.log("[Account Route] No user found for userId:", userId);
      return res.status(404).json({ success: false, message: "User not found." });
    }
    console.log("[Account Route] User found, sending profile.");
    res.json(results[0]);
  } catch (error) {
    console.error("[Account Route] Error fetching user profile:", error);
    res.status(500).json({ success: false, message: "Error fetching profile." });
  }
});

module.exports = router;
