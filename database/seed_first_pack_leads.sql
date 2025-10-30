-- Seed pipeline records for agents ready for first lead pack
-- 
-- Finds and creates/updates pipeline records for agents who are:
-- - pending = 0 (activated)
-- - released = 0 (not released yet)
-- - Active = 'y'
-- - managerActive = 'y'
-- - NOT in leads_released with type = "1st Pack" and sent = 1
--
-- Sets them to Training stage and auto-completes all prior checklist items

-- First, let's see how many agents match our criteria
SELECT 
    COUNT(*) as agents_ready_for_first_pack,
    SUM(CASE WHEN au.pipeline_id IS NULL THEN 1 ELSE 0 END) as without_pipeline,
    SUM(CASE WHEN au.pipeline_id IS NOT NULL THEN 1 ELSE 0 END) as with_pipeline,
    'These agents need pipeline setup' as note
FROM activeusers au
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND NOT EXISTS (
      SELECT 1 FROM leads_released lr
      WHERE lr.userId = au.id
        AND lr.type = '1st Pack'
        AND lr.sent = 1
  );

-- Show the agents who will be processed
SELECT 
    au.id,
    au.lagnname,
    au.agtnum,
    au.mga,
    au.pipeline_id,
    CASE 
        WHEN au.pipeline_id IS NULL THEN 'Will CREATE pipeline'
        ELSE CONCAT('Will UPDATE pipeline ', au.pipeline_id)
    END as action,
    p.step as current_stage
FROM activeusers au
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND NOT EXISTS (
      SELECT 1 FROM leads_released lr
      WHERE lr.userId = au.id
        AND lr.type = '1st Pack'
        AND lr.sent = 1
  )
ORDER BY au.lagnname;

-- =============================================================================
-- STEP 0: Cleanup orphaned checklist progress records
-- Remove checklist progress records that reference non-existent pipeline records
-- =============================================================================

DELETE pcp
FROM pipeline_checklist_progress pcp
LEFT JOIN pipeline p ON pcp.recruit_id = p.id
WHERE p.id IS NULL;

SELECT CONCAT('Cleaned up ', ROW_COUNT(), ' orphaned checklist progress records') as cleanup_status;

-- =============================================================================
-- STEP 1: Create pipeline records for agents without pipeline_id
-- =============================================================================

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
    -- Extract first name (second word in lagnname)
    SUBSTRING_INDEX(SUBSTRING_INDEX(au.lagnname, ' ', 2), ' ', -1) as recruit_first,
    -- Extract last name (first word in lagnname)
    SUBSTRING_INDEX(au.lagnname, ' ', 1) as recruit_last,
    'Training' as step,
    NOW() as date_added,
    au.mga as recruiting_agent,
    au.agtnum as agentnum,
    au.mga as MGA
FROM activeusers au
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND (au.pipeline_id IS NULL OR p.id IS NULL)  -- No pipeline_id OR orphaned pipeline_id
  AND NOT EXISTS (
      SELECT 1 FROM leads_released lr
      WHERE lr.userId = au.id
        AND lr.type = '1st Pack'
        AND lr.sent = 1
  );

-- Link newly created pipeline records to activeusers (including fixing orphaned references)
UPDATE activeusers au
JOIN pipeline p ON p.agentnum = au.agtnum
LEFT JOIN pipeline p_old ON au.pipeline_id = p_old.id
SET au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND (au.pipeline_id IS NULL OR p_old.id IS NULL)  -- Update if NULL or orphaned
  AND p.step = 'Training'
  AND p.date_added >= DATE_SUB(NOW(), INTERVAL 5 MINUTE);

-- Record pipeline step entry for new records
INSERT INTO pipeline_steps (recruit_id, step, date_entered)
SELECT 
    p.id as recruit_id,
    'Training' as step,
    NOW() as date_entered
FROM pipeline p
JOIN activeusers au ON p.agentnum = au.agtnum
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step = 'Training'
  AND p.date_added >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_steps ps
      WHERE ps.recruit_id = p.id
      AND ps.step = 'Training'
  );

-- =============================================================================
-- STEP 2: Update existing pipeline records to Training stage if at earlier stage
-- =============================================================================

-- Close previous pipeline_steps
UPDATE pipeline_steps ps
JOIN pipeline p ON ps.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
SET ps.date_exited = NOW()
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND ps.step = p.step
  AND ps.date_exited IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM leads_released lr
      WHERE lr.userId = au.id
        AND lr.type = '1st Pack'
        AND lr.sent = 1
  );

-- Update pipeline records to Training stage
UPDATE pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
SET p.step = 'Training',
    p.date_last_updated = NOW()
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND NOT EXISTS (
      SELECT 1 FROM leads_released lr
      WHERE lr.userId = au.id
        AND lr.type = '1st Pack'
        AND lr.sent = 1
  );

-- Record new Training stage entry
INSERT INTO pipeline_steps (recruit_id, step, date_entered)
SELECT 
    p.id as recruit_id,
    'Training' as step,
    NOW() as date_entered
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step = 'Training'
  AND NOT EXISTS (
      SELECT 1 FROM leads_released lr
      WHERE lr.userId = au.id
        AND lr.type = '1st Pack'
        AND lr.sent = 1
  )
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_steps ps
      WHERE ps.recruit_id = p.id
      AND ps.step = 'Training'
      AND ps.date_exited IS NULL
  );

-- =============================================================================
-- STEP 3: Auto-complete all checklist items from prior stages (Overview → On-boarding)
-- =============================================================================

-- Complete all checklist items from stages BEFORE Training
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
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step = 'Training'
  AND pci.stage_name IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND pci.active = 1
  AND NOT EXISTS (
      SELECT 1 FROM leads_released lr
      WHERE lr.userId = au.id
        AND lr.type = '1st Pack'
        AND lr.sent = 1
  )
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_checklist_progress pcp
      WHERE pcp.recruit_id = p.id
      AND pcp.checklist_item_id = pci.id
  );

-- Update to completed if already exists but not marked complete (prior stages)
UPDATE pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
SET pcp.completed = 1,
    pcp.started_at = COALESCE(pcp.started_at, NOW()),
    pcp.completed_at = NOW()
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step = 'Training'
  AND pcp.completed = 0
  AND pci.stage_name IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND pci.active = 1
  AND NOT EXISTS (
      SELECT 1 FROM leads_released lr
      WHERE lr.userId = au.id
        AND lr.type = '1st Pack'
        AND lr.sent = 1
  );

-- =============================================================================
-- Summary and results
-- =============================================================================

-- Show checklist items completed summary
SELECT 
    'Checklist items completed' as summary,
    pci.stage_name,
    COUNT(DISTINCT pcp.recruit_id) as agents_with_item_complete
FROM pipeline_checklist_progress pcp
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step = 'Training'
  AND pcp.completed = 1
  AND NOT EXISTS (
      SELECT 1 FROM leads_released lr
      WHERE lr.userId = au.id
        AND lr.type = '1st Pack'
        AND lr.sent = 1
  )
GROUP BY pci.stage_name
ORDER BY FIELD(pci.stage_name, 'Overview', 'Final Decision', 'Licensing', 'On-boarding', 'Training');

-- Show summary of pipeline records that were created/updated
SELECT 
    'Pipeline records processed' as summary,
    COUNT(*) as total_agents,
    COUNT(DISTINCT p.id) as pipeline_records_at_training
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step = 'Training'
  AND NOT EXISTS (
      SELECT 1 FROM leads_released lr
      WHERE lr.userId = au.id
        AND lr.type = '1st Pack'
        AND lr.sent = 1
  );

-- Show the results
SELECT 
    au.lagnname,
    au.agtnum,
    p.id as pipeline_id,
    p.step,
    ps.date_entered as training_started,
    au.mga,
    (SELECT COUNT(*) FROM pipeline_checklist_progress pcp 
     WHERE pcp.recruit_id = p.id AND pcp.completed = 1) as items_completed
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
JOIN pipeline_steps ps ON ps.recruit_id = p.id AND ps.step = 'Training' AND ps.date_exited IS NULL
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND NOT EXISTS (
      SELECT 1 FROM leads_released lr
      WHERE lr.userId = au.id
        AND lr.type = '1st Pack'
        AND lr.sent = 1
  )
ORDER BY ps.date_entered DESC
LIMIT 20;
