-- Add img column to leads_released table if it doesn't exist
ALTER TABLE leads_released 
ADD COLUMN IF NOT EXISTS img TEXT;
