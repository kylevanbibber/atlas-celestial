const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');

// Get available variables for SMS templates
router.get('/variables', verifyToken, async (req, res) => {
  try {
    // Define available variables organized by category
    const variables = {
      recruit: [
        { key: 'recruit_first', label: 'First Name', example: 'John' },
        { key: 'recruit_middle', label: 'Middle Name', example: 'M' },
        { key: 'recruit_last', label: 'Last Name', example: 'Doe' },
        { key: 'recruit_suffix', label: 'Suffix', example: 'Jr.' },
        { key: 'email', label: 'Email', example: 'john@example.com' },
        { key: 'phone', label: 'Phone', example: '(555) 123-4567' },
        { key: 'resident_state', label: 'State', example: 'FL' },
        { key: 'resident_license_number', label: 'License Number', example: 'L123456' },
        { key: 'npn', label: 'NPN', example: '12345678' },
        { key: 'agentnum', label: 'Agent Number', example: 'A12345' },
        { key: 'referral_source', label: 'Referral Source', example: 'Indeed' },
        { key: 'MGA', label: 'MGA', example: 'Smith Agency' }
      ],
      dates: [
        { key: 'overview_time', label: 'Overview Time', example: '2025-01-15 10:00:00' },
        { key: 'callback_time', label: 'Callback Time', example: '2025-01-16 14:00:00' },
        { key: 'final_time', label: 'Final Interview Time', example: '2025-01-17 09:00:00' },
        { key: 'hire', label: 'Hire Date', example: '2025-01-20' },
        { key: 'expected_complete_date', label: 'Expected Complete Date', example: '2025-02-01' },
        { key: 'training_start_date', label: 'Training Start Date', example: '2025-01-22' },
        { key: 'test_date', label: 'Test Date', example: '2025-01-25' },
        { key: 'bg_date', label: 'Background Check Date', example: '2025-01-18' }
      ],
      licensing: [
        { key: 'enrolled', label: 'Enrolled Status', example: 'Yes' },
        { key: 'course', label: 'Course', example: 'Life & Health' },
        { key: 'current_progress', label: 'Current Progress', example: '75%' },
        { key: 'prelic_passed', label: 'Pre-Licensing Passed', example: 'Yes' },
        { key: 'prelic_cert', label: 'Pre-Licensing Cert', example: 'CERT123' },
        { key: 'test_passed', label: 'Test Passed', example: 'Yes' },
        { key: 'test_cert', label: 'Test Certificate', example: 'TEST456' }
      ],
      onboarding: [
        { key: 'coded', label: 'Coded Status', example: 'Yes' },
        { key: 'code_to', label: 'Code To', example: 'Manager Name' },
        { key: 'eapp_username', label: 'eApp Username', example: 'jdoe123' },
        { key: 'impact_username', label: 'Impact Username', example: 'john.doe' },
        { key: 'impact_setup', label: 'Impact Setup', example: 'Complete' }
      ],
      compliance: [
        { key: 'compliance1', label: 'Compliance 1', example: 'Complete' },
        { key: 'compliance2', label: 'Compliance 2', example: 'Pending' },
        { key: 'compliance3', label: 'Compliance 3', example: 'Complete' },
        { key: 'compliance4', label: 'Compliance 4', example: 'Complete' },
        { key: 'compliance5', label: 'Compliance 5', example: 'N/A' },
        { key: 'aob', label: 'AOB', example: 'Signed' }
      ],
      profile: [
        { key: 'Aspects', label: 'Aspects', example: 'Flexibility, Income' },
        { key: 'Concern', label: 'Concerns', example: 'Training time' },
        { key: 'Spouse', label: 'Spouse Info', example: 'Jane Doe' },
        { key: 'CareerGoals', label: 'Career Goals', example: 'Build agency' },
        { key: 'Compensation', label: 'Compensation Expectations', example: '$50k+' },
        { key: 'WhyChoose', label: 'Why Choose Us', example: 'Training support' }
      ],
      agent: [
        { key: 'recruiting_agent', label: 'Recruiting Agent', example: 'Agent Name' },
        { key: 'manager_lagnname', label: 'Manager Full Name (lagnname)', example: 'Smith John A' },
        { key: 'manager_screen_name', label: 'Manager Screen Name', example: 'John Smith' },
        { key: 'manager_email', label: 'Manager Email', example: 'john.smith@example.com' },
        { key: 'manager_phone', label: 'Manager Phone', example: '(555) 123-4567' }
      ],
      system: [
        { key: 'current_date', label: 'Current Date', example: '2025-01-15' },
        { key: 'current_time', label: 'Current Time', example: '10:30 AM' },
        { key: 'current_datetime', label: 'Current Date & Time', example: '2025-01-15 10:30 AM' }
      ]
    };

    res.json({
      success: true,
      variables
    });
  } catch (error) {
    console.error('[SMS Template Variables] Error fetching variables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch variables',
      error: error.message
    });
  }
});

// Get checklist items that can be used as variables
router.get('/checklist-variables', verifyToken, async (req, res) => {
  try {
    const { query } = require('../db');
    
    // Get all active checklist items
    const items = await query(`
      SELECT 
        id,
        stage_name,
        item_name,
        item_description,
        item_type
      FROM pipeline_checklist_items
      WHERE active = 1
      ORDER BY stage_name, item_order
    `);

    // Format for variable picker
    const checklistVariables = items.map(item => ({
      key: `checklist_${item.id}`,
      label: `${item.stage_name}: ${item.item_name}`,
      example: item.item_type === 'checkbox' ? 'Complete' : 'Value',
      stage: item.stage_name,
      itemType: item.item_type
    }));

    res.json({
      success: true,
      variables: checklistVariables
    });
  } catch (error) {
    console.error('[SMS Template Variables] Error fetching checklist variables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch checklist variables',
      error: error.message
    });
  }
});

// Get state requirements that can be used as variables
router.get('/state-requirement-variables', verifyToken, async (req, res) => {
  try {
    const { query } = require('../db');
    
    // Get all active state requirements
    const requirements = await query(`
      SELECT DISTINCT
        state,
        stage_name,
        target_item_name,
        instructions
      FROM pipeline_state_requirements
      WHERE active = 1
      ORDER BY state, stage_name
    `);

    // Format for variable picker
    const stateReqVariables = requirements.map(req => ({
      key: `state_req_${req.state}_${req.stage_name}_${req.target_item_name}`.replace(/\s+/g, '_'),
      label: `${req.state} - ${req.stage_name}: ${req.target_item_name}`,
      example: req.instructions || 'Requirement info',
      state: req.state,
      stage: req.stage_name
    }));

    res.json({
      success: true,
      variables: stateReqVariables
    });
  } catch (error) {
    console.error('[SMS Template Variables] Error fetching state requirement variables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch state requirement variables',
      error: error.message
    });
  }
});

module.exports = router;

