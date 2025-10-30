const express = require('express');
const router = express.Router();
const { query: db } = require('../db');
const verifyToken = require('../middleware/verifyToken');

/**
 * Middleware to optionally verify token (allows internal service calls)
 */
const optionalAuth = (req, res, next) => {
  const isLocalhost = req.ip === '127.0.0.1' || 
                      req.ip === '::1' || 
                      req.ip === '::ffff:127.0.0.1' ||
                      req.hostname === 'localhost';
  
  if (isLocalhost) {
    return next();
  }
  
  return verifyToken(req, res, next);
};

/**
 * Parse lagnname from activeusers format to individual name parts
 * Format: "LAST FIRST MIDDLE SUFFIX" → {last, first, middle, suffix}
 */
function parseLagnname(lagnname) {
  if (!lagnname) return { last: '', first: '', middle: '', suffix: '' };
  
  const parts = lagnname.trim().split(/\s+/);
  
  return {
    last: parts[0] || '',
    first: parts[1] || '',
    middle: parts[2] || '',
    suffix: parts[3] || ''
  };
}

/**
 * Determine the appropriate pipeline step based on activeuser status
 */
function determinePipelineStep(activeuser) {
  // Align with startup sync: pending = 1 agents belong in Training
  if (activeuser.pending === 1) {
    return 'Training';
  }
  // If they have an agent number but are not pending (out of scope here), fallback
  if (activeuser.agtnum) {
    return 'On-boarding';
  }
  return 'Final Decision';
}

/**
 * Get recruiting agent ID based on priority: sa -> ga -> mga
 * Returns the activeusers.id for the lagnname found
 */
async function getRecruitingAgentId(agent) {
  // Priority: sa -> ga -> mga
  const uplineName = agent.sa || agent.ga || agent.mga;
  
  if (!uplineName) {
    return null;
  }
  
  // Find the activeuser with matching lagnname
  const uplineUser = await db(`
    SELECT id FROM activeusers
    WHERE UPPER(TRIM(lagnname)) = UPPER(TRIM(?))
    LIMIT 1
  `, [uplineName]);
  
  if (uplineUser.length > 0) {
    return uplineUser[0].id;
  }
  
  return null;
}

/**
 * Get checklist items that should be auto-completed based on agent status
 */
async function getItemsToComplete(activeuser, pipelineId) {
  // Align with startup sync behavior:
  // - Complete all Overview and On-boarding items
  // - Complete Training items up to (but NOT including) "Attend Training"
  const itemsToComplete = [];
  const allItems = await db(`
    SELECT id, stage_name, item_name, item_type, item_order
    FROM pipeline_checklist_items
    WHERE team_id IS NULL AND active = 1
    ORDER BY 
      CASE stage_name
        WHEN 'Overview' THEN 1
        WHEN 'On-boarding' THEN 2
        WHEN 'Training' THEN 3
        ELSE 4
      END,
      item_order ASC
  `);

  for (const item of allItems) {
    if (item.stage_name === 'Overview' || item.stage_name === 'On-boarding') {
      itemsToComplete.push(item.id);
    } else if (item.stage_name === 'Training') {
      if (String(item.item_name).toLowerCase().includes('attend training')) {
        break;
      }
      itemsToComplete.push(item.id);
    }
  }

  return itemsToComplete;
}

/**
 * Auto-complete checklist items for a pipeline record
 */
async function autoCompleteChecklistItems(pipelineId, itemIds, activeuserId) {
  if (itemIds.length === 0) return;
  
  // Use a system user ID (or null) for auto-completed items
  const systemUserId = null;
  const now = new Date().toISOString();
  
  for (const itemId of itemIds) {
    // Check if already completed
    const existing = await db(`
      SELECT id FROM pipeline_checklist_progress
      WHERE recruit_id = ? AND checklist_item_id = ?
    `, [pipelineId, itemId]);
    
    if (existing.length === 0) {
      // Insert new completion record
      await db(`
        INSERT INTO pipeline_checklist_progress 
        (recruit_id, checklist_item_id, completed, completed_by, completed_at)
        VALUES (?, ?, 1, ?, ?)
      `, [pipelineId, itemId, systemUserId, now]);
    } else {
      // Update existing record to completed
      await db(`
        UPDATE pipeline_checklist_progress
        SET completed = 1, completed_by = ?, completed_at = ?
        WHERE id = ?
      `, [systemUserId, now, existing[0].id]);
    }
  }
  
  console.log(`✅ Auto-completed ${itemIds.length} checklist items for pipeline ${pipelineId}`);
}

/**
 * Sync pending agents: create pipeline records if needed and link
 * GET /api/pending-agent-sync/sync-all
 */
router.get('/sync-all', optionalAuth, async (req, res) => {
  try {
    console.log('🔄 Starting pending agent sync...');
    
    // Get pending agents matching the same criteria as startup sync
    const pendingAgents = await db(`
      SELECT id, lagnname, esid, mga, sa, ga, agtnum, pending, pipeline_id, Active, managerActive, clname
      FROM activeusers
      WHERE pending = 1
        AND Active = 'y'
        AND managerActive = 'y'
        AND clname = 'AGT'
        AND (pipeline_id IS NULL OR pipeline_id = 0)
        AND DATE(esid) >= (CURDATE() - INTERVAL 10 DAY)
    `);
    
    console.log(`📋 Found ${pendingAgents.length} pending agents`);
    
    let created = 0;
    let linked = 0;
    let skipped = 0;
    let errors = 0;
    const results = [];
    
    for (const agent of pendingAgents) {
      try {
        let pipelineId = null;
        
        // Check if already linked to a pipeline record
        if (agent.pipeline_id) {
          pipelineId = agent.pipeline_id;
          skipped++;
          console.log(`⏭️  Agent ${agent.lagnname} already linked to pipeline ${pipelineId}`);
          continue;
        }
        
        // Try to find existing pipeline record by matching name/mga
        const nameParts = parseLagnname(agent.lagnname);
        
        const existingPipeline = await db(`
          SELECT id FROM pipeline
          WHERE UPPER(TRIM(recruit_last)) = UPPER(TRIM(?))
          AND UPPER(TRIM(recruit_first)) = UPPER(TRIM(?))
          AND (
            ? = '' OR ? IS NULL OR
            UPPER(TRIM(recruit_middle)) = UPPER(TRIM(?))
          )
          AND (? IS NULL OR UPPER(TRIM(MGA)) = UPPER(TRIM(?)))
          AND NOT EXISTS (
            SELECT 1 FROM activeusers WHERE pipeline_id = pipeline.id
          )
          LIMIT 1
        `, [
          nameParts.last, 
          nameParts.first, 
          nameParts.middle, nameParts.middle, nameParts.middle,
          agent.mga, agent.mga
        ]);
        
        if (existingPipeline.length > 0) {
          // Per requirement: skip agents that are already in pipeline
          skipped++;
          console.log(`⏭️  Skipping ${agent.lagnname} - existing pipeline record found`);
        } else {
          // No existing pipeline record - create new one
          const step = determinePipelineStep(agent);
          
          // Get recruiting agent ID (sa -> ga -> mga priority)
          const recruitingAgentId = await getRecruitingAgentId(agent);
          
          const insertResult = await db(`
            INSERT INTO pipeline (
              recruiting_agent, recruit_first, recruit_last, recruit_middle, recruit_suffix,
              step, MGA, agentnum, code_to,
              date_added, date_last_updated
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?,
              NOW(), NOW()
            )
          `, [
            recruitingAgentId || '', // recruiting_agent from sa -> ga -> mga
            nameParts.first,
            nameParts.last,
            nameParts.middle,
            nameParts.suffix,
            step,
            agent.mga || null,
            agent.agtnum || null,
            recruitingAgentId || null // code_to same as recruiting_agent
          ]);
          
          pipelineId = insertResult.insertId;
          
          // Link to activeuser
          await db(`
            UPDATE activeusers
            SET pipeline_id = ?
            WHERE id = ?
          `, [pipelineId, agent.id]);
          
          // Add initial pipeline step
          await db(`
            INSERT INTO pipeline_steps (recruit_id, step, date_entered)
            VALUES (?, ?, NOW())
          `, [pipelineId, step]);
          
          created++;
          console.log(`✨ Created new pipeline ${pipelineId} for agent ${agent.lagnname} at step: ${step}`);
          
          // Auto-complete checklist items based on status
          const itemsToComplete = await getItemsToComplete(agent, pipelineId);
          await autoCompleteChecklistItems(pipelineId, itemsToComplete, agent.id);
        }
        
        results.push({
          activeuser_id: agent.id,
          lagnname: agent.lagnname,
          pipeline_id: pipelineId,
          status: existingPipeline.length > 0 ? 'linked' : 'created',
          items_completed: itemsToComplete.length
        });
        
      } catch (error) {
        errors++;
        console.error(`❌ Error processing agent ${agent.lagnname}:`, error.message);
        results.push({
          activeuser_id: agent.id,
          lagnname: agent.lagnname,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log(`✅ Pending agent sync (Phase 1) complete: ${created} created, ${skipped} skipped, ${errors} errors`);

    // PHASE 2: Complete Attend Training + Activate Agent Number for agents now pending=0
    console.log('🔁 Phase 2: Completing Attend Training and Activate Agent Number for eligible pipelines...');

    // Fetch checklist item IDs
    const items = await db(`
      SELECT id, item_name FROM pipeline_checklist_items WHERE active = 1
    `);
    const attendItem = items.find(i => String(i.item_name).toLowerCase().includes('attend training'));
    const activateItem = items.find(i => String(i.item_name).toLowerCase().includes('activate agent number'));

    let phase2Completed = 0;
    if (attendItem && activateItem) {
      const pipelinesNeeding = await db(`
        SELECT p.id as pipeline_id, au.id as activeuser_id
        FROM pipeline p
        JOIN activeusers au ON au.pipeline_id = p.id
        WHERE au.pending = 0
          AND au.Active = 'y'
          AND au.managerActive = 'y'
          AND (
            NOT EXISTS (
              SELECT 1 FROM leads_released lr WHERE lr.userId = au.id
            )
            OR EXISTS (
              SELECT 1 FROM leads_released lr WHERE lr.userId = au.id AND lr.type = '1st Pack' AND lr.sent = 0
            )
          )
      `);

      for (const row of pipelinesNeeding) {
        // Mark both items complete if not already
        await autoCompleteChecklistItems(row.pipeline_id, [attendItem.id, activateItem.id], row.activeuser_id);
        phase2Completed++;
      }
    } else {
      console.log('⚠️  Could not find checklist items for "Attend Training" and/or "Activate Agent Number".');
    }

    console.log(`✅ Phase 2 complete: updated ${phase2Completed} pipeline(s)`);
    
    res.json({
      success: true,
      message: `Processed ${pendingAgents.length} pending agents`,
      created,
      linked,
      skipped,
      errors,
      phase2_completed: phase2Completed,
      results
    });
    
  } catch (error) {
    console.error('❌ Error in pending agent sync:', error);
    res.status(500).json({
      success: false,
      message: 'Error during pending agent sync',
      error: error.message
    });
  }
});

/**
 * Sync a specific pending agent
 * POST /api/pending-agent-sync/sync-agent
 * Body: { activeuser_id }
 */
router.post('/sync-agent', verifyToken, async (req, res) => {
  try {
    const { activeuser_id } = req.body;
    
    if (!activeuser_id) {
      return res.status(400).json({
        success: false,
        message: 'activeuser_id is required'
      });
    }
    
    // Get the agent
    const agents = await db(`
      SELECT id, lagnname, esid, mga, sa, ga, agtnum, pending, pipeline_id
      FROM activeusers
      WHERE id = ?
    `, [activeuser_id]);
    
    if (agents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    const agent = agents[0];
    
    if (agent.pipeline_id) {
      return res.json({
        success: true,
        message: 'Agent already linked to pipeline',
        pipeline_id: agent.pipeline_id
      });
    }
    
    // Create or link pipeline record (same logic as sync-all)
    const nameParts = parseLagnname(agent.lagnname);
    const step = determinePipelineStep(agent);
    
    // Get recruiting agent ID (sa -> ga -> mga priority)
    const recruitingAgentId = await getRecruitingAgentId(agent);
    
    const insertResult = await db(`
      INSERT INTO pipeline (
        recruiting_agent, recruit_first, recruit_last, recruit_middle, recruit_suffix,
        step, MGA, agentnum, code_to,
        date_added, date_last_updated
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        NOW(), NOW()
      )
    `, [
      recruitingAgentId || '', // recruiting_agent from sa -> ga -> mga
      nameParts.first,
      nameParts.last,
      nameParts.middle,
      nameParts.suffix,
      step,
      agent.mga || null,
      agent.agtnum || null,
      recruitingAgentId || null // code_to same as recruiting_agent
    ]);
    
    const pipelineId = insertResult.insertId;
    
    // Link to activeuser
    await db(`
      UPDATE activeusers
      SET pipeline_id = ?
      WHERE id = ?
    `, [pipelineId, agent.id]);
    
    // Add initial pipeline step
    await db(`
      INSERT INTO pipeline_steps (recruit_id, step, date_entered)
      VALUES (?, ?, NOW())
    `, [pipelineId, step]);
    
    // Auto-complete checklist items
    const itemsToComplete = await getItemsToComplete(agent, pipelineId);
    await autoCompleteChecklistItems(pipelineId, itemsToComplete, agent.id);
    
    res.json({
      success: true,
      message: 'Pipeline record created and linked',
      pipeline_id: pipelineId,
      items_completed: itemsToComplete.length
    });
    
  } catch (error) {
    console.error('❌ Error syncing agent:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing agent',
      error: error.message
    });
  }
});

module.exports = router;

