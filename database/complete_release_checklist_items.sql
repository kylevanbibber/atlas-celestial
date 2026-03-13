-- =============================================================================
-- Complete Release-Related Checklist Items
-- =============================================================================
-- This script finds agents who:
-- 1. Have received their first lead pack (leads_released type='1st Pack', sent=1)
-- 2. Are scheduled for release (in JA_Release with passed IS NULL)
-- 
-- For these agents, it completes:
-- - "Attend Training" (Training stage)
-- - "Complete Release Checklist" (if exists in checklist items)
-- 
-- This backfills agents who are already scheduled for release but haven't had
-- these checklist items marked as complete.
-- =============================================================================

-- Show current status before completion
SELECT 
    'Agents scheduled for release (passed IS NULL)' as status,
    COUNT(DISTINCT au.id) as total_agents,
    COUNT(DISTINCT p.id) as agents_with_pipeline,
    COUNT(DISTINCT CASE WHEN attend.id IS NOT NULL AND attend.completed = 1 THEN p.id END) as agents_with_attend_training_complete,
    COUNT(DISTINCT CASE WHEN release_item.id IS NOT NULL AND release_item.completed = 1 THEN p.id END) as agents_with_release_checklist_complete
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
LEFT JOIN pipeline_checklist_progress attend ON attend.recruit_id = p.id 
    AND attend.checklist_item_id = (
        SELECT id FROM pipeline_checklist_items 
        WHERE stage_name = 'Training' 
        AND item_name = 'Attend Training' 
        AND active = 1 LIMIT 1
    )
LEFT JOIN pipeline_checklist_progress release_item ON release_item.recruit_id = p.id 
    AND release_item.checklist_item_id = (
        SELECT id FROM pipeline_checklist_items 
        WHERE item_name LIKE '%Release Checklist%'
        AND active = 1 LIMIT 1
    )
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL;

-- Show the agents who need items completed
SELECT 
    au.lagnname,
    au.agtnum,
    p.id as pipeline_id,
    CASE WHEN p.id IS NULL THEN 'NEEDS PIPELINE' ELSE p.step END as pipeline_status,
    jr.release_scheduled,
    CASE WHEN attend.completed = 1 THEN 'Yes' ELSE 'No' END as attend_training_complete,
    CASE WHEN release_item.completed = 1 THEN 'Yes' ELSE 'No' END as release_checklist_complete
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
LEFT JOIN pipeline_checklist_progress attend ON attend.recruit_id = p.id 
    AND attend.checklist_item_id = (
        SELECT id FROM pipeline_checklist_items 
        WHERE stage_name = 'Training' 
        AND item_name = 'Attend Training' 
        AND active = 1 LIMIT 1
    )
LEFT JOIN pipeline_checklist_progress release_item ON release_item.recruit_id = p.id 
    AND release_item.checklist_item_id = (
        SELECT id FROM pipeline_checklist_items 
        WHERE item_name LIKE '%Release Checklist%'
        AND active = 1 LIMIT 1
    )
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL
ORDER BY jr.release_scheduled
LIMIT 20;

-- =============================================================================
-- STEP 1: Create pipeline records for agents without one
-- =============================================================================

-- Create pipeline records at Training stage for agents scheduled for release but no pipeline
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
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL
  AND (au.pipeline_id IS NULL OR p.id IS NULL);

SELECT CONCAT('Created ', ROW_COUNT(), ' new pipeline records') as step1_create_result;

-- Link newly created pipeline records to activeusers
UPDATE activeusers au
JOIN pipeline p ON p.agentnum = au.agtnum
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
LEFT JOIN pipeline p_old ON au.pipeline_id = p_old.id
SET au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL
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
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL
  AND p.step = 'Training'
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_steps ps
      WHERE ps.recruit_id = p.id
      AND ps.step = 'Training'
      AND ps.date_exited IS NULL
  );

SELECT CONCAT('Recorded ', ROW_COUNT(), ' pipeline step entries') as step1_steps_result;

-- =============================================================================
-- STEP 2: Complete ALL prior stage items for agents scheduled for release
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
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL
  AND pci.stage_name IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND pci.active = 1;

SELECT CONCAT('Completed ', ROW_COUNT(), ' prior stage checklist items') as step2_result;

-- =============================================================================
-- STEP 3: Complete Training items before "Attend Training"
-- =============================================================================

-- Complete Training items BEFORE "Attend Training"
INSERT IGNORE INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
SELECT 
    p.id as recruit_id,
    pci.id as checklist_item_id,
    1 as completed,
    NOW() as started_at,
    NOW() as completed_at
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL
  AND pci.stage_name = 'Training'
  AND pci.active = 1
  AND pci.item_order < (
      SELECT item_order FROM pipeline_checklist_items 
      WHERE stage_name = 'Training' 
      AND item_name = 'Attend Training' 
      AND active = 1 LIMIT 1
  );

SELECT CONCAT('Completed ', ROW_COUNT(), ' Training items before Attend Training') as step3_result;

-- =============================================================================
-- STEP 4: Complete "Attend Training" for agents scheduled for release
-- =============================================================================

-- Complete "Attend Training" checklist item
INSERT IGNORE INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
SELECT 
    p.id as recruit_id,
    pci.id as checklist_item_id,
    1 as completed,
    NOW() as started_at,
    NOW() as completed_at
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL
  AND pci.stage_name = 'Training'
  AND pci.item_name = 'Attend Training'
  AND pci.active = 1;

SELECT CONCAT('Completed "Attend Training" for ', ROW_COUNT(), ' agents') as step1_result;

-- Update to completed if already exists but not marked complete
UPDATE pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
SET pcp.completed = 1,
    pcp.started_at = COALESCE(pcp.started_at, NOW()),
    pcp.completed_at = NOW()
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL
  AND pcp.completed = 0
  AND pci.stage_name = 'Training'
  AND pci.item_name = 'Attend Training'
  AND pci.active = 1;

SELECT CONCAT('Updated ', ROW_COUNT(), ' incomplete "Attend Training" items to completed') as step4_update_result;

-- =============================================================================
-- STEP 5: Complete "Complete Release Checklist" for agents scheduled for release
-- =============================================================================

-- Complete "Complete Release Checklist" item (or similar named item)
INSERT IGNORE INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
SELECT 
    p.id as recruit_id,
    pci.id as checklist_item_id,
    1 as completed,
    NOW() as started_at,
    NOW() as completed_at
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL
  AND pci.item_name LIKE '%Release Checklist%'
  AND pci.active = 1;

SELECT CONCAT('Completed "Release Checklist" items for ', ROW_COUNT(), ' agents') as step5_result;

-- Update to completed if already exists but not marked complete
UPDATE pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
SET pcp.completed = 1,
    pcp.started_at = COALESCE(pcp.started_at, NOW()),
    pcp.completed_at = NOW()
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL
  AND pcp.completed = 0
  AND pci.item_name LIKE '%Release Checklist%'
  AND pci.active = 1;

SELECT CONCAT('Updated ', ROW_COUNT(), ' incomplete "Release Checklist" items to completed') as step5_update_result;

-- =============================================================================
-- Summary and Results
-- =============================================================================

-- Show final status
SELECT 
    'After completion - Agents scheduled for release' as status,
    COUNT(DISTINCT au.id) as total_agents,
    COUNT(DISTINCT p.id) as agents_with_pipeline,
    COUNT(DISTINCT CASE WHEN attend.id IS NOT NULL AND attend.completed = 1 THEN p.id END) as agents_with_attend_training_complete,
    COUNT(DISTINCT CASE WHEN release_item.id IS NOT NULL AND release_item.completed = 1 THEN p.id END) as agents_with_release_checklist_complete
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
LEFT JOIN pipeline_checklist_progress attend ON attend.recruit_id = p.id 
    AND attend.checklist_item_id = (
        SELECT id FROM pipeline_checklist_items 
        WHERE stage_name = 'Training' 
        AND item_name = 'Attend Training' 
        AND active = 1 LIMIT 1
    )
LEFT JOIN pipeline_checklist_progress release_item ON release_item.recruit_id = p.id 
    AND release_item.checklist_item_id = (
        SELECT id FROM pipeline_checklist_items 
        WHERE item_name LIKE '%Release Checklist%'
        AND active = 1 LIMIT 1
    )
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL;

-- Show sample of completed agents
SELECT 
    au.lagnname,
    au.agtnum,
    p.id as pipeline_id,
    p.step,
    jr.release_scheduled,
    CASE WHEN attend.completed = 1 THEN 'Yes' ELSE 'No' END as attend_training_complete,
    CASE WHEN release_item.completed = 1 THEN 'Yes' ELSE 'No' END as release_checklist_complete,
    (SELECT COUNT(*) FROM pipeline_checklist_progress pcp 
     WHERE pcp.recruit_id = p.id AND pcp.completed = 1) as total_items_completed
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
JOIN JA_Release jr ON jr.user_id = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
LEFT JOIN pipeline_checklist_progress attend ON attend.recruit_id = p.id 
    AND attend.checklist_item_id = (
        SELECT id FROM pipeline_checklist_items 
        WHERE stage_name = 'Training' 
        AND item_name = 'Attend Training' 
        AND active = 1 LIMIT 1
    )
LEFT JOIN pipeline_checklist_progress release_item ON release_item.recruit_id = p.id 
    AND release_item.checklist_item_id = (
        SELECT id FROM pipeline_checklist_items 
        WHERE item_name LIKE '%Release Checklist%'
        AND active = 1 LIMIT 1
    )
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND jr.passed IS NULL
ORDER BY jr.release_scheduled DESC
LIMIT 20;

