const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { debug } = require('../utils/logger');

// GET /api/commits/admin - Admin endpoint to get commits with flexible filtering
router.get('/admin', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.Role;
    const userTeamRole = req.user?.teamRole;
    const isAppAdmin = (userRole === 'Admin' || userRole === 'SuperAdmin') && userTeamRole === 'app';
    // Treat app admins as SGA for permission purposes
    const userClname = isAppAdmin ? 'SGA' : req.user?.clname;
    const userLagnname = req.user?.lagnname;
    const { time_period, type, start, end, lagnname, clname, all } = req.query;

    debug('[commits/admin] GET - Request context:', {
      userId,
      userClname,
      userLagnname,
      isAppAdmin,
      queryParams: { time_period, type, start, end, lagnname, clname, all }
    });

    // Permission check - only allow SGA, RGA, MGA, GA, SA users (app admins treated as SGA)
    const allowedRoles = ['SGA', 'RGA', 'MGA', 'GA', 'SA'];
    if (!allowedRoles.includes(userClname)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Admin-level access required.'
      });
    }

    // Build the query based on permissions and parameters
    let query = 'SELECT * FROM commits WHERE 1=1';
    const params = [];

    // If 'all' parameter is true and user has scorecard access, return all commits
    if (all === 'true' && ['SGA', 'RGA', 'MGA'].includes(userClname)) {
      debug('[commits/admin] Fetching all commits (' + userClname + ' access)');
    }
    // If lagnname is specified, fetch commits for that specific user
    else if (lagnname) {
      // RGA can fetch for their MGAs, MGA can fetch for themselves, SGA can fetch for anyone
      if (userClname === 'SGA') {
        query += ' AND lagnname = ?';
        params.push(lagnname);
        debug('[commits/admin] Fetching commits for specific lagnname (SGA access):', lagnname);
      } else if (userClname === 'RGA') {
        // RGA can only fetch for their own MGAs - need to verify relationship
        // For now, allow RGA to fetch any MGA commits (could add hierarchy check later)
        query += ' AND lagnname = ?';
        params.push(lagnname);
        debug('[commits/admin] Fetching commits for specific lagnname (RGA access):', lagnname);
      } else if (userClname === 'MGA' && lagnname.toUpperCase() === userLagnname.toUpperCase()) {
        // MGA can only fetch their own commits
        query += ' AND lagnname = ?';
        params.push(lagnname);
        debug('[commits/admin] Fetching commits for own lagnname (MGA access):', lagnname);
      } else if (['GA', 'SA'].includes(userClname) && lagnname.toUpperCase() === userLagnname.toUpperCase()) {
        // GA/SA can only fetch their own commits
        query += ' AND lagnname = ?';
        params.push(lagnname);
        debug('[commits/admin] Fetching commits for own lagnname (GA/SA access):', lagnname);
      } else {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have permission to view commits for this user.' 
        });
      }
    }
    // If clname is specified, fetch commits for all users with that clname
    else if (clname) {
      if (userClname === 'SGA') {
        query += ' AND clname = ?';
        params.push(clname);
        debug('[commits/admin] Fetching commits for clname:', clname);
      } else if (userClname === 'RGA' && clname === 'MGA') {
        // RGA can fetch all MGA commits (could add hierarchy check later)
        query += ' AND clname = ?';
        params.push(clname);
        debug('[commits/admin] Fetching commits for MGA clname (RGA access)');
      } else {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have permission to view commits for this clname.' 
        });
      }
    }
    // Default: fetch commits for the requesting user
    else {
      query += ' AND userId = ?';
      params.push(userId);
      debug('[commits/admin] Fetching commits for own userId:', userId);
    }

    // Add filters
    if (time_period) {
      query += ' AND time_period = ?';
      params.push(time_period);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (start && end) {
      query += ' AND start = ? AND end = ?';
      params.push(start, end);
    }

    query += ' ORDER BY created_at DESC';

    debug('[commits/admin] Executing query:', query, 'with params:', params);
    const results = await db.query(query, params);
    debug('[commits/admin] Found', results.length, 'commits');
    
    return res.json({ success: true, data: results });
  } catch (error) {
    console.error('[commits/admin] GET error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching commits' });
  }
});

// GET /api/commits/org-overview - Get commits for all active MGAs joined through activeusers
router.get('/org-overview', verifyToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ success: false, message: 'start and end date params required' });
    }

    // Join MGAs → activeusers (via normalized lagnname) → commits
    // TRIM + REPLACE collapses extra internal whitespace for matching
    const results = await db.query(`
      SELECT
        a.id AS userId,
        a.lagnname,
        a.profpic,
        m.rga,
        c.id AS commitId,
        c.type,
        c.amount,
        c.created_at
      FROM MGAs m
      INNER JOIN activeusers a
        ON TRIM(REPLACE(REPLACE(REPLACE(a.lagnname, '  ', ' '), '  ', ' '), '  ', ' '))
         = TRIM(REPLACE(REPLACE(REPLACE(m.lagnname, '  ', ' '), '  ', ' '), '  ', ' '))
      LEFT JOIN commits c
        ON c.userId = a.id
        AND c.start = ?
        AND c.end = ?
        AND c.time_period = 'month'
      WHERE (m.active = 'y' OR m.active IS NULL)
        AND (m.hide = 'n' OR m.hide IS NULL)
      ORDER BY a.lagnname ASC, c.created_at DESC
    `, [start, end]);

    // Group by userId, pick the latest commit per type
    const userMap = {};
    for (const row of results) {
      if (!userMap[row.userId]) {
        userMap[row.userId] = {
          userId: row.userId,
          lagnname: row.lagnname,
          profpic: row.profpic,
          rga: row.rga,
          hires: null,
          codes: null,
          vips: null
        };
      }
      // Only take the first (most recent) commit per type
      if (row.commitId && row.type) {
        const u = userMap[row.userId];
        if (u[row.type] === null) {
          u[row.type] = parseFloat(row.amount);
        }
      }
    }

    return res.json({ success: true, data: Object.values(userMap) });
  } catch (error) {
    console.error('[commits/org-overview] GET error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching org overview' });
  }
});

// GET /api/commits - Get commits for a user
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { time_period, type, start, end } = req.query;

    // Debug logging for impersonation (off by default)
    debug('[commits] GET - User context:', {
      userId,
      lagnname: req.user?.lagnname,
      clname: req.user?.clname,
      isImpersonating: req.user?._isImpersonating,
      originalAdminId: req.user?._originalAdminId
    });

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    let query = 'SELECT * FROM commits WHERE userId = ?';
    const params = [userId];

    if (time_period) {
      query += ' AND time_period = ?';
      params.push(time_period);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (start && end) {
      query += ' AND start = ? AND end = ?';
      params.push(start, end);
    }

    query += ' ORDER BY created_at DESC';

    const results = await db.query(query, params);
    return res.json({ success: true, data: results });
  } catch (error) {
    console.error('[commits] GET error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching commits' });
  }
});

// POST /api/commits - Create or update a commit
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const lagnname = req.user?.lagnname;
    // Allow clname to be overridden from request body (for RGA users setting MGA vs RGA commits)
    const clname = req.body?.clname || req.user?.clname;
    const { time_period, type, start, end, amount } = req.body;

    // Debug logging for impersonation (off by default)
    debug('[commits] POST - User context:', {
      userId,
      lagnname,
      clname,
      clnameSource: req.body?.clname ? 'request body' : 'user context',
      userClname: req.user?.clname,
      isImpersonating: req.user?._isImpersonating,
      originalAdminId: req.user?._originalAdminId,
      fullUser: req.user
    });

    if (!userId || !lagnname) {
      return res.status(400).json({ success: false, message: 'User information required' });
    }

    if (!time_period || !type || !start || !end || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Always insert a new row to maintain history of changes
    // This allows tracking when commits were changed over time
    debug('[commits] Creating new commit entry with values:', { 
      userId, 
      lagnname, 
      clname, 
      time_period, 
      type, 
      start, 
      end, 
      amount 
    });
    
    const result = await db.query(
      'INSERT INTO commits (userId, lagnname, clname, time_period, type, start, end, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, lagnname, clname, time_period, type, start, end, amount]
    );
    
    debug('[commits] New commit created with ID:', result.insertId);
    return res.json({ success: true, message: 'Commit created', id: result.insertId });
  } catch (error) {
    console.error('[commits] POST error:', error);
    return res.status(500).json({ success: false, message: 'Error saving commit' });
  }
});

// DELETE /api/commits/:id - Delete a commit
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    // Verify ownership
    const existing = await db.query('SELECT userId FROM commits WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Commit not found' });
    }

    if (existing[0].userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await db.query('DELETE FROM commits WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Commit deleted' });
  } catch (error) {
    console.error('[commits] DELETE error:', error);
    return res.status(500).json({ success: false, message: 'Error deleting commit' });
  }
});

module.exports = router;
