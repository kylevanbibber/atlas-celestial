-- Create a table for iCal subscriptions (supports multiple per user)
CREATE TABLE IF NOT EXISTS calendar_ical_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  url TEXT NOT NULL,
  label VARCHAR(100) DEFAULT 'My Calendar',
  color VARCHAR(20) DEFAULT '#17a2b8',
  last_synced_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
);

-- Expand source ENUM on calendar_events to include ical
ALTER TABLE calendar_events MODIFY COLUMN source ENUM('manual','calendly','google','outlook','ical','system') DEFAULT 'manual';
