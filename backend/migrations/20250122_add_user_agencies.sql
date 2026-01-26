-- Add the new SURACE-SMITH-PARTNERS SGA
INSERT INTO sgas (rept_name, display_name, active, hide, is_default) 
VALUES ('SURACE-SMITH-PARTNERS', 'Surace Smith Partners', 1, 0, 0);

-- Get the ID of the new SGA
SET @surace_sga_id = LAST_INSERT_ID();

-- Add alternative names for Surace Smith Partners
INSERT INTO sga_alternative_names (sga_id, alternative_name) VALUES
(@surace_sga_id, 'SURACE-SMITH-PARTNERS'),
(@surace_sga_id, 'Surace-Smith-Partners'),
(@surace_sga_id, 'SURACE SMITH PARTNERS'),
(@surace_sga_id, 'Surace Smith Partners'),
(@surace_sga_id, 'SSP');

-- Create user_agencies table to associate users with SGAs they can access
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

-- Create table to store user's currently selected agency
CREATE TABLE IF NOT EXISTS user_selected_agency (
  user_id INT PRIMARY KEY,
  sga_id INT NOT NULL,
  updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES activeusers(id) ON DELETE CASCADE,
  FOREIGN KEY (sga_id) REFERENCES sgas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Get the default SGA ID (ARIAS ORGANIZATION)
SET @default_sga_id = (SELECT id FROM sgas WHERE is_default = 1 LIMIT 1);

-- Give user 92 access to both agencies
INSERT IGNORE INTO user_agencies (user_id, sga_id, is_primary) VALUES
(92, @default_sga_id, 1),
(92, @surace_sga_id, 0);

-- Set user 92's current selection to the default agency
INSERT IGNORE INTO user_selected_agency (user_id, sga_id) VALUES
(92, @default_sga_id);

