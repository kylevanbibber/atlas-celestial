const express = require('express');
const router = express.Router();
const { query: dbQuery } = require('../db');
const verifyToken = require('../middleware/verifyToken');

/**
 * Middleware to optionally verify token (allows internal service calls)
 * Skips authentication for requests from localhost
 */
const optionalAuth = (req, res, next) => {
  const isLocalhost = req.ip === '127.0.0.1' || 
                      req.ip === '::1' || 
                      req.ip === '::ffff:127.0.0.1' ||
                      req.hostname === 'localhost';
  
  if (isLocalhost) {
    // Skip authentication for internal calls
    return next();
  }
  
  // Otherwise require authentication
  return verifyToken(req, res, next);
};

/**
 * Get all MGAs that count towards an RGA's numbers
 * Includes:
 * 1. Direct MGAs (where MGAs.rga = rga_lagnname)
 * 2. First-year MGAs that roll up through another MGA
 * 
 * Business Rule: An MGA's numbers count for their direct RGA for their first full year,
 * even if they're multiple levels removed.
 */
router.get('/rga-rollup/:rgaLagnname', optionalAuth, async (req, res) => {
  try {
    const { rgaLagnname } = req.params;
    
    if (!rgaLagnname) {
      return res.status(400).json({ success: false, message: 'RGA lagnname required' });
    }

    // Get all MGAs with their start dates and RGA
    const allMGAs = await dbQuery(`
      SELECT lagnname, rga, start 
      FROM MGAs 
      WHERE Active = 'y'
    `);

    // Find direct MGAs under this RGA
    const directMGAs = allMGAs.filter(m => 
      String(m.rga || '').toLowerCase() === String(rgaLagnname).toLowerCase()
    );

    // Calculate first-year cutoff (1 year from start date)
    const now = new Date();
    const firstYearMGAs = [];

    for (const mga of allMGAs) {
      if (!mga.start) continue;

      const startDate = new Date(mga.start);
      const oneYearLater = new Date(startDate);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

      // Check if MGA is in their first year
      const isFirstYear = now >= startDate && now < oneYearLater;

      if (isFirstYear) {
        // Check if this MGA rolls up to any of our direct MGAs
        const uplineRGA = String(mga.rga || '').toLowerCase();
        const rollsUpToDirectMGA = directMGAs.some(dm => 
          String(dm.lagnname || '').toLowerCase() === uplineRGA
        );

        if (rollsUpToDirectMGA) {
          firstYearMGAs.push({
            ...mga,
            isFirstYear: true,
            rollupReason: 'first_year_indirect'
          });
        }
      }
    }

    // Combine direct MGAs and first-year MGAs
    const allIncludedMGAs = [
      ...directMGAs.map(m => ({ ...m, isFirstYear: false, rollupReason: 'direct' })),
      ...firstYearMGAs
    ];

    // Remove duplicates by lagnname
    const uniqueMGAs = Array.from(
      new Map(allIncludedMGAs.map(m => [String(m.lagnname).toLowerCase(), m])).values()
    );

    res.json({
      success: true,
      data: {
        rgaLagnname,
        totalMGAs: uniqueMGAs.length,
        directMGAs: directMGAs.length,
        firstYearMGAs: firstYearMGAs.length,
        mgas: uniqueMGAs
      }
    });

  } catch (error) {
    console.error('[mgaHierarchy] Error in rga-rollup:', error);
    res.status(500).json({ success: false, message: 'Error calculating RGA rollup' });
  }
});

module.exports = router;

