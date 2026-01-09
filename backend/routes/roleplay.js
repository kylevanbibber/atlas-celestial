/**
 * Roleplay Training Routes
 * AI Sales Roleplay Call Simulator
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { query } = require('../db');
const { generateProspectReply, scoreRoleplaySession } = require('../services/openaiService');

// Validation constants
const MAX_SCRIPT_NAME_LENGTH = 255;
const MAX_SCRIPT_TEXT_LENGTH = 10000;
const MAX_GOAL_TEXT_LENGTH = 2000;
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Calculate difficulty based on objection count
 * @param {Array} objections - Array of objections
 * @returns {string} - 'easy', 'medium', or 'hard'
 */
function calculateDifficulty(objections) {
  if (!objections || !Array.isArray(objections)) return 'easy';
  
  const count = objections.length;
  if (count <= 1) return 'easy';
  if (count <= 3) return 'medium';
  return 'hard';
}

// ==============================================
// SCRIPTS ENDPOINTS
// ==============================================

/**
 * GET /api/training/roleplay/scripts
 * Get all scripts available to the user (their own + global scripts)
 */
router.get('/scripts', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user's own scripts + global scripts (user_id IS NULL)
    const scripts = await query(`
      SELECT id, name, type, script_text, goal_text, objections, difficulty, user_id, is_active, created_at, updated_at
      FROM roleplay_scripts
      WHERE (user_id = ? OR user_id IS NULL) AND is_active = 1
      ORDER BY user_id IS NULL ASC, name ASC
    `, [userId]);

    // Parse JSON fields and calculate difficulty if not set
    const parsedScripts = scripts.map(script => {
      const objections = safeParseJSON(script.objections, []);
      const difficulty = script.difficulty || calculateDifficulty(objections);
      
      return {
        ...script,
        objections,
        difficulty,
        objectionCount: objections.length,
        isGlobal: script.user_id === null,
        isOwner: script.user_id === userId
      };
    });

    res.json({ success: true, data: parsedScripts });
  } catch (error) {
    console.error('[Roleplay] Error fetching scripts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch scripts' });
  }
});

/**
 * GET /api/training/roleplay/scripts/:id
 * Get a specific script by ID
 */
router.get('/scripts/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const scriptId = req.params.id;

    const [script] = await query(`
      SELECT id, name, type, script_text, goal_text, objections, difficulty, user_id, is_active, created_at, updated_at
      FROM roleplay_scripts
      WHERE id = ? AND (user_id = ? OR user_id IS NULL) AND is_active = 1
    `, [scriptId, userId]);

    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    const objections = safeParseJSON(script.objections, []);
    const difficulty = script.difficulty || calculateDifficulty(objections);

    res.json({
      success: true,
      data: {
        ...script,
        objections,
        difficulty,
        objectionCount: objections.length,
        isGlobal: script.user_id === null,
        isOwner: script.user_id === userId
      }
    });
  } catch (error) {
    console.error('[Roleplay] Error fetching script:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch script' });
  }
});

/**
 * POST /api/training/roleplay/scripts
 * Create a new user script
 */
router.post('/scripts', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, type = 'phone', scriptText, goalText, rebuttals } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Script name is required' });
    }
    if (name.length > MAX_SCRIPT_NAME_LENGTH) {
      return res.status(400).json({ success: false, message: `Script name must be under ${MAX_SCRIPT_NAME_LENGTH} characters` });
    }
    if (scriptText && scriptText.length > MAX_SCRIPT_TEXT_LENGTH) {
      return res.status(400).json({ success: false, message: `Script text must be under ${MAX_SCRIPT_TEXT_LENGTH} characters` });
    }
    if (goalText && goalText.length > MAX_GOAL_TEXT_LENGTH) {
      return res.status(400).json({ success: false, message: `Goal text must be under ${MAX_GOAL_TEXT_LENGTH} characters` });
    }

    // Validate rebuttals JSON structure
    let rebuttalsJson = null;
    if (rebuttals) {
      if (!Array.isArray(rebuttals)) {
        return res.status(400).json({ success: false, message: 'Rebuttals must be an array' });
      }
      rebuttalsJson = JSON.stringify(rebuttals);
    }

    // Calculate difficulty based on objection count
    const difficulty = calculateDifficulty(rebuttals);

    const result = await query(`
      INSERT INTO roleplay_scripts (user_id, name, type, script_text, goal_text, objections, difficulty, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    `, [userId, name.trim(), type, scriptText || null, goalText || null, rebuttalsJson, difficulty]);

    res.status(201).json({ 
      success: true, 
      data: { id: result.insertId },
      message: 'Script created successfully'
    });
  } catch (error) {
    console.error('[Roleplay] Error creating script:', error);
    res.status(500).json({ success: false, message: 'Failed to create script' });
  }
});

/**
 * PUT /api/training/roleplay/scripts/:id
 * Update a user's own script (cannot edit global scripts)
 */
router.put('/scripts/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const scriptId = req.params.id;
    const { name, type, scriptText, goalText, rebuttals } = req.body;

    // Check ownership
    const [script] = await query(`
      SELECT id, user_id FROM roleplay_scripts WHERE id = ?
    `, [scriptId]);

    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    if (script.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'You can only edit your own scripts' });
    }

    // Validation
    if (name && name.length > MAX_SCRIPT_NAME_LENGTH) {
      return res.status(400).json({ success: false, message: `Script name must be under ${MAX_SCRIPT_NAME_LENGTH} characters` });
    }
    if (scriptText && scriptText.length > MAX_SCRIPT_TEXT_LENGTH) {
      return res.status(400).json({ success: false, message: `Script text must be under ${MAX_SCRIPT_TEXT_LENGTH} characters` });
    }
    if (goalText && goalText.length > MAX_GOAL_TEXT_LENGTH) {
      return res.status(400).json({ success: false, message: `Goal text must be under ${MAX_GOAL_TEXT_LENGTH} characters` });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (scriptText !== undefined) { updates.push('script_text = ?'); params.push(scriptText); }
    if (goalText !== undefined) { updates.push('goal_text = ?'); params.push(goalText); }
    if (rebuttals !== undefined) { 
      updates.push('objections = ?'); 
      params.push(Array.isArray(rebuttals) ? JSON.stringify(rebuttals) : null);
      
      // Recalculate difficulty when objections change
      const difficulty = calculateDifficulty(rebuttals);
      updates.push('difficulty = ?');
      params.push(difficulty);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(scriptId);

    await query(`UPDATE roleplay_scripts SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Script updated successfully' });
  } catch (error) {
    console.error('[Roleplay] Error updating script:', error);
    res.status(500).json({ success: false, message: 'Failed to update script' });
  }
});

// ==============================================
// SESSIONS ENDPOINTS
// ==============================================

/**
 * GET /api/training/roleplay/sessions
 * Get past sessions for the user (optionally filtered by scriptId)
 */
router.get('/sessions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { scriptId } = req.query;

    let sql = `
      SELECT 
        s.id, s.script_id, s.type, s.difficulty, s.duration, s.status, s.outcome_json, s.score_json, s.created_at,
        rs.name as script_name
      FROM roleplay_sessions s
      LEFT JOIN roleplay_scripts rs ON s.script_id = rs.id
      WHERE s.user_id = ?
    `;
    const params = [userId];

    if (scriptId) {
      sql += ' AND s.script_id = ?';
      params.push(scriptId);
    }

    sql += ' ORDER BY s.created_at DESC LIMIT 50';

    const sessions = await query(sql, params);

    // Parse JSON fields
    const parsedSessions = sessions.map(session => ({
      ...session,
      outcome_json: safeParseJSON(session.outcome_json, null),
      score_json: safeParseJSON(session.score_json, null)
    }));

    res.json({ success: true, data: parsedSessions });
  } catch (error) {
    console.error('[Roleplay] Error fetching sessions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

/**
 * GET /api/training/roleplay/sessions/:id
 * Get a specific session with messages and results
 */
router.get('/sessions/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessionId = req.params.id;

    // Get session with script info
    const [session] = await query(`
      SELECT 
        s.*, 
        rs.name as script_name, rs.script_text, rs.goal_text, rs.objections
      FROM roleplay_sessions s
      LEFT JOIN roleplay_scripts rs ON s.script_id = rs.id
      WHERE s.id = ? AND s.user_id = ?
    `, [sessionId, userId]);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Get messages
    const messages = await query(`
      SELECT id, role, content, created_at
      FROM roleplay_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `, [sessionId]);

    res.json({ 
      success: true, 
      data: {
        ...session,
        transcript: safeParseJSON(session.transcript, null),
        objections_faced: safeParseJSON(session.objections_faced, null),
        outcome_json: safeParseJSON(session.outcome_json, null),
        score_json: safeParseJSON(session.score_json, null),
        objections: safeParseJSON(session.objections, []),
        messages
      }
    });
  } catch (error) {
    console.error('[Roleplay] Error fetching session:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch session' });
  }
});

/**
 * POST /api/training/roleplay/sessions
 * Start a new roleplay session
 */
router.post('/sessions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { scriptId, difficulty } = req.body;

    if (!scriptId) {
      return res.status(400).json({ success: false, message: 'Script ID is required' });
    }

    // Validate difficulty
    const validDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';

    // Verify script exists and user has access
    const [script] = await query(`
      SELECT id, type, script_text, goal_text, objections
      FROM roleplay_scripts
      WHERE id = ? AND (user_id = ? OR user_id IS NULL) AND is_active = 1
    `, [scriptId, userId]);

    if (!script) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    // Create session with difficulty
    const result = await query(`
      INSERT INTO roleplay_sessions (user_id, script_id, type, difficulty, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', NOW(), NOW())
    `, [userId, scriptId, script.type || 'phone', validDifficulty]);

    // Create initial system message to set the scene
    const openingMessage = "Hello?";
    await query(`
      INSERT INTO roleplay_messages (session_id, role, content, created_at)
      VALUES (?, 'ai', ?, NOW())
    `, [result.insertId, openingMessage]);

    res.status(201).json({ 
      success: true, 
      data: { 
        id: result.insertId,
        scriptId,
        type: script.type || 'phone',
        status: 'active',
        initialMessage: openingMessage
      },
      message: 'Session started'
    });
  } catch (error) {
    console.error('[Roleplay] Error starting session:', error);
    res.status(500).json({ success: false, message: 'Failed to start session' });
  }
});

/**
 * POST /api/training/roleplay/sessions/:id/message
 * Send a message in an active session and get AI response
 */
router.post('/sessions/:id/message', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessionId = req.params.id;
    const { content } = req.body;

    // Validation
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, message: `Message must be under ${MAX_MESSAGE_LENGTH} characters` });
    }

    // Verify session ownership and status
    const [session] = await query(`
      SELECT s.id, s.status, s.script_id, s.difficulty, rs.script_text, rs.goal_text, rs.objections
      FROM roleplay_sessions s
      LEFT JOIN roleplay_scripts rs ON s.script_id = rs.id
      WHERE s.id = ? AND s.user_id = ?
    `, [sessionId, userId]);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Session is not active' });
    }

    // Save user message
    await query(`
      INSERT INTO roleplay_messages (session_id, role, content, created_at)
      VALUES (?, 'user', ?, NOW())
    `, [sessionId, content.trim()]);

    // Get conversation history
    const messages = await query(`
      SELECT role, content FROM roleplay_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `, [sessionId]);

    // Generate AI response with difficulty
    const aiResponse = await generateProspectReply({
      scriptText: session.script_text,
      goalText: session.goal_text,
      rebuttals: safeParseJSON(session.objections, []),
      messages,
      difficulty: session.difficulty || 'medium'
    });

    // Save AI response
    await query(`
      INSERT INTO roleplay_messages (session_id, role, content, created_at)
      VALUES (?, 'ai', ?, NOW())
    `, [sessionId, aiResponse]);

    // Update session timestamp
    await query(`UPDATE roleplay_sessions SET updated_at = NOW() WHERE id = ?`, [sessionId]);

    res.json({ 
      success: true, 
      data: { 
        userMessage: content.trim(),
        aiResponse 
      }
    });
  } catch (error) {
    console.error('[Roleplay] Error sending message:', error);
    res.status(500).json({ success: false, message: 'Failed to process message' });
  }
});

/**
 * POST /api/training/roleplay/sessions/:id/end
 * End a session and get scoring/feedback
 */
router.post('/sessions/:id/end', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessionId = req.params.id;
    const { duration: providedDuration } = req.body;

    // Verify session ownership and status
    const [session] = await query(`
      SELECT s.id, s.status, s.script_id, rs.script_text, rs.goal_text, rs.objections
      FROM roleplay_sessions s
      LEFT JOIN roleplay_scripts rs ON s.script_id = rs.id
      WHERE s.id = ? AND s.user_id = ?
    `, [sessionId, userId]);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Session is already ended' });
    }

    // Get all messages for scoring
    const messages = await query(`
      SELECT role, content FROM roleplay_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `, [sessionId]);

    // Use the duration provided by the frontend (already tracked with timer)
    // This avoids timezone conversion issues with MySQL timestamps
    const duration = providedDuration || 0;

    // Score the session
    let scoringResult;
    try {
      scoringResult = await scoreRoleplaySession({
        scriptText: session.script_text,
        goalText: session.goal_text,
        rebuttals: safeParseJSON(session.objections, []),
        transcript: messages
      });
    } catch (scoringError) {
      console.error('[Roleplay] Scoring failed:', scoringError);
      scoringResult = {
        appointmentBooked: false,
        appointmentDetails: null,
        rubric: { discovery: 3, objectionHandling: 3, clarity: 3, nextStepAsk: 3 },
        strengths: ['Completed the roleplay session'],
        improvements: ['Scoring unavailable - try again later'],
        betterPhrasing: []
      };
    }

    // Calculate overall score (average of rubric * 20 to get 0-100)
    const rubricValues = Object.values(scoringResult.rubric || {});
    const avgRubric = rubricValues.length > 0 
      ? rubricValues.reduce((a, b) => a + b, 0) / rubricValues.length 
      : 3;
    const overallScore = Math.round(avgRubric * 20);

    // Update session
    await query(`
      UPDATE roleplay_sessions 
      SET status = 'completed', 
          duration = ?,
          score = ?,
          outcome_json = ?,
          score_json = ?,
          transcript = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [
      duration,
      overallScore,
      JSON.stringify({ appointmentBooked: scoringResult.appointmentBooked, appointmentDetails: scoringResult.appointmentDetails }),
      JSON.stringify(scoringResult),
      JSON.stringify(messages),
      sessionId
    ]);

    res.json({ 
      success: true, 
      data: {
        sessionId,
        duration,
        overallScore,
        ...scoringResult
      },
      message: 'Session ended and scored'
    });
  } catch (error) {
    console.error('[Roleplay] Error ending session:', error);
    res.status(500).json({ success: false, message: 'Failed to end session' });
  }
});

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Safely parse JSON string
 */
function safeParseJSON(str, defaultValue = null) {
  if (!str) return defaultValue;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
}

module.exports = router;

