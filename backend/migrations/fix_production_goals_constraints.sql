-- Fix production_goals table constraints for goal_type functionality
-- This addresses the ER_DUP_ENTRY error by properly updating unique constraints

-- First, check if goal_type column exists, if not add it
SELECT COUNT(*) as goal_type_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'atlas' 
AND TABLE_NAME = 'production_goals' 
AND COLUMN_NAME = 'goal_type';

-- Add goal_type column if it doesn't exist
ALTER TABLE production_goals 
ADD COLUMN IF NOT EXISTS goal_type ENUM('personal', 'mga', 'rga') DEFAULT 'personal' 
AFTER monthlyAlpGoal;

-- Update existing records to have personal goal_type
UPDATE production_goals SET goal_type = 'personal' WHERE goal_type IS NULL OR goal_type = '';

-- Drop all existing unique constraints that might conflict
ALTER TABLE production_goals DROP INDEX IF EXISTS unique_user_month;
ALTER TABLE production_goals DROP INDEX IF EXISTS unique_user_month_year;
ALTER TABLE production_goals DROP INDEX IF EXISTS unique_user_year_month;

-- Add the correct unique constraint that includes goal_type
ALTER TABLE production_goals ADD UNIQUE KEY unique_user_month_type (activeUserId, year, month, goal_type);

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_goal_type ON production_goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_user_year_month_type ON production_goals(activeUserId, year, month, goal_type);

-- Show the final table structure for verification
SHOW CREATE TABLE production_goals;
