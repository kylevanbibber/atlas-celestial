-- Table to track user navigation history for personalized search recommendations
CREATE TABLE IF NOT EXISTS user_navigation_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    path VARCHAR(255) NOT NULL,
    label VARCHAR(255) NULL,
    visitCount INT DEFAULT 1,
    lastVisited TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES activeusers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_path (userId, path),
    INDEX idx_user_visits (userId, visitCount DESC),
    INDEX idx_user_recent (userId, lastVisited DESC)
);

-- Optional: Add index for cleanup of old records
CREATE INDEX idx_last_visited ON user_navigation_history(lastVisited);

