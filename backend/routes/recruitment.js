const express = require('express');
const router = express.Router();
const db = require('../db.js');

// Get all recruits/applicants
router.get('/recruits', async (req, res) => {
  try {
    const query = `
      SELECT p.*, u.lagnname 
      FROM pipeline p
      LEFT JOIN activeusers u ON p.recruiting_agent = u.id
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
      SELECT p.*, u.lagnname 
      FROM pipeline p
      LEFT JOIN activeusers u ON p.recruiting_agent = u.id
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
      SELECT p.*, u.lagnname 
      FROM pipeline p
      LEFT JOIN activeusers u ON p.recruiting_agent = u.id
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
      MGA
    } = req.body;

    const query = `
      INSERT INTO pipeline (
        recruiting_agent, recruit_first, recruit_last, recruit_middle, recruit_suffix,
        step, email, phone, overview_time, hire, final_time, callback_time,
        resident_state, enrolled, course, expected_complete_date, current_progress,
        last_log_prelic, prelic_passed, prelic_cert, test_date, test_passed, test_cert,
        bg_date, compliance1, compliance2, compliance3, compliance4, compliance5, aob,
        resident_license_number, npn, agentnum, impact_setup, training_start_date,
        coded, code_to, eapp_username, impact_username, referral_source,
        Aspects, Concern, Spouse, CareerGoals, Compensation, WhyChoose, MGA,
        date_added, date_last_updated
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
    `;

    const values = [
      recruiting_agent, recruit_first, recruit_last, recruit_middle, recruit_suffix,
      step || 'Careers Form', email, phone, overview_time, hire, final_time, callback_time,
      resident_state, enrolled, course, expected_complete_date, current_progress,
      last_log_prelic, prelic_passed, prelic_cert, test_date, test_passed, test_cert,
      bg_date, compliance1, compliance2, compliance3, compliance4, compliance5, aob,
      resident_license_number, npn, agentnum, impact_setup, training_start_date,
      coded, code_to, eapp_username, impact_username, referral_source,
      Aspects, Concern, Spouse, CareerGoals, Compensation, WhyChoose, MGA
    ];

    const result = await db.query(query, values);
    
    // Get the inserted record
    const insertId = result.insertId;
    const selectQuery = `SELECT p.*, u.lagnname FROM pipeline p LEFT JOIN activeusers u ON p.recruiting_agent = u.id WHERE p.id = ?`;
    const selectResult = await db.query(selectQuery, [insertId]);
    
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

    // First, get the current step to record the exit time
    const getCurrentStepQuery = `SELECT step FROM pipeline WHERE id = ?`;
    const currentStepResult = await db.query(getCurrentStepQuery, [id]);
    
    if (currentStepResult.length === 0) {
      return res.status(404).json({ error: 'Recruit not found' });
    }
    
    const currentStep = currentStepResult[0].step;
    
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

    const query = `
      UPDATE pipeline 
      SET resident_state = ?, enrolled = ?, course = ?, expected_complete_date = ?, date_last_updated = NOW() 
      WHERE id = ?
    `;
    
    const result = await db.query(query, [resident_state, enrolled, course, expected_complete_date, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Recruit not found' });
    }
    
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

module.exports = router; 