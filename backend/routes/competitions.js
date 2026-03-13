const express = require('express');
const router = express.Router();
const { query } = require('../db');
const verifyToken = require('../middleware/verifyToken');

// Apply authentication middleware to all routes
router.use(verifyToken);

// GET /api/competitions - Get all competitions with optional filtering
router.get('/', async (req, res) => {
  try {
    const { status, type, active_only, user_competitions } = req.query;
    const userId = req.user?.id || req.user?.userId;
    
    let sql = `
      SELECT 
        c.*,
        au.lagnname as created_by_name,
        CASE 
          WHEN c.start_date <= NOW() AND c.end_date >= NOW() THEN 'active'
          WHEN c.start_date > NOW() THEN 'upcoming'
          WHEN c.end_date < NOW() THEN 'ended'
          ELSE c.status
        END as computed_status
      FROM competitions c
      LEFT JOIN activeusers au ON c.created_by = au.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Filter by status
    if (status) {
      sql += ` AND c.status = ?`;
      params.push(status);
    }
    
    // Filter by type
    if (type) {
      sql += ` AND c.competition_type = ?`;
      params.push(type);
    }
    
    // Only show active competitions
    if (active_only === 'true') {
      sql += ` AND c.status = 'active' AND c.start_date <= NOW() AND c.end_date >= NOW()`;
    }
    
    // Filter competitions user is eligible for (global competitions for now)
    if (user_competitions === 'true' && userId) {
      sql += ` AND (c.is_global = true OR JSON_CONTAINS(c.eligible_users, ?))`;
      params.push(JSON.stringify([userId]));
    }
    
    sql += ` ORDER BY c.created_at DESC`;
    
    const competitions = await query(sql, params);
    
    // Parse JSON fields and add participant count (simplified)
    const processedCompetitions = competitions.map(comp => ({
      ...comp,
      eligible_roles: comp.eligible_roles ? JSON.parse(comp.eligible_roles) : null,
      eligible_users: comp.eligible_users ? JSON.parse(comp.eligible_users) : null,
      participant_count: 0 // For now, we can enhance this later
    }));
    
    res.json(processedCompetitions);
  } catch (error) {
    console.error('Error fetching competitions:', error);
    res.status(500).json({ error: 'Failed to fetch competitions' });
  }
});

// GET /api/competitions/:id - Get specific competition with basic info
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;
    
    // Get competition details
    const competitionSql = `
      SELECT 
        c.*,
        au.lagnname as created_by_name,
        CASE 
          WHEN c.start_date <= NOW() AND c.end_date >= NOW() THEN 'active'
          WHEN c.start_date > NOW() THEN 'upcoming'
          WHEN c.end_date < NOW() THEN 'ended'
          ELSE c.status
        END as computed_status
      FROM competitions c
      LEFT JOIN activeusers au ON c.created_by = au.id
      WHERE c.id = ?
    `;
    
    const competitions = await query(competitionSql, [id]);
    
    if (competitions.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    
    const competition = competitions[0];
    
    // Parse JSON fields
    competition.eligible_roles = competition.eligible_roles ? JSON.parse(competition.eligible_roles) : null;
    competition.eligible_users = competition.eligible_users ? JSON.parse(competition.eligible_users) : null;
    
    // For now, we'll return basic competition info
    // Later we can enhance this to show actual participants from activeusers
    res.json({
      ...competition,
      participants: [],
      user_participation: null,
      is_participating: false,
      participant_count: 0
    });
  } catch (error) {
    console.error('Error fetching competition:', error);
    res.status(500).json({ error: 'Failed to fetch competition' });
  }
});

// POST /api/competitions - Create new competition
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const {
      title,
      description,
      prize,
      rules,
      start_date,
      end_date,
      competition_type = 'individual',
      metric_type,
      target_value,
      min_participants = 1,
      max_participants,
      is_global = false,
      eligible_roles,
      eligible_users,
      progress_calculation_type = 'sum'
    } = req.body;
    
    // Validation
    if (!title || !prize || !rules || !start_date || !end_date || !metric_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }
    
    const sql = `
      INSERT INTO competitions (
        title, description, prize, rules, start_date, end_date,
        competition_type, metric_type, target_value, min_participants, max_participants,
        is_global, eligible_roles, eligible_users, progress_calculation_type, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      title, description, prize, rules, start_date, end_date,
      competition_type, metric_type, target_value, min_participants, max_participants,
      is_global, 
      eligible_roles ? JSON.stringify(eligible_roles) : null,
      eligible_users ? JSON.stringify(eligible_users) : null,
      progress_calculation_type, userId
    ];
    
    const result = await query(sql, params);
    
    res.status(201).json({ 
      id: result.insertId, 
      message: 'Competition created successfully' 
    });
  } catch (error) {
    console.error('Error creating competition:', error);
    res.status(500).json({ error: 'Failed to create competition' });
  }
});

// PUT /api/competitions/:id - Update competition
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const isAdmin = req.user?.Role === 'Admin' || req.user?.clname === 'SGA';
    const updateFields = req.body;
    
    // Check if user has permission to update (creator or admin)
    const competitionCheck = await query('SELECT created_by FROM competitions WHERE id = ?', [id]);
    if (competitionCheck.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    
    // Allow creator or admins to update
    if (!isAdmin && competitionCheck[0].created_by !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Build dynamic update query
    const allowedFields = [
      'title', 'description', 'prize', 'rules', 'start_date', 'end_date',
      'status', 'competition_type', 'metric_type', 'target_value',
      'min_participants', 'max_participants', 'is_global',
      'eligible_roles', 'eligible_users', 'progress_calculation_type'
    ];
    
    const updateData = {};
    for (const field of allowedFields) {
      if (updateFields.hasOwnProperty(field)) {
        if (field === 'eligible_roles' || field === 'eligible_users') {
          updateData[field] = updateFields[field] ? JSON.stringify(updateFields[field]) : null;
        } else {
          updateData[field] = updateFields[field];
        }
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    const setClause = Object.keys(updateData).map(field => `${field} = ?`).join(', ');
    const sql = `UPDATE competitions SET ${setClause} WHERE id = ?`;
    const params = [...Object.values(updateData), id];
    
    await query(sql, params);
    
    res.json({ message: 'Competition updated successfully' });
  } catch (error) {
    console.error('Error updating competition:', error);
    res.status(500).json({ error: 'Failed to update competition' });
  }
});

// POST /api/competitions/:id/join - Simplified join (for future enhancement)
router.post('/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;
    
    // For now, just return success - we can enhance this later
    // to track participation in activeusers table or separate mechanism
    res.json({ message: 'Successfully joined competition' });
  } catch (error) {
    console.error('Error joining competition:', error);
    res.status(500).json({ error: 'Failed to join competition' });
  }
});

// DELETE /api/competitions/:id/leave - Simplified leave (for future enhancement)
router.delete('/:id/leave', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;
    
    // For now, just return success - we can enhance this later
    res.json({ message: 'Successfully left competition' });
  } catch (error) {
    console.error('Error leaving competition:', error);
    res.status(500).json({ error: 'Failed to leave competition' });
  }
});

// GET /api/competitions/:id/leaderboard - Simplified leaderboard (for future enhancement)
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    
    // For now, return empty leaderboard - we can enhance this later
    // to pull actual performance data from Daily_Activity or other sources
    res.json([]);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// POST /api/competitions/:id/update-progress - Update user progress (simplified for now)
router.post('/:id/update-progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, progress_value, progress_date = new Date().toISOString().split('T')[0], data_source = 'manual' } = req.body;
    const currentUserId = req.user?.id;
    
    // Validation
    if (!user_id || progress_value === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if competition exists
    const competitionCheck = await query('SELECT id FROM competitions WHERE id = ?', [id]);
    if (competitionCheck.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    
    // For now, just return success - we can enhance this later
    // to store progress in activeusers table or create a simple progress tracking system
    res.json({ message: 'Progress updated successfully', new_total: progress_value });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// GET /api/competitions/user/:userId/active - Get user's active competitions (simplified)
router.get('/user/:userId/active', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    
    // Users can only view their own competitions unless admin
    if (parseInt(userId) !== currentUserId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // For now, return all active global competitions
    // Later we can enhance this to check participation or eligibility
    const sql = `
      SELECT 
        c.*,
        CASE 
          WHEN c.start_date <= NOW() AND c.end_date >= NOW() THEN 'active'
          WHEN c.start_date > NOW() THEN 'upcoming'
          WHEN c.end_date < NOW() THEN 'ended'
          ELSE c.status
        END as computed_status
      FROM competitions c
      WHERE c.status = 'active' AND c.is_global = true
      ORDER BY c.end_date ASC
    `;
    
    const competitions = await query(sql, []);
    
    // Parse JSON fields and add basic participation info
    const processedCompetitions = competitions.map(comp => ({
      ...comp,
      eligible_roles: comp.eligible_roles ? JSON.parse(comp.eligible_roles) : null,
      eligible_users: comp.eligible_users ? JSON.parse(comp.eligible_users) : null,
      current_progress: 0,
      rank_position: null,
      joined_at: null
    }));
    
    res.json(processedCompetitions);
  } catch (error) {
    console.error('Error fetching user competitions:', error);
    res.status(500).json({ error: 'Failed to fetch user competitions' });
  }
});

module.exports = router;
