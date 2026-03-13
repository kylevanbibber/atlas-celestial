/**
 * =============================================================================
 * Sync Pending Agents to Pipeline
 * =============================================================================
 * 
 * This script processes new pending agents (pending = 1) in activeusers and:
 * 1. Attempts to match them to existing pipeline records
 * 2. Creates new pipeline records if no match exists
 * 3. Links activeusers.pipeline_id to the pipeline record
 * 4. Completes checklist items up to (but not including) "Attend Training"
 * 
 * Matching Logic:
 * - Parses lagnname (formats: "Last First", "Last First Middle", "Last First Suffix")
 * - Matches against pipeline.recruit_last, recruit_first, recruit_middle, recruit_suffix
 * - Also matches MGA between activeusers.mga and pipeline.MGA
 * 
 * Recruiter Assignment (for new pipeline records):
 * - Gets recruiter's lagnname from agent's hierarchy (SA → GA → MGA, first non-NULL)
 * - Looks up that lagnname in activeusers to get the recruiter's ID
 * - Stores the ID (not the lagnname) in both recruiting_agent and code_to fields
 * - If recruiter not found, both fields are set to NULL
 * 
 * Criteria:
 * - pending = 1
 * - Active = 'y'
 * - managerActive = 'y'
 * - esid within last 15 days
 * - pipeline_id IS NULL
 * 
 * =============================================================================
 */

const db = require('../db');

/**
 * Parse lagnname into components
 * Format can be: "Last First", "Last First Middle", "Last First Suffix", "Last First Middle Suffix"
 */
function parseLagnname(lagnname) {
  if (!lagnname) return null;
  
  const parts = lagnname.trim().split(/\s+/);
  if (parts.length < 2) return null;
  
  const result = {
    last: parts[0] || '',
    first: parts[1] || '',
    middle: '',
    suffix: ''
  };
  
  // If there are more than 2 parts, determine if they're middle name or suffix
  if (parts.length >= 3) {
    const suffixes = ['Jr', 'Jr.', 'SR', 'Sr.', 'II', 'III', 'IV', 'V'];
    const lastPart = parts[parts.length - 1];
    
    if (suffixes.some(s => s.toLowerCase() === lastPart.toLowerCase())) {
      result.suffix = lastPart;
      // Everything between first and suffix is middle name
      if (parts.length > 3) {
        result.middle = parts.slice(2, -1).join(' ');
      }
    } else {
      // No suffix, everything after first is middle name
      result.middle = parts.slice(2).join(' ');
    }
  }
  
  return result;
}

/**
 * Find matching pipeline record
 */
async function findMatchingPipeline(agent) {
  const parsed = parseLagnname(agent.lagnname);
  if (!parsed) return null;
  
  const query = `
    SELECT p.id, p.recruit_first, p.recruit_last, p.recruit_middle, p.recruit_suffix, p.MGA, p.step
    FROM pipeline p
    WHERE p.recruit_last = ?
      AND p.recruit_first = ?
      AND p.MGA = ?
      AND (
        (? = '' AND (p.recruit_middle IS NULL OR p.recruit_middle = ''))
        OR p.recruit_middle = ?
      )
      AND (
        (? = '' AND (p.recruit_suffix IS NULL OR p.recruit_suffix = ''))
        OR p.recruit_suffix = ?
      )
    LIMIT 1
  `;
  
  const results = await db.query(query, [
    parsed.last,
    parsed.first,
    agent.mga || '',
    parsed.middle,
    parsed.middle,
    parsed.suffix,
    parsed.suffix
  ]);
  
  return results.length > 0 ? results[0] : null;
}

/**
 * Create a new pipeline record for an agent
 */
async function createPipelineRecord(agent) {
  const parsed = parseLagnname(agent.lagnname);
  if (!parsed) {
    console.log(`   ⚠️  Could not parse lagnname: ${agent.lagnname}`);
    return null;
  }
  
  // Determine recruiting_agent and code_to from hierarchy (SA → GA → MGA priority)
  const recruiterLagnname = agent.sa || agent.ga || agent.mga || '';
  
  // Look up the recruiter's ID in activeusers
  // We store the ID (not the lagnname) in recruiting_agent and code_to
  let recruiterId = null;
  if (recruiterLagnname) {
    const recruiterResult = await db.query(
      'SELECT id FROM activeusers WHERE lagnname = ? LIMIT 1',
      [recruiterLagnname]
    );
    
    if (recruiterResult.length > 0) {
      recruiterId = recruiterResult[0].id;
    } else {
      console.log(`   ⚠️  Recruiter not found in activeusers: ${recruiterLagnname}`);
      // recruiterId remains NULL, which is acceptable - the pipeline record will still be created
    }
  }
  
  const insertQuery = `
    INSERT INTO pipeline (
      recruit_first,
      recruit_middle,
      recruit_last,
      recruit_suffix,
      phone,
      email,
      step,
      date_added,
      date_last_updated,
      recruiting_agent,
      code_to,
      MGA
    ) VALUES (?, ?, ?, ?, ?, ?, 'Training', NOW(), NOW(), ?, ?, ?)
  `;
  
  const result = await db.query(insertQuery, [
    parsed.first,
    parsed.middle,
    parsed.last,
    parsed.suffix,
    agent.phone || '',
    agent.email || '',
    recruiterId,
    recruiterId,
    agent.mga || ''
  ]);
  
  return {
    pipelineId: result.insertId,
    recruiterId: recruiterId
  };
}

/**
 * Record pipeline step entry
 */
async function recordPipelineStep(pipelineId, step) {
  await db.query(
    `INSERT INTO pipeline_steps (recruit_id, step, date_entered)
     VALUES (?, ?, NOW())`,
    [pipelineId, step]
  );
}

/**
 * Get checklist items in order
 */
async function getChecklistItems() {
  const query = `
    SELECT id, item_name, stage_name, item_order
    FROM pipeline_checklist_items
    WHERE active = 1
    ORDER BY 
      CASE stage_name
        WHEN 'Overview' THEN 1
        WHEN 'On-boarding' THEN 2
        WHEN 'Training' THEN 3
        ELSE 4
      END,
      item_order ASC
  `;
  
  return await db.query(query);
}

/**
 * Complete checklist items up to (but not including) "Attend Training"
 */
async function completeChecklistItems(pipelineId, allItems) {
  const itemsToComplete = [];
  
  for (const item of allItems) {
    // Complete all Overview and On-boarding items
    if (item.stage_name === 'Overview' || item.stage_name === 'On-boarding') {
      itemsToComplete.push(item);
    }
    // For Training stage, stop before "Attend Training"
    else if (item.stage_name === 'Training') {
      if (item.item_name.toLowerCase().includes('attend training')) {
        break; // Stop here, don't complete this one
      }
      itemsToComplete.push(item);
    }
  }
  
  // Insert completion records
  for (const item of itemsToComplete) {
    await db.query(
      `INSERT IGNORE INTO pipeline_checklist_progress 
       (recruit_id, checklist_item_id, completed, started_at, completed_at)
       VALUES (?, ?, 1, NOW(), NOW())`,
      [pipelineId, item.id]
    );
  }
  
  return itemsToComplete.length;
}

/**
 * Main sync function
 */
async function syncPendingAgents() {
  console.log('🔄 Starting pending agents sync...\n');
  
  try {
    // STEP 1: Find pending agents without pipeline_id
    console.log('📋 STEP 1: Finding pending agents without pipeline...');
    
    const pendingAgents = await db.query(`
      SELECT 
        id,
        lagnname,
        phone,
        email,
        mga,
        sa,
        ga,
        esid,
        pipeline_id
      FROM activeusers
      WHERE pending = 1
        AND Active = 'y'
        AND managerActive = 'y'
        AND clname = 'AGT'
        AND esid >= DATE_SUB(NOW(), INTERVAL 15 DAY)
        AND (pipeline_id IS NULL OR pipeline_id = 0)
    `);
    
    console.log(`   ✓ Found ${pendingAgents.length} pending agents without pipeline\n`);
    
    if (pendingAgents.length === 0) {
      console.log('✅ No pending agents need processing');
      return;
    }
    
    // STEP 2: Get all checklist items for completion
    console.log('📋 STEP 2: Loading checklist items...');
    const checklistItems = await getChecklistItems();
    console.log(`   ✓ Loaded ${checklistItems.length} checklist items\n`);
    
    // STEP 3: Process each agent
    console.log('📝 STEP 3: Processing agents...\n');
    
    let matched = 0;
    let created = 0;
    let linked = 0;
    let errors = 0;
    
    for (const agent of pendingAgents) {
      try {
        console.log(`   Processing: ${agent.lagnname} (ID: ${agent.id})`);
        
        // Try to find existing pipeline record
        const existingPipeline = await findMatchingPipeline(agent);
        
        let pipelineId;
        
        if (existingPipeline) {
          console.log(`      ✓ Matched to existing pipeline ${existingPipeline.id}`);
          pipelineId = existingPipeline.id;
          matched++;
        } else {
          console.log(`      → Creating new pipeline record`);
          const result = await createPipelineRecord(agent);
          if (!result) {
            console.log(`      ❌ Failed to create pipeline`);
            errors++;
            continue;
          }
          pipelineId = result.pipelineId;
          console.log(`      ✓ Created pipeline ${pipelineId}`);
          if (result.recruiterId) {
            const recruiterSource = agent.sa ? 'SA' : (agent.ga ? 'GA' : 'MGA');
            console.log(`      ✓ Set recruiting_agent = ${result.recruiterId} (from ${recruiterSource})`);
          }
          created++;
          
          // Record pipeline step entry for new records
          await recordPipelineStep(pipelineId, 'Training');
          console.log(`      ✓ Recorded Training stage entry`);
        }
        
        // Link activeusers to pipeline
        await db.query(
          'UPDATE activeusers SET pipeline_id = ? WHERE id = ?',
          [pipelineId, agent.id]
        );
        console.log(`      ✓ Linked activeusers.pipeline_id = ${pipelineId}`);
        linked++;
        
        // Complete checklist items (only if we created a new pipeline or if existing has no items)
        const existingProgress = await db.query(
          'SELECT COUNT(*) as count FROM pipeline_checklist_progress WHERE recruit_id = ?',
          [pipelineId]
        );
        
        if (existingProgress[0].count === 0) {
          const completedCount = await completeChecklistItems(pipelineId, checklistItems);
          console.log(`      ✓ Completed ${completedCount} checklist items\n`);
        } else {
          console.log(`      → Pipeline already has checklist progress, skipping\n`);
        }
        
      } catch (error) {
        console.error(`      ❌ Error processing ${agent.lagnname}:`, error.message);
        errors++;
      }
    }
    
    // STEP 4: Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Pending agents sync completed!');
    console.log(`   Total agents processed: ${pendingAgents.length}`);
    console.log(`   Matched to existing pipeline: ${matched}`);
    console.log(`   Created new pipeline: ${created}`);
    console.log(`   Linked to activeusers: ${linked}`);
    console.log(`   Errors: ${errors}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Error during pending agents sync:', error);
    throw error;
  }
}

// Export the sync function
module.exports = { syncPendingAgents };

// Run the sync if called directly
if (require.main === module) {
  syncPendingAgents()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

