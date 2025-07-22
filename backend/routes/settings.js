// settings.js - Backend routes for settings functionality
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { query } = require('../db');

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
    
    console.log(`[Settings] Getting hierarchy for user ID: ${userId}`);
    
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
    console.log(`[Settings] Found user: ${user.lagnname} (${user.clname})`);
    
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
    
    console.log(`[Settings] Found ${hierarchyData.length} users in hierarchy`);
    
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