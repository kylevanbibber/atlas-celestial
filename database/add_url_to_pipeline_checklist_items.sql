-- Add URL column to pipeline_checklist_items table
-- This allows adding external links/resources for default checklist items

ALTER TABLE pipeline_checklist_items
ADD COLUMN url TEXT NULL
COMMENT 'External URL/link for this checklist item';

-- Example update (optional - remove if not needed):
-- UPDATE pipeline_checklist_items 
-- SET url = 'https://example.com/license-application' 
-- WHERE item_name = 'Complete License Application';

