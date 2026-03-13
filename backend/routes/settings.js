// settings.js - Backend routes for settings functionality
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { query } = require('../db');

// Get all users by clname from MGAs table
router.get('/hierarchy/by-clname/:clname', verifyToken, async (req, res) => {
  try {
    const { clname } = req.params;
    
    if (!clname) {
      return res.status(400).json({
        success: false,
        message: 'Clname is required'
      });
    }
    
    // Get all users with the specified clname from MGAs table
    // Join with activeusers using TRIM to handle whitespace differences
    const usersData = await query(`
      SELECT
        m.lagnname,
        m.rept_name,
        m.clname,
        m.Active as active,
        m.hide,
        m.start,
        m.rga,
        m.mga,
        a.id as userId
      FROM MGAs m
      LEFT JOIN activeusers a ON TRIM(m.lagnname) = TRIM(a.lagnname)
      WHERE m.clname = ?
      ORDER BY m.lagnname
    `, [clname]);
    
    return res.json({
      success: true,
      data: usersData
    });
  } catch (error) {
    console.error('[Settings] Error getting users by clname:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving users by clname',
      error: error.message
    });
  }
});

// Get team hierarchy data for a specific user (by lagnname)
router.get('/hierarchy/team/:lagnname', verifyToken, async (req, res) => {
  try {
    const { lagnname } = req.params;
    const { filterClname } = req.query; // Optional: 'MGA' or 'RGA' to filter results
    
    if (!lagnname) {
      return res.status(400).json({
        success: false,
        message: 'Lagnname is required'
      });
    }
    
    // Build the clname filter condition and parameters
    let clnameCondition = '';
    const params = [lagnname, lagnname];
    
    if (filterClname) {
      clnameCondition = ` AND m.clname = ?`;
      params.push(filterClname);
    }
    
    // Get hierarchy data by joining activeusers with MGAs table
    // This ensures we get the correct Active and hide values from MGAs table
    // Also ensure we only get rows where the MGAs table has the matching clname
    const hierarchyData = await query(`
      SELECT 
        a.id, 
        a.lagnname, 
        a.rept_name, 
        a.clname, 
        a.profpic, 
        a.phone, 
        a.esid, 
        a.email, 
        a.sa, 
        a.ga, 
        a.mga, 
        a.rga,
        COALESCE(m.Active, a.Active) as active,
        COALESCE(m.hide, 'n') as hide,
        m.clname as clname,
        m.start,
        GROUP_CONCAT(l.state) AS license_states
      FROM activeusers a
      LEFT JOIN MGAs m ON a.lagnname = m.lagnname
      LEFT JOIN licenses l ON a.lagnname = l.lagnname
      WHERE (a.mga = ? OR a.rga = ?)
        AND (m.clname IS NOT NULL)
        ${clnameCondition}
      GROUP BY a.lagnname
    `, params);
    
    // Process license data
    const processedData = hierarchyData.map(user => {
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
      data: processedData
    });
  } catch (error) {
    console.error('[Settings] Error getting team hierarchy:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving team hierarchy',
      error: error.message
    });
  }
});

// Get user's hierarchy data
router.get('/hierarchy', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
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
        SELECT a.id, a.lagnname, a.rept_name, a.clname, a.Active, a.managerActive, a.redeemed, a.released, a.pending,
               a.profpic, a.phone, a.esid, a.email, a.sa, a.ga, a.mga, a.rga, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON a.lagnname = l.lagnname
        WHERE a.mga = ? OR a.lagnname = ?
        GROUP BY a.lagnname
      `, [user.lagnname, user.lagnname]);
    }
    // For GA, get them and their downline
    else if (user.clname === 'GA') {
      hierarchyData = await query(`
        SELECT a.id, a.lagnname, a.rept_name, a.clname, a.Active, a.managerActive, a.redeemed, a.released, a.pending,
               a.profpic, a.phone, a.esid, a.email, a.sa, a.ga, a.mga, a.rga, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON a.lagnname = l.lagnname
        WHERE a.ga = ? OR a.lagnname = ?
        GROUP BY a.lagnname
      `, [user.lagnname, user.lagnname]);
    }
    // For SA, get them and their downline
    else if (user.clname === 'SA') {
      hierarchyData = await query(`
        SELECT a.id, a.lagnname, a.rept_name, a.clname, a.Active, a.managerActive, a.redeemed, a.released, a.pending,
               a.profpic, a.phone, a.esid, a.email, a.sa, a.ga, a.mga, a.rga, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON a.lagnname = l.lagnname
        WHERE a.sa = ? OR a.lagnname = ?
        GROUP BY a.lagnname
      `, [user.lagnname, user.lagnname]);
    }
    // For AGT, get them and their upline chain in a single query
    else {
      // ⚡ OPTIMIZED: Single query with LEFT JOINs instead of 4 separate queries
      // This reduces database round-trips from 4 to 1 (~75% faster)
      hierarchyData = await query(`
        SELECT 
          -- Main agent data
          a.id, a.lagnname, a.rept_name, a.clname, a.Active, a.managerActive, 
          a.redeemed, a.released, a.pending, a.profpic, a.phone, a.esid, a.email,
          a.sa, a.ga, a.mga, a.rga,
          GROUP_CONCAT(DISTINCT l.state) AS license_states,
          
          -- SA data
          sa.id as sa_id, sa.lagnname as sa_lagnname, sa.rept_name as sa_rept_name,
          sa.clname as sa_clname, sa.Active as sa_active, sa.managerActive as sa_managerActive,
          sa.redeemed as sa_redeemed, sa.released as sa_released, sa.pending as sa_pending,
          sa.profpic as sa_profpic, sa.phone as sa_phone, sa.esid as sa_esid, sa.email as sa_email,
          sa.sa as sa_sa, sa.ga as sa_ga, sa.mga as sa_mga, sa.rga as sa_rga,
          GROUP_CONCAT(DISTINCT l_sa.state) AS sa_license_states,
          
          -- GA data
          ga.id as ga_id, ga.lagnname as ga_lagnname, ga.rept_name as ga_rept_name,
          ga.clname as ga_clname, ga.Active as ga_active, ga.managerActive as ga_managerActive,
          ga.redeemed as ga_redeemed, ga.released as ga_released, ga.pending as ga_pending,
          ga.profpic as ga_profpic, ga.phone as ga_phone, ga.esid as ga_esid, ga.email as ga_email,
          ga.sa as ga_sa, ga.ga as ga_ga, ga.mga as ga_mga, ga.rga as ga_rga,
          GROUP_CONCAT(DISTINCT l_ga.state) AS ga_license_states,
          
          -- MGA data
          mga.id as mga_id, mga.lagnname as mga_lagnname, mga.rept_name as mga_rept_name,
          mga.clname as mga_clname, mga.Active as mga_active, mga.managerActive as mga_managerActive,
          mga.redeemed as mga_redeemed, mga.released as mga_released, mga.pending as mga_pending,
          mga.profpic as mga_profpic, mga.phone as mga_phone, mga.esid as mga_esid, mga.email as mga_email,
          mga.sa as mga_sa, mga.ga as mga_ga, mga.mga as mga_mga, mga.rga as mga_rga,
          GROUP_CONCAT(DISTINCT l_mga.state) AS mga_license_states,
          
          -- RGA data
          rga.id as rga_id, rga.lagnname as rga_lagnname, rga.rept_name as rga_rept_name,
          rga.clname as rga_clname, rga.Active as rga_active, rga.managerActive as rga_managerActive,
          rga.redeemed as rga_redeemed, rga.released as rga_released, rga.pending as rga_pending,
          rga.profpic as rga_profpic, rga.phone as rga_phone, rga.esid as rga_esid, rga.email as rga_email,
          rga.sa as rga_sa, rga.ga as rga_ga, rga.mga as rga_mga, rga.rga as rga_rga,
          GROUP_CONCAT(DISTINCT l_rga.state) AS rga_license_states
          
        FROM activeusers a
        LEFT JOIN licenses l ON a.lagnname = l.lagnname
        LEFT JOIN activeusers sa ON a.sa = sa.lagnname
        LEFT JOIN licenses l_sa ON sa.lagnname = l_sa.lagnname
        LEFT JOIN activeusers ga ON a.ga = ga.lagnname
        LEFT JOIN licenses l_ga ON ga.lagnname = l_ga.lagnname
        LEFT JOIN activeusers mga ON a.mga = mga.lagnname
        LEFT JOIN licenses l_mga ON mga.lagnname = l_mga.lagnname
        LEFT JOIN activeusers rga ON a.rga = rga.lagnname
        LEFT JOIN licenses l_rga ON rga.lagnname = l_rga.lagnname
        WHERE a.lagnname = ?
        GROUP BY a.id, sa.id, ga.id, mga.id, rga.id
      `, [user.lagnname]);
      
      // Transform the flat result into separate user objects
      if (hierarchyData.length > 0) {
        const result = hierarchyData[0];
        const users = [];
        
        // Add main agent
        users.push({
          id: result.id,
          lagnname: result.lagnname,
          rept_name: result.rept_name,
          clname: result.clname,
          Active: result.Active,
          managerActive: result.managerActive,
          redeemed: result.redeemed,
          released: result.released,
          pending: result.pending,
          profpic: result.profpic,
          phone: result.phone,
          esid: result.esid,
          email: result.email,
          sa: result.sa,
          ga: result.ga,
          mga: result.mga,
          rga: result.rga,
          license_states: result.license_states
        });
        
        // Add SA if exists
        if (result.sa_id) {
          users.push({
            id: result.sa_id,
            lagnname: result.sa_lagnname,
            rept_name: result.sa_rept_name,
            clname: result.sa_clname,
            Active: result.sa_active,
            managerActive: result.sa_managerActive,
            redeemed: result.sa_redeemed,
            released: result.sa_released,
            pending: result.sa_pending,
            profpic: result.sa_profpic,
            phone: result.sa_phone,
            esid: result.sa_esid,
            email: result.sa_email,
            sa: result.sa_sa,
            ga: result.sa_ga,
            mga: result.sa_mga,
            rga: result.sa_rga,
            license_states: result.sa_license_states
          });
      }
      
        // Add GA if exists
        if (result.ga_id) {
          users.push({
            id: result.ga_id,
            lagnname: result.ga_lagnname,
            rept_name: result.ga_rept_name,
            clname: result.ga_clname,
            Active: result.ga_active,
            managerActive: result.ga_managerActive,
            redeemed: result.ga_redeemed,
            released: result.ga_released,
            pending: result.ga_pending,
            profpic: result.ga_profpic,
            phone: result.ga_phone,
            esid: result.ga_esid,
            email: result.ga_email,
            sa: result.ga_sa,
            ga: result.ga_ga,
            mga: result.ga_mga,
            rga: result.ga_rga,
            license_states: result.ga_license_states
          });
      }
      
        // Add MGA if exists
        if (result.mga_id) {
          users.push({
            id: result.mga_id,
            lagnname: result.mga_lagnname,
            rept_name: result.mga_rept_name,
            clname: result.mga_clname,
            Active: result.mga_active,
            managerActive: result.mga_managerActive,
            redeemed: result.mga_redeemed,
            released: result.mga_released,
            pending: result.mga_pending,
            profpic: result.mga_profpic,
            phone: result.mga_phone,
            esid: result.mga_esid,
            email: result.mga_email,
            sa: result.mga_sa,
            ga: result.mga_ga,
            mga: result.mga_mga,
            rga: result.mga_rga,
            license_states: result.mga_license_states
          });
      }
      
        // Add RGA if exists
        if (result.rga_id) {
          users.push({
            id: result.rga_id,
            lagnname: result.rga_lagnname,
            rept_name: result.rga_rept_name,
            clname: result.rga_clname,
            Active: result.rga_active,
            managerActive: result.rga_managerActive,
            redeemed: result.rga_redeemed,
            released: result.rga_released,
            pending: result.rga_pending,
            profpic: result.rga_profpic,
            phone: result.rga_phone,
            esid: result.rga_esid,
            email: result.rga_email,
            sa: result.rga_sa,
            ga: result.rga_ga,
            mga: result.rga_mga,
            rga: result.rga_rga,
            license_states: result.rga_license_states
          });
      }
      
        hierarchyData = users;
      }
    }
    
    // Special case: For MAUGHANEVANSON BRODY W, also include all LOCKER-ROTOLO users
    if (user.lagnname === 'MAUGHANEVANSON BRODY W') {
      const lockerRotoloUsers = await query(`
        SELECT a.id, a.lagnname, a.rept_name, a.clname, a.Active, a.managerActive, a.redeemed, a.released, a.pending,
               a.profpic, a.phone, a.esid, a.email, a.sa, a.ga, a.mga, a.rga, GROUP_CONCAT(l.state) AS license_states
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
    console.error('[Settings] Error getting user hierarchy:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving user hierarchy',
      error: error.message
    });
  }
});

module.exports = router; 