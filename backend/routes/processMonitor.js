const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const { query } = require('../db');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const webpush = require('web-push');

const PROCESSOR_URL = process.env.PROCESSOR_URL || 'https://peaceful-badlands-42414-7b2e5f9acb76.herokuapp.com';

// Configure VAPID for push notifications sent from this route
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      'mailto:' + (process.env.SMTP_USER || 'atlas@ariaslife.com'),
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (e) {
    console.error('[ProcessMonitor] VAPID config error:', e.message);
  }
}

async function sendPushToManager(userId, payload) {
  try {
    const subs = await query('SELECT id, subscription FROM push_subscriptions WHERE user_id = ?', [userId]);
    const staleIds = [];
    for (const row of subs) {
      if (!row.subscription) { staleIds.push(row.id); continue; }
      let sub;
      try { sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription; }
      catch { staleIds.push(row.id); continue; }
      if (!sub?.endpoint) { staleIds.push(row.id); continue; }
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) staleIds.push(row.id);
      }
    }
    if (staleIds.length > 0) {
      await query(`DELETE FROM push_subscriptions WHERE id IN (${staleIds.map(() => '?').join(',')})`, staleIds);
    }
  } catch (err) {
    console.warn('[ProcessMonitor] Push error for user', userId, err.message);
  }
}

// Multer config for file uploads (store in memory for proxying)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Known processes with metadata
const KNOWN_PROCESSES = [
  { name: 'Daily New Associates', subject: 'Daily New Associates', description: 'Processes daily new associates report, updates activeusers and pending tables', processors: ['pending_processor', 'associates_processor'], acceptsUpload: false },
  { name: 'VIPs', subject: 'VIPs -', description: 'Processes VIP credit reports and updates VIPs table', processors: ['vip_processor'], acceptsUpload: false },
  { name: 'Weekly Agent Count', subject: 'Weekly Agent Count - Arias', description: 'Processes weekly agent counts and updates activeusers', processors: ['users_processor'], acceptsUpload: false },
  { name: 'Production Report', subject: 'ARIAS ORGANIZATION: Wkly, MTD, and YTD Production By Levels', description: 'Updates Weekly_ALP production data', processors: ['production_processor'], acceptsUpload: false },
  { name: 'Pending Number Issued', subject: 'Pending Number has been Issued', description: 'Creates new pending agent records from notification emails', processors: ['pending_number_processor'], acceptsUpload: false },
  { name: 'XCEL Pre-Licensing', subject: 'XCEL Solutions: Arias_', description: 'Processes XCEL Solutions pre-licensing progress emails and updates pipeline', processors: ['xcel_processor'], acceptsUpload: false },
  { name: 'PnP Upload', subject: null, description: 'Processes Production & Projection PDFs', processors: ['pnp_processor'], acceptsUpload: true, uploadEndpoint: '/upload/pnp' },
  { name: 'PayeeWeb Report', subject: null, description: 'Downloads weekly PayeeWeb report via Puppeteer + SSO', processors: ['payeeWebReportScheduler'], acceptsUpload: false },
];

// GET /processes - List all known processes with their most recent run
router.get('/processes', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Get the most recent run for each process
    const latestRuns = await query(`
      SELECT pr.*
      FROM process_runs pr
      INNER JOIN (
        SELECT process_name, MAX(id) as max_id
        FROM process_runs
        GROUP BY process_name
      ) latest ON pr.id = latest.max_id
      ORDER BY pr.started_at DESC
    `);

    const runMap = {};
    for (const run of latestRuns) {
      runMap[run.process_name] = run;
    }

    const processes = KNOWN_PROCESSES.map(p => ({
      ...p,
      lastRun: runMap[p.name] || runMap[p.subject] || null,
    }));

    return res.json({ success: true, processes });
  } catch (error) {
    console.error('[ProcessMonitor] Error fetching processes:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /runs - Fetch process run history with pagination
router.get('/runs', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const processName = req.query.process_name;

    let runs, countResult;
    if (processName) {
      runs = await query(
        'SELECT * FROM process_runs WHERE process_name = ? ORDER BY started_at DESC LIMIT ? OFFSET ?',
        [processName, limit, offset]
      );
      countResult = await query('SELECT COUNT(*) as total FROM process_runs WHERE process_name = ?', [processName]);
    } else {
      runs = await query(
        'SELECT * FROM process_runs ORDER BY started_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
      countResult = await query('SELECT COUNT(*) as total FROM process_runs');
    }

    return res.json({
      success: true,
      runs,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit),
      },
    });
  } catch (error) {
    console.error('[ProcessMonitor] Error fetching runs:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /status - Proxy to Python processor health check
router.get('/status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const response = await axios.get(`${PROCESSOR_URL}/health`, { timeout: 10000 });
    return res.json({ success: true, ...response.data });
  } catch (error) {
    console.error('[ProcessMonitor] Health check failed:', error.message);
    return res.json({
      success: false,
      status: 'unreachable',
      error: error.message,
    });
  }
});

// POST /trigger - Manually trigger a process via the Python processor
router.post('/trigger', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { subject } = req.body;
    if (!subject) {
      return res.status(400).json({ success: false, message: 'Subject is required' });
    }

    const response = await axios.post(
      `${PROCESSOR_URL}/test/process`,
      { subject },
      { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
    );

    // 202 = processing started in background (async trigger)
    return res.json({ success: true, ...response.data });
  } catch (error) {
    console.error('[ProcessMonitor] Trigger failed:', error.message);
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: error.message };
    return res.status(status).json({ success: false, ...data });
  }
});

// POST /trigger-payeeweb - Manually trigger PayeeWeb report fetch
router.post('/trigger-payeeweb', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { fetchPayeeWebReport } = require('../schedulers/payeeWebReportScheduler');
    res.json({ success: true, message: 'PayeeWeb report fetch started' });
    fetchPayeeWebReport('manual').catch(err => {
      console.error('[ProcessMonitor] PayeeWeb manual trigger failed:', err.message);
    });
  } catch (error) {
    console.error('[ProcessMonitor] PayeeWeb trigger error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /upload/:processType - Forward file upload to Python processor
router.post('/upload/:processType', verifyToken, verifyAdmin, upload.single('file'), async (req, res) => {
  try {
    const { processType } = req.params;

    // Find the process config
    const process = KNOWN_PROCESSES.find(p => p.name === processType && p.acceptsUpload);
    if (!process) {
      return res.status(400).json({ success: false, message: `Unknown or non-uploadable process: ${processType}` });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    // Forward the file to the Python processor
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });

    // Pass through query params
    const queryParams = new URLSearchParams();
    if (req.query.page_limit) queryParams.set('page_limit', req.query.page_limit);
    if (req.query.agent_suffix) queryParams.set('agent_suffix', req.query.agent_suffix);

    const url = `${PROCESSOR_URL}${process.uploadEndpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    const response = await axios.post(url, form, {
      headers: form.getHeaders(),
      timeout: 30000,
      maxContentLength: 100 * 1024 * 1024,
    });

    return res.json({ success: true, ...response.data });
  } catch (error) {
    console.error('[ProcessMonitor] Upload failed:', error.message);
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: error.message };
    return res.status(status).json({ success: false, ...data });
  }
});

// POST /rewatch - Renew Gmail Pub/Sub push notification watch
router.post('/rewatch', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const rewatchToken = process.env.REWATCH_TOKEN;
    if (!rewatchToken) {
      return res.status(500).json({ success: false, message: 'REWATCH_TOKEN not configured on backend' });
    }

    const response = await axios.post(
      `${PROCESSOR_URL}/manage/rewatch`,
      {},
      {
        timeout: 30000,
        headers: { 'X-Auth-Token': rewatchToken },
      }
    );

    return res.json({ success: true, ...response.data });
  } catch (error) {
    console.error('[ProcessMonitor] Rewatch failed:', error.message);
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: error.message };
    return res.status(status).json({ success: false, ...data });
  }
});

// POST /callback/associates-activated
// Called by the Python associates_processor right after it sets pending = 0.
// Receives the list of activated agents, groups them by manager, then sends
// in-app + push notifications and records each in code_eligibility_notifications.
router.post('/callback/associates-activated', async (req, res) => {
  const { activated_agents } = req.body;
  if (!Array.isArray(activated_agents) || activated_agents.length === 0) {
    return res.json({ success: true, message: 'No agents to notify', notified: 0 });
  }

  try {
    // For each activated agent, fetch their manager hierarchy from activeusers
    const enriched = [];
    for (const agent of activated_agents) {
      if (!agent.lagnname) continue;
      const rows = await query(
        `SELECT id, lagnname, sa, ga, mga FROM activeusers
         WHERE lagnname = ? AND (agtnum = ? OR ? IS NULL OR ? = '')
         LIMIT 1`,
        [agent.lagnname, agent.agtnum, agent.agtnum, agent.agtnum]
      );
      if (rows.length > 0) {
        enriched.push({ ...agent, ...rows[0] });
      } else {
        enriched.push(agent);
      }
    }

    // Group agents by their direct manager name (SA → GA → MGA priority)
    const byManager = new Map(); // managerName → [agentRow, ...]
    for (const agent of enriched) {
      const managerName = agent.sa || agent.ga || agent.mga;
      if (!managerName) continue;
      if (!byManager.has(managerName)) byManager.set(managerName, []);
      byManager.get(managerName).push(agent);
    }

    let notifiedCount = 0;

    for (const [managerName, agents] of byManager) {
      // Resolve manager's activeusers.id
      const mgRows = await query(
        `SELECT id FROM activeusers WHERE UPPER(TRIM(lagnname)) = UPPER(TRIM(?)) AND Active = 'y' LIMIT 1`,
        [managerName]
      );
      if (mgRows.length === 0) {
        console.warn(`[AssociatesCallback] Manager not found: ${managerName}`);
        // Still record agents as notified (with null manager) so the fallback scheduler skips them
        for (const agent of agents) {
          if (agent.id) {
            await query(
              'INSERT IGNORE INTO code_eligibility_notifications (agent_id, manager_id) VALUES (?, NULL)',
              [agent.id]
            );
          }
        }
        continue;
      }

      const managerId = mgRows[0].id;
      const n = agents.length;

      const title = 'Agent Code Eligible';
      const message = n === 1
        ? `${agents[0].lagnname} is now eligible to request for a code pack.`
        : `You have ${n} agents now eligible to request for a code pack: ${agents.map(a => a.lagnname).join(', ')}.`;
      const link_url = '/resources?active=leads';

      // Insert notification
      const insertResult = await query(
        `INSERT INTO notifications (title, message, type, user_id, link_url) VALUES (?, ?, 'info', ?, ?)`,
        [title, message, managerId, link_url]
      );
      const notificationId = insertResult.insertId;

      // Push notification (non-blocking)
      sendPushToManager(managerId, { id: notificationId, title, message, link_url });

      // WebSocket real-time delivery
      if (global.notificationManager) {
        global.notificationManager.notifyUser(managerId, {
          id: notificationId,
          title,
          message,
          type: 'info',
          link_url,
          created_at: new Date().toISOString(),
        });
      }

      // Record each agent in the tracking table
      for (const agent of agents) {
        if (agent.id) {
          await query(
            'INSERT IGNORE INTO code_eligibility_notifications (agent_id, manager_id) VALUES (?, ?)',
            [agent.id, managerId]
          );
        }
      }

      notifiedCount++;
      console.log(`[AssociatesCallback] Notified ${managerName} (id=${managerId}) about ${n} agent(s)`);
    }

    // Also notify user id=92 (admin) with a summary of all activations
    const totalActivated = enriched.length;
    if (totalActivated > 0) {
      const adminId = 92;
      const adminTitle = 'Agent Code Eligibility Update';
      const adminMessage = totalActivated === 1
        ? `${enriched[0].lagnname} is now eligible to request for a code pack.`
        : `${totalActivated} agents are now eligible to request for a code pack: ${enriched.map(a => a.lagnname).join(', ')}.`;
      const adminLink = '/resources?active=leads';

      const adminInsert = await query(
        `INSERT INTO notifications (title, message, type, user_id, link_url) VALUES (?, ?, 'info', ?, ?)`,
        [adminTitle, adminMessage, adminId, adminLink]
      );
      sendPushToManager(adminId, { id: adminInsert.insertId, title: adminTitle, message: adminMessage, link_url: adminLink });
      if (global.notificationManager) {
        global.notificationManager.notifyUser(adminId, {
          id: adminInsert.insertId,
          title: adminTitle,
          message: adminMessage,
          type: 'info',
          link_url: adminLink,
          created_at: new Date().toISOString(),
        });
      }
    }

    return res.json({ success: true, notified: notifiedCount, agents: enriched.length });
  } catch (err) {
    console.error('[AssociatesCallback] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /upload-status/:jobId - Proxy to Python processor job status
router.get('/upload-status/:jobId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const response = await axios.get(
      `${PROCESSOR_URL}/upload/pnp/status/${req.params.jobId}`,
      { timeout: 10000 }
    );
    return res.json({ success: true, ...response.data });
  } catch (error) {
    console.error('[ProcessMonitor] Upload status check failed:', error.message);
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: error.message };
    return res.status(status).json({ success: false, ...data });
  }
});

module.exports = router;
