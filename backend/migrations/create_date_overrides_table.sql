-- Create date_overrides table for custom month date ranges
CREATE TABLE IF NOT EXISTS date_overrides (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  schedule_type ENUM('mon-sun', 'wed-tue') DEFAULT 'mon-sun',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_year_month (year, month),
  FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE SET NULL,
  INDEX idx_year_month (year, month)
);

-- Add some example data for testing
-- INSERT INTO date_overrides (year, month, start_date, end_date, created_by) 
-- VALUES (2025, 10, '2025-09-24', '2025-10-31', 92);
