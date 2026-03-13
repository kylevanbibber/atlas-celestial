-- =============================================================================
-- Cleanup Orphaned Checklist Progress Records
-- =============================================================================
-- This script removes checklist progress records that reference non-existent
-- pipeline records. Run this BEFORE running the seed scripts.
--
-- This happens when pipeline records are deleted but the checklist progress
-- records that reference them are not cleaned up.
-- =============================================================================

-- Show how many orphaned records exist
SELECT 
    'Orphaned pipeline_checklist_progress records' as description,
    COUNT(*) as count
FROM pipeline_checklist_progress pcp
LEFT JOIN pipeline p ON pcp.recruit_id = p.id
WHERE p.id IS NULL;

-- Show details of orphaned records (first 20)
SELECT 
    pcp.id,
    pcp.recruit_id as orphaned_pipeline_id,
    pcp.checklist_item_id,
    pcp.completed,
    pcp.completed_at,
    'Pipeline record does not exist' as issue
FROM pipeline_checklist_progress pcp
LEFT JOIN pipeline p ON pcp.recruit_id = p.id
WHERE p.id IS NULL
ORDER BY pcp.recruit_id
LIMIT 20;

-- =============================================================================
-- DELETE orphaned checklist progress records
-- =============================================================================

DELETE pcp
FROM pipeline_checklist_progress pcp
LEFT JOIN pipeline p ON pcp.recruit_id = p.id
WHERE p.id IS NULL;

-- Show results
SELECT 
    'Orphaned records cleaned up' as status,
    ROW_COUNT() as records_deleted;

-- Verify cleanup
SELECT 
    'Remaining orphaned records (should be 0)' as description,
    COUNT(*) as count
FROM pipeline_checklist_progress pcp
LEFT JOIN pipeline p ON pcp.recruit_id = p.id
WHERE p.id IS NULL;

