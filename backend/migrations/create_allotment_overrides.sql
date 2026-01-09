-- Migration: Create allotment_overrides table
-- Purpose: Allow manual exclusion or group reassignment for specific agents/months
-- Date: 2025-12-13

CREATE TABLE IF NOT EXISTS allotment_overrides (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id INT NOT NULL,
    target_month VARCHAR(7), -- YYYY-MM format, NULL for "all future allotments"
    override_type ENUM('exclude', 'move_to_group', 'exclude_all_future') NOT NULL,
    target_group INT, -- Only used when override_type = 'move_to_group' (1-5 for standard groups)
    custom_group_id INT, -- Only used when moving to a custom group
    reason TEXT,
    created_by INT, -- User ID who created the override
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES activeusers(id) ON DELETE CASCADE,
    FOREIGN KEY (custom_group_id) REFERENCES custom_allotment_groups(id) ON DELETE CASCADE,
    UNIQUE KEY unique_agent_month (agent_id, target_month),
    INDEX idx_target_month (target_month),
    INDEX idx_override_type (override_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notes:
-- 1. override_type = 'exclude': Remove agent from allotment for target_month only
-- 2. override_type = 'move_to_group': Manually assign agent to target_group or custom_group_id for target_month
-- 3. override_type = 'exclude_all_future': Remove agent from ALL future allotments (target_month = NULL)
-- 4. When target_month is NULL, it applies to all future months
-- 5. Month-specific overrides take precedence over 'exclude_all_future'

