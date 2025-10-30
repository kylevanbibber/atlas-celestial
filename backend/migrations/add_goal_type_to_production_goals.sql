-- Add goal_type column to production_goals table
-- This allows users to set separate goals for personal, MGA team, and RGA team

-- First check the current structure
-- DESCRIBE production_goals;

-- Add the goal_type column
ALTER TABLE production_goals 
ADD COLUMN goal_type ENUM('personal', 'mga', 'rga') DEFAULT 'personal' 
AFTER monthlyAlpGoal;

-- Update existing records to have personal goal_type
UPDATE production_goals SET goal_type = 'personal' WHERE goal_type IS NULL OR goal_type = '';

-- Update the unique constraint to include goal_type
-- This allows the same user to have different goals for personal, MGA, and RGA
ALTER TABLE production_goals DROP INDEX IF EXISTS unique_user_month;
ALTER TABLE production_goals ADD UNIQUE KEY unique_user_month_type (activeUserId, year, month, goal_type);

-- Add index for better query performance
CREATE INDEX idx_goal_type ON production_goals(goal_type);
CREATE INDEX idx_user_year_month_type ON production_goals(activeUserId, year, month, goal_type);
