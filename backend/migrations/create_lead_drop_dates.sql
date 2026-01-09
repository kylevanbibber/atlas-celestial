-- Create table for lead allotment drop dates
-- This table stores the scheduled dates when leads are dropped/distributed to agents

CREATE TABLE IF NOT EXISTS lead_drop_dates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    drop_date DATE NOT NULL,
    drop_name VARCHAR(100), -- Optional name/label for the drop (e.g., "January Drop 1", "Mid-Month")
    allotment_month VARCHAR(7) NOT NULL, -- YYYY-MM format, which allotment period this drop is for
    notes TEXT, -- Optional notes about this drop
    is_active BOOLEAN DEFAULT TRUE, -- Can be set to false to hide/disable a drop
    created_by INT, -- User ID of who created this drop date
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE SET NULL,
    INDEX idx_drop_date (drop_date),
    INDEX idx_allotment_month (allotment_month),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add some example drop dates (first and third week of each month for the next few months)
-- These can be modified/deleted by admins through the UI
INSERT INTO lead_drop_dates (drop_date, drop_name, allotment_month, notes) VALUES
('2025-12-05', 'December Drop 1', '2025-12', 'First drop of December'),
('2025-12-19', 'December Drop 2', '2025-12', 'Second drop of December'),
('2026-01-02', 'January Drop 1', '2026-01', 'First drop of January'),
('2026-01-16', 'January Drop 2', '2026-01', 'Second drop of January'),
('2026-01-30', 'January Drop 3', '2026-01', 'Third drop of January'),
('2026-02-06', 'February Drop 1', '2026-02', 'First drop of February'),
('2026-02-20', 'February Drop 2', '2026-02', 'Second drop of February')
ON DUPLICATE KEY UPDATE drop_date = VALUES(drop_date);

