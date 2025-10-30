-- Add schedule_type column to existing date_overrides table
-- Run this if you already have the date_overrides table without the schedule_type column

ALTER TABLE date_overrides 
ADD COLUMN schedule_type ENUM('mon-sun', 'wed-tue') DEFAULT 'mon-sun' 
AFTER end_date;

-- Update any existing records to have default schedule_type
UPDATE date_overrides SET schedule_type = 'mon-sun' WHERE schedule_type IS NULL;
