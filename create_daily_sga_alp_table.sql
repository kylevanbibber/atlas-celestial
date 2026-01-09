-- Create daily_sga_alp table for Production Tracker Day view
-- This table stores daily ALP values for Arias and NY locations

CREATE TABLE IF NOT EXISTS daily_sga_alp (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    arias DECIMAL(15, 2) DEFAULT 0,
    ny DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_date (date),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Example insert/update query
-- INSERT INTO daily_sga_alp (date, arias, ny)
-- VALUES ('2025-10-30', 125000.00, 85000.00)
-- ON DUPLICATE KEY UPDATE
--     arias = VALUES(arias),
--     ny = VALUES(ny);

