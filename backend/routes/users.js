const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

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
        l.id as license_id,
        l.state,
        l.resident_state
      FROM activeusers u
      LEFT JOIN licenses l ON u.id = l.user_id
      WHERE 1=1
    `;
    const params = [];

    // Add search term condition
    if (q) {
      query += ` AND (
        u.lagnname LIKE ? OR 
        u.email LIKE ? OR 
        u.phone LIKE ? OR 
        u.agtnum LIKE ?
      )`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
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
        acc.push({
          id: row.id,
          lagnname: row.lagnname,
          email: row.email,
          phone: row.phone,
          agtnum: row.agtnum,
          clname: row.clname,
          esid: row.esid,
          sa: row.sa,
          ga: row.ga,
          mga: row.mga,
          rga: row.rga,
          managerActive: row.managerActive,
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