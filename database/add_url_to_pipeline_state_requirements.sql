-- Add URL column to pipeline_state_requirements table
-- This allows adding external links/resources for checklist items

ALTER TABLE pipeline_state_requirements
ADD COLUMN url TEXT NULL
COMMENT 'External URL/link for this checklist item';

-- Example update (optional - remove if not needed):
-- UPDATE pipeline_state_requirements 
-- SET url = 'https://example.com/license-application' 
-- WHERE item_name = 'Complete License Application';

