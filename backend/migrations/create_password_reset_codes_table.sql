-- Create password_reset_codes table for storing temporary reset codes
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  reset_code VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  INDEX idx_userId (userId),
  INDEX idx_reset_code (reset_code),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (userId) REFERENCES activeusers(id) ON DELETE CASCADE
);

