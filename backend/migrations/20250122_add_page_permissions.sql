-- ============================================
-- Add SGA Page Permissions Table
-- ============================================

-- Create simple permissions table - if row exists, SGA has access to that page
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

-- Get the SGA IDs
SET @arias_id = (SELECT id FROM sgas WHERE rept_name = 'ARIAS ORGANIZATION' LIMIT 1);
SET @surace_id = (SELECT id FROM sgas WHERE rept_name = 'SURACE-SMITH-PARTNERS' LIMIT 1);

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
(@surace_id, 'production'),
(@surace_id, 'production_overview'),
(@surace_id, 'reports'),
(@surace_id, 'scorecard'),

-- Training & Resources
(@surace_id, 'training'),
(@surace_id, 'resources'),

-- Tools & Utilities
(@surace_id, 'utilities'),
(@surace_id, 'one_on_one'),
(@surace_id, 'refs');

-- Verification queries
SELECT 'Page Permissions Added Successfully!' as status;

SELECT 'ARIAS ORGANIZATION Page Permissions:' as info;
SELECT page_key
FROM sga_page_permissions
WHERE sga_id = @arias_id
ORDER BY page_key;

SELECT 'SURACE-SMITH-PARTNERS Page Permissions:' as info;
SELECT page_key
FROM sga_page_permissions
WHERE sga_id = @surace_id
ORDER BY page_key;

