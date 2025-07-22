-- Create licensed_states table
CREATE TABLE IF NOT EXISTS licensed_states (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    state VARCHAR(2) NOT NULL,
    expiry_date VARCHAR(20),
    license_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_userId (userId),
    INDEX idx_state (state),
    INDEX idx_expiry_date (expiry_date),
    UNIQUE KEY unique_user_state (userId, state)
); 