-- QUICK FIX: Run this in your MySQL database to allow separate MGA and RGA goals
-- This will stop the RGA goal from replacing the MGA goal

USE atlas;

-- Remove the old constraint that's causing the conflict
ALTER TABLE production_goals DROP INDEX IF EXISTS unique_user_month_year;

-- Add the new constraint that allows multiple goal types
ALTER TABLE production_goals ADD UNIQUE KEY unique_user_month_type (activeUserId, year, month, goal_type);

-- Verify the change worked
SHOW INDEX FROM production_goals WHERE Key_name = 'unique_user_month_type';
