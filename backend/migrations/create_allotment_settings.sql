-- Allotment Settings Table
-- Stores custom configuration for allotment calculations per month

CREATE TABLE IF NOT EXISTS allotment_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    target_month VARCHAR(7) NOT NULL, -- YYYY-MM format (e.g., '2026-01' for January 2026 allotment)
    
    -- Source months for calculations
    ref_months JSON, -- Array of months to use for referral counting (e.g., ["2025-10", "2025-11"])
    alp_months JSON, -- Array of months to use for ALP calculation (e.g., ["2025-10", "2025-11"])
    
    -- Group requirements
    group_ref_requirements JSON, -- Object with group refs (e.g., {"1": 6, "2": 5, "3": 4, "4": 3, "5": 2})
    
    -- VIP configuration
    vip_enabled BOOLEAN DEFAULT TRUE,
    vip_alp_value INT DEFAULT 5000, -- ALP value per VIP
    vip_months JSON, -- Array of months to check for VIPs (usually same as alp_months)
    
    -- Custom group settings
    custom_groups_enabled BOOLEAN DEFAULT TRUE,
    
    -- Notes and metadata
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_target_month (target_month),
    FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE SET NULL,
    
    INDEX idx_target_month (target_month)
);

-- Add some example/default settings
-- For January 2026 (uses Oct + Nov 2025 data)
INSERT INTO allotment_settings 
(target_month, ref_months, alp_months, group_ref_requirements, vip_months, notes, created_by) 
VALUES 
(
    '2026-01',
    '["2025-10", "2025-11"]',
    '["2025-10", "2025-11"]',
    '{"1": 6, "2": 5, "3": 4, "4": 3, "5": 2}',
    '["2025-10", "2025-11"]',
    'January 2026 allotment uses October and November 2025 data (2 months)',
    NULL
)
ON DUPLICATE KEY UPDATE 
    ref_months = VALUES(ref_months),
    alp_months = VALUES(alp_months),
    notes = VALUES(notes);

-- For February 2026 (uses Dec 2025 data - default behavior)
INSERT INTO allotment_settings 
(target_month, ref_months, alp_months, group_ref_requirements, vip_months, notes, created_by) 
VALUES 
(
    '2026-02',
    '["2025-12"]',
    '["2025-12"]',
    '{"1": 6, "2": 5, "3": 4, "4": 3, "5": 2}',
    '["2025-12"]',
    'February 2026 allotment uses December 2025 data (default: prev-prev month)',
    NULL
)
ON DUPLICATE KEY UPDATE 
    ref_months = VALUES(ref_months),
    alp_months = VALUES(alp_months),
    notes = VALUES(notes);

