-- Add instructions column to pipeline_checklist_items table
-- This allows checklist items to have detailed instructions that users can view

ALTER TABLE pipeline_checklist_items 
ADD COLUMN instructions TEXT AFTER item_description;

