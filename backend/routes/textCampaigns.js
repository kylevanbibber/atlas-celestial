const express = require('express');
const router = express.Router();
const { query } = require('../db');
const verifyToken = require('../middleware/verifyToken');
const multer = require('multer');
const XLSX = require('xlsx');
const { sendSMS, formatPhoneNumber } = require('../services/twilio');
const twilio = require('twilio');

// Hardcoded user IDs allowed to access Text Campaigns
const ALLOWED_USER_IDS = [92, 24281, 27996];

// Base URL for status callback webhooks
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'https://atlas-celest-backend-3bb2fea96236.herokuapp.com';
const STATUS_CALLBACK_URL = `${BACKEND_BASE_URL}/api/text-campaigns/webhook/status`;

// Twilio webhook signature validation
function validateTwilioWebhook(req, res, next) {
    const signature = req.headers['x-twilio-signature'];
    if (!signature) {
        console.warn(`[TextCampaigns Webhook] Missing signature from ${req.ip}`);
        return res.status(403).send('Missing Twilio signature');
    }
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
        console.error('[TextCampaigns Webhook] No TWILIO_AUTH_TOKEN configured');
        return res.status(500).send('Server misconfigured');
    }
    const isValid = twilio.validateRequest(authToken, signature, STATUS_CALLBACK_URL, req.body || {});
    if (!isValid) {
        console.warn(`[TextCampaigns Webhook] Invalid signature from ${req.ip}`);
        return res.status(403).send('Invalid signature');
    }
    next();
}

const hasTextCampaignAccess = (req, res, next) => {
  const userId = parseInt(req.userId);
  if (!ALLOWED_USER_IDS.includes(userId)) {
    return res.status(403).json({ success: false, message: 'Access denied. Text Campaign access is restricted.' });
  }
  next();
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// CSV header -> DB column mapping (case-insensitive matching)
const COLUMN_MAP = [
  { dbCol: 'policy_number',        patterns: [/^policy\s*#?$/i, /^policy[_ ]?number$/i] },
  { dbCol: 'policyholder_name',    patterns: [/^policyholder[_ ]?name$/i, /^policy[_ ]?holder[_ ]?name$/i, /^policyholder$/i] },
  { dbCol: 'owner_name',           patterns: [/^owner[_ ]?name$/i] },
  { dbCol: 'primary_phone',        patterns: [/^primary[_ ]?phone$/i] },
  { dbCol: 'secondary_phone',      patterns: [/^secondary[_ ]?phone$/i] },
  { dbCol: 'address',              patterns: [/^address$/i, /^secondary[_ ]?address$/i] },
  { dbCol: 'primary_agent',        patterns: [/^primary[_ ]?assigned[_ ]?agent$/i] },
  { dbCol: 'primary_agent_mga',    patterns: [/^primary[_ ]?assigned[_ ]?agent[_ ]?mga$/i] },
  { dbCol: 'policy_type',          patterns: [/^type$/i] },
  { dbCol: 'policy_status',        patterns: [/^status$/i] },
  { dbCol: 'import_date',          patterns: [/^import[_ ]?date?$/i] },
  { dbCol: 'inc_nto_date',         patterns: [/^inc\/?nto[_ ]?date?$/i] },
  { dbCol: 'bill_control_number',  patterns: [/^bill[_ ]?control[_ ]?number$/i] },
  { dbCol: 'form_code',            patterns: [/^form[_ ]?code?$/i] },
  { dbCol: 'billing_mode',         patterns: [/^billing[_ ]?mode?$/i] },
];

// Match a CSV header to a db column
function mapHeader(header) {
  for (const col of COLUMN_MAP) {
    for (const pattern of col.patterns) {
      if (pattern.test(header.trim())) return col.dbCol;
    }
  }
  return null;
}

// Check if current user has access
router.get('/access-check', verifyToken, (req, res) => {
  const userId = parseInt(req.userId);
  res.json({ success: true, hasAccess: ALLOWED_USER_IDS.includes(userId) });
});

// ==========================================
// Twilio Status Callback Webhook (no auth - called by Twilio)
// Must be defined BEFORE /:id routes to avoid param matching
// ==========================================
router.post('/webhook/status', validateTwilioWebhook, async (req, res) => {
  try {
    const { MessageSid, MessageStatus } = req.body;

    if (!MessageSid || !MessageStatus) {
      return res.status(400).send('Missing required fields');
    }

    const result = await query(
      'UPDATE text_campaign_messages SET status = ? WHERE twilio_sid = ?',
      [MessageStatus, MessageSid]
    );

    if (result.affectedRows > 0) {
      console.log(`[TextCampaigns] Status update: ${MessageSid} -> ${MessageStatus}`);

      // If the message failed/undelivered, only mark contact as 'failed' if ALL
      // outbound messages for this contact have failed (don't downgrade if another phone succeeded)
      if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
        const msgs = await query(
          'SELECT contact_id, campaign_id, phone_number FROM text_campaign_messages WHERE twilio_sid = ?',
          [MessageSid]
        );
        if (msgs.length > 0) {
          const { contact_id, campaign_id, phone_number } = msgs[0];

          // Check if there are any other successful outbound messages for this contact
          const successfulMsgs = await query(
            `SELECT id FROM text_campaign_messages
             WHERE contact_id = ? AND direction = 'outbound' AND status IN ('sent', 'delivered', 'queued', 'accepted')
             AND twilio_sid != ?
             LIMIT 1`,
            [contact_id, MessageSid]
          );

          // Only mark as failed if no other outbound messages succeeded
          if (successfulMsgs.length === 0) {
            await query(
              "UPDATE text_campaign_contacts SET campaign_status = 'failed' WHERE id = ? AND campaign_status = 'sent'",
              [contact_id]
            );
          }

          const campaigns = await query('SELECT created_by FROM text_campaigns WHERE id = ?', [campaign_id]);
          if (campaigns.length > 0 && global.notificationManager) {
            global.notificationManager.notifyUser(String(campaigns[0].created_by), {
              type: 'text_campaign_status',
              contactId: contact_id,
              campaignId: campaign_id,
              phone: phone_number,
              messageStatus: MessageStatus,
            });
          }
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[TextCampaigns] Status callback error:', error.message);
    res.status(500).send('Error');
  }
});

// List all campaigns for the current user
router.get('/', verifyToken, hasTextCampaignAccess, async (req, res) => {
  try {
    const campaigns = await query(
      `SELECT tc.*,
        SUM(CASE WHEN tcc.campaign_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN tcc.campaign_status = 'sent' THEN 1 ELSE 0 END) as sent_count_contacts,
        SUM(CASE WHEN tcc.campaign_status = 'responded' THEN 1 ELSE 0 END) as responded_count,
        SUM(CASE WHEN tcc.campaign_status = 'closed' THEN 1 ELSE 0 END) as closed_count,
        SUM(CASE WHEN tcc.campaign_status = 'failed' THEN 1 ELSE 0 END) as failed_count_contacts,
        SUM(CASE WHEN tcc.campaign_status = 'opted_out' THEN 1 ELSE 0 END) as opted_out_count,
        (SELECT COUNT(*) FROM text_campaign_follow_ups tcfu WHERE tcfu.campaign_id = tc.id) as follow_up_count
      FROM text_campaigns tc
      LEFT JOIN text_campaign_contacts tcc ON tc.id = tcc.campaign_id
      GROUP BY tc.id
      ORDER BY tc.created_at DESC`
    );
    res.json({ success: true, data: campaigns });
  } catch (error) {
    console.error('[TextCampaigns] Error listing campaigns:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
  }
});

// Create a new campaign
router.post('/', verifyToken, hasTextCampaignAccess, async (req, res) => {
  try {
    const { name, message_template, follow_ups } = req.body;
    if (!name || !message_template) {
      return res.status(400).json({ success: false, message: 'Name and message template are required' });
    }

    const result = await query(
      'INSERT INTO text_campaigns (name, message_template, created_by) VALUES (?, ?, ?)',
      [name, message_template, req.userId]
    );

    const campaignId = result.insertId;

    // Save follow-up steps if provided
    if (Array.isArray(follow_ups) && follow_ups.length > 0) {
      for (const fu of follow_ups) {
        await query(
          `INSERT INTO text_campaign_follow_ups (campaign_id, step_number, message, delay_value, delay_unit)
           VALUES (?, ?, ?, ?, ?)`,
          [campaignId, fu.step_number, fu.message, fu.delay_value, fu.delay_unit || 'hours']
        );
      }
    }

    res.json({ success: true, data: { id: campaignId }, message: 'Campaign created' });
  } catch (error) {
    console.error('[TextCampaigns] Error creating campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to create campaign' });
  }
});

// Get single campaign with contact stats
router.get('/:id', verifyToken, hasTextCampaignAccess, async (req, res) => {
  try {
    const campaigns = await query(
      `SELECT tc.*,
        SUM(CASE WHEN tcc.campaign_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN tcc.campaign_status = 'sent' THEN 1 ELSE 0 END) as sent_count_contacts,
        SUM(CASE WHEN tcc.campaign_status = 'responded' THEN 1 ELSE 0 END) as responded_count,
        SUM(CASE WHEN tcc.campaign_status = 'closed' THEN 1 ELSE 0 END) as closed_count,
        SUM(CASE WHEN tcc.campaign_status = 'failed' THEN 1 ELSE 0 END) as failed_count_contacts,
        SUM(CASE WHEN tcc.campaign_status = 'opted_out' THEN 1 ELSE 0 END) as opted_out_count
      FROM text_campaigns tc
      LEFT JOIN text_campaign_contacts tcc ON tc.id = tcc.campaign_id
      WHERE tc.id = ?
      GROUP BY tc.id`,
      [req.params.id]
    );

    if (!campaigns.length) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    // Fetch follow-up steps
    const followUps = await query(
      'SELECT * FROM text_campaign_follow_ups WHERE campaign_id = ? ORDER BY step_number ASC',
      [req.params.id]
    );

    res.json({ success: true, data: { ...campaigns[0], follow_ups: followUps } });
  } catch (error) {
    console.error('[TextCampaigns] Error fetching campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaign' });
  }
});

// Update draft campaign
router.put('/:id', verifyToken, hasTextCampaignAccess, async (req, res) => {
  try {
    const { name, message_template, follow_ups } = req.body;
    const campaign = await query(
      'SELECT id, status FROM text_campaigns WHERE id = ?',
      [req.params.id]
    );

    if (!campaign.length) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    if (campaign[0].status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft campaigns can be edited' });
    }

    await query(
      'UPDATE text_campaigns SET name = ?, message_template = ? WHERE id = ?',
      [name, message_template, req.params.id]
    );

    // Replace follow-up steps: delete old, insert new
    await query('DELETE FROM text_campaign_follow_ups WHERE campaign_id = ?', [req.params.id]);
    if (Array.isArray(follow_ups) && follow_ups.length > 0) {
      for (const fu of follow_ups) {
        await query(
          `INSERT INTO text_campaign_follow_ups (campaign_id, step_number, message, delay_value, delay_unit)
           VALUES (?, ?, ?, ?, ?)`,
          [req.params.id, fu.step_number, fu.message, fu.delay_value, fu.delay_unit || 'hours']
        );
      }
    }

    res.json({ success: true, message: 'Campaign updated' });
  } catch (error) {
    console.error('[TextCampaigns] Error updating campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to update campaign' });
  }
});

// Delete draft campaign
router.delete('/:id', verifyToken, hasTextCampaignAccess, async (req, res) => {
  try {
    const campaign = await query(
      'SELECT id, status FROM text_campaigns WHERE id = ?',
      [req.params.id]
    );

    if (!campaign.length) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    if (campaign[0].status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft campaigns can be deleted' });
    }

    await query('DELETE FROM text_campaign_follow_ups WHERE campaign_id = ?', [req.params.id]);
    await query('DELETE FROM text_campaigns WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    console.error('[TextCampaigns] Error deleting campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to delete campaign' });
  }
});

// Upload CSV contacts
router.post('/:id/upload-contacts', verifyToken, hasTextCampaignAccess, upload.single('file'), async (req, res) => {
  // Allow up to 5 minutes for large file processing
  req.setTimeout(5 * 60 * 1000);
  res.setTimeout(5 * 60 * 1000);

  try {
    const campaignId = req.params.id;

    // Verify campaign exists
    const campaign = await query(
      'SELECT id, status FROM text_campaigns WHERE id = ?',
      [campaignId]
    );
    if (!campaign.length) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Parse CSV/XLSX
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!data.length) {
      return res.status(400).json({ success: false, message: 'File is empty or invalid' });
    }

    // Build header-to-db-column mapping from the actual file headers
    const csvHeaders = Object.keys(data[0]);
    const headerMapping = {}; // csvHeader -> dbColumn
    for (const h of csvHeaders) {
      const dbCol = mapHeader(h);
      if (dbCol) headerMapping[h] = dbCol;
    }

    // primary_phone must be mapped
    const phoneHeader = csvHeaders.find(h => headerMapping[h] === 'primary_phone');
    if (!phoneHeader) {
      return res.status(400).json({
        success: false,
        message: `Could not find a Primary Phone column. Found columns: ${csvHeaders.join(', ')}`
      });
    }

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    let dncSkipped = 0;
    let householdDupes = 0;

    // Pre-fetch DNC list for efficient lookup
    const dncRows = await query('SELECT phone_normalized FROM text_campaign_dnc');
    const dncSet = new Set(dncRows.map(r => r.phone_normalized));

    // Pre-fetch all phones already in this campaign (primary + secondary) for household dedup
    const existingContacts = await query(
      'SELECT phone_normalized, secondary_phone FROM text_campaign_contacts WHERE campaign_id = ?',
      [campaignId]
    );
    const campaignPhones = new Set();
    for (const ec of existingContacts) {
      if (ec.phone_normalized) campaignPhones.add(ec.phone_normalized);
      if (ec.secondary_phone) {
        const secNorm = formatPhoneNumber(ec.secondary_phone);
        if (secNorm) campaignPhones.add(secNorm);
      }
    }

    // Find the secondary_phone CSV header if it exists
    const secondaryPhoneHeader = csvHeaders.find(h => headerMapping[h] === 'secondary_phone');

    // Build list of valid rows to insert
    const validRows = [];

    for (const row of data) {
      // Get and normalize phone
      const rawPhone = String(row[phoneHeader]).trim();
      const normalized = formatPhoneNumber(rawPhone);
      if (!normalized || normalized.replace(/\D/g, '').length < 10) {
        skipped++;
        continue;
      }

      // Check DNC list
      if (dncSet.has(normalized)) {
        dncSkipped++;
        continue;
      }

      // Household dedup: skip if this primary phone already exists as any phone in the campaign
      if (campaignPhones.has(normalized)) {
        householdDupes++;
        continue;
      }

      // Also normalize the secondary phone for dedup tracking
      let secondaryNormalized = null;
      if (secondaryPhoneHeader) {
        const rawSecondary = String(row[secondaryPhoneHeader]).trim();
        if (rawSecondary) secondaryNormalized = formatPhoneNumber(rawSecondary);
      }

      // Add both phones to the tracking set for subsequent rows
      campaignPhones.add(normalized);
      if (secondaryNormalized) campaignPhones.add(secondaryNormalized);

      // Build the column values from mapping
      const dbCols = ['campaign_id', 'primary_phone', 'phone_normalized'];
      const dbVals = [campaignId, rawPhone, normalized];

      for (const [csvHeader, dbCol] of Object.entries(headerMapping)) {
        if (dbCol === 'primary_phone') continue; // already added
        dbCols.push(dbCol);
        dbVals.push(String(row[csvHeader]).trim() || null);
      }

      validRows.push({ dbCols, dbVals });
    }

    // Batch insert in chunks of 100 for performance
    const BATCH_SIZE = 100;
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      // All rows share the same column structure, use the first row's columns
      const cols = batch[0].dbCols;
      const singlePlaceholder = `(${cols.map(() => '?').join(', ')})`;
      const allPlaceholders = batch.map(() => singlePlaceholder).join(', ');
      const allVals = batch.flatMap(r => r.dbVals);

      const updateCols = cols
        .filter(c => c !== 'campaign_id' && c !== 'phone_normalized')
        .map(c => `${c} = VALUES(${c})`)
        .join(', ');

      try {
        const result = await query(
          `INSERT INTO text_campaign_contacts (${cols.join(', ')})
           VALUES ${allPlaceholders}
           ON DUPLICATE KEY UPDATE ${updateCols}`,
          allVals
        );
        // affectedRows: 1 per insert, 2 per update (MySQL ON DUPLICATE KEY behavior)
        imported += batch.length;
      } catch (err) {
        // If batch fails, fall back to one-at-a-time for this batch
        for (const row of batch) {
          const placeholders = row.dbCols.map(() => '?').join(', ');
          const updateC = row.dbCols
            .filter(c => c !== 'campaign_id' && c !== 'phone_normalized')
            .map(c => `${c} = VALUES(${c})`)
            .join(', ');
          try {
            await query(
              `INSERT INTO text_campaign_contacts (${row.dbCols.join(', ')})
               VALUES (${placeholders})
               ON DUPLICATE KEY UPDATE ${updateC}`,
              row.dbVals
            );
            imported++;
          } catch (innerErr) {
            if (innerErr.code === 'ER_DUP_ENTRY') {
              duplicates++;
            } else {
              console.error('[TextCampaigns] Error inserting contact:', innerErr);
              skipped++;
            }
          }
        }
      }
    }

    // Update total count
    const countResult = await query(
      'SELECT COUNT(*) as cnt FROM text_campaign_contacts WHERE campaign_id = ?',
      [campaignId]
    );
    await query('UPDATE text_campaigns SET total_contacts = ? WHERE id = ?', [countResult[0].cnt, campaignId]);

    res.json({ success: true, data: { imported, skipped, duplicates, dncSkipped, householdDupes, total: countResult[0].cnt } });
  } catch (error) {
    console.error('[TextCampaigns] Error uploading contacts:', error);
    res.status(500).json({ success: false, message: 'Failed to upload contacts' });
  }
});

// Get contacts for a campaign with status filter and search
// Returns one row per phone number (primary + secondary shown as separate conversations)
// Status filtering is per-conversation (based on actual message activity for each phone)
router.get('/:id/contacts', verifyToken, hasTextCampaignAccess, async (req, res) => {
  try {
    const { status, search } = req.query;
    const campaignId = req.params.id;

    // Verify campaign exists
    const campaign = await query(
      'SELECT id FROM text_campaigns WHERE id = ?',
      [campaignId]
    );
    if (!campaign.length) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    // Fetch all contacts (search + status filtering happens per-conversation in JS below)
    const contacts = await query(
      `SELECT tcc.* FROM text_campaign_contacts tcc WHERE tcc.campaign_id = ? ORDER BY tcc.last_message_at DESC, tcc.created_at DESC`,
      [campaignId]
    );

    const contactIds = contacts.map(c => c.id);
    let messageMap = {};
    let phoneDirectionMap = {};

    if (contactIds.length > 0) {
      const placeholders = contactIds.map(() => '?').join(',');

      // Batch-fetch latest message per (contact_id, phone_number)
      const latestMessages = await query(
        `SELECT tcm1.contact_id, tcm1.phone_number, tcm1.message, tcm1.direction, tcm1.created_at
         FROM text_campaign_messages tcm1
         INNER JOIN (
           SELECT contact_id, phone_number, MAX(created_at) as max_created
           FROM text_campaign_messages
           WHERE contact_id IN (${placeholders})
           GROUP BY contact_id, phone_number
         ) tcm2 ON tcm1.contact_id = tcm2.contact_id
                AND tcm1.phone_number = tcm2.phone_number
                AND tcm1.created_at = tcm2.max_created
         WHERE tcm1.contact_id IN (${placeholders})`,
        [...contactIds, ...contactIds]
      );

      for (const msg of latestMessages) {
        const key = `${msg.contact_id}_${msg.phone_number}`;
        messageMap[key] = msg;
      }

      // Batch-fetch per-phone direction stats (has outbound / has inbound)
      const directionStats = await query(
        `SELECT contact_id, phone_number,
           MAX(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as has_outbound,
           MAX(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as has_inbound
         FROM text_campaign_messages
         WHERE contact_id IN (${placeholders})
         GROUP BY contact_id, phone_number`,
        contactIds
      );

      for (const stat of directionStats) {
        const key = `${stat.contact_id}_${stat.phone_number}`;
        phoneDirectionMap[key] = { has_outbound: !!stat.has_outbound, has_inbound: !!stat.has_inbound };
      }
    }

    // Compute per-conversation status based on actual message activity for THIS phone
    const getConversationStatus = (contact, phoneKey) => {
      const contactStatus = contact.campaign_status;

      // Contact-level statuses that override per-phone logic
      if (contactStatus === 'closed' || contactStatus === 'opted_out' || contactStatus === 'failed') {
        return contactStatus;
      }

      const dirs = phoneDirectionMap[phoneKey];
      if (dirs) {
        if (dirs.has_inbound) return 'responded';
        if (dirs.has_outbound) return 'sent';
      }

      // No messages for this phone — keep the contact-level status.
      // Secondary phones without messages are already filtered out (line 591),
      // so this only applies to primary phones that were skipped during send
      // (e.g., household dedup or cross-campaign cooldown).
      return contactStatus;
    };

    // Build conversation list: one entry per phone number
    const conversationRows = [];
    for (const c of contacts) {
      const primaryKey = `${c.id}_${c.phone_normalized}`;
      const primaryMsg = messageMap[primaryKey];
      const primaryHasMessages = !!phoneDirectionMap[primaryKey];
      const primaryConvStatus = getConversationStatus(c, primaryKey);

      // Check if secondary phone has messages
      let secNorm = null;
      let secHasMessages = false;
      if (c.secondary_phone && c.secondary_phone.trim()) {
        secNorm = formatPhoneNumber(c.secondary_phone);
        if (secNorm && secNorm !== c.phone_normalized) {
          secHasMessages = !!phoneDirectionMap[`${c.id}_${secNorm}`];
        }
      }

      // Show primary entry if it has messages, OR if the secondary doesn't
      // (so the contact always appears at least once)
      if (primaryHasMessages || !secHasMessages) {
        conversationRows.push({
          ...c,
          conversation_phone: c.phone_normalized,
          phone_type: 'primary',
          conversation_status: primaryConvStatus,
          last_message: primaryMsg?.message || null,
          last_message_direction: primaryMsg?.direction || null,
          last_phone_message_at: primaryMsg?.created_at || null,
        });
      }

      // Secondary phone entry — only show if messages were actually sent/received on it
      if (secNorm && secHasMessages) {
        const secKey = `${c.id}_${secNorm}`;
        const secMsg = messageMap[secKey];
        const secConvStatus = getConversationStatus(c, secKey);

        conversationRows.push({
          ...c,
          conversation_phone: secNorm,
          phone_type: 'secondary',
          conversation_status: secConvStatus,
          last_message: secMsg?.message || null,
          last_message_direction: secMsg?.direction || null,
          last_phone_message_at: secMsg?.created_at || null,
        });
      }
    }

    // Apply search filter on conversation-level fields
    let filteredRows = conversationRows;
    if (search) {
      const term = search.toLowerCase();
      const digits = search.replace(/\D/g, ''); // strip non-digits for phone matching
      filteredRows = filteredRows.filter(row => {
        // Name match
        if (row.policyholder_name && row.policyholder_name.toLowerCase().includes(term)) return true;
        if (row.owner_name && row.owner_name.toLowerCase().includes(term)) return true;
        // Policy number match
        if (row.policy_number && row.policy_number.toLowerCase().includes(term)) return true;
        // Phone match — compare raw, normalized, and conversation phone
        if (row.primary_phone && row.primary_phone.includes(term)) return true;
        if (row.conversation_phone && row.conversation_phone.includes(term)) return true;
        // Digits-only phone match (handles format differences)
        if (digits.length >= 3) {
          const primaryDigits = (row.primary_phone || '').replace(/\D/g, '');
          const convDigits = (row.conversation_phone || '').replace(/\D/g, '');
          const secDigits = (row.secondary_phone || '').replace(/\D/g, '');
          if (primaryDigits.includes(digits)) return true;
          if (convDigits.includes(digits)) return true;
          if (secDigits.includes(digits)) return true;
        }
        return false;
      });
    }

    // Apply status filter on per-conversation status (not contact-level)
    if (status && status !== 'all') {
      filteredRows = filteredRows.filter(row => row.conversation_status === status);
    }

    // Sort by most recent message activity
    filteredRows.sort((a, b) => {
      const aTime = a.last_phone_message_at || a.last_message_at || a.created_at;
      const bTime = b.last_phone_message_at || b.last_message_at || b.created_at;
      return new Date(bTime) - new Date(aTime);
    });

    res.json({ success: true, data: filteredRows });
  } catch (error) {
    console.error('[TextCampaigns] Error fetching contacts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch contacts' });
  }
});

// Update contact campaign_status
router.put('/contacts/:contactId/status', verifyToken, hasTextCampaignAccess, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'sent', 'responded', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Verify contact exists
    const contact = await query(
      `SELECT tcc.id
       FROM text_campaign_contacts tcc
       JOIN text_campaigns tc ON tcc.campaign_id = tc.id
       WHERE tcc.id = ?`,
      [req.params.contactId]
    );
    if (!contact.length) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await query('UPDATE text_campaign_contacts SET campaign_status = ? WHERE id = ?', [status, req.params.contactId]);
    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('[TextCampaigns] Error updating contact status:', error);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

// Close contact AND all other contacts sharing any phone number in the same campaign
router.put('/contacts/:contactId/close-all', verifyToken, hasTextCampaignAccess, async (req, res) => {
  try {
    // Get the contact and its phones
    const contacts = await query(
      `SELECT tcc.*, tc.id as campaign_id
       FROM text_campaign_contacts tcc
       JOIN text_campaigns tc ON tcc.campaign_id = tc.id
       WHERE tcc.id = ?`,
      [req.params.contactId]
    );
    if (!contacts.length) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    const contact = contacts[0];
    const phones = [contact.phone_normalized];
    if (contact.secondary_phone) {
      const secNorm = formatPhoneNumber(contact.secondary_phone);
      if (secNorm) phones.push(secNorm);
    }

    // Close this contact
    await query("UPDATE text_campaign_contacts SET campaign_status = 'closed' WHERE id = ?", [contact.id]);

    // Find and close other contacts in the same campaign that share any of these phone numbers
    const placeholders = phones.map(() => '?').join(',');
    const result = await query(
      `UPDATE text_campaign_contacts
       SET campaign_status = 'closed'
       WHERE campaign_id = ? AND id != ? AND campaign_status != 'opted_out'
         AND (phone_normalized IN (${placeholders}) OR secondary_phone IN (${phones.map(() => '?').join(',')}))`,
      [contact.campaign_id, contact.id, ...phones, ...phones]
    );

    res.json({
      success: true,
      message: `Closed contact and ${result.affectedRows} associated contact(s)`,
      data: { closedCount: result.affectedRows + 1 }
    });
  } catch (error) {
    console.error('[TextCampaigns] Error closing all associated contacts:', error);
    res.status(500).json({ success: false, message: 'Failed to close contacts' });
  }
});

// Close contact and add its phone number to the DNC list
router.put('/contacts/:contactId/close-dnc', verifyToken, hasTextCampaignAccess, async (req, res) => {
  try {
    const { phone } = req.body; // the specific phone being viewed

    const contacts = await query(
      `SELECT tcc.*, tc.id as campaign_id
       FROM text_campaign_contacts tcc
       JOIN text_campaigns tc ON tcc.campaign_id = tc.id
       WHERE tcc.id = ?`,
      [req.params.contactId]
    );
    if (!contacts.length) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    const contact = contacts[0];

    // Close the contact
    await query("UPDATE text_campaign_contacts SET campaign_status = 'closed' WHERE id = ?", [contact.id]);

    // Determine which phone(s) to add to DNC
    const phonesToDnc = [];
    if (phone) {
      // Add the specific phone being viewed
      const normalized = formatPhoneNumber(phone);
      if (normalized) phonesToDnc.push(normalized);
    } else {
      // Add primary phone
      phonesToDnc.push(contact.phone_normalized);
    }
    // Also add secondary phone if it exists
    if (contact.secondary_phone) {
      const secNorm = formatPhoneNumber(contact.secondary_phone);
      if (secNorm) phonesToDnc.push(secNorm);
    }

    let dncAdded = 0;
    for (const p of phonesToDnc) {
      try {
        await query(
          `INSERT IGNORE INTO text_campaign_dnc (phone_normalized, source, campaign_id, contact_id)
           VALUES (?, 'manual_close', ?, ?)`,
          [p, contact.campaign_id, contact.id]
        );
        dncAdded++;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') throw err;
      }
    }

    res.json({
      success: true,
      message: `Contact closed and ${dncAdded} phone(s) added to DNC`,
      data: { dncAdded }
    });
  } catch (error) {
    console.error('[TextCampaigns] Error closing contact with DNC:', error);
    res.status(500).json({ success: false, message: 'Failed to close contact and add to DNC' });
  }
});

// Send campaign to all pending contacts
router.post('/:id/send', verifyToken, hasTextCampaignAccess, async (req, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.userId;

    const campaigns = await query(
      'SELECT * FROM text_campaigns WHERE id = ?',
      [campaignId]
    );
    if (!campaigns.length) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const campaign = campaigns[0];
    if (campaign.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Campaign has already been sent' });
    }

    // Get pending contacts, excluding any on the DNC list
    const contacts = await query(
      `SELECT tcc.* FROM text_campaign_contacts tcc
       LEFT JOIN text_campaign_dnc dnc ON tcc.phone_normalized = dnc.phone_normalized
       WHERE tcc.campaign_id = ? AND tcc.campaign_status = 'pending' AND dnc.id IS NULL`,
      [campaignId]
    );

    // Also mark any pending contacts that ARE on the DNC list as opted_out
    await query(
      `UPDATE text_campaign_contacts tcc
       INNER JOIN text_campaign_dnc dnc ON tcc.phone_normalized = dnc.phone_normalized
       SET tcc.campaign_status = 'opted_out'
       WHERE tcc.campaign_id = ? AND tcc.campaign_status = 'pending'`,
      [campaignId]
    );

    if (!contacts.length) {
      return res.status(400).json({ success: false, message: 'No pending contacts to send to' });
    }

    // Mark campaign as sending
    await query('UPDATE text_campaigns SET status = ? WHERE id = ?', ['sending', campaignId]);

    // Return immediately, process async
    res.json({ success: true, message: `Sending to ${contacts.length} contacts`, data: { contactCount: contacts.length } });

    // Process sending asynchronously
    setImmediate(async () => {
      // Load DNC set for secondary phone checks
      const dncRows = await query('SELECT phone_normalized FROM text_campaign_dnc');
      const dncSet = new Set(dncRows.map(r => r.phone_normalized));

      // Build cross-campaign cooldown set (18-day window)
      const cooldownRows = await query(
        `SELECT DISTINCT tcc2.phone_normalized, tcc2.secondary_phone
         FROM text_campaign_messages tcm2
         JOIN text_campaign_contacts tcc2 ON tcm2.contact_id = tcc2.id
         WHERE tcm2.direction = 'outbound'
           AND tcc2.campaign_id != ?
           AND tcm2.created_at >= DATE_SUB(NOW(), INTERVAL 18 DAY)`,
        [campaignId]
      );
      const cooldownSet = new Set();
      for (const row of cooldownRows) {
        if (row.phone_normalized) cooldownSet.add(row.phone_normalized);
        if (row.secondary_phone) {
          const secNorm2 = formatPhoneNumber(row.secondary_phone);
          if (secNorm2) cooldownSet.add(secNorm2);
        }
      }
      console.log(`[TextCampaigns] Cross-campaign cooldown: ${cooldownSet.size} phone(s) in 18-day window`);

      let sentCount = 0;
      let failedCount = 0;
      const sentPhones = new Set(); // Track phones already texted to avoid household dupes

      for (const contact of contacts) {
        // Skip if we already sent to this phone number in this batch
        if (sentPhones.has(contact.phone_normalized)) {
          await query(
            "UPDATE text_campaign_contacts SET campaign_status = 'sent', last_message_at = NOW(), last_outbound_at = NOW() WHERE id = ?",
            [contact.id]
          );
          console.log('[TextCampaigns] Skipping household dupe:', contact.phone_normalized);
          // Still try the secondary phone below
        } else if (cooldownSet.has(contact.phone_normalized)) {
          await query(
            "UPDATE text_campaign_contacts SET campaign_status = 'sent', last_message_at = NOW(), last_outbound_at = NOW() WHERE id = ?",
            [contact.id]
          );
          console.log('[TextCampaigns] Skipping primary - cross-campaign cooldown (18d):', contact.phone_normalized);
          // Still try the secondary phone below
        } else {
          // Send to primary phone
          try {
            const result = await sendSMS({
              toNumber: contact.phone_normalized,
              message: campaign.message_template,
              userId: userId,
              statusCallback: STATUS_CALLBACK_URL
            });

            if (result.success) {
              sentPhones.add(contact.phone_normalized);
              await query(
                `INSERT INTO text_campaign_messages (campaign_id, contact_id, phone_number, direction, message, twilio_sid, status, sent_by)
                 VALUES (?, ?, ?, 'outbound', ?, ?, 'sent', ?)`,
                [campaignId, contact.id, contact.phone_normalized, campaign.message_template, result.messageId, userId]
              );
              await query(
                'UPDATE text_campaign_contacts SET campaign_status = ?, last_message_at = NOW(), last_outbound_at = NOW() WHERE id = ?',
                ['sent', contact.id]
              );
              sentCount++;
            } else {
              // Check for Twilio 21610 (number opted out at carrier level)
              const is21610 = result.error && (result.error.includes('21610') || result.error.includes('unsubscribed'));
              if (is21610) {
                await query(
                  `INSERT IGNORE INTO text_campaign_dnc (phone_normalized, source, campaign_id, contact_id)
                   VALUES (?, 'twilio_21610', ?, ?)`,
                  [contact.phone_normalized, campaignId, contact.id]
                );
                await query('UPDATE text_campaign_contacts SET campaign_status = ? WHERE id = ?', ['opted_out', contact.id]);
                console.log('[TextCampaigns] 21610 opt-out detected, added to DNC:', contact.phone_normalized);
              } else {
                await query('UPDATE text_campaign_contacts SET campaign_status = ? WHERE id = ?', ['failed', contact.id]);
              }
              failedCount++;
              console.error('[TextCampaigns] Failed to send to', contact.phone_normalized, ':', result.error);
            }
          } catch (err) {
            // Also catch 21610 from thrown errors
            const is21610 = err.code === 21610 || (err.message && err.message.includes('21610'));
            if (is21610) {
              await query(
                `INSERT IGNORE INTO text_campaign_dnc (phone_normalized, source, campaign_id, contact_id)
                 VALUES (?, 'twilio_21610', ?, ?)`,
                [contact.phone_normalized, campaignId, contact.id]
              );
              await query('UPDATE text_campaign_contacts SET campaign_status = ? WHERE id = ?', ['opted_out', contact.id]);
            } else {
              await query('UPDATE text_campaign_contacts SET campaign_status = ? WHERE id = ?', ['failed', contact.id]);
            }
            failedCount++;
            console.error('[TextCampaigns] Error sending to', contact.phone_normalized, ':', err.message);
          }

          // Delay between sends to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Send to secondary phone if it exists
        if (contact.secondary_phone) {
          const secNorm = formatPhoneNumber(contact.secondary_phone);
          if (secNorm && !sentPhones.has(secNorm) && !dncSet.has(secNorm) && !cooldownSet.has(secNorm)) {
            try {
              const secResult = await sendSMS({
                toNumber: secNorm,
                message: campaign.message_template,
                userId: userId,
                statusCallback: STATUS_CALLBACK_URL
              });

              if (secResult.success) {
                sentPhones.add(secNorm);
                await query(
                  `INSERT INTO text_campaign_messages (campaign_id, contact_id, phone_number, direction, message, twilio_sid, status, sent_by)
                   VALUES (?, ?, ?, 'outbound', ?, ?, 'sent', ?)`,
                  [campaignId, contact.id, secNorm, campaign.message_template, secResult.messageId, userId]
                );
                // If primary failed but secondary succeeded, upgrade contact status to 'sent'
                await query(
                  "UPDATE text_campaign_contacts SET campaign_status = 'sent', last_message_at = NOW(), last_outbound_at = NOW() WHERE id = ? AND campaign_status = 'failed'",
                  [contact.id]
                );
                sentCount++;
                console.log('[TextCampaigns] Sent to secondary phone:', secNorm, 'for contact', contact.id);
              } else {
                const is21610 = secResult.error && (secResult.error.includes('21610') || secResult.error.includes('unsubscribed'));
                if (is21610) {
                  await query(
                    `INSERT IGNORE INTO text_campaign_dnc (phone_normalized, source, campaign_id, contact_id)
                     VALUES (?, 'twilio_21610', ?, ?)`,
                    [secNorm, campaignId, contact.id]
                  );
                  console.log('[TextCampaigns] 21610 on secondary phone, added to DNC:', secNorm);
                }
                failedCount++;
                console.error('[TextCampaigns] Failed to send to secondary', secNorm, ':', secResult.error);
              }
            } catch (err) {
              const is21610 = err.code === 21610 || (err.message && err.message.includes('21610'));
              if (is21610) {
                await query(
                  `INSERT IGNORE INTO text_campaign_dnc (phone_normalized, source, campaign_id, contact_id)
                   VALUES (?, 'twilio_21610', ?, ?)`,
                  [secNorm, campaignId, contact.id]
                );
              }
              failedCount++;
              console.error('[TextCampaigns] Error sending to secondary', secNorm, ':', err.message);
            }

            // Delay between sends
            await new Promise(resolve => setTimeout(resolve, 100));
          } else if (secNorm && sentPhones.has(secNorm)) {
            console.log('[TextCampaigns] Skipping secondary (already sent):', secNorm);
          } else if (secNorm && dncSet.has(secNorm)) {
            console.log('[TextCampaigns] Skipping secondary (DNC):', secNorm);
          } else if (secNorm && cooldownSet.has(secNorm)) {
            console.log('[TextCampaigns] Skipping secondary (cooldown 18d):', secNorm);
          }
        }
      }

      // Update campaign final status
      await query(
        'UPDATE text_campaigns SET status = ?, sent_count = ?, failed_count = ?, sent_at = NOW() WHERE id = ?',
        ['sent', sentCount, failedCount, campaignId]
      );
      console.log(`[TextCampaigns] Campaign ${campaignId} complete: ${sentCount} sent, ${failedCount} failed`);
    });
  } catch (error) {
    console.error('[TextCampaigns] Error sending campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to send campaign' });
  }
});

// Get message history for a contact (optionally filtered by phone number)
router.get('/contacts/:contactId/messages', verifyToken, hasTextCampaignAccess, async (req, res) => {
  try {
    const { phone } = req.query;

    // Verify contact exists
    const contact = await query(
      `SELECT tcc.*, tc.created_by, tc.name as campaign_name
       FROM text_campaign_contacts tcc
       JOIN text_campaigns tc ON tcc.campaign_id = tc.id
       WHERE tcc.id = ?`,
      [req.params.contactId]
    );
    if (!contact.length) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    let messageSql = 'SELECT * FROM text_campaign_messages WHERE contact_id = ?';
    const messageParams = [req.params.contactId];

    if (phone) {
      messageSql += ' AND phone_number = ?';
      messageParams.push(phone);
    }

    messageSql += ' ORDER BY created_at ASC';

    const messages = await query(messageSql, messageParams);

    res.json({ success: true, data: { contact: contact[0], messages } });
  } catch (error) {
    console.error('[TextCampaigns] Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

// Send a reply to a specific contact (optionally to a specific phone number)
router.post('/contacts/:contactId/reply', verifyToken, hasTextCampaignAccess, async (req, res) => {
  try {
    const { message, phone } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Verify contact exists and get info
    const contacts = await query(
      `SELECT tcc.*, tc.created_by
       FROM text_campaign_contacts tcc
       JOIN text_campaigns tc ON tcc.campaign_id = tc.id
       WHERE tcc.id = ?`,
      [req.params.contactId]
    );
    if (!contacts.length) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    const contact = contacts[0];
    const targetPhone = phone || contact.phone_normalized;

    // Block sending to opted-out contacts
    if (contact.campaign_status === 'opted_out') {
      return res.status(400).json({ success: false, message: 'This contact has opted out and cannot receive messages.' });
    }

    // Check DNC list as an extra safeguard (check the target phone)
    const dncCheck = await query('SELECT id FROM text_campaign_dnc WHERE phone_normalized = ?', [targetPhone]);
    if (dncCheck.length > 0) {
      return res.status(400).json({ success: false, message: 'This number is on the Do Not Contact list.' });
    }

    const result = await sendSMS({
      toNumber: targetPhone,
      message: message,
      userId: req.userId,
      statusCallback: STATUS_CALLBACK_URL
    });

    if (!result.success) {
      return res.status(500).json({ success: false, message: 'Failed to send message: ' + result.error });
    }

    await query(
      `INSERT INTO text_campaign_messages (campaign_id, contact_id, phone_number, direction, message, twilio_sid, status, sent_by)
       VALUES (?, ?, ?, 'outbound', ?, ?, 'sent', ?)`,
      [contact.campaign_id, contact.id, targetPhone, message, result.messageId, req.userId]
    );

    // Update last_message_at, and clear failed/pending status to 'sent' (don't downgrade 'responded' or 'closed')
    await query(
      `UPDATE text_campaign_contacts
       SET last_message_at = NOW(),
           campaign_status = CASE
             WHEN campaign_status IN ('failed', 'pending') THEN 'sent'
             ELSE campaign_status
           END
       WHERE id = ?`,
      [contact.id]
    );

    res.json({ success: true, message: 'Reply sent', data: { messageId: result.messageId } });
  } catch (error) {
    console.error('[TextCampaigns] Error sending reply:', error);
    res.status(500).json({ success: false, message: 'Failed to send reply' });
  }
});

module.exports = router;
