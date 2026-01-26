-- Create SGAs table
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

-- Create SGA alternative names table
CREATE TABLE IF NOT EXISTS sga_alternative_names (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sga_id INT NOT NULL,
  alternative_name VARCHAR(255) NOT NULL COMMENT 'Alternative name as it appears in reports',
  created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sga_id) REFERENCES sgas(id) ON DELETE CASCADE,
  INDEX idx_sga_id (sga_id),
  INDEX idx_alternative_name (alternative_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default SGA (Arias Organization)
INSERT INTO sgas (rept_name, display_name, active, hide, is_default) 
VALUES ('ARIAS ORGANIZATION', 'Arias Organization', 1, 0, 1);

-- Get the ID of the default SGA
SET @default_sga_id = LAST_INSERT_ID();

-- Add some common alternative names for Arias Organization
INSERT INTO sga_alternative_names (sga_id, alternative_name) VALUES
(@default_sga_id, 'ARIAS ORGANIZATION'),
(@default_sga_id, 'Arias Organization'),
(@default_sga_id, 'ARIAS ORG'),
(@default_sga_id, 'Arias Org');

