const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * Get all custom videos for the current user
 * GET /api/careers-videos
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    // Check for impersonation header first, fall back to token userId
    const impersonatedUserId = req.headers['x-impersonated-user-id'];
    const tokenUserId = req.user?.userId || req.user?.id;
    const userId = impersonatedUserId || tokenUserId;
    
    console.log('🎬 [GET /careers-videos] Token User ID:', tokenUserId, 'Impersonated:', impersonatedUserId, 'Using:', userId);
    
    const videos = await db.query(`
      SELECT 
        cv.*,
        au.lagnname as manager_name
      FROM careers_custom_videos cv
      LEFT JOIN activeusers au ON cv.manager_id = au.id
      WHERE cv.manager_id = ? AND cv.is_active = 1
      ORDER BY cv.target_mga IS NULL ASC, cv.target_mga ASC
    `, [userId]);
    
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Error fetching custom videos:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch custom videos' });
  }
});

/**
 * Get available MGA teams for the current user
 * GET /api/careers-videos/available-teams
 */
router.get('/available-teams', verifyToken, async (req, res) => {
  try {
    // Check for impersonation header first, fall back to token userId
    const impersonatedUserId = req.headers['x-impersonated-user-id'];
    const tokenUserId = req.user?.userId || req.user?.id;
    const userId = impersonatedUserId || tokenUserId;
    
    console.log('🎬 [GET /available-teams] Token User ID:', tokenUserId, 'Impersonated:', impersonatedUserId, 'Using:', userId);
    
    // Get user's info
    const userResult = await db.query(`
      SELECT lagnname, clname FROM activeusers WHERE id = ?
    `, [userId]);
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = userResult[0];
    let teams = [];
    
    // RGA can set for RGA-level, Tree-level, or MGA-level
    if (user.clname === 'RGA') {
      // Helper function to recursively trace up the hierarchy to find the tree
      const findTree = async (lagnname, visited = new Set()) => {
        // Prevent infinite loops
        if (visited.has(lagnname)) {
          return null;
        }
        visited.add(lagnname);
        
        // Look up this person in activeusers
        const result = await db.query(`
          SELECT mga, rga FROM activeusers WHERE lagnname = ? LIMIT 1
        `, [lagnname]);
        
        if (!result || result.length === 0) {
          // Not found, this person is likely the tree/top
          return lagnname;
        }
        
        const row = result[0];
        
        // If both are null, this person is the tree/top
        if (!row.mga && !row.rga) {
          return lagnname;
        }
        
        // Try RGA first (higher in hierarchy)
        if (row.rga) {
          return await findTree(row.rga, visited);
        }
        
        // Then try MGA
        if (row.mga) {
          return await findTree(row.mga, visited);
        }
        
        return lagnname;
      };
      
      // Find this RGA's tree by tracing up the hierarchy
      const treeName = await findTree(user.lagnname);
      
      console.log('🌳 Found tree for', user.lagnname, ':', treeName);
      
      // Add exactly 3 options for RGAs: Tree, RGA, MGA
      if (treeName) {
        teams.push({
          value: `TREE:${treeName}`,
          label: `Tree`,
          type: 'TREE'
        });
      }
      
      teams.push({
        value: `RGA:${user.lagnname}`,
        label: `RGA`,
        type: 'RGA'
      });
      
      teams.push({
        value: `MGA:${user.lagnname}`,
        label: `MGA`,
        type: 'MGA'
      });
    }
    // MGA and GA can only set for themselves
    else if (user.clname === 'MGA') {
      teams = [{
        value: `MGA:${user.lagnname}`,
        label: `MGA`,
        type: 'MGA'
      }];
    }
    else if (user.clname === 'GA') {
      teams = [{
        value: user.lagnname,
        label: `GA`,
        type: 'GA'
      }];
    }
    
    res.json({ success: true, teams, userClname: user.clname });
  } catch (error) {
    console.error('Error fetching available teams:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch available teams' });
  }
});

/**
 * Create a new custom video
 * POST /api/careers-videos
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    // Check for impersonation header first, fall back to token userId
    const impersonatedUserId = req.headers['x-impersonated-user-id'];
    const tokenUserId = req.user?.userId || req.user?.id;
    const userId = impersonatedUserId || tokenUserId;
    const { target_mga, video_url, video_type } = req.body;
    
    console.log('🎬 [POST /careers-videos] Token User ID:', tokenUserId, 'Impersonated:', impersonatedUserId, 'Using:', userId);
    console.log('🎬 [POST /careers-videos] Request body:', { target_mga, video_url, video_type });
    
    if (!video_url) {
      return res.status(400).json({ success: false, error: 'Video URL is required' });
    }
    
    // Validate video type
    if (video_type && !['youtube', 'vimeo'].includes(video_type)) {
      return res.status(400).json({ success: false, error: 'Invalid video type' });
    }
    
    // Get user info
    const userResult = await db.query(`
      SELECT lagnname, clname FROM activeusers WHERE id = ?
    `, [userId]);
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = userResult[0];
    
    // Check if entry already exists
    const existing = await db.query(`
      SELECT id FROM careers_custom_videos
      WHERE manager_id = ? AND target_mga <=> ?
    `, [userId, target_mga || null]);
    
    if (existing && existing.length > 0) {
      // Update existing
      await db.query(`
        UPDATE careers_custom_videos
        SET video_url = ?, video_type = ?, updated_at = NOW()
        WHERE id = ?
      `, [video_url, video_type || 'youtube', existing[0].id]);
      
      const updated = await db.query(`
        SELECT * FROM careers_custom_videos WHERE id = ?
      `, [existing[0].id]);
      
      console.log('✅ [POST /careers-videos] Video updated successfully:', updated[0]);
      
      res.json({ success: true, video: updated[0], action: 'updated' });
    } else {
      // Insert new
      const result = await db.query(`
        INSERT INTO careers_custom_videos 
        (manager_id, manager_lagnname, manager_clname, target_mga, video_url, video_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [userId, user.lagnname, user.clname, target_mga || null, video_url, video_type || 'youtube']);
      
      const inserted = await db.query(`
        SELECT * FROM careers_custom_videos WHERE id = ?
      `, [result.insertId]);
      
      console.log('✅ [POST /careers-videos] Video created successfully:', inserted[0]);
      
      res.json({ success: true, video: inserted[0], action: 'created' });
    }
  } catch (error) {
    console.error('Error creating custom video:', error);
    res.status(500).json({ success: false, error: 'Failed to create custom video' });
  }
});

/**
 * Delete a custom video
 * DELETE /api/careers-videos/:id
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    // Check for impersonation header first, fall back to token userId
    const impersonatedUserId = req.headers['x-impersonated-user-id'];
    const tokenUserId = req.user?.userId || req.user?.id;
    const userId = impersonatedUserId || tokenUserId;
    const { id } = req.params;
    
    console.log('🎬 [DELETE /careers-videos/:id] Token User ID:', tokenUserId, 'Impersonated:', impersonatedUserId, 'Using:', userId, 'Deleting video ID:', id);
    
    // Verify ownership
    const video = await db.query(`
      SELECT * FROM careers_custom_videos WHERE id = ? AND manager_id = ?
    `, [id, userId]);
    
    if (!video || video.length === 0) {
      return res.status(404).json({ success: false, error: 'Video not found or access denied' });
    }
    
    await db.query(`
      DELETE FROM careers_custom_videos WHERE id = ?
    `, [id]);
    
    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom video:', error);
    res.status(500).json({ success: false, error: 'Failed to delete custom video' });
  }
});

/**
 * Get the appropriate video for a given affiliate link / agent
 * GET /api/careers-videos/for-affiliate/:affiliateCode
 * 
 * Priority: GA > MGA > RGA
 * Public endpoint - no authentication required
 */
router.get('/for-affiliate/:affiliateCode', async (req, res) => {
  try {
    const { affiliateCode } = req.params;
    
    console.log('🎥 Fetching video for affiliate code:', affiliateCode);
    
    // Find the agent by ID and get their hierarchy from activeusers table
    const agentResult = await db.query(`
      SELECT 
        au.id,
        au.lagnname,
        au.clname,
        au.ga,
        au.mga,
        au.rga
      FROM activeusers au
      WHERE au.id = ?
      LIMIT 1
    `, [affiliateCode]);
    
    if (!agentResult || agentResult.length === 0) {
      console.log('❌ Agent not found for affiliate code:', affiliateCode);
      return res.json({ success: true, video: null, message: 'Agent not found' });
    }
    
    const agent = agentResult[0];
    console.log('✅ Found agent:', agent.lagnname, 'clname:', agent.clname);
    console.log('📊 Hierarchy from activeusers:', { ga: agent.ga, mga: agent.mga, rga: agent.rga });
    
    // Priority order: Self, GA, MGA, RGA
    // HIGHEST PRIORITY: Check if the user themselves has a video
    console.log('🔍 Checking for video by user themselves (manager_id):', agent.id);
    const selfVideo = await db.query(`
      SELECT * FROM careers_custom_videos
      WHERE manager_id = ? AND is_active = 1
      LIMIT 1
    `, [agent.id]);
    
    if (selfVideo && selfVideo.length > 0) {
      console.log('✅ Found video set by user themselves');
      return res.json({ 
        success: true, 
        video: selfVideo[0],
        source: 'Self',
        source_name: agent.lagnname
      });
    }
    
    // Check GA (second priority)
    if (agent.ga) {
      console.log('🔍 Checking GA videos for:', agent.ga);
      const gaVideo = await db.query(`
        SELECT * FROM careers_custom_videos
        WHERE manager_lagnname = ? AND manager_clname = 'GA' AND is_active = 1
        ORDER BY target_mga IS NULL DESC
        LIMIT 1
      `, [agent.ga]);
      
      if (gaVideo && gaVideo.length > 0) {
        console.log('✅ Found GA video');
        return res.json({ 
          success: true, 
          video: gaVideo[0],
          source: 'GA',
          source_name: agent.ga
        });
      }
    }
    
    // Check MGA (third priority)
    if (agent.mga) {
      console.log('🔍 Checking MGA videos for:', agent.mga);
      
      // Check for specific MGA targeting
      const mgaSpecificVideo = await db.query(`
        SELECT * FROM careers_custom_videos
        WHERE manager_lagnname = ? AND manager_clname = 'MGA' AND target_mga = ? AND is_active = 1
        LIMIT 1
      `, [agent.mga, `MGA:${agent.mga}`]);
      
      if (mgaSpecificVideo && mgaSpecificVideo.length > 0) {
        console.log('✅ Found MGA-specific video');
        return res.json({ 
          success: true, 
          video: mgaSpecificVideo[0],
          source: 'MGA-Specific',
          source_name: agent.mga
        });
      }
      
      // Check for general MGA video (NULL target_mga)
      const generalMgaVideo = await db.query(`
        SELECT * FROM careers_custom_videos
        WHERE manager_lagnname = ? AND manager_clname = 'MGA' AND target_mga IS NULL AND is_active = 1
        LIMIT 1
      `, [agent.mga]);
      
      if (generalMgaVideo && generalMgaVideo.length > 0) {
        console.log('✅ Found general MGA video');
        return res.json({ 
          success: true, 
          video: generalMgaVideo[0],
          source: 'MGA',
          source_name: agent.mga
        });
      }
    }
    
    // Check for videos from anyone in the hierarchy (RGA/MGA/Tree levels)
    // Helper function to recursively trace up the hierarchy to find the tree
    const findTree = async (lagnname, visited = new Set()) => {
      if (visited.has(lagnname)) {
        return null;
      }
      visited.add(lagnname);
      
      const result = await db.query(`
        SELECT mga, rga FROM activeusers WHERE lagnname = ? LIMIT 1
      `, [lagnname]);
      
      if (!result || result.length === 0) {
        return lagnname;
      }
      
      const row = result[0];
      
      if (!row.mga && !row.rga) {
        return lagnname;
      }
      
      if (row.rga) {
        return await findTree(row.rga, visited);
      }
      
      if (row.mga) {
        return await findTree(row.mga, visited);
      }
      
      return lagnname;
    };
    
    // Trace up to find the tree
    const agentTree = await findTree(agent.lagnname);
    console.log('🌳 Agent tree (traced):', agentTree);
    
    // Check for Tree-level video (highest specificity)
    if (agentTree) {
      const treeLevelVideo = await db.query(`
        SELECT * FROM careers_custom_videos
        WHERE target_mga = ? AND is_active = 1
        LIMIT 1
      `, [`TREE:${agentTree}`]);
      
      if (treeLevelVideo && treeLevelVideo.length > 0) {
        console.log('✅ Found Tree-level video');
        return res.json({ 
          success: true, 
          video: treeLevelVideo[0],
          source: 'Tree-Level',
          source_name: agentTree
        });
      }
    }
    
    // Check for RGA-level video (agent has this lagnname in their mga OR rga column)
    if (agent.rga) {
      console.log('🔍 Checking RGA-level video for:', agent.rga);
      const rgaLevelVideo = await db.query(`
        SELECT * FROM careers_custom_videos
        WHERE target_mga = ? AND is_active = 1
        LIMIT 1
      `, [`RGA:${agent.rga}`]);
      
      if (rgaLevelVideo && rgaLevelVideo.length > 0) {
        console.log('✅ Found RGA-level video');
        return res.json({ 
          success: true, 
          video: rgaLevelVideo[0],
          source: 'RGA-Level',
          source_name: agent.rga
        });
      }
    }
    
    // Also check if agent has someone in their MGA column who set an RGA-level video
    if (agent.mga) {
      console.log('🔍 Checking RGA-level video for MGA:', agent.mga);
      const mgaAsRgaVideo = await db.query(`
        SELECT * FROM careers_custom_videos
        WHERE target_mga = ? AND is_active = 1
        LIMIT 1
      `, [`RGA:${agent.mga}`]);
      
      if (mgaAsRgaVideo && mgaAsRgaVideo.length > 0) {
        console.log('✅ Found RGA-level video from MGA');
        return res.json({ 
          success: true, 
          video: mgaAsRgaVideo[0],
          source: 'RGA-Level',
          source_name: agent.mga
        });
      }
    }
    
    // Check for MGA-level video (agent has this lagnname in their mga column)
    if (agent.mga) {
      console.log('🔍 Checking MGA-level video for:', agent.mga);
      const mgaLevelVideo = await db.query(`
        SELECT * FROM careers_custom_videos
        WHERE target_mga = ? AND is_active = 1
        LIMIT 1
      `, [`MGA:${agent.mga}`]);
      
      if (mgaLevelVideo && mgaLevelVideo.length > 0) {
        console.log('✅ Found MGA-level video');
        return res.json({ 
          success: true, 
          video: mgaLevelVideo[0],
          source: 'MGA-Level',
          source_name: agent.mga
        });
      }
    }
    
    // Check for general videos (NULL target_mga)
    if (agent.rga) {
      const generalRgaVideo = await db.query(`
        SELECT * FROM careers_custom_videos
        WHERE manager_lagnname = ? AND target_mga IS NULL AND is_active = 1
        LIMIT 1
      `, [agent.rga]);
      
      if (generalRgaVideo && generalRgaVideo.length > 0) {
        console.log('✅ Found general video from RGA');
        return res.json({ 
          success: true, 
          video: generalRgaVideo[0],
          source: 'General',
          source_name: agent.rga
        });
      }
    }
    
    if (agent.mga) {
      const generalMgaVideo = await db.query(`
        SELECT * FROM careers_custom_videos
        WHERE manager_lagnname = ? AND target_mga IS NULL AND is_active = 1
        LIMIT 1
      `, [agent.mga]);
      
      if (generalMgaVideo && generalMgaVideo.length > 0) {
        console.log('✅ Found general video from MGA');
        return res.json({ 
          success: true, 
          video: generalMgaVideo[0],
          source: 'General',
          source_name: agent.mga
        });
      }
    }
    
    // No custom video found
    console.log('ℹ️ No custom video configured for this agent');
    res.json({ success: true, video: null, message: 'No custom video configured' });
  } catch (error) {
    console.error('❌ Error fetching video for affiliate:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, error: 'Failed to fetch video', details: error.message });
  }
});

module.exports = router;

