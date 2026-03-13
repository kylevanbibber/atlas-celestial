-- =============================================================================
-- Fix NULL recruiting_agent and code_to in Pipeline Table
-- =============================================================================
-- This script updates pipeline rows where recruiting_agent and code_to are NULL
-- by finding the appropriate recruiter from the agent's hierarchy:
-- 1. First try: SA (Senior Associate)
-- 2. If SA is NULL, try: GA (General Agent)
-- 3. If GA is NULL, try: MGA (Managing General Agent)
--
-- The recruiting_agent and code_to fields are set to the lagnname of the
-- recruiter found in the hierarchy.
-- =============================================================================

-- Show current status before fix
SELECT 
    'Before Fix' as status,
    COUNT(*) as total_pipeline_rows,
    SUM(CASE WHEN recruiting_agent IS NULL THEN 1 ELSE 0 END) as null_recruiting_agent,
    SUM(CASE WHEN code_to IS NULL THEN 1 ELSE 0 END) as null_code_to,
    SUM(CASE WHEN recruiting_agent IS NULL AND code_to IS NULL THEN 1 ELSE 0 END) as both_null
FROM pipeline;

-- =============================================================================
-- STEP 1: Show pipeline rows with NULL recruiting_agent and their hierarchy
-- =============================================================================
SELECT 
    'Rows that will be updated' as info,
    p.id as pipeline_id,
    p.recruit_first,
    p.recruit_last,
    p.step,
    p.recruiting_agent as current_recruiting_agent,
    p.code_to as current_code_to,
    au.id as agent_id,
    au.lagnname as agent_name,
    au.sa,
    au.ga,
    au.mga,
    COALESCE(au.sa, au.ga, au.mga) as recruiter_to_use,
    CASE 
        WHEN au.sa IS NOT NULL THEN 'SA'
        WHEN au.ga IS NOT NULL THEN 'GA'
        WHEN au.mga IS NOT NULL THEN 'MGA'
        ELSE 'NONE'
    END as recruiter_level,
    recruiter.id as recruiter_id,
    recruiter.lagnname as recruiter_lagnname
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
LEFT JOIN activeusers recruiter ON recruiter.lagnname = COALESCE(au.sa, au.ga, au.mga)
WHERE p.recruiting_agent IS NULL 
   OR p.code_to IS NULL
ORDER BY p.id
LIMIT 50;

-- =============================================================================
-- STEP 2: Verify recruiters exist in activeusers
-- =============================================================================
SELECT 
    'Verification - Recruiter Lookup' as info,
    COUNT(DISTINCT COALESCE(au.sa, au.ga, au.mga)) as unique_recruiters,
    COUNT(DISTINCT recruiter.id) as recruiters_found_in_activeusers,
    COUNT(DISTINCT CASE WHEN recruiter.id IS NULL THEN COALESCE(au.sa, au.ga, au.mga) END) as recruiters_not_found
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
LEFT JOIN activeusers recruiter ON recruiter.lagnname = COALESCE(au.sa, au.ga, au.mga)
WHERE p.recruiting_agent IS NULL 
   OR p.code_to IS NULL;

-- Show recruiters that don't exist in activeusers (if any)
SELECT 
    'WARNING: Recruiters not found in activeusers' as warning,
    COALESCE(au.sa, au.ga, au.mga) as missing_recruiter_lagnname,
    COUNT(*) as pipeline_rows_affected
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
LEFT JOIN activeusers recruiter ON recruiter.lagnname = COALESCE(au.sa, au.ga, au.mga)
WHERE (p.recruiting_agent IS NULL OR p.code_to IS NULL)
  AND COALESCE(au.sa, au.ga, au.mga) IS NOT NULL
  AND recruiter.id IS NULL
GROUP BY COALESCE(au.sa, au.ga, au.mga);

-- =============================================================================
-- STEP 3: Update recruiting_agent with hierarchy value
-- =============================================================================
UPDATE pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
SET p.recruiting_agent = COALESCE(au.sa, au.ga, au.mga),
    p.date_last_updated = NOW()
WHERE p.recruiting_agent IS NULL
  AND COALESCE(au.sa, au.ga, au.mga) IS NOT NULL;

SELECT CONCAT('Updated recruiting_agent for ', ROW_COUNT(), ' rows') as step3_result;

-- =============================================================================
-- STEP 4: Update code_to with hierarchy value
-- =============================================================================
UPDATE pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
SET p.code_to = COALESCE(au.sa, au.ga, au.mga),
    p.date_last_updated = NOW()
WHERE p.code_to IS NULL
  AND COALESCE(au.sa, au.ga, au.mga) IS NOT NULL;

SELECT CONCAT('Updated code_to for ', ROW_COUNT(), ' rows') as step4_result;

-- =============================================================================
-- STEP 5: Update MGA column if also NULL (bonus fix)
-- =============================================================================
UPDATE pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
SET p.MGA = au.mga,
    p.date_last_updated = NOW()
WHERE p.MGA IS NULL
  AND au.mga IS NOT NULL;

SELECT CONCAT('Updated MGA column for ', ROW_COUNT(), ' rows') as step5_result;

-- =============================================================================
-- STEP 6: Verify results after fix
-- =============================================================================

-- Show summary statistics
SELECT 
    'After Fix - Summary' as status,
    COUNT(*) as total_pipeline_rows,
    SUM(CASE WHEN recruiting_agent IS NULL THEN 1 ELSE 0 END) as null_recruiting_agent,
    SUM(CASE WHEN code_to IS NULL THEN 1 ELSE 0 END) as null_code_to,
    SUM(CASE WHEN recruiting_agent IS NULL AND code_to IS NULL THEN 1 ELSE 0 END) as both_null,
    SUM(CASE WHEN recruiting_agent IS NOT NULL AND code_to IS NOT NULL THEN 1 ELSE 0 END) as both_populated
FROM pipeline;

-- Show sample of updated rows
SELECT 
    'Sample of updated rows' as info,
    p.id as pipeline_id,
    p.recruit_first,
    p.recruit_last,
    p.step,
    p.recruiting_agent,
    p.code_to,
    p.MGA,
    au.lagnname as agent_name,
    CASE 
        WHEN au.sa = p.recruiting_agent THEN 'SA'
        WHEN au.ga = p.recruiting_agent THEN 'GA'
        WHEN au.mga = p.recruiting_agent THEN 'MGA'
        ELSE 'OTHER'
    END as recruiter_source,
    p.date_last_updated
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
WHERE p.recruiting_agent IS NOT NULL
  AND p.date_last_updated >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
ORDER BY p.date_last_updated DESC
LIMIT 30;

-- =============================================================================
-- STEP 7: Show remaining issues (if any)
-- =============================================================================

-- Pipeline rows still with NULL recruiting_agent
SELECT 
    'Remaining NULL recruiting_agent rows' as issue,
    p.id as pipeline_id,
    p.recruit_first,
    p.recruit_last,
    au.lagnname as agent_name,
    au.sa,
    au.ga,
    au.mga,
    CASE 
        WHEN au.sa IS NULL AND au.ga IS NULL AND au.mga IS NULL THEN 'No hierarchy data'
        ELSE 'Unknown issue'
    END as reason
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
WHERE p.recruiting_agent IS NULL
LIMIT 20;

-- =============================================================================
-- STEP 8: Distribution of recruiter levels used
-- =============================================================================
SELECT 
    'Recruiter Level Distribution' as info,
    CASE 
        WHEN au.sa = p.recruiting_agent THEN 'SA (Senior Associate)'
        WHEN au.ga = p.recruiting_agent THEN 'GA (General Agent)'
        WHEN au.mga = p.recruiting_agent THEN 'MGA (Managing General Agent)'
        ELSE 'Other/Unknown'
    END as recruiter_level,
    COUNT(*) as count,
    CONCAT(ROUND((COUNT(*) / (SELECT COUNT(*) FROM pipeline WHERE recruiting_agent IS NOT NULL)) * 100, 1), '%') as percentage
FROM pipeline p
JOIN activeusers au ON au.pipeline_id = p.id
WHERE p.recruiting_agent IS NOT NULL
GROUP BY recruiter_level
ORDER BY count DESC;

-- =============================================================================
-- Notes
-- =============================================================================
-- The script uses COALESCE(au.sa, au.ga, au.mga) which returns the first
-- non-NULL value in the hierarchy:
-- 1. First tries SA (Senior Associate)
-- 2. If SA is NULL, tries GA (General Agent)
-- 3. If GA is NULL, tries MGA (Managing General Agent)
--
-- Both recruiting_agent and code_to are set to the same value (the
-- recruiter's lagnname) as per the requirements.
--
-- The script also updates the MGA column if it's NULL, as a bonus fix.
-- =============================================================================

