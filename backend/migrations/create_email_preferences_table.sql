-- Email Preferences
-- Allows users to opt out of specific automated email types
-- Default: if no row exists, user is opted-in (receives emails)

CREATE TABLE IF NOT EXISTS email_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  preference_type VARCHAR(50) NOT NULL,
  enabled TINYINT(1) DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_user_pref (user_id, preference_type),
  INDEX idx_pref_type (preference_type)
);
