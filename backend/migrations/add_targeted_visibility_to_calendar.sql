-- Add 'targeted' visibility option and audience_criteria JSON column to calendar_events
ALTER TABLE calendar_events
  MODIFY COLUMN visibility ENUM('private','team','organization','targeted') NOT NULL DEFAULT 'private',
  ADD COLUMN audience_criteria JSON DEFAULT NULL;
