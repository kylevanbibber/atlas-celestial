-- =============================================================================
-- Migrate On-boarding Recruits to Training Stage
-- =============================================================================
-- This script updates EXISTING recruits who are currently at the "On-boarding" 
-- stage to "Training" stage after moving "Activate Agent Number" item from 
-- On-boarding to Training.
--
-- Changes:
-- 1. Update pipeline.step from 'On-boarding' to 'Training' (EXISTING records only)
-- 2. Update pipeline_steps to close 'On-boarding' and open 'Training' (EXISTING records only)
--
-- NOTE: This script does NOT create new pipeline records - it only updates existing ones.
-- =============================================================================

-- Show current status
SELECT 
    'Recruits currently at On-boarding stage' as status,
    COUNT(*) as total_recruits
FROM pipeline
WHERE step = 'On-boarding';

-- Show sample of recruits to be migrated
SELECT 
    p.id as pipeline_id,
    p.recruit_first,
    p.recruit_last,
    p.step as current_step,
    p.date_added,
    p.date_last_updated,
    (SELECT COUNT(*) 
     FROM pipeline_checklist_progress pcp 
     WHERE pcp.recruit_id = p.id AND pcp.completed = 1) as items_completed
FROM pipeline p
WHERE p.step = 'On-boarding'
ORDER BY p.date_added DESC
LIMIT 20;

-- =============================================================================
-- STEP 1: Close current On-boarding pipeline steps
-- =============================================================================

UPDATE pipeline_steps ps
JOIN pipeline p ON ps.recruit_id = p.id
SET ps.date_exited = NOW()
WHERE p.step = 'On-boarding'
  AND ps.step = 'On-boarding'
  AND ps.date_exited IS NULL;

SELECT CONCAT('Closed ', ROW_COUNT(), ' On-boarding pipeline steps') as step1_result;

-- =============================================================================
-- STEP 2: Update pipeline records to Training stage
-- =============================================================================

UPDATE pipeline
SET step = 'Training',
    date_last_updated = NOW()
WHERE step = 'On-boarding';

SELECT CONCAT('Updated ', ROW_COUNT(), ' pipeline records to Training stage') as step2_result;

-- =============================================================================
-- STEP 3: Create new Training pipeline steps
-- =============================================================================

INSERT INTO pipeline_steps (recruit_id, step, date_entered)
SELECT 
    p.id as recruit_id,
    'Training' as step,
    NOW() as date_entered
FROM pipeline p
WHERE p.step = 'Training'
  AND NOT EXISTS (
    SELECT 1 
    FROM pipeline_steps ps 
    WHERE ps.recruit_id = p.id 
      AND ps.step = 'Training' 
      AND ps.date_exited IS NULL
  );

SELECT CONCAT('Created ', ROW_COUNT(), ' new Training pipeline steps') as step3_result;

-- =============================================================================
-- Summary and Results
-- =============================================================================

-- Show updated status
SELECT 
    'After migration' as status,
    COUNT(*) as total_at_training,
    COUNT(DISTINCT au.pipeline_id) as linked_to_activeusers
FROM pipeline p
LEFT JOIN activeusers au ON au.pipeline_id = p.id
WHERE p.step = 'Training';

-- Show sample of migrated recruits
SELECT 
    p.id as pipeline_id,
    p.recruit_first,
    p.recruit_last,
    p.step as current_step,
    p.date_last_updated as last_updated,
    (SELECT COUNT(*) 
     FROM pipeline_checklist_progress pcp 
     WHERE pcp.recruit_id = p.id AND pcp.completed = 1) as items_completed,
    (SELECT date_entered 
     FROM pipeline_steps ps 
     WHERE ps.recruit_id = p.id AND ps.step = 'Training' 
     ORDER BY date_entered DESC LIMIT 1) as training_date_entered
FROM pipeline p
WHERE p.step = 'Training'
  AND p.date_last_updated >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
ORDER BY p.date_last_updated DESC
LIMIT 20;

-- Verify no recruits remain at On-boarding
SELECT 
    'Verification: Recruits still at On-boarding' as status,
    COUNT(*) as should_be_zero
FROM pipeline
WHERE step = 'On-boarding';

