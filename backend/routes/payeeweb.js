const express = require('express');
const router = express.Router();
const { query } = require('../db');
const verifyToken = require('../middleware/verifyToken');

// Helper: fetch logged-in user's hierarchy info
async function getUserHierarchy(userId) {
  const rows = await query(
    'SELECT id, lagnname, agtnum, clname, sa, ga, mga, rga, Role, teamRole FROM activeusers WHERE id = ?',
    [userId]
  );
  return rows[0] || null;
}

// Helper: build JOIN + WHERE for hierarchy scoping
// Returns { joinClause, whereClause, params }
function buildHierarchyScope(user) {
  if (!user) return { joinClause: '', whereClause: '', params: [] };

  const isAdmin = user.Role === 'Admin' || user.Role === 'SuperAdmin' || user.teamRole === 'app';
  const level = (user.clname || '').toUpperCase();

  // SGA-level or admin sees everything — no join needed
  if (isAdmin || level === 'SGA') {
    return { joinClause: '', whereClause: '', params: [] };
  }

  const joinClause = `INNER JOIN activeusers au ON TRIM(p.agent_id) = TRIM(au.agtnum)`;
  let whereClause = '';
  const params = [];

  if (level === 'RGA') {
    whereClause = `AND (TRIM(au.rga) = TRIM(?) OR TRIM(au.lagnname) = TRIM(?))`;
    params.push(user.lagnname, user.lagnname);
  } else if (level === 'MGA') {
    whereClause = `AND (TRIM(au.mga) = TRIM(?) OR TRIM(au.lagnname) = TRIM(?))`;
    params.push(user.lagnname, user.lagnname);
  } else if (level === 'GA') {
    whereClause = `AND (TRIM(au.ga) = TRIM(?) OR TRIM(au.lagnname) = TRIM(?))`;
    params.push(user.lagnname, user.lagnname);
  } else if (level === 'SA') {
    whereClause = `AND (TRIM(au.sa) = TRIM(?) OR TRIM(au.lagnname) = TRIM(?))`;
    params.push(user.lagnname, user.lagnname);
  } else {
    // AGT — only their own production
    whereClause = `AND TRIM(au.agtnum) = TRIM(?)`;
    params.push(user.agtnum);
  }

  return { joinClause, whereClause, params };
}

// Helper: apply date range or single date filter
function applyDateFilter(sql, params, { start_date, end_date, report_date }) {
  if (start_date && end_date) {
    sql += ' AND report_date BETWEEN ? AND ?';
    params.push(start_date, end_date);
  } else if (report_date) {
    sql += ' AND report_date = ?';
    params.push(report_date);
  }
  return sql;
}

// Helper: deduplicate — keep only the latest row per policy within the date range
// A policy moving hold→released across weeks should only count once (as released)
function applyDedup(sql, params, { start_date, end_date, report_date }) {
  let dateScope = '';
  if (start_date && end_date) {
    dateScope = 'AND p2.report_date BETWEEN ? AND ?';
    params.push(start_date, end_date);
  } else if (report_date) {
    dateScope = 'AND p2.report_date = ?';
    params.push(report_date);
  }
  sql += ` AND p.id = (
    SELECT p2.id FROM payeeweb_business p2
    WHERE p2.policy_number = p.policy_number ${dateScope}
    ORDER BY p2.report_date DESC, p2.id DESC
    LIMIT 1
  )`;
  return sql;
}

// Helper: apply notify_trailer multi-select filter
// Expects comma-separated list e.g. "SMITH,JONES"
function applyTrailerFilter(sql, params, trailers) {
  if (!trailers) return sql;
  const list = trailers.split(',').map(t => t.trim()).filter(Boolean);
  if (list.length === 0) return sql;

  const hasBlank = list.includes('__blank__');
  const named = list.filter(t => t !== '__blank__');

  if (hasBlank && named.length > 0) {
    sql += ` AND (notify_trailer IS NULL OR notify_trailer = '' OR notify_trailer IN (${named.map(() => '?').join(',')}))`;
    params.push(...named);
  } else if (hasBlank) {
    sql += ` AND (notify_trailer IS NULL OR notify_trailer = '')`;
  } else {
    sql += ` AND notify_trailer IN (${named.map(() => '?').join(',')})`;
    params.push(...named);
  }
  return sql;
}

// GET /api/payeeweb/agent-summary
// Returns per-agent totals with queue breakdowns
router.get('/agent-summary', verifyToken, async (req, res) => {
  try {
    const { report_date, start_date, end_date, queue_type, trailers } = req.query;
    const user = await getUserHierarchy(req.userId);
    const scope = buildHierarchyScope(user);

    let sql = `
      SELECT
        p.agent_name,
        p.agent_id,
        COUNT(*) as total_policies,
        SUM(p.annualized_premium) as total_premium,
        SUM(CASE WHEN p.queue_type = 'immediate' THEN 1 ELSE 0 END) as immediate_count,
        SUM(CASE WHEN p.queue_type = 'immediate' THEN p.annualized_premium ELSE 0 END) as immediate_premium,
        SUM(CASE WHEN p.queue_type = 'hold' THEN 1 ELSE 0 END) as hold_count,
        SUM(CASE WHEN p.queue_type = 'hold' THEN p.annualized_premium ELSE 0 END) as hold_premium,
        SUM(CASE WHEN p.queue_type = 'released' THEN 1 ELSE 0 END) as released_count,
        SUM(CASE WHEN p.queue_type = 'released' THEN p.annualized_premium ELSE 0 END) as released_premium
      FROM payeeweb_business p
      ${scope.joinClause}
      WHERE 1=1 ${scope.whereClause}
    `;
    const params = [...scope.params];

    sql = applyDateFilter(sql, params, { start_date, end_date, report_date });
    sql = applyDedup(sql, params, { start_date, end_date, report_date });
    sql = applyTrailerFilter(sql, params, trailers);

    if (queue_type && queue_type !== 'all') {
      sql += ' AND p.queue_type = ?';
      params.push(queue_type);
    }

    sql += ' GROUP BY p.agent_name, p.agent_id ORDER BY total_premium DESC';

    const results = await query(sql, params);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[PayeeWeb API] agent-summary error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/payeeweb/agent-by-date
// Returns per-agent per-date totals for the date breakdown view
// date_field=submit_date (default) or date_field=production_date
router.get('/agent-by-date', verifyToken, async (req, res) => {
  try {
    const { report_date, start_date, end_date, date_field, trailers } = req.query;
    const col = date_field === 'production_date' ? 'p.production_date' : 'p.submit_date';
    const user = await getUserHierarchy(req.userId);
    const scope = buildHierarchyScope(user);

    let sql = `
      SELECT
        p.agent_name,
        p.agent_id,
        ${col} as date_value,
        COUNT(*) as total_policies,
        SUM(p.annualized_premium) as total_premium,
        SUM(CASE WHEN p.queue_type = 'immediate' THEN 1 ELSE 0 END) as immediate_count,
        SUM(CASE WHEN p.queue_type = 'immediate' THEN p.annualized_premium ELSE 0 END) as immediate_premium,
        SUM(CASE WHEN p.queue_type = 'hold' THEN 1 ELSE 0 END) as hold_count,
        SUM(CASE WHEN p.queue_type = 'hold' THEN p.annualized_premium ELSE 0 END) as hold_premium,
        SUM(CASE WHEN p.queue_type = 'released' THEN 1 ELSE 0 END) as released_count,
        SUM(CASE WHEN p.queue_type = 'released' THEN p.annualized_premium ELSE 0 END) as released_premium
      FROM payeeweb_business p
      ${scope.joinClause}
      WHERE 1=1 ${scope.whereClause}
    `;
    const params = [...scope.params];

    sql = applyDateFilter(sql, params, { start_date, end_date, report_date });
    sql = applyDedup(sql, params, { start_date, end_date, report_date });
    sql = applyTrailerFilter(sql, params, trailers);

    sql += ` GROUP BY p.agent_name, p.agent_id, ${col}
             ORDER BY p.agent_name, STR_TO_DATE(${col}, '%m/%d/%y')`;

    const results = await query(sql, params);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[PayeeWeb API] agent-by-date error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/payeeweb/notify-trailers
// Returns distinct notify_trailer values for the filter
router.get('/notify-trailers', verifyToken, async (req, res) => {
  try {
    const { report_date, start_date, end_date } = req.query;
    const user = await getUserHierarchy(req.userId);
    const scope = buildHierarchyScope(user);

    let sql = `SELECT DISTINCT p.notify_trailer FROM payeeweb_business p ${scope.joinClause} WHERE p.notify_trailer IS NOT NULL AND p.notify_trailer != '' ${scope.whereClause}`;
    const params = [...scope.params];
    sql = applyDateFilter(sql, params, { start_date, end_date, report_date });
    sql += ' ORDER BY p.notify_trailer';
    const results = await query(sql, params);
    res.json({ success: true, data: results.map(r => r.notify_trailer) });
  } catch (error) {
    console.error('[PayeeWeb API] notify-trailers error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/payeeweb/available-dates
// Returns distinct report dates for the date picker
router.get('/available-dates', verifyToken, async (req, res) => {
  try {
    const results = await query(
      `SELECT DISTINCT report_date, COUNT(*) as row_count
       FROM payeeweb_business
       GROUP BY report_date
       ORDER BY report_date DESC`
    );
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[PayeeWeb API] available-dates error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/payeeweb/detail
// Returns individual policy rows with optional filtering
router.get('/detail', verifyToken, async (req, res) => {
  try {
    const { report_date, start_date, end_date, queue_type, agent_name, trailers } = req.query;
    const user = await getUserHierarchy(req.userId);
    const scope = buildHierarchyScope(user);

    let sql = `SELECT p.* FROM payeeweb_business p ${scope.joinClause} WHERE 1=1 ${scope.whereClause}`;
    const params = [...scope.params];

    sql = applyDateFilter(sql, params, { start_date, end_date, report_date });
    sql = applyTrailerFilter(sql, params, trailers);

    if (queue_type && queue_type !== 'all') {
      sql += ' AND p.queue_type = ?';
      params.push(queue_type);
    }
    if (agent_name) {
      sql += ' AND p.agent_name = ?';
      params.push(agent_name);
    }

    sql += ' ORDER BY p.agent_name, p.submit_date DESC';

    const results = await query(sql, params);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[PayeeWeb API] detail error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/payeeweb/queue-summary
// Returns overall totals by queue type for summary cards
router.get('/queue-summary', verifyToken, async (req, res) => {
  try {
    const { report_date, start_date, end_date, trailers } = req.query;
    const user = await getUserHierarchy(req.userId);
    const scope = buildHierarchyScope(user);

    let sql = `
      SELECT
        p.queue_type,
        COUNT(*) as count,
        SUM(p.annualized_premium) as total_premium
      FROM payeeweb_business p
      ${scope.joinClause}
      WHERE 1=1 ${scope.whereClause}
    `;
    const params = [...scope.params];

    sql = applyDateFilter(sql, params, { start_date, end_date, report_date });
    sql = applyDedup(sql, params, { start_date, end_date, report_date });
    sql = applyTrailerFilter(sql, params, trailers);

    sql += ' GROUP BY p.queue_type';

    const results = await query(sql, params);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[PayeeWeb API] queue-summary error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
