-- Manual Setup for Agency Switching Feature
-- Run this SQL directly on your database

-- Step 1: Create the sgas table (if not already exists)
CREATE TABLE IF NOT EXISTS sgas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rept_name VARCHAR(255) NOT NULL UNIQUE COMMENT 'Primary report name',
  display_name VARCHAR(255) DEFAULT NULL COMMENT 'Optional display name for UI',
  active TINYINT(1) DEFAULT 1 COMMENT '1 = active, 0 = inactive',
  hide TINYINT(1) DEFAULT 0 COMMENT '1 = hidden from lists, 0 = visible',
  is_default TINYINT(1) DEFAULT 0 COMMENT '1 = default SGA, 0 = regular',
  created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (active),
  INDEX idx_hide (hide),
  INDEX idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Create the sga_alternative_names table (if not already exists)
CREATE TABLE IF NOT EXISTS sga_alternative_names (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sga_id INT NOT NULL,
  alternative_name VARCHAR(255) NOT NULL COMMENT 'Alternative name as it appears in reports',
  created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sga_id) REFERENCES sgas(id) ON DELETE CASCADE,
  INDEX idx_sga_id (sga_id),
  INDEX idx_alternative_name (alternative_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Insert default SGA if not exists
INSERT IGNORE INTO sgas (id, rept_name, display_name, active, hide, is_default) 
VALUES (1, 'ARIAS ORGANIZATION', 'Arias Organization', 1, 0, 1);

-- Step 4: Add alternative names for ARIAS ORGANIZATION
INSERT IGNORE INTO sga_alternative_names (sga_id, alternative_name) VALUES
(1, 'ARIAS ORGANIZATION'),
(1, 'Arias Organization'),
(1, 'ARIAS ORG'),
(1, 'Arias Org');

-- Step 5: Add the new SURACE-SMITH-PARTNERS SGA
INSERT IGNORE INTO sgas (rept_name, display_name, active, hide, is_default) 
VALUES ('SURACE-SMITH-PARTNERS', 'Surace Smith Partners', 1, 0, 0);

-- Step 6: Get the ID and add alternative names
SET @surace_sga_id = (SELECT id FROM sgas WHERE rept_name = 'SURACE-SMITH-PARTNERS');

INSERT IGNORE INTO sga_alternative_names (sga_id, alternative_name) VALUES
(@surace_sga_id, 'SURACE-SMITH-PARTNERS'),
(@surace_sga_id, 'Surace-Smith-Partners'),
(@surace_sga_id, 'SURACE SMITH PARTNERS'),
(@surace_sga_id, 'Surace Smith Partners'),
(@surace_sga_id, 'SSP');

-- Step 7: Create user_agencies table
CREATE TABLE IF NOT EXISTS user_agencies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  sga_id INT NOT NULL,
  is_primary TINYINT(1) DEFAULT 0 COMMENT '1 = primary agency, 0 = secondary',
  created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES activeusers(id) ON DELETE CASCADE,
  FOREIGN KEY (sga_id) REFERENCES sgas(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_sga (user_id, sga_id),
  INDEX idx_user_id (user_id),
  INDEX idx_sga_id (sga_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 8: Create user_selected_agency table
CREATE TABLE IF NOT EXISTS user_selected_agency (
  user_id INT PRIMARY KEY,
  sga_id INT NOT NULL,
  updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES activeusers(id) ON DELETE CASCADE,
  FOREIGN KEY (sga_id) REFERENCES sgas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 9: Give user 92 access to both agencies
INSERT IGNORE INTO user_agencies (user_id, sga_id, is_primary) VALUES
(92, 1, 1),
(92, @surace_sga_id, 0);

-- Step 10: Set user 92's default selection to ARIAS ORGANIZATION
INSERT IGNORE INTO user_selected_agency (user_id, sga_id) VALUES
(92, 1);

-- ============================================
-- STEP 11: SGA PAGE PERMISSIONS
-- ============================================

-- Simple permissions table - if row exists, SGA has access to that page
CREATE TABLE IF NOT EXISTS sga_page_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sga_id INT NOT NULL,
  page_key VARCHAR(100) NOT NULL COMMENT 'Page identifier (e.g., production, recruiting, admin)',
  created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sga_id) REFERENCES sgas(id) ON DELETE CASCADE,
  UNIQUE KEY unique_sga_page (sga_id, page_key),
  INDEX idx_sga_id (sga_id),
  INDEX idx_page_key (page_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Set up IDs for permission assignment
SET @arias_id = (SELECT id FROM sgas WHERE rept_name = 'ARIAS ORGANIZATION' LIMIT 1);

-- Give ARIAS ORGANIZATION (default) access to ALL pages
INSERT IGNORE INTO sga_page_permissions (sga_id, page_key) VALUES
-- Production pages
(@arias_id, 'production'),
(@arias_id, 'production_overview'),
(@arias_id, 'reports'),
(@arias_id, 'scorecard'),

-- Recruiting pages
(@arias_id, 'recruiting'),
(@arias_id, 'recruiting_overview'),

-- Training & Resources
(@arias_id, 'training'),
(@arias_id, 'resources'),

-- Tools & Utilities
(@arias_id, 'utilities'),
(@arias_id, 'one_on_one'),
(@arias_id, 'refs'),

-- Admin pages
(@arias_id, 'admin_notifications'),
(@arias_id, 'admin_email_campaigns'),
(@arias_id, 'admin_hierarchy'),
(@arias_id, 'admin_analytics'),
(@arias_id, 'team_customization');

-- Give SURACE-SMITH-PARTNERS access to production, training, and tools only (no recruiting or admin)
INSERT IGNORE INTO sga_page_permissions (sga_id, page_key) VALUES
-- Production pages
(@surace_sga_id, 'production'),
(@surace_sga_id, 'production_overview'),
(@surace_sga_id, 'reports'),
(@surace_sga_id, 'scorecard'),

-- Training & Resources
(@surace_sga_id, 'training'),
(@surace_sga_id, 'resources'),

-- Tools & Utilities
(@surace_sga_id, 'utilities'),
(@surace_sga_id, 'one_on_one'),
(@surace_sga_id, 'refs');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

SELECT 'SGAs Created:' as status;
SELECT id, rept_name, display_name, is_default FROM sgas;

SELECT 'User 92 Agencies:' as status;
SELECT 
  ua.user_id,
  s.rept_name,
  s.display_name,
  ua.is_primary
FROM user_agencies ua
JOIN sgas s ON ua.sga_id = s.id
WHERE ua.user_id = 92;

SELECT 'User 92 Selected Agency:' as status;
SELECT 
  usa.user_id,
  s.rept_name,
  s.display_name
FROM user_selected_agency usa
JOIN sgas s ON usa.sga_id = s.id
WHERE usa.user_id = 92;

SELECT 'ARIAS ORGANIZATION Page Permissions:' as status;
SELECT page_key
FROM sga_page_permissions
WHERE sga_id = @arias_id
ORDER BY page_key;

SELECT 'SURACE-SMITH-PARTNERS Page Permissions:' as status;
SELECT page_key
FROM sga_page_permissions
WHERE sga_id = @surace_sga_id
ORDER BY page_key;

