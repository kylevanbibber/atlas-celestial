-- Cleanup script to ensure all goal_type values default to 'personal'
-- Run this if you have existing data with null or empty goal_type values

-- Update any NULL goal_type values to 'personal'
UPDATE production_goals 
SET goal_type = 'personal' 
WHERE goal_type IS NULL;

-- Update any empty string goal_type values to 'personal'
UPDATE production_goals 
SET goal_type = 'personal' 
WHERE goal_type = '';

-- Verify the cleanup
SELECT 
    goal_type,
    COUNT(*) as count
FROM production_goals 
GROUP BY goal_type
ORDER BY goal_type;
