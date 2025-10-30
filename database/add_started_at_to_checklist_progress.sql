-- Add started_at column to track when work begins on a checklist item
-- This allows us to measure time to complete each item

ALTER TABLE pipeline_checklist_progress
ADD COLUMN started_at DATETIME NULL AFTER completed_at;

-- For existing records that are completed, set started_at to completed_at
-- (we don't have historical data, but this prevents NULL values for completed items)
UPDATE pipeline_checklist_progress
SET started_at = completed_at
WHERE completed = 1 AND started_at IS NULL;

-- Add index for performance when querying by time
CREATE INDEX idx_pipeline_checklist_progress_started_at 
ON pipeline_checklist_progress(started_at);

-- Add index for time-based queries combining started and completed
CREATE INDEX idx_pipeline_checklist_progress_times 
ON pipeline_checklist_progress(started_at, completed_at);

