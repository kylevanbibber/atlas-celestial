-- =============================================================================
-- Setup GROUP 4 Agents: Passed Release, Waiting for 2nd Pack
-- =============================================================================
-- This script handles agents who:
-- - released = 1, pending = 0
-- - Active = 'y', managerActive = 'y', clname = 'AGT'
-- - Have passed release (JA_Release passed = 'y')
-- - Waiting for 2nd Pack (leads_released type='2nd Pack', sent=0)
--
-- Actions:
-- 1. Create pipeline records for agents who don't have one
-- 2. Ensure all Training checklist items are completed EXCEPT "Receive Release Pack"
-- =============================================================================

-- Show current status
SELECT 
    'GROUP 4: Agents passed release, waiting for 2nd pack' as status,
    COUNT(*) as total_agents,
    SUM(CASE WHEN au.pipeline_id IS NULL THEN 1 ELSE 0 END) as need_pipeline_record,
    SUM(CASE WHEN au.pipeline_id IS NOT NULL THEN 1 ELSE 0 END) as have_pipeline_record
FROM activeusers au
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0;

-- =============================================================================
-- STEP 1: Create pipeline records for agents without one
-- =============================================================================

INSERT INTO pipeline (
    recruit_first, recruit_last, step, date_added, recruiting_agent, agentnum, MGA
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
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND au.pipeline_id IS NULL;

SELECT CONCAT('Created ', ROW_COUNT(), ' new pipeline records') as step1_result;

-- =============================================================================
-- STEP 2: Link newly created pipeline records to activeusers
-- =============================================================================

UPDATE activeusers au
JOIN pipeline p ON p.agentnum = au.agtnum AND p.step = 'Training'
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
SET au.pipeline_id = p.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND au.pipeline_id IS NULL
  AND p.date_added >= DATE_SUB(NOW(), INTERVAL 5 MINUTE);

SELECT CONCAT('Linked ', ROW_COUNT(), ' pipeline records to activeusers') as step2_result;

-- =============================================================================
-- STEP 3: Record pipeline step entry for new records
-- =============================================================================

INSERT INTO pipeline_steps (recruit_id, step, date_entered)
SELECT 
    p.id as recruit_id,
    'Training' as step,
    NOW() as date_entered
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 1
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

SELECT CONCAT('Recorded ', ROW_COUNT(), ' pipeline step entries') as step3_result;

-- =============================================================================
-- STEP 4: Complete prior stage items (Overview → On-boarding) for all GROUP 4 agents
-- =============================================================================

INSERT IGNORE INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
SELECT 
    p.id as recruit_id,
    pci.id as checklist_item_id,
    1 as completed,
    NOW() as started_at,
    NOW() as completed_at
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND pci.stage_name IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND pci.active = 1;

SELECT CONCAT('Completed ', ROW_COUNT(), ' prior stage checklist items') as step4_result;

-- =============================================================================
-- STEP 5: Un-complete "Receive Release Pack" items (cleanup from previous runs)
-- These agents should NOT have this completed yet since they're waiting for 2nd pack
-- =============================================================================

UPDATE pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
SET pcp.completed = 0,
    pcp.completed_at = NULL,
    pcp.completed_by = NULL
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
  AND pcp.completed = 1
  AND (pci.item_name LIKE '%Receive Release Pack%'
       OR pci.item_name LIKE '%2nd Pack%'
       OR pci.item_name LIKE '%Second Pack%');

SELECT CONCAT('Un-completed ', ROW_COUNT(), ' "Receive Release Pack" items') as step5_result;

-- =============================================================================
-- STEP 6: Complete Training items EXCEPT "Receive Release Pack" and 2nd pack items
-- =============================================================================

INSERT IGNORE INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
SELECT 
    p.id as recruit_id,
    pci.id as checklist_item_id,
    1 as completed,
    NOW() as started_at,
    NOW() as completed_at
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 1
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

SELECT CONCAT('Completed ', ROW_COUNT(), ' Training checklist items (excluding 2nd pack items)') as step6_result;

-- Update existing records to completed if not already
UPDATE pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
SET pcp.completed = 1,
    pcp.started_at = COALESCE(pcp.started_at, NOW()),
    pcp.completed_at = NOW()
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 1
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

SELECT CONCAT('Updated ', ROW_COUNT(), ' existing Training checklist items to completed') as step6b_result;

-- =============================================================================
-- Summary and Verification
-- =============================================================================

-- Show final status
SELECT 
    'After setup - GROUP 4 agents' as status,
    COUNT(DISTINCT au.id) as total_agents,
    COUNT(DISTINCT p.id) as agents_with_pipeline,
    AVG(completed_items.count) as avg_items_completed
FROM activeusers au
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
LEFT JOIN (
    SELECT recruit_id, COUNT(*) as count
    FROM pipeline_checklist_progress
    WHERE completed = 1
    GROUP BY recruit_id
) completed_items ON completed_items.recruit_id = p.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0;

-- Show sample of agents and their checklist status
SELECT 
    au.lagnname,
    au.agtnum,
    p.id as pipeline_id,
    p.step,
    jr.release_scheduled,
    (SELECT COUNT(*) 
     FROM pipeline_checklist_progress pcp
     JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
     WHERE pcp.recruit_id = p.id 
       AND pci.stage_name = 'Training' 
       AND pcp.completed = 1
    ) as training_items_completed,
    (SELECT GROUP_CONCAT(pci.item_name ORDER BY pci.item_order SEPARATOR ', ')
     FROM pipeline_checklist_progress pcp
     JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
     WHERE pcp.recruit_id = p.id 
       AND pci.stage_name = 'Training' 
       AND pcp.completed = 1
    ) as completed_training_items,
    (SELECT GROUP_CONCAT(pci.item_name ORDER BY pci.item_order SEPARATOR ', ')
     FROM pipeline_checklist_items pci
     LEFT JOIN pipeline_checklist_progress pcp ON pcp.checklist_item_id = pci.id AND pcp.recruit_id = p.id
     WHERE pci.stage_name = 'Training'
       AND pci.active = 1
       AND (pcp.completed IS NULL OR pcp.completed = 0)
    ) as pending_training_items
FROM activeusers au
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
ORDER BY au.lagnname
LIMIT 20;

