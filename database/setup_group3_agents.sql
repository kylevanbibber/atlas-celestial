-- =============================================================================
-- Setup GROUP 3 Agents: 1st Pack Sent, Not Yet Passed Release
-- =============================================================================
-- This script handles agents who:
-- - pending = 0, released = 0
-- - Active = 'y', managerActive = 'y', clname = 'AGT'
-- - Have received 1st Pack (leads_released type='1st Pack', sent=1)
-- - Have NOT passed release (not in JA_Release OR passed IS NULL)
--
-- Actions:
-- 1. Create pipeline records for agents who don't have one
-- 2. Ensure checklist items 59, 60, 61 are completed (Training items 1-3)
-- =============================================================================

-- Show current status
SELECT 
    'GROUP 3: Agents with 1st pack sent' as status,
    COUNT(*) as total_agents,
    SUM(CASE WHEN au.pipeline_id IS NULL THEN 1 ELSE 0 END) as need_pipeline_record,
    SUM(CASE WHEN au.pipeline_id IS NOT NULL THEN 1 ELSE 0 END) as have_pipeline_record
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y');

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
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y')
  AND au.pipeline_id IS NULL;

SELECT CONCAT('Created ', ROW_COUNT(), ' new pipeline records') as step1_result;

-- =============================================================================
-- STEP 2: Link newly created pipeline records to activeusers
-- =============================================================================

UPDATE activeusers au
JOIN pipeline p ON p.agentnum = au.agtnum AND p.step = 'Training'
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
SET au.pipeline_id = p.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y')
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
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y')
  AND p.step = 'Training'
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_steps ps 
      WHERE ps.recruit_id = p.id 
        AND ps.step = 'Training' 
        AND ps.date_exited IS NULL
  );

SELECT CONCAT('Recorded ', ROW_COUNT(), ' pipeline step entries') as step3_result;

-- =============================================================================
-- STEP 4: Complete prior stage items (Overview → On-boarding) for all GROUP 3 agents
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
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y')
  AND pci.stage_name IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND pci.active = 1;

SELECT CONCAT('Completed ', ROW_COUNT(), ' prior stage checklist items') as step4_result;

-- =============================================================================
-- STEP 5: Complete Training items 59, 60, 61 (items 1-3) for all GROUP 3 agents
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
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y')
  AND pci.id IN (59, 60, 61)  -- Training items: Activate Agent Number, Receive First Lead Pack, Attend Training
  AND pci.active = 1;

SELECT CONCAT('Completed ', ROW_COUNT(), ' Training checklist items (59, 60, 61)') as step5_result;

-- =============================================================================
-- Summary and Verification
-- =============================================================================

-- Show final status
SELECT 
    'After setup - GROUP 3 agents' as status,
    COUNT(DISTINCT au.id) as total_agents,
    COUNT(DISTINCT p.id) as agents_with_pipeline,
    AVG(completed_items.count) as avg_items_completed
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
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
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y');

-- Show sample of agents and their checklist status
SELECT 
    au.lagnname,
    au.agtnum,
    p.id as pipeline_id,
    p.step,
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
    ) as completed_training_items
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y')
ORDER BY au.lagnname
LIMIT 20;

