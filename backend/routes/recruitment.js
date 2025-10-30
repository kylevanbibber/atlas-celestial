const express = require('express');
const router = express.Router();
const db = require('../db.js');

/**
 * Auto-complete all checklist items from stages prior to the given stage
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
    
    // Get all stages before the current one
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
        SELECT stage_name, target_item_name, action
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
      // Check if already exists
      const existing = await db.query(`
        SELECT id, started_at FROM pipeline_checklist_progress
        WHERE recruit_id = ? AND checklist_item_id = ?
      `, [recruitId, item.id]);
      
      if (existing.length === 0) {
        // Insert new completion with started_at and completed_at set to same time
        await db.query(`
          INSERT INTO pipeline_checklist_progress 
          (recruit_id, checklist_item_id, completed, completed_by, started_at, completed_at)
          VALUES (?, ?, 1, NULL, ?, ?)
        `, [recruitId, item.id, now, now]);
      } else if (existing[0].completed === 0) {
        // Update to completed if not already - set started_at if null
        await db.query(`
          UPDATE pipeline_checklist_progress
          SET completed = 1, completed_by = NULL, 
              started_at = COALESCE(started_at, ?),
              completed_at = ?
          WHERE id = ?
        `, [now, now, existing[0].id]);
      }
    }
    
    console.log(`✅ Auto-completed ${allItems.length} prior stage items for recruit ${recruitId} at stage ${currentStage}`);
  } catch (error) {
    console.error('Error auto-completing prior stage items:', error);
    // Don't throw - this is a helper function, shouldn't block main operation
  }
}

// Get all recruits/applicants
router.get('/recruits', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.*, 
        u.lagnname,
        coded.lagnname as coded_to_name,
        au.Active as activeuser_active,
        au.managerActive as activeuser_manager_active,
        au.redeemed as redeemed,
        DATE_FORMAT(CONVERT_TZ(ps.date_entered, 'America/New_York', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') as current_stage_entered,
        DATE_FORMAT(CONVERT_TZ(p.date_added, 'America/New_York', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') as date_added_utc
      FROM pipeline p
      LEFT JOIN activeusers u ON p.recruiting_agent = u.id
      LEFT JOIN activeusers coded ON p.code_to = coded.id
      LEFT JOIN activeusers au ON au.pipeline_id = p.id
      LEFT JOIN pipeline_steps ps ON ps.recruit_id = p.id AND ps.date_exited IS NULL
      ORDER BY p.date_added DESC
    `;
    
    const result = await db.query(query);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching recruits:', error);
    res.status(500).json({ error: 'Failed to fetch recruits' });
  }
});

// Get recruits by recruiting agent
router.get('/recruits/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const query = `
      SELECT 
        p.*, 
        u.lagnname,
        coded.lagnname as coded_to_name,
        au.Active as activeuser_active,
        au.managerActive as activeuser_manager_active,
        au.redeemed as redeemed,
        DATE_FORMAT(CONVERT_TZ(ps.date_entered, 'America/New_York', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') as current_stage_entered,
        DATE_FORMAT(CONVERT_TZ(p.date_added, 'America/New_York', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') as date_added_utc
      FROM pipeline p
      LEFT JOIN activeusers u ON p.recruiting_agent = u.id
      LEFT JOIN activeusers coded ON p.code_to = coded.id
      LEFT JOIN activeusers au ON au.pipeline_id = p.id
      LEFT JOIN pipeline_steps ps ON ps.recruit_id = p.id AND ps.date_exited IS NULL
      WHERE p.recruiting_agent = ?
      ORDER BY p.date_added DESC
    `;
    
    const result = await db.query(query, [agentId]);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching recruits by agent:', error);
    res.status(500).json({ error: 'Failed to fetch recruits' });
  }
});

// Get recruits by team (multiple user IDs)
router.post('/recruits/team', async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array is required' });
    }
    
    const placeholders = userIds.map(() => '?').join(',');
    const query = `
      SELECT 
        p.*, 
        u.lagnname,
        coded.lagnname as coded_to_name,
        au.Active as activeuser_active,
        au.managerActive as activeuser_manager_active,
        au.redeemed as redeemed,
        DATE_FORMAT(CONVERT_TZ(ps.date_entered, 'America/New_York', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') as current_stage_entered,
        DATE_FORMAT(CONVERT_TZ(p.date_added, 'America/New_York', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') as date_added_utc
      FROM pipeline p
      LEFT JOIN activeusers u ON p.recruiting_agent = u.id
      LEFT JOIN activeusers coded ON p.code_to = coded.id
      LEFT JOIN activeusers au ON au.pipeline_id = p.id
      LEFT JOIN pipeline_steps ps ON ps.recruit_id = p.id AND ps.date_exited IS NULL
      WHERE p.recruiting_agent IN (${placeholders})
      ORDER BY p.date_added DESC
    `;
    
    const result = await db.query(query, userIds);
    
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
        step, email, phone, overview_time, hire, final_time, callback_time,
        resident_state, enrolled, course, expected_complete_date, current_progress,
        last_log_prelic, prelic_passed, prelic_cert, test_date, test_passed, test_cert,
        bg_date, compliance1, compliance2, compliance3, compliance4, compliance5, aob,
        resident_license_number, npn, agentnum, impact_setup, training_start_date,
        coded, code_to, eapp_username, impact_username, referral_source,
        Aspects, Concern, Spouse, CareerGoals, Compensation, WhyChoose, MGA,
        redeemed, password,
        date_added, date_last_updated
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
    `;

    const values = [
      recruiting_agent, recruit_first, recruit_middle, recruit_last, recruit_suffix,
      step || 'Careers Form', email, phone, overview_time, hire, final_time, callback_time,
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
    const selectQuery = `SELECT p.*, u.lagnname FROM pipeline p LEFT JOIN activeusers u ON p.recruiting_agent = u.id WHERE p.id = ?`;
    const selectResult = await db.query(selectQuery, [insertId]);
    
    // Auto-complete prior stage items if recruit is added to a later stage
    const recruitStep = step || 'Careers Form';
    await autoCompletePriorStageItems(insertId, recruitStep, resident_state);
    
    res.status(201).json(selectResult[0]);
  } catch (error) {
    console.error('Error adding recruit:', error);
    res.status(500).json({ error: 'Failed to add recruit' });
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
    
    // Add new step entry
    const insertStepQuery = `
      INSERT INTO pipeline_steps (recruit_id, step, date_entered) 
      VALUES (?, ?, NOW())
    `;
    await db.query(insertStepQuery, [id, step]);
    
    // Auto-complete prior stage items when moving to a new stage
    await autoCompletePriorStageItems(id, step, residentState);
    
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
      
      // Record new Licensing stage entry
      await db.query(`
        INSERT INTO pipeline_steps (recruit_id, step, date_entered)
        VALUES (?, ?, NOW())
      `, [id, targetStep]);
      
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
    
    // Delete pipeline_steps first (foreign key constraint)
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
    
    for (const req of stateRequirements) {
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
        finalItems = finalItems.map(item => {
          if (item.stage_name === req.stage_name && item.item_name === req.target_item_name) {
            return {
              ...item,
              item_description: req.override_description || item.item_description,
              is_required: req.override_required !== null ? req.override_required : item.is_required,
              item_type: req.override_type || item.item_type,
              item_options: req.override_options || item.item_options,
              url: req.url || item.url, // Add URL support
              state_modified: true
            };
          }
          return item;
        });
      } else if (req.action === 'add') {
        // Add new state-specific item
        finalItems.push({
          id: `state_${req.id}`, // Unique identifier for state-specific items
          stage_name: req.stage_name,
          item_name: req.item_name,
          item_description: req.item_description,
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
        DATE_FORMAT(CONVERT_TZ(ps.date_entered, 'America/New_York', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') as current_stage_entered,
        DATE_FORMAT(CONVERT_TZ(p.date_added, 'America/New_York', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') as date_added_utc
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

    // Insert into the pipeline_steps table
    await db.query(
      `INSERT INTO pipeline_steps (recruit_id, step, date_entered, date_exited) 
       VALUES (?, ?, NOW(), NULL)`,
      [recruit_id, "Careers Form"]
    );

    console.log('Recruit and pipeline step created successfully');

    // Send email notification if agentEmail is provided
    if (agentEmail) {
      console.log('Sending email to agent:', agentEmail);
      
      const emailService = require('../services/emailService');
      
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

module.exports = router; 