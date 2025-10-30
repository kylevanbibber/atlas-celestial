-- Pipeline Configuration Tables
-- This migration creates tables for customizable pipeline stages and checklists
-- Works with existing pipeline and pipeline_steps tables

-- 1. Stage Definitions
-- Defines what stages exist using flexible before/after positioning
CREATE TABLE IF NOT EXISTS pipeline_stage_definitions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stage_name VARCHAR(100) NOT NULL,
  stage_color VARCHAR(20) DEFAULT '#3498db',
  stage_description TEXT NULL,
  position_after VARCHAR(100) NULL,       -- Place this stage after this stage name (NULL = start of chain)
  position_before VARCHAR(100) NULL,      -- Place this stage before this stage name (NULL = end of chain)
  is_default BOOLEAN DEFAULT 1,           -- TRUE for system default stages
  is_terminal BOOLEAN DEFAULT 0,          -- TRUE for end states (Not Interested, Released, etc.)
  team_id INT NULL,                        -- NULL = default for all, otherwise team-specific
  active BOOLEAN DEFAULT 1,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES activeusers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE SET NULL,
  INDEX idx_team_active (team_id, active),
  INDEX idx_position_after (position_after),
  INDEX idx_position_before (position_before),
  INDEX idx_stage_name (stage_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Checklist Items
-- Tasks that must be completed per stage
CREATE TABLE IF NOT EXISTS pipeline_checklist_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stage_name VARCHAR(100) NOT NULL,       -- Links to stage_name in pipeline_stage_definitions
  item_name VARCHAR(255) NOT NULL,
  item_description TEXT NULL,
  item_order INT NOT NULL,
  is_required BOOLEAN DEFAULT 0,
  item_type ENUM('checkbox', 'text', 'date', 'number', 'select', 'textarea') DEFAULT 'checkbox',
  item_options TEXT NULL,                  -- JSON for select options: ["Option 1", "Option 2"]
  active BOOLEAN DEFAULT 1,
  team_id INT NULL,                        -- NULL = default, otherwise team-specific
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES activeusers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE SET NULL,
  INDEX idx_stage_name (stage_name),
  INDEX idx_team_active (team_id, active),
  INDEX idx_item_order (item_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Checklist Progress
-- Tracks completion status per recruit per checklist item
CREATE TABLE IF NOT EXISTS pipeline_checklist_progress (
  id INT PRIMARY KEY AUTO_INCREMENT,
  recruit_id INT NOT NULL,
  checklist_item_id INT NOT NULL,
  completed BOOLEAN DEFAULT 0,
  completed_by INT NULL,
  completed_at TIMESTAMP NULL,
  value TEXT NULL,                         -- Stores text/date/number/select/textarea values
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (recruit_id) REFERENCES pipeline(id) ON DELETE CASCADE,
  FOREIGN KEY (checklist_item_id) REFERENCES pipeline_checklist_items(id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES activeusers(id) ON DELETE SET NULL,
  UNIQUE KEY unique_progress (recruit_id, checklist_item_id),
  INDEX idx_recruit (recruit_id),
  INDEX idx_completed (completed),
  INDEX idx_checklist_item (checklist_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Pipeline Notes/Comments
-- Optional: Track notes/comments per recruit for collaboration
CREATE TABLE IF NOT EXISTS pipeline_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  recruit_id INT NOT NULL,
  note TEXT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (recruit_id) REFERENCES pipeline(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE CASCADE,
  INDEX idx_recruit (recruit_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

