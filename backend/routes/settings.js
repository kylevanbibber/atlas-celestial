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
    // This ensures we get the correct Active and hide values from MGAs table
    const usersData = await query(`
      SELECT 
        m.lagnname,
        m.rept_name,
        m.clname,
        m.Active as active,
        m.hide,
        m.start,
        m.rga,
        m.mga
      FROM MGAs m
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
    // For AGT, just get them and their upline for context
    else {
      // Get the agent and their upline chain
      const agentData = await query(`
        SELECT a.id, a.lagnname, a.rept_name, a.clname, a.Active, a.managerActive, a.redeemed, a.released, a.pending,
               a.profpic, a.phone, a.esid, a.email, a.sa, a.ga, a.mga, a.rga, GROUP_CONCAT(l.state) AS license_states
        FROM activeusers a
        LEFT JOIN licenses l ON a.lagnname = l.lagnname
        WHERE a.lagnname = ?
        GROUP BY a.lagnname
      `, [user.lagnname]);
      
      const uplineData = [];
      
      // Add SA if present
      if (user.sa) {
        const saData = await query(`
          SELECT a.id, a.lagnname, a.rept_name, a.clname, a.Active, a.managerActive, a.redeemed, a.released, a.pending,
                 a.profpic, a.phone, a.esid, a.email, a.sa, a.ga, a.mga, a.rga, GROUP_CONCAT(l.state) AS license_states
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
          SELECT a.id, a.lagnname, a.rept_name, a.clname, a.Active, a.managerActive, a.redeemed, a.released, a.pending,
                 a.profpic, a.phone, a.esid, a.email, a.sa, a.ga, a.mga, a.rga, GROUP_CONCAT(l.state) AS license_states
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
          SELECT a.id, a.lagnname, a.rept_name, a.clname, a.Active, a.managerActive, a.redeemed, a.released, a.pending,
                 a.profpic, a.phone, a.esid, a.email, a.sa, a.ga, a.mga, a.rga, GROUP_CONCAT(l.state) AS license_states
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
          SELECT a.id, a.lagnname, a.rept_name, a.clname, a.Active, a.managerActive, a.redeemed, a.released, a.pending,
                 a.profpic, a.phone, a.esid, a.email, a.sa, a.ga, a.mga, a.rga, GROUP_CONCAT(l.state) AS license_states
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