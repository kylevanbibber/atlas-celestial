-- Create competitions table for competition management
-- This script uses only the activeusers table for participation tracking
-- Run this in your MySQL database

CREATE TABLE IF NOT EXISTS competitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  prize TEXT NOT NULL,
  rules TEXT NOT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  status ENUM('draft', 'active', 'completed', 'cancelled') DEFAULT 'draft',
  competition_type ENUM('individual', 'team', 'group') DEFAULT 'individual',
  metric_type ENUM('alp', 'calls', 'appointments', 'sales', 'codes', 'hires', 'refs', 'custom') NOT NULL,
  target_value DECIMAL(15, 2),
  min_participants INT DEFAULT 1,
  max_participants INT,
  is_global BOOLEAN DEFAULT false,
  eligible_roles JSON,
  eligible_users JSON,
  progress_calculation_type ENUM('sum', 'average', 'max', 'min', 'count') DEFAULT 'sum',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE RESTRICT,
  INDEX idx_status (status),
  INDEX idx_dates (start_date, end_date),
  INDEX idx_type (competition_type),
  INDEX idx_metric (metric_type),
  INDEX idx_global (is_global)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Verify table was created
SHOW CREATE TABLE competitions;
