const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const results = await db.query('SELECT Role FROM activeusers WHERE id = ?', [req.userId]);
    if (results.length > 0 && results[0].Role === 'Admin') {
      next();
    } else {
      res.status(403).json({ error: 'Access denied. Admin permissions required.' });
    }
  } catch (error) {
    logger.error('Error checking admin permissions:', error);
    res.status(500).json({ error: 'Failed to verify permissions' });
  }
};

// Build recipient query based on filters
function buildRecipientQuery(filters) {
  let filterConditions = [];
  let params = [];
  let baseConditions = [];

  // Base conditions (always required)
  baseConditions.push('email IS NOT NULL');
  baseConditions.push('email != ""');

  // Active filter
  if (filters.activeOnly !== false) {
    baseConditions.push('Active = "y"');
  }

  // Manager Active filter
  if (filters.managerActiveOnly === true) {
    baseConditions.push('managerActive = "y"');
  }

  // Build filter conditions (these will be OR'ed together)
  if (filters.clname && filters.clname.length > 0) {
    filterConditions.push(`clname IN (${filters.clname.map(() => '?').join(', ')})`);
    params.push(...filters.clname);
  }

  if (filters.esidMin !== undefined && filters.esidMax !== undefined && filters.esidMin !== '' && filters.esidMax !== '') {
    filterConditions.push('esid BETWEEN ? AND ?');
    params.push(filters.esidMin, filters.esidMax);
  } else if (filters.esidMin !== undefined && filters.esidMin !== '') {
    filterConditions.push('esid >= ?');
    params.push(filters.esidMin);
  } else if (filters.esidMax !== undefined && filters.esidMax !== '') {
    filterConditions.push('esid <= ?');
    params.push(filters.esidMax);
  }

  if (filters.lagnname && filters.lagnname.length > 0) {
    filterConditions.push(`lagnname IN (${filters.lagnname.map(() => '?').join(', ')})`);
    params.push(...filters.lagnname);
  }

  // Combine all conditions
  let whereClause = `WHERE ${baseConditions.join(' AND ')}`;
  
  if (filterConditions.length > 0) {
    whereClause += ` AND (${filterConditions.join(' OR ')})`;
  }
  
  const query = `
    SELECT id, email, lagnname, clname, esid, phone, teamRole
    FROM activeusers
    ${whereClause}
  `;

  return { query, params };
}

// GET /api/email-campaigns - List all campaigns
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const campaigns = await db.query(`
      SELECT 
        ec.*,
        et.name as template_name,
        au.lagnname as creator_name,
        (SELECT COUNT(*) FROM email_recipients WHERE campaign_id = ec.id) as recipient_count,
        (SELECT COUNT(*) FROM email_recipients WHERE campaign_id = ec.id AND status = 'sent') as sent_count,
        (SELECT COUNT(*) FROM email_recipients WHERE campaign_id = ec.id AND status = 'failed') as failed_count
      FROM email_campaigns ec
      LEFT JOIN email_templates et ON ec.template_id = et.id
      LEFT JOIN activeusers au ON ec.created_by = au.id
      ORDER BY ec.created_at DESC
    `);

    res.json({ success: true, campaigns });
  } catch (error) {
    logger.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /api/email-campaigns/test-connection - Test email configuration
router.get('/test-connection', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await emailService.testConnection();
    res.json(result);
  } catch (error) {
    logger.error('Error testing email connection:', error);
    res.status(500).json({ success: false, message: 'Connection test failed' });
  }
});

// POST /api/email-campaigns/test-weekly-report - Test weekly report for a specific user
router.post('/test-weekly-report', verifyToken, isAdmin, async (req, res) => {
  try {
    const { lagnname } = req.body;
    
    if (!lagnname) {
      return res.status(400).json({ error: 'lagnname required' });
    }

    // Get user
    const users = await db.query(
      'SELECT id, lagnname, email, clname, screen_name FROM activeusers WHERE lagnname = ? AND Active = "y" LIMIT 1',
      [lagnname]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Generate, send, and log the test report
    const { sendTestWeeklyReport } = require('../services/weeklyReportEmailService');
    const { reportData, runId } = await sendTestWeeklyReport(user, req.userId);

    res.json({ 
      success: true, 
      message: `Test report sent to ${user.email}`,
      reportData,
      runId
    });
  } catch (error) {
    logger.error('Error sending test weekly report:', error);
    res.status(500).json({ error: 'Failed to send test report', details: error.message });
  }
});

// POST /api/email-campaigns/send-all-weekly-reports - Manually trigger all weekly reports
router.post('/send-all-weekly-reports', verifyToken, isAdmin, async (req, res) => {
  try {
    const { sendWeeklyReports } = require('../services/weeklyReportEmailService');
    
    // Send this asynchronously
    setImmediate(async () => {
      try {
        await sendWeeklyReports('manual', req.userId);
      } catch (error) {
        logger.error('Error in manual weekly reports send:', error);
      }
    });

    res.json({ 
      success: true, 
      message: 'Weekly reports are being sent in the background. Check server logs for progress.' 
    });
  } catch (error) {
    logger.error('Error triggering weekly reports:', error);
    res.status(500).json({ error: 'Failed to trigger weekly reports' });
  }
});

// GET /api/email-campaigns/weekly-report-runs - Get weekly report run history
router.get('/weekly-report-runs', verifyToken, isAdmin, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const runs = await db.query(`
      SELECT 
        r.*,
        au.lagnname as triggered_by_name
      FROM weekly_report_runs r
      LEFT JOIN activeusers au ON r.triggered_by_user_id = au.id
      ORDER BY r.started_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);

    const countResult = await db.query('SELECT COUNT(*) as total FROM weekly_report_runs');
    const total = countResult[0]?.total || 0;

    res.json({ success: true, runs, total });
  } catch (error) {
    logger.error('Error fetching weekly report runs:', error);
    res.status(500).json({ error: 'Failed to fetch weekly report runs' });
  }
});

// GET /api/email-campaigns/weekly-report-runs/:runId/recipients - Get recipients for a specific run
router.get('/weekly-report-runs/:runId/recipients', verifyToken, isAdmin, async (req, res) => {
  try {
    const { runId } = req.params;
    const { status, search, limit = 100, offset = 0 } = req.query;

    let whereClause = 'WHERE rr.run_id = ?';
    const params = [parseInt(runId)];

    if (status && status !== 'all') {
      whereClause += ' AND rr.status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (rr.lagnname LIKE ? OR rr.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const recipients = await db.query(`
      SELECT rr.*
      FROM weekly_report_recipients rr
      ${whereClause}
      ORDER BY rr.lagnname ASC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM weekly_report_recipients rr ${whereClause}
    `, params);
    const total = countResult[0]?.total || 0;

    res.json({ success: true, recipients, total });
  } catch (error) {
    logger.error('Error fetching weekly report recipients:', error);
    res.status(500).json({ error: 'Failed to fetch weekly report recipients' });
  }
});

// GET /api/email-variables - Get available variables
router.get('/variables', verifyToken, isAdmin, async (req, res) => {
  try {
    const variables = await db.query(
      'SELECT * FROM email_variables WHERE is_active = TRUE ORDER BY variable_name'
    );

    res.json({ success: true, variables });
  } catch (error) {
    logger.error('Error fetching variables:', error);
    res.status(500).json({ error: 'Failed to fetch variables' });
  }
});

// GET /api/email-templates - List all templates
router.get('/templates/list', verifyToken, isAdmin, async (req, res) => {
  try {
    const templates = await db.query(`
      SELECT 
        et.*,
        au.lagnname as creator_name
      FROM email_templates et
      LEFT JOIN activeusers au ON et.created_by = au.id
      ORDER BY et.created_at DESC
    `);

    res.json({ success: true, templates });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/email-templates - Create template
router.post('/templates', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, subject, body, variables } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      'INSERT INTO email_templates (name, subject, body, variables, created_by) VALUES (?, ?, ?, ?, ?)',
      [name, subject, body, JSON.stringify(variables || []), req.userId]
    );

    res.json({ success: true, templateId: result.insertId });
  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// POST /api/email-campaigns/preview-recipients - Preview recipients based on filters
router.post('/preview-recipients', verifyToken, isAdmin, async (req, res) => {
  try {
    const { recipientFilter } = req.body;

    if (!recipientFilter) {
      return res.status(400).json({ error: 'Recipient filter required' });
    }

    const { query, params } = buildRecipientQuery(recipientFilter);
    const recipients = await db.query(query, params);

    res.json({ 
      success: true, 
      recipients,
      count: recipients.length 
    });
  } catch (error) {
    logger.error('Error previewing recipients:', error);
    res.status(500).json({ error: 'Failed to preview recipients' });
  }
});

// POST /api/email-campaigns - Create new campaign
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, templateId, subject, body, recipientFilter } = req.body;

    if (!name || !subject || !body || !recipientFilter) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      `INSERT INTO email_campaigns (name, template_id, subject, body, recipient_filter, created_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, templateId || null, subject, body, JSON.stringify(recipientFilter), req.userId]
    );

    res.json({ success: true, campaignId: result.insertId });
  } catch (error) {
    logger.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// ============================================================
// Email Log — Unified view of all outbound emails
// NOTE: These routes MUST be before /:id to avoid being caught by Express param matching
// ============================================================

// GET /api/email-campaigns/email-log — list batches
router.get('/email-log', verifyToken, isAdmin, async (req, res) => {
  try {
    const { source, limit = 50, offset = 0 } = req.query;

    let whereClause = '';
    const params = [];

    if (source) {
      whereClause = 'WHERE source = ?';
      params.push(source);
    }

    const batches = await db.query(`
      SELECT *
      FROM email_batches
      ${whereClause}
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM email_batches ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    res.json({ success: true, batches, total });
  } catch (error) {
    logger.error('Error fetching email log:', error);
    res.status(500).json({ error: 'Failed to fetch email log' });
  }
});

// GET /api/email-campaigns/email-log/:batchId/recipients — recipients for a batch
router.get('/email-log/:batchId/recipients', verifyToken, isAdmin, async (req, res) => {
  try {
    const { batchId } = req.params;
    const { status, search, limit = 200, offset = 0 } = req.query;

    let whereClause = 'WHERE batch_id = ?';
    const params = [parseInt(batchId)];

    if (status && status !== 'all') {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (recipient_email LIKE ? OR recipient_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const recipients = await db.query(`
      SELECT *
      FROM email_log
      ${whereClause}
      ORDER BY sent_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM email_log ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    res.json({ success: true, recipients, total });
  } catch (error) {
    logger.error('Error fetching email log recipients:', error);
    res.status(500).json({ error: 'Failed to fetch email log recipients' });
  }
});

// GET /api/email-campaigns/:id - Get campaign details
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const campaigns = await db.query(
      'SELECT * FROM email_campaigns WHERE id = ?',
      [req.params.id]
    );

    if (campaigns.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = campaigns[0];
    campaign.recipient_filter = JSON.parse(campaign.recipient_filter);

    res.json({ success: true, campaign });
  } catch (error) {
    logger.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// PUT /api/email-campaigns/:id - Update campaign
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, subject, body, recipientFilter, status } = req.body;

    // Check if campaign exists and is not already sent
    const existing = await db.query(
      'SELECT status FROM email_campaigns WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (existing[0].status === 'sent') {
      return res.status(400).json({ error: 'Cannot update sent campaign' });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (subject) {
      updates.push('subject = ?');
      params.push(subject);
    }
    if (body) {
      updates.push('body = ?');
      params.push(body);
    }
    if (recipientFilter) {
      updates.push('recipient_filter = ?');
      params.push(JSON.stringify(recipientFilter));
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);

    await db.query(
      `UPDATE email_campaigns SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// DELETE /api/email-campaigns/:id - Delete campaign
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM email_campaigns WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// POST /api/email-campaigns/:id/send - Send campaign immediately
router.post('/:id/send', verifyToken, isAdmin, async (req, res) => {
  try {
    const campaigns = await db.query(
      'SELECT * FROM email_campaigns WHERE id = ?',
      [req.params.id]
    );

    if (campaigns.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = campaigns[0];

    if (campaign.status === 'sent') {
      return res.status(400).json({ error: 'Campaign already sent' });
    }

    // Update status to sending
    await db.query(
      'UPDATE email_campaigns SET status = ? WHERE id = ?',
      ['sending', req.params.id]
    );

    // Get recipients
    const filters = JSON.parse(campaign.recipient_filter);
    const { query, params } = buildRecipientQuery(filters);
    const recipients = await db.query(query, params);

    if (recipients.length === 0) {
      await db.query(
        'UPDATE email_campaigns SET status = ? WHERE id = ?',
        ['failed', req.params.id]
      );
      return res.status(400).json({ error: 'No recipients match the filters' });
    }

    // Create recipient records
    for (const recipient of recipients) {
      await db.query(
        'INSERT INTO email_recipients (campaign_id, user_id, email) VALUES (?, ?, ?)',
        [req.params.id, recipient.id, recipient.email]
      );
    }

    // Send emails asynchronously
    setImmediate(async () => {
      let batchSent = 0;
      let batchFailed = 0;
      const batchId = await emailService.createBatch('campaign', campaign.subject, { campaignId: campaign.id, campaignName: campaign.name });

      try {
        for (const recipient of recipients) {
          try {
            await emailService.sendTemplateEmail(
              recipient.email,
              campaign.subject,
              campaign.body,
              recipient,
              { batchId, source: 'campaign', recipientName: recipient.lagnname }
            );

            await db.query(
              'UPDATE email_recipients SET status = ?, sent_at = NOW() WHERE campaign_id = ? AND user_id = ?',
              ['sent', req.params.id, recipient.id]
            );
            batchSent++;
          } catch (error) {
            logger.error(`Failed to send email to ${recipient.email}:`, error);
            await db.query(
              'UPDATE email_recipients SET status = ?, error_message = ? WHERE campaign_id = ? AND user_id = ?',
              ['failed', error.message, req.params.id, recipient.id]
            );
            batchFailed++;
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Update campaign status
        await db.query(
          'UPDATE email_campaigns SET status = ?, sent_at = NOW() WHERE id = ?',
          ['sent', req.params.id]
        );
      } catch (error) {
        logger.error('Error in email sending process:', error);
        await db.query(
          'UPDATE email_campaigns SET status = ? WHERE id = ?',
          ['failed', req.params.id]
        );
      }

      await emailService.completeBatch(batchId, batchSent, batchFailed);
    });

    res.json({ success: true, recipientCount: recipients.length });
  } catch (error) {
    logger.error('Error sending campaign:', error);
    res.status(500).json({ error: 'Failed to send campaign' });
  }
});

// POST /api/email-campaigns/:id/schedule - Schedule campaign
router.post('/:id/schedule', verifyToken, isAdmin, async (req, res) => {
  try {
    const { scheduledAt } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({ error: 'Scheduled date/time required' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    const campaigns = await db.query(
      'SELECT status FROM email_campaigns WHERE id = ?',
      [req.params.id]
    );

    if (campaigns.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaigns[0].status === 'sent') {
      return res.status(400).json({ error: 'Campaign already sent' });
    }

    // Get recipients and create recipient records
    const campaign = await db.query('SELECT recipient_filter FROM email_campaigns WHERE id = ?', [req.params.id]);
    const filters = JSON.parse(campaign[0].recipient_filter);
    const { query, params } = buildRecipientQuery(filters);
    const recipients = await db.query(query, params);

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients match the filters' });
    }

    // Create recipient records
    for (const recipient of recipients) {
      await db.query(
        'INSERT INTO email_recipients (campaign_id, user_id, email) VALUES (?, ?, ?)',
        [req.params.id, recipient.id, recipient.email]
      );
    }

    await db.query(
      'UPDATE email_campaigns SET status = ?, scheduled_at = ? WHERE id = ?',
      ['scheduled', scheduledAt, req.params.id]
    );

    res.json({ success: true, recipientCount: recipients.length });
  } catch (error) {
    logger.error('Error scheduling campaign:', error);
    res.status(500).json({ error: 'Failed to schedule campaign' });
  }
});

// GET /api/email-campaigns/:id/recipients - Get campaign recipients
router.get('/:id/recipients', verifyToken, isAdmin, async (req, res) => {
  try {
    const recipients = await db.query(`
      SELECT 
        er.*,
        au.lagnname,
        au.clname,
        au.email
      FROM email_recipients er
      LEFT JOIN activeusers au ON er.user_id = au.id
      WHERE er.campaign_id = ?
      ORDER BY er.created_at DESC
    `, [req.params.id]);

    res.json({ success: true, recipients });
  } catch (error) {
    logger.error('Error fetching recipients:', error);
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
});

module.exports = router;


