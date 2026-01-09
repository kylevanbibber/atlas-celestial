const express = require('express');
const router = express.Router();
const { query } = require('../db');
const verifyToken = require('../middleware/verifyToken');
const twilioService = require('../services/twilio');
const { replaceVariables } = require('../utils/smsVariableReplacer');
const { splitMessage } = require('../utils/smsMessageSplitter');
const { SMS_COST_CENTS } = require('../config/smsPackages');

/**
 * Get check-in text settings for current user
 * GET /api/check-in-texts/settings
 */
router.get('/settings', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    const settings = await query(
      `SELECT checkin_enabled, checkin_frequency_days FROM sms_auto_reload_settings WHERE user_id = ?`,
      [userId]
    );
    
    if (!settings || settings.length === 0) {
      // Return default settings if none exist
      return res.json({
        success: true,
        settings: {
          enabled: false,
          frequency_days: 3
        }
      });
    }
    
    res.json({
      success: true,
      settings: {
        enabled: settings[0].checkin_enabled === 1 || settings[0].checkin_enabled === true,
        frequency_days: settings[0].checkin_frequency_days || 3
      }
    });
    
  } catch (error) {
    console.error('[Check-In Texts] Error getting settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get settings',
      error: error.message
    });
  }
});

/**
 * Update check-in text settings for current user
 * POST /api/check-in-texts/settings
 */
router.post('/settings', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { enabled, frequency_days } = req.body;
    
    // Validate frequency_days
    if (frequency_days !== undefined && (frequency_days < 1 || frequency_days > 30)) {
      return res.status(400).json({
        success: false,
        message: 'Frequency must be between 1 and 30 days'
      });
    }
    
    // Insert or update settings in the sms_auto_reload_settings table
    await query(
      `INSERT INTO sms_auto_reload_settings (user_id, checkin_enabled, checkin_frequency_days)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         checkin_enabled = VALUES(checkin_enabled),
         checkin_frequency_days = VALUES(checkin_frequency_days),
         updated_at = NOW()`,
      [userId, enabled ? 1 : 0, frequency_days || 3]
    );
    
    console.log('[Check-In Texts] Settings updated for user:', userId, { enabled, frequency_days });
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        enabled: enabled,
        frequency_days: frequency_days || 3
      }
    });
    
  } catch (error) {
    console.error('[Check-In Texts] Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
});

/**
 * Determine the appropriate check-in message based on recruit's progress
 */
function getCheckInMessage(recruit, prelicProgress, checklistItem, managerPhone) {
  const firstName = recruit.recruit_first || 'there';
  const itemName = checklistItem?.item_name || 'your onboarding';
  
  // If they have prelic_progress and haven't completed checklist item 50
  if (prelicProgress) {
    const timeSpent = prelicProgress.time_spent || '0 hrs 0 mins';
    const lastLogin = prelicProgress.last_log_in;
    const completePct = parseFloat(prelicProgress.ple_complete_pct) || 0;
    const preparedToPass = prelicProgress.prepared_to_pass;
    
    // Calculate days since last login
    let daysSinceLogin = 0;
    if (lastLogin) {
      const loginDate = new Date(lastLogin);
      const today = new Date();
      daysSinceLogin = Math.floor((today - loginDate) / (1000 * 60 * 60 * 24));
    }
    
    // Case 1: No time spent (0 hrs 0 mins)
    if (timeSpent === '0 hrs 0 mins' || timeSpent === '0 hrs 0mins') {
      return `Hey ${firstName}, how's it going? Looks like you haven't had a chance to start your course yet. Let me know if you need anything, the best way to get it done is chip away a little at a time. ${managerPhone}`;
    }
    
    // Case 2: Last login over 7 days AND progress between 10-100% (but not complete)
    if (daysSinceLogin > 7 && completePct > 10 && completePct < 100) {
      return `Hey ${firstName}, just checking in! Looks like you were knocking out some of the course but had to take a break. Let me know if you need anything. ${managerPhone}`;
    }
    
    // Case 3: Progress 0-10% AND last login under 7 days
    if (completePct >= 0 && completePct <= 10 && daysSinceLogin <= 7) {
      return `Hey ${firstName}, looking forward to you getting started with us! Let me know if you need any help navigating your course. ${managerPhone}`;
    }
    
    // Case 4: Progress 10-50%
    if (completePct > 10 && completePct <= 50) {
      return `Hey ${firstName}, good job on the course so far! Anything else you need let me know. ${managerPhone}`;
    }
    
    // Case 5: Progress 50-99% AND last login under 7 days
    if (completePct > 50 && completePct < 100 && daysSinceLogin <= 7) {
      return `Hey ${firstName}, I see you've been knocking out a lot of the course! Getting close to scheduling your licensing test. Let me know if you need anything. ${managerPhone}`;
    }
    
    // Case 6: 100% complete but not "PREPARED TO PASS"
    if (completePct >= 100 && preparedToPass !== 'PREPARED TO PASS') {
      return `Hey ${firstName}, looks like you got the biggest part of the course out of the way. Now for the easy part. Just complete your prep and exam simulator so you're ready to pass your test on the first try. ${managerPhone}`;
    }
  }
  
  // Default message if no prelic_progress or doesn't match any specific case
  return `Hey ${firstName}, how's it going? I see you've been working on ${itemName} for a minute. If you need anything feel free to text me ${managerPhone}.`;
}

/**
 * Send a check-in text to a recruit
 * POST /api/check-in-texts/send/:recruitId
 */
router.post('/send/:recruitId', verifyToken, async (req, res) => {
  try {
    const { recruitId } = req.params;
    const userId = req.userId;
    
    console.log('[Check-In Texts] Sending check-in text for recruit:', recruitId);
    
    // Fetch recruit data
    const recruits = await query(
      `SELECT p.*, u.screen_name, u.phone as manager_phone, u.lagnname
       FROM pipeline p
       LEFT JOIN activeusers u ON p.recruiting_agent = u.id
       WHERE p.id = ?`,
      [recruitId]
    );
    
    if (!recruits || recruits.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recruit not found'
      });
    }
    
    const recruit = recruits[0];
    
    if (!recruit.phone) {
      return res.status(400).json({
        success: false,
        message: 'Recruit has no phone number'
      });
    }
    
    // Check if checklist item 50 is completed
    const item50Progress = await query(
      `SELECT completed FROM pipeline_checklist_progress
       WHERE recruit_id = ? AND checklist_item_id = 50`,
      [recruitId]
    );
    
    if (item50Progress && item50Progress.length > 0 && item50Progress[0].completed) {
      return res.status(400).json({
        success: false,
        message: 'Checklist item 50 already completed - no check-in needed'
      });
    }
    
    // Get prelic_progress if exists
    let prelicProgress = null;
    if (recruit.email) {
      const prelicRows = await query(
        `SELECT * FROM prelic_progress WHERE email = ?`,
        [recruit.email]
      );
      if (prelicRows && prelicRows.length > 0) {
        prelicProgress = prelicRows[0];
      }
    }
    
    // Get current checklist item they're working on
    const currentProgress = await query(
      `SELECT pcp.*, pci.item_name, pci.stage_name
       FROM pipeline_checklist_progress pcp
       JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
       WHERE pcp.recruit_id = ? AND pcp.completed = 0
       ORDER BY pci.item_order ASC
       LIMIT 1`,
      [recruitId]
    );
    
    const currentItem = currentProgress && currentProgress.length > 0 ? currentProgress[0] : null;
    
    // Get manager phone
    const managerPhone = recruit.manager_phone || '';
    
    // Generate appropriate message
    const message = getCheckInMessage(recruit, prelicProgress, currentItem, managerPhone);
    
    console.log('[Check-In Texts] Generated message:', message.substring(0, 100) + '...');
    
    // Split message if needed
    const messageSegments = splitMessage(message, 918, false);
    
    // Determine MGA user ID for billing
    const userRows = await query(
      `SELECT id, clname, mga FROM activeusers WHERE id = ?`,
      [userId]
    );
    const user = userRows && userRows.length > 0 ? userRows[0] : null;
    let mgaUserId = userId;
    
    if (user && ['AGT', 'SA', 'GA'].includes(user.clname) && user.mga) {
      const mgaRows = await query(
        `SELECT id FROM activeusers WHERE lagnname = ? AND clname IN ('MGA', 'RGA')`,
        [user.mga]
      );
      if (mgaRows && mgaRows.length > 0) {
        mgaUserId = mgaRows[0].id;
      }
    }
    
    // Send all segments
    const sentMessageIds = [];
    for (let i = 0; i < messageSegments.length; i++) {
      const segment = messageSegments[i];
      
      const smsResult = await twilioService.sendSMS({
        toNumber: recruit.phone,
        message: segment,
        userId: mgaUserId
      });
      
      if (!smsResult.success) {
        console.error('[Check-In Texts] Error sending segment:', smsResult.error);
        return res.status(500).json({
          success: false,
          message: 'Failed to send check-in text: ' + smsResult.error
        });
      }
      
      sentMessageIds.push(smsResult.messageId);
      
      if (i < messageSegments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Calculate total cost
    const totalCost = SMS_COST_CENTS * messageSegments.length;
    
    // Deduct balance
    await query(
      `INSERT INTO sms_balances (user_id, balance, last_updated)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE balance = balance - ?, last_updated = NOW()`,
      [mgaUserId, -totalCost, totalCost]
    );
    
    // Log transaction
    await query(
      `INSERT INTO sms_credit_transactions 
       (user_id, amount, transaction_type, description, stripe_payment_intent_id, related_id)
       VALUES (?, ?, 'debit', ?, NULL, ?)`,
      [mgaUserId, -totalCost, `Check-in text to ${recruit.phone}`, sentMessageIds.join(',')]
    );
    
    // Log messages
    for (let i = 0; i < messageSegments.length; i++) {
      await query(
        `INSERT INTO sms_messages 
         (user_id, pipeline_id, to_number, message, provider, provider_message_id, status, cost_credits)
         VALUES (?, ?, ?, ?, 'twilio', ?, 'sent', ?)`,
        [userId, recruitId, recruit.phone, messageSegments[i], sentMessageIds[i], SMS_COST_CENTS]
      );
    }
    
    // Update last_checkin_sent timestamp
    await query(
      `UPDATE pipeline SET last_checkin_sent = NOW() WHERE id = ?`,
      [recruitId]
    );
    
    // Log the automated check-in
    await query(
      `INSERT INTO pipeline_checkin_log 
       (recruit_id, checkin_type, current_stage, current_checklist_item_id)
       VALUES (?, 'automated', ?, ?)`,
      [recruitId, recruit.step, currentItem ? currentItem.checklist_item_id : null]
    );
    
    console.log('[Check-In Texts] Successfully sent check-in text to', recruit.phone);
    
    res.json({
      success: true,
      message: 'Check-in text sent successfully',
      segments: messageSegments.length,
      messageIds: sentMessageIds
    });
    
  } catch (error) {
    console.error('[Check-In Texts] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send check-in text',
      error: error.message
    });
  }
});

/**
 * Get preview of check-in message for a recruit (without sending)
 * GET /api/check-in-texts/preview/:recruitId
 */
router.get('/preview/:recruitId', verifyToken, async (req, res) => {
  try {
    const { recruitId } = req.params;
    
    // Fetch recruit data
    const recruits = await query(
      `SELECT p.*, u.screen_name, u.phone as manager_phone, u.lagnname
       FROM pipeline p
       LEFT JOIN activeusers u ON p.recruiting_agent = u.id
       WHERE p.id = ?`,
      [recruitId]
    );
    
    if (!recruits || recruits.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recruit not found'
      });
    }
    
    const recruit = recruits[0];
    
    // Check if checklist item 50 is completed
    const item50Progress = await query(
      `SELECT completed FROM pipeline_checklist_progress
       WHERE recruit_id = ? AND checklist_item_id = 50`,
      [recruitId]
    );
    
    const item50Completed = item50Progress && item50Progress.length > 0 && item50Progress[0].completed;
    
    // Get prelic_progress if exists
    let prelicProgress = null;
    if (recruit.email) {
      const prelicRows = await query(
        `SELECT * FROM prelic_progress WHERE email = ?`,
        [recruit.email]
      );
      if (prelicRows && prelicRows.length > 0) {
        prelicProgress = prelicRows[0];
      }
    }
    
    // Get current checklist item
    const currentProgress = await query(
      `SELECT pcp.*, pci.item_name, pci.stage_name
       FROM pipeline_checklist_progress pcp
       JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
       WHERE pcp.recruit_id = ? AND pcp.completed = 0
       ORDER BY pci.item_order ASC
       LIMIT 1`,
      [recruitId]
    );
    
    const currentItem = currentProgress && currentProgress.length > 0 ? currentProgress[0] : null;
    const managerPhone = recruit.manager_phone || '';
    
    // Generate message
    const message = getCheckInMessage(recruit, prelicProgress, currentItem, managerPhone);
    
    res.json({
      success: true,
      message,
      shouldSend: !item50Completed,
      item50Completed,
      prelicProgress: prelicProgress ? {
        timeSpent: prelicProgress.time_spent,
        lastLogin: prelicProgress.last_log_in,
        completePct: prelicProgress.ple_complete_pct,
        preparedToPass: prelicProgress.prepared_to_pass
      } : null,
      currentItem: currentItem ? {
        name: currentItem.item_name,
        stage: currentItem.stage_name
      } : null
    });
    
  } catch (error) {
    console.error('[Check-In Texts] Preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate preview',
      error: error.message
    });
  }
});

/**
 * Get list of recruits due for check-in texts
 * GET /api/check-in-texts/due
 */
router.get('/due', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    console.log('[Check-In Texts] Getting due recruits for user:', userId);
    
    // Get user's check-in settings from sms_auto_reload_settings
    const settings = await query(
      `SELECT checkin_enabled, checkin_frequency_days FROM sms_auto_reload_settings WHERE user_id = ? AND checkin_enabled = 1`,
      [userId]
    );
    
    if (!settings || settings.length === 0) {
      return res.json({
        success: true,
        recruits: [],
        message: 'Check-in texts not enabled'
      });
    }
    
    const frequencyDays = settings[0].checkin_frequency_days || 3;
    console.log('[Check-In Texts] Frequency days:', frequencyDays);
    
    // Get user's hierarchy (same logic as KPI endpoint)
    const hierarchyQuery = `
      SELECT id FROM activeusers 
      WHERE sa = ? OR ga = ? OR mga = ? OR rga = ?
    `;
    const hierarchyResult = await query(hierarchyQuery, [userId, userId, userId, userId]);
    const hierarchyIds = hierarchyResult.map(row => row.id);
    const allIds = [userId, ...hierarchyIds];
    
    console.log('[Check-In Texts] User IDs (including hierarchy):', allIds);
    
    const placeholders = allIds.map(() => '?').join(',');
    
    // Get recruits that:
    // 1. Belong to this user or their hierarchy (recruiting_agent OR code_to)
    // 2. Are unredeemed
    // 3. Are in active stages (Licensing, Onboarding, Training)
    // 4. Were added more than 2 days ago (grace period for new recruits)
    // 5. Haven't received a check-in in the last X days (or never received one)
    // 6. Have a phone number
    const recruits = await query(
      `SELECT 
        p.id,
        p.recruit_first,
        p.recruit_last,
        p.phone,
        p.email,
        p.step,
        p.last_checkin_sent,
        DATEDIFF(NOW(), p.last_checkin_sent) as days_since_checkin
       FROM pipeline p
       WHERE p.redeemed = 0
         AND p.step IN ('Licensing', 'Onboarding', 'Training')
         AND p.date_added < DATE_SUB(NOW(), INTERVAL 2 DAY)
         AND (p.recruiting_agent IN (${placeholders}) OR p.code_to IN (${placeholders}))
         AND p.phone IS NOT NULL
         AND p.phone != ''
         AND (
           p.last_checkin_sent IS NULL 
           OR DATEDIFF(NOW(), p.last_checkin_sent) >= ?
         )
       ORDER BY p.last_checkin_sent ASC, p.date_added DESC
       LIMIT 50`,
      [...allIds, ...allIds, frequencyDays]
    );
    
    console.log('[Check-In Texts] Found', recruits.length, 'recruits due for check-in');
    
    res.json({
      success: true,
      recruits: recruits || [],
      settings: {
        frequency_days: frequencyDays
      }
    });
    
  } catch (error) {
    console.error('[Check-In Texts] Error getting due recruits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get due recruits',
      error: error.message
    });
  }
});

/**
 * Log a manual check-in for a recruit
 * POST /api/check-in-texts/manual/:recruitId
 */
router.post('/manual/:recruitId', verifyToken, async (req, res) => {
  try {
    const { recruitId } = req.params;
    const userId = req.userId;
    const { notes } = req.body;
    
    console.log('[Check-In Texts] Logging manual check-in for recruit:', recruitId);
    
    // Get recruit's current stage and next incomplete checklist item
    const recruits = await query(
      `SELECT p.step FROM pipeline p WHERE p.id = ?`,
      [recruitId]
    );
    
    if (!recruits || recruits.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recruit not found'
      });
    }
    
    const currentStage = recruits[0].step;
    
    // Get the next incomplete checklist item for this recruit's stage
    const nextItem = await query(
      `SELECT pci.id 
       FROM pipeline_checklist_items pci
       LEFT JOIN pipeline_checklist_progress pcp 
         ON pci.id = pcp.checklist_item_id AND pcp.recruit_id = ?
       WHERE pci.stage_name = ? 
         AND pci.active = 1
         AND (pcp.completed IS NULL OR pcp.completed = 0)
       ORDER BY pci.item_order ASC
       LIMIT 1`,
      [recruitId, currentStage]
    );
    
    const currentItemId = nextItem && nextItem.length > 0 ? nextItem[0].id : null;
    
    // Log the manual check-in
    await query(
      `INSERT INTO pipeline_checkin_log 
       (recruit_id, checkin_type, checkin_by, current_stage, current_checklist_item_id, notes)
       VALUES (?, 'manual', ?, ?, ?, ?)`,
      [recruitId, userId, currentStage, currentItemId, notes || null]
    );
    
    console.log('[Check-In Texts] Manual check-in logged successfully');
    
    res.json({
      success: true,
      message: 'Check-in logged successfully'
    });
    
  } catch (error) {
    console.error('[Check-In Texts] Error logging manual check-in:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log check-in',
      error: error.message
    });
  }
});

/**
 * Get check-in history for a recruit
 * GET /api/check-in-texts/history/:recruitId
 */
router.get('/history/:recruitId', verifyToken, async (req, res) => {
  try {
    const { recruitId } = req.params;
    
    const history = await query(
      `SELECT 
        pcl.id,
        pcl.recruit_id,
        pcl.checkin_type,
        DATE_FORMAT(pcl.checkin_date, '%Y-%m-%d %H:%i:%s') as checkin_date,
        pcl.checkin_by,
        pcl.current_stage,
        pcl.current_checklist_item_id,
        pcl.notes,
        u.lagnname as checkin_by_name,
        pci.item_name as checklist_item_name
       FROM pipeline_checkin_log pcl
       LEFT JOIN activeusers u ON pcl.checkin_by = u.id
       LEFT JOIN pipeline_checklist_items pci ON pcl.current_checklist_item_id = pci.id
       WHERE pcl.recruit_id = ?
       ORDER BY pcl.checkin_date DESC
       LIMIT 50`,
      [recruitId]
    );
    
    res.json({
      success: true,
      history: history || []
    });
    
  } catch (error) {
    console.error('[Check-In Texts] Error getting check-in history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get check-in history',
      error: error.message
    });
  }
});

/**
 * Get last check-in for a recruit
 * GET /api/check-in-texts/last/:recruitId
 */
router.get('/last/:recruitId', verifyToken, async (req, res) => {
  try {
    const { recruitId } = req.params;
    
    const lastCheckin = await query(
      `SELECT 
        pcl.id,
        pcl.recruit_id,
        pcl.checkin_type,
        DATE_FORMAT(pcl.checkin_date, '%Y-%m-%d %H:%i:%s') as checkin_date,
        pcl.checkin_by,
        pcl.current_stage,
        pcl.current_checklist_item_id,
        pcl.notes,
        u.lagnname as checkin_by_name,
        pci.item_name as checklist_item_name
       FROM pipeline_checkin_log pcl
       LEFT JOIN activeusers u ON pcl.checkin_by = u.id
       LEFT JOIN pipeline_checklist_items pci ON pcl.current_checklist_item_id = pci.id
       WHERE pcl.recruit_id = ?
       ORDER BY pcl.checkin_date DESC
       LIMIT 1`,
      [recruitId]
    );
    
    res.json({
      success: true,
      lastCheckin: lastCheckin && lastCheckin.length > 0 ? lastCheckin[0] : null
    });
    
  } catch (error) {
    console.error('[Check-In Texts] Error getting last check-in:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get last check-in',
      error: error.message
    });
  }
});

module.exports = router;

