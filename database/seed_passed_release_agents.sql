-- =============================================================================
-- Seed Pipeline Records for Agents Who Have Passed Release
-- =============================================================================
-- This script creates/updates pipeline records for agents who:
-- - released = 1 (passed release call)
-- - Active = 'y'
-- - managerActive = 'y'
-- - JA_Release.passed = 'y' (confirmed passed in release table)
-- - leads_released type = '2nd Pack' AND sent = 0 (waiting for 2nd pack)
--
-- These agents have successfully passed their release call but are still at
-- Training stage waiting for their 2nd pack. All prior stage items (Overview → On-boarding)
-- and Training items BEFORE "Receive Release Pack" should be completed.
-- "Receive Release Pack" should remain UNCHECKED so they appear in that sub-tab.
-- =============================================================================

-- Show current status
SELECT 
    'Agents who have passed release (waiting for 2nd pack)' as status,
    COUNT(DISTINCT au.id) as total_agents,
    COUNT(DISTINCT p.id) as agents_with_pipeline,
    COUNT(DISTINCT au.id) - COUNT(DISTINCT p.id) as agents_needing_pipeline
FROM activeusers au
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0;

-- Show the agents who will be processed
SELECT 
    au.lagnname,
    au.agtnum,
    p.id as pipeline_id,
    CASE WHEN p.id IS NULL THEN 'NEEDS PIPELINE' ELSE p.step END as pipeline_status,
    jr.release_scheduled,
    jr.passed,
    lr.sent_date as second_pack_status
FROM activeusers au
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
ORDER BY jr.release_scheduled DESC
LIMIT 20;

-- =============================================================================
-- STEP 1: Create pipeline records for agents without one
-- =============================================================================

-- Create pipeline records at Training stage for passed agents (waiting for 2nd pack)
INSERT INTO pipeline (
    recruit_first,
    recruit_last,
    step,
    date_added,
    recruiting_agent,
    agentnum,
    MGA
)
SELECT 
    SUBSTRING_INDEX(SUBSTRING_INDEX(au.lagnname, ' ', 2), ' ', -1) as recruit_first,
    SUBSTRING_INDEX(au.lagnname, ' ', 1) as recruit_last,
    'Training' as step,
    NOW() as date_added,
    au.mga as recruiting_agent,
    au.agtnum as agentnum,
    au.mga as MGA
FROM activeusers au
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND (au.pipeline_id IS NULL OR p.id IS NULL);

SELECT CONCAT('Created ', ROW_COUNT(), ' new pipeline records at Training stage') as step1_create_result;

-- Link newly created pipeline records to activeusers
UPDATE activeusers au
JOIN pipeline p ON p.agentnum = au.agtnum
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p_old ON au.pipeline_id = p_old.id
SET au.pipeline_id = p.id
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND (au.pipeline_id IS NULL OR p_old.id IS NULL)
  AND p.step = 'Training'
  AND p.date_added >= DATE_SUB(NOW(), INTERVAL 5 MINUTE);

SELECT CONCAT('Linked ', ROW_COUNT(), ' pipeline records to activeusers') as step1_link_result;

-- Record pipeline step entry for new records
INSERT INTO pipeline_steps (recruit_id, step, date_entered)
SELECT 
    p.id as recruit_id,
    'Training' as step,
    NOW() as date_entered
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND p.step = 'Training'
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_steps ps
      WHERE ps.recruit_id = p.id
      AND ps.step = 'Training'
      AND ps.date_exited IS NULL
  );

SELECT CONCAT('Recorded ', ROW_COUNT(), ' pipeline step entries') as step1_steps_result;

-- =============================================================================
-- STEP 2: Update existing pipeline records to Training stage if at earlier stage
-- =============================================================================

-- Close previous stage for agents not yet at Training
UPDATE pipeline_steps ps
JOIN pipeline p ON ps.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
SET ps.date_exited = NOW()
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND p.step IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND ps.step = p.step
  AND ps.date_exited IS NULL;

SELECT CONCAT('Closed ', ROW_COUNT(), ' previous pipeline steps') as step2_close_result;

-- Update pipeline records to Training stage
UPDATE pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
SET p.step = 'Training',
    p.date_last_updated = NOW()
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND p.step IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding');

SELECT CONCAT('Updated ', ROW_COUNT(), ' pipeline records to Training stage') as step2_update_result;

-- Record new Training stage entry
INSERT INTO pipeline_steps (recruit_id, step, date_entered)
SELECT 
    p.id as recruit_id,
    'Training' as step,
    NOW() as date_entered
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND p.step = 'Training'
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_steps ps
      WHERE ps.recruit_id = p.id
      AND ps.step = 'Training'
      AND ps.date_exited IS NULL
  );

SELECT CONCAT('Recorded ', ROW_COUNT(), ' new Training stage entries') as step2_steps_result;

-- =============================================================================
-- STEP 3: Complete prior stage items (Overview → On-boarding)
-- =============================================================================

-- Complete all checklist items from stages BEFORE Training
INSERT IGNORE INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
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
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND pci.stage_name IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND pci.active = 1;

SELECT CONCAT('Completed ', ROW_COUNT(), ' prior stage checklist items (Overview-OnBoarding)') as step3_result;

-- Update to completed if already exists but not marked complete
UPDATE pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
SET pcp.completed = 1,
    pcp.started_at = COALESCE(pcp.started_at, NOW()),
    pcp.completed_at = NOW()
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND pcp.completed = 0
  AND pci.stage_name IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND pci.active = 1;

SELECT CONCAT('Updated ', ROW_COUNT(), ' incomplete prior stage items to completed') as step3_update_result;

-- =============================================================================
-- STEP 3.5: Un-complete "Receive Release Pack" items (fix from previous run)
-- =============================================================================

-- Remove completion of "Receive Release Pack" items for these agents
-- They should NOT have this completed yet since they're waiting for 2nd pack
UPDATE pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
SET pcp.completed = 0,
    pcp.completed_at = NULL,
    pcp.completed_by = NULL
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND pcp.completed = 1
  AND (pci.item_name LIKE '%Receive Release Pack%'
       OR pci.item_name LIKE '%2nd Pack%'
       OR pci.item_name LIKE '%Second Pack%');

SELECT CONCAT('Un-completed ', ROW_COUNT(), ' "Receive Release Pack" items') as step3_5_result;

-- =============================================================================
-- STEP 4: Complete Training items EXCEPT "Receive Release Pack"
-- =============================================================================

-- Complete all Training stage checklist items EXCEPT items related to receiving 2nd pack
INSERT IGNORE INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
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
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND pci.stage_name = 'Training'
  AND pci.active = 1
  AND pci.item_name NOT LIKE '%Receive Release Pack%'
  AND pci.item_name NOT LIKE '%2nd Pack%'
  AND pci.item_name NOT LIKE '%Second Pack%';

SELECT CONCAT('Completed ', ROW_COUNT(), ' Training stage checklist items (excluding Receive Release Pack)') as step4_result;

-- Update to completed if already exists but not marked complete
UPDATE pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
SET pcp.completed = 1,
    pcp.started_at = COALESCE(pcp.started_at, NOW()),
    pcp.completed_at = NOW()
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND pcp.completed = 0
  AND pci.stage_name = 'Training'
  AND pci.active = 1
  AND pci.item_name NOT LIKE '%Receive Release Pack%'
  AND pci.item_name NOT LIKE '%2nd Pack%'
  AND pci.item_name NOT LIKE '%Second Pack%';

SELECT CONCAT('Updated ', ROW_COUNT(), ' incomplete Training items to completed (excluding Receive Release Pack)') as step4_update_result;

-- =============================================================================
-- Summary and Results
-- =============================================================================

-- Show checklist items completed by stage
SELECT 
    'Checklist items completed by stage' as summary,
    pci.stage_name,
    COUNT(DISTINCT pcp.recruit_id) as agents_with_items_complete,
    COUNT(*) as total_items_completed
FROM pipeline_checklist_progress pcp
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND pcp.completed = 1
GROUP BY pci.stage_name
ORDER BY FIELD(pci.stage_name, 'Overview', 'Final Decision', 'Licensing', 'On-boarding', 'Training');

-- Show final status
SELECT 
    'After completion - Agents who passed release' as status,
    COUNT(DISTINCT au.id) as total_agents,
    COUNT(DISTINCT p.id) as agents_with_pipeline,
    AVG(item_counts.items_completed) as avg_items_per_agent
FROM activeusers au
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
LEFT JOIN (
    SELECT recruit_id, COUNT(*) as items_completed
    FROM pipeline_checklist_progress
    WHERE completed = 1
    GROUP BY recruit_id
) item_counts ON item_counts.recruit_id = p.id
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0;

-- Show sample of completed agents
SELECT 
    au.lagnname,
    au.agtnum,
    p.id as pipeline_id,
    p.step,
    jr.release_scheduled,
    jr.passed,
    (SELECT COUNT(*) FROM pipeline_checklist_progress pcp 
     WHERE pcp.recruit_id = p.id AND pcp.completed = 1) as items_completed
FROM activeusers au
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
ORDER BY jr.release_scheduled DESC
LIMIT 20;

