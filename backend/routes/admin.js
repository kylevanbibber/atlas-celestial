const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin, verifyStaff } = require('../middleware/authMiddleware');
const { query } = require('../db');
const nodemailer = require('nodemailer');

// Log all requests to admin routes
router.use((req, res, next) => {
  console.log('[ADMIN] 📨 Request:', {
    method: req.method,
    path: req.path,
    url: req.url,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl
  });
  next();
});

// Get all users from activeusers table
router.get('/getAllUsers', verifyToken, verifyAdmin, async (req, res) => {
  try {
    
    const users = await query(`
      SELECT id, lagnname, clname, email, managerActive, Active, mga, rept_name, profpic
      FROM activeusers 
      ORDER BY clname, lagnname
    `);
    
   
    
    return res.json({
      success: true,
      users
    });
  } catch (error) {

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
    
    // Get the user's hierarchy based on their role
    let hierarchyData = [];
    
    // For RGA/MGA, get their entire downline
    if (user.clname === 'RGA' || user.clname === 'MGA') {
      hierarchyData = await query(`
        SELECT a.*, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON TRIM(a.lagnname) = TRIM(l.lagnname)
        WHERE TRIM(a.mga) = TRIM(?) OR TRIM(a.lagnname) = TRIM(?)
        GROUP BY a.lagnname
      `, [user.lagnname, user.lagnname]);
    }
    // For GA, get them and their downline
    else if (user.clname === 'GA') {
      hierarchyData = await query(`
        SELECT a.*, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON TRIM(a.lagnname) = TRIM(l.lagnname)
        WHERE TRIM(a.ga) = TRIM(?) OR TRIM(a.lagnname) = TRIM(?)
        GROUP BY a.lagnname
      `, [user.lagnname, user.lagnname]);
    }
    // For SA, get them and their downline
    else if (user.clname === 'SA') {
      hierarchyData = await query(`
        SELECT a.*, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON TRIM(a.lagnname) = TRIM(l.lagnname)
        WHERE TRIM(a.sa) = TRIM(?) OR TRIM(a.lagnname) = TRIM(?)
        GROUP BY a.lagnname
      `, [user.lagnname, user.lagnname]);
    }
    // For AGT, just get them and their upline for context
    else {
      // Get the agent and their upline chain
      const agentData = await query(`
        SELECT a.*, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON TRIM(a.lagnname) = TRIM(l.lagnname)
        WHERE TRIM(a.lagnname) = TRIM(?)
        GROUP BY a.lagnname
      `, [user.lagnname]);
      
      const uplineData = [];
      
      // Add SA if present
      if (user.sa) {
        const saData = await query(`
          SELECT a.*, GROUP_CONCAT(l.state) AS license_states
          FROM activeusers a
          LEFT JOIN licenses l ON TRIM(a.lagnname) = TRIM(l.lagnname)
          WHERE TRIM(a.lagnname) = TRIM(?)
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
          LEFT JOIN licenses l ON TRIM(a.lagnname) = TRIM(l.lagnname)
          WHERE TRIM(a.lagnname) = TRIM(?)
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
          LEFT JOIN licenses l ON TRIM(a.lagnname) = TRIM(l.lagnname)
          WHERE TRIM(a.lagnname) = TRIM(?)
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
          LEFT JOIN licenses l ON TRIM(a.lagnname) = TRIM(l.lagnname)
          WHERE TRIM(a.lagnname) = TRIM(?)
          GROUP BY a.lagnname
        `, [user.rga]);
        
        if (rgaData.length > 0) {
          uplineData.push(rgaData[0]);
        }
      }
      
      hierarchyData = [...agentData, ...uplineData];
    }
    
    // Special case: For MAUGHANEVANSON BRODY W, also include all LOCKER-ROTOLO users
    if (user.lagnname === 'MAUGHANEVANSON BRODY W') {
      const lockerRotoloUsers = await query(`
        SELECT a.*, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON a.lagnname = l.lagnname
        WHERE a.rept_name = 'LOCKER-ROTOLO'
        GROUP BY a.lagnname
      `);
      
      // Merge LOCKER-ROTOLO users with existing hierarchy, avoiding duplicates
      const existingIds = new Set(hierarchyData.map(u => u.id));
      const newUsers = lockerRotoloUsers.filter(u => !existingIds.has(u.id));
      hierarchyData = [...hierarchyData, ...newUsers];
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
    

    
    return res.json({
      success: true,
      data: hierarchyData
    });
  } catch (error) {

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

  
  try {
    // Log the incoming token and decoded user information

    
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
  // ⏱️ PERFORMANCE TIMING START
  const perfStart = Date.now();
  console.log(`\n🚀 [Admin: All RGAs Hierarchy] Starting fetch for all RGAs...`);
  
  try {
    // Step 1: Get ONLY TOP-LEVEL RGAs (those who don't report to another active RGA)
    // Nested RGAs (like BENNETT BRANDON -> CRIVELLI -> EVANSON) will be pulled in via recursive CTE
    const rgaLookupStart = Date.now();
    const rgaResults = await query(
      `SELECT id, lagnname, rga 
       FROM activeusers 
       WHERE clname = 'RGA' 
         AND Active = 'y' 
         AND (
           rga IS NULL 
           OR rga = '' 
           OR rga NOT IN (SELECT lagnname FROM activeusers WHERE Active = 'y' AND clname = 'RGA')
         )
       ORDER BY lagnname`
    );
    const rgaLookupTime = Date.now() - rgaLookupStart;
    console.log(`   ⏱️  Top-level RGA lookup: ${rgaLookupTime}ms (found ${rgaResults.length} top-level RGAs)`);
    console.log(`   📋 Top-level RGAs:`, rgaResults.map(r => r.lagnname));
    
    if (rgaResults.length === 0) {
      return res.json({ success: true, data: [], rgaCount: 0 });
    }

    // Optimization 1: Get all MGAs recursively using CTE for each top-level RGA
    const allRgaNames = rgaResults.map(rga => rga.lagnname);
    
    const mgaLookupStart = Date.now();
    const mgasByRga = {};
    
    // For each top-level RGA, recursively fetch ALL MGAs in their tree
    for (const rgaName of allRgaNames) {
      const recursiveMgasQuery = `
        WITH RECURSIVE mga_tree AS (
          -- Level 0: Start with this RGA's direct MGAs
          SELECT lagnname, rga, legacy, tree, 0 as level
          FROM MGAs
          WHERE (rga = ? OR legacy = ? OR tree = ?)
            AND (active = 'y' OR active IS NULL)
            AND (hide = 'n' OR hide IS NULL)
          
          UNION ALL
          
          -- Recursive: Find MGAs whose rga/legacy/tree points to anyone in our tree
          SELECT m.lagnname, m.rga, m.legacy, m.tree, mt.level + 1
          FROM MGAs m
          INNER JOIN mga_tree mt ON (
            m.rga = mt.lagnname 
            OR m.legacy = mt.lagnname 
            OR m.tree = mt.lagnname
          )
          WHERE (m.active = 'y' OR m.active IS NULL)
            AND (m.hide = 'n' OR m.hide IS NULL)
            AND mt.level < 10
        )
        SELECT DISTINCT lagnname FROM mga_tree
      `;
      
      const mgaResults = await query(recursiveMgasQuery, [rgaName, rgaName, rgaName]);
      const mgaNames = mgaResults.map(m => m.lagnname);
      mgasByRga[rgaName] = mgaNames;
      
      // CRITICAL: Check if any of these MGAs are ALSO RGAs in activeusers table
      // (e.g., BENNETT BRANDON is in MGAs table but is also an RGA with his own team)
      if (mgaNames.length > 0) {
        const placeholders = mgaNames.map(() => '?').join(',');
        const mgasWhoAreRgas = await query(`
          SELECT lagnname 
          FROM activeusers 
          WHERE lagnname IN (${placeholders}) 
            AND clname IN ('RGA', 'MGA') 
            AND Active = 'y'
        `, mgaNames);
        
        const mgasWhoAreRgaNames = mgasWhoAreRgas.map(r => r.lagnname);
        
        if (mgasWhoAreRgaNames.length > 0 && rgaName === 'MAUGHANEVANSON BRODY W') {
          console.log(`   🔍 Found ${mgasWhoAreRgaNames.length} MGAs who are also RGAs/MGAs in activeusers:`, mgasWhoAreRgaNames);
        }
        
        // Add these MGA-RGAs to the main list
        mgasByRga[rgaName] = [...mgaNames, ...mgasWhoAreRgaNames];
      }
    }
    
    const mgaLookupTime = Date.now() - mgaLookupStart;
    const totalMgas = Object.values(mgasByRga).reduce((sum, list) => sum + list.length, 0);
    console.log(`   ⏱️  Recursive MGA lookup: ${mgaLookupTime}ms (found ${totalMgas} MGAs total across all RGAs)`);
    
    // Step 2: Prepare and execute the main query for all hierarchies at once
    // Optimization 2: Increase batch size
    console.log(`   ⏱️  Starting batch processing for ${rgaResults.length} RGAs...`);
    const batchProcessStart = Date.now();
    const batchSize = 10;
    const allHierarchyData = [];
    let totalUsersFound = 0;
    
    for (let i = 0; i < rgaResults.length; i += batchSize) {
      const batch = rgaResults.slice(i, i + batchSize);
      const batchPromises = batch.map(async (rga) => {
        try {
          const rgaName = rga.lagnname;
          let lagnnameList = [rgaName, ...mgasByRga[rgaName]];
          
          // ⚡ NEW: Recursively fetch nested RGAs
          // Some RGAs have other RGAs as their upline (e.g., CRIVELLI -> EVANSON -> MAUGHANEVANSON)
          // We need to include ALL nested RGAs in the tree
          const nestedRGAs = await query(`
            WITH RECURSIVE rga_tree AS (
              -- Base case: Start with the current RGA
              SELECT lagnname, rga, clname, 0 as level
              FROM activeusers
              WHERE lagnname = ? AND Active = 'y'
              
              UNION ALL
              
              -- Recursive case: Find RGAs whose rga field points to anyone in our tree
              SELECT au.lagnname, au.rga, au.clname, rt.level + 1
              FROM activeusers au
              INNER JOIN rga_tree rt ON au.rga = rt.lagnname
              WHERE au.Active = 'y' AND au.clname = 'RGA' AND rt.level < 10
            )
            SELECT DISTINCT lagnname, rga, level FROM rga_tree WHERE clname = 'RGA'
          `, [rgaName]);
          
          // Debug logging for nested RGAs
          if (rgaName === 'MAUGHANEVANSON BRODY W') {
            console.log(`\n🔍 [DEBUG] Nested RGAs for ${rgaName}:`, nestedRGAs);
            
            // Check if BENNETT BRANDON exists and is an RGA
            const bennettCheck = await query(`
              SELECT lagnname, clname, rga, mga 
              FROM activeusers 
              WHERE lagnname LIKE '%BENNETT BRANDON%' AND Active = 'y'
            `);
            console.log(`\n🔍 [DEBUG] BENNETT BRANDON check:`, bennettCheck);
            
            // Check if CRIVELLI exists
            const crivelliCheck = await query(`
              SELECT lagnname, clname, rga, mga 
              FROM activeusers 
              WHERE lagnname LIKE '%CRIVELLI%' AND Active = 'y'
            `);
            console.log(`\n🔍 [DEBUG] CRIVELLI check:`, crivelliCheck);
            
            // Check if EVANSON BRODY J exists
            const evansonCheck = await query(`
              SELECT lagnname, clname, rga, mga 
              FROM activeusers 
              WHERE lagnname LIKE '%EVANSON BRODY J%' AND Active = 'y'
            `);
            console.log(`\n🔍 [DEBUG] EVANSON BRODY J check:`, evansonCheck);
          }
          
          // Add nested RGAs to the list
          const nestedRGANames = nestedRGAs.map(r => r.lagnname);
          lagnnameList = [...lagnnameList, ...nestedRGANames];
          
          // Deduplicate the list
          lagnnameList = [...new Set(lagnnameList)];
          
          // Prepare query
          const placeholders = lagnnameList.map(() => "?").join(", ");
          
          // ⚡ PROGRESSIVE LOADING OPTIMIZATION: 
          // Removed licenses and PNP joins - these were causing 9-12 second queries!
          // Frontend can fetch these separately if needed
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
                au.agtnum,
                au.esid,
                COALESCE(au.email, '') AS email,
                au.sa,
                au.ga,
                au.mga,
                au.rga,
                mga_data.legacy AS legacy_link,
                mga_data.tree AS tree_link,
                mga_data.rga AS mga_rga_link,
                mga_data.active AS mga_active,
                mga_data.hide AS mga_hide,
                JSON_OBJECT(
                  'rga', au.rga,
                  'mga_lagnname', au.mga,
                  'mga_rga', mga_rel.rga,
                  'mga_legacy', mga_rel.legacy,
                  'mga_tree', mga_rel.tree
                ) AS relationship_data
            FROM activeusers au
            LEFT JOIN MGAs mga_data ON au.lagnname = mga_data.lagnname
            LEFT JOIN MGAs mga_rel ON au.mga = mga_rel.lagnname
            
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
            ...lagnnameList,  // For au.lagnname IN (...)
            ...lagnnameList,  // For au.sa IN (...)
            ...lagnnameList,  // For au.ga IN (...)
            ...lagnnameList,  // For au.mga IN (...)
            ...lagnnameList   // For au.rga IN (...)
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

          return null;
        }
      });
      
      // Wait for all RGAs in this batch to be processed
      const batchResults = await Promise.all(batchPromises);
      
      // Add valid results to the allHierarchyData array
      batchResults.forEach(result => {
        if (result) {
          allHierarchyData.push(result);
          totalUsersFound += result.users ? result.users.length : 0;
        }
      });
    }
    
    const batchProcessTime = Date.now() - batchProcessStart;
    const totalTime = Date.now() - perfStart;
    
    console.log(`   ⏱️  Batch processing complete: ${batchProcessTime}ms`);
    console.log(`✅ [Admin: All RGAs Hierarchy] Complete - ${totalTime}ms total`);
    console.log(`   📊 Returned ${allHierarchyData.length} RGAs with ${totalUsersFound} total users\n`);
    
    res.json({ 
      success: true, 
      data: allHierarchyData,
      rgaCount: allHierarchyData.length,
      totalRgaCount: rgaResults.length,
      _timing: { backendMs: totalTime, stage: 'admin_all_rgas' }
    });
    
  } catch (err) {
    const totalTime = Date.now() - perfStart;
    console.error(`❌ [Admin: All RGAs Hierarchy] Error after ${totalTime}ms:`, err);
    res.status(500).json({ success: false, message: "Error retrieving hierarchy data", _timing: { backendMs: totalTime, error: true } });
  }
});

// ============ OPTIMIZED HIERARCHY ENDPOINTS ============

// Optimized hierarchy loading - Phase 1: Basic structure only
router.get("/getHierarchyStructure", verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Get basic hierarchy structure without heavy data
    const structureQuery = `
      SELECT 
        au.id,
        au.lagnname, 
        au.clname,
        au.Active,
        au.managerActive,
        au.sa, 
        au.ga, 
        au.mga, 
        au.rga,
        COALESCE(au.email, '') AS email
      FROM activeusers au
      WHERE au.Active = 'y' AND au.managerActive = 'y'
      ORDER BY au.clname DESC, au.lagnname;
    `;
    
    const results = await query(structureQuery);
    
    // Group by RGA for efficient frontend processing
    const rgaGroups = {};
    const rgaList = [];
    
    results.forEach(user => {
      const rgaName = user.rga || user.lagnname;
      
      if (!rgaGroups[rgaName]) {
        rgaGroups[rgaName] = {
          rgaId: user.rga ? results.find(u => u.lagnname === user.rga)?.id : user.id,
          rgaName: rgaName,
          hierarchyData: []
        };
        rgaList.push(rgaGroups[rgaName]);
      }
      
      rgaGroups[rgaName].hierarchyData.push(user);
    });
    
    res.json({ 
      success: true, 
      data: rgaList,
      rgaCount: rgaList.length,
      totalUsers: results.length
    });
    
  } catch (err) {

    res.status(500).json({ success: false, message: "Error retrieving hierarchy structure" });
  }
});

// Phase 2: Load detailed data for specific RGAs on demand
router.post("/getHierarchyDetails", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { rgaNames } = req.body;
    
    if (!rgaNames || !Array.isArray(rgaNames)) {
      return res.status(400).json({ success: false, message: "RGA names array required" });
    }
    
    const placeholders = rgaNames.map(() => "?").join(", ");
    
    // Get detailed data for requested RGAs only
    const detailsQuery = `
      SELECT 
        au.id,
        au.lagnname,
        au.rept_name,
        au.redeemed,
        au.released,
        au.pending,
        au.profpic,
        au.phone,
        au.esid,
        au.rga,
        lic.licenses,
        pnp_ranked.pnp_data
      FROM activeusers au
      
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
            'curr_mo_4mo_rate', curr_mo_4mo_rate,
            'proj_plus_1', proj_plus_1,
            'pnp_date', date,
            'agent_num', agent_num
          ) as pnp_data,
          ROW_NUMBER() OVER (PARTITION BY name_line, esid ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC) as rn
        FROM pnp
      ) AS pnp_ranked ON (pnp_ranked.name_line = au.lagnname OR au.lagnname LIKE CONCAT(pnp_ranked.name_line, ' %'))
        AND pnp_ranked.rn = 1
        AND ABS(DATEDIFF(STR_TO_DATE(pnp_ranked.esid, '%m/%d/%y'), STR_TO_DATE(au.esid, '%Y-%m-%d'))) <= 7
      
      WHERE au.Active = 'y' AND au.managerActive = 'y'
      AND au.rga IN (${placeholders})
      ORDER BY au.lagnname;
    `;
    
    const results = await query(detailsQuery, rgaNames);
    
    // Process JSON fields
    results.forEach(user => {
      try {
        if (user.licenses && typeof user.licenses === 'string') {
          user.licenses = JSON.parse(user.licenses);
        } else if (!user.licenses) {
          user.licenses = [];
        }
        
        if (user.pnp_data && typeof user.pnp_data === 'string') {
          user.pnp_data = JSON.parse(user.pnp_data);
        }
      } catch (e) {

        if (e.message.includes('licenses')) user.licenses = [];
        if (e.message.includes('pnp_data')) user.pnp_data = null;
      }
    });
    
    // Group by RGA
    const rgaDetails = {};
    results.forEach(user => {
      const rgaName = user.rga;
      if (!rgaDetails[rgaName]) {
        rgaDetails[rgaName] = [];
      }
      rgaDetails[rgaName].push(user);
    });
    
    res.json({ 
      success: true, 
      data: rgaDetails
    });
    
  } catch (err) {

    res.status(500).json({ success: false, message: "Error retrieving hierarchy details" });
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
    

    
    // Get the target user's full profile data
    const targetUser = await query(`
      SELECT id, lagnname, email, phone, profpic, header_pic, clname, Role, 
             screen_name, esid, mga, agtnum, bio, teamRole, Active
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

    
    // Return the target user's data formatted for frontend
    res.json({
      success: true,
      targetUserData: {
        id: user.id,
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
        teamRole: user.teamRole || '',
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

    
    const users = await query(`
      SELECT id, lagnname, clname, email, Active, managerActive, esid, profpic, sa, ga, mga, rga
      FROM activeusers
      WHERE Active = "y"
      ORDER BY clname, lagnname
    `);

    res.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        name: user.lagnname,
        clname: user.clname,
        email: user.email,
        esid: user.esid,
        profpic: user.profpic,
        sa: user.sa,
        ga: user.ga,
        mga: user.mga,
        rga: user.rga,
        managerActive: user.managerActive
      }))
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: 'Error retrieving users',
      error: error.message
    });
  }
});

// Get login logs
router.get('/login-logs', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', days = 7 } = req.query;
    const offset = (page - 1) * limit;
    
    // Build search condition
    let searchCondition = '';
    let searchParams = [];
    
    if (search) {
      searchCondition = 'AND (ll.lagnname LIKE ? OR ll.ip_address LIKE ?)';
      searchParams = [`%${search}%`, `%${search}%`];
    }
    
    // Date filter - last N days
    const dateCondition = 'AND ll.timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM login_logs ll 
      WHERE 1=1 ${searchCondition} ${dateCondition}
    `;
    
    const [countResult] = await query(countQuery, [...searchParams, days]);
    const total = countResult.total;
    
    // Get login logs with user details
    const logsQuery = `
      SELECT 
        ll.id,
        ll.user_id,
        ll.lagnname,
        ll.timestamp,
        ll.ip_address,
        ll.user_agent,
        au.lagnname as user_lagnname,
        au.clname,
        au.Role,
        au.Active
      FROM login_logs ll
      LEFT JOIN activeusers au ON ll.user_id = au.id
      WHERE 1=1 ${searchCondition} ${dateCondition}
      ORDER BY ll.timestamp DESC
      LIMIT ? OFFSET ?
    `;
    
    const logs = await query(logsQuery, [...searchParams, days, parseInt(limit), offset]);
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {

    res.status(500).json({
      success: false,
      message: 'Failed to fetch login logs'
    });
  }
});

// Get potential VIPs - agents in their 2nd to 4th month
router.get('/potential-vips', async (req, res) => {
    try {


        // Optional month filter: expect YYYY-MM; defaults to current month if not provided
        const { month } = req.query;
        let baseYear, baseMonthIndex;

        if (month && /^\d{4}-\d{2}$/.test(month)) {
            const [y, m] = month.split('-').map(Number);
            baseYear = y;
            baseMonthIndex = m - 1; // JS Date month index
        } else {
            const now = new Date();
            baseYear = now.getFullYear();
            baseMonthIndex = now.getMonth();
        }

        const baseDate = new Date(baseYear, baseMonthIndex, 1);

        // Calculate start of months for VIP eligibility relative to baseDate
        const month4StartDate = new Date(baseDate.getFullYear(), baseDate.getMonth() - 3, 1); // 3 months ago (their 4th month)
        const month2EndDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 0);       // Last day of previous month (their 2nd month)

        // Format dates for SQL
        const minStartDate = month4StartDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const maxStartDate = month2EndDate.toISOString().split('T')[0];   // YYYY-MM-DD

        const targetYear = baseDate.getFullYear();
        const targetMonth = baseDate.getMonth() + 1; // 1-12


        
        // Optimized query with explicit date ranges
        // Build ALP subquery based on whether the selected month is current or prior
        const nowRef = new Date();
        const isCurrentMonth = (baseYear === nowRef.getFullYear() && baseMonthIndex === nowRef.getMonth());
        const monthStr = `${String(targetMonth).padStart(2, '0')}/${targetYear}`;

        const walpSubquery = isCurrentMonth
          ? `
                SELECT 
                    LagnName,
                    DATE_FORMAT(MAX(STR_TO_DATE(ReportDate, '%m/%d/%Y')), '%m/%d/%Y') as latestReportDate,
                    CAST(SUBSTRING_INDEX(GROUP_CONCAT(LVL_1_GROSS ORDER BY STR_TO_DATE(ReportDate, '%m/%d/%Y') DESC), ',', 1) as DECIMAL(10,2)) as latestLvl1Gross
                FROM Weekly_ALP 
                WHERE REPORT = 'MTD Recap'
                AND YEAR(STR_TO_DATE(ReportDate, '%m/%d/%Y')) = ?
                AND MONTH(STR_TO_DATE(ReportDate, '%m/%d/%Y')) = ?
                GROUP BY LagnName
            `
          : `
                SELECT 
                    LagnName,
                    month as latestReportDate,
                    CAST(MAX(CAST(LVL_1_GROSS AS DECIMAL(10,2))) AS DECIMAL(10,2)) as latestLvl1Gross
                FROM Monthly_ALP
                WHERE month = ?
                GROUP BY LagnName
            `;

        const weeklyRecapSubquery = `
                SELECT
                    LagnName,
                    CAST(SUM(LVL_1_NET) AS DECIMAL(10,2)) as weeklyRecapNet
                FROM Weekly_ALP
                WHERE REPORT = 'Weekly Recap'
                AND ReportDate = (
                    SELECT MAX(ReportDate)
                    FROM Weekly_ALP
                    WHERE REPORT = 'Weekly Recap'
                    AND YEAR(STR_TO_DATE(ReportDate, '%m/%d/%Y')) = ?
                    AND MONTH(STR_TO_DATE(ReportDate, '%m/%d/%Y')) = ?
                )
                AND YEAR(STR_TO_DATE(ReportDate, '%m/%d/%Y')) = ?
                AND MONTH(STR_TO_DATE(ReportDate, '%m/%d/%Y')) = ?
                GROUP BY LagnName
            `;

        const potentialVIPsQuery = `
            SELECT
                au.id,
                au.lagnname,
                au.esid,
                au.clname,
                au.sa,
                au.ga,
                au.mga,
                au.rga,
                TIMESTAMPDIFF(MONTH, au.esid, ?) as monthsSinceStart,
                walp.latestReportDate,
                walp.latestLvl1Gross,
                wr.weeklyRecapNet
            FROM activeusers au
            LEFT JOIN (
                ${walpSubquery}
            ) walp ON au.lagnname = walp.LagnName
            LEFT JOIN (
                ${weeklyRecapSubquery}
            ) wr ON au.lagnname = wr.LagnName
            WHERE au.Active = 'y'
            AND au.esid IS NOT NULL
            AND au.pending = 0
            AND au.esid BETWEEN ? AND ?
            ORDER BY au.esid DESC
        `;

        const alpParams = isCurrentMonth
          ? [targetYear, targetMonth]
          : [monthStr];

        const potentialVIPs = await query(potentialVIPsQuery, [
          // For TIMESTAMPDIFF: use baseDate first-of-month
          `${baseYear}-${String(baseMonthIndex + 1).padStart(2, '0')}-01`,
          // ALP subquery params
          ...alpParams,
          // Weekly Recap subquery params (inner MAX subquery + outer WHERE)
          targetYear, targetMonth,
          targetYear, targetMonth,
          // For activeusers.esid window
          minStartDate,
          maxStartDate
        ]);
        
        // Format the results
        const formattedVIPs = potentialVIPs.map(vip => ({
            ...vip,
            monthsActive: vip.monthsSinceStart + 1, // For display: what month they're in
            vipMonth: vip.monthsSinceStart + 1, // What month they're in (should be 2, 3, or 4)
            // latestReportDate already formatted as mm/dd/yyyy (Weekly) or mm/yyyy (Monthly)
            latestReportDate: vip.latestReportDate || null,
            totalLvl1Gross: vip.latestLvl1Gross ? parseFloat(vip.latestLvl1Gross).toFixed(2) : '0.00',
            weeklyRecapNet: vip.weeklyRecapNet ? parseFloat(vip.weeklyRecapNet).toFixed(2) : '0.00',
            // Show which VIP eligible month they're in: Month 2 = VIP 1/3, Month 3 = VIP 2/3, Month 4 = VIP 3/3
            vipEligibleMonth: vip.monthsSinceStart // monthsSinceStart is 1,2,3 which maps to VIP months 1,2,3
        }));
         


        // Compute total potential VIPs regardless of Active status for donut percentage
        const totalPotentialResult = await query(
          `SELECT COUNT(*) AS totalPotential
           FROM activeusers au
           WHERE au.esid IS NOT NULL
             AND au.pending = 0
             AND au.esid BETWEEN ? AND ?`,
          [minStartDate, maxStartDate]
        );
        const totalPotentialCount = (totalPotentialResult && totalPotentialResult[0] && totalPotentialResult[0].totalPotential) ? totalPotentialResult[0].totalPotential : 0;
         
        res.status(200).json({
            success: true,
            data: formattedVIPs,
            totalPotentialCount,
            message: `Found ${formattedVIPs.length} potential VIPs`
        });
         
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Error fetching potential VIPs data',
            error: error.message
        });
    }
});

// Get pending users - users where pending = 1 and Active = 'y'
router.get('/pending-users', verifyToken, async (req, res) => {
    try {
        const results = await query(`
            SELECT 
                id,
                lagnname,
                esid,
                agtnum,
                sa,
                ga,
                mga,
                rga,
                DATEDIFF(CURDATE(), esid) as daysPending
            FROM activeusers 
            WHERE pending = 1 
            AND Active = 'y'
            AND esid IS NOT NULL
            ORDER BY esid ASC
        `);

        res.json({
            success: true,
            data: results || [],
            totalCount: (results || []).length
        });
    } catch (error) {
        console.error('Error in pending-users endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Commit pending users - mark selected pending users as committed
router.post('/pending-users/commit', verifyToken, async (req, res) => {
    console.log('[ADMIN] 🚀 POST /admin/pending-users/commit - Request received');
    console.log('[ADMIN] 📊 Request body:', req.body);
    console.log('[ADMIN] 👤 User:', { id: req.user?.id, lagnname: req.user?.lagnname });
    
    try {
        const { userIds } = req.body; // Array of activeusers IDs to commit
        const committedBy = req.user.id; // User making the commit

        console.log('[ADMIN] 📊 Parsed data:', { userIds, committedBy });

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            console.log('[ADMIN] ❌ Invalid userIds - returning 400');
            return res.status(400).json({
                success: false,
                message: 'userIds array is required'
            });
        }

        // First, get the lagnname for each user
        const placeholders = userIds.map(() => '?').join(',');
        console.log('[ADMIN] 🔍 Fetching users with IDs:', userIds);
        
        const users = await query(
            `SELECT id, lagnname FROM activeusers WHERE id IN (${placeholders})`,
            userIds
        );

        console.log('[ADMIN] 📋 Found users:', users);

        if (!users || users.length === 0) {
            console.log('[ADMIN] ❌ No valid users found - returning 404');
            return res.status(404).json({
                success: false,
                message: 'No valid users found'
            });
        }

        // Insert or update commits (newer commits replace older ones)
        const commitValues = users.map(user => [user.id, user.lagnname, committedBy]);
        const commitPlaceholders = commitValues.map(() => '(?, ?, ?)').join(',');
        const flatValues = commitValues.flat();

        console.log('[ADMIN] 💾 Inserting/updating commits:', { commitValues, flatValues });

        const result = await query(
            `INSERT INTO pending_commit (activeusers_id, lagnname, committed_by) 
             VALUES ${commitPlaceholders}
             ON DUPLICATE KEY UPDATE 
                committed_at = NOW(),
                committed_by = VALUES(committed_by),
                lagnname = VALUES(lagnname)`,
            flatValues
        );

        console.log('[ADMIN] ✅ Insert/Update result:', {
            affectedRows: result.affectedRows,
            insertId: result.insertId,
            changedRows: result.changedRows,
            warningCount: result.warningCount
        });

        // affectedRows will be 1 for new inserts, 2 for updates
        const actualCommits = Math.ceil(result.affectedRows / 2); // Rough estimate

        res.json({
            success: true,
            message: `Successfully committed ${userIds.length} pending user(s)`,
            committed: userIds.length,
            totalRequested: userIds.length,
            updated: result.changedRows || 0
        });
        
        console.log('[ADMIN] ✅ Response sent successfully');
    } catch (error) {
        console.error('[ADMIN] ❌ Error committing pending users:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Get committed pending users
router.get('/pending-users/commits', verifyToken, async (req, res) => {
    try {
        const results = await query(`
            SELECT 
                pc.id,
                pc.activeusers_id,
                pc.lagnname,
                pc.committed_at,
                pc.committed_by,
                pc.notes,
                au.lagnname as committed_by_name
            FROM pending_commit pc
            LEFT JOIN activeusers au ON pc.committed_by = au.id
            ORDER BY pc.committed_at DESC
        `);

        res.json({
            success: true,
            data: results || [],
            totalCount: (results || []).length
        });
    } catch (error) {
        console.error('Error fetching pending commits:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/* ----------------------
   Toggle Pending Status Route
   Toggles activeusers.pending (1/0) — controls whether user is RFC or Coded.
   Only staff and admins can use this.
------------------------- */
router.post('/togglePending', verifyToken, verifyStaff, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const userQuery = await query(
      'SELECT id, lagnname, pending FROM activeusers WHERE id = ?',
      [userId]
    );

    if (userQuery.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const currentPending = userQuery[0].pending;
    const newPending = currentPending === 1 ? 0 : 1;

    const result = await query(
      'UPDATE activeusers SET pending = ? WHERE id = ?',
      [newPending, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log(`✅ Pending toggled for user ${userQuery[0].lagnname} (id: ${userId}) to ${newPending} by user ${req.userId}`);

    res.json({
      success: true,
      message: `Pending status updated to ${newPending === 1 ? 'RFC' : 'Coded'}`,
      newPending
    });
  } catch (error) {
    console.error('❌ Error toggling pending status:', error);
    res.status(500).json({ success: false, message: "Error updating pending status" });
  }
});

// Send account info (username and password) to user's email
// Allows internal service calls (X-Internal-Service header) to bypass auth
router.post('/users/send-account-info', (req, res, next) => {
  if (req.headers['x-internal-service']) {
    req.user = { userId: 0, Role: 'Admin', isService: true };
    return next();
  }
  verifyToken(req, res, (err) => {
    if (err) return;
    verifyStaff(req, res, next);
  });
}, async (req, res) => {
  try {
    const { userId, toEmail } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    // Fetch basic user info (include password to decide on reset)
    const results = await query(
      `SELECT id, lagnname, agtnum, email, password FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );
    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = results[0];
    const destinationEmail = (toEmail && String(toEmail).trim()) || user.email;
    if (!destinationEmail) {
      return res.status(400).json({ success: false, message: 'No email available. Provide toEmail.' });
    }

    // Compute username as first initial + last name based on lagnname format "Last First ..."
    const tokens = String(user.lagnname || '').trim().split(/\s+/);
    const lastName = (tokens[0] || '').toLowerCase();
    const firstInitial = (tokens[1] ? tokens[1][0] : (tokens[0] ? tokens[0][0] : 'u')).toLowerCase();
    const username = `${firstInitial}${lastName}`;
    const agtNumberPassword = String(user.agtnum || '').trim();

    // If the stored password isn't 'default', reset it to 'default'
    const currentPassword = String(user.password || '').trim();
    if (currentPassword !== 'default') {
      await query(`UPDATE activeusers SET password = 'default' WHERE id = ?`, [userId]);
    }

    // Configure transporter (reuse existing org SMTP like verify routes)
    const transporter = nodemailer.createTransport({
      host: 'mail.ariaslife.com',
      port: 465,
      secure: true,
      auth: {
        user: 'noreply@ariaslife.com',
        pass: 'Ariaslife123!'
      },
      tls: { rejectUnauthorized: false }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://agents.ariaslife.com';
    const loginUrl = `${frontendUrl.replace(/\/$/, '')}/login`;

    const html = `
      <div style="background:#f6f9fc;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#e2e8f0,#93c5fd);padding:28px 24px;">
            <h1 style="margin:0;font-size:22px;letter-spacing:.3px;color:#0f172a">Welcome to Arias Life</h1>
            <p style="margin:8px 0 0 0;font-size:13px;color:#334155">Opportunities don't happen. You create them.</p>
          </div>
          <div style="padding:24px 24px 8px 24px;">
            <p style="margin:0 0 14px 0;font-size:14px;color:#334155">Your account details are as follows:</p>
            <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;background:#fafafa">
              <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:8px">
                <span style="font-weight:600;color:#0f172a">Username</span>
                <span style="color:#0f172a">${username}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:8px">
                <span style="font-weight:600;color:#0f172a">Password</span>
                <span style="color:#0f172a">${agtNumberPassword || '(not set)'} </span>
              </div>
            </div>
            <p style="margin:16px 0 0 0;font-size:14px;color:#334155">Log in now to start tracking activity, setting goals, and saving more time.</p>
            <div style="margin:18px 0 8px 0">
              <a href="${loginUrl}" style="display:inline-block;background:#0b5a8f;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Log In</a>
            </div>
          </div>
          <div style="padding:0 24px 20px 24px;color:#64748b;font-size:12px">
            <p style="margin:0">If you did not request this information, please contact your administrator.</p>
          </div>
        </div>
      </div>`;

    const mailOptions = {
      from: 'noreply@ariaslife.com',
      to: destinationEmail,
      subject: 'Welcome to Arias Life – Your Account Details',
      html
    };

    await transporter.sendMail(mailOptions);

    return res.json({ success: true, message: `Account info sent to ${destinationEmail}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to send account info', error: error.message });
  }
});

// Reset a user's password to "default"
router.post('/users/reset-password', verifyToken, verifyStaff, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    await query(`UPDATE activeusers SET password = 'default' WHERE id = ?`, [userId]);
    return res.json({ success: true, message: 'Password reset to default' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reset password', error: error.message });
  }
});

// Get codes data from associates table
router.get('/codes', verifyToken, async (req, res) => {
    try {
        // Optional month filter: expect YYYY-MM; defaults to current month if not provided
        const { month, includeHistorical } = req.query;
        let baseYear, baseMonthIndex;

        if (month && /^\d{4}-\d{2}$/.test(month)) {
            const [y, m] = month.split('-').map(Number);
            baseYear = y;
            baseMonthIndex = m - 1; // JS Date month index
        } else {
            const now = new Date();
            baseYear = now.getFullYear();
            baseMonthIndex = now.getMonth();
        }

        const baseDate = new Date(baseYear, baseMonthIndex, 1);
        const startOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        const endOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59);

        // Format dates for SQL
        const startDate = startOfMonth.toISOString().split('T')[0]; // YYYY-MM-DD
        const endDate = endOfMonth.toISOString().split('T')[0];     // YYYY-MM-DD

        const results = await query(`
            SELECT 
                a.LagnName,
                a.AgtNum,
                a.PRODDATE,
                a.SA,
                a.GA,
                a.MGA,
                a.RGA,
                au.id as userId,
                p.PendingDate,
                DATEDIFF(a.PRODDATE, p.PendingDate) AS days_to_code
            FROM associates a
            LEFT JOIN activeusers au ON a.LagnName = au.lagnname
            LEFT JOIN pending p ON a.LagnName = p.LagnName
            WHERE a.LagnName IS NOT NULL
            AND a.LagnName != ''
            AND a.PRODDATE >= ?
            AND a.PRODDATE <= ?
            ORDER BY a.PRODDATE DESC, a.LagnName ASC
        `, [startDate, endDate]);

        // If historical data is requested, fetch previous month for comparison
        let historicalData = null;
        if (includeHistorical === 'true') {
            // Calculate date range for previous month only
            const previousMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
            const endOfPreviousMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 0, 23, 59, 59);

            const historicalStartDate = previousMonth.toISOString().split('T')[0];
            const historicalEndDate = endOfPreviousMonth.toISOString().split('T')[0];

            const historicalResults = await query(`
                SELECT 
                    a.LagnName,
                    a.AgtNum,
                    a.PRODDATE,
                    a.SA,
                    a.GA,
                    a.MGA,
                    a.RGA,
                    au.id as userId,
                    p.PendingDate,
                    DATEDIFF(a.PRODDATE, p.PendingDate) AS days_to_code
                FROM associates a
                LEFT JOIN activeusers au ON a.LagnName = au.lagnname
                LEFT JOIN pending p ON a.LagnName = p.LagnName
                WHERE a.LagnName IS NOT NULL
                AND a.LagnName != ''
                AND a.PRODDATE >= ?
                AND a.PRODDATE <= ?
                ORDER BY a.PRODDATE DESC, a.LagnName ASC
            `, [historicalStartDate, historicalEndDate]);

            historicalData = historicalResults || [];
        }

        res.json({
            success: true,
            data: results || [],
            totalCount: (results || []).length,
            historicalData: historicalData
        });
    } catch (error) {
        console.error('Error in codes endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Log route registration
console.log('[ADMIN ROUTES] ✅ Admin routes registered, including:');
console.log('[ADMIN ROUTES]    - POST /pending-users/commit');
console.log('[ADMIN ROUTES]    - GET /pending-users/commits');
console.log('[ADMIN ROUTES]    - GET /pending-users');

module.exports = router; 