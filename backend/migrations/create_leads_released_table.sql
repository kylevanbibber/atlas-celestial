-- Create leads_released table
CREATE TABLE IF NOT EXISTS leads_released (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(100),
    notes TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    userId INT NOT NULL,
    lagnname VARCHAR(255) NOT NULL,
    sent TINYINT(1) DEFAULT 0,
    sent_date VARCHAR(50),
    sent_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_userId (userId),
    INDEX idx_lagnname (lagnname),
    INDEX idx_last_updated (last_updated)
); 