const express = require("express");
const router = express.Router();
const { query } = require("../db");

// Get verification counts for admin dashboard
router.get("/counts", async (req, res) => {
  try {
    // This endpoint should be called by the verification component
    // to provide the current counts of applications in each status
    
  
    // For now, we'll return placeholder data
    // The verification component should call this endpoint and provide the actual counts
    res.json({
      success: true,
      data: {
        pending: 0,
        verified: 0,
        discrepancy: 0
      }
    });
  } catch (error) {
    console.error("Error fetching verification counts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch verification counts",
      error: error.message
    });
  }
});

module.exports = router; 