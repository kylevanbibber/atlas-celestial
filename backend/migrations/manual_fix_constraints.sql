-- MANUAL FIX: Run this in your MySQL database to fix the constraint issue
-- This will resolve the ER_DUP_ENTRY error for team goals

USE atlas;

-- First, let's see what constraints currently exist
SELECT 
    CONSTRAINT_NAME,
    COLUMN_NAME,
    CONSTRAINT_TYPE
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'atlas' 
    AND TABLE_NAME = 'production_goals'
    AND CONSTRAINT_NAME LIKE '%unique%'
ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION;

-- Drop all existing unique constraints that might conflict
-- These commands will not fail even if the constraints don't exist
SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

ALTER TABLE production_goals DROP INDEX unique_user_month;
ALTER TABLE production_goals DROP INDEX unique_user_month_year; 
ALTER TABLE production_goals DROP INDEX unique_user_year_month;
ALTER TABLE production_goals DROP INDEX unique_user_month_type;

-- Make sure goal_type column exists with correct values
UPDATE production_goals SET goal_type = 'personal' WHERE goal_type IS NULL OR goal_type = '';

-- Add the correct unique constraint that includes goal_type
ALTER TABLE production_goals ADD UNIQUE KEY unique_user_month_type (activeUserId, year, month, goal_type);

-- Add performance indexes if they don't exist
ALTER TABLE production_goals ADD INDEX idx_goal_type (goal_type);
ALTER TABLE production_goals ADD INDEX idx_user_year_month_type (activeUserId, year, month, goal_type);

-- Verify the constraint was added correctly
SHOW INDEX FROM production_goals WHERE Key_name LIKE '%unique%';

-- Show current table structure
DESCRIBE production_goals;
