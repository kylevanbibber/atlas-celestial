-- =============================================================================
-- Cleanup Duplicate Pipeline Records
-- =============================================================================
-- This script removes duplicate pipeline records that may have been created
-- and keeps only the original record for each agent
-- =============================================================================

-- Show duplicate pipeline records
SELECT 
    'Duplicate pipeline records' as status,
    agentnum,
    COUNT(*) as duplicate_count,
    GROUP_CONCAT(id ORDER BY id) as pipeline_ids,
    MIN(id) as keep_id
FROM pipeline
GROUP BY agentnum
HAVING COUNT(*) > 1;

-- =============================================================================
-- STEP 1: Update activeusers to point to the ORIGINAL pipeline_id
-- =============================================================================

UPDATE activeusers au
JOIN (
    SELECT 
        agentnum,
        MIN(id) as original_pipeline_id
    FROM pipeline
    GROUP BY agentnum
    HAVING COUNT(*) > 1
) dup ON au.agtnum = dup.agentnum
SET au.pipeline_id = dup.original_pipeline_id
WHERE au.pipeline_id IS NOT NULL;

SELECT CONCAT('Updated ', ROW_COUNT(), ' activeusers to point to original pipeline') as step1_result;

-- =============================================================================
-- STEP 2: Delete pipeline_checklist_progress for duplicate pipelines
-- =============================================================================

DELETE pcp
FROM pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN (
    SELECT 
        agentnum,
        MIN(id) as keep_id
    FROM pipeline
    GROUP BY agentnum
    HAVING COUNT(*) > 1
) dup ON p.agentnum = dup.agentnum AND p.id != dup.keep_id;

SELECT CONCAT('Deleted ', ROW_COUNT(), ' checklist progress records from duplicates') as step2_result;

-- =============================================================================
-- STEP 3: Delete pipeline_steps for duplicate pipelines
-- =============================================================================

DELETE ps
FROM pipeline_steps ps
JOIN pipeline p ON ps.recruit_id = p.id
JOIN (
    SELECT 
        agentnum,
        MIN(id) as keep_id
    FROM pipeline
    GROUP BY agentnum
    HAVING COUNT(*) > 1
) dup ON p.agentnum = dup.agentnum AND p.id != dup.keep_id;

SELECT CONCAT('Deleted ', ROW_COUNT(), ' pipeline steps from duplicates') as step3_result;

-- =============================================================================
-- STEP 4: Delete duplicate pipeline records (keep oldest)
-- =============================================================================

DELETE p
FROM pipeline p
JOIN (
    SELECT 
        agentnum,
        MIN(id) as keep_id
    FROM pipeline
    GROUP BY agentnum
    HAVING COUNT(*) > 1
) dup ON p.agentnum = dup.agentnum AND p.id != dup.keep_id;

SELECT CONCAT('Deleted ', ROW_COUNT(), ' duplicate pipeline records') as step4_result;

-- =============================================================================
-- Verify cleanup
-- =============================================================================

SELECT 
    'After cleanup - duplicates remaining' as status,
    COUNT(*) as should_be_zero
FROM (
    SELECT agentnum
    FROM pipeline
    GROUP BY agentnum
    HAVING COUNT(*) > 1
) dups;

