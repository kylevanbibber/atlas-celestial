const express = require('express');
const router = express.Router();
const db = require('../db.js');
const emailService = require('../services/emailService');
const verifyToken = require('../middleware/verifyToken');
const { query } = require('../db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { SMS_PACKAGES, SMS_COST_CENTS, AUTO_RELOAD_THRESHOLDS, AUTO_RELOAD_AMOUNTS } = require('../config/smsPackages');
const twilioService = require('../services/twilio');
const twilioConversations = require('../services/twilioConversations');
const { replaceVariables } = require('../utils/smsVariableReplacer');
const { splitMessage, addPartIndicators } = require('../utils/smsMessageSplitter');

/**
 * Complete all checklist items for a specific stage
 */
async function completeStageItems(recruitId, stageName, residentState) {
  try {
    // Get all checklist items for this specific stage
    let allItems = await db.query(`
      SELECT id, stage_name, item_name
      FROM pipeline_checklist_items
      WHERE stage_name = ?
        AND team_id IS NULL
      ORDER BY item_order
    `, [stageName]);
    
    // Apply state-specific modifications if resident state is provided
    if (residentState) {
      const stateReqs = await db.query(`
        SELECT stage_name, target_item_name, action, instructions
        FROM pipeline_state_requirements
        WHERE state = ? AND active = 1
          AND stage_name = ?
      `, [residentState, stageName]);
      
      // Apply state modifications (remove items marked for removal)
      for (const req of stateReqs) {
        if (req.action === 'remove') {
          allItems = allItems.filter(item => 
            !(item.stage_name === req.stage_name && item.item_name === req.target_item_name)
          );
        }
      }
    }
    
    // Auto-complete each item
    const now = new Date().toISOString();
    for (const item of allItems) {
      // Use INSERT ... ON DUPLICATE KEY UPDATE to handle race conditions
      await db.query(`
        INSERT INTO pipeline_checklist_progress 
        (recruit_id, checklist_item_id, completed, completed_by, started_at, completed_at)
        VALUES (?, ?, 1, NULL, ?, ?)
        ON DUPLICATE KEY UPDATE
          completed = 1,
          completed_by = NULL,
          started_at = COALESCE(started_at, VALUES(started_at)),
          completed_at = VALUES(completed_at)
      `, [recruitId, item.id, now, now]);
    }
    
    console.log(`✅ Auto-completed ${allItems.length} items for stage "${stageName}" for recruit ${recruitId}`);
  } catch (error) {
    console.error('Error completing stage items:', error);
    // Don't throw - this is a helper function, shouldn't block main operation
  }
}

/**
 * Auto-complete all checklist items from stages prior to and including the given stage
 */
async function autoCompletePriorStageItems(recruitId, currentStage, residentState) {
  try {
    // Get the ordered list of stages
    const stages = await db.query(`
      SELECT stage_name, position_after, is_terminal
      FROM pipeline_stage_definitions
      WHERE is_terminal = 0
      ORDER BY id
    `);
    
    // Build stage order by following position_after chain
    const stageOrder = [];
    let current = stages.find(s => s.position_after === null);
    const visited = new Set();
    
    while (current && !visited.has(current.stage_name)) {
      stageOrder.push(current.stage_name);
      visited.add(current.stage_name);
      current = stages.find(s => s.position_after === current.stage_name);
    }
    
    // Find current stage index
    const currentIndex = stageOrder.indexOf(currentStage);
    if (currentIndex === -1) return; // Stage not found
    
    // Get all stages before AND INCLUDING the current one (so items from the stage being left are completed)
    const priorStages = stageOrder.slice(0, currentIndex);
    if (priorStages.length === 0) return; // No prior stages
    
    // Get all checklist items from prior stages
    const placeholders = priorStages.map(() => '?').join(',');
    let allItems = await db.query(`
      SELECT id, stage_name, item_name
      FROM pipeline_checklist_items
      WHERE stage_name IN (${placeholders})
        AND team_id IS NULL
      ORDER BY stage_name, item_order
    `, priorStages);
    
    // Apply state-specific modifications if resident state is provided
    if (residentState) {
      const stateReqs = await db.query(`
        SELECT stage_name, target_item_name, action, instructions
        FROM pipeline_state_requirements
        WHERE state = ? AND active = 1
          AND stage_name IN (${placeholders})
      `, [residentState, ...priorStages]);
      
      // Apply state modifications (remove items marked for removal)
      for (const req of stateReqs) {
        if (req.action === 'remove') {
          allItems = allItems.filter(item => 
            !(item.stage_name === req.stage_name && item.item_name === req.target_item_name)
          );
        }
      }
    }
    
    // Auto-complete each item
    const now = new Date().toISOString();
    for (const item of allItems) {
      // Use INSERT ... ON DUPLICATE KEY UPDATE to handle race conditions
      await db.query(`
        INSERT INTO pipeline_checklist_progress 
        (recruit_id, checklist_item_id, completed, completed_by, started_at, completed_at)
        VALUES (?, ?, 1, NULL, ?, ?)
        ON DUPLICATE KEY UPDATE
          completed = 1,
          completed_by = NULL,
          started_at = COALESCE(started_at, VALUES(started_at)),
          completed_at = VALUES(completed_at)
      `, [recruitId, item.id, now, now]);
    }
    
    console.log(`✅ Auto-completed ${allItems.length} prior stage items for recruit ${recruitId} at stage ${currentStage}`);
  } catch (error) {
    console.error('Error auto-completing prior stage items:', error);
    // Don't throw - this is a helper function, shouldn't block main operation
  }
}

// Get all recruits/applicants
// Get KPI data for pipeline dashboard
router.get('/kpis', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userIds = req.query.userIds ? req.query.userIds.split(',').map(id => parseInt(id)) : null;

    console.log('[KPI Endpoint] User ID:', userId);
    console.log('[KPI Endpoint] Filtering by userIds:', userIds);

    // Build user filter clause
    let userFilterClause = '';
    let userFilterParams = [];
    
    if (userIds && userIds.length > 0) {
      // Get hierarchy for all users
      const allIds = new Set(userIds.map(id => parseInt(id)));
      
      for (const uid of userIds) {
        const hierarchyQuery = `
          SELECT id FROM activeusers 
          WHERE sa = ? OR ga = ? OR mga = ? OR rga = ?
        `;
        const hierarchyResult = await db.query(hierarchyQuery, [uid, uid, uid, uid]);
        hierarchyResult.forEach(row => allIds.add(row.id));
      }
      
      // Check if any user in the team is MAUGHANEVANSON BRODY W
      const teamUsersResult = await db.query(`
        SELECT lagnname FROM activeusers WHERE id IN (${userIds.map(() => '?').join(',')})
      `, userIds);
      const hasMaughanevanson = teamUsersResult.some(u => u.lagnname === 'MAUGHANEVANSON BRODY W');
      
      // Special case: If MAUGHANEVANSON BRODY W is in the team, also include all LOCKER-ROTOLO users
      if (hasMaughanevanson) {
        const lockerRotoloUsers = await db.query(`
          SELECT id FROM activeusers 
          WHERE rept_name = 'LOCKER-ROTOLO'
          AND Active = 'y'
        `);
        lockerRotoloUsers.forEach(row => allIds.add(row.id));
      }
      
      const allIdsArray = Array.from(allIds);
      console.log('[KPI Endpoint] All user IDs (including hierarchy):', allIdsArray);
      
      const placeholders = allIdsArray.map(() => '?').join(',');
      userFilterClause = `AND (p.recruiting_agent IN (${placeholders}) OR p.code_to IN (${placeholders}))`;
      userFilterParams = [...allIdsArray, ...allIdsArray];
    }

    // Total recruits in Licensing, Onboarding, or Training
    const totalResult = await db.query(`
      SELECT COUNT(*) as count 
      FROM pipeline p
      WHERE p.redeemed = 0
        AND p.step IN ('Licensing', 'Onboarding', 'Training')
        ${userFilterClause}
    `, userFilterParams);
    const totalRecruits = totalResult[0]?.count || 0;

    // Needs AOB Sent: recruits in Licensing or Onboarding without AOB completed and aob is null
    const needsAobResult = await db.query(`
      SELECT COUNT(DISTINCT p.id) as count
      FROM pipeline p
      WHERE p.redeemed = 0
        AND p.step IN ('Licensing', 'Onboarding')
        AND (p.aob IS NULL OR p.aob = '')
        ${userFilterClause}
        AND NOT EXISTS (
          SELECT 1 
          FROM pipeline_checklist_items pci
          JOIN pipeline_checklist_progress pcp 
            ON pci.id = pcp.checklist_item_id AND pcp.recruit_id = p.id
          WHERE pci.team_id IS NULL
            AND LOWER(pci.item_name) LIKE '%aob%completed%'
            AND pcp.completed = 1
        )
    `, userFilterParams);
    const needsAob = needsAobResult[0]?.count || 0;

    // Get user's check-in frequency setting (default to 3 days if not set)
    const settingsResult = await db.query(`
      SELECT checkin_frequency_days
      FROM sms_auto_reload_settings
      WHERE user_id = ?
      LIMIT 1
    `, [userId]);
    const checkinDays = settingsResult[0]?.checkin_frequency_days || 3;

    // Needs check-in based on user's setting (exclude recruits added within last 2 days)
    const needsCheckinResult = await db.query(`
      SELECT COUNT(DISTINCT p.id) as count
      FROM pipeline p
      WHERE p.redeemed = 0
        AND p.step IN ('Licensing', 'Onboarding', 'Training')
        AND p.date_added < DATE_SUB(NOW(), INTERVAL 2 DAY)
        ${userFilterClause}
        AND (
          p.last_checkin_sent IS NULL 
          OR p.last_checkin_sent < DATE_SUB(NOW(), INTERVAL ? DAY)
        )
    `, [...userFilterParams, checkinDays]);
    const needsCheckin = needsCheckinResult[0]?.count || 0;

    // Completed checklist items this week (count of items, not recruits)
    const completedThisWeekResult = await db.query(`
      SELECT COUNT(*) as count
      FROM pipeline_checklist_progress pcp
      JOIN pipeline p ON pcp.recruit_id = p.id
      WHERE pcp.completed = 1
        AND pcp.completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND p.redeemed = 0
        ${userFilterClause}
    `, userFilterParams);
    const completedThisWeek = completedThisWeekResult[0]?.count || 0;

    console.log('[KPI Endpoint] Results:', { totalRecruits, needsAob, needsCheckin, completedThisWeek });

    res.json({
      success: true,
      totalRecruits,
      needsAob,
      needsCheckin,
      completedThisWeek
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch KPI data',
      error: error.message 
    });
  }
});

router.get('/recruits', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.*,
        p.redeemed as pipeline_redeemed,
        u.lagnname,
        coded.lagnname as coded_to_name,
        au.Active as activeuser_active,
        au.managerActive as activeuser_manager_active,
        au.redeemed as account_redeemed,
        DATE_FORMAT(ps.date_entered, '%Y-%m-%d %H:%i:%s') as current_stage_entered,
        DATE_FORMAT(p.date_added, '%Y-%m-%d %H:%i:%s') as date_added_utc,
        aob.ImportDate as aob_import_date,
        pp.date_enrolled as xcel_date_enrolled,
        pp.time_spent as xcel_time_spent,
        pp.ple_complete_pct as xcel_progress_pct,
        pp.prepared_to_pass as xcel_prepared_to_pass,
        pp.email_date as xcel_last_updated,
        pp.last_log_in as xcel_last_log_in,
        (SELECT pci.id
         FROM pipeline_checklist_items pci
         LEFT JOIN pipeline_checklist_progress pcp 
           ON pci.id = pcp.checklist_item_id AND pcp.recruit_id = p.id
         WHERE pci.stage_name = p.step 
           AND pci.active = 1
           AND (pcp.completed IS NULL OR pcp.completed = 0)
         ORDER BY pci.item_order ASC
         LIMIT 1) as current_task_id,
        (SELECT pci.item_name
         FROM pipeline_checklist_items pci
         LEFT JOIN pipeline_checklist_progress pcp 
           ON pci.id = pcp.checklist_item_id AND pcp.recruit_id = p.id
         WHERE pci.stage_name = p.step 
           AND pci.active = 1
           AND (pcp.completed IS NULL OR pcp.completed = 0)
         ORDER BY pci.item_order ASC
         LIMIT 1) as current_task_name,
        (SELECT DATE_FORMAT(pcl.checkin_date, '%Y-%m-%d %H:%i:%s')
         FROM pipeline_checkin_log pcl
         WHERE pcl.recruit_id = p.id
         ORDER BY pcl.checkin_date DESC
         LIMIT 1) as last_checkin_date,
        (SELECT pcl.checkin_type
         FROM pipeline_checkin_log pcl
         WHERE pcl.recruit_id = p.id
         ORDER BY pcl.checkin_date DESC
         LIMIT 1) as last_checkin_type,
        (SELECT u2.lagnname
         FROM pipeline_checkin_log pcl
         LEFT JOIN activeusers u2 ON pcl.checkin_by = u2.id
         WHERE pcl.recruit_id = p.id
         ORDER BY pcl.checkin_date DESC
         LIMIT 1) as last_checkin_by_name,
        (SELECT pci2.item_name
         FROM pipeline_checkin_log pcl
         LEFT JOIN pipeline_checklist_items pci2 ON pcl.current_checklist_item_id = pci2.id
         WHERE pcl.recruit_id = p.id
         ORDER BY pcl.checkin_date DESC
         LIMIT 1) as last_checkin_item_name
      FROM pipeline p
      LEFT JOIN activeusers u ON p.recruiting_agent = u.id
      LEFT JOIN activeusers coded ON p.code_to = coded.id
      LEFT JOIN activeusers au ON au.pipeline_id = p.id
      LEFT JOIN pipeline_steps ps ON ps.recruit_id = p.id AND ps.date_exited IS NULL
      LEFT JOIN AOBUpdates aob ON p.aob = aob.id
      LEFT JOIN prelic_progress pp ON p.email = pp.email
      ORDER BY p.date_added DESC
    `;
    
    const result = await db.query(query);
    
    // Debug: Log a sample timestamp and stages
    if (result && result.length > 0) {
      console.log('🕐 [Backend] Sample current_stage_entered from DB:', result[0].current_stage_entered);
      console.log('🕐 [Backend] Sample date_added from DB:', result[0].date_added);
      console.log('🕐 [Backend] Type of current_stage_entered:', typeof result[0].current_stage_entered);
      console.log('📊 [Backend] Sample recruit step:', result[0].step);
      
      // Log all unique stages
      const uniqueStages = [...new Set(result.map(r => r.step))];
      console.log('📊 [Backend] All unique stages in results:', uniqueStages);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching recruits:', error);
    res.status(500).json({ error: 'Failed to fetch recruits' });
  }
});

// ============================================================
// PIPELINE SMS CREDITS & BILLING
// ============================================================

// ============================================================
// SMS TEMPLATES
// ============================================================

// Get all SMS templates for the current user
router.get('/sms/templates', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Get user's personal templates + shared templates from their team
    const templates = await query(
      `SELECT 
        st.id,
        st.user_id,
        st.name,
        st.message,
        st.is_shared,
        st.category,
        st.usage_count,
        st.created_at,
        st.updated_at,
        au.lagnname as created_by_name
      FROM sms_templates st
      LEFT JOIN activeusers au ON st.user_id = au.id
      WHERE st.user_id = ? OR st.is_shared = 1
      ORDER BY st.is_shared ASC, st.name ASC`,
      [userId]
    );

    res.json({
      success: true,
      data: templates || []
    });
  } catch (error) {
    console.error('[Recruitment Route] Error fetching SMS templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SMS templates',
      error: error.message
    });
  }
});

// Create a new SMS template
router.post('/sms/templates', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { name, message, is_shared, category } = req.body;

    if (!name || !message) {
      return res.status(400).json({
        success: false,
        message: 'Template name and message are required'
      });
    }

    const result = await query(
      `INSERT INTO sms_templates (user_id, name, message, is_shared, category)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, name, message, is_shared ? 1 : 0, category || null]
    );

    res.json({
      success: true,
      message: 'Template created successfully',
      templateId: result.insertId
    });
  } catch (error) {
    console.error('[Recruitment Route] Error creating SMS template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create SMS template',
      error: error.message
    });
  }
});

// Update an SMS template
router.put('/sms/templates/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { name, message, is_shared, category } = req.body;

    // Check if user owns this template
    const templateRows = await query(
      'SELECT user_id FROM sms_templates WHERE id = ?',
      [id]
    );

    if (!templateRows || templateRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    if (templateRows[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own templates'
      });
    }

    await query(
      `UPDATE sms_templates 
       SET name = ?, message = ?, is_shared = ?, category = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, message, is_shared ? 1 : 0, category || null, id]
    );

    res.json({
      success: true,
      message: 'Template updated successfully'
    });
  } catch (error) {
    console.error('[Recruitment Route] Error updating SMS template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update SMS template',
      error: error.message
    });
  }
});

// Delete an SMS template
router.delete('/sms/templates/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check if user owns this template
    const templateRows = await query(
      'SELECT user_id FROM sms_templates WHERE id = ?',
      [id]
    );

    if (!templateRows || templateRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    if (templateRows[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own templates'
      });
    }

    await query('DELETE FROM sms_templates WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('[Recruitment Route] Error deleting SMS template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete SMS template',
      error: error.message
    });
  }
});

// Increment template usage count
router.post('/sms/templates/:id/use', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    await query(
      'UPDATE sms_templates SET usage_count = usage_count + 1 WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Template usage recorded'
    });
  } catch (error) {
    console.error('[Recruitment Route] Error recording template usage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record template usage',
      error: error.message
    });
  }
});

// Twilio webhook for incoming messages
// This endpoint receives incoming SMS replies from recruits
router.post('/sms/webhook/inbound', async (req, res) => {
  try {
    console.log('[Twilio Webhook] Received inbound message:', JSON.stringify(req.body, null, 2));

    const {
      id: messageId,
      sender,
      receiver,
      text,
      receivedAt,
      firstName,
      lastName
    } = req.body;

    // Validate required fields
    if (!sender || !text) {
      console.error('[Twilio Webhook] Missing required fields');
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Find the pipeline recruit by phone number
    // Try to match the sender phone with pipeline.phone
    const pipelineRows = await query(
      `SELECT id, recruit_first, recruit_last, phone 
       FROM pipeline 
       WHERE phone LIKE ? OR phone LIKE ? OR phone = ?
       ORDER BY date_last_updated DESC
       LIMIT 1`,
      [`%${sender.slice(-10)}`, `%${sender}%`, sender]
    );

    let pipelineId = null;
    if (pipelineRows && pipelineRows.length > 0) {
      pipelineId = pipelineRows[0].id;
      console.log('[Twilio Webhook] Matched to pipeline recruit:', pipelineId, pipelineRows[0].recruit_first, pipelineRows[0].recruit_last);
    } else {
      console.log('[Twilio Webhook] No pipeline recruit found for phone:', sender);
    }

    // Store the inbound message in sms_messages table
    await query(
      `INSERT INTO sms_messages 
       (user_id, pipeline_id, to_number, from_number, message, provider, provider_message_id, status, direction, cost_credits)
       VALUES (?, ?, ?, ?, ?, 'twilio', ?, 'received', 'inbound', 0)`,
      [
        null, // user_id is null for inbound messages
        pipelineId,
        receiver, // to_number is our number
        sender, // from_number is the recruit's number
        text,
        messageId
      ]
    );

    console.log('[Twilio Webhook] Inbound message stored successfully');

    // Respond to Twilio webhook
    res.json({ success: true, message: 'Inbound message received' });
  } catch (error) {
    console.error('[Twilio Webhook] Error processing inbound message:', error);
    res.status(500).json({ success: false, message: 'Failed to process inbound message' });
  }
});

// Get SMS message history for a recruit
router.get('/recruits/:id/sms-history', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Recruitment Route] Fetching SMS history for recruit/pipeline ID:', id);

    // Fetch all SMS messages for this recruit (both inbound and outbound)
    const messages = await query(
      `SELECT 
        sm.id,
        sm.to_number as to_phone,
        sm.from_number as from_phone,
        sm.message as message_body,
        sm.status,
        sm.direction,
        sm.created_at as sent_at,
        sm.user_id as sent_by_user_id,
        sm.provider,
        sm.provider_message_id,
        sm.cost_credits,
        au.lagnname as sender_name,
        au.profpic as sender_profpic
      FROM sms_messages sm
      LEFT JOIN activeusers au ON sm.user_id = au.id
      WHERE sm.pipeline_id = ?
      ORDER BY sm.created_at ASC`,
      [id]
    );

    console.log('[Recruitment Route] Found', messages?.length || 0, 'SMS messages for recruit', id);

    res.json({
      success: true,
      data: messages || []
    });
  } catch (error) {
    console.error('[Recruitment Route] Error fetching SMS history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SMS history',
      error: error.message
    });
  }
});

// Get SMS credits for the current user (for pipeline texting)
// Uses hierarchical credits: AGT uses their MGA's balance, MGA/RGA use their own
router.get('/sms/credits', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log('[Recruitment Route] /sms/credits requested by userId:', userId);

    // Get user info to determine hierarchy
    const userRows = await query(
      `SELECT id, clname, mga FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = userRows[0];
    let mgaUserId = userId; // Default to self
    let isMgaOwner = false;

    // If user is AGT, SA, or GA, find their MGA's user ID
    if (['AGT', 'SA', 'GA'].includes(user.clname) && user.mga) {
      console.log('[Recruitment Route] User is', user.clname, ', finding MGA:', user.mga);
      const mgaRows = await query(
        `SELECT id FROM activeusers WHERE lagnname = ? AND clname IN ('MGA', 'RGA') LIMIT 1`,
        [user.mga]
      );
      if (mgaRows && mgaRows.length > 0) {
        mgaUserId = mgaRows[0].id;
        console.log('[Recruitment Route] Found MGA user ID:', mgaUserId);
      }
    } else if (['MGA', 'RGA'].includes(user.clname)) {
      isMgaOwner = true;
    }

    // Get balance for the MGA (or self if MGA/RGA)
    const balanceRows = await query(
      `SELECT balance, last_updated 
       FROM sms_balances 
       WHERE user_id = ? 
       LIMIT 1`,
      [mgaUserId]
    );

    console.log('[Recruitment Route] sms_balances rows for userId', mgaUserId, ':', balanceRows);

    const balanceRow = balanceRows && balanceRows.length > 0 ? balanceRows[0] : null;

    const txRows = await query(
      `SELECT 
         SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS total_purchased,
         SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS total_debited
       FROM sms_credit_transactions
       WHERE user_id = ?`,
      [mgaUserId]
    );

    const summary = txRows && txRows.length > 0 ? txRows[0] : {};
    console.log('[Recruitment Route] sms_credit_transactions summary:', summary);

    res.json({
      success: true,
      balance: balanceRow ? (balanceRow.balance || 0) : 0,
      lastUpdated: balanceRow ? balanceRow.last_updated : null,
      mgaUserId: mgaUserId, // Return the MGA user ID for tracking
      isMgaOwner: isMgaOwner, // Whether the logged-in user owns these credits
      summary: {
        totalPurchased: summary.total_purchased || 0,
        totalDebited: summary.total_debited || 0,
      },
    });
  } catch (error) {
    console.error('[Recruitment Route] Error fetching SMS credits:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sql: error.sql,
      stack: error.stack,
    });
    res.status(500).json({ success: false, message: 'Error fetching SMS credits', error: error.message });
  }
});

// Send SMS via Twilio
router.post('/sms/send', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { toNumber, message, pipelineId, isGroupMessage } = req.body;

    console.log('[Recruitment Route] /sms/send requested by userId:', userId, { toNumber, pipelineId, isGroupMessage });

    // Validate input
    if (!toNumber || !message) {
      return res.status(400).json({ success: false, message: 'Phone number and message are required' });
    }

    // Replace variables in message if pipelineId is provided
    let processedMessage = message;
    if (pipelineId) {
      processedMessage = await replaceVariables(message, pipelineId, userId);
      console.log('[Recruitment Route] Variables replaced. Original length:', message.length, 'Processed length:', processedMessage.length);
    }

    // Split message if it's longer than 918 characters
    const messageSegments = splitMessage(processedMessage, 918, false); // Don't reserve space for indicators
    
    console.log('[Recruitment Route] Message split into', messageSegments.length, 'segment(s)');
    if (messageSegments.length > 1) {
      messageSegments.forEach((seg, idx) => {
        console.log(`[Recruitment Route] Segment ${idx + 1}:`, seg.substring(0, 100) + '...');
      });
    }

    // Parse phone numbers (semicolon-separated for group messages)
    const phoneNumbers = toNumber.split(';').map(num => num.trim()).filter(num => num);
    const recipientCount = phoneNumbers.length;
    
    // Calculate total cost: recipients × segments × cost per SMS
    const totalSegments = messageSegments.length;
    const totalCost = SMS_COST_CENTS * recipientCount * totalSegments;

    console.log('[Recruitment Route] Recipients:', recipientCount, 'Segments:', totalSegments, 'Total cost:', totalCost, 'cents');

    // Check user's balance
    const balanceRows = await query(
      'SELECT balance FROM sms_balances WHERE user_id = ? LIMIT 1',
      [userId]
    );

    const currentBalance = balanceRows && balanceRows.length > 0 ? balanceRows[0].balance : 0;
    console.log('[Recruitment Route] Current balance:', currentBalance, 'cents');

    // Check if user has enough balance for all recipients
    if (currentBalance < totalCost) {
      console.log('[Recruitment Route] Insufficient balance. Required:', totalCost, 'Available:', currentBalance);
      
      // Check if auto-reload is enabled
      const autoReloadRows = await query(
        'SELECT enabled, threshold, reload_amount FROM sms_auto_reload_settings WHERE user_id = ? LIMIT 1',
        [userId]
      );

      if (autoReloadRows && autoReloadRows.length > 0 && autoReloadRows[0].enabled) {
        const thresholdCents = autoReloadRows[0].threshold * 100;
        if (currentBalance < thresholdCents) {
          console.log('[Recruitment Route] Auto-reload triggered. Threshold:', thresholdCents, 'Balance:', currentBalance);
          // Trigger auto-reload (implement this separately if needed)
          // For now, just return insufficient balance
        }
      }

      return res.status(402).json({ 
        success: false, 
        message: `Insufficient balance. Need $${(totalCost / 100).toFixed(2)} for ${recipientCount} recipient(s).`,
        currentBalance: (currentBalance / 100).toFixed(2),
        required: (totalCost / 100).toFixed(2),
      });
    }

    // Send all message segments via Twilio
    const sentMessageIds = [];
    let allSegmentsSent = true;
    let lastError = null;

    for (let i = 0; i < messageSegments.length; i++) {
      const segment = messageSegments[i];
      
      console.log(`[Recruitment Route] Sending segment ${i + 1}/${messageSegments.length}...`);
      
      const smsResult = await twilioService.sendSMS({
        toNumber: phoneNumbers[0], // Twilio sends to one number at a time
        message: segment,
        userId,
      });

      if (!smsResult.success) {
        console.error(`[Recruitment Route] Twilio error on segment ${i + 1}:`, smsResult.error);
        allSegmentsSent = false;
        lastError = smsResult.error;
        break; // Stop sending remaining segments if one fails
      }

      sentMessageIds.push(smsResult.messageId);
      
      console.log(`[Recruitment Route] Segment ${i + 1} sent successfully. Message ID:`, smsResult.messageId);
      
      // Add a delay between segments to ensure proper ordering (if multiple segments)
      if (i < messageSegments.length - 1) {
        console.log(`[Recruitment Route] Waiting 2 seconds before sending next segment...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    if (!allSegmentsSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send SMS: ' + lastError,
        segmentsSent: sentMessageIds.length,
        totalSegments: messageSegments.length
      });
    }

    // Deduct balance (total cost for all recipients and segments)
    await query(
      `INSERT INTO sms_balances (user_id, balance, last_updated)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
         balance = balance - ?,
         last_updated = NOW()`,
      [userId, -totalCost, totalCost]
    );

    // Log transaction
    const description = recipientCount > 1 
      ? `Text sent to ${recipientCount} recipients (${totalSegments} segment${totalSegments > 1 ? 's' : ''})`
      : `Text sent to ${toNumber} (${totalSegments} segment${totalSegments > 1 ? 's' : ''})`;
    
    await query(
      `INSERT INTO sms_credit_transactions 
       (user_id, amount, transaction_type, description, stripe_payment_intent_id, related_id)
       VALUES (?, ?, 'debit', ?, NULL, ?)`,
      [userId, -totalCost, description, sentMessageIds.join(',')]
    );

    // Log each message segment in sms_messages table
    for (let i = 0; i < messageSegments.length; i++) {
      await query(
        `INSERT INTO sms_messages 
         (user_id, pipeline_id, to_number, message, provider, provider_message_id, status, cost_credits)
         VALUES (?, ?, ?, ?, 'twilio', ?, 'sent', ?)`,
        [userId, pipelineId || null, toNumber, messageSegments[i], sentMessageIds[i], SMS_COST_CENTS * recipientCount]
      );
    }

    console.log('[Recruitment Route] SMS sent successfully. Message ID:', smsResult.messageId, 'Recipients:', recipientCount);

    res.json({
      success: true,
      message: recipientCount > 1 ? 'Messages sent successfully' : 'SMS sent successfully',
      messageId: smsResult.messageId,
      recipientCount,
      cost: (totalCost / 100).toFixed(2),
      remainingBalance: ((currentBalance - totalCost) / 100).toFixed(2),
    });
  } catch (error) {
    console.error('[Recruitment Route] Error sending SMS:', error);
    res.status(500).json({ success: false, message: 'Error sending SMS', error: error.message });
  }
});

// ============================================
// GROUP MESSAGING (Twilio Conversations API)
// ============================================

/**
 * Send a group SMS/MMS message to multiple recipients
 * POST /api/recruitment/sms/group
 */
router.post('/sms/group', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { phoneNumbers, message, groupName } = req.body;

    console.log('[Recruitment Route] /sms/group requested by userId:', userId, {
      phoneCount: phoneNumbers?.length,
      groupName,
    });

    // Validate input
    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 phone numbers are required for group messaging',
      });
    }

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Check SMS balance
    const balanceRows = await query(
      'SELECT balance FROM sms_balances WHERE user_id = ?',
      [userId]
    );
    const currentBalance = balanceRows.length > 0 ? balanceRows[0].balance : 0;
    const requiredCredits = SMS_COST_CENTS * phoneNumbers.length;

    if (currentBalance < requiredCredits) {
      return res.status(400).json({
        success: false,
        message: `Insufficient SMS credits. Need ${requiredCredits} credits, have ${currentBalance}`,
      });
    }

    // Send group message via Twilio Conversations
    const result = await twilioConversations.sendGroupMessage(
      phoneNumbers,
      message,
      groupName || `Atlas Group ${new Date().toLocaleDateString()}`
    );

    if (!result.success) {
      console.error('[Recruitment Route] Group message failed:', result.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send group message',
        error: result.error,
      });
    }

    // Deduct credits
    await query(
      'UPDATE sms_balances SET balance = balance - ?, last_updated = NOW() WHERE user_id = ?',
      [requiredCredits, userId]
    );

    // Log transaction
    await query(
      `INSERT INTO sms_credit_transactions (user_id, amount, transaction_type, description)
       VALUES (?, ?, 'debit', ?)`,
      [userId, -requiredCredits, `Group message to ${phoneNumbers.length} recipients`]
    );

    // Log each message
    for (const participant of result.participants) {
      await query(
        `INSERT INTO sms_messages 
         (user_id, to_number, message, provider, provider_message_id, status, cost_credits)
         VALUES (?, ?, ?, 'twilio_conversations', ?, 'sent', ?)`,
        [userId, participant.phoneNumber, message, result.messageSid, SMS_COST_CENTS]
      );
    }

    console.log('[Recruitment Route] Group message sent successfully:', result.conversationSid);

    res.json({
      success: true,
      message: 'Group message sent successfully',
      conversationSid: result.conversationSid,
      messageSid: result.messageSid,
      recipientCount: result.participants.length,
      cost: (requiredCredits / 100).toFixed(2),
    });
  } catch (error) {
    console.error('[Recruitment Route] Error sending group message:', error);
    res.status(500).json({ success: false, message: 'Error sending group message', error: error.message });
  }
});

/**
 * List active group conversations
 * GET /api/recruitment/sms/groups
 */
router.get('/sms/groups', verifyToken, async (req, res) => {
  try {
    const result = await twilioConversations.listConversations();
    
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      conversations: result.conversations,
    });
  } catch (error) {
    console.error('[Recruitment Route] Error listing groups:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Send message to existing group conversation
 * POST /api/recruitment/sms/groups/:conversationSid/message
 */
router.post('/sms/groups/:conversationSid/message', verifyToken, async (req, res) => {
  try {
    const { conversationSid } = req.params;
    const { message } = req.body;
    const userId = req.userId;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const result = await twilioConversations.sendMessage(conversationSid, message);

    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }

    // Deduct credits (flat rate for follow-up messages)
    await query(
      'UPDATE sms_balances SET balance = balance - ?, last_updated = NOW() WHERE user_id = ?',
      [SMS_COST_CENTS, userId]
    );

    res.json({
      success: true,
      messageSid: result.messageSid,
    });
  } catch (error) {
    console.error('[Recruitment Route] Error sending to group:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Delete a group conversation
 * DELETE /api/recruitment/sms/groups/:conversationSid
 */
router.delete('/sms/groups/:conversationSid', verifyToken, async (req, res) => {
  try {
    const { conversationSid } = req.params;

    const result = await twilioConversations.deleteConversation(conversationSid);

    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }

    res.json({ success: true, message: 'Group conversation deleted' });
  } catch (error) {
    console.error('[Recruitment Route] Error deleting group:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get payment methods for the current user
router.get('/billing/payment-methods', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log('[Recruitment Route] /billing/payment-methods requested by userId:', userId);

    // Get Stripe customer ID
    const userRows = await query(
      'SELECT stripe_customer_id FROM activeusers WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!userRows || userRows.length === 0) {
      console.error('[Recruitment Route] User not found:', userId);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const stripeCustomerId = userRows[0].stripe_customer_id;
    console.log('[Recruitment Route] stripe_customer_id:', stripeCustomerId);

    if (!stripeCustomerId) {
      // No customer ID means no payment methods
      return res.json({
        success: true,
        paymentMethods: [],
        hasCard: false,
      });
    }

    // Fetch payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    console.log('[Recruitment Route] Found payment methods:', paymentMethods.data.length);

    const formattedMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    }));

    res.json({
      success: true,
      paymentMethods: formattedMethods,
      hasCard: formattedMethods.length > 0,
    });
  } catch (error) {
    console.error('[Recruitment Route] Error fetching payment methods:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ success: false, message: 'Error fetching payment methods', error: error.message });
  }
});

// Create a Stripe SetupIntent so user can add a card
router.post('/billing/create-setup-intent', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log('[Recruitment Route] /billing/create-setup-intent requested by userId:', userId);
    console.log('[Recruitment Route] Stripe env present?', {
      hasSecret: !!process.env.STRIPE_SECRET_KEY,
      hasPublishable: !!process.env.STRIPE_PUBLISHABLE_KEY,
    });

    // Get or create Stripe customer
    const userRows = await query(
      'SELECT stripe_customer_id FROM activeusers WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!userRows || userRows.length === 0) {
      console.error('[Recruitment Route] User not found:', userId);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let stripeCustomerId = userRows[0].stripe_customer_id;
    console.log('[Recruitment Route] Existing stripe_customer_id:', stripeCustomerId);

    // If no Stripe customer exists, create one
    if (!stripeCustomerId) {
      console.log('[Recruitment Route] Creating new Stripe customer for userId:', userId);
      const customer = await stripe.customers.create({
        metadata: { atlas_user_id: userId.toString() },
      });
      stripeCustomerId = customer.id;
      console.log('[Recruitment Route] Created Stripe customer:', stripeCustomerId);

      // Save the customer ID to the database
      await query(
        'UPDATE activeusers SET stripe_customer_id = ? WHERE id = ?',
        [stripeCustomerId, userId]
      );
      console.log('[Recruitment Route] Saved stripe_customer_id to database');
    }

    // Create a SetupIntent for adding a payment method
    console.log('[Recruitment Route] Creating SetupIntent for customer:', stripeCustomerId);
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
    });
    console.log('[Recruitment Route] SetupIntent created:', setupIntent.id);

    res.json({
      success: true,
      clientSecret: setupIntent.client_secret,
    });
  } catch (error) {
    console.error('[Recruitment Route] Error creating billing setup intent:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ success: false, message: 'Error creating billing setup intent', error: error.message });
  }
});

// Remove a payment method
router.delete('/billing/payment-method/:paymentMethodId', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { paymentMethodId } = req.params;
    console.log('[Recruitment Route] /billing/payment-method DELETE requested by userId:', userId, 'pmId:', paymentMethodId);

    // Verify the payment method belongs to this user's Stripe customer
    const userRows = await query(
      'SELECT stripe_customer_id FROM activeusers WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!userRows || userRows.length === 0) {
      console.error('[Recruitment Route] User not found:', userId);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const stripeCustomerId = userRows[0].stripe_customer_id;

    if (!stripeCustomerId) {
      return res.status(400).json({ success: false, message: 'No Stripe customer found' });
    }

    // Detach the payment method from the customer
    await stripe.paymentMethods.detach(paymentMethodId);
    console.log('[Recruitment Route] Payment method detached:', paymentMethodId);

    res.json({
      success: true,
      message: 'Payment method removed successfully',
    });
  } catch (error) {
    console.error('[Recruitment Route] Error removing payment method:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ success: false, message: 'Error removing payment method', error: error.message });
  }
});

// Get available SMS credit packages
router.get('/billing/sms-packages', verifyToken, async (req, res) => {
  try {
    console.log('[Recruitment Route] /billing/sms-packages requested');
    res.json({
      success: true,
      packages: SMS_PACKAGES,
    });
  } catch (error) {
    console.error('[Recruitment Route] Error fetching SMS packages:', error);
    res.status(500).json({ success: false, message: 'Error fetching SMS packages' });
  }
});

// Purchase SMS credits
router.post('/billing/purchase-credits', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { packageId, paymentMethodId } = req.body;
    console.log('[Recruitment Route] /billing/purchase-credits requested by userId:', userId, 'packageId:', packageId);

    // Find the package
    const selectedPackage = SMS_PACKAGES.find(pkg => pkg.id === packageId);
    if (!selectedPackage) {
      return res.status(400).json({ success: false, message: 'Invalid package selected' });
    }

    // Get Stripe customer ID
    const userRows = await query(
      'SELECT stripe_customer_id FROM activeusers WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const stripeCustomerId = userRows[0].stripe_customer_id;
    if (!stripeCustomerId) {
      return res.status(400).json({ success: false, message: 'No payment method on file' });
    }

    // Get payment method (use provided or fetch default)
    let pmId = paymentMethodId;
    if (!pmId) {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card',
        limit: 1,
      });
      if (paymentMethods.data.length === 0) {
        return res.status(400).json({ success: false, message: 'No payment method found' });
      }
      pmId = paymentMethods.data[0].id;
    }

    // Create payment intent - NO PRODUCTS NEEDED, just charge the flat amount
    console.log('[Recruitment Route] Creating payment intent for', selectedPackage.name, '-', selectedPackage.credits, 'credits');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(selectedPackage.price * 100), // Convert dollars to cents
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: pmId,
      confirm: true,
      off_session: true, // Allow charging without user present
      description: `SMS Credits: ${selectedPackage.name} (${selectedPackage.smsCount} texts)`,
      metadata: {
        user_id: userId.toString(),
        package_id: packageId,
        package_name: selectedPackage.name,
        credits: selectedPackage.credits.toString(),
        sms_count: (selectedPackage.smsCount || 0).toString(),
      },
    });

    console.log('[Recruitment Route] Payment intent created:', paymentIntent.id, 'status:', paymentIntent.status);

    if (paymentIntent.status === 'succeeded') {
      // Add credits to user's balance
      await query(
        `INSERT INTO sms_balances (user_id, balance, last_updated)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
           balance = balance + VALUES(balance),
           last_updated = NOW()`,
        [userId, selectedPackage.credits]
      );

      // Log the transaction
      await query(
        `INSERT INTO sms_credit_transactions (user_id, amount, transaction_type, description, stripe_payment_intent_id)
         VALUES (?, ?, 'purchase', ?, ?)`,
        [userId, selectedPackage.credits, `Purchased ${selectedPackage.name} (${selectedPackage.smsCount} texts)`, paymentIntent.id]
      );

      console.log('[Recruitment Route] Credits added successfully');

      res.json({
        success: true,
        message: `Successfully purchased ${selectedPackage.credits} credits`,
        credits: selectedPackage.credits,
        paymentIntentId: paymentIntent.id,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment failed',
        status: paymentIntent.status,
      });
    }
  } catch (error) {
    console.error('[Recruitment Route] Error purchasing credits:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ success: false, message: error.message || 'Error purchasing credits' });
  }
});

// Get auto-reload settings
router.get('/billing/auto-reload', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log('[Recruitment Route] /billing/auto-reload GET requested by userId:', userId);

    const rows = await query(
      `SELECT enabled, threshold, reload_amount, stripe_price_id
       FROM sms_auto_reload_settings
       WHERE user_id = ?
       LIMIT 1`,
      [userId]
    );

    if (rows && rows.length > 0) {
      res.json({
        success: true,
        autoReload: {
          enabled: rows[0].enabled === 1,
          threshold: rows[0].threshold,
          reloadAmount: rows[0].reload_amount,
          stripePriceId: rows[0].stripe_price_id,
        },
        thresholdOptions: AUTO_RELOAD_THRESHOLDS,
        amountOptions: AUTO_RELOAD_AMOUNTS,
      });
    } else {
      // Return defaults
      res.json({
        success: true,
        autoReload: {
          enabled: false,
          threshold: 100,
          reloadAmount: 500,
          stripePriceId: null,
        },
        thresholdOptions: AUTO_RELOAD_THRESHOLDS,
        amountOptions: AUTO_RELOAD_AMOUNTS,
      });
    }
  } catch (error) {
    console.error('[Recruitment Route] Error fetching auto-reload settings:', error);
    res.status(500).json({ success: false, message: 'Error fetching auto-reload settings' });
  }
});

// Update auto-reload settings
router.post('/billing/auto-reload', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { enabled, threshold, reloadAmount } = req.body;
    console.log('[Recruitment Route] /billing/auto-reload POST requested by userId:', userId, { enabled, threshold, reloadAmount });

    // Find the package that matches the reload amount (by actualPrice)
    const matchingPackage = SMS_PACKAGES.find(pkg => pkg.actualPrice === reloadAmount);
    const packageId = matchingPackage ? matchingPackage.id : null;

    await query(
      `INSERT INTO sms_auto_reload_settings (user_id, enabled, threshold, reload_amount, stripe_price_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         enabled = VALUES(enabled),
         threshold = VALUES(threshold),
         reload_amount = VALUES(reload_amount),
         stripe_price_id = VALUES(stripe_price_id),
         updated_at = NOW()`,
      [userId, enabled ? 1 : 0, threshold, reloadAmount, packageId]
    );

    console.log('[Recruitment Route] Auto-reload settings updated');

    res.json({
      success: true,
      message: 'Auto-reload settings updated successfully',
    });
  } catch (error) {
    console.error('[Recruitment Route] Error updating auto-reload settings:', error);
    res.status(500).json({ success: false, message: 'Error updating auto-reload settings' });
  }
});

// Trigger auto-reload (called when balance is low)
router.post('/billing/trigger-auto-reload', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log('[Recruitment Route] /billing/trigger-auto-reload requested by userId:', userId);

    // Get auto-reload settings
    const settingsRows = await query(
      `SELECT enabled, threshold, reload_amount, stripe_price_id
       FROM sms_auto_reload_settings
       WHERE user_id = ? AND enabled = 1
       LIMIT 1`,
      [userId]
    );

    if (!settingsRows || settingsRows.length === 0) {
      return res.json({ success: false, message: 'Auto-reload not enabled' });
    }

    const settings = settingsRows[0];

    // Check current balance
    const balanceRows = await query(
      'SELECT balance FROM sms_balances WHERE user_id = ? LIMIT 1',
      [userId]
    );

    const currentBalance = balanceRows && balanceRows.length > 0 ? balanceRows[0].balance : 0;

    // Only reload if below threshold
    if (currentBalance >= settings.threshold) {
      return res.json({ 
        success: false, 
        message: 'Balance above threshold',
        currentBalance,
        threshold: settings.threshold,
      });
    }

    // Find the package to reload
    const packageId = settings.stripe_price_id; // This is actually the package ID now
    const selectedPackage = SMS_PACKAGES.find(pkg => pkg.id === packageId);

    if (!selectedPackage) {
      return res.status(400).json({ success: false, message: 'Invalid reload package' });
    }

    // Get Stripe customer and payment method
    const userRows = await query(
      'SELECT stripe_customer_id FROM activeusers WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const stripeCustomerId = userRows[0].stripe_customer_id;
    if (!stripeCustomerId) {
      return res.status(400).json({ success: false, message: 'No payment method on file' });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
      limit: 1,
    });

    if (paymentMethods.data.length === 0) {
      return res.status(400).json({ success: false, message: 'No payment method found' });
    }

    const pmId = paymentMethods.data[0].id;

    // Create payment intent for auto-reload
    console.log('[Recruitment Route] Auto-reload: Creating payment intent for', selectedPackage.name);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(selectedPackage.price * 100),
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: pmId,
      confirm: true,
      off_session: true,
      description: `Auto-Reload: ${selectedPackage.name} (${selectedPackage.smsCount} texts)`,
      metadata: {
        user_id: userId.toString(),
        package_id: packageId,
        package_name: selectedPackage.name,
        credits: selectedPackage.credits.toString(),
        auto_reload: 'true',
      },
    });

    console.log('[Recruitment Route] Auto-reload payment intent:', paymentIntent.id, 'status:', paymentIntent.status);

    if (paymentIntent.status === 'succeeded') {
      // Add credits to user's balance
      await query(
        `INSERT INTO sms_balances (user_id, balance, last_updated)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
           balance = balance + VALUES(balance),
           last_updated = NOW()`,
        [userId, selectedPackage.credits]
      );

      // Log the transaction
      await query(
        `INSERT INTO sms_credit_transactions (user_id, amount, transaction_type, description, stripe_payment_intent_id)
         VALUES (?, ?, 'auto_reload', ?, ?)`,
        [userId, selectedPackage.credits, `Auto-Reload: ${selectedPackage.name} (${selectedPackage.smsCount} texts)`, paymentIntent.id]
      );

      console.log('[Recruitment Route] Auto-reload successful');

      res.json({
        success: true,
        message: `Auto-reload successful: ${selectedPackage.credits} credits added`,
        credits: selectedPackage.credits,
        newBalance: currentBalance + selectedPackage.credits,
        paymentIntentId: paymentIntent.id,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Auto-reload payment failed',
        status: paymentIntent.status,
      });
    }
  } catch (error) {
    console.error('[Recruitment Route] Error triggering auto-reload:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ success: false, message: error.message || 'Error triggering auto-reload' });
  }
});

// Get recruits by recruiting agent (includes recruiting_agent, code_to, and hierarchy)
router.get('/recruits/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    console.log('[Pipeline Filter] Fetching recruits for agentId:', agentId);
    
    // Get the user's hierarchy (downline)
    const hierarchyQuery = `
      SELECT id FROM activeusers 
      WHERE sa = ? OR ga = ? OR mga = ? OR rga = ?
    `;
    let hierarchyResult = await db.query(hierarchyQuery, [agentId, agentId, agentId, agentId]);
    
    // Get the user's lagnname to check for special case
    const userResult = await db.query(`SELECT lagnname FROM activeusers WHERE id = ?`, [agentId]);
    const userLagnname = userResult.length > 0 ? userResult[0].lagnname : null;
    
    // Special case: For MAUGHANEVANSON BRODY W, also include all LOCKER-ROTOLO users
    if (userLagnname === 'MAUGHANEVANSON BRODY W') {
        const lockerRotoloUsers = await db.query(`
            SELECT id FROM activeusers 
            WHERE rept_name = 'LOCKER-ROTOLO'
            AND Active = 'y'
        `);
        
        // Merge LOCKER-ROTOLO users with existing hierarchy, avoiding duplicates
        const existingIds = new Set(hierarchyResult.map(u => u.id));
        const newUsers = lockerRotoloUsers.filter(u => !existingIds.has(u.id));
        hierarchyResult = [...hierarchyResult, ...newUsers];
    }
    
    const hierarchyIds = hierarchyResult.map(row => row.id);
    
    console.log('[Pipeline Filter] Hierarchy IDs found:', hierarchyIds);
    
    // Include the agent themselves
    const allIds = [parseInt(agentId), ...hierarchyIds];
    console.log('[Pipeline Filter] All IDs to filter by (user + hierarchy):', allIds);
    
    const placeholders = allIds.map(() => '?').join(',');
    
    const query = `
      SELECT 
        p.*,
        p.redeemed as pipeline_redeemed,
        u.lagnname,
        coded.lagnname as coded_to_name,
        au.Active as activeuser_active,
        au.managerActive as activeuser_manager_active,
        au.redeemed as account_redeemed,
        DATE_FORMAT(ps.date_entered, '%Y-%m-%d %H:%i:%s') as current_stage_entered,
        DATE_FORMAT(p.date_added, '%Y-%m-%d %H:%i:%s') as date_added_utc,
        aob.ImportDate as aob_import_date,
        pp.date_enrolled as xcel_date_enrolled,
        pp.time_spent as xcel_time_spent,
        pp.ple_complete_pct as xcel_progress_pct,
        pp.prepared_to_pass as xcel_prepared_to_pass,
        pp.email_date as xcel_last_updated,
        pp.last_log_in as xcel_last_log_in,
        (SELECT pci.id
         FROM pipeline_checklist_items pci
         LEFT JOIN pipeline_checklist_progress pcp 
           ON pci.id = pcp.checklist_item_id AND pcp.recruit_id = p.id
         WHERE pci.stage_name = p.step 
           AND pci.active = 1
           AND (pcp.completed IS NULL OR pcp.completed = 0)
         ORDER BY pci.item_order ASC
         LIMIT 1) as current_task_id,
        (SELECT pci.item_name
         FROM pipeline_checklist_items pci
         LEFT JOIN pipeline_checklist_progress pcp 
           ON pci.id = pcp.checklist_item_id AND pcp.recruit_id = p.id
         WHERE pci.stage_name = p.step 
           AND pci.active = 1
           AND (pcp.completed IS NULL OR pcp.completed = 0)
         ORDER BY pci.item_order ASC
         LIMIT 1) as current_task_name,
        (SELECT DATE_FORMAT(pcl.checkin_date, '%Y-%m-%d %H:%i:%s')
         FROM pipeline_checkin_log pcl
         WHERE pcl.recruit_id = p.id
         ORDER BY pcl.checkin_date DESC
         LIMIT 1) as last_checkin_date,
        (SELECT pcl.checkin_type
         FROM pipeline_checkin_log pcl
         WHERE pcl.recruit_id = p.id
         ORDER BY pcl.checkin_date DESC
         LIMIT 1) as last_checkin_type,
        (SELECT u2.lagnname
         FROM pipeline_checkin_log pcl
         LEFT JOIN activeusers u2 ON pcl.checkin_by = u2.id
         WHERE pcl.recruit_id = p.id
         ORDER BY pcl.checkin_date DESC
         LIMIT 1) as last_checkin_by_name
      FROM pipeline p
      LEFT JOIN activeusers u ON p.recruiting_agent = u.id
      LEFT JOIN activeusers coded ON p.code_to = coded.id
      LEFT JOIN activeusers au ON au.pipeline_id = p.id
      LEFT JOIN pipeline_steps ps ON ps.recruit_id = p.id AND ps.date_exited IS NULL
      LEFT JOIN AOBUpdates aob ON p.aob = aob.id
      LEFT JOIN prelic_progress pp ON p.email = pp.email
      WHERE p.recruiting_agent IN (${placeholders}) OR p.code_to IN (${placeholders})
      ORDER BY p.date_added DESC
    `;
    
    const result = await db.query(query, [...allIds, ...allIds]);
    
    console.log('[Pipeline Filter] Query returned', result.length, 'recruits');
    console.log('[Pipeline Filter] Sample recruit recruiting_agent:', result[0]?.recruiting_agent);
    console.log('[Pipeline Filter] Sample recruit code_to:', result[0]?.code_to);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching recruits by agent:', error);
    res.status(500).json({ error: 'Failed to fetch recruits' });
  }
});

// Get recruits by team (multiple user IDs - includes recruiting_agent, code_to, and hierarchy)
router.post('/recruits/team', async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array is required' });
    }
    
    // Get hierarchy for all users in the team
    const allIds = new Set(userIds.map(id => parseInt(id)));
    
    for (const userId of userIds) {
      const hierarchyQuery = `
        SELECT id FROM activeusers 
        WHERE sa = ? OR ga = ? OR mga = ? OR rga = ?
      `;
      const hierarchyResult = await db.query(hierarchyQuery, [userId, userId, userId, userId]);
      hierarchyResult.forEach(row => allIds.add(row.id));
    }
    
    // Check if any user in the team is MAUGHANEVANSON BRODY W
    const teamUsersResult = await db.query(`
      SELECT lagnname FROM activeusers WHERE id IN (${userIds.map(() => '?').join(',')})
    `, userIds);
    const hasMaughanevanson = teamUsersResult.some(u => u.lagnname === 'MAUGHANEVANSON BRODY W');
    
    // Special case: If MAUGHANEVANSON BRODY W is in the team, also include all LOCKER-ROTOLO users
    if (hasMaughanevanson) {
      const lockerRotoloUsers = await db.query(`
        SELECT id FROM activeusers 
        WHERE rept_name = 'LOCKER-ROTOLO'
        AND Active = 'y'
      `);
      lockerRotoloUsers.forEach(row => allIds.add(row.id));
    }
    
    const allIdsArray = Array.from(allIds);
    const placeholders = allIdsArray.map(() => '?').join(',');
    
    const query = `
      SELECT 
        p.*,
        p.redeemed as pipeline_redeemed,
        u.lagnname,
        coded.lagnname as coded_to_name,
        au.Active as activeuser_active,
        au.managerActive as activeuser_manager_active,
        au.redeemed as account_redeemed,
        DATE_FORMAT(ps.date_entered, '%Y-%m-%d %H:%i:%s') as current_stage_entered,
        DATE_FORMAT(p.date_added, '%Y-%m-%d %H:%i:%s') as date_added_utc,
        aob.ImportDate as aob_import_date,
        pp.date_enrolled as xcel_date_enrolled,
        pp.time_spent as xcel_time_spent,
        pp.ple_complete_pct as xcel_progress_pct,
        pp.prepared_to_pass as xcel_prepared_to_pass,
        pp.email_date as xcel_last_updated,
        pp.last_log_in as xcel_last_log_in,
        (SELECT pci.id
         FROM pipeline_checklist_items pci
         LEFT JOIN pipeline_checklist_progress pcp 
           ON pci.id = pcp.checklist_item_id AND pcp.recruit_id = p.id
         WHERE pci.stage_name = p.step 
           AND pci.active = 1
           AND (pcp.completed IS NULL OR pcp.completed = 0)
         ORDER BY pci.item_order ASC
         LIMIT 1) as current_task_id,
        (SELECT pci.item_name
         FROM pipeline_checklist_items pci
         LEFT JOIN pipeline_checklist_progress pcp 
           ON pci.id = pcp.checklist_item_id AND pcp.recruit_id = p.id
         WHERE pci.stage_name = p.step 
           AND pci.active = 1
           AND (pcp.completed IS NULL OR pcp.completed = 0)
         ORDER BY pci.item_order ASC
         LIMIT 1) as current_task_name,
        (SELECT DATE_FORMAT(pcl.checkin_date, '%Y-%m-%d %H:%i:%s')
         FROM pipeline_checkin_log pcl
         WHERE pcl.recruit_id = p.id
         ORDER BY pcl.checkin_date DESC
         LIMIT 1) as last_checkin_date,
        (SELECT pcl.checkin_type
         FROM pipeline_checkin_log pcl
         WHERE pcl.recruit_id = p.id
         ORDER BY pcl.checkin_date DESC
         LIMIT 1) as last_checkin_type,
        (SELECT u2.lagnname
         FROM pipeline_checkin_log pcl
         LEFT JOIN activeusers u2 ON pcl.checkin_by = u2.id
         WHERE pcl.recruit_id = p.id
         ORDER BY pcl.checkin_date DESC
         LIMIT 1) as last_checkin_by_name
      FROM pipeline p
      LEFT JOIN activeusers u ON p.recruiting_agent = u.id
      LEFT JOIN activeusers coded ON p.code_to = coded.id
      LEFT JOIN activeusers au ON au.pipeline_id = p.id
      LEFT JOIN pipeline_steps ps ON ps.recruit_id = p.id AND ps.date_exited IS NULL
      LEFT JOIN AOBUpdates aob ON p.aob = aob.id
      LEFT JOIN prelic_progress pp ON p.email = pp.email
      WHERE p.recruiting_agent IN (${placeholders}) OR p.code_to IN (${placeholders})
      ORDER BY p.date_added DESC
    `;
    
    const result = await db.query(query, [...allIdsArray, ...allIdsArray]);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching recruits by team:', error);
    res.status(500).json({ error: 'Failed to fetch team recruits' });
  }
});

// Add new recruit
router.post('/recruits', async (req, res) => {
  try {
    const {
      recruiting_agent,
      recruit_first,
      recruit_last,
      recruit_middle,
      recruit_suffix,
      step,
      email,
      phone,
      instagram,
      birthday,
      overview_time,
      hire,
      final_time,
      callback_time,
      resident_state,
      enrolled,
      course,
      expected_complete_date,
      current_progress,
      last_log_prelic,
      prelic_passed,
      prelic_cert,
      test_date,
      test_passed,
      test_cert,
      bg_date,
      compliance1,
      compliance2,
      compliance3,
      compliance4,
      compliance5,
      aob,
      resident_license_number,
      npn,
      agentnum,
      impact_setup,
      training_start_date,
      coded,
      code_to,
      eapp_username,
      impact_username,
      referral_source,
      Aspects,
      Concern,
      Spouse,
      CareerGoals,
      Compensation,
      WhyChoose,
      MGA,
      redeemed,
      password
    } = req.body;

    const query = `
      INSERT INTO pipeline (
        recruiting_agent, recruit_first, recruit_middle, recruit_last, recruit_suffix,
        step, email, phone, instagram, birthday, overview_time, hire, final_time, callback_time,
        resident_state, enrolled, course, expected_complete_date, current_progress,
        last_log_prelic, prelic_passed, prelic_cert, test_date, test_passed, test_cert,
        bg_date, compliance1, compliance2, compliance3, compliance4, compliance5, aob,
        resident_license_number, npn, agentnum, impact_setup, training_start_date,
        coded, code_to, eapp_username, impact_username, referral_source,
        Aspects, Concern, Spouse, CareerGoals, Compensation, WhyChoose, MGA,
        redeemed, password,
        date_added, date_last_updated
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
    `;

    const values = [
      recruiting_agent, recruit_first, recruit_middle, recruit_last, recruit_suffix,
      step || 'Careers Form', email, phone, instagram || null, birthday || null, overview_time, hire, final_time, callback_time,
      resident_state, enrolled, course, expected_complete_date, current_progress,
      last_log_prelic, prelic_passed, prelic_cert, test_date, test_passed, test_cert,
      bg_date, compliance1, compliance2, compliance3, compliance4, compliance5, aob,
      resident_license_number, npn, agentnum, impact_setup, training_start_date,
      coded, code_to, eapp_username, impact_username, referral_source,
      Aspects, Concern, Spouse, CareerGoals, Compensation, WhyChoose, MGA,
      redeemed || 0, password || null
    ];

    const result = await db.query(query, values);
    
    // Get the inserted record
    const insertId = result.insertId;
    const selectQuery = `
      SELECT p.*, u.lagnname as recruiting_agent_name 
      FROM pipeline p 
      LEFT JOIN activeusers u ON p.recruiting_agent = u.id 
      WHERE p.id = ?
    `;
    const selectResult = await db.query(selectQuery, [insertId]);
    const insertedPipeline = selectResult[0];
    
    // Auto-complete prior stage items if recruit is added to a later stage
    const recruitStep = step || 'Careers Form';
    await autoCompletePriorStageItems(insertId, recruitStep, resident_state);

    // If the new recruit has NOT redeemed onboarding yet, send welcome/login email
    try {
      if (insertedPipeline && !insertedPipeline.redeemed && email) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://agents.ariaslife.com';
        const baseUrl = frontendUrl.replace(/\/$/, '');

        // Build onboarding login URL (mirror Pipeline onboarding link logic)
        let onboardingUrl = `${baseUrl}/onboarding/login`;
        if (insertedPipeline.recruiting_agent && String(insertedPipeline.recruiting_agent) !== '26911') {
          onboardingUrl += `?hm=${insertedPipeline.recruiting_agent}`;
        }

        const subject = 'Arias Onboarding – Welcome & Login Instructions';
        const displayName = [recruit_first, recruit_middle, recruit_last, recruit_suffix]
          .filter(Boolean)
          .join(' ')
          .trim() || 'there';

        const onboardingHtml = `
          <div style="background:#f6f9fc;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
            <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#0f172a,#0b5a8f);padding:24px 20px;">
                <h2 style="margin:0;font-size:22px;color:#f9fafb;">Welcome to Onboarding</h2>
                <p style="margin:8px 0 0 0;font-size:13px;color:#e5e7eb;">
                  We’ve created your onboarding checklist so you can get licensed, trained, and ready to go.
                </p>
              </div>
              <div style="display:flex;flex-wrap:wrap;">
                <!-- Left side: summary -->
                <div style="flex:1 1 220px;padding:18px 20px 12px 20px;border-right:1px solid #e5e7eb;min-width:220px;">
                  <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">Hi ${displayName},</p>
                  <p style="margin:0 0 14px 0;font-size:13px;color:#334155;line-height:1.5;">
                    Your onboarding portal is ready. Inside you’ll find a step‑by‑step checklist with clear instructions,
                    links, and progress tracking for every part of the process.
                  </p>
                  <ul style="margin:0 0 14px 18px;padding:0;font-size:13px;color:#334155;line-height:1.5;">
                    <li>View each onboarding step in order</li>
                    <li>Check off items as you complete them</li>
                    <li>See detailed instructions for every step</li>
                  </ul>
                </div>
                <!-- Right side: login panel -->
                <div style="flex:1 1 220px;padding:18px 20px 20px 20px;min-width:220px;background:#f9fafb;">
                  <h3 style="margin:0 0 8px 0;font-size:16px;color:#0f172a;">Your Login</h3>
                  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;background:#ffffff;margin-bottom:14px;">
                    <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:13px;">
                      <span style="font-weight:600;color:#0f172a;">Portal</span>
                      <span style="color:#0b5a8f;">Onboarding Checklist</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:13px;">
                      <span style="font-weight:600;color:#0f172a;">Email</span>
                      <span style="color:#0f172a;">${email}</span>
                    </div>
                    <div style="font-size:12px;color:#64748b;margin-top:4px;line-height:1.5;">
                      You’ll create your password the first time you log in (or reset it if you’ve logged in before).
                    </div>
                  </div>
                  <div style="text-align:center;margin-bottom:10px;">
                    <a href="${onboardingUrl}"
                      style="display:inline-block;background:#0b5a8f;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600;font-size:14px;">
                      Open Onboarding Portal
                    </a>
                  </div>
                  <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
                    On the portal, enter your email, then follow the prompts to set your password and begin your checklist.
                  </p>
                </div>
              </div>
              <div style="padding:10px 20px 16px 20px;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;">
                  This message was sent automatically by the Arias Atlas onboarding system. If you did not expect this,
                  you can ignore this email.
                </p>
              </div>
            </div>
          </div>
        `;

        await emailService.sendEmail(
          email,
          subject,
          onboardingHtml
        );
        console.log(`📧 Sent onboarding welcome email to ${email} for pipeline ${insertId}`);
      }
    } catch (emailError) {
      console.error('Error sending onboarding welcome email:', emailError);
      // Do not block main flow on email failure
    }
    
    res.status(201).json(insertedPipeline);
  } catch (error) {
    console.error('Error adding recruit:', error);
    res.status(500).json({ error: 'Failed to add recruit' });
  }
});

// Send onboarding welcome/login email for an existing recruit (when redeemed = 0)
router.post('/recruits/:id/send-onboarding-email', async (req, res) => {
  try {
    const { id } = req.params;
    const { email: overrideEmail } = req.body || {};

    // Load pipeline row
    const rows = await db.query(
      `SELECT p.*, u.lagnname as recruiting_agent_name 
       FROM pipeline p 
       LEFT JOIN activeusers u ON p.recruiting_agent = u.id 
       WHERE p.id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recruit not found' });
    }

    const pipelineRow = rows[0];

    // Only send onboarding email when redeemed is 0 / false
    if (pipelineRow.redeemed) {
      return res.status(400).json({
        success: false,
        message: 'Onboarding email is only sent for recruits who have not redeemed their onboarding yet.'
      });
    }

    // Determine email to use (override takes priority)
    let emailToUse = (overrideEmail || pipelineRow.email || '').trim();
    if (!emailToUse) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required to send onboarding setup.'
      });
    }

    // If override email is provided and different, update pipeline.email
    if (overrideEmail && overrideEmail.trim() && overrideEmail.trim() !== pipelineRow.email) {
      await db.query(
        'UPDATE pipeline SET email = ?, date_last_updated = NOW() WHERE id = ?',
        [overrideEmail.trim(), id]
      );
      pipelineRow.email = overrideEmail.trim();
      emailToUse = overrideEmail.trim();
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://agents.ariaslife.com';
    const baseUrl = frontendUrl.replace(/\/$/, '');

    // Build onboarding login URL (same logic as pipeline link)
    let onboardingUrl = `${baseUrl}/onboarding/login`;
    if (pipelineRow.recruiting_agent && String(pipelineRow.recruiting_agent) !== '26911') {
      onboardingUrl += `?hm=${pipelineRow.recruiting_agent}`;
    }

    const subject = 'Arias Onboarding – Welcome & Login Instructions';
    const displayName = [
      pipelineRow.recruit_first,
      pipelineRow.recruit_middle,
      pipelineRow.recruit_last,
      pipelineRow.recruit_suffix
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || 'there';

    const onboardingHtml = `
      <div style="background:#f6f9fc;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#0f172a,#0b5a8f);padding:24px 20px;">
            <h2 style="margin:0;font-size:22px;color:#f9fafb;">Welcome to Onboarding</h2>
            <p style="margin:8px 0 0 0;font-size:13px;color:#e5e7eb;">
              We’ve created your onboarding checklist so you can get licensed, trained, and ready to go.
            </p>
          </div>
          <div style="display:flex;flex-wrap:wrap;">
            <!-- Left side: summary -->
            <div style="flex:1 1 220px;padding:18px 20px 12px 20px;border-right:1px solid #e5e7eb;min-width:220px;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">Hi ${displayName},</p>
              <p style="margin:0 0 14px 0;font-size:13px;color:#334155;line-height:1.5;">
                Your onboarding portal is ready. Inside you’ll find a step‑by‑step checklist with clear instructions,
                links, and progress tracking for every part of the process.
              </p>
              <ul style="margin:0 0 14px 18px;padding:0;font-size:13px;color:#334155;line-height:1.5;">
                <li>View each onboarding step in order</li>
                <li>Check off items as you complete them</li>
                <li>See detailed instructions for every step</li>
              </ul>
            </div>
            <!-- Right side: login panel -->
            <div style="flex:1 1 220px;padding:18px 20px 20px 20px;min-width:220px;background:#f9fafb;">
              <h3 style="margin:0 0 8px 0;font-size:16px;color:#0f172a;">Your Login</h3>
              <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;background:#ffffff;margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:13px;">
                  <span style="font-weight:600;color:#0f172a;">Portal</span>
                  <span style="color:#0b5a8f;">Onboarding Checklist</span>
                </div>
                <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:13px;">
                  <span style="font-weight:600;color:#0f172a;">Email</span>
                  <span style="color:#0f172a;">${emailToUse}</span>
                </div>
                <div style="font-size:12px;color:#64748b;margin-top:4px;line-height:1.5;">
                  You’ll create your password the first time you log in (or reset it if you’ve logged in before).
                </div>
              </div>
              <div style="text-align:center;margin-bottom:10px;">
                <a href="${onboardingUrl}"
                  style="display:inline-block;background:#0b5a8f;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600;font-size:14px;">
                  Open Onboarding Portal
                </a>
              </div>
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
                On the portal, enter your email, then follow the prompts to set your password and begin your checklist.
              </p>
            </div>
          </div>
          <div style="padding:10px 20px 16px 20px;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;">
              This message was sent automatically by the Arias Atlas onboarding system. If you did not expect this,
              you can ignore this email.
            </p>
          </div>
        </div>
      </div>
    `;

    await emailService.sendEmail(emailToUse, subject, onboardingHtml);
    console.log(`📧 Sent onboarding welcome email to ${emailToUse} for pipeline ${id}`);

    return res.json({ success: true, message: 'Onboarding setup email sent successfully.' });
  } catch (error) {
    console.error('Error sending onboarding setup email:', error);
    return res.status(500).json({ success: false, message: 'Failed to send onboarding setup email.' });
  }
});

// Send onboarding setup via text
router.post('/recruits/:id/send-onboarding-text', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { phone: overridePhone, message: customMessage } = req.body || {};
    const userId = req.userId;

    // Load pipeline row
    const rows = await db.query(
      `SELECT p.*, u.lagnname as recruiting_agent_name 
       FROM pipeline p 
       LEFT JOIN activeusers u ON p.recruiting_agent = u.id 
       WHERE p.id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recruit not found' });
    }

    const pipelineRow = rows[0];

    // Determine phone to use
    let phoneToUse = (overridePhone || pipelineRow.phone || '').trim();
    if (!phoneToUse) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required to send text.'
      });
    }

    // If override phone is provided and different, update pipeline.phone
    if (overridePhone && overridePhone.trim() && overridePhone.trim() !== pipelineRow.phone) {
      await db.query(
        'UPDATE pipeline SET phone = ?, date_last_updated = NOW() WHERE id = ?',
        [overridePhone.trim(), id]
      );
      pipelineRow.phone = overridePhone.trim();
      phoneToUse = overridePhone.trim();
    }

    // Determine message to send
    let message;
    
    if (customMessage && customMessage.trim()) {
      // Use custom message from request body and replace variables
      try {
        message = await replaceVariables(customMessage.trim(), id, userId);
        console.log('[Recruitment Route] Using custom message for text with variables replaced');
        console.log('[Recruitment Route] Original message length:', customMessage.trim().length, 'Processed:', message.length);
      } catch (varError) {
        console.error('[Recruitment Route] Error replacing variables:', varError);
        // Fall back to original message if variable replacement fails
        message = customMessage.trim();
      }
    } else {
      // Use default onboarding template
      const frontendUrl = process.env.FRONTEND_URL || 'https://agents.ariaslife.com';
      const baseUrl = frontendUrl.replace(/\/$/, '');

      // Build onboarding login URL
      let onboardingUrl = `${baseUrl}/onboarding/login`;
      if (pipelineRow.recruiting_agent && String(pipelineRow.recruiting_agent) !== '26911') {
        onboardingUrl += `?hm=${pipelineRow.recruiting_agent}`;
      }

      const displayName = [
        pipelineRow.recruit_first,
        pipelineRow.recruit_middle,
        pipelineRow.recruit_last,
        pipelineRow.recruit_suffix
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || 'there';

      message = `Hi ${displayName}, welcome to Arias! Your onboarding portal is ready. Login here: ${onboardingUrl}`;
      console.log('[Recruitment Route] Using default onboarding template');
    }

    // Determine MGA user ID for billing (hierarchical credits)
    const userRows = await query(
      `SELECT id, clname, mga FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );
    const user = userRows && userRows.length > 0 ? userRows[0] : null;
    let mgaUserId = userId; // Default to self

    // If user is AGT, SA, or GA, find their MGA's user ID
    if (user && ['AGT', 'SA', 'GA'].includes(user.clname) && user.mga) {
      const mgaRows = await query(
        `SELECT id FROM activeusers WHERE lagnname = ? AND clname IN ('MGA', 'RGA') LIMIT 1`,
        [user.mga]
      );
      if (mgaRows && mgaRows.length > 0) {
        mgaUserId = mgaRows[0].id;
        console.log('[Recruitment Route]', user.clname, 'using MGA credits. MGA user ID:', mgaUserId);
      }
    }

    // Split message if it's longer than 918 characters
    const messageSegments = splitMessage(message, 918, false); // Don't reserve space for indicators
    
    console.log('[Recruitment Route] Onboarding text split into', messageSegments.length, 'segment(s)');
    
    // Send all message segments via Twilio
    const sentMessageIds = [];
    let allSegmentsSent = true;
    let lastError = null;

    for (let i = 0; i < messageSegments.length; i++) {
      const segment = messageSegments[i];
      
      console.log(`[Recruitment Route] Sending onboarding segment ${i + 1}/${messageSegments.length}:`, {
        toNumber: phoneToUse,
        messageLength: segment.length,
        messagePreview: segment.substring(0, 100) + (segment.length > 100 ? '...' : ''),
        userId: mgaUserId
      });
      
      const smsResult = await twilioService.sendSMS({
        toNumber: phoneToUse,
        message: segment,
        userId: mgaUserId, // Use MGA's user ID for billing
      });

      if (!smsResult.success) {
        console.error(`[Recruitment Route] Twilio error on onboarding segment ${i + 1}:`, smsResult.error);
        console.error('[Recruitment Route] Failed message:', segment);
        allSegmentsSent = false;
        lastError = smsResult.error;
        break;
      }

      sentMessageIds.push(smsResult.messageId);
      
      console.log(`[Recruitment Route] Onboarding segment ${i + 1} sent successfully. Message ID:`, smsResult.messageId);
      
      // Add a delay between segments to ensure proper ordering
      if (i < messageSegments.length - 1) {
        console.log(`[Recruitment Route] Waiting 2 seconds before sending next onboarding segment...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    if (!allSegmentsSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send onboarding text: ' + lastError,
        segmentsSent: sentMessageIds.length,
        totalSegments: messageSegments.length
      });
    }

    // Calculate total cost for all segments
    const totalCost = SMS_COST_CENTS * messageSegments.length;

    // Deduct balance from MGA
    await query(
      `INSERT INTO sms_balances (user_id, balance, last_updated)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
         balance = balance - ?,
         last_updated = NOW()`,
      [mgaUserId, -totalCost, totalCost]
    );

    // Log transaction for MGA (whose balance was charged)
    const description = messageSegments.length > 1 
      ? `Onboarding text sent to ${phoneToUse} by user ${userId} (${messageSegments.length} segments)`
      : `Onboarding text sent to ${phoneToUse} by user ${userId}`;
    
    await query(
      `INSERT INTO sms_credit_transactions 
       (user_id, amount, transaction_type, description, stripe_payment_intent_id, related_id)
       VALUES (?, ?, 'debit', ?, NULL, ?)`,
      [mgaUserId, -totalCost, description, sentMessageIds.join(',')]
    );

    // Log each message segment in sms_messages table (track actual sender)
    for (let i = 0; i < messageSegments.length; i++) {
      await query(
        `INSERT INTO sms_messages 
         (user_id, pipeline_id, to_number, message, provider, provider_message_id, status, cost_credits)
         VALUES (?, ?, ?, ?, 'twilio', ?, 'sent', ?)`,
        [userId, id, phoneToUse, messageSegments[i], sentMessageIds[i], SMS_COST_CENTS]
      );
    }

    console.log(`📱 Sent text to ${phoneToUse} for pipeline ${id}`);

    return res.json({ success: true, message: 'Text message sent successfully.' });
  } catch (error) {
    console.error('Error sending onboarding setup text:', error);
    return res.status(500).json({ success: false, message: 'Failed to send onboarding setup text.' });
  }
});

// Send onboarding setup via both email and text
router.post('/recruits/:id/send-onboarding-both', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email: overrideEmail, phone: overridePhone } = req.body || {};
    const userId = req.userId;

    // Load pipeline row
    const rows = await db.query(
      `SELECT p.*, u.lagnname as recruiting_agent_name 
       FROM pipeline p 
       LEFT JOIN activeusers u ON p.recruiting_agent = u.id 
       WHERE p.id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recruit not found' });
    }

    const pipelineRow = rows[0];

    // Only send when redeemed is 0
    if (pipelineRow.redeemed) {
      return res.status(400).json({
        success: false,
        message: 'Onboarding is only sent for recruits who have not redeemed their onboarding yet.'
      });
    }

    // Determine email and phone to use
    let emailToUse = (overrideEmail || pipelineRow.email || '').trim();
    let phoneToUse = (overridePhone || pipelineRow.phone || '').trim();

    if (!emailToUse) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.'
      });
    }

    if (!phoneToUse) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required.'
      });
    }

    // Update pipeline if overrides provided
    const updates = [];
    const params = [];
    
    if (overrideEmail && overrideEmail.trim() && overrideEmail.trim() !== pipelineRow.email) {
      updates.push('email = ?');
      params.push(overrideEmail.trim());
      emailToUse = overrideEmail.trim();
    }
    
    if (overridePhone && overridePhone.trim() && overridePhone.trim() !== pipelineRow.phone) {
      updates.push('phone = ?');
      params.push(overridePhone.trim());
      phoneToUse = overridePhone.trim();
    }

    if (updates.length > 0) {
      updates.push('date_last_updated = NOW()');
      params.push(id);
      await db.query(
        `UPDATE pipeline SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://agents.ariaslife.com';
    const baseUrl = frontendUrl.replace(/\/$/, '');

    // Build onboarding login URL
    let onboardingUrl = `${baseUrl}/onboarding/login`;
    if (pipelineRow.recruiting_agent && String(pipelineRow.recruiting_agent) !== '26911') {
      onboardingUrl += `?hm=${pipelineRow.recruiting_agent}`;
    }

    const displayName = [
      pipelineRow.recruit_first,
      pipelineRow.recruit_middle,
      pipelineRow.recruit_last,
      pipelineRow.recruit_suffix
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || 'there';

    // Send email (same as send-onboarding-email)
    const subject = 'Arias Onboarding – Welcome & Login Instructions';
    const onboardingHtml = `
      <div style="background:#f6f9fc;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#0f172a,#0b5a8f);padding:24px 20px;">
            <h2 style="margin:0;font-size:22px;color:#f9fafb;">Welcome to Onboarding</h2>
            <p style="margin:8px 0 0 0;font-size:13px;color:#e5e7eb;">
              We've created your onboarding checklist so you can get licensed, trained, and ready to go.
            </p>
          </div>
          <div style="padding:20px;">
            <p style="margin:0 0 12px 0;font-size:14px;color:#334155;">Hi ${displayName},</p>
            <p style="margin:0 0 16px 0;font-size:14px;color:#334155;line-height:1.6;">
              Your onboarding portal is ready. Login here: <a href="${onboardingUrl}" style="color:#0b5a8f;">${onboardingUrl}</a>
            </p>
          </div>
        </div>
      </div>
    `;

    await emailService.sendEmail(emailToUse, subject, onboardingHtml);
    console.log(`📧 Sent onboarding email to ${emailToUse} for pipeline ${id}`);

    // Send text
    const message = `Hi ${displayName}, welcome to Arias! Your onboarding portal is ready. Login here: ${onboardingUrl}`;

    // Determine MGA user ID for billing (hierarchical credits)
    const userRows = await query(
      `SELECT id, clname, mga FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );
    const user = userRows && userRows.length > 0 ? userRows[0] : null;
    let mgaUserId = userId; // Default to self

    // If user is AGT, SA, or GA, find their MGA's user ID
    if (user && ['AGT', 'SA', 'GA'].includes(user.clname) && user.mga) {
      const mgaRows = await query(
        `SELECT id FROM activeusers WHERE lagnname = ? AND clname IN ('MGA', 'RGA') LIMIT 1`,
        [user.mga]
      );
      if (mgaRows && mgaRows.length > 0) {
        mgaUserId = mgaRows[0].id;
        console.log('[Recruitment Route]', user.clname, 'using MGA credits. MGA user ID:', mgaUserId);
      }
    }

    const smsResult = await twilioService.sendSMS({
      toNumber: phoneToUse,
      message,
      userId: mgaUserId, // Use MGA's user ID for billing
    });

    if (!smsResult.success) {
      console.error('[Recruitment Route] Twilio error:', smsResult.error);
      return res.status(500).json({
        success: false,
        message: 'Email sent, but failed to send text: ' + smsResult.error,
      });
    }

    // Deduct balance from MGA
    await query(
      `INSERT INTO sms_balances (user_id, balance, last_updated)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
         balance = balance - ?,
         last_updated = NOW()`,
      [mgaUserId, -SMS_COST_CENTS, SMS_COST_CENTS]
    );

    // Log transaction for MGA (whose balance was charged)
    await query(
      `INSERT INTO sms_credit_transactions 
       (user_id, amount, transaction_type, description, stripe_payment_intent_id, related_id)
       VALUES (?, ?, 'debit', ?, NULL, ?)`,
      [mgaUserId, -SMS_COST_CENTS, `Onboarding text sent to ${phoneToUse} by user ${userId}`, smsResult.messageId]
    );

    // Log message in sms_messages table (track actual sender)
    await query(
      `INSERT INTO sms_messages 
       (user_id, pipeline_id, to_number, message, provider, provider_message_id, status, cost_credits)
       VALUES (?, ?, ?, ?, 'twilio', ?, 'sent', ?)`,
      [userId, id, phoneToUse, message, smsResult.messageId, SMS_COST_CENTS]
    );

    console.log(`📱 Sent onboarding text to ${phoneToUse} for pipeline ${id}`);

    return res.json({ success: true, message: 'Onboarding setup sent via email and text successfully.' });
  } catch (error) {
    console.error('Error sending onboarding setup:', error);
    return res.status(500).json({ success: false, message: 'Failed to send onboarding setup.' });
  }
});

// Update recruit step
router.put('/recruits/:id/step', async (req, res) => {
  try {
    const { id } = req.params;
    const { step } = req.body;

    // First, get the current step and resident_state to record the exit time
    const getCurrentStepQuery = `SELECT step, resident_state FROM pipeline WHERE id = ?`;
    const currentStepResult = await db.query(getCurrentStepQuery, [id]);
    
    if (currentStepResult.length === 0) {
      return res.status(404).json({ error: 'Recruit not found' });
    }
    
    const currentStep = currentStepResult[0].step;
    const residentState = currentStepResult[0].resident_state;
    
    // Update the exit time for the current step
    if (currentStep) {
      const updateExitQuery = `
        UPDATE pipeline_steps 
        SET date_exited = NOW() 
        WHERE recruit_id = ? AND step = ? AND date_exited IS NULL
      `;
      await db.query(updateExitQuery, [id, currentStep]);
    }
    
    // Update the recruit's current step
    const updateQuery = `
      UPDATE pipeline 
      SET step = ?, date_last_updated = NOW() 
      WHERE id = ?
    `;
    await db.query(updateQuery, [step, id]);
    
    // Add new step entry - format current time as EST string
    const now = new Date();
    const estFormatted = now.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)/, '$3-$1-$2 $4:$5:$6');
    console.log('🕐 [Inserting EST time]:', estFormatted);
    
    const insertStepQuery = `
      INSERT INTO pipeline_steps (recruit_id, step, date_entered) 
      VALUES (?, ?, ?)
    `;
    await db.query(insertStepQuery, [id, step, estFormatted]);
    
    // Auto-complete items from the stage being left AND all prior stages
    await autoCompletePriorStageItems(id, step, residentState);
    
    // Also complete all items from the OLD stage (the one they just left)
    if (currentStep) {
      await completeStageItems(id, currentStep, residentState);
    }
    
    // Get the updated record
    const selectQuery = `SELECT p.*, u.lagnname FROM pipeline p LEFT JOIN activeusers u ON p.recruiting_agent = u.id WHERE p.id = ?`;
    const selectResult = await db.query(selectQuery, [id]);
    
    res.json(selectResult[0]);
  } catch (error) {
    console.error('Error updating recruit step:', error);
    res.status(500).json({ error: 'Failed to update recruit step' });
  }
});

// Update final time
router.put('/recruits/:id/final-time', async (req, res) => {
  try {
    const { id } = req.params;
    const { final_time } = req.body;

    const query = `
      UPDATE pipeline 
      SET final_time = ?, date_last_updated = NOW() 
      WHERE id = ?
    `;
    
    const result = await db.query(query, [final_time, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Recruit not found' });
    }
    
    // Get the updated record
    const selectQuery = `SELECT p.*, u.lagnname FROM pipeline p LEFT JOIN activeusers u ON p.recruiting_agent = u.id WHERE p.id = ?`;
    const selectResult = await db.query(selectQuery, [id]);
    
    res.json(selectResult[0]);
  } catch (error) {
    console.error('Error updating final time:', error);
    res.status(500).json({ error: 'Failed to update final time' });
  }
});

// Update callback time
router.put('/recruits/:id/callback-time', async (req, res) => {
  try {
    const { id } = req.params;
    const { callback_time } = req.body;

    const query = `
      UPDATE pipeline 
      SET callback_time = ?, date_last_updated = NOW() 
      WHERE id = ?
    `;
    
    const result = await db.query(query, [callback_time, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Recruit not found' });
    }
    
    // Get the updated record
    const selectQuery = `SELECT p.*, u.lagnname FROM pipeline p LEFT JOIN activeusers u ON p.recruiting_agent = u.id WHERE p.id = ?`;
    const selectResult = await db.query(selectQuery, [id]);
    
    res.json(selectResult[0]);
  } catch (error) {
    console.error('Error updating callback time:', error);
    res.status(500).json({ error: 'Failed to update callback time' });
  }
});

// Update pre-licensing information
router.put('/recruits/:id/pre-lic', async (req, res) => {
  try {
    const { id } = req.params;
    const { resident_state, enrolled, course, expected_complete_date } = req.body;

    // Get current pipeline data
    const currentData = await db.query('SELECT step, resident_state FROM pipeline WHERE id = ?', [id]);
    if (currentData.length === 0) {
      return res.status(404).json({ error: 'Recruit not found' });
    }
    
    const currentStep = currentData[0].step;
    const targetStep = 'Licensing';

    const query = `
      UPDATE pipeline 
      SET resident_state = ?, enrolled = ?, course = ?, expected_complete_date = ?, 
          step = ?, date_last_updated = NOW() 
      WHERE id = ?
    `;
    
    const result = await db.query(query, [
      resident_state, 
      enrolled, 
      course, 
      expected_complete_date, 
      targetStep, 
      id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Recruit not found' });
    }
    
    console.log(`✅ Updated recruit ${id} from "${currentStep}" to "${targetStep}"`);
    
    // Close previous step in pipeline_steps (if different from target)
    if (currentStep !== targetStep) {
      await db.query(`
        UPDATE pipeline_steps
        SET date_exited = NOW()
        WHERE recruit_id = ? AND step = ? AND date_exited IS NULL
      `, [id, currentStep]);
      
      // Record new Licensing stage entry - format current time as EST string
      const now2 = new Date();
      const estFormatted2 = now2.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)/, '$3-$1-$2 $4:$5:$6');
      
      await db.query(`
        INSERT INTO pipeline_steps (recruit_id, step, date_entered)
        VALUES (?, ?, ?)
      `, [id, targetStep, estFormatted2]);
      
      console.log(`✅ Recorded pipeline step transition: ${currentStep} → ${targetStep}`);
    }
    
    // Auto-complete all checklist items from prior stages (Overview, Final Decision)
    // but NOT the Licensing stage items - those should be completed as the agent works through them
    await autoCompletePriorStageItems(id, targetStep, resident_state);
    console.log(`✅ Completed all prior stage checklist items before "${targetStep}" for recruit ${id}`);
    
    // Get the updated record
    const selectQuery = `SELECT p.*, u.lagnname FROM pipeline p LEFT JOIN activeusers u ON p.recruiting_agent = u.id WHERE p.id = ?`;
    const selectResult = await db.query(selectQuery, [id]);
    
    res.json(selectResult[0]);
  } catch (error) {
    console.error('Error updating pre-lic info:', error);
    res.status(500).json({ error: 'Failed to update pre-lic information' });
  }
});

// Get pipeline steps history for a recruit
router.get('/recruits/:id/steps', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT * FROM pipeline_steps 
      WHERE recruit_id = ? 
      ORDER BY date_entered DESC
    `;
    
    const result = await db.query(query, [id]);
    res.json(result);
  } catch (error) {
    console.error('Error fetching pipeline steps:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline steps' });
  }
});

// Update recruit general data
router.put('/recruits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remove fields that shouldn't be updated directly
    const { __isApplicantDetails, fullName, formattedDateAdded, leadId, lagnname, ...fieldsToUpdate } = updateData;
    
    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    // Build dynamic update query
    const updateFields = Object.keys(fieldsToUpdate).map(field => `${field} = ?`).join(', ');
    const updateValues = Object.values(fieldsToUpdate);
    
    const updateQuery = `
      UPDATE pipeline 
      SET ${updateFields}, date_last_updated = NOW() 
      WHERE id = ?
    `;
    
    await db.query(updateQuery, [...updateValues, id]);
    
    // Get the updated record
    const selectQuery = `SELECT p.*, u.lagnname FROM pipeline p LEFT JOIN activeusers u ON p.recruiting_agent = u.id WHERE p.id = ?`;
    const selectResult = await db.query(selectQuery, [id]);
    
    if (selectResult.length === 0) {
      return res.status(404).json({ error: 'Recruit not found' });
    }
    
    res.json(selectResult[0]);
  } catch (error) {
    console.error('Error updating recruit:', error);
    res.status(500).json({ error: 'Failed to update recruit' });
  }
});

// Delete recruit
router.delete('/recruits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete related checklist progress first (to avoid orphaned records)
    await db.query('DELETE FROM pipeline_checklist_progress WHERE recruit_id = ?', [id]);
    
    // Delete pipeline_steps next (foreign key constraint)
    await db.query('DELETE FROM pipeline_steps WHERE recruit_id = ?', [id]);
    
    // Then delete the main record
    const query = 'DELETE FROM pipeline WHERE id = ?';
    const result = await db.query(query, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Recruit not found' });
    }
    
    res.json({ message: 'Recruit deleted successfully' });
  } catch (error) {
    console.error('Error deleting recruit:', error);
    res.status(500).json({ error: 'Failed to delete recruit' });
  }
});

// ============================================================
// PIPELINE STAGE DEFINITIONS
// ============================================================

// Get all stage definitions (default + team custom)
router.get('/stages', async (req, res) => {
  try {
    const { teamId } = req.query;
    
    let query = `
      SELECT 
        psd.*,
        u.lagnname as created_by_name
      FROM pipeline_stage_definitions psd
      LEFT JOIN activeusers u ON psd.created_by = u.id
      WHERE psd.active = 1
      AND (psd.team_id IS NULL ${teamId ? 'OR psd.team_id = ?' : ''})
      ORDER BY psd.id ASC
    `;
    
    const params = teamId ? [teamId] : [];
    const result = await db.query(query, params);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching pipeline stages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pipeline stages' });
  }
});

// Get specific stage definition
router.get('/stages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        psd.*,
        u.lagnname as created_by_name
      FROM pipeline_stage_definitions psd
      LEFT JOIN activeusers u ON psd.created_by = u.id
      WHERE psd.id = ?
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Stage not found' });
    }
    
    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error fetching stage:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stage' });
  }
});

// Create custom stage (Admin/Manager only)
router.post('/stages', async (req, res) => {
  try {
    const {
      stage_name,
      stage_color,
      stage_description,
      position_after,
      position_before,
      is_terminal,
      team_id,
      created_by
    } = req.body;
    
    if (!stage_name) {
      return res.status(400).json({ success: false, error: 'stage_name is required' });
    }
    
    const query = `
      INSERT INTO pipeline_stage_definitions (
        stage_name, stage_color, stage_description,
        position_after, position_before,
        is_default, is_terminal, team_id, created_by
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `;
    
    const result = await db.query(query, [
      stage_name,
      stage_color || '#3498db',
      stage_description,
      position_after || null,
      position_before || null,
      is_terminal || 0,
      team_id || null,
      created_by || null
    ]);
    
    // Get the created stage
    const selectQuery = `
      SELECT psd.*, u.lagnname as created_by_name
      FROM pipeline_stage_definitions psd
      LEFT JOIN activeusers u ON psd.created_by = u.id
      WHERE psd.id = ?
    `;
    const created = await db.query(selectQuery, [result.insertId]);
    
    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    console.error('Error creating stage:', error);
    res.status(500).json({ success: false, error: 'Failed to create stage' });
  }
});

// Update stage definition
router.put('/stages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      stage_name,
      stage_order,
      stage_color,
      stage_description,
      is_terminal,
      active
    } = req.body;
    
    // Check if stage exists and is not a default stage (unless updating order/color only)
    const checkQuery = `SELECT is_default FROM pipeline_stage_definitions WHERE id = ?`;
    const existing = await db.query(checkQuery, [id]);
    
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Stage not found' });
    }
    
    // Build dynamic update
    const updates = [];
    const values = [];
    
    if (stage_name !== undefined && !existing[0].is_default) {
      updates.push('stage_name = ?');
      values.push(stage_name);
    }
    if (stage_order !== undefined) {
      updates.push('stage_order = ?');
      values.push(stage_order);
    }
    if (stage_color !== undefined) {
      updates.push('stage_color = ?');
      values.push(stage_color);
    }
    if (stage_description !== undefined) {
      updates.push('stage_description = ?');
      values.push(stage_description);
    }
    if (is_terminal !== undefined && !existing[0].is_default) {
      updates.push('is_terminal = ?');
      values.push(is_terminal);
    }
    if (active !== undefined && !existing[0].is_default) {
      updates.push('active = ?');
      values.push(active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }
    
    values.push(id);
    const query = `UPDATE pipeline_stage_definitions SET ${updates.join(', ')} WHERE id = ?`;
    
    await db.query(query, values);
    
    // Get updated stage
    const selectQuery = `
      SELECT psd.*, u.lagnname as created_by_name
      FROM pipeline_stage_definitions psd
      LEFT JOIN activeusers u ON psd.created_by = u.id
      WHERE psd.id = ?
    `;
    const updated = await db.query(selectQuery, [id]);
    
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error updating stage:', error);
    res.status(500).json({ success: false, error: 'Failed to update stage' });
  }
});

// Delete custom stage (cannot delete default stages)
router.delete('/stages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if stage exists and is not default
    const checkQuery = `SELECT is_default FROM pipeline_stage_definitions WHERE id = ?`;
    const existing = await db.query(checkQuery, [id]);
    
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Stage not found' });
    }
    
    if (existing[0].is_default) {
      return res.status(403).json({ success: false, error: 'Cannot delete default stages' });
    }
    
    // Soft delete (set active = 0)
    const query = `UPDATE pipeline_stage_definitions SET active = 0 WHERE id = ?`;
    await db.query(query, [id]);
    
    res.json({ success: true, message: 'Stage deleted successfully' });
  } catch (error) {
    console.error('Error deleting stage:', error);
    res.status(500).json({ success: false, error: 'Failed to delete stage' });
  }
});

// ============================================================
// CHECKLIST ITEMS
// ============================================================

// Get checklist items for a stage
router.get('/checklist/:stageName', async (req, res) => {
  try {
    const { stageName } = req.params;
    const { teamId } = req.query;
    
    let query = `
      SELECT 
        pci.*,
        u.lagnname as created_by_name
      FROM pipeline_checklist_items pci
      LEFT JOIN activeusers u ON pci.created_by = u.id
      WHERE pci.stage_name = ?
      AND pci.active = 1
      AND (pci.team_id IS NULL ${teamId ? 'OR pci.team_id = ?' : ''})
      ORDER BY pci.item_order ASC
    `;
    
    const params = teamId ? [stageName, teamId] : [stageName];
    const result = await db.query(query, params);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching checklist items:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch checklist items' });
  }
});

// Get all checklist items (for settings view)
router.get('/checklist', async (req, res) => {
  try {
    const { teamId } = req.query;
    
    let query = `
      SELECT 
        pci.*,
        u.lagnname as created_by_name
      FROM pipeline_checklist_items pci
      LEFT JOIN activeusers u ON pci.created_by = u.id
      WHERE pci.active = 1
      AND (pci.team_id IS NULL ${teamId ? 'OR pci.team_id = ?' : ''})
      ORDER BY pci.stage_name, pci.item_order ASC
    `;
    
    const params = teamId ? [teamId] : [];
    const result = await db.query(query, params);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching checklist items:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch checklist items' });
  }
});

// Create checklist item
router.post('/checklist', async (req, res) => {
  try {
    const {
      stage_name,
      item_name,
      item_description,
      item_order,
      is_required,
      item_type,
      item_options,
      team_id,
      created_by
    } = req.body;
    
    if (!stage_name || !item_name || item_order === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'stage_name, item_name, and item_order are required' 
      });
    }
    
    const query = `
      INSERT INTO pipeline_checklist_items (
        stage_name, item_name, item_description, item_order,
        is_required, item_type, item_options, team_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await db.query(query, [
      stage_name,
      item_name,
      item_description,
      item_order,
      is_required || 0,
      item_type || 'checkbox',
      item_options ? JSON.stringify(item_options) : null,
      team_id || null,
      created_by || null
    ]);
    
    // Get the created item
    const selectQuery = `
      SELECT pci.*, u.lagnname as created_by_name
      FROM pipeline_checklist_items pci
      LEFT JOIN activeusers u ON pci.created_by = u.id
      WHERE pci.id = ?
    `;
    const created = await db.query(selectQuery, [result.insertId]);
    
    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    console.error('Error creating checklist item:', error);
    res.status(500).json({ success: false, error: 'Failed to create checklist item' });
  }
});

// Update checklist item
router.put('/checklist/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      item_name,
      item_description,
      item_order,
      is_required,
      item_type,
      item_options,
      active
    } = req.body;
    
    // Build dynamic update
    const updates = [];
    const values = [];
    
    if (item_name !== undefined) {
      updates.push('item_name = ?');
      values.push(item_name);
    }
    if (item_description !== undefined) {
      updates.push('item_description = ?');
      values.push(item_description);
    }
    if (item_order !== undefined) {
      updates.push('item_order = ?');
      values.push(item_order);
    }
    if (is_required !== undefined) {
      updates.push('is_required = ?');
      values.push(is_required);
    }
    if (item_type !== undefined) {
      updates.push('item_type = ?');
      values.push(item_type);
    }
    if (item_options !== undefined) {
      updates.push('item_options = ?');
      values.push(item_options ? JSON.stringify(item_options) : null);
    }
    if (active !== undefined) {
      updates.push('active = ?');
      values.push(active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }
    
    values.push(id);
    const query = `UPDATE pipeline_checklist_items SET ${updates.join(', ')} WHERE id = ?`;
    
    const result = await db.query(query, values);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Checklist item not found' });
    }
    
    // Get updated item
    const selectQuery = `
      SELECT pci.*, u.lagnname as created_by_name
      FROM pipeline_checklist_items pci
      LEFT JOIN activeusers u ON pci.created_by = u.id
      WHERE pci.id = ?
    `;
    const updated = await db.query(selectQuery, [id]);
    
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error updating checklist item:', error);
    res.status(500).json({ success: false, error: 'Failed to update checklist item' });
  }
});

// Delete checklist item
router.delete('/checklist/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete
    const query = `UPDATE pipeline_checklist_items SET active = 0 WHERE id = ?`;
    const result = await db.query(query, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Checklist item not found' });
    }
    
    res.json({ success: true, message: 'Checklist item deleted successfully' });
  } catch (error) {
    console.error('Error deleting checklist item:', error);
    res.status(500).json({ success: false, error: 'Failed to delete checklist item' });
  }
});

// ============================================================
// CHECKLIST PROGRESS
// ============================================================

// Get checklist items for a recruit with state-specific requirements applied
router.get('/recruits/:recruitId/checklist/items', async (req, res) => {
  try {
    const { recruitId } = req.params;
    
    // Get recruit's state
    const recruitQuery = `SELECT resident_state FROM pipeline WHERE id = ?`;
    const [recruit] = await db.query(recruitQuery, [recruitId]);
    
    if (!recruit) {
      return res.status(404).json({ success: false, error: 'Recruit not found' });
    }
    
    const recruitState = recruit.resident_state;
    
    // Get default checklist items
    const defaultItemsQuery = `
      SELECT 
        pci.*,
        u.lagnname as created_by_name
      FROM pipeline_checklist_items pci
      LEFT JOIN activeusers u ON pci.created_by = u.id
      WHERE pci.active = 1
      ORDER BY pci.stage_name, pci.item_order ASC
    `;
    
    let defaultItems = await db.query(defaultItemsQuery);
    
    // If no state or no state requirements exist, return defaults
    if (!recruitState) {
      return res.json({ success: true, data: defaultItems, state: null });
    }
    
    // Get state-specific requirements
    const stateReqQuery = `
      SELECT * FROM pipeline_state_requirements 
      WHERE state = ? AND active = 1
      ORDER BY stage_name, item_order ASC
    `;
    
    const stateRequirements = await db.query(stateReqQuery, [recruitState]);
    
    if (stateRequirements.length === 0) {
      return res.json({ success: true, data: defaultItems, state: recruitState });
    }
    
    // Apply state requirements
    let finalItems = [...defaultItems];
    
    console.log(`[State Requirements] Applying ${stateRequirements.length} requirements for state: ${recruitState}`);
    
    for (const req of stateRequirements) {
      console.log(`[State Req] Action: ${req.action}, Stage: ${req.stage_name}, Target: ${req.target_item_name}, Override Desc: ${req.override_description?.substring(0, 50)}...`);
      
      if (req.action === 'remove') {
        // Remove items by target_item_name
        finalItems = finalItems.filter(item => 
          !(item.stage_name === req.stage_name && item.item_name === req.target_item_name)
        );
      } else if (req.action === 'not_required') {
        // Mark item as not required
        finalItems = finalItems.map(item => {
          if (item.stage_name === req.stage_name && item.item_name === req.target_item_name) {
            return { ...item, is_required: false, state_modified: true };
          }
          return item;
        });
      } else if (req.action === 'modify') {
        // Modify existing item
        let matchFound = false;
        finalItems = finalItems.map(item => {
          if (item.stage_name === req.stage_name && item.item_name === req.target_item_name) {
            matchFound = true;
            console.log(`[State Req] ✓ Match found! Modifying item: ${item.item_name}`);
            console.log(`[State Req]   Old description: ${item.item_description?.substring(0, 50)}...`);
            console.log(`[State Req]   New description: ${req.override_description?.substring(0, 50)}...`);
            
            // Combine instructions: if both exist, combine them with separator
            let combinedInstructions = item.instructions || '';
            if (req.instructions) {
              if (combinedInstructions) {
                combinedInstructions += '\n\n--- State-Specific Instructions ---\n\n' + req.instructions;
              } else {
                combinedInstructions = req.instructions;
              }
            }
            
            return {
              ...item,
              item_description: req.override_description || item.item_description,
              is_required: req.override_required !== null ? req.override_required : item.is_required,
              item_type: req.override_type || item.item_type,
              item_options: req.override_options || item.item_options,
              url: req.url || item.url, // Add URL support
              instructions: combinedInstructions,
              state_modified: true
            };
          }
          return item;
        });
        
        if (!matchFound) {
          console.log(`[State Req] ✗ No match found for: ${req.target_item_name} in stage ${req.stage_name}`);
          console.log(`[State Req]   Available items in that stage:`, finalItems.filter(i => i.stage_name === req.stage_name).map(i => i.item_name));
        }
      } else if (req.action === 'add') {
        // Add new state-specific item
        finalItems.push({
          id: `state_${req.id}`, // Unique identifier for state-specific items
          stage_name: req.stage_name,
          item_name: req.item_name,
          item_description: req.item_description,
          instructions: req.instructions || null,
          item_order: req.item_order || 999,
          item_type: req.item_type || 'checkbox',
          item_options: req.item_options,
          url: req.url, // Add URL support
          is_required: true,
          active: 1,
          state_specific: true,
          state_requirement_id: req.id
        });
      }
    }
    
    // Re-sort by stage and order
    finalItems.sort((a, b) => {
      if (a.stage_name !== b.stage_name) {
        return a.stage_name.localeCompare(b.stage_name);
      }
      return (a.item_order || 999) - (b.item_order || 999);
    });
    
    res.json({ success: true, data: finalItems, state: recruitState });
  } catch (error) {
    console.error('Error fetching checklist items with state requirements:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch checklist items' });
  }
});

// Get checklist progress for a recruit
router.get('/recruits/:recruitId/checklist', async (req, res) => {
  try {
    const { recruitId } = req.params;
    
    const query = `
      SELECT 
        pcp.*,
        pci.stage_name,
        pci.item_name,
        pci.item_description,
        pci.item_type,
        pci.item_options,
        pci.is_required,
        u.lagnname as completed_by_name
      FROM pipeline_checklist_progress pcp
      JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
      LEFT JOIN activeusers u ON pcp.completed_by = u.id
      WHERE pcp.recruit_id = ?
      ORDER BY pci.stage_name, pci.item_order ASC
    `;
    
    const result = await db.query(query, [recruitId]);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching checklist progress:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch checklist progress' });
  }
});

// Update/create checklist item completion
router.post('/recruits/:recruitId/checklist', async (req, res) => {
  try {
    const { recruitId } = req.params;
    const {
      checklist_item_id,
      completed,
      completed_by,
      value,
      notes
    } = req.body;
    
    if (!checklist_item_id) {
      return res.status(400).json({ success: false, error: 'checklist_item_id is required' });
    }
    
    // Check if progress entry exists
    const checkQuery = `
      SELECT id FROM pipeline_checklist_progress 
      WHERE recruit_id = ? AND checklist_item_id = ?
    `;
    const existing = await db.query(checkQuery, [recruitId, checklist_item_id]);
    
    let result;
    
    if (existing.length > 0) {
      // Update existing
      const updates = [];
      const values = [];
      
      // Get current record to check if started_at is null
      const currentRecord = await db.query(
        'SELECT started_at FROM pipeline_checklist_progress WHERE id = ?',
        [existing[0].id]
      );
      
      if (completed !== undefined) {
        updates.push('completed = ?');
        values.push(completed);
        if (completed) {
          // If completing and started_at is null, set it to now
          if (!currentRecord[0].started_at) {
            updates.push('started_at = NOW()');
          }
          updates.push('completed_at = NOW()');
          if (completed_by) {
            updates.push('completed_by = ?');
            values.push(completed_by);
          }
        } else {
          updates.push('completed_at = NULL');
          updates.push('completed_by = NULL');
        }
      } else if (!currentRecord[0].started_at) {
        // If any update is happening and started_at is null, set it
        // (user has started working on this item)
        updates.push('started_at = NOW()');
      }
      
      if (value !== undefined) {
        updates.push('value = ?');
        values.push(value);
      }
      if (notes !== undefined) {
        updates.push('notes = ?');
        values.push(notes);
      }
      
      values.push(existing[0].id);
      const updateQuery = `
        UPDATE pipeline_checklist_progress 
        SET ${updates.join(', ')} 
        WHERE id = ?
      `;
      
      await db.query(updateQuery, values);
      result = { id: existing[0].id };
    } else {
      // Create new - set started_at to NOW when first creating the record
      const insertQuery = `
        INSERT INTO pipeline_checklist_progress (
          recruit_id, checklist_item_id, completed, completed_by, 
          completed_at, started_at, value, notes
        ) VALUES (?, ?, ?, ?, ${completed ? 'NOW()' : 'NULL'}, NOW(), ?, ?)
      `;
      
      result = await db.query(insertQuery, [
        recruitId,
        checklist_item_id,
        completed || 0,
        completed_by || null,
        value || null,
        notes || null
      ]);
    }
    
    // Get the updated/created progress with full details
    const selectQuery = `
      SELECT 
        pcp.*,
        pci.stage_name,
        pci.item_name,
        pci.item_description,
        pci.item_type,
        pci.item_options,
        pci.is_required,
        u.lagnname as completed_by_name
      FROM pipeline_checklist_progress pcp
      JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
      LEFT JOIN activeusers u ON pcp.completed_by = u.id
      WHERE pcp.recruit_id = ? AND pcp.checklist_item_id = ?
    `;
    const updated = await db.query(selectQuery, [recruitId, checklist_item_id]);
    
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error updating checklist progress:', error);
    res.status(500).json({ success: false, error: 'Failed to update checklist progress' });
  }
});

// Bulk update checklist progress
router.post('/recruits/:recruitId/checklist/bulk', async (req, res) => {
  try {
    const { recruitId } = req.params;
    const { items } = req.body; // Array of { checklist_item_id, completed, value, notes }
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'items array is required' });
    }
    
    const results = [];
    
    for (const item of items) {
      const { checklist_item_id, completed, completed_by, value, notes } = item;
      
      // Check if exists
      const checkQuery = `
        SELECT id FROM pipeline_checklist_progress 
        WHERE recruit_id = ? AND checklist_item_id = ?
      `;
      const existing = await db.query(checkQuery, [recruitId, checklist_item_id]);
      
      if (existing.length > 0) {
        // Update
        const updates = [];
        const values = [];
        
        // Get current record to check if started_at is null
        const currentRecord = await db.query(
          'SELECT started_at FROM pipeline_checklist_progress WHERE id = ?',
          [existing[0].id]
        );
        
        if (completed !== undefined) {
          updates.push('completed = ?');
          values.push(completed);
          if (completed) {
            // If completing and started_at is null, set it to now
            if (!currentRecord[0].started_at) {
              updates.push('started_at = NOW()');
            }
            updates.push('completed_at = NOW()');
            if (completed_by) {
              updates.push('completed_by = ?');
              values.push(completed_by);
            }
          } else {
            updates.push('completed_at = NULL');
            updates.push('completed_by = NULL');
          }
        } else if (!currentRecord[0].started_at) {
          // If any update is happening and started_at is null, set it
          updates.push('started_at = NOW()');
        }
        
        if (value !== undefined) {
          updates.push('value = ?');
          values.push(value);
        }
        if (notes !== undefined) {
          updates.push('notes = ?');
          values.push(notes);
        }
        
        if (updates.length > 0) {
          values.push(existing[0].id);
          const updateQuery = `
            UPDATE pipeline_checklist_progress 
            SET ${updates.join(', ')} 
            WHERE id = ?
          `;
          await db.query(updateQuery, values);
        }
      } else {
        // Insert - set started_at to NOW when first creating the record
        const insertQuery = `
          INSERT INTO pipeline_checklist_progress (
            recruit_id, checklist_item_id, completed, completed_by, 
            completed_at, started_at, value, notes
          ) VALUES (?, ?, ?, ?, ${completed ? 'NOW()' : 'NULL'}, NOW(), ?, ?)
        `;
        
        await db.query(insertQuery, [
          recruitId,
          checklist_item_id,
          completed || 0,
          completed_by || null,
          value || null,
          notes || null
        ]);
      }
      
      results.push({ checklist_item_id, success: true });
    }
    
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error bulk updating checklist progress:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk update checklist progress' });
  }
});

// ============================================================
// PIPELINE STATISTICS
// ============================================================

// Get pipeline statistics (count per stage)
router.get('/stats', async (req, res) => {
  try {
    const { teamId, userIds } = req.query;
    
    let whereClause = '';
    let params = [];
    
    if (userIds) {
      // Team stats
      const ids = userIds.split(',').map(id => parseInt(id));
      const placeholders = ids.map(() => '?').join(',');
      whereClause = `WHERE p.recruiting_agent IN (${placeholders})`;
      params = ids;
    }
    
    const query = `
      SELECT 
        p.step as stage_name,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT p.recruiting_agent) as recruiting_agents
      FROM pipeline p
      ${whereClause}
      GROUP BY p.step
      ORDER BY p.step
    `;
    
    const result = await db.query(query, params);
    
    // Get total count
    const totalQuery = `SELECT COUNT(*) as total FROM pipeline p ${whereClause}`;
    const totalResult = await db.query(totalQuery, params);
    
    res.json({ 
      success: true, 
      data: {
        stages: result,
        total: totalResult[0].total
      }
    });
  } catch (error) {
    console.error('Error fetching pipeline stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pipeline stats' });
  }
});

// Get agent-specific stats
router.get('/stats/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const query = `
      SELECT 
        p.step as stage_name,
        COUNT(*) as count
      FROM pipeline p
      WHERE p.recruiting_agent = ?
      GROUP BY p.step
      ORDER BY p.step
    `;
    
    const result = await db.query(query, [agentId]);
    
    // Get total count for agent
    const totalQuery = `SELECT COUNT(*) as total FROM pipeline WHERE recruiting_agent = ?`;
    const totalResult = await db.query(totalQuery, [agentId]);
    
    res.json({ 
      success: true, 
      data: {
        stages: result,
        total: totalResult[0].total
      }
    });
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch agent stats' });
  }
});

// Get recruits by stage
router.get('/recruits/stage/:stageName', async (req, res) => {
  try {
    const { stageName } = req.params;
    const { userIds } = req.query;
    
    let whereClause = 'WHERE p.step = ?';
    let params = [stageName];
    
    if (userIds) {
      const ids = userIds.split(',').map(id => parseInt(id));
      const placeholders = ids.map(() => '?').join(',');
      whereClause += ` AND p.recruiting_agent IN (${placeholders})`;
      params = [stageName, ...ids];
    }
    
    const query = `
      SELECT 
        p.*,
        u.lagnname as recruiting_agent_name,
        ps.date_entered as current_stage_entered,
        p.date_added as date_added_utc
      FROM pipeline p
      LEFT JOIN activeusers u ON p.recruiting_agent = u.id
      LEFT JOIN pipeline_steps ps ON ps.recruit_id = p.id 
        AND ps.step = p.step 
        AND ps.date_exited IS NULL
      ${whereClause}
      ORDER BY ps.date_entered DESC, p.date_added DESC
    `;
    
    const result = await db.query(query, params);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching recruits by stage:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recruits by stage' });
  }
});

// Get checklist items for a stage with completion stats
router.get('/stages/:stageName/checklist-items', async (req, res) => {
  try {
    const { stageName } = req.params;
    const { recruitIds } = req.query;
    
    // Get checklist items for this stage
    const itemsQuery = `
      SELECT 
        id,
        stage_name,
        item_name,
        item_description,
        item_order,
        is_required,
        item_type
      FROM pipeline_checklist_items
      WHERE stage_name = ? AND active = 1
      ORDER BY item_order ASC
    `;
    
    const items = await db.query(itemsQuery, [stageName]);
    
    // If recruitIds provided, get completion stats
    if (recruitIds) {
      const ids = recruitIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        
        // Get completion counts for each item
        const statsQuery = `
          SELECT 
            pcp.checklist_item_id,
            COUNT(DISTINCT CASE WHEN pcp.completed = 1 THEN pcp.recruit_id END) as completed_count,
            COUNT(DISTINCT pcp.recruit_id) as total_with_progress
          FROM pipeline_checklist_progress pcp
          WHERE pcp.recruit_id IN (${placeholders})
            AND pcp.checklist_item_id IN (${items.map(() => '?').join(',')})
          GROUP BY pcp.checklist_item_id
        `;
        
        const itemIds = items.map(item => item.id);
        const stats = await db.query(statsQuery, [...ids, ...itemIds]);
        
        // Merge stats into items
        const statsMap = new Map(stats.map(s => [s.checklist_item_id, s]));
        
        const itemsWithStats = items.map(item => ({
          ...item,
          completed_count: statsMap.get(item.id)?.completed_count || 0,
          total_count: ids.length,
          pending_count: ids.length - (statsMap.get(item.id)?.completed_count || 0)
        }));
        
        return res.json({ success: true, data: itemsWithStats });
      }
    }
    
    // Return items without stats
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching stage checklist items:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch checklist items' });
  }
});

// Get checklist progress for multiple recruits (bulk)
router.post('/recruits/checklist/bulk', async (req, res) => {
  try {
    const { recruitIds } = req.body;
    
    if (!recruitIds || !Array.isArray(recruitIds) || recruitIds.length === 0) {
      return res.json({ success: true, data: {} });
    }
    
    const placeholders = recruitIds.map(() => '?').join(',');
    const query = `
      SELECT 
        pcp.recruit_id,
        pcp.checklist_item_id,
        pcp.completed,
        pcp.value,
        pcp.completed_at
      FROM pipeline_checklist_progress pcp
      WHERE pcp.recruit_id IN (${placeholders})
    `;
    
    const results = await db.query(query, recruitIds);
    
    // Group by recruit_id
    const progressMap = {};
    results.forEach(row => {
      if (!progressMap[row.recruit_id]) {
        progressMap[row.recruit_id] = [];
      }
      progressMap[row.recruit_id].push(row);
    });
    
    res.json({ success: true, data: progressMap });
  } catch (error) {
    console.error('Error fetching bulk checklist progress:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch checklist progress' });
  }
});

// ============================================================
// PIPELINE NOTES/COMMENTS
// ============================================================

// Get notes for a recruit
router.get('/recruits/:recruitId/notes', async (req, res) => {
  try {
    const { recruitId } = req.params;
    
    const query = `
      SELECT 
        pn.*,
        u.lagnname as created_by_name
      FROM pipeline_notes pn
      LEFT JOIN activeusers u ON pn.created_by = u.id
      WHERE pn.recruit_id = ?
      ORDER BY pn.created_at DESC
    `;
    
    const result = await db.query(query, [recruitId]);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
});

// Add note to recruit
router.post('/recruits/:recruitId/notes', async (req, res) => {
  try {
    const { recruitId } = req.params;
    const { note, created_by } = req.body;
    
    if (!note || !created_by) {
      return res.status(400).json({ success: false, error: 'note and created_by are required' });
    }
    
    const query = `
      INSERT INTO pipeline_notes (recruit_id, note, created_by)
      VALUES (?, ?, ?)
    `;
    
    const result = await db.query(query, [recruitId, note, created_by]);
    
    // Get the created note
    const selectQuery = `
      SELECT pn.*, u.lagnname as created_by_name
      FROM pipeline_notes pn
      LEFT JOIN activeusers u ON pn.created_by = u.id
      WHERE pn.id = ?
    `;
    const created = await db.query(selectQuery, [result.insertId]);
    
    res.status(201).json({ success: true, data: created[0] });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ success: false, error: 'Failed to create note' });
  }
});

// Update note
router.put('/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    
    if (!note) {
      return res.status(400).json({ success: false, error: 'note is required' });
    }
    
    const query = `UPDATE pipeline_notes SET note = ? WHERE id = ?`;
    const result = await db.query(query, [note, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }
    
    // Get updated note
    const selectQuery = `
      SELECT pn.*, u.lagnname as created_by_name
      FROM pipeline_notes pn
      LEFT JOIN activeusers u ON pn.created_by = u.id
      WHERE pn.id = ?
    `;
    const updated = await db.query(selectQuery, [id]);
    
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ success: false, error: 'Failed to update note' });
  }
});

// Delete note
router.delete('/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `DELETE FROM pipeline_notes WHERE id = ?`;
    const result = await db.query(query, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }
    
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
});

// =====================================================================
// POST /applicants - Create a new applicant from careers form
// =====================================================================
router.post('/applicants', async (req, res) => {
  console.log('Incoming careers form data:', req.body);

  const {
    Phone,
    Email,
    HiringManager,
    Aspects,
    Concern,
    Spouse,
    CareerGoals,
    Compensation,
    WhyChoose,
    recruitingAgent,
    Prepared,
    agentEmail,
    recruit_first,
    recruit_middle,
    recruit_last,
    recruit_suffix,
    resident_state,
    referral_source
  } = req.body;

  const currentDate = new Date().toISOString().split('T')[0];

  console.log('Adding recruit from careers form:', {
    date_added: currentDate,
    phone: Phone,
    email: Email,
    recruiting_agent: recruitingAgent,
    recruit_first,
    recruit_middle,
    recruit_last,
    recruit_suffix, 
    resident_state,
    Aspects,
    Concern,
    Spouse,
    CareerGoals,
    Compensation,
    WhyChoose,
    Prepared,
    referral_source
  });

  try {
    // Get recruiter's MGA
    let recruiterMGA = null;
    if (recruitingAgent) {
      const recruiterData = await db.query(
        'SELECT mga FROM activeusers WHERE id = ? LIMIT 1',
        [recruitingAgent]
      );
      if (recruiterData.length > 0) {
        recruiterMGA = recruiterData[0].mga;
      }
    }

    // Insert into the pipeline table
    const result = await db.query(
      `INSERT INTO pipeline (
        date_added,
        phone,
        email,
        recruiting_agent,
        recruit_first,
        recruit_middle,
        recruit_last,
        recruit_suffix, 
        resident_state,
        Aspects,
        Concern,
        Spouse,
        CareerGoals,
        Compensation,
        WhyChoose,
        Prepared,
        MGA,
        referral_source,
        step
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        currentDate, 
        Phone,
        Email,
        recruitingAgent,
        recruit_first,
        recruit_middle,
        recruit_last,
        recruit_suffix,
        resident_state,
        Aspects,
        Concern,
        Spouse,
        CareerGoals,
        Compensation,
        WhyChoose,
        Prepared,
        recruiterMGA,
        referral_source,
        "Careers Form"
      ]
    );
    const recruit_id = result.insertId;
    console.log('Recruit added with ID:', recruit_id);

    // Insert into the pipeline_steps table - format current time as EST string
    const now3 = new Date();
    const estFormatted3 = now3.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)/, '$3-$1-$2 $4:$5:$6');
    
    await db.query(
      `INSERT INTO pipeline_steps (recruit_id, step, date_entered, date_exited) 
       VALUES (?, ?, ?, NULL)`,
      [recruit_id, "Careers Form", estFormatted3]
    );

    console.log('Recruit and pipeline step created successfully');

    // Send email notification if agentEmail is provided
    if (agentEmail) {
      console.log('Sending email to agent:', agentEmail);
      
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00558C;">New Applicant Submission</h2>
          <p>Hello,</p>
          <p>A new applicant has been submitted through the careers form:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #00558C; margin-top: 0;">Applicant Details</h3>
            <p><strong>Name:</strong> ${recruit_first} ${recruit_middle ? recruit_middle + ' ' : ''}${recruit_last}${recruit_suffix ? ' ' + recruit_suffix : ''}</p>
            <p><strong>Phone:</strong> ${Phone}</p>
            <p><strong>Email:</strong> ${Email}</p>
            <p><strong>Resident State:</strong> ${resident_state}</p>
            <p><strong>How did you hear about us?:</strong> ${referral_source}</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #00558C; margin-top: 0;">Questionnaire Responses</h3>
            <p><strong>What aspects appeal most:</strong><br/>${Aspects}</p>
            <p><strong>Biggest concern:</strong><br/>${Concern}</p>
            <p><strong>Spouse/significant other discussion:</strong><br/>${Spouse}</p>
            <p><strong>Career goals:</strong><br/>${CareerGoals}</p>
            <p><strong>Compensation questions:</strong><br/>${Compensation}</p>
            <p><strong>Why choose them:</strong><br/>${WhyChoose}</p>
            <p><strong>Prepared for licensing process:</strong> ${Prepared === 'yes' ? 'Yes' : 'No'}</p>
          </div>
          
          <p>Please review the applicant details in the <a href="https://agents.ariaslife.com/recruiting" style="color: #00558C;">Recruiting Dashboard</a>.</p>
          <p>Thank you!</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="font-size: 12px; color: #666;">This is an automated notification from the Arias Atlas system.</p>
        </div>
      `;
      
      try {
        await emailService.sendEmail({
          to: agentEmail,
          subject: 'New Applicant Submission from Careers Form',
          html: emailContent
        });
        console.log('Notification email sent successfully');
      } catch (error) {
        console.error('Failed to send notification email:', error);
        // Don't fail the whole request if email fails
      }
    }

    res.status(201).json({ 
      success: true,
      recruit_id,
      message: 'Application submitted successfully'
    });
  } catch (err) {
    console.error('Error adding recruit from careers form:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error while processing application'
    });
  }
});

// ============================================================
// RECRUIT SUMMARY (Enrollment + Manager contact)
// GET /api/recruitment/recruits/:recruitId/summary
// Returns: { recruit_id, enrollment_date, code_to, manager: { id, lagnname, email, phone } }
// ============================================================
router.get('/recruits/:recruitId/summary', async (req, res) => {
  try {
    const { recruitId } = req.params;

    const query = `
      SELECT 
        p.id as recruit_id,
        p.email as recruit_email,
        p.code_to,
        p.date_added as enrollment_date,
        p.course as course,
        p.expected_complete_date as expected_complete_date,
        p.resident_license_number as resident_license_number,
        p.npn as npn,
        ct.id as coded_id,
        ct.clname as coded_clname,
        ct.sa as coded_sa,
        ct.ga as coded_ga,
        ct.mga as coded_mga,
        ct.rga as coded_rga,
        CASE WHEN ct.clname IN ('SA','GA','MGA','RGA') THEN ct.id ELSE mgr.id END as manager_id,
        CASE WHEN ct.clname IN ('SA','GA','MGA','RGA') THEN ct.lagnname ELSE mgr.lagnname END as manager_name,
        CASE WHEN ct.clname IN ('SA','GA','MGA','RGA') THEN ct.email ELSE mgr.email END as manager_email,
        CASE WHEN ct.clname IN ('SA','GA','MGA','RGA') THEN ct.phone ELSE mgr.phone END as manager_phone,
        CASE WHEN ct.clname IN ('SA','GA','MGA','RGA') THEN ct.profpic ELSE mgr.profpic END as manager_profpic
      FROM pipeline p
      LEFT JOIN activeusers ct ON ct.id = p.code_to
      LEFT JOIN activeusers mgr ON mgr.id = COALESCE(ct.mga, ct.rga, ct.ga, ct.sa)
      WHERE p.id = ?
      LIMIT 1
    `;

    const rows = await db.query(query, [recruitId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recruit not found' });
    }

    const r = rows[0];
    
    // Fetch prelic_progress data if recruit has an email
    let prelicProgress = null;
    if (r.recruit_email) {
      console.log(`🔍 Looking up prelic_progress for email: ${r.recruit_email}`);
      const prelicRows = await db.query(`
        SELECT 
          date_enrolled,
          time_spent,
          ple_complete_pct,
          prepared_to_pass,
          email_date
        FROM prelic_progress
        WHERE email = ?
        ORDER BY email_date DESC
        LIMIT 1
      `, [r.recruit_email]);
      
      if (prelicRows && prelicRows.length > 0) {
        prelicProgress = prelicRows[0];
        console.log(`✅ Found prelic_progress for ${r.recruit_email}:`, prelicProgress);
      } else {
        console.log(`❌ No prelic_progress found for ${r.recruit_email}`);
      }
    } else {
      console.log(`⚠️ No email found in pipeline for recruit ${recruitId}`);
    }
    
    res.json({
      success: true,
      data: {
        recruit_id: r.recruit_id,
        enrollment_date: r.enrollment_date,
        course: r.course,
        expected_complete_date: r.expected_complete_date,
        resident_license_number: r.resident_license_number,
        npn: r.npn,
        code_to: r.code_to,
        manager: r.manager_id ? {
          id: r.manager_id,
          lagnname: r.manager_name,
          email: r.manager_email,
          phone: r.manager_phone,
          profpic: r.manager_profpic
        } : null,
        prelic_progress: prelicProgress
      }
    });
  } catch (error) {
    console.error('Error fetching recruit summary:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recruit summary' });
  }
});

// ============================================================
// GET XCEL PARTNER LINK
// GET /api/recruitment/recruits/:recruitId/xcel-link
// Returns: { xcel_link: 'https://partners.xcelsolutions.com/ariasevanson' }
// ============================================================
router.get('/recruits/:recruitId/xcel-link', async (req, res) => {
  try {
    const { recruitId } = req.params;
    
    // Get the recruit's code_to value
    const pipelineRows = await db.query(
      'SELECT code_to FROM pipeline WHERE id = ? LIMIT 1',
      [recruitId]
    );
    
    if (!pipelineRows || pipelineRows.length === 0) {
      return res.json({ 
        success: true, 
        xcel_link: 'https://partners.xcelsolutions.com/ariasevanson' // default
      });
    }
    
    const code_to = pipelineRows[0].code_to;
    
    if (!code_to) {
      return res.json({ 
        success: true, 
        xcel_link: 'https://partners.xcelsolutions.com/ariasevanson' // default
      });
    }
    
    // Get the code_to user's MGA
    const codeToUserRows = await db.query(
      'SELECT clname, lagnname, mga FROM activeusers WHERE id = ? LIMIT 1',
      [code_to]
    );
    
    if (!codeToUserRows || codeToUserRows.length === 0) {
      return res.json({ 
        success: true, 
        xcel_link: 'https://partners.xcelsolutions.com/ariasevanson' // default
      });
    }
    
    const codeToUser = codeToUserRows[0];
    let mgaLagnname = null;
    
    // If code_to user is MGA or RGA, use their lagnname
    if (codeToUser.clname === 'MGA' || codeToUser.clname === 'RGA') {
      mgaLagnname = codeToUser.lagnname;
    } else {
      // Otherwise, use their mga field
      mgaLagnname = codeToUser.mga;
    }
    
    if (!mgaLagnname) {
      return res.json({ 
        success: true, 
        xcel_link: 'https://partners.xcelsolutions.com/ariasevanson' // default
      });
    }
    
    // Look up the tree in MGAs table
    const mgaRows = await db.query(
      'SELECT tree FROM MGAs WHERE lagnname = ? LIMIT 1',
      [mgaLagnname]
    );
    
    let partnerPath = 'ariasevanson'; // default
    
    if (mgaRows && mgaRows.length > 0 && mgaRows[0].tree) {
      const tree = mgaRows[0].tree;
      
      if (tree === 'ADAMS JUSTIN H') {
        partnerPath = 'ariasadams';
      } else if (tree === 'MAUGHANEVANSON BRODY W') {
        partnerPath = 'ariasevanson';
      }
      // else default to ariasevanson
    }
    
    res.json({ 
      success: true, 
      xcel_link: `https://partners.xcelsolutions.com/${partnerPath}`
    });
    
  } catch (error) {
    console.error('Error fetching XCEL link:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch XCEL link' });
  }
});

// ============================================================
// GET /recruits/:recruitId/aob
// Get AOB (Agent Onboarding) data for a recruit
// Returns the AOBUpdates record linked to this recruit
// ============================================================
router.get('/recruits/:recruitId/aob', async (req, res) => {
  try {
    const { recruitId } = req.params;
    
    // First get the recruit's aob field value
    const recruitRows = await db.query(
      'SELECT aob FROM pipeline WHERE id = ?',
      [recruitId]
    );
    
    if (!recruitRows || recruitRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recruit not found' });
    }
    
    const aobId = recruitRows[0].aob;
    
    if (!aobId) {
      return res.json({ success: true, data: null, message: 'No AOB linked to this recruit' });
    }
    
    // Get the AOB data
    const aobRows = await db.query(
      `SELECT * FROM AOBUpdates WHERE id = ?`,
      [aobId]
    );
    
    if (!aobRows || aobRows.length === 0) {
      return res.json({ success: true, data: null, message: 'AOB record not found' });
    }
    
    res.json({ success: true, data: aobRows[0] });
    
  } catch (error) {
    console.error('Error fetching AOB data:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch AOB data' });
  }
});

/**
 * Send a group text to recruit AND their upline (code_to person)
 * POST /api/recruitment/recruits/:id/send-group-text
 */
router.post('/recruits/:id/send-group-text', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { message: customMessage } = req.body || {};
    const userId = req.userId;

    console.log('[Recruitment Route] Group text requested for recruit:', id, 'by user:', userId);

    // Load pipeline row with code_to user info
    const rows = await db.query(
      `SELECT p.*, 
              p.phone as recruit_phone,
              u.phone as code_to_phone,
              u.lagnname as code_to_name,
              rec_agent.lagnname as recruiting_agent_name
       FROM pipeline p 
       LEFT JOIN activeusers u ON p.code_to = u.id
       LEFT JOIN activeusers rec_agent ON p.recruiting_agent = rec_agent.id
       WHERE p.id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Recruit not found' });
    }

    const recruit = rows[0];
    const recruitName = `${recruit.recruit_first} ${recruit.recruit_last}`.trim();

    // Validate both phone numbers exist
    if (!recruit.recruit_phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recruit phone number not found' 
      });
    }

    if (!recruit.code_to_phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Code-to person phone number not found' 
      });
    }

    // Check SMS balance (need credits for 2 recipients)
    const balanceRows = await query(
      'SELECT balance FROM sms_balances WHERE user_id = ?',
      [userId]
    );
    const currentBalance = balanceRows.length > 0 ? balanceRows[0].balance : 0;
    const requiredCredits = SMS_COST_CENTS * 2; // 2 recipients

    if (currentBalance < requiredCredits) {
      return res.status(400).json({
        success: false,
        message: `Insufficient SMS credits. Need ${requiredCredits} credits, have ${currentBalance}`,
      });
    }

    // Use custom message or default
    const messageText = customMessage || `Hi ${recruitName}, this is a group text with you and your upline ${recruit.code_to_name}. We're here to support you!`;

    // Prepare variables for replacement
    const variables = {
      recruit_first: recruit.recruit_first || '',
      recruit_last: recruit.recruit_last || '',
      recruit_middle: recruit.recruit_middle || '',
      code_to_name: recruit.code_to_name || '',
      recruiting_agent_name: recruit.recruiting_agent_name || '',
    };

    // Replace variables in the message
    const processedMessage = replaceVariables(messageText, variables);

    console.log('[Recruitment Route] Creating group conversation for:', {
      recruit: recruit.recruit_phone,
      code_to: recruit.code_to_phone,
      messageLength: processedMessage.length
    });

    // Create group conversation with both participants
    const groupName = `${recruitName} & ${recruit.code_to_name}`;
    const result = await twilioConversations.sendGroupMessage(
      [recruit.recruit_phone, recruit.code_to_phone],
      processedMessage,
      groupName,
      'Atlas'
    );

    if (!result.success) {
      console.error('[Recruitment Route] Group text failed:', result.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send group text',
        error: result.error,
      });
    }

    // Deduct credits
    await query(
      'UPDATE sms_balances SET balance = balance - ?, last_updated = NOW() WHERE user_id = ?',
      [requiredCredits, userId]
    );

    // Log transaction
    await query(
      `INSERT INTO sms_credit_transactions (user_id, amount, transaction_type, description)
       VALUES (?, ?, 'debit', ?)`,
      [userId, -requiredCredits, `Group text to recruit ${id} and upline`]
    );

    // Log each message
    for (const participant of result.participants) {
      await query(
        `INSERT INTO sms_messages 
         (user_id, pipeline_id, to_number, message, provider, provider_message_id, status, cost_credits)
         VALUES (?, ?, ?, ?, 'twilio_conversations', ?, 'sent', ?)`,
        [userId, id, participant.phoneNumber, processedMessage, result.messageSid, SMS_COST_CENTS]
      );
    }

    console.log('[Recruitment Route] Group text sent successfully:', result.conversationSid);

    res.json({
      success: true,
      message: 'Group text sent successfully',
      conversationSid: result.conversationSid,
      messageSid: result.messageSid,
      recipients: result.participants.length,
      groupName,
      cost: (requiredCredits / 100).toFixed(2),
    });
  } catch (error) {
    console.error('[Recruitment Route] Error sending group text:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error sending group text', 
      error: error.message 
    });
  }
});

module.exports = router; 