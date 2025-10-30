-- Create commits table for user commitments on hires, codes, and vips
-- This table maintains a history of all commit changes (no unique constraint)
CREATE TABLE IF NOT EXISTS commits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  lagnname VARCHAR(255) NOT NULL,
  clname VARCHAR(50),
  time_period ENUM('month', 'week') NOT NULL,
  type ENUM('hires', 'codes', 'vips') NOT NULL,
  start DATE NOT NULL,
  end DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES activeusers(id) ON DELETE CASCADE,
  INDEX idx_user_type (userId, type),
  INDEX idx_period (time_period, start, end),
  INDEX idx_user_period_type (userId, time_period, type, start, end, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
