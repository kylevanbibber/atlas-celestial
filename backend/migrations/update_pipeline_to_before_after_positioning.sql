-- Migration: Update Pipeline Stage Definitions to use Before/After Positioning
-- This replaces the rigid stage_order system with a flexible before/after chain
-- Date: 2025-10-08

-- Step 1: Add new positioning columns (without AFTER clause for compatibility)
ALTER TABLE pipeline_stage_definitions 
ADD COLUMN position_after VARCHAR(100) NULL,
ADD COLUMN position_before VARCHAR(100) NULL;

-- Step 2: Migrate existing stage_order data to before/after relationships
-- This maintains the current order while switching to the new system

-- Careers Form (first in chain)
UPDATE pipeline_stage_definitions 
SET position_after = NULL, position_before = 'No Answer - Career Form' 
WHERE stage_name = 'Careers Form' AND team_id IS NULL;

-- No Answer - Career Form
UPDATE pipeline_stage_definitions 
SET position_after = 'Careers Form', position_before = 'Overview' 
WHERE stage_name = 'No Answer - Career Form' AND team_id IS NULL;

-- Overview
UPDATE pipeline_stage_definitions 
SET position_after = 'No Answer - Career Form', position_before = 'Final' 
WHERE stage_name = 'Overview' AND team_id IS NULL;

-- Final
UPDATE pipeline_stage_definitions 
SET position_after = 'Overview', position_before = 'Pre-Lic' 
WHERE stage_name = 'Final' AND team_id IS NULL;

-- Pre-Lic
UPDATE pipeline_stage_definitions 
SET position_after = 'Final', position_before = 'Test' 
WHERE stage_name = 'Pre-Lic' AND team_id IS NULL;

-- Test
UPDATE pipeline_stage_definitions 
SET position_after = 'Pre-Lic', position_before = 'Licensed' 
WHERE stage_name = 'Test' AND team_id IS NULL;

-- Licensed
UPDATE pipeline_stage_definitions 
SET position_after = 'Test', position_before = 'Background Check' 
WHERE stage_name = 'Licensed' AND team_id IS NULL;

-- Background Check
UPDATE pipeline_stage_definitions 
SET position_after = 'Licensed', position_before = 'Compliance' 
WHERE stage_name = 'Background Check' AND team_id IS NULL;

-- Compliance
UPDATE pipeline_stage_definitions 
SET position_after = 'Background Check', position_before = 'Release Ready' 
WHERE stage_name = 'Compliance' AND team_id IS NULL;

-- Release Ready
UPDATE pipeline_stage_definitions 
SET position_after = 'Compliance', position_before = 'Released' 
WHERE stage_name = 'Release Ready' AND team_id IS NULL;

-- Released (end of main chain)
UPDATE pipeline_stage_definitions 
SET position_after = 'Release Ready', position_before = NULL 
WHERE stage_name = 'Released' AND team_id IS NULL;

-- Terminal stages (not in main chain, standalone)
UPDATE pipeline_stage_definitions 
SET position_after = NULL, position_before = NULL 
WHERE stage_name IN ('Not Interested', 'Disqualified', 'No Show') 
AND team_id IS NULL;

-- Step 3: Drop the old stage_order column and its index
ALTER TABLE pipeline_stage_definitions 
DROP INDEX idx_stage_order;

ALTER TABLE pipeline_stage_definitions 
DROP COLUMN stage_order;

-- Step 4: Add indexes for the new positioning columns
ALTER TABLE pipeline_stage_definitions 
ADD INDEX idx_position_after (position_after),
ADD INDEX idx_position_before (position_before);

-- Migration complete! 
-- The table now uses flexible before/after positioning instead of rigid ordering.

