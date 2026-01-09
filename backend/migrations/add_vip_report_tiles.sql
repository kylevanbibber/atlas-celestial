-- Migration: Add VIP Report Tiles
-- Description: Adds 5 separate report tiles for VIP-related reports that were previously tabs under "Codes & VIPs"
-- Date: 2025-01-17

-- First, ensure we have a "Production" category for these reports
INSERT INTO file_categories (name, description, icon, color, sort_order, is_active) VALUES
('Production', 'Production and agent performance reports', 'FiActivity', '#059669', 8, TRUE)
ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    icon = VALUES(icon),
    color = VALUES(color);

-- Get the category ID for Production (will be used in the reports)
SET @production_category_id = (SELECT id FROM file_categories WHERE name = 'Production' LIMIT 1);

-- Get a default admin user ID for created_by field
SET @admin_user_id = (SELECT id FROM activeusers WHERE Role = 'Admin' LIMIT 1);

-- Insert the 5 new VIP report tiles
-- Note: Using INSERT IGNORE to prevent duplicates if migration is run multiple times

-- 1. Potential VIPs Report
INSERT IGNORE INTO onedrive_reports (
    subject,
    report_name,
    report_description,
    category_id,
    frequency,
    report_type,
    component_name,
    icon_name,
    is_hidden,
    is_active,
    is_from_home_office,
    priority,
    sort_order,
    tags,
    metadata,
    created_by
) VALUES (
    'Potential VIPs',
    'Potential VIPs',
    'Track agents approaching VIP status based on production performance',
    @production_category_id,
    'daily',
    'app',
    'PotentialVIPsReport',
    'FiStar',
    FALSE,
    TRUE,
    FALSE,
    5,
    10,
    JSON_ARRAY('vips', 'production', 'tracking', 'agents'),
    JSON_OBJECT('category', 'Production', 'source', 'internal'),
    @admin_user_id
);

-- 2. Pending Users Report
INSERT IGNORE INTO onedrive_reports (
    subject,
    report_name,
    report_description,
    category_id,
    frequency,
    report_type,
    component_name,
    icon_name,
    is_hidden,
    is_active,
    is_from_home_office,
    priority,
    sort_order,
    tags,
    metadata,
    created_by
) VALUES (
    'Pending Users',
    'Pending Users',
    'Monitor agents pending activation and onboarding status',
    @production_category_id,
    'daily',
    'app',
    'PendingUsersReport',
    'FiClock',
    FALSE,
    TRUE,
    FALSE,
    4,
    20,
    JSON_ARRAY('pending', 'onboarding', 'tracking', 'agents'),
    JSON_OBJECT('category', 'Production', 'source', 'internal'),
    @admin_user_id
);

-- 3. Codes Report
INSERT IGNORE INTO onedrive_reports (
    subject,
    report_name,
    report_description,
    category_id,
    frequency,
    report_type,
    component_name,
    icon_name,
    is_hidden,
    is_active,
    is_from_home_office,
    priority,
    sort_order,
    tags,
    metadata,
    created_by
) VALUES (
    'Codes',
    'Codes',
    'Track agent code assignments and processing time from pending to active',
    @production_category_id,
    'daily',
    'app',
    'CodesReport',
    'FiFileText',
    FALSE,
    TRUE,
    FALSE,
    3,
    30,
    JSON_ARRAY('codes', 'production', 'tracking', 'processing'),
    JSON_OBJECT('category', 'Production', 'source', 'internal'),
    @admin_user_id
);

-- 4. SAGA Codes Report
INSERT IGNORE INTO onedrive_reports (
    subject,
    report_name,
    report_description,
    category_id,
    frequency,
    report_type,
    component_name,
    icon_name,
    is_hidden,
    is_active,
    is_from_home_office,
    priority,
    sort_order,
    tags,
    metadata,
    created_by
) VALUES (
    'SAGA Codes',
    'SAGA Codes',
    'Track SA and GA level code assignments and performance metrics',
    @production_category_id,
    'daily',
    'app',
    'SAGACodesReport',
    'FiAward',
    FALSE,
    TRUE,
    FALSE,
    2,
    40,
    JSON_ARRAY('saga', 'codes', 'tracking', 'management'),
    JSON_OBJECT('category', 'Production', 'source', 'internal'),
    @admin_user_id
);

-- 5. Code Potential Report
INSERT IGNORE INTO onedrive_reports (
    subject,
    report_name,
    report_description,
    category_id,
    frequency,
    report_type,
    component_name,
    icon_name,
    is_hidden,
    is_active,
    is_from_home_office,
    priority,
    sort_order,
    tags,
    metadata,
    created_by
) VALUES (
    'Code Potential',
    'Code Potential',
    'Identify agents with coding potential and track their progress',
    @production_category_id,
    'daily',
    'app',
    'CodePotentialReport',
    'FiTarget',
    FALSE,
    TRUE,
    FALSE,
    1,
    50,
    JSON_ARRAY('potential', 'codes', 'tracking', 'analytics'),
    JSON_OBJECT('category', 'Production', 'source', 'internal'),
    @admin_user_id
);

-- Verify the insertions
SELECT 
    id, 
    report_name, 
    component_name, 
    report_type, 
    is_active 
FROM onedrive_reports 
WHERE component_name IN (
    'PotentialVIPsReport', 
    'PendingUsersReport', 
    'CodesReport', 
    'SAGACodesReport', 
    'CodePotentialReport'
)
ORDER BY sort_order ASC;

