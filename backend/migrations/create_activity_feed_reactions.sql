CREATE TABLE IF NOT EXISTS activity_feed_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(100) NOT NULL,
  user_id INT NOT NULL,
  reaction VARCHAR(20) NOT NULL DEFAULT 'like',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_reaction (event_id, user_id, reaction),
  INDEX idx_event_id (event_id),
  INDEX idx_user_id (user_id)
);
