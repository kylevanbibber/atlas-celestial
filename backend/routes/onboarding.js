const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function findPipelineByEmail(email) {
  const rows = await db.query(
    `SELECT * FROM pipeline WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1`,
    [email]
  );
  return rows.length ? rows[0] : null;
}

async function createPipelineStep(pipelineId, step) {
  // Close any open step with same recruit
  await db.query(
    `UPDATE pipeline_steps SET date_exited = NOW() WHERE recruit_id = ? AND date_exited IS NULL`,
    [pipelineId]
  );
  await db.query(
    `INSERT INTO pipeline_steps (recruit_id, step, date_entered) VALUES (?, ?, NOW())`,
    [pipelineId, step]
  );
}

async function autoCompletePriorStages(pipelineId, targetStep) {
  // Determine which stages to complete based on targetStep
  let stagesToComplete = [];
  if (targetStep === 'On-boarding') {
    stagesToComplete = ['Overview', 'Final Decision', 'Licensing'];
  } else if (targetStep === 'Licensing') {
    stagesToComplete = ['Overview', 'Final Decision'];
  } else {
    return; // nothing
  }

  const items = await db.query(
    `SELECT id FROM pipeline_checklist_items 
     WHERE active = 1 AND stage_name IN (${stagesToComplete.map(() => '?').join(',')})`,
    stagesToComplete
  );

  if (!items.length) return;

  for (const row of items) {
    await db.query(
      `INSERT IGNORE INTO pipeline_checklist_progress 
       (recruit_id, checklist_item_id, completed, started_at, completed_at)
       VALUES (?, ?, 1, NOW(), NOW())`,
      [pipelineId, row.id]
    );
  }
}

// POST /api/onboarding/auth/start { email }
router.post('/auth/start', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });
    const record = await findPipelineByEmail(email);
    if (!record) return res.json({ success: true, exists: false, hasPassword: false });
    const hasPassword = Boolean(record.password && String(record.password).length >= 20); // rough check for hash
    return res.json({ success: true, exists: true, hasPassword });
  } catch (e) {
    console.error('onboarding/start error', e);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// POST /api/onboarding/auth/set-password { email, password }
router.post('/auth/set-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const record = await findPipelineByEmail(email);
    if (!record) return res.status(404).json({ success: false, message: 'Account not found' });
    const hash = await bcrypt.hash(password, 10);
    await db.query(`UPDATE pipeline SET password = ?, date_last_updated = NOW() WHERE id = ?`, [hash, record.id]);
    return res.json({ success: true, pipeline_id: record.id });
  } catch (e) {
    console.error('onboarding/set-password error', e);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// POST /api/onboarding/auth/login { email, password }
router.post('/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const record = await findPipelineByEmail(email);
    if (!record || !record.password) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, record.password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    return res.json({ success: true, pipeline_id: record.id, email });
  } catch (e) {
    console.error('onboarding/login error', e);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// POST /api/onboarding/auth/register
// body: { email, password, first, last, middle?, suffix?, phone?, resident_state?, licensed: boolean }
router.post('/auth/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const first = String(req.body.first || '').trim();
    const last = String(req.body.last || '').trim();
    const middle = String(req.body.middle || '').trim() || null;
    const suffix = String(req.body.suffix || '').trim() || null;
    const phone = String(req.body.phone || '').trim();
    const resident_state = String(req.body.resident_state || '').trim().toUpperCase() || null;
    const licensed = Boolean(req.body.licensed);

    if (!email || !password || !first || !last) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existing = await findPipelineByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const step = licensed ? 'On-boarding' : 'Licensing';
    const passwordHash = await bcrypt.hash(password, 10);

    const insert = await db.query(
      `INSERT INTO pipeline (
        email, password, recruit_first, recruit_middle, recruit_last, recruit_suffix,
        phone, resident_state, step, date_added, date_last_updated, referral_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
      [email, passwordHash, first, middle, last, suffix, phone, resident_state, step, 'Onboarding Portal']
    );

    const pipelineId = insert.insertId;
    await createPipelineStep(pipelineId, step);
    await autoCompletePriorStages(pipelineId, step);
    return res.json({ success: true, pipeline_id: pipelineId, step });
  } catch (e) {
    console.error('onboarding/register error', e);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// Stubs for forgot/reset to be completed later
router.post('/auth/forgot', async (req, res) => {
  return res.json({ success: true, message: 'If this email exists, a reset link will be sent.' });
});

router.post('/auth/reset', async (req, res) => {
  return res.json({ success: false, message: 'Reset flow not yet enabled.' });
});

module.exports = router;


