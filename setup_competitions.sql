-- Quick setup script for competitions table
-- Run this SQL directly in your MySQL database

USE AriasLifeUsers;

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
  INDEX idx_status (status),
  INDEX idx_dates (start_date, end_date),
  INDEX idx_type (competition_type),
  INDEX idx_metric (metric_type),
  INDEX idx_global (is_global)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insert a test competition to see it working
INSERT INTO competitions (title, description, prize, rules, start_date, end_date, status, competition_type, metric_type, target_value, is_global, created_by) 
VALUES (
  'February ALP Challenge', 
  'Monthly competition to drive ALP performance', 
  '$500 bonus + recognition trophy', 
  '• Track your ALP from Feb 1-28\n• All active agents eligible\n• Must maintain good standing throughout the month', 
  '2025-02-01 00:00:00', 
  '2025-02-28 23:59:59', 
  'active', 
  'individual', 
  'alp', 
  5000.00, 
  true, 
  92
);

SELECT * FROM competitions;
