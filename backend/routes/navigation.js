const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyToken = require("../middleware/verifyToken");

// Log a page visit
router.post("/log", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { path, label } = req.body;

    if (!path) {
      return res.status(400).json({ success: false, message: "Path is required" });
    }

    // Upsert: insert or update visit count
    const query = `
      INSERT INTO user_navigation_history (userId, path, label, visitCount, lastVisited)
      VALUES (?, ?, ?, 1, NOW())
      ON DUPLICATE KEY UPDATE 
        visitCount = visitCount + 1,
        lastVisited = NOW(),
        label = COALESCE(VALUES(label), label)
    `;

    await db.query(query, [userId, path, label || null]);

    res.json({ success: true });
  } catch (error) {
    console.error("Error logging navigation:", error);
    res.status(500).json({ success: false, message: "Failed to log navigation" });
  }
});

// Get user's recent and recommended pages
router.get("/recommendations", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get recent pages (last 5 unique pages visited)
    const recentQuery = `
      SELECT path, label, lastVisited
      FROM user_navigation_history
      WHERE userId = ?
      ORDER BY lastVisited DESC
      LIMIT 5
    `;

    // Get most frequently visited pages (top 5 by visit count)
    const frequentQuery = `
      SELECT path, label, visitCount
      FROM user_navigation_history
      WHERE userId = ?
      ORDER BY visitCount DESC
      LIMIT 5
    `;

    const recentResults = await db.query(recentQuery, [userId]);
    const frequentResults = await db.query(frequentQuery, [userId]);

    res.json({
      success: true,
      recent: Array.isArray(recentResults) ? recentResults : [],
      frequent: Array.isArray(frequentResults) ? frequentResults : []
    });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({ success: false, message: "Failed to fetch recommendations" });
  }
});

// Clear user's navigation history (optional - for privacy)
router.delete("/history", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    await db.query("DELETE FROM user_navigation_history WHERE userId = ?", [userId]);

    res.json({ success: true, message: "Navigation history cleared" });
  } catch (error) {
    console.error("Error clearing navigation history:", error);
    res.status(500).json({ success: false, message: "Failed to clear history" });
  }
});

// Log a search query
router.post("/search", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { query } = req.body;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Query too short" });
    }

    const trimmedQuery = query.trim().toLowerCase();

    // Upsert: insert or update search count
    const sql = `
      INSERT INTO user_search_history (userId, query, searchCount, lastSearched)
      VALUES (?, ?, 1, NOW())
      ON DUPLICATE KEY UPDATE 
        searchCount = searchCount + 1,
        lastSearched = NOW()
    `;

    await db.query(sql, [userId, trimmedQuery]);

    res.json({ success: true });
  } catch (error) {
    console.error("Error logging search:", error);
    res.status(500).json({ success: false, message: "Failed to log search" });
  }
});

// Get user's recent searches
router.get("/searches", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const searchQuery = `
      SELECT query, lastSearched
      FROM user_search_history
      WHERE userId = ?
      ORDER BY lastSearched DESC
      LIMIT 5
    `;

    const results = await db.query(searchQuery, [userId]);

    res.json({
      success: true,
      searches: Array.isArray(results) ? results : []
    });
  } catch (error) {
    console.error("Error fetching searches:", error);
    res.status(500).json({ success: false, message: "Failed to fetch searches" });
  }
});

// Clear user's search history
router.delete("/searches", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    await db.query("DELETE FROM user_search_history WHERE userId = ?", [userId]);

    res.json({ success: true, message: "Search history cleared" });
  } catch (error) {
    console.error("Error clearing search history:", error);
    res.status(500).json({ success: false, message: "Failed to clear search history" });
  }
});

module.exports = router;

