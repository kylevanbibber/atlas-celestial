-- =============================================================================
-- Sync "Activate Agent Number" Checklist Item with activeusers.pending Status
-- =============================================================================
-- This script checks pipeline records where "Activate Agent Number" is not yet
-- completed, and if the agent's pending status in activeusers has changed to 0,
-- it automatically completes that checklist item.
--
-- Purpose: Ensure agents who have been activated are properly reflected in the
-- pipeline checklist, even if the activation happened outside the normal flow.
-- =============================================================================

-- Show current status before sync
SELECT 
    'Before Sync' as status,
    COUNT(*) as total_pending_0_agents,
    SUM(CASE WHEN pcp.completed = 0 OR pcp.completed IS NULL THEN 1 ELSE 0 END) as not_completed_in_pipeline,
    SUM(CASE WHEN pcp.completed = 1 THEN 1 ELSE 0 END) as already_completed
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
LEFT JOIN pipeline_checklist_items pci ON pci.item_name LIKE '%Activate Agent Number%' 
    AND pci.active = 1 
    AND pci.stage_name = 'On-boarding'
LEFT JOIN pipeline_checklist_progress pcp ON pcp.recruit_id = p.id 
    AND pcp.checklist_item_id = pci.id
WHERE au.pending = 0
  AND au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y';

-- =============================================================================
-- STEP 1: Find the "Activate Agent Number" checklist item ID
-- =============================================================================
SET @activate_item_id = (
    SELECT id 
    FROM pipeline_checklist_items 
    WHERE (item_name LIKE '%Activate Agent Number%' 
           OR item_name LIKE '%Agent Number%')
    AND active = 1
    LIMIT 1
);

SELECT CONCAT('Found "Activate Agent Number" checklist item with ID: ', COALESCE(@activate_item_id, 'NOT FOUND')) as item_lookup;

-- =============================================================================
-- STEP 2: Complete "Activate Agent Number" for agents with pending = 0
-- =============================================================================

-- Insert new completion records for agents who don't have progress tracked yet
INSERT IGNORE INTO pipeline_checklist_progress (recruit_id, checklist_item_id, completed, started_at, completed_at)
SELECT 
    p.id as recruit_id,
    @activate_item_id as checklist_item_id,
    1 as completed,
    NOW() as started_at,
    NOW() as completed_at
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND @activate_item_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 
      FROM pipeline_checklist_progress pcp
      WHERE pcp.recruit_id = p.id 
        AND pcp.checklist_item_id = @activate_item_id
  );

SELECT CONCAT('Inserted ', ROW_COUNT(), ' new "Activate Agent Number" completion records') as step2_insert_result;

-- Update existing records that are marked as incomplete (completed = 0)
UPDATE pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
SET pcp.completed = 1,
    pcp.started_at = COALESCE(pcp.started_at, NOW()),
    pcp.completed_at = NOW()
WHERE au.pending = 0
  AND au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND pcp.checklist_item_id = @activate_item_id
  AND pcp.completed = 0;

SELECT CONCAT('Updated ', ROW_COUNT(), ' existing incomplete records to completed') as step2_update_result;

-- =============================================================================
-- STEP 3: Verify results
-- =============================================================================

-- Show detailed results by agent
SELECT 
    au.lagnname,
    au.agtnum,
    au.pending,
    p.id as pipeline_id,
    p.step as pipeline_stage,
    pcp.completed as activate_item_completed,
    pcp.completed_at as activate_completed_at,
    CASE 
        WHEN pcp.completed = 1 THEN '✓ Completed'
        WHEN pcp.completed = 0 THEN '✗ Not Completed (Needs Manual Review)'
        ELSE '⚠ No Progress Record'
    END as status
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
LEFT JOIN pipeline_checklist_progress pcp ON pcp.recruit_id = p.id 
    AND pcp.checklist_item_id = @activate_item_id
WHERE au.pending = 0
  AND au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
ORDER BY au.lagnname
LIMIT 50;

-- Summary statistics
SELECT 
    'After Sync - Summary' as status,
    COUNT(*) as total_pending_0_agents,
    SUM(CASE WHEN pcp.completed = 0 OR pcp.completed IS NULL THEN 1 ELSE 0 END) as still_not_completed,
    SUM(CASE WHEN pcp.completed = 1 THEN 1 ELSE 0 END) as now_completed,
    CONCAT(ROUND((SUM(CASE WHEN pcp.completed = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1), '%') as completion_rate
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
LEFT JOIN pipeline_checklist_progress pcp ON pcp.recruit_id = p.id 
    AND pcp.checklist_item_id = @activate_item_id
WHERE au.pending = 0
  AND au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y';

-- =============================================================================
-- STEP 4: Identify any agents who still need attention
-- =============================================================================

-- Show agents with pending = 0 but activate item still not completed
-- (This should be empty after the sync, but shows if there are data issues)
SELECT 
    'Agents Needing Manual Review' as alert,
    au.id,
    au.lagnname,
    au.agtnum,
    au.pending,
    p.id as pipeline_id,
    p.step,
    'Agent is not pending but "Activate Agent Number" is not completed' as issue
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
LEFT JOIN pipeline_checklist_progress pcp ON pcp.recruit_id = p.id 
    AND pcp.checklist_item_id = @activate_item_id
WHERE au.pending = 0
  AND au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND (pcp.completed IS NULL OR pcp.completed = 0);

-- =============================================================================
-- Notes
-- =============================================================================
-- This script should be run:
-- 1. As a one-time sync to fix historical data
-- 2. Periodically (e.g., daily cron job) to catch any agents who were
--    activated outside the normal pipeline flow
-- 3. After bulk imports or data migrations
--
-- The script is idempotent - safe to run multiple times without creating
-- duplicate records or incorrect data.
-- =============================================================================

