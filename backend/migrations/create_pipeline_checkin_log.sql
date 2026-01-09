-- Create pipeline check-in log table
-- Tracks both automated and manual check-ins with recruits
-- Links to the checklist item they were working on at the time

CREATE TABLE IF NOT EXISTS pipeline_checkin_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  recruit_id INT NOT NULL,
  checkin_type ENUM('automated', 'manual') NOT NULL DEFAULT 'manual',
  checkin_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checkin_by INT NULL COMMENT 'User ID who did the check-in (NULL for automated)',
  current_stage VARCHAR(100) NULL COMMENT 'Stage recruit was in at time of check-in',
  current_checklist_item_id INT NULL COMMENT 'Checklist item they were working on',
  notes TEXT NULL COMMENT 'Optional notes about the check-in',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recruit_id) REFERENCES pipeline(id) ON DELETE CASCADE,
  FOREIGN KEY (checkin_by) REFERENCES activeusers(id) ON DELETE SET NULL,
  FOREIGN KEY (current_checklist_item_id) REFERENCES pipeline_checklist_items(id) ON DELETE SET NULL,
  INDEX idx_recruit (recruit_id),
  INDEX idx_checkin_date (checkin_date),
  INDEX idx_checkin_type (checkin_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add index for getting latest check-in per recruit
CREATE INDEX idx_recruit_date ON pipeline_checkin_log(recruit_id, checkin_date DESC);

