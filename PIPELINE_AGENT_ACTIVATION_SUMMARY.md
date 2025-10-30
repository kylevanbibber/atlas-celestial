# Pipeline Agent Activation Automation - Complete Summary

## Overview

This document describes the complete automation system for progressing pending agents through the pipeline when they are activated in the system.

## The Process

### What Triggers Activation?
When the **Daily New Associates Report** email is processed:
1. Python processor (`associates_processor.py`) reads the Excel attachment
2. For each agent in the report, the system checks if they exist in `activeusers` with `pending = 1`
3. If they do, their status is updated to `pending = 0` (activated)
4. **Pipeline automation is triggered automatically**

### What Happens Automatically?

#### If Agent Has a Pipeline Record:
```
1. Move to "Training" stage
2. Complete "Activate Agent Number" checklist item  
3. Auto-complete all prior stage checklist items
4. Record stage transition in pipeline_steps
5. Track completion times for all items
```

#### If Agent Has No Pipeline Record:
```
1. Create new pipeline record at "Training" stage
2. Link to activeusers via pipeline_id
3. Auto-complete ALL checklist items from prior stages:
   - Careers Form items
   - Phone Screen items
   - Virtual Interview items
   - Background Check items
   - Pre-Licensing items
   - Licensing items
   - On-boarding items
   - Including "Activate Agent Number"
4. Record initial stage entry
5. Set up time tracking for all items
```

## System-Controlled Checklist Items

Two checklist items are **system-controlled** (cannot be manually checked):

### 1. Receive Agent Number
- **When it's completed**: Set by the system when an agent number is assigned
- **Stage**: Typically in "On-boarding"
- **Visual indicator**: Purple "System" badge in UI
- **Backend**: Marked in `PipelineChecklistDetails.js` via `isSystemControlled()` function

### 2. Activate Agent Number  
- **When it's completed**: Automatically when `pending` changes from 1 to 0
- **Stage**: "On-boarding"
- **Visual indicator**: Purple "System" badge in UI
- **Backend**: Marked in `PipelineChecklistDetails.js` via `isSystemControlled()` function
- **Automation**: Handled by `python/processors/pipeline_automation.py`

## Files Modified/Created

### Python Files (Backend Automation)

#### New Files:
- **`python/processors/pipeline_automation.py`** - Core automation logic
  - `activate_agent_in_pipeline()` - Main entry point
  - `create_pipeline_for_activated_agent()` - Create new pipeline at Training
  - `update_pipeline_for_activated_agent()` - Update existing pipeline
  - `auto_complete_prior_stages()` - Complete all prior checklist items
  - `check_and_activate_agent()` - Check status change and trigger

#### Modified Files:
- **`python/processors/associates_processor.py`**
  - Added import of `pipeline_automation` module
  - Added tracking of `was_pending` status before update
  - Added call to `check_and_activate_agent()` after status change
  - Enhanced logging for activated agents

### Frontend Files (UI)

#### Modified Files:
- **`atlas/frontend/src/components/recruiting/Pipeline/PipelineChecklistDetails.js`**
  - Added `isSystemControlled()` function
  - Prevents manual checking of "Receive Agent Number" and "Activate Agent Number"
  - Shows purple "System" badge for system-controlled items
  - Adds tooltip: "Automatically set by the system"
  - Disables checkbox and cursor for these items

- **`atlas/frontend/src/components/recruiting/Pipeline/PipelineProgress.js`**
  - Added sub-tabs for each checklist item
  - Shows agents who need to complete each specific item
  - Badge counts show sequential progression

### Backend Files (API)

#### Modified Files:
- **`atlas/backend/routes/recruitment.js`**
  - Added `started_at` tracking to checklist progress updates
  - Modified single update endpoint
  - Modified bulk update endpoint
  - Modified auto-completion helper function
  - All track time-to-complete for checklist items

### Database Files

#### New Migrations:
- **`atlas/database/add_started_at_to_checklist_progress.sql`**
  - Adds `started_at` column for time tracking
  - Backfills existing completed items
  - Adds performance indexes

- **`atlas/database/add_activate_agent_number_checklist_item.sql`**
  - Creates "Activate Agent Number" checklist item if it doesn't exist
  - Sets it in "On-boarding" stage
  - Configures it as required

### Documentation Files

#### New Documentation:
- **`atlas/CHECKLIST_TIME_TRACKING.md`** - Time tracking system documentation
- **`python/PIPELINE_AUTOMATION_README.md`** - Python automation details
- **`atlas/PIPELINE_AGENT_ACTIVATION_SUMMARY.md`** - This file

## Database Schema Changes

### pipeline_checklist_progress
```sql
ALTER TABLE pipeline_checklist_progress
ADD COLUMN started_at DATETIME NULL;
```

### New Checklist Item
```sql
INSERT INTO pipeline_checklist_items (
    stage_name, item_name, item_description, 
    item_order, is_required, item_type, active
) VALUES (
    'On-boarding',
    'Activate Agent Number',
    'Agent number activated (automatic)',
    [order],
    1,
    'checkbox',
    1
);
```

## Workflow Example

### Before Automation
```
1. Agent appears in Daily New Associates Report
2. Processor inserts into activeusers with pending=1
3. Manual intervention needed:
   - Create pipeline record
   - Move through stages
   - Check off all previous items
   - Mark as active
```

### After Automation
```
1. Agent appears in Daily New Associates Report
2. Processor inserts into activeusers with pending=1
3. Later, agent appears in Associates Report (with production)
4. ✨ AUTOMATIC:
   - pending → 0
   - Pipeline → Training stage
   - All prior items → Completed
   - "Activate Agent Number" → Completed
   - Time tracking → Configured
5. Agent ready for training activities
```

## Testing the Automation

### Test Scenario 1: New Pending Agent Activation
```sql
-- 1. Create a test pending agent
INSERT INTO activeusers (lagnname, agtnum, pending, clname, Active, Password, managerActive)
VALUES ('Test John M', '12345', 1, 'AGT', 'n', 'default', 'n');

-- 2. Simulate activation via associates processor
-- (Run associates report or manually update)
UPDATE activeusers SET pending = 0 WHERE agtnum = '12345';

-- 3. Check if pipeline was created
SELECT p.*, ps.step, ps.date_entered
FROM pipeline p
LEFT JOIN activeusers au ON au.pipeline_id = p.id  
LEFT JOIN pipeline_steps ps ON ps.recruit_id = p.id
WHERE au.agtnum = '12345';

-- 4. Check completed checklist items
SELECT pci.stage_name, pci.item_name, pcp.completed, pcp.completed_at
FROM pipeline_checklist_progress pcp
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
WHERE au.agtnum = '12345'
ORDER BY pci.stage_name, pci.item_order;
```

### Test Scenario 2: Existing Pipeline Update
```sql
-- 1. Create agent with pipeline at early stage
INSERT INTO pipeline (recruit_first, recruit_last, step, agent_number)
VALUES ('Test', 'Agent', 'On-boarding', '67890');

-- 2. Link to activeuser with pending=1
UPDATE activeusers 
SET pipeline_id = LAST_INSERT_ID(), pending = 1 
WHERE agtnum = '67890';

-- 3. Activate agent
UPDATE activeusers SET pending = 0 WHERE agtnum = '67890';

-- 4. Verify pipeline moved to Training
SELECT step FROM pipeline WHERE agent_number = '67890';
-- Should show: Training

-- 5. Verify "Activate Agent Number" is completed
SELECT completed FROM pipeline_checklist_progress pcp
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
WHERE pcp.recruit_id = (SELECT id FROM pipeline WHERE agent_number = '67890')
AND pci.item_name = 'Activate Agent Number';
-- Should show: 1
```

## Monitoring & Logging

### Python Logs
```
INFO: Agent Smith John M/12345 activated (pending: 1 -> 0)
INFO: Creating new pipeline record for activated agent Smith John M/12345
INFO: Created pipeline record 456 at Training stage
INFO: Auto-completed 15 checklist items from prior stages for pipeline 456
INFO: Activated 1 agents in pipeline
```

### Database Queries

#### Find Recently Activated Agents
```sql
SELECT 
    au.lagnname,
    au.agtnum,
    p.step as current_stage,
    ps.date_entered as stage_entry,
    COUNT(pcp.id) as completed_items
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
JOIN pipeline_steps ps ON ps.recruit_id = p.id AND ps.date_exited IS NULL
LEFT JOIN pipeline_checklist_progress pcp ON pcp.recruit_id = p.id AND pcp.completed = 1
WHERE au.pending = 0
  AND ps.date_entered >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY au.id
ORDER BY ps.date_entered DESC;
```

#### Check Activation Completion
```sql
SELECT 
    pci.item_name,
    pcp.completed,
    pcp.started_at,
    pcp.completed_at
FROM pipeline_checklist_progress pcp
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
WHERE pcp.recruit_id = [pipeline_id]
  AND pci.item_name LIKE '%agent number%';
```

## Troubleshooting

### Agent Not Progressing
1. Check if agent exists in activeusers: `SELECT * FROM activeusers WHERE agtnum = '12345'`
2. Check pending status: Should show `pending = 0` after processing
3. Check pipeline_id: `SELECT pipeline_id FROM activeusers WHERE agtnum = '12345'`
4. Check Python logs for errors

### Checklist Item Not Completing
1. Verify "Activate Agent Number" item exists:
```sql
SELECT * FROM pipeline_checklist_items WHERE item_name LIKE '%activate%';
```
2. If missing, run: `SOURCE atlas/database/add_activate_agent_number_checklist_item.sql`
3. Check Python logs for completion attempts

### Manual Fix for Stuck Agent
```sql
-- 1. Find the agent
SELECT au.id, au.lagnname, au.agtnum, au.pending, au.pipeline_id, p.step
FROM activeusers au
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.agtnum = '12345';

-- 2. If pipeline exists but not at Training
UPDATE pipeline SET step = 'Training' WHERE id = [pipeline_id];

-- 3. If no pipeline exists, create one
INSERT INTO pipeline (recruit_first, recruit_last, step, agent_number, recruiting_agent)
VALUES ('First', 'Last', 'Training', '12345', [mga_id]);

-- 4. Link to activeuser
UPDATE activeusers SET pipeline_id = LAST_INSERT_ID() WHERE agtnum = '12345';

-- 5. Complete "Activate Agent Number" item
-- (Use backend API or SQL)
```

## Future Enhancements

Potential additions:
- Slack/email notifications when agents are activated
- Dashboard widget showing recently activated agents
- Analytics on activation-to-training time
- Bulk activation tools for administrators
- Webhook for external system integration

