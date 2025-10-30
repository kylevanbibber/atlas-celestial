-- =============================================================================
-- Cleanup Inactive and Non-AGT Agents from Pipeline
-- =============================================================================
-- This script removes agents from the pipeline system who should not be tracked:
-- 1. Agents with clname != 'AGT' (MGAs, RGAs, etc. should not be in pipeline)
-- 2. Agents with Role = 'Trainee'
-- 3. Agents with Active = 'n'
-- 4. Agents with managerActive = 'n'
-- 5. Agents with esid older than 60 days
--
-- This will:
-- - Delete their pipeline_checklist_progress records
-- - Delete their pipeline_steps records
-- - Delete their pipeline records
-- - Set their activeusers.pipeline_id to NULL
-- =============================================================================

-- Show agents that will be removed
SELECT 
    'Agents to be removed from pipeline' as status,
    COUNT(DISTINCT p.id) as total_pipeline_records,
    SUM(CASE WHEN au.clname != 'AGT' OR au.clname IS NULL THEN 1 ELSE 0 END) as non_agt,
    SUM(CASE WHEN au.Role = 'Trainee' THEN 1 ELSE 0 END) as trainees,
    SUM(CASE WHEN au.Active = 'n' THEN 1 ELSE 0 END) as inactive_agents,
    SUM(CASE WHEN au.managerActive = 'n' THEN 1 ELSE 0 END) as inactive_managers,
    SUM(CASE WHEN au.esid < DATE_SUB(NOW(), INTERVAL 60 DAY) THEN 1 ELSE 0 END) as old_esid
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
WHERE (au.clname != 'AGT' OR au.clname IS NULL)
   OR au.Role = 'Trainee'
   OR au.Active = 'n'
   OR au.managerActive = 'n'
   OR au.esid < DATE_SUB(NOW(), INTERVAL 60 DAY);

-- Show sample of agents to be removed
SELECT 
    au.lagnname,
    au.agtnum,
    au.clname,
    au.Role,
    au.Active,
    au.managerActive,
    au.esid,
    DATEDIFF(NOW(), au.esid) as days_since_esid,
    p.id as pipeline_id,
    p.step as current_step,
    CASE 
        WHEN au.esid < DATE_SUB(NOW(), INTERVAL 60 DAY) THEN 'ESID older than 60 days'
        WHEN au.clname != 'AGT' OR au.clname IS NULL THEN 'Not AGT'
        WHEN au.Role = 'Trainee' THEN 'Trainee role'
        WHEN au.Active = 'n' THEN 'Inactive agent'
        WHEN au.managerActive = 'n' THEN 'Inactive manager'
    END as removal_reason
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
WHERE (au.clname != 'AGT' OR au.clname IS NULL)
   OR au.Role = 'Trainee'
   OR au.Active = 'n'
   OR au.managerActive = 'n'
   OR au.esid < DATE_SUB(NOW(), INTERVAL 60 DAY)
ORDER BY au.lagnname
LIMIT 50;

-- =============================================================================
-- STEP 1: Delete pipeline_checklist_progress records
-- =============================================================================

DELETE pcp
FROM pipeline_checklist_progress pcp
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
WHERE (au.clname != 'AGT' OR au.clname IS NULL)
   OR au.Role = 'Trainee'
   OR au.Active = 'n'
   OR au.managerActive = 'n'
   OR au.esid < DATE_SUB(NOW(), INTERVAL 60 DAY);

SELECT CONCAT('Deleted ', ROW_COUNT(), ' checklist progress records') as step1_result;

-- =============================================================================
-- STEP 2: Delete pipeline_steps records
-- =============================================================================

DELETE ps
FROM pipeline_steps ps
JOIN pipeline p ON ps.recruit_id = p.id
JOIN activeusers au ON au.pipeline_id = p.id
WHERE (au.clname != 'AGT' OR au.clname IS NULL)
   OR au.Role = 'Trainee'
   OR au.Active = 'n'
   OR au.managerActive = 'n'
   OR au.esid < DATE_SUB(NOW(), INTERVAL 60 DAY);

SELECT CONCAT('Deleted ', ROW_COUNT(), ' pipeline steps records') as step2_result;

-- =============================================================================
-- STEP 3: Set activeusers.pipeline_id to NULL
-- =============================================================================

UPDATE activeusers
SET pipeline_id = NULL
WHERE ((clname != 'AGT' OR clname IS NULL)
   OR Role = 'Trainee'
   OR Active = 'n'
   OR managerActive = 'n'
   OR esid < DATE_SUB(NOW(), INTERVAL 60 DAY))
  AND pipeline_id IS NOT NULL;

SELECT CONCAT('Unlinked ', ROW_COUNT(), ' activeusers from pipeline') as step3_result;

-- =============================================================================
-- STEP 4: Delete pipeline records
-- =============================================================================

-- Delete pipeline records that are no longer linked to any activeuser
DELETE p
FROM pipeline p
LEFT JOIN activeusers au ON au.pipeline_id = p.id
WHERE au.id IS NULL;

SELECT CONCAT('Deleted ', ROW_COUNT(), ' pipeline records') as step4_result;

-- =============================================================================
-- Verification and Summary
-- =============================================================================

-- Verify no non-AGT, trainees, inactive agents, or old esid agents remain in pipeline
SELECT 
    'Verification: Should be zero' as status,
    COUNT(DISTINCT p.id) as agents_remaining_that_should_not_be
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
WHERE (au.clname != 'AGT' OR au.clname IS NULL)
   OR au.Role = 'Trainee'
   OR au.Active = 'n'
   OR au.managerActive = 'n'
   OR au.esid < DATE_SUB(NOW(), INTERVAL 60 DAY);

-- Show current pipeline status after cleanup
SELECT 
    'After cleanup - Pipeline status' as status,
    COUNT(DISTINCT p.id) as total_pipeline_records,
    COUNT(DISTINCT au.id) as linked_to_activeusers,
    COUNT(DISTINCT pcp.id) as total_checklist_progress,
    COUNT(DISTINCT ps.id) as total_pipeline_steps
FROM pipeline p
LEFT JOIN activeusers au ON au.pipeline_id = p.id
LEFT JOIN pipeline_checklist_progress pcp ON pcp.recruit_id = p.id
LEFT JOIN pipeline_steps ps ON ps.recruit_id = p.id;

-- Show breakdown of remaining agents by status
SELECT 
    'Remaining agents breakdown' as category,
    p.step,
    COUNT(DISTINCT p.id) as agent_count,
    COUNT(DISTINCT CASE WHEN au.pending = 1 THEN p.id END) as pending_agents,
    COUNT(DISTINCT CASE WHEN au.pending = 0 AND au.released = 0 THEN p.id END) as active_agents,
    COUNT(DISTINCT CASE WHEN au.released = 1 THEN p.id END) as released_agents
FROM pipeline p
LEFT JOIN activeusers au ON au.pipeline_id = p.id
WHERE au.Active = 'y' AND au.managerActive = 'y'
GROUP BY p.step
ORDER BY FIELD(p.step, 'Overview', 'Final Decision', 'Licensing', 'On-boarding', 'Training');

