-- Add text_opt_in column to pipeline table for SMS reminder/updates opt-in tracking
-- Run this migration once against the Atlas database.

ALTER TABLE pipeline
ADD COLUMN text_opt_in TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '1 = user opted in to text reminders/updates, 0 = no';


