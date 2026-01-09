-- Fix state requirement target_item_name mismatches across all states
-- This updates the target_item_name to match the actual item_name in pipeline_checklist_items

-- Fix "Schedule Test" -> "Schedule Licensing Test"
UPDATE pipeline_state_requirements 
SET target_item_name = 'Schedule Licensing Test'
WHERE target_item_name = 'Schedule Test'
  AND active = 1;

-- Fix "Enroll in Pre-Licensing" -> "Pre-Licensing Course"
UPDATE pipeline_state_requirements 
SET target_item_name = 'Pre-Licensing Course'
WHERE target_item_name = 'Enroll in Pre-Licensing'
  AND active = 1;

-- Fix "Pass Test" -> "Pass Licensing Test"
UPDATE pipeline_state_requirements 
SET target_item_name = 'Pass Licensing Test'
WHERE target_item_name = 'Pass Test'
  AND active = 1;

-- Fix "Get License" -> "Purchase License"
UPDATE pipeline_state_requirements 
SET target_item_name = 'Purchase License'
WHERE target_item_name = 'Get License'
  AND active = 1;

-- Fix "License Approval" -> "Receive License Approval"
UPDATE pipeline_state_requirements 
SET target_item_name = 'Receive License Approval'
WHERE target_item_name = 'License Approval'
  AND active = 1;

-- Show summary of what was updated
SELECT 
  CONCAT('Updated ', COUNT(*), ' records') as summary
FROM pipeline_state_requirements 
WHERE target_item_name IN (
  'Schedule Licensing Test',
  'Pre-Licensing Course',
  'Pass Licensing Test',
  'Purchase License',
  'Receive License Approval'
)
AND active = 1;

-- Show any remaining mismatches (items that don't exist in pipeline_checklist_items)
SELECT 
  psr.state,
  psr.stage_name,
  psr.target_item_name,
  psr.action,
  'NOT FOUND IN CHECKLIST ITEMS' as status
FROM pipeline_state_requirements psr
LEFT JOIN pipeline_checklist_items pci 
  ON psr.target_item_name = pci.item_name 
  AND psr.stage_name = pci.stage_name
  AND pci.active = 1
WHERE psr.active = 1
  AND psr.action IN ('modify', 'not_required')
  AND pci.id IS NULL
ORDER BY psr.state, psr.stage_name, psr.target_item_name;

