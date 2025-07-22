const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const { query } = require('../db');

// Get all users from activeusers table
router.get('/getAllUsers', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log('[Admin] Getting all users from activeusers');
    
    const users = await query(`
      SELECT id, lagnname, clname, email, managerActive, Active 
      FROM activeusers 
      ORDER BY clname, lagnname
    `);
    
    console.log(`[Admin] Found ${users.length} users`);
    
    return res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('[Admin] Error getting all users:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving users',
      error: error.message
    });
  }
});

// Get hierarchy for a specific user - for admin view
router.get('/getUserHierarchy/:userId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    console.log(`[Admin] Getting hierarchy for user ID: ${userId}`);
    
    // First, get the user's details to determine their position in the hierarchy
    const userResult = await query(`
      SELECT id, lagnname, clname, mga, sa, ga, rga
      FROM activeusers
      WHERE id = ?
    `, [userId]);
    
    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult[0];
    console.log(`[Admin] Found user: ${user.lagnname} (${user.clname})`);
    
    // Get the user's hierarchy based on their role
    let hierarchyData = [];
    
    // For RGA/MGA, get their entire downline
    if (user.clname === 'RGA' || user.clname === 'MGA') {
      hierarchyData = await query(`
        SELECT a.*, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON a.lagnname = l.lagnname
        WHERE a.mga = ? OR a.lagnname = ?
        GROUP BY a.lagnname
      `, [user.lagnname, user.lagnname]);
    }
    // For GA, get them and their downline
    else if (user.clname === 'GA') {
      hierarchyData = await query(`
        SELECT a.*, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON a.lagnname = l.lagnname
        WHERE a.ga = ? OR a.lagnname = ?
        GROUP BY a.lagnname
      `, [user.lagnname, user.lagnname]);
    }
    // For SA, get them and their downline
    else if (user.clname === 'SA') {
      hierarchyData = await query(`
        SELECT a.*, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON a.lagnname = l.lagnname
        WHERE a.sa = ? OR a.lagnname = ?
        GROUP BY a.lagnname
      `, [user.lagnname, user.lagnname]);
    }
    // For AGT, just get them and their upline for context
    else {
      // Get the agent and their upline chain
      const agentData = await query(`
        SELECT a.*, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON a.lagnname = l.lagnname
        WHERE a.lagnname = ?
        GROUP BY a.lagnname
      `, [user.lagnname]);
      
      const uplineData = [];
      
      // Add SA if present
      if (user.sa) {
        const saData = await query(`
          SELECT a.*, GROUP_CONCAT(l.state) AS license_states
          FROM activeusers a
          LEFT JOIN licenses l ON a.lagnname = l.lagnname
          WHERE a.lagnname = ?
          GROUP BY a.lagnname
        `, [user.sa]);
        
        if (saData.length > 0) {
          uplineData.push(saData[0]);
        }
      }
      
      // Add GA if present
      if (user.ga) {
        const gaData = await query(`
          SELECT a.*, GROUP_CONCAT(l.state) AS license_states
          FROM activeusers a
          LEFT JOIN licenses l ON a.lagnname = l.lagnname
          WHERE a.lagnname = ?
          GROUP BY a.lagnname
        `, [user.ga]);
        
        if (gaData.length > 0) {
          uplineData.push(gaData[0]);
        }
      }
      
      // Add MGA if present
      if (user.mga) {
        const mgaData = await query(`
          SELECT a.*, GROUP_CONCAT(l.state) AS license_states
          FROM activeusers a
          LEFT JOIN licenses l ON a.lagnname = l.lagnname
          WHERE a.lagnname = ?
          GROUP BY a.lagnname
        `, [user.mga]);
        
        if (mgaData.length > 0) {
          uplineData.push(mgaData[0]);
        }
      }
      
      // Add RGA if present
      if (user.rga) {
        const rgaData = await query(`
          SELECT a.*, GROUP_CONCAT(l.state) AS license_states
          FROM activeusers a
          LEFT JOIN licenses l ON a.lagnname = l.lagnname
          WHERE a.lagnname = ?
          GROUP BY a.lagnname
        `, [user.rga]);
        
        if (rgaData.length > 0) {
          uplineData.push(rgaData[0]);
        }
      }
      
      hierarchyData = [...agentData, ...uplineData];
    }
    
    // Process license data
    hierarchyData = hierarchyData.map(user => {
      // Process license states if available
      let licenses = [];
      if (user.license_states) {
        const states = user.license_states.split(',');
        states.forEach(state => {
          if (state && state.trim()) {
            licenses.push({ state: state.trim() });
          }
        });
      }
      
      return {
        ...user,
        licenses,
        license_states: undefined // Remove the concatenated string
      };
    });
    
    console.log(`[Admin] Found ${hierarchyData.length} users in hierarchy`);
    
    return res.json({
      success: true,
      data: hierarchyData
    });
  } catch (error) {
    console.error('[Admin] Error getting user hierarchy:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving user hierarchy',
      error: error.message
    });
  }
});

/* ----------------------
   Admin Auth Check Route (for debugging)
------------------------- */
router.get("/check-admin", verifyToken, async (req, res) => {
  console.log('[check-admin] Request received. Checking admin status without admin verification middleware');
  
  try {
    // Log the incoming token and decoded user information
    console.log('[check-admin] User from token:', {
      userId: req.user.userId,
      role: req.user.Role,
      clname: req.user.clname
    });
    
    // Check admin status manually
    const isAdmin = 
      req.user.Role === 'Admin' || 
      req.user.Role === 'admin' || 
      req.user.Role === 'superadmin' || 
      req.user.Role === 'SuperAdmin';
    
    // Return detailed information about the user's admin status
    return res.json({
      success: true,
      isAdmin: isAdmin,
      userDetails: {
        userId: req.user.userId,
        role: req.user.Role,
        clname: req.user.clname
      },
      message: isAdmin 
        ? 'User has admin permission' 
        : 'User does not have admin permission'
    });
  } catch (error) {
    console.error('[check-admin] Error checking admin status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking admin status',
      error: error.message
    });
  }
});

/* ----------------------
   Get All RGAs Hierarchy Route (Admin)
------------------------- */
router.get("/getAllRGAsHierarchy", verifyToken, verifyAdmin, async (req, res) => {
  
  try {
    // Step 1: Get all RGAs from the activeusers table
    const rgaResults = await query(
      `SELECT id, lagnname FROM activeusers WHERE clname = 'RGA' AND Active = 'y' ORDER BY lagnname`
    );
    
    if (rgaResults.length === 0) {
      return res.json({ success: true, data: [], rgaCount: 0 });
    }

    // Optimization 1: Get all MGAs in a single query instead of per RGA
    const allRgaNames = rgaResults.map(rga => rga.lagnname);
    const rgaNamesPlaceholders = allRgaNames.map(() => "?").join(", ");
    
    const allMgasQuery = `SELECT lagnname, rga, legacy, tree 
                         FROM MGAs 
                         WHERE rga IN (${rgaNamesPlaceholders}) 
                            OR legacy IN (${rgaNamesPlaceholders}) 
                            OR tree IN (${rgaNamesPlaceholders})`;
    
    const allMgaResults = await query(allMgasQuery, [
      ...allRgaNames,
      ...allRgaNames,
      ...allRgaNames
    ]);
    
    // Create a map for quick lookups of MGAs by RGA
    const mgasByRga = {};
    allRgaNames.forEach(rgaName => {
      mgasByRga[rgaName] = [];
    });
    
    allMgaResults.forEach(mga => {
      if (mga.rga && allRgaNames.includes(mga.rga)) {
        mgasByRga[mga.rga].push(mga.lagnname);
      }
      if (mga.legacy && allRgaNames.includes(mga.legacy)) {
        mgasByRga[mga.legacy].push(mga.lagnname);
      }
      if (mga.tree && allRgaNames.includes(mga.tree)) {
        mgasByRga[mga.tree].push(mga.lagnname);
      }
    });
    
    // Step 2: Prepare and execute the main query for all hierarchies at once
    // Optimization 2: Increase batch size
    const batchSize = 10;
    const allHierarchyData = [];
    
    for (let i = 0; i < rgaResults.length; i += batchSize) {
      const batch = rgaResults.slice(i, i + batchSize);
      const batchPromises = batch.map(async (rga) => {
        try {
          const rgaName = rga.lagnname;
          let lagnnameList = [rgaName, ...mgasByRga[rgaName]];
          
          // Deduplicate the list
          lagnnameList = [...new Set(lagnnameList)];
          
          // Prepare query
          const placeholders = lagnnameList.map(() => "?").join(", ");
          
          // Optimization 3: Simplify and optimize the query
          const queryText = `
            SELECT 
                au.id,
                au.lagnname, 
                au.rept_name, 
                au.clname,
                au.Active,
                au.managerActive,
                au.redeemed,
                au.released,
                au.pending,
                au.profpic,
                au.phone,
                au.esid,
                COALESCE(main_ui.email, '') AS email, 
                au.sa, 
                au.ga, 
                au.mga, 
                au.rga,
                mga_data.legacy AS legacy_link,
                mga_data.tree AS tree_link,
                mga_data.rga AS mga_rga_link,
                JSON_OBJECT(
                  'rga', au.rga,
                  'mga_lagnname', au.mga,
                  'mga_rga', mga_rel.rga,
                  'mga_legacy', mga_rel.legacy,
                  'mga_tree', mga_rel.tree
                ) AS relationship_data,
                lic.licenses,
                pnp_data.pnp_data
            FROM activeusers au
            LEFT JOIN usersinfo main_ui ON au.lagnname = main_ui.lagnname AND au.esid = main_ui.esid
            LEFT JOIN MGAs mga_data ON au.lagnname = mga_data.lagnname
            LEFT JOIN MGAs mga_rel ON au.mga = mga_rel.lagnname
            
            /* Optimization 4: Use subqueries for licenses and pnp data to improve join performance */
            LEFT JOIN (
              SELECT 
                userId,
                JSON_ARRAYAGG(
                  JSON_OBJECT(
                    'id', id,
                    'state', state,
                    'license_number', license_number,
                    'expiry_date', expiry_date,
                    'resident_state', resident_state
                  )
                ) AS licenses
              FROM licensed_states
              GROUP BY userId
            ) AS lic ON lic.userId = au.id
            
            LEFT JOIN (
              SELECT 
                name_line,
                esid,
                JSON_OBJECT(
                  'curr_mo_4mo_rate', MIN(curr_mo_4mo_rate),
                  'proj_plus_1', MIN(proj_plus_1),
                  'pnp_date', MIN(date),
                  'agent_num', MIN(agent_num)
                ) AS pnp_data
              FROM pnp
              GROUP BY name_line, esid
            ) AS pnp_data ON pnp_data.name_line = au.lagnname 
              AND ABS(DATEDIFF(STR_TO_DATE(pnp_data.esid, '%m/%d/%y'), STR_TO_DATE(au.esid, '%Y-%m-%d'))) <= 7
            
            WHERE au.Active = 'y'
            AND (
              au.lagnname IN (${placeholders})
              OR au.sa IN (${placeholders}) 
              OR au.ga IN (${placeholders}) 
              OR au.mga IN (${placeholders}) 
              OR au.rga IN (${placeholders})
            )
            ORDER BY au.lagnname;
          `;
          
          const queryParams = [
            ...lagnnameList,
            ...lagnnameList,
            ...lagnnameList,
            ...lagnnameList,
            ...lagnnameList
          ];
          
          const results = await query(queryText, queryParams);
          
          // Process results
          results.forEach(user => {
            try {
              // Parse JSON strings if needed
              if (user.licenses && typeof user.licenses === 'string') {
                user.licenses = JSON.parse(user.licenses);
              } else if (!user.licenses) {
                user.licenses = [];
              }
              
              if (user.pnp_data && typeof user.pnp_data === 'string') {
                user.pnp_data = JSON.parse(user.pnp_data);
              }
              
              if (user.relationship_data && typeof user.relationship_data === 'string') {
                user.relationship_data = JSON.parse(user.relationship_data);
              }
            } catch (e) {
              console.error(`[getAllRGAsHierarchy] Error parsing JSON for user ${user.lagnname}:`, e);
              if (e.message.includes('licenses')) user.licenses = [];
              if (e.message.includes('pnp_data')) user.pnp_data = null;
              if (e.message.includes('relationship_data')) user.relationship_data = {};
            }
          });
          
          if (results.length > 0) {
            return {
              rgaId: rga.id,
              rgaName: rgaName,
              hierarchyData: results
            };
          }
          return null;
        } catch (rgaError) {
          console.error(`[getAllRGAsHierarchy] Error processing RGA ${rga.lagnname}:`, rgaError);
          return null;
        }
      });
      
      // Wait for all RGAs in this batch to be processed
      const batchResults = await Promise.all(batchPromises);
      
      // Add valid results to the allHierarchyData array
      batchResults.forEach(result => {
        if (result) {
          allHierarchyData.push(result);
        }
      });
    }
    
    res.json({ 
      success: true, 
      data: allHierarchyData,
      rgaCount: allHierarchyData.length,
      totalRgaCount: rgaResults.length
    });
    
  } catch (err) {
    console.error("[getAllRGAsHierarchy] Error retrieving RGA hierarchies:", err);
    console.error("[getAllRGAsHierarchy] Error stack:", err.stack);
    res.status(500).json({ success: false, message: "Error retrieving hierarchy data" });
  }
});

// Admin impersonation routes
router.post('/impersonateUser', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required'
      });
    }
    
    console.log(`[Admin] Admin ${req.user.userId} attempting to impersonate user ${targetUserId}`);
    
    // Get the target user's full profile data
    const targetUser = await query(`
      SELECT id, lagnname, email, phone, profpic, header_pic, clname, Role, 
             screen_name, esid, mga, agtnum, bio, Active
      FROM activeusers 
      WHERE id = ? AND Active = "y"
    `, [targetUserId]);
    
    if (targetUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found or inactive'
      });
    }
    
    const user = targetUser[0];
    console.log(`[Admin] Successfully retrieved data for user: ${user.lagnname} (${user.clname})`);
    
    // Return the target user's data formatted for frontend
    res.json({
      success: true,
      targetUserData: {
        userId: user.id,
        name: user.lagnname,
        email: user.email || '',
        phone: user.phone || '',
        profpic: user.profpic || '',
        profilePic: user.profpic || '',
        headerPic: user.header_pic || '',
        header_pic: user.header_pic || '',
        clname: user.clname || '',
        Role: user.Role || '',
        permissions: user.Role || '',
        lagnname: user.lagnname || '',
        agnName: user.lagnname || '',
        screenName: user.screen_name || '',
        esid: user.esid || '',
        mga: user.mga || '',
        agtnum: user.agtnum || '',
        bio: user.bio || ''
      }
    });
  } catch (error) {
    console.error('[Admin] Error impersonating user:', error);
    return res.status(500).json({
      success: false,
      message: 'Error impersonating user',
      error: error.message
    });
  }
});

// Get users list for impersonation dropdown
router.get('/getUsersForImpersonation', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log('[Admin] Getting users list for impersonation dropdown');
    
    const users = await query(`
      SELECT id, lagnname, clname, email, Active, esid
      FROM activeusers 
      WHERE Active = "y"
      ORDER BY clname, lagnname
    `);
    
    console.log(`[Admin] Found ${users.length} active users for impersonation`);
    
    res.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        name: user.lagnname,
        clname: user.clname,
        email: user.email,
        esid: user.esid
      }))
    });
  } catch (error) {
    console.error('[Admin] Error getting users for impersonation:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving users',
      error: error.message
    });
  }
});

module.exports = router; 