-- Migration: Remove unique constraint from commits table to allow history tracking
-- This allows multiple commits for the same user/period/type to track changes over time

-- Drop the unique constraint if it exists
ALTER TABLE commits DROP INDEX IF EXISTS unique_user_period_type;

-- Add a composite index for better query performance when fetching recent commits
ALTER TABLE commits ADD INDEX IF NOT EXISTS idx_user_period_type_created (userId, time_period, type, start, end, created_at DESC);

-- Verify the change
SHOW INDEX FROM commits;


