-- Seed pipeline records for agents who have received their first lead pack
-- 
-- Finds and creates/updates pipeline records for agents who are:
-- - pending = 0 (activated)
-- - released = 0 (not released yet)
-- - Active = 'y'
-- - managerActive = 'y'
-- - IN leads_released with type = "1st Pack" AND sent = 1 (received first pack)
--
-- Note: This script assumes the next stage after Training exists in your pipeline.
-- Check your pipeline_stage_definitions table to confirm the stage order.

-- First, let's see the stage order
SELECT 
    stage_name,
    position_after,
    'Stage order - check what comes after Training' as note
FROM pipeline_stage_definitions
WHERE is_terminal = 0
ORDER BY id;

-- Show how many agents match our criteria
SELECT 
    COUNT(*) as agents_received_first_pack,
    SUM(CASE WHEN au.pipeline_id IS NULL THEN 1 ELSE 0 END) as without_pipeline_id,
    SUM(CASE WHEN au.pipeline_id IS NOT NULL AND p.id IS NULL THEN 1 ELSE 0 END) as orphaned_pipeline_id,
    SUM(CASE WHEN au.pipeline_id IS NOT NULL AND p.id IS NOT NULL THEN 1 ELSE 0 END) as valid_pipeline_id,
    'These agents have received 1st pack' as note
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1;

-- Show the agents who will be processed
SELECT 
    au.id,
    au.lagnname,
    au.agtnum,
    au.mga,
    au.pipeline_id,
    p.id as actual_pipeline_id,
    p.step as current_stage,
    lr.sent_date as first_pack_sent,
    CASE 
        WHEN au.pipeline_id IS NULL THEN 'Will CREATE pipeline (no pipeline_id)'
        WHEN au.pipeline_id IS NOT NULL AND p.id IS NULL THEN CONCAT('Will CREATE pipeline (orphaned pipeline_id=', au.pipeline_id, ')')
        WHEN p.step IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding') THEN CONCAT('Will UPDATE pipeline ', p.id, ' to Training')
        WHEN p.step = 'Training' THEN CONCAT('Will COMPLETE items for pipeline ', p.id)
        ELSE CONCAT('Will SKIP pipeline ', p.id, ' (already beyond Training)')
    END as action
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
ORDER BY au.lagnname;

-- =============================================================================
-- This script keeps agents at Training stage and completes items before "Attend Training"
-- Agents who have received their first pack stay at Training until they attend training
-- =============================================================================

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
-- STEP 1: Create pipeline records for agents without valid pipeline_id
-- This includes agents with NULL pipeline_id OR orphaned pipeline_id (pointing to non-existent record)
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
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND (au.pipeline_id IS NULL OR p.id IS NULL)  -- No pipeline_id OR orphaned pipeline_id
  AND lr.type = '1st Pack'
  AND lr.sent = 1;

-- Link newly created pipeline records to activeusers (including fixing orphaned references)
UPDATE activeusers au
JOIN pipeline p ON p.agentnum = au.agtnum
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p_old ON au.pipeline_id = p_old.id
SET au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND (au.pipeline_id IS NULL OR p_old.id IS NULL)  -- Update if NULL or orphaned
  AND p.step = 'Training'
  AND p.date_added >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
  AND lr.type = '1st Pack'
  AND lr.sent = 1;

-- Record pipeline step entry for new records
INSERT INTO pipeline_steps (recruit_id, step, date_entered)
SELECT 
    p.id as recruit_id,
    'Training' as step,
    NOW() as date_entered
FROM pipeline p
JOIN activeusers au ON p.agentnum = au.agtnum
JOIN leads_released lr ON lr.userId = au.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step = 'Training'
  AND p.date_added >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_steps ps
      WHERE ps.recruit_id = p.id
      AND ps.step = 'Training'
  );

-- =============================================================================
-- STEP 2: Update existing pipeline records to Training if at earlier stage
-- =============================================================================

-- Close previous pipeline_steps for agents at stages before Training
UPDATE pipeline_steps ps
JOIN pipeline p ON ps.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
SET ps.date_exited = NOW()
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND ps.step = p.step
  AND ps.date_exited IS NULL
  AND lr.type = '1st Pack'
  AND lr.sent = 1;

-- Update pipeline records to Training stage
UPDATE pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
SET p.step = 'Training',
    p.date_last_updated = NOW()
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND lr.type = '1st Pack'
  AND lr.sent = 1;

-- Record new Training stage entry
INSERT INTO pipeline_steps (recruit_id, step, date_entered)
SELECT 
    p.id as recruit_id,
    'Training' as step,
    NOW() as date_entered
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step = 'Training'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_steps ps
      WHERE ps.recruit_id = p.id
      AND ps.step = 'Training'
      AND ps.date_exited IS NULL
  );

-- =============================================================================
-- STEP 3: Complete ALL prior stage items (Overview → On-boarding)
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
JOIN leads_released lr ON lr.userId = au.id
CROSS JOIN pipeline_checklist_items pci
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND pci.stage_name IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND pci.active = 1
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_checklist_progress pcp
      WHERE pcp.recruit_id = p.id
      AND pcp.checklist_item_id = pci.id
  );

-- Update to completed if already exists but not marked complete (prior stages)
UPDATE pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
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
  AND pcp.completed = 0
  AND pci.stage_name IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND pci.active = 1;

-- =============================================================================
-- STEP 4: Complete Training items before "Attend Training"
-- This includes "Receive First Lead Pack" (item_order < "Attend Training")
-- =============================================================================

-- Complete Training items before "Attend Training" for all agents who received first pack
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
CROSS JOIN pipeline_checklist_items pci
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND pci.stage_name = 'Training'
  AND pci.active = 1
  AND pci.item_order < (
      SELECT item_order FROM pipeline_checklist_items 
      WHERE stage_name = 'Training' 
      AND item_name = 'Attend Training' 
      AND active = 1 LIMIT 1
  )
  AND NOT EXISTS (
      SELECT 1 FROM pipeline_checklist_progress pcp
      WHERE pcp.recruit_id = p.id
      AND pcp.checklist_item_id = pci.id
  );

-- Update to completed if already exists but not marked complete
UPDATE pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
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
  AND pcp.completed = 0
  AND pci.stage_name = 'Training'
  AND pci.active = 1
  AND pci.item_order < (
      SELECT item_order FROM pipeline_checklist_items 
      WHERE stage_name = 'Training' 
      AND item_name = 'Attend Training' 
      AND active = 1 LIMIT 1
  );

-- =============================================================================
-- Summary and results
-- =============================================================================

-- Show summary of pipeline records that were created/updated
SELECT 
    'Pipeline records processed (1st pack received)' as summary,
    COUNT(*) as total_agents,
    COUNT(DISTINCT p.id) as pipeline_records_updated
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1;

-- Show checklist items completed summary
SELECT 
    'Checklist items completed' as summary,
    pci.stage_name,
    COUNT(DISTINCT pcp.recruit_id) as agents_with_item_complete
FROM pipeline_checklist_progress pcp
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND pcp.completed = 1
GROUP BY pci.stage_name
ORDER BY FIELD(pci.stage_name, 'Overview', 'Final Decision', 'Licensing', 'On-boarding', 'Training');

-- Show the results
SELECT 
    au.lagnname,
    au.agtnum,
    p.id as pipeline_id,
    p.step,
    ps.date_entered as stage_started,
    lr.sent_date as first_pack_sent,
    au.mga,
    (SELECT COUNT(*) FROM pipeline_checklist_progress pcp 
     WHERE pcp.recruit_id = p.id AND pcp.completed = 1) as items_completed
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
JOIN pipeline_steps ps ON ps.recruit_id = p.id AND ps.step = p.step AND ps.date_exited IS NULL
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
ORDER BY ps.date_entered DESC
LIMIT 20;

