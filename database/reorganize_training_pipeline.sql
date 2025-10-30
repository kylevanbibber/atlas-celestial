-- =============================================================================
-- Reorganize Training Pipeline Based on Actual Agent Status
-- =============================================================================
-- This script ensures recruits are positioned correctly in the Training stage
-- based on their actual status in activeusers and leads_released.
--
-- Training Checklist Order:
-- 1. Attend Training (item_order = 1)
-- 2. Activate Agent Number (item_order = 2)
-- 3. Receive First Lead Pack (item_order = 3)
-- 4. Attend and Pass Release Call (item_order = 4)
-- 5. Receive Release Pack (item_order = 5)
--
-- Business Logic:
-- GROUP 1: pending = 1, Active = 'y', managerActive = 'y', released = 0
--          → Training stage, NO checklist items completed
--
-- GROUP 2: pending = 0, released = 0, (NOT in leads_released OR leads_released type='1st Pack', sent=0)
--          → Training stage, "Attend Training" + "Activate Agent Number" completed
--
-- GROUP 3: leads_released type='1st Pack', sent=1, (NOT in JA_Release OR JA_Release.passed IS NULL)
--          → Training stage, items 1-3 completed (Attend Training, Activate Agent Number, Receive First Lead Pack)
--
-- GROUP 4: JA_Release.passed = 'y', leads_released type='2nd Pack', sent=0
--          → Training stage, items 1-4 completed (everything except "Receive Release Pack")
--
-- GROUP 5: JA_Release.passed = 'y', leads_released type='2nd Pack', sent=1
--          → Move to "Career Path" stage, ALL Training items completed
-- =============================================================================

-- =============================================================================
-- STEP 0: Remove non-AGT, inactive agents, trainees, and old esid agents from pipeline
-- =============================================================================

-- Remove agents with clname != 'AGT', Role = 'Trainee', Active = 'n', managerActive = 'n', or esid > 60 days old
DELETE pcp
FROM pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
WHERE (au.clname != 'AGT' OR au.clname IS NULL)
   OR au.Role = 'Trainee'
   OR au.Active = 'n'
   OR au.managerActive = 'n'
   OR au.esid < DATE_SUB(NOW(), INTERVAL 60 DAY);

SELECT CONCAT('Removed ', ROW_COUNT(), ' checklist items for non-AGT/inactive/trainee/old esid agents') as step0a_result;

DELETE ps
FROM pipeline_steps ps
JOIN pipeline p ON ps.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
WHERE (au.clname != 'AGT' OR au.clname IS NULL)
   OR au.Role = 'Trainee'
   OR au.Active = 'n'
   OR au.managerActive = 'n'
   OR au.esid < DATE_SUB(NOW(), INTERVAL 60 DAY);

SELECT CONCAT('Removed ', ROW_COUNT(), ' pipeline steps for non-AGT/inactive/trainee/old esid agents') as step0b_result;

UPDATE activeusers
SET pipeline_id = NULL
WHERE ((clname != 'AGT' OR clname IS NULL) OR Role = 'Trainee' OR Active = 'n' OR managerActive = 'n' OR esid < DATE_SUB(NOW(), INTERVAL 60 DAY))
  AND pipeline_id IS NOT NULL;

SELECT CONCAT('Unlinked ', ROW_COUNT(), ' non-AGT/inactive/trainee/old esid agents from pipeline') as step0c_result;

DELETE p
FROM pipeline p
LEFT JOIN activeusers au ON au.pipeline_id = p.id
WHERE au.id IS NULL;

SELECT CONCAT('Deleted ', ROW_COUNT(), ' orphaned pipeline records') as step0d_result;

-- Show current training pipeline status
SELECT 
    'Current Training Pipeline Status (after cleanup)' as status,
    COUNT(DISTINCT p.id) as total_in_training,
    COUNT(DISTINCT au.id) as linked_to_activeusers
FROM pipeline p
LEFT JOIN activeusers au ON au.pipeline_id = p.id
WHERE p.step = 'Training';

-- =============================================================================
-- STEP 1: Delete ALL Training checklist items for AGT agents (regardless of current stage)
-- (We'll re-insert them based on actual status)
-- =============================================================================

DELETE pcp
FROM pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND au.Role != 'Trainee'
  AND pci.stage_name = 'Training';

SELECT CONCAT('Deleted ', ROW_COUNT(), ' Training checklist items for all active AGT agents (will re-insert based on status)') as step1_result;

-- =============================================================================
-- STEP 2: Complete all prior stage items (Overview → On-boarding) for ALL ACTIVE Training agents
-- =============================================================================

INSERT INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
SELECT 
    p.id as recruit_id,
    pci.id as checklist_item_id,
    1 as completed,
    NOW() as started_at,
    NOW() as completed_at
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
CROSS JOIN pipeline_checklist_items pci
WHERE p.step = 'Training'
  AND au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND au.Role != 'Trainee'
  AND pci.stage_name IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND pci.active = 1;

SELECT CONCAT('Completed ', ROW_COUNT(), ' prior stage items (Overview-OnBoarding) for all active AGT Training agents') as step2_result;

-- =============================================================================
-- STEP 3: GROUP 1 - Pending agents (no items completed)
-- pending = 1, clname = 'AGT', Active = 'y', managerActive = 'y', released = 0
-- =============================================================================

-- These agents stay at Training with NO items completed (already reset above)
-- Just verify they have pipeline records

SELECT 
    'GROUP 1: Pending AGT agents needing pipeline' as group_name,
    COUNT(*) as total_agents,
    COUNT(p.id) as agents_with_pipeline
FROM activeusers au
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.clname = 'AGT'
  AND au.pending = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND au.released = 0
  AND au.esid >= DATE_SUB(NOW(), INTERVAL 60 DAY);

-- =============================================================================
-- DIAGNOSTIC: Show agent counts for each group
-- =============================================================================

SELECT 'GROUP 2: Activated agents' as group_name, COUNT(*) as agent_count
FROM activeusers au
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND (
      NOT EXISTS (SELECT 1 FROM leads_released lr WHERE lr.userId = au.id)
      OR EXISTS (SELECT 1 FROM leads_released lr WHERE lr.userId = au.id AND lr.type = '1st Pack' AND lr.sent = 0)
  )

UNION ALL

SELECT 'GROUP 3: 1st Pack sent' as group_name, COUNT(*) as agent_count
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y')

UNION ALL

SELECT 'GROUP 4: Passed release, waiting for 2nd pack' as group_name, COUNT(*) as agent_count
FROM activeusers au
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0

UNION ALL

SELECT 'GROUP 5: 2nd pack sent (move to Career Path)' as group_name, COUNT(*) as agent_count
FROM activeusers au
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 1;

-- =============================================================================
-- STEP 4: GROUP 5 - Process FIRST (most advanced) - Agents with 2nd pack sent
-- JA_Release.passed = 'y', leads_released type='2nd Pack', sent=1
-- =============================================================================

-- Complete ALL Training items (1-5) and move to Career Path
INSERT INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
SELECT 
    p.id as recruit_id,
    pci.id as checklist_item_id,
    1 as completed,
    NOW() as started_at,
    NOW() as completed_at
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 1
  AND p.step = 'Training'
  AND pci.stage_name = 'Training'
  AND pci.active = 1;

SELECT CONCAT('GROUP 5: Completed all Training items for ', ROW_COUNT() / 5, ' AGT agents') as step4_result;

-- =============================================================================
-- STEP 5: GROUP 4 - Agents passed release, waiting for 2nd pack (items 1-4)
-- JA_Release.passed = 'y', leads_released type='2nd Pack', sent=0
-- =============================================================================

-- Complete items 1-4: Everything except "Receive Release Pack"
INSERT INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
SELECT 
    p.id as recruit_id,
    pci.id as checklist_item_id,
    1 as completed,
    NOW() as started_at,
    NOW() as completed_at
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  -- Only process if not already done by GROUP 5
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_checklist_progress pcp2
      WHERE pcp2.recruit_id = p.id AND pcp2.checklist_item_id = pci.id
  )
  AND pci.stage_name = 'Training'
  AND pci.item_order <= 4
  AND pci.active = 1;

SELECT CONCAT('GROUP 4: Completed items 1-4 for ', ROW_COUNT() / 4, ' AGT agents') as step5_result;

-- =============================================================================
-- STEP 6: GROUP 3 - Agents with 1st pack sent (items 1-3)
-- leads_released type='1st Pack', sent=1, NOT passed release
-- =============================================================================

-- Complete items 1-3
INSERT INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
SELECT 
    p.id as recruit_id,
    pci.id as checklist_item_id,
    1 as completed,
    NOW() as started_at,
    NOW() as completed_at
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y')
  -- Only process if not already done by GROUP 4 or 5
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_checklist_progress pcp2
      WHERE pcp2.recruit_id = p.id AND pcp2.checklist_item_id = pci.id
  )
  AND pci.stage_name = 'Training'
  AND pci.item_order <= 3
  AND pci.active = 1;

SELECT CONCAT('GROUP 3: Completed items 1-3 for ', ROW_COUNT() / 3, ' AGT agents') as step6_result;

-- =============================================================================
-- STEP 7: GROUP 2 - Activated agents (items 1-2)
-- pending = 0, released = 0, NOT advanced to GROUP 3+
-- =============================================================================

-- Complete items 1-2
INSERT INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
SELECT 
    p.id as recruit_id,
    pci.id as checklist_item_id,
    1 as completed,
    NOW() as started_at,
    NOW() as completed_at
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  -- Only process if not already done by GROUP 3, 4, or 5
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_checklist_progress pcp2
      WHERE pcp2.recruit_id = p.id AND pcp2.checklist_item_id = pci.id
  )
  AND pci.stage_name = 'Training'
  AND pci.item_order <= 2
  AND pci.active = 1;

SELECT CONCAT('GROUP 2: Completed items 1-2 for ', ROW_COUNT() / 2, ' AGT agents') as step7_result;

-- =============================================================================
-- STEP 8: Move GROUP 5 agents to Career Path stage
-- =============================================================================

-- Close Training pipeline step
UPDATE pipeline_steps ps
JOIN pipeline p ON ps.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
SET ps.date_exited = NOW()
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 1
  AND p.step = 'Training'
  AND ps.step = 'Training'
  AND ps.date_exited IS NULL;

SELECT CONCAT('GROUP 5: Closed Training stage for ', ROW_COUNT(), ' agents') as step8a_result;

-- Update to Career Path stage
UPDATE pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
SET p.step = 'Career Path', p.date_last_updated = NOW()
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 1
  AND p.step = 'Training';

SELECT CONCAT('GROUP 5: Moved ', ROW_COUNT(), ' agents to Career Path stage') as step8b_result;

-- Record new Career Path pipeline step
INSERT INTO pipeline_steps (recruit_id, step, date_entered)
SELECT 
    p.id as recruit_id,
    'Career Path' as step,
    NOW() as date_entered
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 1
  AND p.step = 'Career Path'
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_steps ps 
      WHERE ps.recruit_id = p.id 
        AND ps.step = 'Career Path' 
        AND ps.date_exited IS NULL
  );

SELECT CONCAT('GROUP 5: Recorded Career Path step for ', ROW_COUNT(), ' agents') as step8c_result;

-- =============================================================================
-- Summary and Verification
-- =============================================================================

-- Show breakdown by group
SELECT 
    'GROUP 1: Pending (no items)' as agent_group,
    COUNT(DISTINCT p.id) as total_agents,
    AVG(completed_items.count) as avg_items_completed
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
LEFT JOIN (
    SELECT recruit_id, COUNT(*) as count
    FROM pipeline_checklist_progress
    WHERE completed = 1
    GROUP BY recruit_id
) completed_items ON completed_items.recruit_id = p.id
WHERE au.clname = 'AGT'
  AND au.pending = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND au.released = 0
  AND au.esid >= DATE_SUB(NOW(), INTERVAL 60 DAY)
  AND p.step = 'Training'

UNION ALL

SELECT 
    'GROUP 2: Activated (items 1-2)' as agent_group,
    COUNT(DISTINCT p.id) as total_agents,
    AVG(completed_items.count) as avg_items_completed
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
LEFT JOIN (
    SELECT recruit_id, COUNT(*) as count
    FROM pipeline_checklist_progress
    WHERE completed = 1
    GROUP BY recruit_id
) completed_items ON completed_items.recruit_id = p.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND (
      NOT EXISTS (SELECT 1 FROM leads_released lr WHERE lr.userId = au.id)
      OR EXISTS (SELECT 1 FROM leads_released lr WHERE lr.userId = au.id AND lr.type = '1st Pack' AND lr.sent = 0)
  )
  AND p.step = 'Training'

UNION ALL

SELECT 
    'GROUP 3: 1st Pack (items 1-3)' as agent_group,
    COUNT(DISTINCT p.id) as total_agents,
    AVG(completed_items.count) as avg_items_completed
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
LEFT JOIN (
    SELECT recruit_id, COUNT(*) as count
    FROM pipeline_checklist_progress
    WHERE completed = 1
    GROUP BY recruit_id
) completed_items ON completed_items.recruit_id = p.id
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y')
  AND p.step = 'Training'

UNION ALL

SELECT 
    'GROUP 4: Passed Release (items 1-4)' as agent_group,
    COUNT(DISTINCT p.id) as total_agents,
    AVG(completed_items.count) as avg_items_completed
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN (
    SELECT recruit_id, COUNT(*) as count
    FROM pipeline_checklist_progress
    WHERE completed = 1
    GROUP BY recruit_id
) completed_items ON completed_items.recruit_id = p.id
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND p.step = 'Training'

UNION ALL

SELECT 
    'GROUP 5: Career Path (all items)' as agent_group,
    COUNT(DISTINCT p.id) as total_agents,
    AVG(completed_items.count) as avg_items_completed
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN (
    SELECT recruit_id, COUNT(*) as count
    FROM pipeline_checklist_progress
    WHERE completed = 1
    GROUP BY recruit_id
) completed_items ON completed_items.recruit_id = p.id
WHERE au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 1
  AND p.step = 'Career Path';

