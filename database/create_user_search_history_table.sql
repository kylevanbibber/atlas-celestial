-- Table to track user search history for personalized search recommendations
CREATE TABLE IF NOT EXISTS user_search_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    query VARCHAR(255) NOT NULL,
    searchCount INT DEFAULT 1,
    lastSearched TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES activeusers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_query (userId, query),
    INDEX idx_user_recent_search (userId, lastSearched DESC)
);

