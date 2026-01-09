-- Add expected_time column to pipeline_checklist_items table
-- This field stores the expected time to complete each checklist item
-- Examples: "5 min", "1 hr", "7 days", "2-3 days", etc.

ALTER TABLE pipeline_checklist_items 
ADD COLUMN expected_time VARCHAR(50) NULL AFTER instructions;

