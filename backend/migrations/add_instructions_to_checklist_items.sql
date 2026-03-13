-- Add instructions column to pipeline_checklist_items table
-- This allows base instructions per checklist item (separate from state-specific instructions)
ALTER TABLE pipeline_checklist_items ADD COLUMN instructions TEXT DEFAULT NULL AFTER item_description;
