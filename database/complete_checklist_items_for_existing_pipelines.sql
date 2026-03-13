-- =============================================================================
-- Complete Checklist Items for Existing Pipeline Records
-- =============================================================================
-- This script completes checklist items for agents who already have pipeline
-- records at Training stage but haven't had their checklist items completed yet.
--
-- Run this if you've already created pipeline records but need to backfill
-- the checklist item completion.
-- =============================================================================

-- Show current status before completion
SELECT 
    'Before completion - Agents at Training stage' as status,
    COUNT(DISTINCT p.id) as total_pipeline_records,
    COUNT(DISTINCT pcp.recruit_id) as agents_with_completed_items,
    COUNT(DISTINCT p.id) - COUNT(DISTINCT pcp.recruit_id) as agents_needing_items_completed
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline_checklist_progress pcp ON pcp.recruit_id = p.id AND pcp.completed = 1
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND p.step = 'Training';

-- =============================================================================
-- STEP 1: Complete ALL prior stage items (Overview → On-boarding)
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
CROSS JOIN pipeline_checklist_items pci
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND p.step = 'Training'
  AND pci.stage_name IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND pci.active = 1;

SELECT CONCAT('Completed ', ROW_COUNT(), ' prior stage checklist items') as step1_result;

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
  AND p.step = 'Training'
  AND pcp.completed = 0
  AND pci.stage_name IN ('Overview', 'Final Decision', 'Licensing', 'On-boarding')
  AND pci.active = 1;

SELECT CONCAT('Updated ', ROW_COUNT(), ' incomplete prior stage items to completed') as step1_update_result;

-- =============================================================================
-- STEP 2: Complete Training items before "Attend Training"
-- This includes "Receive First Lead Pack" (item_order < "Attend Training")
-- =============================================================================

-- Complete Training items before "Attend Training" for all agents who received first pack
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
CROSS JOIN pipeline_checklist_items pci
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND p.step = 'Training'
  AND pci.stage_name = 'Training'
  AND pci.active = 1
  AND pci.item_order < (
      SELECT item_order FROM pipeline_checklist_items 
      WHERE stage_name = 'Training' 
      AND item_name = 'Attend Training' 
      AND active = 1 LIMIT 1
  );

SELECT CONCAT('Completed ', ROW_COUNT(), ' Training items before Attend Training') as step2_result;

-- Update to completed if already exists but not marked complete (Training items)
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
  AND p.step = 'Training'
  AND pcp.completed = 0
  AND pci.stage_name = 'Training'
  AND pci.active = 1
  AND pci.item_order < (
      SELECT item_order FROM pipeline_checklist_items 
      WHERE stage_name = 'Training' 
      AND item_name = 'Attend Training' 
      AND active = 1 LIMIT 1
  );

SELECT CONCAT('Updated ', ROW_COUNT(), ' incomplete Training items to completed') as step2_update_result;

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
JOIN leads_released lr ON lr.userId = au.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND p.step = 'Training'
  AND pcp.completed = 1
GROUP BY pci.stage_name
ORDER BY FIELD(pci.stage_name, 'Overview', 'Final Decision', 'Licensing', 'On-boarding', 'Training');

-- Show sample of agents with completed items (first 20)
SELECT 
    au.lagnname,
    au.agtnum,
    p.id as pipeline_id,
    p.step,
    lr.sent_date as first_pack_sent,
    (SELECT COUNT(*) FROM pipeline_checklist_progress pcp 
     WHERE pcp.recruit_id = p.id AND pcp.completed = 1) as items_completed
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND p.step = 'Training'
ORDER BY p.id
LIMIT 20;

-- Final status
SELECT 
    'After completion - Status' as status,
    COUNT(DISTINCT p.id) as total_pipeline_records,
    COUNT(DISTINCT CASE WHEN pcp.recruit_id IS NOT NULL THEN p.id END) as agents_with_completed_items,
    AVG(item_counts.items_completed) as avg_items_per_agent
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline_checklist_progress pcp ON pcp.recruit_id = p.id AND pcp.completed = 1
LEFT JOIN (
    SELECT recruit_id, COUNT(*) as items_completed
    FROM pipeline_checklist_progress
    WHERE completed = 1
    GROUP BY recruit_id
) item_counts ON item_counts.recruit_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND p.step = 'Training';

