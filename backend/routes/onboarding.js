const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const emailService = require('../services/emailService');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Helper function to resolve recruiting_agent and code_to from hm parameter
async function resolveRecruitingInfo(hmUserId) {
  if (!hmUserId) return { recruiting_agent: null, code_to: null };
  
  try {
    // Get the user specified by hm
    const userRows = await db.query(
      'SELECT id, clname, sa, ga, mga, rga, lagnname FROM activeusers WHERE id = ? LIMIT 1',
      [hmUserId]
    );
    
    if (!userRows || userRows.length === 0) {
      return { recruiting_agent: null, code_to: null };
    }
    
    const user = userRows[0];
    const recruiting_agent = user.id;
    
    // If user is SA, GA, MGA, or RGA, they are the code_to
    if (['SA', 'GA', 'MGA', 'RGA'].includes(user.clname)) {
      return { recruiting_agent, code_to: user.id };
    }
    
    // Otherwise, find the next manager in line (sa -> ga -> mga -> rga)
    const managerLagnname = user.sa || user.ga || user.mga || user.rga;
    
    if (!managerLagnname) {
      return { recruiting_agent, code_to: null };
    }
    
    // Find the manager's id by lagnname
    const managerRows = await db.query(
      'SELECT id FROM activeusers WHERE lagnname = ? LIMIT 1',
      [managerLagnname]
    );
    
    if (!managerRows || managerRows.length === 0) {
      return { recruiting_agent, code_to: null };
    }
    
    return { recruiting_agent, code_to: managerRows[0].id };
  } catch (error) {
    console.error('Error resolving recruiting info:', error);
    return { recruiting_agent: null, code_to: null };
  }
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

// GET /api/onboarding/hiring-managers - Get list of eligible hiring managers
router.get('/hiring-managers', async (req, res) => {
  try {
    const managers = await db.query(
      `SELECT id, lagnname, clname 
       FROM activeusers 
       WHERE clname IN ('SA', 'GA', 'MGA', 'RGA') 
       AND Active = 'y' 
       ORDER BY lagnname ASC`
    );
    
    return res.json({ success: true, managers });
  } catch (e) {
    console.error('onboarding/hiring-managers error', e);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// POST /api/onboarding/auth/start { email }
router.post('/auth/start', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });
    const record = await findPipelineByEmail(email);
    if (!record) {
      return res.json({ success: true, exists: false, needsRegistration: true });
    }
    
    // If redeemed = 0, user needs to complete registration (fill missing fields + set password)
    if (record.redeemed === 0 || !record.redeemed) {
      // Determine which fields are missing
      const missingFields = [];
      if (!record.recruit_first) missingFields.push('first');
      if (!record.recruit_last) missingFields.push('last');
      if (!record.phone) missingFields.push('phone');
      if (!record.resident_state) missingFields.push('resident_state');
      
      return res.json({
        success: true,
        exists: true,
        needsCompletion: true,
        missingFields,
        existingData: {
          email: record.email,
          first: record.recruit_first || '',
          middle: record.recruit_middle || '',
          last: record.recruit_last || '',
          suffix: record.recruit_suffix || '',
          phone: record.phone || '',
          resident_state: record.resident_state || ''
        }
      });
    }
    
    // User is redeemed, check if they have a password
    const hasPassword = Boolean(record.password && String(record.password).length >= 20);
    return res.json({ success: true, exists: true, hasPassword, needsCompletion: false });
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
    
    // Generate JWT token for onboarding user
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        id: record.id,
        email: record.email,
        first_name: record.first_name,
        last_name: record.last_name,
        role: 'onboarding', // Special role for onboarding users
        pipeline_id: record.id
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    return res.json({ 
      success: true, 
      pipeline_id: record.id, 
      email,
      token 
    });
  } catch (e) {
    console.error('onboarding/login error', e);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// POST /api/onboarding/auth/register
// body: { email, password, first, last, middle?, suffix?, phone?, resident_state?, licensed: boolean, hm?: string }
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
    const instagram = String(req.body.instagram || '').trim().replace(/^@/, '') || null; // Remove @ if present
    const birthday = req.body.birthday ? String(req.body.birthday).trim() : null;
    const licensed = Boolean(req.body.licensed);
    const text_opt_in = req.body.text_opt_in ? 1 : 0;
    const hm = req.body.hm || null;

    console.log('[onboarding/register] Received hm parameter:', hm);

    if (!email || !password || !first || !last) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Resolve recruiting_agent and code_to from hm parameter
    let { recruiting_agent, code_to } = await resolveRecruitingInfo(hm);
    
    // Default to 92 if no hiring manager was specified
    if (!recruiting_agent) recruiting_agent = 92;
    if (!code_to) code_to = 92;
    
    console.log('[onboarding/register] Resolved recruiting info:', { recruiting_agent, code_to, hm });

    const existing = await findPipelineByEmail(email);
    
    // If user exists and redeemed = 0, update their record instead of creating new
    if (existing && (existing.redeemed === 0 || !existing.redeemed)) {
      const passwordHash = await bcrypt.hash(password, 10);
      const step = licensed ? 'On-boarding' : 'Licensing';
      
      await db.query(
        `UPDATE pipeline SET
          password = ?,
          recruit_first = ?,
          recruit_middle = ?,
          recruit_last = ?,
          recruit_suffix = ?,
          phone = ?,
          instagram = ?,
          birthday = ?,
          resident_state = ?,
          text_opt_in = ?,
          step = ?,
          redeemed = 1,
          recruiting_agent = COALESCE(?, recruiting_agent),
          code_to = COALESCE(?, code_to),
          date_last_updated = NOW()
        WHERE id = ?`,
        [passwordHash, first, middle, last, suffix, phone, instagram, birthday, resident_state, text_opt_in, step, recruiting_agent, code_to, existing.id]
      );
      
      // Update pipeline step if changed
      if (existing.step !== step) {
        await createPipelineStep(existing.id, step);
        await autoCompletePriorStages(existing.id, step);
      }
      
      return res.json({ success: true, pipeline_id: existing.id, step });
    }
    
    // User already redeemed
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Create new pipeline record
    const step = licensed ? 'On-boarding' : 'Licensing';
    const passwordHash = await bcrypt.hash(password, 10);

    const insert = await db.query(
      `INSERT INTO pipeline (
        email, password, recruit_first, recruit_middle, recruit_last, recruit_suffix,
        phone, instagram, birthday, resident_state, text_opt_in, step, redeemed, recruiting_agent, code_to,
        date_added, date_last_updated, referral_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NOW(), NOW(), ?)`,
      [email, passwordHash, first, middle, last, suffix, phone, instagram, birthday, resident_state, text_opt_in, step, recruiting_agent, code_to, 'Onboarding Portal']
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

// Forgot password - generate token and send email
router.post('/auth/forgot', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if user exists in pipeline
    const user = await findPipelineByEmail(email);
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If this email exists, a reset link will be sent.' });
    }

    // Generate secure reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store token in database
    await db.query(
      `INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (?, ?, ?)`,
      [email, token, expiresAt]
    );

    // Build reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding/reset-password?token=${token}`;

    // Send email
    const fullName = `${user.recruit_first || ''} ${user.recruit_last || ''}`.trim() || 'there';
    const emailSubject = 'Reset Your Onboarding Portal Password';
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00558c;">Password Reset Request</h2>
        <p>Hi ${fullName},</p>
        <p>We received a request to reset your password for the Arias Life Onboarding Portal.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #00558c; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <a href="${resetLink}">${resetLink}</a>
        </p>
        <p style="color: #666; font-size: 14px;">
          This link will expire in 1 hour for security reasons.
        </p>
        <p style="color: #666; font-size: 14px;">
          If you didn't request this password reset, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          Arias Life Onboarding Portal
        </p>
      </div>
    `;
    
    await emailService.sendEmail(email, emailSubject, emailBody);

    console.log('[Onboarding] Password reset email sent to:', email);
    
    return res.json({ 
      success: true, 
      message: 'If this email exists, a reset link will be sent.' 
    });
  } catch (error) {
    console.error('[Onboarding] Error in forgot password:', error);
    return res.json({ 
      success: true, 
      message: 'If this email exists, a reset link will be sent.' 
    });
  }
});

// Validate reset token
router.get('/auth/validate-reset-token', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    // Check if token exists and is valid
    const tokenData = await db.query(
      `SELECT * FROM password_reset_tokens 
       WHERE token = ? AND expires_at > NOW() AND used = 0 
       LIMIT 1`,
      [token]
    );

    if (!tokenData || tokenData.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }

    return res.json({ 
      success: true, 
      email: tokenData[0].email 
    });
  } catch (error) {
    console.error('[Onboarding] Error validating reset token:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error validating token' 
    });
  }
});

// Reset password with token
router.post('/auth/reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters' 
      });
    }

    // Validate token
    const tokenData = await db.query(
      `SELECT * FROM password_reset_tokens 
       WHERE token = ? AND expires_at > NOW() AND used = 0 
       LIMIT 1`,
      [token]
    );

    if (!tokenData || tokenData.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }

    const email = tokenData[0].email;

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password in pipeline table
    await db.query(
      `UPDATE pipeline SET password = ?, date_last_updated = NOW() WHERE email = ?`,
      [passwordHash, email]
    );

    // Mark token as used
    await db.query(
      `UPDATE password_reset_tokens SET used = 1 WHERE token = ?`,
      [token]
    );

    console.log('[Onboarding] Password reset successful for:', email);

    return res.json({ 
      success: true, 
      message: 'Password reset successful. You can now log in with your new password.' 
    });
  } catch (error) {
    console.error('[Onboarding] Error resetting password:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error resetting password. Please try again.' 
    });
  }
});

module.exports = router;


