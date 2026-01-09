-- Add check-in text settings to existing sms_auto_reload_settings table
ALTER TABLE sms_auto_reload_settings 
ADD COLUMN IF NOT EXISTS checkin_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether automated check-in texts are enabled',
ADD COLUMN IF NOT EXISTS checkin_frequency_days INT NOT NULL DEFAULT 3 COMMENT 'How often to send check-in texts (in days)';

-- Add last_checkin_sent to pipeline table to track when last check-in was sent
ALTER TABLE pipeline 
ADD COLUMN IF NOT EXISTS last_checkin_sent TIMESTAMP NULL COMMENT 'Last time a check-in text was sent to this recruit';

-- Drop the separate checkin_text_settings table if it exists
DROP TABLE IF EXISTS checkin_text_settings;


