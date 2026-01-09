-- Create table for custom allotment groups
CREATE TABLE IF NOT EXISTS custom_allotment_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_name VARCHAR(100) NOT NULL,
  target_month VARCHAR(7) NOT NULL COMMENT 'Format: YYYY-MM',
  leads_per_month INT NOT NULL,
  leads_per_drop INT NOT NULL,
  refs_required INT NOT NULL DEFAULT 0,
  lead_types TEXT COMMENT 'Description of lead types for this group',
  description TEXT,
  color VARCHAR(7) DEFAULT '#6c757d',
  is_active TINYINT(1) DEFAULT 1,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_target_month (target_month),
  INDEX idx_is_active (is_active),
  FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create table for custom group members
CREATE TABLE IF NOT EXISTS custom_allotment_group_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  agent_id INT NOT NULL,
  added_by INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  INDEX idx_group_id (group_id),
  INDEX idx_agent_id (agent_id),
  FOREIGN KEY (group_id) REFERENCES custom_allotment_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES activeusers(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES activeusers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_group_agent (group_id, agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

