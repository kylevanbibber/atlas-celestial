/**
 * Sync "Activate Agent Number" Checklist Item with activeusers.pending Status
 * 
 * This script checks pipeline records where "Activate Agent Number" is not yet
 * completed, and if the agent's pending status in activeusers has changed to 0,
 * it automatically completes that checklist item.
 * 
 * Purpose: Ensure agents who have been activated are properly reflected in the
 * pipeline checklist, even if the activation happened outside the normal flow.
 * 
 * Usage:
 *   node backend/scripts/sync-activate-agent-number.js
 * 
 * Can be run:
 * - As a one-time sync to fix historical data
 * - As a scheduled cron job (e.g., daily)
 * - After bulk imports or data migrations
 */

const db = require('../db');

async function syncActivateAgentNumber() {
  console.log('🔄 Starting "Activate Agent Number" sync...\n');
  
  try {
    // STEP 1: Find the "Activate Agent Number" checklist item
    console.log('📋 STEP 1: Finding "Activate Agent Number" checklist item...');
    const checklistItems = await db.query(`
      SELECT id, item_name, stage_name
      FROM pipeline_checklist_items 
      WHERE (item_name LIKE '%Activate Agent Number%' 
             OR item_name LIKE '%Agent Number%')
      AND active = 1
      LIMIT 1
    `);
    
    if (checklistItems.length === 0) {
      console.log('❌ ERROR: "Activate Agent Number" checklist item not found');
      console.log('   Please create this item in pipeline_checklist_items first');
      return;
    }
    
    const activateItemId = checklistItems[0].id;
    const itemName = checklistItems[0].item_name;
    const stageName = checklistItems[0].stage_name;
    console.log(`   ✓ Found: "${itemName}" (ID: ${activateItemId}, Stage: ${stageName})\n`);
    
    // STEP 2: Get count of agents who need syncing
    console.log('📊 STEP 2: Analyzing agents with pending = 0...');
    const analysisResult = await db.query(`
      SELECT 
        COUNT(*) as total_pending_0_agents,
        SUM(CASE WHEN pcp.completed = 0 OR pcp.completed IS NULL THEN 1 ELSE 0 END) as not_completed,
        SUM(CASE WHEN pcp.completed = 1 THEN 1 ELSE 0 END) as already_completed
      FROM activeusers au
      JOIN pipeline p ON au.pipeline_id = p.id
      LEFT JOIN pipeline_checklist_progress pcp ON pcp.recruit_id = p.id 
        AND pcp.checklist_item_id = ?
      WHERE au.pending = 0
        AND au.clname = 'AGT'
        AND au.Active = 'y'
        AND au.managerActive = 'y'
    `, [activateItemId]);
    
    const stats = analysisResult[0];
    console.log(`   Total agents with pending = 0: ${stats.total_pending_0_agents}`);
    console.log(`   Already completed: ${stats.already_completed || 0}`);
    console.log(`   Need completion: ${stats.not_completed || 0}\n`);
    
    if (stats.not_completed === 0) {
      console.log('✅ All agents are already synced. No updates needed.');
      return;
    }
    
    // STEP 3: Insert new completion records
    console.log('📝 STEP 3: Creating new completion records...');
    const insertResult = await db.query(`
      INSERT IGNORE INTO pipeline_checklist_progress 
      (recruit_id, checklist_item_id, completed, started_at, completed_at)
      SELECT 
        p.id as recruit_id,
        ? as checklist_item_id,
        1 as completed,
        NOW() as started_at,
        NOW() as completed_at
      FROM activeusers au
      JOIN pipeline p ON au.pipeline_id = p.id
      WHERE au.pending = 0
        AND au.clname = 'AGT'
        AND au.Active = 'y'
        AND au.managerActive = 'y'
        AND NOT EXISTS (
            SELECT 1 
            FROM pipeline_checklist_progress pcp
            WHERE pcp.recruit_id = p.id 
              AND pcp.checklist_item_id = ?
        )
    `, [activateItemId, activateItemId]);
    
    const insertCount = insertResult.affectedRows || 0;
    console.log(`   ✓ Created ${insertCount} new completion records\n`);
    
    // STEP 4: Update existing incomplete records
    console.log('🔄 STEP 4: Updating existing incomplete records...');
    const updateResult = await db.query(`
      UPDATE pipeline_checklist_progress pcp
      JOIN pipeline p ON pcp.recruit_id = p.id
      JOIN activeusers au ON au.pipeline_id = p.id
      SET pcp.completed = 1,
          pcp.started_at = COALESCE(pcp.started_at, NOW()),
          pcp.completed_at = NOW()
      WHERE au.pending = 0
        AND au.clname = 'AGT'
        AND au.Active = 'y'
        AND au.managerActive = 'y'
        AND pcp.checklist_item_id = ?
        AND pcp.completed = 0
    `, [activateItemId]);
    
    const updateCount = updateResult.affectedRows || 0;
    console.log(`   ✓ Updated ${updateCount} existing records to completed\n`);
    
    // STEP 5: Verify results
    console.log('✅ STEP 5: Verifying results...');
    const verifyResult = await db.query(`
      SELECT 
        COUNT(*) as total_agents,
        SUM(CASE WHEN pcp.completed = 1 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN pcp.completed = 0 OR pcp.completed IS NULL THEN 1 ELSE 0 END) as not_completed
      FROM activeusers au
      JOIN pipeline p ON au.pipeline_id = p.id
      LEFT JOIN pipeline_checklist_progress pcp ON pcp.recruit_id = p.id 
        AND pcp.checklist_item_id = ?
      WHERE au.pending = 0
        AND au.clname = 'AGT'
        AND au.Active = 'y'
        AND au.managerActive = 'y'
    `, [activateItemId]);
    
    const finalStats = verifyResult[0];
    const completionRate = finalStats.total_agents > 0 
      ? ((finalStats.completed / finalStats.total_agents) * 100).toFixed(1)
      : 0;
    
    console.log(`   Total agents: ${finalStats.total_agents}`);
    console.log(`   Completed: ${finalStats.completed}`);
    console.log(`   Not completed: ${finalStats.not_completed}`);
    console.log(`   Completion rate: ${completionRate}%\n`);
    
    // STEP 6: Show any remaining issues
    if (finalStats.not_completed > 0) {
      console.log('⚠️  STEP 6: Agents still needing attention:');
      const remainingIssues = await db.query(`
        SELECT 
          au.id,
          au.lagnname,
          au.agtnum,
          au.pending,
          p.id as pipeline_id,
          p.step as pipeline_stage
        FROM activeusers au
        JOIN pipeline p ON au.pipeline_id = p.id
        LEFT JOIN pipeline_checklist_progress pcp ON pcp.recruit_id = p.id 
          AND pcp.checklist_item_id = ?
        WHERE au.pending = 0
          AND au.clname = 'AGT'
          AND au.Active = 'y'
          AND au.managerActive = 'y'
          AND (pcp.completed IS NULL OR pcp.completed = 0)
        LIMIT 10
      `, [activateItemId]);
      
      remainingIssues.forEach((agent, index) => {
        console.log(`   ${index + 1}. ${agent.lagnname} (ID: ${agent.id}, Pipeline: ${agent.pipeline_id})`);
      });
      
      if (remainingIssues.length > 0) {
        console.log('   These agents may need manual review.\n');
      }
    }
    
    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Sync completed successfully!');
    console.log(`   Records created: ${insertCount}`);
    console.log(`   Records updated: ${updateCount}`);
    console.log(`   Total changes: ${insertCount + updateCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Error during sync:', error);
  }
}

// Export the sync function
module.exports = { syncActivateAgentNumber };

// Run the sync if called directly
if (require.main === module) {
  syncActivateAgentNumber();
}

