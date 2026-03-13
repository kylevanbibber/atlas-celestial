-- Calendar Events Feature - Database Migration
-- Stores user-created calendar events (personal and team)

CREATE TABLE IF NOT EXISTS calendar_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT 'Creator/owner of the event',
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  location VARCHAR(500) DEFAULT NULL,

  -- Timing
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  all_day TINYINT(1) DEFAULT 0,
  timezone VARCHAR(50) DEFAULT 'America/New_York',

  -- Categorization
  event_type ENUM('personal', 'team', 'meeting', 'deadline', 'reminder', 'other') DEFAULT 'personal',
  color VARCHAR(7) DEFAULT '#007bff' COMMENT 'Hex color for calendar display',

  -- Visibility / sharing
  visibility ENUM('private', 'team', 'organization') DEFAULT 'private',
  team_lagnname VARCHAR(100) DEFAULT NULL COMMENT 'Team/agency name for team events',

  -- External source linking
  source ENUM('manual', 'calendly', 'system') DEFAULT 'manual',
  external_id VARCHAR(255) DEFAULT NULL COMMENT 'Calendly event URI or other external ID',
  external_url VARCHAR(500) DEFAULT NULL COMMENT 'Link to external event (Calendly, Zoom, etc.)',

  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL COMMENT 'Soft delete timestamp',

  INDEX idx_user_id (user_id),
  INDEX idx_start_time (start_time),
  INDEX idx_end_time (end_time),
  INDEX idx_event_type (event_type),
  INDEX idx_visibility (visibility),
  INDEX idx_team (team_lagnname),
  INDEX idx_source (source),
  INDEX idx_external_id (external_id),
  INDEX idx_user_date_range (user_id, start_time, end_time),
  INDEX idx_deleted (deleted_at),
  UNIQUE INDEX idx_user_external (user_id, external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
