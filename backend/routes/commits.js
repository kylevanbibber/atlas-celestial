const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

// GET /api/commits - Get commits for a user
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { time_period, type, start, end } = req.query;

    // Debug logging for impersonation
    console.log('[commits] GET - User context:', {
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

    // Debug logging for impersonation
    console.log('[commits] POST - User context:', {
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
    console.log('[commits] Creating new commit entry with values:', { 
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
    
    console.log('[commits] New commit created with ID:', result.insertId);
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
