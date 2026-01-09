-- Add instructions column to pipeline_state_requirements table
-- This allows state-specific requirements to have their own instructions

ALTER TABLE pipeline_state_requirements 
ADD COLUMN instructions TEXT AFTER action;

