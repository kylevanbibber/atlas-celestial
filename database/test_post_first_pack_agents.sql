-- Test query to see which agents should get pipeline records created
-- Run this BEFORE running the seed script to diagnose the issue

-- 1. Check if there are ANY agents with first pack sent
SELECT 
    'Step 1: Agents with 1st pack sent' as check_step,
    COUNT(*) as count
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
WHERE lr.type = '1st Pack'
  AND lr.sent = 1;

-- 2. Check how many meet ALL criteria
SELECT 
    'Step 2: Agents meeting ALL criteria' as check_step,
    COUNT(*) as count
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1;

-- 3. Check how many are missing pipeline_id (these will get pipeline records CREATED)
SELECT 
    'Step 3a: Need pipeline CREATED (pipeline_id IS NULL)' as check_step,
    COUNT(*) as count
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND au.pipeline_id IS NULL
  AND lr.type = '1st Pack'
  AND lr.sent = 1;

-- 3b. Check for ORPHANED pipeline_id (pipeline_id exists but record doesn't)
SELECT 
    'Step 3b: Need pipeline CREATED (orphaned pipeline_id)' as check_step,
    COUNT(*) as count
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND au.pipeline_id IS NOT NULL
  AND p.id IS NULL  -- Orphaned - pipeline_id points to non-existent record
  AND lr.type = '1st Pack'
  AND lr.sent = 1;

-- 3c. TOTAL needing pipeline created (NULL + orphaned)
SELECT 
    'Step 3c: TOTAL needing pipeline CREATED' as check_step,
    COUNT(*) as count
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND (au.pipeline_id IS NULL OR p.id IS NULL)  -- NULL or orphaned
  AND lr.type = '1st Pack'
  AND lr.sent = 1;

-- 4. Show the actual agents who will get pipeline records created
SELECT 
    au.id as activeuser_id,
    au.lagnname,
    au.agtnum,
    au.mga,
    au.pending,
    au.released,
    au.Active,
    au.managerActive,
    au.pipeline_id,
    p.id as actual_pipeline_id,
    lr.sent,
    lr.sent_date,
    CASE 
        WHEN au.pipeline_id IS NULL THEN 'WILL CREATE (no pipeline_id)'
        WHEN p.id IS NULL THEN CONCAT('WILL CREATE (orphaned pipeline_id=', au.pipeline_id, ')')
        ELSE 'Has valid pipeline'
    END as action
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND (au.pipeline_id IS NULL OR p.id IS NULL)
  AND lr.type = '1st Pack'
  AND lr.sent = 1
ORDER BY au.lagnname
LIMIT 20;

-- 5. Check if there are agents who SHOULD qualify but don't (common issues)
-- Show agents with first pack but failing one of the criteria
SELECT 
    au.id,
    au.lagnname,
    au.agtnum,
    au.pending,
    au.released,
    au.Active,
    au.managerActive,
    au.pipeline_id,
    lr.type,
    lr.sent,
    CASE 
        WHEN au.pending != 0 THEN 'FAIL: pending not 0'
        WHEN au.released != 0 THEN 'FAIL: released not 0'
        WHEN au.Active != 'y' THEN 'FAIL: Active not y'
        WHEN au.managerActive != 'y' THEN 'FAIL: managerActive not y'
        WHEN lr.sent != 1 THEN 'FAIL: sent not 1'
        WHEN au.pipeline_id IS NOT NULL THEN 'Already has pipeline_id'
        ELSE 'SHOULD QUALIFY'
    END as status
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
WHERE lr.type = '1st Pack'
ORDER BY au.lagnname
LIMIT 20;

