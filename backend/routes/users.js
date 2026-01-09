const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

// Log agent profile view
router.post('/log-profile-view', verifyToken, async (req, res) => {
  const { viewerId, viewerName, viewedAgentId, viewedAgentName, viewedAgentClname, searchQuery, searchSource } = req.body;
  
  if (!viewerId || !viewedAgentId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  
  try {
    await db.query(
      `INSERT INTO agent_search_history 
       (viewer_user_id, viewer_name, viewed_agent_id, viewed_agent_name, viewed_agent_clname, search_query, search_source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [viewerId, viewerName, viewedAgentId, viewedAgentName, viewedAgentClname, searchQuery, searchSource || 'global_search']
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error logging agent profile view:', error);
    // Don't fail the request if logging fails
    res.json({ success: true });
  }
});

// Helper function to parse lagnname (Last, First Middle Suffix) and return formatted name (First Middle Last Suffix)
function parseAndFormatName(lagnname) {
  if (!lagnname) return { formatted: '', parts: {} };
  
  // Split on comma to separate last name from rest
  const parts = lagnname.split(',').map(p => p.trim());
  
  if (parts.length === 0) {
    return { formatted: lagnname, parts: { last: lagnname } };
  }
  
  const lastName = parts[0] || '';
  const restOfName = parts[1] || '';
  
  // Split the rest into first, middle, suffix
  const restParts = restOfName.split(/\s+/).filter(p => p.length > 0);
  
  const firstName = restParts[0] || '';
  const middleAndSuffix = restParts.slice(1);
  
  // Common suffixes
  const suffixes = ['Jr', 'Jr.', 'Sr', 'Sr.', 'II', 'III', 'IV', 'V', 'VI'];
  const suffix = middleAndSuffix.find(part => suffixes.includes(part)) || '';
  const middle = middleAndSuffix.filter(part => !suffixes.includes(part)).join(' ');
  
  // Format as: First Middle Last Suffix
  const formatted = [firstName, middle, lastName, suffix]
    .filter(p => p.length > 0)
    .join(' ');
  
  return {
    formatted,
    parts: {
      first: firstName,
      middle,
      last: lastName,
      suffix
    }
  };
}

// Search users by name, email, phone, or agtnum with additional filters
router.get('/search', verifyToken, async (req, res) => {
  const q = req.query.q ? req.query.q.trim() : '';
  const roles = req.query.roles ? req.query.roles.split(',') : [];
  const active = req.query.active !== undefined ? req.query.active === 'true' : null;
  const states = req.query.states ? req.query.states.split(',') : [];

  try {
    let query = `
      SELECT 
        u.id, 
        u.lagnname, 
        u.email, 
        u.phone, 
        u.agtnum, 
        u.clname, 
        u.esid, 
        u.sa, 
        u.ga, 
        u.mga, 
        u.rga,
        u.managerActive,
        u.profpic,
        u.header_pic,
        u.bio,
        m.rga as mga_rga,
        m.legacy as mga_legacy,
        m.tree as mga_tree,
        l.id as license_id,
        l.state,
        l.resident_state
      FROM activeusers u
      LEFT JOIN licensed_states l ON u.id = l.userId
      LEFT JOIN MGAs m ON u.lagnname = m.lagnname
      WHERE 1=1
    `;
    const params = [];

    // Add search term condition with flexible name matching
    if (q) {
      // Parse search query into potential name parts
      const searchParts = q.toLowerCase().split(/[\s,]+/).filter(p => p.length > 0);
      
      if (searchParts.length > 0) {
        // Build flexible name search conditions
        // This will match: Last, First Last, Last First, First Middle Last, etc.
        const nameConditions = searchParts.map(() => 'LOWER(u.lagnname) LIKE ?').join(' AND ');
        
        query += ` AND (
          (${nameConditions}) OR
          u.email LIKE ? OR 
          u.phone LIKE ? OR 
          u.agtnum LIKE ?
        )`;
        
        // Add wildcards for each search part for name matching
        searchParts.forEach(part => {
          params.push(`%${part}%`);
        });
        
        // Add wildcards for email, phone, and agtnum (single search term)
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
    }

    // Add role filter
    if (roles.length > 0) {
      query += ` AND u.clname IN (${roles.map(() => '?').join(',')})`;
      params.push(...roles);
    }

    // Add active status filter
    if (active !== null) {
      query += ` AND u.managerActive = ?`;
      params.push(active ? 'y' : 'n');
    }

    // Add state filter
    if (states.length > 0) {
      query += ` AND l.state IN (${states.map(() => '?').join(',')})`;
      params.push(...states);
    }

    // Group by user to avoid duplicates
    query += ` GROUP BY u.id`;

    const results = await db.query(query, params);

    // Process results to group licenses by user
    const users = results.reduce((acc, row) => {
      const existingUser = acc.find(u => u.id === row.id);
      
      if (existingUser) {
        if (row.license_id) {
          existingUser.licenses.push({
            id: row.license_id,
            state: row.state,
            resident_state: row.resident_state
          });
        }
      } else {
        const nameInfo = parseAndFormatName(row.lagnname);
        acc.push({
          id: row.id,
          lagnname: row.lagnname,
          displayName: nameInfo.formatted,
          nameParts: nameInfo.parts,
          email: row.email,
          phone: row.phone,
          agtnum: row.agtnum,
          clname: row.clname,
          esid: row.esid,
          sa: row.sa,
          ga: row.ga,
          mga: row.mga,
          rga: row.rga,
          mga_rga: row.mga_rga,
          mga_legacy: row.mga_legacy,
          mga_tree: row.mga_tree,
          managerActive: row.managerActive,
          profpic: row.profpic,
          header_pic: row.header_pic,
          bio: row.bio,
          licenses: row.license_id ? [{
            id: row.license_id,
            state: row.state,
            resident_state: row.resident_state
          }] : []
        });
      }
      
      return acc;
    }, []);

    res.json({ users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get users by role (clname)
router.get('/by-role', verifyToken, async (req, res) => {
  const role = req.query.role;
  if (!role) return res.json({ users: [] });
  const results = await db.query(
    `SELECT id, lagnname, email, phone, agtnum, clname, esid, sa, ga, mga, rga
     FROM activeusers
     WHERE clname = ?`,
    [role]
  );
  res.json({ users: results });
});

// Get users by esid date condition (e.g., esid >= '2024-01-01')
router.get('/by-esid', verifyToken, async (req, res) => {
  const { op, date } = req.query; // op: '=', '>=', '<=', etc.
  if (!op || !date) return res.json({ users: [] });
  const allowedOps = ['=', '>=', '<=', '>', '<'];
  if (!allowedOps.includes(op)) return res.status(400).json({ error: 'Invalid operator' });
  const results = await db.query(
    `SELECT id, lagnname, email, phone, agtnum, clname, esid, sa, ga, mga, rga
     FROM activeusers
     WHERE esid ${op} ?`,
    [date]
  );
  res.json({ users: results });
});

// Get users by upline (sa, ga, mga, rga)
router.get('/by-upline', verifyToken, async (req, res) => {
  const { type, value } = req.query; // type: 'sa', 'ga', 'mga', 'rga'
  if (!type || !value) return res.json({ users: [] });
  const allowedTypes = ['sa', 'ga', 'mga', 'rga'];
  if (!allowedTypes.includes(type)) return res.status(400).json({ error: 'Invalid upline type' });
  const results = await db.query(
    `SELECT id, lagnname, email, phone, agtnum, clname, esid, sa, ga, mga, rga
     FROM activeusers
     WHERE ${type} = ?`,
    [value]
  );
  res.json({ users: results });
});

// Get active users with their details
router.get('/active', verifyToken, async (req, res) => {
  try {
    // Ignore userId parameter as it's automatically added by AuthContext
    const query = `
      SELECT 
        u.id,
        u.lagnname,
        u.email,
        u.clname,
        u.managerActive,
        u.esid,
        u.sa,
        u.ga,
        u.mga,
        u.rga,
        l.id as license_id,
        l.state,
        l.resident_state
      FROM activeusers u
      LEFT JOIN licensed_states l ON u.id = l.userId
      WHERE u.Active = 'y'
      ORDER BY u.clname ASC
    `;
    
    const results = await db.query(query);

    // Process results to group licenses by user
    const users = results.reduce((acc, row) => {
      const existingUser = acc.find(u => u.id === row.id);
      
      if (existingUser) {
        if (row.license_id) {
          existingUser.licenses.push({
            id: row.license_id,
            state: row.state,
            resident_state: row.resident_state
          });
        }
      } else {
        acc.push({
          id: row.id,
          lagnname: row.lagnname,
          email: row.email,
          clname: row.clname,
          managerActive: row.managerActive,
          esid: row.esid,
          sa: row.sa,
          ga: row.ga,
          mga: row.mga,
          rga: row.rga,
          licenses: row.license_id ? [{
            id: row.license_id,
            state: row.state,
            resident_state: row.resident_state
          }] : []
        });
      }
      
      return acc;
    }, []);

    res.json(users);
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ error: 'Failed to fetch active users' });
  }
});

module.exports = router; 