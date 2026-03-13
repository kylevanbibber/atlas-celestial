-- Production Reports Database Schema
-- File Categories Table
CREATE TABLE IF NOT EXISTS file_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7), -- For hex color codes like #0078d7
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    INDEX idx_active (is_active),
    INDEX idx_sort_order (sort_order)
);

-- OneDrive Reports Table
CREATE TABLE IF NOT EXISTS onedrive_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject VARCHAR(255) NOT NULL, -- Email subject line
    report_name VARCHAR(255) NOT NULL,
    report_description TEXT,
    category_id INT,
    frequency ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'ad-hoc') DEFAULT 'ad-hoc',
    onedrive_url TEXT NOT NULL, -- URL to OneDrive file
    file_name VARCHAR(255),
    file_size VARCHAR(50), -- Store as string like "245 KB"
    file_type VARCHAR(10) DEFAULT 'xlsx',
    upload_date DATE,
    is_hidden BOOLEAN DEFAULT FALSE,
    is_from_home_office BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0, -- For sorting within category
    tags JSON, -- Store tags as JSON array for flexible tagging
    metadata JSON, -- Store additional metadata like version info
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NOT NULL,
    updated_by INT,
    
    -- Foreign key constraints
    FOREIGN KEY (category_id) REFERENCES file_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES activeusers(id) ON DELETE SET NULL,
    
    -- Indexes for performance
    INDEX idx_category (category_id),
    INDEX idx_frequency (frequency),
    INDEX idx_hidden (is_hidden),
    INDEX idx_upload_date (upload_date),
    INDEX idx_priority (priority),
    INDEX idx_created_by (created_by)
);

-- Report Versions Table (for tracking version history)
CREATE TABLE IF NOT EXISTS report_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    version_name VARCHAR(255),
    file_name VARCHAR(255) NOT NULL,
    onedrive_url TEXT NOT NULL,
    file_size VARCHAR(50),
    upload_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    version_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT NOT NULL,
    
    FOREIGN KEY (report_id) REFERENCES onedrive_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE CASCADE,
    
    INDEX idx_report_id (report_id),
    INDEX idx_current (is_current),
    INDEX idx_upload_date (upload_date)
);

-- Report Access Logs (optional - for tracking who accessed what)
CREATE TABLE IF NOT EXISTS report_access_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    user_id INT NOT NULL,
    access_type ENUM('view', 'download') NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (report_id) REFERENCES onedrive_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES activeusers(id) ON DELETE CASCADE,
    
    INDEX idx_report_access (report_id, accessed_at),
    INDEX idx_user_access (user_id, accessed_at)
);

-- Insert default categories
INSERT INTO file_categories (name, description, icon, color, sort_order) VALUES
('VIPs', 'VIP client reports and analytics', 'FiUsers', '#dc2626', 0),
('Daily Reports', 'Daily production and activity reports', 'FiCalendar', '#2563eb', 1),
('Weekly Reports', 'Weekly summary and performance reports', 'FiCalendar', '#7c3aed', 2),
('Monthly Reports', 'Monthly production and analytics reports', 'FiBarChart2', '#059669', 3),
('Quarterly Reports', 'Quarterly business and performance reports', 'FiTrendingUp', '#dc2626', 4),
('Annual Reports', 'Annual summaries and year-end reports', 'FiTrendingUp', '#ea580c', 5),
('Custom Reports', 'Special and ad-hoc reports', 'FiFolder', '#6b7280', 6),
('Home Office Reports', 'Reports sent from corporate headquarters', 'BsCloudCheck', '#0078d7', 7)
ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    icon = VALUES(icon),
    color = VALUES(color),
    sort_order = VALUES(sort_order); 