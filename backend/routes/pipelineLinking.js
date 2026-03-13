const express = require('express');
const router = express.Router();
const { query: db } = require('../db');
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
 * Helper function to format lagnname from pipeline recruit data
 * Format: LAST FIRST MIDDLE SUFFIX
 */
function formatLagnname(recruit) {
  const parts = [
    recruit.recruit_last?.trim() || '',
    recruit.recruit_first?.trim() || '',
    recruit.recruit_middle?.trim() || '',
    recruit.recruit_suffix?.trim() || ''
  ].filter(Boolean);
  
  return parts.join(' ').toUpperCase();
}

/**
 * Auto-link pipeline records to activeusers based on lagnname and mga
 * GET /api/pipeline-linking/auto-link-all
 */
router.get('/auto-link-all', optionalAuth, async (req, res) => {
  try {
    console.log('🔗 Starting auto-link process for pipeline → activeusers');
    
    // Get all pipeline records that don't have a linked activeuser
    const unlinkedPipeline = await db(`
      SELECT p.id, p.recruit_first, p.recruit_last, p.recruit_middle, p.recruit_suffix, p.MGA
      FROM pipeline p
      WHERE NOT EXISTS (
        SELECT 1 FROM activeusers a WHERE a.pipeline_id = p.id
      )
    `);
    
    console.log(`📋 Found ${unlinkedPipeline.length} unlinked pipeline records`);
    
    let linkedCount = 0;
    let errorCount = 0;
    const results = [];
    
    for (const recruit of unlinkedPipeline) {
      try {
        const lagnname = formatLagnname(recruit);
        
        // Try to find matching activeuser by lagnname
        const matchingUsers = await db(`
          SELECT id, lagnname, mga
          FROM activeusers
          WHERE UPPER(TRIM(lagnname)) = ?
          AND (? IS NULL OR UPPER(TRIM(mga)) = UPPER(TRIM(?)))
          AND pipeline_id IS NULL
          LIMIT 1
        `, [lagnname, recruit.MGA, recruit.MGA]);
        
        if (matchingUsers.length > 0) {
          const activeuser = matchingUsers[0];
          
          // Link them together
          await db(`
            UPDATE activeusers
            SET pipeline_id = ?
            WHERE id = ?
          `, [recruit.id, activeuser.id]);
          
          linkedCount++;
          results.push({
            pipeline_id: recruit.id,
            activeuser_id: activeuser.id,
            lagnname: lagnname,
            status: 'linked'
          });
          
          console.log(`✅ Linked: ${lagnname} (Pipeline ID: ${recruit.id} → ActiveUser ID: ${activeuser.id})`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error linking recruit ${recruit.id}:`, error.message);
        results.push({
          pipeline_id: recruit.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log(`✅ Auto-link complete: ${linkedCount} linked, ${errorCount} errors`);
    
    res.json({
      success: true,
      message: `Auto-linked ${linkedCount} records`,
      linkedCount,
      errorCount,
      results
    });
  } catch (error) {
    console.error('❌ Error in auto-link-all:', error);
    res.status(500).json({
      success: false,
      message: 'Error during auto-linking',
      error: error.message
    });
  }
});

/**
 * Manually link a specific pipeline record to an activeuser
 * POST /api/pipeline-linking/link
 * Body: { pipeline_id, activeuser_id }
 */
router.post('/link', verifyToken, async (req, res) => {
  try {
    const { pipeline_id, activeuser_id } = req.body;
    
    if (!pipeline_id || !activeuser_id) {
      return res.status(400).json({
        success: false,
        message: 'pipeline_id and activeuser_id are required'
      });
    }
    
    // Check if activeuser already has a pipeline_id
    const existingLink = await db(`
      SELECT pipeline_id, lagnname
      FROM activeusers
      WHERE id = ?
    `, [activeuser_id]);
    
    if (existingLink.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ActiveUser not found'
      });
    }
    
    if (existingLink[0].pipeline_id && existingLink[0].pipeline_id !== pipeline_id) {
      return res.status(400).json({
        success: false,
        message: `ActiveUser is already linked to pipeline record ${existingLink[0].pipeline_id}`
      });
    }
    
    // Link them
    await db(`
      UPDATE activeusers
      SET pipeline_id = ?
      WHERE id = ?
    `, [pipeline_id, activeuser_id]);
    
    console.log(`✅ Manually linked: Pipeline ${pipeline_id} → ActiveUser ${activeuser_id}`);
    
    res.json({
      success: true,
      message: 'Successfully linked pipeline record to activeuser',
      pipeline_id,
      activeuser_id
    });
  } catch (error) {
    console.error('❌ Error in manual link:', error);
    res.status(500).json({
      success: false,
      message: 'Error linking records',
      error: error.message
    });
  }
});

/**
 * Unlink a pipeline record from an activeuser
 * POST /api/pipeline-linking/unlink
 * Body: { activeuser_id }
 */
router.post('/unlink', verifyToken, async (req, res) => {
  try {
    const { activeuser_id } = req.body;
    
    if (!activeuser_id) {
      return res.status(400).json({
        success: false,
        message: 'activeuser_id is required'
      });
    }
    
    await db(`
      UPDATE activeusers
      SET pipeline_id = NULL
      WHERE id = ?
    `, [activeuser_id]);
    
    console.log(`✅ Unlinked: ActiveUser ${activeuser_id}`);
    
    res.json({
      success: true,
      message: 'Successfully unlinked'
    });
  } catch (error) {
    console.error('❌ Error in unlink:', error);
    res.status(500).json({
      success: false,
      message: 'Error unlinking records',
      error: error.message
    });
  }
});

/**
 * Get linked status for a pipeline record
 * GET /api/pipeline-linking/status/:pipeline_id
 */
router.get('/status/:pipeline_id', verifyToken, async (req, res) => {
  try {
    const { pipeline_id } = req.params;
    
    const linked = await db(`
      SELECT a.id as activeuser_id, a.lagnname, a.esid, a.mga, a.agtnum
      FROM activeusers a
      WHERE a.pipeline_id = ?
    `, [pipeline_id]);
    
    res.json({
      success: true,
      isLinked: linked.length > 0,
      activeuser: linked[0] || null
    });
  } catch (error) {
    console.error('❌ Error checking link status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking link status',
      error: error.message
    });
  }
});

/**
 * Search for potential activeuser matches for a pipeline record
 * GET /api/pipeline-linking/search-matches/:pipeline_id
 */
router.get('/search-matches/:pipeline_id', verifyToken, async (req, res) => {
  try {
    const { pipeline_id } = req.params;
    
    // Get pipeline record
    const pipeline = await db(`
      SELECT id, recruit_first, recruit_last, recruit_middle, recruit_suffix, MGA
      FROM pipeline
      WHERE id = ?
    `, [pipeline_id]);
    
    if (pipeline.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pipeline record not found'
      });
    }
    
    const recruit = pipeline[0];
    const lagnname = formatLagnname(recruit);
    
    // Search for potential matches
    const matches = await db(`
      SELECT id, lagnname, mga, esid, agtnum, pipeline_id
      FROM activeusers
      WHERE (
        UPPER(TRIM(lagnname)) = ?
        OR lagnname LIKE ?
      )
      AND (? IS NULL OR UPPER(TRIM(mga)) = UPPER(TRIM(?)))
      ORDER BY 
        CASE WHEN pipeline_id IS NULL THEN 0 ELSE 1 END,
        CASE WHEN UPPER(TRIM(lagnname)) = ? THEN 0 ELSE 1 END
      LIMIT 10
    `, [lagnname, `%${recruit.recruit_last}%`, recruit.MGA, recruit.MGA, lagnname]);
    
    res.json({
      success: true,
      recruit: {
        id: recruit.id,
        name: lagnname,
        mga: recruit.MGA
      },
      matches
    });
  } catch (error) {
    console.error('❌ Error searching matches:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching for matches',
      error: error.message
    });
  }
});

module.exports = router;

