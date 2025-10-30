-- Pipeline State Requirements Table
-- Allows state-specific overrides and additions to default checklist items
-- Each state can have different licensing requirements

CREATE TABLE IF NOT EXISTS pipeline_state_requirements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  state VARCHAR(2) NOT NULL,                    -- Two-letter state code (e.g., 'OH', 'CA', 'TX')
  stage_name VARCHAR(100) NOT NULL,             -- Links to stage (e.g., 'Licensing', 'Training')
  action ENUM('add', 'remove', 'modify', 'not_required') NOT NULL,
  
  -- For 'add' action: define new item
  item_name VARCHAR(255) NULL,
  item_description TEXT NULL,
  item_order INT NULL,
  item_type ENUM('checkbox', 'text', 'date', 'number', 'select', 'textarea') DEFAULT 'checkbox',
  item_options TEXT NULL,
  
  -- For 'remove' action: reference existing item by name
  target_item_name VARCHAR(255) NULL,           -- Name of the default item to remove
  
  -- For 'modify' action: override specific fields
  override_description TEXT NULL,
  override_required BOOLEAN NULL,
  override_type VARCHAR(50) NULL,
  override_options TEXT NULL,
  
  -- For 'not_required' action: mark item as optional for this state
  -- Uses target_item_name to reference the item
  
  notes TEXT NULL,                               -- Admin notes about why this state is different
  active BOOLEAN DEFAULT 1,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE SET NULL,
  INDEX idx_state (state),
  INDEX idx_stage_state (stage_name, state),
  INDEX idx_action (action),
  UNIQUE KEY unique_state_stage_item (state, stage_name, target_item_name, item_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Example: Ohio requires additional items
-- INSERT INTO pipeline_state_requirements (state, stage_name, action, item_name, item_description, item_order, item_type)
-- VALUES ('OH', 'Licensing', 'add', 'Complete State-Specific Ethics Course', 'Ohio requires additional 3-hour ethics course', 7, 'checkbox');

-- Example: California doesn't require background check (handled by state)
-- INSERT INTO pipeline_state_requirements (state, stage_name, action, target_item_name)
-- VALUES ('CA', 'Licensing', 'not_required', 'Background Check');

-- Example: Texas has different license approval process
-- INSERT INTO pipeline_state_requirements (state, stage_name, action, target_item_name, override_description)
-- VALUES ('TX', 'Licensing', 'modify', 'Receive License Approval', 'Texas: Submit to TDI and wait 10 business days for approval');

