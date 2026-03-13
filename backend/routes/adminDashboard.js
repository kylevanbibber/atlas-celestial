const express = require("express");
const router = express.Router();
const { query } = require("../db");

// ALP Metrics - Previous month ALP, codes, hires, VIPs
router.get("/alp-metrics", async (req, res) => {
  try {
    // Get previous month
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthFormatted = prevMonth.toISOString().slice(0, 7); // YYYY-MM format

    // Previous month ALP count from sga_alp table
    const prevMonthAlpResult = await query(`
      SELECT COUNT(*) as count
      FROM sga_alp
      WHERE DATE_FORMAT(date, '%Y-%m') = ?
    `, [prevMonthFormatted]);

    // Codes count (from scorecard or relevant table)
    const codesResult = await query(`
      SELECT COUNT(*) as count
      FROM codes
      WHERE Active = 'y'
    `);

    // Hires count (from scorecard or relevant table)
    const hiresResult = await query(`
      SELECT COUNT(*) as count
      FROM hires
      WHERE Active = 'y'
    `);

    // VIPs count (from scorecard or relevant table)
    const vipsResult = await query(`
      SELECT COUNT(*) as count
      FROM vips
      WHERE Active = 'y'
    `);

    res.json({
      success: true,
      data: {
        prevMonthCount: prevMonthAlpResult[0]?.count || 0,
        codesCount: codesResult[0]?.count || 0,
        hiresCount: hiresResult[0]?.count || 0,
        vipsCount: vipsResult[0]?.count || 0
      }
    });
  } catch (error) {
    console.error("Error fetching ALP metrics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ALP metrics",
      error: error.message
    });
  }
});

// Verification Metrics - Pending, verified, discrepancy
router.get("/verification-metrics", async (req, res) => {
  try {
    // For now, return placeholder data
    // The verification component should provide the actual counts
    // This can be updated when the verification component is ready to provide counts
    
    res.json({
      success: true,
      data: {
        pending: 0,
        verified: 0,
        discrepancy: 0
      }
    });
  } catch (error) {
    console.error("Error fetching verification metrics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch verification metrics",
      error: error.message
    });
  }
});

// RefValidation Metrics - Blank true_ref count
router.get("/refvalidation-metrics", async (req, res) => {
  try {
    // Count records with blank true_ref
    const blankTrueRefResult = await query(`
      SELECT COUNT(*) as count
      FROM refvalidation
      WHERE true_ref IS NULL OR true_ref = '' OR true_ref = ' '
    `);

    res.json({
      success: true,
      data: {
        blankTrueRef: blankTrueRefResult[0]?.count || 0
      }
    });
  } catch (error) {
    console.error("Error fetching refvalidation metrics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch refvalidation metrics",
      error: error.message
    });
  }
});

module.exports = router; 