-- Verification Script for State Requirements
-- Run this after loading seed_state_requirements_from_data.sql
-- This will show you what was loaded and help troubleshoot any issues

-- ============================================================
-- 1. COUNT BY STATE
-- ============================================================
SELECT 
  '=== REQUIREMENTS COUNT BY STATE ===' as section,
  '' as detail;

SELECT 
  state,
  COUNT(*) as total_requirements,
  SUM(CASE WHEN action = 'add' THEN 1 ELSE 0 END) as added_items,
  SUM(CASE WHEN action = 'modify' THEN 1 ELSE 0 END) as modified_items,
  SUM(CASE WHEN action = 'remove' THEN 1 ELSE 0 END) as removed_items,
  SUM(CASE WHEN action = 'not_required' THEN 1 ELSE 0 END) as optional_items
FROM pipeline_state_requirements
WHERE active = 1
GROUP BY state
ORDER BY state;

-- ============================================================
-- 2. STATES WITH NO BACKGROUND CHECK
-- ============================================================
SELECT 
  '' as blank_line,
  '=== STATES WITH NO BACKGROUND CHECK ===' as section;

SELECT 
  state,
  target_item_name,
  notes
FROM pipeline_state_requirements
WHERE action = 'not_required' 
  AND target_item_name = 'Background Check'
  AND active = 1
ORDER BY state;

-- ============================================================
-- 3. EXAM VENDORS BY STATE
-- ============================================================
SELECT 
  '' as blank_line,
  '=== EXAM VENDORS (Non-Pearson VUE) ===' as section;

SELECT 
  state,
  SUBSTRING_INDEX(SUBSTRING_INDEX(override_description, 'through ', -1), '.', 1) as vendor,
  LEFT(override_description, 60) as description_preview
FROM pipeline_state_requirements
WHERE target_item_name = 'Schedule Test'
  AND active = 1
ORDER BY state;

-- ============================================================
-- 4. PRE-LICENSING REQUIREMENTS
-- ============================================================
SELECT 
  '' as blank_line,
  '=== PRE-LICENSING (Recommended, Not Required) ===' as section;

SELECT 
  state,
  override_required,
  notes
FROM pipeline_state_requirements
WHERE target_item_name = 'Enroll in Pre-Licensing'
  AND override_required = 0
  AND active = 1
ORDER BY state;

-- ============================================================
-- 5. BACKGROUND CHECK METHODS
-- ============================================================
SELECT 
  '' as blank_line,
  '=== BACKGROUND CHECK METHODS ===' as section;

SELECT 
  state,
  LEFT(override_description, 70) as method,
  CASE 
    WHEN override_description LIKE '%IdentGo%' THEN 'IdentGo'
    WHEN override_description LIKE '%Live Scan%' THEN 'Live Scan'
    WHEN override_description LIKE '%Fieldprint%' THEN 'Fieldprint'
    WHEN override_description LIKE '%Prometric%' THEN 'At Test Center'
    WHEN override_description LIKE '%fingerprint%' THEN 'Fingerprinting'
    ELSE 'Other'
  END as category
FROM pipeline_state_requirements
WHERE target_item_name = 'Background Check'
  AND action = 'modify'
  AND active = 1
ORDER BY category, state;

-- ============================================================
-- 6. STATES NOT YET CONFIGURED
-- ============================================================
SELECT 
  '' as blank_line,
  '=== STATES NOT YET CONFIGURED ===' as section;

SELECT 
  state_code,
  state_name
FROM (
  SELECT 'AL' as state_code, 'Alabama' as state_name
  UNION SELECT 'AK', 'Alaska'
  UNION SELECT 'AZ', 'Arizona'
  UNION SELECT 'AR', 'Arkansas'
  UNION SELECT 'CA', 'California'
  UNION SELECT 'CO', 'Colorado'
  UNION SELECT 'CT', 'Connecticut'
  UNION SELECT 'DE', 'Delaware'
  UNION SELECT 'DC', 'District of Columbia'
  UNION SELECT 'FL', 'Florida'
  UNION SELECT 'GA', 'Georgia'
  UNION SELECT 'HI', 'Hawaii'
  UNION SELECT 'ID', 'Idaho'
  UNION SELECT 'IL', 'Illinois'
  UNION SELECT 'IN', 'Indiana'
  UNION SELECT 'IA', 'Iowa'
  UNION SELECT 'KS', 'Kansas'
  UNION SELECT 'KY', 'Kentucky'
  UNION SELECT 'LA', 'Louisiana'
  UNION SELECT 'ME', 'Maine'
  UNION SELECT 'MD', 'Maryland'
  UNION SELECT 'MA', 'Massachusetts'
  UNION SELECT 'MI', 'Michigan'
  UNION SELECT 'MN', 'Minnesota'
  UNION SELECT 'MS', 'Mississippi'
  UNION SELECT 'MO', 'Missouri'
  UNION SELECT 'MT', 'Montana'
  UNION SELECT 'NE', 'Nebraska'
  UNION SELECT 'NV', 'Nevada'
  UNION SELECT 'NH', 'New Hampshire'
  UNION SELECT 'NJ', 'New Jersey'
  UNION SELECT 'NM', 'New Mexico'
  UNION SELECT 'NY', 'New York'
  UNION SELECT 'NC', 'North Carolina'
  UNION SELECT 'ND', 'North Dakota'
  UNION SELECT 'OH', 'Ohio'
  UNION SELECT 'OK', 'Oklahoma'
  UNION SELECT 'OR', 'Oregon'
  UNION SELECT 'PA', 'Pennsylvania'
  UNION SELECT 'RI', 'Rhode Island'
  UNION SELECT 'SC', 'South Carolina'
  UNION SELECT 'SD', 'South Dakota'
  UNION SELECT 'TN', 'Tennessee'
  UNION SELECT 'TX', 'Texas'
  UNION SELECT 'UT', 'Utah'
  UNION SELECT 'VT', 'Vermont'
  UNION SELECT 'VA', 'Virginia'
  UNION SELECT 'WA', 'Washington'
  UNION SELECT 'WV', 'West Virginia'
  UNION SELECT 'WI', 'Wisconsin'
  UNION SELECT 'WY', 'Wyoming'
) all_states
WHERE state_code NOT IN (
  SELECT DISTINCT state FROM pipeline_state_requirements WHERE active = 1
)
ORDER BY state_code;

-- ============================================================
-- 7. TOTAL SUMMARY
-- ============================================================
SELECT 
  '' as blank_line,
  '=== OVERALL SUMMARY ===' as section;

SELECT 
  'Total States Configured' as metric,
  COUNT(DISTINCT state) as count
FROM pipeline_state_requirements
WHERE active = 1

UNION ALL

SELECT 
  'Total Requirements' as metric,
  COUNT(*) as count
FROM pipeline_state_requirements
WHERE active = 1

UNION ALL

SELECT 
  'Background Check Modifications' as metric,
  COUNT(*) as count
FROM pipeline_state_requirements
WHERE target_item_name = 'Background Check' AND active = 1

UNION ALL

SELECT 
  'Exam Vendor Changes' as metric,
  COUNT(*) as count
FROM pipeline_state_requirements
WHERE target_item_name = 'Schedule Test' AND active = 1

UNION ALL

SELECT 
  'Pre-Licensing Modifications' as metric,
  COUNT(*) as count
FROM pipeline_state_requirements
WHERE target_item_name = 'Enroll in Pre-Licensing' AND active = 1;

-- ============================================================
-- 8. SAMPLE STATE (CALIFORNIA) - DETAILED VIEW
-- ============================================================
SELECT 
  '' as blank_line,
  '=== CALIFORNIA (CA) - SAMPLE STATE DETAILS ===' as section;

SELECT 
  stage_name,
  action,
  COALESCE(item_name, target_item_name) as item,
  COALESCE(override_description, item_description) as description,
  override_required as is_required,
  notes
FROM pipeline_state_requirements
WHERE state = 'CA' AND active = 1
ORDER BY stage_name, action;

-- ============================================================
-- 9. CHECK FOR POTENTIAL ISSUES
-- ============================================================
SELECT 
  '' as blank_line,
  '=== POTENTIAL ISSUES ===' as section;

-- Check for requirements without proper target or item names
SELECT 
  'Missing target_item_name for non-add actions' as issue_type,
  state,
  action,
  stage_name
FROM pipeline_state_requirements
WHERE action IN ('modify', 'remove', 'not_required')
  AND (target_item_name IS NULL OR target_item_name = '')
  AND active = 1

UNION ALL

-- Check for add actions without item names
SELECT 
  'Missing item_name for add actions' as issue_type,
  state,
  action,
  stage_name
FROM pipeline_state_requirements
WHERE action = 'add'
  AND (item_name IS NULL OR item_name = '')
  AND active = 1

UNION ALL

-- Check for duplicate state+stage+target combinations
SELECT 
  'Potential duplicate requirement' as issue_type,
  state,
  action,
  CONCAT(stage_name, ' - ', COALESCE(target_item_name, item_name)) as detail
FROM pipeline_state_requirements
WHERE active = 1
GROUP BY state, stage_name, COALESCE(target_item_name, item_name), action
HAVING COUNT(*) > 1;

-- If no issues found
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM pipeline_state_requirements WHERE active = 1) > 0
    THEN '✅ No critical issues found!'
    ELSE '⚠️ No state requirements loaded - run seed script first'
  END as status;

-- ============================================================
-- INSTRUCTIONS
-- ============================================================
SELECT 
  '' as blank_line,
  '=== VERIFICATION COMPLETE ===' as section;

SELECT 
  'Run these commands to test:' as instructions
UNION ALL
SELECT '1. Update a recruit: UPDATE pipeline SET resident_state = ''CA'' WHERE id = [recruit_id];'
UNION ALL
SELECT '2. Open the Pipeline checklist in the UI'
UNION ALL
SELECT '3. Look for state badges (🔵 CA) and modified items (🟠 Modified)'
UNION ALL
SELECT '4. Check browser console for: [PipelineChecklist] State-specific items'
UNION ALL
SELECT '5. Verify descriptions mention state-specific methods (Live Scan, PSI, etc.)';

