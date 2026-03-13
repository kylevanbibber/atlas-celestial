/**
 * Seed pipeline records for agents who have completed their first lead pack
 * 
 * Finds agents who are:
 * - pending = 0 (activated)
 * - released = 0 (not yet released)
 * - Active = 'y'
 * - managerActive = 'y'
 * - IN leads_released with type = "1st Pack" and sent = 1 (received first pack)
 * 
 * Creates/updates pipeline records and progresses them appropriately
 * 
 * Usage: node backend/scripts/seed-post-first-pack-agents.js
 */

const db = require('../config/database');

// Helper function to get stage order
async function getStageOrder() {
  const stages = await db.query(`
    SELECT stage_name, position_after
    FROM pipeline_stage_definitions
    WHERE is_terminal = 0
    ORDER BY id
  `);

  const stageOrder = [];
  
  // Find first stage
  let current = stages.find(s => s.position_after === null);
  const visited = new Set();

  while (current && !visited.has(current.stage_name)) {
    stageOrder.push(current.stage_name);
    visited.add(current.stage_name);
    current = stages.find(s => s.position_after === current.stage_name);
  }

  return stageOrder;
}

// Helper function to auto-complete prior stage items
async function autoCompletePriorStages(recruitId, targetStage) {
  const stageOrder = await getStageOrder();
  const targetIndex = stageOrder.indexOf(targetStage);
  
  if (targetIndex === -1 || targetIndex === 0) {
    return 0;
  }

  const priorStages = stageOrder.slice(0, targetIndex);
  
  if (priorStages.length === 0) {
    return 0;
  }

  // Get all checklist items from prior stages
  const placeholders = priorStages.map(() => '?').join(',');
  const items = await db.query(`
    SELECT id, stage_name, item_name
    FROM pipeline_checklist_items
    WHERE stage_name IN (${placeholders})
    AND active = 1
    ORDER BY stage_name, item_order
  `, priorStages);

  let completedCount = 0;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  for (const item of items) {
    // Check if already exists
    const existing = await db.query(`
      SELECT id, completed FROM pipeline_checklist_progress
      WHERE recruit_id = ? AND checklist_item_id = ?
    `, [recruitId, item.id]);

    if (existing.length === 0) {
      // Insert as completed
      await db.query(`
        INSERT INTO pipeline_checklist_progress
        (recruit_id, checklist_item_id, completed, started_at, completed_at)
        VALUES (?, ?, 1, ?, ?)
      `, [recruitId, item.id, now, now]);
      completedCount++;
    } else if (existing[0].completed === 0) {
      // Update to completed
      await db.query(`
        UPDATE pipeline_checklist_progress
        SET completed = 1,
            started_at = COALESCE(started_at, ?),
            completed_at = ?
        WHERE id = ?
      `, [now, now, existing[0].id]);
      completedCount++;
    }
  }

  return completedCount;
}

// Helper function to complete Training items before "Attend Training"
async function completeTrainingItemsBeforeAttend(recruitId) {
  try {
    // Find the item_order of "Attend Training"
    const attendTraining = await db.query(`
      SELECT item_order FROM pipeline_checklist_items
      WHERE stage_name = 'Training' 
      AND item_name = 'Attend Training'
      AND active = 1
      LIMIT 1
    `);

    if (attendTraining.length === 0) {
      console.log('   ⚠️  Warning: "Attend Training" checklist item not found');
      return 0;
    }

    const attendOrder = attendTraining[0].item_order;

    // Get all Training items with item_order less than "Attend Training"
    const trainingItems = await db.query(`
      SELECT id, item_name, item_order
      FROM pipeline_checklist_items
      WHERE stage_name = 'Training'
      AND item_order < ?
      AND active = 1
      ORDER BY item_order
    `, [attendOrder]);

    let completedCount = 0;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    for (const item of trainingItems) {
      // Check if already exists
      const existing = await db.query(`
        SELECT id, completed FROM pipeline_checklist_progress
        WHERE recruit_id = ? AND checklist_item_id = ?
      `, [recruitId, item.id]);

      if (existing.length === 0) {
        // Insert as completed
        await db.query(`
          INSERT INTO pipeline_checklist_progress
          (recruit_id, checklist_item_id, completed, started_at, completed_at)
          VALUES (?, ?, 1, ?, ?)
        `, [recruitId, item.id, now, now]);
        completedCount++;
      } else if (existing[0].completed === 0) {
        // Update to completed
        await db.query(`
          UPDATE pipeline_checklist_progress
          SET completed = 1,
              started_at = COALESCE(started_at, ?),
              completed_at = ?
          WHERE id = ?
        `, [now, now, existing[0].id]);
        completedCount++;
      }
    }

    return completedCount;
  } catch (error) {
    console.error('   Error completing Training items:', error.message);
    return 0;
  }
}

async function seedPostFirstPackAgents() {
  try {
    console.log('🔍 Finding agents who have received their first lead pack...\n');

    // STEP 0: Cleanup orphaned checklist progress records
    console.log('🧹 Cleaning up orphaned checklist progress records...');
    const cleanupResult = await db.query(`
      DELETE pcp
      FROM pipeline_checklist_progress pcp
      LEFT JOIN pipeline p ON pcp.recruit_id = p.id
      WHERE p.id IS NULL
    `);
    const cleanedCount = cleanupResult.affectedRows || 0;
    console.log(`   ✓ Cleaned up ${cleanedCount} orphaned checklist progress records\n`);

    console.log(`📊 Will keep agents at Training stage and complete items before "Attend Training"\n`);

    // Find agents who have received first pack
    const query = `
      SELECT 
        au.id,
        au.lagnname,
        au.agtnum,
        au.mga,
        au.pipeline_id,
        lr.sent_date
      FROM activeusers au
      JOIN leads_released lr ON lr.userId = au.id
      WHERE au.pending = 0
        AND au.released = 0
        AND au.Active = 'y'
        AND au.managerActive = 'y'
        AND lr.type = '1st Pack'
        AND lr.sent = 1
      ORDER BY au.lagnname
    `;

    const agents = await db.query(query);

    if (agents.length === 0) {
      console.log('✅ No agents found who have received first pack');
      process.exit(0);
    }

    console.log(`📊 Found ${agents.length} agents who have received first lead pack:\n`);
    agents.forEach((agent, i) => {
      const pipelineStatus = agent.pipeline_id ? `Pipeline: ${agent.pipeline_id}` : 'No pipeline';
      const sentDate = agent.sent_date ? `Sent: ${agent.sent_date}` : 'Sent date unknown';
      console.log(`   ${i + 1}. ${agent.lagnname} (${agent.agtnum}) - ${pipelineStatus} - ${sentDate}`);
    });

    console.log(`\n⚙️  Creating/updating pipeline records to ${nextStage} stage...\n`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let totalItemsCompleted = 0;

    for (const agent of agents) {
      try {
        // Split name to get first and last
        const nameParts = agent.lagnname ? agent.lagnname.split(' ').filter(Boolean) : [];
        const lastName = nameParts[0] || '';
        const firstName = nameParts[1] || '';

        // Check if pipeline_id exists but pipeline record doesn't (orphaned reference)
        let needsNewPipeline = !agent.pipeline_id;
        
        if (agent.pipeline_id) {
          const pipelineData = await db.query(
            "SELECT id, step FROM pipeline WHERE id = ?",
            [agent.pipeline_id]
          );
          
          if (pipelineData.length === 0) {
            console.log(`   ⚠️  Orphaned pipeline_id ${agent.pipeline_id} for ${agent.lagnname} - will create new pipeline`);
            needsNewPipeline = true;
          }
        }
        
        if (needsNewPipeline) {
          // Create new pipeline record at Training stage
          const pipelineResult = await db.query(`
            INSERT INTO pipeline (
              recruit_first, recruit_last, step, date_added,
              recruiting_agent, agentnum, MGA
            ) VALUES (?, ?, 'Training', NOW(), ?, ?, ?)
          `, [firstName, lastName, agent.mga || null, agent.agtnum, agent.mga || null]);

          const pipelineId = pipelineResult.insertId;

          // Link to activeuser
          await db.query(
            "UPDATE activeusers SET pipeline_id = ? WHERE id = ?",
            [pipelineId, agent.id]
          );

          // Record pipeline step
          await db.query(`
            INSERT INTO pipeline_steps (recruit_id, step, date_entered)
            VALUES (?, 'Training', NOW())
          `, [pipelineId]);

          // Auto-complete all prior stage items (before Training)
          const priorItemsCompleted = await autoCompletePriorStages(pipelineId, 'Training');
          totalItemsCompleted += priorItemsCompleted;

          // Complete Training items before "Attend Training"
          const trainingItemsCompleted = await completeTrainingItemsBeforeAttend(pipelineId);
          totalItemsCompleted += trainingItemsCompleted;

          console.log(`   ✅ Created pipeline ${pipelineId} for ${agent.lagnname} at Training (${priorItemsCompleted + trainingItemsCompleted} items completed)`);
          created++;
        } else {
          // Pipeline exists - check current stage
          const pipelineData = await db.query(
            "SELECT id, step FROM pipeline WHERE id = ?",
            [agent.pipeline_id]
          );

          if (pipelineData.length === 0) {
            console.log(`   ⚠️  Pipeline ${agent.pipeline_id} not found for ${agent.lagnname}`);
            skipped++;
            continue;
          }

          const currentStep = pipelineData[0].step;
          const stageOrder = await getStageOrder();
          const currentIndex = stageOrder.indexOf(currentStep);
          const trainingIndex = stageOrder.indexOf('Training');

          // If at a stage before Training, move to Training
          if (currentIndex < trainingIndex && currentIndex !== -1) {
            // Update to Training stage
            await db.query(`
              UPDATE pipeline SET step = 'Training', date_last_updated = NOW()
              WHERE id = ?
            `, [agent.pipeline_id]);

            // Close previous stage
            await db.query(`
              UPDATE pipeline_steps
              SET date_exited = NOW()
              WHERE recruit_id = ? AND step = ? AND date_exited IS NULL
            `, [agent.pipeline_id, currentStep]);

            // Record new stage
            await db.query(`
              INSERT INTO pipeline_steps (recruit_id, step, date_entered)
              VALUES (?, 'Training', NOW())
            `, [agent.pipeline_id]);

            // Auto-complete all prior stage items (before Training)
            const priorItemsCompleted = await autoCompletePriorStages(agent.pipeline_id, 'Training');
            totalItemsCompleted += priorItemsCompleted;

            // Complete Training items before "Attend Training"
            const trainingItemsCompleted = await completeTrainingItemsBeforeAttend(agent.pipeline_id);
            totalItemsCompleted += trainingItemsCompleted;

            console.log(`   ✅ Updated pipeline ${agent.pipeline_id} for ${agent.lagnname} (${currentStep} → Training, ${priorItemsCompleted + trainingItemsCompleted} items completed)`);
            updated++;
          } else if (currentStep === 'Training') {
            // Already at Training - just ensure items before "Attend Training" are completed
            const priorItemsCompleted = await autoCompletePriorStages(agent.pipeline_id, 'Training');
            const trainingItemsCompleted = await completeTrainingItemsBeforeAttend(agent.pipeline_id);
            totalItemsCompleted += priorItemsCompleted + trainingItemsCompleted;
            
            if (priorItemsCompleted + trainingItemsCompleted > 0) {
              console.log(`   ✓ Pipeline ${agent.pipeline_id} for ${agent.lagnname} already at Training (completed ${priorItemsCompleted + trainingItemsCompleted} missing items)`);
              updated++;
            } else {
              console.log(`   ⏭️  Skipped ${agent.lagnname} - already at Training with items complete`);
              skipped++;
            }
          } else {
            // Already beyond Training stage
            console.log(`   ⏭️  Skipped ${agent.lagnname} - already at ${currentStep} stage (beyond Training)`);
            skipped++;
          }
        }
      } catch (err) {
        console.error(`   ❌ Error processing ${agent.lagnname}: ${err.message}`);
        skipped++;
      }
    }

    console.log('\n📈 Pipeline Seeding Summary:');
    console.log(`   ✅ Created: ${created}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📊 Total agents: ${agents.length}`);
    console.log(`   ✓ Checklist items completed: ${totalItemsCompleted}`);

    console.log('\n✅ Seeding complete!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error seeding pipeline:', error);
    process.exit(1);
  }
}

// Run the seeding
seedPostFirstPackAgents();

